import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame, gameToDbUpdate, toJson, safeErrorMessage } from '@/lib/db-helpers'
import { getLawById, resolveLawPassage, applyLawPassage, canUseNpcAbility, resolveLawNpcReactions } from '@/lib/law-engine'
import { applyDelta, pickEvent, advanceMonth, computeLegacyScore } from '@/lib/game-engine'
import { resolveRoster } from '@/lib/cabinet'
import { driftTraits } from '@/lib/cabinet-traits'
import { applyCabinetNarrative, pickAmbientHeadline } from '@/lib/cabinet-narrative'
import { computeScandalMitigation } from '@/lib/cabinet-abilities'
import { generateLawHeadline } from '@/lib/headlines'
import { unlockAchievements } from '@/lib/achievements'
import { computeSpecialEditionCovers, type CoverContent } from '@/lib/magazine-covers'
import type { Headline } from '@/lib/headlines'
import type { GameOverReason, NpcReactionResult } from '@/types/game'

interface Params { params: Promise<{ id: string }> }

interface ProposeLawBody {
  lawId: string
  useNpcAbility?: 'senate_leader' | 'speaker'
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ProposeLawBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lawId, useNpcAbility } = body
  if (!lawId || typeof lawId !== 'string') {
    return NextResponse.json({ error: 'lawId is required' }, { status: 400 })
  }
  if (useNpcAbility && !['senate_leader', 'speaker'].includes(useNpcAbility)) {
    return NextResponse.json({ error: 'Invalid useNpcAbility value' }, { status: 400 })
  }

  const law = getLawById(lawId)
  if (!law) {
    return NextResponse.json({ error: 'Unknown law' }, { status: 404 })
  }

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (row.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (row.status !== 'ACTIVE') return NextResponse.json({ error: 'Game is not active' }, { status: 400 })

  const game = dbToGame(row)

  if (game.passedLaws.includes(lawId)) {
    return NextResponse.json({ error: 'This law has already passed' }, { status: 400 })
  }
  if (law.blocks_laws.some(bid => game.passedLaws.includes(bid))) {
    return NextResponse.json({ error: 'A mutually exclusive law has already passed this term' }, { status: 400 })
  }

  if (useNpcAbility) {
    const { eligible, reason } = canUseNpcAbility(game, useNpcAbility)
    if (!eligible) {
      return NextResponse.json({ error: reason }, { status: 400 })
    }
  }

  let passageResult: ReturnType<typeof resolveLawPassage>
  let updatedGame: ReturnType<typeof applyLawPassage>
  let cascadeHeadlines: Headline[]
  let gameOver: GameOverReason | null = null
  let npcReactions: NpcReactionResult[] = []
  let suggestedEvent: ReturnType<typeof pickEvent> = null
  try {
    passageResult = resolveLawPassage(law, game, { useNpcAbility })
    updatedGame = applyLawPassage(game, law, passageResult)

    if (passageResult.passed) {
      updatedGame = {
        ...updatedGame,
        stats: applyDelta(updatedGame.stats, law.effects.onPass),
      }
      const { reactions, newRelationships } = resolveLawNpcReactions(updatedGame, law)
      npcReactions = reactions
      updatedGame = { ...updatedGame, npcRelationships: newRelationships }
    }

    const preNarrativeGame = updatedGame
    const roster = resolveRoster(game)
    const scandalMitigation = computeScandalMitigation(preNarrativeGame, roster)
    const advance = advanceMonth(updatedGame, [], undefined, scandalMitigation)
    updatedGame = advance.game
    cascadeHeadlines = advance.cascadeHeadlines
    gameOver = advance.gameOver

    const driftedTraits = driftTraits(preNarrativeGame)
    const narrative = applyCabinetNarrative(preNarrativeGame, { ...updatedGame, npcTraits: driftedTraits }, roster)
    updatedGame = narrative.game
    suggestedEvent = narrative.suggestedEvent

    // Ambient tier — same precedent as /turn: only when nothing more
    // substantial (an initiative-engine scene) is already happening.
    const ambientHeadline = suggestedEvent ? null : pickAmbientHeadline(roster)
    if (ambientHeadline) cascadeHeadlines = [...cascadeHeadlines, ambientHeadline]
  } catch (err) {
    const message = safeErrorMessage(err, 'Law could not be processed')
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const nextEvent = suggestedEvent ?? (updatedGame.status === 'ACTIVE' ? pickEvent(updatedGame) : null)

  const [updateResult] = await prisma.$transaction([
    prisma.game.updateMany({
      where: { id: id, updatedAt: row.updatedAt },
      data:  { ...gameToDbUpdate(updatedGame), currentEventId: nextEvent?.id ?? null },
    }),
    prisma.gameLog.create({
      data: {
        gameId:      id,
        month:       game.currentMonth,
        actionType:  passageResult.passed ? 'LAW_PASSED' : 'LAW_FAILED',
        lawId:       law.id,
        statDeltas:  toJson(passageResult.passed ? law.effects.onPass : {}),
        narrative:   passageResult.usedAbility
          ? `${law.title} passed via ${passageResult.usedAbility}.`
          : passageResult.passed
          ? `${law.title} passed Congress ${passageResult.probability}% probability.`
          : `${law.title} failed to pass Congress (${passageResult.probability}% probability).`,
      },
    }),
  ])

  if (updateResult.count === 0) {
    return NextResponse.json(
      { error: 'This turn was already processed by another request. Reload to see the current state.' },
      { status: 409 }
    )
  }

  const headline = generateLawHeadline(law.title, law.category, law.sector, passageResult.passed, passageResult.usedAbility)
  const newAchievements = gameOver ? await unlockAchievements(session.user.id, updatedGame, gameOver) : []
  const specialCovers: CoverContent[] = gameOver
    ? computeSpecialEditionCovers(updatedGame, gameOver, computeLegacyScore(updatedGame))
    : []

  return NextResponse.json({
    game: updatedGame,
    passageResult,
    headline,
    cascadeHeadlines,
    nextEvent,
    newAchievements,
    specialCovers,
    npcReactions,
  })
}

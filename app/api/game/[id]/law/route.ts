import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame, gameToDbUpdate, toJson } from '@/lib/db-helpers'
import { getLawById, resolveLawPassage, applyLawPassage, canUseNpcAbility } from '@/lib/law-engine'
import { computePassiveDrift, applyDelta, pickEvent, checkGameOver, computeLegacyScore } from '@/lib/game-engine'
import { generateLawHeadline } from '@/lib/headlines'
import { checkAndEnqueueChains, resolveDueConsequences } from '@/lib/cascade-engine'
import { unlockAchievements } from '@/lib/achievements'
import type { Headline } from '@/lib/headlines'
import type { GameOverReason } from '@/types/game'

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
  try {
    passageResult = resolveLawPassage(law, game, { useNpcAbility })
    updatedGame = applyLawPassage(game, law, passageResult)

    if (passageResult.passed) {
      updatedGame = {
        ...updatedGame,
        stats: applyDelta(updatedGame.stats, law.effects.onPass),
      }
    }

    const drift = computePassiveDrift(updatedGame)
    const nextMonthNumber = updatedGame.currentMonth + 1
    const { effects: cascadeEffects, headlines, remaining, newCooldowns } =
      resolveDueConsequences(updatedGame.pendingConsequences, nextMonthNumber)
    cascadeHeadlines = headlines

    const combinedDrift = { ...drift }
    for (const [k, v] of Object.entries(cascadeEffects) as [keyof typeof drift, number][]) {
      combinedDrift[k] = ((combinedDrift[k] ?? 0) as number) + v
    }

    const driftedStats = applyDelta(updatedGame.stats, combinedDrift)
    const updatedCooldowns = { ...updatedGame.chainCooldowns, ...newCooldowns }

    const newPendingConsequences = checkAndEnqueueChains(
      { ...updatedGame, stats: driftedStats, currentMonth: nextMonthNumber },
      remaining,
      updatedCooldowns,
    )

    updatedGame = {
      ...updatedGame,
      stats:               driftedStats,
      pendingConsequences: newPendingConsequences,
      chainCooldowns:      updatedCooldowns,
      currentMonth:        nextMonthNumber,
      approvalHistory:     [...updatedGame.approvalHistory, Math.round(driftedStats.approval)],
      updatedAt:           new Date().toISOString(),
    }

    gameOver = checkGameOver(updatedGame)
    if (gameOver) {
      updatedGame.status = gameOver === 'TERM_COMPLETE' ? 'COMPLETE' : 'GAMEOVER'
      updatedGame.legacyScore = computeLegacyScore(updatedGame).total
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Law could not be processed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const nextEvent = updatedGame.status === 'ACTIVE' ? pickEvent(updatedGame) : null

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

  const headline = generateLawHeadline(law.title, law.category, passageResult.passed, passageResult.usedAbility)
  const newAchievements = gameOver ? await unlockAchievements(session.user.id, updatedGame, gameOver) : []

  return NextResponse.json({
    game: updatedGame,
    passageResult,
    headline,
    cascadeHeadlines,
    nextEvent,
    newAchievements,
  })
}

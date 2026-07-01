import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame, gameToDbUpdate } from '@/lib/db-helpers'
import { getLawById, resolveLawPassage, applyLawPassage, canUseNpcAbility } from '@/lib/law-engine'
import { computePassiveDrift, applyDelta, pickEvent } from '@/lib/game-engine'
import { generateLawHeadline } from '@/lib/headlines'
import { checkAndEnqueueChains, resolveDueConsequences } from '@/lib/cascade-engine'
import type { InputJsonValue } from '@prisma/client/runtime/library'

interface Params { params: Promise<{ id: string }> }

interface ProposeLawBody {
  lawId: string
  useNpcAbility?: 'senate_leader' | 'speaker'
}

function toJson(value: unknown): InputJsonValue {
  return value as InputJsonValue
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

  const passageResult = resolveLawPassage(law, game, { useNpcAbility })
  let updatedGame = applyLawPassage(game, law, passageResult)

  if (passageResult.passed) {
    updatedGame = {
      ...updatedGame,
      stats: applyDelta(updatedGame.stats, law.effects.onPass),
    }
  }

  const drift = computePassiveDrift(updatedGame)
  const nextMonthNumber = updatedGame.currentMonth + 1
  const { effects: cascadeEffects, headlines: cascadeHeadlines, remaining, newCooldowns } =
    resolveDueConsequences(updatedGame.pendingConsequences, nextMonthNumber)

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

  const [updateResult] = await prisma.$transaction([
    prisma.game.updateMany({
      where: { id: id, updatedAt: row.updatedAt },
      data:  gameToDbUpdate(updatedGame),
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

  const nextEvent = updatedGame.status === 'ACTIVE' ? pickEvent(updatedGame) : null
  const headline = generateLawHeadline(law.title, law.category, passageResult.passed, passageResult.usedAbility)

  return NextResponse.json({
    game: updatedGame,
    passageResult,
    headline,
    cascadeHeadlines,
    nextEvent,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processEventTurn, pickEvent, EVENTS } from '@/lib/game-engine'
import { computePresidentialArchetype } from '@/lib/archetype-engine'
import { dbToGame, gameToDbUpdate, toJson } from '@/lib/db-helpers'
import type { ProcessTurnRequest, GameLog } from '@/types/game'

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ProcessTurnRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { eventId, choiceIndex } = body

  if (!eventId || typeof eventId !== 'string') {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }
  if (typeof choiceIndex !== 'number' || choiceIndex < 0 || choiceIndex > 3) {
    return NextResponse.json({ error: 'choiceIndex must be 0–3' }, { status: 400 })
  }

  const row = await prisma.game.findUnique({ where: { id } })

  if (!row) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }
  if (row.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (row.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Game is not active' }, { status: 400 })
  }

  const game = dbToGame(row)

  const submittedEvent = EVENTS.find(e => e.id === eventId)
  if (!submittedEvent) {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
  }

  let result: ReturnType<typeof processEventTurn>
  try {
    result = processEventTurn(game, eventId, choiceIndex)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Decision could not be processed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const nextEvent = result.updatedGame.status === 'ACTIVE'
    ? pickEvent(result.updatedGame)
    : null

  const [updateResult] = await prisma.$transaction([
    prisma.game.updateMany({
      where: { id: id, updatedAt: row.updatedAt },
      data:  { ...gameToDbUpdate(result.updatedGame), currentEventId: nextEvent?.id ?? null } as any,
    }),
    prisma.gameLog.create({
      data: {
        gameId:      id,
        month:       result.log.month,
        actionType:  result.log.actionType,
        eventId:     result.log.eventId     ?? null,
        choiceIndex: result.log.choiceIndex ?? null,
        lawId:       result.log.lawId       ?? null,
        statDeltas:  toJson(result.log.statDeltas),
        narrative:   result.log.narrative   ?? null,
      },
    }),
  ])

  if (updateResult.count === 0) {
    return NextResponse.json(
      { error: 'This turn was already processed by another request. Reload to see the current state.' },
      { status: 409 }
    )
  }

  let archetype = undefined
  if (result.gameOver) {
    const allLogs = await prisma.gameLog.findMany({
      where: { gameId: id },
      orderBy: { month: 'asc' },
    })
    const gameLogs: GameLog[] = allLogs.map(l => ({
      id:          l.id,
      gameId:      l.gameId,
      month:       l.month,
      actionType:  l.actionType as GameLog['actionType'],
      eventId:     l.eventId    ?? undefined,
      choiceIndex: l.choiceIndex ?? undefined,
      lawId:       l.lawId      ?? undefined,
      statDeltas:  l.statDeltas as GameLog['statDeltas'],
      narrative:   l.narrative  ?? undefined,
      createdAt:   l.createdAt.toISOString(),
    }))
    archetype = computePresidentialArchetype(result.updatedGame, gameLogs)
  }

  return NextResponse.json({ result: { ...result, archetype }, nextEvent })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processEventTurn, pickEvent, isEventEligible, EVENTS } from '@/lib/game-engine'
import { computePresidentialArchetype } from '@/lib/archetype-engine'
import { dbToGame, gameToDbUpdate } from '@/lib/db-helpers'
import type { ProcessTurnRequest } from '@/types/game'

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

  // Re-validate that the submitted event is one the player could
  // legitimately have been shown right now — without this, a modified
  // client request could fire any of the 82 events regardless of
  // month/stat/flag gates (e.g. a rare weight-3 event, or one scoped to
  // a narrow month window like midterm_results at months 24-26 only).
  const submittedEvent = EVENTS.find(e => e.id === eventId)
  if (!submittedEvent) {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
  }
  if (!isEventEligible(submittedEvent, game, { ignoreRecentBlock: true })) {
    return NextResponse.json(
      { error: 'This event is no longer available for the current game state' },
      { status: 409 }
    )
  }

  const result = processEventTurn(game, eventId, choiceIndex)

  // Persist game state and log in a transaction, with an optimistic-lock
  // guard on updatedAt: if another request already advanced this game
  // since we read it (double-click, network retry, multiple tabs), the
  // updateMany's where-clause matches zero rows and we detect that below
  // rather than silently overwriting the other request's turn.
  const [updateResult] = await prisma.$transaction([
    prisma.game.updateMany({
      where: { id: id, updatedAt: row.updatedAt },
      data:  gameToDbUpdate(result.updatedGame),
    }),
    prisma.gameLog.create({
      data: {
        gameId:      id,
        month:       result.log.month,
        actionType:  result.log.actionType,
        eventId:     result.log.eventId     ?? null,
        choiceIndex: result.log.choiceIndex ?? null,
        lawId:       result.log.lawId       ?? null,
        statDeltas:  result.log.statDeltas,
        narrative:   result.log.narrative   ?? null,
      },
    }),
  ])

  if (updateResult.count === 0) {
    // Another request already advanced this turn between our read and
    // write. The log row above already committed (harmless — it's just
    // a record), but the game state itself was NOT overwritten by us.
    return NextResponse.json(
      { error: 'This turn was already processed by another request. Reload to see the current state.' },
      { status: 409 }
    )
  }

  const nextEvent = result.updatedGame.status === 'ACTIVE'
    ? pickEvent(result.updatedGame)
    : null

  // Compute archetype on game-over so the client has it for the legacy screen
  let archetype = undefined
  if (result.gameOver) {
    const allLogs = await prisma.gameLog.findMany({
      where: { gameId: id },
      orderBy: { month: 'asc' },
    })
    archetype = computePresidentialArchetype(result.updatedGame, allLogs as import('@/types/game').GameLog[])
  }

  return NextResponse.json({ result: { ...result, archetype }, nextEvent })
}

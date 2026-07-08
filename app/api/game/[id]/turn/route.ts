import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processEventTurn, pickEvent, isEventEligible, EVENTS, computeLegacyScore } from '@/lib/game-engine'
import { resolveRoster } from '@/lib/cabinet'
import { driftTraits } from '@/lib/cabinet-traits'
import { applyCabinetNarrative, pickAmbientHeadline } from '@/lib/cabinet-narrative'
import { computePresidentialArchetype } from '@/lib/archetype-engine'
import { unlockAchievements } from '@/lib/achievements'
import { computeSpecialEditionCovers, type CoverContent } from '@/lib/magazine-covers'
import { dbToGame, gameToDbUpdate, toJson, safeErrorMessage } from '@/lib/db-helpers'
import type { ProcessTurnRequest, GameLog, Achievement } from '@/types/game'

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
  // Personnel-category scenes are turn-free and resolved through their own
  // route (POST /api/game/[id]/personnel) — this route is crisis-briefing
  // only, and always advances the month.
  if (submittedEvent.category === 'personnel') {
    return NextResponse.json({ error: 'This is a personnel matter, not a crisis briefing' }, { status: 400 })
  }
  if (!isEventEligible(submittedEvent, game, { ignoreRecentBlock: true })) {
    return NextResponse.json(
      { error: 'This event is no longer available for the current game state' },
      { status: 409 }
    )
  }

  const roster = resolveRoster(game)

  let result: ReturnType<typeof processEventTurn>
  try {
    result = processEventTurn(game, eventId, choiceIndex, roster)
  } catch (err) {
    const message = safeErrorMessage(err, 'Decision could not be processed')
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Drift stress + check for an NPC-initiated scene (resignation/request)
  // before deciding next month's pending event — a suggested personnel
  // scene takes priority over the ordinary crisis-briefing pool.
  const driftedTraits = driftTraits(game)
  const { game: narrativeGame, suggestedEvent } = applyCabinetNarrative(
    game,
    { ...result.game, npcTraits: driftedTraits },
    roster,
  )
  // Ambient tier — a rare, low-key "someone on the team did something
  // routine" line alongside the real news, no choices/consequences
  // attached. Only when nothing more substantial (an initiative-engine
  // scene) is already happening this turn, so it never competes with a
  // real story beat.
  const ambientHeadline = suggestedEvent ? null : pickAmbientHeadline(roster)
  result = {
    ...result,
    game: narrativeGame,
    headlines: ambientHeadline ? [...result.headlines, ambientHeadline] : result.headlines,
  }

  const nextEvent = suggestedEvent ?? (result.game.status === 'ACTIVE' ? pickEvent(result.game) : null)

  const [updateResult] = await prisma.$transaction([
    prisma.game.updateMany({
      where: { id: id, updatedAt: row.updatedAt },
      data:  { ...gameToDbUpdate(result.game), currentEventId: nextEvent?.id ?? null },
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
  let newAchievements: Achievement[] = []
  let specialCovers: CoverContent[] = []
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
    archetype = computePresidentialArchetype(result.game, gameLogs)
    newAchievements = await unlockAchievements(session.user.id, result.game, result.gameOver)
    specialCovers = computeSpecialEditionCovers(result.game, result.gameOver, computeLegacyScore(result.game))
  }

  return NextResponse.json({ ...result, archetype, newAchievements, specialCovers, nextEvent })
}

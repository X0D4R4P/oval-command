import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEligibleEvents } from '@/lib/content-sources'
import { getOwnedContent } from '@/lib/entitlements'
import { resolveRoster } from '@/lib/cabinet'
import { resolvePersonnelChoice } from '@/lib/cabinet-narrative'
import { dbToGame, gameToDbUpdate, toJson, safeErrorMessage } from '@/lib/db-helpers'
import type { ProcessTurnRequest } from '@/types/game'

interface Params { params: Promise<{ id: string }> }

/**
 * Resolves one choice on a personnel-category scene — the fire/keep
 * conversation, a resignation, a role storyline beat, an NPC-initiated
 * request/conflict, or a room scene. Deliberately turn-free: unlike
 * /turn, /law, and /address-nation, this never advances currentMonth
 * and never picks a fresh crisis briefing — the personnel scene IS this
 * month's story beat, not an addition to it.
 */
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
  if (!row) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (row.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (row.status !== 'ACTIVE') return NextResponse.json({ error: 'Game is not active' }, { status: 400 })

  const game = dbToGame(row)
  const ownedContent = await getOwnedContent(session.user.id)

  // Same "never trust client ids" posture as /turn — a crafted request for
  // an event from another era or an unowned content source simply isn't in
  // the eligible pool, same as an eventId that never existed.
  const event = getEligibleEvents(ownedContent, game.campaignEra).find(e => e.id === eventId)
  if (!event || event.category !== 'personnel') {
    return NextResponse.json({ error: 'Unknown personnel scene' }, { status: 400 })
  }

  // "Discuss" scenes are opened ad hoc by the player from the Cabinet
  // Room and don't need to be the game's currentEventId. Every other
  // tier (resignation, request, conflict, neglect, storyline, room) was
  // specifically queued by the NPC Initiative Engine as this month's
  // pending event, so resolving one that ISN'T actually pending would
  // let a client replay/forge a scene it was never shown.
  if (event.personnelMeta?.tier !== 'discuss' && row.currentEventId !== eventId) {
    return NextResponse.json(
      { error: 'This scene is not currently pending for this game' },
      { status: 409 }
    )
  }

  const roster = resolveRoster(game)

  let result: ReturnType<typeof resolvePersonnelChoice>
  try {
    result = resolvePersonnelChoice(game, event, choiceIndex, roster)
  } catch (err) {
    const message = safeErrorMessage(err, 'This scene could not be resolved')
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Resolving the pending scene clears it — the player's next room visit
  // re-picks an ordinary crisis briefing (see app/game/[id]/page.tsx's
  // currentEventId fallback). A "Discuss" scene that wasn't the pending
  // event leaves currentEventId untouched.
  const nextCurrentEventId = event.id === row.currentEventId ? null : row.currentEventId

  const [updateResult] = await prisma.$transaction([
    prisma.game.updateMany({
      where: { id, updatedAt: row.updatedAt },
      data:  { ...gameToDbUpdate(result.game), currentEventId: nextCurrentEventId },
    }),
    prisma.gameLog.create({
      data: {
        gameId:      id,
        month:       game.currentMonth,
        actionType:  'PERSONNEL',
        eventId:     event.id,
        choiceIndex,
        statDeltas:  toJson(event.choices[choiceIndex].effects),
        narrative:   event.choices[choiceIndex].outcome,
      },
    }),
  ])

  if (updateResult.count === 0) {
    return NextResponse.json(
      { error: 'This scene was already resolved by another request. Reload to see the current state.' },
      { status: 409 }
    )
  }

  return NextResponse.json({
    game: result.game,
    npcReactions: result.npcReactions,
    choice: event.choices[choiceIndex],
  })
}

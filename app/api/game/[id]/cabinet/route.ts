import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveRoster, getCandidatesForSlot } from '@/lib/cabinet'
import { applyCabinetChange } from '@/lib/cabinet-narrative'
import { dbToGame, gameToDbUpdate, toJson, safeErrorMessage } from '@/lib/db-helpers'
import { SELECTABLE_SLOT_IDS, type SelectableSlotId } from '@/types/game'

interface Params { params: Promise<{ id: string }> }

interface CabinetChangeBody {
  slotId:      string
  candidateId: string
  /** True when this swap completes an accepted resignation rather than a player-initiated firing — the only case the Vice President is allowed through this route. */
  resigned?:   boolean
}

/**
 * Mid-term Cabinet change — the actual roster swap, applied atomically
 * with its severity-scaled consequence (stat penalty, ripple relationship
 * hit, headline). Turn-free, same as /personnel. Always follows a
 * resolved "Discuss"/resignation scene (see POST /api/game/[id]/personnel)
 * whose "Fire"/"Accept resignation" choice set opensReplacementPicker —
 * this route doesn't re-derive that narrative, it just completes it.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CabinetChangeBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slotId, candidateId, resigned = false } = body
  if (!SELECTABLE_SLOT_IDS.includes(slotId as SelectableSlotId)) {
    return NextResponse.json({ error: 'Unknown Cabinet slot' }, { status: 400 })
  }
  if (!candidateId || typeof candidateId !== 'string') {
    return NextResponse.json({ error: 'candidateId is required' }, { status: 400 })
  }
  if (!getCandidatesForSlot(slotId as SelectableSlotId).some(c => c.candidateId === candidateId)) {
    return NextResponse.json({ error: 'Unknown candidate for this slot' }, { status: 400 })
  }

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (row.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (row.status !== 'ACTIVE') return NextResponse.json({ error: 'Game is not active' }, { status: 400 })

  const game = dbToGame(row)
  const roster = resolveRoster(game)
  const currentCandidateId = game.cabinetSelections[slotId as SelectableSlotId]
  if (currentCandidateId === candidateId) {
    return NextResponse.json({ error: 'That candidate is already in this role' }, { status: 400 })
  }

  let result: ReturnType<typeof applyCabinetChange>
  try {
    result = applyCabinetChange(game, roster, slotId as SelectableSlotId, candidateId, resigned)
  } catch (err) {
    const message = safeErrorMessage(err, 'This Cabinet change could not be made')
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const [updateResult] = await prisma.$transaction([
    prisma.game.updateMany({
      where: { id, updatedAt: row.updatedAt },
      data:  gameToDbUpdate(result.game),
    }),
    prisma.gameLog.create({
      data: {
        gameId:     id,
        month:      game.currentMonth,
        actionType: 'PERSONNEL',
        statDeltas: toJson(result.effects),
        narrative:  result.headline.text,
      },
    }),
  ])

  if (updateResult.count === 0) {
    return NextResponse.json(
      { error: 'This change was already made by another request. Reload to see the current state.' },
      { status: 409 }
    )
  }

  return NextResponse.json({
    game: result.game,
    headline: result.headline,
    rippleReactions: result.rippleReactions,
  })
}

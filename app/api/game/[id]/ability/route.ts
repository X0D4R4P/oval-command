import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveRoster } from '@/lib/cabinet'
import { activateAbility, isActivatableSlot } from '@/lib/cabinet-abilities'
import { dbToGame, gameToDbUpdate, toJson, safeErrorMessage } from '@/lib/db-helpers'

interface Params { params: Promise<{ id: string }> }

interface ActivateAbilityBody {
  slotId: string
}

/**
 * Player-activated Cabinet abilities — Take the Hit (VP) and Economic
 * Briefing (Treasury). Turn-free, same precedent as the personnel/cabinet
 * routes: calling in a favor from your VP or Treasury Secretary doesn't
 * cost the month.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ActivateAbilityBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slotId } = body
  if (!slotId || !isActivatableSlot(slotId)) {
    return NextResponse.json({ error: 'This role has no activatable ability' }, { status: 400 })
  }

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (row.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (row.status !== 'ACTIVE') return NextResponse.json({ error: 'Game is not active' }, { status: 400 })

  const game = dbToGame(row)
  const roster = resolveRoster(game)

  let result: ReturnType<typeof activateAbility>
  try {
    result = activateAbility(game, roster, slotId)
  } catch (err) {
    const message = safeErrorMessage(err, 'This ability could not be used')
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
        narrative:  `${result.npcName} used ${result.abilityName}.`,
      },
    }),
  ])

  if (updateResult.count === 0) {
    return NextResponse.json(
      { error: 'This ability was already used by another request. Reload to see the current state.' },
      { status: 409 }
    )
  }

  return NextResponse.json({
    game: result.game,
    effects: result.effects,
    npcName: result.npcName,
    abilityName: result.abilityName,
  })
}

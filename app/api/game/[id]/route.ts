import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pickEvent, EVENTS } from '@/lib/game-engine'
import { dbToGame } from '@/lib/db-helpers'

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const row = await prisma.game.findUnique({
    where:   { id },
    include: {
      logs: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })

  if (!row) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }
  if (row.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const game = dbToGame(row)

  let currentEvent = null
  if (game.status === 'ACTIVE') {
    const currentEventId = (row as any).currentEventId
    if (currentEventId) {
      currentEvent = EVENTS.find(e => e.id === currentEventId) ?? null
    } else {
      currentEvent = pickEvent(game)
      if (currentEvent) {
        await prisma.game.update({
          where: { id },
          data:  { currentEventId: currentEvent.id } as any,
        })
      }
    }
  }

  return NextResponse.json({ game, currentEvent })
}

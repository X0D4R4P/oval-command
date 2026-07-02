import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame } from '@/lib/db-helpers'
import { pickEvent, EVENTS } from '@/lib/game-engine'
import { GameClient } from '@/components/game/GameClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function GamePage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) notFound()
  if (row.userId !== session.user.id) redirect('/dashboard')

  const game = dbToGame(row)

  // Reuse the event already persisted for this turn instead of picking a
  // fresh one on every load — otherwise reloading the page (or navigating
  // back from Cabinet/Congress/History) would swap the briefing out from
  // under the player before they'd even chosen, same fix as the /api route.
  let currentEvent = null
  if (game.status === 'ACTIVE') {
    if (row.currentEventId) {
      currentEvent = EVENTS.find(e => e.id === row.currentEventId) ?? null
    } else {
      currentEvent = pickEvent(game)
      if (currentEvent) {
        await prisma.game.update({
          where: { id },
          data:  { currentEventId: currentEvent.id },
        })
      }
    }
  }

  return <GameClient initialGame={game} initialEvent={currentEvent} />
}

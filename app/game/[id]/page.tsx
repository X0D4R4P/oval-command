import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame, dbToGameLog } from '@/lib/db-helpers'
import { pickEvent, EVENTS } from '@/lib/game-engine'
import { getInactivityWarning } from '@/lib/guest-cleanup'
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

  // Bounded, indexed query — used to derive per-stat trends/sparklines on
  // read (see lib/stat-trends.ts) rather than persisting a second history
  // array per stat.
  const recentLogRows = await prisma.gameLog.findMany({
    where: { gameId: id },
    orderBy: { month: 'desc' },
    take: 8,
  })
  const recentLogs = recentLogRows.map(dbToGameLog)

  // Guest sessions are the only ones subject to expiration — session.user.name
  // is 'Guest' for exactly the accounts lib/guest-cleanup.ts targets, so this
  // reuses a signal already present on the session rather than a new query.
  const isGuest = session.user.name === 'Guest'
  const inactivityWarning = isGuest ? getInactivityWarning(row.updatedAt) : null

  return (
    <GameClient
      initialGame={game}
      initialEvent={currentEvent}
      recentLogs={recentLogs}
      inactivityWarning={inactivityWarning}
    />
  )
}

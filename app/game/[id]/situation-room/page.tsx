import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame } from '@/lib/db-helpers'
import { NPCS, EVENTS } from '@/lib/game-engine'
import { StatCard } from '@/components/game/StatCard'
import { ConflictBanner } from '@/components/game/ConflictBanner'
import { CabinetCard } from '@/components/game/CabinetCard'
import { PendingEventBanner } from '@/components/game/PendingEventBanner'
import { RoomBackground, roomAccentStyle } from '@/components/game/RoomBackground'
import { getRoomTreatment } from '@/lib/event-backgrounds'

const MATCHING_CATEGORIES = ['security', 'military', 'disaster']

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SituationRoomPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) notFound()
  if (row.userId !== session.user.id) redirect('/dashboard')

  const game = dbToGame(row)
  const secDef = NPCS.find(n => n.id === 'sec_defense')
  const pendingEvent = row.currentEventId ? EVENTS.find(e => e.id === row.currentEventId) : undefined
  const showBanner = game.status === 'ACTIVE' && pendingEvent && MATCHING_CATEGORIES.includes(pendingEvent.category)

  const treatment = getRoomTreatment('/situation-room-bg.png')

  return (
    <main className="mx-auto max-w-2xl px-6 py-10" style={roomAccentStyle('var(--color-cat-military)')}>
      <RoomBackground
        image="/situation-room-bg.png"
        color="var(--color-cat-military)"
        backgroundPosition={treatment.backgroundPosition}
        foreground={{ style: treatment.foregroundStyle, color: treatment.foregroundColor }}
      />
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-cat-military)]">
          National Security
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
          Situation Room
        </h1>
      </div>

      <p className="mt-3 text-sm text-[var(--color-paper-dim)]">
        Active conflicts, military readiness, and the people who brief you on them.
      </p>

      {showBanner && pendingEvent && (
        <div className="mt-6">
          <PendingEventBanner event={pendingEvent} gameId={game.id} />
        </div>
      )}

      {game.activeConflicts.length > 0 && (
        <div className="mt-6">
          <ConflictBanner conflicts={game.activeConflicts} currentMonth={game.currentMonth} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <StatCard statKey="security" value={game.stats.security} />
        <StatCard statKey="militaryReadiness" value={game.stats.militaryReadiness} />
      </div>

      {secDef && (
        <div className="mt-7">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
            Defense Briefing
          </h2>
          <div className="mt-3">
            <CabinetCard
              npc={secDef}
              relationship={game.npcRelationships[secDef.id] ?? secDef.relationship.start}
            />
          </div>
        </div>
      )}
    </main>
  )
}

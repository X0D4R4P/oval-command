import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame } from '@/lib/db-helpers'
import { NPCS, EVENTS } from '@/lib/game-engine'
import { StatCard } from '@/components/game/StatCard'
import { CabinetCard } from '@/components/game/CabinetCard'
import { PendingEventBanner } from '@/components/game/PendingEventBanner'

const MATCHING_CATEGORIES = ['diplomacy']

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DiplomaticOfficePage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) notFound()
  if (row.userId !== session.user.id) redirect('/dashboard')

  const game = dbToGame(row)
  const worldLeaders = NPCS.filter(n => n.faction === 'international')
  const pendingEvent = row.currentEventId ? EVENTS.find(e => e.id === row.currentEventId) : undefined
  const showBanner = game.status === 'ACTIVE' && pendingEvent && MATCHING_CATEGORIES.includes(pendingEvent.category)

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-cat-diplomacy)]">
          Foreign Relations
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
          Diplomatic Office
        </h1>
      </div>

      <p className="mt-3 text-sm text-[var(--color-paper-dim)]">
        Where the rest of the world forms its opinion of you.
      </p>

      {showBanner && pendingEvent && (
        <div className="mt-6">
          <PendingEventBanner event={pendingEvent} gameId={game.id} />
        </div>
      )}

      <div className="mt-6">
        <StatCard statKey="globalReputation" value={game.stats.globalReputation} />
      </div>

      <div className="mt-7">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
          World Leaders
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {worldLeaders.map(npc => (
            <CabinetCard
              key={npc.id}
              npc={npc}
              relationship={game.npcRelationships[npc.id] ?? npc.relationship.start}
            />
          ))}
        </div>
      </div>
    </main>
  )
}

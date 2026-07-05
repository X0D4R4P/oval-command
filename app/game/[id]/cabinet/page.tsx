import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame } from '@/lib/db-helpers'
import { NPCS, EVENTS } from '@/lib/game-engine'
import { CabinetCard } from '@/components/game/CabinetCard'
import { AdvisorConversationPanel } from '@/components/game/AdvisorConversationPanel'
import { PendingEventBanner } from '@/components/game/PendingEventBanner'
import { RoomBackground, roomAccentStyle } from '@/components/game/RoomBackground'
import { getAdvisorRecommendations } from '@/lib/advisor-engine'
import { getRoomTreatment } from '@/lib/event-backgrounds'
import type { MilestoneTier } from '@/lib/npc-milestones'

const MATCHING_CATEGORIES = ['economy']

interface PageProps {
  params: Promise<{ id: string }>
}

const FACTION_ORDER = [
  'inner_circle', 'cabinet', 'congress', 'opposition', 'media', 'international', 'civil_society',
] as const

const FACTION_SECTION_LABEL: Record<(typeof FACTION_ORDER)[number], string> = {
  inner_circle: 'The Inner Circle',
  cabinet: 'Cabinet',
  congress: 'Congress',
  opposition: 'Opposition',
  media: 'Press Corps',
  international: 'World Leaders',
  civil_society: 'Civil Society',
}

export default async function CabinetPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) notFound()
  if (row.userId !== session.user.id) redirect('/dashboard')

  const game = dbToGame(row)
  const recommendations = getAdvisorRecommendations(game)
  const pendingEvent = row.currentEventId ? EVENTS.find(e => e.id === row.currentEventId) : undefined
  const showBanner = game.status === 'ACTIVE' && pendingEvent && MATCHING_CATEGORIES.includes(pendingEvent.category)

  const treatment = getRoomTreatment('/cabinet-room-bg.webp')

  return (
    <main className="mx-auto max-w-3xl px-6 py-10" style={roomAccentStyle('var(--color-brass)')}>
      <RoomBackground
        image="/cabinet-room-bg.webp"
        color="var(--color-brass)"
        backgroundPosition={treatment.backgroundPosition}
        foreground={{ style: treatment.foregroundStyle, color: treatment.foregroundColor }}
      />
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
          Administration
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
          The People Around You
        </h1>
      </div>

      <p className="mt-3 text-sm text-[var(--color-paper-dim)]">
        Every relationship here has been shaped by what you&rsquo;ve done, not what you&rsquo;ve said.
      </p>

      {showBanner && pendingEvent && (
        <div className="mt-6">
          <PendingEventBanner event={pendingEvent} gameId={game.id} />
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-7">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
            Cabinet Briefing
          </h2>
          <div className="mt-3">
            <AdvisorConversationPanel recommendations={recommendations} gameId={game.id} />
          </div>
        </div>
      )}

      {FACTION_ORDER.map(faction => {
        const npcsInFaction = NPCS.filter(n => n.faction === faction)
        if (npcsInFaction.length === 0) return null

        return (
          <section key={faction} className="mt-7">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
              {FACTION_SECTION_LABEL[faction]}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {npcsInFaction.map(npc => {
                const milestoneTier: MilestoneTier | undefined = game.flags[`milestone_${npc.id}_ally`]
                  ? 'ally'
                  : game.flags[`milestone_${npc.id}_estranged`]
                  ? 'estranged'
                  : undefined
                return (
                  <CabinetCard
                    key={npc.id}
                    npc={npc}
                    relationship={game.npcRelationships[npc.id] ?? npc.relationship.start}
                    milestoneTier={milestoneTier}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </main>
  )
}

import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EVENTS, LAWS } from '@/lib/game-engine'
import { cn, formatDelta, isDeltaGood, getStatLabel, monthToDate } from '@/lib/utils'
import { PendingEventBanner } from '@/components/game/PendingEventBanner'
import { RoomBackground, roomAccentStyle } from '@/components/game/RoomBackground'
import { SocialFeed } from '@/components/game/SocialFeed'
import { PressConferencePanel } from '@/components/game/PressConferencePanel'
import { generateSocialFeed } from '@/lib/social-feed'
import type { GameStats } from '@/types/game'
import { getRoomTreatment } from '@/lib/event-backgrounds'

const MATCHING_CATEGORIES = ['scandal', 'social']

interface PageProps {
  params: Promise<{ id: string }>
}

const ACTION_LABEL: Record<string, string> = {
  CRISIS: 'Decision',
  LAW_PROPOSED: 'Bill Proposed',
  LAW_PASSED: 'Bill Passed',
  LAW_FAILED: 'Bill Failed',
  BUDGET: 'Budget',
  EXECUTIVE_ORDER: 'Executive Order',
  PRESS_CONFERENCE: 'Press Conference',
  DIPLOMATIC_VISIT: 'Diplomatic Visit',
  TURN_END: 'Turn End',
}

export default async function HistoryPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const game = await prisma.game.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      presidentName: true,
      status: true,
      currentEventId: true,
      currentMonth: true,
      stats: true,
      logs: { orderBy: { month: 'asc' } },
    },
  })

  if (!game) notFound()
  if (game.userId !== session.user.id) redirect('/dashboard')

  const pendingEvent = game.currentEventId ? EVENTS.find(e => e.id === game.currentEventId) : undefined
  const showBanner = game.status === 'ACTIVE' && pendingEvent && MATCHING_CATEGORIES.includes(pendingEvent.category)
  const pendingBriefingTitle = game.status === 'ACTIVE' ? pendingEvent?.title ?? null : null

  const posts = generateSocialFeed(game.id, game.currentMonth, game.stats as unknown as GameStats)

  const treatment = getRoomTreatment('/press-room-bg.webp')

  return (
    <main className="mx-auto max-w-3xl px-6 py-10" style={roomAccentStyle('var(--color-cat-scandal)')}>
      <RoomBackground
        image="/press-room-bg.webp"
        color="var(--color-cat-scandal)"
        backgroundPosition={treatment.backgroundPosition}
        foreground={{ style: treatment.foregroundStyle, color: treatment.foregroundColor }}
      />
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-cat-scandal)]">
          Press Room
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
          Presidential History
        </h1>
      </div>

      {showBanner && pendingEvent && (
        <div className="mt-6">
          <PendingEventBanner event={pendingEvent} gameId={game.id} />
        </div>
      )}

      <div className="mt-6">
        <SocialFeed posts={posts} />
      </div>

      {game.status === 'ACTIVE' && (
        <div className="mt-4">
          <PressConferencePanel gameId={game.id} pendingBriefingTitle={pendingBriefingTitle} />
        </div>
      )}

      <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
        The Record
      </div>

      {game.logs.length === 0 && (
        <div className="mt-3 rounded-sm border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center">
          <p className="text-sm text-[var(--color-paper-dim)]">
            No decisions recorded yet. History starts with your first choice.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-0 border-l border-[var(--color-border)] pl-5">
        {game.logs.map((log: (typeof game.logs)[number]) => {
          const event = log.eventId ? EVENTS.find(e => e.id === log.eventId) : undefined
          const law = log.lawId ? LAWS.find(l => l.id === log.lawId) : undefined
          const title = event?.title ?? law?.title ?? ACTION_LABEL[log.actionType] ?? log.actionType
          const deltas = Object.entries(log.statDeltas as Partial<Record<keyof GameStats, number>>).filter(([, v]) => v !== 0) as [keyof GameStats, number][]

          return (
            <div key={log.id} className="relative pb-6 last:pb-0">
              <div className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-brass-dim)]" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-paper-faint)]">
                  {monthToDate(log.month)}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.05em]',
                    log.actionType === 'LAW_PASSED' && 'bg-[var(--color-good-dim)] text-[var(--color-good)]',
                    log.actionType === 'LAW_FAILED' && 'bg-[var(--color-bad-dim)] text-[var(--color-bad)]',
                    log.actionType === 'CRISIS' && 'bg-[var(--color-surface-2)] text-[var(--color-paper-faint)]'
                  )}
                >
                  {ACTION_LABEL[log.actionType] ?? log.actionType}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-[var(--color-paper)]">{title}</p>
              {log.narrative && (
                <p className="mt-1 text-[13px] leading-snug text-[var(--color-paper-dim)]">{log.narrative}</p>
              )}
              {deltas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {deltas.map(([key, value]) => (
                    <span
                      key={key}
                      className={cn(
                        'font-mono text-[11px]',
                        isDeltaGood(key, value) ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]'
                      )}
                    >
                      {getStatLabel(key)} {formatDelta(key, value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}

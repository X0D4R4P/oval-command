import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame } from '@/lib/db-helpers'
import { EVENTS } from '@/lib/game-engine'
import { getLegislativeOpportunity } from '@/lib/law-engine'
import { hashSeed } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ScheduleItem {
  label: string
  detail: string
  days: number
  href: string
}

export default async function SchedulePage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) notFound()
  if (row.userId !== session.user.id) redirect('/dashboard')

  const game = dbToGame(row)
  const pendingEvent = row.currentEventId ? EVENTS.find(e => e.id === row.currentEventId) : undefined
  const opportunity = getLegislativeOpportunity(game)

  const items: ScheduleItem[] = []

  if (game.status === 'ACTIVE' && pendingEvent) {
    items.push({ label: pendingEvent.title, detail: 'Crisis briefing', days: 0, href: `/game/${game.id}` })
  }

  if (opportunity) {
    // Decorative only — the engine tracks months, not days. Stable per
    // (game, month) via hashSeed so it doesn't reshuffle on every reload,
    // same discipline IntelligenceBriefing's confidence % already follows.
    const decorativeDays = 3 + (hashSeed(game.id, 'legislative', String(game.currentMonth)) % 13)
    items.push({
      label: opportunity.suggested ? opportunity.suggested.shortTitle : 'Legislative window',
      detail: 'Congressional opportunity',
      days: decorativeDays,
      href: `/game/${game.id}/congress`,
    })
  }

  if (game.currentMonth >= 40 && game.status === 'ACTIVE') {
    const monthsRemaining = Math.max(0, 48 - game.currentMonth)
    items.push({
      label: 'Election Day',
      detail: 'General election',
      days: monthsRemaining * 30,
      href: `/game/${game.id}`,
    })
  }

  items.sort((a, b) => a.days - b.days)

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/game/${game.id}`}
        className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]"
      >
        ← Oval Office
      </Link>
      <div className="mt-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
          Full Schedule
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
          What&apos;s Ahead
        </h1>
        {/* Day counts here are flavor, not a real per-day schedule — the
            engine only advances in whole months. Relative ordering is
            accurate; the exact figure isn't a live countdown. */}
        <p className="mt-1 text-xs text-[var(--color-paper-faint)]">
          Approximate — the administration operates on a monthly cycle.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-sm border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-center text-sm text-[var(--color-paper-dim)]">
          Nothing pressing on the calendar right now.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map(item => (
            <Link
              key={item.label}
              href={item.href}
              className="block rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 backdrop-blur-sm transition-colors hover:border-[var(--color-brass-dim)]"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-brass)]">
                {item.days === 0 ? 'Today' : `In ${item.days} Days`}
              </div>
              <p className="mt-1 text-sm font-medium text-[var(--color-paper)]">{item.label}</p>
              <p className="mt-0.5 text-xs text-[var(--color-paper-faint)]">{item.detail}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

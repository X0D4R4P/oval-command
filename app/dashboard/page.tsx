import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { monthToDate } from '@/lib/utils'
import { SiteNav } from '@/components/SiteNav'
import { PartyIcon } from '@/components/game/PartyIcon'
import type { Party } from '@/types/game'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const games = await prisma.game.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      presidentName: true,
      party: true,
      difficulty: true,
      currentMonth: true,
      status: true,
      legacyScore: true,
      updatedAt: true,
    },
  })

  type GameSummary = (typeof games)[number]

  return (
    <>
      <SiteNav userName={session.user.name} userImage={session.user.image} />
      <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
            Oval Command
          </div>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
            Your Administrations
          </h1>
        </div>
        <Link
          href="/new-game"
          className="rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90"
        >
          New Term
        </Link>
      </div>

      <div className="mt-8 space-y-3">
        {games.length === 0 && (
          <div className="rounded-sm border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--color-paper-dim)]">
              No administrations yet. Your first term is one decision away.
            </p>
            <Link
              href="/new-game"
              className="mt-4 inline-block rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90"
            >
              Take the Oath of Office
            </Link>
          </div>
        )}

        {games.map((game: GameSummary) => (
          <Link
            key={game.id}
            href={`/game/${game.id}`}
            className="block rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-colors hover:border-[var(--color-border-strong)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[var(--color-paper)]">
                  President {game.presidentName}
                </span>
                <PartyIcon party={game.party as Party} size={16} showLabel className="ml-2" />
              </div>
              <StatusPill status={game.status} legacyScore={game.legacyScore} />
            </div>
            <p className="mt-1 text-xs text-[var(--color-paper-faint)]">
              {game.status === 'ACTIVE'
                ? `${monthToDate(game.currentMonth)} · Month ${game.currentMonth} of 48`
                : `Term ended at month ${game.currentMonth}`}
              {game.difficulty && game.difficulty !== 'normal' && (
                <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-warn)]">
                  · {game.difficulty}
                </span>
              )}
            </p>
          </Link>
        ))}
      </div>
    </main>
    </>
  )
}

function StatusPill({ status, legacyScore }: { status: string; legacyScore: number | null }) {
  if (status === 'ACTIVE') {
    return (
      <span className="rounded-full bg-[var(--color-good-dim)] px-2.5 py-0.5 font-mono text-[10px] text-[var(--color-good)]">
        In Progress
      </span>
    )
  }
  return (
    <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 font-mono text-[10px] text-[var(--color-paper-dim)]">
      {status === 'COMPLETE' ? `Legacy: ${legacyScore ?? '—'}` : 'Ended'}
    </span>
  )
}

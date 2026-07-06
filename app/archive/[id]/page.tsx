import { redirect, notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame, dbToGameLog, getGameRow } from '@/lib/db-helpers'
import { computeLegacyScore } from '@/lib/game-engine'
import { computePresidentialArchetype } from '@/lib/archetype-engine'
import { computeSectorBreakdown } from '@/lib/law-sectors'
import { Seal } from '@/components/Seal'
import { SiteNav } from '@/components/SiteNav'
import { monthToDate } from '@/lib/utils'
import type { GameLog } from '@/types/game'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ArchivePage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const row = await getGameRow(id)
  if (!row) notFound()
  if (row.userId !== session.user.id) redirect('/dashboard')

  const game = dbToGame(row)
  const logRows = await prisma.gameLog.findMany({ where: { gameId: id }, orderBy: { month: 'asc' } })
  const logs: GameLog[] = logRows.map(dbToGameLog)

  const legacy = computeLegacyScore(game)
  const archetype = computePresidentialArchetype(game, logs)
  const sectorBreakdown = computeSectorBreakdown(game.passedLaws)

  const startYear = Number(monthToDate(1).split(' ')[1])
  const endYear = Number(monthToDate(game.currentMonth).split(' ')[1])
  const yearRange = game.status === 'ACTIVE' ? `${startYear}–Present` : `${startYear}–${endYear}`

  return (
    <>
      <SiteNav userName={session.user.name} userImage={session.user.image} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href={game.status === 'ACTIVE' ? `/game/${game.id}` : '/presidencies'}
          className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)] hover:text-[var(--color-brass)]"
        >
          {game.status === 'ACTIVE' ? '← Back to the Oval Office' : '← Back to National Archives'}
        </Link>

        <div className="mt-6 rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-8 text-center backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
            National Archives · Executive Records
          </div>
          <Seal size={40} className="mx-auto mt-4 text-[var(--color-brass)]" />
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-paper)]">
            {archetype.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-paper-dim)]">
            President {game.presidentName} · {yearRange}
          </p>
          <p className="mx-auto mt-4 max-w-md text-[13px] italic leading-relaxed text-[var(--color-paper-faint)]">
            This archive preserves the official record of the {game.presidentName} Administration ({yearRange}).
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <ArchiveShelf title="Artifacts">
            <ShelfPlaceholder label="Magazine Covers" />
            <ShelfPlaceholder label="Secret Files" />
          </ArchiveShelf>

          <ArchiveShelf title="Government">
            <ShelfLink href={`/game/${game.id}/history`} label="Presidential Journal" />
            <ShelfPlaceholder label="Annual Reports" />
            <ShelfSectorBreakdown breakdown={sectorBreakdown} />
          </ArchiveShelf>

          <ArchiveShelf title="Administration">
            <ShelfLink href={`/game/${game.id}/cabinet`} label="Cabinet" />
            <ShelfLink href={`/game/${game.id}/diplomatic-office`} label="Foreign Affairs" />
            <ShelfLink href="/achievements" label="Achievements" />
          </ArchiveShelf>
        </div>

        <div className="mt-8 space-y-4">
          <ShelfPlaceholder label="Collection Completion" fullWidth />
          <ShelfPlaceholder label="Presidential Statistics" fullWidth />
          <ShelfPlaceholder label="Presidential Quote" fullWidth />
        </div>

        <p className="mt-2 text-right font-mono text-[10px] text-[var(--color-paper-faint)]">
          Legacy Score {legacy.total}
        </p>
      </main>
    </>
  )
}

function ArchiveShelf({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-paper-faint)]">
        {title}
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  )
}

function ShelfLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-paper-dim)] backdrop-blur-sm transition-colors hover:border-[var(--color-brass-dim)] hover:text-[var(--color-paper)]"
    >
      {label}
    </Link>
  )
}

function ShelfPlaceholder({ label, fullWidth }: { label: string; fullWidth?: boolean }) {
  return (
    <div
      className={
        'rounded-sm border border-dashed border-[var(--color-border-strong)] px-3 py-2.5 text-sm text-[var(--color-paper-faint)]' +
        (fullWidth ? ' text-center' : '')
      }
    >
      {label} <span className="text-[11px]">(coming soon)</span>
    </div>
  )
}

function ShelfSectorBreakdown({ breakdown }: { breakdown: ReturnType<typeof computeSectorBreakdown> }) {
  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 backdrop-blur-sm">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-paper-faint)]">
        Laws Passed
      </div>
      <div className="mt-2 space-y-1.5">
        {breakdown.map(({ sector, meta, passed, total }) => (
          <div key={sector} className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-paper-dim)]">{meta.label}</span>
            <span className="font-mono tabular-nums text-[var(--color-paper-faint)]">{passed}/{total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

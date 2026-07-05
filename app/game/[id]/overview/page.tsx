import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame, dbToGameLog } from '@/lib/db-helpers'
import { computeStatTrend } from '@/lib/stat-trends'
import { GovernmentOverviewView } from '@/components/game/GovernmentOverviewView'
import type { GameStats } from '@/types/game'

interface PageProps {
  params: Promise<{ id: string }>
}

const ALL_STAT_KEYS: (keyof GameStats)[] = [
  'approval', 'economy', 'security', 'congressSupport',
  'debt', 'unrest', 'globalReputation', 'unemployment',
  'baseSupport', 'partyUnity', 'militaryReadiness', 'inflation', 'mediaScore',
]

export default async function GovernmentOverviewPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) notFound()
  if (row.userId !== session.user.id) redirect('/dashboard')

  const game = dbToGame(row)

  const recentLogRows = await prisma.gameLog.findMany({
    where: { gameId: id },
    orderBy: { month: 'desc' },
    take: 8,
  })
  const recentLogs = recentLogRows.map(dbToGameLog)

  const trends = Object.fromEntries(
    ALL_STAT_KEYS.map(key => [key, computeStatTrend(game.stats[key], recentLogs, key)])
  ) as Record<keyof GameStats, ReturnType<typeof computeStatTrend>>

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
          Government Overview
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
          President {game.presidentName}
        </h1>
      </div>

      <div className="mt-6">
        <GovernmentOverviewView stats={game.stats} trends={trends} />
      </div>
    </main>
  )
}

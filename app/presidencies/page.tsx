import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame, dbToGameLog } from '@/lib/db-helpers'
import { checkGameOver, computeLegacyScore } from '@/lib/game-engine'
import { computePresidentialArchetype } from '@/lib/archetype-engine'
import { SiteNav } from '@/components/SiteNav'
import { PresidencyCard } from '@/components/PresidencyCard'
import type { GameLog } from '@/types/game'

export default async function PresidenciesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const rows = await prisma.game.findMany({
    where: { userId: session.user.id, status: { in: ['COMPLETE', 'GAMEOVER'] } },
    orderBy: { createdAt: 'asc' },
    include: { logs: { orderBy: { month: 'asc' } } },
  })

  const presidencies = rows.map(row => {
    const game = dbToGame(row)
    const logs: GameLog[] = row.logs.map(dbToGameLog)
    const legacy = computeLegacyScore(game)
    // Defensive fallback — every row here already has status COMPLETE/GAMEOVER,
    // so checkGameOver(game) should always resolve on the final stats snapshot;
    // same precedent as GameClient's initialGameOverReason.
    const reason = checkGameOver(game) ?? 'TERM_COMPLETE'
    const archetype = computePresidentialArchetype(game, logs)
    return { game, legacy, reason, archetype }
  })

  const ranked = [...presidencies].sort((a, b) => b.legacy.total - a.legacy.total)

  return (
    <>
      <SiteNav userName={session.user.name} userImage={session.user.image} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
            National Archives
          </div>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
            Executive Records
          </h1>
          <p className="mt-2 text-sm text-[var(--color-paper-dim)]">
            Every completed administration, ranked by legacy score.
          </p>
        </div>

        {ranked.length === 0 ? (
          <div className="rounded-sm border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--color-paper-dim)]">
              Finish your first term to see it here.
            </p>
            <Link
              href="/dashboard"
              className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-brass)] hover:underline"
            >
              Back to your administrations
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {ranked.map((p, i) => (
              <PresidencyCard
                key={p.game.id}
                rank={i + 1}
                game={p.game}
                legacy={p.legacy}
                reason={p.reason}
                archetype={p.archetype}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}

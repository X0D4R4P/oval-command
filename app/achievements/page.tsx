import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiteNav } from '@/components/SiteNav'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { cn } from '@/lib/utils'
import type { UnlockedAchievement } from '@/types/game'

export default async function AchievementsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { unlockedAchievements: true },
  })

  const unlocked = (user?.unlockedAchievements as unknown as UnlockedAchievement[]) ?? []
  const unlockedById = new Map(unlocked.map(u => [u.id, u]))

  return (
    <>
      <SiteNav userName={session.user.name} userImage={session.user.image} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
            Oval Command
          </div>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
            Achievements
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-paper-faint)]">
            {unlocked.length} of {ACHIEVEMENTS.length} unlocked. Each achievement grants a starting perk for future terms.
          </p>
        </div>

        <div className="space-y-3">
          {ACHIEVEMENTS.map(a => {
            const earned = unlockedById.get(a.id)
            const isUnlocked = Boolean(earned)
            return (
              <div
                key={a.id}
                className={cn(
                  'rounded-sm border px-5 py-4 backdrop-blur-sm',
                  isUnlocked
                    ? 'border-[var(--color-brass)] bg-[var(--color-surface-2)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] opacity-50'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{a.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-medium', isUnlocked ? 'text-[var(--color-paper)]' : 'text-[var(--color-paper-dim)]')}>
                        {a.title}
                      </span>
                      {isUnlocked ? (
                        <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-brass)]">
                          Unlocked
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)]">
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-paper-faint)]">{a.description}</p>
                    {isUnlocked && earned && (
                      <p className="mt-1 font-mono text-[10px] text-[var(--color-paper-faint)]">
                        Earned {new Date(earned.earnedAt).toLocaleDateString()}
                      </p>
                    )}
                    {a.perk && (
                      <p className="mt-2 text-[11px] text-[var(--color-brass)]">
                        Perk: {a.perk.label} — {a.perk.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </>
  )
}

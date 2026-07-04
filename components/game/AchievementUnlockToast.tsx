import type { Achievement } from '@/types/game'

export function AchievementUnlockToast({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return null

  return (
    <div className="space-y-2">
      {achievements.map(a => (
        <div key={a.id} className="rounded-sm border border-[var(--color-brass)] bg-[var(--color-surface-2)] px-4 py-3 backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-brass)]">
            Achievement Unlocked
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="text-xl">{a.icon}</span>
            <div>
              <div className="text-sm font-medium text-[var(--color-paper)]">{a.title}</div>
              <div className="text-xs text-[var(--color-paper-faint)]">{a.description}</div>
            </div>
          </div>
          {a.perk && (
            <p className="mt-2 text-[11px] text-[var(--color-brass)]">
              Unlocked starting perk: {a.perk.label} — {a.perk.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

import type { ActiveConflict } from '@/types/game'

const LEVEL_LABEL: Record<ActiveConflict['level'], { label: string; color: string }> = {
  1: { label: 'Monitoring',     color: 'var(--color-cat-diplomacy)' },
  2: { label: 'Military Aid',   color: 'var(--color-warn)' },
  3: { label: 'Active Strikes', color: 'var(--color-cat-military)' },
  4: { label: 'Ground War',     color: 'var(--color-bad)' },
}

export function ConflictBanner({ conflicts, currentMonth }: { conflicts: ActiveConflict[]; currentMonth: number }) {
  if (conflicts.length === 0) return null

  return (
    <div className="rounded-sm border border-[var(--color-bad)]/30 bg-[var(--color-bad-dim)]/20 px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-bad)]">
        Active Conflict{conflicts.length > 1 ? 's' : ''}
      </span>
      <div className="mt-2 space-y-2">
        {conflicts.map(c => {
          const info = LEVEL_LABEL[c.level]
          const monthsActive = currentMonth - c.monthStarted
          return (
            <div key={c.region} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: info.color }} />
                <span className="text-sm text-[var(--color-paper)]">{c.region}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[var(--color-paper-faint)]">
                  {monthsActive} {monthsActive === 1 ? 'mo' : 'mos'}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--color-paper)]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: info.color }} />
                  {info.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

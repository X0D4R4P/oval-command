import { cn, formatStat, getStatLabel, getStatBarPercent } from '@/lib/utils'
import type { GameStats } from '@/types/game'

interface StatCardProps {
  statKey: keyof GameStats
  value: number
  previousValue?: number
}

/**
 * Determines bar/text color by stat semantics — debt/unrest/unemployment/inflation
 * are "lower is better", everything else is "higher is better".
 */
function getStatTone(statKey: keyof GameStats, value: number): 'good' | 'warn' | 'bad' {
  if (statKey === 'debt') {
    if (value > 48) return 'bad'
    if (value > 40) return 'warn'
    return 'good'
  }
  if (statKey === 'unrest') {
    if (value > 65) return 'bad'
    if (value > 35) return 'warn'
    return 'good'
  }
  if (statKey === 'unemployment' || statKey === 'inflation') {
    if (value > 7) return 'bad'
    if (value > 4) return 'warn'
    return 'good'
  }
  if (statKey === 'mediaScore') {
    if (value < -1) return 'bad'
    if (value < 0.5) return 'warn'
    return 'good'
  }

  if (value >= 60) return 'good'
  if (value >= 38) return 'warn'
  return 'bad'
}

const TONE_CLASSES = {
  good: { text: 'text-[var(--color-good)]', bar: 'bg-[var(--color-good)]' },
  warn: { text: 'text-[var(--color-warn)]', bar: 'bg-[var(--color-warn)]' },
  bad:  { text: 'text-[var(--color-bad)]',  bar: 'bg-[var(--color-bad)]'  },
} as const

export function StatCard({ statKey, value, previousValue }: StatCardProps) {
  const tone = getStatTone(statKey, value)
  const toneClass = TONE_CLASSES[tone]
  const barPercent = Math.max(2, Math.min(100, getStatBarPercent(statKey, value)))

  const delta = previousValue !== undefined ? value - previousValue : undefined
  const deltaSign = delta !== undefined && delta !== 0 ? (delta > 0 ? '+' : '') : null

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
          {getStatLabel(statKey)}
        </span>
        {deltaSign !== null && (
          <span
            className={cn(
              'font-mono text-[10px]',
              delta! > 0 ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]'
            )}
          >
            {deltaSign}{delta!.toFixed(1)}
          </span>
        )}
      </div>
      <div className={cn('mt-1 font-mono text-xl font-medium tabular-nums', toneClass.text)}>
        {formatStat(statKey, value)}
      </div>
      <div className="mt-2 h-[3px] w-full rounded-full bg-[var(--color-border)]">
        <div
          className={cn('h-full rounded-full transition-all duration-500', toneClass.bar)}
          style={{ width: `${barPercent}%` }}
        />
      </div>
    </div>
  )
}

import { cn, getStatLabel, formatDelta, isDeltaGood } from '@/lib/utils'
import { getStatTone, TONE_CLASSES } from '@/components/game/StatCard'
import type { TopMover } from '@/lib/stat-trends'

interface ApprovalGaugeProps {
  approval: number
  deltaFromLastMonth: number
  topMovers: TopMover[]
}

const SIZE = 208
const STROKE = 13
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** A qualitative read on the month-over-month move, not just the raw number. */
function getApprovalDescriptor(delta: number): string {
  if (delta > 3) return 'Rising'
  if (delta < -3) return 'Falling'
  if (delta > 0.5) return 'Improving'
  if (delta < -0.5) return 'Slipping'
  return 'Stable'
}

/**
 * The Oval Office's focal element — deliberately larger and more central
 * than the original mockup's corner placement, per design review. A drop
 * shadow beneath the ring gives it presence/elevation rather than sitting
 * flush on the same plane as everything else. Shows the approval ring, a
 * qualitative descriptor, the month-over-month delta, and a short "why did
 * this change" list of the stats that moved the most this month.
 */
export function ApprovalGauge({ approval, deltaFromLastMonth, topMovers }: ApprovalGaugeProps) {
  const percent = Math.max(0, Math.min(100, approval))
  const tone = getStatTone('approval', approval)
  const toneClass = TONE_CLASSES[tone]
  const offset = CIRCUMFERENCE * (1 - percent / 100)

  const deltaGood = deltaFromLastMonth > 0
  const hasDelta = deltaFromLastMonth !== 0
  const deltaTone = !hasDelta ? null : deltaGood ? 'good' : 'bad'
  const descriptor = getApprovalDescriptor(deltaFromLastMonth)

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative"
        style={{
          width: SIZE,
          height: SIZE,
          filter: `drop-shadow(0 10px 28px color-mix(in srgb, var(--color-${tone}) 35%, transparent))`,
        }}
      >
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={`var(--color-${tone})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-mono text-5xl font-semibold tabular-nums', toneClass.text)}>
            {Math.round(percent)}%
          </span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper-faint)]">
            Public Approval
          </span>
        </div>
      </div>

      <p className={cn('mt-3 font-[family-name:var(--font-display)] text-base font-semibold', deltaTone ? TONE_CLASSES[deltaTone].text : 'text-[var(--color-paper-dim)]')}>
        {descriptor}
      </p>

      {hasDelta && (
        <p className={cn('mt-0.5 font-mono text-sm', TONE_CLASSES[deltaTone!].text)}>
          {deltaGood ? '↑' : '↓'} {formatDelta('approval', deltaFromLastMonth)} this month
        </p>
      )}

      {topMovers.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {topMovers.map(mover => {
            const good = isDeltaGood(mover.key, mover.delta)
            return (
              <span
                key={mover.key}
                className={cn('font-mono text-[11px]', good ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]')}
              >
                {getStatLabel(mover.key)} {mover.delta > 0 ? '▲' : '▼'}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

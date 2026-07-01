import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { GameStats } from '@/types/game'

interface StatIconRowProps {
  icon: string
  label: string
  value: number | string
  tone?: 'good' | 'warn' | 'bad' | 'neutral'
}

function StatIconRow({ icon, label, value, tone = 'neutral' }: StatIconRowProps) {
  const textColor = {
    good:    'text-[var(--color-good)]',
    warn:    'text-[var(--color-warn)]',
    bad:     'text-[var(--color-bad)]',
    neutral: 'text-[var(--color-paper-dim)]',
  }[tone]

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Image src={icon} alt={label} width={14} height={14} className="h-3.5 w-3.5 object-contain opacity-70" />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-paper-faint)]">
          {label}
        </span>
      </div>
      <span className={cn('font-mono text-[11px] font-medium tabular-nums', textColor)}>
        {value}
      </span>
    </div>
  )
}

function getMediaTone(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 0.5) return 'good'
  if (score >= -0.5) return 'warn'
  return 'bad'
}

export function SecondaryStats({ stats }: { stats: GameStats }) {
  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
        Full Briefing
      </span>
      <div className="mt-2.5 space-y-2">
        <StatIconRow
          icon="/icons/stat_base_support.png"
          label="Base Support"
          value={`${Math.round(stats.baseSupport)}%`}
          tone={stats.baseSupport >= 55 ? 'good' : stats.baseSupport >= 35 ? 'warn' : 'bad'}
        />
        <StatIconRow
          icon="/icons/stat_party_unity.png"
          label="Party Unity"
          value={`${Math.round(stats.partyUnity)}%`}
          tone={stats.partyUnity >= 60 ? 'good' : stats.partyUnity >= 40 ? 'warn' : 'bad'}
        />
        <StatIconRow
          icon="/icons/stat_military_readiness.png"
          label="Mil. Readiness"
          value={`${Math.round(stats.militaryReadiness)}%`}
          tone={stats.militaryReadiness >= 55 ? 'good' : stats.militaryReadiness >= 30 ? 'warn' : 'bad'}
        />
        <StatIconRow
          icon="/icons/stat_inflation.png"
          label="Inflation"
          value={`${stats.inflation.toFixed(1)}%`}
          tone={stats.inflation <= 3 ? 'good' : stats.inflation <= 6 ? 'warn' : 'bad'}
        />
        <StatIconRow
          icon="/icons/stat_media_score.png"
          label="Media"
          value={stats.mediaScore >= 0 ? `+${stats.mediaScore.toFixed(1)}` : stats.mediaScore.toFixed(1)}
          tone={getMediaTone(stats.mediaScore)}
        />
      </div>
    </div>
  )
}

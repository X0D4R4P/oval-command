'use client'

import { cn, formatDelta, isDeltaGood, getStatLabel } from '@/lib/utils'
import { LAW_SECTOR_META } from '@/lib/law-sectors'
import type { Law, GameStats } from '@/types/game'

interface LawCardProps {
  law: Law
  probability: number
  alreadyPassed: boolean
  blocked: boolean
  locked?: boolean
  canUseSenateAbility: boolean
  canUseSpeakerAbility: boolean
  onPropose: (lawId: string, useNpcAbility?: 'senate_leader' | 'speaker') => void
  disabled?: boolean
  pendingProposal?: { lawId: string; useNpcAbility?: 'senate_leader' | 'speaker' } | null
  pendingBriefingTitle?: string | null
}

const COST_LABEL: Record<Law['cost'], { text: string; color: string }> = {
  none:   { text: 'No cost',     color: 'text-[var(--color-good)]' },
  low:    { text: 'Low cost',    color: 'text-[var(--color-good)]' },
  medium: { text: 'Medium cost', color: 'text-[var(--color-warn)]' },
  high:   { text: 'High cost',   color: 'text-[var(--color-bad)]' },
}

function probabilityTone(p: number): string {
  if (p >= 60) return 'text-[var(--color-good)]'
  if (p >= 30) return 'text-[var(--color-warn)]'
  return 'text-[var(--color-bad)]'
}

export function LawCard({
  law,
  probability,
  alreadyPassed,
  blocked,
  locked,
  canUseSenateAbility,
  canUseSpeakerAbility,
  onPropose,
  disabled,
  pendingProposal,
  pendingBriefingTitle,
}: LawCardProps) {
  const onPassEntries = Object.entries(law.effects.onPass).filter(([, v]) => v !== 0) as [keyof GameStats, number][]
  const costInfo = COST_LABEL[law.cost]
  const sectorInfo = LAW_SECTOR_META[law.sector]
  const SectorIcon = sectorInfo.icon

  // Each button (plain propose, Senate whip, Speaker fast-track) arms its
  // own confirmation independently — armed(undefined) is the plain button,
  // matching CongressClient's isConfirmed check exactly so a click on one
  // button can never be silently swallowed by a different button's armed state.
  const armed = (ability?: 'senate_leader' | 'speaker') =>
    pendingProposal?.lawId === law.id && pendingProposal?.useNpcAbility === ability
  const anyArmedForThisLaw = pendingProposal?.lawId === law.id

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <SectorIcon
            aria-label={sectorInfo.label}
            width={18}
            height={18}
            style={{ color: sectorInfo.color }}
            className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 opacity-80"
          />
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-paper)]">
              {law.shortTitle}
            </h3>
            <p className="mt-0.5 text-xs italic text-[var(--color-paper-faint)]">{law.flavor}</p>
          </div>
        </div>
        <span className={cn('whitespace-nowrap font-mono text-[10px] uppercase', costInfo.color)}>
          {costInfo.text}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--color-paper-dim)]">{law.description}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {onPassEntries.map(([key, value]) => (
          <span
            key={key}
            className={cn(
              'rounded-full px-2 py-0.5 font-mono text-[11px]',
              isDeltaGood(key, value)
                ? 'bg-[var(--color-good-dim)] text-[var(--color-good)]'
                : 'bg-[var(--color-bad-dim)] text-[var(--color-bad)]'
            )}
          >
            {getStatLabel(key)} {formatDelta(key, value)}
          </span>
        ))}
      </div>

      {law.passage.lobbyOpposition.length > 0 && (
        <p className="mt-2 text-[11px] text-[var(--color-paper-faint)]">
          Opposed by {law.passage.lobbyOpposition.map(l => l.name).join(', ')}
        </p>
      )}

      {anyArmedForThisLaw && pendingBriefingTitle && (
        <p className="mt-3 text-[11px] text-[var(--color-warn)]">
          Skips &ldquo;{pendingBriefingTitle}&rdquo; without a response. Click again to confirm.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3.5">
        {alreadyPassed ? (
          <span className="font-mono text-xs text-[var(--color-good)]">✓ Already law</span>
        ) : blocked ? (
          <span className="font-mono text-xs text-[var(--color-paper-faint)]">Blocked by an exclusive law already passed</span>
        ) : locked ? (
          <span className="font-mono text-xs text-[var(--color-paper-faint)]">
            🔒 {law.prereqLabel ?? 'Requires an earlier law to pass first'}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-paper-faint)]">
              Pass odds
            </span>
            <span className={cn('font-mono text-sm font-medium tabular-nums', probabilityTone(probability))}>
              {probability}%
            </span>
          </div>
        )}

        {!alreadyPassed && !blocked && !locked && (
          <div className="flex gap-2">
            {canUseSenateAbility && (
              <button
                onClick={() => onPropose(law.id, 'senate_leader')}
                disabled={disabled}
                className={cn(
                  'rounded-sm border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.05em] transition-colors disabled:opacity-40',
                  armed('senate_leader')
                    ? 'border-[var(--color-warn)] text-[var(--color-warn)] hover:bg-[var(--color-surface-2)] hover:backdrop-blur-sm'
                    : 'border-[var(--color-brass-dim)] text-[var(--color-brass)] hover:bg-[var(--color-surface-2)] hover:backdrop-blur-sm'
                )}
                title="Senate Leader guarantees passage (once per term)"
              >
                {armed('senate_leader') ? 'Confirm — Use Vote Whip' : 'Use Vote Whip'}
              </button>
            )}
            {canUseSpeakerAbility && (
              <button
                onClick={() => onPropose(law.id, 'speaker')}
                disabled={disabled}
                className={cn(
                  'rounded-sm border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.05em] transition-colors disabled:opacity-40',
                  armed('speaker')
                    ? 'border-[var(--color-warn)] text-[var(--color-warn)] hover:bg-[var(--color-surface-2)] hover:backdrop-blur-sm'
                    : 'border-[var(--color-brass-dim)] text-[var(--color-brass)] hover:bg-[var(--color-surface-2)] hover:backdrop-blur-sm'
                )}
                title="Speaker fast-tracks passage (once per term)"
              >
                {armed('speaker') ? 'Confirm — Fast Track' : 'Fast Track'}
              </button>
            )}
            <button
              onClick={() => onPropose(law.id)}
              disabled={disabled}
              className={cn(
                'rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                armed(undefined)
                  ? 'border-[var(--color-warn)] bg-[var(--color-surface-2)] text-[var(--color-warn)] backdrop-blur-sm'
                  : 'border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-paper)] backdrop-blur-sm hover:border-[var(--color-brass-dim)]'
              )}
            >
              {armed(undefined) ? 'Confirm — Skip Briefing' : 'Propose'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

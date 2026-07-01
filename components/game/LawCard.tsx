'use client'

import Image from 'next/image'
import { cn, formatDelta, isDeltaGood, getStatLabel } from '@/lib/utils'
import type { Law, LawCategory } from '@/types/game'

const LAW_CATEGORY_ICON: Record<LawCategory, { icon: string; color: string }> = {
  progressive: { icon: '/icons/cat_social.png',   color: 'var(--color-cat-social)' },
  conservative: { icon: '/icons/cat_congress.png', color: 'var(--color-cat-congress)' },
  bipartisan:  { icon: '/icons/cat_diplomacy.png', color: 'var(--color-cat-diplomacy)' },
}

interface LawCardProps {
  law: Law
  probability: number
  alreadyPassed: boolean
  blocked: boolean
  canUseSenateAbility: boolean
  canUseSpeakerAbility: boolean
  onPropose: (lawId: string, useNpcAbility?: 'senate_leader' | 'speaker') => void
  disabled?: boolean
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
  canUseSenateAbility,
  canUseSpeakerAbility,
  onPropose,
  disabled,
}: LawCardProps) {
  const onPassEntries = Object.entries(law.effects.onPass).filter(([, v]) => v !== 0) as [string, number][]
  const costInfo = COST_LABEL[law.cost]
  const catInfo = LAW_CATEGORY_ICON[law.category]

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Image
            src={catInfo.icon}
            alt={law.category}
            width={18}
            height={18}
            className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 object-contain opacity-80"
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
            {getStatLabel(key as never)} {formatDelta(key, value)}
          </span>
        ))}
      </div>

      {law.passage.lobbyOpposition.length > 0 && (
        <p className="mt-2 text-[11px] text-[var(--color-paper-faint)]">
          Opposed by {law.passage.lobbyOpposition.map(l => l.name).join(', ')}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3.5">
        {alreadyPassed ? (
          <span className="font-mono text-xs text-[var(--color-good)]">✓ Already law</span>
        ) : blocked ? (
          <span className="font-mono text-xs text-[var(--color-paper-faint)]">Blocked by an exclusive law already passed</span>
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

        {!alreadyPassed && !blocked && (
          <div className="flex gap-2">
            {canUseSenateAbility && (
              <button
                onClick={() => onPropose(law.id, 'senate_leader')}
                disabled={disabled}
                className="rounded-sm border border-[var(--color-brass-dim)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-brass)] transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                title="Senate Leader guarantees passage (once per term)"
              >
                Use Vote Whip
              </button>
            )}
            {canUseSpeakerAbility && (
              <button
                onClick={() => onPropose(law.id, 'speaker')}
                disabled={disabled}
                className="rounded-sm border border-[var(--color-brass-dim)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-brass)] transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                title="Speaker fast-tracks passage (once per term)"
              >
                Fast Track
              </button>
            )}
            <button
              onClick={() => onPropose(law.id)}
              disabled={disabled}
              className="rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-paper)] transition-colors hover:border-[var(--color-brass-dim)] disabled:opacity-40"
            >
              Propose
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

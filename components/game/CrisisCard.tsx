'use client'

import { useState } from 'react'
import { cn, formatDelta, isDeltaGood, getStatLabel } from '@/lib/utils'
import { isBreakingEvent, getEventCallback } from '@/lib/game-engine'
import { getEventBackground } from '@/lib/event-backgrounds'
import { CategoryTag } from './CategoryTag'
import { IntelligenceBriefing } from './IntelligenceBriefing'
import type { CrisisEvent, StatDelta } from '@/types/game'

interface CrisisCardProps {
  event: CrisisEvent
  month: number
  gameId: string
  flags: Record<string, boolean>
  onChoose: (choiceIndex: number) => void
  disabled?: boolean
}

function EffectPreview({ effects }: { effects: StatDelta }) {
  const entries = Object.entries(effects).filter(([, v]) => v !== 0) as [string, number][]
  if (entries.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {entries.map(([key, value]) => {
        const good = isDeltaGood(key, value)
        return (
          <span
            key={key}
            className={cn(
              'font-mono text-[11px]',
              good ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]'
            )}
          >
            {getStatLabel(key as never)} {formatDelta(key, value)}
          </span>
        )
      })}
    </div>
  )
}

export function CrisisCard({ event, month, gameId, flags, onChoose, disabled }: CrisisCardProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const breaking = isBreakingEvent(event)
  const callback = getEventCallback(event, flags)

  const handleChoose = (index: number) => {
    if (disabled) return
    setSelected(index)
    onChoose(index)
  }

  const backgroundImage = getEventBackground(event.category)

  return (
    <>
      {/* Background image — fills the screen behind the briefing */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Dark overlay to make text readable. Unlike the dashboard entry screen
          (a single centered message, where a viewport-centered radial vignette
          works), this backdrop sits behind an entire scrollable page — the nav
          bar, header, and stat cards can end up anywhere in the viewport as the
          player scrolls, so a spotlight-style radial leaves the edges (where a
          radial's own math keeps opacity low) too bright. A flat, uniform scrim
          guarantees the same contrast everywhere regardless of scroll position. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: 'rgba(6,8,14,0.78)' }}
      />

      <div
        className={cn(
          'rounded-sm border bg-[var(--color-surface)]',
          breaking ? 'border-[var(--color-bad)]' : 'border-[var(--color-border-strong)]'
        )}
      >
      <div className={breaking ? undefined : 'brief-rule'} style={breaking ? { height: 2, background: 'var(--color-bad)' } : undefined} />
      <div className="p-6">
        <div className="flex items-center justify-between">
          <CategoryTag category={event.category} />
          <span
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.1em]',
              breaking ? 'animate-pulse text-[var(--color-bad)]' : 'text-[var(--color-paper-faint)]'
            )}
          >
            {breaking ? '🚨 Breaking News' : `Month ${month} Briefing`}
          </span>
        </div>

        <h2 className="mt-3 font-[family-name:var(--font-display)] text-xl font-semibold leading-snug text-[var(--color-paper)]">
          {event.title}
        </h2>

        {event.isHistorical && event.historicalContext && (
          <div className="mt-3 flex items-start gap-2 rounded-sm border border-[var(--color-brass-dim)]/40 bg-[var(--color-brass)]/[0.06] px-3 py-2">
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-brass)] whitespace-nowrap">
              Based on history
            </span>
            <p className="text-[12px] leading-snug text-[var(--color-paper-dim)]">
              {event.historicalContext}
            </p>
          </div>
        )}

        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-paper-dim)]">
          {event.description}
        </p>

        {callback && (
          <p className="mt-2 text-[13px] italic leading-snug text-[var(--color-paper-faint)]">
            {callback}
          </p>
        )}

        <IntelligenceBriefing gameId={gameId} event={event} />

        <div className="mt-6 space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
            Your Decision
          </div>
          {event.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleChoose(i)}
              disabled={disabled}
              className={cn(
                'group w-full rounded-sm border px-4 py-3.5 text-left transition-colors',
                'border-[var(--color-border)] bg-[var(--color-surface-2)]',
                !disabled && 'hover:border-[var(--color-brass-dim)] hover:bg-[#202B3D]',
                disabled && selected === i && 'border-[var(--color-brass)]',
                disabled && selected !== i && 'opacity-40',
                disabled && 'cursor-default'
              )}
            >
              <div className="flex gap-3">
                <span className="mt-0.5 font-mono text-[13px] font-medium text-[var(--color-brass)]">
                  {String.fromCharCode(65 + i)}
                </span>
                <div className="flex-1">
                  <p className="text-sm leading-snug text-[var(--color-paper)]">{choice.text}</p>
                  <EffectPreview effects={choice.effects} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      </div>
    </>
  )
}

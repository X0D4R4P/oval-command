'use client'

import { useEffect, useState } from 'react'
import { cn, getStatLabel, formatDelta, isDeltaGood } from '@/lib/utils'
import type { TopMover } from '@/lib/stat-trends'

interface DailyBriefProps {
  gameId: string
  month: number
  monthLabel: string
  approvalDelta: number
  topMovers: TopMover[]
  pendingCrisisTitle: string | null
}

/**
 * Brief, skippable full-screen interstitial shown the first time the
 * player lands on the Oval Office for a new month — purely cosmetic
 * pacing, gated client-side by localStorage so it plays once per month
 * transition, not on every visit/navigation back to the room within the
 * same month. No server/schema involvement.
 */
export function DailyBrief({ gameId, month, monthLabel, approvalDelta, topMovers, pendingCrisisTitle }: DailyBriefProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const key = `lastSeenMonth:${gameId}`
    const lastSeen = Number(localStorage.getItem(key) ?? '0')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (lastSeen >= month || reducedMotion) {
      localStorage.setItem(key, String(month))
      return
    }

    localStorage.setItem(key, String(month))

    // Deferred rather than a direct synchronous setState in the effect
    // body — avoids cascading renders during the commit phase.
    const showTimer = setTimeout(() => setVisible(true), 0)
    const hideTimer = setTimeout(() => setVisible(false), 2200)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [gameId, month])

  if (!visible) return null

  const approvalGood = approvalDelta > 0

  return (
    <div
      onClick={() => setVisible(false)}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-[var(--color-ink)]/95 backdrop-blur-sm"
    >
      <div className="animate-typewriter font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-brass)]">
        Presidential Daily Brief
      </div>
      <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
        {monthLabel}
      </div>
      <div className="mt-1 font-mono text-xs text-[var(--color-paper-faint)]">Month {month}</div>

      <div className="mt-6 space-y-2 text-center">
        {approvalDelta !== 0 && (
          <p className={cn('font-mono text-sm', approvalGood ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]')}>
            Approval {approvalGood ? '↑' : '↓'} {formatDelta('approval', approvalDelta)}
          </p>
        )}
        {topMovers.slice(0, 2).map(mover => {
          const good = isDeltaGood(mover.key, mover.delta)
          return (
            <p key={mover.key} className={cn('font-mono text-sm', good ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]')}>
              {getStatLabel(mover.key)} {good ? '↑' : '↓'}
            </p>
          )
        })}
        {pendingCrisisTitle && (
          <p className="font-mono text-sm text-[var(--color-warn)]">{pendingCrisisTitle}</p>
        )}
      </div>

      <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">
        Tap to continue
      </p>
    </div>
  )
}

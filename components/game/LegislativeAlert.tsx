'use client'

import { useRouter } from 'next/navigation'
import type { Game } from '@/types/game'
import { LAWS } from '@/lib/game-engine'

interface LegislativeAlertProps {
  game: Game
}

export function LegislativeAlert({ game }: LegislativeAlertProps) {
  const router = useRouter()

  // Only show when congress is favorable and there are laws available
  const congressFavorable = game.stats.congressSupport > 55
  const availableLaws = LAWS.filter(l => !game.passedLaws.includes(l.id))
  const noLawsThisTerm = game.passedLaws.length === 0
  const congressHighlyFavorable = game.stats.congressSupport > 65

  // Show if: congress is favorable AND either no laws passed yet (after month 5)
  // OR congress is highly favorable (a strong window worth flagging)
  const shouldShow = availableLaws.length > 0 && (
    (congressFavorable && noLawsThisTerm && game.currentMonth > 5) ||
    (congressHighlyFavorable && game.currentMonth > 8)
  )

  if (!shouldShow) return null

  // Find the best law to suggest — easiest to pass given current congress support
  const suggested = availableLaws
    .filter(l => {
      const base = 50 + (game.stats.congressSupport - 50) * 0.8
      return base > 45 && l.cost !== 'high' // exclude highest-cost laws as suggestions
    })
    .sort((a, b) => {
      const costOrder: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 }
      return costOrder[a.cost] - costOrder[b.cost]
    })[0]

  const message = congressHighlyFavorable && !noLawsThisTerm
    ? `Congress support is at ${Math.round(game.stats.congressSupport)}% — an unusually strong window.`
    : `Congress is favorable at ${Math.round(game.stats.congressSupport)}% and you haven't passed any legislation yet.`

  return (
    <div className="rounded-sm border border-[var(--color-brass)]/30 bg-[var(--color-brass)]/5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-brass)]">
            Legislative Opportunity
          </div>
          <p className="mt-1 text-sm text-[var(--color-paper-dim)]">
            {message} {suggested ? `Consider pushing the ${suggested.shortTitle}.` : 'Now is the time to move legislation.'}
          </p>
        </div>
        <button
          onClick={() => router.push(
            `/game/${game.id}/congress${suggested ? `?highlight=${suggested.id}` : ''}`
          )}
          className="flex-shrink-0 rounded-sm border border-[var(--color-brass)]/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-brass)] hover:bg-[var(--color-brass)]/10 transition-colors"
        >
          Draft Legislation
        </button>
      </div>
    </div>
  )
}

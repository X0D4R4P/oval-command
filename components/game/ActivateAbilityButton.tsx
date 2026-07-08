'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ActivateAbilityButtonProps {
  gameId:  string
  slotId:  string
  eligible: boolean
  reason?:  string
  abilityName: string
}

/** "Activate [Ability]" — the two player-activated Cabinet abilities (Take the Hit, Economic Briefing). Turn-free: POSTs, then refreshes the server component so the used-this-term/relationship state is current. */
export function ActivateAbilityButton({ gameId, slotId, eligible, reason, abilityName }: ActivateAbilityButtonProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [used, setUsed] = useState(false)

  async function handleClick() {
    if (!eligible || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/game/${gameId}/ability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'This ability could not be used.')
      }
      setUsed(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (used) {
    return (
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-brass)]">
        {abilityName} activated
      </p>
    )
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={!eligible || submitting}
        title={!eligible ? reason : undefined}
        className={cn(
          'block w-full rounded-sm border px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
          eligible
            ? 'border-[var(--color-brass-dim)] text-[var(--color-brass)] hover:bg-[var(--color-surface-2)]'
            : 'cursor-not-allowed border-[var(--color-border)] text-[var(--color-paper-faint)] opacity-50'
        )}
      >
        {submitting ? 'Activating…' : `Activate ${abilityName}`}
      </button>
      {!eligible && reason && (
        <p className="mt-1 text-center text-[10px] text-[var(--color-paper-faint)]">{reason}</p>
      )}
      {error && (
        <p className="mt-1 text-center text-[10px] text-[var(--color-bad)]">{error}</p>
      )}
    </div>
  )
}

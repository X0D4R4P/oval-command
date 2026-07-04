'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SPEECH_THEMES } from '@/lib/address-nation'
import { AchievementUnlockToast } from '@/components/game/AchievementUnlockToast'
import type { SpeechTheme } from '@/lib/headlines'
import type { Achievement } from '@/types/game'

interface PressConferencePanelProps {
  gameId: string
  pendingBriefingTitle: string | null
}

interface SpeechResult {
  effective: boolean
  narrative: string
  headlineText: string
  newAchievements: Achievement[]
}

export function PressConferencePanel({ gameId, pendingBriefingTitle }: PressConferencePanelProps) {
  const router = useRouter()
  const [armedTheme, setArmedTheme] = useState<SpeechTheme | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SpeechResult | null>(null)

  async function handleSelect(theme: SpeechTheme) {
    if (submitting) return

    // Same "arm, then confirm" gate CongressClient/LawCard already use —
    // this action also silently advances the month, skipping any pending
    // briefing without a response.
    if (pendingBriefingTitle && armedTheme !== theme) {
      setArmedTheme(theme)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/game/${gameId}/address-nation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'The speech could not be delivered.')
      }

      const data = await res.json()
      setResult({
        effective: data.effective,
        narrative: data.narrative,
        headlineText: data.headline.text,
        newAchievements: data.newAchievements ?? [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
      setArmedTheme(null)
    }
  }

  if (result) {
    return (
      <div className="rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-4 backdrop-blur-sm">
        <span
          className={cn(
            'font-mono text-[10px] uppercase tracking-[0.12em]',
            result.effective ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]'
          )}
        >
          {result.effective ? 'Speech Landed' : 'Speech Fell Flat'}
        </span>
        <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">{result.narrative}</p>
        <p className="mt-2 text-[12px] italic text-[var(--color-paper-faint)]">“{result.headlineText}”</p>
        {result.newAchievements.length > 0 && (
          <div className="mt-3">
            <AchievementUnlockToast achievements={result.newAchievements} />
          </div>
        )}
        <button
          onClick={() => router.push(`/game/${gameId}`)}
          className="mt-3 w-full rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] py-2.5 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90"
        >
          Return to the Oval Office
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 backdrop-blur-sm">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
        Address the Nation
      </div>
      <p className="mt-1.5 text-[12px] text-[var(--color-paper-faint)]">
        Take to the podium. Taking this action advances to next month.
      </p>

      {error && (
        <p className="mt-2 rounded-sm bg-[var(--color-bad-dim)] px-3 py-2 text-[12px] text-[var(--color-bad)]">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {SPEECH_THEMES.map(theme => {
          const armed = armedTheme === theme.id
          return (
            <button
              key={theme.id}
              onClick={() => handleSelect(theme.id)}
              disabled={submitting}
              className={cn(
                'w-full rounded-sm border px-3 py-2.5 text-left transition-colors disabled:opacity-40',
                armed
                  ? 'border-[var(--color-warn)] bg-[var(--color-surface-2)]'
                  : 'border-[var(--color-border-strong)] hover:border-[var(--color-brass-dim)]'
              )}
            >
              <div className={cn('text-sm font-medium', armed ? 'text-[var(--color-warn)]' : 'text-[var(--color-paper)]')}>
                {armed ? `Confirm — Skip "${pendingBriefingTitle}"` : theme.label}
              </div>
              {!armed && (
                <p className="mt-0.5 text-[12px] text-[var(--color-paper-faint)]">{theme.description}</p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

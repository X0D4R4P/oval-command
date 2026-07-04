'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { LawCard } from '@/components/game/LawCard'
import { HeadlineTicker } from '@/components/game/HeadlineTicker'
import { RoomBackground, roomAccentStyle } from '@/components/game/RoomBackground'
import { cn } from '@/lib/utils'
import type { Game, Law, Headline } from '@/types/game'

interface LawWithOdds {
  law: Law
  probability: number
  alreadyPassed: boolean
  blocked: boolean
}

interface CongressClientProps {
  game: Game
  lawsWithOdds: LawWithOdds[]
  canUseSenateAbility: boolean
  canUseSpeakerAbility: boolean
  pendingBriefingTitle: string | null
}

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All Bills' },
  { value: 'progressive', label: 'Progressive' },
  { value: 'conservative', label: 'Conservative' },
  { value: 'bipartisan', label: 'Bipartisan' },
] as const

interface ProposeResult {
  passed: boolean
  probability: number
  usedAbility: string | null
  headline: Headline
  lawTitle: string
}

export function CongressClient({ game, lawsWithOdds, canUseSenateAbility, canUseSpeakerAbility, pendingBriefingTitle }: CongressClientProps) {
  const searchParams = useSearchParams()
  const highlightedLawId = searchParams.get('highlight')

  // If an advisor sent us here for a specific law, auto-select the
  // category filter that contains it so it's visible without the
  // player having to guess which tab to click.
  const highlightedLaw = highlightedLawId ? lawsWithOdds.find(l => l.law.id === highlightedLawId) : undefined
  const [filter, setFilter] = useState<(typeof CATEGORY_FILTERS)[number]['value']>(
    highlightedLaw ? highlightedLaw.law.category : 'all'
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProposeResult | null>(null)
  const [pendingProposal, setPendingProposal] = useState<{ lawId: string; useNpcAbility?: 'senate_leader' | 'speaker' } | null>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  const filtered = filter === 'all' ? lawsWithOdds : lawsWithOdds.filter(l => l.law.category === filter)

  // Scroll the highlighted law into view once the page settles
  useEffect(() => {
    if (highlightedLawId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedLawId])

  async function handlePropose(lawId: string, useNpcAbility?: 'senate_leader' | 'speaker') {
    if (submitting) return

    // First click on a law when a briefing is still pending just arms the
    // confirmation instead of submitting — proposing a law advances the
    // month exactly like answering the briefing would, silently skipping it.
    const isConfirmed = pendingProposal?.lawId === lawId && pendingProposal?.useNpcAbility === useNpcAbility
    if (pendingBriefingTitle && !isConfirmed) {
      setPendingProposal({ lawId, useNpcAbility })
      return
    }

    setSubmitting(true)
    setError(null)

    const lawTitle = lawsWithOdds.find(l => l.law.id === lawId)?.law.title ?? lawId

    try {
      const res = await fetch(`/api/game/${game.id}/law`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lawId, useNpcAbility }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'The bill could not be processed.')
      }

      const data = await res.json()
      setResult({
        passed: data.passageResult.passed,
        probability: data.passageResult.probability,
        usedAbility: data.passageResult.usedAbility,
        headline: data.headline,
        lawTitle,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
      setPendingProposal(null)
    }
  }

  if (result) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12" style={roomAccentStyle('var(--color-cat-congress)')}>
        <RoomBackground image="/congress-bg.png" color="var(--color-cat-congress)" />
        <div className="rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)]">
          <div className="brief-rule" />
          <div className="p-6 text-center">
            <span
              className={cn(
                'font-mono text-[10px] uppercase tracking-[0.12em]',
                result.passed ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]'
              )}
            >
              {result.passed ? 'Bill Passed' : 'Bill Failed'}
            </span>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-paper)]">
              {result.lawTitle}
            </h2>
            {result.usedAbility && (
              <p className="mt-1 font-mono text-xs text-[var(--color-brass)]">
                Passed via {result.usedAbility}
              </p>
            )}
            <p className="mt-3 text-sm text-[var(--color-paper-dim)]">
              {result.passed ? 'Congress voted yes' : 'Congress voted no'} — {result.probability}% odds going in
            </p>

            <div className="mt-5">
              <HeadlineTicker headlines={[result.headline]} />
            </div>

            <Link
              href={`/game/${game.id}`}
              className="mt-6 block w-full rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] py-3 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90"
            >
              Return to the Oval Office
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10" style={roomAccentStyle('var(--color-cat-congress)')}>
      <RoomBackground image="/congress-bg.png" color="var(--color-cat-congress)" />
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-cat-congress)]">
          Congress
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
          Propose Legislation
        </h1>
      </div>

      <div className="mt-5 flex gap-2">
        {CATEGORY_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] transition-colors',
              filter === f.value
                ? 'bg-[var(--color-brass)] text-[var(--color-ink)]'
                : 'bg-[var(--color-surface)] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-sm bg-[var(--color-bad-dim)] px-3.5 py-2.5 text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {filtered.map(({ law, probability, alreadyPassed, blocked }) => (
          <div
            key={law.id}
            ref={law.id === highlightedLawId ? highlightRef : undefined}
            className={cn(
              law.id === highlightedLawId &&
                'rounded-sm ring-2 ring-[var(--color-brass)] ring-offset-2 ring-offset-[var(--color-ink)]'
            )}
          >
            <LawCard
              law={law}
              probability={probability}
              alreadyPassed={alreadyPassed}
              blocked={blocked}
              canUseSenateAbility={canUseSenateAbility && !alreadyPassed && !blocked}
              canUseSpeakerAbility={canUseSpeakerAbility && !alreadyPassed && !blocked}
              onPropose={handlePropose}
              disabled={submitting}
              pendingProposal={pendingProposal}
              pendingBriefingTitle={pendingBriefingTitle}
            />
          </div>
        ))}
      </div>
    </main>
  )
}

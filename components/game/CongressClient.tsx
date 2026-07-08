'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { LawCard } from '@/components/game/LawCard'
import { HeadlineTicker } from '@/components/game/HeadlineTicker'
import { RoomBackground, roomAccentStyle } from '@/components/game/RoomBackground'
import { AchievementUnlockToast } from '@/components/game/AchievementUnlockToast'
import { NpcReactionList } from '@/components/game/NpcReactionList'
import { getRoomTreatment, getRoomImage, isTenseMood } from '@/lib/event-backgrounds'
import { LAW_SECTOR_META, LAW_SECTORS } from '@/lib/law-sectors'
import { cn } from '@/lib/utils'
import type { Game, Law, Headline, Achievement, LawSector, NpcReactionResult } from '@/types/game'
import type { CoverContent } from '@/lib/magazine-covers'

interface LawWithOdds {
  law: Law
  probability: number
  alreadyPassed: boolean
  blocked: boolean
  locked: boolean
}

interface CongressClientProps {
  game: Game
  lawsWithOdds: LawWithOdds[]
  canUseSenateAbility: boolean
  canUseSpeakerAbility: boolean
  pendingBriefingTitle: string | null
}

const SECTOR_FILTERS = [
  { value: 'all' as const, label: 'All Bills' },
  ...LAW_SECTORS.map(s => ({ value: s, label: LAW_SECTOR_META[s].label })),
]

interface ProposeResult {
  passed: boolean
  probability: number
  usedAbility: string | null
  headline: Headline
  cascadeHeadlines: Headline[]
  lawTitle: string
  newAchievements: Achievement[]
  npcReactions: NpcReactionResult[]
  specialCovers: CoverContent[]
  month: number
}

export function CongressClient({ game, lawsWithOdds, canUseSenateAbility, canUseSpeakerAbility, pendingBriefingTitle }: CongressClientProps) {
  const searchParams = useSearchParams()
  const highlightedLawId = searchParams.get('highlight')

  // If an advisor sent us here for a specific law, auto-select the
  // sector filter that contains it so it's visible without the player
  // having to guess which tab to click.
  const highlightedLaw = highlightedLawId ? lawsWithOdds.find(l => l.law.id === highlightedLawId) : undefined
  const [filter, setFilter] = useState<'all' | LawSector>(
    highlightedLaw ? highlightedLaw.law.sector : 'all'
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProposeResult | null>(null)
  const [pendingProposal, setPendingProposal] = useState<{ lawId: string; useNpcAbility?: 'senate_leader' | 'speaker' } | null>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  const filtered = filter === 'all' ? lawsWithOdds : lawsWithOdds.filter(l => l.law.sector === filter)
  // No specific pending CrisisEvent object on hand here (just its title) —
  // active conflicts and low approval are still enough to swap the mood.
  const roomImage = getRoomImage('/congress-bg.webp', isTenseMood(game))
  const treatment = getRoomTreatment(roomImage)

  // Sector momentum — small "N/M passed" badge per tab, purely presentational.
  const sectorCounts: Record<string, { passed: number; total: number }> = {}
  for (const s of LAW_SECTORS) {
    const inSector = lawsWithOdds.filter(l => l.law.sector === s)
    sectorCounts[s] = { passed: inSector.filter(l => l.alreadyPassed).length, total: inSector.length }
  }

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
        cascadeHeadlines: data.cascadeHeadlines ?? [],
        lawTitle,
        newAchievements: data.newAchievements ?? [],
        npcReactions: data.npcReactions ?? [],
        specialCovers: data.specialCovers ?? [],
        month: data.game.currentMonth,
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
      <main className="mx-auto max-w-3xl px-6 py-12" style={roomAccentStyle('var(--color-cat-congress)')}>
        <RoomBackground
          image={roomImage}
          color="var(--color-cat-congress)"
          backgroundPosition={treatment.backgroundPosition}
          foreground={{ style: treatment.foregroundStyle, color: treatment.foregroundColor }}
        />
        <div className="rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] backdrop-blur-sm">
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
              <HeadlineTicker headlines={[result.headline, ...result.cascadeHeadlines]} />
            </div>

            <NpcReactionList reactions={result.npcReactions} />

            {(result.newAchievements.length > 0 || result.specialCovers.length > 0) && (
              <div className="mt-5 text-left">
                <AchievementUnlockToast
                  achievements={result.newAchievements}
                  specialCovers={result.specialCovers}
                  month={result.month}
                />
              </div>
            )}

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
    <main className="mx-auto max-w-3xl px-6 py-10" style={roomAccentStyle('var(--color-cat-congress)')}>
      <RoomBackground
        image={roomImage}
        color="var(--color-cat-congress)"
        backgroundPosition={treatment.backgroundPosition}
        foreground={{ style: treatment.foregroundStyle, color: treatment.foregroundColor }}
      />
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-cat-congress)]">
          Congress
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
          Propose Legislation
        </h1>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {SECTOR_FILTERS.map(f => {
          const counts = f.value === 'all' ? null : sectorCounts[f.value]
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] transition-colors',
                filter === f.value
                  ? 'bg-[var(--color-brass)] text-[var(--color-ink)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-paper-faint)] backdrop-blur-sm hover:text-[var(--color-paper)]'
              )}
            >
              {f.label}
              {counts && <span className="ml-1 opacity-70">{counts.passed}/{counts.total}</span>}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="mt-4 rounded-sm bg-[var(--color-bad-dim)] px-3.5 py-2.5 text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {filtered.map(({ law, probability, alreadyPassed, blocked, locked }) => (
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
              locked={locked}
              canUseSenateAbility={canUseSenateAbility && !alreadyPassed && !blocked && !locked}
              canUseSpeakerAbility={canUseSpeakerAbility && !alreadyPassed && !blocked && !locked}
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

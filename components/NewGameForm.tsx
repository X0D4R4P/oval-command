'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Seal } from '@/components/Seal'
import { PartyIcon } from '@/components/game/PartyIcon'
import { RoomBackground, roomAccentStyle } from '@/components/game/RoomBackground'
import { getRoomTreatment } from '@/lib/event-backgrounds'
import { CAMPAIGN_SCENARIOS, resolveCampaignChoices, computeElectionResult } from '@/lib/campaign'
import { CabinetSlotPicker } from '@/components/CabinetSlotPicker'
import { getDefaultCabinetSelections } from '@/lib/cabinet'
import { PRIORITY_DEFS, MIN_PRIORITIES, MAX_PRIORITIES } from '@/lib/priorities'
import type { Party, Difficulty, Perk, CreateGameResponse, SelectableSlotId } from '@/types/game'
import { SELECTABLE_SLOT_IDS } from '@/types/game'

const DEBATE_BG = '/debate-podium-bg.webp'
const VICTORY_BG = '/victory-night-bg.webp'
const CONCESSION_BG = '/concession-night-bg.webp'

// One backdrop per campaign beat — falls back to the debate stage for any
// scenario id not listed here.
const SCENARIO_BACKGROUNDS: Record<string, string> = {
  running_mate: '/campaign-hangar-bg.webp',
  october_surprise: '/press-scrum-bg.webp',
  final_debate: DEBATE_BG,
  last_stop: '/campaign-rally-bg.webp',
  election_day_ground_game: '/field-office-bg.webp',
  victory_speech: VICTORY_BG,
}

const PARTIES: { value: Party; label: string; description: string }[] = [
  { value: 'DEMOCRAT', label: 'Democratic', description: 'Stronger starting base support, lower starting congress lean' },
  { value: 'REPUBLICAN', label: 'Republican', description: 'Stronger starting base support, moderate congress lean' },
  { value: 'INDEPENDENT', label: 'Independent', description: 'No party machine — hardest mode, lowest starting support' },
]

interface NewGameFormProps {
  unlockedPerks: Perk[]
}

// The campaign choices and election-night reveal are a lead-in before the
// actual game exists — nothing is persisted until "Take the Oath of
// Office" fires the real POST /api/game, so this whole flow lives as
// client-only phase state rather than separate routes.
type Phase =
  | { step: 'setup' }
  | { step: 'campaign'; scenarioIndex: number; choiceIds: string[] }
  | { step: 'election-night'; choiceIds: string[]; retryCount: number }
  | {
      step: 'cabinet-assembly'
      choiceIds: string[]
      slotIndex: number // 0-4 = a Cabinet slot, 5 = priorities screen
      selections: Partial<Record<SelectableSlotId, string>>
      priorities: string[]
    }

export function NewGameForm({ unlockedPerks }: NewGameFormProps) {
  const router = useRouter()
  const [presidentName, setPresidentName] = useState('')
  const [party, setParty] = useState<Party>('DEMOCRAT')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [perkId, setPerkId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ step: 'setup' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared by both submit paths — skipping still needs a valid name, since
  // it's part of the election-night seed and the game itself.
  function validateSetup(): boolean {
    setError(null)
    const trimmed = presidentName.trim()
    if (!trimmed) {
      setError('Enter a name for your presidency.')
      return false
    }
    if (trimmed.length > 60) {
      setError('Name must be 60 characters or fewer.')
      return false
    }
    return true
  }

  function handleSetupSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateSetup()) return
    setPhase({ step: 'campaign', scenarioIndex: 0, choiceIds: [] })
  }

  // For repeat players who don't want to replay the campaign every term —
  // jumps straight to election night with no campaign bonus, same as if
  // every scenario had been left unanswered.
  function handleSkipCampaign() {
    if (!validateSetup()) return
    setPhase({ step: 'election-night', choiceIds: [], retryCount: 0 })
  }

  // Mid-campaign bail-out — keeps whatever scenarios were already
  // answered, just skips the rest.
  function handleSkipRemaining() {
    if (phase.step !== 'campaign') return
    setPhase({ step: 'election-night', choiceIds: phase.choiceIds, retryCount: 0 })
  }

  function handleCampaignChoice(optionId: string) {
    if (phase.step !== 'campaign') return
    const choiceIds = [...phase.choiceIds, optionId]
    if (phase.scenarioIndex + 1 < CAMPAIGN_SCENARIOS.length) {
      setPhase({ step: 'campaign', scenarioIndex: phase.scenarioIndex + 1, choiceIds })
    } else {
      setPhase({ step: 'election-night', choiceIds, retryCount: 0 })
    }
  }

  function handleBack() {
    if (phase.step === 'campaign') {
      if (phase.scenarioIndex === 0) {
        setPhase({ step: 'setup' })
      } else {
        setPhase({ step: 'campaign', scenarioIndex: phase.scenarioIndex - 1, choiceIds: phase.choiceIds.slice(0, -1) })
      }
    } else if (phase.step === 'election-night') {
      setPhase({ step: 'campaign', scenarioIndex: CAMPAIGN_SCENARIOS.length - 1, choiceIds: phase.choiceIds.slice(0, -1) })
    } else if (phase.step === 'cabinet-assembly') {
      if (phase.slotIndex === 0) {
        setPhase({ step: 'election-night', choiceIds: phase.choiceIds, retryCount: 0 })
      } else {
        setPhase({ ...phase, slotIndex: phase.slotIndex - 1 })
      }
    }
  }

  // Election night's "Take the Oath" doesn't POST immediately anymore —
  // it walks the player through assembling their administration first.
  function handleProceedToAssembly() {
    if (phase.step !== 'election-night') return
    setPhase({ step: 'cabinet-assembly', choiceIds: phase.choiceIds, slotIndex: 0, selections: {}, priorities: [] })
  }

  function handleSelectCandidate(candidateId: string) {
    if (phase.step !== 'cabinet-assembly') return
    const slotId = SELECTABLE_SLOT_IDS[phase.slotIndex]
    setPhase({ ...phase, selections: { ...phase.selections, [slotId]: candidateId }, slotIndex: phase.slotIndex + 1 })
  }

  function handleTogglePriority(id: string) {
    if (phase.step !== 'cabinet-assembly') return
    const has = phase.priorities.includes(id)
    if (has) {
      setPhase({ ...phase, priorities: phase.priorities.filter(p => p !== id) })
    } else if (phase.priorities.length < MAX_PRIORITIES) {
      setPhase({ ...phase, priorities: [...phase.priorities, id] })
    }
  }

  // Fills every slot with its default (first) candidate and skips
  // priorities entirely — for repeat players who don't want to replay
  // assembly every term, same precedent as handleSkipCampaign.
  function handleSkipAssembly() {
    if (phase.step !== 'cabinet-assembly') return
    void handleTakeOath(getDefaultCabinetSelections(), [])
  }

  // The rare "conceded the race" result isn't a real game-over — it's an
  // easter egg — so this just rerolls a fresh election-night result
  // (via retryCount, folded into the seed below) without making the
  // player redo the campaign scenarios.
  function handleTryAgain() {
    if (phase.step !== 'election-night') return
    setPhase({ step: 'election-night', choiceIds: phase.choiceIds, retryCount: phase.retryCount + 1 })
  }

  async function handleTakeOath(selections: Partial<Record<SelectableSlotId, string>>, priorities: string[]) {
    if (phase.step !== 'cabinet-assembly') return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presidentName: presidentName.trim(),
          party,
          difficulty,
          perkId: perkId ?? undefined,
          campaignChoiceIds: phase.choiceIds,
          cabinetSelections: selections,
          priorities,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not start a new term.')
      }

      const data: CreateGameResponse = await res.json()
      router.push(`/game/${data.game.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  if (phase.step === 'campaign') {
    const scenario = CAMPAIGN_SCENARIOS[phase.scenarioIndex]
    const bgImage = SCENARIO_BACKGROUNDS[scenario.id] ?? DEBATE_BG
    const treatment = getRoomTreatment(bgImage)
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12" style={roomAccentStyle('var(--color-brass)')}>
        <RoomBackground
          image={bgImage}
          color="var(--color-brass)"
          backgroundPosition={treatment.backgroundPosition}
          foreground={{ style: treatment.foregroundStyle, color: treatment.foregroundColor }}
        />
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSkipRemaining}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]"
            >
              Skip Campaign →
            </button>
          </div>

          <div className="mt-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
              The Campaign · {phase.scenarioIndex + 1} of {CAMPAIGN_SCENARIOS.length}
            </div>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
              {scenario.prompt}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-paper-dim)]">
              {scenario.flavor}
            </p>
          </div>

          <div className="mt-8 space-y-2.5">
            {scenario.options.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleCampaignChoice(option.id)}
                className="w-full rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3.5 text-left text-sm text-[var(--color-paper)] transition-colors hover:border-[var(--color-brass-dim)] hover:bg-[var(--color-surface-2)]"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (phase.step === 'election-night') {
    // Purely a client-side reveal computed from the same pure functions
    // the server will use to validate/apply the real bonus on submit —
    // there's nothing to trust here yet since no game exists. retryCount
    // is folded into the seed so "Try Again" after a rare loss rerolls a
    // genuinely different result rather than repeating the same one.
    const result = computeElectionResult(
      `${presidentName.trim()}:${party}:${difficulty}:${phase.retryCount}`,
      difficulty,
      resolveCampaignChoices(phase.choiceIds)
    )

    const accent = result.won ? 'var(--color-brass)' : 'var(--color-bad)'
    const bgImage = result.won ? VICTORY_BG : CONCESSION_BG
    const treatment = getRoomTreatment(bgImage)
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12" style={roomAccentStyle(accent)}>
        <RoomBackground
          image={bgImage}
          color={accent}
          backgroundPosition={treatment.backgroundPosition}
          foreground={{ style: treatment.foregroundStyle, color: treatment.foregroundColor }}
        />
        <div className="w-full max-w-md text-center">
          <button
            type="button"
            onClick={handleBack}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]"
          >
            ← Back
          </button>

          <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.35em]" style={{ color: accent }}>
            Election Night
          </div>
          <div className="mt-5 flex justify-center">
            <PartyIcon party={party} size={40} />
          </div>
          <div className="mt-5 font-mono text-6xl font-semibold tabular-nums text-[var(--color-paper)]">
            {result.votePercent}%
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: accent }}>
            {result.marginLabel}
          </div>
          <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-[var(--color-paper-dim)]">
            {result.narrative}
          </p>

          <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3 border-y border-[var(--color-border)] py-4">
            <div>
              <div className="font-mono text-lg font-semibold tabular-nums text-[var(--color-paper)]">{result.popularVoteMargin}</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">Popular Vote</div>
            </div>
            <div>
              <div className="font-mono text-lg font-semibold tabular-nums text-[var(--color-paper)]">{result.electoralVotes}</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">Electoral Votes</div>
            </div>
            <div>
              <div className="font-mono text-lg font-semibold text-[var(--color-paper)]">{result.keyIssue ?? '—'}</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">Key Issue</div>
            </div>
          </div>

          <h2 className="mt-8 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-paper)]">
            President {presidentName.trim()}
          </h2>

          {error && (
            <p className="mt-5 rounded-sm bg-[var(--color-bad-dim)] px-3.5 py-2.5 text-sm text-[var(--color-bad)]">
              {error}
            </p>
          )}

          {result.won ? (
            <button
              type="button"
              onClick={handleProceedToAssembly}
              className="mt-8 w-full rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] py-3 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90"
            >
              Assemble Your Administration →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTryAgain}
              className="mt-8 w-full rounded-sm border border-[var(--color-bad)] bg-[var(--color-bad-dim)] py-3 text-sm font-medium text-[var(--color-bad)] transition-opacity hover:opacity-90"
            >
              Try Again
            </button>
          )}
        </div>
      </main>
    )
  }

  if (phase.step === 'cabinet-assembly') {
    const treatment = getRoomTreatment('/oval-office-bg.webp')
    const onLastSlot = phase.slotIndex >= SELECTABLE_SLOT_IDS.length

    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12" style={roomAccentStyle('var(--color-brass)')}>
        <RoomBackground
          image="/oval-office-bg.webp"
          color="var(--color-brass)"
          backgroundPosition={treatment.backgroundPosition}
          foreground={{ style: treatment.foregroundStyle, color: treatment.foregroundColor }}
        />
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSkipAssembly}
              disabled={loading}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)] disabled:opacity-50"
            >
              Skip — use default appointees →
            </button>
          </div>

          {!onLastSlot ? (
            <>
              <div className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
                Cabinet {phase.slotIndex + 1} of {SELECTABLE_SLOT_IDS.length}
              </div>
              <div className="mt-4">
                <CabinetSlotPicker
                  slotId={SELECTABLE_SLOT_IDS[phase.slotIndex]}
                  selectedCandidateId={phase.selections[SELECTABLE_SLOT_IDS[phase.slotIndex]]}
                  onSelect={handleSelectCandidate}
                />
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
                  Campaign Priorities
                </div>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-paper)]">
                  What did you promise voters?
                </h2>
                <p className="mt-2 text-sm text-[var(--color-paper-dim)]">
                  Choose {MIN_PRIORITIES}–{MAX_PRIORITIES}. Neglect one for too long and your own Chief of Staff will let you know.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRIORITY_DEFS.map(p => {
                  const selected = phase.priorities.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleTogglePriority(p.id)}
                      className={cn(
                        'rounded-sm border px-3.5 py-2.5 text-left transition-colors',
                        selected
                          ? 'border-[var(--color-brass)] bg-[var(--color-surface-2)]'
                          : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:border-[var(--color-brass-dim)]'
                      )}
                    >
                      <div className="text-sm font-medium text-[var(--color-paper)]">{p.label}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--color-paper-faint)]">{p.description}</div>
                    </button>
                  )
                })}
              </div>

              {error && (
                <p className="mt-5 rounded-sm bg-[var(--color-bad-dim)] px-3.5 py-2.5 text-sm text-[var(--color-bad)]">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => handleTakeOath(phase.selections, phase.priorities)}
                disabled={loading || phase.priorities.length < MIN_PRIORITIES}
                className="mt-6 w-full rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] py-3 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Preparing the briefing…' : 'Take the Oath of Office'}
              </button>
            </>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]"
        >
          ← Dashboard
        </Link>
        <div className="mt-4 text-center">
          <Seal size={36} className="mx-auto text-[var(--color-brass)]" />
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
            New Term
          </div>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
            Announce Your Candidacy
          </h1>
        </div>

        <form onSubmit={handleSetupSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="presidentName" className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">
              President&rsquo;s Name
            </label>
            <input
              id="presidentName"
              type="text"
              value={presidentName}
              onChange={e => setPresidentName(e.target.value)}
              placeholder="e.g. Jordan Hayes"
              maxLength={60}
              className="mt-2 w-full rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-paper)] placeholder:text-[var(--color-paper-faint)] focus:border-[var(--color-brass)]"
            />
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">
              Party
            </span>
            <div className="mt-2 space-y-2">
              {PARTIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setParty(p.value)}
                  className={cn(
                    'w-full rounded-sm border px-4 py-3 text-left transition-colors',
                    party === p.value
                      ? 'border-[var(--color-brass)] bg-[var(--color-surface-2)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <PartyIcon party={p.value} size={20} />
                    <div className="text-sm font-medium text-[var(--color-paper)]">{p.label}</div>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-paper-faint)]">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty selector */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-paper-faint)]">
              Difficulty
            </label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {([
                { value: 'easy',   label: 'Easy',   desc: 'Forgiving start' },
                { value: 'normal', label: 'Normal', desc: 'Balanced' },
                { value: 'hard',   label: 'Hard',   desc: 'Headwinds' },
                { value: 'expert', label: 'Expert', desc: 'Crisis from day one' },
              ] as const).map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  className={cn(
                    'rounded-sm border px-2 py-2.5 text-center transition-colors',
                    difficulty === d.value
                      ? 'border-[var(--color-brass)] bg-[var(--color-surface-2)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
                  )}
                >
                  <div className="text-sm font-medium text-[var(--color-paper)]">{d.label}</div>
                  <div className="mt-0.5 text-[10px] text-[var(--color-paper-faint)]">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Starting perk selector — only shown once at least one achievement has unlocked one */}
          {unlockedPerks.length > 0 && (
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-paper-faint)]">
                Starting Perk
              </label>
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => setPerkId(null)}
                  className={cn(
                    'w-full rounded-sm border px-4 py-2.5 text-left transition-colors',
                    perkId === null
                      ? 'border-[var(--color-brass)] bg-[var(--color-surface-2)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
                  )}
                >
                  <div className="text-sm font-medium text-[var(--color-paper)]">None</div>
                </button>
                {unlockedPerks.map(perk => (
                  <button
                    key={perk.id}
                    type="button"
                    onClick={() => setPerkId(perk.id)}
                    className={cn(
                      'w-full rounded-sm border px-4 py-2.5 text-left transition-colors',
                      perkId === perk.id
                        ? 'border-[var(--color-brass)] bg-[var(--color-surface-2)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
                    )}
                  >
                    <div className="text-sm font-medium text-[var(--color-paper)]">{perk.label}</div>
                    <div className="mt-0.5 text-xs text-[var(--color-paper-faint)]">{perk.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-sm bg-[var(--color-bad-dim)] px-3.5 py-2.5 text-sm text-[var(--color-bad)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] py-3 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90"
          >
            Continue to the Campaign
          </button>
          <button
            type="button"
            onClick={handleSkipCampaign}
            className="w-full text-center font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]"
          >
            Skip the Campaign →
          </button>
        </form>
      </div>
    </main>
  )
}

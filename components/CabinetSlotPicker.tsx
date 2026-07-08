'use client'

import { cn, getStatLabel } from '@/lib/utils'
import { getCandidatesForSlot } from '@/lib/cabinet'
import type { SelectableSlotId, StatDelta } from '@/types/game'

const SLOT_LABELS: Record<SelectableSlotId, string> = {
  vice_president:      'Vice President',
  chief_of_staff:       'Chief of Staff',
  sec_defense:          'Secretary of Defense',
  treasury_secretary:   'Secretary of the Treasury',
  attorney_general:     'Attorney General',
}

function BonusChips({ bonus }: { bonus?: StatDelta }) {
  if (!bonus) return null
  const entries = Object.entries(bonus).filter(([, v]) => v !== undefined && v !== 0) as [keyof StatDelta, number][]
  if (entries.length === 0) return null

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className={cn(
            'rounded-sm border px-2 py-0.5 font-mono text-[10px] tabular-nums',
            (value as number) > 0
              ? 'border-[var(--color-good)]/40 text-[var(--color-good)]'
              : 'border-[var(--color-bad)]/40 text-[var(--color-bad)]'
          )}
        >
          {(value as number) > 0 ? '+' : ''}{value} {getStatLabel(key as keyof import('@/types/game').GameStats)}
        </span>
      ))}
    </div>
  )
}

interface CabinetSlotPickerProps {
  slotId:               SelectableSlotId
  selectedCandidateId?: string
  onSelect:             (candidateId: string) => void
  /** Omit one candidate from the list — used when replacing a sitting official, so they can't "replace" themselves. */
  excludeCandidateId?:  string
}

/**
 * "Folders slide across your desk" — one appointable position at a time,
 * each candidate shown as a dossier: archetype/description, personal goal,
 * breaking point, one interview line (their own monthlyDialogue.high[0],
 * reused rather than authoring a separate quote), and their starting stat
 * bonus. Deliberately no numeric trait bars here — traits stay hidden
 * during play (see lib/cabinet-traits.ts); only the player-visible goal/
 * breakingPoint fields and this descriptive text differentiate candidates.
 */
export function CabinetSlotPicker({ slotId, selectedCandidateId, onSelect, excludeCandidateId }: CabinetSlotPickerProps) {
  const candidates = getCandidatesForSlot(slotId).filter(c => c.candidateId !== excludeCandidateId)

  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
          Assembling Your Administration
        </div>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-paper)]">
          {SLOT_LABELS[slotId]}
        </h2>
      </div>

      <div className="space-y-3">
        {candidates.map(candidate => {
          const selected = candidate.candidateId === selectedCandidateId
          const interviewLine = candidate.monthlyDialogue.high[0]
          return (
            <button
              key={candidate.candidateId}
              type="button"
              onClick={() => onSelect(candidate.candidateId)}
              className={cn(
                'w-full rounded-sm border px-4 py-3.5 text-left transition-colors',
                selected
                  ? 'border-[var(--color-brass)] bg-[var(--color-surface-2)]'
                  : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:border-[var(--color-brass-dim)]'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--color-paper)]">{candidate.name}</span>
                {selected && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-brass)]">Selected</span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] italic text-[var(--color-paper-dim)]">{candidate.personality.archetype}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-paper-dim)]">{candidate.personality.description}</p>

              <p className="mt-2.5 text-[12px] text-[var(--color-paper-faint)]">
                <span className="font-mono uppercase tracking-[0.05em]">Wants:</span> {candidate.goal}
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-paper-faint)]">
                <span className="font-mono uppercase tracking-[0.05em]">Won&rsquo;t:</span> {candidate.breakingPoint}
              </p>

              <p className="mt-2.5 border-l-2 border-[var(--color-border)] pl-2.5 text-[13px] italic leading-snug text-[var(--color-paper-dim)]">
                &ldquo;{interviewLine}&rdquo;
              </p>

              <BonusChips bonus={candidate.startingBonus} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { SLOT_LABELS }

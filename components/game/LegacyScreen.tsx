import { cn } from '@/lib/utils'
import { Seal } from '@/components/Seal'
import { ShareButton } from '@/components/ShareButton'
import { computeSectorBreakdown } from '@/lib/law-sectors'
import { getPresidentialQuote } from '@/lib/presidential-quote'
import { buildLegacyIntelligence } from '@/lib/legacy-intelligence'
import type { LegacyScore, GameOverReason, Game } from '@/types/game'
import type { PresidentialArchetype } from '@/lib/archetype-engine'

interface LegacyScreenProps {
  legacy: LegacyScore
  reason: GameOverReason
  presidentName: string
  archetype?: PresidentialArchetype
  passedLaws: string[]
  cabinetSelections: Game['cabinetSelections']
  npcTraits: Game['npcTraits']
  onNewGame: () => void
}

const TRAIT_LABELS: Record<keyof import('@/types/game').NpcTraits, string> = {
  loyalty: 'Loyalty',
  ambition: 'Ambition',
  integrity: 'Integrity',
  politicalSkill: 'Political Skill',
  stress: 'Stress',
  ideology: 'Ideology',
}

export const REASON_LABEL: Record<GameOverReason, string> = {
  IMPEACHMENT: 'Removed from Office',
  DEBT_COLLAPSE: 'Economic Collapse',
  SECURITY_FAILURE: 'National Security Failure',
  CONSTITUTIONAL_CRISIS: 'Constitutional Crisis',
  TERM_COMPLETE: 'Term Complete',
}

function scoreTone(score: number) {
  if (score >= 65) return 'text-[var(--color-good)]'
  if (score >= 35) return 'text-[var(--color-warn)]'
  return 'text-[var(--color-bad)]'
}

function sealTone(score: number) {
  if (score >= 65) return 'text-[var(--color-brass)]'
  if (score >= 35) return 'text-[var(--color-paper-dim)]'
  return 'text-[var(--color-bad)]'
}

export function LegacyScreen({ legacy, reason, presidentName, archetype, passedLaws, cabinetSelections, npcTraits, onNewGame }: LegacyScreenProps) {
  const sectorBreakdown = computeSectorBreakdown(passedLaws)
  const intelligence = buildLegacyIntelligence(cabinetSelections, npcTraits)

  const breakdown = [
    { label: 'Approval',         value: legacy.breakdown.approval },
    { label: 'Economy',          value: legacy.breakdown.economy },
    { label: 'Security',         value: legacy.breakdown.security },
    { label: 'Global Standing',  value: legacy.breakdown.globalReputation },
    { label: 'Laws Passed',      value: legacy.breakdown.lawsPassed },
    // Penalty rows: only show when non-zero — showing "+0 Scandal Penalty"
    // on a clean presidency is visual noise that implies something bad happened
    ...(legacy.breakdown.scandalsDeducted > 0 ? [{ label: 'Scandal Penalty', value: -legacy.breakdown.scandalsDeducted }] : []),
    ...(legacy.breakdown.warConduct > 0 ? [{ label: 'War Conduct', value: -legacy.breakdown.warConduct }] : []),
  ]

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] backdrop-blur-sm">
        <div className="brief-rule" />
        <div className="p-8 text-center">
          <Seal size={56} className={cn('mx-auto', sealTone(legacy.total))} />
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
            {REASON_LABEL[reason]}
          </div>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-paper)]">
            The Presidency of {presidentName}
          </h1>

          <div className={cn('mt-6 font-mono text-6xl font-semibold tabular-nums', scoreTone(legacy.total))}>
            {legacy.total}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
            Legacy Score
          </div>

          <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-[var(--color-paper-dim)]">
            {legacy.verdict}
          </p>

          {archetype && (
            <ShareButton
              className="mt-4"
              text={`I was ${archetype.icon} ${archetype.title} as President ${presidentName} — Legacy Score ${legacy.total}/100. ${archetype.subtitle}`}
            />
          )}

          {archetype && (
            <div className="mx-auto mt-6 max-w-sm rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-5 py-5 text-left backdrop-blur-sm">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-brass)]">
                Presidential Legacy Report
              </div>

              {/* Identity */}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-3xl">{archetype.icon}</span>
                <div>
                  <div className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-paper)]">
                    {archetype.title}
                  </div>
                  <div className="text-xs italic text-[var(--color-paper-faint)]">
                    {archetype.subtitle}
                  </div>
                </div>
              </div>

              {/* Traits */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {archetype.traits.map(t => (
                  <span key={t} className="rounded-full border border-[var(--color-border-strong)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-paper-faint)]">
                    {t}
                  </span>
                ))}
              </div>

              {/* Description */}
              <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-paper-dim)]">
                {archetype.description}
              </p>

              {/* Accomplishments */}
              {archetype.accomplishments.length > 0 && (
                <div className="mt-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
                    Notable Accomplishments
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {archetype.accomplishments.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--color-paper-dim)]">
                        <span className="mt-0.5 text-[var(--color-brass)]">·</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Biggest Criticism */}
              <div className="mt-4 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 backdrop-blur-sm">
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
                  The Critics Said
                </div>
                <p className="mt-1 text-[12px] italic leading-relaxed text-[var(--color-paper-dim)]">
                  &ldquo;{archetype.biggestCriticism}&rdquo;
                </p>
              </div>

              {/* Relationships */}
              <div className="mt-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 backdrop-blur-sm">
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
                  Those Who Were There
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-paper-dim)]">
                  {archetype.relationshipLegacy}
                </p>
              </div>

              {/* Historical Comparison */}
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <p className="text-[11px] leading-relaxed text-[var(--color-paper-faint)]">
                  {archetype.historicalComparison}
                </p>
              </div>
            </div>
          )}

          {reason === 'TERM_COMPLETE' && (
            <div className="mt-5 inline-block rounded-full bg-[var(--color-surface-2)] px-4 py-1.5 backdrop-blur-sm">
              <span className="font-mono text-xs text-[var(--color-paper)]">
                {legacy.reelected ? '✓ Won reelection' : '✗ Lost reelection'} · {legacy.votePercent}% of the vote
              </span>
            </div>
          )}

          <div className="mt-7 border-t border-[var(--color-border)] pt-5 text-left">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
              Legislative Record by Sector
            </div>
            <div className="mt-3 space-y-2.5">
              {sectorBreakdown.map(({ sector, meta, passed, total }) => (
                <div key={sector}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-paper-dim)]">{meta.label}</span>
                    <span className="font-mono tabular-nums text-[var(--color-paper-faint)]">{passed}/{total}</span>
                  </div>
                  <div className="mt-1 h-[3px] w-full rounded-full bg-[var(--color-border)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${total > 0 ? (passed / total) * 100 : 0}%`, backgroundColor: meta.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-7 space-y-1.5 border-t border-[var(--color-border)] pt-5 text-left">
            {breakdown.map(item => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-paper-dim)]">{item.label}</span>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    item.value >= 0 ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]'
                  )}
                >
                  {item.value >= 0 ? '+' : ''}{item.value}
                </span>
              </div>
            ))}
          </div>

          {archetype && (
            <div className="mt-7 border-t border-[var(--color-border)] pt-5 text-center">
              <p className="mx-auto max-w-sm text-sm italic leading-relaxed text-[var(--color-paper-dim)]">
                “{getPresidentialQuote(archetype)}”
              </p>
              <p className="mt-2 font-[family-name:var(--font-signature)] text-xl text-[var(--color-brass)]">
                Respectfully, President {presidentName}
              </p>
            </div>
          )}

          {intelligence.length > 0 && (
            <div className="mt-7 border-t border-[var(--color-border)] pt-5 text-left">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
                Legacy Intelligence Report
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-[var(--color-paper-faint)]">
                What your administration never showed you while you were in office.
              </p>
              <div className="mt-4 space-y-5">
                {intelligence.map(entry => (
                  <div key={entry.slotId}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-[var(--color-paper)]">{entry.name}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)]">{entry.role}</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {(Object.entries(entry.traits) as [keyof typeof entry.traits, number][]).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="w-24 flex-shrink-0 text-[11px] text-[var(--color-paper-faint)]">{TRAIT_LABELS[key]}</span>
                          <div className="h-[3px] flex-1 rounded-full bg-[var(--color-border)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-brass)]"
                              style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
                            />
                          </div>
                          <span className="w-6 flex-shrink-0 text-right font-mono text-[10px] tabular-nums text-[var(--color-paper-faint)]">
                            {Math.round(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {entry.blurb && (
                      <p className="mt-2 text-[12px] italic leading-snug text-[var(--color-paper-dim)]">
                        In hindsight: {entry.name.split(' ').slice(-1)[0]} {entry.blurb}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onNewGame}
            className="mt-7 w-full rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] py-3 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90"
          >
            Begin a New Term
          </button>
        </div>
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'
import { Seal } from '@/components/Seal'
import { ShareButton } from '@/components/ShareButton'
import { LAWS } from '@/lib/game-engine'
import { LAW_SECTORS, LAW_SECTOR_META } from '@/lib/law-sectors'
import type { LegacyScore, GameOverReason } from '@/types/game'
import type { PresidentialArchetype } from '@/lib/archetype-engine'

interface LegacyScreenProps {
  legacy: LegacyScore
  reason: GameOverReason
  presidentName: string
  archetype?: PresidentialArchetype
  passedLaws: string[]
  onNewGame: () => void
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

export function LegacyScreen({ legacy, reason, presidentName, archetype, passedLaws, onNewGame }: LegacyScreenProps) {
  const sectorBreakdown = LAW_SECTORS.map(sector => {
    const lawsInSector = LAWS.filter(l => l.sector === sector)
    const passed = lawsInSector.filter(l => passedLaws.includes(l.id)).length
    return { sector, meta: LAW_SECTOR_META[sector], passed, total: lawsInSector.length }
  })

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

import Image from 'next/image'
import { cn, formatDelta, isDeltaGood, getStatLabel } from '@/lib/utils'
import { NPCS } from '@/lib/game-engine'
import type { StatDelta, NpcReactionResult, GameStats } from '@/types/game'

interface OutcomeCardProps {
  narrative: string
  effects: StatDelta
  npcReactions: NpcReactionResult[]
  onContinue: () => void
  nextMonth: number
  isGameOver: boolean
}

export function OutcomeCard({
  narrative,
  effects,
  npcReactions,
  onContinue,
  nextMonth,
  isGameOver,
}: OutcomeCardProps) {
  const entries = Object.entries(effects).filter(([, v]) => v !== 0) as [keyof GameStats, number][]

  return (
    <div className="rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] backdrop-blur-sm">
      <div className="brief-rule" />
      <div className="p-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-brass)]">
          Outcome
        </span>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-paper-dim)]">
          {narrative}
        </p>

        {entries.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {entries.map(([key, value]) => {
              const good = isDeltaGood(key, value)
              return (
                <span
                  key={key}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium',
                    good
                      ? 'bg-[var(--color-good-dim)] text-[var(--color-good)]'
                      : 'bg-[var(--color-bad-dim)] text-[var(--color-bad)]'
                  )}
                >
                  {getStatLabel(key)} {formatDelta(key, value)}
                </span>
              )
            })}
          </div>
        )}

        {npcReactions.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-4">
            {npcReactions.map(r => {
              const npc = NPCS.find(n => n.id === r.npcId)
              return (
              <div key={r.npcId} className="flex gap-3">
                <div className="flex-shrink-0">
                  {npc?.image ? (
                    <Image
                      src={npc.image}
                      alt={r.shortName}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-sm object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)] font-mono text-[11px] font-medium text-[var(--color-brass)] backdrop-blur-sm">
                      {r.shortName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--color-paper)]">{r.shortName}</span>
                    <span
                      className={cn(
                        'font-mono text-[10px]',
                        r.relationshipDelta > 0 ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]'
                      )}
                    >
                      {r.relationshipDelta > 0 ? '+' : ''}{r.relationshipDelta}
                    </span>
                  </div>
                <p className="mt-0.5 text-[13px] italic leading-snug text-[var(--color-paper-dim)]">
                  &ldquo;{r.quote}&rdquo;
                </p>
              </div>
            </div>
            )
            })}
          </div>
        )}

        <button
          onClick={onContinue}
          className="mt-6 w-full rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] py-3 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90"
        >
          {isGameOver ? 'View Final Report' : `Continue to Month ${nextMonth} →`}
        </button>
      </div>
    </div>
  )
}

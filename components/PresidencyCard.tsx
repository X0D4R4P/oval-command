import Link from 'next/link'
import { cn, monthToDate } from '@/lib/utils'
import { PartyIcon } from '@/components/game/PartyIcon'
import { REASON_LABEL } from '@/components/game/LegacyScreen'
import { ShareButton } from '@/components/ShareButton'
import type { Game, GameOverReason, LegacyScore } from '@/types/game'
import type { PresidentialArchetype } from '@/lib/archetype-engine'

interface PresidencyCardProps {
  rank: number
  game: Game
  legacy: LegacyScore
  reason: GameOverReason
  archetype: PresidentialArchetype
}

function scoreTone(score: number) {
  if (score >= 65) return 'text-[var(--color-good)]'
  if (score >= 35) return 'text-[var(--color-warn)]'
  return 'text-[var(--color-bad)]'
}

export function PresidencyCard({ rank, game, legacy, reason, archetype }: PresidencyCardProps) {
  const shareText = `I was ${archetype.icon} ${archetype.title} as President ${game.presidentName} — Legacy Score ${legacy.total}/100. ${archetype.subtitle}`

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 backdrop-blur-sm transition-colors hover:border-[var(--color-border-strong)]">
      <Link href={`/archive/${game.id}`} className="block">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-brass)]">
                {rank === 1 ? 'Best Legacy' : `#${rank}`}
              </span>
              <PartyIcon party={game.party} size={14} />
              {game.difficulty && game.difficulty !== 'normal' && (
                <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--color-paper-faint)]">
                  {game.difficulty}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--color-paper)]">
              President {game.presidentName}
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)]">
              {REASON_LABEL[reason]} · {monthToDate(game.currentMonth)}
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <div className={cn('font-mono text-2xl font-semibold tabular-nums', scoreTone(legacy.total))}>
              {legacy.total}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">
              Legacy
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2.5 border-t border-[var(--color-border)] pt-3">
          <span className="text-xl">{archetype.icon}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[var(--color-paper)]">{archetype.title}</div>
            <div className="text-xs italic text-[var(--color-paper-faint)]">{archetype.subtitle}</div>
          </div>
        </div>

        {reason === 'TERM_COMPLETE' && (
          <div className="mt-3 inline-block rounded-full bg-[var(--color-surface-2)] px-3 py-1">
            <span className="font-mono text-[10px] text-[var(--color-paper-dim)]">
              {legacy.reelected ? '✓ Won reelection' : '✗ Lost reelection'} · {legacy.votePercent}% of the vote
            </span>
          </div>
        )}
      </Link>

      <div className="mt-3 flex justify-end">
        <ShareButton text={shareText} />
      </div>
    </div>
  )
}

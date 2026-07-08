import { cn } from '@/lib/utils'
import type { NpcReactionResult } from '@/types/game'

// Shared reaction-quote list — extracted from OutcomeCard so both the
// crisis-turn result view and the Congress propose-law result panel can
// render "how NPCs reacted" with identical markup. Deliberately doesn't
// look up the full Npc (and therefore its photo) here — which selectable-
// slot candidate is active varies per game, and pulling that in would mean
// threading a resolved roster through every caller for a cosmetic photo;
// initials render fine on their own.
export function NpcReactionList({ reactions }: { reactions: NpcReactionResult[] }) {
  if (reactions.length === 0) return null

  return (
    <div className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-4">
      {reactions.map(r => {
        return (
          <div key={r.npcId} className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)] font-mono text-[11px] font-medium text-[var(--color-brass)] backdrop-blur-sm">
                {r.shortName.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
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
  )
}

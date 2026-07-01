import { cn } from '@/lib/utils'
import type { Headline } from '@/types/game'

const TONE_DOT: Record<Headline['tone'], string> = {
  positive: 'bg-[var(--color-good)]',
  negative: 'bg-[var(--color-bad)]',
  neutral:  'bg-[var(--color-paper-faint)]',
}

export function HeadlineTicker({ headlines }: { headlines: Headline[] }) {
  if (headlines.length === 0) return null

  return (
    <div className="space-y-2 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
        Press Coverage
      </span>
      <div className="space-y-1.5">
        {headlines.map((h, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className={cn('mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full', TONE_DOT[h.tone])} />
            <p className="leading-snug text-[var(--color-paper-dim)]">
              {h.text}
              <span className="ml-1.5 font-mono text-[10px] text-[var(--color-paper-faint)]">— {h.outlet}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

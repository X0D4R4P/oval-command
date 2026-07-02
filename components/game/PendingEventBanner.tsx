import Link from 'next/link'
import type { CrisisEvent } from '@/types/game'

export function PendingEventBanner({ event, gameId }: { event: CrisisEvent; gameId: string }) {
  return (
    <div className="rounded-sm border border-[var(--color-brass-dim)]/40 bg-[var(--color-brass)]/[0.06] px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-brass)]">
        Decision Pending
      </p>
      <p className="mt-1 text-sm text-[var(--color-paper)]">
        &ldquo;{event.title}&rdquo; needs your call.
      </p>
      <Link
        href={`/game/${gameId}`}
        className="mt-2 inline-block font-mono text-[11px] uppercase tracking-[0.05em] text-[var(--color-brass)] hover:underline"
      >
        Go to the Oval Office →
      </Link>
    </div>
  )
}

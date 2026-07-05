import type { InactivityWarning } from '@/lib/guest-cleanup'

/**
 * Shown to guest players whose administration is within a few days of
 * being deleted for inactivity (lib/guest-cleanup.ts). Deliberately doesn't
 * offer "sign in to save it" — this codebase has no guest-to-OAuth account
 * migration, so that would be a false promise. The honest, actionable
 * message is just "keep playing."
 */
export function GuestExpiryWarning({ warning }: { warning: InactivityWarning }) {
  return (
    <div className="rounded-sm border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-warn)]">
        Administration At Risk
      </div>
      <p className="mt-1 text-sm leading-snug text-[var(--color-paper-dim)]">
        This term hasn&rsquo;t been touched in {warning.daysInactive} days. Guest
        administrations are removed after 14 days of inactivity — playing now
        keeps it alive for another two weeks.
      </p>
    </div>
  )
}

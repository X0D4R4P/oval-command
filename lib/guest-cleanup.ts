import { prisma } from '@/lib/prisma'

// Guest play is explicitly "no sign-in required" — ephemeral by design, not
// a persistence guarantee. 14 days is long enough that a normal
// multi-session player never loses progress, short enough to actually
// bound the User table's growth over time.
export const EXPIRY_DAYS = 14

// How many days before the actual cutoff a returning guest sees an
// in-game warning that their administration is at risk.
const WARNING_WINDOW_DAYS = 4

export interface InactivityWarning {
  daysInactive: number
  daysRemaining: number
}

/**
 * Returns a warning if a guest's game hasn't been touched recently enough
 * that it's approaching (but hasn't yet hit) the expiration cutoff — null
 * otherwise. Pure/synchronous: takes the timestamp the caller already has
 * (Game.updatedAt), no extra query. There's deliberately no "sign in to
 * save this" recovery path offered here — this codebase has no guest-to-
 * OAuth account migration, so signing in mid-game would create a separate,
 * empty account rather than preserve this one. The honest message is just
 * "keep playing," not a fix that doesn't exist yet.
 */
export function getInactivityWarning(lastActivity: Date): InactivityWarning | null {
  const daysInactive = Math.floor((Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
  const daysRemaining = EXPIRY_DAYS - daysInactive
  if (daysRemaining <= 0 || daysRemaining > WARNING_WINDOW_DAYS) return null
  return { daysInactive, daysRemaining }
}

/**
 * Deletes Guest accounts that have been inactive for EXPIRY_DAYS — either
 * never started a game (createdAt is stale) or every game on the account
 * hasn't been touched since the cutoff (updatedAt is stale on all of them).
 * Cascades to delete their games too (Game.userId has onDelete: Cascade).
 *
 * The OR is required: Prisma's `every` is vacuously true on an empty
 * relation, so a brand-new zero-game account would otherwise incorrectly
 * match the "every game is stale" branch immediately.
 *
 * Called both opportunistically (every new guest sign-in, lib/auth.ts) and
 * on a daily schedule (app/api/cron/expire-guests/route.ts) so expiration
 * doesn't depend on someone else happening to sign in.
 */
export async function expireStaleGuests(): Promise<number> {
  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  const { count } = await prisma.user.deleteMany({
    where: {
      name: 'Guest',
      email: null,
      OR: [
        { games: { none: {} }, createdAt: { lt: cutoff } },
        { AND: [{ games: { some: {} } }, { games: { every: { updatedAt: { lt: cutoff } } } }] },
      ],
    },
  })

  return count
}

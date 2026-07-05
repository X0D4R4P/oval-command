import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toJson, toUnlockedAchievements } from '@/lib/db-helpers'
import { LINK_COOKIE_NAME } from '@/lib/link-cookie'

/**
 * Lands here right after a guest completes GitHub/Google OAuth via
 * lib/account-link.ts's linkWithGithub/linkWithGoogle. That OAuth sign-in
 * already created a brand-new, separate User (Auth.js's default adapter
 * flow — there's no built-in "link to my current session" option), so
 * this route's job is the actual merge: move the guest's games and
 * achievements onto the new permanent account, then delete the now-empty
 * guest row.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const dashboardUrl = new URL('/dashboard', req.url)

  const cookieStore = await cookies()
  const oldGuestId = cookieStore.get(LINK_COOKIE_NAME)?.value
  cookieStore.delete(LINK_COOKIE_NAME)

  if (!oldGuestId || oldGuestId === session.user.id) {
    return NextResponse.redirect(dashboardUrl)
  }

  const oldGuest = await prisma.user.findUnique({
    where: { id: oldGuestId },
    select: { id: true, name: true, email: true, unlockedAchievements: true },
  })

  // Refuse to merge anything that isn't genuinely the guest account this
  // flow was started from — a stale or mismatched cookie should just be a
  // no-op, not a chance to move someone else's data.
  if (!oldGuest || oldGuest.name !== 'Guest' || oldGuest.email !== null) {
    return NextResponse.redirect(dashboardUrl)
  }

  const newUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { unlockedAchievements: true },
  })

  const oldAchievements = toUnlockedAchievements(oldGuest.unlockedAchievements)
  const newAchievements = toUnlockedAchievements(newUser?.unlockedAchievements)
  const existingIds = new Set(newAchievements.map(a => a.id))
  const mergedAchievements = [...newAchievements, ...oldAchievements.filter(a => !existingIds.has(a.id))]

  await prisma.$transaction([
    prisma.game.updateMany({ where: { userId: oldGuestId }, data: { userId: session.user.id } }),
    prisma.user.update({ where: { id: session.user.id }, data: { unlockedAchievements: toJson(mergedAchievements) } }),
    prisma.user.delete({ where: { id: oldGuestId } }),
  ])

  dashboardUrl.searchParams.set('linked', '1')
  return NextResponse.redirect(dashboardUrl)
}

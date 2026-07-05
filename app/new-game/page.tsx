import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { NewGameForm } from '@/components/NewGameForm'
import { toUnlockedAchievements } from '@/lib/db-helpers'

export default async function NewGamePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { unlockedAchievements: true },
  })

  const unlockedIds = new Set(toUnlockedAchievements(user?.unlockedAchievements).map(u => u.id))
  const unlockedPerks = ACHIEVEMENTS.filter(a => a.perk && unlockedIds.has(a.id)).map(a => a.perk!)

  return <NewGameForm unlockedPerks={unlockedPerks} />
}

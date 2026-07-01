import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame } from '@/lib/db-helpers'
import { pickEvent } from '@/lib/game-engine'
import { GameClient } from '@/components/game/GameClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function GamePage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) notFound()
  if (row.userId !== session.user.id) redirect('/dashboard')

  const game = dbToGame(row)
  const currentEvent = game.status === 'ACTIVE' ? pickEvent(game) : null

  return <GameClient initialGame={game} initialEvent={currentEvent} />
}

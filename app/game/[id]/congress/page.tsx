import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame } from '@/lib/db-helpers'
import { LAWS, EVENTS, computePassProbability } from '@/lib/game-engine'
import { canUseNpcAbility } from '@/lib/law-engine'
import { CongressClient } from '@/components/game/CongressClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CongressPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) notFound()
  if (row.userId !== session.user.id) redirect('/dashboard')

  const game = dbToGame(row)

  const lawsWithOdds = LAWS.map(law => ({
    law,
    probability: computePassProbability(law, game),
    alreadyPassed: game.passedLaws.includes(law.id),
    blocked: law.blocks_laws.some(id => game.passedLaws.includes(id)),
  }))

  const senateAbility = canUseNpcAbility(game, 'senate_leader')
  const speakerAbility = canUseNpcAbility(game, 'speaker')

  const pendingBriefingTitle = game.status === 'ACTIVE' && row.currentEventId
    ? EVENTS.find(e => e.id === row.currentEventId)?.title ?? null
    : null

  return (
    // useSearchParams() inside CongressClient requires a Suspense boundary
    // per Next.js App Router rules — without it, the build fails static
    // generation checks even though this route is already fully dynamic.
    <Suspense fallback={null}>
      <CongressClient
        game={game}
        lawsWithOdds={lawsWithOdds}
        canUseSenateAbility={senateAbility.eligible}
        canUseSpeakerAbility={speakerAbility.eligible}
        pendingBriefingTitle={pendingBriefingTitle}
      />
    </Suspense>
  )
}

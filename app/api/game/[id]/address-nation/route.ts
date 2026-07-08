import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame, gameToDbUpdate, toJson, safeErrorMessage } from '@/lib/db-helpers'
import { resolveSpeech, SPEECH_THEMES } from '@/lib/address-nation'
import { applyDelta, pickEvent, advanceMonth, computeLegacyScore } from '@/lib/game-engine'
import { resolveRoster } from '@/lib/cabinet'
import { driftTraits } from '@/lib/cabinet-traits'
import { applyCabinetNarrative } from '@/lib/cabinet-narrative'
import { generateSpeechHeadline, type SpeechTheme } from '@/lib/headlines'
import { unlockAchievements } from '@/lib/achievements'
import { computeSpecialEditionCovers, type CoverContent } from '@/lib/magazine-covers'
import type { Headline } from '@/lib/headlines'
import type { StatDelta, GameOverReason } from '@/types/game'

interface Params { params: Promise<{ id: string }> }

interface AddressNationBody {
  theme: SpeechTheme
}

// Derived from SPEECH_THEMES rather than a separately maintained list —
// this exact drift (a new theme added there but not here) shipped once
// already and silently 400'd on the two newest themes.
const VALID_THEMES: SpeechTheme[] = SPEECH_THEMES.map(t => t.id)

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: AddressNationBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { theme } = body
  if (!theme || !VALID_THEMES.includes(theme)) {
    return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
  }

  const row = await prisma.game.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (row.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (row.status !== 'ACTIVE') return NextResponse.json({ error: 'Game is not active' }, { status: 400 })

  const game = dbToGame(row)

  let updatedGame: ReturnType<typeof dbToGame>
  let effective: boolean
  let speechEffects: StatDelta
  let cascadeHeadlines: Headline[]
  let gameOver: GameOverReason | null = null
  let suggestedEvent: ReturnType<typeof pickEvent> = null
  try {
    const speechResult = resolveSpeech(theme, game)
    effective = speechResult.effective
    speechEffects = speechResult.effects
    const statsAfterSpeech = applyDelta(game.stats, speechEffects)
    const preNarrativeGame = { ...game, stats: statsAfterSpeech }

    const advance = advanceMonth(preNarrativeGame)
    updatedGame = advance.game
    cascadeHeadlines = advance.cascadeHeadlines
    gameOver = advance.gameOver

    const roster = resolveRoster(game)
    const driftedTraits = driftTraits(preNarrativeGame)
    const narrative = applyCabinetNarrative(preNarrativeGame, { ...updatedGame, npcTraits: driftedTraits }, roster)
    updatedGame = narrative.game
    suggestedEvent = narrative.suggestedEvent
  } catch (err) {
    const message = safeErrorMessage(err, 'Speech could not be processed')
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const nextEvent = suggestedEvent ?? (updatedGame.status === 'ACTIVE' ? pickEvent(updatedGame) : null)

  const narrative = effective
    ? 'The speech lands — the message matched the moment.'
    : 'The speech falls flat — the numbers told a different story than the message did.'

  const [updateResult] = await prisma.$transaction([
    prisma.game.updateMany({
      where: { id: id, updatedAt: row.updatedAt },
      data:  { ...gameToDbUpdate(updatedGame), currentEventId: nextEvent?.id ?? null },
    }),
    prisma.gameLog.create({
      data: {
        gameId:      id,
        month:       game.currentMonth,
        actionType:  'PRESS_CONFERENCE',
        statDeltas:  toJson(speechEffects),
        narrative,
      },
    }),
  ])

  if (updateResult.count === 0) {
    return NextResponse.json(
      { error: 'This turn was already processed by another request. Reload to see the current state.' },
      { status: 409 }
    )
  }

  const headline = generateSpeechHeadline(theme, effective)
  const newAchievements = gameOver ? await unlockAchievements(session.user.id, updatedGame, gameOver) : []
  const specialCovers: CoverContent[] = gameOver
    ? computeSpecialEditionCovers(updatedGame, gameOver, computeLegacyScore(updatedGame))
    : []

  return NextResponse.json({
    game: updatedGame,
    effective,
    narrative,
    headline,
    cascadeHeadlines,
    nextEvent,
    newAchievements,
    specialCovers,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dbToGame, gameToDbUpdate, toJson } from '@/lib/db-helpers'
import { resolveSpeech } from '@/lib/address-nation'
import { computePassiveDrift, applyDelta, pickEvent, checkGameOver, computeLegacyScore } from '@/lib/game-engine'
import { generateSpeechHeadline, type SpeechTheme } from '@/lib/headlines'
import { checkAndEnqueueChains, resolveDueConsequences } from '@/lib/cascade-engine'
import { unlockAchievements } from '@/lib/achievements'
import type { Headline } from '@/lib/headlines'
import type { StatDelta, GameOverReason } from '@/types/game'

interface Params { params: Promise<{ id: string }> }

interface AddressNationBody {
  theme: SpeechTheme
}

const VALID_THEMES: SpeechTheme[] = ['economy', 'security', 'unity', 'record']

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
  try {
    const speechResult = resolveSpeech(theme, game)
    effective = speechResult.effective
    speechEffects = speechResult.effects
    const statsAfterSpeech = applyDelta(game.stats, speechEffects)

    const drift = computePassiveDrift({ ...game, stats: statsAfterSpeech })
    const nextMonthNumber = game.currentMonth + 1
    const { effects: cascadeEffects, headlines, remaining, newCooldowns } =
      resolveDueConsequences(game.pendingConsequences, nextMonthNumber)
    cascadeHeadlines = headlines

    const combinedDrift = { ...drift }
    for (const [k, v] of Object.entries(cascadeEffects) as [keyof typeof drift, number][]) {
      combinedDrift[k] = ((combinedDrift[k] ?? 0) as number) + v
    }

    const driftedStats = applyDelta(statsAfterSpeech, combinedDrift)
    const updatedCooldowns = { ...game.chainCooldowns, ...newCooldowns }

    const newPendingConsequences = checkAndEnqueueChains(
      { ...game, stats: driftedStats, currentMonth: nextMonthNumber },
      remaining,
      updatedCooldowns,
    )

    updatedGame = {
      ...game,
      stats:               driftedStats,
      pendingConsequences: newPendingConsequences,
      chainCooldowns:      updatedCooldowns,
      currentMonth:        nextMonthNumber,
      approvalHistory:     [...game.approvalHistory, Math.round(driftedStats.approval)],
      updatedAt:           new Date().toISOString(),
    }

    gameOver = checkGameOver(updatedGame)
    if (gameOver) {
      updatedGame.status = gameOver === 'TERM_COMPLETE' ? 'COMPLETE' : 'GAMEOVER'
      updatedGame.legacyScore = computeLegacyScore(updatedGame).total
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Speech could not be processed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const nextEvent = updatedGame.status === 'ACTIVE' ? pickEvent(updatedGame) : null

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

  return NextResponse.json({
    game: updatedGame,
    effective,
    narrative,
    headline,
    cascadeHeadlines,
    nextEvent,
    newAchievements,
  })
}

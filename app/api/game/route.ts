import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createInitialGame, pickEvent } from '@/lib/game-engine'
import { dbToGame, toJson } from '@/lib/db-helpers'
import type { CreateGameRequest } from '@/types/game'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateGameRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { presidentName, party, difficulty = 'normal' } = body

  if (!presidentName?.trim() || presidentName.trim().length > 60) {
    return NextResponse.json({ error: 'President name must be 1–60 characters' }, { status: 400 })
  }
  if (!['DEMOCRAT', 'REPUBLICAN', 'INDEPENDENT'].includes(party)) {
    return NextResponse.json({ error: 'Invalid party' }, { status: 400 })
  }
  if (!['easy', 'normal', 'hard', 'expert'].includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
  }

  const initial = createInitialGame(session.user.id, presidentName.trim(), party, difficulty)

  let dbGame
  try {
    dbGame = await prisma.game.create({
      data: {
        userId:              session.user.id,
        presidentName:       initial.presidentName,
        party:               initial.party,
        difficulty:          initial.difficulty,
        currentMonth:        initial.currentMonth,
        status:              initial.status,
        stats:               toJson(initial.stats),
        flags:               toJson(initial.flags),
        activeConflicts:     toJson(initial.activeConflicts),
        activeScandals:      initial.activeScandals,
        pendingConsequences: toJson(initial.pendingConsequences),
        chainCooldowns:      toJson(initial.chainCooldowns),
        npcRelationships:    toJson(initial.npcRelationships),
        usedNpcAbilities:    toJson(initial.usedNpcAbilities),
        passedLaws:          toJson(initial.passedLaws),
        usedEvents:          toJson(initial.usedEvents),
        approvalHistory:     toJson(initial.approvalHistory),
      },
    })
  } catch (err) {
    // The JWT session strategy means a signed-in browser tab stays "valid"
    // even after its underlying User row is gone (e.g. an old guest account
    // that was cleaned up) — Postgres then rejects the insert with a foreign
    // key violation instead of an auth error. Surface a message that tells
    // the player what to actually do instead of a generic failure.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return NextResponse.json(
        { error: 'Your session has expired. Please sign out and sign back in to start a new term.' },
        { status: 401 }
      )
    }
    throw err
  }

  const game = dbToGame(dbGame)
  const currentEvent = pickEvent(game)

  return NextResponse.json({ game, currentEvent }, { status: 201 })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rows = await prisma.game.findMany({
    where:   { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select:  {
      id:            true,
      presidentName: true,
      party:         true,
      difficulty:    true,
      currentMonth:  true,
      status:        true,
      legacyScore:   true,
      stats:         true,
      createdAt:     true,
      updatedAt:     true,
    },
  })

  return NextResponse.json({ games: rows })
}

/**
 * Shared helpers for converting Prisma DB rows to Game types and back.
 * Centralised here so API routes stay thin and the conversion logic
 * lives in one place to update.
 */
import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { Game, GameLog, ActionType, UnlockedAchievement } from '@/types/game'

/**
 * The full Game row, memoized per request via React's cache() — the game
 * layout and whichever room page renders inside it both need this same
 * row (the layout for its nav/breaking-event banner, the page for the
 * full game state), and without this they'd each run their own
 * independent query for the same request. cache() dedupes calls with the
 * same argument within a single render pass, so this collapses that back
 * down to one query. Only for Server Component reads — API route
 * handlers each get their own request context, so mutation routes fetch
 * directly instead (and shouldn't use a memoized read anyway, since they
 * rely on getting the freshest row for optimistic-concurrency checks).
 */
export const getGameRow = cache((id: string) => prisma.game.findUnique({ where: { id } }))

// Prisma row shapes (mirrors schema.prisma — keep in sync)
interface DbGame {
  id:               string
  userId:           string
  presidentName:    string
  party:            string
  difficulty:       string
  currentMonth:     number
  status:           string
  stats:            unknown
  flags:            unknown
  activeConflicts:  unknown
  activeScandals:   number
  pendingConsequences: unknown
  chainCooldowns: unknown
  npcRelationships: unknown
  usedNpcAbilities: unknown
  passedLaws:       unknown
  usedEvents:       unknown
  approvalHistory:  unknown
  cabinetSelections: unknown
  npcTraits:        unknown
  npcObservations:  unknown
  priorities:       unknown
  legacyScore:      number | null
  createdAt:        Date
  updatedAt:        Date
  logs?:            DbGameLog[]
}

interface DbGameLog {
  id:          string
  gameId:      string
  month:       number
  actionType:  string
  eventId:     string | null
  choiceIndex: number | null
  lawId:       string | null
  statDeltas:  unknown
  narrative:   string | null
  createdAt:   Date
}

export function dbToGame(row: DbGame): Game {
  return {
    id:               row.id,
    userId:           row.userId,
    presidentName:    row.presidentName,
    party:            row.party as Game['party'],
    difficulty:       (row.difficulty ?? 'normal') as Game['difficulty'],
    currentMonth:     row.currentMonth,
    status:           row.status as Game['status'],
    stats:            row.stats as Game['stats'],
    flags:            (row.flags as Game['flags']) ?? {},
    activeConflicts:  (row.activeConflicts as Game['activeConflicts']) ?? [],
    activeScandals:   row.activeScandals,
    pendingConsequences: (row.pendingConsequences as Game['pendingConsequences']) ?? [],
    chainCooldowns:   (row.chainCooldowns as Game['chainCooldowns']) ?? {},
    npcRelationships: (row.npcRelationships as Game['npcRelationships']) ?? {},
    usedNpcAbilities: (row.usedNpcAbilities as string[]) ?? [],
    passedLaws:       (row.passedLaws as string[]) ?? [],
    usedEvents:       (row.usedEvents  as string[]) ?? [],
    approvalHistory:  (row.approvalHistory as number[]) ?? [],
    cabinetSelections: (row.cabinetSelections as Game['cabinetSelections']) ?? {},
    npcTraits:        (row.npcTraits as Game['npcTraits']) ?? {},
    npcObservations:  (row.npcObservations as Game['npcObservations']) ?? {},
    priorities:       (row.priorities as string[]) ?? [],
    legacyScore:      row.legacyScore ?? undefined,
    createdAt:        row.createdAt.toISOString(),
    updatedAt:        row.updatedAt.toISOString(),
    logs:             row.logs?.map(dbToGameLog),
  }
}

export function dbToGameLog(row: DbGameLog): GameLog {
  return {
    id:          row.id,
    gameId:      row.gameId,
    month:       row.month,
    actionType:  row.actionType as ActionType,
    eventId:     row.eventId    ?? undefined,
    choiceIndex: row.choiceIndex ?? undefined,
    lawId:       row.lawId      ?? undefined,
    statDeltas:  row.statDeltas as GameLog['statDeltas'],
    narrative:   row.narrative  ?? undefined,
    createdAt:   row.createdAt.toISOString(),
  }
}

/** Cast a value to Prisma's JSON input type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJson(value: unknown): any {
  return value
}

const PRISMA_ERROR_TYPES = [
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientInitializationError,
]

/**
 * Extract a message safe to forward in a client-facing error response.
 * Every route that catches engine-thrown errors uses hand-written, safe
 * strings today, but this guards against a future Prisma error (which can
 * carry DB internals — table/column names, connection details) ever
 * slipping through the same catch block and being echoed back verbatim.
 */
export function safeErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && !PRISMA_ERROR_TYPES.some(cls => err instanceof cls)) {
    return err.message
  }
  return fallback
}

/** Read the User.unlockedAchievements Json column back into its real shape */
export function toUnlockedAchievements(value: unknown): UnlockedAchievement[] {
  return (value as UnlockedAchievement[] | null) ?? []
}

/** Extract only the fields that change on every turn update */
export function gameToDbUpdate(game: Game) {
  return {
    currentMonth:        game.currentMonth,
    status:              game.status,
    stats:               toJson(game.stats),
    flags:               toJson(game.flags),
    activeConflicts:     toJson(game.activeConflicts),
    activeScandals:      game.activeScandals,
    pendingConsequences: toJson(game.pendingConsequences),
    chainCooldowns:      toJson(game.chainCooldowns),
    npcRelationships:    toJson(game.npcRelationships),
    usedNpcAbilities:    toJson(game.usedNpcAbilities),
    passedLaws:          toJson(game.passedLaws),
    usedEvents:          toJson(game.usedEvents),
    approvalHistory:     toJson(game.approvalHistory),
    cabinetSelections:   toJson(game.cabinetSelections),
    npcTraits:           toJson(game.npcTraits),
    npcObservations:     toJson(game.npcObservations),
    priorities:          toJson(game.priorities),
    legacyScore:         game.legacyScore ?? null,
  }
}

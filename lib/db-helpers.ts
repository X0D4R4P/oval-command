/**
 * Shared helpers for converting Prisma DB rows to Game types and back.
 * Centralised here so API routes stay thin and the conversion logic
 * lives in one place to update.
 */
import type { Game, GameLog, ActionType } from '@/types/game'

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
    chainCooldowns: (row.chainCooldowns as Game['chainCooldowns']) ?? {},
    npcRelationships: (row.npcRelationships as Game['npcRelationships']) ?? {},
    usedNpcAbilities: (row.usedNpcAbilities as string[]) ?? [],
    passedLaws:       (row.passedLaws as string[]) ?? [],
    usedEvents:       (row.usedEvents  as string[]) ?? [],
    approvalHistory:  (row.approvalHistory as number[]) ?? [],
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

/** Extract only the fields that change on every turn update */
export function gameToDbUpdate(game: Game) {
  return {
    currentMonth:     game.currentMonth,
    status:           game.status,
    stats:            game.stats,
    flags:            game.flags,
    activeConflicts:  game.activeConflicts,
    activeScandals:   game.activeScandals,
    pendingConsequences: game.pendingConsequences,
    chainCooldowns: game.chainCooldowns,
    npcRelationships: game.npcRelationships,
    usedNpcAbilities: game.usedNpcAbilities,
    passedLaws:       game.passedLaws,
    usedEvents:       game.usedEvents,
    approvalHistory:  game.approvalHistory,
    legacyScore:      game.legacyScore ?? null,
  }
}

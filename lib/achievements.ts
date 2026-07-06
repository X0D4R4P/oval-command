/**
 * Achievements + Unlockables.
 *
 * A fixed checklist evaluated once whenever a game ends (COMPLETE or
 * GAMEOVER) via any of the three ending routes (turn, law, address-nation).
 * Persisted per-User (not per-Game) since this is meta-progression across
 * playthroughs — a guest account's achievements are wiped along with the
 * account on expiration (lib/guest-cleanup.ts), same as their games.
 *
 * Each achievement can grant a small starting Perk the player may select
 * on a future new game (see app/new-game, app/api/game/route.ts).
 */

import { prisma } from '@/lib/prisma'
import { LAWS, computeLegacyScore } from '@/lib/game-engine'
import { toJson, toUnlockedAchievements } from '@/lib/db-helpers'
import type { Game, GameOverReason, LegacyScore, LawCategory, LawSector, Achievement, UnlockedAchievement } from '@/types/game'

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'two_term_president',
    title: 'Two-Term President',
    description: 'Won reelection at the end of your term.',
    icon: '🏛️',
    perk: { id: 'two_term_president', label: "Incumbent's Confidence", description: '+5 starting Approval', statBonus: { approval: 5 } },
  },
  {
    id: 'legislative_powerhouse',
    title: 'Legislative Powerhouse',
    description: 'Passed 8 or more bills in a single term.',
    icon: '📜',
    perk: { id: 'legislative_powerhouse', label: 'Working Majority', description: '+5 starting Congress Support', statBonus: { congressSupport: 5 } },
  },
  {
    id: 'bridge_builder',
    title: 'Bridge Builder',
    description: 'Passed 3 or more bipartisan bills in a single term.',
    icon: '🤝',
    perk: { id: 'bridge_builder', label: 'Bridge Builder', description: '+5 starting Party Unity', statBonus: { partyUnity: 5 } },
  },
  {
    id: 'peacemaker',
    title: 'Peacemaker',
    description: 'Ended your term with no active conflicts and strong global standing.',
    icon: '🕊️',
    perk: { id: 'peacemaker', label: 'Diplomatic Corps', description: '+5 starting Global Reputation', statBonus: { globalReputation: 5 } },
  },
  {
    id: 'boom_economy',
    title: 'Boom Economy',
    description: 'Ended your term with the economy at 80 or above.',
    icon: '💰',
    perk: { id: 'boom_economy', label: 'Booming Start', description: '+5 starting Economy', statBonus: { economy: 5 } },
  },
  {
    id: 'domestic_tranquility',
    title: 'Domestic Tranquility',
    description: 'Ended your term with civil unrest at 10 or below.',
    icon: '🛡️',
    perk: { id: 'domestic_tranquility', label: 'Calm Before', description: '-5 starting Civil Unrest', statBonus: { unrest: -5 } },
  },
  {
    id: 'battle_tested',
    title: 'Battle-Tested',
    description: 'Completed a full term on Expert difficulty.',
    icon: '⚡',
    perk: { id: 'battle_tested', label: 'Battle-Tested', description: '+5 starting Security', statBonus: { security: 5 } },
  },
  {
    id: 'spotless_record',
    title: 'Spotless Record',
    description: 'Completed a full term with zero scandals.',
    icon: '✨',
    perk: { id: 'spotless_record', label: 'Favorable Press', description: '+1 starting Media Score', statBonus: { mediaScore: 1 } },
  },
  {
    id: 'full_term_survivor',
    title: 'Full Term Survivor',
    description: 'Made it to the end of a full 48-month term, win or lose.',
    icon: '🏁',
    perk: { id: 'full_term_survivor', label: 'Steady Hand', description: '+3 starting Party Unity', statBonus: { partyUnity: 3 } },
  },
  {
    id: 'fortress',
    title: 'Fortress',
    description: 'Ended your term with security at 80 or above.',
    icon: '🎖️',
    perk: { id: 'fortress', label: 'Fortified', description: '+5 starting Military Readiness', statBonus: { militaryReadiness: 5 } },
  },
  {
    id: 'removed_from_office',
    title: 'Removed from Office',
    description: 'Some things aren’t meant to be survived. Impeached and removed.',
    icon: '⚖️',
    perk: { id: 'removed_from_office', label: 'Humbled', description: '+3 starting Approval', statBonus: { approval: 3 } },
  },
  {
    id: 'renaissance_agenda',
    title: 'Renaissance Agenda',
    description: 'Passed laws from 5 or more different sectors in a single term.',
    icon: '🌐',
    perk: { id: 'renaissance_agenda', label: 'Broad Coalition', description: '+3 starting Approval', statBonus: { approval: 3 } },
  },
]

export const ALL_PERKS = ACHIEVEMENTS.flatMap(a => (a.perk ? [a.perk] : []))

export interface AchievementProgress {
  current: number
  target:  number
}

/**
 * Progress toward locked achievements, computed from a player's current
 * ACTIVE game — only for the achievements reducible to a single "current
 * climbing toward a fixed target" number. Deliberately excludes: compound
 * conditions (peacemaker needs both zero conflicts AND reputation ≥70),
 * outcome-gated ones that only resolve at the end of a term
 * (two_term_president, battle_tested, spotless_record), the one
 * inverted "lower is better" condition (domestic_tranquility), and the
 * achievement for a bad ending (removed_from_office) — a progress bar
 * toward getting impeached doesn't read as an achievement bar.
 */
export function computeAchievementProgress(game: Game): Record<string, AchievementProgress> {
  const bipartisanPassed = LAWS.filter(l => game.passedLaws.includes(l.id) && l.category === 'bipartisan').length
  const distinctSectorsPassed = new Set(
    LAWS.filter(l => game.passedLaws.includes(l.id)).map(l => l.sector)
  ).size

  return {
    legislative_powerhouse: { current: Math.min(game.passedLaws.length, 8), target: 8 },
    bridge_builder:         { current: Math.min(bipartisanPassed, 3), target: 3 },
    boom_economy:           { current: Math.min(Math.round(game.stats.economy), 80), target: 80 },
    fortress:               { current: Math.min(Math.round(game.stats.security), 80), target: 80 },
    full_term_survivor:     { current: game.currentMonth, target: 48 },
    renaissance_agenda:     { current: Math.min(distinctSectorsPassed, 5), target: 5 },
  }
}

interface AchievementContext {
  game:               Game
  reason:             GameOverReason
  legacy:             LegacyScore
  passedLawCategories: LawCategory[]
  passedLawSectors:   LawSector[]
}

export function evaluateAchievements(ctx: AchievementContext): Achievement[] {
  const { game, reason, legacy, passedLawCategories, passedLawSectors } = ctx
  const earnedIds = new Set<string>()

  if (legacy.reelected) earnedIds.add('two_term_president')
  if (game.passedLaws.length >= 8) earnedIds.add('legislative_powerhouse')
  if (passedLawCategories.filter(c => c === 'bipartisan').length >= 3) earnedIds.add('bridge_builder')
  if (game.activeConflicts.length === 0 && game.stats.globalReputation >= 70) earnedIds.add('peacemaker')
  if (game.stats.economy >= 80) earnedIds.add('boom_economy')
  if (game.stats.unrest <= 10) earnedIds.add('domestic_tranquility')
  if (reason === 'TERM_COMPLETE' && game.difficulty === 'expert') earnedIds.add('battle_tested')
  if (game.activeScandals === 0 && reason === 'TERM_COMPLETE') earnedIds.add('spotless_record')
  if (reason === 'TERM_COMPLETE') earnedIds.add('full_term_survivor')
  if (game.stats.security >= 80) earnedIds.add('fortress')
  if (reason === 'IMPEACHMENT') earnedIds.add('removed_from_office')
  if (new Set(passedLawSectors).size >= 5) earnedIds.add('renaissance_agenda')

  return ACHIEVEMENTS.filter(a => earnedIds.has(a.id))
}

/**
 * Evaluates and persists newly-earned achievements for a game that just
 * ended. Returns only the ones earned for the FIRST time (empty array if
 * none, or if everything earned this game was already unlocked).
 */
export async function unlockAchievements(userId: string, game: Game, reason: GameOverReason): Promise<Achievement[]> {
  const legacy = computeLegacyScore(game)
  const passedLawCategories = LAWS.filter(l => game.passedLaws.includes(l.id)).map(l => l.category)
  const passedLawSectors = LAWS.filter(l => game.passedLaws.includes(l.id)).map(l => l.sector)

  const earned = evaluateAchievements({ game, reason, legacy, passedLawCategories, passedLawSectors })
  if (earned.length === 0) return []

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { unlockedAchievements: true } })
  if (!user) return []

  const existing = toUnlockedAchievements(user.unlockedAchievements)
  const existingIds = new Set(existing.map(e => e.id))
  const newlyEarned = earned.filter(a => !existingIds.has(a.id))
  if (newlyEarned.length === 0) return []

  const updated: UnlockedAchievement[] = [
    ...existing,
    ...newlyEarned.map(a => ({ id: a.id, earnedAt: new Date().toISOString() })),
  ]
  await prisma.user.update({ where: { id: userId }, data: { unlockedAchievements: toJson(updated) } })

  return newlyEarned
}

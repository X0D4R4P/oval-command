/**
 * Law passage resolution — separate from the base probability math
 * in game-engine.ts so that NPC special-ability overrides (Vote Whip,
 * Legislative Fast Track) live in one place instead of being scattered
 * through the turn processor.
 *
 * Two of twelve NPC special abilities are wired up here, chosen because
 * they're the highest-impact, most legible to a player, and require no
 * new UI beyond "you have this option available":
 *
 *   - Senate Leader "Vote Whip"            → guarantees a bill passes
 *   - Speaker "Legislative Fast Track"     → guarantees a bill passes
 *
 * Both are once-per-term, player-activated, and gated on relationship
 * level. The other ten abilities (passive scandal reduction, early
 * warnings, etc.) remain data-only for now — see project notes.
 */

import { LAWS, NPCS, computePassProbability, rollLawPassage } from '@/lib/game-engine'
import type { Game, Law } from '@/types/game'

export interface LawPassageOptions {
  /** If set, attempt to use this NPC's special ability to guarantee passage */
  useNpcAbility?: 'senate_leader' | 'speaker'
}

export interface LawPassageResult {
  passed: boolean
  probability: number
  usedAbility: string | null
  abilityNpcId: string | null
}

const ABILITY_CONFIG: Record<
  'senate_leader' | 'speaker',
  { abilityName: string; requiresRelationship: number }
> = {
  senate_leader: { abilityName: 'Vote Whip', requiresRelationship: 72 },
  speaker:       { abilityName: 'Legislative Fast Track', requiresRelationship: 70 },
}

/** Can this NPC's guarantee-passage ability currently be used? */
export function canUseNpcAbility(
  game: Game,
  npcId: 'senate_leader' | 'speaker',
): { eligible: boolean; reason?: string } {
  const config = ABILITY_CONFIG[npcId]
  const npc = NPCS.find(n => n.id === npcId)
  if (!npc) return { eligible: false, reason: 'NPC not found' }

  if (game.usedNpcAbilities.includes(npcId)) {
    return { eligible: false, reason: `${npc.shortName} has already used ${config.abilityName} this term` }
  }

  const relationship = game.npcRelationships[npcId] ?? npc.relationship.start
  if (relationship < config.requiresRelationship) {
    return {
      eligible: false,
      reason: `Requires relationship ≥ ${config.requiresRelationship} with ${npc.shortName} (currently ${relationship})`,
    }
  }

  return { eligible: true }
}

/**
 * Resolve whether a law passes. Pure function — does not mutate game state;
 * caller is responsible for applying effects and updating usedNpcAbilities.
 */
export function resolveLawPassage(
  law: Law,
  game: Game,
  options: LawPassageOptions = {},
): LawPassageResult {
  const probability = computePassProbability(law, game)

  if (options.useNpcAbility) {
    const { eligible } = canUseNpcAbility(game, options.useNpcAbility)
    if (eligible) {
      const config = ABILITY_CONFIG[options.useNpcAbility]
      return {
        passed:       true,
        probability:  100,
        usedAbility:  config.abilityName,
        abilityNpcId: options.useNpcAbility,
      }
    }
    // Ability requested but not eligible — fall through to normal roll
  }

  return {
    passed:       rollLawPassage(probability),
    probability,
    usedAbility:  null,
    abilityNpcId: null,
  }
}

/** Apply a law's onPass effects + flags + passedLaws tracking. Pure — returns new Game. */
export function applyLawPassage(
  game: Game,
  law: Law,
  result: LawPassageResult,
): Game {
  if (!result.passed) {
    return {
      ...game,
      usedNpcAbilities: result.abilityNpcId
        ? [...game.usedNpcAbilities, result.abilityNpcId]
        : game.usedNpcAbilities,
    }
  }

  const newFlags = { ...game.flags }
  for (const f of law.sets_flags ?? []) newFlags[f] = true

  return {
    ...game,
    flags:            newFlags,
    passedLaws:       [...game.passedLaws, law.id],
    usedNpcAbilities: result.abilityNpcId
      ? [...game.usedNpcAbilities, result.abilityNpcId]
      : game.usedNpcAbilities,
  }
}

/** Convenience: look up a law by id from the canonical LAWS list */
export function getLawById(lawId: string): Law | undefined {
  return LAWS.find(l => l.id === lawId)
}

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

import { LAWS, computePassProbability, rollLawPassage } from '@/lib/game-engine'
import { FIXED_NPCS, resolveRoster } from '@/lib/cabinet'
import type { Game, Law, NpcReactionResult } from '@/types/game'

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
  const npc = FIXED_NPCS.find(n => n.id === npcId)
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

/**
 * Reacts NPCs to a just-passed law using that law's own `npc_reactions`
 * quotes — deliberately separate from the generic processNpcReactions
 * engine in game-engine.ts, which draws a RANDOM line from an NPC's
 * current relationship-tier dialogue rather than a quote specific to what
 * just happened. Every law already carries 2-3 hand-written NPC quotes in
 * its data; this is what actually surfaces them.
 */
export function resolveLawNpcReactions(
  game: Game,
  law: Law,
): { reactions: NpcReactionResult[]; newRelationships: Record<string, number> } {
  const relationships = { ...game.npcRelationships }
  const reactions: NpcReactionResult[] = []
  const roster = resolveRoster(game)

  for (const [npcId, reaction] of Object.entries(law.npc_reactions ?? {})) {
    const npc = roster.find(n => n.id === npcId)
    if (!npc) continue

    const current = relationships[npcId] ?? npc.relationship.start
    const next = Math.max(npc.relationship.min, Math.min(npc.relationship.max, current + reaction.relationship))
    relationships[npcId] = next

    reactions.push({
      npcId,
      npcName:           npc.name,
      shortName:         npc.shortName,
      quote:             reaction.quote,
      relationshipDelta: reaction.relationship,
      newRelationship:   next,
    })
  }

  return { reactions, newRelationships: relationships }
}

export interface LegislativeOpportunity {
  suggested?: Law
  congressHighlyFavorable: boolean
  message: string
}

/**
 * Shared "is this a good moment to push legislation" check, reused by
 * PresidentialInbox and the Propose Legislation action card so both
 * derive the same condition instead of duplicating it.
 */
export function getLegislativeOpportunity(game: Game): LegislativeOpportunity | null {
  const congressFavorable = game.stats.congressSupport > 55
  const availableLaws = LAWS.filter(l => !game.passedLaws.includes(l.id))
  const noLawsThisTerm = game.passedLaws.length === 0
  const congressHighlyFavorable = game.stats.congressSupport > 65

  const shouldShow = availableLaws.length > 0 && (
    (congressFavorable && noLawsThisTerm && game.currentMonth > 5) ||
    (congressHighlyFavorable && game.currentMonth > 8)
  )

  if (!shouldShow) return null

  const suggested = availableLaws
    .filter(l => {
      const base = 50 + (game.stats.congressSupport - 50) * 0.8
      return base > 45 && l.cost !== 'high'
    })
    .sort((a, b) => {
      const costOrder: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 }
      return costOrder[a.cost] - costOrder[b.cost]
    })[0]

  const message = congressHighlyFavorable && !noLawsThisTerm
    ? `Congress support is at ${Math.round(game.stats.congressSupport)}% — an unusually strong window.`
    : `Congress is favorable at ${Math.round(game.stats.congressSupport)}% and you haven't passed any legislation yet.`

  return { suggested, congressHighlyFavorable, message }
}

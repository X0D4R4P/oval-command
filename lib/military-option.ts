/**
 * Secretary of Defense's "Military Option" ability — unlike the other 4
 * Cabinet abilities, this is a content-unlock (an exclusive 5th choice on
 * military-category crisis events), not a stat effect. Hand-authoring a
 * 5th choice across all 16 military events would be real content work on
 * its own, so this is a generic transformation instead: deterministically
 * derived from whichever military event is showing, using the existing
 * choice with the strongest security effect as its base. Same
 * computation runs client-side (for display) and server-side (for
 * validation) — never trust a client-submitted synthetic choice.
 */

import { abilityEffectivenessMultiplier } from '@/lib/cabinet-abilities'
import type { Game, Npc, CrisisEvent, EventChoice } from '@/types/game'

export function isMilitaryOptionUnlocked(game: Game, roster: Npc[]): boolean {
  const secDef = roster.find(n => n.id === 'sec_defense')
  if (!secDef?.specialAbility.unlocksMilitaryOption) return false
  const threshold = secDef.specialAbility.requiresRelationship ?? 100
  const relationship = game.npcRelationships.sec_defense ?? secDef.relationship.start
  return relationship >= threshold
}

/**
 * The synthetic choice, or null if this event isn't eligible (not
 * military, or has no choices to derive a baseline from). Deterministic:
 * always the same output for the same event + traits, so the client's
 * preview and the server's re-derivation at resolution time agree.
 */
export function getMilitaryOptionChoice(event: CrisisEvent, game: Game): EventChoice | null {
  if (event.category !== 'military' || event.choices.length === 0) return null

  const base = event.choices.reduce((best, c) =>
    (c.effects.security ?? 0) > (best.effects.security ?? 0) ? c : best
  )

  const multiplier = abilityEffectivenessMultiplier(game.npcTraits.sec_defense)
  const securityBonus = Math.round(3 * multiplier)
  const reputationRelief = base.effects.globalReputation && base.effects.globalReputation < 0
    ? Math.round(base.effects.globalReputation * 0.5)
    : base.effects.globalReputation

  return {
    index: event.choices.length,
    text: 'Authorize the classified operation your Secretary of Defense has prepared.',
    effects: {
      ...base.effects,
      security: (base.effects.security ?? 0) + securityBonus,
      globalReputation: reputationRelief,
    },
    sets_flags: base.sets_flags,
    outcome: 'Your Secretary of Defense oversees the operation personally. It goes exactly the way the briefing said it would — which almost never happens.',
  }
}

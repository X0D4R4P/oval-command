/**
 * Execution for the 4 Cabinet special abilities that were data/flavor-only
 * before this pass — Take the Hit (VP), Damage Control (Chief of Staff),
 * Economic Briefing (Treasury), Legal Shield (Attorney General). Military
 * Option (Secretary of Defense) is handled separately in
 * lib/military-option.ts since it's a content-unlock, not a stat effect.
 *
 * Every ability's strength scales with the occupying candidate's
 * politicalSkill — the same ability description ("reduces the hit by
 * 30%") lands differently depending on who's actually running it, without
 * needing per-candidate special-cased code: `abilityEffectivenessMultiplier`
 * reads the trait generically off whichever candidate is in the slot.
 */

import { applyDelta } from '@/lib/game-engine'
import type { Game, Npc, NpcTraits, StatDelta } from '@/types/game'

/** 0.7x at politicalSkill 0, 1.3x at politicalSkill 100 — a real but bounded spread. */
export function abilityEffectivenessMultiplier(traits: NpcTraits | undefined): number {
  if (!traits) return 1
  return 0.7 + (traits.politicalSkill / 100) * 0.6
}

/**
 * Passive scandal mitigation from Chief of Staff's Damage Control and
 * Attorney General's Legal Shield — both described as "reduce the
 * approval hit" / "reduce scandal severity" against the same underlying
 * mechanic (computePassiveDrift's scandal drain), since the engine
 * doesn't model scandal "severity" or "duration" as separate fields.
 * Capped combined so an active scandal is never fully consequence-free.
 */
export function computeScandalMitigation(game: Game, roster: Npc[]): number {
  let mitigation = 0

  const cos = roster.find(n => n.id === 'chief_of_staff')
  if (cos?.specialAbility.passive && cos.specialAbility.requiresRelationship !== undefined) {
    const relationship = game.npcRelationships.chief_of_staff ?? cos.relationship.start
    if (relationship >= cos.specialAbility.requiresRelationship) {
      mitigation += 0.30 * abilityEffectivenessMultiplier(game.npcTraits.chief_of_staff)
    }
  }

  const ag = roster.find(n => n.id === 'attorney_general')
  if (ag?.specialAbility.passive && ag.specialAbility.requiresRelationship !== undefined) {
    const relationship = game.npcRelationships.attorney_general ?? ag.relationship.start
    if (relationship >= ag.specialAbility.requiresRelationship) {
      mitigation += 0.25 * abilityEffectivenessMultiplier(game.npcTraits.attorney_general)
    }
  }

  return Math.min(0.8, mitigation)
}

export const ACTIVATABLE_SLOTS = ['vice_president', 'treasury_secretary'] as const
export type ActivatableSlot = (typeof ACTIVATABLE_SLOTS)[number]

export function isActivatableSlot(slotId: string): slotId is ActivatableSlot {
  return (ACTIVATABLE_SLOTS as readonly string[]).includes(slotId)
}

export interface AbilityEligibility {
  eligible: boolean
  reason?: string
}

/** Shared eligibility check for both player-activated abilities — once per term, relationship-gated, same as canUseNpcAbility's precedent in law-engine.ts. */
export function canActivateAbility(game: Game, roster: Npc[], slotId: ActivatableSlot): AbilityEligibility {
  const npc = roster.find(n => n.id === slotId)
  if (!npc) return { eligible: false, reason: 'No official currently in this role' }

  if (game.usedNpcAbilities.includes(slotId)) {
    return { eligible: false, reason: `${npc.shortName} has already used ${npc.specialAbility.name} this term` }
  }

  const relationship = game.npcRelationships[slotId] ?? npc.relationship.start
  const threshold = npc.specialAbility.requiresRelationship ?? 0
  if (relationship < threshold) {
    return { eligible: false, reason: `Requires relationship ≥ ${threshold} with ${npc.shortName} (currently ${Math.round(relationship)})` }
  }

  if (slotId === 'vice_president' && game.activeScandals <= 0) {
    return { eligible: false, reason: 'Take the Hit only makes sense while a scandal is active' }
  }

  return { eligible: true }
}

export interface AbilityActivationResult {
  game:    Game
  effects: StatDelta
  npcName: string
  abilityName: string
}

/**
 * Applies the activation. Turn-free, same precedent as personnel scenes —
 * a president calling in a favor from their VP or Treasury Secretary
 * doesn't cost the month.
 */
export function activateAbility(game: Game, roster: Npc[], slotId: ActivatableSlot): AbilityActivationResult {
  const { eligible, reason } = canActivateAbility(game, roster, slotId)
  if (!eligible) throw new Error(reason ?? 'This ability cannot be used right now')

  const npc = roster.find(n => n.id === slotId)!
  const multiplier = abilityEffectivenessMultiplier(game.npcTraits[slotId])

  let effects: StatDelta
  if (slotId === 'vice_president') {
    // "Absorb a scandal, reducing its approval impact by ~40%" — modeled
    // as an immediate offsetting approval boost sized against the current
    // scandal drain, since the engine doesn't have a per-scandal decision
    // point to intercept at the moment one fires.
    effects = { approval: Math.round(6 * multiplier) }
  } else {
    // Economic Briefing: "+8 economy, -$200B debt" as authored, scaled by
    // political skill.
    effects = { economy: Math.round(8 * multiplier), debt: -0.2 * multiplier }
  }

  const relationshipCost = slotId === 'vice_president' ? -15 : -5
  const currentRelationship = game.npcRelationships[slotId] ?? npc.relationship.start
  const newRelationship = Math.max(npc.relationship.min, Math.min(npc.relationship.max, currentRelationship + relationshipCost))

  const updatedGame: Game = {
    ...game,
    stats: applyDelta(game.stats, effects),
    npcRelationships: { ...game.npcRelationships, [slotId]: newRelationship },
    usedNpcAbilities: [...game.usedNpcAbilities, slotId],
  }

  return { game: updatedGame, effects, npcName: npc.shortName, abilityName: npc.specialAbility.name }
}

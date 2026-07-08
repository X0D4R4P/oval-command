/**
 * Hidden character traits — loyalty, ambition, integrity, politicalSkill,
 * stress, ideology. Never rendered as numbers during play (see
 * NpcTraits in types/game.ts); the only player-facing surface is
 * `Game.npcObservations` text unlocked here, and the scenes/behavior
 * those traits quietly drive (lib/cabinet-narrative.ts). Fully revealed
 * as numbers only on the post-game Legacy Intelligence Report.
 *
 * Deliberately has no dependency on lib/cabinet-narrative.ts or any
 * route — these are small, pure, individually-callable pieces the
 * initiative engine and the personnel API route compose.
 */

import { SELECTABLE_SLOT_IDS, type Game, type NpcTraits } from '@/types/game'
import { isTenseMood } from '@/lib/event-backgrounds'

const TRAIT_KEYS = ['loyalty', 'ambition', 'integrity', 'politicalSkill', 'stress', 'ideology'] as const

export function clampTrait(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/** Apply a scene choice's traitDeltas to one npc, clamped 0-100. No-op if that npc has no seeded traits (fixed, non-Cabinet NPCs don't have any). */
export function applyTraitDeltas(
  npcTraits: Record<string, NpcTraits>,
  npcId: string,
  deltas: Partial<Record<keyof NpcTraits, number>> | undefined,
): Record<string, NpcTraits> {
  const current = npcTraits[npcId]
  if (!current || !deltas) return npcTraits

  const next: NpcTraits = { ...current }
  for (const key of TRAIT_KEYS) {
    const delta = deltas[key]
    if (!delta) continue
    next[key] = clampTrait(current[key] + delta)
  }
  return { ...npcTraits, [npcId]: next }
}

/**
 * Monthly stress drift — the only trait that moves on its own, without a
 * scene. Rises faster while the administration is under a tense mood
 * (active conflict / breaking event / approval < 30, see
 * lib/event-backgrounds.ts's isTenseMood), drains slowly otherwise.
 * Every other trait only ever changes via an authored scene's
 * traitDeltas.
 */
export function driftTraits(game: Game): Record<string, NpcTraits> {
  const tense = isTenseMood(game)
  const delta = tense ? 1.5 : -0.5

  const next = { ...game.npcTraits }
  for (const slotId of SELECTABLE_SLOT_IDS) {
    const traits = next[slotId]
    if (!traits) continue
    next[slotId] = { ...traits, stress: clampTrait(traits.stress + delta) }
  }
  return next
}

// ── Observation text (Layer 2 — "you've begun to notice...") ──────────

type ObservationKey =
  | 'high_stress' | 'low_loyalty' | 'high_ambition' | 'low_integrity' | 'high_political_skill'

const OBSERVATION_TEXT: Record<ObservationKey, (name: string) => string> = {
  high_stress:          name => `${name} looks exhausted these days — the pace is wearing on them.`,
  low_loyalty:          name => `${name} has started hedging in meetings, careful not to be too closely tied to any one decision.`,
  high_ambition:        name => `You've noticed ${name} making a point of being seen at the right events lately.`,
  low_integrity:        name => `Something ${name} said in the last briefing didn't quite line up with what actually happened.`,
  high_political_skill: name => `${name} got three people to change their position in one meeting. Worth remembering.`,
}

/**
 * Compares an npc's traits before/after a change and appends any newly-
 * crossed observation lines to Game.npcObservations — one-way, same
 * milestone-flag precedent as lib/npc-milestones.ts (a clue stays
 * unlocked even if the trait later drifts back).
 */
export function revealObservations(
  npcObservations: Record<string, string[]>,
  npcId: string,
  npcName: string,
  prevTraits: NpcTraits | undefined,
  nextTraits: NpcTraits | undefined,
): Record<string, string[]> {
  if (!nextTraits) return npcObservations
  const existing = npcObservations[npcId] ?? []
  const newLines: string[] = []

  const crossed = (trait: keyof NpcTraits, test: (v: number) => boolean) =>
    test(nextTraits[trait]) && !(prevTraits && test(prevTraits[trait]))

  if (crossed('stress', v => v >= 70) && !existing.some(l => l === OBSERVATION_TEXT.high_stress(npcName))) {
    newLines.push(OBSERVATION_TEXT.high_stress(npcName))
  }
  if (crossed('loyalty', v => v < 30) && !existing.some(l => l === OBSERVATION_TEXT.low_loyalty(npcName))) {
    newLines.push(OBSERVATION_TEXT.low_loyalty(npcName))
  }
  if (crossed('ambition', v => v >= 70) && !existing.some(l => l === OBSERVATION_TEXT.high_ambition(npcName))) {
    newLines.push(OBSERVATION_TEXT.high_ambition(npcName))
  }
  if (crossed('integrity', v => v < 35) && !existing.some(l => l === OBSERVATION_TEXT.low_integrity(npcName))) {
    newLines.push(OBSERVATION_TEXT.low_integrity(npcName))
  }
  if (crossed('politicalSkill', v => v >= 75) && !existing.some(l => l === OBSERVATION_TEXT.high_political_skill(npcName))) {
    newLines.push(OBSERVATION_TEXT.high_political_skill(npcName))
  }

  if (newLines.length === 0) return npcObservations
  return { ...npcObservations, [npcId]: [...existing, ...newLines] }
}

/**
 * Severity of firing/losing an official, 0 (already estranged, low cost)
 * to 1 (was a strong ally, high cost) — same min/max normalization
 * CabinetCard.tsx and npc-milestones.ts already use for relationship
 * tone, reused here to scale the consequence of a personnel change.
 */
export function relationshipSeverity(relationship: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (relationship - min) / (max - min)))
}

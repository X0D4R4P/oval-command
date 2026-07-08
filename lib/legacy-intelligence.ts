/**
 * Legacy Intelligence Report — the one place hidden Cabinet traits are
 * ever shown as numbers. During play they only ever surface as
 * npcObservations text and scene behavior (see lib/cabinet-traits.ts);
 * this is the post-game "pull back the curtain" payoff, read once from
 * already-stored Game.npcTraits/cabinetSelections — no new gameplay logic.
 */

import { getCandidatesForSlot, getSlotRole } from '@/lib/cabinet'
import { SELECTABLE_SLOT_IDS, type Game, type NpcTraits, type SelectableSlotId } from '@/types/game'

export interface LegacyIntelligenceEntry {
  slotId: SelectableSlotId
  name:   string
  role:   string
  traits: NpcTraits
  blurb:  string | null
}

/** Narrative payoff for a notable final trait combination — checked in priority order, first match wins. */
function buildBlurb(traits: NpcTraits): string | null {
  if (traits.ambition >= 70 && traits.loyalty < 35) {
    return 'was quietly laying the groundwork for their own political future the entire time.'
  }
  if (traits.integrity >= 80 && traits.stress >= 70) {
    return 'held the line on principle right up until it nearly broke them.'
  }
  if (traits.loyalty >= 80 && traits.stress >= 70) {
    return 'never once wavered — and paid for it in ways that never made the papers.'
  }
  if (traits.politicalSkill >= 80) {
    return 'was quietly the most effective operator in the building, whether you noticed or not.'
  }
  if (traits.stress >= 85) {
    return 'was running on fumes by the end of the term. It never showed in public.'
  }
  if (traits.integrity < 35) {
    return "cut more corners than you probably knew about."
  }
  return null
}

export function buildLegacyIntelligence(
  cabinetSelections: Game['cabinetSelections'],
  npcTraits: Game['npcTraits'],
): LegacyIntelligenceEntry[] {
  const entries: LegacyIntelligenceEntry[] = []

  for (const slotId of SELECTABLE_SLOT_IDS) {
    const traits = npcTraits[slotId]
    if (!traits) continue

    const candidateId = cabinetSelections[slotId]
    const candidate = getCandidatesForSlot(slotId).find(c => c.candidateId === candidateId)
    if (!candidate) continue

    entries.push({
      slotId,
      name:   candidate.name,
      role:   getSlotRole(slotId),
      traits,
      blurb:  buildBlurb(traits),
    })
  }

  return entries
}

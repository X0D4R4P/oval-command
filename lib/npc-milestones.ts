/**
 * NPC relationship milestones — one-time flags set the first time a
 * relationship crosses into the "ally" or "estranged" tier, giving the
 * cabinet's static relationship bars an actual narrative beat instead of
 * just a number that drifts around.
 *
 * Thresholds match CabinetCard.tsx's relationshipTone() exactly (same 0-1
 * normalization by each NPC's own min/max range) so the milestone badge
 * never disagrees with what the card already shows.
 */

import type { Npc } from '@/types/game'

export const MILESTONE_ALLY_THRESHOLD = 0.7
export const MILESTONE_ESTRANGED_THRESHOLD = 0.25

export type MilestoneTier = 'ally' | 'estranged'

const MILESTONE_CONTENT: Record<string, Record<MilestoneTier, string>> = {
  vice_president: {
    ally: "VP Mercer has stopped hedging her bets — she's tied her own political future to yours now, for better or worse.",
    estranged: 'VP Mercer has quietly started distancing herself in every room where it might matter to her own future.',
  },
  chief_of_staff: {
    ally: "COS Okafor no longer softens the bad news for you — she trusts you enough to just say it straight, every time.",
    estranged: 'COS Okafor has started running the building around you instead of through you.',
  },
  sec_defense: {
    ally: "SecDef Hargrove has stopped hedging his military advice — you've earned the version he'd give a President he actually trusts.",
    estranged: 'SecDef Hargrove has started taking his concerns to Congress before he brings them to you.',
  },
  treasury_secretary: {
    ally: "SecTreas Voss has become your fiercest defender in every closed-door budget fight — she's staked her own credibility on yours.",
    estranged: "SecTreas Voss has stopped bringing you her real numbers first — you're hearing her concerns secondhand now, through the press.",
  },
  attorney_general: {
    ally: "AG Webb has become the rare cabinet member who'll go to the mat for you in private, not just in public.",
    estranged: 'AG Webb has started keeping a paper trail that reads less like cooperation and more like self-protection.',
  },
  speaker: {
    ally: "Speaker Dunmore has started calling in favors on your behalf without being asked — that's the highest compliment she pays.",
    estranged: "Speaker Dunmore has stopped returning your calls personally — you're dealing with her staff now.",
  },
  senate_leader: {
    ally: "Sen. Leader Briggs has fully committed to your agenda — once he's in, he's reliably in.",
    estranged: "Sen. Leader Briggs has stopped shielding you from his caucus's worst instincts.",
  },
  opposition_leader: {
    ally: 'Sen. Garrett has, improbably, become a working partner — his own base is starting to notice.',
    estranged: "Sen. Garrett has made opposing you his entire political identity — there's no more common ground left to find.",
  },
  media_anchor: {
    ally: 'Diane Fontaine gives your administration the benefit of the doubt now — earned, not given, and rare for her.',
    estranged: "Diane Fontaine has started running a recurring segment on your administration's credibility — that's not a good sign.",
  },
  foreign_ally: {
    ally: 'Chancellor Brandt now treats you as the partner she can actually build long-term policy with — a rare status among her counterparts.',
    estranged: "Chancellor Brandt has started hedging her country's commitments whenever your name comes up.",
  },
  foreign_adversary: {
    ally: "Pres. Zhukov has, for now, stopped probing for weakness — he's decided confrontation with you costs more than it's worth.",
    estranged: "Pres. Zhukov has concluded you're the kind of President worth testing — expect more of this.",
  },
  protest_leader: {
    ally: 'Maya Chen has, against her own instincts, started describing your administration as one she can actually work with.',
    estranged: "Maya Chen has stopped believing anything your administration says — to her, you're just another broken institution now.",
  },
}

export function getMilestoneText(npcId: string, tier: MilestoneTier): string | null {
  return MILESTONE_CONTENT[npcId]?.[tier] ?? null
}

function relationshipPct(npc: Npc, value: number): number {
  const { min, max } = npc.relationship
  return (value - min) / (max - min)
}

/**
 * Compares relationship values before/after this turn and returns any
 * newly-crossed milestone flags to merge into game.flags. One-way only —
 * a milestone stays recorded even if the relationship later drifts back.
 */
export function checkNpcMilestones(
  npcs: Npc[],
  prevRelationships: Record<string, number>,
  newRelationships: Record<string, number>,
  flags: Record<string, boolean>,
): Record<string, boolean> {
  const newFlags: Record<string, boolean> = {}

  for (const npc of npcs) {
    if (!MILESTONE_CONTENT[npc.id]) continue

    const prevValue = prevRelationships[npc.id] ?? npc.relationship.start
    const newValue = newRelationships[npc.id] ?? npc.relationship.start
    if (prevValue === newValue) continue

    const prevPct = relationshipPct(npc, prevValue)
    const newPct = relationshipPct(npc, newValue)

    const allyFlag = `milestone_${npc.id}_ally`
    if (newPct >= MILESTONE_ALLY_THRESHOLD && prevPct < MILESTONE_ALLY_THRESHOLD && !flags[allyFlag]) {
      newFlags[allyFlag] = true
    }

    const estrangedFlag = `milestone_${npc.id}_estranged`
    if (newPct < MILESTONE_ESTRANGED_THRESHOLD && prevPct >= MILESTONE_ESTRANGED_THRESHOLD && !flags[estrangedFlag]) {
      newFlags[estrangedFlag] = true
    }
  }

  return newFlags
}

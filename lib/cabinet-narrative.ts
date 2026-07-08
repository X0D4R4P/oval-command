/**
 * NPC Initiative Engine — "characters create events, not just react to
 * them." Cabinet officials periodically generate their own scene (a
 * request, a conflict, a resignation) based on their traits/goal/
 * relationship/priority-neglect history, rather than only responding to
 * the player clicking "Discuss" or a scripted arc's flag tripping.
 *
 * This is content SELECTION, not content generation — every scene it can
 * surface is hand-authored in data/personnel-events.json (category:
 * 'personnel'). This module only decides whether and which one to queue,
 * reusing Game.chainCooldowns for pacing exactly like the existing
 * cascade-engine chains do.
 */

import { EVENTS, applyDelta } from '@/lib/game-engine'
import { hireCandidate, getCandidatesForSlot } from '@/lib/cabinet'
import { revealObservations, relationshipSeverity, applyTraitDeltas } from '@/lib/cabinet-traits'
import { getNeglectedPriorities } from '@/lib/priorities'
import { generateFiringHeadline } from '@/lib/headlines'
import {
  SELECTABLE_SLOT_IDS,
  type Game,
  type Npc,
  type CrisisEvent,
  type SelectableSlotId,
  type NpcTraits,
  type StatDelta,
  type Headline,
  type NpcReactionResult,
} from '@/types/game'

const PERSONNEL_EVENTS = EVENTS.filter(e => e.category === 'personnel')

function isSelectableSlot(id: string): id is SelectableSlotId {
  return (SELECTABLE_SLOT_IDS as readonly string[]).includes(id)
}

function eventsForSlot(slotId: string, tier: string): CrisisEvent[] {
  return PERSONNEL_EVENTS.filter(e => e.npcId === slotId && e.personnelMeta?.tier === tier)
}

// ── Resignation risk ─────────────────────────────────────────

function resignationChance(traits: NpcTraits, relationship: number): number {
  let chance = 0
  if (traits.loyalty < 30 && traits.ambition > 65) chance += 0.12
  if (traits.stress > 80 && relationship < 35) chance += 0.15
  return chance
}

export function checkResignationRisk(game: Game): CrisisEvent | null {
  for (const slotId of SELECTABLE_SLOT_IDS) {
    const traits = game.npcTraits[slotId]
    if (!traits) continue
    const relationship = game.npcRelationships[slotId] ?? 50
    const chance = resignationChance(traits, relationship)
    if (chance <= 0) continue

    const cooldownKey = `resignation_${slotId}`
    if ((game.chainCooldowns[cooldownKey] ?? 0) > game.currentMonth) continue
    if (Math.random() >= chance) continue

    const candidates = eventsForSlot(slotId, 'resignation')
    if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)]
  }
  return null
}

// ── Requests / conflicts / neglect nudges ────────────────────

/** goalTag for whichever candidate currently fills a slot — resolved from cabinetSelections against the static candidate list, not the flattened Npc. */
function activeGoalTag(game: Game, slotId: SelectableSlotId): string | undefined {
  const candidateId = game.cabinetSelections[slotId]
  return getCandidatesForSlot(slotId).find(c => c.candidateId === candidateId)?.goalTag
}

export function checkNpcInitiatives(game: Game): CrisisEvent | null {
  const neglected = getNeglectedPriorities(game)
  if (neglected.length > 0) {
    const cooldownKey = 'priority_neglect_nudge'
    if ((game.chainCooldowns[cooldownKey] ?? 0) <= game.currentMonth && Math.random() < 0.35) {
      const nudges = PERSONNEL_EVENTS.filter(e => e.personnelMeta?.tier === 'neglect')
      if (nudges.length > 0) return nudges[Math.floor(Math.random() * nudges.length)]
    }
  }

  // Base monthly odds that ANY initiative fires at all — kept low so this
  // reads as occasional, not a scene every single month.
  if (Math.random() > 0.3) return null

  const pool = PERSONNEL_EVENTS.filter(e =>
    (e.personnelMeta?.tier === 'request' || e.personnelMeta?.tier === 'conflict' || e.personnelMeta?.tier === 'room') &&
    e.npcId && isSelectableSlot(e.npcId)
  )

  const weighted: { event: CrisisEvent; weight: number }[] = []
  for (const event of pool) {
    const slotId = event.npcId as SelectableSlotId
    const traits = game.npcTraits[slotId]
    if (!traits) continue

    const cooldownKey = `initiative_${event.id}`
    if ((game.chainCooldowns[cooldownKey] ?? 0) > game.currentMonth) continue
    if (event.requires_flags?.some(f => !game.flags[f])) continue

    let weight = 1
    if (event.personnelMeta?.goalTag && event.personnelMeta.goalTag === activeGoalTag(game, slotId)) weight += 2
    if (event.personnelMeta?.traitTag) weight += traits[event.personnelMeta.traitTag] / 40

    weighted.push({ event, weight })
  }

  if (weighted.length === 0) return null

  const total = weighted.reduce((sum, w) => sum + w.weight, 0)
  let roll = Math.random() * total
  for (const w of weighted) {
    roll -= w.weight
    if (roll <= 0) return w.event
  }
  return weighted[weighted.length - 1].event
}

// ── Monthly orchestration — called once per advanceMonth by each turn-ending route ──
//
// Usage in a turn-ending route (turn/law/address-nation/personnel):
//   const roster = resolveRoster(game)
//   const driftedTraits = driftTraits(game)
//   const advance = advanceMonth(preDriftGame, extraConsequences, driftedTraits)
//   const { game: finalGame, suggestedEvent } = applyCabinetNarrative(game, advance.game, roster)
//   const nextEvent = suggestedEvent ?? (finalGame.status === 'ACTIVE' ? pickEvent(finalGame) : null)
//   // persist finalGame + currentEventId: nextEvent?.id ?? null

/**
 * Reveals any newly-crossed dossier observations (comparing traits before/
 * after this month's drift), then checks resignation risk (highest
 * priority) and ordinary initiatives against the POST-advance game (so
 * cooldown comparisons use the new currentMonth). Returns the game with
 * npcObservations/chainCooldowns merged in, plus the scene (if any) that
 * should override the ordinary pickEvent() result as next month's
 * pending event. Does not itself call advanceMonth or persist anything.
 */
export function applyCabinetNarrative(
  prevGame: Game,
  updatedGame: Game,
  roster: Npc[],
): { game: Game; suggestedEvent: CrisisEvent | null } {
  let npcObservations = updatedGame.npcObservations
  for (const slotId of SELECTABLE_SLOT_IDS) {
    const npc = roster.find(n => n.id === slotId)
    if (!npc) continue
    npcObservations = revealObservations(npcObservations, slotId, npc.shortName, prevGame.npcTraits[slotId], updatedGame.npcTraits[slotId])
  }

  const suggestedEvent = checkResignationRisk(updatedGame) ?? checkNpcInitiatives(updatedGame)

  const chainCooldowns = { ...updatedGame.chainCooldowns }
  if (suggestedEvent) {
    const isResignation = suggestedEvent.personnelMeta?.tier === 'resignation'
    const cooldownKey = isResignation ? `resignation_${suggestedEvent.npcId}` : `initiative_${suggestedEvent.id}`
    chainCooldowns[cooldownKey] = updatedGame.currentMonth + (isResignation ? 6 : 3)
  }

  return { game: { ...updatedGame, npcObservations, chainCooldowns }, suggestedEvent }
}

// ── Ambient tier — flavor only, no choices/consequences ──────

const AMBIENT_TEMPLATES: Array<(name: string) => string> = [
  name => `${name} met with congressional staff to discuss the coming month's agenda.`,
  name => `${name} toured a federal facility as part of a routine oversight visit.`,
  name => `${name} held a closed-door briefing with senior department staff.`,
  name => `${name} testified before a routine committee hearing.`,
]

export function pickAmbientHeadline(roster: Npc[]): Headline | null {
  if (Math.random() > 0.25) return null
  const eligible = roster.filter(n => n.faction === 'cabinet' || n.faction === 'inner_circle')
  if (eligible.length === 0) return null
  const npc = eligible[Math.floor(Math.random() * eligible.length)]
  const template = AMBIENT_TEMPLATES[Math.floor(Math.random() * AMBIENT_TEMPLATES.length)]
  return { text: template(npc.shortName), outlet: 'Capitol Wire', tone: 'neutral' }
}

// ── Mid-term fire/hire consequence ───────────────────────────

export interface CabinetChangeResult {
  game:            Game
  headline:        Headline
  effects:         StatDelta
  rippleReactions: NpcReactionResult[]
}

const FIREABLE_SLOT_IDS = SELECTABLE_SLOT_IDS.filter(id => id !== 'vice_president')

export function isFireableSlot(slotId: string): boolean {
  return (FIREABLE_SLOT_IDS as readonly string[]).includes(slotId)
}

/**
 * Applies a mid-term Cabinet change: a severity-scaled stat penalty
 * (firing a trusted ally costs more than firing someone already
 * estranged, but there's always some cost), a ripple relationship
 * penalty to other inner_circle/cabinet officials, a headline, and the
 * mechanical roster swap (via lib/cabinet.ts's hireCandidate). VP is
 * rejected — enforced here, not just hidden in the UI.
 */
export function applyCabinetChange(
  game: Game,
  roster: Npc[],
  slotId: SelectableSlotId,
  newCandidateId: string,
  resigned = false,
): CabinetChangeResult {
  // The Vice President can never be player-fired (real-life running-mate
  // status) but CAN resign on their own initiative — this only blocks the
  // player-initiated "Discuss -> Fire" path, not accepting a resignation.
  if (slotId === 'vice_president' && !resigned) {
    throw new Error('The Vice President cannot be replaced mid-term.')
  }

  const outgoing = roster.find(n => n.id === slotId)
  if (!outgoing) throw new Error(`No official currently in ${slotId}`)

  const relationship = game.npcRelationships[slotId] ?? outgoing.relationship.start
  const severity = relationshipSeverity(relationship, outgoing.relationship.min, outgoing.relationship.max)

  const effects: StatDelta = {
    approval:        -(2 + severity * 4),
    congressSupport: -(1 + severity * 3),
  }

  const rippleReactions: NpcReactionResult[] = []
  const npcRelationships = { ...game.npcRelationships }
  for (const npc of roster) {
    if (npc.id === slotId) continue
    if (npc.faction !== 'inner_circle' && npc.faction !== 'cabinet') continue

    const current = npcRelationships[npc.id] ?? npc.relationship.start
    const rippleDelta = -Math.round(2 + severity * 4)
    const next = Math.max(npc.relationship.min, Math.min(npc.relationship.max, current + rippleDelta))
    npcRelationships[npc.id] = next

    rippleReactions.push({
      npcId:             npc.id,
      npcName:           npc.name,
      shortName:         npc.shortName,
      quote:             resigned
        ? `Losing ${outgoing.shortName} like that — makes everyone in this building a little more nervous.`
        : `Watching ${outgoing.shortName} go makes you wonder who's next.`,
      relationshipDelta: rippleDelta,
      newRelationship:   next,
    })
  }

  let updatedGame: Game = { ...game, stats: applyDelta(game.stats, effects), npcRelationships }
  updatedGame = hireCandidate(updatedGame, slotId, newCandidateId)

  const headline = generateFiringHeadline(outgoing.role, resigned)

  return { game: updatedGame, headline, effects, rippleReactions }
}

// ── Personnel scene resolution — turn-free, used by app/api/game/[id]/personnel/route.ts ──

export interface PersonnelChoiceResult {
  game:         Game
  npcReactions: NpcReactionResult[]
}

/**
 * Resolves one choice on a personnel-category CrisisEvent — the
 * dialogue-scene equivalent of game-engine.ts's processChoice, but
 * deliberately NOT sharing that code path: personnel scenes never
 * advance currentMonth, never pick a next crisis event, and don't touch
 * conflict/milestone bookkeeping the way a crisis turn does. Applies
 * choice.effects (stats), sets_flags/removes_flags, and — when
 * event.npcId is set — a direct relationshipDelta and/or traitDeltas on
 * that one acting official, plus crossesBreakingPoint's permanent
 * {npcId}_broke_trust flag. delayed_effects still enqueue into
 * pendingConsequences so a "formal warning" can still cost you months
 * later if nothing changes.
 */
export function resolvePersonnelChoice(
  game: Game,
  event: CrisisEvent,
  choiceIndex: number,
  roster: Npc[],
): PersonnelChoiceResult {
  const choice = event.choices[choiceIndex]
  if (!choice) throw new Error(`Invalid choice index: ${choiceIndex}`)

  const newStats = applyDelta(game.stats, choice.effects)

  const newFlags = { ...game.flags }
  for (const f of event.sets_flags ?? [])    newFlags[f] = true
  for (const f of choice.sets_flags ?? [])   newFlags[f] = true
  for (const f of choice.removes_flags ?? []) delete newFlags[f]

  let npcRelationships = game.npcRelationships
  let npcTraits = game.npcTraits
  const npcReactions: NpcReactionResult[] = []

  if (event.npcId) {
    const npc = roster.find(n => n.id === event.npcId)
    if (npc) {
      if (choice.crossesBreakingPoint && isSelectableSlot(event.npcId)) {
        const candidateId = game.cabinetSelections[event.npcId]
        const candidate = getCandidatesForSlot(event.npcId).find(c => c.candidateId === candidateId)
        if (candidate?.breakingPointTag === choice.crossesBreakingPoint) {
          newFlags[`${event.npcId}_broke_trust`] = true
        }
      }

      // Choices that open the replacement picker (Fire / accept a
      // resignation) skip the relationship delta entirely — the whole
      // slot is about to be reseeded from the new candidate anyway.
      if (!choice.opensReplacementPicker && typeof choice.relationshipDelta === 'number') {
        const current = npcRelationships[event.npcId] ?? npc.relationship.start
        const next = Math.max(npc.relationship.min, Math.min(npc.relationship.max, current + choice.relationshipDelta))
        npcRelationships = { ...npcRelationships, [event.npcId]: next }
        npcReactions.push({
          npcId:             event.npcId,
          npcName:           npc.name,
          shortName:         npc.shortName,
          quote:             choice.outcome,
          relationshipDelta: choice.relationshipDelta,
          newRelationship:   next,
        })
      }

      if (choice.traitDeltas) {
        npcTraits = applyTraitDeltas(npcTraits, event.npcId, choice.traitDeltas)
      }
    }
  }

  const pendingConsequences = [
    ...game.pendingConsequences,
    ...(choice.delayed_effects ?? []).map((d, i) => ({
      id:           `${event.id}-choice${choiceIndex}-delay${i}-month${game.currentMonth}`,
      chain:        `${event.id}_choice${choiceIndex}`,
      fireAtMonth:  game.currentMonth + d.delay_months,
      effects:      d.effects,
      headlineText: d.headline,
    })),
  ]

  const updatedGame: Game = {
    ...game,
    stats: newStats,
    flags: newFlags,
    npcRelationships,
    npcTraits,
    pendingConsequences,
    updatedAt: new Date().toISOString(),
  }

  return { game: updatedGame, npcReactions }
}

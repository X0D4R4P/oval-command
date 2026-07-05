/**
 * Conflict lifecycle management.
 *
 * `game.activeConflicts[]` drives the monthly passive cost in
 * computePassiveDrift() — but nothing creates, escalates, or resolves
 * those objects on its own. This module is the single place that
 * translates event flags into actual conflict state changes.
 *
 * Pattern mirrors npc-triggers.ts: event/choice flags in, structured
 * game-state mutation out. Keeps game-engine.ts's processEventTurn()
 * from needing to know about conflict-specific flag names.
 */

import type { ActiveConflict, Game } from '@/types/game'

// Conflict region is inferred from which event triggered entry.
// Extend this map as new war-entry events are added. Audited against all
// 4 events that set a military-strike-style flag (china_taiwan_tension,
// russia_ukraine_escalation, embassy_attack, nuclear_iran) — only
// nuclear_iran's outcome text actually describes an ongoing multi-country
// retaliatory conflict rather than a one-time resolved strike or support
// for an existing ally's war. The other three are correctly NOT tracked
// as conflicts: they resolve within their own event text.
//
// `triggerFlag` is the specific flag that signals entry for THIS event —
// originally this was hardcoded to always check for 'at_war', which meant
// nuclear_iran's choice (which only ever sets 'iran_military') could never
// actually create a tracked conflict despite its outcome text describing
// an ongoing multi-country war.
const CONFLICT_ENTRY_EVENTS: Record<string, { region: string; level: ActiveConflict['level']; triggerFlag: string }> = {
  nato_ally_attacked: { region: 'NATO Ally', level: 4, triggerFlag: 'at_war' },         // choice 1 = full troop deployment
  nuclear_iran:        { region: 'Iran',       level: 3, triggerFlag: 'iran_military' }, // choice 0 = joint military strike
}

// Flags that escalate an existing conflict by one level
const ESCALATION_FLAGS = new Set([
  'ukraine_surge',
  'iran_military',
  'troops_deployed',
])

// Flags that de-escalate by one level (without fully ending it)
const DEESCALATION_FLAGS = new Set([
  'war_drawdown',
  'ceasefire_negotiations',
])

// Flags that end the conflict entirely (remove from activeConflicts).
// Deliberately does NOT include the generic-sounding "peace deal" flags set
// by historic_peace_deal / middle_east_normalization — those are standalone
// diplomacy flavor events about third-party or regional deals, not about
// ending the player's own tracked war, and were renamed to
// regional_peace_deal_signed after they were found to be wrongly clearing
// every active conflict whenever they fired mid-war.
const RESOLUTION_FLAGS = new Set([
  'war_ended',
  'war_victory',
  'war_defunded',
])

interface ConflictUpdateResult {
  activeConflicts: ActiveConflict[]
  changes: Array<{ type: 'entered' | 'escalated' | 'deescalated' | 'resolved'; region: string }>
}

/**
 * Apply this turn's flags against current conflicts.
 * Called once per turn from processEventTurn(), after flags are resolved.
 */
export function updateActiveConflicts(
  game: Game,
  eventId: string,
  choiceIndex: number,
  turnFlags: string[],
): ConflictUpdateResult {
  let conflicts = [...game.activeConflicts]
  const changes: ConflictUpdateResult['changes'] = []

  // ── New conflict entry ──────────────────────────────────
  const entry = CONFLICT_ENTRY_EVENTS[eventId]
  let justEnteredRegion: string | null = null
  if (entry && turnFlags.includes(entry.triggerFlag)) {
    const alreadyActive = conflicts.some(c => c.region === entry.region)
    if (!alreadyActive) {
      conflicts.push({
        region:       entry.region,
        level:        entry.level,
        monthStarted: game.currentMonth,
      })
      changes.push({ type: 'entered', region: entry.region })
      justEnteredRegion = entry.region
    }
  }

  // ── Escalation ───────────────────────────────────────────
  // Skip the conflict that was JUST entered this turn — its starting
  // level already reflects the choice that created it. Without this
  // check, an entry event whose trigger flag also appears in
  // ESCALATION_FLAGS (e.g. nuclear_iran sets 'iran_military', which is
  // both the entry trigger AND an escalation flag) would immediately
  // bump the brand-new conflict up a level in the same turn it started.
  const shouldEscalate = turnFlags.some(f => ESCALATION_FLAGS.has(f))
  if (shouldEscalate && conflicts.length > 0) {
    conflicts = conflicts.map(c => {
      if (c.region === justEnteredRegion) return c
      if (c.level < 4) {
        changes.push({ type: 'escalated', region: c.region })
        return { ...c, level: (c.level + 1) as ActiveConflict['level'] }
      }
      return c
    })
  }

  // ── De-escalation ────────────────────────────────────────
  const shouldDeescalate = turnFlags.some(f => DEESCALATION_FLAGS.has(f))
  if (shouldDeescalate && conflicts.length > 0) {
    conflicts = conflicts.map(c => {
      if (c.level > 1) {
        changes.push({ type: 'deescalated', region: c.region })
        return { ...c, level: (c.level - 1) as ActiveConflict['level'] }
      }
      return c
    })
  }

  // ── Resolution (remove entirely) ────────────────────────
  const shouldResolve = turnFlags.some(f => RESOLUTION_FLAGS.has(f))
  if (shouldResolve && conflicts.length > 0) {
    conflicts.forEach(c => changes.push({ type: 'resolved', region: c.region }))
    conflicts = []
  }

  return { activeConflicts: conflicts, changes }
}

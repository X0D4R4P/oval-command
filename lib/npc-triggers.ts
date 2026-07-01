/**
 * NPC relationship delta key resolution.
 *
 * NPC relationshipDeltas has three key types:
 *
 *  1. GAME FLAGS     — match game.flags directly (e.g. "troops_deployed", "scandal_resolved")
 *  2. COMPUTED CONDITIONS — derived from current stats (e.g. "approval_above_55", "debt_above_45t")
 *  3. ACTION LABELS  — set at turn-processing time based on what just happened (e.g. "bipartisan_bill_passed")
 *
 * This module resolves all three so the engine has one clean entry point.
 */

import type { Game, StatDelta } from '@/types/game'

// ── Computed stat conditions ────────────────────────────────

const COMPUTED_CONDITIONS: Record<string, (game: Game) => boolean> = {
  approval_above_55:          g => g.stats.approval > 55,
  approval_above_58:          g => g.stats.approval > 58,
  approval_above_60:          g => g.stats.approval > 60,
  approval_below_30:          g => g.stats.approval < 30,
  approval_below_35:          g => g.stats.approval < 35,
  // Rescaled to match the debt ceiling raise (55 -> 65) — keeps these
  // firing at the same proportional point in a presidency's debt trajectory.
  debt_above_45t:             g => g.stats.debt > 50,
  debt_above_50t:             g => g.stats.debt > 57,
  security_below_40:          g => g.stats.security < 40,
  global_reputation_above_70: g => g.stats.globalReputation > 70,
  budget_surplus_achieved:    g => g.stats.debt < 34,   // below starting debt
  // These require game-log analysis; approximate via flags
  recession_handled_well:     g => !!g.flags['recession_stimulus'] && g.stats.economy > 50,
  nato_ally_helped:           g => !!g.flags['military_aid_sent'] || !!g.flags['troops_deployed'],
  nato_honored:               g => !!g.flags['military_aid_sent'],
  debt_deal:                  g => !!g.flags['debt_deal'],
}

// ── Action label derivation from a just-processed turn ─────

export interface TurnContext {
  chosenEventCategory: string
  chosenEventId: string
  choiceIndex: number
  setsFlags: string[]
  statDeltas: StatDelta
  lawCategory?: 'progressive' | 'conservative' | 'bipartisan'
  lawPassed?: boolean
  scandalResolved?: boolean
  pressBriefingHeld?: boolean
  mediaIgnored?: boolean
  warEntryLevel?: number
  diplomaticResolution?: boolean
}

export function deriveTurnActionLabels(ctx: TurnContext): string[] {
  const labels: string[] = []

  // Bill labels
  if (ctx.lawPassed && ctx.lawCategory === 'bipartisan')    labels.push('bipartisan_bill_passed')
  if (ctx.lawPassed && ctx.lawCategory === 'progressive')   labels.push('progressive_bill_passed')
  if (ctx.lawPassed && ctx.lawCategory === 'conservative')  labels.push('conservative_bill_passed')
  if (ctx.lawPassed)                                        labels.push('passed_major_bill')

  // Scandal labels
  if (ctx.setsFlags.includes('scandal_resolved'))           labels.push('scandal_resolved_cooperate', 'scandal_resolved_fast')
  if (ctx.setsFlags.includes('active_scandal') && !ctx.setsFlags.includes('scandal_resolved')) {
    labels.push('scandal_covered_up', 'active_scandal_covered_up')
  }
  if (ctx.scandalResolved)                                  labels.push('scandal_resolved_fast')

  // Military / diplomatic
  if (ctx.warEntryLevel && ctx.warEntryLevel >= 4)          labels.push('at_war_decisive')
  if (ctx.setsFlags.includes('sanctions_war') ||
      ctx.setsFlags.includes('sanctions_regional') ||
      ctx.setsFlags.includes('sanctioned_foreign_power'))   labels.push('sanctions_imposed')
  if (ctx.setsFlags.includes('troops_deployed') ||
      ctx.setsFlags.includes('iran_military') ||
      ctx.setsFlags.includes('military_strike'))            labels.push('strong_military_response')
  if (ctx.diplomaticResolution)                             labels.push('diplomatic_resolution')
  if (ctx.setsFlags.includes('ukraine_ceasefire_talks') ||
      ctx.setsFlags.includes('nk_negotiations'))            labels.push('diplomatic_over_military')
  if (ctx.setsFlags.includes('g7_taiwan_coalition') ||
      ctx.setsFlags.includes('climate_leader'))             labels.push('multilateral_approach')
  if (ctx.setsFlags.includes('carrier_taiwan') ||
      ctx.setsFlags.includes('iran_military'))              labels.push('unilateral_military_action')

  // Media / press
  if (ctx.pressBriefingHeld)                               labels.push('press_conference_held')
  if (ctx.mediaIgnored)                                     labels.push('ignored_media_3mo')
  if (ctx.setsFlags.includes('shield_law'))                 labels.push('shield_law_passed')
  if (ctx.setsFlags.includes('whistleblower_attacked') ||
      ctx.chosenEventId === 'whistleblower_claim' && ctx.choiceIndex === 2) {
    labels.push('whistleblower_attacked')
  }

  // Other
  if (ctx.setsFlags.includes('fossil_fuel_expansion') ||
      ctx.setsFlags.includes('energy_independence_passed')) labels.push('trade_protectionism')
  if (ctx.setsFlags.includes('insurrection_act_invoked'))   labels.push('immigration_raid_defense')
  if (ctx.setsFlags.includes('climate_leader') ||
      ctx.setsFlags.includes('climate_legislation_passed')) labels.push('climate_agreement_rejected')  // inverse — others agreed
  if (ctx.setsFlags.includes('cyber_retaliation') ||
      ctx.setsFlags.includes('military_strike'))            labels.push('strong_military_response')
  if (ctx.setsFlags.includes('ukraine_surge'))              labels.push('strong_military_response')
  if (ctx.setsFlags.includes('asylum_reform') ||
      ctx.setsFlags.includes('refugees_accepted'))          labels.push('multilateral_approach')

  return [...new Set(labels)]  // dedupe
}

// ── Main resolver ───────────────────────────────────────────

/**
 * Given a set of trigger keys (game flags + action labels from current turn),
 * resolve which also apply as computed conditions against current game state.
 *
 * Returns the full resolved set of keys to match against NPC delta tables.
 */
/**
 * Resolve NPC trigger keys for this turn, given the PREVIOUS game state
 * (before this turn's flags/stats were applied) and the CURRENT game
 * state (after).
 *
 * Both computed conditions and persistent game flags are now
 * transition-gated: a key only counts if it's true now AND wasn't
 * already true last turn. Without this, any condition or flag that
 * stays true across many consecutive turns (e.g. approval staying above
 * 55, or 'at_war' persisting for the duration of a war arc) re-fired
 * its NPC relationship delta every single turn — verified this pinned
 * VP's relationship to its hard cap of 100 within 8 turns of sustained
 * approval, regardless of any specific decision made. Relationships
 * should react to NEWLY crossing a threshold, not restate "still true"
 * indefinitely.
 *
 * turnFlags/turnActionLabels (flags set or labels derived from THIS
 * turn's specific choice) are exempt from the transition gate — those
 * are inherently one-time events, not persistent state.
 */
export function resolveNpcTriggerKeys(
  previousGame: Game,
  currentGame: Game,
  turnFlags: string[],        // flags set this turn (always included — one-time)
  turnActionLabels: string[], // derived action labels this turn (always included — one-time)
): string[] {
  const keys = new Set<string>([...turnFlags, ...turnActionLabels])

  // Computed conditions: only include if newly true this turn
  for (const [condKey, fn] of Object.entries(COMPUTED_CONDITIONS)) {
    const wasTrue = fn(previousGame)
    const isTrue  = fn(currentGame)
    if (isTrue && !wasTrue) keys.add(condKey)
  }

  // Persistent game flags: only include if newly set this turn (wasn't
  // true in the previous state). A flag that's been true for 10 turns
  // straight (e.g. a long war) won't keep re-triggering every turn.
  for (const [flag, val] of Object.entries(currentGame.flags)) {
    if (!val) continue
    const wasSet = previousGame.flags[flag] === true
    if (!wasSet) keys.add(flag)
  }

  return [...keys]
}

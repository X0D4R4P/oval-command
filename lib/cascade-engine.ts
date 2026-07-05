/**
 * Cascade engine — second-order causality.
 *
 * Direct event effects (StatDelta on a choice) are first-order: you pick
 * an option, stats move immediately. That's most of the game's reactivity.
 *
 * This module adds second-order effects: a stat crossing a threshold THIS
 * turn doesn't just sit there — it seeds a PendingConsequence that fires
 * 1-3 turns later, which itself can move a different stat enough to seed
 * a further consequence. That's the "oil price -> inflation -> approval ->
 * congress" chain the design doc describes, implemented as deterministic
 * rules rather than free-text AI generation.
 *
 * COOLDOWN: a chain that has just fired goes on cooldown for several turns
 * before it's eligible to re-enqueue, even if the triggering condition is
 * still true. Without this, a single sustained bad stat (e.g. inflation
 * staying above 6 for 30+ turns) re-fires the same -4 approval penalty
 * every 2 turns indefinitely — compounding into a guaranteed loss
 * regardless of how well the player manages everything else. The cooldown
 * means a chain hurts you, then gives you room to recover or compensate
 * before it can hurt you again.
 *
 * Mechanically: `game.pendingConsequences[]` is a queue of {fireAtMonth,
 * sourceChain, effects, headline}. `game.chainCooldowns` (a map of chain
 * id -> month it becomes eligible again) prevents re-enqueueing too soon
 * after a chain last fired.
 */

import type { Game, GameStats, StatDelta, PendingConsequence } from '@/types/game'
import type { Headline } from '@/lib/headlines'

// ============================================================
// THRESHOLD WATCHERS — decide what gets enqueued this turn
// ============================================================

interface ChainRule {
  chain: string
  /** Should this chain fire, given current stats? */
  condition: (stats: GameStats) => boolean
  /** How many turns until the consequence lands */
  delayMonths: number
  /** How many turns after firing before this chain is eligible to re-trigger */
  cooldownMonths: number
  /** Effect applied when the consequence fires */
  effects: StatDelta
  headlineText: string
}

const CHAIN_RULES: ChainRule[] = [
  {
    chain: 'inflation_approval_spiral',
    condition: stats => stats.inflation > 6,
    delayMonths: 2,
    cooldownMonths: 4,
    effects: { approval: -4, congressSupport: -3 },
    headlineText: 'Sustained inflation continues to erode public confidence in the administration',
  },
  {
    chain: 'recession_unemployment_lag',
    condition: stats => stats.economy < 35,
    delayMonths: 2,
    cooldownMonths: 4,
    effects: { unemployment: 0.8, approval: -3, unrest: 4 },
    headlineText: 'New unemployment claims surge as economic weakness works through the labor market',
  },
  {
    chain: 'unrest_congress_chill',
    condition: stats => stats.unrest > 55,
    delayMonths: 2,
    cooldownMonths: 4,
    effects: { congressSupport: -5, partyUnity: -3 },
    headlineText: 'Lawmakers grow wary of association with administration amid sustained unrest',
  },
  {
    chain: 'reputation_security_drift',
    condition: stats => stats.globalReputation < 35,
    delayMonths: 3,
    cooldownMonths: 5,
    effects: { security: -4, militaryReadiness: -3 },
    headlineText: 'Allied intelligence-sharing quietly scales back amid strained relations',
  },
  {
    chain: 'debt_credit_pressure',
    // Rescaled from 48 to 55 to match the debt ceiling raise (55 -> 65).
    // Keeps this chain firing at the same proportional danger zone.
    condition: stats => stats.debt > 55,
    delayMonths: 3,
    cooldownMonths: 5,
    effects: { debt: 0.6, economy: -3 },
    headlineText: 'Rating agencies signal concern over rising debt servicing costs',
  },
  {
    chain: 'approval_base_erosion',
    condition: stats => stats.approval < 30,
    delayMonths: 2,
    cooldownMonths: 4,
    effects: { baseSupport: -6 },
    headlineText: 'Even core supporters express growing doubts about the administration\u2019s direction',
  },
  {
    chain: 'economy_approval_lift',
    condition: stats => stats.economy > 70,
    delayMonths: 2,
    cooldownMonths: 4,
    effects: { approval: 4, baseSupport: 3 },
    headlineText: 'Voters increasingly feel the benefits of sustained economic strength',
  },
  {
    // High sustained inflation triggers labor unrest — workers demand higher
    // wages, supply chains slow, strikes spread. This is the "inflation →
    // labor strikes" link the design called for.
    chain: 'inflation_labor_unrest',
    condition: stats => stats.inflation > 7,
    delayMonths: 3,
    cooldownMonths: 5,
    effects: { unrest: 8, economy: -3, unemployment: 0.4 },
    headlineText: 'Labor unions announce strike actions as real wages fall behind rising prices',
  },
  {
    // Low global reputation creates an energy price spike — adversaries
    // and OPEC-aligned nations feel emboldened to cut supply when American
    // standing is weak. Models the "international instability → energy
    // prices → inflation" link the design doc describes.
    chain: 'reputation_energy_spike',
    condition: stats => stats.globalReputation < 30,
    delayMonths: 4,
    cooldownMonths: 6,
    effects: { inflation: 1.5, economy: -4, approval: -3 },
    headlineText: 'Energy exporters tighten supply amid diminished US diplomatic leverage — prices spike',
  },
  {
    // Late-term party fatigue — the longer a party governs, the more
    // internal factions emerge. After sustained party unity below 45,
    // members start positioning for the post-administration era.
    chain: 'party_fatigue',
    condition: stats => stats.partyUnity < 45,
    delayMonths: 2,
    cooldownMonths: 5,
    effects: { congressSupport: -6, baseSupport: -4 },
    headlineText: 'Party insiders signal growing frustration with administration direction ahead of next cycle',
  },
]

/**
 * Check current stats against all chain rules. For any that match, aren't
 * already pending (by chain id), and aren't on cooldown from a recent
 * firing, enqueue a new pending consequence.
 */
export function checkAndEnqueueChains(
  game: Game,
  pending: PendingConsequence[],
  cooldowns: Record<string, number> = {},
): PendingConsequence[] {
  const alreadyQueued = new Set(pending.map(p => p.chain))
  const next = [...pending]

  for (const rule of CHAIN_RULES) {
    if (alreadyQueued.has(rule.chain)) continue
    if (!rule.condition(game.stats)) continue

    const cooldownUntil = cooldowns[rule.chain] ?? 0
    if (game.currentMonth < cooldownUntil) continue

    next.push({
      id:           `${rule.chain}-${game.currentMonth}`,
      chain:        rule.chain,
      fireAtMonth:  game.currentMonth + rule.delayMonths,
      effects:      rule.effects,
      headlineText: rule.headlineText,
    })
  }

  return next
}

/**
 * Pop any consequences due this month, returning their combined effects,
 * headlines, the remaining (still-pending) queue, and any new cooldowns
 * to merge into game.chainCooldowns so the same chain can't immediately
 * re-enqueue if its triggering condition is still true.
 */
export function resolveDueConsequences(
  pending: PendingConsequence[],
  currentMonth: number,
): {
  effects: StatDelta
  headlines: Headline[]
  remaining: PendingConsequence[]
  newCooldowns: Record<string, number>
} {
  const due = pending.filter(p => p.fireAtMonth <= currentMonth)
  const remaining = pending.filter(p => p.fireAtMonth > currentMonth)

  const effects: StatDelta = {}
  const headlines: Headline[] = []
  const newCooldowns: Record<string, number> = {}

  for (const consequence of due) {
    for (const [key, value] of Object.entries(consequence.effects) as [keyof StatDelta, number][]) {
      effects[key] = ((effects[key] ?? 0) as number) + value
    }
    headlines.push({
      text:   consequence.headlineText,
      outlet: 'Capitol Wire',
      tone:   'neutral',
    })

    const rule = CHAIN_RULES.find(r => r.chain === consequence.chain)
    const cooldownMonths = rule?.cooldownMonths ?? 4
    newCooldowns[consequence.chain] = currentMonth + cooldownMonths
  }

  return { effects, headlines, remaining, newCooldowns }
}

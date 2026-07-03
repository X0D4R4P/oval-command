import {
  INITIAL_STATS,
  STAT_LIMITS,
  PARTY_STAT_MODS,
  type Game,
  type GameStats,
  type StatDelta,
  type CrisisEvent,
  type EventCategory,
  type EventChoice,
  type Law,
  type Npc,
  type TurnResult,
  type NpcReactionResult,
  type LegacyScore,
  type GameOverReason,
  type Party,
} from '@/types/game'

import eventsRaw from '@/data/events.json'
import { resolveNpcTriggerKeys, deriveTurnActionLabels } from '@/lib/npc-triggers'
import { updateActiveConflicts } from '@/lib/conflict-engine'
import { generateCrisisHeadline, maybeApprovalTrendHeadline } from '@/lib/headlines'
import { checkAndEnqueueChains, resolveDueConsequences } from '@/lib/cascade-engine'
import { checkNpcMilestones } from '@/lib/npc-milestones'
import lawsRaw   from '@/data/laws.json'
import npcsRaw   from '@/data/npcs.json'

// Cast once at the boundary — all internal code uses proper types
export const EVENTS = eventsRaw as unknown as CrisisEvent[]
export const LAWS   = lawsRaw   as unknown as Law[]
export const NPCS   = npcsRaw   as unknown as Npc[]

// ============================================================
// STAT HELPERS
// ============================================================

export function clampStat(key: keyof GameStats, value: number): number {
  const { min, max } = STAT_LIMITS[key]
  return Math.max(min, Math.min(max, value))
}

/**
 * Diminishing returns on stat changes.
 *
 * The higher a stat already is, the harder it is to push further — and the
 * harder you fall from a high position. This prevents stats from plateauing
 * at maximum early and keeps the late game feeling precarious rather than
 * solved.
 *
 * For GAINS (value > 0, on stats where higher = better):
 *   0–60:  full value (1.0×)
 *   60–80: 50% (0.5×)
 *   80–90: 25% (0.25×)
 *   90+:   10% (0.1×)
 *
 * For LOSSES (value < 0, on stats where higher = better):
 *   "The higher you climb, the harder you fall" — losses above 80 are
 *   amplified 1.5× because high-approval presidents have more to lose
 *   and voters hold them to a higher standard.
 *
 * Inverted stats (debt, unrest, unemployment, inflation) get mirrored
 * treatment: it's hard to push debt DOWN from a low level (already good),
 * and hard to push it UP from already extreme levels (hitting headwinds).
 */
function applyDiminishingReturns(current: number, delta: number, key: keyof GameStats): number {
  if (delta === 0) return delta

  // Stats where higher is BAD — skip diminishing returns (they don't have a
  // "good ceiling" to protect; the cascade/game-over system handles extremes)
  const invertedStats = new Set<keyof GameStats>(['debt', 'unrest', 'unemployment', 'inflation'])
  if (invertedStats.has(key)) return delta

  // Stats with tiny natural ranges — don't distort them
  if (key === 'mediaScore') return delta

  if (delta > 0) {
    // Gains get diminished the higher the stat already is
    if (current >= 90) return delta * 0.10
    if (current >= 80) return delta * 0.25
    if (current >= 60) return delta * 0.50
    return delta
  } else {
    // Losses are amplified when you're already high — more to lose.
    // Tuned to be meaningful but not punishing: 1.25x above 80, 1.5x above 90.
    if (current >= 90) return delta * 1.5
    if (current >= 80) return delta * 1.25
    return delta
  }
}

export function applyDelta(stats: GameStats, delta: StatDelta): GameStats {
  const next = { ...stats }
  for (const [key, value] of Object.entries(delta) as [keyof GameStats, number][]) {
    if (!value) continue
    const current = next[key] as number
    const scaled = applyDiminishingReturns(current, value, key)
    next[key] = clampStat(key, current + scaled) as never
  }
  return next
}

/** Hostile media cuts approval gains; amplifying media boosts them */
function applyMediaMultiplier(delta: StatDelta, mediaScore: number): StatDelta {
  if (!delta.approval || mediaScore === 0) return delta
  const multiplier = mediaScore > 0
    ? 1 + mediaScore * 0.15   // up to +30%
    : 1 + mediaScore * 0.20   // down to -40%
  return { ...delta, approval: Math.round(delta.approval * multiplier) }
}

/** Unrest > 60 doubles any negative approval effects */
function applyUnrestAmplifier(delta: StatDelta, unrest: number): StatDelta {
  if (!delta.approval || delta.approval >= 0 || unrest < 60) return delta
  return { ...delta, approval: Math.round(delta.approval * 2) }
}

/**
 * Policy pressure — large gains in one stat create cross-pressure in
 * related stats. This ensures no choice is a pure "all upside" win,
 * making tradeoffs feel real rather than theoretical.
 *
 * Pressure only kicks in for significant moves (> 6 pts) so small
 * tweaks aren't distorted. The penalty is small but real — enough to
 * make the player pause rather than always picking the highest-approval
 * option.
 *
 * Examples:
 * - Big approval gain → slight debt increase (populist spending)
 * - Big economy gain → slight unrest increase (growth disrupts workers)
 * - Big security gain → slight global reputation loss (militarism signal)
 * - Big debt reduction → slight approval loss (austerity is unpopular)
 */
function applyPolicyPressure(delta: StatDelta): StatDelta {
  const result = { ...delta }

  if ((delta.approval ?? 0) > 8) {
    // Popularity has a cost — either spending or inequality pressure
    result.debt = (result.debt ?? 0) + 0.12
  }
  if ((delta.economy ?? 0) > 8) {
    // Strong growth can increase inequality and displacement
    result.unrest = (result.unrest ?? 0) + 1.2
  }
  if ((delta.security ?? 0) > 8) {
    // Aggressive security posture signals to allies and rivals alike
    result.globalReputation = (result.globalReputation ?? 0) - 2
  }
  if ((delta.debt ?? 0) < -0.5) {
    // Real austerity always costs politically
    result.approval = (result.approval ?? 0) - 2
  }
  if ((delta.unrest ?? 0) < -8) {
    // Suppressing unrest often requires spending or security tradeoffs
    result.debt = (result.debt ?? 0) + 0.08
  }

  return result
}

/**
 * Military-category event choices that move security also nudge military
 */
function applyMilitaryReadinessCoupling(delta: StatDelta, category: EventCategory): StatDelta {
  if (category !== 'military' || !delta.security || delta.militaryReadiness !== undefined) {
    return delta
  }
  const coupled = Math.round(delta.security * 0.5)
  if (coupled === 0) return delta
  return { ...delta, militaryReadiness: coupled }
}

// ============================================================
// PASSIVE DRIFT — applied every turn end
// ============================================================

export function computePassiveDrift(game: Game): StatDelta {
  const { stats, activeConflicts, activeScandals, passedLaws } = game
  const drift: StatDelta = {}

  const add = (k: keyof StatDelta, v: number) => {
    drift[k] = ((drift[k] ?? 0) as number) + v
  }

  // Baseline debt growth (~$80B/month). Lowered from $150B/month — at the
  // original rate, combined with the average event choice already adding
  // ~$360B/month, the expected debt trajectory for an AVERAGE (not even
  // unlucky) player crossed the collapse ceiling well before month 48.
  // Verified via 100-trial simulation: 76% of random playthroughs ended
  // in DEBT_COLLAPSE, averaging month 30. This wasn't "hard," it was a
  // near-guaranteed structural failure mode regardless of skill.
  add('debt', 0.08)

  // Economy mean-reverts toward 50
  if (stats.economy > 50) add('economy', -0.5)
  else if (stats.economy < 50) add('economy', 0.5)

  // Media sentiment drifts toward favorable/hostile based on sustained
  // approval level — this was previously a fully dead stat: initialized
  // to 0, read by applyMediaMultiplier() to scale approval gains/losses,
  // but never written by ANY event, law, or drift rule anywhere in the
  // codebase, making the entire "hostile press cuts your gains" mechanic
  // permanently inert. Slow drift (max ±0.15/month) keeps it a lagging
  // indicator of sustained performance rather than a noisy swing stat.
  if (stats.approval >= 65 && stats.mediaScore < 2) add('mediaScore', 0.15)
  else if (stats.approval <= 35 && stats.mediaScore > -2) add('mediaScore', -0.15)
  else if (stats.approval > 45 && stats.approval < 55 && stats.mediaScore !== 0) {
    // Approval near baseline pulls media sentiment back toward neutral
    add('mediaScore', stats.mediaScore > 0 ? -0.1 : 0.1)
  }

  // Military readiness decays slowly without active investment. Lowered
  // from -1 to -0.5/month — at -1 with zero ways to ever increase it
  // except this one passive law effect, readiness was a guaranteed
  // countdown to 0 by month 65 regardless of play. At -0.5, the
  // military_spending law's new +3/mo passive effect is a genuine
  // offsetting lever rather than a token gesture.
  add('militaryReadiness', -0.5)

  // Inflation drains approval
  if (stats.inflation > 5) add('approval', -2)
  else if (stats.inflation > 3) add('approval', -1)

  // Economy-approval passive link
  if (stats.economy > 75) add('approval', 1)
  if (stats.economy < 30) add('approval', -2)

  // Active conflict monthly costs
  const conflictCosts: Record<number, StatDelta> = {
    1: { debt: 0.1 },
    2: { debt: 0.3, approval: -1 },
    3: { debt: 0.8, approval: -2, unrest: 2 },
    4: { debt: 2.0, approval: -3, unrest: 4 },
  }
  for (const conflict of activeConflicts) {
    const cost = conflictCosts[conflict.level] ?? {}
    for (const [k, v] of Object.entries(cost)) {
      add(k as keyof StatDelta, v as number)
    }
  }

  // Scandal passive approval drain with dynamic expectations.
  //
  // The public holds high-approval presidents to a higher standard —
  // the same scandal costs more when you're riding high than when
  // you're already struggling. A president at 80% loses more from
  // a leak than a president at 30%, because voters feel more betrayed.
  // Conversely, a struggling president at 25% loses less per scandal
  // because expectations are already on the floor.
  //
  // Base drain: 2 per active scandal, capped at 8 total.
  // Expectation multiplier: 0.6× below 30, 1× at 45–65, 1.8× above 75.
  if (activeScandals > 0) {
    const baseDrain = Math.min(8, activeScandals * 2)
    const expectationMultiplier =
      stats.approval >= 75 ? 1.8 :
      stats.approval >= 65 ? 1.4 :
      stats.approval >= 45 ? 1.0 :
      stats.approval >= 30 ? 0.8 :
      0.6
    add('approval', -(baseDrain * expectationMultiplier))
  }

  // Passive effects from passed laws
  for (const lawId of passedLaws) {
    const law = LAWS.find(l => l.id === lawId)
    if (!law?.effects.passive) continue
    for (const [k, v] of Object.entries(law.effects.passive)) {
      add(k as keyof StatDelta, v as number)
    }
  }

  return drift
}

// ============================================================
// EVENT PICKER — weighted, flag-aware, stat-gated
// ============================================================

/**
 * Is this specific event currently eligible given the game's state?
 * Extracted from pickEvent() so the turn API route can validate that a
 * client-submitted eventId was actually something the player could
 * legitimately have been shown — without this, a modified client request
 * could fire any of the 82 events regardless of month/stat/flag gates,
 * including rare ones (assassination_attempt, weight 3) or narrowly-
 * windowed ones (midterm_results, months 24-26 only) on any turn.
 */
export function isEventEligible(event: CrisisEvent, game: Game, opts: { ignoreRecentBlock?: boolean } = {}): boolean {
  const { stats, flags, usedEvents, currentMonth } = game

  // Historical events are one-time narrative moments — firing the Cuban Missile
  // Crisis twice in a single presidency breaks immersion. Regular events can
  // repeat (with a cooldown); historical ones never do.
  if (event.isHistorical && usedEvents.includes(event.id)) return false

  if (!opts.ignoreRecentBlock) {
    const recentBlock = usedEvents.length >= EVENTS.length * 0.8 ? 4 : 8
    if (usedEvents.slice(-recentBlock).includes(event.id)) return false
  }

  if (event.requires_flags?.some(f => !flags[f])) return false

  const t = event.triggers

  // Boolean flag gates ALWAYS apply, even on always_available events.
  // This used to be skipped entirely when always_available was true
  // (the `if (t.always_available) return true` below ran before this
  // check), which meant an event like "pandemic_outbreak" with trigger
  // `{ always_available: true, pandemic_active: false }` could still
  // fire repeatedly even after a pandemic was already active — verified
  // via 200-trial simulation, 27.5% of games saw the pandemic-origin
  // event fire 2-3 times in a single playthrough. always_available is
  // meant to mean "no month/stat scheduling restriction," not "ignore
  // every other condition including explicit flag gates."
  for (const [key, val] of Object.entries(t)) {
    if (typeof val === 'boolean' && key !== 'always_available') {
      if (val && !flags[key]) return false
      if (!val && flags[key]) return false
    }
  }

  if (t.always_available) return true

  if (t.month) {
    if (t.month.min !== undefined && currentMonth < t.month.min) return false
    if (t.month.max !== undefined && currentMonth > t.month.max) return false
  }

  const statGates = ['approval', 'economy', 'security', 'unrest', 'debt', 'baseSupport', 'globalReputation'] as const
  for (const key of statGates) {
    const gate = t[key] as { min?: number; max?: number } | undefined
    if (!gate) continue
    const val = stats[key as keyof GameStats] as number
    if (gate.min !== undefined && val < gate.min) return false
    if (gate.max !== undefined && val > gate.max) return false
  }

  return true
}

// Rare, low-weight events double as "this is a big deal" narratively — weight
// is otherwise used only for random-selection odds in weightedRandom() below.
// Reused by the room-nav shell and CrisisCard to flag "breaking" events.
export const BREAKING_EVENT_WEIGHT_THRESHOLD = 3

export function isBreakingEvent(event: CrisisEvent): boolean {
  return event.weight <= BREAKING_EVENT_WEIGHT_THRESHOLD
}

/** First callback whose flag is set, or null. Render-time only — no state mutation. */
export function getEventCallback(event: CrisisEvent, flags: Record<string, boolean>): string | null {
  const match = event.callbacks?.find(c => flags[c.flag])
  return match?.text ?? null
}

export function pickEvent(game: Game): CrisisEvent | null {
  const eligible = EVENTS.filter(event => isEventEligible(event, game))

  if (eligible.length === 0) {
    // Fallback: any always_available event not used in last 4 turns
    const fallback = EVENTS.filter(
      e => e.triggers.always_available && !game.usedEvents.slice(-4).includes(e.id)
    )
    return fallback.length ? weightedRandom(fallback) : EVENTS[0]
  }

  return weightedRandom(eligible)
}

function weightedRandom(events: CrisisEvent[]): CrisisEvent {
  const total = events.reduce((sum, e) => sum + (e.weight ?? 5), 0)
  let rand = Math.random() * total
  for (const event of events) {
    rand -= event.weight ?? 5
    if (rand <= 0) return event
  }
  return events[events.length - 1]
}

// ============================================================
// CHOICE PROCESSOR
// ============================================================

export function processChoice(
  game: Game,
  event: CrisisEvent,
  choiceIndex: number
): { newStats: GameStats; newFlags: Record<string, boolean>; scandalDelta: number; choice: EventChoice } {
  const choice = event.choices[choiceIndex]
  if (!choice) throw new Error(`Invalid choice index: ${choiceIndex}`)

  let delta = applyMediaMultiplier(choice.effects, game.stats.mediaScore)
  delta = applyUnrestAmplifier(delta, game.stats.unrest)
  delta = applyMilitaryReadinessCoupling(delta, event.category)
  delta = applyPolicyPressure(delta)

  const newStats = applyDelta(game.stats, delta)

  const newFlags = { ...game.flags }
  for (const f of event.sets_flags ?? [])   newFlags[f] = true
  for (const f of choice.sets_flags ?? [])  newFlags[f] = true
  for (const f of choice.removes_flags ?? []) delete newFlags[f]

  // activeScandals tracks the `active_scandal` boolean flag's transitions
  // rather than being its own independently-mutated counter. This is the
  // single source of truth: the flag goes true -> scandal opens (+1),
  // true -> false -> scandal resolves (-1). Previously this counter was
  // never written anywhere, so the approval drain and legacy-score
  // penalty that read it were permanently dead code.
  const wasActive = game.flags['active_scandal'] === true
  const isActive  = newFlags['active_scandal'] === true
  const scandalDelta = isActive && !wasActive ? 1 : !isActive && wasActive ? -1 : 0

  return { newStats, newFlags, scandalDelta, choice }
}

// ============================================================
// NPC REACTIONS
// ============================================================

type DialogueTier = 'high' | 'medium' | 'low' | 'critical'

function getDialogueTier(val: number): DialogueTier {
  if (val >= 70) return 'high'
  if (val >= 45) return 'medium'
  if (val >= 25) return 'low'
  return 'critical'
}

export function processNpcReactions(
  game: Game,
  triggerKeys: string[]
): { reactions: NpcReactionResult[]; newRelationships: Record<string, number> } {
  const relationships = { ...game.npcRelationships }

  // Seed any missing NPC relationships from their defaults
  for (const npc of NPCS) {
    if (relationships[npc.id] === undefined) {
      relationships[npc.id] = npc.relationship.start
    }
  }

  const reactions: NpcReactionResult[] = []

  // Only NPCs with a relevant delta react this turn (cap at 3)
  const reacting = NPCS
    .filter(npc => triggerKeys.some(k => npc.relationshipDeltas[k] !== undefined))
    .slice(0, 3)

  for (const npc of reacting) {
    const totalDelta = triggerKeys.reduce(
      (sum, k) => sum + (npc.relationshipDeltas[k] ?? 0),
      0
    )
    if (totalDelta === 0) continue

    const current = relationships[npc.id]
    const next = Math.max(npc.relationship.min, Math.min(npc.relationship.max, current + totalDelta))
    relationships[npc.id] = next

    const tier = getDialogueTier(next)
    const lines = npc.monthlyDialogue[tier]
    const quote = lines[Math.floor(Math.random() * lines.length)]

    reactions.push({
      npcId:             npc.id,
      npcName:           npc.name,
      shortName:         npc.shortName,
      quote,
      relationshipDelta: totalDelta,
      newRelationship:   next,
    })
  }

  return { reactions, newRelationships: relationships }
}

// ============================================================
// GAME OVER CHECK
// ============================================================

export function checkGameOver(game: Game): GameOverReason | null {
  if (game.stats.approval  <   10) return 'IMPEACHMENT'
  // Debt ceiling raised from 55 to 65. At 55 against a starting 35.2 and
  // an average event-driven debt delta of +0.36/turn, the margin for
  // error was too thin — see baseline drift comment above for the full
  // simulation data. 65 gives a genuinely strong player room to recover
  // from a bad stretch without making debt management irrelevant.
  if (game.stats.debt      >   65) return 'DEBT_COLLAPSE'
  if (game.stats.security  <=   0) return 'SECURITY_FAILURE'
  if (game.stats.unrest    >= 100) return 'CONSTITUTIONAL_CRISIS'
  if (game.currentMonth    >=  48) return 'TERM_COMPLETE'
  return null
}

// ============================================================
// LEGACY SCORE
// ============================================================

export function computeLegacyScore(game: Game): LegacyScore {
  const { stats, passedLaws, activeScandals, activeConflicts } = game

  const approvalPts    = Math.round(stats.approval         * 0.40)
  const economyPts     = Math.round(stats.economy          * 0.30)
  const securityPts    = Math.round(stats.security         * 0.15)
  const reputationPts  = Math.round(stats.globalReputation * 0.10)
  const lawPts         = Math.min(10, passedLaws.length * 1.5)
  // Scandal penalty — capped, not a flat uncapped multiply. The first
  // few scandals each cost a full 5 points; beyond that, diminishing
  // returns so a presidency that weathered many scandals isn't
  // mathematically guaranteed a near-zero score regardless of everything
  // else it accomplished.
  const scandalDeduct = Math.min(25, activeScandals * 5)
  const warDeduct      = activeConflicts.filter(c => c.level >= 4).length * 8

  const total = Math.max(0, Math.min(100,
    approvalPts + economyPts + securityPts + reputationPts +
    lawPts - scandalDeduct - warDeduct
  ))

  const rawVote    = 45 + (stats.approval - 50) * 0.4 + (stats.economy - 50) * 0.2
  const votePercent = Math.max(30, Math.min(70, Math.round(rawVote)))

  const verdicts = [
    { min: 80, text: "A historic presidency. You'll stand alongside Lincoln and FDR in the history books." },
    { min: 65, text: "A strong term. The country is meaningfully better than you found it." },
    { min: 50, text: "A solid presidency. Significant accomplishments, significant missed opportunities." },
    { min: 35, text: "A controversial term. History will debate your decisions for decades." },
    { min: 20, text: "A difficult presidency. The country struggled and voters noticed." },
    { min: 0,  text: "One of the least popular presidents in American history. The party distanced itself from your legacy." },
  ]
  const verdict = verdicts.find(v => total >= v.min)?.text ?? verdicts[verdicts.length - 1].text

  return {
    total,
    breakdown: {
      approval:         approvalPts,
      economy:          economyPts,
      security:         securityPts,
      globalReputation: reputationPts,
      scandalsDeducted: scandalDeduct,
      lawsPassed:       Math.round(lawPts),
      warConduct:       warDeduct,
    },
    verdict,
    reelected:   votePercent >= 50,
    votePercent,
  }
}

// ============================================================
// LAW PASSAGE PROBABILITY
// ============================================================

export function computePassProbability(law: Law, game: Game): number {
  let prob = law.passage.basePassProbability

  // Congress score vs threshold — symmetric cap on both sides so being
  // far below the threshold doesn't spiral the formula to a guaranteed
  // zero. A below-threshold bill is hard, not mathematically impossible.
  const congressGap = game.stats.congressSupport - law.passage.congressMin
  prob += congressGap < 0
    ? Math.max(-25, congressGap * 1.2)   // capped steep penalty below threshold
    : Math.min(15, congressGap * 0.5)    // capped bonus above threshold

  // Party unity — symmetric with the congress treatment: penalty below
  // threshold, modest bonus above. Previously this only ever penalized,
  // which meant strong unity could never help offset a tough bill.
  const unityGap = game.stats.partyUnity - law.passage.partyUnityMin
  prob += unityGap < 0
    ? Math.max(-15, unityGap * 0.6)
    : Math.min(10, unityGap * 0.3)

  // Approval — gradient instead of a hard cliff. Distance from each
  // threshold scales the bonus/penalty smoothly rather than an all-or-
  // nothing step, so 59 vs 60 approval doesn't swing by 15 points.
  const { threshold: bonusThreshold, bonus } = law.passage.approvalBonus
  const { threshold: penaltyThreshold, penalty } = law.passage.approvalPenalty
  if (game.stats.approval >= bonusThreshold) {
    const over = game.stats.approval - bonusThreshold
    prob += Math.min(bonus, bonus * 0.5 + over * 0.3)
  } else if (game.stats.approval <= penaltyThreshold) {
    const under = penaltyThreshold - game.stats.approval
    prob -= Math.min(penalty, penalty * 0.5 + under * 0.3)
  }

  // Lobby opposition — diminishing returns instead of flat stacking.
  // First lobby costs full penalty; each additional lobby costs less,
  // so well-organized opposition is a real obstacle without making
  // multi-lobby bills mathematically dead on arrival.
  const sortedLobbies = [...law.passage.lobbyOpposition].sort((a, b) => b.penalty - a.penalty)
  sortedLobbies.forEach((lobby, i) => {
    const diminishing = i === 0 ? 1 : 1 / (i + 1)
    prob -= lobby.penalty * diminishing
  })

  // Blocking laws already passed
  if (law.blocks_laws.some(id => game.passedLaws.includes(id))) prob = 0

  // Required flags missing
  if (law.requires_flags.some(f => !game.flags[f])) prob = 0

  // Floor of 5% (not 0%) for laws that aren't outright blocked — a
  // President can always *try*, even against terrible odds. Floor of 0%
  // is reserved for actually-blocked/missing-flag laws above.
  const floor = prob <= 0 && !law.blocks_laws.some(id => game.passedLaws.includes(id)) && !law.requires_flags.some(f => !game.flags[f])
    ? 5
    : 0

  return Math.max(floor, Math.min(95, Math.round(prob)))
}

export function rollLawPassage(probability: number): boolean {
  return Math.random() * 100 < probability
}

// ============================================================
// FULL TURN PROCESSOR
// ============================================================

export function processEventTurn(
  game: Game,
  eventId: string,
  choiceIndex: number
): TurnResult {
  const event = EVENTS.find(e => e.id === eventId)
  if (!event) throw new Error(`Event not found: ${eventId}`)

  const { newStats, newFlags, scandalDelta, choice } = processChoice(game, event, choiceIndex)
  const newActiveScandals = Math.max(0, game.activeScandals + scandalDelta)

  // Derive action labels from what just happened
  const actionLabels = deriveTurnActionLabels({
    chosenEventCategory: event.category,
    chosenEventId:       eventId,
    choiceIndex,
    setsFlags:           [...(event.sets_flags ?? []), ...(choice.sets_flags ?? [])],
    statDeltas:          choice.effects,
  })

  // Resolve all NPC trigger keys: game flags + computed conditions + action labels.
  // Pass BOTH previous (game) and current (post-choice) state so the
  // transition-gating in resolveNpcTriggerKeys can tell "newly true" from
  // "still true from before."
  const triggerKeys = resolveNpcTriggerKeys(
    game,
    { ...game, stats: newStats, flags: newFlags },
    [...(event.sets_flags ?? []), ...(choice.sets_flags ?? [])],
    actionLabels
  )

  const { reactions, newRelationships } = processNpcReactions(
    { ...game, stats: newStats, flags: newFlags },
    triggerKeys
  )

  // One-time flags for relationships that just crossed into the ally or
  // estranged tier this turn — computed from the pre/post relationship
  // values, not part of any earlier this-turn NPC-reaction resolution.
  const milestoneFlags = checkNpcMilestones(NPCS, game.npcRelationships, newRelationships, newFlags)

  // Resolve conflict lifecycle (entry/escalation/de-escalation/resolution)
  // BEFORE computing passive drift, since drift's war-cost loop reads activeConflicts.
  const turnFlags = [...(event.sets_flags ?? []), ...(choice.sets_flags ?? [])]
  const { activeConflicts: nextConflicts } = updateActiveConflicts(
    game,
    eventId,
    choiceIndex,
    turnFlags,
  )

  const drift = computePassiveDrift({
    ...game,
    stats:            newStats,
    flags:            newFlags,
    npcRelationships: newRelationships,
    activeConflicts:  nextConflicts,
    activeScandals:   newActiveScandals,
  })

  // Resolve any cascade consequences that are due THIS turn (seeded by a
  // prior turn's threshold crossing), then check current stats to seed
  // any NEW chains for future turns. Cooldowns prevent the same chain
  // from re-enqueuing immediately if its triggering condition persists.
  const nextMonthNumber = game.currentMonth + 1
  const { effects: cascadeEffects, headlines: cascadeHeadlines, remaining, newCooldowns } =
    resolveDueConsequences(game.pendingConsequences, nextMonthNumber)

  const combinedDrift: StatDelta = { ...drift }
  for (const [k, v] of Object.entries(cascadeEffects) as [keyof StatDelta, number][]) {
    combinedDrift[k] = ((combinedDrift[k] ?? 0) as number) + v
  }

  const driftedStats = applyDelta(newStats, combinedDrift)

  const updatedCooldowns = { ...game.chainCooldowns, ...newCooldowns }

  // Merge choice-level delayed effects (e.g. "cut regulations now, pay later")
  // with the threshold-triggered cascade chains already in the queue.
  const choiceDelayedConsequences: import('@/lib/cascade-engine').PendingConsequence[] =
    (choice.delayed_effects ?? []).map((d, i) => ({
      id:           `${event.id}-choice${choiceIndex}-delay${i}-month${game.currentMonth}`,
      chain:        `${event.id}_choice${choiceIndex}`,
      fireAtMonth:  nextMonthNumber + d.delay_months - 1,
      effects:      d.effects,
      headlineText: d.headline,
    }))

  const newPendingConsequences = checkAndEnqueueChains(
    { ...game, stats: driftedStats, currentMonth: nextMonthNumber },
    [...remaining, ...choiceDelayedConsequences],
    updatedCooldowns,
  )

  const updatedGame: Game = {
    ...game,
    stats:               driftedStats,
    flags:               { ...newFlags, ...milestoneFlags },
    npcRelationships:    newRelationships,
    activeConflicts:     nextConflicts,
    activeScandals:      newActiveScandals,
    pendingConsequences: newPendingConsequences,
    chainCooldowns:      updatedCooldowns,
    usedEvents:          [...game.usedEvents, eventId],
    currentMonth:        nextMonthNumber,
    approvalHistory:     [...game.approvalHistory, Math.round(driftedStats.approval)],
    updatedAt:           new Date().toISOString(),
  }

  const gameOver = checkGameOver(updatedGame)

  if (gameOver) {
    updatedGame.status = gameOver === 'TERM_COMPLETE' ? 'COMPLETE' : 'GAMEOVER'
    updatedGame.legacyScore = computeLegacyScore(updatedGame).total
  }

  // Headlines: one from the crisis category/effects, plus an optional
  // approval-trend headline if approval moved sharply this turn.
  const headlines = [
    generateCrisisHeadline(event.category, choice.effects),
    ...cascadeHeadlines,
  ]
  const trendHeadline = maybeApprovalTrendHeadline(game.stats.approval, driftedStats.approval)
  if (trendHeadline) headlines.push(trendHeadline)

  return {
    updatedGame,
    log: {
      gameId:      game.id,
      month:       game.currentMonth,
      actionType:  'CRISIS',
      eventId,
      choiceIndex,
      statDeltas:  choice.effects,
      narrative:   choice.outcome,
    },
    npcReactions: reactions,
    driftApplied: drift,
    headlines,
    gameOver:     gameOver ?? undefined,
  }
}

// ============================================================
// INITIAL GAME FACTORY
// ============================================================

/**
 * Difficulty modifiers applied on top of the base + party stats.
 *
 * Design principle: difficulty should increase *governing challenge* —
 * harder political environment, weaker starting position, less room for
 * error — not simply shift debt to a level that makes collapse inevitable
 * regardless of skill. A skilled player on Expert should be able to
 * survive, but it should require deliberate, careful play.
 *
 * Easy:   You inherit a country in decent shape. Forgiving entry.
 * Normal: Balanced — designed for a player who's played once or twice.
 * Hard:   You're starting with opposition headwinds and an overheated economy.
 * Expert: Deep in the hole on day one. Requires active debt management to survive.
 */
const DIFFICULTY_MODS: Record<import('@/types/game').Difficulty, Partial<GameStats>> = {
  easy:   { approval: 8,  congressSupport: 8,   debt: -3, unrest: -8, baseSupport: 5, partyUnity: 8  },
  normal: {},
  hard:   { approval: -8, congressSupport: -10,  debt: 3,  unrest: 12, globalReputation: -8,  partyUnity: -8  },
  expert: { approval: -14, congressSupport: -16, debt: 5,  unrest: 20, globalReputation: -14, partyUnity: -14 },
}

export function createInitialGame(
  userId: string,
  presidentName: string,
  party: Party,
  difficulty: import('@/types/game').Difficulty = 'normal'
): Omit<Game, 'id' | 'createdAt' | 'updatedAt'> {
  const npcRelationships: Record<string, number> = Object.fromEntries(
    NPCS.map(npc => [npc.id, npc.relationship.start])
  )

  const diffMods = DIFFICULTY_MODS[difficulty] ?? {}
  const baseStats: GameStats = { ...INITIAL_STATS, ...(PARTY_STAT_MODS[party] ?? {}) }

  // Apply difficulty modifiers and clamp to valid ranges
  const stats = applyDelta(baseStats, diffMods)

  return {
    userId,
    presidentName,
    party,
    difficulty,
    currentMonth:     1,
    status:           'ACTIVE',
    stats,
    flags:            {},
    activeConflicts:  [],
    activeScandals:   0,
    pendingConsequences: [],
    chainCooldowns:   {},
    npcRelationships,
    usedNpcAbilities: [],
    passedLaws:       [],
    usedEvents:       [],
    approvalHistory:  [stats.approval],
    legacyScore:      undefined,
  }
}

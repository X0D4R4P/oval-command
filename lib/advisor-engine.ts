/**
 * Advisor system.
 *
 * Solves the "I don't know what to do next" problem common to political
 * sims (Democracy 4, Suzerain, etc.) by surfacing 2-4 concrete, prioritized
 * recommendations every turn, each voiced by the cabinet member who would
 * plausibly raise it. Pure rules-based analysis against the actual fixed
 * thresholds in game-engine.ts — no recommendation here references a
 * stat/threshold that isn't real and currently reachable.
 *
 * Severity tiers:
 *   critical — game-over adjacent (e.g. debt within striking distance of
 *              the 65 collapse ceiling). Always shown first.
 *   warning  — heading toward trouble but not urgent yet.
 *   opportunity — a currently-strong position worth capitalizing on
 *              (e.g. high congress support → good moment to push a hard bill).
 */

import { LAWS, NPCS, computePassProbability } from '@/lib/game-engine'
import type { Game } from '@/types/game'

export type AdvisorSeverity = 'critical' | 'warning' | 'opportunity'

export interface AdvisorRecommendation {
  id:          string   // stable id so the UI can dedupe/key reliably
  npcId:       string
  npcName:     string
  severity:    AdvisorSeverity
  headline:    string   // short, e.g. "Debt is approaching crisis levels"
  detail:      string   // the advisor's actual voiced recommendation
  suggestedAction?: {
    type: 'propose_law'
    lawId: string
    lawTitle: string
  }
}

interface Rule {
  id: string
  npcId: string
  severity: AdvisorSeverity
  condition: (game: Game) => boolean
  build: (game: Game) => Omit<AdvisorRecommendation, 'id' | 'npcId' | 'npcName' | 'severity'>
}

// ============================================================
// RULES — each checks real, current engine thresholds
// ============================================================

const RULES: Rule[] = [
  // ── CRITICAL: game-over adjacent ──────────────────────────
  {
    id: 'debt_critical',
    npcId: 'treasury_secretary',
    severity: 'critical',
    condition: g => g.stats.debt > 58, // collapse is at 65 — this is the real final-warning zone
    build: g => ({
      headline: 'Debt is approaching crisis levels',
      detail: `We're at $${g.stats.debt.toFixed(1)}T. The collapse threshold is $65T. If we don't act, this ends the presidency — not metaphorically.`,
      suggestedAction: pickDebtReducingLaw(g),
    }),
  },
  {
    id: 'approval_critical',
    npcId: 'chief_of_staff',
    severity: 'critical',
    condition: g => g.stats.approval < 25, // impeachment floor is 10, warn with real time to act
    build: g => ({
      headline: 'Approval is in the danger zone',
      detail: `${Math.round(g.stats.approval)}% approval. Below 10%, Congress moves on impeachment. We need a real win, not another press release.`,
    }),
  },
  {
    id: 'unrest_critical',
    npcId: 'attorney_general',
    severity: 'critical',
    condition: g => g.stats.unrest > 88, // constitutional crisis is at 100
    build: g => ({
      headline: 'Civil unrest is nearing a constitutional crisis',
      detail: `Unrest is at ${Math.round(g.stats.unrest)}. At 100, this becomes a constitutional crisis. Whatever the underlying grievance is, it needs an actual answer, not another statement.`,
    }),
  },
  {
    id: 'security_critical',
    npcId: 'sec_defense',
    severity: 'critical',
    condition: g => g.stats.security < 12,
    build: g => ({
      headline: 'National security is critically low',
      detail: `Security is at ${Math.round(g.stats.security)}. We're exposed. I'd recommend the defense bill on your desk, Mr./Madam President — it's not enough on its own, but it's a start.`,
      suggestedAction: { type: 'propose_law', lawId: 'military_spending', lawTitle: 'National Defense Authorization and Modernization Act' },
    }),
  },

  // ── WARNING: heading toward trouble ───────────────────────
  {
    id: 'debt_warning',
    npcId: 'treasury_secretary',
    severity: 'warning',
    condition: g => g.stats.debt > 48 && g.stats.debt <= 58,
    build: g => ({
      headline: 'Debt trajectory needs attention',
      detail: `We're at $${g.stats.debt.toFixed(1)}T and trending up. Not an emergency yet, but I'd rather flag it now than when it's a crisis.`,
      suggestedAction: pickDebtReducingLaw(g),
    }),
  },
  {
    id: 'inflation_warning',
    npcId: 'treasury_secretary',
    severity: 'warning',
    condition: g => g.stats.inflation > 6,
    build: g => ({
      headline: 'Inflation is running hot',
      detail: `${g.stats.inflation.toFixed(1)}% inflation is eating into approval whether we address it or not. Sustained, it'll keep compounding against us.`,
    }),
  },
  {
    id: 'unrest_warning',
    npcId: 'protest_leader',
    severity: 'warning',
    condition: g => g.stats.unrest > 50 && g.stats.unrest <= 88,
    build: g => ({
      headline: 'Communities are losing patience',
      detail: `Unrest at ${Math.round(g.stats.unrest)} isn't nothing. People are organizing. A real policy response would go a lot further than another statement of concern.`,
      suggestedAction: pickUnrestReducingLaw(g),
    }),
  },
  {
    id: 'congress_warning',
    npcId: 'speaker',
    severity: 'warning',
    condition: g => g.stats.congressSupport < 35,
    build: g => ({
      headline: 'Your legislative agenda is stalling',
      detail: `Congress support is at ${Math.round(g.stats.congressSupport)}. Most of what's on your wishlist won't pass like this. Worth investing in relationships before pushing anything ambitious.`,
    }),
  },
  {
    id: 'security_warning',
    npcId: 'sec_defense',
    severity: 'warning',
    condition: g => g.stats.security >= 12 && g.stats.security < 35,
    build: g => ({
      headline: 'Military readiness is slipping',
      detail: `Security is at ${Math.round(g.stats.security)}, and readiness decays on its own without investment. I wouldn't wait for a crisis to find out we let this go too far.`,
    }),
  },
  {
    id: 'active_scandal_warning',
    npcId: 'attorney_general',
    severity: 'warning',
    condition: g => g.flags['active_scandal'] === true,
    build: () => ({
      headline: 'An unresolved scandal is still draining approval',
      detail: `Every month this stays open, it costs us. The longer we wait, the worse the eventual story gets. I'd rather we get ahead of it.`,
    }),
  },
  {
    id: 'baseSupport_warning',
    npcId: 'vice_president',
    severity: 'warning',
    condition: g => g.stats.baseSupport < 35,
    build: g => ({
      headline: 'The base is drifting',
      detail: `Base support is at ${Math.round(g.stats.baseSupport)}. I'm hearing real frustration from people who used to be reliable. Worth a course correction before a primary challenger smells blood.`,
    }),
  },
  {
    id: 'media_hostile_warning',
    npcId: 'media_anchor',
    severity: 'warning',
    condition: g => g.stats.mediaScore <= -1,
    build: () => ({
      headline: 'Press coverage has turned hostile',
      detail: `Coverage has been rough lately, and it's amplifying every misstep. A real interview — not a podium statement — would help more than you'd think.`,
    }),
  },

  // ── OPPORTUNITY: capitalize on strength ───────────────────
  {
    id: 'congress_opportunity',
    npcId: 'senate_leader',
    severity: 'opportunity',
    condition: g => g.stats.congressSupport > 65 && g.stats.approval > 55,
    build: g => ({
      headline: 'This is a strong window to pass something ambitious',
      detail: `Congress support at ${Math.round(g.stats.congressSupport)} and approval at ${Math.round(g.stats.approval)} — this won't last forever. If there's a hard bill you've been sitting on, now's the time.`,
      suggestedAction: pickHardestPassableLaw(g),
    }),
  },
  {
    id: 'economy_opportunity',
    npcId: 'treasury_secretary',
    severity: 'opportunity',
    condition: g => g.stats.economy > 70 && g.stats.approval < 80,
    build: () => ({
      headline: 'The economy is strong — time to spend that capital',
      detail: `We're in a good stretch. This kind of economic strength won't last forever. Use it to push something ambitious before the window closes.`,
    }),
  },
  {
    id: 'reputation_opportunity',
    npcId: 'foreign_ally',
    severity: 'opportunity',
    condition: g => g.stats.globalReputation > 70 && g.passedLaws.filter(id => id.includes('treaty') || id.includes('trade')).length === 0,
    build: () => ({
      headline: 'Allies are receptive — a diplomatic push could pay off',
      detail: `Our standing is strong. If there's a multilateral initiative worth pursuing, the goodwill is there right now.`,
    }),
  },
  {
    // Only fires once — when congress first becomes favorable and no laws passed
    id: 'legislative_window_opportunity',
    npcId: 'senate_leader',
    severity: 'opportunity',
    condition: g => g.stats.congressSupport > 58 && g.passedLaws.length === 0 && g.currentMonth > 4,
    build: g => ({
      headline: 'Legislative window is open — use it',
      detail: `Congress is favorable right now at ${Math.round(g.stats.congressSupport)}%. That won't last forever and this is exactly when we should be moving legislation, not waiting.`,
      suggestedAction: pickEasiestPassableLaw(g),
    }),
  },
  {
    // Fires when congress is highly favorable AND high approval — push something hard
    id: 'congress_opportunity',
    npcId: 'senate_leader',
    severity: 'opportunity',
    condition: g => g.stats.congressSupport > 65 && g.stats.approval > 58 && g.passedLaws.length < 3,
    build: g => ({
      headline: 'This is a strong window to pass something ambitious',
      detail: `Congress support at ${Math.round(g.stats.congressSupport)} and approval at ${Math.round(g.stats.approval)} — this combination doesn't come around often. If there's a hard bill you've been sitting on, now's the time.`,
      suggestedAction: pickHardestPassableLaw(g),
    }),
  },
]

// ============================================================
// LAW SUGGESTION HELPERS
// ============================================================

function pickDebtReducingLaw(game: Game) {
  const candidates = LAWS.filter(l =>
    !game.passedLaws.includes(l.id) &&
    (l.effects.passive?.debt ?? 0) < 0 &&
    !l.blocks_laws.some(id => game.passedLaws.includes(id))
  )
  if (candidates.length === 0) return undefined
  const best = candidates.reduce((a, b) =>
    (a.effects.passive?.debt ?? 0) < (b.effects.passive?.debt ?? 0) ? a : b
  )
  return { type: 'propose_law' as const, lawId: best.id, lawTitle: best.title }
}

function pickUnrestReducingLaw(game: Game) {
  const candidates = LAWS.filter(l =>
    !game.passedLaws.includes(l.id) &&
    ((l.effects.onPass.unrest ?? 0) < 0 || (l.effects.passive?.unrest ?? 0) < 0) &&
    !l.blocks_laws.some(id => game.passedLaws.includes(id))
  )
  if (candidates.length === 0) return undefined
  const best = candidates.reduce((a, b) => {
    const aTotal = (a.effects.onPass.unrest ?? 0) + (a.effects.passive?.unrest ?? 0)
    const bTotal = (b.effects.onPass.unrest ?? 0) + (b.effects.passive?.unrest ?? 0)
    return aTotal < bTotal ? a : b
  })
  return { type: 'propose_law' as const, lawId: best.id, lawTitle: best.title }
}

function pickHardestPassableLaw(game: Game) {
  const candidates = LAWS
    .filter(l => !game.passedLaws.includes(l.id) && !l.blocks_laws.some(id => game.passedLaws.includes(id)))
    .map(l => ({ law: l, prob: computePassProbability(l, game) }))
    .filter(x => x.prob >= 40) // genuinely passable, not a coin flip
  if (candidates.length === 0) return undefined
  const hardest = candidates.reduce((a, b) => a.law.passage.congressMin > b.law.passage.congressMin ? a : b)
  return { type: 'propose_law' as const, lawId: hardest.law.id, lawTitle: hardest.law.title }
}

function pickEasiestPassableLaw(game: Game) {
  const candidates = LAWS
    .filter(l => !game.passedLaws.includes(l.id))
    .map(l => ({ law: l, prob: computePassProbability(l, game) }))
  if (candidates.length === 0) return undefined
  const easiest = candidates.reduce((a, b) => a.prob > b.prob ? a : b)
  return { type: 'propose_law' as const, lawId: easiest.law.id, lawTitle: easiest.law.title }
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

const SEVERITY_ORDER: Record<AdvisorSeverity, number> = { critical: 0, warning: 1, opportunity: 2 }

/**
 * Returns the top N advisor recommendations for the current game state,
 * sorted critical-first. Capped to avoid overwhelming the player — this
 * is meant to be a short, scannable briefing, not an exhaustive report.
 */
export function getAdvisorRecommendations(game: Game, limit = 4): AdvisorRecommendation[] {
  const matched = RULES.filter(r => r.condition(game))

  const recommendations = matched.map(rule => {
    const npc = NPCS.find(n => n.id === rule.npcId)
    const built = rule.build(game)
    return {
      id:       rule.id,
      npcId:    rule.npcId,
      npcName:  npc?.shortName ?? rule.npcId,
      severity: rule.severity,
      ...built,
    }
  })

  recommendations.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  // Deduplicate by NPC — the panel should feel like a conversation with
  // different people, not the same advisor raising multiple concerns. Keep
  // whichever of their recommendations is highest-priority (first after sort).
  const seenNpcs = new Set<string>()
  const deduplicated = recommendations.filter(r => {
    if (seenNpcs.has(r.npcId)) return false
    seenNpcs.add(r.npcId)
    return true
  })

  return deduplicated.slice(0, limit)
}

/** Convenience: is there at least one critical issue right now? */
export function hasCriticalAdvisory(game: Game): boolean {
  return RULES.some(r => r.severity === 'critical' && r.condition(game))
}

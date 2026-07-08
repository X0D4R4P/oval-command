/**
 * Annual "State of the Union" summary — a per-year recap derived entirely
 * from data already persisted (GameLog.statDeltas, Game.npcRelationships),
 * the same reconstruct-on-read approach as lib/stat-trends.ts. No new
 * persisted history.
 */

import { EVENTS, LAWS, getDialogueTier } from '@/lib/game-engine'
import { resolveRoster } from '@/lib/cabinet'
import { computeStatTrend } from '@/lib/stat-trends'
import { hashSeed } from '@/lib/utils'
import type { Game, GameLog } from '@/types/game'

const ACTION_LABEL: Record<string, string> = {
  CRISIS: 'Decision',
  LAW_PROPOSED: 'Bill Proposed',
  LAW_PASSED: 'Bill Passed',
  LAW_FAILED: 'Bill Failed',
  BUDGET: 'Budget',
  EXECUTIVE_ORDER: 'Executive Order',
  PRESS_CONFERENCE: 'Press Conference',
  DIPLOMATIC_VISIT: 'Diplomatic Visit',
  TURN_END: 'Turn End',
}

export interface YearInReviewMoment {
  title: string
  month: number
  approvalDelta: number
}

export interface YearInReviewAdvisor {
  npcName: string
  npcShortName: string
  quote: string
}

export interface YearInReview {
  year: number
  startMonth: number
  endMonth: number
  approvalStart: number
  approvalEnd: number
  economyStart: number
  economyEnd: number
  biggestSuccess: YearInReviewMoment | null
  biggestFailure: YearInReviewMoment | null
  advisor: YearInReviewAdvisor | null
  yearAhead: string[]
}

function titleForLog(log: GameLog): string {
  const event = log.eventId ? EVENTS.find(e => e.id === log.eventId) : undefined
  const law = log.lawId ? LAWS.find(l => l.id === log.lawId) : undefined
  return event?.title ?? law?.title ?? ACTION_LABEL[log.actionType] ?? log.actionType
}

function computeYearAhead(game: Game): string[] {
  const { stats } = game
  const bullets: string[] = []

  if (stats.inflation >= 4) bullets.push('Inflation remains a concern heading into next year.')
  if (stats.unrest >= 40) bullets.push('Civil unrest is running high — expect continued unrest next year.')
  if (stats.debt >= 50) bullets.push('National debt is approaching worrying levels.')
  if (stats.economy >= 75) bullets.push('The economy is running hot — a strong tailwind heading into next year.')
  if (stats.approval < 35) bullets.push("Approval is fragile — next year's agenda carries real risk.")
  if (stats.globalReputation < 35) bullets.push('Standing abroad has eroded — allies are watching closely.')
  if (stats.congressSupport < 35) bullets.push('Congress is unlikely to be an easy partner next year.')

  if (bullets.length === 0) {
    bullets.push('The administration enters the new year on stable footing.')
  }

  return bullets.slice(0, 3)
}

/**
 * @param allLogsAsc Every GameLog row for this game (not just the year in
 *   question), chronological (oldest first). Reconstructing a stat's value
 *   at a past year's boundary requires walking backward from the CURRENT
 *   value through every log since then, not just that year's own logs —
 *   otherwise re-deriving an earlier year's review after the game has
 *   moved on (or finished) would silently use today's value as if it were
 *   that year's. Only approval has a persisted history (Game.approvalHistory);
 *   economy and everything else must be reconstructed this way, same
 *   technique as lib/stat-trends.ts.
 */
export function computeYearInReview(game: Game, allLogsAsc: GameLog[], year: number): YearInReview {
  const roster = resolveRoster(game)
  const startMonth = (year - 1) * 12 + 1
  const endMonth = year * 12
  const yearLogs = allLogsAsc.filter(l => l.month >= startMonth && l.month <= endMonth)
  const logsDesc = [...allLogsAsc].reverse()

  // points[k] = the stat's value immediately after month k (points[0] is
  // the pre-game baseline) — index into it at the year's boundaries rather
  // than relying on the trend's own start/end, since logsDesc now spans
  // the whole game, not just this year.
  const approvalTrend = computeStatTrend(game.stats.approval, logsDesc, 'approval')
  const economyTrend  = computeStatTrend(game.stats.economy,  logsDesc, 'economy')

  let biggestSuccess: YearInReviewMoment | null = null
  let biggestFailure: YearInReviewMoment | null = null
  for (const log of yearLogs) {
    const delta = log.statDeltas.approval ?? 0
    if (delta === 0) continue
    if (!biggestSuccess || delta > biggestSuccess.approvalDelta) {
      biggestSuccess = { title: titleForLog(log), month: log.month, approvalDelta: delta }
    }
    if (!biggestFailure || delta < biggestFailure.approvalDelta) {
      biggestFailure = { title: titleForLog(log), month: log.month, approvalDelta: delta }
    }
  }
  // A single-direction year (nothing but gains, or nothing but losses)
  // shouldn't show the same event twice as both its highlight and lowlight.
  if (biggestSuccess && biggestFailure && biggestSuccess.month === biggestFailure.month) {
    if (biggestSuccess.approvalDelta >= 0) biggestFailure = null
    else biggestSuccess = null
  }

  const npcEntries = Object.entries(game.npcRelationships)
  let advisor: YearInReviewAdvisor | null = null
  if (npcEntries.length > 0) {
    const [topNpcId, topRelationship] = npcEntries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))
    const npc = roster.find(n => n.id === topNpcId)
    if (npc) {
      const tier = getDialogueTier(topRelationship)
      const lines = npc.monthlyDialogue[tier]
      const quote = lines[hashSeed(game.id, String(year)) % lines.length]
      advisor = { npcName: npc.name, npcShortName: npc.shortName, quote }
    }
  }

  // points[k] holds the value right after month k (points[0] = pre-game
  // baseline), so the end of `year` is points[endMonth] and its start is
  // points[startMonth - 1] — the value carried over from the prior year.
  const pointAt = (points: number[], month: number) => points[Math.min(month, points.length - 1)]

  return {
    year,
    startMonth,
    endMonth,
    approvalStart: Math.round(pointAt(approvalTrend.points, startMonth - 1)),
    approvalEnd:   Math.round(pointAt(approvalTrend.points, endMonth)),
    economyStart:  Math.round(pointAt(economyTrend.points, startMonth - 1)),
    economyEnd:    Math.round(pointAt(economyTrend.points, endMonth)),
    biggestSuccess,
    biggestFailure,
    advisor,
    // Reflects the game's current stats — meaningful when called at the
    // live year boundary (this year just ended); a future re-derivation
    // of a past year's review would need that year's own stat snapshot,
    // which only approval/economy above reconstruct.
    yearAhead: computeYearAhead(game),
  }
}

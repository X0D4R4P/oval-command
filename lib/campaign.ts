/**
 * The campaign, election night, and inauguration — the beat before a term
 * starts. Three short campaign-trail choices feed a small starting-stat
 * bonus (same clamping pipeline as difficulty mods and perks), then an
 * election-night result is revealed before the oath of office.
 *
 * The player wins the overwhelming majority of the time — computeElectionResult
 * mostly varies HOW big the win was — but there's a ~2% easter-egg chance
 * of a genuine loss, surfaced via its own concession-night screen with a
 * reroll rather than a real game-over (see NewGameForm's "Try Again").
 */

import type { StatDelta, Difficulty } from '@/types/game'
import { hashSeed } from '@/lib/utils'

export interface CampaignOption {
  id: string
  label: string
  effects: StatDelta
}

export interface CampaignScenario {
  id: string
  prompt: string
  flavor: string
  options: CampaignOption[]
}

export const CAMPAIGN_SCENARIOS: CampaignScenario[] = [
  {
    id: 'final_debate',
    prompt: 'The Final Debate',
    flavor: 'Three nights before the vote, sixty million people are watching. Whatever happens here is the last impression most of them get.',
    options: [
      { id: 'debate_attack', label: "Go on the attack — hit your opponent's record hard", effects: { approval: 3, partyUnity: -2, baseSupport: 2 } },
      { id: 'debate_policy', label: 'Stay disciplined — pivot every answer back to your plan', effects: { congressSupport: 2, partyUnity: 2 } },
      { id: 'debate_trust', label: 'Make it personal — tell them this election is about trust', effects: { approval: 1, baseSupport: 3, globalReputation: -1 } },
    ],
  },
  {
    id: 'last_stop',
    prompt: 'The Last Campaign Stop',
    flavor: 'One day left. The plane can only go one place before the polls open.',
    options: [
      { id: 'stop_base', label: 'Barnstorm the industrial Midwest — shore up the base', effects: { baseSupport: 3, partyUnity: 1 } },
      { id: 'stop_suburbs', label: 'Court the suburbs with a message of unity', effects: { approval: 2, congressSupport: 1 } },
      { id: 'stop_congress', label: 'Skip the rally — lock in commitments from wavering members of Congress', effects: { congressSupport: 3 } },
    ],
  },
  {
    id: 'victory_speech',
    prompt: 'The Victory Speech',
    flavor: 'The networks have called it. The crowd is waiting for you to walk out and say something that will outlive the night.',
    options: [
      { id: 'speech_mandate', label: 'Declare a mandate for bold, sweeping change', effects: { approval: 3, partyUnity: -1 } },
      { id: 'speech_unity', label: 'Promise to be a president for every American, not just those who voted for you', effects: { globalReputation: 2, baseSupport: -1 } },
      { id: 'speech_brief', label: 'Keep it brief — thank the country, promise to get to work', effects: { congressSupport: 1, approval: 1 } },
    ],
  },
]

/**
 * Resolve a set of client-chosen option ids into the real StatDelta bonus
 * — always re-derived from CAMPAIGN_SCENARIOS server-side, never trusting
 * a raw delta from the client. Unrecognized ids are silently ignored; if
 * more than one option from the same scenario is submitted, the first
 * match wins. Both are safe no-ops, not validation failures — this is a
 * small flavor bonus, not a security boundary worth hard-rejecting over.
 */
export function resolveCampaignChoices(choiceIds: string[]): StatDelta {
  const bonus: StatDelta = {}
  for (const scenario of CAMPAIGN_SCENARIOS) {
    const option = scenario.options.find(o => choiceIds.includes(o.id))
    if (!option) continue
    for (const [key, value] of Object.entries(option.effects) as [keyof StatDelta, number][]) {
      bonus[key] = ((bonus[key] ?? 0) as number) + value
    }
  }
  return bonus
}

export interface ElectionResult {
  won:          boolean
  votePercent:  number
  marginLabel:  string
  narrative:    string
}

// Harder modes start from a slimmer mandate — same "headwinds from day
// one" idea difficulty mods already apply to starting stats.
const DIFFICULTY_MARGIN_PENALTY: Record<Difficulty, number> = {
  easy: 4, normal: 0, hard: -4, expert: -8,
}

// Easter egg, not a real difficulty lever — deliberately independent of
// difficulty/campaign choices so it can't be farmed or avoided, just an
// occasional surprise. 1-in-50 (2%).
const LOSS_CHANCE_DENOMINATOR = 50

/**
 * A deterministic-but-flavorful vote share for election night — same
 * precedent as IntelligenceBriefing's confidence %: seeded pseudo-
 * randomness via hashSeed(), not a real statistical simulation. Almost
 * always a win (floors at 50%); the rare loss branch uses its own hash
 * bucket (a different salt) so it's an independent roll from the win
 * margin, not correlated with how well the campaign went.
 */
export function computeElectionResult(seed: string, difficulty: Difficulty, campaignBonus: StatDelta): ElectionResult {
  if (hashSeed(seed, 'loss-roll') % LOSS_CHANCE_DENOMINATOR === 0) {
    const votePercent = 44 + (hashSeed(seed, 'loss-margin') % 5) // 44–48%, a real if narrow loss
    return {
      won: false,
      votePercent,
      marginLabel: 'Conceded the Race',
      narrative: "The math never got there. Not every campaign ends in the Oval Office — this one ends in a ballroom that's already half empty.",
    }
  }

  const base = 50 + (hashSeed(seed) % 13) // 50–62 deterministic base spread
  const campaignSwing = Math.round(
    Object.values(campaignBonus).reduce((sum: number, v) => sum + (v ?? 0), 0) * 0.4
  )
  const votePercent = Math.max(50, Math.min(68, base + DIFFICULTY_MARGIN_PENALTY[difficulty] + campaignSwing))

  if (votePercent >= 60) {
    return {
      won: true,
      votePercent,
      marginLabel: 'Landslide Victory',
      narrative: 'The networks called it before midnight. A mandate, unmistakably.',
    }
  }
  if (votePercent >= 54) {
    return {
      won: true,
      votePercent,
      marginLabel: 'Comfortable Majority',
      narrative: 'A clear win — enough to govern, not enough to silence the opposition.',
    }
  }
  return {
    won: true,
    votePercent,
    marginLabel: 'Razor-Thin Mandate',
    narrative: 'It came down to the final precincts. You won — barely. Everyone remembers that.',
  }
}

/**
 * The campaign, election night, and inauguration — the beat before a term
 * starts. Six short campaign-trail choices, in rough chronological order
 * (running mate through victory speech), feed a small starting-stat bonus
 * (same clamping pipeline as difficulty mods and perks), then an
 * election-night result is revealed before the oath of office.
 *
 * The player wins the overwhelming majority of the time — computeElectionResult
 * mostly varies HOW big the win was — but there's a ~0.5% easter-egg chance
 * of a genuine loss, surfaced via its own concession-night screen with a
 * reroll rather than a real game-over (see NewGameForm's "Try Again").
 */

import type { StatDelta, Difficulty, GameStats } from '@/types/game'
import { hashSeed, getStatLabel } from '@/lib/utils'

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
    id: 'running_mate',
    prompt: 'The Running Mate Announcement',
    flavor: "Every name on the shortlist says something different about the campaign you're about to run.",
    options: [
      { id: 'mate_loyalist', label: 'Pick the loyalist — steady hands, zero surprises', effects: { partyUnity: 3, congressSupport: 1 } },
      { id: 'mate_swing_state', label: 'Pick the swing-state governor — an electoral gamble with a real payoff', effects: { baseSupport: 2, approval: 1 } },
      { id: 'mate_outsider', label: 'Pick the outsider — energizes the base, unsettles the establishment', effects: { baseSupport: 3, partyUnity: -2 } },
    ],
  },
  {
    id: 'october_surprise',
    prompt: 'The October Surprise',
    flavor: 'Three weeks out, a leaked memo lands in every newsroom in the country. How you respond in the next 48 hours will define the final stretch.',
    options: [
      { id: 'surprise_confront', label: 'Address it head-on in a press conference', effects: { approval: 2, globalReputation: 1 } },
      { id: 'surprise_deflect', label: "Deflect — pivot every question back to your opponent's record", effects: { baseSupport: 2, partyUnity: -1 } },
      { id: 'surprise_silence', label: 'Say nothing and let surrogates handle it', effects: { congressSupport: 1, approval: -1 } },
    ],
  },
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
    id: 'election_day_ground_game',
    prompt: 'Election Day Ground Game',
    flavor: "Polls are open. The campaign's last lever is turnout — and where you spend the final hours of organizing money says everything about your theory of the race.",
    options: [
      { id: 'ground_base_turnout', label: 'Pour resources into base turnout operations', effects: { baseSupport: 3 } },
      { id: 'ground_persuasion', label: 'Fund last-minute persuasion ads in swing districts', effects: { approval: 2, congressSupport: 1 } },
      { id: 'ground_legal', label: 'Deploy legal teams to monitor polling places', effects: { globalReputation: 1, partyUnity: 1 } },
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
  won:               boolean
  votePercent:       number
  marginLabel:       string
  narrative:         string
  // Deterministic flavor for the election-night reveal — same precedent as
  // votePercent/marginLabel: not a real statistical simulation, just a
  // richer read on the same underlying roll.
  popularVoteMargin: string
  electoralVotes:    number
  keyIssue:          string | null
}

// Harder modes start from a slimmer mandate — same "headwinds from day
// one" idea difficulty mods already apply to starting stats.
const DIFFICULTY_MARGIN_PENALTY: Record<Difficulty, number> = {
  easy: 4, normal: 0, hard: -4, expert: -8,
}

// Easter egg, not a real difficulty lever — deliberately independent of
// difficulty/campaign choices so it can't be farmed or avoided, just an
// occasional surprise. 1-in-200 (0.5%).
const LOSS_CHANCE_DENOMINATOR = 200

/** "+6.2 pts" style margin over the opponent, with a hash-derived decimal for texture. */
function formatPopularVoteMargin(seed: string, votePercent: number): string {
  const wholeMargin = 2 * votePercent - 100
  const decimal = (hashSeed(seed, 'margin-decimal') % 10) / 10
  const margin = wholeMargin + (wholeMargin >= 0 ? decimal : -decimal)
  return `${margin >= 0 ? '+' : ''}${margin.toFixed(1)} pts`
}

/**
 * A decorative electoral-vote count scaled to votePercent — NOT a real
 * state-by-state simulation (the engine has no concept of states). Wins
 * scale across the real 270–538 range; losses scale across a
 * below-270 range so the number itself communicates the outcome.
 */
function computeElectoralVotes(won: boolean, votePercent: number): number {
  if (won) {
    return Math.round(270 + ((votePercent - 50) / 18) * 268)
  }
  return Math.round(180 + ((votePercent - 44) / 4) * 89)
}

/** The single largest-magnitude stat from the campaign bonus, as a human label — or null if no campaign was run. */
function computeKeyIssue(campaignBonus: StatDelta): string | null {
  const entries = Object.entries(campaignBonus).filter(([, v]) => v !== undefined && v !== 0) as [keyof GameStats, number][]
  if (entries.length === 0) return null
  const top = entries.reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a))
  return getStatLabel(top[0])
}

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
      popularVoteMargin: formatPopularVoteMargin(seed, votePercent),
      electoralVotes: computeElectoralVotes(false, votePercent),
      keyIssue: computeKeyIssue(campaignBonus),
    }
  }

  const base = 50 + (hashSeed(seed) % 13) // 50–62 deterministic base spread
  const campaignSwing = Math.round(
    Object.values(campaignBonus).reduce((sum: number, v) => sum + (v ?? 0), 0) * 0.4
  )
  const votePercent = Math.max(50, Math.min(68, base + DIFFICULTY_MARGIN_PENALTY[difficulty] + campaignSwing))
  const flavorFields = {
    popularVoteMargin: formatPopularVoteMargin(seed, votePercent),
    electoralVotes: computeElectoralVotes(true, votePercent),
    keyIssue: computeKeyIssue(campaignBonus),
  }

  if (votePercent >= 60) {
    return {
      won: true,
      votePercent,
      marginLabel: 'Landslide Victory',
      narrative: 'The networks called it before midnight. A mandate, unmistakably.',
      ...flavorFields,
    }
  }
  if (votePercent >= 54) {
    return {
      won: true,
      votePercent,
      marginLabel: 'Comfortable Majority',
      narrative: 'A clear win — enough to govern, not enough to silence the opposition.',
      ...flavorFields,
    }
  }
  return {
    won: true,
    votePercent,
    marginLabel: 'Razor-Thin Mandate',
    narrative: 'It came down to the final precincts. You won — barely. Everyone remembers that.',
    ...flavorFields,
  }
}

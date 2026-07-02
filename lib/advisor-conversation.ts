import type { AdvisorRecommendation, AdvisorSeverity } from '@/lib/advisor-engine'
import type { Law } from '@/types/game'

export interface AdvisorConversationContent {
  tellMeMore: string
  options: string
  risks: string
  canThisWait: string
}

interface VoiceLines {
  options: string
  risks: string
  canThisWait: string
}

// One entry per (npcId, severity) pair that actually occurs in advisor-engine.ts's
// RULES — phrasing pulled from each NPC's personality.traits in data/npcs.json,
// not generic severity text. Falls back to GENERIC_* below for any future rule
// that introduces a combo not covered here.
const NPC_VOICE: Partial<Record<string, Partial<Record<AdvisorSeverity, VoiceLines>>>> = {
  treasury_secretary: {
    critical: {
      options: "There's no clever fiscal trick here. We cut spending, raise revenue, or both — pick one, but pick something.",
      risks: "The real risk is doing nothing. I've studied administrations that ignored a number exactly like this one.",
      canThisWait: "No. And I don't say that lightly — you know I don't like alarmism.",
    },
    warning: {
      options: 'Nothing that fixes it outright, but a debt-reducing bill would slow the bleeding.',
      risks: 'Manageable now. Expensive to ignore.',
      canThisWait: "A month or two, not longer. I'd rather flag it early than explain it late.",
    },
    opportunity: {
      options: "No specific ask — just don't let a strong economy go to waste doing nothing with it.",
      risks: "Worst case, the window closes and we're back to playing defense.",
      canThisWait: "It can, but strong economies don't hold forever. I've seen this window shut fast.",
    },
  },
  chief_of_staff: {
    critical: {
      options: "There's no operational fix for approval — it's substance, not messaging. Give me one real win and I'll build the rollout around it.",
      risks: "If we don't turn this, the staff starts hedging their bets. That's how administrations fall apart from the inside.",
      canThisWait: "No. I've seen this exact number end a presidency before.",
    },
  },
  attorney_general: {
    critical: {
      options: "This isn't a legal problem, it's a legitimacy problem — I can't fix it with a memo.",
      risks: "At 100, we're talking about testing the DOJ's independence in ways it hasn't been tested in decades.",
      canThisWait: "No. I don't make that call lightly.",
    },
    warning: {
      options: "Cooperate fully and let the investigation run its course — that's the only path that doesn't get worse.",
      risks: 'Every week this stays open without a real answer, it looks more like something is being hidden, whether it is or not.',
      canThisWait: 'Not indefinitely. Silence reads as guilt eventually.',
    },
  },
  sec_defense: {
    critical: {
      options: "The defense bill on your desk is the fastest lever we have. It's not everything, but it's something now.",
      risks: "The risk of doing nothing is that someone tests us while we're exposed. That's not hypothetical.",
      canThisWait: 'No. Forty years in uniform, and this is not a number you sit on.',
    },
    warning: {
      options: "No emergency bill needed yet — but readiness doesn't rebuild itself. The budget conversation needs to happen soon.",
      risks: "It decays quietly until the day it doesn't, and then it's a crisis instead of a budget line.",
      canThisWait: "A few months. I wouldn't push it further than that.",
    },
  },
  protest_leader: {
    warning: {
      options: 'A real policy response — not a statement — is the only thing that actually moves this.',
      risks: "If nothing changes, this doesn't stay peaceful forever. I say that as someone trying to keep it that way.",
      canThisWait: "My people have been patient. That patience has a limit, and we're getting close to it.",
    },
  },
  speaker: {
    warning: {
      options: "Fix the relationships before you fix the bills. Congress support doesn't move without some horse-trading first.",
      risks: "Push something ambitious at this number and you'll just burn political capital proving what I'm telling you for free.",
      canThisWait: "It can wait, but your agenda can't. Every month at this number is a month nothing ambitious passes.",
    },
  },
  vice_president: {
    warning: {
      options: 'A tour, direct outreach, something that shows up rather than gets announced. The base wants to see you, not hear about you.',
      risks: "If this keeps drifting, you're looking at a primary challenge with real oxygen. Better to get ahead of that story than react to it.",
      canThisWait: "Not long. I'm already fielding questions I don't love answering.",
    },
  },
  media_anchor: {
    warning: {
      options: 'A real, unscripted interview would do more than another podium statement. My viewers can tell the difference.',
      risks: "Hostile coverage compounds — every misstep gets amplified until the narrative hardens. Harder to unwind the longer it sits.",
      canThisWait: "Not really. The story doesn't wait for a convenient news cycle.",
    },
  },
  senate_leader: {
    opportunity: {
      options: "If there's a hard bill you've been sitting on, this is the Senate at its most willing. I don't know how long that lasts.",
      risks: 'The only real risk is timing — wait too long and the same Senate that’s ready today may not be ready tomorrow.',
      canThisWait: "It can, but I wouldn't count on this exact alignment holding. The Senate's mood shifts quicker than people think.",
    },
  },
  foreign_ally: {
    opportunity: {
      options: "If there's a multilateral initiative worth pursuing, the goodwill is genuinely there right now — that's not always true.",
      risks: 'The only risk is letting this moment pass. Trust like this doesn’t rebuild quickly once it fades.',
      canThisWait: 'It can wait a little, but not indefinitely. Goodwill is not a renewable resource in diplomacy.',
    },
  },
}

const GENERIC_OPTIONS: Record<AdvisorSeverity, string> = {
  critical: "There's no single bill that fixes this — it's going to take sustained attention across several fronts.",
  warning: 'Nothing specific on the docket for this one yet, but keep it on your radar.',
  opportunity: 'No specific ask yet — just make sure the moment doesn’t pass unused.',
}

const GENERIC_RISKS: Record<AdvisorSeverity, string> = {
  critical: "The real risk is doing nothing — this doesn't resolve on its own.",
  warning: 'Manageable for now, but it compounds the longer it sits.',
  opportunity: 'Worst case, we wait and the window closes. No real downside to moving.',
}

const GENERIC_URGENCY: Record<AdvisorSeverity, string> = {
  critical: 'No. This needs to be dealt with this term, not next.',
  warning: "Not indefinitely. I'd act in the next month or two.",
  opportunity: "It can, but windows like this don't stay open.",
}

function voiceFor(rec: AdvisorRecommendation): VoiceLines | undefined {
  return NPC_VOICE[rec.npcId]?.[rec.severity]
}

function describeOptions(rec: AdvisorRecommendation, law?: Law): string {
  if (law) {
    return `The strongest lever right now is ${law.title}. ${law.flavor}`
  }
  return voiceFor(rec)?.options ?? GENERIC_OPTIONS[rec.severity]
}

function describeRisks(rec: AdvisorRecommendation, law?: Law): string {
  if (law) {
    if (law.passage.lobbyOpposition.length > 0) {
      const names = law.passage.lobbyOpposition.map(g => g.name)
      const joined = names.length > 1
        ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
        : names[0]
      return `Expect pushback from ${joined}.`
    }
    if (law.cost === 'high' || law.debtImpact >= 3) {
      return `This carries a real price tag — about $${law.annualCostBn}B a year.`
    }
  }
  return voiceFor(rec)?.risks ?? GENERIC_RISKS[rec.severity]
}

function describeUrgency(rec: AdvisorRecommendation): string {
  return voiceFor(rec)?.canThisWait ?? GENERIC_URGENCY[rec.severity]
}

export function buildAdvisorConversation(rec: AdvisorRecommendation, law?: Law): AdvisorConversationContent {
  return {
    tellMeMore: rec.detail,
    options: describeOptions(rec, law),
    risks: describeRisks(rec, law),
    canThisWait: describeUrgency(rec),
  }
}

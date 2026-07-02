import type { AdvisorRecommendation } from '@/lib/advisor-engine'
import type { Law } from '@/types/game'

export interface AdvisorConversationContent {
  tellMeMore: string
  options: string
  risks: string
  canThisWait: string
}

const GENERIC_OPTIONS: Record<AdvisorRecommendation['severity'], string> = {
  critical: "There's no single bill that fixes this — it's going to take sustained attention across several fronts.",
  warning: "Nothing specific on the docket for this one yet, but keep it on your radar.",
  opportunity: 'No specific ask yet — just make sure the moment doesn’t pass unused.',
}

const GENERIC_RISKS: Record<AdvisorRecommendation['severity'], string> = {
  critical: "The real risk is doing nothing — this doesn't resolve on its own.",
  warning: "Manageable for now, but it compounds the longer it sits.",
  opportunity: "Worst case, we wait and the window closes. No real downside to moving.",
}

const URGENCY: Record<AdvisorRecommendation['severity'], string> = {
  critical: 'No. This needs to be dealt with this term, not next.',
  warning: "Not indefinitely. I'd act in the next month or two.",
  opportunity: "It can, but windows like this don't stay open.",
}

function describeOptions(rec: AdvisorRecommendation, law?: Law): string {
  if (law) {
    return `The strongest lever right now is ${law.title}. ${law.flavor}`
  }
  return GENERIC_OPTIONS[rec.severity]
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
  return GENERIC_RISKS[rec.severity]
}

function describeUrgency(rec: AdvisorRecommendation): string {
  return URGENCY[rec.severity]
}

export function buildAdvisorConversation(rec: AdvisorRecommendation, law?: Law): AdvisorConversationContent {
  return {
    tellMeMore: rec.detail,
    options: describeOptions(rec, law),
    risks: describeRisks(rec, law),
    canThisWait: describeUrgency(rec),
  }
}

/**
 * Headline / news ticker generation.
 *
 * Pure templated text — no AI calls. Picks a headline template based on
 * (a) the category of the event/law that just resolved and (b) the
 * direction/magnitude of the dominant stat delta, then fills in specifics.
 * Multiple templates per bucket so the same situation doesn't always
 * produce identical wording.
 */

import { LAW_SECTOR_META } from '@/lib/law-sectors'
import type { EventCategory, StatDelta, LawCategory, LawSector, Headline } from '@/types/game'

export type { Headline }

const OUTLETS = [
  'The National Herald',
  'Capitol Wire',
  'AP',
  'The Daily Brief',
  'Beltway Report',
  'Union News Network',
]

function pickOutlet(): string {
  return OUTLETS[Math.floor(Math.random() * OUTLETS.length)]
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Dominant delta detection ────────────────────────────────

/** Find the stat with the largest absolute change, and whether it's good or bad news */
function getDominantDelta(effects: StatDelta): { key: string; value: number; good: boolean } | null {
  const invertedStats = new Set(['debt', 'unrest', 'unemployment', 'inflation'])
  const entries = Object.entries(effects).filter(([, v]) => v !== undefined && v !== 0) as [string, number][]
  if (entries.length === 0) return null

  const [key, value] = entries.reduce((max, curr) =>
    Math.abs(curr[1]) > Math.abs(max[1]) ? curr : max
  )

  const good = invertedStats.has(key) ? value < 0 : value > 0
  return { key, value, good }
}

// ── Crisis event headlines ──────────────────────────────────

const CRISIS_TEMPLATES: Record<EventCategory, { positive: string[]; negative: string[]; neutral: string[] }> = {
  security: {
    positive: [
      'President\u2019s decisive security response praised across the aisle',
      'White House security move draws bipartisan relief',
      'Administration credited with swift crisis containment',
    ],
    negative: [
      'Security response questioned as threat lingers',
      'Critics say White House moved too slowly on security threat',
      'Lawmakers demand answers after security lapse',
    ],
    neutral: [
      'White House responds to security threat with measured approach',
      'Security briefing leaves Washington divided on next steps',
    ],
  },
  economy: {
    positive: [
      'Markets rally after President\u2019s economic intervention',
      'Economists cautiously optimistic following White House action',
      'Wall Street, Main Street both cheer economic move',
    ],
    negative: [
      'Markets slide as economic plan draws skepticism',
      'Economists warn of fallout from administration\u2019s latest move',
      'Consumer confidence dips after White House economic decision',
    ],
    neutral: [
      'White House unveils economic response, jury still out',
      'Economic move splits opinion on Capitol Hill',
    ],
  },
  disaster: {
    positive: [
      'Federal disaster response praised as swift and effective',
      'White House wins rare bipartisan praise for crisis management',
      'Disaster response held up as model of competent governance',
    ],
    negative: [
      'Disaster response draws comparisons to past federal failures',
      'Governors criticize slow federal disaster assistance',
      'Administration on defensive over disaster response timeline',
    ],
    neutral: [
      'Federal disaster response underway as damage assessment continues',
      'White House activates emergency protocols following disaster',
    ],
  },
  military: {
    positive: [
      'Commander-in-Chief\u2019s military decision draws allied praise',
      'Pentagon, White House aligned on decisive military move',
      'Military response framed as measured strength by supporters',
    ],
    negative: [
      'Military decision sparks war-weary backlash at home',
      'Allies express concern over administration\u2019s military posture',
      'Lawmakers question scope of military commitment',
    ],
    neutral: [
      'White House outlines military response amid global scrutiny',
      'Pentagon briefing leaves questions about next steps unanswered',
    ],
  },
  scandal: {
    positive: [
      'White House transparency on scandal wins cautious credit',
      'Administration\u2019s swift accountability move praised by watchdogs',
    ],
    negative: [
      'Scandal deepens as White House response questioned',
      'Calls for independent investigation grow louder',
      'Opposition seizes on administration scandal',
    ],
    neutral: [
      'White House addresses scandal allegations in brief statement',
      'Scandal fallout continues as investigation proceeds',
    ],
  },
  congress: {
    positive: [
      'Rare bipartisan moment as Congress, White House align',
      'Capitol Hill praises President\u2019s handling of legislative standoff',
    ],
    negative: [
      'Congressional gridlock deepens after White House decision',
      'Lawmakers from both parties criticize administration\u2019s approach',
    ],
    neutral: [
      'Congress digests White House response to legislative crisis',
      'Capitol Hill divided over President\u2019s latest move',
    ],
  },
  social: {
    positive: [
      'White House response to social crisis draws relief from advocates',
      'Administration credited with calming national tensions',
    ],
    negative: [
      'White House response to social crisis draws sharp criticism',
      'Advocacy groups say administration\u2019s response falls short',
      'Tensions persist despite White House intervention',
    ],
    neutral: [
      'White House addresses growing social concern',
      'Administration response to social issue leaves Washington divided',
    ],
  },
  diplomacy: {
    positive: [
      'Diplomatic breakthrough hailed as major foreign policy win',
      'Allies praise administration\u2019s diplomatic handling of crisis',
    ],
    negative: [
      'Diplomatic effort falls short, allies express frustration',
      'Foreign policy move draws criticism from both parties',
    ],
    neutral: [
      'White House navigates delicate diplomatic situation',
      'Foreign policy response leaves allies, critics both watching',
    ],
  },
  // Personnel scenes generate their own headlines directly (see
  // generateFiringHeadline below) rather than through this generic
  // category/dominant-delta path \u2014 never actually called for 'personnel',
  // present only so the Record<EventCategory, ...> type stays total.
  personnel: {
    positive: [],
    negative: [],
    neutral: [],
  },
}

export function generateCrisisHeadline(category: EventCategory, effects: StatDelta): Headline {
  const dominant = getDominantDelta(effects)
  const tone: Headline['tone'] = dominant === null ? 'neutral' : dominant.good ? 'positive' : 'negative'
  const templates = CRISIS_TEMPLATES[category][tone]

  return {
    text: pick(templates),
    outlet: pickOutlet(),
    tone,
  }
}

// ── Law passage headlines ───────────────────────────────────

const LAW_PASS_TEMPLATES: Record<LawCategory, string[]> = {
  progressive: [
    '\u201C{title}\u201D signed into law after hard-fought floor vote',
    'President signs landmark {sector} bill, progressives celebrate',
    'Historic {sector} reform clears Congress in major win for the President',
  ],
  conservative: [
    '\u201C{title}\u201D signed as President delivers on campaign promise',
    'Congress passes {sector} bill in win for fiscal conservatives',
    '{sector} overhaul becomes law after party-line vote',
  ],
  bipartisan: [
    'Rare bipartisan win: \u201C{title}\u201D signed into law',
    'Congress passes bipartisan {sector} package',
    'Congress comes together on {sector} reform',
  ],
}

const LAW_FAIL_TEMPLATES = [
  '\u201C{title}\u201D fails to clear Congress',
  '{sector} initiative stalls in Congress, President vows to try again',
  'White House {sector} push falls short',
]

export function generateLawHeadline(
  lawTitle: string,
  lawCategory: LawCategory,
  lawSector: LawSector,
  passed: boolean,
  usedAbility?: string | null,
): Headline {
  const sectorLabel = LAW_SECTOR_META[lawSector].label

  if (!passed) {
    return {
      text: pick(LAW_FAIL_TEMPLATES).replace('{title}', lawTitle).replace('{sector}', sectorLabel),
      outlet: pickOutlet(),
      tone: 'negative',
    }
  }

  if (usedAbility) {
    return {
      text: `\u201C${lawTitle}\u201D pushed through via last-minute leadership maneuver`,
      outlet: pickOutlet(),
      tone: 'neutral',
    }
  }

  return {
    text: pick(LAW_PASS_TEMPLATES[lawCategory]).replace('{title}', lawTitle).replace('{sector}', sectorLabel),
    outlet: pickOutlet(),
    tone: 'positive',
  }
}

// ── Approval-trend headlines (fired when approval crosses notable bands) ──

const APPROVAL_TREND_TEMPLATES = {
  surge: [
    'Approval rating surges following recent decisions',
    'President\u2019s standing with voters climbs sharply',
  ],
  slump: [
    'Approval rating slides to new term low',
    'Polling shows eroding public confidence in administration',
  ],
} as const

/** Call after a turn resolves to optionally surface an approval-trend headline */
export function maybeApprovalTrendHeadline(
  previousApproval: number,
  currentApproval: number,
): Headline | null {
  const delta = currentApproval - previousApproval
  if (delta >= 7) {
    return { text: pick([...APPROVAL_TREND_TEMPLATES.surge]), outlet: pickOutlet(), tone: 'positive' }
  }
  if (delta <= -7) {
    return { text: pick([...APPROVAL_TREND_TEMPLATES.slump]), outlet: pickOutlet(), tone: 'negative' }
  }
  return null
}

// ── Cabinet personnel-change headlines ──────────────────────

const FIRING_TEMPLATES = [
  'President dismisses {role}',
  '{role} out as President reshuffles Cabinet',
  'Shakeup: President replaces {role}',
  '{role} departs administration amid reports of friction with President',
]

const RESIGNATION_TEMPLATES = [
  '{role} resigns, citing personal reasons',
  'President accepts resignation of {role}',
  '{role} steps down, ending tenure in administration',
]

/** Fired/resigned Cabinet-change headline — same template/outlet-picking conventions as generateCrisisHeadline/generateLawHeadline. */
export function generateFiringHeadline(role: string, resigned = false): Headline {
  const templates = resigned ? RESIGNATION_TEMPLATES : FIRING_TEMPLATES
  return {
    text: pick(templates).replace('{role}', role),
    outlet: pickOutlet(),
    tone: 'negative',
  }
}

// ── Address the Nation headlines ────────────────────────────

export type SpeechTheme = 'economy' | 'security' | 'unity' | 'record' | 'diplomacy' | 'reform'

const SPEECH_TEMPLATES: Record<SpeechTheme, { effective: string[]; hollow: string[] }> = {
  economy: {
    effective: [
      'President’s economic address resonates with anxious voters',
      'Prime-time economic speech seen as reassuring by markets and Main Street alike',
    ],
    hollow: [
      'Economic address rings hollow against the numbers, critics say',
      'President’s upbeat economic message meets a skeptical public',
    ],
  },
  security: {
    effective: [
      'President’s security address projects strength at home and abroad',
      'National address on security draws praise for resolve',
    ],
    hollow: [
      'Security speech fails to reassure a jittery public',
      'Address on national security undercut by the numbers behind it',
    ],
  },
  unity: {
    effective: [
      'President’s call for unity strikes a chord with a divided country',
      'National address on unity draws rare cross-party praise',
    ],
    hollow: [
      'Unity speech falls flat amid deep national divisions',
      'Calls for unity read as desperate given the President’s standing',
    ],
  },
  record: {
    effective: [
      'President’s defense of the record lands with the base',
      'Address touting administration achievements draws a favorable reception',
    ],
    hollow: [
      'President’s defense of a thin record draws open mockery',
      'Address on accomplishments met with "what accomplishments?" from critics',
    ],
  },
  diplomacy: {
    effective: [
      'President’s address on global leadership draws praise from allies abroad',
      'Speech reaffirming America’s global role lands as intended',
    ],
    hollow: [
      'Address on global leadership rings hollow after a string of setbacks abroad',
      'Allies unmoved by speech on America’s world standing',
    ],
  },
  reform: {
    effective: [
      'President’s call to fix a broken Congress resonates with a frustrated public',
      'Address on congressional reform draws rare bipartisan nods',
    ],
    hollow: [
      'Reform speech falls flat given the President’s own gridlock with Congress',
      'Address on fixing Congress met with "physician, heal thyself" from critics',
    ],
  },
}

export function generateSpeechHeadline(theme: SpeechTheme, effective: boolean): Headline {
  const templates = SPEECH_TEMPLATES[theme]
  return {
    text: pick(effective ? templates.effective : templates.hollow),
    outlet: pickOutlet(),
    tone: effective ? 'positive' : 'negative',
  }
}

// ============================================================
// STAT TYPES
// ============================================================

export interface GameStats {
  approval: number         // 0–100  voter approval
  economy: number          // 0–100  composite economic health
  security: number         // 0–100  national security
  congressSupport: number  // 0–100  legislative support
  debt: number             // $T     national debt
  unrest: number           // 0–100  civil unrest
  globalReputation: number // 0–100  international standing
  unemployment: number     // %      unemployment rate
  inflation: number        // %      inflation rate
  baseSupport: number      // 0–100  party base loyalty
  partyUnity: number       // 0–100  congressional party unity
  militaryReadiness: number// 0–100  sub-stat of security
  mediaScore: number       // -2–2   hostile → amplifying
}

export const INITIAL_STATS: GameStats = {
  approval:          52,
  economy:           60,
  security:          65,
  congressSupport:   48,
  debt:              35.2,
  unrest:            18,
  globalReputation:  58,
  unemployment:      4.2,
  inflation:         3.1,
  baseSupport:       62,
  partyUnity:        55,
  militaryReadiness: 65,
  mediaScore:        0,
}

// Single source of truth for stat bounds — used by engine, UI, and tests
export const STAT_LIMITS: Record<keyof GameStats, { min: number; max: number }> = {
  approval:          { min: 0,   max: 100 },
  economy:           { min: 0,   max: 100 },
  security:          { min: 0,   max: 100 },
  congressSupport:   { min: 0,   max: 100 },
  debt:              { min: 28,  max: 70  },
  unrest:            { min: 0,   max: 100 },
  globalReputation:  { min: 0,   max: 100 },
  unemployment:      { min: 2,   max: 18  },
  inflation:         { min: 0.5, max: 15  },
  baseSupport:       { min: 0,   max: 100 },
  partyUnity:        { min: 0,   max: 100 },
  militaryReadiness: { min: 0,   max: 100 },
  mediaScore:        { min: -2,  max: 2   },
}

// Party-specific starting stat overrides
export const PARTY_STAT_MODS: Record<Party, Partial<GameStats>> = {
  DEMOCRAT:    { baseSupport: 65, partyUnity: 58, congressSupport: 50 },
  REPUBLICAN:  { baseSupport: 65, partyUnity: 58, congressSupport: 46 },
  INDEPENDENT: { baseSupport: 45, partyUnity: 35, congressSupport: 38 },
}

// ============================================================
// SHARED PRIMITIVES
// ============================================================

export type Party       = 'DEMOCRAT' | 'REPUBLICAN' | 'INDEPENDENT'
export type Difficulty  = 'easy' | 'normal' | 'hard' | 'expert'
export type GameStatus  = 'ACTIVE' | 'COMPLETE' | 'GAMEOVER'
export type ActionType  =
  | 'CRISIS'
  | 'LAW_PROPOSED'
  | 'LAW_PASSED'
  | 'LAW_FAILED'
  | 'BUDGET'
  | 'EXECUTIVE_ORDER'
  | 'PRESS_CONFERENCE'
  | 'DIPLOMATIC_VISIT'
  | 'TURN_END'
  | 'PERSONNEL'

export type GameOverReason =
  | 'IMPEACHMENT'          // approval < 10
  | 'DEBT_COLLAPSE'        // debt > 55
  | 'SECURITY_FAILURE'     // security = 0
  | 'CONSTITUTIONAL_CRISIS'// unrest = 100
  | 'TERM_COMPLETE'        // month 48 done

// Partial stat change — every field optional, engine merges into full GameStats
export type StatDelta = Partial<Record<keyof GameStats, number>>

// ============================================================
// EVENT TYPES
// ============================================================

export type EventCategory =
  | 'security' | 'economy' | 'disaster' | 'military'
  | 'scandal'  | 'congress' | 'social'  | 'diplomacy'
  | 'personnel'

export interface EventTriggers {
  always_available?: boolean
  month?:            { min?: number; max?: number }
  economy?:          { min?: number; max?: number }
  security?:         { min?: number; max?: number }
  unrest?:           { min?: number; max?: number }
  debt?:             { min?: number; max?: number }
  baseSupport?:      { min?: number; max?: number }
  globalReputation?: { min?: number; max?: number }
  // Boolean flag triggers: key = flag name, value = required state
  [flag: string]: boolean | { min?: number; max?: number } | undefined
}

export interface EventChoice {
  index:        number
  text:         string
  effects:      StatDelta
  sets_flags:   string[]
  removes_flags?: string[]
  outcome:      string
  /** Optional delayed consequences that fire N months after this choice */
  delayed_effects?: Array<{
    delay_months: number
    effects:      StatDelta
    headline:     string
  }>
  /**
   * Hidden-trait deltas for personnel-category scenes (see NpcTraits) —
   * parallel to `effects`/`relationshipDeltas` but for the 6 never-shown
   * character traits. Applied to `event.npcId` (or the scene's acting npc).
   */
  traitDeltas?: Partial<Record<keyof NpcTraits, number>>
  /** Personnel-scene-only: direct relationship change applied to the acting official (event.npcId) — parallel to traitDeltas, since generic trigger-key matching doesn't fit one-off scene dialogue the way it fits recurring law/event flags. */
  relationshipDelta?: number
  /**
   * Marks this choice as crossing the acting official's one hard line
   * (see CabinetCandidate.breakingPointTag). When set, matches against
   * that candidate's tag rather than applying a relationship delta — it
   * permanently flags `{npcId}_broke_trust` instead, which the NPC
   * Initiative Engine reads to unlock/upweight that official's leak/
   * resign/distant/publicly-disagree content for the rest of the term.
   */
  crossesBreakingPoint?: string
  /** Personnel-scene-only: this choice ends in firing/losing the acting official — client transitions straight to the candidate-replacement picker (POST /api/game/[id]/cabinet) rather than treating the scene as fully resolved. */
  opensReplacementPicker?: boolean
}

export interface CrisisEvent {
  id:            string
  title:         string
  category:      EventCategory
  description:   string
  triggers:      EventTriggers
  sets_flags:    string[]
  requires_flags: string[]
  weight:        number
  choices:       EventChoice[]
  /**
   * Marks this event as inspired by a real historical situation. When
   * true, `historicalContext` should explain the real-world precedent in
   * neutral, factual terms — what actually happened, in broad strokes —
   * without quoting real officials or putting invented dialogue in real
   * people's mouths. The event's own choices/outcomes remain fictional
   * "what if you were President" scenarios, not a claim that this is
   * exactly how history unfolded.
   */
  isHistorical?:      boolean
  historicalContext?: string  // e.g. "Inspired by the 1962 Cuban Missile Crisis."
  /**
   * Optional narrative callbacks — when the player has the given flag set
   * (from an earlier, unrelated choice), the matching text renders as a
   * "Your history:" line on this briefing. First matching entry wins.
   */
  callbacks?: Array<{ flag: string; text: string }>
  /**
   * Personnel-category scenes (category: 'personnel') center on one
   * specific official — `npcId` is the slot id (e.g. 'treasury_secretary'),
   * resolved per-game via lib/cabinet.ts's resolveRoster(), NOT a fixed
   * NPCS lookup, since which candidate fills that slot varies per game.
   */
  npcId?: string
  /**
   * Per-archetype flavor override for `description` — lets one shared
   * storyline framework (e.g. "Operation Black Tide") read differently
   * depending on whether the occupying candidate is hawkish, diplomatic,
   * etc., without forking the whole event. Falls back to `description`
   * when the active candidate's archetype has no entry.
   */
  archetypeText?: Record<string, string>
  /**
   * Ordered multi-speaker exchange rendered before the choices, for the
   * rare "whole room" personnel scenes (e.g. Defense wants to strike,
   * Treasury objects, AG raises legality). Most events — personnel or
   * otherwise — omit this and render as a single `description` block.
   */
  dialogueSequence?: Array<{ npcId: string; line: string }>
  /**
   * Selection hints read only by the NPC Initiative Engine
   * (lib/cabinet-narrative.ts) to decide which personnel scene to
   * surface and how likely it is this month — never used for ordinary
   * (non-personnel) events.
   */
  personnelMeta?: {
    /** Weighted up when the acting official's `goalTag` matches. */
    goalTag?: string
    /** Weighted up the higher the acting official's value on this trait. */
    traitTag?: keyof NpcTraits
    /** Coarse content type, used for pacing/priority ordering. */
    tier?: 'ambient' | 'request' | 'conflict' | 'resignation' | 'neglect' | 'room' | 'storyline' | 'discuss' | 'interview'
  }
}

// ============================================================
// LAW TYPES
// ============================================================

export type LawCategory = 'progressive' | 'conservative' | 'bipartisan'
export type LawCost     = 'none' | 'low' | 'medium' | 'high'

// Industry/sector taxonomy — a second, independent way to browse bills in
// Congress by subject matter rather than ideology. `category` above still
// drives passage headline flavor and the Bridge Builder achievement; this
// is purely the player-facing organizing dimension.
export type LawSector =
  | 'healthcare'
  | 'economy_finance'
  | 'energy_environment'
  | 'defense_security'
  | 'technology'
  | 'education'
  | 'justice_civil_rights'
  | 'infrastructure'
  | 'social_services'

export interface LobbyGroup {
  name:    string
  penalty: number
}

export interface PassageRequirements {
  congressMin:      number
  partyUnityMin:    number
  approvalBonus:    { threshold: number; bonus: number }
  approvalPenalty:  { threshold: number; penalty: number }
  lobbyOpposition:  LobbyGroup[]
  basePassProbability: number
}

export interface LawEffects {
  onPass:      StatDelta
  passive?:    StatDelta
  description: string
}

export interface NpcReaction {
  relationship: number
  quote:        string
}

export interface Law {
  id:            string
  title:         string
  shortTitle:    string
  category:      LawCategory
  sector:        LawSector
  description:   string
  flavor:        string
  cost:          LawCost
  debtImpact:    number
  annualCostBn:  number
  passage:       PassageRequirements
  effects:       LawEffects
  sets_flags:    string[]
  requires_flags: string[]
  // Human-readable label for what unlocks this law, shown when
  // requires_flags aren't met yet (e.g. "Requires: AI Regulation Act") —
  // avoids reverse-mapping flags to law titles at render time.
  prereqLabel?:  string
  blocks_laws:   string[]
  npc_reactions: Record<string, NpcReaction>
}

// ============================================================
// NPC TYPES
// ============================================================

export type NpcFaction =
  | 'inner_circle' | 'cabinet'       | 'congress'
  | 'opposition'   | 'media'         | 'international'
  | 'civil_society'

export interface NpcTriggerEffect {
  threshold?:            number
  event?:                string
  benefit?:              string
  specialEvent?:         string
  // Stat deltas when trigger fires
  approvalDelta?:        number
  unrestDelta?:          number
  securityDelta?:        number
  congressSupportDelta?: number
  baseSupportDelta?:     number
  globalReputationDelta?: number
  economyDelta?:         number
  // Passive bonuses
  scandalReduction?:     number
  scandalPrevention?:    number
  scandalWorsens?:       boolean
  billPassPenalty?:      number
  billBonus?:            number
  billBlocked?:          boolean
  bipartisanBonus?:      number
  crossoverVotes?:       number
  militaryOptionBonus?:  boolean
  diplomaticBonus?:      boolean
  debtReduction?:        number
  earlyWarning?:         boolean
  additionalThreatEvents?: number
  threatReduction?:      number
  baseSupportBonus?:     number
  approvalBonus?:        number
  activeScandals?:       number
}

export interface NpcSpecialAbility {
  name:                    string
  description:             string
  passive?:                boolean
  playerActivated?:        boolean
  usesPerTerm?:            number
  requiresRelationship?:   number
  unlocksMilitaryOption?:  boolean
  lowRelationshipAutoTrigger?: number
  periodicChallenge?:      boolean
}

export interface Npc {
  id:        string
  name:      string
  shortName: string
  role:      string
  faction:   NpcFaction
  avatar:      string
  avatarColor: string
  image?:      string   // path to /public/npcs/[id].png if available
  personality: {
    archetype:   string
    description: string
    traits:      string[]
  }
  relationship: {
    start: number
    min:   number
    max:   number
  }
  triggers: {
    onLowRelationship?:      NpcTriggerEffect & { threshold: number }
    onVeryLowRelationship?:  NpcTriggerEffect & { threshold: number }
    onHighRelationship?:     NpcTriggerEffect & { threshold: number }
    onMediumRelationship?:   NpcTriggerEffect & { threshold: number }
  }
  relationshipDeltas: Record<string, number>
  monthlyDialogue: {
    high:     string[]
    medium:   string[]
    low:      string[]
    critical: string[]
  }
  specialAbility: NpcSpecialAbility
}

// ============================================================
// CABINET (selectable NPCs) — see lib/cabinet.ts
// ============================================================

/**
 * Six hidden character traits, never shown as numbers during play (see
 * lib/cabinet-traits.ts) — only through unlocked `Game.npcObservations`
 * text and scene behavior. Fully revealed post-game on the Legacy
 * Intelligence Report. All 0-100; `ideology` is centered at 50.
 */
export interface NpcTraits {
  loyalty:        number
  ambition:       number
  integrity:      number
  politicalSkill: number
  stress:         number
  ideology:       number
}

/** One candidate option for a selectable Cabinet slot — everything a resolved Npc has, plus the extras that make candidates for the same slot meaningfully different. */
export interface CabinetCandidate {
  candidateId:  string
  name:         string
  shortName:    string
  avatar:       string
  avatarColor:  string
  image?:       string
  personality: {
    archetype:   string
    description: string
    traits:      string[]
  }
  relationship: {
    start: number
    min:   number
    max:   number
  }
  triggers: Npc['triggers']
  relationshipDeltas: Record<string, number>
  monthlyDialogue: Npc['monthlyDialogue']
  specialAbility: NpcSpecialAbility
  traits: NpcTraits
  /** Short, player-visible personal agenda shown on the dossier — also matched against CrisisEvent.personnelMeta.goalTag by the initiative engine. */
  goal:    string
  goalTag: string
  /** Player-visible line naming the one thing this candidate won't do — matched against EventChoice.crossesBreakingPoint. */
  breakingPoint:    string
  breakingPointTag: string
  /** Small starting-stat bonus applied once, at hire time — same clamped pipeline as perks/campaign bonuses. */
  startingBonus?: StatDelta
}

/** A selectable Cabinet position — 3-4 CabinetCandidates, one of which is active per game (see Game.cabinetSelections). */
export interface CabinetSlot {
  id:         string
  faction:    NpcFaction
  role:       string
  selectable: true
  candidates: CabinetCandidate[]
}

/** data/npcs.json entries are either a fixed Npc or a selectable CabinetSlot. */
export type NpcEntry = Npc | CabinetSlot

export const SELECTABLE_SLOT_IDS = [
  'vice_president', 'chief_of_staff', 'sec_defense', 'treasury_secretary', 'attorney_general',
] as const
export type SelectableSlotId = typeof SELECTABLE_SLOT_IDS[number]

// ============================================================
// GAME STATE
// ============================================================

export interface ActiveConflict {
  region:       string
  level:        1 | 2 | 3 | 4
  monthStarted: number
}

export interface PendingConsequence {
  id:           string
  chain:        string
  fireAtMonth:  number
  effects:      StatDelta
  headlineText: string
}

export interface GameLog {
  id:          string
  gameId:      string
  month:       number
  actionType:  ActionType
  eventId?:    string
  choiceIndex?: number
  lawId?:      string
  statDeltas:  StatDelta
  narrative?:  string
  createdAt:   string
}

export interface Game {
  id:               string
  userId:           string
  presidentName:    string
  party:            Party
  difficulty:       Difficulty
  currentMonth:     number
  status:           GameStatus
  stats:            GameStats
  flags:            Record<string, boolean>
  activeConflicts:  ActiveConflict[]
  activeScandals:   number
  pendingConsequences: PendingConsequence[]
  chainCooldowns:   Record<string, number>  // chain id -> month it becomes eligible again
  npcRelationships: Record<string, number>
  usedNpcAbilities: string[]  // NPC IDs whose once-per-term ability has been spent
  passedLaws:       string[]
  usedEvents:       string[]
  approvalHistory:  number[]
  legacyScore?:     number
  /** Which candidate currently fills each selectable Cabinet slot — see lib/cabinet.ts's resolveRoster(). Missing/invalid entries fall back to that slot's first candidate. */
  cabinetSelections: Partial<Record<SelectableSlotId, string>>
  /** Current, evolving hidden trait values per npc id — seeded from the active candidate's static traits at hire time. */
  npcTraits: Record<string, NpcTraits>
  /** Unlocked dossier clue text per npc id (Layer 2 — see lib/cabinet-traits.ts's revealObservation). */
  npcObservations: Record<string, string[]>
  /** 3-5 campaign-promised priority ids (see lib/priorities.ts), chosen at cabinet assembly. */
  priorities: string[]
  createdAt:        string
  updatedAt:        string
  logs?:            GameLog[]
}

// ============================================================
// ENGINE OUTPUT TYPES
// ============================================================

export interface NpcReactionResult {
  npcId:             string
  npcName:           string
  shortName:         string
  quote:             string
  relationshipDelta: number
  newRelationship:   number
}

export interface Headline {
  text:   string
  outlet: string
  tone:   'positive' | 'negative' | 'neutral'
}

export interface TurnResult {
  game:         Game
  log:          Omit<GameLog, 'id' | 'createdAt'>
  npcReactions: NpcReactionResult[]
  driftApplied: StatDelta
  headlines:    Headline[]
  gameOver?:    GameOverReason
  archetype?:   import('@/lib/archetype-engine').PresidentialArchetype
  newAchievements?: Achievement[]
  specialCovers?: import('@/lib/magazine-covers').CoverContent[]
}

export interface LegacyScore {
  total:     number
  breakdown: {
    approval:         number
    economy:          number
    security:         number
    globalReputation: number
    scandalsDeducted: number
    lawsPassed:       number
    warConduct:       number
  }
  verdict:     string
  reelected:   boolean
  votePercent: number
}

// ============================================================
// ACHIEVEMENTS / UNLOCKABLES
// ============================================================

/** A small starting-stat bonus a player can select on future new games. */
export interface Perk {
  id:          string
  label:       string
  description: string
  statBonus:   StatDelta
}

export interface Achievement {
  id:          string
  title:       string
  description: string
  icon:        string
  perk?:       Perk
}

/** Shape persisted in User.unlockedAchievements (Json). */
export interface UnlockedAchievement {
  id:       string
  earnedAt: string
}

// ============================================================
// API SHAPES
// ============================================================

export interface CreateGameRequest {
  presidentName:     string
  party:             Party
  difficulty?:       Difficulty
  perkId?:           string
  campaignChoiceIds?: string[]
  cabinetSelections?: Partial<Record<string, string>>
  priorities?:        string[]
}

export interface CreateGameResponse {
  game:          Game
  currentEvent?: CrisisEvent
}

export interface ProcessTurnRequest {
  eventId:     string
  choiceIndex: number
}

export interface ProcessTurnResponse extends TurnResult {
  nextEvent?: CrisisEvent | null
}

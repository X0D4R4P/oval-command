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
}

// ============================================================
// LAW TYPES
// ============================================================

export type LawCategory = 'progressive' | 'conservative' | 'bipartisan'
export type LawCost     = 'none' | 'low' | 'medium' | 'high'

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
  description:   string
  flavor:        string
  cost:          LawCost
  debtImpact:    number
  annualCostBn:  number
  passage:       PassageRequirements
  effects:       LawEffects
  sets_flags:    string[]
  requires_flags: string[]
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
  updatedGame:  Game
  log:          Omit<GameLog, 'id' | 'createdAt'>
  npcReactions: NpcReactionResult[]
  driftApplied: StatDelta
  headlines:    Headline[]
  gameOver?:    GameOverReason
  archetype?:   import('@/lib/archetype-engine').PresidentialArchetype
  newAchievements?: Achievement[]
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
  presidentName: string
  party:         Party
  difficulty?:   Difficulty
  perkId?:       string
}

export interface CreateGameResponse {
  game:          Game
  currentEvent?: CrisisEvent
}

export interface ProcessTurnRequest {
  eventId:     string
  choiceIndex: number
}

export interface ProcessTurnResponse {
  result:       TurnResult
  nextEvent?:   CrisisEvent | null
}

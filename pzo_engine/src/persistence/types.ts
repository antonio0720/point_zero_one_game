// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER — TYPES
// pzo_engine/src/persistence/types.ts
//
// REBUILD — Sprint 8+ full sync
//
// GROUND TRUTH: pzo-web/src/engines/sovereignty/types.ts
//               pzo-web/src/game/types/runState.ts
//               pzo-web/src/game/types/modes.ts
//
// NEW IN THIS REBUILD:
//   ✦ GameMode canonical enum (GO_ALONE | HEAD_TO_HEAD | TEAM_UP | CHASE_A_LEGEND)
//   ✦ RunPhase tracking (FOUNDATION | ESCALATION | SOVEREIGNTY)
//   ✦ CORD score as a first-class field on RunAccumulatorStats
//   ✦ ModeSpecificStats union — mode-derived stats embedded in accumulator
//   ✦ SeasonStateSnapshot — season xp/tier/dominion at run end
//   ✦ IntelligenceSnapshot — ML alpha/risk/momentum at run end
//   ✦ ShieldLayerSnapshot — L1–L4 state at run end
//   ✦ ViralMomentRecord — viral moments fired during run
//   ✦ isDemoRun flag — demo runs skip real leaderboard, enable tutorial replays
//   ✦ rulesetVersion on RunAccumulatorStats (fed into proof hash)
//   ✦ MarketRegime tracking
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

// =============================================================================
// SECTION 1 — ENUM TYPES
// =============================================================================

export type RunOutcome =
  | 'FREEDOM'
  | 'TIMEOUT'
  | 'BANKRUPT'
  | 'ABANDONED';

export type RunGrade =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'F';

export type IntegrityStatus =
  | 'VERIFIED'
  | 'TAMPERED'
  | 'UNVERIFIED';

export type ArtifactFormat =
  | 'PDF'
  | 'PNG';

export type BadgeTier =
  | 'PLATINUM'
  | 'GOLD'
  | 'SILVER'
  | 'BRONZE'
  | 'IRON';

/**
 * Canonical four-mode enum.
 * Matches pzo-web/src/game/types/modes.ts GameMode exactly.
 */
export type GameMode =
  | 'GO_ALONE'        // Empire: solo, isolation tax, bleed mode
  | 'HEAD_TO_HEAD'    // Predator: PvP, battle budget, extraction windows
  | 'TEAM_UP'         // Syndicate: cooperative, shared treasury, defection arc
  | 'CHASE_A_LEGEND'; // Phantom: ghost replay, legend decay, dynasty stack

/**
 * Run phase — GO_ALONE (Empire) mode only.
 */
export type RunPhase =
  | 'FOUNDATION'
  | 'ESCALATION'
  | 'SOVEREIGNTY';

/**
 * Market regime at run end.
 */
export type MarketRegime =
  | 'Stable'
  | 'Expansion'
  | 'Compression'
  | 'Panic'
  | 'Euphoria'
  | 'Recession'
  | 'Recovery';

/**
 * Viral moment types that fired during the run.
 */
export type ViralMomentType =
  | 'MAX_SYNERGY'
  | 'BETRAYAL'
  | 'RESCUE_SUCCESS'
  | 'LEGEND_BEATEN'
  | 'FREEDOM'
  | 'BLEED_SURVIVED'
  | 'NEMESIS_BROKEN';

// =============================================================================
// SECTION 2 — SCORE WEIGHTS + CONSTANTS
// =============================================================================

export const SOVEREIGNTY_WEIGHTS = {
  TICKS_SURVIVED:     0.20,
  SHIELDS_MAINTAINED: 0.25,
  HATER_BLOCKS:       0.20,
  DECISION_SPEED:     0.15,
  CASCADE_BREAKS:     0.20,
} as const;

export const OUTCOME_MULTIPLIERS: Record<RunOutcome, number> = {
  FREEDOM:   1.5,
  TIMEOUT:   0.8,
  BANKRUPT:  0.4,
  ABANDONED: 0.0,
} as const;

export const GRADE_THRESHOLDS: Record<RunGrade, { min: number; max: number }> = {
  A: { min: 1.10, max: 1.50 },
  B: { min: 0.80, max: 1.09 },
  C: { min: 0.55, max: 0.79 },
  D: { min: 0.30, max: 0.54 },
  F: { min: 0.00, max: 0.29 },
} as const;

/**
 * CORD score grade thresholds (separate from sovereignty score).
 * CORD = Compounded Outcome Rank Differential.
 */
export const CORD_GRADE_THRESHOLDS = {
  S:   { min: 1.75, max: 2.00 },  // Bleed Mode sovereign only
  A:   { min: 1.40, max: 1.74 },
  B:   { min: 1.10, max: 1.39 },
  C:   { min: 0.80, max: 1.09 },
  D:   { min: 0.50, max: 0.79 },
  F:   { min: 0.00, max: 0.49 },
} as const;

// =============================================================================
// SECTION 3 — ATOMIC RECORD TYPES
// =============================================================================

/** Record of a single forced-card decision. */
export interface DecisionRecord {
  cardId:            string;
  decisionWindowMs:  number;
  resolvedInMs:      number;
  wasAutoResolved:   boolean;
  wasOptimalChoice:  boolean;
  speedScore:        number;   // 0.0–1.0
}

/**
 * Tick snapshot — state at end of each engine tick.
 * tickHash: CRC32 hex (8 chars) during run, SHA-256 post-run.
 */
export interface TickSnapshot {
  tickIndex:           number;
  tickHash:            string;
  pressureScore:       number;
  shieldAvgIntegrity:  number;
  netWorth:            number;
  haterHeat:           number;
  cascadeChainsActive: number;
  tensionScore:        number;      // NEW Sprint 8
  tickTier:            string;      // 'T0'|'T1'|'T2'|'T3'|'T4'  NEW
  decisionsThisTick:   DecisionRecord[];
}

/** Compact L1–L4 shield state at run completion. */
export interface ShieldLayerSnapshot {
  id:       string;   // 'L1'|'L2'|'L3'|'L4'
  label:    string;
  current:  number;
  max:      number;
  breached: boolean;
}

/** Viral moment that fired during the run. */
export interface ViralMomentRecord {
  type:      ViralMomentType;
  tick:      number;
  headline:  string;
  cordBonus: number;
}

/** Season snapshot at run end. */
export interface SeasonStateSnapshot {
  xp:                 number;
  passTier:           number;
  dominionControl:    number;
  winStreak:          number;
  battlePassLevel:    number;
  cordAccumulator:    number;
  legendBeatCount:    number;
  bleedRunCount:      number;
  totalRunsCompleted: number;
}

/** ML intelligence state at run end. */
export interface IntelligenceSnapshot {
  alpha:              number;
  risk:               number;
  volatility:         number;
  momentum:           number;
  biasScore:          number;
  convergenceSignal:  number;
  sessionMomentum:    number;
  churnRisk:          number;
}

// =============================================================================
// SECTION 4 — MODE-SPECIFIC STAT BLOCKS
// One per GameMode — only the matching block is non-null on any given run.
// =============================================================================

/** Empire (GO_ALONE) — isolation, bleed, phase, case file. */
export interface EmpireRunStats {
  finalRunPhase:        RunPhase;
  bleedModeActivated:   boolean;
  /** Highest bleed severity reached ('NONE'|'WATCH'|'CRITICAL'|'TERMINAL') */
  maxBleedSeverity:     string;
  isolationTaxPaid:     number;   // total cash paid in isolation tax across run
  phaseTransitionCount: number;   // how many phase transitions occurred (0–2)
  pressureJournalEntries: number; // ML journal entries generated
}

/** Predator (HEAD_TO_HEAD) — battle budget, extractions, psyche, rivalry. */
export interface PredatorRunStats {
  battleBudgetConsumed: number;
  totalExtractions:     number;
  successfulExtractions:number;
  counterplaysExecuted: number;
  maxPsycheValue:       number;   // 0.0–1.0 peak tilt reached
  tiltCount:            number;
  cordPenaltyFromTilt:  number;
  rivalTier:            string;   // 'DORMANT'|'RIVAL'|'NEMESIS'|'ARCH_NEMESIS'
  opponentUserId:       string;
  spectatorCount:       number;   // peak live spectators
}

/** Syndicate (TEAM_UP) — trust, treasury, defection, aid. */
export interface SyndicateRunStats {
  finalTrustScore:      number;   // 0.0–1.0
  minTrustScore:        number;   // lowest point reached
  defectionStep:        string;   // 'NONE'|'BREAK_PACT'|'SILENT_EXIT'|'ASSET_SEIZURE'
  defectionOccurred:    boolean;
  rescueWindowsOpened:  number;
  rescueWindowsFunded:  number;
  totalAidReceived:     number;
  totalAidGiven:        number;
  playerRole:           string;   // assigned role ID
  teamSize:             number;   // 2–4
  teamPlayerIds:        string[]; // other player UUIDs
}

/** Phantom (CHASE_A_LEGEND) — ghost replay, legend, dynasty. */
export interface PhantomRunStats {
  legendRunId:          string;   // runId of the legend being chased
  legendPlayerHandle:   string;
  finalGhostDelta:      number;   // + = ahead of legend, - = behind
  maxLeadAchieved:      number;
  maxDeficitReached:    number;
  legendDecayApplied:   number;   // decay multiplier applied
  dynastyChallengeLevel:number;   // 1–5
  communityHeatScore:   number;   // heat from concurrent challengers
  legendBeaten:         boolean;
}

/** Union type — only one slot is populated. */
export interface ModeSpecificStats {
  empire?:    EmpireRunStats;
  predator?:  PredatorRunStats;
  syndicate?: SyndicateRunStats;
  phantom?:   PhantomRunStats;
}

// =============================================================================
// SECTION 5 — CORD SCORE
// =============================================================================

/**
 * Full CORD score record.
 * CORD = Compounded Outcome Rank Differential — the prestige/legacy metric.
 */
export interface CORDScore {
  /** Raw CORD value before mode modifier */
  rawCORD:         number;
  /** Mode-specific multiplier (Bleed = 1.5×, others = 1.0×) */
  modeMultiplier:  number;
  /** finalCORD = rawCORD * modeMultiplier */
  finalCORD:       number;
  /** CORD grade: 'S'|'A'|'B'|'C'|'D'|'F' */
  cordGrade:       string;
  /** CORD bonuses from viral moments */
  viralBonusTotal: number;
  computedAt:      number;
}

// =============================================================================
// SECTION 6 — CORE ACCUMULATOR
// =============================================================================

/**
 * Accumulated statistics across the entire run.
 * Extended from sovereignty/types.ts with Sprint 8 + mode-specific fields.
 */
export interface RunAccumulatorStats {
  // ── Identity ──────────────────────────────────────────────────────
  runId:                 string;
  userId:                string;
  seed:                  string;
  /** Ruleset version — baked into proof hash. e.g. '2024.12.1' */
  rulesetVersion:        string;
  mode:                  GameMode;
  /** True if this is a tutorial/demo run — skips real leaderboard */
  isDemoRun:             boolean;
  startedAt:             number;
  completedAt:           number;
  outcome:               RunOutcome;
  finalNetWorth:         number;
  seasonTickBudget:      number;
  ticksSurvived:         number;
  clientVersion:         string;
  engineVersion:         string;

  // ── Shield tracking ───────────────────────────────────────────────
  shieldIntegralSum:     number;
  shieldSampleCount:     number;
  /** L1–L4 final state */
  finalShieldLayers:     ShieldLayerSnapshot[];

  // ── Hater battle tracking ─────────────────────────────────────────
  totalHaterAttempts:    number;
  haterSabotagesBlocked: number;
  haterSabotagesCount:   number;
  /** Peak hater heat (0–100) */
  maxHaterHeat:          number;

  // ── Cascade tracking ──────────────────────────────────────────────
  totalCascadeChains:    number;
  cascadeChainsBreak:    number;

  // ── CORD ──────────────────────────────────────────────────────────
  cordScore:             CORDScore | null;

  // ── Market ────────────────────────────────────────────────────────
  finalMarketRegime:     MarketRegime;

  // ── Season snapshot ───────────────────────────────────────────────
  seasonSnapshot:        SeasonStateSnapshot;

  // ── Intelligence snapshot ─────────────────────────────────────────
  intelligenceSnapshot:  IntelligenceSnapshot;

  // ── Viral moments ─────────────────────────────────────────────────
  viralMoments:          ViralMomentRecord[];

  // ── Mode-specific stats ────────────────────────────────────────────
  modeStats:             ModeSpecificStats;

  // ── Decision tracking ─────────────────────────────────────────────
  decisionRecords:       DecisionRecord[];

  // ── Tick stream ───────────────────────────────────────────────────
  tickSnapshots:         TickSnapshot[];
}

// =============================================================================
// SECTION 7 — SOVEREIGNTY SCORE + IDENTITY TYPES
// (Mirrored from sovereignty/types.ts)
// =============================================================================

export interface SovereigntyScoreComponents {
  ticksSurvivedPct:     number;
  shieldsMaintainedPct: number;
  haterBlockRate:       number;
  decisionSpeedScore:   number;
  cascadeBreakRate:     number;
}

export interface SovereigntyScore {
  components:        SovereigntyScoreComponents;
  rawScore:          number;
  outcomeMultiplier: number;
  finalScore:        number;
  grade:             RunGrade;
  reward:            GradeReward;
  computedAt:        number;
}

export interface RunSignature {
  proofHash:           string;
  runId:               string;
  userId:              string;
  clientVersion:       string;
  engineVersion:       string;
  haterSabotagesCount: number;
  outcome:             RunOutcome;
  finalNetWorth:       number;
  ticksSurvived:       number;
  integrityStatus:     IntegrityStatus;
  signedAt:            number;
}

export interface RunIdentity {
  signature:       RunSignature;
  score:           SovereigntyScore;
  integrityStatus: IntegrityStatus;
}

export interface GradeReward {
  grade:             RunGrade;
  xpAwarded:         number;
  cosmeticsUnlocked: string[];
  badgeTierEarned:   BadgeTier;
  canExportProof:    boolean;
}

export interface ProofArtifact {
  runId:            string;
  proofHash:        string;
  grade:            RunGrade;
  sovereigntyScore: number;
  cordScore:        number;
  cordGrade:        string;
  badgeTier:        BadgeTier;
  playerHandle:     string;
  outcome:          RunOutcome;
  mode:             GameMode;
  ticksSurvived:    number;
  finalNetWorth:    number;
  generatedAt:      number;
  format:           ArtifactFormat;
  exportUrl?:       string;
}

// =============================================================================
// SECTION 8 — EVENT PAYLOAD TYPES
// =============================================================================

export interface RunCompletedPayload {
  runId:            string;
  proofHash:        string;
  grade:            RunGrade;
  sovereigntyScore: number;
  cordScore:        number | null;
  integrityStatus:  IntegrityStatus;
  reward:           GradeReward;
  mode:             GameMode;
  isDemoRun:        boolean;
}

export interface ProofVerificationFailedPayload {
  runId:  string;
  reason: string;
  step:   1 | 2 | 3;
}

export interface ProofArtifactReadyPayload {
  runId:     string;
  exportUrl: string;
  format:    ArtifactFormat;
}

export interface RunRewardDispatchedPayload {
  runId:     string;
  userId:    string;
  grade:     RunGrade;
  xp:        number;
  cosmetics: string[];
}
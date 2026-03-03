/**
 * integrity-types.ts
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/integrity/integrity-types.ts
 *
 * POINT ZERO ONE — INTEGRITY TYPES
 * Density6 LLC · Confidential · Do not distribute
 *
 * Single source of truth for all types consumed by:
 *   pzo_engine/src/integrity/
 *   pzo_engine/src/persistence/
 *   pzo-web/src/engines/sovereignty/
 *
 * Merges and reconciles:
 *   engines/sovereignty/types.ts         — pipeline types, weights, thresholds
 *   game/types/cord.ts                   — CORD tiers, badge tiers, extended grades
 *   game/sovereignty/proofHash.ts        — hash version contract
 *   game/sovereignty/runIntegrity.ts     — VerifiedRunRecord, integrity status
 *
 * Rules:
 *   ✦ Zero imports — this file imports nothing.
 *   ✦ Zero runtime logic — pure TypeScript declarations only.
 *   ✦ All constants exported as `as const` for type narrowing.
 *
 * Field order rules:
 *   ✦ proof_hash canonical input: seed | rulesetVersion | mode | isDemoRun |
 *       tickStreamChecksum | outcome | finalNetWorth.toFixed(2) | userId
 *       (8 fields, positions fixed — changing order invalidates all hashes)
 */

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — GAME MODES
// ═══════════════════════════════════════════════════════════════

/**
 * The four canonical game modes.
 * GO_ALONE = Empire. HEAD_TO_HEAD = Predator.
 * TEAM_UP = Syndicate. CHASE_A_LEGEND = Phantom.
 */
export type GameMode =
  | 'GO_ALONE'
  | 'HEAD_TO_HEAD'
  | 'TEAM_UP'
  | 'CHASE_A_LEGEND';

/** Alternate string aliases used in pzo-web game/ layer. */
export type GameModeAlias = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export const GAME_MODE_ALIASES: Record<GameMode, GameModeAlias> = {
  GO_ALONE:        'EMPIRE',
  HEAD_TO_HEAD:    'PREDATOR',
  TEAM_UP:         'SYNDICATE',
  CHASE_A_LEGEND:  'PHANTOM',
} as const;

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — RUN OUTCOME + INTEGRITY STATUS
// ═══════════════════════════════════════════════════════════════

/**
 * Final outcome of a completed run.
 * Drives the outcome_multiplier in sovereignty_score.
 */
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/**
 * Result of the ReplayIntegrityChecker pipeline step.
 * VERIFIED    — tick stream cryptographically matches seed replay.
 * TAMPERED    — hash divergence or anomaly score ≥ 0.85 detected.
 * UNVERIFIED  — check could not execute (missing data, client disconnect).
 */
export type IntegrityStatus = 'VERIFIED' | 'TAMPERED' | 'UNVERIFIED';

/** Format of the exported proof artifact. */
export type ArtifactFormat = 'PDF' | 'PNG';

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — GRADE + BADGE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Letter grade from sovereignty_score brackets.
 * A = sovereign excellence. F = failure. Permanent on run record.
 */
export type RunGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Extended grade — includes S-grade only achievable in Bleed Mode.
 * S = sovereignty_score 1.50–1.80, GO_ALONE with all handicaps active.
 */
export type ExtendedGrade = RunGrade | 'S';

/**
 * Visual tier of the proof badge on the exported sovereignty artifact.
 * Derived from grade + outcome combination.
 *
 * PLATINUM  = Grade A + FREEDOM (or S-grade any outcome)
 * GOLD      = Grade A non-FREEDOM, or Grade B + FREEDOM
 * SILVER    = Grade B non-FREEDOM, or Grade C + FREEDOM
 * BRONZE    = Grade C or D
 * IRON      = Grade F
 */
export type BadgeTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON';

/** Grade to badge tier lookup table. */
export const GRADE_TO_BADGE_TIER: Record<ExtendedGrade, Record<RunOutcome, BadgeTier>> = {
  S: { FREEDOM: 'PLATINUM', TIMEOUT: 'PLATINUM', BANKRUPT: 'GOLD',   ABANDONED: 'SILVER' },
  A: { FREEDOM: 'PLATINUM', TIMEOUT: 'GOLD',     BANKRUPT: 'SILVER', ABANDONED: 'BRONZE' },
  B: { FREEDOM: 'GOLD',     TIMEOUT: 'SILVER',   BANKRUPT: 'BRONZE', ABANDONED: 'IRON'   },
  C: { FREEDOM: 'SILVER',   TIMEOUT: 'BRONZE',   BANKRUPT: 'IRON',   ABANDONED: 'IRON'   },
  D: { FREEDOM: 'BRONZE',   TIMEOUT: 'IRON',     BANKRUPT: 'IRON',   ABANDONED: 'IRON'   },
  F: { FREEDOM: 'IRON',     TIMEOUT: 'IRON',     BANKRUPT: 'IRON',   ABANDONED: 'IRON'   },
} as const;

/** Grade label display strings. */
export const GRADE_LABELS: Record<ExtendedGrade, string> = {
  S: 'SOVEREIGN PRIME',
  A: 'SOVEREIGN ARCHITECT',
  B: 'TACTICAL BUILDER',
  C: 'DISCIPLINED CLIMBER',
  D: 'DEVELOPING OPERATOR',
  F: 'LIQUIDATED',
} as const;

/** Grade colors WCAG AA+ on #0D0D1E. */
export const GRADE_COLORS: Record<ExtendedGrade, string> = {
  S: '#2DDBF5',
  A: '#C9A84C',
  B: '#9B7DFF',
  C: '#2EE89A',
  D: '#FF9B2F',
  F: '#FF4D4D',
} as const;

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — CORD TIER
// ═══════════════════════════════════════════════════════════════

/**
 * Leaderboard ranking tier derived from normalized CORD score (0.0–1.0).
 * Distinct from RunGrade — CordTier is competitive rank, not effort grade.
 *
 * SOVEREIGN = ≥ 0.92   PLATINUM = ≥ 0.82
 * GOLD      = ≥ 0.70   SILVER   = ≥ 0.55
 * BRONZE    = ≥ 0.35   UNRANKED = < 0.35
 */
export type CordTier =
  | 'SOVEREIGN'
  | 'PLATINUM'
  | 'GOLD'
  | 'SILVER'
  | 'BRONZE'
  | 'UNRANKED';

export const CORD_TIER_THRESHOLDS: Record<CordTier, number> = {
  SOVEREIGN: 0.92,
  PLATINUM:  0.82,
  GOLD:      0.70,
  SILVER:    0.55,
  BRONZE:    0.35,
  UNRANKED:  0.00,
} as const;

export const CORD_TIER_COLORS: Record<CordTier, string> = {
  SOVEREIGN: '#9B7DFF',
  PLATINUM:  '#2DDBF5',
  GOLD:      '#C9A84C',
  SILVER:    '#B8B8D8',
  BRONZE:    '#FF9B2F',
  UNRANKED:  '#6A6A90',
} as const;

// ═══════════════════════════════════════════════════════════════
// SECTION 5 — SOVEREIGNTY SCORE WEIGHTS + THRESHOLDS
// ═══════════════════════════════════════════════════════════════

/**
 * Immutable weights used in sovereignty_score formula.
 * All weights sum to 1.0. Never mutate at runtime.
 * To change, edit here and redeploy. All existing scores are from prior weights.
 */
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

/** Bleed Mode brackets — S-grade unlocked. GO_ALONE only. */
export const BLEED_MODE_GRADE_THRESHOLDS: Record<ExtendedGrade, { min: number; max: number }> = {
  S: { min: 1.50, max: 1.80 },
  A: { min: 1.10, max: 1.49 },
  B: { min: 0.80, max: 1.09 },
  C: { min: 0.55, max: 0.79 },
  D: { min: 0.30, max: 0.54 },
  F: { min: 0.00, max: 0.29 },
} as const;

// ═══════════════════════════════════════════════════════════════
// SECTION 6 — PROOF HASH VERSION CONTRACT
// ═══════════════════════════════════════════════════════════════

/**
 * Proof hash algorithm version.
 * Bump whenever the payload field set or order changes.
 * Old hashes carry PZO-v2 or earlier. Verifier must check version.
 */
export const PROOF_HASH_VERSION = 'PZO-v3' as const;
export type ProofHashVersion = typeof PROOF_HASH_VERSION;

/**
 * Canonical proof hash input.
 * Field order is FIXED — changing order invalidates all existing hashes.
 * Pipe-joined payload: seed|rulesetVersion|mode|isDemoRun|tickStreamChecksum|outcome|finalNetWorth|userId
 */
export interface ProofHashInput {
  seed:               string;   // Hex seed of the run
  rulesetVersion:     string;   // Semver string e.g. '1.2.0'
  mode:               GameMode; // One of the four canonical modes
  isDemoRun:          boolean;  // Demo runs get DEMO: prefix — excluded from live boards
  tickStreamChecksum: string;   // SHA-256 of ordered tick hashes
  outcome:            RunOutcome;
  finalNetWorth:      number;
  userId:             string;
}

/** Result of a proof hash computation. */
export interface ProofHashResult {
  proofHash:   string;           // Full 64-char SHA-256 hex (or DEMO: prefixed)
  shortHash:   string;           // First 12 chars for display
  hashVersion: ProofHashVersion;
  isDemoRun:   boolean;
  computedAt:  number;           // Unix ms
}

// ═══════════════════════════════════════════════════════════════
// SECTION 7 — TICK SNAPSHOT + ACCUMULATOR TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Record of a single forced-card decision made by the player.
 * Used in DECISION_SPEED sovereignty weight calculation.
 */
export interface DecisionRecord {
  cardId:           string;
  decisionWindowMs: number;
  resolvedInMs:     number;
  wasAutoResolved:  boolean;
  wasOptimalChoice: boolean;
  speedScore:       number;   // 0.0–1.0
}

/**
 * State snapshot recorded at the end of every tick.
 * tick_hash = CRC32(tickIndex|pressureScore|shieldAvg|netWorth|haterHeat)
 * Stored in-memory during run; SHA-256 computed on stream at run completion.
 */
export interface TickSnapshot {
  tickIndex:           number;
  tickHash:            string;          // CRC32 hex (8 chars) during run; SHA-256 post-run
  pressureScore:       number;          // PressureEngine output 0.0–1.0
  shieldAvgIntegrity:  number;          // Average across all 4 layers (0–100)
  netWorth:            number;
  haterHeat:           number;          // 0–100
  cascadeChainsActive: number;
  decisionsThisTick:   DecisionRecord[];
}

/**
 * Full accumulated stats for a single run.
 * Built progressively by SovereigntyEngine.snapshotTick().
 * Consumed by the 3-step pipeline on run completion.
 */
export interface RunAccumulatorStats {
  runId:                 string;
  userId:                string;
  seed:                  string;
  mode:                  GameMode;
  rulesetVersion:        string;
  isDemoRun:             boolean;
  startedAt:             number;
  completedAt:           number;
  outcome:               RunOutcome;
  finalNetWorth:         number;
  seasonTickBudget:      number;
  ticksSurvived:         number;
  clientVersion:         string;
  engineVersion:         string;

  // Shield tracking
  shieldIntegralSum:     number;
  shieldSampleCount:     number;

  // Hater battle tracking
  totalHaterAttempts:    number;
  haterSabotagesBlocked: number;
  haterSabotagesCount:   number;

  // Cascade tracking
  totalCascadeChains:    number;
  cascadeChainsBreak:    number;

  // Decision tracking
  decisionRecords:       DecisionRecord[];

  // Tick stream
  tickSnapshots:         TickSnapshot[];

  // Optional CORD score (populated after pipeline step 3)
  cordScore?:            number;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 8 — SOVEREIGNTY SCORE TYPES
// ═══════════════════════════════════════════════════════════════

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
  grade:             ExtendedGrade;
  computedAt:        number;
}

/** The machine-readable record stored in DB and embedded in artifacts. */
export interface RunSignature {
  proofHash:           string;
  runId:               string;
  userId:              string;
  mode:                GameMode;
  rulesetVersion:      string;
  isDemoRun:           boolean;
  clientVersion:       string;
  engineVersion:       string;
  haterSabotagesCount: number;
  outcome:             RunOutcome;
  finalNetWorth:       number;
  ticksSurvived:       number;
  integrityStatus:     IntegrityStatus;
  signedAt:            number;
}

export interface GradeReward {
  grade:             ExtendedGrade;
  xpAwarded:         number;
  cosmeticsUnlocked: string[];
  badgeTierEarned:   BadgeTier;
  canExportProof:    boolean;
}

export interface RunIdentity {
  signature:       RunSignature;
  score:           SovereigntyScore;
  integrityStatus: IntegrityStatus;
}

/** The exportable proof artifact — rendered by SovereigntyExporter. */
export interface ProofArtifact {
  runId:            string;
  proofHash:        string;
  shortHash:        string;
  hashVersion:      ProofHashVersion;
  grade:            ExtendedGrade;
  sovereigntyScore: number;
  cordScore:        number | null;
  cordTier:         CordTier | null;
  badgeTier:        BadgeTier;
  playerHandle:     string;
  mode:             GameMode;
  outcome:          RunOutcome;
  ticksSurvived:    number;
  finalNetWorth:    number;
  isDemoRun:        boolean;
  generatedAt:      number;
  format:           ArtifactFormat;
  exportUrl?:       string;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 9 — INTEGRITY CHECK RESULT
// ═══════════════════════════════════════════════════════════════

export interface IntegrityCheckResult {
  status:             IntegrityStatus;
  tickStreamChecksum: string;   // Always populated — needed downstream
  reason?:            string;
  anomalyScore?:      number;   // 0.0–1.0
}

// ═══════════════════════════════════════════════════════════════
// SECTION 10 — EVENT BUS PAYLOAD TYPES
// ═══════════════════════════════════════════════════════════════

export interface RunCompletedPayload {
  runId:            string;
  proofHash:        string;
  grade:            ExtendedGrade;
  sovereigntyScore: number;
  integrityStatus:  IntegrityStatus;
  isDemoRun:        boolean;
  reward:           GradeReward;
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
  grade:     ExtendedGrade;
  xp:        number;
  cosmetics: string[];
}
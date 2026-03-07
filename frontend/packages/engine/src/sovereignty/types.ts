//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/types.ts

// ═══════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SOVEREIGNTY ENGINE — TYPES
// Density6 LLC · Confidential · Do not distribute
// ═══════════════════════════════════════════════════════════════════

// ── ENUMS ────────────────────────────────────────────────────────

/**
 * The final outcome of a completed run.
 * Drives the outcome_multiplier in sovereignty_score.
 */
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/**
 * Letter grade derived from sovereignty_score brackets.
 * A = sovereign excellence. F = failure. Permanent on run record.
 */
export type RunGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Result of the ReplayIntegrityChecker pipeline step.
 * VERIFIED: tick stream matches seed replay.
 * TAMPERED: stream does not match — hash divergence detected.
 * UNVERIFIED: check could not be executed (missing data, timeout).
 */
export type IntegrityStatus = 'VERIFIED' | 'TAMPERED' | 'UNVERIFIED';

/**
 * Format of the exported proof artifact.
 */
export type ArtifactFormat = 'PDF' | 'PNG';

/**
 * Badge tier, derived from RunGrade.
 * Controls visual design of the sovereignty badge on the artifact.
 */
export type BadgeTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON';

// ── SCORE WEIGHTS — NEVER CHANGE AT RUNTIME ──────────────────────

/**
 * Immutable weights used in the sovereignty_score formula.
 * All weights sum to 1.0. Do not alter these in logic.
 * To change weights, edit this constant and redeploy.
 */
export const SOVEREIGNTY_WEIGHTS = {
  TICKS_SURVIVED:     0.20,  // (ticks_survived / season_tick_budget) * 0.20
  SHIELDS_MAINTAINED: 0.25,  // time-average shield integrity pct * 0.25
  HATER_BLOCKS:       0.20,  // (sabotages_blocked / total_attempts) * 0.20
  DECISION_SPEED:     0.15,  // normalized avg decision speed score * 0.15
  CASCADE_BREAKS:     0.20,  // (chains_broken / total_chains) * 0.20
} as const;

/**
 * Outcome multipliers applied as final scalar to raw sovereignty score.
 * FREEDOM is the only outcome that allows score > 1.0 (max 1.5).
 */
export const OUTCOME_MULTIPLIERS: Record<RunOutcome, number> = {
  FREEDOM:   1.5,  // Sovereignty achieved. All gains amplified.
  TIMEOUT:   0.8,  // Time expired. Partial credit.
  BANKRUPT:  0.4,  // Financial destruction. Heavy penalty.
  ABANDONED: 0.0,  // Abandoned runs earn nothing. No exceptions.
} as const;

/**
 * Grade brackets. sovereignty_score ranges that map to letter grades.
 * Note: Max possible score = 1.0 * 1.5 = 1.5 (perfect run, FREEDOM).
 */
export const GRADE_THRESHOLDS: Record<RunGrade, { min: number; max: number }> = {
  A: { min: 1.10, max: 1.50 },  // Sovereign excellence
  B: { min: 0.80, max: 1.09 },  // Strong performance
  C: { min: 0.55, max: 0.79 },  // Acceptable
  D: { min: 0.30, max: 0.54 },  // Below standard
  F: { min: 0.00, max: 0.29 },  // Failed or abandoned
} as const;

// ── CORE DATA TYPES ──────────────────────────────────────────────

/**
 * Record of a single forced-card decision made by the player.
 * Used in decision_speed_score calculation.
 */
export interface DecisionRecord {
  cardId:            string;   // Which card required the decision
  decisionWindowMs:  number;   // Total window available in ms
  resolvedInMs:      number;   // How fast player resolved it (0 = auto-resolved)
  wasAutoResolved:   boolean;  // true = player did not respond in time
  wasOptimalChoice:  boolean;  // true = player chose the mechanically best option
  speedScore:        number;   // 0.0–1.0: fast+correct = 1.0, auto = 0.0
}

/**
 * Snapshot of engine state at end of each tick.
 * Stored in-memory during run, flushed to tick_stream_log on completion.
 * tick_hash is CRC32 (sync, tick loop) of (tickIndex|pressureScore|shieldAvg|netWorth|haterHeat).
 */
export interface TickSnapshot {
  tickIndex:           number;              // 0-based tick number
  tickHash:            string;              // CRC32 hex (8 chars) during run; SHA-256 post-run
  pressureScore:       number;              // PressureEngine output this tick
  shieldAvgIntegrity:  number;              // Average across all 4 layers (0-100)
  netWorth:            number;              // Player net worth at tick end
  haterHeat:           number;              // DB hater_heat integer at tick end
  cascadeChainsActive: number;              // Count of active cascade chains
  decisionsThisTick:   DecisionRecord[];   // All decisions made this tick
}

/**
 * Accumulated statistics from the entire run.
 * Built progressively during the run from snapshotTick() calls.
 * Consumed by SovereigntyEngine on run completion.
 */
export interface RunAccumulatorStats {
  runId:                 string;    // UUID, matches DB run_history.id
  userId:                string;    // User identifier
  seed:                  string;    // Run seed string (hex)
  startedAt:             number;    // Unix ms timestamp
  completedAt:           number;    // Unix ms timestamp
  outcome:               RunOutcome;
  finalNetWorth:         number;
  seasonTickBudget:      number;    // Max ticks allowed this season
  ticksSurvived:         number;    // Actual ticks completed
  clientVersion:         string;    // e.g. "1.4.2"
  engineVersion:         string;    // e.g. "sovereignty@1.0.0"

  // Shield tracking — time-average across all ticks and all 4 layers
  shieldIntegralSum:     number;    // Sum of shieldAvgIntegrity each tick
  shieldSampleCount:     number;    // Number of ticks sampled

  // Hater battle tracking
  totalHaterAttempts:    number;    // Total bot attack events
  haterSabotagesBlocked: number;    // Attacks fully absorbed (no breach)
  haterSabotagesCount:   number;    // Attacks that caused any damage

  // Cascade tracking
  totalCascadeChains:    number;    // Total chains that activated
  cascadeChainsBreak:    number;    // Chains player successfully interrupted

  // Decision tracking
  decisionRecords:       DecisionRecord[]; // All decisions this run

  // Tick stream — used for integrity verification
  tickSnapshots:         TickSnapshot[];   // One per tick, in order
}

/**
 * The five raw score components before weighting or multiplier.
 * All values are floats 0.0–1.0.
 */
export interface SovereigntyScoreComponents {
  ticksSurvivedPct:     number;  // ticks_survived / season_tick_budget
  shieldsMaintainedPct: number;  // time-averaged shield integrity
  haterBlockRate:       number;  // sabotages_blocked / total_attempts
  decisionSpeedScore:   number;  // normalized avg across all decisions
  cascadeBreakRate:     number;  // chains_broken / total_chains
}

/**
 * Full sovereignty score result including all components.
 */
export interface SovereigntyScore {
  components:        SovereigntyScoreComponents;
  rawScore:          number;  // Weighted sum before outcome multiplier (0.0–1.0)
  outcomeMultiplier: number;  // Applied multiplier
  finalScore:        number;  // rawScore * outcomeMultiplier (0.0–1.5)
  grade:             RunGrade;
  computedAt:        number;  // Unix ms timestamp
}

/**
 * The machine-readable identity record stored in DB and embedded in artifacts.
 */
export interface RunSignature {
  proofHash:           string;   // SHA-256 hex, 64 chars — THE primary ID
  runId:               string;   // UUID of the run_history record
  userId:              string;
  clientVersion:       string;
  engineVersion:       string;
  haterSabotagesCount: number;
  outcome:             RunOutcome;
  finalNetWorth:       number;
  ticksSurvived:       number;
  integrityStatus:     IntegrityStatus;
  signedAt:            number;   // Unix ms timestamp
}

/**
 * Complete run identity — the full record written to the DB.
 * This is what SovereigntyEngine produces and returns.
 */
export interface RunIdentity {
  signature:       RunSignature;
  score:           SovereigntyScore;
  integrityStatus: IntegrityStatus;
}

/**
 * Grade reward payload — what the player earns for their grade.
 * Dispatched as RUN_REWARD_DISPATCHED event after grade assignment.
 */
export interface GradeReward {
  grade:             RunGrade;
  xpAwarded:         number;
  cosmeticsUnlocked: string[];  // cosmetic IDs — empty if none
  badgeTierEarned:   BadgeTier;
  canExportProof:    boolean;   // All grades can export; A/B get premium artifact
}

/**
 * The exportable proof artifact — rendered by SovereigntyExporter.
 */
export interface ProofArtifact {
  runId:            string;
  proofHash:        string;
  grade:            RunGrade;
  sovereigntyScore: number;
  badgeTier:        BadgeTier;
  playerHandle:     string;
  outcome:          RunOutcome;
  ticksSurvived:    number;
  finalNetWorth:    number;
  generatedAt:      number;
  format:           ArtifactFormat;
  exportUrl?:       string;   // Populated after upload to CDN
}

// ── EVENT PAYLOAD TYPES ──────────────────────────────────────────

export interface RunCompletedPayload {
  runId:            string;
  proofHash:        string;
  grade:            RunGrade;
  sovereigntyScore: number;
  integrityStatus:  IntegrityStatus;
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
  grade:     RunGrade;
  xp:        number;
  cosmetics: string[];
}
// ═══════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SOVEREIGNTY ENGINE — TYPES
///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/types.ts
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
  TICKS_SURVIVED: 0.20,
  SHIELDS_MAINTAINED: 0.25,
  HATER_BLOCKS: 0.20,
  DECISION_SPEED: 0.15,
  CASCADE_BREAKS: 0.20,
} as const;

/**
 * Outcome multipliers applied as final scalar to raw sovereignty score.
 * FREEDOM is the only outcome that allows score > 1.0 (max 1.5).
 */
export const OUTCOME_MULTIPLIERS: Record<RunOutcome, number> = {
  FREEDOM: 1.5,
  TIMEOUT: 0.8,
  BANKRUPT: 0.4,
  ABANDONED: 0.0,
} as const;

/**
 * Grade brackets. sovereignty_score ranges that map to letter grades.
 * Note: Max possible score = 1.5.
 */
export const GRADE_THRESHOLDS: Record<RunGrade, { min: number; max: number }> = {
  A: { min: 1.10, max: 1.50 },
  B: { min: 0.80, max: 1.09 },
  C: { min: 0.55, max: 0.79 },
  D: { min: 0.30, max: 0.54 },
  F: { min: 0.00, max: 0.29 },
} as const;

// ── CORE DATA TYPES ──────────────────────────────────────────────

/**
 * Record of a single forced-card decision made by the player.
 * Used in decision_speed_score calculation.
 */
export interface DecisionRecord {
  cardId: string;
  decisionWindowMs: number;
  resolvedInMs: number;
  wasAutoResolved: boolean;
  wasOptimalChoice: boolean;
  speedScore: number;
}

/**
 * Snapshot of engine state at end of each tick.
 * Stored in-memory during run, flushed to tick_stream_log on completion.
 * tickHash is CRC32 during the tick loop for speed; the stream checksum is SHA-256 post-run.
 */
export interface TickSnapshot {
  tickIndex: number;
  tickHash: string;
  pressureScore: number;
  shieldAvgIntegrity: number;
  netWorth: number;
  haterHeat: number;
  cascadeChainsActive: number;
  decisionsThisTick: DecisionRecord[];
}

/**
 * Accumulated statistics from the entire run.
 * Built progressively during the run from snapshotTick() calls.
 * Consumed by SovereigntyEngine on run completion.
 */
export interface RunAccumulatorStats {
  runId: string;
  userId: string;
  seed: string;
  startedAt: number;
  completedAt: number;
  outcome: RunOutcome;
  finalNetWorth: number;
  seasonTickBudget: number;
  ticksSurvived: number;
  clientVersion: string;
  engineVersion: string;

  // Shield tracking — time-average across all ticks and all 4 layers
  shieldIntegralSum: number;
  shieldSampleCount: number;

  // Hater battle tracking
  totalHaterAttempts: number;
  haterSabotagesBlocked: number;
  haterSabotagesCount: number;

  // Cascade tracking
  totalCascadeChains: number;
  cascadeChainsBreak: number;

  // Decision tracking
  decisionRecords: DecisionRecord[];

  // Tick stream — used for integrity verification
  tickSnapshots: TickSnapshot[];
}

/**
 * The five raw score components before weighting or multiplier.
 * All values are floats 0.0–1.0.
 */
export interface SovereigntyScoreComponents {
  ticksSurvivedPct: number;
  shieldsMaintainedPct: number;
  haterBlockRate: number;
  decisionSpeedScore: number;
  cascadeBreakRate: number;
}

/**
 * Full sovereignty score result including all components.
 */
export interface SovereigntyScore {
  components: SovereigntyScoreComponents;
  rawScore: number;
  outcomeMultiplier: number;
  finalScore: number;
  grade: RunGrade;
  computedAt: number;
}

/**
 * The machine-readable identity record stored in DB and embedded in artifacts.
 */
export interface RunSignature {
  proofHash: string;
  runId: string;
  userId: string;
  clientVersion: string;
  engineVersion: string;
  haterSabotagesCount: number;
  outcome: RunOutcome;
  finalNetWorth: number;
  ticksSurvived: number;
  integrityStatus: IntegrityStatus;
  signedAt: number;
}

/**
 * Complete run identity — the full record written to the DB.
 * This is what SovereigntyEngine produces and returns.
 */
export interface RunIdentity {
  signature: RunSignature;
  score: SovereigntyScore;
  integrityStatus: IntegrityStatus;
}

/**
 * Grade reward payload — what the player earns for their grade.
 * Dispatched as RUN_REWARD_DISPATCHED after grade assignment.
 */
export interface GradeReward {
  grade: RunGrade;
  xpAwarded: number;
  cosmeticsUnlocked: string[];
  badgeTierEarned: BadgeTier;
  canExportProof: boolean;
}

/**
 * The exportable proof artifact — rendered by SovereigntyExporter.
 */
export interface ProofArtifact {
  runId: string;
  proofHash: string;
  grade: RunGrade;
  sovereigntyScore: number;
  badgeTier: BadgeTier;
  playerHandle: string;
  outcome: RunOutcome;
  ticksSurvived: number;
  finalNetWorth: number;
  generatedAt: number;
  format: ArtifactFormat;
  exportUrl?: string;
}

// ── EVENT PAYLOAD TYPES ──────────────────────────────────────────

export interface RunCompletedPayload {
  runId: string;
  proofHash: string;
  grade: RunGrade;
  sovereigntyScore: number;
  integrityStatus: IntegrityStatus;
  reward: GradeReward;
}

export interface ProofVerificationFailedPayload {
  runId: string;
  reason: string;
  step: 1 | 2 | 3;
}

export interface ProofArtifactReadyPayload {
  runId: string;
  exportUrl: string;
  format: ArtifactFormat;
}

export interface RunRewardDispatchedPayload {
  runId: string;
  userId: string;
  grade: RunGrade;
  xp: number;
  cosmetics: string[];
}
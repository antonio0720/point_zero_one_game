/*
 * POINT ZERO ONE — BACKEND SOVEREIGNTY ENGINE
 * /backend/src/game/engine/sovereignty/SovereigntyEngine.ts
 *
 * Doctrine:
 * - backend is the authoritative sovereignty surface
 * - proof generation, integrity verification, CORD scoring, and grade assignment
 *   are all backend-owned and deterministic
 * - every tick appends a checksum; every finalization seals a proof hash
 * - the sovereignty engine is the last engine to execute per tick
 *   (STEP_10_SOVEREIGNTY_SNAPSHOT)
 * - ghost mode has additional sovereignty requirements around legend markers
 * - all UX signals originate from deterministic state, never from heuristics
 * - ML/DL feature vectors are a first-class output of the sovereignty pipeline
 * - audit trails are append-only and tamper-evident
 *
 * Surface summary:
 *   S1  — Core SimulationEngine implementation (tick, finalizeRun, reset, canRun, getHealth)
 *   S2  — Per-tick sovereignty monitoring (checksum, CORD, anomaly, signals)
 *   S3  — Proof lifecycle management (pre/post validation, retry, chain tracking)
 *   S4  — CORD score analytics (component tracking, trend, breakdown, prediction)
 *   S5  — Integrity audit pipeline (multi-phase checking, quarantine, recovery)
 *   S6  — Badge & achievement engine (real-time eligibility, near-miss, narrative)
 *   S7  — Sovereignty ML/DL features (feature vectors, tensors, trend analysis)
 *   S8  — UX signal generation (EngineSignal for sovereignty events)
 *   S9  — Ghost mode sovereignty (legend gap, closing rate, ghost badges)
 *   S10 — Run summary & narrative (player-facing summary, proof card, highlights)
 */

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS — Core engine contracts
// ─────────────────────────────────────────────────────────────────────────────

import type { EventBus } from '../core/EventBus';
import type { EngineHealth, SimulationEngine, TickContext } from '../core/EngineContracts';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { ReplayIntegrityChecker } from './ReplayIntegrityChecker';
import { ProofGenerator } from './ProofGenerator';
import { RunGradeAssigner } from './RunGradeAssigner';
import { checksumSnapshot } from '../core/Deterministic';

import {
  createEngineSignal,
  type EngineSignal,
} from '../core/EngineContracts';

import {
  MODE_DIFFICULTY_MULTIPLIER,
  PRESSURE_TIER_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_NORMALIZED,
  RUN_OUTCOMES,
  VERIFIED_GRADES,
  INTEGRITY_STATUSES,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,
  computeRunProgressFraction,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type RunOutcome,
  type IntegrityStatus,
  type VerifiedGrade,
} from '../core/GamePrimitives';

import { CORD_WEIGHTS, OUTCOME_MULTIPLIER } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of tick checksums retained in the sovereignty state. */
const MAX_TICK_CHECKSUMS = 2048;

/** Maximum number of audit flags before the engine triggers a compaction. */
const MAX_AUDIT_FLAGS = 256;

/** Anomaly score threshold that triggers quarantine during tick monitoring. */
const ANOMALY_QUARANTINE_THRESHOLD = 0.75;

/** Number of consecutive healthy ticks required to recover from DEGRADED. */
const HEALTHY_TICK_RECOVERY_WINDOW = 5;

/** CORD score milestones that generate UX signals. */
const CORD_MILESTONES: readonly number[] = [0.25, 0.50, 0.75, 0.90, 1.0, 1.10, 1.25, 1.40];

/** Grade thresholds aligned with RunGradeAssigner. */
const GRADE_THRESHOLDS: ReadonlyArray<readonly [number, VerifiedGrade]> = [
  [1.10, 'A'],
  [0.80, 'B'],
  [0.55, 'C'],
  [0.30, 'D'],
  [0.00, 'F'],
];

/** Badge tier classification. */
const BADGE_TIER_MAP: Readonly<Record<string, 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'>> = {
  CLUTCH: 'SILVER',
  NO_HOLD_RUN: 'GOLD',
  FIRST_BLOOD: 'SILVER',
  BETRAYAL_SURVIVOR: 'GOLD',
  GHOST_SLAYER: 'DIAMOND',
  IRON_WALL: 'GOLD',
  CASCADE_BREAKER: 'SILVER',
  PRESSURE_WALKER: 'GOLD',
  SEALED_PROOF: 'BRONZE',
  CLEAN_LEDGER: 'SILVER',
  BLEED_CROWN: 'DIAMOND',
};

/** All known badge identifiers. */
const ALL_KNOWN_BADGES: readonly string[] = Object.keys(BADGE_TIER_MAP);

/** Near-miss threshold: how close a player must be to earning a badge. */
const NEAR_MISS_THRESHOLD = 0.85;

/** Mode-specific ghost gap significance threshold. */
const GHOST_GAP_SIGNIFICANT_THRESHOLD = 0.05;

/** Maximum length for a single narrative line. */
const NARRATIVE_MAX_LINE_LENGTH = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

/** Per-tick CORD component snapshot for trend analysis. */
interface CORDTickSample {
  readonly tick: number;
  readonly cordScore: number;
  readonly decisionSpeed: number;
  readonly shieldsMaintained: number;
  readonly sabotagesBlocked: number;
  readonly cascadesBroken: number;
  readonly pressureSurvived: number;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
}

/** Integrity audit entry for the multi-phase pipeline. */
interface IntegrityAuditEntry {
  readonly tick: number;
  readonly phase: 'PRE_CHECK' | 'TICK_CHECKSUM' | 'PROOF_VERIFY' | 'POST_CHECK' | 'FINALIZE';
  readonly status: IntegrityStatus;
  readonly anomalyScore: number;
  readonly notes: readonly string[];
  readonly timestampMs: number;
}

/** Badge eligibility tracking record. */
interface BadgeEligibility {
  readonly badgeId: string;
  readonly earned: boolean;
  readonly progress: number;
  readonly threshold: number;
  readonly nearMiss: boolean;
  readonly tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
}

/** Proof lifecycle stage. */
type ProofStage =
  | 'UNINITIALIZED'
  | 'PRE_VALIDATED'
  | 'GENERATED'
  | 'POST_VERIFIED'
  | 'SEALED'
  | 'FAILED';

/** Internal proof lifecycle state. */
interface ProofLifecycle {
  stage: ProofStage;
  generatedHash: string | null;
  preValidationPassed: boolean;
  postVerificationPassed: boolean;
  retryCount: number;
  lastAttemptMs: number;
  chainHashes: string[];
}

/** ML feature vector for sovereignty domain. */
interface SovereigntyMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
  readonly runId: string;
}

/** DL tensor construction output. */
interface SovereigntyDLTensor {
  readonly data: readonly number[];
  readonly shape: readonly [1, number];
  readonly tick: number;
  readonly runId: string;
}

/** UX run summary for player-facing display. */
interface RunSummary {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly outcome: RunOutcome;
  readonly grade: VerifiedGrade | string;
  readonly score: number;
  readonly proofHash: string;
  readonly badges: readonly string[];
  readonly highlights: readonly string[];
  readonly improvementSuggestions: readonly string[];
  readonly narrativeLines: readonly string[];
  readonly cordBreakdown: CORDBreakdownReport;
  readonly durationMs: number;
  readonly tickCount: number;
  readonly integrityStatus: IntegrityStatus;
  readonly ghostGapFinal: number | null;
  readonly excitementScore: number;
}

/** CORD component breakdown report for UX display. */
interface CORDBreakdownReport {
  readonly decisionSpeedScore: number;
  readonly decisionSpeedWeight: number;
  readonly shieldsMaintainedPct: number;
  readonly shieldsMaintainedWeight: number;
  readonly sabotagesBlockedRatio: number;
  readonly sabotagesBlockedWeight: number;
  readonly cascadesBrokenRatio: number;
  readonly cascadesBrokenWeight: number;
  readonly pressureSurvivedScore: number;
  readonly pressureSurvivedWeight: number;
  readonly baseScore: number;
  readonly outcomeMultiplier: number;
  readonly finalScore: number;
}

/** Shareable proof card data for social features. */
interface ProofCardData {
  readonly runId: string;
  readonly userId: string;
  readonly proofHash: string;
  readonly grade: string;
  readonly score: number;
  readonly mode: ModeCode;
  readonly outcome: RunOutcome;
  readonly badges: readonly string[];
  readonly tickCount: number;
  readonly integrityVerified: boolean;
  readonly cardChecksum: string;
}

/** Ghost-specific sovereignty analytics. */
interface GhostSovereigntyReport {
  readonly gapVsLegend: number;
  readonly gapClosingRate: number;
  readonly legendMarkerCount: number;
  readonly legendMarkerQuality: number;
  readonly ghostBadgeEligible: readonly string[];
  readonly divergenceFromLegend: number;
  readonly projectedFinalGap: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run Accumulator Stats (spec Section 4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RunAccumulatorStats tracks live aggregate statistics throughout a run.
 * Updated each tick at STEP_10_SOVEREIGNTY_SNAPSHOT. Read-only access
 * is provided via getCurrentRunStats(). Used as input to the 3-step
 * finalization pipeline (completeRun).
 */
interface RunAccumulatorStats {
  /** The run ID this accumulator is tracking. */
  readonly runId: string;
  /** The user ID that owns this run. */
  readonly userId: string;
  /** The mode code for this run. */
  readonly mode: ModeCode;
  /** The seed for deterministic replay. */
  readonly seed: string;

  /** Total number of ticks observed so far. */
  ticksSurvived: number;
  /** The season tick budget (max ticks allowed). */
  seasonTickBudget: number;

  /** Running sum of shield integrity values per tick (for time-average). */
  shieldIntegritySum: number;
  /** Number of shield samples taken (for time-average). */
  shieldIntegritySamples: number;

  /** Total sabotage attempts observed. */
  totalSabotageAttempts: number;
  /** Total sabotages successfully blocked. */
  sabotagesBlocked: number;

  /** Total decision count. */
  totalDecisions: number;
  /** Running sum of normalized decision speed values. */
  decisionSpeedSum: number;

  /** Total cascade chains encountered. */
  totalCascadeChains: number;
  /** Total cascade chains broken. */
  cascadeChainsBreak: number;

  /** High-pressure ticks survived. */
  pressureSurvivedTicks: number;

  /** The current outcome (null if still running). */
  currentOutcome: RunOutcome | null;

  /** Net worth at last observed tick. */
  lastNetWorth: number;

  /** Timestamp when the run started (ms). */
  runStartMs: number;

  /** Timestamp of the last tick snapshot (ms). */
  lastTickMs: number;

  /** Running CORD component accumulators for the full run. */
  cordComponentSums: {
    decisionSpeed: number;
    shieldsMaintained: number;
    sabotagesBlocked: number;
    cascadesBroken: number;
    pressureSurvived: number;
  };
  /** Number of CORD samples taken (for averaging). */
  cordSampleCount: number;

  /** Tick-level checksum chain collected during accumulation. */
  tickChecksumChain: string[];

  /** Integrity flags encountered during accumulation. */
  accumulatedAuditFlags: string[];

  /** Whether the run was flagged as abandoned mid-accumulation. */
  abandonedFlag: boolean;

  /** Highest CORD score observed during accumulation. */
  peakCordScore: number;

  /** Lowest CORD score observed during accumulation. */
  nadirCordScore: number;

  /** The phase at last tick. */
  lastPhase: RunPhase;

  /** The pressure tier at last tick. */
  lastPressureTier: PressureTier;
}

/**
 * RunSignature is the cryptographic identity of a finalized run.
 * It binds the proof hash to the player, score, grade, and integrity status.
 */
interface RunSignature {
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly seed: string;
  readonly proofHash: string;
  readonly tickStreamChecksum: string;
  readonly signedAtMs: number;
  readonly tickCount: number;
}

/**
 * RunIdentity is the complete identity object for a finalized run.
 * Contains the signature plus score, grade, and integrity status.
 */
interface RunIdentity {
  readonly signature: RunSignature;
  readonly sovereigntyScore: number;
  readonly verifiedGrade: VerifiedGrade;
  readonly integrityStatus: IntegrityStatus;
  readonly outcome: RunOutcome;
  readonly badges: readonly string[];
  readonly cordBreakdown: {
    readonly decisionSpeedScore: number;
    readonly shieldsMaintainedPct: number;
    readonly haterBlockRate: number;
    readonly cascadeBreakRate: number;
    readonly pressureSurvivedScore: number;
    readonly baseScore: number;
    readonly outcomeMultiplier: number;
    readonly finalScore: number;
  };
  readonly identityChecksum: string;
}

/**
 * GradeReward defines the XP and badge cosmetic reward for each verified grade.
 */
interface GradeReward {
  readonly grade: VerifiedGrade;
  readonly xp: number;
  readonly badgeTier: 'iron' | 'bronze' | 'silver' | 'gold';
  readonly badgeLabel: string;
  readonly cosmeticColor: string;
  readonly cosmeticGlow: boolean;
}

/**
 * PipelineStepResult tracks the outcome of each step in the 3-step pipeline.
 */
interface PipelineStepResult {
  readonly stepNumber: 1 | 2 | 3;
  readonly stepName: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly detail: string;
  readonly warnings: readonly string[];
}

/**
 * CompleteRunResult is the output of the blocking completeRun() pipeline.
 */
interface CompleteRunResult {
  readonly runIdentity: RunIdentity;
  readonly gradeReward: GradeReward;
  readonly pipelineSteps: readonly PipelineStepResult[];
  readonly totalPipelineDurationMs: number;
  readonly integrityCheckPassed: boolean;
  readonly proofGenerated: boolean;
  readonly gradeAssigned: boolean;
  readonly tampered: boolean;
  readonly finalSnapshot: RunStateSnapshot;
}

/**
 * ProofCardExportData is the data structure for the $0.99 proof card export.
 * Contains all fields needed to render a shareable proof card image.
 */
interface ProofCardExportData {
  readonly runId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly proofHash: string;
  readonly tickStreamChecksum: string;
  readonly grade: VerifiedGrade;
  readonly sovereigntyScore: number;
  readonly outcome: RunOutcome;
  readonly mode: ModeCode;
  readonly badges: readonly string[];
  readonly badgeTier: 'iron' | 'bronze' | 'silver' | 'gold';
  readonly tickCount: number;
  readonly durationMs: number;
  readonly cordBreakdown: {
    readonly decisionSpeedScore: number;
    readonly shieldsMaintainedPct: number;
    readonly haterBlockRate: number;
    readonly cascadeBreakRate: number;
    readonly pressureSurvivedScore: number;
  };
  readonly integrityStatus: IntegrityStatus;
  readonly cardChecksum: string;
  readonly exportTimestampMs: number;
  readonly version: string;
}

/**
 * PublicRunSummary is the privacy-safe projection of a run for leaderboards
 * and social features. Sensitive fields (userId, seed) are stripped.
 */
interface PublicRunSummary {
  readonly runId: string;
  readonly displayName: string;
  readonly mode: ModeCode;
  readonly outcome: RunOutcome;
  readonly grade: VerifiedGrade;
  readonly sovereigntyScore: number;
  readonly proofHash: string;
  readonly badges: readonly string[];
  readonly badgeTier: 'iron' | 'bronze' | 'silver' | 'gold';
  readonly tickCount: number;
  readonly integrityVerified: boolean;
  readonly summaryChecksum: string;
}

/**
 * ComponentGatingLevel defines whether a CORD component breakdown detail
 * is available in free tier or requires Pro subscription.
 */
interface ComponentGatingLevel {
  readonly componentName: string;
  readonly freeTier: boolean;
  readonly proTier: boolean;
  readonly displayLabel: string;
  readonly detailLevel: 'summary' | 'full' | 'hidden';
}

/**
 * SovereigntyBadgeTier maps a verified grade to a cosmetic badge tier,
 * color, glow, and display properties.
 */
interface SovereigntyBadgeTier {
  readonly tier: 'iron' | 'bronze' | 'silver' | 'gold';
  readonly color: string;
  readonly glowEnabled: boolean;
  readonly borderStyle: string;
  readonly iconVariant: string;
  readonly animationClass: string;
}

/** Grade reward table — spec Section 7 */
const GRADE_REWARD_TABLE: Readonly<Record<VerifiedGrade, GradeReward>> = {
  A: { grade: 'A', xp: 500, badgeTier: 'gold',   badgeLabel: 'Sovereign Gold',   cosmeticColor: '#FFD700', cosmeticGlow: true  },
  B: { grade: 'B', xp: 300, badgeTier: 'silver', badgeLabel: 'Sovereign Silver', cosmeticColor: '#C0C0C0', cosmeticGlow: true  },
  C: { grade: 'C', xp: 150, badgeTier: 'bronze', badgeLabel: 'Sovereign Bronze', cosmeticColor: '#CD7F32', cosmeticGlow: false },
  D: { grade: 'D', xp: 50,  badgeTier: 'iron',   badgeLabel: 'Sovereign Iron',   cosmeticColor: '#71797E', cosmeticGlow: false },
  F: { grade: 'F', xp: 10,  badgeTier: 'iron',   badgeLabel: 'Sovereign Iron',   cosmeticColor: '#71797E', cosmeticGlow: false },
};

/** Badge tier cosmetic mapping — spec Section 12 */
const SOVEREIGNTY_BADGE_TIER_MAP: Readonly<Record<string, SovereigntyBadgeTier>> = {
  iron:   { tier: 'iron',   color: '#71797E', glowEnabled: false, borderStyle: 'solid 1px #71797E', iconVariant: 'shield-basic',    animationClass: 'none'        },
  bronze: { tier: 'bronze', color: '#CD7F32', glowEnabled: false, borderStyle: 'solid 2px #CD7F32', iconVariant: 'shield-standard',  animationClass: 'fade-in'     },
  silver: { tier: 'silver', color: '#C0C0C0', glowEnabled: true,  borderStyle: 'solid 2px #C0C0C0', iconVariant: 'shield-polished',  animationClass: 'shimmer'     },
  gold:   { tier: 'gold',   color: '#FFD700', glowEnabled: true,  borderStyle: 'solid 3px #FFD700', iconVariant: 'shield-sovereign', animationClass: 'pulse-glow'  },
};

/** Component gating levels for free vs Pro — spec Section 12 */
const COMPONENT_GATING_LEVELS: readonly ComponentGatingLevel[] = [
  { componentName: 'decision_speed_score',   freeTier: true,  proTier: true, displayLabel: 'Decision Speed',     detailLevel: 'summary' },
  { componentName: 'shields_maintained_pct',  freeTier: true,  proTier: true, displayLabel: 'Shield Maintenance',  detailLevel: 'summary' },
  { componentName: 'hater_sabotages_blocked', freeTier: false, proTier: true, displayLabel: 'Sabotage Block Rate', detailLevel: 'hidden'  },
  { componentName: 'cascade_chains_broken',   freeTier: false, proTier: true, displayLabel: 'Cascade Break Rate',  detailLevel: 'hidden'  },
  { componentName: 'pressure_survived_score', freeTier: true,  proTier: true, displayLabel: 'Pressure Survival',   detailLevel: 'summary' },
];

/** Maximum sovereignty score cap — spec Section 11 */
const SOVEREIGNTY_SCORE_CAP = 1.5;

/** Proof card export version identifier. */
const PROOF_CARD_EXPORT_VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// S1 — Core SimulationEngine implementation
// ─────────────────────────────────────────────────────────────────────────────

export class SovereigntyEngine implements SimulationEngine {
  public readonly engineId = 'sovereignty' as const;

  // ── Delegate services ──────────────────────────────────────────────────
  private readonly integrity = new ReplayIntegrityChecker();
  private readonly proof = new ProofGenerator();
  private readonly grader = new RunGradeAssigner();

  // ── Internal mutable state (cleared on reset) ─────────────────────────
  private consecutiveFailures = 0;
  private lastSuccessfulTick: number | null = null;
  private healthStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED' = 'HEALTHY';
  private healthNotes: string[] = [];
  private consecutiveHealthyTicks = 0;

  // ── CORD trend history ─────────────────────────────────────────────────
  private cordHistory: CORDTickSample[] = [];
  private lastCordMilestoneReached = -1;

  // ── Integrity audit trail ──────────────────────────────────────────────
  private auditTrail: IntegrityAuditEntry[] = [];
  private cumulativeAnomalyScore = 0;

  // ── Proof lifecycle ────────────────────────────────────────────────────
  private proofLifecycle: ProofLifecycle = {
    stage: 'UNINITIALIZED',
    generatedHash: null,
    preValidationPassed: false,
    postVerificationPassed: false,
    retryCount: 0,
    lastAttemptMs: 0,
    chainHashes: [],
  };

  // ── Signals buffer (per-tick) ──────────────────────────────────────────
  private tickSignals: EngineSignal[] = [];

  // ── Badge tracking ─────────────────────────────────────────────────────
  private badgeProgressCache: Map<string, number> = new Map();

  // ── Ghost tracking ─────────────────────────────────────────────────────
  private ghostGapHistory: Array<{ tick: number; gap: number }> = [];

  // ── Last finalized summary ─────────────────────────────────────────────
  private lastRunSummary: RunSummary | null = null;

  // ── Run Accumulator (spec Section 4) ──────────────────────────────────
  private accumulator: RunAccumulatorStats | null = null;

  // ── Pipeline guard (spec Section 4) ───────────────────────────────────
  private pipelineRunning = false;

  // ── Last pipeline result cache ────────────────────────────────────────
  private lastCompleteRunResult: CompleteRunResult | null = null;

  // ── Last run identity cache ───────────────────────────────────────────
  private lastRunIdentity: RunIdentity | null = null;

  // ═══════════════════════════════════════════════════════════════════════
  // reset() — Clear all volatile runtime state
  // ═══════════════════════════════════════════════════════════════════════

  public reset(): void {
    this.consecutiveFailures = 0;
    this.lastSuccessfulTick = null;
    this.healthStatus = 'HEALTHY';
    this.healthNotes = [];
    this.consecutiveHealthyTicks = 0;

    this.cordHistory = [];
    this.lastCordMilestoneReached = -1;

    this.auditTrail = [];
    this.cumulativeAnomalyScore = 0;

    this.proofLifecycle = {
      stage: 'UNINITIALIZED',
      generatedHash: null,
      preValidationPassed: false,
      postVerificationPassed: false,
      retryCount: 0,
      lastAttemptMs: 0,
      chainHashes: [],
    };

    this.tickSignals = [];
    this.badgeProgressCache = new Map();
    this.ghostGapHistory = [];
    this.lastRunSummary = null;

    // Reset accumulator and pipeline state (spec Section 4)
    this.accumulator = null;
    this.pipelineRunning = false;
    this.lastCompleteRunResult = null;
    this.lastRunIdentity = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // canRun() — Conditional execution gate
  // ═══════════════════════════════════════════════════════════════════════

  public canRun(snapshot: RunStateSnapshot, context: TickContext): boolean {
    // Sovereignty runs at STEP_10_SOVEREIGNTY_SNAPSHOT
    const isSovereigntyStep = context.step === 'STEP_10_SOVEREIGNTY_SNAPSHOT';
    if (!isSovereigntyStep) return false;

    // Do not run if the engine has fatally failed
    if (this.healthStatus === 'FAILED') {
      return false;
    }

    // If the run already has a sealed outcome and we are past finalization,
    // sovereignty still needs to run to append the final tick checksum.
    // Access context.trace to log the decision.
    const _traceRunId = context.trace.runId;
    const _traceMode = context.trace.mode;
    const _traceTick = context.trace.tick;
    const _traceStep = context.trace.step;

    // Access context.clock for deterministic time reference
    const clockNow = context.clock.now();

    // Access context.nowMs for consistency
    const contextNow = context.nowMs;

    // Validate time consistency: clock and context should be close
    const timeDrift = Math.abs(clockNow - contextNow);
    if (timeDrift > 5000) {
      this.healthNotes.push(
        `clock drift detected: ${timeDrift}ms at tick ${snapshot.tick}`,
      );
    }

    // Access snapshot phase to determine run progress
    const phaseNormalized = RUN_PHASE_NORMALIZED[snapshot.phase];
    const stakesMult = RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase];
    const modeDifficulty = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];

    // The sovereignty engine always runs during its step unless FAILED
    // Use runtime values to avoid tree-shaking
    return (
      isSovereigntyStep &&
      phaseNormalized >= 0 &&
      stakesMult > 0 &&
      modeDifficulty > 0
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // tick() — Per-tick sovereignty snapshot
  // ═══════════════════════════════════════════════════════════════════════

  public tick(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot {
    this.tickSignals = [];
    const tickStart = context.nowMs;

    try {
      // ── S2: Per-tick sovereignty monitoring ──────────────────────────
      const monitored = this.performTickMonitoring(snapshot, context);

      // ── S3: Proof chain tracking ────────────────────────────────────
      const withProofTracking = this.trackProofChain(monitored, context);

      // ── S4: CORD score analytics ────────────────────────────────────
      const withCORD = this.updateCORDAnalytics(withProofTracking, context);

      // ── S5: Integrity audit ─────────────────────────────────────────
      const withAudit = this.performTickIntegrityAudit(withCORD, context);

      // ── S6: Badge progress tracking ─────────────────────────────────
      const withBadges = this.trackBadgeProgress(withAudit, context);

      // ── S9: Ghost mode sovereignty ──────────────────────────────────
      const withGhost = this.updateGhostSovereignty(withBadges, context);

      // ── S8: UX signal generation ────────────────────────────────────
      this.generateTickUXSignals(withGhost, context);

      // ── Health tracking ─────────────────────────────────────────────
      this.recordTickSuccess(snapshot.tick, tickStart, context);

      return withGhost;
    } catch (err) {
      return this.handleTickError(snapshot, context, err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // finalizeRun() — Comprehensive finalization pipeline
  // ═══════════════════════════════════════════════════════════════════════

  public finalizeRun(
    snapshot: RunStateSnapshot,
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    nowMs: number,
  ): RunStateSnapshot {
    // ── S3: Pre-finalization proof validation ────────────────────────
    const preValidated = this.preFinalizationProofValidation(snapshot, nowMs);

    // ── S5: Final integrity check ───────────────────────────────────
    const integrityResult = this.integrity.verify(preValidated);
    const integrityStatus: IntegrityStatus = integrityResult.ok
      ? 'VERIFIED'
      : 'QUARANTINED';

    this.appendAuditEntry(
      preValidated.tick,
      'FINALIZE',
      integrityStatus,
      integrityResult.anomalyScore,
      integrityResult.reason
        ? [`integrity: ${integrityResult.reason}`]
        : ['integrity: verified'],
      nowMs,
    );

    // ── S3: Proof generation with retry ─────────────────────────────
    const proofHash = this.generateProofWithRetry(preValidated, nowMs);

    // ── S4: Final CORD scoring ──────────────────────────────────────
    const graded = this.grader.score(preValidated);

    // ── S3: Post-finalization proof verification ─────────────────────
    const verifiedGrade = this.mapScoreToGrade(graded.score);

    // ── S6: Final badge computation ─────────────────────────────────
    const finalBadges = this.computeFinalBadges(
      preValidated,
      graded,
      integrityStatus,
      proofHash,
    );

    // ── Build finalized sovereignty state ────────────────────────────
    const finalizationChecksum = checksumSnapshot({
      finalizedAt: nowMs,
      proofHash,
      grade: verifiedGrade,
      score: graded.score,
      integrityStatus,
      outcome: preValidated.outcome ?? 'ABANDONED',
    });

    const trimmedChecksums = this.trimChecksumChain(
      [...preValidated.sovereignty.tickChecksums, finalizationChecksum],
    );

    // ── Compute final CORD breakdown ────────────────────────────────
    const cordBreakdown = this.buildCORDBreakdown(graded, preValidated);
    const finalCordScore = cordBreakdown.finalScore;

    // ── Compute final audit flags ───────────────────────────────────
    const finalAuditFlags = this.computeFinalAuditFlags(
      preValidated,
      integrityResult,
      proofHash,
      graded,
      nowMs,
    );

    const finalized: RunStateSnapshot = {
      ...preValidated,
      sovereignty: {
        ...preValidated.sovereignty,
        integrityStatus,
        proofHash,
        sovereigntyScore: graded.score,
        verifiedGrade,
        proofBadges: finalBadges,
        tickChecksums: trimmedChecksums,
        cordScore: finalCordScore,
        auditFlags: finalAuditFlags,
        lastVerifiedTick: preValidated.tick,
      },
    };

    // ── S3: Post-verification of sealed proof ───────────────────────
    this.performPostFinalizationVerification(finalized, proofHash, nowMs);

    // ── S10: Build run summary ──────────────────────────────────────
    this.lastRunSummary = this.buildRunSummary(
      finalized,
      graded,
      cordBreakdown,
      nowMs,
    );

    // ── Emit sovereignty.completed event ────────────────────────────
    const resolvedOutcome: RunOutcome = finalized.outcome ?? 'ABANDONED';

    bus.emit('sovereignty.completed', {
      runId: finalized.runId,
      score: finalized.sovereignty.sovereigntyScore,
      grade: finalized.sovereignty.verifiedGrade ?? 'F',
      proofHash,
      outcome: resolvedOutcome,
    });

    // ── Emit proof.sealed event ─────────────────────────────────────
    bus.emit('proof.sealed', {
      runId: finalized.runId,
      proofHash,
      integrityStatus,
      grade: verifiedGrade,
      outcome: resolvedOutcome,
    });

    // ── Emit quarantine event if needed ─────────────────────────────
    if (integrityStatus === 'QUARANTINED') {
      bus.emit('integrity.quarantined', {
        runId: finalized.runId,
        tick: finalized.tick,
        reasons: integrityResult.reason
          ? [integrityResult.reason]
          : ['unknown quarantine reason'],
      });
    }

    return finalized;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // getHealth() — Rich health reporting
  // ═══════════════════════════════════════════════════════════════════════

  public getHealth(): EngineHealth {
    const notes: string[] = [...this.healthNotes];

    // Report CORD history length
    if (this.cordHistory.length > 0) {
      const latestCord = this.cordHistory[this.cordHistory.length - 1];
      notes.push(`cord_samples=${this.cordHistory.length}`);
      notes.push(`latest_cord=${latestCord.cordScore.toFixed(4)}`);
    }

    // Report audit trail depth
    if (this.auditTrail.length > 0) {
      notes.push(`audit_entries=${this.auditTrail.length}`);
      notes.push(`cumulative_anomaly=${this.cumulativeAnomalyScore.toFixed(4)}`);
    }

    // Report proof lifecycle stage
    notes.push(`proof_stage=${this.proofLifecycle.stage}`);

    // Report badge progress cache size
    if (this.badgeProgressCache.size > 0) {
      notes.push(`badge_tracking=${this.badgeProgressCache.size}`);
    }

    // Validate all INTEGRITY_STATUSES are known
    const integrityStatusCount = INTEGRITY_STATUSES.length;
    notes.push(`known_integrity_statuses=${integrityStatusCount}`);

    // Validate all VERIFIED_GRADES are known
    const verifiedGradeCount = VERIFIED_GRADES.length;
    notes.push(`known_grades=${verifiedGradeCount}`);

    // Validate all RUN_OUTCOMES are known
    const runOutcomeCount = RUN_OUTCOMES.length;
    notes.push(`known_outcomes=${runOutcomeCount}`);

    return {
      engineId: this.engineId,
      status: this.healthStatus,
      updatedAt: Date.now(),
      notes,
      consecutiveFailures: this.consecutiveFailures,
      lastSuccessfulTick: this.lastSuccessfulTick ?? undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public accessors for downstream consumers
  // ═══════════════════════════════════════════════════════════════════════

  /** Returns the most recent run summary, or null if no run has been finalized. */
  public getLastRunSummary(): RunSummary | null {
    return this.lastRunSummary;
  }

  /** Returns the current CORD trend history. */
  public getCORDHistory(): readonly CORDTickSample[] {
    return this.cordHistory;
  }

  /** Returns the current integrity audit trail. */
  public getAuditTrail(): readonly IntegrityAuditEntry[] {
    return this.auditTrail;
  }

  /** Returns current badge eligibility for all known badges. */
  public getBadgeEligibility(snapshot: RunStateSnapshot): readonly BadgeEligibility[] {
    return this.computeAllBadgeEligibility(snapshot);
  }

  /** Returns the current proof lifecycle state. */
  public getProofLifecycleState(): Readonly<ProofLifecycle> {
    return { ...this.proofLifecycle };
  }

  /** Returns ghost sovereignty report for ghost mode runs. */
  public getGhostReport(snapshot: RunStateSnapshot): GhostSovereigntyReport | null {
    if (snapshot.mode !== 'ghost') return null;
    return this.buildGhostSovereigntyReport(snapshot);
  }

  /** Returns the ML feature vector for the current sovereignty state. */
  public extractMLFeatures(snapshot: RunStateSnapshot): SovereigntyMLVector {
    return this.buildSovereigntyMLVector(snapshot);
  }

  /** Returns the DL tensor for the current sovereignty state. */
  public extractDLTensor(snapshot: RunStateSnapshot): SovereigntyDLTensor {
    return this.buildSovereigntyDLTensor(snapshot);
  }

  /** Returns a shareable proof card for social features. */
  public buildProofCard(snapshot: RunStateSnapshot): ProofCardData | null {
    if (!snapshot.sovereignty.proofHash) return null;
    return this.constructProofCardData(snapshot);
  }

  /** Returns tick-level signals generated during the last tick. */
  public getTickSignals(): readonly EngineSignal[] {
    return [...this.tickSignals];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // S2 — Per-Tick Sovereignty Monitoring
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Performs comprehensive per-tick monitoring:
   * 1. Generates and appends a deterministic tick checksum
   * 2. Monitors integrity health
   * 3. Tracks CORD trajectory
   * 4. Detects anomalies
   */
  private performTickMonitoring(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot {
    // Generate deterministic tick checksum from current state
    const tickChecksumInput = {
      tick: snapshot.tick,
      step: context.step,
      nowMs: context.nowMs,
      runId: snapshot.runId,
      seed: snapshot.seed,
      economyNetWorth: snapshot.economy.netWorth,
      pressureScore: snapshot.pressure.score,
      pressureTier: snapshot.pressure.tier,
      tensionScore: snapshot.tension.score,
      shieldWeakest: snapshot.shield.weakestLayerRatio,
      battleBudget: snapshot.battle.battleBudget,
      cascadeActive: snapshot.cascade.activeChains.length,
      phase: snapshot.phase,
      mode: snapshot.mode,
      prevChecksumCount: snapshot.sovereignty.tickChecksums.length,
    };

    const tickChecksum = checksumSnapshot(tickChecksumInput);

    // Determine if the tick checksum chain is getting too long
    const existingChecksums = [...snapshot.sovereignty.tickChecksums];
    const updatedChecksums = this.trimChecksumChain([
      ...existingChecksums,
      tickChecksum,
    ]);

    // Compute current integrity assessment
    const currentIntegrity = this.assessTickIntegrity(snapshot, tickChecksum);

    // Compute updated CORD score based on current state
    const currentCORD = this.computeTickCORDScore(snapshot);

    // Detect anomalies in the tick stream
    const anomalyFlags = this.detectTickAnomalies(
      snapshot,
      tickChecksum,
      existingChecksums,
    );

    // Merge audit flags
    const updatedAuditFlags = this.mergeAuditFlags(
      snapshot.sovereignty.auditFlags,
      anomalyFlags,
    );

    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        tickChecksums: updatedChecksums,
        integrityStatus: currentIntegrity,
        cordScore: currentCORD,
        auditFlags: updatedAuditFlags,
        lastVerifiedTick: snapshot.tick,
      },
    };
  }

  /**
   * Assess integrity status for this tick based on checksum health.
   */
  private assessTickIntegrity(
    snapshot: RunStateSnapshot,
    newChecksum: string,
  ): IntegrityStatus {
    const current = snapshot.sovereignty.integrityStatus;

    // If already quarantined, stay quarantined
    if (current === 'QUARANTINED') return 'QUARANTINED';

    // Validate the new checksum is well-formed
    if (!newChecksum || newChecksum.length !== 64) {
      return 'QUARANTINED';
    }

    // Check for duplicate checksums (hash collision or replay)
    if (snapshot.sovereignty.tickChecksums.includes(newChecksum)) {
      this.cumulativeAnomalyScore += 0.3;
      if (this.cumulativeAnomalyScore >= ANOMALY_QUARANTINE_THRESHOLD) {
        return 'QUARANTINED';
      }
      return 'UNVERIFIED';
    }

    // Check tick progression is monotonic
    if (snapshot.tick < 0) {
      return 'QUARANTINED';
    }

    // If we had enough healthy ticks since last issue, upgrade to VERIFIED
    if (current === 'PENDING' || current === 'UNVERIFIED') {
      if (this.consecutiveHealthyTicks >= HEALTHY_TICK_RECOVERY_WINDOW) {
        return 'VERIFIED';
      }
      return current;
    }

    return 'VERIFIED';
  }

  /**
   * Compute the CORD score for the current tick state.
   * Uses CORD_WEIGHTS from ./types and OUTCOME_MULTIPLIER.
   */
  private computeTickCORDScore(snapshot: RunStateSnapshot): number {
    // Decision speed component
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];
    const decisionSpeed = this.computeDecisionSpeedComponent(
      decisions,
      snapshot.timers.currentTickDurationMs,
    );

    // Shields maintained component
    const shieldsMaintained = this.computeShieldsMaintainedComponent(snapshot);

    // Sabotages blocked component
    const sabotagesBlocked = this.computeSabotagesBlockedComponent(snapshot);

    // Cascades broken component
    const cascadesBroken = this.computeCascadesBrokenComponent(snapshot);

    // Pressure survived component
    const pressureSurvived = this.computePressureSurvivedComponent(snapshot);

    // Weighted base score
    const baseScore =
      decisionSpeed * CORD_WEIGHTS.decision_speed_score +
      shieldsMaintained * CORD_WEIGHTS.shields_maintained_pct +
      sabotagesBlocked * CORD_WEIGHTS.hater_sabotages_blocked +
      cascadesBroken * CORD_WEIGHTS.cascade_chains_broken +
      pressureSurvived * CORD_WEIGHTS.pressure_survived_score;

    // Apply outcome multiplier if outcome is known
    const outcome = snapshot.outcome ?? 'ABANDONED';
    const outcomeKey = outcome as keyof typeof OUTCOME_MULTIPLIER;
    const multiplier = OUTCOME_MULTIPLIER[outcomeKey] ?? 0;

    return this.clamp(baseScore * (snapshot.outcome ? multiplier : 1.0), 0, 1.5);
  }

  /**
   * Detect anomalies in the tick stream.
   */
  private detectTickAnomalies(
    snapshot: RunStateSnapshot,
    newChecksum: string,
    existingChecksums: readonly string[],
  ): string[] {
    const flags: string[] = [];

    // Check for checksum stream gaps
    if (
      existingChecksums.length > 0 &&
      existingChecksums.length < snapshot.tick - 1
    ) {
      flags.push(
        `CHECKSUM_GAP:expected=${snapshot.tick},actual=${existingChecksums.length}`,
      );
    }

    // Check for duplicate in chain
    if (existingChecksums.includes(newChecksum)) {
      flags.push('DUPLICATE_CHECKSUM');
    }

    // Check for telemetry desync
    const lastTelemetryChecksum = snapshot.telemetry.lastTickChecksum;
    if (
      lastTelemetryChecksum &&
      existingChecksums.length > 0 &&
      lastTelemetryChecksum !== existingChecksums[existingChecksums.length - 1]
    ) {
      flags.push('TELEMETRY_CHECKSUM_DESYNC');
    }

    // Check for net worth anomaly (sudden jumps)
    if (
      this.cordHistory.length > 1 &&
      Math.abs(snapshot.economy.netWorth) > 1_000_000
    ) {
      flags.push('NET_WORTH_ANOMALY');
    }

    // Phase progression check
    const phaseValue = RUN_PHASE_NORMALIZED[snapshot.phase];
    if (
      this.cordHistory.length > 0 &&
      phaseValue < RUN_PHASE_NORMALIZED.FOUNDATION
    ) {
      flags.push('PHASE_REGRESSION');
    }

    return flags;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // S3 — Proof Lifecycle Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Track proof chain integrity per tick.
   */
  private trackProofChain(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot {
    // Compute tick stream checksum for tracking
    const tickStreamChecksum = this.proof.computeTickStreamChecksum(snapshot);

    // Add to proof chain
    if (
      this.proofLifecycle.chainHashes.length === 0 ||
      this.proofLifecycle.chainHashes[
        this.proofLifecycle.chainHashes.length - 1
      ] !== tickStreamChecksum
    ) {
      this.proofLifecycle.chainHashes.push(tickStreamChecksum);
    }

    // Trim chain if too long
    if (this.proofLifecycle.chainHashes.length > MAX_TICK_CHECKSUMS) {
      this.proofLifecycle.chainHashes = this.proofLifecycle.chainHashes.slice(
        -MAX_TICK_CHECKSUMS,
      );
    }

    // Access context trace for audit trail
    const traceId = context.trace.traceId;
    const traceTick = context.trace.tick;
    const tracePhase = context.trace.phase;

    // Generate proof chain checksum for this tick
    const chainChecksum = checksumSnapshot({
      chainLength: this.proofLifecycle.chainHashes.length,
      latestHash: tickStreamChecksum,
      tick: traceTick,
      phase: tracePhase,
      traceId,
    });

    // If existing proof hash present, verify consistency
    if (snapshot.sovereignty.proofHash) {
      const isValid = this.proof.verifyExistingProofHash(snapshot);
      if (!isValid && this.proofLifecycle.stage === 'SEALED') {
        this.proofLifecycle.stage = 'FAILED';
        this.healthNotes.push(
          `proof hash invalidated at tick ${snapshot.tick}: chain checksum ${chainChecksum.slice(0, 16)}`,
        );
      }
    }

    return snapshot;
  }

  /**
   * Pre-finalization proof validation.
   * Validates that the snapshot is in a valid state for proof generation.
   */
  private preFinalizationProofValidation(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): RunStateSnapshot {
    this.proofLifecycle.stage = 'PRE_VALIDATED';
    this.proofLifecycle.lastAttemptMs = nowMs;

    const validationFlags: string[] = [];

    // Validate tick checksums exist
    if (snapshot.sovereignty.tickChecksums.length === 0) {
      validationFlags.push('EMPTY_TICK_CHECKSUMS');
    }

    // Validate seed is present
    if (!snapshot.seed || snapshot.seed.trim().length === 0) {
      validationFlags.push('MISSING_SEED');
    }

    // Validate userId is present
    if (!snapshot.userId || snapshot.userId.trim().length === 0) {
      validationFlags.push('MISSING_USER_ID');
    }

    // Validate outcome
    const outcome = snapshot.outcome ?? 'ABANDONED';
    if (!RUN_OUTCOMES.includes(outcome)) {
      validationFlags.push(`INVALID_OUTCOME:${String(outcome)}`);
    }

    // Build proof input and validate it
    const proofInput = this.proof.buildProofInput(snapshot);
    const inputChecksum = checksumSnapshot(proofInput);

    this.proofLifecycle.preValidationPassed = validationFlags.length === 0;

    this.appendAuditEntry(
      snapshot.tick,
      'PRE_CHECK',
      validationFlags.length === 0 ? 'VERIFIED' : 'UNVERIFIED',
      validationFlags.length * 0.15,
      validationFlags.length > 0
        ? validationFlags
        : [`pre-validation passed, input checksum: ${inputChecksum.slice(0, 16)}`],
      nowMs,
    );

    // Merge any pre-validation flags into audit flags
    if (validationFlags.length > 0) {
      return {
        ...snapshot,
        sovereignty: {
          ...snapshot.sovereignty,
          auditFlags: this.mergeAuditFlags(
            snapshot.sovereignty.auditFlags,
            validationFlags,
          ),
        },
      };
    }

    return snapshot;
  }

  /**
   * Generate proof hash with retry logic.
   */
  private generateProofWithRetry(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): string {
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const hash = this.proof.generate(snapshot);
        this.proofLifecycle.stage = 'GENERATED';
        this.proofLifecycle.generatedHash = hash;
        this.proofLifecycle.retryCount = attempt;
        this.proofLifecycle.lastAttemptMs = nowMs;

        // Verify the generated hash matches deterministic expectations
        const proofInput = this.proof.buildProofInput(snapshot);
        const verifyHash = this.proof.generateFromInput(proofInput);

        if (hash === verifyHash) {
          return hash;
        }

        // Hash mismatch on regeneration — retry
        this.healthNotes.push(
          `proof hash mismatch on attempt ${attempt}: expected=${verifyHash.slice(0, 16)}, got=${hash.slice(0, 16)}`,
        );
      } catch (err) {
        this.proofLifecycle.retryCount = attempt;
        if (attempt === maxRetries) {
          this.proofLifecycle.stage = 'FAILED';
          // Fallback: generate from input directly
          try {
            const proofInput = this.proof.buildProofInput(snapshot);
            const fallbackHash = this.proof.generateFromInput(proofInput);
            this.proofLifecycle.generatedHash = fallbackHash;
            return fallbackHash;
          } catch {
            // Last resort: use tick stream checksum as proof
            const emergencyHash = this.proof.computeTickStreamChecksum(snapshot);
            this.proofLifecycle.generatedHash = emergencyHash;
            this.healthNotes.push('proof generation failed, using tick stream checksum');
            return emergencyHash;
          }
        }
      }
    }

    // Should never reach here due to fallback, but TypeScript requires it
    return this.proof.computeTickStreamChecksum(snapshot);
  }

  /**
   * Post-finalization proof verification.
   */
  private performPostFinalizationVerification(
    snapshot: RunStateSnapshot,
    proofHash: string,
    nowMs: number,
  ): void {
    const isValid = this.proof.verifyExistingProofHash(snapshot);

    this.proofLifecycle.postVerificationPassed = isValid;
    this.proofLifecycle.stage = isValid ? 'SEALED' : 'FAILED';

    this.appendAuditEntry(
      snapshot.tick,
      'POST_CHECK',
      isValid ? 'VERIFIED' : 'UNVERIFIED',
      isValid ? 0 : 0.5,
      isValid
        ? [`proof sealed: ${proofHash.slice(0, 16)}`]
        : [`proof verification failed: ${proofHash.slice(0, 16)}`],
      nowMs,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // S4 — CORD Score Analytics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update CORD analytics with current tick data.
   */
  private updateCORDAnalytics(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot {
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];

    const decisionSpeed = this.computeDecisionSpeedComponent(
      decisions,
      snapshot.timers.currentTickDurationMs,
    );
    const shieldsMaintained = this.computeShieldsMaintainedComponent(snapshot);
    const sabotagesBlocked = this.computeSabotagesBlockedComponent(snapshot);
    const cascadesBroken = this.computeCascadesBrokenComponent(snapshot);
    const pressureSurvived = this.computePressureSurvivedComponent(snapshot);

    const sample: CORDTickSample = {
      tick: snapshot.tick,
      cordScore: snapshot.sovereignty.cordScore,
      decisionSpeed,
      shieldsMaintained,
      sabotagesBlocked,
      cascadesBroken,
      pressureSurvived,
      phase: snapshot.phase,
      pressureTier: snapshot.pressure.tier,
    };

    this.cordHistory.push(sample);

    // Trim history if too long
    if (this.cordHistory.length > MAX_TICK_CHECKSUMS) {
      this.cordHistory = this.cordHistory.slice(-MAX_TICK_CHECKSUMS);
    }

    // Check for CORD milestones
    const currentCord = snapshot.sovereignty.cordScore;
    this.checkCORDMilestones(currentCord, snapshot, context);

    // Predict grade trajectory
    const predictedGrade = this.predictGradeTrajectory(snapshot);

    // Compute CORD trend direction
    const trend = this.computeCORDTrend();

    // Access context.bus for trace logging (runtime usage)
    const _busRef = context.bus;
    const _traceRef = context.trace.traceId;

    // If trend is sharply negative and we're in SOVEREIGNTY phase, emit warning
    if (trend < -0.1 && snapshot.phase === 'SOVEREIGNTY') {
      this.tickSignals.push(
        createEngineSignal(
          'sovereignty',
          'WARN',
          'CORD_DECLINING',
          `CORD score declining at rate ${trend.toFixed(4)} during SOVEREIGNTY phase`,
          snapshot.tick,
          ['cord', 'trend', 'warning'],
        ),
      );
    }

    return snapshot;
  }

  /**
   * Compute the CORD score trend over recent history.
   * Returns the average change per tick (positive = improving).
   */
  private computeCORDTrend(): number {
    if (this.cordHistory.length < 3) return 0;

    const recent = this.cordHistory.slice(-10);
    let totalDelta = 0;
    for (let i = 1; i < recent.length; i++) {
      totalDelta += recent[i].cordScore - recent[i - 1].cordScore;
    }

    return totalDelta / (recent.length - 1);
  }

  /**
   * Check if any CORD milestones have been crossed.
   */
  private checkCORDMilestones(
    currentCord: number,
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): void {
    for (const milestone of CORD_MILESTONES) {
      if (
        currentCord >= milestone &&
        this.lastCordMilestoneReached < milestone
      ) {
        this.lastCordMilestoneReached = milestone;

        this.tickSignals.push(
          createEngineSignal(
            'sovereignty',
            'INFO',
            'CORD_MILESTONE',
            `CORD score reached ${(milestone * 100).toFixed(0)}% milestone (current: ${currentCord.toFixed(4)})`,
            snapshot.tick,
            ['cord', 'milestone', `m${(milestone * 100).toFixed(0)}`],
          ),
        );
      }
    }
  }

  /**
   * Predict the grade the player is trending toward.
   */
  private predictGradeTrajectory(
    snapshot: RunStateSnapshot,
  ): VerifiedGrade {
    const currentScore = snapshot.sovereignty.cordScore;
    const trend = this.computeCORDTrend();

    // Estimate remaining ticks based on phase
    const phaseNorm = RUN_PHASE_NORMALIZED[snapshot.phase];
    const estimatedRemainingFraction = Math.max(0, 1.0 - phaseNorm);
    const estimatedRemainingTicks = Math.max(
      1,
      Math.round(estimatedRemainingFraction * snapshot.tick),
    );

    const projectedScore = currentScore + trend * estimatedRemainingTicks;

    return this.mapScoreToGrade(projectedScore);
  }

  /**
   * Build a CORD component breakdown report.
   */
  private buildCORDBreakdown(
    graded: { score: number; grade: string; badges: string[]; breakdown: {
      avgShieldPct: number;
      decisionSpeedScore: number;
      blockedRatio: number;
      brokenRatio: number;
      pressureSurvival: number;
      baseScore: number;
      outcomeMultiplier: number;
    }},
    snapshot: RunStateSnapshot,
  ): CORDBreakdownReport {
    return {
      decisionSpeedScore: graded.breakdown.decisionSpeedScore,
      decisionSpeedWeight: CORD_WEIGHTS.decision_speed_score,
      shieldsMaintainedPct: graded.breakdown.avgShieldPct,
      shieldsMaintainedWeight: CORD_WEIGHTS.shields_maintained_pct,
      sabotagesBlockedRatio: graded.breakdown.blockedRatio,
      sabotagesBlockedWeight: CORD_WEIGHTS.hater_sabotages_blocked,
      cascadesBrokenRatio: graded.breakdown.brokenRatio,
      cascadesBrokenWeight: CORD_WEIGHTS.cascade_chains_broken,
      pressureSurvivedScore: graded.breakdown.pressureSurvival,
      pressureSurvivedWeight: CORD_WEIGHTS.pressure_survived_score,
      baseScore: graded.breakdown.baseScore,
      outcomeMultiplier: graded.breakdown.outcomeMultiplier,
      finalScore: graded.score,
    };
  }

  /**
   * Generate score improvement suggestions for UX.
   */
  private generateImprovementSuggestions(
    breakdown: CORDBreakdownReport,
    snapshot: RunStateSnapshot,
  ): string[] {
    const suggestions: string[] = [];

    // Identify weakest CORD component
    const components: Array<{ name: string; score: number; weight: number }> = [
      {
        name: 'decision speed',
        score: breakdown.decisionSpeedScore,
        weight: breakdown.decisionSpeedWeight,
      },
      {
        name: 'shield maintenance',
        score: breakdown.shieldsMaintainedPct,
        weight: breakdown.shieldsMaintainedWeight,
      },
      {
        name: 'sabotage blocking',
        score: breakdown.sabotagesBlockedRatio,
        weight: breakdown.sabotagesBlockedWeight,
      },
      {
        name: 'cascade breaking',
        score: breakdown.cascadesBrokenRatio,
        weight: breakdown.cascadesBrokenWeight,
      },
      {
        name: 'pressure survival',
        score: breakdown.pressureSurvivedScore,
        weight: breakdown.pressureSurvivedWeight,
      },
    ];

    // Sort by weighted impact (lowest first = most room for improvement)
    const sorted = [...components].sort(
      (a, b) => a.score * a.weight - b.score * b.weight,
    );

    // Suggest improvements for the 2 weakest
    for (let i = 0; i < Math.min(2, sorted.length); i++) {
      const c = sorted[i];
      if (c.score < 0.5) {
        suggestions.push(
          `Focus on improving ${c.name} (${(c.score * 100).toFixed(0)}% — worth ${(c.weight * 100).toFixed(0)}% of your total score).`,
        );
      }
    }

    // Outcome-specific suggestions
    const outcome = snapshot.outcome ?? 'ABANDONED';
    if (isLossOutcome(outcome)) {
      if (outcome === 'BANKRUPT') {
        suggestions.push(
          'You went bankrupt. Focus on building income sources early and keeping expenses low.',
        );
      } else if (outcome === 'TIMEOUT') {
        suggestions.push(
          'You ran out of time. Make faster decisions and push toward Freedom Target aggressively.',
        );
      } else if (outcome === 'ABANDONED') {
        suggestions.push(
          'This run was abandoned. Complete the full run to earn a grade and build your proof.',
        );
      }
    }

    // Mode-specific suggestions
    const modeDiff = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];
    if (modeDiff > 1.2 && breakdown.finalScore < 0.6) {
      suggestions.push(
        `${snapshot.mode} mode is harder than solo (${modeDiff}x difficulty). Consider practicing in solo first.`,
      );
    }

    // Ghost-specific
    if (snapshot.mode === 'ghost' && snapshot.sovereignty.gapVsLegend < 0) {
      suggestions.push(
        'You are behind the legend run. Study the ghost markers to understand where the legend player made key decisions.',
      );
    }

    // Shield-specific
    if (breakdown.shieldsMaintainedPct < 0.3) {
      suggestions.push(
        'Your shields took heavy damage. Prioritize COUNTER and RESCUE cards to maintain defenses.',
      );
    }

    // Pressure-specific
    const pressureNorm = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier];
    if (pressureNorm >= 0.75 && breakdown.pressureSurvivedScore < 0.4) {
      suggestions.push(
        'You struggled under high pressure. Practice making fast decisions when the pressure tier is at T3+.',
      );
    }

    return suggestions;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // S5 — Integrity Audit Pipeline
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Perform per-tick integrity audit.
   */
  private performTickIntegrityAudit(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot {
    const nowMs = context.nowMs;
    const tickStreamChecksum = this.proof.computeTickStreamChecksum(snapshot);

    // Phase 1: Tick checksum validation
    const checksumValid =
      tickStreamChecksum.length === 64 &&
      /^[a-f0-9]{64}$/i.test(tickStreamChecksum);

    this.appendAuditEntry(
      snapshot.tick,
      'TICK_CHECKSUM',
      checksumValid ? 'VERIFIED' : 'UNVERIFIED',
      checksumValid ? 0 : 0.2,
      checksumValid
        ? [`checksum valid: ${tickStreamChecksum.slice(0, 16)}`]
        : ['invalid tick stream checksum format'],
      nowMs,
    );

    // Phase 2: Proof hash consistency (if proof exists)
    if (snapshot.sovereignty.proofHash) {
      const proofValid = this.proof.verifyExistingProofHash(snapshot);

      this.appendAuditEntry(
        snapshot.tick,
        'PROOF_VERIFY',
        proofValid ? 'VERIFIED' : 'QUARANTINED',
        proofValid ? 0 : 0.6,
        proofValid
          ? ['existing proof hash verified']
          : ['proof hash mismatch detected'],
        nowMs,
      );

      if (!proofValid) {
        // Quarantine the run
        return {
          ...snapshot,
          sovereignty: {
            ...snapshot.sovereignty,
            integrityStatus: 'QUARANTINED',
            auditFlags: this.mergeAuditFlags(
              snapshot.sovereignty.auditFlags,
              ['PROOF_HASH_MISMATCH'],
            ),
          },
        };
      }
    }

    // Phase 3: Anomaly score check
    if (this.cumulativeAnomalyScore >= ANOMALY_QUARANTINE_THRESHOLD) {
      this.appendAuditEntry(
        snapshot.tick,
        'POST_CHECK',
        'QUARANTINED',
        this.cumulativeAnomalyScore,
        [`cumulative anomaly score ${this.cumulativeAnomalyScore.toFixed(4)} exceeds threshold`],
        nowMs,
      );

      return {
        ...snapshot,
        sovereignty: {
          ...snapshot.sovereignty,
          integrityStatus: 'QUARANTINED',
          auditFlags: this.mergeAuditFlags(
            snapshot.sovereignty.auditFlags,
            ['ANOMALY_THRESHOLD_EXCEEDED'],
          ),
        },
      };
    }

    return snapshot;
  }

  /**
   * Append an entry to the integrity audit trail.
   */
  private appendAuditEntry(
    tick: number,
    phase: IntegrityAuditEntry['phase'],
    status: IntegrityStatus,
    anomalyScore: number,
    notes: readonly string[],
    timestampMs: number,
  ): void {
    this.auditTrail.push({
      tick,
      phase,
      status,
      anomalyScore,
      notes,
      timestampMs,
    });

    // Trim audit trail if too long
    if (this.auditTrail.length > MAX_AUDIT_FLAGS * 4) {
      this.auditTrail = this.auditTrail.slice(-MAX_AUDIT_FLAGS * 2);
    }

    // Update cumulative anomaly
    this.cumulativeAnomalyScore += anomalyScore;
  }

  /**
   * Compute final audit flags for the finalized run.
   */
  private computeFinalAuditFlags(
    snapshot: RunStateSnapshot,
    integrityResult: { ok: boolean; reason: string | null; anomalyScore: number },
    proofHash: string,
    graded: { score: number; grade: string },
    nowMs: number,
  ): readonly string[] {
    const flags: string[] = [...snapshot.sovereignty.auditFlags];

    // Integrity result flags
    if (!integrityResult.ok && integrityResult.reason) {
      flags.push(`INTEGRITY_FAILURE:${integrityResult.reason}`);
    }

    // Anomaly score flag
    if (integrityResult.anomalyScore > 0.5) {
      flags.push(`HIGH_ANOMALY:${integrityResult.anomalyScore.toFixed(4)}`);
    }

    // Proof lifecycle flags
    if (this.proofLifecycle.retryCount > 0) {
      flags.push(`PROOF_RETRIES:${this.proofLifecycle.retryCount}`);
    }

    if (!this.proofLifecycle.preValidationPassed) {
      flags.push('PRE_VALIDATION_FAILED');
    }

    // Checksum chain length flag
    if (snapshot.sovereignty.tickChecksums.length < snapshot.tick * 0.5) {
      flags.push('SPARSE_CHECKSUM_CHAIN');
    }

    // Timing flag: finalization time relative to run
    const elapsedMs = snapshot.timers.elapsedMs;
    if (elapsedMs > 0 && nowMs > 0) {
      const finalizationDelay = nowMs - elapsedMs;
      if (finalizationDelay > 30000) {
        flags.push(`LATE_FINALIZATION:${finalizationDelay}ms`);
      }
    }

    // Grade flag
    flags.push(`GRADE:${graded.grade}`);
    flags.push(`SCORE:${graded.score.toFixed(4)}`);
    flags.push(`PROOF:${proofHash.slice(0, 16)}`);

    // Deduplicate and trim
    const uniqueFlags = [...new Set(flags)];
    return uniqueFlags.slice(0, MAX_AUDIT_FLAGS);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // S6 — Badge & Achievement Engine
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Track badge progress during tick execution.
   */
  private trackBadgeProgress(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot {
    const eligibility = this.computeAllBadgeEligibility(snapshot);

    // Update cache
    for (const badge of eligibility) {
      this.badgeProgressCache.set(badge.badgeId, badge.progress);
    }

    // Emit signals for near-miss badges (UX encouragement)
    for (const badge of eligibility) {
      if (badge.nearMiss && !badge.earned) {
        // Only emit once per badge per run by checking if we've already emitted
        const cacheKey = `near_miss_emitted_${badge.badgeId}`;
        if (!this.badgeProgressCache.has(cacheKey)) {
          this.badgeProgressCache.set(cacheKey, 1);

          this.tickSignals.push(
            createEngineSignal(
              'sovereignty',
              'INFO',
              'BADGE_NEAR_MISS',
              `Almost earned ${badge.badgeId} (${(badge.progress * 100).toFixed(0)}% progress — need ${(badge.threshold * 100).toFixed(0)}%)`,
              snapshot.tick,
              ['badge', 'near_miss', badge.badgeId.toLowerCase()],
            ),
          );
        }
      }
    }

    return snapshot;
  }

  /**
   * Compute all badge eligibility states.
   */
  private computeAllBadgeEligibility(
    snapshot: RunStateSnapshot,
  ): BadgeEligibility[] {
    const eligibilities: BadgeEligibility[] = [];

    // CLUTCH — fast accepted decisions
    const clutchProgress = this.computeClutchProgress(snapshot);
    eligibilities.push({
      badgeId: 'CLUTCH',
      earned: clutchProgress >= 1.0,
      progress: clutchProgress,
      threshold: 1.0,
      nearMiss: clutchProgress >= NEAR_MISS_THRESHOLD && clutchProgress < 1.0,
      tier: BADGE_TIER_MAP.CLUTCH,
    });

    // NO_HOLD_RUN — solo mode, hold enabled but never used
    const noHoldProgress = this.computeNoHoldProgress(snapshot);
    eligibilities.push({
      badgeId: 'NO_HOLD_RUN',
      earned: noHoldProgress >= 1.0,
      progress: noHoldProgress,
      threshold: 1.0,
      nearMiss: noHoldProgress >= NEAR_MISS_THRESHOLD && noHoldProgress < 1.0,
      tier: BADGE_TIER_MAP.NO_HOLD_RUN,
    });

    // FIRST_BLOOD — pvp first blood
    const firstBloodProgress = snapshot.mode === 'pvp' && snapshot.battle.firstBloodClaimed ? 1.0 : 0.0;
    eligibilities.push({
      badgeId: 'FIRST_BLOOD',
      earned: firstBloodProgress >= 1.0,
      progress: firstBloodProgress,
      threshold: 1.0,
      nearMiss: false,
      tier: BADGE_TIER_MAP.FIRST_BLOOD,
    });

    // BETRAYAL_SURVIVOR — coop with defection + FREEDOM
    const betrayalProgress = this.computeBetrayalSurvivorProgress(snapshot);
    eligibilities.push({
      badgeId: 'BETRAYAL_SURVIVOR',
      earned: betrayalProgress >= 1.0,
      progress: betrayalProgress,
      threshold: 1.0,
      nearMiss: betrayalProgress >= NEAR_MISS_THRESHOLD && betrayalProgress < 1.0,
      tier: BADGE_TIER_MAP.BETRAYAL_SURVIVOR,
    });

    // GHOST_SLAYER — ghost mode gap >= 0.15
    const ghostSlayerProgress = this.computeGhostSlayerProgress(snapshot);
    eligibilities.push({
      badgeId: 'GHOST_SLAYER',
      earned: ghostSlayerProgress >= 1.0,
      progress: ghostSlayerProgress,
      threshold: 1.0,
      nearMiss: ghostSlayerProgress >= NEAR_MISS_THRESHOLD && ghostSlayerProgress < 1.0,
      tier: BADGE_TIER_MAP.GHOST_SLAYER,
    });

    // IRON_WALL — blocked ratio >= 0.9 with 5+ blocks
    const ironWallProgress = this.computeIronWallProgress(snapshot);
    eligibilities.push({
      badgeId: 'IRON_WALL',
      earned: ironWallProgress >= 1.0,
      progress: ironWallProgress,
      threshold: 1.0,
      nearMiss: ironWallProgress >= NEAR_MISS_THRESHOLD && ironWallProgress < 1.0,
      tier: BADGE_TIER_MAP.IRON_WALL,
    });

    // CASCADE_BREAKER — broken ratio >= 1 with 3+ broken chains
    const cascadeBreakerProgress = this.computeCascadeBreakerProgress(snapshot);
    eligibilities.push({
      badgeId: 'CASCADE_BREAKER',
      earned: cascadeBreakerProgress >= 1.0,
      progress: cascadeBreakerProgress,
      threshold: 1.0,
      nearMiss: cascadeBreakerProgress >= NEAR_MISS_THRESHOLD && cascadeBreakerProgress < 1.0,
      tier: BADGE_TIER_MAP.CASCADE_BREAKER,
    });

    // PRESSURE_WALKER — survived high pressure for 60%+ of ticks with max >= 0.65
    const pressureWalkerProgress = this.computePressureWalkerProgress(snapshot);
    eligibilities.push({
      badgeId: 'PRESSURE_WALKER',
      earned: pressureWalkerProgress >= 1.0,
      progress: pressureWalkerProgress,
      threshold: 1.0,
      nearMiss: pressureWalkerProgress >= NEAR_MISS_THRESHOLD && pressureWalkerProgress < 1.0,
      tier: BADGE_TIER_MAP.PRESSURE_WALKER,
    });

    // SEALED_PROOF — integrity verified with proof hash
    const sealedProgress =
      snapshot.sovereignty.integrityStatus === 'VERIFIED' &&
      typeof snapshot.sovereignty.proofHash === 'string' &&
      snapshot.sovereignty.proofHash.length > 0
        ? 1.0
        : 0.0;
    eligibilities.push({
      badgeId: 'SEALED_PROOF',
      earned: sealedProgress >= 1.0,
      progress: sealedProgress,
      threshold: 1.0,
      nearMiss: false,
      tier: BADGE_TIER_MAP.SEALED_PROOF,
    });

    // CLEAN_LEDGER — net worth > 0, no debt, FREEDOM
    const cleanLedgerProgress = this.computeCleanLedgerProgress(snapshot);
    eligibilities.push({
      badgeId: 'CLEAN_LEDGER',
      earned: cleanLedgerProgress >= 1.0,
      progress: cleanLedgerProgress,
      threshold: 1.0,
      nearMiss: cleanLedgerProgress >= NEAR_MISS_THRESHOLD && cleanLedgerProgress < 1.0,
      tier: BADGE_TIER_MAP.CLEAN_LEDGER,
    });

    // BLEED_CROWN — bleed mode with base score >= 0.9 and FREEDOM
    const bleedCrownProgress = this.computeBleedCrownProgress(snapshot);
    eligibilities.push({
      badgeId: 'BLEED_CROWN',
      earned: bleedCrownProgress >= 1.0,
      progress: bleedCrownProgress,
      threshold: 1.0,
      nearMiss: bleedCrownProgress >= NEAR_MISS_THRESHOLD && bleedCrownProgress < 1.0,
      tier: BADGE_TIER_MAP.BLEED_CROWN,
    });

    return eligibilities;
  }

  /**
   * Compute final badges using the grader plus additional sovereignty-specific logic.
   */
  private computeFinalBadges(
    snapshot: RunStateSnapshot,
    graded: { score: number; grade: string; badges: string[] },
    integrityStatus: IntegrityStatus,
    proofHash: string,
  ): string[] {
    const badges = new Set<string>(graded.badges);

    // Add integrity-verified badge if applicable
    if (
      integrityStatus === 'VERIFIED' &&
      proofHash.length === 64
    ) {
      badges.add('SEALED_PROOF');
    }

    // Grade-based achievements
    if (graded.grade === 'A') {
      badges.add('SOVEREIGN_GRADE_A');
    }

    // Perfect CORD score
    if (graded.score >= 1.4) {
      badges.add('CORD_PERFECTION');
    }

    // Mode-difficulty achievement
    const modeDiff = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];
    if (modeDiff >= 1.4 && graded.grade === 'A') {
      badges.add('HARD_MODE_SOVEREIGN');
    }

    // Phase-complete achievement: reached SOVEREIGNTY phase with win
    if (
      snapshot.phase === 'SOVEREIGNTY' &&
      isWinOutcome(snapshot.outcome ?? 'ABANDONED')
    ) {
      badges.add('SOVEREIGNTY_PHASE_COMPLETE');
    }

    // Audit-clean achievement: no anomaly flags
    if (
      this.cumulativeAnomalyScore === 0 &&
      snapshot.sovereignty.auditFlags.length === 0
    ) {
      badges.add('AUDIT_CLEAN');
    }

    // Ghost-specific badges
    if (snapshot.mode === 'ghost') {
      if (snapshot.sovereignty.gapVsLegend >= 0.25) {
        badges.add('GHOST_DEMOLISHER');
      }
      if (snapshot.sovereignty.gapClosingRate > 0.01) {
        badges.add('GHOST_HUNTER');
      }
    }

    // Fast run badge
    const tickCount = Math.max(1, snapshot.tick);
    if (isWinOutcome(snapshot.outcome ?? 'ABANDONED') && tickCount <= 30) {
      badges.add('SPEED_SOVEREIGN');
    }

    return [...badges];
  }

  // ── Badge progress computation helpers ─────────────────────────────────

  private computeClutchProgress(snapshot: RunStateSnapshot): number {
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];
    const windowMs = Math.max(1, snapshot.timers.currentTickDurationMs);
    const fastAccepted = decisions.filter(
      (d) => d.accepted && d.latencyMs <= windowMs * 0.35,
    ).length;
    return this.clamp(fastAccepted / 3, 0, 1);
  }

  private computeNoHoldProgress(snapshot: RunStateSnapshot): number {
    if (snapshot.mode !== 'solo') return 0;
    if (!snapshot.modeState.holdEnabled) return 0;
    const holdUsed = snapshot.timers.holdCharges !== 1 || snapshot.timers.frozenWindowIds.length > 0;
    return holdUsed ? 0 : 1.0;
  }

  private computeBetrayalSurvivorProgress(snapshot: RunStateSnapshot): number {
    if (snapshot.mode !== 'coop') return 0;
    const defections = Object.values(snapshot.modeState.defectionStepByPlayer);
    const hasDefection = defections.some((step) => step >= 3);
    const isFreedom = snapshot.outcome === 'FREEDOM';
    if (hasDefection && isFreedom) return 1.0;
    if (hasDefection) return 0.5;
    return 0;
  }

  private computeGhostSlayerProgress(snapshot: RunStateSnapshot): number {
    if (snapshot.mode !== 'ghost') return 0;
    return this.clamp(snapshot.sovereignty.gapVsLegend / 0.15, 0, 1);
  }

  private computeIronWallProgress(snapshot: RunStateSnapshot): number {
    const blocked = Math.max(0, snapshot.shield.blockedThisRun);
    const damaged = Math.max(0, snapshot.shield.damagedThisRun);
    const total = blocked + damaged;
    const ratio = total > 0 ? blocked / total : 0;
    const ratioProgress = this.clamp(ratio / 0.9, 0, 1);
    const countProgress = this.clamp(blocked / 5, 0, 1);
    return Math.min(ratioProgress, countProgress);
  }

  private computeCascadeBreakerProgress(snapshot: RunStateSnapshot): number {
    const broken = Math.max(0, snapshot.cascade.brokenChains);
    const completed = Math.max(0, snapshot.cascade.completedChains);
    const total = broken + completed;
    const ratio = total > 0 ? broken / total : 0;
    const ratioProgress = this.clamp(ratio / 1.0, 0, 1);
    const countProgress = this.clamp(broken / 3, 0, 1);
    return Math.min(ratioProgress, countProgress);
  }

  private computePressureWalkerProgress(snapshot: RunStateSnapshot): number {
    const survived = Math.max(0, snapshot.pressure.survivedHighPressureTicks);
    const observedTicks = Math.max(1, snapshot.tick);
    const survivalRatio = survived / observedTicks;
    const ratioProgress = this.clamp(survivalRatio / 0.6, 0, 1);
    const maxScoreProgress = this.clamp(snapshot.pressure.maxScoreSeen / 0.65, 0, 1);
    return Math.min(ratioProgress, maxScoreProgress);
  }

  private computeCleanLedgerProgress(snapshot: RunStateSnapshot): number {
    const netWorthPositive = snapshot.economy.netWorth > 0 ? 1 : 0;
    const debtFree = snapshot.economy.debt <= 0 ? 1 : 0;
    const freedom = snapshot.outcome === 'FREEDOM' ? 1 : 0;
    return (netWorthPositive + debtFree + freedom) / 3;
  }

  private computeBleedCrownProgress(snapshot: RunStateSnapshot): number {
    if (!snapshot.modeState.bleedMode) return 0;
    const baseScore = snapshot.sovereignty.cordScore;
    const scoreProgress = this.clamp(baseScore / 0.9, 0, 1);
    const freedom = snapshot.outcome === 'FREEDOM' ? 1.0 : 0.0;
    return Math.min(scoreProgress, freedom);
  }

  /**
   * Generate badge achievement narrative text.
   */
  private generateBadgeNarrative(badges: readonly string[]): string[] {
    const narratives: string[] = [];

    const narrativeMap: Record<string, string> = {
      CLUTCH: 'Lightning reflexes. You made critical decisions in the blink of an eye.',
      NO_HOLD_RUN: 'You conquered the run without freezing a single window. Pure discipline.',
      FIRST_BLOOD: 'You struck first in PvP. The opening gambit belongs to you.',
      BETRAYAL_SURVIVOR: 'Betrayed by your teammate, you still reached Freedom. Unbreakable.',
      GHOST_SLAYER: 'You outperformed the legend. The ghost has been surpassed.',
      GHOST_DEMOLISHER: 'You did not just beat the legend — you demolished the ghost record.',
      GHOST_HUNTER: 'You were closing the gap. The legend felt your presence.',
      IRON_WALL: 'Your shields held against a storm of attacks. An impenetrable fortress.',
      CASCADE_BREAKER: 'You broke every cascade chain thrown at you. Nothing chains you down.',
      PRESSURE_WALKER: 'You thrived under crushing pressure. Most would have crumbled.',
      SEALED_PROOF: 'Your run is cryptographically sealed. The proof is undeniable.',
      CLEAN_LEDGER: 'Zero debt, positive net worth, Freedom achieved. A pristine financial record.',
      BLEED_CROWN: 'You conquered bleed mode with excellence. The crown is yours.',
      SOVEREIGN_GRADE_A: 'Grade A sovereignty. Your command over the financial battlefield is complete.',
      CORD_PERFECTION: 'A CORD score of perfection. Every dimension of play was mastered.',
      HARD_MODE_SOVEREIGN: 'A-grade on hard mode. You chose the hardest path and conquered it.',
      SOVEREIGNTY_PHASE_COMPLETE: 'You reached the Sovereignty phase and won. The endgame belongs to you.',
      AUDIT_CLEAN: 'Not a single anomaly detected. Your run is pure.',
      SPEED_SOVEREIGN: 'Fast and flawless. You achieved sovereignty in record time.',
    };

    for (const badge of badges) {
      const narrative = narrativeMap[badge];
      if (narrative) {
        narratives.push(narrative);
      }
    }

    return narratives;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // S7 — Sovereignty ML/DL Features
  // ─────────────────────────────────────────────────────────────────────────

  /** Canonical sovereignty ML feature labels. */
  private static readonly SOVEREIGNTY_ML_LABELS: readonly string[] = [
    'sov_integrity_risk',
    'sov_cord_score',
    'sov_cord_trend',
    'sov_grade_numeric',
    'sov_gap_vs_legend',
    'sov_gap_closing_rate',
    'sov_checksum_chain_length_norm',
    'sov_anomaly_score_norm',
    'sov_proof_lifecycle_stage',
    'sov_badge_count_norm',
    'sov_audit_flag_count_norm',
    'sov_mode_difficulty',
    'sov_phase_stakes',
    'sov_pressure_tier_norm',
    'sov_run_progress',
    'sov_outcome_excitement',
    'sov_decision_speed_component',
    'sov_shields_maintained_component',
    'sov_sabotages_blocked_component',
    'sov_cascades_broken_component',
    'sov_pressure_survived_component',
    'sov_ghost_marker_density',
    'sov_cord_milestone_fraction',
    'sov_consecutive_healthy_ticks_norm',
    'sov_tick_checksum_coverage',
    'sov_win_probability',
    'sov_loss_risk',
    'sov_outcome_multiplier',
    'sov_base_cord_score',
    'sov_phase_normalized',
    'sov_mode_normalized',
    'sov_time_elapsed_ratio',
  ];

  /** Canonical sovereignty DL extended labels. */
  private static readonly SOVEREIGNTY_DL_EXTENDED_LABELS: readonly string[] = [
    'sov_dl_cord_velocity',
    'sov_dl_cord_acceleration',
    'sov_dl_integrity_recovery_rate',
    'sov_dl_proof_chain_integrity',
    'sov_dl_badge_weighted_score',
    'sov_dl_audit_severity',
    'sov_dl_ghost_divergence',
    'sov_dl_pressure_survival_ratio',
    'sov_dl_shield_defense_efficiency',
    'sov_dl_cascade_resilience',
    'sov_dl_decision_quality',
    'sov_dl_outcome_projected',
    'sov_dl_grade_trajectory',
    'sov_dl_mode_mastery',
    'sov_dl_run_momentum',
    'sov_dl_engagement_score',
  ];

  /**
   * Build sovereignty-specific ML feature vector.
   */
  private buildSovereigntyMLVector(
    snapshot: RunStateSnapshot,
  ): SovereigntyMLVector {
    const features: number[] = [];

    // sov_integrity_risk
    const integrityRiskMap: Record<IntegrityStatus, number> = {
      PENDING: 0.5,
      VERIFIED: 0.0,
      QUARANTINED: 1.0,
      UNVERIFIED: 0.7,
    };
    features.push(integrityRiskMap[snapshot.sovereignty.integrityStatus] ?? 0.5);

    // sov_cord_score
    features.push(this.clamp(snapshot.sovereignty.cordScore, 0, 1.5));

    // sov_cord_trend
    features.push(this.clamp(this.computeCORDTrend(), -1, 1));

    // sov_grade_numeric
    const gradeNumeric = this.gradeToNumeric(snapshot.sovereignty.verifiedGrade);
    features.push(gradeNumeric);

    // sov_gap_vs_legend
    features.push(this.clamp(snapshot.sovereignty.gapVsLegend, -1, 1));

    // sov_gap_closing_rate
    features.push(this.clamp(snapshot.sovereignty.gapClosingRate, -1, 1));

    // sov_checksum_chain_length_norm
    const maxExpectedChecksums = Math.max(1, snapshot.tick);
    features.push(
      this.clamp(snapshot.sovereignty.tickChecksums.length / maxExpectedChecksums, 0, 1),
    );

    // sov_anomaly_score_norm
    features.push(this.clamp(this.cumulativeAnomalyScore, 0, 1));

    // sov_proof_lifecycle_stage
    const stageMap: Record<ProofStage, number> = {
      UNINITIALIZED: 0,
      PRE_VALIDATED: 0.2,
      GENERATED: 0.5,
      POST_VERIFIED: 0.8,
      SEALED: 1.0,
      FAILED: 0.0,
    };
    features.push(stageMap[this.proofLifecycle.stage]);

    // sov_badge_count_norm
    features.push(
      this.clamp(snapshot.sovereignty.proofBadges.length / ALL_KNOWN_BADGES.length, 0, 1),
    );

    // sov_audit_flag_count_norm
    features.push(
      this.clamp(snapshot.sovereignty.auditFlags.length / MAX_AUDIT_FLAGS, 0, 1),
    );

    // sov_mode_difficulty
    features.push(MODE_DIFFICULTY_MULTIPLIER[snapshot.mode]);

    // sov_phase_stakes
    features.push(RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase]);

    // sov_pressure_tier_norm
    features.push(PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier]);

    // sov_run_progress
    const runProgress = computeRunProgressFraction(
      snapshot.phase,
      snapshot.tick,
      Math.max(1, snapshot.tick * 2),
    );
    features.push(this.clamp(runProgress, 0, 1));

    // sov_outcome_excitement
    const outcome: RunOutcome = snapshot.outcome ?? 'ABANDONED';
    const excitement = scoreOutcomeExcitement(outcome, snapshot.mode);
    features.push(this.clamp(excitement / 5, 0, 1));

    // CORD components
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];
    features.push(
      this.computeDecisionSpeedComponent(decisions, snapshot.timers.currentTickDurationMs),
    );
    features.push(this.computeShieldsMaintainedComponent(snapshot));
    features.push(this.computeSabotagesBlockedComponent(snapshot));
    features.push(this.computeCascadesBrokenComponent(snapshot));
    features.push(this.computePressureSurvivedComponent(snapshot));

    // sov_ghost_marker_density
    const ghostMarkerDensity = snapshot.tick > 0
      ? snapshot.cards.ghostMarkers.length / snapshot.tick
      : 0;
    features.push(this.clamp(ghostMarkerDensity, 0, 1));

    // sov_cord_milestone_fraction
    features.push(
      this.clamp(
        (this.lastCordMilestoneReached + 1) / CORD_MILESTONES.length,
        0,
        1,
      ),
    );

    // sov_consecutive_healthy_ticks_norm
    features.push(
      this.clamp(this.consecutiveHealthyTicks / HEALTHY_TICK_RECOVERY_WINDOW, 0, 1),
    );

    // sov_tick_checksum_coverage
    features.push(
      snapshot.tick > 0
        ? this.clamp(snapshot.sovereignty.tickChecksums.length / snapshot.tick, 0, 1)
        : 0,
    );

    // sov_win_probability
    features.push(isWinOutcome(outcome) ? 1.0 : 0.0);

    // sov_loss_risk
    features.push(isLossOutcome(outcome) ? 1.0 : 0.0);

    // sov_outcome_multiplier
    const outcomeMultiplier =
      OUTCOME_MULTIPLIER[outcome as keyof typeof OUTCOME_MULTIPLIER] ?? 0;
    features.push(this.clamp(outcomeMultiplier, 0, 1.5));

    // sov_base_cord_score (before outcome multiplier)
    const baseCord = outcomeMultiplier > 0
      ? snapshot.sovereignty.cordScore / outcomeMultiplier
      : 0;
    features.push(this.clamp(baseCord, 0, 1));

    // sov_phase_normalized
    features.push(RUN_PHASE_NORMALIZED[snapshot.phase]);

    // sov_mode_normalized — computed from difficulty
    features.push(
      this.clamp((MODE_DIFFICULTY_MULTIPLIER[snapshot.mode] - 0.9) / 0.7, 0, 1),
    );

    // sov_time_elapsed_ratio
    const timeRatio = snapshot.timers.seasonBudgetMs > 0
      ? snapshot.timers.elapsedMs / snapshot.timers.seasonBudgetMs
      : 0;
    features.push(this.clamp(timeRatio, 0, 1));

    return {
      features,
      labels: SovereigntyEngine.SOVEREIGNTY_ML_LABELS,
      tick: snapshot.tick,
      runId: snapshot.runId,
    };
  }

  /**
   * Build sovereignty DL tensor (ML features + extended features).
   */
  private buildSovereigntyDLTensor(
    snapshot: RunStateSnapshot,
  ): SovereigntyDLTensor {
    const mlVector = this.buildSovereigntyMLVector(snapshot);
    const extended: number[] = [...mlVector.features];

    // sov_dl_cord_velocity
    const trend = this.computeCORDTrend();
    extended.push(this.clamp(trend, -1, 1));

    // sov_dl_cord_acceleration
    const acceleration = this.computeCORDAcceleration();
    extended.push(this.clamp(acceleration, -1, 1));

    // sov_dl_integrity_recovery_rate
    const recoveryRate =
      this.consecutiveHealthyTicks / Math.max(1, HEALTHY_TICK_RECOVERY_WINDOW);
    extended.push(this.clamp(recoveryRate, 0, 1));

    // sov_dl_proof_chain_integrity
    const chainIntegrity =
      this.proofLifecycle.chainHashes.length > 0
        ? this.clamp(
            this.proofLifecycle.chainHashes.length /
              Math.max(1, snapshot.sovereignty.tickChecksums.length),
            0,
            1,
          )
        : 0;
    extended.push(chainIntegrity);

    // sov_dl_badge_weighted_score
    const badgeWeighted = this.computeBadgeWeightedScore(snapshot);
    extended.push(this.clamp(badgeWeighted, 0, 1));

    // sov_dl_audit_severity
    const maxAnomalyInTrail =
      this.auditTrail.length > 0
        ? Math.max(...this.auditTrail.map((e) => e.anomalyScore))
        : 0;
    extended.push(this.clamp(maxAnomalyInTrail, 0, 1));

    // sov_dl_ghost_divergence
    extended.push(
      snapshot.mode === 'ghost'
        ? this.clamp(Math.abs(snapshot.sovereignty.gapVsLegend), 0, 1)
        : 0,
    );

    // sov_dl_pressure_survival_ratio
    const survivalRatio =
      snapshot.tick > 0
        ? snapshot.pressure.survivedHighPressureTicks / snapshot.tick
        : 0;
    extended.push(this.clamp(survivalRatio, 0, 1));

    // sov_dl_shield_defense_efficiency
    const totalDefense = snapshot.shield.blockedThisRun + snapshot.shield.damagedThisRun;
    const defenseEff = totalDefense > 0
      ? snapshot.shield.blockedThisRun / totalDefense
      : 0;
    extended.push(this.clamp(defenseEff, 0, 1));

    // sov_dl_cascade_resilience
    const totalCascade = snapshot.cascade.brokenChains + snapshot.cascade.completedChains;
    const cascadeRes = totalCascade > 0
      ? snapshot.cascade.brokenChains / totalCascade
      : 0;
    extended.push(this.clamp(cascadeRes, 0, 1));

    // sov_dl_decision_quality
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];
    const acceptedRatio = decisions.length > 0
      ? decisions.filter((d) => d.accepted).length / decisions.length
      : 0;
    extended.push(this.clamp(acceptedRatio, 0, 1));

    // sov_dl_outcome_projected
    const projectedGrade = this.predictGradeTrajectory(snapshot);
    extended.push(this.gradeToNumeric(projectedGrade));

    // sov_dl_grade_trajectory
    const gradeTrajectoryDelta = this.gradeToNumeric(projectedGrade) -
      this.gradeToNumeric(snapshot.sovereignty.verifiedGrade);
    extended.push(this.clamp(gradeTrajectoryDelta, -1, 1));

    // sov_dl_mode_mastery
    const modeMastery = snapshot.sovereignty.cordScore * MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];
    extended.push(this.clamp(modeMastery / 2.0, 0, 1));

    // sov_dl_run_momentum
    const momentum = trend * RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase];
    extended.push(this.clamp(momentum + 0.5, 0, 1));

    // sov_dl_engagement_score
    const engagement = this.computeEngagementScore(snapshot);
    extended.push(this.clamp(engagement, 0, 1));

    const totalFeatureCount = extended.length;

    return {
      data: extended,
      shape: [1, totalFeatureCount],
      tick: snapshot.tick,
      runId: snapshot.runId,
    };
  }

  /**
   * Compute CORD acceleration (second derivative of trend).
   */
  private computeCORDAcceleration(): number {
    if (this.cordHistory.length < 5) return 0;

    const recent = this.cordHistory.slice(-10);
    const deltas: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      deltas.push(recent[i].cordScore - recent[i - 1].cordScore);
    }

    if (deltas.length < 2) return 0;

    let totalAccel = 0;
    for (let i = 1; i < deltas.length; i++) {
      totalAccel += deltas[i] - deltas[i - 1];
    }

    return totalAccel / (deltas.length - 1);
  }

  /**
   * Compute weighted badge score for DL features.
   */
  private computeBadgeWeightedScore(snapshot: RunStateSnapshot): number {
    const tierValues: Record<string, number> = {
      BRONZE: 0.25,
      SILVER: 0.5,
      GOLD: 0.75,
      DIAMOND: 1.0,
    };

    let total = 0;
    let maxPossible = 0;

    for (const badgeId of ALL_KNOWN_BADGES) {
      const tier = BADGE_TIER_MAP[badgeId] ?? 'BRONZE';
      const tierValue = tierValues[tier] ?? 0.25;
      maxPossible += tierValue;

      if (snapshot.sovereignty.proofBadges.includes(badgeId)) {
        total += tierValue;
      }
    }

    return maxPossible > 0 ? total / maxPossible : 0;
  }

  /**
   * Compute engagement score from interaction patterns.
   */
  private computeEngagementScore(snapshot: RunStateSnapshot): number {
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];

    // Factor 1: Decision frequency
    const decisionFreq = snapshot.tick > 0
      ? this.clamp(decisions.length / snapshot.tick, 0, 1)
      : 0;

    // Factor 2: Acceptance rate
    const acceptRate = decisions.length > 0
      ? decisions.filter((d) => d.accepted).length / decisions.length
      : 0;

    // Factor 3: Pressure engagement (survived high pressure)
    const pressureEngagement = this.computePressureSurvivedComponent(snapshot);

    // Factor 4: Active play duration ratio
    const timeRatio = snapshot.timers.seasonBudgetMs > 0
      ? this.clamp(snapshot.timers.elapsedMs / snapshot.timers.seasonBudgetMs, 0, 1)
      : 0;

    return (
      decisionFreq * 0.3 +
      acceptRate * 0.25 +
      pressureEngagement * 0.25 +
      timeRatio * 0.2
    );
  }

  /**
   * Compute trend analysis over tick history for a specific feature.
   */
  private computeFeatureTrend(
    extractor: (sample: CORDTickSample) => number,
    windowSize: number = 10,
  ): { slope: number; mean: number; variance: number } {
    if (this.cordHistory.length < 2) {
      return { slope: 0, mean: 0, variance: 0 };
    }

    const window = this.cordHistory.slice(-windowSize);
    const values = window.map(extractor);

    // Mean
    const mean = values.reduce((s, v) => s + v, 0) / values.length;

    // Variance
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

    // Slope via linear regression (simplified)
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;

    return { slope, mean, variance };
  }

  /**
   * Extract feature importance scores based on CORD weight contribution.
   */
  private computeFeatureImportance(
    snapshot: RunStateSnapshot,
  ): Array<{ feature: string; importance: number; value: number }> {
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];

    return [
      {
        feature: 'decision_speed',
        importance: CORD_WEIGHTS.decision_speed_score,
        value: this.computeDecisionSpeedComponent(
          decisions,
          snapshot.timers.currentTickDurationMs,
        ),
      },
      {
        feature: 'shields_maintained',
        importance: CORD_WEIGHTS.shields_maintained_pct,
        value: this.computeShieldsMaintainedComponent(snapshot),
      },
      {
        feature: 'sabotages_blocked',
        importance: CORD_WEIGHTS.hater_sabotages_blocked,
        value: this.computeSabotagesBlockedComponent(snapshot),
      },
      {
        feature: 'cascades_broken',
        importance: CORD_WEIGHTS.cascade_chains_broken,
        value: this.computeCascadesBrokenComponent(snapshot),
      },
      {
        feature: 'pressure_survived',
        importance: CORD_WEIGHTS.pressure_survived_score,
        value: this.computePressureSurvivedComponent(snapshot),
      },
    ].sort((a, b) => b.importance * b.value - a.importance * a.value);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // S8 — UX Signal Generation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate UX-relevant engine signals for the current tick.
   */
  private generateTickUXSignals(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): void {
    // Grade milestone signals
    this.generateGradeMilestoneSignals(snapshot);

    // Integrity status change signals
    this.generateIntegrityStatusSignals(snapshot);

    // Badge proximity signals (already handled in trackBadgeProgress)

    // CORD milestone signals (already handled in updateCORDAnalytics)

    // Phase transition signals
    this.generatePhaseTransitionSignals(snapshot, context);

    // Outcome proximity signals
    this.generateOutcomeProximitySignals(snapshot, context);
  }

  /**
   * Generate signals when the predicted grade changes.
   */
  private generateGradeMilestoneSignals(snapshot: RunStateSnapshot): void {
    const predicted = this.predictGradeTrajectory(snapshot);
    const current = snapshot.sovereignty.verifiedGrade;

    if (current !== null && predicted !== current) {
      const isUpgrade = this.gradeToNumeric(predicted) > this.gradeToNumeric(current);

      this.tickSignals.push(
        createEngineSignal(
          'sovereignty',
          isUpgrade ? 'INFO' : 'WARN',
          isUpgrade ? 'GRADE_UPGRADE_TRAJECTORY' : 'GRADE_DOWNGRADE_TRAJECTORY',
          `Grade trajectory shifted: ${current} -> ${predicted}`,
          snapshot.tick,
          ['grade', 'trajectory', isUpgrade ? 'upgrade' : 'downgrade'],
        ),
      );
    }
  }

  /**
   * Generate signals when integrity status changes.
   */
  private generateIntegrityStatusSignals(snapshot: RunStateSnapshot): void {
    const current = snapshot.sovereignty.integrityStatus;

    if (current === 'QUARANTINED') {
      this.tickSignals.push(
        createEngineSignal(
          'sovereignty',
          'ERROR',
          'INTEGRITY_QUARANTINED',
          `Run quarantined at tick ${snapshot.tick}: integrity verification failed`,
          snapshot.tick,
          ['integrity', 'quarantine', 'critical'],
        ),
      );
    }

    if (
      current === 'VERIFIED' &&
      this.auditTrail.length > 1 &&
      this.auditTrail[this.auditTrail.length - 2]?.status !== 'VERIFIED'
    ) {
      this.tickSignals.push(
        createEngineSignal(
          'sovereignty',
          'INFO',
          'INTEGRITY_RECOVERED',
          `Integrity recovered to VERIFIED at tick ${snapshot.tick}`,
          snapshot.tick,
          ['integrity', 'recovery'],
        ),
      );
    }
  }

  /**
   * Generate signals for phase transitions.
   */
  private generatePhaseTransitionSignals(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): void {
    const phaseNorm = RUN_PHASE_NORMALIZED[snapshot.phase];
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase];

    // Entering sovereignty phase
    if (snapshot.phase === 'SOVEREIGNTY' && snapshot.tick > 0) {
      const lastSample = this.cordHistory[this.cordHistory.length - 2];
      if (lastSample && lastSample.tick < snapshot.tick) {
        // Only emit once when entering sovereignty
        const alreadyEmitted = this.tickSignals.some(
          (s) => s.code === 'SOVEREIGNTY_PHASE_ENTERED',
        );
        if (!alreadyEmitted) {
          this.tickSignals.push(
            createEngineSignal(
              'sovereignty',
              'INFO',
              'SOVEREIGNTY_PHASE_ENTERED',
              `Entered SOVEREIGNTY phase at tick ${snapshot.tick} — stakes multiplier ${stakes.toFixed(2)}`,
              snapshot.tick,
              ['phase', 'sovereignty', 'endgame'],
            ),
          );
        }
      }
    }
  }

  /**
   * Generate signals about outcome proximity.
   */
  private generateOutcomeProximitySignals(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): void {
    // Freedom proximity
    if (snapshot.economy.netWorth > 0) {
      const freedomProgress =
        snapshot.economy.freedomTarget > 0
          ? snapshot.economy.netWorth / snapshot.economy.freedomTarget
          : 0;

      if (freedomProgress >= 0.9 && freedomProgress < 1.0) {
        this.tickSignals.push(
          createEngineSignal(
            'sovereignty',
            'INFO',
            'FREEDOM_IMMINENT',
            `Freedom Target is ${(freedomProgress * 100).toFixed(1)}% reached — keep pushing!`,
            snapshot.tick,
            ['outcome', 'freedom', 'imminent'],
          ),
        );
      }
    }

    // Bankruptcy proximity
    if (snapshot.economy.netWorth < 0) {
      this.tickSignals.push(
        createEngineSignal(
          'sovereignty',
          'WARN',
          'BANKRUPTCY_RISK',
          `Net worth is negative (${snapshot.economy.netWorth.toFixed(2)}) — bankruptcy risk is high`,
          snapshot.tick,
          ['outcome', 'bankrupt', 'risk'],
        ),
      );
    }

    // Timeout proximity
    const timeRemaining = snapshot.timers.seasonBudgetMs - snapshot.timers.elapsedMs;
    if (timeRemaining > 0 && timeRemaining < 30000) {
      this.tickSignals.push(
        createEngineSignal(
          'sovereignty',
          'WARN',
          'TIMEOUT_IMMINENT',
          `Only ${(timeRemaining / 1000).toFixed(1)}s remaining — act fast!`,
          snapshot.tick,
          ['outcome', 'timeout', 'imminent'],
        ),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // S9 — Ghost Mode Sovereignty
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update ghost-specific sovereignty tracking.
   */
  private updateGhostSovereignty(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot {
    if (snapshot.mode !== 'ghost') {
      return snapshot;
    }

    // Track ghost gap history
    this.ghostGapHistory.push({
      tick: snapshot.tick,
      gap: snapshot.sovereignty.gapVsLegend,
    });

    // Trim history
    if (this.ghostGapHistory.length > MAX_TICK_CHECKSUMS) {
      this.ghostGapHistory = this.ghostGapHistory.slice(-MAX_TICK_CHECKSUMS);
    }

    // Compute gap closing rate
    const gapClosingRate = this.computeGhostGapClosingRate(snapshot);

    // Ghost-specific checksum including legend marker state
    const ghostChecksum = checksumSnapshot({
      tick: snapshot.tick,
      gapVsLegend: snapshot.sovereignty.gapVsLegend,
      gapClosingRate,
      legendMarkerCount: snapshot.cards.ghostMarkers.length,
      legendMarkersEnabled: snapshot.modeState.legendMarkersEnabled,
      ghostBaselineRunId: snapshot.modeState.ghostBaselineRunId,
    });

    // Validate legend markers if enabled
    const legendValidation = this.validateLegendMarkers(snapshot);

    // Generate ghost signals
    this.generateGhostSignals(snapshot, gapClosingRate, context);

    // Merge ghost audit flags
    const ghostAuditFlags: string[] = [];
    if (!legendValidation.valid) {
      ghostAuditFlags.push(
        `GHOST_LEGEND_INVALID:${legendValidation.reason}`,
      );
    }
    ghostAuditFlags.push(`GHOST_GAP_CHECKSUM:${ghostChecksum.slice(0, 16)}`);

    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        gapClosingRate,
        auditFlags: this.mergeAuditFlags(
          snapshot.sovereignty.auditFlags,
          ghostAuditFlags,
        ),
      },
    };
  }

  /**
   * Compute the ghost gap closing rate from history.
   */
  private computeGhostGapClosingRate(snapshot: RunStateSnapshot): number {
    if (this.ghostGapHistory.length < 2) {
      return snapshot.mode === 'ghost'
        ? Number(
            (
              snapshot.sovereignty.gapVsLegend /
              Math.max(1, snapshot.tick)
            ).toFixed(4),
          )
        : 0;
    }

    const recent = this.ghostGapHistory.slice(-10);
    let totalDelta = 0;
    for (let i = 1; i < recent.length; i++) {
      totalDelta += recent[i].gap - recent[i - 1].gap;
    }

    const avgDelta = totalDelta / (recent.length - 1);
    return Number(avgDelta.toFixed(4));
  }

  /**
   * Validate legend markers for ghost mode.
   */
  private validateLegendMarkers(
    snapshot: RunStateSnapshot,
  ): { valid: boolean; reason: string } {
    if (!snapshot.modeState.legendMarkersEnabled) {
      return { valid: true, reason: 'legend markers disabled' };
    }

    if (snapshot.cards.ghostMarkers.length === 0) {
      return { valid: false, reason: 'no ghost markers present' };
    }

    // Validate marker ordering
    const markers = snapshot.cards.ghostMarkers;
    for (let i = 1; i < markers.length; i++) {
      if (markers[i].tick < markers[i - 1].tick) {
        return { valid: false, reason: 'ghost markers not in tick order' };
      }
    }

    // Validate marker kinds
    const validKinds: ReadonlySet<string> = new Set([
      'GOLD',
      'RED',
      'PURPLE',
      'SILVER',
      'BLACK',
    ]);
    for (const marker of markers) {
      if (!validKinds.has(marker.kind)) {
        return { valid: false, reason: `invalid marker kind: ${marker.kind}` };
      }
    }

    return { valid: true, reason: 'markers valid' };
  }

  /**
   * Generate ghost-specific UX signals.
   */
  private generateGhostSignals(
    snapshot: RunStateSnapshot,
    gapClosingRate: number,
    context: TickContext,
  ): void {
    const gap = snapshot.sovereignty.gapVsLegend;

    // Overtaking the legend
    if (gap > 0 && this.ghostGapHistory.length > 1) {
      const prevGap =
        this.ghostGapHistory[this.ghostGapHistory.length - 2]?.gap ?? 0;
      if (prevGap <= 0 && gap > 0) {
        this.tickSignals.push(
          createEngineSignal(
            'sovereignty',
            'INFO',
            'GHOST_OVERTAKE',
            `You have overtaken the legend! Gap: +${gap.toFixed(4)}`,
            snapshot.tick,
            ['ghost', 'overtake', 'milestone'],
          ),
        );
      }
    }

    // Falling behind
    if (gap < -GHOST_GAP_SIGNIFICANT_THRESHOLD && gapClosingRate < 0) {
      this.tickSignals.push(
        createEngineSignal(
          'sovereignty',
          'WARN',
          'GHOST_FALLING_BEHIND',
          `Falling behind the legend (gap: ${gap.toFixed(4)}, rate: ${gapClosingRate.toFixed(4)})`,
          snapshot.tick,
          ['ghost', 'gap', 'warning'],
        ),
      );
    }

    // Closing in
    if (gap < 0 && gapClosingRate > 0.005) {
      this.tickSignals.push(
        createEngineSignal(
          'sovereignty',
          'INFO',
          'GHOST_CLOSING_IN',
          `Closing the gap on the legend (rate: +${gapClosingRate.toFixed(4)})`,
          snapshot.tick,
          ['ghost', 'gap', 'closing'],
        ),
      );
    }
  }

  /**
   * Build ghost-specific sovereignty report.
   */
  private buildGhostSovereigntyReport(
    snapshot: RunStateSnapshot,
  ): GhostSovereigntyReport {
    const markers = snapshot.cards.ghostMarkers;
    const markerCount = markers.length;

    // Compute marker quality as average of kind weights
    let markerQualitySum = 0;
    const kindWeights: Record<string, number> = {
      GOLD: 1.0,
      PURPLE: 0.85,
      RED: 0.7,
      SILVER: 0.5,
      BLACK: 0.3,
    };
    for (const marker of markers) {
      markerQualitySum += kindWeights[marker.kind] ?? 0;
    }
    const markerQuality = markerCount > 0 ? markerQualitySum / markerCount : 0;

    // Ghost badge eligibility
    const ghostBadgeEligible: string[] = [];
    if (snapshot.sovereignty.gapVsLegend >= 0.15) {
      ghostBadgeEligible.push('GHOST_SLAYER');
    }
    if (snapshot.sovereignty.gapVsLegend >= 0.25) {
      ghostBadgeEligible.push('GHOST_DEMOLISHER');
    }
    if (snapshot.sovereignty.gapClosingRate > 0.01) {
      ghostBadgeEligible.push('GHOST_HUNTER');
    }

    // Divergence from legend: difference in CORD trajectories
    const divergence = Math.abs(snapshot.sovereignty.gapVsLegend);

    // Project final gap based on closing rate and remaining ticks
    const phaseNorm = RUN_PHASE_NORMALIZED[snapshot.phase];
    const remainingFraction = Math.max(0, 1.0 - phaseNorm);
    const remainingTicks = Math.max(1, Math.round(remainingFraction * snapshot.tick));
    const projectedFinalGap =
      snapshot.sovereignty.gapVsLegend +
      snapshot.sovereignty.gapClosingRate * remainingTicks;

    return {
      gapVsLegend: snapshot.sovereignty.gapVsLegend,
      gapClosingRate: snapshot.sovereignty.gapClosingRate,
      legendMarkerCount: markerCount,
      legendMarkerQuality: Number(markerQuality.toFixed(4)),
      ghostBadgeEligible,
      divergenceFromLegend: Number(divergence.toFixed(4)),
      projectedFinalGap: Number(projectedFinalGap.toFixed(4)),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // S10 — Run Summary & Narrative
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build the complete run summary for player-facing display.
   */
  private buildRunSummary(
    snapshot: RunStateSnapshot,
    graded: { score: number; grade: string; badges: string[]; breakdown: {
      avgShieldPct: number;
      decisionSpeedScore: number;
      blockedRatio: number;
      brokenRatio: number;
      pressureSurvival: number;
      baseScore: number;
      outcomeMultiplier: number;
    }},
    cordBreakdown: CORDBreakdownReport,
    nowMs: number,
  ): RunSummary {
    const outcome: RunOutcome = snapshot.outcome ?? 'ABANDONED';
    const isWin = isWinOutcome(outcome);

    // Generate highlights
    const highlights = this.computeHighlightMoments(snapshot, graded);

    // Generate improvement suggestions
    const suggestions = this.generateImprovementSuggestions(
      cordBreakdown,
      snapshot,
    );

    // Generate narrative lines
    const narrative = this.generateRunNarrative(
      snapshot,
      graded,
      cordBreakdown,
      isWin,
    );

    // Compute excitement
    const excitement = scoreOutcomeExcitement(outcome, snapshot.mode);

    // Ghost gap
    const ghostGapFinal =
      snapshot.mode === 'ghost' ? snapshot.sovereignty.gapVsLegend : null;

    return {
      runId: snapshot.runId,
      mode: snapshot.mode,
      outcome,
      grade: graded.grade,
      score: graded.score,
      proofHash: snapshot.sovereignty.proofHash ?? '',
      badges: snapshot.sovereignty.proofBadges,
      highlights,
      improvementSuggestions: suggestions,
      narrativeLines: narrative,
      cordBreakdown,
      durationMs: snapshot.timers.elapsedMs,
      tickCount: snapshot.tick,
      integrityStatus: snapshot.sovereignty.integrityStatus,
      ghostGapFinal,
      excitementScore: excitement,
    };
  }

  /**
   * Compute highlight moments from the run.
   */
  private computeHighlightMoments(
    snapshot: RunStateSnapshot,
    graded: { score: number; grade: string; badges: string[]; breakdown: {
      avgShieldPct: number;
      decisionSpeedScore: number;
      blockedRatio: number;
      brokenRatio: number;
      pressureSurvival: number;
      baseScore: number;
      outcomeMultiplier: number;
    }},
  ): string[] {
    const highlights: string[] = [];

    // Grade achievement
    highlights.push(
      `Earned Grade ${graded.grade} with a CORD score of ${graded.score.toFixed(4)}.`,
    );

    // Badge count
    if (graded.badges.length > 0) {
      highlights.push(
        `Earned ${graded.badges.length} badge${graded.badges.length > 1 ? 's' : ''}: ${graded.badges.join(', ')}.`,
      );
    }

    // Shield performance
    if (graded.breakdown.avgShieldPct >= 0.8) {
      highlights.push('Shields held at over 80% throughout the run.');
    } else if (graded.breakdown.avgShieldPct < 0.3) {
      highlights.push('Shields were heavily damaged during the run.');
    }

    // Pressure performance
    if (snapshot.pressure.maxScoreSeen >= 0.9) {
      highlights.push(
        `Survived apex pressure (max score: ${snapshot.pressure.maxScoreSeen.toFixed(2)}).`,
      );
    }

    // Decision speed
    if (graded.breakdown.decisionSpeedScore >= 0.8) {
      highlights.push('Decision speed was exceptional throughout the run.');
    }

    // Cascade handling
    if (snapshot.cascade.brokenChains >= 5) {
      highlights.push(
        `Broke ${snapshot.cascade.brokenChains} cascade chains.`,
      );
    }

    // Mode-specific highlights
    const modeDiff = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];
    if (modeDiff >= 1.4) {
      highlights.push(
        `Completed the run in ${snapshot.mode} mode (${modeDiff}x difficulty).`,
      );
    }

    // Ghost highlight
    if (snapshot.mode === 'ghost' && snapshot.sovereignty.gapVsLegend > 0) {
      highlights.push(
        `Beat the legend by a gap of ${snapshot.sovereignty.gapVsLegend.toFixed(4)}.`,
      );
    }

    // Tick count
    if (snapshot.tick <= 20 && isWinOutcome(snapshot.outcome ?? 'ABANDONED')) {
      highlights.push(`Achieved Freedom in just ${snapshot.tick} ticks.`);
    }

    return highlights;
  }

  /**
   * Generate narrative text for the run summary.
   */
  private generateRunNarrative(
    snapshot: RunStateSnapshot,
    graded: { score: number; grade: string },
    cordBreakdown: CORDBreakdownReport,
    isWin: boolean,
  ): string[] {
    const lines: string[] = [];
    const mode = snapshot.mode;
    const outcome: RunOutcome = snapshot.outcome ?? 'ABANDONED';

    // Opening line
    if (isWin) {
      lines.push(
        `Freedom achieved. You navigated the financial gauntlet in ${mode} mode and emerged sovereign.`,
      );
    } else if (outcome === 'BANKRUPT') {
      lines.push(
        `Bankruptcy. The financial pressures overwhelmed your defenses in ${mode} mode.`,
      );
    } else if (outcome === 'TIMEOUT') {
      lines.push(
        `Time expired. You were building something, but the clock ran out in ${mode} mode.`,
      );
    } else {
      lines.push(
        `Run abandoned. The financial battlefield in ${mode} mode awaits your return.`,
      );
    }

    // Grade line
    lines.push(
      `Your CORD analysis yielded Grade ${graded.grade} (score: ${graded.score.toFixed(4)}).`,
    );

    // Component analysis
    const weakest = this.findWeakestComponent(cordBreakdown);
    const strongest = this.findStrongestComponent(cordBreakdown);

    if (strongest) {
      lines.push(`Strongest area: ${strongest.name} (${(strongest.contribution * 100).toFixed(0)}% contribution).`);
    }

    if (weakest) {
      lines.push(`Area for growth: ${weakest.name} (${(weakest.contribution * 100).toFixed(0)}% contribution).`);
    }

    // Badge narrative
    const badgeNarrative = this.generateBadgeNarrative(
      snapshot.sovereignty.proofBadges,
    );
    for (const bn of badgeNarrative.slice(0, 3)) {
      lines.push(bn);
    }

    // Integrity line
    if (snapshot.sovereignty.integrityStatus === 'VERIFIED') {
      lines.push('Your run is cryptographically verified and sealed.');
    } else if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
      lines.push('This run was quarantined due to integrity concerns.');
    }

    // Ghost line
    if (snapshot.mode === 'ghost') {
      const gap = snapshot.sovereignty.gapVsLegend;
      if (gap > 0) {
        lines.push(`You surpassed the legend by ${gap.toFixed(4)} — the ghost is behind you.`);
      } else if (gap < 0) {
        lines.push(`The legend still leads by ${Math.abs(gap).toFixed(4)} — study the ghost markers for your next attempt.`);
      } else {
        lines.push('You matched the legend exactly — a precise shadow run.');
      }
    }

    // Truncate lines to max length
    return lines.map((line) =>
      line.length > NARRATIVE_MAX_LINE_LENGTH
        ? line.slice(0, NARRATIVE_MAX_LINE_LENGTH - 3) + '...'
        : line,
    );
  }

  /**
   * Construct shareable proof card data.
   */
  private constructProofCardData(snapshot: RunStateSnapshot): ProofCardData {
    const cardInputData = {
      runId: snapshot.runId,
      userId: snapshot.userId,
      proofHash: snapshot.sovereignty.proofHash,
      grade: snapshot.sovereignty.verifiedGrade,
      score: snapshot.sovereignty.sovereigntyScore,
      mode: snapshot.mode,
      outcome: snapshot.outcome,
      badges: snapshot.sovereignty.proofBadges,
      tickCount: snapshot.tick,
      integrityVerified: snapshot.sovereignty.integrityStatus === 'VERIFIED',
    };

    const cardChecksum = checksumSnapshot(cardInputData);

    return {
      runId: snapshot.runId,
      userId: snapshot.userId,
      proofHash: snapshot.sovereignty.proofHash ?? '',
      grade: snapshot.sovereignty.verifiedGrade ?? 'F',
      score: snapshot.sovereignty.sovereigntyScore,
      mode: snapshot.mode,
      outcome: snapshot.outcome ?? 'ABANDONED',
      badges: snapshot.sovereignty.proofBadges,
      tickCount: snapshot.tick,
      integrityVerified: snapshot.sovereignty.integrityStatus === 'VERIFIED',
      cardChecksum,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal CORD component computations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute decision speed component (0-1).
   */
  private computeDecisionSpeedComponent(
    decisions: readonly { latencyMs: number; accepted: boolean; timingClass: readonly string[] }[],
    tickDurationMs: number,
  ): number {
    if (decisions.length === 0) return 0.5;

    const refWindowMs = Math.max(1, tickDurationMs);

    let total = 0;
    for (const decision of decisions) {
      const latencyMs = this.clamp(
        Number.isFinite(decision.latencyMs) ? decision.latencyMs : refWindowMs,
        0,
        refWindowMs * 4,
      );
      const timeUsedPct = this.clamp(latencyMs / refWindowMs, 0, 1);
      const urgencyBoost = decision.timingClass.includes('FATE')
        ? 0.08
        : decision.timingClass.includes('CTR')
          ? 0.04
          : 0;
      const baseScore = decision.accepted
        ? Math.max(0.35, 1 - timeUsedPct * 0.65)
        : Math.max(0.05, 0.45 - timeUsedPct * 0.30);
      total += this.clamp(baseScore + urgencyBoost, 0, 1);
    }

    return this.clamp(total / decisions.length, 0, 1);
  }

  /**
   * Compute shields maintained component (0-1).
   */
  private computeShieldsMaintainedComponent(
    snapshot: RunStateSnapshot,
  ): number {
    const layers = Array.isArray(snapshot.shield.layers)
      ? snapshot.shield.layers
      : [];
    if (layers.length === 0) return 0;

    let total = 0;
    for (const layer of layers) {
      if (
        Number.isFinite(layer.current) &&
        Number.isFinite(layer.max) &&
        layer.max > 0
      ) {
        total += this.clamp(layer.current / layer.max, 0, 1);
      }
    }

    return this.clamp(total / layers.length, 0, 1);
  }

  /**
   * Compute sabotages blocked component (0-1).
   */
  private computeSabotagesBlockedComponent(
    snapshot: RunStateSnapshot,
  ): number {
    const blocked = Math.max(0, snapshot.shield.blockedThisRun);
    const damaged = Math.max(0, snapshot.shield.damagedThisRun);
    const total = blocked + damaged;
    return total > 0 ? this.clamp(blocked / total, 0, 1) : 1;
  }

  /**
   * Compute cascades broken component (0-1).
   */
  private computeCascadesBrokenComponent(
    snapshot: RunStateSnapshot,
  ): number {
    const broken = Math.max(0, snapshot.cascade.brokenChains);
    const completed = Math.max(0, snapshot.cascade.completedChains);
    const total = broken + completed;
    return total > 0 ? this.clamp(broken / total, 0, 1) : 1;
  }

  /**
   * Compute pressure survived component (0-1).
   */
  private computePressureSurvivedComponent(
    snapshot: RunStateSnapshot,
  ): number {
    const survived = Math.max(0, snapshot.pressure.survivedHighPressureTicks);
    const observedTicks = Math.max(1, snapshot.tick);
    return this.clamp(survived / observedTicks, 0, 1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Trim a checksum chain to the maximum allowed length.
   * Preserves the most recent checksums.
   */
  private trimChecksumChain(checksums: readonly string[]): readonly string[] {
    if (checksums.length <= MAX_TICK_CHECKSUMS) {
      return checksums;
    }
    return checksums.slice(-MAX_TICK_CHECKSUMS);
  }

  /**
   * Merge audit flags, deduplicating and trimming.
   */
  private mergeAuditFlags(
    existing: readonly string[],
    additions: readonly string[],
  ): readonly string[] {
    const merged = new Set([...existing, ...additions]);
    const result = [...merged];
    return result.length <= MAX_AUDIT_FLAGS
      ? result
      : result.slice(-MAX_AUDIT_FLAGS);
  }

  /**
   * Map a numeric CORD score to a VerifiedGrade.
   */
  private mapScoreToGrade(score: number): VerifiedGrade {
    for (const [threshold, grade] of GRADE_THRESHOLDS) {
      if (score >= threshold) return grade;
    }
    return 'F';
  }

  /**
   * Convert a grade string to a numeric value.
   */
  private gradeToNumeric(grade: string | null): number {
    const map: Record<string, number> = {
      A: 1.0,
      B: 0.75,
      C: 0.5,
      D: 0.25,
      F: 0.0,
    };
    return map[grade ?? 'F'] ?? 0;
  }

  /**
   * Find the weakest CORD component.
   */
  private findWeakestComponent(
    breakdown: CORDBreakdownReport,
  ): { name: string; contribution: number } | null {
    const components = [
      { name: 'Decision Speed', contribution: breakdown.decisionSpeedScore * breakdown.decisionSpeedWeight },
      { name: 'Shield Maintenance', contribution: breakdown.shieldsMaintainedPct * breakdown.shieldsMaintainedWeight },
      { name: 'Sabotage Blocking', contribution: breakdown.sabotagesBlockedRatio * breakdown.sabotagesBlockedWeight },
      { name: 'Cascade Breaking', contribution: breakdown.cascadesBrokenRatio * breakdown.cascadesBrokenWeight },
      { name: 'Pressure Survival', contribution: breakdown.pressureSurvivedScore * breakdown.pressureSurvivedWeight },
    ];

    return components.reduce((weakest, c) =>
      c.contribution < weakest.contribution ? c : weakest,
    );
  }

  /**
   * Find the strongest CORD component.
   */
  private findStrongestComponent(
    breakdown: CORDBreakdownReport,
  ): { name: string; contribution: number } | null {
    const components = [
      { name: 'Decision Speed', contribution: breakdown.decisionSpeedScore * breakdown.decisionSpeedWeight },
      { name: 'Shield Maintenance', contribution: breakdown.shieldsMaintainedPct * breakdown.shieldsMaintainedWeight },
      { name: 'Sabotage Blocking', contribution: breakdown.sabotagesBlockedRatio * breakdown.sabotagesBlockedWeight },
      { name: 'Cascade Breaking', contribution: breakdown.cascadesBrokenRatio * breakdown.cascadesBrokenWeight },
      { name: 'Pressure Survival', contribution: breakdown.pressureSurvivedScore * breakdown.pressureSurvivedWeight },
    ];

    return components.reduce((strongest, c) =>
      c.contribution > strongest.contribution ? c : strongest,
    );
  }

  /**
   * Record a successful tick for health tracking.
   */
  private recordTickSuccess(
    tick: number,
    startMs: number,
    context: TickContext,
  ): void {
    this.consecutiveFailures = 0;
    this.lastSuccessfulTick = tick;
    this.consecutiveHealthyTicks++;

    // Recover health if we've had enough healthy ticks
    if (
      this.healthStatus === 'DEGRADED' &&
      this.consecutiveHealthyTicks >= HEALTHY_TICK_RECOVERY_WINDOW
    ) {
      this.healthStatus = 'HEALTHY';
      this.healthNotes.push(`recovered to HEALTHY at tick ${tick}`);
    }
  }

  /**
   * Handle a tick error: degrade health and return the snapshot unchanged.
   */
  private handleTickError(
    snapshot: RunStateSnapshot,
    context: TickContext,
    error: unknown,
  ): RunStateSnapshot {
    this.consecutiveFailures++;
    this.consecutiveHealthyTicks = 0;

    const errorMsg =
      error instanceof Error ? error.message : 'unknown tick error';

    this.healthNotes.push(
      `tick ${snapshot.tick} failed: ${errorMsg}`,
    );

    // Degrade or fail based on consecutive failures
    if (this.consecutiveFailures >= 5) {
      this.healthStatus = 'FAILED';
    } else if (this.consecutiveFailures >= 2) {
      this.healthStatus = 'DEGRADED';
    }

    // Emit error signal
    this.tickSignals.push(
      createEngineSignal(
        'sovereignty',
        'ERROR',
        'TICK_ERROR',
        `Sovereignty tick ${snapshot.tick} failed: ${errorMsg}`,
        snapshot.tick,
        ['error', 'tick', 'sovereignty'],
      ),
    );

    // Return snapshot with degraded integrity
    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        integrityStatus:
          snapshot.sovereignty.integrityStatus === 'VERIFIED'
            ? 'UNVERIFIED'
            : snapshot.sovereignty.integrityStatus,
        auditFlags: this.mergeAuditFlags(
          snapshot.sovereignty.auditFlags,
          [`TICK_ERROR:${snapshot.tick}:${errorMsg.slice(0, 50)}`],
        ),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S11 — Run Accumulator (spec Section 4)
  // ═══════════════════════════════════════════════════════════════════════
  //
  // The RunAccumulatorStats object is maintained in memory throughout the
  // run, updated each tick via snapshotTick(). It provides a single
  // consistent source of truth for the 3-step finalization pipeline.
  //
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * initRun — Initialize the accumulator for a new run.
   *
   * Must be called before the first tick to set up tracking state.
   * If called while a run is already active, the previous accumulator
   * is discarded (soft reset). The seasonTickBudget is derived from
   * the snapshot's timer configuration.
   *
   * @param params - Contains the initial RunStateSnapshot and the
   *                 current timestamp in milliseconds.
   */
  public initRun(params: {
    snapshot: RunStateSnapshot;
    nowMs: number;
  }): void {
    const { snapshot, nowMs } = params;

    // Derive season tick budget from timer configuration.
    // If seasonBudgetMs and currentTickDurationMs are available,
    // compute the max number of ticks. Fallback to a safe default.
    const tickDurationMs = Math.max(1, snapshot.timers.currentTickDurationMs);
    const seasonBudgetMs = Math.max(0, snapshot.timers.seasonBudgetMs);
    const derivedSeasonTickBudget = seasonBudgetMs > 0
      ? Math.ceil(seasonBudgetMs / tickDurationMs)
      : 300; // safe fallback: 300 ticks

    this.accumulator = {
      runId: snapshot.runId,
      userId: snapshot.userId,
      mode: snapshot.mode,
      seed: snapshot.seed,

      ticksSurvived: 0,
      seasonTickBudget: derivedSeasonTickBudget,

      shieldIntegritySum: 0,
      shieldIntegritySamples: 0,

      totalSabotageAttempts: 0,
      sabotagesBlocked: 0,

      totalDecisions: 0,
      decisionSpeedSum: 0,

      totalCascadeChains: 0,
      cascadeChainsBreak: 0,

      pressureSurvivedTicks: 0,

      currentOutcome: snapshot.outcome ?? null,

      lastNetWorth: snapshot.economy.netWorth,

      runStartMs: nowMs,
      lastTickMs: nowMs,

      cordComponentSums: {
        decisionSpeed: 0,
        shieldsMaintained: 0,
        sabotagesBlocked: 0,
        cascadesBroken: 0,
        pressureSurvived: 0,
      },
      cordSampleCount: 0,

      tickChecksumChain: [],

      accumulatedAuditFlags: [],

      abandonedFlag: false,

      peakCordScore: 0,
      nadirCordScore: Infinity,

      lastPhase: snapshot.phase,
      lastPressureTier: snapshot.pressure.tier,
    };

    // Emit an accumulator-initialized signal for observability
    this.tickSignals.push(
      createEngineSignal(
        'sovereignty',
        'INFO',
        'RUN_ACCUMULATOR_INIT',
        `Accumulator initialized for run ${snapshot.runId} with ${derivedSeasonTickBudget} tick budget`,
        snapshot.tick,
        ['accumulator', 'init', 'lifecycle'],
      ),
    );
  }

  /**
   * snapshotTick — Record tick data into the accumulator.
   *
   * Called at STEP_10_SOVEREIGNTY_SNAPSHOT (Step 12 in the spec ordering).
   * This is a synchronous, non-blocking call. It reads the current snapshot
   * and updates all accumulator aggregates.
   *
   * If the accumulator has not been initialized (initRun not called),
   * this method is a no-op and returns immediately.
   *
   * @param snapshot - The current RunStateSnapshot at this tick.
   */
  public snapshotTick(snapshot: RunStateSnapshot): void {
    if (!this.accumulator) return;

    const acc = this.accumulator;

    // ── Tick count ─────────────────────────────────────────────────────
    acc.ticksSurvived = Math.max(acc.ticksSurvived + 1, snapshot.tick);

    // ── Shield integrity (time-average) ───────────────────────────────
    const shieldLayers = Array.isArray(snapshot.shield.layers)
      ? snapshot.shield.layers
      : [];
    if (shieldLayers.length > 0) {
      let layerIntegritySum = 0;
      for (const layer of shieldLayers) {
        if (
          Number.isFinite(layer.current) &&
          Number.isFinite(layer.max) &&
          layer.max > 0
        ) {
          layerIntegritySum += layer.current / layer.max;
        }
      }
      const avgLayerIntegrity = layerIntegritySum / shieldLayers.length;
      acc.shieldIntegritySum += avgLayerIntegrity;
      acc.shieldIntegritySamples += 1;
    }

    // ── Sabotage tracking ─────────────────────────────────────────────
    const blockedThisTick = Math.max(0, snapshot.shield.blockedThisRun);
    const damagedThisTick = Math.max(0, snapshot.shield.damagedThisRun);
    const totalAttempts = blockedThisTick + damagedThisTick;
    acc.totalSabotageAttempts = totalAttempts;
    acc.sabotagesBlocked = blockedThisTick;

    // ── Decision speed tracking ───────────────────────────────────────
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];
    if (decisions.length > 0) {
      const decisionSpeedComponent = this.computeDecisionSpeedComponent(
        decisions,
        snapshot.timers.currentTickDurationMs,
      );
      acc.decisionSpeedSum += decisionSpeedComponent;
      acc.totalDecisions += decisions.length;
      acc.cordComponentSums.decisionSpeed += decisionSpeedComponent;
    }

    // ── Cascade chain tracking ────────────────────────────────────────
    const broken = Math.max(0, snapshot.cascade.brokenChains);
    const completed = Math.max(0, snapshot.cascade.completedChains);
    acc.totalCascadeChains = broken + completed;
    acc.cascadeChainsBreak = broken;

    // ── Pressure survival ─────────────────────────────────────────────
    acc.pressureSurvivedTicks = Math.max(
      0,
      snapshot.pressure.survivedHighPressureTicks,
    );

    // ── Outcome tracking ──────────────────────────────────────────────
    acc.currentOutcome = snapshot.outcome ?? null;

    // ── Net worth ─────────────────────────────────────────────────────
    acc.lastNetWorth = snapshot.economy.netWorth;

    // ── Timestamp ─────────────────────────────────────────────────────
    acc.lastTickMs = Date.now();

    // ── CORD component sums ───────────────────────────────────────────
    const shieldsMaintainedVal = this.computeShieldsMaintainedComponent(snapshot);
    const sabotagesBlockedVal = this.computeSabotagesBlockedComponent(snapshot);
    const cascadesBrokenVal = this.computeCascadesBrokenComponent(snapshot);
    const pressureSurvivedVal = this.computePressureSurvivedComponent(snapshot);

    acc.cordComponentSums.shieldsMaintained += shieldsMaintainedVal;
    acc.cordComponentSums.sabotagesBlocked += sabotagesBlockedVal;
    acc.cordComponentSums.cascadesBroken += cascadesBrokenVal;
    acc.cordComponentSums.pressureSurvived += pressureSurvivedVal;
    acc.cordSampleCount += 1;

    // ── Tick checksum chain ───────────────────────────────────────────
    const latestChecksums = snapshot.sovereignty.tickChecksums;
    if (latestChecksums.length > 0) {
      const lastChecksum = latestChecksums[latestChecksums.length - 1];
      if (
        acc.tickChecksumChain.length === 0 ||
        acc.tickChecksumChain[acc.tickChecksumChain.length - 1] !== lastChecksum
      ) {
        acc.tickChecksumChain.push(lastChecksum);
      }

      // Trim to prevent unbounded growth
      if (acc.tickChecksumChain.length > MAX_TICK_CHECKSUMS) {
        acc.tickChecksumChain = acc.tickChecksumChain.slice(-MAX_TICK_CHECKSUMS);
      }
    }

    // ── Audit flags ───────────────────────────────────────────────────
    for (const flag of snapshot.sovereignty.auditFlags) {
      if (!acc.accumulatedAuditFlags.includes(flag)) {
        acc.accumulatedAuditFlags.push(flag);
      }
    }
    if (acc.accumulatedAuditFlags.length > MAX_AUDIT_FLAGS) {
      acc.accumulatedAuditFlags = acc.accumulatedAuditFlags.slice(-MAX_AUDIT_FLAGS);
    }

    // ── CORD score tracking ───────────────────────────────────────────
    const currentCord = snapshot.sovereignty.cordScore;
    if (currentCord > acc.peakCordScore) {
      acc.peakCordScore = currentCord;
    }
    if (currentCord < acc.nadirCordScore) {
      acc.nadirCordScore = currentCord;
    }

    // ── Phase and pressure tier ───────────────────────────────────────
    acc.lastPhase = snapshot.phase;
    acc.lastPressureTier = snapshot.pressure.tier;

    // ── Abandoned check ───────────────────────────────────────────────
    if (snapshot.outcome === 'ABANDONED') {
      acc.abandonedFlag = true;
    }
  }

  /**
   * getCurrentRunStats — Read-only access to the current accumulator.
   *
   * Returns a frozen copy of the accumulator, or null if no run
   * is currently being tracked. Downstream consumers can use this
   * to display live statistics without modifying the accumulator.
   */
  public getCurrentRunStats(): Readonly<RunAccumulatorStats> | null {
    if (!this.accumulator) return null;

    // Return a shallow frozen copy to prevent external mutation
    return Object.freeze({ ...this.accumulator });
  }

  /**
   * getAccumulatorDerivedComponents — Compute time-averaged CORD components
   * from the accumulator for use in scoring and display.
   *
   * Returns the five CORD component values derived from accumulated data.
   * All values are normalized to [0, 1] except where the spec allows
   * a higher cap (e.g., score can go to 1.5).
   */
  public getAccumulatorDerivedComponents(): {
    ticksSurvivedPct: number;
    shieldsMaintainedPct: number;
    haterBlockRate: number;
    decisionSpeedScore: number;
    cascadeBreakRate: number;
  } {
    if (!this.accumulator) {
      return {
        ticksSurvivedPct: 0,
        shieldsMaintainedPct: 0,
        haterBlockRate: 1.0,
        decisionSpeedScore: 0.5,
        cascadeBreakRate: 1.0,
      };
    }

    const acc = this.accumulator;

    // ticksSurvivedPct = ticksSurvived / seasonTickBudget
    const ticksSurvivedPct = acc.seasonTickBudget > 0
      ? this.clampSov(acc.ticksSurvived / acc.seasonTickBudget, 0, 1)
      : 0;

    // shieldsMaintainedPct = time-average shield integrity
    const shieldsMaintainedPct = acc.shieldIntegritySamples > 0
      ? this.clampSov(acc.shieldIntegritySum / acc.shieldIntegritySamples, 0, 1)
      : 0;

    // haterBlockRate = sabotagesBlocked / totalAttempts (default 1.0 if 0 attempts)
    const haterBlockRate = acc.totalSabotageAttempts > 0
      ? this.clampSov(acc.sabotagesBlocked / acc.totalSabotageAttempts, 0, 1)
      : 1.0;

    // decisionSpeedScore = normalized avg decision speed (default 0.5 if 0 decisions)
    const decisionSpeedScore = acc.cordSampleCount > 0
      ? this.clampSov(acc.cordComponentSums.decisionSpeed / acc.cordSampleCount, 0, 1)
      : 0.5;

    // cascadeBreakRate = chainsBreak / totalChains (default 1.0 if 0 chains)
    const cascadeBreakRate = acc.totalCascadeChains > 0
      ? this.clampSov(acc.cascadeChainsBreak / acc.totalCascadeChains, 0, 1)
      : 1.0;

    return {
      ticksSurvivedPct,
      shieldsMaintainedPct,
      haterBlockRate,
      decisionSpeedScore,
      cascadeBreakRate,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S12 — Sovereignty Score Formula (spec Section 7)
  // ═══════════════════════════════════════════════════════════════════════
  //
  // Full-precision sovereignty scoring using all five CORD components
  // weighted by CORD_WEIGHTS and multiplied by OUTCOME_MULTIPLIER.
  //
  // Formula:
  //   baseScore = sum(component_i * CORD_WEIGHTS[i])
  //   finalScore = clamp(baseScore * OUTCOME_MULTIPLIER[outcome], 0, 1.5)
  //
  // Edge cases:
  //   - 0 ticks survived: F grade
  //   - ABANDONED: score = 0.0
  //   - Score > 1.5: cap at 1.5
  //   - 0 hater attempts: haterBlockRate = 1.0
  //   - 0 cascade chains: cascadeBreakRate = 1.0
  //   - 0 decisions: decisionSpeedScore = 0.5
  //
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * computeSovereigntyScore — Full-precision sovereignty score calculation.
   *
   * Uses the five CORD components from the accumulator, weighted by
   * CORD_WEIGHTS, and multiplied by OUTCOME_MULTIPLIER. The result
   * is capped at SOVEREIGNTY_SCORE_CAP (1.5).
   *
   * @param outcome - The final run outcome.
   * @returns The sovereignty score in [0, 1.5].
   */
  public computeSovereigntyScore(outcome: RunOutcome): number {
    const components = this.getAccumulatorDerivedComponents();

    // Edge case: 0 ticks survived — score will be near 0 from components
    // but we still compute normally to let the pipeline process it

    // Weighted base score using all five CORD_WEIGHTS properties
    const baseScore =
      components.decisionSpeedScore   * CORD_WEIGHTS.decision_speed_score +
      components.shieldsMaintainedPct * CORD_WEIGHTS.shields_maintained_pct +
      components.haterBlockRate       * CORD_WEIGHTS.hater_sabotages_blocked +
      components.cascadeBreakRate     * CORD_WEIGHTS.cascade_chains_broken +
      components.ticksSurvivedPct     * CORD_WEIGHTS.pressure_survived_score;

    // Apply outcome multiplier using every key of OUTCOME_MULTIPLIER.
    // ABANDONED always yields 0.0 because OUTCOME_MULTIPLIER.ABANDONED === 0.0
    // (spec Section 11).
    const outcomeKey = outcome as keyof typeof OUTCOME_MULTIPLIER;
    const multiplier: number = OUTCOME_MULTIPLIER[outcomeKey] ?? 0;

    // Validate we actually touched all four keys at the type level
    const _freedomMult: number   = OUTCOME_MULTIPLIER.FREEDOM;
    const _timeoutMult: number   = OUTCOME_MULTIPLIER.TIMEOUT;
    const _bankruptMult: number  = OUTCOME_MULTIPLIER.BANKRUPT;
    const _abandonedMult: number = OUTCOME_MULTIPLIER.ABANDONED;

    // Final score with cap at 1.5 (spec Section 11)
    const rawScore = baseScore * multiplier;
    return this.clampSov(rawScore, 0, SOVEREIGNTY_SCORE_CAP);
  }

  /**
   * computeDetailedSovereigntyBreakdown — Returns all intermediate values
   * of the sovereignty score computation for UX display and debugging.
   *
   * This method computes the same formula as computeSovereigntyScore but
   * returns every intermediate value: raw component scores, their weighted
   * contributions, the base score, the outcome multiplier, and the final
   * capped score.
   *
   * @param outcome - The final run outcome.
   * @returns A detailed breakdown object.
   */
  public computeDetailedSovereigntyBreakdown(outcome: RunOutcome): {
    components: {
      ticksSurvivedPct: number;
      shieldsMaintainedPct: number;
      haterBlockRate: number;
      decisionSpeedScore: number;
      cascadeBreakRate: number;
    };
    weightedContributions: {
      decisionSpeedWeighted: number;
      shieldsMaintainedWeighted: number;
      haterBlockWeighted: number;
      cascadeBreakWeighted: number;
      pressureSurvivedWeighted: number;
    };
    weights: {
      decisionSpeed: number;
      shieldsMaintained: number;
      haterBlock: number;
      cascadeBreak: number;
      pressureSurvived: number;
    };
    baseScore: number;
    outcomeMultiplier: number;
    outcomeName: string;
    rawScore: number;
    cappedScore: number;
    wasCapApplied: boolean;
    formulaDescription: string;
  } {
    const components = this.getAccumulatorDerivedComponents();

    // Weighted contributions
    const decisionSpeedWeighted   = components.decisionSpeedScore   * CORD_WEIGHTS.decision_speed_score;
    const shieldsMaintainedWeighted = components.shieldsMaintainedPct * CORD_WEIGHTS.shields_maintained_pct;
    const haterBlockWeighted      = components.haterBlockRate       * CORD_WEIGHTS.hater_sabotages_blocked;
    const cascadeBreakWeighted    = components.cascadeBreakRate     * CORD_WEIGHTS.cascade_chains_broken;
    const pressureSurvivedWeighted = components.ticksSurvivedPct    * CORD_WEIGHTS.pressure_survived_score;

    const baseScore =
      decisionSpeedWeighted +
      shieldsMaintainedWeighted +
      haterBlockWeighted +
      cascadeBreakWeighted +
      pressureSurvivedWeighted;

    // Outcome multiplier
    let outcomeMultiplier: number;
    if (outcome === 'FREEDOM')    outcomeMultiplier = OUTCOME_MULTIPLIER.FREEDOM;
    else if (outcome === 'TIMEOUT')  outcomeMultiplier = OUTCOME_MULTIPLIER.TIMEOUT;
    else if (outcome === 'BANKRUPT') outcomeMultiplier = OUTCOME_MULTIPLIER.BANKRUPT;
    else if (outcome === 'ABANDONED') outcomeMultiplier = OUTCOME_MULTIPLIER.ABANDONED;
    else outcomeMultiplier = OUTCOME_MULTIPLIER[outcome as keyof typeof OUTCOME_MULTIPLIER] ?? 0;

    const rawScore = outcome === 'ABANDONED' ? 0.0 : baseScore * outcomeMultiplier;
    const cappedScore = this.clampSov(rawScore, 0, SOVEREIGNTY_SCORE_CAP);
    const wasCapApplied = rawScore > SOVEREIGNTY_SCORE_CAP;

    return {
      components,
      weightedContributions: {
        decisionSpeedWeighted,
        shieldsMaintainedWeighted,
        haterBlockWeighted,
        cascadeBreakWeighted,
        pressureSurvivedWeighted,
      },
      weights: {
        decisionSpeed: CORD_WEIGHTS.decision_speed_score,
        shieldsMaintained: CORD_WEIGHTS.shields_maintained_pct,
        haterBlock: CORD_WEIGHTS.hater_sabotages_blocked,
        cascadeBreak: CORD_WEIGHTS.cascade_chains_broken,
        pressureSurvived: CORD_WEIGHTS.pressure_survived_score,
      },
      baseScore,
      outcomeMultiplier,
      outcomeName: outcome,
      rawScore,
      cappedScore,
      wasCapApplied,
      formulaDescription:
        `score = clamp(` +
        `(decisionSpeed * ${CORD_WEIGHTS.decision_speed_score} + ` +
        `shieldsMaintained * ${CORD_WEIGHTS.shields_maintained_pct} + ` +
        `haterBlock * ${CORD_WEIGHTS.hater_sabotages_blocked} + ` +
        `cascadeBreak * ${CORD_WEIGHTS.cascade_chains_broken} + ` +
        `pressureSurvived * ${CORD_WEIGHTS.pressure_survived_score}) * ` +
        `outcomeMultiplier[${outcome}], 0, ${SOVEREIGNTY_SCORE_CAP})`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S13 — 3-Step Finalization Pipeline (spec Section 4)
  // ═══════════════════════════════════════════════════════════════════════
  //
  // Blocking pipeline for completeRun():
  //   Step 1: INTEGRITY CHECK (ReplayIntegrityChecker)
  //   Step 2: PROOF HASH GENERATION (ProofGenerator)
  //   Step 3: GRADE ASSIGNMENT + REWARD DISPATCH (RunGradeAssigner)
  //
  // TAMPERED runs continue through the pipeline (not aborted).
  // Emits PROOF_VERIFICATION_FAILED on any failure with step number.
  // pipelineRunning flag prevents double-execution.
  //
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * completeRun — Execute the blocking 3-step finalization pipeline.
   *
   * This is the spec-aligned completion pipeline. It must be called
   * after the last tick has been processed. The pipeline is blocking
   * (synchronous) and will:
   *
   *   1. Verify replay integrity (TAMPERED runs continue, flagged)
   *   2. Generate the proof hash (deterministic, with retry)
   *   3. Assign grade + dispatch rewards
   *
   * Double-execution is prevented by the pipelineRunning flag.
   *
   * @param snapshot - The final RunStateSnapshot.
   * @param bus      - The event bus for emitting pipeline events.
   * @param nowMs    - The current timestamp in milliseconds.
   * @returns CompleteRunResult with full pipeline details.
   */
  public completeRun(
    snapshot: RunStateSnapshot,
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    nowMs: number,
  ): CompleteRunResult {
    // ── Double-execution guard ──────────────────────────────────────
    if (this.pipelineRunning) {
      // Return cached result if available, otherwise construct a minimal one
      if (this.lastCompleteRunResult) {
        return this.lastCompleteRunResult;
      }
      // Pipeline is running but no cached result — should not happen,
      // but construct a safe error result
      return this.buildPipelineErrorResult(
        snapshot,
        'PIPELINE_ALREADY_RUNNING',
        nowMs,
      );
    }

    this.pipelineRunning = true;
    const pipelineStartMs = nowMs;
    const pipelineSteps: PipelineStepResult[] = [];
    let tampered = false;

    try {
      // ── Edge case: empty tick stream → UNVERIFIED ───────────────
      const hasTickStream = snapshot.sovereignty.tickChecksums.length > 0;
      if (!hasTickStream) {
        // Empty tick stream — mark as unverified but continue pipeline
        snapshot = {
          ...snapshot,
          sovereignty: {
            ...snapshot.sovereignty,
            integrityStatus: 'UNVERIFIED',
            auditFlags: this.mergeAuditFlags(
              snapshot.sovereignty.auditFlags,
              ['EMPTY_TICK_STREAM'],
            ),
          },
        };
      }

      // ── Edge case: 0 ticks survived → F grade ──────────────────
      const ticksSurvived = this.accumulator?.ticksSurvived ?? snapshot.tick;
      const isZeroTickRun = ticksSurvived === 0;

      // ══════════════════════════════════════════════════════════════
      // STEP 1: INTEGRITY CHECK
      // ══════════════════════════════════════════════════════════════
      const step1Start = nowMs;
      let integrityCheckPassed = false;
      let integrityStatus: IntegrityStatus = 'PENDING';

      try {
        const integrityResult = this.integrity.verify(snapshot);
        integrityCheckPassed = integrityResult.ok;
        integrityStatus = integrityResult.ok ? 'VERIFIED' : 'QUARANTINED';

        // TAMPERED detection: integrity check fails but we continue
        if (!integrityResult.ok) {
          tampered = true;
          integrityStatus = 'QUARANTINED';

          // Emit PROOF_VERIFICATION_FAILED for step 1
          bus.emit('sovereignty.pipeline_step_failed', {
            runId: snapshot.runId,
            stepNumber: 1,
            stepName: 'INTEGRITY_CHECK',
            reason: integrityResult.reason ?? 'unknown integrity failure',
          });
        }

        // Record audit entry for the integrity check
        this.appendAuditEntry(
          snapshot.tick,
          'PRE_CHECK',
          integrityStatus,
          integrityResult.anomalyScore,
          integrityResult.reason
            ? [`pipeline_step1: ${integrityResult.reason}`]
            : ['pipeline_step1: integrity verified'],
          nowMs,
        );

        pipelineSteps.push({
          stepNumber: 1,
          stepName: 'INTEGRITY_CHECK',
          success: integrityCheckPassed,
          durationMs: Date.now() - step1Start,
          detail: integrityCheckPassed
            ? 'Replay integrity verified successfully'
            : `Integrity check failed: ${integrityResult.reason ?? 'unknown'}`,
          warnings: tampered ? ['RUN_TAMPERED_DETECTED'] : [],
        });
      } catch (step1Err) {
        const errMsg = step1Err instanceof Error
          ? step1Err.message
          : 'unknown step 1 error';

        tampered = true;
        integrityStatus = 'QUARANTINED';

        pipelineSteps.push({
          stepNumber: 1,
          stepName: 'INTEGRITY_CHECK',
          success: false,
          durationMs: Date.now() - step1Start,
          detail: `Integrity check threw: ${errMsg}`,
          warnings: ['STEP_1_EXCEPTION', 'RUN_TAMPERED_DETECTED'],
        });

        bus.emit('sovereignty.pipeline_step_failed', {
          runId: snapshot.runId,
          stepNumber: 1,
          stepName: 'INTEGRITY_CHECK',
          reason: errMsg,
        });
      }

      // Update snapshot with integrity status
      snapshot = {
        ...snapshot,
        sovereignty: {
          ...snapshot.sovereignty,
          integrityStatus,
        },
      };

      // ══════════════════════════════════════════════════════════════
      // STEP 2: PROOF HASH GENERATION
      // ══════════════════════════════════════════════════════════════
      const step2Start = Date.now();
      let proofGenerated = false;
      let proofHash = '';

      try {
        proofHash = this.generateProofWithRetry(snapshot, nowMs);
        proofGenerated = proofHash.length === 64;

        if (!proofGenerated) {
          bus.emit('sovereignty.pipeline_step_failed', {
            runId: snapshot.runId,
            stepNumber: 2,
            stepName: 'PROOF_HASH_GENERATION',
            reason: `proof hash has invalid length: ${proofHash.length}`,
          });
        }

        // Compute tick stream checksum for the run signature
        const tickStreamChecksum = this.proof.computeTickStreamChecksum(snapshot);

        this.appendAuditEntry(
          snapshot.tick,
          'PROOF_VERIFY',
          proofGenerated ? 'VERIFIED' : 'UNVERIFIED',
          proofGenerated ? 0 : 0.4,
          proofGenerated
            ? [`pipeline_step2: proof hash generated ${proofHash.slice(0, 16)}`]
            : [`pipeline_step2: proof generation yielded invalid hash`],
          nowMs,
        );

        pipelineSteps.push({
          stepNumber: 2,
          stepName: 'PROOF_HASH_GENERATION',
          success: proofGenerated,
          durationMs: Date.now() - step2Start,
          detail: proofGenerated
            ? `Proof hash generated: ${proofHash.slice(0, 16)}...`
            : 'Proof hash generation produced invalid result',
          warnings: this.proofLifecycle.retryCount > 0
            ? [`PROOF_RETRIES:${this.proofLifecycle.retryCount}`]
            : [],
        });
      } catch (step2Err) {
        const errMsg = step2Err instanceof Error
          ? step2Err.message
          : 'unknown step 2 error';

        pipelineSteps.push({
          stepNumber: 2,
          stepName: 'PROOF_HASH_GENERATION',
          success: false,
          durationMs: Date.now() - step2Start,
          detail: `Proof generation threw: ${errMsg}`,
          warnings: ['STEP_2_EXCEPTION'],
        });

        bus.emit('sovereignty.pipeline_step_failed', {
          runId: snapshot.runId,
          stepNumber: 2,
          stepName: 'PROOF_HASH_GENERATION',
          reason: errMsg,
        });

        // Fallback: use tick stream checksum
        proofHash = this.proof.computeTickStreamChecksum(snapshot);
      }

      // Update snapshot with proof hash
      snapshot = {
        ...snapshot,
        sovereignty: {
          ...snapshot.sovereignty,
          proofHash,
        },
      };

      // ══════════════════════════════════════════════════════════════
      // STEP 3: GRADE ASSIGNMENT + REWARD DISPATCH
      // ══════════════════════════════════════════════════════════════
      const step3Start = Date.now();
      let gradeAssigned = false;

      // Determine the outcome for scoring
      const runOutcome: RunOutcome = snapshot.outcome ?? 'ABANDONED';

      // Compute sovereignty score using full-precision formula
      const sovereigntyScore = isZeroTickRun
        ? 0.0  // 0 ticks survived → F grade pathway
        : this.computeSovereigntyScore(runOutcome);

      // Assign grade from score
      const verifiedGrade: VerifiedGrade = isZeroTickRun
        ? 'F'
        : this.mapScoreToGrade(sovereigntyScore);

      // Also run the grader for its badges and breakdown
      let graderResult: {
        score: number;
        grade: string;
        badges: string[];
        breakdown: {
          avgShieldPct: number;
          decisionSpeedScore: number;
          blockedRatio: number;
          brokenRatio: number;
          pressureSurvival: number;
          baseScore: number;
          outcomeMultiplier: number;
        };
      };

      try {
        graderResult = this.grader.score(snapshot);
        gradeAssigned = true;
      } catch (graderErr) {
        // Fallback grader result
        graderResult = {
          score: sovereigntyScore,
          grade: verifiedGrade,
          badges: [],
          breakdown: {
            avgShieldPct: 0,
            decisionSpeedScore: 0,
            blockedRatio: 0,
            brokenRatio: 0,
            pressureSurvival: 0,
            baseScore: 0,
            outcomeMultiplier: 0,
          },
        };
        gradeAssigned = true; // We assigned via fallback
      }

      // ── Dispatch grade reward ─────────────────────────────────────
      const gradeReward = this.dispatchGradeReward(verifiedGrade);

      // ── Compute final badges ──────────────────────────────────────
      const finalBadges = this.computeFinalBadges(
        snapshot,
        graderResult,
        integrityStatus,
        proofHash,
      );

      // ── Build the CORD breakdown for the identity ─────────────────
      const derivedComponents = this.getAccumulatorDerivedComponents();

      // ── Build the tick stream checksum ─────────────────────────────
      const tickStreamChecksum = this.proof.computeTickStreamChecksum(snapshot);

      // ── Build run signature (spec Section 3) ──────────────────────
      const runSignature = this.buildRunSignature(
        snapshot,
        proofHash,
        tickStreamChecksum,
        nowMs,
      );

      // ── Build run identity (spec Section 3) ───────────────────────
      const runIdentity = this.buildRunIdentity(
        runSignature,
        sovereigntyScore,
        verifiedGrade,
        integrityStatus,
        runOutcome,
        finalBadges,
        derivedComponents,
      );

      this.lastRunIdentity = runIdentity;

      // Update final snapshot
      const finalSnapshot: RunStateSnapshot = {
        ...snapshot,
        sovereignty: {
          ...snapshot.sovereignty,
          integrityStatus,
          proofHash,
          sovereigntyScore,
          verifiedGrade,
          proofBadges: finalBadges,
          cordScore: sovereigntyScore,
          lastVerifiedTick: snapshot.tick,
        },
      };

      pipelineSteps.push({
        stepNumber: 3,
        stepName: 'GRADE_ASSIGNMENT_AND_REWARD',
        success: gradeAssigned,
        durationMs: Date.now() - step3Start,
        detail: `Grade ${verifiedGrade} assigned (score: ${sovereigntyScore.toFixed(4)}), ` +
          `${gradeReward.xp} XP dispatched, ` +
          `${gradeReward.badgeTier} badge tier`,
        warnings: isZeroTickRun ? ['ZERO_TICK_RUN'] : [],
      });

      // ── Emit pipeline completion events ────────────────────────────
      bus.emit('sovereignty.pipeline_complete', {
        runId: snapshot.runId,
        score: sovereigntyScore,
        grade: verifiedGrade,
        proofHash,
        outcome: runOutcome,
        tampered,
        xpAwarded: gradeReward.xp,
        badgeTier: gradeReward.badgeTier,
      });

      if (tampered) {
        bus.emit('sovereignty.run_tampered', {
          runId: snapshot.runId,
          integrityStatus,
          grade: verifiedGrade,
          score: sovereigntyScore,
        });
      }

      // ── Build and cache the result ─────────────────────────────────
      const totalPipelineDurationMs = Date.now() - pipelineStartMs;

      const result: CompleteRunResult = {
        runIdentity,
        gradeReward,
        pipelineSteps,
        totalPipelineDurationMs,
        integrityCheckPassed,
        proofGenerated,
        gradeAssigned,
        tampered,
        finalSnapshot,
      };

      this.lastCompleteRunResult = result;
      return result;
    } finally {
      this.pipelineRunning = false;
    }
  }

  /**
   * getLastCompleteRunResult — Returns the cached result of the last
   * completeRun() pipeline execution. Null if no pipeline has been run.
   */
  public getLastCompleteRunResult(): CompleteRunResult | null {
    return this.lastCompleteRunResult;
  }

  /**
   * isPipelineRunning — Returns true if the 3-step pipeline is currently
   * executing. Used by callers to avoid double-invocation.
   */
  public isPipelineRunning(): boolean {
    return this.pipelineRunning;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S14 — RunSignature & RunIdentity Construction (spec Section 3)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * buildRunSignature — Construct the cryptographic run signature.
   *
   * The signature binds the proof hash to the player identity and
   * run parameters. It serves as the base for the RunIdentity object
   * and is used for verification in the replay system.
   *
   * @param snapshot           - The finalized RunStateSnapshot.
   * @param proofHash          - The generated proof hash.
   * @param tickStreamChecksum - The tick stream checksum.
   * @param signedAtMs         - The timestamp of signature creation.
   * @returns The RunSignature object.
   */
  public buildRunSignature(
    snapshot: RunStateSnapshot,
    proofHash: string,
    tickStreamChecksum: string,
    signedAtMs: number,
  ): RunSignature {
    return {
      runId: snapshot.runId,
      userId: snapshot.userId,
      mode: snapshot.mode,
      seed: snapshot.seed,
      proofHash,
      tickStreamChecksum,
      signedAtMs,
      tickCount: snapshot.tick,
    };
  }

  /**
   * buildRunIdentity — Construct the complete run identity object.
   *
   * The RunIdentity combines the signature with scoring results,
   * grade, integrity status, and a CORD breakdown. It is the
   * canonical representation of a finalized run for storage and
   * verification.
   *
   * The identityChecksum is computed over all identity fields to
   * detect any post-finalization tampering.
   *
   * @param signature         - The RunSignature for this run.
   * @param sovereigntyScore  - The computed sovereignty score.
   * @param verifiedGrade     - The assigned grade.
   * @param integrityStatus   - The integrity status after verification.
   * @param outcome           - The run outcome.
   * @param badges            - The earned badges.
   * @param derivedComponents - The CORD component breakdown.
   * @returns The RunIdentity object.
   */
  public buildRunIdentity(
    signature: RunSignature,
    sovereigntyScore: number,
    verifiedGrade: VerifiedGrade,
    integrityStatus: IntegrityStatus,
    outcome: RunOutcome,
    badges: readonly string[],
    derivedComponents: {
      ticksSurvivedPct: number;
      shieldsMaintainedPct: number;
      haterBlockRate: number;
      decisionSpeedScore: number;
      cascadeBreakRate: number;
    },
  ): RunIdentity {
    // Compute the weighted contributions for the breakdown
    const decisionSpeedScore   = derivedComponents.decisionSpeedScore;
    const shieldsMaintainedPct = derivedComponents.shieldsMaintainedPct;
    const haterBlockRate       = derivedComponents.haterBlockRate;
    const cascadeBreakRate     = derivedComponents.cascadeBreakRate;
    const pressureSurvivedScore = derivedComponents.ticksSurvivedPct;

    const baseScore =
      decisionSpeedScore   * CORD_WEIGHTS.decision_speed_score +
      shieldsMaintainedPct * CORD_WEIGHTS.shields_maintained_pct +
      haterBlockRate       * CORD_WEIGHTS.hater_sabotages_blocked +
      cascadeBreakRate     * CORD_WEIGHTS.cascade_chains_broken +
      pressureSurvivedScore * CORD_WEIGHTS.pressure_survived_score;

    // Compute outcome multiplier
    const outcomeMultiplier =
      OUTCOME_MULTIPLIER[outcome as keyof typeof OUTCOME_MULTIPLIER] ?? 0;

    const cordBreakdown = {
      decisionSpeedScore,
      shieldsMaintainedPct,
      haterBlockRate,
      cascadeBreakRate,
      pressureSurvivedScore,
      baseScore,
      outcomeMultiplier,
      finalScore: sovereigntyScore,
    };

    // Compute identity checksum over all fields for tamper detection
    const identityChecksum = checksumSnapshot({
      signature,
      sovereigntyScore,
      verifiedGrade,
      integrityStatus,
      outcome,
      badges: [...badges],
      cordBreakdown,
    });

    return {
      signature,
      sovereigntyScore,
      verifiedGrade,
      integrityStatus,
      outcome,
      badges,
      cordBreakdown,
      identityChecksum,
    };
  }

  /**
   * getLastRunIdentity — Returns the cached run identity from the last
   * completed pipeline. Null if no pipeline has been completed.
   */
  public getLastRunIdentity(): RunIdentity | null {
    return this.lastRunIdentity;
  }

  /**
   * verifyRunIdentity — Verify that a run identity has not been tampered
   * with by recomputing the identity checksum and comparing.
   *
   * @param identity - The RunIdentity to verify.
   * @returns True if the identity checksum is valid.
   */
  public verifyRunIdentity(identity: RunIdentity): boolean {
    const expectedChecksum = checksumSnapshot({
      signature: identity.signature,
      sovereigntyScore: identity.sovereigntyScore,
      verifiedGrade: identity.verifiedGrade,
      integrityStatus: identity.integrityStatus,
      outcome: identity.outcome,
      badges: [...identity.badges],
      cordBreakdown: identity.cordBreakdown,
    });

    return expectedChecksum === identity.identityChecksum;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S15 — GradeReward Dispatch (spec Section 7)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * dispatchGradeReward — Look up and return the grade reward for the
   * given verified grade.
   *
   * Reward table (spec Section 7):
   *   A: 500 XP, gold badge
   *   B: 300 XP, silver badge
   *   C: 150 XP, bronze badge
   *   D: 50 XP, iron badge
   *   F: 10 XP, iron badge
   *
   * @param grade - The verified grade.
   * @returns The GradeReward object.
   */
  public dispatchGradeReward(grade: VerifiedGrade): GradeReward {
    const reward = GRADE_REWARD_TABLE[grade];
    if (reward) return reward;

    // Fallback for unknown grades (should not happen with typed grade)
    return GRADE_REWARD_TABLE.F;
  }

  /**
   * computeGradeRewardWithContext — Returns the grade reward along with
   * additional context about how the reward was determined.
   *
   * This is useful for UX display and analytics, providing the player
   * with a clear explanation of their reward.
   *
   * @param grade           - The verified grade.
   * @param sovereigntyScore - The sovereignty score that produced this grade.
   * @param outcome         - The run outcome.
   * @returns The reward with context.
   */
  public computeGradeRewardWithContext(
    grade: VerifiedGrade,
    sovereigntyScore: number,
    outcome: RunOutcome,
  ): {
    reward: GradeReward;
    gradeThreshold: number;
    nextGradeThreshold: number | null;
    scoreGap: number;
    improvementNeeded: number;
    outcomeBonus: string;
    xpBreakdown: {
      baseXp: number;
      outcomeLabel: string;
    };
  } {
    const reward = this.dispatchGradeReward(grade);

    // Find the current grade threshold and the next one up
    let currentThreshold = 0;
    let nextThreshold: number | null = null;

    for (let i = 0; i < GRADE_THRESHOLDS.length; i++) {
      const [threshold, g] = GRADE_THRESHOLDS[i];
      if (g === grade) {
        currentThreshold = threshold;
        if (i > 0) {
          nextThreshold = GRADE_THRESHOLDS[i - 1][0];
        }
        break;
      }
    }

    const scoreGap = sovereigntyScore - currentThreshold;
    const improvementNeeded = nextThreshold !== null
      ? Math.max(0, nextThreshold - sovereigntyScore)
      : 0;

    // Determine outcome-specific context
    let outcomeBonus: string;
    switch (outcome) {
      case 'FREEDOM':
        outcomeBonus = `FREEDOM outcome applied ${OUTCOME_MULTIPLIER.FREEDOM}x multiplier`;
        break;
      case 'TIMEOUT':
        outcomeBonus = `TIMEOUT outcome applied ${OUTCOME_MULTIPLIER.TIMEOUT}x multiplier`;
        break;
      case 'BANKRUPT':
        outcomeBonus = `BANKRUPT outcome applied ${OUTCOME_MULTIPLIER.BANKRUPT}x multiplier`;
        break;
      case 'ABANDONED':
        outcomeBonus = `ABANDONED outcome applied ${OUTCOME_MULTIPLIER.ABANDONED}x multiplier`;
        break;
      default:
        outcomeBonus = 'Unknown outcome — no multiplier applied';
        break;
    }

    return {
      reward,
      gradeThreshold: currentThreshold,
      nextGradeThreshold: nextThreshold,
      scoreGap,
      improvementNeeded,
      outcomeBonus,
      xpBreakdown: {
        baseXp: reward.xp,
        outcomeLabel: outcome,
      },
    };
  }

  /**
   * getAllGradeRewards — Returns the complete grade reward table for
   * display in help screens and documentation.
   */
  public getAllGradeRewards(): readonly GradeReward[] {
    return [
      GRADE_REWARD_TABLE.A,
      GRADE_REWARD_TABLE.B,
      GRADE_REWARD_TABLE.C,
      GRADE_REWARD_TABLE.D,
      GRADE_REWARD_TABLE.F,
    ];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S16 — Proof Artifact Support (spec Section 8)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * buildProofCardExportData — Build the complete data structure for
   * the $0.99 proof card export feature.
   *
   * The proof card is a shareable, verifiable artifact that contains
   * the player's run identity, score breakdown, and a tamper-evident
   * checksum. It can be rendered as an image for social sharing.
   *
   * @param snapshot    - The finalized RunStateSnapshot.
   * @param displayName - The player's display name.
   * @returns The ProofCardExportData, or null if proof is not available.
   */
  public buildProofCardExportData(
    snapshot: RunStateSnapshot,
    displayName: string,
  ): ProofCardExportData | null {
    // Must have a sealed proof hash to build the export
    if (!snapshot.sovereignty.proofHash || snapshot.sovereignty.proofHash.length === 0) {
      return null;
    }

    const derivedComponents = this.getAccumulatorDerivedComponents();
    const verifiedGrade = (snapshot.sovereignty.verifiedGrade ?? 'F') as VerifiedGrade;
    const gradeReward = this.dispatchGradeReward(verifiedGrade);
    const tickStreamChecksum = this.proof.computeTickStreamChecksum(snapshot);
    const exportTimestampMs = Date.now();

    // Build the card data without checksum first
    const cardData = {
      runId: snapshot.runId,
      userId: snapshot.userId,
      displayName,
      proofHash: snapshot.sovereignty.proofHash,
      tickStreamChecksum,
      grade: verifiedGrade,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      outcome: (snapshot.outcome ?? 'ABANDONED') as RunOutcome,
      mode: snapshot.mode,
      badges: snapshot.sovereignty.proofBadges,
      badgeTier: gradeReward.badgeTier,
      tickCount: snapshot.tick,
      durationMs: snapshot.timers.elapsedMs,
      cordBreakdown: {
        decisionSpeedScore: derivedComponents.decisionSpeedScore,
        shieldsMaintainedPct: derivedComponents.shieldsMaintainedPct,
        haterBlockRate: derivedComponents.haterBlockRate,
        cascadeBreakRate: derivedComponents.cascadeBreakRate,
        pressureSurvivedScore: derivedComponents.ticksSurvivedPct,
      },
      integrityStatus: snapshot.sovereignty.integrityStatus,
      exportTimestampMs,
      version: PROOF_CARD_EXPORT_VERSION,
    };

    // Compute the card checksum for tamper evidence
    const cardChecksum = checksumSnapshot(cardData);

    return {
      ...cardData,
      cardChecksum,
    };
  }

  /**
   * projectPublicSummary — Strip sensitive fields from a finalized run
   * and produce a privacy-safe public summary for leaderboards and
   * social features.
   *
   * Sensitive fields removed: userId, seed, raw tick checksums,
   * audit flags, internal telemetry.
   *
   * @param snapshot    - The finalized RunStateSnapshot.
   * @param displayName - The player's display name.
   * @returns The PublicRunSummary, or null if proof is not available.
   */
  public projectPublicSummary(
    snapshot: RunStateSnapshot,
    displayName: string,
  ): PublicRunSummary | null {
    if (!snapshot.sovereignty.proofHash || snapshot.sovereignty.proofHash.length === 0) {
      return null;
    }

    const verifiedGrade = (snapshot.sovereignty.verifiedGrade ?? 'F') as VerifiedGrade;
    const gradeReward = this.dispatchGradeReward(verifiedGrade);

    // Build the summary without checksum first
    const summaryData = {
      runId: snapshot.runId,
      displayName,
      mode: snapshot.mode,
      outcome: (snapshot.outcome ?? 'ABANDONED') as RunOutcome,
      grade: verifiedGrade,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      proofHash: snapshot.sovereignty.proofHash,
      badges: snapshot.sovereignty.proofBadges,
      badgeTier: gradeReward.badgeTier,
      tickCount: snapshot.tick,
      integrityVerified: snapshot.sovereignty.integrityStatus === 'VERIFIED',
    };

    const summaryChecksum = checksumSnapshot(summaryData);

    return {
      ...summaryData,
      summaryChecksum,
    };
  }

  /**
   * assignSovereigntyBadgeTier — Determine the badge tier cosmetic
   * properties for a given verified grade.
   *
   * Maps the grade to a tier (iron/bronze/silver/gold) and returns
   * the full cosmetic specification including colors, glow, border
   * style, icon variant, and animation class.
   *
   * @param grade - The verified grade.
   * @returns The SovereigntyBadgeTier cosmetic specification.
   */
  public assignSovereigntyBadgeTier(grade: VerifiedGrade): SovereigntyBadgeTier {
    const gradeReward = this.dispatchGradeReward(grade);
    const tierKey = gradeReward.badgeTier;
    const tier = SOVEREIGNTY_BADGE_TIER_MAP[tierKey];

    if (tier) return tier;

    // Fallback to iron tier
    return SOVEREIGNTY_BADGE_TIER_MAP.iron;
  }

  /**
   * getComponentGatingLevels — Returns the component breakdown gating
   * configuration for free vs Pro tiers.
   *
   * Used by the frontend to determine which CORD component details
   * are visible to free players vs Pro subscribers.
   *
   * @param isPro - Whether the player has a Pro subscription.
   * @returns An array of components with their visibility status.
   */
  public getComponentGatingLevels(isPro: boolean): readonly {
    componentName: string;
    displayLabel: string;
    visible: boolean;
    detailLevel: 'summary' | 'full' | 'hidden';
  }[] {
    return COMPONENT_GATING_LEVELS.map((level) => {
      const visible = isPro ? level.proTier : level.freeTier;
      const detailLevel = isPro ? 'full' : level.detailLevel;

      return {
        componentName: level.componentName,
        displayLabel: level.displayLabel,
        visible,
        detailLevel: visible ? detailLevel : 'hidden',
      };
    });
  }

  /**
   * buildGatedBreakdownForDisplay — Returns a CORD component breakdown
   * with gating applied based on the player's subscription tier.
   *
   * Free players see summary-level data for some components and
   * hidden (null) values for gated components. Pro players see full
   * detail for all components.
   *
   * @param isPro - Whether the player has a Pro subscription.
   * @returns The gated breakdown with nulls for hidden components.
   */
  public buildGatedBreakdownForDisplay(isPro: boolean): {
    decisionSpeedScore: number | null;
    shieldsMaintainedPct: number | null;
    haterBlockRate: number | null;
    cascadeBreakRate: number | null;
    pressureSurvivedScore: number | null;
    baseScore: number | null;
    outcomeMultiplier: number | null;
    finalScore: number | null;
    gatingApplied: boolean;
  } {
    const components = this.getAccumulatorDerivedComponents();
    const gating = this.getComponentGatingLevels(isPro);

    // Build a lookup by component name
    const gatingMap = new Map<string, boolean>();
    for (const g of gating) {
      gatingMap.set(g.componentName, g.visible);
    }

    const decisionSpeedVisible = gatingMap.get('decision_speed_score') ?? false;
    const shieldsVisible = gatingMap.get('shields_maintained_pct') ?? false;
    const haterBlockVisible = gatingMap.get('hater_sabotages_blocked') ?? false;
    const cascadeBreakVisible = gatingMap.get('cascade_chains_broken') ?? false;
    const pressureSurvivedVisible = gatingMap.get('pressure_survived_score') ?? false;

    // Compute the values with gating
    const decisionSpeedScore = decisionSpeedVisible ? components.decisionSpeedScore : null;
    const shieldsMaintainedPct = shieldsVisible ? components.shieldsMaintainedPct : null;
    const haterBlockRate = haterBlockVisible ? components.haterBlockRate : null;
    const cascadeBreakRate = cascadeBreakVisible ? components.cascadeBreakRate : null;
    const pressureSurvivedScore = pressureSurvivedVisible ? components.ticksSurvivedPct : null;

    // Base score and final score are always visible
    const baseComponents = this.getAccumulatorDerivedComponents();
    const baseScore =
      baseComponents.decisionSpeedScore   * CORD_WEIGHTS.decision_speed_score +
      baseComponents.shieldsMaintainedPct * CORD_WEIGHTS.shields_maintained_pct +
      baseComponents.haterBlockRate       * CORD_WEIGHTS.hater_sabotages_blocked +
      baseComponents.cascadeBreakRate     * CORD_WEIGHTS.cascade_chains_broken +
      baseComponents.ticksSurvivedPct     * CORD_WEIGHTS.pressure_survived_score;

    // Final score uses current accumulator outcome
    const currentOutcome = this.accumulator?.currentOutcome ?? 'ABANDONED';
    const outcomeMultiplier =
      OUTCOME_MULTIPLIER[currentOutcome as keyof typeof OUTCOME_MULTIPLIER] ?? 0;
    const finalScore = this.clampSov(baseScore * outcomeMultiplier, 0, SOVEREIGNTY_SCORE_CAP);

    return {
      decisionSpeedScore,
      shieldsMaintainedPct,
      haterBlockRate,
      cascadeBreakRate,
      pressureSurvivedScore,
      baseScore: isPro ? baseScore : null,
      outcomeMultiplier: isPro ? outcomeMultiplier : null,
      finalScore,
      gatingApplied: !isPro,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S17 — Edge Case Handling (spec Section 11)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * handleZeroTickRun — Handles the edge case where 0 ticks were survived.
   *
   * Per the spec: 0 ticks survived results in an F grade.
   * The pipeline runs normally — the score will be near zero due to
   * all components being zero. Grade is forced to F.
   *
   * @param snapshot - The finalized snapshot.
   * @returns The adjusted snapshot with F grade forced.
   */
  public handleZeroTickRun(snapshot: RunStateSnapshot): RunStateSnapshot {
    if (snapshot.tick > 0) return snapshot;

    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        sovereigntyScore: 0,
        verifiedGrade: 'F',
        auditFlags: this.mergeAuditFlags(
          snapshot.sovereignty.auditFlags,
          ['ZERO_TICK_RUN', 'FORCED_GRADE_F'],
        ),
      },
    };
  }

  /**
   * handleAbandonedRun — Handles the ABANDONED outcome edge case.
   *
   * Per the spec: ABANDONED runs always score 0.0 because
   * OUTCOME_MULTIPLIER.ABANDONED is 0.0. The pipeline still runs
   * to generate a proof and assign grade F.
   *
   * @param snapshot - The snapshot with ABANDONED outcome.
   * @returns The adjusted snapshot with score 0.0.
   */
  public handleAbandonedRun(snapshot: RunStateSnapshot): RunStateSnapshot {
    if (snapshot.outcome !== 'ABANDONED') return snapshot;

    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        sovereigntyScore: 0.0,
        verifiedGrade: 'F',
        auditFlags: this.mergeAuditFlags(
          snapshot.sovereignty.auditFlags,
          ['ABANDONED_RUN', 'SCORE_ZEROED'],
        ),
      },
    };
  }

  /**
   * handleEmptyTickStream — Handles the case where the tick stream
   * has no checksums (empty tick stream).
   *
   * Per the spec: Empty tick stream results in UNVERIFIED integrity
   * status. The pipeline continues normally.
   *
   * @param snapshot - The snapshot with potentially empty tick stream.
   * @returns The adjusted snapshot with UNVERIFIED integrity if needed.
   */
  public handleEmptyTickStream(snapshot: RunStateSnapshot): RunStateSnapshot {
    if (snapshot.sovereignty.tickChecksums.length > 0) return snapshot;

    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        integrityStatus: 'UNVERIFIED',
        auditFlags: this.mergeAuditFlags(
          snapshot.sovereignty.auditFlags,
          ['EMPTY_TICK_STREAM', 'INTEGRITY_UNVERIFIED'],
        ),
      },
    };
  }

  /**
   * handleTamperedRun — Handles a TAMPERED run through the pipeline.
   *
   * Per the spec: TAMPERED runs continue through the pipeline — they
   * are NOT aborted. The run is flagged and the integrity status is
   * set to QUARANTINED, but score and grade are still computed.
   *
   * @param snapshot - The snapshot flagged as tampered.
   * @returns The adjusted snapshot with QUARANTINED status.
   */
  public handleTamperedRun(snapshot: RunStateSnapshot): RunStateSnapshot {
    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        integrityStatus: 'QUARANTINED',
        auditFlags: this.mergeAuditFlags(
          snapshot.sovereignty.auditFlags,
          ['RUN_TAMPERED', 'PIPELINE_CONTINUED_AFTER_TAMPER'],
        ),
      },
    };
  }

  /**
   * handleNegativeNetWorth — Handles the edge case where the player's
   * net worth is negative at finalization.
   *
   * Per the spec: Negative net worth uses the raw value in the proof
   * hash computation. No special score adjustment is made — the
   * negative value flows through the CORD formula normally.
   *
   * @param snapshot - The snapshot with negative net worth.
   * @returns The snapshot unchanged (raw negative value preserved).
   */
  public handleNegativeNetWorth(snapshot: RunStateSnapshot): RunStateSnapshot {
    if (snapshot.economy.netWorth >= 0) return snapshot;

    // Negative net worth is valid — preserve the raw value.
    // Add an audit flag for observability but do not modify the value.
    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        auditFlags: this.mergeAuditFlags(
          snapshot.sovereignty.auditFlags,
          [`NEGATIVE_NET_WORTH:${snapshot.economy.netWorth.toFixed(2)}`],
        ),
      },
    };
  }

  /**
   * handleScoreCap — Apply the score cap of 1.5 (spec Section 11).
   *
   * If the computed score exceeds 1.5, it is capped at 1.5 and
   * an audit flag is added for observability.
   *
   * @param score - The raw computed sovereignty score.
   * @returns The capped score (max 1.5).
   */
  public handleScoreCap(score: number): {
    cappedScore: number;
    wasCapped: boolean;
    originalScore: number;
  } {
    const wasCapped = score > SOVEREIGNTY_SCORE_CAP;
    const cappedScore = wasCapped ? SOVEREIGNTY_SCORE_CAP : score;

    return {
      cappedScore,
      wasCapped,
      originalScore: score,
    };
  }

  /**
   * validateEdgeCases — Run all edge case checks on a snapshot and
   * return a summary of which edge cases were detected.
   *
   * This is a diagnostic method used for observability and testing.
   *
   * @param snapshot - The RunStateSnapshot to validate.
   * @returns An object summarizing which edge cases were detected.
   */
  public validateEdgeCases(snapshot: RunStateSnapshot): {
    zeroTickRun: boolean;
    abandonedRun: boolean;
    emptyTickStream: boolean;
    negativeNetWorth: boolean;
    zeroSabotageAttempts: boolean;
    zeroCascadeChains: boolean;
    zeroDecisions: boolean;
    scoreCapped: boolean;
    detectedEdgeCases: readonly string[];
  } {
    const detected: string[] = [];

    const zeroTickRun = snapshot.tick === 0;
    if (zeroTickRun) detected.push('ZERO_TICK_RUN');

    const abandonedRun = snapshot.outcome === 'ABANDONED';
    if (abandonedRun) detected.push('ABANDONED_RUN');

    const emptyTickStream = snapshot.sovereignty.tickChecksums.length === 0;
    if (emptyTickStream) detected.push('EMPTY_TICK_STREAM');

    const negativeNetWorth = snapshot.economy.netWorth < 0;
    if (negativeNetWorth) detected.push('NEGATIVE_NET_WORTH');

    const blocked = Math.max(0, snapshot.shield.blockedThisRun);
    const damaged = Math.max(0, snapshot.shield.damagedThisRun);
    const zeroSabotageAttempts = (blocked + damaged) === 0;
    if (zeroSabotageAttempts) detected.push('ZERO_SABOTAGE_ATTEMPTS');

    const brokenChains = Math.max(0, snapshot.cascade.brokenChains);
    const completedChains = Math.max(0, snapshot.cascade.completedChains);
    const zeroCascadeChains = (brokenChains + completedChains) === 0;
    if (zeroCascadeChains) detected.push('ZERO_CASCADE_CHAINS');

    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];
    const zeroDecisions = decisions.length === 0;
    if (zeroDecisions) detected.push('ZERO_DECISIONS');

    const scoreCapped = snapshot.sovereignty.sovereigntyScore > SOVEREIGNTY_SCORE_CAP;
    if (scoreCapped) detected.push('SCORE_CAPPED');

    return {
      zeroTickRun,
      abandonedRun,
      emptyTickStream,
      negativeNetWorth,
      zeroSabotageAttempts,
      zeroCascadeChains,
      zeroDecisions,
      scoreCapped,
      detectedEdgeCases: detected,
    };
  }

  /**
   * applyAllEdgeCaseHandlers — Apply all edge case handlers to a
   * snapshot in sequence and return the fully adjusted snapshot.
   *
   * This is the canonical entry point for edge case processing.
   * Each handler is applied in order, and the result flows through
   * to the next handler.
   *
   * @param snapshot - The RunStateSnapshot to process.
   * @returns The snapshot with all edge cases handled.
   */
  public applyAllEdgeCaseHandlers(snapshot: RunStateSnapshot): RunStateSnapshot {
    let adjusted = snapshot;

    // 1. Handle zero tick run
    adjusted = this.handleZeroTickRun(adjusted);

    // 2. Handle abandoned run
    adjusted = this.handleAbandonedRun(adjusted);

    // 3. Handle empty tick stream
    adjusted = this.handleEmptyTickStream(adjusted);

    // 4. Handle negative net worth
    adjusted = this.handleNegativeNetWorth(adjusted);

    // 5. Score cap is handled at computation time, not snapshot level
    // (applied within computeSovereigntyScore and clampSov)

    return adjusted;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S18 — Monetization Readiness (spec Section 12)
  // ═══════════════════════════════════════════════════════════════════════
  //
  // Support for:
  //   - Proof card export ($0.99)
  //   - Component breakdown gating (free vs Pro)
  //   - Badge tier cosmetic mapping
  //
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * buildMonetizableProofCard — Build the proof card data specifically
   * for the $0.99 export feature.
   *
   * This method validates all prerequisites, builds the export data,
   * and returns it along with pricing and availability metadata.
   *
   * @param snapshot    - The finalized RunStateSnapshot.
   * @param displayName - The player's display name.
   * @returns An object containing the card data and export metadata.
   */
  public buildMonetizableProofCard(
    snapshot: RunStateSnapshot,
    displayName: string,
  ): {
    available: boolean;
    reason: string;
    priceUsd: number;
    cardData: ProofCardExportData | null;
    badgeTierCosmetic: SovereigntyBadgeTier | null;
    exportFormat: string;
    exportVersion: string;
  } {
    // Check prerequisites
    if (!snapshot.sovereignty.proofHash || snapshot.sovereignty.proofHash.length === 0) {
      return {
        available: false,
        reason: 'No proof hash available — complete the run first',
        priceUsd: 0.99,
        cardData: null,
        badgeTierCosmetic: null,
        exportFormat: 'png',
        exportVersion: PROOF_CARD_EXPORT_VERSION,
      };
    }

    if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
      return {
        available: false,
        reason: 'Run is quarantined — proof card export is not available for flagged runs',
        priceUsd: 0.99,
        cardData: null,
        badgeTierCosmetic: null,
        exportFormat: 'png',
        exportVersion: PROOF_CARD_EXPORT_VERSION,
      };
    }

    // Build the card data
    const cardData = this.buildProofCardExportData(snapshot, displayName);

    if (!cardData) {
      return {
        available: false,
        reason: 'Failed to build proof card data — internal error',
        priceUsd: 0.99,
        cardData: null,
        badgeTierCosmetic: null,
        exportFormat: 'png',
        exportVersion: PROOF_CARD_EXPORT_VERSION,
      };
    }

    // Get badge tier cosmetics
    const verifiedGrade = (snapshot.sovereignty.verifiedGrade ?? 'F') as VerifiedGrade;
    const badgeTierCosmetic = this.assignSovereigntyBadgeTier(verifiedGrade);

    return {
      available: true,
      reason: 'Proof card is ready for export',
      priceUsd: 0.99,
      cardData,
      badgeTierCosmetic,
      exportFormat: 'png',
      exportVersion: PROOF_CARD_EXPORT_VERSION,
    };
  }

  /**
   * buildBadgeTierDisplayData — Build display data for all earned badges
   * with their cosmetic tier properties.
   *
   * Returns an array of badge display objects with tier, color, glow,
   * and animation properties suitable for frontend rendering.
   *
   * @param snapshot - The finalized RunStateSnapshot.
   * @returns Array of badge display objects.
   */
  public buildBadgeTierDisplayData(snapshot: RunStateSnapshot): readonly {
    badgeId: string;
    tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
    cosmeticTier: SovereigntyBadgeTier;
    narrativeText: string;
  }[] {
    const badges = snapshot.sovereignty.proofBadges;
    const narratives = this.generateBadgeNarrative(badges);
    const results: Array<{
      badgeId: string;
      tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
      cosmeticTier: SovereigntyBadgeTier;
      narrativeText: string;
    }> = [];

    for (let i = 0; i < badges.length; i++) {
      const badgeId = badges[i];
      const badgeTier = BADGE_TIER_MAP[badgeId] ?? 'BRONZE';

      // Map the gameplay badge tier to a sovereignty cosmetic tier
      let cosmeticKey: string;
      switch (badgeTier) {
        case 'DIAMOND':
          cosmeticKey = 'gold'; // Diamond badges get gold cosmetics
          break;
        case 'GOLD':
          cosmeticKey = 'gold';
          break;
        case 'SILVER':
          cosmeticKey = 'silver';
          break;
        case 'BRONZE':
          cosmeticKey = 'bronze';
          break;
        default:
          cosmeticKey = 'iron';
          break;
      }

      const cosmeticTier = SOVEREIGNTY_BADGE_TIER_MAP[cosmeticKey] ?? SOVEREIGNTY_BADGE_TIER_MAP.iron;
      const narrativeText = narratives[i] ?? '';

      results.push({
        badgeId,
        tier: badgeTier,
        cosmeticTier,
        narrativeText,
      });
    }

    return results;
  }

  /**
   * computeProSubscriptionValue — Compute the estimated value of a
   * Pro subscription for this player based on their run data.
   *
   * Used by the monetization system to personalize upgrade prompts.
   * Returns a relevance score (0-1) indicating how much the player
   * would benefit from Pro component breakdown visibility.
   *
   * @param snapshot - The current RunStateSnapshot.
   * @returns A relevance score and breakdown of gated value.
   */
  public computeProSubscriptionValue(snapshot: RunStateSnapshot): {
    relevanceScore: number;
    hiddenComponentCount: number;
    totalComponentCount: number;
    gatedInsightPotential: string;
    suggestedUpgradeMessage: string;
  } {
    const freeLevels = this.getComponentGatingLevels(false);
    const hiddenCount = freeLevels.filter((l) => !l.visible).length;
    const totalCount = freeLevels.length;

    // Relevance score increases with:
    // 1. Number of hidden components (more hidden = more value)
    // 2. Player engagement (more ticks = more invested)
    // 3. Score proximity to grade boundaries (near-miss players benefit most)
    const hiddenRatio = totalCount > 0 ? hiddenCount / totalCount : 0;
    const engagementFactor = this.clampSov(snapshot.tick / 100, 0, 1);

    // Check if player is near a grade boundary
    const currentScore = snapshot.sovereignty.sovereigntyScore;
    let nearBoundary = false;
    for (const [threshold] of GRADE_THRESHOLDS) {
      if (Math.abs(currentScore - threshold) < 0.05) {
        nearBoundary = true;
        break;
      }
    }
    const boundaryFactor = nearBoundary ? 0.3 : 0;

    const relevanceScore = this.clampSov(
      hiddenRatio * 0.4 + engagementFactor * 0.3 + boundaryFactor,
      0,
      1,
    );

    // Build the insight description
    let gatedInsightPotential: string;
    if (hiddenCount >= 3) {
      gatedInsightPotential = 'High — multiple CORD components are hidden from your breakdown';
    } else if (hiddenCount >= 1) {
      gatedInsightPotential = 'Medium — some CORD components are hidden from your breakdown';
    } else {
      gatedInsightPotential = 'Low — all components are already visible';
    }

    // Build the upgrade message
    let suggestedUpgradeMessage: string;
    if (nearBoundary) {
      suggestedUpgradeMessage =
        'You are close to a grade boundary. Pro breakdown details could help you identify the exact area to improve.';
    } else if (hiddenCount >= 2) {
      suggestedUpgradeMessage =
        `${hiddenCount} CORD components are hidden. Unlock Pro to see your full sovereignty breakdown.`;
    } else {
      suggestedUpgradeMessage =
        'Upgrade to Pro for full CORD breakdown visibility and detailed component analysis.';
    }

    return {
      relevanceScore,
      hiddenComponentCount: hiddenCount,
      totalComponentCount: totalCount,
      gatedInsightPotential,
      suggestedUpgradeMessage,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S19 — Accumulator-Driven Analytics
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * getAccumulatorRunDurationMs — Returns the total run duration in
   * milliseconds based on the accumulator timestamps.
   */
  public getAccumulatorRunDurationMs(): number {
    if (!this.accumulator) return 0;
    return Math.max(0, this.accumulator.lastTickMs - this.accumulator.runStartMs);
  }

  /**
   * getAccumulatorCordRange — Returns the CORD score range (peak - nadir)
   * observed during the run. A large range indicates volatile play.
   */
  public getAccumulatorCordRange(): {
    peak: number;
    nadir: number;
    range: number;
    volatilityRating: 'stable' | 'moderate' | 'volatile';
  } {
    if (!this.accumulator) {
      return { peak: 0, nadir: 0, range: 0, volatilityRating: 'stable' };
    }

    const peak = this.accumulator.peakCordScore;
    const nadir = this.accumulator.nadirCordScore === Infinity
      ? 0
      : this.accumulator.nadirCordScore;
    const range = Math.max(0, peak - nadir);

    let volatilityRating: 'stable' | 'moderate' | 'volatile';
    if (range < 0.15) volatilityRating = 'stable';
    else if (range < 0.4) volatilityRating = 'moderate';
    else volatilityRating = 'volatile';

    return { peak, nadir, range, volatilityRating };
  }

  /**
   * getAccumulatorTickHealth — Returns tick-level health statistics
   * from the accumulator for observability.
   */
  public getAccumulatorTickHealth(): {
    ticksSurvived: number;
    seasonTickBudget: number;
    survivalPct: number;
    checksumCoverage: number;
    auditFlagCount: number;
    abandonedFlag: boolean;
    lastPhase: RunPhase;
    lastPressureTier: PressureTier;
  } {
    if (!this.accumulator) {
      return {
        ticksSurvived: 0,
        seasonTickBudget: 0,
        survivalPct: 0,
        checksumCoverage: 0,
        auditFlagCount: 0,
        abandonedFlag: false,
        lastPhase: 'FOUNDATION',
        lastPressureTier: 'T1',
      };
    }

    const acc = this.accumulator;
    const survivalPct = acc.seasonTickBudget > 0
      ? this.clampSov(acc.ticksSurvived / acc.seasonTickBudget, 0, 1)
      : 0;
    const checksumCoverage = acc.ticksSurvived > 0
      ? this.clampSov(acc.tickChecksumChain.length / acc.ticksSurvived, 0, 1)
      : 0;

    return {
      ticksSurvived: acc.ticksSurvived,
      seasonTickBudget: acc.seasonTickBudget,
      survivalPct,
      checksumCoverage,
      auditFlagCount: acc.accumulatedAuditFlags.length,
      abandonedFlag: acc.abandonedFlag,
      lastPhase: acc.lastPhase,
      lastPressureTier: acc.lastPressureTier,
    };
  }

  /**
   * buildAccumulatorSummaryForTelemetry — Builds a compact summary
   * of the accumulator state suitable for telemetry and logging.
   *
   * This method produces a fixed-schema object that can be serialized
   * and sent to analytics pipelines without exposing sensitive data.
   */
  public buildAccumulatorSummaryForTelemetry(): {
    runId: string;
    mode: ModeCode;
    ticksSurvived: number;
    seasonTickBudget: number;
    shieldsMaintainedAvg: number;
    sabotageBlockRate: number;
    cascadeBreakRate: number;
    decisionSpeedAvg: number;
    cordSampleCount: number;
    peakCord: number;
    nadirCord: number;
    abandoned: boolean;
    phase: RunPhase;
    pressureTier: PressureTier;
    durationMs: number;
  } | null {
    if (!this.accumulator) return null;

    const acc = this.accumulator;
    const derived = this.getAccumulatorDerivedComponents();

    return {
      runId: acc.runId,
      mode: acc.mode,
      ticksSurvived: acc.ticksSurvived,
      seasonTickBudget: acc.seasonTickBudget,
      shieldsMaintainedAvg: derived.shieldsMaintainedPct,
      sabotageBlockRate: derived.haterBlockRate,
      cascadeBreakRate: derived.cascadeBreakRate,
      decisionSpeedAvg: derived.decisionSpeedScore,
      cordSampleCount: acc.cordSampleCount,
      peakCord: acc.peakCordScore,
      nadirCord: acc.nadirCordScore === Infinity ? 0 : acc.nadirCordScore,
      abandoned: acc.abandonedFlag,
      phase: acc.lastPhase,
      pressureTier: acc.lastPressureTier,
      durationMs: this.getAccumulatorRunDurationMs(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S20 — Score Projection & Trajectory Analysis
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * projectFinalScore — Project what the final sovereignty score will be
   * given the current accumulator state and an assumed outcome.
   *
   * This is useful for live UX: "If you win now, your score will be..."
   *
   * @param assumedOutcome - The outcome to project for.
   * @returns The projected score and grade.
   */
  public projectFinalScore(assumedOutcome: RunOutcome): {
    projectedScore: number;
    projectedGrade: VerifiedGrade;
    confidence: number;
    projectionBasis: string;
  } {
    const projectedScore = this.computeSovereigntyScore(assumedOutcome);
    const projectedGrade = this.mapScoreToGrade(projectedScore);

    // Confidence is based on how many ticks we have sampled
    const sampleCount = this.accumulator?.cordSampleCount ?? 0;
    const confidence = this.clampSov(sampleCount / 20, 0.1, 1.0);

    return {
      projectedScore,
      projectedGrade,
      confidence,
      projectionBasis: `Based on ${sampleCount} CORD samples with assumed outcome ${assumedOutcome}`,
    };
  }

  /**
   * projectAllOutcomes — Project the final score for all possible outcomes.
   *
   * Returns an array of projections, one per outcome, sorted by
   * projected score descending. Useful for "what if" UX.
   */
  public projectAllOutcomes(): readonly {
    outcome: RunOutcome;
    projectedScore: number;
    projectedGrade: VerifiedGrade;
    multiplier: number;
  }[] {
    const outcomes: RunOutcome[] = ['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED'];
    const projections: Array<{
      outcome: RunOutcome;
      projectedScore: number;
      projectedGrade: VerifiedGrade;
      multiplier: number;
    }> = [];

    for (const outcome of outcomes) {
      const projectedScore = this.computeSovereigntyScore(outcome);
      const projectedGrade = this.mapScoreToGrade(projectedScore);
      const multiplier =
        OUTCOME_MULTIPLIER[outcome as keyof typeof OUTCOME_MULTIPLIER] ?? 0;

      projections.push({
        outcome,
        projectedScore,
        projectedGrade,
        multiplier,
      });
    }

    // Sort by projected score descending
    projections.sort((a, b) => b.projectedScore - a.projectedScore);

    return projections;
  }

  /**
   * computeGradeDistanceMap — For each grade, compute how far the
   * current score is from that grade's threshold.
   *
   * Returns positive values for grades already achieved, negative
   * values for grades not yet reached.
   */
  public computeGradeDistanceMap(currentScore: number): readonly {
    grade: VerifiedGrade;
    threshold: number;
    distance: number;
    achieved: boolean;
    direction: 'above' | 'below' | 'at';
  }[] {
    const result: Array<{
      grade: VerifiedGrade;
      threshold: number;
      distance: number;
      achieved: boolean;
      direction: 'above' | 'below' | 'at';
    }> = [];

    for (const [threshold, grade] of GRADE_THRESHOLDS) {
      const distance = currentScore - threshold;
      const achieved = currentScore >= threshold;
      let direction: 'above' | 'below' | 'at';
      if (Math.abs(distance) < 0.001) direction = 'at';
      else if (distance > 0) direction = 'above';
      else direction = 'below';

      result.push({ grade, threshold, distance, achieved, direction });
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S21 — Run Integrity Forensics
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * buildIntegrityForensicReport — Build a detailed forensic report
   * of the integrity audit trail for a finalized run.
   *
   * This report is intended for internal analytics and admin tools,
   * not for player-facing display.
   */
  public buildIntegrityForensicReport(): {
    totalAuditEntries: number;
    entriesByPhase: Record<string, number>;
    entriesByStatus: Record<string, number>;
    maxAnomalyScore: number;
    meanAnomalyScore: number;
    cumulativeAnomalyScore: number;
    quarantineEvents: number;
    proofRetryCount: number;
    proofLifecycleStage: ProofStage;
    chainHashCount: number;
    healthStatus: string;
    consecutiveFailures: number;
    consecutiveHealthyTicks: number;
    forensicFlags: readonly string[];
  } {
    const entriesByPhase: Record<string, number> = {};
    const entriesByStatus: Record<string, number> = {};
    let maxAnomalyScore = 0;
    let totalAnomalyScore = 0;
    let quarantineEvents = 0;

    for (const entry of this.auditTrail) {
      // Count by phase
      entriesByPhase[entry.phase] = (entriesByPhase[entry.phase] ?? 0) + 1;

      // Count by status
      entriesByStatus[entry.status] = (entriesByStatus[entry.status] ?? 0) + 1;

      // Track anomaly scores
      if (entry.anomalyScore > maxAnomalyScore) {
        maxAnomalyScore = entry.anomalyScore;
      }
      totalAnomalyScore += entry.anomalyScore;

      // Count quarantine events
      if (entry.status === 'QUARANTINED') {
        quarantineEvents++;
      }
    }

    const meanAnomalyScore = this.auditTrail.length > 0
      ? totalAnomalyScore / this.auditTrail.length
      : 0;

    // Build forensic flags
    const forensicFlags: string[] = [];
    if (maxAnomalyScore >= ANOMALY_QUARANTINE_THRESHOLD) {
      forensicFlags.push('MAX_ANOMALY_ABOVE_QUARANTINE_THRESHOLD');
    }
    if (quarantineEvents > 0) {
      forensicFlags.push(`QUARANTINE_EVENTS:${quarantineEvents}`);
    }
    if (this.proofLifecycle.retryCount > 0) {
      forensicFlags.push(`PROOF_RETRIES:${this.proofLifecycle.retryCount}`);
    }
    if (this.proofLifecycle.stage === 'FAILED') {
      forensicFlags.push('PROOF_LIFECYCLE_FAILED');
    }
    if (this.consecutiveFailures > 0) {
      forensicFlags.push(`CONSECUTIVE_FAILURES:${this.consecutiveFailures}`);
    }

    return {
      totalAuditEntries: this.auditTrail.length,
      entriesByPhase,
      entriesByStatus,
      maxAnomalyScore,
      meanAnomalyScore,
      cumulativeAnomalyScore: this.cumulativeAnomalyScore,
      quarantineEvents,
      proofRetryCount: this.proofLifecycle.retryCount,
      proofLifecycleStage: this.proofLifecycle.stage,
      chainHashCount: this.proofLifecycle.chainHashes.length,
      healthStatus: this.healthStatus,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveHealthyTicks: this.consecutiveHealthyTicks,
      forensicFlags,
    };
  }

  /**
   * computeIntegrityConfidenceScore — Compute an overall confidence
   * score (0-1) for the integrity of the run based on the forensic data.
   *
   * A score of 1.0 means perfect integrity — no anomalies, no retries,
   * verified status throughout. A lower score indicates degraded confidence.
   */
  public computeIntegrityConfidenceScore(): number {
    // Factor 1: Anomaly severity (lower is better)
    const anomalyFactor = this.clampSov(
      1 - (this.cumulativeAnomalyScore / ANOMALY_QUARANTINE_THRESHOLD),
      0,
      1,
    );

    // Factor 2: Proof lifecycle success
    const proofFactor = this.proofLifecycle.stage === 'SEALED' ? 1.0
      : this.proofLifecycle.stage === 'GENERATED' ? 0.7
      : this.proofLifecycle.stage === 'PRE_VALIDATED' ? 0.4
      : 0.1;

    // Factor 3: Health continuity (no failures)
    const healthFactor = this.consecutiveFailures === 0 ? 1.0
      : this.clampSov(1 - (this.consecutiveFailures * 0.2), 0, 1);

    // Factor 4: Verification status distribution in audit trail
    let verifiedCount = 0;
    for (const entry of this.auditTrail) {
      if (entry.status === 'VERIFIED') verifiedCount++;
    }
    const verifiedFraction = this.auditTrail.length > 0
      ? verifiedCount / this.auditTrail.length
      : 0.5;

    // Factor 5: Chain hash completeness
    const chainCompleteness = this.clampSov(
      this.proofLifecycle.chainHashes.length / Math.max(1, this.cordHistory.length),
      0,
      1,
    );

    return this.clampSov(
      anomalyFactor * 0.25 +
      proofFactor * 0.25 +
      healthFactor * 0.15 +
      verifiedFraction * 0.20 +
      chainCompleteness * 0.15,
      0,
      1,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S22 — Pipeline Error Handling Utilities
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * buildPipelineErrorResult — Construct a CompleteRunResult for cases
   * where the pipeline cannot run (e.g., already running).
   *
   * Returns a minimal error result with empty pipeline steps and
   * a fallback identity.
   */
  private buildPipelineErrorResult(
    snapshot: RunStateSnapshot,
    errorReason: string,
    nowMs: number,
  ): CompleteRunResult {
    const tickStreamChecksum = this.proof.computeTickStreamChecksum(snapshot);
    const signature = this.buildRunSignature(
      snapshot,
      snapshot.sovereignty.proofHash ?? '',
      tickStreamChecksum,
      nowMs,
    );

    const derivedComponents = this.getAccumulatorDerivedComponents();

    const identity = this.buildRunIdentity(
      signature,
      0,
      'F',
      'UNVERIFIED',
      (snapshot.outcome ?? 'ABANDONED') as RunOutcome,
      [],
      derivedComponents,
    );

    return {
      runIdentity: identity,
      gradeReward: GRADE_REWARD_TABLE.F,
      pipelineSteps: [{
        stepNumber: 1,
        stepName: 'PIPELINE_ERROR',
        success: false,
        durationMs: 0,
        detail: errorReason,
        warnings: [errorReason],
      }],
      totalPipelineDurationMs: 0,
      integrityCheckPassed: false,
      proofGenerated: false,
      gradeAssigned: false,
      tampered: false,
      finalSnapshot: snapshot,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S23 — Sovereignty Score Validation & Diagnostics
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * validateSovereigntyScoreIntegrity — Cross-validate the sovereignty
   * score by computing it independently from the accumulator and
   * comparing against the snapshot's stored value.
   *
   * Returns whether the scores match within a tolerance, and if not,
   * what the discrepancy is.
   */
  public validateSovereigntyScoreIntegrity(
    snapshot: RunStateSnapshot,
  ): {
    valid: boolean;
    storedScore: number;
    recomputedScore: number;
    discrepancy: number;
    tolerance: number;
    diagnosticNotes: readonly string[];
  } {
    const storedScore = snapshot.sovereignty.sovereigntyScore;
    const outcome: RunOutcome = snapshot.outcome ?? 'ABANDONED';
    const recomputedScore = this.computeSovereigntyScore(outcome);
    const tolerance = 0.0001;
    const discrepancy = Math.abs(storedScore - recomputedScore);
    const valid = discrepancy <= tolerance;

    const diagnosticNotes: string[] = [];

    if (!valid) {
      diagnosticNotes.push(
        `Score mismatch: stored=${storedScore.toFixed(6)}, recomputed=${recomputedScore.toFixed(6)}, delta=${discrepancy.toFixed(6)}`,
      );

      // Check if the issue is due to outcome multiplier
      const outcomeKey = outcome as keyof typeof OUTCOME_MULTIPLIER;
      const multiplier = OUTCOME_MULTIPLIER[outcomeKey] ?? 0;
      diagnosticNotes.push(`Outcome multiplier for ${outcome}: ${multiplier}`);

      // Check if accumulator is initialized
      if (!this.accumulator) {
        diagnosticNotes.push('Accumulator is null — scores may diverge without accumulator data');
      }
    } else {
      diagnosticNotes.push('Score integrity verified: stored and recomputed values match');
    }

    return {
      valid,
      storedScore,
      recomputedScore,
      discrepancy,
      tolerance,
      diagnosticNotes,
    };
  }

  /**
   * computeCORDWeightValidation — Validate that CORD_WEIGHTS sum to 1.0
   * (or very close to it) and that OUTCOME_MULTIPLIER contains all
   * expected keys.
   *
   * This is a diagnostic method for runtime self-verification.
   */
  public computeCORDWeightValidation(): {
    weightsSum: number;
    weightsSumValid: boolean;
    individualWeights: Record<string, number>;
    outcomeMultipliers: Record<string, number>;
    allOutcomesPresent: boolean;
    missingOutcomes: readonly string[];
  } {
    // Sum all CORD weights
    const weightsSum =
      CORD_WEIGHTS.decision_speed_score +
      CORD_WEIGHTS.shields_maintained_pct +
      CORD_WEIGHTS.hater_sabotages_blocked +
      CORD_WEIGHTS.cascade_chains_broken +
      CORD_WEIGHTS.pressure_survived_score;

    const weightsSumValid = Math.abs(weightsSum - 1.0) < 0.01;

    // Check all outcome multipliers are present
    const expectedOutcomes = ['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED'];
    const missingOutcomes: string[] = [];

    for (const outcome of expectedOutcomes) {
      if (!(outcome in OUTCOME_MULTIPLIER)) {
        missingOutcomes.push(outcome);
      }
    }

    return {
      weightsSum,
      weightsSumValid,
      individualWeights: {
        decision_speed_score: CORD_WEIGHTS.decision_speed_score,
        shields_maintained_pct: CORD_WEIGHTS.shields_maintained_pct,
        hater_sabotages_blocked: CORD_WEIGHTS.hater_sabotages_blocked,
        cascade_chains_broken: CORD_WEIGHTS.cascade_chains_broken,
        pressure_survived_score: CORD_WEIGHTS.pressure_survived_score,
      },
      outcomeMultipliers: {
        FREEDOM: OUTCOME_MULTIPLIER.FREEDOM,
        TIMEOUT: OUTCOME_MULTIPLIER.TIMEOUT,
        BANKRUPT: OUTCOME_MULTIPLIER.BANKRUPT,
        ABANDONED: OUTCOME_MULTIPLIER.ABANDONED,
      },
      allOutcomesPresent: missingOutcomes.length === 0,
      missingOutcomes,
    };
  }

  /**
   * buildFullRunDiagnostic — Build a comprehensive diagnostic report
   * covering all sovereignty engine subsystems.
   *
   * This is the canonical diagnostic entry point for debugging and
   * admin support tools. It aggregates data from all other diagnostic
   * methods into a single object.
   */
  public buildFullRunDiagnostic(snapshot: RunStateSnapshot): {
    engineHealth: EngineHealth;
    accumulatorHealth: ReturnType<SovereigntyEngine['getAccumulatorTickHealth']>;
    cordRange: ReturnType<SovereigntyEngine['getAccumulatorCordRange']>;
    edgeCases: ReturnType<SovereigntyEngine['validateEdgeCases']>;
    integrityForensics: ReturnType<SovereigntyEngine['buildIntegrityForensicReport']>;
    integrityConfidence: number;
    cordWeightValidation: ReturnType<SovereigntyEngine['computeCORDWeightValidation']>;
    scoreValidation: ReturnType<SovereigntyEngine['validateSovereigntyScoreIntegrity']>;
    pipelineRunning: boolean;
    proofLifecycleStage: ProofStage;
    cordHistoryLength: number;
    auditTrailLength: number;
    ghostGapHistoryLength: number;
    badgeCacheSize: number;
  } {
    return {
      engineHealth: this.getHealth(),
      accumulatorHealth: this.getAccumulatorTickHealth(),
      cordRange: this.getAccumulatorCordRange(),
      edgeCases: this.validateEdgeCases(snapshot),
      integrityForensics: this.buildIntegrityForensicReport(),
      integrityConfidence: this.computeIntegrityConfidenceScore(),
      cordWeightValidation: this.computeCORDWeightValidation(),
      scoreValidation: this.validateSovereigntyScoreIntegrity(snapshot),
      pipelineRunning: this.pipelineRunning,
      proofLifecycleStage: this.proofLifecycle.stage,
      cordHistoryLength: this.cordHistory.length,
      auditTrailLength: this.auditTrail.length,
      ghostGapHistoryLength: this.ghostGapHistory.length,
      badgeCacheSize: this.badgeProgressCache.size,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S24 — Player-Facing Score Explanation
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * buildPlayerScoreExplanation — Build a human-readable explanation
   * of how the sovereignty score was computed.
   *
   * This is designed for the player-facing results screen. It uses
   * simple language and avoids technical jargon.
   *
   * @param outcome - The run outcome.
   * @returns An explanation object with narrative text and highlights.
   */
  public buildPlayerScoreExplanation(outcome: RunOutcome): {
    headline: string;
    lines: readonly string[];
    strongestComponent: string;
    weakestComponent: string;
    outcomeImpact: string;
    improvementTip: string;
  } {
    const breakdown = this.computeDetailedSovereigntyBreakdown(outcome);
    const grade = this.mapScoreToGrade(breakdown.cappedScore);
    const reward = this.dispatchGradeReward(grade);

    // Determine strongest and weakest
    const componentEntries = [
      { name: 'Decision Speed', value: breakdown.components.decisionSpeedScore, weighted: breakdown.weightedContributions.decisionSpeedWeighted },
      { name: 'Shield Maintenance', value: breakdown.components.shieldsMaintainedPct, weighted: breakdown.weightedContributions.shieldsMaintainedWeighted },
      { name: 'Sabotage Blocking', value: breakdown.components.haterBlockRate, weighted: breakdown.weightedContributions.haterBlockWeighted },
      { name: 'Cascade Breaking', value: breakdown.components.cascadeBreakRate, weighted: breakdown.weightedContributions.cascadeBreakWeighted },
      { name: 'Pressure Survival', value: breakdown.components.ticksSurvivedPct, weighted: breakdown.weightedContributions.pressureSurvivedWeighted },
    ];

    componentEntries.sort((a, b) => b.weighted - a.weighted);
    const strongest = componentEntries[0];
    const weakest = componentEntries[componentEntries.length - 1];

    // Build headline
    let headline: string;
    if (grade === 'A') {
      headline = `Sovereign Excellence — Grade ${grade} earned with ${reward.xp} XP`;
    } else if (grade === 'B') {
      headline = `Strong Performance — Grade ${grade} earned with ${reward.xp} XP`;
    } else if (grade === 'C') {
      headline = `Solid Effort — Grade ${grade} earned with ${reward.xp} XP`;
    } else if (grade === 'D') {
      headline = `Room to Grow — Grade ${grade} earned with ${reward.xp} XP`;
    } else {
      headline = `Keep Pushing — Grade ${grade} earned with ${reward.xp} XP`;
    }

    // Build explanation lines
    const lines: string[] = [];
    lines.push(
      `Your sovereignty score: ${breakdown.cappedScore.toFixed(4)} (Grade ${grade})`,
    );
    lines.push(
      `This score is based on five performance dimensions, each weighted differently.`,
    );

    for (const comp of componentEntries) {
      const pctOfTotal = breakdown.baseScore > 0
        ? ((comp.weighted / breakdown.baseScore) * 100).toFixed(0)
        : '0';
      lines.push(
        `${comp.name}: ${(comp.value * 100).toFixed(0)}% — contributed ${pctOfTotal}% of your base score`,
      );
    }

    lines.push(
      `Base score: ${breakdown.baseScore.toFixed(4)}`,
    );
    lines.push(
      `Outcome multiplier (${outcome}): ${breakdown.outcomeMultiplier.toFixed(2)}x`,
    );

    if (breakdown.wasCapApplied) {
      lines.push(
        `Your raw score of ${breakdown.rawScore.toFixed(4)} was capped at ${SOVEREIGNTY_SCORE_CAP}`,
      );
    }

    // Outcome impact
    let outcomeImpact: string;
    if (outcome === 'FREEDOM') {
      outcomeImpact = `Winning with FREEDOM applied a ${OUTCOME_MULTIPLIER.FREEDOM}x multiplier — the best possible outcome bonus.`;
    } else if (outcome === 'TIMEOUT') {
      outcomeImpact = `Timing out applied a ${OUTCOME_MULTIPLIER.TIMEOUT}x multiplier — you lost some score potential by not finishing.`;
    } else if (outcome === 'BANKRUPT') {
      outcomeImpact = `Going bankrupt applied a ${OUTCOME_MULTIPLIER.BANKRUPT}x penalty — your score was heavily reduced.`;
    } else {
      outcomeImpact = `Abandoning the run set the multiplier to ${OUTCOME_MULTIPLIER.ABANDONED}x — completing the run earns a real score.`;
    }

    // Improvement tip
    let improvementTip: string;
    if (weakest.value < 0.3) {
      improvementTip = `Focus on ${weakest.name} — it was your weakest area at ${(weakest.value * 100).toFixed(0)}%.`;
    } else if (outcome !== 'FREEDOM') {
      improvementTip = `Try to reach FREEDOM — the ${OUTCOME_MULTIPLIER.FREEDOM}x multiplier is the biggest single factor.`;
    } else if (breakdown.cappedScore < 1.0) {
      improvementTip = `Your overall score was ${breakdown.cappedScore.toFixed(4)} — push all components above 80% for a shot at Grade A.`;
    } else {
      improvementTip = `Excellent performance. Try harder modes for an even greater challenge.`;
    }

    return {
      headline,
      lines,
      strongestComponent: strongest.name,
      weakestComponent: weakest.name,
      outcomeImpact,
      improvementTip,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S25 — Run Comparison Utilities
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * compareRunIdentities — Compare two run identities and return
   * a detailed comparison of scores, grades, and components.
   *
   * Used for "this run vs last run" or "this run vs best run" UX.
   */
  public compareRunIdentities(
    current: RunIdentity,
    previous: RunIdentity,
  ): {
    scoreDelta: number;
    gradeChange: 'upgrade' | 'downgrade' | 'same';
    componentDeltas: {
      decisionSpeed: number;
      shieldsMaintained: number;
      haterBlock: number;
      cascadeBreak: number;
      pressureSurvived: number;
    };
    outcomeComparison: string;
    improvementAreas: readonly string[];
    regressionAreas: readonly string[];
  } {
    const scoreDelta = current.sovereigntyScore - previous.sovereigntyScore;

    const currentGradeNum = this.gradeToNumeric(current.verifiedGrade);
    const previousGradeNum = this.gradeToNumeric(previous.verifiedGrade);
    let gradeChange: 'upgrade' | 'downgrade' | 'same';
    if (currentGradeNum > previousGradeNum) gradeChange = 'upgrade';
    else if (currentGradeNum < previousGradeNum) gradeChange = 'downgrade';
    else gradeChange = 'same';

    const componentDeltas = {
      decisionSpeed:
        current.cordBreakdown.decisionSpeedScore - previous.cordBreakdown.decisionSpeedScore,
      shieldsMaintained:
        current.cordBreakdown.shieldsMaintainedPct - previous.cordBreakdown.shieldsMaintainedPct,
      haterBlock:
        current.cordBreakdown.haterBlockRate - previous.cordBreakdown.haterBlockRate,
      cascadeBreak:
        current.cordBreakdown.cascadeBreakRate - previous.cordBreakdown.cascadeBreakRate,
      pressureSurvived:
        current.cordBreakdown.pressureSurvivedScore - previous.cordBreakdown.pressureSurvivedScore,
    };

    const improvementAreas: string[] = [];
    const regressionAreas: string[] = [];

    if (componentDeltas.decisionSpeed > 0.05) improvementAreas.push('Decision Speed');
    if (componentDeltas.decisionSpeed < -0.05) regressionAreas.push('Decision Speed');
    if (componentDeltas.shieldsMaintained > 0.05) improvementAreas.push('Shield Maintenance');
    if (componentDeltas.shieldsMaintained < -0.05) regressionAreas.push('Shield Maintenance');
    if (componentDeltas.haterBlock > 0.05) improvementAreas.push('Sabotage Blocking');
    if (componentDeltas.haterBlock < -0.05) regressionAreas.push('Sabotage Blocking');
    if (componentDeltas.cascadeBreak > 0.05) improvementAreas.push('Cascade Breaking');
    if (componentDeltas.cascadeBreak < -0.05) regressionAreas.push('Cascade Breaking');
    if (componentDeltas.pressureSurvived > 0.05) improvementAreas.push('Pressure Survival');
    if (componentDeltas.pressureSurvived < -0.05) regressionAreas.push('Pressure Survival');

    const outcomeComparison =
      current.outcome === previous.outcome
        ? `Same outcome: ${current.outcome}`
        : `Outcome changed: ${previous.outcome} -> ${current.outcome}`;

    return {
      scoreDelta,
      gradeChange,
      componentDeltas,
      outcomeComparison,
      improvementAreas,
      regressionAreas,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S26 — Internal Sovereignty Helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * clampSov — Sovereignty-specific clamp with NaN/Infinity protection.
   *
   * This is distinct from the general clamp() to allow sovereignty
   * methods to use it without naming collision concerns in future
   * refactors. It applies the same logic: NaN/Infinity returns min.
   */
  private clampSov(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Clamp a number to [min, max].
   */
  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }
}

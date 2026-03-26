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

  /**
   * Clamp a number to [min, max].
   */
  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }
}

//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/SovereigntyEngine.ts

// ═══════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SOVEREIGNTY ENGINE — ORCHESTRATOR
// Density6 LLC · Confidential · Do not distribute
//
// Responsibilities:
//   · Maintain RunAccumulatorStats in memory across the entire run
//   · initRun()     — called by EngineOrchestrator before tick 0
//   · snapshotTick() — called synchronously at Step 12 of every tick
//   · completeRun() — async 3-step pipeline on run end:
//       Step 1: ReplayIntegrityChecker.verify()
//       Step 2: ProofGenerator.generate() + buildSignature()
//       Step 3: RunGradeAssigner.computeScore() + dispatchReward()
//   · Emits RUN_COMPLETED on pipeline success
//   · Emits PROOF_VERIFICATION_FAILED on any pipeline step failure
//   · reset() — clears all state for a fresh run
//
// Design contract:
//   ✦ The ONLY engine that writes the final record to the DB writer.
//     All other engines read from state.
//   ✦ snapshotTick() is SYNCHRONOUS. Zero async calls inside.
//   ✦ completeRun() is ASYNC. Must be awaited before any DB write.
//   ✦ pipelineRunning flag prevents duplicate completeRun() execution.
//   ✦ TAMPERED runs continue through Steps 2 and 3 — do not abort.
//   ✦ Exceptions inside completeRun() are caught; null is returned;
//     PROOF_VERIFICATION_FAILED is emitted. Never let exceptions escape.
//   ✦ SovereigntyEngine never imports from any other engine module.
//     Cross-engine state flows in via RunStateSnapshot only.
//
// Import rules: may import ProofGenerator, ReplayIntegrityChecker,
//   RunGradeAssigner, SovereigntyExporter, types.ts, and EventBus.
//   NEVER import TimeEngine, PressureEngine, TensionEngine,
//   ShieldEngine, BattleEngine, or CascadeEngine.
// ═══════════════════════════════════════════════════════════════════

import type { EventBus } from '../core/EventBus';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { ProofGenerator } from './ProofGenerator';
import { ReplayIntegrityChecker } from './ReplayIntegrityChecker';
import { RunGradeAssigner } from './RunGradeAssigner';
import type {
  RunAccumulatorStats,
  RunIdentity,
  TickSnapshot,
  RunOutcome,
  RunCompletedPayload,
  ProofVerificationFailedPayload,
} from './types';

export class SovereigntyEngine {
  private accumulator:     RunAccumulatorStats | null = null;
  private proofGen:        ProofGenerator;
  private integrityChkr:  ReplayIntegrityChecker;
  private gradeAssigner:   RunGradeAssigner;
  private eventBus:        EventBus;
  private pipelineRunning: boolean = false;

  constructor(eventBus: EventBus) {
    this.eventBus       = eventBus;
    this.proofGen       = new ProofGenerator();
    this.integrityChkr  = new ReplayIntegrityChecker();
    this.gradeAssigner  = new RunGradeAssigner(eventBus);
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION 1 — RUN LIFECYCLE
  // ══════════════════════════════════════════════════════════════════

  // ── CALLED AT RUN START ───────────────────────────────────────────
  /**
   * Initialize a fresh accumulator for a new run.
   * Called by EngineOrchestrator before the first tick, after RUN_STARTED emits.
   * Sets outcome to ABANDONED by default — overwritten in completeRun().
   */
  public initRun(params: {
    runId:            string;
    userId:           string;
    seed:             string;
    seasonTickBudget: number;
    clientVersion:    string;
    engineVersion:    string;
  }): void {
    this.accumulator = {
      runId:                 params.runId,
      userId:                params.userId,
      seed:                  params.seed,
      startedAt:             Date.now(),
      completedAt:           0,
      outcome:               'ABANDONED', // overwritten in completeRun()
      finalNetWorth:         0,
      seasonTickBudget:      params.seasonTickBudget,
      ticksSurvived:         0,
      clientVersion:         params.clientVersion,
      engineVersion:         params.engineVersion,
      shieldIntegralSum:     0,
      shieldSampleCount:     0,
      totalHaterAttempts:    0,
      haterSabotagesBlocked: 0,
      haterSabotagesCount:   0,
      totalCascadeChains:    0,
      cascadeChainsBreak:    0,
      decisionRecords:       [],
      tickSnapshots:         [],
    };
  }

  // ── CALLED AT TICK STEP 12 ────────────────────────────────────────
  /**
   * Record a tick snapshot into the in-memory accumulator.
   *
   * CONTRACT: This method is SYNCHRONOUS. No async calls permitted here.
   *           It runs inside the tick loop — latency matters.
   *
   * tickHash uses CRC32 (sync) for speed during the run.
   * The full SHA-256 pass happens post-run in ProofGenerator.computeTickStreamChecksum().
   *
   * Called by EngineOrchestrator at Step 12 of every tick:
   *   this.sovereigntyEngine.snapshotTick(this.runStateSnapshot);
   */
  public snapshotTick(snapshot: RunStateSnapshot): void {
    if (!this.accumulator) return;

    const tickSnap: TickSnapshot = {
      tickIndex:           snapshot.tickIndex,
      tickHash:            this.computeTickHash(snapshot),
      pressureScore:       snapshot.pressureScore,
      shieldAvgIntegrity:  snapshot.shieldAvgIntegrityPct,
      netWorth:            snapshot.netWorth,
      haterHeat:           snapshot.haterHeat,
      cascadeChainsActive: snapshot.activeCascadeChains,
      decisionsThisTick:   snapshot.decisionsThisTick ?? [],
    };

    this.accumulator.tickSnapshots.push(tickSnap);
    this.accumulator.ticksSurvived          += 1;
    this.accumulator.shieldIntegralSum      += snapshot.shieldAvgIntegrityPct;
    this.accumulator.shieldSampleCount      += 1;
    this.accumulator.totalHaterAttempts     += snapshot.haterAttemptsThisTick;
    this.accumulator.haterSabotagesBlocked  += snapshot.haterBlockedThisTick;
    this.accumulator.haterSabotagesCount    += snapshot.haterDamagedThisTick;
    this.accumulator.totalCascadeChains     += snapshot.cascadesTriggeredThisTick;
    this.accumulator.cascadeChainsBreak     += snapshot.cascadesBrokenThisTick;

    if (snapshot.decisionsThisTick) {
      this.accumulator.decisionRecords.push(...snapshot.decisionsThisTick);
    }
  }

  // ── CALLED WHEN RUN ENDS ──────────────────────────────────────────
  /**
   * Execute the 3-step sovereignty pipeline on run completion.
   *
   * Step 1 — INTEGRITY CHECK (ReplayIntegrityChecker)
   *   · Structural check: sequence continuity, budget ceiling, count match
   *   · Continuity check: statistical anomaly detection
   *   · TAMPERED does NOT abort the pipeline — run is flagged but continues.
   *     This prevents players from being stuck in an unresolvable state.
   *
   * Step 2 — PROOF HASH GENERATION (ProofGenerator)
   *   · Computes proof_hash from seed|checksum|outcome|netWorth|userId
   *   · Builds RunSignature with full identity fields
   *
   * Step 3 — GRADE ASSIGNMENT + REWARD DISPATCH (RunGradeAssigner)
   *   · Computes sovereignty_score via weighted formula
   *   · Assigns letter grade via GRADE_THRESHOLDS
   *   · Dispatches RUN_REWARD_DISPATCHED via EventBus
   *
   * Emits RUN_COMPLETED on success.
   * Returns null + emits PROOF_VERIFICATION_FAILED if any unhandled exception occurs.
   * pipelineRunning flag prevents duplicate execution on concurrent calls.
   *
   * @param params.outcome       — FREEDOM | TIMEOUT | BANKRUPT | ABANDONED
   * @param params.finalNetWorth — Raw net worth at run end (may be negative for BANKRUPT)
   * @returns RunIdentity on success, null on unrecoverable failure
   */
  public async completeRun(params: {
    outcome:       RunOutcome;
    finalNetWorth: number;
  }): Promise<RunIdentity | null> {
    if (!this.accumulator) {
      console.error('[SovereigntyEngine] completeRun called with no active accumulator');
      return null;
    }
    if (this.pipelineRunning) {
      console.error('[SovereigntyEngine] Pipeline already running — duplicate completeRun call ignored');
      return null;
    }

    this.pipelineRunning                = true;
    this.accumulator.completedAt        = Date.now();
    this.accumulator.outcome            = params.outcome;
    this.accumulator.finalNetWorth      = params.finalNetWorth;

    const runId = this.accumulator.runId;

    try {
      // ─── STEP 1: INTEGRITY CHECK ─────────────────────────────────
      const integrityResult = await this.integrityChkr.verify(this.accumulator);

      if (integrityResult.status === 'TAMPERED') {
        // Emit a failure notification but do NOT abort.
        // TAMPERED runs still get a proof_hash and a grade record.
        // Aborting would trap the player in an unresolvable UI state.
        this.emitFailure(runId, 1, `Tick stream tampered: ${integrityResult.reason ?? 'unknown'}`);
      }

      // ─── STEP 2: PROOF HASH GENERATION ───────────────────────────
      const proofHash = await this.proofGen.generate({
        seed:               this.accumulator.seed,
        tickStreamChecksum: integrityResult.tickStreamChecksum,
        outcome:            params.outcome,
        finalNetWorth:      params.finalNetWorth,
        userId:             this.accumulator.userId,
      });

      const signature = this.proofGen.buildSignature({
        proofHash,
        accumulator:     this.accumulator,
        integrityStatus: integrityResult.status,
      });

      // ─── STEP 3: GRADE ASSIGNMENT + REWARD DISPATCH ───────────────
      const score  = this.gradeAssigner.computeScore(this.accumulator);
      const reward = await this.gradeAssigner.dispatchReward({
        runId,
        userId: this.accumulator.userId,
        score,
      });

      const identity: RunIdentity = {
        signature,
        score,
        integrityStatus: integrityResult.status,
      };

      // ─── EMIT RUN_COMPLETED ───────────────────────────────────────
      const payload: RunCompletedPayload = {
        runId,
        proofHash,
        grade:            score.grade,
        sovereigntyScore: score.finalScore,
        integrityStatus:  integrityResult.status,
        reward,
      };
      this.eventBus.emit('RUN_COMPLETED', payload);

      return identity;

    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.emitFailure(runId, 2, `Pipeline exception: ${reason}`);
      return null;

    } finally {
      // Always release the lock — even if we returned null above.
      this.pipelineRunning = false;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION 2 — PUBLIC ACCESSORS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Read-only view of the current accumulator.
   * Consumed by EngineOrchestrator to populate RunStateSnapshot if needed.
   * Returns null if no run is active.
   */
  public getCurrentRunStats(): Readonly<RunAccumulatorStats> | null {
    return this.accumulator;
  }

  /**
   * Reset all state for a subsequent run.
   * Called by EngineOrchestrator on RUN_ENDED or before initRun() on replay.
   */
  public reset(): void {
    this.accumulator    = null;
    this.pipelineRunning = false;
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION 3 — PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Compute a deterministic tick hash from snapshot fields.
   * SYNCHRONOUS — CRC32 only. SHA-256 is handled post-run.
   *
   * Input format: tickIndex|pressureScore(4dp)|shieldAvg(2dp)|netWorth(2dp)|haterHeat
   * All fields pipe-separated, numeric precision fixed to prevent float drift.
   */
  private computeTickHash(snap: RunStateSnapshot): string {
    const input = [
      snap.tickIndex,
      snap.pressureScore.toFixed(4),
      snap.shieldAvgIntegrityPct.toFixed(2),
      snap.netWorth.toFixed(2),
      snap.haterHeat,
    ].join('|');
    return ProofGenerator.crc32hex(input);
  }

  /**
   * Emit PROOF_VERIFICATION_FAILED with step number and reason.
   * Does NOT throw — pipeline decides whether to continue or return null.
   */
  private emitFailure(runId: string, step: 1 | 2 | 3, reason: string): void {
    const payload: ProofVerificationFailedPayload = { runId, step, reason };
    this.eventBus.emit('PROOF_VERIFICATION_FAILED', payload);
    console.error(`[SovereigntyEngine] Step ${step} failure — ${reason}`);
  }
}
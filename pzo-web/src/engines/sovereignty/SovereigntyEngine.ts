// ═══════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SOVEREIGNTY ENGINE — ORCHESTRATOR
// Density6 LLC · Confidential · Do not distribute
/// Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/SovereigntyEngine.ts
// ═══════════════════════════════════════════════════════════════════

import type { EventBus } from '../core/EventBus';
import type { RunStateSnapshot } from '../core/types';
import { ProofGenerator } from './ProofGenerator';
import { ReplayIntegrityChecker } from './ReplayIntegrityChecker';
import { RunGradeAssigner } from './RunGradeAssigner';
import type {
  DecisionRecord,
  GradeReward,
  IntegrityStatus,
  ProofVerificationFailedPayload,
  RunAccumulatorStats,
  RunCompletedPayload,
  RunIdentity,
  RunOutcome,
  RunSignature,
  SovereigntyScore,
  TickSnapshot,
} from './types';

type SnapshotRecord = Record<string, unknown>;

export class SovereigntyEngine {
  private accumulator: RunAccumulatorStats | null = null;
  private readonly proofGen: ProofGenerator;
  private readonly integrityChkr: ReplayIntegrityChecker;
  private readonly gradeAssigner: RunGradeAssigner;
  private readonly eventBus: EventBus;

  private pipelineRunning = false;
  private completionPromise: Promise<RunIdentity | null> | null = null;
  private completedIdentity: RunIdentity | null = null;

  /**
   * These caches guarantee the proof_hash and downstream artifacts are computed
   * exactly once per run, even if completeRun() is re-entered after a partial failure.
   */
  private cachedIntegrityStatus: IntegrityStatus | null = null;
  private cachedSignature: RunSignature | null = null;
  private cachedScore: SovereigntyScore | null = null;
  private cachedReward: GradeReward | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.proofGen = new ProofGenerator();
    this.integrityChkr = new ReplayIntegrityChecker();
    this.gradeAssigner = new RunGradeAssigner(eventBus);
  }

  // ── CALLED AT RUN START ────────────────────────────────────────

  public initRun(params: {
    runId: string;
    userId: string;
    seed: string;
    seasonTickBudget: number;
    clientVersion: string;
    engineVersion: string;
  }): void {
    this.reset();

    const seasonTickBudget =
      Number.isFinite(params.seasonTickBudget) && params.seasonTickBudget > 0
        ? Math.trunc(params.seasonTickBudget)
        : 1;

    this.accumulator = {
      runId: params.runId,
      userId: params.userId,
      seed: params.seed,
      startedAt: Date.now(),
      completedAt: 0,
      outcome: 'ABANDONED',
      finalNetWorth: 0,
      seasonTickBudget,
      ticksSurvived: 0,
      clientVersion: params.clientVersion,
      engineVersion: params.engineVersion,
      shieldIntegralSum: 0,
      shieldSampleCount: 0,
      totalHaterAttempts: 0,
      haterSabotagesBlocked: 0,
      haterSabotagesCount: 0,
      totalCascadeChains: 0,
      cascadeChainsBreak: 0,
      decisionRecords: [],
      tickSnapshots: [],
    };
  }

  // ── CALLED AT TICK STEP 12 ─────────────────────────────────────

  public snapshotTick(snapshot: RunStateSnapshot): void {
    if (!this.accumulator) {
      return;
    }

    const tickIndex = this.extractTickIndex(snapshot);
    const pressureScore = this.extractPressureScore(snapshot);
    const shieldAvgIntegrityPct = this.extractShieldAvgIntegrityPct(snapshot);
    const netWorth = this.extractNetWorth(snapshot);
    const haterHeat = this.extractHaterHeat(snapshot);
    const activeCascadeChains = this.extractActiveCascadeChains(snapshot);
    const decisionsThisTick = this.extractDecisionRecords(snapshot);

    const tickSnap: TickSnapshot = {
      tickIndex,
      tickHash: this.computeTickHash({
        tickIndex,
        pressureScore,
        shieldAvgIntegrityPct,
        netWorth,
        haterHeat,
      }),
      pressureScore,
      shieldAvgIntegrity: shieldAvgIntegrityPct,
      netWorth,
      haterHeat,
      cascadeChainsActive: activeCascadeChains,
      decisionsThisTick,
    };

    this.accumulator.tickSnapshots.push(tickSnap);
    this.accumulator.ticksSurvived += 1;
    this.accumulator.shieldIntegralSum += shieldAvgIntegrityPct;
    this.accumulator.shieldSampleCount += 1;
    this.accumulator.totalHaterAttempts += this.extractHaterAttemptsThisTick(snapshot);
    this.accumulator.haterSabotagesBlocked += this.extractHaterBlockedThisTick(snapshot);
    this.accumulator.haterSabotagesCount += this.extractHaterDamagedThisTick(snapshot);
    this.accumulator.totalCascadeChains += this.extractCascadesTriggeredThisTick(snapshot);
    this.accumulator.cascadeChainsBreak += this.extractCascadesBrokenThisTick(snapshot);

    if (decisionsThisTick.length > 0) {
      this.accumulator.decisionRecords.push(...decisionsThisTick);
    }
  }

  // ── CALLED WHEN RUN ENDS ───────────────────────────────────────

  public async completeRun(params: {
    outcome: RunOutcome;
    finalNetWorth: number;
  }): Promise<RunIdentity | null> {
    if (!this.accumulator) {
      console.error('[SovereigntyEngine] completeRun called with no active accumulator');
      return null;
    }

    if (this.completedIdentity) {
      return this.completedIdentity;
    }

    if (this.completionPromise) {
      return this.completionPromise;
    }

    this.completionPromise = this.completeRunInternal(params);

    try {
      return await this.completionPromise;
    } finally {
      this.completionPromise = null;
    }
  }

  public getCurrentRunStats(): Readonly<RunAccumulatorStats> | null {
    return this.accumulator;
  }

  public reset(): void {
    this.accumulator = null;
    this.pipelineRunning = false;
    this.completionPromise = null;
    this.completedIdentity = null;
    this.cachedIntegrityStatus = null;
    this.cachedSignature = null;
    this.cachedScore = null;
    this.cachedReward = null;
  }

  // ── INTERNAL PIPELINE ──────────────────────────────────────────

  private async completeRunInternal(params: {
    outcome: RunOutcome;
    finalNetWorth: number;
  }): Promise<RunIdentity | null> {
    if (!this.accumulator) {
      return null;
    }

    if (this.pipelineRunning) {
      console.error('[SovereigntyEngine] Pipeline already running — duplicate completeRun call ignored');
      return null;
    }

    this.pipelineRunning = true;

    const acc = this.accumulator;
    acc.completedAt = Date.now();
    acc.outcome = params.outcome;
    acc.finalNetWorth = this.normalizeFiniteNumber(params.finalNetWorth, 0);
    const runId = acc.runId;

    let currentStep: 1 | 2 | 3 = 1;

    try {
      const integrityResult = await this.integrityChkr.verify(acc);
      let integrityStatus = this.cachedIntegrityStatus ?? integrityResult.status;
      this.cachedIntegrityStatus = integrityStatus;

      if (integrityStatus === 'TAMPERED') {
        this.emitFailure(
          runId,
          1,
          `Tick stream tampered: ${integrityResult.reason ?? 'unknown reason'}`,
        );
      }

      currentStep = 2;

      if (!this.cachedSignature) {
        const proofHash = await this.proofGen.generate({
          seed: acc.seed,
          tickStreamChecksum: integrityResult.tickStreamChecksum,
          outcome: params.outcome,
          finalNetWorth: acc.finalNetWorth,
          userId: acc.userId,
        });

        this.cachedSignature = this.proofGen.buildSignature({
          proofHash,
          accumulator: acc,
          integrityStatus,
        });
      }

      if (!this.cachedSignature) {
        throw new Error('[SovereigntyEngine] Signature generation failed');
      }

      currentStep = 3;

      if (!this.cachedScore) {
        this.cachedScore = this.gradeAssigner.computeScore(acc);
      }

      if (!this.cachedScore) {
        throw new Error('[SovereigntyEngine] Score computation failed');
      }

      if (!this.cachedReward) {
        this.cachedReward = await this.gradeAssigner.dispatchReward({
          runId,
          userId: acc.userId,
          score: this.cachedScore,
        });
      }

      if (!this.cachedReward) {
        throw new Error('[SovereigntyEngine] Reward dispatch failed');
      }

      const identity: RunIdentity = {
        signature: this.cachedSignature,
        score: this.cachedScore,
        integrityStatus,
      };

      const payload: RunCompletedPayload = {
        runId,
        proofHash: identity.signature.proofHash,
        grade: identity.score.grade,
        sovereigntyScore: identity.score.finalScore,
        integrityStatus: identity.integrityStatus,
        reward: this.cachedReward,
      };

      this.emitRunCompleted(payload);
      this.completedIdentity = identity;

      return identity;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.emitFailure(runId, currentStep, `Pipeline exception: ${reason}`);
      return null;
    } finally {
      this.pipelineRunning = false;
    }
  }

  // ── HASHING ────────────────────────────────────────────────────

  private computeTickHash(params: {
    tickIndex: number;
    pressureScore: number;
    shieldAvgIntegrityPct: number;
    netWorth: number;
    haterHeat: number;
  }): string {
    const input = [
      params.tickIndex,
      params.pressureScore.toFixed(4),
      params.shieldAvgIntegrityPct.toFixed(2),
      params.netWorth.toFixed(2),
      Math.trunc(params.haterHeat),
    ].join('|');

    return ProofGenerator.crc32hex(input);
  }

  // ── SNAPSHOT EXTRACTION ────────────────────────────────────────

  private extractTickIndex(snapshot: RunStateSnapshot): number {
    return Math.max(
      0,
      Math.trunc(
        this.firstNumber(
          snapshot,
          [
            ['tickIndex'],
            ['tick'],
          ],
          this.accumulator?.tickSnapshots.length ?? 0,
        ),
      ),
    );
  }

  private extractPressureScore(snapshot: RunStateSnapshot): number {
    return this.normalizeFiniteNumber(
      this.firstNumber(
        snapshot,
        [
          ['pressureScore'],
          ['pressure', 'score'],
        ],
        0,
      ),
      0,
    );
  }

  private extractShieldAvgIntegrityPct(snapshot: RunStateSnapshot): number {
    const value = this.firstNumber(
      snapshot,
      [
        ['shieldAvgIntegrityPct'],
        ['shieldAvgIntegrity'],
        ['shields', 'overallIntegrityPct'],
        ['shield', 'overallIntegrityPct'],
      ],
      0,
    );

    const normalized = this.normalizeFiniteNumber(value, 0);
    const percent = normalized <= 1 ? normalized * 100 : normalized;

    return this.clamp(percent, 0, 100);
  }

  private extractNetWorth(snapshot: RunStateSnapshot): number {
    return this.normalizeFiniteNumber(
      this.firstNumber(
        snapshot,
        [
          ['netWorth'],
          ['economy', 'netWorth'],
        ],
        0,
      ),
      0,
    );
  }

  private extractHaterHeat(snapshot: RunStateSnapshot): number {
    return Math.trunc(
      this.normalizeFiniteNumber(
        this.firstNumber(
          snapshot,
          [
            ['haterHeat'],
            ['battle', 'haterHeat'],
          ],
          0,
        ),
        0,
      ),
    );
  }

  private extractActiveCascadeChains(snapshot: RunStateSnapshot): number {
    const direct = this.firstNumber(
      snapshot,
      [
        ['activeCascadeChains'],
        ['cascade', 'activeCascadeChains'],
      ],
      Number.NaN,
    );

    if (Number.isFinite(direct)) {
      return Math.max(0, Math.trunc(direct));
    }

    return this.firstArrayLength(
      snapshot,
      [
        ['activeCascades'],
        ['cascade', 'activeCascades'],
        ['cascade', 'activeChains'],
      ],
    );
  }

  private extractHaterAttemptsThisTick(snapshot: RunStateSnapshot): number {
    return Math.max(
      0,
      Math.trunc(
        this.firstNumber(
          snapshot,
          [
            ['haterAttemptsThisTick'],
            ['battle', 'haterAttemptsThisTick'],
            ['telemetry', 'haterAttemptsThisTick'],
          ],
          0,
        ),
      ),
    );
  }

  private extractHaterBlockedThisTick(snapshot: RunStateSnapshot): number {
    return Math.max(
      0,
      Math.trunc(
        this.firstNumber(
          snapshot,
          [
            ['haterBlockedThisTick'],
            ['battle', 'haterBlockedThisTick'],
            ['telemetry', 'haterBlockedThisTick'],
          ],
          0,
        ),
      ),
    );
  }

  private extractHaterDamagedThisTick(snapshot: RunStateSnapshot): number {
    return Math.max(
      0,
      Math.trunc(
        this.firstNumber(
          snapshot,
          [
            ['haterDamagedThisTick'],
            ['battle', 'haterDamagedThisTick'],
            ['telemetry', 'haterDamagedThisTick'],
          ],
          0,
        ),
      ),
    );
  }

  private extractCascadesTriggeredThisTick(snapshot: RunStateSnapshot): number {
    return Math.max(
      0,
      Math.trunc(
        this.firstNumber(
          snapshot,
          [
            ['cascadesTriggeredThisTick'],
            ['cascade', 'cascadesTriggeredThisTick'],
            ['telemetry', 'cascadesTriggeredThisTick'],
          ],
          0,
        ),
      ),
    );
  }

  private extractCascadesBrokenThisTick(snapshot: RunStateSnapshot): number {
    return Math.max(
      0,
      Math.trunc(
        this.firstNumber(
          snapshot,
          [
            ['cascadesBrokenThisTick'],
            ['cascade', 'cascadesBrokenThisTick'],
            ['telemetry', 'cascadesBrokenThisTick'],
          ],
          0,
        ),
      ),
    );
  }

  private extractDecisionRecords(snapshot: RunStateSnapshot): DecisionRecord[] {
    const raw =
      this.firstArray(
        snapshot,
        [
          ['decisionsThisTick'],
          ['telemetry', 'decisionsThisTick'],
          ['decisions'],
        ],
      ) ?? [];

    const decisions: DecisionRecord[] = [];

    for (const entry of raw) {
      const normalized = this.normalizeDecisionRecord(entry);
      if (normalized) {
        decisions.push(normalized);
      }
    }

    return decisions;
  }

  private normalizeDecisionRecord(entry: unknown): DecisionRecord | null {
    const value = this.toRecord(entry);
    if (!value) {
      return null;
    }

    const cardId =
      typeof value.cardId === 'string' && value.cardId.length > 0
        ? value.cardId
        : 'unknown_card';

    const decisionWindowMs = this.positiveFiniteNumber(value.decisionWindowMs, 1_000);
    const resolvedInMs = this.clamp(
      this.normalizeFiniteNumber(this.asNumber(value.resolvedInMs), decisionWindowMs),
      0,
      decisionWindowMs,
    );

    const wasAutoResolved = Boolean(value.wasAutoResolved);
    const wasOptimalChoice = Boolean(value.wasOptimalChoice);

    let speedScore = this.asNumber(value.speedScore);
    if (!Number.isFinite(speedScore) || speedScore < 0 || speedScore > 1) {
      if (wasAutoResolved) {
        speedScore = 0;
      } else {
        const timeUsedPct = resolvedInMs / decisionWindowMs;
        speedScore = wasOptimalChoice
          ? Math.max(0.3, 1.0 - timeUsedPct * 0.7)
          : Math.max(0.0, 0.5 - timeUsedPct * 0.3);
      }
    }

    return {
      cardId,
      decisionWindowMs,
      resolvedInMs,
      wasAutoResolved,
      wasOptimalChoice,
      speedScore: this.clamp(speedScore, 0, 1),
    };
  }

  // ── EVENT EMISSION ─────────────────────────────────────────────

  private emitRunCompleted(payload: RunCompletedPayload): void {
    this.eventBus.emit('RUN_COMPLETED', {
      runId: payload.runId,
      proofHash: payload.proofHash,
      grade: payload.grade,
      sovereigntyScore: payload.sovereigntyScore,
      integrityStatus: payload.integrityStatus,
      reward: payload.reward,
    });
  }

  private emitProofVerificationFailed(payload: ProofVerificationFailedPayload): void {
    this.eventBus.emit('PROOF_VERIFICATION_FAILED', {
      runId: payload.runId,
      step: payload.step,
      reason: payload.reason,
    });
  }

  private emitFailure(runId: string, step: 1 | 2 | 3, reason: string): void {
    const payload: ProofVerificationFailedPayload = { runId, step, reason };
    this.emitProofVerificationFailed(payload);
    console.error(`[SovereigntyEngine] Step ${step} failure — ${reason}`);
  }

  // ── GENERIC HELPERS ────────────────────────────────────────────

  private firstNumber(
    source: unknown,
    paths: ReadonlyArray<ReadonlyArray<string>>,
    fallback: number,
  ): number {
    for (const path of paths) {
      const value = this.readPath(source, path);
      const asNumber = this.asNumber(value);
      if (Number.isFinite(asNumber)) {
        return asNumber;
      }
    }

    return fallback;
  }

  private firstArray(
    source: unknown,
    paths: ReadonlyArray<ReadonlyArray<string>>,
  ): unknown[] | null {
    for (const path of paths) {
      const value = this.readPath(source, path);
      if (Array.isArray(value)) {
        return value;
      }
    }

    return null;
  }

  private firstArrayLength(
    source: unknown,
    paths: ReadonlyArray<ReadonlyArray<string>>,
  ): number {
    const array = this.firstArray(source, paths);
    return array ? array.length : 0;
  }

  private readPath(source: unknown, path: ReadonlyArray<string>): unknown {
    let cursor: unknown = source;

    for (const segment of path) {
      const record = this.toRecord(cursor);
      if (!record || !(segment in record)) {
        return undefined;
      }
      cursor = record[segment];
    }

    return cursor;
  }

  private toRecord(value: unknown): SnapshotRecord | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    return value as SnapshotRecord;
  }

  private asNumber(value: unknown): number {
    return typeof value === 'number' ? value : Number.NaN;
  }

  private normalizeFiniteNumber(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
  }

  private positiveFiniteNumber(value: unknown, fallback: number): number {
    const num = this.asNumber(value);
    return Number.isFinite(num) && num > 0 ? num : fallback;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
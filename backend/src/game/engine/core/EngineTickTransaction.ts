/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/EngineTickTransaction.ts
 *
 * Doctrine:
 * - each engine tick is an immutable-in / immutable-out transaction boundary
 * - engine failures must not partially mutate authoritative snapshot truth
 * - signal aggregation must remain deterministic and replay-safe
 * - transaction helpers must compose with the existing SimulationEngine contract
 * - skip / rollback / commit outcomes must be explicit and queryable
 * - ML feature vectors must be emitted for every transaction outcome
 * - user experience quality must be scored and surfaced on every commit path
 * - transaction chains must be auditable and replayable end-to-end
 *
 * Surface summary:
 *   § 1  — Core transaction types and meta
 *   § 2  — EngineTickTransaction — atomic commit / rollback / skip boundary
 *   § 3  — Transaction outcome types and normalization
 *   § 4  — EngineTickTransactionJournal — ordered audit log
 *   § 5  — EngineTickTransactionMetrics — per-step timing and signal accounting
 *   § 6  — EngineTickTransactionMLVector — 16-feature normalized ML surface
 *   § 7  — TransactionSignalClassifier — categorizes signals by severity/code
 *   § 8  — EngineTickTransactionReplay — deterministic frame replay
 *   § 9  — EngineTickTransactionValidator — pre/post invariant checking
 *   § 10 — EngineTickTransactionOrchestrator — full-tick multi-engine runner
 *   § 11 — EngineTickTransactionHealthTracker — rolling health per engine
 *   § 12 — EngineTickTransactionDiffEngine — snapshot delta computation
 *   § 13 — TransactionUXScorer — user experience quality on every outcome
 *   § 14 — EngineTickTransactionAnalytics — aggregate analytics surface
 *   § 15 — EngineTickTransactionChatBridge — structural output for chat adapters
 *   § 16 — InstrumentedTransactionRunner — production-grade entry point
 *   § 17 — Factory functions and export helpers
 */

import {
  createEngineSignal,
  createEngineSignalFull,
  normalizeEngineTickResult,
  ALL_ENGINE_IDS,
  ENGINE_STEP_SLOTS,
  type EngineId,
  type EngineHealth,
  type EngineHealthStatus,
  type EngineSignal,
  type EngineSignalCategory,
  type EngineSignalSeverity,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
} from './EngineContracts';
import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  TICK_SEQUENCE,
  ENGINE_EXECUTION_STEPS,
  TICK_STEP_DESCRIPTORS,
  type TickStep,
  type TickStepOwner,
  type TickStepPhase,
} from './TickSequence';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Core transaction types and meta
// ─────────────────────────────────────────────────────────────────────────────

export type TransactionOutcome =
  | 'COMMITTED'
  | 'ROLLED_BACK'
  | 'SKIPPED'
  | 'TIMED_OUT'
  | 'ABORTED';

export type TransactionRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type TransactionHealthTrend = 'STABLE' | 'IMPROVING' | 'DEGRADING' | 'VOLATILE';

/** Normalized numeric encoding for ML feature vectors. */
export const TRANSACTION_OUTCOME_NUMERIC: Record<TransactionOutcome, number> = {
  COMMITTED: 1.0,
  SKIPPED: 0.75,
  TIMED_OUT: 0.4,
  ROLLED_BACK: 0.2,
  ABORTED: 0.0,
} as const;

export const TRANSACTION_RISK_NUMERIC: Record<TransactionRiskLevel, number> = {
  LOW: 0.0,
  MODERATE: 0.33,
  HIGH: 0.67,
  CRITICAL: 1.0,
} as const;

export const TRANSACTION_HEALTH_TREND_NUMERIC: Record<TransactionHealthTrend, number> = {
  STABLE: 0.75,
  IMPROVING: 1.0,
  DEGRADING: 0.25,
  VOLATILE: 0.5,
} as const;

/** Per-step budget policy for ML-aware watchdog. */
export const TRANSACTION_STEP_BUDGET_MS: Record<TickStep, number> = {
  STEP_01_PREPARE: 2,
  STEP_02_TIME: 5,
  STEP_03_PRESSURE: 8,
  STEP_04_TENSION: 8,
  STEP_05_BATTLE: 15,
  STEP_06_SHIELD: 10,
  STEP_07_CASCADE: 12,
  STEP_08_MODE_POST: 6,
  STEP_09_TELEMETRY: 4,
  STEP_10_SOVEREIGNTY_SNAPSHOT: 10,
  STEP_11_OUTCOME_GATE: 5,
  STEP_12_EVENT_SEAL: 4,
  STEP_13_FLUSH: 3,
} as const;

/** Severity weight for ML scoring — higher = more expensive signals. */
export const SIGNAL_SEVERITY_WEIGHT: Record<EngineSignalSeverity, number> = {
  INFO: 0.1,
  WARN: 0.5,
  ERROR: 1.0,
} as const;

/** Category multiplier — amplifies semantic importance of signal type. */
export const SIGNAL_CATEGORY_WEIGHT: Record<EngineSignalCategory, number> = {
  tick: 0.1,
  state_mutation: 0.4,
  boundary_event: 0.6,
  error: 1.0,
  ml_emit: 0.3,
  mode_hook: 0.5,
  health_change: 0.8,
  contract_violation: 0.9,
  timing: 0.2,
} as const;

/** Risk profile per step for orchestration planning. */
export const STEP_RISK_PROFILE: Record<TickStep, TransactionRiskLevel> = {
  STEP_01_PREPARE: 'LOW',
  STEP_02_TIME: 'LOW',
  STEP_03_PRESSURE: 'MODERATE',
  STEP_04_TENSION: 'MODERATE',
  STEP_05_BATTLE: 'HIGH',
  STEP_06_SHIELD: 'HIGH',
  STEP_07_CASCADE: 'HIGH',
  STEP_08_MODE_POST: 'MODERATE',
  STEP_09_TELEMETRY: 'LOW',
  STEP_10_SOVEREIGNTY_SNAPSHOT: 'MODERATE',
  STEP_11_OUTCOME_GATE: 'CRITICAL',
  STEP_12_EVENT_SEAL: 'MODERATE',
  STEP_13_FLUSH: 'LOW',
} as const;

/** Engine step ordering for execution planning. */
export const ENGINE_STEP_ORDINALS: Record<TickStep, number> = (() => {
  const result = {} as Record<TickStep, number>;
  TICK_SEQUENCE.forEach((step, idx) => {
    result[step] = idx;
  });
  return result;
})();

export interface EngineTickTransactionMeta {
  readonly engineId: EngineId | 'mode' | 'system';
  readonly tick: number;
  readonly step: TickStep;
  readonly startedAtMs: number;
  readonly traceId?: string;
  readonly runId?: string;
  readonly riskLevel: TransactionRiskLevel;
  readonly budgetMs: number;
}

export interface EngineTickTransactionState {
  readonly meta: EngineTickTransactionMeta;
  readonly inputSnapshot: RunStateSnapshot;
  readonly outputSnapshot: RunStateSnapshot;
  readonly signals: readonly EngineSignal[];
  readonly committed: boolean;
  readonly rolledBack: boolean;
  readonly outcome: TransactionOutcome | null;
  readonly durationMs: number;
  readonly budgetExceeded: boolean;
  readonly signalWeightTotal: number;
}

export interface EngineTickRollbackOptions {
  readonly code?: string;
  readonly message?: string;
  readonly tags?: readonly string[];
  readonly error?: unknown;
  readonly category?: EngineSignalCategory;
}

export interface TransactionCompletedRecord {
  readonly meta: EngineTickTransactionMeta;
  readonly outcome: TransactionOutcome;
  readonly durationMs: number;
  readonly budgetExceeded: boolean;
  readonly signalCount: number;
  readonly errorCount: number;
  readonly warnCount: number;
  readonly signalWeightTotal: number;
  readonly snapshotChanged: boolean;
  readonly completedAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — EngineTickTransaction — atomic commit / rollback / skip boundary
// ─────────────────────────────────────────────────────────────────────────────

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function normalizeTick(snapshot: RunStateSnapshot, context: TickContext): number {
  const traceTick = Number.isFinite(context.trace.tick) ? Math.trunc(context.trace.tick) : 0;
  const snapshotTick = Number.isFinite(snapshot.tick) ? Math.trunc(snapshot.tick) : 0;
  return Math.max(snapshotTick + 1, traceTick);
}

function normalizeErrorMessage(
  engineId: EngineId | 'mode' | 'system',
  step: TickStep,
  error: unknown,
  fallback?: string,
): string {
  if (typeof fallback === 'string' && fallback.length > 0) {
    return fallback;
  }
  if (error instanceof Error && error.message.length > 0) {
    return `[${engineId}] ${step} failed: ${error.message}`;
  }
  if (typeof error === 'string' && error.length > 0) {
    return `[${engineId}] ${step} failed: ${error}`;
  }
  return `[${engineId}] ${step} failed with an unknown engine transaction error.`;
}

function computeSignalWeight(signals: readonly EngineSignal[]): number {
  let total = 0;
  for (const s of signals) {
    const sevWeight = SIGNAL_SEVERITY_WEIGHT[s.severity] ?? 0.1;
    const catWeight = s.category !== undefined
      ? (SIGNAL_CATEGORY_WEIGHT[s.category] ?? 0.1)
      : 0.1;
    total += sevWeight * catWeight;
  }
  return total;
}

function countSignalsBySeverity(
  signals: readonly EngineSignal[],
  severity: EngineSignalSeverity,
): number {
  return signals.filter((s) => s.severity === severity).length;
}

function snapshotSurfaceKey(snapshot: RunStateSnapshot): string {
  return [
    snapshot.tick,
    snapshot.phase,
    snapshot.mode,
    snapshot.pressure?.tier ?? 'T0',
    snapshot.pressure?.score?.toFixed(3) ?? '0.000',
    snapshot.economy?.netWorth?.toFixed(2) ?? '0.00',
  ].join('|');
}

export class EngineTickTransaction {
  private readonly meta: EngineTickTransactionMeta;
  private readonly inputSnapshot: RunStateSnapshot;
  private outputSnapshot: RunStateSnapshot;
  private readonly signalBuffer: EngineSignal[] = [];
  private committed = false;
  private rolledBack = false;
  private readonly startedAtMs: number;

  public constructor(meta: EngineTickTransactionMeta, inputSnapshot: RunStateSnapshot) {
    this.meta = Object.freeze({
      ...meta,
      tick: Math.max(0, Math.trunc(meta.tick)),
      startedAtMs: Math.trunc(meta.startedAtMs),
      riskLevel: meta.riskLevel ?? STEP_RISK_PROFILE[meta.step] ?? 'MODERATE',
      budgetMs: meta.budgetMs ?? TRANSACTION_STEP_BUDGET_MS[meta.step] ?? 10,
    });
    this.inputSnapshot = inputSnapshot;
    this.outputSnapshot = inputSnapshot;
    this.startedAtMs = meta.startedAtMs;
  }

  public static fromContext(
    engineId: EngineId,
    inputSnapshot: RunStateSnapshot,
    context: TickContext,
  ): EngineTickTransaction {
    const step = context.step;
    return new EngineTickTransaction(
      {
        engineId,
        tick: normalizeTick(inputSnapshot, context),
        step,
        startedAtMs: context.nowMs,
        traceId: context.trace.traceId,
        runId: context.trace.runId,
        riskLevel: STEP_RISK_PROFILE[step] ?? 'MODERATE',
        budgetMs: TRANSACTION_STEP_BUDGET_MS[step] ?? 10,
      },
      inputSnapshot,
    );
  }

  public static execute(
    engine: SimulationEngine,
    inputSnapshot: RunStateSnapshot,
    context: TickContext,
  ): EngineTickResult {
    const transaction = EngineTickTransaction.fromContext(
      engine.engineId,
      inputSnapshot,
      context,
    );

    try {
      if (engine.canRun !== undefined && !engine.canRun(inputSnapshot, context)) {
        return transaction.skip();
      }

      const rawResult = engine.tick(inputSnapshot, context);
      return transaction.applyResult(rawResult).commit();
    } catch (error) {
      return transaction.rollback({
        error,
        code: 'ENGINE_TRANSACTION_ROLLBACK',
        category: 'error',
        tags: ['engine-transaction', 'rollback', `engine:${engine.engineId}`],
      });
    }
  }

  public replaceSnapshot(snapshot: RunStateSnapshot): this {
    this.assertMutable();
    this.outputSnapshot = snapshot;
    return this;
  }

  public appendSignals(signals: readonly EngineSignal[]): this {
    this.assertMutable();
    for (const signal of signals) {
      this.signalBuffer.push(signal);
    }
    return this;
  }

  public applyResult(result: RunStateSnapshot | EngineTickResult): this {
    this.assertMutable();

    const normalized = normalizeEngineTickResult(
      this.meta.engineId as EngineId,
      this.meta.tick,
      result,
    );

    this.outputSnapshot = normalized.snapshot;

    if (normalized.signals !== undefined && normalized.signals.length > 0) {
      this.appendSignals(normalized.signals);
    }

    return this;
  }

  public skip(): EngineTickResult {
    this.assertMutable();
    this.committed = true;

    const skippedSignal = createEngineSignal(
      this.meta.engineId as EngineId,
      'INFO',
      'ENGINE_SKIPPED',
      `${this.meta.engineId} skipped ${this.meta.step}.`,
      this.meta.tick,
      ['engine-transaction', 'skipped', `step:${this.meta.step.toLowerCase()}`],
    );

    return Object.freeze({
      snapshot: this.inputSnapshot,
      signals: freezeArray([skippedSignal]),
      stepMs: Date.now() - this.startedAtMs,
      engineId: this.meta.engineId as EngineId,
    });
  }

  public rollback(options: EngineTickRollbackOptions = {}): EngineTickResult {
    this.assertMutable();
    this.rolledBack = true;
    this.committed = true;

    const rollbackSignal = createEngineSignalFull(
      this.meta.engineId as EngineId,
      'ERROR',
      options.code ?? 'ENGINE_TRANSACTION_ROLLBACK',
      normalizeErrorMessage(
        this.meta.engineId,
        this.meta.step,
        options.error,
        options.message,
      ),
      this.meta.tick,
      options.category ?? 'error',
      freezeArray([
        'engine-transaction',
        'rollback',
        ...(options.tags ?? []),
      ]),
    );

    return Object.freeze({
      snapshot: this.inputSnapshot,
      signals: freezeArray([...this.signalBuffer, rollbackSignal]),
      stepMs: Date.now() - this.startedAtMs,
      engineId: this.meta.engineId as EngineId,
    });
  }

  public commit(): EngineTickResult {
    this.assertMutable();
    this.committed = true;

    const durationMs = Date.now() - this.startedAtMs;
    const budgetMs = this.meta.budgetMs;

    const signals: EngineSignal[] = [...this.signalBuffer];

    if (durationMs > budgetMs) {
      signals.push(
        createEngineSignalFull(
          this.meta.engineId as EngineId,
          'WARN',
          'TRANSACTION_BUDGET_EXCEEDED',
          `[${this.meta.engineId}] step ${this.meta.step} took ${durationMs}ms (budget: ${budgetMs}ms).`,
          this.meta.tick,
          'timing',
          ['engine-transaction', 'budget-exceeded', `step:${this.meta.step.toLowerCase()}`],
          durationMs,
        ),
      );
    }

    return Object.freeze({
      snapshot: this.outputSnapshot,
      signals: signals.length > 0 ? freezeArray(signals) : freezeArray([]),
      stepMs: durationMs,
      engineId: this.meta.engineId as EngineId,
    });
  }

  public getState(): EngineTickTransactionState {
    const durationMs = Date.now() - this.startedAtMs;
    const signals = freezeArray(this.signalBuffer);
    return Object.freeze({
      meta: this.meta,
      inputSnapshot: this.inputSnapshot,
      outputSnapshot: this.outputSnapshot,
      signals,
      committed: this.committed,
      rolledBack: this.rolledBack,
      outcome: this.committed
        ? this.rolledBack
          ? 'ROLLED_BACK'
          : 'COMMITTED'
        : null,
      durationMs,
      budgetExceeded: durationMs > this.meta.budgetMs,
      signalWeightTotal: computeSignalWeight(signals),
    });
  }

  private assertMutable(): void {
    if (this.committed) {
      throw new Error(
        `EngineTickTransaction for ${this.meta.engineId} at ${this.meta.step} is already finalized.`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Transaction outcome types and normalization
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionOutcomeRecord {
  readonly engineId: EngineId | 'mode' | 'system';
  readonly step: TickStep;
  readonly tick: number;
  readonly outcome: TransactionOutcome;
  readonly durationMs: number;
  readonly budgetMs: number;
  readonly budgetExceeded: boolean;
  readonly signalCount: number;
  readonly errorCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  readonly signalWeightTotal: number;
  readonly snapshotChanged: boolean;
  readonly completedAtMs: number;
  readonly traceId?: string;
  readonly runId?: string;
}

export function buildTransactionOutcomeRecord(
  meta: EngineTickTransactionMeta,
  result: EngineTickResult,
  outcome: TransactionOutcome,
  inputSnapshot: RunStateSnapshot,
  completedAtMs: number,
): TransactionOutcomeRecord {
  const signals = result.signals ?? [];
  const durationMs = result.stepMs ?? 0;

  return Object.freeze({
    engineId: meta.engineId,
    step: meta.step,
    tick: meta.tick,
    outcome,
    durationMs,
    budgetMs: meta.budgetMs,
    budgetExceeded: durationMs > meta.budgetMs,
    signalCount: signals.length,
    errorCount: countSignalsBySeverity(signals, 'ERROR'),
    warnCount: countSignalsBySeverity(signals, 'WARN'),
    infoCount: countSignalsBySeverity(signals, 'INFO'),
    signalWeightTotal: computeSignalWeight(signals),
    snapshotChanged: snapshotSurfaceKey(result.snapshot) !== snapshotSurfaceKey(inputSnapshot),
    completedAtMs,
    traceId: meta.traceId,
    runId: meta.runId,
  });
}

/** Normalizes an EngineTickResult into a canonical completed record. */
export function normalizeTransactionResult(
  engineId: EngineId,
  tick: number,
  step: TickStep,
  result: RunStateSnapshot | EngineTickResult,
  inputSnapshot: RunStateSnapshot,
  nowMs: number,
): { result: EngineTickResult; record: TransactionOutcomeRecord } {
  const normalized = normalizeEngineTickResult(engineId, tick, result);
  const meta: EngineTickTransactionMeta = {
    engineId,
    tick,
    step,
    startedAtMs: nowMs - (normalized.stepMs ?? 0),
    riskLevel: STEP_RISK_PROFILE[step] ?? 'MODERATE',
    budgetMs: TRANSACTION_STEP_BUDGET_MS[step] ?? 10,
  };
  const hasErrors = (normalized.signals ?? []).some((s) => s.severity === 'ERROR');
  const outcome: TransactionOutcome = hasErrors ? 'ROLLED_BACK' : 'COMMITTED';

  return {
    result: normalized,
    record: buildTransactionOutcomeRecord(meta, normalized, outcome, inputSnapshot, nowMs),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — EngineTickTransactionJournal — ordered audit log
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionJournalEntry {
  readonly entryId: string;
  readonly record: TransactionOutcomeRecord;
  readonly signals: readonly EngineSignal[];
  readonly journaledAtMs: number;
}

export class EngineTickTransactionJournal {
  private readonly entries: TransactionJournalEntry[] = [];
  private entryCounter = 0;

  public record(
    record: TransactionOutcomeRecord,
    signals: readonly EngineSignal[],
  ): TransactionJournalEntry {
    const entry: TransactionJournalEntry = Object.freeze({
      entryId: `journal-${record.tick}-${record.step}-${record.engineId}-${++this.entryCounter}`,
      record,
      signals: freezeArray(signals),
      journaledAtMs: Date.now(),
    });
    this.entries.push(entry);
    return entry;
  }

  public getByTick(tick: number): readonly TransactionJournalEntry[] {
    return this.entries.filter((e) => e.record.tick === tick);
  }

  public getByEngine(engineId: EngineId | 'mode' | 'system'): readonly TransactionJournalEntry[] {
    return this.entries.filter((e) => e.record.engineId === engineId);
  }

  public getByStep(step: TickStep): readonly TransactionJournalEntry[] {
    return this.entries.filter((e) => e.record.step === step);
  }

  public getByOutcome(outcome: TransactionOutcome): readonly TransactionJournalEntry[] {
    return this.entries.filter((e) => e.record.outcome === outcome);
  }

  public getErrors(): readonly TransactionJournalEntry[] {
    return this.entries.filter((e) =>
      e.record.errorCount > 0 || e.record.outcome === 'ROLLED_BACK',
    );
  }

  public getBudgetOverruns(): readonly TransactionJournalEntry[] {
    return this.entries.filter((e) => e.record.budgetExceeded);
  }

  public getSince(sinceMs: number): readonly TransactionJournalEntry[] {
    return this.entries.filter((e) => e.journaledAtMs >= sinceMs);
  }

  public getLatest(n: number): readonly TransactionJournalEntry[] {
    return this.entries.slice(-Math.max(0, n));
  }

  public getAllEntries(): readonly TransactionJournalEntry[] {
    return freezeArray(this.entries);
  }

  public computeOutcomeDistribution(): Record<TransactionOutcome, number> {
    const dist: Record<TransactionOutcome, number> = {
      COMMITTED: 0,
      ROLLED_BACK: 0,
      SKIPPED: 0,
      TIMED_OUT: 0,
      ABORTED: 0,
    };
    for (const e of this.entries) {
      dist[e.record.outcome]++;
    }
    return dist;
  }

  public computeErrorRate(): number {
    if (this.entries.length === 0) return 0;
    const errors = this.entries.filter(
      (e) => e.record.outcome === 'ROLLED_BACK' || e.record.outcome === 'ABORTED',
    ).length;
    return errors / this.entries.length;
  }

  public computeAverageDurationMs(): number {
    if (this.entries.length === 0) return 0;
    const total = this.entries.reduce((acc, e) => acc + e.record.durationMs, 0);
    return total / this.entries.length;
  }

  public computeBudgetCompliance(): number {
    if (this.entries.length === 0) return 1;
    const compliant = this.entries.filter((e) => !e.record.budgetExceeded).length;
    return compliant / this.entries.length;
  }

  public reset(): void {
    this.entries.length = 0;
    this.entryCounter = 0;
  }

  public size(): number {
    return this.entries.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — EngineTickTransactionMetrics — per-step timing and signal accounting
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionStepMetrics {
  readonly step: TickStep;
  readonly phase: TickStepPhase;
  readonly owner: TickStepOwner;
  readonly totalRuns: number;
  readonly committed: number;
  readonly rolledBack: number;
  readonly skipped: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly minDurationMs: number;
  readonly budgetExceededCount: number;
  readonly budgetCompliance: number;
  readonly totalSignals: number;
  readonly totalErrors: number;
  readonly totalWarns: number;
  readonly signalWeightAvg: number;
  readonly lastRunAtMs: number | null;
}

export interface TransactionMetricsReport {
  readonly generatedAtMs: number;
  readonly totalTransactions: number;
  readonly overallErrorRate: number;
  readonly overallBudgetCompliance: number;
  readonly avgDurationMs: number;
  readonly stepMetrics: Record<string, TransactionStepMetrics>;
  readonly topBudgetViolators: readonly { step: TickStep; overrunCount: number }[];
  readonly topErrorSteps: readonly { step: TickStep; errorRate: number }[];
}

export class EngineTickTransactionMetrics {
  private readonly stepData: Map<
    TickStep,
    {
      runs: number;
      committed: number;
      rolledBack: number;
      skipped: number;
      totalDurationMs: number;
      maxDurationMs: number;
      minDurationMs: number;
      budgetExceeded: number;
      totalSignals: number;
      totalErrors: number;
      totalWarns: number;
      totalSignalWeight: number;
      lastRunAtMs: number | null;
    }
  > = new Map();

  public record(record: TransactionOutcomeRecord): void {
    const existing = this.stepData.get(record.step) ?? {
      runs: 0,
      committed: 0,
      rolledBack: 0,
      skipped: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      minDurationMs: Infinity,
      budgetExceeded: 0,
      totalSignals: 0,
      totalErrors: 0,
      totalWarns: 0,
      totalSignalWeight: 0,
      lastRunAtMs: null,
    };

    existing.runs++;
    existing.totalDurationMs += record.durationMs;
    existing.maxDurationMs = Math.max(existing.maxDurationMs, record.durationMs);
    existing.minDurationMs = Math.min(existing.minDurationMs, record.durationMs);
    existing.totalSignals += record.signalCount;
    existing.totalErrors += record.errorCount;
    existing.totalWarns += record.warnCount;
    existing.totalSignalWeight += record.signalWeightTotal;
    existing.lastRunAtMs = record.completedAtMs;

    if (record.budgetExceeded) existing.budgetExceeded++;

    switch (record.outcome) {
      case 'COMMITTED': existing.committed++; break;
      case 'ROLLED_BACK': existing.rolledBack++; break;
      case 'SKIPPED': existing.skipped++; break;
      default: break;
    }

    this.stepData.set(record.step, existing);
  }

  public buildStepMetrics(step: TickStep): TransactionStepMetrics | null {
    const d = this.stepData.get(step);
    if (d === undefined || d.runs === 0) return null;

    const descriptor = TICK_STEP_DESCRIPTORS[step];

    return Object.freeze({
      step,
      phase: descriptor?.phase ?? 'ENGINE',
      owner: descriptor?.owner ?? 'system',
      totalRuns: d.runs,
      committed: d.committed,
      rolledBack: d.rolledBack,
      skipped: d.skipped,
      avgDurationMs: d.totalDurationMs / d.runs,
      maxDurationMs: d.maxDurationMs,
      minDurationMs: d.minDurationMs === Infinity ? 0 : d.minDurationMs,
      budgetExceededCount: d.budgetExceeded,
      budgetCompliance: d.runs > 0 ? (d.runs - d.budgetExceeded) / d.runs : 1,
      totalSignals: d.totalSignals,
      totalErrors: d.totalErrors,
      totalWarns: d.totalWarns,
      signalWeightAvg: d.runs > 0 ? d.totalSignalWeight / d.runs : 0,
      lastRunAtMs: d.lastRunAtMs,
    });
  }

  public buildReport(): TransactionMetricsReport {
    const now = Date.now();
    const stepMetrics: Record<string, TransactionStepMetrics> = {};
    let totalRuns = 0;
    let totalErrors = 0;
    let totalBudgetExceeded = 0;
    let totalDurationMs = 0;

    for (const step of TICK_SEQUENCE) {
      const m = this.buildStepMetrics(step);
      if (m !== null) {
        stepMetrics[step] = m;
        totalRuns += m.totalRuns;
        totalErrors += m.rolledBack;
        totalBudgetExceeded += m.budgetExceededCount;
        totalDurationMs += m.avgDurationMs * m.totalRuns;
      }
    }

    const budgetViolators = Object.values(stepMetrics)
      .filter((m) => m.budgetExceededCount > 0)
      .sort((a, b) => b.budgetExceededCount - a.budgetExceededCount)
      .slice(0, 5)
      .map((m) => ({ step: m.step, overrunCount: m.budgetExceededCount }));

    const errorSteps = Object.values(stepMetrics)
      .filter((m) => m.totalRuns > 0 && m.rolledBack > 0)
      .map((m) => ({ step: m.step, errorRate: m.rolledBack / m.totalRuns }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5);

    return Object.freeze({
      generatedAtMs: now,
      totalTransactions: totalRuns,
      overallErrorRate: totalRuns > 0 ? totalErrors / totalRuns : 0,
      overallBudgetCompliance: totalRuns > 0 ? (totalRuns - totalBudgetExceeded) / totalRuns : 1,
      avgDurationMs: totalRuns > 0 ? totalDurationMs / totalRuns : 0,
      stepMetrics,
      topBudgetViolators: freezeArray(budgetViolators),
      topErrorSteps: freezeArray(errorSteps),
    });
  }

  public reset(): void {
    this.stepData.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — EngineTickTransactionMLVector — 16-feature normalized ML surface
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineTickTransactionMLVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly engineId: EngineId | 'mode' | 'system';
  readonly step: TickStep;
  readonly outcome: TransactionOutcome;
  readonly generatedAtMs: number;
}

export const ENGINE_TICK_TRANSACTION_ML_FEATURE_LABELS: readonly string[] = [
  'outcome_score',            // 0 — TRANSACTION_OUTCOME_NUMERIC
  'risk_level_score',         // 1 — TRANSACTION_RISK_NUMERIC
  'duration_budget_ratio',    // 2 — durationMs / budgetMs clamped [0,2]
  'error_rate',               // 3 — errors / total signals
  'warn_rate',                // 4 — warns / total signals
  'signal_count_norm',        // 5 — signals / 20 clamped [0,1]
  'signal_weight_norm',       // 6 — weight / 5.0 clamped [0,1]
  'snapshot_changed',         // 7 — 1.0 if snapshot was mutated
  'step_ordinal_norm',        // 8 — step ordinal / 12
  'budget_compliance',        // 9 — 1.0 if within budget
  'engine_id_hash_norm',      // 10 — deterministic engine slot [0,1]
  'tick_norm',                // 11 — tick / 1000 clamped [0,1]
  'severity_weight_max',      // 12 — max single signal weight
  'rollback_flag',            // 13 — 1.0 if rolled back
  'skip_flag',                // 14 — 1.0 if skipped
  'step_is_critical',         // 15 — 1.0 if CRITICAL risk step
] as const;

const ENGINE_ID_SLOT: Record<string, number> = {
  time: 0.0 / 6.0,
  pressure: 1.0 / 6.0,
  tension: 2.0 / 6.0,
  shield: 3.0 / 6.0,
  battle: 4.0 / 6.0,
  cascade: 5.0 / 6.0,
  sovereignty: 6.0 / 6.0,
  mode: 0.5,
  system: 0.8,
} as const;

export class EngineTickTransactionMLVectorBuilder {
  public static build(record: TransactionOutcomeRecord): EngineTickTransactionMLVector {
    const { outcome, riskLevel, durationMs, budgetMs, signalCount, errorCount, warnCount,
            signalWeightTotal, snapshotChanged, step, engineId, tick } =
      buildMLBuildInputs(record);

    const budgetRatio = Math.min(2.0, budgetMs > 0 ? durationMs / budgetMs : 0);
    const errorRate = signalCount > 0 ? errorCount / signalCount : 0;
    const warnRate = signalCount > 0 ? warnCount / signalCount : 0;
    const signalCountNorm = Math.min(1.0, signalCount / 20);
    const signalWeightNorm = Math.min(1.0, signalWeightTotal / 5.0);
    const stepOrdinal = ENGINE_STEP_ORDINALS[step] ?? 0;
    const engineSlot = ENGINE_ID_SLOT[engineId] ?? 0.5;
    const maxSingleWeight = computeMaxSingleWeight(record);

    const features: number[] = [
      TRANSACTION_OUTCOME_NUMERIC[outcome],               // 0
      TRANSACTION_RISK_NUMERIC[riskLevel],                // 1
      budgetRatio / 2.0,                                  // 2 normalized to [0,1]
      errorRate,                                          // 3
      warnRate,                                           // 4
      signalCountNorm,                                    // 5
      signalWeightNorm,                                   // 6
      snapshotChanged ? 1.0 : 0.0,                       // 7
      stepOrdinal / 12.0,                                 // 8
      record.budgetExceeded ? 0.0 : 1.0,                 // 9
      engineSlot,                                         // 10
      Math.min(1.0, tick / 1000),                        // 11
      maxSingleWeight,                                    // 12
      outcome === 'ROLLED_BACK' ? 1.0 : 0.0,            // 13
      outcome === 'SKIPPED' ? 1.0 : 0.0,                // 14
      STEP_RISK_PROFILE[step] === 'CRITICAL' ? 1.0 : 0.0, // 15
    ];

    return Object.freeze({
      tick,
      features: freezeArray(features),
      labels: ENGINE_TICK_TRANSACTION_ML_FEATURE_LABELS,
      engineId,
      step,
      outcome,
      generatedAtMs: record.completedAtMs,
    });
  }

  public static buildBatch(
    records: readonly TransactionOutcomeRecord[],
  ): readonly EngineTickTransactionMLVector[] {
    return freezeArray(records.map((r) => EngineTickTransactionMLVectorBuilder.build(r)));
  }

  public static zero(
    engineId: EngineId | 'mode' | 'system',
    step: TickStep,
    tick: number,
  ): EngineTickTransactionMLVector {
    return Object.freeze({
      tick,
      features: freezeArray(new Array(ENGINE_TICK_TRANSACTION_ML_FEATURE_LABELS.length).fill(0)),
      labels: ENGINE_TICK_TRANSACTION_ML_FEATURE_LABELS,
      engineId,
      step,
      outcome: 'COMMITTED',
      generatedAtMs: Date.now(),
    });
  }
}

function buildMLBuildInputs(record: TransactionOutcomeRecord): {
  outcome: TransactionOutcome;
  riskLevel: TransactionRiskLevel;
  durationMs: number;
  budgetMs: number;
  signalCount: number;
  errorCount: number;
  warnCount: number;
  signalWeightTotal: number;
  snapshotChanged: boolean;
  step: TickStep;
  engineId: EngineId | 'mode' | 'system';
  tick: number;
} {
  return {
    outcome: record.outcome,
    riskLevel: STEP_RISK_PROFILE[record.step] ?? 'MODERATE',
    durationMs: record.durationMs,
    budgetMs: record.budgetMs,
    signalCount: record.signalCount,
    errorCount: record.errorCount,
    warnCount: record.warnCount,
    signalWeightTotal: record.signalWeightTotal,
    snapshotChanged: record.snapshotChanged,
    step: record.step,
    engineId: record.engineId,
    tick: record.tick,
  };
}

function computeMaxSingleWeight(record: TransactionOutcomeRecord): number {
  const errorWeight = SIGNAL_SEVERITY_WEIGHT['ERROR'] * SIGNAL_CATEGORY_WEIGHT['error'];
  const warnWeight = SIGNAL_SEVERITY_WEIGHT['WARN'] * SIGNAL_CATEGORY_WEIGHT['boundary_event'];
  if (record.errorCount > 0) return errorWeight;
  if (record.warnCount > 0) return warnWeight;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — TransactionSignalClassifier — categorizes signals by severity/code
// ─────────────────────────────────────────────────────────────────────────────

export interface SignalClassification {
  readonly severity: EngineSignalSeverity;
  readonly category: EngineSignalCategory;
  readonly code: string;
  readonly isTransactionBoundary: boolean;
  readonly isBudgetWarning: boolean;
  readonly isRollback: boolean;
  readonly isSkip: boolean;
  readonly isHealthChange: boolean;
  readonly isContractViolation: boolean;
  readonly weight: number;
}

export interface SignalClassificationSummary {
  readonly totalSignals: number;
  readonly rollbacks: number;
  readonly skips: number;
  readonly budgetWarnings: number;
  readonly healthChanges: number;
  readonly contractViolations: number;
  readonly highWeightSignals: number;
  readonly dominantSeverity: EngineSignalSeverity;
  readonly dominantCategory: EngineSignalCategory;
  readonly totalWeight: number;
}

const ROLLBACK_CODES = new Set([
  'ENGINE_TRANSACTION_ROLLBACK',
  'ENGINE_ABORT',
  'TRANSACTION_ABORTED',
  'FATAL_ENGINE_ERROR',
]);

const SKIP_CODES = new Set([
  'ENGINE_SKIPPED',
  'ENGINE_GATE_SKIP',
  'STEP_SKIPPED',
]);

const BUDGET_CODES = new Set([
  'TRANSACTION_BUDGET_EXCEEDED',
  'STEP_TIMEOUT',
  'ENGINE_SLOW',
]);

const HEALTH_CODES = new Set([
  'ENGINE_HEALTH_CHANGE',
  'ENGINE_DEGRADED',
  'ENGINE_RECOVERED',
  'ENGINE_FAILED',
]);

export class TransactionSignalClassifier {
  public static classify(signal: EngineSignal): SignalClassification {
    const category = signal.category ?? 'tick';
    const sevWeight = SIGNAL_SEVERITY_WEIGHT[signal.severity] ?? 0.1;
    const catWeight = SIGNAL_CATEGORY_WEIGHT[category] ?? 0.1;

    return Object.freeze({
      severity: signal.severity,
      category,
      code: signal.code,
      isTransactionBoundary: (signal.tags ?? []).includes('engine-transaction'),
      isBudgetWarning: BUDGET_CODES.has(signal.code),
      isRollback: ROLLBACK_CODES.has(signal.code),
      isSkip: SKIP_CODES.has(signal.code),
      isHealthChange: HEALTH_CODES.has(signal.code) || category === 'health_change',
      isContractViolation: category === 'contract_violation',
      weight: sevWeight * catWeight,
    });
  }

  public static classifyAll(
    signals: readonly EngineSignal[],
  ): readonly SignalClassification[] {
    return freezeArray(signals.map((s) => TransactionSignalClassifier.classify(s)));
  }

  public static summarize(signals: readonly EngineSignal[]): SignalClassificationSummary {
    const classified = TransactionSignalClassifier.classifyAll(signals);

    const severityCounts: Record<EngineSignalSeverity, number> = { INFO: 0, WARN: 0, ERROR: 0 };
    const categoryCounts: Partial<Record<EngineSignalCategory, number>> = {};
    let totalWeight = 0;
    let rollbacks = 0;
    let skips = 0;
    let budgetWarnings = 0;
    let healthChanges = 0;
    let contractViolations = 0;
    let highWeightSignals = 0;

    for (const c of classified) {
      severityCounts[c.severity]++;
      categoryCounts[c.category] = (categoryCounts[c.category] ?? 0) + 1;
      totalWeight += c.weight;
      if (c.isRollback) rollbacks++;
      if (c.isSkip) skips++;
      if (c.isBudgetWarning) budgetWarnings++;
      if (c.isHealthChange) healthChanges++;
      if (c.isContractViolation) contractViolations++;
      if (c.weight > 0.4) highWeightSignals++;
    }

    const dominantSeverity = (
      severityCounts.ERROR > 0 ? 'ERROR' :
      severityCounts.WARN > 0 ? 'WARN' : 'INFO'
    ) as EngineSignalSeverity;

    const dominantCategory = (
      Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'tick'
    ) as EngineSignalCategory;

    return Object.freeze({
      totalSignals: signals.length,
      rollbacks,
      skips,
      budgetWarnings,
      healthChanges,
      contractViolations,
      highWeightSignals,
      dominantSeverity,
      dominantCategory,
      totalWeight,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — EngineTickTransactionReplay — deterministic frame replay
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionReplayFrame {
  readonly frameId: string;
  readonly tick: number;
  readonly step: TickStep;
  readonly engineId: EngineId | 'mode' | 'system';
  readonly inputSnapshotKey: string;
  readonly outputSnapshotKey: string;
  readonly outcome: TransactionOutcome;
  readonly signals: readonly EngineSignal[];
  readonly durationMs: number;
  readonly capturedAtMs: number;
}

export interface TransactionReplayDiff {
  readonly frameId: string;
  readonly tick: number;
  readonly step: TickStep;
  readonly inputChanged: boolean;
  readonly outputChanged: boolean;
  readonly outcomeChanged: boolean;
  readonly signalCountDelta: number;
  readonly durationDelta: number;
}

export class EngineTickTransactionReplay {
  private readonly frames: TransactionReplayFrame[] = [];
  private frameCounter = 0;

  public capture(
    meta: EngineTickTransactionMeta,
    result: EngineTickResult,
    outcome: TransactionOutcome,
    inputSnapshot: RunStateSnapshot,
  ): TransactionReplayFrame {
    const frame: TransactionReplayFrame = Object.freeze({
      frameId: `replay-${meta.tick}-${meta.step}-${++this.frameCounter}`,
      tick: meta.tick,
      step: meta.step,
      engineId: meta.engineId,
      inputSnapshotKey: snapshotSurfaceKey(inputSnapshot),
      outputSnapshotKey: snapshotSurfaceKey(result.snapshot),
      outcome,
      signals: freezeArray(result.signals ?? []),
      durationMs: result.stepMs ?? 0,
      capturedAtMs: Date.now(),
    });
    this.frames.push(frame);
    return frame;
  }

  public getFrame(frameId: string): TransactionReplayFrame | undefined {
    return this.frames.find((f) => f.frameId === frameId);
  }

  public getFramesByTick(tick: number): readonly TransactionReplayFrame[] {
    return this.frames.filter((f) => f.tick === tick);
  }

  public getFramesByStep(step: TickStep): readonly TransactionReplayFrame[] {
    return this.frames.filter((f) => f.step === step);
  }

  public getFramesSince(sinceMs: number): readonly TransactionReplayFrame[] {
    return this.frames.filter((f) => f.capturedAtMs >= sinceMs);
  }

  public getLatestFrame(): TransactionReplayFrame | undefined {
    return this.frames[this.frames.length - 1];
  }

  public computeDiff(
    frameA: TransactionReplayFrame,
    frameB: TransactionReplayFrame,
  ): TransactionReplayDiff {
    return Object.freeze({
      frameId: `diff-${frameA.frameId}-vs-${frameB.frameId}`,
      tick: frameB.tick,
      step: frameB.step,
      inputChanged: frameA.inputSnapshotKey !== frameB.inputSnapshotKey,
      outputChanged: frameA.outputSnapshotKey !== frameB.outputSnapshotKey,
      outcomeChanged: frameA.outcome !== frameB.outcome,
      signalCountDelta: frameB.signals.length - frameA.signals.length,
      durationDelta: frameB.durationMs - frameA.durationMs,
    });
  }

  public computeDiffSeries(): readonly TransactionReplayDiff[] {
    const diffs: TransactionReplayDiff[] = [];
    for (let i = 1; i < this.frames.length; i++) {
      diffs.push(this.computeDiff(this.frames[i - 1], this.frames[i]));
    }
    return freezeArray(diffs);
  }

  public size(): number {
    return this.frames.length;
  }

  public reset(): void {
    this.frames.length = 0;
    this.frameCounter = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — EngineTickTransactionValidator — pre/post invariant checking
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: EngineSignalSeverity;
  readonly field?: string;
}

export interface TransactionValidationResult {
  readonly valid: boolean;
  readonly issues: readonly TransactionValidationIssue[];
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly warnChecks: number;
}

export class EngineTickTransactionValidator {
  public static validateMeta(meta: EngineTickTransactionMeta): TransactionValidationResult {
    const issues: TransactionValidationIssue[] = [];
    let passedChecks = 0;

    if (!Number.isFinite(meta.tick) || meta.tick < 0) {
      issues.push({ code: 'INVALID_TICK', message: `tick must be >= 0, got ${meta.tick}`, severity: 'ERROR', field: 'tick' });
    } else {
      passedChecks++;
    }

    if (!TICK_SEQUENCE.includes(meta.step)) {
      issues.push({ code: 'INVALID_STEP', message: `step "${meta.step}" not in TICK_SEQUENCE`, severity: 'ERROR', field: 'step' });
    } else {
      passedChecks++;
    }

    if (!Number.isFinite(meta.startedAtMs) || meta.startedAtMs <= 0) {
      issues.push({ code: 'INVALID_START_TIME', message: `startedAtMs must be > 0`, severity: 'WARN', field: 'startedAtMs' });
    } else {
      passedChecks++;
    }

    if (!Number.isFinite(meta.budgetMs) || meta.budgetMs <= 0) {
      issues.push({ code: 'INVALID_BUDGET', message: `budgetMs must be > 0`, severity: 'WARN', field: 'budgetMs' });
    } else {
      passedChecks++;
    }

    if (meta.engineId !== 'mode' && meta.engineId !== 'system' && !ALL_ENGINE_IDS.includes(meta.engineId as EngineId)) {
      issues.push({ code: 'INVALID_ENGINE_ID', message: `unknown engineId "${meta.engineId}"`, severity: 'ERROR', field: 'engineId' });
    } else {
      passedChecks++;
    }

    const errors = issues.filter((i) => i.severity === 'ERROR').length;
    const warns = issues.filter((i) => i.severity === 'WARN').length;

    return Object.freeze({
      valid: errors === 0,
      issues: freezeArray(issues),
      passedChecks,
      failedChecks: errors,
      warnChecks: warns,
    });
  }

  public static validateResult(
    result: EngineTickResult,
    meta: EngineTickTransactionMeta,
  ): TransactionValidationResult {
    const issues: TransactionValidationIssue[] = [];
    let passedChecks = 0;

    if (result.snapshot === undefined || result.snapshot === null) {
      issues.push({ code: 'NULL_SNAPSHOT', message: 'result.snapshot must not be null', severity: 'ERROR', field: 'snapshot' });
    } else {
      passedChecks++;
    }

    if (result.snapshot && !Number.isFinite(result.snapshot.tick)) {
      issues.push({ code: 'INVALID_SNAPSHOT_TICK', message: 'snapshot.tick must be finite', severity: 'ERROR', field: 'snapshot.tick' });
    } else {
      passedChecks++;
    }

    const stepMs = result.stepMs ?? 0;
    if (stepMs < 0) {
      issues.push({ code: 'NEGATIVE_STEP_MS', message: `stepMs must be >= 0, got ${stepMs}`, severity: 'WARN', field: 'stepMs' });
    } else {
      passedChecks++;
    }

    if (stepMs > meta.budgetMs * 5) {
      issues.push({
        code: 'SEVERE_BUDGET_OVERRUN',
        message: `stepMs ${stepMs}ms is 5x over budget (${meta.budgetMs}ms)`,
        severity: 'WARN',
        field: 'stepMs',
      });
    } else {
      passedChecks++;
    }

    for (const signal of result.signals ?? []) {
      if (!signal.code || signal.code.length === 0) {
        issues.push({ code: 'SIGNAL_MISSING_CODE', message: 'signal.code must not be empty', severity: 'WARN' });
      } else {
        passedChecks++;
      }
    }

    const errors = issues.filter((i) => i.severity === 'ERROR').length;
    const warns = issues.filter((i) => i.severity === 'WARN').length;

    return Object.freeze({
      valid: errors === 0,
      issues: freezeArray(issues),
      passedChecks,
      failedChecks: errors,
      warnChecks: warns,
    });
  }

  public static assertValid(
    result: TransactionValidationResult,
    context: string,
  ): void {
    if (!result.valid) {
      const msgs = result.issues
        .filter((i) => i.severity === 'ERROR')
        .map((i) => `[${i.code}] ${i.message}`)
        .join('; ');
      throw new Error(`Transaction validation failed in ${context}: ${msgs}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — EngineTickTransactionOrchestrator — full-tick multi-engine runner
// ─────────────────────────────────────────────────────────────────────────────

export interface TickExecutionPlan {
  readonly tick: number;
  readonly steps: readonly TickStep[];
  readonly engineOrder: readonly EngineId[];
  readonly estimatedBudgetMs: number;
  readonly runId: string;
  readonly traceId: string;
}

export interface TickExecutionResult {
  readonly plan: TickExecutionPlan;
  readonly outcomes: readonly TransactionOutcomeRecord[];
  readonly finalSnapshot: RunStateSnapshot;
  readonly allSignals: readonly EngineSignal[];
  readonly totalDurationMs: number;
  readonly errorCount: number;
  readonly rollbackCount: number;
  readonly skipCount: number;
  readonly completedAtMs: number;
}

export interface OrchestratorConfig {
  readonly maxRetries: number;
  readonly abortOnCriticalFailure: boolean;
  readonly validateBeforeCommit: boolean;
  readonly emitMLVectors: boolean;
  readonly budgetEnforced: boolean;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxRetries: 0,
  abortOnCriticalFailure: true,
  validateBeforeCommit: true,
  emitMLVectors: true,
  budgetEnforced: true,
} as const;

export class EngineTickTransactionOrchestrator {
  private readonly config: OrchestratorConfig;
  private readonly journal: EngineTickTransactionJournal;
  private readonly metrics: EngineTickTransactionMetrics;
  private readonly replay: EngineTickTransactionReplay;
  private readonly mlVectors: EngineTickTransactionMLVector[] = [];

  public constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.journal = new EngineTickTransactionJournal();
    this.metrics = new EngineTickTransactionMetrics();
    this.replay = new EngineTickTransactionReplay();
  }

  public buildExecutionPlan(
    tick: number,
    engines: readonly SimulationEngine[],
    runId: string,
    traceId: string,
  ): TickExecutionPlan {
    const engineOrder = engines.map((e) => e.engineId);
    const estimatedBudget = ENGINE_EXECUTION_STEPS.reduce(
      (acc, step) => acc + (TRANSACTION_STEP_BUDGET_MS[step] ?? 10),
      0,
    );

    return Object.freeze({
      tick,
      steps: ENGINE_EXECUTION_STEPS,
      engineOrder,
      estimatedBudgetMs: estimatedBudget,
      runId,
      traceId,
    });
  }

  public executeEngine(
    engine: SimulationEngine,
    inputSnapshot: RunStateSnapshot,
    context: TickContext,
  ): { result: EngineTickResult; record: TransactionOutcomeRecord } {
    const txn = EngineTickTransaction.fromContext(engine.engineId, inputSnapshot, context);

    let result: EngineTickResult;
    let outcome: TransactionOutcome;

    try {
      if (engine.canRun !== undefined && !engine.canRun(inputSnapshot, context)) {
        result = txn.skip();
        outcome = 'SKIPPED';
      } else {
        const rawResult = engine.tick(inputSnapshot, context);
        result = txn.applyResult(rawResult).commit();
        outcome = 'COMMITTED';
      }
    } catch (error) {
      result = txn.rollback({
        error,
        code: 'ENGINE_TRANSACTION_ROLLBACK',
        category: 'error',
        tags: ['orchestrator', `engine:${engine.engineId}`],
      });
      outcome = 'ROLLED_BACK';
    }

    if (this.config.validateBeforeCommit && outcome === 'COMMITTED') {
      const validation = EngineTickTransactionValidator.validateResult(result, txn.getState().meta);
      if (!validation.valid) {
        const errSignals = validation.issues
          .filter((i) => i.severity === 'ERROR')
          .map((issue) =>
            createEngineSignal(
              engine.engineId,
              'ERROR',
              issue.code,
              issue.message,
              context.trace.tick,
              ['transaction-validator', 'post-commit'],
            ),
          );
        result = {
          ...result,
          signals: freezeArray([...(result.signals ?? []), ...errSignals]),
        };
      }
    }

    const record = buildTransactionOutcomeRecord(
      txn.getState().meta,
      result,
      outcome,
      inputSnapshot,
      Date.now(),
    );

    this.journal.record(record, result.signals ?? []);
    this.metrics.record(record);
    this.replay.capture(txn.getState().meta, result, outcome, inputSnapshot);

    if (this.config.emitMLVectors) {
      this.mlVectors.push(EngineTickTransactionMLVectorBuilder.build(record));
    }

    return { result, record };
  }

  public executeTick(
    engines: readonly SimulationEngine[],
    inputSnapshot: RunStateSnapshot,
    context: TickContext,
  ): TickExecutionResult {
    const startMs = Date.now();
    const plan = this.buildExecutionPlan(
      context.trace.tick,
      engines,
      context.trace.runId,
      context.trace.traceId,
    );

    let currentSnapshot = inputSnapshot;
    const outcomes: TransactionOutcomeRecord[] = [];
    const allSignals: EngineSignal[] = [];
    let errorCount = 0;
    let rollbackCount = 0;
    let skipCount = 0;

    for (const engine of engines) {
      const expectedSlots = ENGINE_STEP_SLOTS[context.step] ?? [];
      if (!expectedSlots.includes(engine.engineId) && expectedSlots.length > 0) {
        continue;
      }

      const { result, record } = this.executeEngine(engine, currentSnapshot, context);

      outcomes.push(record);
      allSignals.push(...(result.signals ?? []));

      if (record.outcome === 'COMMITTED') {
        currentSnapshot = result.snapshot;
      } else if (record.outcome === 'ROLLED_BACK') {
        rollbackCount++;
        errorCount += record.errorCount;

        if (this.config.abortOnCriticalFailure && engine.engineId === 'sovereignty') {
          break;
        }
      } else if (record.outcome === 'SKIPPED') {
        skipCount++;
      }
    }

    const totalDurationMs = Date.now() - startMs;

    return Object.freeze({
      plan,
      outcomes: freezeArray(outcomes),
      finalSnapshot: currentSnapshot,
      allSignals: freezeArray(allSignals),
      totalDurationMs,
      errorCount,
      rollbackCount,
      skipCount,
      completedAtMs: Date.now(),
    });
  }

  public getJournal(): EngineTickTransactionJournal {
    return this.journal;
  }

  public getMetrics(): EngineTickTransactionMetrics {
    return this.metrics;
  }

  public getReplay(): EngineTickTransactionReplay {
    return this.replay;
  }

  public drainMLVectors(): readonly EngineTickTransactionMLVector[] {
    const v = freezeArray(this.mlVectors);
    this.mlVectors.length = 0;
    return v;
  }

  public reset(): void {
    this.journal.reset();
    this.metrics.reset();
    this.replay.reset();
    this.mlVectors.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — EngineTickTransactionHealthTracker — rolling health per engine
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionHealthSnapshot {
  readonly engineId: EngineId | 'mode' | 'system';
  readonly status: EngineHealthStatus;
  readonly consecutiveFailures: number;
  readonly consecutiveSuccesses: number;
  readonly totalRuns: number;
  readonly errorRate: number;
  readonly avgDurationMs: number;
  readonly lastRunAtMs: number | null;
  readonly lastSuccessAtMs: number | null;
  readonly lastFailureAtMs: number | null;
  readonly trend: TransactionHealthTrend;
  readonly budgetCompliance: number;
}

export interface TransactionHealthReport {
  readonly generatedAtMs: number;
  readonly overallHealth: EngineHealthStatus;
  readonly engineSnapshots: readonly TransactionHealthSnapshot[];
  readonly criticalEngines: readonly string[];
  readonly degradedEngines: readonly string[];
  readonly healthyEngines: readonly string[];
  readonly systemUptimeRatio: number;
}

export class EngineTickTransactionHealthTracker {
  private readonly engineState: Map<
    string,
    {
      consecutiveFailures: number;
      consecutiveSuccesses: number;
      totalRuns: number;
      totalErrors: number;
      totalDurationMs: number;
      budgetExceeded: number;
      lastRunAtMs: number | null;
      lastSuccessAtMs: number | null;
      lastFailureAtMs: number | null;
      recentOutcomes: TransactionOutcome[];
    }
  > = new Map();

  public record(record: TransactionOutcomeRecord): void {
    const key = record.engineId;
    const existing = this.engineState.get(key) ?? {
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      totalRuns: 0,
      totalErrors: 0,
      totalDurationMs: 0,
      budgetExceeded: 0,
      lastRunAtMs: null,
      lastSuccessAtMs: null,
      lastFailureAtMs: null,
      recentOutcomes: [],
    };

    existing.totalRuns++;
    existing.totalDurationMs += record.durationMs;
    existing.lastRunAtMs = record.completedAtMs;
    if (record.budgetExceeded) existing.budgetExceeded++;

    if (record.outcome === 'ROLLED_BACK' || record.outcome === 'ABORTED') {
      existing.consecutiveFailures++;
      existing.consecutiveSuccesses = 0;
      existing.totalErrors++;
      existing.lastFailureAtMs = record.completedAtMs;
    } else {
      existing.consecutiveSuccesses++;
      existing.consecutiveFailures = 0;
      existing.lastSuccessAtMs = record.completedAtMs;
    }

    existing.recentOutcomes.push(record.outcome);
    if (existing.recentOutcomes.length > 20) {
      existing.recentOutcomes.shift();
    }

    this.engineState.set(key, existing);
  }

  public getHealthSnapshot(
    engineId: EngineId | 'mode' | 'system',
  ): TransactionHealthSnapshot | null {
    const state = this.engineState.get(engineId);
    if (state === undefined) return null;

    const errorRate = state.totalRuns > 0 ? state.totalErrors / state.totalRuns : 0;
    const avgDurationMs =
      state.totalRuns > 0 ? state.totalDurationMs / state.totalRuns : 0;
    const budgetCompliance =
      state.totalRuns > 0
        ? (state.totalRuns - state.budgetExceeded) / state.totalRuns
        : 1;

    const status: EngineHealthStatus =
      state.consecutiveFailures >= 3 ? 'FAILED' :
      state.consecutiveFailures >= 1 || errorRate > 0.3 ? 'DEGRADED' :
      'HEALTHY';

    const trend = computeHealthTrend(state.recentOutcomes);

    return Object.freeze({
      engineId,
      status,
      consecutiveFailures: state.consecutiveFailures,
      consecutiveSuccesses: state.consecutiveSuccesses,
      totalRuns: state.totalRuns,
      errorRate,
      avgDurationMs,
      lastRunAtMs: state.lastRunAtMs,
      lastSuccessAtMs: state.lastSuccessAtMs,
      lastFailureAtMs: state.lastFailureAtMs,
      trend,
      budgetCompliance,
    });
  }

  public buildReport(): TransactionHealthReport {
    const snapshots: TransactionHealthSnapshot[] = [];

    for (const engineId of [...ALL_ENGINE_IDS, 'mode' as const, 'system' as const]) {
      const snap = this.getHealthSnapshot(engineId);
      if (snap !== null) snapshots.push(snap);
    }

    const criticalEngines = snapshots
      .filter((s) => s.status === 'FAILED')
      .map((s) => String(s.engineId));
    const degradedEngines = snapshots
      .filter((s) => s.status === 'DEGRADED')
      .map((s) => String(s.engineId));
    const healthyEngines = snapshots
      .filter((s) => s.status === 'HEALTHY')
      .map((s) => String(s.engineId));

    const overallHealth: EngineHealthStatus =
      criticalEngines.length > 0 ? 'FAILED' :
      degradedEngines.length > 0 ? 'DEGRADED' :
      'HEALTHY';

    const totalRuns = snapshots.reduce((a, s) => a + s.totalRuns, 0);
    const totalErrors = snapshots.reduce(
      (a, s) => a + Math.round(s.errorRate * s.totalRuns),
      0,
    );
    const systemUptimeRatio = totalRuns > 0 ? 1 - totalErrors / totalRuns : 1;

    return Object.freeze({
      generatedAtMs: Date.now(),
      overallHealth,
      engineSnapshots: freezeArray(snapshots),
      criticalEngines: freezeArray(criticalEngines),
      degradedEngines: freezeArray(degradedEngines),
      healthyEngines: freezeArray(healthyEngines),
      systemUptimeRatio,
    });
  }

  public buildEngineHealth(
    engineId: EngineId,
    updatedAt: number,
  ): EngineHealth {
    const snap = this.getHealthSnapshot(engineId);
    if (snap === null) {
      return {
        engineId,
        status: 'HEALTHY',
        updatedAt,
        consecutiveFailures: 0,
        lastSuccessfulTick: undefined,
      };
    }
    return {
      engineId,
      status: snap.status,
      updatedAt,
      notes: [
        `errorRate=${snap.errorRate.toFixed(3)}`,
        `avgDurationMs=${snap.avgDurationMs.toFixed(1)}`,
        `trend=${snap.trend}`,
      ],
      consecutiveFailures: snap.consecutiveFailures,
      lastSuccessfulTick: undefined,
    };
  }

  public reset(): void {
    this.engineState.clear();
  }
}

function computeHealthTrend(recentOutcomes: readonly TransactionOutcome[]): TransactionHealthTrend {
  if (recentOutcomes.length < 4) return 'STABLE';

  const recent = recentOutcomes.slice(-10);
  const half = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, half);
  const secondHalf = recent.slice(half);

  const errorRate = (half: readonly TransactionOutcome[]) =>
    half.filter((o) => o === 'ROLLED_BACK' || o === 'ABORTED').length / half.length;

  const firstRate = errorRate(firstHalf);
  const secondRate = errorRate(secondHalf);

  if (secondRate < firstRate - 0.1) return 'IMPROVING';
  if (secondRate > firstRate + 0.1) return 'DEGRADING';

  const allErrors = recent.filter((o) => o === 'ROLLED_BACK' || o === 'ABORTED').length;
  const volatility = allErrors / recent.length;
  if (volatility > 0.2 && volatility < 0.7) return 'VOLATILE';

  return 'STABLE';
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — EngineTickTransactionDiffEngine — snapshot delta computation
// ─────────────────────────────────────────────────────────────────────────────

export interface SnapshotDeltaSummary {
  readonly tick: number;
  readonly step: TickStep;
  readonly engineId: EngineId | 'mode' | 'system';
  readonly pressureChanged: boolean;
  readonly phaseChanged: boolean;
  readonly modeChanged: boolean;
  readonly economyChanged: boolean;
  readonly battleChanged: boolean;
  readonly cascadeChanged: boolean;
  readonly shieldChanged: boolean;
  readonly sovereigntyChanged: boolean;
  readonly cardsChanged: boolean;
  readonly tensionChanged: boolean;
  readonly surfaceKey: { before: string; after: string };
  readonly mutationScore: number;
}

export class EngineTickTransactionDiffEngine {
  public static compute(
    before: RunStateSnapshot,
    after: RunStateSnapshot,
    meta: EngineTickTransactionMeta,
  ): SnapshotDeltaSummary {
    const pressureChanged =
      before.pressure?.tier !== after.pressure?.tier ||
      Math.abs((before.pressure?.score ?? 0) - (after.pressure?.score ?? 0)) > 0.001;

    const phaseChanged = before.phase !== after.phase;
    const modeChanged = before.mode !== after.mode;

    const economyChanged =
      before.economy?.netWorth !== after.economy?.netWorth ||
      before.economy?.cash !== after.economy?.cash;

    const battleChanged =
      before.battle?.battleBudget !== after.battle?.battleBudget ||
      (before.battle?.bots?.length ?? 0) !== (after.battle?.bots?.length ?? 0);

    const cascadeChanged =
      (before.cascade?.activeChains?.length ?? 0) !==
      (after.cascade?.activeChains?.length ?? 0);

    const shieldChanged =
      before.shield?.weakestLayerRatio !== after.shield?.weakestLayerRatio;

    const sovereigntyChanged =
      before.sovereignty?.sovereigntyScore !== after.sovereignty?.sovereigntyScore;

    const cardsChanged =
      (before.cards?.hand?.length ?? 0) !== (after.cards?.hand?.length ?? 0);

    const tensionChanged =
      Math.abs((before.tension?.score ?? 0) - (after.tension?.score ?? 0)) > 0.01;

    const changeCount = [
      pressureChanged, phaseChanged, economyChanged, battleChanged,
      cascadeChanged, shieldChanged, sovereigntyChanged, cardsChanged, tensionChanged,
    ].filter(Boolean).length;

    const mutationScore = Math.min(1.0, changeCount / 9);

    return Object.freeze({
      tick: meta.tick,
      step: meta.step,
      engineId: meta.engineId,
      pressureChanged,
      phaseChanged,
      modeChanged,
      economyChanged,
      battleChanged,
      cascadeChanged,
      shieldChanged,
      sovereigntyChanged,
      cardsChanged,
      tensionChanged,
      surfaceKey: {
        before: snapshotSurfaceKey(before),
        after: snapshotSurfaceKey(after),
      },
      mutationScore,
    });
  }

  public static buildMutationSignal(
    diff: SnapshotDeltaSummary,
  ): EngineSignal {
    return createEngineSignalFull(
      diff.engineId as EngineId,
      diff.mutationScore > 0.6 ? 'WARN' : 'INFO',
      'SNAPSHOT_MUTATION',
      `[${diff.engineId}] ${diff.step}: mutationScore=${diff.mutationScore.toFixed(3)}, ` +
        `pressure=${diff.pressureChanged}, economy=${diff.economyChanged}, ` +
        `phase=${diff.phaseChanged}, battle=${diff.battleChanged}`,
      diff.tick,
      'state_mutation',
      ['snapshot-diff', `mutation-score:${diff.mutationScore.toFixed(2)}`],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — TransactionUXScorer — user experience quality on every outcome
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionUXScore {
  readonly tick: number;
  readonly step: TickStep;
  readonly engineId: EngineId | 'mode' | 'system';
  readonly uxScore: number;         // 0.0–1.0
  readonly smoothness: number;      // budget compliance as UX proxy
  readonly reliability: number;     // commit rate
  readonly responsiveness: number;  // inverse of duration-to-budget ratio
  readonly momentum: number;        // snapshot mutation meaningfulness
  readonly tension: number;         // signal weight as tension proxy
  readonly grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  readonly narrative: string;
}

export interface TransactionUXReport {
  readonly generatedAtMs: number;
  readonly tick: number;
  readonly scores: readonly TransactionUXScore[];
  readonly avgUXScore: number;
  readonly criticalDrops: number;
  readonly isCinematicTick: boolean;
  readonly experienceGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

const UX_GRADE_THRESHOLDS: Array<{ min: number; grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' }> = [
  { min: 0.90, grade: 'S' },
  { min: 0.75, grade: 'A' },
  { min: 0.60, grade: 'B' },
  { min: 0.45, grade: 'C' },
  { min: 0.30, grade: 'D' },
  { min: 0.00, grade: 'F' },
] as const;

function gradeFromScore(score: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
  for (const { min, grade } of UX_GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return 'F';
}

const UX_NARRATIVE_BY_GRADE: Record<'S' | 'A' | 'B' | 'C' | 'D' | 'F', string> = {
  S: 'Engine tick executed flawlessly — user experience is cinematic.',
  A: 'Clean execution with minimal friction — player agency fully preserved.',
  B: 'Solid execution with minor timing stress — game feel is intact.',
  C: 'Marginal execution — some latency or signal noise detectable.',
  D: 'Degraded execution — player may notice hesitation or errors.',
  F: 'Critical failure — rollback or abort disrupted the user experience.',
} as const;

export class TransactionUXScorer {
  public static score(
    record: TransactionOutcomeRecord,
    diff?: SnapshotDeltaSummary,
  ): TransactionUXScore {
    const smoothness = record.budgetExceeded ? Math.max(0, 1 - record.durationMs / (record.budgetMs * 2)) : 1.0;
    const reliability = TRANSACTION_OUTCOME_NUMERIC[record.outcome];
    const durationRatio = record.budgetMs > 0 ? record.durationMs / record.budgetMs : 0;
    const responsiveness = Math.max(0, 1 - Math.min(1, (durationRatio - 1) * 0.5));
    const momentum = diff !== undefined ? diff.mutationScore : (record.snapshotChanged ? 0.5 : 0.0);
    const tension = Math.min(1.0, record.signalWeightTotal / 3.0);

    const uxScore =
      smoothness * 0.25 +
      reliability * 0.35 +
      responsiveness * 0.20 +
      momentum * 0.10 +
      (1 - tension) * 0.10;

    const grade = gradeFromScore(uxScore);
    const narrative = UX_NARRATIVE_BY_GRADE[grade];

    return Object.freeze({
      tick: record.tick,
      step: record.step,
      engineId: record.engineId,
      uxScore,
      smoothness,
      reliability,
      responsiveness,
      momentum,
      tension,
      grade,
      narrative,
    });
  }

  public static scoreAll(
    records: readonly TransactionOutcomeRecord[],
    diffs?: readonly SnapshotDeltaSummary[],
  ): readonly TransactionUXScore[] {
    return freezeArray(
      records.map((r, i) =>
        TransactionUXScorer.score(r, diffs?.[i]),
      ),
    );
  }

  public static buildReport(
    tick: number,
    scores: readonly TransactionUXScore[],
  ): TransactionUXReport {
    const avgUXScore =
      scores.length > 0
        ? scores.reduce((a, s) => a + s.uxScore, 0) / scores.length
        : 1.0;

    const criticalDrops = scores.filter((s) => s.grade === 'D' || s.grade === 'F').length;
    const isCinematicTick = avgUXScore >= 0.88 && criticalDrops === 0;
    const experienceGrade = gradeFromScore(avgUXScore);

    return Object.freeze({
      generatedAtMs: Date.now(),
      tick,
      scores: freezeArray(scores),
      avgUXScore,
      criticalDrops,
      isCinematicTick,
      experienceGrade,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — EngineTickTransactionAnalytics — aggregate analytics surface
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionAnalyticsReport {
  readonly generatedAtMs: number;
  readonly journalSize: number;
  readonly metricsReport: TransactionMetricsReport;
  readonly healthReport: TransactionHealthReport;
  readonly uxReport: TransactionUXReport;
  readonly mlVectorCount: number;
  readonly replayFrameCount: number;
  readonly overallOutcomeDistribution: Record<TransactionOutcome, number>;
  readonly topSignalsByWeight: readonly { code: string; weight: number; count: number }[];
  readonly budgetViolationRatio: number;
  readonly systemHealthGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

export class EngineTickTransactionAnalytics {
  private readonly journal: EngineTickTransactionJournal;
  private readonly metrics: EngineTickTransactionMetrics;
  private readonly health: EngineTickTransactionHealthTracker;
  private readonly mlVectors: EngineTickTransactionMLVector[] = [];

  public constructor(
    journal: EngineTickTransactionJournal,
    metrics: EngineTickTransactionMetrics,
    health: EngineTickTransactionHealthTracker,
  ) {
    this.journal = journal;
    this.metrics = metrics;
    this.health = health;
  }

  public ingestMLVector(vector: EngineTickTransactionMLVector): void {
    this.mlVectors.push(vector);
  }

  public buildReport(tick: number): TransactionAnalyticsReport {
    const metricsReport = this.metrics.buildReport();
    const healthReport = this.health.buildReport();

    const allEntries = this.journal.getAllEntries();
    const allRecords = allEntries.map((e) => e.record);
    const allSignals = allEntries.flatMap((e) => [...e.signals]);

    const uxScores = TransactionUXScorer.scoreAll(allRecords);
    const uxReport = TransactionUXScorer.buildReport(tick, uxScores);

    const outcomeDistribution = this.journal.computeOutcomeDistribution();
    const totalRuns = allRecords.length;
    const budgetViolations = allRecords.filter((r) => r.budgetExceeded).length;
    const budgetViolationRatio = totalRuns > 0 ? budgetViolations / totalRuns : 0;

    const signalCodeWeights: Map<string, { weight: number; count: number }> = new Map();
    for (const sig of allSignals) {
      const existing = signalCodeWeights.get(sig.code) ?? { weight: 0, count: 0 };
      const w = SIGNAL_SEVERITY_WEIGHT[sig.severity] * (SIGNAL_CATEGORY_WEIGHT[sig.category ?? 'tick'] ?? 0.1);
      signalCodeWeights.set(sig.code, { weight: existing.weight + w, count: existing.count + 1 });
    }

    const topSignals = Array.from(signalCodeWeights.entries())
      .map(([code, { weight, count }]) => ({ code, weight, count }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);

    const systemHealthGrade = gradeFromScore(healthReport.systemUptimeRatio);

    return Object.freeze({
      generatedAtMs: Date.now(),
      journalSize: this.journal.size(),
      metricsReport,
      healthReport,
      uxReport,
      mlVectorCount: this.mlVectors.length,
      replayFrameCount: 0,
      overallOutcomeDistribution: outcomeDistribution,
      topSignalsByWeight: freezeArray(topSignals),
      budgetViolationRatio,
      systemHealthGrade,
    });
  }

  public buildMLFeatureMatrix(): readonly (readonly number[])[] {
    return freezeArray(this.mlVectors.map((v) => v.features));
  }

  public reset(): void {
    this.mlVectors.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — EngineTickTransactionChatBridge — structural output for chat adapters
// ─────────────────────────────────────────────────────────────────────────────

/** Structural chat signal contract — no circular import from chat/ directory. */
export interface TickTransactionChatSignal {
  readonly surface: 'tick_transaction';
  readonly kind:
    | 'transaction_committed'
    | 'transaction_rolled_back'
    | 'transaction_skipped'
    | 'budget_exceeded'
    | 'health_report'
    | 'ux_report'
    | 'analytics_summary'
    | 'ml_vector_emitted';
  readonly engineId: string;
  readonly tick: number;
  readonly step: string;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly uxScore?: number;
  readonly uxGrade?: string;
  readonly durationMs?: number;
  readonly budgetMs?: number;
  readonly errorCount?: number;
  readonly signalWeightTotal?: number;
  readonly outcomeNumeric?: number;
  readonly snapshotChanged?: boolean;
  readonly systemHealthGrade?: string;
}

export class EngineTickTransactionChatBridge {
  public static fromCommitted(record: TransactionOutcomeRecord): TickTransactionChatSignal {
    return Object.freeze({
      surface: 'tick_transaction',
      kind: 'transaction_committed',
      engineId: String(record.engineId),
      tick: record.tick,
      step: record.step,
      severity: record.errorCount > 0 ? 'warn' : 'info',
      message: `[${record.engineId}] committed ${record.step} tick ${record.tick} in ${record.durationMs}ms (${record.signalCount} signals)`,
      durationMs: record.durationMs,
      budgetMs: record.budgetMs,
      errorCount: record.errorCount,
      signalWeightTotal: record.signalWeightTotal,
      outcomeNumeric: TRANSACTION_OUTCOME_NUMERIC[record.outcome],
      snapshotChanged: record.snapshotChanged,
    });
  }

  public static fromRolledBack(
    record: TransactionOutcomeRecord,
    error?: string,
  ): TickTransactionChatSignal {
    return Object.freeze({
      surface: 'tick_transaction',
      kind: 'transaction_rolled_back',
      engineId: String(record.engineId),
      tick: record.tick,
      step: record.step,
      severity: 'error',
      message: error
        ? `[${record.engineId}] ROLLBACK at ${record.step}: ${error}`
        : `[${record.engineId}] rolled back ${record.step} tick ${record.tick}`,
      durationMs: record.durationMs,
      budgetMs: record.budgetMs,
      errorCount: record.errorCount,
      signalWeightTotal: record.signalWeightTotal,
      outcomeNumeric: TRANSACTION_OUTCOME_NUMERIC['ROLLED_BACK'],
      snapshotChanged: false,
    });
  }

  public static fromBudgetExceeded(record: TransactionOutcomeRecord): TickTransactionChatSignal {
    const ratio = record.budgetMs > 0 ? record.durationMs / record.budgetMs : 0;
    return Object.freeze({
      surface: 'tick_transaction',
      kind: 'budget_exceeded',
      engineId: String(record.engineId),
      tick: record.tick,
      step: record.step,
      severity: ratio > 3 ? 'error' : 'warn',
      message: `[${record.engineId}] ${record.step} budget exceeded: ${record.durationMs}ms vs ${record.budgetMs}ms budget (${ratio.toFixed(1)}x)`,
      durationMs: record.durationMs,
      budgetMs: record.budgetMs,
      outcomeNumeric: TRANSACTION_OUTCOME_NUMERIC[record.outcome],
    });
  }

  public static fromUXReport(report: TransactionUXReport): TickTransactionChatSignal {
    return Object.freeze({
      surface: 'tick_transaction',
      kind: 'ux_report',
      engineId: 'system',
      tick: report.tick,
      step: 'TICK_SUMMARY',
      severity: report.criticalDrops > 0 ? 'warn' : 'info',
      message: `Tick ${report.tick} UX: grade=${report.experienceGrade}, avgScore=${report.avgUXScore.toFixed(3)}, cinematic=${report.isCinematicTick}, criticalDrops=${report.criticalDrops}`,
      uxScore: report.avgUXScore,
      uxGrade: report.experienceGrade,
    });
  }

  public static fromHealthReport(report: TransactionHealthReport): TickTransactionChatSignal {
    return Object.freeze({
      surface: 'tick_transaction',
      kind: 'health_report',
      engineId: 'system',
      tick: 0,
      step: 'HEALTH_SUMMARY',
      severity: report.overallHealth === 'FAILED' ? 'error' :
                report.overallHealth === 'DEGRADED' ? 'warn' : 'info',
      message: `Transaction health: ${report.overallHealth}, uptime=${report.systemUptimeRatio.toFixed(3)}, failed=${report.criticalEngines.length}, degraded=${report.degradedEngines.length}`,
      systemHealthGrade: report.overallHealth,
    });
  }

  public static fromAnalytics(report: TransactionAnalyticsReport): TickTransactionChatSignal {
    return Object.freeze({
      surface: 'tick_transaction',
      kind: 'analytics_summary',
      engineId: 'system',
      tick: 0,
      step: 'ANALYTICS_SUMMARY',
      severity: report.systemHealthGrade === 'F' || report.systemHealthGrade === 'D' ? 'error' : 'info',
      message: `Analytics: journal=${report.journalSize}, errorRate=${report.metricsReport.overallErrorRate.toFixed(3)}, budgetCompliance=${report.metricsReport.overallBudgetCompliance.toFixed(3)}, uxGrade=${report.uxReport.experienceGrade}`,
      systemHealthGrade: report.systemHealthGrade,
      uxScore: report.uxReport.avgUXScore,
      uxGrade: report.uxReport.experienceGrade,
    });
  }

  public static fromMLVector(
    vector: EngineTickTransactionMLVector,
  ): TickTransactionChatSignal {
    const outcomeScore = vector.features[0] ?? 0;
    return Object.freeze({
      surface: 'tick_transaction',
      kind: 'ml_vector_emitted',
      engineId: String(vector.engineId),
      tick: vector.tick,
      step: vector.step,
      severity: outcomeScore < 0.3 ? 'warn' : 'info',
      message: `ML vector emitted for [${vector.engineId}] ${vector.step} tick ${vector.tick}: outcome=${vector.outcome}, features[0..3]=[${vector.features.slice(0, 4).map((f) => f.toFixed(3)).join(',')}]`,
      outcomeNumeric: outcomeScore,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — InstrumentedTransactionRunner — production-grade entry point
// ─────────────────────────────────────────────────────────────────────────────

export interface InstrumentedRunnerConfig {
  readonly orchestratorConfig: Partial<OrchestratorConfig>;
  readonly uxScoringEnabled: boolean;
  readonly diffEngineEnabled: boolean;
  readonly chatBridgeEnabled: boolean;
  readonly journalRetentionLimit: number;
}

export const DEFAULT_INSTRUMENTED_RUNNER_CONFIG: InstrumentedRunnerConfig = {
  orchestratorConfig: DEFAULT_ORCHESTRATOR_CONFIG,
  uxScoringEnabled: true,
  diffEngineEnabled: true,
  chatBridgeEnabled: true,
  journalRetentionLimit: 500,
} as const;

export interface InstrumentedRunnerTickResult {
  readonly tickResult: TickExecutionResult;
  readonly uxReport: TransactionUXReport;
  readonly analyticsReport: TransactionAnalyticsReport;
  readonly chatSignals: readonly TickTransactionChatSignal[];
  readonly mlVectors: readonly EngineTickTransactionMLVector[];
  readonly healthReport: TransactionHealthReport;
}

export class InstrumentedTransactionRunner {
  private readonly config: InstrumentedRunnerConfig;
  private readonly orchestrator: EngineTickTransactionOrchestrator;
  private readonly healthTracker: EngineTickTransactionHealthTracker;
  private readonly analytics: EngineTickTransactionAnalytics;
  private readonly pendingChatSignals: TickTransactionChatSignal[] = [];

  public constructor(config: Partial<InstrumentedRunnerConfig> = {}) {
    this.config = { ...DEFAULT_INSTRUMENTED_RUNNER_CONFIG, ...config };
    this.orchestrator = new EngineTickTransactionOrchestrator(
      this.config.orchestratorConfig,
    );
    this.healthTracker = new EngineTickTransactionHealthTracker();
    this.analytics = new EngineTickTransactionAnalytics(
      this.orchestrator.getJournal(),
      this.orchestrator.getMetrics(),
      this.healthTracker,
    );
  }

  public runTick(
    engines: readonly SimulationEngine[],
    inputSnapshot: RunStateSnapshot,
    context: TickContext,
  ): InstrumentedRunnerTickResult {
    const tickResult = this.orchestrator.executeTick(engines, inputSnapshot, context);
    const mlVectors = this.orchestrator.drainMLVectors();

    for (const record of tickResult.outcomes) {
      this.healthTracker.record(record);
    }

    for (const vector of mlVectors) {
      this.analytics.ingestMLVector(vector);
    }

    const uxScores = TransactionUXScorer.scoreAll(
      tickResult.outcomes,
      this.config.diffEngineEnabled
        ? tickResult.outcomes.map((r) =>
            EngineTickTransactionDiffEngine.compute(
              inputSnapshot,
              tickResult.finalSnapshot,
              {
                engineId: r.engineId,
                tick: r.tick,
                step: r.step,
                startedAtMs: r.completedAtMs - r.durationMs,
                riskLevel: STEP_RISK_PROFILE[r.step] ?? 'MODERATE',
                budgetMs: r.budgetMs,
              },
            ),
          )
        : undefined,
    );

    const uxReport = TransactionUXScorer.buildReport(context.trace.tick, uxScores);
    const healthReport = this.healthTracker.buildReport();
    const analyticsReport = this.analytics.buildReport(context.trace.tick);

    const chatSignals: TickTransactionChatSignal[] = [...this.pendingChatSignals];
    this.pendingChatSignals.length = 0;

    if (this.config.chatBridgeEnabled) {
      for (const record of tickResult.outcomes) {
        if (record.outcome === 'ROLLED_BACK') {
          chatSignals.push(EngineTickTransactionChatBridge.fromRolledBack(record));
        } else if (record.outcome === 'COMMITTED' && record.snapshotChanged) {
          chatSignals.push(EngineTickTransactionChatBridge.fromCommitted(record));
        }
        if (record.budgetExceeded) {
          chatSignals.push(EngineTickTransactionChatBridge.fromBudgetExceeded(record));
        }
      }

      chatSignals.push(EngineTickTransactionChatBridge.fromUXReport(uxReport));
      chatSignals.push(EngineTickTransactionChatBridge.fromHealthReport(healthReport));

      for (const vector of mlVectors) {
        chatSignals.push(EngineTickTransactionChatBridge.fromMLVector(vector));
      }
    }

    return Object.freeze({
      tickResult,
      uxReport,
      analyticsReport,
      chatSignals: freezeArray(chatSignals),
      mlVectors,
      healthReport,
    });
  }

  public runEngine(
    engine: SimulationEngine,
    inputSnapshot: RunStateSnapshot,
    context: TickContext,
  ): { result: EngineTickResult; record: TransactionOutcomeRecord; uxScore: TransactionUXScore } {
    const { result, record } = this.orchestrator.executeEngine(engine, inputSnapshot, context);
    this.healthTracker.record(record);

    const mlVectors = this.orchestrator.drainMLVectors();
    for (const v of mlVectors) {
      this.analytics.ingestMLVector(v);
    }

    const diff = this.config.diffEngineEnabled
      ? EngineTickTransactionDiffEngine.compute(inputSnapshot, result.snapshot, {
          engineId: record.engineId,
          tick: record.tick,
          step: record.step,
          startedAtMs: record.completedAtMs - record.durationMs,
          riskLevel: STEP_RISK_PROFILE[record.step] ?? 'MODERATE',
          budgetMs: record.budgetMs,
        })
      : undefined;

    const uxScore = TransactionUXScorer.score(record, diff);
    return { result, record, uxScore };
  }

  public buildChatSignals(tick: number): readonly TickTransactionChatSignal[] {
    const healthReport = this.healthTracker.buildReport();
    const analyticsReport = this.analytics.buildReport(tick);
    return freezeArray([
      EngineTickTransactionChatBridge.fromHealthReport(healthReport),
      EngineTickTransactionChatBridge.fromAnalytics(analyticsReport),
    ]);
  }

  public getOrchestrator(): EngineTickTransactionOrchestrator {
    return this.orchestrator;
  }

  public getHealthTracker(): EngineTickTransactionHealthTracker {
    return this.healthTracker;
  }

  public getAnalytics(): EngineTickTransactionAnalytics {
    return this.analytics;
  }

  public serializeState(): Record<string, unknown> {
    return {
      journalSize: this.orchestrator.getJournal().size(),
      replayFrames: this.orchestrator.getReplay().size(),
      healthReport: this.healthTracker.buildReport(),
    };
  }

  public reset(): void {
    this.orchestrator.reset();
    this.healthTracker.reset();
    this.analytics.reset();
    this.pendingChatSignals.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 17 — Factory functions and export helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a production-grade instrumented runner with full analytics. */
export function createInstrumentedTransactionRunner(
  config: Partial<InstrumentedRunnerConfig> = {},
): InstrumentedTransactionRunner {
  return new InstrumentedTransactionRunner({
    ...DEFAULT_INSTRUMENTED_RUNNER_CONFIG,
    ...config,
  });
}

/** Create an orchestrator with custom config. */
export function createTransactionOrchestrator(
  config: Partial<OrchestratorConfig> = {},
): EngineTickTransactionOrchestrator {
  return new EngineTickTransactionOrchestrator({
    ...DEFAULT_ORCHESTRATOR_CONFIG,
    ...config,
  });
}

/** Build an empty zero-state UX score for a given step. */
export function buildZeroUXScore(
  engineId: EngineId | 'mode' | 'system',
  step: TickStep,
  tick: number,
): TransactionUXScore {
  return Object.freeze({
    tick,
    step,
    engineId,
    uxScore: 1.0,
    smoothness: 1.0,
    reliability: 1.0,
    responsiveness: 1.0,
    momentum: 0.0,
    tension: 0.0,
    grade: 'S' as const,
    narrative: UX_NARRATIVE_BY_GRADE['S'],
  });
}

/** Execute a single engine with full transaction safety — convenience wrapper. */
export function executeSingleEngine(
  engine: SimulationEngine,
  inputSnapshot: RunStateSnapshot,
  context: TickContext,
): EngineTickResult {
  return EngineTickTransaction.execute(engine, inputSnapshot, context);
}

/** Build a fallback EngineTickResult for engines that cannot run. */
export function buildSkippedResult(
  engineId: EngineId,
  snapshot: RunStateSnapshot,
  tick: number,
  step: TickStep,
): EngineTickResult {
  const signal = createEngineSignal(
    engineId,
    'INFO',
    'ENGINE_SKIPPED',
    `${engineId} skipped ${step} — cannot run.`,
    tick,
    ['engine-transaction', 'skipped', `step:${step.toLowerCase()}`],
  );
  return Object.freeze({ snapshot, signals: [signal] });
}

/** Summarize a batch of tick results into a compact analytics record. */
export function summarizeTickResults(
  results: readonly EngineTickResult[],
): {
  totalSignals: number;
  errorCount: number;
  warnCount: number;
  avgStepMs: number;
  allSignals: readonly EngineSignal[];
} {
  const allSignals: EngineSignal[] = [];
  let totalMs = 0;

  for (const r of results) {
    allSignals.push(...(r.signals ?? []));
    totalMs += r.stepMs ?? 0;
  }

  return {
    totalSignals: allSignals.length,
    errorCount: countSignalsBySeverity(allSignals, 'ERROR'),
    warnCount: countSignalsBySeverity(allSignals, 'WARN'),
    avgStepMs: results.length > 0 ? totalMs / results.length : 0,
    allSignals: freezeArray(allSignals),
  };
}

/** Assert that a tick execution result is clean — throws on errors. */
export function assertCleanTickResult(
  result: TickExecutionResult,
  context: string,
): void {
  if (result.errorCount > 0 || result.rollbackCount > 0) {
    throw new Error(
      `[assertCleanTickResult] ${context}: tick ${result.plan.tick} had ` +
        `${result.errorCount} errors and ${result.rollbackCount} rollbacks.`,
    );
  }
}

/** Build a classification of all signals from a tick execution. */
export function classifyTickSignals(
  result: TickExecutionResult,
): SignalClassificationSummary {
  return TransactionSignalClassifier.summarize(result.allSignals);
}

/** Build a comprehensive health signal for the chat system from tracker state. */
export function buildTransactionHealthChatSignal(
  tracker: EngineTickTransactionHealthTracker,
): TickTransactionChatSignal {
  const report = tracker.buildReport();
  return EngineTickTransactionChatBridge.fromHealthReport(report);
}

/** Build UX-focused chat signal from a single record. */
export function buildUXChatSignalFromRecord(
  record: TransactionOutcomeRecord,
  diff?: SnapshotDeltaSummary,
): TickTransactionChatSignal {
  const uxScore = TransactionUXScorer.score(record, diff);

  if (record.outcome === 'ROLLED_BACK') {
    return EngineTickTransactionChatBridge.fromRolledBack(record);
  }

  if (record.budgetExceeded) {
    return EngineTickTransactionChatBridge.fromBudgetExceeded(record);
  }

  return Object.freeze({
    surface: 'tick_transaction' as const,
    kind: 'transaction_committed' as const,
    engineId: String(record.engineId),
    tick: record.tick,
    step: record.step,
    severity: uxScore.grade === 'F' || uxScore.grade === 'D' ? 'warn' : 'info',
    message: `[${record.engineId}] ${record.step} UX=${uxScore.grade} (${uxScore.uxScore.toFixed(3)}): ${uxScore.narrative}`,
    uxScore: uxScore.uxScore,
    uxGrade: uxScore.grade,
    durationMs: record.durationMs,
    budgetMs: record.budgetMs,
    errorCount: record.errorCount,
    signalWeightTotal: record.signalWeightTotal,
    outcomeNumeric: TRANSACTION_OUTCOME_NUMERIC[record.outcome],
    snapshotChanged: record.snapshotChanged,
  });
}

// Re-export ENGINE_TICK_TRANSACTION_ML_FEATURE_LABELS under canonical alias
export const TICK_TRANSACTION_ML_FEATURE_LABELS = ENGINE_TICK_TRANSACTION_ML_FEATURE_LABELS;

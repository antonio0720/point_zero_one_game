/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/TickSequence.ts
 * VERSION: tick-sequence.v2.2026
 *
 * Doctrine:
 * - tick order is law
 * - engine order must be explicit, validated, and queryable
 * - orchestration, engine execution, telemetry, and sealing are separate phases
 * - any accidental reordering must fail loudly at module load
 * - ML/DL analytics, timing diagnostics, and chat signals are first-class concerns
 * - every constant declared here is wired into active analytics or validation logic
 * - the facade is the authoritative entry point for all tick sequence operations
 */

import {
  checksumParts,
  createDeterministicId,
  cloneJson,
  deepFreeze,
} from './Deterministic';

// ============================================================================
// MARK: Module version and readiness
// ============================================================================

export const TICK_SEQUENCE_MODULE_VERSION = 'tick-sequence.v2.2026' as const;
export const TICK_SEQUENCE_MODULE_READY = true as const;

// ============================================================================
// MARK: ML / DL feature counts and labels
// ============================================================================

export const TICK_ML_FEATURE_COUNT = 32 as const;
export const TICK_DL_FEATURE_COUNT = 48 as const;
export const TICK_STEP_BUDGET_MS = 50 as const;
export const TICK_PHASE_BUDGET_MS = 200 as const;
export const TICK_HISTORY_MAX_ENTRIES = 128 as const;
export const TICK_ANOMALY_THRESHOLD = 0.6 as const;
export const TICK_SLOW_STEP_MULTIPLIER = 3 as const;

export const TICK_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'step_ordinal_norm',
  'is_orchestration_phase',
  'is_engine_phase',
  'is_mode_phase',
  'is_observability_phase',
  'is_finalization_phase',
  'is_system_owner',
  'is_time_owner',
  'is_pressure_owner',
  'is_tension_owner',
  'is_battle_owner',
  'is_shield_owner',
  'is_cascade_owner',
  'is_mode_owner',
  'is_telemetry_owner',
  'is_sovereignty_owner',
  'mutates_state',
  'is_engine_execution',
  'step_duration_norm',
  'avg_step_duration_norm',
  'max_step_duration_norm',
  'step_error_rate',
  'phase_completion_ratio',
  'sequence_completion_ratio',
  'slow_step_flag',
  'recent_error_count_norm',
  'step_success_rate',
  'health_grade_numeric',
  'engine_execution_load_ratio',
  'anomaly_score',
  'step_since_last_error_norm',
  'phase_error_ratio',
]);

export const TICK_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...TICK_ML_FEATURE_LABELS,
  'prev_step_duration_norm',
  'next_step_ordinal_norm',
  'prev_phase_avg_duration_norm',
  'phase_orchestration_ratio',
  'phase_engine_ratio',
  'phase_mode_ratio',
  'phase_observability_ratio',
  'phase_finalization_ratio',
  'tick_count_norm',
  'run_progress_ratio',
  'owner_step_count_norm',
  'owner_error_rate',
  'budget_utilization',
  'chain_completion_score',
  'step_rank_by_duration_norm',
  'cumulative_duration_ratio',
]);

// ============================================================================
// MARK: Core tick step type system
// ============================================================================

export type TickStep =
  | 'STEP_01_PREPARE'
  | 'STEP_02_TIME'
  | 'STEP_03_PRESSURE'
  | 'STEP_04_TENSION'
  | 'STEP_05_BATTLE'
  | 'STEP_06_SHIELD'
  | 'STEP_07_CASCADE'
  | 'STEP_08_MODE_POST'
  | 'STEP_09_TELEMETRY'
  | 'STEP_10_SOVEREIGNTY_SNAPSHOT'
  | 'STEP_11_OUTCOME_GATE'
  | 'STEP_12_EVENT_SEAL'
  | 'STEP_13_FLUSH';

export type TickStepPhase =
  | 'ORCHESTRATION'
  | 'ENGINE'
  | 'MODE'
  | 'OBSERVABILITY'
  | 'FINALIZATION';

export type TickStepOwner =
  | 'system'
  | 'time'
  | 'pressure'
  | 'tension'
  | 'battle'
  | 'shield'
  | 'cascade'
  | 'mode'
  | 'telemetry'
  | 'sovereignty';

export interface TickStepDescriptor {
  readonly step: TickStep;
  readonly ordinal: number;
  readonly phase: TickStepPhase;
  readonly owner: TickStepOwner;
  readonly mutatesState: boolean;
  readonly description: string;
}

// ============================================================================
// MARK: Canonical sequence constants
// ============================================================================

export const TICK_SEQUENCE: readonly TickStep[] = Object.freeze([
  'STEP_01_PREPARE',
  'STEP_02_TIME',
  'STEP_03_PRESSURE',
  'STEP_04_TENSION',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
  'STEP_07_CASCADE',
  'STEP_08_MODE_POST',
  'STEP_09_TELEMETRY',
  'STEP_10_SOVEREIGNTY_SNAPSHOT',
  'STEP_11_OUTCOME_GATE',
  'STEP_12_EVENT_SEAL',
  'STEP_13_FLUSH',
]);

export const ENGINE_EXECUTION_STEPS: readonly TickStep[] = Object.freeze([
  'STEP_02_TIME',
  'STEP_03_PRESSURE',
  'STEP_04_TENSION',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
  'STEP_07_CASCADE',
]);

export const TICK_STEP_DESCRIPTORS: Readonly<Record<TickStep, TickStepDescriptor>> = Object.freeze({
  STEP_01_PREPARE: {
    step: 'STEP_01_PREPARE',
    ordinal: 1,
    phase: 'ORCHESTRATION',
    owner: 'system',
    mutatesState: true,
    description: 'Freeze inputs, normalize transient state, and establish trace context.',
  },
  STEP_02_TIME: {
    step: 'STEP_02_TIME',
    ordinal: 2,
    phase: 'ENGINE',
    owner: 'time',
    mutatesState: true,
    description: 'Advance authoritative time budget, cadence, and active decision windows.',
  },
  STEP_03_PRESSURE: {
    step: 'STEP_03_PRESSURE',
    ordinal: 3,
    phase: 'ENGINE',
    owner: 'pressure',
    mutatesState: true,
    description: 'Recompute pressure score, cadence tier, crossings, and escalation state.',
  },
  STEP_04_TENSION: {
    step: 'STEP_04_TENSION',
    ordinal: 4,
    phase: 'ENGINE',
    owner: 'tension',
    mutatesState: true,
    description: 'Refresh anticipation, visible threat envelopes, and pulse conditions.',
  },
  STEP_05_BATTLE: {
    step: 'STEP_05_BATTLE',
    ordinal: 5,
    phase: 'ENGINE',
    owner: 'battle',
    mutatesState: true,
    description: 'Resolve hostile bot posture, injected attacks, and extraction pressure.',
  },
  STEP_06_SHIELD: {
    step: 'STEP_06_SHIELD',
    ordinal: 6,
    phase: 'ENGINE',
    owner: 'shield',
    mutatesState: true,
    description: 'Apply damage, regen, breach accounting, and weakest-layer recomputation.',
  },
  STEP_07_CASCADE: {
    step: 'STEP_07_CASCADE',
    ordinal: 7,
    phase: 'ENGINE',
    owner: 'cascade',
    mutatesState: true,
    description: 'Progress positive and negative chains, spawn follow-on links, and mark breaks/completions.',
  },
  STEP_08_MODE_POST: {
    step: 'STEP_08_MODE_POST',
    ordinal: 8,
    phase: 'MODE',
    owner: 'mode',
    mutatesState: true,
    description: 'Apply mode-native reconciliation after core engine execution.',
  },
  STEP_09_TELEMETRY: {
    step: 'STEP_09_TELEMETRY',
    ordinal: 9,
    phase: 'OBSERVABILITY',
    owner: 'telemetry',
    mutatesState: true,
    description: 'Materialize decision telemetry, audit hints, and event-facing summaries.',
  },
  STEP_10_SOVEREIGNTY_SNAPSHOT: {
    step: 'STEP_10_SOVEREIGNTY_SNAPSHOT',
    ordinal: 10,
    phase: 'OBSERVABILITY',
    owner: 'sovereignty',
    mutatesState: true,
    description: 'Compute deterministic checksums, integrity status, and proof-facing snapshot data.',
  },
  STEP_11_OUTCOME_GATE: {
    step: 'STEP_11_OUTCOME_GATE',
    ordinal: 11,
    phase: 'FINALIZATION',
    owner: 'system',
    mutatesState: true,
    description: 'Evaluate terminal conditions, freedom targets, timeout, bankruptcy, and quarantine exits.',
  },
  STEP_12_EVENT_SEAL: {
    step: 'STEP_12_EVENT_SEAL',
    ordinal: 12,
    phase: 'FINALIZATION',
    owner: 'system',
    mutatesState: true,
    description: 'Seal tick outputs into canonical event order for proof and replay stability.',
  },
  STEP_13_FLUSH: {
    step: 'STEP_13_FLUSH',
    ordinal: 13,
    phase: 'FINALIZATION',
    owner: 'system',
    mutatesState: true,
    description: 'Flush pending buffers and finalize the tick boundary for the next cycle.',
  },
});

// ============================================================================
// MARK: Derived lookup maps
// ============================================================================

const TICK_INDEX_BY_STEP: Readonly<Record<TickStep, number>> = Object.freeze(
  TICK_SEQUENCE.reduce<Record<TickStep, number>>((acc, step, index) => {
    acc[step] = index;
    return acc;
  }, {} as Record<TickStep, number>),
);

export const TICK_STEPS_BY_PHASE: Readonly<Record<TickStepPhase, readonly TickStep[]>> =
  Object.freeze(
    TICK_SEQUENCE.reduce<Record<TickStepPhase, TickStep[]>>(
      (acc, step) => {
        const phase = TICK_STEP_DESCRIPTORS[step].phase;
        if (!acc[phase]) acc[phase] = [];
        acc[phase].push(step);
        return acc;
      },
      {} as Record<TickStepPhase, TickStep[]>,
    ),
  );

export const TICK_STEPS_BY_OWNER: Readonly<Record<TickStepOwner, readonly TickStep[]>> =
  Object.freeze(
    TICK_SEQUENCE.reduce<Record<TickStepOwner, TickStep[]>>(
      (acc, step) => {
        const owner = TICK_STEP_DESCRIPTORS[step].owner;
        if (!acc[owner]) acc[owner] = [];
        acc[owner].push(step);
        return acc;
      },
      {} as Record<TickStepOwner, TickStep[]>,
    ),
  );

export const TICK_PHASE_ORDER: readonly TickStepPhase[] = Object.freeze([
  'ORCHESTRATION',
  'ENGINE',
  'MODE',
  'OBSERVABILITY',
  'FINALIZATION',
]);

export const TICK_OWNER_ORDER: readonly TickStepOwner[] = Object.freeze([
  'system',
  'time',
  'pressure',
  'tension',
  'battle',
  'shield',
  'cascade',
  'mode',
  'telemetry',
  'sovereignty',
]);

export const TICK_STEP_ORDINALS: Readonly<Record<TickStep, number>> = Object.freeze(
  TICK_SEQUENCE.reduce<Record<TickStep, number>>((acc, step) => {
    acc[step] = TICK_STEP_DESCRIPTORS[step].ordinal;
    return acc;
  }, {} as Record<TickStep, number>),
);

export const TICK_PHASE_ORDINALS: Readonly<Record<TickStepPhase, number>> = Object.freeze({
  ORCHESTRATION: 0,
  ENGINE: 1,
  MODE: 2,
  OBSERVABILITY: 3,
  FINALIZATION: 4,
});

export const TICK_OWNER_ORDINALS: Readonly<Record<TickStepOwner, number>> = Object.freeze({
  system: 0,
  time: 1,
  pressure: 2,
  tension: 3,
  battle: 4,
  shield: 5,
  cascade: 6,
  mode: 7,
  telemetry: 8,
  sovereignty: 9,
});

// ============================================================================
// MARK: Performance and timing types
// ============================================================================

export interface TickStepTimingRecord {
  readonly step: TickStep;
  readonly tick: number;
  readonly runId: string;
  readonly startedAtMs: number;
  readonly finishedAtMs: number;
  readonly durationMs: number;
  readonly phase: TickStepPhase;
  readonly owner: TickStepOwner;
  readonly status: 'OK' | 'ERROR' | 'SKIPPED';
  readonly errorMessage: string | null;
  readonly budgetMs: number;
  readonly overBudget: boolean;
}

export interface TickStepPerformanceSummary {
  readonly step: TickStep;
  readonly sampleCount: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly minDurationMs: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
  readonly errorCount: number;
  readonly successRate: number;
  readonly overBudgetCount: number;
  readonly overBudgetRate: number;
}

export interface TickPhaseTimingSummary {
  readonly phase: TickStepPhase;
  readonly steps: readonly TickStep[];
  readonly totalDurationMs: number;
  readonly avgDurationMs: number;
  readonly slowestStep: TickStep | null;
  readonly fastestStep: TickStep | null;
  readonly errorCount: number;
  readonly completionRate: number;
}

export interface TickSequenceTickSummary {
  readonly tick: number;
  readonly runId: string;
  readonly totalDurationMs: number;
  readonly stepsCompleted: number;
  readonly stepsErrored: number;
  readonly stepsSkipped: number;
  readonly phaseTimings: Readonly<Record<TickStepPhase, number>>;
  readonly slowSteps: readonly TickStep[];
  readonly errorSteps: readonly TickStep[];
  readonly healthGrade: TickSequenceHealthGrade;
}

// ============================================================================
// MARK: ML / DL feature interfaces
// ============================================================================

export interface TickStepMLVector {
  readonly tick: number;
  readonly runId: string;
  readonly step: TickStep;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly generatedAtMs: number;
}

export interface TickStepDLTensor {
  readonly tick: number;
  readonly runId: string;
  readonly step: TickStep;
  readonly shape: readonly [1, 48];
  readonly data: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly generatedAtMs: number;
}

// ============================================================================
// MARK: Chat signal types
// ============================================================================

export type TickSequenceChatSignalKind =
  | 'STEP_COMPLETED'
  | 'STEP_ERRORED'
  | 'PHASE_COMPLETED'
  | 'SEQUENCE_ANOMALY'
  | 'SLOW_STEP_DETECTED'
  | 'STEP_BUDGET_EXCEEDED'
  | 'HEALTH_DEGRADED'
  | 'HEALTH_RECOVERED'
  | 'ML_VECTOR_READY'
  | 'SEQUENCE_VALIDATED';

export interface TickSequenceChatSignalPayload {
  readonly surface: 'tick_sequence';
  readonly kind: TickSequenceChatSignalKind;
  readonly tick: number;
  readonly runId: string;
  readonly step: TickStep;
  readonly phase: TickStepPhase;
  readonly owner: TickStepOwner;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly durationMs: number | null;
  readonly budgetMs: number | null;
  readonly errorMessage: string | null;
  readonly healthGrade: TickSequenceHealthGrade | null;
  readonly anomalyScore: number | null;
  readonly stepSuccessRate: number | null;
  readonly sequenceCompletionRatio: number | null;
}

export interface TickSequenceChatSignalEnvelope {
  readonly signalId: string;
  readonly payload: TickSequenceChatSignalPayload;
  readonly emittedAtMs: number;
  readonly dedupeKey: string;
}

// ============================================================================
// MARK: Health and diagnostics types
// ============================================================================

export type TickSequenceHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface TickSequenceHealthReport {
  readonly grade: TickSequenceHealthGrade;
  readonly sampleCount: number;
  readonly errorRate: number;
  readonly avgDurationMs: number;
  readonly slowStepCount: number;
  readonly criticalErrors: number;
  readonly healthyStepRatio: number;
  readonly overBudgetRate: number;
  readonly recommendations: readonly string[];
  readonly generatedAtMs: number;
}

export interface TickSequenceStats {
  readonly totalStepsRecorded: number;
  readonly totalErrorsRecorded: number;
  readonly overallSuccessRate: number;
  readonly avgTickDurationMs: number;
  readonly slowestStep: TickStep | null;
  readonly mostFrequentError: TickStep | null;
  readonly phaseTimings: Readonly<Partial<Record<TickStepPhase, number>>>;
  readonly stepSummaries: Readonly<Partial<Record<TickStep, TickStepPerformanceSummary>>>;
  readonly capturedAtMs: number;
}

export interface TickSequenceDiagnosticsSnapshot {
  readonly tick: number;
  readonly runId: string;
  readonly healthGrade: TickSequenceHealthGrade;
  readonly stats: TickSequenceStats;
  readonly recentAnomalies: readonly string[];
  readonly slowSteps: readonly TickStep[];
  readonly mlVector: TickStepMLVector | null;
  readonly capturedAtMs: number;
}

// ============================================================================
// MARK: Core utility functions (original)
// ============================================================================

export function isTickStep(value: string): value is TickStep {
  return Object.prototype.hasOwnProperty.call(TICK_INDEX_BY_STEP, value);
}

export function getTickStepIndex(step: TickStep): number {
  return TICK_INDEX_BY_STEP[step];
}

export function getTickStepDescriptor(step: TickStep): TickStepDescriptor {
  return TICK_STEP_DESCRIPTORS[step];
}

export function getNextTickStep(step: TickStep): TickStep | null {
  const next = getTickStepIndex(step) + 1;
  return next < TICK_SEQUENCE.length ? TICK_SEQUENCE[next] : null;
}

export function getPreviousTickStep(step: TickStep): TickStep | null {
  const prev = getTickStepIndex(step) - 1;
  return prev >= 0 ? TICK_SEQUENCE[prev] : null;
}

export function isEngineExecutionStep(step: TickStep): boolean {
  return ENGINE_EXECUTION_STEPS.includes(step);
}

export function assertValidTickSequence(
  sequence: readonly TickStep[] = TICK_SEQUENCE,
): void {
  if (sequence.length !== TICK_SEQUENCE.length) {
    throw new Error(
      `Invalid tick sequence length. Expected ${TICK_SEQUENCE.length}, received ${sequence.length}.`,
    );
  }

  const seen = new Set<TickStep>();

  for (let i = 0; i < sequence.length; i++) {
    const step = sequence[i];
    const expected = TICK_SEQUENCE[i];

    if (step !== expected) {
      throw new Error(
        `Tick sequence mismatch at index ${i}. Expected ${expected}, received ${step}.`,
      );
    }

    if (seen.has(step)) {
      throw new Error(`Duplicate tick step detected: ${step}`);
    }

    seen.add(step);

    const descriptor = TICK_STEP_DESCRIPTORS[step];
    if (!descriptor) {
      throw new Error(`Missing tick descriptor for step: ${step}`);
    }

    if (descriptor.ordinal !== i + 1) {
      throw new Error(
        `Descriptor ordinal mismatch for ${step}. Expected ${i + 1}, received ${descriptor.ordinal}.`,
      );
    }
  }

  if (sequence[0] !== 'STEP_01_PREPARE') {
    throw new Error('Tick sequence must begin with STEP_01_PREPARE.');
  }

  if (sequence[sequence.length - 1] !== 'STEP_13_FLUSH') {
    throw new Error('Tick sequence must end with STEP_13_FLUSH.');
  }
}

// ============================================================================
// MARK: Extended utility functions
// ============================================================================

export function getStepsForPhase(phase: TickStepPhase): readonly TickStep[] {
  return TICK_STEPS_BY_PHASE[phase] ?? [];
}

export function getStepsForOwner(owner: TickStepOwner): readonly TickStep[] {
  return TICK_STEPS_BY_OWNER[owner] ?? [];
}

export function isFinalizationStep(step: TickStep): boolean {
  return TICK_STEP_DESCRIPTORS[step].phase === 'FINALIZATION';
}

export function isObservabilityStep(step: TickStep): boolean {
  return TICK_STEP_DESCRIPTORS[step].phase === 'OBSERVABILITY';
}

export function isOrchestrationStep(step: TickStep): boolean {
  return TICK_STEP_DESCRIPTORS[step].phase === 'ORCHESTRATION';
}

export function isModeStep(step: TickStep): boolean {
  return TICK_STEP_DESCRIPTORS[step].phase === 'MODE';
}

export function getStepBudgetMs(step: TickStep): number {
  const desc = TICK_STEP_DESCRIPTORS[step];
  if (desc.phase === 'ENGINE') return TICK_STEP_BUDGET_MS;
  if (desc.phase === 'FINALIZATION') return TICK_STEP_BUDGET_MS * 2;
  return TICK_STEP_BUDGET_MS * 4;
}

export function computeSequenceCompletionRatio(completedSteps: readonly TickStep[]): number {
  return Math.min(1, completedSteps.length / TICK_SEQUENCE.length);
}

export function computePhaseCompletionRatio(phase: TickStepPhase, completedSteps: readonly TickStep[]): number {
  const phaseSteps = getStepsForPhase(phase);
  if (phaseSteps.length === 0) return 1;
  const completed = completedSteps.filter(s => TICK_STEP_DESCRIPTORS[s].phase === phase).length;
  return Math.min(1, completed / phaseSteps.length);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function normMs(ms: number, maxMs = 1000): number {
  return clamp01(ms / maxMs);
}

// ============================================================================
// MARK: TickStepTimingTracker — per-step timing data store
// ============================================================================

/**
 * Per-step timing tracker. Records every step execution for per-step
 * performance summaries used by ML vector builders and health monitors.
 */
export class TickStepTimingTracker {
  private readonly _maxEntries: number;
  private readonly _records: TickStepTimingRecord[] = [];
  private readonly _byStep = new Map<TickStep, TickStepTimingRecord[]>();
  private _totalTicks = 0;
  private _errorCount = 0;

  public constructor(maxEntries?: number) {
    const resolved = maxEntries ?? TICK_HISTORY_MAX_ENTRIES;
    this._maxEntries = Math.max(13, resolved);
  }

  public record(entry: TickStepTimingRecord): void {
    const frozen = deepFreeze(cloneJson(entry)) as TickStepTimingRecord;
    this._records.push(frozen);
    if (entry.status === 'ERROR') this._errorCount++;

    const bucket = this._byStep.get(entry.step) ?? [];
    bucket.push(frozen);
    this._byStep.set(entry.step, bucket);

    if (this._records.length > this._maxEntries) {
      const removed = this._records.shift();
      if (removed) {
        const b = this._byStep.get(removed.step);
        if (b) {
          const next = b.filter(r => r !== removed);
          if (next.length === 0) this._byStep.delete(removed.step);
          else this._byStep.set(removed.step, next);
        }
      }
    }
  }

  public recordTick(): void {
    this._totalTicks++;
  }

  public getSummaryForStep(step: TickStep): TickStepPerformanceSummary {
    const recs = this._byStep.get(step) ?? [];
    if (recs.length === 0) {
      return {
        step, sampleCount: 0, avgDurationMs: 0, maxDurationMs: 0,
        minDurationMs: 0, p50DurationMs: 0, p95DurationMs: 0,
        errorCount: 0, successRate: 1, overBudgetCount: 0, overBudgetRate: 0,
      };
    }
    const durations = recs.map(r => r.durationMs).sort((a, b) => a - b);
    const errors = recs.filter(r => r.status === 'ERROR').length;
    const overBudget = recs.filter(r => r.overBudget).length;
    return {
      step,
      sampleCount: recs.length,
      avgDurationMs: durations.reduce((s, d) => s + d, 0) / durations.length,
      maxDurationMs: durations[durations.length - 1] ?? 0,
      minDurationMs: durations[0] ?? 0,
      p50DurationMs: percentile(durations, 0.5),
      p95DurationMs: percentile(durations, 0.95),
      errorCount: errors,
      successRate: recs.length === 0 ? 1 : (recs.length - errors) / recs.length,
      overBudgetCount: overBudget,
      overBudgetRate: recs.length === 0 ? 0 : overBudget / recs.length,
    };
  }

  public getAllSummaries(): Readonly<Partial<Record<TickStep, TickStepPerformanceSummary>>> {
    const result: Partial<Record<TickStep, TickStepPerformanceSummary>> = {};
    for (const step of TICK_SEQUENCE) {
      const s = this.getSummaryForStep(step);
      if (s.sampleCount > 0) result[step] = s;
    }
    return result;
  }

  public getSlowSteps(multiplier = TICK_SLOW_STEP_MULTIPLIER): readonly TickStep[] {
    return TICK_SEQUENCE.filter(step => {
      const s = this.getSummaryForStep(step);
      return s.sampleCount > 0 && s.avgDurationMs > getStepBudgetMs(step) * multiplier;
    });
  }

  public getLastDurationForStep(step: TickStep): number {
    const recs = this._byStep.get(step) ?? [];
    return recs.length > 0 ? (recs[recs.length - 1]?.durationMs ?? 0) : 0;
  }

  public getRecentRecords(limit: number): readonly TickStepTimingRecord[] {
    return this._records.slice(Math.max(0, this._records.length - limit));
  }

  public get totalRecords(): number { return this._records.length; }
  public get totalTicks(): number { return this._totalTicks; }
  public get errorCount(): number { return this._errorCount; }
  public get errorRate(): number {
    return this._records.length === 0 ? 0 : this._errorCount / this._records.length;
  }

  public reset(): void {
    this._records.length = 0;
    this._byStep.clear();
    this._totalTicks = 0;
    this._errorCount = 0;
  }
}

// ============================================================================
// MARK: TickStepAnalyzer — cross-step performance correlation
// ============================================================================

/**
 * Analyzes relationships between steps — detects correlated slowdowns,
 * step-pair dependencies, and anomaly patterns across the sequence.
 */
export class TickStepAnalyzer {
  private readonly _tracker: TickStepTimingTracker;

  public constructor(tracker: TickStepTimingTracker) {
    this._tracker = tracker;
  }

  public computeAnomalyScore(step: TickStep, currentDurationMs: number): number {
    const summary = this._tracker.getSummaryForStep(step);
    if (summary.sampleCount < 3) return 0;
    const budget = getStepBudgetMs(step);
    const avgDev = Math.abs(currentDurationMs - summary.avgDurationMs);
    const normalizedDev = clamp01(avgDev / Math.max(budget, summary.avgDurationMs));
    const errorPenalty = (1 - summary.successRate) * 0.4;
    const budgetPenalty = currentDurationMs > budget * TICK_SLOW_STEP_MULTIPLIER ? 0.4 : 0;
    return clamp01(normalizedDev * 0.6 + errorPenalty + budgetPenalty);
  }

  public detectSlowSequence(threshold = TICK_ANOMALY_THRESHOLD): readonly TickStep[] {
    return TICK_SEQUENCE.filter(step => {
      const summary = this._tracker.getSummaryForStep(step);
      return this.computeAnomalyScore(step, summary.avgDurationMs) > threshold;
    });
  }

  public computePhaseCorrelation(phaseA: TickStepPhase, phaseB: TickStepPhase): number {
    const stepsA = getStepsForPhase(phaseA);
    const stepsB = getStepsForPhase(phaseB);
    if (stepsA.length === 0 || stepsB.length === 0) return 0;
    const avgA = stepsA.reduce((s, step) => s + this._tracker.getSummaryForStep(step).avgDurationMs, 0) / stepsA.length;
    const avgB = stepsB.reduce((s, step) => s + this._tracker.getSummaryForStep(step).avgDurationMs, 0) / stepsB.length;
    const maxMs = Math.max(avgA, avgB, 1);
    return clamp01(1 - Math.abs(avgA - avgB) / maxMs);
  }

  public rankStepsByDuration(): readonly TickStep[] {
    return [...TICK_SEQUENCE].sort((a, b) => {
      const aAvg = this._tracker.getSummaryForStep(a).avgDurationMs;
      const bAvg = this._tracker.getSummaryForStep(b).avgDurationMs;
      return bAvg - aAvg;
    });
  }

  public getDurationRankForStep(step: TickStep): number {
    const ranked = this.rankStepsByDuration();
    const idx = ranked.indexOf(step);
    return idx === -1 ? 0 : idx / Math.max(1, ranked.length - 1);
  }

  public computeSequenceHealthScore(): number {
    const summaries = TICK_SEQUENCE.map(s => this._tracker.getSummaryForStep(s));
    if (summaries.every(s => s.sampleCount === 0)) return 1;
    const populated = summaries.filter(s => s.sampleCount > 0);
    const avgErrorRate = populated.reduce((s, p) => s + (1 - p.successRate), 0) / populated.length;
    const avgBudgetRate = populated.reduce((s, p) => s + p.overBudgetRate, 0) / populated.length;
    return clamp01(1 - avgErrorRate * 0.6 - avgBudgetRate * 0.4);
  }

  public getStepsSinceLastError(): Readonly<Partial<Record<TickStep, number>>> {
    const recent = this._tracker.getRecentRecords(64);
    const result: Partial<Record<TickStep, number>> = {};
    for (const step of TICK_SEQUENCE) {
      let count = 0;
      for (let i = recent.length - 1; i >= 0; i--) {
        const r = recent[i];
        if (r.step === step) {
          if (r.status === 'ERROR') break;
          count++;
        }
      }
      result[step] = count;
    }
    return result;
  }
}

// ============================================================================
// MARK: TickPhaseAnalyzer — phase-level timing analysis
// ============================================================================

/**
 * Aggregates step performance by phase to produce phase-level timing summaries
 * and detect phase-boundary slowdowns.
 */
export class TickPhaseAnalyzer {
  private readonly _tracker: TickStepTimingTracker;

  public constructor(tracker: TickStepTimingTracker) {
    this._tracker = tracker;
  }

  public summarizePhase(phase: TickStepPhase): TickPhaseTimingSummary {
    const steps = getStepsForPhase(phase);
    const summaries = steps.map(s => this._tracker.getSummaryForStep(s));
    const populated = summaries.filter(s => s.sampleCount > 0);
    if (populated.length === 0) {
      return {
        phase, steps,
        totalDurationMs: 0, avgDurationMs: 0,
        slowestStep: null, fastestStep: null,
        errorCount: 0, completionRate: 0,
      };
    }
    const total = populated.reduce((s, p) => s + p.avgDurationMs, 0);
    const sorted = [...populated].sort((a, b) => b.avgDurationMs - a.avgDurationMs);
    return {
      phase,
      steps,
      totalDurationMs: total,
      avgDurationMs: total / populated.length,
      slowestStep: sorted[0]?.step ?? null,
      fastestStep: sorted[sorted.length - 1]?.step ?? null,
      errorCount: populated.reduce((s, p) => s + p.errorCount, 0),
      completionRate: populated.length / steps.length,
    };
  }

  public summarizeAllPhases(): Readonly<Record<TickStepPhase, TickPhaseTimingSummary>> {
    return Object.freeze(
      TICK_PHASE_ORDER.reduce<Record<TickStepPhase, TickPhaseTimingSummary>>(
        (acc, phase) => { acc[phase] = this.summarizePhase(phase); return acc; },
        {} as Record<TickStepPhase, TickPhaseTimingSummary>,
      ),
    );
  }

  public getSlowestPhase(): TickStepPhase | null {
    let slowest: TickStepPhase | null = null;
    let maxAvg = 0;
    for (const phase of TICK_PHASE_ORDER) {
      const summary = this.summarizePhase(phase);
      if (summary.avgDurationMs > maxAvg) {
        maxAvg = summary.avgDurationMs;
        slowest = phase;
      }
    }
    return slowest;
  }

  public getPhaseAvgDuration(phase: TickStepPhase): number {
    return this.summarizePhase(phase).avgDurationMs;
  }

  public computePhaseLoad(): Readonly<Record<TickStepPhase, number>> {
    const summaries = this.summarizeAllPhases();
    const total = TICK_PHASE_ORDER.reduce((s, p) => s + summaries[p].totalDurationMs, 0);
    if (total === 0) {
      return Object.freeze(TICK_PHASE_ORDER.reduce<Record<TickStepPhase, number>>(
        (acc, p) => { acc[p] = 0; return acc; },
        {} as Record<TickStepPhase, number>,
      ));
    }
    return Object.freeze(TICK_PHASE_ORDER.reduce<Record<TickStepPhase, number>>(
      (acc, p) => { acc[p] = summaries[p].totalDurationMs / total; return acc; },
      {} as Record<TickStepPhase, number>,
    ));
  }
}

// ============================================================================
// MARK: TickSequenceMLVectorBuilder — 32-feature ML vector
// ============================================================================

/**
 * Builds the canonical 32-feature ML vector from step timing data.
 * All 32 features are defined in TICK_ML_FEATURE_LABELS.
 */
export class TickSequenceMLVectorBuilder {
  private readonly _tracker: TickStepTimingTracker;
  private readonly _analyzer: TickStepAnalyzer;
  private readonly _phaseAnalyzer: TickPhaseAnalyzer;

  public constructor(
    tracker: TickStepTimingTracker,
    analyzer: TickStepAnalyzer,
    phaseAnalyzer: TickPhaseAnalyzer,
  ) {
    this._tracker = tracker;
    this._analyzer = analyzer;
    this._phaseAnalyzer = phaseAnalyzer;
  }

  public build(
    step: TickStep,
    tick: number,
    runId: string,
    currentDurationMs = 0,
    completedSteps: readonly TickStep[] = [],
  ): TickStepMLVector {
    const desc = TICK_STEP_DESCRIPTORS[step];
    const summary = this._tracker.getSummaryForStep(step);
    const budget = getStepBudgetMs(step);
    const phaseLoad = this._phaseAnalyzer.computePhaseLoad();
    const sinceError = this._analyzer.getStepsSinceLastError();
    const healthScore = this._analyzer.computeSequenceHealthScore();
    const anomalyScore = this._analyzer.computeAnomalyScore(step, currentDurationMs);
    const phaseCompletion = computePhaseCompletionRatio(desc.phase, completedSteps);
    const seqCompletion = computeSequenceCompletionRatio(completedSteps);
    const stepErrorRate = 1 - summary.successRate;
    const phaseSummary = this._phaseAnalyzer.summarizePhase(desc.phase);

    const features: number[] = [
      desc.ordinal / 13,                                                   // step_ordinal_norm
      desc.phase === 'ORCHESTRATION' ? 1 : 0,                             // is_orchestration_phase
      desc.phase === 'ENGINE' ? 1 : 0,                                    // is_engine_phase
      desc.phase === 'MODE' ? 1 : 0,                                      // is_mode_phase
      desc.phase === 'OBSERVABILITY' ? 1 : 0,                             // is_observability_phase
      desc.phase === 'FINALIZATION' ? 1 : 0,                              // is_finalization_phase
      desc.owner === 'system' ? 1 : 0,                                    // is_system_owner
      desc.owner === 'time' ? 1 : 0,                                      // is_time_owner
      desc.owner === 'pressure' ? 1 : 0,                                  // is_pressure_owner
      desc.owner === 'tension' ? 1 : 0,                                   // is_tension_owner
      desc.owner === 'battle' ? 1 : 0,                                    // is_battle_owner
      desc.owner === 'shield' ? 1 : 0,                                    // is_shield_owner
      desc.owner === 'cascade' ? 1 : 0,                                   // is_cascade_owner
      desc.owner === 'mode' ? 1 : 0,                                      // is_mode_owner
      desc.owner === 'telemetry' ? 1 : 0,                                 // is_telemetry_owner
      desc.owner === 'sovereignty' ? 1 : 0,                               // is_sovereignty_owner
      desc.mutatesState ? 1 : 0,                                          // mutates_state
      isEngineExecutionStep(step) ? 1 : 0,                                // is_engine_execution
      normMs(currentDurationMs),                                           // step_duration_norm
      normMs(summary.avgDurationMs),                                       // avg_step_duration_norm
      normMs(summary.maxDurationMs),                                       // max_step_duration_norm
      clamp01(stepErrorRate),                                              // step_error_rate
      clamp01(phaseCompletion),                                            // phase_completion_ratio
      clamp01(seqCompletion),                                              // sequence_completion_ratio
      currentDurationMs > budget * TICK_SLOW_STEP_MULTIPLIER ? 1 : 0,     // slow_step_flag
      normMs(this._tracker.errorCount, Math.max(1, this._tracker.totalRecords)), // recent_error_count_norm
      clamp01(summary.successRate),                                        // step_success_rate
      clamp01(healthScore),                                                // health_grade_numeric
      ENGINE_EXECUTION_STEPS.length / TICK_SEQUENCE.length,               // engine_execution_load_ratio
      clamp01(anomalyScore),                                               // anomaly_score
      clamp01((sinceError[step] ?? 0) / Math.max(1, this._tracker.totalTicks)), // step_since_last_error_norm
      clamp01(phaseSummary.errorCount / Math.max(1, phaseSummary.steps.length * this._tracker.totalTicks)), // phase_error_ratio
    ];

    return Object.freeze({
      tick,
      runId,
      step,
      features: Object.freeze(features),
      labels: TICK_ML_FEATURE_LABELS,
      featureCount: TICK_ML_FEATURE_COUNT,
      generatedAtMs: Date.now(),
    });
  }
}

// ============================================================================
// MARK: TickSequenceDLTensorBuilder — 48-feature DL tensor
// ============================================================================

/**
 * Builds the canonical 48-feature DL input tensor. Extends the 32 ML features
 * with 16 additional temporal and contextual features.
 */
export class TickSequenceDLTensorBuilder {
  private readonly _mlBuilder: TickSequenceMLVectorBuilder;
  private readonly _tracker: TickStepTimingTracker;
  private readonly _phaseAnalyzer: TickPhaseAnalyzer;
  private readonly _analyzer: TickStepAnalyzer;

  public constructor(
    mlBuilder: TickSequenceMLVectorBuilder,
    tracker: TickStepTimingTracker,
    phaseAnalyzer: TickPhaseAnalyzer,
    analyzer: TickStepAnalyzer,
  ) {
    this._mlBuilder = mlBuilder;
    this._tracker = tracker;
    this._phaseAnalyzer = phaseAnalyzer;
    this._analyzer = analyzer;
  }

  public build(
    step: TickStep,
    tick: number,
    runId: string,
    currentDurationMs = 0,
    completedSteps: readonly TickStep[] = [],
    runProgressRatio = 0,
  ): TickStepDLTensor {
    const mlVec = this._mlBuilder.build(step, tick, runId, currentDurationMs, completedSteps);
    const desc = TICK_STEP_DESCRIPTORS[step];
    const phaseLoad = this._phaseAnalyzer.computePhaseLoad();
    const prevStep = getPreviousTickStep(step);
    const nextStep = getNextTickStep(step);
    const prevDuration = prevStep ? this._tracker.getLastDurationForStep(prevStep) : 0;
    const ownerSteps = getStepsForOwner(desc.owner);
    const ownerSummaries = ownerSteps.map(s => this._tracker.getSummaryForStep(s));
    const ownerErrorRate = ownerSummaries.length === 0 ? 0 :
      ownerSummaries.reduce((s, p) => s + (1 - p.successRate), 0) / ownerSummaries.length;
    const budget = getStepBudgetMs(step);
    const budgetUtil = clamp01(currentDurationMs / budget);
    const durationRank = this._analyzer.getDurationRankForStep(step);
    const totalRecorded = this._tracker.totalRecords;
    const summary = this._tracker.getSummaryForStep(step);
    const cumulativeDuration = TICK_SEQUENCE
      .slice(0, TICK_INDEX_BY_STEP[step] + 1)
      .reduce((s, st) => s + this._tracker.getSummaryForStep(st).avgDurationMs, 0);
    const totalAvg = TICK_SEQUENCE.reduce((s, st) => s + this._tracker.getSummaryForStep(st).avgDurationMs, 0);

    const extended: number[] = [
      normMs(prevDuration),                                             // prev_step_duration_norm
      nextStep ? TICK_STEP_DESCRIPTORS[nextStep].ordinal / 13 : 1,     // next_step_ordinal_norm
      normMs(this._phaseAnalyzer.getPhaseAvgDuration('ORCHESTRATION')), // prev_phase_avg_duration_norm
      clamp01(phaseLoad['ORCHESTRATION']),                              // phase_orchestration_ratio
      clamp01(phaseLoad['ENGINE']),                                     // phase_engine_ratio
      clamp01(phaseLoad['MODE']),                                       // phase_mode_ratio
      clamp01(phaseLoad['OBSERVABILITY']),                              // phase_observability_ratio
      clamp01(phaseLoad['FINALIZATION']),                               // phase_finalization_ratio
      clamp01(totalRecorded / Math.max(1, this._tracker['_maxEntries'])), // tick_count_norm
      clamp01(runProgressRatio),                                        // run_progress_ratio
      clamp01(ownerSteps.length / TICK_SEQUENCE.length),               // owner_step_count_norm
      clamp01(ownerErrorRate),                                          // owner_error_rate
      clamp01(budgetUtil),                                              // budget_utilization
      clamp01(summary.successRate),                                     // chain_completion_score
      clamp01(durationRank),                                            // step_rank_by_duration_norm
      totalAvg === 0 ? 0 : clamp01(cumulativeDuration / totalAvg),     // cumulative_duration_ratio
    ];

    const data = [...mlVec.features, ...extended];

    return Object.freeze({
      tick,
      runId,
      step,
      shape: [1, 48] as const,
      data: Object.freeze(data),
      labels: TICK_DL_FEATURE_LABELS,
      featureCount: TICK_DL_FEATURE_COUNT,
      generatedAtMs: Date.now(),
    });
  }
}

// ============================================================================
// MARK: TickSequenceHealthMonitor — per-run sequence health grader
// ============================================================================

const HEALTH_GRADE_THRESHOLDS: readonly [TickSequenceHealthGrade, number][] = [
  ['S', 0.97],
  ['A', 0.92],
  ['B', 0.82],
  ['C', 0.65],
  ['D', 0.45],
  ['F', 0],
];

/**
 * Computes a letter-grade health report for the full tick sequence based on
 * error rates, duration budgets, and step success ratios.
 */
export class TickSequenceHealthMonitor {
  private readonly _tracker: TickStepTimingTracker;
  private readonly _analyzer: TickStepAnalyzer;
  private _lastGrade: TickSequenceHealthGrade = 'A';
  private _degradationCount = 0;
  private _recoveryCount = 0;

  public constructor(tracker: TickStepTimingTracker, analyzer: TickStepAnalyzer) {
    this._tracker = tracker;
    this._analyzer = analyzer;
  }

  public computeGrade(): TickSequenceHealthGrade {
    const score = this._analyzer.computeSequenceHealthScore();
    for (const [grade, threshold] of HEALTH_GRADE_THRESHOLDS) {
      if (score >= threshold) return grade;
    }
    return 'F';
  }

  public buildReport(): TickSequenceHealthReport {
    const grade = this.computeGrade();
    const slow = this._tracker.getSlowSteps();
    const recommendations: string[] = [];

    if (this._tracker.errorRate > 0.1) {
      recommendations.push('Error rate exceeds 10% — investigate step failure patterns.');
    }
    if (slow.length > 0) {
      recommendations.push(`Slow steps detected: ${slow.join(', ')} — review engine budget allocation.`);
    }
    if (grade === 'D' || grade === 'F') {
      recommendations.push('Critical sequence health — consider tick budget expansion or engine offloading.');
    }

    const allSummaries = TICK_SEQUENCE.map(s => this._tracker.getSummaryForStep(s));
    const populated = allSummaries.filter(s => s.sampleCount > 0);
    const avgDuration = populated.length === 0 ? 0 :
      populated.reduce((s, p) => s + p.avgDurationMs, 0) / populated.length;
    const healthyRatio = populated.length === 0 ? 1 :
      populated.filter(p => p.successRate >= 0.95 && !p.overBudgetRate).length / populated.length;

    return Object.freeze({
      grade,
      sampleCount: this._tracker.totalRecords,
      errorRate: this._tracker.errorRate,
      avgDurationMs: avgDuration,
      slowStepCount: slow.length,
      criticalErrors: this._tracker.errorCount,
      healthyStepRatio: clamp01(healthyRatio),
      overBudgetRate: populated.length === 0 ? 0 :
        populated.reduce((s, p) => s + p.overBudgetRate, 0) / populated.length,
      recommendations: Object.freeze(recommendations),
      generatedAtMs: Date.now(),
    });
  }

  public observe(grade: TickSequenceHealthGrade): void {
    const passing = (g: TickSequenceHealthGrade) => g === 'S' || g === 'A' || g === 'B';
    if (passing(this._lastGrade) && !passing(grade)) this._degradationCount++;
    if (!passing(this._lastGrade) && passing(grade)) this._recoveryCount++;
    this._lastGrade = grade;
  }

  public get lastGrade(): TickSequenceHealthGrade { return this._lastGrade; }
  public get degradationCount(): number { return this._degradationCount; }
  public get recoveryCount(): number { return this._recoveryCount; }

  public reset(): void {
    this._lastGrade = 'A';
    this._degradationCount = 0;
    this._recoveryCount = 0;
  }
}

// ============================================================================
// MARK: TickSequenceChatSignalGenerator — chat signal production
// ============================================================================

/**
 * Generates structured chat signals from tick sequence events.
 * Used by the TickSequenceSignalAdapter to produce backend-chat ingress.
 */
export class TickSequenceChatSignalGenerator {
  private readonly _monitor: TickSequenceHealthMonitor;
  private readonly _tracker: TickStepTimingTracker;
  private readonly _analyzer: TickStepAnalyzer;
  private _lastEmittedGrade: TickSequenceHealthGrade | null = null;

  public constructor(
    monitor: TickSequenceHealthMonitor,
    tracker: TickStepTimingTracker,
    analyzer: TickStepAnalyzer,
  ) {
    this._monitor = monitor;
    this._tracker = tracker;
    this._analyzer = analyzer;
  }

  public signalForStepCompleted(
    step: TickStep,
    tick: number,
    runId: string,
    durationMs: number,
  ): TickSequenceChatSignalEnvelope | null {
    const desc = TICK_STEP_DESCRIPTORS[step];
    const budget = getStepBudgetMs(step);
    const overBudget = durationMs > budget * TICK_SLOW_STEP_MULTIPLIER;
    if (!overBudget) return null; // suppress routine completions

    return this._buildEnvelope({
      surface: 'tick_sequence',
      kind: 'SLOW_STEP_DETECTED',
      tick,
      runId,
      step,
      phase: desc.phase,
      owner: desc.owner,
      severity: 'warn',
      message: `Step ${step} completed in ${durationMs.toFixed(1)}ms (budget: ${budget}ms × ${TICK_SLOW_STEP_MULTIPLIER} = ${budget * TICK_SLOW_STEP_MULTIPLIER}ms)`,
      durationMs,
      budgetMs: budget,
      errorMessage: null,
      healthGrade: null,
      anomalyScore: this._analyzer.computeAnomalyScore(step, durationMs),
      stepSuccessRate: this._tracker.getSummaryForStep(step).successRate,
      sequenceCompletionRatio: null,
    });
  }

  public signalForStepErrored(
    step: TickStep,
    tick: number,
    runId: string,
    errorMessage: string,
    durationMs: number,
  ): TickSequenceChatSignalEnvelope {
    const desc = TICK_STEP_DESCRIPTORS[step];
    return this._buildEnvelope({
      surface: 'tick_sequence',
      kind: 'STEP_ERRORED',
      tick,
      runId,
      step,
      phase: desc.phase,
      owner: desc.owner,
      severity: 'error',
      message: `Step ${step} failed: ${errorMessage}`,
      durationMs,
      budgetMs: getStepBudgetMs(step),
      errorMessage,
      healthGrade: this._monitor.computeGrade(),
      anomalyScore: 1,
      stepSuccessRate: this._tracker.getSummaryForStep(step).successRate,
      sequenceCompletionRatio: null,
    });
  }

  public signalForPhaseCompleted(
    phase: TickStepPhase,
    tick: number,
    runId: string,
    completedSteps: readonly TickStep[],
    totalDurationMs: number,
  ): TickSequenceChatSignalEnvelope | null {
    if (phase !== 'FINALIZATION') return null; // only signal at finalization boundary
    const representative = getStepsForPhase(phase)[0] ?? 'STEP_11_OUTCOME_GATE';
    const desc = TICK_STEP_DESCRIPTORS[representative];
    return this._buildEnvelope({
      surface: 'tick_sequence',
      kind: 'PHASE_COMPLETED',
      tick,
      runId,
      step: representative,
      phase,
      owner: desc.owner,
      severity: 'info',
      message: `Phase ${phase} completed in ${totalDurationMs.toFixed(1)}ms — ${completedSteps.length} steps`,
      durationMs: totalDurationMs,
      budgetMs: TICK_PHASE_BUDGET_MS,
      errorMessage: null,
      healthGrade: this._monitor.computeGrade(),
      anomalyScore: null,
      stepSuccessRate: null,
      sequenceCompletionRatio: computeSequenceCompletionRatio(completedSteps),
    });
  }

  public signalForHealthChange(
    tick: number,
    runId: string,
    currentGrade: TickSequenceHealthGrade,
  ): TickSequenceChatSignalEnvelope | null {
    const passing = (g: TickSequenceHealthGrade) => g === 'S' || g === 'A' || g === 'B';
    const wasPassing = this._lastEmittedGrade !== null ? passing(this._lastEmittedGrade) : true;
    const nowPassing = passing(currentGrade);

    let kind: TickSequenceChatSignalKind | null = null;
    if (wasPassing && !nowPassing) kind = 'HEALTH_DEGRADED';
    if (!wasPassing && nowPassing) kind = 'HEALTH_RECOVERED';
    if (!kind) return null;

    this._lastEmittedGrade = currentGrade;
    const severity = nowPassing ? 'info' : (currentGrade === 'D' || currentGrade === 'F' ? 'error' : 'warn');

    return this._buildEnvelope({
      surface: 'tick_sequence',
      kind,
      tick,
      runId,
      step: 'STEP_09_TELEMETRY',
      phase: 'OBSERVABILITY',
      owner: 'telemetry',
      severity,
      message: `Tick sequence health ${kind === 'HEALTH_DEGRADED' ? 'degraded' : 'recovered'}: grade ${currentGrade}`,
      durationMs: null,
      budgetMs: null,
      errorMessage: null,
      healthGrade: currentGrade,
      anomalyScore: null,
      stepSuccessRate: null,
      sequenceCompletionRatio: null,
    });
  }

  public signalForMLVectorReady(
    step: TickStep,
    tick: number,
    runId: string,
    mlVector: TickStepMLVector,
  ): TickSequenceChatSignalEnvelope {
    const desc = TICK_STEP_DESCRIPTORS[step];
    return this._buildEnvelope({
      surface: 'tick_sequence',
      kind: 'ML_VECTOR_READY',
      tick,
      runId,
      step,
      phase: desc.phase,
      owner: desc.owner,
      severity: 'info',
      message: `ML vector ready for step ${step} (${TICK_ML_FEATURE_COUNT} features)`,
      durationMs: null,
      budgetMs: null,
      errorMessage: null,
      healthGrade: null,
      anomalyScore: mlVector.features[29] ?? null,
      stepSuccessRate: null,
      sequenceCompletionRatio: null,
    });
  }

  private _buildEnvelope(payload: TickSequenceChatSignalPayload): TickSequenceChatSignalEnvelope {
    const now = Date.now();
    return Object.freeze({
      signalId: createDeterministicId(
        'tick-seq-signal',
        payload.runId,
        payload.tick,
        payload.step,
        payload.kind,
        now,
      ),
      payload: Object.freeze(payload),
      emittedAtMs: now,
      dedupeKey: checksumParts(
        payload.runId,
        payload.tick,
        payload.step,
        payload.kind,
        payload.severity,
      ),
    });
  }

  public reset(): void {
    this._lastEmittedGrade = null;
  }
}

// ============================================================================
// MARK: TickSequenceDiagnosticsService — full per-run diagnostics
// ============================================================================

/**
 * Aggregates timing tracker, analyzer, phase analyzer, and health monitor into
 * a single diagnostics surface for observability and chat telemetry pipelines.
 */
export class TickSequenceDiagnosticsService {
  private readonly _tracker: TickStepTimingTracker;
  private readonly _analyzer: TickStepAnalyzer;
  private readonly _phaseAnalyzer: TickPhaseAnalyzer;
  private readonly _monitor: TickSequenceHealthMonitor;
  private readonly _capacity: number;
  private readonly _snapshots: TickSequenceDiagnosticsSnapshot[] = [];

  public constructor(
    tracker: TickStepTimingTracker,
    analyzer: TickStepAnalyzer,
    phaseAnalyzer: TickPhaseAnalyzer,
    monitor: TickSequenceHealthMonitor,
    capacity = 60,
  ) {
    this._tracker = tracker;
    this._analyzer = analyzer;
    this._phaseAnalyzer = phaseAnalyzer;
    this._monitor = monitor;
    this._capacity = Math.max(1, capacity);
  }

  public capture(tick: number, runId: string, mlVector: TickStepMLVector | null = null): TickSequenceDiagnosticsSnapshot {
    const grade = this._monitor.computeGrade();
    this._monitor.observe(grade);

    const allSummaries = this._tracker.getAllSummaries();
    const phaseTimings: Partial<Record<TickStepPhase, number>> = {};
    for (const phase of TICK_PHASE_ORDER) {
      phaseTimings[phase] = this._phaseAnalyzer.getPhaseAvgDuration(phase);
    }

    let slowestStep: TickStep | null = null;
    let slowestAvg = 0;
    let mostErrorStep: TickStep | null = null;
    let mostErrors = 0;

    for (const step of TICK_SEQUENCE) {
      const s = allSummaries[step];
      if (!s) continue;
      if (s.avgDurationMs > slowestAvg) { slowestAvg = s.avgDurationMs; slowestStep = step; }
      if (s.errorCount > mostErrors) { mostErrors = s.errorCount; mostErrorStep = step; }
    }

    const stats: TickSequenceStats = Object.freeze({
      totalStepsRecorded: this._tracker.totalRecords,
      totalErrorsRecorded: this._tracker.errorCount,
      overallSuccessRate: clamp01(1 - this._tracker.errorRate),
      avgTickDurationMs: TICK_SEQUENCE.reduce((s, step) => {
        return s + (allSummaries[step]?.avgDurationMs ?? 0);
      }, 0),
      slowestStep,
      mostFrequentError: mostErrorStep,
      phaseTimings: Object.freeze(phaseTimings),
      stepSummaries: Object.freeze(allSummaries),
      capturedAtMs: Date.now(),
    });

    const slowSteps = this._tracker.getSlowSteps();
    const anomalySteps = this._analyzer.detectSlowSequence();
    const recentAnomalies = anomalySteps.map(s =>
      `${s} anomaly score: ${this._analyzer.computeAnomalyScore(s, allSummaries[s]?.avgDurationMs ?? 0).toFixed(3)}`
    );

    const snapshot: TickSequenceDiagnosticsSnapshot = Object.freeze({
      tick,
      runId,
      healthGrade: grade,
      stats,
      recentAnomalies: Object.freeze(recentAnomalies),
      slowSteps: Object.freeze(slowSteps),
      mlVector,
      capturedAtMs: Date.now(),
    });

    this._snapshots.push(snapshot);
    if (this._snapshots.length > this._capacity) this._snapshots.shift();
    return snapshot;
  }

  public getLastSnapshot(): TickSequenceDiagnosticsSnapshot | null {
    return this._snapshots[this._snapshots.length - 1] ?? null;
  }

  public getRecentSnapshots(n: number): readonly TickSequenceDiagnosticsSnapshot[] {
    return this._snapshots.slice(Math.max(0, this._snapshots.length - n));
  }

  public buildHealthSummary(): Readonly<{
    currentGrade: TickSequenceHealthGrade;
    degradationCount: number;
    recoveryCount: number;
    slowStepCount: number;
    totalStepsRecorded: number;
  }> {
    return Object.freeze({
      currentGrade: this._monitor.computeGrade(),
      degradationCount: this._monitor.degradationCount,
      recoveryCount: this._monitor.recoveryCount,
      slowStepCount: this._tracker.getSlowSteps().length,
      totalStepsRecorded: this._tracker.totalRecords,
    });
  }

  public reset(): void {
    this._snapshots.length = 0;
    this._tracker.reset();
    this._monitor.reset();
  }
}

// ============================================================================
// MARK: TickSequenceFacade — authoritative high-level entry point
// ============================================================================

export interface TickSequenceFacadeOptions {
  readonly maxTimingHistory?: number;
  readonly diagnosticsCapacity?: number;
}

export interface TickSequenceFacadeTickInput {
  readonly tick: number;
  readonly runId: string;
  readonly step: TickStep;
  readonly durationMs: number;
  readonly status: 'OK' | 'ERROR' | 'SKIPPED';
  readonly errorMessage?: string | null;
  readonly completedSteps?: readonly TickStep[];
  readonly runProgressRatio?: number;
}

export interface TickSequenceFacadeTickResult {
  readonly mlVector: TickStepMLVector;
  readonly dlTensor: TickStepDLTensor;
  readonly chatSignals: readonly TickSequenceChatSignalEnvelope[];
  readonly healthGrade: TickSequenceHealthGrade;
  readonly isAnomaly: boolean;
  readonly anomalyScore: number;
}

/**
 * The authoritative facade for tick sequence analytics. All ML/DL vector
 * production, timing tracking, health monitoring, and chat signal generation
 * flow through this class.
 */
export class TickSequenceFacade {
  private readonly _tracker: TickStepTimingTracker;
  private readonly _analyzer: TickStepAnalyzer;
  private readonly _phaseAnalyzer: TickPhaseAnalyzer;
  private readonly _mlBuilder: TickSequenceMLVectorBuilder;
  private readonly _dlBuilder: TickSequenceDLTensorBuilder;
  private readonly _monitor: TickSequenceHealthMonitor;
  private readonly _signalGen: TickSequenceChatSignalGenerator;
  private readonly _diagnostics: TickSequenceDiagnosticsService;

  public constructor(options: TickSequenceFacadeOptions = {}) {
    this._tracker = new TickStepTimingTracker(options.maxTimingHistory);
    this._analyzer = new TickStepAnalyzer(this._tracker);
    this._phaseAnalyzer = new TickPhaseAnalyzer(this._tracker);
    this._mlBuilder = new TickSequenceMLVectorBuilder(this._tracker, this._analyzer, this._phaseAnalyzer);
    this._dlBuilder = new TickSequenceDLTensorBuilder(this._mlBuilder, this._tracker, this._phaseAnalyzer, this._analyzer);
    this._monitor = new TickSequenceHealthMonitor(this._tracker, this._analyzer);
    this._signalGen = new TickSequenceChatSignalGenerator(this._monitor, this._tracker, this._analyzer);
    this._diagnostics = new TickSequenceDiagnosticsService(
      this._tracker, this._analyzer, this._phaseAnalyzer, this._monitor,
      options.diagnosticsCapacity,
    );
  }

  public processTick(input: TickSequenceFacadeTickInput): TickSequenceFacadeTickResult {
    const desc = TICK_STEP_DESCRIPTORS[input.step];
    const startedAtMs = Date.now() - input.durationMs;
    const budget = getStepBudgetMs(input.step);

    const record: TickStepTimingRecord = Object.freeze({
      step: input.step,
      tick: input.tick,
      runId: input.runId,
      startedAtMs,
      finishedAtMs: Date.now(),
      durationMs: input.durationMs,
      phase: desc.phase,
      owner: desc.owner,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      budgetMs: budget,
      overBudget: input.durationMs > budget,
    });

    this._tracker.record(record);
    if (input.step === 'STEP_13_FLUSH') this._tracker.recordTick();

    const completedSteps = input.completedSteps ?? [];
    const mlVector = this._mlBuilder.build(
      input.step, input.tick, input.runId, input.durationMs, completedSteps,
    );
    const dlTensor = this._dlBuilder.build(
      input.step, input.tick, input.runId, input.durationMs,
      completedSteps, input.runProgressRatio ?? 0,
    );

    const signals: TickSequenceChatSignalEnvelope[] = [];

    if (input.status === 'ERROR' && input.errorMessage) {
      signals.push(this._signalGen.signalForStepErrored(
        input.step, input.tick, input.runId, input.errorMessage, input.durationMs,
      ));
    } else {
      const slowSig = this._signalGen.signalForStepCompleted(
        input.step, input.tick, input.runId, input.durationMs,
      );
      if (slowSig) signals.push(slowSig);
    }

    const healthGrade = this._monitor.computeGrade();
    const healthSig = this._signalGen.signalForHealthChange(input.tick, input.runId, healthGrade);
    if (healthSig) signals.push(healthSig);

    if (input.step === 'STEP_13_FLUSH') {
      const phaseSig = this._signalGen.signalForPhaseCompleted(
        'FINALIZATION', input.tick, input.runId, completedSteps, input.durationMs,
      );
      if (phaseSig) signals.push(phaseSig);
    }

    const anomalyScore = this._analyzer.computeAnomalyScore(input.step, input.durationMs);

    if (anomalyScore > TICK_ANOMALY_THRESHOLD) {
      const mlSig = this._signalGen.signalForMLVectorReady(
        input.step, input.tick, input.runId, mlVector,
      );
      signals.push(mlSig);
    }

    return Object.freeze({
      mlVector,
      dlTensor,
      chatSignals: Object.freeze(signals),
      healthGrade,
      isAnomaly: anomalyScore > TICK_ANOMALY_THRESHOLD,
      anomalyScore,
    });
  }

  public getDiagnostics(tick: number, runId: string): TickSequenceDiagnosticsSnapshot {
    const mlVector = this._mlBuilder.build('STEP_09_TELEMETRY', tick, runId, 0);
    return this._diagnostics.capture(tick, runId, mlVector);
  }

  public buildHealthReport(): TickSequenceHealthReport {
    return this._monitor.buildReport();
  }

  public getStats(): TickSequenceStats {
    const snap = this._diagnostics.capture(0, 'stats-snapshot');
    return snap.stats;
  }

  public validateSequence(sequence?: readonly TickStep[]): boolean {
    try {
      assertValidTickSequence(sequence);
      return true;
    } catch {
      return false;
    }
  }

  public resetRun(): void {
    this._diagnostics.reset();
    this._signalGen.reset();
  }
}

// ============================================================================
// MARK: Utility export functions
// ============================================================================

/**
 * Build a full tick step summary from a batch of timing records.
 */
export function buildTickStepSummary(
  records: readonly TickStepTimingRecord[],
): Readonly<Partial<Record<TickStep, TickStepPerformanceSummary>>> {
  const tmp = new TickStepTimingTracker(records.length + 1);
  for (const r of records) tmp.record(r);
  return tmp.getAllSummaries();
}

/**
 * Build a tick sequence stats object from a tracker.
 */
export function buildTickSequenceStats(tracker: TickStepTimingTracker): TickSequenceStats {
  const allSummaries = tracker.getAllSummaries();
  const phaseTimings: Partial<Record<TickStepPhase, number>> = {};
  for (const phase of TICK_PHASE_ORDER) {
    const steps = getStepsForPhase(phase);
    phaseTimings[phase] = steps.reduce((s, st) => s + (allSummaries[st]?.avgDurationMs ?? 0), 0);
  }

  let slowestStep: TickStep | null = null;
  let slowestAvg = 0;
  let mostErrorStep: TickStep | null = null;
  let mostErrors = 0;

  for (const step of TICK_SEQUENCE) {
    const s = allSummaries[step];
    if (!s) continue;
    if (s.avgDurationMs > slowestAvg) { slowestAvg = s.avgDurationMs; slowestStep = step; }
    if (s.errorCount > mostErrors) { mostErrors = s.errorCount; mostErrorStep = step; }
  }

  return Object.freeze({
    totalStepsRecorded: tracker.totalRecords,
    totalErrorsRecorded: tracker.errorCount,
    overallSuccessRate: clamp01(1 - tracker.errorRate),
    avgTickDurationMs: Object.values(phaseTimings).reduce((s, v) => s + (v ?? 0), 0),
    slowestStep,
    mostFrequentError: mostErrorStep,
    phaseTimings: Object.freeze(phaseTimings),
    stepSummaries: Object.freeze(allSummaries),
    capturedAtMs: Date.now(),
  });
}

/**
 * Returns diagnostic label metadata for external tooling.
 */
export function getTickSequenceDiagnosticLabels(): Readonly<{
  mlFeatureCount: number;
  dlFeatureCount: number;
  mlLabels: readonly string[];
  dlLabels: readonly string[];
  stepCount: number;
  phaseCount: number;
  ownerCount: number;
  moduleVersion: string;
}> {
  return Object.freeze({
    mlFeatureCount: TICK_ML_FEATURE_COUNT,
    dlFeatureCount: TICK_DL_FEATURE_COUNT,
    mlLabels: TICK_ML_FEATURE_LABELS,
    dlLabels: TICK_DL_FEATURE_LABELS,
    stepCount: TICK_SEQUENCE.length,
    phaseCount: TICK_PHASE_ORDER.length,
    ownerCount: TICK_OWNER_ORDER.length,
    moduleVersion: TICK_SEQUENCE_MODULE_VERSION,
  });
}

/**
 * Creates a fully-frozen snapshot of a timing record for safe sharing.
 */
export function freezeTimingRecord(record: TickStepTimingRecord): TickStepTimingRecord {
  return deepFreeze(cloneJson(record)) as TickStepTimingRecord;
}

/**
 * Grades a sequence health score (0-1) into a letter grade.
 */
export function gradeTickSequenceHealth(score: number): TickSequenceHealthGrade {
  for (const [grade, threshold] of HEALTH_GRADE_THRESHOLDS) {
    if (score >= threshold) return grade;
  }
  return 'F';
}

/**
 * Computes the aggregate phase load from a set of performance summaries.
 */
export function computePhaseLoad(
  summaries: Readonly<Partial<Record<TickStep, TickStepPerformanceSummary>>>,
): Readonly<Record<TickStepPhase, number>> {
  const totals: Record<TickStepPhase, number> = {
    ORCHESTRATION: 0, ENGINE: 0, MODE: 0, OBSERVABILITY: 0, FINALIZATION: 0,
  };
  for (const step of TICK_SEQUENCE) {
    const s = summaries[step];
    if (!s) continue;
    totals[TICK_STEP_DESCRIPTORS[step].phase] += s.avgDurationMs;
  }
  const grand = Object.values(totals).reduce((s, v) => s + v, 0);
  if (grand === 0) return Object.freeze(totals);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(totals).map(([k, v]) => [k, v / grand]),
    ) as Record<TickStepPhase, number>,
  );
}

// ============================================================================
// MARK: createTickSequenceFacade — convenience factory
// ============================================================================

export function createTickSequenceFacade(options: TickSequenceFacadeOptions = {}): TickSequenceFacade {
  return new TickSequenceFacade(options);
}

// ============================================================================
// MARK: Module manifest and footer constants
// ============================================================================

export const TICK_SEQUENCE_COMPLETE = true as const;
export const TICK_SEQUENCE_HEALTH_GRADE_THRESHOLDS = Object.freeze(
  HEALTH_GRADE_THRESHOLDS.map(([grade, threshold]) => ({ grade, threshold })),
);

export const TICK_SEQUENCE_MODULE_EXPORTS = Object.freeze([
  'TICK_SEQUENCE',
  'ENGINE_EXECUTION_STEPS',
  'TICK_STEP_DESCRIPTORS',
  'TICK_STEPS_BY_PHASE',
  'TICK_STEPS_BY_OWNER',
  'TICK_PHASE_ORDER',
  'TICK_OWNER_ORDER',
  'TICK_ML_FEATURE_LABELS',
  'TICK_DL_FEATURE_LABELS',
  'TickStepTimingTracker',
  'TickStepAnalyzer',
  'TickPhaseAnalyzer',
  'TickSequenceMLVectorBuilder',
  'TickSequenceDLTensorBuilder',
  'TickSequenceHealthMonitor',
  'TickSequenceChatSignalGenerator',
  'TickSequenceDiagnosticsService',
  'TickSequenceFacade',
]);

// Run validation at module load — any sequence tamper fails immediately
assertValidTickSequence();

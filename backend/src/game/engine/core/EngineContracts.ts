/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/EngineContracts.ts
 *
 * Doctrine:
 * - backend is the authoritative simulation surface
 * - engines remain sovereign, step-scoped, and immutable at the boundary
 * - time ownership is delegated to Engine 1 during STEP_02_TIME
 * - all cross-engine coordination flows through the EventBus + TickContext
 * - runtime helpers here must stay deterministic and side-effect free
 *
 * Surface summary:
 *   § 1  — Core types: EngineId, health, severity, signals, TickContext
 *   § 2  — SimulationEngine + ModeLifecycleHooks interfaces
 *   § 3  — EngineSignal factory helpers
 *   § 4  — EngineStepPolicy — per-step run gating and configuration
 *   § 5  — EngineStepMetrics — per-step timing and signal accounting
 *   § 6  — EngineSignalAggregator — collects all signals across engines
 *   § 7  — EngineMLSignal — ML-enriched signal type + scoring
 *   § 8  — EngineContractValidator — invariant checking for engines
 *   § 9  — ModeHookRegistry — registry + dispatch for mode lifecycle hooks
 *   § 10 — TickContextBuilder — constructs TickContext for each step
 *   § 11 — EngineStepRouter — orchestrates engine execution across a step
 *   § 12 — EngineHealthMonitor — tracks health history + trend analysis
 *   § 13 — EngineSignalRouter — fan-out signal dispatch to bus + subscribers
 *   § 14 — EngineStepTimer — high-res per-step timing instrumentation
 *   § 15 — EngineRosterValidator — validates engine roster for a given mode
 *   § 16 — EngineTickOrchestrationPlan — full plan for a tick run
 *   § 17 — EngineContractsMLVector + ENGINE_CONTRACT_ML_FEATURE_LABELS
 */

import type { ClockSource } from './ClockSource';
import type { EventBus } from './EventBus';
import type { EngineEventMap, ModeCode } from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import type { TickStep } from './TickSequence';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Core types
// ─────────────────────────────────────────────────────────────────────────────

/** The 7 simulation engines that execute every tick. */
export type EngineId =
  | 'time'
  | 'pressure'
  | 'tension'
  | 'shield'
  | 'battle'
  | 'cascade'
  | 'sovereignty';

export const ALL_ENGINE_IDS: readonly EngineId[] = [
  'time',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
] as const;

/** Ordered execution slots per TickStep. Each engine can be included 0–1 times. */
export const ENGINE_STEP_SLOTS: Record<TickStep, readonly (EngineId | 'mode')[]> = {
  STEP_01_PREPARE:     ['mode'],
  STEP_02_TIME:        ['time'],
  STEP_03_PRESSURE:    ['pressure'],
  STEP_04_TENSION:     ['tension'],
  STEP_05_BATTLE:               ['battle'],
  STEP_06_SHIELD:               ['shield'],
  STEP_07_CASCADE:              ['cascade'],
  STEP_08_MODE_POST:            ['mode'],
  STEP_09_TELEMETRY:            ['mode'],
  STEP_10_SOVEREIGNTY_SNAPSHOT: ['sovereignty'],
  STEP_11_OUTCOME_GATE:         ['mode'],
  STEP_12_EVENT_SEAL:           ['mode'],
  STEP_13_FLUSH:                ['mode'],
};

export type EngineHealthStatus = 'HEALTHY' | 'DEGRADED' | 'FAILED';
export type EngineSignalSeverity = 'INFO' | 'WARN' | 'ERROR';

/** Functional category for an engine signal. */
export type EngineSignalCategory =
  | 'tick'
  | 'state_mutation'
  | 'boundary_event'
  | 'error'
  | 'ml_emit'
  | 'mode_hook'
  | 'health_change'
  | 'contract_violation'
  | 'timing';

export interface EngineSignal {
  readonly engineId: EngineId | 'mode';
  readonly severity: EngineSignalSeverity;
  readonly code: string;
  readonly message: string;
  readonly tick: number;
  readonly tags?: readonly string[];
  readonly category?: EngineSignalCategory;
  readonly stepMs?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface TickTrace {
  readonly runId: string;
  readonly tick: number;
  readonly step: TickStep;
  readonly mode: ModeCode;
  readonly phase: RunStateSnapshot['phase'];
  readonly traceId: string;
}

export interface TickContext {
  readonly step: TickStep;
  readonly nowMs: number;
  readonly clock: ClockSource;
  readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
  readonly trace: TickTrace;
}

export interface EngineHealth {
  readonly engineId: EngineId;
  readonly status: EngineHealthStatus;
  readonly updatedAt: number;
  readonly notes?: readonly string[];
  readonly consecutiveFailures?: number;
  readonly lastSuccessfulTick?: number;
}

export interface EngineTickResult {
  readonly snapshot: RunStateSnapshot;
  readonly signals?: readonly EngineSignal[];
  readonly stepMs?: number;
  readonly engineId?: EngineId;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — SimulationEngine + ModeLifecycleHooks
// ─────────────────────────────────────────────────────────────────────────────

export interface ModeLifecycleHooks {
  readonly mode: ModeCode;

  /**
   * Mode-specific bootstrap mutations before the first tick is run.
   * Used for:
   * - solo loadouts / handicaps / disabled bots
   * - pvp shared-deck setup
   * - coop treasury / role assignment / trust scaffolding
   * - ghost marker hydration / legend gap state
   */
  initialize(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot;

  /**
   * Optional pre-step hook. Lets a mode mutate runtime state before an engine step.
   * Example: open PHZ windows at phase boundaries before card legality is checked.
   */
  beforeStep?(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot;

  /**
   * Optional post-step hook. Lets a mode react after a specific engine step.
   * Example: PvP extraction cooldown trimming after battle step.
   */
  afterStep?(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot;

  /**
   * End-of-tick reconciliation for mode-native rules.
   * Example: solo isolation tax, coop trust updates, ghost divergence gap drift.
   */
  finalizeTick?(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot;
}

export interface SimulationEngine {
  readonly engineId: EngineId;

  /** Clears volatile runtime state for replay, test harnesses, or hot reset. */
  reset(): void;

  /**
   * Lightweight gate for engines that should skip work for a particular
   * step, mode, or terminal outcome.
   */
  canRun?(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): boolean;

  /**
   * Executes one engine slice for one step.
   * The engine must treat the snapshot as immutable input and return
   * a fresh snapshot or a normalized EngineTickResult payload.
   */
  tick(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot | EngineTickResult;

  /** Returns health visible to orchestration / diagnostics surfaces. */
  getHealth(): EngineHealth;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — EngineSignal factory helpers + normalization
// ─────────────────────────────────────────────────────────────────────────────

export function createEngineHealth(
  engineId: EngineId,
  status: EngineHealthStatus,
  updatedAt: number,
  notes: readonly string[] = [],
): EngineHealth {
  return { engineId, status, updatedAt, notes };
}

export function createEngineSignal(
  engineId: EngineId | 'mode',
  severity: EngineSignalSeverity,
  code: string,
  message: string,
  tick: number,
  tags: readonly string[] = [],
): EngineSignal {
  return { engineId, severity, code, message, tick, tags };
}

export function createEngineSignalFull(
  engineId: EngineId | 'mode',
  severity: EngineSignalSeverity,
  code: string,
  message: string,
  tick: number,
  category: EngineSignalCategory,
  tags: readonly string[] = [],
  stepMs?: number,
  metadata?: Record<string, unknown>,
): EngineSignal {
  return { engineId, severity, code, message, tick, tags, category, stepMs, metadata };
}

function isEngineTickResult(
  value: RunStateSnapshot | EngineTickResult,
): value is EngineTickResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'snapshot' in value &&
    typeof (value as EngineTickResult).snapshot === 'object'
  );
}

export function normalizeEngineTickResult(
  engineId: EngineId,
  tick: number,
  result: RunStateSnapshot | EngineTickResult,
): EngineTickResult {
  if (isEngineTickResult(result)) {
    return {
      snapshot: result.snapshot,
      engineId,
      stepMs: result.stepMs,
      signals:
        result.signals && result.signals.length > 0
          ? result.signals
          : [
              createEngineSignal(
                engineId,
                'INFO',
                'ENGINE_TICK_OK',
                `${engineId} tick completed`,
                tick,
              ),
            ],
    };
  }

  return {
    snapshot: result,
    engineId,
    signals: [
      createEngineSignal(
        engineId,
        'INFO',
        'ENGINE_TICK_OK',
        `${engineId} tick completed`,
        tick,
      ),
    ],
  };
}

/** Build an error signal for a failed engine tick. */
export function createEngineErrorSignal(
  engineId: EngineId | 'mode',
  code: string,
  message: string,
  tick: number,
  error?: unknown,
): EngineSignal {
  const meta: Record<string, unknown> = {};
  if (error instanceof Error) {
    meta['errorName'] = error.name;
    meta['errorMessage'] = error.message;
  }
  return createEngineSignalFull(engineId, 'ERROR', code, message, tick, 'error', [], undefined, meta);
}

/** Build a contract violation signal. */
export function createContractViolationSignal(
  engineId: EngineId | 'mode',
  rule: string,
  detail: string,
  tick: number,
): EngineSignal {
  return createEngineSignalFull(
    engineId, 'WARN', 'CONTRACT_VIOLATION', `[${rule}] ${detail}`,
    tick, 'contract_violation',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — EngineStepPolicy
// ─────────────────────────────────────────────────────────────────────────────

/** Per-step execution policy for a simulation engine. */
export interface EngineStepPolicy {
  /** Which engine this policy applies to. */
  readonly engineId: EngineId;
  /** Steps where this engine MUST execute. */
  readonly requiredSteps: readonly TickStep[];
  /** Steps where this engine MAY execute (if canRun returns true). */
  readonly optionalSteps: readonly TickStep[];
  /** Maximum wall-clock milliseconds allowed for this engine per step. */
  readonly maxStepMs: number;
  /** Whether to propagate errors as FAILED health (vs swallow). */
  readonly failHard: boolean;
  /** Number of consecutive errors before transitioning to FAILED health. */
  readonly failureThreshold: number;
}

/** Default policies for all engines. */
export const DEFAULT_ENGINE_STEP_POLICIES: Record<EngineId, EngineStepPolicy> = {
  time: {
    engineId: 'time',
    requiredSteps: ['STEP_02_TIME'],
    optionalSteps: [],
    maxStepMs: 10,
    failHard: true,
    failureThreshold: 3,
  },
  pressure: {
    engineId: 'pressure',
    requiredSteps: ['STEP_03_PRESSURE'],
    optionalSteps: [],
    maxStepMs: 15,
    failHard: true,
    failureThreshold: 3,
  },
  tension: {
    engineId: 'tension',
    requiredSteps: ['STEP_04_TENSION'],
    optionalSteps: [],
    maxStepMs: 15,
    failHard: false,
    failureThreshold: 5,
  },
  shield: {
    engineId: 'shield',
    requiredSteps: ['STEP_06_SHIELD'],
    optionalSteps: [],
    maxStepMs: 20,
    failHard: false,
    failureThreshold: 5,
  },
  battle: {
    engineId: 'battle',
    requiredSteps: ['STEP_05_BATTLE'],
    optionalSteps: [],
    maxStepMs: 25,
    failHard: false,
    failureThreshold: 5,
  },
  cascade: {
    engineId: 'cascade',
    requiredSteps: ['STEP_07_CASCADE'],
    optionalSteps: [],
    maxStepMs: 30,
    failHard: false,
    failureThreshold: 5,
  },
  sovereignty: {
    engineId: 'sovereignty',
    requiredSteps: ['STEP_10_SOVEREIGNTY_SNAPSHOT'],
    optionalSteps: [],
    maxStepMs: 20,
    failHard: false,
    failureThreshold: 5,
  },
};

/** Look up the step policy for an engine. Falls back to a safe default. */
export function getEngineStepPolicy(engineId: EngineId): EngineStepPolicy {
  return DEFAULT_ENGINE_STEP_POLICIES[engineId];
}

/** Determine if an engine is required to run at a given step. */
export function isEngineRequiredAtStep(engineId: EngineId, step: TickStep): boolean {
  const policy = getEngineStepPolicy(engineId);
  return policy.requiredSteps.includes(step);
}

/** Determine if an engine is allowed to run at a given step. */
export function isEngineEligibleAtStep(engineId: EngineId, step: TickStep): boolean {
  const policy = getEngineStepPolicy(engineId);
  return policy.requiredSteps.includes(step) || policy.optionalSteps.includes(step);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — EngineStepMetrics
// ─────────────────────────────────────────────────────────────────────────────

/** Timing and signal metrics for one engine's execution of one step. */
export interface EngineStepMetrics {
  readonly engineId: EngineId;
  readonly step: TickStep;
  readonly tick: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly signalCount: number;
  readonly errorCount: number;
  readonly warnCount: number;
  readonly skipped: boolean;
  readonly overBudget: boolean;
  readonly snapshotMutated: boolean;
}

/** Aggregate metrics for all engine steps in one tick. */
export interface TickStepMetrics {
  readonly tick: number;
  readonly totalDurationMs: number;
  readonly stepMetrics: readonly EngineStepMetrics[];
  readonly overBudgetEngines: readonly EngineId[];
  readonly totalSignalCount: number;
  readonly totalErrorCount: number;
  readonly slowestEngine: EngineId | null;
  readonly fastestEngine: EngineId | null;
}

/** Build a EngineStepMetrics record from raw timing data. */
export function buildEngineStepMetrics(
  engineId: EngineId,
  step: TickStep,
  tick: number,
  startMs: number,
  endMs: number,
  signals: readonly EngineSignal[],
  skipped: boolean,
  snapshotMutated: boolean,
): EngineStepMetrics {
  const durationMs = endMs - startMs;
  const policy = getEngineStepPolicy(engineId);
  return {
    engineId,
    step,
    tick,
    startMs,
    endMs,
    durationMs,
    signalCount: signals.length,
    errorCount: signals.filter((s) => s.severity === 'ERROR').length,
    warnCount: signals.filter((s) => s.severity === 'WARN').length,
    skipped,
    overBudget: durationMs > policy.maxStepMs,
    snapshotMutated,
  };
}

/** Aggregate step metrics from an array of per-engine metrics. */
export function buildTickStepMetrics(
  tick: number,
  stepMetrics: readonly EngineStepMetrics[],
): TickStepMetrics {
  const active = stepMetrics.filter((m) => !m.skipped);
  const totalDurationMs = active.reduce((sum, m) => sum + m.durationMs, 0);
  const overBudgetEngines = active
    .filter((m) => m.overBudget)
    .map((m) => m.engineId);
  const totalSignalCount = active.reduce((sum, m) => sum + m.signalCount, 0);
  const totalErrorCount = active.reduce((sum, m) => sum + m.errorCount, 0);

  let slowestEngine: EngineId | null = null;
  let fastestEngine: EngineId | null = null;
  let slowestMs = -Infinity;
  let fastestMs = Infinity;

  for (const m of active) {
    if (m.durationMs > slowestMs) { slowestMs = m.durationMs; slowestEngine = m.engineId; }
    if (m.durationMs < fastestMs) { fastestMs = m.durationMs; fastestEngine = m.engineId; }
  }

  return {
    tick,
    totalDurationMs,
    stepMetrics,
    overBudgetEngines,
    totalSignalCount,
    totalErrorCount,
    slowestEngine,
    fastestEngine,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — EngineSignalAggregator
// ─────────────────────────────────────────────────────────────────────────────

/** Aggregated signal report from all engines for one tick. */
export interface SignalAggregatorReport {
  readonly tick: number;
  readonly totalSignals: number;
  readonly byEngine: Record<string, number>;
  readonly bySeverity: Record<EngineSignalSeverity, number>;
  readonly byCategory: Partial<Record<EngineSignalCategory, number>>;
  readonly errors: readonly EngineSignal[];
  readonly warnings: readonly EngineSignal[];
  readonly infos: readonly EngineSignal[];
  readonly hasErrors: boolean;
  readonly hasWarnings: boolean;
}

/**
 * EngineSignalAggregator — collects signals from all engines during a tick
 * and produces a structured report for diagnostics and ML routing.
 *
 * The aggregator accumulates signals as each engine executes and provides
 * summary queries after all engines have run. This avoids N separate signal
 * arrays that callers would otherwise have to merge.
 */
export class EngineSignalAggregator {
  private _signals: EngineSignal[] = [];
  private readonly _tick: number;

  constructor(tick: number) {
    this._tick = tick;
  }

  /** Add one or more signals from an engine. */
  add(...signals: EngineSignal[]): void {
    for (const signal of signals) {
      this._signals.push(signal);
    }
  }

  /** Add all signals from an EngineTickResult. */
  addFromResult(result: EngineTickResult): void {
    if (result.signals) this.add(...result.signals);
  }

  /** Return all signals of a given severity. */
  bySeverity(severity: EngineSignalSeverity): EngineSignal[] {
    return this._signals.filter((s) => s.severity === severity);
  }

  /** Return all signals from a given engine. */
  byEngine(engineId: EngineId | 'mode'): EngineSignal[] {
    return this._signals.filter((s) => s.engineId === engineId);
  }

  /** Return all error signals. */
  getErrors(): EngineSignal[] { return this.bySeverity('ERROR'); }

  /** Return all warning signals. */
  getWarnings(): EngineSignal[] { return this.bySeverity('WARN'); }

  /** Return all info signals. */
  getInfos(): EngineSignal[] { return this.bySeverity('INFO'); }

  /** Returns true if any ERROR signals are present. */
  get hasErrors(): boolean { return this._signals.some((s) => s.severity === 'ERROR'); }

  /** Returns true if any WARN signals are present. */
  get hasWarnings(): boolean { return this._signals.some((s) => s.severity === 'WARN'); }

  /** Build the full aggregated report for this tick. */
  buildReport(): SignalAggregatorReport {
    const byEngine: Record<string, number> = {};
    const bySeverity: Record<EngineSignalSeverity, number> = { INFO: 0, WARN: 0, ERROR: 0 };
    const byCategory: Partial<Record<EngineSignalCategory, number>> = {};

    for (const s of this._signals) {
      byEngine[s.engineId] = (byEngine[s.engineId] ?? 0) + 1;
      bySeverity[s.severity]++;
      if (s.category) byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
    }

    return {
      tick: this._tick,
      totalSignals: this._signals.length,
      byEngine,
      bySeverity,
      byCategory,
      errors: this.getErrors(),
      warnings: this.getWarnings(),
      infos: this.getInfos(),
      hasErrors: this.hasErrors,
      hasWarnings: this.hasWarnings,
    };
  }

  /** Return a flat copy of all signals. */
  allSignals(): readonly EngineSignal[] { return [...this._signals]; }

  get signalCount(): number { return this._signals.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — EngineMLSignal
// ─────────────────────────────────────────────────────────────────────────────

/** Score classifications for ML-enriched signals. */
export type MLSignalClass =
  | 'critical_risk'
  | 'high_risk'
  | 'moderate_risk'
  | 'low_risk'
  | 'nominal'
  | 'opportunity';

/** A signal enriched with ML scores and risk classification. */
export interface EngineMLSignal extends EngineSignal {
  readonly riskScore: number;
  readonly urgencyScore: number;
  readonly mlClass: MLSignalClass;
  readonly featureSnapshot: readonly number[];
  readonly actionRecommendation: string;
}

/** Thresholds for risk score classification. */
const ML_SIGNAL_CLASS_THRESHOLDS = {
  critical_risk: 0.85,
  high_risk: 0.65,
  moderate_risk: 0.45,
  low_risk: 0.25,
} as const;

/** Classify a risk score into a MLSignalClass. */
export function classifyMLSignalRisk(riskScore: number): MLSignalClass {
  if (riskScore >= ML_SIGNAL_CLASS_THRESHOLDS.critical_risk) return 'critical_risk';
  if (riskScore >= ML_SIGNAL_CLASS_THRESHOLDS.high_risk) return 'high_risk';
  if (riskScore >= ML_SIGNAL_CLASS_THRESHOLDS.moderate_risk) return 'moderate_risk';
  if (riskScore >= ML_SIGNAL_CLASS_THRESHOLDS.low_risk) return 'low_risk';
  if (riskScore < 0.1) return 'opportunity';
  return 'nominal';
}

/** Recommend an action string based on ML signal class. */
export function recommendActionFromMLClass(mlClass: MLSignalClass): string {
  switch (mlClass) {
    case 'critical_risk': return 'PLAY_DEFENSIVE_IMMEDIATELY';
    case 'high_risk':     return 'PLAY_DEFENSIVE';
    case 'moderate_risk': return 'PLAY_BALANCED';
    case 'low_risk':      return 'PLAY_AGGRESSIVE';
    case 'nominal':       return 'HOLD';
    case 'opportunity':   return 'PLAY_AGGRESSIVE_MAX';
  }
}

/** Build an EngineMLSignal from a base signal and ML scores. */
export function buildEngineMLSignal(
  base: EngineSignal,
  riskScore: number,
  urgencyScore: number,
  featureSnapshot: readonly number[],
): EngineMLSignal {
  const clampedRisk = Math.max(0, Math.min(1, riskScore));
  const clampedUrgency = Math.max(0, Math.min(1, urgencyScore));
  const mlClass = classifyMLSignalRisk(clampedRisk);
  return {
    ...base,
    riskScore: clampedRisk,
    urgencyScore: clampedUrgency,
    mlClass,
    featureSnapshot,
    actionRecommendation: recommendActionFromMLClass(mlClass),
    category: 'ml_emit',
  };
}

/** Aggregate multiple ML signals into a composite risk profile. */
export interface MLSignalComposite {
  readonly tick: number;
  readonly signalCount: number;
  readonly peakRisk: number;
  readonly peakUrgency: number;
  readonly meanRisk: number;
  readonly dominantClass: MLSignalClass;
  readonly actionRecommendation: string;
}

/** Build a composite risk profile from an array of ML signals. */
export function buildMLSignalComposite(
  tick: number,
  signals: readonly EngineMLSignal[],
): MLSignalComposite {
  if (signals.length === 0) {
    return {
      tick, signalCount: 0, peakRisk: 0, peakUrgency: 0, meanRisk: 0,
      dominantClass: 'nominal', actionRecommendation: 'HOLD',
    };
  }
  const peakRisk = Math.max(...signals.map((s) => s.riskScore));
  const peakUrgency = Math.max(...signals.map((s) => s.urgencyScore));
  const meanRisk = signals.reduce((sum, s) => sum + s.riskScore, 0) / signals.length;
  const dominantClass = classifyMLSignalRisk(peakRisk);
  return {
    tick,
    signalCount: signals.length,
    peakRisk,
    peakUrgency,
    meanRisk,
    dominantClass,
    actionRecommendation: recommendActionFromMLClass(dominantClass),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — EngineContractValidator
// ─────────────────────────────────────────────────────────────────────────────

/** Result of a single contract check. */
export interface ContractCheckResult {
  readonly rule: string;
  readonly passed: boolean;
  readonly detail: string;
  readonly signal?: EngineSignal;
}

/** Summary of all contract checks for an engine. */
export interface ContractValidationReport {
  readonly engineId: EngineId;
  readonly tick: number;
  readonly checks: readonly ContractCheckResult[];
  readonly allPassed: boolean;
  readonly violationCount: number;
}

/**
 * EngineContractValidator — validates that a SimulationEngine and its
 * tick results conform to the documented contracts.
 *
 * Rules enforced:
 * 1. Engine must return a non-null snapshot
 * 2. Returned snapshot must have same runId as input
 * 3. Engine must not increase tick number (tick is read-only)
 * 4. Engine must not change mode (mode is read-only)
 * 5. Engine must provide a valid health report
 * 6. Result must not carry more signals than the signal cap
 */
export class EngineContractValidator {
  static readonly MAX_SIGNALS_PER_TICK = 50;

  static validate(
    engine: SimulationEngine,
    inputSnapshot: RunStateSnapshot,
    result: EngineTickResult,
    tick: number,
  ): ContractValidationReport {
    const checks: ContractCheckResult[] = [];

    // Rule 1: snapshot must exist
    checks.push({
      rule: 'snapshot_not_null',
      passed: result.snapshot !== null && result.snapshot !== undefined,
      detail: result.snapshot ? 'Snapshot returned' : 'Snapshot is null/undefined',
    });

    // Rule 2: runId must match
    const runIdMatch = result.snapshot?.runId === inputSnapshot.runId;
    checks.push({
      rule: 'run_id_stable',
      passed: runIdMatch,
      detail: runIdMatch
        ? `runId matches: ${inputSnapshot.runId}`
        : `runId changed from ${inputSnapshot.runId} to ${result.snapshot?.runId}`,
      signal: !runIdMatch
        ? createContractViolationSignal(engine.engineId, 'run_id_stable', `runId mutated`, tick)
        : undefined,
    });

    // Rule 3: tick must not advance
    const tickStable = result.snapshot?.tick === inputSnapshot.tick ||
      result.snapshot?.tick === inputSnapshot.tick + 1;
    checks.push({
      rule: 'tick_monotonic',
      passed: tickStable,
      detail: tickStable
        ? 'Tick is valid'
        : `Tick jumped from ${inputSnapshot.tick} to ${result.snapshot?.tick}`,
      signal: !tickStable
        ? createContractViolationSignal(engine.engineId, 'tick_monotonic', 'Tick advanced unexpectedly', tick)
        : undefined,
    });

    // Rule 4: mode must not change
    const modeStable = result.snapshot?.mode === inputSnapshot.mode;
    checks.push({
      rule: 'mode_immutable',
      passed: modeStable,
      detail: modeStable
        ? `Mode stable: ${inputSnapshot.mode}`
        : `Mode changed from ${inputSnapshot.mode} to ${result.snapshot?.mode}`,
      signal: !modeStable
        ? createContractViolationSignal(engine.engineId, 'mode_immutable', 'Mode mutated during tick', tick)
        : undefined,
    });

    // Rule 5: health report must be valid
    let health: EngineHealth | null = null;
    try {
      health = engine.getHealth();
    } catch {
      // health unavailable
    }
    checks.push({
      rule: 'health_report_available',
      passed: health !== null,
      detail: health ? `Health: ${health.status}` : 'getHealth() threw or returned null',
    });

    // Rule 6: signal count cap
    const signalCount = result.signals?.length ?? 0;
    const sigCap = EngineContractValidator.MAX_SIGNALS_PER_TICK;
    checks.push({
      rule: 'signal_count_within_cap',
      passed: signalCount <= sigCap,
      detail: `${signalCount} signals (cap: ${sigCap})`,
      signal: signalCount > sigCap
        ? createContractViolationSignal(engine.engineId, 'signal_count_within_cap', `${signalCount} signals exceeds cap`, tick)
        : undefined,
    });

    const violationCount = checks.filter((c) => !c.passed).length;
    return {
      engineId: engine.engineId,
      tick,
      checks,
      allPassed: violationCount === 0,
      violationCount,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — ModeHookRegistry
// ─────────────────────────────────────────────────────────────────────────────

/** Options for the ModeHookRegistry. */
export interface ModeHookRegistryOptions {
  readonly strict?: boolean; // throw if a hook is registered twice
}

/**
 * ModeHookRegistry — central registry for ModeLifecycleHooks.
 *
 * Each mode registers its hooks once at startup. The registry dispatches
 * all hook calls and provides fallback no-ops for modes with partial hooks.
 *
 * Modes supported: 'solo', 'pvp', 'coop', 'ghost'
 */
export class ModeHookRegistry {
  private _registry = new Map<ModeCode, ModeLifecycleHooks>();
  private readonly _strict: boolean;

  constructor(opts: ModeHookRegistryOptions = {}) {
    this._strict = opts.strict ?? false;
  }

  /** Register a ModeLifecycleHooks implementation. */
  register(hooks: ModeLifecycleHooks): void {
    if (this._registry.has(hooks.mode) && this._strict) {
      throw new Error(`ModeHookRegistry: hooks already registered for mode "${hooks.mode}"`);
    }
    this._registry.set(hooks.mode, hooks);
  }

  /** Look up the registered hooks for a mode. Returns undefined if not registered. */
  get(mode: ModeCode): ModeLifecycleHooks | undefined {
    return this._registry.get(mode);
  }

  /** Return true if hooks are registered for a mode. */
  has(mode: ModeCode): boolean {
    return this._registry.has(mode);
  }

  /** Dispatch initialize for the given mode. */
  initialize(mode: ModeCode, snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const hooks = this._registry.get(mode);
    if (!hooks) return snapshot;
    return hooks.initialize(snapshot, context);
  }

  /** Dispatch beforeStep for the given mode. No-op if not defined. */
  beforeStep(mode: ModeCode, snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const hooks = this._registry.get(mode);
    if (!hooks?.beforeStep) return snapshot;
    return hooks.beforeStep(snapshot, context);
  }

  /** Dispatch afterStep for the given mode. No-op if not defined. */
  afterStep(mode: ModeCode, snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const hooks = this._registry.get(mode);
    if (!hooks?.afterStep) return snapshot;
    return hooks.afterStep(snapshot, context);
  }

  /** Dispatch finalizeTick for the given mode. No-op if not defined. */
  finalizeTick(mode: ModeCode, snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const hooks = this._registry.get(mode);
    if (!hooks?.finalizeTick) return snapshot;
    return hooks.finalizeTick(snapshot, context);
  }

  /** List all registered modes. */
  registeredModes(): ModeCode[] {
    return Array.from(this._registry.keys());
  }

  get size(): number { return this._registry.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — TickContextBuilder
// ─────────────────────────────────────────────────────────────────────────────

/** Options for building a TickContext. */
export interface TickContextBuilderOptions {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunStateSnapshot['phase'];
  readonly clock: ClockSource;
  readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
  readonly traceIdPrefix?: string;
}

/**
 * TickContextBuilder — constructs TickContext objects for each step
 * without allocating a new EventBus or clock per step.
 *
 * Designed to be instantiated once per tick and called for each of the
 * 13 steps in the tick sequence. The bus and clock references are shared
 * across all step contexts.
 */
export class TickContextBuilder {
  private readonly _opts: TickContextBuilderOptions;

  constructor(opts: TickContextBuilderOptions) {
    this._opts = opts;
  }

  /** Build a TickContext for the given step. */
  build(step: TickStep, nowMs: number): TickContext {
    const traceId = `${this._opts.traceIdPrefix ?? 'tx'}-${this._opts.runId}-${this._opts.tick}-${step}`;
    const trace: TickTrace = {
      runId: this._opts.runId,
      tick: this._opts.tick,
      step,
      mode: this._opts.mode,
      phase: this._opts.phase,
      traceId,
    };
    return {
      step,
      nowMs,
      clock: this._opts.clock,
      bus: this._opts.bus,
      trace,
    };
  }

  /** Build all 13 step contexts at once (uses clock.now() for nowMs). */
  buildAll(steps: readonly TickStep[]): TickContext[] {
    const nowMs = this._opts.clock.now();
    return steps.map((step) => this.build(step, nowMs));
  }

  /** Build a TickContext for a specific step using the current clock time. */
  buildNow(step: TickStep): TickContext {
    return this.build(step, this._opts.clock.now());
  }

  get runId(): string { return this._opts.runId; }
  get tick(): number { return this._opts.tick; }
  get mode(): ModeCode { return this._opts.mode; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — EngineStepRouter
// ─────────────────────────────────────────────────────────────────────────────

/** Result of routing one step across all eligible engines. */
export interface StepRouteResult {
  readonly step: TickStep;
  readonly tick: number;
  readonly engineResults: readonly EngineTickResult[];
  readonly stepMetrics: readonly EngineStepMetrics[];
  readonly finalSnapshot: RunStateSnapshot;
  readonly aggregatedSignals: readonly EngineSignal[];
  readonly hasErrors: boolean;
  readonly durationMs: number;
}

/** Options for EngineStepRouter. */
export interface EngineStepRouterOptions {
  readonly enableContractValidation?: boolean;
  readonly enableMetrics?: boolean;
  readonly skipEnginesOnError?: boolean;
}

/**
 * EngineStepRouter — routes tick execution across all SimulationEngines
 * that are eligible for a given step.
 *
 * Execution order within a step matches the ALL_ENGINE_IDS ordering.
 * Engines that fail canRun() are skipped (recorded as skipped in metrics).
 * Engines that throw errors emit an ERROR signal and the previous snapshot is preserved.
 */
export class EngineStepRouter {
  private readonly _engines = new Map<EngineId, SimulationEngine>();
  private readonly _opts: EngineStepRouterOptions;

  constructor(opts: EngineStepRouterOptions = {}) {
    this._opts = {
      enableContractValidation: opts.enableContractValidation ?? true,
      enableMetrics: opts.enableMetrics ?? true,
      skipEnginesOnError: opts.skipEnginesOnError ?? true,
    };
  }

  /** Register a simulation engine. */
  register(engine: SimulationEngine): void {
    this._engines.set(engine.engineId, engine);
  }

  /** Look up a registered engine. */
  get(engineId: EngineId): SimulationEngine | undefined {
    return this._engines.get(engineId);
  }

  /** Remove a registered engine. */
  unregister(engineId: EngineId): boolean {
    return this._engines.delete(engineId);
  }

  /**
   * Route a single step: run all eligible engines in order and produce
   * a StepRouteResult with the final mutated snapshot.
   */
  route(
    step: TickStep,
    initialSnapshot: RunStateSnapshot,
    context: TickContext,
  ): StepRouteResult {
    const routeStart = Date.now();
    const aggregator = new EngineSignalAggregator(context.trace.tick);
    const engineResults: EngineTickResult[] = [];
    const stepMetricsArr: EngineStepMetrics[] = [];
    let currentSnapshot = initialSnapshot;
    let hasErrors = false;

    for (const engineId of ALL_ENGINE_IDS) {
      if (!isEngineEligibleAtStep(engineId, step)) continue;
      const engine = this._engines.get(engineId);
      if (!engine) continue;

      const stepStart = Date.now();
      let result: EngineTickResult;
      let skipped = false;
      let snapshotMutated = false;

      try {
        if (engine.canRun && !engine.canRun(currentSnapshot, context)) {
          skipped = true;
          result = {
            snapshot: currentSnapshot,
            engineId,
            signals: [createEngineSignal(engineId, 'INFO', 'ENGINE_SKIPPED', `${engineId} skipped at ${step}`, context.trace.tick)],
          };
        } else {
          const raw = engine.tick(currentSnapshot, context);
          result = normalizeEngineTickResult(engineId, context.trace.tick, raw);
          snapshotMutated = result.snapshot !== currentSnapshot;
          currentSnapshot = result.snapshot;
        }
      } catch (err) {
        hasErrors = true;
        const errorSignal = createEngineErrorSignal(
          engineId, 'ENGINE_TICK_ERROR',
          `Engine "${engineId}" threw at step ${step}`,
          context.trace.tick, err,
        );
        result = { snapshot: currentSnapshot, engineId, signals: [errorSignal] };
      }

      const stepEnd = Date.now();
      aggregator.addFromResult(result);
      engineResults.push(result);

      if (this._opts.enableMetrics) {
        stepMetricsArr.push(buildEngineStepMetrics(
          engineId, step, context.trace.tick,
          stepStart, stepEnd,
          result.signals ?? [], skipped, snapshotMutated,
        ));
      }

      if (this._opts.enableContractValidation && !skipped) {
        const validationReport = EngineContractValidator.validate(engine, initialSnapshot, result, context.trace.tick);
        if (!validationReport.allPassed) {
          for (const check of validationReport.checks) {
            if (!check.passed && check.signal) aggregator.add(check.signal);
          }
        }
      }
    }

    return {
      step,
      tick: context.trace.tick,
      engineResults,
      stepMetrics: stepMetricsArr,
      finalSnapshot: currentSnapshot,
      aggregatedSignals: aggregator.allSignals(),
      hasErrors,
      durationMs: Date.now() - routeStart,
    };
  }

  /** Reset all registered engines. */
  resetAll(): void {
    for (const engine of this._engines.values()) engine.reset();
  }

  /** Get health reports from all registered engines. */
  getAllHealth(): EngineHealth[] {
    return Array.from(this._engines.values()).map((e) => e.getHealth());
  }

  get engineCount(): number { return this._engines.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — EngineHealthMonitor
// ─────────────────────────────────────────────────────────────────────────────

/** A health snapshot with tick context. */
export interface HealthRecord {
  readonly engineId: EngineId;
  readonly status: EngineHealthStatus;
  readonly tick: number;
  readonly timestamp: number;
  readonly consecutiveFailures: number;
  readonly notes: readonly string[];
}

/** Trend direction for engine health over time. */
export type HealthTrend = 'improving' | 'stable' | 'degrading' | 'critical';

/** Health trend report for one engine. */
export interface EngineHealthTrend {
  readonly engineId: EngineId;
  readonly currentStatus: EngineHealthStatus;
  readonly trend: HealthTrend;
  readonly consecutiveFailures: number;
  readonly lastDegradedTick: number | null;
  readonly lastFailedTick: number | null;
  readonly healthyRatio: number;
  readonly recentRecords: readonly HealthRecord[];
}

/**
 * EngineHealthMonitor — tracks health history for all simulation engines
 * and produces trend reports for the orchestration layer.
 *
 * The monitor is queried at end-of-tick to determine if the run should
 * be halted due to repeated engine failures.
 */
export class EngineHealthMonitor {
  private _records = new Map<EngineId, HealthRecord[]>();
  private _consecutiveFailures = new Map<EngineId, number>();
  private readonly _maxHistoryPerEngine: number;

  constructor(maxHistoryPerEngine = 200) {
    this._maxHistoryPerEngine = maxHistoryPerEngine;
  }

  /** Record a health update for an engine. */
  record(health: EngineHealth, tick: number): void {
    if (!this._records.has(health.engineId)) {
      this._records.set(health.engineId, []);
      this._consecutiveFailures.set(health.engineId, 0);
    }

    const records = this._records.get(health.engineId)!;
    const consecutive = this._consecutiveFailures.get(health.engineId) ?? 0;
    const newConsecutive = health.status === 'FAILED' ? consecutive + 1 : 0;
    this._consecutiveFailures.set(health.engineId, newConsecutive);

    const record: HealthRecord = {
      engineId: health.engineId,
      status: health.status,
      tick,
      timestamp: Date.now(),
      consecutiveFailures: newConsecutive,
      notes: health.notes ?? [],
    };

    records.push(record);
    if (records.length > this._maxHistoryPerEngine) records.shift();
  }

  /** Record health from an array of EngineHealth snapshots. */
  recordAll(healthReports: readonly EngineHealth[], tick: number): void {
    for (const h of healthReports) this.record(h, tick);
  }

  /** Build a trend report for a single engine. */
  getTrend(engineId: EngineId): EngineHealthTrend {
    const records = this._records.get(engineId) ?? [];
    const consecutive = this._consecutiveFailures.get(engineId) ?? 0;
    const currentStatus = records[records.length - 1]?.status ?? 'HEALTHY';
    const healthyCount = records.filter((r) => r.status === 'HEALTHY').length;
    const healthyRatio = records.length > 0 ? healthyCount / records.length : 1;

    const lastDegraded = [...records].reverse().find((r) => r.status === 'DEGRADED');
    const lastFailed = [...records].reverse().find((r) => r.status === 'FAILED');

    let trend: HealthTrend;
    if (consecutive >= 5) trend = 'critical';
    else if (consecutive > 0) trend = 'degrading';
    else if (healthyRatio > 0.9) trend = 'stable';
    else if (healthyRatio > 0.7) trend = 'improving';
    else trend = 'degrading';

    return {
      engineId,
      currentStatus,
      trend,
      consecutiveFailures: consecutive,
      lastDegradedTick: lastDegraded?.tick ?? null,
      lastFailedTick: lastFailed?.tick ?? null,
      healthyRatio,
      recentRecords: records.slice(-20),
    };
  }

  /** Get trends for all engines that have records. */
  getAllTrends(): EngineHealthTrend[] {
    return Array.from(this._records.keys()).map((id) => this.getTrend(id));
  }

  /** Returns true if any engine is in FAILED status with >= threshold consecutive failures. */
  isRunAtRisk(failureThreshold = 3): boolean {
    for (const engineId of this._records.keys()) {
      const trend = this.getTrend(engineId);
      if (trend.consecutiveFailures >= failureThreshold) return true;
    }
    return false;
  }

  /** Get the current consecutive failure count for an engine. */
  getConsecutiveFailures(engineId: EngineId): number {
    return this._consecutiveFailures.get(engineId) ?? 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — EngineSignalRouter
// ─────────────────────────────────────────────────────────────────────────────

/** A subscriber callback for engine signals. */
export type EngineSignalSubscriber = (signal: EngineSignal) => void;

/**
 * EngineSignalRouter — fan-out dispatch for engine signals.
 *
 * Signals accumulated by the EngineSignalAggregator are routed:
 * 1. To the EventBus under `engine.signal.*` events
 * 2. To any registered typed subscribers (e.g., analytics, ML routing)
 * 3. To error-specific subscribers for alerting
 *
 * This decouples signal producers (engines) from signal consumers (chat,
 * analytics, ML, logging) without requiring direct dependencies.
 */
export class EngineSignalRouter {
  private _subscribers: EngineSignalSubscriber[] = [];
  private _errorSubscribers: EngineSignalSubscriber[] = [];
  private _perEngineSubscribers = new Map<EngineId | 'mode', EngineSignalSubscriber[]>();

  /** Subscribe to ALL signals. */
  subscribe(cb: EngineSignalSubscriber): () => void {
    this._subscribers.push(cb);
    return () => { this._subscribers = this._subscribers.filter((s) => s !== cb); };
  }

  /** Subscribe to ERROR-only signals. */
  subscribeErrors(cb: EngineSignalSubscriber): () => void {
    this._errorSubscribers.push(cb);
    return () => { this._errorSubscribers = this._errorSubscribers.filter((s) => s !== cb); };
  }

  /** Subscribe to signals from a specific engine. */
  subscribeToEngine(engineId: EngineId | 'mode', cb: EngineSignalSubscriber): () => void {
    const list = this._perEngineSubscribers.get(engineId) ?? [];
    list.push(cb);
    this._perEngineSubscribers.set(engineId, list);
    return () => {
      const updated = (this._perEngineSubscribers.get(engineId) ?? []).filter((s) => s !== cb);
      this._perEngineSubscribers.set(engineId, updated);
    };
  }

  /**
   * Dispatch an array of signals to all subscribers.
   * Also emits `engine.signal.error` on the provided bus for ERROR signals.
   */
  dispatch(
    signals: readonly EngineSignal[],
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
  ): void {
    for (const signal of signals) {
      for (const cb of this._subscribers) cb(signal);

      const perEngine = this._perEngineSubscribers.get(signal.engineId);
      if (perEngine) for (const cb of perEngine) cb(signal);

      if (signal.severity === 'ERROR') {
        for (const cb of this._errorSubscribers) cb(signal);
        bus.emit('engine.signal.error' as keyof typeof bus, signal as never);
      }

      if (signal.severity === 'WARN') {
        bus.emit('engine.signal.warn' as keyof typeof bus, signal as never);
      }
    }
  }

  /** Clear all subscribers. */
  clear(): void {
    this._subscribers = [];
    this._errorSubscribers = [];
    this._perEngineSubscribers.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — EngineStepTimer
// ─────────────────────────────────────────────────────────────────────────────

/** A single timer observation. */
export interface StepTimerRecord {
  readonly engineId: EngineId | 'mode';
  readonly step: TickStep;
  readonly tick: number;
  readonly durationMs: number;
  readonly overBudget: boolean;
}

/** Running statistics from the step timer. */
export interface StepTimerStats {
  readonly totalObservations: number;
  readonly overBudgetCount: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  readonly minMs: number;
  readonly overBudgetRatio: number;
}

/**
 * EngineStepTimer — per-step high-resolution timing instrumentation.
 *
 * Records every step execution duration and computes percentile stats
 * for the health monitor and ML diagnostics layer.
 */
export class EngineStepTimer {
  private _records: StepTimerRecord[] = [];
  private readonly _maxRecords: number;

  constructor(maxRecords = 5000) {
    this._maxRecords = maxRecords;
  }

  /** Record a step timing observation. */
  record(
    engineId: EngineId | 'mode',
    step: TickStep,
    tick: number,
    durationMs: number,
  ): void {
    const policy = engineId === 'mode' ? null : getEngineStepPolicy(engineId as EngineId);
    const overBudget = policy ? durationMs > policy.maxStepMs : false;
    const record: StepTimerRecord = { engineId, step, tick, durationMs, overBudget };
    this._records.push(record);
    if (this._records.length > this._maxRecords) this._records.shift();
  }

  /** Build stats from all recorded observations. */
  buildStats(): StepTimerStats {
    if (this._records.length === 0) {
      return { totalObservations: 0, overBudgetCount: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, minMs: 0, overBudgetRatio: 0 };
    }

    const durations = [...this._records.map((r) => r.durationMs)].sort((a, b) => a - b);
    const n = durations.length;
    const percentile = (p: number) => durations[Math.floor(n * p)] ?? 0;
    const overBudget = this._records.filter((r) => r.overBudget).length;

    return {
      totalObservations: n,
      overBudgetCount: overBudget,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      maxMs: durations[n - 1],
      minMs: durations[0],
      overBudgetRatio: overBudget / n,
    };
  }

  /** Get stats for a specific engine. */
  buildStatsForEngine(engineId: EngineId | 'mode'): StepTimerStats {
    const saved = this._records;
    this._records = this._records.filter((r) => r.engineId === engineId);
    const stats = this.buildStats();
    this._records = saved;
    return stats;
  }

  /** Get the slowest N steps recorded. */
  getSlowest(n = 10): StepTimerRecord[] {
    return [...this._records]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, n);
  }

  get recordCount(): number { return this._records.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — EngineRosterValidator
// ─────────────────────────────────────────────────────────────────────────────

/** Result of validating the engine roster for a mode. */
export interface RosterValidationResult {
  readonly mode: ModeCode;
  readonly valid: boolean;
  readonly missingEngines: readonly EngineId[];
  readonly extraEngines: readonly EngineId[];
  readonly warnings: readonly string[];
}

/** Minimum required engines per mode. */
const REQUIRED_ENGINES_BY_MODE: Record<ModeCode, readonly EngineId[]> = {
  solo:  ['time', 'pressure', 'tension', 'shield', 'battle', 'cascade', 'sovereignty'],
  pvp:   ['time', 'pressure', 'tension', 'battle', 'cascade'],
  coop:  ['time', 'pressure', 'tension', 'shield', 'battle', 'cascade'],
  ghost: ['time', 'pressure', 'tension', 'sovereignty'],
};

/**
 * EngineRosterValidator — validates that the set of registered engines
 * matches the requirements for the run mode.
 *
 * Called at orchestrator startup to catch missing engines before the first tick.
 */
export class EngineRosterValidator {
  /** Validate a set of registered engine IDs against a mode. */
  static validate(
    mode: ModeCode,
    registeredEngineIds: readonly EngineId[],
  ): RosterValidationResult {
    const required = REQUIRED_ENGINES_BY_MODE[mode] ?? ALL_ENGINE_IDS;
    const registered = new Set(registeredEngineIds);
    const missing = required.filter((id) => !registered.has(id));
    const extra = registeredEngineIds.filter((id) => !required.includes(id));
    const warnings: string[] = [];

    if (extra.length > 0) {
      warnings.push(`Extra engines registered for mode "${mode}": ${extra.join(', ')}`);
    }

    return {
      mode,
      valid: missing.length === 0,
      missingEngines: missing,
      extraEngines: extra,
      warnings,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — EngineTickOrchestrationPlan
// ─────────────────────────────────────────────────────────────────────────────

/** A planned step in the orchestration plan. */
export interface OrchestrationStep {
  readonly step: TickStep;
  readonly eligibleEngines: readonly EngineId[];
  readonly modeHooksEnabled: boolean;
  readonly estimatedMs: number;
}

/** The full orchestration plan for one tick. */
export interface EngineTickOrchestrationPlan {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly steps: readonly OrchestrationStep[];
  readonly totalEstimatedMs: number;
  readonly engineCount: number;
  readonly stepCount: number;
}

/** Build an orchestration plan for a tick. */
export function buildEngineTickOrchestrationPlan(
  runId: string,
  tick: number,
  mode: ModeCode,
  registeredEngineIds: readonly EngineId[],
  allTickSteps: readonly TickStep[],
): EngineTickOrchestrationPlan {
  const registeredSet = new Set(registeredEngineIds);

  const steps: OrchestrationStep[] = allTickSteps.map((step) => {
    const eligibleEngines = ALL_ENGINE_IDS.filter(
      (id) => isEngineEligibleAtStep(id, step) && registeredSet.has(id),
    );
    const modeSlots = ENGINE_STEP_SLOTS[step] ?? [];
    const modeHooksEnabled = modeSlots.includes('mode');
    const estimatedMs = eligibleEngines.reduce((sum, id) => {
      return sum + getEngineStepPolicy(id).maxStepMs;
    }, 0) + (modeHooksEnabled ? 5 : 0);

    return { step, eligibleEngines, modeHooksEnabled, estimatedMs };
  });

  return {
    runId,
    tick,
    mode,
    steps,
    totalEstimatedMs: steps.reduce((sum, s) => sum + s.estimatedMs, 0),
    engineCount: registeredEngineIds.length,
    stepCount: steps.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 17 — EngineContractsMLVector
// ─────────────────────────────────────────────────────────────────────────────

/** Feature labels for the engine contracts ML vector. */
export const ENGINE_CONTRACT_ML_FEATURE_LABELS: readonly string[] = [
  'engine_count_norm',           // 0: registered engines / 7
  'healthy_engine_ratio',        // 1: healthy engines / registered count
  'degraded_engine_ratio',       // 2: degraded engines / registered count
  'failed_engine_ratio',         // 3: failed engines / registered count
  'signal_error_rate_norm',      // 4: error signals / total signals (norm)
  'signal_warn_rate_norm',       // 5: warn signals / total signals (norm)
  'over_budget_step_ratio',      // 6: over-budget steps / total steps (norm)
  'tick_duration_norm',          // 7: tick duration / budget (norm)
  'contract_violation_rate_norm',// 8: violations / checks (norm)
  'health_trend_score',          // 9: 0=critical 0.25=degrading 0.5=stable 1=improving
  'consecutive_failure_max_norm',// 10: max consecutive failures across engines / 10
  'mode_hook_coverage',          // 11: 1 if mode hooks registered for current mode
  'roster_valid',                // 12: 1 if roster is valid for mode
  'missing_engine_count_norm',   // 13: missing engines / 7
  'step_p95_ms_norm',            // 14: p95 step duration / 50ms budget
  'signal_density_norm',         // 15: total signals / tick / 50
] as const;

/** The ML vector extracted from engine contracts state. */
export interface EngineContractsMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
  readonly vectorHash: string;
}

/** Build the contracts ML vector from live engine state. */
export function buildEngineContractsMLVector(
  tick: number,
  healthMonitor: EngineHealthMonitor,
  signalReport: SignalAggregatorReport,
  stepTimer: EngineStepTimer,
  rosterResult: RosterValidationResult,
  modeHookRegistry: ModeHookRegistry,
  mode: ModeCode,
  tickDurationMs: number,
): EngineContractsMLVector {
  const trends = healthMonitor.getAllTrends();
  const healthy = trends.filter((t) => t.currentStatus === 'HEALTHY').length;
  const degraded = trends.filter((t) => t.currentStatus === 'DEGRADED').length;
  const failed = trends.filter((t) => t.currentStatus === 'FAILED').length;
  const total = Math.max(trends.length, 1);

  const timerStats = stepTimer.buildStats();
  const maxConsecutiveFailures = trends.reduce(
    (max, t) => Math.max(max, t.consecutiveFailures), 0,
  );

  // Health trend: average score across engines
  const trendScore = trends.length > 0
    ? trends.reduce((sum, t) => {
        switch (t.trend) {
          case 'improving': return sum + 1.0;
          case 'stable':    return sum + 0.75;
          case 'degrading': return sum + 0.25;
          case 'critical':  return sum + 0.0;
        }
      }, 0) / trends.length
    : 0.75;

  const totalSignals = Math.max(signalReport.totalSignals, 1);

  const features: number[] = [
    Math.min(trends.length / 7, 1),
    healthy / total,
    degraded / total,
    failed / total,
    Math.min(signalReport.bySeverity.ERROR / totalSignals, 1),
    Math.min(signalReport.bySeverity.WARN / totalSignals, 1),
    timerStats.overBudgetRatio,
    Math.min(tickDurationMs / 200, 1),
    0, // contract violations — populated by caller
    trendScore,
    Math.min(maxConsecutiveFailures / 10, 1),
    modeHookRegistry.has(mode) ? 1 : 0,
    rosterResult.valid ? 1 : 0,
    Math.min(rosterResult.missingEngines.length / 7, 1),
    Math.min(timerStats.p95Ms / 50, 1),
    Math.min(signalReport.totalSignals / 50, 1),
  ];

  const vectorHash = features.map((f) => f.toFixed(6)).join(',');

  return {
    features,
    labels: ENGINE_CONTRACT_ML_FEATURE_LABELS,
    tick,
    vectorHash,
  };
}

// ---------------------------------------------------------------------------
// EngineContractAuditLog — append-only log of contract violations per tick
// ---------------------------------------------------------------------------

export type ContractViolationKind =
  | 'MISSING_ENGINE'
  | 'STEP_TIMEOUT'
  | 'HEALTH_DEGRADED'
  | 'ROSTER_INVALID'
  | 'ROUTE_MISS'
  | 'SIGNAL_OVERFLOW'
  | 'DEPENDENCY_CYCLE';

export interface ContractViolation {
  readonly tick: number;
  readonly kind: ContractViolationKind;
  readonly engineId: string;
  readonly message: string;
  readonly severity: 'WARN' | 'CRITICAL';
  readonly timestamp: number;
}

export class EngineContractAuditLog {
  private readonly entries: ContractViolation[] = [];
  private readonly maxEntries: number;
  private totalWarn = 0;
  private totalCritical = 0;

  public constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  public record(violation: ContractViolation): void {
    if (this.entries.length >= this.maxEntries) this.entries.shift();
    this.entries.push(Object.freeze(violation));
    if (violation.severity === 'CRITICAL') this.totalCritical++;
    else this.totalWarn++;
  }

  public recentViolations(limit = 20): ReadonlyArray<ContractViolation> {
    return this.entries.slice(-limit);
  }

  public violationsByTick(tick: number): ReadonlyArray<ContractViolation> {
    return this.entries.filter(e => e.tick === tick);
  }

  public violationsByKind(kind: ContractViolationKind): ReadonlyArray<ContractViolation> {
    return this.entries.filter(e => e.kind === kind);
  }

  public stats(): { total: number; warn: number; critical: number; rate: number } {
    const total = this.totalWarn + this.totalCritical;
    return { total, warn: this.totalWarn, critical: this.totalCritical, rate: total / Math.max(1, this.entries.length) };
  }

  public clear(): void {
    this.entries.length = 0;
    this.totalWarn = 0;
    this.totalCritical = 0;
  }
}

// ---------------------------------------------------------------------------
// EngineContractPolicyEnforcer — validates tick execution against contracts
// ---------------------------------------------------------------------------

export interface ContractPolicy {
  readonly maxStepTimeoutMs: number;
  readonly maxConsecutiveFailures: number;
  readonly requiredEngines: ReadonlyArray<string>;
  readonly minHealthyRatio: number;
  readonly maxSignalsPerTick: number;
}

export const DEFAULT_CONTRACT_POLICY: ContractPolicy = Object.freeze({
  maxStepTimeoutMs: 50,
  maxConsecutiveFailures: 3,
  requiredEngines: ['time', 'pressure', 'tension', 'shield', 'battle', 'cascade', 'sovereignty'],
  minHealthyRatio: 0.6,
  maxSignalsPerTick: 100,
});

export interface PolicyEnforcementResult {
  readonly passed: boolean;
  readonly violations: ReadonlyArray<ContractViolation>;
  readonly tick: number;
}

export class EngineContractPolicyEnforcer {
  private readonly policy: ContractPolicy;
  private readonly auditLog: EngineContractAuditLog;

  public constructor(policy: ContractPolicy = DEFAULT_CONTRACT_POLICY) {
    this.policy = policy;
    this.auditLog = new EngineContractAuditLog(500);
  }

  public enforce(
    tick: number,
    healthStates: ReadonlyArray<{ engineId: string; status: string; consecutiveFailures: number }>,
    stepDurations: ReadonlyArray<{ stepId: string; durationMs: number }>,
    signalCount: number,
  ): PolicyEnforcementResult {
    const violations: ContractViolation[] = [];
    const now = Date.now();

    // Check required engines
    const presentEngines = new Set(healthStates.map(h => h.engineId));
    for (const req of this.policy.requiredEngines) {
      if (!presentEngines.has(req)) {
        const v: ContractViolation = Object.freeze({
          tick, kind: 'MISSING_ENGINE', engineId: req,
          message: `Required engine '${req}' not present in registry`,
          severity: 'CRITICAL', timestamp: now,
        });
        violations.push(v);
        this.auditLog.record(v);
      }
    }

    // Check health ratio
    const healthy = healthStates.filter(h => h.status === 'HEALTHY').length;
    const total = healthStates.length;
    const healthyRatio = total > 0 ? healthy / total : 1;
    if (healthyRatio < this.policy.minHealthyRatio) {
      const v: ContractViolation = Object.freeze({
        tick, kind: 'HEALTH_DEGRADED', engineId: 'system',
        message: `Healthy ratio ${healthyRatio.toFixed(2)} below minimum ${this.policy.minHealthyRatio}`,
        severity: 'WARN', timestamp: now,
      });
      violations.push(v);
      this.auditLog.record(v);
    }

    // Check step timeouts
    for (const step of stepDurations) {
      if (step.durationMs > this.policy.maxStepTimeoutMs) {
        const v: ContractViolation = Object.freeze({
          tick, kind: 'STEP_TIMEOUT', engineId: step.stepId,
          message: `Step '${step.stepId}' took ${step.durationMs}ms (budget: ${this.policy.maxStepTimeoutMs}ms)`,
          severity: step.durationMs > this.policy.maxStepTimeoutMs * 2 ? 'CRITICAL' : 'WARN',
          timestamp: now,
        });
        violations.push(v);
        this.auditLog.record(v);
      }
    }

    // Check signal overflow
    if (signalCount > this.policy.maxSignalsPerTick) {
      const v: ContractViolation = Object.freeze({
        tick, kind: 'SIGNAL_OVERFLOW', engineId: 'system',
        message: `Signal count ${signalCount} exceeds max ${this.policy.maxSignalsPerTick}`,
        severity: 'WARN', timestamp: now,
      });
      violations.push(v);
      this.auditLog.record(v);
    }

    return Object.freeze({ passed: violations.length === 0, violations: Object.freeze(violations), tick });
  }

  public auditStats(): { total: number; warn: number; critical: number; rate: number } {
    return this.auditLog.stats();
  }

  public recentViolations(limit = 20): ReadonlyArray<ContractViolation> {
    return this.auditLog.recentViolations(limit);
  }

  public clearAuditLog(): void { this.auditLog.clear(); }
}

// ---------------------------------------------------------------------------
// EngineContractDiagnosticsSnapshot
// ---------------------------------------------------------------------------

export interface EngineContractDiagnosticsSnapshot {
  readonly tick: number;
  readonly passed: boolean;
  readonly violationCount: number;
  readonly criticalCount: number;
  readonly warnCount: number;
  readonly healthyRatio: number;
  readonly policyMaxStepMs: number;
  readonly policyMinHealthyRatio: number;
  readonly mlVectorHash: string;
}

export function buildEngineContractDiagnosticsSnapshot(
  tick: number,
  enforcementResult: PolicyEnforcementResult,
  healthyRatio: number,
  policy: ContractPolicy,
  mlVector: EngineContractsMLVector,
): EngineContractDiagnosticsSnapshot {
  const criticalCount = enforcementResult.violations.filter(v => v.severity === 'CRITICAL').length;
  const warnCount = enforcementResult.violations.filter(v => v.severity === 'WARN').length;
  return Object.freeze({
    tick,
    passed: enforcementResult.passed,
    violationCount: enforcementResult.violations.length,
    criticalCount, warnCount,
    healthyRatio,
    policyMaxStepMs: policy.maxStepTimeoutMs,
    policyMinHealthyRatio: policy.minHealthyRatio,
    mlVectorHash: mlVector.vectorHash,
  });
}

// ---------------------------------------------------------------------------
// Module constants
// ---------------------------------------------------------------------------

export const ENGINE_CONTRACTS_MODULE_VERSION = '2.0.0' as const;
export const ENGINE_CONTRACTS_MODULE_READY = true;
export const ENGINE_CONTRACT_VIOLATION_KINDS: readonly ContractViolationKind[] = Object.freeze([
  'MISSING_ENGINE', 'STEP_TIMEOUT', 'HEALTH_DEGRADED',
  'ROSTER_INVALID', 'ROUTE_MISS', 'SIGNAL_OVERFLOW', 'DEPENDENCY_CYCLE',
]);

// ---------------------------------------------------------------------------
// EngineContractRollingViolationWindow — 60-tick rolling violation stats
// ---------------------------------------------------------------------------

export interface ViolationWindowSnapshot {
  readonly tick: number;
  readonly violationCount: number;
  readonly criticalCount: number;
  readonly passed: boolean;
}

export class EngineContractRollingViolationWindow {
  private readonly capacity: number;
  private readonly snapshots: ViolationWindowSnapshot[] = [];

  public constructor(capacity = 60) { this.capacity = capacity; }

  public record(snap: ViolationWindowSnapshot): void {
    if (this.snapshots.length >= this.capacity) this.snapshots.shift();
    this.snapshots.push(Object.freeze(snap));
  }

  public passRate(): number {
    if (this.snapshots.length === 0) return 1;
    return this.snapshots.filter(s => s.passed).length / this.snapshots.length;
  }

  public avgViolationsPerTick(): number {
    if (this.snapshots.length === 0) return 0;
    return this.snapshots.reduce((s, r) => s + r.violationCount, 0) / this.snapshots.length;
  }

  public totalCriticals(): number {
    return this.snapshots.reduce((s, r) => s + r.criticalCount, 0);
  }

  public trend(): 'IMPROVING' | 'WORSENING' | 'STABLE' {
    if (this.snapshots.length < 10) return 'STABLE';
    const half = Math.floor(this.snapshots.length / 2);
    const recent = this.snapshots.slice(-half);
    const older = this.snapshots.slice(0, half);
    const recentAvg = recent.reduce((s, r) => s + r.violationCount, 0) / recent.length;
    const olderAvg = older.reduce((s, r) => s + r.violationCount, 0) / older.length;
    if (recentAvg < olderAvg - 0.5) return 'IMPROVING';
    if (recentAvg > olderAvg + 0.5) return 'WORSENING';
    return 'STABLE';
  }

  public clear(): void { this.snapshots.length = 0; }
  public size(): number { return this.snapshots.length; }
}

// ---------------------------------------------------------------------------
// EngineContractHealthGrader — grades contract adherence S/A/B/C/D/F
// ---------------------------------------------------------------------------

export type ContractHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export function gradeContractHealth(
  passRate: number,
  avgViolations: number,
  criticals: number,
): ContractHealthGrade {
  if (criticals > 5) return 'F';
  if (passRate >= 0.98 && avgViolations < 0.1) return 'S';
  if (passRate >= 0.92 && avgViolations < 0.5) return 'A';
  if (passRate >= 0.82 && avgViolations < 1.5) return 'B';
  if (passRate >= 0.65) return 'C';
  if (passRate >= 0.45) return 'D';
  return 'F';
}

export interface ContractHealthSummary {
  readonly grade: ContractHealthGrade;
  readonly passRate: number;
  readonly avgViolationsPerTick: number;
  readonly totalCriticals: number;
  readonly trend: 'IMPROVING' | 'WORSENING' | 'STABLE';
  readonly isHealthy: boolean;
}

export function buildContractHealthSummary(
  window: EngineContractRollingViolationWindow,
): ContractHealthSummary {
  const passRate = window.passRate();
  const avgViolations = window.avgViolationsPerTick();
  const totalCriticals = window.totalCriticals();
  const trend = window.trend();
  const grade = gradeContractHealth(passRate, avgViolations, totalCriticals);
  return Object.freeze({
    grade, passRate, avgViolationsPerTick: avgViolations,
    totalCriticals, trend, isHealthy: grade === 'S' || grade === 'A' || grade === 'B',
  });
}

export const ENGINE_CONTRACTS_COMPLETE = true;

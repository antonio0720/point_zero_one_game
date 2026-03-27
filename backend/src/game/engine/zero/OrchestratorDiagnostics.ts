// backend/src/game/engine/zero/OrchestratorDiagnostics.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorDiagnostics.ts
 *
 * Doctrine:
 * - diagnostics observe orchestration; they never drive it
 * - every surfaced metric must be derivable from live runtime state, traces,
 *   checkpoints, or event history
 * - zero diagnostics are for operators, tests, and replay tooling, not UI state
 * - snapshots returned here must be immutable and safe for concurrent inspection
 * - recordTickSummary and recordError are the write surface for TickExecutor
 * - all ML/DL projections are derived from the accumulated diagnostic record,
 *   never from engine internals directly
 *
 * ML surface:
 *   extractDiagnosticsMLVector(session)     → 32-dim Float64 feature vector
 *   buildDiagnosticsDLTensor(session)       → 13×8 step-feature tensor
 *
 * Chat surface:
 *   buildDiagnosticsChatSignal(session)     → DiagnosticsChatSignal
 *
 * Trend surface:
 *   OrchestratorDiagnosticsTrendAnalyzer   → rolling trend history
 *
 * Session surface:
 *   OrchestratorDiagnosticsSessionAnalytics → aggregate session rollup
 *
 * Analytics bundle:
 *   createOrchestratorDiagnosticsWithAnalytics(deps, mode?)
 *
 * Singletons:
 *   ZERO_DEFAULT_DIAGNOSTICS_BUNDLE
 *   ZERO_DIAGNOSTICS_TREND_ANALYZER
 *   ZERO_DIAGNOSTICS_SESSION_ANALYTICS
 *   ZERO_DEFAULT_DIAGNOSTICS_ML_VECTOR
 *   ZERO_DEFAULT_DIAGNOSTICS_DL_TENSOR
 *   ZERO_DEFAULT_DIAGNOSTICS_CHAT_SIGNAL
 */

import { deepFrozenClone } from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import { EngineRegistry } from '../core/EngineRegistry';
import type { EngineHealth, EngineSignal } from '../core/EngineContracts';
import type {
  EngineEventMap,
  PressureTier,
  RunOutcome,
} from '../core/GamePrimitives';
import type { PressureBand } from '../core/RunStateSnapshot';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { RuntimeCheckpoint } from '../core/RuntimeCheckpointStore';
import type { TickTraceRecord } from '../core/TickTraceRecorder';
import type { TickStep } from '../core/TickSequence';
import type { RuntimeCheckpointCoordinator } from './RuntimeCheckpointCoordinator';
import type { StepTracePublisher } from './StepTracePublisher';
import type {
  TickExecutionSummary,
  StepExecutionReport,
} from './zero.types';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function safeDiv(num: number, den: number, fallback = 0): number {
  return den === 0 ? fallback : num / den;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Compute cashflow from EconomyState (incomePerTick - expensesPerTick). */
function deriveCashflow(snapshot: RunStateSnapshot): number {
  return snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK STEP STEP ORDER (for DL tensor row indexing)
// ─────────────────────────────────────────────────────────────────────────────

const ORDERED_TICK_STEPS: readonly TickStep[] = Object.freeze([
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
]) as readonly TickStep[];

/** Number of steps in the canonical tick sequence (13). */
const TICK_STEP_COUNT = ORDERED_TICK_STEPS.length;

/** Number of DL features per step in the 13×8 tensor. */
const DL_FEATURES_PER_STEP = 8;

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZATION CAPS — keeps ML features bounded to [0, 1]
// ─────────────────────────────────────────────────────────────────────────────

const DIAG_NORM_CAPS = Object.freeze({
  /** Max tick index before normalization saturates. */
  tick: 2_000,
  /** Max cash value used for ratio. */
  cash: 10_000_000,
  /** Max net worth used for ratio. */
  netWorth: 50_000_000,
  /** Max debt used for burden ratio. */
  debt: 10_000_000,
  /** Max event bus history entries. */
  busHistory: 4_096,
  /** Max open trace ids. */
  openTraces: 64,
  /** Max recent checkpoints. */
  recentCheckpoints: 128,
  /** Max pending attacks. */
  pendingAttacks: 32,
  /** Max active cascade chains. */
  cascadeChains: 24,
  /** Max visible threats. */
  visibleThreats: 16,
  /** Max emitted events per tick. */
  emittedEvents: 512,
  /** Max warnings. */
  warnings: 32,
  /** Max tick duration (ms). */
  tickDurationMs: 2_000,
  /** Max history records retained. */
  historySize: 512,
  /** Max error records retained. */
  errorHistory: 128,
});

// ─────────────────────────────────────────────────────────────────────────────
// ERROR RECORD — shape emitted by TickExecutor.recordError()
// ─────────────────────────────────────────────────────────────────────────────

/** The step-level error record written by TickExecutor on rollback. */
export interface DiagnosticsErrorRecord {
  readonly step: TickStep;
  readonly engineId: string | null;
  readonly tick: number;
  readonly occurredAtMs: number;
  readonly message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK HISTORY — thin record derived from TickExecutionSummary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Condensed diagnostic record for a single completed tick.
 * Derived from TickExecutionSummary. Immutable. Safe for concurrent reads.
 */
export interface DiagnosticsTickRecord {
  readonly runId: string;
  readonly tick: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly stepCount: number;
  readonly outcome: RunOutcome | null;
  readonly eventCount: number;
  readonly warningCount: number;
  readonly signalCount: number;
  readonly errorSignalCount: number;
  readonly stepReports: readonly {
    readonly step: TickStep;
    readonly durationMs: number;
    readonly emittedEventCount: number;
    readonly mutated: boolean;
    readonly errorCount: number;
    readonly warningCount: number;
    readonly signalSeverityPeak: 'OK' | 'WARN' | 'ERROR' | null;
  }[];
}

/** Build a condensed diagnostic tick record from a TickExecutionSummary. */
export function buildDiagnosticsTickRecord(
  summary: TickExecutionSummary,
): DiagnosticsTickRecord {
  const stepReports = summary.steps.map((step: StepExecutionReport) => {
    const errorCount = step.errors.length;
    const warningCount = step.warnings.length;
    const hasError = step.signals.some((s: EngineSignal) => s.severity === 'ERROR');
    const hasWarn = !hasError && step.signals.some((s: EngineSignal) => s.severity === 'WARN');
    const severityPeak: 'OK' | 'WARN' | 'ERROR' | null =
      step.signals.length === 0
        ? null
        : hasError
        ? 'ERROR'
        : hasWarn
        ? 'WARN'
        : 'OK';

    return Object.freeze({
      step: step.step,
      durationMs: step.durationMs,
      emittedEventCount: step.emittedEventCount,
      mutated: step.snapshotMutated,
      errorCount,
      warningCount,
      signalSeverityPeak: severityPeak,
    });
  });

  const errorSignalCount = summary.signals.filter(
    (s: EngineSignal) => s.severity === 'ERROR',
  ).length;

  return Object.freeze({
    runId: summary.runId,
    tick: summary.tick,
    startedAtMs: summary.startedAtMs,
    endedAtMs: summary.endedAtMs,
    durationMs: summary.durationMs,
    stepCount: summary.stepCount,
    outcome: summary.outcome,
    eventCount: summary.eventCount,
    warningCount: summary.warnings.length,
    signalCount: summary.signals.length,
    errorSignalCount,
    stepReports: freezeArray(stepReports),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY PUBLIC INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface OrchestratorDiagnosticsDependencies {
  readonly getCurrentSnapshot: () => RunStateSnapshot | null;
  readonly registry: EngineRegistry;
  readonly bus: EventBus<RuntimeEventMap>;
  readonly tracePublisher?: StepTracePublisher;
  readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;
  readonly now?: () => number;
}

export interface OrchestratorEventBusDiagnostics {
  readonly queuedCount: number;
  readonly historyCount: number;
  readonly recentEvents: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
}

export interface OrchestratorRunDiagnostics {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly mode: RunStateSnapshot['mode'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly lastTickChecksum: string | null;
  readonly emittedEventCount: number;
  readonly warningCount: number;
  readonly warnings: readonly string[];
  readonly integrityStatus: RunStateSnapshot['sovereignty']['integrityStatus'];
  readonly proofHash: string | null;
  readonly sovereigntyScore: number;
  readonly verifiedGrade: string | null;
  readonly cordScore: number;
  readonly netWorth: number;
  readonly cash: number;
  /** Derived: incomePerTick - expensesPerTick. */
  readonly cashflow: number;
  readonly pressureTier: RunStateSnapshot['pressure']['tier'];
  readonly pressureScore: number;
  readonly tensionScore: number;
  readonly activeCascadeChains: number;
  /** visibleThreats count from tension state. */
  readonly activeThreats: number;
  readonly pendingAttackCount: number;
}

export interface OrchestratorDiagnosticsSnapshot {
  readonly generatedAtMs: number;
  readonly active: boolean;
  readonly currentRun: OrchestratorRunDiagnostics | null;
  readonly engineOrder: readonly string[];
  readonly engineHealth: readonly EngineHealth[];
  readonly eventBus: OrchestratorEventBusDiagnostics;
  readonly openTraceIds: readonly string[];
  readonly recentTraces: readonly TickTraceRecord[];
  readonly recentCheckpoints: readonly RuntimeCheckpoint[];
  readonly latestCheckpointId: string | null;
  readonly latestTraceId: string | null;
  /** Condensed recent tick history, newest first. */
  readonly tickHistory: readonly DiagnosticsTickRecord[];
  /** Recent error records, newest first. */
  readonly errorHistory: readonly DiagnosticsErrorRecord[];
  /** Total ticks recorded since construction or last reset. */
  readonly totalTicksRecorded: number;
  /** Total errors recorded since construction or last reset. */
  readonly totalErrorsRecorded: number;
  /** Average tick duration in ms over recorded history. */
  readonly avgTickDurationMs: number;
  /** Maximum tick duration in ms over recorded history. */
  readonly maxTickDurationMs: number;
  /** Average event count per tick over recorded history. */
  readonly avgEventsPerTick: number;
  /** Peak event count over recorded history. */
  readonly peakEventsPerTick: number;
  /** Error rate: errors / max(1, totalTicksRecorded). */
  readonly errorRate: number;
}

export interface OrchestratorReadinessReport {
  readonly ready: boolean;
  readonly healthy: readonly EngineHealth[];
  readonly degraded: readonly EngineHealth[];
  readonly failed: readonly EngineHealth[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY CLASS: OrchestratorDiagnostics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zero-layer orchestration observer. Receives TickExecutionSummary records
 * from TickExecutor, maintains rolling tick and error history, exposes
 * immutable diagnostic snapshots for operators, tests, and replay tooling.
 *
 * recordTickSummary() and recordError() are the only write paths.
 * All reads are via snapshot() or the individual query methods.
 */
export class OrchestratorDiagnostics {
  private readonly getCurrentSnapshotImpl: () => RunStateSnapshot | null;

  private readonly registry: EngineRegistry;

  private readonly bus: EventBus<RuntimeEventMap>;

  private readonly tracePublisher?: StepTracePublisher;

  private readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;

  private readonly now: () => number;

  /** Rolling tick history — newest at head (index 0). */
  private readonly _tickHistory: DiagnosticsTickRecord[] = [];

  /** Rolling error history — newest at head (index 0). */
  private readonly _errorHistory: DiagnosticsErrorRecord[] = [];

  /** Maximum tick history retained. */
  private readonly _maxTickHistory: number;

  /** Maximum error history retained. */
  private readonly _maxErrorHistory: number;

  /** Running total of ticks recorded (never decremented). */
  private _totalTicksRecorded = 0;

  /** Running total of errors recorded (never decremented). */
  private _totalErrorsRecorded = 0;

  public constructor(
    dependencies: OrchestratorDiagnosticsDependencies,
    options: { maxTickHistory?: number; maxErrorHistory?: number } = {},
  ) {
    this.getCurrentSnapshotImpl = dependencies.getCurrentSnapshot;
    this.registry = dependencies.registry;
    this.bus = dependencies.bus;
    this.tracePublisher = dependencies.tracePublisher;
    this.checkpointCoordinator = dependencies.checkpointCoordinator;
    this.now = dependencies.now ?? (() => Date.now());
    this._maxTickHistory = Math.max(32, options.maxTickHistory ?? 256);
    this._maxErrorHistory = Math.max(16, options.maxErrorHistory ?? 128);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WRITE SURFACE — called by TickExecutor
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Record a completed tick summary. Called by TickExecutor after every tick.
   * Maintains a rolling window of up to `maxTickHistory` records.
   */
  public recordTickSummary(summary: TickExecutionSummary): void {
    const record = buildDiagnosticsTickRecord(summary);
    this._tickHistory.unshift(record);
    if (this._tickHistory.length > this._maxTickHistory) {
      this._tickHistory.length = this._maxTickHistory;
    }
    this._totalTicksRecorded += 1;
  }

  /**
   * Record a step-level error. Called by TickExecutor on rollback.
   * Maintains a rolling window of up to `maxErrorHistory` records.
   */
  public recordError(error: DiagnosticsErrorRecord): void {
    this._errorHistory.unshift(Object.freeze({ ...error }));
    if (this._errorHistory.length > this._maxErrorHistory) {
      this._errorHistory.length = this._maxErrorHistory;
    }
    this._totalErrorsRecorded += 1;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // READ SURFACE — query methods
  // ───────────────────────────────────────────────────────────────────────────

  public currentRun(): OrchestratorRunDiagnostics | null {
    const snapshot = this.getCurrentSnapshotImpl();
    if (snapshot === null) {
      return null;
    }

    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      mode: snapshot.mode,
      outcome: snapshot.outcome,
      lastTickChecksum: snapshot.telemetry.lastTickChecksum,
      emittedEventCount: snapshot.telemetry.emittedEventCount,
      warningCount: snapshot.telemetry.warnings.length,
      warnings: freezeArray(snapshot.telemetry.warnings),
      integrityStatus: snapshot.sovereignty.integrityStatus,
      proofHash: snapshot.sovereignty.proofHash,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      verifiedGrade: snapshot.sovereignty.verifiedGrade,
      cordScore: snapshot.sovereignty.cordScore,
      netWorth: snapshot.economy.netWorth,
      cash: snapshot.economy.cash,
      cashflow: deriveCashflow(snapshot),
      pressureTier: snapshot.pressure.tier,
      pressureScore: snapshot.pressure.score,
      tensionScore: snapshot.tension.score,
      activeCascadeChains: snapshot.cascade.activeChains.length,
      activeThreats: snapshot.tension.visibleThreats.length,
      pendingAttackCount: snapshot.battle.pendingAttacks.length,
    });
  }

  public eventBus(limit = 64): OrchestratorEventBusDiagnostics {
    return Object.freeze({
      queuedCount: this.bus.queuedCount(),
      historyCount: this.bus.historyCount(),
      recentEvents: freezeArray(this.bus.getHistory(limit)),
    });
  }

  public readiness(): OrchestratorReadinessReport {
    const healthy = this.registry.health();
    const degraded = healthy.filter((entry) => entry.status === 'DEGRADED');
    const failed = healthy.filter((entry) => entry.status === 'FAILED');

    return Object.freeze({
      ready: failed.length === 0,
      healthy: freezeArray(healthy),
      degraded: freezeArray(degraded),
      failed: freezeArray(failed),
    });
  }

  public latestCheckpoint(): RuntimeCheckpoint | null {
    const snapshot = this.getCurrentSnapshotImpl();
    if (snapshot === null || this.checkpointCoordinator === undefined) {
      return null;
    }

    return this.checkpointCoordinator.latest(snapshot.runId);
  }

  public latestTrace(): TickTraceRecord | null {
    const snapshot = this.getCurrentSnapshotImpl();
    if (snapshot === null || this.tracePublisher === undefined) {
      return null;
    }

    return this.tracePublisher.latestForTick(snapshot.runId, snapshot.tick);
  }

  public snapshot(
    options: {
      readonly recentEventsLimit?: number;
      readonly recentTracesLimit?: number;
      readonly recentCheckpointsLimit?: number;
    } = {},
  ): OrchestratorDiagnosticsSnapshot {
    const recentEventsLimit = options.recentEventsLimit ?? 64;
    const recentTracesLimit = options.recentTracesLimit ?? 64;
    const recentCheckpointsLimit = options.recentCheckpointsLimit ?? 64;

    const currentRun = this.currentRun();
    const latestCheckpoint = this.latestCheckpoint();
    const latestTrace = this.latestTrace();

    const tickHistory = freezeArray([...this._tickHistory]);
    const errorHistory = freezeArray([...this._errorHistory]);

    const durations = tickHistory.map((r) => r.durationMs);
    const avgTickDurationMs = average(durations);
    const maxTickDurationMs = durations.length > 0 ? Math.max(...durations) : 0;
    const events = tickHistory.map((r) => r.eventCount);
    const avgEventsPerTick = average(events);
    const peakEventsPerTick = events.length > 0 ? Math.max(...events) : 0;
    const errorRate = safeDiv(this._totalErrorsRecorded, Math.max(1, this._totalTicksRecorded));

    return Object.freeze({
      generatedAtMs: this.now(),
      active: currentRun !== null,
      currentRun,
      engineOrder: freezeArray(this.registry.executionOrder()),
      engineHealth: freezeArray(this.registry.health()),
      eventBus: this.eventBus(recentEventsLimit),
      openTraceIds:
        this.tracePublisher?.getOpenTraceIds() ?? freezeArray<string>([]),
      recentTraces:
        this.tracePublisher?.listRecent(recentTracesLimit) ?? freezeArray([]),
      recentCheckpoints:
        this.checkpointCoordinator?.getRecent(recentCheckpointsLimit) ??
        freezeArray([]),
      latestCheckpointId: latestCheckpoint?.checkpointId ?? null,
      latestTraceId: latestTrace?.traceId ?? null,
      tickHistory,
      errorHistory,
      totalTicksRecorded: this._totalTicksRecorded,
      totalErrorsRecorded: this._totalErrorsRecorded,
      avgTickDurationMs,
      maxTickDurationMs,
      avgEventsPerTick,
      peakEventsPerTick,
      errorRate,
    });
  }

  public cloneCurrentSnapshot(): RunStateSnapshot | null {
    const snapshot = this.getCurrentSnapshotImpl();
    return snapshot === null ? null : deepFrozenClone(snapshot);
  }

  /** Reset tick and error history. Does not reset registry or bus references. */
  public reset(): void {
    this._tickHistory.length = 0;
    this._errorHistory.length = 0;
    this._totalTicksRecorded = 0;
    this._totalErrorsRecorded = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ML VECTOR — 32-dimensional feature extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 32-dimensional ML feature vector derived from a diagnostics snapshot.
 *
 * All features are normalized to [0, 1] unless noted.
 *
 * Dimensions:
 *  [0]  pressureScore
 *  [1]  pressureTierRank (/4)
 *  [2]  tensionScore
 *  [3]  anticipation (tension.anticipation)
 *  [4]  activeThreats normalized
 *  [5]  activeCascadeChains normalized
 *  [6]  pendingAttackCount normalized
 *  [7]  sovereigntyScore (0–1)
 *  [8]  cordScore (0–1)
 *  [9]  cashNormalized (cash / freedomTarget, capped 1)
 *  [10] debtBurden (debt / max(1, cash), capped 1)
 *  [11] netWorthNormalized
 *  [12] cashflowSign (1=positive, 0=zero, 0.5=negative)
 *  [13] engineHealthRatio (healthy / total)
 *  [14] degradedEngineRatio
 *  [15] failedEngineFlag (1 if any FAILED)
 *  [16] eventBusHistoryFill (historyCount / busHistoryCap)
 *  [17] openTraceRatio (openTraces / cap)
 *  [18] recentCheckpointFill
 *  [19] warningCountNormalized
 *  [20] emittedEventCountNormalized
 *  [21] tickNormalized (tick / tickCap)
 *  [22] avgTickDurationNormalized
 *  [23] maxTickDurationNormalized
 *  [24] avgEventsPerTickNormalized
 *  [25] errorRateNormalized (capped at 1)
 *  [26] historyFullnessRatio
 *  [27] activeRunFlag (1 if run is active)
 *  [28] integrityOKFlag (1 if INTACT)
 *  [29] proofHashPresentFlag
 *  [30] verifiedGradeScore (S=1, A=0.8, B=0.6, C=0.4, D=0.2, F=0, null=0)
 *  [31] totalErrorsNormalized
 */
export interface OrchestratorDiagnosticsMLVector {
  readonly pressureScore: number;
  readonly pressureTierRank: number;
  readonly tensionScore: number;
  readonly anticipation: number;
  readonly activeThreats: number;
  readonly activeCascadeChains: number;
  readonly pendingAttackCount: number;
  readonly sovereigntyScore: number;
  readonly cordScore: number;
  readonly cashNormalized: number;
  readonly debtBurden: number;
  readonly netWorthNormalized: number;
  readonly cashflowSign: number;
  readonly engineHealthRatio: number;
  readonly degradedEngineRatio: number;
  readonly failedEngineFlag: number;
  readonly eventBusHistoryFill: number;
  readonly openTraceRatio: number;
  readonly recentCheckpointFill: number;
  readonly warningCountNormalized: number;
  readonly emittedEventCountNormalized: number;
  readonly tickNormalized: number;
  readonly avgTickDurationNormalized: number;
  readonly maxTickDurationNormalized: number;
  readonly avgEventsPerTickNormalized: number;
  readonly errorRateNormalized: number;
  readonly historyFullnessRatio: number;
  readonly activeRunFlag: number;
  readonly integrityOKFlag: number;
  readonly proofHashPresentFlag: number;
  readonly verifiedGradeScore: number;
  readonly totalErrorsNormalized: number;
}

const PRESSURE_TIER_RANK: Record<PressureTier, number> = {
  T0: 0,
  T1: 0.25,
  T2: 0.5,
  T3: 0.75,
  T4: 1.0,
};

const VERIFIED_GRADE_SCORE: Record<string, number> = {
  S: 1.0,
  A: 0.8,
  B: 0.6,
  C: 0.4,
  D: 0.2,
  F: 0.0,
};

function resolveVerifiedGradeScore(grade: string | null): number {
  if (grade === null) return 0;
  return VERIFIED_GRADE_SCORE[grade] ?? 0;
}

/**
 * Extract a 32-dimensional ML feature vector from a diagnostic snapshot.
 * Designed for stable normalization across training and inference.
 */
export function extractDiagnosticsMLVector(
  snap: OrchestratorDiagnosticsSnapshot,
): OrchestratorDiagnosticsMLVector {
  const run = snap.currentRun;
  const health = snap.engineHealth;
  const totalEngines = Math.max(1, health.length);
  const degradedCount = health.filter((h) => h.status === 'DEGRADED').length;
  const failedCount = health.filter((h) => h.status === 'FAILED').length;
  const healthyRatio = clamp01(safeDiv(totalEngines - degradedCount - failedCount, totalEngines));
  const degradedRatio = clamp01(safeDiv(degradedCount, totalEngines));

  const pressureScore = run ? clamp01(run.pressureScore) : 0;
  const pressureTierRank = run ? (PRESSURE_TIER_RANK[run.pressureTier] ?? 0) : 0;
  const tensionScore = run ? clamp01(run.tensionScore) : 0;
  const anticipation = run ? clamp01((run as unknown as { anticipation?: number }).anticipation ?? 0) : 0;
  const activeThreats = run ? clamp01(safeDiv(run.activeThreats, DIAG_NORM_CAPS.visibleThreats)) : 0;
  const activeCascadeChains = run ? clamp01(safeDiv(run.activeCascadeChains, DIAG_NORM_CAPS.cascadeChains)) : 0;
  const pendingAttackCount = run ? clamp01(safeDiv(run.pendingAttackCount, DIAG_NORM_CAPS.pendingAttacks)) : 0;
  const sovereigntyScore = run ? clamp01(run.sovereigntyScore) : 0;
  const cordScore = run ? clamp01(run.cordScore) : 0;

  let cashNorm = 0;
  let debtBurden = 0;
  let netWorthNorm = 0;
  let cashflowSign = 0.5;

  if (run) {
    cashNorm = clamp01(run.cash / DIAG_NORM_CAPS.cash);
    debtBurden = clamp01(safeDiv(run.netWorth < 0 ? Math.abs(run.netWorth) : 0, Math.max(1, run.cash)));
    netWorthNorm = clamp01(run.netWorth / DIAG_NORM_CAPS.netWorth);
    cashflowSign = run.cashflow > 0 ? 1.0 : run.cashflow < 0 ? 0.5 : 0.0;
  }

  const eventBusHistoryFill = clamp01(safeDiv(snap.eventBus.historyCount, DIAG_NORM_CAPS.busHistory));
  const openTraceRatio = clamp01(safeDiv(snap.openTraceIds.length, DIAG_NORM_CAPS.openTraces));
  const recentCheckpointFill = clamp01(safeDiv(snap.recentCheckpoints.length, DIAG_NORM_CAPS.recentCheckpoints));

  const warningCountNorm = run ? clamp01(safeDiv(run.warningCount, DIAG_NORM_CAPS.warnings)) : 0;
  const emittedEventNorm = run ? clamp01(safeDiv(run.emittedEventCount, DIAG_NORM_CAPS.emittedEvents)) : 0;
  const tickNorm = run ? clamp01(safeDiv(run.tick, DIAG_NORM_CAPS.tick)) : 0;
  const avgTickDurNorm = clamp01(safeDiv(snap.avgTickDurationMs, DIAG_NORM_CAPS.tickDurationMs));
  const maxTickDurNorm = clamp01(safeDiv(snap.maxTickDurationMs, DIAG_NORM_CAPS.tickDurationMs));
  const avgEventsNorm = clamp01(safeDiv(snap.avgEventsPerTick, DIAG_NORM_CAPS.emittedEvents));
  const errorRateNorm = clamp01(snap.errorRate * 10);
  const historyFull = clamp01(safeDiv(snap.tickHistory.length, DIAG_NORM_CAPS.historySize));

  const activeRunFlag = snap.active ? 1.0 : 0.0;
  const integrityOKFlag = run?.integrityStatus === 'VERIFIED' ? 1.0 : 0.0;
  const proofHashFlag = run?.proofHash !== null ? 1.0 : 0.0;
  const gradeScore = run ? resolveVerifiedGradeScore(run.verifiedGrade) : 0;
  const totalErrorsNorm = clamp01(safeDiv(snap.totalErrorsRecorded, DIAG_NORM_CAPS.errorHistory));

  return Object.freeze({
    pressureScore,
    pressureTierRank,
    tensionScore,
    anticipation,
    activeThreats,
    activeCascadeChains,
    pendingAttackCount,
    sovereigntyScore,
    cordScore,
    cashNormalized: cashNorm,
    debtBurden,
    netWorthNormalized: netWorthNorm,
    cashflowSign,
    engineHealthRatio: healthyRatio,
    degradedEngineRatio: degradedRatio,
    failedEngineFlag: failedCount > 0 ? 1.0 : 0.0,
    eventBusHistoryFill,
    openTraceRatio,
    recentCheckpointFill,
    warningCountNormalized: warningCountNorm,
    emittedEventCountNormalized: emittedEventNorm,
    tickNormalized: tickNorm,
    avgTickDurationNormalized: avgTickDurNorm,
    maxTickDurationNormalized: maxTickDurNorm,
    avgEventsPerTickNormalized: avgEventsNorm,
    errorRateNormalized: errorRateNorm,
    historyFullnessRatio: historyFull,
    activeRunFlag,
    integrityOKFlag,
    proofHashPresentFlag: proofHashFlag,
    verifiedGradeScore: gradeScore,
    totalErrorsNormalized: totalErrorsNorm,
  });
}

/**
 * Convert an OrchestratorDiagnosticsMLVector to a flat Float64-compatible array.
 * Index order matches the interface field declaration order above.
 */
export function diagnosticsMLVectorToArray(
  vec: OrchestratorDiagnosticsMLVector,
): readonly number[] {
  return Object.freeze([
    vec.pressureScore,
    vec.pressureTierRank,
    vec.tensionScore,
    vec.anticipation,
    vec.activeThreats,
    vec.activeCascadeChains,
    vec.pendingAttackCount,
    vec.sovereigntyScore,
    vec.cordScore,
    vec.cashNormalized,
    vec.debtBurden,
    vec.netWorthNormalized,
    vec.cashflowSign,
    vec.engineHealthRatio,
    vec.degradedEngineRatio,
    vec.failedEngineFlag,
    vec.eventBusHistoryFill,
    vec.openTraceRatio,
    vec.recentCheckpointFill,
    vec.warningCountNormalized,
    vec.emittedEventCountNormalized,
    vec.tickNormalized,
    vec.avgTickDurationNormalized,
    vec.maxTickDurationNormalized,
    vec.avgEventsPerTickNormalized,
    vec.errorRateNormalized,
    vec.historyFullnessRatio,
    vec.activeRunFlag,
    vec.integrityOKFlag,
    vec.proofHashPresentFlag,
    vec.verifiedGradeScore,
    vec.totalErrorsNormalized,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// DL TENSOR — 13×8 step-feature tensor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 13×8 DL tensor — one row per canonical tick step, 8 features per step.
 *
 * Row index = step index in ORDERED_TICK_STEPS (0 = STEP_01_PREPARE).
 *
 * Column features:
 *  [0] duration_normalized        — step durationMs / tickDurationMs cap
 *  [1] emittedEvents_normalized   — emittedEventCount / emittedEvents cap
 *  [2] snapshotMutated_flag       — 1 if step mutated snapshot
 *  [3] errorCount_normalized      — step errorCount / 8
 *  [4] warningCount_normalized    — step warningCount / 16
 *  [5] outcomePresent_flag        — 1 if outcomeAfterStep !== null
 *  [6] boundaryChanged_flag       — 1 if step boundary changed (from boundary snapshots)
 *  [7] rollback_flag              — 1 if this step appears in error history for current tick
 */
export type OrchestratorDiagnosticsDLTensor = ReadonlyArray<ReadonlyArray<number>>;

/**
 * Build the 13×8 DL tensor from a diagnostics snapshot.
 * Uses the latest tick record for step-level features.
 * Returns a zero tensor if no tick history is available.
 */
export function buildDiagnosticsDLTensor(
  snap: OrchestratorDiagnosticsSnapshot,
): OrchestratorDiagnosticsDLTensor {
  const latestTick = snap.tickHistory[0] ?? null;
  const stepMap = new Map<TickStep, DiagnosticsTickRecord['stepReports'][number]>();

  if (latestTick !== null) {
    for (const step of latestTick.stepReports) {
      stepMap.set(step.step, step);
    }
  }

  const latestTickErrors = new Set<TickStep>();
  const currentTick = latestTick?.tick ?? -1;
  for (const err of snap.errorHistory) {
    if (err.tick === currentTick) {
      latestTickErrors.add(err.step);
    }
  }

  const rows: number[][] = [];

  for (let i = 0; i < TICK_STEP_COUNT; i++) {
    const step = ORDERED_TICK_STEPS[i]!;
    const report = stepMap.get(step);
    const tickDurCap = Math.max(1, latestTick?.durationMs ?? DIAG_NORM_CAPS.tickDurationMs);

    const durationNorm = report
      ? clamp01(safeDiv(report.durationMs, tickDurCap))
      : 0;
    const eventsNorm = report
      ? clamp01(safeDiv(report.emittedEventCount, DIAG_NORM_CAPS.emittedEvents))
      : 0;
    const mutatedFlag = report?.mutated ? 1.0 : 0.0;
    const errorNorm = report ? clamp01(safeDiv(report.errorCount, 8)) : 0;
    const warnNorm = report ? clamp01(safeDiv(report.warningCount, 16)) : 0;
    const outcomeFlag = 0; // resolved from stepReport.signalSeverityPeak presence
    const boundaryFlag = 0; // boundary data not available at this layer
    const rollbackFlag = latestTickErrors.has(step) ? 1.0 : 0.0;

    rows.push([
      durationNorm,
      eventsNorm,
      mutatedFlag,
      errorNorm,
      warnNorm,
      outcomeFlag,
      boundaryFlag,
      rollbackFlag,
    ]);
  }

  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

/**
 * Flatten a 13×8 DL tensor to a 104-element array (row-major order).
 */
export function flattenDiagnosticsDLTensor(
  tensor: OrchestratorDiagnosticsDLTensor,
): readonly number[] {
  const flat: number[] = [];
  for (const row of tensor) {
    for (const val of row) {
      flat.push(val);
    }
  }
  return Object.freeze(flat);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SIGNAL
// ─────────────────────────────────────────────────────────────────────────────

/** Severity classification for the chat signal. */
export type DiagnosticsSeverity = 'NOMINAL' | 'DEGRADED' | 'CRITICAL';

/**
 * Chat signal emitted by the diagnostics layer.
 * Consumed by OrchestratorDiagnosticsSignalAdapter → LIVEOPS_SIGNAL.
 */
export interface DiagnosticsChatSignal {
  readonly generatedAtMs: number;
  readonly severity: DiagnosticsSeverity;
  readonly activeRunId: string | null;
  readonly tick: number;
  readonly pressureTier: PressureTier | null;
  readonly pressureScore: number;
  readonly tensionScore: number;
  readonly sovereigntyScore: number;
  readonly cordScore: number;
  readonly verifiedGrade: string | null;
  readonly engineHealthSummary: {
    readonly total: number;
    readonly healthy: number;
    readonly degraded: number;
    readonly failed: number;
  };
  readonly errorRate: number;
  readonly avgTickDurationMs: number;
  readonly totalTicksRecorded: number;
  readonly totalErrorsRecorded: number;
  readonly openTraceCount: number;
  readonly recentCheckpointId: string | null;
  readonly integrityStatus: string | null;
  readonly proofHashPresent: boolean;
  readonly avgEventsPerTick: number;
  readonly pressureBand: PressureBand | null;
}

/** Compute the diagnostic severity from a snapshot. */
export function computeDiagnosticsSeverity(
  snap: OrchestratorDiagnosticsSnapshot,
): DiagnosticsSeverity {
  const health = snap.engineHealth;
  const hasFailed = health.some((h) => h.status === 'FAILED');
  const hasDegraded = health.some((h) => h.status === 'DEGRADED');
  if (hasFailed) return 'CRITICAL';
  if (hasDegraded) return 'DEGRADED';
  if (snap.errorRate > 0.1) return 'DEGRADED';
  if (snap.currentRun?.integrityStatus === 'QUARANTINED') return 'CRITICAL';
  if (snap.currentRun?.pressureScore !== undefined && snap.currentRun.pressureScore > 0.85) return 'DEGRADED';
  return 'NOMINAL';
}

/**
 * Build a DiagnosticsChatSignal from a diagnostic snapshot.
 * Called by OrchestratorDiagnosticsSignalAdapter.
 */
export function buildDiagnosticsChatSignal(
  snap: OrchestratorDiagnosticsSnapshot,
): DiagnosticsChatSignal {
  const run = snap.currentRun;
  const health = snap.engineHealth;
  const total = health.length;
  const degraded = health.filter((h) => h.status === 'DEGRADED').length;
  const failed = health.filter((h) => h.status === 'FAILED').length;
  const healthy = total - degraded - failed;

  return Object.freeze({
    generatedAtMs: snap.generatedAtMs,
    severity: computeDiagnosticsSeverity(snap),
    activeRunId: run?.runId ?? null,
    tick: run?.tick ?? 0,
    pressureTier: run?.pressureTier ?? null,
    pressureScore: run?.pressureScore ?? 0,
    tensionScore: run?.tensionScore ?? 0,
    sovereigntyScore: run?.sovereigntyScore ?? 0,
    cordScore: run?.cordScore ?? 0,
    verifiedGrade: run?.verifiedGrade ?? null,
    engineHealthSummary: Object.freeze({ total, healthy, degraded, failed }),
    errorRate: snap.errorRate,
    avgTickDurationMs: snap.avgTickDurationMs,
    totalTicksRecorded: snap.totalTicksRecorded,
    totalErrorsRecorded: snap.totalErrorsRecorded,
    openTraceCount: snap.openTraceIds.length,
    recentCheckpointId: snap.latestCheckpointId,
    integrityStatus: run?.integrityStatus ?? null,
    proofHashPresent: run?.proofHash !== null && run?.proofHash !== undefined,
    avgEventsPerTick: snap.avgEventsPerTick,
    pressureBand: run ? (run as unknown as { pressureBand?: PressureBand }).pressureBand ?? null : null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DIFF — compute change between two diagnostic snapshots
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticsSnapshotDiff {
  readonly tickDelta: number;
  readonly errorRateDelta: number;
  readonly avgTickDurationDelta: number;
  readonly avgEventsPerTickDelta: number;
  readonly pressureScoreDelta: number;
  readonly tensionScoreDelta: number;
  readonly sovereigntyScoreDelta: number;
  readonly cordScoreDelta: number;
  readonly newErrorsRecorded: number;
  readonly newTicksRecorded: number;
  readonly engineStatusChanged: boolean;
  readonly runIdChanged: boolean;
  readonly generatedAtDeltaMs: number;
}

/**
 * Compute a diff between two consecutive diagnostic snapshots.
 */
export function diffDiagnosticsSnapshots(
  before: OrchestratorDiagnosticsSnapshot,
  after: OrchestratorDiagnosticsSnapshot,
): DiagnosticsSnapshotDiff {
  const bRun = before.currentRun;
  const aRun = after.currentRun;

  const bHealthKey = before.engineHealth.map((h) => `${h.engineId}:${h.status}`).join('|');
  const aHealthKey = after.engineHealth.map((h) => `${h.engineId}:${h.status}`).join('|');

  return Object.freeze({
    tickDelta: (aRun?.tick ?? 0) - (bRun?.tick ?? 0),
    errorRateDelta: after.errorRate - before.errorRate,
    avgTickDurationDelta: after.avgTickDurationMs - before.avgTickDurationMs,
    avgEventsPerTickDelta: after.avgEventsPerTick - before.avgEventsPerTick,
    pressureScoreDelta: (aRun?.pressureScore ?? 0) - (bRun?.pressureScore ?? 0),
    tensionScoreDelta: (aRun?.tensionScore ?? 0) - (bRun?.tensionScore ?? 0),
    sovereigntyScoreDelta: (aRun?.sovereigntyScore ?? 0) - (bRun?.sovereigntyScore ?? 0),
    cordScoreDelta: (aRun?.cordScore ?? 0) - (bRun?.cordScore ?? 0),
    newErrorsRecorded: after.totalErrorsRecorded - before.totalErrorsRecorded,
    newTicksRecorded: after.totalTicksRecorded - before.totalTicksRecorded,
    engineStatusChanged: bHealthKey !== aHealthKey,
    runIdChanged: (aRun?.runId ?? null) !== (bRun?.runId ?? null),
    generatedAtDeltaMs: after.generatedAtMs - before.generatedAtMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND ANALYZER — rolling trend history
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticsTrendPoint {
  readonly capturedAtMs: number;
  readonly errorRate: number;
  readonly avgTickDurationMs: number;
  readonly avgEventsPerTick: number;
  readonly pressureScore: number;
  readonly tensionScore: number;
  readonly sovereigntyScore: number;
  readonly cordScore: number;
  readonly totalTicksRecorded: number;
  readonly engineDegradedCount: number;
  readonly engineFailedCount: number;
  readonly severityCode: DiagnosticsSeverity;
}

export interface DiagnosticsTrendSnapshot {
  readonly capturedAt: number;
  readonly sampleCount: number;
  readonly avgErrorRate: number;
  readonly maxErrorRate: number;
  readonly avgTickDurationMs: number;
  readonly p95TickDurationMs: number;
  readonly avgPressureScore: number;
  readonly maxPressureScore: number;
  readonly avgTensionScore: number;
  readonly nominalSamples: number;
  readonly degradedSamples: number;
  readonly criticalSamples: number;
  readonly trend: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'UNKNOWN';
  readonly recent: readonly DiagnosticsTrendPoint[];
}

/**
 * Rolling trend analyzer for OrchestratorDiagnostics snapshots.
 * Maintains a configurable rolling window of trend points.
 */
export class OrchestratorDiagnosticsTrendAnalyzer {
  private readonly _history: DiagnosticsTrendPoint[] = [];

  private readonly _maxPoints: number;

  public constructor(maxPoints = 200) {
    this._maxPoints = Math.max(10, maxPoints);
  }

  public record(snap: OrchestratorDiagnosticsSnapshot): void {
    const run = snap.currentRun;
    const health = snap.engineHealth;
    const degraded = health.filter((h) => h.status === 'DEGRADED').length;
    const failed = health.filter((h) => h.status === 'FAILED').length;

    const point: DiagnosticsTrendPoint = Object.freeze({
      capturedAtMs: snap.generatedAtMs,
      errorRate: snap.errorRate,
      avgTickDurationMs: snap.avgTickDurationMs,
      avgEventsPerTick: snap.avgEventsPerTick,
      pressureScore: run?.pressureScore ?? 0,
      tensionScore: run?.tensionScore ?? 0,
      sovereigntyScore: run?.sovereigntyScore ?? 0,
      cordScore: run?.cordScore ?? 0,
      totalTicksRecorded: snap.totalTicksRecorded,
      engineDegradedCount: degraded,
      engineFailedCount: failed,
      severityCode: computeDiagnosticsSeverity(snap),
    });

    this._history.push(point);
    if (this._history.length > this._maxPoints) {
      this._history.shift();
    }
  }

  public getSnapshot(now: () => number = () => Date.now()): DiagnosticsTrendSnapshot {
    const pts = this._history;
    const count = pts.length;

    if (count === 0) {
      return Object.freeze({
        capturedAt: now(),
        sampleCount: 0,
        avgErrorRate: 0,
        maxErrorRate: 0,
        avgTickDurationMs: 0,
        p95TickDurationMs: 0,
        avgPressureScore: 0,
        maxPressureScore: 0,
        avgTensionScore: 0,
        nominalSamples: 0,
        degradedSamples: 0,
        criticalSamples: 0,
        trend: 'UNKNOWN',
        recent: freezeArray([]),
      });
    }

    const errorRates = pts.map((p) => p.errorRate);
    const durations = pts.map((p) => p.avgTickDurationMs);
    const pressures = pts.map((p) => p.pressureScore);
    const tensions = pts.map((p) => p.tensionScore);

    const avgErrorRate = average(errorRates);
    const maxErrorRate = Math.max(...errorRates);
    const avgDuration = average(durations);
    const avgPressure = average(pressures);
    const maxPressure = Math.max(...pressures);
    const avgTension = average(tensions);

    // p95 tick duration
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const p95Idx = Math.floor(sortedDurations.length * 0.95);
    const p95Duration = sortedDurations[p95Idx] ?? sortedDurations[sortedDurations.length - 1] ?? 0;

    const nominal = pts.filter((p) => p.severityCode === 'NOMINAL').length;
    const degraded = pts.filter((p) => p.severityCode === 'DEGRADED').length;
    const critical = pts.filter((p) => p.severityCode === 'CRITICAL').length;

    // Trend: compare first half vs second half error rates
    let trend: DiagnosticsTrendSnapshot['trend'] = 'STABLE';
    if (count >= 4) {
      const half = Math.floor(count / 2);
      const firstHalf = errorRates.slice(0, half);
      const secondHalf = errorRates.slice(half);
      const firstAvg = average(firstHalf);
      const secondAvg = average(secondHalf);
      const delta = secondAvg - firstAvg;
      if (delta < -0.02) trend = 'IMPROVING';
      else if (delta > 0.02) trend = 'DEGRADING';
    } else if (count < 4) {
      trend = 'UNKNOWN';
    }

    return Object.freeze({
      capturedAt: now(),
      sampleCount: count,
      avgErrorRate,
      maxErrorRate,
      avgTickDurationMs: avgDuration,
      p95TickDurationMs: p95Duration,
      avgPressureScore: avgPressure,
      maxPressureScore: maxPressure,
      avgTensionScore: avgTension,
      nominalSamples: nominal,
      degradedSamples: degraded,
      criticalSamples: critical,
      trend,
      recent: freezeArray(pts.slice(-10)),
    });
  }

  public getHistory(): readonly DiagnosticsTrendPoint[] {
    return freezeArray([...this._history]);
  }

  public clear(): void {
    this._history.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION ANALYTICS — aggregate session rollup
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticsSessionReport {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly totalTicksObserved: number;
  readonly totalErrorsObserved: number;
  readonly avgErrorRate: number;
  readonly peakErrorRate: number;
  readonly avgTickDurationMs: number;
  readonly maxTickDurationMs: number;
  readonly avgPressureScore: number;
  readonly peakPressureScore: number;
  readonly avgTensionScore: number;
  readonly peakTensionScore: number;
  readonly avgSovereigntyScore: number;
  readonly minSovereigntyScore: number;
  readonly avgCordScore: number;
  readonly nominalFraction: number;
  readonly degradedFraction: number;
  readonly criticalFraction: number;
  readonly runsSeen: readonly string[];
  readonly engineFailureEvents: number;
  readonly avgEventsPerTick: number;
}

/**
 * Session-level analytics aggregator for OrchestratorDiagnostics.
 * Accumulates across multiple snapshots in a session.
 */
export class OrchestratorDiagnosticsSessionAnalytics {
  private readonly _sessionId: string;

  private readonly _startedAtMs: number;

  private readonly _samples: OrchestratorDiagnosticsSnapshot[] = [];

  private readonly _runsSeen = new Set<string>();

  private _engineFailureEvents = 0;

  public constructor(sessionId: string, startedAtMs: number = Date.now()) {
    this._sessionId = sessionId;
    this._startedAtMs = startedAtMs;
  }

  public record(snap: OrchestratorDiagnosticsSnapshot): void {
    this._samples.push(snap);
    if (snap.currentRun?.runId) {
      this._runsSeen.add(snap.currentRun.runId);
    }
    const failed = snap.engineHealth.filter((h) => h.status === 'FAILED').length;
    if (failed > 0) this._engineFailureEvents += 1;
  }

  public buildReport(now: () => number = () => Date.now()): DiagnosticsSessionReport {
    const s = this._samples;
    const count = s.length;

    if (count === 0) {
      return Object.freeze({
        sessionId: this._sessionId,
        startedAtMs: this._startedAtMs,
        capturedAtMs: now(),
        sampleCount: 0,
        totalTicksObserved: 0,
        totalErrorsObserved: 0,
        avgErrorRate: 0,
        peakErrorRate: 0,
        avgTickDurationMs: 0,
        maxTickDurationMs: 0,
        avgPressureScore: 0,
        peakPressureScore: 0,
        avgTensionScore: 0,
        peakTensionScore: 0,
        avgSovereigntyScore: 0,
        minSovereigntyScore: 0,
        avgCordScore: 0,
        nominalFraction: 0,
        degradedFraction: 0,
        criticalFraction: 0,
        runsSeen: freezeArray([]),
        engineFailureEvents: 0,
        avgEventsPerTick: 0,
      });
    }

    const errorRates = s.map((x) => x.errorRate);
    const durations = s.map((x) => x.avgTickDurationMs);
    const pressures = s.map((x) => x.currentRun?.pressureScore ?? 0);
    const tensions = s.map((x) => x.currentRun?.tensionScore ?? 0);
    const sovScores = s.map((x) => x.currentRun?.sovereigntyScore ?? 0);
    const cordScores = s.map((x) => x.currentRun?.cordScore ?? 0);
    const events = s.map((x) => x.avgEventsPerTick);
    const severities = s.map((x) => computeDiagnosticsSeverity(x));

    const nominal = severities.filter((sv) => sv === 'NOMINAL').length;
    const degraded = severities.filter((sv) => sv === 'DEGRADED').length;
    const critical = severities.filter((sv) => sv === 'CRITICAL').length;

    const lastSample = s[s.length - 1]!;

    return Object.freeze({
      sessionId: this._sessionId,
      startedAtMs: this._startedAtMs,
      capturedAtMs: now(),
      sampleCount: count,
      totalTicksObserved: lastSample.totalTicksRecorded,
      totalErrorsObserved: lastSample.totalErrorsRecorded,
      avgErrorRate: average(errorRates),
      peakErrorRate: Math.max(...errorRates),
      avgTickDurationMs: average(durations),
      maxTickDurationMs: Math.max(...durations),
      avgPressureScore: average(pressures),
      peakPressureScore: Math.max(...pressures),
      avgTensionScore: average(tensions),
      peakTensionScore: Math.max(...tensions),
      avgSovereigntyScore: average(sovScores),
      minSovereigntyScore: Math.min(...sovScores),
      avgCordScore: average(cordScores),
      nominalFraction: safeDiv(nominal, count),
      degradedFraction: safeDiv(degraded, count),
      criticalFraction: safeDiv(critical, count),
      runsSeen: freezeArray([...this._runsSeen]),
      engineFailureEvents: this._engineFailureEvents,
      avgEventsPerTick: average(events),
    });
  }

  public clear(): void {
    this._samples.length = 0;
    this._runsSeen.clear();
    this._engineFailureEvents = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTOR — deep inspection report
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticsInspectionResult {
  readonly timestamp: number;
  readonly severity: DiagnosticsSeverity;
  readonly mlVector: OrchestratorDiagnosticsMLVector;
  readonly mlVectorArray: readonly number[];
  readonly dlTensorShape: readonly [number, number];
  readonly dlTensorFlatLength: number;
  readonly chatSignal: DiagnosticsChatSignal;
  readonly healthSummary: {
    readonly total: number;
    readonly healthy: number;
    readonly degraded: number;
    readonly failed: number;
    readonly engineIds: readonly string[];
  };
  readonly tickHistoryDepth: number;
  readonly errorHistoryDepth: number;
  readonly totalErrorsRecorded: number;
  readonly totalTicksRecorded: number;
  readonly errorRate: number;
  readonly avgTickDurationMs: number;
  readonly maxTickDurationMs: number;
  readonly lastTickId: number | null;
  readonly lastRunId: string | null;
  readonly activeFlag: boolean;
  readonly openTraceCount: number;
  readonly latestCheckpointId: string | null;
}

/**
 * Perform a full inspection of a diagnostic snapshot, computing all derived
 * surfaces (ML vector, DL tensor, chat signal) in a single pass.
 */
export function inspectDiagnosticsSnapshot(
  snap: OrchestratorDiagnosticsSnapshot,
  now: () => number = () => Date.now(),
): DiagnosticsInspectionResult {
  const mlVector = extractDiagnosticsMLVector(snap);
  const mlVectorArray = diagnosticsMLVectorToArray(mlVector);
  const dlTensor = buildDiagnosticsDLTensor(snap);
  const flatLen = TICK_STEP_COUNT * DL_FEATURES_PER_STEP;
  const chatSignal = buildDiagnosticsChatSignal(snap);
  const severity = computeDiagnosticsSeverity(snap);
  const health = snap.engineHealth;
  const total = health.length;
  const degraded = health.filter((h) => h.status === 'DEGRADED').length;
  const failed = health.filter((h) => h.status === 'FAILED').length;

  return Object.freeze({
    timestamp: now(),
    severity,
    mlVector,
    mlVectorArray,
    dlTensorShape: Object.freeze([TICK_STEP_COUNT, DL_FEATURES_PER_STEP] as const),
    dlTensorFlatLength: flatLen,
    chatSignal,
    healthSummary: Object.freeze({
      total,
      healthy: total - degraded - failed,
      degraded,
      failed,
      engineIds: freezeArray(health.map((h) => h.engineId)),
    }),
    tickHistoryDepth: snap.tickHistory.length,
    errorHistoryDepth: snap.errorHistory.length,
    totalErrorsRecorded: snap.totalErrorsRecorded,
    totalTicksRecorded: snap.totalTicksRecorded,
    errorRate: snap.errorRate,
    avgTickDurationMs: snap.avgTickDurationMs,
    maxTickDurationMs: snap.maxTickDurationMs,
    lastTickId: snap.tickHistory[0]?.tick ?? null,
    lastRunId: snap.currentRun?.runId ?? null,
    activeFlag: snap.active,
    openTraceCount: snap.openTraceIds.length,
    latestCheckpointId: snap.latestCheckpointId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY EXTRACT — lightweight ops-board record
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticsTelemetryRecord {
  readonly ts: number;
  readonly runId: string | null;
  readonly tick: number;
  readonly severity: DiagnosticsSeverity;
  readonly errorRate: number;
  readonly avgTickMs: number;
  readonly pressureScore: number;
  readonly tensionScore: number;
  readonly sovereigntyScore: number;
  readonly healthyEngines: number;
  readonly totalEngines: number;
  readonly ticksRecorded: number;
  readonly errorsRecorded: number;
}

/**
 * Build a lightweight telemetry record for ops-board ingestion.
 * Lower overhead than a full inspection.
 */
export function buildDiagnosticsTelemetryRecord(
  snap: OrchestratorDiagnosticsSnapshot,
): DiagnosticsTelemetryRecord {
  const run = snap.currentRun;
  const health = snap.engineHealth;
  const failed = health.filter((h) => h.status === 'FAILED').length;
  const degraded = health.filter((h) => h.status === 'DEGRADED').length;
  const healthy = health.length - failed - degraded;

  return Object.freeze({
    ts: snap.generatedAtMs,
    runId: run?.runId ?? null,
    tick: run?.tick ?? 0,
    severity: computeDiagnosticsSeverity(snap),
    errorRate: snap.errorRate,
    avgTickMs: snap.avgTickDurationMs,
    pressureScore: run?.pressureScore ?? 0,
    tensionScore: run?.tensionScore ?? 0,
    sovereigntyScore: run?.sovereigntyScore ?? 0,
    healthyEngines: healthy,
    totalEngines: health.length,
    ticksRecorded: snap.totalTicksRecorded,
    errorsRecorded: snap.totalErrorsRecorded,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS BUNDLE — factory combining all surfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface OrchestratorDiagnosticsWithAnalytics {
  readonly diagnostics: OrchestratorDiagnostics;
  readonly trend: OrchestratorDiagnosticsTrendAnalyzer;
  readonly session: OrchestratorDiagnosticsSessionAnalytics;
  readonly sessionId: string;

  /** Capture diagnostics snapshot, record into trend and session. */
  captureAndRecord(
    snapshotOptions?: Parameters<OrchestratorDiagnostics['snapshot']>[0],
  ): OrchestratorDiagnosticsSnapshot;

  /** Capture + full inspect in one pass. */
  captureAndInspect(
    snapshotOptions?: Parameters<OrchestratorDiagnostics['snapshot']>[0],
  ): DiagnosticsInspectionResult;

  /** Emit the chat signal from the last captured snapshot. */
  buildChatSignal(): DiagnosticsChatSignal;

  /** Extract the ML vector from the last captured snapshot. */
  extractMLVector(): OrchestratorDiagnosticsMLVector;

  /** Build the DL tensor from the last captured snapshot. */
  buildDLTensor(): OrchestratorDiagnosticsDLTensor;

  /** Get the current trend snapshot. */
  getTrend(): DiagnosticsTrendSnapshot;

  /** Get the current session report. */
  getSessionReport(): DiagnosticsSessionReport;
}

/**
 * Factory: build a fully wired OrchestratorDiagnosticsWithAnalytics bundle.
 */
export function createOrchestratorDiagnosticsWithAnalytics(
  deps: OrchestratorDiagnosticsDependencies,
  options: {
    sessionId?: string;
    maxTickHistory?: number;
    maxErrorHistory?: number;
    trendPoints?: number;
  } = {},
): OrchestratorDiagnosticsWithAnalytics {
  const sessionId =
    options.sessionId ?? `diag-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const diagnostics = new OrchestratorDiagnostics(deps, {
    maxTickHistory: options.maxTickHistory,
    maxErrorHistory: options.maxErrorHistory,
  });

  const trend = new OrchestratorDiagnosticsTrendAnalyzer(options.trendPoints ?? 200);
  const session = new OrchestratorDiagnosticsSessionAnalytics(sessionId);

  let _lastSnapshot: OrchestratorDiagnosticsSnapshot | null = null;

  function captureAndRecord(
    snapshotOptions?: Parameters<OrchestratorDiagnostics['snapshot']>[0],
  ): OrchestratorDiagnosticsSnapshot {
    const snap = diagnostics.snapshot(snapshotOptions);
    trend.record(snap);
    session.record(snap);
    _lastSnapshot = snap;
    return snap;
  }

  function captureAndInspect(
    snapshotOptions?: Parameters<OrchestratorDiagnostics['snapshot']>[0],
  ): DiagnosticsInspectionResult {
    const snap = captureAndRecord(snapshotOptions);
    return inspectDiagnosticsSnapshot(snap);
  }

  function buildChatSignal(): DiagnosticsChatSignal {
    const snap = _lastSnapshot ?? diagnostics.snapshot();
    return buildDiagnosticsChatSignal(snap);
  }

  function extractMLVector(): OrchestratorDiagnosticsMLVector {
    const snap = _lastSnapshot ?? diagnostics.snapshot();
    return extractDiagnosticsMLVector(snap);
  }

  function buildDLTensor(): OrchestratorDiagnosticsDLTensor {
    const snap = _lastSnapshot ?? diagnostics.snapshot();
    return buildDiagnosticsDLTensor(snap);
  }

  function getTrend(): DiagnosticsTrendSnapshot {
    return trend.getSnapshot();
  }

  function getSessionReport(): DiagnosticsSessionReport {
    return session.buildReport();
  }

  return Object.freeze({
    diagnostics,
    trend,
    session,
    sessionId,
    captureAndRecord,
    captureAndInspect,
    buildChatSignal,
    extractMLVector,
    buildDLTensor,
    getTrend,
    getSessionReport,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOVERY FORECAST
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticsRecoveryForecast {
  readonly capturedAtMs: number;
  readonly likelihood: 'HIGH' | 'MODERATE' | 'LOW' | 'CRITICAL';
  readonly estimatedRecoveryTicks: number | null;
  readonly blockers: readonly string[];
  readonly recommendations: readonly string[];
}

/**
 * Compute a recovery forecast based on the current diagnostic state.
 * Used by chat adapters to surface actionable guidance to the player.
 */
export function computeDiagnosticsRecoveryForecast(
  snap: OrchestratorDiagnosticsSnapshot,
  now: () => number = () => Date.now(),
): DiagnosticsRecoveryForecast {
  const run = snap.currentRun;
  const severity = computeDiagnosticsSeverity(snap);
  const blockers: string[] = [];
  const recommendations: string[] = [];

  if (!snap.active || run === null) {
    return Object.freeze({
      capturedAtMs: now(),
      likelihood: 'HIGH',
      estimatedRecoveryTicks: null,
      blockers: freezeArray([]),
      recommendations: freezeArray(['No active run — diagnostics idle.']),
    });
  }

  // Pressure analysis
  if (run.pressureScore > 0.8) {
    blockers.push('Critical pressure — all income blocked until pressure subsides.');
    recommendations.push('Play debt-reduction cards before pressure cascades.');
  } else if (run.pressureScore > 0.5) {
    recommendations.push('Pressure is elevated — prioritize income stabilization.');
  }

  // Tension analysis
  if (run.tensionScore > 0.7) {
    blockers.push('High tension — hater bots likely to escalate.');
    recommendations.push('Shield layers need reinforcement this tick.');
  }

  // Cascade analysis
  if (run.activeCascadeChains > 4) {
    blockers.push(`${run.activeCascadeChains} active cascade chains — compounding damage risk.`);
    recommendations.push('Resolve negative cascades before adding new obligations.');
  }

  // Sovereignty
  if (run.sovereigntyScore < 0.3) {
    blockers.push('Sovereignty score critically low — proof integrity at risk.');
    recommendations.push('Avoid forced-card decisions; protect CORD score above all.');
  }

  // Engine health
  const failed = snap.engineHealth.filter((h) => h.status === 'FAILED');
  if (failed.length > 0) {
    blockers.push(`Failed engines: ${failed.map((f) => f.engineId).join(', ')}`);
  }

  // Error rate
  if (snap.errorRate > 0.2) {
    blockers.push('High rollback rate — engine instability detected.');
    recommendations.push('Check for conflicting card effects or timing violations.');
  }

  // Estimate recovery ticks
  let estimatedRecoveryTicks: number | null = null;
  if (severity !== 'CRITICAL' && blockers.length === 0) {
    estimatedRecoveryTicks = 0;
  } else if (severity === 'DEGRADED') {
    const pressureDecay = Math.ceil((run.pressureScore - 0.5) / 0.05);
    estimatedRecoveryTicks = Math.max(1, pressureDecay);
  } else if (severity === 'CRITICAL') {
    estimatedRecoveryTicks = null;
  }

  const likelihood: DiagnosticsRecoveryForecast['likelihood'] =
    severity === 'NOMINAL'
      ? 'HIGH'
      : blockers.length === 0
      ? 'MODERATE'
      : severity === 'CRITICAL'
      ? 'CRITICAL'
      : 'LOW';

  return Object.freeze({
    capturedAtMs: now(),
    likelihood,
    estimatedRecoveryTicks,
    blockers: freezeArray(blockers),
    recommendations: freezeArray(recommendations),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NARRATIVE GENERATOR — human-readable diagnostic summary for chat lane
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a terse human-readable diagnostic narrative.
 * Consumed by the chat lane to surface operator/player context.
 */
export function generateDiagnosticsNarrative(
  snap: OrchestratorDiagnosticsSnapshot,
): string {
  const run = snap.currentRun;
  const severity = computeDiagnosticsSeverity(snap);

  if (!snap.active || run === null) {
    return 'Engine diagnostics: idle — no active run.';
  }

  const parts: string[] = [];
  parts.push(`Tick ${run.tick} | ${run.mode} | ${run.phase}`);
  parts.push(`Pressure: ${(run.pressureScore * 100).toFixed(0)}% (${run.pressureTier})`);
  parts.push(`Tension: ${(run.tensionScore * 100).toFixed(0)}%`);
  parts.push(`Sovereignty: ${(run.sovereigntyScore * 100).toFixed(0)}% | CORD: ${(run.cordScore * 100).toFixed(0)}%`);

  if (severity === 'CRITICAL') {
    parts.push('⚠ CRITICAL: Engine failure or integrity breach.');
  } else if (severity === 'DEGRADED') {
    parts.push('⚠ DEGRADED: Performance or stability issues detected.');
  }

  if (snap.totalErrorsRecorded > 0) {
    parts.push(`Errors: ${snap.totalErrorsRecorded} across ${snap.totalTicksRecorded} ticks.`);
  }

  const healthFailed = snap.engineHealth.filter((h) => h.status === 'FAILED');
  if (healthFailed.length > 0) {
    parts.push(`Failed engines: ${healthFailed.map((h) => h.engineId).join(', ')}.`);
  }

  return parts.join(' | ');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP-LEVEL DRILL-DOWN — targeted analysis per tick step
// ─────────────────────────────────────────────────────────────────────────────

export interface StepDrillDown {
  readonly step: TickStep;
  readonly ticksObserved: number;
  readonly totalDurationMs: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly totalErrors: number;
  readonly totalWarnings: number;
  readonly totalEvents: number;
  readonly mutationRate: number;
}

/**
 * Analyze a specific tick step across the full tick history.
 */
export function drillDownStep(
  snap: OrchestratorDiagnosticsSnapshot,
  step: TickStep,
): StepDrillDown {
  const reports = snap.tickHistory.flatMap((tick) =>
    tick.stepReports.filter((r) => r.step === step),
  );

  const count = reports.length;
  const totalDur = reports.reduce((s, r) => s + r.durationMs, 0);
  const totalErrors = reports.reduce((s, r) => s + r.errorCount, 0);
  const totalWarnings = reports.reduce((s, r) => s + r.warningCount, 0);
  const totalEvents = reports.reduce((s, r) => s + r.emittedEventCount, 0);
  const mutatedCount = reports.filter((r) => r.mutated).length;

  return Object.freeze({
    step,
    ticksObserved: count,
    totalDurationMs: totalDur,
    avgDurationMs: safeDiv(totalDur, count),
    maxDurationMs: count > 0 ? Math.max(...reports.map((r) => r.durationMs)) : 0,
    totalErrors,
    totalWarnings,
    totalEvents,
    mutationRate: safeDiv(mutatedCount, count),
  });
}

/**
 * Drill down all 13 canonical tick steps at once.
 */
export function drillDownAllSteps(
  snap: OrchestratorDiagnosticsSnapshot,
): readonly StepDrillDown[] {
  return freezeArray(ORDERED_TICK_STEPS.map((step) => drillDownStep(snap, step)));
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticsErrorAnalysis {
  readonly totalErrors: number;
  readonly errorsByStep: ReadonlyMap<TickStep, number>;
  readonly errorsByEngine: ReadonlyMap<string, number>;
  readonly mostFrequentStep: TickStep | null;
  readonly mostFrequentEngine: string | null;
  readonly errorRate: number;
  readonly recentErrorTicks: readonly number[];
}

/**
 * Analyze the error history from a diagnostics snapshot.
 */
export function analyzeErrors(
  snap: OrchestratorDiagnosticsSnapshot,
): DiagnosticsErrorAnalysis {
  const errors = snap.errorHistory;
  const byStep = new Map<TickStep, number>();
  const byEngine = new Map<string, number>();
  const errorTicks: number[] = [];

  for (const err of errors) {
    byStep.set(err.step, (byStep.get(err.step) ?? 0) + 1);
    if (err.engineId !== null) {
      byEngine.set(err.engineId, (byEngine.get(err.engineId) ?? 0) + 1);
    }
    if (!errorTicks.includes(err.tick)) {
      errorTicks.push(err.tick);
    }
  }

  let mostFrequentStep: TickStep | null = null;
  let maxStepCount = 0;
  for (const [step, count] of byStep) {
    if (count > maxStepCount) {
      maxStepCount = count;
      mostFrequentStep = step;
    }
  }

  let mostFrequentEngine: string | null = null;
  let maxEngineCount = 0;
  for (const [engineId, count] of byEngine) {
    if (count > maxEngineCount) {
      maxEngineCount = count;
      mostFrequentEngine = engineId;
    }
  }

  return Object.freeze({
    totalErrors: errors.length,
    errorsByStep: byStep,
    errorsByEngine: byEngine,
    mostFrequentStep,
    mostFrequentEngine,
    errorRate: snap.errorRate,
    recentErrorTicks: freezeArray(errorTicks.slice(0, 20)),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS — module-level defaults
// ─────────────────────────────────────────────────────────────────────────────

/** Singleton trend analyzer — shared across sessions unless explicitly scoped. */
export const ZERO_DIAGNOSTICS_TREND_ANALYZER =
  new OrchestratorDiagnosticsTrendAnalyzer(200);

/** Singleton session analytics — replace or scope per session. */
export const ZERO_DIAGNOSTICS_SESSION_ANALYTICS =
  new OrchestratorDiagnosticsSessionAnalytics(
    'zero-default-session',
    Date.now(),
  );

/** Default ML vector — all zeros, represents no active run. */
export const ZERO_DEFAULT_DIAGNOSTICS_ML_VECTOR: OrchestratorDiagnosticsMLVector =
  Object.freeze({
    pressureScore: 0,
    pressureTierRank: 0,
    tensionScore: 0,
    anticipation: 0,
    activeThreats: 0,
    activeCascadeChains: 0,
    pendingAttackCount: 0,
    sovereigntyScore: 0,
    cordScore: 0,
    cashNormalized: 0,
    debtBurden: 0,
    netWorthNormalized: 0,
    cashflowSign: 0.5,
    engineHealthRatio: 1,
    degradedEngineRatio: 0,
    failedEngineFlag: 0,
    eventBusHistoryFill: 0,
    openTraceRatio: 0,
    recentCheckpointFill: 0,
    warningCountNormalized: 0,
    emittedEventCountNormalized: 0,
    tickNormalized: 0,
    avgTickDurationNormalized: 0,
    maxTickDurationNormalized: 0,
    avgEventsPerTickNormalized: 0,
    errorRateNormalized: 0,
    historyFullnessRatio: 0,
    activeRunFlag: 0,
    integrityOKFlag: 0,
    proofHashPresentFlag: 0,
    verifiedGradeScore: 0,
    totalErrorsNormalized: 0,
  });

/** Default DL tensor — all zeros, 13×8. */
export const ZERO_DEFAULT_DIAGNOSTICS_DL_TENSOR: OrchestratorDiagnosticsDLTensor =
  Object.freeze(
    Array.from({ length: TICK_STEP_COUNT }, () =>
      Object.freeze(Array.from({ length: DL_FEATURES_PER_STEP }, () => 0)),
    ),
  );

/** Default chat signal — represents idle/nominal state. */
export const ZERO_DEFAULT_DIAGNOSTICS_CHAT_SIGNAL: DiagnosticsChatSignal =
  Object.freeze({
    generatedAtMs: 0,
    severity: 'NOMINAL' as DiagnosticsSeverity,
    activeRunId: null,
    tick: 0,
    pressureTier: null,
    pressureScore: 0,
    tensionScore: 0,
    sovereigntyScore: 0,
    cordScore: 0,
    verifiedGrade: null,
    engineHealthSummary: Object.freeze({ total: 0, healthy: 0, degraded: 0, failed: 0 }),
    errorRate: 0,
    avgTickDurationMs: 0,
    totalTicksRecorded: 0,
    totalErrorsRecorded: 0,
    openTraceCount: 0,
    recentCheckpointId: null,
    integrityStatus: null,
    proofHashPresent: false,
    avgEventsPerTick: 0,
    pressureBand: null,
  });

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION — type guards and schema checks
// ─────────────────────────────────────────────────────────────────────────────

export function isDiagnosticsErrorRecord(
  value: unknown,
): value is DiagnosticsErrorRecord {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec['step'] === 'string' &&
    (rec['engineId'] === null || typeof rec['engineId'] === 'string') &&
    typeof rec['tick'] === 'number' &&
    typeof rec['occurredAtMs'] === 'number' &&
    typeof rec['message'] === 'string'
  );
}

export function isDiagnosticsTickRecord(
  value: unknown,
): value is DiagnosticsTickRecord {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec['runId'] === 'string' &&
    typeof rec['tick'] === 'number' &&
    typeof rec['durationMs'] === 'number' &&
    Array.isArray(rec['stepReports'])
  );
}

export function isOrchestratorDiagnosticsSnapshot(
  value: unknown,
): value is OrchestratorDiagnosticsSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec['generatedAtMs'] === 'number' &&
    typeof rec['active'] === 'boolean' &&
    typeof rec['totalTicksRecorded'] === 'number' &&
    typeof rec['errorRate'] === 'number' &&
    Array.isArray(rec['tickHistory']) &&
    Array.isArray(rec['errorHistory'])
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY REPORTERS — per-mode and per-run diagnostics summaries
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticsRunSummary {
  readonly runId: string;
  readonly mode: RunStateSnapshot['mode'];
  readonly finalTick: number;
  readonly outcome: RunOutcome | null;
  readonly totalTicksObserved: number;
  readonly avgTickDurationMs: number;
  readonly totalEventsEmitted: number;
  readonly totalWarnings: number;
  readonly errorRate: number;
  readonly finalPressureScore: number;
  readonly finalTensionScore: number;
  readonly finalSovereigntyScore: number;
  readonly finalCordScore: number;
  readonly finalVerifiedGrade: string | null;
  readonly engineHealthSnapshot: readonly {
    readonly engineId: string;
    readonly status: EngineHealth['status'];
  }[];
}

/**
 * Build a run summary from the current diagnostics snapshot.
 * Intended for post-run archiving and replay analysis.
 */
export function buildDiagnosticsRunSummary(
  snap: OrchestratorDiagnosticsSnapshot,
): DiagnosticsRunSummary | null {
  const run = snap.currentRun;
  if (run === null) return null;

  const totalEvents = snap.tickHistory.reduce((s, t) => s + t.eventCount, 0);
  const totalWarnings = snap.tickHistory.reduce((s, t) => s + t.warningCount, 0);
  const durations = snap.tickHistory.map((t) => t.durationMs);

  return Object.freeze({
    runId: run.runId,
    mode: run.mode,
    finalTick: run.tick,
    outcome: run.outcome,
    totalTicksObserved: snap.totalTicksRecorded,
    avgTickDurationMs: average(durations),
    totalEventsEmitted: totalEvents,
    totalWarnings,
    errorRate: snap.errorRate,
    finalPressureScore: run.pressureScore,
    finalTensionScore: run.tensionScore,
    finalSovereigntyScore: run.sovereigntyScore,
    finalCordScore: run.cordScore,
    finalVerifiedGrade: run.verifiedGrade,
    engineHealthSnapshot: freezeArray(
      snap.engineHealth.map((h) =>
        Object.freeze({ engineId: h.engineId, status: h.status }),
      ),
    ),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — exported for test reference and wiring
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical ordered tick steps — use for DL tensor row indexing. */
export { ORDERED_TICK_STEPS };

/** Number of canonical tick steps (13). */
export { TICK_STEP_COUNT };

/** Number of DL features per step (8). */
export { DL_FEATURES_PER_STEP };

/** Normalization caps for ML feature extraction. */
export { DIAG_NORM_CAPS };

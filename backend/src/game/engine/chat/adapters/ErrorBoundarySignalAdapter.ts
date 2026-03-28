/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ERROR BOUNDARY SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/ErrorBoundarySignalAdapter.ts
 * VERSION: 2026.03.27
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates Engine 0 ErrorBoundary signals —
 * step faults, fatal aborts, circuit breaker transitions, quarantine events,
 * budget exhaustion, recovery detections, ML anomaly vectors, DL tensors,
 * telemetry snapshots, trend assessments, and recovery forecasts — into
 * authoritative backend-chat ingress envelopes on the SYSTEM lane.
 *
 * Backend-truth question
 * ----------------------
 *   "When Engine 0's ErrorBoundary captures a step fault, opens a circuit
 *    breaker, quarantines an owner, or detects recovery after consecutive
 *    failures, what exact chat-native signal should the authoritative backend
 *    chat engine ingest to preserve error containment fidelity and make the
 *    chat layer feel alive to boundary state?"
 *
 * Design laws
 * -----------
 * - No circular imports from zero/. All ErrorBoundary types are mirrored
 *   as structural compat interfaces below.
 * - STEP_FATAL signals always emit — they are critical infrastructure state.
 * - STEP_ERROR signals emit when anomaly score exceeds threshold.
 * - CIRCUIT_OPEN signals always emit — circuit protection is safety-critical.
 * - QUARANTINE_TRIGGERED signals always emit.
 * - BUDGET_EXHAUSTED signals always emit.
 * - RECOVERY_DETECTED signals emit when consecutive failures reset to zero.
 * - ML_ANOMALY signals emit when anomaly score exceeds configured threshold.
 * - DL_TENSOR signals emit when tensor l2 norm exceeds configured threshold.
 * - TELEMETRY signals emit at configurable cadence (default: disabled).
 * - TREND signals emit only on direction changes (STABLE→DEGRADING, etc.).
 * - FORECAST signals emit when recommendation changes.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Structural compat interfaces — mirrors ErrorBoundary domain types
// WITHOUT importing them to avoid circular dependency chains.
//
// These are kept intentionally minimal. They capture only what the chat
// adapter needs to build a ChatInputEnvelope without importing the source.
// ─────────────────────────────────────────────────────────────────────────────

// ── Error boundary owner ──────────────────────────────────────────────────────

export type ErrorBoundaryOwnerCompat =
  | 'time'
  | 'pressure'
  | 'tension'
  | 'shield'
  | 'battle'
  | 'cascade'
  | 'sovereignty'
  | 'mode'
  | 'system';

// ── Error category ────────────────────────────────────────────────────────────

export type ErrorCategoryCompat =
  | 'engine_step'
  | 'mode_hook'
  | 'state_mutation'
  | 'timeout'
  | 'invariant'
  | 'determinism'
  | 'resource'
  | 'system'
  | 'unknown';

// ── Signal kind ───────────────────────────────────────────────────────────────

export type ErrorBoundarySignalKindCompat =
  | 'STEP_ERROR'
  | 'STEP_FATAL'
  | 'CIRCUIT_OPEN'
  | 'QUARANTINE_TRIGGERED'
  | 'BUDGET_EXHAUSTED'
  | 'RECOVERY_DETECTED';

// ── Trend direction ───────────────────────────────────────────────────────────

export type ErrorBoundaryTrendDirectionCompat =
  | 'IMPROVING'
  | 'STABLE'
  | 'DEGRADING'
  | 'CRITICAL';

// ── Recovery recommendation ───────────────────────────────────────────────────

export type ErrorBoundaryRecoveryRecommendationCompat =
  | 'CONTINUE'
  | 'WARN'
  | 'HALF_OPEN'
  | 'ABORT';

// ── Chat signal compat ────────────────────────────────────────────────────────

export interface ErrorBoundaryChatSignalCompat {
  readonly surface: 'error_boundary';
  readonly kind: ErrorBoundarySignalKindCompat;
  readonly owner: ErrorBoundaryOwnerCompat;
  readonly step: string;
  readonly tick: number;
  readonly code: string;
  readonly message: string;
  readonly fatal: boolean;
  readonly consecutiveFailures: number;
  readonly maxConsecutiveFailures: number;
  readonly category: ErrorCategoryCompat;
  readonly mlAnomalyScore: number;
  readonly isAnomalous: boolean;
  readonly budgetUtilization: number;
  readonly circuitBreakerOpen: boolean;
  readonly tags: readonly string[];
  readonly severity: 'INFO' | 'WARN' | 'CRITICAL';
  readonly emittedAt: string;
}

// ── ML vector compat ──────────────────────────────────────────────────────────

export interface ErrorBoundaryMLVectorCompat {
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly anomalyScore: number;
  readonly isAnomalous: boolean;
  readonly extractedAt: string;
  readonly tick: number;
  readonly owner: ErrorBoundaryOwnerCompat;
}

// ── DL tensor compat ──────────────────────────────────────────────────────────

export interface ErrorBoundaryDLTensorCompat {
  readonly flat: readonly number[];
  readonly rows: number;
  readonly cols: number;
  readonly maxAbsValue: number;
  readonly constructedAt: string;
  readonly tick: number;
}

// ── Telemetry snapshot compat ─────────────────────────────────────────────────

export interface ErrorBoundaryTelemetrySnapshotCompat {
  readonly owner: ErrorBoundaryOwnerCompat;
  readonly tick: number;
  readonly consecutiveFailures: number;
  readonly totalSessionErrors: number;
  readonly fatalCount: number;
  readonly recoverableCount: number;
  readonly budgetUtilization: number;
  readonly budgetExhausted: boolean;
  readonly circuitBreakerOpen: boolean;
  readonly inQuarantine: boolean;
  readonly mlVector: ErrorBoundaryMLVectorCompat | null;
  readonly dlTensor: ErrorBoundaryDLTensorCompat | null;
  readonly chatSignal: ErrorBoundaryChatSignalCompat | null;
  readonly topCategory: ErrorCategoryCompat | null;
  readonly topCode: string | null;
  readonly notes: readonly string[];
  readonly emittedAt: string;
}

// ── Trend snapshot compat ─────────────────────────────────────────────────────

export interface ErrorBoundaryTrendSnapshotCompat {
  readonly direction: ErrorBoundaryTrendDirectionCompat;
  readonly consecutiveFailuresNow: number;
  readonly consecutiveFailuresPrior: number;
  readonly recentErrorRate: number;
  readonly errorVelocity: number;
  readonly dominantCategory: ErrorCategoryCompat | null;
  readonly dominantOwner: ErrorBoundaryOwnerCompat | null;
  readonly trendScore: number;
  readonly assessedAt: string;
}

// ── Recovery forecast compat ──────────────────────────────────────────────────

export interface ErrorBoundaryRecoveryForecastCompat {
  readonly recoveryProbabilityNextTick: number;
  readonly recoveryProbability5Ticks: number;
  readonly immediateRecoveryExpected: boolean;
  readonly recommendation: ErrorBoundaryRecoveryRecommendationCompat;
  readonly confidence: number;
  readonly forecastAt: string;
}

// ── Session report compat ─────────────────────────────────────────────────────

export interface ErrorBoundarySessionReportCompat {
  readonly owner: ErrorBoundaryOwnerCompat;
  readonly totalErrors: number;
  readonly totalFatal: number;
  readonly totalRecoverable: number;
  readonly maxConsecutiveFailuresReached: number;
  readonly circuitBreakerOpenCount: number;
  readonly quarantineCount: number;
  readonly budgetUtilizationPeak: number;
  readonly errorRatePeak: number;
  readonly mlAnomalyCount: number;
  readonly sessionStartMs: number;
  readonly sessionDurationMs: number;
  readonly reportAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundarySignalAdapterConfig {
  /** Default chat room ID. */
  readonly defaultRoomId: ChatRoomId;
  /** Channel to emit on. Defaults to 'system'. */
  readonly channel: ChatVisibleChannel;
  /** ML anomaly score threshold [0–1] above which ML vectors are emitted. */
  readonly mlAnomalyThreshold: Score01;
  /** DL tensor l2 norm threshold above which DL tensors are emitted. */
  readonly dlTensorNormThreshold: Score01;
  /** Health score below which health-degradation signals are emitted. [0–100] */
  readonly healthDegradationThreshold: Score100;
  /** Emit STEP_ERROR signals. */
  readonly emitStepError: boolean;
  /** Emit STEP_FATAL signals (always true — cannot be suppressed). */
  readonly emitStepFatal: boolean;
  /** Emit CIRCUIT_OPEN signals (always true — cannot be suppressed). */
  readonly emitCircuitOpen: boolean;
  /** Emit QUARANTINE_TRIGGERED signals (always true). */
  readonly emitQuarantine: boolean;
  /** Emit BUDGET_EXHAUSTED signals (always true). */
  readonly emitBudgetExhausted: boolean;
  /** Emit RECOVERY_DETECTED signals. */
  readonly emitRecovery: boolean;
  /** Emit ML anomaly signals when vector is anomalous. */
  readonly emitMLAnomalies: boolean;
  /** Emit DL tensor signals when l2 norm exceeds threshold. */
  readonly emitDLTensors: boolean;
  /** Emit telemetry snapshots. */
  readonly emitTelemetry: boolean;
  /** Emit trend direction-change signals. */
  readonly emitTrendChanges: boolean;
  /** Emit recovery forecast changes. */
  readonly emitForecastChanges: boolean;
}

export const ERROR_BOUNDARY_SIGNAL_ADAPTER_DEFAULT_CONFIG: Readonly<ErrorBoundarySignalAdapterConfig> =
  Object.freeze({
    defaultRoomId:             'system' as ChatRoomId,
    channel:                   'system' as ChatVisibleChannel,
    mlAnomalyThreshold:        0.55 as Score01,
    dlTensorNormThreshold:     0.60 as Score01,
    healthDegradationThreshold: 50  as Score100,
    emitStepError:             true,
    emitStepFatal:             true,
    emitCircuitOpen:           true,
    emitQuarantine:            true,
    emitBudgetExhausted:       true,
    emitRecovery:              true,
    emitMLAnomalies:           true,
    emitDLTensors:             false,
    emitTelemetry:             false,
    emitTrendChanges:          true,
    emitForecastChanges:       false,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Adapter output types
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorBoundaryAdapterSignalKind =
  | ErrorBoundarySignalKindCompat
  | 'ML_ANOMALY'
  | 'DL_TENSOR'
  | 'TELEMETRY'
  | 'TREND_CHANGE'
  | 'FORECAST_CHANGE';

export type ErrorBoundaryAdapterSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface ErrorBoundarySignalOutput {
  /** The translated chat ingress envelope ready for backend-chat ingest. */
  readonly envelope: ChatInputEnvelope;
  /** Discriminator for downstream routing. */
  readonly signalKind: ErrorBoundaryAdapterSignalKind;
  /** Severity of the translated signal. */
  readonly severity: ErrorBoundaryAdapterSeverity;
  /** Owner that produced the fault. */
  readonly owner: ErrorBoundaryOwnerCompat;
  /** Tick at signal time. */
  readonly tick: number;
  /** Whether the error was fatal. */
  readonly fatal: boolean;
  /** Consecutive failure count at signal time. */
  readonly consecutiveFailures: number;
  /** ISO-8601 timestamp of signal construction. */
  readonly translatedAt: string;
}

export interface ErrorBoundaryAdapterResult {
  /** All signals produced by this adapter invocation. */
  readonly signals: readonly ErrorBoundarySignalOutput[];
  /** The number of signals emitted. */
  readonly emittedCount: number;
  /** The number of signals suppressed by config policy. */
  readonly suppressedCount: number;
  /** Whether any CRITICAL signals were emitted. */
  readonly hasCriticalSignals: boolean;
  /** ISO-8601 timestamp of adapter run. */
  readonly processedAt: string;
}

export interface ErrorBoundaryAdapterState {
  readonly emittedCount: number;
  readonly suppressedCount: number;
  readonly lastSignalAt: UnixMs | null;
  readonly lastKind: ErrorBoundaryAdapterSignalKind | null;
  readonly lastSeverity: ErrorBoundaryAdapterSeverity | null;
  readonly lastOwner: ErrorBoundaryOwnerCompat | null;
  readonly lastTrendDirection: ErrorBoundaryTrendDirectionCompat | null;
  readonly lastRecommendation: ErrorBoundaryRecoveryRecommendationCompat | null;
  readonly criticalCount: number;
}

export interface ErrorBoundaryAdapterReport {
  readonly state: ErrorBoundaryAdapterState;
  readonly config: ErrorBoundarySignalAdapterConfig;
  readonly isHealthy: boolean;
  readonly diagnostics: readonly string[];
  readonly reportAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function nowMs(): UnixMs {
  return asUnixMs(Date.now());
}

function isoNow(): string {
  return new Date().toISOString();
}

function severityFromKind(
  kind: ErrorBoundaryAdapterSignalKind,
  fatal: boolean,
): ErrorBoundaryAdapterSeverity {
  if (fatal || kind === 'STEP_FATAL' || kind === 'CIRCUIT_OPEN' || kind === 'BUDGET_EXHAUSTED') {
    return 'CRITICAL';
  }
  if (
    kind === 'QUARANTINE_TRIGGERED' ||
    kind === 'ML_ANOMALY' ||
    kind === 'TREND_CHANGE' ||
    kind === 'STEP_ERROR'
  ) {
    return 'WARN';
  }
  return 'INFO';
}

function buildEnvelope(
  config: ErrorBoundarySignalAdapterConfig,
  kind: ErrorBoundaryAdapterSignalKind,
  owner: ErrorBoundaryOwnerCompat,
  tick: number,
  payload: Record<string, JsonValue>,
  severity: ErrorBoundaryAdapterSeverity,
): ChatInputEnvelope {
  const metadata: Readonly<Record<string, JsonValue>> = Object.freeze({
    ...payload,
    owner: owner as JsonValue,
    kind: kind as JsonValue,
    severity: severity as JsonValue,
    tick: tick as JsonValue,
    channel: config.channel as JsonValue,
    adapter: 'ErrorBoundarySignalAdapter' as JsonValue,
    adapterVersion: ERROR_BOUNDARY_SIGNAL_ADAPTER_VERSION as JsonValue,
  });
  const signal: ChatSignalEnvelope = Object.freeze({
    type: 'LIVEOPS' as const,
    emittedAt: nowMs(),
    roomId: config.defaultRoomId,
    metadata,
  });
  return Object.freeze({
    kind: 'LIVEOPS_SIGNAL' as const,
    emittedAt: nowMs(),
    payload: signal,
  });
}

function computeDLTensorL2Norm(flat: readonly number[]): number {
  let sum = 0;
  for (const v of flat) sum += v * v;
  return Math.sqrt(sum / Math.max(1, flat.length));
}

// ─────────────────────────────────────────────────────────────────────────────
// Well-known constants
// ─────────────────────────────────────────────────────────────────────────────

export const ERROR_BOUNDARY_SIGNAL_ADAPTER_VERSION = 'error-boundary-adapter.v1.2026' as const;

export const ERROR_BOUNDARY_ADAPTER_SIGNAL_KINDS: readonly ErrorBoundaryAdapterSignalKind[] =
  Object.freeze([
    'STEP_ERROR',
    'STEP_FATAL',
    'CIRCUIT_OPEN',
    'QUARANTINE_TRIGGERED',
    'BUDGET_EXHAUSTED',
    'RECOVERY_DETECTED',
    'ML_ANOMALY',
    'DL_TENSOR',
    'TELEMETRY',
    'TREND_CHANGE',
    'FORECAST_CHANGE',
  ]);

export const ERROR_BOUNDARY_ML_FEATURE_LABEL_COUNT = 32 as const;

export const ERROR_BOUNDARY_ML_FEATURE_LABELS_COMPAT: readonly string[] = Object.freeze([
  'consecutive_failures_norm',
  'max_failures_utilized_ratio',
  'is_fatal',
  'is_recoverable',
  'severity_warn',
  'severity_error',
  'category_engine_step',
  'category_mode_hook',
  'category_state_mutation',
  'category_timeout',
  'category_invariant',
  'category_determinism',
  'category_resource',
  'category_system',
  'category_unknown',
  'owner_time',
  'owner_pressure',
  'owner_tension',
  'owner_shield',
  'owner_battle',
  'owner_cascade',
  'owner_sovereignty',
  'owner_mode',
  'owner_system',
  'tick_norm',
  'has_stack_trace',
  'budget_utilization_ratio',
  'circuit_breaker_open',
  'in_quarantine',
  'tag_count_norm',
  'message_length_norm',
  'anomaly_score',
]);

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundarySignalAdapter class
// ─────────────────────────────────────────────────────────────────────────────

export class ErrorBoundarySignalAdapter {
  private readonly config: ErrorBoundarySignalAdapterConfig;

  private emittedCount    = 0;
  private suppressedCount = 0;
  private lastSignalAt:     UnixMs | null = null;
  private lastKind:         ErrorBoundaryAdapterSignalKind | null = null;
  private lastSeverity:     ErrorBoundaryAdapterSeverity | null = null;
  private lastOwner:        ErrorBoundaryOwnerCompat | null = null;
  private lastTrend:        ErrorBoundaryTrendDirectionCompat | null = null;
  private lastRecommendation: ErrorBoundaryRecoveryRecommendationCompat | null = null;
  private criticalCount   = 0;

  public constructor(config: Partial<ErrorBoundarySignalAdapterConfig> = {}) {
    this.config = { ...ERROR_BOUNDARY_SIGNAL_ADAPTER_DEFAULT_CONFIG, ...config };
  }

  // ── Primary translation entry points ───────────────────────────────────────

  /**
   * Translates an ErrorBoundaryChatSignal into zero or more ChatInputEnvelopes.
   * This is the primary ingress for step faults, circuit opens, quarantines,
   * budget exhaustion, and recovery events.
   */
  public translate(signal: ErrorBoundaryChatSignalCompat): ErrorBoundaryAdapterResult {
    const signals: ErrorBoundarySignalOutput[] = [];
    let suppressedCount = 0;

    const kind = signal.kind;
    const shouldEmit = this.shouldEmitKind(kind, signal);
    if (!shouldEmit) {
      suppressedCount += 1;
    } else {
      const severity = severityFromKind(kind, signal.fatal);
      const envelope = buildEnvelope(
        this.config,
        kind,
        signal.owner,
        signal.tick,
        {
          code:                 signal.code,
          message:              signal.message,
          step:                 signal.step,
          fatal:                signal.fatal,
          consecutiveFailures:  signal.consecutiveFailures,
          maxConsecutiveFailures: signal.maxConsecutiveFailures,
          category:             signal.category,
          mlAnomalyScore:       signal.mlAnomalyScore,
          isAnomalous:          signal.isAnomalous,
          budgetUtilization:    signal.budgetUtilization,
          circuitBreakerOpen:   signal.circuitBreakerOpen,
          tags:                 signal.tags as unknown as JsonValue,
          signalSeverity:       signal.severity,
        } as Record<string, JsonValue>,
        severity,
      );
      signals.push(this.makeOutput(envelope, kind, severity, signal.owner, signal.tick, signal.fatal, signal.consecutiveFailures));
    }

    // Emit ML anomaly sub-signal if anomaly threshold exceeded
    if (signal.isAnomalous && this.config.emitMLAnomalies) {
      const severity: ErrorBoundaryAdapterSeverity = 'WARN';
      const envelope = buildEnvelope(
        this.config,
        'ML_ANOMALY',
        signal.owner,
        signal.tick,
        {
          mlAnomalyScore: signal.mlAnomalyScore,
          category:       signal.category,
          code:           signal.code,
          fatal:          signal.fatal,
        } as Record<string, JsonValue>,
        severity,
      );
      signals.push(this.makeOutput(envelope, 'ML_ANOMALY', severity, signal.owner, signal.tick, signal.fatal, signal.consecutiveFailures));
    } else if (signal.isAnomalous) {
      suppressedCount += 1;
    }

    return this.buildResult(signals, suppressedCount);
  }

  /**
   * Translates an ErrorBoundaryMLVector into a chat signal.
   * Emits only when the anomaly score exceeds the configured threshold.
   */
  public translateMLVector(
    vector: ErrorBoundaryMLVectorCompat,
  ): ErrorBoundaryAdapterResult {
    if (!this.config.emitMLAnomalies || !vector.isAnomalous) {
      return this.buildResult([], 1);
    }
    const severity: ErrorBoundaryAdapterSeverity = 'WARN';
    const envelope = buildEnvelope(
      this.config,
      'ML_ANOMALY',
      vector.owner,
      vector.tick,
      {
        anomalyScore:    vector.anomalyScore,
        isAnomalous:     vector.isAnomalous,
        featureCount:    vector.features.length,
        extractedAt:     vector.extractedAt,
        featureLabels:   vector.featureLabels as unknown as JsonValue,
      } as Record<string, JsonValue>,
      severity,
    );
    const output = this.makeOutput(envelope, 'ML_ANOMALY', severity, vector.owner, vector.tick, false, 0);
    return this.buildResult([output], 0);
  }

  /**
   * Translates an ErrorBoundaryDLTensor into a chat signal.
   * Emits only when the l2 norm exceeds the configured threshold.
   */
  public translateDLTensor(
    tensor: ErrorBoundaryDLTensorCompat,
    owner: ErrorBoundaryOwnerCompat,
  ): ErrorBoundaryAdapterResult {
    if (!this.config.emitDLTensors) {
      return this.buildResult([], 1);
    }
    const l2Norm = computeDLTensorL2Norm(tensor.flat);
    if (l2Norm < this.config.dlTensorNormThreshold) {
      return this.buildResult([], 1);
    }
    const severity: ErrorBoundaryAdapterSeverity = 'WARN';
    const envelope = buildEnvelope(
      this.config,
      'DL_TENSOR',
      owner,
      tensor.tick,
      {
        rows:          tensor.rows,
        cols:          tensor.cols,
        maxAbsValue:   tensor.maxAbsValue,
        l2Norm:        l2Norm,
        constructedAt: tensor.constructedAt,
      } as Record<string, JsonValue>,
      severity,
    );
    const output = this.makeOutput(envelope, 'DL_TENSOR', severity, owner, tensor.tick, false, 0);
    return this.buildResult([output], 0);
  }

  /**
   * Translates an ErrorBoundaryTelemetrySnapshot into a chat signal.
   * Emits only when `emitTelemetry` is true in config.
   */
  public translateTelemetry(
    snapshot: ErrorBoundaryTelemetrySnapshotCompat,
  ): ErrorBoundaryAdapterResult {
    if (!this.config.emitTelemetry) {
      return this.buildResult([], 1);
    }
    const severity: ErrorBoundaryAdapterSeverity = snapshot.budgetExhausted || snapshot.circuitBreakerOpen
      ? 'CRITICAL'
      : snapshot.consecutiveFailures >= 3 ? 'WARN' : 'INFO';
    const envelope = buildEnvelope(
      this.config,
      'TELEMETRY',
      snapshot.owner,
      snapshot.tick,
      {
        consecutiveFailures:  snapshot.consecutiveFailures,
        totalSessionErrors:   snapshot.totalSessionErrors,
        fatalCount:           snapshot.fatalCount,
        recoverableCount:     snapshot.recoverableCount,
        budgetUtilization:    snapshot.budgetUtilization,
        budgetExhausted:      snapshot.budgetExhausted,
        circuitBreakerOpen:   snapshot.circuitBreakerOpen,
        inQuarantine:         snapshot.inQuarantine,
        topCategory:          snapshot.topCategory as JsonValue,
        topCode:              snapshot.topCode as JsonValue,
        notes:                snapshot.notes as unknown as JsonValue,
        emittedAt:            snapshot.emittedAt,
      } as Record<string, JsonValue>,
      severity,
    );
    const output = this.makeOutput(envelope, 'TELEMETRY', severity, snapshot.owner, snapshot.tick, snapshot.budgetExhausted, snapshot.consecutiveFailures);
    return this.buildResult([output], 0);
  }

  /**
   * Translates an ErrorBoundaryTrendSnapshot into a chat signal.
   * Emits only when the direction changes from the last observed direction.
   */
  public translateTrend(
    trend: ErrorBoundaryTrendSnapshotCompat,
    owner: ErrorBoundaryOwnerCompat,
    tick: number,
  ): ErrorBoundaryAdapterResult {
    if (!this.config.emitTrendChanges) {
      return this.buildResult([], 1);
    }
    // Suppress if direction hasn't changed
    if (this.lastTrend !== null && this.lastTrend === trend.direction) {
      return this.buildResult([], 1);
    }
    this.lastTrend = trend.direction;

    const severity: ErrorBoundaryAdapterSeverity =
      trend.direction === 'CRITICAL'  ? 'CRITICAL' :
      trend.direction === 'DEGRADING' ? 'WARN'     : 'INFO';

    const envelope = buildEnvelope(
      this.config,
      'TREND_CHANGE',
      owner,
      tick,
      {
        direction:                    trend.direction,
        consecutiveFailuresNow:       trend.consecutiveFailuresNow,
        consecutiveFailuresPrior:     trend.consecutiveFailuresPrior,
        recentErrorRate:              trend.recentErrorRate,
        errorVelocity:                trend.errorVelocity,
        dominantCategory:             trend.dominantCategory as JsonValue,
        dominantOwner:                trend.dominantOwner as JsonValue,
        trendScore:                   trend.trendScore,
        assessedAt:                   trend.assessedAt,
      } as Record<string, JsonValue>,
      severity,
    );
    const output = this.makeOutput(envelope, 'TREND_CHANGE', severity, owner, tick, trend.direction === 'CRITICAL', trend.consecutiveFailuresNow);
    return this.buildResult([output], 0);
  }

  /**
   * Translates an ErrorBoundaryRecoveryForecast into a chat signal.
   * Emits only when `emitForecastChanges` is true and recommendation changes.
   */
  public translateForecast(
    forecast: ErrorBoundaryRecoveryForecastCompat,
    owner: ErrorBoundaryOwnerCompat,
    tick: number,
  ): ErrorBoundaryAdapterResult {
    if (!this.config.emitForecastChanges) {
      return this.buildResult([], 1);
    }
    if (this.lastRecommendation !== null && this.lastRecommendation === forecast.recommendation) {
      return this.buildResult([], 1);
    }
    this.lastRecommendation = forecast.recommendation;

    const severity: ErrorBoundaryAdapterSeverity =
      forecast.recommendation === 'ABORT'     ? 'CRITICAL' :
      forecast.recommendation === 'HALF_OPEN' ? 'WARN'     :
      forecast.recommendation === 'WARN'      ? 'WARN'     : 'INFO';

    const envelope = buildEnvelope(
      this.config,
      'FORECAST_CHANGE',
      owner,
      tick,
      {
        recoveryProbabilityNextTick:  forecast.recoveryProbabilityNextTick,
        recoveryProbability5Ticks:    forecast.recoveryProbability5Ticks,
        immediateRecoveryExpected:    forecast.immediateRecoveryExpected,
        recommendation:               forecast.recommendation,
        confidence:                   forecast.confidence,
        forecastAt:                   forecast.forecastAt,
      } as Record<string, JsonValue>,
      severity,
    );
    const output = this.makeOutput(envelope, 'FORECAST_CHANGE', severity, owner, tick, forecast.recommendation === 'ABORT', 0);
    return this.buildResult([output], 0);
  }

  /**
   * Translates a session report into a chat signal.
   * Always emits a summary regardless of config (designed for end-of-run).
   */
  public translateSessionReport(
    report: ErrorBoundarySessionReportCompat,
    tick: number,
  ): ErrorBoundaryAdapterResult {
    const severity: ErrorBoundaryAdapterSeverity =
      report.totalFatal > 0 || report.circuitBreakerOpenCount > 0 ? 'WARN' : 'INFO';
    const envelope = buildEnvelope(
      this.config,
      'TELEMETRY',
      report.owner,
      tick,
      {
        totalErrors:                  report.totalErrors,
        totalFatal:                   report.totalFatal,
        totalRecoverable:             report.totalRecoverable,
        maxConsecutiveFailuresReached: report.maxConsecutiveFailuresReached,
        circuitBreakerOpenCount:      report.circuitBreakerOpenCount,
        quarantineCount:              report.quarantineCount,
        budgetUtilizationPeak:        report.budgetUtilizationPeak,
        errorRatePeak:                report.errorRatePeak,
        mlAnomalyCount:               report.mlAnomalyCount,
        sessionDurationMs:            report.sessionDurationMs,
        reportAt:                     report.reportAt,
      } as Record<string, JsonValue>,
      severity,
    );
    const output = this.makeOutput(envelope, 'TELEMETRY', severity, report.owner, tick, report.totalFatal > 0, report.maxConsecutiveFailuresReached);
    return this.buildResult([output], 0);
  }

  /**
   * Translates a batch of ErrorBoundaryChatSignals in order.
   * Useful for replay or bulk ingestion of error batches.
   */
  public translateBatch(
    signals: readonly ErrorBoundaryChatSignalCompat[],
  ): ErrorBoundaryAdapterResult {
    const allSignals: ErrorBoundarySignalOutput[] = [];
    let totalSuppressed = 0;

    for (const signal of signals) {
      const result = this.translate(signal);
      for (const s of result.signals) allSignals.push(s);
      totalSuppressed += result.suppressedCount;
    }

    return this.buildResult(allSignals, totalSuppressed);
  }

  // ── State / diagnostics ────────────────────────────────────────────────────

  public getState(): ErrorBoundaryAdapterState {
    return {
      emittedCount:        this.emittedCount,
      suppressedCount:     this.suppressedCount,
      lastSignalAt:        this.lastSignalAt,
      lastKind:            this.lastKind,
      lastSeverity:        this.lastSeverity,
      lastOwner:           this.lastOwner,
      lastTrendDirection:  this.lastTrend,
      lastRecommendation:  this.lastRecommendation,
      criticalCount:       this.criticalCount,
    };
  }

  public getReport(): ErrorBoundaryAdapterReport {
    const state = this.getState();
    const diagnostics: string[] = [];
    if (state.criticalCount > 0) {
      diagnostics.push(`${state.criticalCount} CRITICAL signals emitted this session.`);
    }
    if (state.emittedCount === 0) {
      diagnostics.push('No signals emitted — check that error boundary is capturing faults.');
    }
    if (state.suppressedCount > state.emittedCount) {
      diagnostics.push('Suppression rate exceeds emit rate — review config thresholds.');
    }
    return {
      state,
      config: this.config,
      isHealthy: state.criticalCount === 0,
      diagnostics: Object.freeze(diagnostics),
      reportAt: isoNow(),
    };
  }

  public reset(): void {
    this.emittedCount    = 0;
    this.suppressedCount = 0;
    this.lastSignalAt    = null;
    this.lastKind        = null;
    this.lastSeverity    = null;
    this.lastOwner       = null;
    this.lastTrend       = null;
    this.lastRecommendation = null;
    this.criticalCount   = 0;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private shouldEmitKind(
    kind: ErrorBoundaryAdapterSignalKind,
    signal: ErrorBoundaryChatSignalCompat,
  ): boolean {
    switch (kind) {
      case 'STEP_FATAL':           return true; // cannot suppress
      case 'CIRCUIT_OPEN':         return true; // cannot suppress
      case 'BUDGET_EXHAUSTED':     return true; // cannot suppress
      case 'QUARANTINE_TRIGGERED': return this.config.emitQuarantine;
      case 'STEP_ERROR':           return this.config.emitStepError && signal.mlAnomalyScore >= clamp01(this.config.mlAnomalyThreshold - 0.1);
      case 'RECOVERY_DETECTED':    return this.config.emitRecovery;
      default:                     return true;
    }
  }

  private makeOutput(
    envelope: ChatInputEnvelope,
    kind: ErrorBoundaryAdapterSignalKind,
    severity: ErrorBoundaryAdapterSeverity,
    owner: ErrorBoundaryOwnerCompat,
    tick: number,
    fatal: boolean,
    consecutiveFailures: number,
  ): ErrorBoundarySignalOutput {
    const output: ErrorBoundarySignalOutput = {
      envelope,
      signalKind:          kind,
      severity,
      owner,
      tick,
      fatal,
      consecutiveFailures,
      translatedAt:        isoNow(),
    };
    this.emittedCount += 1;
    this.lastSignalAt  = nowMs();
    this.lastKind      = kind;
    this.lastSeverity  = severity;
    this.lastOwner     = owner;
    if (severity === 'CRITICAL') this.criticalCount += 1;
    return output;
  }

  private buildResult(
    signals: readonly ErrorBoundarySignalOutput[],
    suppressedCount: number,
  ): ErrorBoundaryAdapterResult {
    this.suppressedCount += suppressedCount;
    return {
      signals: Object.freeze([...signals]),
      emittedCount:        signals.length,
      suppressedCount,
      hasCriticalSignals:  signals.some(s => s.severity === 'CRITICAL'),
      processedAt:         isoNow(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience functions
// ─────────────────────────────────────────────────────────────────────────────

/** Creates a default-configured ErrorBoundarySignalAdapter. */
export function createErrorBoundarySignalAdapter(
  config?: Partial<ErrorBoundarySignalAdapterConfig>,
): ErrorBoundarySignalAdapter {
  return new ErrorBoundarySignalAdapter(config);
}

/**
 * Standalone translation of a single ErrorBoundaryChatSignal.
 * Constructs a transient adapter with default config for one-shot use.
 */
export function translateErrorBoundarySignal(
  signal: ErrorBoundaryChatSignalCompat,
  config?: Partial<ErrorBoundarySignalAdapterConfig>,
): ErrorBoundaryAdapterResult {
  return new ErrorBoundarySignalAdapter(config).translate(signal);
}

/**
 * Standalone translation of an ErrorBoundaryMLVector.
 */
export function translateErrorBoundaryMLVector(
  vector: ErrorBoundaryMLVectorCompat,
  config?: Partial<ErrorBoundarySignalAdapterConfig>,
): ErrorBoundaryAdapterResult {
  return new ErrorBoundarySignalAdapter(config).translateMLVector(vector);
}

/**
 * Standalone translation of an ErrorBoundaryTelemetrySnapshot.
 */
export function translateErrorBoundaryTelemetry(
  snapshot: ErrorBoundaryTelemetrySnapshotCompat,
  config?: Partial<ErrorBoundarySignalAdapterConfig>,
): ErrorBoundaryAdapterResult {
  return new ErrorBoundarySignalAdapter(config).translateTelemetry(snapshot);
}

/** Returns true if a value is an ErrorBoundaryChatSignalCompat. */
export function isErrorBoundaryChatSignalCompat(
  value: unknown,
): value is ErrorBoundaryChatSignalCompat {
  if (typeof value !== 'object' || value === null) return false;
  const sig = value as Record<string, unknown>;
  return (
    sig['surface'] === 'error_boundary' &&
    typeof sig['kind']  === 'string' &&
    typeof sig['tick']  === 'number' &&
    typeof sig['owner'] === 'string'
  );
}

/** Returns true if a value is an ErrorBoundaryMLVectorCompat. */
export function isErrorBoundaryMLVectorCompat(
  value: unknown,
): value is ErrorBoundaryMLVectorCompat {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v['features']) &&
    typeof v['anomalyScore'] === 'number' &&
    typeof v['tick']         === 'number'
  );
}

/** Returns the ML feature label at a given index. */
export function getErrorBoundaryAdapterMLFeatureLabel(index: number): string {
  return ERROR_BOUNDARY_ML_FEATURE_LABELS_COMPAT[index] ?? `feature_${index}`;
}

/** Returns the index of an ML feature label, or -1 if not found. */
export function getErrorBoundaryAdapterMLFeatureIndex(label: string): number {
  const idx = ERROR_BOUNDARY_ML_FEATURE_LABELS_COMPAT.indexOf(label);
  return idx >= 0 ? idx : -1;
}

/** Returns true if the given ML feature is anomalous in the vector. */
export function isErrorBoundaryAdapterMLFeatureAnomalous(
  vector: ErrorBoundaryMLVectorCompat,
  featureLabel: string,
  threshold = 0.5,
): boolean {
  const idx = getErrorBoundaryAdapterMLFeatureIndex(featureLabel);
  if (idx < 0) return false;
  return (vector.features[idx] ?? 0) >= threshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// Well-known singleton default adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default singleton ErrorBoundarySignalAdapter for the backend SYSTEM lane.
 * Wired with default config: STEP_FATAL, CIRCUIT_OPEN, BUDGET_EXHAUSTED,
 * QUARANTINE_TRIGGERED, RECOVERY_DETECTED, and ML_ANOMALY signals active.
 */
export const ERROR_BOUNDARY_DEFAULT_ADAPTER = new ErrorBoundarySignalAdapter(
  ERROR_BOUNDARY_SIGNAL_ADAPTER_DEFAULT_CONFIG,
);

export const ERROR_BOUNDARY_ADAPTER_MODULE_READY = true as const;

// ─────────────────────────────────────────────────────────────────────────────
// Score utility re-exports (used by consumers for threshold comparisons)
// ─────────────────────────────────────────────────────────────────────────────

export { clamp01 as clampErrorBoundaryScore01, clamp100 as clampErrorBoundaryScore100 };

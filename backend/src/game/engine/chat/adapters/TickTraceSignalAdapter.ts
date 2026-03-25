/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TICK TRACE SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/TickTraceSignalAdapter.ts
 * VERSION: 2026.03.25
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates TickTraceRecorder forensic truth —
 * trace errors, anomalies, slow steps, replay integrity events, health changes,
 * and ML/DL feature vectors — into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When a tick trace records an error, anomaly, or health degradation,
 *    what exact chat-native signal should the authoritative backend chat
 *    engine ingest to preserve forensic fidelity for NPC commentary?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces below.
 * - Trace errors are always accepted — they represent forensic truth.
 * - Anomaly score above threshold triggers WARN/ERROR level signals.
 * - Health transitions (passing ↔ failing) always emit a signal.
 * - ML vectors emit only when anomaly is above threshold or explicitly requested.
 * - Replay integrity drops below 90% always trigger CRITICAL signals.
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
// Structural compat interfaces — mirrors TickTraceChatSignalPayload
// ─────────────────────────────────────────────────────────────────────────────

export interface TickTraceChatSignalCompat {
  readonly surface: 'tick_trace';
  readonly kind: string;
  readonly tick: number;
  readonly runId: string;
  readonly traceId: string;
  readonly step: string;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly durationMs?: number | null;
  readonly errorMessage?: string | null;
  readonly healthGrade?: string | null;
  readonly anomalyScore?: number | null;
  readonly eventCount?: number | null;
  readonly signalCount?: number | null;
  readonly changedKeyCount?: number | null;
  readonly sealValid?: boolean | null;
}

export interface TickTraceMLVectorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly sampleCount: number;
  readonly generatedAtMs: number;
}

export interface TickTraceDLTensorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly shape: readonly [1, 48];
  readonly data: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly sampleCount: number;
  readonly generatedAtMs: number;
}

export interface TickTraceHealthReportCompat {
  readonly grade: string;
  readonly sampleCount: number;
  readonly errorRate: number;
  readonly avgDurationMs: number;
  readonly overBudgetRate: number;
  readonly sealValidationRate: number;
  readonly mutationStability: number;
  readonly recommendations: readonly string[];
  readonly generatedAtMs: number;
}

export interface TickTraceWindowSnapshotCompat {
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly errorRate: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly p95DurationMs: number;
  readonly avgChangedKeys: number;
  readonly avgEventCount: number;
  readonly avgSignalCount: number;
  readonly overBudgetRate: number;
}

export interface TickTraceRunCoverageCompat {
  readonly runId: string;
  readonly ticksCovered: number;
  readonly traceCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number;
  readonly stepCoverage: Readonly<Record<string, number>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter infrastructure types
// ─────────────────────────────────────────────────────────────────────────────

export interface TickTraceSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface TickTraceSignalAdapterClock {
  now(): UnixMs;
}

export interface TickTraceSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly anomalyThreshold?: number;
  readonly errorRateWarnThreshold?: number;
  readonly replayIntegrityWarnThreshold?: number;
  readonly suppressRoutineOk?: boolean;
  readonly logger?: TickTraceSignalAdapterLogger;
  readonly clock?: TickTraceSignalAdapterClock;
}

export interface TickTraceSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type TickTraceSignalAdapterEventName =
  | 'trace.error_spike'
  | 'trace.slow_step'
  | 'trace.mutation_anomaly'
  | 'trace.seal_mismatch'
  | 'trace.health_degraded'
  | 'trace.health_recovered'
  | 'trace.ml_vector'
  | 'trace.replay_integrity'
  | 'trace.high_event_volume'
  | 'trace.budget_exceeded'
  | 'trace.window_snapshot'
  | 'trace.run_coverage'
  | string;

export type TickTraceSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'OPERATIONAL'
  | 'CRITICAL'
  | 'CINEMATIC';

export type TickTraceSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface TickTraceSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: TickTraceSignalAdapterNarrativeWeight;
  readonly severity: TickTraceSignalAdapterSeverity;
  readonly eventName: TickTraceSignalAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly traceId: string;
  readonly step: string;
  readonly anomalyScore: Score01;
  readonly errorRate: Score01;
  readonly durationMs: number;
  readonly isError: boolean;
  readonly isAnomaly: boolean;
  readonly sealValid: boolean;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface TickTraceSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface TickTraceSignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface TickTraceSignalAdapterHistoryEntry {
  readonly artifact: TickTraceSignalAdapterArtifact;
  readonly acceptedAt: UnixMs;
  readonly domainId: 'TICK_TRACE';
}

export interface TickTraceSignalAdapterState {
  readonly accepted: number;
  readonly rejected: number;
  readonly deduped: number;
  readonly errorSignals: number;
  readonly anomalySignals: number;
  readonly healthDegradations: number;
  readonly healthRecoveries: number;
  readonly lastAcceptedAt: UnixMs | null;
  readonly lastGrade: string | null;
}

export interface TickTraceSignalAdapterReport {
  readonly state: TickTraceSignalAdapterState;
  readonly recentHistory: readonly TickTraceSignalAdapterHistoryEntry[];
  readonly recentRejections: readonly TickTraceSignalAdapterRejection[];
  readonly recentDeduped: readonly TickTraceSignalAdapterDeduped[];
  readonly domainId: 'TICK_TRACE';
  readonly generatedAt: UnixMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ANOMALY_THRESHOLD = 0.65;
const DEFAULT_ERROR_RATE_WARN = 0.1;
const DEFAULT_REPLAY_INTEGRITY_WARN = 0.9;
const DEFAULT_DEDUPE_WINDOW_MS = 2_000;
const DEFAULT_MAX_HISTORY = 128;

function mapSeverity(
  kind: string,
  sourceSeverity: 'info' | 'warn' | 'error',
): TickTraceSignalAdapterSeverity {
  if (kind.includes('health_degraded') || kind.includes('error_spike')) return 'CRITICAL';
  if (kind.includes('replay_integrity') || kind.includes('seal_mismatch')) return 'CRITICAL';
  if (sourceSeverity === 'error') return 'CRITICAL';
  if (sourceSeverity === 'warn') return 'WARN';
  if (kind.includes('ml_vector') || kind.includes('window_snapshot')) return 'INFO';
  return 'INFO';
}

function mapNarrativeWeight(
  severity: TickTraceSignalAdapterSeverity,
): TickTraceSignalAdapterNarrativeWeight {
  if (severity === 'CRITICAL') return 'CRITICAL';
  if (severity === 'WARN') return 'OPERATIONAL';
  return 'AMBIENT';
}

function mapEventName(kind: string): TickTraceSignalAdapterEventName {
  const MAP: Record<string, TickTraceSignalAdapterEventName> = {
    TRACE_ERROR_SPIKE: 'trace.error_spike',
    TRACE_SLOW_STEP: 'trace.slow_step',
    TRACE_MUTATION_ANOMALY: 'trace.mutation_anomaly',
    TRACE_SEAL_MISMATCH: 'trace.seal_mismatch',
    TRACE_HEALTH_DEGRADED: 'trace.health_degraded',
    TRACE_HEALTH_RECOVERED: 'trace.health_recovered',
    TRACE_ML_VECTOR_READY: 'trace.ml_vector',
    TRACE_REPLAY_INTEGRITY: 'trace.replay_integrity',
    TRACE_HIGH_EVENT_VOLUME: 'trace.high_event_volume',
    TRACE_BUDGET_EXCEEDED: 'trace.budget_exceeded',
  };
  return MAP[kind] ?? kind.toLowerCase().replace(/_/g, '.');
}

// ─────────────────────────────────────────────────────────────────────────────
// TickTraceSignalAdapter — main adapter class
// ─────────────────────────────────────────────────────────────────────────────

export class TickTraceSignalAdapter {
  private readonly _opts: Required<Omit<TickTraceSignalAdapterOptions, 'logger' | 'clock'>> & {
    readonly logger: TickTraceSignalAdapterLogger | null;
    readonly clock: TickTraceSignalAdapterClock;
  };

  private _accepted = 0;
  private _rejected = 0;
  private _deduped = 0;
  private _errorSignals = 0;
  private _anomalySignals = 0;
  private _healthDegradations = 0;
  private _healthRecoveries = 0;
  private _lastAcceptedAt: UnixMs | null = null;
  private _lastGrade: string | null = null;
  private readonly _history: TickTraceSignalAdapterHistoryEntry[] = [];
  private readonly _rejections: TickTraceSignalAdapterRejection[] = [];
  private readonly _deduped_list: TickTraceSignalAdapterDeduped[] = [];
  private readonly _dedupeCache = new Map<string, number>();

  public constructor(options: TickTraceSignalAdapterOptions) {
    this._opts = {
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GAME',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      anomalyThreshold: options.anomalyThreshold ?? DEFAULT_ANOMALY_THRESHOLD,
      errorRateWarnThreshold: options.errorRateWarnThreshold ?? DEFAULT_ERROR_RATE_WARN,
      replayIntegrityWarnThreshold:
        options.replayIntegrityWarnThreshold ?? DEFAULT_REPLAY_INTEGRITY_WARN,
      suppressRoutineOk: options.suppressRoutineOk ?? true,
      logger: options.logger ?? null,
      clock: options.clock ?? { now: () => asUnixMs(Date.now()) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adapt — from TickTraceChatSignalCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adapt(
    signal: TickTraceChatSignalCompat,
    context: TickTraceSignalAdapterContext = {},
  ): TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection | TickTraceSignalAdapterDeduped {
    const now = this._opts.clock.now();
    const anomalyScore = clamp01(signal.anomalyScore ?? 0) as Score01;
    const isError = signal.severity === 'error';
    const isAnomaly = anomalyScore >= this._opts.anomalyThreshold;

    // Always accept errors, health changes, and anomalies
    const alwaysAccept =
      isError ||
      signal.kind === 'TRACE_HEALTH_DEGRADED' ||
      signal.kind === 'TRACE_HEALTH_RECOVERED' ||
      signal.kind === 'TRACE_REPLAY_INTEGRITY' ||
      signal.kind === 'TRACE_SEAL_MISMATCH';

    if (!alwaysAccept && this._opts.suppressRoutineOk && !isAnomaly && signal.severity === 'info') {
      const rejection: TickTraceSignalAdapterRejection = {
        eventName: mapEventName(signal.kind),
        reason: 'Suppressed routine OK trace signal',
        details: { kind: signal.kind, tick: signal.tick, step: signal.step },
      };
      this._rejected++;
      this._rejections.push(rejection);
      if (this._rejections.length > this._opts.maxHistory) this._rejections.shift();
      return rejection;
    }

    const dedupeKey = `${signal.runId}::${signal.kind}::${signal.step}::${signal.severity}`;
    const lastSeen = this._dedupeCache.get(dedupeKey);
    if (lastSeen !== undefined && now - lastSeen < this._opts.dedupeWindowMs) {
      const deduped: TickTraceSignalAdapterDeduped = {
        eventName: mapEventName(signal.kind),
        dedupeKey,
        reason: `Deduped within ${this._opts.dedupeWindowMs}ms window`,
        details: { kind: signal.kind, tick: signal.tick },
      };
      this._deduped++;
      this._deduped_list.push(deduped);
      if (this._deduped_list.length > this._opts.maxHistory) this._deduped_list.shift();
      return deduped;
    }

    this._dedupeCache.set(dedupeKey, now);

    const severity = mapSeverity(signal.kind, signal.severity);
    const narrativeWeight = mapNarrativeWeight(severity);
    const eventName = mapEventName(signal.kind);
    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;

    const details: Record<string, JsonValue> = {
      kind: signal.kind,
      step: signal.step,
      tick: signal.tick,
      runId: signal.runId,
      traceId: signal.traceId,
      anomalyScore,
      severity: signal.severity,
    };
    if (signal.durationMs !== null && signal.durationMs !== undefined) {
      details['durationMs'] = signal.durationMs;
    }
    if (signal.errorMessage) details['errorMessage'] = signal.errorMessage;
    if (signal.changedKeyCount !== null && signal.changedKeyCount !== undefined) {
      details['changedKeyCount'] = signal.changedKeyCount;
    }
    if (context.source) details['source'] = context.source;

    const envelope: ChatInputEnvelope = Object.freeze({
      roomId: String(roomId),
      visibleChannel: routeChannel,
      emittedAt: asUnixMs(context.emittedAt ?? now),
      payload: Object.freeze({
        eventName,
        surface: 'tick_trace',
        tick: signal.tick,
        runId: signal.runId,
        traceId: signal.traceId,
        step: signal.step,
        severity,
        narrativeWeight,
        anomalyScore,
        message: signal.message,
        details: Object.freeze(details),
        tags: Object.freeze([
          ...(context.tags ?? []),
          `step:${signal.step}`,
          `kind:${signal.kind}`,
          `severity:${severity.toLowerCase()}`,
        ]),
      }),
    });

    const artifact: TickTraceSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      traceId: signal.traceId,
      step: signal.step,
      anomalyScore,
      errorRate: 0 as Score01,
      durationMs: signal.durationMs ?? 0,
      isError,
      isAnomaly,
      sealValid: signal.sealValid ?? true,
      details: Object.freeze(details),
    });

    this._accepted++;
    this._lastAcceptedAt = now;
    if (isError) this._errorSignals++;
    if (isAnomaly) this._anomalySignals++;
    if (signal.kind === 'TRACE_HEALTH_DEGRADED') {
      this._healthDegradations++;
      this._lastGrade = signal.healthGrade ?? null;
    }
    if (signal.kind === 'TRACE_HEALTH_RECOVERED') {
      this._healthRecoveries++;
      this._lastGrade = signal.healthGrade ?? null;
    }

    const entry: TickTraceSignalAdapterHistoryEntry = Object.freeze({
      artifact,
      acceptedAt: now,
      domainId: 'TICK_TRACE',
    });
    this._history.push(entry);
    if (this._history.length > this._opts.maxHistory) this._history.shift();

    this._opts.logger?.debug?.(`[TickTraceSignalAdapter] Accepted ${eventName}`, {
      tick: signal.tick, traceId: signal.traceId, anomalyScore,
    });

    return artifact;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptML — from TickTraceMLVectorCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptML(
    vector: TickTraceMLVectorCompat,
    context: TickTraceSignalAdapterContext = {},
  ): TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection {
    const anomalyScore = clamp01(vector.features[29] ?? 0) as Score01;
    if (anomalyScore < this._opts.anomalyThreshold && this._opts.suppressRoutineOk) {
      const rejection: TickTraceSignalAdapterRejection = {
        eventName: 'trace.ml_vector',
        reason: `ML vector anomaly score ${anomalyScore.toFixed(3)} below threshold`,
        details: { tick: vector.tick, runId: vector.runId, featureCount: vector.featureCount },
      };
      this._rejected++;
      this._rejections.push(rejection);
      if (this._rejections.length > this._opts.maxHistory) this._rejections.shift();
      return rejection;
    }

    const signal: TickTraceChatSignalCompat = {
      surface: 'tick_trace',
      kind: 'TRACE_ML_VECTOR_READY',
      tick: vector.tick,
      runId: vector.runId,
      traceId: `ml-${vector.runId}-${vector.tick}`,
      step: 'STEP_09_TELEMETRY',
      severity: 'info',
      message: `ML vector: ${vector.featureCount} features, ${vector.sampleCount} samples, anomaly ${anomalyScore.toFixed(3)}`,
      anomalyScore,
      durationMs: null,
      errorMessage: null,
      healthGrade: null,
      eventCount: null,
      signalCount: null,
      changedKeyCount: null,
      sealValid: true,
    };
    return this.adapt(signal, context);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptDL — from TickTraceDLTensorCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptDL(
    tensor: TickTraceDLTensorCompat,
    context: TickTraceSignalAdapterContext = {},
  ): TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection {
    const anomalyScore = clamp01(tensor.data[29] ?? 0) as Score01;
    if (anomalyScore < this._opts.anomalyThreshold && this._opts.suppressRoutineOk) {
      const rejection: TickTraceSignalAdapterRejection = {
        eventName: 'trace.ml_vector',
        reason: `DL tensor anomaly score ${anomalyScore.toFixed(3)} below threshold`,
        details: { tick: tensor.tick, runId: tensor.runId, featureCount: tensor.featureCount },
      };
      this._rejected++;
      this._rejections.push(rejection);
      if (this._rejections.length > this._opts.maxHistory) this._rejections.shift();
      return rejection;
    }

    const signal: TickTraceChatSignalCompat = {
      surface: 'tick_trace',
      kind: 'TRACE_ML_VECTOR_READY',
      tick: tensor.tick,
      runId: tensor.runId,
      traceId: `dl-${tensor.runId}-${tensor.tick}`,
      step: 'STEP_09_TELEMETRY',
      severity: 'info',
      message: `DL tensor: ${tensor.featureCount} features (${tensor.shape[0]}×${tensor.shape[1]}), anomaly ${anomalyScore.toFixed(3)}`,
      anomalyScore,
      durationMs: null,
      errorMessage: null,
      healthGrade: null,
      eventCount: null,
      signalCount: null,
      changedKeyCount: null,
      sealValid: true,
    };
    return this.adapt(signal, context);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptHealthReport — from TickTraceHealthReportCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptHealthReport(
    report: TickTraceHealthReportCompat,
    tick: number,
    runId: string,
    context: TickTraceSignalAdapterContext = {},
  ): TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection | null {
    const grade = report.grade;
    const passing = grade === 'S' || grade === 'A' || grade === 'B';
    const wasPassing = this._lastGrade === null || this._lastGrade === 'S' ||
      this._lastGrade === 'A' || this._lastGrade === 'B';

    if (passing === wasPassing) return null; // no transition

    const kind = passing ? 'TRACE_HEALTH_RECOVERED' : 'TRACE_HEALTH_DEGRADED';
    const signal: TickTraceChatSignalCompat = {
      surface: 'tick_trace',
      kind,
      tick,
      runId,
      traceId: `health-${runId}-${tick}`,
      step: 'STEP_09_TELEMETRY',
      severity: passing ? 'info' : (grade === 'F' ? 'error' : 'warn'),
      message: `Trace health ${passing ? 'recovered' : 'degraded'}: grade ${grade} — error rate ${(report.errorRate * 100).toFixed(1)}%`,
      healthGrade: grade,
      anomalyScore: clamp01(1 - report.sealValidationRate),
      durationMs: null,
      errorMessage: null,
      eventCount: null,
      signalCount: null,
      changedKeyCount: null,
      sealValid: report.sealValidationRate >= this._opts.replayIntegrityWarnThreshold,
    };
    return this.adapt(signal, context) as TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptWindowSnapshot — from TickTraceWindowSnapshotCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptWindowSnapshot(
    snap: TickTraceWindowSnapshotCompat,
    tick: number,
    runId: string,
    context: TickTraceSignalAdapterContext = {},
  ): TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection | null {
    if (snap.errorRate < this._opts.errorRateWarnThreshold && snap.overBudgetRate < 0.2) {
      return null; // suppress healthy windows
    }

    const severity: 'info' | 'warn' | 'error' =
      snap.errorRate > 0.3 ? 'error' : snap.errorRate > 0.1 ? 'warn' : 'info';

    const signal: TickTraceChatSignalCompat = {
      surface: 'tick_trace',
      kind: 'TRACE_BUDGET_EXCEEDED',
      tick,
      runId,
      traceId: `window-${runId}-${tick}`,
      step: 'STEP_09_TELEMETRY',
      severity,
      message: `Trace window: error rate ${(snap.errorRate * 100).toFixed(1)}%, avg ${snap.avgDurationMs.toFixed(1)}ms, over-budget ${(snap.overBudgetRate * 100).toFixed(1)}%`,
      anomalyScore: clamp01(snap.errorRate * 0.6 + snap.overBudgetRate * 0.4),
      durationMs: snap.avgDurationMs,
      errorMessage: null,
      healthGrade: null,
      eventCount: Math.round(snap.avgEventCount),
      signalCount: Math.round(snap.avgSignalCount),
      changedKeyCount: Math.round(snap.avgChangedKeys),
      sealValid: true,
    };
    return this.adapt(signal, context) as TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptRunCoverage — from TickTraceRunCoverageCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptRunCoverage(
    coverage: TickTraceRunCoverageCompat,
    tick: number,
    context: TickTraceSignalAdapterContext = {},
  ): TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection | null {
    const errorRate = coverage.traceCount === 0 ? 0 : coverage.errorCount / coverage.traceCount;
    if (errorRate < this._opts.errorRateWarnThreshold) return null;

    const signal: TickTraceChatSignalCompat = {
      surface: 'tick_trace',
      kind: 'TRACE_ERROR_SPIKE',
      tick,
      runId: coverage.runId,
      traceId: `coverage-${coverage.runId}-${tick}`,
      step: 'STEP_13_FLUSH',
      severity: errorRate > 0.3 ? 'error' : 'warn',
      message: `Run ${coverage.runId}: ${coverage.traceCount} traces across ${coverage.ticksCovered} ticks, error rate ${(errorRate * 100).toFixed(1)}%`,
      anomalyScore: clamp01(errorRate),
      durationMs: coverage.avgDurationMs,
      errorMessage: null,
      healthGrade: null,
      eventCount: null,
      signalCount: null,
      changedKeyCount: null,
      sealValid: true,
    };
    return this.adapt(signal, context) as TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptBatch
  // ─────────────────────────────────────────────────────────────────────────

  public adaptBatch(
    signals: readonly TickTraceChatSignalCompat[],
    context: TickTraceSignalAdapterContext = {},
  ): readonly (TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection | TickTraceSignalAdapterDeduped)[] {
    return signals.map(s => this.adapt(s, context));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // state / report / reset
  // ─────────────────────────────────────────────────────────────────────────

  public state(): TickTraceSignalAdapterState {
    return Object.freeze({
      accepted: this._accepted,
      rejected: this._rejected,
      deduped: this._deduped,
      errorSignals: this._errorSignals,
      anomalySignals: this._anomalySignals,
      healthDegradations: this._healthDegradations,
      healthRecoveries: this._healthRecoveries,
      lastAcceptedAt: this._lastAcceptedAt,
      lastGrade: this._lastGrade,
    });
  }

  public report(): TickTraceSignalAdapterReport {
    return Object.freeze({
      state: this.state(),
      recentHistory: Object.freeze([...this._history]),
      recentRejections: Object.freeze([...this._rejections]),
      recentDeduped: Object.freeze([...this._deduped_list]),
      domainId: 'TICK_TRACE',
      generatedAt: this._opts.clock.now(),
    });
  }

  public reset(): void {
    this._accepted = 0;
    this._rejected = 0;
    this._deduped = 0;
    this._errorSignals = 0;
    this._anomalySignals = 0;
    this._healthDegradations = 0;
    this._healthRecoveries = 0;
    this._lastAcceptedAt = null;
    this._lastGrade = null;
    this._history.length = 0;
    this._rejections.length = 0;
    this._deduped_list.length = 0;
    this._dedupeCache.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TickTraceSignalRateController — budget-aware rate limiting
// ─────────────────────────────────────────────────────────────────────────────

export interface TickTraceRateBucket {
  readonly kind: string;
  readonly count: number;
  readonly limit: number;
  readonly resetsAtMs: number;
}

export class TickTraceSignalRateController {
  private readonly _buckets = new Map<string, { count: number; resetsAtMs: number }>();
  private readonly _windowMs: number;
  private readonly _limits: Readonly<Record<string, number>>;

  public constructor(
    windowMs = 10_000,
    limits: Readonly<Record<string, number>> = {
      'trace.error_spike': 10,
      'trace.slow_step': 20,
      'trace.ml_vector': 5,
      'trace.replay_integrity': 3,
      'trace.health_degraded': 2,
      'trace.health_recovered': 2,
    },
  ) {
    this._windowMs = windowMs;
    this._limits = limits;
  }

  public allow(eventName: string, nowMs: number): boolean {
    const limit = this._limits[eventName] ?? 50;
    const bucket = this._buckets.get(eventName);
    if (!bucket || nowMs >= bucket.resetsAtMs) {
      this._buckets.set(eventName, { count: 1, resetsAtMs: nowMs + this._windowMs });
      return true;
    }
    if (bucket.count >= limit) return false;
    this._buckets.set(eventName, { count: bucket.count + 1, resetsAtMs: bucket.resetsAtMs });
    return true;
  }

  public getBuckets(): readonly TickTraceRateBucket[] {
    const now = Date.now();
    return [...this._buckets.entries()].map(([kind, b]) => Object.freeze({
      kind,
      count: b.count,
      limit: this._limits[kind] ?? 50,
      resetsAtMs: b.resetsAtMs,
    }));
  }

  public reset(): void {
    this._buckets.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TickTraceReplayBuffer — recent signal buffer for replay/debugging
// ─────────────────────────────────────────────────────────────────────────────

export class TickTraceReplayBuffer {
  private readonly _capacity: number;
  private readonly _buffer: TickTraceSignalAdapterArtifact[] = [];

  public constructor(capacity = 32) {
    this._capacity = Math.max(1, capacity);
  }

  public push(artifact: TickTraceSignalAdapterArtifact): void {
    this._buffer.push(artifact);
    if (this._buffer.length > this._capacity) this._buffer.shift();
  }

  public getAll(): readonly TickTraceSignalAdapterArtifact[] {
    return Object.freeze([...this._buffer]);
  }

  public getByKind(eventName: string): readonly TickTraceSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.eventName === eventName);
  }

  public getErrors(): readonly TickTraceSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isError);
  }

  public getAnomalies(): readonly TickTraceSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isAnomaly);
  }

  public clear(): void {
    this._buffer.length = 0;
  }

  public get size(): number { return this._buffer.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// TickTraceSignalAdapterSuite — composed adapter with rate control + replay
// ─────────────────────────────────────────────────────────────────────────────

export interface TickTraceSignalSuiteOptions extends TickTraceSignalAdapterOptions {
  readonly rateWindowMs?: number;
  readonly replayCapacity?: number;
}

export class TickTraceSignalAdapterSuite {
  public readonly adapter: TickTraceSignalAdapter;
  public readonly rateController: TickTraceSignalRateController;
  public readonly replayBuffer: TickTraceReplayBuffer;

  public constructor(options: TickTraceSignalSuiteOptions) {
    this.adapter = new TickTraceSignalAdapter(options);
    this.rateController = new TickTraceSignalRateController(options.rateWindowMs);
    this.replayBuffer = new TickTraceReplayBuffer(options.replayCapacity);
  }

  public process(
    signal: TickTraceChatSignalCompat,
    context: TickTraceSignalAdapterContext = {},
    nowMs = Date.now(),
  ): TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection | TickTraceSignalAdapterDeduped {
    const eventName = mapEventName(signal.kind);
    if (!this.rateController.allow(eventName, nowMs)) {
      const rejection: TickTraceSignalAdapterRejection = {
        eventName,
        reason: 'Rate limit exceeded',
        details: { kind: signal.kind, tick: signal.tick },
      };
      return rejection;
    }
    const result = this.adapter.adapt(signal, context);
    if ('envelope' in result) this.replayBuffer.push(result);
    return result;
  }

  public processML(
    vector: TickTraceMLVectorCompat,
    context: TickTraceSignalAdapterContext = {},
  ): TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection {
    return this.adapter.adaptML(vector, context);
  }

  public processDL(
    tensor: TickTraceDLTensorCompat,
    context: TickTraceSignalAdapterContext = {},
  ): TickTraceSignalAdapterArtifact | TickTraceSignalAdapterRejection {
    return this.adapter.adaptDL(tensor, context);
  }

  public state(): TickTraceSignalAdapterState { return this.adapter.state(); }
  public report(): TickTraceSignalAdapterReport { return this.adapter.report(); }

  public reset(): void {
    this.adapter.reset();
    this.rateController.reset();
    this.replayBuffer.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory functions
// ─────────────────────────────────────────────────────────────────────────────

export function createTickTraceSignalAdapter(
  options: TickTraceSignalAdapterOptions,
): TickTraceSignalAdapter {
  return new TickTraceSignalAdapter(options);
}

export function createTickTraceSignalAdapterSuite(
  options: TickTraceSignalSuiteOptions,
): TickTraceSignalAdapterSuite {
  return new TickTraceSignalAdapterSuite(options);
}

export function isTickTraceSignalAdapterArtifact(
  value: unknown,
): value is TickTraceSignalAdapterArtifact {
  return (
    typeof value === 'object' &&
    value !== null &&
    'envelope' in value &&
    'traceId' in value &&
    'anomalyScore' in value
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Module constants
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_TRACE_SIGNAL_ADAPTER_MODULE_VERSION = '2026.03.25' as const;
export const TICK_TRACE_SIGNAL_ADAPTER_READY = true as const;

export const TICK_TRACE_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  domain: 'TICK_TRACE',
  className: 'TickTraceSignalAdapter',
  relativePath: 'backend/src/game/engine/chat/adapters/TickTraceSignalAdapter.ts',
  ownsTruth: false as const,
  description: 'Translates TickTraceRecorder forensic truth into backend-chat trace ingress.',
  moduleVersion: TICK_TRACE_SIGNAL_ADAPTER_MODULE_VERSION,
});

// Utility re-exports for consumers that need the score helpers
export { clamp01, clamp100, asUnixMs };

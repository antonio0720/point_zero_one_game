/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TICK SEQUENCE SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/TickSequenceSignalAdapter.ts
 * VERSION: 2026.03.25
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates TickSequence engine truth —
 * slow step detections, phase completions, health changes, anomalies, and
 * ML/DL feature vectors — into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the tick sequence completes a phase, detects a slow step, or
 *    experiences a health degradation, what exact chat-native signal should
 *    the authoritative backend chat engine ingest to preserve tick fidelity?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces below.
 * - Slow step signals above 3× budget always emit regardless of suppress flag.
 * - Health transitions always emit — they represent sequence truth.
 * - Phase completions emit only for FINALIZATION phase by default.
 * - ML vectors emit only when anomaly score exceeds threshold.
 * - Step error signals are always accepted at CRITICAL severity.
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
// Structural compat interfaces — mirrors TickSequenceChatSignalPayload
// ─────────────────────────────────────────────────────────────────────────────

export interface TickSequenceChatSignalCompat {
  readonly surface: 'tick_sequence';
  readonly kind: string;
  readonly tick: number;
  readonly runId: string;
  readonly step: string;
  readonly phase: string;
  readonly owner: string;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly durationMs?: number | null;
  readonly budgetMs?: number | null;
  readonly errorMessage?: string | null;
  readonly healthGrade?: string | null;
  readonly anomalyScore?: number | null;
  readonly stepSuccessRate?: number | null;
  readonly sequenceCompletionRatio?: number | null;
}

export interface TickSequenceMLVectorCompat {
  readonly tick: number;
  readonly runId: string;
  readonly step: string;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly generatedAtMs: number;
}

export interface TickSequenceDLTensorCompat {
  readonly tick: number;
  readonly runId: string;
  readonly step: string;
  readonly shape: readonly [1, 48];
  readonly data: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly generatedAtMs: number;
}

export interface TickSequenceHealthReportCompat {
  readonly grade: string;
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

export interface TickStepPerformanceSummaryCompat {
  readonly step: string;
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

export interface TickPhaseTimingSummaryCompat {
  readonly phase: string;
  readonly steps: readonly string[];
  readonly totalDurationMs: number;
  readonly avgDurationMs: number;
  readonly slowestStep: string | null;
  readonly fastestStep: string | null;
  readonly errorCount: number;
  readonly completionRate: number;
}

export interface TickSequenceStatCompat {
  readonly totalStepsRecorded: number;
  readonly totalErrorsRecorded: number;
  readonly overallSuccessRate: number;
  readonly avgTickDurationMs: number;
  readonly slowestStep: string | null;
  readonly mostFrequentError: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter infrastructure types
// ─────────────────────────────────────────────────────────────────────────────

export interface TickSequenceSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface TickSequenceSignalAdapterClock {
  now(): UnixMs;
}

export interface TickSequenceSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly anomalyThreshold?: number;
  readonly slowStepMultiplier?: number;
  readonly alwaysEmitOnError?: boolean;
  readonly emitPhaseCompletions?: boolean;
  readonly logger?: TickSequenceSignalAdapterLogger;
  readonly clock?: TickSequenceSignalAdapterClock;
}

export interface TickSequenceSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type TickSequenceSignalAdapterEventName =
  | 'sequence.step_completed'
  | 'sequence.step_errored'
  | 'sequence.phase_completed'
  | 'sequence.anomaly'
  | 'sequence.slow_step'
  | 'sequence.budget_exceeded'
  | 'sequence.health_degraded'
  | 'sequence.health_recovered'
  | 'sequence.ml_vector'
  | 'sequence.validated'
  | 'sequence.step_performance'
  | 'sequence.phase_timing'
  | string;

export type TickSequenceSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'OPERATIONAL'
  | 'CRITICAL'
  | 'CINEMATIC';

export type TickSequenceSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface TickSequenceSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: TickSequenceSignalAdapterNarrativeWeight;
  readonly severity: TickSequenceSignalAdapterSeverity;
  readonly eventName: TickSequenceSignalAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly step: string;
  readonly phase: string;
  readonly owner: string;
  readonly anomalyScore: Score01;
  readonly durationMs: number;
  readonly budgetMs: number;
  readonly isError: boolean;
  readonly isSlowStep: boolean;
  readonly isAnomaly: boolean;
  readonly healthGrade: string | null;
  readonly sequenceCompletionRatio: Score01;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface TickSequenceSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface TickSequenceSignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface TickSequenceSignalAdapterHistoryEntry {
  readonly artifact: TickSequenceSignalAdapterArtifact;
  readonly acceptedAt: UnixMs;
  readonly domainId: 'TICK_SEQUENCE';
}

export interface TickSequenceSignalAdapterState {
  readonly accepted: number;
  readonly rejected: number;
  readonly deduped: number;
  readonly errorSignals: number;
  readonly slowStepSignals: number;
  readonly anomalySignals: number;
  readonly healthDegradations: number;
  readonly healthRecoveries: number;
  readonly lastAcceptedAt: UnixMs | null;
  readonly lastHealthGrade: string | null;
}

export interface TickSequenceSignalAdapterReport {
  readonly state: TickSequenceSignalAdapterState;
  readonly recentHistory: readonly TickSequenceSignalAdapterHistoryEntry[];
  readonly recentRejections: readonly TickSequenceSignalAdapterRejection[];
  readonly recentDeduped: readonly TickSequenceSignalAdapterDeduped[];
  readonly domainId: 'TICK_SEQUENCE';
  readonly generatedAt: UnixMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ANOMALY_THRESHOLD = 0.6;
const DEFAULT_SLOW_MULTIPLIER = 3;
const DEFAULT_DEDUPE_WINDOW_MS = 2_000;
const DEFAULT_MAX_HISTORY = 128;

function mapSeverity(
  kind: string,
  sourceSeverity: 'info' | 'warn' | 'error',
): TickSequenceSignalAdapterSeverity {
  if (kind.includes('health_degraded') || kind.includes('step_errored')) return 'CRITICAL';
  if (kind.includes('budget_exceeded') || kind.includes('anomaly')) return 'WARN';
  if (sourceSeverity === 'error') return 'CRITICAL';
  if (sourceSeverity === 'warn') return 'WARN';
  return 'INFO';
}

function mapNarrativeWeight(
  severity: TickSequenceSignalAdapterSeverity,
): TickSequenceSignalAdapterNarrativeWeight {
  if (severity === 'CRITICAL') return 'CRITICAL';
  if (severity === 'WARN') return 'OPERATIONAL';
  return 'AMBIENT';
}

function mapEventName(kind: string): TickSequenceSignalAdapterEventName {
  const MAP: Record<string, TickSequenceSignalAdapterEventName> = {
    STEP_COMPLETED: 'sequence.step_completed',
    STEP_ERRORED: 'sequence.step_errored',
    PHASE_COMPLETED: 'sequence.phase_completed',
    SEQUENCE_ANOMALY: 'sequence.anomaly',
    SLOW_STEP_DETECTED: 'sequence.slow_step',
    STEP_BUDGET_EXCEEDED: 'sequence.budget_exceeded',
    HEALTH_DEGRADED: 'sequence.health_degraded',
    HEALTH_RECOVERED: 'sequence.health_recovered',
    ML_VECTOR_READY: 'sequence.ml_vector',
    SEQUENCE_VALIDATED: 'sequence.validated',
  };
  return MAP[kind] ?? kind.toLowerCase().replace(/_/g, '.');
}

// ─────────────────────────────────────────────────────────────────────────────
// TickSequenceSignalAdapter — main adapter class
// ─────────────────────────────────────────────────────────────────────────────

export class TickSequenceSignalAdapter {
  private readonly _opts: Required<Omit<TickSequenceSignalAdapterOptions, 'logger' | 'clock'>> & {
    readonly logger: TickSequenceSignalAdapterLogger | null;
    readonly clock: TickSequenceSignalAdapterClock;
  };

  private _accepted = 0;
  private _rejected = 0;
  private _deduped = 0;
  private _errorSignals = 0;
  private _slowStepSignals = 0;
  private _anomalySignals = 0;
  private _healthDegradations = 0;
  private _healthRecoveries = 0;
  private _lastAcceptedAt: UnixMs | null = null;
  private _lastHealthGrade: string | null = null;
  private readonly _history: TickSequenceSignalAdapterHistoryEntry[] = [];
  private readonly _rejections: TickSequenceSignalAdapterRejection[] = [];
  private readonly _deduped_list: TickSequenceSignalAdapterDeduped[] = [];
  private readonly _dedupeCache = new Map<string, number>();

  public constructor(options: TickSequenceSignalAdapterOptions) {
    this._opts = {
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'LOBBY',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      anomalyThreshold: options.anomalyThreshold ?? DEFAULT_ANOMALY_THRESHOLD,
      slowStepMultiplier: options.slowStepMultiplier ?? DEFAULT_SLOW_MULTIPLIER,
      alwaysEmitOnError: options.alwaysEmitOnError ?? true,
      emitPhaseCompletions: options.emitPhaseCompletions ?? false,
      logger: options.logger ?? null,
      clock: options.clock ?? { now: () => asUnixMs(Date.now()) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adapt — from TickSequenceChatSignalCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adapt(
    signal: TickSequenceChatSignalCompat,
    context: TickSequenceSignalAdapterContext = {},
  ): TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection | TickSequenceSignalAdapterDeduped {
    const now = this._opts.clock.now();
    const anomalyScore = clamp01(signal.anomalyScore ?? 0) as Score01;
    const isError = signal.severity === 'error';
    const durationMs = signal.durationMs ?? 0;
    const budgetMs = signal.budgetMs ?? 50;
    const isSlowStep =
      signal.kind === 'SLOW_STEP_DETECTED' ||
      signal.kind === 'STEP_BUDGET_EXCEEDED' ||
      durationMs > budgetMs * this._opts.slowStepMultiplier;
    const isAnomaly = anomalyScore >= this._opts.anomalyThreshold;

    const alwaysAccept =
      isError ||
      signal.kind === 'STEP_ERRORED' ||
      signal.kind === 'HEALTH_DEGRADED' ||
      signal.kind === 'HEALTH_RECOVERED' ||
      isSlowStep;

    if (!alwaysAccept && !isAnomaly && signal.kind === 'STEP_COMPLETED') {
      const rejection: TickSequenceSignalAdapterRejection = {
        eventName: mapEventName(signal.kind),
        reason: 'Suppressed routine step completion',
        details: { kind: signal.kind, step: signal.step, tick: signal.tick },
      };
      this._rejected++;
      this._rejections.push(rejection);
      if (this._rejections.length > this._opts.maxHistory) this._rejections.shift();
      return rejection;
    }

    if (signal.kind === 'PHASE_COMPLETED' && !this._opts.emitPhaseCompletions && !isAnomaly) {
      const rejection: TickSequenceSignalAdapterRejection = {
        eventName: 'sequence.phase_completed',
        reason: 'Phase completion signals suppressed (emitPhaseCompletions=false)',
        details: { phase: signal.phase, tick: signal.tick },
      };
      this._rejected++;
      this._rejections.push(rejection);
      if (this._rejections.length > this._opts.maxHistory) this._rejections.shift();
      return rejection;
    }

    const dedupeKey = `${signal.runId}::${signal.kind}::${signal.step}::${signal.phase}`;
    const lastSeen = this._dedupeCache.get(dedupeKey);
    if (!alwaysAccept && lastSeen !== undefined && now - lastSeen < this._opts.dedupeWindowMs) {
      const deduped: TickSequenceSignalAdapterDeduped = {
        eventName: mapEventName(signal.kind),
        dedupeKey,
        reason: `Deduped within ${this._opts.dedupeWindowMs}ms window`,
        details: { kind: signal.kind, step: signal.step, tick: signal.tick },
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
    const seqCompletion = clamp01(signal.sequenceCompletionRatio ?? 0) as Score01;

    const details: Record<string, JsonValue> = {
      kind: signal.kind,
      step: signal.step,
      phase: signal.phase,
      owner: signal.owner,
      tick: signal.tick,
      runId: signal.runId,
      severity: signal.severity,
      anomalyScore,
    };
    if (durationMs > 0) details['durationMs'] = durationMs;
    if (budgetMs > 0) details['budgetMs'] = budgetMs;
    if (signal.errorMessage) details['errorMessage'] = signal.errorMessage;
    if (signal.healthGrade) details['healthGrade'] = signal.healthGrade;
    if (signal.stepSuccessRate !== null && signal.stepSuccessRate !== undefined) {
      details['stepSuccessRate'] = signal.stepSuccessRate;
    }
    if (context.source) details['source'] = context.source;

    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const signalPayload: ChatSignalEnvelope = Object.freeze({
      type: 'RUN',
      emittedAt,
      roomId: String(roomId) as ChatRoomId,
      metadata: Object.freeze({
        eventName,
        visibleChannel: routeChannel,
        surface: 'tick_sequence',
        tick: signal.tick,
        runId: signal.runId,
        step: signal.step,
        phase: signal.phase,
        owner: signal.owner,
        severity,
        narrativeWeight,
        anomalyScore,
        ...(signal.message != null ? { message: signal.message } : {}),
        sequenceCompletionRatio: seqCompletion,
        details,
        tags: [
          ...(context.tags ?? []),
          `step:${signal.step}`,
          `phase:${signal.phase}`,
          `kind:${signal.kind}`,
          `severity:${severity.toLowerCase()}`,
        ],
      }) as Readonly<Record<string, JsonValue>>,
    });
    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'RUN_SIGNAL',
      emittedAt,
      payload: signalPayload,
    });

    const artifact: TickSequenceSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      step: signal.step,
      phase: signal.phase,
      owner: signal.owner,
      anomalyScore,
      durationMs,
      budgetMs,
      isError,
      isSlowStep,
      isAnomaly,
      healthGrade: signal.healthGrade ?? null,
      sequenceCompletionRatio: seqCompletion,
      details: Object.freeze(details),
    });

    this._accepted++;
    this._lastAcceptedAt = now;
    if (isError) this._errorSignals++;
    if (isSlowStep) this._slowStepSignals++;
    if (isAnomaly) this._anomalySignals++;
    if (signal.kind === 'HEALTH_DEGRADED') {
      this._healthDegradations++;
      this._lastHealthGrade = signal.healthGrade ?? null;
    }
    if (signal.kind === 'HEALTH_RECOVERED') {
      this._healthRecoveries++;
      this._lastHealthGrade = signal.healthGrade ?? null;
    }

    const entry: TickSequenceSignalAdapterHistoryEntry = Object.freeze({
      artifact,
      acceptedAt: now,
      domainId: 'TICK_SEQUENCE',
    });
    this._history.push(entry);
    if (this._history.length > this._opts.maxHistory) this._history.shift();

    this._opts.logger?.debug?.(`[TickSequenceSignalAdapter] Accepted ${eventName}`, {
      step: signal.step, phase: signal.phase, tick: signal.tick, anomalyScore,
    });

    return artifact;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptML — from TickSequenceMLVectorCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptML(
    vector: TickSequenceMLVectorCompat,
    context: TickSequenceSignalAdapterContext = {},
  ): TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection {
    const anomalyScore = clamp01(vector.features[29] ?? 0) as Score01;
    if (anomalyScore < this._opts.anomalyThreshold) {
      const rejection: TickSequenceSignalAdapterRejection = {
        eventName: 'sequence.ml_vector',
        reason: `ML vector anomaly score ${anomalyScore.toFixed(3)} below threshold`,
        details: { tick: vector.tick, step: vector.step, featureCount: vector.featureCount },
      };
      this._rejected++;
      this._rejections.push(rejection);
      if (this._rejections.length > this._opts.maxHistory) this._rejections.shift();
      return rejection;
    }

    const signal: TickSequenceChatSignalCompat = {
      surface: 'tick_sequence',
      kind: 'ML_VECTOR_READY',
      tick: vector.tick,
      runId: vector.runId,
      step: vector.step,
      phase: 'OBSERVABILITY',
      owner: 'telemetry',
      severity: 'info',
      message: `ML vector ready for step ${vector.step} (${vector.featureCount} features), anomaly ${anomalyScore.toFixed(3)}`,
      anomalyScore,
      durationMs: null,
      budgetMs: null,
      errorMessage: null,
      healthGrade: null,
      stepSuccessRate: vector.features[26] ?? null,
      sequenceCompletionRatio: vector.features[23] ?? null,
    };
    return this.adapt(signal, context) as TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptDL — from TickSequenceDLTensorCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptDL(
    tensor: TickSequenceDLTensorCompat,
    context: TickSequenceSignalAdapterContext = {},
  ): TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection {
    const anomalyScore = clamp01(tensor.data[29] ?? 0) as Score01;
    if (anomalyScore < this._opts.anomalyThreshold) {
      const rejection: TickSequenceSignalAdapterRejection = {
        eventName: 'sequence.ml_vector',
        reason: `DL tensor anomaly score ${anomalyScore.toFixed(3)} below threshold`,
        details: { tick: tensor.tick, step: tensor.step, featureCount: tensor.featureCount },
      };
      this._rejected++;
      this._rejections.push(rejection);
      if (this._rejections.length > this._opts.maxHistory) this._rejections.shift();
      return rejection;
    }

    const signal: TickSequenceChatSignalCompat = {
      surface: 'tick_sequence',
      kind: 'ML_VECTOR_READY',
      tick: tensor.tick,
      runId: tensor.runId,
      step: tensor.step,
      phase: 'OBSERVABILITY',
      owner: 'telemetry',
      severity: 'info',
      message: `DL tensor: ${tensor.featureCount} features (${tensor.shape[0]}×${tensor.shape[1]}), anomaly ${anomalyScore.toFixed(3)}`,
      anomalyScore,
      durationMs: null,
      budgetMs: null,
      errorMessage: null,
      healthGrade: null,
      stepSuccessRate: null,
      sequenceCompletionRatio: tensor.data[23] ?? null,
    };
    return this.adapt(signal, context) as TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptHealthReport — from TickSequenceHealthReportCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptHealthReport(
    report: TickSequenceHealthReportCompat,
    tick: number,
    runId: string,
    context: TickSequenceSignalAdapterContext = {},
  ): TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection | null {
    const grade = report.grade;
    const passing = grade === 'S' || grade === 'A' || grade === 'B';
    const wasPassing = this._lastHealthGrade === null ||
      this._lastHealthGrade === 'S' ||
      this._lastHealthGrade === 'A' ||
      this._lastHealthGrade === 'B';

    if (passing === wasPassing) return null;

    const kind = passing ? 'HEALTH_RECOVERED' : 'HEALTH_DEGRADED';
    const signal: TickSequenceChatSignalCompat = {
      surface: 'tick_sequence',
      kind,
      tick,
      runId,
      step: 'STEP_09_TELEMETRY',
      phase: 'OBSERVABILITY',
      owner: 'telemetry',
      severity: passing ? 'info' : (grade === 'F' ? 'error' : 'warn'),
      message: `Tick sequence health ${passing ? 'recovered' : 'degraded'}: grade ${grade} (error rate ${(report.errorRate * 100).toFixed(1)}%, ${report.slowStepCount} slow steps)`,
      healthGrade: grade,
      anomalyScore: clamp01(report.errorRate + report.overBudgetRate * 0.5),
      durationMs: report.avgDurationMs,
      budgetMs: null,
      errorMessage: null,
      stepSuccessRate: report.healthyStepRatio,
      sequenceCompletionRatio: null,
    };
    return this.adapt(signal, context) as TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptStepPerformance — from TickStepPerformanceSummaryCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptStepPerformance(
    summary: TickStepPerformanceSummaryCompat,
    tick: number,
    runId: string,
    context: TickSequenceSignalAdapterContext = {},
  ): TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection | null {
    if (summary.overBudgetRate < 0.2 && summary.errorCount === 0) return null;

    const signal: TickSequenceChatSignalCompat = {
      surface: 'tick_sequence',
      kind: summary.errorCount > 0 ? 'STEP_ERRORED' : 'SLOW_STEP_DETECTED',
      tick,
      runId,
      step: summary.step,
      phase: 'ENGINE',
      owner: 'system',
      severity: summary.errorCount > 0 ? 'error' : 'warn',
      message: `Step ${summary.step}: avg ${summary.avgDurationMs.toFixed(1)}ms, ${summary.errorCount} errors, ${(summary.overBudgetRate * 100).toFixed(1)}% over budget`,
      anomalyScore: clamp01((1 - summary.successRate) * 0.6 + summary.overBudgetRate * 0.4),
      durationMs: summary.avgDurationMs,
      budgetMs: null,
      errorMessage: summary.errorCount > 0 ? `${summary.errorCount} errors across ${summary.sampleCount} samples` : null,
      healthGrade: null,
      stepSuccessRate: summary.successRate,
      sequenceCompletionRatio: null,
    };
    return this.adapt(signal, context) as TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptPhaseTiming — from TickPhaseTimingSummaryCompat
  // ─────────────────────────────────────────────────────────────────────────

  public adaptPhaseTiming(
    summary: TickPhaseTimingSummaryCompat,
    tick: number,
    runId: string,
    context: TickSequenceSignalAdapterContext = {},
  ): TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection | null {
    if (!this._opts.emitPhaseCompletions && summary.errorCount === 0) return null;

    const signal: TickSequenceChatSignalCompat = {
      surface: 'tick_sequence',
      kind: 'PHASE_COMPLETED',
      tick,
      runId,
      step: summary.slowestStep ?? 'STEP_13_FLUSH',
      phase: summary.phase,
      owner: 'system',
      severity: summary.errorCount > 0 ? 'warn' : 'info',
      message: `Phase ${summary.phase}: ${summary.steps.length} steps, avg ${summary.avgDurationMs.toFixed(1)}ms, ${summary.errorCount} errors`,
      anomalyScore: clamp01(summary.errorCount / Math.max(1, summary.steps.length)),
      durationMs: summary.totalDurationMs,
      budgetMs: null,
      errorMessage: summary.errorCount > 0 ? `${summary.errorCount} phase errors` : null,
      healthGrade: null,
      stepSuccessRate: summary.completionRate,
      sequenceCompletionRatio: null,
    };
    return this.adapt(signal, context) as TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // adaptBatch
  // ─────────────────────────────────────────────────────────────────────────

  public adaptBatch(
    signals: readonly TickSequenceChatSignalCompat[],
    context: TickSequenceSignalAdapterContext = {},
  ): readonly (TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection | TickSequenceSignalAdapterDeduped)[] {
    return signals.map(s => this.adapt(s, context));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // state / report / reset
  // ─────────────────────────────────────────────────────────────────────────

  public state(): TickSequenceSignalAdapterState {
    return Object.freeze({
      accepted: this._accepted,
      rejected: this._rejected,
      deduped: this._deduped,
      errorSignals: this._errorSignals,
      slowStepSignals: this._slowStepSignals,
      anomalySignals: this._anomalySignals,
      healthDegradations: this._healthDegradations,
      healthRecoveries: this._healthRecoveries,
      lastAcceptedAt: this._lastAcceptedAt,
      lastHealthGrade: this._lastHealthGrade,
    });
  }

  public report(): TickSequenceSignalAdapterReport {
    return Object.freeze({
      state: this.state(),
      recentHistory: Object.freeze([...this._history]),
      recentRejections: Object.freeze([...this._rejections]),
      recentDeduped: Object.freeze([...this._deduped_list]),
      domainId: 'TICK_SEQUENCE',
      generatedAt: this._opts.clock.now(),
    });
  }

  public reset(): void {
    this._accepted = 0;
    this._rejected = 0;
    this._deduped = 0;
    this._errorSignals = 0;
    this._slowStepSignals = 0;
    this._anomalySignals = 0;
    this._healthDegradations = 0;
    this._healthRecoveries = 0;
    this._lastAcceptedAt = null;
    this._lastHealthGrade = null;
    this._history.length = 0;
    this._rejections.length = 0;
    this._deduped_list.length = 0;
    this._dedupeCache.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TickSequenceSignalRateController
// ─────────────────────────────────────────────────────────────────────────────

export interface TickSequenceRateBucket {
  readonly kind: string;
  readonly count: number;
  readonly limit: number;
  readonly resetsAtMs: number;
}

export class TickSequenceSignalRateController {
  private readonly _buckets = new Map<string, { count: number; resetsAtMs: number }>();
  private readonly _windowMs: number;
  private readonly _limits: Readonly<Record<string, number>>;

  public constructor(
    windowMs = 10_000,
    limits: Readonly<Record<string, number>> = {
      'sequence.step_errored': 10,
      'sequence.slow_step': 20,
      'sequence.health_degraded': 2,
      'sequence.health_recovered': 2,
      'sequence.ml_vector': 5,
      'sequence.anomaly': 15,
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

  public getBuckets(): readonly TickSequenceRateBucket[] {
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
// TickSequenceReplayBuffer
// ─────────────────────────────────────────────────────────────────────────────

export class TickSequenceReplayBuffer {
  private readonly _capacity: number;
  private readonly _buffer: TickSequenceSignalAdapterArtifact[] = [];

  public constructor(capacity = 32) {
    this._capacity = Math.max(1, capacity);
  }

  public push(artifact: TickSequenceSignalAdapterArtifact): void {
    this._buffer.push(artifact);
    if (this._buffer.length > this._capacity) this._buffer.shift();
  }

  public getAll(): readonly TickSequenceSignalAdapterArtifact[] {
    return Object.freeze([...this._buffer]);
  }

  public getByPhase(phase: string): readonly TickSequenceSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.phase === phase);
  }

  public getSlowSteps(): readonly TickSequenceSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isSlowStep);
  }

  public getErrors(): readonly TickSequenceSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isError);
  }

  public getAnomalies(): readonly TickSequenceSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isAnomaly);
  }

  public clear(): void {
    this._buffer.length = 0;
  }

  public get size(): number { return this._buffer.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// TickSequenceSignalAdapterSuite — composed suite
// ─────────────────────────────────────────────────────────────────────────────

export interface TickSequenceSignalSuiteOptions extends TickSequenceSignalAdapterOptions {
  readonly rateWindowMs?: number;
  readonly replayCapacity?: number;
}

export class TickSequenceSignalAdapterSuite {
  public readonly adapter: TickSequenceSignalAdapter;
  public readonly rateController: TickSequenceSignalRateController;
  public readonly replayBuffer: TickSequenceReplayBuffer;

  public constructor(options: TickSequenceSignalSuiteOptions) {
    this.adapter = new TickSequenceSignalAdapter(options);
    this.rateController = new TickSequenceSignalRateController(options.rateWindowMs);
    this.replayBuffer = new TickSequenceReplayBuffer(options.replayCapacity);
  }

  public process(
    signal: TickSequenceChatSignalCompat,
    context: TickSequenceSignalAdapterContext = {},
    nowMs = Date.now(),
  ): TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection | TickSequenceSignalAdapterDeduped {
    const eventName = mapEventName(signal.kind);
    if (!this.rateController.allow(eventName, nowMs)) {
      return {
        eventName,
        reason: 'Rate limit exceeded',
        details: { kind: signal.kind, tick: signal.tick, step: signal.step },
      } as TickSequenceSignalAdapterRejection;
    }
    const result = this.adapter.adapt(signal, context);
    if ('envelope' in result) this.replayBuffer.push(result);
    return result;
  }

  public processML(
    vector: TickSequenceMLVectorCompat,
    context: TickSequenceSignalAdapterContext = {},
  ): TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection {
    return this.adapter.adaptML(vector, context);
  }

  public processDL(
    tensor: TickSequenceDLTensorCompat,
    context: TickSequenceSignalAdapterContext = {},
  ): TickSequenceSignalAdapterArtifact | TickSequenceSignalAdapterRejection {
    return this.adapter.adaptDL(tensor, context);
  }

  public state(): TickSequenceSignalAdapterState { return this.adapter.state(); }
  public report(): TickSequenceSignalAdapterReport { return this.adapter.report(); }

  public reset(): void {
    this.adapter.reset();
    this.rateController.reset();
    this.replayBuffer.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory functions
// ─────────────────────────────────────────────────────────────────────────────

export function createTickSequenceSignalAdapter(
  options: TickSequenceSignalAdapterOptions,
): TickSequenceSignalAdapter {
  return new TickSequenceSignalAdapter(options);
}

export function createTickSequenceSignalAdapterSuite(
  options: TickSequenceSignalSuiteOptions,
): TickSequenceSignalAdapterSuite {
  return new TickSequenceSignalAdapterSuite(options);
}

export function isTickSequenceSignalAdapterArtifact(
  value: unknown,
): value is TickSequenceSignalAdapterArtifact {
  return (
    typeof value === 'object' &&
    value !== null &&
    'envelope' in value &&
    'step' in value &&
    'phase' in value &&
    'isSlowStep' in value
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Module constants
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_SEQUENCE_SIGNAL_ADAPTER_MODULE_VERSION = '2026.03.25' as const;
export const TICK_SEQUENCE_SIGNAL_ADAPTER_READY = true as const;

export const TICK_SEQUENCE_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  domain: 'TICK_SEQUENCE',
  className: 'TickSequenceSignalAdapter',
  relativePath: 'backend/src/game/engine/chat/adapters/TickSequenceSignalAdapter.ts',
  ownsTruth: false as const,
  description: 'Translates TickSequence engine truth into backend-chat sequence ingress.',
  moduleVersion: TICK_SEQUENCE_SIGNAL_ADAPTER_MODULE_VERSION,
});

// Utility re-exports for consumers that need the score helpers
export { clamp01, clamp100, asUnixMs };

// backend/src/game/engine/chat/adapters/OrchestratorTelemetrySignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/OrchestratorTelemetrySignalAdapter.ts
 *
 * Translates OrchestratorTelemetry signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * This prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Adapter modes:
 *   default  — standard signal with full telemetry summary
 *   strict   — suppresses NOMINAL severity, only emits ADVISORY/CRITICAL
 *   verbose  — includes ML vector and DL tensor in metadata
 *
 * Usage:
 *   import { ORCHESTRATOR_TELEMETRY_DEFAULT_ADAPTER } from './OrchestratorTelemetrySignalAdapter';
 *   const envelope = ORCHESTRATOR_TELEMETRY_DEFAULT_ADAPTER.translate(signal);
 *
 * Singletons:
 *   ORCHESTRATOR_TELEMETRY_DEFAULT_ADAPTER
 *   ORCHESTRATOR_TELEMETRY_STRICT_ADAPTER
 *   ORCHESTRATOR_TELEMETRY_VERBOSE_ADAPTER
 */

import {
  clamp01,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type JsonValue,
  type Nullable,
  type Score01,
  type UnixMs,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURAL COMPAT TYPES — mirrors zero/OrchestratorTelemetry without imports
// ─────────────────────────────────────────────────────────────────────────────

type TelemetrySeverityCompat = 'NOMINAL' | 'ADVISORY' | 'CRITICAL';
type TelemetryTrendDirectionCompat = 'IMPROVING' | 'STABLE' | 'DEGRADING';

/**
 * Structural compat shape for TelemetryChatSignal (from zero/).
 * Mirrors the interface without importing from zero/ directly.
 */
export interface TelemetryChatSignalCompat {
  readonly generatedAtMs: number;
  readonly severity: TelemetrySeverityCompat;
  readonly activeRunId: string | null;
  readonly tick: number | null;
  readonly totalTicksObserved: number;
  readonly totalSignalsObserved: number;
  readonly totalEventsObserved: number;
  readonly errorSignalRatio: number;
  readonly avgTickDurationMs: number;
  readonly warningCount: number;
  readonly engineHealthyRatio: number;
  readonly engineFailedCount: number;
  readonly stepCoverageRatio: number;
  readonly overallHealthScore: number;
  readonly trendDirection: TelemetryTrendDirectionCompat | null;
}

/**
 * Structural compat shape for TelemetryMLVector (32-dim).
 */
export interface TelemetryMLVectorCompat {
  readonly tickDensityScore: number;
  readonly signalDensityScore: number;
  readonly eventDensityScore: number;
  readonly traceDensityScore: number;
  readonly infoSignalRatio: number;
  readonly warnSignalRatio: number;
  readonly errorSignalRatio: number;
  readonly signalNoiseScore: number;
  readonly avgTickDurationNorm: number;
  readonly maxTickDurationNorm: number;
  readonly minTickDurationNorm: number;
  readonly warningDensityScore: number;
  readonly stepCoverageRatio: number;
  readonly engineHealthyRatio: number;
  readonly engineDegradedRatio: number;
  readonly engineFailedFlag: number;
  readonly hasActiveRun: number;
  readonly outcomeActiveScore: number;
  readonly outcomeCompleteScore: number;
  readonly checksumValidScore: number;
  readonly emittedEventDensity: number;
  readonly warningsPerTick: number;
  readonly stepErrorRate: number;
  readonly tickConsistencyScore: number;
  readonly recentTickWindowRatio: number;
  readonly traceAccumulationRate: number;
  readonly criticalSignalFlag: number;
  readonly dataFreshnessScore: number;
  readonly healthCompositeScore: number;
  readonly phaseStabilityScore: number;
  readonly warningEscalationScore: number;
  readonly overallHealthScore: number;
  readonly [key: string]: number;
}

/**
 * Structural compat for the full ML vector signal with array.
 */
export interface TelemetryMLVectorSignal {
  readonly mlVector: TelemetryMLVectorCompat;
  readonly mlVectorArray: readonly number[];
  readonly timestamp: number;
}

/**
 * Structural compat for TelemetryTrendSnapshot.
 */
export interface TelemetryTrendSignalCompat {
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly avgErrorRate: number;
  readonly maxErrorRate: number;
  readonly avgTickDurationMs: number;
  readonly p95TickDurationMs: number;
  readonly avgSignalDensity: number;
  readonly avgWarningDensity: number;
  readonly trendDirection: TelemetryTrendDirectionCompat;
  readonly nominalSamples: number;
  readonly advisorySamples: number;
  readonly criticalSamples: number;
  readonly peakWarnRate: number;
  readonly peakErrorRate: number;
}

/**
 * Structural compat for TelemetrySessionReport.
 */
export interface TelemetrySessionSignalCompat {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly totalTicksObserved: number;
  readonly totalSignalsObserved: number;
  readonly totalEventsObserved: number;
  readonly totalTraceRecordsObserved: number;
  readonly avgErrorRate: number;
  readonly peakErrorRate: number;
  readonly avgTickDurationMs: number;
  readonly peakTickDurationMs: number;
  readonly nominalFraction: number;
  readonly advisoryFraction: number;
  readonly criticalFraction: number;
  readonly runsSeen: readonly string[];
  readonly engineFailureEvents: number;
  readonly uniqueStepsCovered: number;
}

/**
 * Structural compat for TelemetryAnnotation.
 */
export interface TelemetryAnnotationCompat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly severity: TelemetrySeverityCompat;
  readonly uxRelevant: boolean;
  readonly featureIndex: number;
}

/**
 * Structural compat for TelemetryAnnotationBundle.
 */
export interface TelemetryAnnotationBundleCompat {
  readonly capturedAtMs: number;
  readonly annotations: readonly TelemetryAnnotationCompat[];
  readonly criticalCount: number;
  readonly advisoryCount: number;
  readonly nominalCount: number;
  readonly topAnnotation: TelemetryAnnotationCompat | null;
}

/**
 * Structural compat for DL tensor (8×4).
 */
export type TelemetryDLTensorCompat = readonly (readonly [number, number, number, number])[];

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER MODE
// ─────────────────────────────────────────────────────────────────────────────

export type OrchestratorTelemetryAdapterMode = 'default' | 'strict' | 'verbose';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function buildTelemetryEnvelope(
  signal: TelemetryChatSignalCompat,
  additionalMeta: Record<string, JsonValue> = {},
  roomId: Nullable<ChatRoomId> = null,
): ChatInputEnvelope {
  const ts = nowMs();

  const meta: Record<string, JsonValue> = {
    severity: signal.severity,
    activeRunId: signal.activeRunId ?? null,
    tick: signal.tick ?? null,
    totalTicksObserved: signal.totalTicksObserved,
    totalSignalsObserved: signal.totalSignalsObserved,
    totalEventsObserved: signal.totalEventsObserved,
    errorSignalRatio: signal.errorSignalRatio,
    avgTickDurationMs: signal.avgTickDurationMs,
    warningCount: signal.warningCount,
    engineHealthyRatio: signal.engineHealthyRatio,
    engineFailedCount: signal.engineFailedCount,
    stepCoverageRatio: signal.stepCoverageRatio,
    overallHealthScore: signal.overallHealthScore,
    trendDirection: signal.trendDirection ?? null,
    ...additionalMeta,
  };

  const chatSignal: ChatSignalEnvelope = {
    type: 'LIVEOPS',
    emittedAt: ts,
    roomId,
    liveops: {
      worldEventName: `telemetry:${signal.severity}:tick${signal.tick ?? 0}` as Nullable<string>,
      heatMultiplier01: clamp01(signal.errorSignalRatio + signal.warningCount / 100) as Score01,
      helperBlackout: signal.severity === 'CRITICAL' && signal.engineFailedCount > 0,
      haterRaidActive: signal.engineFailedCount > 0,
    },
    metadata: meta,
  };

  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: ts,
    payload: chatSignal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorTelemetrySignalAdapter
 *
 * Translates TelemetryChatSignal and related surfaces into chat lane envelopes.
 * All methods are pure: no state is mutated; no side effects.
 */
export class OrchestratorTelemetrySignalAdapter {
  private readonly _mode: OrchestratorTelemetryAdapterMode;

  private readonly _roomId: Nullable<ChatRoomId>;

  public constructor(
    mode: OrchestratorTelemetryAdapterMode = 'default',
    roomId: Nullable<ChatRoomId> = null,
  ) {
    this._mode = mode;
    this._roomId = roomId;
  }

  /**
   * Translate a TelemetryChatSignal into a LIVEOPS_SIGNAL envelope.
   * In strict mode, returns null for NOMINAL severity (caller should discard).
   */
  public translate(
    signal: TelemetryChatSignalCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    return buildTelemetryEnvelope(signal, {}, this._roomId);
  }

  /**
   * Translate a telemetry signal with its 32-dim ML vector.
   * ML vector is embedded in envelope metadata.
   */
  public translateMLVector(
    signal: TelemetryChatSignalCompat,
    mlVectorSignal: TelemetryMLVectorSignal,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    const mlMeta: Record<string, JsonValue> = {
      mlVector: mlVectorSignal.mlVector as unknown as JsonValue,
      mlVectorArray: mlVectorSignal.mlVectorArray as unknown as JsonValue,
      mlTimestamp: mlVectorSignal.timestamp,
    };
    return buildTelemetryEnvelope(signal, mlMeta, this._roomId);
  }

  /**
   * Translate a telemetry signal with its 8×4 DL tensor.
   * DL tensor rows are serialized as JSON strings in metadata.
   */
  public translateDLTensor(
    signal: TelemetryChatSignalCompat,
    dlTensor: TelemetryDLTensorCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    const tensorMeta: Record<string, JsonValue> = {
      dlTensorRows: dlTensor.map((row) => JSON.stringify(Array.from(row))) as unknown as JsonValue,
      dlTensorShape: [dlTensor.length, dlTensor[0]?.length ?? 0] as unknown as JsonValue,
    };
    return buildTelemetryEnvelope(signal, tensorMeta, this._roomId);
  }

  /**
   * Translate a trend snapshot into a chat signal envelope.
   * The base signal is required for envelope construction; trend data is
   * embedded as additional metadata.
   */
  public translateTrend(
    signal: TelemetryChatSignalCompat,
    trend: TelemetryTrendSignalCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL' && trend.avgErrorRate < 0.05) {
      return null;
    }
    const trendMeta: Record<string, JsonValue> = {
      trendCapturedAt: trend.capturedAtMs,
      trendSampleCount: trend.sampleCount,
      trendAvgErrorRate: trend.avgErrorRate,
      trendMaxErrorRate: trend.maxErrorRate,
      trendAvgTickDurationMs: trend.avgTickDurationMs,
      trendP95TickDurationMs: trend.p95TickDurationMs,
      trendAvgSignalDensity: trend.avgSignalDensity,
      trendAvgWarningDensity: trend.avgWarningDensity,
      trendDirection: trend.trendDirection,
      trendNominalFraction:
        trend.sampleCount > 0 ? trend.nominalSamples / trend.sampleCount : 0,
      trendAdvisoryFraction:
        trend.sampleCount > 0 ? trend.advisorySamples / trend.sampleCount : 0,
      trendCriticalFraction:
        trend.sampleCount > 0 ? trend.criticalSamples / trend.sampleCount : 0,
      trendPeakWarnRate: trend.peakWarnRate,
      trendPeakErrorRate: trend.peakErrorRate,
    };
    return buildTelemetryEnvelope(signal, trendMeta, this._roomId);
  }

  /**
   * Translate a session report into a chat signal envelope.
   */
  public translateSessionReport(
    signal: TelemetryChatSignalCompat,
    report: TelemetrySessionSignalCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    const sessionMeta: Record<string, JsonValue> = {
      sessionId: report.sessionId,
      sessionStartedAtMs: report.startedAtMs,
      sessionCapturedAtMs: report.capturedAtMs,
      sessionSampleCount: report.sampleCount,
      sessionTotalTicks: report.totalTicksObserved,
      sessionTotalSignals: report.totalSignalsObserved,
      sessionTotalEvents: report.totalEventsObserved,
      sessionTotalTraceRecords: report.totalTraceRecordsObserved,
      sessionAvgErrorRate: report.avgErrorRate,
      sessionPeakErrorRate: report.peakErrorRate,
      sessionAvgTickDurationMs: report.avgTickDurationMs,
      sessionPeakTickDurationMs: report.peakTickDurationMs,
      sessionNominalFraction: report.nominalFraction,
      sessionAdvisoryFraction: report.advisoryFraction,
      sessionCriticalFraction: report.criticalFraction,
      sessionEngineFailureEvents: report.engineFailureEvents,
      sessionRunCount: report.runsSeen.length,
      sessionUniqueStepsCovered: report.uniqueStepsCovered,
    };
    return buildTelemetryEnvelope(signal, sessionMeta, this._roomId);
  }

  /**
   * Translate a signal with its annotation bundle into a chat envelope.
   * Only UX-relevant annotations are included in the metadata.
   */
  public translateAnnotations(
    signal: TelemetryChatSignalCompat,
    bundle: TelemetryAnnotationBundleCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    const uxAnnotations = bundle.annotations.filter((a) => a.uxRelevant).slice(0, 5);
    const annotationMeta: Record<string, JsonValue> = {
      annotationCriticalCount: bundle.criticalCount,
      annotationAdvisoryCount: bundle.advisoryCount,
      annotationNominalCount: bundle.nominalCount,
      annotationTopLabel: bundle.topAnnotation?.label ?? null,
      annotationTopValue: bundle.topAnnotation?.value ?? null,
      annotationTopSeverity: bundle.topAnnotation?.severity ?? null,
      annotationUXItems: uxAnnotations.map((a) =>
        JSON.stringify({ key: a.key, label: a.label, value: a.value }),
      ) as unknown as JsonValue,
    };
    return buildTelemetryEnvelope(signal, annotationMeta, this._roomId);
  }

  /**
   * Translate with full verbose payload: ML vector + DL tensor + trend + session + annotations.
   * Only used in verbose mode; always emits regardless of severity.
   */
  public translateVerbose(
    signal: TelemetryChatSignalCompat,
    opts: {
      readonly mlVectorSignal?: TelemetryMLVectorSignal;
      readonly dlTensor?: TelemetryDLTensorCompat;
      readonly trend?: TelemetryTrendSignalCompat;
      readonly session?: TelemetrySessionSignalCompat;
      readonly annotations?: TelemetryAnnotationBundleCompat;
    } = {},
  ): ChatInputEnvelope {
    const verboseMeta: Record<string, JsonValue> = {};

    if (opts.mlVectorSignal) {
      verboseMeta['mlVector'] = opts.mlVectorSignal.mlVector as unknown as JsonValue;
      verboseMeta['mlVectorArray'] = opts.mlVectorSignal.mlVectorArray as unknown as JsonValue;
      verboseMeta['mlTimestamp'] = opts.mlVectorSignal.timestamp;
    }

    if (opts.dlTensor) {
      verboseMeta['dlTensorRows'] = opts.dlTensor.map((row) =>
        JSON.stringify(Array.from(row)),
      ) as unknown as JsonValue;
      verboseMeta['dlTensorShape'] = [opts.dlTensor.length, 4] as unknown as JsonValue;
    }

    if (opts.trend) {
      verboseMeta['trendDirection'] = opts.trend.trendDirection;
      verboseMeta['trendAvgErrorRate'] = opts.trend.avgErrorRate;
      verboseMeta['trendAvgTickDurationMs'] = opts.trend.avgTickDurationMs;
      verboseMeta['trendSampleCount'] = opts.trend.sampleCount;
    }

    if (opts.session) {
      verboseMeta['sessionId'] = opts.session.sessionId;
      verboseMeta['sessionSampleCount'] = opts.session.sampleCount;
      verboseMeta['sessionAvgErrorRate'] = opts.session.avgErrorRate;
      verboseMeta['sessionEngineFailureEvents'] = opts.session.engineFailureEvents;
    }

    if (opts.annotations) {
      verboseMeta['annotationCriticalCount'] = opts.annotations.criticalCount;
      verboseMeta['annotationTopLabel'] = opts.annotations.topAnnotation?.label ?? null;
    }

    return buildTelemetryEnvelope(signal, verboseMeta, this._roomId);
  }

  public get mode(): OrchestratorTelemetryAdapterMode {
    return this._mode;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS
// ─────────────────────────────────────────────────────────────────────────────

/** Default adapter — emits all severities including NOMINAL. */
export const ORCHESTRATOR_TELEMETRY_DEFAULT_ADAPTER =
  new OrchestratorTelemetrySignalAdapter('default');

/**
 * Strict adapter — suppresses NOMINAL signals.
 * Use in production ops pipelines where NOMINAL is high-volume noise.
 */
export const ORCHESTRATOR_TELEMETRY_STRICT_ADAPTER =
  new OrchestratorTelemetrySignalAdapter('strict');

/**
 * Verbose adapter — same emission rules as default, but callers should
 * prefer translateVerbose/translateMLVector for full ML/DL payloads.
 */
export const ORCHESTRATOR_TELEMETRY_VERBOSE_ADAPTER =
  new OrchestratorTelemetrySignalAdapter('verbose');

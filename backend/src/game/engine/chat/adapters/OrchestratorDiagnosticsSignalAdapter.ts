// backend/src/game/engine/chat/adapters/OrchestratorDiagnosticsSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/OrchestratorDiagnosticsSignalAdapter.ts
 *
 * Translates OrchestratorDiagnostics signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * This prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Adapter modes:
 *   default  — standard signal with full health summary
 *   strict   — suppresses NOMINAL severity, only emits DEGRADED/CRITICAL
 *   verbose  — includes ML vector and telemetry in metadata
 *
 * Usage:
 *   import { ORCHESTRATOR_DIAGNOSTICS_DEFAULT_ADAPTER } from './OrchestratorDiagnosticsSignalAdapter';
 *   const envelope = ORCHESTRATOR_DIAGNOSTICS_DEFAULT_ADAPTER.translate(signal);
 *
 * Singletons:
 *   ORCHESTRATOR_DIAGNOSTICS_DEFAULT_ADAPTER
 *   ORCHESTRATOR_DIAGNOSTICS_STRICT_ADAPTER
 *   ORCHESTRATOR_DIAGNOSTICS_VERBOSE_ADAPTER
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
// STRUCTURAL COMPAT TYPES — mirrors zero/OrchestratorDiagnostics without imports
// ─────────────────────────────────────────────────────────────────────────────

type DiagnosticsSeverity = 'NOMINAL' | 'DEGRADED' | 'CRITICAL';

interface DiagnosticsEngineHealthSummary {
  readonly total: number;
  readonly healthy: number;
  readonly degraded: number;
  readonly failed: number;
}

interface DiagnosticsMLVectorCompat {
  readonly pressureScore: number;
  readonly pressureTierRank: number;
  readonly tensionScore: number;
  readonly sovereigntyScore: number;
  readonly cordScore: number;
  readonly cashNormalized: number;
  readonly errorRateNormalized: number;
  readonly engineHealthRatio: number;
  readonly failedEngineFlag: number;
  readonly activeRunFlag: number;
  readonly integrityOKFlag: number;
  readonly verifiedGradeScore: number;
  readonly avgTickDurationNormalized: number;
  readonly historyFullnessRatio: number;
  readonly [key: string]: number;
}

/**
 * Structural compat shape for DiagnosticsChatSignal (from zero/).
 * Mirrors the interface without importing from zero/ directly.
 */
export interface DiagnosticsSignalCompat {
  readonly generatedAtMs: number;
  readonly severity: DiagnosticsSeverity;
  readonly activeRunId: string | null;
  readonly tick: number;
  readonly pressureTier: string | null;
  readonly pressureScore: number;
  readonly tensionScore: number;
  readonly sovereigntyScore: number;
  readonly cordScore: number;
  readonly verifiedGrade: string | null;
  readonly engineHealthSummary: DiagnosticsEngineHealthSummary;
  readonly errorRate: number;
  readonly avgTickDurationMs: number;
  readonly totalTicksRecorded: number;
  readonly totalErrorsRecorded: number;
  readonly openTraceCount: number;
  readonly recentCheckpointId: string | null;
  readonly integrityStatus: string | null;
  readonly proofHashPresent: boolean;
  readonly avgEventsPerTick: number;
  readonly pressureBand: string | null;
}

/**
 * Structural compat for DiagnosticsMLVector (32-dim).
 */
export interface DiagnosticsMLVectorSignal {
  readonly mlVector: DiagnosticsMLVectorCompat;
  readonly mlVectorArray: readonly number[];
  readonly timestamp: number;
}

/**
 * Structural compat for DiagnosticsTrendSnapshot.
 */
export interface DiagnosticsTrendSignal {
  readonly capturedAt: number;
  readonly sampleCount: number;
  readonly avgErrorRate: number;
  readonly maxErrorRate: number;
  readonly avgTickDurationMs: number;
  readonly p95TickDurationMs: number;
  readonly avgPressureScore: number;
  readonly trend: string;
  readonly nominalSamples: number;
  readonly degradedSamples: number;
  readonly criticalSamples: number;
}

/**
 * Structural compat for DiagnosticsSessionReport.
 */
export interface DiagnosticsSessionSignal {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly totalTicksObserved: number;
  readonly totalErrorsObserved: number;
  readonly avgErrorRate: number;
  readonly peakErrorRate: number;
  readonly avgTickDurationMs: number;
  readonly nominalFraction: number;
  readonly degradedFraction: number;
  readonly criticalFraction: number;
  readonly runsSeen: readonly string[];
  readonly engineFailureEvents: number;
}

/**
 * Structural compat for DiagnosticsTelemetryRecord.
 */
export interface DiagnosticsTelemetrySignal {
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

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER MODE
// ─────────────────────────────────────────────────────────────────────────────

export type OrchestratorDiagnosticsAdapterMode = 'default' | 'strict' | 'verbose';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER
// ─────────────────────────────────────────────────────────────────────────────

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function buildDiagnosticsEnvelope(
  signal: DiagnosticsSignalCompat,
  additionalMeta: Record<string, JsonValue> = {},
  roomId: Nullable<ChatRoomId> = null,
): ChatInputEnvelope {
  const ts = nowMs();
  const health = signal.engineHealthSummary;

  const meta: Record<string, JsonValue> = {
    severity: signal.severity,
    activeRunId: signal.activeRunId ?? null,
    tick: signal.tick,
    pressureTier: signal.pressureTier ?? null,
    pressureScore: signal.pressureScore,
    tensionScore: signal.tensionScore,
    sovereigntyScore: signal.sovereigntyScore,
    cordScore: signal.cordScore,
    verifiedGrade: signal.verifiedGrade ?? null,
    errorRate: signal.errorRate,
    avgTickDurationMs: signal.avgTickDurationMs,
    totalTicksRecorded: signal.totalTicksRecorded,
    totalErrorsRecorded: signal.totalErrorsRecorded,
    openTraceCount: signal.openTraceCount,
    recentCheckpointId: signal.recentCheckpointId ?? null,
    integrityStatus: signal.integrityStatus ?? null,
    proofHashPresent: signal.proofHashPresent,
    avgEventsPerTick: signal.avgEventsPerTick,
    pressureBand: signal.pressureBand ?? null,
    engineHealth: {
      total: health.total,
      healthy: health.healthy,
      degraded: health.degraded,
      failed: health.failed,
    } as unknown as JsonValue,
    ...additionalMeta,
  };

  const chatSignal: ChatSignalEnvelope = {
    type: 'LIVEOPS',
    emittedAt: ts,
    roomId,
    liveops: {
      worldEventName: `diagnostics:${signal.severity}:tick${signal.tick}` as Nullable<string>,
      heatMultiplier01: clamp01(signal.pressureScore) as Score01,
      helperBlackout: signal.integrityStatus === 'QUARANTINED',
      haterRaidActive: signal.engineHealthSummary.failed > 0,
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
 * OrchestratorDiagnosticsSignalAdapter
 *
 * Translates DiagnosticsChatSignal and related surfaces into chat lane envelopes.
 * All methods are pure: no state is mutated; no side effects.
 */
export class OrchestratorDiagnosticsSignalAdapter {
  private readonly _mode: OrchestratorDiagnosticsAdapterMode;

  private readonly _roomId: Nullable<ChatRoomId>;

  public constructor(
    mode: OrchestratorDiagnosticsAdapterMode = 'default',
    roomId: Nullable<ChatRoomId> = null,
  ) {
    this._mode = mode;
    this._roomId = roomId;
  }

  /**
   * Translate a DiagnosticsChatSignal into a LIVEOPS_SIGNAL envelope.
   * In strict mode, returns null for NOMINAL severity (caller should discard).
   */
  public translate(
    signal: DiagnosticsSignalCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    return buildDiagnosticsEnvelope(signal, {}, this._roomId);
  }

  /**
   * Translate a diagnostics signal with its 32-dim ML vector.
   * ML vector is embedded in envelope metadata.
   */
  public translateMLVector(
    signal: DiagnosticsSignalCompat,
    mlVectorSignal: DiagnosticsMLVectorSignal,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    const mlMeta: Record<string, JsonValue> = {
      mlVector: mlVectorSignal.mlVector as unknown as JsonValue,
      mlVectorArray: mlVectorSignal.mlVectorArray as unknown as JsonValue,
      mlTimestamp: mlVectorSignal.timestamp,
    };
    return buildDiagnosticsEnvelope(signal, mlMeta, this._roomId);
  }

  /**
   * Translate a diagnostics signal with its DL tensor.
   * DL tensor rows are serialized as JSON strings in metadata.
   */
  public translateDLTensor(
    signal: DiagnosticsSignalCompat,
    dlTensor: ReadonlyArray<ReadonlyArray<number>>,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    const tensorMeta: Record<string, JsonValue> = {
      dlTensorRows: dlTensor.map((row) => JSON.stringify(Array.from(row))) as unknown as JsonValue,
      dlTensorShape: [dlTensor.length, dlTensor[0]?.length ?? 0] as unknown as JsonValue,
    };
    return buildDiagnosticsEnvelope(signal, tensorMeta, this._roomId);
  }

  /**
   * Translate a lightweight telemetry record for ops-board ingestion.
   */
  public translateTelemetry(
    telemetry: DiagnosticsTelemetrySignal,
  ): ChatInputEnvelope {
    const ts = nowMs();
    const meta: Record<string, JsonValue> = {
      severity: telemetry.severity,
      errorRate: telemetry.errorRate,
      avgTickMs: telemetry.avgTickMs,
      sovereigntyScore: telemetry.sovereigntyScore,
      pressureScore: telemetry.pressureScore,
      tensionScore: telemetry.tensionScore,
      healthyEngines: telemetry.healthyEngines,
      totalEngines: telemetry.totalEngines,
      ticksRecorded: telemetry.ticksRecorded,
      errorsRecorded: telemetry.errorsRecorded,
      runId: telemetry.runId ?? null,
      tick: telemetry.tick,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: this._roomId,
      liveops: {
        worldEventName: `telemetry:${telemetry.severity}` as Nullable<string>,
        heatMultiplier01: clamp01(telemetry.pressureScore) as Score01,
        helperBlackout: false,
        haterRaidActive: telemetry.errorsRecorded > 0,
      },
      metadata: meta,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload: chatSignal,
    };
  }

  /**
   * Translate a trend snapshot into a chat signal envelope.
   */
  public translateTrend(
    signal: DiagnosticsSignalCompat,
    trend: DiagnosticsTrendSignal,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL' && trend.avgErrorRate < 0.05) {
      return null;
    }
    const trendMeta: Record<string, JsonValue> = {
      trendCapturedAt: trend.capturedAt,
      trendSampleCount: trend.sampleCount,
      trendAvgErrorRate: trend.avgErrorRate,
      trendMaxErrorRate: trend.maxErrorRate,
      trendAvgTickDurationMs: trend.avgTickDurationMs,
      trendP95TickDurationMs: trend.p95TickDurationMs,
      trendAvgPressureScore: trend.avgPressureScore,
      trendDirection: trend.trend,
      trendNominalFraction: trend.sampleCount > 0 ? trend.nominalSamples / trend.sampleCount : 0,
      trendDegradedFraction: trend.sampleCount > 0 ? trend.degradedSamples / trend.sampleCount : 0,
      trendCriticalFraction: trend.sampleCount > 0 ? trend.criticalSamples / trend.sampleCount : 0,
    };
    return buildDiagnosticsEnvelope(signal, trendMeta, this._roomId);
  }

  /**
   * Translate a session report into a chat signal envelope.
   */
  public translateSessionReport(
    signal: DiagnosticsSignalCompat,
    report: DiagnosticsSessionSignal,
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
      sessionTotalErrors: report.totalErrorsObserved,
      sessionAvgErrorRate: report.avgErrorRate,
      sessionPeakErrorRate: report.peakErrorRate,
      sessionAvgTickDurationMs: report.avgTickDurationMs,
      sessionNominalFraction: report.nominalFraction,
      sessionDegradedFraction: report.degradedFraction,
      sessionCriticalFraction: report.criticalFraction,
      sessionEngineFailureEvents: report.engineFailureEvents,
      sessionRunCount: report.runsSeen.length,
    };
    return buildDiagnosticsEnvelope(signal, sessionMeta, this._roomId);
  }

  public get mode(): OrchestratorDiagnosticsAdapterMode {
    return this._mode;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS
// ─────────────────────────────────────────────────────────────────────────────

/** Default adapter — emits all severities including NOMINAL. */
export const ORCHESTRATOR_DIAGNOSTICS_DEFAULT_ADAPTER =
  new OrchestratorDiagnosticsSignalAdapter('default');

/**
 * Strict adapter — suppresses NOMINAL signals.
 * Use in production ops pipelines where NOMINAL is high-volume noise.
 */
export const ORCHESTRATOR_DIAGNOSTICS_STRICT_ADAPTER =
  new OrchestratorDiagnosticsSignalAdapter('strict');

/**
 * Verbose adapter — same emission rules as default, but callers should
 * prefer translateMLVector/translateDLTensor for full ML payloads.
 */
export const ORCHESTRATOR_DIAGNOSTICS_VERBOSE_ADAPTER =
  new OrchestratorDiagnosticsSignalAdapter('verbose');

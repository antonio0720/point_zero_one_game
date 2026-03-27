// backend/src/game/engine/chat/adapters/OrchestratorHealthSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/OrchestratorHealthSignalAdapter.ts
 *
 * Translates OrchestratorHealthReport signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * This prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Adapter modes:
 *   default  — standard signal with full health summary
 *   strict   — suppresses NOMINAL severity, only emits DEGRADED/CRITICAL
 *   verbose  — includes ML vector and DL tensor in metadata
 *
 * Usage:
 *   import { ORCHESTRATOR_HEALTH_DEFAULT_ADAPTER } from './OrchestratorHealthSignalAdapter';
 *   const envelope = ORCHESTRATOR_HEALTH_DEFAULT_ADAPTER.translate(signal);
 *
 * Singletons:
 *   ORCHESTRATOR_HEALTH_DEFAULT_ADAPTER
 *   ORCHESTRATOR_HEALTH_STRICT_ADAPTER
 *   ORCHESTRATOR_HEALTH_VERBOSE_ADAPTER
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
// STRUCTURAL COMPAT TYPES — mirrors zero/OrchestratorHealthReport without imports
// ─────────────────────────────────────────────────────────────────────────────

/** Structural compat for OrchestratorReadiness. */
type HealthReadiness = 'READY' | 'DEGRADED' | 'FAILED' | 'IDLE';

/** Structural compat for OrchestratorHealthChatSeverity. */
type HealthChatSeverity = 'NOMINAL' | 'DEGRADED' | 'CRITICAL';

/**
 * Structural compat shape for OrchestratorHealthChatSignal (from zero/).
 * Mirrors the interface without importing from zero/ directly.
 */
export interface HealthSignalCompat {
  readonly generatedAtMs: number;
  readonly severity: HealthChatSeverity;
  readonly readiness: HealthReadiness;
  readonly activeRunId: string | null;
  readonly tick: number | null;
  readonly score: number;
  readonly totalEngines: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly openTraceCount: number;
  readonly warningCount: number;
  readonly checkpointCount: number;
  readonly integrityStatus: string | null;
  readonly proofHashPresent: boolean;
  readonly failedEngineIds: readonly string[];
  readonly degradedEngineIds: readonly string[];
  readonly notes: readonly string[];
}

/**
 * Structural compat for OrchestratorHealthTelemetryRecord.
 */
export interface HealthTelemetryCompat {
  readonly ts: number;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly readiness: HealthReadiness;
  readonly severity: HealthChatSeverity;
  readonly score: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly openTraceCount: number;
  readonly warningCount: number;
}

/**
 * Structural compat for OrchestratorHealthMLVector (32-dim).
 */
export interface HealthMLVectorCompat {
  readonly readinessEncoded: number;
  readonly scoreNormalized: number;
  readonly healthyRatio: number;
  readonly degradedRatio: number;
  readonly failedRatio: number;
  readonly hasActiveRun: number;
  readonly tickNormalized: number;
  readonly integrityOk: number;
  readonly integrityQuarantined: number;
  readonly proofHashPresent: number;
  readonly openTraceCountNormalized: number;
  readonly warningCountNormalized: number;
  readonly queuedEventWarningsNormalized: number;
  readonly checkpointCountNormalized: number;
  readonly hasFailedEngines: number;
  readonly hasDegradedEngines: number;
  readonly phaseEncoded: number;
  readonly outcomePresent: number;
  readonly isWinOutcome: number;
  readonly isLossOutcome: number;
  readonly totalEnginesNormalized: number;
  readonly timeEngineHealthy: number;
  readonly pressureEngineHealthy: number;
  readonly tensionEngineHealthy: number;
  readonly shieldEngineHealthy: number;
  readonly battleEngineHealthy: number;
  readonly cascadeEngineHealthy: number;
  readonly sovereigntyEngineHealthy: number;
  readonly consecutiveFailuresNormalized: number;
  readonly avgEngineStatusScore: number;
  readonly traceSessionDepth: number;
  readonly checkpointDensityNormalized: number;
  readonly mlVectorArray: readonly number[];
  readonly [key: string]: number | readonly number[];
}

/**
 * Structural compat for OrchestratorHealthTrendSnapshot.
 */
export interface HealthTrendCompat {
  readonly capturedAt: number;
  readonly sampleCount: number;
  readonly windowMs: number;
  readonly avgScore: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly avgFailedCount: number;
  readonly maxFailedCount: number;
  readonly avgDegradedCount: number;
  readonly avgOpenTraceCount: number;
  readonly avgWarningCount: number;
  readonly readyFraction: number;
  readonly degradedFraction: number;
  readonly failedFraction: number;
  readonly idleFraction: number;
  readonly trend: string;
  readonly nominalSamples: number;
  readonly degradedSamples: number;
  readonly criticalSamples: number;
}

/**
 * Structural compat for OrchestratorHealthSessionReport.
 */
export interface HealthSessionCompat {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly sampleCount: number;
  readonly avgScore: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly totalFailedOccurrences: number;
  readonly totalDegradedOccurrences: number;
  readonly peakFailedCount: number;
  readonly peakDegradedCount: number;
  readonly peakOpenTraceCount: number;
  readonly peakWarningCount: number;
  readonly nominalFraction: number;
  readonly degradedFraction: number;
  readonly criticalFraction: number;
  readonly runsSeen: readonly string[];
  readonly engineFailureEvents: number;
}

/**
 * Structural compat for OrchestratorHealthDLTensor (7×8).
 */
export interface HealthDLTensorCompat {
  readonly rows: readonly {
    readonly engineId: string;
    readonly rowIndex: number;
    readonly features: readonly number[];
  }[];
  readonly shape: readonly [number, number];
  readonly engineOrder: readonly string[];
  readonly featureNames: readonly string[];
  readonly capturedAtMs: number;
}

/**
 * Structural compat for OrchestratorHealthAnnotationBundle.
 */
export interface HealthAnnotationCompat {
  readonly capturedAtMs: number;
  readonly readiness: HealthReadiness;
  readonly companionHeadline: string;
  readonly operatorSummary: string;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER MODE
// ─────────────────────────────────────────────────────────────────────────────

export type OrchestratorHealthAdapterMode = 'default' | 'strict' | 'verbose';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

/** Map health readiness to a heatMultiplier01 value for the chat lane. */
function readinessToHeat(readiness: HealthReadiness, score: number): Score01 {
  // Failing system = maximum heat; idle = zero heat; score drives the middle
  if (readiness === 'FAILED') return 1.0 as Score01;
  if (readiness === 'IDLE') return 0.0 as Score01;
  // Invert score: low score = high heat
  return clamp01(1 - score / 100) as Score01;
}

function buildHealthEnvelope(
  signal: HealthSignalCompat,
  additionalMeta: Record<string, JsonValue> = {},
  roomId: Nullable<ChatRoomId> = null,
): ChatInputEnvelope {
  const ts = nowMs();

  const meta: Record<string, JsonValue> = {
    severity: signal.severity,
    readiness: signal.readiness,
    activeRunId: signal.activeRunId ?? null,
    tick: signal.tick ?? null,
    score: signal.score,
    totalEngines: signal.totalEngines,
    healthyCount: signal.healthyCount,
    degradedCount: signal.degradedCount,
    failedCount: signal.failedCount,
    openTraceCount: signal.openTraceCount,
    warningCount: signal.warningCount,
    checkpointCount: signal.checkpointCount,
    integrityStatus: signal.integrityStatus ?? null,
    proofHashPresent: signal.proofHashPresent,
    failedEngineIds: signal.failedEngineIds as unknown as JsonValue,
    degradedEngineIds: signal.degradedEngineIds as unknown as JsonValue,
    notes: signal.notes as unknown as JsonValue,
    ...additionalMeta,
  };

  const chatSignal: ChatSignalEnvelope = {
    type: 'LIVEOPS',
    emittedAt: ts,
    roomId,
    liveops: {
      worldEventName: `health:${signal.severity}:${signal.readiness}` as Nullable<string>,
      heatMultiplier01: readinessToHeat(signal.readiness, signal.score),
      helperBlackout: signal.integrityStatus === 'QUARANTINED',
      haterRaidActive: signal.failedCount > 0,
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
 * OrchestratorHealthSignalAdapter
 *
 * Translates OrchestratorHealthChatSignal and related surfaces into chat lane
 * LIVEOPS_SIGNAL envelopes. All methods are pure: no state is mutated; no side effects.
 */
export class OrchestratorHealthSignalAdapter {
  private readonly _mode: OrchestratorHealthAdapterMode;
  private readonly _roomId: Nullable<ChatRoomId>;

  public constructor(
    mode: OrchestratorHealthAdapterMode = 'default',
    roomId: Nullable<ChatRoomId> = null,
  ) {
    this._mode = mode;
    this._roomId = roomId;
  }

  /**
   * Translate an OrchestratorHealthChatSignal into a LIVEOPS_SIGNAL envelope.
   * In strict mode, returns null for NOMINAL severity (caller should discard).
   */
  public translate(signal: HealthSignalCompat): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    return buildHealthEnvelope(signal, {}, this._roomId);
  }

  /**
   * Translate a health signal with its 32-dim ML vector.
   * ML vector is embedded in envelope metadata.
   */
  public translateMLVector(
    signal: HealthSignalCompat,
    mlVector: HealthMLVectorCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    const mlMeta: Record<string, JsonValue> = {
      mlVector: {
        readinessEncoded: mlVector.readinessEncoded,
        scoreNormalized: mlVector.scoreNormalized,
        healthyRatio: mlVector.healthyRatio,
        degradedRatio: mlVector.degradedRatio,
        failedRatio: mlVector.failedRatio,
        hasActiveRun: mlVector.hasActiveRun,
        avgEngineStatusScore: mlVector.avgEngineStatusScore,
        hasFailedEngines: mlVector.hasFailedEngines,
        hasDegradedEngines: mlVector.hasDegradedEngines,
        integrityOk: mlVector.integrityOk,
        proofHashPresent: mlVector.proofHashPresent,
      } as unknown as JsonValue,
      mlVectorArray: mlVector.mlVectorArray as unknown as JsonValue,
    };
    return buildHealthEnvelope(signal, mlMeta, this._roomId);
  }

  /**
   * Translate a health signal with its 7×8 DL tensor.
   * Tensor is serialized as row arrays in metadata.
   */
  public translateDLTensor(
    signal: HealthSignalCompat,
    tensor: HealthDLTensorCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    const tensorMeta: Record<string, JsonValue> = {
      dlTensorShape: tensor.shape as unknown as JsonValue,
      dlTensorEngineOrder: tensor.engineOrder as unknown as JsonValue,
      dlTensorFeatureNames: tensor.featureNames as unknown as JsonValue,
      dlTensorRows: tensor.rows.map((row) => ({
        engineId: row.engineId,
        features: JSON.stringify(Array.from(row.features)),
      })) as unknown as JsonValue,
    };
    return buildHealthEnvelope(signal, tensorMeta, this._roomId);
  }

  /**
   * Translate a lightweight telemetry record for ops-board ingestion.
   * Always emits (not gated by strict mode — telemetry is always wanted).
   */
  public translateTelemetry(telemetry: HealthTelemetryCompat): ChatInputEnvelope {
    const ts = nowMs();
    const meta: Record<string, JsonValue> = {
      severity: telemetry.severity,
      readiness: telemetry.readiness,
      score: telemetry.score,
      healthyCount: telemetry.healthyCount,
      degradedCount: telemetry.degradedCount,
      failedCount: telemetry.failedCount,
      openTraceCount: telemetry.openTraceCount,
      warningCount: telemetry.warningCount,
      runId: telemetry.runId ?? null,
      tick: telemetry.tick ?? null,
    };

    const chatSignal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: ts,
      roomId: this._roomId,
      liveops: {
        worldEventName: `health:telemetry:${telemetry.severity}` as Nullable<string>,
        heatMultiplier01: readinessToHeat(telemetry.readiness, telemetry.score),
        helperBlackout: false,
        haterRaidActive: telemetry.failedCount > 0,
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
   * Translate a health trend snapshot into a chat signal envelope.
   * In strict mode, suppresses if trend is STABLE with no failures.
   */
  public translateTrend(
    signal: HealthSignalCompat,
    trend: HealthTrendCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL' && trend.avgFailedCount < 0.1) {
      return null;
    }
    const trendMeta: Record<string, JsonValue> = {
      trendCapturedAt: trend.capturedAt,
      trendSampleCount: trend.sampleCount,
      trendWindowMs: trend.windowMs,
      trendAvgScore: trend.avgScore,
      trendMinScore: trend.minScore,
      trendMaxScore: trend.maxScore,
      trendAvgFailedCount: trend.avgFailedCount,
      trendMaxFailedCount: trend.maxFailedCount,
      trendAvgDegradedCount: trend.avgDegradedCount,
      trendDirection: trend.trend,
      trendReadyFraction: trend.readyFraction,
      trendDegradedFraction: trend.degradedFraction,
      trendFailedFraction: trend.failedFraction,
      trendNominalSamples: trend.nominalSamples,
      trendCriticalSamples: trend.criticalSamples,
    };
    return buildHealthEnvelope(signal, trendMeta, this._roomId);
  }

  /**
   * Translate a session report into a chat signal envelope.
   * In strict mode, suppresses if severity is NOMINAL.
   */
  public translateSessionReport(
    signal: HealthSignalCompat,
    session: HealthSessionCompat,
  ): ChatInputEnvelope | null {
    if (this._mode === 'strict' && signal.severity === 'NOMINAL') {
      return null;
    }
    const sessionMeta: Record<string, JsonValue> = {
      sessionId: session.sessionId,
      sessionStartedAtMs: session.startedAtMs,
      sessionCapturedAtMs: session.capturedAtMs,
      sessionSampleCount: session.sampleCount,
      sessionAvgScore: session.avgScore,
      sessionMinScore: session.minScore,
      sessionMaxScore: session.maxScore,
      sessionTotalFailedOccurrences: session.totalFailedOccurrences,
      sessionTotalDegradedOccurrences: session.totalDegradedOccurrences,
      sessionPeakFailedCount: session.peakFailedCount,
      sessionPeakDegradedCount: session.peakDegradedCount,
      sessionNominalFraction: session.nominalFraction,
      sessionDegradedFraction: session.degradedFraction,
      sessionCriticalFraction: session.criticalFraction,
      sessionEngineFailureEvents: session.engineFailureEvents,
      sessionRunCount: session.runsSeen.length,
    };
    return buildHealthEnvelope(signal, sessionMeta, this._roomId);
  }

  /**
   * Translate an annotation bundle into a chat signal envelope.
   * Only emits if there are HIGH or CRITICAL annotations (severity is not filtered by mode).
   */
  public translateAnnotations(
    signal: HealthSignalCompat,
    annotations: HealthAnnotationCompat,
  ): ChatInputEnvelope | null {
    // Annotations are only worth routing when there's something notable
    if (annotations.criticalCount === 0 && annotations.highCount === 0) {
      if (this._mode === 'strict') return null;
    }
    const annotationMeta: Record<string, JsonValue> = {
      companionHeadline: annotations.companionHeadline,
      operatorSummary: annotations.operatorSummary,
      criticalAnnotations: annotations.criticalCount,
      highAnnotations: annotations.highCount,
      mediumAnnotations: annotations.mediumCount,
      lowAnnotations: annotations.lowCount,
    };
    return buildHealthEnvelope(signal, annotationMeta, this._roomId);
  }

  public get mode(): OrchestratorHealthAdapterMode {
    return this._mode;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS
// ─────────────────────────────────────────────────────────────────────────────

/** Default adapter — emits all severities including NOMINAL. */
export const ORCHESTRATOR_HEALTH_DEFAULT_ADAPTER =
  new OrchestratorHealthSignalAdapter('default');

/**
 * Strict adapter — suppresses NOMINAL signals.
 * Use in production ops pipelines where NOMINAL is high-volume noise.
 */
export const ORCHESTRATOR_HEALTH_STRICT_ADAPTER =
  new OrchestratorHealthSignalAdapter('strict');

/**
 * Verbose adapter — same emission rules as default, but callers should
 * prefer translateMLVector/translateDLTensor for full ML payloads.
 */
export const ORCHESTRATOR_HEALTH_VERBOSE_ADAPTER =
  new OrchestratorHealthSignalAdapter('verbose');

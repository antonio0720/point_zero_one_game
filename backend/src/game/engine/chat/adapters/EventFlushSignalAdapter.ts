/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT EVENT FLUSH SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/EventFlushSignalAdapter.ts
 * VERSION: 2026.03.27
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates Engine 0 EventFlushCoordinator
 * signals — flush results, ML anomaly vectors, DL tensors, trend snapshots,
 * recovery forecasts, session reports, telemetry, and annotation bundles —
 * into authoritative backend-chat ingress envelopes on the LIVEOPS lane.
 *
 * Backend-truth question
 * ----------------------
 *   "When Engine 0 drains the EventBus at STEP_13_FLUSH, what exact
 *    chat-native signal should the authoritative backend chat engine ingest
 *    to keep companion commentary, liveops dashboards, and proof surfaces
 *    fully synchronized with flush-tick reality?"
 *
 * Design laws
 * -----------
 * - No circular imports from zero/. All EventFlushCoordinator types are
 *   mirrored as structural compat interfaces below.
 * - FLUSH_HOT signals always emit — high-volume ticks are critical UX events.
 * - FLUSH_ANOMALY signals always emit — anomaly detection is safety-critical.
 * - FLUSH_NORMAL signals emit when anomaly score is below threshold (default).
 * - FLUSH_COLD signals are suppressed by default unless cold streak is long.
 * - FLUSH_RECOVERY signals always emit — recovery is a positive UX moment.
 * - ML_ANOMALY signals emit when anomalyScore >= configured threshold.
 * - DL_TENSOR signals emit when tensor l2 norm >= configured threshold.
 * - TELEMETRY signals emit at configurable cadence (default: every 10 flushes).
 * - TREND signals emit only on direction changes (STABLE→ACCELERATING, etc.).
 * - FORECAST signals emit when recommendedAction changes.
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
// Structural compat interfaces — mirrors EventFlushCoordinator domain types
// WITHOUT importing them to avoid circular dependency chains.
//
// These are kept intentionally minimal. They capture only what the chat
// adapter needs to build a ChatInputEnvelope without importing the source.
// ─────────────────────────────────────────────────────────────────────────────

// ── Game mode / pressure ────────────────────────────────────────────────────

export type ModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';
export type PressureTierCompat = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
export type RunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

// ── Flush signal kind ────────────────────────────────────────────────────────

export type FlushSignalKindCompat =
  | 'FLUSH_NORMAL'
  | 'FLUSH_HOT'
  | 'FLUSH_COLD'
  | 'FLUSH_ANOMALY'
  | 'FLUSH_RECOVERY';

// ── Flush chat signal (structural compat) ────────────────────────────────────

export interface FlushChatSignalCompat {
  readonly kind: FlushSignalKindCompat;
  readonly sessionId: string;
  readonly tick: number;
  readonly flushIndex: number;
  readonly drainedCount: number;
  readonly stateChecksum: string;
  readonly anomalyScore: number;
  readonly narrativeLine: string;
  readonly pressureTier: PressureTierCompat;
  readonly phase: RunPhaseCompat;
  readonly mode: ModeCodeCompat;
  readonly merkleRoot?: string;
  readonly emittedAtMs: number;
}

// ── ML vector (structural compat) ───────────────────────────────────────────

export interface FlushMLVectorCompat {
  readonly sessionId: string;
  readonly tick: number;
  readonly flushIndex: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly anomalyScore: number;
  readonly hotFlush: boolean;
  readonly coldFlush: boolean;
  readonly extractedAtMs: number;
}

// ── DL tensor (structural compat) ───────────────────────────────────────────

export interface FlushDLTensorCompat {
  readonly sessionId: string;
  readonly tick: number;
  readonly rows: number;
  readonly cols: number;
  readonly tensor: readonly (readonly number[])[];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly l2Norm: number;
  readonly builtAtMs: number;
}

// ── Telemetry snapshot (structural compat) ──────────────────────────────────

export interface FlushTelemetrySnapshotCompat {
  readonly sessionId: string;
  readonly tick: number;
  readonly flushIndex: number;
  readonly drainedCount: number;
  readonly uniqueEventTypes: number;
  readonly taggedEventRatio: number;
  readonly stateChecksum: string;
  readonly tickSeal: string;
  readonly sovereignty_tickChecksumCount: number;
  readonly emittedEventCount: number;
  readonly merkleRootAtFlush?: string;
  readonly serialized: string;
}

// ── Trend snapshot (structural compat) ─────────────────────────────────────

export type FlushTrendDirectionCompat =
  | 'STABLE'
  | 'ACCELERATING'
  | 'DECELERATING'
  | 'VOLATILE'
  | 'RECOVERING';

export interface FlushTrendSnapshotCompat {
  readonly direction: FlushTrendDirectionCompat;
  readonly drainedCountSlope: number;
  readonly anomalyScoreSlope: number;
  readonly windowSize: number;
  readonly stdDevDrained: number;
  readonly maxDrainedInWindow: number;
  readonly minDrainedInWindow: number;
  readonly consecutiveColdFlushes: number;
  readonly consecutiveHotFlushes: number;
  readonly trendConfidence: number;
}

// ── Recovery forecast (structural compat) ──────────────────────────────────

export type FlushRecoveryActionCompat =
  | 'MAINTAIN'
  | 'REDUCE_FLUSH_FREQUENCY'
  | 'INCREASE_FLUSH_FREQUENCY'
  | 'INVESTIGATE_HOT_SOURCES'
  | 'WAIT_FOR_RECOVERY'
  | 'ALERT_OPERATOR';

export interface FlushRecoveryForecastCompat {
  readonly recommendedAction: FlushRecoveryActionCompat;
  readonly confidence: number;
  readonly estimatedRecoveryTicks: number;
  readonly riskScore: number;
  readonly notes: readonly string[];
}

// ── Session report (structural compat) ─────────────────────────────────────

export interface FlushSessionReportCompat {
  readonly sessionId: string;
  readonly totalFlushes: number;
  readonly totalDrained: number;
  readonly hotFlushCount: number;
  readonly coldFlushCount: number;
  readonly normalFlushCount: number;
  readonly anomalyFlushCount: number;
  readonly avgDrainedPerFlush: number;
  readonly peakDrainedSingleFlush: number;
  readonly sessionDurationMs: number;
  readonly uniqueEventTypesLifetime: number;
  readonly merkleRootFinal?: string;
  readonly generatedAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface EventFlushSignalAdapterConfig {
  /**
   * Suppress FLUSH_NORMAL signals (emit only notable signals).
   * Default: false (all signals emitted).
   */
  readonly suppressNormal?: boolean;

  /**
   * Suppress FLUSH_COLD signals with consecutive cold count below threshold.
   * Default: true.
   */
  readonly suppressColdBelowStreak?: number;

  /**
   * Minimum anomaly score to emit a FLUSH_ANOMALY signal.
   * Anomaly signals are always emitted when anomalyScore >= this value.
   * Default: 0.6.
   */
  readonly anomalyEmitThreshold?: number;

  /**
   * Minimum DL tensor l2 norm to emit a DL_TENSOR chat signal.
   * Default: 0.5.
   */
  readonly dlNormEmitThreshold?: number;

  /**
   * Emit telemetry signals every N flushes.
   * 0 = disabled.
   * Default: 10.
   */
  readonly telemetryCadenceFlushes?: number;

  /**
   * Emit trend signals only on direction change.
   * Default: true.
   */
  readonly trendOnDirectionChangeOnly?: boolean;

  /**
   * Chat room ID for LIVEOPS signals.
   */
  readonly roomId?: ChatRoomId;

  /**
   * Visible channel for flush signals.
   * Default: 'SYSTEM'.
   */
  readonly channel?: ChatVisibleChannel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat signal payload types
// ─────────────────────────────────────────────────────────────────────────────

export type EventFlushChatSignalKind =
  | 'FLUSH_NORMAL'
  | 'FLUSH_HOT'
  | 'FLUSH_COLD'
  | 'FLUSH_ANOMALY'
  | 'FLUSH_RECOVERY'
  | 'FLUSH_ML_ANOMALY'
  | 'FLUSH_DL_TENSOR'
  | 'FLUSH_TELEMETRY'
  | 'FLUSH_TREND'
  | 'FLUSH_FORECAST'
  | 'FLUSH_SESSION_REPORT';

export interface EventFlushChatPayload {
  readonly signalKind: EventFlushChatSignalKind;
  readonly sessionId: string;
  readonly tick: number;
  readonly flushIndex: number;
  readonly drainedCount: number;
  readonly anomalyScore: Score01;
  readonly stateChecksum: string;
  readonly tickSealShort: string;
  readonly narrativeLine: string;
  readonly pressureTier: PressureTierCompat;
  readonly phase: RunPhaseCompat;
  readonly mode: ModeCodeCompat;
  readonly hotFlush: boolean;
  readonly coldFlush: boolean;
  readonly merkleRoot?: string;
  readonly trendDirection?: FlushTrendDirectionCompat;
  readonly forecastAction?: FlushRecoveryActionCompat;
  readonly forecastRiskScore?: Score01;
  readonly mlFeatureCount?: number;
  readonly mlAnomaly?: Score01;
  readonly dlL2Norm?: Score100;
  readonly telemetryUniqueEventTypes?: number;
  readonly telemetryTaggedRatio?: Score01;
  readonly sessionTotalFlushes?: number;
  readonly sessionTotalDrained?: number;
  readonly sessionHotFlushCount?: number;
  readonly sessionColdFlushCount?: number;
  readonly sessionPeakDrained?: number;
  readonly metadata: Record<string, JsonValue>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Translation result
// ─────────────────────────────────────────────────────────────────────────────

export interface EventFlushTranslationResult {
  readonly envelope: ChatInputEnvelope | null;
  readonly suppressed: boolean;
  readonly suppressReason?: string;
  readonly signalKind: EventFlushChatSignalKind;
  readonly anomalyScore: number;
  readonly translatedAtMs: UnixMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function nowMs(): UnixMs {
  return asUnixMs(Date.now());
}

function buildEnvelope(
  payload: EventFlushChatPayload,
  roomId: Nullable<ChatRoomId>,
): ChatInputEnvelope {
  const ts = nowMs();
  // Pack the full payload into metadata — ChatLiveOpsSnapshot has a fixed schema.
  const meta: Record<string, JsonValue> = {
    signalKind: payload.signalKind,
    sessionId: payload.sessionId,
    tick: payload.tick,
    flushIndex: payload.flushIndex,
    drainedCount: payload.drainedCount,
    anomalyScore: payload.anomalyScore,
    stateChecksum: payload.stateChecksum,
    narrativeLine: payload.narrativeLine,
    pressureTier: payload.pressureTier,
    phase: payload.phase,
    mode: payload.mode,
    hotFlush: payload.hotFlush,
    coldFlush: payload.coldFlush,
    ...(payload.trendDirection !== undefined
      ? { trendDirection: payload.trendDirection }
      : {}),
    ...(payload.forecastAction !== undefined
      ? { forecastAction: payload.forecastAction, forecastRiskScore: payload.forecastRiskScore ?? 0 }
      : {}),
    ...(payload.mlAnomaly !== undefined
      ? { mlAnomaly: payload.mlAnomaly, mlFeatureCount: payload.mlFeatureCount ?? 0 }
      : {}),
    ...(payload.dlL2Norm !== undefined
      ? { dlL2Norm: payload.dlL2Norm }
      : {}),
    ...(payload.telemetryUniqueEventTypes !== undefined
      ? {
          telemetryUniqueEventTypes: payload.telemetryUniqueEventTypes,
          telemetryTaggedRatio: payload.telemetryTaggedRatio ?? 0,
        }
      : {}),
    ...(payload.sessionTotalFlushes !== undefined
      ? {
          sessionTotalFlushes: payload.sessionTotalFlushes,
          sessionTotalDrained: payload.sessionTotalDrained ?? 0,
          sessionHotFlushCount: payload.sessionHotFlushCount ?? 0,
          sessionColdFlushCount: payload.sessionColdFlushCount ?? 0,
          sessionPeakDrained: payload.sessionPeakDrained ?? 0,
        }
      : {}),
    ...payload.metadata,
  };

  const signal: ChatSignalEnvelope = {
    type: 'LIVEOPS',
    emittedAt: ts,
    roomId,
    liveops: {
      worldEventName: payload.narrativeLine as Nullable<string>,
      heatMultiplier01: payload.anomalyScore as Score01,
      helperBlackout: false,
      haterRaidActive: payload.hotFlush,
    },
    metadata: meta,
  };
  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: ts,
    payload: signal,
  };
}

function scoreToScore01(v: number): Score01 {
  return clamp01(v) as Score01;
}

function scoreToScore100(v: number): Score100 {
  return clamp100(v * 100) as Score100;
}

function resolveSignalKindFromFlush(
  signal: FlushChatSignalCompat,
): EventFlushChatSignalKind {
  switch (signal.kind) {
    case 'FLUSH_HOT':      return 'FLUSH_HOT';
    case 'FLUSH_COLD':     return 'FLUSH_COLD';
    case 'FLUSH_ANOMALY':  return 'FLUSH_ANOMALY';
    case 'FLUSH_RECOVERY': return 'FLUSH_RECOVERY';
    default:               return 'FLUSH_NORMAL';
  }
}

function isUnsuppressibleKind(kind: FlushSignalKindCompat): boolean {
  return (
    kind === 'FLUSH_HOT' ||
    kind === 'FLUSH_ANOMALY' ||
    kind === 'FLUSH_RECOVERY'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventFlushSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EventFlushSignalAdapter — translates Engine 0 flush signals into backend
 * chat ingress envelopes on the LIVEOPS lane.
 *
 * Design:
 * - Receives FlushChatSignal (structural compat) from EventFlushCoordinator
 * - Applies suppression policy
 * - Wraps signals into ChatInputEnvelope with LIVEOPS_SIGNAL kind
 * - Provides separate translation paths for ML, DL, telemetry, trend,
 *   forecast, and session report surfaces
 * - Tracks translation history and suppression counts
 */
export class EventFlushSignalAdapter {
  private readonly _config: Required<EventFlushSignalAdapterConfig>;
  private _translationCount = 0;
  private _suppressionCount = 0;
  private _lastTrendDirection: FlushTrendDirectionCompat | null = null;
  private _lastForecastAction: FlushRecoveryActionCompat | null = null;
  private _flushIndexSinceLastTelemetry = 0;

  public constructor(config: EventFlushSignalAdapterConfig = {}) {
    this._config = {
      suppressNormal: config.suppressNormal ?? false,
      suppressColdBelowStreak: config.suppressColdBelowStreak ?? 3,
      anomalyEmitThreshold: config.anomalyEmitThreshold ?? 0.6,
      dlNormEmitThreshold: config.dlNormEmitThreshold ?? 0.5,
      telemetryCadenceFlushes: config.telemetryCadenceFlushes ?? 10,
      trendOnDirectionChangeOnly: config.trendOnDirectionChangeOnly ?? true,
      roomId: config.roomId ?? (null as unknown as ChatRoomId),
      channel: config.channel ?? ('SYSTEM' as ChatVisibleChannel),
    };
  }

  // ── Primary translation: FlushChatSignal → ChatInputEnvelope ─────────────

  /**
   * Translate a FlushChatSignal into a ChatInputEnvelope.
   *
   * Suppression rules:
   * - FLUSH_HOT, FLUSH_ANOMALY, FLUSH_RECOVERY are never suppressed.
   * - FLUSH_COLD is suppressed unless consecutive cold streak >= threshold.
   * - FLUSH_NORMAL is suppressed if suppressNormal is configured.
   */
  public translate(
    signal: FlushChatSignalCompat,
    consecutiveColdFlushes = 0,
  ): EventFlushTranslationResult {
    this._translationCount += 1;
    const signalKind = resolveSignalKindFromFlush(signal);

    // Suppression: normal
    if (signal.kind === 'FLUSH_NORMAL' && this._config.suppressNormal) {
      this._suppressionCount += 1;
      return {
        envelope: null,
        suppressed: true,
        suppressReason: 'suppressNormal=true',
        signalKind: 'FLUSH_NORMAL',
        anomalyScore: signal.anomalyScore,
        translatedAtMs: nowMs(),
      };
    }

    // Suppression: cold with short streak
    if (
      signal.kind === 'FLUSH_COLD' &&
      !isUnsuppressibleKind(signal.kind) &&
      consecutiveColdFlushes < this._config.suppressColdBelowStreak
    ) {
      this._suppressionCount += 1;
      return {
        envelope: null,
        suppressed: true,
        suppressReason: `coldStreak=${consecutiveColdFlushes} < threshold=${this._config.suppressColdBelowStreak}`,
        signalKind: 'FLUSH_COLD',
        anomalyScore: signal.anomalyScore,
        translatedAtMs: nowMs(),
      };
    }

    const payload = this._buildPayload(signal, signalKind);
    const envelope = buildEnvelope(payload, this._config.roomId as Nullable<ChatRoomId>);

    return {
      envelope,
      suppressed: false,
      signalKind,
      anomalyScore: signal.anomalyScore,
      translatedAtMs: nowMs(),
    };
  }

  // ── ML vector translation ────────────────────────────────────────────────

  /**
   * Translate a FlushMLVector into a ChatInputEnvelope when anomaly score
   * meets or exceeds the configured emit threshold.
   *
   * Always emits if anomalyScore >= anomalyEmitThreshold.
   */
  public translateMLVector(
    signal: FlushChatSignalCompat,
    mlVector: FlushMLVectorCompat,
  ): EventFlushTranslationResult {
    this._translationCount += 1;

    if (mlVector.anomalyScore < this._config.anomalyEmitThreshold) {
      this._suppressionCount += 1;
      return {
        envelope: null,
        suppressed: true,
        suppressReason: `mlAnomaly=${mlVector.anomalyScore.toFixed(3)} < threshold=${this._config.anomalyEmitThreshold}`,
        signalKind: 'FLUSH_ML_ANOMALY',
        anomalyScore: mlVector.anomalyScore,
        translatedAtMs: nowMs(),
      };
    }

    const payload: EventFlushChatPayload = {
      ...this._buildPayload(signal, 'FLUSH_ML_ANOMALY'),
      mlFeatureCount: mlVector.features.length,
      mlAnomaly: scoreToScore01(mlVector.anomalyScore),
    };

    const envelope = buildEnvelope(payload, this._config.roomId as Nullable<ChatRoomId>);
    return {
      envelope,
      suppressed: false,
      signalKind: 'FLUSH_ML_ANOMALY',
      anomalyScore: mlVector.anomalyScore,
      translatedAtMs: nowMs(),
    };
  }

  // ── DL tensor translation ────────────────────────────────────────────────

  /**
   * Translate a FlushDLTensor into a ChatInputEnvelope when the tensor's
   * l2 norm meets or exceeds the configured threshold.
   */
  public translateDLTensor(
    signal: FlushChatSignalCompat,
    dlTensor: FlushDLTensorCompat,
  ): EventFlushTranslationResult {
    this._translationCount += 1;

    if (dlTensor.l2Norm < this._config.dlNormEmitThreshold) {
      this._suppressionCount += 1;
      return {
        envelope: null,
        suppressed: true,
        suppressReason: `dlL2Norm=${dlTensor.l2Norm.toFixed(3)} < threshold=${this._config.dlNormEmitThreshold}`,
        signalKind: 'FLUSH_DL_TENSOR',
        anomalyScore: signal.anomalyScore,
        translatedAtMs: nowMs(),
      };
    }

    const payload: EventFlushChatPayload = {
      ...this._buildPayload(signal, 'FLUSH_DL_TENSOR'),
      dlL2Norm: scoreToScore100(dlTensor.l2Norm),
    };

    const envelope = buildEnvelope(payload, this._config.roomId as Nullable<ChatRoomId>);
    return {
      envelope,
      suppressed: false,
      signalKind: 'FLUSH_DL_TENSOR',
      anomalyScore: signal.anomalyScore,
      translatedAtMs: nowMs(),
    };
  }

  // ── Telemetry translation ───────────────────────────────────────────────

  /**
   * Translate a FlushTelemetrySnapshot into a ChatInputEnvelope.
   * Subject to configured cadence (emit every N flushes).
   */
  public translateTelemetry(
    signal: FlushChatSignalCompat,
    telemetry: FlushTelemetrySnapshotCompat,
  ): EventFlushTranslationResult {
    this._translationCount += 1;
    this._flushIndexSinceLastTelemetry += 1;

    const cadence = this._config.telemetryCadenceFlushes;
    if (cadence === 0 || this._flushIndexSinceLastTelemetry < cadence) {
      this._suppressionCount += 1;
      return {
        envelope: null,
        suppressed: true,
        suppressReason: `telemetryCadence=${cadence} not met (at ${this._flushIndexSinceLastTelemetry})`,
        signalKind: 'FLUSH_TELEMETRY',
        anomalyScore: signal.anomalyScore,
        translatedAtMs: nowMs(),
      };
    }

    this._flushIndexSinceLastTelemetry = 0;

    const payload: EventFlushChatPayload = {
      ...this._buildPayload(signal, 'FLUSH_TELEMETRY'),
      telemetryUniqueEventTypes: telemetry.uniqueEventTypes,
      telemetryTaggedRatio: scoreToScore01(telemetry.taggedEventRatio),
    };

    const envelope = buildEnvelope(payload, this._config.roomId as Nullable<ChatRoomId>);
    return {
      envelope,
      suppressed: false,
      signalKind: 'FLUSH_TELEMETRY',
      anomalyScore: signal.anomalyScore,
      translatedAtMs: nowMs(),
    };
  }

  // ── Trend translation ────────────────────────────────────────────────────

  /**
   * Translate a FlushTrendSnapshot into a ChatInputEnvelope.
   * By default, only emits when trend direction changes.
   */
  public translateTrend(
    signal: FlushChatSignalCompat,
    trend: FlushTrendSnapshotCompat,
  ): EventFlushTranslationResult {
    this._translationCount += 1;

    if (
      this._config.trendOnDirectionChangeOnly &&
      trend.direction === this._lastTrendDirection
    ) {
      this._suppressionCount += 1;
      return {
        envelope: null,
        suppressed: true,
        suppressReason: `trendDirection=${trend.direction} unchanged`,
        signalKind: 'FLUSH_TREND',
        anomalyScore: signal.anomalyScore,
        translatedAtMs: nowMs(),
      };
    }

    this._lastTrendDirection = trend.direction;

    const payload: EventFlushChatPayload = {
      ...this._buildPayload(signal, 'FLUSH_TREND'),
      trendDirection: trend.direction,
    };

    const envelope = buildEnvelope(payload, this._config.roomId as Nullable<ChatRoomId>);
    return {
      envelope,
      suppressed: false,
      signalKind: 'FLUSH_TREND',
      anomalyScore: signal.anomalyScore,
      translatedAtMs: nowMs(),
    };
  }

  // ── Forecast translation ─────────────────────────────────────────────────

  /**
   * Translate a FlushRecoveryForecast into a ChatInputEnvelope.
   * Only emits when recommendedAction changes.
   */
  public translateForecast(
    signal: FlushChatSignalCompat,
    forecast: FlushRecoveryForecastCompat,
  ): EventFlushTranslationResult {
    this._translationCount += 1;

    if (forecast.recommendedAction === this._lastForecastAction) {
      this._suppressionCount += 1;
      return {
        envelope: null,
        suppressed: true,
        suppressReason: `forecastAction=${forecast.recommendedAction} unchanged`,
        signalKind: 'FLUSH_FORECAST',
        anomalyScore: signal.anomalyScore,
        translatedAtMs: nowMs(),
      };
    }

    this._lastForecastAction = forecast.recommendedAction;

    const payload: EventFlushChatPayload = {
      ...this._buildPayload(signal, 'FLUSH_FORECAST'),
      forecastAction: forecast.recommendedAction,
      forecastRiskScore: scoreToScore01(forecast.riskScore),
    };

    const envelope = buildEnvelope(payload, this._config.roomId as Nullable<ChatRoomId>);
    return {
      envelope,
      suppressed: false,
      signalKind: 'FLUSH_FORECAST',
      anomalyScore: signal.anomalyScore,
      translatedAtMs: nowMs(),
    };
  }

  // ── Session report translation ──────────────────────────────────────────

  /**
   * Translate a FlushSessionReport into a ChatInputEnvelope.
   * Always emits — session reports are terminal diagnostic signals.
   */
  public translateSessionReport(
    signal: FlushChatSignalCompat,
    report: FlushSessionReportCompat,
  ): EventFlushTranslationResult {
    this._translationCount += 1;

    const payload: EventFlushChatPayload = {
      ...this._buildPayload(signal, 'FLUSH_SESSION_REPORT'),
      sessionTotalFlushes: report.totalFlushes,
      sessionTotalDrained: report.totalDrained,
      sessionHotFlushCount: report.hotFlushCount,
      sessionColdFlushCount: report.coldFlushCount,
      sessionPeakDrained: report.peakDrainedSingleFlush,
    };

    const envelope = buildEnvelope(payload, this._config.roomId as Nullable<ChatRoomId>);
    return {
      envelope,
      suppressed: false,
      signalKind: 'FLUSH_SESSION_REPORT',
      anomalyScore: signal.anomalyScore,
      translatedAtMs: nowMs(),
    };
  }

  // ── Batch translation ────────────────────────────────────────────────────

  /**
   * Translate a batch of FlushChatSignals.
   * Returns all non-null envelopes in arrival order.
   */
  public translateBatch(
    signals: readonly FlushChatSignalCompat[],
    consecutiveColdFlushes = 0,
  ): readonly ChatInputEnvelope[] {
    const envelopes: ChatInputEnvelope[] = [];
    for (const signal of signals) {
      const result = this.translate(signal, consecutiveColdFlushes);
      if (!result.suppressed && result.envelope !== null) {
        envelopes.push(result.envelope);
      }
    }
    return Object.freeze(envelopes);
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────

  /** Total translation calls (including suppressed). */
  public get translationCount(): number {
    return this._translationCount;
  }

  /** Total suppressed translation calls. */
  public get suppressionCount(): number {
    return this._suppressionCount;
  }

  /** Suppression ratio (0–1). */
  public get suppressionRatio(): number {
    if (this._translationCount === 0) return 0;
    return this._suppressionCount / this._translationCount;
  }

  /** Most recently observed trend direction. */
  public get lastTrendDirection(): FlushTrendDirectionCompat | null {
    return this._lastTrendDirection;
  }

  /** Most recently observed forecast action. */
  public get lastForecastAction(): FlushRecoveryActionCompat | null {
    return this._lastForecastAction;
  }

  /** Resolved adapter configuration. */
  public get resolvedConfig(): Readonly<Required<EventFlushSignalAdapterConfig>> {
    return this._config;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private _buildPayload(
    signal: FlushChatSignalCompat,
    signalKind: EventFlushChatSignalKind,
  ): EventFlushChatPayload {
    return {
      signalKind,
      sessionId: signal.sessionId,
      tick: signal.tick,
      flushIndex: signal.flushIndex,
      drainedCount: signal.drainedCount,
      anomalyScore: scoreToScore01(signal.anomalyScore),
      stateChecksum: signal.stateChecksum,
      tickSealShort: signal.stateChecksum.substring(0, 8),
      narrativeLine: signal.narrativeLine,
      pressureTier: signal.pressureTier,
      phase: signal.phase,
      mode: signal.mode,
      hotFlush: signal.drainedCount >= 50,
      coldFlush: signal.drainedCount < 1,
      merkleRoot: signal.merkleRoot,
      metadata: {
        adapterVersion: '2026.03.27',
        signalKind,
        sessionId: signal.sessionId,
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Well-known singleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical shared EventFlushSignalAdapter for the default Engine 0 chat lane.
 *
 * Suppresses FLUSH_NORMAL, suppresses FLUSH_COLD with short streak,
 * emits ML anomaly when score >= 0.6, emits DL when l2 norm >= 0.5,
 * emits telemetry every 10 flushes, emits trend on direction change only.
 */
export const EVENT_FLUSH_DEFAULT_ADAPTER = new EventFlushSignalAdapter({
  suppressNormal: false,
  suppressColdBelowStreak: 3,
  anomalyEmitThreshold: 0.6,
  dlNormEmitThreshold: 0.5,
  telemetryCadenceFlushes: 10,
  trendOnDirectionChangeOnly: true,
});

/**
 * Strict adapter — suppresses all but FLUSH_ANOMALY, FLUSH_HOT, FLUSH_RECOVERY.
 * Suitable for low-noise production chat environments.
 */
export const EVENT_FLUSH_STRICT_ADAPTER = new EventFlushSignalAdapter({
  suppressNormal: true,
  suppressColdBelowStreak: 10,
  anomalyEmitThreshold: 0.75,
  dlNormEmitThreshold: 1.0,
  telemetryCadenceFlushes: 50,
  trendOnDirectionChangeOnly: true,
});

/**
 * Verbose adapter — emits all flush signals without suppression.
 * Suitable for development, replay debugging, and liveops staging.
 */
export const EVENT_FLUSH_VERBOSE_ADAPTER = new EventFlushSignalAdapter({
  suppressNormal: false,
  suppressColdBelowStreak: 0,
  anomalyEmitThreshold: 0.0,
  dlNormEmitThreshold: 0.0,
  telemetryCadenceFlushes: 1,
  trendOnDirectionChangeOnly: false,
});

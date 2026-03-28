/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ZERO BINDING SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/ZeroBindingSignalAdapter.ts
 * VERSION: 2026.03.27
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates DependencyBinder orchestration
 * signals — binding completions, partial bindings, binding failures,
 * dry-run previews, rebind events, health degradations, telemetry snapshots,
 * and ML/DL anomaly vectors — into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When DependencyBinder completes a binding cycle, produces a partial bind,
 *    encounters a critical failure, or detects health degradation across the
 *    seven-engine dependency graph, what exact chat-native signal should the
 *    authoritative backend chat engine ingest to preserve orchestration
 *    wiring fidelity and make the chat layer feel alive to binding state?"
 *
 * Design laws
 * -----------
 * - No circular imports from zero/. All DependencyBinder types are mirrored
 *   as structural compat interfaces below.
 * - BINDING_COMPLETE signals always emit — they confirm orchestration readiness.
 * - BINDING_FAILED signals always emit — critical infrastructure state.
 * - BINDING_PARTIAL signals emit only when at least one group is still unbound.
 * - BINDING_REBIND signals emit when a complete session follows a prior session.
 * - BINDING_DRY_RUN signals emit from dry-run previews, never from live binds.
 * - Health degradation signals always emit at CRITICAL severity.
 * - ML vector signals emit only when anomaly score exceeds threshold (default 0.5).
 * - Telemetry signals emit at configurable cadence.
 * - Chat bridge emissions always emit — they are direct chat-layer requests.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatSignalType,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Structural compat interfaces — mirrors DependencyBinder domain types
// WITHOUT importing them to avoid circular dependency chains.
//
// These are kept intentionally minimal. They capture only what the chat adapter
// needs to build a ChatInputEnvelope without importing the source module.
// ─────────────────────────────────────────────────────────────────────────────

// ── Binding signal kind ───────────────────────────────────────────────────────

export type ZeroBindingSignalKind =
  | 'BINDING_COMPLETE'
  | 'BINDING_PARTIAL'
  | 'BINDING_FAILED'
  | 'BINDING_DRY_RUN'
  | 'BINDING_REBIND';

// ── Binding group ─────────────────────────────────────────────────────────────

export type ZeroBindingGroupCompat =
  | 'pressure-reader'
  | 'shield-reader'
  | 'tension-reader'
  | 'cascade-reader';

// ── ModeCode ─────────────────────────────────────────────────────────────────

export type ZeroBindingModeCode = 'solo' | 'pvp' | 'coop' | 'ghost';

// ── ML vector compat ──────────────────────────────────────────────────────────

export interface ZeroBindingMLVectorCompat {
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly sessionFingerprint: string;
  readonly extractedAt: string;
  readonly bindingComplete: boolean;
  readonly totalEdges: number;
  readonly boundEdges: number;
}

// ── Chat signal compat ────────────────────────────────────────────────────────

export interface ZeroBindingChatSignalCompat {
  readonly surface: 'dependency_binder';
  readonly kind: ZeroBindingSignalKind;
  readonly sessionFingerprint: string;
  readonly profileId: string;
  readonly mode: ZeroBindingModeCode | null;
  readonly bindingComplete: boolean;
  readonly boundGroups: readonly ZeroBindingGroupCompat[];
  readonly failedGroups: readonly ZeroBindingGroupCompat[];
  readonly criticalFailureCount: number;
  readonly validationErrorCount: number;
  readonly validationWarningCount: number;
  readonly mlVector: ZeroBindingMLVectorCompat;
  readonly notes: readonly string[];
  readonly emittedAt: string;
}

// ── Health report compat ──────────────────────────────────────────────────────

export interface ZeroBindingHealthReportCompat {
  readonly overallHealthy: boolean;
  readonly healthScore: number;
  readonly criticalIssues: readonly string[];
  readonly warningIssues: readonly string[];
  readonly recommendations: readonly string[];
  readonly groupHealth: Readonly<Record<ZeroBindingGroupCompat, boolean>>;
  readonly sessionFingerprint: string;
  readonly windowSize: number;
  readonly completeInWindow: number;
  readonly assessedAt: string;
}

// ── Telemetry snapshot compat ─────────────────────────────────────────────────

export interface ZeroBindingTelemetrySnapshotCompat {
  readonly sessionFingerprint: string;
  readonly profileId: string;
  readonly mode: ZeroBindingModeCode | null;
  readonly totalEdges: number;
  readonly boundEdges: number;
  readonly failedEdges: number;
  readonly partialEdges: number;
  readonly validationErrors: number;
  readonly validationWarnings: number;
  readonly bindingComplete: boolean;
  readonly mlVector: ZeroBindingMLVectorCompat;
  readonly chatSignal: ZeroBindingChatSignalCompat;
  readonly notes: readonly string[];
  readonly emittedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ZeroBindingAdapterConfig {
  /** Default chat room ID for binding signals. */
  readonly defaultRoomId: ChatRoomId;
  /** Channel to emit binding signals on. Defaults to 'system'. */
  readonly channel: ChatVisibleChannel;
  /** ML anomaly score threshold above which ML vectors are emitted. [0–1] */
  readonly mlAnomalyThreshold: Score01;
  /** Health score below which health degradation signals are emitted. [0–100] */
  readonly healthDegradationThreshold: Score100;
  /** Emit BINDING_COMPLETE signals. */
  readonly emitComplete: boolean;
  /** Emit BINDING_PARTIAL signals. */
  readonly emitPartial: boolean;
  /** Emit BINDING_FAILED signals. */
  readonly emitFailed: boolean;
  /** Emit BINDING_DRY_RUN signals. */
  readonly emitDryRun: boolean;
  /** Emit BINDING_REBIND signals. */
  readonly emitRebind: boolean;
  /** Emit health degradation signals when healthScore drops below threshold. */
  readonly emitHealthDegradation: boolean;
  /** Emit ML anomaly signals when binding quality score exceeds threshold. */
  readonly emitMLAnomalies: boolean;
  /** Emit telemetry signals on every binding cycle. */
  readonly emitTelemetry: boolean;
}

export const ZERO_BINDING_ADAPTER_DEFAULT_CONFIG: Readonly<ZeroBindingAdapterConfig> =
  Object.freeze({
    defaultRoomId: 'system' as ChatRoomId,
    channel: 'system' as ChatVisibleChannel,
    mlAnomalyThreshold: 0.5 as Score01,
    healthDegradationThreshold: 50 as Score100,
    emitComplete: true,
    emitPartial: true,
    emitFailed: true,
    emitDryRun: false,
    emitRebind: true,
    emitHealthDegradation: true,
    emitMLAnomalies: true,
    emitTelemetry: false,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Adapter output types
// ─────────────────────────────────────────────────────────────────────────────

export type ZeroBindingSignalSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface ZeroBindingSignalOutput {
  /** The translated chat ingress envelope ready for backend-chat ingest. */
  readonly envelope: ChatInputEnvelope;
  /** Discriminator for downstream routing. */
  readonly signalKind: ZeroBindingSignalKind | 'HEALTH_DEGRADATION' | 'ML_ANOMALY' | 'TELEMETRY';
  /** Severity of the translated signal. */
  readonly severity: ZeroBindingSignalSeverity;
  /** Fingerprint of the source binding session. */
  readonly sessionFingerprint: string;
  /** Whether the binding was complete at signal time. */
  readonly bindingComplete: boolean;
  /** ISO-8601 timestamp of signal construction. */
  readonly translatedAt: string;
}

export interface ZeroBindingAdapterResult {
  /** All signals produced by this adapter invocation. */
  readonly signals: readonly ZeroBindingSignalOutput[];
  /** The number of signals emitted. */
  readonly emittedCount: number;
  /** The number of signals suppressed by config policy. */
  readonly suppressedCount: number;
  /** Whether any critical signals were emitted. */
  readonly hasCriticalSignals: boolean;
  /** ISO-8601 timestamp of adapter run. */
  readonly processedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function now(): UnixMs {
  return asUnixMs(Date.now());
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveSeverity(
  kind: ZeroBindingSignalKind,
  bindingComplete: boolean,
  criticalFailureCount: number,
): ZeroBindingSignalSeverity {
  if (kind === 'BINDING_FAILED' || criticalFailureCount > 0) return 'CRITICAL';
  if (!bindingComplete) return 'WARN';
  if (kind === 'BINDING_REBIND') return 'INFO';
  if (kind === 'BINDING_DRY_RUN') return 'INFO';
  return 'INFO';
}

function resolveBindingAnomalyScore(mlVector: ZeroBindingMLVectorCompat): Score01 {
  // Anomaly score is the inverse of binding completeness fraction.
  // A fully bound session has an anomaly score of 0; a fully failed session has 1.
  const boundFrac =
    mlVector.totalEdges > 0
      ? mlVector.boundEdges / mlVector.totalEdges
      : 0;
  return clamp01(1 - boundFrac);
}

function buildBindingEnvelopePayload(
  signal: ZeroBindingChatSignalCompat,
  severity: ZeroBindingSignalSeverity,
  tag: string,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    surface: signal.surface as JsonValue,
    kind: signal.kind as JsonValue,
    tag,
    severity,
    sessionFingerprint: signal.sessionFingerprint as JsonValue,
    profileId: signal.profileId as JsonValue,
    mode: (signal.mode ?? null) as JsonValue,
    bindingComplete: signal.bindingComplete as JsonValue,
    boundGroups: [...signal.boundGroups] as JsonValue,
    failedGroups: [...signal.failedGroups] as JsonValue,
    criticalFailureCount: signal.criticalFailureCount as JsonValue,
    validationErrorCount: signal.validationErrorCount as JsonValue,
    validationWarningCount: signal.validationWarningCount as JsonValue,
    noteCount: signal.notes.length as JsonValue,
    emittedAt: signal.emittedAt as JsonValue,
    translatedAt: nowIso() as JsonValue,
    mlAnomalyScore: resolveBindingAnomalyScore(signal.mlVector) as JsonValue,
    mlBoundEdges: signal.mlVector.boundEdges as JsonValue,
    mlTotalEdges: signal.mlVector.totalEdges as JsonValue,
  });
}

function buildChatSignalEnvelope(
  roomId: ChatRoomId,
  _channel: ChatVisibleChannel,
  payload: Readonly<Record<string, JsonValue>>,
): ChatSignalEnvelope {
  return Object.freeze({
    type: 'LIVEOPS' as ChatSignalType,
    emittedAt: now(),
    roomId: roomId as Nullable<ChatRoomId>,
    liveops: {
      worldEventName: null,
      heatMultiplier01: clamp01(0.5),
      helperBlackout: false,
      haterRaidActive: false,
    },
    metadata: payload,
  });
}

function buildChatInputEnvelope(
  roomId: ChatRoomId,
  channel: ChatVisibleChannel,
  payload: Readonly<Record<string, JsonValue>>,
): ChatInputEnvelope {
  return Object.freeze({
    kind: 'LIVEOPS_SIGNAL' as const,
    emittedAt: now(),
    payload: buildChatSignalEnvelope(roomId, channel, payload),
  });
}

function buildSignalOutput(
  envelope: ChatInputEnvelope,
  signalKind: ZeroBindingSignalOutput['signalKind'],
  severity: ZeroBindingSignalSeverity,
  sessionFingerprint: string,
  bindingComplete: boolean,
): ZeroBindingSignalOutput {
  return Object.freeze({
    envelope,
    signalKind,
    severity,
    sessionFingerprint,
    bindingComplete,
    translatedAt: nowIso(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ZeroBindingSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical backend chat adapter for DependencyBinder orchestration signals.
 *
 * Translate a DependencyBindingChatSignal (or health/telemetry reports) into
 * one or more ChatInputEnvelopes that the backend chat engine ingests. The
 * adapter applies config-driven suppression policy so callers don't need to
 * filter signals themselves.
 *
 * @example
 * ```ts
 * const adapter = new ZeroBindingSignalAdapter();
 * const signal = buildDependencyBindingChatSignal(session);
 * const result = adapter.translate(signal);
 * for (const output of result.signals) {
 *   chatEngine.ingest(output.envelope);
 * }
 * ```
 */
export class ZeroBindingSignalAdapter {
  private readonly config: Readonly<ZeroBindingAdapterConfig>;
  private lastResult: ZeroBindingAdapterResult | null = null;

  public constructor(
    config: Partial<ZeroBindingAdapterConfig> = {},
  ) {
    this.config = Object.freeze({
      ...ZERO_BINDING_ADAPTER_DEFAULT_CONFIG,
      ...config,
    });
  }

  // ── Primary translation entry point ────────────────────────────────────────

  /**
   * Translates a ZeroBindingChatSignalCompat into a ZeroBindingAdapterResult.
   *
   * The result contains all signals that passed the config suppression policy.
   * Check result.hasCriticalSignals to decide whether to escalate.
   */
  public translate(
    signal: ZeroBindingChatSignalCompat,
  ): ZeroBindingAdapterResult {
    const outputs: ZeroBindingSignalOutput[] = [];
    let suppressedCount = 0;

    const shouldEmit = this.shouldEmitKind(signal.kind);
    if (shouldEmit) {
      const severity = resolveSeverity(
        signal.kind,
        signal.bindingComplete,
        signal.criticalFailureCount,
      );
      const payload = buildBindingEnvelopePayload(signal, severity, 'binding_signal');
      const envelope = buildChatInputEnvelope(
        this.config.defaultRoomId,
        this.config.channel,
        payload,
      );
      outputs.push(buildSignalOutput(
        envelope,
        signal.kind,
        severity,
        signal.sessionFingerprint,
        signal.bindingComplete,
      ));
    } else {
      suppressedCount += 1;
    }

    // ML anomaly emission
    if (this.config.emitMLAnomalies) {
      const anomalyScore = resolveBindingAnomalyScore(signal.mlVector);
      if (anomalyScore >= this.config.mlAnomalyThreshold) {
        const mlPayload: Readonly<Record<string, JsonValue>> = Object.freeze({
          surface: 'dependency_binder' as JsonValue,
          kind: 'ML_ANOMALY' as JsonValue,
          tag: 'ml_anomaly',
          sessionFingerprint: signal.sessionFingerprint as JsonValue,
          anomalyScore: anomalyScore as JsonValue,
          boundEdges: signal.mlVector.boundEdges as JsonValue,
          totalEdges: signal.mlVector.totalEdges as JsonValue,
          bindingComplete: signal.bindingComplete as JsonValue,
          threshold: this.config.mlAnomalyThreshold as JsonValue,
          emittedAt: signal.emittedAt as JsonValue,
          translatedAt: nowIso() as JsonValue,
        });
        const mlEnvelope = buildChatInputEnvelope(
          this.config.defaultRoomId,
          this.config.channel,
          mlPayload,
        );
        outputs.push(buildSignalOutput(
          mlEnvelope,
          'ML_ANOMALY',
          'WARN',
          signal.sessionFingerprint,
          signal.bindingComplete,
        ));
      }
    }

    const result = this.buildResult(outputs, suppressedCount);
    this.lastResult = result;
    return result;
  }

  // ── Health degradation translation ────────────────────────────────────────

  /**
   * Translates a ZeroBindingHealthReportCompat into a ChatInputEnvelope
   * when the health score drops below the configured degradation threshold.
   *
   * Returns null when the health score is above the threshold (no emission).
   */
  public translateHealthReport(
    report: ZeroBindingHealthReportCompat,
  ): ZeroBindingAdapterResult {
    const outputs: ZeroBindingSignalOutput[] = [];
    let suppressedCount = 0;

    if (
      this.config.emitHealthDegradation &&
      report.healthScore < this.config.healthDegradationThreshold
    ) {
      const payload: Readonly<Record<string, JsonValue>> = Object.freeze({
        surface: 'dependency_binder' as JsonValue,
        kind: 'HEALTH_DEGRADATION' as JsonValue,
        tag: 'health_degradation',
        sessionFingerprint: report.sessionFingerprint as JsonValue,
        overallHealthy: report.overallHealthy as JsonValue,
        healthScore: report.healthScore as JsonValue,
        threshold: this.config.healthDegradationThreshold as JsonValue,
        criticalIssueCount: report.criticalIssues.length as JsonValue,
        warningIssueCount: report.warningIssues.length as JsonValue,
        criticalIssues: [...report.criticalIssues] as JsonValue,
        recommendations: [...report.recommendations] as JsonValue,
        windowSize: report.windowSize as JsonValue,
        completeInWindow: report.completeInWindow as JsonValue,
        assessedAt: report.assessedAt as JsonValue,
        translatedAt: nowIso() as JsonValue,
      });
      const envelope = buildChatInputEnvelope(
        this.config.defaultRoomId,
        this.config.channel,
        payload,
      );
      outputs.push(buildSignalOutput(
        envelope,
        'HEALTH_DEGRADATION',
        'CRITICAL',
        report.sessionFingerprint,
        report.overallHealthy,
      ));
    } else {
      suppressedCount += 1;
    }

    const result = this.buildResult(outputs, suppressedCount);
    this.lastResult = result;
    return result;
  }

  // ── Telemetry snapshot translation ────────────────────────────────────────

  /**
   * Translates a ZeroBindingTelemetrySnapshotCompat into a ChatInputEnvelope.
   * Emits only when config.emitTelemetry is true.
   */
  public translateTelemetry(
    snapshot: ZeroBindingTelemetrySnapshotCompat,
  ): ZeroBindingAdapterResult {
    const outputs: ZeroBindingSignalOutput[] = [];
    let suppressedCount = 0;

    if (this.config.emitTelemetry) {
      const payload: Readonly<Record<string, JsonValue>> = Object.freeze({
        surface: 'dependency_binder' as JsonValue,
        kind: 'TELEMETRY' as JsonValue,
        tag: 'telemetry',
        sessionFingerprint: snapshot.sessionFingerprint as JsonValue,
        profileId: snapshot.profileId as JsonValue,
        mode: (snapshot.mode ?? null) as JsonValue,
        totalEdges: snapshot.totalEdges as JsonValue,
        boundEdges: snapshot.boundEdges as JsonValue,
        failedEdges: snapshot.failedEdges as JsonValue,
        partialEdges: snapshot.partialEdges as JsonValue,
        validationErrors: snapshot.validationErrors as JsonValue,
        validationWarnings: snapshot.validationWarnings as JsonValue,
        bindingComplete: snapshot.bindingComplete as JsonValue,
        mlBoundEdges: snapshot.mlVector.boundEdges as JsonValue,
        mlTotalEdges: snapshot.mlVector.totalEdges as JsonValue,
        mlAnomalyScore: resolveBindingAnomalyScore(snapshot.mlVector) as JsonValue,
        emittedAt: snapshot.emittedAt as JsonValue,
        translatedAt: nowIso() as JsonValue,
      });
      const envelope = buildChatInputEnvelope(
        this.config.defaultRoomId,
        this.config.channel,
        payload,
      );
      outputs.push(buildSignalOutput(
        envelope,
        'TELEMETRY',
        'INFO',
        snapshot.sessionFingerprint,
        snapshot.bindingComplete,
      ));
    } else {
      suppressedCount += 1;
    }

    const result = this.buildResult(outputs, suppressedCount);
    this.lastResult = result;
    return result;
  }

  // ── Batch translation ─────────────────────────────────────────────────────

  /**
   * Translates a batch of ZeroBindingChatSignalCompat values in order.
   * All results are concatenated into a single ZeroBindingAdapterResult.
   *
   * Use this when replaying a backlog of binding events.
   */
  public translateBatch(
    signals: readonly ZeroBindingChatSignalCompat[],
  ): ZeroBindingAdapterResult {
    const allOutputs: ZeroBindingSignalOutput[] = [];
    let totalSuppressed = 0;

    for (const signal of signals) {
      const result = this.translate(signal);
      allOutputs.push(...result.signals);
      totalSuppressed += result.suppressedCount;
    }

    const result = this.buildResult(allOutputs, totalSuppressed);
    this.lastResult = result;
    return result;
  }

  // ── Query surface ──────────────────────────────────────────────────────────

  /** Returns the result of the most recent adapter invocation. */
  public getLastResult(): ZeroBindingAdapterResult | null {
    return this.lastResult;
  }

  /** Returns the current adapter configuration. */
  public getConfig(): Readonly<ZeroBindingAdapterConfig> {
    return this.config;
  }

  /** Returns true if the adapter is configured to emit signals for the given kind. */
  public isKindEnabled(kind: ZeroBindingSignalKind): boolean {
    return this.shouldEmitKind(kind);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private shouldEmitKind(kind: ZeroBindingSignalKind): boolean {
    switch (kind) {
      case 'BINDING_COMPLETE': return this.config.emitComplete;
      case 'BINDING_PARTIAL':  return this.config.emitPartial;
      case 'BINDING_FAILED':   return this.config.emitFailed;
      case 'BINDING_DRY_RUN':  return this.config.emitDryRun;
      case 'BINDING_REBIND':   return this.config.emitRebind;
      default:                 return false;
    }
  }

  private buildResult(
    outputs: readonly ZeroBindingSignalOutput[],
    suppressedCount: number,
  ): ZeroBindingAdapterResult {
    return Object.freeze({
      signals: Object.freeze([...outputs]),
      emittedCount: outputs.length,
      suppressedCount,
      hasCriticalSignals: outputs.some((o) => o.severity === 'CRITICAL'),
      processedAt: nowIso(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stateless convenience functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stateless translation of a single binding signal using default adapter config.
 * Returns all emitted signal outputs without retaining adapter state.
 */
export function translateZeroBindingSignal(
  signal: ZeroBindingChatSignalCompat,
  config: Partial<ZeroBindingAdapterConfig> = {},
): ZeroBindingAdapterResult {
  return new ZeroBindingSignalAdapter(config).translate(signal);
}

/**
 * Stateless translation of a health report using default adapter config.
 * Returns the emitted signal output or an empty result if suppressed.
 */
export function translateZeroBindingHealthReport(
  report: ZeroBindingHealthReportCompat,
  config: Partial<ZeroBindingAdapterConfig> = {},
): ZeroBindingAdapterResult {
  return new ZeroBindingSignalAdapter(config).translateHealthReport(report);
}

/**
 * Stateless translation of a telemetry snapshot using provided config.
 * Emits only when emitTelemetry is explicitly set to true in config.
 */
export function translateZeroBindingTelemetry(
  snapshot: ZeroBindingTelemetrySnapshotCompat,
  config: Partial<ZeroBindingAdapterConfig> = {},
): ZeroBindingAdapterResult {
  return new ZeroBindingSignalAdapter(config).translateTelemetry(snapshot);
}

/**
 * Factory for creating a ZeroBindingSignalAdapter with a specific room ID
 * and all signals enabled.
 */
export function createZeroBindingSignalAdapter(
  roomId: ChatRoomId,
  config: Partial<Omit<ZeroBindingAdapterConfig, 'defaultRoomId'>> = {},
): ZeroBindingSignalAdapter {
  return new ZeroBindingSignalAdapter({
    ...config,
    defaultRoomId: roomId,
    emitComplete: true,
    emitPartial: true,
    emitFailed: true,
    emitRebind: true,
    emitDryRun: false,
    emitHealthDegradation: true,
    emitMLAnomalies: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Well-known constants
// ─────────────────────────────────────────────────────────────────────────────

export const ZERO_BINDING_SIGNAL_ADAPTER_VERSION = '2026.03.27' as const;

export const ZERO_BINDING_SIGNAL_KINDS = Object.freeze([
  'BINDING_COMPLETE',
  'BINDING_PARTIAL',
  'BINDING_FAILED',
  'BINDING_DRY_RUN',
  'BINDING_REBIND',
] as const satisfies readonly ZeroBindingSignalKind[]);

export const ZERO_BINDING_SIGNAL_SEVERITIES = Object.freeze([
  'INFO',
  'WARN',
  'CRITICAL',
] as const satisfies readonly ZeroBindingSignalSeverity[]);

/** Default singleton adapter for zero-config usage in system contexts. */
export const ZERO_DEFAULT_BINDING_SIGNAL_ADAPTER: ZeroBindingSignalAdapter =
  new ZeroBindingSignalAdapter();

// ─────────────────────────────────────────────────────────────────────────────
// ML feature label re-export
// Mirrors the 32 labels declared in DependencyBinder without importing it.
// Allows chat-layer consumers to interpret ML vectors without circular deps.
// ─────────────────────────────────────────────────────────────────────────────

export const ZERO_BINDING_ML_FEATURE_LABEL_COUNT = 32 as const;

export const ZERO_BINDING_ML_FEATURE_LABELS_COMPAT: readonly string[] = Object.freeze([
  'pressure_reader_bound',
  'shield_reader_bound',
  'tension_reader_bound',
  'cascade_reader_bound',
  'binding_complete',
  'total_attempts_norm',
  'bound_attempts_norm',
  'failed_attempts_norm',
  'partial_attempts_norm',
  'bundle_valid',
  'present_engine_count_norm',
  'missing_engine_count_norm',
  'total_methods_exposed_log',
  'validation_error_count_norm',
  'validation_warning_count_norm',
  'pressure_edge_bound',
  'shield_edge_pressure_bound',
  'shield_edge_battle_bound',
  'tension_edge_shield_bound',
  'tension_edge_battle_bound',
  'cascade_edge_pressure_bound',
  'critical_edges_bound_frac',
  'has_bind_failed',
  'has_missing_setter',
  'has_missing_consumer',
  'has_missing_reader',
  'missing_reader_methods_total_norm',
  'is_dry_run',
  'profile_is_default',
  'mode_is_defined',
  'notes_count_norm',
  'fingerprint_hash_norm',
]);

/**
 * Returns the feature label for a given index, or 'unknown' when the index
 * is out of range.
 */
export function getBindingMLFeatureLabel(index: number): string {
  return ZERO_BINDING_ML_FEATURE_LABELS_COMPAT[index] ?? 'unknown';
}

/**
 * Returns the index of a feature label, or -1 when not found.
 */
export function getBindingMLFeatureIndex(label: string): number {
  return ZERO_BINDING_ML_FEATURE_LABELS_COMPAT.indexOf(label);
}

/**
 * Resolves whether a ML vector's feature at the given index indicates an
 * anomalous state (value > 0.5 for binary features, or > threshold for normalized).
 */
export function isBindingMLFeatureAnomalous(
  vector: ZeroBindingMLVectorCompat,
  featureIndex: number,
  threshold = 0.5,
): boolean {
  const value = vector.features[featureIndex];
  if (value === undefined) return false;
  return value > threshold;
}

/**
 * Extracts the binding group health boolean record from a health report compat.
 * Useful for routing decisions without importing the full health monitor.
 */
export function extractBindingGroupHealthMap(
  report: ZeroBindingHealthReportCompat,
): Readonly<Record<ZeroBindingGroupCompat, boolean>> {
  return Object.freeze({ ...report.groupHealth });
}

/**
 * Returns true when all four reader groups are healthy in the given report.
 */
export function isAllBindingGroupsHealthy(
  report: ZeroBindingHealthReportCompat,
): boolean {
  return (
    report.groupHealth['pressure-reader'] &&
    report.groupHealth['shield-reader'] &&
    report.groupHealth['tension-reader'] &&
    report.groupHealth['cascade-reader']
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────────────────────────────────────

export function isZeroBindingChatSignal(
  value: unknown,
): value is ZeroBindingChatSignalCompat {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)['surface'] === 'dependency_binder' &&
    typeof (value as Record<string, unknown>)['kind'] === 'string' &&
    typeof (value as Record<string, unknown>)['sessionFingerprint'] === 'string'
  );
}

export function isZeroBindingHealthReport(
  value: unknown,
): value is ZeroBindingHealthReportCompat {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['healthScore'] === 'number' &&
    typeof (value as Record<string, unknown>)['sessionFingerprint'] === 'string'
  );
}

export function isZeroBindingTelemetrySnapshot(
  value: unknown,
): value is ZeroBindingTelemetrySnapshotCompat {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['sessionFingerprint'] === 'string' &&
    typeof (value as Record<string, unknown>)['totalEdges'] === 'number' &&
    'mlVector' in (value as object)
  );
}

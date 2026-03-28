// backend/src/game/engine/chat/adapters/StepTracePublisherSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/StepTracePublisherSignalAdapter.ts
 *
 * Translates StepTracePublisher signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * Prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Step trace signals enter the chat lane whenever the publisher detects
 * error rate spikes, budget pressure, mutation anomalies, open session leaks,
 * or checksum coverage dropping below thresholds.
 * They carry:
 *   - operation kind (TRACE_BEGIN / TRACE_COMMIT_SUCCESS / TRACE_COMMIT_FAILURE / etc.)
 *   - health score (ML-derived [0,1])
 *   - severity (OK / WARNING / CRITICAL / FATAL)
 *   - step distribution metrics (which steps are hot)
 *   - run/tick context for routing
 *   - ML vector (32-dim) for real-time inference
 *   - narration key and urgency label for companion routing
 *
 * Chat doctrine:
 *   - OK       → traces nominal, no companion action needed
 *   - WARNING  → error rate rising or budget pressure detected, advisory fires
 *   - CRITICAL → trace errors or open session leak, coaching fires
 *   - FATAL    → critical trace failure, rescue fires, max heat
 *
 * Adapter modes:
 *   DEFAULT  — emits for WARNING/CRITICAL/FATAL only
 *   STRICT   — emits only for CRITICAL/FATAL
 *   VERBOSE  — emits for all operations including OK traces; full ML vector
 *
 * Singletons:
 *   STEP_TRACE_DEFAULT_SIGNAL_ADAPTER
 *   STEP_TRACE_STRICT_SIGNAL_ADAPTER
 *   STEP_TRACE_VERBOSE_SIGNAL_ADAPTER
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
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURAL COMPAT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Structural compat for TraceSeverity. */
export type StepTraceSeverityCompat = 'OK' | 'WARNING' | 'CRITICAL' | 'FATAL';

/** Structural compat for TraceOperationKind. */
export type StepTraceOperationKindCompat =
  | 'TRACE_BEGIN'
  | 'TRACE_COMMIT_SUCCESS'
  | 'TRACE_COMMIT_FAILURE'
  | 'TRACE_GET'
  | 'TRACE_LIST_RECENT'
  | 'TRACE_LIST_FOR_TICK'
  | 'TRACE_SUMMARIZE_RUN'
  | 'TRACE_LATEST_FOR_TICK'
  | 'TRACE_OPEN_SESSIONS'
  | 'TRACE_CLEAR';

/** Structural compat for ModeCode. */
type ModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for RunPhase. */
type RunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Structural compat for TickStep (13 values). */
type TickStepCompat =
  | 'STEP_01_PREPARE'
  | 'STEP_02_TIME'
  | 'STEP_03_PRESSURE'
  | 'STEP_04_TENSION'
  | 'STEP_05_BATTLE'
  | 'STEP_06_SHIELD'
  | 'STEP_07_CASCADE'
  | 'STEP_08_MODE_POST'
  | 'STEP_09_TELEMETRY'
  | 'STEP_10_SOVEREIGNTY_SNAPSHOT'
  | 'STEP_11_OUTCOME_GATE'
  | 'STEP_12_EVENT_SEAL'
  | 'STEP_13_FLUSH';

/** Structural compat for TraceMLVector (32 fields). */
export interface StepTraceMLVectorCompat {
  readonly traceErrorRate01: number;
  readonly traceOkRate01: number;
  readonly avgDurationMs01: number;
  readonly maxDurationMs01: number;
  readonly p95DurationMs01: number;
  readonly openTraceRatio01: number;
  readonly stepCompletionRate01: number;
  readonly stepBudgetPressure01: number;
  readonly stepPrepareRate01: number;
  readonly stepTimeRate01: number;
  readonly stepPressureRate01: number;
  readonly stepTensionRate01: number;
  readonly stepBattleRate01: number;
  readonly stepShieldRate01: number;
  readonly stepCascadeRate01: number;
  readonly stepModePostRate01: number;
  readonly stepTelemetryRate01: number;
  readonly stepSovereigntyRate01: number;
  readonly stepOutcomeRate01: number;
  readonly stepSealRate01: number;
  readonly stepFlushRate01: number;
  readonly eventCountAvg01: number;
  readonly signalCountAvg01: number;
  readonly mutationDepthAvg01: number;
  readonly checksumPresenceRate01: number;
  readonly traceIndexDensity01: number;
  readonly runCoverageRatio01: number;
  readonly pressureTierNorm01: number;
  readonly modeNorm01: number;
  readonly phaseNorm01: number;
  readonly anomalyScore01: number;
  readonly sessionHealthScore01: number;
}

/** Structural compat for TraceDLTensorRow. */
export interface StepTraceDLTensorRowCompat {
  readonly label: string;
  readonly f0: number;
  readonly f1: number;
  readonly f2: number;
  readonly f3: number;
  readonly f4: number;
  readonly f5: number;
}

/** Structural compat for TraceDLTensor. */
export interface StepTraceDLTensorCompat {
  readonly shape: readonly [number, number];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly rows: readonly StepTraceDLTensorRowCompat[];
  readonly checksum: string;
}

/** Structural compat for TraceChatSignal. */
export interface StepTraceSignalCompat {
  readonly kind: 'STEP_TRACE_SIGNAL';
  readonly runId: string | null;
  readonly mode: ModeCodeCompat | null;
  readonly operationKind: StepTraceOperationKindCompat;
  readonly severity: StepTraceSeverityCompat;
  readonly healthScore: number;
  readonly phase: RunPhaseCompat | null;
  readonly tick: number | null;
  readonly openTraceCount: number;
  readonly errorTraceCount: number;
  readonly avgDurationMs: number;
  readonly indexedTraceCount: number;
  readonly stepBudgetPressure: number;
  readonly anomalyScore: number;
  readonly actionRecommendation: string;
  readonly narrationKey: string;
  readonly mlVector: StepTraceMLVectorCompat;
  readonly timestampMs: number;
}

/** Structural compat for TraceAnnotationBundle. */
export interface StepTraceAnnotationCompat {
  readonly traceAnnotationId: string;
  readonly runId: string | null;
  readonly operationKind: StepTraceOperationKindCompat;
  readonly severity: StepTraceSeverityCompat;
  readonly healthScore: number;
  readonly phase: RunPhaseCompat | null;
  readonly narration: string;
  readonly tags: readonly string[];
  readonly timestamp: number;
}

/** Structural compat for TraceNarrationHint. */
export interface StepTraceNarrationCompat {
  readonly operationKind: StepTraceOperationKindCompat;
  readonly phase: RunPhaseCompat | null;
  readonly mode: ModeCodeCompat | null;
  readonly severity: StepTraceSeverityCompat;
  readonly headline: string;
  readonly subtext: string;
  readonly urgency: StepTraceSeverityCompat;
  readonly actionPrompt: string;
  readonly debugLabel: string;
}

/** Structural compat for TraceTrendSnapshot. */
export interface StepTraceTrendCompat {
  readonly sessionId: string;
  readonly tracesPerMinute: number;
  readonly avgHealthScore: number;
  readonly peakErrorRate: number;
  readonly totalOperations: number;
  readonly operationBreakdown: Readonly<Record<string, number>>;
  readonly severityBreakdown: Readonly<Record<string, number>>;
  readonly capturedAt: number;
}

/** Structural compat for TraceSessionReport. */
export interface StepTraceSessionCompat {
  readonly sessionId: string;
  readonly totalTraces: number;
  readonly uniqueRunIds: readonly string[];
  readonly avgMLHealthScore: number;
  readonly peakErrorRate: number;
  readonly topOperation: StepTraceOperationKindCompat | null;
  readonly durationMs: number;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

/** Structural compat for TraceHealthSnapshot. */
export interface StepTraceHealthSnapshotCompat {
  readonly runId: string | null;
  readonly tick: number | null;
  readonly healthScore: number;
  readonly severity: StepTraceSeverityCompat;
  readonly openTraceCount: number;
  readonly indexedTraceCount: number;
  readonly errorTraceCount: number;
  readonly avgDurationMs: number;
  readonly stepBudgetPressure: number;
  readonly capturedAt: number;
}

/** Structural compat for TraceRunSummary. */
export interface StepTraceRunSummaryCompat {
  readonly runId: string | null;
  readonly totalTracesForRun: number;
  readonly okCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number;
  readonly latestTick: number | null;
  readonly phase: RunPhaseCompat | null;
  readonly mode: ModeCodeCompat | null;
  readonly avgHealthScore: number;
  readonly stepsSeen: readonly TickStepCompat[];
  readonly traceIds: readonly string[];
}

/** Result of a translate call including full diagnostics. */
export interface StepTraceTranslationResult {
  readonly emitted: boolean;
  readonly envelope: ChatInputEnvelope | null;
  readonly reason: string;
  readonly healthScore: number;
  readonly severity: StepTraceSeverityCompat;
  readonly operationKind: StepTraceOperationKindCompat;
  readonly adapterMode: StepTraceAdapterMode;
  readonly translatedAt: number;
}

export type StepTraceAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

/** Adapter manifest for registry and diagnostics. */
export interface StepTraceSignalAdapterManifest {
  readonly adapterId: string;
  readonly adapterName: string;
  readonly version: string;
  readonly schema: string;
  readonly mode: StepTraceAdapterMode;
  readonly mlFeatureCount: number;
  readonly emitsOnOk: boolean;
  readonly emitsOnWarning: boolean;
  readonly emitsOnCritical: boolean;
  readonly emitsOnFatal: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const STEP_TRACE_SIGNAL_ADAPTER_VERSION         = '1.0.0' as const;
export const STEP_TRACE_SIGNAL_ADAPTER_READY           = true as const;
export const STEP_TRACE_SIGNAL_ADAPTER_SCHEMA          = 'step-trace-signal-adapter-v1' as const;
export const STEP_TRACE_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const STEP_TRACE_SIGNAL_ADAPTER_MAX_HEAT        = 1.0 as const;
export const STEP_TRACE_SIGNAL_WORLD_EVENT_PREFIX      = 'step_trace' as const;

// ─────────────────────────────────────────────────────────────────────────────
// WORLD EVENT KEY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildSignalWorldEvent(
  op: StepTraceOperationKindCompat,
  sev: StepTraceSeverityCompat,
): string {
  return `${STEP_TRACE_SIGNAL_WORLD_EVENT_PREFIX}:${op.toLowerCase()}:${sev.toLowerCase()}`;
}

function buildAnnotationWorldEvent(op: StepTraceOperationKindCompat): string {
  return `${STEP_TRACE_SIGNAL_WORLD_EVENT_PREFIX}:annotation:${op.toLowerCase()}`;
}

function buildNarrationWorldEvent(op: StepTraceOperationKindCompat): string {
  return `${STEP_TRACE_SIGNAL_WORLD_EVENT_PREFIX}:narration:${op.toLowerCase()}`;
}

function buildHealthWorldEvent(severity: StepTraceSeverityCompat): string {
  return `${STEP_TRACE_SIGNAL_WORLD_EVENT_PREFIX}:health:${severity.toLowerCase()}`;
}

function buildRunSummaryWorldEvent(runId: string | null): string {
  return `${STEP_TRACE_SIGNAL_WORLD_EVENT_PREFIX}:run_summary:${runId?.slice(0, 8) ?? 'none'}`;
}

function buildTrendWorldEvent(severity: StepTraceSeverityCompat): string {
  return `${STEP_TRACE_SIGNAL_WORLD_EVENT_PREFIX}:trend:${severity.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAT / SEVERITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function severityToHeat(severity: StepTraceSeverityCompat): Score01 {
  switch (severity) {
    case 'OK':       return 0.0 as Score01;
    case 'WARNING':  return 0.38 as Score01;
    case 'CRITICAL': return 0.72 as Score01;
    case 'FATAL':    return 1.0 as Score01;
    default:         return 0.0 as Score01;
  }
}

function shouldEmit(
  signal: StepTraceSignalCompat,
  mode: StepTraceAdapterMode,
): boolean {
  if (mode === 'VERBOSE') return true;
  if (mode === 'STRICT') {
    return signal.severity === 'CRITICAL' || signal.severity === 'FATAL';
  }
  // DEFAULT — emit for WARNING and above
  return signal.severity !== 'OK';
}

function buildSignalMetadata(
  signal: StepTraceSignalCompat,
  verbose: boolean,
): Record<string, JsonValue> {
  const base: Record<string, JsonValue> = {
    operationKind: signal.operationKind,
    severity: signal.severity,
    healthScore: signal.healthScore,
    openTraceCount: signal.openTraceCount,
    errorTraceCount: signal.errorTraceCount,
    avgDurationMs: signal.avgDurationMs,
    indexedTraceCount: signal.indexedTraceCount,
    stepBudgetPressure: signal.stepBudgetPressure,
    anomalyScore: signal.anomalyScore,
    actionRecommendation: signal.actionRecommendation,
    narrationKey: signal.narrationKey,
    runId: signal.runId ?? 'null',
    tick: signal.tick ?? -1,
    phase: signal.phase ?? 'null',
    mode: signal.mode ?? 'null',
  };
  if (verbose) {
    base['mlVector'] = signal.mlVector as unknown as JsonValue;
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class StepTracePublisherSignalAdapter {
  private readonly mode: StepTraceAdapterMode;

  public constructor(mode: StepTraceAdapterMode = 'DEFAULT') {
    this.mode = mode;
  }

  // ── Primary signal translation ─────────────────────────────────────────────

  public translate(
    signal: StepTraceSignalCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(signal, this.mode)) return null;

    const emittedAt = nowMs();
    const worldEventName = buildSignalWorldEvent(signal.operationKind, signal.severity);
    const heat = severityToHeat(signal.severity);
    const haterRaid =
      signal.severity === 'FATAL' ||
      signal.anomalyScore > 0.85 ||
      signal.stepBudgetPressure > 0.9;
    const helperBlackout = signal.healthScore < 0.15;

    const liveops: ChatSignalEnvelope['liveops'] = {
      worldEventName: worldEventName as Nullable<string>,
      heatMultiplier01: clamp01(heat) as Score01,
      helperBlackout,
      haterRaidActive: haterRaid,
    };

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops,
      metadata: buildSignalMetadata(signal, this.mode === 'VERBOSE') as Readonly<
        Record<string, JsonValue>
      >,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt,
      payload: envelope,
    };
  }

  // ── Full result translation ────────────────────────────────────────────────

  public translateWithResult(
    signal: StepTraceSignalCompat,
    roomId?: ChatRoomId | null,
  ): StepTraceTranslationResult {
    const envelope = this.translate(signal, roomId);
    const emitted = envelope !== null;
    const reason = emitted
      ? `Step trace signal emitted: ${signal.operationKind} severity=${signal.severity}`
      : `Step trace signal suppressed by adapter mode=${this.mode} (severity=${signal.severity})`;

    return Object.freeze({
      emitted,
      envelope,
      reason,
      healthScore: signal.healthScore,
      severity: signal.severity,
      operationKind: signal.operationKind,
      adapterMode: this.mode,
      translatedAt: Date.now(),
    } satisfies StepTraceTranslationResult);
  }

  // ── Annotation translation ─────────────────────────────────────────────────

  public translateAnnotation(
    annotation: StepTraceAnnotationCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    const sev = annotation.severity;
    if (this.mode === 'DEFAULT' && sev === 'OK') return null;
    if (this.mode === 'STRICT' && sev !== 'CRITICAL' && sev !== 'FATAL') return null;

    const emittedAt = nowMs();
    const worldEventName = buildAnnotationWorldEvent(annotation.operationKind);
    const heat = severityToHeat(sev);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: clamp01(heat) as Score01,
        helperBlackout: annotation.healthScore < 0.2,
        haterRaidActive: sev === 'FATAL',
      },
      metadata: {
        traceAnnotationId: annotation.traceAnnotationId,
        runId: annotation.runId ?? 'null',
        operationKind: annotation.operationKind,
        severity: annotation.severity,
        healthScore: annotation.healthScore,
        narration: annotation.narration,
        tags: annotation.tags as unknown as JsonValue,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  // ── Narration hint translation ─────────────────────────────────────────────

  public translateNarrationHint(
    narration: StepTraceNarrationCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    const sev = narration.severity;
    if (this.mode === 'DEFAULT' && sev === 'OK') return null;
    if (this.mode === 'STRICT' && sev !== 'CRITICAL' && sev !== 'FATAL') return null;

    const emittedAt = nowMs();
    const worldEventName = buildNarrationWorldEvent(narration.operationKind);
    const heat = severityToHeat(sev);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: false,
        haterRaidActive: sev === 'FATAL',
      },
      metadata: {
        operationKind: narration.operationKind,
        phase: narration.phase ?? 'null',
        mode: narration.mode ?? 'null',
        severity: narration.severity,
        headline: narration.headline,
        subtext: narration.subtext,
        actionPrompt: narration.actionPrompt,
        debugLabel: narration.debugLabel,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  // ── Health snapshot translation ────────────────────────────────────────────

  public translateHealthSnapshot(
    snapshot: StepTraceHealthSnapshotCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    const sev = snapshot.severity;
    if (this.mode === 'DEFAULT' && sev === 'OK') return null;
    if (this.mode === 'STRICT' && sev !== 'CRITICAL' && sev !== 'FATAL') return null;

    const emittedAt = nowMs();
    const worldEventName = buildHealthWorldEvent(sev);
    const heat = severityToHeat(sev);
    const haterRaid = sev === 'FATAL' || snapshot.stepBudgetPressure > 0.9;

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout: snapshot.healthScore < 0.2,
        haterRaidActive: haterRaid,
      },
      metadata: {
        runId: snapshot.runId ?? 'null',
        tick: snapshot.tick ?? -1,
        healthScore: snapshot.healthScore,
        severity: snapshot.severity,
        openTraceCount: snapshot.openTraceCount,
        indexedTraceCount: snapshot.indexedTraceCount,
        errorTraceCount: snapshot.errorTraceCount,
        avgDurationMs: snapshot.avgDurationMs,
        stepBudgetPressure: snapshot.stepBudgetPressure,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  // ── Run summary translation ────────────────────────────────────────────────

  public translateRunSummary(
    summary: StepTraceRunSummaryCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    // Run summary always emits in VERBOSE; only when errors exist in DEFAULT/STRICT
    const hasErrors = summary.errorCount > 0;
    if (this.mode === 'STRICT' && !hasErrors) return null;
    if (this.mode === 'DEFAULT' && !hasErrors) return null;

    const emittedAt = nowMs();
    const worldEventName = buildRunSummaryWorldEvent(summary.runId);
    const errorRatio =
      summary.totalTracesForRun > 0 ? summary.errorCount / summary.totalTracesForRun : 0;
    const heat = clamp01(errorRatio * 1.5);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: summary.avgHealthScore < 0.2,
        haterRaidActive: errorRatio > 0.5,
      },
      metadata: {
        runId: summary.runId ?? 'null',
        totalTracesForRun: summary.totalTracesForRun,
        okCount: summary.okCount,
        errorCount: summary.errorCount,
        avgDurationMs: summary.avgDurationMs,
        latestTick: summary.latestTick ?? -1,
        phase: summary.phase ?? 'null',
        mode: summary.mode ?? 'null',
        avgHealthScore: summary.avgHealthScore,
        stepsSeen: summary.stepsSeen as unknown as JsonValue,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  // ── Trend snapshot translation ────────────────────────────────────────────

  public translateTrend(
    trend: StepTraceTrendCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    // Build synthetic severity from avgHealthScore
    const health = trend.avgHealthScore;
    const sev: StepTraceSeverityCompat =
      health >= 0.75 ? 'OK' : health >= 0.5 ? 'WARNING' : health >= 0.25 ? 'CRITICAL' : 'FATAL';

    if (this.mode === 'DEFAULT' && sev === 'OK') return null;
    if (this.mode === 'STRICT' && sev !== 'CRITICAL' && sev !== 'FATAL') return null;

    const emittedAt = nowMs();
    const worldEventName = buildTrendWorldEvent(sev);
    const heat = severityToHeat(sev);

    const fatalCount = trend.severityBreakdown?.['FATAL'] ?? 0;
    const criticalCount = trend.severityBreakdown?.['CRITICAL'] ?? 0;
    const haterRaid = fatalCount > 0 || criticalCount > trend.totalOperations * 0.3;

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: health < 0.15,
        haterRaidActive: haterRaid,
      },
      metadata: {
        sessionId: trend.sessionId,
        tracesPerMinute: trend.tracesPerMinute,
        avgHealthScore: trend.avgHealthScore,
        peakErrorRate: trend.peakErrorRate,
        totalOperations: trend.totalOperations,
        fatalCount,
        criticalCount,
        inferredSeverity: sev,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  // ── Adapter introspection ─────────────────────────────────────────────────

  public getMode(): StepTraceAdapterMode {
    return this.mode;
  }

  public isVerbose(): boolean {
    return this.mode === 'VERBOSE';
  }

  public isStrict(): boolean {
    return this.mode === 'STRICT';
  }

  public manifest(): StepTraceSignalAdapterManifest {
    return Object.freeze({
      adapterId: `step-trace-signal-adapter-${this.mode.toLowerCase()}`,
      adapterName: 'StepTracePublisherSignalAdapter',
      version: STEP_TRACE_SIGNAL_ADAPTER_VERSION,
      schema: STEP_TRACE_SIGNAL_ADAPTER_SCHEMA,
      mode: this.mode,
      mlFeatureCount: STEP_TRACE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      emitsOnOk: this.mode === 'VERBOSE',
      emitsOnWarning: this.mode !== 'STRICT',
      emitsOnCritical: true,
      emitsOnFatal: true,
    } satisfies StepTraceSignalAdapterManifest);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS
// ─────────────────────────────────────────────────────────────────────────────

export const STEP_TRACE_DEFAULT_SIGNAL_ADAPTER = new StepTracePublisherSignalAdapter('DEFAULT');
export const STEP_TRACE_STRICT_SIGNAL_ADAPTER  = new StepTracePublisherSignalAdapter('STRICT');
export const STEP_TRACE_VERBOSE_SIGNAL_ADAPTER = new StepTracePublisherSignalAdapter('VERBOSE');

// ─────────────────────────────────────────────────────────────────────────────
// MANIFESTS
// ─────────────────────────────────────────────────────────────────────────────

export const STEP_TRACE_SIGNAL_ADAPTER_MANIFEST: StepTraceSignalAdapterManifest = Object.freeze({
  adapterId: 'step-trace-signal-adapter-default',
  adapterName: 'StepTracePublisherSignalAdapter',
  version: STEP_TRACE_SIGNAL_ADAPTER_VERSION,
  schema: STEP_TRACE_SIGNAL_ADAPTER_SCHEMA,
  mode: 'DEFAULT' as const,
  mlFeatureCount: STEP_TRACE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  emitsOnOk: false,
  emitsOnWarning: true,
  emitsOnCritical: true,
  emitsOnFatal: true,
});

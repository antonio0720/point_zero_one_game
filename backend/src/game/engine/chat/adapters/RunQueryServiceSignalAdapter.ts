// backend/src/game/engine/chat/adapters/RunQueryServiceSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/RunQueryServiceSignalAdapter.ts
 *
 * Translates RunQueryService signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * Prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Query signals enter the chat lane whenever the query service detects
 * saturation, degradation, trace errors, or unusual read patterns.
 * They carry:
 *   - operation kind (SNAPSHOT_READ / TRACE_FETCH / CHECKPOINT_FETCH / etc.)
 *   - health score (ML-derived [0,1])
 *   - severity (OK / WARNING / CRITICAL / FATAL)
 *   - saturation and latency metrics
 *   - run/tick context for routing
 *   - ML vector (32-dim) for real-time inference
 *   - narration key and urgency label for companion routing
 *
 * Chat doctrine:
 *   - OK       → nominal read surface, no companion action
 *   - WARNING  → latency building, companion advisory fires
 *   - CRITICAL → query pressure high, companion coaching fires
 *   - FATAL    → engine reads degraded, companion rescue fires, max heat
 *
 * Adapter modes:
 *   DEFAULT  — emits for WARNING/CRITICAL/FATAL only
 *   STRICT   — emits only for CRITICAL/FATAL
 *   VERBOSE  — emits for all operations including OK reads; full ML vector
 *
 * Singletons:
 *   QUERY_DEFAULT_SIGNAL_ADAPTER
 *   QUERY_STRICT_SIGNAL_ADAPTER
 *   QUERY_VERBOSE_SIGNAL_ADAPTER
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

/** Structural compat for QuerySeverity. */
export type QuerySeverityCompat = 'OK' | 'WARNING' | 'CRITICAL' | 'FATAL';

/** Structural compat for QueryOperationKind. */
export type QueryOperationKindCompat =
  | 'SNAPSHOT_READ'
  | 'TRACE_FETCH'
  | 'CHECKPOINT_FETCH'
  | 'EVENT_HISTORY_READ'
  | 'HEALTH_POLL'
  | 'SUMMARY_BUILD'
  | 'ROLLBACK_CLONE'
  | 'CHECKPOINT_RESTORE'
  | 'RUN_QUERY'
  | 'TICK_QUERY';

/** Structural compat for ModeCode. */
type ModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for RunPhase. */
type RunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Structural compat for QueryMLVector (32 fields). */
export interface QueryMLVectorCompat {
  readonly queryRate01: number;
  readonly cacheHitRate01: number;
  readonly snapshotFreshness01: number;
  readonly traceOpenRatio01: number;
  readonly traceCoverageRate01: number;
  readonly checkpointDensity01: number;
  readonly eventQueuePressure01: number;
  readonly eventHistoryDepth01: number;
  readonly engineHealthScore01: number;
  readonly runActiveFlag01: number;
  readonly tickProgress01: number;
  readonly phaseNormalized01: number;
  readonly modeNormalized01: number;
  readonly outcomeRisk01: number;
  readonly pressureTierNormalized01: number;
  readonly cascadeActivityRatio01: number;
  readonly battleActivityFlag01: number;
  readonly warningDensity01: number;
  readonly divergenceScore01: number;
  readonly checkpointLatencyMs01: number;
  readonly traceErrorRate01: number;
  readonly queryLatencyMs01: number;
  readonly snapshotSizeScore01: number;
  readonly registryLoadScore01: number;
  readonly busBacklogScore01: number;
  readonly rollbackAvailability01: number;
  readonly queryFrequency01: number;
  readonly healthDegradationRisk01: number;
  readonly traceCompletionRate01: number;
  readonly checkpointRecentCount01: number;
  readonly readPatternDiversity01: number;
  readonly serviceSaturation01: number;
}

/** Structural compat for QueryDLTensorRow. */
export interface QueryDLTensorRowCompat {
  readonly label: string;
  readonly f0: number;
  readonly f1: number;
  readonly f2: number;
  readonly f3: number;
  readonly f4: number;
  readonly f5: number;
}

/** Structural compat for QueryDLTensor. */
export interface QueryDLTensorCompat {
  readonly shape: readonly [number, number];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly rows: readonly QueryDLTensorRowCompat[];
  readonly checksum: string;
}

/** Structural compat for QueryChatSignal (from zero/). */
export interface QuerySignalCompat {
  readonly kind: 'QUERY_SIGNAL';
  readonly runId: string | null;
  readonly mode: ModeCodeCompat | null;
  readonly operationKind: QueryOperationKindCompat;
  readonly severity: QuerySeverityCompat;
  readonly healthScore: number;
  readonly phase: RunPhaseCompat | null;
  readonly tick: number | null;
  readonly openTraceCount: number;
  readonly recentCheckpointCount: number;
  readonly queuedEventCount: number;
  readonly engineHealthCount: number;
  readonly saturation: number;
  readonly latencyMs: number;
  readonly rollbackAvailable: boolean;
  readonly actionRecommendation: string;
  readonly narrationKey: string;
  readonly mlVector: QueryMLVectorCompat;
  readonly timestampMs: number;
}

/** Structural compat for QueryAnnotationBundle. */
export interface QueryAnnotationCompat {
  readonly queryId: string;
  readonly runId: string | null;
  readonly operationKind: QueryOperationKindCompat;
  readonly severity: QuerySeverityCompat;
  readonly healthScore: number;
  readonly phase: RunPhaseCompat | null;
  readonly saturation: number;
  readonly narration: string;
  readonly tags: readonly string[];
  readonly timestamp: number;
}

/** Structural compat for QueryNarrationHint. */
export interface QueryNarrationCompat {
  readonly operationKind: QueryOperationKindCompat;
  readonly phase: RunPhaseCompat | null;
  readonly mode: ModeCodeCompat | null;
  readonly severity: QuerySeverityCompat;
  readonly headline: string;
  readonly subtext: string;
  readonly urgency: QuerySeverityCompat;
  readonly actionPrompt: string;
  readonly debugLabel: string;
}

/** Structural compat for QueryTrendSnapshot. */
export interface QueryTrendCompat {
  readonly sessionId: string;
  readonly queriesPerMinute: number;
  readonly avgHealthScore: number;
  readonly peakLatencyMs: number;
  readonly totalOperations: number;
  readonly operationBreakdown: Readonly<Record<string, number>>;
  readonly severityBreakdown: Readonly<Record<string, number>>;
  readonly capturedAt: number;
}

/** Structural compat for QuerySessionReport. */
export interface QuerySessionCompat {
  readonly sessionId: string;
  readonly totalQueries: number;
  readonly uniqueRunIds: readonly string[];
  readonly avgMLHealthScore: number;
  readonly peakSaturation: number;
  readonly topOperation: QueryOperationKindCompat | null;
  readonly durationMs: number;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

/** Structural compat for QueryHealthSnapshot. */
export interface QueryHealthSnapshotCompat {
  readonly runId: string | null;
  readonly tick: number | null;
  readonly healthScore: number;
  readonly severity: QuerySeverityCompat;
  readonly openTraceCount: number;
  readonly recentCheckpointCount: number;
  readonly eventQueueDepth: number;
  readonly registryEngineCount: number;
  readonly saturation: number;
  readonly capturedAt: number;
}

/** Structural compat for QueryRunSummary. */
export interface QueryRunSummaryCompat {
  readonly runId: string | null;
  readonly totalQueriesForRun: number;
  readonly openTraceCount: number;
  readonly latestTick: number | null;
  readonly phase: RunPhaseCompat | null;
  readonly mode: ModeCodeCompat | null;
  readonly avgHealthScore: number;
  readonly saturation: number;
  readonly queryIds: readonly string[];
}

/** Result of a translate call including full diagnostics. */
export interface QueryTranslationResult {
  readonly emitted: boolean;
  readonly envelope: ChatInputEnvelope | null;
  readonly reason: string;
  readonly healthScore: number;
  readonly severity: QuerySeverityCompat;
  readonly operationKind: QueryOperationKindCompat;
  readonly adapterMode: RunQueryAdapterMode;
  readonly translatedAt: number;
}

export type RunQueryAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const QUERY_SIGNAL_ADAPTER_VERSION         = '1.0.0' as const;
export const QUERY_SIGNAL_ADAPTER_READY           = true as const;
export const QUERY_SIGNAL_ADAPTER_SCHEMA          = 'query-signal-adapter-v1' as const;
export const QUERY_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const QUERY_SIGNAL_ADAPTER_MAX_HEAT        = 1.0 as const;
export const QUERY_SIGNAL_WORLD_EVENT_PREFIX      = 'query' as const;

// ─────────────────────────────────────────────────────────────────────────────
// WORLD EVENT KEY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildSignalWorldEvent(
  op: QueryOperationKindCompat,
  sev: QuerySeverityCompat,
): string {
  return `${QUERY_SIGNAL_WORLD_EVENT_PREFIX}:${op.toLowerCase()}:${sev.toLowerCase()}`;
}

function buildAnnotationWorldEvent(op: QueryOperationKindCompat): string {
  return `${QUERY_SIGNAL_WORLD_EVENT_PREFIX}:annotation:${op.toLowerCase()}`;
}

function buildNarrationWorldEvent(op: QueryOperationKindCompat): string {
  return `${QUERY_SIGNAL_WORLD_EVENT_PREFIX}:narration:${op.toLowerCase()}`;
}

function buildHealthWorldEvent(severity: QuerySeverityCompat): string {
  return `${QUERY_SIGNAL_WORLD_EVENT_PREFIX}:health:${severity.toLowerCase()}`;
}

function buildRunSummaryWorldEvent(runId: string | null): string {
  return `${QUERY_SIGNAL_WORLD_EVENT_PREFIX}:run_summary:${runId?.slice(0, 8) ?? 'none'}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAT / SEVERITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function severityToHeat(severity: QuerySeverityCompat): Score01 {
  switch (severity) {
    case 'OK':       return 0.0 as Score01;
    case 'WARNING':  return 0.35 as Score01;
    case 'CRITICAL': return 0.7 as Score01;
    case 'FATAL':    return 1.0 as Score01;
    default:         return 0.0 as Score01;
  }
}

function shouldEmit(
  signal: QuerySignalCompat,
  mode: RunQueryAdapterMode,
): boolean {
  if (mode === 'VERBOSE') return true;
  if (mode === 'STRICT') {
    return signal.severity === 'CRITICAL' || signal.severity === 'FATAL';
  }
  // DEFAULT — emit for WARNING and above
  return signal.severity !== 'OK';
}

function buildMetadata(
  signal: QuerySignalCompat,
  verbose: boolean,
): Record<string, JsonValue> {
  const base: Record<string, JsonValue> = {
    operationKind: signal.operationKind,
    severity: signal.severity,
    healthScore: signal.healthScore,
    saturation: signal.saturation,
    latencyMs: signal.latencyMs,
    openTraceCount: signal.openTraceCount,
    recentCheckpointCount: signal.recentCheckpointCount,
    queuedEventCount: signal.queuedEventCount,
    engineHealthCount: signal.engineHealthCount,
    rollbackAvailable: signal.rollbackAvailable,
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

export class RunQueryServiceSignalAdapter {
  private readonly mode: RunQueryAdapterMode;

  public constructor(mode: RunQueryAdapterMode = 'DEFAULT') {
    this.mode = mode;
  }

  public translate(
    signal: QuerySignalCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(signal, this.mode)) return null;

    const emittedAt = nowMs();
    const worldEventName = buildSignalWorldEvent(signal.operationKind, signal.severity);
    const heat = severityToHeat(signal.severity);
    const haterRaid = signal.severity === 'FATAL' || signal.saturation > 0.9;
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
      metadata: buildMetadata(signal, this.mode === 'VERBOSE') as Readonly<Record<string, JsonValue>>,
    };

    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt,
      payload: envelope,
    };
  }

  public translateWithResult(
    signal: QuerySignalCompat,
    roomId?: ChatRoomId | null,
  ): QueryTranslationResult {
    const envelope = this.translate(signal, roomId);
    const emitted = envelope !== null;
    const reason = emitted
      ? `Query signal emitted: ${signal.operationKind} severity=${signal.severity}`
      : `Query signal suppressed by adapter mode=${this.mode} (severity=${signal.severity})`;

    return Object.freeze({
      emitted,
      envelope,
      reason,
      healthScore: signal.healthScore,
      severity: signal.severity,
      operationKind: signal.operationKind,
      adapterMode: this.mode,
      translatedAt: Date.now(),
    } satisfies QueryTranslationResult);
  }

  public translateAnnotation(
    annotation: QueryAnnotationCompat,
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
        queryId: annotation.queryId,
        runId: annotation.runId ?? 'null',
        operationKind: annotation.operationKind,
        severity: annotation.severity,
        healthScore: annotation.healthScore,
        saturation: annotation.saturation,
        narration: annotation.narration,
        tags: annotation.tags as unknown as JsonValue,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateNarrationHint(
    narration: QueryNarrationCompat,
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

  public translateHealthSnapshot(
    snapshot: QueryHealthSnapshotCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    const sev = snapshot.severity;
    if (this.mode === 'DEFAULT' && sev === 'OK') return null;
    if (this.mode === 'STRICT' && sev !== 'CRITICAL' && sev !== 'FATAL') return null;

    const emittedAt = nowMs();
    const worldEventName = buildHealthWorldEvent(sev);
    const heat = severityToHeat(sev);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout: snapshot.healthScore < 0.2,
        haterRaidActive: sev === 'FATAL' || snapshot.saturation > 0.9,
      },
      metadata: {
        runId: snapshot.runId ?? 'null',
        tick: snapshot.tick ?? -1,
        healthScore: snapshot.healthScore,
        severity: snapshot.severity,
        openTraceCount: snapshot.openTraceCount,
        recentCheckpointCount: snapshot.recentCheckpointCount,
        eventQueueDepth: snapshot.eventQueueDepth,
        registryEngineCount: snapshot.registryEngineCount,
        saturation: snapshot.saturation,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateRunSummary(
    summary: QueryRunSummaryCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode === 'STRICT') return null;

    const emittedAt = nowMs();
    const worldEventName = buildRunSummaryWorldEvent(summary.runId);
    const heat = clamp01((1 - summary.avgHealthScore) * 0.6);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: false,
        haterRaidActive: summary.saturation > 0.85,
      },
      metadata: {
        runId: summary.runId ?? 'null',
        totalQueriesForRun: summary.totalQueriesForRun,
        openTraceCount: summary.openTraceCount,
        latestTick: summary.latestTick ?? -1,
        phase: summary.phase ?? 'null',
        mode: summary.mode ?? 'null',
        avgHealthScore: summary.avgHealthScore,
        saturation: summary.saturation,
        queryCount: summary.queryIds.length,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateMLVector(
    vector: QueryMLVectorCompat,
    runId: string | null,
    operation: QueryOperationKindCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode !== 'VERBOSE') return null;

    const emittedAt = nowMs();
    const worldEventName = `${QUERY_SIGNAL_WORLD_EVENT_PREFIX}:ml_vector:${operation.toLowerCase()}`;

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: clamp01(vector.serviceSaturation01) as Score01,
        helperBlackout: false,
        haterRaidActive: false,
      },
      metadata: {
        runId: runId ?? 'null',
        operation,
        mlVector: vector as unknown as JsonValue,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateTrend(
    trend: QueryTrendCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode === 'STRICT' && trend.avgHealthScore > 0.5) return null;

    const emittedAt = nowMs();
    const worldEventName = `${QUERY_SIGNAL_WORLD_EVENT_PREFIX}:trend:${trend.sessionId.slice(0, 8)}`;
    const heat = clamp01((1 - trend.avgHealthScore) * 0.4);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: trend.avgHealthScore < 0.3,
        haterRaidActive: false,
      },
      metadata: {
        sessionId: trend.sessionId,
        queriesPerMinute: trend.queriesPerMinute,
        avgHealthScore: trend.avgHealthScore,
        peakLatencyMs: trend.peakLatencyMs,
        totalOperations: trend.totalOperations,
        capturedAt: trend.capturedAt,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateSessionReport(
    session: QuerySessionCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode === 'STRICT') return null;

    const emittedAt = nowMs();
    const worldEventName = `${QUERY_SIGNAL_WORLD_EVENT_PREFIX}:session:${session.sessionId.slice(0, 8)}`;
    const heat = clamp01((1 - session.avgMLHealthScore) * 0.35);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: false,
        haterRaidActive: session.peakSaturation > 0.9,
      },
      metadata: {
        sessionId: session.sessionId,
        totalQueries: session.totalQueries,
        uniqueRunCount: session.uniqueRunIds.length,
        avgMLHealthScore: session.avgMLHealthScore,
        peakSaturation: session.peakSaturation,
        topOperation: session.topOperation ?? 'null',
        durationMs: session.durationMs,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public getMode(): RunQueryAdapterMode {
    return this.mode;
  }

  public isStrict(): boolean {
    return this.mode === 'STRICT';
  }

  public isVerbose(): boolean {
    return this.mode === 'VERBOSE';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS
// ─────────────────────────────────────────────────────────────────────────────

export const QUERY_DEFAULT_SIGNAL_ADAPTER = new RunQueryServiceSignalAdapter('DEFAULT');

export const QUERY_STRICT_SIGNAL_ADAPTER = new RunQueryServiceSignalAdapter('STRICT');

export const QUERY_VERBOSE_SIGNAL_ADAPTER = new RunQueryServiceSignalAdapter('VERBOSE');

export const QUERY_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  name:             'RunQueryServiceSignalAdapter',
  version:          QUERY_SIGNAL_ADAPTER_VERSION,
  schema:           QUERY_SIGNAL_ADAPTER_SCHEMA,
  ready:            QUERY_SIGNAL_ADAPTER_READY,
  mlFeatureCount:   QUERY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  maxHeat:          QUERY_SIGNAL_ADAPTER_MAX_HEAT,
  worldEventPrefix: QUERY_SIGNAL_WORLD_EVENT_PREFIX,
  modes:            ['DEFAULT', 'STRICT', 'VERBOSE'] as const,
});

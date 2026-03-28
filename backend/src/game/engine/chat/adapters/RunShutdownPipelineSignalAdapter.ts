// backend/src/game/engine/chat/adapters/RunShutdownPipelineSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/RunShutdownPipelineSignalAdapter.ts
 *
 * Translates RunShutdownPipeline signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * Prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Shutdown signals enter the chat lane at every significant pipeline operation.
 * They carry:
 *   - mode identity (solo / pvp / coop / ghost)
 *   - shutdown operation kind
 *   - health score (ML-derived [0,1])
 *   - severity (LOW / MEDIUM / HIGH / CRITICAL)
 *   - outcome (FREEDOM / TIMEOUT / BANKRUPT / ABANDONED)
 *   - run archive quality score
 *   - ML vector (32-dim) for real-time inference
 *   - narration key and urgency label for companion routing
 *
 * Chat doctrine:
 *   - LOW      → clean shutdown, companion acknowledgment fires
 *   - MEDIUM   → degraded shutdown, companion coaching fires
 *   - HIGH     → rescue-eligible, companion alarm fires, audience heat rises
 *   - CRITICAL → max heat, companion rescue fires, haterRaidActive = true
 *
 * Adapter modes:
 *   DEFAULT  — emits for all shutdown operations
 *   STRICT   — emits only for HIGH/CRITICAL severity
 *   VERBOSE  — emits for every operation including flushes; full ML vector
 *
 * Singletons:
 *   SHUTDOWN_DEFAULT_SIGNAL_ADAPTER
 *   SHUTDOWN_STRICT_SIGNAL_ADAPTER
 *   SHUTDOWN_VERBOSE_SIGNAL_ADAPTER
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

/** Structural compat for ShutdownSeverity. */
export type ShutdownSeverityCompat = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Structural compat for ShutdownOperationKind. */
export type ShutdownOperationKindCompat =
  | 'FLUSH_EVENTS'
  | 'FINALIZE_MODE'
  | 'SEAL_SOVEREIGNTY'
  | 'ARCHIVE_RUN'
  | 'EMIT_OUTCOME'
  | 'CLEANUP_TRACES'
  | 'PURGE_BUS'
  | 'CHECKPOINT_TERMINAL'
  | 'DRAIN_QUEUE'
  | 'FINALIZE_AUDIT';

/** Structural compat for ModeCode. */
type ModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for RunPhase. */
type RunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Structural compat for PressureTier. */
type PressureTierCompat = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/** Structural compat for RunOutcome. */
type RunOutcomeCompat = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/** Structural compat for ShutdownMLVector (32 fields). */
export interface ShutdownMLVectorCompat {
  readonly modeNormalized: number;
  readonly outcomeNormalized: number;
  readonly phaseNormalized: number;
  readonly pressureTierNormalized: number;
  readonly netWorthNormalized: number;
  readonly tickNormalized: number;
  readonly drainMagnitudeNormalized: number;
  readonly auditFlagCount: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly eventFlushCount: number;
  readonly traceCloseCount: number;
  readonly botThreatScore: number;
  readonly cascadeRatio: number;
  readonly battleActivityFlag: number;
  readonly sovereigntyScore: number;
  readonly archiveQualityScore: number;
  readonly shutdownDurationMs: number;
  readonly modeDifficultyNorm: number;
  readonly modeTensionFloor: number;
  readonly phaseStakesMultiplier: number;
  readonly pressureEscalationNorm: number;
  readonly shieldCapacityRemaining: number;
  readonly timingPriorityAvg: number;
  readonly deckPowerAvg: number;
  readonly cardRarityWeightAvg: number;
  readonly counterabilityAvg: number;
  readonly visibilityConcealment: number;
  readonly integrityRiskAvg: number;
  readonly verifiedGradeAvg: number;
  readonly attackMagnitudeAvg: number;
  readonly targetingSpreadAvg: number;
}

/** Structural compat for ShutdownDLTensorRow. */
export interface ShutdownDLTensorRowCompat {
  readonly label: string;
  readonly f0: number;
  readonly f1: number;
  readonly f2: number;
  readonly f3: number;
  readonly f4: number;
  readonly f5: number;
}

/** Structural compat for ShutdownDLTensor. */
export interface ShutdownDLTensorCompat {
  readonly shape: readonly [number, number];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly rows: readonly ShutdownDLTensorRowCompat[];
  readonly checksum: string;
}

/** Structural compat for ShutdownChatSignal (from zero/). */
export interface ShutdownSignalCompat {
  readonly kind: 'SHUTDOWN_SIGNAL';
  readonly runId: string;
  readonly mode: ModeCodeCompat;
  readonly outcome: RunOutcomeCompat | null;
  readonly operation: ShutdownOperationKindCompat;
  readonly severity: ShutdownSeverityCompat;
  readonly healthScore: number;
  readonly archiveQuality: number;
  readonly phase: RunPhaseCompat | null;
  readonly pressureTier: PressureTierCompat | null;
  readonly tick: number;
  readonly finalNetWorth: number;
  readonly sovereigntyScore: number;
  readonly eventsFlushed: number;
  readonly tracesSealed: number;
  readonly auditFlagCount: number;
  readonly actionRecommendation: string;
  readonly narrationKey: string;
  readonly mlVector: ShutdownMLVectorCompat;
  readonly timestampMs: number;
}

/** Structural compat for ShutdownAnnotationBundle. */
export interface ShutdownAnnotationCompat {
  readonly runId: string;
  readonly mode: ModeCodeCompat;
  readonly outcome: RunOutcomeCompat | null;
  readonly operation: ShutdownOperationKindCompat;
  readonly severity: ShutdownSeverityCompat;
  readonly healthScore: number;
  readonly archiveQuality: number;
  readonly phase: RunPhaseCompat | null;
  readonly pressureTier: PressureTierCompat | null;
  readonly sovereigntyScore: number;
  readonly primaryNarration: string;
  readonly actionRecommendation: string;
  readonly isTerminal: boolean;
  readonly auditFlagCount: number;
  readonly timestampMs: number;
}

/** Structural compat for ShutdownNarrationHint. */
export interface ShutdownNarrationCompat {
  readonly runId: string;
  readonly operation: ShutdownOperationKindCompat;
  readonly mode: ModeCodeCompat;
  readonly outcome: RunOutcomeCompat | null;
  readonly phase: RunPhaseCompat | null;
  readonly severity: ShutdownSeverityCompat;
  readonly headline: string;
  readonly urgencyLabel: string;
  readonly chatPrompt: string;
  readonly audienceHeatDelta: number;
  readonly rescueTrigger: boolean;
}

/** Structural compat for ShutdownTrendSnapshot. */
export interface ShutdownTrendCompat {
  readonly sessionId: string;
  readonly totalShutdowns: number;
  readonly avgHealthScore: number;
  readonly avgArchiveQuality: number;
  readonly outcomeBreakdown: Readonly<Record<string, number>>;
  readonly severityBreakdown: Readonly<Record<string, number>>;
  readonly capturedAt: number;
}

/** Structural compat for ShutdownSessionReport. */
export interface ShutdownSessionCompat {
  readonly sessionId: string;
  readonly totalShutdowns: number;
  readonly successRate: number;
  readonly avgArchiveQuality: number;
  readonly peakSeverityCount: number;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

/** Structural compat for ShutdownHealthSnapshot. */
export interface ShutdownHealthSnapshotCompat {
  readonly runId: string | null;
  readonly tick: number | null;
  readonly healthScore: number;
  readonly severity: ShutdownSeverityCompat;
  readonly archiveQuality: number;
  readonly sovereigntyScore: number;
  readonly auditFlagCount: number;
  readonly saturation: number;
  readonly capturedAt: number;
}

/** Structural compat for ShutdownRunSummary. */
export interface ShutdownRunSummaryCompat {
  readonly runId: string | null;
  readonly mode: ModeCodeCompat | null;
  readonly outcome: RunOutcomeCompat | null;
  readonly phase: RunPhaseCompat | null;
  readonly tick: number;
  readonly netWorth: number;
  readonly sovereigntyScore: number;
  readonly archiveQuality: number;
  readonly avgHealthScore: number;
  readonly eventsFlushed: number;
  readonly tracesSealed: number;
  readonly auditFlagCount: number;
  readonly saturation: number;
  readonly shutdownIds: readonly string[];
}

/** Result of a translate call including full diagnostics. */
export interface ShutdownTranslationResult {
  readonly emitted: boolean;
  readonly envelope: ChatInputEnvelope | null;
  readonly reason: string;
  readonly healthScore: number;
  readonly severity: ShutdownSeverityCompat;
  readonly mode: string;
  readonly outcome: string | null;
  readonly adapterMode: RunShutdownAdapterMode;
  readonly translatedAt: number;
}

export type RunShutdownAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const SHUTDOWN_SIGNAL_ADAPTER_VERSION         = '1.0.0' as const;
export const SHUTDOWN_SIGNAL_ADAPTER_READY           = true as const;
export const SHUTDOWN_SIGNAL_ADAPTER_SCHEMA          = 'shutdown-signal-adapter-v1' as const;
export const SHUTDOWN_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const SHUTDOWN_SIGNAL_ADAPTER_MAX_HEAT        = 1.0 as const;
export const SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX      = 'shutdown' as const;

// ─────────────────────────────────────────────────────────────────────────────
// WORLD EVENT KEY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildSignalWorldEvent(
  mode: ModeCodeCompat,
  outcome: RunOutcomeCompat | null,
  op: ShutdownOperationKindCompat,
): string {
  return `${SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:${outcome?.toLowerCase() ?? 'in_progress'}:${op.toLowerCase()}`;
}

function buildAnnotationWorldEvent(
  mode: ModeCodeCompat,
  op: ShutdownOperationKindCompat,
): string {
  return `${SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:annotation:${op.toLowerCase()}`;
}

function buildNarrationWorldEvent(
  mode: ModeCodeCompat,
  op: ShutdownOperationKindCompat,
): string {
  return `${SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:narration:${op.toLowerCase()}`;
}

function buildHealthWorldEvent(severity: ShutdownSeverityCompat): string {
  return `${SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX}:health:${severity.toLowerCase()}`;
}

function buildRunSummaryWorldEvent(
  mode: ModeCodeCompat,
  outcome: RunOutcomeCompat | null,
): string {
  return `${SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:run_summary:${outcome?.toLowerCase() ?? 'unknown'}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAT / SEVERITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function severityToHeat(severity: ShutdownSeverityCompat): Score01 {
  switch (severity) {
    case 'LOW':      return 0.1 as Score01;
    case 'MEDIUM':   return 0.45 as Score01;
    case 'HIGH':     return 0.75 as Score01;
    case 'CRITICAL': return 1.0 as Score01;
    default:         return 0.1 as Score01;
  }
}

function shouldEmit(
  signal: ShutdownSignalCompat,
  mode: RunShutdownAdapterMode,
): boolean {
  if (mode === 'VERBOSE') return true;
  if (mode === 'STRICT') {
    return signal.severity === 'HIGH' || signal.severity === 'CRITICAL';
  }
  // DEFAULT — emit for all operations
  return true;
}

function buildMetadata(
  signal: ShutdownSignalCompat,
  verbose: boolean,
): Record<string, JsonValue> {
  const base: Record<string, JsonValue> = {
    operation: signal.operation,
    severity: signal.severity,
    healthScore: signal.healthScore,
    archiveQuality: signal.archiveQuality,
    tick: signal.tick,
    finalNetWorth: signal.finalNetWorth,
    sovereigntyScore: signal.sovereigntyScore,
    eventsFlushed: signal.eventsFlushed,
    tracesSealed: signal.tracesSealed,
    auditFlagCount: signal.auditFlagCount,
    actionRecommendation: signal.actionRecommendation,
    narrationKey: signal.narrationKey,
    outcome: signal.outcome ?? 'null',
    phase: signal.phase ?? 'null',
    pressureTier: signal.pressureTier ?? 'null',
  };
  if (verbose) {
    base['mlVector'] = signal.mlVector as unknown as JsonValue;
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class RunShutdownPipelineSignalAdapter {
  private readonly mode: RunShutdownAdapterMode;

  public constructor(mode: RunShutdownAdapterMode = 'DEFAULT') {
    this.mode = mode;
  }

  public translate(
    signal: ShutdownSignalCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(signal, this.mode)) return null;

    const emittedAt = nowMs();
    const worldEventName = buildSignalWorldEvent(signal.mode, signal.outcome, signal.operation);
    const heat = severityToHeat(signal.severity);
    const haterRaid = signal.severity === 'CRITICAL';
    const helperBlackout = signal.healthScore < 0.2;

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
    signal: ShutdownSignalCompat,
    roomId?: ChatRoomId | null,
  ): ShutdownTranslationResult {
    const envelope = this.translate(signal, roomId);
    const emitted = envelope !== null;
    const reason = emitted
      ? `Shutdown signal emitted: ${signal.operation} severity=${signal.severity}`
      : `Shutdown signal suppressed by adapter mode=${this.mode}`;

    return Object.freeze({
      emitted,
      envelope,
      reason,
      healthScore: signal.healthScore,
      severity: signal.severity,
      mode: signal.mode,
      outcome: signal.outcome,
      adapterMode: this.mode,
      translatedAt: Date.now(),
    } satisfies ShutdownTranslationResult);
  }

  public translateAnnotation(
    annotation: ShutdownAnnotationCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    const sev = annotation.severity;
    if (this.mode === 'STRICT' && sev !== 'HIGH' && sev !== 'CRITICAL') return null;

    const emittedAt = nowMs();
    const worldEventName = buildAnnotationWorldEvent(annotation.mode, annotation.operation);
    const heat = severityToHeat(sev);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: clamp01(heat) as Score01,
        helperBlackout: annotation.healthScore < 0.2,
        haterRaidActive: sev === 'CRITICAL',
      },
      metadata: {
        runId: annotation.runId,
        operation: annotation.operation,
        severity: annotation.severity,
        healthScore: annotation.healthScore,
        archiveQuality: annotation.archiveQuality,
        sovereigntyScore: annotation.sovereigntyScore,
        primaryNarration: annotation.primaryNarration,
        actionRecommendation: annotation.actionRecommendation,
        isTerminal: annotation.isTerminal,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateNarrationHint(
    narration: ShutdownNarrationCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    const sev = narration.severity;
    if (this.mode === 'STRICT' && sev !== 'HIGH' && sev !== 'CRITICAL') return null;

    const emittedAt = nowMs();
    const worldEventName = buildNarrationWorldEvent(narration.mode, narration.operation);
    const heat = clamp01(
      severityToHeat(sev) + (narration.rescueTrigger ? 0.2 : 0),
    );

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: false,
        haterRaidActive: sev === 'CRITICAL',
      },
      metadata: {
        operation: narration.operation,
        mode: narration.mode,
        outcome: narration.outcome ?? 'null',
        phase: narration.phase ?? 'null',
        severity: narration.severity,
        headline: narration.headline,
        urgencyLabel: narration.urgencyLabel,
        chatPrompt: narration.chatPrompt,
        audienceHeatDelta: narration.audienceHeatDelta,
        rescueTrigger: narration.rescueTrigger,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateHealthSnapshot(
    snapshot: ShutdownHealthSnapshotCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    const sev = snapshot.severity;
    if (this.mode === 'STRICT' && sev !== 'HIGH' && sev !== 'CRITICAL') return null;

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
        haterRaidActive: sev === 'CRITICAL',
      },
      metadata: {
        runId: snapshot.runId ?? 'null',
        tick: snapshot.tick ?? -1,
        healthScore: snapshot.healthScore,
        severity: snapshot.severity,
        archiveQuality: snapshot.archiveQuality,
        sovereigntyScore: snapshot.sovereigntyScore,
        auditFlagCount: snapshot.auditFlagCount,
        saturation: snapshot.saturation,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateRunSummary(
    summary: ShutdownRunSummaryCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode === 'STRICT' && summary.avgHealthScore > 0.5) return null;

    const emittedAt = nowMs();
    const worldEventName = buildRunSummaryWorldEvent(
      summary.mode ?? 'solo',
      summary.outcome,
    );
    const heat = clamp01(1 - summary.archiveQuality);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: false,
        haterRaidActive: summary.outcome === 'BANKRUPT',
      },
      metadata: {
        runId: summary.runId ?? 'null',
        mode: summary.mode ?? 'null',
        outcome: summary.outcome ?? 'null',
        phase: summary.phase ?? 'null',
        tick: summary.tick,
        netWorth: summary.netWorth,
        sovereigntyScore: summary.sovereigntyScore,
        archiveQuality: summary.archiveQuality,
        avgHealthScore: summary.avgHealthScore,
        eventsFlushed: summary.eventsFlushed,
        tracesSealed: summary.tracesSealed,
        auditFlagCount: summary.auditFlagCount,
        saturation: summary.saturation,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateMLVector(
    vector: ShutdownMLVectorCompat,
    runId: string,
    operation: ShutdownOperationKindCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode !== 'VERBOSE') return null;

    const emittedAt = nowMs();
    const worldEventName = `${SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX}:ml_vector:${operation.toLowerCase()}`;

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: clamp01(vector.archiveQualityScore) as Score01,
        helperBlackout: false,
        haterRaidActive: false,
      },
      metadata: {
        runId,
        operation,
        mlVector: vector as unknown as JsonValue,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateTrend(
    trend: ShutdownTrendCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode === 'STRICT' && trend.avgHealthScore > 0.6) return null;

    const emittedAt = nowMs();
    const worldEventName = `${SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX}:trend:${trend.sessionId.slice(0, 8)}`;
    const heat = clamp01(1 - trend.avgHealthScore) * 0.5;

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
        totalShutdowns: trend.totalShutdowns,
        avgHealthScore: trend.avgHealthScore,
        avgArchiveQuality: trend.avgArchiveQuality,
        capturedAt: trend.capturedAt,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateSessionReport(
    session: ShutdownSessionCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode === 'STRICT') return null;

    const emittedAt = nowMs();
    const worldEventName = `${SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX}:session:${session.sessionId.slice(0, 8)}`;
    const heat = clamp01(1 - session.avgArchiveQuality) * 0.4;

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: false,
        haterRaidActive: session.peakSeverityCount > 3,
      },
      metadata: {
        sessionId: session.sessionId,
        totalShutdowns: session.totalShutdowns,
        successRate: session.successRate,
        avgArchiveQuality: session.avgArchiveQuality,
        peakSeverityCount: session.peakSeverityCount,
        durationMs: (session.endedAt ?? Date.now()) - session.startedAt,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public getMode(): RunShutdownAdapterMode {
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

export const SHUTDOWN_DEFAULT_SIGNAL_ADAPTER = new RunShutdownPipelineSignalAdapter('DEFAULT');

export const SHUTDOWN_STRICT_SIGNAL_ADAPTER = new RunShutdownPipelineSignalAdapter('STRICT');

export const SHUTDOWN_VERBOSE_SIGNAL_ADAPTER = new RunShutdownPipelineSignalAdapter('VERBOSE');

export const SHUTDOWN_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  name:             'RunShutdownPipelineSignalAdapter',
  version:          SHUTDOWN_SIGNAL_ADAPTER_VERSION,
  schema:           SHUTDOWN_SIGNAL_ADAPTER_SCHEMA,
  ready:            SHUTDOWN_SIGNAL_ADAPTER_READY,
  mlFeatureCount:   SHUTDOWN_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  maxHeat:          SHUTDOWN_SIGNAL_ADAPTER_MAX_HEAT,
  worldEventPrefix: SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX,
  modes:            ['DEFAULT', 'STRICT', 'VERBOSE'] as const,
});

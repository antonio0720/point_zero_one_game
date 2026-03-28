// backend/src/game/engine/chat/adapters/RuntimeCheckpointCoordinatorSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/RuntimeCheckpointCoordinatorSignalAdapter.ts
 *
 * Translates RuntimeCheckpointCoordinator signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * Prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Checkpoint signals enter the chat lane at every checkpoint capture, restore,
 * rollback, or terminal event.
 * They carry:
 *   - mode identity (solo / pvp / coop / ghost)
 *   - checkpoint reason (RUN_START / STEP_ENTRY / STEP_EXIT / TICK_FINAL / TERMINAL / MANUAL)
 *   - operation kind
 *   - health score (ML-derived [0,1])
 *   - severity (LOW / MEDIUM / HIGH / CRITICAL)
 *   - run phase and pressure tier
 *   - ML vector (32-dim) for real-time inference
 *   - narration key and urgency label for companion routing
 *
 * Chat doctrine:
 *   - LOW      → routine checkpoint, silent acknowledgment
 *   - MEDIUM   → notable checkpoint, companion notes it
 *   - HIGH     → critical save point, companion alerts player
 *   - CRITICAL → rollback urgency, companion rescue fires, max heat
 *
 * Adapter modes:
 *   DEFAULT  — emits for all checkpoint operations
 *   STRICT   — emits only for HIGH/CRITICAL severity
 *   VERBOSE  — emits for every operation; includes full ML vector
 *
 * Singletons:
 *   CHECKPOINT_DEFAULT_SIGNAL_ADAPTER
 *   CHECKPOINT_STRICT_SIGNAL_ADAPTER
 *   CHECKPOINT_VERBOSE_SIGNAL_ADAPTER
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

/** Structural compat for CheckpointSeverity. */
export type CheckpointSeverityCompat = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Structural compat for CheckpointOperationKind. */
export type CheckpointOperationKindCompat =
  | 'CAPTURE'
  | 'RESTORE'
  | 'ROLLBACK'
  | 'SUMMARIZE'
  | 'LIST_RUN'
  | 'LIST_TICK'
  | 'LATEST'
  | 'LATEST_FOR_STEP'
  | 'EVICT'
  | 'ARCHIVE';

/** Structural compat for RuntimeCheckpointReason. */
type CheckpointReasonCompat =
  | 'RUN_START'
  | 'STEP_ENTRY'
  | 'STEP_EXIT'
  | 'TICK_FINAL'
  | 'TERMINAL'
  | 'MANUAL';

/** Structural compat for ModeCode. */
type ModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for RunPhase. */
type RunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Structural compat for PressureTier. */
type PressureTierCompat = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/** Structural compat for RunOutcome. */
type RunOutcomeCompat = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/** Structural compat for CheckpointMLVector (32 fields). */
export interface CoordinatorMLVectorCompat {
  readonly checkpointCountNorm: number;
  readonly captureRateNorm: number;
  readonly restoreCountNorm: number;
  readonly rollbackCountNorm: number;
  readonly latencyMsNorm: number;
  readonly checksumDriftScore: number;
  readonly integrityScore: number;
  readonly replayFidelityScore: number;
  readonly coverageRatio: number;
  readonly reasonEntropyNorm: number;
  readonly phaseNormalized: number;
  readonly modeNormalized: number;
  readonly pressureTierNormalized: number;
  readonly tickNormalized: number;
  readonly outcomeRisk: number;
  readonly botThreatScore: number;
  readonly cascadeActivityRatio: number;
  readonly battleActivityFlag: number;
  readonly warningDensity: number;
  readonly sovereigntyScore: number;
  readonly shieldCapacityRemaining: number;
  readonly modeDifficultyNorm: number;
  readonly modeTensionFloor: number;
  readonly phaseStakesMultiplier: number;
  readonly pressureEscalationNorm: number;
  readonly timingPriorityAvg: number;
  readonly deckPowerAvg: number;
  readonly cardRarityWeightAvg: number;
  readonly counterabilityAvg: number;
  readonly integrityRiskAvg: number;
  readonly verifiedGradeAvg: number;
  readonly rollbackAvailability: number;
}

/** Structural compat for CheckpointDLTensorRow. */
export interface CoordinatorDLTensorRowCompat {
  readonly label: string;
  readonly f0: number;
  readonly f1: number;
  readonly f2: number;
  readonly f3: number;
  readonly f4: number;
  readonly f5: number;
}

/** Structural compat for CheckpointDLTensor. */
export interface CoordinatorDLTensorCompat {
  readonly shape: readonly [number, number];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly rows: readonly CoordinatorDLTensorRowCompat[];
  readonly checksum: string;
}

/** Structural compat for CheckpointChatSignal (from zero/). */
export interface CheckpointSignalCompat {
  readonly kind: 'CHECKPOINT_SIGNAL';
  readonly runId: string;
  readonly mode: ModeCodeCompat;
  readonly reason: CheckpointReasonCompat;
  readonly operation: CheckpointOperationKindCompat;
  readonly severity: CheckpointSeverityCompat;
  readonly healthScore: number;
  readonly phase: RunPhaseCompat | null;
  readonly pressureTier: PressureTierCompat | null;
  readonly outcome: RunOutcomeCompat | null;
  readonly tick: number;
  readonly checkpointCount: number;
  readonly integrityScore: number;
  readonly rollbackAvailable: boolean;
  readonly latencyMs: number;
  readonly actionRecommendation: string;
  readonly narrationKey: string;
  readonly mlVector: CoordinatorMLVectorCompat;
  readonly timestampMs: number;
}

/** Structural compat for CheckpointAnnotationBundle. */
export interface CheckpointAnnotationCompat {
  readonly runId: string;
  readonly mode: ModeCodeCompat;
  readonly reason: CheckpointReasonCompat;
  readonly operation: CheckpointOperationKindCompat;
  readonly severity: CheckpointSeverityCompat;
  readonly healthScore: number;
  readonly phase: RunPhaseCompat | null;
  readonly pressureTier: PressureTierCompat | null;
  readonly outcome: RunOutcomeCompat | null;
  readonly integrityScore: number;
  readonly rollbackAvailable: boolean;
  readonly primaryNarration: string;
  readonly actionRecommendation: string;
  readonly isTerminal: boolean;
  readonly timestampMs: number;
}

/** Structural compat for CheckpointNarrationHint. */
export interface CheckpointNarrationCompat {
  readonly runId: string;
  readonly operation: CheckpointOperationKindCompat;
  readonly reason: CheckpointReasonCompat;
  readonly mode: ModeCodeCompat;
  readonly phase: RunPhaseCompat | null;
  readonly severity: CheckpointSeverityCompat;
  readonly headline: string;
  readonly urgencyLabel: string;
  readonly chatPrompt: string;
  readonly audienceHeatDelta: number;
  readonly rescueTrigger: boolean;
}

/** Structural compat for CheckpointTrendSnapshot. */
export interface CheckpointTrendCompat {
  readonly sessionId: string;
  readonly totalCaptures: number;
  readonly avgHealthScore: number;
  readonly avgIntegrityScore: number;
  readonly rollbackRate: number;
  readonly severityBreakdown: Readonly<Record<string, number>>;
  readonly capturedAt: number;
}

/** Structural compat for CheckpointSessionReport. */
export interface CheckpointSessionCompat {
  readonly sessionId: string;
  readonly totalCaptures: number;
  readonly totalRestores: number;
  readonly totalRollbacks: number;
  readonly avgHealthScore: number;
  readonly peakLatencyMs: number;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

/** Structural compat for CheckpointHealthSnapshot. */
export interface CheckpointHealthSnapshotCompat {
  readonly runId: string | null;
  readonly tick: number | null;
  readonly healthScore: number;
  readonly severity: CheckpointSeverityCompat;
  readonly checkpointCount: number;
  readonly integrityScore: number;
  readonly rollbackAvailable: boolean;
  readonly latencyMs: number;
  readonly saturation: number;
  readonly capturedAt: number;
}

/** Structural compat for CheckpointRunSummary. */
export interface CheckpointRunSummaryCompat {
  readonly runId: string | null;
  readonly mode: ModeCodeCompat | null;
  readonly phase: RunPhaseCompat | null;
  readonly outcome: RunOutcomeCompat | null;
  readonly totalCaptures: number;
  readonly totalRestores: number;
  readonly totalRollbacks: number;
  readonly avgHealthScore: number;
  readonly avgIntegrityScore: number;
  readonly rollbackAvailable: boolean;
  readonly latestTick: number | null;
  readonly saturation: number;
  readonly checkpointIds: readonly string[];
}

/** Result of a translate call including full diagnostics. */
export interface CheckpointTranslationResult {
  readonly emitted: boolean;
  readonly envelope: ChatInputEnvelope | null;
  readonly reason: string;
  readonly healthScore: number;
  readonly severity: CheckpointSeverityCompat;
  readonly operation: CheckpointOperationKindCompat;
  readonly adapterMode: RuntimeCheckpointAdapterMode;
  readonly translatedAt: number;
}

export type RuntimeCheckpointAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const CHECKPOINT_SIGNAL_ADAPTER_VERSION         = '1.0.0' as const;
export const CHECKPOINT_SIGNAL_ADAPTER_READY           = true as const;
export const CHECKPOINT_SIGNAL_ADAPTER_SCHEMA          = 'checkpoint-signal-adapter-v1' as const;
export const CHECKPOINT_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const CHECKPOINT_SIGNAL_ADAPTER_MAX_HEAT        = 1.0 as const;
export const CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX      = 'checkpoint' as const;

// ─────────────────────────────────────────────────────────────────────────────
// WORLD EVENT KEY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildSignalWorldEvent(
  mode: ModeCodeCompat,
  reason: CheckpointReasonCompat,
  op: CheckpointOperationKindCompat,
): string {
  return `${CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:${reason.toLowerCase()}:${op.toLowerCase()}`;
}

function buildAnnotationWorldEvent(
  mode: ModeCodeCompat,
  op: CheckpointOperationKindCompat,
): string {
  return `${CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:annotation:${op.toLowerCase()}`;
}

function buildNarrationWorldEvent(
  mode: ModeCodeCompat,
  op: CheckpointOperationKindCompat,
): string {
  return `${CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:narration:${op.toLowerCase()}`;
}

function buildHealthWorldEvent(severity: CheckpointSeverityCompat): string {
  return `${CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX}:health:${severity.toLowerCase()}`;
}

function buildRunSummaryWorldEvent(
  mode: ModeCodeCompat,
  outcome: RunOutcomeCompat | null,
): string {
  return `${CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:run_summary:${outcome?.toLowerCase() ?? 'active'}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAT / SEVERITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function severityToHeat(severity: CheckpointSeverityCompat): Score01 {
  switch (severity) {
    case 'LOW':      return 0.1 as Score01;
    case 'MEDIUM':   return 0.4 as Score01;
    case 'HIGH':     return 0.72 as Score01;
    case 'CRITICAL': return 1.0 as Score01;
    default:         return 0.1 as Score01;
  }
}

function shouldEmit(
  signal: CheckpointSignalCompat,
  mode: RuntimeCheckpointAdapterMode,
): boolean {
  if (mode === 'VERBOSE') return true;
  if (mode === 'STRICT') {
    return signal.severity === 'HIGH' || signal.severity === 'CRITICAL';
  }
  return true;
}

function buildMetadata(
  signal: CheckpointSignalCompat,
  verbose: boolean,
): Record<string, JsonValue> {
  const base: Record<string, JsonValue> = {
    reason: signal.reason,
    operation: signal.operation,
    severity: signal.severity,
    healthScore: signal.healthScore,
    tick: signal.tick,
    checkpointCount: signal.checkpointCount,
    integrityScore: signal.integrityScore,
    rollbackAvailable: signal.rollbackAvailable,
    latencyMs: signal.latencyMs,
    actionRecommendation: signal.actionRecommendation,
    narrationKey: signal.narrationKey,
    phase: signal.phase ?? 'null',
    pressureTier: signal.pressureTier ?? 'null',
    outcome: signal.outcome ?? 'null',
  };
  if (verbose) {
    base['mlVector'] = signal.mlVector as unknown as JsonValue;
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class RuntimeCheckpointCoordinatorSignalAdapter {
  private readonly mode: RuntimeCheckpointAdapterMode;

  public constructor(mode: RuntimeCheckpointAdapterMode = 'DEFAULT') {
    this.mode = mode;
  }

  public translate(
    signal: CheckpointSignalCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(signal, this.mode)) return null;

    const emittedAt = nowMs();
    const worldEventName = buildSignalWorldEvent(signal.mode, signal.reason, signal.operation);
    const heat = severityToHeat(signal.severity);
    const haterRaid = signal.severity === 'CRITICAL' || !signal.rollbackAvailable;
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
    signal: CheckpointSignalCompat,
    roomId?: ChatRoomId | null,
  ): CheckpointTranslationResult {
    const envelope = this.translate(signal, roomId);
    const emitted = envelope !== null;
    const reason = emitted
      ? `Checkpoint signal emitted: ${signal.operation} reason=${signal.reason} severity=${signal.severity}`
      : `Checkpoint signal suppressed by adapter mode=${this.mode}`;

    return Object.freeze({
      emitted,
      envelope,
      reason,
      healthScore: signal.healthScore,
      severity: signal.severity,
      operation: signal.operation,
      adapterMode: this.mode,
      translatedAt: Date.now(),
    } satisfies CheckpointTranslationResult);
  }

  public translateAnnotation(
    annotation: CheckpointAnnotationCompat,
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
        reason: annotation.reason,
        operation: annotation.operation,
        severity: annotation.severity,
        healthScore: annotation.healthScore,
        integrityScore: annotation.integrityScore,
        rollbackAvailable: annotation.rollbackAvailable,
        primaryNarration: annotation.primaryNarration,
        actionRecommendation: annotation.actionRecommendation,
        isTerminal: annotation.isTerminal,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateNarrationHint(
    narration: CheckpointNarrationCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    const sev = narration.severity;
    if (this.mode === 'STRICT' && sev !== 'HIGH' && sev !== 'CRITICAL') return null;

    const emittedAt = nowMs();
    const worldEventName = buildNarrationWorldEvent(narration.mode, narration.operation);
    const heat = clamp01(severityToHeat(sev) + (narration.rescueTrigger ? 0.2 : 0));

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
        reason: narration.reason,
        mode: narration.mode,
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
    snapshot: CheckpointHealthSnapshotCompat,
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
        haterRaidActive: sev === 'CRITICAL' || !snapshot.rollbackAvailable,
      },
      metadata: {
        runId: snapshot.runId ?? 'null',
        tick: snapshot.tick ?? -1,
        healthScore: snapshot.healthScore,
        severity: snapshot.severity,
        checkpointCount: snapshot.checkpointCount,
        integrityScore: snapshot.integrityScore,
        rollbackAvailable: snapshot.rollbackAvailable,
        latencyMs: snapshot.latencyMs,
        saturation: snapshot.saturation,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateRunSummary(
    summary: CheckpointRunSummaryCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode === 'STRICT' && summary.avgHealthScore > 0.5) return null;

    const emittedAt = nowMs();
    const worldEventName = buildRunSummaryWorldEvent(
      summary.mode ?? 'solo',
      summary.outcome,
    );
    const heat = clamp01(1 - summary.avgIntegrityScore);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: false,
        haterRaidActive: !summary.rollbackAvailable && summary.outcome === 'BANKRUPT',
      },
      metadata: {
        runId: summary.runId ?? 'null',
        mode: summary.mode ?? 'null',
        phase: summary.phase ?? 'null',
        outcome: summary.outcome ?? 'null',
        totalCaptures: summary.totalCaptures,
        totalRestores: summary.totalRestores,
        totalRollbacks: summary.totalRollbacks,
        avgHealthScore: summary.avgHealthScore,
        avgIntegrityScore: summary.avgIntegrityScore,
        rollbackAvailable: summary.rollbackAvailable,
        latestTick: summary.latestTick ?? -1,
        saturation: summary.saturation,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateMLVector(
    vector: CoordinatorMLVectorCompat,
    runId: string,
    operation: CheckpointOperationKindCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode !== 'VERBOSE') return null;

    const emittedAt = nowMs();
    const worldEventName = `${CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX}:ml_vector:${operation.toLowerCase()}`;

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: clamp01(vector.integrityScore) as Score01,
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
    trend: CheckpointTrendCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode === 'STRICT' && trend.avgHealthScore > 0.6) return null;

    const emittedAt = nowMs();
    const worldEventName = `${CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX}:trend:${trend.sessionId.slice(0, 8)}`;
    const heat = clamp01((1 - trend.avgIntegrityScore) * 0.5 + trend.rollbackRate * 0.3);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: trend.avgHealthScore < 0.3,
        haterRaidActive: trend.rollbackRate > 0.5,
      },
      metadata: {
        sessionId: trend.sessionId,
        totalCaptures: trend.totalCaptures,
        avgHealthScore: trend.avgHealthScore,
        avgIntegrityScore: trend.avgIntegrityScore,
        rollbackRate: trend.rollbackRate,
        capturedAt: trend.capturedAt,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public translateSessionReport(
    session: CheckpointSessionCompat,
    roomId?: ChatRoomId | null,
  ): ChatInputEnvelope | null {
    if (this.mode === 'STRICT') return null;

    const emittedAt = nowMs();
    const worldEventName = `${CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX}:session:${session.sessionId.slice(0, 8)}`;
    const heat = clamp01((1 - session.avgHealthScore) * 0.4);

    const envelope: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt,
      roomId: roomId ?? null,
      liveops: {
        worldEventName,
        heatMultiplier01: heat as Score01,
        helperBlackout: false,
        haterRaidActive: session.totalRollbacks > 2,
      },
      metadata: {
        sessionId: session.sessionId,
        totalCaptures: session.totalCaptures,
        totalRestores: session.totalRestores,
        totalRollbacks: session.totalRollbacks,
        avgHealthScore: session.avgHealthScore,
        peakLatencyMs: session.peakLatencyMs,
        durationMs: (session.endedAt ?? Date.now()) - session.startedAt,
      } as Readonly<Record<string, JsonValue>>,
    };

    return { kind: 'LIVEOPS_SIGNAL', emittedAt, payload: envelope };
  }

  public getMode(): RuntimeCheckpointAdapterMode {
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

export const CHECKPOINT_DEFAULT_SIGNAL_ADAPTER =
  new RuntimeCheckpointCoordinatorSignalAdapter('DEFAULT');

export const CHECKPOINT_STRICT_SIGNAL_ADAPTER =
  new RuntimeCheckpointCoordinatorSignalAdapter('STRICT');

export const CHECKPOINT_VERBOSE_SIGNAL_ADAPTER =
  new RuntimeCheckpointCoordinatorSignalAdapter('VERBOSE');

export const CHECKPOINT_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  name:             'RuntimeCheckpointCoordinatorSignalAdapter',
  version:          CHECKPOINT_SIGNAL_ADAPTER_VERSION,
  schema:           CHECKPOINT_SIGNAL_ADAPTER_SCHEMA,
  ready:            CHECKPOINT_SIGNAL_ADAPTER_READY,
  mlFeatureCount:   CHECKPOINT_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  maxHeat:          CHECKPOINT_SIGNAL_ADAPTER_MAX_HEAT,
  worldEventPrefix: CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX,
  modes:            ['DEFAULT', 'STRICT', 'VERBOSE'] as const,
});

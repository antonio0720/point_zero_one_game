// backend/src/game/engine/chat/adapters/TickExecutorSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/TickExecutorSignalAdapter.ts
 *
 * Translates TickExecutor signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * Prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Tick executor signals enter the chat lane whenever the executor detects
 * step rollbacks, shield breaches, bot threat spikes, outcome gate triggers,
 * cascade chain instability, or integrity risk crossing severity thresholds.
 * They carry:
 *   - operation kind (EXECUTE / ROLLBACK / FLUSH / SEAL / OUTCOME_GATE / NOOP)
 *   - severity (LOW / MEDIUM / HIGH / CRITICAL)
 *   - health score (ML-derived [0,1])
 *   - per-step DL tensor for 13-step tick profile
 *   - 32-dim ML feature vector for real-time inference
 *   - narration phrase and urgency label for companion routing
 *   - run/tick context for downstream routing
 *
 * Chat doctrine:
 *   - LOW      → tick executed normally, companion advisory optional
 *   - MEDIUM   → anomaly detected, companion coaching fires on first occurrence
 *   - HIGH     → shield/bot/cascade issue active, companion escalates
 *   - CRITICAL → integrity risk or multi-rollback, rescue + max heat fires
 *
 * Adapter modes:
 *   DEFAULT  — emits for MEDIUM/HIGH/CRITICAL only
 *   STRICT   — emits only for HIGH/CRITICAL
 *   VERBOSE  — emits for all tick operations including LOW; full ML vector
 *
 * Singletons:
 *   TICK_EXECUTOR_DEFAULT_SIGNAL_ADAPTER
 *   TICK_EXECUTOR_STRICT_SIGNAL_ADAPTER
 *   TICK_EXECUTOR_VERBOSE_SIGNAL_ADAPTER
 *   TICK_EXECUTOR_SIGNAL_ADAPTER_MANIFEST
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

/** Structural compat for TickExecutorSeverity. */
export type TickExecutorSeverityCompat = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Structural compat for TickExecutorOperationKind. */
export type TickExecutorOperationKindCompat =
  | 'EXECUTE'
  | 'ROLLBACK'
  | 'FLUSH'
  | 'SEAL'
  | 'OUTCOME_GATE'
  | 'NOOP';

/** Structural compat for ModeCode. */
type ModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for RunPhase. */
type RunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Structural compat for PressureTier. */
type PressureTierCompat = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/** Structural compat for RunOutcome. */
type RunOutcomeCompat = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/** Structural compat for TickStep. */
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

/** Structural compat for TickExecutorMLVector (32 fields). */
export interface TickExecutorMLVectorCompat {
  readonly tickNorm01: number;
  readonly durationNorm01: number;
  readonly stepCountNorm01: number;
  readonly rolledBackCountNorm01: number;
  readonly errorSignalRatio: number;
  readonly warnSignalRatio: number;
  readonly outcomeWeight: number;
  readonly modeNorm01: number;
  readonly pressureTierNorm01: number;
  readonly phaseNorm01: number;
  readonly pressureScoreNorm01: number;
  readonly netWorthNorm01: number;
  readonly modeTensionFloor: number;
  readonly modeDifficultyNorm01: number;
  readonly modeMaxDivergenceNorm: number;
  readonly shieldAggregateNorm01: number;
  readonly shieldBreachRatio: number;
  readonly botThreatScoreNorm01: number;
  readonly botActiveFraction: number;
  readonly pendingAttackNorm01: number;
  readonly cascadeActiveNorm01: number;
  readonly cascadePositiveRatio: number;
  readonly eventCountNorm01: number;
  readonly eventChecksumPresent: number;
  readonly outcomeGateTriggered: number;
  readonly flushCoordinatorActive: number;
  readonly diagnosticsActive: number;
  readonly integrityRiskNorm01: number;
  readonly verifiedGradeNorm01: number;
  readonly stakesMultiplierNorm01: number;
  readonly tickBudgetFractionUsed: number;
  readonly signalCountNorm01: number;
}

/** Structural compat for TickExecutorDLTensorRow (8 fields). */
export interface TickExecutorDLTensorRowCompat {
  readonly enabled: number;
  readonly durationNorm: number;
  readonly rolledBack: number;
  readonly signalCountNorm: number;
  readonly errorPresent: number;
  readonly warnPresent: number;
  readonly outputChanged: number;
  readonly ownerEncoded: number;
}

/** Structural compat for TickExecutorDLTensor (13×8). */
export interface TickExecutorDLTensorCompat {
  readonly shape: readonly [number, number];
  readonly rowLabels: readonly TickStepCompat[];
  readonly colLabels: readonly string[];
  readonly rows: readonly (readonly [string, TickExecutorDLTensorRowCompat])[];
  readonly checksum: string;
}

/** Structural compat for TickExecutorChatSignal. */
export interface TickExecutorSignalCompat {
  readonly kind: 'TICK_EXECUTOR_SIGNAL';
  readonly operationKind: TickExecutorOperationKindCompat;
  readonly severity: TickExecutorSeverityCompat;
  readonly healthScore: number;
  readonly tick: number;
  readonly runId: string;
  readonly mode: ModeCodeCompat;
  readonly phase: RunPhaseCompat;
  readonly pressure: PressureTierCompat;
  readonly outcome: RunOutcomeCompat | null;
  readonly rolledBackSteps: number;
  readonly errorSignals: number;
  readonly warnSignals: number;
  readonly shieldBreached: boolean;
  readonly botThreatHigh: boolean;
  readonly cascadeActive: boolean;
  readonly eventChecksum: string | null;
  readonly durationMs: number;
  readonly narration: string;
  readonly recommendation: string;
  readonly mlVector: TickExecutorMLVectorCompat;
  readonly timestampMs: number;
}

/** Structural compat for TickExecutorAnnotationBundle. */
export interface TickExecutorAnnotationCompat {
  readonly annotationId: string;
  readonly tick: number;
  readonly runId: string;
  readonly checksum: string;
  readonly severity: TickExecutorSeverityCompat;
  readonly operationKind: TickExecutorOperationKindCompat;
  readonly narration: string;
  readonly recommendation: string;
  readonly tags: readonly string[];
  readonly createdAtMs: number;
}

/** Structural compat for TickExecutorNarrationHint. */
export interface TickExecutorNarrationCompat {
  readonly tick: number;
  readonly runId: string;
  readonly mode: ModeCodeCompat;
  readonly severity: TickExecutorSeverityCompat;
  readonly phrase: string;
  readonly urgency: string;
  readonly context: string;
  readonly flags: readonly string[];
}

/** Structural compat for TickExecutorTrendSnapshot. */
export interface TickExecutorTrendCompat {
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly avgDurationMs: number;
  readonly avgRolledBackCount: number;
  readonly avgErrorSignalRatio: number;
  readonly avgPressureTierNorm: number;
  readonly avgBotThreatNorm: number;
  readonly trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly capturedAtMs: number;
}

/** Structural compat for TickExecutorSessionReport. */
export interface TickExecutorSessionCompat {
  readonly sessionId: string;
  readonly runId: string;
  readonly ticksRecorded: number;
  readonly totalDurationMs: number;
  readonly totalRolledBackSteps: number;
  readonly totalErrorSignals: number;
  readonly totalWarnSignals: number;
  readonly outcomeFirstSeenTick: number | null;
  readonly outcomeValue: RunOutcomeCompat | null;
  readonly avgHealthScore: number;
  readonly peakPressureTier: PressureTierCompat;
  readonly startedAtMs: number;
  readonly lastUpdatedMs: number;
}

/** Structural compat for TickExecutorHealthSnapshot. */
export interface TickExecutorHealthSnapshotCompat {
  readonly score: number;
  readonly severity: TickExecutorSeverityCompat;
  readonly rolledBackSteps: number;
  readonly errorSignals: number;
  readonly warnSignals: number;
  readonly shieldBreached: boolean;
  readonly botThreatHigh: boolean;
  readonly cascadeActive: boolean;
  readonly outcomePresent: boolean;
  readonly integrityRisk: number;
  readonly durationMs: number;
  readonly tick: number;
  readonly timestamp: number;
}

/** Structural compat for TickExecutorRunSummary. */
export interface TickExecutorRunSummaryCompat {
  readonly runId: string;
  readonly totalTicks: number;
  readonly totalDurationMs: number;
  readonly avgTickDurationMs: number;
  readonly totalRolledBackSteps: number;
  readonly totalErrorSignals: number;
  readonly peakPressureTier: PressureTierCompat;
  readonly finalMode: ModeCodeCompat;
  readonly finalPhase: RunPhaseCompat;
  readonly finalOutcome: RunOutcomeCompat | null;
  readonly avgHealthScore: number;
  readonly tags: readonly string[];
}

/** Result of a translate call. */
export interface TickExecutorTranslationResult {
  readonly emitted: boolean;
  readonly envelope: ChatInputEnvelope | null;
  readonly reason: string;
  readonly healthScore: number;
  readonly severity: TickExecutorSeverityCompat;
  readonly operationKind: TickExecutorOperationKindCompat;
  readonly adapterMode: TickExecutorAdapterMode;
  readonly translatedAt: number;
}

export type TickExecutorAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

/** Adapter manifest for registry and diagnostics. */
export interface TickExecutorSignalAdapterManifest {
  readonly adapterId: string;
  readonly adapterName: string;
  readonly version: string;
  readonly schema: string;
  readonly mode: TickExecutorAdapterMode;
  readonly mlFeatureCount: number;
  readonly dlTensorShape: readonly [number, number];
  readonly emitsOnLow: boolean;
  readonly emitsOnMedium: boolean;
  readonly emitsOnHigh: boolean;
  readonly emitsOnCritical: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_EXECUTOR_SIGNAL_ADAPTER_VERSION = '1.0.2026' as const;
export const TICK_EXECUTOR_SIGNAL_ADAPTER_READY = true as const;
export const TICK_EXECUTOR_SIGNAL_ADAPTER_SCHEMA = 'tick-executor-signal-adapter-v1' as const;
export const TICK_EXECUTOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const TICK_EXECUTOR_SIGNAL_ADAPTER_DL_TENSOR_SHAPE = Object.freeze([13, 8] as const);
export const TICK_EXECUTOR_SIGNAL_ADAPTER_MAX_HEAT = 1.0 as const;
export const TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX = 'tick_executor' as const;

// ─────────────────────────────────────────────────────────────────────────────
// WORLD EVENT KEY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildSignalWorldEvent(
  op: TickExecutorOperationKindCompat,
  sev: TickExecutorSeverityCompat,
): string {
  return `${TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX}:${op.toLowerCase()}:${sev.toLowerCase()}`;
}

function buildAnnotationWorldEvent(op: TickExecutorOperationKindCompat): string {
  return `${TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX}:annotation:${op.toLowerCase()}`;
}

function buildNarrationWorldEvent(op: TickExecutorOperationKindCompat): string {
  return `${TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX}:narration:${op.toLowerCase()}`;
}

function buildHealthWorldEvent(severity: TickExecutorSeverityCompat): string {
  return `${TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX}:health:${severity.toLowerCase()}`;
}

function buildRunSummaryWorldEvent(runId: string): string {
  return `${TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX}:run_summary:${runId.slice(0, 8)}`;
}

function buildTrendWorldEvent(trend: TickExecutorTrendCompat['trend']): string {
  return `${TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX}:trend:${trend.toLowerCase()}`;
}

function buildSessionWorldEvent(sessionId: string): string {
  return `${TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX}:session:${sessionId.slice(0, 8)}`;
}

function buildDLTensorWorldEvent(step: TickStepCompat): string {
  return `${TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX}:dl_tensor:${step.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAT / SEVERITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function severityToHeat(severity: TickExecutorSeverityCompat): Score01 {
  switch (severity) {
    case 'LOW':      return 0.05 as Score01;
    case 'MEDIUM':   return 0.38 as Score01;
    case 'HIGH':     return 0.72 as Score01;
    case 'CRITICAL': return 1.0 as Score01;
    default:         return 0.05 as Score01;
  }
}

function shouldEmit(
  severity: TickExecutorSeverityCompat,
  mode: TickExecutorAdapterMode,
): boolean {
  if (mode === 'VERBOSE') return true;
  if (mode === 'STRICT') {
    return severity === 'HIGH' || severity === 'CRITICAL';
  }
  // DEFAULT — emit for MEDIUM and above
  return severity !== 'LOW';
}

function operationKindToChatLane(op: TickExecutorOperationKindCompat): string {
  switch (op) {
    case 'EXECUTE':      return 'LIVEOPS_EXECUTE';
    case 'ROLLBACK':     return 'LIVEOPS_ALERT';
    case 'FLUSH':        return 'LIVEOPS_FLUSH';
    case 'SEAL':         return 'LIVEOPS_SEAL';
    case 'OUTCOME_GATE': return 'LIVEOPS_OUTCOME';
    case 'NOOP':         return 'LIVEOPS_NOOP';
    default:             return 'LIVEOPS_SIGNAL';
  }
}

function buildSignalMetadata(
  signal: TickExecutorSignalCompat,
  verbose: boolean,
): Record<string, JsonValue> {
  const base: Record<string, JsonValue> = {
    operationKind: signal.operationKind,
    severity: signal.severity,
    healthScore: signal.healthScore,
    tick: signal.tick,
    runId: signal.runId,
    mode: signal.mode,
    phase: signal.phase,
    pressure: signal.pressure,
    outcome: signal.outcome ?? 'null',
    rolledBackSteps: signal.rolledBackSteps,
    errorSignals: signal.errorSignals,
    warnSignals: signal.warnSignals,
    shieldBreached: signal.shieldBreached,
    botThreatHigh: signal.botThreatHigh,
    cascadeActive: signal.cascadeActive,
    eventChecksum: signal.eventChecksum ?? 'null',
    durationMs: signal.durationMs,
    narration: signal.narration,
    recommendation: signal.recommendation,
  };

  if (verbose) {
    const mv = signal.mlVector;
    base['ml_tickNorm01'] = mv.tickNorm01;
    base['ml_durationNorm01'] = mv.durationNorm01;
    base['ml_stepCountNorm01'] = mv.stepCountNorm01;
    base['ml_rolledBackCountNorm01'] = mv.rolledBackCountNorm01;
    base['ml_errorSignalRatio'] = mv.errorSignalRatio;
    base['ml_warnSignalRatio'] = mv.warnSignalRatio;
    base['ml_outcomeWeight'] = mv.outcomeWeight;
    base['ml_modeNorm01'] = mv.modeNorm01;
    base['ml_pressureTierNorm01'] = mv.pressureTierNorm01;
    base['ml_phaseNorm01'] = mv.phaseNorm01;
    base['ml_pressureScoreNorm01'] = mv.pressureScoreNorm01;
    base['ml_netWorthNorm01'] = mv.netWorthNorm01;
    base['ml_modeTensionFloor'] = mv.modeTensionFloor;
    base['ml_modeDifficultyNorm01'] = mv.modeDifficultyNorm01;
    base['ml_modeMaxDivergenceNorm'] = mv.modeMaxDivergenceNorm;
    base['ml_shieldAggregateNorm01'] = mv.shieldAggregateNorm01;
    base['ml_shieldBreachRatio'] = mv.shieldBreachRatio;
    base['ml_botThreatScoreNorm01'] = mv.botThreatScoreNorm01;
    base['ml_botActiveFraction'] = mv.botActiveFraction;
    base['ml_pendingAttackNorm01'] = mv.pendingAttackNorm01;
    base['ml_cascadeActiveNorm01'] = mv.cascadeActiveNorm01;
    base['ml_cascadePositiveRatio'] = mv.cascadePositiveRatio;
    base['ml_eventCountNorm01'] = mv.eventCountNorm01;
    base['ml_eventChecksumPresent'] = mv.eventChecksumPresent;
    base['ml_outcomeGateTriggered'] = mv.outcomeGateTriggered;
    base['ml_flushCoordinatorActive'] = mv.flushCoordinatorActive;
    base['ml_diagnosticsActive'] = mv.diagnosticsActive;
    base['ml_integrityRiskNorm01'] = mv.integrityRiskNorm01;
    base['ml_verifiedGradeNorm01'] = mv.verifiedGradeNorm01;
    base['ml_stakesMultiplierNorm01'] = mv.stakesMultiplierNorm01;
    base['ml_tickBudgetFractionUsed'] = mv.tickBudgetFractionUsed;
    base['ml_signalCountNorm01'] = mv.signalCountNorm01;
  }

  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class TickExecutorSignalAdapter {
  public constructor(
    private readonly _mode: TickExecutorAdapterMode = 'DEFAULT',
    private readonly _roomId: ChatRoomId = 'liveops' as ChatRoomId,
  ) {}

  // ── primary translate surface ─────────────────────────────────────────────

  /**
   * Translates a TickExecutorSignalCompat into a ChatInputEnvelope if the
   * severity meets this adapter's emission threshold.
   */
  public translate(
    signal: TickExecutorSignalCompat,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): ChatInputEnvelope | null {
    if (!shouldEmit(signal.severity, this._mode)) {
      return null;
    }

    const ts = options?.nowOverride ?? nowMs();
    const roomId = options?.roomId ?? this._roomId;
    const heat = severityToHeat(signal.severity);
    const worldEvent = buildSignalWorldEvent(signal.operationKind, signal.severity);
    const lane = operationKindToChatLane(signal.operationKind);
    const verbose = this._mode === 'VERBOSE';

    const signalMeta: Record<string, JsonValue> = {
      ...buildSignalMetadata(signal, verbose),
      _id: `tick_executor:${signal.runId}:${signal.tick}:${signal.operationKind}:${ts}`,
      _lane: lane,
      _actorId: (options?.actorId ?? null) as JsonValue,
    };

    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: false,
          haterRaidActive: signal.severity === 'CRITICAL',
        }),
        metadata: Object.freeze(signalMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });

    return envelope;
  }

  /**
   * Translates with full result diagnostics (always runs, emitted flag tells
   * caller whether the envelope should be forwarded).
   */
  public translateWithResult(
    signal: TickExecutorSignalCompat,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): TickExecutorTranslationResult {
    const ts = options?.nowOverride ?? nowMs();
    const envelope = this.translate(signal, { ...options, nowOverride: ts as UnixMs });
    const emitted = envelope !== null;
    const reason = emitted
      ? `Emitted: severity=${signal.severity} mode=${this._mode}`
      : `Suppressed: severity=${signal.severity} below ${this._mode} threshold`;

    return Object.freeze({
      emitted,
      envelope,
      reason,
      healthScore: signal.healthScore,
      severity: signal.severity,
      operationKind: signal.operationKind,
      adapterMode: this._mode,
      translatedAt: ts,
    });
  }

  /**
   * Translates a TickExecutorAnnotationCompat into a chat input envelope.
   */
  public translateAnnotation(
    annotation: TickExecutorAnnotationCompat,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): ChatInputEnvelope | null {
    if (!shouldEmit(annotation.severity, this._mode)) {
      return null;
    }

    const ts = options?.nowOverride ?? nowMs();
    const roomId = options?.roomId ?? this._roomId;
    const heat = severityToHeat(annotation.severity);
    const worldEvent = buildAnnotationWorldEvent(annotation.operationKind);

    const annotationMeta: Record<string, JsonValue> = {
      annotationId: annotation.annotationId,
      tick: annotation.tick,
      runId: annotation.runId,
      checksum: annotation.checksum,
      severity: annotation.severity,
      operationKind: annotation.operationKind,
      narration: annotation.narration,
      recommendation: annotation.recommendation,
      tags: annotation.tags as unknown as JsonValue,
      _id: `tick_executor:annotation:${annotation.annotationId}:${ts}`,
      _lane: 'LIVEOPS_ANNOTATION',
      _actorId: (options?.actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: false,
          haterRaidActive: annotation.severity === 'CRITICAL',
        }),
        metadata: Object.freeze(annotationMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickExecutorNarrationCompat into a chat input envelope.
   */
  public translateNarrationHint(
    narration: TickExecutorNarrationCompat,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): ChatInputEnvelope | null {
    if (!shouldEmit(narration.severity, this._mode)) {
      return null;
    }

    const ts = options?.nowOverride ?? nowMs();
    const roomId = options?.roomId ?? this._roomId;
    const heat = severityToHeat(narration.severity);
    const worldEvent = buildNarrationWorldEvent('EXECUTE');

    const narrationMeta: Record<string, JsonValue> = {
      tick: narration.tick,
      runId: narration.runId,
      mode: narration.mode,
      severity: narration.severity,
      phrase: narration.phrase,
      urgency: narration.urgency,
      context: narration.context,
      flags: narration.flags as unknown as JsonValue,
      _id: `tick_executor:narration:${narration.runId}:${narration.tick}:${ts}`,
      _lane: 'LIVEOPS_NARRATION',
      _actorId: (options?.actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: narration.severity === 'CRITICAL',
          haterRaidActive: false,
        }),
        metadata: Object.freeze(narrationMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickExecutorHealthSnapshotCompat into a chat input envelope.
   */
  public translateHealthSnapshot(
    health: TickExecutorHealthSnapshotCompat,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): ChatInputEnvelope | null {
    if (!shouldEmit(health.severity, this._mode)) {
      return null;
    }

    const ts = options?.nowOverride ?? nowMs();
    const roomId = options?.roomId ?? this._roomId;
    const heat = severityToHeat(health.severity);
    const worldEvent = buildHealthWorldEvent(health.severity);

    const payload: Record<string, JsonValue> = {
      score: health.score,
      severity: health.severity,
      rolledBackSteps: health.rolledBackSteps,
      errorSignals: health.errorSignals,
      warnSignals: health.warnSignals,
      shieldBreached: health.shieldBreached,
      botThreatHigh: health.botThreatHigh,
      cascadeActive: health.cascadeActive,
      outcomePresent: health.outcomePresent,
      integrityRisk: health.integrityRisk,
      durationMs: health.durationMs,
      tick: health.tick,
      timestamp: health.timestamp,
    };

    const healthMeta: Record<string, JsonValue> = {
      ...payload,
      _id: `tick_executor:health:${health.tick}:${ts}`,
      _lane: 'LIVEOPS_HEALTH',
      _actorId: (options?.actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: health.severity === 'CRITICAL',
          haterRaidActive: health.botThreatHigh && health.shieldBreached,
        }),
        metadata: Object.freeze(healthMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickExecutorRunSummaryCompat into a chat input envelope.
   * Always emits regardless of severity threshold (run summaries are terminal).
   */
  public translateRunSummary(
    summary: TickExecutorRunSummaryCompat,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): ChatInputEnvelope {
    const ts = options?.nowOverride ?? nowMs();
    const roomId = options?.roomId ?? this._roomId;
    const worldEvent = buildRunSummaryWorldEvent(summary.runId);

    // Run summary heat is based on avgHealthScore inverted as risk
    const riskScore = clamp01(1 - summary.avgHealthScore) as Score01;

    const payload: Record<string, JsonValue> = {
      runId: summary.runId,
      totalTicks: summary.totalTicks,
      totalDurationMs: summary.totalDurationMs,
      avgTickDurationMs: summary.avgTickDurationMs,
      totalRolledBackSteps: summary.totalRolledBackSteps,
      totalErrorSignals: summary.totalErrorSignals,
      peakPressureTier: summary.peakPressureTier,
      finalMode: summary.finalMode,
      finalPhase: summary.finalPhase,
      finalOutcome: summary.finalOutcome ?? 'null',
      avgHealthScore: summary.avgHealthScore,
      tags: summary.tags as unknown as JsonValue,
    };

    const summaryMeta: Record<string, JsonValue> = {
      ...payload,
      _id: `tick_executor:run_summary:${summary.runId}:${ts}`,
      _lane: 'LIVEOPS_RUN_SUMMARY',
      _actorId: (options?.actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: riskScore,
          helperBlackout: false,
          haterRaidActive: (summary.finalOutcome === 'BANKRUPT' || riskScore > 0.8),
        }),
        metadata: Object.freeze(summaryMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickExecutorTrendCompat into a chat input envelope.
   */
  public translateTrend(
    trend: TickExecutorTrendCompat,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): ChatInputEnvelope | null {
    // Trend signals always emit for DEGRADING, only in VERBOSE mode for IMPROVING/STABLE
    const isDegrading = trend.trend === 'DEGRADING';
    if (!isDegrading && this._mode !== 'VERBOSE') {
      return null;
    }

    const ts = options?.nowOverride ?? nowMs();
    const roomId = options?.roomId ?? this._roomId;
    const worldEvent = buildTrendWorldEvent(trend.trend);
    const heat = isDegrading
      ? clamp01(0.5 + (1 - trend.avgHealthScore) * 0.5) as Score01
      : 0.1 as Score01;

    const payload: Record<string, JsonValue> = {
      windowSize: trend.windowSize,
      avgHealthScore: trend.avgHealthScore,
      avgDurationMs: trend.avgDurationMs,
      avgRolledBackCount: trend.avgRolledBackCount,
      avgErrorSignalRatio: trend.avgErrorSignalRatio,
      avgPressureTierNorm: trend.avgPressureTierNorm,
      avgBotThreatNorm: trend.avgBotThreatNorm,
      trend: trend.trend,
      capturedAtMs: trend.capturedAtMs,
    };

    const trendMeta: Record<string, JsonValue> = {
      ...payload,
      _id: `tick_executor:trend:${trend.trend}:${ts}`,
      _lane: 'LIVEOPS_TREND',
      _actorId: (options?.actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: heat,
          helperBlackout: false,
          haterRaidActive: trend.trend === 'DEGRADING' && trend.avgHealthScore < 0.25,
        }),
        metadata: Object.freeze(trendMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickExecutorSessionCompat into a chat input envelope.
   */
  public translateSession(
    session: TickExecutorSessionCompat,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): ChatInputEnvelope | null {
    // Session signals only emit in VERBOSE mode, or when there are errors
    if (this._mode !== 'VERBOSE' && session.totalErrorSignals === 0) {
      return null;
    }

    const ts = options?.nowOverride ?? nowMs();
    const roomId = options?.roomId ?? this._roomId;
    const worldEvent = buildSessionWorldEvent(session.sessionId);
    const heat = clamp01(
      (1 - session.avgHealthScore) * 0.6 +
        (session.totalErrorSignals / Math.max(1, session.ticksRecorded)) * 0.4,
    ) as Score01;

    const payload: Record<string, JsonValue> = {
      sessionId: session.sessionId,
      runId: session.runId,
      ticksRecorded: session.ticksRecorded,
      totalDurationMs: session.totalDurationMs,
      totalRolledBackSteps: session.totalRolledBackSteps,
      totalErrorSignals: session.totalErrorSignals,
      totalWarnSignals: session.totalWarnSignals,
      outcomeFirstSeenTick: session.outcomeFirstSeenTick ?? -1,
      outcomeValue: session.outcomeValue ?? 'null',
      avgHealthScore: session.avgHealthScore,
      peakPressureTier: session.peakPressureTier,
      startedAtMs: session.startedAtMs,
      lastUpdatedMs: session.lastUpdatedMs,
    };

    const sessionMeta: Record<string, JsonValue> = {
      ...payload,
      _id: `tick_executor:session:${session.sessionId}:${ts}`,
      _lane: 'LIVEOPS_SESSION',
      _actorId: (options?.actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: heat,
          helperBlackout: false,
          haterRaidActive: session.totalErrorSignals > 3,
        }),
        metadata: Object.freeze(sessionMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickExecutorDLTensorCompat step row into a chat envelope.
   * Used for per-step anomaly routing when a specific step is hot.
   */
  public translateDLTensorRow(
    row: TickExecutorDLTensorRowCompat,
    step: TickStepCompat,
    tick: number,
    runId: string,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): ChatInputEnvelope | null {
    // Only emit if the row shows an error or rollback
    const hasAnomaly = row.errorPresent > 0.5 || row.rolledBack > 0.5;
    if (!hasAnomaly && this._mode !== 'VERBOSE') {
      return null;
    }

    const ts = options?.nowOverride ?? nowMs();
    const roomId = options?.roomId ?? this._roomId;
    const worldEvent = buildDLTensorWorldEvent(step);
    const heat = clamp01(
      row.errorPresent * 0.5 + row.rolledBack * 0.4 + row.signalCountNorm * 0.1,
    ) as Score01;

    const payload: Record<string, JsonValue> = {
      step,
      tick,
      runId,
      enabled: row.enabled,
      durationNorm: row.durationNorm,
      rolledBack: row.rolledBack,
      signalCountNorm: row.signalCountNorm,
      errorPresent: row.errorPresent,
      warnPresent: row.warnPresent,
      outputChanged: row.outputChanged,
      ownerEncoded: row.ownerEncoded,
    };

    const dlMeta: Record<string, JsonValue> = {
      ...payload,
      _id: `tick_executor:dl_tensor:${step}:${tick}:${ts}`,
      _lane: 'LIVEOPS_STEP',
      _actorId: (options?.actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: heat,
          helperBlackout: false,
          haterRaidActive: row.errorPresent > 0.5 && row.rolledBack > 0.5,
        }),
        metadata: Object.freeze(dlMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  // ── batch processing ──────────────────────────────────────────────────────

  /**
   * Translates an array of signals and returns only the emitted envelopes.
   */
  public translateBatch(
    signals: readonly TickExecutorSignalCompat[],
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): readonly ChatInputEnvelope[] {
    const result: ChatInputEnvelope[] = [];
    const ts = options?.nowOverride ?? nowMs();

    for (const signal of signals) {
      const envelope = this.translate(signal, { ...options, nowOverride: ts as UnixMs });
      if (envelope !== null) {
        result.push(envelope);
      }
    }

    return Object.freeze(result);
  }

  /**
   * Builds a composite ChatSignalEnvelope from a signal for ChatEngine routing.
   */
  public buildSignalEnvelope(
    signal: TickExecutorSignalCompat,
    options?: {
      readonly roomId?: ChatRoomId;
      readonly actorId?: Nullable<string>;
      readonly nowOverride?: UnixMs;
    },
  ): ChatSignalEnvelope | null {
    if (!shouldEmit(signal.severity, this._mode)) return null;

    const ts = options?.nowOverride ?? nowMs();
    const roomId = options?.roomId ?? this._roomId;
    const heat = severityToHeat(signal.severity);
    const worldEvent = buildSignalWorldEvent(signal.operationKind, signal.severity);
    const verbose = this._mode === 'VERBOSE';

    return Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: ts,
      roomId,
      liveops: Object.freeze({
        worldEventName: worldEvent,
        heatMultiplier01: clamp01(heat) as Score01,
        helperBlackout: false,
        haterRaidActive: signal.severity === 'CRITICAL',
      }),
      metadata: Object.freeze({
        signalId: `te:${signal.runId}:${signal.tick}:${signal.operationKind}`,
        enrichedAt: ts as JsonValue,
        sourceAdapter: 'TickExecutorSignalAdapter' as JsonValue,
        adapterMode: this._mode as JsonValue,
        ...buildSignalMetadata(signal, verbose),
      }) as Readonly<Record<string, JsonValue>>,
    });
  }

  // ── adapter metadata ──────────────────────────────────────────────────────

  public get mode(): TickExecutorAdapterMode {
    return this._mode;
  }

  public buildManifest(): TickExecutorSignalAdapterManifest {
    return Object.freeze({
      adapterId: `tick-executor-signal-adapter:${this._mode.toLowerCase()}`,
      adapterName: 'TickExecutorSignalAdapter',
      version: TICK_EXECUTOR_SIGNAL_ADAPTER_VERSION,
      schema: TICK_EXECUTOR_SIGNAL_ADAPTER_SCHEMA,
      mode: this._mode,
      mlFeatureCount: TICK_EXECUTOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      dlTensorShape: TICK_EXECUTOR_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
      emitsOnLow: this._mode === 'VERBOSE',
      emitsOnMedium: this._mode !== 'STRICT',
      emitsOnHigh: true,
      emitsOnCritical: true,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_EXECUTOR_DEFAULT_SIGNAL_ADAPTER =
  new TickExecutorSignalAdapter('DEFAULT');

export const TICK_EXECUTOR_STRICT_SIGNAL_ADAPTER =
  new TickExecutorSignalAdapter('STRICT');

export const TICK_EXECUTOR_VERBOSE_SIGNAL_ADAPTER =
  new TickExecutorSignalAdapter('VERBOSE');

export const TICK_EXECUTOR_SIGNAL_ADAPTER_MANIFEST: TickExecutorSignalAdapterManifest =
  TICK_EXECUTOR_DEFAULT_SIGNAL_ADAPTER.buildManifest();

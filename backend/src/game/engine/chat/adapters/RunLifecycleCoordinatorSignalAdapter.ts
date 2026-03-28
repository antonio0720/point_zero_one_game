// backend/src/game/engine/chat/adapters/RunLifecycleCoordinatorSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/RunLifecycleCoordinatorSignalAdapter.ts
 *
 * Translates RunLifecycleCoordinator signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * This prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Lifecycle signals enter the chat lane at every significant coordinator
 * operation: start, play, action, tick, runUntilDone, and reset.
 * They carry:
 *   - mode identity (Empire / Predator / Syndicate / Phantom)
 *   - lifecycle state (IDLE / RUN_STARTED / IN_TICK / TERMINAL / FINALIZED)
 *   - health score (ML-derived [0,1])
 *   - severity (LOW / MEDIUM / HIGH / CRITICAL)
 *   - operation kind (START / PLAY / ACTION / TICK / RUN_UNTIL_DONE / RESET)
 *   - pressure tier, run phase, outcome
 *   - ML vector (32-dim) for real-time inference
 *   - narration key and urgency label for companion routing
 *
 * Chat doctrine:
 *   - LOW      → clean operation, companion acknowledgment fires
 *   - MEDIUM   → elevated engagement, companion coaching fires
 *   - HIGH     → rescue-eligible, companion alarm fires, audience heat rises
 *   - CRITICAL → max heat, companion rescue fires, haterRaidActive = true
 *
 * Adapter modes:
 *   DEFAULT  — emits for all non-read operations (START, PLAY, ACTION, TICK, RESET)
 *   STRICT   — emits only for HIGH/CRITICAL severity signals
 *   VERBOSE  — emits for every operation including reads; includes full ML vector
 *
 * Usage:
 *   import { LIFECYCLE_DEFAULT_SIGNAL_ADAPTER } from './RunLifecycleCoordinatorSignalAdapter';
 *   const envelope = LIFECYCLE_DEFAULT_SIGNAL_ADAPTER.translate(signal);
 *
 * Singletons:
 *   LIFECYCLE_DEFAULT_SIGNAL_ADAPTER
 *   LIFECYCLE_STRICT_SIGNAL_ADAPTER
 *   LIFECYCLE_VERBOSE_SIGNAL_ADAPTER
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
// STRUCTURAL COMPAT TYPES — mirrors zero/RunLifecycleCoordinator without imports
// ─────────────────────────────────────────────────────────────────────────────

/** Structural compat for LifecycleSeverity. */
export type LifecycleSeverityCompat = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Structural compat for LifecycleOperationKind. */
export type LifecycleOperationKindCompat =
  | 'START'
  | 'PLAY'
  | 'ACTION'
  | 'TICK'
  | 'RUN_UNTIL_DONE'
  | 'GET_SNAPSHOT'
  | 'GET_LIFECYCLE'
  | 'GET_FLUSH_COUNT'
  | 'GET_QUEUED_EVENT_COUNT'
  | 'GET_TICK_HISTORY'
  | 'RESET';

/** Structural compat for OrchestratorLifecycle. */
type LifecycleStateCompat =
  | 'IDLE'
  | 'RUN_STARTED'
  | 'IN_TICK'
  | 'TERMINAL_PENDING_FINALIZE'
  | 'FINALIZED';

/** Structural compat for ModeCode. */
type ModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for RunPhase. */
type RunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Structural compat for PressureTier. */
type PressureTierCompat = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/** Structural compat for RunOutcome. */
type RunOutcomeCompat = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/** Structural compat for LifecycleMLVector (32 fields). */
export interface LifecycleMLVectorCompat {
  readonly modeNormalized: number;
  readonly lifecycleStateOrdinal: number;
  readonly phaseNormalized: number;
  readonly pressureTierNormalized: number;
  readonly tickCountNorm: number;
  readonly tickEfficiencyNorm: number;
  readonly operationCountNorm: number;
  readonly playCardRatioNorm: number;
  readonly actionRatioNorm: number;
  readonly queuedEventCountNorm: number;
  readonly lastFlushCountNorm: number;
  readonly tickHistoryDepthNorm: number;
  readonly terminalFlag: number;
  readonly outcomeNormalized: number;
  readonly modeDifficultyNorm: number;
  readonly modeTensionFloor: number;
  readonly phaseStakesMultiplier: number;
  readonly phaseTickBudgetFraction: number;
  readonly pressureEscalationNorm: number;
  readonly shieldWeightTotalNorm: number;
  readonly botThreatScoreNorm: number;
  readonly avgTickDurationNorm: number;
  readonly sessionDurationNorm: number;
  readonly startInputComplexity: number;
  readonly lifecycleTransitionNorm: number;
  readonly resetCountNorm: number;
  readonly healthScore: number;
  readonly timingPriorityAvg: number;
  readonly deckPowerAvg: number;
  readonly operationKindEntropyNorm: number;
  readonly modeMaxDivergenceNorm: number;
  readonly pressureMinHoldNorm: number;
}

/** Structural compat for LifecycleDLTensorRow. */
export interface LifecycleDLTensorRowCompat {
  readonly label: string;
  readonly f0: number;
  readonly f1: number;
  readonly f2: number;
  readonly f3: number;
  readonly f4: number;
  readonly f5: number;
}

/** Structural compat for LifecycleDLTensor. */
export interface LifecycleDLTensorCompat {
  readonly shape: readonly [number, number];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly rows: readonly LifecycleDLTensorRowCompat[];
  readonly checksum: string;
}

/**
 * Structural compat shape for LifecycleChatSignal (from zero/).
 * Mirrors the interface without importing from zero/ directly.
 */
export interface LifecycleSignalCompat {
  readonly kind: 'LIFECYCLE_SIGNAL';
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCodeCompat;
  readonly lifecycleState: LifecycleStateCompat;
  readonly operation: LifecycleOperationKindCompat;
  readonly severity: LifecycleSeverityCompat;
  readonly healthScore: number;
  readonly phase: RunPhaseCompat | null;
  readonly pressureTier: PressureTierCompat | null;
  readonly outcome: RunOutcomeCompat | null;
  readonly tick: number;
  readonly tickCount: number;
  readonly actionRecommendation: string;
  readonly narrationKey: string;
  readonly urgencyLabel: string;
  readonly sessionDurationMs: number;
  readonly isTerminal: boolean;
  readonly mlVector: LifecycleMLVectorCompat;
  readonly timestampMs: number;
}

/** Structural compat for LifecycleAnnotationBundle. */
export interface LifecycleAnnotationCompat {
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCodeCompat;
  readonly operation: LifecycleOperationKindCompat;
  readonly severity: LifecycleSeverityCompat;
  readonly healthScore: number;
  readonly phase: RunPhaseCompat | null;
  readonly pressureTier: PressureTierCompat | null;
  readonly outcome: RunOutcomeCompat | null;
  readonly isTerminal: boolean;
  readonly integrityFlag: string;
  readonly activeAttackCategories: readonly string[];
  readonly botThreatSummary: string;
  readonly primaryNarration: string;
  readonly secondaryNarration: string;
  readonly actionRecommendation: string;
  readonly engagementScore: number;
  readonly rescueEligible: boolean;
  readonly cascadeRisk: boolean;
  readonly timestampMs: number;
}

/** Structural compat for LifecycleNarrationHint. */
export interface LifecycleNarrationCompat {
  readonly runId: string;
  readonly operation: LifecycleOperationKindCompat;
  readonly mode: ModeCodeCompat;
  readonly phase: RunPhaseCompat | null;
  readonly severity: LifecycleSeverityCompat;
  readonly primaryKey: string;
  readonly secondaryKey: string;
  readonly urgencyLabel: string;
  readonly modeLabel: string;
  readonly phaseLabel: string;
  readonly pressureLabel: string;
  readonly botThreatLabel: string;
  readonly outcomeLabel: string | null;
  readonly chatPrompt: string;
  readonly audienceHeatDelta: number;
  readonly rescueTrigger: boolean;
  readonly presenceTheatre: boolean;
}

/** Structural compat for LifecycleTrendSnapshot. */
export interface LifecycleTrendCompat {
  readonly sessionId: string;
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly healthScoreDelta: number;
  readonly avgTickDurationMs: number;
  readonly operationRatePerMinute: number;
  readonly playCardRate: number;
  readonly modeActionRate: number;
  readonly tickRate: number;
  readonly resetRate: number;
  readonly terminalRate: number;
  readonly avgPressureTierNorm: number;
  readonly avgSeverityNorm: number;
  readonly engagementTrend: 'RISING' | 'STABLE' | 'FALLING';
  readonly rescueEligibilityRate: number;
  readonly cascadeRiskRate: number;
  readonly dominantOperation: LifecycleOperationKindCompat;
  readonly totalOperations: number;
  readonly snapshotMs: number;
}

/** Structural compat for LifecycleSessionReport. */
export interface LifecycleSessionCompat {
  readonly sessionId: string;
  readonly userId: string;
  readonly mode: ModeCodeCompat;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly totalOperations: number;
  readonly totalTicks: number;
  readonly totalCardPlays: number;
  readonly totalModeActions: number;
  readonly totalResets: number;
  readonly finalLifecycleState: LifecycleStateCompat;
  readonly finalPhase: RunPhaseCompat | null;
  readonly finalPressureTier: PressureTierCompat | null;
  readonly finalOutcome: RunOutcomeCompat | null;
  readonly finalHealthScore: number;
  readonly finalSeverity: LifecycleSeverityCompat;
  readonly peakHealthScore: number;
  readonly lowestHealthScore: number;
  readonly avgHealthScore: number;
  readonly terminalReached: boolean;
}

/** Structural compat for LifecycleHealthSnapshot. */
export interface LifecycleHealthSnapshotCompat {
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly timestampMs: number;
  readonly healthScore: number;
  readonly severity: LifecycleSeverityCompat;
  readonly lifecycleState: LifecycleStateCompat;
  readonly phase: RunPhaseCompat | null;
  readonly pressureTier: PressureTierCompat | null;
  readonly outcome: RunOutcomeCompat | null;
  readonly botThreatScore: number;
  readonly shieldWeightTotal: number;
  readonly tickEfficiency: number;
  readonly operationBalance: number;
  readonly sessionQuality: number;
  readonly engagementScore: number;
  readonly rescueEligible: boolean;
  readonly cascadeRisk: boolean;
  readonly userId: string;
}

/** Structural compat for LifecycleRunSummary. */
export interface LifecycleRunSummaryCompat {
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCodeCompat;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly durationMs: number;
  readonly totalTicks: number;
  readonly totalCardPlays: number;
  readonly totalModeActions: number;
  readonly outcome: RunOutcomeCompat | null;
  readonly finalPhase: RunPhaseCompat | null;
  readonly finalPressureTier: PressureTierCompat | null;
  readonly finalHealthScore: number;
  readonly finalSeverity: LifecycleSeverityCompat;
  readonly peakHealthScore: number;
  readonly avgHealthScore: number;
  readonly engagementScore: number;
  readonly rescueMoments: number;
  readonly cascadeEvents: number;
  readonly verifiedGrade: string;
}

/** Result type for lifecycle signal translation. */
export interface LifecycleTranslationResult {
  readonly envelope: ChatInputEnvelope | null;
  readonly severity: LifecycleSeverityCompat;
  readonly operation: LifecycleOperationKindCompat;
  readonly healthScore: Score01;
  readonly heatMultiplier01: Score01;
  readonly haterRaidActive: boolean;
  readonly rescueTrigger: boolean;
  readonly presenceTheatre: boolean;
  readonly shouldEmit: boolean;
  readonly worldEventName: string;
}

/** Adapter verbosity mode. */
export type RunLifecycleCoordinatorAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const LIFECYCLE_SIGNAL_ADAPTER_VERSION         = '1.0.0' as const;
export const LIFECYCLE_SIGNAL_ADAPTER_READY           = true as const;
export const LIFECYCLE_SIGNAL_ADAPTER_SCHEMA          = 'lifecycle-signal-adapter-v1' as const;
export const LIFECYCLE_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const LIFECYCLE_SIGNAL_ADAPTER_MAX_HEAT        = 1.0 as const;
export const LIFECYCLE_SIGNAL_WORLD_EVENT_PREFIX      = 'lifecycle' as const;

/** Audience heat multiplier per severity level. */
const SEVERITY_HEAT: Record<LifecycleSeverityCompat, number> = {
  LOW:      0.10,
  MEDIUM:   0.30,
  HIGH:     0.65,
  CRITICAL: 1.00,
};

/** Mode narration — maps ModeCode to player-facing label. */
const MODE_NARRATION: Record<ModeCodeCompat, string> = {
  solo:  'Empire — Going Alone',
  pvp:   'Predator — Head to Head',
  coop:  'Syndicate — Team Up',
  ghost: 'Phantom — Chase a Legend',
};

/** Operations considered significant for DEFAULT adapter emission. */
const SIGNIFICANT_OPERATIONS: ReadonlySet<string> = new Set<LifecycleOperationKindCompat>([
  'START', 'PLAY', 'ACTION', 'TICK', 'RUN_UNTIL_DONE', 'RESET',
]);

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

function _computeHeat(signal: LifecycleSignalCompat): Score01 {
  const base = SEVERITY_HEAT[signal.severity] ?? 0.1;
  const healthHeat = clamp01(1 - signal.healthScore);
  const combined = base * 0.6 + healthHeat * 0.3 + (signal.isTerminal ? 0.1 : 0);
  return clamp01(combined) as Score01;
}

function _buildWorldEventName(signal: LifecycleSignalCompat): string {
  const op = signal.operation.toLowerCase();
  const mode = signal.mode;
  const state = signal.lifecycleState.toLowerCase();
  return `${LIFECYCLE_SIGNAL_WORLD_EVENT_PREFIX}:${mode}:${state}:${op}`;
}

function _buildAnnotationWorldEventName(annotation: LifecycleAnnotationCompat): string {
  const op = annotation.operation.toLowerCase();
  return `${LIFECYCLE_SIGNAL_WORLD_EVENT_PREFIX}:${annotation.mode}:annotation:${op}`;
}

function _buildNarrationWorldEventName(narration: LifecycleNarrationCompat): string {
  const op = narration.operation.toLowerCase();
  return `${LIFECYCLE_SIGNAL_WORLD_EVENT_PREFIX}:${narration.mode}:narration:${op}`;
}

function _buildHealthSnapshotWorldEventName(snapshot: LifecycleHealthSnapshotCompat): string {
  const state = snapshot.lifecycleState.toLowerCase();
  return `${LIFECYCLE_SIGNAL_WORLD_EVENT_PREFIX}:health:${state}:${snapshot.severity.toLowerCase()}`;
}

function _buildRunSummaryWorldEventName(summary: LifecycleRunSummaryCompat): string {
  const outcome = summary.outcome ?? 'ongoing';
  return `${LIFECYCLE_SIGNAL_WORLD_EVENT_PREFIX}:${summary.mode}:run_summary:${outcome.toLowerCase()}`;
}

function _buildSignalMetadata(
  signal: LifecycleSignalCompat,
  mode: RunLifecycleCoordinatorAdapterMode,
  heatMultiplier: number,
  haterRaidActive: boolean,
  rescueTrigger: boolean,
  presenceTheatre: boolean,
): Record<string, JsonValue> {
  const base: Record<string, JsonValue> = {
    kind:                 signal.kind,
    runId:                signal.runId,
    userId:               signal.userId,
    mode:                 signal.mode,
    modeLabel:            MODE_NARRATION[signal.mode],
    lifecycleState:       signal.lifecycleState,
    operation:            signal.operation,
    severity:             signal.severity,
    healthScore:          signal.healthScore,
    tick:                 signal.tick,
    tickCount:            signal.tickCount,
    phase:                signal.phase,
    pressureTier:         signal.pressureTier,
    outcome:              signal.outcome,
    isTerminal:           signal.isTerminal,
    urgencyLabel:         signal.urgencyLabel,
    narrationKey:         signal.narrationKey,
    actionRecommendation: signal.actionRecommendation,
    sessionDurationMs:    signal.sessionDurationMs,
    heatMultiplier,
    haterRaidActive,
    rescueTrigger,
    presenceTheatre,
    generatedAtMs:        signal.timestampMs,
  };

  if (mode === 'VERBOSE') {
    base['mlVector'] = {
      modeNormalized:           signal.mlVector.modeNormalized,
      lifecycleStateOrdinal:    signal.mlVector.lifecycleStateOrdinal,
      phaseNormalized:          signal.mlVector.phaseNormalized,
      pressureTierNormalized:   signal.mlVector.pressureTierNormalized,
      tickCountNorm:            signal.mlVector.tickCountNorm,
      tickEfficiencyNorm:       signal.mlVector.tickEfficiencyNorm,
      operationCountNorm:       signal.mlVector.operationCountNorm,
      playCardRatioNorm:        signal.mlVector.playCardRatioNorm,
      actionRatioNorm:          signal.mlVector.actionRatioNorm,
      queuedEventCountNorm:     signal.mlVector.queuedEventCountNorm,
      lastFlushCountNorm:       signal.mlVector.lastFlushCountNorm,
      tickHistoryDepthNorm:     signal.mlVector.tickHistoryDepthNorm,
      terminalFlag:             signal.mlVector.terminalFlag,
      outcomeNormalized:        signal.mlVector.outcomeNormalized,
      modeDifficultyNorm:       signal.mlVector.modeDifficultyNorm,
      modeTensionFloor:         signal.mlVector.modeTensionFloor,
      phaseStakesMultiplier:    signal.mlVector.phaseStakesMultiplier,
      phaseTickBudgetFraction:  signal.mlVector.phaseTickBudgetFraction,
      pressureEscalationNorm:   signal.mlVector.pressureEscalationNorm,
      shieldWeightTotalNorm:    signal.mlVector.shieldWeightTotalNorm,
      botThreatScoreNorm:       signal.mlVector.botThreatScoreNorm,
      avgTickDurationNorm:      signal.mlVector.avgTickDurationNorm,
      sessionDurationNorm:      signal.mlVector.sessionDurationNorm,
      startInputComplexity:     signal.mlVector.startInputComplexity,
      lifecycleTransitionNorm:  signal.mlVector.lifecycleTransitionNorm,
      resetCountNorm:           signal.mlVector.resetCountNorm,
      healthScore:              signal.mlVector.healthScore,
      timingPriorityAvg:        signal.mlVector.timingPriorityAvg,
      deckPowerAvg:             signal.mlVector.deckPowerAvg,
      operationKindEntropyNorm: signal.mlVector.operationKindEntropyNorm,
      modeMaxDivergenceNorm:    signal.mlVector.modeMaxDivergenceNorm,
      pressureMinHoldNorm:      signal.mlVector.pressureMinHoldNorm,
    } as unknown as JsonValue;

    base['mlChecksum'] = `lifecycle-ml-${signal.timestampMs}`;
  }

  return base;
}

function _buildEnvelope(
  signal: LifecycleSignalCompat,
  mode: RunLifecycleCoordinatorAdapterMode,
  roomId: Nullable<ChatRoomId>,
): ChatInputEnvelope {
  const ts = nowMs();
  const heat = _computeHeat(signal);
  const worldEventName = _buildWorldEventName(signal);
  const haterRaidActive = signal.severity === 'CRITICAL';
  const helperBlackout = signal.severity === 'CRITICAL' && signal.isTerminal;
  const rescueTrigger = signal.severity === 'CRITICAL' ||
    (signal.severity === 'HIGH' && signal.isTerminal);
  const presenceTheatre = signal.pressureTier === 'T4' || signal.severity === 'CRITICAL';
  const meta = _buildSignalMetadata(signal, mode, heat, haterRaidActive, rescueTrigger, presenceTheatre);

  const chatSignal: ChatSignalEnvelope = {
    type:      'LIVEOPS',
    emittedAt: ts,
    roomId,
    liveops: {
      worldEventName,
      heatMultiplier01: heat,
      helperBlackout,
      haterRaidActive,
    },
    metadata: meta,
  };

  return {
    kind:      'LIVEOPS_SIGNAL',
    emittedAt: ts,
    payload:   chatSignal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RunLifecycleCoordinatorSignalAdapter
 *
 * Translates LifecycleSignalCompat → ChatInputEnvelope for the LIVEOPS lane.
 * Used by the backend chat engine to ingest lifecycle events and emit
 * companion commentary, audience heat adjustments, and rescue triggers.
 */
export class RunLifecycleCoordinatorSignalAdapter {
  private readonly adapterMode: RunLifecycleCoordinatorAdapterMode;
  private readonly roomId: Nullable<ChatRoomId>;
  private translateCount = 0;
  private suppressedCount = 0;

  public constructor(
    mode: RunLifecycleCoordinatorAdapterMode = 'DEFAULT',
    roomId?: Nullable<ChatRoomId>,
  ) {
    this.adapterMode = mode;
    this.roomId = roomId ?? null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Core translation — signal → envelope
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Translate a LifecycleSignalCompat to a ChatInputEnvelope.
   * Returns null if the adapter suppresses this signal in current mode.
   */
  public translate(signal: LifecycleSignalCompat): ChatInputEnvelope | null {
    if (!this._shouldEmit(signal)) {
      this.suppressedCount += 1;
      return null;
    }
    this.translateCount += 1;
    return _buildEnvelope(signal, this.adapterMode, this.roomId);
  }

  /**
   * Translate a signal and always return a LifecycleTranslationResult,
   * even if the signal is suppressed (shouldEmit will be false in that case).
   */
  public translateWithResult(signal: LifecycleSignalCompat): LifecycleTranslationResult {
    const shouldEmit = this._shouldEmit(signal);
    const envelope = shouldEmit
      ? _buildEnvelope(signal, this.adapterMode, this.roomId)
      : null;
    const heatMultiplier = _computeHeat(signal);
    const haterRaidActive = signal.severity === 'CRITICAL';
    const rescueTrigger = signal.severity === 'CRITICAL' ||
      (signal.severity === 'HIGH' && signal.isTerminal);
    const presenceTheatre = signal.pressureTier === 'T4' || signal.severity === 'CRITICAL';
    const worldEventName = _buildWorldEventName(signal);

    if (shouldEmit) this.translateCount += 1;
    else this.suppressedCount += 1;

    return {
      envelope,
      severity:          signal.severity,
      operation:         signal.operation,
      healthScore:       clamp01(signal.healthScore) as Score01,
      heatMultiplier01:  heatMultiplier,
      haterRaidActive,
      rescueTrigger,
      presenceTheatre,
      shouldEmit,
      worldEventName,
    };
  }

  /**
   * Translate a LifecycleAnnotationCompat → ChatInputEnvelope (annotation lane).
   */
  public translateAnnotation(
    annotation: LifecycleAnnotationCompat,
    timestampOverride?: UnixMs,
  ): ChatInputEnvelope {
    const ts = timestampOverride ?? nowMs();
    const heat = (SEVERITY_HEAT[annotation.severity] ?? 0.1) as Score01;
    const haterRaidActive = annotation.severity === 'CRITICAL';
    const helperBlackout = annotation.cascadeRisk;
    const worldEventName = _buildAnnotationWorldEventName(annotation);
    const modeLabel = MODE_NARRATION[annotation.mode];

    const chatSignal: ChatSignalEnvelope = {
      type:      'LIVEOPS',
      emittedAt: ts,
      roomId:    this.roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout,
        haterRaidActive,
      },
      metadata: {
        kind:                 'annotation',
        runId:                annotation.runId,
        userId:               annotation.userId,
        mode:                 annotation.mode,
        modeLabel,
        operation:            annotation.operation,
        severity:             annotation.severity,
        healthScore:          annotation.healthScore,
        phase:                annotation.phase,
        pressureTier:         annotation.pressureTier,
        outcome:              annotation.outcome,
        isTerminal:           annotation.isTerminal,
        integrityFlag:        annotation.integrityFlag,
        botThreatSummary:     annotation.botThreatSummary,
        primaryNarration:     annotation.primaryNarration,
        secondaryNarration:   annotation.secondaryNarration,
        actionRecommendation: annotation.actionRecommendation,
        engagementScore:      annotation.engagementScore,
        rescueEligible:       annotation.rescueEligible,
        cascadeRisk:          annotation.cascadeRisk,
        activeAttackCategories: annotation.activeAttackCategories as unknown as JsonValue,
        generatedAtMs:        annotation.timestampMs,
        heatMultiplier:       heat,
        haterRaidActive,
      },
    };

    return {
      kind:      'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload:   chatSignal,
    };
  }

  /**
   * Translate a LifecycleNarrationCompat → ChatInputEnvelope (narration lane).
   */
  public translateNarrationHint(
    narration: LifecycleNarrationCompat,
    runId: string,
    userId: string,
    timestampOverride?: UnixMs,
  ): ChatInputEnvelope {
    const ts = timestampOverride ?? nowMs();
    const heat = Math.min(1, narration.audienceHeatDelta * 3) as Score01;
    const haterRaidActive = narration.rescueTrigger;
    const helperBlackout = false;
    const worldEventName = _buildNarrationWorldEventName(narration);
    const modeLabel = MODE_NARRATION[narration.mode];

    const chatSignal: ChatSignalEnvelope = {
      type:      'LIVEOPS',
      emittedAt: ts,
      roomId:    this.roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout,
        haterRaidActive,
      },
      metadata: {
        kind:              'narration',
        runId,
        userId,
        mode:              narration.mode,
        modeLabel,
        operation:         narration.operation,
        phase:             narration.phase,
        severity:          narration.severity,
        primaryKey:        narration.primaryKey,
        secondaryKey:      narration.secondaryKey,
        urgencyLabel:      narration.urgencyLabel,
        phaseLabel:        narration.phaseLabel,
        pressureLabel:     narration.pressureLabel,
        botThreatLabel:    narration.botThreatLabel,
        outcomeLabel:      narration.outcomeLabel,
        chatPrompt:        narration.chatPrompt,
        audienceHeatDelta: narration.audienceHeatDelta,
        rescueTrigger:     narration.rescueTrigger,
        presenceTheatre:   narration.presenceTheatre,
        heatMultiplier:    heat,
        haterRaidActive,
      },
    };

    return {
      kind:      'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload:   chatSignal,
    };
  }

  /**
   * Translate a LifecycleMLVectorCompat to a flat metadata record
   * for attaching to a ChatSignalEnvelope or logging.
   */
  public translateMLVector(
    vector: LifecycleMLVectorCompat,
  ): Record<string, number> {
    return {
      modeNormalized:           vector.modeNormalized,
      lifecycleStateOrdinal:    vector.lifecycleStateOrdinal,
      phaseNormalized:          vector.phaseNormalized,
      pressureTierNormalized:   vector.pressureTierNormalized,
      tickCountNorm:            vector.tickCountNorm,
      tickEfficiencyNorm:       vector.tickEfficiencyNorm,
      operationCountNorm:       vector.operationCountNorm,
      playCardRatioNorm:        vector.playCardRatioNorm,
      actionRatioNorm:          vector.actionRatioNorm,
      queuedEventCountNorm:     vector.queuedEventCountNorm,
      lastFlushCountNorm:       vector.lastFlushCountNorm,
      tickHistoryDepthNorm:     vector.tickHistoryDepthNorm,
      terminalFlag:             vector.terminalFlag,
      outcomeNormalized:        vector.outcomeNormalized,
      modeDifficultyNorm:       vector.modeDifficultyNorm,
      modeTensionFloor:         vector.modeTensionFloor,
      phaseStakesMultiplier:    vector.phaseStakesMultiplier,
      phaseTickBudgetFraction:  vector.phaseTickBudgetFraction,
      pressureEscalationNorm:   vector.pressureEscalationNorm,
      shieldWeightTotalNorm:    vector.shieldWeightTotalNorm,
      botThreatScoreNorm:       vector.botThreatScoreNorm,
      avgTickDurationNorm:      vector.avgTickDurationNorm,
      sessionDurationNorm:      vector.sessionDurationNorm,
      startInputComplexity:     vector.startInputComplexity,
      lifecycleTransitionNorm:  vector.lifecycleTransitionNorm,
      resetCountNorm:           vector.resetCountNorm,
      healthScore:              vector.healthScore,
      timingPriorityAvg:        vector.timingPriorityAvg,
      deckPowerAvg:             vector.deckPowerAvg,
      operationKindEntropyNorm: vector.operationKindEntropyNorm,
      modeMaxDivergenceNorm:    vector.modeMaxDivergenceNorm,
      pressureMinHoldNorm:      vector.pressureMinHoldNorm,
    };
  }

  /**
   * Translate a LifecycleDLTensorRowCompat to a flat number record.
   */
  public translateDLTensorRow(
    row: LifecycleDLTensorRowCompat,
  ): Record<string, number | string> {
    return {
      label: row.label,
      f0:    row.f0,
      f1:    row.f1,
      f2:    row.f2,
      f3:    row.f3,
      f4:    row.f4,
      f5:    row.f5,
    };
  }

  /**
   * Translate a LifecycleTrendCompat → metadata record for chat routing.
   */
  public translateTrend(
    trend: LifecycleTrendCompat,
  ): Record<string, JsonValue> {
    return {
      sessionId:              trend.sessionId,
      windowSize:             trend.windowSize,
      avgHealthScore:         trend.avgHealthScore,
      healthScoreDelta:       trend.healthScoreDelta,
      avgTickDurationMs:      trend.avgTickDurationMs,
      operationRatePerMinute: trend.operationRatePerMinute,
      playCardRate:           trend.playCardRate,
      modeActionRate:         trend.modeActionRate,
      tickRate:               trend.tickRate,
      resetRate:              trend.resetRate,
      terminalRate:           trend.terminalRate,
      avgPressureTierNorm:    trend.avgPressureTierNorm,
      avgSeverityNorm:        trend.avgSeverityNorm,
      engagementTrend:        trend.engagementTrend,
      rescueEligibilityRate:  trend.rescueEligibilityRate,
      cascadeRiskRate:        trend.cascadeRiskRate,
      dominantOperation:      trend.dominantOperation,
      totalOperations:        trend.totalOperations,
      snapshotMs:             trend.snapshotMs,
    } as unknown as Record<string, JsonValue>;
  }

  /**
   * Translate a LifecycleSessionCompat → metadata record for chat routing.
   */
  public translateSessionReport(
    report: LifecycleSessionCompat,
  ): Record<string, JsonValue> {
    return {
      sessionId:           report.sessionId,
      userId:              report.userId,
      mode:                report.mode,
      modeLabel:           MODE_NARRATION[report.mode],
      durationMs:          report.durationMs,
      totalOperations:     report.totalOperations,
      totalTicks:          report.totalTicks,
      totalCardPlays:      report.totalCardPlays,
      totalModeActions:    report.totalModeActions,
      totalResets:         report.totalResets,
      finalLifecycleState: report.finalLifecycleState,
      finalPhase:          report.finalPhase,
      finalPressureTier:   report.finalPressureTier,
      finalOutcome:        report.finalOutcome,
      finalHealthScore:    report.finalHealthScore,
      finalSeverity:       report.finalSeverity,
      peakHealthScore:     report.peakHealthScore,
      lowestHealthScore:   report.lowestHealthScore,
      avgHealthScore:      report.avgHealthScore,
      terminalReached:     report.terminalReached,
    } as unknown as Record<string, JsonValue>;
  }

  /**
   * Translate a LifecycleHealthSnapshotCompat → ChatInputEnvelope (health lane).
   */
  public translateHealthSnapshot(
    snapshot: LifecycleHealthSnapshotCompat,
    timestampOverride?: UnixMs,
  ): ChatInputEnvelope {
    const ts = timestampOverride ?? nowMs();
    const heat = (SEVERITY_HEAT[snapshot.severity] ?? 0.1) as Score01;
    const haterRaidActive = snapshot.severity === 'CRITICAL';
    const helperBlackout = snapshot.cascadeRisk;
    const worldEventName = _buildHealthSnapshotWorldEventName(snapshot);

    const chatSignal: ChatSignalEnvelope = {
      type:      'LIVEOPS',
      emittedAt: ts,
      roomId:    this.roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout,
        haterRaidActive,
      },
      metadata: {
        kind:              'health-snapshot',
        snapshotId:        snapshot.snapshotId,
        sessionId:         snapshot.sessionId,
        runId:             snapshot.runId,
        userId:            snapshot.userId,
        severity:          snapshot.severity,
        healthScore:       snapshot.healthScore,
        lifecycleState:    snapshot.lifecycleState,
        phase:             snapshot.phase,
        pressureTier:      snapshot.pressureTier,
        outcome:           snapshot.outcome,
        botThreatScore:    snapshot.botThreatScore,
        shieldWeightTotal: snapshot.shieldWeightTotal,
        tickEfficiency:    snapshot.tickEfficiency,
        operationBalance:  snapshot.operationBalance,
        sessionQuality:    snapshot.sessionQuality,
        engagementScore:   snapshot.engagementScore,
        rescueEligible:    snapshot.rescueEligible,
        cascadeRisk:       snapshot.cascadeRisk,
        heatMultiplier:    heat,
        haterRaidActive,
        generatedAtMs:     snapshot.timestampMs,
      },
    };

    return {
      kind:      'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload:   chatSignal,
    };
  }

  /**
   * Translate a LifecycleRunSummaryCompat → ChatInputEnvelope (post-run lane).
   */
  public translateRunSummary(
    summary: LifecycleRunSummaryCompat,
    timestampOverride?: UnixMs,
  ): ChatInputEnvelope {
    const ts = timestampOverride ?? nowMs();
    const heat = (SEVERITY_HEAT[summary.finalSeverity] ?? 0.1) as Score01;
    const haterRaidActive = summary.finalSeverity === 'CRITICAL';
    const helperBlackout = false;
    const worldEventName = _buildRunSummaryWorldEventName(summary);
    const modeLabel = MODE_NARRATION[summary.mode];
    const isWin = summary.outcome === 'FREEDOM';
    const rescueTrigger = !isWin && summary.rescueMoments > 0;
    const presenceTheatre = summary.cascadeEvents > 0;

    const chatSignal: ChatSignalEnvelope = {
      type:      'LIVEOPS',
      emittedAt: ts,
      roomId:    this.roomId,
      liveops: {
        worldEventName,
        heatMultiplier01: heat,
        helperBlackout,
        haterRaidActive,
      },
      metadata: {
        kind:             'run-summary',
        runId:            summary.runId,
        userId:           summary.userId,
        mode:             summary.mode,
        modeLabel,
        outcome:          summary.outcome,
        finalSeverity:    summary.finalSeverity,
        finalHealthScore: summary.finalHealthScore,
        peakHealthScore:  summary.peakHealthScore,
        avgHealthScore:   summary.avgHealthScore,
        engagementScore:  summary.engagementScore,
        verifiedGrade:    summary.verifiedGrade,
        totalTicks:       summary.totalTicks,
        totalCardPlays:   summary.totalCardPlays,
        totalModeActions: summary.totalModeActions,
        durationMs:       summary.durationMs,
        rescueMoments:    summary.rescueMoments,
        cascadeEvents:    summary.cascadeEvents,
        rescueTrigger,
        presenceTheatre,
        heatMultiplier:   heat,
        haterRaidActive,
        isWin,
      },
    };

    return {
      kind:      'LIVEOPS_SIGNAL',
      emittedAt: ts,
      payload:   chatSignal,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Diagnostics
  // ──────────────────────────────────────────────────────────────────────────

  public getTranslateCount(): number {
    return this.translateCount;
  }

  public getSuppressedCount(): number {
    return this.suppressedCount;
  }

  public getMode(): RunLifecycleCoordinatorAdapterMode {
    return this.adapterMode;
  }

  public getRoomId(): Nullable<ChatRoomId> {
    return this.roomId;
  }

  public resetCounters(): void {
    this.translateCount = 0;
    this.suppressedCount = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private _shouldEmit(signal: LifecycleSignalCompat): boolean {
    if (this.adapterMode === 'VERBOSE') return true;
    if (this.adapterMode === 'STRICT') {
      return signal.severity === 'HIGH' || signal.severity === 'CRITICAL';
    }
    // DEFAULT: emit only for significant operations
    return SIGNIFICANT_OPERATIONS.has(signal.operation);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCES
// ─────────────────────────────────────────────────────────────────────────────

/** Default lifecycle signal adapter — emits for all significant operations. */
export const LIFECYCLE_DEFAULT_SIGNAL_ADAPTER = new RunLifecycleCoordinatorSignalAdapter('DEFAULT');

/** Strict lifecycle signal adapter — emits only for HIGH/CRITICAL severity. */
export const LIFECYCLE_STRICT_SIGNAL_ADAPTER = new RunLifecycleCoordinatorSignalAdapter('STRICT');

/** Verbose lifecycle signal adapter — emits for all operations including reads. */
export const LIFECYCLE_VERBOSE_SIGNAL_ADAPTER = new RunLifecycleCoordinatorSignalAdapter('VERBOSE');

// ─────────────────────────────────────────────────────────────────────────────
// MODULE MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

/** Module manifest for runtime introspection and readiness checks. */
export const LIFECYCLE_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  name:              'RunLifecycleCoordinatorSignalAdapter',
  version:           LIFECYCLE_SIGNAL_ADAPTER_VERSION,
  schema:            LIFECYCLE_SIGNAL_ADAPTER_SCHEMA,
  ready:             LIFECYCLE_SIGNAL_ADAPTER_READY,
  mlFeatureCount:    LIFECYCLE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  maxHeat:           LIFECYCLE_SIGNAL_ADAPTER_MAX_HEAT,
  worldEventPrefix:  LIFECYCLE_SIGNAL_WORLD_EVENT_PREFIX,
  adapterModes:      ['DEFAULT', 'STRICT', 'VERBOSE'] as const,
  singletons: {
    default: 'LIFECYCLE_DEFAULT_SIGNAL_ADAPTER',
    strict:  'LIFECYCLE_STRICT_SIGNAL_ADAPTER',
    verbose: 'LIFECYCLE_VERBOSE_SIGNAL_ADAPTER',
  },
  signalKind:        'LIFECYCLE_SIGNAL',
  envelopeType:      'LIVEOPS',
  chatLane:          'LIVEOPS',
  noCircularImports: true,
  description:       'Translates RunLifecycleCoordinator signals to ChatInputEnvelopes for the LIVEOPS lane.',
});

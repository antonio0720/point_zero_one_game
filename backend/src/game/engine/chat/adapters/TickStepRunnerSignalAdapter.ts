// backend/src/game/engine/chat/adapters/TickStepRunnerSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/TickStepRunnerSignalAdapter.ts
 * VERSION: 2026.03.28
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 *
 * ── PURPOSE ───────────────────────────────────────────────────────────────────
 * Translates TickStepRunner step execution reports from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes without creating a circular
 * dependency.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * This prevents the circular dependency: chat/ → zero/ → chat/.
 *
 * ── SIGNAL DOCTRINE ───────────────────────────────────────────────────────────
 * Step execution signals enter the chat lane whenever a tick step executes,
 * rolls back, exceeds budget, or triggers a contract violation. They carry:
 *   - step identity (step name, ordinal, phase, owner)
 *   - operation kind (ENGINE_STEP / SYNTHETIC_STEP / NOOP_STEP / ROLLBACK /
 *                     SKIP / CONTRACT_VIOLATION / BUDGET_EXCEEDED / HEALTH_CHANGE)
 *   - severity (LOW / MEDIUM / HIGH / CRITICAL)
 *   - health grade (ML-derived [0,1])
 *   - 32-dim ML feature vector for real-time inference
 *   - per-step DL row for tick profile construction
 *   - narration phrase adapted to player mode
 *   - run/tick context for downstream routing
 *
 * ── CHAT DOCTRINE ─────────────────────────────────────────────────────────────
 *   LOW      → step nominal, companion advisory optional
 *   MEDIUM   → step slow or warning density elevated, companion coaching fires
 *   HIGH     → step over-budget or error present, companion escalates
 *   CRITICAL → step rolled back or contract violation, rescue + max heat fires
 *
 * ── ADAPTER MODES ─────────────────────────────────────────────────────────────
 *   DEFAULT  — emits for MEDIUM/HIGH/CRITICAL only
 *   STRICT   — emits only for HIGH/CRITICAL
 *   VERBOSE  — emits for all step operations including LOW; full ML vector
 *
 * ── FOUR GAME MODES ───────────────────────────────────────────────────────────
 *   - Empire   (solo)  — GO ALONE — sovereign narration
 *   - Predator (pvp)   — HEAD TO HEAD — rivalry witness
 *   - Syndicate(coop)  — TEAM UP — shared step awareness
 *   - Phantom  (ghost) — CHASE A LEGEND — execution urgency
 *
 * ── SINGLETONS ────────────────────────────────────────────────────────────────
 *   TICK_STEP_RUNNER_DEFAULT_SIGNAL_ADAPTER
 *   TICK_STEP_RUNNER_STRICT_SIGNAL_ADAPTER
 *   TICK_STEP_RUNNER_VERBOSE_SIGNAL_ADAPTER
 *   TICK_STEP_RUNNER_SIGNAL_ADAPTER_MANIFEST
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

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

/** Current unix timestamp in ms. */
function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

// ─── MODULE CONSTANTS ─────────────────────────────────────────────────────────

/** Semantic version of this adapter module. */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_MODULE_VERSION = '2026.03.28' as const;

/** Schema identifier for serialization compatibility. */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_SCHEMA = 'tick-step-runner-signal-adapter-v1' as const;

/** Runtime readiness flag. Always true after module load. */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_READY = true as const;

/** ML feature count mirrored from zero layer (32 dims). */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;

/** DL tensor shape mirrored from zero layer (13 rows × 8 cols). */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_DL_TENSOR_SHAPE = Object.freeze([13, 8] as const);

/** Maximum heat multiplier for companion routing. */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_MAX_HEAT = 1.0 as const;

/** Step budget (ms) reference for budget utilization scoring. */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_STEP_BUDGET_MS = 50 as const;

/** World event prefix for LIVEOPS signal routing. */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_WORLD_EVENT_PREFIX = 'tick_step_runner' as const;

/** Maximum batch size for translateBatch. */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 200 as const;

// ─── STRUCTURAL COMPAT TYPES ──────────────────────────────────────────────────
// These mirror the zero/ TickStepRunner types without importing from zero/.
// Structural compatibility with zero/ types is enforced by shape, not import.

/** Structural compat for TickStepRunnerSeverity. */
export type TickStepRunnerSignalAdapterSeverityCompat =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

/** Structural compat for TickStepRunnerOperationKind. */
export type TickStepRunnerSignalAdapterOperationKindCompat =
  | 'ENGINE_STEP'
  | 'SYNTHETIC_STEP'
  | 'NOOP_STEP'
  | 'ROLLBACK'
  | 'SKIP'
  | 'CONTRACT_VIOLATION'
  | 'BUDGET_EXCEEDED'
  | 'HEALTH_CHANGE';

/** Structural compat for TickStepRunnerAdapterMode. */
export type TickStepRunnerSignalAdapterModeCompat = 'DEFAULT' | 'STRICT' | 'VERBOSE';

/** Structural compat for ModeCode. */
export type TickStepRunnerModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for RunPhase. */
export type TickStepRunnerRunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Structural compat for PressureTier. */
export type TickStepRunnerPressureTierCompat = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/** Structural compat for RunOutcome (nullable for ongoing runs). */
export type TickStepRunnerRunOutcomeCompat =
  | 'FREEDOM'
  | 'TIMEOUT'
  | 'BANKRUPT'
  | 'ABANDONED'
  | null;

/** Structural compat for TickStepPhase. */
export type TickStepRunnerPhaseCompat =
  | 'ORCHESTRATION'
  | 'ENGINE'
  | 'MODE'
  | 'OBSERVABILITY'
  | 'FINALIZATION';

/** Structural compat for TickStepOwner. */
export type TickStepRunnerOwnerCompat =
  | 'system'
  | 'time'
  | 'pressure'
  | 'tension'
  | 'battle'
  | 'shield'
  | 'cascade'
  | 'mode'
  | 'telemetry'
  | 'sovereignty';

/**
 * 32-dim ML feature vector compat — mirrors TickStepRunnerMLVector from zero/.
 * All fields normalized to [0,1].
 */
export interface TickStepRunnerMLVectorCompat {
  // Step ordinal
  readonly stepOrdinalNorm: number;
  // Phase one-hot (5)
  readonly isOrchestrationPhase: number;
  readonly isEnginePhase: number;
  readonly isModePhase: number;
  readonly isObservabilityPhase: number;
  readonly isFinalizationPhase: number;
  // Owner one-hot (10)
  readonly isSystemOwner: number;
  readonly isTimeOwner: number;
  readonly isPressureOwner: number;
  readonly isTensionOwner: number;
  readonly isBattleOwner: number;
  readonly isShieldOwner: number;
  readonly isCascadeOwner: number;
  readonly isModeOwner: number;
  readonly isTelemetryOwner: number;
  readonly isSovereigntyOwner: number;
  // State flags (2)
  readonly mutatesState: number;
  readonly isEngineExecution: number;
  // Timing (3)
  readonly stepDurationNorm: number;
  readonly avgStepDurationNorm: number;
  readonly maxStepDurationNorm: number;
  // Signal analytics (2)
  readonly stepErrorRate: number;
  readonly phaseCompletionRatio: number;
  // Sequence analytics (2)
  readonly sequenceCompletionRatio: number;
  readonly slowStepFlag: number;
  // Health analytics (6)
  readonly recentErrorCountNorm: number;
  readonly stepSuccessRate: number;
  readonly healthGradeNumeric: number;
  readonly engineExecutionLoadRatio: number;
  readonly anomalyScore: number;
  readonly stepSinceLastErrorNorm: number;
  // Trailing feature (1)
  readonly phaseErrorRatio: number;
}

/** Structural compat for TickStepRunnerDLRow — 8 columns. */
export interface TickStepRunnerDLRowCompat {
  readonly stepOrdinalNorm: number;
  readonly durationNorm: number;
  readonly budgetUtilization: number;
  readonly errorRate: number;
  readonly signalDensityNorm: number;
  readonly skippedFlag: number;
  readonly rolledBackFlag: number;
  readonly overBudgetFlag: number;
}

/** Structural compat for full DL tensor — 13 rows × 8 cols. */
export type TickStepRunnerDLTensorCompat = readonly TickStepRunnerDLRowCompat[];

/** Structural compat for TickStepRunnerNarrationHint. */
export interface TickStepRunnerNarrationHintCompat {
  readonly phrase: string;
  readonly urgencyLabel: string;
  readonly heatMultiplier: number;
  readonly companionIntent: string;
  readonly audienceReaction: string;
}

/** Structural compat for TickStepRunnerAnnotation. */
export interface TickStepRunnerAnnotationCompat {
  readonly id: string;
  readonly step: string;
  readonly tick: number;
  readonly runId: string;
  readonly severity: TickStepRunnerSignalAdapterSeverityCompat;
  readonly operationKind: TickStepRunnerSignalAdapterOperationKindCompat;
  readonly message: string;
  readonly tags: readonly string[];
  readonly durationMs: number;
  readonly signalCount: number;
  readonly createdAtMs: number;
}

/** Structural compat for TickStepRunnerScoreResult. */
export interface TickStepRunnerScoreResultCompat {
  readonly severity: TickStepRunnerSignalAdapterSeverityCompat;
  readonly healthGrade: number;
  readonly heatMultiplier: number;
  readonly budgetUtilization: number;
  readonly anomalyScore: number;
  readonly narrationKey: string;
  readonly tags: readonly string[];
}

/** Structural compat for TickStepRunnerTrendSnapshot. */
export interface TickStepRunnerTrendSnapshotCompat {
  readonly step: string;
  readonly windowSize: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly minDurationMs: number;
  readonly errorRate: number;
  readonly rollbackRate: number;
  readonly skipRate: number;
  readonly overBudgetRate: number;
  readonly healthTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly computedAtMs: number;
}

/** Structural compat for TickStepRunnerSessionEntry. */
export interface TickStepRunnerSessionEntryCompat {
  readonly step: string;
  readonly tick: number;
  readonly durationMs: number;
  readonly signalCount: number;
  readonly errorCount: number;
  readonly skipped: boolean;
  readonly rolledBack: boolean;
  readonly severity: TickStepRunnerSignalAdapterSeverityCompat;
  readonly recordedAtMs: number;
}

/**
 * Main structural compat for TickStepRunnerChatSignal.
 * This is the primary ingress shape for the adapter.
 */
export interface TickStepRunnerSignalCompat {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly stepOrdinal: number;
  readonly phase: TickStepRunnerPhaseCompat;
  readonly owner: TickStepRunnerOwnerCompat;
  readonly engineId: string | null;
  readonly severity: TickStepRunnerSignalAdapterSeverityCompat;
  readonly operationKind: TickStepRunnerSignalAdapterOperationKindCompat;
  readonly healthGrade: number;
  readonly heatMultiplier: number;
  readonly budgetUtilization: number;
  readonly anomalyScore: number;
  readonly durationMs: number;
  readonly signalCount: number;
  readonly skipped: boolean;
  readonly rolledBack: boolean;
  readonly overBudget: boolean;
  readonly mode: TickStepRunnerModeCodeCompat | null;
  readonly phase_context: TickStepRunnerRunPhaseCompat | null;
  readonly pressureTier: TickStepRunnerPressureTierCompat | null;
  readonly narrationHint: string;
  readonly mlVector: TickStepRunnerMLVectorCompat;
  readonly dlRow: TickStepRunnerDLRowCompat;
  readonly annotation: TickStepRunnerAnnotationCompat | null;
  readonly trendSnapshot: TickStepRunnerTrendSnapshotCompat | null;
}

// ─── SEVERITY SCORING ─────────────────────────────────────────────────────────

/** Map severity to heat multiplier. */
const SEVERITY_HEAT_MAP: Readonly<Record<TickStepRunnerSignalAdapterSeverityCompat, number>> =
  Object.freeze({
    LOW: 0.1,
    MEDIUM: 0.4,
    HIGH: 0.7,
    CRITICAL: 1.0,
  });

/** Map severity to urgency label. */
const SEVERITY_URGENCY_LABEL: Readonly<Record<TickStepRunnerSignalAdapterSeverityCompat, string>> =
  Object.freeze({
    LOW: 'nominal',
    MEDIUM: 'watch',
    HIGH: 'escalate',
    CRITICAL: 'rescue',
  });

/** Map severity to companion intent. */
const SEVERITY_COMPANION_INTENT: Readonly<Record<TickStepRunnerSignalAdapterSeverityCompat, string>> =
  Object.freeze({
    LOW: 'advise',
    MEDIUM: 'coach',
    HIGH: 'escalate',
    CRITICAL: 'rescue',
  });

/** Map severity to audience reaction. */
const SEVERITY_AUDIENCE_REACTION: Readonly<Record<TickStepRunnerSignalAdapterSeverityCompat, string>> =
  Object.freeze({
    LOW: 'ambient',
    MEDIUM: 'attentive',
    HIGH: 'concerned',
    CRITICAL: 'alarmed',
  });

/** Build a narration hint from severity. */
function buildNarrationHint(
  signal: TickStepRunnerSignalCompat,
): TickStepRunnerNarrationHintCompat {
  const { severity, narrationHint } = signal;
  return Object.freeze({
    phrase: narrationHint,
    urgencyLabel: SEVERITY_URGENCY_LABEL[severity],
    heatMultiplier: SEVERITY_HEAT_MAP[severity],
    companionIntent: SEVERITY_COMPANION_INTENT[severity],
    audienceReaction: SEVERITY_AUDIENCE_REACTION[severity],
  });
}

// ─── INTERNAL ENVELOPE BUILDERS ──────────────────────────────────────────────

function buildChatSignalEnvelope(
  signal: TickStepRunnerSignalCompat,
  roomId: Nullable<ChatRoomId>,
): ChatSignalEnvelope {
  const hint = buildNarrationHint(signal);

  const metadata: Record<string, JsonValue> = {
    adapterVersion: TICK_STEP_RUNNER_SIGNAL_ADAPTER_MODULE_VERSION,
    schema: TICK_STEP_RUNNER_SIGNAL_ADAPTER_SCHEMA,
    step: signal.step,
    stepOrdinal: signal.stepOrdinal,
    phase: signal.phase,
    owner: signal.owner,
    engineId: signal.engineId ?? null,
    severity: signal.severity,
    operationKind: signal.operationKind,
    healthGrade: signal.healthGrade,
    heatMultiplier: signal.heatMultiplier,
    budgetUtilization: signal.budgetUtilization,
    anomalyScore: signal.anomalyScore,
    durationMs: signal.durationMs,
    signalCount: signal.signalCount,
    skipped: signal.skipped,
    rolledBack: signal.rolledBack,
    overBudget: signal.overBudget,
    narrationPhrase: hint.phrase,
    urgencyLabel: hint.urgencyLabel,
    companionIntent: hint.companionIntent,
    audienceReaction: hint.audienceReaction,
    mlFeatureCount: TICK_STEP_RUNNER_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    mode: signal.mode ?? null,
    phaseContext: signal.phase_context ?? null,
    pressureTier: signal.pressureTier ?? null,
    runId: signal.runId,
    tick: signal.tick,
    worldEventPrefix: TICK_STEP_RUNNER_SIGNAL_ADAPTER_WORLD_EVENT_PREFIX,
    // ML vector (sampled: first 8 dims for payload size control)
    mlVectorSample: [
      signal.mlVector.stepOrdinalNorm,
      signal.mlVector.isOrchestrationPhase,
      signal.mlVector.isEnginePhase,
      signal.mlVector.isModePhase,
      signal.mlVector.isObservabilityPhase,
      signal.mlVector.isFinalizationPhase,
      signal.mlVector.isSystemOwner,
      signal.mlVector.isTimeOwner,
    ],
    // DL row (all 8 cols)
    dlRow: {
      stepOrdinalNorm: signal.dlRow.stepOrdinalNorm,
      durationNorm: signal.dlRow.durationNorm,
      budgetUtilization: signal.dlRow.budgetUtilization,
      errorRate: signal.dlRow.errorRate,
      signalDensityNorm: signal.dlRow.signalDensityNorm,
      skippedFlag: signal.dlRow.skippedFlag,
      rolledBackFlag: signal.dlRow.rolledBackFlag,
      overBudgetFlag: signal.dlRow.overBudgetFlag,
    },
  };

  return Object.freeze({
    type: 'LIVEOPS' as const,
    emittedAt: nowMs(),
    roomId,
    liveops: Object.freeze({
      worldEventName: `${TICK_STEP_RUNNER_SIGNAL_ADAPTER_WORLD_EVENT_PREFIX}.${signal.step.toLowerCase()}.${signal.severity.toLowerCase()}` as Nullable<string>,
      heatMultiplier01: clamp01(signal.heatMultiplier),
      helperBlackout: false,
      haterRaidActive: signal.severity === 'CRITICAL',
    }),
    metadata: Object.freeze(metadata),
  });
}

function buildChatInputEnvelope(
  signal: TickStepRunnerSignalCompat,
  roomId: Nullable<ChatRoomId>,
): ChatInputEnvelope {
  return Object.freeze({
    kind: 'LIVEOPS_SIGNAL' as const,
    emittedAt: nowMs(),
    payload: buildChatSignalEnvelope(signal, roomId),
  });
}

function shouldEmitForMode(
  severity: TickStepRunnerSignalAdapterSeverityCompat,
  mode: TickStepRunnerSignalAdapterModeCompat,
): boolean {
  switch (mode) {
    case 'STRICT':
      return severity === 'HIGH' || severity === 'CRITICAL';
    case 'VERBOSE':
      return true;
    case 'DEFAULT':
    default:
      return severity !== 'LOW';
  }
}

// ─── ADAPTER CLASS ────────────────────────────────────────────────────────────

/**
 * TickStepRunnerSignalAdapter — translates TickStepRunner step execution signals
 * into backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * Imports ONLY from '../types' — no zero/ imports, no circular dependencies.
 * All TickStepRunner types are mirrored as structural compat shapes above.
 *
 * Usage:
 *   const adapter = new TickStepRunnerSignalAdapter('DEFAULT');
 *   const envelope = adapter.translate(signal, roomId);
 *   if (envelope) engine.chat.ingest(envelope);
 */
export class TickStepRunnerSignalAdapter {
  private readonly _mode: TickStepRunnerSignalAdapterModeCompat;

  public constructor(mode: TickStepRunnerSignalAdapterModeCompat = 'DEFAULT') {
    this._mode = mode;
  }

  /**
   * Translate a TickStepRunnerSignalCompat into a ChatInputEnvelope.
   * Returns null if the signal does not meet the emission threshold for this
   * adapter's mode.
   */
  public translate(
    signal: TickStepRunnerSignalCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope | null {
    if (!shouldEmitForMode(signal.severity, this._mode)) {
      return null;
    }
    return buildChatInputEnvelope(signal, roomId);
  }

  /**
   * Translate a batch of signals.
   * Returns only non-null envelopes (signals that pass the emission threshold).
   * Respects TICK_STEP_RUNNER_SIGNAL_ADAPTER_MAX_BATCH_SIZE.
   */
  public translateBatch(
    signals: readonly TickStepRunnerSignalCompat[],
    roomId: Nullable<ChatRoomId> = null,
  ): readonly ChatInputEnvelope[] {
    const batch = signals.slice(0, TICK_STEP_RUNNER_SIGNAL_ADAPTER_MAX_BATCH_SIZE);
    const results: ChatInputEnvelope[] = [];
    for (const signal of batch) {
      const envelope = this.translate(signal, roomId);
      if (envelope !== null) {
        results.push(envelope);
      }
    }
    return Object.freeze(results);
  }

  /**
   * Translate only CRITICAL severity signals from a batch.
   * Convenience helper for emergency routing.
   */
  public translateCritical(
    signals: readonly TickStepRunnerSignalCompat[],
    roomId: Nullable<ChatRoomId> = null,
  ): readonly ChatInputEnvelope[] {
    return this.translateBatch(
      signals.filter((s) => s.severity === 'CRITICAL'),
      roomId,
    );
  }

  /**
   * Translate only ROLLBACK operation signals.
   * Used by orchestrator replay surfaces to record rollback events.
   */
  public translateRollbacks(
    signals: readonly TickStepRunnerSignalCompat[],
    roomId: Nullable<ChatRoomId> = null,
  ): readonly ChatInputEnvelope[] {
    return this.translateBatch(
      signals.filter((s) => s.operationKind === 'ROLLBACK'),
      roomId,
    );
  }

  /**
   * Translate only ENGINE_STEP operation signals.
   * Used by engine execution reporters.
   */
  public translateEngineSteps(
    signals: readonly TickStepRunnerSignalCompat[],
    roomId: Nullable<ChatRoomId> = null,
  ): readonly ChatInputEnvelope[] {
    return this.translateBatch(
      signals.filter((s) => s.operationKind === 'ENGINE_STEP'),
      roomId,
    );
  }

  /**
   * Translate only over-budget step signals.
   * Used by timing diagnostic surfaces.
   */
  public translateOverBudget(
    signals: readonly TickStepRunnerSignalCompat[],
    roomId: Nullable<ChatRoomId> = null,
  ): readonly ChatInputEnvelope[] {
    return this.translateBatch(
      signals.filter((s) => s.overBudget || s.operationKind === 'BUDGET_EXCEEDED'),
      roomId,
    );
  }

  /**
   * Translate a signal and also return the full narration hint for companion routing.
   * Returns null if the signal does not meet the emission threshold.
   */
  public translateWithNarration(
    signal: TickStepRunnerSignalCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): {
    envelope: ChatInputEnvelope;
    narrationHint: TickStepRunnerNarrationHintCompat;
  } | null {
    if (!shouldEmitForMode(signal.severity, this._mode)) {
      return null;
    }
    return {
      envelope: buildChatInputEnvelope(signal, roomId),
      narrationHint: buildNarrationHint(signal),
    };
  }

  /**
   * Translate a signal into a raw ChatSignalEnvelope (no ChatInputEnvelope wrapper).
   * Used for direct signal inspection and testing.
   */
  public translateToSignalEnvelope(
    signal: TickStepRunnerSignalCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatSignalEnvelope | null {
    if (!shouldEmitForMode(signal.severity, this._mode)) {
      return null;
    }
    return buildChatSignalEnvelope(signal, roomId);
  }

  /**
   * Force translate regardless of emission threshold.
   * Used in VERBOSE test contexts and replay harnesses.
   */
  public forceTranslate(
    signal: TickStepRunnerSignalCompat,
    roomId: Nullable<ChatRoomId> = null,
  ): ChatInputEnvelope {
    return buildChatInputEnvelope(signal, roomId);
  }

  /** Check if the given severity would be emitted by this adapter. */
  public wouldEmit(severity: TickStepRunnerSignalAdapterSeverityCompat): boolean {
    return shouldEmitForMode(severity, this._mode);
  }

  get mode(): TickStepRunnerSignalAdapterModeCompat { return this._mode; }
}

// ─── NARRATION FACTORY ────────────────────────────────────────────────────────

/**
 * Build a standalone narration hint from a signal without creating an envelope.
 * Used for companion routing that doesn't need a full LIVEOPS_SIGNAL.
 */
export function buildTickStepRunnerNarrationHint(
  signal: TickStepRunnerSignalCompat,
): TickStepRunnerNarrationHintCompat {
  return buildNarrationHint(signal);
}

/**
 * Build a narration hint from raw severity + step + mode context.
 * Used when only partial signal data is available.
 */
export function buildTickStepRunnerNarrationHintFromParts(
  severity: TickStepRunnerSignalAdapterSeverityCompat,
  step: string,
  mode: TickStepRunnerModeCodeCompat,
  rolledBack: boolean,
  overBudget: boolean,
): TickStepRunnerNarrationHintCompat {
  let phrase: string;

  if (rolledBack) {
    phrase = `${step} rolled back in ${mode.toUpperCase()} mode — engine pressure exceeded tolerance.`;
  } else if (severity === 'CRITICAL') {
    phrase = `${step} CRITICAL in ${mode.toUpperCase()} — companion escalating.`;
  } else if (overBudget) {
    phrase = `${step} exceeded budget — ${mode.toUpperCase()} pressure noted.`;
  } else if (severity === 'HIGH') {
    phrase = `${step} degraded in ${mode.toUpperCase()} — companion watching.`;
  } else if (severity === 'MEDIUM') {
    phrase = `${step} slowing in ${mode.toUpperCase()} — companion advisory active.`;
  } else {
    phrase = `${step} nominal in ${mode.toUpperCase()}.`;
  }

  return Object.freeze({
    phrase,
    urgencyLabel: SEVERITY_URGENCY_LABEL[severity],
    heatMultiplier: SEVERITY_HEAT_MAP[severity],
    companionIntent: SEVERITY_COMPANION_INTENT[severity],
    audienceReaction: SEVERITY_AUDIENCE_REACTION[severity],
  });
}

// ─── ML VECTOR HELPERS ────────────────────────────────────────────────────────

/**
 * Build a zero-filled ML vector compat. Used for skipped or missing steps.
 */
export function buildZeroMLVectorCompat(
  stepOrdinal: number,
  totalSteps: number,
): TickStepRunnerMLVectorCompat {
  return Object.freeze({
    stepOrdinalNorm: totalSteps > 1 ? (stepOrdinal - 1) / (totalSteps - 1) : 0,
    isOrchestrationPhase: 0,
    isEnginePhase: 0,
    isModePhase: 0,
    isObservabilityPhase: 0,
    isFinalizationPhase: 0,
    isSystemOwner: 0,
    isTimeOwner: 0,
    isPressureOwner: 0,
    isTensionOwner: 0,
    isBattleOwner: 0,
    isShieldOwner: 0,
    isCascadeOwner: 0,
    isModeOwner: 0,
    isTelemetryOwner: 0,
    isSovereigntyOwner: 0,
    mutatesState: 0,
    isEngineExecution: 0,
    stepDurationNorm: 0,
    avgStepDurationNorm: 0,
    maxStepDurationNorm: 0,
    stepErrorRate: 0,
    phaseCompletionRatio: 0,
    sequenceCompletionRatio: stepOrdinal / Math.max(1, totalSteps),
    slowStepFlag: 0,
    recentErrorCountNorm: 0,
    stepSuccessRate: 1,
    healthGradeNumeric: 1,
    engineExecutionLoadRatio: 6 / 13,
    anomalyScore: 0,
    stepSinceLastErrorNorm: 1,
    phaseErrorRatio: 0,
  });
}

/**
 * Build a zero DL row compat. Used for missing steps in tensor construction.
 */
export function buildZeroDLRowCompat(
  stepOrdinal: number,
  totalSteps: number,
): TickStepRunnerDLRowCompat {
  return Object.freeze({
    stepOrdinalNorm: totalSteps > 1 ? (stepOrdinal - 1) / (totalSteps - 1) : 0,
    durationNorm: 0,
    budgetUtilization: 0,
    errorRate: 0,
    signalDensityNorm: 0,
    skippedFlag: 1,
    rolledBackFlag: 0,
    overBudgetFlag: 0,
  });
}

/**
 * Score a partial TickStepRunnerSignalCompat and return a Score01 health grade.
 * Used for companion routing when only partial signal data is available.
 */
export function scoreSignalHealthGrade(
  signal: Pick<
    TickStepRunnerSignalCompat,
    'rolledBack' | 'overBudget' | 'anomalyScore' | 'severity'
  >,
): Score01 {
  let score = 1.0;
  if (signal.rolledBack) score -= 0.5;
  if (signal.overBudget) score -= 0.2;
  if (signal.severity === 'CRITICAL') score -= 0.3;
  else if (signal.severity === 'HIGH') score -= 0.2;
  else if (signal.severity === 'MEDIUM') score -= 0.1;
  score -= signal.anomalyScore * 0.2;
  return clamp01(score);
}

// ─── SIGNAL COMPAT FACTORY ────────────────────────────────────────────────────

/**
 * Build a minimal TickStepRunnerSignalCompat from raw parts.
 * Used by orchestrator diagnostics and test harnesses that don't have
 * full ML vector data.
 */
export function buildMinimalSignalCompat(parts: {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly stepOrdinal: number;
  readonly phase: TickStepRunnerPhaseCompat;
  readonly owner: TickStepRunnerOwnerCompat;
  readonly engineId: string | null;
  readonly severity: TickStepRunnerSignalAdapterSeverityCompat;
  readonly operationKind: TickStepRunnerSignalAdapterOperationKindCompat;
  readonly durationMs: number;
  readonly signalCount: number;
  readonly skipped: boolean;
  readonly rolledBack: boolean;
  readonly overBudget: boolean;
  readonly narrationHint: string;
  readonly mode?: TickStepRunnerModeCodeCompat | null;
  readonly pressureTier?: TickStepRunnerPressureTierCompat | null;
}): TickStepRunnerSignalCompat {
  const heatMultiplier = SEVERITY_HEAT_MAP[parts.severity];
  const budgetMs = TICK_STEP_RUNNER_SIGNAL_ADAPTER_STEP_BUDGET_MS;
  const budgetUtilization = Math.min(1, parts.durationMs / budgetMs);
  const anomalyScore = Math.min(
    1,
    (parts.overBudget ? 0.4 : 0) + (parts.rolledBack ? 0.5 : 0),
  );
  const healthGrade = scoreSignalHealthGrade({
    rolledBack: parts.rolledBack,
    overBudget: parts.overBudget,
    anomalyScore,
    severity: parts.severity,
  });

  const mlVector = buildZeroMLVectorCompat(parts.stepOrdinal, 13);
  const dlRow = buildZeroDLRowCompat(parts.stepOrdinal, 13);

  return Object.freeze({
    runId: parts.runId,
    tick: parts.tick,
    step: parts.step,
    stepOrdinal: parts.stepOrdinal,
    phase: parts.phase,
    owner: parts.owner,
    engineId: parts.engineId,
    severity: parts.severity,
    operationKind: parts.operationKind,
    healthGrade: Number(healthGrade),
    heatMultiplier,
    budgetUtilization,
    anomalyScore,
    durationMs: parts.durationMs,
    signalCount: parts.signalCount,
    skipped: parts.skipped,
    rolledBack: parts.rolledBack,
    overBudget: parts.overBudget,
    mode: parts.mode ?? null,
    phase_context: null,
    pressureTier: parts.pressureTier ?? null,
    narrationHint: parts.narrationHint,
    mlVector,
    dlRow,
    annotation: null,
    trendSnapshot: null,
  });
}

// ─── TYPE GUARDS ──────────────────────────────────────────────────────────────

/** Type guard: true if value is a valid TickStepRunnerSignalAdapterSeverityCompat. */
export function isTickStepRunnerSignalAdapterSeverity(
  value: unknown,
): value is TickStepRunnerSignalAdapterSeverityCompat {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL';
}

/** Type guard: true if value is a valid TickStepRunnerSignalAdapterModeCompat. */
export function isTickStepRunnerSignalAdapterMode(
  value: unknown,
): value is TickStepRunnerSignalAdapterModeCompat {
  return value === 'DEFAULT' || value === 'STRICT' || value === 'VERBOSE';
}

/** Type guard: true if the signal represents a terminal (rollback/critical) operation. */
export function isTerminalSignalCompat(signal: TickStepRunnerSignalCompat): boolean {
  return signal.rolledBack || signal.severity === 'CRITICAL';
}

/** Type guard: true if the signal represents a budget-exceeded operation. */
export function isBudgetExceededSignalCompat(signal: TickStepRunnerSignalCompat): boolean {
  return signal.overBudget || signal.operationKind === 'BUDGET_EXCEEDED';
}

// ─── MANIFEST ─────────────────────────────────────────────────────────────────

export interface TickStepRunnerSignalAdapterManifest {
  readonly version: string;
  readonly schema: string;
  readonly ready: boolean;
  readonly mlFeatureCount: number;
  readonly dlTensorShape: readonly [13, 8];
  readonly maxBatchSize: number;
  readonly stepBudgetMs: number;
  readonly maxHeat: number;
  readonly worldEventPrefix: string;
  readonly adapterModes: readonly TickStepRunnerSignalAdapterModeCompat[];
  readonly severityLevels: readonly TickStepRunnerSignalAdapterSeverityCompat[];
  readonly operationKinds: readonly TickStepRunnerSignalAdapterOperationKindCompat[];
  readonly phases: readonly TickStepRunnerPhaseCompat[];
  readonly owners: readonly TickStepRunnerOwnerCompat[];
  readonly modes: readonly TickStepRunnerModeCodeCompat[];
  readonly pressureTiers: readonly TickStepRunnerPressureTierCompat[];
}

export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_MANIFEST: TickStepRunnerSignalAdapterManifest =
  Object.freeze({
    version: TICK_STEP_RUNNER_SIGNAL_ADAPTER_MODULE_VERSION,
    schema: TICK_STEP_RUNNER_SIGNAL_ADAPTER_SCHEMA,
    ready: TICK_STEP_RUNNER_SIGNAL_ADAPTER_READY,
    mlFeatureCount: TICK_STEP_RUNNER_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    dlTensorShape: TICK_STEP_RUNNER_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
    maxBatchSize: TICK_STEP_RUNNER_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
    stepBudgetMs: TICK_STEP_RUNNER_SIGNAL_ADAPTER_STEP_BUDGET_MS,
    maxHeat: TICK_STEP_RUNNER_SIGNAL_ADAPTER_MAX_HEAT,
    worldEventPrefix: TICK_STEP_RUNNER_SIGNAL_ADAPTER_WORLD_EVENT_PREFIX,
    adapterModes: Object.freeze(['DEFAULT', 'STRICT', 'VERBOSE'] as const),
    severityLevels: Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const),
    operationKinds: Object.freeze([
      'ENGINE_STEP',
      'SYNTHETIC_STEP',
      'NOOP_STEP',
      'ROLLBACK',
      'SKIP',
      'CONTRACT_VIOLATION',
      'BUDGET_EXCEEDED',
      'HEALTH_CHANGE',
    ] as const),
    phases: Object.freeze([
      'ORCHESTRATION',
      'ENGINE',
      'MODE',
      'OBSERVABILITY',
      'FINALIZATION',
    ] as const),
    owners: Object.freeze([
      'system',
      'time',
      'pressure',
      'tension',
      'battle',
      'shield',
      'cascade',
      'mode',
      'telemetry',
      'sovereignty',
    ] as const),
    modes: Object.freeze(['solo', 'pvp', 'coop', 'ghost'] as const),
    pressureTiers: Object.freeze(['T0', 'T1', 'T2', 'T3', 'T4'] as const),
  });

// ─── SINGLETONS ───────────────────────────────────────────────────────────────

/**
 * Default singleton adapter — emits for MEDIUM/HIGH/CRITICAL.
 */
export const TICK_STEP_RUNNER_DEFAULT_SIGNAL_ADAPTER: TickStepRunnerSignalAdapter =
  new TickStepRunnerSignalAdapter('DEFAULT');

/**
 * Strict singleton adapter — emits only for HIGH/CRITICAL.
 */
export const TICK_STEP_RUNNER_STRICT_SIGNAL_ADAPTER: TickStepRunnerSignalAdapter =
  new TickStepRunnerSignalAdapter('STRICT');

/**
 * Verbose singleton adapter — emits for all signals including LOW.
 */
export const TICK_STEP_RUNNER_VERBOSE_SIGNAL_ADAPTER: TickStepRunnerSignalAdapter =
  new TickStepRunnerSignalAdapter('VERBOSE');

// ─── EXPORT BUNDLE ────────────────────────────────────────────────────────────

/**
 * Canonical export bundle for the TickStepRunnerSignalAdapter surface.
 * Used by the chat adapter index to re-export as a named group.
 */
export const TICK_STEP_RUNNER_SIGNAL_ADAPTER_BUNDLE = Object.freeze({
  manifest: TICK_STEP_RUNNER_SIGNAL_ADAPTER_MANIFEST,
  defaultAdapter: TICK_STEP_RUNNER_DEFAULT_SIGNAL_ADAPTER,
  strictAdapter: TICK_STEP_RUNNER_STRICT_SIGNAL_ADAPTER,
  verboseAdapter: TICK_STEP_RUNNER_VERBOSE_SIGNAL_ADAPTER,
  buildNarrationHint: buildTickStepRunnerNarrationHint,
  buildNarrationHintFromParts: buildTickStepRunnerNarrationHintFromParts,
  buildZeroMLVector: buildZeroMLVectorCompat,
  buildZeroDLRow: buildZeroDLRowCompat,
  scoreHealthGrade: scoreSignalHealthGrade,
  buildMinimalSignal: buildMinimalSignalCompat,
  isTerminalSignal: isTerminalSignalCompat,
  isBudgetExceededSignal: isBudgetExceededSignalCompat,
  isValidSeverity: isTickStepRunnerSignalAdapterSeverity,
  isValidMode: isTickStepRunnerSignalAdapterMode,
  version: TICK_STEP_RUNNER_SIGNAL_ADAPTER_MODULE_VERSION,
  schema: TICK_STEP_RUNNER_SIGNAL_ADAPTER_SCHEMA,
  ready: TICK_STEP_RUNNER_SIGNAL_ADAPTER_READY,
} as const);

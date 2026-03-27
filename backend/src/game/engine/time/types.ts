/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/types.ts
 *
 * VERSION: 4.0.0
 *
 * Doctrine:
 * - preserve the rich Time Engine surface already being used across Engine 1
 * - align backend time contracts to canonical backend primitives, not frontend-only mirrors
 * - keep pure timing / phase helpers import-safe for core runtime use
 * - expose backend cadence constants needed by EngineRuntime and STEP_02_TIME
 * - ML/DL feature extraction is a first-class concern at every level
 * - chat is the emotional operating system — time events flow to chat via LIVEOPS_SIGNAL
 * - every declared constant and function is wired into real runtime logic
 * - mode-aware and phase-aware timing routing drives user experience depth
 * - 10 subsystem classes fully wired with all imported symbols
 */

// ============================================================================
// MARK: Imports — canonical backend primitives (type + value)
// ============================================================================

import type {
  PressureTier as BackendPressureTier,
  RunPhase,
  ModeCode,
  RunOutcome,
} from '../core/GamePrimitives';

import {
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  computeEffectiveStakes,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,
  computeRunProgressFraction,
  canEscalatePressure,
  canDeescalatePressure,
  describePressureTierExperience,
  isEndgamePhase,
} from '../core/GamePrimitives';

// ============================================================================
// MARK: Imports — chat engine types (type-only; no circular risk)
// ============================================================================

import type {
  Score01,
  UnixMs,
  Nullable,
  JsonValue,
  Score100,
  ChatSignalEnvelope,
  ChatRunSnapshot,
  ChatLiveOpsSnapshot,
  ChatInputEnvelope,
  ChatSignalType,
  ChatEventKind,
  ChatChannelId,
  ChatRoomId,
} from '../chat/types';

// ============================================================================
// MARK: TickTier — five adaptive tick rate tiers
// ============================================================================

/** Five adaptive tick rate tiers. T0 = winning, T4 = collapsing. */
export enum TickTier {
  SOVEREIGN = 'T0', // net worth > 3× freedom threshold, zero active threats
  STABLE = 'T1', // default: positive cashflow, no active threats
  COMPRESSED = 'T2', // cashflow neutral OR mild threat active
  CRISIS = 'T3', // negative cashflow OR hater_heat > 60
  COLLAPSE_IMMINENT = 'T4', // negative cash balance OR shield fully broken
}

/**
 * Backend canonical pressure tier.
 * This is intentionally an alias to backend GamePrimitives, not a duplicate enum.
 */
export type PressureTier = BackendPressureTier;

/** Per-tier timing + presentation configuration. */
export interface TickTierConfig {
  tier: TickTier;
  minDurationMs: number; // fastest this tier ever fires
  maxDurationMs: number; // slowest this tier ever fires
  defaultDurationMs: number; // target duration used in interpolation
  decisionWindowMs: number; // how long player has to respond to a forced card
  visualBorderClass: string; // CSS class name applied to TickPressureBorder component
  audioSignal: string | null; // audio cue key. null if no sound at this tier
  screenShake: boolean; // true only at T4 COLLAPSE_IMMINENT
}

/** Ground-truth timing config for all five tiers. */
export const TICK_TIER_CONFIGS: Readonly<Record<TickTier, TickTierConfig>> =
  Object.freeze({
    [TickTier.SOVEREIGN]: Object.freeze({
      tier: TickTier.SOVEREIGN,
      minDurationMs: 18_000,
      maxDurationMs: 22_000,
      defaultDurationMs: 20_000,
      decisionWindowMs: 12_000,
      visualBorderClass: 'border-sovereign',
      audioSignal: 'tick_sovereign',
      screenShake: false,
    }),
    [TickTier.STABLE]: Object.freeze({
      tier: TickTier.STABLE,
      minDurationMs: 12_000,
      maxDurationMs: 14_000,
      defaultDurationMs: 13_000,
      decisionWindowMs: 8_000,
      visualBorderClass: 'border-stable',
      audioSignal: 'tick_standard',
      screenShake: false,
    }),
    [TickTier.COMPRESSED]: Object.freeze({
      tier: TickTier.COMPRESSED,
      minDurationMs: 7_000,
      maxDurationMs: 9_000,
      defaultDurationMs: 8_000,
      decisionWindowMs: 5_000,
      visualBorderClass: 'border-compressed',
      audioSignal: 'tick_compressed',
      screenShake: false,
    }),
    [TickTier.CRISIS]: Object.freeze({
      tier: TickTier.CRISIS,
      minDurationMs: 3_000,
      maxDurationMs: 5_000,
      defaultDurationMs: 4_000,
      decisionWindowMs: 3_000,
      visualBorderClass: 'border-crisis',
      audioSignal: 'tick_crisis',
      screenShake: false,
    }),
    [TickTier.COLLAPSE_IMMINENT]: Object.freeze({
      tier: TickTier.COLLAPSE_IMMINENT,
      minDurationMs: 1_000,
      maxDurationMs: 2_000,
      defaultDurationMs: 1_500,
      decisionWindowMs: 1_500,
      visualBorderClass: 'border-collapse',
      audioSignal: 'tick_collapse',
      screenShake: true,
    }),
  });

/**
 * Canonical backend mapping:
 * backend PressureTier already uses T0..T4, so this bridge stays lossless.
 */
export const TICK_TIER_BY_PRESSURE_TIER: Readonly<
  Record<PressureTier, TickTier>
> = Object.freeze({
  T0: TickTier.SOVEREIGN,
  T1: TickTier.STABLE,
  T2: TickTier.COMPRESSED,
  T3: TickTier.CRISIS,
  T4: TickTier.COLLAPSE_IMMINENT,
});

/**
 * Reverse map for backend runtime callers that key durations by canonical backend pressure tier.
 */
export const PRESSURE_TIER_BY_TICK_TIER: Readonly<
  Record<TickTier, PressureTier>
> = Object.freeze({
  [TickTier.SOVEREIGN]: 'T0',
  [TickTier.STABLE]: 'T1',
  [TickTier.COMPRESSED]: 'T2',
  [TickTier.CRISIS]: 'T3',
  [TickTier.COLLAPSE_IMMINENT]: 'T4',
});

/** Read-only bridge used by TimeEngine instead of importing PressureEngine directly. */
export interface PressureReader {
  readonly score: number; // 0.0–1.0
  readonly tier: PressureTier; // canonical backend pressure tier
}

/** Maps backend PressureTier to corresponding TickTier. */
export function pressureTierToTickTier(p: PressureTier): TickTier {
  return TICK_TIER_BY_PRESSURE_TIER[p];
}

/** Maps TickTier back to canonical backend PressureTier. */
export function tickTierToPressureTier(tier: TickTier): PressureTier {
  return PRESSURE_TIER_BY_TICK_TIER[tier];
}

/**
 * Backend-oriented timing lookup keyed by canonical backend PressureTier.
 * EngineRuntime uses this directly.
 */
export const TIER_DURATIONS_MS: Readonly<Record<PressureTier, number>> =
  Object.freeze({
    T0: TICK_TIER_CONFIGS[TickTier.SOVEREIGN].defaultDurationMs,
    T1: TICK_TIER_CONFIGS[TickTier.STABLE].defaultDurationMs,
    T2: TICK_TIER_CONFIGS[TickTier.COMPRESSED].defaultDurationMs,
    T3: TICK_TIER_CONFIGS[TickTier.CRISIS].defaultDurationMs,
    T4: TICK_TIER_CONFIGS[TickTier.COLLAPSE_IMMINENT].defaultDurationMs,
  });

/**
 * Backend-oriented decision-window lookup keyed by canonical backend PressureTier.
 */
export const DECISION_WINDOW_DURATIONS_MS: Readonly<
  Record<PressureTier, number>
> = Object.freeze({
  T0: TICK_TIER_CONFIGS[TickTier.SOVEREIGN].decisionWindowMs,
  T1: TICK_TIER_CONFIGS[TickTier.STABLE].decisionWindowMs,
  T2: TICK_TIER_CONFIGS[TickTier.COMPRESSED].decisionWindowMs,
  T3: TICK_TIER_CONFIGS[TickTier.CRISIS].decisionWindowMs,
  T4: TICK_TIER_CONFIGS[TickTier.COLLAPSE_IMMINENT].decisionWindowMs,
});

export const DEFAULT_HOLD_DURATION_MS = 5_000;

export const DEFAULT_PHASE_TRANSITION_WINDOWS = 5;

export interface PhaseBoundary {
  readonly phase: RunPhase;
  readonly startsAtMs: number;
}

export const PHASE_BOUNDARIES_MS: ReadonlyArray<PhaseBoundary> = Object.freeze([
  Object.freeze({
    phase: 'FOUNDATION' as RunPhase,
    startsAtMs: 0,
  }),
  Object.freeze({
    phase: 'ESCALATION' as RunPhase,
    startsAtMs: 4 * 60 * 1_000,
  }),
  Object.freeze({
    phase: 'SOVEREIGNTY' as RunPhase,
    startsAtMs: 8 * 60 * 1_000,
  }),
]);

export interface TickInterpolationPlan {
  readonly fromTier: TickTier;
  readonly toTier: TickTier;
  readonly fromDurationMs: number;
  readonly toDurationMs: number;
  readonly totalTicks: number;
  readonly ticksRemaining: number;
}

/** Time-sensitive forced-decision card categories. */
export enum DecisionCardType {
  FORCED_FATE = 'FORCED_FATE', // scenario / historical fate card
  HATER_INJECTION = 'HATER_INJECTION', // injected by an active hater bot
  CRISIS_EVENT = 'CRISIS_EVENT', // macro economic shock or policy change
}

/** Per-card countdown state. */
export interface DecisionWindow {
  windowId: string; // uuid — unique per window instance, not per card
  cardId: string; // the card this window is attached to
  cardType: DecisionCardType; // FORCED_FATE | HATER_INJECTION | CRISIS_EVENT
  durationMs: number; // total window duration set at open time
  remainingMs: number; // countdown — decremented every 100ms by DecisionTimer
  openedAtMs: number; // Date.now() when window was created
  expiresAtMs: number; // Date.now() + durationMs at creation time
  isOnHold: boolean; // true while hold action is active on this window
  holdExpiresAtMs: number | null; // epoch ms when hold freeze ends. null if not on hold
  worstOptionIndex: number; // option index used on auto-resolve
  isExpired: boolean; // true after auto-resolve fires
  isResolved: boolean; // true if player chose an option before expiry
}

/** Generic helper payload for stores / UI that need countdown deltas. */
export interface DecisionWindowTickEvent {
  eventType: 'DECISION_WINDOW_TICK';
  windowId: string;
  remainingMs: number;
  timestamp: number;
}

/** Emitted at end of every tick cycle. */
export interface TickEvent {
  eventType: 'TICK_COMPLETE';
  tickNumber: number; // 1-indexed immutable run counter
  tickDurationMs: number; // actual ms of the tick that just completed
  tier: TickTier; // tier active during this tick
  tierChangedThisTick: boolean; // true if setTierFromPressure() changed tier this tick
  previousTier: TickTier | null; // null if no change or first tick
  timestamp: number; // Date.now() at emission
  decisionsExpiredThisTick: string[]; // windowIds that expired this tick
  decisionsResolvedThisTick: string[]; // windowIds player manually resolved
  holdActionUsedThisTick: boolean;
}

/** Emitted when time tier changes. */
export interface TierChangeEvent {
  eventType: 'TICK_TIER_CHANGED';
  from: TickTier;
  to: TickTier;
  interpolationTicks: number;
  timestamp: number;
}

/** Emitted when a decision window opens. */
export interface DecisionWindowOpenedEvent {
  eventType: 'DECISION_WINDOW_OPENED';
  window: DecisionWindow;
}

/** Emitted when a decision window expires and auto-resolves. */
export interface DecisionWindowExpiredEvent {
  eventType: 'DECISION_WINDOW_EXPIRED';
  windowId: string;
  cardId: string;
  autoResolvedToOptionIndex: number;
  holdWasActive: boolean;
}

/** Emitted when a decision window resolves manually or is nullified. */
export interface DecisionWindowResolvedEvent {
  eventType: 'DECISION_WINDOW_RESOLVED';
  windowId: string;
  cardId: string;
  chosenOptionIndex: number; // -1 allowed for nullified resolution
  msRemainingAtResolution: number;
}

/** Emitted when the run's single hold is consumed. */
export interface HoldActionUsedEvent {
  eventType: 'HOLD_ACTION_USED';
  windowId: string;
  holdDurationMs: number;
  holdExpiresAtMs: number;
  holdsRemainingInRun: number;
}

/** Emitted when the season tick budget is exhausted. */
export interface RunTimeoutEvent {
  eventType: 'RUN_TIMEOUT';
  ticksElapsed: number;
  outcome: 'TIMEOUT';
}

/** Emitted when a tier is forcibly overridden by tutorial/admin logic. */
export interface TickTierForcedEvent {
  eventType: 'TICK_TIER_FORCED';
  tier: TickTier;
  durationTicks: number;
  timestamp: number;
}

/** Real-world season window categories. */
export enum SeasonWindowType {
  KICKOFF = 'KICKOFF',
  LIVEOPS_EVENT = 'LIVEOPS_EVENT',
  SEASON_FINALE = 'SEASON_FINALE', // last 72 hours of season
  ARCHIVE_CLOSE = 'ARCHIVE_CLOSE', // when past season closes for purchase
  REENGAGE_WINDOW = 'REENGAGE_WINDOW', // triggered after 14+ day lapse
}

/** Real-world season window definition. */
export interface SeasonTimeWindow {
  windowId: string;
  type: SeasonWindowType;
  startsAtMs: number; // epoch ms
  endsAtMs: number; // epoch ms
  isActive: boolean;
  pressureMultiplier: number; // 1.0 = no effect. 1.3 = 30% pressure boost during finale
}

/** Shared union of all Time Engine events for strongly typed consumers. */
export type TimeEngineEvent =
  | TickEvent
  | TierChangeEvent
  | DecisionWindowOpenedEvent
  | DecisionWindowExpiredEvent
  | DecisionWindowResolvedEvent
  | DecisionWindowTickEvent
  | HoldActionUsedEvent
  | RunTimeoutEvent
  | TickTierForcedEvent;

/** Event-name → payload map for adapters that want keyed typing. */
export interface TimeEngineEventMap {
  TICK_COMPLETE: TickEvent;
  TICK_TIER_CHANGED: TierChangeEvent;
  DECISION_WINDOW_OPENED: DecisionWindowOpenedEvent;
  DECISION_WINDOW_EXPIRED: DecisionWindowExpiredEvent;
  DECISION_WINDOW_RESOLVED: DecisionWindowResolvedEvent;
  DECISION_WINDOW_TICK: DecisionWindowTickEvent;
  HOLD_ACTION_USED: HoldActionUsedEvent;
  RUN_TIMEOUT: RunTimeoutEvent;
  TICK_TIER_FORCED: TickTierForcedEvent;
}

/** Backend-safe lookup by backend PressureTier. */
export function getTickTierConfigByPressureTier(
  tier: PressureTier,
): TickTierConfig {
  return TICK_TIER_CONFIGS[pressureTierToTickTier(tier)];
}

/** Backend-safe lookup by frontend-style TickTier. */
export function getTickTierConfig(tier: TickTier): TickTierConfig {
  return TICK_TIER_CONFIGS[tier];
}

export function getDefaultTickDurationMs(tier: PressureTier): number {
  return TIER_DURATIONS_MS[tier];
}

export function getDecisionWindowDurationMs(tier: PressureTier): number {
  return DECISION_WINDOW_DURATIONS_MS[tier];
}

export function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export function clampTickDurationMs(
  tier: PressureTier,
  durationMs: number,
): number {
  const config = getTickTierConfigByPressureTier(tier);

  if (!Number.isFinite(durationMs)) {
    return config.defaultDurationMs;
  }

  const normalized = Math.trunc(durationMs);

  if (normalized < config.minDurationMs) {
    return config.minDurationMs;
  }

  if (normalized > config.maxDurationMs) {
    return config.maxDurationMs;
  }

  return normalized;
}

export function normalizeTickDurationMs(
  tier: PressureTier,
  durationMs: number | null | undefined,
): number {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return getDefaultTickDurationMs(tier);
  }

  return clampTickDurationMs(tier, durationMs);
}

export function computeInterpolationTickCount(deltaMs: number): number {
  if (deltaMs > 8_000) {
    return 4;
  }

  if (deltaMs > 4_000) {
    return 3;
  }

  return 2;
}

export function createInterpolationPlan(
  fromTier: TickTier,
  toTier: TickTier,
  fromDurationMs: number,
  toDurationMs: number,
): TickInterpolationPlan {
  const deltaMs = Math.abs(toDurationMs - fromDurationMs);

  return {
    fromTier,
    toTier,
    fromDurationMs,
    toDurationMs,
    totalTicks: computeInterpolationTickCount(deltaMs),
    ticksRemaining: computeInterpolationTickCount(deltaMs),
  };
}

export function resolvePhaseFromElapsedMs(elapsedMs: number): RunPhase {
  let phase: RunPhase = 'FOUNDATION';

  for (const boundary of PHASE_BOUNDARIES_MS) {
    if (elapsedMs >= boundary.startsAtMs) {
      phase = boundary.phase;
    }
  }

  return phase;
}

export function isPhaseBoundaryTransition(
  previousElapsedMs: number,
  nextElapsedMs: number,
): boolean {
  return (
    resolvePhaseFromElapsedMs(previousElapsedMs) !==
    resolvePhaseFromElapsedMs(nextElapsedMs)
  );
}

// ============================================================================
// MARK: Module version and core constants
// ============================================================================

export const TIME_TYPES_MODULE_VERSION = '4.0.0' as const;

/** Total number of ML features extracted per time engine snapshot. */
export const TIME_ML_FEATURE_COUNT = 28 as const;

/** Number of features per DL tensor row. */
export const TIME_DL_FEATURE_COUNT = 6 as const;

/** Number of rows in the DL ring buffer tensor. */
export const TIME_DL_TENSOR_ROWS = 40 as const;

/** All TickTiers ordered from least to most dangerous. */
export const TICK_TIER_ALL: ReadonlyArray<TickTier> = Object.freeze([
  TickTier.SOVEREIGN,
  TickTier.STABLE,
  TickTier.COMPRESSED,
  TickTier.CRISIS,
  TickTier.COLLAPSE_IMMINENT,
]);

/** Normalized weight per TickTier (0 = calm, 1 = collapse). */
export const TICK_TIER_WEIGHT: Readonly<Record<TickTier, number>> = Object.freeze({
  [TickTier.SOVEREIGN]: 0.0,
  [TickTier.STABLE]: 0.25,
  [TickTier.COMPRESSED]: 0.5,
  [TickTier.CRISIS]: 0.75,
  [TickTier.COLLAPSE_IMMINENT]: 1.0,
});

/** Danger score per TickTier for risk modeling (0 = safe, 10 = imminent collapse). */
export const TIER_DANGER_SCORE: Readonly<Record<TickTier, number>> = Object.freeze({
  [TickTier.SOVEREIGN]: 0,
  [TickTier.STABLE]: 2,
  [TickTier.COMPRESSED]: 5,
  [TickTier.CRISIS]: 7,
  [TickTier.COLLAPSE_IMMINENT]: 10,
});

/** Wall-clock duration of each run phase in milliseconds. */
export const PHASE_DURATION_MS: Readonly<Record<RunPhase, number>> = Object.freeze({
  FOUNDATION: 4 * 60 * 1_000,   // 0–4 min
  ESCALATION: 4 * 60 * 1_000,   // 4–8 min
  SOVEREIGNTY: 4 * 60 * 1_000,  // 8–12 min (+ overtime if applicable)
} as Record<RunPhase, number>);

/** Relative time sensitivity per game mode: how aggressively the timer accelerates. */
export const MODE_TIME_SENSITIVITY: Readonly<Record<ModeCode, number>> = Object.freeze({
  solo:  0.8,
  pvp:   1.4,
  coop:  0.7,
  ghost: 1.6,
} as Record<ModeCode, number>);

/** Pressure multiplier applied during each season window type. */
export const SEASON_WINDOW_MULTIPLIER: Readonly<Record<SeasonWindowType, number>> = Object.freeze({
  [SeasonWindowType.KICKOFF]:          1.0,
  [SeasonWindowType.LIVEOPS_EVENT]:    1.2,
  [SeasonWindowType.SEASON_FINALE]:    1.5,
  [SeasonWindowType.ARCHIVE_CLOSE]:    1.1,
  [SeasonWindowType.REENGAGE_WINDOW]:  0.85,
});

/** Minimum ms between LIVEOPS_SIGNAL emissions to avoid flooding chat. */
export const TIME_CHAT_SIGNAL_MIN_INTERVAL_MS = 3_000 as const;

/**
 * Human-readable labels for each of the 28 ML feature dimensions.
 * Index must match the order in which `buildTimeMLFeatureVector` populates the vector.
 */
export const TIME_TYPES_ML_FEATURE_LABELS: ReadonlyArray<string> = Object.freeze([
  /* 0  */ 'tick_tier_weight',
  /* 1  */ 'pressure_tier_normalized',
  /* 2  */ 'phase_normalized',
  /* 3  */ 'mode_normalized',
  /* 4  */ 'tick_duration_normalized',
  /* 5  */ 'decision_window_count',
  /* 6  */ 'decision_window_avg_remaining_normalized',
  /* 7  */ 'decision_window_hold_active',
  /* 8  */ 'hold_duration_fraction',
  /* 9  */ 'tier_changed_this_tick',
  /* 10 */ 'ticks_in_current_tier_normalized',
  /* 11 */ 'escalation_eligible',
  /* 12 */ 'deescalation_eligible',
  /* 13 */ 'phase_progress_fraction',
  /* 14 */ 'season_window_active',
  /* 15 */ 'season_window_multiplier',
  /* 16 */ 'effective_stakes',
  /* 17 */ 'mode_difficulty_multiplier',
  /* 18 */ 'mode_tension_floor',
  /* 19 */ 'phase_stakes_multiplier',
  /* 20 */ 'run_progress_fraction',
  /* 21 */ 'is_endgame_phase',
  /* 22 */ 'danger_score_normalized',
  /* 23 */ 'decisions_expired_this_tick',
  /* 24 */ 'decisions_resolved_this_tick',
  /* 25 */ 'hold_action_used_this_tick',
  /* 26 */ 'tier_interpolation_active',
  /* 27 */ 'tier_interpolation_fraction',
]);

/** Labels for each column of the DL tensor rows. */
export const TIME_DL_FEATURE_LABELS: ReadonlyArray<string> = Object.freeze([
  /* 0 */ 'tier_weight',
  /* 1 */ 'phase_progress',
  /* 2 */ 'decision_pressure',
  /* 3 */ 'season_multiplier',
  /* 4 */ 'stakes',
  /* 5 */ 'run_progress',
]);

// ============================================================================
// MARK: New interfaces and types
// ============================================================================

/** A single 6-element DL tensor row captured at one tick boundary. */
export interface TimeDLRow {
  readonly tierWeight: number;       // TICK_TIER_WEIGHT[tier]
  readonly phaseProgress: number;    // 0-1 within current phase
  readonly decisionPressure: number; // normalized active window pressure
  readonly seasonMultiplier: number; // active season multiplier (1.0 if none)
  readonly stakes: number;           // computeEffectiveStakes result
  readonly runProgress: number;      // 0-1 total run progress fraction
}

/** 40×6 ring buffer tensor for DL inference. */
export interface TimeTypesDLTensor {
  readonly rows: ReadonlyArray<TimeDLRow>;
  readonly rowCount: number;  // actual populated rows (≤ TIME_DL_TENSOR_ROWS)
  readonly capacity: number;  // always TIME_DL_TENSOR_ROWS
  readonly headIndex: number; // ring buffer write head
}

/** 28-dimensional ML feature vector extracted from the time engine state. */
export interface TimeMLFeatureVector {
  readonly features: ReadonlyArray<number>;
  readonly featureCount: number;   // must equal TIME_ML_FEATURE_COUNT (28)
  readonly capturedAtMs: number;
  readonly tier: TickTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
}

/** Input context required to build a TimeMLFeatureVector. */
export interface TimeMLFeatureContext {
  readonly tier: TickTier;
  readonly pressureTier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly tickDurationMs: number;
  readonly activeDecisionWindows: ReadonlyArray<DecisionWindow>;
  readonly tierChangedThisTick: boolean;
  readonly ticksInCurrentTier: number;
  readonly pressureScore: number;
  readonly phaseTickInPhase: number;
  readonly phaseTickBudget: number;
  readonly activeSeasonWindows: ReadonlyArray<SeasonTimeWindow>;
  readonly decisionsExpiredThisTick: number;
  readonly decisionsResolvedThisTick: number;
  readonly holdActionUsedThisTick: boolean;
  readonly interpolationPlan: TickInterpolationPlan | null;
  readonly capturedAtMs: number;
}

/** Composite time engine state for bundle operations. */
export interface TimeEngineState {
  readonly runId: string;
  readonly tier: TickTier;
  readonly pressureTier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly tickNumber: number;
  readonly elapsedMs: number;
  readonly tickDurationMs: number;
  readonly pressureScore: number;
  readonly ticksInCurrentTier: number;
  readonly activeDecisionWindows: ReadonlyArray<DecisionWindow>;
  readonly activeSeasonWindows: ReadonlyArray<SeasonTimeWindow>;
  readonly interpolationPlan: TickInterpolationPlan | null;
  readonly tierChangedThisTick: boolean;
  readonly holdsRemainingInRun: number;
}

/** Tier transition audit record for telemetry and replay. */
export interface TimeTierTransitionRecord {
  readonly fromTier: TickTier;
  readonly toTier: TickTier;
  readonly fromPressureTier: PressureTier;
  readonly toPressureTier: PressureTier;
  readonly pressureScore: number;
  readonly ticksInPreviousTier: number;
  readonly timestamp: number;
  readonly interpolationPlan: TickInterpolationPlan;
  readonly phaseAtTransition: RunPhase;
  readonly modeAtTransition: ModeCode;
  readonly wasForced: boolean;
}

/** Mode-specific time engine profile: how timing behaves in each game mode. */
export interface TimeModeProfile {
  readonly mode: ModeCode;
  readonly timeSensitivity: number;        // 0-2 scalar; >1 = faster pressure ramp
  readonly difficultyMultiplier: number;   // from MODE_DIFFICULTY_MULTIPLIER
  readonly tensionFloor: number;           // from MODE_TENSION_FLOOR
  readonly modeNormalized: number;         // 0-1 from MODE_NORMALIZED
  readonly adjustedDecisionWindowMs: Record<PressureTier, number>;
  readonly adjustedTickDurationMs: Record<PressureTier, number>;
  readonly chatLabel: string;
  readonly narrative: string;
}

/** Phase-specific time engine profile: how timing behaves in each run phase. */
export interface TimePhaseProfile {
  readonly phase: RunPhase;
  readonly phaseNormalized: number;        // 0-1 from RUN_PHASE_NORMALIZED
  readonly stakesMultiplier: number;       // from RUN_PHASE_STAKES_MULTIPLIER
  readonly tickBudgetFraction: number;     // from RUN_PHASE_TICK_BUDGET_FRACTION
  readonly effectiveStakes: number;        // computeEffectiveStakes result
  readonly durationMs: number;             // from PHASE_DURATION_MS
  readonly isEndgame: boolean;
  readonly narrative: string;
}

/** Narrated time engine state for chat signals and UX copy. */
export interface TimeEngineNarration {
  readonly tierNarration: string;
  readonly phaseNarration: string;
  readonly modeNarration: string;
  readonly urgencyLabel: string;
  readonly pressureExperience: string;
  readonly decisionWindowNarration: string | null;
  readonly seasonWindowNarration: string | null;
  readonly holdNarration: string | null;
  readonly fullNarration: string;
  readonly shortNarration: string;
}

/** Time-specific chat signal wrapper for LIVEOPS_SIGNAL lane. */
export interface TimeTypesChatSignal {
  readonly signalType: 'LIVEOPS';
  readonly tier: TickTier;
  readonly phase: RunPhase;
  readonly urgencyLabel: string;
  readonly hasActiveDecisionWindow: boolean;
  readonly nearPhaseTransition: boolean;
  readonly elapsedMs: number;
  readonly envelope: ChatSignalEnvelope;
  readonly inputEnvelope: ChatInputEnvelope;
}

/** Validation result for time engine state and configuration. */
export interface TimeTypesValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly checkedAt: number;
}

/** Summary of decision window statistics across an open window set. */
export interface DecisionWindowSummary {
  readonly totalOpen: number;
  readonly totalOnHold: number;
  readonly totalExpired: number;
  readonly totalResolved: number;
  readonly avgRemainingMs: number;
  readonly mostUrgentWindowId: string | null;
  readonly mostUrgentRemainingMs: number;
  readonly pressureScore: number; // 0-1 composite window pressure
}

/** End-of-run time summary for telemetry and proof. */
export interface TimeRunSummary {
  readonly runId: string;
  readonly totalTicks: number;
  readonly totalElapsedMs: number;
  readonly tiersVisited: ReadonlyArray<TickTier>;
  readonly tierDistribution: Record<TickTier, number>; // tick count per tier
  readonly phaseDistribution: Record<RunPhase, number>;
  readonly totalDecisionWindows: number;
  readonly decisionsExpired: number;
  readonly decisionsResolved: number;
  readonly holdsUsed: number;
  readonly tierTransitionCount: number;
  readonly finalTier: TickTier;
  readonly finalPhase: RunPhase;
  readonly outcome: RunOutcome;
  readonly outcomeExcitement: number;
  readonly wasWin: boolean;
  readonly wasLoss: boolean;
  readonly effectiveStakesAtEnd: number;
}

/** Configuration bundle for the time engine types subsystem. */
export interface TimeEngineConfig {
  readonly defaultTickTier: TickTier;
  readonly maxDecisionWindowsOpen: number;
  readonly holdDurationMs: number;
  readonly phaseTransitionWindowCount: number;
  readonly chatSignalMinIntervalMs: number;
  readonly mlEnabled: boolean;
  readonly dlEnabled: boolean;
  readonly chatBridgeEnabled: boolean;
}

// ============================================================================
// MARK: Exported type guard utilities
// ============================================================================

/** Runtime type guard: checks if value is a valid TickTier enum value. */
export function isTickTier(value: unknown): value is TickTier {
  return (
    typeof value === 'string' &&
    Object.values(TickTier).includes(value as TickTier)
  );
}

/** Runtime type guard: checks if value is a valid SeasonWindowType enum value. */
export function isSeasonWindowType(value: unknown): value is SeasonWindowType {
  return (
    typeof value === 'string' &&
    Object.values(SeasonWindowType).includes(value as SeasonWindowType)
  );
}

/** Runtime type guard: checks if value is a valid DecisionCardType enum value. */
export function isDecisionCardType(value: unknown): value is DecisionCardType {
  return (
    typeof value === 'string' &&
    Object.values(DecisionCardType).includes(value as DecisionCardType)
  );
}

// ============================================================================
// MARK: New standalone utility functions
// ============================================================================

/**
 * Returns all TickTiers ordered from safest to most dangerous.
 * Used by tier iterators, audit trails, and ML feature builders.
 */
export function getAllTickTiers(): ReadonlyArray<TickTier> {
  return TICK_TIER_ALL;
}

/**
 * Returns the normalized weight for a given TickTier (0 = calm, 1 = collapse).
 * Used in ML feature extraction and risk scoring.
 */
export function getTickTierWeight(tier: TickTier): number {
  return TICK_TIER_WEIGHT[tier];
}

/**
 * Returns the danger score (0–10) for a given TickTier.
 * Higher scores correspond to more critical gameplay moments.
 */
export function getTierDangerScore(tier: TickTier): number {
  return TIER_DANGER_SCORE[tier];
}

/**
 * Computes a 0–1 tier progress score: how far into the current tier's
 * pressure range the engine is. Uses escalation thresholds from GamePrimitives.
 */
export function computeTierProgressScore(
  tier: TickTier,
  pressureScore: number,
): number {
  const pressureTier = tickTierToPressureTier(tier);
  const escalationMin = PRESSURE_TIER_ESCALATION_THRESHOLD[pressureTier];
  const nextTierIndex = PRESSURE_TIERS.indexOf(pressureTier) + 1;
  const escalationMax =
    nextTierIndex < PRESSURE_TIERS.length
      ? PRESSURE_TIER_ESCALATION_THRESHOLD[PRESSURE_TIERS[nextTierIndex] as BackendPressureTier]
      : 100;

  if (escalationMax <= escalationMin) return 1.0;
  return Math.min(
    1.0,
    Math.max(0, (pressureScore - escalationMin) / (escalationMax - escalationMin)),
  );
}

/**
 * Returns a human-readable urgency label for the given TickTier.
 * Bridges TickTier → backend PressureTier → urgency label from GamePrimitives.
 */
export function computeTierUrgencyLabel(tier: TickTier): string {
  return PRESSURE_TIER_URGENCY_LABEL[tickTierToPressureTier(tier)];
}

/**
 * Returns the next TickTier in escalation order, or null if already at COLLAPSE_IMMINENT.
 */
export function getNextTickTier(tier: TickTier): TickTier | null {
  const index = TICK_TIER_ALL.indexOf(tier);
  return index < TICK_TIER_ALL.length - 1 ? TICK_TIER_ALL[index + 1] ?? null : null;
}

/**
 * Returns the previous TickTier in de-escalation order, or null if already at SOVEREIGN.
 */
export function getPreviousTickTier(tier: TickTier): TickTier | null {
  const index = TICK_TIER_ALL.indexOf(tier);
  return index > 0 ? TICK_TIER_ALL[index - 1] ?? null : null;
}

/**
 * Determines whether the engine can escalate from current tier to next,
 * delegating to GamePrimitives.canEscalatePressure for the truth condition.
 */
export function canEscalateTickTier(
  current: TickTier,
  score: number,
  ticksInCurrentTier: number,
): boolean {
  const currentPressure = tickTierToPressureTier(current);
  const nextTierIndex = PRESSURE_TIERS.indexOf(currentPressure) + 1;
  if (nextTierIndex >= PRESSURE_TIERS.length) return false;
  const nextPressure = PRESSURE_TIERS[nextTierIndex] as BackendPressureTier;
  return canEscalatePressure(currentPressure, nextPressure, score, ticksInCurrentTier);
}

/**
 * Determines whether the engine can de-escalate from current tier to previous,
 * delegating to GamePrimitives.canDeescalatePressure.
 */
export function canDeescalateTickTier(
  current: TickTier,
  score: number,
): boolean {
  const currentPressure = tickTierToPressureTier(current);
  const prevTierIndex = PRESSURE_TIERS.indexOf(currentPressure) - 1;
  if (prevTierIndex < 0) return false;
  const prevPressure = PRESSURE_TIERS[prevTierIndex] as BackendPressureTier;
  return canDeescalatePressure(currentPressure, prevPressure, score);
}

/**
 * Computes the minimum ticks that must be held in the current tier before
 * escalation is even considered.
 */
export function getMinHoldTicksForTier(tier: TickTier): number {
  return PRESSURE_TIER_MIN_HOLD_TICKS[tickTierToPressureTier(tier)];
}

/**
 * Returns milliseconds until the next phase boundary from the current elapsed time.
 * Returns 0 if already in SOVEREIGNTY (final phase).
 */
export function msUntilNextPhaseTransition(elapsedMs: number): number {
  const currentPhase = resolvePhaseFromElapsedMs(elapsedMs);
  if (isEndgamePhase(currentPhase)) return 0;

  for (const boundary of PHASE_BOUNDARIES_MS) {
    if (boundary.startsAtMs > elapsedMs) {
      return boundary.startsAtMs - elapsedMs;
    }
  }
  return 0;
}

/**
 * Computes 0–1 progress within the current phase using elapsed ms and phase boundaries.
 * Uses GamePrimitives.computeRunProgressFraction under the hood.
 */
export function computePhaseProgressFraction(
  elapsedMs: number,
  tickInPhase: number,
  phaseTickBudget: number,
): number {
  const phase = resolvePhaseFromElapsedMs(elapsedMs);
  return computeRunProgressFraction(phase, tickInPhase, phaseTickBudget);
}

/**
 * Computes the effective pressure multiplier from all currently active season windows.
 * Returns 1.0 if no active windows.
 */
export function computeSeasonWindowPressureMultiplier(
  windows: ReadonlyArray<SeasonTimeWindow>,
  nowMs: number,
): number {
  const active = windows.filter(
    (w) => w.isActive && w.startsAtMs <= nowMs && w.endsAtMs >= nowMs,
  );
  if (active.length === 0) return 1.0;
  return active.reduce((max, w) => Math.max(max, w.pressureMultiplier), 1.0);
}

/**
 * Generates a summary of open decision windows.
 * Computes aggregate stats used by ML, chat signals, and risk modeling.
 */
export function summarizeDecisionWindows(
  windows: ReadonlyArray<DecisionWindow>,
): DecisionWindowSummary {
  const open = windows.filter((w) => !w.isExpired && !w.isResolved);
  const onHold = open.filter((w) => w.isOnHold);
  const expired = windows.filter((w) => w.isExpired);
  const resolved = windows.filter((w) => w.isResolved && !w.isExpired);

  const avgRemainingMs =
    open.length > 0
      ? open.reduce((sum, w) => sum + w.remainingMs, 0) / open.length
      : 0;

  let mostUrgentWindowId: string | null = null;
  let mostUrgentRemainingMs = Infinity;
  for (const w of open) {
    if (w.remainingMs < mostUrgentRemainingMs) {
      mostUrgentRemainingMs = w.remainingMs;
      mostUrgentWindowId = w.windowId;
    }
  }

  const maxWindowMs =
    TICK_TIER_CONFIGS[TickTier.SOVEREIGN].decisionWindowMs;
  const pressureScore = open.length > 0
    ? 1.0 - Math.min(1.0, avgRemainingMs / maxWindowMs)
    : 0;

  return {
    totalOpen: open.length,
    totalOnHold: onHold.length,
    totalExpired: expired.length,
    totalResolved: resolved.length,
    avgRemainingMs,
    mostUrgentWindowId,
    mostUrgentRemainingMs: mostUrgentWindowId !== null ? mostUrgentRemainingMs : 0,
    pressureScore,
  };
}

/**
 * Computes how valuable a hold action would be right now.
 * Returns 0 when no windows are open; approaches 1.0 when a critical window is near expiry.
 */
export function computeHoldValue(
  tier: TickTier,
  activeWindows: ReadonlyArray<DecisionWindow>,
): number {
  const open = activeWindows.filter((w) => !w.isExpired && !w.isResolved && !w.isOnHold);
  if (open.length === 0) return 0;

  const config = TICK_TIER_CONFIGS[tier];
  const minRemaining = Math.min(...open.map((w) => w.remainingMs));
  const holdValue = 1.0 - Math.min(1.0, minRemaining / config.decisionWindowMs);

  // Ghost mode amplifies hold value due to higher time sensitivity
  const tierDanger = TICK_TIER_WEIGHT[tier];
  return Math.min(1.0, holdValue * (1.0 + tierDanger * 0.5));
}

/**
 * Builds a complete TimeEngineConfig with sensible defaults.
 * Used by factory functions and test harnesses.
 */
export function buildDefaultTimeEngineConfig(): TimeEngineConfig {
  return {
    defaultTickTier: TickTier.STABLE,
    maxDecisionWindowsOpen: 3,
    holdDurationMs: DEFAULT_HOLD_DURATION_MS,
    phaseTransitionWindowCount: DEFAULT_PHASE_TRANSITION_WINDOWS,
    chatSignalMinIntervalMs: TIME_CHAT_SIGNAL_MIN_INTERVAL_MS,
    mlEnabled: true,
    dlEnabled: true,
    chatBridgeEnabled: true,
  };
}

/**
 * Creates a DecisionWindow from a card ID, tier, and opening timestamp.
 * Wires DEFAULT_HOLD_DURATION_MS and DECISION_WINDOW_DURATIONS_MS.
 */
export function createDecisionWindow(
  windowId: string,
  cardId: string,
  cardType: DecisionCardType,
  tier: TickTier,
  nowMs: number,
  durationOverrideMs?: number,
): DecisionWindow {
  const pressureTier = tickTierToPressureTier(tier);
  const durationMs = durationOverrideMs ?? DECISION_WINDOW_DURATIONS_MS[pressureTier];

  return {
    windowId,
    cardId,
    cardType,
    durationMs,
    remainingMs: durationMs,
    openedAtMs: nowMs,
    expiresAtMs: nowMs + durationMs,
    isOnHold: false,
    holdExpiresAtMs: null,
    worstOptionIndex: 0,
    isExpired: false,
    isResolved: false,
  };
}

/**
 * Validates a DecisionWindow for logical consistency.
 * Used before window operations to prevent corrupted state.
 */
export function validateDecisionWindow(
  window: DecisionWindow,
): TimeTypesValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!window.windowId) errors.push('windowId is empty');
  if (!window.cardId) errors.push('cardId is empty');
  if (!isDecisionCardType(window.cardType)) errors.push(`Invalid cardType: ${window.cardType}`);
  if (window.durationMs <= 0) errors.push(`durationMs must be > 0, got ${window.durationMs}`);
  if (window.remainingMs < 0) errors.push(`remainingMs must be >= 0, got ${window.remainingMs}`);
  if (window.remainingMs > window.durationMs) {
    errors.push(`remainingMs (${window.remainingMs}) exceeds durationMs (${window.durationMs})`);
  }
  if (window.isExpired && window.isResolved) {
    warnings.push('Window is both expired and resolved — likely double-fired');
  }
  if (window.isOnHold && window.holdExpiresAtMs === null) {
    errors.push('isOnHold is true but holdExpiresAtMs is null');
  }
  if (clampNonNegativeInteger(window.worstOptionIndex) !== window.worstOptionIndex) {
    warnings.push(`worstOptionIndex (${window.worstOptionIndex}) should be non-negative integer`);
  }

  return { valid: errors.length === 0, errors, warnings, checkedAt: Date.now() };
}

/**
 * Validates a SeasonTimeWindow for completeness.
 */
export function validateSeasonTimeWindow(
  window: SeasonTimeWindow,
): TimeTypesValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!window.windowId) errors.push('windowId is empty');
  if (!isSeasonWindowType(window.type)) errors.push(`Invalid type: ${window.type}`);
  if (window.endsAtMs <= window.startsAtMs) {
    errors.push(`endsAtMs (${window.endsAtMs}) must be > startsAtMs (${window.startsAtMs})`);
  }
  if (window.pressureMultiplier <= 0) {
    errors.push(`pressureMultiplier must be > 0, got ${window.pressureMultiplier}`);
  }
  if (window.pressureMultiplier > 3.0) {
    warnings.push(`pressureMultiplier ${window.pressureMultiplier} is unusually high (> 3.0)`);
  }

  return { valid: errors.length === 0, errors, warnings, checkedAt: Date.now() };
}

// ============================================================================
// MARK: Class 1 — TimeTypesTierAnalyzer
// ============================================================================

/**
 * TimeTypesTierAnalyzer
 *
 * Analyzes tier state, evaluates escalation/de-escalation eligibility,
 * builds transition records, and routes tier-specific UX descriptions.
 *
 * Uses: canEscalatePressure, canDeescalatePressure, describePressureTierExperience,
 *       PRESSURE_TIER_NORMALIZED, PRESSURE_TIER_URGENCY_LABEL,
 *       PRESSURE_TIER_ESCALATION_THRESHOLD, PRESSURE_TIER_DEESCALATION_THRESHOLD,
 *       PRESSURE_TIER_MIN_HOLD_TICKS
 */
export class TimeTypesTierAnalyzer {
  private readonly transitionHistory: TimeTierTransitionRecord[] = [];

  /**
   * Full transition analysis: eligibility in both directions + reason string.
   */
  analyzeTransition(
    current: TickTier,
    pressureScore: number,
    ticksInCurrentTier: number,
    phase: RunPhase,
    mode: ModeCode,
  ): {
    canEscalate: boolean;
    canDeescalate: boolean;
    nextTier: TickTier | null;
    prevTier: TickTier | null;
    escalationReason: string;
    deescalationReason: string;
  } {
    const canEscalate = canEscalateTickTier(current, pressureScore, ticksInCurrentTier);
    const canDeescalate = canDeescalateTickTier(current, pressureScore);
    const nextTier = getNextTickTier(current);
    const prevTier = getPreviousTickTier(current);
    const pressureTier = tickTierToPressureTier(current);

    const minHoldTicks = PRESSURE_TIER_MIN_HOLD_TICKS[pressureTier];
    const escalationThreshold =
      nextTier !== null
        ? PRESSURE_TIER_ESCALATION_THRESHOLD[tickTierToPressureTier(nextTier)]
        : 100;

    const stakesAtTransition = computeEffectiveStakes(phase, mode);
    const escalationReason = canEscalate
      ? `Score ${pressureScore.toFixed(1)} >= ${escalationThreshold} after ${ticksInCurrentTier} ticks (stakes: ${stakesAtTransition.toFixed(2)})`
      : ticksInCurrentTier < minHoldTicks
        ? `Must hold ${minHoldTicks} ticks, only ${ticksInCurrentTier} elapsed`
        : `Score ${pressureScore.toFixed(1)} < escalation threshold ${escalationThreshold}`;

    const deescalationThreshold =
      PRESSURE_TIER_DEESCALATION_THRESHOLD[pressureTier];
    const deescalationReason = canDeescalate
      ? `Score ${pressureScore.toFixed(1)} < de-escalation threshold ${deescalationThreshold}`
      : `Score ${pressureScore.toFixed(1)} >= de-escalation threshold ${deescalationThreshold}`;

    return {
      canEscalate,
      canDeescalate,
      nextTier,
      prevTier,
      escalationReason,
      deescalationReason,
    };
  }

  /** Returns the danger score (0–10) for the given tier. */
  scoreTierDanger(tier: TickTier): number {
    return getTierDangerScore(tier);
  }

  /** Returns the urgency label string for the given tier. */
  getTierUrgencyLabel(tier: TickTier): string {
    return computeTierUrgencyLabel(tier);
  }

  /**
   * Computes the tick velocity (ticks per second equivalent) for the given tier.
   * Used by UI animations and chat pace controllers.
   */
  computeTickVelocity(tier: TickTier): number {
    const config = TICK_TIER_CONFIGS[tier];
    return 1000 / config.defaultDurationMs; // ticks per second
  }

  /**
   * Returns the UX experience description for the current tier.
   * Bridges TickTier to PressureTier and calls GamePrimitives describePressureTierExperience.
   */
  describeTierExperience(tier: TickTier): string {
    return describePressureTierExperience(tickTierToPressureTier(tier));
  }

  /**
   * Checks whether a tier is an escalation candidate given current pressure.
   * Wraps canEscalateTickTier for convenience.
   */
  isEscalationCandidate(
    tier: TickTier,
    pressureScore: number,
    ticksInCurrentTier: number,
  ): boolean {
    return canEscalateTickTier(tier, pressureScore, ticksInCurrentTier);
  }

  /**
   * Builds a full TimeTierTransitionRecord for audit trail and telemetry.
   */
  buildTransitionRecord(
    fromTier: TickTier,
    toTier: TickTier,
    pressureScore: number,
    ticksInPreviousTier: number,
    phase: RunPhase,
    mode: ModeCode,
    wasForced: boolean,
    nowMs: number,
  ): TimeTierTransitionRecord {
    const fromPressure = tickTierToPressureTier(fromTier);
    const toPressure = tickTierToPressureTier(toTier);
    const fromMs = TICK_TIER_CONFIGS[fromTier].defaultDurationMs;
    const toMs = TICK_TIER_CONFIGS[toTier].defaultDurationMs;

    const plan = createInterpolationPlan(fromTier, toTier, fromMs, toMs);

    const record: TimeTierTransitionRecord = {
      fromTier,
      toTier,
      fromPressureTier: fromPressure,
      toPressureTier: toPressure,
      pressureScore,
      ticksInPreviousTier,
      timestamp: nowMs,
      interpolationPlan: plan,
      phaseAtTransition: phase,
      modeAtTransition: mode,
      wasForced,
    };

    this.transitionHistory.push(record);
    return record;
  }

  /** Returns all recorded tier transition records. */
  getTransitionHistory(): ReadonlyArray<TimeTierTransitionRecord> {
    return this.transitionHistory;
  }

  /** Returns the most recent tier transition record. */
  getLastTransition(): TimeTierTransitionRecord | null {
    return this.transitionHistory.length > 0
      ? this.transitionHistory[this.transitionHistory.length - 1] ?? null
      : null;
  }

  /** Clears transition history (e.g., on run reset). */
  clearHistory(): void {
    this.transitionHistory.length = 0;
  }

  /**
   * Computes a composite risk score (0-1) factoring in tier weight,
   * pressure score, and de-escalation proximity.
   */
  computeCompositeRiskScore(
    tier: TickTier,
    pressureScore: number,
  ): number {
    const tierWeight = TICK_TIER_WEIGHT[tier];
    const pressureTier = tickTierToPressureTier(tier);
    const tierNormalized = PRESSURE_TIER_NORMALIZED[pressureTier];
    const tierProgress = computeTierProgressScore(tier, pressureScore);
    return Math.min(1.0, tierWeight * 0.4 + tierNormalized * 0.35 + tierProgress * 0.25);
  }

  /**
   * Returns a sorted list of ALL tiers the engine has visited during this run,
   * with their first-visit timestamps.
   */
  getVisitedTiers(): ReadonlyArray<{ tier: TickTier; firstVisitMs: number }> {
    const seen = new Map<TickTier, number>();
    for (const record of this.transitionHistory) {
      if (!seen.has(record.toTier)) {
        seen.set(record.toTier, record.timestamp);
      }
    }
    return Array.from(seen.entries()).map(([tier, firstVisitMs]) => ({ tier, firstVisitMs }));
  }
}

// ============================================================================
// MARK: Class 2 — TimeTypesPhaseClock
// ============================================================================

/**
 * TimeTypesPhaseClock
 *
 * Phase boundary calculations, elapsed time tracking, phase progress scoring,
 * and phase-specific timing guidance routing.
 *
 * Uses: resolvePhaseFromElapsedMs, isPhaseBoundaryTransition, isEndgamePhase,
 *       RUN_PHASE_NORMALIZED, RUN_PHASE_STAKES_MULTIPLIER,
 *       RUN_PHASE_TICK_BUDGET_FRACTION, computeRunProgressFraction,
 *       computeEffectiveStakes, PHASE_BOUNDARIES_MS, PHASE_DURATION_MS
 */
export class TimeTypesPhaseClock {
  /**
   * Resolves the current run phase from elapsed milliseconds.
   * Delegates to resolvePhaseFromElapsedMs.
   */
  resolveCurrentPhase(elapsedMs: number): RunPhase {
    return resolvePhaseFromElapsedMs(elapsedMs);
  }

  /** Returns the start ms for the given phase, or null if not found. */
  getPhaseStartMs(phase: RunPhase): number {
    for (const boundary of PHASE_BOUNDARIES_MS) {
      if (boundary.phase === phase) return boundary.startsAtMs;
    }
    return 0;
  }

  /** Returns the end ms for the given phase (start of the next phase, or run end). */
  getPhaseEndMs(phase: RunPhase): number {
    const allBoundaries = [...PHASE_BOUNDARIES_MS];
    for (let i = 0; i < allBoundaries.length; i++) {
      if (allBoundaries[i]?.phase === phase) {
        const next = allBoundaries[i + 1];
        return next ? next.startsAtMs : 12 * 60 * 1_000; // 12 min total run
      }
    }
    return 12 * 60 * 1_000;
  }

  /** Computes 0–1 progress within the current phase. */
  getPhaseProgress(
    elapsedMs: number,
    tickInPhase: number,
    phaseTickBudget: number,
  ): number {
    const phase = resolvePhaseFromElapsedMs(elapsedMs);
    return computeRunProgressFraction(phase, tickInPhase, phaseTickBudget);
  }

  /** Returns true if the given elapsed ms places the run in the specified phase. */
  isInPhase(elapsedMs: number, phase: RunPhase): boolean {
    return resolvePhaseFromElapsedMs(elapsedMs) === phase;
  }

  /** Returns true if the previous→next elapsed ms crosses a phase boundary. */
  isPhaseBoundary(prevMs: number, nextMs: number): boolean {
    return isPhaseBoundaryTransition(prevMs, nextMs);
  }

  /** Returns ms until the next phase transition (0 if in SOVEREIGNTY). */
  msUntilPhaseTransition(elapsedMs: number): number {
    return msUntilNextPhaseTransition(elapsedMs);
  }

  /** Returns true if the current phase is the endgame (SOVEREIGNTY). */
  isEndgame(phase: RunPhase): boolean {
    return isEndgamePhase(phase);
  }

  /** Returns the stakes multiplier for the given phase. */
  getPhaseStakesMultiplier(phase: RunPhase): number {
    return RUN_PHASE_STAKES_MULTIPLIER[phase];
  }

  /** Returns the tick budget fraction allocated to the given phase. */
  getPhaseBudgetFraction(phase: RunPhase): number {
    return RUN_PHASE_TICK_BUDGET_FRACTION[phase];
  }

  /**
   * Builds a full TimePhaseProfile for the given phase and mode.
   * Wires computeEffectiveStakes, isEndgamePhase, RUN_PHASE_NORMALIZED,
   * RUN_PHASE_STAKES_MULTIPLIER, RUN_PHASE_TICK_BUDGET_FRACTION.
   */
  buildPhaseProfile(phase: RunPhase, mode: ModeCode): TimePhaseProfile {
    const phaseNarratives: Record<RunPhase, string> = {
      FOUNDATION: 'You are laying the foundation. Build your income, guard your cash, and plant your empire.',
      ESCALATION: 'The stakes are rising. Every decision carries more weight. Stay disciplined and stay hungry.',
      SOVEREIGNTY: 'This is the endgame. You are either reaching freedom or facing collapse. There is no middle ground.',
    };

    return {
      phase,
      phaseNormalized: RUN_PHASE_NORMALIZED[phase],
      stakesMultiplier: RUN_PHASE_STAKES_MULTIPLIER[phase],
      tickBudgetFraction: RUN_PHASE_TICK_BUDGET_FRACTION[phase],
      effectiveStakes: computeEffectiveStakes(phase, mode),
      durationMs: PHASE_DURATION_MS[phase],
      isEndgame: isEndgamePhase(phase),
      narrative: phaseNarratives[phase],
    };
  }

  /**
   * Returns the phase-specific narrative string.
   */
  getPhaseNarrative(phase: RunPhase): string {
    return this.buildPhaseProfile(phase, 'solo').narrative;
  }

  /**
   * Builds full profiles for all three run phases given the current mode.
   */
  buildAllPhaseProfiles(mode: ModeCode): Record<RunPhase, TimePhaseProfile> {
    const result = {} as Record<RunPhase, TimePhaseProfile>;
    for (const phase of RUN_PHASES) {
      result[phase] = this.buildPhaseProfile(phase, mode);
    }
    return result;
  }

  /**
   * Computes effective elapsed ms within the current phase only.
   */
  getElapsedMsInCurrentPhase(elapsedMs: number): number {
    const phase = resolvePhaseFromElapsedMs(elapsedMs);
    const phaseStart = this.getPhaseStartMs(phase);
    return Math.max(0, elapsedMs - phaseStart);
  }
}

// ============================================================================
// MARK: Class 3 — TimeTypesDecisionWindowRegistry
// ============================================================================

/**
 * TimeTypesDecisionWindowRegistry
 *
 * Creates, tracks, validates, ticks, and resolves decision windows.
 * Provides aggregate stats and priority sorting for open windows.
 *
 * Uses: createDecisionWindow, validateDecisionWindow, summarizeDecisionWindows,
 *       computeHoldValue, DEFAULT_HOLD_DURATION_MS, DECISION_WINDOW_DURATIONS_MS,
 *       TICK_TIER_CONFIGS, clampNonNegativeInteger
 */
export class TimeTypesDecisionWindowRegistry {
  private windows: Map<string, DecisionWindow> = new Map();
  private expiredIds: string[] = [];
  private resolvedIds: string[] = [];

  /**
   * Creates and registers a new decision window.
   * Returns the created window.
   */
  create(
    windowId: string,
    cardId: string,
    cardType: DecisionCardType,
    tier: TickTier,
    nowMs: number,
    durationOverrideMs?: number,
  ): DecisionWindow {
    const window = createDecisionWindow(windowId, cardId, cardType, tier, nowMs, durationOverrideMs);
    this.windows.set(windowId, window);
    return window;
  }

  /**
   * Ticks all open windows by deltaMs, updating remainingMs.
   * Returns the list of windows that newly expired this tick.
   */
  tick(deltaMs: number): ReadonlyArray<DecisionWindow> {
    const nowExpired: DecisionWindow[] = [];
    const updatedMs = Math.max(0, deltaMs);

    for (const [id, w] of this.windows) {
      if (w.isExpired || w.isResolved) continue;

      // Respect hold: if on hold and hold has not yet expired, do not decrement
      const effectiveDelta = w.isOnHold ? 0 : updatedMs;
      const newRemaining = Math.max(0, w.remainingMs - effectiveDelta);

      const updated: DecisionWindow = {
        ...w,
        remainingMs: newRemaining,
        isExpired: newRemaining === 0,
      };

      this.windows.set(id, updated);

      if (updated.isExpired && !w.isExpired) {
        nowExpired.push(updated);
        this.expiredIds.push(id);
      }
    }

    return nowExpired;
  }

  /**
   * Applies a hold action to a window, freezing countdown for DEFAULT_HOLD_DURATION_MS.
   * Returns the updated window or null if not found.
   */
  applyHold(windowId: string, nowMs: number): DecisionWindow | null {
    const w = this.windows.get(windowId);
    if (!w || w.isExpired || w.isResolved || w.isOnHold) return null;

    const holdDurationMs = DEFAULT_HOLD_DURATION_MS;
    const updated: DecisionWindow = {
      ...w,
      isOnHold: true,
      holdExpiresAtMs: nowMs + holdDurationMs,
    };
    this.windows.set(windowId, updated);
    return updated;
  }

  /**
   * Releases a hold on a window (e.g., when holdExpiresAtMs is reached).
   * Returns the updated window or null if not found / not on hold.
   */
  releaseHold(windowId: string): DecisionWindow | null {
    const w = this.windows.get(windowId);
    if (!w || !w.isOnHold) return null;

    const updated: DecisionWindow = {
      ...w,
      isOnHold: false,
      holdExpiresAtMs: null,
    };
    this.windows.set(windowId, updated);
    return updated;
  }

  /**
   * Resolves a window with the chosen option index.
   * Returns the updated window.
   */
  resolve(
    windowId: string,
    chosenOptionIndex: number,
  ): DecisionWindow | null {
    const w = this.windows.get(windowId);
    if (!w || w.isExpired || w.isResolved) return null;

    const clamped = clampNonNegativeInteger(chosenOptionIndex);
    const updated: DecisionWindow = {
      ...w,
      isResolved: true,
      remainingMs: w.remainingMs,
    };

    // Store clamped option index in worstOptionIndex field for resolved record
    const withChoice: DecisionWindow = { ...updated, worstOptionIndex: clamped };
    this.windows.set(windowId, withChoice);
    this.resolvedIds.push(windowId);
    return withChoice;
  }

  /**
   * Auto-expires a window using the worstOptionIndex.
   */
  expire(windowId: string): DecisionWindow | null {
    const w = this.windows.get(windowId);
    if (!w || w.isResolved) return null;

    const updated: DecisionWindow = {
      ...w,
      isExpired: true,
      remainingMs: 0,
    };
    this.windows.set(windowId, updated);
    if (!this.expiredIds.includes(windowId)) {
      this.expiredIds.push(windowId);
    }
    return updated;
  }

  /** Returns a window by ID or null if not registered. */
  getWindow(windowId: string): DecisionWindow | null {
    return this.windows.get(windowId) ?? null;
  }

  /** Returns all currently open (non-expired, non-resolved) windows. */
  getActiveWindows(): ReadonlyArray<DecisionWindow> {
    return Array.from(this.windows.values()).filter(
      (w) => !w.isExpired && !w.isResolved,
    );
  }

  /** Returns all registered windows. */
  getAllWindows(): ReadonlyArray<DecisionWindow> {
    return Array.from(this.windows.values());
  }

  /**
   * Returns active windows sorted by urgency (least remaining ms first).
   * Used by chat bridge and ML feature builder.
   */
  getWindowsSortedByUrgency(): ReadonlyArray<DecisionWindow> {
    return this.getActiveWindows()
      .slice()
      .sort((a, b) => a.remainingMs - b.remainingMs);
  }

  /** Returns a summary of all registered windows. */
  getSummary(): DecisionWindowSummary {
    return summarizeDecisionWindows(Array.from(this.windows.values()));
  }

  /**
   * Computes how valuable a hold action would be right now.
   * Uses the current active window set and the given tier.
   */
  getHoldValue(tier: TickTier): number {
    return computeHoldValue(tier, this.getActiveWindows());
  }

  /** Validates a specific window by ID. */
  validateWindow(windowId: string): TimeTypesValidationResult {
    const w = this.windows.get(windowId);
    if (!w) {
      return { valid: false, errors: [`Window ${windowId} not found`], warnings: [], checkedAt: Date.now() };
    }
    return validateDecisionWindow(w);
  }

  /** Returns IDs of windows that expired during the last tick call. */
  getLastExpiredIds(): ReadonlyArray<string> {
    return this.expiredIds.slice(-20); // last 20
  }

  /** Returns IDs of windows that were resolved. */
  getResolvedIds(): ReadonlyArray<string> {
    return this.resolvedIds;
  }

  /** Clears registry state (call on run reset). */
  reset(): void {
    this.windows.clear();
    this.expiredIds = [];
    this.resolvedIds = [];
  }
}

// ============================================================================
// MARK: Class 4 — TimeTypesInterpolationEngine
// ============================================================================

/**
 * TimeTypesInterpolationEngine
 *
 * Manages interpolation plans for smooth tier transitions.
 * Uses createInterpolationPlan, computeInterpolationTickCount,
 * TICK_TIER_CONFIGS, normalizeTickDurationMs.
 */
export class TimeTypesInterpolationEngine {
  private activePlan: TickInterpolationPlan | null = null;

  /**
   * Creates a new interpolation plan for the given tier transition.
   * Auto-derives from/to durations from TICK_TIER_CONFIGS.
   */
  createPlan(fromTier: TickTier, toTier: TickTier): TickInterpolationPlan {
    const fromMs = TICK_TIER_CONFIGS[fromTier].defaultDurationMs;
    const toMs = TICK_TIER_CONFIGS[toTier].defaultDurationMs;
    this.activePlan = createInterpolationPlan(fromTier, toTier, fromMs, toMs);
    return this.activePlan;
  }

  /**
   * Creates a plan with custom duration overrides.
   * Used when clamped or normalized durations differ from defaults.
   */
  createCustomPlan(
    fromTier: TickTier,
    toTier: TickTier,
    pressureTier: PressureTier,
    rawFromMs: number,
    rawToMs: number,
  ): TickInterpolationPlan {
    const normalizedFrom = normalizeTickDurationMs(pressureTier, rawFromMs);
    const normalizedTo = normalizeTickDurationMs(pressureTier, rawToMs);
    this.activePlan = createInterpolationPlan(fromTier, toTier, normalizedFrom, normalizedTo);
    return this.activePlan;
  }

  /**
   * Advances the active plan by one tick, decrementing ticksRemaining.
   * Returns the updated plan or null if no active plan.
   */
  advancePlan(): TickInterpolationPlan | null {
    if (!this.activePlan || this.activePlan.ticksRemaining <= 0) return null;

    const updated: TickInterpolationPlan = {
      ...this.activePlan,
      ticksRemaining: this.activePlan.ticksRemaining - 1,
    };

    this.activePlan = updated;
    return updated;
  }

  /** Returns true if the active plan has completed (ticksRemaining === 0). */
  isComplete(): boolean {
    return this.activePlan === null || this.activePlan.ticksRemaining === 0;
  }

  /** Clears the active plan. Call when interpolation is fully resolved. */
  clearPlan(): void {
    this.activePlan = null;
  }

  /** Returns the current active plan, or null. */
  getActivePlan(): TickInterpolationPlan | null {
    return this.activePlan;
  }

  /**
   * Linearly interpolates the tick duration for the current point in the plan.
   * Returns fromDurationMs if plan is complete or null.
   */
  interpolateCurrentDurationMs(): number {
    if (!this.activePlan) return TICK_TIER_CONFIGS[TickTier.STABLE].defaultDurationMs;

    const { fromDurationMs, toDurationMs, totalTicks, ticksRemaining } = this.activePlan;
    if (totalTicks === 0) return toDurationMs;

    const fraction = 1.0 - ticksRemaining / totalTicks;
    return Math.round(fromDurationMs + (toDurationMs - fromDurationMs) * fraction);
  }

  /**
   * Returns the 0–1 interpolation progress fraction (0 = just started, 1 = complete).
   */
  getFraction(): number {
    if (!this.activePlan || this.activePlan.totalTicks === 0) return 1.0;
    return 1.0 - this.activePlan.ticksRemaining / this.activePlan.totalTicks;
  }

  /**
   * Returns true if the two tiers differ and interpolation is warranted.
   */
  needsInterpolation(fromTier: TickTier, toTier: TickTier): boolean {
    return fromTier !== toTier;
  }

  /**
   * Returns a severity score (0-1) for the active transition:
   * larger delta in duration = more severe change.
   */
  getInterpolationSeverity(): number {
    if (!this.activePlan) return 0;

    const delta = Math.abs(this.activePlan.toDurationMs - this.activePlan.fromDurationMs);
    const maxDelta =
      TICK_TIER_CONFIGS[TickTier.SOVEREIGN].defaultDurationMs -
      TICK_TIER_CONFIGS[TickTier.COLLAPSE_IMMINENT].defaultDurationMs;

    return maxDelta > 0 ? Math.min(1.0, delta / maxDelta) : 0;
  }

  /**
   * Returns the total expected tick count needed for the active interpolation.
   */
  getTotalInterpolationTicks(fromDurationMs: number, toDurationMs: number): number {
    return computeInterpolationTickCount(Math.abs(toDurationMs - fromDurationMs));
  }
}

// ============================================================================
// MARK: Class 5 — TimeTypesSeasonWindowManager
// ============================================================================

/**
 * TimeTypesSeasonWindowManager
 *
 * Manages the lifecycle of real-world season windows.
 * Computes pressure multipliers, builds ChatLiveOpsSnapshot,
 * validates windows, and routes urgency scoring.
 *
 * Uses: SeasonWindowType, SeasonTimeWindow, validateSeasonTimeWindow,
 *       computeSeasonWindowPressureMultiplier, SEASON_WINDOW_MULTIPLIER
 */
export class TimeTypesSeasonWindowManager {
  private windows: SeasonTimeWindow[] = [];

  /**
   * Registers a new season window.
   * Returns a validation result before adding.
   */
  registerWindow(window: SeasonTimeWindow): TimeTypesValidationResult {
    const validation = validateSeasonTimeWindow(window);
    if (validation.valid) {
      this.windows.push(window);
    }
    return validation;
  }

  /**
   * Creates and registers a season window from raw parameters.
   */
  createWindow(
    windowId: string,
    type: SeasonWindowType,
    startsAtMs: number,
    endsAtMs: number,
    customMultiplier?: number,
  ): SeasonTimeWindow {
    const window: SeasonTimeWindow = {
      windowId,
      type,
      startsAtMs,
      endsAtMs,
      isActive: false,
      pressureMultiplier: customMultiplier ?? SEASON_WINDOW_MULTIPLIER[type],
    };
    this.windows.push(window);
    return window;
  }

  /**
   * Updates the isActive flag of all registered windows based on the current timestamp.
   */
  syncActiveState(nowMs: number): void {
    this.windows = this.windows.map((w) => ({
      ...w,
      isActive: w.startsAtMs <= nowMs && w.endsAtMs >= nowMs,
    }));
  }

  /**
   * Returns all currently active windows for the given timestamp.
   */
  getActiveWindows(nowMs: number): ReadonlyArray<SeasonTimeWindow> {
    return this.windows.filter(
      (w) => w.startsAtMs <= nowMs && w.endsAtMs >= nowMs,
    );
  }

  /** Returns all registered windows. */
  getAllWindows(): ReadonlyArray<SeasonTimeWindow> {
    return this.windows;
  }

  /** Returns windows of a specific type. */
  filterByType(type: SeasonWindowType): ReadonlyArray<SeasonTimeWindow> {
    return this.windows.filter((w) => w.type === type);
  }

  /**
   * Returns windows sorted ascending by start time.
   */
  getWindowsSortedByStartTime(): ReadonlyArray<SeasonTimeWindow> {
    return [...this.windows].sort((a, b) => a.startsAtMs - b.startsAtMs);
  }

  /**
   * Returns the effective pressure multiplier from all active windows.
   * Delegates to computeSeasonWindowPressureMultiplier.
   */
  getActivePressureMultiplier(nowMs: number): number {
    return computeSeasonWindowPressureMultiplier(this.windows, nowMs);
  }

  /**
   * Computes an urgency score (0-1) for a given window based on how close it is to ending.
   * 0 = just started, 1 = ending within the next 60 seconds.
   */
  computeWindowUrgency(window: SeasonTimeWindow, nowMs: number): number {
    if (nowMs < window.startsAtMs || nowMs > window.endsAtMs) return 0;
    const totalDuration = window.endsAtMs - window.startsAtMs;
    if (totalDuration <= 0) return 1;
    const remaining = window.endsAtMs - nowMs;
    const urgencyThresholdMs = Math.min(60_000, totalDuration * 0.1);
    return remaining < urgencyThresholdMs
      ? 1.0 - remaining / urgencyThresholdMs
      : 0;
  }

  /**
   * Builds a ChatLiveOpsSnapshot from the current active window set.
   * Used by chat bridge to populate LIVEOPS_SIGNAL payloads.
   */
  buildLiveOpsSnapshot(nowMs: number): ChatLiveOpsSnapshot {
    const active = this.getActiveWindows(nowMs);
    const hasRaid = active.some((w) => w.type === SeasonWindowType.SEASON_FINALE);
    const multiplier = this.getActivePressureMultiplier(nowMs);
    const worldEventName = active.length > 0 ? active[0]?.type ?? null : null;

    return {
      worldEventName,
      heatMultiplier01: Math.min(1, multiplier - 1) as Score01,
      helperBlackout: false,
      haterRaidActive: hasRaid,
    };
  }

  /**
   * Returns a narrated string describing current season window state.
   */
  narrateWindowState(nowMs: number): string {
    const active = this.getActiveWindows(nowMs);
    if (active.length === 0) return 'No active season events.';

    const labels: Record<SeasonWindowType, string> = {
      [SeasonWindowType.KICKOFF]: 'Season Kickoff is live — get in early.',
      [SeasonWindowType.LIVEOPS_EVENT]: 'A LiveOps event is running. Stakes are elevated.',
      [SeasonWindowType.SEASON_FINALE]: 'SEASON FINALE — this is your last window to prove sovereignty.',
      [SeasonWindowType.ARCHIVE_CLOSE]: 'Archive closing soon. Secure your legacy now.',
      [SeasonWindowType.REENGAGE_WINDOW]: 'Welcome back. The system remembers you left.',
    };

    return active.map((w) => labels[w.type]).join(' ');
  }

  /** Removes all windows from the registry. */
  reset(): void {
    this.windows = [];
  }
}

// ============================================================================
// MARK: Class 6 — TimeTypesMLFeatureBuilder
// ============================================================================

/**
 * TimeTypesMLFeatureBuilder
 *
 * Builds the 28-dimensional ML feature vector from the time engine state.
 * Each feature is normalized to 0-1 or a boolean (0/1) scalar.
 *
 * Uses: TICK_TIER_WEIGHT, PRESSURE_TIER_NORMALIZED, RUN_PHASE_NORMALIZED,
 *       MODE_NORMALIZED, MODE_DIFFICULTY_MULTIPLIER, MODE_TENSION_FLOOR,
 *       RUN_PHASE_STAKES_MULTIPLIER, computeRunProgressFraction,
 *       isEndgamePhase, computeEffectiveStakes, summarizeDecisionWindows,
 *       TIME_ML_FEATURE_COUNT, TIME_TYPES_ML_FEATURE_LABELS
 */
export class TimeTypesMLFeatureBuilder {
  /**
   * Builds the 28-dimensional TimeMLFeatureVector from a TimeMLFeatureContext.
   * All features are normalized to 0–1 unless noted.
   */
  build(ctx: TimeMLFeatureContext): TimeMLFeatureVector {
    const pressureTier = tickTierToPressureTier(ctx.tier);
    const windowSummary = summarizeDecisionWindows(ctx.activeDecisionWindows);
    const activeWindowDurationMs = TICK_TIER_CONFIGS[ctx.tier].decisionWindowMs;

    const maxTickDurationMs = TICK_TIER_CONFIGS[TickTier.SOVEREIGN].defaultDurationMs;

    const seasonMultiplier = computeSeasonWindowPressureMultiplier(
      ctx.activeSeasonWindows,
      ctx.capturedAtMs,
    );

    const holdActive = ctx.activeDecisionWindows.some((w) => w.isOnHold) ? 1.0 : 0.0;
    const holdDurationFraction = holdActive > 0 ? DEFAULT_HOLD_DURATION_MS / activeWindowDurationMs : 0;

    const escalationEligible = canEscalateTickTier(ctx.tier, ctx.pressureScore, ctx.ticksInCurrentTier) ? 1.0 : 0.0;
    const deescalationEligible = canDeescalateTickTier(ctx.tier, ctx.pressureScore) ? 1.0 : 0.0;

    const runProgress = computeRunProgressFraction(ctx.phase, ctx.phaseTickInPhase, ctx.phaseTickBudget);
    const phaseProgress = runProgress;

    const effectiveStakes = computeEffectiveStakes(ctx.phase, ctx.mode);
    const maxStakes = computeEffectiveStakes('SOVEREIGNTY', 'ghost');

    const interpolationActive = ctx.interpolationPlan !== null ? 1.0 : 0.0;
    const interpolationFraction = ctx.interpolationPlan !== null
      ? 1.0 - ctx.interpolationPlan.ticksRemaining / Math.max(1, ctx.interpolationPlan.totalTicks)
      : 0.0;

    // Normalize ticksInCurrentTier: cap at 20 ticks
    const maxExpectedTierTicks = 20;
    const tierTicksNormalized = Math.min(1.0, ctx.ticksInCurrentTier / maxExpectedTierTicks);

    // Normalize decision window avg remaining
    const avgWindowNormalized = activeWindowDurationMs > 0
      ? Math.min(1.0, windowSummary.avgRemainingMs / activeWindowDurationMs)
      : 0;

    const features: number[] = [
      /* 0  */ TICK_TIER_WEIGHT[ctx.tier],
      /* 1  */ PRESSURE_TIER_NORMALIZED[pressureTier],
      /* 2  */ RUN_PHASE_NORMALIZED[ctx.phase],
      /* 3  */ MODE_NORMALIZED[ctx.mode],
      /* 4  */ Math.min(1.0, ctx.tickDurationMs / maxTickDurationMs),
      /* 5  */ Math.min(1.0, windowSummary.totalOpen / 5),
      /* 6  */ avgWindowNormalized,
      /* 7  */ holdActive,
      /* 8  */ holdDurationFraction,
      /* 9  */ ctx.tierChangedThisTick ? 1.0 : 0.0,
      /* 10 */ tierTicksNormalized,
      /* 11 */ escalationEligible,
      /* 12 */ deescalationEligible,
      /* 13 */ phaseProgress,
      /* 14 */ ctx.activeSeasonWindows.some((w) => w.isActive) ? 1.0 : 0.0,
      /* 15 */ Math.min(1.0, (seasonMultiplier - 1.0) / 0.6),
      /* 16 */ maxStakes > 0 ? Math.min(1.0, effectiveStakes / maxStakes) : 0,
      /* 17 */ Math.min(1.0, MODE_DIFFICULTY_MULTIPLIER[ctx.mode] / 1.8),
      /* 18 */ MODE_TENSION_FLOOR[ctx.mode],
      /* 19 */ RUN_PHASE_STAKES_MULTIPLIER[ctx.phase],
      /* 20 */ runProgress,
      /* 21 */ isEndgamePhase(ctx.phase) ? 1.0 : 0.0,
      /* 22 */ TICK_TIER_WEIGHT[ctx.tier], // danger score normalized (same as weight)
      /* 23 */ Math.min(1.0, ctx.decisionsExpiredThisTick / 3),
      /* 24 */ Math.min(1.0, ctx.decisionsResolvedThisTick / 3),
      /* 25 */ ctx.holdActionUsedThisTick ? 1.0 : 0.0,
      /* 26 */ interpolationActive,
      /* 27 */ interpolationFraction,
    ];

    return {
      features,
      featureCount: TIME_ML_FEATURE_COUNT,
      capturedAtMs: ctx.capturedAtMs,
      tier: ctx.tier,
      phase: ctx.phase,
      mode: ctx.mode,
    };
  }

  /**
   * Flattens a TimeMLFeatureVector to a Float32Array for ML inference.
   */
  toFloat32Array(vector: TimeMLFeatureVector): Float32Array {
    return new Float32Array(vector.features);
  }

  /**
   * Returns the feature label for a given index position.
   */
  getFeatureLabel(index: number): string {
    return TIME_TYPES_ML_FEATURE_LABELS[index] ?? `feature_${index}`;
  }

  /**
   * Validates that all feature values in a vector are finite and within [0, 1].
   */
  validate(vector: TimeMLFeatureVector): TimeTypesValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (vector.featureCount !== TIME_ML_FEATURE_COUNT) {
      errors.push(`Expected ${TIME_ML_FEATURE_COUNT} features, got ${vector.featureCount}`);
    }

    for (let i = 0; i < vector.features.length; i++) {
      const val = vector.features[i];
      if (val === undefined) {
        errors.push(`Feature [${i}] is undefined`);
      } else if (!Number.isFinite(val)) {
        errors.push(`Feature [${i}] (${this.getFeatureLabel(i)}) is not finite: ${val}`);
      } else if (val < -0.001 || val > 1.001) {
        warnings.push(`Feature [${i}] (${this.getFeatureLabel(i)}) is out of [0,1]: ${val.toFixed(4)}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings, checkedAt: Date.now() };
  }

  /**
   * Builds labeled key-value pairs for debug logging and human-readable feature inspection.
   */
  buildLabeledFeatures(vector: TimeMLFeatureVector): Record<string, number> {
    const result: Record<string, number> = {};
    for (let i = 0; i < vector.features.length; i++) {
      const label = this.getFeatureLabel(i);
      result[label] = vector.features[i] ?? 0;
    }
    return result;
  }
}

// ============================================================================
// MARK: Class 7 — TimeTypesDLTensorBuilder
// ============================================================================

/**
 * TimeTypesDLTensorBuilder
 *
 * Maintains a 40×6 ring buffer for DL tensor construction.
 * Each row is a TimeDLRow capturing time engine cadence features per tick.
 *
 * Uses: TimeDLRow, TimeTypesDLTensor, TIME_DL_TENSOR_ROWS, TIME_DL_FEATURE_COUNT,
 *       TIME_DL_FEATURE_LABELS, TICK_TIER_WEIGHT, computeEffectiveStakes,
 *       computeSeasonWindowPressureMultiplier, computeRunProgressFraction
 */
export class TimeTypesDLTensorBuilder {
  private buffer: TimeDLRow[] = [];
  private headIndex = 0;

  /**
   * Builds a TimeDLRow from the current time engine state context.
   */
  buildRow(ctx: TimeMLFeatureContext): TimeDLRow {
    const phaseProgress = computeRunProgressFraction(ctx.phase, ctx.phaseTickInPhase, ctx.phaseTickBudget);
    const windowSummary = summarizeDecisionWindows(ctx.activeDecisionWindows);
    const seasonMultiplier = computeSeasonWindowPressureMultiplier(
      ctx.activeSeasonWindows,
      ctx.capturedAtMs,
    );
    const effectiveStakes = computeEffectiveStakes(ctx.phase, ctx.mode);
    const maxStakes = computeEffectiveStakes('SOVEREIGNTY', 'ghost');

    return {
      tierWeight: TICK_TIER_WEIGHT[ctx.tier],
      phaseProgress,
      decisionPressure: windowSummary.pressureScore,
      seasonMultiplier: Math.min(1.0, (seasonMultiplier - 1.0) / 0.6),
      stakes: maxStakes > 0 ? Math.min(1.0, effectiveStakes / maxStakes) : 0,
      runProgress: Math.min(1.0, phaseProgress),
    };
  }

  /**
   * Appends a row to the ring buffer.
   * Evicts the oldest row when capacity is reached.
   */
  append(row: TimeDLRow): void {
    if (this.buffer.length < TIME_DL_TENSOR_ROWS) {
      this.buffer.push(row);
    } else {
      this.buffer[this.headIndex % TIME_DL_TENSOR_ROWS] = row;
      this.headIndex++;
    }
  }

  /**
   * Appends a row built from context directly (convenience wrapper).
   */
  appendFromContext(ctx: TimeMLFeatureContext): TimeDLRow {
    const row = this.buildRow(ctx);
    this.append(row);
    return row;
  }

  /**
   * Returns the current TimeTypesDLTensor snapshot.
   */
  getDLTensor(): TimeTypesDLTensor {
    return {
      rows: [...this.buffer],
      rowCount: this.buffer.length,
      capacity: TIME_DL_TENSOR_ROWS,
      headIndex: this.headIndex % TIME_DL_TENSOR_ROWS,
    };
  }

  /**
   * Flattens the tensor to a Float32Array for DL model input.
   * Layout: [row0_col0, row0_col1, ..., row0_col5, row1_col0, ...].
   */
  toFloat32Array(): Float32Array {
    const flat = new Float32Array(this.buffer.length * TIME_DL_FEATURE_COUNT);
    for (let r = 0; r < this.buffer.length; r++) {
      const row = this.buffer[r];
      if (!row) continue;
      flat[r * TIME_DL_FEATURE_COUNT + 0] = row.tierWeight;
      flat[r * TIME_DL_FEATURE_COUNT + 1] = row.phaseProgress;
      flat[r * TIME_DL_FEATURE_COUNT + 2] = row.decisionPressure;
      flat[r * TIME_DL_FEATURE_COUNT + 3] = row.seasonMultiplier;
      flat[r * TIME_DL_FEATURE_COUNT + 4] = row.stakes;
      flat[r * TIME_DL_FEATURE_COUNT + 5] = row.runProgress;
    }
    return flat;
  }

  /** Returns the feature label for a given column index. */
  getColumnLabel(colIndex: number): string {
    return TIME_DL_FEATURE_LABELS[colIndex] ?? `col_${colIndex}`;
  }

  /** Returns the number of rows currently in the ring buffer. */
  getRowCount(): number {
    return this.buffer.length;
  }

  /** Returns true if the ring buffer is at full capacity. */
  isFull(): boolean {
    return this.buffer.length >= TIME_DL_TENSOR_ROWS;
  }

  /** Clears the ring buffer. */
  reset(): void {
    this.buffer = [];
    this.headIndex = 0;
  }
}

// ============================================================================
// MARK: Class 8 — TimeTypesChatBridge
// ============================================================================

/**
 * TimeTypesChatBridge
 *
 * Bridges the time engine to the chat lane via LIVEOPS_SIGNAL.
 * Builds ChatSignalEnvelope, ChatRunSnapshot, ChatLiveOpsSnapshot,
 * and ChatInputEnvelope payloads.
 *
 * Uses: ChatSignalEnvelope, ChatRunSnapshot, ChatLiveOpsSnapshot,
 *       ChatInputEnvelope, ChatSignalType, ChatEventKind,
 *       ChatChannelId, ChatRoomId, Score01, Score100, UnixMs, Nullable,
 *       JsonValue, SeasonTimeWindow, TickTier, RunPhase, ModeCode
 */
export class TimeTypesChatBridge {
  private lastEmittedAt = 0;
  private signalCount = 0;

  /**
   * Checks whether enough time has passed to emit a new LIVEOPS_SIGNAL.
   */
  shouldEmitSignal(nowMs: number): boolean {
    return nowMs - this.lastEmittedAt >= TIME_CHAT_SIGNAL_MIN_INTERVAL_MS;
  }

  /**
   * Returns the canonical ChatSignalType for time engine signals.
   */
  getSignalType(): ChatSignalType {
    return 'LIVEOPS';
  }

  /**
   * Returns the ChatEventKind for liveops input envelopes.
   */
  getEventKind(): ChatEventKind {
    return 'LIVEOPS_SIGNAL';
  }

  /**
   * Returns the LIVEOPS_SHADOW channel ID for time engine signals.
   */
  getChannelId(): ChatChannelId {
    return 'LIVEOPS_SHADOW';
  }

  /**
   * Builds a ChatRunSnapshot from the current time engine state.
   * Bridges engine TickTier → chat-local tick tier string.
   */
  buildRunSnapshot(
    runId: string,
    tier: TickTier,
    phase: RunPhase,
    elapsedMs: number,
  ): ChatRunSnapshot {
    const tierToChatTickTier = (t: TickTier): ChatRunSnapshot['tickTier'] => {
      const map: Record<TickTier, ChatRunSnapshot['tickTier']> = {
        [TickTier.SOVEREIGN]: 'SEAL',
        [TickTier.STABLE]: 'WINDOW',
        [TickTier.COMPRESSED]: 'COMMIT',
        [TickTier.CRISIS]: 'RESOLUTION',
        [TickTier.COLLAPSE_IMMINENT]: 'RESOLUTION',
      };
      return map[t];
    };

    const isNearSovereignty = isEndgamePhase(phase) && tier === TickTier.SOVEREIGN;
    const hasBankruptcyWarning = tier === TickTier.COLLAPSE_IMMINENT;

    return {
      runId,
      runPhase: phase,
      tickTier: tierToChatTickTier(tier),
      outcome: 'UNRESOLVED',
      bankruptcyWarning: hasBankruptcyWarning,
      nearSovereignty: isNearSovereignty,
      elapsedMs,
    };
  }

  /**
   * Builds a ChatLiveOpsSnapshot from the active season window state.
   */
  buildLiveOpsSnapshot(
    activeSeasonWindows: ReadonlyArray<SeasonTimeWindow>,
    nowMs: number,
  ): ChatLiveOpsSnapshot {
    const manager = new TimeTypesSeasonWindowManager();
    for (const w of activeSeasonWindows) {
      manager.registerWindow(w);
    }
    return manager.buildLiveOpsSnapshot(nowMs);
  }

  /**
   * Builds a complete ChatSignalEnvelope for LIVEOPS_SIGNAL.
   * roomId is null for time engine signals (no specific room target).
   */
  buildSignalEnvelope(
    runId: string,
    tier: TickTier,
    phase: RunPhase,
    elapsedMs: number,
    activeSeasonWindows: ReadonlyArray<SeasonTimeWindow>,
    metadata: Readonly<Record<string, JsonValue>>,
    nowMs: number,
  ): ChatSignalEnvelope {
    const run = this.buildRunSnapshot(runId, tier, phase, elapsedMs);
    const liveops = this.buildLiveOpsSnapshot(activeSeasonWindows, nowMs);

    return {
      type: this.getSignalType(),
      emittedAt: nowMs as UnixMs,
      roomId: null as Nullable<ChatRoomId>,
      run,
      liveops,
      metadata,
    };
  }

  /**
   * Wraps a ChatSignalEnvelope in a LIVEOPS_SIGNAL ChatInputEnvelope.
   * This is the format consumed by the chat engine's input router.
   */
  buildLiveOpsInputEnvelope(
    signal: ChatSignalEnvelope,
    nowMs: number,
  ): ChatInputEnvelope {
    return {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: nowMs as UnixMs,
      payload: signal,
    };
  }

  /**
   * Builds a complete TimeTypesChatSignal from the current time engine state.
   * This is the primary public output of the chat bridge.
   */
  buildTimeTypesChatSignal(
    runId: string,
    tier: TickTier,
    phase: RunPhase,
    elapsedMs: number,
    activeSeasonWindows: ReadonlyArray<SeasonTimeWindow>,
    activeDecisionWindows: ReadonlyArray<DecisionWindow>,
    nowMs: number,
  ): TimeTypesChatSignal {
    const metadata: Record<string, JsonValue> = {
      tier: tier as string,
      phase: phase as string,
      elapsedMs,
      tickCount: activeDecisionWindows.length,
      signalIndex: this.signalCount,
    };

    const envelope = this.buildSignalEnvelope(
      runId,
      tier,
      phase,
      elapsedMs,
      activeSeasonWindows,
      metadata,
      nowMs,
    );

    const inputEnvelope = this.buildLiveOpsInputEnvelope(envelope, nowMs);

    const msUntilTransition = msUntilNextPhaseTransition(elapsedMs);
    const nearPhaseTransition = msUntilTransition > 0 && msUntilTransition < 30_000;

    this.lastEmittedAt = nowMs;
    this.signalCount++;

    return {
      signalType: 'LIVEOPS',
      tier,
      phase,
      urgencyLabel: computeTierUrgencyLabel(tier),
      hasActiveDecisionWindow: activeDecisionWindows.some((w) => !w.isExpired && !w.isResolved),
      nearPhaseTransition,
      elapsedMs,
      envelope,
      inputEnvelope,
    };
  }

  /** Returns the total number of signals emitted during this run. */
  getSignalCount(): number {
    return this.signalCount;
  }

  /** Resets the bridge state for a new run. */
  reset(): void {
    this.lastEmittedAt = 0;
    this.signalCount = 0;
  }
}

// ============================================================================
// MARK: Class 9 — TimeTypesModeRouter
// ============================================================================

/**
 * TimeTypesModeRouter
 *
 * Routes mode-aware timing behaviors: time sensitivity, adjusted decision
 * window durations, adjusted tick durations, mode profiles.
 *
 * Uses: MODE_CODES, MODE_NORMALIZED, MODE_DIFFICULTY_MULTIPLIER,
 *       MODE_TENSION_FLOOR, computeEffectiveStakes, MODE_TIME_SENSITIVITY,
 *       TICK_TIER_CONFIGS, PRESSURE_TIERS, DECISION_WINDOW_DURATIONS_MS,
 *       TIER_DURATIONS_MS, RUN_PHASES
 */
export class TimeTypesModeRouter {
  /**
   * Returns the time sensitivity coefficient for the given mode.
   * Higher = faster pressure ramp and tighter decision windows.
   */
  getTimeSensitivity(mode: ModeCode): number {
    return MODE_TIME_SENSITIVITY[mode];
  }

  /**
   * Returns whether the mode is aggressively time-compressed.
   * pvp and ghost modes accelerate beyond default tick velocity.
   */
  isModeAggressiveOnTime(mode: ModeCode): boolean {
    return mode === 'pvp' || mode === 'ghost';
  }

  /**
   * Computes the mode-adjusted decision window duration for a given PressureTier.
   * Ghost mode tightens windows by time sensitivity factor; coop mode loosens slightly.
   */
  adjustDecisionWindowForMode(durationMs: number, mode: ModeCode): number {
    const sensitivity = MODE_TIME_SENSITIVITY[mode];
    // Modes with sensitivity > 1 shorten windows; < 1 lengthen them
    const adjusted = Math.round(durationMs / sensitivity);
    const minSafe = 800;
    return Math.max(minSafe, adjusted);
  }

  /**
   * Computes the mode+phase adjusted tick duration.
   * Used by EngineRuntime when resolving the effective tick interval.
   */
  adjustTickDurationForMode(
    durationMs: number,
    mode: ModeCode,
    phase: RunPhase,
  ): number {
    const sensitivity = MODE_TIME_SENSITIVITY[mode];
    const phaseMultiplier = 1.0 + (1.0 - RUN_PHASE_TICK_BUDGET_FRACTION[phase]) * 0.1;
    const adjusted = Math.round(durationMs / (sensitivity * phaseMultiplier));
    const minSafe = 500;
    return Math.max(minSafe, adjusted);
  }

  /**
   * Builds a full TimeModeProfile for the given mode.
   * All field values wired from GamePrimitives constants and local tables.
   */
  buildModeProfile(mode: ModeCode): TimeModeProfile {
    const modeNarratives: Record<ModeCode, string> = {
      solo:  'Empire Mode: You are building alone. Every second is yours to command.',
      pvp:   "Predator Mode: Your opponent's clock is ticking alongside yours. Strike first.",
      coop:  'Syndicate Mode: Your team shares the pressure. Move together or lose together.',
      ghost: 'Phantom Mode: Invisible but not invincible. The most unforgiving clock of all.',
    };

    const chatLabels: Record<ModeCode, string> = {
      solo:  'Empire',
      pvp:   'Predator',
      coop:  'Syndicate',
      ghost: 'Phantom',
    };

    const adjustedDecisionWindowMs: Record<PressureTier, number> = {
      T0: this.adjustDecisionWindowForMode(DECISION_WINDOW_DURATIONS_MS['T0'], mode),
      T1: this.adjustDecisionWindowForMode(DECISION_WINDOW_DURATIONS_MS['T1'], mode),
      T2: this.adjustDecisionWindowForMode(DECISION_WINDOW_DURATIONS_MS['T2'], mode),
      T3: this.adjustDecisionWindowForMode(DECISION_WINDOW_DURATIONS_MS['T3'], mode),
      T4: this.adjustDecisionWindowForMode(DECISION_WINDOW_DURATIONS_MS['T4'], mode),
    };

    const adjustedTickDurationMs: Record<PressureTier, number> = {
      T0: this.adjustTickDurationForMode(TIER_DURATIONS_MS['T0'], mode, 'FOUNDATION'),
      T1: this.adjustTickDurationForMode(TIER_DURATIONS_MS['T1'], mode, 'FOUNDATION'),
      T2: this.adjustTickDurationForMode(TIER_DURATIONS_MS['T2'], mode, 'ESCALATION'),
      T3: this.adjustTickDurationForMode(TIER_DURATIONS_MS['T3'], mode, 'ESCALATION'),
      T4: this.adjustTickDurationForMode(TIER_DURATIONS_MS['T4'], mode, 'SOVEREIGNTY'),
    };

    return {
      mode,
      timeSensitivity: MODE_TIME_SENSITIVITY[mode],
      difficultyMultiplier: MODE_DIFFICULTY_MULTIPLIER[mode],
      tensionFloor: MODE_TENSION_FLOOR[mode],
      modeNormalized: MODE_NORMALIZED[mode],
      adjustedDecisionWindowMs,
      adjustedTickDurationMs,
      chatLabel: chatLabels[mode],
      narrative: modeNarratives[mode],
    };
  }

  /**
   * Returns profiles for all four game modes.
   * Used by analytics and session initialization.
   */
  buildAllModeProfiles(): Record<ModeCode, TimeModeProfile> {
    const result = {} as Record<ModeCode, TimeModeProfile>;
    for (const mode of MODE_CODES) {
      result[mode] = this.buildModeProfile(mode);
    }
    return result;
  }

  /**
   * Computes the effective stakes for the given mode and phase.
   * Delegates to GamePrimitives.computeEffectiveStakes.
   */
  computeModeEffectiveStakes(mode: ModeCode, phase: RunPhase): number {
    return computeEffectiveStakes(phase, mode);
  }

  /**
   * Returns the maximum effective stakes across all modes and phases.
   * Used to normalize stakes in ML feature extraction.
   */
  getMaxEffectiveStakes(): number {
    let max = 0;
    for (const mode of MODE_CODES) {
      for (const phase of RUN_PHASES) {
        const stakes = computeEffectiveStakes(phase, mode);
        if (stakes > max) max = stakes;
      }
    }
    return max;
  }

  /**
   * Returns a mode narrative label suitable for chat signal metadata.
   */
  getModeNarrative(mode: ModeCode): string {
    return this.buildModeProfile(mode).narrative;
  }
}

// ============================================================================
// MARK: Class 10 — TimeTypesNarrator
// ============================================================================

/**
 * TimeTypesNarrator
 *
 * Generates human-readable narrations of time engine state.
 * Used by LIVEOPS_SIGNAL payloads, NPC dialog triggers, and replay annotations.
 *
 * Uses: describePressureTierExperience, PRESSURE_TIER_URGENCY_LABEL,
 *       isEndgamePhase, isWinOutcome, isLossOutcome, scoreOutcomeExcitement,
 *       RUN_OUTCOMES, RUN_PHASES, MODE_CODES, TICK_TIER_ALL,
 *       TICK_TIER_WEIGHT, computeTierUrgencyLabel
 */
export class TimeTypesNarrator {
  /**
   * Returns a narration string for the current tier and phase.
   */
  narrateTierState(tier: TickTier, phase: RunPhase, mode: ModeCode): string {
    const urgencyLabel = computeTierUrgencyLabel(tier);
    const phaseLabel = isEndgamePhase(phase) ? 'final phase' : `${phase.toLowerCase()} phase`;
    const tierExperience = describePressureTierExperience(tickTierToPressureTier(tier));
    const modeContext = mode === 'pvp' ? ' Your opponent feels this too.' : '';
    return `[${urgencyLabel}] ${tierExperience} You are in the ${phaseLabel}.${modeContext}`;
  }

  /**
   * Returns a narration string for an open decision window.
   */
  narrateDecisionWindow(window: DecisionWindow): string {
    const secRemaining = Math.ceil(window.remainingMs / 1000);
    const urgencyPrefix = secRemaining <= 3 ? '⚠️ CRITICAL: ' : secRemaining <= 8 ? 'URGENT: ' : '';
    const holdNote = window.isOnHold ? ' (HOLD active — timer frozen)' : '';
    const cardTypeLabel =
      window.cardType === DecisionCardType.FORCED_FATE
        ? 'fate card'
        : window.cardType === DecisionCardType.HATER_INJECTION
          ? 'hater challenge'
          : 'crisis event';

    return `${urgencyPrefix}${secRemaining}s to respond to a ${cardTypeLabel}${holdNote}.`;
  }

  /**
   * Returns a narration string for a tier transition.
   */
  narrateTransition(from: TickTier, to: TickTier, wasForced: boolean): string {
    const fromLabel = computeTierUrgencyLabel(from);
    const toLabel = computeTierUrgencyLabel(to);
    const direction = TICK_TIER_WEIGHT[to] > TICK_TIER_WEIGHT[from] ? 'escalated' : 'recovered';
    const forcedNote = wasForced ? ' (forced by system override)' : '';
    return `Time tier ${direction} from ${fromLabel} → ${toLabel}${forcedNote}.`;
  }

  /**
   * Returns a narration string for an active season window.
   */
  narrateSeasonWindow(window: SeasonTimeWindow, nowMs: number): string {
    const manager = new TimeTypesSeasonWindowManager();
    manager.registerWindow(window);
    const urgency = manager.computeWindowUrgency(window, nowMs);
    const urgencyLabel = urgency > 0.8 ? '⏰ ENDING SOON: ' : '';
    return `${urgencyLabel}${manager.narrateWindowState(nowMs)}`;
  }

  /**
   * Returns a narration string when a run times out.
   */
  narrateRunTimeout(ticksElapsed: number, mode: ModeCode): string {
    const modeLabel = mode === 'pvp' ? 'Your opponent is watching.' : 'The empire clock ran out.';
    return `Run ended after ${ticksElapsed} ticks. ${modeLabel} A run is never over until you act.`;
  }

  /**
   * Returns a narration string when a hold action is used.
   */
  narrateHoldAction(window: DecisionWindow): string {
    const holdSec = DEFAULT_HOLD_DURATION_MS / 1000;
    return `Hold action activated. Timer frozen for ${holdSec} seconds. Use this moment wisely — holds are limited.`;
  }

  /**
   * Returns a narration for an outcome, using GamePrimitives scoring functions.
   */
  narrateOutcome(outcome: RunOutcome, mode: ModeCode): string {
    const won = isWinOutcome(outcome);
    const lost = isLossOutcome(outcome);
    const excitement = scoreOutcomeExcitement(outcome, mode);

    if (won) {
      return `FREEDOM. You built what others said was impossible. Score: ${excitement.toFixed(1)}/5.`;
    }

    if (lost) {
      const lossLabels: Record<RunOutcome, string> = {
        FREEDOM: 'You did it.',
        TIMEOUT: 'The clock beat you. Not forever — only today.',
        BANKRUPT: 'Zero balance. The system reset you. The knowledge does not reset.',
        ABANDONED: 'You walked away. That is a decision too.',
      };
      return `${lossLabels[outcome] ?? 'Run ended.'} Excitement: ${excitement.toFixed(1)}/5.`;
    }

    return `Run completed. Outcome: ${outcome}.`;
  }

  /**
   * Builds a complete TimeEngineNarration for a given time engine state.
   * Master narration assembly — wires all individual narrators.
   */
  buildNarration(
    state: TimeEngineState,
    activeDecisionWindows: ReadonlyArray<DecisionWindow>,
    activeSeasonWindows: ReadonlyArray<SeasonTimeWindow>,
    nowMs: number,
  ): TimeEngineNarration {
    const tierNarration = this.narrateTierState(state.tier, state.phase, state.mode);
    const phaseNarration = `${state.phase} phase — ${Math.round(state.elapsedMs / 1000)}s elapsed.`;
    const modeNarration = new TimeTypesModeRouter().getModeNarrative(state.mode);
    const urgencyLabel = computeTierUrgencyLabel(state.tier);
    const pressureExperience = describePressureTierExperience(tickTierToPressureTier(state.tier));

    const activeOpen = activeDecisionWindows.filter((w) => !w.isExpired && !w.isResolved);
    const decisionWindowNarration =
      activeOpen.length > 0
        ? this.narrateDecisionWindow(activeOpen[0] as DecisionWindow)
        : null;

    const activeSeasonActive = activeSeasonWindows.filter(
      (w) => w.startsAtMs <= nowMs && w.endsAtMs >= nowMs,
    );
    const seasonWindowNarration =
      activeSeasonActive.length > 0
        ? this.narrateSeasonWindow(activeSeasonActive[0] as SeasonTimeWindow, nowMs)
        : null;

    const holdNarration =
      state.holdsRemainingInRun > 0
        ? `${state.holdsRemainingInRun} hold action${state.holdsRemainingInRun > 1 ? 's' : ''} remaining.`
        : 'No holds remaining.';

    const fullNarration = [
      tierNarration,
      phaseNarration,
      decisionWindowNarration,
      seasonWindowNarration,
      holdNarration,
    ]
      .filter(Boolean)
      .join(' ');

    const shortNarration = `${urgencyLabel} | Tick ${state.tickNumber} | ${state.phase}`;

    return {
      tierNarration,
      phaseNarration,
      modeNarration,
      urgencyLabel,
      pressureExperience,
      decisionWindowNarration,
      seasonWindowNarration,
      holdNarration,
      fullNarration,
      shortNarration,
    };
  }

  /**
   * Iterates across all known outcomes and builds a narrration map.
   * Used in post-run summaries.
   */
  buildAllOutcomeNarrations(mode: ModeCode): Record<RunOutcome, string> {
    const result = {} as Record<RunOutcome, string>;
    for (const outcome of RUN_OUTCOMES) {
      result[outcome] = this.narrateOutcome(outcome, mode);
    }
    return result;
  }

  /**
   * Builds a concise narration for each pressure tier.
   * Used in real-time HUD descriptions.
   */
  buildAllTierNarrations(phase: RunPhase, mode: ModeCode): Record<TickTier, string> {
    const result = {} as Record<TickTier, string>;
    for (const tier of TICK_TIER_ALL) {
      result[tier] = this.narrateTierState(tier, phase, mode);
    }
    return result;
  }
}

// ============================================================================
// MARK: TimeRunSummary builder
// ============================================================================

/**
 * Builds a TimeRunSummary from a sequence of time engine events.
 * Uses: RUN_OUTCOMES, isWinOutcome, isLossOutcome, scoreOutcomeExcitement,
 *       computeEffectiveStakes, TICK_TIER_ALL
 */
export function buildTimeRunSummary(
  runId: string,
  events: ReadonlyArray<TimeEngineEvent>,
  finalState: {
    tier: TickTier;
    phase: RunPhase;
    mode: ModeCode;
    outcome: RunOutcome;
  },
): TimeRunSummary {
  const tickEvents = events.filter(
    (e): e is TickEvent => e.eventType === 'TICK_COMPLETE',
  );

  const tierDistribution: Record<TickTier, number> = {
    [TickTier.SOVEREIGN]: 0,
    [TickTier.STABLE]: 0,
    [TickTier.COMPRESSED]: 0,
    [TickTier.CRISIS]: 0,
    [TickTier.COLLAPSE_IMMINENT]: 0,
  };

  const phaseDistribution: Record<RunPhase, number> = {
    FOUNDATION: 0,
    ESCALATION: 0,
    SOVEREIGNTY: 0,
  };

  let totalElapsedMs = 0;
  let decisionsExpired = 0;
  let decisionsResolved = 0;
  let holdsUsed = 0;
  let tierTransitionCount = 0;
  const tiersVisited = new Set<TickTier>();

  for (const event of tickEvents) {
    tierDistribution[event.tier]++;
    tiersVisited.add(event.tier);
    totalElapsedMs += event.tickDurationMs;
    decisionsExpired += event.decisionsExpiredThisTick.length;
    decisionsResolved += event.decisionsResolvedThisTick.length;
    if (event.holdActionUsedThisTick) holdsUsed++;
    if (event.tierChangedThisTick) tierTransitionCount++;
  }

  // Estimate phase distribution from elapsed time and phase boundaries
  let elapsedAcc = 0;
  for (const event of tickEvents) {
    const phase = resolvePhaseFromElapsedMs(elapsedAcc);
    phaseDistribution[phase]++;
    elapsedAcc += event.tickDurationMs;
  }

  const openedEvents = events.filter(
    (e): e is DecisionWindowOpenedEvent => e.eventType === 'DECISION_WINDOW_OPENED',
  );

  const effectiveStakesAtEnd = computeEffectiveStakes(finalState.phase, finalState.mode);

  return {
    runId,
    totalTicks: tickEvents.length,
    totalElapsedMs,
    tiersVisited: [...tiersVisited].sort(
      (a, b) => TICK_TIER_ALL.indexOf(a) - TICK_TIER_ALL.indexOf(b),
    ),
    tierDistribution,
    phaseDistribution,
    totalDecisionWindows: openedEvents.length,
    decisionsExpired,
    decisionsResolved,
    holdsUsed,
    tierTransitionCount,
    finalTier: finalState.tier,
    finalPhase: finalState.phase,
    outcome: finalState.outcome,
    outcomeExcitement: scoreOutcomeExcitement(finalState.outcome, finalState.mode),
    wasWin: isWinOutcome(finalState.outcome),
    wasLoss: isLossOutcome(finalState.outcome),
    effectiveStakesAtEnd,
  };
}

// ============================================================================
// MARK: Factory functions
// ============================================================================

/**
 * Creates a new TimeTypesTierAnalyzer.
 * Primary entry point for tier transition management.
 */
export function createTimeTypesTierAnalyzer(): TimeTypesTierAnalyzer {
  return new TimeTypesTierAnalyzer();
}

/**
 * Creates a new TimeTypesPhaseClock.
 * Primary entry point for phase boundary management.
 */
export function createTimeTypesPhaseClock(): TimeTypesPhaseClock {
  return new TimeTypesPhaseClock();
}

/**
 * Creates a new TimeTypesDecisionWindowRegistry.
 * Primary entry point for decision window lifecycle.
 */
export function createTimeTypesDecisionWindowRegistry(): TimeTypesDecisionWindowRegistry {
  return new TimeTypesDecisionWindowRegistry();
}

/**
 * Creates a new TimeTypesInterpolationEngine.
 */
export function createTimeTypesInterpolationEngine(): TimeTypesInterpolationEngine {
  return new TimeTypesInterpolationEngine();
}

/**
 * Creates a new TimeTypesSeasonWindowManager.
 */
export function createTimeTypesSeasonWindowManager(): TimeTypesSeasonWindowManager {
  return new TimeTypesSeasonWindowManager();
}

/**
 * Creates a new TimeTypesMLFeatureBuilder.
 */
export function createTimeTypesMLFeatureBuilder(): TimeTypesMLFeatureBuilder {
  return new TimeTypesMLFeatureBuilder();
}

/**
 * Creates a new TimeTypesDLTensorBuilder.
 */
export function createTimeTypesDLTensorBuilder(): TimeTypesDLTensorBuilder {
  return new TimeTypesDLTensorBuilder();
}

/**
 * Creates a new TimeTypesChatBridge.
 */
export function createTimeTypesChatBridge(): TimeTypesChatBridge {
  return new TimeTypesChatBridge();
}

/**
 * Creates a new TimeTypesModeRouter.
 */
export function createTimeTypesModeRouter(): TimeTypesModeRouter {
  return new TimeTypesModeRouter();
}

/**
 * Creates a new TimeTypesNarrator.
 */
export function createTimeTypesNarrator(): TimeTypesNarrator {
  return new TimeTypesNarrator();
}

/**
 * Creates a complete time types subsystem bundle with all 10 subsystem instances.
 * Used for integration testing and full engine initialization.
 */
export function createFullTimeTypesBundle(): {
  tierAnalyzer: TimeTypesTierAnalyzer;
  phaseClock: TimeTypesPhaseClock;
  windowRegistry: TimeTypesDecisionWindowRegistry;
  interpolationEngine: TimeTypesInterpolationEngine;
  seasonWindowManager: TimeTypesSeasonWindowManager;
  mlFeatureBuilder: TimeTypesMLFeatureBuilder;
  dlTensorBuilder: TimeTypesDLTensorBuilder;
  chatBridge: TimeTypesChatBridge;
  modeRouter: TimeTypesModeRouter;
  narrator: TimeTypesNarrator;
  config: TimeEngineConfig;
} {
  return {
    tierAnalyzer: new TimeTypesTierAnalyzer(),
    phaseClock: new TimeTypesPhaseClock(),
    windowRegistry: new TimeTypesDecisionWindowRegistry(),
    interpolationEngine: new TimeTypesInterpolationEngine(),
    seasonWindowManager: new TimeTypesSeasonWindowManager(),
    mlFeatureBuilder: new TimeTypesMLFeatureBuilder(),
    dlTensorBuilder: new TimeTypesDLTensorBuilder(),
    chatBridge: new TimeTypesChatBridge(),
    modeRouter: new TimeTypesModeRouter(),
    narrator: new TimeTypesNarrator(),
    config: buildDefaultTimeEngineConfig(),
  };
}

// ============================================================================
// MARK: Module manifest
// ============================================================================

/**
 * Canonical module manifest for the time types subsystem.
 * Consumed by the engine orchestrator, telemetry pipelines, and DI containers.
 */
export const TIME_TYPES_MODULE = Object.freeze({
  name: 'time/types',
  version: TIME_TYPES_MODULE_VERSION,
  mlFeatureCount: TIME_ML_FEATURE_COUNT,
  dlFeatureCount: TIME_DL_FEATURE_COUNT,
  dlTensorRows: TIME_DL_TENSOR_ROWS,
  mlFeatureLabels: TIME_TYPES_ML_FEATURE_LABELS,
  dlFeatureLabels: TIME_DL_FEATURE_LABELS,
  tickTierCount: TICK_TIER_ALL.length,
  phaseCount: RUN_PHASES.length,
  modeCount: MODE_CODES.length,
  outcomeCount: RUN_OUTCOMES.length,
  phaseBoundaryCount: PHASE_BOUNDARIES_MS.length,
  defaultHoldDurationMs: DEFAULT_HOLD_DURATION_MS,
  defaultPhaseTransitionWindows: DEFAULT_PHASE_TRANSITION_WINDOWS,
  chatSignalMinIntervalMs: TIME_CHAT_SIGNAL_MIN_INTERVAL_MS,
  pressureTierCount: PRESSURE_TIERS.length,
  subsystems: [
    'TimeTypesTierAnalyzer',
    'TimeTypesPhaseClock',
    'TimeTypesDecisionWindowRegistry',
    'TimeTypesInterpolationEngine',
    'TimeTypesSeasonWindowManager',
    'TimeTypesMLFeatureBuilder',
    'TimeTypesDLTensorBuilder',
    'TimeTypesChatBridge',
    'TimeTypesModeRouter',
    'TimeTypesNarrator',
  ] as const,
  factories: [
    'createTimeTypesTierAnalyzer',
    'createTimeTypesPhaseClock',
    'createTimeTypesDecisionWindowRegistry',
    'createTimeTypesInterpolationEngine',
    'createTimeTypesSeasonWindowManager',
    'createTimeTypesMLFeatureBuilder',
    'createTimeTypesDLTensorBuilder',
    'createTimeTypesChatBridge',
    'createTimeTypesModeRouter',
    'createTimeTypesNarrator',
    'createFullTimeTypesBundle',
  ] as const,
} as const);

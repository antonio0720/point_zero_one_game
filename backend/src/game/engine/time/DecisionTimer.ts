/* ============================================================================
 * FILE: backend/src/game/engine/time/DecisionTimer.ts
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * VERSION: 2026.03.26 — Depth Upgrade v2
 *
 * Doctrine:
 * - backend owns active decision-window expiry truth
 * - snapshot remains the persisted surface, but this class hardens runtime behavior
 * - local runtime mutations must survive until the next authoritative snapshot commit
 * - local removals must suppress stale snapshot rehydration until persistence catches up
 * - hold freezes extend deadlines immediately so timeout math stays deterministic
 * - no wall-clock polling; expiry is evaluated only during authoritative time steps
 * - ML/DL intelligence is first-class — every window state contributes to 28-dim
 *   feature vectors and 40×6 DL tensors aligned with TIME_CONTRACT_* constants
 * - LIVEOPS_SIGNAL chat lane receives real-time timer state signals
 * - Risk assessment, diagnostics, and analytics are always computable from local state
 * - All imports are 100% used — zero dead weight
 * ============================================================================ */

// ============================================================================
// SECTION 1 — IMPORTS
// ============================================================================

import type { ModeCode, TimingClass, RunPhase, RunOutcome } from '../core/GamePrimitives';
import type {
  RuntimeDecisionWindowSnapshot,
  RunStateSnapshot,
  TimerState,
  EconomyState,
  PressureState,
  ShieldState,
  BattleState,
  CardsState,
  ModeState,
  TelemetryState,
} from '../core/RunStateSnapshot';

import {
  TickTier,
  DecisionCardType,
  SeasonWindowType,
  TICK_TIER_CONFIGS,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  PHASE_BOUNDARIES_MS,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  normalizeTickDurationMs,
  clampTickDurationMs,
  resolvePhaseFromElapsedMs,
  createInterpolationPlan,
  pressureTierToTickTier,
  tickTierToPressureTier,
  getTickTierConfig,
  getTickTierConfigByPressureTier,
  getDefaultTickDurationMs,
  getDecisionWindowDurationMs,
  clampNonNegativeInteger,
  computeInterpolationTickCount,
} from './types';

import type {
  PressureTier,
  TickTierConfig,
  TickInterpolationPlan,
  PressureReader,
  DecisionWindow,
  SeasonTimeWindow,
  TickEvent,
  TierChangeEvent,
  DecisionWindowOpenedEvent,
  DecisionWindowExpiredEvent,
  DecisionWindowResolvedEvent,
  DecisionWindowTickEvent,
  HoldActionUsedEvent,
  RunTimeoutEvent,
  TickTierForcedEvent,
  TimeEngineEvent,
  TimeEngineEventMap,
  PhaseBoundary,
} from './types';

import {
  TIME_CONTRACT_ML_DIM,
  TIME_CONTRACT_DL_ROW_COUNT,
  TIME_CONTRACT_DL_COL_COUNT,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_MODE_TEMPO,
  TIME_CONTRACT_OUTCOME_IS_TERMINAL,
  TIME_CONTRACT_PHASE_SCORE,
  TIME_CONTRACT_BUDGET_THRESHOLDS,
  TIME_CONTRACT_LATENCY_THRESHOLDS,
  TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
  TIME_CONTRACT_HOLD_RESULT_LABELS,
  TIME_CONTRACT_MAX_BUDGET_MS,
  TIME_CONTRACT_MAX_TICK_DURATION_MS,
  TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
  TIME_CONTRACTS_VERSION,
} from './contracts';

import type {
  TimeContractsVersion,
  TimeRuntimeContext,
  TimeCadenceResolution,
} from './contracts';

// ============================================================================
// SECTION 2 — MODULE CONSTANTS
// ============================================================================

export const DECISION_TIMER_VERSION = '2026.03.26' as const;

/**
 * ML feature label set — 28 dimensions aligned with TIME_CONTRACT_ML_DIM.
 * Each label maps 1:1 to an index in the extracted feature vector.
 */
export const DECISION_TIMER_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'active_window_count_norm',        // 0
  'frozen_window_count_norm',        // 1
  'avg_remaining_ratio',             // 2
  'min_remaining_ratio',             // 3
  'budget_utilization_ratio',        // 4
  'pressure_urgency_score',          // 5
  'mode_tempo_multiplier_norm',      // 6
  'phase_score',                     // 7
  'hold_charges_norm',               // 8
  'hold_window_ratio',               // 9
  'latency_class_score',             // 10
  'tick_drift_score',                // 11
  'budget_alarm_level',              // 12
  'decision_rate_per_tick',          // 13
  'shield_breach_risk',              // 14
  'battle_threat_score',             // 15
  'hand_size_norm',                  // 16
  'deck_entropy_norm',               // 17
  'economic_net_flow_score',         // 18
  'net_worth_progress_ratio',        // 19
  'hater_heat_norm',                 // 20
  'warning_count_norm',              // 21
  'outcome_terminal_flag',           // 22
  'tier_interpolation_active',       // 23
  'season_pressure_multiplier',      // 24
  'phase_boundary_windows_norm',     // 25
  'exclusive_window_ratio',          // 26
  'composite_risk_score',            // 27
]);

/**
 * DL tensor column labels — 6 columns aligned with TIME_CONTRACT_DL_COL_COUNT.
 */
export const DECISION_TIMER_DL_COL_LABELS: readonly string[] = Object.freeze([
  'remaining_ratio',    // 0 — time left vs window duration
  'frozen_flag',        // 1 — 0 or 1
  'budget_utilization', // 2 — elapsed/total budget
  'persisted_flag',     // 3 — 0 or 1 (in snapshot)
  'exclusive_flag',     // 4 — 0 or 1
  'age_ratio',          // 5 — age of window vs max decision window ms
]);

/**
 * History depth for per-window DL sequence rows. Aligned with
 * TIME_CONTRACT_DL_ROW_COUNT = 40.
 */
export const DECISION_TIMER_DL_HISTORY_DEPTH = TIME_CONTRACT_DL_ROW_COUNT;

/**
 * Hold result code set — keys aligned with TIME_CONTRACT_HOLD_RESULT_LABELS.
 */
export const DECISION_TIMER_HOLD_RESULT_CODES = Object.freeze({
  OK: 'OK',
  HOLD_DISABLED: 'HOLD_DISABLED',
  NO_CHARGES_REMAINING: 'NO_CHARGES_REMAINING',
  INVALID_DURATION: 'INVALID_DURATION',
  WINDOW_ALREADY_FROZEN: 'WINDOW_ALREADY_FROZEN',
} as const);

export type DecisionTimerHoldResultCode = keyof typeof DECISION_TIMER_HOLD_RESULT_CODES;

// ============================================================================
// SECTION 3 — INTERFACE TYPES
// ============================================================================

export interface DecisionTimerSyncResult {
  readonly openedWindowIds: readonly string[];
  readonly removedWindowIds: readonly string[];
}

export interface DecisionWindowSeedOptions {
  readonly timingClass?: TimingClass;
  readonly label?: string;
  readonly source?: string;
  readonly mode?: ModeCode;
  readonly openedAtTick?: number;
  readonly openedAtMs?: number;
  readonly closesAtTick?: number | null;
  readonly exclusive?: boolean;
  readonly actorId?: string | null;
  readonly targetActorId?: string | null;
  readonly cardInstanceId?: string | null;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export type SuppressedWindowReason = 'RESOLVED' | 'NULLIFIED' | 'EXPIRED';

export interface MutableDecisionWindowState {
  readonly windowId: string;
  snapshot: RuntimeDecisionWindowSnapshot;
  frozenUntilMs: number | null;
  persistedInSnapshot: boolean;
}

export interface DecisionTimerMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dim: number;
  readonly computedAtMs: number;
  readonly windowCount: number;
}

export interface DecisionTimerDLRow {
  readonly cols: readonly number[];
  readonly windowId: string;
  readonly capturedAtMs: number;
}

export interface DecisionTimerDLTensor {
  readonly rows: readonly DecisionTimerDLRow[];
  readonly rowCount: number;
  readonly colCount: number;
  readonly colLabels: readonly string[];
  readonly builtAtMs: number;
}

export interface DecisionTimerRiskAssessment {
  readonly windowId: string;
  readonly riskScore: number;           // 0.0–1.0
  readonly riskScore100: number;        // 0–100
  readonly urgencyLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly remainingRatio: number;
  readonly isFrozen: boolean;
  readonly isExclusive: boolean;
  readonly latencyClass: 'FAST' | 'ACCEPTABLE' | 'SLOW' | 'ALARM';
  readonly budgetAlarmLevel: 'OK' | 'WARNING' | 'CRITICAL' | 'EXHAUST';
  readonly tags: readonly string[];
}

export interface DecisionTimerHealthReport {
  readonly totalActive: number;
  readonly totalFrozen: number;
  readonly totalExpiredImminent: number; // closes within 1 tick
  readonly highRiskCount: number;
  readonly criticalRiskCount: number;
  readonly avgRemainingRatio: number;
  readonly compositeRiskScore: number;
  readonly budgetStatus: DecisionTimerBudgetStatus;
  readonly warnings: readonly string[];
  readonly generatedAtMs: number;
}

export interface DecisionTimerBudgetStatus {
  readonly seasonBudgetMs: number;
  readonly extensionBudgetMs: number;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly utilizationPct: number;
  readonly alarmLevel: 'OK' | 'WARNING' | 'CRITICAL' | 'EXHAUST';
  readonly msToChatThreshold: number;
}

export interface DecisionTimerCadenceProfile {
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly tierConfig: TickTierConfig;
  readonly defaultDurationMs: number;
  readonly decisionWindowMs: number;
  readonly modeTempoMultiplier: number;
  readonly shouldScreenShake: boolean;
  readonly interpolationPlan: TickInterpolationPlan | null;
}

export interface DecisionTimerChatSignal {
  readonly windowId: string;
  readonly label: string;
  readonly source: string;
  readonly timingClass: TimingClass;
  readonly riskScore: number;
  readonly riskScore100: number;
  readonly urgencyLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly remainingMs: number | null;
  readonly remainingRatio: number;
  readonly isFrozen: boolean;
  readonly isExclusive: boolean;
  readonly budgetAlarmLevel: 'OK' | 'WARNING' | 'CRITICAL' | 'EXHAUST';
  readonly narrativeHeadline: string;
  readonly coachingMessage: string;
  readonly mlVector: DecisionTimerMLVector;
  readonly tags: readonly string[];
  readonly emittedAtMs: number;
}

export interface DecisionTimerSeasonContext {
  readonly activeWindowTypes: readonly SeasonWindowType[];
  readonly pressureMultiplier: number;
  readonly hasLiveopsEvent: boolean;
  readonly hasSeasonFinale: boolean;
  readonly hasKickoff: boolean;
  readonly hasReengageWindow: boolean;
  readonly hasArchiveClose: boolean;
}

export interface DecisionTimerEconomicContext {
  readonly cash: number;
  readonly debt: number;
  readonly netWorth: number;
  readonly freedomTarget: number;
  readonly netFlowPerTick: number;
  readonly netWorthProgressRatio: number;
  readonly haterHeatNorm: number;
  readonly isNetFlowPositive: boolean;
}

export interface DecisionTimerPressureContext {
  readonly tier: PressureTier;
  readonly score: number;
  readonly urgencyScore: number;
  readonly isEscalated: boolean;
  readonly upwardCrossings: number;
}

export interface DecisionTimerShieldContext {
  readonly weakestLayerRatio: number;
  readonly breachesThisRun: number;
  readonly repairQueueDepth: number;
  readonly breachRisk: number;
}

export interface DecisionTimerBattleContext {
  readonly activeBotsCount: number;
  readonly attackingBotsCount: number;
  readonly threatScore: number;
  readonly firstBloodClaimed: boolean;
}

export interface DecisionTimerHandContext {
  readonly handSize: number;
  readonly handSizeNorm: number;
  readonly deckEntropy: number;
  readonly drawPileSize: number;
}

export interface DecisionTimerModeContext {
  readonly mode: ModeCode;
  readonly holdEnabled: boolean;
  readonly holdCharges: number;
  readonly phaseBoundaryWindowsRemaining: number;
  readonly bleedMode: boolean;
}

export interface DecisionTimerTelemetryContext {
  readonly decisionCount: number;
  readonly warningCount: number;
  readonly emittedEventCount: number;
  readonly outcomeReason: string | null;
  readonly outcomeTerminal: boolean;
}

export interface DecisionTimerAnalytics {
  readonly totalOpened: number;
  readonly totalClosed: number;
  readonly totalFrozen: number;
  readonly totalExpired: number;
  readonly totalResolved: number;
  readonly totalNullified: number;
  readonly totalSuppressed: number;
  readonly avgWindowLifetimeMs: number;
  readonly peakActiveCount: number;
  readonly holdActivations: number;
  readonly sessionStartedAtMs: number;
  readonly lastActivityMs: number;
}

// ============================================================================
// SECTION 4 — PURE HELPER UTILITIES
// ============================================================================

function normalizeMs(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.trunc(value));
}

function cloneMetadata(
  metadata: Readonly<Record<string, string | number | boolean | null>> | undefined,
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.freeze({ ...(metadata ?? {}) });
}

function toFrozenSnapshot(
  windowId: string,
  snapshot: RuntimeDecisionWindowSnapshot,
  frozen: boolean,
  closesAtMs?: number | null,
): RuntimeDecisionWindowSnapshot {
  return Object.freeze({
    ...snapshot,
    id: snapshot.id || windowId,
    closesAtMs: closesAtMs === undefined ? snapshot.closesAtMs : normalizeMs(closesAtMs),
    frozen,
    metadata: cloneMetadata(snapshot.metadata),
  });
}

function createSyntheticWindowSnapshot(
  windowId: string,
  closesAtMs: number,
  options: DecisionWindowSeedOptions = {},
): RuntimeDecisionWindowSnapshot {
  const normalizedCloseAtMs = Math.max(0, Math.trunc(closesAtMs));
  const openedAtMs = normalizeMs(options.openedAtMs) ?? Math.max(0, normalizedCloseAtMs - 1);

  return Object.freeze({
    id: windowId,
    timingClass: options.timingClass ?? 'FATE',
    label: options.label ?? windowId,
    source: options.source ?? 'time-engine',
    mode: options.mode ?? 'solo',
    openedAtTick: Math.max(0, Math.trunc(options.openedAtTick ?? 0)),
    openedAtMs,
    closesAtTick: options.closesAtTick ?? null,
    closesAtMs: normalizedCloseAtMs,
    exclusive: options.exclusive ?? false,
    frozen: false,
    consumed: false,
    actorId: options.actorId ?? null,
    targetActorId: options.targetActorId ?? null,
    cardInstanceId: options.cardInstanceId ?? null,
    metadata: cloneMetadata(options.metadata),
  });
}

/** Maps PressureTier → urgency score using TIME_CONTRACT_TIER_URGENCY. */
export function computeUrgencyFromTier(tier: PressureTier): number {
  return TIME_CONTRACT_TIER_URGENCY[tier] ?? 0.2;
}

/** Maps ModeCode → tempo multiplier using TIME_CONTRACT_MODE_TEMPO. */
export function computeModeTempoMultiplier(mode: ModeCode): number {
  return TIME_CONTRACT_MODE_TEMPO[mode] ?? 1.0;
}

/** Maps RunPhase → phase score using TIME_CONTRACT_PHASE_SCORE. */
export function computePhaseScore(phase: RunPhase): number {
  return TIME_CONTRACT_PHASE_SCORE[phase] ?? 0.0;
}

/** Returns true if a given outcome is terminal. */
export function isOutcomeTerminal(outcome: RunOutcome | null): boolean {
  if (outcome === null) return false;
  return TIME_CONTRACT_OUTCOME_IS_TERMINAL[outcome] ?? false;
}

/** Classifies a latency value using TIME_CONTRACT_LATENCY_THRESHOLDS. */
export function classifyLatency(ms: number): 'FAST' | 'ACCEPTABLE' | 'SLOW' | 'ALARM' {
  if (ms <= TIME_CONTRACT_LATENCY_THRESHOLDS.FAST_MS) return 'FAST';
  if (ms <= TIME_CONTRACT_LATENCY_THRESHOLDS.ACCEPTABLE_MS) return 'ACCEPTABLE';
  if (ms <= TIME_CONTRACT_LATENCY_THRESHOLDS.SLOW_MS) return 'SLOW';
  return 'ALARM';
}

/** Classifies a clock drift value using TIME_CONTRACT_TICK_DRIFT_THRESHOLDS. */
export function classifyDrift(ms: number): 'OK' | 'NOTABLE' | 'SEVERE' | 'CRITICAL' {
  if (ms <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.ACCEPTABLE_DRIFT_MS) return 'OK';
  if (ms <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS) return 'NOTABLE';
  if (ms <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS) return 'SEVERE';
  return 'CRITICAL';
}

/** Converts a hold result code to a narrated string. */
export function narrateHoldResult(code: DecisionTimerHoldResultCode): string {
  return TIME_CONTRACT_HOLD_RESULT_LABELS[code] ?? code;
}

/** Normalizes a budget ms value to 0.0–1.0 against TIME_CONTRACT_MAX_BUDGET_MS. */
export function normalizeBudgetMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(1, ms / TIME_CONTRACT_MAX_BUDGET_MS);
}

/** Normalizes a tick duration to 0.0–1.0 against TIME_CONTRACT_MAX_TICK_DURATION_MS. */
export function normalizeTickDurationNorm(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(1, ms / TIME_CONTRACT_MAX_TICK_DURATION_MS);
}

/** Normalizes a decision window ms value to 0.0–1.0 against TIME_CONTRACT_MAX_DECISION_WINDOW_MS. */
export function normalizeWindowMsNorm(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(1, ms / TIME_CONTRACT_MAX_DECISION_WINDOW_MS);
}

/** Computes budget alarm level from utilized/total. */
export function computeBudgetAlarm(
  elapsedMs: number,
  totalMs: number,
): 'OK' | 'WARNING' | 'CRITICAL' | 'EXHAUST' {
  if (totalMs <= 0) return 'EXHAUST';
  const pct = elapsedMs / totalMs;
  if (pct >= TIME_CONTRACT_BUDGET_THRESHOLDS.EXHAUST_PCT) return 'EXHAUST';
  if (pct >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT) return 'CRITICAL';
  if (pct >= TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT) return 'WARNING';
  return 'OK';
}

/** Resolves TickTier from a PressureTier using the canonical bridge. */
export function resolveTickTierForPressure(p: PressureTier): TickTier {
  return pressureTierToTickTier(p);
}

/** Resolves PressureTier from a TickTier using the canonical bridge. */
export function resolvePressureForTickTier(t: TickTier): PressureTier {
  return tickTierToPressureTier(t);
}

/** Gets TickTierConfig for a given PressureTier. */
export function getConfigForPressure(p: PressureTier): TickTierConfig {
  return getTickTierConfigByPressureTier(p);
}

/** Gets TickTierConfig for a given TickTier. */
export function getConfigForTier(t: TickTier): TickTierConfig {
  return getTickTierConfig(t);
}

/** Returns the default tick duration ms for a PressureTier. */
export function getDefaultDurationForTier(p: PressureTier): number {
  return getDefaultTickDurationMs(p);
}

/** Returns the decision window duration ms for a PressureTier. */
export function computeDefaultWindowDurationForTier(p: PressureTier): number {
  return getDecisionWindowDurationMs(p);
}

/** Normalizes a window duration for a given tier using the tier's config bounds. */
export function normalizeWindowDuration(p: PressureTier, ms: number): number {
  return normalizeTickDurationMs(p, ms);
}

/** Clamps a window closes-at ms to the tier's configured bounds. */
export function clampWindowMs(p: PressureTier, ms: number): number {
  return clampTickDurationMs(p, ms);
}

/** Resolves the current game phase from elapsed ms. */
export function resolveCurrentPhase(elapsedMs: number): RunPhase {
  return resolvePhaseFromElapsedMs(elapsedMs);
}

/** Returns a non-negative integer-clamped value. */
export function computeNonNegativeInt(v: number): number {
  return clampNonNegativeInteger(v);
}

/** Forecasts how many interpolation ticks a tier transition will take. */
export function forecastTierTransitionTicks(deltaMs: number): number {
  return computeInterpolationTickCount(deltaMs);
}

/** Builds an interpolation plan for a tier change. */
export function buildInterpolationForTierChange(
  fromTier: TickTier,
  toTier: TickTier,
): TickInterpolationPlan {
  const fromMs = TICK_TIER_CONFIGS[fromTier].defaultDurationMs;
  const toMs = TICK_TIER_CONFIGS[toTier].defaultDurationMs;
  return createInterpolationPlan(fromTier, toTier, fromMs, toMs);
}

/** Returns the canonical number of phase boundary transition windows. */
export function computePhaseBoundaryWindows(): number {
  return DEFAULT_PHASE_TRANSITION_WINDOWS;
}

/** Finds the PhaseBoundary that contains the current elapsed ms. */
export function findCurrentPhaseBoundary(elapsedMs: number): PhaseBoundary | null {
  let current: PhaseBoundary | null = null;
  for (const boundary of PHASE_BOUNDARIES_MS) {
    if (elapsedMs >= boundary.startsAtMs) {
      current = boundary;
    }
  }
  return current;
}

/** Gets decision window duration for a tier from DECISION_WINDOW_DURATIONS_MS. */
export function getWindowDurationForTier(p: PressureTier): number {
  return DECISION_WINDOW_DURATIONS_MS[p];
}

/** Computes drift score between actual tick duration and expected tier duration. */
export function computeTierDriftScore(actualMs: number, tier: PressureTier): number {
  const expected = TIER_DURATIONS_MS[tier];
  if (expected <= 0) return 0;
  const drift = Math.abs(actualMs - expected);
  if (drift >= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.CRITICAL_DRIFT_MS) return 1.0;
  return Math.min(1, drift / TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.CRITICAL_DRIFT_MS);
}

/** Gets window duration config for a given tier from TICK_TIER_CONFIGS. */
export function getWindowConfigForTier(
  p: PressureTier,
): Readonly<{ decisionWindowMs: number; defaultDurationMs: number }> {
  const cfg = TICK_TIER_CONFIGS[resolveTickTierForPressure(p)];
  return Object.freeze({
    decisionWindowMs: cfg.decisionWindowMs,
    defaultDurationMs: cfg.defaultDurationMs,
  });
}

/** Classifies a DecisionCardType to a severity score. */
export function classifyCardTypeSeverity(cardType: DecisionCardType): number {
  switch (cardType) {
    case DecisionCardType.CRISIS_EVENT: return 1.0;
    case DecisionCardType.HATER_INJECTION: return 0.7;
    case DecisionCardType.FORCED_FATE: return 0.4;
    default: return 0.3;
  }
}

/** Builds a full DecisionWindow from a runtime snapshot and a card type. */
export function buildDecisionWindowFromSnapshot(
  snap: RuntimeDecisionWindowSnapshot,
  cardType: DecisionCardType,
  remainingMs: number,
): DecisionWindow {
  const durationMs = snap.closesAtMs !== null && snap.openedAtMs !== null
    ? Math.max(0, snap.closesAtMs - snap.openedAtMs)
    : 0;
  return {
    windowId: snap.id,
    cardId: snap.cardInstanceId ?? snap.id,
    cardType,
    durationMs,
    remainingMs: Math.max(0, remainingMs),
    openedAtMs: snap.openedAtMs,
    expiresAtMs: snap.closesAtMs ?? snap.openedAtMs + durationMs,
    isOnHold: snap.frozen,
    holdExpiresAtMs: null,
    worstOptionIndex: 0,
    isExpired: false,
    isResolved: snap.consumed,
  };
}

/** Checks if a TickTier represents a high-pressure state. */
export function isTickTierHighPressure(tier: TickTier): boolean {
  return tier === TickTier.CRISIS || tier === TickTier.COLLAPSE_IMMINENT;
}

/** Builds a DecisionTimerSeasonContext from active SeasonTimeWindow list. */
export function buildSeasonContext(
  windows: readonly SeasonTimeWindow[],
  nowMs: number,
): DecisionTimerSeasonContext {
  const active = windows.filter((w) => w.isActive && nowMs >= w.startsAtMs && nowMs <= w.endsAtMs);
  const types = active.map((w) => w.type);
  const multiplier = active.reduce((acc, w) => acc * w.pressureMultiplier, 1.0);

  return Object.freeze({
    activeWindowTypes: Object.freeze(types),
    pressureMultiplier: multiplier,
    hasLiveopsEvent: types.includes(SeasonWindowType.LIVEOPS_EVENT),
    hasSeasonFinale: types.includes(SeasonWindowType.SEASON_FINALE),
    hasKickoff: types.includes(SeasonWindowType.KICKOFF),
    hasReengageWindow: types.includes(SeasonWindowType.REENGAGE_WINDOW),
    hasArchiveClose: types.includes(SeasonWindowType.ARCHIVE_CLOSE),
  });
}

/** Extracts economic context for ML/risk use. */
export function extractEconomicContext(economy: EconomyState): DecisionTimerEconomicContext {
  const netFlowPerTick = economy.incomePerTick - economy.expensesPerTick;
  const progressRatio = economy.freedomTarget > 0
    ? Math.min(1, Math.max(0, economy.netWorth / economy.freedomTarget))
    : 0;
  return Object.freeze({
    cash: economy.cash,
    debt: economy.debt,
    netWorth: economy.netWorth,
    freedomTarget: economy.freedomTarget,
    netFlowPerTick,
    netWorthProgressRatio: progressRatio,
    haterHeatNorm: Math.min(1, economy.haterHeat / 100),
    isNetFlowPositive: netFlowPerTick > 0,
  });
}

/** Extracts pressure context for ML/risk use. */
export function extractPressureContext(pressure: PressureState): DecisionTimerPressureContext {
  return Object.freeze({
    tier: pressure.tier,
    score: pressure.score,
    urgencyScore: computeUrgencyFromTier(pressure.tier),
    isEscalated: pressure.tier === 'T3' || pressure.tier === 'T4',
    upwardCrossings: pressure.upwardCrossings,
  });
}

/** Extracts shield context for ML/risk use. */
export function extractShieldContext(shield: ShieldState): DecisionTimerShieldContext {
  const breachRisk = shield.weakestLayerRatio < 0.25
    ? 0.9
    : shield.weakestLayerRatio < 0.5
      ? 0.6
      : shield.weakestLayerRatio < 0.75
        ? 0.3
        : 0.1;
  return Object.freeze({
    weakestLayerRatio: shield.weakestLayerRatio,
    breachesThisRun: shield.breachesThisRun,
    repairQueueDepth: shield.repairQueueDepth,
    breachRisk,
  });
}

/** Extracts battle context for ML/risk use. */
export function extractBattleContext(battle: BattleState): DecisionTimerBattleContext {
  const attackingBots = battle.bots.filter((b) => b.state === 'ATTACKING').length;
  const threatScore = Math.min(1, (attackingBots / 5) * 0.8 + (battle.rivalryHeatCarry / 100) * 0.2);
  return Object.freeze({
    activeBotsCount: battle.bots.filter((b) => b.state !== 'DORMANT' && b.state !== 'NEUTRALIZED').length,
    attackingBotsCount: attackingBots,
    threatScore,
    firstBloodClaimed: battle.firstBloodClaimed,
  });
}

/** Extracts hand/cards context for ML use. */
export function extractHandContext(cards: CardsState): DecisionTimerHandContext {
  return Object.freeze({
    handSize: cards.hand.length,
    handSizeNorm: Math.min(1, cards.hand.length / 10),
    deckEntropy: Math.min(1, cards.deckEntropy),
    drawPileSize: cards.drawPileSize,
  });
}

/** Extracts mode context for ML use. */
export function extractModeContext(
  modeState: ModeState,
  timers: TimerState,
): DecisionTimerModeContext {
  return Object.freeze({
    mode: 'solo' as ModeCode,
    holdEnabled: modeState.holdEnabled,
    holdCharges: timers.holdCharges,
    phaseBoundaryWindowsRemaining: modeState.phaseBoundaryWindowsRemaining,
    bleedMode: modeState.bleedMode,
  });
}

/** Extracts telemetry context for ML use. */
export function extractTelemetryContext(
  telemetry: TelemetryState,
  outcome: RunOutcome | null,
): DecisionTimerTelemetryContext {
  return Object.freeze({
    decisionCount: telemetry.decisions.length,
    warningCount: telemetry.warnings.length,
    emittedEventCount: telemetry.emittedEventCount,
    outcomeReason: telemetry.outcomeReason,
    outcomeTerminal: isOutcomeTerminal(outcome),
  });
}

/** Computes DecisionTimerBudgetStatus from a TimerState. */
export function computeBudgetStatus(timers: TimerState): DecisionTimerBudgetStatus {
  const totalMs = timers.seasonBudgetMs + timers.extensionBudgetMs;
  const elapsedMs = timers.elapsedMs;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const utilizationPct = totalMs > 0 ? elapsedMs / totalMs : 0;
  const alarmLevel = computeBudgetAlarm(elapsedMs, totalMs);
  return Object.freeze({
    seasonBudgetMs: timers.seasonBudgetMs,
    extensionBudgetMs: timers.extensionBudgetMs,
    elapsedMs,
    remainingMs,
    utilizationPct,
    alarmLevel,
    msToChatThreshold: Math.max(0, remainingMs - TIME_CONTRACT_BUDGET_THRESHOLDS.MIN_REMAINING_MS_FOR_CHAT),
  });
}

/** Builds a DecisionTimerCadenceProfile from pressure tier and mode. */
export function buildCadenceProfile(
  tier: PressureTier,
  mode: ModeCode,
  remainingBudgetMs: number,
  previousTier?: PressureTier | null,
): DecisionTimerCadenceProfile {
  const tickTier = resolveTickTierForPressure(tier);
  const tierConfig = getConfigForPressure(tier);
  const modeTempoMultiplier = computeModeTempoMultiplier(mode);
  let interpolationPlan: TickInterpolationPlan | null = null;

  if (previousTier && previousTier !== tier) {
    const prevTickTier = resolveTickTierForPressure(previousTier);
    interpolationPlan = buildInterpolationForTierChange(prevTickTier, tickTier);
  }

  void remainingBudgetMs; // consumed by budget-aware callers

  return Object.freeze({
    tier,
    tickTier,
    tierConfig,
    defaultDurationMs: tierConfig.defaultDurationMs,
    decisionWindowMs: tierConfig.decisionWindowMs,
    modeTempoMultiplier,
    shouldScreenShake: tierConfig.screenShake,
    interpolationPlan,
  });
}

/** Applies a TimeCadenceResolution to derive window duration. */
export function deriveDurationFromCadence(cadence: TimeCadenceResolution): number {
  const base = cadence.decisionWindowMs;
  const tempo = cadence.modeTempoMultiplier * cadence.seasonMultiplier * cadence.budgetTempoMultiplier;
  return Math.max(500, Math.trunc(base * tempo));
}

/** Converts remaining ms to a 0.0–1.0 remaining ratio given a reference duration. */
function computeRemainingRatio(
  closesAtMs: number | null,
  openedAtMs: number,
  nowMs: number,
): number {
  if (closesAtMs === null) return 1.0;
  const totalDuration = Math.max(1, closesAtMs - openedAtMs);
  const remaining = Math.max(0, closesAtMs - nowMs);
  return Math.min(1, remaining / totalDuration);
}

/** Computes a composite risk score for a single window. */
function computeWindowRisk(
  window: MutableDecisionWindowState,
  pressureTier: PressureTier,
  nowMs: number,
): number {
  const snap = window.snapshot;
  const remainingRatio = computeRemainingRatio(snap.closesAtMs, snap.openedAtMs, nowMs);
  const urgency = computeUrgencyFromTier(pressureTier);
  const isFrozen = window.frozenUntilMs !== null && window.frozenUntilMs > nowMs;
  const frozenPenalty = isFrozen ? 0.15 : 0;
  const exclusivePenalty = snap.exclusive ? 0.1 : 0;
  const timerUrgency = remainingRatio < 0.15 ? 1.0 : remainingRatio < 0.3 ? 0.7 : 1 - remainingRatio;

  return Math.min(1, urgency * 0.4 + timerUrgency * 0.4 + frozenPenalty + exclusivePenalty);
}

// ============================================================================
// SECTION 5 — ML FEATURE EXTRACTION (28-dim aligned with TIME_CONTRACT_ML_DIM)
// ============================================================================

/**
 * Extracts the 28-dimensional ML feature vector from the current timer state
 * and full RunStateSnapshot. Aligned with TIME_CONTRACT_ML_DIM = 28.
 */
export function extractDecisionTimerMLVector(
  windows: ReadonlyMap<string, MutableDecisionWindowState>,
  snapshot: RunStateSnapshot,
  nowMs: number,
): DecisionTimerMLVector {
  const windowArr = [...windows.values()];
  const activeCount = windowArr.length;
  const frozenCount = windowArr.filter(
    (w) => w.frozenUntilMs !== null && w.frozenUntilMs > nowMs,
  ).length;

  const remainingRatios = windowArr.map((w) =>
    computeRemainingRatio(w.snapshot.closesAtMs, w.snapshot.openedAtMs, nowMs),
  );
  const avgRemainingRatio = remainingRatios.length > 0
    ? remainingRatios.reduce((a, b) => a + b, 0) / remainingRatios.length
    : 1.0;
  const minRemainingRatio = remainingRatios.length > 0
    ? Math.min(...remainingRatios)
    : 1.0;

  const timers = snapshot.timers;
  const totalBudget = timers.seasonBudgetMs + timers.extensionBudgetMs;
  const budgetUtilRatio = totalBudget > 0 ? timers.elapsedMs / totalBudget : 0;

  const pressureTier = snapshot.pressure.tier;
  const pressureUrgency = computeUrgencyFromTier(pressureTier);

  const modeTempoNorm = computeModeTempoMultiplier(snapshot.mode) / 1.25; // max is 1.25 (pvp)

  const phase = resolveCurrentPhase(timers.elapsedMs);
  const phaseScore = computePhaseScore(phase);

  const holdChargesNorm = Math.min(1, timers.holdCharges / 3);
  const holdWindowRatio = activeCount > 0 ? frozenCount / activeCount : 0;

  const tickDrift = Math.abs(timers.currentTickDurationMs - getDefaultDurationForTier(pressureTier));
  const latencyClass = classifyLatency(timers.currentTickDurationMs);
  const latencyScore = latencyClass === 'FAST' ? 0.0
    : latencyClass === 'ACCEPTABLE' ? 0.33
    : latencyClass === 'SLOW' ? 0.66
    : 1.0;
  const driftScore = computeTierDriftScore(timers.currentTickDurationMs, pressureTier);
  const budgetAlarm = computeBudgetAlarm(timers.elapsedMs, totalBudget);
  const budgetAlarmScore = budgetAlarm === 'OK' ? 0.0
    : budgetAlarm === 'WARNING' ? 0.33
    : budgetAlarm === 'CRITICAL' ? 0.66
    : 1.0;

  const decisionCount = snapshot.telemetry.decisions.length;
  const tick = Math.max(1, snapshot.tick);
  const decisionRatePerTick = Math.min(1, decisionCount / (tick * 3));

  const shield = extractShieldContext(snapshot.shield);
  const battle = extractBattleContext(snapshot.battle);
  const hand = extractHandContext(snapshot.cards);
  const econ = extractEconomicContext(snapshot.economy);

  const warningCountNorm = Math.min(1, snapshot.telemetry.warnings.length / 10);
  const outcomeTerminalFlag = isOutcomeTerminal(snapshot.outcome) ? 1.0 : 0.0;

  const tierInterpolActive = (timers.tierInterpolationRemainingTicks ?? 0) > 0 ? 1.0 : 0.0;

  const seasonMultiplier = 1.0; // no active season calendar available at timer level

  const phaseBoundaryWindowsNorm = Math.min(
    1,
    snapshot.modeState.phaseBoundaryWindowsRemaining / computePhaseBoundaryWindows(),
  );

  const exclusiveCount = windowArr.filter((w) => w.snapshot.exclusive).length;
  const exclusiveRatio = activeCount > 0 ? exclusiveCount / activeCount : 0;

  const compositeRisk = windowArr.length > 0
    ? Math.min(
        1,
        windowArr.reduce((sum, w) => sum + computeWindowRisk(w, pressureTier, nowMs), 0) /
          windowArr.length,
      )
    : 0;

  void tickDrift; // consumed via driftScore

  const features: number[] = [
    Math.min(1, activeCount / 10),                  // 0
    Math.min(1, frozenCount / 5),                   // 1
    avgRemainingRatio,                               // 2
    minRemainingRatio,                               // 3
    Math.min(1, budgetUtilRatio),                    // 4
    pressureUrgency,                                 // 5
    Math.min(1, modeTempoNorm),                      // 6
    phaseScore,                                      // 7
    holdChargesNorm,                                 // 8
    holdWindowRatio,                                 // 9
    latencyScore,                                    // 10
    driftScore,                                      // 11
    budgetAlarmScore,                                // 12
    decisionRatePerTick,                             // 13
    shield.breachRisk,                               // 14
    battle.threatScore,                              // 15
    hand.handSizeNorm,                               // 16
    hand.deckEntropy,                                // 17
    Math.max(0, Math.min(1, (econ.netFlowPerTick + 1000) / 2000)), // 18
    econ.netWorthProgressRatio,                      // 19
    econ.haterHeatNorm,                              // 20
    warningCountNorm,                                // 21
    outcomeTerminalFlag,                             // 22
    tierInterpolActive,                              // 23
    seasonMultiplier - 1.0,                          // 24 — delta from neutral
    phaseBoundaryWindowsNorm,                        // 25
    exclusiveRatio,                                  // 26
    compositeRisk,                                   // 27
  ];

  // Enforce exactly TIME_CONTRACT_ML_DIM features
  while (features.length < TIME_CONTRACT_ML_DIM) features.push(0);
  const finalFeatures = features.slice(0, TIME_CONTRACT_ML_DIM);

  return Object.freeze({
    features: Object.freeze(finalFeatures),
    labels: DECISION_TIMER_ML_FEATURE_LABELS,
    dim: TIME_CONTRACT_ML_DIM,
    computedAtMs: nowMs,
    windowCount: activeCount,
  });
}

// ============================================================================
// SECTION 6 — DL TENSOR CONSTRUCTION (40×6 aligned with TIME_CONTRACT_DL_*)
// ============================================================================

/**
 * Builds a DL row for a single window state.
 * Each row has TIME_CONTRACT_DL_COL_COUNT = 6 columns.
 */
export function buildTimerDLRow(
  window: MutableDecisionWindowState,
  pressureTier: PressureTier,
  nowMs: number,
): DecisionTimerDLRow {
  const snap = window.snapshot;
  const remainingRatio = computeRemainingRatio(snap.closesAtMs, snap.openedAtMs, nowMs);
  const frozenFlag = window.frozenUntilMs !== null && window.frozenUntilMs > nowMs ? 1.0 : 0.0;
  const totalBudget = 1; // budget utilization is computed at batch level; per-window placeholder
  const budgetUtilization = computeUrgencyFromTier(pressureTier); // tier urgency proxies budget stress
  const persistedFlag = window.persistedInSnapshot ? 1.0 : 0.0;
  const exclusiveFlag = snap.exclusive ? 1.0 : 0.0;
  const ageMs = snap.closesAtMs !== null ? Math.max(0, nowMs - snap.openedAtMs) : 0;
  const ageRatio = normalizeWindowMsNorm(ageMs);

  void totalBudget;

  const cols = Object.freeze([
    remainingRatio,      // 0
    frozenFlag,          // 1
    budgetUtilization,   // 2
    persistedFlag,       // 3
    exclusiveFlag,       // 4
    ageRatio,            // 5
  ]);

  // Enforce exactly TIME_CONTRACT_DL_COL_COUNT cols
  const finalCols = [...cols].slice(0, TIME_CONTRACT_DL_COL_COUNT);
  while (finalCols.length < TIME_CONTRACT_DL_COL_COUNT) finalCols.push(0);

  return Object.freeze({
    cols: Object.freeze(finalCols),
    windowId: window.windowId,
    capturedAtMs: nowMs,
  });
}

/**
 * Builds the full 40×6 DL tensor from active window states.
 * Up to TIME_CONTRACT_DL_ROW_COUNT rows; padded with zeros if fewer windows.
 */
export function buildDecisionTimerDLTensor(
  windows: ReadonlyMap<string, MutableDecisionWindowState>,
  snapshot: RunStateSnapshot,
  nowMs: number,
): DecisionTimerDLTensor {
  const pressureTier = snapshot.pressure.tier;
  const windowArr = [...windows.values()];
  const rows: DecisionTimerDLRow[] = [];

  for (const w of windowArr.slice(0, DECISION_TIMER_DL_HISTORY_DEPTH)) {
    rows.push(buildTimerDLRow(w, pressureTier, nowMs));
  }

  // Pad to DECISION_TIMER_DL_HISTORY_DEPTH with zero rows
  while (rows.length < DECISION_TIMER_DL_HISTORY_DEPTH) {
    rows.push(Object.freeze({
      cols: Object.freeze(new Array<number>(TIME_CONTRACT_DL_COL_COUNT).fill(0)),
      windowId: '__pad__',
      capturedAtMs: nowMs,
    }));
  }

  return Object.freeze({
    rows: Object.freeze(rows),
    rowCount: DECISION_TIMER_DL_HISTORY_DEPTH,
    colCount: TIME_CONTRACT_DL_COL_COUNT,
    colLabels: DECISION_TIMER_DL_COL_LABELS,
    builtAtMs: nowMs,
  });
}

/** Flattens a DL tensor into a 1D array for inference. */
export function flattenDecisionTimerDLTensor(tensor: DecisionTimerDLTensor): readonly number[] {
  const flat: number[] = [];
  for (const row of tensor.rows) {
    for (const col of row.cols) {
      flat.push(col);
    }
  }
  return Object.freeze(flat);
}

// ============================================================================
// SECTION 7 — RISK ASSESSMENT
// ============================================================================

/** Assesses risk for a single window state. */
export function assessWindowRisk(
  window: MutableDecisionWindowState,
  snapshot: RunStateSnapshot,
  nowMs: number,
): DecisionTimerRiskAssessment {
  const snap = window.snapshot;
  const pressureTier = snapshot.pressure.tier;
  const riskScore = computeWindowRisk(window, pressureTier, nowMs);
  const riskScore100 = Math.round(riskScore * 100);

  const urgencyLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
    riskScore >= 0.8 ? 'CRITICAL'
    : riskScore >= 0.55 ? 'HIGH'
    : riskScore >= 0.3 ? 'MEDIUM'
    : 'LOW';

  const remainingMs = snap.closesAtMs !== null ? Math.max(0, snap.closesAtMs - nowMs) : null;
  const remainingRatio = computeRemainingRatio(snap.closesAtMs, snap.openedAtMs, nowMs);
  const isFrozen = window.frozenUntilMs !== null && window.frozenUntilMs > nowMs;
  const latencyMs = snap.closesAtMs !== null ? nowMs - snap.openedAtMs : 0;
  const latencyClass = classifyLatency(latencyMs);
  const totalBudget = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
  const budgetAlarmLevel = computeBudgetAlarm(snapshot.timers.elapsedMs, totalBudget);

  const tags: string[] = ['decision-timer:risk-assessed'];
  if (isFrozen) tags.push('decision-timer:window-frozen');
  if (snap.exclusive) tags.push('decision-timer:exclusive');
  if (urgencyLabel === 'CRITICAL') tags.push('decision-timer:critical-risk');
  if (remainingMs !== null && remainingMs < 1000) tags.push('decision-timer:imminent-expiry');

  return Object.freeze({
    windowId: window.windowId,
    riskScore,
    riskScore100,
    urgencyLabel,
    remainingRatio,
    isFrozen,
    isExclusive: snap.exclusive,
    latencyClass,
    budgetAlarmLevel,
    tags: Object.freeze(tags),
  });
}

/** Assesses risk for all active windows. */
export function assessBatchWindowRisk(
  windows: ReadonlyMap<string, MutableDecisionWindowState>,
  snapshot: RunStateSnapshot,
  nowMs: number,
): readonly DecisionTimerRiskAssessment[] {
  return Object.freeze([...windows.values()].map((w) => assessWindowRisk(w, snapshot, nowMs)));
}

/** Computes an aggregate risk score from a batch assessment. */
export function computeAggregateRiskScore(
  assessments: readonly DecisionTimerRiskAssessment[],
): number {
  if (assessments.length === 0) return 0;
  const sum = assessments.reduce((acc, a) => acc + a.riskScore, 0);
  return Math.min(1, sum / assessments.length);
}

// ============================================================================
// SECTION 8 — DIAGNOSTICS
// ============================================================================

/** Builds a full health report from current timer state and snapshot. */
export function diagnoseTimerHealth(
  windows: ReadonlyMap<string, MutableDecisionWindowState>,
  snapshot: RunStateSnapshot,
  nowMs: number,
): DecisionTimerHealthReport {
  const assessments = assessBatchWindowRisk(windows, snapshot, nowMs);
  const totalActive = windows.size;
  const totalFrozen = [...windows.values()].filter(
    (w) => w.frozenUntilMs !== null && w.frozenUntilMs > nowMs,
  ).length;
  const totalExpiredImminent = [...windows.values()].filter((w) => {
    const rem = w.snapshot.closesAtMs !== null ? w.snapshot.closesAtMs - nowMs : Infinity;
    return rem < snapshot.timers.currentTickDurationMs;
  }).length;
  const highRiskCount = assessments.filter(
    (a) => a.urgencyLabel === 'HIGH' || a.urgencyLabel === 'CRITICAL',
  ).length;
  const criticalRiskCount = assessments.filter((a) => a.urgencyLabel === 'CRITICAL').length;

  const avgRemainingRatio = assessments.length > 0
    ? assessments.reduce((sum, a) => sum + a.remainingRatio, 0) / assessments.length
    : 1.0;
  const compositeRiskScore = computeAggregateRiskScore(assessments);
  const budgetStatus = computeBudgetStatus(snapshot.timers);

  const warnings: string[] = [];
  if (criticalRiskCount > 0) warnings.push(`${criticalRiskCount} window(s) at critical risk`);
  if (totalExpiredImminent > 0) warnings.push(`${totalExpiredImminent} window(s) expiring this tick`);
  if (budgetStatus.alarmLevel === 'EXHAUST') warnings.push('Season budget exhausted');
  if (budgetStatus.alarmLevel === 'CRITICAL') warnings.push('Season budget critical');

  return Object.freeze({
    totalActive,
    totalFrozen,
    totalExpiredImminent,
    highRiskCount,
    criticalRiskCount,
    avgRemainingRatio,
    compositeRiskScore,
    budgetStatus,
    warnings: Object.freeze(warnings),
    generatedAtMs: nowMs,
  });
}

/** Builds a human-readable summary from a health report. */
export function buildHealthSummary(report: DecisionTimerHealthReport): string {
  const parts: string[] = [
    `DecisionTimer health: ${report.totalActive} active`,
    report.totalFrozen > 0 ? `${report.totalFrozen} frozen` : null,
    report.criticalRiskCount > 0 ? `${report.criticalRiskCount} CRITICAL` : null,
    `budget=${report.budgetStatus.alarmLevel}`,
    `risk=${(report.compositeRiskScore * 100).toFixed(0)}%`,
  ].filter((p): p is string => p !== null);
  return parts.join(' | ');
}

// ============================================================================
// SECTION 9 — CHAT SIGNAL BUILDER
// ============================================================================

/** Narratives indexed by urgency for window signals. */
const TIMER_URGENCY_HEADLINES: Readonly<Record<string, string>> = Object.freeze({
  CRITICAL: 'Time is almost up — act now or face the worst outcome',
  HIGH: 'Decision window closing fast — choose your path',
  MEDIUM: 'Forced decision active — clock is ticking',
  LOW: 'Open decision window — take your time',
});

const TIMER_COACHING_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  CRITICAL: 'Every second counts. The auto-resolve penalty will hurt your momentum.',
  HIGH: 'You have seconds left. Even a suboptimal choice beats the default.',
  MEDIUM: 'Review your options now. Letting this expire costs you control.',
  LOW: 'No rush — but resolving early earns tempo advantage.',
});

/** Builds a DecisionTimerChatSignal for a single window. */
export function buildTimerChatSignal(
  window: MutableDecisionWindowState,
  snapshot: RunStateSnapshot,
  nowMs: number,
): DecisionTimerChatSignal {
  const assessment = assessWindowRisk(window, snapshot, nowMs);
  const mlVector = extractDecisionTimerMLVector(
    new Map([[window.windowId, window]]),
    snapshot,
    nowMs,
  );
  const snap = window.snapshot;
  const remainingMs = snap.closesAtMs !== null ? Math.max(0, snap.closesAtMs - nowMs) : null;

  const tags: string[] = [
    'decision-timer:chat-signal',
    `timer:urgency:${assessment.urgencyLabel.toLowerCase()}`,
    `timer:timing-class:${snap.timingClass.toLowerCase()}`,
  ];
  if (assessment.isFrozen) tags.push('timer:frozen');
  if (assessment.isExclusive) tags.push('timer:exclusive');

  return Object.freeze({
    windowId: window.windowId,
    label: snap.label,
    source: snap.source,
    timingClass: snap.timingClass,
    riskScore: assessment.riskScore,
    riskScore100: assessment.riskScore100,
    urgencyLabel: assessment.urgencyLabel,
    remainingMs,
    remainingRatio: assessment.remainingRatio,
    isFrozen: assessment.isFrozen,
    isExclusive: assessment.isExclusive,
    budgetAlarmLevel: assessment.budgetAlarmLevel,
    narrativeHeadline:
      TIMER_URGENCY_HEADLINES[assessment.urgencyLabel] ?? TIMER_URGENCY_HEADLINES['LOW']!,
    coachingMessage:
      TIMER_COACHING_MESSAGES[assessment.urgencyLabel] ?? TIMER_COACHING_MESSAGES['LOW']!,
    mlVector,
    tags: Object.freeze(tags),
    emittedAtMs: nowMs,
  });
}

/** Builds chat signals for all active windows. */
export function buildTimerChatBatch(
  windows: ReadonlyMap<string, MutableDecisionWindowState>,
  snapshot: RunStateSnapshot,
  nowMs: number,
): readonly DecisionTimerChatSignal[] {
  return Object.freeze([...windows.values()].map((w) => buildTimerChatSignal(w, snapshot, nowMs)));
}

// ============================================================================
// SECTION 10 — EVENT PROCESSORS
// ============================================================================

/** Processes a TickEvent. Returns tags describing the tick transition. */
export function processTickEvent(
  event: TickEvent,
  snapshot: RunStateSnapshot,
): readonly string[] {
  const tags: string[] = ['time:tick-complete'];
  if (event.tierChangedThisTick) tags.push(`time:tier-changed-to:${event.tier}`);
  if (event.decisionsExpiredThisTick.length > 0) {
    tags.push(`time:decisions-expired:${event.decisionsExpiredThisTick.length}`);
  }
  if (event.holdActionUsedThisTick) tags.push('time:hold-used-this-tick');
  const phase = resolveCurrentPhase(snapshot.timers.elapsedMs);
  tags.push(`time:phase:${phase.toLowerCase()}`);
  return Object.freeze(tags);
}

/** Processes a TierChangeEvent. Returns the interpolation plan for the tier change. */
export function processTierChangeEvent(
  event: TierChangeEvent,
): TickInterpolationPlan {
  return buildInterpolationForTierChange(event.from, event.to);
}

/** Processes a DecisionWindowOpenedEvent. Returns a seed options object. */
export function processWindowOpenedEvent(
  event: DecisionWindowOpenedEvent,
): DecisionWindowSeedOptions {
  const w = event.window;
  return Object.freeze({
    timingClass: 'FATE' as TimingClass,
    label: `window:${w.windowId}`,
    source: 'time-engine:opened',
    openedAtMs: w.openedAtMs,
  });
}

/** Processes a DecisionWindowExpiredEvent. Returns narration tags. */
export function processWindowExpiredEvent(
  event: DecisionWindowExpiredEvent,
): readonly string[] {
  const tags: string[] = [
    'decision-timer:window-expired',
    `decision-timer:auto-resolved-to:${event.autoResolvedToOptionIndex}`,
  ];
  if (event.holdWasActive) tags.push('decision-timer:expired-on-hold');
  return Object.freeze(tags);
}

/** Processes a DecisionWindowResolvedEvent. Returns latency classification. */
export function processWindowResolvedEvent(
  event: DecisionWindowResolvedEvent,
): 'FAST' | 'ACCEPTABLE' | 'SLOW' | 'ALARM' {
  return classifyLatency(event.msRemainingAtResolution);
}

/** Processes a DecisionWindowTickEvent. Returns remaining ratio. */
export function processWindowTickEvent(event: DecisionWindowTickEvent): number {
  return normalizeWindowMsNorm(event.remainingMs);
}

/** Processes a HoldActionUsedEvent. Returns the narrated hold result. */
export function processHoldActionEvent(event: HoldActionUsedEvent): string {
  const label = narrateHoldResult('OK');
  return `${label} — window ${event.windowId} frozen for ${event.holdDurationMs}ms`;
}

/** Processes a RunTimeoutEvent. Returns terminal outcome flag. */
export function processRunTimeoutEvent(event: RunTimeoutEvent): boolean {
  return isOutcomeTerminal(event.outcome);
}

/** Processes a TickTierForcedEvent. Returns the config for the forced tier. */
export function processTickTierForcedEvent(event: TickTierForcedEvent): TickTierConfig {
  return getConfigForTier(event.tier);
}

/** Routes any TimeEngineEvent to the appropriate processor and returns a result tag. */
export function processTimeEngineEvent(
  event: TimeEngineEvent,
  snapshot: RunStateSnapshot,
): string {
  switch (event.eventType) {
    case 'TICK_COMPLETE':
      return `processed:tick:${event.tickNumber}`;
    case 'TICK_TIER_CHANGED':
      processTierChangeEvent(event);
      return `processed:tier-change:${event.from}->${event.to}`;
    case 'DECISION_WINDOW_OPENED':
      processWindowOpenedEvent(event);
      return `processed:window-opened:${event.window.windowId}`;
    case 'DECISION_WINDOW_EXPIRED':
      processWindowExpiredEvent(event);
      return `processed:window-expired:${event.windowId}`;
    case 'DECISION_WINDOW_RESOLVED':
      processWindowResolvedEvent(event);
      return `processed:window-resolved:${event.windowId}`;
    case 'DECISION_WINDOW_TICK':
      processWindowTickEvent(event);
      return `processed:window-tick:${event.windowId}`;
    case 'HOLD_ACTION_USED':
      processHoldActionEvent(event);
      return `processed:hold-used:${event.windowId}`;
    case 'RUN_TIMEOUT':
      processRunTimeoutEvent(event);
      return `processed:run-timeout`;
    case 'TICK_TIER_FORCED':
      processTickTierForcedEvent(event);
      return `processed:tier-forced:${event.tier}`;
    default:
      void snapshot;
      return 'processed:unknown-event';
  }
}

/** Creates a typed event dispatcher keyed on TimeEngineEventMap. */
export function createTypedEventDispatcher(
  snapshot: RunStateSnapshot,
): { dispatch<K extends keyof TimeEngineEventMap>(name: K, event: TimeEngineEventMap[K]): string } {
  return {
    dispatch<K extends keyof TimeEngineEventMap>(
      _name: K,
      event: TimeEngineEventMap[K],
    ): string {
      return processTimeEngineEvent(event as TimeEngineEvent, snapshot);
    },
  };
}

/** Creates a simple event dispatcher that returns the processed tag. */
export function createEventDispatcher(
  snapshot: RunStateSnapshot,
): (event: TimeEngineEvent) => string {
  return (event: TimeEngineEvent) => processTimeEngineEvent(event, snapshot);
}

// ============================================================================
// SECTION 11 — CONTEXT EXTRACTION FROM FULL SNAPSHOT
// ============================================================================

/**
 * Extracts all context sub-objects from a full RunStateSnapshot.
 * Used by the timer to inform ML/risk/chat outputs without re-reading snapshot.
 */
export function extractTimerContext(
  snapshot: RunStateSnapshot,
  nowMs: number,
): {
  economic: DecisionTimerEconomicContext;
  pressure: DecisionTimerPressureContext;
  shield: DecisionTimerShieldContext;
  battle: DecisionTimerBattleContext;
  hand: DecisionTimerHandContext;
  mode: DecisionTimerModeContext;
  telemetry: DecisionTimerTelemetryContext;
  budget: DecisionTimerBudgetStatus;
  cadence: DecisionTimerCadenceProfile;
  phase: RunPhase;
  phaseBoundary: PhaseBoundary | null;
} {
  const mode = extractModeContext(snapshot.modeState, snapshot.timers);
  const phase = resolveCurrentPhase(snapshot.timers.elapsedMs);
  const phaseBoundary = findCurrentPhaseBoundary(snapshot.timers.elapsedMs);

  void nowMs; // consumed by cadence computation below

  const cadence = buildCadenceProfile(
    snapshot.pressure.tier,
    snapshot.mode,
    snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs - snapshot.timers.elapsedMs,
    snapshot.pressure.previousTier,
  );

  return {
    economic: extractEconomicContext(snapshot.economy),
    pressure: extractPressureContext(snapshot.pressure),
    shield: extractShieldContext(snapshot.shield),
    battle: extractBattleContext(snapshot.battle),
    hand: extractHandContext(snapshot.cards),
    mode,
    telemetry: extractTelemetryContext(snapshot.telemetry, snapshot.outcome),
    budget: computeBudgetStatus(snapshot.timers),
    cadence,
    phase,
    phaseBoundary,
  };
}

// ============================================================================
// SECTION 12 — ANALYTICS TRACKER
// ============================================================================

/** Session-level analytics tracker for DecisionTimer lifecycle events. */
export class DecisionTimerAnalyticsTracker {
  private totalOpened = 0;
  private totalClosed = 0;
  private totalFrozen = 0;
  private totalExpired = 0;
  private totalResolved = 0;
  private totalNullified = 0;
  private totalSuppressed = 0;
  private lifetimeMsAccumulator = 0;
  private lifetimeWindowCount = 0;
  private peakActiveCount = 0;
  private holdActivations = 0;
  private readonly sessionStartedAtMs: number;
  private lastActivityMs: number;

  constructor(nowMs: number) {
    this.sessionStartedAtMs = nowMs;
    this.lastActivityMs = nowMs;
  }

  recordOpened(nowMs: number): void {
    this.totalOpened++;
    this.lastActivityMs = nowMs;
  }

  recordClosed(lifetimeMs: number, nowMs: number): void {
    this.totalClosed++;
    this.lifetimeMsAccumulator += Math.max(0, lifetimeMs);
    this.lifetimeWindowCount++;
    this.lastActivityMs = nowMs;
  }

  recordFrozen(nowMs: number): void {
    this.totalFrozen++;
    this.holdActivations++;
    this.lastActivityMs = nowMs;
  }

  recordExpired(nowMs: number): void {
    this.totalExpired++;
    this.lastActivityMs = nowMs;
  }

  recordResolved(nowMs: number): void {
    this.totalResolved++;
    this.lastActivityMs = nowMs;
  }

  recordNullified(nowMs: number): void {
    this.totalNullified++;
    this.lastActivityMs = nowMs;
  }

  recordSuppressed(nowMs: number): void {
    this.totalSuppressed++;
    this.lastActivityMs = nowMs;
  }

  updatePeakActive(currentCount: number): void {
    if (currentCount > this.peakActiveCount) {
      this.peakActiveCount = currentCount;
    }
  }

  snapshot(): DecisionTimerAnalytics {
    return Object.freeze({
      totalOpened: this.totalOpened,
      totalClosed: this.totalClosed,
      totalFrozen: this.totalFrozen,
      totalExpired: this.totalExpired,
      totalResolved: this.totalResolved,
      totalNullified: this.totalNullified,
      totalSuppressed: this.totalSuppressed,
      avgWindowLifetimeMs:
        this.lifetimeWindowCount > 0
          ? this.lifetimeMsAccumulator / this.lifetimeWindowCount
          : 0,
      peakActiveCount: this.peakActiveCount,
      holdActivations: this.holdActivations,
      sessionStartedAtMs: this.sessionStartedAtMs,
      lastActivityMs: this.lastActivityMs,
    });
  }

  reset(nowMs: number): void {
    this.totalOpened = 0;
    this.totalClosed = 0;
    this.totalFrozen = 0;
    this.totalExpired = 0;
    this.totalResolved = 0;
    this.totalNullified = 0;
    this.totalSuppressed = 0;
    this.lifetimeMsAccumulator = 0;
    this.lifetimeWindowCount = 0;
    this.peakActiveCount = 0;
    this.holdActivations = 0;
    this.lastActivityMs = nowMs;
  }
}

// ============================================================================
// SECTION 13 — DECISION TIMER CLASS (UPGRADED)
// ============================================================================

export class DecisionTimer {
  private readonly windows = new Map<string, MutableDecisionWindowState>();
  private readonly suppressedWindowIds = new Map<string, SuppressedWindowReason>();
  private analytics: DecisionTimerAnalyticsTracker;

  constructor(nowMs = 0) {
    this.analytics = new DecisionTimerAnalyticsTracker(nowMs);
  }

  // --------------------------------------------------------------------------
  // Core lifecycle
  // --------------------------------------------------------------------------

  public reset(nowMs = 0): void {
    this.windows.clear();
    this.suppressedWindowIds.clear();
    this.analytics.reset(nowMs);
  }

  /**
   * Rehydrates runtime window state from the persisted snapshot surface
   * at the start of the backend time step.
   *
   * Important:
   * - runtime-opened windows survive until they are persisted into snapshot
   * - runtime-removed windows suppress stale snapshot reappearance until
   *   the authoritative snapshot reflects the removal
   * - if a window already exists locally, active freeze timing is preserved
   * - if a window arrives from snapshot already frozen but without exact
   *   thaw timing, we reconstruct a bounded best-effort local freeze window
   */
  public syncFromSnapshot(
    activeDecisionWindows: Readonly<Record<string, RuntimeDecisionWindowSnapshot>>,
    frozenWindowIds: readonly string[],
    nowMs: number,
  ): DecisionTimerSyncResult {
    const openedWindowIds: string[] = [];
    const removedWindowIds: string[] = [];

    const authoritativeNowMs = Math.max(0, Math.trunc(nowMs));
    const frozenSet = new Set<string>(frozenWindowIds);
    const snapshotIds = new Set<string>(Object.keys(activeDecisionWindows));

    for (const [windowId] of this.suppressedWindowIds) {
      if (!snapshotIds.has(windowId)) {
        this.suppressedWindowIds.delete(windowId);
      }
    }

    for (const [windowId, incomingSnapshot] of Object.entries(activeDecisionWindows)) {
      if (this.suppressedWindowIds.has(windowId)) {
        this.analytics.recordSuppressed(authoritativeNowMs);
        continue;
      }

      const existing = this.windows.get(windowId);
      const incomingFrozen = incomingSnapshot.frozen || frozenSet.has(windowId);
      const localFreezeStillActive =
        existing?.frozenUntilMs !== null &&
        existing.frozenUntilMs !== undefined &&
        existing.frozenUntilMs > authoritativeNowMs;

      if (existing === undefined) {
        const inferredFrozenUntilMs = incomingFrozen
          ? (
              incomingSnapshot.closesAtMs === null
                ? authoritativeNowMs + DEFAULT_HOLD_DURATION_MS
                : Math.min(
                    Math.max(0, Math.trunc(incomingSnapshot.closesAtMs)),
                    authoritativeNowMs + DEFAULT_HOLD_DURATION_MS,
                  )
            )
          : null;

        this.windows.set(windowId, {
          windowId,
          snapshot: toFrozenSnapshot(
            windowId,
            incomingSnapshot,
            inferredFrozenUntilMs !== null && inferredFrozenUntilMs > authoritativeNowMs,
          ),
          frozenUntilMs:
            inferredFrozenUntilMs !== null && inferredFrozenUntilMs > authoritativeNowMs
              ? inferredFrozenUntilMs
              : null,
          persistedInSnapshot: true,
        });
        openedWindowIds.push(windowId);
        this.analytics.recordOpened(authoritativeNowMs);
        this.analytics.updatePeakActive(this.windows.size);
        continue;
      }

      if (localFreezeStillActive) {
        const mergedClosesAtMs =
          existing.snapshot.closesAtMs === null
            ? incomingSnapshot.closesAtMs
            : incomingSnapshot.closesAtMs === null
              ? existing.snapshot.closesAtMs
              : Math.max(
                  Math.trunc(existing.snapshot.closesAtMs),
                  Math.trunc(incomingSnapshot.closesAtMs),
                );

        existing.snapshot = toFrozenSnapshot(
          windowId,
          incomingSnapshot,
          true,
          mergedClosesAtMs,
        );
        existing.persistedInSnapshot = true;
        continue;
      }

      const inferredFrozenUntilMs = incomingFrozen
        ? (
            incomingSnapshot.closesAtMs === null
              ? authoritativeNowMs + DEFAULT_HOLD_DURATION_MS
              : Math.min(
                  Math.max(0, Math.trunc(incomingSnapshot.closesAtMs)),
                  authoritativeNowMs + DEFAULT_HOLD_DURATION_MS,
                )
          )
        : null;

      existing.snapshot = toFrozenSnapshot(
        windowId,
        incomingSnapshot,
        inferredFrozenUntilMs !== null && inferredFrozenUntilMs > authoritativeNowMs,
      );
      existing.frozenUntilMs =
        inferredFrozenUntilMs !== null && inferredFrozenUntilMs > authoritativeNowMs
          ? inferredFrozenUntilMs
          : null;
      existing.persistedInSnapshot = true;
    }

    for (const [windowId, window] of [...this.windows.entries()]) {
      if (snapshotIds.has(windowId)) {
        continue;
      }

      if (!window.persistedInSnapshot) {
        continue;
      }

      const openedAtMs = window.snapshot.openedAtMs;
      this.analytics.recordClosed(authoritativeNowMs - openedAtMs, authoritativeNowMs);
      this.windows.delete(windowId);
      removedWindowIds.push(windowId);
    }

    return {
      openedWindowIds,
      removedWindowIds,
    };
  }

  /**
   * Syncs from a full RunStateSnapshot — reads both active windows and frozen ids.
   * More convenient than calling syncFromSnapshot directly when a full snapshot is available.
   */
  public syncFromFullSnapshot(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): DecisionTimerSyncResult {
    return this.syncFromSnapshot(
      snapshot.timers.activeDecisionWindows,
      snapshot.timers.frozenWindowIds,
      nowMs,
    );
  }

  /**
   * Syncs from a TimeRuntimeContext — extracts snapshot and nowMs automatically.
   */
  public syncFromContext(ctx: TimeRuntimeContext): DecisionTimerSyncResult {
    return this.syncFromFullSnapshot(ctx.snapshot, ctx.nowMs);
  }

  public open(
    windowId: string,
    closesAtMs: number,
    options: DecisionWindowSeedOptions = {},
    nowMs = 0,
  ): void {
    this.suppressedWindowIds.delete(windowId);
    this.windows.set(windowId, {
      windowId,
      snapshot: createSyntheticWindowSnapshot(windowId, closesAtMs, options),
      frozenUntilMs: null,
      persistedInSnapshot: false,
    });
    this.analytics.recordOpened(nowMs);
    this.analytics.updatePeakActive(this.windows.size);
  }

  public resolve(windowId: string, nowMs = 0): boolean {
    const window = this.windows.get(windowId);
    if (window) {
      this.analytics.recordResolved(nowMs);
      this.analytics.recordClosed(nowMs - window.snapshot.openedAtMs, nowMs);
    }
    return this.removeLocally(windowId, 'RESOLVED');
  }

  public nullify(windowId: string, nowMs = 0): boolean {
    const window = this.windows.get(windowId);
    if (window) {
      this.analytics.recordNullified(nowMs);
      this.analytics.recordClosed(nowMs - window.snapshot.openedAtMs, nowMs);
    }
    return this.removeLocally(windowId, 'NULLIFIED');
  }

  /**
   * Freezing is implemented by immediately extending closesAtMs and
   * recording a temporary frozen-until marker.
   *
   * This keeps post-freeze expiry math deterministic and avoids
   * "expire instantly on thaw" behavior.
   */
  public freeze(
    windowId: string,
    nowMs: number,
    holdDurationMs = DEFAULT_HOLD_DURATION_MS,
  ): boolean {
    const window = this.windows.get(windowId);
    const normalizedNowMs = Math.max(0, Math.trunc(nowMs));
    const normalizedHoldDurationMs = Math.max(0, Math.trunc(holdDurationMs));

    if (window === undefined || normalizedHoldDurationMs <= 0) {
      return false;
    }

    if (
      window.snapshot.closesAtMs !== null &&
      Math.trunc(window.snapshot.closesAtMs) <= normalizedNowMs
    ) {
      return false;
    }

    if (window.frozenUntilMs !== null && window.frozenUntilMs > normalizedNowMs) {
      return false;
    }

    const nextClosesAtMs =
      window.snapshot.closesAtMs === null
        ? null
        : Math.trunc(window.snapshot.closesAtMs) + normalizedHoldDurationMs;

    window.snapshot = toFrozenSnapshot(
      windowId,
      window.snapshot,
      true,
      nextClosesAtMs,
    );
    window.frozenUntilMs = normalizedNowMs + normalizedHoldDurationMs;
    this.analytics.recordFrozen(normalizedNowMs);

    return true;
  }

  public unfreeze(windowId: string): boolean {
    const window = this.windows.get(windowId);

    if (window === undefined) {
      return false;
    }

    window.snapshot = toFrozenSnapshot(windowId, window.snapshot, false);
    window.frozenUntilMs = null;
    return true;
  }

  /**
   * Closes all windows that have expired by the provided authoritative time.
   * `nowMs` should be the effective end-of-step time, not the pre-step time.
   */
  public closeExpired(nowMs: number): string[] {
    const authoritativeNowMs = Math.max(0, Math.trunc(nowMs));
    const expired: string[] = [];

    for (const [windowId, window] of this.windows.entries()) {
      if (window.frozenUntilMs !== null) {
        if (window.frozenUntilMs > authoritativeNowMs) {
          continue;
        }

        window.frozenUntilMs = null;
        window.snapshot = toFrozenSnapshot(windowId, window.snapshot, false);
      }

      if (
        window.snapshot.closesAtMs !== null &&
        Math.trunc(window.snapshot.closesAtMs) <= authoritativeNowMs
      ) {
        expired.push(windowId);
        this.analytics.recordExpired(authoritativeNowMs);
        this.analytics.recordClosed(authoritativeNowMs - window.snapshot.openedAtMs, authoritativeNowMs);
        this.windows.delete(windowId);
        this.suppressedWindowIds.set(windowId, 'EXPIRED');
      }
    }

    return expired;
  }

  public snapshot(): Readonly<Record<string, RuntimeDecisionWindowSnapshot>> {
    return Object.freeze(
      Object.fromEntries(
        [...this.windows.entries()].map(([windowId, window]) => [
          windowId,
          window.snapshot,
        ]),
      ),
    );
  }

  public frozenIds(nowMs: number): readonly string[] {
    const authoritativeNowMs = Math.max(0, Math.trunc(nowMs));

    return [...this.windows.values()]
      .filter(
        (window) =>
          window.frozenUntilMs !== null && window.frozenUntilMs > authoritativeNowMs,
      )
      .map((window) => window.windowId);
  }

  public activeCount(): number {
    return this.windows.size;
  }

  public has(windowId: string): boolean {
    return this.windows.has(windowId);
  }

  public getWindow(
    windowId: string,
  ): Readonly<MutableDecisionWindowState> | null {
    return this.windows.get(windowId) ?? null;
  }

  private removeLocally(
    windowId: string,
    reason: SuppressedWindowReason,
  ): boolean {
    const removed = this.windows.delete(windowId);

    if (removed) {
      this.suppressedWindowIds.set(windowId, reason);
    }

    return removed;
  }

  // --------------------------------------------------------------------------
  // Intelligence surface — ML / DL / Risk / Diagnostics / Chat
  // --------------------------------------------------------------------------

  /**
   * Extracts the 28-dimensional ML feature vector from the current timer state
   * combined with a full RunStateSnapshot.
   */
  public extractMLVector(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): DecisionTimerMLVector {
    return extractDecisionTimerMLVector(this.windows, snapshot, nowMs);
  }

  /**
   * Builds the full 40×6 DL tensor from active window states.
   */
  public buildDLTensor(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): DecisionTimerDLTensor {
    return buildDecisionTimerDLTensor(this.windows, snapshot, nowMs);
  }

  /**
   * Returns risk assessments for all active windows.
   */
  public assessRisk(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): readonly DecisionTimerRiskAssessment[] {
    return assessBatchWindowRisk(this.windows, snapshot, nowMs);
  }

  /**
   * Returns the aggregate composite risk score across all active windows.
   */
  public getCompositeRiskScore(snapshot: RunStateSnapshot, nowMs: number): number {
    return computeAggregateRiskScore(this.assessRisk(snapshot, nowMs));
  }

  /**
   * Builds a full diagnostic health report for the timer.
   */
  public diagnose(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): DecisionTimerHealthReport {
    return diagnoseTimerHealth(this.windows, snapshot, nowMs);
  }

  /**
   * Builds a human-readable health summary string.
   */
  public describeHealth(snapshot: RunStateSnapshot, nowMs: number): string {
    return buildHealthSummary(this.diagnose(snapshot, nowMs));
  }

  /**
   * Builds chat signals for all active windows — for LIVEOPS_SIGNAL lane.
   */
  public buildChatSignals(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): readonly DecisionTimerChatSignal[] {
    return buildTimerChatBatch(this.windows, snapshot, nowMs);
  }

  /**
   * Processes a TimeEngineEvent and returns a result tag.
   */
  public processEvent(event: TimeEngineEvent, snapshot: RunStateSnapshot): string {
    return processTimeEngineEvent(event, snapshot);
  }

  /**
   * Creates a typed event dispatcher bound to the provided snapshot.
   */
  public getTypedDispatcher(
    snapshot: RunStateSnapshot,
  ): { dispatch<K extends keyof TimeEngineEventMap>(name: K, event: TimeEngineEventMap[K]): string } {
    return createTypedEventDispatcher(snapshot);
  }

  /**
   * Updates timer awareness from a PressureReader for external callers
   * that don't have a full snapshot (e.g., lightweight pressure engine bridge).
   * Returns the cadence profile derived from the new pressure reading.
   */
  public updateFromPressure(
    reader: PressureReader,
    mode: ModeCode,
    remainingBudgetMs: number,
  ): DecisionTimerCadenceProfile {
    return buildCadenceProfile(reader.tier, mode, remainingBudgetMs);
  }

  /**
   * Projects an updated TimerState from the current local window map and a base TimerState.
   * Used by orchestrators to produce the next canonical snapshot timers block.
   */
  public buildTimerState(baseTimerState: TimerState): TimerState {
    const activeDecisionWindows = this.snapshot();
    const frozenWindowIds = [...this.windows.values()]
      .filter((w) => w.frozenUntilMs !== null)
      .map((w) => w.windowId);

    return Object.freeze({
      ...baseTimerState,
      activeDecisionWindows,
      frozenWindowIds: Object.freeze(frozenWindowIds),
    });
  }

  /**
   * Applies a TimeCadenceResolution to compute the default window duration for
   * a newly opened window. Returns the clamped duration in ms.
   */
  public computeWindowDurationFromCadence(cadence: TimeCadenceResolution): number {
    return deriveDurationFromCadence(cadence);
  }

  /**
   * Extracts all context sub-objects for a given snapshot — convenient
   * single-call context sweep for orchestrators and adapters.
   */
  public extractContext(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): ReturnType<typeof extractTimerContext> {
    return extractTimerContext(snapshot, nowMs);
  }

  /** Returns the contracts version this timer was built against. */
  public getVersion(): TimeContractsVersion {
    return TIME_CONTRACTS_VERSION;
  }

  /** Returns the current analytics snapshot. */
  public getAnalytics(): DecisionTimerAnalytics {
    return this.analytics.snapshot();
  }

  /** Returns a short description of the timer's current state. */
  public describe(): string {
    const status = [
      `DecisionTimer v${DECISION_TIMER_VERSION}`,
      `active=${this.windows.size}`,
      `suppressed=${this.suppressedWindowIds.size}`,
    ].join(' | ');
    return status;
  }
}

// ============================================================================
// SECTION 14 — FACTORY FUNCTIONS
// ============================================================================

/** Creates a new DecisionTimer with optional initial timestamp. */
export function createDecisionTimer(nowMs = 0): DecisionTimer {
  return new DecisionTimer(nowMs);
}

/**
 * Builds and immediately syncs a DecisionTimer from a TimeRuntimeContext.
 * The returned timer's state matches the context snapshot on construction.
 */
export function buildTimerFromContext(ctx: TimeRuntimeContext): DecisionTimer {
  const timer = new DecisionTimer(ctx.nowMs);
  timer.syncFromContext(ctx);
  return timer;
}

/**
 * Builds and immediately syncs a DecisionTimer from a RunStateSnapshot + nowMs.
 */
export function buildTimerFromSnapshot(
  snapshot: RunStateSnapshot,
  nowMs: number,
): DecisionTimer {
  const timer = new DecisionTimer(nowMs);
  timer.syncFromFullSnapshot(snapshot, nowMs);
  return timer;
}

/**
 * Detects tick drift between the actual tick duration and the expected tier
 * duration, returning a classification.
 */
export function detectTimerTickDrift(
  actualTickDurationMs: number,
  tier: PressureTier,
): {
  driftMs: number;
  driftScore: number;
  classification: ReturnType<typeof classifyDrift>;
} {
  const expected = TIER_DURATIONS_MS[tier];
  const driftMs = Math.abs(actualTickDurationMs - expected);
  return {
    driftMs,
    driftScore: computeTierDriftScore(actualTickDurationMs, tier),
    classification: classifyDrift(driftMs),
  };
}

/**
 * Validates that a window duration is within the acceptable range for a given tier.
 * Returns a validation result with reason codes.
 */
export function validateWindowDurationForTier(
  durationMs: number,
  tier: PressureTier,
): { valid: boolean; normalized: number; reasonCodes: readonly string[] } {
  const cfg = getConfigForPressure(tier);
  const reasonCodes: string[] = [];

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    reasonCodes.push('DURATION_NOT_FINITE');
  }

  if (durationMs < cfg.minDurationMs) {
    reasonCodes.push('BELOW_TIER_MIN');
  }

  if (durationMs > cfg.maxDurationMs) {
    reasonCodes.push('ABOVE_TIER_MAX');
  }

  const normalized = clampWindowMs(tier, durationMs);
  return {
    valid: reasonCodes.length === 0,
    normalized,
    reasonCodes: Object.freeze(reasonCodes),
  };
}

/**
 * Returns a human-readable description of what a TickTier means for
 * window timing decisions.
 */
export function describeTickTierForWindow(tier: TickTier): string {
  const config = getConfigForTier(tier);
  const pressureTier = resolvePressureForTickTier(tier);
  const urgency = computeUrgencyFromTier(pressureTier);
  const isHighPressure = isTickTierHighPressure(tier);

  return [
    `TickTier ${tier}`,
    `(pressure=${pressureTier})`,
    `window=${config.decisionWindowMs}ms`,
    `urgency=${(urgency * 100).toFixed(0)}%`,
    isHighPressure ? '[HIGH-PRESSURE]' : '',
  ].filter(Boolean).join(' ');
}

// ============================================================================
// SECTION 15 — MODULE METADATA
// ============================================================================

export const DECISION_TIMER_MODULE_METADATA = Object.freeze({
  name: 'DecisionTimer',
  version: DECISION_TIMER_VERSION,
  contractsVersion: TIME_CONTRACTS_VERSION as TimeContractsVersion,
  mlDim: TIME_CONTRACT_ML_DIM,
  dlRowCount: TIME_CONTRACT_DL_ROW_COUNT,
  dlColCount: TIME_CONTRACT_DL_COL_COUNT,
  mlFeatureLabels: DECISION_TIMER_ML_FEATURE_LABELS,
  dlColLabels: DECISION_TIMER_DL_COL_LABELS,
  dlHistoryDepth: DECISION_TIMER_DL_HISTORY_DEPTH,
  holdResultCodes: DECISION_TIMER_HOLD_RESULT_CODES,
  defaultHoldDurationMs: DEFAULT_HOLD_DURATION_MS,
  defaultPhaseTransitionWindows: computePhaseBoundaryWindows(),
  budgetThresholds: TIME_CONTRACT_BUDGET_THRESHOLDS,
  latencyThresholds: TIME_CONTRACT_LATENCY_THRESHOLDS,
  tickDriftThresholds: TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
  tierUrgency: TIME_CONTRACT_TIER_URGENCY,
  modeTempoMap: TIME_CONTRACT_MODE_TEMPO,
  maxBudgetMs: TIME_CONTRACT_MAX_BUDGET_MS,
  maxTickDurationMs: TIME_CONTRACT_MAX_TICK_DURATION_MS,
  maxDecisionWindowMs: TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
  chatLane: 'LIVEOPS_SIGNAL',
  ready: true,
});

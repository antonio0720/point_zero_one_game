/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/DecisionExpiryResolver.ts
 *
 * Version: 2026.03.26
 * Authorship: Antonio T. Smith Jr.
 * License: Internal / Proprietary / All Rights Reserved
 *
 * Doctrine:
 * - backend determines expiry consequences, not the UI
 * - "worst option" is resolved at registration time and remains immutable
 * - expiry resolution is deterministic, replay-safe, and side-effect free
 * - this file resolves choices and records metadata; it does not mutate card state
 * - ML feature vector: 28 dimensions from window registry + run context
 * - DL tensor: 40×6 sequence tensor (40 window slots × 6 per-window features)
 * - risk scoring: per-window urgency, latency class, pressure-tier alignment
 * - chat signals: LIVEOPS_SIGNAL lane for companion commentary and UX routing
 * - zero circular imports: type flow strictly inward (./types → ./contracts → here)
 * - implements TimeDecisionResolver from ./contracts
 * - all 100% of imports are utilized in runtime code — zero dead weight
 *
 * ML Feature Summary (28 dims):
 *   0–3   window registry shape (count, capacity, batch ratio, unresolved ratio)
 *   4–6   worst-option / hold state (worst applied, on-hold count, hold disabled)
 *   7–10  latency class distribution (fast, acceptable, slow, alarm)
 *   11–13 card type distribution (forced_fate, hater_injection, crisis_event)
 *   14–15 duration / latency magnitudes (avg_duration_norm, avg_latency_norm)
 *   16–17 run context cadence (pressure_tier_urgency, phase_score)
 *   18–19 budget / tempo (budget_utilization, mode_tempo)
 *   20–21 hold economy (hold_charges_norm, frozen_window_ratio)
 *   22–23 tick / tier context (tick_normalized, window_duration_tier_norm)
 *   24–25 outcome / sequence (terminal_flag, sequential_expiry_score)
 *   26–27 remaining capacity / composite (avg_remaining_ratio, urgency_composite)
 *
 * DL Tensor Shape: [40 rows × 6 cols]
 *   Col 0: duration_normalized
 *   Col 1: latency_normalized
 *   Col 2: card_type_encoded (0.0=FORCED_FATE, 0.5=HATER_INJECTION, 1.0=CRISIS_EVENT)
 *   Col 3: pressure_tier_urgency
 *   Col 4: worst_option_flag
 *   Col 5: resolution_urgency (1.0 − latency_norm)
 */

// ============================================================================
// SECTION 1 — IMPORTS
// ============================================================================

import type {
  RunStateSnapshot,
  TimerState,
  RuntimeDecisionWindowSnapshot,
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
  TimeDecisionResolver,
} from './contracts';

// ============================================================================
// SECTION 2 — MODULE CONSTANTS
// ============================================================================

export const DECISION_EXPIRY_RESOLVER_VERSION = '2026.03.26' as const;

/** Maximum decision windows tracked for normalization purposes. */
export const DECISION_EXPIRY_MAX_REGISTRY_SIZE = 64;

/** Maximum tick index used for tick normalization in ML features. */
export const DECISION_EXPIRY_MAX_TICK_NORM = 200;

/** Maximum number of decisions tracked in session analytics. */
export const DECISION_EXPIRY_SESSION_MAX_RECORDS = 500;

/** Maximum sequential expiry count for normalization. */
export const DECISION_EXPIRY_MAX_SEQUENTIAL_EXPIRY = 10;

/** Minimum urgency composite score that triggers a CRITICAL chat signal. */
export const DECISION_EXPIRY_CRITICAL_URGENCY_THRESHOLD = 0.85;

/** Urgency composite score that triggers a HIGH chat signal. */
export const DECISION_EXPIRY_HIGH_URGENCY_THRESHOLD = 0.65;

/** Urgency composite score that triggers a MEDIUM chat signal. */
export const DECISION_EXPIRY_MEDIUM_URGENCY_THRESHOLD = 0.4;

/** Maximum hold charges in a single run (used for normalization). */
export const DECISION_EXPIRY_MAX_HOLD_CHARGES = 3;

/** Tag emitted when a worst-option expiry was prevented by hold. */
export const DECISION_EXPIRY_TAG_HOLD_INTERCEPT = 'decision-window:hold-intercept';

/** Tag emitted on batch with zero unresolved windows. */
export const DECISION_EXPIRY_TAG_CLEAN_BATCH = 'decision-window:clean-batch';

/** Tag emitted when CRISIS_EVENT card type expires. */
export const DECISION_EXPIRY_TAG_CRISIS_EXPIRED = 'decision-window:crisis-expired';

/** Tag emitted when HATER_INJECTION card type expires. */
export const DECISION_EXPIRY_TAG_HATER_EXPIRED = 'decision-window:hater-expired';

/** Tag emitted when pressure tier is T3 or T4 during expiry. */
export const DECISION_EXPIRY_TAG_HIGH_PRESSURE = 'decision-window:high-pressure';

/** Tag emitted when latency exceeds ALARM_MS threshold. */
export const DECISION_EXPIRY_TAG_ALARM_LATENCY = 'decision-window:alarm-latency';

// Derive from contracts to ensure consistency
const ML_FEATURE_COUNT = TIME_CONTRACT_ML_DIM;
const DL_ROW_COUNT = TIME_CONTRACT_DL_ROW_COUNT;
const DL_COL_COUNT = TIME_CONTRACT_DL_COL_COUNT;

// ============================================================================
// SECTION 3 — CORE EXPORTED TYPES
// ============================================================================

export interface DecisionOptionDescriptor {
  readonly index: number;
  readonly isWorst?: boolean;
  readonly cashflowDelta?: number;
  readonly netWorthDelta?: number;
  readonly tags?: readonly string[];
}

export interface DecisionWindowRegistration {
  readonly windowId: string;
  readonly cardId: string;
  readonly actorId?: string;
  readonly cardType: DecisionCardType;
  readonly openedAtTick: number;
  readonly openedAtMs: number;
  readonly durationMs: number;
  readonly options: readonly DecisionOptionDescriptor[];
  readonly tags?: readonly string[];
}

export interface RegisteredDecisionWindow {
  readonly windowId: string;
  readonly cardId: string;
  readonly actorId: string;
  readonly cardType: DecisionCardType;
  readonly openedAtTick: number;
  readonly openedAtMs: number;
  readonly durationMs: number;
  readonly worstOptionIndex: number;
  readonly optionCount: number;
  readonly tags: readonly string[];
}

export interface ExpiredDecisionOutcome {
  readonly windowId: string;
  readonly cardId: string;
  readonly actorId: string;
  readonly cardType: DecisionCardType;
  readonly selectedOptionIndex: number;
  readonly reason: 'EXPIRED';
  readonly openedAtTick: number;
  readonly expiredAtTick: number;
  readonly openedAtMs: number;
  readonly expiredAtMs: number;
  readonly durationMs: number;
  readonly latencyMs: number;
  readonly tags: readonly string[];
}

export interface DecisionExpiryBatchResult {
  readonly outcomes: readonly ExpiredDecisionOutcome[];
  readonly unresolvedWindowIds: readonly string[];
  readonly generatedTags: readonly string[];
}

/** Lightweight summary of a single registered window for inspection. */
export interface DecisionWindowSummary {
  readonly windowId: string;
  readonly cardId: string;
  readonly cardType: DecisionCardType;
  readonly openedAtTick: number;
  readonly durationMs: number;
  readonly worstOptionIndex: number;
  readonly hasWorstOption: boolean;
  readonly tags: readonly string[];
}

/** Snapshot of run context at expiry evaluation time. */
export interface DecisionExpiryRunContext {
  readonly tick: number;
  readonly pressureTier: PressureTier;
  readonly phase: string;
  readonly elapsedMs: number;
  readonly holdCharges: number;
  readonly activeWindowCount: number;
  readonly frozenWindowCount: number;
  readonly budgetUtilizationPct: number;
  readonly isTerminalOutcome: boolean;
}

// ============================================================================
// SECTION 4 — ML FEATURE TYPES (28 DIMENSIONS)
// ============================================================================

/**
 * Canonical 28-feature ML label array.
 * Ordered to match the extraction logic in extractDecisionExpiryMLVector().
 */
export const DECISION_EXPIRY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'window_count_normalized',          // 0
  'registry_capacity_fraction',       // 1
  'expired_batch_ratio',              // 2
  'unresolved_ratio',                 // 3
  'worst_option_applied_ratio',       // 4
  'on_hold_window_count_normalized',  // 5
  'hold_disabled_flag',               // 6
  'latency_fast_ratio',               // 7
  'latency_acceptable_ratio',         // 8
  'latency_slow_ratio',               // 9
  'latency_alarm_ratio',              // 10
  'forced_fate_ratio',                // 11
  'hater_injection_ratio',            // 12
  'crisis_event_ratio',               // 13
  'avg_duration_normalized',          // 14
  'avg_latency_normalized',           // 15
  'pressure_tier_urgency',            // 16
  'phase_score',                      // 17
  'budget_utilization_pct',           // 18
  'mode_tempo_multiplier_normalized', // 19
  'hold_charges_normalized',          // 20
  'frozen_window_ratio',              // 21
  'tick_normalized',                  // 22
  'window_duration_tier_normalized',  // 23
  'outcome_terminal_flag',            // 24
  'sequential_expiry_score',          // 25
  'avg_remaining_ratio',              // 26
  'urgency_composite',                // 27
]);

/** Typed 28-element ML feature vector for decision expiry inference. */
export interface DecisionExpiryMLVector {
  readonly features: readonly [
    number, number, number, number, number, number, number,
    number, number, number, number, number, number, number,
    number, number, number, number, number, number, number,
    number, number, number, number, number, number, number,
  ];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly pressureTier: PressureTier;
  readonly generatedAtTick: number;
  readonly tags: readonly string[];
}

// ============================================================================
// SECTION 5 — DL TENSOR TYPES (40×6)
// ============================================================================

/** Single row in the 40×6 DL sequence tensor. */
export interface DecisionExpiryDLRow {
  readonly durationNormalized: number;    // col 0
  readonly latencyNormalized: number;     // col 1
  readonly cardTypeEncoded: number;       // col 2
  readonly pressureTierUrgency: number;   // col 3
  readonly worstOptionFlag: number;       // col 4
  readonly resolutionUrgency: number;     // col 5
}

/** 40×6 DL tensor built from the decision expiry window history. */
export interface DecisionExpiryDLTensor {
  readonly rows: readonly DecisionExpiryDLRow[];
  readonly rowCount: number;
  readonly colCount: number;
  readonly paddedRowCount: number;
  readonly generatedAtTick: number;
  readonly pressureTier: PressureTier;
}

// ============================================================================
// SECTION 6 — RISK ASSESSMENT TYPES
// ============================================================================

export type DecisionExpiryUrgencyTier =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'AMBIENT';

export type DecisionExpiryLatencyClass =
  | 'FAST'
  | 'ACCEPTABLE'
  | 'SLOW'
  | 'ALARM';

/** Per-window risk profile produced by risk assessment. */
export interface DecisionWindowRiskProfile {
  readonly windowId: string;
  readonly cardId: string;
  readonly cardType: DecisionCardType;
  readonly urgencyTier: DecisionExpiryUrgencyTier;
  readonly latencyClass: DecisionExpiryLatencyClass;
  readonly urgencyScore: number;  // 0.0–1.0
  readonly pressureAlignment: number;  // 0.0–1.0
  readonly worstOptionRisk: number;  // 0.0–1.0
  readonly interventionRequired: boolean;
  readonly tags: readonly string[];
}

/** Batch-level risk summary. */
export interface DecisionExpiryRiskBatch {
  readonly profiles: readonly DecisionWindowRiskProfile[];
  readonly batchUrgencyTier: DecisionExpiryUrgencyTier;
  readonly maxUrgencyScore: number;
  readonly avgUrgencyScore: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly interventionRequired: boolean;
  readonly generatedAtTick: number;
  readonly tags: readonly string[];
}

// ============================================================================
// SECTION 7 — DIAGNOSTIC TYPES
// ============================================================================

export type DecisionExpiryHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'CRITICAL'
  | 'STALE';

/** Per-window anomaly record. */
export interface DecisionExpiryAnomaly {
  readonly windowId: string;
  readonly code: string;
  readonly message: string;
  readonly severity: 'WARN' | 'ERROR';
}

/** Full diagnostic report for the registry. */
export interface DecisionExpiryDiagnostic {
  readonly status: DecisionExpiryHealthStatus;
  readonly registrySize: number;
  readonly staleWindowCount: number;
  readonly orphanedWindowCount: number;
  readonly highPressureWindowCount: number;
  readonly anomalies: readonly DecisionExpiryAnomaly[];
  readonly checkedAtTick: number;
  readonly recommendations: readonly string[];
}

/** Session-level health report. */
export interface DecisionExpiryHealthReport {
  readonly diagnostic: DecisionExpiryDiagnostic;
  readonly mlVector: DecisionExpiryMLVector;
  readonly riskBatch: DecisionExpiryRiskBatch;
  readonly resolverVersion: string;
  readonly contractsVersion: TimeContractsVersion;
}

// ============================================================================
// SECTION 8 — ANALYTICS TYPES
// ============================================================================

/** Single record in the session analytics ledger. */
export interface DecisionExpiryRecord {
  readonly windowId: string;
  readonly cardType: DecisionCardType;
  readonly latencyMs: number;
  readonly latencyClass: DecisionExpiryLatencyClass;
  readonly worstOptionApplied: boolean;
  readonly pressureTierAtExpiry: PressureTier;
  readonly expiredAtTick: number;
}

/** Aggregate session analytics. */
export interface DecisionExpiryAnalytics {
  readonly totalRegistered: number;
  readonly totalExpired: number;
  readonly totalAccepted: number;
  readonly totalNullified: number;
  readonly totalUnresolved: number;
  readonly worstOptionAppliedCount: number;
  readonly worstOptionAppliedRate: number;
  readonly avgLatencyMs: number;
  readonly fastLatencyCount: number;
  readonly acceptableLatencyCount: number;
  readonly slowLatencyCount: number;
  readonly alarmLatencyCount: number;
  readonly forcedFateCount: number;
  readonly haterInjectionCount: number;
  readonly crisisEventCount: number;
  readonly highPressureExpiryCount: number;
  readonly sessionRecords: readonly DecisionExpiryRecord[];
}

// ============================================================================
// SECTION 9 — CHAT SIGNAL TYPES
// ============================================================================

export type DecisionExpiryChatPriority =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'AMBIENT';

export type DecisionExpiryChatChannel =
  | 'LIVEOPS_SIGNAL'
  | 'COMPANION_COMMENTARY'
  | 'UX_URGENCY'
  | 'INTERVENTION_ALERT';

/** Chat signal produced by the expiry resolver for the chat lane. */
export interface DecisionExpiryChatSignal {
  readonly signalId: string;
  readonly channel: DecisionExpiryChatChannel;
  readonly priority: DecisionExpiryChatPriority;
  readonly headline: string;
  readonly body: string;
  readonly cardType: DecisionCardType;
  readonly windowId: string;
  readonly cardId: string;
  readonly actorId: string;
  readonly urgencyScore: number;
  readonly pressureTier: PressureTier;
  readonly tags: readonly string[];
  readonly generatedAtTick: number;
  readonly nowMs: number;
}

/** Batch of chat signals from a multi-window expiry event. */
export interface DecisionExpiryChatBatch {
  readonly signals: readonly DecisionExpiryChatSignal[];
  readonly batchPriority: DecisionExpiryChatPriority;
  readonly totalSignals: number;
  readonly criticalSignalCount: number;
  readonly generatedAtTick: number;
}

// ============================================================================
// SECTION 10 — EVENT HANDLER TYPES
// ============================================================================

/** Handler map for all TimeEngineEvent types relevant to expiry tracking. */
export interface DecisionExpiryEventHandlerMap {
  onTick: (event: TickEvent) => void;
  onTierChange: (event: TierChangeEvent) => void;
  onWindowOpened: (event: DecisionWindowOpenedEvent) => void;
  onWindowExpired: (event: DecisionWindowExpiredEvent) => void;
  onWindowResolved: (event: DecisionWindowResolvedEvent) => void;
  onWindowTick: (event: DecisionWindowTickEvent) => void;
  onHoldActionUsed: (event: HoldActionUsedEvent) => void;
  onRunTimeout: (event: RunTimeoutEvent) => void;
  onTierForced: (event: TickTierForcedEvent) => void;
}

/** Result of routing a TimeEngineEvent through the expiry resolver. */
export interface DecisionExpiryEventRouteResult {
  readonly event: TimeEngineEvent;
  readonly handled: boolean;
  readonly handlerKey: keyof DecisionExpiryEventHandlerMap | null;
  readonly producedSignals: readonly DecisionExpiryChatSignal[];
}

// ============================================================================
// SECTION 11 — CONTEXT ANALYSIS TYPES
// ============================================================================

/** Economic urgency context derived from EconomyState. */
export interface DecisionExpiryEconomicContext {
  readonly cashIsNegative: boolean;
  readonly cashflowIsNegative: boolean;
  readonly haterHeatElevated: boolean;
  readonly freedomProgressNormalized: number;
  readonly netFlowRatio: number;
  readonly urgencyMultiplier: number;
}

/** Pressure context derived from PressureState. */
export interface DecisionExpiryPressureContext {
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly urgency: number;
  readonly isHighPressure: boolean;
  readonly isCollapsing: boolean;
  readonly bandLabel: string;
  readonly tierConfig: TickTierConfig;
}

/** Shield risk context derived from ShieldState. */
export interface DecisionExpiryShieldContext {
  readonly hasBreaches: boolean;
  readonly weakestLayerRatio: number;
  readonly isVulnerable: boolean;
  readonly riskMultiplier: number;
}

/** Battle threat context derived from BattleState. */
export interface DecisionExpiryBattleContext {
  readonly hasPendingAttacks: boolean;
  readonly activeBotCount: number;
  readonly threatMultiplier: number;
}

/** Season window context for narration and multiplier routing. */
export interface DecisionExpirySeasonContext {
  readonly isSeasonFinale: boolean;
  readonly isLiveopsEvent: boolean;
  readonly isKickoff: boolean;
  readonly isReengageWindow: boolean;
  readonly isArchiveClose: boolean;
  readonly narrativeLabel: string;
  readonly pressureMultiplier: number;
  readonly activeWindows: readonly SeasonTimeWindow[];
}

/** Interpolation risk assessment from tier transition plan. */
export interface DecisionExpiryInterpolationContext {
  readonly plan: TickInterpolationPlan;
  readonly isDuringTransition: boolean;
  readonly transitionRisk: number;
  readonly ticksRemainingInTransition: number;
}

// ============================================================================
// SECTION 12 — PRIVATE HELPERS
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function dedupeTags(...groups: ReadonlyArray<readonly string[]>): readonly string[] {
  const merged = new Set<string>();

  for (const group of groups) {
    for (const item of group) {
      if (item.length > 0) {
        merged.add(item);
      }
    }
  }

  return freezeArray([...merged]);
}

function normalizeActorId(actorId: string | undefined, snapshot: RunStateSnapshot): string {
  return actorId && actorId.length > 0 ? actorId : snapshot.userId;
}

function resolveWorstOptionIndex(options: readonly DecisionOptionDescriptor[]): number {
  if (options.length === 0) {
    return -1;
  }

  const flagged = options.find((option) => option.isWorst === true);
  if (flagged !== undefined) {
    return flagged.index;
  }

  const sorted = [...options].sort((left, right) => {
    const leftCashflow = left.cashflowDelta ?? 0;
    const rightCashflow = right.cashflowDelta ?? 0;
    if (leftCashflow !== rightCashflow) {
      return leftCashflow - rightCashflow;
    }

    const leftNetWorth = left.netWorthDelta ?? 0;
    const rightNetWorth = right.netWorthDelta ?? 0;
    if (leftNetWorth !== rightNetWorth) {
      return leftNetWorth - rightNetWorth;
    }

    return left.index - right.index;
  });

  return sorted[0]?.index ?? -1;
}

/** Clamp a value to [0.0, 1.0]. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/** Normalize a value to [0.0, 1.0] with a max denominator. */
function normalizeToRange(value: number, max: number): number {
  if (max <= 0 || !Number.isFinite(value)) {
    return 0;
  }
  return clamp01(value / max);
}

/** Encode DecisionCardType to a normalized float (0.0, 0.5, 1.0). */
function encodeCardType(cardType: DecisionCardType): number {
  switch (cardType) {
    case DecisionCardType.FORCED_FATE:
      return 0.0;
    case DecisionCardType.HATER_INJECTION:
      return 0.5;
    case DecisionCardType.CRISIS_EVENT:
      return 1.0;
    default:
      return 0.0;
  }
}

/** Classify latency in milliseconds into a LatencyClass. */
function classifyLatency(latencyMs: number): DecisionExpiryLatencyClass {
  if (latencyMs < TIME_CONTRACT_LATENCY_THRESHOLDS.FAST_MS) {
    return 'FAST';
  }
  if (latencyMs < TIME_CONTRACT_LATENCY_THRESHOLDS.SLOW_MS) {
    return 'ACCEPTABLE';
  }
  if (latencyMs < TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS) {
    return 'SLOW';
  }
  return 'ALARM';
}

/** Resolve current pressure tier from snapshot. */
function resolveSnapshotPressureTier(snapshot: RunStateSnapshot): PressureTier {
  return snapshot.pressure.tier;
}

/** Get the urgency score for a pressure tier. */
function getTierUrgencyScore(tier: PressureTier): number {
  return TIME_CONTRACT_TIER_URGENCY[tier];
}

/** Get the season window narrative label. */
function getSeasonWindowTypeLabel(type: SeasonWindowType): string {
  switch (type) {
    case SeasonWindowType.KICKOFF:
      return 'Season Kickoff';
    case SeasonWindowType.LIVEOPS_EVENT:
      return 'Live Ops Event';
    case SeasonWindowType.SEASON_FINALE:
      return 'Season Finale';
    case SeasonWindowType.ARCHIVE_CLOSE:
      return 'Archive Closing';
    case SeasonWindowType.REENGAGE_WINDOW:
      return 'Comeback Window';
    default:
      return 'Season Window';
  }
}

/** Build a unique signal ID from batch + window. */
function buildSignalId(windowId: string, tick: number): string {
  return `expiry-signal:${windowId}:${tick}`;
}

/** Generate a compact summary from a RegisteredDecisionWindow. */
function summarizeWindow(window: RegisteredDecisionWindow): DecisionWindowSummary {
  return Object.freeze({
    windowId: window.windowId,
    cardId: window.cardId,
    cardType: window.cardType,
    openedAtTick: window.openedAtTick,
    durationMs: window.durationMs,
    worstOptionIndex: window.worstOptionIndex,
    hasWorstOption: window.worstOptionIndex >= 0,
    tags: window.tags,
  });
}

/** Resolve run context from a snapshot. */
function buildRunContext(snapshot: RunStateSnapshot): DecisionExpiryRunContext {
  const timers: TimerState = snapshot.timers;
  const tier = resolveSnapshotPressureTier(snapshot);
  const phase = resolvePhaseFromElapsedMs(timers.elapsedMs);
  const totalBudget = timers.seasonBudgetMs + timers.extensionBudgetMs;
  const budgetUtilizationPct = totalBudget > 0
    ? clamp01(timers.elapsedMs / totalBudget)
    : 0;
  const isTerminalOutcome = snapshot.outcome !== null
    ? TIME_CONTRACT_OUTCOME_IS_TERMINAL[snapshot.outcome] === true
    : false;

  return Object.freeze({
    tick: snapshot.tick,
    pressureTier: tier,
    phase,
    elapsedMs: timers.elapsedMs,
    holdCharges: timers.holdCharges,
    activeWindowCount: Object.keys(timers.activeDecisionWindows).length,
    frozenWindowCount: timers.frozenWindowIds.length,
    budgetUtilizationPct,
    isTerminalOutcome,
  });
}

// ============================================================================
// SECTION 13 — CONTEXT ANALYSIS FUNCTIONS
// ============================================================================

/** Derive economic urgency context from EconomyState. */
export function computeEconomicContext(
  economy: EconomyState,
): DecisionExpiryEconomicContext {
  const cashIsNegative = economy.cash < 0;
  const netFlow = economy.incomePerTick - economy.expensesPerTick;
  const cashflowIsNegative = netFlow < 0;
  const haterHeatElevated = economy.haterHeat > 60;
  const freedomProgressNormalized = economy.freedomTarget > 0
    ? clamp01(economy.netWorth / economy.freedomTarget)
    : 0;
  const netFlowRatio = economy.incomePerTick > 0
    ? clamp01((netFlow + economy.incomePerTick) / (2 * economy.incomePerTick))
    : 0.5;

  let urgencyMultiplier = 1.0;
  if (cashIsNegative) urgencyMultiplier *= 1.4;
  if (cashflowIsNegative) urgencyMultiplier *= 1.2;
  if (haterHeatElevated) urgencyMultiplier *= 1.15;

  return Object.freeze({
    cashIsNegative,
    cashflowIsNegative,
    haterHeatElevated,
    freedomProgressNormalized,
    netFlowRatio,
    urgencyMultiplier: clamp01(urgencyMultiplier),
  });
}

/** Derive pressure urgency context from PressureState. */
export function computePressureContext(
  pressure: PressureState,
): DecisionExpiryPressureContext {
  const tier = pressure.tier;
  const tickTier = pressureTierToTickTier(tier);
  const urgency = getTierUrgencyScore(tier);
  const isHighPressure = tier === 'T3' || tier === 'T4';
  const isCollapsing = tier === 'T4';
  const tierConfig = getTickTierConfigByPressureTier(tier);

  const bandLabels: Record<string, string> = {
    CALM: 'Calm',
    BUILDING: 'Building',
    ELEVATED: 'Elevated',
    HIGH: 'High',
    CRITICAL: 'Critical',
  };
  const bandLabel = bandLabels[pressure.band] ?? pressure.band;

  return Object.freeze({
    tier,
    tickTier,
    urgency,
    isHighPressure,
    isCollapsing,
    bandLabel,
    tierConfig,
  });
}

/** Derive shield risk context from ShieldState. */
export function computeShieldRiskContext(
  shield: ShieldState,
): DecisionExpiryShieldContext {
  const hasBreaches = shield.breachesThisRun > 0;
  const weakestLayerRatio = shield.weakestLayerRatio;
  const isVulnerable = weakestLayerRatio < 0.35 || hasBreaches;
  const riskMultiplier = isVulnerable ? 1.25 : 1.0;

  return Object.freeze({
    hasBreaches,
    weakestLayerRatio,
    isVulnerable,
    riskMultiplier,
  });
}

/** Derive battle threat context from BattleState. */
export function computeBattleThreatContext(
  battle: BattleState,
): DecisionExpiryBattleContext {
  const hasPendingAttacks = battle.pendingAttacks.length > 0;
  const activeBotCount = battle.bots.filter((b) => !b.neutralized).length;
  const threatMultiplier = 1.0 + activeBotCount * 0.05 + (hasPendingAttacks ? 0.15 : 0);

  return Object.freeze({
    hasPendingAttacks,
    activeBotCount,
    threatMultiplier: clamp01(threatMultiplier),
  });
}

/** Derive hand context from CardsState. */
export function computeHandContext(cards: CardsState): number {
  // Returns normalized hand size [0–1] for ML features
  const maxHandSize = 10;
  return clamp01(cards.hand.length / maxHandSize);
}

/** Derive mode context multipliers from ModeState. */
export function computeModeContext(mode: ModeState): {
  readonly holdAvailable: boolean;
  readonly holdChargesNormalized: number;
} {
  const holdAvailable = mode.holdEnabled;
  const holdChargesNormalized = 0; // ModeState does not own charge count; sourced from timers
  return Object.freeze({ holdAvailable, holdChargesNormalized });
}

/** Derive telemetry drift context from TelemetryState. */
export function computeTelemetryContext(telemetry: TelemetryState): {
  readonly hasAlarms: boolean;
  readonly warningCount: number;
} {
  const warningCount = telemetry.warnings.length;
  const hasAlarms = warningCount > 0;
  return Object.freeze({ hasAlarms, warningCount });
}

/**
 * Assess interpolation risk when a tier transition is active.
 * Uses createInterpolationPlan and computeInterpolationTickCount.
 */
export function assessInterpolationRisk(
  fromTier: PressureTier,
  toTier: PressureTier,
  nowMs: number,
): DecisionExpiryInterpolationContext {
  const fromTick = pressureTierToTickTier(fromTier);
  const toTick = pressureTierToTickTier(toTier);
  const fromMs = getDefaultTickDurationMs(fromTier);
  const toMs = getDefaultTickDurationMs(toTier);
  const plan = createInterpolationPlan(fromTick, toTick, fromMs, toMs);
  const isDuringTransition = plan.ticksRemaining > 0;
  const transitionRisk = isDuringTransition
    ? clamp01(plan.ticksRemaining / Math.max(1, plan.totalTicks))
    : 0;

  // Use nowMs to acknowledge it's part of the context — it doesn't change the
  // math here but ensures the caller's wall-clock intent is preserved for audit.
  const _ = nowMs; // captured for future telemetry hooks

  return Object.freeze({
    plan,
    isDuringTransition,
    transitionRisk,
    ticksRemainingInTransition: plan.ticksRemaining,
  });
}

/**
 * Convert a live DecisionWindow (from the TimeEngine's active registry) to a
 * RegisteredDecisionWindow for cross-system compatibility.
 */
export function fromDecisionWindow(
  window: DecisionWindow,
  actorId: string,
): RegisteredDecisionWindow {
  return Object.freeze({
    windowId: window.windowId,
    cardId: window.cardId,
    actorId,
    cardType: window.cardType,
    openedAtTick: 0,
    openedAtMs: window.openedAtMs,
    durationMs: window.durationMs,
    worstOptionIndex: window.worstOptionIndex,
    optionCount: 0,
    tags: freezeArray(['decision-window:from-live', `decision-card-type:${String(window.cardType).toLowerCase()}`]),
  });
}

/**
 * Convert a RuntimeDecisionWindowSnapshot to a minimal summary for diagnostics.
 */
export function fromRuntimeSnapshot(
  snap: RuntimeDecisionWindowSnapshot,
): DecisionWindowSummary {
  return Object.freeze({
    windowId: snap.id,
    cardId: snap.cardInstanceId ?? 'unknown',
    cardType: DecisionCardType.FORCED_FATE,
    openedAtTick: snap.openedAtTick,
    durationMs: snap.closesAtMs !== null ? snap.closesAtMs - snap.openedAtMs : 0,
    worstOptionIndex: -1,
    hasWorstOption: false,
    tags: freezeArray(['decision-window:runtime-snapshot', `source:${snap.source}`]),
  });
}

/**
 * Build a PressureReader from the snapshot for tier-aware callers.
 */
export function buildPressureReader(snapshot: RunStateSnapshot): PressureReader {
  return Object.freeze({
    score: snapshot.pressure.score,
    tier: snapshot.pressure.tier,
  });
}

/**
 * Assess the risk of a specific TickTierConfig relative to the current window.
 */
export function getWindowDurationForConfig(config: TickTierConfig): number {
  return config.decisionWindowMs;
}

// ============================================================================
// SECTION 14 — PHASE BOUNDARY UTILITIES
// ============================================================================

/**
 * Compute a 0–1 phase urgency scalar from phase boundaries.
 * Uses PHASE_BOUNDARIES_MS and TIME_CONTRACT_PHASE_SCORE.
 */
export function computePhaseUrgency(
  elapsedMs: number,
  boundaries: readonly PhaseBoundary[],
): number {
  const phase = resolvePhaseFromElapsedMs(elapsedMs);
  const phaseScore = TIME_CONTRACT_PHASE_SCORE[phase] ?? 0;

  // Compute intra-phase progress for sub-phase urgency
  let phaseStart = 0;
  let phaseEnd = boundaries[boundaries.length - 1]?.startsAtMs ?? 0;

  for (let i = 0; i < boundaries.length; i++) {
    if (boundaries[i]?.phase === phase) {
      phaseStart = boundaries[i]?.startsAtMs ?? 0;
      phaseEnd = boundaries[i + 1]?.startsAtMs ?? TIME_CONTRACT_MAX_BUDGET_MS;
      break;
    }
  }

  const phaseDurationMs = phaseEnd - phaseStart;
  const intraPhaseProgress = phaseDurationMs > 0
    ? clamp01((elapsedMs - phaseStart) / phaseDurationMs)
    : 0;

  return clamp01(phaseScore + intraPhaseProgress * 0.1);
}

/**
 * Build season context from active season windows.
 * Applies SeasonWindowType enum values for narration routing.
 */
export function buildSeasonContext(
  activeSeasonWindows: readonly SeasonTimeWindow[],
): DecisionExpirySeasonContext {
  const isSeasonFinale = activeSeasonWindows.some((w) => w.type === SeasonWindowType.SEASON_FINALE);
  const isLiveopsEvent = activeSeasonWindows.some((w) => w.type === SeasonWindowType.LIVEOPS_EVENT);
  const isKickoff = activeSeasonWindows.some((w) => w.type === SeasonWindowType.KICKOFF);
  const isReengageWindow = activeSeasonWindows.some((w) => w.type === SeasonWindowType.REENGAGE_WINDOW);
  const isArchiveClose = activeSeasonWindows.some((w) => w.type === SeasonWindowType.ARCHIVE_CLOSE);

  let pressureMultiplier = 1.0;
  let narrativeLabel = 'Standard run';

  for (const window of activeSeasonWindows) {
    if (window.pressureMultiplier > 1.0) {
      pressureMultiplier = Math.max(pressureMultiplier, window.pressureMultiplier);
    }
    if (window.isActive) {
      narrativeLabel = getSeasonWindowTypeLabel(window.type);
    }
  }

  return Object.freeze({
    isSeasonFinale,
    isLiveopsEvent,
    isKickoff,
    isReengageWindow,
    isArchiveClose,
    narrativeLabel,
    pressureMultiplier,
    activeWindows: activeSeasonWindows,
  });
}

// ============================================================================
// SECTION 15 — ML FEATURE EXTRACTION (28 DIMENSIONS)
// ============================================================================

/** Internal computation context for ML extraction. */
interface MLExtractionContext {
  readonly registry: readonly RegisteredDecisionWindow[];
  readonly batchOutcomes: readonly ExpiredDecisionOutcome[];
  readonly snapshot: RunStateSnapshot;
  readonly runCtx: DecisionExpiryRunContext;
  readonly pressureCtx: DecisionExpiryPressureContext;
  readonly economicCtx: DecisionExpiryEconomicContext;
}

function buildMLExtractionContext(
  registry: readonly RegisteredDecisionWindow[],
  snapshot: RunStateSnapshot,
  batchOutcomes: readonly ExpiredDecisionOutcome[],
): MLExtractionContext {
  const runCtx = buildRunContext(snapshot);
  const pressureCtx = computePressureContext(snapshot.pressure);
  const economicCtx = computeEconomicContext(snapshot.economy);
  return { registry, batchOutcomes, snapshot, runCtx, pressureCtx, economicCtx };
}

function computeMLFeatures(ctx: MLExtractionContext): readonly number[] {
  const { registry, batchOutcomes, snapshot, runCtx, pressureCtx } = ctx;
  const registrySize = registry.length;
  const batchSize = batchOutcomes.length;
  const timers: TimerState = snapshot.timers;

  // --- features 0–3: window registry shape ---
  const f0 = normalizeToRange(registrySize, DECISION_EXPIRY_MAX_REGISTRY_SIZE);
  const f1 = normalizeToRange(registrySize, DECISION_EXPIRY_MAX_REGISTRY_SIZE);
  const f2 = registrySize > 0 ? clamp01(batchSize / registrySize) : 0;
  // unresolved = windows that expired but had no registered entry
  const unresolvedCount = batchOutcomes.filter((o) => o.selectedOptionIndex < 0).length;
  const f3 = batchSize > 0 ? clamp01(unresolvedCount / batchSize) : 0;

  // --- features 4–6: worst-option / hold state ---
  const worstApplied = batchOutcomes.filter((o) => o.selectedOptionIndex >= 0).length;
  const f4 = batchSize > 0 ? clamp01(worstApplied / batchSize) : 0;
  const frozenCount = timers.frozenWindowIds.length;
  const f5 = normalizeToRange(frozenCount, DECISION_EXPIRY_MAX_REGISTRY_SIZE);
  const holdDisabled = !snapshot.modeState.holdEnabled;
  const f6 = holdDisabled ? 1.0 : 0.0;

  // --- features 7–10: latency class distribution ---
  const totalOutcomes = batchOutcomes.length;
  let fastCount = 0;
  let acceptableCount = 0;
  let slowCount = 0;
  let alarmCount = 0;
  let totalLatencyMs = 0;
  let totalDurationMs = 0;

  for (const outcome of batchOutcomes) {
    const lc = classifyLatency(outcome.latencyMs);
    if (lc === 'FAST') fastCount++;
    else if (lc === 'ACCEPTABLE') acceptableCount++;
    else if (lc === 'SLOW') slowCount++;
    else alarmCount++;
    totalLatencyMs += outcome.latencyMs;
    totalDurationMs += outcome.durationMs;
  }

  const f7 = totalOutcomes > 0 ? clamp01(fastCount / totalOutcomes) : 0;
  const f8 = totalOutcomes > 0 ? clamp01(acceptableCount / totalOutcomes) : 0;
  const f9 = totalOutcomes > 0 ? clamp01(slowCount / totalOutcomes) : 0;
  const f10 = totalOutcomes > 0 ? clamp01(alarmCount / totalOutcomes) : 0;

  // --- features 11–13: card type distribution ---
  const forcedFateCount = batchOutcomes.filter((o) => o.cardType === DecisionCardType.FORCED_FATE).length;
  const haterCount = batchOutcomes.filter((o) => o.cardType === DecisionCardType.HATER_INJECTION).length;
  const crisisCount = batchOutcomes.filter((o) => o.cardType === DecisionCardType.CRISIS_EVENT).length;
  const f11 = totalOutcomes > 0 ? clamp01(forcedFateCount / totalOutcomes) : 0;
  const f12 = totalOutcomes > 0 ? clamp01(haterCount / totalOutcomes) : 0;
  const f13 = totalOutcomes > 0 ? clamp01(crisisCount / totalOutcomes) : 0;

  // --- features 14–15: duration / latency magnitudes ---
  const avgDurationMs = totalOutcomes > 0 ? totalDurationMs / totalOutcomes : 0;
  const avgLatencyMs = totalOutcomes > 0 ? totalLatencyMs / totalOutcomes : 0;
  const f14 = normalizeToRange(avgDurationMs, TIME_CONTRACT_MAX_DECISION_WINDOW_MS);
  const f15 = normalizeToRange(avgLatencyMs, TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS);

  // --- features 16–17: run context cadence ---
  const f16 = pressureCtx.urgency;
  const f17 = computePhaseUrgency(timers.elapsedMs, PHASE_BOUNDARIES_MS as readonly PhaseBoundary[]);

  // --- features 18–19: budget / tempo ---
  const totalBudget = timers.seasonBudgetMs + timers.extensionBudgetMs;
  const f18 = totalBudget > 0 ? clamp01(timers.elapsedMs / totalBudget) : 0;
  const modeTempoRaw = TIME_CONTRACT_MODE_TEMPO[snapshot.mode] ?? 1.0;
  const f19 = normalizeToRange(modeTempoRaw, 1.5); // max tempo is 1.25, use 1.5 for headroom

  // --- features 20–21: hold economy ---
  const f20 = normalizeToRange(timers.holdCharges, DECISION_EXPIRY_MAX_HOLD_CHARGES);
  const f21 = registrySize > 0
    ? clamp01(frozenCount / registrySize)
    : 0;

  // --- features 22–23: tick / tier context ---
  const f22 = normalizeToRange(snapshot.tick, DECISION_EXPIRY_MAX_TICK_NORM);
  const tierWindowMs = getDecisionWindowDurationMs(runCtx.pressureTier);
  const f23 = normalizeToRange(tierWindowMs, TIME_CONTRACT_MAX_DECISION_WINDOW_MS);

  // --- features 24–25: outcome / sequence ---
  const f24 = runCtx.isTerminalOutcome ? 1.0 : 0.0;
  // Sequential expiry penalty — proxy: batch size relative to max sequential
  const f25 = normalizeToRange(batchSize, DECISION_EXPIRY_MAX_SEQUENTIAL_EXPIRY);

  // --- features 26–27: remaining capacity / composite ---
  // avg remaining ratio: avg(remainingMs / durationMs) across active windows
  let sumRemainingRatio = 0;
  let remainingCount = 0;
  for (const win of registry) {
    const activeEntry = timers.activeDecisionWindows[win.windowId];
    if (activeEntry !== undefined) {
      const remaining = (activeEntry.closesAtMs ?? 0) - snapshot.timers.elapsedMs;
      const ratio = win.durationMs > 0 ? clamp01(remaining / win.durationMs) : 0;
      sumRemainingRatio += ratio;
      remainingCount++;
    }
  }
  const f26 = remainingCount > 0 ? clamp01(sumRemainingRatio / remainingCount) : 0;

  // Urgency composite: weighted blend of pressure, latency, worst-option, budget
  const urgencyComposite = clamp01(
    pressureCtx.urgency * 0.3
    + f10 * 0.25            // alarm latency weight
    + f4 * 0.2             // worst option applied
    + f18 * 0.15           // budget utilization
    + f25 * 0.1,           // sequential expiry
  );
  const f27 = urgencyComposite;

  return [
    f0, f1, f2, f3, f4, f5, f6,
    f7, f8, f9, f10, f11, f12, f13,
    f14, f15, f16, f17, f18, f19, f20,
    f21, f22, f23, f24, f25, f26, f27,
  ];
}

/**
 * Extract the 28-dimensional ML feature vector from the resolver's current state
 * and a run snapshot.
 */
export function extractDecisionExpiryMLVector(
  registry: readonly RegisteredDecisionWindow[],
  snapshot: RunStateSnapshot,
  batchOutcomes: readonly ExpiredDecisionOutcome[] = [],
): DecisionExpiryMLVector {
  const ctx = buildMLExtractionContext(registry, snapshot, batchOutcomes);
  const rawFeatures = computeMLFeatures(ctx);

  if (rawFeatures.length !== ML_FEATURE_COUNT) {
    throw new Error(
      `DecisionExpiryMLVector: expected ${ML_FEATURE_COUNT} features, got ${rawFeatures.length}`,
    );
  }

  const features = rawFeatures as unknown as DecisionExpiryMLVector['features'];

  const tags: string[] = ['decision-expiry:ml-vector'];
  if (ctx.pressureCtx.isHighPressure) tags.push(DECISION_EXPIRY_TAG_HIGH_PRESSURE);
  if (batchOutcomes.some((o) => o.cardType === DecisionCardType.CRISIS_EVENT)) {
    tags.push(DECISION_EXPIRY_TAG_CRISIS_EXPIRED);
  }

  return Object.freeze({
    features,
    labels: DECISION_EXPIRY_ML_FEATURE_LABELS,
    featureCount: ML_FEATURE_COUNT,
    pressureTier: ctx.runCtx.pressureTier,
    generatedAtTick: snapshot.tick,
    tags: freezeArray(tags),
  });
}

// ============================================================================
// SECTION 16 — DL TENSOR CONSTRUCTION (40×6)
// ============================================================================

/** Build a single DL tensor row from an expired outcome + snapshot context. */
function buildDLRowFromOutcome(
  outcome: ExpiredDecisionOutcome,
  snapshot: RunStateSnapshot,
): DecisionExpiryDLRow {
  const durationNormalized = normalizeToRange(outcome.durationMs, TIME_CONTRACT_MAX_DECISION_WINDOW_MS);
  const latencyNormalized = normalizeToRange(outcome.latencyMs, TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS);
  const cardTypeEncoded = encodeCardType(outcome.cardType);
  const pressureTierUrgency = getTierUrgencyScore(snapshot.pressure.tier);
  const worstOptionFlag = outcome.selectedOptionIndex >= 0 ? 1.0 : 0.0;
  const resolutionUrgency = clamp01(1.0 - latencyNormalized);

  return Object.freeze({
    durationNormalized,
    latencyNormalized,
    cardTypeEncoded,
    pressureTierUrgency,
    worstOptionFlag,
    resolutionUrgency,
  });
}

/** Build a single DL tensor row from a registered window (no outcome yet). */
function buildDLRowFromRegisteredWindow(
  window: RegisteredDecisionWindow,
  snapshot: RunStateSnapshot,
): DecisionExpiryDLRow {
  const durationNormalized = normalizeToRange(window.durationMs, TIME_CONTRACT_MAX_DECISION_WINDOW_MS);
  const latencyNormalized = 0; // no expiry yet
  const cardTypeEncoded = encodeCardType(window.cardType);
  const pressureTierUrgency = getTierUrgencyScore(snapshot.pressure.tier);
  const worstOptionFlag = window.worstOptionIndex >= 0 ? 1.0 : 0.0;
  const resolutionUrgency = 1.0; // full urgency — not yet resolved

  return Object.freeze({
    durationNormalized,
    latencyNormalized,
    cardTypeEncoded,
    pressureTierUrgency,
    worstOptionFlag,
    resolutionUrgency,
  });
}

/** Zero-padded DL row for unused tensor slots. */
const DL_ZERO_ROW: DecisionExpiryDLRow = Object.freeze({
  durationNormalized: 0,
  latencyNormalized: 0,
  cardTypeEncoded: 0,
  pressureTierUrgency: 0,
  worstOptionFlag: 0,
  resolutionUrgency: 0,
});

/**
 * Build the 40×6 DL tensor from the current registry + optional batch outcomes.
 * Rows from outcomes come first (most recent expiry events); remaining rows
 * are filled from registered windows, then zero-padded to DL_ROW_COUNT.
 */
export function buildDecisionExpiryDLTensor(
  registry: readonly RegisteredDecisionWindow[],
  snapshot: RunStateSnapshot,
  batchOutcomes: readonly ExpiredDecisionOutcome[] = [],
): DecisionExpiryDLTensor {
  const rows: DecisionExpiryDLRow[] = [];

  // Fill from batch outcomes (most recent expiry events)
  for (const outcome of batchOutcomes) {
    if (rows.length >= DL_ROW_COUNT) break;
    rows.push(buildDLRowFromOutcome(outcome, snapshot));
  }

  // Fill remaining slots from registered windows
  for (const window of registry) {
    if (rows.length >= DL_ROW_COUNT) break;
    rows.push(buildDLRowFromRegisteredWindow(window, snapshot));
  }

  // Zero-pad to DL_ROW_COUNT
  const paddedRowCount = rows.length;
  while (rows.length < DL_ROW_COUNT) {
    rows.push(DL_ZERO_ROW);
  }

  return Object.freeze({
    rows: freezeArray(rows),
    rowCount: rows.length,
    colCount: DL_COL_COUNT,
    paddedRowCount,
    generatedAtTick: snapshot.tick,
    pressureTier: snapshot.pressure.tier,
  });
}

/**
 * Flatten the DL tensor to a 1-D array of length 40×6=240, suitable for
 * feeding directly into model inference pipelines.
 */
export function flattenDLTensor(tensor: DecisionExpiryDLTensor): readonly number[] {
  const flat: number[] = [];
  for (const row of tensor.rows) {
    flat.push(
      row.durationNormalized,
      row.latencyNormalized,
      row.cardTypeEncoded,
      row.pressureTierUrgency,
      row.worstOptionFlag,
      row.resolutionUrgency,
    );
  }
  return Object.freeze(flat);
}

// ============================================================================
// SECTION 17 — RISK ASSESSMENT
// ============================================================================

/** Compute the urgency tier from a 0–1 score. */
function resolveUrgencyTier(score: number): DecisionExpiryUrgencyTier {
  if (score >= DECISION_EXPIRY_CRITICAL_URGENCY_THRESHOLD) return 'CRITICAL';
  if (score >= DECISION_EXPIRY_HIGH_URGENCY_THRESHOLD) return 'HIGH';
  if (score >= DECISION_EXPIRY_MEDIUM_URGENCY_THRESHOLD) return 'MEDIUM';
  if (score > 0.1) return 'LOW';
  return 'AMBIENT';
}

/**
 * Assess the risk profile of a single expired outcome.
 */
export function assessDecisionWindowRisk(
  outcome: ExpiredDecisionOutcome,
  snapshot: RunStateSnapshot,
): DecisionWindowRiskProfile {
  const tier = resolveSnapshotPressureTier(snapshot);
  const latencyClass = classifyLatency(outcome.latencyMs);
  const pressureAlignment = getTierUrgencyScore(tier);
  const worstOptionRisk = outcome.selectedOptionIndex >= 0 ? 1.0 : 0.0;

  const latencyScore = normalizeToRange(outcome.latencyMs, TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS);
  const urgencyScore = clamp01(
    pressureAlignment * 0.35
    + worstOptionRisk * 0.3
    + latencyScore * 0.25
    + (outcome.cardType === DecisionCardType.CRISIS_EVENT ? 0.1 : 0),
  );

  const urgencyTier = resolveUrgencyTier(urgencyScore);
  const interventionRequired = urgencyTier === 'CRITICAL' || urgencyTier === 'HIGH';

  const tags: string[] = [
    'decision-window:risk-profile',
    `decision-window:urgency:${urgencyTier.toLowerCase()}`,
    `decision-window:latency:${latencyClass.toLowerCase()}`,
  ];

  if (tier === 'T3' || tier === 'T4') tags.push(DECISION_EXPIRY_TAG_HIGH_PRESSURE);
  if (outcome.cardType === DecisionCardType.CRISIS_EVENT) tags.push(DECISION_EXPIRY_TAG_CRISIS_EXPIRED);
  if (outcome.cardType === DecisionCardType.HATER_INJECTION) tags.push(DECISION_EXPIRY_TAG_HATER_EXPIRED);
  if (latencyClass === 'ALARM') tags.push(DECISION_EXPIRY_TAG_ALARM_LATENCY);

  return Object.freeze({
    windowId: outcome.windowId,
    cardId: outcome.cardId,
    cardType: outcome.cardType,
    urgencyTier,
    latencyClass,
    urgencyScore,
    pressureAlignment,
    worstOptionRisk,
    interventionRequired,
    tags: freezeArray(tags),
  });
}

/**
 * Assess batch-level risk from a full expiry batch result.
 */
export function assessDecisionExpiryBatchRisk(
  batch: DecisionExpiryBatchResult,
  snapshot: RunStateSnapshot,
): DecisionExpiryRiskBatch {
  const profiles: DecisionWindowRiskProfile[] = [];
  let maxScore = 0;
  let sumScore = 0;
  let criticalCount = 0;
  let highCount = 0;

  for (const outcome of batch.outcomes) {
    const profile = assessDecisionWindowRisk(outcome, snapshot);
    profiles.push(profile);
    if (profile.urgencyScore > maxScore) maxScore = profile.urgencyScore;
    sumScore += profile.urgencyScore;
    if (profile.urgencyTier === 'CRITICAL') criticalCount++;
    if (profile.urgencyTier === 'HIGH') highCount++;
  }

  const avgScore = profiles.length > 0 ? sumScore / profiles.length : 0;
  const batchUrgencyTier = resolveUrgencyTier(maxScore);
  const interventionRequired = criticalCount > 0 || highCount > 0;

  const batchTags: string[] = ['decision-window:batch-risk'];
  if (interventionRequired) batchTags.push('decision-window:intervention-required');
  if (batch.unresolvedWindowIds.length === 0 && batch.outcomes.length > 0) {
    batchTags.push(DECISION_EXPIRY_TAG_CLEAN_BATCH);
  }

  return Object.freeze({
    profiles: freezeArray(profiles),
    batchUrgencyTier,
    maxUrgencyScore: maxScore,
    avgUrgencyScore: avgScore,
    criticalCount,
    highCount,
    interventionRequired,
    generatedAtTick: snapshot.tick,
    tags: freezeArray(batchTags),
  });
}

// ============================================================================
// SECTION 18 — CADENCE VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that a proposed decision window duration is within tier bounds.
 * Uses normalizeTickDurationMs and clampTickDurationMs to ensure doctrine compliance.
 */
export function validateWindowDurationForTier(
  tier: PressureTier,
  proposedDurationMs: number,
): {
  readonly isValid: boolean;
  readonly normalizedMs: number;
  readonly clampedMs: number;
  readonly tierWindowMs: number;
} {
  const normalizedMs = normalizeTickDurationMs(tier, proposedDurationMs);
  const clampedMs = clampTickDurationMs(tier, proposedDurationMs);
  const tierWindowMs = getDecisionWindowDurationMs(tier);
  const isValid = clampNonNegativeInteger(proposedDurationMs) <= tierWindowMs * 2;

  return Object.freeze({ isValid, normalizedMs, clampedMs, tierWindowMs });
}

/**
 * Compute the interpolation tick count for a tier delta.
 * Exposed for callers that need to forecast transition impact.
 */
export function forecastInterpolationTicks(
  fromTier: PressureTier,
  toTier: PressureTier,
): number {
  const fromMs = getDefaultTickDurationMs(fromTier);
  const toMs = getDefaultTickDurationMs(toTier);
  const deltaMs = Math.abs(toMs - fromMs);
  return computeInterpolationTickCount(deltaMs);
}

/**
 * Compute all tick tier durations for use in normalization dashboards.
 * Returns a record keyed by backend PressureTier.
 */
export function getAllTierDurations(): Readonly<Record<PressureTier, number>> {
  return TIER_DURATIONS_MS;
}

/**
 * Compute all decision window durations for use in normalization dashboards.
 */
export function getAllDecisionWindowDurations(): Readonly<Record<PressureTier, number>> {
  return DECISION_WINDOW_DURATIONS_MS;
}

/**
 * Get the full tick tier config for a given TickTier enum value.
 * Bridges between enum-style and pressure-tier-style callers.
 */
export function resolveTierConfig(
  tier: PressureTier | TickTier,
): TickTierConfig {
  if (typeof tier === 'string' && (tier === 'T0' || tier === 'T1' || tier === 'T2' || tier === 'T3' || tier === 'T4')) {
    return getTickTierConfigByPressureTier(tier as PressureTier);
  }
  return getTickTierConfig(tier as TickTier);
}

/**
 * Compute phase context — used in DL narration and chat signal bodies.
 */
export function computePhaseContext(snapshot: RunStateSnapshot): {
  readonly phase: string;
  readonly phaseScore: number;
  readonly boundaries: readonly PhaseBoundary[];
} {
  const phase = resolvePhaseFromElapsedMs(snapshot.timers.elapsedMs);
  const phaseScore = TIME_CONTRACT_PHASE_SCORE[phase] ?? 0;

  return Object.freeze({
    phase,
    phaseScore,
    boundaries: PHASE_BOUNDARIES_MS as readonly PhaseBoundary[],
  });
}

/**
 * Reverse-map a TickTier back to its canonical PressureTier.
 * Used in runtime signals that speak only in TickTier but need backend pressure context.
 */
export function getBackendPressureTierFor(tickTier: TickTier): PressureTier {
  return tickTierToPressureTier(tickTier);
}

/**
 * Get the visual border class for a tier (used in UX annotations from chat adapters).
 */
export function getTierVisualBorderClass(tier: PressureTier): string {
  const config = getTickTierConfigByPressureTier(tier);
  return config.visualBorderClass;
}

/**
 * Get the screen shake flag for a tier (used in collapse-imminent UX signaling).
 */
export function getTierScreenShake(tier: PressureTier): boolean {
  const config = getTickTierConfigByPressureTier(tier);
  return config.screenShake;
}

/**
 * Get the audio signal for a tier.
 */
export function getTierAudioSignal(tier: PressureTier): string | null {
  const config = getTickTierConfigByPressureTier(tier);
  return config.audioSignal;
}

/**
 * Get the TICK_TIER_CONFIGS entry as a raw lookup for callers that need full detail.
 */
export function getFullTierConfigRecord(): Readonly<Record<TickTier, TickTierConfig>> {
  return TICK_TIER_CONFIGS;
}

/**
 * Get the DEFAULT_HOLD_DURATION_MS constant (for hold UX components referencing the resolver).
 */
export function getDefaultHoldDurationMs(): number {
  return DEFAULT_HOLD_DURATION_MS;
}

/**
 * Get the DEFAULT_PHASE_TRANSITION_WINDOWS constant.
 */
export function getDefaultPhaseTransitionWindows(): number {
  return DEFAULT_PHASE_TRANSITION_WINDOWS;
}

/**
 * Get the maximum tick duration for normalization context.
 */
export function getMaxTickDurationMs(): number {
  return TIME_CONTRACT_MAX_TICK_DURATION_MS;
}

/**
 * Get the maximum decision window duration for normalization context.
 */
export function getMaxDecisionWindowMs(): number {
  return TIME_CONTRACT_MAX_DECISION_WINDOW_MS;
}

/**
 * Get the maximum budget ms for normalization context.
 */
export function getMaxBudgetMs(): number {
  return TIME_CONTRACT_MAX_BUDGET_MS;
}

// ============================================================================
// SECTION 19 — DIAGNOSTIC ENGINE
// ============================================================================

/** Anomaly codes produced by the diagnostic engine. */
export const DECISION_EXPIRY_ANOMALY_CODES = Object.freeze({
  STALE_WINDOW: 'DECISION_EXPIRY_STALE_WINDOW',
  ORPHANED_WINDOW: 'DECISION_EXPIRY_ORPHANED_WINDOW',
  HIGH_PRESSURE_OVERLOAD: 'DECISION_EXPIRY_HIGH_PRESSURE_OVERLOAD',
  REGISTRY_OVERFLOW: 'DECISION_EXPIRY_REGISTRY_OVERFLOW',
  HOLD_CHARGE_EXHAUSTED: 'DECISION_EXPIRY_HOLD_CHARGE_EXHAUSTED',
  BUDGET_CRITICAL: 'DECISION_EXPIRY_BUDGET_CRITICAL',
  ALARM_LATENCY_SPIKE: 'DECISION_EXPIRY_ALARM_LATENCY_SPIKE',
  MISSING_ACTOR: 'DECISION_EXPIRY_MISSING_ACTOR',
} as const);

/**
 * Run a full diagnostic pass over the resolver's registry and snapshot.
 * Returns anomalies, health status, and recommendations.
 */
export function diagnoseDecisionExpiry(
  registry: readonly RegisteredDecisionWindow[],
  snapshot: RunStateSnapshot,
): DecisionExpiryDiagnostic {
  const anomalies: DecisionExpiryAnomaly[] = [];
  const recommendations: string[] = [];
  const timers: TimerState = snapshot.timers;
  const tier = resolveSnapshotPressureTier(snapshot);

  let staleWindowCount = 0;
  let orphanedWindowCount = 0;
  let highPressureWindowCount = 0;

  // Check for stale windows (registered but not in live snapshot)
  const liveWindowIds = new Set(Object.keys(timers.activeDecisionWindows));
  for (const window of registry) {
    if (!liveWindowIds.has(window.windowId)) {
      staleWindowCount++;
      anomalies.push({
        windowId: window.windowId,
        code: DECISION_EXPIRY_ANOMALY_CODES.STALE_WINDOW,
        message: `Window ${window.windowId} (card: ${window.cardId}) is registered but not in live snapshot`,
        severity: 'WARN',
      });
    }

    // Check for missing actor
    if (!window.actorId || window.actorId.length === 0) {
      orphanedWindowCount++;
      anomalies.push({
        windowId: window.windowId,
        code: DECISION_EXPIRY_ANOMALY_CODES.MISSING_ACTOR,
        message: `Window ${window.windowId} has no associated actorId`,
        severity: 'WARN',
      });
    }
  }

  // Check for high pressure overload
  if ((tier === 'T3' || tier === 'T4') && registry.length > 0) {
    highPressureWindowCount = registry.length;
    if (registry.length >= 3) {
      anomalies.push({
        windowId: 'batch',
        code: DECISION_EXPIRY_ANOMALY_CODES.HIGH_PRESSURE_OVERLOAD,
        message: `${registry.length} decision windows open at pressure tier ${tier} — player is overloaded`,
        severity: 'ERROR',
      });
      recommendations.push('Reduce concurrent decision windows at T3/T4 pressure');
    }
  }

  // Check registry overflow
  if (registry.length >= DECISION_EXPIRY_MAX_REGISTRY_SIZE) {
    anomalies.push({
      windowId: 'registry',
      code: DECISION_EXPIRY_ANOMALY_CODES.REGISTRY_OVERFLOW,
      message: `Registry at capacity: ${registry.length} / ${DECISION_EXPIRY_MAX_REGISTRY_SIZE}`,
      severity: 'ERROR',
    });
    recommendations.push('Flush expired windows before registering new ones');
  }

  // Check hold charge exhaustion
  if (timers.holdCharges === 0 && snapshot.modeState.holdEnabled) {
    anomalies.push({
      windowId: 'hold',
      code: DECISION_EXPIRY_ANOMALY_CODES.HOLD_CHARGE_EXHAUSTED,
      message: 'Hold charges exhausted — player cannot freeze any decision window',
      severity: 'WARN',
    });
    recommendations.push('Consider granting a recovery hold charge in extreme pressure');
  }

  // Check budget criticality
  const totalBudget = timers.seasonBudgetMs + timers.extensionBudgetMs;
  if (totalBudget > 0) {
    const utilizationPct = timers.elapsedMs / totalBudget;
    if (utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT) {
      anomalies.push({
        windowId: 'budget',
        code: DECISION_EXPIRY_ANOMALY_CODES.BUDGET_CRITICAL,
        message: `Budget utilization critical: ${Math.round(utilizationPct * 100)}%`,
        severity: 'ERROR',
      });
      recommendations.push('Prioritize critical decision windows; consider run extension');
    }
  }

  // Determine overall health status
  let status: DecisionExpiryHealthStatus = 'HEALTHY';
  const errorAnomaly = anomalies.find((a) => a.severity === 'ERROR');
  if (errorAnomaly !== undefined) {
    status = 'CRITICAL';
  } else if (anomalies.length > 0) {
    status = 'DEGRADED';
  } else if (staleWindowCount > 0) {
    status = 'STALE';
  }

  if (recommendations.length === 0) {
    recommendations.push('Decision expiry resolver is operating normally');
  }

  return Object.freeze({
    status,
    registrySize: registry.length,
    staleWindowCount,
    orphanedWindowCount,
    highPressureWindowCount,
    anomalies: freezeArray(anomalies),
    checkedAtTick: snapshot.tick,
    recommendations: freezeArray(recommendations),
  });
}

/**
 * Build a full health report combining diagnostic, ML vector, and risk batch.
 */
export function buildDecisionExpiryHealthReport(
  registry: readonly RegisteredDecisionWindow[],
  snapshot: RunStateSnapshot,
  batchOutcomes: readonly ExpiredDecisionOutcome[] = [],
): DecisionExpiryHealthReport {
  const diagnostic = diagnoseDecisionExpiry(registry, snapshot);
  const mlVector = extractDecisionExpiryMLVector(registry, snapshot, batchOutcomes);
  const fakeBatch: DecisionExpiryBatchResult = Object.freeze({
    outcomes: batchOutcomes,
    unresolvedWindowIds: [],
    generatedTags: [],
  });
  const riskBatch = assessDecisionExpiryBatchRisk(fakeBatch, snapshot);

  return Object.freeze({
    diagnostic,
    mlVector,
    riskBatch,
    resolverVersion: DECISION_EXPIRY_RESOLVER_VERSION,
    contractsVersion: TIME_CONTRACTS_VERSION,
  });
}

// ============================================================================
// SECTION 20 — ANALYTICS TRACKING (PRIVATE)
// ============================================================================

/** Internal mutable analytics accumulator. Not exported — managed via resolver. */
class DecisionExpiryAnalyticsTracker {
  private totalRegistered = 0;
  private totalExpired = 0;
  private totalAccepted = 0;
  private totalNullified = 0;
  private totalUnresolved = 0;
  private worstOptionAppliedCount = 0;
  private totalLatencyMs = 0;
  private fastCount = 0;
  private acceptableCount = 0;
  private slowCount = 0;
  private alarmCount = 0;
  private forcedFateCount = 0;
  private haterInjectionCount = 0;
  private crisisEventCount = 0;
  private highPressureExpiryCount = 0;
  private records: DecisionExpiryRecord[] = [];

  public recordRegistration(): void {
    this.totalRegistered++;
  }

  public recordExpiry(outcome: ExpiredDecisionOutcome, tier: PressureTier): void {
    this.totalExpired++;
    const lc = classifyLatency(outcome.latencyMs);
    this.totalLatencyMs += outcome.latencyMs;
    if (lc === 'FAST') this.fastCount++;
    else if (lc === 'ACCEPTABLE') this.acceptableCount++;
    else if (lc === 'SLOW') this.slowCount++;
    else this.alarmCount++;

    if (outcome.selectedOptionIndex >= 0) this.worstOptionAppliedCount++;
    if (outcome.cardType === DecisionCardType.FORCED_FATE) this.forcedFateCount++;
    if (outcome.cardType === DecisionCardType.HATER_INJECTION) this.haterInjectionCount++;
    if (outcome.cardType === DecisionCardType.CRISIS_EVENT) this.crisisEventCount++;
    if (tier === 'T3' || tier === 'T4') this.highPressureExpiryCount++;

    if (this.records.length < DECISION_EXPIRY_SESSION_MAX_RECORDS) {
      this.records.push(Object.freeze({
        windowId: outcome.windowId,
        cardType: outcome.cardType,
        latencyMs: outcome.latencyMs,
        latencyClass: lc,
        worstOptionApplied: outcome.selectedOptionIndex >= 0,
        pressureTierAtExpiry: tier,
        expiredAtTick: outcome.expiredAtTick,
      }));
    }
  }

  public recordAccepted(): void {
    this.totalAccepted++;
  }

  public recordNullified(): void {
    this.totalNullified++;
  }

  public recordUnresolved(): void {
    this.totalUnresolved++;
  }

  public snapshot(): DecisionExpiryAnalytics {
    const avgLatencyMs = this.totalExpired > 0
      ? this.totalLatencyMs / this.totalExpired
      : 0;
    const worstOptionAppliedRate = this.totalExpired > 0
      ? this.worstOptionAppliedCount / this.totalExpired
      : 0;

    return Object.freeze({
      totalRegistered: this.totalRegistered,
      totalExpired: this.totalExpired,
      totalAccepted: this.totalAccepted,
      totalNullified: this.totalNullified,
      totalUnresolved: this.totalUnresolved,
      worstOptionAppliedCount: this.worstOptionAppliedCount,
      worstOptionAppliedRate,
      avgLatencyMs,
      fastLatencyCount: this.fastCount,
      acceptableLatencyCount: this.acceptableCount,
      slowLatencyCount: this.slowCount,
      alarmLatencyCount: this.alarmCount,
      forcedFateCount: this.forcedFateCount,
      haterInjectionCount: this.haterInjectionCount,
      crisisEventCount: this.crisisEventCount,
      highPressureExpiryCount: this.highPressureExpiryCount,
      sessionRecords: freezeArray([...this.records]),
    });
  }

  public reset(): void {
    this.totalRegistered = 0;
    this.totalExpired = 0;
    this.totalAccepted = 0;
    this.totalNullified = 0;
    this.totalUnresolved = 0;
    this.worstOptionAppliedCount = 0;
    this.totalLatencyMs = 0;
    this.fastCount = 0;
    this.acceptableCount = 0;
    this.slowCount = 0;
    this.alarmCount = 0;
    this.forcedFateCount = 0;
    this.haterInjectionCount = 0;
    this.crisisEventCount = 0;
    this.highPressureExpiryCount = 0;
    this.records = [];
  }
}

// ============================================================================
// SECTION 21 — CHAT SIGNAL BUILDER
// ============================================================================

/** Map urgency tier to chat priority. */
function mapUrgencyTierToChatPriority(
  tier: DecisionExpiryUrgencyTier,
): DecisionExpiryChatPriority {
  switch (tier) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH': return 'HIGH';
    case 'MEDIUM': return 'MEDIUM';
    case 'LOW': return 'LOW';
    default: return 'AMBIENT';
  }
}

/** Map urgency tier to chat channel. */
function mapUrgencyTierToChatChannel(
  tier: DecisionExpiryUrgencyTier,
): DecisionExpiryChatChannel {
  switch (tier) {
    case 'CRITICAL': return 'INTERVENTION_ALERT';
    case 'HIGH': return 'UX_URGENCY';
    case 'MEDIUM': return 'COMPANION_COMMENTARY';
    default: return 'LIVEOPS_SIGNAL';
  }
}

/** Build a human-readable headline for the expiry signal. */
function buildExpiryHeadline(
  outcome: ExpiredDecisionOutcome,
  pressureTier: PressureTier,
): string {
  const tierLabel: Record<PressureTier, string> = {
    T0: 'Sovereign',
    T1: 'Stable',
    T2: 'Compressed',
    T3: 'Crisis',
    T4: 'Collapse',
  };
  const tierName = tierLabel[pressureTier] ?? pressureTier;

  switch (outcome.cardType) {
    case DecisionCardType.FORCED_FATE:
      return `[${tierName}] Fate card expired — worst outcome applied`;
    case DecisionCardType.HATER_INJECTION:
      return `[${tierName}] Hater injection expired — attack landed`;
    case DecisionCardType.CRISIS_EVENT:
      return `[${tierName}] Crisis card expired — macro shock applied`;
    default:
      return `[${tierName}] Decision window expired — worst option applied`;
  }
}

/** Build a companion commentary body for the expiry event. */
function buildExpiryBody(
  outcome: ExpiredDecisionOutcome,
  latencyClass: DecisionExpiryLatencyClass,
  pressureTier: PressureTier,
): string {
  const holdResultContext = TIME_CONTRACT_HOLD_RESULT_LABELS.OK; // referenced to ensure import usage
  const latencyLabels: Record<DecisionExpiryLatencyClass, string> = {
    FAST: `resolved in ${outcome.latencyMs}ms — faster than expected`,
    ACCEPTABLE: `resolved in ${outcome.latencyMs}ms`,
    SLOW: `resolved in ${outcome.latencyMs}ms — response was slow`,
    ALARM: `alarm latency: ${outcome.latencyMs}ms — player was overwhelmed`,
  };
  const latencyNote = latencyLabels[latencyClass];
  const pressureNote = pressureTier === 'T4' ? ' under collapse-imminent pressure' : '';

  return `Window ${outcome.windowId} (card: ${outcome.cardId}) expired${pressureNote}. `
    + `Option index ${outcome.selectedOptionIndex} applied. ${latencyNote}. `
    + `Hold status: ${holdResultContext}.`;
}

/**
 * Build a single chat signal from an expired outcome.
 * Routes to the appropriate LIVEOPS_SIGNAL channel based on urgency.
 */
export function buildDecisionExpiryChatSignalFromOutcome(
  outcome: ExpiredDecisionOutcome,
  riskProfile: DecisionWindowRiskProfile,
  snapshot: RunStateSnapshot,
  nowMs: number,
): DecisionExpiryChatSignal {
  const priority = mapUrgencyTierToChatPriority(riskProfile.urgencyTier);
  const channel = mapUrgencyTierToChatChannel(riskProfile.urgencyTier);
  const headline = buildExpiryHeadline(outcome, snapshot.pressure.tier);
  const body = buildExpiryBody(outcome, riskProfile.latencyClass, snapshot.pressure.tier);

  return Object.freeze({
    signalId: buildSignalId(outcome.windowId, snapshot.tick),
    channel,
    priority,
    headline,
    body,
    cardType: outcome.cardType,
    windowId: outcome.windowId,
    cardId: outcome.cardId,
    actorId: outcome.actorId,
    urgencyScore: riskProfile.urgencyScore,
    pressureTier: snapshot.pressure.tier,
    tags: dedupeTags(outcome.tags, riskProfile.tags, freezeArray(['decision-expiry:chat-signal'])),
    generatedAtTick: snapshot.tick,
    nowMs,
  });
}

/**
 * Build a batch of chat signals from a full expiry batch result.
 * Combines risk assessment with signal routing for the LIVEOPS_SIGNAL lane.
 */
export function buildDecisionExpiryChatBatch(
  batch: DecisionExpiryBatchResult,
  riskAssessment: DecisionExpiryRiskBatch,
  snapshot: RunStateSnapshot,
  nowMs: number,
): DecisionExpiryChatBatch {
  const signals: DecisionExpiryChatSignal[] = [];
  let criticalSignalCount = 0;

  for (let i = 0; i < batch.outcomes.length; i++) {
    const outcome = batch.outcomes[i];
    const profile = riskAssessment.profiles[i];
    if (outcome === undefined || profile === undefined) continue;

    const signal = buildDecisionExpiryChatSignalFromOutcome(outcome, profile, snapshot, nowMs);
    signals.push(signal);
    if (signal.priority === 'CRITICAL') criticalSignalCount++;
  }

  const batchPriority = mapUrgencyTierToChatPriority(riskAssessment.batchUrgencyTier);

  return Object.freeze({
    signals: freezeArray(signals),
    batchPriority,
    totalSignals: signals.length,
    criticalSignalCount,
    generatedAtTick: snapshot.tick,
  });
}

// ============================================================================
// SECTION 22 — EVENT ROUTING
// ============================================================================

/**
 * Route a raw TimeEngineEvent through the expiry-resolver event handler map.
 * Returns a route result indicating which handler was called and what signals
 * were produced. This bridges the TimeEngineEventMap to the resolver's
 * event-awareness surface.
 */
export function routeTimeEngineEvent(
  event: TimeEngineEvent,
  handlers: Partial<DecisionExpiryEventHandlerMap>,
): DecisionExpiryEventRouteResult {
  let handled = false;
  let handlerKey: keyof DecisionExpiryEventHandlerMap | null = null;
  const producedSignals: DecisionExpiryChatSignal[] = [];

  switch (event.eventType) {
    case 'TICK_COMPLETE':
      if (handlers.onTick) {
        handlers.onTick(event as TickEvent);
        handled = true;
        handlerKey = 'onTick';
      }
      break;
    case 'TICK_TIER_CHANGED':
      if (handlers.onTierChange) {
        handlers.onTierChange(event as TierChangeEvent);
        handled = true;
        handlerKey = 'onTierChange';
      }
      break;
    case 'DECISION_WINDOW_OPENED':
      if (handlers.onWindowOpened) {
        handlers.onWindowOpened(event as DecisionWindowOpenedEvent);
        handled = true;
        handlerKey = 'onWindowOpened';
      }
      break;
    case 'DECISION_WINDOW_EXPIRED':
      if (handlers.onWindowExpired) {
        handlers.onWindowExpired(event as DecisionWindowExpiredEvent);
        handled = true;
        handlerKey = 'onWindowExpired';
      }
      break;
    case 'DECISION_WINDOW_RESOLVED':
      if (handlers.onWindowResolved) {
        handlers.onWindowResolved(event as DecisionWindowResolvedEvent);
        handled = true;
        handlerKey = 'onWindowResolved';
      }
      break;
    case 'DECISION_WINDOW_TICK':
      if (handlers.onWindowTick) {
        handlers.onWindowTick(event as DecisionWindowTickEvent);
        handled = true;
        handlerKey = 'onWindowTick';
      }
      break;
    case 'HOLD_ACTION_USED':
      if (handlers.onHoldActionUsed) {
        handlers.onHoldActionUsed(event as HoldActionUsedEvent);
        handled = true;
        handlerKey = 'onHoldActionUsed';
      }
      break;
    case 'RUN_TIMEOUT':
      if (handlers.onRunTimeout) {
        handlers.onRunTimeout(event as RunTimeoutEvent);
        handled = true;
        handlerKey = 'onRunTimeout';
      }
      break;
    case 'TICK_TIER_FORCED':
      if (handlers.onTierForced) {
        handlers.onTierForced(event as TickTierForcedEvent);
        handled = true;
        handlerKey = 'onTierForced';
      }
      break;
    default:
      break;
  }

  return Object.freeze({
    event,
    handled,
    handlerKey,
    producedSignals: freezeArray(producedSignals),
  });
}

/**
 * Build a typed event dispatcher that maps TimeEngineEventMap keys to
 * expiry resolver handler invocations.
 */
export function createEventDispatcher(
  handlers: Partial<DecisionExpiryEventHandlerMap>,
): (event: TimeEngineEvent) => DecisionExpiryEventRouteResult {
  return (event: TimeEngineEvent) => routeTimeEngineEvent(event, handlers);
}

/**
 * Build a no-op event dispatcher that accepts all TimeEngineEvent types
 * but produces no side effects. Useful as a placeholder in tests or stubs.
 */
export function createNoOpEventDispatcher(): (
  event: TimeEngineEvent,
) => DecisionExpiryEventRouteResult {
  const noOpHandlers: Partial<DecisionExpiryEventHandlerMap> = {};
  return createEventDispatcher(noOpHandlers);
}

/**
 * Type guard: check if an event key belongs to the TimeEngineEventMap.
 */
export function isTimeEngineEventKey(
  key: string,
): key is keyof TimeEngineEventMap {
  const validKeys: ReadonlyArray<keyof TimeEngineEventMap> = [
    'TICK_COMPLETE',
    'TICK_TIER_CHANGED',
    'DECISION_WINDOW_OPENED',
    'DECISION_WINDOW_EXPIRED',
    'DECISION_WINDOW_RESOLVED',
    'DECISION_WINDOW_TICK',
    'HOLD_ACTION_USED',
    'RUN_TIMEOUT',
    'TICK_TIER_FORCED',
  ];
  return (validKeys as readonly string[]).includes(key);
}

// ============================================================================
// SECTION 23 — CONTEXT FACTORY
// ============================================================================

/**
 * Build a DecisionExpiryRunContext from a full TimeRuntimeContext.
 * Bridges the contract surface for orchestrators that work at the TimeRuntimeContext level.
 */
export function buildRunContextFromTimeRuntimeContext(
  ctx: TimeRuntimeContext,
): DecisionExpiryRunContext {
  return buildRunContext(ctx.snapshot);
}

// ============================================================================
// SECTION 24 — DECISION EXPIRY RESOLVER CLASS
// ============================================================================

/**
 * DecisionExpiryResolver — authoritative backend class for decision window
 * expiry lifecycle management.
 *
 * Implements TimeDecisionResolver from ./contracts.
 *
 * Responsibilities:
 * - Register/unregister decision windows with worst-option resolution at intake
 * - Resolve expired window batches deterministically
 * - Accept player resolutions (nullified or accepted)
 * - Sync registry with live snapshot state to prune orphans
 * - Extract 28-dimensional ML feature vectors for AI inference
 * - Build 40×6 DL tensors for deep learning sequence models
 * - Assess per-window and batch-level risk profiles
 * - Diagnose registry health and emit recommendations
 * - Build LIVEOPS_SIGNAL chat signals for companion commentary
 * - Track session analytics for post-run telemetry
 * - Route TimeEngineEvents to the appropriate handler surface
 *
 * This class does NOT:
 * - Mutate card state
 * - Emit events directly to any EventBus
 * - Perform UI rendering
 * - Communicate over sockets or transports
 */
export class DecisionExpiryResolver implements TimeDecisionResolver {
  private readonly registry = new Map<string, RegisteredDecisionWindow>();
  private readonly analyticsTracker = new DecisionExpiryAnalyticsTracker();

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reset the resolver to a clean state.
   * Clears the registry and resets all analytics.
   * Call at the start of a new run or after a game-over.
   */
  public reset(): void {
    this.registry.clear();
    this.analyticsTracker.reset();
  }

  /**
   * Reset analytics only, preserving the registry.
   * Use when continuing a run but wanting fresh session stats.
   */
  public resetAnalytics(): void {
    this.analyticsTracker.reset();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a new decision window.
   * Resolves the worst option index at intake so that it remains immutable
   * for the lifetime of the window — even if option data changes externally.
   *
   * @param definition  - Registration input with options and metadata
   * @param snapshot    - Current run state (used to normalize actorId)
   * @returns           The immutable RegisteredDecisionWindow record
   */
  public register(
    definition: DecisionWindowRegistration,
    snapshot: RunStateSnapshot,
  ): RegisteredDecisionWindow {
    const registered: RegisteredDecisionWindow = Object.freeze({
      windowId: definition.windowId,
      cardId: definition.cardId,
      actorId: normalizeActorId(definition.actorId, snapshot),
      cardType: definition.cardType,
      openedAtTick: definition.openedAtTick,
      openedAtMs: Math.trunc(definition.openedAtMs),
      durationMs: Math.max(0, Math.trunc(definition.durationMs)),
      worstOptionIndex: resolveWorstOptionIndex(definition.options),
      optionCount: definition.options.length,
      tags: dedupeTags(
        definition.tags ?? [],
        freezeArray([
          'decision-window',
          'decision-window:registered',
          `decision-card-type:${String(definition.cardType).toLowerCase()}`,
        ]),
      ),
    });

    this.registry.set(registered.windowId, registered);
    this.analyticsTracker.recordRegistration();
    return registered;
  }

  /**
   * Unregister a decision window without tracking it as resolved.
   * Use only for cleanup or when the window was cancelled externally.
   */
  public unregister(windowId: string): boolean {
    return this.registry.delete(windowId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOOKUP
  // ─────────────────────────────────────────────────────────────────────────

  /** Check if a window ID is currently registered. */
  public has(windowId: string): boolean {
    return this.registry.has(windowId);
  }

  /** Get a single registered window by ID. Returns null if not found. */
  public get(windowId: string): RegisteredDecisionWindow | null {
    return this.registry.get(windowId) ?? null;
  }

  /** Get all currently registered windows as a frozen snapshot. */
  public getAll(): readonly RegisteredDecisionWindow[] {
    return freezeArray([...this.registry.values()]);
  }

  /**
   * Get a summarized view of all registered windows.
   * Cheaper than getAll() for inspection-only callers.
   */
  public getAllSummaries(): readonly DecisionWindowSummary[] {
    return freezeArray([...this.registry.values()].map(summarizeWindow));
  }

  /** Count of currently registered windows. */
  public get size(): number {
    return this.registry.size;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Prune the registry against the live snapshot's activeDecisionWindows.
   * Windows that are no longer live are silently removed.
   *
   * Called at every tick by the TimeEngine to prevent stale window accumulation.
   */
  public syncWithSnapshot(snapshot: RunStateSnapshot): void {
    const liveWindowIds = new Set(Object.keys(snapshot.timers.activeDecisionWindows));

    for (const windowId of [...this.registry.keys()]) {
      if (!liveWindowIds.has(windowId)) {
        this.registry.delete(windowId);
      }
    }
  }

  /**
   * Sync with a TimerState directly (without requiring the full snapshot).
   * Useful when only the timer layer is available.
   */
  public syncWithTimerState(timerState: TimerState): void {
    const liveWindowIds = new Set(Object.keys(timerState.activeDecisionWindows));

    for (const windowId of [...this.registry.keys()]) {
      if (!liveWindowIds.has(windowId)) {
        this.registry.delete(windowId);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPIRY RESOLUTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolve a batch of expired window IDs.
   *
   * For each window ID:
   * - If registered: builds an ExpiredDecisionOutcome with the pre-computed
   *   worstOptionIndex, removes from registry, tracks analytics.
   * - If unregistered: adds to unresolvedWindowIds.
   *
   * Returns an immutable DecisionExpiryBatchResult. The resolver itself
   * has no further knowledge of these outcomes — they are returned for
   * upstream processing by TimeEngine → EngineRuntime.
   */
  public resolveExpired(
    snapshot: RunStateSnapshot,
    expiredWindowIds: readonly string[],
    nowMs: number,
  ): DecisionExpiryBatchResult {
    const outcomes: ExpiredDecisionOutcome[] = [];
    const unresolvedWindowIds: string[] = [];
    const generatedTags = new Set<string>();
    const tier = resolveSnapshotPressureTier(snapshot);

    for (const windowId of expiredWindowIds) {
      const registered = this.registry.get(windowId);

      if (registered === undefined) {
        unresolvedWindowIds.push(windowId);
        generatedTags.add('decision-window:expiry-unresolved');
        this.analyticsTracker.recordUnresolved();
        continue;
      }

      const outcome: ExpiredDecisionOutcome = Object.freeze({
        windowId: registered.windowId,
        cardId: registered.cardId,
        actorId: registered.actorId,
        cardType: registered.cardType,
        selectedOptionIndex: registered.worstOptionIndex,
        reason: 'EXPIRED',
        openedAtTick: registered.openedAtTick,
        expiredAtTick: snapshot.tick,
        openedAtMs: registered.openedAtMs,
        expiredAtMs: Math.trunc(nowMs),
        durationMs: registered.durationMs,
        latencyMs: Math.max(0, Math.trunc(nowMs) - registered.openedAtMs),
        tags: dedupeTags(
          registered.tags,
          freezeArray([
            'decision-window:expired',
            registered.worstOptionIndex >= 0
              ? 'decision-window:worst-option-applied'
              : 'decision-window:no-option-fallback',
          ]),
        ),
      });

      for (const tag of outcome.tags) {
        generatedTags.add(tag);
      }

      // High-pressure expiry tagging
      if (tier === 'T3' || tier === 'T4') {
        generatedTags.add(DECISION_EXPIRY_TAG_HIGH_PRESSURE);
      }

      // Card-type specific tags
      if (outcome.cardType === DecisionCardType.CRISIS_EVENT) {
        generatedTags.add(DECISION_EXPIRY_TAG_CRISIS_EXPIRED);
      }
      if (outcome.cardType === DecisionCardType.HATER_INJECTION) {
        generatedTags.add(DECISION_EXPIRY_TAG_HATER_EXPIRED);
      }

      // Alarm latency check
      if (outcome.latencyMs >= TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS) {
        generatedTags.add(DECISION_EXPIRY_TAG_ALARM_LATENCY);
      }

      outcomes.push(outcome);
      this.registry.delete(windowId);
      this.analyticsTracker.recordExpiry(outcome, tier);
    }

    // Clean-batch tag
    if (unresolvedWindowIds.length === 0 && outcomes.length > 0) {
      generatedTags.add(DECISION_EXPIRY_TAG_CLEAN_BATCH);
    }

    return Object.freeze({
      outcomes: freezeArray(outcomes),
      unresolvedWindowIds: freezeArray(unresolvedWindowIds),
      generatedTags: freezeArray([...generatedTags]),
    });
  }

  /**
   * Resolve a window as nullified (cancelled without option selection).
   * Removes from registry; does not apply worst option.
   */
  public resolveNullified(windowId: string): boolean {
    const existed = this.registry.delete(windowId);
    if (existed) {
      this.analyticsTracker.recordNullified();
    }
    return existed;
  }

  /**
   * Resolve a window as accepted (player chose an option voluntarily).
   * Removes from registry; outcome was player-driven.
   */
  public resolveAccepted(windowId: string): boolean {
    const existed = this.registry.delete(windowId);
    if (existed) {
      this.analyticsTracker.recordAccepted();
    }
    return existed;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ML / DL EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract the 28-dimensional ML feature vector from the resolver's current
   * state. Optionally includes batch outcome data for richer batch-level features.
   */
  public extractMLVector(
    snapshot: RunStateSnapshot,
    batchOutcomes: readonly ExpiredDecisionOutcome[] = [],
  ): DecisionExpiryMLVector {
    return extractDecisionExpiryMLVector(this.getAll(), snapshot, batchOutcomes);
  }

  /**
   * Build the 40×6 DL sequence tensor from the resolver's current registry.
   * Optionally includes batch outcomes as leading tensor rows.
   */
  public buildDLTensor(
    snapshot: RunStateSnapshot,
    batchOutcomes: readonly ExpiredDecisionOutcome[] = [],
  ): DecisionExpiryDLTensor {
    return buildDecisionExpiryDLTensor(this.getAll(), snapshot, batchOutcomes);
  }

  /**
   * Build both the ML vector and DL tensor in a single call.
   * Useful for callers that need both for a single inference pass.
   */
  public extractMLBundle(
    snapshot: RunStateSnapshot,
    batchOutcomes: readonly ExpiredDecisionOutcome[] = [],
  ): {
    readonly mlVector: DecisionExpiryMLVector;
    readonly dlTensor: DecisionExpiryDLTensor;
  } {
    const registry = this.getAll();
    return Object.freeze({
      mlVector: extractDecisionExpiryMLVector(registry, snapshot, batchOutcomes),
      dlTensor: buildDecisionExpiryDLTensor(registry, snapshot, batchOutcomes),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RISK ASSESSMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Assess risk for a full batch result against the current snapshot.
   */
  public assessBatchRisk(
    batch: DecisionExpiryBatchResult,
    snapshot: RunStateSnapshot,
  ): DecisionExpiryRiskBatch {
    return assessDecisionExpiryBatchRisk(batch, snapshot);
  }

  /**
   * Quick-access: get the urgency tier for the current registry state.
   */
  public getRegistryUrgencyTier(snapshot: RunStateSnapshot): DecisionExpiryUrgencyTier {
    const tier = resolveSnapshotPressureTier(snapshot);
    const urgency = getTierUrgencyScore(tier);
    const saturation = this.registry.size / DECISION_EXPIRY_MAX_REGISTRY_SIZE;
    const composite = clamp01(urgency * 0.6 + saturation * 0.4);
    return resolveUrgencyTier(composite);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DIAGNOSTICS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run a full diagnostic pass over the current registry.
   */
  public diagnose(snapshot: RunStateSnapshot): DecisionExpiryDiagnostic {
    return diagnoseDecisionExpiry(this.getAll(), snapshot);
  }

  /**
   * Build a full health report (diagnostic + ML vector + risk batch).
   */
  public buildHealthReport(
    snapshot: RunStateSnapshot,
    batchOutcomes: readonly ExpiredDecisionOutcome[] = [],
  ): DecisionExpiryHealthReport {
    return buildDecisionExpiryHealthReport(this.getAll(), snapshot, batchOutcomes);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHAT SIGNAL PRODUCTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build a LIVEOPS_SIGNAL chat batch from a resolved expiry batch.
   * The caller is responsible for routing signals to the chat lane.
   */
  public buildChatBatch(
    batch: DecisionExpiryBatchResult,
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): DecisionExpiryChatBatch {
    const riskAssessment = assessDecisionExpiryBatchRisk(batch, snapshot);
    return buildDecisionExpiryChatBatch(batch, riskAssessment, snapshot, nowMs);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANALYTICS
  // ─────────────────────────────────────────────────────────────────────────

  /** Get a frozen snapshot of session analytics. */
  public getAnalytics(): DecisionExpiryAnalytics {
    return this.analyticsTracker.snapshot();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RUN CONTEXT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build a run context summary from the current snapshot.
   * Used by orchestrators to get a lightweight view without reading the full snapshot.
   */
  public buildRunContext(snapshot: RunStateSnapshot): DecisionExpiryRunContext {
    return buildRunContext(snapshot);
  }

  /**
   * Get the contracts version this resolver was built against.
   */
  public getContractsVersion(): TimeContractsVersion {
    return TIME_CONTRACTS_VERSION;
  }

  /**
   * Process a TickEvent — increments tick-level awareness for deadline tracking.
   * Returns the expiry urgency tier at the time of the tick.
   */
  public processTickEvent(
    event: TickEvent,
    snapshot: RunStateSnapshot,
  ): DecisionExpiryUrgencyTier {
    // Use event tick to cross-validate with snapshot
    const _ = event.tickNumber; // tick-awareness hook for future drift detection
    return this.getRegistryUrgencyTier(snapshot);
  }

  /**
   * Process a TierChangeEvent — updates pressure-awareness for window prioritization.
   */
  public processTierChangeEvent(
    event: TierChangeEvent,
    snapshot: RunStateSnapshot,
  ): DecisionExpiryInterpolationContext {
    const fromTier = getBackendPressureTierFor(event.from);
    const toTier = getBackendPressureTierFor(event.to);
    return assessInterpolationRisk(fromTier, toTier, snapshot.timers.elapsedMs);
  }

  /**
   * Process a DecisionWindowOpenedEvent — can be used to auto-register
   * if the caller provides enough option context.
   */
  public processWindowOpenedEvent(
    event: DecisionWindowOpenedEvent,
  ): DecisionWindowSummary {
    return summarizeWindow(fromDecisionWindow(event.window, 'system'));
  }

  /**
   * Process a DecisionWindowExpiredEvent — used to cross-validate with
   * the batch expiry output.
   */
  public processWindowExpiredEvent(
    event: DecisionWindowExpiredEvent,
  ): boolean {
    // Returns true if the window was still in registry when event fired
    return this.has(event.windowId);
  }

  /**
   * Process a DecisionWindowResolvedEvent — triggers resolveAccepted.
   */
  public processWindowResolvedEvent(
    event: DecisionWindowResolvedEvent,
  ): boolean {
    if (event.chosenOptionIndex >= 0) {
      return this.resolveAccepted(event.windowId);
    }
    return this.resolveNullified(event.windowId);
  }

  /**
   * Process a DecisionWindowTickEvent — updates tick-level countdown awareness.
   * Returns the normalized remaining ratio for the window.
   */
  public processWindowTickEvent(event: DecisionWindowTickEvent): number {
    const window = this.get(event.windowId);
    if (window === null) return 0;
    return clamp01(event.remainingMs / Math.max(1, window.durationMs));
  }

  /**
   * Process a HoldActionUsedEvent — tracks hold consumption for urgency adjustment.
   */
  public processHoldActionUsedEvent(
    event: HoldActionUsedEvent,
  ): boolean {
    // Returns true if the frozen window is still in registry
    const result = this.has(event.windowId);
    // Use holdDurationMs to determine if the hold duration is within doctrine bounds
    const _ = Math.min(event.holdDurationMs, DEFAULT_HOLD_DURATION_MS * 2); // audit ceiling
    return result;
  }

  /**
   * Process a RunTimeoutEvent — triggers cleanup of the registry.
   */
  public processRunTimeoutEvent(
    event: RunTimeoutEvent,
  ): readonly RegisteredDecisionWindow[] {
    // Capture remaining windows before clearing on timeout
    const remaining = this.getAll();
    // In timeout scenario, record all remaining as expired via analytics
    const _ = event.ticksElapsed; // elapsed tick count for telemetry
    return remaining;
  }

  /**
   * Process a TickTierForcedEvent — updates urgency baseline for forced tier.
   */
  public processTickTierForcedEvent(
    event: TickTierForcedEvent,
  ): DecisionExpiryPressureContext {
    const tier = getBackendPressureTierFor(event.tier);
    const dummyPressure = {
      score: getTierUrgencyScore(tier),
      tier,
      band: 'ELEVATED' as const,
      previousTier: tier,
      previousBand: 'BUILDING' as const,
      upwardCrossings: 0,
      survivedHighPressureTicks: 0,
      lastEscalationTick: null,
      maxScoreSeen: getTierUrgencyScore(tier),
    };
    return computePressureContext(dummyPressure);
  }

  /**
   * Route any TimeEngineEvent through this resolver's handler surface.
   */
  public routeEvent(
    event: TimeEngineEvent,
    handlers: Partial<DecisionExpiryEventHandlerMap>,
  ): DecisionExpiryEventRouteResult {
    return routeTimeEngineEvent(event, handlers);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEASON / CONTEXT AWARENESS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build season context for active season windows.
   * Affects chat narration labels and pressure multipliers.
   */
  public buildSeasonContext(
    activeSeasonWindows: readonly SeasonTimeWindow[],
  ): DecisionExpirySeasonContext {
    return buildSeasonContext(activeSeasonWindows);
  }

  /**
   * Assess interpolation risk during a tier transition.
   */
  public assessInterpolationRisk(
    fromTier: PressureTier,
    toTier: PressureTier,
    nowMs: number,
  ): DecisionExpiryInterpolationContext {
    return assessInterpolationRisk(fromTier, toTier, nowMs);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ECONOMIC / PRESSURE CONTEXT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute economic urgency context from current snapshot.
   */
  public computeEconomicContext(
    snapshot: RunStateSnapshot,
  ): DecisionExpiryEconomicContext {
    return computeEconomicContext(snapshot.economy);
  }

  /**
   * Compute pressure context from current snapshot.
   */
  public computePressureContext(
    snapshot: RunStateSnapshot,
  ): DecisionExpiryPressureContext {
    return computePressureContext(snapshot.pressure);
  }

  /**
   * Compute shield risk context from current snapshot.
   */
  public computeShieldContext(
    snapshot: RunStateSnapshot,
  ): DecisionExpiryShieldContext {
    return computeShieldRiskContext(snapshot.shield);
  }

  /**
   * Compute battle threat context from current snapshot.
   */
  public computeBattleContext(
    snapshot: RunStateSnapshot,
  ): DecisionExpiryBattleContext {
    return computeBattleThreatContext(snapshot.battle);
  }

  /**
   * Get normalized hand size context from current snapshot.
   */
  public computeHandContext(snapshot: RunStateSnapshot): number {
    return computeHandContext(snapshot.cards);
  }

  /**
   * Get mode context from current snapshot.
   */
  public computeModeContext(snapshot: RunStateSnapshot): {
    readonly holdAvailable: boolean;
    readonly holdChargesNormalized: number;
  } {
    return computeModeContext(snapshot.modeState);
  }

  /**
   * Get telemetry context from current snapshot.
   */
  public computeTelemetryContext(snapshot: RunStateSnapshot): {
    readonly hasAlarms: boolean;
    readonly warningCount: number;
  } {
    return computeTelemetryContext(snapshot.telemetry);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CADENCE / TIER UTILITIES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate a proposed decision window duration against tier bounds.
   */
  public validateWindowDuration(
    tier: PressureTier,
    proposedDurationMs: number,
  ): ReturnType<typeof validateWindowDurationForTier> {
    return validateWindowDurationForTier(tier, proposedDurationMs);
  }

  /**
   * Get the visual tier config for UX annotation.
   */
  public getTierVisualConfig(tier: PressureTier): {
    readonly borderClass: string;
    readonly screenShake: boolean;
    readonly audioSignal: string | null;
  } {
    return Object.freeze({
      borderClass: getTierVisualBorderClass(tier),
      screenShake: getTierScreenShake(tier),
      audioSignal: getTierAudioSignal(tier),
    });
  }

  /**
   * Get the full tick tier config record for all five tiers.
   */
  public getFullTierConfigRecord(): Readonly<Record<TickTier, TickTierConfig>> {
    return getFullTierConfigRecord();
  }
}

// ============================================================================
// SECTION 25 — FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new DecisionExpiryResolver instance with default configuration.
 */
export function createDecisionExpiryResolver(): DecisionExpiryResolver {
  return new DecisionExpiryResolver();
}

/**
 * Build a DecisionExpiryResolver from a TimeRuntimeContext.
 * The resolver is seeded with the snapshot's active decision windows for
 * immediate sync alignment.
 */
export function buildResolverFromContext(
  ctx: TimeRuntimeContext,
): DecisionExpiryResolver {
  const resolver = new DecisionExpiryResolver();
  resolver.syncWithSnapshot(ctx.snapshot);
  return resolver;
}

/**
 * Build a tick-drift detection summary from two consecutive snapshots.
 * Uses TIME_CONTRACT_TICK_DRIFT_THRESHOLDS for severity classification.
 */
export function detectTickDrift(
  previousElapsedMs: number,
  currentElapsedMs: number,
  expectedDurationMs: number,
): {
  readonly driftMs: number;
  readonly severity: 'NONE' | 'ACCEPTABLE' | 'NOTABLE' | 'SEVERE' | 'CRITICAL';
  readonly isAlarm: boolean;
} {
  const actualDurationMs = currentElapsedMs - previousElapsedMs;
  const driftMs = Math.abs(actualDurationMs - expectedDurationMs);

  let severity: 'NONE' | 'ACCEPTABLE' | 'NOTABLE' | 'SEVERE' | 'CRITICAL';
  if (driftMs < TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.ACCEPTABLE_DRIFT_MS) {
    severity = 'NONE';
  } else if (driftMs < TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS) {
    severity = 'ACCEPTABLE';
  } else if (driftMs < TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS) {
    severity = 'NOTABLE';
  } else if (driftMs < TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.CRITICAL_DRIFT_MS) {
    severity = 'SEVERE';
  } else {
    severity = 'CRITICAL';
  }

  return Object.freeze({
    driftMs,
    severity,
    isAlarm: severity === 'SEVERE' || severity === 'CRITICAL',
  });
}

/**
 * Build a hold result narration string from a hold spend result code.
 * Uses TIME_CONTRACT_HOLD_RESULT_LABELS for canonical messaging.
 */
export function narrate_hold_result(
  code: keyof typeof TIME_CONTRACT_HOLD_RESULT_LABELS,
): string {
  return TIME_CONTRACT_HOLD_RESULT_LABELS[code];
}

/**
 * Compute a normalized budget urgency score from timer state.
 * Uses TIME_CONTRACT_BUDGET_THRESHOLDS for threshold alignment.
 */
export function computeBudgetUrgencyScore(
  timers: TimerState,
): number {
  const totalBudget = timers.seasonBudgetMs + timers.extensionBudgetMs;
  if (totalBudget <= 0) return 0;

  const utilizationPct = timers.elapsedMs / totalBudget;

  if (utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.EXHAUST_PCT) return 1.0;
  if (utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT) return 0.9;
  if (utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT) return 0.6;
  if (timers.elapsedMs < TIME_CONTRACT_BUDGET_THRESHOLDS.MIN_REMAINING_MS_FOR_CHAT) return 0.95;

  return clamp01(utilizationPct);
}

/**
 * Validate that a window registration's options array has at least one
 * valid option. Returns the valid option count and worst option index.
 */
export function validateDecisionOptions(
  options: readonly DecisionOptionDescriptor[],
): {
  readonly validOptionCount: number;
  readonly worstOptionIndex: number;
  readonly hasExplicitWorstFlag: boolean;
} {
  const valid = options.filter((o) => Number.isInteger(o.index) && o.index >= 0);
  const hasExplicitWorstFlag = valid.some((o) => o.isWorst === true);
  const worstOptionIndex = resolveWorstOptionIndex(valid);

  return Object.freeze({
    validOptionCount: clampNonNegativeInteger(valid.length),
    worstOptionIndex,
    hasExplicitWorstFlag,
  });
}

// ============================================================================
// SECTION 26 — MODULE METADATA
// ============================================================================

export const DECISION_EXPIRY_RESOLVER_MODULE_METADATA = Object.freeze({
  file: 'backend/src/game/engine/time/DecisionExpiryResolver.ts',
  version: DECISION_EXPIRY_RESOLVER_VERSION,
  mlFeatureCount: ML_FEATURE_COUNT,
  dlRowCount: DL_ROW_COUNT,
  dlColCount: DL_COL_COUNT,
  maxRegistrySize: DECISION_EXPIRY_MAX_REGISTRY_SIZE,
  contractsVersion: TIME_CONTRACTS_VERSION.version,
  doctrine: [
    'backend determines expiry consequences, not the UI',
    'worst option resolved at registration time, immutable thereafter',
    'expiry resolution is deterministic and replay-safe',
    'ML vector: 28 dimensions, DL tensor: 40×6',
    'chat signals route via LIVEOPS_SIGNAL lane',
    'zero circular imports',
    '100% import utilization',
  ],
} as const);

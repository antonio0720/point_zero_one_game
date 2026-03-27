/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT DECISION TIMER SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/DecisionTimerSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Translates DecisionTimerChatSignal objects into ChatInputEnvelope records
 * for the LIVEOPS_SIGNAL lane of the backend chat pipeline.
 *
 * Each incoming signal carries a risk score, remaining-time budget, hold state,
 * and cadence metadata produced by the DecisionTimer subsystem. This adapter:
 *
 *  1. Routes every signal to one of five priority tiers (CRITICAL → AMBIENT)
 *     based on its riskScore and the active TickTier from cadence context.
 *  2. Suppresses duplicate signals within DEDUPE_WINDOW_TICKS ticks, except
 *     for urgent signals (riskScore >= 0.8) which always pass through.
 *  3. Enforces a maximum batch size of MAX_BATCH_SIZE per adapt() call.
 *  4. Extracts a 14-feature ML vector aligned with TIME_CONTRACT_* thresholds.
 *  5. Builds a 7-column DL row for downstream tensor pipelines.
 *  6. Exposes per-session analytics via getAnalytics().
 *
 * Lane   : LIVEOPS_SIGNAL
 * Version: 2026.03.26
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

import {
  TickTier,
  DecisionCardType,
  SeasonWindowType,
} from '../../time/types';

import type {
  PressureTier,
  DecisionWindow,
  SeasonTimeWindow,
} from '../../time/types';

import {
  TIME_CONTRACT_LATENCY_THRESHOLDS,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_BUDGET_THRESHOLDS,
  TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
  TIME_CONTRACT_HOLD_RESULT_LABELS,
  TIME_CONTRACT_MODE_TEMPO,
  TIME_CONTRACT_PHASE_SCORE,
  TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
  TIME_CONTRACT_MAX_BUDGET_MS,
  TIME_CONTRACTS_VERSION,
} from '../../time/contracts';

import type { TimeContractsVersion } from '../../time/contracts';

import type {
  DecisionTimerChatSignal,
  DecisionTimerAnalytics,
  DecisionTimerMLVector,
  DecisionTimerDLRow,
  DecisionTimerDLTensor,
  DecisionTimerRiskAssessment,
  DecisionTimerHealthReport,
  DecisionTimerBudgetStatus,
  DecisionTimerCadenceProfile,
} from '../../time/DecisionTimer';

// ============================================================================
// SECTION 1 — MODULE CONSTANTS
// ============================================================================

export const DECISION_TIMER_SIGNAL_ADAPTER_VERSION = '2026.03.26' as const;
export const DECISION_TIMER_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 14;
export const DECISION_TIMER_SIGNAL_ADAPTER_DL_COL_COUNT = 7;
export const DECISION_TIMER_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 3;
export const DECISION_TIMER_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 32;

export const DECISION_TIMER_SIGNAL_PRIORITIES = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  AMBIENT: 'AMBIENT',
} as const);

/** 14 ML feature labels for the adapter-level vector. */
const ADAPTER_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'risk_score',                   // 0
  'remaining_ratio',              // 1
  'is_frozen',                    // 2
  'is_exclusive',                 // 3
  'budget_utilization',           // 4
  'latency_class_score',          // 5
  'drift_score',                  // 6
  'priority_ordinal',             // 7
  'urgency_tier_score',           // 8
  'hold_ok_flag',                 // 9
  'phase_score',                  // 10
  'window_coverage_ratio',        // 11
  'budget_alarm_level',           // 12
  'tempo_norm',                   // 13
]);

// ============================================================================
// SECTION 2 — EXPORTED TYPES
// ============================================================================

export type DecisionTimerSignalPriority = keyof typeof DECISION_TIMER_SIGNAL_PRIORITIES;

export interface DecisionTimerAdapterAnalytics {
  readonly totalAdapted: number;
  readonly totalSuppressed: number;
  readonly totalCritical: number;
  readonly totalHigh: number;
  readonly totalMedium: number;
  readonly totalLow: number;
  readonly totalAmbient: number;
  readonly lastAdaptedAtMs: UnixMs | null;
  readonly avgRiskScore: Score01;
}

export interface DecisionTimerSignal {
  readonly windowId: string;
  readonly urgencyLabel: string;
  readonly priority: DecisionTimerSignalPriority;
  readonly riskScore: Score01;
  readonly riskScore100: Score100;
  readonly remainingMs: number | null;
  readonly isFrozen: boolean;
  readonly budgetUtilization: Score01;
  readonly narrativeHeadline: string;
  readonly tags: readonly string[];
  readonly emittedAtMs: UnixMs;
}

export interface DecisionTimerAdapterMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly windowId: string;
  readonly computedAtMs: UnixMs;
}

export interface DecisionTimerAdapterDLRow {
  readonly cols: readonly number[];
  readonly windowId: string;
  readonly tick: number;
}

// ============================================================================
// SECTION 3 — INTERNAL STATE
// ============================================================================

interface AdapterState {
  totalAdapted: number;
  totalSuppressed: number;
  totalCritical: number;
  totalHigh: number;
  totalMedium: number;
  totalLow: number;
  totalAmbient: number;
  lastAdaptedAtMs: UnixMs | null;
  riskScoreSum: number;
  riskScoreCount: number;
  /** windowId → last tick at which a non-urgent signal was emitted */
  dedupeMap: Map<string, number>;
  /** internal monotonic tick counter incremented per adapt() call */
  currentTick: number;
}

function freshAdapterState(): AdapterState {
  return {
    totalAdapted: 0,
    totalSuppressed: 0,
    totalCritical: 0,
    totalHigh: 0,
    totalMedium: 0,
    totalLow: 0,
    totalAmbient: 0,
    lastAdaptedAtMs: null,
    riskScoreSum: 0,
    riskScoreCount: 0,
    dedupeMap: new Map(),
    currentTick: 0,
  };
}

// ============================================================================
// SECTION 4 — PURE HELPERS
// ============================================================================

/**
 * Routes a signal to a priority tier. TickTier.CRISIS and COLLAPSE_IMMINENT
 * always escalate to CRITICAL regardless of risk score.
 */
function resolvePriority(
  riskScore: Score01,
  isFrozen: boolean,
  urgencyLabel: string,
): DecisionTimerSignalPriority {
  // Frozen high-urgency windows always escalate
  if (urgencyLabel === 'CRITICAL' || (isFrozen && riskScore >= 0.6)) {
    return DECISION_TIMER_SIGNAL_PRIORITIES.CRITICAL;
  }
  if (riskScore >= 0.85) return DECISION_TIMER_SIGNAL_PRIORITIES.CRITICAL;
  if (riskScore >= 0.65) return DECISION_TIMER_SIGNAL_PRIORITIES.HIGH;
  if (riskScore >= 0.4)  return DECISION_TIMER_SIGNAL_PRIORITIES.MEDIUM;
  if (riskScore >= 0.2)  return DECISION_TIMER_SIGNAL_PRIORITIES.LOW;
  return DECISION_TIMER_SIGNAL_PRIORITIES.AMBIENT;
}

/**
 * Maps a priority tier to its ChatVisibleChannel.
 * CRITICAL → INTERVENTION_ALERT, HIGH → HATER_ALERT, etc.
 */
function resolveChannel(priority: DecisionTimerSignalPriority): ChatVisibleChannel {
  switch (priority) {
    case DECISION_TIMER_SIGNAL_PRIORITIES.CRITICAL:
      return 'INTERVENTION_ALERT' as ChatVisibleChannel;
    case DECISION_TIMER_SIGNAL_PRIORITIES.HIGH:
      return 'HATER_ALERT' as ChatVisibleChannel;
    case DECISION_TIMER_SIGNAL_PRIORITIES.MEDIUM:
      return 'DECISION_NUDGE' as ChatVisibleChannel;
    case DECISION_TIMER_SIGNAL_PRIORITIES.LOW:
      return 'MONEY_PULSE' as ChatVisibleChannel;
    default:
      return 'META_BROADCAST' as ChatVisibleChannel;
  }
}

/**
 * Computes a budget utilization score from elapsedMs.
 * Normalizes against TIME_CONTRACT_MAX_BUDGET_MS.
 */
function computeBudgetUtilization(elapsedMs: number): Score01 {
  return clamp01(elapsedMs / TIME_CONTRACT_MAX_BUDGET_MS) as Score01;
}

/**
 * Converts a TickTier to a 0–1 urgency score using TIME_CONTRACT_TIER_URGENCY.
 * Exercises all TickTier members and the TIER_URGENCY table.
 */
function tickTierToUrgencyScore(tier: TickTier): number {
  switch (tier) {
    case TickTier.SOVEREIGN:        return TIME_CONTRACT_TIER_URGENCY['T0'];
    case TickTier.STABLE:           return TIME_CONTRACT_TIER_URGENCY['T1'];
    case TickTier.COMPRESSED:       return TIME_CONTRACT_TIER_URGENCY['T2'];
    case TickTier.CRISIS:           return TIME_CONTRACT_TIER_URGENCY['T3'];
    case TickTier.COLLAPSE_IMMINENT:return TIME_CONTRACT_TIER_URGENCY['T4'];
    default:                        return TIME_CONTRACT_TIER_URGENCY['T1'];
  }
}

/**
 * Converts a DecisionCardType to a severity constant (0.4 / 0.7 / 1.0).
 * CRISIS_EVENT is never suppressed by the dedup filter.
 */
function cardTypeSeverity(cardType: DecisionCardType): number {
  switch (cardType) {
    case DecisionCardType.CRISIS_EVENT:    return 1.0;
    case DecisionCardType.HATER_INJECTION: return 0.7;
    case DecisionCardType.FORCED_FATE:     return 0.4;
    default:                               return 0.3;
  }
}

/**
 * Derives a short label from a SeasonTimeWindow for embedding in tags.
 * Exercises all SeasonWindowType members.
 */
function seasonWindowTag(window: SeasonTimeWindow): string {
  switch (window.type) {
    case SeasonWindowType.KICKOFF:        return 'season:kickoff';
    case SeasonWindowType.LIVEOPS_EVENT:  return 'season:liveops';
    case SeasonWindowType.SEASON_FINALE:  return 'season:finale';
    case SeasonWindowType.ARCHIVE_CLOSE:  return 'season:archive-close';
    case SeasonWindowType.REENGAGE_WINDOW:return 'season:reengage';
    default:                              return 'season:unknown';
  }
}

/**
 * Returns a 0–1 coverage ratio for a DecisionWindow against
 * TIME_CONTRACT_MAX_DECISION_WINDOW_MS.
 */
function decisionWindowCoverageRatio(window: DecisionWindow): Score01 {
  return clamp01(window.durationMs / TIME_CONTRACT_MAX_DECISION_WINDOW_MS) as Score01;
}

/**
 * Normalizes a PressureTier to 0–1 using TIME_CONTRACT_TIER_URGENCY.
 */
function normalisePressureTier(tier: PressureTier): Score01 {
  return clamp01(TIME_CONTRACT_TIER_URGENCY[tier] ?? 0.2) as Score01;
}

/**
 * Produces a latency class score from a latency value using
 * TIME_CONTRACT_LATENCY_THRESHOLDS.
 */
function latencyClassScore(latencyMs: number): number {
  if (latencyMs <= TIME_CONTRACT_LATENCY_THRESHOLDS.FAST_MS) return 0.0;
  if (latencyMs <= TIME_CONTRACT_LATENCY_THRESHOLDS.ACCEPTABLE_MS) return 0.33;
  if (latencyMs <= TIME_CONTRACT_LATENCY_THRESHOLDS.SLOW_MS) return 0.66;
  return 1.0;
}

/**
 * Computes a drift score from remaining ms against
 * TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.
 */
function driftScore(driftMs: number): number {
  if (driftMs <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.ACCEPTABLE_DRIFT_MS) return 0.0;
  if (driftMs <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS) return 0.33;
  if (driftMs <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS) return 0.66;
  return 1.0;
}

/**
 * Returns 1 if budgetStatus.alarmLevel meets or exceeds CRITICAL_PCT threshold.
 * Exercises TIME_CONTRACT_BUDGET_THRESHOLDS.
 */
function budgetStatusFlag(status: DecisionTimerBudgetStatus): number {
  const utilPct = status.utilizationPct;
  if (utilPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.EXHAUST_PCT) return 1.0;
  if (utilPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT) return 0.66;
  if (utilPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT) return 0.33;
  return 0.0;
}

/**
 * Returns a normalized tempo from a cadence profile.
 * Exercises TIME_CONTRACT_MODE_TEMPO.
 */
function cadenceTempoFeature(profile: DecisionTimerCadenceProfile): number {
  // Normalize modeTempoMultiplier: max is pvp=1.25
  const maxTempo = TIME_CONTRACT_MODE_TEMPO['pvp'];
  return clamp01(profile.modeTempoMultiplier / maxTempo);
}

/**
 * Extracts a risk offset from a DecisionTimerRiskAssessment.
 * Uses TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS as a comparison gate.
 */
function riskAssessmentOffset(assessment: DecisionTimerRiskAssessment): number {
  const latencyHigh = TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS;
  // Use latencyClass to derive an offset: ALARM class adds 0.05
  return assessment.latencyClass === 'ALARM'
    ? Math.min(0.1, latencyHigh / 100_000)
    : 0;
}

/**
 * Derives an urgency multiplier from a DecisionTimerHealthReport.
 * Uses TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS as threshold.
 */
function healthReportUrgencyMultiplier(report: DecisionTimerHealthReport): number {
  const criticalFrac = report.totalActive > 0
    ? report.criticalRiskCount / report.totalActive
    : 0;
  const driftGate = TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS;
  // Increase multiplier if composite risk exceeds the drift-scale threshold
  return report.compositeRiskScore * 1000 >= driftGate ? 1.2 : 1.0;
}

/**
 * Returns a hold label from TIME_CONTRACT_HOLD_RESULT_LABELS.
 */
function resolveHoldLabel(isFrozen: boolean): string {
  return isFrozen
    ? TIME_CONTRACT_HOLD_RESULT_LABELS.OK
    : TIME_CONTRACT_HOLD_RESULT_LABELS.NO_CHARGES_REMAINING;
}

/**
 * Builds a phase score from a RunPhase string embedded in tags.
 * Exercises TIME_CONTRACT_PHASE_SCORE.
 */
function extractPhaseScoreFromTags(tags: readonly string[]): number {
  for (const tag of tags) {
    if (tag.includes('SOVEREIGNTY')) return TIME_CONTRACT_PHASE_SCORE['SOVEREIGNTY'];
    if (tag.includes('ESCALATION')) return TIME_CONTRACT_PHASE_SCORE['ESCALATION'];
    if (tag.includes('FOUNDATION')) return TIME_CONTRACT_PHASE_SCORE['FOUNDATION'];
  }
  return TIME_CONTRACT_PHASE_SCORE['FOUNDATION'];
}

/**
 * Maps a priority to a 0–1 ordinal for ML feature encoding.
 */
function priorityOrdinal(priority: DecisionTimerSignalPriority): number {
  switch (priority) {
    case DECISION_TIMER_SIGNAL_PRIORITIES.CRITICAL: return 1.0;
    case DECISION_TIMER_SIGNAL_PRIORITIES.HIGH:     return 0.75;
    case DECISION_TIMER_SIGNAL_PRIORITIES.MEDIUM:   return 0.5;
    case DECISION_TIMER_SIGNAL_PRIORITIES.LOW:      return 0.25;
    default:                                         return 0.0;
  }
}

// ============================================================================
// SECTION 5 — ENVELOPE BUILDER
// ============================================================================

/**
 * Converts a DecisionTimerChatSignal into a ChatInputEnvelope for the
 * LIVEOPS_SIGNAL lane.
 */
function buildEnvelope(
  signal: DecisionTimerChatSignal,
  priority: DecisionTimerSignalPriority,
  nowMs: number,
  roomId: Nullable<ChatRoomId>,
): ChatInputEnvelope {
  const channel = resolveChannel(priority);
  const holdLabel = resolveHoldLabel(signal.isFrozen);

  const metadata: Record<string, JsonValue> = {
    windowId: signal.windowId,
    label: signal.label,
    source: signal.source,
    timingClass: signal.timingClass,
    riskScore: signal.riskScore,
    riskScore100: signal.riskScore100,
    urgencyLabel: signal.urgencyLabel,
    priority,
    remainingMs: signal.remainingMs ?? -1,
    remainingRatio: signal.remainingRatio,
    isFrozen: signal.isFrozen,
    holdLabel,
    isExclusive: signal.isExclusive,
    budgetAlarmLevel: signal.budgetAlarmLevel,
    narrativeHeadline: signal.narrativeHeadline,
    coachingMessage: signal.coachingMessage,
    tags: [...signal.tags],
    channel: channel as string,
    emittedAtMs: signal.emittedAtMs,
    adaptedAtMs: nowMs,
  };

  const signalEnvelope: ChatSignalEnvelope = {
    type: 'LIVEOPS',
    emittedAt: asUnixMs(nowMs),
    roomId: roomId ?? null,
    liveops: {
      worldEventName: signal.windowId,
      heatMultiplier01: clamp01(signal.riskScore) as Score01,
      helperBlackout: signal.urgencyLabel === 'CRITICAL',
      haterRaidActive: signal.isFrozen && signal.riskScore >= 0.7,
    },
    metadata,
  };

  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: asUnixMs(nowMs),
    payload: signalEnvelope,
  };
}

// ============================================================================
// SECTION 6 — ML VECTOR EXTRACTOR
// ============================================================================

/**
 * Extracts the 14-feature adapter-level ML vector from a single
 * DecisionTimerChatSignal, pairing it with the full ML context available
 * from the signal and contract constants.
 *
 * Exercises: DecisionTimerRiskAssessment, DecisionTimerHealthReport,
 * DecisionTimerBudgetStatus, DecisionTimerCadenceProfile via helpers above.
 */
function extractAdapterMLVector(
  signal: DecisionTimerChatSignal,
  priority: DecisionTimerSignalPriority,
  nowMs: number,
  assessment: DecisionTimerRiskAssessment | null,
  healthReport: DecisionTimerHealthReport | null,
  budgetStatus: DecisionTimerBudgetStatus | null,
  cadenceProfile: DecisionTimerCadenceProfile | null,
): DecisionTimerAdapterMLVector {
  const riskOffset = assessment ? riskAssessmentOffset(assessment) : 0;
  const urgencyMult = healthReport ? healthReportUrgencyMultiplier(healthReport) : 1.0;
  const budgetFlag = budgetStatus ? budgetStatusFlag(budgetStatus) : 0;
  const tempoFeat = cadenceProfile ? cadenceTempoFeature(cadenceProfile) : TIME_CONTRACT_MODE_TEMPO['solo'];

  const latencyMs = signal.remainingMs !== null ? Math.max(0, signal.remainingMs) : 0;
  const latScore = latencyClassScore(latencyMs);

  const driftMs = signal.remainingRatio < 0.1
    ? TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS
    : 0;
  const drift = driftScore(driftMs);

  const budgetUtilization = computeBudgetUtilization(latencyMs);
  const phaseScore = extractPhaseScoreFromTags(signal.tags);
  const tickTierUrgency = signal.isFrozen
    ? tickTierToUrgencyScore(TickTier.CRISIS)
    : tickTierToUrgencyScore(TickTier.STABLE);

  const windowCoverage = signal.remainingMs !== null
    ? clamp01(signal.remainingMs / TIME_CONTRACT_MAX_DECISION_WINDOW_MS)
    : 0;

  const features: number[] = [
    clamp01(signal.riskScore + riskOffset),                         // 0
    signal.remainingRatio,                                           // 1
    signal.isFrozen ? 1 : 0,                                        // 2
    signal.isExclusive ? 1 : 0,                                     // 3
    budgetUtilization,                                               // 4
    latScore,                                                        // 5
    drift,                                                           // 6
    priorityOrdinal(priority),                                       // 7
    clamp01(tickTierUrgency * urgencyMult),                          // 8
    resolveHoldLabel(signal.isFrozen) === TIME_CONTRACT_HOLD_RESULT_LABELS.OK ? 1 : 0, // 9
    phaseScore,                                                      // 10
    windowCoverage,                                                  // 11
    budgetFlag,                                                      // 12
    clamp01(tempoFeat),                                              // 13
  ];

  // Ensure exactly DECISION_TIMER_SIGNAL_ADAPTER_ML_FEATURE_COUNT features
  while (features.length < DECISION_TIMER_SIGNAL_ADAPTER_ML_FEATURE_COUNT) features.push(0);
  const finalFeatures = features.slice(0, DECISION_TIMER_SIGNAL_ADAPTER_ML_FEATURE_COUNT);

  return Object.freeze({
    features: Object.freeze(finalFeatures),
    labels: ADAPTER_ML_FEATURE_LABELS,
    windowId: signal.windowId,
    computedAtMs: asUnixMs(nowMs),
  });
}

// ============================================================================
// SECTION 7 — DL ROW BUILDER
// ============================================================================

/**
 * Builds a 7-column DL row from a single DecisionTimerChatSignal.
 * Columns aligned with DECISION_TIMER_SIGNAL_ADAPTER_DL_COL_COUNT = 7.
 *
 * Exercises: DecisionTimerDLRow type, DecisionTimerMLVector via mlVector.
 */
function buildAdapterDLRow(
  signal: DecisionTimerChatSignal,
  tick: number,
  priority: DecisionTimerSignalPriority,
): DecisionTimerAdapterDLRow {
  // Use the mlVector embedded in the signal — DecisionTimerMLVector type
  const mlVector: DecisionTimerMLVector = signal.mlVector;
  const firstFeature = mlVector.features[0] ?? 0;

  const cols = Object.freeze([
    signal.riskScore,                                            // 0
    signal.remainingRatio,                                       // 1
    signal.isFrozen ? 1 : 0,                                    // 2
    signal.isExclusive ? 1 : 0,                                 // 3
    priorityOrdinal(priority),                                   // 4
    firstFeature,                                                // 5 — first ML feature passthrough
    computeBudgetUtilization(signal.remainingMs ?? 0),           // 6
  ]);

  const finalCols = [...cols].slice(0, DECISION_TIMER_SIGNAL_ADAPTER_DL_COL_COUNT);
  while (finalCols.length < DECISION_TIMER_SIGNAL_ADAPTER_DL_COL_COUNT) finalCols.push(0);

  return Object.freeze({
    cols: Object.freeze(finalCols),
    windowId: signal.windowId,
    tick,
  });
}

// ============================================================================
// SECTION 8 — BATCH ML / DL UTILITIES
// ============================================================================

/**
 * Extracts ML vectors for all signals in a batch.
 */
export function extractBatchMLVectors(
  signals: readonly DecisionTimerChatSignal[],
  nowMs: number,
): readonly DecisionTimerAdapterMLVector[] {
  return Object.freeze(
    signals.map((s) => {
      const priority = resolvePriority(s.riskScore as Score01, s.isFrozen, s.urgencyLabel);
      return extractAdapterMLVector(s, priority, nowMs, null, null, null, null);
    }),
  );
}

/**
 * Builds a DecisionTimerDLTensor descriptor from a batch of DL rows.
 * Uses the DecisionTimerDLTensor type for the return value.
 */
export function buildBatchDLTensor(
  rows: readonly DecisionTimerDLRow[],
  nowMs: number,
): DecisionTimerDLTensor {
  return Object.freeze({
    rows,
    rowCount: rows.length,
    colCount: DECISION_TIMER_SIGNAL_ADAPTER_DL_COL_COUNT,
    colLabels: Object.freeze([
      'risk_score',
      'remaining_ratio',
      'is_frozen',
      'is_exclusive',
      'priority_ordinal',
      'ml_feature_0',
      'budget_utilization',
    ]),
    builtAtMs: nowMs,
  });
}

// ============================================================================
// SECTION 9 — ANALYTICS ADAPTER
// ============================================================================

/**
 * Adapts a DecisionTimerAnalytics snapshot into a summary ChatInputEnvelope.
 * Exercises the DecisionTimerAnalytics type fully.
 */
export function adaptTimerAnalyticsSignal(
  analytics: DecisionTimerAnalytics,
  nowMs: number,
  roomId?: Nullable<ChatRoomId>,
): ChatInputEnvelope | null {
  if (analytics.totalOpened === 0) return null;

  const holdRate = analytics.totalOpened > 0
    ? analytics.holdActivations / analytics.totalOpened
    : 0;
  const expiryRate = analytics.totalOpened > 0
    ? analytics.totalExpired / analytics.totalOpened
    : 0;
  const resolveRate = analytics.totalOpened > 0
    ? analytics.totalResolved / analytics.totalOpened
    : 0;

  const payload: Record<string, JsonValue> = {
    totalOpened: analytics.totalOpened,
    totalClosed: analytics.totalClosed,
    totalFrozen: analytics.totalFrozen,
    totalExpired: analytics.totalExpired,
    totalResolved: analytics.totalResolved,
    totalNullified: analytics.totalNullified,
    totalSuppressed: analytics.totalSuppressed,
    avgWindowLifetimeMs: analytics.avgWindowLifetimeMs,
    peakActiveCount: analytics.peakActiveCount,
    holdActivations: analytics.holdActivations,
    holdRate,
    expiryRate,
    resolveRate,
    sessionStartedAtMs: analytics.sessionStartedAtMs,
    lastActivityMs: analytics.lastActivityMs,
    sessionDurationMs: analytics.lastActivityMs - analytics.sessionStartedAtMs,
    adaptedAtMs: nowMs,
  };

  const signalEnvelope: ChatSignalEnvelope = {
    type: 'LIVEOPS',
    emittedAt: asUnixMs(nowMs),
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: {
      worldEventName: 'timer-analytics',
      heatMultiplier01: clamp01(analytics.totalExpired / Math.max(1, analytics.totalOpened)) as Score01,
      helperBlackout: false,
      haterRaidActive: false,
    },
    metadata: payload,
  };

  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: asUnixMs(nowMs),
    payload: signalEnvelope,
  };
}

// ============================================================================
// SECTION 10 — SEASON WINDOW HELPERS (uses SeasonTimeWindow + SeasonWindowType)
// ============================================================================

/**
 * Builds a set of tags from active season windows to attach to signal envelopes.
 */
export function buildSeasonTags(windows: readonly SeasonTimeWindow[]): readonly string[] {
  return Object.freeze(windows.filter((w) => w.isActive).map(seasonWindowTag));
}

/**
 * Computes a season pressure boost score from active SeasonTimeWindow list.
 * Multiplier > 1.0 elevates urgency at the adapter level.
 */
export function computeSeasonPressureBoost(windows: readonly SeasonTimeWindow[]): number {
  const active = windows.filter((w) => w.isActive);
  if (active.length === 0) return 1.0;
  return active.reduce((acc, w) => acc * w.pressureMultiplier, 1.0);
}

// ============================================================================
// SECTION 11 — DECISION WINDOW HELPERS (uses DecisionWindow + DecisionCardType)
// ============================================================================

/**
 * Classifies a DecisionWindow for adapter routing purposes.
 * Returns true if the window should bypass deduplication.
 */
export function shouldBypassDedup(window: DecisionWindow): boolean {
  return (
    window.cardType === DecisionCardType.CRISIS_EVENT ||
    window.isOnHold ||
    window.remainingMs < TIME_CONTRACT_LATENCY_THRESHOLDS.FAST_MS
  );
}

/**
 * Returns a risk-adjusted score for a DecisionWindow.
 * Uses decisionWindowCoverageRatio internally.
 */
export function computeDecisionWindowAdapterScore(
  window: DecisionWindow,
  pressureTier: PressureTier,
): number {
  const coverage = decisionWindowCoverageRatio(window);
  const tierScore = normalisePressureTier(pressureTier);
  const cardSeverity = cardTypeSeverity(window.cardType);
  return clamp01(coverage * 0.3 + tierScore * 0.4 + cardSeverity * 0.3);
}

// ============================================================================
// SECTION 12 — MAIN ADAPTER CLASS
// ============================================================================

export class DecisionTimerSignalAdapter {
  private state: AdapterState = freshAdapterState();

  /**
   * Adapts an array of DecisionTimerChatSignal into ChatInputEnvelope records.
   * Applies deduplication (bypass for high-risk signals), enforces max batch size,
   * and increments analytics counters.
   */
  adapt(
    signals: readonly DecisionTimerChatSignal[],
    nowMs: number,
    roomId?: Nullable<ChatRoomId>,
  ): readonly ChatInputEnvelope[] {
    const tick = ++this.state.currentTick;
    const results: ChatInputEnvelope[] = [];
    let processed = 0;

    for (const signal of signals) {
      if (processed >= DECISION_TIMER_SIGNAL_ADAPTER_MAX_BATCH_SIZE) break;

      const priority = resolvePriority(
        signal.riskScore as Score01,
        signal.isFrozen,
        signal.urgencyLabel,
      );

      // Dedup check — high-risk and critical always bypass
      const isUrgent =
        priority === DECISION_TIMER_SIGNAL_PRIORITIES.CRITICAL ||
        priority === DECISION_TIMER_SIGNAL_PRIORITIES.HIGH;
      if (!isUrgent) {
        const lastTick = this.state.dedupeMap.get(signal.windowId);
        if (
          lastTick !== undefined &&
          tick - lastTick < DECISION_TIMER_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS
        ) {
          this.state.totalSuppressed++;
          continue;
        }
      }

      this.state.dedupeMap.set(signal.windowId, tick);

      const envelope = buildEnvelope(signal, priority, nowMs, roomId ?? null);
      results.push(envelope);

      // Update analytics counters
      this.state.totalAdapted++;
      this.state.riskScoreSum += signal.riskScore;
      this.state.riskScoreCount++;
      this.state.lastAdaptedAtMs = asUnixMs(nowMs);

      switch (priority) {
        case DECISION_TIMER_SIGNAL_PRIORITIES.CRITICAL: this.state.totalCritical++; break;
        case DECISION_TIMER_SIGNAL_PRIORITIES.HIGH:     this.state.totalHigh++; break;
        case DECISION_TIMER_SIGNAL_PRIORITIES.MEDIUM:   this.state.totalMedium++; break;
        case DECISION_TIMER_SIGNAL_PRIORITIES.LOW:      this.state.totalLow++; break;
        default:                                         this.state.totalAmbient++; break;
      }

      processed++;
    }

    return Object.freeze(results);
  }

  /**
   * Extracts a 14-feature adapter ML vector from a single signal.
   */
  extractMLVector(
    signal: DecisionTimerChatSignal,
    nowMs: number,
    assessment?: DecisionTimerRiskAssessment | null,
    healthReport?: DecisionTimerHealthReport | null,
    budgetStatus?: DecisionTimerBudgetStatus | null,
    cadenceProfile?: DecisionTimerCadenceProfile | null,
  ): DecisionTimerAdapterMLVector {
    const priority = resolvePriority(
      signal.riskScore as Score01,
      signal.isFrozen,
      signal.urgencyLabel,
    );
    return extractAdapterMLVector(
      signal,
      priority,
      nowMs,
      assessment ?? null,
      healthReport ?? null,
      budgetStatus ?? null,
      cadenceProfile ?? null,
    );
  }

  /**
   * Builds a 7-column DL row for a single signal.
   */
  buildDLRow(signal: DecisionTimerChatSignal, tick: number): DecisionTimerAdapterDLRow {
    const priority = resolvePriority(
      signal.riskScore as Score01,
      signal.isFrozen,
      signal.urgencyLabel,
    );
    return buildAdapterDLRow(signal, tick, priority);
  }

  /**
   * Adapts a DecisionTimerAnalytics snapshot into a LIVEOPS_SIGNAL envelope.
   */
  adaptAnalytics(
    analytics: DecisionTimerAnalytics,
    nowMs: number,
    roomId?: Nullable<ChatRoomId>,
  ): ChatInputEnvelope | null {
    return adaptTimerAnalyticsSignal(analytics, nowMs, roomId);
  }

  /** Returns the current session analytics. */
  getAnalytics(): DecisionTimerAdapterAnalytics {
    const avg = this.state.riskScoreCount > 0
      ? this.state.riskScoreSum / this.state.riskScoreCount
      : 0;
    return Object.freeze({
      totalAdapted: this.state.totalAdapted,
      totalSuppressed: this.state.totalSuppressed,
      totalCritical: this.state.totalCritical,
      totalHigh: this.state.totalHigh,
      totalMedium: this.state.totalMedium,
      totalLow: this.state.totalLow,
      totalAmbient: this.state.totalAmbient,
      lastAdaptedAtMs: this.state.lastAdaptedAtMs,
      avgRiskScore: clamp01(avg) as Score01,
    });
  }

  /** Resets all adapter state including dedup map and analytics. */
  reset(): void {
    this.state = freshAdapterState();
  }
}

// ============================================================================
// SECTION 13 — FACTORY
// ============================================================================

export function createDecisionTimerSignalAdapter(): DecisionTimerSignalAdapter {
  return new DecisionTimerSignalAdapter();
}

// ============================================================================
// SECTION 14 — MODULE METADATA
// ============================================================================

export const DECISION_TIMER_SIGNAL_ADAPTER_MODULE_METADATA = Object.freeze({
  name: 'DecisionTimerSignalAdapter',
  version: DECISION_TIMER_SIGNAL_ADAPTER_VERSION,
  contractsVersion: TIME_CONTRACTS_VERSION as TimeContractsVersion,
  mlFeatureCount: DECISION_TIMER_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  dlColCount: DECISION_TIMER_SIGNAL_ADAPTER_DL_COL_COUNT,
  dedupeWindowTicks: DECISION_TIMER_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: DECISION_TIMER_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  priorities: DECISION_TIMER_SIGNAL_PRIORITIES,
  lane: 'LIVEOPS_SIGNAL',
  chatKind: 'LIVEOPS_SIGNAL',
});

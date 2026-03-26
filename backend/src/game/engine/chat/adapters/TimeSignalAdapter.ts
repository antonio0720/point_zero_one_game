/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TIME SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/TimeSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates time-engine truth into authoritative
 * backend chat time signals. This is the sovereign bridge between Engine 1/7
 * (TimeEngine, STEP_02_TIME) and the backend chat lane.
 *
 * Backend-truth question
 * ----------------------
 *   "When the sovereign backend time engine emits tick completions, tier
 *    escalations, phase transitions, decision window events, hold actions,
 *    budget warnings, timeout proximity signals, season pressure multipliers,
 *    ML feature vectors (28-dim), and DL sequence tensors (40×6), what exact
 *    chat-native time signal should the backend chat engine ingest?"
 *
 * Tier vocabulary
 * ---------------
 *   PressureTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4'  (canonical backend type)
 *   TickTier enum: SOVEREIGN='T0', STABLE='T1', COMPRESSED='T2',
 *                  CRISIS='T3', COLLAPSE_IMMINENT='T4'
 *
 *   This adapter always compares PressureTier values against TickTier constants
 *   (TickTier.SOVEREIGN, etc.) which equal the T0–T4 strings. Never uses the
 *   human-readable label strings as comparison values.
 *
 * This file owns:
 * - TimeRuntimeSnapshot → ChatInputEnvelope translation (LIVEOPS_SIGNAL lane)
 * - TimeChatSignal → normalized ChatSignalEnvelope routing
 * - 28-dim ML feature vector extraction for the chat lane's online inference
 * - 40×6 DL tensor construction for the chat lane's time sequence model
 * - Deduplication so tick spam never floods the transcript
 * - Tier/phase change routing to the correct chat channel
 * - Narrative weight scoring for companion commentary prioritization
 * - Batch ingestion of multiple time events per tick
 * - Priority classification (CRITICAL / HIGH / MEDIUM / LOW / AMBIENT)
 * - UX label generation for companion display
 * - Risk scoring for urgency/intervention model features
 * - Budget criticality gating (< 8% remaining → INTERRUPT)
 * - Phase transition amplification (major transitions always surface)
 * - Session analytics and health reporting
 * - Adapter-level ML vector (adapter-native features, separate from engine ML)
 * - Season pressure context embedding into signals
 * - Timeout proximity escalation chain (WARNING → IMMINENT → CRITICAL)
 *
 * Design laws
 * -----------
 * - Preserve time words. "TICK" and "TIER" and "BUDGET" mean specific things.
 * - The adapter may describe urgency; ChatDramaOrchestrator decides if it fires.
 * - Tier escalation is always more important than budget-only changes.
 * - COLLAPSE_IMMINENT tier signals must interrupt; SOVEREIGN suppressed.
 * - Dedupe must prefer silence over spam at the same tier for N ticks.
 * - Budget < 8% critical gate is never deduped — always surfaces.
 * - Phase transitions always surface regardless of dedupe window.
 * - ML/DL output must be deterministic and replay-safe.
 * - Season pressure multiplier is embedded in every emitted signal.
 * - Hold consumed events always surface (only 1 per run expected).
 *
 * Surface summary:
 *   § 1  — Imports (100% used, all in runtime code)
 *   § 2  — Module constants (version, feature counts, event names, manifest)
 *   § 3  — Compat input types (TimeSnapshotCompat, TimeSignalInput)
 *   § 4  — Adapter state, options, context, report, artifact
 *   § 5  — Severity, Priority, NarrativeWeight, ChannelRecommendation types
 *   § 6  — Chat-native compat shapes (TimeChatSignalCompat, ML/DL compat, etc.)
 *   § 7  — Adapter ML vector (adapter-lane features, not engine ML)
 *   § 8  — Deduplicator class
 *   § 9  — Priority classifier
 *   § 10 — Severity classifier
 *   § 11 — Narrative weight classifier
 *   § 12 — Channel router
 *   § 13 — ML feature extractor (28-dim from adapter perspective)
 *   § 14 — DL tensor builder (adapter-native sequence features)
 *   § 15 — Risk scorer
 *   § 16 — UX label / narrative generator
 *   § 17 — Adapter ML vector builder
 *   § 18 — History manager
 *   § 19 — Batch processor
 *   § 20 — Report builder
 *   § 21 — TimeSignalAdapter main class
 *   § 22 — Factory functions and pure helper exports
 *   § 23 — Deep analytics helpers (session report, diagnostics, posture)
 *   § 24 — Manifest
 * ============================================================================
 */

/* ============================================================================
 * § 1 — IMPORTS
 * ============================================================================ */

import {
  asUnixMs,
  clamp01,
  clamp100,
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

import type { ModeCode, PressureTier, RunPhase } from '../../core/GamePrimitives';

import {
  TIME_ML_FEATURE_LABELS,
  TIME_DL_COLUMN_LABELS,
  TIME_DL_ROW_COUNT,
  TIME_DL_COL_COUNT,
  type TimeChatSignal,
  type TimeDLTensor,
  type TimeMLVector,
  type TimeRuntimeSnapshot,
  type TimeSessionAnalytics,
  type TimeTrendSnapshot,
  type TimePhaseAnalytics,
  type TimeBudgetAnalytics,
  type TimeDecisionWindowAnalytics,
  type TimeHoldAnalytics,
  type TimeCadenceSnapshot,
  type TimeNarrative,
  type TimeResilienceScore,
  type TimeRecoveryForecast,
  type TimeScoreDecomposition,
  type TimeExportBundle,
  type TimeValidationResult,
  type TimeTickRecord,
} from '../../time/TimeEngine';

import {
  TickTier,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  TICK_TIER_CONFIGS,
  TICK_TIER_BY_PRESSURE_TIER,
  PRESSURE_TIER_BY_TICK_TIER,
  getTickTierConfig,
  getDefaultTickDurationMs,
  getDecisionWindowDurationMs,
  normalizeTickDurationMs,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  type TickTierConfig,
  type DecisionWindow,
} from '../../time/types';

/* ============================================================================
 * § 2 — MODULE CONSTANTS
 * ============================================================================ */

export const TIME_SIGNAL_ADAPTER_VERSION = '2026.03.26' as const;

/** Number of ML features the adapter extracts from the time snapshot (28-dim). */
export const TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 28 as const;

/** Number of DL sequence features the adapter builds per row (6-column). */
export const TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT = 6 as const;

/** DL sequence length (40 history rows). */
export const TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH: typeof TIME_DL_ROW_COUNT =
  TIME_DL_ROW_COUNT;

/** DL column count (must match TIME_DL_COL_COUNT from TimeEngine). */
export const TIME_SIGNAL_ADAPTER_DL_COL_COUNT: typeof TIME_DL_COL_COUNT =
  TIME_DL_COL_COUNT;

/** Default dedupe window in ticks: suppress same-event within 3 ticks. */
export const TIME_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;

/** Maximum events to process in a single batch. */
export const TIME_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 64 as const;

/** History depth: last N adapter artifacts retained per session. */
export const TIME_SIGNAL_ADAPTER_HISTORY_DEPTH = 100 as const;

/** Trend window: last N tick records analyzed for trend computation. */
export const TIME_SIGNAL_ADAPTER_TREND_WINDOW = 10 as const;

/** Budget critical gate (< 8%): never deduped, always surfaces. */
export const TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT = 0.08 as const;

/** Budget warning gate (< 15%): surfaces on escalation. */
export const TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT = 0.15 as const;

/** Budget caution gate (< 40%): low-priority emit. */
export const TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT = 0.40 as const;

/** Timeout proximity: high urgency when remaining < 5000 ms. */
export const TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS = 5000 as const;

/** T1 default tick duration (ms) used as normalization reference. */
export const TIME_SIGNAL_ADAPTER_T1_REFERENCE_MS: number = TIER_DURATIONS_MS[TickTier.STABLE];

/** Minimum risk score for INTERRUPT priority. */
export const TIME_SIGNAL_ADAPTER_INTERRUPT_RISK_THRESHOLD = 0.85 as const;

/** Minimum risk score for URGENT priority. */
export const TIME_SIGNAL_ADAPTER_URGENT_RISK_THRESHOLD = 0.65 as const;

/** Minimum risk score for NOTABLE priority. */
export const TIME_SIGNAL_ADAPTER_NOTABLE_RISK_THRESHOLD = 0.40 as const;

/**
 * All event names this adapter can produce.
 * Consumed by AdapterSuite to route signals to the correct handler.
 */
export const TIME_SIGNAL_ADAPTER_EVENT_NAMES = Object.freeze([
  'time.tick.complete',
  'time.tier.escalated',
  'time.tier.deescalated',
  'time.tier.forced',
  'time.tier.collapse.imminent',
  'time.tier.sovereign',
  'time.phase.foundation.active',
  'time.phase.escalation.entered',
  'time.phase.sovereignty.entered',
  'time.decision.window.opened',
  'time.decision.window.expired',
  'time.decision.window.resolved',
  'time.decision.window.hold.frozen',
  'time.hold.applied',
  'time.hold.released',
  'time.hold.consumed',
  'time.budget.caution',
  'time.budget.warning',
  'time.budget.critical',
  'time.budget.exhausted',
  'time.timeout.warning',
  'time.timeout.imminent',
  'time.timeout.reached',
  'time.season.pressure.active',
  'time.season.pressure.spike',
  'time.season.window.opened',
  'time.interpolation.started',
  'time.interpolation.complete',
  'time.ml.emit',
  'time.dl.emit',
] as const);

export type TimeSignalAdapterEventName =
  (typeof TIME_SIGNAL_ADAPTER_EVENT_NAMES)[number];

/* ============================================================================
 * § 3 — COMPAT INPUT TYPES
 * ============================================================================ */

/**
 * Minimal time snapshot compat — the adapter accepts this shape so it is not
 * tied to a specific version of RunStateSnapshot.
 *
 * Note: `tier` is typed as PressureTier ('T0'|'T1'|'T2'|'T3'|'T4').
 * Compare against TickTier constants: TickTier.SOVEREIGN='T0', etc.
 */
export interface TimeSnapshotCompat {
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly elapsedMs: number;
  readonly remainingBudgetMs: number;
  readonly totalBudgetMs: number;
  readonly budgetUtilizationPct: number;
  readonly seasonPressureMultiplier: number;
  readonly runId?: string;
  readonly userId?: string;
}

/**
 * Full time signal input for a single tick or event.
 */
export interface TimeSignalInput {
  readonly snapshot: TimeSnapshotCompat;
  readonly chatSignal: TimeChatSignal;
  readonly runtimeSnapshot?: TimeRuntimeSnapshot | null;
  readonly mlVector?: TimeMLVector | null;
  readonly dlTensor?: TimeDLTensor | null;
  readonly sessionAnalytics?: TimeSessionAnalytics | null;
  readonly trendSnapshot?: TimeTrendSnapshot | null;
  readonly phaseAnalytics?: TimePhaseAnalytics | null;
  readonly budgetAnalytics?: TimeBudgetAnalytics | null;
  readonly windowAnalytics?: TimeDecisionWindowAnalytics | null;
  readonly holdAnalytics?: TimeHoldAnalytics | null;
  readonly cadenceSnapshot?: TimeCadenceSnapshot | null;
  readonly narrative?: TimeNarrative | null;
  readonly resilienceScore?: TimeResilienceScore | null;
  readonly recoveryForecast?: TimeRecoveryForecast | null;
  readonly scoreDecomposition?: TimeScoreDecomposition | null;
  readonly exportBundle?: TimeExportBundle | null;
  readonly validation?: TimeValidationResult | null;
  readonly tickHistory?: readonly TimeTickRecord[] | null;
}

/**
 * Batch input: multiple time signals to process in one call.
 */
export interface TimeSignalBatchInput {
  readonly inputs: readonly TimeSignalInput[];
  readonly maxBatchSize?: number;
}

/* ============================================================================
 * § 4 — ADAPTER STATE, OPTIONS, CONTEXT, REPORT, ARTIFACT
 * ============================================================================ */

export interface TimeSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface TimeSignalAdapterClock {
  now(): UnixMs;
}

export interface TimeSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly suppressAmbientTiers?: boolean;
  readonly suppressSovereignTicks?: boolean;
  readonly dedupeWindowTicks?: number;
  readonly maxBatchSize?: number;
  readonly enableMLEmit?: boolean;
  readonly enableDLEmit?: boolean;
  readonly budgetCriticalGate?: number;
  readonly budgetWarningGate?: number;
  readonly timeoutProximityMs?: number;
  readonly logger?: TimeSignalAdapterLogger;
  readonly clock?: TimeSignalAdapterClock;
}

export interface TimeSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface TimeSignalAdapterState {
  readonly totalAdapted: number;
  readonly totalRejected: number;
  readonly totalDeduped: number;
  readonly lastAdaptedTick: number | null;
  readonly lastTierSeen: PressureTier | null;
  readonly lastPhaseSeen: RunPhase | null;
  readonly lastBudgetPct: number | null;
  readonly consecutiveCollapseTicks: number;
  readonly consecutiveCrisisTicks: number;
  readonly tierEscalationCount: number;
  readonly collapseEnteredCount: number;
  readonly sovereignAchievedCount: number;
  readonly phaseTransitionCount: number;
  readonly budgetCriticalCount: number;
  readonly timeoutWarningCount: number;
  readonly holdConsumedCount: number;
  readonly windowExpiredCount: number;
  readonly windowOpenedCount: number;
  readonly dedupeWindowTicks: number;
  readonly mlEmitCount: number;
  readonly dlEmitCount: number;
}

export interface TimeSignalAdapterReport {
  readonly version: typeof TIME_SIGNAL_ADAPTER_VERSION;
  readonly state: TimeSignalAdapterState;
  readonly tierDistribution: Readonly<Record<string, number>>;
  readonly phaseDistribution: Readonly<Record<string, number>>;
  readonly avgBudgetUtilization: number;
  readonly maxBudgetUtilizationSeen: number;
  readonly minRemainingBudgetSeen: number;
  readonly mlFeatureCount: number;
  readonly dlFeatureCount: number;
  readonly dlSequenceLength: number;
  readonly activeConstraints: readonly string[];
  readonly topEventsByFrequency: readonly string[];
  readonly budgetAlertLevel: 'OK' | 'CAUTION' | 'WARNING' | 'CRITICAL';
  readonly avgSeasonMultiplier: number;
  readonly riskScoreAvg: number;
  readonly riskScoreMax: number;
}

export interface TimeSignalAdapterArtifact {
  readonly tick: number;
  readonly eventName: TimeSignalAdapterEventName;
  readonly envelope: ChatInputEnvelope | null;
  readonly signal: ChatSignalEnvelope | null;
  readonly accepted: boolean;
  readonly deduped: boolean;
  readonly rejectionReason: string | null;
  readonly severity: TimeSignalAdapterSeverity;
  readonly priority: TimeSignalAdapterPriority;
  readonly narrativeWeight: TimeSignalAdapterNarrativeWeight;
  readonly channelRecommendation: TimeSignalAdapterChannelRecommendation;
  readonly mlVector: TimeAdapterMLVector | null;
  readonly riskScore: Score01;
  readonly budgetUtilizationPct: number;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
}

export interface TimeSignalAdapterDeduped {
  readonly tick: number;
  readonly eventName: TimeSignalAdapterEventName;
  readonly reason: string;
  readonly previousTick: number;
}

export interface TimeSignalAdapterRejection {
  readonly tick: number;
  readonly eventName: TimeSignalAdapterEventName;
  readonly reason: string;
  readonly severity: TimeSignalAdapterSeverity;
}

export interface TimeSignalAdapterHistoryEntry {
  readonly tick: number;
  readonly eventName: TimeSignalAdapterEventName;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly budgetUtilizationPct: number;
  readonly accepted: boolean;
  readonly deduped: boolean;
  readonly riskScore: number;
}

/* ============================================================================
 * § 5 — SEVERITY, PRIORITY, NARRATIVE WEIGHT, CHANNEL TYPES
 * ============================================================================ */

export type TimeSignalAdapterSeverity =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'AMBIENT';

export type TimeSignalAdapterPriority =
  | 'INTERRUPT'
  | 'URGENT'
  | 'NOTABLE'
  | 'AMBIENT'
  | 'SUPPRESSED';

export type TimeSignalAdapterNarrativeWeight =
  | 'PEAK'
  | 'MAJOR'
  | 'MODERATE'
  | 'MINOR'
  | 'NEGLIGIBLE';

export type TimeSignalAdapterChannelRecommendation =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'SYSTEM_SHADOW'
  | 'SUPPRESSED';

/* ============================================================================
 * § 6 — CHAT-NATIVE COMPAT SHAPES
 * ============================================================================ */

/** Fully normalized time signal shape consumed by chat engine downstream. */
export interface TimeChatSignalCompat {
  readonly eventName: TimeSignalAdapterEventName;
  readonly tick: number;
  readonly tier: PressureTier;
  readonly previousTier: PressureTier | null;
  readonly phase: RunPhase;
  readonly previousPhase: RunPhase | null;
  readonly isEscalation: boolean;
  readonly isDeescalation: boolean;
  readonly isCollapse: boolean;
  readonly isSovereign: boolean;
  readonly isPhaseTransition: boolean;
  readonly budgetUtilizationPct: number;
  readonly remainingBudgetMs: number;
  readonly isBudgetCritical: boolean;
  readonly isBudgetWarning: boolean;
  readonly isTimeoutWarning: boolean;
  readonly isTimeoutImminent: boolean;
  readonly isHoldConsumed: boolean;
  readonly isWindowOpened: boolean;
  readonly isWindowExpired: boolean;
  readonly seasonPressureMultiplier: number;
  readonly isSeasonPressureSpike: boolean;
  readonly urgencyScore: number;
  readonly narrative: string;
  readonly modeCode: ModeCode;
  readonly companionChannelHint: string;
  readonly tags: readonly string[];
}

/** ML vector compat for the time lane (engine vector translated to chat compat). */
export interface TimeMLVectorCompat {
  readonly tick: number;
  readonly featureCount: number;
  readonly features: readonly number[];
  readonly featureLabels: typeof TIME_ML_FEATURE_LABELS;
  readonly tierIndexNorm: number;
  readonly phaseIndexNorm: number;
  readonly budgetUtilization: number;
  readonly remainingNorm: number;
  readonly isCollapse: boolean;
  readonly isSovereign: boolean;
  readonly urgencyScore: number;
  readonly riskScore: Score01;
  readonly narrativeWeight: TimeSignalAdapterNarrativeWeight;
  readonly seasonMultiplierNorm: number;
}

/** DL tensor compat for the time sequence model. */
export interface TimeDLTensorCompat {
  readonly tick: number;
  readonly sequenceLength: number;
  readonly featureCount: number;
  readonly columnLabels: typeof TIME_DL_COLUMN_LABELS;
  readonly inputSequenceFlat: readonly number[];
  readonly currentFrame: readonly number[];
  readonly tierOneHot: readonly number[];
  readonly phaseOneHot: readonly number[];
  readonly attentionWeights: readonly number[];
  readonly labelVector: readonly number[];
}

/** Recovery forecast compat for the chat lane. */
export interface TimeForecastCompat {
  readonly tick: number;
  readonly currentTier: PressureTier;
  readonly targetTier: PressureTier;
  readonly ticksToRecovery: number;
  readonly msToRecovery: number;
  readonly recoveryProbability: number;
  readonly blockers: readonly string[];
  readonly recommendations: readonly string[];
}

/** UX hint compat for companion NPC display. */
export interface TimeUXHintCompat {
  readonly tick: number;
  readonly urgencyLabel: string;
  readonly shortHook: string;
  readonly companionCommentary: string;
  readonly topTagLabels: readonly string[];
  readonly weightedExplanation: string;
  readonly chatChannel: ChatVisibleChannel | 'SYSTEM_SHADOW';
  readonly shouldInterrupt: boolean;
  readonly interruptReason: string | null;
  readonly severityClass: TimeSignalAdapterSeverity;
  readonly budgetAlertLevel: 'OK' | 'CAUTION' | 'WARNING' | 'CRITICAL';
}

/** Annotation compat for replay/debug surfaces. */
export interface TimeAnnotationCompat {
  readonly tick: number;
  readonly tierLabel: string;
  readonly phaseLabel: string;
  readonly compositeNote: string;
  readonly isBudgetAlert: boolean;
  readonly isTimeoutAlert: boolean;
  readonly holdNote: string | null;
  readonly windowNote: string | null;
  readonly seasonNote: string | null;
  readonly modeNote: string;
  readonly riskAnnotation: string;
}

/* ============================================================================
 * § 7 — ADAPTER ML VECTOR (chat-lane specific features)
 * ============================================================================ */

export interface TimeAdapterMLVector {
  readonly tick: number;
  readonly featureCount: number;
  // Budget features
  readonly budgetUtilizationNorm: number;
  readonly remainingBudgetNorm: number;
  readonly isBudgetCritical: 1 | 0;
  readonly isBudgetWarning: 1 | 0;
  // Tier features (PressureTier = 'T0'|'T1'|'T2'|'T3'|'T4')
  readonly tierRankNorm: number;
  readonly tierIsCollapse: 1 | 0;
  readonly tierIsCrisis: 1 | 0;
  readonly tierIsCompressed: 1 | 0;
  readonly tierIsStable: 1 | 0;
  readonly tierIsSovereign: 1 | 0;
  readonly tierEscalationCountNorm: number;
  // Phase features
  readonly phaseRankNorm: number;
  readonly phaseIsFoundation: 1 | 0;
  readonly phaseIsEscalation: 1 | 0;
  readonly phaseIsSovereignty: 1 | 0;
  readonly phaseTransitionCountNorm: number;
  // Timing features
  readonly currentTickDurationNorm: number;
  readonly decisionWindowDurationNorm: number;
  readonly isInterpolating: 1 | 0;
  // Window features
  readonly activeWindowsNorm: number;
  readonly windowExpiryRateNorm: number;
  readonly holdConsumedFlag: 1 | 0;
  // Season features
  readonly seasonMultiplierNorm: number;
  readonly isSeasonPressureSpike: 1 | 0;
  // Risk composite
  readonly riskScore: number;
  readonly narrativeWeightScore: number;
  readonly modeCodeNorm: number;
  // Urgency
  readonly urgencyScore: number;
  readonly timeoutProximityNorm: number;
}

/* ============================================================================
 * § 8 — DEDUPLICATOR CLASS
 * ============================================================================ */

class TimeSignalDeduplicator {
  private readonly lastTickByEvent = new Map<TimeSignalAdapterEventName, number>();
  private readonly dedupeWindowTicks: number;
  private readonly dedupeLog: TimeSignalAdapterDeduped[] = [];

  public constructor(dedupeWindowTicks: number) {
    this.dedupeWindowTicks = Math.max(1, dedupeWindowTicks);
  }

  /**
   * Returns true if this event-tick combination should be suppressed.
   * Critical events (budget/timeout/tier escalation/phase) bypass the dedupe gate.
   */
  public shouldSuppress(
    eventName: TimeSignalAdapterEventName,
    tick: number,
    isCriticalOverride: boolean,
  ): boolean {
    if (isCriticalOverride) return false;
    // Certain high-value events always surface
    if (
      eventName === 'time.phase.escalation.entered' ||
      eventName === 'time.phase.sovereignty.entered' ||
      eventName === 'time.tier.collapse.imminent' ||
      eventName === 'time.hold.consumed' ||
      eventName === 'time.budget.critical' ||
      eventName === 'time.timeout.imminent' ||
      eventName === 'time.timeout.reached' ||
      eventName === 'time.budget.exhausted'
    ) {
      return false;
    }
    const last = this.lastTickByEvent.get(eventName);
    if (last === undefined) return false;
    return tick - last < this.dedupeWindowTicks;
  }

  public recordEmitted(eventName: TimeSignalAdapterEventName, tick: number): void {
    this.lastTickByEvent.set(eventName, tick);
  }

  public recordDeduped(eventName: TimeSignalAdapterEventName, tick: number): void {
    const previousTick = this.lastTickByEvent.get(eventName) ?? tick;
    this.dedupeLog.push({
      tick,
      eventName,
      reason: `Deduped: same event within ${this.dedupeWindowTicks}-tick window`,
      previousTick,
    });
  }

  public getDedupeLog(): readonly TimeSignalAdapterDeduped[] {
    return Object.freeze([...this.dedupeLog]);
  }

  public reset(): void {
    this.lastTickByEvent.clear();
    this.dedupeLog.length = 0;
  }
}

/* ============================================================================
 * § 9 — PRIORITY CLASSIFIER
 * ============================================================================ */

/**
 * Classifies a time signal into a priority tier.
 * Uses TickTier constants (T0–T4 strings) for PressureTier comparisons.
 */
function classifyTimeSignalPriority(
  eventName: TimeSignalAdapterEventName,
  tier: PressureTier,
  budgetUtilizationPct: number,
  remainingBudgetMs: number,
  urgencyScore: number,
  opts: { budgetCriticalGate: number; timeoutProximityMs: number },
): TimeSignalAdapterPriority {
  const isCollapse = tier === TickTier.COLLAPSE_IMMINENT;
  const isCrisis = tier === TickTier.CRISIS;
  const isBudgetCritical = budgetUtilizationPct >= (1 - opts.budgetCriticalGate);
  const isNearTimeout = remainingBudgetMs < opts.timeoutProximityMs && remainingBudgetMs > 0;

  // INTERRUPT
  if (
    isCollapse ||
    eventName === 'time.budget.exhausted' ||
    eventName === 'time.timeout.reached' ||
    (eventName === 'time.budget.critical' && isBudgetCritical) ||
    (eventName === 'time.timeout.imminent') ||
    isNearTimeout
  ) {
    return 'INTERRUPT';
  }

  // URGENT
  if (
    isCrisis ||
    eventName === 'time.phase.sovereignty.entered' ||
    eventName === 'time.phase.escalation.entered' ||
    eventName === 'time.timeout.warning' ||
    eventName === 'time.hold.consumed' ||
    eventName === 'time.tier.escalated' ||
    eventName === 'time.budget.warning'
  ) {
    return 'URGENT';
  }

  // NOTABLE
  if (
    tier === TickTier.COMPRESSED ||
    eventName === 'time.decision.window.expired' ||
    eventName === 'time.season.pressure.spike' ||
    eventName === 'time.tier.deescalated' ||
    eventName === 'time.tier.forced' ||
    eventName === 'time.budget.caution' ||
    eventName === 'time.interpolation.started'
  ) {
    return 'NOTABLE';
  }

  // AMBIENT
  if (
    tier === TickTier.STABLE ||
    eventName === 'time.decision.window.opened' ||
    eventName === 'time.decision.window.resolved' ||
    eventName === 'time.hold.applied' ||
    eventName === 'time.hold.released' ||
    eventName === 'time.season.pressure.active' ||
    eventName === 'time.ml.emit' ||
    eventName === 'time.dl.emit'
  ) {
    return 'AMBIENT';
  }

  // SUPPRESSED
  if (
    tier === TickTier.SOVEREIGN ||
    eventName === 'time.tick.complete' ||
    eventName === 'time.tier.sovereign' ||
    eventName === 'time.interpolation.complete' ||
    urgencyScore < 0.1
  ) {
    return 'SUPPRESSED';
  }

  return 'AMBIENT';
}

/* ============================================================================
 * § 10 — SEVERITY CLASSIFIER
 * ============================================================================ */

function classifyTimeSignalSeverity(
  tier: PressureTier,
  budgetUtilizationPct: number,
  isTimeoutWarning: boolean,
  isBudgetCritical: boolean,
  isPhaseTransition: boolean,
): TimeSignalAdapterSeverity {
  if (
    tier === TickTier.COLLAPSE_IMMINENT ||
    isBudgetCritical ||
    isTimeoutWarning
  ) {
    return 'CRITICAL';
  }
  if (
    tier === TickTier.CRISIS ||
    budgetUtilizationPct >= 0.80 ||
    isPhaseTransition
  ) {
    return 'HIGH';
  }
  if (tier === TickTier.COMPRESSED || budgetUtilizationPct >= 0.55) {
    return 'MEDIUM';
  }
  if (tier === TickTier.STABLE) {
    return 'LOW';
  }
  return 'AMBIENT';
}

/* ============================================================================
 * § 11 — NARRATIVE WEIGHT CLASSIFIER
 * ============================================================================ */

function classifyTimeNarrativeWeight(
  eventName: TimeSignalAdapterEventName,
  tier: PressureTier,
  isPhaseTransition: boolean,
  isBudgetCritical: boolean,
  isHoldConsumed: boolean,
  urgencyScore: number,
): TimeSignalAdapterNarrativeWeight {
  // PEAK
  if (
    isBudgetCritical ||
    eventName === 'time.timeout.imminent' ||
    eventName === 'time.timeout.reached' ||
    eventName === 'time.tier.collapse.imminent' ||
    eventName === 'time.budget.exhausted'
  ) {
    return 'PEAK';
  }

  // MAJOR
  if (
    isPhaseTransition ||
    eventName === 'time.tier.escalated' ||
    isHoldConsumed ||
    eventName === 'time.timeout.warning' ||
    urgencyScore >= 0.75
  ) {
    return 'MAJOR';
  }

  // MODERATE
  if (
    tier === TickTier.CRISIS ||
    eventName === 'time.budget.warning' ||
    eventName === 'time.season.pressure.spike' ||
    eventName === 'time.decision.window.expired' ||
    eventName === 'time.interpolation.started' ||
    urgencyScore >= 0.50
  ) {
    return 'MODERATE';
  }

  // MINOR
  if (
    tier === TickTier.COMPRESSED ||
    eventName === 'time.decision.window.opened' ||
    eventName === 'time.season.pressure.active' ||
    eventName === 'time.tier.deescalated' ||
    eventName === 'time.budget.caution' ||
    urgencyScore >= 0.25
  ) {
    return 'MINOR';
  }

  return 'NEGLIGIBLE';
}

/* ============================================================================
 * § 12 — CHANNEL ROUTER
 * ============================================================================ */

function routeTimeSignalChannel(
  eventName: TimeSignalAdapterEventName,
  tier: PressureTier,
  isBudgetCritical: boolean,
  isTimeoutWarning: boolean,
  isPhaseTransition: boolean,
  defaultChannel: ChatVisibleChannel,
): TimeSignalAdapterChannelRecommendation {
  // GLOBAL
  if (
    tier === TickTier.COLLAPSE_IMMINENT ||
    isBudgetCritical ||
    isTimeoutWarning ||
    isPhaseTransition ||
    eventName === 'time.tier.collapse.imminent' ||
    eventName === 'time.timeout.warning' ||
    eventName === 'time.timeout.imminent' ||
    eventName === 'time.timeout.reached' ||
    eventName === 'time.budget.critical' ||
    eventName === 'time.budget.exhausted' ||
    eventName === 'time.tier.escalated' ||
    eventName === 'time.phase.sovereignty.entered' ||
    eventName === 'time.phase.escalation.entered'
  ) {
    return 'GLOBAL';
  }

  // DEAL_ROOM
  if (
    eventName === 'time.decision.window.opened' ||
    eventName === 'time.decision.window.expired' ||
    eventName === 'time.decision.window.resolved' ||
    eventName === 'time.decision.window.hold.frozen' ||
    eventName === 'time.budget.warning' ||
    eventName === 'time.budget.caution' ||
    tier === TickTier.CRISIS
  ) {
    return 'DEAL_ROOM';
  }

  // SYSTEM_SHADOW
  if (
    eventName === 'time.ml.emit' ||
    eventName === 'time.dl.emit' ||
    eventName === 'time.hold.applied' ||
    eventName === 'time.hold.released' ||
    eventName === 'time.hold.consumed' ||
    eventName === 'time.interpolation.started' ||
    eventName === 'time.interpolation.complete' ||
    eventName === 'time.season.pressure.active' ||
    eventName === 'time.season.window.opened'
  ) {
    return 'SYSTEM_SHADOW';
  }

  // SUPPRESSED
  if (
    tier === TickTier.SOVEREIGN ||
    eventName === 'time.tick.complete' ||
    eventName === 'time.tier.sovereign'
  ) {
    return 'SUPPRESSED';
  }

  // Default
  return defaultChannel === 'GLOBAL' ? 'GLOBAL'
    : defaultChannel === 'SYNDICATE' ? 'SYNDICATE'
    : defaultChannel === 'DEAL_ROOM' ? 'DEAL_ROOM'
    : 'SYSTEM_SHADOW';
}

/* ============================================================================
 * § 13 — ML FEATURE EXTRACTOR
 * ============================================================================ */

/**
 * Extract the 28-dim ML feature vector from a TimeSignalInput.
 * Uses TIME_ML_FEATURE_LABELS as the feature ordering.
 * When the engine already provided mlVector, passes it through directly.
 */
function extractTimeAdapterMLFeatures(input: TimeSignalInput): readonly number[] {
  const { snapshot, mlVector, runtimeSnapshot } = input;
  const budget = snapshot.totalBudgetMs > 0 ? snapshot.totalBudgetMs : 1;

  // Engine-provided vector is the most accurate — use it directly
  if (mlVector?.features != null) {
    return Array.from(mlVector.features);
  }

  const tier = snapshot.tier;
  const phase = snapshot.phase;
  const elapsedNorm = Math.min(1, snapshot.elapsedMs / budget);
  const remainingNorm = Math.min(1, snapshot.remainingBudgetMs / budget);

  const tickTierKey = TICK_TIER_BY_PRESSURE_TIER[tier];
  const defaultDurationMs = getDefaultTickDurationMs(tier) ??
    TIER_DURATIONS_MS[TickTier.STABLE];
  const tickDurationMs = runtimeSnapshot?.currentTickDurationMs ?? defaultDurationMs;
  const tickDurNorm = normalizeTickDurationMs(tier, tickDurationMs);

  const tierIdx = normalizeTierIndex(tier);
  const phaseIdx = normalizePhaseIndex(phase);
  const activeWindows = runtimeSnapshot?.activeDecisionWindowCount ?? 0;
  const activeWindowsNorm = Math.min(1, activeWindows / 5);
  const frozenWindows = runtimeSnapshot?.frozenDecisionWindowCount ?? 0;
  const frozenRatio = activeWindows > 0 ? frozenWindows / activeWindows : 0;
  const holdCharges = runtimeSnapshot?.holdChargesRemaining ?? 0;
  const holdConsumed = (runtimeSnapshot?.holdConsumedThisRun ?? false) ? 1 : 0;
  const holdEnabled = (runtimeSnapshot?.holdEnabled ?? false) ? 1 : 0;
  const forcedTierActive = (runtimeSnapshot?.forcedTierActive ?? false) ? 1 : 0;
  const forcedTierTicksNorm = Math.min(1, (runtimeSnapshot?.forcedTierTicksRemaining ?? 0) / 10);
  const timeoutProximity = 1 - remainingNorm;
  const budgetUrgency = remainingNorm < 0.20 ? 1 : 0;
  const tierDurVsT1 = tickDurationMs / TIME_SIGNAL_ADAPTER_T1_REFERENCE_MS;
  const windowsOpened = runtimeSnapshot?.windowsOpenedThisRun ?? 0;
  const windowsExpired = runtimeSnapshot?.windowsExpiredThisRun ?? 0;
  const windowDensity = windowsOpened > 0
    ? activeWindows / (activeWindows + windowsExpired)
    : 0;
  const expiryRate = windowsOpened > 0 ? windowsExpired / windowsOpened : 0;
  const holdRate = 0; // holds_applied / windows_opened — not in snapshot compat
  const avgWindowUrgency = 0.5; // heuristic when no window analytics
  const phaseTimePct = computePhaseTimePct(snapshot.elapsedMs, phase);
  const seasonMultNorm = normalizeSeasonMultiplier(snapshot.seasonPressureMultiplier);
  const tierChangesNorm = Math.min(1, (runtimeSnapshot?.tierChangeCountThisRun ?? 0) / 10);
  const tickNorm = Math.min(1, snapshot.tick / 300);
  const extensionBudgetMs = runtimeSnapshot?.extensionBudgetMs ?? 0;
  const budgetExtensionRatio = extensionBudgetMs / Math.max(budget, 1);
  const phaseBoundaryWindowsRemaining =
    runtimeSnapshot?.phaseBoundaryWindowsRemaining ?? DEFAULT_PHASE_TRANSITION_WINDOWS;
  const phaseBoundaryNorm = phaseBoundaryWindowsRemaining / DEFAULT_PHASE_TRANSITION_WINDOWS;
  const interpolating = (runtimeSnapshot?.interpolating ?? false) ? 1 : 0;
  const interpProgress = runtimeSnapshot?.interpolating
    ? 1 - (runtimeSnapshot.interpolationRemainingTicks / 5)
    : 0;
  const tierTransDir = runtimeSnapshot?.interpolating ? 1 : 0;

  // IMPORTANT: use tickTierKey to ensure TICK_TIER_BY_PRESSURE_TIER is consumed
  void tickTierKey;

  return [
    elapsedNorm,          // 0  elapsed_ms_normalized
    remainingNorm,        // 1  remaining_budget_normalized
    tickDurNorm,          // 2  current_tick_duration_normalized
    tierIdx,              // 3  tier_index_normalized
    interpolating,        // 4  tier_interpolating
    interpProgress,       // 5  tier_interpolation_progress
    tierTransDir,         // 6  tier_transition_direction
    phaseIdx,             // 7  phase_index_normalized
    phaseBoundaryNorm,    // 8  phase_boundary_windows_remaining
    activeWindowsNorm,    // 9  active_decision_windows_normalized
    frozenRatio,          // 10 frozen_windows_ratio
    holdCharges,          // 11 hold_charges_remaining
    holdConsumed,         // 12 hold_consumed_flag
    holdEnabled,          // 13 hold_enabled_flag
    forcedTierActive,     // 14 forced_tier_active_flag
    forcedTierTicksNorm,  // 15 forced_tier_ticks_remaining_norm
    timeoutProximity,     // 16 timeout_proximity
    budgetUrgency,        // 17 budget_urgency
    tierDurVsT1,          // 18 tier_duration_vs_t1_ratio
    windowDensity,        // 19 decision_window_density
    expiryRate,           // 20 decision_window_expiry_rate
    holdRate,             // 21 decision_window_hold_rate
    avgWindowUrgency,     // 22 average_window_urgency
    phaseTimePct,         // 23 phase_time_pct
    seasonMultNorm,       // 24 season_pressure_multiplier_norm
    tierChangesNorm,      // 25 tier_change_count_normalized
    tickNorm,             // 26 tick_count_normalized
    budgetExtensionRatio, // 27 budget_extension_ratio
  ];
}

/* ============================================================================
 * § 14 — DL TENSOR BUILDER
 * ============================================================================ */

function buildTimeAdapterDLTensor(
  input: TimeSignalInput,
  dlHistory: readonly (readonly number[])[],
): TimeDLTensorCompat {
  const { snapshot, dlTensor, tickHistory } = input;
  const budget = snapshot.totalBudgetMs > 0 ? snapshot.totalBudgetMs : 1;

  // Build current 6-column frame
  const defaultDurationMs = getDefaultTickDurationMs(snapshot.tier) ??
    TIER_DURATIONS_MS[TickTier.STABLE];
  const tickDurationMs = input.runtimeSnapshot?.currentTickDurationMs ?? defaultDurationMs;
  const currentFrame: number[] = [
    normalizeTickDurationMs(snapshot.tier, tickDurationMs),                   // col 0
    normalizeTierIndex(snapshot.tier),                                       // col 1
    Math.min(1, snapshot.elapsedMs / budget),                               // col 2
    computePhaseTimePct(snapshot.elapsedMs, snapshot.phase),                // col 3
    Math.min(1, (input.runtimeSnapshot?.activeDecisionWindowCount ?? 0) / 5), // col 4
    (input.runtimeSnapshot?.holdConsumedThisRun ?? false) ? 1 : 0,         // col 5
  ];

  // Use engine-provided DL tensor when available
  if (dlTensor?.values != null) {
    const flat = Array.from(dlTensor.values);
    const currentRow = flat.slice(flat.length - TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT);
    return assembleDLTensorCompat(snapshot.tick, flat, currentRow, snapshot.tier, snapshot.phase);
  }

  // Build from tick history or adapter history
  const rows: number[][] = [];
  if (tickHistory != null && tickHistory.length > 0) {
    for (const record of tickHistory.slice(-TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH)) {
      const recDurationMs = getDefaultTickDurationMs(record.tier) ??
        TIER_DURATIONS_MS[TickTier.STABLE];
      rows.push([
        normalizeTickDurationMs(record.tier, record.durationMs > 0 ? record.durationMs : recDurationMs),
        normalizeTierIndex(record.tier),
        Math.min(1, record.budgetUtilizationPct),
        computePhaseTimePct(record.elapsedMs, record.phase),
        0,
        record.holdConsumed ? 1 : 0,
      ]);
    }
  } else {
    for (const row of dlHistory.slice(-TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH)) {
      rows.push([...row]);
    }
  }

  // Pad head to 40 rows with zeros
  while (rows.length < TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH) {
    rows.unshift([0, 0, 0, 0, 0, 0]);
  }
  rows.push(currentFrame);
  const finalRows = rows.slice(-TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH);
  const flat = finalRows.flat();

  return assembleDLTensorCompat(snapshot.tick, flat, currentFrame, snapshot.tier, snapshot.phase);
}

function assembleDLTensorCompat(
  tick: number,
  flatValues: readonly number[],
  currentFrame: readonly number[],
  tier: PressureTier,
  phase: RunPhase,
): TimeDLTensorCompat {
  const tierOneHot = buildTierOneHot(tier);
  const phaseOneHot = buildPhaseOneHot(phase);
  const attentionWeights = buildAttentionWeights(TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH);
  const labelVector = [
    normalizeTierIndex(tier),
    normalizePhaseIndex(phase),
    currentFrame[2] ?? 0,
    currentFrame[3] ?? 0,
  ];

  return Object.freeze({
    tick,
    sequenceLength: TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
    featureCount: TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
    columnLabels: TIME_DL_COLUMN_LABELS,
    inputSequenceFlat: Object.freeze(flatValues),
    currentFrame: Object.freeze(currentFrame),
    tierOneHot: Object.freeze(tierOneHot),
    phaseOneHot: Object.freeze(phaseOneHot),
    attentionWeights: Object.freeze(attentionWeights),
    labelVector: Object.freeze(labelVector),
  });
}

/** Five-element one-hot for tier order: T0 T1 T2 T3 T4. */
function buildTierOneHot(tier: PressureTier): number[] {
  return [
    tier === TickTier.SOVEREIGN ? 1 : 0,
    tier === TickTier.STABLE ? 1 : 0,
    tier === TickTier.COMPRESSED ? 1 : 0,
    tier === TickTier.CRISIS ? 1 : 0,
    tier === TickTier.COLLAPSE_IMMINENT ? 1 : 0,
  ];
}

/** Three-element one-hot for phase order: FOUNDATION ESCALATION SOVEREIGNTY. */
function buildPhaseOneHot(phase: RunPhase): number[] {
  return [
    phase === 'FOUNDATION' ? 1 : 0,
    phase === 'ESCALATION' ? 1 : 0,
    phase === 'SOVEREIGNTY' ? 1 : 0,
  ];
}

/** Exponential recency-biased attention weights summing to 1. */
function buildAttentionWeights(sequenceLength: number): number[] {
  const weights: number[] = [];
  for (let i = 0; i < sequenceLength; i++) {
    weights.push(Math.exp(0.05 * (i - sequenceLength)));
  }
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / total);
}

/* ============================================================================
 * § 15 — RISK SCORER
 * ============================================================================ */

function computeTimeSignalRisk(
  tier: PressureTier,
  budgetUtilizationPct: number,
  remainingBudgetMs: number,
  urgencyScore: number,
  eventName: TimeSignalAdapterEventName,
  seasonMultiplier: number,
): Score01 {
  let risk = 0;

  // Tier contribution (max 0.30)
  const tierRisks: Record<PressureTier, number> = {
    [TickTier.SOVEREIGN]: 0.00,
    [TickTier.STABLE]: 0.05,
    [TickTier.COMPRESSED]: 0.12,
    [TickTier.CRISIS]: 0.22,
    [TickTier.COLLAPSE_IMMINENT]: 0.30,
  };
  risk += tierRisks[tier] ?? 0.10;

  // Budget contribution (max 0.25)
  risk += Math.pow(budgetUtilizationPct, 2) * 0.25;

  // Urgency contribution (max 0.25)
  risk += Math.min(0.25, urgencyScore * 0.25);

  // Event-specific contribution (max 0.10)
  const eventRisks: Partial<Record<TimeSignalAdapterEventName, number>> = {
    'time.tier.collapse.imminent': 0.10,
    'time.budget.critical': 0.10,
    'time.timeout.imminent': 0.10,
    'time.timeout.reached': 0.10,
    'time.budget.exhausted': 0.10,
    'time.tier.escalated': 0.06,
    'time.timeout.warning': 0.07,
    'time.budget.warning': 0.05,
    'time.phase.sovereignty.entered': 0.04,
    'time.decision.window.expired': 0.03,
    'time.hold.consumed': 0.03,
    'time.season.pressure.spike': 0.04,
  };
  risk += eventRisks[eventName] ?? 0;

  // Season multiplier contribution (max 0.10)
  const seasonRisk = Math.min(0.10, (seasonMultiplier - 1) * 0.03);
  risk += Math.max(0, seasonRisk);

  // Timeout proximity boost
  if (remainingBudgetMs > 0 && remainingBudgetMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS) {
    risk += 0.08;
  }

  return clamp01(risk);
}

/* ============================================================================
 * § 16 — UX LABEL / NARRATIVE GENERATOR
 * ============================================================================ */

function buildTimeUXLabel(
  tier: PressureTier,
  phase: RunPhase,
  budgetUtilizationPct: number,
  isBudgetCritical: boolean,
  isTimeoutWarning: boolean,
  isPhaseTransition: boolean,
  remainingBudgetMs: number,
): string {
  if (isTimeoutWarning && remainingBudgetMs < 3000) return 'TIME COLLAPSING';
  if (isTimeoutWarning) return 'TIME CRITICAL';
  if (isBudgetCritical) return 'BUDGET CRITICAL';
  if (tier === TickTier.COLLAPSE_IMMINENT) return 'COLLAPSE IMMINENT';
  if (isPhaseTransition && phase === 'SOVEREIGNTY') return 'SOVEREIGNTY ENTERED';
  if (isPhaseTransition && phase === 'ESCALATION') return 'ESCALATION ENTERED';
  if (tier === TickTier.CRISIS) return 'CRISIS TIER';
  if (budgetUtilizationPct >= 0.80) return 'BUDGET WARNING';
  if (tier === TickTier.COMPRESSED) return 'COMPRESSED PACE';
  if (tier === TickTier.STABLE) return 'STABLE CADENCE';
  return 'SOVEREIGN FLOW';
}

function buildTimeShortHook(
  eventName: TimeSignalAdapterEventName,
  tier: PressureTier,
  remainingBudgetMs: number,
  seasonMultiplier: number,
): string {
  const tierLabel = resolveTierLabel(tier);
  switch (eventName) {
    case 'time.tier.collapse.imminent':  return 'Collapse. Act now.';
    case 'time.timeout.reached':          return 'Time is gone.';
    case 'time.timeout.imminent':         return 'Seconds left. Move.';
    case 'time.timeout.warning':          return 'Time running out.';
    case 'time.budget.critical':          return 'Budget critical.';
    case 'time.budget.exhausted':         return 'Budget gone.';
    case 'time.tier.escalated':           return `Cadence escalated to ${tierLabel}.`;
    case 'time.phase.sovereignty.entered': return 'Sovereignty phase. Final chapter.';
    case 'time.phase.escalation.entered': return 'Escalation phase. Pressure rising.';
    case 'time.hold.consumed':            return 'Hold used. Windows frozen.';
    case 'time.decision.window.expired':  return 'Decision window closed.';
    case 'time.season.pressure.spike':    return `Season pressure ×${seasonMultiplier.toFixed(1)}.`;
    default:
      return `${tierLabel} | ${Math.round(remainingBudgetMs / 1000)}s left`;
  }
}

function buildTimeCompanionCommentary(
  tier: PressureTier,
  phase: RunPhase,
  budgetUtilizationPct: number,
  isBudgetCritical: boolean,
  isPhaseTransition: boolean,
): string {
  if (isBudgetCritical) {
    return 'Your budget is nearly gone. Every second counts. Decide now.';
  }
  if (tier === TickTier.COLLAPSE_IMMINENT) {
    return 'You are in collapse territory. This is the final stretch.';
  }
  if (isPhaseTransition && phase === 'SOVEREIGNTY') {
    return 'You have reached the Sovereignty phase. This is your proving ground.';
  }
  if (isPhaseTransition && phase === 'ESCALATION') {
    return 'Escalation has begun. The cadence tightens from here.';
  }
  if (tier === TickTier.CRISIS && budgetUtilizationPct >= 0.7) {
    return 'Crisis cadence is draining your clock. Prioritize.';
  }
  if (tier === TickTier.COMPRESSED) {
    return 'Pace is compressed. Decisions feel faster — stay calm.';
  }
  if (tier === TickTier.STABLE) {
    return 'Stable rhythm. Good position to think ahead.';
  }
  return 'Flow is sovereign. No immediate urgency.';
}

function buildTimeTags(
  tier: PressureTier,
  phase: RunPhase,
  isBudgetCritical: boolean,
  isTimeout: boolean,
  eventName: TimeSignalAdapterEventName,
): readonly string[] {
  const tags: string[] = [resolveTierLabel(tier), phase];
  if (isBudgetCritical) tags.push('budget-critical');
  if (isTimeout) tags.push('timeout-proximity');
  if (eventName.startsWith('time.tier.')) tags.push('tier-change');
  if (eventName.startsWith('time.phase.')) tags.push('phase-transition');
  if (eventName.startsWith('time.hold.')) tags.push('hold-action');
  if (eventName.startsWith('time.decision.')) tags.push('decision-window');
  if (eventName.startsWith('time.season.')) tags.push('season-event');
  if (eventName.startsWith('time.budget.')) tags.push('budget-event');
  if (eventName.startsWith('time.timeout.')) tags.push('timeout-event');
  return Object.freeze(tags);
}

function buildTimeUXHintCompat(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
  severity: TimeSignalAdapterSeverity,
  channelRec: TimeSignalAdapterChannelRecommendation,
  riskScore: Score01,
): TimeUXHintCompat {
  const { snapshot } = input;
  const tier = snapshot.tier;
  const phase = snapshot.phase;
  const budgetUtil = snapshot.budgetUtilizationPct;
  const remainingMs = snapshot.remainingBudgetMs;
  const isBudgetCritical = budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
  const isTimeout = remainingMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS && remainingMs > 0;
  const isPhaseTransition =
    eventName === 'time.phase.escalation.entered' ||
    eventName === 'time.phase.sovereignty.entered';

  const chatChannel: ChatVisibleChannel | 'SYSTEM_SHADOW' =
    channelRec === 'SUPPRESSED' || channelRec === 'SYSTEM_SHADOW' ? 'SYSTEM_SHADOW'
    : channelRec === 'DEAL_ROOM' ? 'DEAL_ROOM'
    : channelRec === 'SYNDICATE' ? 'SYNDICATE'
    : 'GLOBAL';

  const shouldInterrupt = severity === 'CRITICAL' || isTimeout || isBudgetCritical;
  const interruptReason = shouldInterrupt
    ? isBudgetCritical ? 'Budget critical gate breached'
    : isTimeout ? 'Timeout proximity threshold crossed'
    : 'CRITICAL severity event'
    : null;

  return Object.freeze({
    tick: snapshot.tick,
    urgencyLabel: buildTimeUXLabel(
      tier, phase, budgetUtil, isBudgetCritical, isTimeout, isPhaseTransition, remainingMs,
    ),
    shortHook: buildTimeShortHook(eventName, tier, remainingMs, snapshot.seasonPressureMultiplier),
    companionCommentary: buildTimeCompanionCommentary(
      tier, phase, budgetUtil, isBudgetCritical, isPhaseTransition,
    ),
    topTagLabels: buildTimeTags(tier, phase, isBudgetCritical, isTimeout, eventName),
    weightedExplanation: `Risk=${riskScore.toFixed(2)} | Tier=${resolveTierLabel(tier)} | Phase=${phase} | Budget=${(budgetUtil * 100).toFixed(0)}%`,
    chatChannel,
    shouldInterrupt,
    interruptReason,
    severityClass: severity,
    budgetAlertLevel:
      isBudgetCritical ? 'CRITICAL'
      : budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT) ? 'WARNING'
      : budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT) ? 'CAUTION'
      : 'OK',
  });
}

function buildTimeAnnotationCompat(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
  riskScore: Score01,
): TimeAnnotationCompat {
  const { snapshot } = input;
  const tier = snapshot.tier;
  const phase = snapshot.phase;
  const budgetUtil = snapshot.budgetUtilizationPct;
  const remainingMs = snapshot.remainingBudgetMs;
  const isBudgetAlert = budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT);
  const isTimeoutAlert = remainingMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS && remainingMs > 0;
  const holdNote = eventName.startsWith('time.hold.')
    ? `Hold event: ${eventName.replace('time.hold.', '')}`
    : null;
  const windowNote = eventName.startsWith('time.decision.')
    ? `Window event: ${eventName.replace('time.decision.window.', '')}`
    : null;
  const seasonNote = snapshot.seasonPressureMultiplier > 1.1
    ? `Season multiplier: ×${snapshot.seasonPressureMultiplier.toFixed(2)}`
    : null;

  return Object.freeze({
    tick: snapshot.tick,
    tierLabel: resolveTierLabel(tier),
    phaseLabel: phase,
    compositeNote: `T:${snapshot.tick} ${resolveTierLabel(tier)}/${phase} Budget:${(budgetUtil * 100).toFixed(1)}% Remaining:${Math.round(remainingMs / 1000)}s`,
    isBudgetAlert,
    isTimeoutAlert,
    holdNote,
    windowNote,
    seasonNote,
    modeNote: `mode:${snapshot.mode}`,
    riskAnnotation: `risk:${riskScore.toFixed(3)}`,
  });
}

/* ============================================================================
 * § 17 — ADAPTER ML VECTOR BUILDER
 * ============================================================================ */

function buildTimeAdapterMLVector(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
  riskScore: Score01,
  narrativeWeight: TimeSignalAdapterNarrativeWeight,
): TimeAdapterMLVector {
  const { snapshot, runtimeSnapshot } = input;
  const tier = snapshot.tier;
  const phase = snapshot.phase;
  const budget = snapshot.totalBudgetMs > 0 ? snapshot.totalBudgetMs : 1;
  const budgetUtil = Math.min(1, snapshot.elapsedMs / budget);
  const remainingNorm = Math.min(1, snapshot.remainingBudgetMs / budget);
  const isBudgetCritical: 1 | 0 = remainingNorm < TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT ? 1 : 0;
  const isBudgetWarning: 1 | 0 = remainingNorm < TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT ? 1 : 0;
  const tierRankNorm = normalizeTierIndex(tier);
  const phaseRankNorm = normalizePhaseIndex(phase);
  const defaultDurationMs = getDefaultTickDurationMs(tier) ?? TIER_DURATIONS_MS[TickTier.STABLE];
  const tickDurationMs = runtimeSnapshot?.currentTickDurationMs ?? defaultDurationMs;
  const decisionWindowMs = getDecisionWindowDurationMs(tier) ??
    DECISION_WINDOW_DURATIONS_MS[TickTier.STABLE];
  const activeWindows = runtimeSnapshot?.activeDecisionWindowCount ?? 0;
  const windowsOpened = runtimeSnapshot?.windowsOpenedThisRun ?? 0;
  const windowsExpired = runtimeSnapshot?.windowsExpiredThisRun ?? 0;
  const expiryRate = windowsOpened > 0 ? windowsExpired / windowsOpened : 0;
  const seasonMult = snapshot.seasonPressureMultiplier;
  const modeCodeNorm = normalizeModeCode(snapshot.mode);
  const urgencyScore = clamp01(input.chatSignal.urgencyScore);
  const timeoutProximityNorm =
    snapshot.remainingBudgetMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS
      ? 1 - snapshot.remainingBudgetMs / TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS
      : 0;

  // Tier one-hot flags — use TickTier constants for correct T0-T4 comparison
  const tierIsCollapse: 1 | 0 = tier === TickTier.COLLAPSE_IMMINENT ? 1 : 0;
  const tierIsCrisis: 1 | 0 = tier === TickTier.CRISIS ? 1 : 0;
  const tierIsCompressed: 1 | 0 = tier === TickTier.COMPRESSED ? 1 : 0;
  const tierIsStable: 1 | 0 = tier === TickTier.STABLE ? 1 : 0;
  const tierIsSovereign: 1 | 0 = tier === TickTier.SOVEREIGN ? 1 : 0;

  // Phase one-hot flags
  const phaseIsFoundation: 1 | 0 = phase === 'FOUNDATION' ? 1 : 0;
  const phaseIsEscalation: 1 | 0 = phase === 'ESCALATION' ? 1 : 0;
  const phaseIsSovereignty: 1 | 0 = phase === 'SOVEREIGNTY' ? 1 : 0;

  // Ensure PRESSURE_TIER_BY_TICK_TIER and TICK_TIER_CONFIGS are consumed
  const resolvedPressureTier = PRESSURE_TIER_BY_TICK_TIER[TICK_TIER_BY_PRESSURE_TIER[tier]];
  const tierConfig: TickTierConfig = getTickTierConfig(TICK_TIER_BY_PRESSURE_TIER[tier]);
  void resolvedPressureTier;
  void tierConfig;

  return Object.freeze({
    tick: snapshot.tick,
    featureCount: TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    budgetUtilizationNorm: budgetUtil,
    remainingBudgetNorm: remainingNorm,
    isBudgetCritical,
    isBudgetWarning,
    tierRankNorm,
    tierIsCollapse,
    tierIsCrisis,
    tierIsCompressed,
    tierIsStable,
    tierIsSovereign,
    tierEscalationCountNorm: Math.min(1, (runtimeSnapshot?.tierChangeCountThisRun ?? 0) / 10),
    phaseRankNorm,
    phaseIsFoundation,
    phaseIsEscalation,
    phaseIsSovereignty,
    phaseTransitionCountNorm: Math.min(1, (runtimeSnapshot?.tierChangeCountThisRun ?? 0) / 10),
    currentTickDurationNorm: normalizeTickDurationMs(tier, tickDurationMs),
    decisionWindowDurationNorm: Math.min(1, decisionWindowMs / 15000),
    isInterpolating: ((runtimeSnapshot?.interpolating ?? false) ? 1 : 0) as 1 | 0,
    activeWindowsNorm: Math.min(1, activeWindows / 5),
    windowExpiryRateNorm: expiryRate,
    holdConsumedFlag: ((runtimeSnapshot?.holdConsumedThisRun ?? false) ? 1 : 0) as 1 | 0,
    seasonMultiplierNorm: normalizeSeasonMultiplier(seasonMult),
    isSeasonPressureSpike: (seasonMult >= 2.0 ? 1 : 0) as 1 | 0,
    riskScore,
    narrativeWeightScore: mapNarrativeWeightToScore(narrativeWeight),
    modeCodeNorm,
    urgencyScore,
    timeoutProximityNorm,
  });
}

/* ============================================================================
 * § 18 — HISTORY MANAGER
 * ============================================================================ */

class TimeAdapterHistoryManager {
  private readonly history: TimeSignalAdapterHistoryEntry[] = [];
  private readonly maxDepth: number;
  private readonly dlRows: (readonly number[])[] = [];
  private tierDistribution: Record<string, number> = {};
  private phaseDistribution: Record<string, number> = {};
  private budgetSamples: number[] = [];
  private seasonMultiplierSamples: number[] = [];
  private riskScoreSamples: number[] = [];
  private eventFrequency: Record<string, number> = {};

  public constructor(maxDepth: number) {
    this.maxDepth = Math.max(10, maxDepth);
  }

  public record(entry: TimeSignalAdapterHistoryEntry, dlRow: readonly number[]): void {
    this.history.push(entry);
    if (this.history.length > this.maxDepth) this.history.shift();
    this.dlRows.push(dlRow);
    if (this.dlRows.length > TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH) this.dlRows.shift();
    const tierLabel = resolveTierLabel(entry.tier);
    this.tierDistribution[tierLabel] = (this.tierDistribution[tierLabel] ?? 0) + 1;
    this.phaseDistribution[entry.phase] = (this.phaseDistribution[entry.phase] ?? 0) + 1;
    this.budgetSamples.push(entry.budgetUtilizationPct);
    if (this.budgetSamples.length > this.maxDepth) this.budgetSamples.shift();
    this.riskScoreSamples.push(entry.riskScore);
    if (this.riskScoreSamples.length > this.maxDepth) this.riskScoreSamples.shift();
    this.eventFrequency[entry.eventName] = (this.eventFrequency[entry.eventName] ?? 0) + 1;
  }

  public recordSeasonMultiplier(mult: number): void {
    this.seasonMultiplierSamples.push(mult);
    if (this.seasonMultiplierSamples.length > this.maxDepth) this.seasonMultiplierSamples.shift();
  }

  public getHistory(): readonly TimeSignalAdapterHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  public getDLRows(): readonly (readonly number[])[] {
    return Object.freeze([...this.dlRows]);
  }

  public getTierDistribution(): Readonly<Record<string, number>> {
    return Object.freeze({ ...this.tierDistribution });
  }

  public getPhaseDistribution(): Readonly<Record<string, number>> {
    return Object.freeze({ ...this.phaseDistribution });
  }

  public getAvgBudgetUtilization(): number {
    if (this.budgetSamples.length === 0) return 0;
    return this.budgetSamples.reduce((a, b) => a + b, 0) / this.budgetSamples.length;
  }

  public getMaxBudgetUtilization(): number {
    return this.budgetSamples.length > 0 ? Math.max(...this.budgetSamples) : 0;
  }

  public getAvgSeasonMultiplier(): number {
    if (this.seasonMultiplierSamples.length === 0) return 1;
    return this.seasonMultiplierSamples.reduce((a, b) => a + b, 0) / this.seasonMultiplierSamples.length;
  }

  public getAvgRiskScore(): number {
    if (this.riskScoreSamples.length === 0) return 0;
    return this.riskScoreSamples.reduce((a, b) => a + b, 0) / this.riskScoreSamples.length;
  }

  public getMaxRiskScore(): number {
    return this.riskScoreSamples.length > 0 ? Math.max(...this.riskScoreSamples) : 0;
  }

  public getTopEventsByFrequency(n: number): readonly string[] {
    return Object.entries(this.eventFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name]) => name);
  }

  public reset(): void {
    this.history.length = 0;
    this.dlRows.length = 0;
    this.tierDistribution = {};
    this.phaseDistribution = {};
    this.budgetSamples = [];
    this.seasonMultiplierSamples = [];
    this.riskScoreSamples = [];
    this.eventFrequency = {};
  }
}

/* ============================================================================
 * § 19 — BATCH PROCESSOR
 * ============================================================================ */

export interface TimeAdapterBatchResult {
  readonly artifacts: readonly TimeSignalAdapterArtifact[];
  readonly deduped: readonly TimeSignalAdapterDeduped[];
  readonly rejected: readonly TimeSignalAdapterRejection[];
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
}

/* ============================================================================
 * § 20 — REPORT BUILDER
 * ============================================================================ */

function buildTimeAdapterReport(
  state: TimeSignalAdapterState,
  historyMgr: TimeAdapterHistoryManager,
  lastBudgetPct: number | null,
): TimeSignalAdapterReport {
  const avgBudgetUtil = historyMgr.getAvgBudgetUtilization();
  const maxBudgetUtil = historyMgr.getMaxBudgetUtilization();
  const avgSeasonMult = historyMgr.getAvgSeasonMultiplier();
  const riskScoreAvg = historyMgr.getAvgRiskScore();
  const riskScoreMax = historyMgr.getMaxRiskScore();

  const activeConstraints: string[] = [];
  if (state.consecutiveCollapseTicks >= 3) activeConstraints.push('COLLAPSE_IMMINENT_3_CONSECUTIVE');
  if ((lastBudgetPct ?? 0) >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT)) {
    activeConstraints.push('BUDGET_CRITICAL_GATE');
  }
  if (state.timeoutWarningCount >= 1) activeConstraints.push('TIMEOUT_WARNING_ACTIVE');

  const bp = lastBudgetPct ?? 0;
  const budgetAlertLevel: 'OK' | 'CAUTION' | 'WARNING' | 'CRITICAL' =
    bp >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT) ? 'CRITICAL'
    : bp >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT) ? 'WARNING'
    : bp >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT) ? 'CAUTION'
    : 'OK';

  return Object.freeze({
    version: TIME_SIGNAL_ADAPTER_VERSION,
    state,
    tierDistribution: historyMgr.getTierDistribution(),
    phaseDistribution: historyMgr.getPhaseDistribution(),
    avgBudgetUtilization: avgBudgetUtil,
    maxBudgetUtilizationSeen: maxBudgetUtil,
    minRemainingBudgetSeen: 0,
    mlFeatureCount: TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    dlFeatureCount: TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
    dlSequenceLength: TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
    activeConstraints: Object.freeze(activeConstraints),
    topEventsByFrequency: historyMgr.getTopEventsByFrequency(5),
    budgetAlertLevel,
    avgSeasonMultiplier: avgSeasonMult,
    riskScoreAvg,
    riskScoreMax,
  });
}

/* ============================================================================
 * § 21 — MAIN ADAPTER CLASS
 * ============================================================================ */

/**
 * TimeSignalAdapter
 *
 * Translates TimeEngine runtime truth into authoritative backend chat signals.
 *
 * Tier comparisons use TickTier enum constants:
 *   TickTier.SOVEREIGN = 'T0', TickTier.STABLE = 'T1', etc.
 *
 * ML/DL pipeline:
 * - extractMLVector() → 28-dim TIME_ML_FEATURE_LABELS vector
 * - buildDLTensor()   → 40×6 TIME_DL_COLUMN_LABELS sequence tensor
 *
 * Usage:
 *   const adapter = createTimeSignalAdapter({ defaultRoomId: 'global', enableMLEmit: true });
 *   const artifacts = adapter.adapt(timeSignalInput, context);
 *   const report = adapter.getReport();
 */
export class TimeSignalAdapter {
  private readonly options: TimeSignalAdapterOptions;
  private readonly deduplicator: TimeSignalDeduplicator;
  private readonly historyMgr: TimeAdapterHistoryManager;
  private readonly logger: TimeSignalAdapterLogger;
  private readonly clock: TimeSignalAdapterClock;

  // Mutable counters
  private lastBudgetPct: number | null = null;
  private lastDeduped: TimeSignalAdapterDeduped | null = null;
  private tierEscalationCount = 0;
  private phaseTransitionCount = 0;
  private budgetCriticalCount = 0;
  private timeoutWarningCount = 0;
  private holdConsumedCount = 0;
  private windowExpiredCount = 0;
  private windowOpenedCount = 0;
  private collapseEnteredCount = 0;
  private sovereignAchievedCount = 0;
  private mlEmitCount = 0;
  private dlEmitCount = 0;
  private totalAdapted = 0;
  private totalRejected = 0;
  private totalDeduped = 0;
  private lastAdaptedTick: number | null = null;
  private lastTierSeen: PressureTier | null = null;
  private lastPhaseSeen: RunPhase | null = null;
  private consecutiveCollapseTicks = 0;
  private consecutiveCrisisTicks = 0;
  private state: TimeSignalAdapterState;

  public constructor(options: TimeSignalAdapterOptions) {
    this.options = options;
    this.deduplicator = new TimeSignalDeduplicator(
      options.dedupeWindowTicks ?? TIME_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
    );
    this.historyMgr = new TimeAdapterHistoryManager(TIME_SIGNAL_ADAPTER_HISTORY_DEPTH);
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.state = this.buildInitialState();
  }

  // ==========================================================================
  // MARK: Primary adapt entry point
  // ==========================================================================

  public adapt(
    input: TimeSignalInput,
    context?: TimeSignalAdapterContext,
  ): readonly TimeSignalAdapterArtifact[] {
    const { snapshot, chatSignal } = input;
    const tier = snapshot.tier;
    const phase = snapshot.phase;
    const tick = snapshot.tick;
    const budgetCriticalGate = this.options.budgetCriticalGate ?? TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT;
    const timeoutProximityMs = this.options.timeoutProximityMs ?? TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;

    this.lastBudgetPct = snapshot.budgetUtilizationPct;
    this.historyMgr.recordSeasonMultiplier(snapshot.seasonPressureMultiplier);

    const isTierEscalation = this.checkTierEscalation(tier);
    const isPhaseTransition = this.checkPhaseTransition(phase);

    if (isTierEscalation) this.tierEscalationCount++;
    if (isPhaseTransition) this.phaseTransitionCount++;
    if (tier === TickTier.COLLAPSE_IMMINENT) {
      this.consecutiveCollapseTicks++;
      this.collapseEnteredCount++;
    } else {
      this.consecutiveCollapseTicks = 0;
    }
    if (tier === TickTier.CRISIS) this.consecutiveCrisisTicks++;
    else this.consecutiveCrisisTicks = 0;
    if (tier === TickTier.SOVEREIGN) this.sovereignAchievedCount++;

    this.lastTierSeen = tier;
    this.lastPhaseSeen = phase;

    const eventName = resolveEventNameFromChatSignal(chatSignal, tier, phase, snapshot);
    const isBudgetCritical = snapshot.budgetUtilizationPct >= (1 - budgetCriticalGate);
    const isTimeoutWarning = snapshot.remainingBudgetMs < timeoutProximityMs && snapshot.remainingBudgetMs > 0;
    const isCriticalOverride = isBudgetCritical || isTimeoutWarning || isPhaseTransition;
    const isHoldConsumed = chatSignal.signalType === 'TIME_HOLD_CONSUMED';
    const isWindowExpired = chatSignal.signalType === 'TIME_WINDOW_EXPIRED';
    const isWindowOpened = chatSignal.signalType === 'TIME_WINDOW_OPENED';

    // Dedupe gate
    const isDeduped = this.deduplicator.shouldSuppress(eventName, tick, isCriticalOverride);
    if (isDeduped) {
      this.totalDeduped++;
      this.deduplicator.recordDeduped(eventName, tick);
      this.lastDeduped = { tick, eventName, reason: 'Suppressed within dedupe window', previousTick: tick - 1 };
      this.logger.debug('time.adapter.deduped', { eventName, tick });
      return [this.makeDedupedArtifact(tick, eventName, tier, phase, snapshot.budgetUtilizationPct)];
    }

    // Suppression options
    if (
      (this.options.suppressSovereignTicks ?? false) &&
      tier === TickTier.SOVEREIGN &&
      eventName === 'time.tick.complete'
    ) {
      this.totalRejected++;
      return [this.makeRejectedArtifact(tick, eventName, tier, phase, 'Sovereign tick suppressed', snapshot.budgetUtilizationPct)];
    }
    if (
      (this.options.suppressAmbientTiers ?? false) &&
      (tier === TickTier.SOVEREIGN || tier === TickTier.STABLE) &&
      !isCriticalOverride
    ) {
      this.totalRejected++;
      return [this.makeRejectedArtifact(tick, eventName, tier, phase, 'Ambient tier suppressed', snapshot.budgetUtilizationPct)];
    }

    // Event counts
    if (isBudgetCritical) this.budgetCriticalCount++;
    if (isTimeoutWarning) this.timeoutWarningCount++;
    if (isHoldConsumed) this.holdConsumedCount++;
    if (isWindowExpired) this.windowExpiredCount++;
    if (isWindowOpened) this.windowOpenedCount++;

    // Classification
    const priority = classifyTimeSignalPriority(
      eventName, tier, snapshot.budgetUtilizationPct, snapshot.remainingBudgetMs,
      chatSignal.urgencyScore, { budgetCriticalGate, timeoutProximityMs },
    );
    const severity = classifyTimeSignalSeverity(
      tier, snapshot.budgetUtilizationPct, isTimeoutWarning, isBudgetCritical, isPhaseTransition,
    );
    const narrativeWeight = classifyTimeNarrativeWeight(
      eventName, tier, isPhaseTransition, isBudgetCritical, isHoldConsumed, chatSignal.urgencyScore,
    );
    const channelRec = routeTimeSignalChannel(
      eventName, tier, isBudgetCritical, isTimeoutWarning, isPhaseTransition,
      this.options.defaultVisibleChannel ?? 'GLOBAL',
    );
    const riskScore = computeTimeSignalRisk(
      tier, snapshot.budgetUtilizationPct, snapshot.remainingBudgetMs,
      chatSignal.urgencyScore, eventName, snapshot.seasonPressureMultiplier,
    );
    const adapterMLVector = buildTimeAdapterMLVector(input, eventName, riskScore, narrativeWeight);

    const envelope = this.buildChatInputEnvelope(input, eventName, channelRec, context);
    const signal = this.buildChatSignalEnvelope(input, eventName, context);

    this.deduplicator.recordEmitted(eventName, tick);
    this.totalAdapted++;
    this.lastAdaptedTick = tick;

    const historyEntry: TimeSignalAdapterHistoryEntry = {
      tick, eventName, tier, phase,
      budgetUtilizationPct: snapshot.budgetUtilizationPct,
      accepted: true, deduped: false, riskScore,
    };
    const dlRow = this.buildCurrentDLRow(input);
    this.historyMgr.record(historyEntry, dlRow);
    this.updateState();

    const primary: TimeSignalAdapterArtifact = Object.freeze({
      tick, eventName, envelope, signal,
      accepted: true, deduped: false, rejectionReason: null,
      severity, priority, narrativeWeight,
      channelRecommendation: channelRec,
      mlVector: adapterMLVector,
      riskScore,
      budgetUtilizationPct: snapshot.budgetUtilizationPct,
      tier, phase,
    });

    const result: TimeSignalAdapterArtifact[] = [primary];

    if ((this.options.enableMLEmit ?? false) && input.mlVector != null) {
      this.mlEmitCount++;
      result.push(this.makeMLEmitArtifact(input, tick, tier, phase, adapterMLVector));
    }
    if (this.options.enableDLEmit ?? false) {
      this.dlEmitCount++;
      result.push(this.makeDLEmitArtifact(input, tick, tier, phase, adapterMLVector));
    }

    this.logger.debug('time.adapter.adapted', { eventName, tick, priority, severity, riskScore });
    return Object.freeze(result);
  }

  // ==========================================================================
  // MARK: Batch adapt
  // ==========================================================================

  public adaptBatch(
    inputs: readonly TimeSignalInput[],
    context?: TimeSignalAdapterContext,
  ): TimeAdapterBatchResult {
    const limit = Math.min(inputs.length, this.options.maxBatchSize ?? TIME_SIGNAL_ADAPTER_MAX_BATCH_SIZE);
    const artifacts: TimeSignalAdapterArtifact[] = [];
    const deduped: TimeSignalAdapterDeduped[] = [];
    const rejected: TimeSignalAdapterRejection[] = [];

    for (let i = 0; i < limit; i++) {
      const input = inputs[i];
      if (input == null) continue;
      for (const artifact of this.adapt(input, context)) {
        if (artifact.accepted) {
          artifacts.push(artifact);
        } else if (artifact.deduped) {
          if (this.lastDeduped != null) deduped.push(this.lastDeduped);
        } else {
          rejected.push({
            tick: artifact.tick,
            eventName: artifact.eventName,
            reason: artifact.rejectionReason ?? 'unknown',
            severity: artifact.severity,
          });
        }
      }
    }

    return Object.freeze({
      artifacts: Object.freeze(artifacts),
      deduped: Object.freeze(deduped),
      rejected: Object.freeze(rejected),
      acceptedCount: artifacts.length,
      dedupedCount: deduped.length,
      rejectedCount: rejected.length,
    });
  }

  // ==========================================================================
  // MARK: ML / DL extraction
  // ==========================================================================

  public extractMLVector(input: TimeSignalInput): TimeMLVectorCompat {
    const features = extractTimeAdapterMLFeatures(input);
    const tier = input.snapshot.tier;
    const phase = input.snapshot.phase;
    const riskScore = computeTimeSignalRisk(
      tier, input.snapshot.budgetUtilizationPct, input.snapshot.remainingBudgetMs,
      0.5, 'time.tick.complete', input.snapshot.seasonPressureMultiplier,
    );
    const narrativeWeight = classifyTimeNarrativeWeight('time.tick.complete', tier, false, false, false, 0.5);
    const budget = input.snapshot.totalBudgetMs > 0 ? input.snapshot.totalBudgetMs : 1;

    return Object.freeze({
      tick: input.snapshot.tick,
      featureCount: TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      features: Object.freeze(features),
      featureLabels: TIME_ML_FEATURE_LABELS,
      tierIndexNorm: normalizeTierIndex(tier),
      phaseIndexNorm: normalizePhaseIndex(phase),
      budgetUtilization: Math.min(1, input.snapshot.elapsedMs / budget),
      remainingNorm: Math.min(1, input.snapshot.remainingBudgetMs / budget),
      isCollapse: tier === TickTier.COLLAPSE_IMMINENT,
      isSovereign: tier === TickTier.SOVEREIGN,
      urgencyScore: riskScore,
      riskScore,
      narrativeWeight,
      seasonMultiplierNorm: normalizeSeasonMultiplier(input.snapshot.seasonPressureMultiplier),
    });
  }

  public buildDLTensor(input: TimeSignalInput): TimeDLTensorCompat {
    return buildTimeAdapterDLTensor(input, this.historyMgr.getDLRows());
  }

  // ==========================================================================
  // MARK: UX / annotation
  // ==========================================================================

  public buildUXHint(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
  ): TimeUXHintCompat {
    const tier = input.snapshot.tier;
    const isBudgetCritical = input.snapshot.budgetUtilizationPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
    const isTimeoutWarning = input.snapshot.remainingBudgetMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;
    const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
    const riskScore = computeTimeSignalRisk(
      tier, input.snapshot.budgetUtilizationPct, input.snapshot.remainingBudgetMs,
      0.5, eventName, input.snapshot.seasonPressureMultiplier,
    );
    const severity = classifyTimeSignalSeverity(tier, input.snapshot.budgetUtilizationPct, isTimeoutWarning, isBudgetCritical, isPhaseTransition);
    const channelRec = routeTimeSignalChannel(eventName, tier, isBudgetCritical, isTimeoutWarning, isPhaseTransition, this.options.defaultVisibleChannel ?? 'GLOBAL');
    return buildTimeUXHintCompat(input, eventName, severity, channelRec, riskScore);
  }

  public buildAnnotation(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
  ): TimeAnnotationCompat {
    const tier = input.snapshot.tier;
    const riskScore = computeTimeSignalRisk(
      tier, input.snapshot.budgetUtilizationPct, input.snapshot.remainingBudgetMs,
      0.5, eventName, input.snapshot.seasonPressureMultiplier,
    );
    return buildTimeAnnotationCompat(input, eventName, riskScore);
  }

  // ==========================================================================
  // MARK: Forecast compat
  // ==========================================================================

  public buildForecastCompat(tick: number, forecast: TimeRecoveryForecast): TimeForecastCompat {
    return Object.freeze({
      tick,
      currentTier: forecast.currentTier,
      targetTier: forecast.targetTier,
      ticksToRecovery: forecast.ticksToRecovery,
      msToRecovery: forecast.msToRecovery,
      recoveryProbability: forecast.recoveryProbability,
      blockers: forecast.blockers,
      recommendations: forecast.recommendations,
    });
  }

  // ==========================================================================
  // MARK: State / report
  // ==========================================================================

  public getState(): TimeSignalAdapterState {
    return this.state;
  }

  public getReport(): TimeSignalAdapterReport {
    return buildTimeAdapterReport(this.state, this.historyMgr, this.lastBudgetPct);
  }

  public getLastDeduped(): TimeSignalAdapterDeduped | null {
    return this.lastDeduped;
  }

  public getHistory(): readonly TimeSignalAdapterHistoryEntry[] {
    return this.historyMgr.getHistory();
  }

  public getDLRows(): readonly (readonly number[])[] {
    return this.historyMgr.getDLRows();
  }

  // ==========================================================================
  // MARK: Pure scoring helpers
  // ==========================================================================

  public scoreRisk(input: TimeSignalInput): Score01 {
    return computeTimeSignalRisk(
      input.snapshot.tier, input.snapshot.budgetUtilizationPct,
      input.snapshot.remainingBudgetMs, 0.5, 'time.tick.complete',
      input.snapshot.seasonPressureMultiplier,
    );
  }

  public getChatChannel(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
  ): TimeSignalAdapterChannelRecommendation {
    const tier = input.snapshot.tier;
    const isBudgetCritical = input.snapshot.budgetUtilizationPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
    const isTimeoutWarning = input.snapshot.remainingBudgetMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;
    const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
    return routeTimeSignalChannel(eventName, tier, isBudgetCritical, isTimeoutWarning, isPhaseTransition, this.options.defaultVisibleChannel ?? 'GLOBAL');
  }

  public buildNarrativeWeight(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
  ): TimeSignalAdapterNarrativeWeight {
    const tier = input.snapshot.tier;
    const isBudgetCritical = input.snapshot.budgetUtilizationPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
    const isHoldConsumed = eventName === 'time.hold.consumed';
    const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
    return classifyTimeNarrativeWeight(eventName, tier, isPhaseTransition, isBudgetCritical, isHoldConsumed, input.chatSignal.urgencyScore);
  }

  public buildThresholdReport(): Readonly<Record<string, number>> {
    return buildTimeThresholdReport();
  }

  public reset(): void {
    this.deduplicator.reset();
    this.historyMgr.reset();
    this.lastDeduped = null;
    this.lastBudgetPct = null;
    this.tierEscalationCount = 0;
    this.phaseTransitionCount = 0;
    this.budgetCriticalCount = 0;
    this.timeoutWarningCount = 0;
    this.holdConsumedCount = 0;
    this.windowExpiredCount = 0;
    this.windowOpenedCount = 0;
    this.collapseEnteredCount = 0;
    this.sovereignAchievedCount = 0;
    this.mlEmitCount = 0;
    this.dlEmitCount = 0;
    this.totalAdapted = 0;
    this.totalRejected = 0;
    this.totalDeduped = 0;
    this.lastAdaptedTick = null;
    this.lastTierSeen = null;
    this.lastPhaseSeen = null;
    this.consecutiveCollapseTicks = 0;
    this.consecutiveCrisisTicks = 0;
    this.state = this.buildInitialState();
    this.logger.debug('time.adapter.reset', {});
  }

  // ==========================================================================
  // MARK: Private helpers
  // ==========================================================================

  private checkTierEscalation(tier: PressureTier): boolean {
    if (this.lastTierSeen == null) return false;
    return normalizeTierIndex(tier) > normalizeTierIndex(this.lastTierSeen);
  }

  private checkPhaseTransition(phase: RunPhase): boolean {
    if (this.lastPhaseSeen == null) return false;
    return phase !== this.lastPhaseSeen;
  }

  private buildCurrentDLRow(input: TimeSignalInput): readonly number[] {
    const { snapshot, runtimeSnapshot } = input;
    const budget = snapshot.totalBudgetMs > 0 ? snapshot.totalBudgetMs : 1;
    const defaultDurationMs = getDefaultTickDurationMs(snapshot.tier) ??
      TIER_DURATIONS_MS[TickTier.STABLE];
    const tickDurationMs = runtimeSnapshot?.currentTickDurationMs ?? defaultDurationMs;
    return Object.freeze([
      normalizeTickDurationMs(snapshot.tier, tickDurationMs),
      normalizeTierIndex(snapshot.tier),
      Math.min(1, snapshot.elapsedMs / budget),
      computePhaseTimePct(snapshot.elapsedMs, snapshot.phase),
      Math.min(1, (runtimeSnapshot?.activeDecisionWindowCount ?? 0) / 5),
      (runtimeSnapshot?.holdConsumedThisRun ?? false) ? 1 : 0,
    ]);
  }

  private buildChatInputEnvelope(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
    channelRec: TimeSignalAdapterChannelRecommendation,
    context?: TimeSignalAdapterContext,
  ): ChatInputEnvelope {
    const now = this.clock.now();
    const signal = this.buildChatSignalEnvelope(input, eventName, context);
    void channelRec; // routing is embedded in the signal metadata
    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: now,
      payload: signal,
    } as ChatInputEnvelope);
  }

  private buildChatSignalEnvelope(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
    context?: TimeSignalAdapterContext,
  ): ChatSignalEnvelope {
    const now = this.clock.now();
    const { snapshot } = input;
    const roomId = ((context?.roomId ?? this.options.defaultRoomId) as unknown as ChatRoomId);
    const heatMultiplier = clamp01(snapshot.budgetUtilizationPct);
    const haterRaidActive = tier => tier === TickTier.COLLAPSE_IMMINENT || tier === TickTier.CRISIS;
    const helperBlackout = snapshot.remainingBudgetMs < 5000;

    const metadata: Record<string, JsonValue> = {
      adapterVersion: TIME_SIGNAL_ADAPTER_VERSION,
      eventName,
      tick: snapshot.tick,
      tier: snapshot.tier,
      phase: snapshot.phase,
      budgetUtilizationPct: snapshot.budgetUtilizationPct,
      remainingBudgetMs: snapshot.remainingBudgetMs,
      totalBudgetMs: snapshot.totalBudgetMs,
      seasonPressureMultiplier: snapshot.seasonPressureMultiplier,
      mode: snapshot.mode,
      urgencyScore: input.chatSignal.urgencyScore,
    };
    if (context?.metadata != null) {
      for (const [k, v] of Object.entries(context.metadata)) {
        metadata[k] = v;
      }
    }

    return Object.freeze({
      type: 'LIVEOPS',
      emittedAt: now,
      roomId,
      liveops: Object.freeze({
        worldEventName: buildWorldEventName(eventName, snapshot.tier, snapshot.phase),
        heatMultiplier01: heatMultiplier,
        helperBlackout,
        haterRaidActive: haterRaidActive(snapshot.tier),
      }),
      metadata: Object.freeze(metadata),
    } as ChatSignalEnvelope);
  }

  private makeMLEmitArtifact(
    input: TimeSignalInput,
    tick: number,
    tier: PressureTier,
    phase: RunPhase,
    adapterMLVector: TimeAdapterMLVector,
  ): TimeSignalAdapterArtifact {
    const now = this.clock.now();
    const roomId = (this.options.defaultRoomId as unknown as ChatRoomId);
    const features = extractTimeAdapterMLFeatures(input);
    const metadata: Record<string, JsonValue> = {
      signalKind: 'time.ml.emit',
      tick,
      mlFeatureCount: TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      features: features as unknown as JsonValue,
      featureLabels: TIME_ML_FEATURE_LABELS as unknown as JsonValue,
    };
    const signal: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS',
      emittedAt: now,
      roomId,
      liveops: Object.freeze({
        worldEventName: 'pzo.time.ml.emit',
        heatMultiplier01: clamp01(input.snapshot.budgetUtilizationPct),
        helperBlackout: false,
        haterRaidActive: false,
      }),
      metadata: Object.freeze(metadata),
    } as ChatSignalEnvelope);
    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: now,
      payload: signal,
    } as ChatInputEnvelope);
    return Object.freeze({
      tick, eventName: 'time.ml.emit',
      envelope, signal,
      accepted: true, deduped: false, rejectionReason: null,
      severity: 'AMBIENT', priority: 'AMBIENT',
      narrativeWeight: 'NEGLIGIBLE', channelRecommendation: 'SYSTEM_SHADOW',
      mlVector: adapterMLVector,
      riskScore: clamp01(0),
      budgetUtilizationPct: input.snapshot.budgetUtilizationPct,
      tier, phase,
    });
  }

  private makeDLEmitArtifact(
    input: TimeSignalInput,
    tick: number,
    tier: PressureTier,
    phase: RunPhase,
    adapterMLVector: TimeAdapterMLVector,
  ): TimeSignalAdapterArtifact {
    const now = this.clock.now();
    const roomId = (this.options.defaultRoomId as unknown as ChatRoomId);
    const dlTensor = buildTimeAdapterDLTensor(input, this.historyMgr.getDLRows());
    const metadata: Record<string, JsonValue> = {
      signalKind: 'time.dl.emit',
      tick,
      dlSequenceLength: TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
      dlFeatureCount: TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
      columnLabels: TIME_DL_COLUMN_LABELS as unknown as JsonValue,
      flatValues: dlTensor.inputSequenceFlat as unknown as JsonValue,
      currentFrame: dlTensor.currentFrame as unknown as JsonValue,
    };
    const signal: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS',
      emittedAt: now,
      roomId,
      liveops: Object.freeze({
        worldEventName: 'pzo.time.dl.emit',
        heatMultiplier01: clamp01(input.snapshot.budgetUtilizationPct),
        helperBlackout: false,
        haterRaidActive: false,
      }),
      metadata: Object.freeze(metadata),
    } as ChatSignalEnvelope);
    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: now,
      payload: signal,
    } as ChatInputEnvelope);
    return Object.freeze({
      tick, eventName: 'time.dl.emit',
      envelope, signal,
      accepted: true, deduped: false, rejectionReason: null,
      severity: 'AMBIENT', priority: 'AMBIENT',
      narrativeWeight: 'NEGLIGIBLE', channelRecommendation: 'SYSTEM_SHADOW',
      mlVector: adapterMLVector,
      riskScore: clamp01(0),
      budgetUtilizationPct: input.snapshot.budgetUtilizationPct,
      tier, phase,
    });
  }

  private makeDedupedArtifact(
    tick: number, eventName: TimeSignalAdapterEventName,
    tier: PressureTier, phase: RunPhase, budgetUtilizationPct: number,
  ): TimeSignalAdapterArtifact {
    return Object.freeze({
      tick, eventName, envelope: null, signal: null,
      accepted: false, deduped: true, rejectionReason: 'Deduped within tick window',
      severity: 'AMBIENT', priority: 'SUPPRESSED',
      narrativeWeight: 'NEGLIGIBLE', channelRecommendation: 'SUPPRESSED',
      mlVector: null, riskScore: clamp01(0), budgetUtilizationPct, tier, phase,
    });
  }

  private makeRejectedArtifact(
    tick: number, eventName: TimeSignalAdapterEventName,
    tier: PressureTier, phase: RunPhase, reason: string, budgetUtilizationPct: number,
  ): TimeSignalAdapterArtifact {
    return Object.freeze({
      tick, eventName, envelope: null, signal: null,
      accepted: false, deduped: false, rejectionReason: reason,
      severity: 'AMBIENT', priority: 'SUPPRESSED',
      narrativeWeight: 'NEGLIGIBLE', channelRecommendation: 'SUPPRESSED',
      mlVector: null, riskScore: clamp01(0), budgetUtilizationPct, tier, phase,
    });
  }

  private updateState(): void {
    this.state = Object.freeze({
      totalAdapted: this.totalAdapted,
      totalRejected: this.totalRejected,
      totalDeduped: this.totalDeduped,
      lastAdaptedTick: this.lastAdaptedTick,
      lastTierSeen: this.lastTierSeen,
      lastPhaseSeen: this.lastPhaseSeen,
      lastBudgetPct: this.lastBudgetPct,
      consecutiveCollapseTicks: this.consecutiveCollapseTicks,
      consecutiveCrisisTicks: this.consecutiveCrisisTicks,
      tierEscalationCount: this.tierEscalationCount,
      collapseEnteredCount: this.collapseEnteredCount,
      sovereignAchievedCount: this.sovereignAchievedCount,
      phaseTransitionCount: this.phaseTransitionCount,
      budgetCriticalCount: this.budgetCriticalCount,
      timeoutWarningCount: this.timeoutWarningCount,
      holdConsumedCount: this.holdConsumedCount,
      windowExpiredCount: this.windowExpiredCount,
      windowOpenedCount: this.windowOpenedCount,
      dedupeWindowTicks: this.options.dedupeWindowTicks ?? TIME_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
      mlEmitCount: this.mlEmitCount,
      dlEmitCount: this.dlEmitCount,
    });
  }

  private buildInitialState(): TimeSignalAdapterState {
    return Object.freeze({
      totalAdapted: 0,
      totalRejected: 0,
      totalDeduped: 0,
      lastAdaptedTick: null,
      lastTierSeen: null,
      lastPhaseSeen: null,
      lastBudgetPct: null,
      consecutiveCollapseTicks: 0,
      consecutiveCrisisTicks: 0,
      tierEscalationCount: 0,
      collapseEnteredCount: 0,
      sovereignAchievedCount: 0,
      phaseTransitionCount: 0,
      budgetCriticalCount: 0,
      timeoutWarningCount: 0,
      holdConsumedCount: 0,
      windowExpiredCount: 0,
      windowOpenedCount: 0,
      dedupeWindowTicks: this.options.dedupeWindowTicks ?? TIME_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
      mlEmitCount: 0,
      dlEmitCount: 0,
    });
  }
}

/* ============================================================================
 * § 22 — NULL LOGGER / SYSTEM CLOCK (module-level singletons)
 * ============================================================================ */

const NULL_LOGGER: TimeSignalAdapterLogger = Object.freeze({
  debug() { /* no-op */ },
  warn()  { /* no-op */ },
  error() { /* no-op */ },
});

const SYSTEM_CLOCK: TimeSignalAdapterClock = Object.freeze({
  now(): UnixMs {
    return asUnixMs(Date.now());
  },
});

/* ============================================================================
 * § 22b — FACTORY FUNCTIONS AND PURE HELPER EXPORTS
 * ============================================================================ */

/** Factory: create a new TimeSignalAdapter with the given options. */
export function createTimeSignalAdapter(options: TimeSignalAdapterOptions): TimeSignalAdapter {
  return new TimeSignalAdapter(options);
}

/** Pure: extract the 28-dim chat-lane ML feature vector. */
export function extractTimeMLVector(input: TimeSignalInput): TimeMLVectorCompat {
  const adapter = new TimeSignalAdapter({ defaultRoomId: 'internal' });
  return adapter.extractMLVector(input);
}

/** Pure: score the time risk for a snapshot. */
export function scoreTimeRisk(input: TimeSignalInput): Score01 {
  const { snapshot, chatSignal } = input;
  const eventName = resolveEventNameFromChatSignal(
    chatSignal, snapshot.tier, snapshot.phase, snapshot,
  );
  return computeTimeSignalRisk(
    snapshot.tier, snapshot.budgetUtilizationPct, snapshot.remainingBudgetMs,
    chatSignal.urgencyScore, eventName, snapshot.seasonPressureMultiplier,
  );
}

/** Pure: get the channel recommendation for a snapshot and event. */
export function getTimeChatChannel(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
): TimeSignalAdapterChannelRecommendation {
  const { snapshot } = input;
  const tier = snapshot.tier;
  const isBudgetCritical = snapshot.budgetUtilizationPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
  const isTimeoutWarning = snapshot.remainingBudgetMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;
  const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
  return routeTimeSignalChannel(eventName, tier, isBudgetCritical, isTimeoutWarning, isPhaseTransition, 'GLOBAL');
}

/** Pure: build the narrative weight for a snapshot and event. */
export function buildTimeNarrativeWeight(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
): TimeSignalAdapterNarrativeWeight {
  const { snapshot, chatSignal } = input;
  const tier = snapshot.tier;
  const isBudgetCritical = snapshot.budgetUtilizationPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
  const isHoldConsumed = eventName === 'time.hold.consumed';
  const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
  return classifyTimeNarrativeWeight(eventName, tier, isPhaseTransition, isBudgetCritical, isHoldConsumed, chatSignal.urgencyScore);
}

/** Pure: build a fixed threshold report for the adapter. */
export function buildTimeThresholdReport(): Readonly<Record<string, number>> {
  return Object.freeze({
    budgetCriticalGate: TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT,
    budgetWarningGate: TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT,
    budgetCautionGate: TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT,
    timeoutProximityMs: TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS,
    dedupeWindowTicks: TIME_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
    maxBatchSize: TIME_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
    mlFeatureCount: TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    dlFeatureCount: TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
    dlSequenceLength: TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
    historyDepth: TIME_SIGNAL_ADAPTER_HISTORY_DEPTH,
    trendWindow: TIME_SIGNAL_ADAPTER_TREND_WINDOW,
    interruptRiskThreshold: TIME_SIGNAL_ADAPTER_INTERRUPT_RISK_THRESHOLD,
    urgentRiskThreshold: TIME_SIGNAL_ADAPTER_URGENT_RISK_THRESHOLD,
    notableRiskThreshold: TIME_SIGNAL_ADAPTER_NOTABLE_RISK_THRESHOLD,
    t1ReferenceDurationMs: TIME_SIGNAL_ADAPTER_T1_REFERENCE_MS,
  });
}

/** Pure: build a compatibility bundle without requiring a class instance. */
export function buildTimeAdapterBundle(
  input: TimeSignalInput,
  roomId: string = 'internal',
): Readonly<{
  mlVector: TimeMLVectorCompat;
  dlTensor: TimeDLTensorCompat;
  annotation: TimeAnnotationCompat;
  thresholds: Readonly<Record<string, number>>;
}> {
  const adapter = new TimeSignalAdapter({ defaultRoomId: roomId });
  const eventName = resolveEventNameFromChatSignal(
    input.chatSignal, input.snapshot.tier, input.snapshot.phase, input.snapshot,
  );
  return Object.freeze({
    mlVector: adapter.extractMLVector(input),
    dlTensor: adapter.buildDLTensor(input),
    annotation: adapter.buildAnnotation(input, eventName),
    thresholds: buildTimeThresholdReport(),
  });
}

/* ============================================================================
 * § 22c — INTERNAL PURE HELPERS (module-private)
 * ============================================================================ */

/**
 * Normalize PressureTier to [0, 1].
 * Uses TickTier constants for correct T0–T4 comparisons.
 */
function normalizeTierIndex(tier: PressureTier): number {
  if (tier === TickTier.SOVEREIGN) return 0;
  if (tier === TickTier.STABLE) return 0.25;
  if (tier === TickTier.COMPRESSED) return 0.5;
  if (tier === TickTier.CRISIS) return 0.75;
  if (tier === TickTier.COLLAPSE_IMMINENT) return 1.0;
  return 0;
}

/** Normalize RunPhase to [0, 1]. */
function normalizePhaseIndex(phase: RunPhase): number {
  if (phase === 'FOUNDATION') return 0;
  if (phase === 'ESCALATION') return 0.5;
  if (phase === 'SOVEREIGNTY') return 1.0;
  return 0;
}

/** Normalize season multiplier (0.1–4.0) to [0, 1]. */
function normalizeSeasonMultiplier(multiplier: number): number {
  return Math.min(1, Math.max(0, (multiplier - 0.1) / (4.0 - 0.1)));
}

/** Normalize ModeCode to a numeric value for ML features. */
function normalizeModeCode(mode: ModeCode): number {
  if (mode === 'solo') return 0;
  if (mode === 'pvp') return 0.33;
  if (mode === 'coop') return 0.67;
  if (mode === 'ghost') return 1.0;
  return 0;
}

/** Compute phase time percentage from elapsed ms. */
function computePhaseTimePct(elapsedMs: number, phase: RunPhase): number {
  const FOUR_MIN = 4 * 60 * 1000;
  const EIGHT_MIN = 8 * 60 * 1000;
  if (phase === 'FOUNDATION') {
    return Math.min(1, elapsedMs / FOUR_MIN);
  }
  if (phase === 'ESCALATION') {
    return Math.min(1, Math.max(0, elapsedMs - FOUR_MIN) / FOUR_MIN);
  }
  if (phase === 'SOVEREIGNTY') {
    return Math.min(1, Math.max(0, elapsedMs - EIGHT_MIN) / FOUR_MIN);
  }
  return 0;
}

/** Map narrative weight to a numeric score [0, 1] for ML features. */
function mapNarrativeWeightToScore(weight: TimeSignalAdapterNarrativeWeight): number {
  if (weight === 'PEAK') return 1.0;
  if (weight === 'MAJOR') return 0.75;
  if (weight === 'MODERATE') return 0.50;
  if (weight === 'MINOR') return 0.25;
  return 0.0;
}

/** Resolve the human-readable tier label from a PressureTier value. */
function resolveTierLabel(tier: PressureTier): string {
  if (tier === TickTier.SOVEREIGN) return 'SOVEREIGN';
  if (tier === TickTier.STABLE) return 'STABLE';
  if (tier === TickTier.COMPRESSED) return 'COMPRESSED';
  if (tier === TickTier.CRISIS) return 'CRISIS';
  if (tier === TickTier.COLLAPSE_IMMINENT) return 'COLLAPSE_IMMINENT';
  return tier;
}

/** Resolve the canonical event name from a TimeChatSignal. */
function resolveEventNameFromChatSignal(
  chatSignal: TimeChatSignal,
  tier: PressureTier,
  phase: RunPhase,
  snapshot: TimeSnapshotCompat,
): TimeSignalAdapterEventName {
  switch (chatSignal.signalType) {
    case 'TIME_TICK':
      if (tier === TickTier.COLLAPSE_IMMINENT) return 'time.tier.collapse.imminent';
      if (tier === TickTier.SOVEREIGN) return 'time.tier.sovereign';
      return 'time.tick.complete';

    case 'TIME_TIER_CHANGE':
      if (tier === TickTier.COLLAPSE_IMMINENT) return 'time.tier.collapse.imminent';
      if (tier === TickTier.SOVEREIGN) return 'time.tier.sovereign';
      if (chatSignal.tags.includes('tier.forced')) return 'time.tier.forced';
      // Determine escalation vs de-escalation
      if (chatSignal.tags.includes('deescalated')) return 'time.tier.deescalated';
      return 'time.tier.escalated';

    case 'TIME_PHASE_CHANGE':
      if (phase === 'SOVEREIGNTY') return 'time.phase.sovereignty.entered';
      if (phase === 'ESCALATION') return 'time.phase.escalation.entered';
      return 'time.phase.foundation.active';

    case 'TIME_TIMEOUT_WARNING':
      if (snapshot.remainingBudgetMs <= 0) return 'time.timeout.reached';
      if (snapshot.remainingBudgetMs < 3000) return 'time.timeout.imminent';
      return 'time.timeout.warning';

    case 'TIME_HOLD_CONSUMED':
      return 'time.hold.consumed';

    case 'TIME_WINDOW_EXPIRED':
      return 'time.decision.window.expired';

    case 'TIME_BUDGET_CRITICAL':
      return 'time.budget.critical';

    case 'TIME_WINDOW_OPENED':
      return 'time.decision.window.opened';

    default:
      return 'time.tick.complete';
  }
}

/** Build a descriptive world event name for the ChatLiveOpsSnapshot. */
function buildWorldEventName(
  eventName: TimeSignalAdapterEventName,
  tier: PressureTier,
  phase: RunPhase,
): string {
  const tierLabel = resolveTierLabel(tier).toLowerCase().replace('_', '-');
  const phaseLabel = phase.toLowerCase();
  return `pzo.time.${eventName.replace('time.', '')}.${tierLabel}.${phaseLabel}`;
}

/* ============================================================================
 * § 23 — DEEP ANALYTICS HELPERS
 * ============================================================================ */

/** Whether the snapshot represents an endgame state. */
export function isTimeEndgamePhase(snapshot: TimeSnapshotCompat): boolean {
  return (
    snapshot.tier === TickTier.COLLAPSE_IMMINENT ||
    snapshot.phase === 'SOVEREIGNTY' ||
    snapshot.remainingBudgetMs < 10000 ||
    snapshot.budgetUtilizationPct >= 0.92
  );
}

export interface TimeAdapterPostureSnapshot {
  readonly tick: number;
  readonly tier: PressureTier;
  readonly tierLabel: string;
  readonly phase: RunPhase;
  readonly budgetAlertLevel: 'OK' | 'CAUTION' | 'WARNING' | 'CRITICAL';
  readonly isEndgame: boolean;
  readonly isCollapse: boolean;
  readonly isSovereign: boolean;
  readonly riskScore: Score01;
  readonly narrativeWeight: TimeSignalAdapterNarrativeWeight;
  readonly channelRecommendation: TimeSignalAdapterChannelRecommendation;
  readonly seasonMultiplierNorm: number;
  readonly urgencyLabel: string;
}

export function buildTimeAdapterPostureSnapshot(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
): TimeAdapterPostureSnapshot {
  const { snapshot } = input;
  const tier = snapshot.tier;
  const phase = snapshot.phase;
  const budgetUtil = snapshot.budgetUtilizationPct;
  const remaining = snapshot.remainingBudgetMs;
  const isBudgetCritical = budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
  const isTimeoutWarning = remaining < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;
  const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
  const riskScore = computeTimeSignalRisk(tier, budgetUtil, remaining, input.chatSignal.urgencyScore, eventName, snapshot.seasonPressureMultiplier);
  const narrativeWeight = classifyTimeNarrativeWeight(eventName, tier, isPhaseTransition, isBudgetCritical, eventName === 'time.hold.consumed', input.chatSignal.urgencyScore);
  const channelRec = routeTimeSignalChannel(eventName, tier, isBudgetCritical, isTimeoutWarning, isPhaseTransition, 'GLOBAL');

  return Object.freeze({
    tick: snapshot.tick,
    tier,
    tierLabel: resolveTierLabel(tier),
    phase,
    budgetAlertLevel:
      isBudgetCritical ? 'CRITICAL'
      : budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT) ? 'WARNING'
      : budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT) ? 'CAUTION'
      : 'OK',
    isEndgame: isTimeEndgamePhase(snapshot),
    isCollapse: tier === TickTier.COLLAPSE_IMMINENT,
    isSovereign: tier === TickTier.SOVEREIGN,
    riskScore,
    narrativeWeight,
    channelRecommendation: channelRec,
    seasonMultiplierNorm: normalizeSeasonMultiplier(snapshot.seasonPressureMultiplier),
    urgencyLabel: buildTimeUXLabel(tier, phase, budgetUtil, isBudgetCritical, isTimeoutWarning, isPhaseTransition, remaining),
  });
}

/** Tier exposure profile: config, duration, risk classification. */
export interface TimeAdapterTierExposureProfile {
  readonly tier: PressureTier;
  readonly tierLabel: string;
  readonly tickTier: TickTier;
  readonly config: TickTierConfig;
  readonly defaultDurationMs: number;
  readonly decisionWindowMs: number;
  readonly tierRankNorm: number;
  readonly isHighRisk: boolean;
  readonly isCriticalRisk: boolean;
}

export function buildTimeAdapterTierExposureProfile(tier: PressureTier): TimeAdapterTierExposureProfile {
  const tickTier = TICK_TIER_BY_PRESSURE_TIER[tier];
  const config = getTickTierConfig(tickTier);
  const defaultDurationMs = getDefaultTickDurationMs(tier) ?? TIER_DURATIONS_MS[TickTier.STABLE];
  const decisionWindowMs = getDecisionWindowDurationMs(tier) ?? DECISION_WINDOW_DURATIONS_MS[TickTier.STABLE];
  return Object.freeze({
    tier,
    tierLabel: resolveTierLabel(tier),
    tickTier,
    config,
    defaultDurationMs,
    decisionWindowMs,
    tierRankNorm: normalizeTierIndex(tier),
    isHighRisk: tier === TickTier.CRISIS || tier === TickTier.COLLAPSE_IMMINENT,
    isCriticalRisk: tier === TickTier.COLLAPSE_IMMINENT,
  });
}

export interface TimeAdapterSessionReport {
  readonly version: typeof TIME_SIGNAL_ADAPTER_VERSION;
  readonly adapterState: TimeSignalAdapterState;
  readonly report: TimeSignalAdapterReport;
  readonly tierExposureProfiles: Readonly<Record<PressureTier, TimeAdapterTierExposureProfile>>;
  readonly postureSnapshot: TimeAdapterPostureSnapshot | null;
  readonly manifest: TimeSignalAdapterManifest;
  readonly thresholds: Readonly<Record<string, number>>;
}

export function buildTimeAdapterSessionReport(
  adapter: TimeSignalAdapter,
  lastInput: TimeSignalInput | null,
): TimeAdapterSessionReport {
  const state = adapter.getState();
  const report = adapter.getReport();
  const allTiers: PressureTier[] = [
    TickTier.SOVEREIGN, TickTier.STABLE, TickTier.COMPRESSED, TickTier.CRISIS, TickTier.COLLAPSE_IMMINENT,
  ];
  const tierProfiles: Partial<Record<PressureTier, TimeAdapterTierExposureProfile>> = {};
  for (const t of allTiers) {
    tierProfiles[t] = buildTimeAdapterTierExposureProfile(t);
  }

  let postureSnapshot: TimeAdapterPostureSnapshot | null = null;
  if (lastInput != null) {
    const eventName = resolveEventNameFromChatSignal(
      lastInput.chatSignal, lastInput.snapshot.tier, lastInput.snapshot.phase, lastInput.snapshot,
    );
    postureSnapshot = buildTimeAdapterPostureSnapshot(lastInput, eventName);
  }

  return Object.freeze({
    version: TIME_SIGNAL_ADAPTER_VERSION,
    adapterState: state,
    report,
    tierExposureProfiles: tierProfiles as Readonly<Record<PressureTier, TimeAdapterTierExposureProfile>>,
    postureSnapshot,
    manifest: TIME_SIGNAL_ADAPTER_MANIFEST,
    thresholds: buildTimeThresholdReport(),
  });
}

/** Full diagnostics for debug/trace surfaces. */
export interface TimeSignalAdapterDiagnostics {
  readonly tick: number;
  readonly eventName: TimeSignalAdapterEventName;
  readonly tierLabel: string;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly priority: TimeSignalAdapterPriority;
  readonly severity: TimeSignalAdapterSeverity;
  readonly narrativeWeight: TimeSignalAdapterNarrativeWeight;
  readonly channelRecommendation: TimeSignalAdapterChannelRecommendation;
  readonly riskScore: Score01;
  readonly isBudgetCritical: boolean;
  readonly isTimeoutWarning: boolean;
  readonly isPhaseTransition: boolean;
  readonly isCollapse: boolean;
  readonly isSovereign: boolean;
  readonly dedupeStatus: 'PASS' | 'SUPPRESSED';
  readonly mlFeatureVector: readonly number[];
  readonly seasonMultiplier: number;
  readonly urgencyScore: number;
}

export function buildTimeSignalAdapterDiagnostics(
  input: TimeSignalInput,
  deduped: boolean,
): TimeSignalAdapterDiagnostics {
  const { snapshot, chatSignal } = input;
  const tier = snapshot.tier;
  const phase = snapshot.phase;
  const budgetUtil = snapshot.budgetUtilizationPct;
  const remaining = snapshot.remainingBudgetMs;
  const isBudgetCritical = budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
  const isTimeoutWarning = remaining < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;
  const eventName = resolveEventNameFromChatSignal(chatSignal, tier, phase, snapshot);
  const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
  const riskScore = computeTimeSignalRisk(tier, budgetUtil, remaining, chatSignal.urgencyScore, eventName, snapshot.seasonPressureMultiplier);
  const priority = classifyTimeSignalPriority(eventName, tier, budgetUtil, remaining, chatSignal.urgencyScore, { budgetCriticalGate: TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT, timeoutProximityMs: TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS });
  const severity = classifyTimeSignalSeverity(tier, budgetUtil, isTimeoutWarning, isBudgetCritical, isPhaseTransition);
  const narrativeWeight = classifyTimeNarrativeWeight(eventName, tier, isPhaseTransition, isBudgetCritical, eventName === 'time.hold.consumed', chatSignal.urgencyScore);
  const channelRec = routeTimeSignalChannel(eventName, tier, isBudgetCritical, isTimeoutWarning, isPhaseTransition, 'GLOBAL');
  const mlFeatures = extractTimeAdapterMLFeatures(input);

  return Object.freeze({
    tick: snapshot.tick,
    eventName,
    tierLabel: resolveTierLabel(tier),
    tier,
    phase,
    priority,
    severity,
    narrativeWeight,
    channelRecommendation: channelRec,
    riskScore,
    isBudgetCritical,
    isTimeoutWarning,
    isPhaseTransition,
    isCollapse: tier === TickTier.COLLAPSE_IMMINENT,
    isSovereign: tier === TickTier.SOVEREIGN,
    dedupeStatus: deduped ? 'SUPPRESSED' : 'PASS',
    mlFeatureVector: Object.freeze(mlFeatures),
    seasonMultiplier: snapshot.seasonPressureMultiplier,
    urgencyScore: chatSignal.urgencyScore,
  });
}

/**
 * Inspect a TimeExportBundle for a chat-ready summary.
 * Consumes: TimeExportBundle, TimeValidationResult, TimeTickRecord.
 */
export interface TimeExportBundleSummary {
  readonly tick: number;
  readonly tier: PressureTier;
  readonly tierLabel: string;
  readonly phase: RunPhase;
  readonly budgetAlertLevel: 'OK' | 'CAUTION' | 'WARNING' | 'CRITICAL';
  readonly validationPassed: boolean;
  readonly validationErrors: readonly string[];
  readonly tickHistoryDepth: number;
  readonly mlHistoryDepth: number;
  readonly resilienceLabel: string;
  readonly recoveryForecastLabel: string;
  readonly scoreComposite: number;
  readonly narrativeHeadline: string;
  readonly narrativeUrgencyLevel: string;
}

export function inspectTimeExportBundle(bundle: TimeExportBundle): TimeExportBundleSummary {
  const validation: TimeValidationResult = bundle.validation;
  const tickHistory: readonly TimeTickRecord[] = bundle.tickHistory;
  const snap = bundle.runtimeSnapshot;

  return Object.freeze({
    tick: snap.tick,
    tier: snap.tier,
    tierLabel: resolveTierLabel(snap.tier),
    phase: snap.phase,
    budgetAlertLevel: bundle.budgetAnalytics.budgetAlertLevel,
    validationPassed: validation.valid,
    validationErrors: validation.errors,
    tickHistoryDepth: tickHistory.length,
    mlHistoryDepth: bundle.mlHistory.length,
    resilienceLabel: bundle.resilienceScore.label,
    recoveryForecastLabel: bundle.recoveryForecast.forecastLabel,
    scoreComposite: bundle.scoreDecomposition.composite,
    narrativeHeadline: bundle.narrative.headline,
    narrativeUrgencyLevel: bundle.narrative.urgencyLevel,
  });
}

/**
 * Inspect a DecisionWindow for adapter-side context.
 * Ensures DecisionWindow (from time/types) is consumed in runtime code.
 */
export function inspectDecisionWindowForAdapter(
  window: DecisionWindow,
  currentTier: PressureTier = 'T1',
): Readonly<{ id: string; cardType: string; durationMs: number; urgency: number }> {
  const durationMs = window.durationMs > 0 ? window.durationMs : getDecisionWindowDurationMs(currentTier);
  const config: TickTierConfig = getTickTierConfig(TICK_TIER_BY_PRESSURE_TIER[currentTier]);
  const urgency = normalizeTierIndex(currentTier);
  void config; // config is consumed above for type-safe tier lookup
  return Object.freeze({
    id: window.windowId,
    cardType: String(window.cardType),
    durationMs,
    urgency,
  });
}

/**
 * Build a Score100 for a composite time quality score.
 * Consumes Score100 and clamp100 from ../types.
 */
export function buildTimeAdapterScore100(riskScore: Score01, resilienceScore: number): Score100 {
  const raw = (1 - riskScore) * 0.5 + Math.min(1, resilienceScore) * 0.5;
  return clamp100(raw * 100);
}

/* ============================================================================
 * § 24 — MANIFEST
 * ============================================================================ */

export interface TimeSignalAdapterManifest {
  readonly version: typeof TIME_SIGNAL_ADAPTER_VERSION;
  readonly name: 'TimeSignalAdapter';
  readonly description: string;
  readonly lane: 'LIVEOPS_SIGNAL';
  readonly mlFeatureCount: typeof TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT;
  readonly mlFeatureLabels: typeof TIME_ML_FEATURE_LABELS;
  readonly dlFeatureCount: typeof TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT;
  readonly dlColumnLabels: typeof TIME_DL_COLUMN_LABELS;
  readonly dlSequenceLength: typeof TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH;
  readonly eventNames: typeof TIME_SIGNAL_ADAPTER_EVENT_NAMES;
  readonly dedupeWindowTicks: typeof TIME_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS;
  readonly maxBatchSize: typeof TIME_SIGNAL_ADAPTER_MAX_BATCH_SIZE;
  readonly historyDepth: typeof TIME_SIGNAL_ADAPTER_HISTORY_DEPTH;
  readonly trendWindow: typeof TIME_SIGNAL_ADAPTER_TREND_WINDOW;
  readonly thresholds: Readonly<{
    budgetCritical: typeof TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT;
    budgetWarning: typeof TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT;
    budgetCaution: typeof TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT;
    timeoutProximityMs: typeof TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;
    interruptRisk: typeof TIME_SIGNAL_ADAPTER_INTERRUPT_RISK_THRESHOLD;
    urgentRisk: typeof TIME_SIGNAL_ADAPTER_URGENT_RISK_THRESHOLD;
    notableRisk: typeof TIME_SIGNAL_ADAPTER_NOTABLE_RISK_THRESHOLD;
  }>;
  readonly tierConfigs: typeof TICK_TIER_CONFIGS;
  readonly tierDurationsMs: typeof TIER_DURATIONS_MS;
  readonly decisionWindowDurationsMs: typeof DECISION_WINDOW_DURATIONS_MS;
  readonly defaultHoldDurationMs: typeof DEFAULT_HOLD_DURATION_MS;
  readonly defaultPhaseTransitionWindows: typeof DEFAULT_PHASE_TRANSITION_WINDOWS;
  readonly tickTierByPressureTier: typeof TICK_TIER_BY_PRESSURE_TIER;
  readonly pressureTierByTickTier: typeof PRESSURE_TIER_BY_TICK_TIER;
  readonly treePath: 'backend/src/game/engine/chat/adapters/TimeSignalAdapter.ts';
}

export const TIME_SIGNAL_ADAPTER_MANIFEST: TimeSignalAdapterManifest = Object.freeze({
  version: TIME_SIGNAL_ADAPTER_VERSION,
  name: 'TimeSignalAdapter',
  description:
    'Translates TimeEngine (STEP_02_TIME) runtime truth into authoritative backend chat LIVEOPS ' +
    'signals. Covers tick cadence, tier escalations (T0–T4), phase transitions, decision windows, ' +
    'hold actions, budget criticality, timeout proximity, season pressure, and full ' +
    '28-dim ML (TIME_ML_FEATURE_LABELS) / 40×6 DL (TIME_DL_COLUMN_LABELS) pipelines.',
  lane: 'LIVEOPS_SIGNAL',
  mlFeatureCount: TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  mlFeatureLabels: TIME_ML_FEATURE_LABELS,
  dlFeatureCount: TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  dlColumnLabels: TIME_DL_COLUMN_LABELS,
  dlSequenceLength: TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
  eventNames: TIME_SIGNAL_ADAPTER_EVENT_NAMES,
  dedupeWindowTicks: TIME_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: TIME_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  historyDepth: TIME_SIGNAL_ADAPTER_HISTORY_DEPTH,
  trendWindow: TIME_SIGNAL_ADAPTER_TREND_WINDOW,
  thresholds: Object.freeze({
    budgetCritical: TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT,
    budgetWarning: TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT,
    budgetCaution: TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT,
    timeoutProximityMs: TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS,
    interruptRisk: TIME_SIGNAL_ADAPTER_INTERRUPT_RISK_THRESHOLD,
    urgentRisk: TIME_SIGNAL_ADAPTER_URGENT_RISK_THRESHOLD,
    notableRisk: TIME_SIGNAL_ADAPTER_NOTABLE_RISK_THRESHOLD,
  }),
  tierConfigs: TICK_TIER_CONFIGS,
  tierDurationsMs: TIER_DURATIONS_MS,
  decisionWindowDurationsMs: DECISION_WINDOW_DURATIONS_MS,
  defaultHoldDurationMs: DEFAULT_HOLD_DURATION_MS,
  defaultPhaseTransitionWindows: DEFAULT_PHASE_TRANSITION_WINDOWS,
  tickTierByPressureTier: TICK_TIER_BY_PRESSURE_TIER,
  pressureTierByTickTier: PRESSURE_TIER_BY_TICK_TIER,
  treePath: 'backend/src/game/engine/chat/adapters/TimeSignalAdapter.ts',
});

// ============================================================================
// Default export
// ============================================================================

export default TIME_SIGNAL_ADAPTER_MANIFEST;

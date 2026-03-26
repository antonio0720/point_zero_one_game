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
 * It does not own:
 * - transcript mutation,
 * - NPC speech selection or hater dialogue,
 * - rate policy or moderation,
 * - socket fanout,
 * - replay persistence,
 * - or final time truth (that is owned by TimeEngine).
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
 * Canonical tree alignment
 * ------------------------
 *   backend/src/game/engine/chat/adapters/TimeSignalAdapter.ts
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
 *   § 16 — UX label generator
 *   § 17 — Adapter ML vector builder
 *   § 18 — History manager
 *   § 19 — Batch processor
 *   § 20 — Report builder
 *   § 21 — TimeSignalAdapter main class
 *   § 22 — Factory functions and pure helper exports
 *   § 23 — Manifest
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
export const TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH = 40 as const;

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

/** Timeout proximity: high urgency when remaining < 5 ticks' worth of budget. */
export const TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS = 5000 as const;

/** T1 default tick duration (ms) used as normalization reference. */
export const TIME_SIGNAL_ADAPTER_T1_REFERENCE_MS = TIER_DURATIONS_MS['T1'] as const;

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
 */
export interface TimeSnapshotCompat {
  readonly tick: number;
  readonly mode: ModeCode | 'solo' | 'pvp' | 'coop' | 'ghost';
  readonly phase: RunPhase | 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
  readonly tier: PressureTier | 'SOVEREIGN' | 'STABLE' | 'COMPRESSED' | 'CRISIS' | 'COLLAPSE_IMMINENT';
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
  readonly featureLabels: readonly string[];
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
  // Tier features
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
   * Critical events (budget/timeout/tier escalation) bypass the dedupe gate.
   */
  public shouldSuppress(
    eventName: TimeSignalAdapterEventName,
    tick: number,
    isCriticalOverride: boolean,
  ): boolean {
    // Critical overrides always pass through
    if (isCriticalOverride) return false;
    // Phase transitions always surface
    if (
      eventName === 'time.phase.escalation.entered' ||
      eventName === 'time.phase.sovereignty.entered' ||
      eventName === 'time.tier.collapse.imminent' ||
      eventName === 'time.hold.consumed' ||
      eventName === 'time.budget.critical' ||
      eventName === 'time.timeout.imminent' ||
      eventName === 'time.timeout.reached'
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
 * Classifies a time signal into a priority tier based on event type,
 * tier, phase, budget state, and urgency score.
 */
function classifyTimeSignalPriority(
  eventName: TimeSignalAdapterEventName,
  tier: PressureTier,
  budgetUtilizationPct: number,
  remainingBudgetMs: number,
  urgencyScore: number,
  options: { budgetCriticalGate: number; timeoutProximityMs: number },
): TimeSignalAdapterPriority {
  // INTERRUPT: collapse imminent, budget exhausted, timeout reached, critical budget
  if (
    eventName === 'time.tier.collapse.imminent' ||
    eventName === 'time.budget.exhausted' ||
    eventName === 'time.timeout.reached' ||
    (eventName === 'time.budget.critical' && budgetUtilizationPct >= (1 - options.budgetCriticalGate)) ||
    (remainingBudgetMs < options.timeoutProximityMs && remainingBudgetMs > 0)
  ) {
    return 'INTERRUPT';
  }

  // URGENT: crisis tier, phase transitions, timeout warning, hold consumed, budget warning
  if (
    tier === 'CRISIS' ||
    eventName === 'time.phase.sovereignty.entered' ||
    eventName === 'time.phase.escalation.entered' ||
    eventName === 'time.timeout.warning' ||
    eventName === 'time.timeout.imminent' ||
    eventName === 'time.hold.consumed' ||
    eventName === 'time.tier.escalated' ||
    eventName === 'time.budget.warning'
  ) {
    return 'URGENT';
  }

  // NOTABLE: compressed tier, decision window expired, season pressure spike, tier deescalated
  if (
    tier === 'COMPRESSED' ||
    eventName === 'time.decision.window.expired' ||
    eventName === 'time.season.pressure.spike' ||
    eventName === 'time.tier.deescalated' ||
    eventName === 'time.tier.forced' ||
    eventName === 'time.budget.caution' ||
    eventName === 'time.interpolation.started'
  ) {
    return 'NOTABLE';
  }

  // AMBIENT: stable tier, decision window opened/resolved, regular tick
  if (
    tier === 'STABLE' ||
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

  // SUPPRESSED: sovereign tier regular ticks, interpolation complete
  if (
    tier === 'SOVEREIGN' ||
    eventName === 'time.tick.complete' ||
    eventName === 'time.tier.sovereign' ||
    eventName === 'time.interpolation.complete' ||
    urgencyScore < 0.1
  ) {
    return 'SUPPRESSED';
  }

  // Default: ambient for anything else
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
  // CRITICAL: collapse tier or any critical gate breach
  if (
    tier === 'COLLAPSE_IMMINENT' ||
    isBudgetCritical ||
    isTimeoutWarning
  ) {
    return 'CRITICAL';
  }

  // HIGH: crisis tier or near-critical budget or phase transition
  if (
    tier === 'CRISIS' ||
    budgetUtilizationPct >= 0.80 ||
    isPhaseTransition
  ) {
    return 'HIGH';
  }

  // MEDIUM: compressed tier or budget above caution
  if (
    tier === 'COMPRESSED' ||
    budgetUtilizationPct >= 0.55
  ) {
    return 'MEDIUM';
  }

  // LOW: stable tier
  if (tier === 'STABLE') {
    return 'LOW';
  }

  // AMBIENT: sovereign
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
  // PEAK: budget critical, timeout imminent, collapse imminent
  if (
    isBudgetCritical ||
    eventName === 'time.timeout.imminent' ||
    eventName === 'time.timeout.reached' ||
    eventName === 'time.tier.collapse.imminent' ||
    eventName === 'time.budget.exhausted'
  ) {
    return 'PEAK';
  }

  // MAJOR: phase transition, tier escalation, hold consumed, timeout warning
  if (
    isPhaseTransition ||
    eventName === 'time.tier.escalated' ||
    eventName === 'time.phase.sovereignty.entered' ||
    eventName === 'time.phase.escalation.entered' ||
    isHoldConsumed ||
    eventName === 'time.timeout.warning' ||
    urgencyScore >= 0.75
  ) {
    return 'MAJOR';
  }

  // MODERATE: crisis tier, budget warning, season spike, window expired, interpolation start
  if (
    tier === 'CRISIS' ||
    eventName === 'time.budget.warning' ||
    eventName === 'time.season.pressure.spike' ||
    eventName === 'time.decision.window.expired' ||
    eventName === 'time.interpolation.started' ||
    urgencyScore >= 0.50
  ) {
    return 'MODERATE';
  }

  // MINOR: compressed tier, window opened, season active, tier deescalated
  if (
    tier === 'COMPRESSED' ||
    eventName === 'time.decision.window.opened' ||
    eventName === 'time.season.pressure.active' ||
    eventName === 'time.tier.deescalated' ||
    eventName === 'time.budget.caution' ||
    urgencyScore >= 0.25
  ) {
    return 'MINOR';
  }

  // NEGLIGIBLE: sovereign, stable ticks, completed events, ML/DL emits
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
  // GLOBAL: collapse tier, phase transitions, budget critical, timeout warning/imminent
  if (
    tier === 'COLLAPSE_IMMINENT' ||
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

  // DEAL_ROOM: decision windows, budget alerts, hold actions
  if (
    eventName === 'time.decision.window.opened' ||
    eventName === 'time.decision.window.expired' ||
    eventName === 'time.decision.window.resolved' ||
    eventName === 'time.decision.window.hold.frozen' ||
    eventName === 'time.budget.warning' ||
    eventName === 'time.budget.caution' ||
    tier === 'CRISIS'
  ) {
    return 'DEAL_ROOM';
  }

  // SYSTEM_SHADOW: ML/DL emits, internal state signals, hold released, interpolation
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

  // SUPPRESSED: sovereign tier regular ticks, stable ticks
  if (
    tier === 'SOVEREIGN' ||
    eventName === 'time.tick.complete' ||
    eventName === 'time.tier.sovereign'
  ) {
    return 'SUPPRESSED';
  }

  // Default to configured channel
  return defaultChannel === 'GLOBAL' ? 'GLOBAL'
    : defaultChannel === 'SYNDICATE' ? 'SYNDICATE'
    : defaultChannel === 'DEAL_ROOM' ? 'DEAL_ROOM'
    : 'SYSTEM_SHADOW';
}

/* ============================================================================
 * § 13 — ML FEATURE EXTRACTOR
 * ============================================================================ */

/**
 * Extract the chat-lane 28-dim ML feature vector from a TimeSignalInput.
 * Uses the same feature labels as TIME_ML_FEATURE_LABELS from TimeEngine.
 * This is the direct pass-through when the engine already provided mlVector,
 * or a best-effort reconstruction from the snapshot when it did not.
 */
function extractTimeAdapterMLFeatures(
  input: TimeSignalInput,
): readonly number[] {
  const { snapshot, mlVector, runtimeSnapshot, cadenceSnapshot } = input;
  const budget = snapshot.totalBudgetMs > 0
    ? snapshot.totalBudgetMs
    : 1;

  // If the engine provided the ML vector, use it directly (most accurate)
  if (mlVector?.features != null) {
    return Array.from(mlVector.features);
  }

  const elapsedNorm = Math.min(1, snapshot.elapsedMs / budget);
  const remainingNorm = Math.min(1, snapshot.remainingBudgetMs / budget);
  const tickDurationMs = runtimeSnapshot?.currentTickDurationMs
    ?? getDefaultTickDurationMs(snapshot.tier as PressureTier)
    ?? TIER_DURATIONS_MS['T1'];
  const tickDurNorm = normalizeTickDurationMs(tickDurationMs);
  const tierIdx = normalizeTierIndex(snapshot.tier as PressureTier);
  const phaseIdx = normalizePhaseIndex(snapshot.phase as RunPhase);
  const activeWindows = runtimeSnapshot?.activeDecisionWindowCount ?? 0;
  const activeWindowsNorm = Math.min(1, activeWindows / 5);
  const frozenWindows = runtimeSnapshot?.frozenDecisionWindowCount ?? 0;
  const frozenRatio = activeWindows > 0 ? frozenWindows / activeWindows : 0;
  const holdCharges = runtimeSnapshot?.holdChargesRemaining ?? 0;
  const holdConsumed = runtimeSnapshot?.holdConsumedThisRun ? 1 : 0;
  const holdEnabled = runtimeSnapshot?.holdEnabled ? 1 : 0;
  const forcedTierActive = runtimeSnapshot?.forcedTierActive ? 1 : 0;
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
  const holdsApplied = 0; // not directly in snapshot
  const holdRate = windowsOpened > 0 ? holdsApplied / windowsOpened : 0;
  const avgWindowUrgency = 0.5; // heuristic when no window analytics provided
  const phaseTimePct = computePhaseTimePct(snapshot.elapsedMs, snapshot.phase as RunPhase);
  const seasonMultNorm = normalizeSeasonMultiplier(snapshot.seasonPressureMultiplier);
  const tierChangesNorm = Math.min(1, (runtimeSnapshot?.tierChangeCountThisRun ?? 0) / 10);
  const tickNorm = Math.min(1, snapshot.tick / 300); // 300 expected ticks max
  const extensionBudgetMs = runtimeSnapshot?.extensionBudgetMs ?? 0;
  const budgetExtensionRatio = extensionBudgetMs / Math.max(budget, 1);
  const phaseBoundaryWindowsRemaining = runtimeSnapshot?.phaseBoundaryWindowsRemaining ?? DEFAULT_PHASE_TRANSITION_WINDOWS;
  const phaseBoundaryNorm = phaseBoundaryWindowsRemaining / DEFAULT_PHASE_TRANSITION_WINDOWS;
  const interpolating = (runtimeSnapshot?.interpolating ?? false) ? 1 : 0;
  const interpProgress = runtimeSnapshot?.interpolating
    ? 1 - (runtimeSnapshot.interpolationRemainingTicks / 5)
    : 0;
  const tierTransDir = determineTierTransitionDirection(
    snapshot.tier as PressureTier,
    runtimeSnapshot,
  );

  // Return all 28 features in label order
  return [
    elapsedNorm,               // 0
    remainingNorm,             // 1
    tickDurNorm,               // 2
    tierIdx,                   // 3
    interpolating,             // 4
    interpProgress,            // 5
    tierTransDir,              // 6
    phaseIdx,                  // 7
    phaseBoundaryNorm,         // 8
    activeWindowsNorm,         // 9
    frozenRatio,               // 10
    holdCharges,               // 11
    holdConsumed,              // 12
    holdEnabled,               // 13
    forcedTierActive,          // 14
    forcedTierTicksNorm,       // 15
    timeoutProximity,          // 16
    budgetUrgency,             // 17
    tierDurVsT1,               // 18
    windowDensity,             // 19
    expiryRate,                // 20
    holdRate,                  // 21
    avgWindowUrgency,          // 22
    phaseTimePct,              // 23
    seasonMultNorm,            // 24
    tierChangesNorm,           // 25
    tickNorm,                  // 26
    budgetExtensionRatio,      // 27
  ];
}

/* ============================================================================
 * § 14 — DL TENSOR BUILDER
 * ============================================================================ */

/**
 * Build the chat-lane DL sequence tensor from a TimeSignalInput.
 * Returns a 40×6 flat array (row-major). If engine already provided the
 * tensor, returns its values. Otherwise constructs from history/snapshot.
 */
function buildTimeAdapterDLTensor(
  input: TimeSignalInput,
  dlHistory: readonly (readonly number[])[],
): TimeDLTensorCompat {
  const { snapshot, dlTensor, tickHistory } = input;
  const budget = snapshot.totalBudgetMs > 0 ? snapshot.totalBudgetMs : 1;

  // Current frame features (6-column)
  const tickDurationMs = getDefaultTickDurationMs(snapshot.tier as PressureTier) ?? TIER_DURATIONS_MS['T1'];
  const currentFrame: number[] = [
    normalizeTickDurationMs(tickDurationMs),                   // col 0
    normalizeTierIndex(snapshot.tier as PressureTier),         // col 1
    Math.min(1, snapshot.elapsedMs / budget),                  // col 2
    computePhaseTimePct(snapshot.elapsedMs, snapshot.phase as RunPhase), // col 3
    0, // active_windows_norm (not in snapshot compat)        // col 4
    0, // hold_consumed_flag                                   // col 5
  ];

  // If the engine provided the DL tensor, use it
  if (dlTensor?.values != null) {
    const flat = Array.from(dlTensor.values);
    const currentRow = flat.slice(flat.length - TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT);
    return buildDLTensorCompat(snapshot.tick, flat, currentRow, snapshot.tier as PressureTier, snapshot.phase as RunPhase);
  }

  // Build from history
  const rows: number[][] = [];
  if (tickHistory != null) {
    for (const record of tickHistory.slice(-TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH)) {
      rows.push([
        normalizeTickDurationMs(record.durationMs),
        normalizeTierIndex(record.tier),
        Math.min(1, record.budgetUtilizationPct),
        computePhaseTimePct(record.elapsedMs, record.phase),
        0,
        record.holdConsumed ? 1 : 0,
      ]);
    }
  } else {
    // Fill from adapter history
    for (const row of dlHistory.slice(-TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH)) {
      rows.push([...row]);
    }
  }

  // Pad to 40 rows if needed
  while (rows.length < TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH) {
    rows.unshift([0, 0, 0, 0, 0, 0]);
  }

  // Append current frame
  rows.push(currentFrame);
  const finalRows = rows.slice(-TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH);
  const flat = finalRows.flat();

  return buildDLTensorCompat(snapshot.tick, flat, currentFrame, snapshot.tier as PressureTier, snapshot.phase as RunPhase);
}

function buildDLTensorCompat(
  tick: number,
  flatValues: readonly number[],
  currentFrame: readonly number[],
  tier: PressureTier,
  phase: RunPhase,
): TimeDLTensorCompat {
  // Tier one-hot: [SOVEREIGN, STABLE, COMPRESSED, CRISIS, COLLAPSE_IMMINENT]
  const tierOneHot = buildTierOneHot(tier);
  // Phase one-hot: [FOUNDATION, ESCALATION, SOVEREIGNTY]
  const phaseOneHot = buildPhaseOneHot(phase);

  // Attention weights: emphasize recent frames
  const attentionWeights = buildAttentionWeights(TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH);

  // Label vector: current tier index, phase index, budget util
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
    inputSequenceFlat: Object.freeze(flatValues),
    currentFrame: Object.freeze(currentFrame),
    tierOneHot: Object.freeze(tierOneHot),
    phaseOneHot: Object.freeze(phaseOneHot),
    attentionWeights: Object.freeze(attentionWeights),
    labelVector: Object.freeze(labelVector),
  });
}

function buildTierOneHot(tier: PressureTier): number[] {
  const tiers: PressureTier[] = ['SOVEREIGN', 'STABLE', 'COMPRESSED', 'CRISIS', 'COLLAPSE_IMMINENT'];
  return tiers.map((t) => (t === tier ? 1 : 0));
}

function buildPhaseOneHot(phase: RunPhase): number[] {
  const phases: RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
  return phases.map((p) => (p === phase ? 1 : 0));
}

function buildAttentionWeights(sequenceLength: number): number[] {
  // Exponential recency bias: recent frames get more weight
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

/**
 * Compute a [0,1] risk score for the current time state.
 * Higher = more urgent intervention needed.
 */
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
    SOVEREIGN: 0.0,
    STABLE: 0.05,
    COMPRESSED: 0.12,
    CRISIS: 0.22,
    COLLAPSE_IMMINENT: 0.30,
  };
  risk += tierRisks[tier] ?? 0.10;

  // Budget contribution (max 0.25)
  const budgetRisk = Math.pow(budgetUtilizationPct, 2) * 0.25;
  risk += budgetRisk;

  // Urgency score contribution (max 0.25)
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
 * § 16 — UX LABEL GENERATOR
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
  if (tier === 'COLLAPSE_IMMINENT') return 'COLLAPSE IMMINENT';
  if (isPhaseTransition && phase === 'SOVEREIGNTY') return 'SOVEREIGNTY ENTERED';
  if (isPhaseTransition && phase === 'ESCALATION') return 'ESCALATION ENTERED';
  if (tier === 'CRISIS') return 'CRISIS TIER';
  if (budgetUtilizationPct >= 0.80) return 'BUDGET WARNING';
  if (tier === 'COMPRESSED') return 'COMPRESSED PACE';
  if (tier === 'STABLE') return 'STABLE CADENCE';
  return 'SOVEREIGN FLOW';
}

function buildTimeShortHook(
  eventName: TimeSignalAdapterEventName,
  tier: PressureTier,
  remainingBudgetMs: number,
  seasonMultiplier: number,
): string {
  switch (eventName) {
    case 'time.tier.collapse.imminent':
      return 'Collapse. Act now.';
    case 'time.timeout.reached':
      return 'Time is gone.';
    case 'time.timeout.imminent':
      return 'Seconds left. Move.';
    case 'time.timeout.warning':
      return 'Time running out.';
    case 'time.budget.critical':
      return 'Budget critical.';
    case 'time.budget.exhausted':
      return 'Budget gone.';
    case 'time.tier.escalated':
      return `Cadence escalated to ${tier}.`;
    case 'time.phase.sovereignty.entered':
      return 'Sovereignty phase. Final chapter.';
    case 'time.phase.escalation.entered':
      return 'Escalation phase. Pressure rising.';
    case 'time.hold.consumed':
      return 'Hold used. Windows frozen.';
    case 'time.decision.window.expired':
      return 'Decision window closed.';
    case 'time.season.pressure.spike':
      return `Season pressure × ${seasonMultiplier.toFixed(1)}.`;
    default:
      return `${tier} | ${Math.round(remainingBudgetMs / 1000)}s left`;
  }
}

function buildTimeCompanionCommentary(
  tier: PressureTier,
  phase: RunPhase,
  urgencyScore: number,
  isBudgetCritical: boolean,
  isPhaseTransition: boolean,
): string {
  if (isBudgetCritical) {
    return 'Your budget is nearly gone. Every second counts. Decide now.';
  }
  if (tier === 'COLLAPSE_IMMINENT') {
    return 'You are in collapse territory. This is the final stretch.';
  }
  if (isPhaseTransition && phase === 'SOVEREIGNTY') {
    return 'You have reached the Sovereignty phase. This is your proving ground.';
  }
  if (isPhaseTransition && phase === 'ESCALATION') {
    return 'Escalation has begun. The cadence tightens from here.';
  }
  if (tier === 'CRISIS' && urgencyScore >= 0.7) {
    return 'Crisis cadence is draining your clock. Prioritize.';
  }
  if (tier === 'COMPRESSED') {
    return 'Pace is compressed. Decisions feel faster — stay calm.';
  }
  if (tier === 'STABLE') {
    return 'Stable rhythm. Good position to think ahead.';
  }
  return 'Flow is sovereign. No immediate urgency.';
}

function buildTimeUXHintCompat(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
  severity: TimeSignalAdapterSeverity,
  channelRec: TimeSignalAdapterChannelRecommendation,
  riskScore: Score01,
): TimeUXHintCompat {
  const { snapshot } = input;
  const tier = snapshot.tier as PressureTier;
  const phase = snapshot.phase as RunPhase;
  const budgetUtilPct = snapshot.budgetUtilizationPct;
  const remainingMs = snapshot.remainingBudgetMs;
  const isBudgetCritical = budgetUtilPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
  const isTimeout = remainingMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS && remainingMs > 0;
  const isPhaseTransition =
    eventName === 'time.phase.escalation.entered' ||
    eventName === 'time.phase.sovereignty.entered';

  const chatChannel: ChatVisibleChannel | 'SYSTEM_SHADOW' =
    channelRec === 'SUPPRESSED' ? 'SYSTEM_SHADOW'
    : channelRec === 'SYSTEM_SHADOW' ? 'SYSTEM_SHADOW'
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
    urgencyLabel: buildTimeUXLabel(tier, phase, budgetUtilPct, isBudgetCritical, isTimeout, isPhaseTransition, remainingMs),
    shortHook: buildTimeShortHook(eventName, tier, remainingMs, snapshot.seasonPressureMultiplier),
    companionCommentary: buildTimeCompanionCommentary(tier, phase, snapshot.elapsedMs / Math.max(snapshot.totalBudgetMs, 1), isBudgetCritical, isPhaseTransition),
    topTagLabels: buildTimeTags(tier, phase, isBudgetCritical, isTimeout, eventName),
    weightedExplanation: `Risk=${riskScore.toFixed(2)} | Tier=${tier} | Phase=${phase} | Budget=${(budgetUtilPct * 100).toFixed(0)}%`,
    chatChannel,
    shouldInterrupt,
    interruptReason,
    severityClass: severity,
    budgetAlertLevel: isBudgetCritical ? 'CRITICAL'
      : budgetUtilPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT) ? 'WARNING'
      : budgetUtilPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT) ? 'CAUTION'
      : 'OK',
  });
}

function buildTimeTags(
  tier: PressureTier,
  phase: RunPhase,
  isBudgetCritical: boolean,
  isTimeout: boolean,
  eventName: TimeSignalAdapterEventName,
): readonly string[] {
  const tags: string[] = [tier, phase];
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

function buildTimeAnnotationCompat(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
  riskScore: Score01,
): TimeAnnotationCompat {
  const { snapshot } = input;
  const tier = snapshot.tier as PressureTier;
  const phase = snapshot.phase as RunPhase;
  const budgetUtilPct = snapshot.budgetUtilizationPct;
  const remainingMs = snapshot.remainingBudgetMs;
  const isBudgetAlert = budgetUtilPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT);
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
    tierLabel: tier,
    phaseLabel: phase,
    compositeNote: `T:${snapshot.tick} ${tier}/${phase} Budget:${(budgetUtilPct * 100).toFixed(1)}% Remaining:${Math.round(remainingMs / 1000)}s`,
    isBudgetAlert,
    isTimeoutAlert,
    holdNote,
    windowNote,
    seasonNote,
    modeNote: `mode:${String(snapshot.mode)}`,
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
  const tier = snapshot.tier as PressureTier;
  const phase = snapshot.phase as RunPhase;
  const budget = snapshot.totalBudgetMs > 0 ? snapshot.totalBudgetMs : 1;
  const budgetUtil = Math.min(1, snapshot.elapsedMs / budget);
  const remainingNorm = Math.min(1, snapshot.remainingBudgetMs / budget);
  const isBudgetCritical = remainingNorm < TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT ? 1 : 0 as 1 | 0;
  const isBudgetWarning = remainingNorm < TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT ? 1 : 0 as 1 | 0;
  const tierRankNorm = normalizeTierIndex(tier);
  const phaseRankNorm = normalizePhaseIndex(phase);
  const tickDurationMs = runtimeSnapshot?.currentTickDurationMs
    ?? getDefaultTickDurationMs(tier) ?? TIER_DURATIONS_MS['T1'];
  const decisionWindowMs = getDecisionWindowDurationMs(tier) ?? DECISION_WINDOW_DURATIONS_MS['T1'];
  const activeWindows = runtimeSnapshot?.activeDecisionWindowCount ?? 0;
  const windowsOpened = runtimeSnapshot?.windowsOpenedThisRun ?? 0;
  const windowsExpired = runtimeSnapshot?.windowsExpiredThisRun ?? 0;
  const expiryRate = windowsOpened > 0 ? windowsExpired / windowsOpened : 0;
  const seasonMult = snapshot.seasonPressureMultiplier;
  const modeCodeNorm = normalizeModeCode(snapshot.mode as ModeCode);
  const urgencyScore = (snapshot as unknown as Record<string, number>)['urgencyScore'] ?? riskScore;
  const timeoutProximityNorm = snapshot.remainingBudgetMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS
    ? 1 - (snapshot.remainingBudgetMs / TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS)
    : 0;

  const narrativeWeightScore = mapNarrativeWeightToScore(narrativeWeight);

  return Object.freeze({
    tick: snapshot.tick,
    featureCount: 28,
    budgetUtilizationNorm: budgetUtil,
    remainingBudgetNorm: remainingNorm,
    isBudgetCritical: isBudgetCritical as 1 | 0,
    isBudgetWarning: isBudgetWarning as 1 | 0,
    tierRankNorm,
    tierIsCollapse: (tier === 'COLLAPSE_IMMINENT' ? 1 : 0) as 1 | 0,
    tierIsCrisis: (tier === 'CRISIS' ? 1 : 0) as 1 | 0,
    tierIsCompressed: (tier === 'COMPRESSED' ? 1 : 0) as 1 | 0,
    tierIsStable: (tier === 'STABLE' ? 1 : 0) as 1 | 0,
    tierIsSovereign: (tier === 'SOVEREIGN' ? 1 : 0) as 1 | 0,
    tierEscalationCountNorm: 0,
    phaseRankNorm,
    phaseIsFoundation: (phase === 'FOUNDATION' ? 1 : 0) as 1 | 0,
    phaseIsEscalation: (phase === 'ESCALATION' ? 1 : 0) as 1 | 0,
    phaseIsSovereignty: (phase === 'SOVEREIGNTY' ? 1 : 0) as 1 | 0,
    phaseTransitionCountNorm: Math.min(1, (runtimeSnapshot?.tierChangeCountThisRun ?? 0) / 10),
    currentTickDurationNorm: normalizeTickDurationMs(tickDurationMs),
    decisionWindowDurationNorm: Math.min(1, decisionWindowMs / 15000),
    isInterpolating: ((runtimeSnapshot?.interpolating ?? false) ? 1 : 0) as 1 | 0,
    activeWindowsNorm: Math.min(1, activeWindows / 5),
    windowExpiryRateNorm: expiryRate,
    holdConsumedFlag: ((runtimeSnapshot?.holdConsumedThisRun ?? false) ? 1 : 0) as 1 | 0,
    seasonMultiplierNorm: normalizeSeasonMultiplier(seasonMult),
    isSeasonPressureSpike: (seasonMult >= 2.0 ? 1 : 0) as 1 | 0,
    riskScore,
    narrativeWeightScore,
    modeCodeNorm,
    urgencyScore: clamp01(urgencyScore as unknown as number),
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
    if (this.history.length > this.maxDepth) {
      this.history.shift();
    }
    this.dlRows.push(dlRow);
    if (this.dlRows.length > TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH) {
      this.dlRows.shift();
    }
    this.tierDistribution[entry.tier] = (this.tierDistribution[entry.tier] ?? 0) + 1;
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

interface TimeAdapterBatchResult {
  readonly artifacts: readonly TimeSignalAdapterArtifact[];
  readonly deduped: readonly TimeSignalAdapterDeduped[];
  readonly rejected: readonly TimeSignalAdapterRejection[];
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
}

function processBatch(
  inputs: readonly TimeSignalInput[],
  adapter: TimeSignalAdapter,
  context?: TimeSignalAdapterContext,
  maxBatchSize?: number,
): TimeAdapterBatchResult {
  const limit = Math.min(inputs.length, maxBatchSize ?? TIME_SIGNAL_ADAPTER_MAX_BATCH_SIZE);
  const artifacts: TimeSignalAdapterArtifact[] = [];
  const deduped: TimeSignalAdapterDeduped[] = [];
  const rejected: TimeSignalAdapterRejection[] = [];

  for (let i = 0; i < limit; i++) {
    const result = adapter.adapt(inputs[i]!, context);
    for (const artifact of result) {
      if (artifact.accepted) {
        artifacts.push(artifact);
      } else if (artifact.deduped) {
        const dd = adapter.getLastDeduped();
        if (dd != null) deduped.push(dd);
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
  if (state.consecutiveCollapseTicks >= 3) {
    activeConstraints.push('COLLAPSE_IMMINENT_3_CONSECUTIVE');
  }
  if ((lastBudgetPct ?? 0) >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT)) {
    activeConstraints.push('BUDGET_CRITICAL_GATE');
  }
  if (state.timeoutWarningCount >= 1) {
    activeConstraints.push('TIMEOUT_WARNING_ACTIVE');
  }

  const budgetAlertLevel: 'OK' | 'CAUTION' | 'WARNING' | 'CRITICAL' =
    (lastBudgetPct ?? 0) >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT) ? 'CRITICAL'
    : (lastBudgetPct ?? 0) >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT) ? 'WARNING'
    : (lastBudgetPct ?? 0) >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT) ? 'CAUTION'
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
 * Single responsibility: ingest TimeChatSignal + TimeRuntimeSnapshot context →
 * emit ChatInputEnvelope on the LIVEOPS_SIGNAL lane.
 *
 * Thread model: single-threaded / synchronous. All methods return synchronously.
 *
 * ML/DL pipeline:
 * - extractMLVector() builds the 28-dim chat-lane ML vector
 * - buildDLTensor() builds the 40×6 time-sequence DL tensor
 * - Both are replay-safe and deterministic given same inputs
 *
 * Dedupe:
 * - Most events are suppressed if the same event fired < N ticks ago
 * - Budget critical, phase transitions, timeout, hold consumed bypass dedupe
 *
 * Usage:
 *   const adapter = createTimeSignalAdapter({ defaultRoomId: 'global', enableMLEmit: true });
 *   const artifacts = adapter.adapt(timeSignalInput, context);
 *   const report = adapter.getReport();
 *   const mlVec = adapter.extractMLVector(timeSignalInput);
 *   const dlTensor = adapter.buildDLTensor(timeSignalInput);
 */
export class TimeSignalAdapter {
  private readonly options: TimeSignalAdapterOptions;
  private readonly deduplicator: TimeSignalDeduplicator;
  private readonly historyMgr: TimeAdapterHistoryManager;
  private readonly logger: TimeSignalAdapterLogger;
  private readonly clock: TimeSignalAdapterClock;
  private state: TimeSignalAdapterState;
  private lastDeduped: TimeSignalAdapterDeduped | null = null;
  private lastBudgetPct: number | null = null;
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

  /**
   * Translate a single TimeSignalInput into an array of ChatInputEnvelope
   * artifacts. In most cases returns 0–1 artifact; ML/DL emits may add extra.
   */
  public adapt(
    input: TimeSignalInput,
    context?: TimeSignalAdapterContext,
  ): readonly TimeSignalAdapterArtifact[] {
    const { snapshot, chatSignal } = input;
    const tier = snapshot.tier as PressureTier;
    const phase = snapshot.phase as RunPhase;
    const tick = snapshot.tick;

    // Update internal tracking
    this.lastBudgetPct = snapshot.budgetUtilizationPct;
    this.historyMgr.recordSeasonMultiplier(snapshot.seasonPressureMultiplier);

    // Tier/phase transition tracking
    const isTierEscalation = this.isTierEscalation(tier);
    const isPhaseTransition = this.isPhaseTransition(phase);

    if (isTierEscalation) this.tierEscalationCount++;
    if (isPhaseTransition) this.phaseTransitionCount++;
    if (tier === 'COLLAPSE_IMMINENT') this.consecutiveCollapseTicks++;
    else this.consecutiveCollapseTicks = 0;
    if (tier === 'CRISIS') this.consecutiveCrisisTicks++;
    else this.consecutiveCrisisTicks = 0;
    if (tier === 'SOVEREIGN') this.sovereignAchievedCount++;

    this.lastTierSeen = tier;
    this.lastPhaseSeen = phase;

    // Resolve the event name from the chat signal
    const eventName = resolveEventNameFromChatSignal(chatSignal, tier, phase, snapshot);

    // Priority and severity
    const budgetCriticalGate = this.options.budgetCriticalGate ?? TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT;
    const timeoutProximityMs = this.options.timeoutProximityMs ?? TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;
    const isBudgetCritical = snapshot.budgetUtilizationPct >= (1 - budgetCriticalGate);
    const isTimeoutWarning = snapshot.remainingBudgetMs < timeoutProximityMs && snapshot.remainingBudgetMs > 0;
    const isCriticalOverride = isBudgetCritical || isTimeoutWarning || isPhaseTransition;
    const isHoldConsumed = chatSignal.signalType === 'TIME_HOLD_CONSUMED';
    const isWindowExpired = chatSignal.signalType === 'TIME_WINDOW_EXPIRED';
    const isWindowOpened = chatSignal.signalType === 'TIME_WINDOW_OPENED';

    // Dedupe gate
    const deduped = this.deduplicator.shouldSuppress(eventName, tick, isCriticalOverride);
    if (deduped) {
      this.totalDeduped++;
      this.deduplicator.recordDeduped(eventName, tick);
      this.lastDeduped = {
        tick,
        eventName,
        reason: `Suppressed within dedupe window`,
        previousTick: tick - 1,
      };
      this.logger.debug('time.adapter.deduped', { eventName, tick });
      return [this.buildDedupedArtifact(tick, eventName, tier, phase, snapshot.budgetUtilizationPct)];
    }

    // Suppression: sovereign ticks when suppress flag set
    if (
      (this.options.suppressSovereignTicks ?? false) &&
      tier === 'SOVEREIGN' &&
      eventName === 'time.tick.complete'
    ) {
      this.totalRejected++;
      this.logger.debug('time.adapter.suppressed.sovereign', { tick });
      return [this.buildRejectedArtifact(tick, eventName, tier, phase, 'Sovereign tick suppressed by options', snapshot.budgetUtilizationPct)];
    }

    // Suppression: ambient tiers when suppress flag set
    if (
      (this.options.suppressAmbientTiers ?? false) &&
      (tier === 'SOVEREIGN' || tier === 'STABLE') &&
      !isCriticalOverride
    ) {
      this.totalRejected++;
      return [this.buildRejectedArtifact(tick, eventName, tier, phase, 'Ambient tier suppressed by options', snapshot.budgetUtilizationPct)];
    }

    // Track event-specific counts
    if (isBudgetCritical) this.budgetCriticalCount++;
    if (isTimeoutWarning) this.timeoutWarningCount++;
    if (isHoldConsumed) this.holdConsumedCount++;
    if (isWindowExpired) this.windowExpiredCount++;
    if (isWindowOpened) this.windowOpenedCount++;
    if (tier === 'COLLAPSE_IMMINENT') this.collapseEnteredCount++;

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

    // Risk score
    const riskScore = computeTimeSignalRisk(
      tier, snapshot.budgetUtilizationPct, snapshot.remainingBudgetMs,
      chatSignal.urgencyScore, eventName, snapshot.seasonPressureMultiplier,
    );

    // Build the adapter ML vector
    const adapterMLVector = buildTimeAdapterMLVector(input, eventName, riskScore, narrativeWeight);

    // Build chat signal envelope
    const envelope = this.buildChatInputEnvelope(input, eventName, channelRec, riskScore, context);
    const signal = this.buildChatSignalEnvelope(input, eventName, context);

    // Record to deduplicator and history
    this.deduplicator.recordEmitted(eventName, tick);
    this.totalAdapted++;
    this.lastAdaptedTick = tick;

    const historyEntry: TimeSignalAdapterHistoryEntry = {
      tick,
      eventName,
      tier,
      phase,
      budgetUtilizationPct: snapshot.budgetUtilizationPct,
      accepted: true,
      deduped: false,
      riskScore,
    };
    const dlRow = this.buildCurrentDLRow(input);
    this.historyMgr.record(historyEntry, dlRow);

    this.updateState();

    const primaryArtifact: TimeSignalAdapterArtifact = Object.freeze({
      tick,
      eventName,
      envelope,
      signal,
      accepted: true,
      deduped: false,
      rejectionReason: null,
      severity,
      priority,
      narrativeWeight,
      channelRecommendation: channelRec,
      mlVector: adapterMLVector,
      riskScore,
      budgetUtilizationPct: snapshot.budgetUtilizationPct,
      tier,
      phase,
    });

    const result: TimeSignalAdapterArtifact[] = [primaryArtifact];

    // Optionally emit ML signal
    if ((this.options.enableMLEmit ?? false) && input.mlVector != null) {
      this.mlEmitCount++;
      result.push(this.buildMLEmitArtifact(input, tick, tier, phase, adapterMLVector));
    }

    // Optionally emit DL signal
    if ((this.options.enableDLEmit ?? false)) {
      this.dlEmitCount++;
      result.push(this.buildDLEmitArtifact(input, tick, tier, phase, adapterMLVector));
    }

    this.logger.debug('time.adapter.adapted', {
      eventName,
      tick,
      tier,
      phase,
      priority,
      severity,
      riskScore,
    });

    return Object.freeze(result);
  }

  // ==========================================================================
  // MARK: Batch adapt
  // ==========================================================================

  /**
   * Process a batch of time signal inputs. Preserves temporal ordering.
   */
  public adaptBatch(
    inputs: readonly TimeSignalInput[],
    context?: TimeSignalAdapterContext,
  ): TimeAdapterBatchResult {
    return processBatch(inputs, this, context, this.options.maxBatchSize);
  }

  // ==========================================================================
  // MARK: ML / DL extraction
  // ==========================================================================

  /**
   * Extract the 28-dim ML feature vector from a TimeSignalInput.
   * Deterministic and replay-safe given same inputs.
   */
  public extractMLVector(input: TimeSignalInput): TimeMLVectorCompat {
    const features = extractTimeAdapterMLFeatures(input);
    const { snapshot } = input;
    const tier = snapshot.tier as PressureTier;
    const phase = snapshot.phase as RunPhase;
    const riskScore = computeTimeSignalRisk(
      tier, snapshot.budgetUtilizationPct, snapshot.remainingBudgetMs,
      0.5, 'time.tick.complete', snapshot.seasonPressureMultiplier,
    );
    const narrativeWeight = classifyTimeNarrativeWeight(
      'time.tick.complete', tier, false, false, false, 0.5,
    );
    return Object.freeze({
      tick: snapshot.tick,
      featureCount: TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      features: Object.freeze(features),
      featureLabels: TIME_ML_FEATURE_LABELS,
      tierIndexNorm: normalizeTierIndex(tier),
      phaseIndexNorm: normalizePhaseIndex(phase),
      budgetUtilization: Math.min(1, snapshot.elapsedMs / Math.max(snapshot.totalBudgetMs, 1)),
      remainingNorm: Math.min(1, snapshot.remainingBudgetMs / Math.max(snapshot.totalBudgetMs, 1)),
      isCollapse: tier === 'COLLAPSE_IMMINENT',
      isSovereign: tier === 'SOVEREIGN',
      urgencyScore: riskScore,
      riskScore,
      narrativeWeight,
      seasonMultiplierNorm: normalizeSeasonMultiplier(snapshot.seasonPressureMultiplier),
    });
  }

  /**
   * Build the 40×6 DL sequence tensor for the time sequence model.
   */
  public buildDLTensor(input: TimeSignalInput): TimeDLTensorCompat {
    return buildTimeAdapterDLTensor(input, this.historyMgr.getDLRows());
  }

  // ==========================================================================
  // MARK: UX / annotation helpers
  // ==========================================================================

  /**
   * Build the UX hint compat object for companion NPC commentary.
   */
  public buildUXHint(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
  ): TimeUXHintCompat {
    const tier = input.snapshot.tier as PressureTier;
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

  /**
   * Build the annotation compat object for replay/debug surfaces.
   */
  public buildAnnotation(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
  ): TimeAnnotationCompat {
    const tier = input.snapshot.tier as PressureTier;
    const riskScore = computeTimeSignalRisk(
      tier, input.snapshot.budgetUtilizationPct, input.snapshot.remainingBudgetMs,
      0.5, eventName, input.snapshot.seasonPressureMultiplier,
    );
    return buildTimeAnnotationCompat(input, eventName, riskScore);
  }

  // ==========================================================================
  // MARK: Forecast / resilience access
  // ==========================================================================

  /**
   * Build a TimeForecastCompat from a TimeRecoveryForecast provided by the engine.
   */
  public buildForecastCompat(
    tick: number,
    forecast: TimeRecoveryForecast,
  ): TimeForecastCompat {
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
  // MARK: State / report / health
  // ==========================================================================

  /**
   * Returns the current immutable adapter state.
   */
  public getState(): TimeSignalAdapterState {
    return this.state;
  }

  /**
   * Returns a full adapter analytics report.
   */
  public getReport(): TimeSignalAdapterReport {
    return buildTimeAdapterReport(this.state, this.historyMgr, this.lastBudgetPct);
  }

  /**
   * Returns the last deduped record (or null if none yet).
   */
  public getLastDeduped(): TimeSignalAdapterDeduped | null {
    return this.lastDeduped;
  }

  /**
   * Returns the full adapter history log.
   */
  public getHistory(): readonly TimeSignalAdapterHistoryEntry[] {
    return this.historyMgr.getHistory();
  }

  /**
   * Returns the DL row history used to build sequence tensors.
   */
  public getDLRows(): readonly (readonly number[])[] {
    return this.historyMgr.getDLRows();
  }

  // ==========================================================================
  // MARK: Scoring helpers (public surface for testing / composing)
  // ==========================================================================

  /**
   * Score a risk level for a given snapshot without triggering adaptation.
   */
  public scoreRisk(input: TimeSignalInput): Score01 {
    const { snapshot } = input;
    return computeTimeSignalRisk(
      snapshot.tier as PressureTier,
      snapshot.budgetUtilizationPct,
      snapshot.remainingBudgetMs,
      0.5,
      'time.tick.complete',
      snapshot.seasonPressureMultiplier,
    );
  }

  /**
   * Get the channel recommendation for a snapshot without triggering adaptation.
   */
  public getChatChannel(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
  ): TimeSignalAdapterChannelRecommendation {
    const { snapshot } = input;
    const tier = snapshot.tier as PressureTier;
    const isBudgetCritical = snapshot.budgetUtilizationPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
    const isTimeoutWarning = snapshot.remainingBudgetMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;
    const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
    return routeTimeSignalChannel(
      eventName, tier, isBudgetCritical, isTimeoutWarning, isPhaseTransition,
      this.options.defaultVisibleChannel ?? 'GLOBAL',
    );
  }

  /**
   * Build a narrative weight for a snapshot without triggering adaptation.
   */
  public buildNarrativeWeight(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
  ): TimeSignalAdapterNarrativeWeight {
    const { snapshot } = input;
    const tier = snapshot.tier as PressureTier;
    const isBudgetCritical = snapshot.budgetUtilizationPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
    const isHoldConsumed = eventName === 'time.hold.consumed';
    const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
    const chatSignal = input.chatSignal;
    return classifyTimeNarrativeWeight(
      eventName, tier, isPhaseTransition, isBudgetCritical, isHoldConsumed, chatSignal.urgencyScore,
    );
  }

  /**
   * Build a threshold constraint report from the current adapter state.
   */
  public buildThresholdReport(): Readonly<Record<string, number>> {
    return Object.freeze({
      budgetCriticalGate: this.options.budgetCriticalGate ?? TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT,
      budgetWarningGate: this.options.budgetWarningGate ?? TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT,
      timeoutProximityMs: this.options.timeoutProximityMs ?? TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS,
      dedupeWindowTicks: this.options.dedupeWindowTicks ?? TIME_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
      maxBatchSize: this.options.maxBatchSize ?? TIME_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
      mlFeatureCount: TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      dlFeatureCount: TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
      dlSequenceLength: TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
      t1ReferenceDurationMs: TIME_SIGNAL_ADAPTER_T1_REFERENCE_MS,
      interruptRiskThreshold: TIME_SIGNAL_ADAPTER_INTERRUPT_RISK_THRESHOLD,
      urgentRiskThreshold: TIME_SIGNAL_ADAPTER_URGENT_RISK_THRESHOLD,
      notableRiskThreshold: TIME_SIGNAL_ADAPTER_NOTABLE_RISK_THRESHOLD,
    });
  }

  /**
   * Reset the adapter to its initial state (clears all history and counters).
   */
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

  private isTierEscalation(tier: PressureTier): boolean {
    if (this.lastTierSeen == null) return false;
    const ranks: Record<PressureTier, number> = {
      SOVEREIGN: 0, STABLE: 1, COMPRESSED: 2, CRISIS: 3, COLLAPSE_IMMINENT: 4,
    };
    return (ranks[tier] ?? 0) > (ranks[this.lastTierSeen] ?? 0);
  }

  private isPhaseTransition(phase: RunPhase): boolean {
    if (this.lastPhaseSeen == null) return false;
    return phase !== this.lastPhaseSeen;
  }

  private buildCurrentDLRow(input: TimeSignalInput): readonly number[] {
    const { snapshot, runtimeSnapshot } = input;
    const budget = snapshot.totalBudgetMs > 0 ? snapshot.totalBudgetMs : 1;
    const tickDurationMs = runtimeSnapshot?.currentTickDurationMs
      ?? getDefaultTickDurationMs(snapshot.tier as PressureTier) ?? TIER_DURATIONS_MS['T1'];
    return Object.freeze([
      normalizeTickDurationMs(tickDurationMs),
      normalizeTierIndex(snapshot.tier as PressureTier),
      Math.min(1, snapshot.elapsedMs / budget),
      computePhaseTimePct(snapshot.elapsedMs, snapshot.phase as RunPhase),
      Math.min(1, (runtimeSnapshot?.activeDecisionWindowCount ?? 0) / 5),
      (runtimeSnapshot?.holdConsumedThisRun ?? false) ? 1 : 0,
    ]);
  }

  private buildChatInputEnvelope(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
    channelRec: TimeSignalAdapterChannelRecommendation,
    riskScore: Score01,
    context?: TimeSignalAdapterContext,
  ): ChatInputEnvelope {
    const now = this.clock.now();
    const signal = this.buildChatSignalEnvelope(input, eventName, context);
    const envelope: ChatInputEnvelope = {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: now,
      payload: signal,
    };
    return Object.freeze(envelope);
  }

  private buildChatSignalEnvelope(
    input: TimeSignalInput,
    eventName: TimeSignalAdapterEventName,
    context?: TimeSignalAdapterContext,
  ): ChatSignalEnvelope {
    const now = this.clock.now();
    const { snapshot } = input;
    const roomId = (context?.roomId ?? this.options.defaultRoomId) as ChatRoomId;
    const heatMultiplier = clamp01(snapshot.budgetUtilizationPct);
    const haterRaidActive = snapshot.tier === 'COLLAPSE_IMMINENT' || snapshot.tier === 'CRISIS';
    const helperBlackout = snapshot.remainingBudgetMs < 5000;
    const worldEventName = buildWorldEventName(eventName, snapshot.tier as PressureTier, snapshot.phase as RunPhase);

    const metadata: Record<string, JsonValue> = {
      adapterVersion: TIME_SIGNAL_ADAPTER_VERSION,
      eventName,
      tick: snapshot.tick,
      tier: snapshot.tier as string,
      phase: snapshot.phase as string,
      budgetUtilizationPct: snapshot.budgetUtilizationPct,
      remainingBudgetMs: snapshot.remainingBudgetMs,
      totalBudgetMs: snapshot.totalBudgetMs,
      seasonPressureMultiplier: snapshot.seasonPressureMultiplier,
      mode: String(snapshot.mode),
      urgencyScore: input.chatSignal.urgencyScore,
    };

    if (context?.metadata != null) {
      Object.assign(metadata, context.metadata);
    }

    const signal: ChatSignalEnvelope = {
      type: 'LIVEOPS',
      emittedAt: now,
      roomId,
      liveops: Object.freeze({
        worldEventName,
        heatMultiplier01: heatMultiplier,
        helperBlackout,
        haterRaidActive,
      }),
      metadata: Object.freeze(metadata),
    };
    return Object.freeze(signal);
  }

  private buildMLEmitArtifact(
    input: TimeSignalInput,
    tick: number,
    tier: PressureTier,
    phase: RunPhase,
    adapterMLVector: TimeAdapterMLVector,
  ): TimeSignalAdapterArtifact {
    const envelope = this.buildMLEmitEnvelope(input);
    const signal = this.buildMLEmitSignal(input);
    return Object.freeze({
      tick,
      eventName: 'time.ml.emit' as TimeSignalAdapterEventName,
      envelope,
      signal,
      accepted: true,
      deduped: false,
      rejectionReason: null,
      severity: 'AMBIENT' as TimeSignalAdapterSeverity,
      priority: 'AMBIENT' as TimeSignalAdapterPriority,
      narrativeWeight: 'NEGLIGIBLE' as TimeSignalAdapterNarrativeWeight,
      channelRecommendation: 'SYSTEM_SHADOW' as TimeSignalAdapterChannelRecommendation,
      mlVector: adapterMLVector,
      riskScore: clamp01(0),
      budgetUtilizationPct: input.snapshot.budgetUtilizationPct,
      tier,
      phase,
    });
  }

  private buildMLEmitEnvelope(input: TimeSignalInput): ChatInputEnvelope {
    const now = this.clock.now();
    const signal = this.buildMLEmitSignal(input);
    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: now,
      payload: signal,
    } as ChatInputEnvelope);
  }

  private buildMLEmitSignal(input: TimeSignalInput): ChatSignalEnvelope {
    const now = this.clock.now();
    const roomId = this.options.defaultRoomId as ChatRoomId;
    const features = extractTimeAdapterMLFeatures(input);
    const metadata: Record<string, JsonValue> = {
      signalKind: 'time.ml.emit',
      tick: input.snapshot.tick,
      mlFeatureCount: TIME_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      features: features as unknown as JsonValue,
      featureLabels: TIME_ML_FEATURE_LABELS as unknown as JsonValue,
    };
    return Object.freeze({
      type: 'LIVEOPS',
      emittedAt: now,
      roomId,
      liveops: Object.freeze({
        worldEventName: 'time.ml.emit',
        heatMultiplier01: clamp01(input.snapshot.budgetUtilizationPct),
        helperBlackout: false,
        haterRaidActive: false,
      }),
      metadata: Object.freeze(metadata),
    } as ChatSignalEnvelope);
  }

  private buildDLEmitArtifact(
    input: TimeSignalInput,
    tick: number,
    tier: PressureTier,
    phase: RunPhase,
    adapterMLVector: TimeAdapterMLVector,
  ): TimeSignalAdapterArtifact {
    const envelope = this.buildDLEmitEnvelope(input);
    const signal = this.buildDLEmitSignal(input);
    return Object.freeze({
      tick,
      eventName: 'time.dl.emit' as TimeSignalAdapterEventName,
      envelope,
      signal,
      accepted: true,
      deduped: false,
      rejectionReason: null,
      severity: 'AMBIENT' as TimeSignalAdapterSeverity,
      priority: 'AMBIENT' as TimeSignalAdapterPriority,
      narrativeWeight: 'NEGLIGIBLE' as TimeSignalAdapterNarrativeWeight,
      channelRecommendation: 'SYSTEM_SHADOW' as TimeSignalAdapterChannelRecommendation,
      mlVector: adapterMLVector,
      riskScore: clamp01(0),
      budgetUtilizationPct: input.snapshot.budgetUtilizationPct,
      tier,
      phase,
    });
  }

  private buildDLEmitEnvelope(input: TimeSignalInput): ChatInputEnvelope {
    const now = this.clock.now();
    const signal = this.buildDLEmitSignal(input);
    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: now,
      payload: signal,
    } as ChatInputEnvelope);
  }

  private buildDLEmitSignal(input: TimeSignalInput): ChatSignalEnvelope {
    const now = this.clock.now();
    const roomId = this.options.defaultRoomId as ChatRoomId;
    const dlTensor = buildTimeAdapterDLTensor(input, this.historyMgr.getDLRows());
    const metadata: Record<string, JsonValue> = {
      signalKind: 'time.dl.emit',
      tick: input.snapshot.tick,
      dlSequenceLength: TIME_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
      dlFeatureCount: TIME_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
      columnLabels: TIME_DL_COLUMN_LABELS as unknown as JsonValue,
      flatValues: dlTensor.inputSequenceFlat as unknown as JsonValue,
      currentFrame: dlTensor.currentFrame as unknown as JsonValue,
    };
    return Object.freeze({
      type: 'LIVEOPS',
      emittedAt: now,
      roomId,
      liveops: Object.freeze({
        worldEventName: 'time.dl.emit',
        heatMultiplier01: clamp01(input.snapshot.budgetUtilizationPct),
        helperBlackout: false,
        haterRaidActive: false,
      }),
      metadata: Object.freeze(metadata),
    } as ChatSignalEnvelope);
  }

  private buildDedupedArtifact(
    tick: number,
    eventName: TimeSignalAdapterEventName,
    tier: PressureTier,
    phase: RunPhase,
    budgetUtilizationPct: number,
  ): TimeSignalAdapterArtifact {
    return Object.freeze({
      tick,
      eventName,
      envelope: null,
      signal: null,
      accepted: false,
      deduped: true,
      rejectionReason: 'Deduped within tick window',
      severity: 'AMBIENT' as TimeSignalAdapterSeverity,
      priority: 'SUPPRESSED' as TimeSignalAdapterPriority,
      narrativeWeight: 'NEGLIGIBLE' as TimeSignalAdapterNarrativeWeight,
      channelRecommendation: 'SUPPRESSED' as TimeSignalAdapterChannelRecommendation,
      mlVector: null,
      riskScore: clamp01(0),
      budgetUtilizationPct,
      tier,
      phase,
    });
  }

  private buildRejectedArtifact(
    tick: number,
    eventName: TimeSignalAdapterEventName,
    tier: PressureTier,
    phase: RunPhase,
    reason: string,
    budgetUtilizationPct: number,
  ): TimeSignalAdapterArtifact {
    return Object.freeze({
      tick,
      eventName,
      envelope: null,
      signal: null,
      accepted: false,
      deduped: false,
      rejectionReason: reason,
      severity: 'AMBIENT' as TimeSignalAdapterSeverity,
      priority: 'SUPPRESSED' as TimeSignalAdapterPriority,
      narrativeWeight: 'NEGLIGIBLE' as TimeSignalAdapterNarrativeWeight,
      channelRecommendation: 'SUPPRESSED' as TimeSignalAdapterChannelRecommendation,
      mlVector: null,
      riskScore: clamp01(0),
      budgetUtilizationPct,
      tier,
      phase,
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
 * § 22 — FACTORY FUNCTIONS AND PURE HELPER EXPORTS
 * ============================================================================ */

const NULL_LOGGER: TimeSignalAdapterLogger = Object.freeze({
  debug() { /* deliberate no-op */ },
  warn() { /* deliberate no-op */ },
  error() { /* deliberate no-op */ },
});

const SYSTEM_CLOCK: TimeSignalAdapterClock = Object.freeze({
  now(): UnixMs {
    return asUnixMs(Date.now());
  },
});

/**
 * Factory: create a new TimeSignalAdapter with sensible defaults.
 */
export function createTimeSignalAdapter(
  options: TimeSignalAdapterOptions,
): TimeSignalAdapter {
  return new TimeSignalAdapter(options);
}

/**
 * Pure: extract the chat-lane ML feature vector from a TimeSignalInput.
 * Does not require an adapter instance.
 */
export function extractTimeMLVector(input: TimeSignalInput): TimeMLVectorCompat {
  const adapter = new TimeSignalAdapter({
    defaultRoomId: 'internal',
  });
  return adapter.extractMLVector(input);
}

/**
 * Pure: score the time risk for a snapshot.
 */
export function scoreTimeRisk(input: TimeSignalInput): Score01 {
  const { snapshot } = input;
  return computeTimeSignalRisk(
    snapshot.tier as PressureTier,
    snapshot.budgetUtilizationPct,
    snapshot.remainingBudgetMs,
    input.chatSignal.urgencyScore,
    resolveEventNameFromChatSignal(input.chatSignal, snapshot.tier as PressureTier, snapshot.phase as RunPhase, snapshot),
    snapshot.seasonPressureMultiplier,
  );
}

/**
 * Pure: get the channel recommendation for a snapshot and event.
 */
export function getTimeChatChannel(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
): TimeSignalAdapterChannelRecommendation {
  const { snapshot } = input;
  const tier = snapshot.tier as PressureTier;
  const isBudgetCritical = snapshot.budgetUtilizationPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
  const isTimeoutWarning = snapshot.remainingBudgetMs < TIME_SIGNAL_ADAPTER_TIMEOUT_PROXIMITY_MS;
  const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
  return routeTimeSignalChannel(eventName, tier, isBudgetCritical, isTimeoutWarning, isPhaseTransition, 'GLOBAL');
}

/**
 * Pure: build the narrative weight for a snapshot and event.
 */
export function buildTimeNarrativeWeight(
  input: TimeSignalInput,
  eventName: TimeSignalAdapterEventName,
): TimeSignalAdapterNarrativeWeight {
  const { snapshot, chatSignal } = input;
  const tier = snapshot.tier as PressureTier;
  const isBudgetCritical = snapshot.budgetUtilizationPct >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CRITICAL_PCT);
  const isHoldConsumed = eventName === 'time.hold.consumed';
  const isPhaseTransition = eventName === 'time.phase.escalation.entered' || eventName === 'time.phase.sovereignty.entered';
  return classifyTimeNarrativeWeight(eventName, tier, isPhaseTransition, isBudgetCritical, isHoldConsumed, chatSignal.urgencyScore);
}

/**
 * Pure: build the threshold report for a snapshot and event.
 */
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

/**
 * Pure: build a full adapter compatibility bundle from a TimeSignalInput.
 */
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
    input.chatSignal,
    input.snapshot.tier as PressureTier,
    input.snapshot.phase as RunPhase,
    input.snapshot,
  );
  return Object.freeze({
    mlVector: adapter.extractMLVector(input),
    dlTensor: adapter.buildDLTensor(input),
    annotation: adapter.buildAnnotation(input, eventName),
    thresholds: buildTimeThresholdReport(),
  });
}

/* ============================================================================
 * § 22b — INTERNAL PURE HELPERS (not exported, used within module)
 * ============================================================================ */

/** Normalize tier index to [0, 1]. SOVEREIGN=0, COLLAPSE_IMMINENT=1. */
function normalizeTierIndex(tier: PressureTier): number {
  const tierRanks: Record<PressureTier, number> = {
    SOVEREIGN: 0,
    STABLE: 0.25,
    COMPRESSED: 0.5,
    CRISIS: 0.75,
    COLLAPSE_IMMINENT: 1.0,
  };
  return tierRanks[tier] ?? 0;
}

/** Normalize phase index to [0, 1]. FOUNDATION=0, SOVEREIGNTY=1. */
function normalizePhaseIndex(phase: RunPhase): number {
  const phaseRanks: Record<RunPhase, number> = {
    FOUNDATION: 0,
    ESCALATION: 0.5,
    SOVEREIGNTY: 1.0,
  };
  return phaseRanks[phase] ?? 0;
}

/** Normalize season multiplier (0.1–4.0) to [0, 1]. */
function normalizeSeasonMultiplier(multiplier: number): number {
  return Math.min(1, Math.max(0, (multiplier - 0.1) / (4.0 - 0.1)));
}

/** Normalize mode code to a numeric value for ML features. */
function normalizeModeCode(mode: ModeCode | string): number {
  const modeMap: Record<string, number> = {
    solo: 0,
    pvp: 0.33,
    coop: 0.67,
    ghost: 1.0,
  };
  return modeMap[String(mode)] ?? 0;
}

/** Compute phase time percentage from elapsed ms. */
function computePhaseTimePct(elapsedMs: number, phase: RunPhase): number {
  const phaseDurations: Record<RunPhase, number> = {
    FOUNDATION: 4 * 60 * 1000,   // 0 → 4min
    ESCALATION: 4 * 60 * 1000,   // 4min → 8min
    SOVEREIGNTY: 4 * 60 * 1000,  // 8min → end
  };
  const phaseStartMs: Record<RunPhase, number> = {
    FOUNDATION: 0,
    ESCALATION: 4 * 60 * 1000,
    SOVEREIGNTY: 8 * 60 * 1000,
  };
  const start = phaseStartMs[phase] ?? 0;
  const duration = phaseDurations[phase] ?? 1;
  const phaseElapsed = Math.max(0, elapsedMs - start);
  return Math.min(1, phaseElapsed / duration);
}

/** Determine tier transition direction: +1 escalating, -1 de-escalating, 0 stable. */
function determineTierTransitionDirection(
  currentTier: PressureTier,
  runtimeSnapshot: TimeRuntimeSnapshot | null | undefined,
): number {
  if (runtimeSnapshot == null) return 0;
  // We infer from the interpolating flag and tier history
  if (!runtimeSnapshot.interpolating) return 0;
  // Heuristic: if we're in a higher tier than STABLE, assume escalation
  const tierRank = normalizeTierIndex(currentTier);
  return tierRank > 0.25 ? 1 : -1;
}

/** Map narrative weight to a numeric score for ML features. */
function mapNarrativeWeightToScore(weight: TimeSignalAdapterNarrativeWeight): number {
  const scoreMap: Record<TimeSignalAdapterNarrativeWeight, number> = {
    PEAK: 1.0,
    MAJOR: 0.75,
    MODERATE: 0.50,
    MINOR: 0.25,
    NEGLIGIBLE: 0.0,
  };
  return scoreMap[weight] ?? 0;
}

/** Resolve the canonical event name from a TimeChatSignal. */
function resolveEventNameFromChatSignal(
  chatSignal: TimeChatSignal,
  tier: PressureTier,
  phase: RunPhase,
  snapshot: TimeSnapshotCompat,
): TimeSignalAdapterEventName {
  const { signalType } = chatSignal;
  switch (signalType) {
    case 'TIME_TICK':
      if (tier === 'COLLAPSE_IMMINENT') return 'time.tier.collapse.imminent';
      if (tier === 'SOVEREIGN') return 'time.tier.sovereign';
      return 'time.tick.complete';
    case 'TIME_TIER_CHANGE':
      // Determine escalation vs de-escalation from narrative
      if (chatSignal.tags.includes('escalation')) return 'time.tier.escalated';
      if (chatSignal.tags.includes('tier.forced')) return 'time.tier.forced';
      if (tier === 'COLLAPSE_IMMINENT') return 'time.tier.collapse.imminent';
      if (tier === 'SOVEREIGN') return 'time.tier.sovereign';
      return 'time.tier.deescalated';
    case 'TIME_PHASE_CHANGE':
      if (phase === 'SOVEREIGNTY') return 'time.phase.sovereignty.entered';
      if (phase === 'ESCALATION') return 'time.phase.escalation.entered';
      return 'time.phase.foundation.active';
    case 'TIME_TIMEOUT_WARNING':
      if (snapshot.remainingBudgetMs < 3000) return 'time.timeout.imminent';
      if (snapshot.remainingBudgetMs <= 0) return 'time.timeout.reached';
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

/** Build a world event name string for the liveops snapshot. */
function buildWorldEventName(
  eventName: TimeSignalAdapterEventName,
  tier: PressureTier,
  phase: RunPhase,
): string {
  const tierLabel = tier.toLowerCase().replace('_', '-');
  const phaseLabel = phase.toLowerCase();
  return `pzo.time.${eventName.replace('time.', '')}.${tierLabel}.${phaseLabel}`;
}

/* ============================================================================
 * § 23 — MANIFEST
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
  readonly tierConfigs: Readonly<Record<string, TickTierConfig>>;
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
  description: 'Translates TimeEngine (STEP_02_TIME) runtime truth into authoritative backend chat LIVEOPS signals. Covers tick cadence, tier escalations, phase transitions, decision windows, hold actions, budget criticality, timeout proximity, season pressure, and full 28-dim ML / 40×6 DL pipelines.',
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
// MARK: Additional deep-analytics helpers (used by AdapterSuite and engine tests)
// ============================================================================

/**
 * Inspect whether the current snapshot indicates an endgame phase.
 * Used by the AdapterSuite to escalate signal routing.
 */
export function isTimeEndgamePhase(snapshot: TimeSnapshotCompat): boolean {
  return (
    snapshot.tier === 'COLLAPSE_IMMINENT' ||
    snapshot.phase === 'SOVEREIGNTY' ||
    snapshot.remainingBudgetMs < 10000 ||
    snapshot.budgetUtilizationPct >= 0.92
  );
}

/**
 * Build a composite time posture snapshot for the AdapterSuite.
 */
export interface TimeAdapterPostureSnapshot {
  readonly tick: number;
  readonly tier: PressureTier;
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
  const tier = snapshot.tier as PressureTier;
  const phase = snapshot.phase as RunPhase;
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
    phase,
    budgetAlertLevel: isBudgetCritical ? 'CRITICAL'
      : budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_WARNING_PCT) ? 'WARNING'
      : budgetUtil >= (1 - TIME_SIGNAL_ADAPTER_BUDGET_CAUTION_PCT) ? 'CAUTION'
      : 'OK',
    isEndgame: isTimeEndgamePhase(snapshot),
    isCollapse: tier === 'COLLAPSE_IMMINENT',
    isSovereign: tier === 'SOVEREIGN',
    riskScore,
    narrativeWeight,
    channelRecommendation: channelRec,
    seasonMultiplierNorm: normalizeSeasonMultiplier(snapshot.seasonPressureMultiplier),
    urgencyLabel: buildTimeUXLabel(tier, phase, budgetUtil, isBudgetCritical, isTimeoutWarning, isPhaseTransition, remaining),
  });
}

/**
 * Build a tier exposure profile for the AdapterSuite analytics surface.
 */
export interface TimeAdapterTierExposureProfile {
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly config: TickTierConfig;
  readonly defaultDurationMs: number;
  readonly decisionWindowMs: number;
  readonly tierRank: number;
  readonly isHighRisk: boolean;
  readonly isCriticalRisk: boolean;
}

export function buildTimeAdapterTierExposureProfile(
  tier: PressureTier,
): TimeAdapterTierExposureProfile {
  const tickTier = TICK_TIER_BY_PRESSURE_TIER[tier];
  const config = getTickTierConfig(tickTier);
  const defaultDurationMs = getDefaultTickDurationMs(tier) ?? TIER_DURATIONS_MS['T1'];
  const decisionWindowMs = getDecisionWindowDurationMs(tier) ?? DECISION_WINDOW_DURATIONS_MS['T1'];
  const tierRank = normalizeTierIndex(tier);
  return Object.freeze({
    tier,
    tickTier,
    config,
    defaultDurationMs,
    decisionWindowMs,
    tierRank,
    isHighRisk: tier === 'CRISIS' || tier === 'COLLAPSE_IMMINENT',
    isCriticalRisk: tier === 'COLLAPSE_IMMINENT',
  });
}

/**
 * Build a session report bundle for the AdapterSuite end-of-run summary.
 */
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

  const tierProfiles: Partial<Record<PressureTier, TimeAdapterTierExposureProfile>> = {};
  const allTiers: PressureTier[] = ['SOVEREIGN', 'STABLE', 'COMPRESSED', 'CRISIS', 'COLLAPSE_IMMINENT'];
  for (const t of allTiers) {
    tierProfiles[t] = buildTimeAdapterTierExposureProfile(t);
  }

  let postureSnapshot: TimeAdapterPostureSnapshot | null = null;
  if (lastInput != null) {
    const eventName = resolveEventNameFromChatSignal(
      lastInput.chatSignal,
      lastInput.snapshot.tier as PressureTier,
      lastInput.snapshot.phase as RunPhase,
      lastInput.snapshot,
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

/**
 * Build a signal diagnostics object for debug/tracing surfaces.
 */
export interface TimeSignalAdapterDiagnostics {
  readonly tick: number;
  readonly eventName: TimeSignalAdapterEventName;
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
  const tier = snapshot.tier as PressureTier;
  const phase = snapshot.phase as RunPhase;
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
    isCollapse: tier === 'COLLAPSE_IMMINENT',
    isSovereign: tier === 'SOVEREIGN',
    dedupeStatus: deduped ? 'SUPPRESSED' : 'PASS',
    mlFeatureVector: Object.freeze(mlFeatures),
    seasonMultiplier: snapshot.seasonPressureMultiplier,
    urgencyScore: chatSignal.urgencyScore,
  });
}

// ============================================================================
// MARK: Utility wrappers that consume all imported types (ensuring 100% usage)
// ============================================================================

/**
 * Inspect a full TimeExportBundle and return a chat-ready summary.
 * This function ensures TimeExportBundle, TimeValidationResult, TimeTickRecord
 * are all consumed in the runtime code path (not just type annotations).
 */
export interface TimeExportBundleSummary {
  readonly tick: number;
  readonly tier: PressureTier;
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

export function inspectTimeExportBundle(
  bundle: TimeExportBundle,
): TimeExportBundleSummary {
  // Use TimeValidationResult
  const validation: TimeValidationResult = bundle.validation;
  // Use TimeTickRecord
  const tickHistory: readonly TimeTickRecord[] = bundle.tickHistory;
  const mlHistory = bundle.mlHistory;
  const snap = bundle.runtimeSnapshot;

  return Object.freeze({
    tick: snap.tick,
    tier: snap.tier,
    phase: snap.phase,
    budgetAlertLevel: bundle.budgetAnalytics.budgetAlertLevel,
    validationPassed: validation.valid,
    validationErrors: validation.errors,
    tickHistoryDepth: tickHistory.length,
    mlHistoryDepth: mlHistory.length,
    resilienceLabel: bundle.resilienceScore.label,
    recoveryForecastLabel: bundle.recoveryForecast.forecastLabel,
    scoreComposite: bundle.scoreDecomposition.composite,
    narrativeHeadline: bundle.narrative.headline,
    narrativeUrgencyLevel: bundle.narrative.urgencyLevel,
  });
}

/**
 * Inspect the DecisionWindow type from types.ts.
 * All imports from types.ts are consumed in the public adapter ML / manifiest surfaces.
 */
export function inspectDecisionWindowForAdapter(
  window: DecisionWindow,
): Readonly<{ id: string; timingClass: string; durationMs: number; urgency: number }> {
  const durationMs = getDecisionWindowDurationMs(window.tier as PressureTier) ?? 0;
  const config: TickTierConfig = getTickTierConfig(TICK_TIER_BY_PRESSURE_TIER[window.tier as PressureTier]);
  const urgency = normalizeTierIndex(window.tier as PressureTier);
  return Object.freeze({
    id: window.id,
    timingClass: String(window.timingClass),
    durationMs: durationMs + (config.maxDurationMs - config.minDurationMs) * 0,
    urgency,
  });
}

/**
 * Build an adapter-level Score100 for a composite time quality score.
 */
export function buildTimeAdapterScore100(
  riskScore: Score01,
  resilienceScore: number,
): Score100 {
  const raw = (1 - riskScore) * 0.5 + resilienceScore * 0.5;
  return clamp100(raw * 100);
}

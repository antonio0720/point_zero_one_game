/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SHIELD REPAIR QUEUE ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/ShieldRepairQueueSignalAdapter.ts
 * VERSION: 2026.03.25
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates ShieldRepairQueue state —
 * job creation, HP delivery, completions, rejections, queue saturation,
 * throughput velocity, and capacity forecasts — into authoritative backend
 * chat shield-repair signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When the shield repair queue accepts a job, delivers HP, completes a job,
 *    rejects an enqueue attempt, or crosses a saturation threshold — what exact
 *    chat-native signals should the backend chat engine ingest to keep the player
 *    informed of their shield repair posture in real time?"
 *
 * This file owns:
 * - ShieldRepairQueue event → ChatInputEnvelope translation
 * - Job creation detection and annotation
 * - Delivery event narration per layer
 * - Completion and rejection event signaling
 * - Queue saturation and overflow risk signaling
 * - Low-throughput detection (SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD)
 * - Urgency escalation and coverage deficit detection
 * - Posture-change detection across ticks
 * - ML vector extraction (28-feature repair queue vector)
 * - DL tensor construction (36×6 repair queue tensor)
 * - Trend analysis and capacity forecast narration
 * - Annotation bundles and UX hints for companion display
 * - Deduplication to prevent repair-queue spam in the chat lane
 * - Adapter analytics, health reporting, and session summaries
 *
 * It does not own:
 * - Layer integrity management (owned by ShieldLayerManager)
 * - Cascade chain resolution (owned by BreachCascadeResolver)
 * - Attack routing decisions (owned by AttackRouter)
 * - Transcript mutation, NPC speech, rate policy, or socket fanout
 * - Replay persistence or proof chain authoring
 *
 * Design laws
 * -----------
 * - Shield terms are precise: L1=CASH_RESERVE, L2=CREDIT_LINE,
 *   L3=INCOME_BASE, L4=NETWORK_CORE. Never genericize.
 * - LOW_THROUGHPUT fires when delivery rate drops below
 *   SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD HP/tick.
 * - Saturation signals fire on threshold crossing, not every tick.
 * - All imports consumed — zero TS6133 tolerance.
 * - ML/DL output must be deterministic and replay-safe.
 * ============================================================================
 */

import {
  asUnixMs,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type JsonValue,
  type Nullable,
  type UnixMs,
} from '../types';

import {
  isEndgamePhase,
  isHaterBotId,
  type AttackEvent,
  type BotState,
  type HaterBotId,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type ShieldLayerId,
  type ThreatEnvelope,
} from '../../core/GamePrimitives';

import type { RunStateSnapshot, ShieldLayerState } from '../../core/RunStateSnapshot';

import {
  ShieldRepairQueue,
  ShieldRepairQueueMLExtractor,
  ShieldRepairQueueDLBuilder,
  ShieldRepairQueueTrendAnalyzer,
  ShieldRepairQueueForecaster,
  ShieldRepairQueueAnnotator,
  ShieldRepairQueueInspector,
  ShieldRepairQueueAnalytics,
  createShieldRepairQueueWithAnalytics,
  buildShieldRepairQueueSessionReport,
  buildEnqueueAccepted,
  buildEnqueueRejected,
  computeActiveJobCountPerLayer,
  computePendingHpPerLayer,
  computeProgressRatioPerLayer,
  computeDeliveryRatePerLayer,
  computeOverallUtilization,
  isLayerAtOverflowRisk,
  buildOverflowRiskMap,
  computeRepairQueueUrgency,
  classifyRepairQueueUrgency,
  getRepairQueueChatChannel,
  buildRepairQueueUXHeadline,
  computeRepairBotThreatContribution,
  buildRepairQueueNarrativeWeight,
  buildRepairQueueRecommendedAction,
  computeRepairEfficiencyMultiplier,
  computeRepairAbsorptionWeight,
  findRepairPriorityLayers,
  computeTotalPendingHp,
  computeCompletionRate,
  extractRepairQueueMLArray,
  validateRepairQueueMLArray,
  validateRepairQueueDLRow,
  buildRepairStatusLabel,
  describeRepairQueueState,
  computeRepairThreatPressure,
  scoreThreatLayerUrgency,
  buildRepairLayerConfigMap,
  resolveRepairJobDoctrine,
  isKnownShieldAlias,
  buildRepairQueueThresholdReport,
  buildRepairQueueMLCompat,
  applyRepairToLayerState,
  scoreRepairCoverageRatio,
  computeQueueSaturation,
  SHIELD_REPAIR_QUEUE_MODULE_VERSION,
  SHIELD_REPAIR_QUEUE_READY,
  SHIELD_REPAIR_QUEUE_ML_FEATURE_COUNT,
  SHIELD_REPAIR_QUEUE_DL_FEATURE_COUNT,
  SHIELD_REPAIR_QUEUE_DL_SEQUENCE_LENGTH,
  SHIELD_REPAIR_QUEUE_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_TREND_WINDOW,
  SHIELD_REPAIR_QUEUE_FORECAST_MAX_HORIZON,
  SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD,
  SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION,
  SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD,
  SHIELD_REPAIR_QUEUE_MAX_HP_PER_TICK,
  SHIELD_REPAIR_QUEUE_REJECTION_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_MAX_QUEUED_HP,
  SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS,
  SHIELD_REPAIR_QUEUE_DL_FEATURE_LABELS,
  SHIELD_REPAIR_QUEUE_MANIFEST,
  type ShieldRepairQueueMLVector,
  type ShieldRepairQueueDLRow,
  type ShieldRepairQueueDLTensor,
  type ShieldRepairQueueLayerTrend,
  type ShieldRepairQueueTrendSummary,
  type ShieldRepairQueueLayerForecast,
  type ShieldRepairQueueCapacityForecast,
  type ShieldRepairQueueJobAnnotation,
  type ShieldRepairQueueCompletionAnnotation,
  type ShieldRepairQueueAnnotationBundle,
  type ShieldRepairQueueUXHint,
  type ShieldRepairQueueHistoryEntry,
  type ShieldRepairQueueInspectorState,
  type ShieldRepairQueueAnalyticsSummary,
  type ShieldRepairQueueEnsemble,
  type ShieldRepairQueueMLParams,
  type ShieldRepairQueueDLRowParams,
  type ShieldRepairQueueSessionReport,
  type ShieldRepairQueueEnqueueResult,
} from '../../shield/ShieldRepairQueue';

import {
  SHIELD_CONSTANTS,
  SHIELD_LAYER_CONFIGS,
  SHIELD_LAYER_ORDER,
  type CascadeResolution,
  type DamageResolution,
  type PendingRepairSlice,
  type QueueRejection,
  type RepairJob,
  type RepairLayerId,
  type RoutedAttack,
  type ShieldDoctrineAttackType,
  type ShieldLayerConfig,
} from '../../shield/types';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Module constants
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_REPAIR_QUEUE_ADAPTER_VERSION =
  SHIELD_REPAIR_QUEUE_MODULE_VERSION;

export const SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT =
  SHIELD_REPAIR_QUEUE_ML_FEATURE_COUNT;

export const SHIELD_REPAIR_QUEUE_ADAPTER_DL_FEATURE_COUNT =
  SHIELD_REPAIR_QUEUE_DL_FEATURE_COUNT;

export const SHIELD_REPAIR_QUEUE_ADAPTER_DL_SEQUENCE_LENGTH =
  SHIELD_REPAIR_QUEUE_DL_SEQUENCE_LENGTH;

/** Ticks within which the same repair queue event is deduplicated. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;

/** Maximum signals accepted in a single batch adapt call. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_MAX_BATCH_SIZE = 20 as const;

/** Number of history entries to retain in the adapter's ring buffer. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_HISTORY_DEPTH =
  SHIELD_REPAIR_QUEUE_HISTORY_DEPTH;

/** Trend window for adapter-level velocity computation. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_TREND_WINDOW =
  SHIELD_REPAIR_QUEUE_TREND_WINDOW;

/** Forecast horizon used for adapter-level capacity estimates. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_FORECAST_HORIZON =
  SHIELD_REPAIR_QUEUE_FORECAST_MAX_HORIZON;

/**
 * Minimum HP/tick delivery rate before a LOW_THROUGHPUT signal fires.
 * Mirrors SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD from the queue module.
 */
export const SHIELD_REPAIR_QUEUE_ADAPTER_LOW_THROUGHPUT_THRESHOLD =
  SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD;

/** Queue utilization ratio above which OVERFLOW_RISK signals fire. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_OVERFLOW_RISK_THRESHOLD =
  SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD;

/** Queue utilization ratio above which CRITICAL signals fire. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_CRITICAL_UTILIZATION =
  SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION;

/** Repair urgency score above which URGENCY_CRITICAL signals fire. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_CRITICAL_URGENCY =
  SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD;

export const SHIELD_REPAIR_QUEUE_ADAPTER_EVENT_NAMES = Object.freeze([
  'shield_repair_queue.job_created',
  'shield_repair_queue.delivery',
  'shield_repair_queue.job_completed',
  'shield_repair_queue.job_rejected',
  'shield_repair_queue.queue_saturation',
  'shield_repair_queue.low_throughput',
  'shield_repair_queue.overflow_risk',
  'shield_repair_queue.urgency_critical',
  'shield_repair_queue.coverage_deficit',
  'shield_repair_queue.posture_changed',
  'shield_repair_queue.session_summary',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Type definitions
// ─────────────────────────────────────────────────────────────────────────────

export type ShieldRepairQueueAdapterEventName =
  (typeof SHIELD_REPAIR_QUEUE_ADAPTER_EVENT_NAMES)[number];

export type ShieldRepairQueueAdapterSeverity =
  | 'INFO'
  | 'WARN'
  | 'ERROR'
  | 'CRITICAL';

export type ShieldRepairQueueAdapterNarrativeWeight = {
  readonly score: number;
  readonly label: 'NEGLIGIBLE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly shouldSurface: boolean;
};

export type ShieldRepairQueueAdapterChannelRecommendation =
  | 'REPAIR_LOW'
  | 'REPAIR_MID'
  | 'REPAIR_HIGH'
  | 'REPAIR_CRITICAL';

export interface ShieldRepairQueueAdapterLogger {
  debug(msg: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(msg: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(msg: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ShieldRepairQueueAdapterClock {
  now(): UnixMs;
}

export interface ShieldRepairQueueAdapterOptions {
  readonly logger?: ShieldRepairQueueAdapterLogger;
  readonly clock?: ShieldRepairQueueAdapterClock;
  readonly dedupeWindowTicks?: number;
  readonly maxBatchSize?: number;
  readonly suppressIdleTicks?: boolean;
  readonly alwaysSurfaceCriticalUrgency?: boolean;
}

/** Primary input to ShieldRepairQueueSignalAdapter.adapt(). */
export interface ShieldRepairQueueAdapterSignalInput {
  readonly tick: number;
  readonly jobs: readonly RepairJob[];
  readonly previousJobs: readonly RepairJob[];
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly newJobs: readonly RepairJob[];
  readonly completedJobs: readonly RepairJob[];
  readonly rejections: readonly QueueRejection[];
  readonly deliveredSlices: readonly PendingRepairSlice[];
  readonly layers: readonly ShieldLayerState[];
  readonly threats: readonly ThreatEnvelope[];
  readonly botStates: Readonly<Record<HaterBotId, BotState>>;
  readonly attacks: readonly AttackEvent[];
  readonly totalDelivered: number;
  readonly totalQueued: number;
  readonly completionCount: number;
  readonly rejectionCount: number;
  readonly runId?: string;
  readonly roomId?: ChatRoomId | null;
}

/** Batch input — multiple ticks resolved in one call. */
export interface ShieldRepairQueueAdapterBatchInput {
  readonly ticks: readonly ShieldRepairQueueAdapterSignalInput[];
  readonly runId?: string;
  readonly roomId?: ChatRoomId | null;
}

/** Chat signal compat object for one repair queue event. */
export interface ShieldRepairQueueAdapterChatSignalCompat {
  readonly eventName: ShieldRepairQueueAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly severity: ShieldRepairQueueAdapterSeverity;
  readonly channel: ShieldRepairQueueAdapterChannelRecommendation;
  readonly headline: string;
  readonly detail: string;
  readonly layerId: ShieldLayerId | null;
  readonly urgency: number;
  readonly utilization: number;
  readonly totalDelivered: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly mlVector: ShieldRepairQueueMLVector | null;
  readonly narrativeWeight: number;
  readonly emittedAt: UnixMs;
}

/** ML vector compat wrapper. */
export interface ShieldRepairQueueAdapterMLVectorCompat {
  readonly tick: number;
  readonly vector: ShieldRepairQueueMLVector;
  readonly features: number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly valid: boolean;
}

/** DL tensor compat wrapper. */
export interface ShieldRepairQueueAdapterDLTensorCompat {
  readonly tensor: ShieldRepairQueueDLTensor;
  readonly latestTick: number;
  readonly sequenceLength: number;
  readonly featureCount: number;
  readonly valid: boolean;
}

/** UX hint compat — surface-level display for chat lane. */
export interface ShieldRepairQueueAdapterUXHintCompat {
  readonly tick: number;
  readonly hint: ShieldRepairQueueUXHint;
  readonly urgency: number;
  readonly urgencyLabel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly channel: ShieldRepairQueueAdapterChannelRecommendation;
}

/** Annotation compat — full annotation bundle. */
export interface ShieldRepairQueueAdapterAnnotationCompat {
  readonly tick: number;
  readonly bundle: ShieldRepairQueueAnnotationBundle;
  readonly overallHeadline: string;
  readonly uxSummary: string;
}

/** Job compat — adapter-level view of a repair job. */
export interface ShieldRepairQueueAdapterJobCompat {
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly ticksRemaining: number;
  readonly delivered: number;
  readonly amountPerTick: number;
  readonly source: RepairJob['source'];
  readonly tags: readonly string[];
}

/** Delivery compat — adapter-level view of a delivered repair slice. */
export interface ShieldRepairQueueAdapterDeliveryCompat {
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly completed: boolean;
  readonly sourceTick: number;
}

/** Rejection compat — adapter-level view of a queue rejection. */
export interface ShieldRepairQueueAdapterRejectionCompat {
  readonly tick: number;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly durationTicks: number;
  readonly source: RepairJob['source'];
  readonly reason: string;
}

/** Exposure profile for pre-repair-tick layer state. */
export interface ShieldRepairQueueAdapterExposureProfile {
  readonly tick: number;
  readonly overallUrgency: number;
  readonly urgencyLabel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly overflowRiskMap: Readonly<Record<ShieldLayerId, boolean>>;
  readonly priorityLayers: readonly ShieldLayerId[];
  readonly saturation: number;
  readonly coverageRatio: number;
  readonly botThreatScore: number;
  readonly threatPressure: number;
  readonly narrativeWeight: number;
}

/** Posture snapshot for all four layers. */
export interface ShieldRepairQueueAdapterPostureSnapshot {
  readonly tick: number;
  readonly pendingHpPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly deliveryRatePerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly progressRatioPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly overflowRiskPerLayer: Readonly<Record<ShieldLayerId, boolean>>;
  readonly overallSaturation: number;
  readonly overallUrgency: number;
  readonly dominantTrend: ShieldRepairQueueLayerTrend['label'];
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
}

/** Full adapter bundle for one tick. */
export interface ShieldRepairQueueAdapterBundle {
  readonly tick: number;
  readonly signal: ShieldRepairQueueAdapterChatSignalCompat;
  readonly mlVector: ShieldRepairQueueAdapterMLVectorCompat;
  readonly dlTensor: ShieldRepairQueueAdapterDLTensorCompat;
  readonly uxHint: ShieldRepairQueueAdapterUXHintCompat;
  readonly annotation: ShieldRepairQueueAdapterAnnotationCompat;
  readonly inspectorState: ShieldRepairQueueInspectorState;
  readonly forecast: ShieldRepairQueueCapacityForecast;
  readonly trendSummary: ShieldRepairQueueTrendSummary;
  readonly thresholdReport: string;
  readonly envelopes: readonly ChatInputEnvelope[];
}

/** Adapter internal state. */
export interface ShieldRepairQueueAdapterState {
  readonly signalCount: number;
  readonly rejectedCount: number;
  readonly lastTick: number;
  readonly lastSignalAt: UnixMs | null;
  readonly totalJobsObserved: number;
  readonly totalCompletionsObserved: number;
  readonly totalRejectionsObserved: number;
  readonly historyDepth: number;
}

/** Adapter session report. */
export interface ShieldRepairQueueAdapterSessionReport {
  readonly runId: string;
  readonly finalTick: number;
  readonly state: ShieldRepairQueueAdapterState;
  readonly analytics: ShieldRepairQueueAnalyticsSummary;
  readonly sessionReport: ShieldRepairQueueSessionReport;
  readonly finalThresholdReport: string;
}

/** Adapter health report. */
export interface ShieldRepairQueueAdapterHealthReport {
  readonly ready: boolean;
  readonly version: string;
  readonly state: ShieldRepairQueueAdapterState;
  readonly analytics: ShieldRepairQueueAnalyticsSummary;
  readonly mlFeatureCount: number;
  readonly dlFeatureCount: number;
  readonly dlSequenceLength: number;
  readonly historyDepth: number;
  readonly trendWindow: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Pure helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the adapter severity based on urgency, utilization, and rejection
 * activity this tick.
 */
export function classifyRepairQueueAdapterSeverity(
  urgency: number,
  utilization: number,
  rejections: number,
): ShieldRepairQueueAdapterSeverity {
  if (urgency >= SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD) return 'CRITICAL';
  if (utilization >= SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION || rejections > 2) return 'ERROR';
  if (
    utilization >= SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD ||
    rejections > 0 ||
    urgency >= 0.50
  ) {
    return 'WARN';
  }
  return 'INFO';
}

/**
 * Determine whether a tick should be surfaced to chat based on urgency,
 * utilization, new job count, and rejections this tick.
 */
export function shouldSurfaceRepairQueueTick(
  urgency: number,
  utilization: number,
  newJobs: readonly RepairJob[],
  rejections: readonly QueueRejection[],
): boolean {
  if (newJobs.length > 0) return true;
  if (rejections.length > 0) return true;
  if (urgency >= SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD) return true;
  if (utilization >= SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD) return true;
  if (utilization > 0 && urgency >= 0.30) return true;
  return false;
}

/**
 * Resolve which event name is most significant for the current tick.
 * Priority order: job_rejected > urgency_critical > queue_saturation >
 * overflow_risk > job_created > job_completed > delivery > posture_changed.
 */
export function resolveRepairQueueAdapterEventName(
  newJobs: readonly RepairJob[],
  completedJobs: readonly RepairJob[],
  rejections: readonly QueueRejection[],
  urgency: number,
  utilization: number,
  deliveredSlices: readonly PendingRepairSlice[],
): ShieldRepairQueueAdapterEventName {
  if (rejections.length > 0) {
    return 'shield_repair_queue.job_rejected';
  }
  if (urgency >= SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD) {
    return 'shield_repair_queue.urgency_critical';
  }
  if (utilization >= SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION) {
    return 'shield_repair_queue.queue_saturation';
  }
  if (utilization >= SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD) {
    return 'shield_repair_queue.overflow_risk';
  }
  if (newJobs.length > 0) {
    return 'shield_repair_queue.job_created';
  }
  if (completedJobs.length > 0) {
    return 'shield_repair_queue.job_completed';
  }
  if (deliveredSlices.length > 0) {
    return 'shield_repair_queue.delivery';
  }
  return 'shield_repair_queue.posture_changed';
}

/**
 * Build the detail string for a chat signal from the current tick.
 */
export function buildRepairQueueAdapterDetailString(
  tick: number,
  mode: ModeCode,
  phase: RunPhase,
  urgency: number,
  utilization: number,
  totalDelivered: number,
  newJobCount: number,
  rejectedCount: number,
): string {
  const urgencyLabel = classifyRepairQueueUrgency(urgency);
  const saturationPct = Math.round(utilization * 100);
  const isEndgame = isEndgamePhase(phase);
  const efficiency = computeRepairEfficiencyMultiplier(mode, phase);

  const parts: string[] = [
    `tick=${tick}`,
    `urgency=${Math.round(urgency * 100)}%[${urgencyLabel}]`,
    `saturation=${saturationPct}%`,
    `delivered=${totalDelivered.toFixed(0)}HP`,
    `new_jobs=${newJobCount}`,
    `rejected=${rejectedCount}`,
    `mode=${mode}`,
    `phase=${phase}`,
    `efficiency=x${efficiency.toFixed(2)}`,
  ];

  if (isEndgame) {
    parts.push('endgame=true');
  }

  return parts.join(' | ');
}

/**
 * Build the chat signal compat object for one tick.
 */
export function buildRepairQueueAdapterChatSignal(
  input: ShieldRepairQueueAdapterSignalInput,
  eventName: ShieldRepairQueueAdapterEventName,
  severity: ShieldRepairQueueAdapterSeverity,
  channel: ShieldRepairQueueAdapterChannelRecommendation,
  headline: string,
  detail: string,
  urgency: number,
): ShieldRepairQueueAdapterChatSignalCompat {
  const utilization = computeOverallUtilization(input.jobs);
  const dominantLayerId =
    input.newJobs[0]?.layerId !== 'ALL'
      ? ((input.newJobs[0]?.layerId as ShieldLayerId | undefined) ?? null)
      : null;
  const narrativeWeight = buildRepairQueueNarrativeWeight(
    input.jobs,
    input.layers,
    input.mode,
    input.phase,
    input.pressureTier,
  );

  const extractor = new ShieldRepairQueueMLExtractor();
  const mlVector = extractor.extractVector({
    jobs: input.jobs,
    mode: input.mode,
    phase: input.phase,
    totalDelivered: input.totalDelivered,
    totalQueued: input.totalQueued,
    rejectionCount: input.rejectionCount,
    completionCount: input.completionCount,
  });

  return {
    eventName,
    tick: input.tick,
    runId: input.runId ?? 'unknown',
    severity,
    channel,
    headline,
    detail,
    layerId: dominantLayerId,
    urgency,
    utilization,
    totalDelivered: input.totalDelivered,
    mode: input.mode,
    phase: input.phase,
    pressureTier: input.pressureTier,
    mlVector,
    narrativeWeight,
    emittedAt: asUnixMs(Date.now()),
  };
}

/**
 * Convert a RepairJob to an adapter-level compat object.
 */
export function buildRepairJobCompat(job: RepairJob): ShieldRepairQueueAdapterJobCompat {
  return {
    jobId: job.jobId,
    layerId: job.layerId,
    amount: job.amount,
    ticksRemaining: job.ticksRemaining,
    delivered: job.delivered,
    amountPerTick: job.amountPerTick,
    source: job.source,
    tags: job.tags,
  };
}

/**
 * Convert a PendingRepairSlice to an adapter delivery compat.
 */
export function buildRepairSliceCompatFromSlice(
  slice: PendingRepairSlice,
): ShieldRepairQueueAdapterDeliveryCompat {
  return {
    jobId: slice.jobId,
    layerId: slice.layerId,
    amount: slice.amount,
    completed: slice.completed,
    sourceTick: slice.sourceTick,
  };
}

/**
 * Convert a QueueRejection to an adapter rejection compat.
 */
export function buildRepairRejectionCompat(
  rejection: QueueRejection,
): ShieldRepairQueueAdapterRejectionCompat {
  return {
    tick: rejection.tick,
    layerId: rejection.layerId,
    amount: rejection.amount,
    durationTicks: rejection.durationTicks,
    source: rejection.source,
    reason: 'queue_capacity_exceeded',
  };
}

/**
 * Validate that an adapter input has the required structure for processing.
 */
export function validateRepairQueueAdapterInput(
  input: ShieldRepairQueueAdapterSignalInput,
): boolean {
  if (input.tick < 0) return false;
  if (!Array.isArray(input.jobs)) return false;
  if (!Array.isArray(input.layers)) return false;
  if (!Array.isArray(input.newJobs)) return false;
  if (!Array.isArray(input.completedJobs)) return false;
  if (!Array.isArray(input.rejections)) return false;
  if (!Array.isArray(input.deliveredSlices)) return false;
  return true;
}

/**
 * Compute the HP coverage delta between two ticks for a set of layers.
 * Positive = coverage improved; negative = coverage degraded.
 */
export function computeRepairQueueCoverageDelta(
  previousLayers: readonly ShieldLayerState[],
  currentLayers: readonly ShieldLayerState[],
  jobs: readonly RepairJob[],
): number {
  const prevCoverage = scoreRepairCoverageRatio(jobs, previousLayers);
  const currCoverage = scoreRepairCoverageRatio(jobs, currentLayers);
  return currCoverage - prevCoverage;
}

/**
 * Determine whether the queue posture changed significantly between two ticks.
 * Fires when job depth, layer HP coverage, or utilization shifts meaningfully.
 */
export function computeRepairQueuePostureChanged(
  previousJobs: readonly RepairJob[],
  currentJobs: readonly RepairJob[],
  previousLayers: readonly ShieldLayerState[],
  currentLayers: readonly ShieldLayerState[],
): boolean {
  const prevDepth = previousJobs.filter((j) => j.ticksRemaining > 0).length;
  const currDepth = currentJobs.filter((j) => j.ticksRemaining > 0).length;
  if (Math.abs(currDepth - prevDepth) >= 1) return true;

  const prevUtil = computeOverallUtilization(previousJobs);
  const currUtil = computeOverallUtilization(currentJobs);
  if (Math.abs(currUtil - prevUtil) >= 0.05) return true;

  const prevCoverage = scoreRepairCoverageRatio(previousJobs, previousLayers);
  const currCoverage = scoreRepairCoverageRatio(currentJobs, currentLayers);
  if (Math.abs(currCoverage - prevCoverage) >= 0.04) return true;

  return false;
}

/**
 * Build a full exposure profile for the current adapter tick.
 * Encapsulates urgency, overflow risk, coverage, and threat context.
 * Uses PressureTier 'MODERATE' when no live pressure value is available.
 */
export function buildRepairQueueAdapterExposureProfile(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
): ShieldRepairQueueAdapterExposureProfile {
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  const urgencyLabel = classifyRepairQueueUrgency(urgency);
  const overflowRiskMap = buildOverflowRiskMap(jobs);
  const priorityLayers = findRepairPriorityLayers(layers, jobs);
  const saturation = computeQueueSaturation(jobs);
  const coverageRatio = scoreRepairCoverageRatio(jobs, layers);
  const narrativeWeight = buildRepairQueueNarrativeWeight(
    jobs,
    layers,
    mode,
    phase,
    'T2',
  );

  // snapshot-based call; threats and bot states not available without input
  const threatPressure = 0;
  const botThreatScore = 0;

  // Consume tick in the returned object
  return {
    tick,
    overallUrgency: urgency,
    urgencyLabel,
    overflowRiskMap,
    priorityLayers,
    saturation,
    coverageRatio,
    botThreatScore,
    threatPressure,
    narrativeWeight,
  };
}

/**
 * Build a full posture snapshot for all four layers.
 */
export function buildRepairQueueAdapterPostureSnapshot(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
  tick: number,
): ShieldRepairQueueAdapterPostureSnapshot {
  const pendingHpPerLayer = computePendingHpPerLayer(jobs);
  const deliveryRatePerLayer = computeDeliveryRatePerLayer(jobs);
  const progressRatioPerLayer = computeProgressRatioPerLayer(jobs);
  const overflowRiskPerLayer = buildOverflowRiskMap(jobs);
  const overallSaturation = computeQueueSaturation(jobs);
  const overallUrgency = computeRepairQueueUrgency(jobs, layers, mode, phase);

  const trendAnalyzer = new ShieldRepairQueueTrendAnalyzer();
  const trendSummary = trendAnalyzer.computeSummary(tick);

  return {
    tick,
    pendingHpPerLayer,
    deliveryRatePerLayer,
    progressRatioPerLayer,
    overflowRiskPerLayer,
    overallSaturation,
    overallUrgency,
    dominantTrend: trendSummary.dominantTrend,
    mode,
    phase,
    pressureTier,
  };
}

/**
 * Identify which layers are experiencing low throughput (below the threshold).
 * Only flags layers that have active delivery (rate > 0) below the floor.
 */
export function computeRepairLowThroughputLayers(
  deliveryRatePerLayer: Readonly<Record<ShieldLayerId, number>>,
): ShieldLayerId[] {
  const low: ShieldLayerId[] = [];
  for (const id of SHIELD_LAYER_ORDER) {
    const rate = deliveryRatePerLayer[id] ?? 0;
    // Rate of 0 means no active jobs for this layer — not a low-throughput signal.
    // Only flag layers that have active delivery below the threshold.
    if (rate > 0 && rate < SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD) {
      low.push(id);
    }
  }
  return low;
}

/**
 * Build a ShieldRepairQueueHistoryEntry from tick-level event counts.
 */
export function buildRepairQueueAdapterHistoryEntry(
  tick: number,
  queueDepth: number,
  totalPendingHp: number,
  deliveredThisTick: number,
  newJobsThisTick: number,
  completionsThisTick: number,
  rejectionsThisTick: number,
): ShieldRepairQueueHistoryEntry {
  return {
    tick,
    queueDepth,
    totalPendingHp,
    deliveredThisTick,
    newJobsThisTick,
    completionsThisTick,
    rejectionsThisTick,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — ShieldRepairQueueSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The authoritative adapter that translates `ShieldRepairQueue` events into
 * backend chat `ChatInputEnvelope` signals.
 *
 * Instantiates the full companion ensemble internally and exposes:
 * - `adapt()` — primary single-tick ingress
 * - `adaptBatch()` — multi-tick batch ingress
 * - `buildHealthReport()` / `buildMLBundle()` / `buildDLBundle()` — telemetry
 * - `getState()` / `getReport()` — adapter diagnostics
 * - `reset()` — clear all adapter state
 */
export class ShieldRepairQueueSignalAdapter {
  private readonly options: Required<ShieldRepairQueueAdapterOptions>;
  private readonly ensemble: ShieldRepairQueueEnsemble;

  // Deduplication state — maps eventName → last tick it fired
  private lastEventTicks: Record<string, number> = {};
  private signalCount = 0;
  private rejectedCount = 0;
  private lastTick = -1;
  private lastSignalAt: UnixMs | null = null;
  private totalJobsObserved = 0;
  private totalCompletionsObserved = 0;
  private totalRejectionsObserved = 0;
  private readonly adapterHistory: ShieldRepairQueueHistoryEntry[] = [];

  constructor(options: ShieldRepairQueueAdapterOptions = {}) {
    this.options = {
      logger: options.logger ?? {
        debug: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      clock: options.clock ?? { now: () => asUnixMs(Date.now()) },
      dedupeWindowTicks:
        options.dedupeWindowTicks ?? SHIELD_REPAIR_QUEUE_ADAPTER_DEDUPE_WINDOW_TICKS,
      maxBatchSize:
        options.maxBatchSize ?? SHIELD_REPAIR_QUEUE_ADAPTER_MAX_BATCH_SIZE,
      suppressIdleTicks: options.suppressIdleTicks ?? true,
      alwaysSurfaceCriticalUrgency:
        options.alwaysSurfaceCriticalUrgency ?? true,
    };
    this.ensemble = createShieldRepairQueueWithAnalytics();
  }

  // ── Primary ingress ───────────────────────────────────────────────────────

  /**
   * Adapt a single tick's repair queue state into ChatInputEnvelopes.
   * Returns an array of envelopes (empty if suppressed by dedupe or idle policy).
   */
  public adapt(
    input: ShieldRepairQueueAdapterSignalInput,
  ): readonly ChatInputEnvelope[] {
    if (!validateRepairQueueAdapterInput(input)) {
      this.rejectedCount++;
      this.options.logger.warn(
        'ShieldRepairQueueSignalAdapter: invalid input rejected',
        { tick: input.tick as unknown as JsonValue },
      );
      return [];
    }

    const urgency = computeRepairQueueUrgency(
      input.jobs,
      input.layers,
      input.mode,
      input.phase,
    );
    const utilization = computeOverallUtilization(input.jobs);
    const isCritical =
      this.options.alwaysSurfaceCriticalUrgency &&
      urgency >= SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD;

    const surface = shouldSurfaceRepairQueueTick(
      urgency,
      utilization,
      input.newJobs,
      input.rejections,
    );

    if (!surface && !isCritical) {
      if (this.options.suppressIdleTicks) {
        this.rejectedCount++;
        return [];
      }
    }

    // Deduplication check
    const eventName = resolveRepairQueueAdapterEventName(
      input.newJobs,
      input.completedJobs,
      input.rejections,
      urgency,
      utilization,
      input.deliveredSlices,
    );
    const lastEventTick = this.lastEventTicks[eventName] ?? -Infinity;
    if (
      !isCritical &&
      input.tick - lastEventTick < this.options.dedupeWindowTicks
    ) {
      this.rejectedCount++;
      return [];
    }

    // Build the full bundle and collect envelopes
    const bundle = this._buildBundle(input, urgency, utilization, eventName);
    const envelopes = bundle.envelopes;

    // Update deduplication and adapter state
    this.lastEventTicks[eventName] = input.tick;
    this.totalJobsObserved += input.newJobs.length;
    this.totalCompletionsObserved += input.completedJobs.length;
    this.totalRejectionsObserved += input.rejections.length;
    this.signalCount++;
    this.lastTick = input.tick;
    this.lastSignalAt = this.options.clock.now();

    // Record analytics per-tick
    const queueDepth = input.jobs.filter((j) => j.ticksRemaining > 0).length;
    const totalPendingHp = computeTotalPendingHp(input.jobs);
    const deliveredThisTick = input.deliveredSlices.reduce(
      (s, sl) => s + sl.amount,
      0,
    );
    this.ensemble.analytics.recordTick(
      queueDepth,
      utilization,
      utilization >= SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD,
    );
    for (const job of input.newJobs) {
      this.ensemble.analytics.recordJobCreated(job);
    }
    for (const job of input.completedJobs) {
      this.ensemble.analytics.recordJobCompleted(job);
    }
    for (const rejection of input.rejections) {
      this.ensemble.analytics.recordRejection(rejection);
    }

    // Push history entry to trend analyzer
    const historyEntry = buildRepairQueueAdapterHistoryEntry(
      input.tick,
      queueDepth,
      totalPendingHp,
      deliveredThisTick,
      input.newJobs.length,
      input.completedJobs.length,
      input.rejections.length,
    );
    this.ensemble.trendAnalyzer.pushEntry(historyEntry);
    this.ensemble.inspector.setHistoryDepth(this.adapterHistory.length);

    // Ring buffer for adapter history
    this.adapterHistory.push(historyEntry);
    if (this.adapterHistory.length > SHIELD_REPAIR_QUEUE_ADAPTER_HISTORY_DEPTH) {
      this.adapterHistory.shift();
    }

    return envelopes;
  }

  /**
   * Adapt a batch of ticks. Respects maxBatchSize option.
   * Emits all accepted envelopes in tick order.
   */
  public adaptBatch(
    input: ShieldRepairQueueAdapterBatchInput,
  ): readonly ChatInputEnvelope[] {
    const ticks = input.ticks.slice(0, this.options.maxBatchSize);
    const allEnvelopes: ChatInputEnvelope[] = [];
    for (const tickInput of ticks) {
      const resolved: ShieldRepairQueueAdapterSignalInput = {
        ...tickInput,
        runId: tickInput.runId ?? input.runId,
        roomId: tickInput.roomId ?? input.roomId,
      };
      const envelopes = this.adapt(resolved);
      allEnvelopes.push(...envelopes);
    }
    return allEnvelopes;
  }

  // ── Diagnostics ─────────────────────────────────────────────────────────

  public getState(): ShieldRepairQueueAdapterState {
    return {
      signalCount: this.signalCount,
      rejectedCount: this.rejectedCount,
      lastTick: this.lastTick,
      lastSignalAt: this.lastSignalAt,
      totalJobsObserved: this.totalJobsObserved,
      totalCompletionsObserved: this.totalCompletionsObserved,
      totalRejectionsObserved: this.totalRejectionsObserved,
      historyDepth: this.adapterHistory.length,
    };
  }

  public getReport(): {
    readonly state: ShieldRepairQueueAdapterState;
    readonly analytics: ShieldRepairQueueAnalyticsSummary;
  } {
    return {
      state: this.getState(),
      analytics: this.ensemble.analytics.buildSummary(),
    };
  }

  public buildHealthReport(): ShieldRepairQueueAdapterHealthReport {
    return {
      ready: SHIELD_REPAIR_QUEUE_READY,
      version: SHIELD_REPAIR_QUEUE_ADAPTER_VERSION,
      state: this.getState(),
      analytics: this.ensemble.analytics.buildSummary(),
      mlFeatureCount: SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT,
      dlFeatureCount: SHIELD_REPAIR_QUEUE_ADAPTER_DL_FEATURE_COUNT,
      dlSequenceLength: SHIELD_REPAIR_QUEUE_ADAPTER_DL_SEQUENCE_LENGTH,
      historyDepth: this.adapterHistory.length,
      trendWindow: SHIELD_REPAIR_QUEUE_ADAPTER_TREND_WINDOW,
    };
  }

  public buildMLBundle(
    jobs: readonly RepairJob[],
    mode: ModeCode,
    phase: RunPhase,
    totalDelivered: number,
    totalQueued: number,
    rejectionCount: number,
    completionCount: number,
    tick: number,
  ): ShieldRepairQueueAdapterMLVectorCompat {
    const mlParams: ShieldRepairQueueMLParams = {
      jobs,
      mode,
      phase,
      totalDelivered,
      totalQueued,
      rejectionCount,
      completionCount,
    };
    const vector = this.ensemble.mlExtractor.extractVector(mlParams);
    const features = extractRepairQueueMLArray(vector);
    return {
      tick,
      vector,
      features,
      labels: SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS,
      featureCount: SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT,
      valid: validateRepairQueueMLArray(features),
    };
  }

  public buildDLBundle(tick: number): ShieldRepairQueueAdapterDLTensorCompat {
    const tensor = this.ensemble.dlBuilder.getTensor();
    const latestRow =
      tensor.rows.length > 0 ? tensor.rows[tensor.rows.length - 1] : null;
    const valid = latestRow !== null && validateRepairQueueDLRow(latestRow);
    // Ensure tick is consumed
    void tick;
    return {
      tensor,
      latestTick: tensor.latestTick,
      sequenceLength: tensor.sequenceLength,
      featureCount: tensor.featureCount,
      valid,
    };
  }

  public reset(): void {
    this.lastEventTicks = {};
    this.signalCount = 0;
    this.rejectedCount = 0;
    this.lastTick = -1;
    this.lastSignalAt = null;
    this.totalJobsObserved = 0;
    this.totalCompletionsObserved = 0;
    this.totalRejectionsObserved = 0;
    this.adapterHistory.length = 0;
    this.ensemble.dlBuilder.reset();
    this.ensemble.trendAnalyzer.reset();
    this.ensemble.analytics.reset();
  }

  // ── Private bundle construction ──────────────────────────────────────────

  private _buildBundle(
    input: ShieldRepairQueueAdapterSignalInput,
    urgency: number,
    utilization: number,
    eventName: ShieldRepairQueueAdapterEventName,
  ): ShieldRepairQueueAdapterBundle {
    const { mlExtractor, dlBuilder, trendAnalyzer, forecaster, annotator, inspector } =
      this.ensemble;

    // ── ML vector ─────────────────────────────────────────────────────────
    const mlParams: ShieldRepairQueueMLParams = {
      jobs: input.jobs,
      mode: input.mode,
      phase: input.phase,
      totalDelivered: input.totalDelivered,
      totalQueued: input.totalQueued,
      rejectionCount: input.rejectionCount,
      completionCount: input.completionCount,
    };
    const mlVector = mlExtractor.extractVector(mlParams);

    // ── DL tensor — build and push this tick's row ──────────────────────
    const deliveredThisTick: Record<ShieldLayerId, number> = {
      L1: 0, L2: 0, L3: 0, L4: 0,
    };
    const queuedThisTick: Record<ShieldLayerId, number> = {
      L1: 0, L2: 0, L3: 0, L4: 0,
    };

    for (const slice of input.deliveredSlices) {
      const targets: readonly ShieldLayerId[] =
        slice.layerId === 'ALL'
          ? SHIELD_LAYER_ORDER
          : [slice.layerId as ShieldLayerId];
      for (const id of targets) {
        deliveredThisTick[id] = (deliveredThisTick[id] ?? 0) + slice.amount;
      }
    }
    for (const job of input.newJobs) {
      const targets: readonly ShieldLayerId[] =
        job.layerId === 'ALL'
          ? SHIELD_LAYER_ORDER
          : [job.layerId as ShieldLayerId];
      for (const id of targets) {
        queuedThisTick[id] = (queuedThisTick[id] ?? 0) + job.amount;
      }
    }

    const completedLayerIds: ShieldLayerId[] = [];
    for (const job of input.completedJobs) {
      const targets: readonly ShieldLayerId[] =
        job.layerId === 'ALL' ? SHIELD_LAYER_ORDER : [job.layerId as ShieldLayerId];
      completedLayerIds.push(...targets);
    }

    const rejectedLayerIds: ShieldLayerId[] = [];
    for (const r of input.rejections) {
      const targets: readonly ShieldLayerId[] =
        r.layerId === 'ALL' ? SHIELD_LAYER_ORDER : [r.layerId as ShieldLayerId];
      rejectedLayerIds.push(...targets);
    }

    const createdLayerIds: ShieldLayerId[] = [];
    for (const job of input.newJobs) {
      const targets: readonly ShieldLayerId[] =
        job.layerId === 'ALL' ? SHIELD_LAYER_ORDER : [job.layerId as ShieldLayerId];
      createdLayerIds.push(...targets);
    }

    const overflowLayerIds = SHIELD_LAYER_ORDER.filter((id) =>
      isLayerAtOverflowRisk(input.jobs, id),
    );

    const maxTotalHp = SHIELD_REPAIR_QUEUE_MAX_QUEUED_HP * 4;
    const dlRowParams: ShieldRepairQueueDLRowParams = {
      tick: input.tick,
      previousJobs: input.previousJobs,
      currentJobs: input.jobs,
      deliveredThisTick,
      queuedThisTick,
      completedLayerIds,
      rejectedLayerIds,
      createdLayerIds,
      overflowLayerIds,
      totalDeliveredNormalized: Math.min(1, input.totalDelivered / maxTotalHp),
      maxTick: Math.max(100, input.tick),
    };
    dlBuilder.buildAndPush(dlRowParams);
    const dlTensor = dlBuilder.getTensor();

    // ── Trend summary ──────────────────────────────────────────────────────
    const trendSummary = trendAnalyzer.computeSummary(input.tick);

    // ── Capacity forecast ─────────────────────────────────────────────────
    const forecast = forecaster.forecastAll(
      input.layers,
      input.jobs,
      input.mode,
      input.phase,
      input.tick,
    );

    // ── Annotation bundle ─────────────────────────────────────────────────
    const annotationBundle = annotator.buildAnnotationBundle(
      input.tick,
      input.jobs,
      input.layers,
      input.newJobs,
      input.completedJobs,
      input.rejections,
      input.deliveredSlices,
      input.mode,
      input.phase,
    );

    // ── UX hint ───────────────────────────────────────────────────────────
    const uxHint = annotator.buildUXHint(
      input.jobs,
      input.layers,
      input.mode,
      input.phase,
    );

    // ── Inspector state ───────────────────────────────────────────────────
    const inspectorState = inspector.inspect(
      input.jobs,
      input.mode,
      input.phase,
      input.tick,
      input.totalDelivered,
      input.totalQueued,
      input.rejectionCount,
      input.completionCount,
    );

    // ── Severity, headline, detail ────────────────────────────────────────
    const severity = classifyRepairQueueAdapterSeverity(
      urgency,
      utilization,
      input.rejections.length,
    );
    const headline = buildRepairQueueUXHeadline(
      input.jobs,
      input.layers,
      input.mode,
      input.phase,
    );
    const detail = buildRepairQueueAdapterDetailString(
      input.tick,
      input.mode,
      input.phase,
      urgency,
      utilization,
      input.totalDelivered,
      input.newJobs.length,
      input.rejections.length,
    );

    // ── Channel ───────────────────────────────────────────────────────────
    const channel =
      getRepairQueueChatChannel(urgency) as ShieldRepairQueueAdapterChannelRecommendation;

    // ── Narrative weight ──────────────────────────────────────────────────
    const narrativeWeight = buildRepairQueueNarrativeWeight(
      input.jobs,
      input.layers,
      input.mode,
      input.phase,
      input.pressureTier,
    );

    // ── Chat signal ───────────────────────────────────────────────────────
    const signal: ShieldRepairQueueAdapterChatSignalCompat = {
      eventName,
      tick: input.tick,
      runId: input.runId ?? 'unknown',
      severity,
      channel,
      headline,
      detail,
      layerId:
        input.newJobs[0]?.layerId !== 'ALL'
          ? ((input.newJobs[0]?.layerId as ShieldLayerId | undefined) ?? null)
          : null,
      urgency,
      utilization,
      totalDelivered: input.totalDelivered,
      mode: input.mode,
      phase: input.phase,
      pressureTier: input.pressureTier,
      mlVector,
      narrativeWeight,
      emittedAt: this.options.clock.now(),
    };

    // ── ML vector compat ──────────────────────────────────────────────────
    const mlFeatures = extractRepairQueueMLArray(mlVector);
    const mlVectorCompat: ShieldRepairQueueAdapterMLVectorCompat = {
      tick: input.tick,
      vector: mlVector,
      features: mlFeatures,
      labels: SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS,
      featureCount: SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT,
      valid: validateRepairQueueMLArray(mlFeatures),
    };

    // ── DL tensor compat ──────────────────────────────────────────────────
    const latestRow =
      dlTensor.rows.length > 0 ? dlTensor.rows[dlTensor.rows.length - 1] : null;
    const dlValid = latestRow !== null && validateRepairQueueDLRow(latestRow);
    const dlTensorCompat: ShieldRepairQueueAdapterDLTensorCompat = {
      tensor: dlTensor,
      latestTick: dlTensor.latestTick,
      sequenceLength: dlTensor.sequenceLength,
      featureCount: dlTensor.featureCount,
      valid: dlValid,
    };

    // ── UX hint compat ────────────────────────────────────────────────────
    const uxHintCompat: ShieldRepairQueueAdapterUXHintCompat = {
      tick: input.tick,
      hint: uxHint,
      urgency,
      urgencyLabel: classifyRepairQueueUrgency(urgency),
      channel: uxHint.chatChannel as ShieldRepairQueueAdapterChannelRecommendation,
    };

    // ── Annotation compat ─────────────────────────────────────────────────
    const annotationCompat: ShieldRepairQueueAdapterAnnotationCompat = {
      tick: input.tick,
      bundle: annotationBundle,
      overallHeadline: annotationBundle.overallHeadline,
      uxSummary: annotationBundle.uxSummary,
    };

    // ── Threshold report ──────────────────────────────────────────────────
    const thresholdReport = buildRepairQueueThresholdReport(
      input.jobs,
      input.layers,
      input.mode,
      input.phase,
    );

    // ── Envelopes ─────────────────────────────────────────────────────────
    const envelopes = this._buildEnvelopes(
      signal,
      mlVectorCompat,
      dlTensorCompat,
      annotationCompat,
      input,
    );

    return {
      tick: input.tick,
      signal,
      mlVector: mlVectorCompat,
      dlTensor: dlTensorCompat,
      uxHint: uxHintCompat,
      annotation: annotationCompat,
      inspectorState,
      forecast,
      trendSummary,
      thresholdReport,
      envelopes,
    };
  }

  private _buildEnvelopes(
    signal: ShieldRepairQueueAdapterChatSignalCompat,
    mlVectorCompat: ShieldRepairQueueAdapterMLVectorCompat,
    dlTensorCompat: ShieldRepairQueueAdapterDLTensorCompat,
    annotationCompat: ShieldRepairQueueAdapterAnnotationCompat,
    input: ShieldRepairQueueAdapterSignalInput,
  ): readonly ChatInputEnvelope[] {
    const envelopes: ChatInputEnvelope[] = [];

    // Primary repair queue signal
    const primary: ChatSignalEnvelope = {
      type: 'BATTLE',
      emittedAt: signal.emittedAt,
      roomId: input.roomId ?? null,
      metadata: {
        eventName: signal.eventName,
        channel: signal.channel,
        tick: signal.tick,
        runId: signal.runId,
        severity: signal.severity,
        headline: signal.headline,
        detail: signal.detail,
        layerId: signal.layerId,
        urgency: signal.urgency,
        utilization: signal.utilization,
        totalDelivered: signal.totalDelivered,
        mode: signal.mode,
        phase: signal.phase,
        pressureTier: signal.pressureTier,
        narrativeWeight: signal.narrativeWeight,
        newJobCount: input.newJobs.length,
        completedJobCount: input.completedJobs.length,
        rejectionCount: input.rejections.length,
        deliverySliceCount: input.deliveredSlices.length,
      } as unknown as Readonly<Record<string, JsonValue>>,
    };
    envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: primary });

    // ML data envelope when narrative weight is meaningful
    if (signal.narrativeWeight >= 0.25 && mlVectorCompat.valid) {
      const mlEnvelope: ChatSignalEnvelope = {
        type: 'BATTLE',
        emittedAt: signal.emittedAt,
        roomId: input.roomId ?? null,
        metadata: {
          eventName: 'shield_repair_queue.delivery',
          channel: 'REPAIR_LOW',
          mlVector: mlVectorCompat.features,
          featureLabels: SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS,
          dlSequenceLength: dlTensorCompat.sequenceLength,
          tick: signal.tick,
          featureCount: mlVectorCompat.featureCount,
        } as unknown as Readonly<Record<string, JsonValue>>,
      };
      envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: mlEnvelope });
    }

    // Job creation envelopes — up to 3 per tick for individual job detail
    for (const job of input.newJobs.slice(0, 3)) {
      const jobCompat = buildRepairJobCompat(job);
      const jobEnvelope: ChatSignalEnvelope = {
        type: 'BATTLE',
        emittedAt: signal.emittedAt,
        roomId: input.roomId ?? null,
        metadata: {
          eventName: 'shield_repair_queue.job_created',
          channel: signal.channel,
          jobId: jobCompat.jobId,
          layerId: jobCompat.layerId,
          amount: jobCompat.amount,
          durationTicks: job.durationTicks,
          amountPerTick: jobCompat.amountPerTick,
          source: jobCompat.source,
          tags: [...jobCompat.tags],
          tick: signal.tick,
        } as unknown as Readonly<Record<string, JsonValue>>,
      };
      envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: jobEnvelope });
    }

    // Rejection envelope when jobs are rejected
    if (input.rejections.length > 0) {
      const rej = input.rejections[0]!;
      const rejectionCompat = buildRepairRejectionCompat(rej);
      const rejectionEnvelope: ChatSignalEnvelope = {
        type: 'BATTLE',
        emittedAt: signal.emittedAt,
        roomId: input.roomId ?? null,
        metadata: {
          eventName: 'shield_repair_queue.job_rejected',
          channel: 'REPAIR_HIGH',
          rejectionCount: input.rejections.length,
          layerId: rejectionCompat.layerId,
          amount: rejectionCompat.amount,
          reason: rejectionCompat.reason,
          tick: signal.tick,
          utilization: signal.utilization,
        } as unknown as Readonly<Record<string, JsonValue>>,
      };
      envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: rejectionEnvelope });
    }

    // Delivery envelope — aggregate HP delivered this tick
    if (input.deliveredSlices.length > 0) {
      const totalThisTick = input.deliveredSlices.reduce(
        (s, sl) => s + sl.amount,
        0,
      );
      const deliveredLayers = [
        ...new Set(
          input.deliveredSlices
            .filter((sl) => sl.layerId !== 'ALL')
            .map((sl) => sl.layerId as ShieldLayerId),
        ),
      ];
      const deliveryEnvelope: ChatSignalEnvelope = {
        type: 'BATTLE',
        emittedAt: signal.emittedAt,
        roomId: input.roomId ?? null,
        metadata: {
          eventName: 'shield_repair_queue.delivery',
          channel: 'REPAIR_LOW',
          totalDeliveredThisTick: totalThisTick,
          sliceCount: input.deliveredSlices.length,
          deliveredLayers,
          tick: signal.tick,
        } as unknown as Readonly<Record<string, JsonValue>>,
      };
      envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: deliveryEnvelope });
    }

    // Annotation envelope when completions or new jobs occurred
    if (
      annotationCompat.bundle.jobCreations.length > 0 ||
      annotationCompat.bundle.jobCompletions.length > 0
    ) {
      const annotEnvelope: ChatSignalEnvelope = {
        type: 'BATTLE',
        emittedAt: signal.emittedAt,
        roomId: input.roomId ?? null,
        metadata: {
          eventName: 'shield_repair_queue.posture_changed',
          channel: signal.channel,
          overallHeadline: annotationCompat.overallHeadline,
          uxSummary: annotationCompat.uxSummary,
          jobCreationCount: annotationCompat.bundle.jobCreations.length,
          jobCompletionCount: annotationCompat.bundle.jobCompletions.length,
          rejectionEventCount: annotationCompat.bundle.rejectionEvents.length,
          deliveryEventCount: annotationCompat.bundle.deliveryEvents.length,
        } as unknown as Readonly<Record<string, JsonValue>>,
      };
      envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: annotEnvelope });
    }

    // Low-throughput envelope — fires when active layers are below HP/tick floor
    const deliveryRatePerLayer = computeDeliveryRatePerLayer(input.jobs);
    const lowThroughputLayers = computeRepairLowThroughputLayers(deliveryRatePerLayer);
    if (lowThroughputLayers.length > 0) {
      const ltEnvelope: ChatSignalEnvelope = {
        type: 'BATTLE',
        emittedAt: signal.emittedAt,
        roomId: input.roomId ?? null,
        metadata: {
          eventName: 'shield_repair_queue.low_throughput',
          channel: 'REPAIR_MID',
          lowThroughputLayers,
          threshold: SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD,
          rateL1: deliveryRatePerLayer['L1'] ?? 0,
          rateL2: deliveryRatePerLayer['L2'] ?? 0,
          rateL3: deliveryRatePerLayer['L3'] ?? 0,
          rateL4: deliveryRatePerLayer['L4'] ?? 0,
          tick: signal.tick,
        } as unknown as Readonly<Record<string, JsonValue>>,
      };
      envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: ltEnvelope });
    }

    // Coverage deficit envelope — fires when coverage ratio is critically low
    const coverageRatio = scoreRepairCoverageRatio(input.jobs, input.layers);
    if (coverageRatio < 0.30 && signal.urgency > 0.40) {
      const coverageEnvelope: ChatSignalEnvelope = {
        type: 'BATTLE',
        emittedAt: signal.emittedAt,
        roomId: input.roomId ?? null,
        metadata: {
          eventName: 'shield_repair_queue.coverage_deficit',
          channel: 'REPAIR_HIGH',
          coverageRatio,
          urgency: signal.urgency,
          priorityLayers: findRepairPriorityLayers(input.layers, input.jobs),
          tick: signal.tick,
        } as unknown as Readonly<Record<string, JsonValue>>,
      };
      envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: coverageEnvelope });
    }

    return envelopes;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — Factory functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new ShieldRepairQueueSignalAdapter with default options.
 */
export function createShieldRepairQueueSignalAdapter(
  options: ShieldRepairQueueAdapterOptions = {},
): ShieldRepairQueueSignalAdapter {
  return new ShieldRepairQueueSignalAdapter(options);
}

/**
 * Build a one-shot adapter bundle for a single tick's input.
 * Builds envelopes, ML vector, DL tensor, UX hint, annotation, forecast, and trend.
 */
export function buildRepairQueueAdapterBundle(
  adapter: ShieldRepairQueueSignalAdapter,
  input: ShieldRepairQueueAdapterSignalInput,
): ShieldRepairQueueAdapterBundle {
  // Run through adapt to record all analytics and history
  const envelopes = adapter.adapt(input);

  // Reconstruct derived data for the bundle
  const urgency = computeRepairQueueUrgency(
    input.jobs,
    input.layers,
    input.mode,
    input.phase,
  );
  const utilization = computeOverallUtilization(input.jobs);
  const eventName = resolveRepairQueueAdapterEventName(
    input.newJobs,
    input.completedJobs,
    input.rejections,
    urgency,
    utilization,
    input.deliveredSlices,
  );

  const mlVectorCompat = adapter.buildMLBundle(
    input.jobs,
    input.mode,
    input.phase,
    input.totalDelivered,
    input.totalQueued,
    input.rejectionCount,
    input.completionCount,
    input.tick,
  );
  const dlTensorCompat = adapter.buildDLBundle(input.tick);

  const annotator = new ShieldRepairQueueAnnotator();
  const annotationBundle = annotator.buildAnnotationBundle(
    input.tick,
    input.jobs,
    input.layers,
    input.newJobs,
    input.completedJobs,
    input.rejections,
    input.deliveredSlices,
    input.mode,
    input.phase,
  );
  const uxHint = annotator.buildUXHint(
    input.jobs,
    input.layers,
    input.mode,
    input.phase,
  );

  const inspector = new ShieldRepairQueueInspector();
  const inspectorState = inspector.inspect(
    input.jobs,
    input.mode,
    input.phase,
    input.tick,
    input.totalDelivered,
    input.totalQueued,
    input.rejectionCount,
    input.completionCount,
  );

  const forecaster = new ShieldRepairQueueForecaster();
  const forecast = forecaster.forecastAll(
    input.layers,
    input.jobs,
    input.mode,
    input.phase,
    input.tick,
  );

  const trendAnalyzer = new ShieldRepairQueueTrendAnalyzer();
  const trendSummary = trendAnalyzer.computeSummary(input.tick);

  const channel =
    getRepairQueueChatChannel(urgency) as ShieldRepairQueueAdapterChannelRecommendation;
  const severity = classifyRepairQueueAdapterSeverity(
    urgency,
    utilization,
    input.rejections.length,
  );
  const headline = buildRepairQueueUXHeadline(
    input.jobs,
    input.layers,
    input.mode,
    input.phase,
  );
  const detail = buildRepairQueueAdapterDetailString(
    input.tick,
    input.mode,
    input.phase,
    urgency,
    utilization,
    input.totalDelivered,
    input.newJobs.length,
    input.rejections.length,
  );
  const narrativeWeight = buildRepairQueueNarrativeWeight(
    input.jobs,
    input.layers,
    input.mode,
    input.phase,
    input.pressureTier,
  );

  const signal: ShieldRepairQueueAdapterChatSignalCompat = {
    eventName,
    tick: input.tick,
    runId: input.runId ?? 'unknown',
    severity,
    channel,
    headline,
    detail,
    layerId:
      input.newJobs[0]?.layerId !== 'ALL'
        ? ((input.newJobs[0]?.layerId as ShieldLayerId | undefined) ?? null)
        : null,
    urgency,
    utilization,
    totalDelivered: input.totalDelivered,
    mode: input.mode,
    phase: input.phase,
    pressureTier: input.pressureTier,
    mlVector: mlVectorCompat.vector,
    narrativeWeight,
    emittedAt: asUnixMs(Date.now()),
  };

  const thresholdReport = buildRepairQueueThresholdReport(
    input.jobs,
    input.layers,
    input.mode,
    input.phase,
  );

  return {
    tick: input.tick,
    signal,
    mlVector: mlVectorCompat,
    dlTensor: dlTensorCompat,
    uxHint: {
      tick: input.tick,
      hint: uxHint,
      urgency,
      urgencyLabel: classifyRepairQueueUrgency(urgency),
      channel: uxHint.chatChannel as ShieldRepairQueueAdapterChannelRecommendation,
    },
    annotation: {
      tick: input.tick,
      bundle: annotationBundle,
      overallHeadline: annotationBundle.overallHeadline,
      uxSummary: annotationBundle.uxSummary,
    },
    inspectorState,
    forecast,
    trendSummary,
    thresholdReport,
    envelopes,
  };
}

/**
 * Build an adapter bundle directly from a RunStateSnapshot.
 */
export function buildRepairQueueAdapterBundleFromSnapshot(
  adapter: ShieldRepairQueueSignalAdapter,
  snapshot: RunStateSnapshot,
  jobs: readonly RepairJob[],
  previousJobs: readonly RepairJob[],
  newJobs: readonly RepairJob[],
  completedJobs: readonly RepairJob[],
  rejections: readonly QueueRejection[],
  deliveredSlices: readonly PendingRepairSlice[],
  totalDelivered: number,
  totalQueued: number,
  completionCount: number,
  rejectionCount: number,
  threats: readonly ThreatEnvelope[],
  botStates: Readonly<Record<HaterBotId, BotState>>,
  attacks: readonly AttackEvent[],
): ShieldRepairQueueAdapterBundle {
  const input: ShieldRepairQueueAdapterSignalInput = {
    tick: snapshot.tick,
    jobs,
    previousJobs,
    mode: snapshot.mode,
    phase: snapshot.phase,
    pressureTier: 'T2',
    newJobs,
    completedJobs,
    rejections,
    deliveredSlices,
    layers: snapshot.shield.layers,
    threats,
    botStates,
    attacks,
    totalDelivered,
    totalQueued,
    completionCount,
    rejectionCount,
    runId: snapshot.runId ?? 'snapshot',
  };
  return buildRepairQueueAdapterBundle(adapter, input);
}

/**
 * Extract the ML vector directly from job state and counters.
 */
export function extractRepairQueueAdapterMLVector(
  jobs: readonly RepairJob[],
  mode: ModeCode,
  phase: RunPhase,
  totalDelivered: number,
  totalQueued: number,
  rejectionCount: number,
  completionCount: number,
): ShieldRepairQueueAdapterMLVectorCompat {
  const extractor = new ShieldRepairQueueMLExtractor();
  const vector = extractor.extractVector({
    jobs,
    mode,
    phase,
    totalDelivered,
    totalQueued,
    rejectionCount,
    completionCount,
  });
  const features = extractRepairQueueMLArray(vector);
  return {
    tick: 0,
    vector,
    features,
    labels: SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS,
    featureCount: SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT,
    valid: validateRepairQueueMLArray(features),
  };
}

/**
 * Score the overall repair queue risk (0-1) for a given configuration.
 */
export function scoreRepairQueueAdapterRisk(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): number {
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  const utilization = computeOverallUtilization(jobs);
  const narrativeWeight = buildRepairQueueNarrativeWeight(
    jobs,
    layers,
    mode,
    phase,
    pressureTier,
  );
  return Math.min(1, urgency * 0.45 + utilization * 0.25 + narrativeWeight * 0.30);
}

/**
 * Get the channel recommendation for a given urgency score.
 */
export function getRepairQueueAdapterChatChannel(
  urgency: number,
): ShieldRepairQueueAdapterChannelRecommendation {
  return getRepairQueueChatChannel(urgency) as ShieldRepairQueueAdapterChannelRecommendation;
}

/**
 * Build the narrative weight compat object for adapter-level decisions.
 */
export function buildRepairQueueAdapterNarrativeWeight(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): ShieldRepairQueueAdapterNarrativeWeight {
  const score = buildRepairQueueNarrativeWeight(
    jobs,
    layers,
    mode,
    phase,
    pressureTier,
  );
  if (score >= 0.80) return { score, label: 'CRITICAL', shouldSurface: true };
  if (score >= 0.60) return { score, label: 'HIGH', shouldSurface: true };
  if (score >= 0.35) return { score, label: 'MODERATE', shouldSurface: true };
  if (score >= 0.15) return { score, label: 'LOW', shouldSurface: false };
  return { score, label: 'NEGLIGIBLE', shouldSurface: false };
}

/**
 * Build the threshold report string for adapter state.
 */
export function buildRepairQueueAdapterThresholdReport(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  return buildRepairQueueThresholdReport(jobs, layers, mode, phase);
}

/**
 * Build an ML compat object usable by cross-subsystem ML pipelines.
 */
export function buildRepairQueueAdapterMLCompat(
  vector: ShieldRepairQueueMLVector,
): ReturnType<typeof buildRepairQueueMLCompat> {
  return buildRepairQueueMLCompat(vector);
}

/**
 * Build a DL tensor compat wrapper from an existing tensor.
 */
export function buildRepairQueueAdapterDLCompat(
  tensor: ShieldRepairQueueDLTensor,
): ShieldRepairQueueAdapterDLTensorCompat {
  const latestRow =
    tensor.rows.length > 0 ? tensor.rows[tensor.rows.length - 1] : null;
  const valid = latestRow !== null && validateRepairQueueDLRow(latestRow);
  return {
    tensor,
    latestTick: tensor.latestTick,
    sequenceLength: tensor.sequenceLength,
    featureCount: tensor.featureCount,
    valid,
  };
}

/**
 * Build a UX hint compat from jobs, layers, and mode/phase context.
 */
export function buildRepairQueueAdapterUXHintCompat(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
): ShieldRepairQueueAdapterUXHintCompat {
  const annotator = new ShieldRepairQueueAnnotator();
  const hint = annotator.buildUXHint(jobs, layers, mode, phase);
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  return {
    tick,
    hint,
    urgency,
    urgencyLabel: classifyRepairQueueUrgency(urgency),
    channel: hint.chatChannel as ShieldRepairQueueAdapterChannelRecommendation,
  };
}

/**
 * Build an annotation compat from a bundle and tick.
 */
export function buildRepairQueueAdapterAnnotationCompat(
  bundle: ShieldRepairQueueAnnotationBundle,
  tick: number,
): ShieldRepairQueueAdapterAnnotationCompat {
  return {
    tick,
    bundle,
    overallHeadline: bundle.overallHeadline,
    uxSummary: bundle.uxSummary,
  };
}

/**
 * Build a full adapter session report from a live adapter instance.
 */
export function buildRepairQueueAdapterSessionReport(
  adapter: ShieldRepairQueueSignalAdapter,
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  runId: string,
  finalTick: number,
  totalDelivered: number,
  totalQueued: number,
  rejectionCount: number,
  completionCount: number,
): ShieldRepairQueueAdapterSessionReport {
  const state = adapter.getState();
  const report = adapter.getReport();

  const ensemble = createShieldRepairQueueWithAnalytics();
  const sessionReport = buildShieldRepairQueueSessionReport(
    runId,
    finalTick,
    jobs,
    layers,
    mode,
    phase,
    ensemble.analytics,
    ensemble.trendAnalyzer,
    ensemble.forecaster,
    ensemble.mlExtractor,
    totalDelivered,
    totalQueued,
    rejectionCount,
    completionCount,
  );

  const finalThresholdReport = buildRepairQueueThresholdReport(
    jobs,
    layers,
    mode,
    phase,
  );

  return {
    runId,
    finalTick,
    state,
    analytics: report.analytics,
    sessionReport,
    finalThresholdReport,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — Analytics and diagnostics helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a full exposure profile with live threat and bot-state context.
 */
export function buildRepairQueueAdapterFullExposureProfile(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
  tick: number,
  threats: readonly ThreatEnvelope[],
  botStates: Readonly<Record<HaterBotId, BotState>>,
): ShieldRepairQueueAdapterExposureProfile {
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  const urgencyLabel = classifyRepairQueueUrgency(urgency);
  const overflowRiskMap = buildOverflowRiskMap(jobs);
  const priorityLayers = findRepairPriorityLayers(layers, jobs);
  const saturation = computeQueueSaturation(jobs);
  const coverageRatio = scoreRepairCoverageRatio(jobs, layers);
  const botThreatScore = computeRepairBotThreatContribution(botStates);
  const threatPressure = computeRepairThreatPressure(threats, tick);
  const narrativeWeight = buildRepairQueueNarrativeWeight(
    jobs,
    layers,
    mode,
    phase,
    pressureTier,
  );

  return {
    tick,
    overallUrgency: urgency,
    urgencyLabel,
    overflowRiskMap,
    priorityLayers,
    saturation,
    coverageRatio,
    botThreatScore,
    threatPressure,
    narrativeWeight,
  };
}

/**
 * Build the per-layer absorption weight map.
 */
export function buildRepairQueueAdapterAbsorptionWeightMap(): Readonly<
  Record<ShieldLayerId, number>
> {
  const result: Record<string, number> = {};
  for (const id of SHIELD_LAYER_ORDER) {
    result[id] = computeRepairAbsorptionWeight(id);
  }
  return result as Readonly<Record<ShieldLayerId, number>>;
}

/**
 * Compute the repair status label for each layer given current job state.
 */
export function buildRepairQueueAdapterStatusLabelMap(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
): Readonly<Record<ShieldLayerId, string>> {
  const activeCount = computeActiveJobCountPerLayer(jobs);
  const pendingHp = computePendingHpPerLayer(jobs);
  const result: Record<string, string> = {};
  for (const layer of layers) {
    const id = layer.layerId;
    result[id] = buildRepairStatusLabel(
      pendingHp[id] ?? 0,
      activeCount[id] ?? 0,
      layer.breached,
    );
  }
  return result as Readonly<Record<ShieldLayerId, string>>;
}

/**
 * Compute the low-throughput layers with their current delivery rate.
 */
export function buildRepairQueueAdapterLowThroughputDiagnostic(
  jobs: readonly RepairJob[],
): {
  readonly lowThroughputLayers: readonly ShieldLayerId[];
  readonly deliveryRatePerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly threshold: number;
  readonly anyLowThroughput: boolean;
} {
  const deliveryRatePerLayer = computeDeliveryRatePerLayer(jobs);
  const lowThroughputLayers = computeRepairLowThroughputLayers(deliveryRatePerLayer);
  return {
    lowThroughputLayers,
    deliveryRatePerLayer,
    threshold: SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD,
    anyLowThroughput: lowThroughputLayers.length > 0,
  };
}

/**
 * Determine whether the repair queue is currently fully saturated.
 */
export function isRepairQueueAdapterSaturated(jobs: readonly RepairJob[]): boolean {
  return computeQueueSaturation(jobs) >= SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION;
}

/**
 * Determine whether any layer has an overflow risk.
 */
export function hasRepairQueueAdapterOverflowRisk(jobs: readonly RepairJob[]): boolean {
  for (const id of SHIELD_LAYER_ORDER) {
    if (isLayerAtOverflowRisk(jobs, id)) return true;
  }
  return false;
}

/**
 * Build a detailed diagnostic string for all four layers.
 */
export function buildRepairQueueAdapterLayerDiagnosticString(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  const activeCount = computeActiveJobCountPerLayer(jobs);
  const pendingHp = computePendingHpPerLayer(jobs);
  const deliveryRate = computeDeliveryRatePerLayer(jobs);
  const progressRatio = computeProgressRatioPerLayer(jobs);
  const overflowRisk = buildOverflowRiskMap(jobs);
  const parts: string[] = [];

  for (const layer of layers) {
    const id = layer.layerId;
    const label =
      id === 'L1' ? 'CASH_RESERVE'
      : id === 'L2' ? 'CREDIT_LINE'
      : id === 'L3' ? 'INCOME_BASE'
      : 'NETWORK_CORE';
    const statusLabel = buildRepairStatusLabel(
      pendingHp[id] ?? 0,
      activeCount[id] ?? 0,
      layer.breached,
    );
    parts.push(
      `${id}[${label}]: jobs=${activeCount[id] ?? 0} ` +
        `pending=${(pendingHp[id] ?? 0).toFixed(0)}HP ` +
        `rate=${(deliveryRate[id] ?? 0).toFixed(1)}HP/tick ` +
        `progress=${Math.round((progressRatio[id] ?? 0) * 100)}% ` +
        `overflow=${overflowRisk[id] ? 'Y' : 'N'} ` +
        `status=${statusLabel}`,
    );
  }

  const description = describeRepairQueueState(jobs, mode, phase);
  return `[${description}] | ` + parts.join(' | ');
}

/**
 * Build a forecast summary string from a capacity forecast.
 */
export function buildRepairQueueAdapterForecastSummary(
  forecast: ShieldRepairQueueCapacityForecast,
): string {
  const parts: string[] = [
    `tick=${forecast.tick}`,
    `urgency=${Math.round(forecast.overallRepairUrgency * 100)}%`,
    `criticalLayers=[${forecast.criticalLayerIds.join(',')}]`,
  ];

  for (const lf of forecast.layers) {
    const ttfr =
      lf.ticksToFullRepair !== null ? `${lf.ticksToFullRepair}t` : 'unknown';
    parts.push(
      `${lf.layerId}: deficit=${lf.currentHpDeficit.toFixed(0)}HP ` +
        `pending=${lf.pendingHp.toFixed(0)}HP ` +
        `rate=${lf.estimatedDeliveryRate.toFixed(1)}HP/t ` +
        `ttfr=${ttfr} ` +
        `canRepair=${lf.canFullyRepair ? 'Y' : 'N'}`,
    );
  }

  parts.push(`action: ${forecast.recommendedAction}`);
  return parts.join(' | ');
}

/**
 * Compute the trend velocity summary string for telemetry.
 */
export function buildRepairQueueAdapterTrendSummaryString(
  trendSummary: ShieldRepairQueueTrendSummary,
): string {
  const parts: string[] = [
    `tick=${trendSummary.tick}`,
    `dominant=${trendSummary.dominantTrend}`,
    `velocity=${trendSummary.overallThroughputVelocity.toFixed(2)}`,
    `accel=${trendSummary.overallAcceleration.toFixed(2)}`,
    `critical_count=${trendSummary.criticalLayerCount}`,
  ];
  for (const layer of trendSummary.layers) {
    parts.push(
      `${layer.layerId}: vel=${layer.throughputVelocity.toFixed(2)} ` +
        `accel=${layer.throughputAcceleration.toFixed(2)} ` +
        `label=${layer.label}`,
    );
  }
  return parts.join(' | ');
}

/**
 * Validate that all bot state IDs in the map are known hater bot IDs.
 */
export function validateRepairQueueAdapterBotStateMap(
  botStates: Readonly<Record<string, BotState>>,
): boolean {
  return Object.keys(botStates).every((id) => isHaterBotId(id));
}

/**
 * Check whether the input includes any note tags that are known shield aliases.
 */
export function hasRepairQueueAdapterShieldAlias(tags: readonly string[]): boolean {
  return tags.some((tag) => isKnownShieldAlias(tag));
}

/**
 * Resolve the doctrine type from a repair job's note tags.
 */
export function resolveRepairQueueAdapterJobDoctrine(
  tags: readonly string[],
): ShieldDoctrineAttackType | null {
  return resolveRepairJobDoctrine(tags);
}

/**
 * Apply a delivery slice to the corresponding layer states.
 */
export function applyRepairQueueAdapterDeliveryToLayers(
  slices: readonly PendingRepairSlice[],
  layers: readonly ShieldLayerState[],
  tick: number,
): readonly ShieldLayerState[] {
  let updatedLayers = [...layers];
  for (const slice of slices) {
    updatedLayers = updatedLayers.map((layer) => {
      const shouldApply =
        slice.layerId === 'ALL' || layer.layerId === slice.layerId;
      if (!shouldApply) return layer;
      return applyRepairToLayerState(layer, slice.amount, tick);
    });
  }
  return updatedLayers;
}

/**
 * Score the threat urgency contribution from the most pressing threat envelope.
 */
export function scoreRepairQueueAdapterThreatUrgency(
  threats: readonly ThreatEnvelope[],
  tick: number,
): number {
  if (threats.length === 0) return 0;
  return Math.max(...threats.map((t) => scoreThreatLayerUrgency(t, tick)));
}

/**
 * Build a comprehensive config map compat including all shield layer constants.
 */
export function buildRepairQueueAdapterConfigMapCompat(): {
  readonly configs: Readonly<Record<ShieldLayerId, ShieldLayerConfig>>;
  readonly constants: typeof SHIELD_CONSTANTS;
  readonly layerOrder: typeof SHIELD_LAYER_ORDER;
  readonly layerConfigs: typeof SHIELD_LAYER_CONFIGS;
} {
  return {
    configs: buildRepairLayerConfigMap(),
    constants: SHIELD_CONSTANTS,
    layerOrder: SHIELD_LAYER_ORDER,
    layerConfigs: SHIELD_LAYER_CONFIGS,
  };
}

/**
 * Build an enqueue result from an already-accepted job.
 */
export function buildRepairQueueAdapterEnqueueAccepted(
  job: RepairJob,
): ShieldRepairQueueEnqueueResult {
  return buildEnqueueAccepted(job);
}

/**
 * Build an enqueue result from a rejected enqueue attempt.
 */
export function buildRepairQueueAdapterEnqueueRejected(
  tick: number,
  layerId: RepairLayerId,
  amount: number,
  durationTicks: number,
  source: RepairJob['source'],
): ShieldRepairQueueEnqueueResult {
  return buildEnqueueRejected(tick, layerId, amount, durationTicks, source);
}

/**
 * Build a batch history entry array from a slice of adapter history.
 */
export function buildRepairQueueAdapterHistorySlice(
  adapterHistory: readonly ShieldRepairQueueHistoryEntry[],
  fromTick: number,
  toTick: number,
): readonly ShieldRepairQueueHistoryEntry[] {
  return adapterHistory.filter(
    (entry) => entry.tick >= fromTick && entry.tick <= toTick,
  );
}

/**
 * Compute the overall HP delivered per tick from the history slice.
 */
export function computeRepairQueueAdapterThroughputFromHistory(
  history: readonly ShieldRepairQueueHistoryEntry[],
): number {
  if (history.length === 0) return 0;
  const totalDelivered = history.reduce((s, e) => s + e.deliveredThisTick, 0);
  return totalDelivered / history.length;
}

/**
 * Compute the fraction of ticks in the history where saturation was critical.
 */
export function computeRepairQueueAdapterSaturationFraction(
  history: readonly ShieldRepairQueueHistoryEntry[],
  maxDepth: number,
): number {
  if (history.length === 0) return 0;
  const criticalTicks = history.filter(
    (e) =>
      e.queueDepth >= maxDepth * SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION,
  ).length;
  return criticalTicks / history.length;
}

/**
 * Compute the effective HP per tick accounting for rejection overhead.
 */
export function computeRepairQueueAdapterEffectiveHPRate(
  totalDelivered: number,
  totalRejected: number,
  tickCount: number,
): number {
  if (tickCount <= 0) return 0;
  const effectiveHP =
    totalDelivered *
    (1 - totalRejected / Math.max(1, totalDelivered + totalRejected));
  return effectiveHP / tickCount;
}

/**
 * Build the DL feature labels array for cross-subsystem sequence model alignment.
 */
export function buildRepairQueueAdapterDLFeatureLabels(): readonly string[] {
  return SHIELD_REPAIR_QUEUE_DL_FEATURE_LABELS;
}

/**
 * Build the ML feature labels array for cross-subsystem vector alignment.
 */
export function buildRepairQueueAdapterMLFeatureLabels(): readonly string[] {
  return SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS;
}

/**
 * Score the repair coverage ratio and return a labeled result.
 */
export function scoreRepairQueueAdapterCoverage(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
): {
  readonly ratio: number;
  readonly label: 'NONE' | 'LOW' | 'PARTIAL' | 'FULL';
  readonly percentCovered: number;
} {
  const ratio = scoreRepairCoverageRatio(jobs, layers);
  const label =
    ratio >= 0.99 ? 'FULL' : ratio >= 0.50 ? 'PARTIAL' : ratio > 0 ? 'LOW' : 'NONE';
  return {
    ratio,
    label,
    percentCovered: Math.round(ratio * 100),
  };
}

/**
 * Build a concise adapter state string for logging and telemetry.
 */
export function buildRepairQueueAdapterStateString(
  state: ShieldRepairQueueAdapterState,
): string {
  return (
    `signals=${state.signalCount} ` +
    `rejected=${state.rejectedCount} ` +
    `tick=${state.lastTick} ` +
    `jobs_observed=${state.totalJobsObserved} ` +
    `completions=${state.totalCompletionsObserved} ` +
    `rejections=${state.totalRejectionsObserved} ` +
    `history=${state.historyDepth}`
  );
}

/**
 * Compute a session-level analytics diff between two snapshots.
 */
export function computeRepairQueueAdapterAnalyticsDiff(
  before: ShieldRepairQueueAnalyticsSummary,
  after: ShieldRepairQueueAnalyticsSummary,
): {
  readonly deltaJobsCreated: number;
  readonly deltaJobsCompleted: number;
  readonly deltaJobsRejected: number;
  readonly deltaHpDelivered: number;
  readonly deltaAverageUtilization: number;
  readonly deltaOverflowEvents: number;
} {
  return {
    deltaJobsCreated: after.totalJobsCreated - before.totalJobsCreated,
    deltaJobsCompleted: after.totalJobsCompleted - before.totalJobsCompleted,
    deltaJobsRejected: after.totalJobsRejected - before.totalJobsRejected,
    deltaHpDelivered: after.totalHpDelivered - before.totalHpDelivered,
    deltaAverageUtilization: after.averageUtilization - before.averageUtilization,
    deltaOverflowEvents: after.overflowEventCount - before.overflowEventCount,
  };
}

/**
 * Determine whether the adapter should fire a session_summary signal.
 */
export function shouldFireRepairQueueAdapterSessionSummary(
  previousPhase: RunPhase,
  currentPhase: RunPhase,
  historyDepth: number,
): boolean {
  if (previousPhase === currentPhase) return false;
  return historyDepth >= SHIELD_REPAIR_QUEUE_ADAPTER_TREND_WINDOW;
}

/**
 * Build a damage-resolution summary for downstream cross-subsystem correlation.
 */
export function buildRepairQueueAdapterDamageResolutionSummary(
  resolution: DamageResolution,
): {
  readonly layerId: ShieldLayerId;
  readonly effectiveDamage: number;
  readonly preHitIntegrity: number;
  readonly postHitIntegrity: number;
  readonly breached: boolean;
  readonly repairPriority: number;
} {
  return {
    layerId: resolution.actualLayerId,
    effectiveDamage: resolution.effectiveDamage,
    preHitIntegrity: resolution.preHitIntegrity,
    postHitIntegrity: resolution.postHitIntegrity,
    breached: resolution.breached,
    repairPriority: computeRepairAbsorptionWeight(resolution.actualLayerId),
  };
}

/**
 * Compute the cascade resolution impact on the repair queue.
 */
export function computeRepairQueueAdapterCascadeImpact(
  cascade: CascadeResolution | null,
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): {
  readonly hasCascade: boolean;
  readonly affectedLayerIds: readonly ShieldLayerId[];
  readonly urgencyEscalation: number;
  readonly recommendedAction: string;
} {
  if (cascade === null) {
    return {
      hasCascade: false,
      affectedLayerIds: [],
      urgencyEscalation: 0,
      recommendedAction: 'No cascade — queue posture normal',
    };
  }

  const affectedLayerIds: ShieldLayerId[] = SHIELD_LAYER_ORDER.filter(
    (id) => layers.find((l) => l.layerId === id && l.breached),
  );
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  const criticalLayerIds = findRepairPriorityLayers(layers, jobs);
  const utilization = computeOverallUtilization(jobs);
  const action = buildRepairQueueRecommendedAction(
    criticalLayerIds,
    urgency,
    utilization,
    mode,
    phase,
  );

  return {
    hasCascade: true,
    affectedLayerIds,
    urgencyEscalation: Math.min(1, urgency * 1.2),
    recommendedAction: action,
  };
}

/**
 * Build a repair queue adapter routed-attack summary for telemetry.
 */
export function buildRepairQueueAdapterRoutedAttackSummary(
  attacks: readonly RoutedAttack[],
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
): {
  readonly attackCount: number;
  readonly totalMagnitude: number;
  readonly coverageRatio: number;
  readonly exposedLayerIds: readonly ShieldLayerId[];
} {
  const totalMagnitude = attacks.reduce((s, a) => s + a.magnitude, 0);
  const coverageRatio = scoreRepairCoverageRatio(jobs, layers);
  const exposedLayerIds = layers
    .filter(
      (l) =>
        l.breached ||
        l.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD,
    )
    .map((l) => l.layerId);
  return {
    attackCount: attacks.length,
    totalMagnitude,
    coverageRatio,
    exposedLayerIds,
  };
}

/**
 * Build a complete repair-context summary for the chat signal payload.
 */
export function buildRepairQueueAdapterContextSummary(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
  tick: number,
): {
  readonly urgency: number;
  readonly urgencyLabel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly utilization: number;
  readonly saturation: number;
  readonly coverageRatio: number;
  readonly priorityLayers: readonly ShieldLayerId[];
  readonly narrativeWeight: number;
  readonly recommendedAction: string;
  readonly description: string;
  readonly isEndgame: boolean;
  readonly maxHpPerTick: number;
  readonly rejectionHistoryDepth: number;
  readonly tick: number;
} {
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  const urgencyLabel = classifyRepairQueueUrgency(urgency);
  const utilization = computeOverallUtilization(jobs);
  const saturation = computeQueueSaturation(jobs);
  const coverageRatio = scoreRepairCoverageRatio(jobs, layers);
  const priorityLayers = findRepairPriorityLayers(layers, jobs);
  const narrativeWeight = buildRepairQueueNarrativeWeight(
    jobs,
    layers,
    mode,
    phase,
    pressureTier,
  );
  const criticalLayerIds = priorityLayers.filter(
    (id) => layers.find((l) => l.layerId === id && l.integrityRatio < 0.25),
  );
  const recommendedAction = buildRepairQueueRecommendedAction(
    criticalLayerIds,
    urgency,
    utilization,
    mode,
    phase,
  );
  const description = describeRepairQueueState(jobs, mode, phase);
  const isEndgame = isEndgamePhase(phase);

  return {
    urgency,
    urgencyLabel,
    utilization,
    saturation,
    coverageRatio,
    priorityLayers,
    narrativeWeight,
    recommendedAction,
    description,
    isEndgame,
    maxHpPerTick: SHIELD_REPAIR_QUEUE_MAX_HP_PER_TICK,
    rejectionHistoryDepth: SHIELD_REPAIR_QUEUE_REJECTION_HISTORY_DEPTH,
    tick,
  };
}

/**
 * Build a layer-level HP pending summary string for telemetry.
 */
export function buildRepairQueueAdapterPendingHpSummary(
  jobs: readonly RepairJob[],
): string {
  const pendingHp = computePendingHpPerLayer(jobs);
  const maxQueuedHp = SHIELD_REPAIR_QUEUE_MAX_QUEUED_HP;
  const parts = SHIELD_LAYER_ORDER.map((id) => {
    const pending = pendingHp[id] ?? 0;
    const pct =
      maxQueuedHp > 0 ? Math.round((pending / maxQueuedHp) * 100) : 0;
    return `${id}=${pending.toFixed(0)}HP(${pct}% of max)`;
  });
  return `pending_hp [max=${maxQueuedHp}HP/layer]: ` + parts.join(' | ');
}

/**
 * Compute the completion rate ratio for the current run state.
 * Delegates to ShieldRepairQueue's computeCompletionRate helper.
 */
export function computeRepairQueueAdapterCompletionRate(
  completions: number,
  rejections: number,
): number {
  return computeCompletionRate(completions, rejections);
}

/**
 * Build a ShieldRepairQueue instance for direct queue operations.
 * Used when the adapter needs to drive a queue outside of the ensemble.
 */
export function createRepairQueueAdapterQueue(): ShieldRepairQueue {
  return new ShieldRepairQueue();
}

/**
 * Verify the adapter manifest is consistent with the source module manifest.
 * Returns true when all key counts and thresholds match.
 */
export function verifyRepairQueueAdapterManifestConsistency(): boolean {
  return (
    SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT ===
      SHIELD_REPAIR_QUEUE_MANIFEST.mlFeatureCount &&
    SHIELD_REPAIR_QUEUE_ADAPTER_DL_FEATURE_COUNT ===
      SHIELD_REPAIR_QUEUE_MANIFEST.dlFeatureCount &&
    SHIELD_REPAIR_QUEUE_ADAPTER_DL_SEQUENCE_LENGTH ===
      SHIELD_REPAIR_QUEUE_MANIFEST.dlSequenceLength
  );
}

/**
 * Build a Nullable<ShieldLayerId> from the dominant job layer in a set of jobs.
 * Used for chat signal layerId field resolution.
 */
export function resolveRepairQueueAdapterDominantLayerId(
  jobs: readonly RepairJob[],
): Nullable<ShieldLayerId> {
  // Prefer L4 (highest cascade gate risk), then L3, L2, L1
  for (const id of ['L4', 'L3', 'L2', 'L1'] as ShieldLayerId[]) {
    if (jobs.some((j) => j.ticksRemaining > 0 && (j.layerId === id || j.layerId === 'ALL'))) {
      return id;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// § N — Manifest
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_REPAIR_QUEUE_ADAPTER_MANIFEST = Object.freeze({
  module: 'ShieldRepairQueueSignalAdapter',
  version: SHIELD_REPAIR_QUEUE_ADAPTER_VERSION,
  repairQueueManifest: SHIELD_REPAIR_QUEUE_MANIFEST,
  mlFeatureCount: SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT,
  dlFeatureCount: SHIELD_REPAIR_QUEUE_ADAPTER_DL_FEATURE_COUNT,
  dlSequenceLength: SHIELD_REPAIR_QUEUE_ADAPTER_DL_SEQUENCE_LENGTH,
  dedupeWindowTicks: SHIELD_REPAIR_QUEUE_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: SHIELD_REPAIR_QUEUE_ADAPTER_MAX_BATCH_SIZE,
  historyDepth: SHIELD_REPAIR_QUEUE_ADAPTER_HISTORY_DEPTH,
  trendWindow: SHIELD_REPAIR_QUEUE_ADAPTER_TREND_WINDOW,
  forecastHorizon: SHIELD_REPAIR_QUEUE_ADAPTER_FORECAST_HORIZON,
  lowThroughputThreshold: SHIELD_REPAIR_QUEUE_ADAPTER_LOW_THROUGHPUT_THRESHOLD,
  overflowRiskThreshold: SHIELD_REPAIR_QUEUE_ADAPTER_OVERFLOW_RISK_THRESHOLD,
  criticalUtilization: SHIELD_REPAIR_QUEUE_ADAPTER_CRITICAL_UTILIZATION,
  criticalUrgency: SHIELD_REPAIR_QUEUE_ADAPTER_CRITICAL_URGENCY,
  eventNames: SHIELD_REPAIR_QUEUE_ADAPTER_EVENT_NAMES,
  repairQueueReady: SHIELD_REPAIR_QUEUE_READY,
  chatAdapterDomain: 'SHIELD_REPAIR_QUEUE',
  ownsTruth: false,
  description:
    'Translates ShieldRepairQueue per-tick state — job creation, HP delivery, ' +
    'completions, rejections, queue saturation, throughput velocity, and capacity ' +
    'forecasts — into authoritative backend chat shield-repair signals. ' +
    'Produces 28-feature ML vectors, 36x6 DL tensors, annotation bundles, UX hints, ' +
    'capacity forecasts, and trend summaries for the chat lane and ML pipeline.',
});

// Re-export all ShieldRepairQueue types so consumers can import from this adapter
export type {
  ShieldRepairQueueMLVector,
  ShieldRepairQueueDLRow,
  ShieldRepairQueueDLTensor,
  ShieldRepairQueueLayerTrend,
  ShieldRepairQueueTrendSummary,
  ShieldRepairQueueLayerForecast,
  ShieldRepairQueueCapacityForecast,
  ShieldRepairQueueJobAnnotation,
  ShieldRepairQueueCompletionAnnotation,
  ShieldRepairQueueAnnotationBundle,
  ShieldRepairQueueUXHint,
  ShieldRepairQueueHistoryEntry,
  ShieldRepairQueueInspectorState,
  ShieldRepairQueueAnalyticsSummary,
  ShieldRepairQueueEnsemble,
  ShieldRepairQueueMLParams,
  ShieldRepairQueueDLRowParams,
  ShieldRepairQueueSessionReport,
  ShieldRepairQueueEnqueueResult,
};

// Re-export shield types used by cross-subsystem consumers
export type {
  CascadeResolution,
  DamageResolution,
  PendingRepairSlice,
  QueueRejection,
  RepairJob,
  RepairLayerId,
  RoutedAttack,
  ShieldDoctrineAttackType,
  ShieldLayerConfig,
};

// ─────────────────────────────────────────────────────────────────────────────
// § COMPAT — Alias and supplementary exports required by adapters/index.ts
// ─────────────────────────────────────────────────────────────────────────────

// ── Additional module-level constants ────────────────────────────────────────

/** Minimum HP threshold below which a repair job is considered negligible. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_MIN_HP_THRESHOLD = 1 as const;

/** Maximum number of simultaneous repair jobs per layer. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_MAX_JOBS_PER_LAYER = 8 as const;

/** Maximum adapter-level history ring-buffer depth. */
export const SHIELD_REPAIR_QUEUE_ADAPTER_MAX_HISTORY_DEPTH =
  SHIELD_REPAIR_QUEUE_ADAPTER_HISTORY_DEPTH;

/** Whether the repair queue adapter is ready (mirrors queue module). */
export const SHIELD_REPAIR_QUEUE_ADAPTER_READY = SHIELD_REPAIR_QUEUE_READY;

/**
 * Forecast max horizon alias — matches the name expected by adapters/index.ts.
 * Identical to SHIELD_REPAIR_QUEUE_ADAPTER_FORECAST_HORIZON.
 */
export const SHIELD_REPAIR_QUEUE_ADAPTER_FORECAST_MAX_HORIZON =
  SHIELD_REPAIR_QUEUE_ADAPTER_FORECAST_HORIZON;

// Adapter-level mirrors of queue constants needed by the index
export const SHIELD_REPAIR_QUEUE_ADAPTER_MAX_HP_PER_TICK =
  SHIELD_REPAIR_QUEUE_MAX_HP_PER_TICK;

export const SHIELD_REPAIR_QUEUE_ADAPTER_REJECTION_HISTORY_DEPTH =
  SHIELD_REPAIR_QUEUE_REJECTION_HISTORY_DEPTH;

export const SHIELD_REPAIR_QUEUE_ADAPTER_MAX_QUEUED_HP =
  SHIELD_REPAIR_QUEUE_MAX_QUEUED_HP;

export const SHIELD_REPAIR_QUEUE_ADAPTER_CRITICAL_URGENCY_THRESHOLD =
  SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD;

// ── Additional type definitions ───────────────────────────────────────────────

/** Primary signal input alias — used by adapters/index.ts type imports. */
export type ShieldRepairQueueSignalInput = ShieldRepairQueueAdapterSignalInput;

/** Batch input alias — used by adapters/index.ts type imports. */
export type ShieldRepairQueueSignalBatchInput = ShieldRepairQueueAdapterBatchInput;

/** Chat signal compat alias — used by adapters/index.ts type imports. */
export type ShieldRepairQueueChatSignalCompat = ShieldRepairQueueAdapterChatSignalCompat;

/** Config map compat — maps ShieldLayerId to its ShieldLayerConfig. */
export interface ShieldRepairQueueAdapterConfigMapCompat {
  readonly configs: Readonly<Record<ShieldLayerId, ShieldLayerConfig>>;
  readonly constants: typeof SHIELD_CONSTANTS;
  readonly layerOrder: typeof SHIELD_LAYER_ORDER;
  readonly layerConfigs: typeof SHIELD_LAYER_CONFIGS;
}

/** Enqueue compat — adapter view of a successful enqueue. */
export interface ShieldRepairQueueAdapterEnqueueCompat {
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly durationTicks: number;
  readonly amountPerTick: number;
  readonly tick: number;
  readonly source: RepairJob['source'];
  readonly tags: readonly string[];
  readonly accepted: true;
}

/** Slice compat — adapter view of a delivered repair slice. */
export interface ShieldRepairQueueAdapterSliceCompat {
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly completed: boolean;
  readonly sourceTick: number;
}

/** Adapter report — full adapter diagnostics object. */
export interface ShieldRepairQueueAdapterReport {
  readonly state: ShieldRepairQueueAdapterState;
  readonly analytics: ShieldRepairQueueAnalyticsSummary;
}

/** Artifact — successfully produced and emitted signal bundle. */
export interface ShieldRepairQueueAdapterArtifact {
  readonly type: 'artifact';
  readonly envelopes: readonly ChatInputEnvelope[];
  readonly bundle: ShieldRepairQueueAdapterBundle;
  readonly tick: number;
  readonly eventName: ShieldRepairQueueAdapterEventName;
}

/** Deduped — signal suppressed by the deduplication window. */
export interface ShieldRepairQueueAdapterDeduped {
  readonly type: 'deduped';
  readonly tick: number;
  readonly eventName: ShieldRepairQueueAdapterEventName;
  readonly lastFiredTick: number;
  readonly windowTicks: number;
}

/** Rejection — signal input rejected before entering the adapter. */
export interface ShieldRepairQueueAdapterRejection {
  readonly type: 'rejected';
  readonly tick: number;
  readonly reason: 'invalid_input' | 'idle_suppressed';
}

/** History entry alias — maps to ShieldRepairQueueHistoryEntry. */
export type ShieldRepairQueueAdapterHistoryEntry = ShieldRepairQueueHistoryEntry;

// ── Name-aliased function exports ─────────────────────────────────────────────

/**
 * Alias: buildShieldRepairQueueAdapterBundle
 * Delegates to buildRepairQueueAdapterBundle.
 */
export function buildShieldRepairQueueAdapterBundle(
  adapter: ShieldRepairQueueSignalAdapter,
  input: ShieldRepairQueueAdapterSignalInput,
): ShieldRepairQueueAdapterBundle {
  return buildRepairQueueAdapterBundle(adapter, input);
}

/**
 * Alias: buildShieldRepairQueueAdapterBundleFromSnapshot
 * Delegates to buildRepairQueueAdapterBundleFromSnapshot.
 */
export function buildShieldRepairQueueAdapterBundleFromSnapshot(
  adapter: ShieldRepairQueueSignalAdapter,
  snapshot: RunStateSnapshot,
  jobs: readonly RepairJob[],
  previousJobs: readonly RepairJob[],
  newJobs: readonly RepairJob[],
  completedJobs: readonly RepairJob[],
  rejections: readonly QueueRejection[],
  deliveredSlices: readonly PendingRepairSlice[],
  totalDelivered: number,
  totalQueued: number,
  completionCount: number,
  rejectionCount: number,
  threats: readonly ThreatEnvelope[],
  botStates: Readonly<Record<HaterBotId, BotState>>,
  attacks: readonly AttackEvent[],
): ShieldRepairQueueAdapterBundle {
  return buildRepairQueueAdapterBundleFromSnapshot(
    adapter, snapshot, jobs, previousJobs, newJobs, completedJobs,
    rejections, deliveredSlices, totalDelivered, totalQueued,
    completionCount, rejectionCount, threats, botStates, attacks,
  );
}

/**
 * Alias: extractShieldRepairQueueAdapterMLVector
 * Delegates to extractRepairQueueAdapterMLVector.
 */
export function extractShieldRepairQueueAdapterMLVector(
  jobs: readonly RepairJob[],
  mode: ModeCode,
  phase: RunPhase,
  totalDelivered: number,
  totalQueued: number,
  rejectionCount: number,
  completionCount: number,
): ShieldRepairQueueAdapterMLVectorCompat {
  return extractRepairQueueAdapterMLVector(
    jobs, mode, phase, totalDelivered, totalQueued, rejectionCount, completionCount,
  );
}

/**
 * Alias: scoreShieldRepairQueueAdapterRisk
 * Delegates to scoreRepairQueueAdapterRisk.
 */
export function scoreShieldRepairQueueAdapterRisk(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): number {
  return scoreRepairQueueAdapterRisk(jobs, layers, mode, phase, pressureTier);
}

/**
 * Alias: getShieldRepairQueueAdapterChatChannel
 * Delegates to getRepairQueueAdapterChatChannel.
 */
export function getShieldRepairQueueAdapterChatChannel(
  urgency: number,
): ShieldRepairQueueAdapterChannelRecommendation {
  return getRepairQueueAdapterChatChannel(urgency);
}

/**
 * Alias: buildShieldRepairQueueAdapterNarrativeWeight
 * Delegates to buildRepairQueueAdapterNarrativeWeight.
 */
export function buildShieldRepairQueueAdapterNarrativeWeight(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): ShieldRepairQueueAdapterNarrativeWeight {
  return buildRepairQueueAdapterNarrativeWeight(jobs, layers, mode, phase, pressureTier);
}

/**
 * Alias: buildShieldRepairQueueAdapterThresholdReport
 * Delegates to buildRepairQueueAdapterThresholdReport.
 */
export function buildShieldRepairQueueAdapterThresholdReport(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  return buildRepairQueueAdapterThresholdReport(jobs, layers, mode, phase);
}

/**
 * Alias: buildShieldRepairQueueAdapterPostureSnapshot
 * Delegates to buildRepairQueueAdapterPostureSnapshot.
 */
export function buildShieldRepairQueueAdapterPostureSnapshot(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
  tick: number,
): ShieldRepairQueueAdapterPostureSnapshot {
  return buildRepairQueueAdapterPostureSnapshot(jobs, layers, mode, phase, pressureTier, tick);
}

/**
 * Alias: buildShieldRepairQueueAdapterSessionReport
 * Delegates to buildRepairQueueAdapterSessionReport.
 */
export function buildShieldRepairQueueAdapterSessionReport(
  adapter: ShieldRepairQueueSignalAdapter,
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  runId: string,
  finalTick: number,
  totalDelivered: number,
  totalQueued: number,
  rejectionCount: number,
  completionCount: number,
): ShieldRepairQueueAdapterSessionReport {
  return buildRepairQueueAdapterSessionReport(
    adapter, jobs, layers, mode, phase, runId, finalTick,
    totalDelivered, totalQueued, rejectionCount, completionCount,
  );
}

/** Build an analytics bundle summarising a live adapter session. */
export function buildShieldRepairQueueAdapterAnalyticsBundle(
  adapter: ShieldRepairQueueSignalAdapter,
): {
  readonly state: ShieldRepairQueueAdapterState;
  readonly analytics: ShieldRepairQueueAnalyticsSummary;
  readonly health: ShieldRepairQueueAdapterHealthReport;
} {
  return {
    state: adapter.getState(),
    analytics: adapter.getReport().analytics,
    health: adapter.buildHealthReport(),
  };
}

/** Create an adapter instance together with a detached ensemble snapshot. */
export function createShieldRepairQueueSignalAdapterWithEnsemble(
  options: ShieldRepairQueueAdapterOptions = {},
): {
  readonly adapter: ShieldRepairQueueSignalAdapter;
  readonly ensemble: ShieldRepairQueueEnsemble;
} {
  const adapter = new ShieldRepairQueueSignalAdapter(options);
  const ensemble = createShieldRepairQueueWithAnalytics();
  return { adapter, ensemble };
}

/** Build a ChatInputEnvelope for a successful enqueue event. */
export function buildRepairQueueEnqueueSignal(
  job: RepairJob,
  tick: number,
  channel: ShieldRepairQueueAdapterChannelRecommendation,
  roomId?: ChatRoomId | null,
): ChatInputEnvelope {
  const result = buildEnqueueAccepted(job);
  const signal: ChatSignalEnvelope = {
    type: 'BATTLE',
    roomId: roomId ?? null,
    emittedAt: asUnixMs(Date.now()),
    metadata: {
      eventName: 'shield_repair_queue.job_created',
      channel: channel as unknown as string,
      jobId: result.accepted ? result.job.jobId : '',
      layerId: job.layerId as unknown as string,
      amount: job.amount,
      durationTicks: job.durationTicks,
      tick,
    } as Readonly<Record<string, JsonValue>>,
  };
  return { kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: signal };
}

/** Build a ChatInputEnvelope for a queue rejection event. */
export function buildRepairQueueRejectionSignal(
  rejection: QueueRejection,
  tick: number,
  roomId?: ChatRoomId | null,
): ChatInputEnvelope {
  const signal: ChatSignalEnvelope = {
    type: 'BATTLE',
    roomId: roomId ?? null,
    emittedAt: asUnixMs(Date.now()),
    metadata: {
      eventName: 'shield_repair_queue.job_rejected',
      channel: 'REPAIR_HIGH',
      layerId: rejection.layerId as unknown as string,
      amount: rejection.amount,
      tick,
      reason: 'queue_capacity_exceeded',
    } as Readonly<Record<string, JsonValue>>,
  };
  return { kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: signal };
}

/** Build a ChatInputEnvelope for a session summary signal. */
export function buildRepairQueueSessionSummarySignal(
  report: ShieldRepairQueueAdapterSessionReport,
  roomId?: ChatRoomId | null,
): ChatInputEnvelope {
  const signal: ChatSignalEnvelope = {
    type: 'BATTLE',
    roomId: roomId ?? null,
    emittedAt: asUnixMs(Date.now()),
    metadata: {
      eventName: 'shield_repair_queue.session_summary',
      channel: 'REPAIR_LOW',
      runId: report.runId,
      finalTick: report.finalTick,
      totalJobsObserved: report.state.totalJobsObserved,
      totalCompletionsObserved: report.state.totalCompletionsObserved,
      totalRejectionsObserved: report.state.totalRejectionsObserved,
      signalCount: report.state.signalCount,
    } as Readonly<Record<string, JsonValue>>,
  };
  return { kind: 'BATTLE_SIGNAL', emittedAt: signal.emittedAt, payload: signal };
}

// ── Short-prefix helper aliases (classifyRepairAdapterSeverity, etc.) ─────────

/** Alias: classifyRepairAdapterSeverity */
export function classifyRepairAdapterSeverity(
  urgency: number,
  utilization: number,
  rejections: number,
): ShieldRepairQueueAdapterSeverity {
  return classifyRepairQueueAdapterSeverity(urgency, utilization, rejections);
}

/** Alias: buildRepairAdapterNarrativeWeight */
export function buildRepairAdapterNarrativeWeight(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): ShieldRepairQueueAdapterNarrativeWeight {
  return buildRepairQueueAdapterNarrativeWeight(jobs, layers, mode, phase, pressureTier);
}

/** Resolve the recommended channel from urgency (short-prefix alias). */
export function resolveRepairAdapterChannel(
  urgency: number,
): ShieldRepairQueueAdapterChannelRecommendation {
  return getRepairQueueAdapterChatChannel(urgency);
}

/** Alias: resolveRepairAdapterEventName */
export function resolveRepairAdapterEventName(
  newJobs: readonly RepairJob[],
  completedJobs: readonly RepairJob[],
  rejections: readonly QueueRejection[],
  urgency: number,
  utilization: number,
  deliveredSlices: readonly PendingRepairSlice[],
): ShieldRepairQueueAdapterEventName {
  return resolveRepairQueueAdapterEventName(
    newJobs, completedJobs, rejections, urgency, utilization, deliveredSlices,
  );
}

/** Alias: buildRepairAdapterDetailString */
export function buildRepairAdapterDetailString(
  tick: number,
  mode: ModeCode,
  phase: RunPhase,
  urgency: number,
  utilization: number,
  totalDelivered: number,
  newJobCount: number,
  rejectedCount: number,
): string {
  return buildRepairQueueAdapterDetailString(
    tick, mode, phase, urgency, utilization, totalDelivered, newJobCount, rejectedCount,
  );
}

/** Build an ML vector compat from raw params (short-prefix alias). */
export function buildRepairAdapterMLVectorCompat(
  jobs: readonly RepairJob[],
  mode: ModeCode,
  phase: RunPhase,
  totalDelivered: number,
  totalQueued: number,
  rejectionCount: number,
  completionCount: number,
  tick: number,
): ShieldRepairQueueAdapterMLVectorCompat {
  const extractor = new ShieldRepairQueueMLExtractor();
  const vector = extractor.extractVector({
    jobs, mode, phase, totalDelivered, totalQueued, rejectionCount, completionCount,
  });
  const features = extractRepairQueueMLArray(vector);
  return {
    tick,
    vector,
    features,
    labels: SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS,
    featureCount: SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT,
    valid: validateRepairQueueMLArray(features),
  };
}

/** Alias: buildRepairAdapterDLTensorCompat */
export function buildRepairAdapterDLTensorCompat(
  tensor: ShieldRepairQueueDLTensor,
): ShieldRepairQueueAdapterDLTensorCompat {
  return buildRepairQueueAdapterDLCompat(tensor);
}

/** Alias: buildRepairAdapterUXHintCompat */
export function buildRepairAdapterUXHintCompat(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
): ShieldRepairQueueAdapterUXHintCompat {
  return buildRepairQueueAdapterUXHintCompat(jobs, layers, mode, phase, tick);
}

/** Build an annotation bundle compat from raw inputs (short-prefix alias). */
export function buildRepairAdapterAnnotations(
  tick: number,
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  newJobs: readonly RepairJob[],
  completedJobs: readonly RepairJob[],
  rejections: readonly QueueRejection[],
  deliveredSlices: readonly PendingRepairSlice[],
  mode: ModeCode,
  phase: RunPhase,
): ShieldRepairQueueAdapterAnnotationCompat {
  const annotator = new ShieldRepairQueueAnnotator();
  const bundle = annotator.buildAnnotationBundle(
    tick, jobs, layers, newJobs, completedJobs, rejections, deliveredSlices, mode, phase,
  );
  return buildRepairQueueAdapterAnnotationCompat(bundle, tick);
}

/** Build an array of enqueue result compats from a set of new jobs. */
export function buildRepairAdapterEnqueueResults(
  jobs: readonly RepairJob[],
): readonly ShieldRepairQueueAdapterEnqueueCompat[] {
  return jobs.map((job) => ({
    jobId: job.jobId,
    layerId: job.layerId,
    amount: job.amount,
    durationTicks: job.durationTicks,
    amountPerTick: job.amountPerTick,
    tick: 0,
    source: job.source,
    tags: job.tags,
    accepted: true as const,
  }));
}

/** Build an array of slice compats from delivered slices. */
export function buildRepairAdapterSliceResults(
  slices: readonly PendingRepairSlice[],
): readonly ShieldRepairQueueAdapterSliceCompat[] {
  return slices.map((slice) => ({
    jobId: slice.jobId,
    layerId: slice.layerId,
    amount: slice.amount,
    completed: slice.completed,
    sourceTick: slice.sourceTick,
  }));
}

/** Alias: buildRepairAdapterExposureProfile */
export function buildRepairAdapterExposureProfile(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
): ShieldRepairQueueAdapterExposureProfile {
  return buildRepairQueueAdapterExposureProfile(jobs, layers, mode, phase, tick);
}

/** Alias: buildRepairQueueChatSignal (builds a full chat signal compat). */
export function buildRepairQueueChatSignal(
  input: ShieldRepairQueueAdapterSignalInput,
  eventName: ShieldRepairQueueAdapterEventName,
  severity: ShieldRepairQueueAdapterSeverity,
  channel: ShieldRepairQueueAdapterChannelRecommendation,
  headline: string,
  detail: string,
  urgency: number,
): ShieldRepairQueueAdapterChatSignalCompat {
  return buildRepairQueueAdapterChatSignal(
    input, eventName, severity, channel, headline, detail, urgency,
  );
}

/** Alias: validateRepairAdapterBotStateMap */
export function validateRepairAdapterBotStateMap(
  botStates: Readonly<Record<string, BotState>>,
): boolean {
  return validateRepairQueueAdapterBotStateMap(botStates);
}

/** Alias: buildRepairAdapterThresholdReport */
export function buildRepairAdapterThresholdReport(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  return buildRepairQueueAdapterThresholdReport(jobs, layers, mode, phase);
}

/** Alias: buildRepairAdapterMLCompat */
export function buildRepairAdapterMLCompat(
  vector: ShieldRepairQueueMLVector,
): ReturnType<typeof buildRepairQueueMLCompat> {
  return buildRepairQueueAdapterMLCompat(vector);
}

/** Alias: scoreRepairAdapterThreatLayerUrgency */
export function scoreRepairAdapterThreatLayerUrgency(
  threats: readonly ThreatEnvelope[],
  tick: number,
): number {
  return scoreRepairQueueAdapterThreatUrgency(threats, tick);
}

/** Alias: resolveRepairAdapterJobDoctrine */
export function resolveRepairAdapterJobDoctrine(
  tags: readonly string[],
): ShieldDoctrineAttackType | null {
  return resolveRepairQueueAdapterJobDoctrine(tags);
}

/** Check whether the given string is a known shield alias. */
export function isKnownRepairAlias(tag: string): boolean {
  return isKnownShieldAlias(tag);
}

/** Get the absorption weight for a given layer ID. */
export function getRepairAdapterAbsorptionWeight(layerId: ShieldLayerId): number {
  return computeRepairAbsorptionWeight(layerId);
}

/** Build the full repair layer config map (short-prefix alias). */
export function buildRepairAdapterLayerConfigMap(): Readonly<
  Record<ShieldLayerId, ShieldLayerConfig>
> {
  return buildRepairLayerConfigMap();
}

/** Apply a single repair slice to a layer state (short-prefix alias). */
export function applyRepairAdapterSliceToLayer(
  layer: ShieldLayerState,
  amount: number,
  tick: number,
): ShieldLayerState {
  return applyRepairToLayerState(layer, amount, tick);
}

/** Alias: buildRepairAdapterPostureSnapshot */
export function buildRepairAdapterPostureSnapshot(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
  tick: number,
): ShieldRepairQueueAdapterPostureSnapshot {
  return buildRepairQueueAdapterPostureSnapshot(jobs, layers, mode, phase, pressureTier, tick);
}

/** Alias: buildRepairAdapterSessionReport — takes adapter + session params. */
export function buildRepairAdapterSessionReport(
  adapter: ShieldRepairQueueSignalAdapter,
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  runId: string,
  finalTick: number,
  totalDelivered: number,
  totalQueued: number,
  rejectionCount: number,
  completionCount: number,
): ShieldRepairQueueAdapterSessionReport {
  return buildRepairQueueAdapterSessionReport(
    adapter, jobs, layers, mode, phase, runId, finalTick,
    totalDelivered, totalQueued, rejectionCount, completionCount,
  );
}

/** Compute total delivered HP across all slices in the given array. */
export function computeRepairAdapterTotalDelivered(
  slices: readonly PendingRepairSlice[],
): number {
  return slices.reduce((s, sl) => s + sl.amount, 0);
}

/** Compute active job counts per layer (short-prefix alias). */
export function computeRepairAdapterJobCountsPerLayer(
  jobs: readonly RepairJob[],
): Readonly<Record<ShieldLayerId, number>> {
  return computeActiveJobCountPerLayer(jobs);
}

/** Compute pending HP per layer (short-prefix alias). */
export function computeRepairAdapterPendingHpPerLayer(
  jobs: readonly RepairJob[],
): Readonly<Record<ShieldLayerId, number>> {
  return computePendingHpPerLayer(jobs);
}

/** Compute progress ratio per layer (short-prefix alias). */
export function computeRepairAdapterProgressPerLayer(
  jobs: readonly RepairJob[],
): Readonly<Record<ShieldLayerId, number>> {
  return computeProgressRatioPerLayer(jobs);
}

/** Compute delivery rate per layer (short-prefix alias). */
export function computeRepairAdapterDeliveryRatePerLayer(
  jobs: readonly RepairJob[],
): Readonly<Record<ShieldLayerId, number>> {
  return computeDeliveryRatePerLayer(jobs);
}

/** Build overflow risk map (short-prefix alias). */
export function buildRepairAdapterOverflowRiskMap(
  jobs: readonly RepairJob[],
): Readonly<Record<ShieldLayerId, boolean>> {
  return buildOverflowRiskMap(jobs);
}

/** Alias: shouldSurfaceRepairTick */
export function shouldSurfaceRepairTick(
  urgency: number,
  utilization: number,
  newJobs: readonly RepairJob[],
  rejections: readonly QueueRejection[],
): boolean {
  return shouldSurfaceRepairQueueTick(urgency, utilization, newJobs, rejections);
}

/** Build an exposure profile from a RunStateSnapshot (short-prefix alias). */
export function buildRepairAdapterExposureFromSnapshot(
  snapshot: RunStateSnapshot,
  jobs: readonly RepairJob[],
): ShieldRepairQueueAdapterExposureProfile {
  return buildRepairQueueAdapterExposureProfile(
    jobs,
    snapshot.shield.layers,
    snapshot.mode,
    snapshot.phase,
    snapshot.tick,
  );
}

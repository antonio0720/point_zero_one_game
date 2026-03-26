/*
 * POINT ZERO ONE — BACKEND SHIELD REPAIR QUEUE
 * /backend/src/game/engine/shield/ShieldRepairQueue.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - active repair is queued, not instant
 * - repair jobs survive incoming damage
 * - queue limits are enforced per target layer
 * - delivery is deterministic tick by tick
 * - ML/DL extraction is a first-class concern — every tick produces a labeled vector
 * - mode-aware and phase-aware behavior shapes urgency, capacity, and overflow policy
 * - companion classes (MLExtractor, DLBuilder, TrendAnalyzer, Forecaster,
 *   Annotator, Inspector, Analytics) follow the ShieldLayerManager companion pattern
 *
 * Surface summary:
 *   § 1  — Module constants and manifest metadata
 *   § 2  — ML feature label array (28-feature canonical set)
 *   § 3  — DL feature label array (36-feature per timestep, sequence 6)
 *   § 4  — Type definitions (ML vector, DL tensor, summaries, bundles)
 *   § 5  — Pure helper functions (extraction, scoring, annotation, UX)
 *   § 6  — ShieldRepairQueueMLExtractor — ML vector builder
 *   § 7  — ShieldRepairQueueDLBuilder — DL tensor sequence builder
 *   § 8  — ShieldRepairQueueTrendAnalyzer — velocity and acceleration over history
 *   § 9  — ShieldRepairQueueForecaster — repair capacity and delivery forecasting
 *   § 10 — ShieldRepairQueueAnnotator — human-readable annotation bundles
 *   § 11 — ShieldRepairQueueInspector — full diagnostic state snapshot
 *   § 12 — ShieldRepairQueueAnalytics — session-level aggregate analytics
 *   § 13 — Factory functions and ensemble builders
 *   § 14 — ShieldRepairQueue — enhanced repair queue (production)
 *   § 15 — SHIELD_REPAIR_QUEUE_MANIFEST
 */

import { randomUUID } from 'node:crypto';

import {
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_THREAT_LEVEL,
  computeAggregateThreatPressure,
  computeEffectiveStakes,
  computeShieldLayerVulnerability,
  isEndgamePhase,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_NORMALIZED,
  PRESSURE_TIER_NORMALIZED,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  scoreThreatUrgency,
  type AttackEvent,
  type BotState,
  type HaterBotId,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type ShieldLayerId,
  type ThreatEnvelope,
} from '../core/GamePrimitives';
import type { RunStateSnapshot, ShieldLayerState } from '../core/RunStateSnapshot';
import {
  buildShieldLayerState,
  getLayerConfig,
  layerOrderIndex,
  normalizeShieldNoteTags,
  resolveShieldAlias,
  SHIELD_ATTACK_ALIASES,
  SHIELD_CONSTANTS,
  SHIELD_LAYER_CONFIGS,
  SHIELD_LAYER_ORDER,
  type PendingRepairSlice,
  type QueueRejection,
  type RepairJob,
  type RepairLayerId,
  type ShieldDoctrineAttackType,
  type ShieldLayerConfig,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Module constants and manifest metadata
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_REPAIR_QUEUE_MODULE_VERSION = '2026.03.25' as const;
export const SHIELD_REPAIR_QUEUE_READY = true as const;

/** Total ML features produced per tick by ShieldRepairQueueMLExtractor. */
export const SHIELD_REPAIR_QUEUE_ML_FEATURE_COUNT = 28 as const;

/** Total DL features per time-step for ShieldRepairQueueDLBuilder. */
export const SHIELD_REPAIR_QUEUE_DL_FEATURE_COUNT = 36 as const;

/** DL sequence length (ticks retained in rolling window). */
export const SHIELD_REPAIR_QUEUE_DL_SEQUENCE_LENGTH = 6 as const;

/** Rolling history depth for delivery/rejection buffers. */
export const SHIELD_REPAIR_QUEUE_HISTORY_DEPTH = 30 as const;

/** Window size for trend velocity and acceleration computation. */
export const SHIELD_REPAIR_QUEUE_TREND_WINDOW = 5 as const;

/** Maximum ticks to simulate in a forward repair forecast. */
export const SHIELD_REPAIR_QUEUE_FORECAST_MAX_HORIZON = 20 as const;

/** Queue utilization ratio above which an OVERFLOW_RISK signal fires. */
export const SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD = 0.75 as const;

/** Queue utilization ratio above which a CRITICAL signal fires. */
export const SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION = 0.95 as const;

/** Minimum HP/tick delivery rate before a LOW_THROUGHPUT signal fires. */
export const SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD = 2 as const;

/** Maximum nominal repair HP per tick that a single job can deliver. */
export const SHIELD_REPAIR_QUEUE_MAX_HP_PER_TICK = 50 as const;

/** History depth for rejection tracking. */
export const SHIELD_REPAIR_QUEUE_REJECTION_HISTORY_DEPTH = 16 as const;

/** Maximum HP total that can be queued across all jobs for normalization. */
export const SHIELD_REPAIR_QUEUE_MAX_QUEUED_HP = 500 as const;

/** Repair urgency score above which the queue fires a REPAIR_CRITICAL event. */
export const SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD = 0.80 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — ML feature label array (28-feature canonical set)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical 28-feature ML label set for the ShieldRepairQueue.
 * Every label maps 1:1 to a field on ShieldRepairQueueMLVector.
 * Order is stable across versions — append only.
 */
export const SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS: readonly string[] =
  Object.freeze([
    // 0-3: Active job count per layer (normalized 0-1)
    'l1_active_job_count',
    'l2_active_job_count',
    'l3_active_job_count',
    'l4_active_job_count',
    // 4-7: Total pending HP per layer (normalized 0-1)
    'l1_pending_hp',
    'l2_pending_hp',
    'l3_pending_hp',
    'l4_pending_hp',
    // 8-11: Progress ratio per layer (0-1)
    'l1_progress_ratio',
    'l2_progress_ratio',
    'l3_progress_ratio',
    'l4_progress_ratio',
    // 12-15: Normalized delivery rate per layer (HP/tick ÷ max)
    'l1_delivery_rate',
    'l2_delivery_rate',
    'l3_delivery_rate',
    'l4_delivery_rate',
    // 16-18: Aggregate queue metrics
    'overall_utilization',
    'completion_rate',
    'rejection_rate',
    // 19-21: Counters (normalized)
    'queue_depth_normalized',
    'total_delivered_normalized',
    'total_queued_normalized',
    // 22-25: Mode and phase context
    'mode_normalized',
    'phase_normalized',
    'stakes_multiplier',
    'mode_difficulty',
    // 26-27: Phase flags
    'ghost_mode_flag',
    'sovereignty_phase_flag',
  ]);

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — DL feature label array (36-feature per timestep, sequence 6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical 36-feature DL label set per time-step for ShieldRepairQueueDLBuilder.
 * Each tick in the 6-tick window produces one row of these 36 features.
 * Order is stable across versions — append only.
 */
export const SHIELD_REPAIR_QUEUE_DL_FEATURE_LABELS: readonly string[] =
  Object.freeze([
    // 0-3: Active job count delta per layer
    'dl_l1_active_delta',
    'dl_l2_active_delta',
    'dl_l3_active_delta',
    'dl_l4_active_delta',
    // 4-7: HP delivered per layer this tick (normalized)
    'dl_l1_delivered',
    'dl_l2_delivered',
    'dl_l3_delivered',
    'dl_l4_delivered',
    // 8-11: HP queued per layer this tick (normalized)
    'dl_l1_queued',
    'dl_l2_queued',
    'dl_l3_queued',
    'dl_l4_queued',
    // 12-15: Completion event flag per layer
    'dl_l1_completed',
    'dl_l2_completed',
    'dl_l3_completed',
    'dl_l4_completed',
    // 16-19: Rejection event flag per layer
    'dl_l1_rejected',
    'dl_l2_rejected',
    'dl_l3_rejected',
    'dl_l4_rejected',
    // 20-23: Job creation event flag per layer
    'dl_l1_created',
    'dl_l2_created',
    'dl_l3_created',
    'dl_l4_created',
    // 24-27: Progress ratio per layer
    'dl_l1_progress',
    'dl_l2_progress',
    'dl_l3_progress',
    'dl_l4_progress',
    // 28-31: Overflow flag per layer (at or above max jobs)
    'dl_l1_overflow',
    'dl_l2_overflow',
    'dl_l3_overflow',
    'dl_l4_overflow',
    // 32-35: Aggregate metrics
    'dl_total_delivered_normalized',
    'dl_queue_depth_normalized',
    'dl_tick_normalized',
    'dl_event_density',
  ]);

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Type definitions
// ─────────────────────────────────────────────────────────────────────────────

/** 28-feature ML vector extracted per tick from the repair queue. */
export interface ShieldRepairQueueMLVector {
  // Active job count per layer (normalized)
  readonly l1ActiveJobCount: number;
  readonly l2ActiveJobCount: number;
  readonly l3ActiveJobCount: number;
  readonly l4ActiveJobCount: number;
  // Pending HP per layer (normalized)
  readonly l1PendingHp: number;
  readonly l2PendingHp: number;
  readonly l3PendingHp: number;
  readonly l4PendingHp: number;
  // Progress ratio per layer
  readonly l1ProgressRatio: number;
  readonly l2ProgressRatio: number;
  readonly l3ProgressRatio: number;
  readonly l4ProgressRatio: number;
  // Delivery rate per layer (normalized)
  readonly l1DeliveryRate: number;
  readonly l2DeliveryRate: number;
  readonly l3DeliveryRate: number;
  readonly l4DeliveryRate: number;
  // Aggregate metrics
  readonly overallUtilization: number;
  readonly completionRate: number;
  readonly rejectionRate: number;
  // Counters
  readonly queueDepthNormalized: number;
  readonly totalDeliveredNormalized: number;
  readonly totalQueuedNormalized: number;
  // Mode and phase context
  readonly modeNormalized: number;
  readonly phaseNormalized: number;
  readonly stakesMultiplier: number;
  readonly modeDifficulty: number;
  // Flags
  readonly ghostModeFlag: number;
  readonly sovereigntyPhaseFlag: number;
}

/** One row of the DL tensor — 36 features for one tick timestep. */
export interface ShieldRepairQueueDLRow {
  readonly tick: number;
  readonly features: readonly number[];
}

/** 6-row DL tensor for sequence modeling. */
export interface ShieldRepairQueueDLTensor {
  readonly rows: readonly ShieldRepairQueueDLRow[];
  readonly sequenceLength: number;
  readonly featureCount: number;
  readonly latestTick: number;
}

/** Per-layer velocity and acceleration of repair throughput over TREND_WINDOW. */
export interface ShieldRepairQueueLayerTrend {
  readonly layerId: ShieldLayerId;
  readonly throughputVelocity: number;
  readonly throughputAcceleration: number;
  readonly label: 'ACCELERATING' | 'STABLE' | 'DECELERATING' | 'STALLED';
}

/** Full trend summary across all four layers. */
export interface ShieldRepairQueueTrendSummary {
  readonly tick: number;
  readonly layers: readonly ShieldRepairQueueLayerTrend[];
  readonly overallThroughputVelocity: number;
  readonly overallAcceleration: number;
  readonly dominantTrend: 'ACCELERATING' | 'STABLE' | 'DECELERATING' | 'STALLED';
  readonly criticalLayerCount: number;
}

/** Repair forecast for one layer — how many ticks until full repair coverage. */
export interface ShieldRepairQueueLayerForecast {
  readonly layerId: ShieldLayerId;
  readonly currentHpDeficit: number;
  readonly pendingHp: number;
  readonly activeJobCount: number;
  readonly estimatedDeliveryRate: number;
  readonly ticksToFullRepair: number | null;
  readonly canFullyRepair: boolean;
  readonly overflowRisk: boolean;
}

/** Full repair capacity forecast across all layers. */
export interface ShieldRepairQueueCapacityForecast {
  readonly tick: number;
  readonly layers: readonly ShieldRepairQueueLayerForecast[];
  readonly overallRepairUrgency: number;
  readonly criticalLayerIds: readonly ShieldLayerId[];
  readonly recommendedAction: string;
}

/** Annotation for a single job creation event. */
export interface ShieldRepairQueueJobAnnotation {
  readonly tick: number;
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly durationTicks: number;
  readonly source: RepairJob['source'];
  readonly tags: readonly string[];
  readonly headline: string;
  readonly detail: string;
  readonly uxHint: string;
}

/** Annotation for a job completion event. */
export interface ShieldRepairQueueCompletionAnnotation {
  readonly tick: number;
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly totalDelivered: number;
  readonly headline: string;
  readonly uxHint: string;
}

/** Annotation bundle for all queue events in a tick. */
export interface ShieldRepairQueueAnnotationBundle {
  readonly tick: number;
  readonly jobCreations: readonly ShieldRepairQueueJobAnnotation[];
  readonly jobCompletions: readonly ShieldRepairQueueCompletionAnnotation[];
  readonly rejectionEvents: readonly string[];
  readonly deliveryEvents: readonly string[];
  readonly overallHeadline: string;
  readonly uxSummary: string;
}

/** UX hint for surface-level display in the chat lane. */
export interface ShieldRepairQueueUXHint {
  readonly layerId: ShieldLayerId | null;
  readonly urgency: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly headline: string;
  readonly subtext: string;
  readonly actionPrompt: string | null;
  readonly chatChannel: 'REPAIR_LOW' | 'REPAIR_MID' | 'REPAIR_HIGH' | 'REPAIR_CRITICAL';
}

/** Single entry in the queue history ring buffer. */
export interface ShieldRepairQueueHistoryEntry {
  readonly tick: number;
  readonly queueDepth: number;
  readonly totalPendingHp: number;
  readonly deliveredThisTick: number;
  readonly newJobsThisTick: number;
  readonly completionsThisTick: number;
  readonly rejectionsThisTick: number;
}

/** Inspector state — full diagnostic snapshot of the queue at a tick. */
export interface ShieldRepairQueueInspectorState {
  readonly tick: number;
  readonly activeJobs: readonly RepairJob[];
  readonly queueDepth: number;
  readonly totalPendingHp: number;
  readonly overallUtilization: number;
  readonly activeJobCountPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly pendingHpPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly progressRatioPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly overflowRiskPerLayer: Readonly<Record<ShieldLayerId, boolean>>;
  readonly historyDepth: number;
  readonly mlVector: ShieldRepairQueueMLVector;
  readonly layerConfigMap: Readonly<Record<ShieldLayerId, ShieldLayerConfig>>;
}

/** Session-level analytics aggregated over a run. */
export interface ShieldRepairQueueAnalyticsSummary {
  readonly totalJobsCreated: number;
  readonly totalJobsCompleted: number;
  readonly totalJobsRejected: number;
  readonly totalHpQueued: number;
  readonly totalHpDelivered: number;
  readonly averageJobDuration: number;
  readonly averageUtilization: number;
  readonly peakQueueDepth: number;
  readonly jobCountPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly deliveredHpPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly rejectionCountPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly overflowEventCount: number;
}

/** Full ensemble returned by factory functions. */
export interface ShieldRepairQueueEnsemble {
  readonly queue: ShieldRepairQueue;
  readonly mlExtractor: ShieldRepairQueueMLExtractor;
  readonly dlBuilder: ShieldRepairQueueDLBuilder;
  readonly trendAnalyzer: ShieldRepairQueueTrendAnalyzer;
  readonly forecaster: ShieldRepairQueueForecaster;
  readonly annotator: ShieldRepairQueueAnnotator;
  readonly inspector: ShieldRepairQueueInspector;
  readonly analytics: ShieldRepairQueueAnalytics;
}

/** Parameters for ML vector extraction. */
export interface ShieldRepairQueueMLParams {
  readonly jobs: readonly RepairJob[];
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly totalDelivered: number;
  readonly totalQueued: number;
  readonly rejectionCount: number;
  readonly completionCount: number;
}

/** Parameters for DL row construction. */
export interface ShieldRepairQueueDLRowParams {
  readonly tick: number;
  readonly previousJobs: readonly RepairJob[];
  readonly currentJobs: readonly RepairJob[];
  readonly deliveredThisTick: Readonly<Record<ShieldLayerId, number>>;
  readonly queuedThisTick: Readonly<Record<ShieldLayerId, number>>;
  readonly completedLayerIds: readonly ShieldLayerId[];
  readonly rejectedLayerIds: readonly ShieldLayerId[];
  readonly createdLayerIds: readonly ShieldLayerId[];
  readonly overflowLayerIds: readonly ShieldLayerId[];
  readonly totalDeliveredNormalized: number;
  readonly maxTick: number;
}

/** Session report emitted at end of a run. */
export interface ShieldRepairQueueSessionReport {
  readonly runId: string;
  readonly finalTick: number;
  readonly analytics: ShieldRepairQueueAnalyticsSummary;
  readonly finalMLVector: ShieldRepairQueueMLVector;
  readonly trendSummary: ShieldRepairQueueTrendSummary;
  readonly capacityForecast: ShieldRepairQueueCapacityForecast;
}

/** Enqueue result — either a created job or a rejection. */
export type ShieldRepairQueueEnqueueResult =
  | { readonly accepted: true; readonly job: RepairJob }
  | { readonly accepted: false; readonly rejection: QueueRejection };

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — Pure helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the active job count for each layer from a job list.
 */
export function computeActiveJobCountPerLayer(
  jobs: readonly RepairJob[],
): Record<ShieldLayerId, number> {
  const counts: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
  for (const job of jobs) {
    if (job.ticksRemaining <= 0) continue;
    if (job.layerId === 'ALL') {
      for (const id of SHIELD_LAYER_ORDER) {
        counts[id] = (counts[id] ?? 0) + 1;
      }
    } else {
      counts[job.layerId] = (counts[job.layerId] ?? 0) + 1;
    }
  }
  return counts as Record<ShieldLayerId, number>;
}

/**
 * Compute the total pending HP for each layer from a job list.
 * Pending HP = amount - delivered for each active job targeting that layer.
 */
export function computePendingHpPerLayer(
  jobs: readonly RepairJob[],
): Record<ShieldLayerId, number> {
  const hp: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
  for (const job of jobs) {
    if (job.ticksRemaining <= 0) continue;
    const pending = Math.max(0, job.amount - job.delivered);
    if (job.layerId === 'ALL') {
      for (const id of SHIELD_LAYER_ORDER) {
        hp[id] = (hp[id] ?? 0) + pending;
      }
    } else {
      hp[job.layerId] = (hp[job.layerId] ?? 0) + pending;
    }
  }
  return hp as Record<ShieldLayerId, number>;
}

/**
 * Compute the progress ratio (0-1) for each layer.
 * Progress ratio = delivered / amount averaged over all active jobs for that layer.
 */
export function computeProgressRatioPerLayer(
  jobs: readonly RepairJob[],
): Record<ShieldLayerId, number> {
  const totalAmount: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
  const totalDelivered: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };

  for (const job of jobs) {
    if (job.ticksRemaining <= 0) continue;
    const layers =
      job.layerId === 'ALL' ? [...SHIELD_LAYER_ORDER] : [job.layerId as ShieldLayerId];
    for (const id of layers) {
      totalAmount[id] = (totalAmount[id] ?? 0) + job.amount;
      totalDelivered[id] = (totalDelivered[id] ?? 0) + job.delivered;
    }
  }

  const result: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
  for (const id of SHIELD_LAYER_ORDER) {
    const amt = totalAmount[id] ?? 0;
    const del = totalDelivered[id] ?? 0;
    result[id] = amt > 0 ? Math.min(1, del / amt) : 0;
  }
  return result as Record<ShieldLayerId, number>;
}

/**
 * Compute the estimated delivery rate (HP/tick) per layer.
 * Uses amountPerTick summed over all active jobs for that layer.
 */
export function computeDeliveryRatePerLayer(
  jobs: readonly RepairJob[],
): Record<ShieldLayerId, number> {
  const rates: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
  for (const job of jobs) {
    if (job.ticksRemaining <= 0) continue;
    const layers =
      job.layerId === 'ALL' ? [...SHIELD_LAYER_ORDER] : [job.layerId as ShieldLayerId];
    for (const id of layers) {
      rates[id] = (rates[id] ?? 0) + job.amountPerTick;
    }
  }
  return rates as Record<ShieldLayerId, number>;
}

/**
 * Compute overall queue utilization (0-1) based on active jobs vs. max slots.
 */
export function computeOverallUtilization(jobs: readonly RepairJob[]): number {
  const maxSlots =
    SHIELD_LAYER_ORDER.length * SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER;
  if (maxSlots <= 0) return 0;
  const activeCount = jobs.filter((j) => j.ticksRemaining > 0).length;
  return Math.min(1, activeCount / maxSlots);
}

/**
 * Determine whether a layer's queue slot count is at or above the overflow threshold.
 */
export function isLayerAtOverflowRisk(
  jobs: readonly RepairJob[],
  layerId: ShieldLayerId,
): boolean {
  const count = jobs.filter((j) => {
    if (j.ticksRemaining <= 0) return false;
    return j.layerId === 'ALL' || j.layerId === layerId;
  }).length;
  return (
    count >=
    SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER *
      SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD
  );
}

/**
 * Build the per-layer overflow risk map.
 */
export function buildOverflowRiskMap(
  jobs: readonly RepairJob[],
): Record<ShieldLayerId, boolean> {
  const map: Record<string, boolean> = {};
  for (const id of SHIELD_LAYER_ORDER) {
    map[id] = isLayerAtOverflowRisk(jobs, id);
  }
  return map as Record<ShieldLayerId, boolean>;
}

/**
 * Compute the repair urgency score for the current queue state (0-1).
 * Combines layer vulnerability, pending HP, and queue utilization.
 */
export function computeRepairQueueUrgency(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): number {
  const pendingHp = computePendingHpPerLayer(jobs);
  const stakes = computeEffectiveStakes(phase, mode);
  let urgencySum = 0;
  let weightSum = 0;

  for (const layer of layers) {
    const vulnerability = computeShieldLayerVulnerability(
      layer.layerId,
      layer.current,
      layer.max,
    );
    const pending = pendingHp[layer.layerId] ?? 0;
    const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
    const deficit = Math.max(0, layer.max - layer.current);
    const coverageRatio = deficit > 0 ? Math.min(1, pending / deficit) : 0;
    const uncoveredRisk = vulnerability * (1 - coverageRatio);
    urgencySum += uncoveredRisk * capacityWeight;
    weightSum += capacityWeight;
  }

  const baseUrgency = weightSum > 0 ? urgencySum / weightSum : 0;
  return Math.min(1, baseUrgency * stakes);
}

/**
 * Classify repair queue urgency into a label.
 */
export function classifyRepairQueueUrgency(
  urgency: number,
): 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  if (urgency >= 0.85) return 'CRITICAL';
  if (urgency >= 0.65) return 'HIGH';
  if (urgency >= 0.40) return 'MODERATE';
  if (urgency >= 0.15) return 'LOW';
  return 'NONE';
}

/**
 * Get the appropriate chat channel for a given urgency level.
 */
export function getRepairQueueChatChannel(
  urgency: number,
): 'REPAIR_LOW' | 'REPAIR_MID' | 'REPAIR_HIGH' | 'REPAIR_CRITICAL' {
  if (urgency >= 0.85) return 'REPAIR_CRITICAL';
  if (urgency >= 0.55) return 'REPAIR_HIGH';
  if (urgency >= 0.25) return 'REPAIR_MID';
  return 'REPAIR_LOW';
}

/**
 * Build a human-readable headline for the current queue state.
 */
export function buildRepairQueueUXHeadline(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  const activeCount = jobs.filter((j) => j.ticksRemaining > 0).length;
  const utilization = computeOverallUtilization(jobs);
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  const isEndgame = isEndgamePhase(phase);
  const isGhost = mode === 'ghost';

  if (isEndgame && urgency >= 0.8) {
    return 'SOVEREIGNTY REPAIR CRITICAL — queue at capacity, shields degrading';
  }
  if (isGhost && layers.some((l) => l.layerId === 'L3' && l.breached)) {
    return 'GHOST ECHO ACTIVE — L3 breach unrepaired, cascade chain imminent';
  }
  if (utilization >= SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION) {
    return 'REPAIR QUEUE SATURATED — cannot accept new jobs';
  }
  if (utilization >= SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD) {
    return 'Repair queue near capacity — prioritize high-value jobs';
  }
  if (activeCount === 0) {
    const breachedLayers = layers.filter((l) => l.breached);
    if (breachedLayers.length > 0) {
      return `Queue empty — ${breachedLayers.length} layer${breachedLayers.length > 1 ? 's' : ''} breached with no repair scheduled`;
    }
    return 'Repair queue idle — all layers holding';
  }
  return `${activeCount} active repair job${activeCount > 1 ? 's' : ''} — delivering HP to shield layers`;
}

/**
 * Compute the aggregate bot threat contribution to repair urgency.
 * Uses GamePrimitives BOT_THREAT_LEVEL and BOT_STATE_THREAT_MULTIPLIER.
 */
export function computeRepairBotThreatContribution(
  botStates: Readonly<Record<HaterBotId, BotState>>,
): number {
  let total = 0;
  for (const [botId, state] of Object.entries(botStates) as [HaterBotId, BotState][]) {
    total += BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[state];
  }
  return Math.min(1, total);
}

/**
 * Score the overall narrative weight for the repair queue state (0-1).
 * Combines urgency, mode stakes, pressure, and queue saturation.
 */
export function buildRepairQueueNarrativeWeight(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): number {
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  const utilization = computeOverallUtilization(jobs);
  const pressure = PRESSURE_TIER_NORMALIZED[pressureTier];
  return Math.min(
    1,
    urgency * 0.45 + utilization * 0.25 + pressure * 0.30,
  );
}

/**
 * Compute the recommended action string for the repair queue.
 */
export function buildRepairQueueRecommendedAction(
  criticalLayerIds: readonly ShieldLayerId[],
  urgency: number,
  utilization: number,
  mode: ModeCode,
  phase: RunPhase,
): string {
  const isEndgame = isEndgamePhase(phase);
  const stakes = computeEffectiveStakes(phase, mode);

  if (urgency >= SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD) {
    return isEndgame
      ? 'IMMEDIATE: Play RESCUE card — sovereignty phase breach is fatal without repair'
      : 'IMMEDIATE: Queue repair for critical layers now — breach chain risk is very high';
  }
  if (utilization >= SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION) {
    return 'QUEUE FULL: Wait for active jobs to complete before queuing new repairs';
  }
  if (criticalLayerIds.includes('L4')) {
    return 'URGENT: Queue L4 (NETWORK_CORE) repair — cascade gate breach is unrecovered';
  }
  if (criticalLayerIds.includes('L3') && mode === 'ghost') {
    return 'URGENT: Ghost doctrine — queue L3 repair to prevent echo chain into L4';
  }
  if (criticalLayerIds.length > 0) {
    return `DEFEND: Queue ${criticalLayerIds[0]} repair — below critical integrity threshold`;
  }
  if (stakes > 1.2) {
    return 'MAINTAIN: High-stakes phase — keep repair queue active on all layers above 50%';
  }
  return 'HOLD: Queue posture acceptable — monitor for new breach events';
}

/**
 * Compute the effective repair multiplier for a mode/phase combination.
 * Higher multiplier = repair delivers more HP per tick.
 */
export function computeRepairEfficiencyMultiplier(
  mode: ModeCode,
  phase: RunPhase,
): number {
  const modeFactors: Record<ModeCode, number> = {
    solo: 1.0,
    pvp: 0.85,
    coop: 1.20,
    ghost: 0.75,
  };
  const phaseFactors: Record<RunPhase, number> = {
    FOUNDATION: 1.0,
    ESCALATION: 0.90,
    SOVEREIGNTY: 0.80,
  };
  return modeFactors[mode] * phaseFactors[phase];
}

/**
 * Compute the absorption-order weight for a layer — higher priority layers
 * (L1 first) are more important to repair quickly.
 */
export function computeRepairAbsorptionWeight(layerId: ShieldLayerId): number {
  const absorptionIdx = SHIELD_LAYER_ABSORPTION_ORDER.indexOf(layerId);
  const orderIdx = layerOrderIndex(layerId);
  // L1 (idx=0) is highest priority, L4 (idx=3) is lowest
  const priorityWeight = 1.0 - absorptionIdx * 0.15;
  const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layerId];
  return priorityWeight * capacityWeight * (1 + orderIdx * 0.05);
}

/**
 * Identify which layers most urgently need repair based on current state.
 * Scored by per-layer vulnerability × absorption weight, minus existing job
 * coverage penalty. Layers below LOW_WARNING_THRESHOLD are returned ordered
 * by descending urgency so the highest-priority target is always first.
 */
export function findRepairPriorityLayers(
  layers: readonly ShieldLayerState[],
  jobs: readonly RepairJob[],
): ShieldLayerId[] {
  const activeCount = computeActiveJobCountPerLayer(jobs);
  return [...layers]
    .filter((l) => l.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD)
    .sort((a, b) => {
      const scoreA =
        computeShieldLayerVulnerability(a.layerId, a.current, a.max) *
          computeRepairAbsorptionWeight(a.layerId) -
        (activeCount[a.layerId] ?? 0) * 0.1;
      const scoreB =
        computeShieldLayerVulnerability(b.layerId, b.current, b.max) *
          computeRepairAbsorptionWeight(b.layerId) -
        (activeCount[b.layerId] ?? 0) * 0.1;
      return scoreB - scoreA;
    })
    .map((l) => l.layerId);
}

/**
 * Compute the low-throughput risk for a given delivery rate map.
 * Returns a 0-1 score where 1 = all layers are at or below the
 * SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD. Used by scoreQueueHealth()
 * and the chat adapter to detect stalled repair scenarios.
 */
export function computeLowThroughputRisk(
  deliveryRatePerLayer: Readonly<Record<ShieldLayerId, number>>,
): number {
  const stalled = SHIELD_LAYER_ORDER.filter(
    (id) => (deliveryRatePerLayer[id] ?? 0) < SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD,
  );
  return stalled.length / SHIELD_LAYER_ORDER.length;
}

/**
 * Returns the subset of layer IDs whose active delivery rate is below the
 * SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD HP/tick floor.
 */
export function findLowThroughputLayerIds(
  jobs: readonly RepairJob[],
): ShieldLayerId[] {
  const rates = computeDeliveryRatePerLayer(jobs);
  return SHIELD_LAYER_ORDER.filter(
    (id) => (rates[id] ?? 0) < SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD,
  );
}

/**
 * Compute the per-layer throughput health map.
 * Each entry is 1 if the layer is at or above the throughput threshold,
 * and a fractional value below 1 when the layer is underperforming.
 * Used by the ML extractor for richer feature coverage.
 */
export function computePerLayerThroughputHealth(
  jobs: readonly RepairJob[],
): Readonly<Record<ShieldLayerId, number>> {
  const rates = computeDeliveryRatePerLayer(jobs);
  const health: Record<string, number> = {};
  for (const id of SHIELD_LAYER_ORDER) {
    const rate = rates[id] ?? 0;
    health[id] = Math.min(1, rate / Math.max(1, SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD));
  }
  return Object.freeze(health as Record<ShieldLayerId, number>);
}

/**
 * Compute repair momentum — the rate of change of total HP delivery over
 * the most recent pair of history entries. Positive = accelerating delivery,
 * negative = decelerating.
 */
export function computeRepairMomentum(
  history: readonly ShieldRepairQueueHistoryEntry[],
): number {
  if (history.length < 2) return 0;
  const last = history[history.length - 1]!;
  const prev = history[history.length - 2]!;
  return last.deliveredThisTick - prev.deliveredThisTick;
}

/**
 * Build a per-layer repair risk vector.
 * Each entry is the uncovered HP deficit ratio for a given layer (0-1).
 * 1 = layer is fully breached with no pending repair coverage.
 */
export function buildRepairRiskVector(
  layers: readonly ShieldLayerState[],
  jobs: readonly RepairJob[],
): Readonly<Record<ShieldLayerId, number>> {
  const pendingHp = computePendingHpPerLayer(jobs);
  const risk: Record<string, number> = {};
  for (const layer of layers) {
    const deficit = Math.max(0, layer.max - layer.current);
    const covered = Math.min(deficit, pendingHp[layer.layerId] ?? 0);
    risk[layer.layerId] = deficit > 0 ? Math.min(1, 1 - covered / deficit) : 0;
  }
  for (const id of SHIELD_LAYER_ORDER) {
    if (!(id in risk)) risk[id] = 0;
  }
  return Object.freeze(risk as Record<ShieldLayerId, number>);
}

/**
 * Score the alignment between active repair jobs and the most threatened
 * doctrine layers. Returns 0-1 where 1 = all repair is perfectly targeted.
 */
export function scoreRepairDoctrineAlignment(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
): number {
  const priorityLayers = findRepairPriorityLayers(layers, jobs);
  if (priorityLayers.length === 0) return 1;
  const activeCount = computeActiveJobCountPerLayer(jobs);
  let coveredCount = 0;
  for (const id of priorityLayers) {
    if ((activeCount[id] ?? 0) > 0) coveredCount++;
  }
  return coveredCount / priorityLayers.length;
}

/**
 * Estimate how many ticks until a specific layer is fully repaired, given
 * its current HP deficit and the effective delivery rate including mode/phase
 * efficiency. Returns null if no active jobs target the layer.
 */
export function estimateTicksToFullRepair(
  layerId: ShieldLayerId,
  layer: ShieldLayerState,
  jobs: readonly RepairJob[],
  mode: ModeCode,
  phase: RunPhase,
): number | null {
  const deliveryRate = computeDeliveryRatePerLayer(jobs)[layerId] ?? 0;
  const efficiency = computeRepairEfficiencyMultiplier(mode, phase);
  const effectiveRate = Math.max(0, deliveryRate * efficiency);
  if (effectiveRate <= 0) return null;
  const deficit = Math.max(0, layer.max - layer.current);
  if (deficit === 0) return 0;
  return Math.min(
    SHIELD_REPAIR_QUEUE_FORECAST_MAX_HORIZON,
    Math.ceil(deficit / effectiveRate),
  );
}

/**
 * Compute the overall repair stress score (0-1).
 * High stress = high urgency + low throughput + near-overflow state.
 */
export function computeRepairQueueStressScore(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): number {
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  const deliveryRates = computeDeliveryRatePerLayer(jobs);
  const lowThroughputRisk = computeLowThroughputRisk(deliveryRates);
  const utilization = computeOverallUtilization(jobs);
  const pressure = PRESSURE_TIER_NORMALIZED[pressureTier];
  return Math.min(
    1,
    urgency * 0.40 + lowThroughputRisk * 0.25 + utilization * 0.20 + pressure * 0.15,
  );
}

/**
 * Compute the total pending HP across all active jobs.
 */
export function computeTotalPendingHp(jobs: readonly RepairJob[]): number {
  return jobs
    .filter((j) => j.ticksRemaining > 0)
    .reduce((sum, j) => sum + Math.max(0, j.amount - j.delivered), 0);
}

/**
 * Compute the completion rate (0-1) over the recent history.
 * completions / (completions + rejections)
 */
export function computeCompletionRate(
  completions: number,
  rejections: number,
): number {
  const total = completions + rejections;
  return total > 0 ? completions / total : 1;
}

/**
 * Build the flat ML feature array from a ShieldRepairQueueMLVector.
 * Order matches SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS.
 */
export function extractRepairQueueMLArray(
  vector: ShieldRepairQueueMLVector,
): number[] {
  return [
    vector.l1ActiveJobCount,
    vector.l2ActiveJobCount,
    vector.l3ActiveJobCount,
    vector.l4ActiveJobCount,
    vector.l1PendingHp,
    vector.l2PendingHp,
    vector.l3PendingHp,
    vector.l4PendingHp,
    vector.l1ProgressRatio,
    vector.l2ProgressRatio,
    vector.l3ProgressRatio,
    vector.l4ProgressRatio,
    vector.l1DeliveryRate,
    vector.l2DeliveryRate,
    vector.l3DeliveryRate,
    vector.l4DeliveryRate,
    vector.overallUtilization,
    vector.completionRate,
    vector.rejectionRate,
    vector.queueDepthNormalized,
    vector.totalDeliveredNormalized,
    vector.totalQueuedNormalized,
    vector.modeNormalized,
    vector.phaseNormalized,
    vector.stakesMultiplier,
    vector.modeDifficulty,
    vector.ghostModeFlag,
    vector.sovereigntyPhaseFlag,
  ];
}

/**
 * Validate that the ML array has the correct feature count.
 */
export function validateRepairQueueMLArray(arr: readonly number[]): boolean {
  return arr.length === SHIELD_REPAIR_QUEUE_ML_FEATURE_COUNT;
}

/**
 * Validate that the DL row has the correct feature count.
 */
export function validateRepairQueueDLRow(row: ShieldRepairQueueDLRow): boolean {
  return row.features.length === SHIELD_REPAIR_QUEUE_DL_FEATURE_COUNT;
}

/**
 * Build the label for a layer's repair status.
 */
export function buildRepairStatusLabel(
  pending: number,
  activeJobs: number,
  layerBreached: boolean,
): string {
  if (layerBreached && pending === 0) return 'UNREPAIRED BREACH';
  if (layerBreached && activeJobs > 0) return 'REPAIRING';
  if (pending > 0 && activeJobs > 0) return 'RECOVERING';
  if (pending === 0 && !layerBreached) return 'HEALED';
  return 'IDLE';
}

/**
 * Describe the repair queue state in a single summary sentence.
 */
export function describeRepairQueueState(
  jobs: readonly RepairJob[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  const activeCount = jobs.filter((j) => j.ticksRemaining > 0).length;
  const totalPending = computeTotalPendingHp(jobs);
  const utilization = Math.round(computeOverallUtilization(jobs) * 100);
  return (
    `Mode=${mode} Phase=${phase}: ` +
    `${activeCount} active job${activeCount !== 1 ? 's' : ''}, ` +
    `${totalPending.toFixed(0)} HP pending, ` +
    `${utilization}% queue utilization`
  );
}

/**
 * Compute the aggregate threat pressure from incoming threats to determine
 * whether the repair queue should accelerate delivery.
 */
export function computeRepairThreatPressure(
  threats: readonly ThreatEnvelope[],
  tick: number,
): number {
  return computeAggregateThreatPressure(threats, tick);
}

/**
 * Score the urgency of a single threat against shield layers.
 * Used to prioritize which layer to repair first when queue is limited.
 */
export function scoreThreatLayerUrgency(
  threat: ThreatEnvelope,
  tick: number,
): number {
  return scoreThreatUrgency(threat, tick);
}

/**
 * Build a per-layer config map for use in annotations and forecasting.
 */
export function buildRepairLayerConfigMap(): Record<ShieldLayerId, ShieldLayerConfig> {
  const map: Record<string, ShieldLayerConfig> = {};
  for (const id of SHIELD_LAYER_ORDER) {
    map[id] = SHIELD_LAYER_CONFIGS[id];
  }
  return map as Record<ShieldLayerId, ShieldLayerConfig>;
}

/**
 * Resolve a doctrine type from note tags on a repair job.
 * Leverages the shield alias table from types.ts.
 */
export function resolveRepairJobDoctrine(
  tags: readonly string[],
): ShieldDoctrineAttackType | null {
  const normalized = normalizeShieldNoteTags(tags);
  return resolveShieldAlias(normalized);
}

/**
 * Check whether a note tag matches any known shield alias.
 * Uses SHIELD_ATTACK_ALIASES from types.ts.
 */
export function isKnownShieldAlias(tag: string): boolean {
  return tag in SHIELD_ATTACK_ALIASES;
}

/**
 * Build a threshold report string for the repair queue.
 */
export function buildRepairQueueThresholdReport(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
  const utilization = Math.round(computeOverallUtilization(jobs) * 100);
  const totalPending = computeTotalPendingHp(jobs);
  const urgencyLabel = classifyRepairQueueUrgency(urgency);
  const description = describeRepairQueueState(jobs, mode, phase);
  return (
    `[SHIELD_REPAIR_QUEUE] ${urgencyLabel} | ` +
    `urgency=${Math.round(urgency * 100)}% | ` +
    `utilization=${utilization}% | ` +
    `pending=${totalPending.toFixed(0)}HP | ` +
    description
  );
}

/**
 * Build an ML compat wrapper for cross-subsystem consumption.
 */
export function buildRepairQueueMLCompat(
  vector: ShieldRepairQueueMLVector,
): {
  readonly features: number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
} {
  return {
    features: extractRepairQueueMLArray(vector),
    labels: SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS,
    featureCount: SHIELD_REPAIR_QUEUE_ML_FEATURE_COUNT,
  };
}

/**
 * Build a layer-state rebuild from a ShieldLayerState after repair delivery.
 * Returns the updated layer with repaired HP.
 */
export function applyRepairToLayerState(
  layer: ShieldLayerState,
  hpDelivered: number,
  tick: number,
): ShieldLayerState {
  if (hpDelivered <= 0) return layer;
  const nextCurrent = Math.min(layer.max, layer.current + hpDelivered);
  return buildShieldLayerState(
    layer.layerId,
    nextCurrent,
    layer.lastDamagedTick,
    nextCurrent > layer.current ? tick : layer.lastRecoveredTick,
  );
}

/**
 * Score the overall repair coverage ratio across all layers (0-1).
 * 1.0 = all deficit HP is fully covered by pending jobs.
 */
export function scoreRepairCoverageRatio(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
): number {
  const pendingHp = computePendingHpPerLayer(jobs);
  let totalDeficit = 0;
  let coveredDeficit = 0;

  for (const layer of layers) {
    const deficit = Math.max(0, layer.max - layer.current);
    const covered = Math.min(deficit, pendingHp[layer.layerId] ?? 0);
    totalDeficit += deficit;
    coveredDeficit += covered;
  }

  return totalDeficit > 0 ? Math.min(1, coveredDeficit / totalDeficit) : 1;
}

/**
 * Compute the repair queue saturation — fraction of total max slots filled.
 */
export function computeQueueSaturation(jobs: readonly RepairJob[]): number {
  return computeOverallUtilization(jobs);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — ShieldRepairQueueMLExtractor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the canonical 28-feature ML vector from the repair queue state,
 * mode, phase, and operation counters.
 */
export class ShieldRepairQueueMLExtractor {
  extractVector(params: ShieldRepairQueueMLParams): ShieldRepairQueueMLVector {
    const {
      jobs,
      mode,
      phase,
      totalDelivered,
      totalQueued,
      rejectionCount,
      completionCount,
    } = params;

    const activeJobs = jobs.filter((j) => j.ticksRemaining > 0);
    const activeCount = computeActiveJobCountPerLayer(activeJobs);
    const pendingHp = computePendingHpPerLayer(activeJobs);
    const progressRatio = computeProgressRatioPerLayer(activeJobs);
    const deliveryRate = computeDeliveryRatePerLayer(activeJobs);

    const maxJobs = SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER;
    const maxHp = SHIELD_REPAIR_QUEUE_MAX_QUEUED_HP;
    const maxHpPerTick = SHIELD_REPAIR_QUEUE_MAX_HP_PER_TICK;
    const maxTotalHp = SHIELD_REPAIR_QUEUE_MAX_QUEUED_HP * 4;

    const overallUtilization = computeOverallUtilization(activeJobs);
    const completionRate = computeCompletionRate(completionCount, rejectionCount);
    const totalEvents = completionCount + rejectionCount;
    const rejectionRate =
      totalEvents > 0 ? rejectionCount / totalEvents : 0;

    return {
      l1ActiveJobCount: Math.min(1, (activeCount['L1'] ?? 0) / maxJobs),
      l2ActiveJobCount: Math.min(1, (activeCount['L2'] ?? 0) / maxJobs),
      l3ActiveJobCount: Math.min(1, (activeCount['L3'] ?? 0) / maxJobs),
      l4ActiveJobCount: Math.min(1, (activeCount['L4'] ?? 0) / maxJobs),

      l1PendingHp: Math.min(1, (pendingHp['L1'] ?? 0) / maxHp),
      l2PendingHp: Math.min(1, (pendingHp['L2'] ?? 0) / maxHp),
      l3PendingHp: Math.min(1, (pendingHp['L3'] ?? 0) / maxHp),
      l4PendingHp: Math.min(1, (pendingHp['L4'] ?? 0) / maxHp),

      l1ProgressRatio: progressRatio['L1'] ?? 0,
      l2ProgressRatio: progressRatio['L2'] ?? 0,
      l3ProgressRatio: progressRatio['L3'] ?? 0,
      l4ProgressRatio: progressRatio['L4'] ?? 0,

      l1DeliveryRate: Math.min(1, (deliveryRate['L1'] ?? 0) / maxHpPerTick),
      l2DeliveryRate: Math.min(1, (deliveryRate['L2'] ?? 0) / maxHpPerTick),
      l3DeliveryRate: Math.min(1, (deliveryRate['L3'] ?? 0) / maxHpPerTick),
      l4DeliveryRate: Math.min(1, (deliveryRate['L4'] ?? 0) / maxHpPerTick),

      overallUtilization,
      completionRate,
      rejectionRate,

      queueDepthNormalized: Math.min(
        1,
        activeJobs.length /
          (SHIELD_LAYER_ORDER.length * SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER),
      ),
      totalDeliveredNormalized: Math.min(1, totalDelivered / maxTotalHp),
      totalQueuedNormalized: Math.min(1, totalQueued / maxTotalHp),

      modeNormalized: MODE_NORMALIZED[mode],
      phaseNormalized: RUN_PHASE_NORMALIZED[phase],
      stakesMultiplier: RUN_PHASE_STAKES_MULTIPLIER[phase],
      modeDifficulty: MODE_DIFFICULTY_MULTIPLIER[mode],

      ghostModeFlag: mode === 'ghost' ? 1 : 0,
      sovereigntyPhaseFlag: phase === 'SOVEREIGNTY' ? 1 : 0,
    };
  }

  extractFromSnapshot(
    snapshot: RunStateSnapshot,
    jobs: readonly RepairJob[],
    totalDelivered: number,
    totalQueued: number,
    rejectionCount: number,
    completionCount: number,
  ): ShieldRepairQueueMLVector {
    return this.extractVector({
      jobs,
      mode: snapshot.mode,
      phase: snapshot.phase,
      totalDelivered,
      totalQueued,
      rejectionCount,
      completionCount,
    });
  }

  toArray(vector: ShieldRepairQueueMLVector): number[] {
    return extractRepairQueueMLArray(vector);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — ShieldRepairQueueDLBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the canonical 36-feature DL row for one tick and manages a rolling
 * 6-tick tensor window for the repair queue.
 */
export class ShieldRepairQueueDLBuilder {
  private window: ShieldRepairQueueDLRow[] = [];

  buildRow(params: ShieldRepairQueueDLRowParams): ShieldRepairQueueDLRow {
    const {
      tick,
      previousJobs,
      currentJobs,
      deliveredThisTick,
      queuedThisTick,
      completedLayerIds,
      rejectedLayerIds,
      createdLayerIds,
      overflowLayerIds,
      totalDeliveredNormalized,
      maxTick,
    } = params;

    const ids: ShieldLayerId[] = ['L1', 'L2', 'L3', 'L4'];
    const maxHp = SHIELD_REPAIR_QUEUE_MAX_QUEUED_HP;

    const prevCount = computeActiveJobCountPerLayer(previousJobs);
    const currCount = computeActiveJobCountPerLayer(currentJobs);
    const maxJobs = SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER;

    const activeDeltas = ids.map(
      (id) =>
        ((currCount[id] ?? 0) - (prevCount[id] ?? 0)) / maxJobs,
    );
    const deliveredNorm = ids.map(
      (id) => Math.min(1, (deliveredThisTick[id] ?? 0) / maxHp),
    );
    const queuedNorm = ids.map(
      (id) => Math.min(1, (queuedThisTick[id] ?? 0) / maxHp),
    );
    const completedFlags = ids.map((id) =>
      completedLayerIds.includes(id) ? 1 : 0,
    );
    const rejectedFlags = ids.map((id) =>
      rejectedLayerIds.includes(id) ? 1 : 0,
    );
    const createdFlags = ids.map((id) =>
      createdLayerIds.includes(id) ? 1 : 0,
    );
    const progressRatios = Object.values(
      computeProgressRatioPerLayer(currentJobs),
    );
    const overflowFlags = ids.map((id) =>
      overflowLayerIds.includes(id) ? 1 : 0,
    );

    const totalActiveJobs = currentJobs.filter((j) => j.ticksRemaining > 0).length;
    const maxTotalSlots =
      SHIELD_LAYER_ORDER.length * SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER;
    const depthNorm = Math.min(1, totalActiveJobs / maxTotalSlots);

    const eventCount =
      completedLayerIds.length +
      rejectedLayerIds.length +
      createdLayerIds.length;

    const features: number[] = [
      ...activeDeltas,
      ...deliveredNorm,
      ...queuedNorm,
      ...completedFlags,
      ...rejectedFlags,
      ...createdFlags,
      ...progressRatios,
      ...overflowFlags,
      totalDeliveredNormalized,
      depthNorm,
      Math.min(1, tick / Math.max(1, maxTick)),
      Math.min(1, eventCount / 8),
    ];

    return { tick, features: Object.freeze(features) };
  }

  pushRow(row: ShieldRepairQueueDLRow): void {
    this.window.push(row);
    if (this.window.length > SHIELD_REPAIR_QUEUE_DL_SEQUENCE_LENGTH) {
      this.window.shift();
    }
  }

  buildAndPush(params: ShieldRepairQueueDLRowParams): ShieldRepairQueueDLRow {
    const row = this.buildRow(params);
    this.pushRow(row);
    return row;
  }

  getTensor(): ShieldRepairQueueDLTensor {
    const rows = [...this.window];
    const latestTick = rows.length > 0 ? rows[rows.length - 1]!.tick : 0;
    return {
      rows: Object.freeze(rows),
      sequenceLength: rows.length,
      featureCount: SHIELD_REPAIR_QUEUE_DL_FEATURE_COUNT,
      latestTick,
    };
  }

  reset(): void {
    this.window = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — ShieldRepairQueueTrendAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes per-layer repair throughput trend (velocity and acceleration)
 * from the rolling history buffer.
 */
export class ShieldRepairQueueTrendAnalyzer {
  private history: ShieldRepairQueueHistoryEntry[] = [];

  pushEntry(entry: ShieldRepairQueueHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > SHIELD_REPAIR_QUEUE_HISTORY_DEPTH) {
      this.history.shift();
    }
  }

  computeLayerTrend(layerId: ShieldLayerId): ShieldRepairQueueLayerTrend {
    const window = this.history.slice(-SHIELD_REPAIR_QUEUE_TREND_WINDOW);
    if (window.length < 2) {
      return {
        layerId,
        throughputVelocity: 0,
        throughputAcceleration: 0,
        label: 'STABLE',
      };
    }

    // Use deliveredThisTick as a proxy for layer-specific throughput
    // We approximate per-layer delivery from total delivery depth
    const depths = window.map((e) => e.deliveredThisTick);

    const velocities: number[] = [];
    for (let i = 1; i < depths.length; i++) {
      velocities.push((depths[i] ?? 0) - (depths[i - 1] ?? 0));
    }
    const velocity =
      velocities.length > 0
        ? velocities.reduce((a, b) => a + b, 0) / velocities.length
        : 0;

    const accelerations: number[] = [];
    for (let i = 1; i < velocities.length; i++) {
      accelerations.push((velocities[i] ?? 0) - (velocities[i - 1] ?? 0));
    }
    const acceleration =
      accelerations.length > 0
        ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
        : 0;

    const label = this.classifyThroughputTrend(velocity, acceleration);
    return { layerId, throughputVelocity: velocity, throughputAcceleration: acceleration, label };
  }

  computeSummary(tick: number): ShieldRepairQueueTrendSummary {
    const layerTrends = SHIELD_LAYER_ORDER.map((id) =>
      this.computeLayerTrend(id),
    );

    const overallVelocity =
      layerTrends.reduce((s, t) => s + t.throughputVelocity, 0) /
      layerTrends.length;
    const overallAcceleration =
      layerTrends.reduce((s, t) => s + t.throughputAcceleration, 0) /
      layerTrends.length;

    const labelOrder: ShieldRepairQueueLayerTrend['label'][] = [
      'STALLED',
      'DECELERATING',
      'STABLE',
      'ACCELERATING',
    ];
    const dominantTrend = layerTrends.reduce((worst, t) =>
      labelOrder.indexOf(t.label) < labelOrder.indexOf(worst.label) ? t : worst,
    ).label;

    const recentEntry = this.history[this.history.length - 1];
    const criticalLayerCount = recentEntry ? recentEntry.rejectionsThisTick : 0;

    return {
      tick,
      layers: layerTrends,
      overallThroughputVelocity: overallVelocity,
      overallAcceleration,
      dominantTrend,
      criticalLayerCount,
    };
  }

  private classifyThroughputTrend(
    velocity: number,
    acceleration: number,
  ): ShieldRepairQueueLayerTrend['label'] {
    if (velocity > 2 && acceleration >= 0) return 'ACCELERATING';
    if (velocity < -2 || (velocity < 0 && acceleration < -0.5)) return 'STALLED';
    if (velocity < 0) return 'DECELERATING';
    return 'STABLE';
  }

  reset(): void {
    this.history = [];
  }

  getHistory(): readonly ShieldRepairQueueHistoryEntry[] {
    return [...this.history];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — ShieldRepairQueueForecaster
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forecasts repair capacity and delivery timelines for each layer.
 */
export class ShieldRepairQueueForecaster {
  forecastLayer(
    layerId: ShieldLayerId,
    layer: ShieldLayerState,
    jobs: readonly RepairJob[],
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldRepairQueueLayerForecast {
    const config = getLayerConfig(layerId);
    const currentHpDeficit = Math.max(0, config.max - layer.current);
    const pendingHpMap = computePendingHpPerLayer(jobs);
    const pendingHp = pendingHpMap[layerId] ?? 0;
    const activeCount = computeActiveJobCountPerLayer(jobs)[layerId] ?? 0;
    const deliveryRate = computeDeliveryRatePerLayer(jobs)[layerId] ?? 0;
    const efficiency = computeRepairEfficiencyMultiplier(mode, phase);
    const effectiveRate = Math.max(0, deliveryRate * efficiency);

    const canFullyRepair = pendingHp >= currentHpDeficit;
    const overflowRisk = isLayerAtOverflowRisk(jobs, layerId);

    let ticksToFullRepair: number | null = null;
    if (effectiveRate > 0 && currentHpDeficit > 0) {
      ticksToFullRepair = Math.min(
        SHIELD_REPAIR_QUEUE_FORECAST_MAX_HORIZON,
        Math.ceil(currentHpDeficit / effectiveRate),
      );
    } else if (currentHpDeficit === 0) {
      ticksToFullRepair = 0;
    }

    return {
      layerId,
      currentHpDeficit,
      pendingHp,
      activeJobCount: activeCount,
      estimatedDeliveryRate: effectiveRate,
      ticksToFullRepair,
      canFullyRepair,
      overflowRisk,
    };
  }

  forecastAll(
    layers: readonly ShieldLayerState[],
    jobs: readonly RepairJob[],
    mode: ModeCode,
    phase: RunPhase,
    tick: number,
  ): ShieldRepairQueueCapacityForecast {
    const layerForecasts = layers.map((l) =>
      this.forecastLayer(l.layerId, l, jobs, mode, phase),
    );

    const overallRepairUrgency = computeRepairQueueUrgency(
      jobs,
      layers,
      mode,
      phase,
    );
    const criticalLayerIds = layerForecasts
      .filter((f) => !f.canFullyRepair && f.currentHpDeficit > 0)
      .map((f) => f.layerId);

    const utilization = computeOverallUtilization(jobs);
    const recommendedAction = buildRepairQueueRecommendedAction(
      criticalLayerIds,
      overallRepairUrgency,
      utilization,
      mode,
      phase,
    );

    return {
      tick,
      layers: layerForecasts,
      overallRepairUrgency,
      criticalLayerIds,
      recommendedAction,
    };
  }

  forecastFromSnapshot(
    snapshot: RunStateSnapshot,
    jobs: readonly RepairJob[],
  ): ShieldRepairQueueCapacityForecast {
    return this.forecastAll(
      snapshot.shield.layers,
      jobs,
      snapshot.mode,
      snapshot.phase,
      snapshot.tick,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — ShieldRepairQueueAnnotator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces human-readable, UX-focused annotation bundles for repair queue events.
 * Headlines convey the stakes and urgency of each repair action.
 */
export class ShieldRepairQueueAnnotator {
  private readonly labelMap: Record<ShieldLayerId, string> = {
    L1: 'CASH RESERVE',
    L2: 'CREDIT LINE',
    L3: 'INCOME BASE',
    L4: 'NETWORK CORE',
  };

  annotateJobCreation(
    job: RepairJob,
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldRepairQueueJobAnnotation {
    const config =
      job.layerId !== 'ALL'
        ? getLayerConfig(job.layerId as ShieldLayerId)
        : null;
    const label =
      job.layerId !== 'ALL'
        ? this.labelMap[job.layerId as ShieldLayerId]
        : 'ALL LAYERS';
    const isEndgame = isEndgamePhase(phase);
    const efficiency = computeRepairEfficiencyMultiplier(mode, phase);
    const effectiveHP = Math.round(job.amount * efficiency);
    const stakes = computeEffectiveStakes(phase, mode);

    const headline = this.buildJobHeadline(job, label, isEndgame, mode);
    const detail = [
      `${label}: queuing ${job.amount}HP repair over ${job.durationTicks} tick${job.durationTicks !== 1 ? 's' : ''}`,
      `(~${job.amountPerTick}HP/tick, efficiency ×${efficiency.toFixed(2)} → effective ${effectiveHP}HP)`,
      config ? `Doctrine: ${config.doctrineName}` : '',
      `Stakes ×${stakes.toFixed(2)} in ${mode}/${phase}`,
      job.tags.length > 0 ? `Tags: [${job.tags.join(', ')}]` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const uxHint = this.buildJobUXHint(job, layers, mode, phase);

    return {
      tick: job.tick,
      jobId: job.jobId,
      layerId: job.layerId,
      amount: job.amount,
      durationTicks: job.durationTicks,
      source: job.source,
      tags: job.tags,
      headline,
      detail,
      uxHint,
    };
  }

  annotateJobCompletion(
    job: RepairJob,
    tick: number,
  ): ShieldRepairQueueCompletionAnnotation {
    const label =
      job.layerId !== 'ALL'
        ? this.labelMap[job.layerId as ShieldLayerId]
        : 'ALL LAYERS';
    const deliveredPct =
      job.amount > 0 ? Math.round((job.delivered / job.amount) * 100) : 100;

    return {
      tick,
      jobId: job.jobId,
      layerId: job.layerId,
      totalDelivered: job.delivered,
      headline: `Repair complete — ${label} received ${job.delivered}HP (${deliveredPct}% of target)`,
      uxHint:
        deliveredPct >= 100
          ? `Full repair delivered to ${label}`
          : `Partial repair delivered to ${label} — consider queuing additional job`,
    };
  }

  buildAnnotationBundle(
    tick: number,
    jobs: readonly RepairJob[],
    layers: readonly ShieldLayerState[],
    newJobs: readonly RepairJob[],
    completedJobs: readonly RepairJob[],
    rejections: readonly QueueRejection[],
    deliveries: readonly PendingRepairSlice[],
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldRepairQueueAnnotationBundle {
    const jobCreations = newJobs.map((j) =>
      this.annotateJobCreation(j, layers, mode, phase),
    );
    const jobCompletions = completedJobs.map((j) =>
      this.annotateJobCompletion(j, tick),
    );

    const rejectionEvents = rejections.map(
      (r) =>
        `Rejected repair for ${r.layerId}: ${r.amount}HP (queue full) at tick ${r.tick}`,
    );

    const deliveryEvents = deliveries.map((s) => {
      const label =
        s.layerId !== 'ALL'
          ? this.labelMap[s.layerId as ShieldLayerId]
          : 'ALL LAYERS';
      return `Delivered ${s.amount.toFixed(0)}HP to ${label}${s.completed ? ' (job complete)' : ''}`;
    });

    const overallHeadline = buildRepairQueueUXHeadline(
      jobs,
      layers,
      mode,
      phase,
    );
    const uxSummary = this.buildTickUXSummary(
      jobs,
      layers,
      jobCreations.length,
      jobCompletions.length,
      rejections.length,
      mode,
      phase,
    );

    return {
      tick,
      jobCreations,
      jobCompletions,
      rejectionEvents,
      deliveryEvents,
      overallHeadline,
      uxSummary,
    };
  }

  buildUXHint(
    jobs: readonly RepairJob[],
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldRepairQueueUXHint {
    const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
    const urgencyLabel = classifyRepairQueueUrgency(urgency);
    const channel = getRepairQueueChatChannel(urgency);
    const headline = buildRepairQueueUXHeadline(jobs, layers, mode, phase);
    const priorityLayers = findRepairPriorityLayers(layers, jobs);
    const utilization = computeOverallUtilization(jobs);

    const subtext =
      priorityLayers.length > 0
        ? `${this.labelMap[priorityLayers[0]!]} needs immediate repair — below warning threshold`
        : utilization >= SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD
          ? 'Queue near capacity — existing jobs will complete soon'
          : 'All layers receiving adequate repair coverage';

    const actionPrompt = this.buildActionPrompt(
      urgency,
      utilization,
      priorityLayers,
      mode,
      phase,
    );
    const weakestId = priorityLayers[0] ?? null;

    return {
      layerId: weakestId,
      urgency: urgencyLabel,
      headline,
      subtext,
      actionPrompt,
      chatChannel: channel,
    };
  }

  private buildJobHeadline(
    job: RepairJob,
    label: string,
    isEndgame: boolean,
    mode: ModeCode,
  ): string {
    const sourceTag =
      job.source === 'CARD'
        ? '(card)'
        : job.source === 'ADMIN'
          ? '(admin)'
          : '(system)';
    if (isEndgame && job.layerId === 'L4') {
      return `SOVEREIGNTY REPAIR QUEUED — ${label} recovery initiated ${sourceTag}`;
    }
    if (mode === 'ghost' && (job.layerId === 'L3' || job.layerId === 'L4')) {
      return `Ghost mode repair queued — ${label} echo-chain recovery ${sourceTag}`;
    }
    return `Repair queued — ${label} receiving ${job.amount}HP ${sourceTag}`;
  }

  private buildJobUXHint(
    job: RepairJob,
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
  ): string {
    if (job.layerId === 'L4') {
      return phase === 'SOVEREIGNTY'
        ? 'CRITICAL: L4 repair underway — sovereignty fatality risk reduced while this job runs'
        : 'L4 (NETWORK CORE) repair queued — cascade gate will recover over time';
    }
    const urgency = computeRepairQueueUrgency(job.layerId !== 'ALL' ? [] : [], layers, mode, phase);
    if (urgency >= 0.7) {
      return 'High urgency repair — shield under active attack pressure';
    }
    return `Repair delivering ~${job.amountPerTick}HP/tick`;
  }

  private buildTickUXSummary(
    jobs: readonly RepairJob[],
    layers: readonly ShieldLayerState[],
    newCount: number,
    completedCount: number,
    rejectedCount: number,
    mode: ModeCode,
    phase: RunPhase,
  ): string {
    const utilization = Math.round(computeOverallUtilization(jobs) * 100);
    const totalPending = computeTotalPendingHp(jobs).toFixed(0);
    const urgency = computeRepairQueueUrgency(jobs, layers, mode, phase);
    let summary = `Queue at ${utilization}% capacity, ${totalPending}HP pending`;
    if (newCount > 0)
      summary += `, ${newCount} new job${newCount > 1 ? 's' : ''}`;
    if (completedCount > 0)
      summary += `, ${completedCount} completed`;
    if (rejectedCount > 0)
      summary += `, ${rejectedCount} rejected`;
    summary += ` (urgency ${Math.round(urgency * 100)}%)`;
    return summary;
  }

  private buildActionPrompt(
    urgency: number,
    utilization: number,
    priorityLayers: readonly ShieldLayerId[],
    mode: ModeCode,
    phase: RunPhase,
  ): string | null {
    if (urgency >= SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD) {
      return 'Play RESCUE card now — critical repair urgency';
    }
    if (
      utilization >= SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION
    ) {
      return 'Queue full — wait for active jobs to complete';
    }
    if (priorityLayers.length > 0) {
      const label = this.labelMap[priorityLayers[0]!];
      return `Queue repair for ${label} this tick`;
    }
    if (phase === 'SOVEREIGNTY' && mode === 'ghost') {
      return 'Ghost+Sovereignty: keep all layers above 30% — queue top-up repairs';
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — ShieldRepairQueueInspector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces a full diagnostic snapshot of the repair queue at a given tick.
 */
export class ShieldRepairQueueInspector {
  private readonly mlExtractor = new ShieldRepairQueueMLExtractor();
  private historyDepth = 0;

  setHistoryDepth(depth: number): void {
    this.historyDepth = depth;
  }

  inspect(
    jobs: readonly RepairJob[],
    mode: ModeCode,
    phase: RunPhase,
    tick: number,
    totalDelivered: number,
    totalQueued: number,
    rejectionCount: number,
    completionCount: number,
  ): ShieldRepairQueueInspectorState {
    const activeJobs = jobs.filter((j) => j.ticksRemaining > 0);
    const queueDepth = activeJobs.length;
    const totalPendingHp = computeTotalPendingHp(activeJobs);
    const overallUtilization = computeOverallUtilization(activeJobs);
    const activeJobCountPerLayer = computeActiveJobCountPerLayer(activeJobs);
    const pendingHpPerLayer = computePendingHpPerLayer(activeJobs);
    const progressRatioPerLayer = computeProgressRatioPerLayer(activeJobs);
    const overflowRiskPerLayer = buildOverflowRiskMap(activeJobs);
    const layerConfigMap = buildRepairLayerConfigMap();

    const mlVector = this.mlExtractor.extractVector({
      jobs: activeJobs,
      mode,
      phase,
      totalDelivered,
      totalQueued,
      rejectionCount,
      completionCount,
    });

    return {
      tick,
      activeJobs,
      queueDepth,
      totalPendingHp,
      overallUtilization,
      activeJobCountPerLayer,
      pendingHpPerLayer,
      progressRatioPerLayer,
      overflowRiskPerLayer,
      historyDepth: this.historyDepth,
      mlVector,
      layerConfigMap,
    };
  }

  inspectFromSnapshot(
    snapshot: RunStateSnapshot,
    jobs: readonly RepairJob[],
    totalDelivered: number,
    totalQueued: number,
    rejectionCount: number,
    completionCount: number,
  ): ShieldRepairQueueInspectorState {
    return this.inspect(
      jobs,
      snapshot.mode,
      snapshot.phase,
      snapshot.tick,
      totalDelivered,
      totalQueued,
      rejectionCount,
      completionCount,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — ShieldRepairQueueAnalytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregates session-level analytics for the repair queue.
 */
export class ShieldRepairQueueAnalytics {
  private totalJobsCreated = 0;
  private totalJobsCompleted = 0;
  private totalJobsRejected = 0;
  private totalHpQueued = 0;
  private totalHpDelivered = 0;
  private totalJobDurationTicks = 0;
  private utilizationHistory: number[] = [];
  private peakQueueDepth = 0;
  private jobCountPerLayer: Record<ShieldLayerId, number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
  };
  private deliveredHpPerLayer: Record<ShieldLayerId, number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
  };
  private rejectionCountPerLayer: Record<ShieldLayerId, number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
  };
  private overflowEventCount = 0;

  recordJobCreated(job: RepairJob): void {
    this.totalJobsCreated++;
    this.totalHpQueued += job.amount;
    const layers =
      job.layerId === 'ALL'
        ? [...SHIELD_LAYER_ORDER]
        : [job.layerId as ShieldLayerId];
    for (const id of layers) {
      this.jobCountPerLayer[id] = (this.jobCountPerLayer[id] ?? 0) + 1;
    }
  }

  recordJobCompleted(job: RepairJob): void {
    this.totalJobsCompleted++;
    this.totalHpDelivered += job.delivered;
    this.totalJobDurationTicks += job.durationTicks;
    const layers =
      job.layerId === 'ALL'
        ? [...SHIELD_LAYER_ORDER]
        : [job.layerId as ShieldLayerId];
    for (const id of layers) {
      this.deliveredHpPerLayer[id] =
        (this.deliveredHpPerLayer[id] ?? 0) + job.delivered;
    }
  }

  recordRejection(rejection: QueueRejection): void {
    this.totalJobsRejected++;
    const layers =
      rejection.layerId === 'ALL'
        ? [...SHIELD_LAYER_ORDER]
        : [rejection.layerId as ShieldLayerId];
    for (const id of layers) {
      this.rejectionCountPerLayer[id] =
        (this.rejectionCountPerLayer[id] ?? 0) + 1;
    }
  }

  recordTick(queueDepth: number, utilization: number, overflow: boolean): void {
    this.peakQueueDepth = Math.max(this.peakQueueDepth, queueDepth);
    this.utilizationHistory.push(utilization);
    if (this.utilizationHistory.length > SHIELD_REPAIR_QUEUE_HISTORY_DEPTH) {
      this.utilizationHistory.shift();
    }
    if (overflow) this.overflowEventCount++;
  }

  buildSummary(): ShieldRepairQueueAnalyticsSummary {
    const avgUtilization =
      this.utilizationHistory.length > 0
        ? this.utilizationHistory.reduce((a, b) => a + b, 0) /
          this.utilizationHistory.length
        : 0;
    const avgDuration =
      this.totalJobsCompleted > 0
        ? this.totalJobDurationTicks / this.totalJobsCompleted
        : 0;

    return {
      totalJobsCreated: this.totalJobsCreated,
      totalJobsCompleted: this.totalJobsCompleted,
      totalJobsRejected: this.totalJobsRejected,
      totalHpQueued: this.totalHpQueued,
      totalHpDelivered: this.totalHpDelivered,
      averageJobDuration: avgDuration,
      averageUtilization: avgUtilization,
      peakQueueDepth: this.peakQueueDepth,
      jobCountPerLayer: { ...this.jobCountPerLayer },
      deliveredHpPerLayer: { ...this.deliveredHpPerLayer },
      rejectionCountPerLayer: { ...this.rejectionCountPerLayer },
      overflowEventCount: this.overflowEventCount,
    };
  }

  reset(): void {
    this.totalJobsCreated = 0;
    this.totalJobsCompleted = 0;
    this.totalJobsRejected = 0;
    this.totalHpQueued = 0;
    this.totalHpDelivered = 0;
    this.totalJobDurationTicks = 0;
    this.utilizationHistory = [];
    this.peakQueueDepth = 0;
    this.jobCountPerLayer = { L1: 0, L2: 0, L3: 0, L4: 0 };
    this.deliveredHpPerLayer = { L1: 0, L2: 0, L3: 0, L4: 0 };
    this.rejectionCountPerLayer = { L1: 0, L2: 0, L3: 0, L4: 0 };
    this.overflowEventCount = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — Factory functions and ensemble builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a fully wired ShieldRepairQueueEnsemble with all companion classes.
 */
export function createShieldRepairQueueWithAnalytics(): ShieldRepairQueueEnsemble {
  return {
    queue: new ShieldRepairQueue(),
    mlExtractor: new ShieldRepairQueueMLExtractor(),
    dlBuilder: new ShieldRepairQueueDLBuilder(),
    trendAnalyzer: new ShieldRepairQueueTrendAnalyzer(),
    forecaster: new ShieldRepairQueueForecaster(),
    annotator: new ShieldRepairQueueAnnotator(),
    inspector: new ShieldRepairQueueInspector(),
    analytics: new ShieldRepairQueueAnalytics(),
  };
}

/**
 * Build a one-shot session report for a completed run.
 */
export function buildShieldRepairQueueSessionReport(
  runId: string,
  finalTick: number,
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  analytics: ShieldRepairQueueAnalytics,
  trendAnalyzer: ShieldRepairQueueTrendAnalyzer,
  forecaster: ShieldRepairQueueForecaster,
  mlExtractor: ShieldRepairQueueMLExtractor,
  totalDelivered: number,
  totalQueued: number,
  rejectionCount: number,
  completionCount: number,
): ShieldRepairQueueSessionReport {
  return {
    runId,
    finalTick,
    analytics: analytics.buildSummary(),
    finalMLVector: mlExtractor.extractVector({
      jobs,
      mode,
      phase,
      totalDelivered,
      totalQueued,
      rejectionCount,
      completionCount,
    }),
    trendSummary: trendAnalyzer.computeSummary(finalTick),
    capacityForecast: forecaster.forecastAll(layers, jobs, mode, phase, finalTick),
  };
}

/**
 * Build an enqueue result object from a created job.
 */
export function buildEnqueueAccepted(job: RepairJob): ShieldRepairQueueEnqueueResult {
  return { accepted: true, job };
}

/**
 * Build an enqueue result object from a rejected input.
 */
export function buildEnqueueRejected(
  tick: number,
  layerId: RepairLayerId,
  amount: number,
  durationTicks: number,
  source: RepairJob['source'],
): ShieldRepairQueueEnqueueResult {
  const rejection: QueueRejection = { tick, layerId, amount, durationTicks, source };
  return { accepted: false, rejection };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — ShieldRepairQueue — enhanced repair queue (production)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The authoritative shield repair queue.
 *
 * Manages all repair job lifecycle in a deterministic, replay-safe way:
 * - `enqueue` — add a new repair job (or reject if queue is full)
 * - `enqueueWithResult` — enqueue and return a typed result object
 * - `due` — tick forward and collect all pending repair slices
 * - `dueWithModeAdjustment` — tick with mode/phase efficiency applied
 * - `size` — active job count
 * - `activeCount` — active count for a specific layer
 * - `getActiveJobs` — snapshot of all active jobs
 * - `reset` — clear all jobs
 * - `hasCapacity` — check whether a layer can accept new jobs
 * - `peekNextDelivery` — preview what would be delivered next tick
 * - `totalPendingHp` — total HP pending across all active jobs
 * - `getPendingHpForLayer` — pending HP for a specific layer
 * - `getJobById` — look up a job by jobId
 * - `cancelJob` — remove a specific job from the queue
 * - `drainLayer` — cancel all jobs for a specific layer
 * - `computeUtilization` — current queue utilization (0-1)
 * - `computeRepairCoverage` — coverage ratio against current layer deficits
 * - `buildQueueSnapshot` — full state snapshot for telemetry
 * - `buildDeliveryReport` — per-layer delivery summary for this tick
 * - `scoreQueueHealth` — overall queue health score (0-1)
 * - `validateQueueConsistency` — runtime invariant checks
 * - `computeModeAdjustedDelivery` — HP/tick with mode/phase multiplier
 * - `buildTickEventSummary` — rich tick event log entry
 */
export class ShieldRepairQueue {
  private jobs: RepairJob[] = [];
  private rejectionHistory: QueueRejection[] = [];

  // ── Core job lifecycle ───────────────────────────────────────────────────

  /**
   * Enqueue a repair job. Returns the created job or null if rejected.
   * Rejection occurs when any targeted layer's queue is at max capacity.
   */
  public enqueue(input: {
    readonly tick: number;
    readonly layerId: RepairLayerId;
    readonly amount: number;
    readonly durationTicks?: number;
    readonly jobId?: string;
    readonly source?: RepairJob['source'];
    readonly tags?: readonly string[];
  }): RepairJob | null {
    const amount = Math.max(0, Math.round(input.amount));
    const durationTicks = Math.max(1, Math.round(input.durationTicks ?? 1));

    if (amount <= 0) return null;

    const blockedLayers =
      input.layerId === 'ALL' ? SHIELD_LAYER_ORDER : [input.layerId as ShieldLayerId];

    const wouldOverflow = blockedLayers.some(
      (layerId) =>
        this.activeCount(layerId) >= SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER,
    );

    if (wouldOverflow) {
      const rejection: QueueRejection = {
        tick: input.tick,
        layerId: input.layerId,
        amount,
        durationTicks,
        source: input.source ?? 'CARD',
      };
      this.rejectionHistory.push(rejection);
      if (this.rejectionHistory.length > SHIELD_REPAIR_QUEUE_REJECTION_HISTORY_DEPTH) {
        this.rejectionHistory.shift();
      }
      return null;
    }

    const normalizedTags = normalizeShieldNoteTags(input.tags ?? []);
    const job: RepairJob = {
      jobId: input.jobId ?? randomUUID(),
      tick: input.tick,
      layerId: input.layerId,
      amount,
      durationTicks,
      amountPerTick: Math.ceil(amount / durationTicks),
      createdAtTick: input.tick,
      source: input.source ?? 'CARD',
      tags: Object.freeze([...normalizedTags]),
      ticksRemaining: durationTicks,
      delivered: 0,
    };

    this.jobs = [...this.jobs, job];
    return job;
  }

  /**
   * Enqueue with a typed result that includes the rejection record on failure.
   */
  public enqueueWithResult(input: {
    readonly tick: number;
    readonly layerId: RepairLayerId;
    readonly amount: number;
    readonly durationTicks?: number;
    readonly jobId?: string;
    readonly source?: RepairJob['source'];
    readonly tags?: readonly string[];
  }): ShieldRepairQueueEnqueueResult {
    const job = this.enqueue(input);
    if (job !== null) {
      return buildEnqueueAccepted(job);
    }
    return buildEnqueueRejected(
      input.tick,
      input.layerId,
      Math.max(0, Math.round(input.amount)),
      Math.max(1, Math.round(input.durationTicks ?? 1)),
      input.source ?? 'CARD',
    );
  }

  /**
   * Advance the queue by one tick and return all pending repair slices due now.
   * Completed jobs are removed from the queue.
   */
  public due(currentTick: number): readonly PendingRepairSlice[] {
    const slices: PendingRepairSlice[] = [];

    this.jobs = this.jobs
      .map((job) => {
        if (currentTick < job.tick || job.ticksRemaining <= 0) return job;

        const remaining = Math.max(0, job.amount - job.delivered);
        const amount = Math.min(job.amountPerTick, remaining);

        if (amount <= 0) {
          job.ticksRemaining = 0;
          return job;
        }

        job.delivered += amount;
        job.ticksRemaining -= 1;

        slices.push({
          jobId: job.jobId,
          layerId: job.layerId,
          amount,
          completed:
            job.ticksRemaining <= 0 || job.delivered >= job.amount,
          sourceTick: job.tick,
        });

        return job;
      })
      .filter((job) => job.ticksRemaining > 0 && job.delivered < job.amount);

    return Object.freeze([...slices]);
  }

  /**
   * Advance the queue with a mode/phase efficiency multiplier applied to delivery.
   * Returns both slices and updated layer states (if layers provided).
   */
  public dueWithModeAdjustment(
    currentTick: number,
    mode: ModeCode,
    phase: RunPhase,
    layers: readonly ShieldLayerState[],
  ): {
    readonly slices: readonly PendingRepairSlice[];
    readonly updatedLayers: readonly ShieldLayerState[];
    readonly totalDelivered: number;
  } {
    const rawSlices = this.due(currentTick);
    const efficiency = computeRepairEfficiencyMultiplier(mode, phase);
    let totalDelivered = 0;

    // Apply efficiency multiplier to slice amounts and update layer states
    let updatedLayers = [...layers];

    const adjustedSlices = rawSlices.map((slice) => {
      const adjustedAmount = Math.round(slice.amount * efficiency);
      totalDelivered += adjustedAmount;

      // Apply to layer state
      updatedLayers = updatedLayers.map((layer) => {
        const shouldApply =
          slice.layerId === 'ALL' || layer.layerId === slice.layerId;
        if (!shouldApply) return layer;
        return applyRepairToLayerState(layer, adjustedAmount, currentTick);
      });

      return { ...slice, amount: adjustedAmount };
    });

    return {
      slices: Object.freeze(adjustedSlices),
      updatedLayers: Object.freeze(updatedLayers),
      totalDelivered,
    };
  }

  // ── Derived state queries ────────────────────────────────────────────────

  /** Return the total number of active jobs in the queue. */
  public size(): number {
    return this.jobs.length;
  }

  /** Return the count of active jobs for a specific layer. */
  public activeCount(layerId: ShieldLayerId): number {
    return this.jobs.filter((job) => {
      if (job.ticksRemaining <= 0) return false;
      return job.layerId === 'ALL' || job.layerId === layerId;
    }).length;
  }

  /** Return a frozen snapshot of all active jobs. */
  public getActiveJobs(): readonly RepairJob[] {
    return Object.freeze(
      this.jobs.map((job) => ({
        ...job,
        tags: Object.freeze([...job.tags]),
      })),
    );
  }

  /** Return the recent rejection history. */
  public getRejectionHistory(): readonly QueueRejection[] {
    return Object.freeze([...this.rejectionHistory]);
  }

  /** Check whether a specific layer can accept a new job. */
  public hasCapacity(layerId: RepairLayerId): boolean {
    const blockedLayers =
      layerId === 'ALL' ? SHIELD_LAYER_ORDER : [layerId as ShieldLayerId];
    return blockedLayers.every(
      (id) => this.activeCount(id) < SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER,
    );
  }

  /** Preview what would be delivered next tick without advancing state. */
  public peekNextDelivery(currentTick: number): readonly PendingRepairSlice[] {
    const previews: PendingRepairSlice[] = [];
    for (const job of this.jobs) {
      if (currentTick < job.tick || job.ticksRemaining <= 0) continue;
      const remaining = Math.max(0, job.amount - job.delivered);
      const amount = Math.min(job.amountPerTick, remaining);
      if (amount <= 0) continue;
      previews.push({
        jobId: job.jobId,
        layerId: job.layerId,
        amount,
        completed:
          job.ticksRemaining <= 1 || job.delivered + amount >= job.amount,
        sourceTick: job.tick,
      });
    }
    return Object.freeze(previews);
  }

  /** Compute total pending HP across all active jobs. */
  public totalPendingHp(): number {
    return computeTotalPendingHp(this.jobs);
  }

  /** Get pending HP for a specific layer. */
  public getPendingHpForLayer(layerId: ShieldLayerId): number {
    const pendingMap = computePendingHpPerLayer(this.jobs);
    return pendingMap[layerId] ?? 0;
  }

  /** Find a job by its jobId. */
  public getJobById(jobId: string): RepairJob | null {
    return this.jobs.find((j) => j.jobId === jobId) ?? null;
  }

  /** Cancel a specific job by its jobId. Returns true if found and removed. */
  public cancelJob(jobId: string): boolean {
    const before = this.jobs.length;
    this.jobs = this.jobs.filter((j) => j.jobId !== jobId);
    return this.jobs.length < before;
  }

  /** Cancel all jobs targeting a specific layer. Returns count of cancelled jobs. */
  public drainLayer(layerId: RepairLayerId): number {
    const before = this.jobs.length;
    this.jobs = this.jobs.filter((j) => j.layerId !== layerId);
    return before - this.jobs.length;
  }

  /** Compute current overall queue utilization (0-1). */
  public computeUtilization(): number {
    return computeOverallUtilization(this.jobs);
  }

  /** Compute repair coverage ratio against current layer deficits. */
  public computeRepairCoverage(layers: readonly ShieldLayerState[]): number {
    return scoreRepairCoverageRatio(this.jobs, layers);
  }

  /**
   * Score the overall queue health (0-1). Higher = healthier.
   * Factors: available capacity (inverse utilization), overflow risk count,
   * and low-throughput penalty when delivery rates fall below the floor.
   */
  public scoreQueueHealth(): number {
    const utilization = computeOverallUtilization(this.jobs);
    const overflowCount = SHIELD_LAYER_ORDER.filter((id) =>
      isLayerAtOverflowRisk(this.jobs, id),
    ).length;
    const overflowPenalty = overflowCount * 0.15;
    const deliveryRates = computeDeliveryRatePerLayer(this.jobs);
    const lowThroughputRisk = computeLowThroughputRisk(deliveryRates);
    const throughputPenalty = lowThroughputRisk * 0.10;
    return Math.max(0, 1 - utilization * 0.65 - overflowPenalty - throughputPenalty);
  }

  /**
   * Returns all layer IDs where the active HP/tick delivery rate is below
   * SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD. Empty array = no stall.
   */
  public computeLowThroughputLayers(): ShieldLayerId[] {
    return findLowThroughputLayerIds(this.jobs);
  }

  /**
   * Build a full per-layer throughput health map (0-1 per layer).
   * Values below 1.0 indicate under-performing repair delivery.
   */
  public buildThroughputHealthMap(): Readonly<Record<ShieldLayerId, number>> {
    return computePerLayerThroughputHealth(this.jobs);
  }

  /**
   * Build the per-layer repair risk vector (0-1 per layer).
   * 1.0 = fully breached with no pending repair coverage.
   */
  public buildRepairRiskVector(layers: readonly ShieldLayerState[]): Readonly<Record<ShieldLayerId, number>> {
    return buildRepairRiskVector(layers, this.jobs);
  }

  /**
   * Score how well active repair jobs align with the most threatened doctrine
   * layers. Returns 0-1 where 1 = perfect alignment.
   */
  public scoreDoctrineAlignment(layers: readonly ShieldLayerState[]): number {
    return scoreRepairDoctrineAlignment(this.jobs, layers);
  }

  /**
   * Compute the overall repair stress score incorporating urgency, throughput
   * risk, utilization, and pressure tier.
   */
  public computeStressScore(
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
    pressureTier: PressureTier,
  ): number {
    return computeRepairQueueStressScore(this.jobs, layers, mode, phase, pressureTier);
  }

  /**
   * Estimate ticks until a specific layer reaches full HP given current jobs
   * and mode/phase efficiency. Returns null if no jobs target that layer.
   */
  public estimateTicksToLayerRepair(
    layerId: ShieldLayerId,
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
  ): number | null {
    const layer = layers.find((l) => l.layerId === layerId);
    if (!layer) return null;
    return estimateTicksToFullRepair(layerId, layer, this.jobs, mode, phase);
  }

  /**
   * Build a rich repair posture summary for telemetry and chat adapter ingress.
   * Includes throughput health, risk vector, doctrine alignment, and stress score.
   */
  public buildRepairPostureSummary(
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
    pressureTier: PressureTier,
  ): {
    readonly queueHealth: number;
    readonly stressScore: number;
    readonly doctrineAlignment: number;
    readonly lowThroughputLayers: readonly ShieldLayerId[];
    readonly throughputHealthMap: Readonly<Record<ShieldLayerId, number>>;
    readonly repairRiskVector: Readonly<Record<ShieldLayerId, number>>;
    readonly coverageRatio: number;
    readonly utilization: number;
    readonly priorityLayers: readonly ShieldLayerId[];
  } {
    return {
      queueHealth: this.scoreQueueHealth(),
      stressScore: this.computeStressScore(layers, mode, phase, pressureTier),
      doctrineAlignment: this.scoreDoctrineAlignment(layers),
      lowThroughputLayers: this.computeLowThroughputLayers(),
      throughputHealthMap: this.buildThroughputHealthMap(),
      repairRiskVector: this.buildRepairRiskVector(layers),
      coverageRatio: this.computeRepairCoverage(layers),
      utilization: this.computeUtilization(),
      priorityLayers: findRepairPriorityLayers(layers, this.jobs),
    };
  }

  /** Validate queue state invariants. Throws if any job is in an invalid state. */
  public validateQueueConsistency(): void {
    for (const job of this.jobs) {
      if (job.delivered < 0 || job.delivered > job.amount) {
        throw new Error(
          `RepairJob ${job.jobId}: delivered (${job.delivered}) out of range [0, ${job.amount}]`,
        );
      }
      if (job.ticksRemaining < 0) {
        throw new Error(
          `RepairJob ${job.jobId}: ticksRemaining (${job.ticksRemaining}) is negative`,
        );
      }
      if (job.amountPerTick <= 0) {
        throw new Error(
          `RepairJob ${job.jobId}: amountPerTick (${job.amountPerTick}) is not positive`,
        );
      }
    }
  }

  /**
   * Compute mode-adjusted HP/tick for a given job.
   * Returns what would actually be delivered each tick given mode/phase efficiency.
   */
  public computeModeAdjustedDelivery(
    job: RepairJob,
    mode: ModeCode,
    phase: RunPhase,
  ): number {
    const efficiency = computeRepairEfficiencyMultiplier(mode, phase);
    return Math.max(0, Math.round(job.amountPerTick * efficiency));
  }

  /**
   * Build a full queue state snapshot for telemetry and inspection.
   */
  public buildQueueSnapshot(
    tick: number,
    mode: ModeCode,
    phase: RunPhase,
  ): {
    readonly tick: number;
    readonly queueDepth: number;
    readonly totalPendingHp: number;
    readonly utilization: number;
    readonly activeCountPerLayer: Readonly<Record<ShieldLayerId, number>>;
    readonly pendingHpPerLayer: Readonly<Record<ShieldLayerId, number>>;
    readonly overflowRiskPerLayer: Readonly<Record<ShieldLayerId, boolean>>;
    readonly health: number;
    readonly description: string;
  } {
    const activeJobs = this.jobs.filter((j) => j.ticksRemaining > 0);
    return {
      tick,
      queueDepth: activeJobs.length,
      totalPendingHp: computeTotalPendingHp(activeJobs),
      utilization: computeOverallUtilization(activeJobs),
      activeCountPerLayer: computeActiveJobCountPerLayer(activeJobs),
      pendingHpPerLayer: computePendingHpPerLayer(activeJobs),
      overflowRiskPerLayer: buildOverflowRiskMap(activeJobs),
      health: this.scoreQueueHealth(),
      description: describeRepairQueueState(activeJobs, mode, phase),
    };
  }

  /**
   * Build a per-layer delivery report for the most recent tick.
   */
  public buildDeliveryReport(
    slices: readonly PendingRepairSlice[],
    mode: ModeCode,
    phase: RunPhase,
  ): {
    readonly perLayer: Readonly<Record<ShieldLayerId, number>>;
    readonly total: number;
    readonly efficiency: number;
    readonly completedJobIds: readonly string[];
  } {
    const perLayer: Record<string, number> = {
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
    };
    let total = 0;
    const completedJobIds: string[] = [];
    const efficiency = computeRepairEfficiencyMultiplier(mode, phase);

    for (const slice of slices) {
      const layers =
        slice.layerId === 'ALL'
          ? [...SHIELD_LAYER_ORDER]
          : [slice.layerId as ShieldLayerId];
      for (const id of layers) {
        perLayer[id] = (perLayer[id] ?? 0) + slice.amount;
      }
      total += slice.amount;
      if (slice.completed) completedJobIds.push(slice.jobId);
    }

    return {
      perLayer: perLayer as Record<ShieldLayerId, number>,
      total,
      efficiency,
      completedJobIds,
    };
  }

  /**
   * Build a tick event summary for telemetry and chat adapter ingress.
   */
  public buildTickEventSummary(params: {
    readonly tick: number;
    readonly slices: readonly PendingRepairSlice[];
    readonly newJobs: readonly RepairJob[];
    readonly rejections: readonly QueueRejection[];
    readonly mode: ModeCode;
    readonly phase: RunPhase;
    readonly layers: readonly ShieldLayerState[];
    readonly threats: readonly ThreatEnvelope[];
    readonly botStates: Readonly<Record<HaterBotId, BotState>>;
    readonly attacks?: readonly AttackEvent[];
  }): {
    readonly tick: number;
    readonly headline: string;
    readonly detail: string;
    readonly urgency: number;
    readonly utilization: number;
    readonly totalDelivered: number;
    readonly newJobCount: number;
    readonly rejectedCount: number;
    readonly overflowLayerIds: readonly ShieldLayerId[];
    readonly repairUrgency: number;
    readonly botThreatScore: number;
    readonly threatPressure: number;
    readonly incomingAttackCount: number;
  } {
    const {
      tick,
      slices,
      newJobs,
      rejections,
      mode,
      phase,
      layers,
      threats,
      botStates,
      attacks = [],
    } = params;

    const urgency = computeRepairQueueUrgency(this.jobs, layers, mode, phase);
    const utilization = computeOverallUtilization(this.jobs);
    const totalDelivered = slices.reduce((s, sl) => s + sl.amount, 0);
    const overflowLayerIds = SHIELD_LAYER_ORDER.filter((id) =>
      isLayerAtOverflowRisk(this.jobs, id),
    );
    const botThreatScore = computeRepairBotThreatContribution(botStates);
    const threatPressure = computeRepairThreatPressure(threats, tick);

    const incomingAttackCount = attacks.length;
    const headline = buildRepairQueueUXHeadline(this.jobs, layers, mode, phase);
    const detail = [
      `tick=${tick} mode=${mode} phase=${phase}`,
      `utilization=${Math.round(utilization * 100)}%`,
      `delivered=${totalDelivered.toFixed(0)}HP`,
      `new_jobs=${newJobs.length}`,
      `rejected=${rejections.length}`,
      `overflow=[${overflowLayerIds.join(',')}]`,
      `bot_threat=${Math.round(botThreatScore * 100)}%`,
      `threat_pressure=${Math.round(threatPressure * 100)}%`,
      `incoming_attacks=${incomingAttackCount}`,
    ].join(' | ');

    return {
      tick,
      headline,
      detail,
      urgency,
      utilization,
      totalDelivered,
      newJobCount: newJobs.length,
      rejectedCount: rejections.length,
      overflowLayerIds,
      repairUrgency: urgency,
      botThreatScore,
      threatPressure,
      incomingAttackCount,
    };
  }

  /** Reset the queue to empty state. */
  public reset(): void {
    this.jobs = [];
    this.rejectionHistory = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — SHIELD_REPAIR_QUEUE_MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_REPAIR_QUEUE_MANIFEST = Object.freeze({
  module: 'ShieldRepairQueue',
  version: SHIELD_REPAIR_QUEUE_MODULE_VERSION,
  mlFeatureCount: SHIELD_REPAIR_QUEUE_ML_FEATURE_COUNT,
  dlFeatureCount: SHIELD_REPAIR_QUEUE_DL_FEATURE_COUNT,
  dlSequenceLength: SHIELD_REPAIR_QUEUE_DL_SEQUENCE_LENGTH,
  historyDepth: SHIELD_REPAIR_QUEUE_HISTORY_DEPTH,
  trendWindow: SHIELD_REPAIR_QUEUE_TREND_WINDOW,
  forecastMaxHorizon: SHIELD_REPAIR_QUEUE_FORECAST_MAX_HORIZON,
  maxActiveJobsPerLayer: SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER,
  maxHistoryDepth: SHIELD_CONSTANTS.MAX_HISTORY_DEPTH,
  overflowRiskThreshold: SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD,
  criticalUtilization: SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION,
  criticalUrgencyThreshold: SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD,
  layerCount: SHIELD_LAYER_ORDER.length,
  layers: SHIELD_LAYER_ORDER,
  companions: [
    'ShieldRepairQueueMLExtractor',
    'ShieldRepairQueueDLBuilder',
    'ShieldRepairQueueTrendAnalyzer',
    'ShieldRepairQueueForecaster',
    'ShieldRepairQueueAnnotator',
    'ShieldRepairQueueInspector',
    'ShieldRepairQueueAnalytics',
  ],
  factory: 'createShieldRepairQueueWithAnalytics',
  chatAdapterDomain: 'SHIELD_REPAIR_QUEUE',
  ready: SHIELD_REPAIR_QUEUE_READY,
});

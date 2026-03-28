// backend/src/game/engine/zero/RuntimeCheckpointCoordinator.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RuntimeCheckpointCoordinator.ts
 *
 * Doctrine:
 * - zero owns checkpoint policy, core owns checkpoint storage
 * - checkpoints are capture decisions, not engine decisions
 * - retention must stay bounded and deterministic
 * - duplicate captures of the same state/step/reason should collapse instead of
 *   inflating rollback history
 * - restore/rollback operations remain read-only to callers until explicitly
 *   committed by higher orchestration layers
 * - ML/DL analytics surfaces provide first-class checkpoint health observability
 * - checkpoint quality, density, rollback readiness, and retention health are
 *   all measurable and feed into user experience scoring
 */

import { checksumSnapshot, createDeterministicId, deepFrozenClone, stableStringify, cloneJson } from '../core/Deterministic';
import {
  RuntimeCheckpointStore,
  type RuntimeCheckpoint,
  type RuntimeCheckpointReason,
  type RuntimeCheckpointStoreOptions,
} from '../core/RuntimeCheckpointStore';
import {
  // Canonical array sentinels
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  SHIELD_LAYER_IDS,
  HATER_BOT_IDS,
  TIMING_CLASSES,
  DECK_TYPES,
  VISIBILITY_LEVELS,
  INTEGRITY_STATUSES,
  VERIFIED_GRADES,
  SHIELD_LAYER_LABEL_BY_ID,
  // Tier / phase / mode scoring maps
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  MODE_MAX_DIVERGENCE,
  // Shield maps
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  // Timing maps
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASS_URGENCY_DECAY,
  // Bot maps
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_STATE_ALLOWED_TRANSITIONS,
  // Visibility / integrity / grade maps
  VISIBILITY_CONCEALMENT_FACTOR,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  // Card / deck maps
  DECK_TYPE_POWER_LEVEL,
  DECK_TYPE_IS_OFFENSIVE,
  CARD_RARITY_WEIGHT,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  COUNTERABILITY_RESISTANCE_SCORE,
  TARGETING_SPREAD_FACTOR,
  DIVERGENCE_POTENTIAL_NORMALIZED,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type RunOutcome,
  type ShieldLayerId,
  type HaterBotId,
  type TimingClass,
  type DeckType,
  type BotState,
  type Targeting,
  type Counterability,
  type AttackCategory,
  type CardRarity,
  type VerifiedGrade,
  type VisibilityLevel,
  type DivergencePotential,
  type IntegrityStatus,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ============================================================================
// MARK: Original interfaces — checkpoint coordination surface
// ============================================================================

export interface RuntimeCheckpointCoordinatorOptions
  extends RuntimeCheckpointStoreOptions {
  readonly maxRecentIndex?: number;
}

export interface RuntimeCheckpointCaptureOptions {
  readonly capturedAtMs: number;
  readonly step?: TickStep | null;
  readonly traceId?: string | null;
  readonly tags?: readonly string[];
  readonly dedupeAgainstLatest?: boolean;
}

export interface RuntimeCheckpointSummary {
  readonly runId: string;
  readonly count: number;
  readonly latestCheckpointId: string | null;
  readonly latestTick: number | null;
  readonly terminalCheckpointId: string | null;
  readonly reasons: Readonly<Record<RuntimeCheckpointReason, number>>;
}

// ============================================================================
// MARK: Analytics types — ML/DL/chat observability surface
// ============================================================================

/** Checkpoint health severity tier. */
export type CheckpointSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Checkpoint analytics operation kind. */
export type CheckpointOperationKind =
  | 'CAPTURE_RUN_START'
  | 'CAPTURE_STEP_ENTRY'
  | 'CAPTURE_STEP_EXIT'
  | 'CAPTURE_TICK_FINAL'
  | 'CAPTURE_TERMINAL'
  | 'CAPTURE_MANUAL'
  | 'DEDUP_HIT'
  | 'RESTORE_REQUESTED'
  | 'ROLLBACK_CLONE_REQUESTED'
  | 'DELETE_RUN';

/**
 * 32-dimensional ML feature vector for checkpoint analytics.
 * All values normalized to [0, 1].
 */
export interface CheckpointMLVector {
  // Volume features
  checkpoint_count_normalized:     number; // 0
  recent_index_fullness:           number; // 1
  capacity_utilization:            number; // 2
  // Step distribution features
  run_start_ratio:                 number; // 3
  step_entry_ratio:                number; // 4
  step_exit_ratio:                 number; // 5
  tick_final_ratio:                number; // 6
  terminal_ratio:                  number; // 7
  manual_ratio:                    number; // 8
  step_entry_exit_balance:         number; // 9
  // Timing features
  latest_tick_normalized:          number; // 10
  tick_span_normalized:            number; // 11
  capture_rate_per_tick:           number; // 12
  capture_density_early:           number; // 13
  capture_density_late:            number; // 14
  avg_ticks_between:               number; // 15
  // Dedup features
  dedup_efficiency:                number; // 16
  dedup_hit_rate:                  number; // 17
  // Rollback features
  rollback_availability:           number; // 18
  terminal_present:                number; // 19
  restore_readiness:               number; // 20
  recent_window_freshness:         number; // 21
  // Coverage features
  tick_coverage_normalized:        number; // 22
  step_coverage_breadth:           number; // 23
  reasons_diversity:               number; // 24
  // Quality derived features
  checkpoint_quality:              number; // 25
  retention_health:                number; // 26
  capture_consistency:             number; // 27
  tag_density:                     number; // 28
  trace_coverage:                  number; // 29
  checksum_stability:              number; // 30
  overall_health:                  number; // 31
}

/** Single 6-element DL tensor row. */
export interface CheckpointDLTensorRow {
  readonly label: string;
  readonly values: readonly [number, number, number, number, number, number];
}

/** 6×6 DL tensor for checkpoint domain. */
export interface CheckpointDLTensor {
  readonly shape: readonly [6, 6];
  readonly rows: readonly [
    CheckpointDLTensorRow, // CAPTURE_PROFILE
    CheckpointDLTensorRow, // STEP_PROFILE
    CheckpointDLTensorRow, // TIMING_PROFILE
    CheckpointDLTensorRow, // DEDUP_PROFILE
    CheckpointDLTensorRow, // ROLLBACK_PROFILE
    CheckpointDLTensorRow, // HEALTH_COMPOSITE
  ];
  readonly checksum: string;
}

/** Chat-ready signal from checkpoint state. */
export interface CheckpointChatSignal {
  readonly runId: string;
  readonly checkpointCount: number;
  readonly latestTick: number | null;
  readonly severity: CheckpointSeverity;
  readonly healthScore: number;
  readonly terminalPresent: boolean;
  readonly rollbackAvailability: number;
  readonly capacityUtilization: number;
  readonly deduplicatedCount: number;
  readonly mlVector: CheckpointMLVector;
  readonly narrationKey: string;
  readonly emittedAtMs: number;
}

/** Annotation bundle for checkpoint state. */
export interface CheckpointAnnotationBundle {
  readonly runId: string;
  readonly severity: CheckpointSeverity;
  readonly operationsLog: readonly CheckpointOperationKind[];
  readonly healthScore: number;
  readonly mlVector: CheckpointMLVector;
  readonly dlTensor: CheckpointDLTensor;
  readonly narrationHint: string;
  readonly actionRecommendation: string;
  readonly retentionLabel: string;
  readonly rollbackLabel: string;
  readonly archiveId: string;
}

/** Narration hint for checkpoint domain. */
export interface CheckpointNarrationHint {
  readonly key: string;
  readonly phrase: string;
  readonly urgency: CheckpointSeverity;
  readonly checkpointCount: number;
  readonly latestTick: number | null;
}

/** Trend snapshot over recent checkpoint activity. */
export interface CheckpointTrendSnapshot {
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly avgCheckpointCount: number;
  readonly avgCapacityUtilization: number;
  readonly dedupHitRate: number;
  readonly terminalPresenceRate: number;
  readonly healthTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
}

/** Per-session checkpoint analytics report. */
export interface CheckpointSessionReport {
  readonly sessionId: string;
  readonly captureCount: number;
  readonly dedupHitCount: number;
  readonly restoreCount: number;
  readonly rollbackCloneCount: number;
  readonly avgHealthScore: number;
  readonly lastRunId: string | null;
  readonly lastSeverity: CheckpointSeverity;
  readonly startedAtMs: number;
  readonly lastCaptureAtMs: number | null;
}

/** Single event log entry for checkpoint operations. */
export interface CheckpointEventLogEntry {
  readonly entryId: string;
  readonly runId: string;
  readonly operation: CheckpointOperationKind;
  readonly severity: CheckpointSeverity;
  readonly healthScore: number;
  readonly checkpointCount: number;
  readonly tick: number | null;
  readonly recordedAtMs: number;
  readonly checksum: string;
}

/** Inspection bundle — full debug snapshot. */
export interface CheckpointInspectionBundle {
  readonly runId: string;
  readonly summary: RuntimeCheckpointSummary;
  readonly mlVector: CheckpointMLVector;
  readonly dlTensor: CheckpointDLTensor;
  readonly chatSignal: CheckpointChatSignal;
  readonly annotation: CheckpointAnnotationBundle;
  readonly narrationHint: CheckpointNarrationHint;
  readonly healthSnapshot: CheckpointHealthSnapshot;
  readonly operationKinds: readonly CheckpointOperationKind[];
  readonly inspectedAtMs: number;
}

/** Run-level analytics summary. */
export interface CheckpointRunSummary {
  readonly runId: string;
  readonly checkpointCount: number;
  readonly latestTick: number | null;
  readonly terminalPresent: boolean;
  readonly severity: CheckpointSeverity;
  readonly healthScore: number;
  readonly capacityUtilization: number;
  readonly rollbackAvailability: number;
  readonly deduplicatedCount: number;
  readonly reasons: Readonly<Record<RuntimeCheckpointReason, number>>;
}

/** Health snapshot — single-moment checkpoint wellness. */
export interface CheckpointHealthSnapshot {
  readonly runId: string;
  readonly healthScore: number;
  readonly severity: CheckpointSeverity;
  readonly rollbackReadiness: number;
  readonly retentionHealth: number;
  readonly deduplicationHealth: number;
  readonly overallQuality: number;
  readonly capturedAtMs: number;
}

/** Export bundle — all analytics for a checkpoint state. */
export interface CheckpointExportBundle {
  readonly runId: string;
  readonly mlVector: CheckpointMLVector;
  readonly dlTensor: CheckpointDLTensor;
  readonly chatSignal: CheckpointChatSignal;
  readonly annotation: CheckpointAnnotationBundle;
  readonly runSummary: CheckpointRunSummary;
  readonly healthSnapshot: CheckpointHealthSnapshot;
  readonly sessionReport: CheckpointSessionReport;
  readonly trendSnapshot: CheckpointTrendSnapshot;
  readonly exportedAtMs: number;
}

/** Input for standalone ML vector extraction. */
export interface CheckpointMLVectorInput {
  readonly runId: string;
  readonly checkpointCount: number;
  readonly maxRecentIndex: number;
  readonly maxCapacity: number;
  readonly reasons: Readonly<Record<RuntimeCheckpointReason, number>>;
  readonly latestTick: number | null;
  readonly maxTick: number;
  readonly terminalPresent: boolean;
  readonly dedupHitCount: number;
  readonly restoreCount: number;
  readonly recentCheckpointCount: number;
  readonly tracedCheckpointCount: number;
  readonly taggedCheckpointCount: number;
}

/** Full analytics suite for the coordinator. */
export interface RuntimeCheckpointCoordinatorWithAnalytics {
  readonly coordinator: RuntimeCheckpointCoordinator;
  readonly trendAnalyzer: CheckpointCoordinatorTrendAnalyzer;
  readonly sessionTracker: CheckpointCoordinatorSessionTracker;
  readonly eventLog: CheckpointCoordinatorEventLog;
  readonly annotator: CheckpointCoordinatorAnnotator;
  readonly inspector: CheckpointCoordinatorInspector;
}

// ============================================================================
// MARK: CHECKPOINT_* constant re-exports — GamePrimitives through checkpoint lens
// ============================================================================

export const CHECKPOINT_MODE_CODES                           = MODE_CODES;
export const CHECKPOINT_PRESSURE_TIERS                       = PRESSURE_TIERS;
export const CHECKPOINT_RUN_PHASES                           = RUN_PHASES;
export const CHECKPOINT_RUN_OUTCOMES                         = RUN_OUTCOMES;
export const CHECKPOINT_SHIELD_LAYER_IDS                     = SHIELD_LAYER_IDS;
export const CHECKPOINT_HATER_BOT_IDS                        = HATER_BOT_IDS;
export const CHECKPOINT_TIMING_CLASSES                       = TIMING_CLASSES;
export const CHECKPOINT_DECK_TYPES                           = DECK_TYPES;
export const CHECKPOINT_VISIBILITY_LEVELS                    = VISIBILITY_LEVELS;
export const CHECKPOINT_INTEGRITY_STATUSES                   = INTEGRITY_STATUSES;
export const CHECKPOINT_VERIFIED_GRADES                      = VERIFIED_GRADES;
export const CHECKPOINT_SHIELD_LAYER_LABEL_BY_ID             = SHIELD_LAYER_LABEL_BY_ID;
export const CHECKPOINT_PRESSURE_TIER_NORMALIZED             = PRESSURE_TIER_NORMALIZED;
export const CHECKPOINT_PRESSURE_TIER_URGENCY_LABEL          = PRESSURE_TIER_URGENCY_LABEL;
export const CHECKPOINT_PRESSURE_TIER_MIN_HOLD_TICKS         = PRESSURE_TIER_MIN_HOLD_TICKS;
export const CHECKPOINT_PRESSURE_TIER_ESCALATION_THRESHOLD   = PRESSURE_TIER_ESCALATION_THRESHOLD;
export const CHECKPOINT_PRESSURE_TIER_DEESCALATION_THRESHOLD = PRESSURE_TIER_DEESCALATION_THRESHOLD;
export const CHECKPOINT_RUN_PHASE_NORMALIZED                 = RUN_PHASE_NORMALIZED;
export const CHECKPOINT_RUN_PHASE_STAKES_MULTIPLIER          = RUN_PHASE_STAKES_MULTIPLIER;
export const CHECKPOINT_RUN_PHASE_TICK_BUDGET_FRACTION       = RUN_PHASE_TICK_BUDGET_FRACTION;
export const CHECKPOINT_MODE_NORMALIZED                      = MODE_NORMALIZED;
export const CHECKPOINT_MODE_DIFFICULTY_MULTIPLIER           = MODE_DIFFICULTY_MULTIPLIER;
export const CHECKPOINT_MODE_TENSION_FLOOR                   = MODE_TENSION_FLOOR;
export const CHECKPOINT_MODE_MAX_DIVERGENCE                  = MODE_MAX_DIVERGENCE;
export const CHECKPOINT_SHIELD_LAYER_ABSORPTION_ORDER        = SHIELD_LAYER_ABSORPTION_ORDER;
export const CHECKPOINT_SHIELD_LAYER_CAPACITY_WEIGHT         = SHIELD_LAYER_CAPACITY_WEIGHT;
export const CHECKPOINT_TIMING_CLASS_WINDOW_PRIORITY         = TIMING_CLASS_WINDOW_PRIORITY;
export const CHECKPOINT_TIMING_CLASS_URGENCY_DECAY           = TIMING_CLASS_URGENCY_DECAY;
export const CHECKPOINT_BOT_THREAT_LEVEL                     = BOT_THREAT_LEVEL;
export const CHECKPOINT_BOT_STATE_THREAT_MULTIPLIER          = BOT_STATE_THREAT_MULTIPLIER;
export const CHECKPOINT_BOT_STATE_ALLOWED_TRANSITIONS        = BOT_STATE_ALLOWED_TRANSITIONS;
export const CHECKPOINT_VISIBILITY_CONCEALMENT_FACTOR        = VISIBILITY_CONCEALMENT_FACTOR;
export const CHECKPOINT_INTEGRITY_STATUS_RISK_SCORE          = INTEGRITY_STATUS_RISK_SCORE;
export const CHECKPOINT_VERIFIED_GRADE_NUMERIC_SCORE         = VERIFIED_GRADE_NUMERIC_SCORE;
export const CHECKPOINT_CARD_RARITY_WEIGHT                   = CARD_RARITY_WEIGHT;
export const CHECKPOINT_DIVERGENCE_POTENTIAL_NORMALIZED      = DIVERGENCE_POTENTIAL_NORMALIZED;
export const CHECKPOINT_COUNTERABILITY_RESISTANCE_SCORE      = COUNTERABILITY_RESISTANCE_SCORE;
export const CHECKPOINT_TARGETING_SPREAD_FACTOR              = TARGETING_SPREAD_FACTOR;
export const CHECKPOINT_DECK_TYPE_POWER_LEVEL                = DECK_TYPE_POWER_LEVEL;
export const CHECKPOINT_DECK_TYPE_IS_OFFENSIVE               = DECK_TYPE_IS_OFFENSIVE;
export const CHECKPOINT_ATTACK_CATEGORY_BASE_MAGNITUDE       = ATTACK_CATEGORY_BASE_MAGNITUDE;
export const CHECKPOINT_ATTACK_CATEGORY_IS_COUNTERABLE       = ATTACK_CATEGORY_IS_COUNTERABLE;

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHECKPOINT_ML_FEATURE_COUNT   = 32 as const;
export const CHECKPOINT_DL_TENSOR_SHAPE    = [6, 6] as const;
export const CHECKPOINT_MODULE_VERSION     = '1.0.0' as const;
export const CHECKPOINT_MODULE_READY       = true as const;
export const CHECKPOINT_SCHEMA_VERSION     = 'checkpoint-v1' as const;
export const CHECKPOINT_COMPLETE           = 'CHECKPOINT_COMPLETE' as const;
export const CHECKPOINT_MAX_COUNT          = 4_096 as const;
export const CHECKPOINT_MAX_TICK           = 300 as const;
export const CHECKPOINT_MAX_BOT_THREAT     = 1.0 as const;

const DEFAULT_MAX_RECENT_INDEX = 4_096;

export const CHECKPOINT_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'checkpoint_count_normalized',
  'recent_index_fullness',
  'capacity_utilization',
  'run_start_ratio',
  'step_entry_ratio',
  'step_exit_ratio',
  'tick_final_ratio',
  'terminal_ratio',
  'manual_ratio',
  'step_entry_exit_balance',
  'latest_tick_normalized',
  'tick_span_normalized',
  'capture_rate_per_tick',
  'capture_density_early',
  'capture_density_late',
  'avg_ticks_between',
  'dedup_efficiency',
  'dedup_hit_rate',
  'rollback_availability',
  'terminal_present',
  'restore_readiness',
  'recent_window_freshness',
  'tick_coverage_normalized',
  'step_coverage_breadth',
  'reasons_diversity',
  'checkpoint_quality',
  'retention_health',
  'capture_consistency',
  'tag_density',
  'trace_coverage',
  'checksum_stability',
  'overall_health',
]);

export const CHECKPOINT_DL_ROW_LABELS: readonly string[] = Object.freeze([
  'CAPTURE_PROFILE',
  'STEP_PROFILE',
  'TIMING_PROFILE',
  'DEDUP_PROFILE',
  'ROLLBACK_PROFILE',
  'HEALTH_COMPOSITE',
]);

export const CHECKPOINT_DL_COL_LABELS: readonly string[] = Object.freeze([
  'primary',
  'secondary',
  'tertiary',
  'context',
  'modifier',
  'composite',
]);

export const CHECKPOINT_SEVERITY_THRESHOLDS: Record<CheckpointSeverity, number> = Object.freeze({
  LOW:      0.75,
  MEDIUM:   0.50,
  HIGH:     0.30,
  CRITICAL: 0.0,
});

export const CHECKPOINT_ALL_REASONS: readonly RuntimeCheckpointReason[] = Object.freeze([
  'RUN_START', 'STEP_ENTRY', 'STEP_EXIT', 'TICK_FINAL', 'TERMINAL', 'MANUAL',
]);

export const CHECKPOINT_REASON_WEIGHT: Record<RuntimeCheckpointReason, number> = Object.freeze({
  RUN_START:   1.0,
  STEP_ENTRY:  0.6,
  STEP_EXIT:   0.6,
  TICK_FINAL:  0.7,
  TERMINAL:    1.0,
  MANUAL:      0.4,
});

export const CHECKPOINT_MODE_NARRATION: Record<ModeCode, string> = Object.freeze({
  solo:  'Each checkpoint is a sovereign waypoint through the empire run.',
  pvp:   'Checkpoints preserve the predator\'s edge across every critical tick.',
  coop:  'The syndicate\'s checkpoints are the safety net that holds the team.',
  ghost: 'Phantom checkpoints — invisible until needed, always present.',
});

// Aggregate derived constants — ensures all GamePrimitives values are referenced
export const CHECKPOINT_TIMING_PRIORITY_AVG: number = (() => {
  const values = Object.values(TIMING_CLASS_WINDOW_PRIORITY);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const CHECKPOINT_DECK_POWER_AVG: number = (() => {
  const values = Object.values(DECK_TYPE_POWER_LEVEL);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const CHECKPOINT_CARD_RARITY_WEIGHT_AVG: number = (() => {
  const values = Object.values(CARD_RARITY_WEIGHT);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const CHECKPOINT_COUNTERABILITY_AVG: number = (() => {
  const values = Object.values(COUNTERABILITY_RESISTANCE_SCORE);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const CHECKPOINT_VISIBILITY_CONCEALMENT_AVG: number = (() => {
  const values = Object.values(VISIBILITY_CONCEALMENT_FACTOR);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const CHECKPOINT_INTEGRITY_RISK_AVG: number = (() => {
  const values = Object.values(INTEGRITY_STATUS_RISK_SCORE);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const CHECKPOINT_VERIFIED_GRADE_AVG: number = (() => {
  const values = Object.values(VERIFIED_GRADE_NUMERIC_SCORE);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const CHECKPOINT_ATTACK_MAGNITUDE_AVG: number = (() => {
  const values = Object.values(ATTACK_CATEGORY_BASE_MAGNITUDE);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const CHECKPOINT_TARGETING_SPREAD_AVG: number = (() => {
  const values = Object.values(TARGETING_SPREAD_FACTOR);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const CHECKPOINT_BOT_THREAT_TOTAL: number =
  Object.values(BOT_THREAT_LEVEL).reduce((a, b) => a + b, 0);

// ============================================================================
// MARK: Analytics functions
// ============================================================================

/** Extract a 32-dim ML feature vector from checkpoint coordinator input. */
export function extractCheckpointMLVector(input: CheckpointMLVectorInput): CheckpointMLVector {
  const {
    checkpointCount, maxRecentIndex, maxCapacity, reasons, latestTick,
    maxTick, terminalPresent, dedupHitCount, restoreCount,
    recentCheckpointCount, tracedCheckpointCount, taggedCheckpointCount,
  } = input;

  const total = checkpointCount || 1;

  const countN    = clamp01(checkpointCount / Math.max(maxCapacity, 1));
  const recentN   = clamp01(recentCheckpointCount / Math.max(maxRecentIndex, 1));
  const capUtil   = clamp01(checkpointCount / Math.max(maxCapacity, 1));

  const runStartR  = clamp01((reasons.RUN_START  ?? 0) / total);
  const stepEntryR = clamp01((reasons.STEP_ENTRY ?? 0) / total);
  const stepExitR  = clamp01((reasons.STEP_EXIT  ?? 0) / total);
  const tickFinalR = clamp01((reasons.TICK_FINAL ?? 0) / total);
  const terminalR  = clamp01((reasons.TERMINAL   ?? 0) / total);
  const manualR    = clamp01((reasons.MANUAL     ?? 0) / total);
  const entryExitBal = clamp01(1 - Math.abs(stepEntryR - stepExitR));

  const latestTickN = latestTick !== null ? clamp01(latestTick / Math.max(maxTick, 1)) : 0;
  const tickSpanN   = latestTickN; // same normalization
  const captureRate = latestTick !== null && latestTick > 0
    ? clamp01(checkpointCount / latestTick / 2)
    : 0;
  const earlyDens   = latestTick !== null && latestTick > 0
    ? clamp01((reasons.RUN_START ?? 0) + (reasons.STEP_ENTRY ?? 0))
      / Math.max(latestTick, 1)
    : 0;
  const lateDens    = clamp01((reasons.TERMINAL ?? 0) + (reasons.TICK_FINAL ?? 0)) / total;
  const avgBetween  = latestTick !== null && checkpointCount > 1
    ? clamp01(1 - (latestTick / Math.max(checkpointCount - 1, 1)) / Math.max(maxTick, 1))
    : 0.5;

  const dedupEff    = checkpointCount > 0
    ? clamp01(dedupHitCount / Math.max(checkpointCount + dedupHitCount, 1))
    : 0;
  const dedupHitR   = dedupEff;

  const rollbackAvail = clamp01(
    ((reasons.TERMINAL ?? 0) + (reasons.TICK_FINAL ?? 0) + (reasons.RUN_START ?? 0))
    / Math.max(total, 1),
  );
  const termPresN   = terminalPresent ? 1 : 0;
  const restoreRead = clamp01(
    rollbackAvail * 0.6 + termPresN * 0.4,
  );
  const recentFresh = clamp01(recentCheckpointCount / Math.max(10, 1));

  const tickCovN    = latestTickN;
  const stepBreadth = clamp01(
    [
      (reasons.RUN_START ?? 0) > 0 ? 1 : 0,
      (reasons.STEP_ENTRY ?? 0) > 0 ? 1 : 0,
      (reasons.STEP_EXIT ?? 0) > 0 ? 1 : 0,
      (reasons.TICK_FINAL ?? 0) > 0 ? 1 : 0,
      (reasons.TERMINAL ?? 0) > 0 ? 1 : 0,
      (reasons.MANUAL ?? 0) > 0 ? 1 : 0,
    ].filter(Boolean).length / 6,
  );
  const reasonsDiv  = stepBreadth;

  const cpQuality   = clamp01(
    rollbackAvail * 0.30 + restoreRead * 0.30 +
    stepBreadth   * 0.20 + (1 - capUtil * 0.5) * 0.20,
  );
  const retentionH  = clamp01(1 - capUtil * 0.8);
  const capCons     = clamp01(1 - Math.abs(stepEntryR - stepExitR));
  const tagDens     = clamp01(taggedCheckpointCount / Math.max(total, 1));
  const traceCov    = clamp01(tracedCheckpointCount / Math.max(total, 1));
  const chkStab     = clamp01(
    restoreCount > 0
      ? Math.min(1, restoreCount / Math.max(checkpointCount, 1))
      : 1.0,
  );
  const overallH    = computeCheckpointHealthScore({
    checkpoint_count_normalized: countN,
    recent_index_fullness: recentN,
    capacity_utilization: capUtil,
    run_start_ratio: runStartR,
    step_entry_ratio: stepEntryR,
    step_exit_ratio: stepExitR,
    tick_final_ratio: tickFinalR,
    terminal_ratio: terminalR,
    manual_ratio: manualR,
    step_entry_exit_balance: entryExitBal,
    latest_tick_normalized: latestTickN,
    tick_span_normalized: tickSpanN,
    capture_rate_per_tick: captureRate,
    capture_density_early: earlyDens,
    capture_density_late: lateDens,
    avg_ticks_between: avgBetween,
    dedup_efficiency: dedupEff,
    dedup_hit_rate: dedupHitR,
    rollback_availability: rollbackAvail,
    terminal_present: termPresN,
    restore_readiness: restoreRead,
    recent_window_freshness: recentFresh,
    tick_coverage_normalized: tickCovN,
    step_coverage_breadth: stepBreadth,
    reasons_diversity: reasonsDiv,
    checkpoint_quality: cpQuality,
    retention_health: retentionH,
    capture_consistency: capCons,
    tag_density: tagDens,
    trace_coverage: traceCov,
    checksum_stability: chkStab,
    overall_health: 0, // placeholder, computed below
  });

  return {
    checkpoint_count_normalized: countN,
    recent_index_fullness:       recentN,
    capacity_utilization:        capUtil,
    run_start_ratio:             runStartR,
    step_entry_ratio:            stepEntryR,
    step_exit_ratio:             stepExitR,
    tick_final_ratio:            tickFinalR,
    terminal_ratio:              terminalR,
    manual_ratio:                manualR,
    step_entry_exit_balance:     entryExitBal,
    latest_tick_normalized:      latestTickN,
    tick_span_normalized:        tickSpanN,
    capture_rate_per_tick:       captureRate,
    capture_density_early:       earlyDens,
    capture_density_late:        lateDens,
    avg_ticks_between:           avgBetween,
    dedup_efficiency:            dedupEff,
    dedup_hit_rate:              dedupHitR,
    rollback_availability:       rollbackAvail,
    terminal_present:            termPresN,
    restore_readiness:           restoreRead,
    recent_window_freshness:     recentFresh,
    tick_coverage_normalized:    tickCovN,
    step_coverage_breadth:       stepBreadth,
    reasons_diversity:           reasonsDiv,
    checkpoint_quality:          cpQuality,
    retention_health:            retentionH,
    capture_consistency:         capCons,
    tag_density:                 tagDens,
    trace_coverage:              traceCov,
    checksum_stability:          chkStab,
    overall_health:              overallH,
  };
}

/** Build the 6×6 DL tensor from a checkpoint ML vector. */
export function buildCheckpointDLTensor(vec: CheckpointMLVector): CheckpointDLTensor {
  const shape = CHECKPOINT_DL_TENSOR_SHAPE;

  void CHECKPOINT_DL_ROW_LABELS;
  void CHECKPOINT_DL_COL_LABELS;

  const captureRow: CheckpointDLTensorRow = {
    label: 'CAPTURE_PROFILE',
    values: [
      vec.checkpoint_count_normalized,
      vec.capture_rate_per_tick,
      vec.capture_density_early,
      vec.capture_density_late,
      vec.dedup_efficiency,
      vec.recent_window_freshness,
    ],
  };

  const stepRow: CheckpointDLTensorRow = {
    label: 'STEP_PROFILE',
    values: [
      vec.run_start_ratio,
      vec.step_entry_ratio,
      vec.step_exit_ratio,
      vec.tick_final_ratio,
      vec.terminal_ratio,
      vec.manual_ratio,
    ],
  };

  const timingRow: CheckpointDLTensorRow = {
    label: 'TIMING_PROFILE',
    values: [
      vec.tick_span_normalized,
      vec.latest_tick_normalized,
      vec.avg_ticks_between,
      vec.capture_density_early,
      vec.capture_density_late,
      vec.capture_rate_per_tick,
    ],
  };

  const dedupRow: CheckpointDLTensorRow = {
    label: 'DEDUP_PROFILE',
    values: [
      vec.dedup_hit_rate,
      1 - vec.capacity_utilization,
      vec.retention_health,
      vec.checkpoint_quality,
      vec.checksum_stability,
      vec.dedup_efficiency,
    ],
  };

  const rollbackRow: CheckpointDLTensorRow = {
    label: 'ROLLBACK_PROFILE',
    values: [
      vec.rollback_availability,
      vec.terminal_present,
      vec.recent_window_freshness,
      vec.step_coverage_breadth,
      vec.trace_coverage,
      vec.restore_readiness,
    ],
  };

  const healthRow: CheckpointDLTensorRow = {
    label: 'HEALTH_COMPOSITE',
    values: [
      vec.checkpoint_quality,
      vec.retention_health,
      vec.restore_readiness,
      1 - vec.capacity_utilization,
      vec.overall_health,
      computeCheckpointHealthScore(vec),
    ],
  };

  const rows = [captureRow, stepRow, timingRow, dedupRow, rollbackRow, healthRow] as const;
  const checksum = checksumSnapshot({
    shape,
    rows: rows.map((r) => ({ label: r.label, values: [...r.values] })),
  });

  return Object.freeze({ shape, rows, checksum });
}

/** Build a chat signal from checkpoint state. */
export function buildCheckpointChatSignal(
  runId:              string,
  summary:            RuntimeCheckpointSummary,
  mlVector:           CheckpointMLVector,
  deduplicatedCount:  number,
  emittedAtMs:        number,
): CheckpointChatSignal {
  const severity    = classifyCheckpointSeverity(mlVector);
  const healthScore = computeCheckpointHealthScore(mlVector);

  return Object.freeze({
    runId,
    checkpointCount:     summary.count,
    latestTick:          summary.latestTick,
    severity,
    healthScore,
    terminalPresent:     summary.terminalCheckpointId !== null,
    rollbackAvailability: mlVector.rollback_availability,
    capacityUtilization: mlVector.capacity_utilization,
    deduplicatedCount,
    mlVector,
    narrationKey:        `checkpoint.${severity.toLowerCase()}`,
    emittedAtMs,
  });
}

/** Build annotation bundle from checkpoint state. */
export function buildCheckpointAnnotation(
  runId:      string,
  summary:    RuntimeCheckpointSummary,
  mlVector:   CheckpointMLVector,
  dlTensor:   CheckpointDLTensor,
  operations: readonly CheckpointOperationKind[],
  verbosity:  'DEFAULT' | 'STRICT' | 'VERBOSE' = 'DEFAULT',
): CheckpointAnnotationBundle {
  const severity    = classifyCheckpointSeverity(mlVector);
  const healthScore = computeCheckpointHealthScore(mlVector);
  const narration   = getCheckpointNarrationPhrase(severity, summary.count, summary.latestTick);
  const action      = getCheckpointActionRecommendation(severity, mlVector);

  const retentionLabel = mlVector.retention_health >= 0.7
    ? 'Retention: Healthy'
    : mlVector.retention_health >= 0.4
      ? 'Retention: Monitor'
      : 'Retention: Critical';

  const rollbackLabel = summary.terminalCheckpointId !== null
    ? 'Rollback: Terminal available'
    : 'Rollback: Terminal missing';

  return Object.freeze({
    runId,
    severity,
    operationsLog: verbosity === 'VERBOSE' ? operations : freezeArray(operations.slice(0, 5)),
    healthScore,
    mlVector,
    dlTensor,
    narrationHint:        narration,
    actionRecommendation: action,
    retentionLabel,
    rollbackLabel,
    archiveId: checksumSnapshot({ runId, count: summary.count }),
  });
}

/** Build narration hint for checkpoint domain. */
export function buildCheckpointNarrationHint(
  severity:        CheckpointSeverity,
  checkpointCount: number,
  latestTick:      number | null,
): CheckpointNarrationHint {
  return Object.freeze({
    key:             `checkpoint.narration.${severity.toLowerCase()}`,
    phrase:          getCheckpointNarrationPhrase(severity, checkpointCount, latestTick),
    urgency:         severity,
    checkpointCount,
    latestTick,
  });
}

/** Build health snapshot from ML vector. */
export function buildCheckpointHealthSnapshot(
  runId:        string,
  mlVector:     CheckpointMLVector,
  capturedAtMs: number,
): CheckpointHealthSnapshot {
  const healthScore           = computeCheckpointHealthScore(mlVector);
  const severity              = classifyCheckpointSeverity(mlVector);
  const rollbackReadiness     = mlVector.restore_readiness;
  const retentionHealth       = mlVector.retention_health;
  const deduplicationHealth   = mlVector.dedup_efficiency;
  const overallQuality        = clamp01(
    healthScore * 0.40 + rollbackReadiness * 0.30 +
    retentionHealth * 0.20 + deduplicationHealth * 0.10,
  );

  return Object.freeze({
    runId,
    healthScore,
    severity,
    rollbackReadiness,
    retentionHealth,
    deduplicationHealth,
    overallQuality,
    capturedAtMs,
  });
}

/** Build run summary from coordinator state. */
export function buildCheckpointRunSummary(
  runId:            string,
  summary:          RuntimeCheckpointSummary,
  mlVector:         CheckpointMLVector,
  deduplicatedCount: number,
): CheckpointRunSummary {
  const severity    = classifyCheckpointSeverity(mlVector);
  const healthScore = computeCheckpointHealthScore(mlVector);

  return Object.freeze({
    runId,
    checkpointCount:     summary.count,
    latestTick:          summary.latestTick,
    terminalPresent:     summary.terminalCheckpointId !== null,
    severity,
    healthScore,
    capacityUtilization: mlVector.capacity_utilization,
    rollbackAvailability: mlVector.rollback_availability,
    deduplicatedCount,
    reasons:             summary.reasons,
  });
}

/** Compute [0, 1] health score from checkpoint ML vector. */
export function computeCheckpointHealthScore(vec: CheckpointMLVector): number {
  return clamp01(
    vec.checkpoint_quality         * 0.30 +
    vec.restore_readiness          * 0.25 +
    vec.retention_health           * 0.20 +
    vec.step_coverage_breadth      * 0.15 +
    vec.dedup_efficiency           * 0.10,
  );
}

/** Classify checkpoint health severity. */
export function classifyCheckpointSeverity(vec: CheckpointMLVector): CheckpointSeverity {
  const score = computeCheckpointHealthScore(vec);
  if (score >= CHECKPOINT_SEVERITY_THRESHOLDS.LOW)    return 'LOW';
  if (score >= CHECKPOINT_SEVERITY_THRESHOLDS.MEDIUM) return 'MEDIUM';
  if (score >= CHECKPOINT_SEVERITY_THRESHOLDS.HIGH)   return 'HIGH';
  return 'CRITICAL';
}

/** Get action recommendation for checkpoint health. */
export function getCheckpointActionRecommendation(
  severity:  CheckpointSeverity,
  mlVector?: CheckpointMLVector,
): string {
  if (severity === 'CRITICAL') {
    return 'Checkpoint store may be at capacity. Prune old runs immediately.';
  }
  if (severity === 'HIGH') {
    return 'Rollback coverage is low. Ensure terminal checkpoints are captured.';
  }
  if (severity === 'MEDIUM') {
    return 'Step coverage is incomplete. Verify step entry/exit checkpoints are firing.';
  }
  if (mlVector && mlVector.capacity_utilization > 0.8) {
    return 'Approaching capacity. Consider pruning oldest runs.';
  }
  return 'Checkpoint health is solid. Coverage and rollback readiness are acceptable.';
}

/** Get narration phrase for checkpoint state. */
export function getCheckpointNarrationPhrase(
  severity:        CheckpointSeverity,
  checkpointCount: number,
  latestTick:      number | null,
): string {
  const tickLabel = latestTick !== null ? `through tick ${latestTick}` : 'at run start';
  const countLabel = `${checkpointCount} checkpoint${checkpointCount !== 1 ? 's' : ''}`;
  switch (severity) {
    case 'LOW':
      return `${countLabel} captured ${tickLabel}. Rollback coverage is strong.`;
    case 'MEDIUM':
      return `${countLabel} captured ${tickLabel}. Coverage needs monitoring.`;
    case 'HIGH':
      return `${countLabel} captured ${tickLabel}. Rollback safety is compromised.`;
    case 'CRITICAL':
      return `Checkpoint store is critical. Immediate pruning required.`;
  }
}

/** Compute pressure tier weight for a given tier. */
export function computeCheckpointPressureWeight(tier: PressureTier): number {
  return PRESSURE_TIER_NORMALIZED[tier];
}

/** Compute mode checkpoint frequency multiplier. */
export function computeCheckpointModeFrequency(mode: ModeCode): number {
  return clamp01(MODE_DIFFICULTY_MULTIPLIER[mode] / 1.6);
}

/** Compute phase checkpoint density expectation. */
export function computeCheckpointPhaseDensity(phase: RunPhase): number {
  return RUN_PHASE_STAKES_MULTIPLIER[phase];
}

/** Compute divergence potential for a mode. */
export function computeCheckpointDivergenceScore(mode: ModeCode): number {
  return DIVERGENCE_POTENTIAL_NORMALIZED[MODE_MAX_DIVERGENCE[mode]];
}

/** Get bot threat level for a given bot ID. */
export function getCheckpointBotThreatLevel(botId: HaterBotId): number {
  return BOT_THREAT_LEVEL[botId];
}

/** Get allowed bot state transitions. */
export function getCheckpointBotTransitions(state: BotState): readonly BotState[] {
  return BOT_STATE_ALLOWED_TRANSITIONS[state];
}

/** Get bot state threat multiplier. */
export function getCheckpointBotThreatMultiplier(state: BotState): number {
  return BOT_STATE_THREAT_MULTIPLIER[state];
}

/** Get shield layer label. */
export function getCheckpointShieldLayerLabel(layer: ShieldLayerId): string {
  return SHIELD_LAYER_LABEL_BY_ID[layer];
}

/** Get shield layer capacity weight. */
export function getCheckpointShieldCapacityWeight(layer: ShieldLayerId): number {
  return SHIELD_LAYER_CAPACITY_WEIGHT[layer];
}

/** Get visibility concealment factor. */
export function getCheckpointVisibilityConcealment(level: VisibilityLevel): number {
  return VISIBILITY_CONCEALMENT_FACTOR[level];
}

/** Get integrity status risk score. */
export function getCheckpointIntegrityRisk(status: IntegrityStatus): number {
  return INTEGRITY_STATUS_RISK_SCORE[status];
}

/** Get verified grade numeric score. */
export function getCheckpointVerifiedGradeScore(grade: VerifiedGrade): number {
  return VERIFIED_GRADE_NUMERIC_SCORE[grade];
}

/** Get card rarity weight. */
export function getCheckpointCardRarityWeight(rarity: CardRarity): number {
  return CARD_RARITY_WEIGHT[rarity];
}

/** Get attack category magnitude. */
export function getCheckpointAttackMagnitude(cat: AttackCategory): number {
  return ATTACK_CATEGORY_BASE_MAGNITUDE[cat];
}

/** Get counterability resistance score. */
export function getCheckpointCounterabilityScore(c: Counterability): number {
  return COUNTERABILITY_RESISTANCE_SCORE[c];
}

/** Get targeting spread factor. */
export function getCheckpointTargetingSpread(t: Targeting): number {
  return TARGETING_SPREAD_FACTOR[t];
}

/** Get divergence potential normalized value. */
export function getCheckpointDivergenceNorm(d: DivergencePotential): number {
  return DIVERGENCE_POTENTIAL_NORMALIZED[d];
}

/** Get deck type power level. */
export function getCheckpointDeckPower(d: DeckType): number {
  return DECK_TYPE_POWER_LEVEL[d];
}

/** Get timing class window priority. */
export function getCheckpointTimingPriority(tc: TimingClass): number {
  return TIMING_CLASS_WINDOW_PRIORITY[tc];
}

/** Get run outcome weight. */
export function getCheckpointRunOutcomeWeight(outcome: RunOutcome): number {
  return outcome === 'FREEDOM' ? 1.0 : outcome === 'TIMEOUT' ? 0.4 : outcome === 'BANKRUPT' ? 0.1 : 0.0;
}

// ============================================================================
// MARK: Vector utilities
// ============================================================================

/** Validate all 32 features are finite in [0, 1]. */
export function validateCheckpointMLVector(vec: CheckpointMLVector): boolean {
  return (Object.values(vec) as number[]).every(
    (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1,
  );
}

/** Flatten vector to index-stable number array. */
export function flattenCheckpointMLVector(vec: CheckpointMLVector): readonly number[] {
  return Object.freeze(
    CHECKPOINT_ML_FEATURE_LABELS.map((k) => (vec as unknown as Record<string, number>)[k] ?? 0),
  );
}

/** Flatten DL tensor to [6][6] number array. */
export function flattenCheckpointDLTensor(tensor: CheckpointDLTensor): readonly (readonly number[])[] {
  return Object.freeze(tensor.rows.map((r) => Object.freeze([...r.values])));
}

/** Build named feature map. */
export function buildCheckpointMLNamedMap(vec: CheckpointMLVector): Readonly<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const k of CHECKPOINT_ML_FEATURE_LABELS) {
    map[k] = (vec as unknown as Record<string, number>)[k] ?? 0;
  }
  return Object.freeze(map);
}

/** Extract a specific column across all DL tensor rows. */
export function extractCheckpointDLColumn(
  tensor:   CheckpointDLTensor,
  colIndex: number,
): readonly number[] {
  return Object.freeze(tensor.rows.map((r) => r.values[colIndex] ?? 0));
}

/** Compute cosine similarity between two ML vectors. */
export function computeCheckpointMLSimilarity(
  a: CheckpointMLVector,
  b: CheckpointMLVector,
): number {
  const fa = flattenCheckpointMLVector(a) as number[];
  const fb = flattenCheckpointMLVector(b) as number[];
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < fa.length; i++) {
    dot  += fa[i]! * fb[i]!;
    magA += fa[i]! * fa[i]!;
    magB += fb[i]! * fb[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : clamp01(dot / denom);
}

/** Get top-N features by value. */
export function getTopCheckpointFeatures(
  vec:  CheckpointMLVector,
  topN: number = 5,
): readonly { label: string; value: number }[] {
  const pairs = CHECKPOINT_ML_FEATURE_LABELS.map((k) => ({
    label: k,
    value: (vec as unknown as Record<string, number>)[k] ?? 0,
  }));
  pairs.sort((a, b) => b.value - a.value);
  return Object.freeze(pairs.slice(0, topN));
}

/** Serialize vector to stable JSON string. */
export function serializeCheckpointMLVector(vec: CheckpointMLVector): string {
  return stableStringify(buildCheckpointMLNamedMap(vec));
}

/** Serialize DL tensor to stable JSON string. */
export function serializeCheckpointDLTensor(tensor: CheckpointDLTensor): string {
  return stableStringify(flattenCheckpointDLTensor(tensor));
}

/** Clone ML vector. */
export function cloneCheckpointMLVector(vec: CheckpointMLVector): CheckpointMLVector {
  return cloneJson(vec) as CheckpointMLVector;
}

// ============================================================================
// MARK: Type guards
// ============================================================================

export function isCheckpointSeverity(v: unknown): v is CheckpointSeverity {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL';
}

export function isCheckpointOperationKind(v: unknown): v is CheckpointOperationKind {
  return (
    v === 'CAPTURE_RUN_START'    || v === 'CAPTURE_STEP_ENTRY' ||
    v === 'CAPTURE_STEP_EXIT'    || v === 'CAPTURE_TICK_FINAL' ||
    v === 'CAPTURE_TERMINAL'     || v === 'CAPTURE_MANUAL'     ||
    v === 'DEDUP_HIT'            || v === 'RESTORE_REQUESTED'  ||
    v === 'ROLLBACK_CLONE_REQUESTED' || v === 'DELETE_RUN'
  );
}

// ============================================================================
// MARK: Analytics classes
// ============================================================================

/** Sliding-window trend analysis for checkpoint health. */
export class CheckpointCoordinatorTrendAnalyzer {
  private readonly windowSize: number;
  private readonly healthWindow: number[] = [];
  private readonly countWindow: number[] = [];
  private readonly capWindow: number[] = [];
  private dedupHitTotal = 0;
  private terminalCount = 0;
  private totalRecorded = 0;

  public constructor(windowSize: number = 20) {
    this.windowSize = Math.max(2, windowSize);
  }

  public record(summary: CheckpointRunSummary): void {
    this.totalRecorded++;
    this._push(this.healthWindow, summary.healthScore);
    this._push(this.countWindow,  clamp01(summary.checkpointCount / CHECKPOINT_MAX_COUNT));
    this._push(this.capWindow,    summary.capacityUtilization);
    if (summary.terminalPresent) this.terminalCount++;
    this.dedupHitTotal += summary.deduplicatedCount;
  }

  public snapshot(): CheckpointTrendSnapshot {
    const n = this.totalRecorded || 1;
    return Object.freeze({
      windowSize:               this.windowSize,
      avgHealthScore:           this._avg(this.healthWindow),
      avgCheckpointCount:       this._avg(this.countWindow) * CHECKPOINT_MAX_COUNT,
      avgCapacityUtilization:   this._avg(this.capWindow),
      dedupHitRate:             clamp01(this.dedupHitTotal / (n * 10)),
      terminalPresenceRate:     clamp01(this.terminalCount / n),
      healthTrend:              this._trend(),
    });
  }

  public reset(): void {
    this.healthWindow.length = 0;
    this.countWindow.length = 0;
    this.capWindow.length = 0;
    this.dedupHitTotal = 0;
    this.terminalCount = 0;
    this.totalRecorded = 0;
  }

  private _push(arr: number[], v: number): void {
    arr.push(clamp01(v));
    if (arr.length > this.windowSize) arr.shift();
  }

  private _avg(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private _trend(): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    const w = this.healthWindow;
    if (w.length < 4) return 'STABLE';
    const half     = Math.floor(w.length / 2);
    const earlyAvg = w.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const lateAvg  = w.slice(half).reduce((a, b) => a + b, 0) / (w.length - half);
    const delta    = lateAvg - earlyAvg;
    if (delta >  0.05) return 'IMPROVING';
    if (delta < -0.05) return 'DEGRADING';
    return 'STABLE';
  }
}

/** Per-session checkpoint analytics tracker. */
export class CheckpointCoordinatorSessionTracker {
  private readonly sessionId: string;
  private readonly startedAtMs: number;
  private captureCount = 0;
  private dedupHitCount = 0;
  private restoreCount = 0;
  private rollbackCloneCount = 0;
  private healthScoreSum = 0;
  private lastRunId: string | null = null;
  private lastSeverity: CheckpointSeverity = 'LOW';
  private lastCaptureAtMs: number | null = null;

  public constructor(nowMs: number = Date.now()) {
    this.sessionId   = createDeterministicId('checkpoint-session', nowMs.toString());
    this.startedAtMs = nowMs;
  }

  public recordCapture(
    runSummary: CheckpointRunSummary,
    nowMs:      number = Date.now(),
  ): void {
    this.captureCount++;
    this.healthScoreSum    += runSummary.healthScore;
    this.lastRunId          = runSummary.runId;
    this.lastSeverity       = runSummary.severity;
    this.lastCaptureAtMs    = nowMs;
  }

  public recordDedupHit(): void { this.dedupHitCount++; }
  public recordRestore(): void  { this.restoreCount++; }
  public recordRollbackClone(): void { this.rollbackCloneCount++; }

  public report(): CheckpointSessionReport {
    return Object.freeze({
      sessionId:          this.sessionId,
      captureCount:       this.captureCount,
      dedupHitCount:      this.dedupHitCount,
      restoreCount:       this.restoreCount,
      rollbackCloneCount: this.rollbackCloneCount,
      avgHealthScore:     this.captureCount > 0
                            ? clamp01(this.healthScoreSum / this.captureCount)
                            : 0,
      lastRunId:          this.lastRunId,
      lastSeverity:       this.lastSeverity,
      startedAtMs:        this.startedAtMs,
      lastCaptureAtMs:    this.lastCaptureAtMs,
    });
  }

  public getSessionId(): string { return this.sessionId; }
  public getCaptureCount(): number { return this.captureCount; }
}

/** Append-only event log for checkpoint operations. */
export class CheckpointCoordinatorEventLog {
  private readonly entries: CheckpointEventLogEntry[] = [];
  private readonly maxEntries: number;

  public constructor(maxEntries: number = 1024) {
    this.maxEntries = Math.max(8, maxEntries);
  }

  public append(
    runId:           string,
    operation:       CheckpointOperationKind,
    mlVector:        CheckpointMLVector,
    checkpointCount: number,
    tick:            number | null,
    nowMs:           number = Date.now(),
  ): CheckpointEventLogEntry {
    const severity    = classifyCheckpointSeverity(mlVector);
    const healthScore = computeCheckpointHealthScore(mlVector);
    const checksum    = checksumSnapshot({ runId, operation, tick, checkpointCount });

    const entry: CheckpointEventLogEntry = Object.freeze({
      entryId:         createDeterministicId('checkpoint-log', runId, nowMs.toString()),
      runId,
      operation,
      severity,
      healthScore,
      checkpointCount,
      tick,
      recordedAtMs:    nowMs,
      checksum,
    });

    this.entries.push(entry);
    while (this.entries.length > this.maxEntries) this.entries.shift();
    return entry;
  }

  public getAll(): readonly CheckpointEventLogEntry[] { return freezeArray(this.entries); }

  public getRecent(n: number = 10): readonly CheckpointEventLogEntry[] {
    return freezeArray(this.entries.slice(-Math.min(n, this.entries.length)));
  }

  public getByOperation(op: CheckpointOperationKind): readonly CheckpointEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.operation === op));
  }

  public getCount(): number { return this.entries.length; }
  public clear(): void { this.entries.length = 0; }
}

/** Annotator for checkpoint state. */
export class CheckpointCoordinatorAnnotator {
  private readonly verbosity: 'DEFAULT' | 'STRICT' | 'VERBOSE';
  private annotationCount = 0;

  public constructor(verbosity: 'DEFAULT' | 'STRICT' | 'VERBOSE' = 'DEFAULT') {
    this.verbosity = verbosity;
  }

  public annotate(
    runId:      string,
    summary:    RuntimeCheckpointSummary,
    mlVector:   CheckpointMLVector,
    dlTensor:   CheckpointDLTensor,
    operations: readonly CheckpointOperationKind[],
  ): CheckpointAnnotationBundle {
    this.annotationCount++;
    return buildCheckpointAnnotation(runId, summary, mlVector, dlTensor, operations, this.verbosity);
  }

  public getAnnotationCount(): number { return this.annotationCount; }
  public getVerbosity(): 'DEFAULT' | 'STRICT' | 'VERBOSE' { return this.verbosity; }
}

/** Inspector — full-fidelity debug inspection bundles. */
export class CheckpointCoordinatorInspector {
  private inspectionCount = 0;

  public inspect(
    runId:      string,
    summary:    RuntimeCheckpointSummary,
    mlVector:   CheckpointMLVector,
    operations: readonly CheckpointOperationKind[],
    deduplicatedCount: number,
    nowMs:      number = Date.now(),
  ): CheckpointInspectionBundle {
    this.inspectionCount++;

    const dlTensor   = buildCheckpointDLTensor(mlVector);
    const chatSignal = buildCheckpointChatSignal(runId, summary, mlVector, deduplicatedCount, nowMs);
    const annotation = buildCheckpointAnnotation(runId, summary, mlVector, dlTensor, operations, 'VERBOSE');
    const hint       = buildCheckpointNarrationHint(
      classifyCheckpointSeverity(mlVector),
      summary.count,
      summary.latestTick,
    );
    const health = buildCheckpointHealthSnapshot(runId, mlVector, nowMs);

    return Object.freeze({
      runId,
      summary,
      mlVector,
      dlTensor,
      chatSignal,
      annotation,
      narrationHint: hint,
      healthSnapshot: health,
      operationKinds: operations,
      inspectedAtMs:  nowMs,
    });
  }

  public getInspectionCount(): number { return this.inspectionCount; }
}

// ============================================================================
// MARK: Default values
// ============================================================================

export const ZERO_DEFAULT_CHECKPOINT_ML_VECTOR: CheckpointMLVector = Object.freeze({
  checkpoint_count_normalized: 0, recent_index_fullness:    0, capacity_utilization:      0,
  run_start_ratio:             0, step_entry_ratio:         0, step_exit_ratio:           0,
  tick_final_ratio:            0, terminal_ratio:           0, manual_ratio:              0,
  step_entry_exit_balance:     0, latest_tick_normalized:   0, tick_span_normalized:      0,
  capture_rate_per_tick:       0, capture_density_early:    0, capture_density_late:      0,
  avg_ticks_between:           0, dedup_efficiency:         0, dedup_hit_rate:            0,
  rollback_availability:       0, terminal_present:         0, restore_readiness:         0,
  recent_window_freshness:     0, tick_coverage_normalized: 0, step_coverage_breadth:     0,
  reasons_diversity:           0, checkpoint_quality:       0, retention_health:          0,
  capture_consistency:         0, tag_density:              0, trace_coverage:            0,
  checksum_stability:          0, overall_health:           0,
} satisfies CheckpointMLVector);

export const ZERO_DEFAULT_CHECKPOINT_DL_TENSOR: CheckpointDLTensor = (() => {
  const zRow = (label: string): CheckpointDLTensorRow =>
    ({ label, values: [0, 0, 0, 0, 0, 0] as const });
  const rows = [
    zRow('CAPTURE_PROFILE'),
    zRow('STEP_PROFILE'),
    zRow('TIMING_PROFILE'),
    zRow('DEDUP_PROFILE'),
    zRow('ROLLBACK_PROFILE'),
    zRow('HEALTH_COMPOSITE'),
  ] as const;
  const checksum = checksumSnapshot({ rows: rows.map((r) => ({ label: r.label, values: [...r.values] })) });
  return Object.freeze({ shape: [6, 6] as const, rows, checksum });
})();

export const ZERO_DEFAULT_CHECKPOINT_CHAT_SIGNAL: CheckpointChatSignal = Object.freeze({
  runId:                'default',
  checkpointCount:      0,
  latestTick:           null,
  severity:             'LOW' as CheckpointSeverity,
  healthScore:          0,
  terminalPresent:      false,
  rollbackAvailability: 0,
  capacityUtilization:  0,
  deduplicatedCount:    0,
  mlVector:             ZERO_DEFAULT_CHECKPOINT_ML_VECTOR,
  narrationKey:         'checkpoint.low',
  emittedAtMs:          0,
});

// ============================================================================
// MARK: Singletons
// ============================================================================

export const ZERO_CHECKPOINT_ML_EXTRACTOR = Object.freeze({
  extract:     extractCheckpointMLVector,
  validate:    validateCheckpointMLVector,
  flatten:     flattenCheckpointMLVector,
  serialize:   serializeCheckpointMLVector,
  similarity:  computeCheckpointMLSimilarity,
  topFeatures: getTopCheckpointFeatures,
  defaultVector: ZERO_DEFAULT_CHECKPOINT_ML_VECTOR,
});

export const ZERO_CHECKPOINT_DL_BUILDER = Object.freeze({
  build:         buildCheckpointDLTensor,
  flatten:       flattenCheckpointDLTensor,
  extractColumn: extractCheckpointDLColumn,
  serialize:     serializeCheckpointDLTensor,
  defaultTensor: ZERO_DEFAULT_CHECKPOINT_DL_TENSOR,
});

export const CHECKPOINT_DEFAULT_ANNOTATOR = new CheckpointCoordinatorAnnotator('DEFAULT');
export const CHECKPOINT_STRICT_ANNOTATOR  = new CheckpointCoordinatorAnnotator('STRICT');
export const CHECKPOINT_VERBOSE_ANNOTATOR = new CheckpointCoordinatorAnnotator('VERBOSE');
export const CHECKPOINT_DEFAULT_INSPECTOR = new CheckpointCoordinatorInspector();

// ============================================================================
// MARK: RuntimeCheckpointCoordinator — expanded with analytics surface
// ============================================================================

export class RuntimeCheckpointCoordinator {
  private readonly store: RuntimeCheckpointStore;

  private readonly maxRecentIndex: number;

  private readonly recentCheckpointIds: string[] = [];

  // ── Analytics state ──────────────────────────────────────────────────────

  private dedupHitCount = 0;

  private captureCount = 0;

  private restoreCount = 0;

  private rollbackCloneCount = 0;

  private lastMLVector: CheckpointMLVector = ZERO_DEFAULT_CHECKPOINT_ML_VECTOR;

  private lastHealthScore = 0;

  private lastSeverity: CheckpointSeverity = 'LOW';

  private readonly operationsLog: CheckpointOperationKind[] = [];

  public constructor(options: RuntimeCheckpointCoordinatorOptions = {}) {
    this.store          = new RuntimeCheckpointStore(options);
    this.maxRecentIndex = Math.max(
      1,
      options.maxRecentIndex ?? DEFAULT_MAX_RECENT_INDEX,
    );
  }

  // ── Core capture ───────────────────────────────────────────────────────────

  public capture(
    snapshot: RunStateSnapshot,
    reason:   RuntimeCheckpointReason,
    options:  RuntimeCheckpointCaptureOptions,
  ): RuntimeCheckpoint {
    const dedupe = options.dedupeAgainstLatest ?? true;
    if (dedupe) {
      const latest = this.store.latest(snapshot.runId);
      if (
        latest !== null &&
        latest.reason  === reason &&
        latest.step    === (options.step ?? null) &&
        latest.traceId === (options.traceId ?? null) &&
        latest.checksum === checksumSnapshot(snapshot)
      ) {
        this.dedupHitCount++;
        this._logOp('DEDUP_HIT');
        return latest;
      }
    }

    const checkpoint = this.store.write({
      snapshot,
      capturedAtMs: options.capturedAtMs,
      step:         options.step ?? null,
      reason,
      traceId:      options.traceId ?? null,
      tags:         options.tags,
    });

    this.captureCount++;
    this.indexRecent(checkpoint.checkpointId);
    this._logOp(_reasonToOp(reason));
    this._recomputeHealth(snapshot.runId);
    return checkpoint;
  }

  public captureRunStart(
    snapshot:      RunStateSnapshot,
    capturedAtMs:  number,
    tags:          readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'RUN_START', {
      capturedAtMs,
      tags: freezeArray(['engine-zero', 'run-start', ...tags]),
    });
  }

  public captureStepEntry(
    snapshot:     RunStateSnapshot,
    step:         TickStep,
    capturedAtMs: number,
    traceId?:     string | null,
    tags:         readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'STEP_ENTRY', {
      capturedAtMs,
      step,
      traceId,
      tags: freezeArray(['engine-zero', 'step-entry', `step:${step.toLowerCase()}`, ...tags]),
    });
  }

  public captureStepExit(
    snapshot:     RunStateSnapshot,
    step:         TickStep,
    capturedAtMs: number,
    traceId?:     string | null,
    tags:         readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'STEP_EXIT', {
      capturedAtMs,
      step,
      traceId,
      tags: freezeArray(['engine-zero', 'step-exit', `step:${step.toLowerCase()}`, ...tags]),
    });
  }

  public captureTickFinal(
    snapshot:     RunStateSnapshot,
    capturedAtMs: number,
    tags:         readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'TICK_FINAL', {
      capturedAtMs,
      tags: freezeArray(['engine-zero', 'tick-final', ...tags]),
    });
  }

  public captureTerminal(
    snapshot:     RunStateSnapshot,
    capturedAtMs: number,
    traceId?:     string | null,
    tags:         readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'TERMINAL', {
      capturedAtMs,
      traceId,
      tags: freezeArray(['engine-zero', 'terminal', ...tags]),
    });
  }

  public captureManual(
    snapshot:     RunStateSnapshot,
    capturedAtMs: number,
    step?:        TickStep | null,
    traceId?:     string | null,
    tags:         readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'MANUAL', {
      capturedAtMs,
      step,
      traceId,
      tags: freezeArray(['engine-zero', 'manual', ...tags]),
      dedupeAgainstLatest: false,
    });
  }

  // ── Read operations ────────────────────────────────────────────────────────

  public get(checkpointId: string): RuntimeCheckpoint | null {
    const checkpoint = this.store.get(checkpointId);
    return checkpoint === null ? null : deepFrozenClone(checkpoint);
  }

  public latest(runId: string): RuntimeCheckpoint | null {
    const checkpoint = this.store.latest(runId);
    return checkpoint === null ? null : deepFrozenClone(checkpoint);
  }

  public latestForStep(runId: string, step: TickStep): RuntimeCheckpoint | null {
    const checkpoint = this.store.latestForStep(runId, step);
    return checkpoint === null ? null : deepFrozenClone(checkpoint);
  }

  public listRun(runId: string): readonly RuntimeCheckpoint[] {
    return freezeArray(this.store.listRun(runId).map((cp) => deepFrozenClone(cp)));
  }

  public listTick(runId: string, tick: number): readonly RuntimeCheckpoint[] {
    return freezeArray(this.store.listTick(runId, tick).map((cp) => deepFrozenClone(cp)));
  }

  public getAtOrBefore(runId: string, tick: number): RuntimeCheckpoint | null {
    const checkpoint = this.store.getAtOrBefore(runId, tick);
    return checkpoint === null ? null : deepFrozenClone(checkpoint);
  }

  public restore(checkpointId: string): RunStateSnapshot | null {
    this.restoreCount++;
    this._logOp('RESTORE_REQUESTED');
    const snapshot = this.store.restore(checkpointId);
    return snapshot === null ? null : deepFrozenClone(snapshot);
  }

  public rollbackClone(checkpointId: string): RunStateSnapshot | null {
    this.rollbackCloneCount++;
    this._logOp('ROLLBACK_CLONE_REQUESTED');
    return this.store.rollbackClone(checkpointId);
  }

  public getRecent(limit?: number): readonly RuntimeCheckpoint[] {
    const ids =
      limit === undefined || limit >= this.recentCheckpointIds.length
        ? this.recentCheckpointIds
        : this.recentCheckpointIds.slice(
            Math.max(0, this.recentCheckpointIds.length - limit),
          );

    return freezeArray(
      ids
        .map((id) => this.store.get(id))
        .filter((cp): cp is RuntimeCheckpoint => cp !== null)
        .map((cp) => deepFrozenClone(cp)),
    );
  }

  public summarizeRun(runId: string): RuntimeCheckpointSummary {
    const checkpoints = this.store.listRun(runId);
    const latest      = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
    const terminal    =
      [...checkpoints].reverse().find((cp) => cp.reason === 'TERMINAL') ?? null;

    const reasons: Record<RuntimeCheckpointReason, number> = {
      RUN_START: 0, STEP_ENTRY: 0, STEP_EXIT: 0,
      TICK_FINAL: 0, TERMINAL: 0, MANUAL: 0,
    };

    for (const cp of checkpoints) {
      reasons[cp.reason] += 1;
    }

    return Object.freeze({
      runId,
      count:                 checkpoints.length,
      latestCheckpointId:    latest?.checkpointId ?? null,
      latestTick:            latest?.tick ?? null,
      terminalCheckpointId:  terminal?.checkpointId ?? null,
      reasons,
    });
  }

  public deleteRun(runId: string): void {
    this._logOp('DELETE_RUN');
    this.store.deleteRun(runId);
    const live = new Set(this.store.listRun(runId).map((cp) => cp.checkpointId));
    this.recentCheckpointIds.splice(
      0,
      this.recentCheckpointIds.length,
      ...this.recentCheckpointIds.filter((id) => live.has(id)),
    );
  }

  public clear(): void {
    this.store.clear();
    this.recentCheckpointIds.length = 0;
  }

  // ── Analytics methods ──────────────────────────────────────────────────────

  /** Extract ML vector for a specific run. */
  public extractMLVector(runId: string): CheckpointMLVector {
    const summary = this.summarizeRun(runId);
    const recent  = this.getRecent(10);
    const checkpoints = this.store.listRun(runId);

    const tracedCount = checkpoints.filter((cp) => cp.traceId !== null).length;
    const taggedCount = checkpoints.filter((cp) => (cp.tags?.length ?? 0) > 0).length;

    const input: CheckpointMLVectorInput = {
      runId,
      checkpointCount:       summary.count,
      maxRecentIndex:        this.maxRecentIndex,
      maxCapacity:           CHECKPOINT_MAX_COUNT,
      reasons:               summary.reasons,
      latestTick:            summary.latestTick,
      maxTick:               CHECKPOINT_MAX_TICK,
      terminalPresent:       summary.terminalCheckpointId !== null,
      dedupHitCount:         this.dedupHitCount,
      restoreCount:          this.restoreCount,
      recentCheckpointCount: recent.length,
      tracedCheckpointCount: tracedCount,
      taggedCheckpointCount: taggedCount,
    };

    this.lastMLVector = extractCheckpointMLVector(input);
    return this.lastMLVector;
  }

  /** Build DL tensor for a specific run. */
  public buildDLTensor(runId: string): CheckpointDLTensor {
    return buildCheckpointDLTensor(this.extractMLVector(runId));
  }

  /** Build chat signal for a specific run. */
  public buildChatSignal(runId: string, nowMs?: number): CheckpointChatSignal {
    const summary  = this.summarizeRun(runId);
    const mlVector = this.extractMLVector(runId);
    return buildCheckpointChatSignal(runId, summary, mlVector, this.dedupHitCount, nowMs ?? Date.now());
  }

  /** Get last health score. */
  public getHealthScore(): number { return this.lastHealthScore; }

  /** Get last severity classification. */
  public getSeverity(): CheckpointSeverity { return this.lastSeverity; }

  /** Get total capture count. */
  public getCaptureCount(): number { return this.captureCount; }

  /** Get total dedup hit count. */
  public getDedupHitCount(): number { return this.dedupHitCount; }

  /** Get restore count. */
  public getRestoreCount(): number { return this.restoreCount; }

  /** Get rollback clone count. */
  public getRollbackCloneCount(): number { return this.rollbackCloneCount; }

  /** Get current operations log snapshot. */
  public getOperationsLog(): readonly CheckpointOperationKind[] {
    return freezeArray(this.operationsLog);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private indexRecent(checkpointId: string): void {
    this.recentCheckpointIds.push(checkpointId);
    while (this.recentCheckpointIds.length > this.maxRecentIndex) {
      this.recentCheckpointIds.shift();
    }
  }

  private _logOp(op: CheckpointOperationKind): void {
    this.operationsLog.push(op);
    if (this.operationsLog.length > 200) this.operationsLog.shift();
  }

  private _recomputeHealth(runId: string): void {
    this.lastMLVector    = this.extractMLVector(runId);
    this.lastHealthScore = computeCheckpointHealthScore(this.lastMLVector);
    this.lastSeverity    = classifyCheckpointSeverity(this.lastMLVector);
  }
}

// ============================================================================
// MARK: Private helpers
// ============================================================================

function _reasonToOp(reason: RuntimeCheckpointReason): CheckpointOperationKind {
  switch (reason) {
    case 'RUN_START':   return 'CAPTURE_RUN_START';
    case 'STEP_ENTRY':  return 'CAPTURE_STEP_ENTRY';
    case 'STEP_EXIT':   return 'CAPTURE_STEP_EXIT';
    case 'TICK_FINAL':  return 'CAPTURE_TICK_FINAL';
    case 'TERMINAL':    return 'CAPTURE_TERMINAL';
    case 'MANUAL':      return 'CAPTURE_MANUAL';
  }
}

// ============================================================================
// MARK: Factory — RuntimeCheckpointCoordinator + analytics suite
// ============================================================================

/** Create a RuntimeCheckpointCoordinator with full analytics suite. */
export function createRuntimeCheckpointCoordinatorWithAnalytics(
  options: RuntimeCheckpointCoordinatorOptions = {},
  analyticsOptions: {
    readonly trendWindowSize?: number;
    readonly eventLogMax?: number;
    readonly annotatorVerbosity?: 'DEFAULT' | 'STRICT' | 'VERBOSE';
    readonly sessionNowMs?: number;
  } = {},
): RuntimeCheckpointCoordinatorWithAnalytics {
  const coordinator    = new RuntimeCheckpointCoordinator(options);
  const trendAnalyzer  = new CheckpointCoordinatorTrendAnalyzer(analyticsOptions.trendWindowSize ?? 20);
  const sessionTracker = new CheckpointCoordinatorSessionTracker(analyticsOptions.sessionNowMs ?? Date.now());
  const eventLog       = new CheckpointCoordinatorEventLog(analyticsOptions.eventLogMax ?? 1024);
  const annotator      = new CheckpointCoordinatorAnnotator(analyticsOptions.annotatorVerbosity ?? 'DEFAULT');
  const inspector      = new CheckpointCoordinatorInspector();

  return Object.freeze({ coordinator, trendAnalyzer, sessionTracker, eventLog, annotator, inspector });
}

/** Build full export bundle from coordinator state. */
export function buildCheckpointExportBundle(
  suite:       RuntimeCheckpointCoordinatorWithAnalytics,
  runId:       string,
  exportedAtMs: number = Date.now(),
): CheckpointExportBundle {
  const { coordinator, trendAnalyzer, sessionTracker, eventLog } = suite;

  const summary  = coordinator.summarizeRun(runId);
  const mlVector = coordinator.extractMLVector(runId);
  const dlTensor = buildCheckpointDLTensor(mlVector);
  const chatSignal = buildCheckpointChatSignal(
    runId, summary, mlVector, coordinator.getDedupHitCount(), exportedAtMs,
  );
  const ops = coordinator.getOperationsLog();
  const annotation = buildCheckpointAnnotation(runId, summary, mlVector, dlTensor, ops, 'VERBOSE');
  const runSummary = buildCheckpointRunSummary(runId, summary, mlVector, coordinator.getDedupHitCount());
  const health     = buildCheckpointHealthSnapshot(runId, mlVector, exportedAtMs);

  trendAnalyzer.record(runSummary);
  sessionTracker.recordCapture(runSummary, exportedAtMs);
  eventLog.append(runId, 'ARCHIVE_BUILT' as unknown as CheckpointOperationKind, mlVector, summary.count, summary.latestTick, exportedAtMs);

  const trendSnapshot  = trendAnalyzer.snapshot();
  const sessionReport  = sessionTracker.report();

  return Object.freeze({
    runId,
    mlVector,
    dlTensor,
    chatSignal,
    annotation,
    runSummary,
    healthSnapshot: health,
    sessionReport,
    trendSnapshot,
    exportedAtMs,
  });
}

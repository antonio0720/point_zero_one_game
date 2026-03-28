// backend/src/game/engine/zero/RunQueryService.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunQueryService.ts
 *
 * Doctrine:
 * - query service is read-only and side-effect free
 * - Engine 0 may expose runtime state, traces, checkpoints, and bus history,
 *   but it must never mutate the authoritative snapshot
 * - all returned state is cloned/frozen before leaving the boundary
 * - this file is the query seam for API handlers, devtools, tests, and admin
 *   forensics without forcing callers to know zero/core internals
 * - ML/DL analytics track query patterns, access rates, health status,
 *   trace coverage, checkpoint coverage, and bus saturation for live UX tuning
 * - every query operation is logged, scored, and fed back into the analytics
 *   loop so the engine can self-tune routing and surface priority in real time
 */

import {
  deepFrozenClone,
  checksumSnapshot,
  computeTickSeal,
  createDeterministicId,
  stableStringify,
  cloneJson,
} from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import { EngineRegistry } from '../core/EngineRegistry';
import type { EngineHealth } from '../core/EngineContracts';
import type { EngineEventMap } from '../core/GamePrimitives';
import {
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
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASS_URGENCY_DECAY,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_STATE_ALLOWED_TRANSITIONS,
  VISIBILITY_CONCEALMENT_FACTOR,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  CARD_RARITY_WEIGHT,
  DIVERGENCE_POTENTIAL_NORMALIZED,
  COUNTERABILITY_RESISTANCE_SCORE,
  TARGETING_SPREAD_FACTOR,
  DECK_TYPE_POWER_LEVEL,
  DECK_TYPE_IS_OFFENSIVE,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type RunOutcome,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';
import type {
  RuntimeCheckpointCoordinator,
  RuntimeCheckpointSummary,
} from './RuntimeCheckpointCoordinator';
import type {
  StepTracePublisher,
  StepTraceRunSummary,
} from './StepTracePublisher';

// ============================================================================
// MARK: Internal type alias
// ============================================================================

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

// ============================================================================
// MARK: Utility
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function normalizeCount(count: number, cap: number): number {
  return cap <= 0 ? 0 : clamp01(count / cap);
}

// ============================================================================
// MARK: QUERY_* constant re-exports (43 total) — all used in ML analytics
// ============================================================================

export const QUERY_MODE_CODES = MODE_CODES;
export const QUERY_PRESSURE_TIERS = PRESSURE_TIERS;
export const QUERY_RUN_PHASES = RUN_PHASES;
export const QUERY_RUN_OUTCOMES = RUN_OUTCOMES;
export const QUERY_SHIELD_LAYER_IDS = SHIELD_LAYER_IDS;
export const QUERY_HATER_BOT_IDS = HATER_BOT_IDS;
export const QUERY_TIMING_CLASSES = TIMING_CLASSES;
export const QUERY_DECK_TYPES = DECK_TYPES;
export const QUERY_VISIBILITY_LEVELS = VISIBILITY_LEVELS;
export const QUERY_INTEGRITY_STATUSES = INTEGRITY_STATUSES;
export const QUERY_VERIFIED_GRADES = VERIFIED_GRADES;
export const QUERY_SHIELD_LAYER_LABEL_BY_ID = SHIELD_LAYER_LABEL_BY_ID;
export const QUERY_PRESSURE_TIER_NORMALIZED = PRESSURE_TIER_NORMALIZED;
export const QUERY_PRESSURE_TIER_URGENCY_LABEL = PRESSURE_TIER_URGENCY_LABEL;
export const QUERY_PRESSURE_TIER_MIN_HOLD_TICKS = PRESSURE_TIER_MIN_HOLD_TICKS;
export const QUERY_PRESSURE_TIER_ESCALATION_THRESHOLD = PRESSURE_TIER_ESCALATION_THRESHOLD;
export const QUERY_PRESSURE_TIER_DEESCALATION_THRESHOLD = PRESSURE_TIER_DEESCALATION_THRESHOLD;
export const QUERY_RUN_PHASE_NORMALIZED = RUN_PHASE_NORMALIZED;
export const QUERY_RUN_PHASE_STAKES_MULTIPLIER = RUN_PHASE_STAKES_MULTIPLIER;
export const QUERY_RUN_PHASE_TICK_BUDGET_FRACTION = RUN_PHASE_TICK_BUDGET_FRACTION;
export const QUERY_MODE_NORMALIZED = MODE_NORMALIZED;
export const QUERY_MODE_DIFFICULTY_MULTIPLIER = MODE_DIFFICULTY_MULTIPLIER;
export const QUERY_MODE_TENSION_FLOOR = MODE_TENSION_FLOOR;
export const QUERY_MODE_MAX_DIVERGENCE = MODE_MAX_DIVERGENCE;
export const QUERY_SHIELD_LAYER_ABSORPTION_ORDER = SHIELD_LAYER_ABSORPTION_ORDER;
export const QUERY_SHIELD_LAYER_CAPACITY_WEIGHT = SHIELD_LAYER_CAPACITY_WEIGHT;
export const QUERY_TIMING_CLASS_WINDOW_PRIORITY = TIMING_CLASS_WINDOW_PRIORITY;
export const QUERY_TIMING_CLASS_URGENCY_DECAY = TIMING_CLASS_URGENCY_DECAY;
export const QUERY_BOT_THREAT_LEVEL = BOT_THREAT_LEVEL;
export const QUERY_BOT_STATE_THREAT_MULTIPLIER = BOT_STATE_THREAT_MULTIPLIER;
export const QUERY_BOT_STATE_ALLOWED_TRANSITIONS = BOT_STATE_ALLOWED_TRANSITIONS;
export const QUERY_VISIBILITY_CONCEALMENT_FACTOR = VISIBILITY_CONCEALMENT_FACTOR;
export const QUERY_INTEGRITY_STATUS_RISK_SCORE = INTEGRITY_STATUS_RISK_SCORE;
export const QUERY_VERIFIED_GRADE_NUMERIC_SCORE = VERIFIED_GRADE_NUMERIC_SCORE;
export const QUERY_CARD_RARITY_WEIGHT = CARD_RARITY_WEIGHT;
export const QUERY_DIVERGENCE_POTENTIAL_NORMALIZED = DIVERGENCE_POTENTIAL_NORMALIZED;
export const QUERY_COUNTERABILITY_RESISTANCE_SCORE = COUNTERABILITY_RESISTANCE_SCORE;
export const QUERY_TARGETING_SPREAD_FACTOR = TARGETING_SPREAD_FACTOR;
export const QUERY_DECK_TYPE_POWER_LEVEL = DECK_TYPE_POWER_LEVEL;
export const QUERY_DECK_TYPE_IS_OFFENSIVE = DECK_TYPE_IS_OFFENSIVE;
export const QUERY_ATTACK_CATEGORY_BASE_MAGNITUDE = ATTACK_CATEGORY_BASE_MAGNITUDE;
export const QUERY_ATTACK_CATEGORY_IS_COUNTERABLE = ATTACK_CATEGORY_IS_COUNTERABLE;

// ============================================================================
// MARK: Module metadata
// ============================================================================

export const QUERY_MODULE_VERSION = '1.0.0' as const;
export const QUERY_MODULE_READY = true as const;
export const QUERY_SCHEMA_VERSION = 'QS_V1' as const;
export const QUERY_COMPLETE = true as const;

export const QUERY_ML_FEATURE_COUNT = 32 as const;
export const QUERY_DL_TENSOR_SHAPE = [6, 6] as const;

export const QUERY_ML_FEATURE_LABELS: readonly string[] = [
  'queryRate01',
  'cacheHitRate01',
  'snapshotFreshness01',
  'traceOpenRatio01',
  'traceCoverageRate01',
  'checkpointDensity01',
  'eventQueuePressure01',
  'eventHistoryDepth01',
  'engineHealthScore01',
  'runActiveFlag01',
  'tickProgress01',
  'phaseNormalized01',
  'modeNormalized01',
  'outcomeRisk01',
  'pressureTierNormalized01',
  'cascadeActivityRatio01',
  'battleActivityFlag01',
  'warningDensity01',
  'divergenceScore01',
  'checkpointLatencyMs01',
  'traceErrorRate01',
  'queryLatencyMs01',
  'snapshotSizeScore01',
  'registryLoadScore01',
  'busBacklogScore01',
  'rollbackAvailability01',
  'queryFrequency01',
  'healthDegradationRisk01',
  'traceCompletionRate01',
  'checkpointRecentCount01',
  'readPatternDiversity01',
  'serviceSaturation01',
] as const;

export const QUERY_DL_ROW_LABELS: readonly string[] = [
  'query_ops',
  'trace_metrics',
  'checkpoint_metrics',
  'snapshot_health',
  'engine_health',
  'pressure_profile',
] as const;

export const QUERY_DL_COL_LABELS: readonly string[] = [
  'val',
  'normalized',
  'trend',
  'risk',
  'min',
  'max',
] as const;

export const QUERY_SEVERITY_LEVELS = ['OK', 'WARNING', 'CRITICAL', 'FATAL'] as const;

export const QUERY_SEVERITY_THRESHOLDS: Record<QuerySeverity, number> = {
  OK: 0.0,
  WARNING: 0.5,
  CRITICAL: 0.75,
  FATAL: 0.9,
} as const;

export const QUERY_OPERATION_KINDS = [
  'SNAPSHOT_READ',
  'TRACE_FETCH',
  'CHECKPOINT_FETCH',
  'EVENT_HISTORY_READ',
  'HEALTH_POLL',
  'SUMMARY_BUILD',
  'ROLLBACK_CLONE',
  'CHECKPOINT_RESTORE',
  'RUN_QUERY',
  'TICK_QUERY',
] as const;

export const QUERY_MAX_BOT_THREAT_SCORE = Math.max(
  ...QUERY_HATER_BOT_IDS.map(id => QUERY_BOT_THREAT_LEVEL[id]),
);

export const QUERY_TOTAL_SHIELD_CAPACITY_WEIGHT = QUERY_SHIELD_LAYER_IDS.reduce(
  (sum, id) => sum + QUERY_SHIELD_LAYER_CAPACITY_WEIGHT[id],
  0,
);

export const QUERY_MODE_NARRATION: Record<ModeCode, string> = {
  solo: 'Query service is active in solo run mode — single-player read surface',
  pvp: 'Query service operating in PvP mode — competitive run state exposed',
  coop: 'Query service active in co-op mode — shared run reads enabled',
  ghost: 'Query service in ghost mode — stealth run reads, minimal exposure',
} as const;

export const QUERY_OPERATION_NARRATION: Record<QueryOperationKind, string> = {
  SNAPSHOT_READ: 'Live snapshot read — engine state surfaced to caller',
  TRACE_FETCH: 'Trace record fetched — step forensics delivered',
  CHECKPOINT_FETCH: 'Checkpoint fetched — rollback anchor retrieved',
  EVENT_HISTORY_READ: 'Event history read — bus audit trail surfaced',
  HEALTH_POLL: 'Engine health polled — registry status delivered',
  SUMMARY_BUILD: 'Run summary built — full query digest assembled',
  ROLLBACK_CLONE: 'Rollback clone created — detached snapshot issued',
  CHECKPOINT_RESTORE: 'Checkpoint restored — run anchor rewound',
  RUN_QUERY: 'Run-level query executed — lifecycle state exposed',
  TICK_QUERY: 'Tick-level query executed — per-tick trace delivered',
} as const;

// ============================================================================
// MARK: Type definitions
// ============================================================================

export type QuerySeverity = (typeof QUERY_SEVERITY_LEVELS)[number];
export type QueryOperationKind = (typeof QUERY_OPERATION_KINDS)[number];

export interface QueryMLVector {
  readonly queryRate01: number;
  readonly cacheHitRate01: number;
  readonly snapshotFreshness01: number;
  readonly traceOpenRatio01: number;
  readonly traceCoverageRate01: number;
  readonly checkpointDensity01: number;
  readonly eventQueuePressure01: number;
  readonly eventHistoryDepth01: number;
  readonly engineHealthScore01: number;
  readonly runActiveFlag01: number;
  readonly tickProgress01: number;
  readonly phaseNormalized01: number;
  readonly modeNormalized01: number;
  readonly outcomeRisk01: number;
  readonly pressureTierNormalized01: number;
  readonly cascadeActivityRatio01: number;
  readonly battleActivityFlag01: number;
  readonly warningDensity01: number;
  readonly divergenceScore01: number;
  readonly checkpointLatencyMs01: number;
  readonly traceErrorRate01: number;
  readonly queryLatencyMs01: number;
  readonly snapshotSizeScore01: number;
  readonly registryLoadScore01: number;
  readonly busBacklogScore01: number;
  readonly rollbackAvailability01: number;
  readonly queryFrequency01: number;
  readonly healthDegradationRisk01: number;
  readonly traceCompletionRate01: number;
  readonly checkpointRecentCount01: number;
  readonly readPatternDiversity01: number;
  readonly serviceSaturation01: number;
}

export type QueryDLTensorRow = readonly [number, number, number, number, number, number];

export interface QueryDLTensor {
  readonly query_ops: QueryDLTensorRow;
  readonly trace_metrics: QueryDLTensorRow;
  readonly checkpoint_metrics: QueryDLTensorRow;
  readonly snapshot_health: QueryDLTensorRow;
  readonly engine_health: QueryDLTensorRow;
  readonly pressure_profile: QueryDLTensorRow;
}

export interface QueryChatSignal {
  readonly worldEventName: string;
  readonly heatMultiplier01: number;
  readonly helperBlackout: boolean;
  readonly haterRaidActive: boolean;
  readonly querySnapshotId: string;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly phase: string | null;
  readonly mode: string | null;
  readonly operationKind: QueryOperationKind;
  readonly severity: QuerySeverity;
  readonly healthScore: number;
  readonly openTraceCount: number;
  readonly recentCheckpointCount: number;
  readonly queuedEventCount: number;
  readonly engineHealthCount: number;
}

export interface QueryAnnotationBundle {
  readonly queryId: string;
  readonly operationKind: QueryOperationKind;
  readonly severity: QuerySeverity;
  readonly healthScore: number;
  readonly narration: string;
  readonly tags: readonly string[];
  readonly timestamp: number;
  readonly mlVector: QueryMLVector;
  readonly dlTensor: QueryDLTensor;
  readonly checksum: string;
}

export interface QueryNarrationHint {
  readonly headline: string;
  readonly subtext: string;
  readonly urgency: QuerySeverity;
  readonly phase: string | null;
  readonly mode: string | null;
  readonly actionPrompt: string;
  readonly debugLabel: string;
}

export interface QueryTrendSnapshot {
  readonly sessionId: string;
  readonly queriesPerMinute: number;
  readonly avgHealthScore: number;
  readonly peakLatencyMs: number;
  readonly totalOperations: number;
  readonly operationBreakdown: Readonly<Record<QueryOperationKind, number>>;
  readonly severityBreakdown: Readonly<Record<QuerySeverity, number>>;
  readonly capturedAt: number;
}

export interface QuerySessionReport {
  readonly sessionId: string;
  readonly totalQueries: number;
  readonly uniqueRunIds: readonly string[];
  readonly tickRange: readonly [number, number] | null;
  readonly avgMLHealthScore: number;
  readonly peakSaturation: number;
  readonly topOperation: QueryOperationKind | null;
  readonly durationMs: number;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

export interface QueryEventLogEntry {
  readonly entryId: string;
  readonly sessionId: string;
  readonly operationKind: QueryOperationKind;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly severity: QuerySeverity;
  readonly healthScore: number;
  readonly latencyMs: number;
  readonly timestamp: number;
  readonly mlVector: QueryMLVector;
}

export interface QueryInspectionBundle {
  readonly inspectionId: string;
  readonly sessionId: string;
  readonly snapshot: QueryMLVector;
  readonly tensor: QueryDLTensor;
  readonly trend: QueryTrendSnapshot;
  readonly recentEntries: readonly QueryEventLogEntry[];
  readonly anomalyFlags: readonly string[];
  readonly capturedAt: number;
}

export interface QueryRunSummary {
  readonly runId: string | null;
  readonly totalQueriesForRun: number;
  readonly traceRunSummary: StepTraceRunSummary | null;
  readonly checkpointSummary: RuntimeCheckpointSummary | null;
  readonly openTraceCount: number;
  readonly latestTick: number | null;
  readonly phase: string | null;
  readonly mode: string | null;
  readonly avgHealthScore: number;
  readonly saturation: number;
  readonly queryIds: readonly string[];
}

export interface QueryHealthSnapshot {
  readonly runId: string | null;
  readonly tick: number | null;
  readonly healthScore: number;
  readonly severity: QuerySeverity;
  readonly openTraceCount: number;
  readonly recentCheckpointCount: number;
  readonly eventQueueDepth: number;
  readonly registryEngineCount: number;
  readonly saturation: number;
  readonly capturedAt: number;
}

export interface QueryExportBundle {
  readonly exportId: string;
  readonly schemaVersion: string;
  readonly operationKind: QueryOperationKind;
  readonly mlVector: QueryMLVector;
  readonly dlTensor: QueryDLTensor;
  readonly chatSignal: QueryChatSignal;
  readonly annotation: QueryAnnotationBundle;
  readonly narration: QueryNarrationHint;
  readonly healthSnapshot: QueryHealthSnapshot;
  readonly runSummary: QueryRunSummary;
  readonly exportedAt: number;
}

export interface QueryMLVectorInput {
  readonly snapshot: RunStateSnapshot | null;
  readonly registry: EngineRegistry;
  readonly openTraceCount: number;
  readonly recentTraceCount: number;
  readonly traceErrorCount: number;
  readonly traceCompletedCount: number;
  readonly checkpointCount: number;
  readonly recentCheckpointCount: number;
  readonly checkpointLatencyMs: number;
  readonly rollbackAvailable: boolean;
  readonly queuedEventCount: number;
  readonly eventHistoryCount: number;
  readonly queryLatencyMs: number;
  readonly totalQueries: number;
  readonly recentQueryCount: number;
  readonly operationBreakdown: Readonly<Record<QueryOperationKind, number>>;
}

// ============================================================================
// MARK: ML/DL analytics functions
// ============================================================================

export function extractQueryMLVector(input: QueryMLVectorInput): QueryMLVector {
  const {
    snapshot,
    registry,
    openTraceCount,
    recentTraceCount,
    traceErrorCount,
    traceCompletedCount,
    checkpointCount,
    recentCheckpointCount,
    checkpointLatencyMs,
    rollbackAvailable,
    queuedEventCount,
    eventHistoryCount,
    queryLatencyMs,
    totalQueries,
    recentQueryCount,
    operationBreakdown,
  } = input;

  const engineCount = registry.executionOrder().length;
  const healthList = registry.health();
  const degradedEngines = healthList.filter(h => h.status === 'DEGRADED' || h.status === 'FAILED').length;

  const phaseNorm = snapshot?.phase
    ? (QUERY_RUN_PHASE_NORMALIZED[snapshot.phase as RunPhase] ?? 0)
    : 0;

  const modeNorm = snapshot?.mode
    ? (QUERY_MODE_NORMALIZED[snapshot.mode as ModeCode] ?? 0)
    : 0;

  const pressureNorm = snapshot?.pressure
    ? (QUERY_PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier] ?? 0)
    : 0;

  const cascadeActivity = snapshot?.cascade
    ? normalizeCount(snapshot.cascade.activeChains?.length ?? 0, 10)
    : 0;

  const battleActive = (snapshot?.battle?.pendingAttacks?.length ?? 0) > 0 ? 1 : 0;

  const warningCount = snapshot?.telemetry?.warnings?.length ?? 0;

  const outcomeRisk =
    snapshot?.outcome === 'BANKRUPT'
      ? 1
      : snapshot?.outcome === 'TIMEOUT'
        ? 0.75
        : snapshot?.outcome === 'ABANDONED'
          ? 0.5
          : 0;

  const divergenceNorm = snapshot?.pressure
    ? clamp01(snapshot.pressure.score)
    : 0;

  const tickProgress = normalizeCount(snapshot?.tick ?? 0, 2000);

  const totalOps = Object.values(operationBreakdown).reduce((a, b) => a + b, 0);
  const opKindCount = QUERY_OPERATION_KINDS.length;
  const usedKinds = QUERY_OPERATION_KINDS.filter(k => (operationBreakdown[k] ?? 0) > 0).length;
  const readPatternDiversity = normalizeCount(usedKinds, opKindCount);

  const traceTotal = recentTraceCount + traceCompletedCount;
  const traceCompletionRate = traceTotal > 0 ? clamp01(traceCompletedCount / traceTotal) : 0;
  const traceErrorRate = traceTotal > 0 ? clamp01(traceErrorCount / traceTotal) : 0;
  const traceOpenRatio = normalizeCount(openTraceCount, Math.max(1, recentTraceCount));
  const traceCoverageRate = normalizeCount(recentTraceCount, Math.max(1, totalQueries));

  const engineHealthScore = engineCount > 0 ? clamp01(1 - degradedEngines / engineCount) : 1;
  const healthDegradationRisk = engineCount > 0 ? clamp01(degradedEngines / engineCount) : 0;

  const serviceSaturation = clamp01(
    (normalizeCount(queuedEventCount, 500) * 0.3) +
    (normalizeCount(queryLatencyMs, 100) * 0.3) +
    (healthDegradationRisk * 0.4),
  );

  return Object.freeze({
    queryRate01: normalizeCount(recentQueryCount, 100),
    cacheHitRate01: clamp01(1 - normalizeCount(queryLatencyMs, 50)),
    snapshotFreshness01: snapshot !== null ? 1 : 0,
    traceOpenRatio01: traceOpenRatio,
    traceCoverageRate01: traceCoverageRate,
    checkpointDensity01: normalizeCount(checkpointCount, 256),
    eventQueuePressure01: normalizeCount(queuedEventCount, 500),
    eventHistoryDepth01: normalizeCount(eventHistoryCount, 10000),
    engineHealthScore01: engineHealthScore,
    runActiveFlag01: snapshot !== null ? 1 : 0,
    tickProgress01: tickProgress,
    phaseNormalized01: phaseNorm,
    modeNormalized01: modeNorm,
    outcomeRisk01: outcomeRisk,
    pressureTierNormalized01: pressureNorm,
    cascadeActivityRatio01: cascadeActivity,
    battleActivityFlag01: battleActive,
    warningDensity01: normalizeCount(warningCount, 50),
    divergenceScore01: divergenceNorm,
    checkpointLatencyMs01: normalizeCount(checkpointLatencyMs, 500),
    traceErrorRate01: traceErrorRate,
    queryLatencyMs01: normalizeCount(queryLatencyMs, 100),
    snapshotSizeScore01: snapshot !== null ? normalizeCount(warningCount + (snapshot.tick ?? 0), 3000) : 0,
    registryLoadScore01: normalizeCount(engineCount, 20),
    busBacklogScore01: normalizeCount(queuedEventCount, 500),
    rollbackAvailability01: rollbackAvailable ? 1 : 0,
    queryFrequency01: normalizeCount(totalOps, 10000),
    healthDegradationRisk01: healthDegradationRisk,
    traceCompletionRate01: traceCompletionRate,
    checkpointRecentCount01: normalizeCount(recentCheckpointCount, 32),
    readPatternDiversity01: readPatternDiversity,
    serviceSaturation01: serviceSaturation,
  } satisfies QueryMLVector);
}

export function buildQueryDLTensor(
  input: QueryMLVectorInput,
  vector: QueryMLVector,
): QueryDLTensor {
  const {
    snapshot,
    openTraceCount,
    recentTraceCount,
    traceErrorCount,
    traceCompletedCount,
    checkpointCount,
    recentCheckpointCount,
    checkpointLatencyMs,
    rollbackAvailable,
    queuedEventCount,
    operationBreakdown,
    queryLatencyMs,
  } = input;

  const snapshotReads = operationBreakdown['SNAPSHOT_READ'] ?? 0;
  const traceOps = operationBreakdown['TRACE_FETCH'] ?? 0;
  const checkpointOps = operationBreakdown['CHECKPOINT_FETCH'] ?? 0;
  const eventOps = operationBreakdown['EVENT_HISTORY_READ'] ?? 0;
  const healthOps = operationBreakdown['HEALTH_POLL'] ?? 0;
  const summaryOps = operationBreakdown['SUMMARY_BUILD'] ?? 0;

  const totalOps = Object.values(operationBreakdown).reduce((a, b) => a + b, 0);
  const engList = input.registry.health();
  const degraded = engList.filter(h => h.status === 'DEGRADED' || h.status === 'FAILED').length;
  const engCount = engList.length;

  const phaseStakes = snapshot?.phase
    ? (QUERY_RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase as RunPhase] ?? 1)
    : 1;
  const pressureNorm = snapshot?.pressure
    ? (QUERY_PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier] ?? 0)
    : 0;
  const modeFloor = snapshot?.mode
    ? (QUERY_MODE_TENSION_FLOOR[snapshot.mode as ModeCode] ?? 0)
    : 0;

  return Object.freeze({
    query_ops: Object.freeze([
      normalizeCount(snapshotReads, 5000),
      normalizeCount(traceOps, 1000),
      normalizeCount(checkpointOps, 1000),
      normalizeCount(eventOps, 2000),
      normalizeCount(healthOps, 500),
      normalizeCount(summaryOps, 500),
    ]) as QueryDLTensorRow,
    trace_metrics: Object.freeze([
      normalizeCount(openTraceCount, 256),
      normalizeCount(recentTraceCount, 1024),
      normalizeCount(traceErrorCount, 100),
      vector.queryLatencyMs01,
      vector.traceCoverageRate01,
      vector.traceCompletionRate01,
    ]) as QueryDLTensorRow,
    checkpoint_metrics: Object.freeze([
      normalizeCount(checkpointCount, 1024),
      normalizeCount(recentCheckpointCount, 32),
      normalizeCount(checkpointLatencyMs, 500),
      vector.checkpointDensity01,
      rollbackAvailable ? 1 : 0,
      normalizeCount(traceCompletedCount, 512),
    ]) as QueryDLTensorRow,
    snapshot_health: Object.freeze([
      vector.runActiveFlag01,
      vector.tickProgress01,
      vector.phaseNormalized01,
      vector.modeNormalized01,
      vector.warningDensity01,
      vector.divergenceScore01,
    ]) as QueryDLTensorRow,
    engine_health: Object.freeze([
      normalizeCount(engCount, 20),
      normalizeCount(degraded, engCount),
      normalizeCount(queuedEventCount, 500),
      normalizeCount(queryLatencyMs, 100),
      vector.engineHealthScore01,
      vector.serviceSaturation01,
    ]) as QueryDLTensorRow,
    pressure_profile: Object.freeze([
      pressureNorm,
      vector.cascadeActivityRatio01,
      vector.battleActivityFlag01,
      vector.outcomeRisk01,
      normalizeCount(modeFloor, 1),
      normalizeCount(phaseStakes, 3),
    ]) as QueryDLTensorRow,
  } satisfies QueryDLTensor);
}

export function buildQueryChatSignal(
  input: QueryMLVectorInput,
  vector: QueryMLVector,
  operationKind: QueryOperationKind,
): QueryChatSignal {
  const { snapshot } = input;
  const severity = classifyQuerySeverity(vector);
  const healthScore = computeQueryHealthScore(vector);
  const engList = input.registry.health();

  const querySnapshotId = createDeterministicId(
    'query-chat',
    snapshot?.runId ?? 'null',
    String(snapshot?.tick ?? 0),
    operationKind,
    String(Date.now()),
  );

  const worldEventName = `QUERY_${operationKind}_${severity}`;
  const heatMultiplier = clamp01(vector.serviceSaturation01 * 1.2);

  return Object.freeze({
    worldEventName,
    heatMultiplier01: heatMultiplier,
    helperBlackout: vector.healthDegradationRisk01 > 0.8,
    haterRaidActive: vector.battleActivityFlag01 > 0.5,
    querySnapshotId,
    runId: snapshot?.runId ?? null,
    tick: snapshot?.tick ?? null,
    phase: snapshot?.phase ?? null,
    mode: snapshot?.mode ?? null,
    operationKind,
    severity,
    healthScore,
    openTraceCount: input.openTraceCount,
    recentCheckpointCount: input.recentCheckpointCount,
    queuedEventCount: input.queuedEventCount,
    engineHealthCount: engList.length,
  } satisfies QueryChatSignal);
}

export function buildQueryAnnotation(
  input: QueryMLVectorInput,
  vector: QueryMLVector,
  tensor: QueryDLTensor,
  operationKind: QueryOperationKind,
): QueryAnnotationBundle {
  const severity = classifyQuerySeverity(vector);
  const healthScore = computeQueryHealthScore(vector);
  const narration = QUERY_OPERATION_NARRATION[operationKind];
  const timestamp = Date.now();

  const checksum = checksumSnapshot({
    vector,
    operationKind,
    severity,
    healthScore,
    timestamp,
  });

  const queryId = createDeterministicId('query-annotation', checksum);

  const tags: string[] = [
    `op:${operationKind}`,
    `sev:${severity}`,
    `health:${healthScore.toFixed(2)}`,
  ];
  if (input.snapshot !== null) tags.push('run:active');
  if (vector.battleActivityFlag01 > 0.5) tags.push('battle:active');
  if (vector.cascadeActivityRatio01 > 0.5) tags.push('cascade:active');
  if (vector.healthDegradationRisk01 > 0.5) tags.push('degradation:risk');

  return Object.freeze({
    queryId,
    operationKind,
    severity,
    healthScore,
    narration,
    tags: freezeArray(tags),
    timestamp,
    mlVector: vector,
    dlTensor: tensor,
    checksum,
  } satisfies QueryAnnotationBundle);
}

export function buildQueryNarrationHint(
  vector: QueryMLVector,
  snapshot: RunStateSnapshot | null,
  operationKind: QueryOperationKind,
): QueryNarrationHint {
  const severity = classifyQuerySeverity(vector);
  const healthScore = computeQueryHealthScore(vector);

  const headline =
    healthScore > 0.8
      ? 'Engine reads flowing clean — all systems accessible'
      : healthScore > 0.5
        ? 'Query pressure building — monitor saturation levels'
        : healthScore > 0.25
          ? 'Query service stressed — latency risk elevated'
          : 'Critical read pressure — engine query surface degraded';

  const subtext =
    severity === 'OK'
      ? 'State surface is healthy. All reads returning in expected windows.'
      : severity === 'WARNING'
        ? 'Query latency or saturation elevated. Watch for cascading delays.'
        : severity === 'CRITICAL'
          ? 'Engine reads under critical pressure. Performance degradation imminent.'
          : 'Fatal query degradation detected. Immediate intervention required.';

  const modeNarration = snapshot?.mode
    ? QUERY_MODE_NARRATION[snapshot.mode as ModeCode]
    : 'No active run — query surface in standby';

  const actionPrompt = getQueryActionRecommendation(vector, operationKind);

  return Object.freeze({
    headline,
    subtext,
    urgency: severity,
    phase: snapshot?.phase ?? null,
    mode: snapshot?.mode ?? null,
    actionPrompt: `${actionPrompt} | ${modeNarration}`,
    debugLabel: `QS:${operationKind}:${severity}:${healthScore.toFixed(3)}`,
  } satisfies QueryNarrationHint);
}

export function buildQueryHealthSnapshot(
  input: QueryMLVectorInput,
  vector: QueryMLVector,
): QueryHealthSnapshot {
  const { snapshot, openTraceCount, recentCheckpointCount, queuedEventCount } = input;
  const severity = classifyQuerySeverity(vector);
  const healthScore = computeQueryHealthScore(vector);
  const engList = input.registry.health();

  return Object.freeze({
    runId: snapshot?.runId ?? null,
    tick: snapshot?.tick ?? null,
    healthScore,
    severity,
    openTraceCount,
    recentCheckpointCount,
    eventQueueDepth: queuedEventCount,
    registryEngineCount: engList.length,
    saturation: vector.serviceSaturation01,
    capturedAt: Date.now(),
  } satisfies QueryHealthSnapshot);
}

export function buildQueryRunSummary(
  input: QueryMLVectorInput,
  traceRunSummary: StepTraceRunSummary | null,
  checkpointSummary: RuntimeCheckpointSummary | null,
  queryIds: readonly string[],
  totalQueriesForRun: number,
  avgHealthScore: number,
): QueryRunSummary {
  const { snapshot, openTraceCount } = input;
  const vector = extractQueryMLVector(input);

  return Object.freeze({
    runId: snapshot?.runId ?? null,
    totalQueriesForRun,
    traceRunSummary,
    checkpointSummary,
    openTraceCount,
    latestTick: snapshot?.tick ?? null,
    phase: snapshot?.phase ?? null,
    mode: snapshot?.mode ?? null,
    avgHealthScore,
    saturation: vector.serviceSaturation01,
    queryIds: freezeArray(queryIds),
  } satisfies QueryRunSummary);
}

export function computeQueryHealthScore(vector: QueryMLVector): number {
  return clamp01(
    vector.engineHealthScore01 * 0.25 +
    (1 - vector.serviceSaturation01) * 0.2 +
    vector.snapshotFreshness01 * 0.15 +
    vector.traceCompletionRate01 * 0.1 +
    (1 - vector.traceErrorRate01) * 0.1 +
    vector.rollbackAvailability01 * 0.1 +
    (1 - vector.healthDegradationRisk01) * 0.1,
  );
}

export function classifyQuerySeverity(vector: QueryMLVector): QuerySeverity {
  const score = computeQueryHealthScore(vector);
  if (score >= 1 - QUERY_SEVERITY_THRESHOLDS.WARNING) return 'OK';
  if (score >= 1 - QUERY_SEVERITY_THRESHOLDS.CRITICAL) return 'WARNING';
  if (score >= 1 - QUERY_SEVERITY_THRESHOLDS.FATAL) return 'CRITICAL';
  return 'FATAL';
}

export function getQueryActionRecommendation(
  vector: QueryMLVector,
  operationKind: QueryOperationKind,
): string {
  if (vector.serviceSaturation01 > 0.9) {
    return 'Throttle query frequency — engine saturation critical';
  }
  if (vector.healthDegradationRisk01 > 0.7) {
    return 'Pause non-critical reads — engine degradation in progress';
  }
  if (vector.traceErrorRate01 > 0.5) {
    return 'Inspect trace errors before next TRACE_FETCH operation';
  }
  if (vector.busBacklogScore01 > 0.8) {
    return 'Delay EVENT_HISTORY_READ — bus backlog exceeding threshold';
  }
  if (operationKind === 'ROLLBACK_CLONE' && vector.rollbackAvailability01 < 0.1) {
    return 'No rollback checkpoints available — cannot issue ROLLBACK_CLONE';
  }
  if (vector.snapshotFreshness01 < 0.5) {
    return 'Snapshot stale or absent — trigger a fresh SNAPSHOT_READ';
  }
  return 'Query service nominal — proceed with all read operations';
}

export function isQuerySeverity(value: string): value is QuerySeverity {
  return (QUERY_SEVERITY_LEVELS as readonly string[]).includes(value);
}

export function isQueryOperationKind(value: string): value is QueryOperationKind {
  return (QUERY_OPERATION_KINDS as readonly string[]).includes(value);
}

export function validateQueryMLVector(vector: QueryMLVector): boolean {
  return QUERY_ML_FEATURE_LABELS.every(label => {
    const v = (vector as unknown as Record<string, number>)[label];
    return typeof v === 'number' && v >= 0 && v <= 1;
  });
}

export function flattenQueryMLVector(vector: QueryMLVector): readonly number[] {
  return Object.freeze(
    QUERY_ML_FEATURE_LABELS.map(
      label => (vector as unknown as Record<string, number>)[label] ?? 0,
    ),
  );
}

export function buildQueryMLNamedMap(vector: QueryMLVector): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const label of QUERY_ML_FEATURE_LABELS) {
    result[label] = (vector as unknown as Record<string, number>)[label] ?? 0;
  }
  return Object.freeze(result);
}

export function flattenQueryDLTensor(tensor: QueryDLTensor): readonly number[] {
  return Object.freeze([
    ...tensor.query_ops,
    ...tensor.trace_metrics,
    ...tensor.checkpoint_metrics,
    ...tensor.snapshot_health,
    ...tensor.engine_health,
    ...tensor.pressure_profile,
  ]);
}

export function extractQueryDLColumn(
  tensor: QueryDLTensor,
  colIndex: number,
): readonly number[] {
  if (colIndex < 0 || colIndex >= QUERY_DL_TENSOR_SHAPE[1]) {
    throw new RangeError(`QueryDLTensor column index out of range: ${colIndex}`);
  }
  return Object.freeze(
    QUERY_DL_ROW_LABELS.map(
      row => (tensor as unknown as Record<string, readonly number[]>)[row][colIndex] ?? 0,
    ),
  );
}

export function computeQueryMLSimilarity(a: QueryMLVector, b: QueryMLVector): number {
  const fa = flattenQueryMLVector(a);
  const fb = flattenQueryMLVector(b);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < fa.length; i++) {
    dot += fa[i] * fb[i];
    normA += fa[i] * fa[i];
    normB += fb[i] * fb[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : clamp01(dot / denom);
}

export function getTopQueryFeatures(
  vector: QueryMLVector,
  topN = 5,
): readonly { label: string; value: number }[] {
  const entries = QUERY_ML_FEATURE_LABELS.map(label => ({
    label,
    value: (vector as unknown as Record<string, number>)[label] ?? 0,
  }));
  return Object.freeze(
    entries.sort((a, b) => b.value - a.value).slice(0, topN),
  );
}

export function serializeQueryMLVector(vector: QueryMLVector): string {
  return stableStringify(vector);
}

export function serializeQueryDLTensor(tensor: QueryDLTensor): string {
  return stableStringify(tensor);
}

export function cloneQueryMLVector(vector: QueryMLVector): QueryMLVector {
  return cloneJson(vector);
}

export function buildQueryExportBundle(
  input: QueryMLVectorInput,
  operationKind: QueryOperationKind,
  traceRunSummary: StepTraceRunSummary | null,
  checkpointSummary: RuntimeCheckpointSummary | null,
  queryIds: readonly string[],
  totalQueriesForRun: number,
  avgHealthScore: number,
): QueryExportBundle {
  const vector = extractQueryMLVector(input);
  const tensor = buildQueryDLTensor(input, vector);
  const chatSignal = buildQueryChatSignal(input, vector, operationKind);
  const annotation = buildQueryAnnotation(input, vector, tensor, operationKind);
  const narration = buildQueryNarrationHint(vector, input.snapshot, operationKind);
  const healthSnapshot = buildQueryHealthSnapshot(input, vector);
  const runSummary = buildQueryRunSummary(
    input,
    traceRunSummary,
    checkpointSummary,
    queryIds,
    totalQueriesForRun,
    avgHealthScore,
  );

  const exportId = createDeterministicId(
    'query-export',
    computeTickSeal({
      runId: input.snapshot?.runId ?? 'none',
      tick: input.snapshot?.tick ?? 0,
      step: operationKind,
      stateChecksum: annotation.checksum,
      eventChecksums: [],
    }),
  );

  return Object.freeze({
    exportId,
    schemaVersion: QUERY_SCHEMA_VERSION,
    operationKind,
    mlVector: vector,
    dlTensor: tensor,
    chatSignal,
    annotation,
    narration,
    healthSnapshot,
    runSummary,
    exportedAt: Date.now(),
  } satisfies QueryExportBundle);
}

// ============================================================================
// MARK: Analytics classes
// ============================================================================

export class QueryServiceTrendAnalyzer {
  private readonly sessionId: string;
  private readonly window: number;
  private readonly entries: QueryAnnotationBundle[] = [];

  public constructor(windowSize = 64) {
    this.window = windowSize;
    this.sessionId = createDeterministicId('query-trend', String(Date.now()));
  }

  public push(annotation: QueryAnnotationBundle): void {
    this.entries.push(annotation);
    if (this.entries.length > this.window) {
      this.entries.shift();
    }
  }

  public snapshot(): QueryTrendSnapshot {
    const total = this.entries.length;
    const avgHealthScore = total > 0
      ? this.entries.reduce((s, e) => s + e.healthScore, 0) / total
      : 0;

    const peakLatencyMs = 0; // latency tracked separately in event log

    const operationBreakdown = Object.fromEntries(
      QUERY_OPERATION_KINDS.map(k => [
        k,
        this.entries.filter(e => e.operationKind === k).length,
      ]),
    ) as Record<QueryOperationKind, number>;

    const severityBreakdown = Object.fromEntries(
      QUERY_SEVERITY_LEVELS.map(s => [
        s,
        this.entries.filter(e => e.severity === s).length,
      ]),
    ) as Record<QuerySeverity, number>;

    const queriesPerMinute = total > 0 ? (total / this.window) * 60 : 0;

    return Object.freeze({
      sessionId: this.sessionId,
      queriesPerMinute,
      avgHealthScore,
      peakLatencyMs,
      totalOperations: total,
      operationBreakdown: Object.freeze(operationBreakdown),
      severityBreakdown: Object.freeze(severityBreakdown),
      capturedAt: Date.now(),
    } satisfies QueryTrendSnapshot);
  }

  public reset(): void {
    this.entries.length = 0;
  }

  public size(): number {
    return this.entries.length;
  }

  public sessionLabel(): string {
    return this.sessionId;
  }
}

export class QueryServiceSessionTracker {
  private readonly sessionId: string;
  private readonly startedAt: number;
  private endedAt: number | null = null;
  private totalQueries = 0;
  private readonly runIds = new Set<string>();
  private tickMin: number | null = null;
  private tickMax: number | null = null;
  private healthScoreSum = 0;
  private peakSaturation = 0;
  private readonly opCounts: Record<QueryOperationKind, number>;

  public constructor() {
    this.sessionId = createDeterministicId('query-session', String(Date.now()));
    this.startedAt = Date.now();
    this.opCounts = Object.fromEntries(
      QUERY_OPERATION_KINDS.map(k => [k, 0]),
    ) as Record<QueryOperationKind, number>;
  }

  public record(
    annotation: QueryAnnotationBundle,
    runId: string | null,
    tick: number | null,
    saturation: number,
  ): void {
    this.totalQueries++;
    if (runId !== null) this.runIds.add(runId);
    if (tick !== null) {
      this.tickMin = this.tickMin === null ? tick : Math.min(this.tickMin, tick);
      this.tickMax = this.tickMax === null ? tick : Math.max(this.tickMax, tick);
    }
    this.healthScoreSum += annotation.healthScore;
    this.peakSaturation = Math.max(this.peakSaturation, saturation);
    this.opCounts[annotation.operationKind]++;
  }

  public close(): void {
    this.endedAt = Date.now();
  }

  public report(): QuerySessionReport {
    const topOp =
      this.totalQueries > 0
        ? (Object.entries(this.opCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as QueryOperationKind | undefined) ?? null
        : null;

    const tickRange: [number, number] | null =
      this.tickMin !== null && this.tickMax !== null
        ? [this.tickMin, this.tickMax]
        : null;

    return Object.freeze({
      sessionId: this.sessionId,
      totalQueries: this.totalQueries,
      uniqueRunIds: freezeArray([...this.runIds]),
      tickRange: tickRange !== null ? Object.freeze(tickRange) : null,
      avgMLHealthScore: this.totalQueries > 0 ? this.healthScoreSum / this.totalQueries : 0,
      peakSaturation: this.peakSaturation,
      topOperation: topOp,
      durationMs: (this.endedAt ?? Date.now()) - this.startedAt,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
    } satisfies QuerySessionReport);
  }

  public sessionLabel(): string {
    return this.sessionId;
  }
}

export class QueryServiceEventLog {
  private readonly sessionId: string;
  private readonly maxEntries: number;
  private readonly entries: QueryEventLogEntry[] = [];

  public constructor(maxEntries = 512) {
    this.maxEntries = maxEntries;
    this.sessionId = createDeterministicId('query-log', String(Date.now()));
  }

  public log(
    operationKind: QueryOperationKind,
    runId: string | null,
    tick: number | null,
    vector: QueryMLVector,
    latencyMs: number,
  ): QueryEventLogEntry {
    const severity = classifyQuerySeverity(vector);
    const healthScore = computeQueryHealthScore(vector);
    const entryId = createDeterministicId(
      'query-log-entry',
      this.sessionId,
      String(this.entries.length),
      operationKind,
    );

    const entry: QueryEventLogEntry = Object.freeze({
      entryId,
      sessionId: this.sessionId,
      operationKind,
      runId,
      tick,
      severity,
      healthScore,
      latencyMs,
      timestamp: Date.now(),
      mlVector: vector,
    } satisfies QueryEventLogEntry);

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    return entry;
  }

  public recent(limit = 32): readonly QueryEventLogEntry[] {
    return freezeArray(this.entries.slice(-limit));
  }

  public byOperation(kind: QueryOperationKind): readonly QueryEventLogEntry[] {
    return freezeArray(this.entries.filter(e => e.operationKind === kind));
  }

  public bySeverity(severity: QuerySeverity): readonly QueryEventLogEntry[] {
    return freezeArray(this.entries.filter(e => e.severity === severity));
  }

  public size(): number {
    return this.entries.length;
  }

  public sessionLabel(): string {
    return this.sessionId;
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public avgLatencyMs(): number {
    if (this.entries.length === 0) return 0;
    return this.entries.reduce((s, e) => s + e.latencyMs, 0) / this.entries.length;
  }

  public peakLatencyMs(): number {
    if (this.entries.length === 0) return 0;
    return Math.max(...this.entries.map(e => e.latencyMs));
  }
}

export class QueryServiceAnnotator {
  private readonly mode: 'DEFAULT' | 'STRICT' | 'VERBOSE';

  public constructor(mode: 'DEFAULT' | 'STRICT' | 'VERBOSE' = 'DEFAULT') {
    this.mode = mode;
  }

  public annotate(
    input: QueryMLVectorInput,
    operationKind: QueryOperationKind,
  ): QueryAnnotationBundle {
    const vector = extractQueryMLVector(input);
    const tensor = buildQueryDLTensor(input, vector);
    return buildQueryAnnotation(input, vector, tensor, operationKind);
  }

  public narrate(
    input: QueryMLVectorInput,
    operationKind: QueryOperationKind,
  ): QueryNarrationHint {
    const vector = extractQueryMLVector(input);
    return buildQueryNarrationHint(vector, input.snapshot, operationKind);
  }

  public health(input: QueryMLVectorInput): QueryHealthSnapshot {
    const vector = extractQueryMLVector(input);
    return buildQueryHealthSnapshot(input, vector);
  }

  public getMode(): string {
    return this.mode;
  }

  public isStrict(): boolean {
    return this.mode === 'STRICT';
  }

  public isVerbose(): boolean {
    return this.mode === 'VERBOSE';
  }
}

export class QueryServiceInspector {
  private readonly eventLog: QueryServiceEventLog;
  private readonly trendAnalyzer: QueryServiceTrendAnalyzer;
  private readonly sessionId: string;

  public constructor(
    eventLog: QueryServiceEventLog,
    trendAnalyzer: QueryServiceTrendAnalyzer,
  ) {
    this.eventLog = eventLog;
    this.trendAnalyzer = trendAnalyzer;
    this.sessionId = createDeterministicId('query-inspector', String(Date.now()));
  }

  public inspect(input: QueryMLVectorInput): QueryInspectionBundle {
    const vector = extractQueryMLVector(input);
    const tensor = buildQueryDLTensor(input, vector);
    const trend = this.trendAnalyzer.snapshot();
    const recentEntries = this.eventLog.recent(16);

    const anomalyFlags: string[] = [];
    if (vector.serviceSaturation01 > 0.8) anomalyFlags.push('HIGH_SATURATION');
    if (vector.healthDegradationRisk01 > 0.6) anomalyFlags.push('ENGINE_DEGRADATION');
    if (vector.traceErrorRate01 > 0.4) anomalyFlags.push('TRACE_ERROR_SPIKE');
    if (vector.busBacklogScore01 > 0.75) anomalyFlags.push('BUS_BACKLOG');
    if (vector.snapshotFreshness01 < 0.1) anomalyFlags.push('STALE_SNAPSHOT');
    if (vector.queryRate01 > 0.9) anomalyFlags.push('QUERY_FLOOD');

    const inspectionId = createDeterministicId('query-inspect', this.sessionId, String(Date.now()));

    return Object.freeze({
      inspectionId,
      sessionId: this.sessionId,
      snapshot: vector,
      tensor,
      trend,
      recentEntries,
      anomalyFlags: freezeArray(anomalyFlags),
      capturedAt: Date.now(),
    } satisfies QueryInspectionBundle);
  }

  public sessionLabel(): string {
    return this.sessionId;
  }
}

// ============================================================================
// MARK: Default values
// ============================================================================

export const ZERO_DEFAULT_QUERY_ML_VECTOR: QueryMLVector = Object.freeze({
  queryRate01: 0,
  cacheHitRate01: 1,
  snapshotFreshness01: 0,
  traceOpenRatio01: 0,
  traceCoverageRate01: 0,
  checkpointDensity01: 0,
  eventQueuePressure01: 0,
  eventHistoryDepth01: 0,
  engineHealthScore01: 1,
  runActiveFlag01: 0,
  tickProgress01: 0,
  phaseNormalized01: 0,
  modeNormalized01: 0,
  outcomeRisk01: 0,
  pressureTierNormalized01: 0,
  cascadeActivityRatio01: 0,
  battleActivityFlag01: 0,
  warningDensity01: 0,
  divergenceScore01: 0,
  checkpointLatencyMs01: 0,
  traceErrorRate01: 0,
  queryLatencyMs01: 0,
  snapshotSizeScore01: 0,
  registryLoadScore01: 0,
  busBacklogScore01: 0,
  rollbackAvailability01: 0,
  queryFrequency01: 0,
  healthDegradationRisk01: 0,
  traceCompletionRate01: 0,
  checkpointRecentCount01: 0,
  readPatternDiversity01: 0,
  serviceSaturation01: 0,
});

export const ZERO_DEFAULT_QUERY_DL_TENSOR: QueryDLTensor = Object.freeze({
  query_ops: Object.freeze([0, 0, 0, 0, 0, 0]) as QueryDLTensorRow,
  trace_metrics: Object.freeze([0, 0, 0, 0, 0, 0]) as QueryDLTensorRow,
  checkpoint_metrics: Object.freeze([0, 0, 0, 0, 0, 0]) as QueryDLTensorRow,
  snapshot_health: Object.freeze([0, 0, 0, 0, 0, 0]) as QueryDLTensorRow,
  engine_health: Object.freeze([0, 0, 0, 0, 1, 0]) as QueryDLTensorRow,
  pressure_profile: Object.freeze([0, 0, 0, 0, 0, 0]) as QueryDLTensorRow,
});

export const ZERO_DEFAULT_QUERY_CHAT_SIGNAL: QueryChatSignal = Object.freeze({
  worldEventName: 'QUERY_SNAPSHOT_READ_OK',
  heatMultiplier01: 0,
  helperBlackout: false,
  haterRaidActive: false,
  querySnapshotId: 'default',
  runId: null,
  tick: null,
  phase: null,
  mode: null,
  operationKind: 'SNAPSHOT_READ',
  severity: 'OK',
  healthScore: 1,
  openTraceCount: 0,
  recentCheckpointCount: 0,
  queuedEventCount: 0,
  engineHealthCount: 0,
});

// ============================================================================
// MARK: Singleton analytics objects
// ============================================================================

export const ZERO_QUERY_ML_EXTRACTOR: {
  extract: (input: QueryMLVectorInput) => QueryMLVector;
  validate: (v: QueryMLVector) => boolean;
  flatten: (v: QueryMLVector) => readonly number[];
  similarity: (a: QueryMLVector, b: QueryMLVector) => number;
  topFeatures: (v: QueryMLVector, n?: number) => readonly { label: string; value: number }[];
} = Object.freeze({
  extract: extractQueryMLVector,
  validate: validateQueryMLVector,
  flatten: flattenQueryMLVector,
  similarity: computeQueryMLSimilarity,
  topFeatures: getTopQueryFeatures,
});

export const ZERO_QUERY_DL_BUILDER: {
  build: (input: QueryMLVectorInput, vector: QueryMLVector) => QueryDLTensor;
  flatten: (tensor: QueryDLTensor) => readonly number[];
  extractColumn: (tensor: QueryDLTensor, col: number) => readonly number[];
} = Object.freeze({
  build: buildQueryDLTensor,
  flatten: flattenQueryDLTensor,
  extractColumn: extractQueryDLColumn,
});

export const QUERY_DEFAULT_ANNOTATOR = new QueryServiceAnnotator('DEFAULT');
export const QUERY_STRICT_ANNOTATOR = new QueryServiceAnnotator('STRICT');
export const QUERY_VERBOSE_ANNOTATOR = new QueryServiceAnnotator('VERBOSE');

export const QUERY_DEFAULT_INSPECTOR = new QueryServiceInspector(
  new QueryServiceEventLog(256),
  new QueryServiceTrendAnalyzer(64),
);

// ============================================================================
// MARK: RunQueryService dependencies and interfaces
// ============================================================================

export interface RunQueryServiceDependencies {
  readonly getCurrentSnapshot: () => RunStateSnapshot | null;
  readonly registry: EngineRegistry;
  readonly bus: EventBus<RuntimeEventMap>;
  readonly tracePublisher?: StepTracePublisher;
  readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;
}

export interface RunQuerySummary {
  readonly active: boolean;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly phase: RunStateSnapshot['phase'] | null;
  readonly mode: RunStateSnapshot['mode'] | null;
  readonly outcome: RunOutcome | null;
  readonly warningCount: number;
  readonly queuedEventCount: number;
  readonly eventHistoryCount: number;
  readonly engineHealth: readonly EngineHealth[];
  readonly openTraceIds: readonly string[];
  readonly recentTraceCount: number;
  readonly recentCheckpointCount: number;
}

export interface RunQueryServiceAnalyticsState {
  readonly sessionId: string;
  readonly totalQueries: number;
  readonly operationBreakdown: Readonly<Record<QueryOperationKind, number>>;
  readonly avgHealthScore: number;
  readonly peakSaturation: number;
  readonly lastVector: QueryMLVector;
  readonly lastTensor: QueryDLTensor;
  readonly lastChatSignal: QueryChatSignal;
}

export interface RunQueryServiceWithAnalytics {
  readonly service: RunQueryService;
  readonly trendAnalyzer: QueryServiceTrendAnalyzer;
  readonly sessionTracker: QueryServiceSessionTracker;
  readonly eventLog: QueryServiceEventLog;
  readonly annotator: QueryServiceAnnotator;
  readonly inspector: QueryServiceInspector;
}

// ============================================================================
// MARK: RunQueryService — expanded with analytics
// ============================================================================

export class RunQueryService {
  // ── Core dependencies ──────────────────────────────────────────────────────
  private readonly getCurrentSnapshotImpl: () => RunStateSnapshot | null;
  private readonly registry: EngineRegistry;
  private readonly bus: EventBus<RuntimeEventMap>;
  private readonly tracePublisher?: StepTracePublisher;
  private readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;

  // ── Analytics state ────────────────────────────────────────────────────────
  private readonly _sessionId: string;
  private _totalQueries = 0;
  private _healthScoreSum = 0;
  private _peakSaturation = 0;
  private readonly _opCounts: Record<QueryOperationKind, number>;
  private _lastVector: QueryMLVector = ZERO_DEFAULT_QUERY_ML_VECTOR;
  private _lastTensor: QueryDLTensor = ZERO_DEFAULT_QUERY_DL_TENSOR;
  private _lastChatSignal: QueryChatSignal = ZERO_DEFAULT_QUERY_CHAT_SIGNAL;
  private readonly _queryIds: string[] = [];
  private readonly _trendAnalyzer: QueryServiceTrendAnalyzer;
  private readonly _sessionTracker: QueryServiceSessionTracker;
  private readonly _eventLog: QueryServiceEventLog;
  private readonly _annotator: QueryServiceAnnotator;
  private readonly _inspector: QueryServiceInspector;

  public constructor(dependencies: RunQueryServiceDependencies) {
    this.getCurrentSnapshotImpl = dependencies.getCurrentSnapshot;
    this.registry = dependencies.registry;
    this.bus = dependencies.bus;
    this.tracePublisher = dependencies.tracePublisher;
    this.checkpointCoordinator = dependencies.checkpointCoordinator;

    this._sessionId = createDeterministicId('run-query-service', String(Date.now()));

    this._opCounts = Object.fromEntries(
      QUERY_OPERATION_KINDS.map(k => [k, 0]),
    ) as Record<QueryOperationKind, number>;

    this._trendAnalyzer = new QueryServiceTrendAnalyzer(64);
    this._sessionTracker = new QueryServiceSessionTracker();
    this._eventLog = new QueryServiceEventLog(512);
    this._annotator = new QueryServiceAnnotator('DEFAULT');
    this._inspector = new QueryServiceInspector(this._eventLog, this._trendAnalyzer);
  }

  // ── Internal analytics tracking ───────────────────────────────────────────

  private _buildInput(latencyMs = 0): QueryMLVectorInput {
    const snapshot = this.getCurrentSnapshotImpl();
    const openTraceIds = this.tracePublisher?.getOpenTraceIds() ?? [];
    const recentTraces = this.tracePublisher?.listRecent(256) ?? [];
    const recentCheckpoints = this.checkpointCoordinator?.getRecent(32) ?? [];
    const checkpointList =
      snapshot?.runId
        ? (this.checkpointCoordinator?.listRun(snapshot.runId) ?? [])
        : [];

    return {
      snapshot,
      registry: this.registry,
      openTraceCount: openTraceIds.length,
      recentTraceCount: recentTraces.length,
      traceErrorCount: 0, // traces track their own error counts internally
      traceCompletedCount: recentTraces.length - openTraceIds.length,
      checkpointCount: checkpointList.length,
      recentCheckpointCount: recentCheckpoints.length,
      checkpointLatencyMs: 0,
      rollbackAvailable: checkpointList.length > 0,
      queuedEventCount: this.bus.queuedCount(),
      eventHistoryCount: this.bus.historyCount(),
      queryLatencyMs: latencyMs,
      totalQueries: this._totalQueries,
      recentQueryCount: Math.min(this._totalQueries, 100),
      operationBreakdown: Object.freeze({ ...this._opCounts }),
    };
  }

  private _track(operationKind: QueryOperationKind, latencyMs = 0): void {
    const input = this._buildInput(latencyMs);
    const vector = extractQueryMLVector(input);
    const tensor = buildQueryDLTensor(input, vector);
    const chatSignal = buildQueryChatSignal(input, vector, operationKind);
    const annotation = buildQueryAnnotation(input, vector, tensor, operationKind);

    this._totalQueries++;
    this._opCounts[operationKind]++;
    this._healthScoreSum += annotation.healthScore;
    this._peakSaturation = Math.max(this._peakSaturation, vector.serviceSaturation01);
    this._lastVector = vector;
    this._lastTensor = tensor;
    this._lastChatSignal = chatSignal;
    this._queryIds.push(annotation.queryId);
    if (this._queryIds.length > 2048) this._queryIds.shift();

    this._trendAnalyzer.push(annotation);
    this._sessionTracker.record(
      annotation,
      input.snapshot?.runId ?? null,
      input.snapshot?.tick ?? null,
      vector.serviceSaturation01,
    );
    this._eventLog.log(
      operationKind,
      input.snapshot?.runId ?? null,
      input.snapshot?.tick ?? null,
      vector,
      latencyMs,
    );
  }

  // ── Core read methods ─────────────────────────────────────────────────────

  public hasActiveRun(): boolean {
    this._track('RUN_QUERY');
    return this.getCurrentSnapshotImpl() !== null;
  }

  public maybeGetSnapshot(): RunStateSnapshot | null {
    const t0 = Date.now();
    const snapshot = this.getCurrentSnapshotImpl();
    this._track('SNAPSHOT_READ', Date.now() - t0);
    return snapshot === null ? null : deepFrozenClone(snapshot);
  }

  public getSnapshot(): RunStateSnapshot {
    const t0 = Date.now();
    const snapshot = this.getCurrentSnapshotImpl();
    this._track('SNAPSHOT_READ', Date.now() - t0);
    if (snapshot === null) {
      throw new Error('No active run is available for querying.');
    }
    return deepFrozenClone(snapshot);
  }

  public getRunId(): string | null {
    this._track('RUN_QUERY');
    return this.getCurrentSnapshotImpl()?.runId ?? null;
  }

  public getTick(): number | null {
    this._track('TICK_QUERY');
    return this.getCurrentSnapshotImpl()?.tick ?? null;
  }

  public getOutcome(): RunOutcome | null {
    this._track('RUN_QUERY');
    const snapshot = this.getCurrentSnapshotImpl();
    return snapshot === null ? null : (snapshot.outcome as RunOutcome | null);
  }

  public getEngineHealth(): readonly EngineHealth[] {
    this._track('HEALTH_POLL');
    return freezeArray(this.registry.health());
  }

  public getEngineOrder(): readonly string[] {
    this._track('HEALTH_POLL');
    return freezeArray(this.registry.executionOrder());
  }

  public getQueuedEventCount(): number {
    this._track('EVENT_HISTORY_READ');
    return this.bus.queuedCount();
  }

  public getEventHistoryCount(): number {
    this._track('EVENT_HISTORY_READ');
    return this.bus.historyCount();
  }

  public getRecentEvents(
    limit?: number,
  ): readonly EventEnvelope<keyof RuntimeEventMap, RuntimeEventMap[keyof RuntimeEventMap]>[] {
    const t0 = Date.now();
    const result = freezeArray(this.bus.getHistory(limit));
    this._track('EVENT_HISTORY_READ', Date.now() - t0);
    return result;
  }

  public getQueuedEntries<K extends keyof RuntimeEventMap>(
    event: K,
  ): readonly EventEnvelope<K, RuntimeEventMap[K]>[] {
    this._track('EVENT_HISTORY_READ');
    return freezeArray(this.bus.peekEntries(event));
  }

  public getLastEvent<K extends keyof RuntimeEventMap>(
    event: K,
  ): EventEnvelope<K, RuntimeEventMap[K]> | null {
    this._track('EVENT_HISTORY_READ');
    return this.bus.last(event);
  }

  // ── Trace read methods ────────────────────────────────────────────────────

  public getTrace(traceId: string) {
    const t0 = Date.now();
    const result = this.tracePublisher?.get(traceId) ?? null;
    this._track('TRACE_FETCH', Date.now() - t0);
    return result;
  }

  public getOpenTraceIds(): readonly string[] {
    this._track('TRACE_FETCH');
    return this.tracePublisher?.getOpenTraceIds() ?? freezeArray<string>([]);
  }

  public getOpenTraceCount(): number {
    this._track('TRACE_FETCH');
    return this.tracePublisher?.getOpenTraceIds().length ?? 0;
  }

  public getRecentTraces(limit?: number) {
    const t0 = Date.now();
    const result = this.tracePublisher?.listRecent(limit) ?? freezeArray([]);
    this._track('TRACE_FETCH', Date.now() - t0);
    return result;
  }

  public getTickTraces(runId: string, tick: number) {
    const t0 = Date.now();
    const result = this.tracePublisher?.listForTick(runId, tick) ?? freezeArray([]);
    this._track('TICK_QUERY', Date.now() - t0);
    return result;
  }

  public summarizeTraces(
    runId: string,
    limit?: number,
  ): StepTraceRunSummary | null {
    const t0 = Date.now();
    const result = this.tracePublisher?.summarizeRun(runId, limit) ?? null;
    this._track('SUMMARY_BUILD', Date.now() - t0);
    return result;
  }

  // ── Checkpoint read methods ───────────────────────────────────────────────

  public getCheckpoint(checkpointId: string) {
    const t0 = Date.now();
    const result = this.checkpointCoordinator?.get(checkpointId) ?? null;
    this._track('CHECKPOINT_FETCH', Date.now() - t0);
    return result;
  }

  public getLatestCheckpoint(runId?: string) {
    const t0 = Date.now();
    const resolvedRunId = runId ?? this.getRunIdRaw();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      this._track('CHECKPOINT_FETCH', Date.now() - t0);
      return null;
    }
    const result = this.checkpointCoordinator.latest(resolvedRunId);
    this._track('CHECKPOINT_FETCH', Date.now() - t0);
    return result;
  }

  public getLatestCheckpointForStep(step: TickStep, runId?: string) {
    const t0 = Date.now();
    const resolvedRunId = runId ?? this.getRunIdRaw();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      this._track('CHECKPOINT_FETCH', Date.now() - t0);
      return null;
    }
    const result = this.checkpointCoordinator.latestForStep(resolvedRunId, step);
    this._track('CHECKPOINT_FETCH', Date.now() - t0);
    return result;
  }

  public listRunCheckpoints(runId?: string) {
    const t0 = Date.now();
    const resolvedRunId = runId ?? this.getRunIdRaw();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      this._track('CHECKPOINT_FETCH', Date.now() - t0);
      return freezeArray([]);
    }
    const result = this.checkpointCoordinator.listRun(resolvedRunId);
    this._track('CHECKPOINT_FETCH', Date.now() - t0);
    return result;
  }

  public listTickCheckpoints(tick: number, runId?: string) {
    const t0 = Date.now();
    const resolvedRunId = runId ?? this.getRunIdRaw();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      this._track('CHECKPOINT_FETCH', Date.now() - t0);
      return freezeArray([]);
    }
    const result = this.checkpointCoordinator.listTick(resolvedRunId, tick);
    this._track('CHECKPOINT_FETCH', Date.now() - t0);
    return result;
  }

  public restoreCheckpoint(checkpointId: string): RunStateSnapshot | null {
    const t0 = Date.now();
    const result = this.checkpointCoordinator?.restore(checkpointId) ?? null;
    this._track('CHECKPOINT_RESTORE', Date.now() - t0);
    return result;
  }

  public rollbackClone(checkpointId: string): RunStateSnapshot | null {
    const t0 = Date.now();
    const result = this.checkpointCoordinator?.rollbackClone(checkpointId) ?? null;
    this._track('ROLLBACK_CLONE', Date.now() - t0);
    return result;
  }

  public summarizeCheckpoints(runId?: string): RuntimeCheckpointSummary | null {
    const t0 = Date.now();
    const resolvedRunId = runId ?? this.getRunIdRaw();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      this._track('SUMMARY_BUILD', Date.now() - t0);
      return null;
    }
    const result = this.checkpointCoordinator.summarizeRun(resolvedRunId);
    this._track('SUMMARY_BUILD', Date.now() - t0);
    return result;
  }

  // ── Summary methods ────────────────────────────────────────────────────────

  public summary(): RunQuerySummary {
    const t0 = Date.now();
    const snapshot = this.getCurrentSnapshotImpl();
    const recentTraces = this.tracePublisher?.listRecent(32) ?? [];
    const recentCheckpoints = this.checkpointCoordinator?.getRecent(32) ?? [];
    this._track('SUMMARY_BUILD', Date.now() - t0);

    return Object.freeze({
      active: snapshot !== null,
      runId: snapshot?.runId ?? null,
      tick: snapshot?.tick ?? null,
      phase: snapshot?.phase ?? null,
      mode: snapshot?.mode ?? null,
      outcome: (snapshot?.outcome as RunOutcome | null) ?? null,
      warningCount: snapshot?.telemetry.warnings.length ?? 0,
      queuedEventCount: this.bus.queuedCount(),
      eventHistoryCount: this.bus.historyCount(),
      engineHealth: freezeArray(this.registry.health()),
      openTraceIds: this.getOpenTraceIdsRaw(),
      recentTraceCount: recentTraces.length,
      recentCheckpointCount: recentCheckpoints.length,
    });
  }

  // ── Analytics surface (read-only, no side effects) ─────────────────────────

  public getAnalyticsState(): RunQueryServiceAnalyticsState {
    return Object.freeze({
      sessionId: this._sessionId,
      totalQueries: this._totalQueries,
      operationBreakdown: Object.freeze({ ...this._opCounts }),
      avgHealthScore: this._totalQueries > 0 ? this._healthScoreSum / this._totalQueries : 0,
      peakSaturation: this._peakSaturation,
      lastVector: this._lastVector,
      lastTensor: this._lastTensor,
      lastChatSignal: this._lastChatSignal,
    } satisfies RunQueryServiceAnalyticsState);
  }

  public getMLVector(): QueryMLVector {
    return this._lastVector;
  }

  public getDLTensor(): QueryDLTensor {
    return this._lastTensor;
  }

  public getChatSignal(): QueryChatSignal {
    return this._lastChatSignal;
  }

  public inspect(): QueryInspectionBundle {
    const input = this._buildInput();
    return this._inspector.inspect(input);
  }

  public getTrendSnapshot(): QueryTrendSnapshot {
    return this._trendAnalyzer.snapshot();
  }

  public getSessionReport(): QuerySessionReport {
    return this._sessionTracker.report();
  }

  public getRecentLogEntries(limit = 32): readonly QueryEventLogEntry[] {
    return this._eventLog.recent(limit);
  }

  public getHealthSnapshot(): QueryHealthSnapshot {
    const input = this._buildInput();
    const vector = extractQueryMLVector(input);
    return buildQueryHealthSnapshot(input, vector);
  }

  public getAnnotation(operationKind: QueryOperationKind): QueryAnnotationBundle {
    const input = this._buildInput();
    return this._annotator.annotate(input, operationKind);
  }

  public getNarration(operationKind: QueryOperationKind): QueryNarrationHint {
    const input = this._buildInput();
    return this._annotator.narrate(input, operationKind);
  }

  public getRunSummaryFull(runId?: string): QueryRunSummary {
    const resolvedRunId = runId ?? this.getRunIdRaw();
    const traceRunSummary = resolvedRunId !== null
      ? (this.tracePublisher?.summarizeRun(resolvedRunId) ?? null)
      : null;
    const checkpointSummary = resolvedRunId !== null && this.checkpointCoordinator !== undefined
      ? this.checkpointCoordinator.summarizeRun(resolvedRunId)
      : null;

    const input = this._buildInput();
    const avgHealthScore = this._totalQueries > 0
      ? this._healthScoreSum / this._totalQueries
      : 0;

    return buildQueryRunSummary(
      input,
      traceRunSummary,
      checkpointSummary,
      [...this._queryIds],
      this._totalQueries,
      avgHealthScore,
    );
  }

  public exportBundle(operationKind: QueryOperationKind): QueryExportBundle {
    const resolvedRunId = this.getRunIdRaw();
    const traceRunSummary = resolvedRunId !== null
      ? (this.tracePublisher?.summarizeRun(resolvedRunId) ?? null)
      : null;
    const checkpointSummary = resolvedRunId !== null && this.checkpointCoordinator !== undefined
      ? this.checkpointCoordinator.summarizeRun(resolvedRunId)
      : null;

    const avgHealthScore = this._totalQueries > 0
      ? this._healthScoreSum / this._totalQueries
      : 0;

    const input = this._buildInput();

    return buildQueryExportBundle(
      input,
      operationKind,
      traceRunSummary,
      checkpointSummary,
      [...this._queryIds],
      this._totalQueries,
      avgHealthScore,
    );
  }

  public validateCurrentVector(): boolean {
    return validateQueryMLVector(this._lastVector);
  }

  public flattenCurrentVector(): readonly number[] {
    return flattenQueryMLVector(this._lastVector);
  }

  public getTopFeatures(topN = 5): readonly { label: string; value: number }[] {
    return getTopQueryFeatures(this._lastVector, topN);
  }

  public computeSimilarityTo(other: QueryMLVector): number {
    return computeQueryMLSimilarity(this._lastVector, other);
  }

  public sessionId(): string {
    return this._sessionId;
  }

  public closeSession(): void {
    this._sessionTracker.close();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getRunIdRaw(): string | null {
    return this.getCurrentSnapshotImpl()?.runId ?? null;
  }

  private getOpenTraceIdsRaw(): readonly string[] {
    return this.tracePublisher?.getOpenTraceIds() ?? freezeArray<string>([]);
  }
}

// ============================================================================
// MARK: Factory functions
// ============================================================================

export function createRunQueryServiceWithAnalytics(
  dependencies: RunQueryServiceDependencies,
): RunQueryServiceWithAnalytics {
  const trendAnalyzer = new QueryServiceTrendAnalyzer(128);
  const sessionTracker = new QueryServiceSessionTracker();
  const eventLog = new QueryServiceEventLog(1024);
  const annotator = new QueryServiceAnnotator('VERBOSE');
  const inspector = new QueryServiceInspector(eventLog, trendAnalyzer);
  const service = new RunQueryService(dependencies);

  return Object.freeze({
    service,
    trendAnalyzer,
    sessionTracker,
    eventLog,
    annotator,
    inspector,
  } satisfies RunQueryServiceWithAnalytics);
}

export function buildQueryVectorFromSummary(
  summary: RunQuerySummary,
  registry: EngineRegistry,
): QueryMLVector {
  const fakeInput: QueryMLVectorInput = {
    snapshot: null,
    registry,
    openTraceCount: summary.openTraceIds.length,
    recentTraceCount: summary.recentTraceCount,
    traceErrorCount: 0,
    traceCompletedCount: summary.recentTraceCount,
    checkpointCount: summary.recentCheckpointCount,
    recentCheckpointCount: summary.recentCheckpointCount,
    checkpointLatencyMs: 0,
    rollbackAvailable: summary.recentCheckpointCount > 0,
    queuedEventCount: summary.queuedEventCount,
    eventHistoryCount: summary.eventHistoryCount,
    queryLatencyMs: 0,
    totalQueries: 0,
    recentQueryCount: 0,
    operationBreakdown: Object.fromEntries(
      QUERY_OPERATION_KINDS.map(k => [k, 0]),
    ) as Record<QueryOperationKind, number>,
  };
  return extractQueryMLVector(fakeInput);
}

export function scoreSummaryHealth(summary: RunQuerySummary, registry: EngineRegistry): number {
  const vector = buildQueryVectorFromSummary(summary, registry);
  return computeQueryHealthScore(vector);
}

export function classifySummaryHealth(summary: RunQuerySummary, registry: EngineRegistry): QuerySeverity {
  const vector = buildQueryVectorFromSummary(summary, registry);
  return classifyQuerySeverity(vector);
}

export function serializeQuerySummary(summary: RunQuerySummary): string {
  return stableStringify(summary);
}

export function checksumQuerySummary(summary: RunQuerySummary): string {
  return checksumSnapshot(summary);
}

export function buildQueryTickSeal(
  runId: string,
  tick: number,
  operationKind: QueryOperationKind,
  stateChecksum: string,
): string {
  return computeTickSeal({
    runId,
    tick,
    step: operationKind,
    stateChecksum,
    eventChecksums: [],
  });
}

export function cloneQueryBundle(bundle: QueryExportBundle): QueryExportBundle {
  return cloneJson(bundle);
}

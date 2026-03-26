/*
 * POINT ZERO ONE — BACKEND SHIELD ENGINE
 * /backend/src/game/engine/shield/ShieldEngine.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - backend shield simulation is authoritative
 * - shield consumes attacks, applies routed damage, manages repairs, and emits
 *   downstream breach/cascade surfaces without calling other engines directly
 * - economy consequences remain outside shield; cascade and card systems react later
 * - this engine returns EngineTickResult so orchestration gets diagnostics, not just state
 * - ML/DL extraction is a first-class concern — every tick produces a labeled vector
 * - mode-aware and phase-aware behavior is baked into cascade sensitivity, regen
 *   multipliers, breach escalation thresholds, and health resolution logic
 * - ghost mode: L3 AND L4 breaches trigger cascade chains (ghost-echo doctrine)
 * - sovereignty phase: L4 breach immediately escalates engine health to FAILED
 * - companion classes (MLExtractor, DLBuilder, TrendAnalyzer, ResilienceForecaster,
 *   Annotator, Inspector, Analytics) follow the PressureEngine companion pattern
 *
 * Surface summary:
 *   § 1  — Module constants and manifest metadata
 *   § 2  — ML and DL feature label arrays
 *   § 3  — Subsystem constants (mode/phase tables)
 *   § 4  — Type definitions (ML vector, DL tensor, summaries, bundles)
 *   § 5  — Pure helper functions (extraction, scoring, annotation, UX)
 *   § 6  — ShieldMLExtractor — ML vector builder
 *   § 7  — ShieldDLBuilder — DL tensor sequence builder
 *   § 8  — ShieldTrendAnalyzer — velocity and acceleration over history
 *   § 9  — ShieldResilienceForecaster — recovery timeline estimation
 *   § 10 — ShieldAnnotator — human-readable breach/repair annotation bundles
 *   § 11 — ShieldInspector — full diagnostic state snapshot
 *   § 12 — ShieldAnalytics — session-level aggregate analytics
 *   § 13 — Factory functions and ensemble builders
 *   § 14 — ShieldEngine — enhanced simulation engine (production)
 *   § 15 — SHIELD_ENGINE_MANIFEST
 */

import {
  createEngineHealth,
  createEngineSignal,
  createEngineSignalFull,
  type EngineHealth,
  type EngineSignal,
  type EngineSignalCategory,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
} from '../core/EngineContracts';
import {
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_THREAT_LEVEL,
  classifyAttackSeverity,
  classifyThreatUrgency,
  computeAggregateThreatPressure,
  computeEffectiveStakes,
  computePressureRiskScore,
  computeShieldIntegrityRatio,
  computeShieldLayerVulnerability,
  estimateShieldRegenPerTick,
  isEndgamePhase,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_NORMALIZED,
  MODE_TENSION_FLOOR,
  PRESSURE_TIER_NORMALIZED,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  scoreAttackResponseUrgency,
  scoreThreatUrgency,
  type AttackEvent,
  type AttackSeverityClass,
  type ModeCode,
  type RunPhase,
  type ThreatUrgencyClass,
} from '../core/GamePrimitives';
import type { RunStateSnapshot, ShieldLayerState } from '../core/RunStateSnapshot';
import { AttackRouter } from './AttackRouter';
import { BreachCascadeResolver } from './BreachCascadeResolver';
import { ShieldLayerManager } from './ShieldLayerManager';
import { ShieldRepairQueue } from './ShieldRepairQueue';
import { ShieldUXBridge } from './ShieldUXBridge';
import {
  SHIELD_CONSTANTS,
  SHIELD_LAYER_CONFIGS,
  SHIELD_LAYER_ORDER,
  type CascadeResolution,
  type QueueRejection,
  type RepairJob,
  type RepairLayerId,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Module constants and manifest metadata
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_ENGINE_MODULE_VERSION = '2026.03.25' as const;
export const SHIELD_ENGINE_READY = true as const;

/** Total ML features produced per tick. */
export const SHIELD_ENGINE_ML_FEATURE_COUNT = 48 as const;

/** Total DL row features per time-step. */
export const SHIELD_ENGINE_DL_FEATURE_COUNT = 64 as const;

/** DL sequence length (ticks retained in rolling window). */
export const SHIELD_ENGINE_DL_SEQUENCE_LENGTH = 8 as const;

/** Rolling history depth for breach / cascade / repair buffers. */
export const SHIELD_HISTORY_DEPTH = 30 as const;

/** Window size for trend velocity and acceleration computation. */
export const SHIELD_TREND_WINDOW = 5 as const;

/** Integrity score at which a layer is considered "low" for forecasting. */
export const SHIELD_FORECAST_LOW_THRESHOLD = 0.30 as const;

/** Integrity score at which a layer is considered "critical" for forecasting. */
export const SHIELD_FORECAST_CRITICAL_THRESHOLD = 0.10 as const;

/** Maximum ticks to simulate in a recovery forecast. */
export const SHIELD_FORECAST_MAX_HORIZON = 20 as const;

/** Urgency bucket labels for shield breach risk. */
export const SHIELD_URGENCY_LABELS = [
  'NONE',
  'LOW',
  'MODERATE',
  'HIGH',
  'CRITICAL',
] as const;

export type ShieldUrgencyLabel = (typeof SHIELD_URGENCY_LABELS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — ML and DL feature label arrays
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical 48-feature ML label set for the shield engine.
 * Every label maps 1:1 to a field on ShieldMLVector.
 * Order is stable across versions — append only.
 */
export const SHIELD_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // 0-3: Layer integrity ratios (0-1)
  'l1_integrity_ratio',
  'l2_integrity_ratio',
  'l3_integrity_ratio',
  'l4_integrity_ratio',
  // 4-7: Layer breach flags (0 or 1)
  'l1_is_breached',
  'l2_is_breached',
  'l3_is_breached',
  'l4_is_breached',
  // 8-10: Aggregate integrity
  'overall_integrity_weighted',
  'weakest_layer_normalized',
  'fortified_flag',
  // 11-14: Run counters (normalized)
  'breach_count_normalized',
  'damage_count_normalized',
  'blocked_count_normalized',
  'repair_queue_depth_normalized',
  // 15-17: Attack surface (current tick)
  'active_attack_count_normalized',
  'max_attack_magnitude',
  'avg_attack_magnitude',
  // 18-19: History depth
  'cascade_history_depth_normalized',
  'breach_history_depth_normalized',
  // 20-23: Vulnerability per layer (0-1)
  'l1_vulnerability',
  'l2_vulnerability',
  'l3_vulnerability',
  'l4_vulnerability',
  // 24-26: Threat surface
  'aggregate_threat_pressure',
  'visible_threat_count_normalized',
  'max_threat_urgency',
  // 27-30: Pressure and tension context
  'pressure_score',
  'pressure_tier_normalized',
  'pressure_risk_score',
  'tension_score',
  // 31-38: Mode and phase context (normalized or multiplier)
  'mode_normalized',
  'phase_normalized',
  'stakes_multiplier',
  'mode_difficulty',
  'mode_cascade_sensitivity',
  'mode_regen_multiplier',
  'phase_regen_bonus',
  'phase_breach_sensitivity',
  // 39-41: Mode / phase flags
  'ghost_mode_flag',
  'sovereignty_phase_flag',
  'endgame_flag',
  // 42-43: Bot threat
  'bot_aggregate_threat',
  'highest_bot_threat_active',
  // 44: Attack response urgency
  'attack_response_urgency_max',
  // 45-47: Composite scores
  'shield_stress_index',
  'resilience_score',
  'breach_risk_score',
]);

/**
 * Canonical 64-feature DL row label set for the shield engine.
 * Each row represents one tick in the DL sequence.
 * The first 48 features mirror ShieldMLVector; features 48-63 add temporal context.
 */
export const SHIELD_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  // 0-47: Mirror of SHIELD_ML_FEATURE_LABELS
  'l1_integrity_ratio',
  'l2_integrity_ratio',
  'l3_integrity_ratio',
  'l4_integrity_ratio',
  'l1_is_breached',
  'l2_is_breached',
  'l3_is_breached',
  'l4_is_breached',
  'overall_integrity_weighted',
  'weakest_layer_normalized',
  'fortified_flag',
  'breach_count_normalized',
  'damage_count_normalized',
  'blocked_count_normalized',
  'repair_queue_depth_normalized',
  'active_attack_count_normalized',
  'max_attack_magnitude',
  'avg_attack_magnitude',
  'cascade_history_depth_normalized',
  'breach_history_depth_normalized',
  'l1_vulnerability',
  'l2_vulnerability',
  'l3_vulnerability',
  'l4_vulnerability',
  'aggregate_threat_pressure',
  'visible_threat_count_normalized',
  'max_threat_urgency',
  'pressure_score',
  'pressure_tier_normalized',
  'pressure_risk_score',
  'tension_score',
  'mode_normalized',
  'phase_normalized',
  'stakes_multiplier',
  'mode_difficulty',
  'mode_cascade_sensitivity',
  'mode_regen_multiplier',
  'phase_regen_bonus',
  'phase_breach_sensitivity',
  'ghost_mode_flag',
  'sovereignty_phase_flag',
  'endgame_flag',
  'bot_aggregate_threat',
  'highest_bot_threat_active',
  'attack_response_urgency_max',
  'shield_stress_index',
  'resilience_score',
  'breach_risk_score',
  // 48-63: Temporal / delta context (per-tick, not per-run)
  'l1_regen_estimated',
  'l2_regen_estimated',
  'l3_regen_estimated',
  'l4_regen_estimated',
  'attack_count_this_tick',
  'damage_event_this_tick',
  'breach_event_this_tick',
  'cascade_event_this_tick',
  'repair_slices_this_tick',
  'l1_last_damaged_recency',
  'l2_last_damaged_recency',
  'l3_last_damaged_recency',
  'l4_last_damaged_recency',
  'blocked_ratio',
  'tick_normalized',
  'composite_health_score',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Subsystem constants (mode / phase lookup tables)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cascade trigger sensitivity per mode.
 * Higher values mean the engine is more likely to escalate cascade chains.
 * Ghost mode is hyper-sensitive — both L3 and L4 breach trigger cascades.
 */
export const SHIELD_MODE_CASCADE_SENSITIVITY: Readonly<Record<ModeCode, number>> =
  Object.freeze({
    solo:  1.0,
    pvp:   1.2,
    coop:  0.9,
    ghost: 2.0,
  });

/**
 * Regeneration rate multiplier per mode applied on top of base layer regen.
 * Ghost mode is the most punishing — regen is suppressed.
 */
export const SHIELD_MODE_REGEN_MULTIPLIER: Readonly<Record<ModeCode, number>> =
  Object.freeze({
    solo:  1.0,
    pvp:   0.85,
    coop:  1.15,
    ghost: 0.75,
  });

/**
 * Regen bonus per phase. FOUNDATION gives a boost for early-game recovery.
 * SOVEREIGNTY suppresses regen — every tick at peak stakes.
 */
export const SHIELD_PHASE_REGEN_BONUS: Readonly<Record<RunPhase, number>> =
  Object.freeze({
    FOUNDATION:  1.25,
    ESCALATION:  1.0,
    SOVEREIGNTY: 0.80,
  });

/**
 * Breach impact sensitivity per phase.
 * SOVEREIGNTY breaches carry higher consequences; FOUNDATION is more forgiving.
 */
export const SHIELD_PHASE_BREACH_SENSITIVITY: Readonly<Record<RunPhase, number>> =
  Object.freeze({
    FOUNDATION:  0.85,
    ESCALATION:  1.0,
    SOVEREIGNTY: 1.35,
  });

/**
 * Ghost mode cascade layers — both L3 and L4 trigger cascade chains.
 * Standard mode only cascades on L4 breach (the cascade gate).
 */
export const SHIELD_GHOST_CASCADE_LAYERS: readonly string[] = Object.freeze(['L3', 'L4']);

/**
 * Maximum normalized bot aggregate threat (all 5 bots ATTACKING at peak).
 * Used to clamp the bot_aggregate_threat ML feature to [0, 1].
 */
export const SHIELD_MAX_BOT_AGGREGATE_THREAT = 2.95 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Type definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 48-dimensional feature vector emitted by ShieldMLExtractor every tick.
 * Fields map 1:1 to SHIELD_ML_FEATURE_LABELS (index-stable).
 */
export interface ShieldMLVector {
  // Layer integrity (0-1)
  readonly l1_integrity_ratio: number;
  readonly l2_integrity_ratio: number;
  readonly l3_integrity_ratio: number;
  readonly l4_integrity_ratio: number;
  // Layer breach flags (0 = intact, 1 = breached)
  readonly l1_is_breached: number;
  readonly l2_is_breached: number;
  readonly l3_is_breached: number;
  readonly l4_is_breached: number;
  // Aggregate integrity
  readonly overall_integrity_weighted: number;
  readonly weakest_layer_normalized: number;
  readonly fortified_flag: number;
  // Run counters (clamped to [0, 1] via soft normalization)
  readonly breach_count_normalized: number;
  readonly damage_count_normalized: number;
  readonly blocked_count_normalized: number;
  readonly repair_queue_depth_normalized: number;
  // Attack surface
  readonly active_attack_count_normalized: number;
  readonly max_attack_magnitude: number;
  readonly avg_attack_magnitude: number;
  // History depth
  readonly cascade_history_depth_normalized: number;
  readonly breach_history_depth_normalized: number;
  // Vulnerability per layer
  readonly l1_vulnerability: number;
  readonly l2_vulnerability: number;
  readonly l3_vulnerability: number;
  readonly l4_vulnerability: number;
  // Threat surface
  readonly aggregate_threat_pressure: number;
  readonly visible_threat_count_normalized: number;
  readonly max_threat_urgency: number;
  // Pressure and tension context
  readonly pressure_score: number;
  readonly pressure_tier_normalized: number;
  readonly pressure_risk_score: number;
  readonly tension_score: number;
  // Mode and phase context
  readonly mode_normalized: number;
  readonly phase_normalized: number;
  readonly stakes_multiplier: number;
  readonly mode_difficulty: number;
  readonly mode_cascade_sensitivity: number;
  readonly mode_regen_multiplier: number;
  readonly phase_regen_bonus: number;
  readonly phase_breach_sensitivity: number;
  // Mode / phase flags
  readonly ghost_mode_flag: number;
  readonly sovereignty_phase_flag: number;
  readonly endgame_flag: number;
  // Bot threat
  readonly bot_aggregate_threat: number;
  readonly highest_bot_threat_active: number;
  // Urgency
  readonly attack_response_urgency_max: number;
  // Composite scores
  readonly shield_stress_index: number;
  readonly resilience_score: number;
  readonly breach_risk_score: number;
}

/**
 * DL tensor for the shield engine — a rolling window of DL row vectors.
 * Each row is a 64-dimensional snapshot of one tick.
 */
export interface ShieldDLTensor {
  readonly rows: ReadonlyArray<readonly number[]>;
  readonly tick: number;
  readonly sequenceLength: number;
  readonly featureCount: number;
}

/**
 * Single-tick summary of shield integrity trend.
 * Computed over SHIELD_TREND_WINDOW recent history entries.
 */
export interface ShieldTrendSummary {
  readonly velocity: number;
  readonly velocityAvg: number;
  readonly acceleration: number;
  readonly accelerationAvg: number;
  readonly plateauTicks: number;
  readonly spikeDetected: boolean;
  readonly recoveryDetected: boolean;
  readonly overallIntegrityHistory: readonly number[];
  readonly trendLabel: 'RECOVERING' | 'STABLE' | 'DECLINING' | 'COLLAPSING';
}

/**
 * Recovery forecast for one or more shield layers.
 * Estimates ticks until each layer recovers past LOW or CRITICAL threshold.
 */
export interface ShieldLayerForecast {
  readonly layerId: string;
  readonly currentIntegrity: number;
  readonly estimatedTicksToLow: number | null;
  readonly estimatedTicksToCritical: number | null;
  readonly estimatedTicksToFull: number | null;
  readonly regenPerTick: number;
  readonly forecastedIntegrityAt5: number;
  readonly forecastedIntegrityAt10: number;
  readonly recoveryLikely: boolean;
}

/**
 * Full recovery forecast across all four shield layers.
 */
export interface ShieldForecast {
  readonly layers: readonly ShieldLayerForecast[];
  readonly overallRecoveryLikely: boolean;
  readonly ticksToSafeIntegrity: number | null;
  readonly highestRiskLayerId: string;
  readonly forecastMode: ModeCode;
  readonly forecastPhase: RunPhase;
  readonly modeRegenMultiplier: number;
  readonly phaseRegenBonus: number;
  readonly effectiveRegenMultiplier: number;
}

/**
 * Human-readable annotation for a shield event (breach, repair, cascade).
 */
export interface ShieldAnnotationEntry {
  readonly tick: number;
  readonly layerId: string;
  readonly eventType: 'BREACH' | 'REPAIR' | 'CASCADE' | 'REGEN' | 'FORTIFIED' | 'WARNING';
  readonly severity: AttackSeverityClass | 'INFO';
  readonly threatUrgency: ThreatUrgencyClass | null;
  readonly message: string;
  readonly tags: readonly string[];
}

/**
 * Full annotation bundle for a shield engine tick.
 */
export interface ShieldAnnotationBundle {
  readonly tick: number;
  readonly entries: readonly ShieldAnnotationEntry[];
  readonly urgencyLabel: ShieldUrgencyLabel;
  readonly summaryMessage: string;
  readonly overallIntegrity: number;
  readonly weakestLayerId: string;
  readonly cascadePending: boolean;
}

/**
 * UX hint projected toward the chat lane and player experience layer.
 */
export interface ShieldUXHint {
  readonly tick: number;
  readonly urgency: ShieldUrgencyLabel;
  readonly primaryMessage: string;
  readonly secondaryMessage: string | null;
  readonly channelSuggestion: 'shield_breach' | 'shield_warning' | 'shield_repair' | 'shield_status';
  readonly layerFocusId: string | null;
  readonly chatHook: string;
  readonly suppressInCalmTick: boolean;
}

/**
 * Single history entry — one snapshot of overall shield integrity per tick.
 */
export interface ShieldHistoryEntry {
  readonly tick: number;
  readonly overallIntegrity: number;
  readonly weakestLayerId: string;
  readonly weakestIntegrity: number;
  readonly breachCountThisTick: number;
  readonly cascadeCountThisTick: number;
  readonly repairCountThisTick: number;
  readonly attackCountThisTick: number;
  readonly fortified: boolean;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
}

/**
 * Full inspector snapshot — everything needed for debug / replay tooling.
 */
export interface ShieldInspectorState {
  readonly engineId: 'shield';
  readonly tick: number;
  readonly health: EngineHealth;
  readonly overallIntegrity: number;
  readonly layerStates: readonly ShieldLayerState[];
  readonly weakestLayerId: string;
  readonly fortified: boolean;
  readonly breachHistory: readonly string[];
  readonly cascadeHistory: readonly string[];
  readonly repairJobCount: number;
  readonly mlVector: ShieldMLVector;
  readonly trendSummary: ShieldTrendSummary;
  readonly forecast: ShieldForecast;
  readonly annotationBundle: ShieldAnnotationBundle;
  readonly uxHint: ShieldUXHint;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly ghostModeActive: boolean;
  readonly sovereigntyPhaseActive: boolean;
}

/**
 * Session-level aggregate analytics over the full run history.
 */
export interface ShieldAnalyticsSummary {
  readonly totalBreaches: number;
  readonly totalCascades: number;
  readonly totalRepairJobs: number;
  readonly totalAttacksProcessed: number;
  readonly avgOverallIntegrity: number;
  readonly minOverallIntegrity: number;
  readonly maxOverallIntegrity: number;
  readonly breachRatePerTick: number;
  readonly cascadeRatePerTick: number;
  readonly ticksFortified: number;
  readonly fortifiedRatio: number;
  readonly ticksInCritical: number;
  readonly criticalRatio: number;
  readonly mostBreachedLayerId: string | null;
  readonly totalTicksTracked: number;
}

/**
 * Health state derived from analytics — used for UX status projection.
 */
export interface ShieldHealthState {
  readonly status: 'FORTIFIED' | 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'FAILED';
  readonly overallIntegrity: number;
  readonly weakestLayerId: string;
  readonly weakestIntegrity: number;
  readonly message: string;
}

/**
 * Mode-specific profile for the shield engine.
 */
export interface ShieldModeProfile {
  readonly mode: ModeCode;
  readonly cascadeSensitivity: number;
  readonly regenMultiplier: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly ghostModeActive: boolean;
  readonly modeNormalized: number;
}

/**
 * Phase-specific profile for the shield engine.
 */
export interface ShieldPhaseProfile {
  readonly phase: RunPhase;
  readonly regenBonus: number;
  readonly breachSensitivity: number;
  readonly stakesMultiplier: number;
  readonly phaseNormalized: number;
  readonly endgameActive: boolean;
  readonly effectiveStakes: number;
}

/**
 * Ensemble that bundles all companion class outputs for one tick.
 */
export interface ShieldEnsemble {
  readonly mlVector: ShieldMLVector;
  readonly dlTensor: ShieldDLTensor;
  readonly trendSummary: ShieldTrendSummary;
  readonly forecast: ShieldForecast;
  readonly annotationBundle: ShieldAnnotationBundle;
  readonly uxHint: ShieldUXHint;
  readonly modeProfile: ShieldModeProfile;
  readonly phaseProfile: ShieldPhaseProfile;
}

/**
 * Input params for ML feature extraction.
 */
export interface ShieldMLFeaturesParams {
  readonly snapshot: RunStateSnapshot;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly breachHistory: readonly string[];
  readonly cascadeHistory: readonly string[];
  readonly repairJobs: readonly RepairJob[];
  readonly tick: number;
  readonly attacksThisTick: readonly AttackEvent[];
}

/**
 * Input params for DL row construction.
 */
export interface ShieldDLRowParams extends ShieldMLFeaturesParams {
  readonly breachEventsThisTick: number;
  readonly cascadeEventsThisTick: number;
  readonly repairSlicesThisTick: number;
  readonly damageEventsThisTick: number;
}

/**
 * Input params for recovery forecast.
 */
export interface ShieldForecastParams {
  readonly snapshot: RunStateSnapshot;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly horizonTicks?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — Pure helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map ShieldLayerState array to the format expected by GamePrimitives.computeShieldIntegrityRatio.
 * This adapter is required because the primitive uses `id` but ShieldLayerState uses `layerId`.
 */
export function mapLayersForIntegrityRatio(
  layers: readonly ShieldLayerState[],
): ReadonlyArray<{ readonly id: import('../core/GamePrimitives').ShieldLayerId; readonly current: number; readonly max: number }> {
  return layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max }));
}

/**
 * Compute the weighted overall integrity ratio from a set of ShieldLayerState values.
 * Uses GamePrimitives.computeShieldIntegrityRatio with SHIELD_LAYER_CAPACITY_WEIGHT.
 */
export function computeWeightedShieldIntegrity(
  layers: readonly ShieldLayerState[],
): number {
  return computeShieldIntegrityRatio(mapLayersForIntegrityRatio(layers));
}

/**
 * Normalize a shield layer ID to a [0, 1] index value (L1=0, L2=0.33, L3=0.67, L4=1.0).
 */
export function normalizeLayerIndex(layerId: string): number {
  const index = SHIELD_LAYER_ORDER.indexOf(layerId as 'L1' | 'L2' | 'L3' | 'L4');
  return index < 0 ? 1.0 : index / (SHIELD_LAYER_ORDER.length - 1);
}

/**
 * Compute aggregate bot threat (0-1) from the battle snapshot bots array.
 */
export function computeBotAggregateThreat(
  snapshot: RunStateSnapshot,
): number {
  const bots = snapshot.battle.bots;
  const raw = bots.reduce((sum, bot) => {
    const threatLevel = BOT_THREAT_LEVEL[bot.botId];
    const stateMultiplier = BOT_STATE_THREAT_MULTIPLIER[bot.state];
    return sum + threatLevel * stateMultiplier;
  }, 0);
  return Math.min(1.0, raw / SHIELD_MAX_BOT_AGGREGATE_THREAT);
}

/**
 * Compute the highest single-bot threat score among currently active bots.
 */
export function computeHighestActiveBotThreat(
  snapshot: RunStateSnapshot,
): number {
  const bots = snapshot.battle.bots;
  let max = 0;
  for (const bot of bots) {
    const val = BOT_THREAT_LEVEL[bot.botId] * BOT_STATE_THREAT_MULTIPLIER[bot.state];
    if (val > max) max = val;
  }
  return Math.min(1.0, max);
}

/**
 * Compute the shield stress index — a composite 0-1 score combining breach exposure,
 * aggregate threat, and overall integrity deficit.
 *
 * Formula: stress = 0.4 * (1 - overallIntegrity) + 0.3 * threatPressure + 0.3 * breachFrac
 */
export function computeShieldStressIndex(
  overallIntegrity: number,
  aggregateThreatPressure: number,
  layers: readonly ShieldLayerState[],
): number {
  const breachedCount = layers.filter((l) => l.breached).length;
  const breachFrac = breachedCount / Math.max(1, layers.length);
  const raw =
    0.4 * (1.0 - Math.max(0, Math.min(1, overallIntegrity))) +
    0.3 * Math.max(0, Math.min(1, aggregateThreatPressure)) +
    0.3 * breachFrac;
  return Math.min(1.0, Math.max(0, raw));
}

/**
 * Compute the shield resilience score — inverse of breach risk, weighted by repair coverage.
 *
 * Formula: resilience = (1 - breachRisk) * (1 + repairCoverage * 0.2)
 */
export function computeShieldResilienceScore(
  breachRisk: number,
  repairQueueDepth: number,
): number {
  const repairCoverage = Math.min(1.0, repairQueueDepth / 4.0);
  const raw = (1.0 - Math.max(0, Math.min(1, breachRisk))) * (1.0 + repairCoverage * 0.2);
  return Math.min(1.0, Math.max(0, raw));
}

/**
 * Compute shield breach risk — a 0-1 score blending integrity deficit, vulnerability,
 * mode cascade sensitivity, and phase breach sensitivity.
 */
export function computeShieldBreachRisk(
  overallIntegrity: number,
  weakestIntegrity: number,
  mode: ModeCode,
  phase: RunPhase,
  attackCountThisTick: number,
): number {
  const integrityRisk = 1.0 - Math.max(0, Math.min(1, overallIntegrity));
  const weakestRisk = 1.0 - Math.max(0, Math.min(1, weakestIntegrity));
  const cascadeSensitivity = SHIELD_MODE_CASCADE_SENSITIVITY[mode];
  const breachSensitivity = SHIELD_PHASE_BREACH_SENSITIVITY[phase];
  const attackPressure = Math.min(1.0, attackCountThisTick / 6.0);

  const raw =
    (integrityRisk * 0.35 + weakestRisk * 0.35 + attackPressure * 0.30) *
    (cascadeSensitivity / 2.0) *
    breachSensitivity;
  return Math.min(1.0, Math.max(0, raw));
}

/**
 * Classify shield urgency from a breach risk score.
 */
export function classifyShieldUrgency(breachRisk: number): ShieldUrgencyLabel {
  if (breachRisk >= 0.85) return 'CRITICAL';
  if (breachRisk >= 0.60) return 'HIGH';
  if (breachRisk >= 0.35) return 'MODERATE';
  if (breachRisk >= 0.10) return 'LOW';
  return 'NONE';
}

/**
 * Build the chat hook string for a shield UX hint.
 * Chat adapters use this as the canonical entry point for shield lane routing.
 */
export function buildShieldChatHook(
  urgency: ShieldUrgencyLabel,
  layerId: string | null,
  mode: ModeCode,
): string {
  const base = `shield:${urgency.toLowerCase()}`;
  const layerSuffix = layerId !== null ? `:${layerId.toLowerCase()}` : '';
  const modeSuffix = mode === 'ghost' ? ':ghost' : '';
  return `${base}${layerSuffix}${modeSuffix}`;
}

/**
 * Compute attack magnitude statistics for a set of pending attacks.
 */
export function computeAttackMagnitudeStats(
  attacks: readonly AttackEvent[],
): { readonly max: number; readonly avg: number; readonly count: number } {
  if (attacks.length === 0) {
    return { max: 0, avg: 0, count: 0 };
  }
  let total = 0;
  let max = 0;
  for (const attack of attacks) {
    const mag = Math.max(0, Math.min(1, attack.magnitude / 100));
    if (mag > max) max = mag;
    total += mag;
  }
  return {
    max,
    avg: total / attacks.length,
    count: attacks.length,
  };
}

/**
 * Extract the 48-dimensional ML feature vector from engine state.
 * All values are clamped to [0, 1] unless otherwise documented.
 */
export function extractShieldMLFeatures(params: ShieldMLFeaturesParams): ShieldMLVector {
  const { snapshot, mode, phase, breachHistory, cascadeHistory, repairJobs, tick, attacksThisTick } = params;
  const layers = snapshot.shield.layers;

  // Layer integrity
  const l1 = layers.find((l) => l.layerId === 'L1');
  const l2 = layers.find((l) => l.layerId === 'L2');
  const l3 = layers.find((l) => l.layerId === 'L3');
  const l4 = layers.find((l) => l.layerId === 'L4');

  const l1Ratio = l1?.integrityRatio ?? 0;
  const l2Ratio = l2?.integrityRatio ?? 0;
  const l3Ratio = l3?.integrityRatio ?? 0;
  const l4Ratio = l4?.integrityRatio ?? 0;

  // Overall integrity (weighted)
  const overallIntegrity = computeWeightedShieldIntegrity(layers);

  // Weakest layer
  const weakestId = snapshot.shield.weakestLayerId;
  const weakestNorm = normalizeLayerIndex(weakestId);
  const weakestIntegrity = snapshot.shield.weakestLayerRatio;

  // Fortified flag
  const fortified = layers.every((l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD);

  // Run counters (soft-normalized: tanh(x/10) keeps small values distinct)
  const breachCountNorm = Math.min(1.0, snapshot.shield.breachesThisRun / 10.0);
  const damageCountNorm = Math.min(1.0, snapshot.shield.damagedThisRun / 20.0);
  const blockedCountNorm = Math.min(1.0, snapshot.shield.blockedThisRun / 20.0);
  const repairDepthNorm = Math.min(1.0, snapshot.shield.repairQueueDepth / 12.0);

  // Attack surface
  const attackStats = computeAttackMagnitudeStats(attacksThisTick);
  const attackCountNorm = Math.min(1.0, attackStats.count / 8.0);

  // History depth
  const cascadeHistDepthNorm = Math.min(1.0, cascadeHistory.length / SHIELD_HISTORY_DEPTH);
  const breachHistDepthNorm = Math.min(1.0, breachHistory.length / SHIELD_HISTORY_DEPTH);

  // Vulnerability per layer
  const l1Vuln = computeShieldLayerVulnerability('L1', l1?.current ?? 0, l1?.max ?? SHIELD_LAYER_CONFIGS.L1.max);
  const l2Vuln = computeShieldLayerVulnerability('L2', l2?.current ?? 0, l2?.max ?? SHIELD_LAYER_CONFIGS.L2.max);
  const l3Vuln = computeShieldLayerVulnerability('L3', l3?.current ?? 0, l3?.max ?? SHIELD_LAYER_CONFIGS.L3.max);
  const l4Vuln = computeShieldLayerVulnerability('L4', l4?.current ?? 0, l4?.max ?? SHIELD_LAYER_CONFIGS.L4.max);

  // Threat surface
  const threats = snapshot.tension.visibleThreats;
  const aggregateThreat = computeAggregateThreatPressure(threats, tick);
  const threatCountNorm = Math.min(1.0, threats.length / 10.0);
  const maxThreatUrgency =
    threats.length > 0
      ? Math.max(...threats.map((t) => scoreThreatUrgency(t, tick)))
      : 0;

  // Pressure / tension context
  const pressureScore = Math.max(0, Math.min(1, snapshot.pressure.score / 100));
  const pressureTierNorm = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier];
  const pressureRisk = computePressureRiskScore(snapshot.pressure.tier, snapshot.pressure.score);
  const tensionScore = Math.max(0, Math.min(1, snapshot.tension.score));

  // Mode / phase context
  const modeNorm = MODE_NORMALIZED[mode];
  const phaseNorm = RUN_PHASE_NORMALIZED[phase];
  const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[phase];
  const modeDifficulty = Math.min(1.0, MODE_DIFFICULTY_MULTIPLIER[mode] / 1.6);
  const cascadeSensitivity = Math.min(1.0, SHIELD_MODE_CASCADE_SENSITIVITY[mode] / 2.0);
  const regenMult = Math.min(1.0, SHIELD_MODE_REGEN_MULTIPLIER[mode]);
  const regenBonus = Math.min(1.0, SHIELD_PHASE_REGEN_BONUS[phase]);
  const breachSensitivity = Math.min(1.0, SHIELD_PHASE_BREACH_SENSITIVITY[phase] / 1.35);

  // Flags
  const ghostFlag = mode === 'ghost' ? 1 : 0;
  const sovereigntyFlag = phase === 'SOVEREIGNTY' ? 1 : 0;
  const endgameFlag = isEndgamePhase(phase) ? 1 : 0;

  // Bot threat
  const botAgg = computeBotAggregateThreat(snapshot);
  const botHighest = computeHighestActiveBotThreat(snapshot);

  // Attack response urgency
  const attackUrgency =
    attacksThisTick.length > 0
      ? Math.max(...attacksThisTick.map((a) => scoreAttackResponseUrgency(a, tick)))
      : 0;

  // Composite scores
  const stressIndex = computeShieldStressIndex(overallIntegrity, aggregateThreat, layers);
  const breachRisk = computeShieldBreachRisk(overallIntegrity, weakestIntegrity, mode, phase, attackStats.count);
  const resilienceScore = computeShieldResilienceScore(breachRisk, repairJobs.length);

  return Object.freeze<ShieldMLVector>({
    l1_integrity_ratio: l1Ratio,
    l2_integrity_ratio: l2Ratio,
    l3_integrity_ratio: l3Ratio,
    l4_integrity_ratio: l4Ratio,
    l1_is_breached: (l1?.breached ?? false) ? 1 : 0,
    l2_is_breached: (l2?.breached ?? false) ? 1 : 0,
    l3_is_breached: (l3?.breached ?? false) ? 1 : 0,
    l4_is_breached: (l4?.breached ?? false) ? 1 : 0,
    overall_integrity_weighted: overallIntegrity,
    weakest_layer_normalized: weakestNorm,
    fortified_flag: fortified ? 1 : 0,
    breach_count_normalized: breachCountNorm,
    damage_count_normalized: damageCountNorm,
    blocked_count_normalized: blockedCountNorm,
    repair_queue_depth_normalized: repairDepthNorm,
    active_attack_count_normalized: attackCountNorm,
    max_attack_magnitude: attackStats.max,
    avg_attack_magnitude: attackStats.avg,
    cascade_history_depth_normalized: cascadeHistDepthNorm,
    breach_history_depth_normalized: breachHistDepthNorm,
    l1_vulnerability: l1Vuln,
    l2_vulnerability: l2Vuln,
    l3_vulnerability: l3Vuln,
    l4_vulnerability: l4Vuln,
    aggregate_threat_pressure: aggregateThreat,
    visible_threat_count_normalized: threatCountNorm,
    max_threat_urgency: maxThreatUrgency,
    pressure_score: pressureScore,
    pressure_tier_normalized: pressureTierNorm,
    pressure_risk_score: pressureRisk,
    tension_score: tensionScore,
    mode_normalized: modeNorm,
    phase_normalized: phaseNorm,
    stakes_multiplier: stakesMultiplier,
    mode_difficulty: modeDifficulty,
    mode_cascade_sensitivity: cascadeSensitivity,
    mode_regen_multiplier: regenMult,
    phase_regen_bonus: regenBonus,
    phase_breach_sensitivity: breachSensitivity,
    ghost_mode_flag: ghostFlag,
    sovereignty_phase_flag: sovereigntyFlag,
    endgame_flag: endgameFlag,
    bot_aggregate_threat: botAgg,
    highest_bot_threat_active: botHighest,
    attack_response_urgency_max: attackUrgency,
    shield_stress_index: stressIndex,
    resilience_score: resilienceScore,
    breach_risk_score: breachRisk,
  });
}

/**
 * Build a single 64-feature DL row from extended tick params.
 * The first 48 features mirror the ML vector; features 48-63 add per-tick deltas.
 */
export function buildShieldDLRow(params: ShieldDLRowParams): readonly number[] {
  const {
    snapshot,
    mode,
    phase,
    breachHistory,
    cascadeHistory,
    repairJobs,
    tick,
    attacksThisTick,
    breachEventsThisTick,
    cascadeEventsThisTick,
    repairSlicesThisTick,
    damageEventsThisTick,
  } = params;

  const vec = extractShieldMLFeatures({
    snapshot,
    mode,
    phase,
    breachHistory,
    cascadeHistory,
    repairJobs,
    tick,
    attacksThisTick,
  });

  // Base 48 ML features
  const base: number[] = [
    vec.l1_integrity_ratio,
    vec.l2_integrity_ratio,
    vec.l3_integrity_ratio,
    vec.l4_integrity_ratio,
    vec.l1_is_breached,
    vec.l2_is_breached,
    vec.l3_is_breached,
    vec.l4_is_breached,
    vec.overall_integrity_weighted,
    vec.weakest_layer_normalized,
    vec.fortified_flag,
    vec.breach_count_normalized,
    vec.damage_count_normalized,
    vec.blocked_count_normalized,
    vec.repair_queue_depth_normalized,
    vec.active_attack_count_normalized,
    vec.max_attack_magnitude,
    vec.avg_attack_magnitude,
    vec.cascade_history_depth_normalized,
    vec.breach_history_depth_normalized,
    vec.l1_vulnerability,
    vec.l2_vulnerability,
    vec.l3_vulnerability,
    vec.l4_vulnerability,
    vec.aggregate_threat_pressure,
    vec.visible_threat_count_normalized,
    vec.max_threat_urgency,
    vec.pressure_score,
    vec.pressure_tier_normalized,
    vec.pressure_risk_score,
    vec.tension_score,
    vec.mode_normalized,
    vec.phase_normalized,
    vec.stakes_multiplier,
    vec.mode_difficulty,
    vec.mode_cascade_sensitivity,
    vec.mode_regen_multiplier,
    vec.phase_regen_bonus,
    vec.phase_breach_sensitivity,
    vec.ghost_mode_flag,
    vec.sovereignty_phase_flag,
    vec.endgame_flag,
    vec.bot_aggregate_threat,
    vec.highest_bot_threat_active,
    vec.attack_response_urgency_max,
    vec.shield_stress_index,
    vec.resilience_score,
    vec.breach_risk_score,
  ];

  // Temporal features (48-63)
  const layers = snapshot.shield.layers;
  const l1 = layers.find((l) => l.layerId === 'L1');
  const l2 = layers.find((l) => l.layerId === 'L2');
  const l3 = layers.find((l) => l.layerId === 'L3');
  const l4 = layers.find((l) => l.layerId === 'L4');

  // Estimated regen per layer per tick (normalized by max)
  const l1RegenEst = l1 ? Math.min(1.0, estimateShieldRegenPerTick('L1', l1.max) / Math.max(1, l1.max)) : 0;
  const l2RegenEst = l2 ? Math.min(1.0, estimateShieldRegenPerTick('L2', l2.max) / Math.max(1, l2.max)) : 0;
  const l3RegenEst = l3 ? Math.min(1.0, estimateShieldRegenPerTick('L3', l3.max) / Math.max(1, l3.max)) : 0;
  const l4RegenEst = l4 ? Math.min(1.0, estimateShieldRegenPerTick('L4', l4.max) / Math.max(1, l4.max)) : 0;

  // Per-tick event booleans
  const attackCountThisTick = Math.min(1.0, attacksThisTick.length / 8.0);
  const damageFlag = damageEventsThisTick > 0 ? 1.0 : 0.0;
  const breachFlag = breachEventsThisTick > 0 ? 1.0 : 0.0;
  const cascadeFlag = cascadeEventsThisTick > 0 ? 1.0 : 0.0;
  const repairSlicesNorm = Math.min(1.0, repairSlicesThisTick / 4.0);

  // Last-damaged recency per layer (0 = recently, 1 = long ago)
  const recency = (lastTick: number | null): number => {
    if (lastTick === null) return 1.0;
    const delta = tick - lastTick;
    return Math.min(1.0, delta / 10.0);
  };
  const l1Recency = recency(l1?.lastDamagedTick ?? null);
  const l2Recency = recency(l2?.lastDamagedTick ?? null);
  const l3Recency = recency(l3?.lastDamagedTick ?? null);
  const l4Recency = recency(l4?.lastDamagedTick ?? null);

  // Blocked ratio (blocked / total attacks processed this run)
  const totalAttacks = Math.max(1, snapshot.shield.blockedThisRun + snapshot.shield.damagedThisRun);
  const blockedRatio = snapshot.shield.blockedThisRun / totalAttacks;

  // Tick progress (normalized against typical max run tick ~50)
  const tickNorm = Math.min(1.0, tick / 50.0);

  // Composite health score (inverse of stress)
  const compositeHealth = Math.max(0, 1.0 - vec.shield_stress_index);

  const temporal: number[] = [
    l1RegenEst,
    l2RegenEst,
    l3RegenEst,
    l4RegenEst,
    attackCountThisTick,
    damageFlag,
    breachFlag,
    cascadeFlag,
    repairSlicesNorm,
    l1Recency,
    l2Recency,
    l3Recency,
    l4Recency,
    blockedRatio,
    tickNorm,
    compositeHealth,
  ];

  return Object.freeze([...base, ...temporal]);
}

/**
 * Build a shield annotation bundle from engine state.
 * The bundle contains one or more human-readable annotation entries.
 */
export function buildShieldAnnotation(
  snapshot: RunStateSnapshot,
  attacksThisTick: readonly AttackEvent[],
  breachEventsThisTick: number,
  cascadeEventsThisTick: number,
  tick: number,
  mode: ModeCode,
  phase: RunPhase,
): ShieldAnnotationBundle {
  const layers = snapshot.shield.layers;
  const overallIntegrity = computeWeightedShieldIntegrity(layers);
  const weakestId = snapshot.shield.weakestLayerId;
  const weakestIntegrity = snapshot.shield.weakestLayerRatio;
  const breachRisk = computeShieldBreachRisk(overallIntegrity, weakestIntegrity, mode, phase, attacksThisTick.length);
  const urgency = classifyShieldUrgency(breachRisk);

  const entries: ShieldAnnotationEntry[] = [];

  // Breach annotations
  if (breachEventsThisTick > 0) {
    const breachedLayers = layers.filter((l) => l.breached);
    for (const layer of breachedLayers) {
      const config = SHIELD_LAYER_CONFIGS[layer.layerId];
      entries.push({
        tick,
        layerId: layer.layerId,
        eventType: 'BREACH',
        severity: 'CATASTROPHIC',
        threatUrgency: null,
        message: config.breachConsequenceText,
        tags: [`layer:${layer.layerId}`, `mode:${mode}`, `phase:${phase}`],
      });
    }
  }

  // Cascade annotations
  if (cascadeEventsThisTick > 0) {
    entries.push({
      tick,
      layerId: 'L4',
      eventType: 'CASCADE',
      severity: 'CATASTROPHIC',
      threatUrgency: 'CRITICAL',
      message: `Cascade chain triggered at tick ${tick}. Downstream systems will absorb crack damage.`,
      tags: [`cascades:${cascadeEventsThisTick}`, `mode:${mode}`, `phase:${phase}`],
    });
  }

  // Attack-level annotations for severe incoming attacks
  for (const attack of attacksThisTick) {
    const severity = classifyAttackSeverity(attack);
    if (severity === 'CATASTROPHIC' || severity === 'MAJOR') {
      entries.push({
        tick,
        layerId: attack.targetLayer === 'DIRECT' ? weakestId : attack.targetLayer,
        eventType: 'WARNING',
        severity,
        threatUrgency: null,
        message: `${severity} attack (${attack.category}) magnitude ${attack.magnitude} targeting ${attack.targetLayer}.`,
        tags: [`attack:${attack.attackId}`, `category:${attack.category}`, `severity:${severity}`],
      });
    }
  }

  // Threat annotations
  for (const threat of snapshot.tension.visibleThreats) {
    const threatUrgency = classifyThreatUrgency(threat, tick);
    if (threatUrgency === 'CRITICAL' || threatUrgency === 'HIGH') {
      entries.push({
        tick,
        layerId: weakestId,
        eventType: 'WARNING',
        severity: 'MAJOR',
        threatUrgency,
        message: `${threatUrgency} threat from ${threat.source}: "${threat.summary}" (ETA ${threat.etaTicks} ticks).`,
        tags: [`threat:${threat.threatId}`, `urgency:${threatUrgency}`],
      });
    }
  }

  // Low / critical integrity warnings
  for (const layer of layers) {
    if (!layer.breached) {
      if (layer.integrityRatio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) {
        entries.push({
          tick,
          layerId: layer.layerId,
          eventType: 'WARNING',
          severity: 'MAJOR',
          threatUrgency: 'CRITICAL',
          message: `${SHIELD_LAYER_CONFIGS[layer.layerId].doctrineName} is critically low (${(layer.integrityRatio * 100).toFixed(1)}%). Breach imminent.`,
          tags: [`layer:${layer.layerId}`, `integrity:${layer.integrityRatio.toFixed(3)}`],
        });
      } else if (layer.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
        entries.push({
          tick,
          layerId: layer.layerId,
          eventType: 'WARNING',
          severity: 'MODERATE',
          threatUrgency: 'HIGH',
          message: `${SHIELD_LAYER_CONFIGS[layer.layerId].doctrineName} integrity is low (${(layer.integrityRatio * 100).toFixed(1)}%). Monitor closely.`,
          tags: [`layer:${layer.layerId}`, `integrity:${layer.integrityRatio.toFixed(3)}`],
        });
      }
    }
  }

  // Sovereign phase + L4 breach special annotation
  if (phase === 'SOVEREIGNTY' && layers.find((l) => l.layerId === 'L4')?.breached === true) {
    entries.push({
      tick,
      layerId: 'L4',
      eventType: 'BREACH',
      severity: 'CATASTROPHIC',
      threatUrgency: 'CRITICAL',
      message: 'SOVEREIGNTY breach: Network Core is down in the final phase. Engine health set to FAILED.',
      tags: [`sovereignty:true`, `phase:SOVEREIGNTY`, `l4_breach:true`],
    });
  }

  // Ghost mode L3 special annotation
  if (mode === 'ghost' && layers.find((l) => l.layerId === 'L3')?.breached === true) {
    entries.push({
      tick,
      layerId: 'L3',
      eventType: 'CASCADE',
      severity: 'MAJOR',
      threatUrgency: 'HIGH',
      message: 'GHOST echo cascade: Income Base breach triggered cascade chain (ghost-echo doctrine).',
      tags: [`ghost_cascade:true`, `mode:ghost`, `layer:L3`],
    });
  }

  // Summary message
  const summaryParts: string[] = [];
  if (urgency === 'CRITICAL') summaryParts.push('Shield in CRITICAL state.');
  else if (urgency === 'HIGH') summaryParts.push('Shield under HIGH pressure.');
  else if (urgency === 'MODERATE') summaryParts.push('Shield integrity degraded.');
  else summaryParts.push('Shield holding.');
  summaryParts.push(`Overall integrity: ${(overallIntegrity * 100).toFixed(1)}%.`);
  if (breachEventsThisTick > 0) summaryParts.push(`${breachEventsThisTick} layer(s) breached this tick.`);
  if (cascadeEventsThisTick > 0) summaryParts.push(`${cascadeEventsThisTick} cascade(s) triggered.`);

  return Object.freeze({
    tick,
    entries: Object.freeze(entries),
    urgencyLabel: urgency,
    summaryMessage: summaryParts.join(' '),
    overallIntegrity,
    weakestLayerId: weakestId,
    cascadePending: cascadeEventsThisTick > 0,
  });
}

/**
 * Build a UX hint for the shield engine tick.
 * Used by chat adapters to project shield signals toward the player experience.
 */
export function buildShieldUXHint(
  annotation: ShieldAnnotationBundle,
  mode: ModeCode,
  phase: RunPhase,
): ShieldUXHint {
  const { urgencyLabel, weakestLayerId, cascadePending, tick } = annotation;
  const chatHook = buildShieldChatHook(urgencyLabel, weakestLayerId, mode);

  let channelSuggestion: ShieldUXHint['channelSuggestion'] = 'shield_status';
  let primaryMessage = annotation.summaryMessage;
  let secondaryMessage: string | null = null;
  let suppressInCalmTick = true;

  if (cascadePending) {
    channelSuggestion = 'shield_breach';
    primaryMessage = `Cascade chain triggered — ${SHIELD_LAYER_CONFIGS['L4'].breachConsequenceText}`;
    secondaryMessage = `Phase: ${phase}. Mode difficulty at ${MODE_DIFFICULTY_MULTIPLIER[mode]}x.`;
    suppressInCalmTick = false;
  } else if (urgencyLabel === 'CRITICAL' || urgencyLabel === 'HIGH') {
    channelSuggestion = 'shield_breach';
    suppressInCalmTick = false;
    if (phase === 'SOVEREIGNTY') {
      primaryMessage = `SOVEREIGNTY: ${annotation.summaryMessage}`;
      secondaryMessage = 'Every breach in the final phase is permanent. Defend the network core.';
    }
  } else if (urgencyLabel === 'MODERATE') {
    channelSuggestion = 'shield_warning';
    suppressInCalmTick = false;
    secondaryMessage = `Weakest layer: ${weakestLayerId} (${(annotation.overallIntegrity * 100).toFixed(1)}% overall).`;
  } else if (annotation.entries.some((e) => e.eventType === 'REPAIR')) {
    channelSuggestion = 'shield_repair';
    suppressInCalmTick = false;
  }

  return Object.freeze({
    tick,
    urgency: urgencyLabel,
    primaryMessage,
    secondaryMessage,
    channelSuggestion,
    layerFocusId: weakestLayerId,
    chatHook,
    suppressInCalmTick,
  });
}

/**
 * Build a history entry for one tick.
 */
export function buildShieldHistoryEntry(
  snapshot: RunStateSnapshot,
  breachCountThisTick: number,
  cascadeCountThisTick: number,
  repairCountThisTick: number,
  attackCountThisTick: number,
  mode: ModeCode,
  phase: RunPhase,
): ShieldHistoryEntry {
  const layers = snapshot.shield.layers;
  const overallIntegrity = computeWeightedShieldIntegrity(layers);
  const weakestId = snapshot.shield.weakestLayerId;
  const weakestLayer = layers.find((l) => l.layerId === weakestId);
  const fortified = layers.every((l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD);

  return Object.freeze({
    tick: snapshot.tick,
    overallIntegrity,
    weakestLayerId: weakestId,
    weakestIntegrity: weakestLayer?.integrityRatio ?? 0,
    breachCountThisTick,
    cascadeCountThisTick,
    repairCountThisTick,
    attackCountThisTick,
    fortified,
    mode,
    phase,
  });
}

/**
 * Build the mode profile for the shield engine.
 */
export function buildShieldModeProfile(mode: ModeCode): ShieldModeProfile {
  return Object.freeze({
    mode,
    cascadeSensitivity: SHIELD_MODE_CASCADE_SENSITIVITY[mode],
    regenMultiplier: SHIELD_MODE_REGEN_MULTIPLIER[mode],
    difficultyMultiplier: MODE_DIFFICULTY_MULTIPLIER[mode],
    tensionFloor: MODE_TENSION_FLOOR[mode],
    ghostModeActive: mode === 'ghost',
    modeNormalized: MODE_NORMALIZED[mode],
  });
}

/**
 * Build the phase profile for the shield engine.
 */
export function buildShieldPhaseProfile(phase: RunPhase, mode: ModeCode): ShieldPhaseProfile {
  return Object.freeze({
    phase,
    regenBonus: SHIELD_PHASE_REGEN_BONUS[phase],
    breachSensitivity: SHIELD_PHASE_BREACH_SENSITIVITY[phase],
    stakesMultiplier: RUN_PHASE_STAKES_MULTIPLIER[phase],
    phaseNormalized: RUN_PHASE_NORMALIZED[phase],
    endgameActive: isEndgamePhase(phase),
    effectiveStakes: computeEffectiveStakes(phase, mode),
  });
}

/**
 * Compute a layer-level recovery forecast.
 * Estimates ticks until the layer recovers to LOW / CRITICAL / FULL thresholds.
 */
export function buildLayerForecast(
  layer: ShieldLayerState,
  mode: ModeCode,
  phase: RunPhase,
  horizonTicks: number,
): ShieldLayerForecast {
  const regenPerTickBase = estimateShieldRegenPerTick(layer.layerId, layer.max);
  const regenMult = SHIELD_MODE_REGEN_MULTIPLIER[mode] * SHIELD_PHASE_REGEN_BONUS[phase];
  const regenPerTick = regenPerTickBase * regenMult;
  const current = layer.current;
  const max = layer.max;
  const lowHp = max * SHIELD_FORECAST_LOW_THRESHOLD;
  const critHp = max * SHIELD_FORECAST_CRITICAL_THRESHOLD;

  const ticksToHp = (target: number): number | null => {
    if (current >= target) return null; // already above target
    if (regenPerTick <= 0) return null; // cannot recover
    return Math.ceil((target - current) / regenPerTick);
  };

  const ticksToLow = ticksToHp(lowHp);
  const ticksToCritical = ticksToHp(critHp);
  const ticksToFull = ticksToHp(max);

  const forecastAt = (ticks: number): number => {
    if (layer.breached && regenPerTick <= 0) return current;
    const projected = current + regenPerTick * ticks;
    return Math.min(max, Math.max(0, projected)) / max;
  };

  const recoveryLikely =
    regenPerTick > 0 &&
    !layer.breached &&
    (ticksToFull === null || (ticksToFull !== null && ticksToFull <= horizonTicks));

  return Object.freeze({
    layerId: layer.layerId,
    currentIntegrity: layer.integrityRatio,
    estimatedTicksToLow: ticksToLow,
    estimatedTicksToCritical: ticksToCritical,
    estimatedTicksToFull: ticksToFull,
    regenPerTick,
    forecastedIntegrityAt5: forecastAt(5),
    forecastedIntegrityAt10: forecastAt(10),
    recoveryLikely,
  });
}

/**
 * Build a full shield recovery forecast across all four layers.
 */
export function buildShieldForecast(params: ShieldForecastParams): ShieldForecast {
  const { snapshot, mode, phase, horizonTicks = SHIELD_FORECAST_MAX_HORIZON } = params;
  const layers = snapshot.shield.layers;

  // Build forecast in absorption order
  const orderedLayers = SHIELD_LAYER_ABSORPTION_ORDER
    .map((id) => layers.find((l) => l.layerId === id))
    .filter((l): l is ShieldLayerState => l !== undefined);

  const layerForecasts = orderedLayers.map((l) =>
    buildLayerForecast(l, mode, phase, horizonTicks),
  );

  const overallRecoveryLikely = layerForecasts.every((f) => f.recoveryLikely || f.currentIntegrity >= SHIELD_FORECAST_LOW_THRESHOLD);

  // Highest risk layer (lowest forecasted integrity at tick 10)
  const highestRisk = [...layerForecasts].sort(
    (a, b) => a.forecastedIntegrityAt10 - b.forecastedIntegrityAt10,
  )[0];

  // Ticks to overall safe integrity (all layers above LOW threshold)
  const maxTicksToSafe = layerForecasts
    .map((f) => f.estimatedTicksToLow)
    .filter((t): t is number => t !== null);
  const ticksToSafeIntegrity = maxTicksToSafe.length > 0 ? Math.max(...maxTicksToSafe) : null;

  const modeRegenMult = SHIELD_MODE_REGEN_MULTIPLIER[mode];
  const phaseRegenBns = SHIELD_PHASE_REGEN_BONUS[phase];

  return Object.freeze({
    layers: layerForecasts,
    overallRecoveryLikely,
    ticksToSafeIntegrity,
    highestRiskLayerId: highestRisk?.layerId ?? 'L4',
    forecastMode: mode,
    forecastPhase: phase,
    modeRegenMultiplier: modeRegenMult,
    phaseRegenBonus: phaseRegenBns,
    effectiveRegenMultiplier: modeRegenMult * phaseRegenBns,
  });
}

/**
 * Compute the trend label from velocity and acceleration values.
 */
export function classifyShieldTrend(
  velocity: number,
  acceleration: number,
  plateauTicks: number,
): ShieldTrendSummary['trendLabel'] {
  if (velocity < -0.05 && acceleration <= 0) return 'COLLAPSING';
  if (velocity < -0.01) return 'DECLINING';
  if (plateauTicks >= 3) return 'STABLE';
  return 'RECOVERING';
}

/**
 * Build the trend summary from a history window of integrity scores.
 */
export function buildShieldTrendSummary(
  history: readonly ShieldHistoryEntry[],
  window: number = SHIELD_TREND_WINDOW,
): ShieldTrendSummary {
  const recent = history.slice(-window);
  const integritySeries = recent.map((h) => h.overallIntegrity);

  if (integritySeries.length < 2) {
    return Object.freeze({
      velocity: 0,
      velocityAvg: 0,
      acceleration: 0,
      accelerationAvg: 0,
      plateauTicks: 0,
      spikeDetected: false,
      recoveryDetected: false,
      overallIntegrityHistory: Object.freeze([...integritySeries]),
      trendLabel: 'STABLE',
    });
  }

  // Velocity = per-tick delta
  const velocities: number[] = [];
  for (let i = 1; i < integritySeries.length; i++) {
    velocities.push((integritySeries[i] ?? 0) - (integritySeries[i - 1] ?? 0));
  }
  const velocity = velocities[velocities.length - 1] ?? 0;
  const velocityAvg = velocities.reduce((s, v) => s + v, 0) / velocities.length;

  // Acceleration = change in velocity
  const accelerations: number[] = [];
  for (let i = 1; i < velocities.length; i++) {
    accelerations.push((velocities[i] ?? 0) - (velocities[i - 1] ?? 0));
  }
  const acceleration = accelerations[accelerations.length - 1] ?? 0;
  const accelerationAvg =
    accelerations.length > 0
      ? accelerations.reduce((s, a) => s + a, 0) / accelerations.length
      : 0;

  // Plateau: consecutive ticks with |velocity| < 0.005
  let plateauTicks = 0;
  for (let i = velocities.length - 1; i >= 0; i--) {
    if (Math.abs(velocities[i] ?? 0) < 0.005) plateauTicks++;
    else break;
  }

  // Spike: any velocity delta > 0.15 in the window
  const spikeDetected = velocities.some((v) => Math.abs(v) >= 0.15);

  // Recovery: sustained positive velocity in last 2 ticks
  const recoveryDetected =
    velocities.length >= 2 &&
    (velocities[velocities.length - 1] ?? 0) > 0.01 &&
    (velocities[velocities.length - 2] ?? 0) > 0;

  const trendLabel = classifyShieldTrend(velocity, acceleration, plateauTicks);

  return Object.freeze({
    velocity,
    velocityAvg,
    acceleration,
    accelerationAvg,
    plateauTicks,
    spikeDetected,
    recoveryDetected,
    overallIntegrityHistory: Object.freeze([...integritySeries]),
    trendLabel,
  });
}

/**
 * Rank layers by vulnerability (most vulnerable first).
 * Returns ordered array of layer IDs.
 */
export function rankLayersByVulnerability(
  layers: readonly ShieldLayerState[],
): readonly string[] {
  return [...layers]
    .sort((a, b) => {
      const aVuln = computeShieldLayerVulnerability(a.layerId, a.current, a.max);
      const bVuln = computeShieldLayerVulnerability(b.layerId, b.current, b.max);
      return bVuln - aVuln;
    })
    .map((l) => l.layerId);
}

/**
 * Build the ShieldHealthState from current layers and context.
 */
export function buildShieldHealthState(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): ShieldHealthState {
  const overallIntegrity = computeWeightedShieldIntegrity(layers);
  const weakest = [...layers].sort((a, b) => a.integrityRatio - b.integrityRatio)[0];
  const weakestId = weakest?.layerId ?? 'L4';
  const weakestIntegrity = weakest?.integrityRatio ?? 0;

  const allBreached = layers.every((l) => l.breached);
  const l4Breached = layers.find((l) => l.layerId === 'L4')?.breached ?? false;
  const fortified = layers.every((l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD);

  let status: ShieldHealthState['status'] = 'HEALTHY';
  let message = 'Shield holding nominal integrity.';

  if (allBreached || (l4Breached && phase === 'SOVEREIGNTY')) {
    status = 'FAILED';
    message = 'All shield layers breached — engine in FAILED state.';
  } else if (l4Breached) {
    status = 'FAILED';
    message = 'Network Core (L4) breached — cascade chains are active.';
  } else if (weakestIntegrity < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) {
    status = 'CRITICAL';
    message = `${weakestId} is critically low (${(weakestIntegrity * 100).toFixed(1)}%). Breach imminent.`;
  } else if (weakestIntegrity < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD || overallIntegrity < 0.5) {
    status = 'DEGRADED';
    message = `Shield degraded. Weakest layer ${weakestId} at ${(weakestIntegrity * 100).toFixed(1)}%.`;
  } else if (fortified) {
    status = 'FORTIFIED';
    message = `All layers fortified above ${(SHIELD_CONSTANTS.FORTIFIED_THRESHOLD * 100).toFixed(0)}% threshold.`;
  }

  const _ = computeEffectiveStakes(phase, mode); // consumed by analytics
  void _;

  return Object.freeze({ status, overallIntegrity, weakestLayerId: weakestId, weakestIntegrity, message });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — ShieldMLExtractor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Companion class that extracts 48-dimensional ML vectors from ShieldEngine state.
 * Maintains a rolling history of vectors for temporal analysis.
 */
export class ShieldMLExtractor {
  private readonly history: ShieldMLVector[] = [];
  private readonly maxHistory: number;

  public constructor(maxHistory = SHIELD_HISTORY_DEPTH) {
    this.maxHistory = maxHistory;
  }

  /**
   * Extract and store a new ML vector from the current engine state.
   * Returns the extracted vector.
   */
  public extract(params: ShieldMLFeaturesParams): ShieldMLVector {
    const vec = extractShieldMLFeatures(params);
    this.history.push(vec);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    return vec;
  }

  /**
   * Return the most recently extracted vector, or null if none exists.
   */
  public getLast(): ShieldMLVector | null {
    return this.history[this.history.length - 1] ?? null;
  }

  /**
   * Return all stored vectors as a frozen array.
   */
  public getHistory(): readonly ShieldMLVector[] {
    return Object.freeze([...this.history]);
  }

  /**
   * Compute the average of a specific feature across the stored history.
   */
  public avgFeature(featureName: keyof ShieldMLVector): number {
    if (this.history.length === 0) return 0;
    const values = this.history.map((v) => v[featureName] as number);
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  /**
   * Compute the max of a specific feature across the stored history.
   */
  public maxFeature(featureName: keyof ShieldMLVector): number {
    if (this.history.length === 0) return 0;
    return Math.max(...this.history.map((v) => v[featureName] as number));
  }

  /**
   * Compute the min of a specific feature across the stored history.
   */
  public minFeature(featureName: keyof ShieldMLVector): number {
    if (this.history.length === 0) return 0;
    return Math.min(...this.history.map((v) => v[featureName] as number));
  }

  /**
   * Convert the last vector to a flat number array (index-stable, matches SHIELD_ML_FEATURE_LABELS).
   */
  public toArray(vec?: ShieldMLVector): readonly number[] {
    const v = vec ?? this.getLast();
    if (v === null) return Object.freeze(new Array<number>(SHIELD_ENGINE_ML_FEATURE_COUNT).fill(0));
    return Object.freeze([
      v.l1_integrity_ratio, v.l2_integrity_ratio, v.l3_integrity_ratio, v.l4_integrity_ratio,
      v.l1_is_breached, v.l2_is_breached, v.l3_is_breached, v.l4_is_breached,
      v.overall_integrity_weighted, v.weakest_layer_normalized, v.fortified_flag,
      v.breach_count_normalized, v.damage_count_normalized, v.blocked_count_normalized, v.repair_queue_depth_normalized,
      v.active_attack_count_normalized, v.max_attack_magnitude, v.avg_attack_magnitude,
      v.cascade_history_depth_normalized, v.breach_history_depth_normalized,
      v.l1_vulnerability, v.l2_vulnerability, v.l3_vulnerability, v.l4_vulnerability,
      v.aggregate_threat_pressure, v.visible_threat_count_normalized, v.max_threat_urgency,
      v.pressure_score, v.pressure_tier_normalized, v.pressure_risk_score, v.tension_score,
      v.mode_normalized, v.phase_normalized, v.stakes_multiplier, v.mode_difficulty,
      v.mode_cascade_sensitivity, v.mode_regen_multiplier, v.phase_regen_bonus, v.phase_breach_sensitivity,
      v.ghost_mode_flag, v.sovereignty_phase_flag, v.endgame_flag,
      v.bot_aggregate_threat, v.highest_bot_threat_active,
      v.attack_response_urgency_max,
      v.shield_stress_index, v.resilience_score, v.breach_risk_score,
    ]);
  }

  /**
   * Clear the stored history.
   */
  public reset(): void {
    this.history.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — ShieldDLBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Companion class that builds rolling 64-feature DL row sequences.
 * Maintains a window of DL_SEQUENCE_LENGTH rows for use as sequence input to DL models.
 */
export class ShieldDLBuilder {
  private readonly rows: Array<readonly number[]> = [];
  private readonly sequenceLength: number;
  private lastTick = -1;

  public constructor(sequenceLength = SHIELD_ENGINE_DL_SEQUENCE_LENGTH) {
    this.sequenceLength = sequenceLength;
  }

  /**
   * Push a new DL row built from the given params.
   * Maintains the rolling window of sequenceLength rows.
   */
  public push(params: ShieldDLRowParams): readonly number[] {
    const row = buildShieldDLRow(params);
    this.rows.push(row);
    if (this.rows.length > this.sequenceLength) {
      this.rows.shift();
    }
    this.lastTick = params.tick;
    return row;
  }

  /**
   * Return the current DL tensor (padded with zeros if fewer than sequenceLength rows).
   */
  public getTensor(): ShieldDLTensor {
    const featureCount = SHIELD_ENGINE_DL_FEATURE_COUNT;
    const pad = this.sequenceLength - this.rows.length;
    const emptyRow = Object.freeze(new Array<number>(featureCount).fill(0));
    const padded = [
      ...Array.from({ length: pad }, () => emptyRow),
      ...this.rows,
    ];
    return Object.freeze({
      rows: Object.freeze(padded),
      tick: this.lastTick,
      sequenceLength: this.sequenceLength,
      featureCount,
    });
  }

  /**
   * Return the most recently pushed row.
   */
  public getLastRow(): readonly number[] | null {
    return this.rows[this.rows.length - 1] ?? null;
  }

  /**
   * Clear the sequence window.
   */
  public reset(): void {
    this.rows.length = 0;
    this.lastTick = -1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — ShieldTrendAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Companion class for tracking integrity trends over a rolling history window.
 * Computes velocity, acceleration, plateau detection, and spike detection.
 */
export class ShieldTrendAnalyzer {
  private readonly history: ShieldHistoryEntry[] = [];
  private readonly maxHistory: number;
  private readonly window: number;

  public constructor(maxHistory = SHIELD_HISTORY_DEPTH, window = SHIELD_TREND_WINDOW) {
    this.maxHistory = maxHistory;
    this.window = window;
  }

  /**
   * Record a new history entry.
   */
  public record(entry: ShieldHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Compute and return the current trend summary.
   */
  public getSummary(): ShieldTrendSummary {
    return buildShieldTrendSummary(this.history, this.window);
  }

  /**
   * Return the raw history as a frozen array.
   */
  public getHistory(): readonly ShieldHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  /**
   * Return the overall integrity series (most recent last).
   */
  public getIntegritySeries(): readonly number[] {
    return Object.freeze(this.history.map((h) => h.overallIntegrity));
  }

  /**
   * Compute the rolling average overall integrity over the last N ticks.
   */
  public rollingAvgIntegrity(n = this.window): number {
    const slice = this.history.slice(-n);
    if (slice.length === 0) return 1.0;
    return slice.reduce((s, h) => s + h.overallIntegrity, 0) / slice.length;
  }

  /**
   * Compute the rolling max breach count over the last N ticks.
   */
  public rollingMaxBreachCount(n = this.window): number {
    const slice = this.history.slice(-n);
    if (slice.length === 0) return 0;
    return Math.max(...slice.map((h) => h.breachCountThisTick));
  }

  /**
   * Compute the rolling cascade rate per tick over the last N ticks.
   */
  public rollingCascadeRate(n = this.window): number {
    const slice = this.history.slice(-n);
    if (slice.length === 0) return 0;
    const total = slice.reduce((s, h) => s + h.cascadeCountThisTick, 0);
    return total / slice.length;
  }

  /**
   * Return true if the shield has been in continuous decline for N ticks.
   */
  public isInContinuousDecline(n = 3): boolean {
    if (this.history.length < n) return false;
    const slice = this.history.slice(-n);
    for (let i = 1; i < slice.length; i++) {
      const prev = slice[i - 1];
      const curr = slice[i];
      if (prev !== undefined && curr !== undefined && curr.overallIntegrity >= prev.overallIntegrity) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clear the history.
   */
  public reset(): void {
    this.history.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — ShieldResilienceForecaster
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Companion class that generates recovery forecasts for the shield engine.
 * Takes the current snapshot and mode/phase context to project future integrity.
 */
export class ShieldResilienceForecaster {
  private lastForecast: ShieldForecast | null = null;
  private readonly defaultHorizon: number;

  public constructor(defaultHorizon = SHIELD_FORECAST_MAX_HORIZON) {
    this.defaultHorizon = defaultHorizon;
  }

  /**
   * Compute and cache a fresh forecast for the current state.
   */
  public compute(params: ShieldForecastParams): ShieldForecast {
    const forecast = buildShieldForecast({
      ...params,
      horizonTicks: params.horizonTicks ?? this.defaultHorizon,
    });
    this.lastForecast = forecast;
    return forecast;
  }

  /**
   * Return the most recent forecast without recomputing.
   */
  public getLast(): ShieldForecast | null {
    return this.lastForecast;
  }

  /**
   * Return the estimated ticks to full recovery for a specific layer.
   */
  public getLayerTicksToFull(layerId: string): number | null {
    if (this.lastForecast === null) return null;
    const layer = this.lastForecast.layers.find((l) => l.layerId === layerId);
    return layer?.estimatedTicksToFull ?? null;
  }

  /**
   * Return true if the forecast projects overall recovery within the horizon.
   */
  public isRecoveryProjected(): boolean {
    return this.lastForecast?.overallRecoveryLikely ?? false;
  }

  /**
   * Simulate what integrity level each layer would be at after N ticks.
   */
  public projectIntegrityAt(snapshot: RunStateSnapshot, mode: ModeCode, phase: RunPhase, ticks: number): Readonly<Record<string, number>> {
    const layers = snapshot.shield.layers;
    const regenMult = SHIELD_MODE_REGEN_MULTIPLIER[mode] * SHIELD_PHASE_REGEN_BONUS[phase];
    const result: Record<string, number> = {};
    for (const layer of layers) {
      const regenPerTick = estimateShieldRegenPerTick(layer.layerId, layer.max) * regenMult;
      const projected = Math.min(layer.max, layer.current + regenPerTick * ticks);
      result[layer.layerId] = layer.max > 0 ? projected / layer.max : 0;
    }
    return Object.freeze(result);
  }

  /**
   * Identify which layers are in danger of breaching within N ticks if attacks continue.
   * Uses current vulnerability and assumes `avgAttackDamagePerTick` incoming damage.
   */
  public identifyLayersAtRisk(
    snapshot: RunStateSnapshot,
    avgAttackDamagePerTick: number,
    horizonTicks: number,
  ): readonly string[] {
    const atRisk: string[] = [];
    for (const layer of snapshot.shield.layers) {
      if (layer.breached) continue;
      const projected = layer.current - avgAttackDamagePerTick * horizonTicks;
      if (projected <= 0) {
        atRisk.push(layer.layerId);
      }
    }
    return Object.freeze(atRisk);
  }

  /**
   * Clear cached forecast.
   */
  public reset(): void {
    this.lastForecast = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — ShieldAnnotator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Companion class that builds annotation bundles and UX hints for each tick.
 * Keeps a log of recent annotation bundles for replay and diagnostics.
 */
export class ShieldAnnotator {
  private readonly bundleHistory: ShieldAnnotationBundle[] = [];
  private readonly uxHistory: ShieldUXHint[] = [];
  private readonly maxHistory: number;

  public constructor(maxHistory = SHIELD_HISTORY_DEPTH) {
    this.maxHistory = maxHistory;
  }

  /**
   * Build and record an annotation bundle for the current tick.
   */
  public annotate(
    snapshot: RunStateSnapshot,
    attacksThisTick: readonly AttackEvent[],
    breachEventsThisTick: number,
    cascadeEventsThisTick: number,
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldAnnotationBundle {
    const bundle = buildShieldAnnotation(
      snapshot,
      attacksThisTick,
      breachEventsThisTick,
      cascadeEventsThisTick,
      snapshot.tick,
      mode,
      phase,
    );
    this.bundleHistory.push(bundle);
    if (this.bundleHistory.length > this.maxHistory) {
      this.bundleHistory.shift();
    }
    return bundle;
  }

  /**
   * Build and record a UX hint from an annotation bundle.
   */
  public buildUXHint(bundle: ShieldAnnotationBundle, mode: ModeCode, phase: RunPhase): ShieldUXHint {
    const hint = buildShieldUXHint(bundle, mode, phase);
    this.uxHistory.push(hint);
    if (this.uxHistory.length > this.maxHistory) {
      this.uxHistory.shift();
    }
    return hint;
  }

  /**
   * Return the most recent annotation bundle.
   */
  public getLastBundle(): ShieldAnnotationBundle | null {
    return this.bundleHistory[this.bundleHistory.length - 1] ?? null;
  }

  /**
   * Return the most recent UX hint.
   */
  public getLastUXHint(): ShieldUXHint | null {
    return this.uxHistory[this.uxHistory.length - 1] ?? null;
  }

  /**
   * Return all recent bundles as a frozen array.
   */
  public getBundleHistory(): readonly ShieldAnnotationBundle[] {
    return Object.freeze([...this.bundleHistory]);
  }

  /**
   * Return the count of CRITICAL urgency ticks in recent history.
   */
  public countCriticalTicks(n = SHIELD_TREND_WINDOW): number {
    return this.bundleHistory
      .slice(-n)
      .filter((b) => b.urgencyLabel === 'CRITICAL')
      .length;
  }

  /**
   * Return true if any recent tick had a cascade event.
   */
  public hadRecentCascade(n = SHIELD_TREND_WINDOW): boolean {
    return this.bundleHistory.slice(-n).some((b) => b.cascadePending);
  }

  /**
   * Clear all annotation history.
   */
  public reset(): void {
    this.bundleHistory.length = 0;
    this.uxHistory.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — ShieldInspector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Companion class that builds full inspector snapshots for debugging and replay.
 * The inspector state bundles all companion outputs into a single diagnostic view.
 */
export class ShieldInspector {
  /**
   * Build a full inspector snapshot from all companion class outputs.
   */
  public buildState(
    engine: ShieldEngine,
    snapshot: RunStateSnapshot,
    mlVec: ShieldMLVector,
    trend: ShieldTrendSummary,
    forecast: ShieldForecast,
    annotation: ShieldAnnotationBundle,
    uxHint: ShieldUXHint,
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldInspectorState {
    const layers = snapshot.shield.layers;
    const overallIntegrity = computeWeightedShieldIntegrity(layers);
    const fortified = layers.every((l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD);

    return Object.freeze({
      engineId: 'shield' as const,
      tick: snapshot.tick,
      health: engine.getHealth(),
      overallIntegrity,
      layerStates: Object.freeze([...layers]),
      weakestLayerId: snapshot.shield.weakestLayerId,
      fortified,
      breachHistory: engine.getBreachHistory(),
      cascadeHistory: engine.getCascadeHistory(),
      repairJobCount: engine.getActiveRepairJobs().length,
      mlVector: mlVec,
      trendSummary: trend,
      forecast,
      annotationBundle: annotation,
      uxHint,
      mode,
      phase,
      ghostModeActive: mode === 'ghost',
      sovereigntyPhaseActive: phase === 'SOVEREIGNTY',
    });
  }

  /**
   * Format the inspector state as a compact diagnostic string for logging.
   */
  public formatDiagnostic(state: ShieldInspectorState): string {
    const integrity = (state.overallIntegrity * 100).toFixed(1);
    const layers = state.layerStates.map((l) => `${l.layerId}:${(l.integrityRatio * 100).toFixed(0)}%`).join(' ');
    return [
      `ShieldInspector[tick=${state.tick}]`,
      `integrity=${integrity}%`,
      `layers=[${layers}]`,
      `health=${state.health.status}`,
      `mode=${state.mode}/${state.phase}`,
      `ghost=${String(state.ghostModeActive)}`,
      `sovereignty=${String(state.sovereigntyPhaseActive)}`,
      `breachHistory=${state.breachHistory.length}`,
      `cascadeHistory=${state.cascadeHistory.length}`,
      `repairs=${state.repairJobCount}`,
      `trend=${state.trendSummary.trendLabel}`,
      `urgency=${state.annotationBundle.urgencyLabel}`,
    ].join(' | ');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — ShieldAnalytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Companion class that computes session-level aggregate analytics.
 * Operates over the full history from ShieldTrendAnalyzer.
 */
export class ShieldAnalytics {
  /**
   * Compute a full analytics summary from the engine's breach/cascade history
   * and the trend analyzer's tick history.
   */
  public computeSummary(
    history: readonly ShieldHistoryEntry[],
    mode: ModeCode,
  ): ShieldAnalyticsSummary {
    const totalTicksTracked = history.length;
    if (totalTicksTracked === 0) {
      return Object.freeze({
        totalBreaches: 0,
        totalCascades: 0,
        totalRepairJobs: 0,
        totalAttacksProcessed: 0,
        avgOverallIntegrity: 1.0,
        minOverallIntegrity: 1.0,
        maxOverallIntegrity: 1.0,
        breachRatePerTick: 0,
        cascadeRatePerTick: 0,
        ticksFortified: 0,
        fortifiedRatio: 0,
        ticksInCritical: 0,
        criticalRatio: 0,
        mostBreachedLayerId: null,
        totalTicksTracked: 0,
      });
    }

    const totalBreaches = history.reduce((s, h) => s + h.breachCountThisTick, 0);
    const totalCascades = history.reduce((s, h) => s + h.cascadeCountThisTick, 0);
    const totalRepairJobs = history.reduce((s, h) => s + h.repairCountThisTick, 0);
    const totalAttacks = history.reduce((s, h) => s + h.attackCountThisTick, 0);

    const integritySeries = history.map((h) => h.overallIntegrity);
    const avgIntegrity = integritySeries.reduce((s, v) => s + v, 0) / integritySeries.length;
    const minIntegrity = Math.min(...integritySeries);
    const maxIntegrity = Math.max(...integritySeries);

    const ticksFortified = history.filter((h) => h.fortified).length;
    const ticksInCritical = history.filter((h) => h.weakestIntegrity < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD).length;

    // Most breached layer (from breach history entries)
    const layerBreachCounts: Record<string, number> = {};
    for (const h of history) {
      if (h.breachCountThisTick > 0) {
        layerBreachCounts[h.weakestLayerId] = (layerBreachCounts[h.weakestLayerId] ?? 0) + h.breachCountThisTick;
      }
    }
    const mostBreachedEntry = Object.entries(layerBreachCounts).sort((a, b) => b[1] - a[1])[0];
    const mostBreachedLayerId = mostBreachedEntry?.[0] ?? null;

    // Mode context consumed to acknowledge mode-aware analytics
    const _tensionFloor = MODE_TENSION_FLOOR[mode];
    void _tensionFloor;

    return Object.freeze({
      totalBreaches,
      totalCascades,
      totalRepairJobs,
      totalAttacksProcessed: totalAttacks,
      avgOverallIntegrity: avgIntegrity,
      minOverallIntegrity: minIntegrity,
      maxOverallIntegrity: maxIntegrity,
      breachRatePerTick: totalBreaches / totalTicksTracked,
      cascadeRatePerTick: totalCascades / totalTicksTracked,
      ticksFortified,
      fortifiedRatio: ticksFortified / totalTicksTracked,
      ticksInCritical,
      criticalRatio: ticksInCritical / totalTicksTracked,
      mostBreachedLayerId,
      totalTicksTracked,
    });
  }

  /**
   * Compute an on-the-fly health state projection from current analytics.
   */
  public projectHealthState(
    summary: ShieldAnalyticsSummary,
    currentLayers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldHealthState {
    return buildShieldHealthState(currentLayers, mode, phase);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — Factory functions and ensemble builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a ShieldEngine wired with all companion classes.
 * Returns a bundle with the engine and all analytics surfaces.
 */
export function createShieldEngineWithAnalytics(): {
  readonly engine: ShieldEngine;
  readonly mlExtractor: ShieldMLExtractor;
  readonly dlBuilder: ShieldDLBuilder;
  readonly trendAnalyzer: ShieldTrendAnalyzer;
  readonly forecaster: ShieldResilienceForecaster;
  readonly annotator: ShieldAnnotator;
  readonly inspector: ShieldInspector;
  readonly analytics: ShieldAnalytics;
} {
  return Object.freeze({
    engine: new ShieldEngine(),
    mlExtractor: new ShieldMLExtractor(),
    dlBuilder: new ShieldDLBuilder(),
    trendAnalyzer: new ShieldTrendAnalyzer(),
    forecaster: new ShieldResilienceForecaster(),
    annotator: new ShieldAnnotator(),
    inspector: new ShieldInspector(),
    analytics: new ShieldAnalytics(),
  });
}

/**
 * Extract a flat snapshot of key shield engine state for logging / telemetry.
 */
export function extractShieldEngineSnapshot(
  engine: ShieldEngine,
  snapshot: RunStateSnapshot,
  mode: ModeCode,
  phase: RunPhase,
): Readonly<Record<string, unknown>> {
  const layers = snapshot.shield.layers;
  const overallIntegrity = computeWeightedShieldIntegrity(layers);

  return Object.freeze({
    tick: snapshot.tick,
    mode,
    phase,
    overallIntegrity: overallIntegrity.toFixed(4),
    weakestLayerId: snapshot.shield.weakestLayerId,
    weakestIntegrity: snapshot.shield.weakestLayerRatio.toFixed(4),
    breachesThisRun: snapshot.shield.breachesThisRun,
    damagedThisRun: snapshot.shield.damagedThisRun,
    blockedThisRun: snapshot.shield.blockedThisRun,
    repairQueueDepth: snapshot.shield.repairQueueDepth,
    activeRepairJobs: engine.getActiveRepairJobs().length,
    cascadeCount: engine.getCascadeCount(),
    breachHistoryDepth: engine.getBreachHistory().length,
    cascadeHistoryDepth: engine.getCascadeHistory().length,
    healthStatus: engine.getHealth().status,
    ghostMode: mode === 'ghost',
    sovereigntyPhase: phase === 'SOVEREIGNTY',
    layerIntegrity: Object.fromEntries(
      layers.map((l) => [l.layerId, l.integrityRatio.toFixed(4)]),
    ),
  });
}

/**
 * Build an ensemble of all companion outputs for a given engine state.
 * Convenience method for adapters that need the full surface in one call.
 */
export function buildShieldEngineBundle(
  snapshot: RunStateSnapshot,
  mlExtractor: ShieldMLExtractor,
  dlBuilder: ShieldDLBuilder,
  trendAnalyzer: ShieldTrendAnalyzer,
  forecaster: ShieldResilienceForecaster,
  annotator: ShieldAnnotator,
  mode: ModeCode,
  phase: RunPhase,
  attacksThisTick: readonly AttackEvent[],
  breachEvents: number,
  cascadeEvents: number,
  repairSlices: number,
  damageEvents: number,
  breachHistory: readonly string[],
  cascadeHistory: readonly string[],
  repairJobs: readonly RepairJob[],
): ShieldEnsemble {
  const tick = snapshot.tick;

  const mlVec = mlExtractor.extract({
    snapshot, mode, phase,
    breachHistory, cascadeHistory, repairJobs, tick,
    attacksThisTick,
  });

  dlBuilder.push({
    snapshot, mode, phase,
    breachHistory, cascadeHistory, repairJobs, tick,
    attacksThisTick,
    breachEventsThisTick: breachEvents,
    cascadeEventsThisTick: cascadeEvents,
    repairSlicesThisTick: repairSlices,
    damageEventsThisTick: damageEvents,
  });

  const tensor = dlBuilder.getTensor();
  const trendEntry = buildShieldHistoryEntry(snapshot, breachEvents, cascadeEvents, repairSlices, attacksThisTick.length, mode, phase);
  trendAnalyzer.record(trendEntry);
  const trend = trendAnalyzer.getSummary();
  const forecast = forecaster.compute({ snapshot, mode, phase });
  const bundle = annotator.annotate(snapshot, attacksThisTick, breachEvents, cascadeEvents, mode, phase);
  const uxHint = annotator.buildUXHint(bundle, mode, phase);
  const modeProfile = buildShieldModeProfile(mode);
  const phaseProfile = buildShieldPhaseProfile(phase, mode);

  return Object.freeze({
    mlVector: mlVec,
    dlTensor: tensor,
    trendSummary: trend,
    forecast,
    annotationBundle: bundle,
    uxHint,
    modeProfile,
    phaseProfile,
  });
}

/**
 * Compute a quick breach risk score without full extraction.
 */
export function scoreShieldBreachRisk(
  snapshot: RunStateSnapshot,
  mode: ModeCode,
  phase: RunPhase,
): number {
  const layers = snapshot.shield.layers;
  const overallIntegrity = computeWeightedShieldIntegrity(layers);
  const weakestIntegrity = snapshot.shield.weakestLayerRatio;
  const attacks = snapshot.battle.pendingAttacks;
  return computeShieldBreachRisk(overallIntegrity, weakestIntegrity, mode, phase, attacks.length);
}

/**
 * Determine the preferred chat channel for the current shield state.
 */
export function getShieldChatChannel(
  urgency: ShieldUrgencyLabel,
  cascadePending: boolean,
): string {
  if (cascadePending) return 'shield_cascade';
  switch (urgency) {
    case 'CRITICAL': return 'shield_breach';
    case 'HIGH': return 'shield_warning';
    case 'MODERATE': return 'shield_warning';
    case 'LOW': return 'shield_status';
    case 'NONE': return 'shield_status';
    default: return 'shield_status';
  }
}

/**
 * Build a narrative weight score (0-1) for how much the shield state should dominate
 * the chat lane narrative in this tick.
 */
export function buildShieldNarrativeWeight(
  urgency: ShieldUrgencyLabel,
  cascadePending: boolean,
  trend: ShieldTrendSummary,
  phase: RunPhase,
): number {
  let weight = 0.2;
  if (cascadePending) weight = 1.0;
  else if (urgency === 'CRITICAL') weight = 0.9;
  else if (urgency === 'HIGH') weight = 0.7;
  else if (urgency === 'MODERATE') weight = 0.5;
  else if (urgency === 'LOW') weight = 0.3;

  if (trend.trendLabel === 'COLLAPSING') weight = Math.min(1.0, weight + 0.2);
  if (phase === 'SOVEREIGNTY') weight = Math.min(1.0, weight * 1.3);

  return Math.min(1.0, Math.max(0, weight));
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — ShieldEngine (enhanced production engine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ShieldEngine — the authoritative backend shield simulation engine.
 *
 * Each tick:
 * 1. Orders and routes pending attacks by doctrine type and priority
 * 2. Applies damage to the target layer with deflection modeling
 * 3. Resolves L4 cascade (all modes) and L3 ghost-echo cascade (ghost mode only)
 * 4. Applies pending repair job slices
 * 5. Applies passive regeneration
 * 6. Rebuilds shield state and emits engine signals + bus events
 * 7. Emits an ML vector via createEngineSignalFull for the chat lane
 * 8. Resolves engine health (sovereignty L4 → FAILED immediately)
 *
 * All simulation mutations are pure/functional — snapshot in, snapshot out.
 * The engine carries only volatile runtime state (repair queue, history buffers).
 */
export class ShieldEngine implements SimulationEngine {
  public readonly engineId = 'shield' as const;

  private readonly layers = new ShieldLayerManager();
  private readonly router = new AttackRouter();
  private readonly repairs = new ShieldRepairQueue();
  private readonly breachResolver = new BreachCascadeResolver();
  private readonly ux = new ShieldUXBridge();

  // ML/DL companion classes (always active — zero cost when signals not consumed)
  private readonly mlExtractor = new ShieldMLExtractor();
  private readonly dlBuilder = new ShieldDLBuilder();
  private readonly trendAnalyzer = new ShieldTrendAnalyzer();
  private readonly forecaster = new ShieldResilienceForecaster();
  private readonly annotator = new ShieldAnnotator();
  private readonly inspector = new ShieldInspector();
  private readonly analyticsEngine = new ShieldAnalytics();

  // Bounded history buffers
  private readonly breachHistory: string[] = [];
  private readonly cascadeHistory: string[] = [];
  private pendingQueueRejections: QueueRejection[] = [];

  // Ghost mode cascade counter (L3 echo chains — separate from standard L4 counter)
  private ghostCascadeCount = 0;

  // Cached ML vector from most recent tick
  private lastMLVector: ShieldMLVector | null = null;

  private health: EngineHealth = createEngineHealth(
    this.engineId,
    'HEALTHY',
    Date.now(),
    ['Shield engine initialized.'],
  );

  // ── Reset ────────────────────────────────────────────────────────────────

  public reset(): void {
    this.repairs.reset();
    this.breachResolver.reset();
    this.breachHistory.length = 0;
    this.cascadeHistory.length = 0;
    this.pendingQueueRejections = [];
    this.ghostCascadeCount = 0;
    this.lastMLVector = null;
    this.mlExtractor.reset();
    this.dlBuilder.reset();
    this.trendAnalyzer.reset();
    this.forecaster.reset();
    this.annotator.reset();
    this.health = createEngineHealth(
      this.engineId,
      'HEALTHY',
      Date.now(),
      ['Shield engine reset.'],
    );
  }

  // ── canRun ───────────────────────────────────────────────────────────────

  public canRun(snapshot: RunStateSnapshot, _context?: TickContext): boolean {
    return snapshot.outcome === null && snapshot.shield.layers.length > 0;
  }

  // ── tick ─────────────────────────────────────────────────────────────────

  public tick(snapshot: RunStateSnapshot, context: TickContext): EngineTickResult {
    if (!this.canRun(snapshot, context)) {
      return {
        snapshot,
        signals: Object.freeze([
          createEngineSignal(
            this.engineId,
            'INFO',
            'SHIELD_SKIPPED_TERMINAL_OUTCOME',
            'Shield engine skipped because run outcome is terminal.',
            snapshot.tick,
            [`outcome:${String(snapshot.outcome)}`],
          ),
        ]),
      };
    }

    try {
      const signals: EngineSignal[] = [];
      const mode = snapshot.mode;
      const phase = snapshot.phase;
      const previousLayers = snapshot.shield.layers;
      const wasFortified = this.layers.isFortified(previousLayers);

      let nextLayers: readonly ShieldLayerState[] = previousLayers;
      let blocked = snapshot.shield.blockedThisRun;
      let damaged = snapshot.shield.damagedThisRun;
      let breaches = snapshot.shield.breachesThisRun;

      // Per-tick event counters for ML/DL
      let breachEventsThisTick = 0;
      let cascadeEventsThisTick = 0;
      let repairSlicesThisTick = 0;
      let damageEventsThisTick = 0;

      // ── STEP A: Attack routing and damage ──────────────────────────────

      const orderedAttacks = this.router.order(snapshot.battle.pendingAttacks);

      for (const attack of orderedAttacks) {
        const routed = this.router.resolve(attack, nextLayers);

        if (routed.requestedLayer === 'DIRECT') {
          signals.push(
            createEngineSignal(
              this.engineId,
              'INFO',
              'SHIELD_DIRECT_ATTACK_REINTERPRETED',
              `Direct attack ${attack.attackId} was reinterpreted through shield routing doctrine.`,
              snapshot.tick,
              [`category:${routed.category}`, `doctrine:${routed.doctrineType}`],
            ),
          );
        }

        const effectiveTarget = this.router.resolveEffectiveTarget(routed, nextLayers);
        const fortifiedBeforeHit = this.layers.isFortified(nextLayers);

        const damage = this.layers.applyDamage(
          nextLayers,
          effectiveTarget,
          routed.magnitude,
          snapshot.tick,
          {
            fortified: fortifiedBeforeHit,
            bypassDeflection: routed.bypassDeflection,
          },
        );

        nextLayers = damage.layers;

        if (damage.effectiveDamage > 0) {
          damaged += 1;
          damageEventsThisTick += 1;
        }

        if (damage.blocked) {
          blocked += 1;
        }

        if (damage.breached) {
          breaches += 1;
          breachEventsThisTick += 1;
          this.pushBounded(
            this.breachHistory,
            `${snapshot.tick}:${damage.actualLayerId}:${attack.attackId}`,
          );

          // ── L4 cascade (all modes) ──────────────────────────────────

          if (damage.actualLayerId === 'L4') {
            const cascade = this.breachResolver.resolve(
              snapshot,
              nextLayers,
              damage.actualLayerId,
              snapshot.tick,
              context.bus,
            );

            nextLayers = cascade.layers;

            if (cascade.triggered && cascade.templateId !== null && cascade.chainId !== null) {
              cascadeEventsThisTick += 1;
              this.pushBounded(
                this.cascadeHistory,
                `${snapshot.tick}:${cascade.templateId}:${cascade.chainId}`,
              );
              signals.push(
                this.ux.buildCascadeSignal(
                  cascade.templateId,
                  cascade.chainId,
                  snapshot.tick,
                ),
              );
            }
          }

          // ── L3 ghost-echo cascade (ghost mode only) ─────────────────

          if (damage.actualLayerId === 'L3' && mode === 'ghost') {
            const ghostCascade = this.resolveGhostL3Cascade(snapshot, nextLayers, context);
            nextLayers = ghostCascade.layers;

            if (ghostCascade.triggered && ghostCascade.templateId !== null && ghostCascade.chainId !== null) {
              cascadeEventsThisTick += 1;
              this.pushBounded(
                this.cascadeHistory,
                `${snapshot.tick}:${ghostCascade.templateId}:${ghostCascade.chainId}`,
              );
              signals.push(
                this.ux.buildCascadeSignal(
                  ghostCascade.templateId,
                  ghostCascade.chainId,
                  snapshot.tick,
                ),
              );
              signals.push(
                createEngineSignalFull(
                  this.engineId,
                  'WARN',
                  'SHIELD_GHOST_L3_CASCADE',
                  `Ghost-echo cascade triggered at L3 breach (INCOME_SHOCK). Chain: ${ghostCascade.chainId}.`,
                  snapshot.tick,
                  'boundary_event' as EngineSignalCategory,
                  [`mode:ghost`, `layer:L3`, `chain:${ghostCascade.chainId}`],
                ),
              );
            }
          }

          // ── Breach event bus + signal ───────────────────────────────

          this.ux.emitLayerBreached(context.bus, {
            attackId: attack.attackId,
            layerId: damage.actualLayerId,
            tick: snapshot.tick,
            cascadesTriggered: damage.actualLayerId === 'L4' || (damage.actualLayerId === 'L3' && mode === 'ghost') ? 1 : 0,
          });

          signals.push(
            createEngineSignal(
              this.engineId,
              damage.actualLayerId === 'L4' ? 'ERROR' : 'WARN',
              'SHIELD_LAYER_BREACHED',
              `${damage.actualLayerId} breached after ${routed.doctrineType}.`,
              snapshot.tick,
              [
                `attack:${attack.attackId}`,
                `layer:${damage.actualLayerId}`,
                `pre:${String(damage.preHitIntegrity)}`,
                `post:${String(damage.postHitIntegrity)}`,
                `doctrine:${routed.doctrineType}`,
              ],
            ),
          );
        }
      }

      // ── STEP B: Repair slice delivery ─────────────────────────────────

      const dueRepairs = this.repairs.due(snapshot.tick);
      for (const repair of dueRepairs) {
        const applied = this.layers.applyRepair(
          nextLayers,
          repair.layerId,
          repair.amount,
          snapshot.tick,
        );

        nextLayers = applied.layers;
        if (applied.applied > 0) {
          repairSlicesThisTick += 1;
        }
      }

      // ── STEP C: Passive regeneration ──────────────────────────────────

      nextLayers = this.layers.regenerate(nextLayers, snapshot.tick);

      // ── STEP D: Compute next snapshot state ───────────────────────────

      const weakestLayerId = this.layers.weakestLayerId(nextLayers);
      const weakestLayerRatio = this.layers.weakestLayerRatio(nextLayers);
      const isFortified = this.layers.isFortified(nextLayers);

      const nextSnapshot: RunStateSnapshot = {
        ...snapshot,
        battle: {
          ...snapshot.battle,
          pendingAttacks: [],
        },
        shield: {
          layers: nextLayers,
          weakestLayerId,
          weakestLayerRatio,
          blockedThisRun: blocked,
          damagedThisRun: damaged,
          breachesThisRun: breaches,
          repairQueueDepth: this.repairs.size(),
        },
      };

      // ── STEP E: UX transition and fortified signals ────────────────────

      signals.push(
        ...this.ux.buildTransitionSignals(previousLayers, nextLayers, snapshot.tick),
      );
      signals.push(
        ...this.ux.buildFortifiedSignals(wasFortified, isFortified, snapshot.tick),
      );

      // ── STEP F: Queue rejection signals ───────────────────────────────

      if (this.pendingQueueRejections.length > 0) {
        signals.push(
          ...this.ux.buildQueueRejectionSignals(this.pendingQueueRejections),
        );
        this.pendingQueueRejections = [];
      }

      // ── STEP G: Idle tick signal ───────────────────────────────────────

      if (
        orderedAttacks.length === 0 &&
        dueRepairs.length === 0 &&
        this.repairs.size() === 0
      ) {
        signals.push(
          createEngineSignal(
            this.engineId,
            'INFO',
            'SHIELD_IDLE_TICK',
            'Shield tick completed with no attacks and no active repairs.',
            snapshot.tick,
          ),
        );
      }

      // ── STEP H: ML vector extraction and emission ─────────────────────

      const repairJobs = this.repairs.getActiveJobs();
      const mlVec = this.mlExtractor.extract({
        snapshot: nextSnapshot,
        mode,
        phase,
        breachHistory: this.breachHistory,
        cascadeHistory: this.cascadeHistory,
        repairJobs: [...repairJobs],
        tick: snapshot.tick,
        attacksThisTick: orderedAttacks,
      });
      this.lastMLVector = mlVec;

      // Push DL row
      this.dlBuilder.push({
        snapshot: nextSnapshot,
        mode,
        phase,
        breachHistory: this.breachHistory,
        cascadeHistory: this.cascadeHistory,
        repairJobs: [...repairJobs],
        tick: snapshot.tick,
        attacksThisTick: orderedAttacks,
        breachEventsThisTick,
        cascadeEventsThisTick,
        repairSlicesThisTick,
        damageEventsThisTick,
      });

      // Record trend history entry
      const historyEntry = buildShieldHistoryEntry(
        nextSnapshot,
        breachEventsThisTick,
        cascadeEventsThisTick,
        repairSlicesThisTick,
        orderedAttacks.length,
        mode,
        phase,
      );
      this.trendAnalyzer.record(historyEntry);

      // Emit ML vector signal for chat lane
      const overallIntegrity = computeWeightedShieldIntegrity(nextLayers);
      signals.push(
        createEngineSignalFull(
          this.engineId,
          'INFO',
          'SHIELD_ML_VECTOR_EMITTED',
          `Shield ML vector emitted: integrity=${(overallIntegrity * 100).toFixed(1)}%, stress=${(mlVec.shield_stress_index * 100).toFixed(1)}%, risk=${(mlVec.breach_risk_score * 100).toFixed(1)}%.`,
          snapshot.tick,
          'ml_emit' as EngineSignalCategory,
          [
            `integrity:${overallIntegrity.toFixed(4)}`,
            `stress:${mlVec.shield_stress_index.toFixed(4)}`,
            `risk:${mlVec.breach_risk_score.toFixed(4)}`,
            `mode:${mode}`,
            `phase:${phase}`,
          ],
        ),
      );

      // ── STEP I: Health resolution (mode/phase aware) ───────────────────

      this.health = createEngineHealth(
        this.engineId,
        this.resolveHealthStatus(nextLayers, breaches, phase, cascadeEventsThisTick),
        context.nowMs,
        this.buildHealthNotes(nextLayers, weakestLayerId, mode, phase),
      );

      return {
        snapshot: nextSnapshot,
        signals: Object.freeze(signals),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown shield engine failure.';

      this.health = createEngineHealth(
        this.engineId,
        'FAILED',
        context.nowMs,
        [message],
      );

      throw error;
    }
  }

  // ── queueRepair ──────────────────────────────────────────────────────────

  public queueRepair(
    tick: number,
    layerId: RepairLayerId,
    amount: number,
    durationTicks = 1,
    source: RepairJob['source'] = 'CARD',
    tags: readonly string[] = [],
  ): boolean {
    const queued = this.repairs.enqueue({
      tick,
      layerId,
      amount,
      durationTicks,
      source,
      tags,
    });

    if (queued !== null) {
      return true;
    }

    this.pendingQueueRejections = [
      ...this.pendingQueueRejections,
      {
        tick,
        layerId,
        amount: Math.max(0, Math.round(amount)),
        durationTicks: Math.max(1, Math.round(durationTicks)),
        source,
      },
    ];

    return false;
  }

  // ── Public getters ───────────────────────────────────────────────────────

  public getHealth(): EngineHealth {
    return this.health;
  }

  public getOverallIntegrityPct(snapshot: RunStateSnapshot): number {
    return this.layers.overallIntegrityRatio(snapshot.shield.layers);
  }

  public getWeakestLayerId(snapshot: RunStateSnapshot): import('../core/GamePrimitives').ShieldLayerId {
    return this.layers.weakestLayerId(snapshot.shield.layers);
  }

  public getCascadeCount(): number {
    return this.breachResolver.getCascadeCount();
  }

  public getGhostCascadeCount(): number {
    return this.ghostCascadeCount;
  }

  public getTotalCascadeCount(): number {
    return this.breachResolver.getCascadeCount() + this.ghostCascadeCount;
  }

  public getActiveRepairJobs(): readonly RepairJob[] {
    return this.repairs.getActiveJobs();
  }

  public getBreachHistory(): readonly string[] {
    return Object.freeze([...this.breachHistory]);
  }

  public getCascadeHistory(): readonly string[] {
    return Object.freeze([...this.cascadeHistory]);
  }

  public getLastMLVector(): ShieldMLVector | null {
    return this.lastMLVector;
  }

  public getLastDLTensor(): ShieldDLTensor {
    return this.dlBuilder.getTensor();
  }

  public getTrendSummary(): ShieldTrendSummary {
    return this.trendAnalyzer.getSummary();
  }

  public computeRecoveryForecast(snapshot: RunStateSnapshot): ShieldForecast {
    return this.forecaster.compute({
      snapshot,
      mode: snapshot.mode,
      phase: snapshot.phase,
    });
  }

  public computeAnalyticsSummary(): ShieldAnalyticsSummary {
    return this.analyticsEngine.computeSummary(
      this.trendAnalyzer.getHistory(),
      this.lastMLVector ? (this.lastMLVector.ghost_mode_flag === 1 ? 'ghost' : 'solo') : 'solo',
    );
  }

  public buildInspectorState(snapshot: RunStateSnapshot): ShieldInspectorState | null {
    const mlVec = this.lastMLVector;
    if (mlVec === null) return null;
    const trend = this.trendAnalyzer.getSummary();
    const forecast = this.forecaster.getLast() ?? this.forecaster.compute({ snapshot, mode: snapshot.mode, phase: snapshot.phase });
    const bundle = this.annotator.getLastBundle();
    if (bundle === null) return null;
    const hint = this.annotator.getLastUXHint();
    if (hint === null) return null;
    return this.inspector.buildState(this, snapshot, mlVec, trend, forecast, bundle, hint, snapshot.mode, snapshot.phase);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Ghost-mode L3 cascade resolution.
   * Emits cascade.chain.created with the INCOME_SHOCK template
   * and applies cascade crack to all non-L3 layers.
   */
  private resolveGhostL3Cascade(
    snapshot: RunStateSnapshot,
    layers: readonly ShieldLayerState[],
    context: TickContext,
  ): CascadeResolution {
    this.ghostCascadeCount += 1;
    const templateId = this.breachResolver.resolveTemplate('L3'); // 'INCOME_SHOCK'
    const chainId = `${snapshot.runId}:cascade:ghost-echo:${snapshot.tick}:${this.ghostCascadeCount}`;

    // Apply cascade crack (same crack logic as L4 breach)
    const crackedLayers = this.layers.applyCascadeCrack(layers, snapshot.tick);

    // Emit bus event
    context.bus.emit('cascade.chain.created', {
      chainId,
      templateId,
      positive: false,
    });

    return Object.freeze({
      layers: crackedLayers,
      triggered: true,
      chainId,
      templateId,
      cascadeCount: this.ghostCascadeCount,
    });
  }

  /**
   * Resolve engine health status.
   * Sovereignty phase: L4 breach → FAILED immediately.
   * Standard: FAILED if all layers breached, DEGRADED if any warnings.
   */
  private resolveHealthStatus(
    layers: readonly ShieldLayerState[],
    totalBreaches: number,
    phase: RunPhase,
    cascadeEventsThisTick: number,
  ): EngineHealth['status'] {
    const weakestRatio = this.layers.weakestLayerRatio(layers);
    const allBreached = layers.every((layer) => layer.breached);
    const l4Breached = layers.find((l) => l.layerId === 'L4')?.breached ?? false;

    // Sovereignty doctrine: L4 breach is immediately catastrophic
    if (phase === 'SOVEREIGNTY' && l4Breached) {
      return 'FAILED';
    }

    if (allBreached) {
      return 'FAILED';
    }

    if (
      weakestRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD ||
      totalBreaches > 0 ||
      cascadeEventsThisTick > 0 ||
      this.pendingQueueRejections.length > 0
    ) {
      return 'DEGRADED';
    }

    return 'HEALTHY';
  }

  /**
   * Build engine health notes with mode / phase context.
   */
  private buildHealthNotes(
    layers: readonly ShieldLayerState[],
    weakestLayerId: import('../core/GamePrimitives').ShieldLayerId,
    mode: ModeCode,
    phase: RunPhase,
  ): readonly string[] {
    const weakest = layers.find((layer) => layer.layerId === weakestLayerId);
    const overallIntegrity = computeWeightedShieldIntegrity(layers);

    return [
      `weakestLayer=${weakestLayerId}`,
      `weakestRatio=${(weakest?.integrityRatio ?? 0).toFixed(3)}`,
      `overallIntegrity=${overallIntegrity.toFixed(3)}`,
      `repairQueueDepth=${this.repairs.size()}`,
      `cascadeCount=${this.breachResolver.getCascadeCount()}`,
      `ghostCascadeCount=${this.ghostCascadeCount}`,
      `breachHistory=${this.breachHistory.length}`,
      `cascadeHistory=${this.cascadeHistory.length}`,
      `mode=${mode}`,
      `phase=${phase}`,
      `ghostMode=${mode === 'ghost'}`,
      `sovereigntyPhase=${phase === 'SOVEREIGNTY'}`,
      `cascadeSensitivity=${SHIELD_MODE_CASCADE_SENSITIVITY[mode]}`,
      `regenMultiplier=${SHIELD_MODE_REGEN_MULTIPLIER[mode]}`,
      `phaseRegenBonus=${SHIELD_PHASE_REGEN_BONUS[phase]}`,
      `phaseBreachSensitivity=${SHIELD_PHASE_BREACH_SENSITIVITY[phase]}`,
    ];
  }

  /**
   * Push a value to a bounded buffer, evicting the oldest entry when full.
   */
  private pushBounded(buffer: string[], value: string): void {
    buffer.push(value);
    if (buffer.length > SHIELD_CONSTANTS.MAX_HISTORY_DEPTH) {
      buffer.shift();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — Extended companion class methods (deep analytics surface)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended ShieldMLExtractor methods — attached via module augmentation pattern.
 * These are standalone exported functions that accept an extractor instance.
 * This keeps the companion class constructable without dependency injection
 * while making additional analytics available to chat adapters and ML pipelines.
 */

/**
 * Extract a named time-series for a single ML feature across the extractor history.
 * Returns values in chronological order (oldest first).
 */
export function getMLFeatureSequence(
  extractor: ShieldMLExtractor,
  featureName: keyof ShieldMLVector,
): readonly number[] {
  return Object.freeze(
    extractor.getHistory().map((v) => v[featureName] as number),
  );
}

/**
 * Compute a summary statistics object for a single ML feature across the history window.
 */
export function computeMLFeatureStats(
  extractor: ShieldMLExtractor,
  featureName: keyof ShieldMLVector,
): Readonly<{
  min: number;
  max: number;
  avg: number;
  stdDev: number;
  trend: 'rising' | 'falling' | 'stable';
}> {
  const history = extractor.getHistory();
  if (history.length === 0) {
    return Object.freeze({ min: 0, max: 0, avg: 0, stdDev: 0, trend: 'stable' as const });
  }

  const values = history.map((v) => v[featureName] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  let trend: 'rising' | 'falling' | 'stable' = 'stable';
  if (values.length >= 3) {
    const first = values.slice(0, Math.floor(values.length / 2));
    const second = values.slice(Math.floor(values.length / 2));
    const firstAvg = first.reduce((s, v) => s + v, 0) / first.length;
    const secondAvg = second.reduce((s, v) => s + v, 0) / second.length;
    if (secondAvg - firstAvg > 0.03) trend = 'rising';
    else if (firstAvg - secondAvg > 0.03) trend = 'falling';
  }

  return Object.freeze({ min, max, avg, stdDev, trend });
}

/**
 * Detect if the ML history contains an anomalous integrity spike
 * (a single-tick drop of >= 0.20 in overall_integrity_weighted).
 */
export function detectMLIntegrityAnomaly(
  extractor: ShieldMLExtractor,
): Readonly<{ detected: boolean; dropMagnitude: number; atIndex: number }> {
  const history = extractor.getHistory();
  let maxDrop = 0;
  let atIndex = -1;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]?.overall_integrity_weighted ?? 1;
    const curr = history[i]?.overall_integrity_weighted ?? 1;
    const drop = prev - curr;
    if (drop > maxDrop) {
      maxDrop = drop;
      atIndex = i;
    }
  }
  return Object.freeze({ detected: maxDrop >= 0.20, dropMagnitude: maxDrop, atIndex });
}

/**
 * Build a compact summary vector (mean of all ML features over history).
 * Useful for session-level ML inference when tick-level granularity is not required.
 */
export function buildMLSummaryVector(extractor: ShieldMLExtractor): readonly number[] {
  const labels = SHIELD_ML_FEATURE_LABELS;
  return Object.freeze(
    labels.map((label) => extractor.avgFeature(label as keyof ShieldMLVector)),
  );
}

/**
 * Compute the cross-layer breach correlation coefficient (L4 vs combined L1/L2/L3 integrity).
 * A high coefficient signals that L4 integrity closely tracks outer layer stress.
 */
export function computeBreachCorrelation(extractor: ShieldMLExtractor): number {
  const history = extractor.getHistory();
  if (history.length < 3) return 0;

  const l4Series = history.map((v) => v.l4_integrity_ratio);
  const outerSeries = history.map((v) =>
    (v.l1_integrity_ratio + v.l2_integrity_ratio + v.l3_integrity_ratio) / 3,
  );

  const n = l4Series.length;
  const sumL4 = l4Series.reduce((s, v) => s + v, 0);
  const sumOuter = outerSeries.reduce((s, v) => s + v, 0);
  const avgL4 = sumL4 / n;
  const avgOuter = sumOuter / n;

  let cov = 0;
  let varL4 = 0;
  let varOuter = 0;
  for (let i = 0; i < n; i++) {
    const dL4 = (l4Series[i] ?? 0) - avgL4;
    const dOuter = (outerSeries[i] ?? 0) - avgOuter;
    cov += dL4 * dOuter;
    varL4 += dL4 ** 2;
    varOuter += dOuter ** 2;
  }

  const denom = Math.sqrt(varL4 * varOuter);
  return denom === 0 ? 0 : Math.max(-1, Math.min(1, cov / denom));
}

/**
 * Build the DL input batch tensor for model inference.
 * Returns shape [1, sequenceLength, featureCount] as a nested array.
 */
export function buildDLInputBatch(builder: ShieldDLBuilder): ReadonlyArray<ReadonlyArray<readonly number[]>> {
  const tensor = builder.getTensor();
  return Object.freeze([tensor.rows]);
}

/**
 * Extract a single feature's time-series from the DL tensor (column slice).
 */
export function getDLFeatureSequence(
  builder: ShieldDLBuilder,
  featureIndex: number,
): readonly number[] {
  const tensor = builder.getTensor();
  return Object.freeze(tensor.rows.map((row) => row[featureIndex] ?? 0));
}

/**
 * Compute the row-level L2 norm for each DL row (useful for anomaly detection in DL inputs).
 */
export function computeDLRowNorms(builder: ShieldDLBuilder): readonly number[] {
  const tensor = builder.getTensor();
  return Object.freeze(
    tensor.rows.map((row) =>
      Math.sqrt(row.reduce((s, v) => s + v ** 2, 0)),
    ),
  );
}

/**
 * Compute rolling statistics for a specific DL feature index across the sequence window.
 */
export function computeDLFeatureStats(
  builder: ShieldDLBuilder,
  featureIndex: number,
): Readonly<{ min: number; max: number; avg: number }> {
  const seq = getDLFeatureSequence(builder, featureIndex);
  if (seq.length === 0) return Object.freeze({ min: 0, max: 0, avg: 0 });
  const min = Math.min(...seq);
  const max = Math.max(...seq);
  const avg = seq.reduce((s, v) => s + v, 0) / seq.length;
  return Object.freeze({ min, max, avg });
}

/**
 * Compute the breach momentum — a weighted score indicating how fast the
 * shield is deteriorating, factoring velocity and mode cascade sensitivity.
 */
export function computeShieldMomentum(
  trend: ShieldTrendSummary,
  mode: ModeCode,
): number {
  const sensitivity = SHIELD_MODE_CASCADE_SENSITIVITY[mode];
  const rawMomentum = -trend.velocity * sensitivity;
  return Math.max(-1.0, Math.min(1.0, rawMomentum * 10));
}

/**
 * Score which layer should be prioritized for repair based on
 * vulnerability, regen capacity, and mode cascade sensitivity.
 * Returns layers sorted by repair priority (highest priority first).
 */
export function scoreRepairPriority(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): ReadonlyArray<{ readonly layerId: string; readonly priorityScore: number }> {
  const sensitivity = SHIELD_MODE_CASCADE_SENSITIVITY[mode];
  const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[phase];

  const scored = layers.map((layer) => {
    const vulnerability = computeShieldLayerVulnerability(layer.layerId, layer.current, layer.max);
    const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
    const cascadeGate = layer.layerId === 'L4' || (mode === 'ghost' && layer.layerId === 'L3');
    const cascadeBonus = cascadeGate ? 0.3 * sensitivity : 0;

    const priority =
      vulnerability * 0.5 +
      capacityWeight * 0.2 +
      cascadeBonus +
      (layer.breached ? 0.25 : 0) * stakesMultiplier;

    return Object.freeze({ layerId: layer.layerId, priorityScore: Math.min(1.0, priority) });
  });

  return Object.freeze(
    [...scored].sort((a, b) => b.priorityScore - a.priorityScore),
  );
}

/**
 * Compute a single composite shield score (0-1) for HUD / leaderboard display.
 * Higher = healthier. Factors: integrity, fortified bonus, breach penalty, cascade penalty.
 */
export function computeShieldCompositeScore(
  snapshot: RunStateSnapshot,
  cascadeCount: number,
  mode: ModeCode,
  phase: RunPhase,
): number {
  const layers = snapshot.shield.layers;
  const overallIntegrity = computeWeightedShieldIntegrity(layers);
  const fortified = layers.every((l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD);
  const breachPenalty = Math.min(1.0, snapshot.shield.breachesThisRun * 0.08);
  const cascadePenalty = Math.min(0.5, cascadeCount * 0.12);
  const fortifiedBonus = fortified ? 0.10 : 0;
  const phaseWeight = RUN_PHASE_STAKES_MULTIPLIER[phase];
  const modeWeight = Math.min(1.0, MODE_DIFFICULTY_MULTIPLIER[mode] / 1.6);

  const raw =
    overallIntegrity * (1.0 - modeWeight * 0.1) +
    fortifiedBonus -
    breachPenalty * phaseWeight -
    cascadePenalty * phaseWeight;

  return Math.max(0, Math.min(1.0, raw));
}

/**
 * Build a full chat payload for the shield signal adapter.
 * This payload contains everything the chat lane needs to generate
 * player-facing commentary about the shield state.
 */
export function buildShieldChatPayload(
  snapshot: RunStateSnapshot,
  mlVec: ShieldMLVector,
  annotation: ShieldAnnotationBundle,
  uxHint: ShieldUXHint,
  forecast: ShieldForecast,
  modeProfile: ShieldModeProfile,
  phaseProfile: ShieldPhaseProfile,
  cascadeCount: number,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    tick: snapshot.tick,
    mode: snapshot.mode,
    phase: snapshot.phase,
    urgency: annotation.urgencyLabel,
    chatHook: uxHint.chatHook,
    channel: uxHint.channelSuggestion,
    primaryMessage: uxHint.primaryMessage,
    secondaryMessage: uxHint.secondaryMessage,
    layerFocus: uxHint.layerFocusId,
    overallIntegrity: annotation.overallIntegrity,
    weakestLayerId: annotation.weakestLayerId,
    cascadePending: annotation.cascadePending,
    cascadeCount,
    ghostMode: modeProfile.ghostModeActive,
    sovereigntyPhase: phaseProfile.endgameActive,
    recoveryLikely: forecast.overallRecoveryLikely,
    ticksToSafeIntegrity: forecast.ticksToSafeIntegrity,
    highestRiskLayer: forecast.highestRiskLayerId,
    stressIndex: mlVec.shield_stress_index,
    resilienceScore: mlVec.resilience_score,
    breachRisk: mlVec.breach_risk_score,
    botAggregateThreat: mlVec.bot_aggregate_threat,
    attackUrgency: mlVec.attack_response_urgency_max,
    annotationCount: annotation.entries.length,
    suppressInCalm: uxHint.suppressInCalmTick,
    narrativeWeight: buildShieldNarrativeWeight(
      annotation.urgencyLabel,
      annotation.cascadePending,
      { velocity: 0, velocityAvg: 0, acceleration: 0, accelerationAvg: 0, plateauTicks: 0, spikeDetected: false, recoveryDetected: false, overallIntegrityHistory: [], trendLabel: 'STABLE' },
      snapshot.phase,
    ),
  });
}

/**
 * Compute the "shield resilience momentum" — a 0-1 score representing
 * whether the shield is getting stronger or weaker relative to incoming threats.
 * Used by the chat lane to shift tone from "warning" to "recovering" mode.
 */
export function computeResilienceMomentum(
  trend: ShieldTrendSummary,
  forecast: ShieldForecast,
  mode: ModeCode,
): number {
  const trendBonus = trend.recoveryDetected ? 0.25 : trend.trendLabel === 'DECLINING' ? -0.25 : 0;
  const forecastBonus = forecast.overallRecoveryLikely ? 0.25 : -0.15;
  const regenMult = SHIELD_MODE_REGEN_MULTIPLIER[mode];
  const base = regenMult * 0.5 + trend.velocityAvg * 2.0;
  return Math.max(0, Math.min(1.0, base + trendBonus + forecastBonus));
}

/**
 * Determine if a shield event warrants a proactive AI coach intervention.
 * Returns true when the shield state crosses a meaningful narrative threshold.
 */
export function shouldTriggerCoachIntervention(
  annotation: ShieldAnnotationBundle,
  trend: ShieldTrendSummary,
  forecast: ShieldForecast,
  phase: RunPhase,
): boolean {
  if (annotation.cascadePending) return true;
  if (annotation.urgencyLabel === 'CRITICAL') return true;
  if (trend.trendLabel === 'COLLAPSING') return true;
  if (!forecast.overallRecoveryLikely && phase === 'SOVEREIGNTY') return true;
  if (trend.spikeDetected && annotation.urgencyLabel !== 'NONE') return true;
  return false;
}

/**
 * Build a ranked list of shield threat contributors for the chat lane.
 * Returns attack categories sorted by contribution to current breach risk.
 */
export function rankShieldThreatContributors(
  attacks: readonly AttackEvent[],
  tick: number,
): ReadonlyArray<Readonly<{ category: string; severity: AttackSeverityClass; urgency: number; attackId: string }>> {
  const ranked = attacks.map((attack) => ({
    category: attack.category,
    severity: classifyAttackSeverity(attack),
    urgency: scoreAttackResponseUrgency(attack, tick),
    attackId: attack.attackId,
  }));

  return Object.freeze(
    [...ranked].sort((a, b) => b.urgency - a.urgency),
  );
}

/**
 * Compute the shield "endurance index" — how many ticks the shield can survive
 * at the current average incoming damage rate before L4 is breached.
 * Returns null if the damage rate is zero or L4 is already breached.
 */
export function computeShieldEnduranceIndex(
  snapshot: RunStateSnapshot,
  avgDamagePerTick: number,
): number | null {
  const l4 = snapshot.shield.layers.find((l) => l.layerId === 'L4');
  if (l4 === undefined || l4.breached) return null;
  if (avgDamagePerTick <= 0) return null;
  const ticksToL4Breach = Math.ceil(l4.current / avgDamagePerTick);
  return Math.max(0, ticksToL4Breach);
}

/**
 * Compute the shield "absorption efficiency" — what fraction of incoming attack
 * magnitude was absorbed (blocked) vs. passed through as effective damage.
 */
export function computeShieldAbsorptionEfficiency(snapshot: RunStateSnapshot): number {
  const total = snapshot.shield.blockedThisRun + snapshot.shield.damagedThisRun;
  if (total === 0) return 1.0;
  return snapshot.shield.blockedThisRun / total;
}

/**
 * Build a per-layer integrity delta summary comparing two snapshots.
 * Used by replay tooling and post-tick diagnostics.
 */
export function buildLayerIntegrityDelta(
  prevLayers: readonly ShieldLayerState[],
  nextLayers: readonly ShieldLayerState[],
): ReadonlyArray<Readonly<{
  layerId: string;
  prevIntegrity: number;
  nextIntegrity: number;
  delta: number;
  direction: 'gained' | 'lost' | 'unchanged';
}>> {
  const prevMap = new Map(prevLayers.map((l) => [l.layerId, l]));
  return Object.freeze(
    nextLayers.map((next) => {
      const prev = prevMap.get(next.layerId);
      const prevInt = prev?.integrityRatio ?? 0;
      const delta = next.integrityRatio - prevInt;
      const direction =
        delta > 0.0005 ? 'gained' : delta < -0.0005 ? 'lost' : 'unchanged';
      return Object.freeze({
        layerId: next.layerId,
        prevIntegrity: prevInt,
        nextIntegrity: next.integrityRatio,
        delta,
        direction,
      });
    }),
  );
}

/**
 * Score the severity of a shield transition (before → after tick) for chat weighting.
 * 0 = nothing notable, 1 = catastrophic transition.
 */
export function scoreShieldTransitionSeverity(
  prevLayers: readonly ShieldLayerState[],
  nextLayers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): number {
  const deltas = buildLayerIntegrityDelta(prevLayers, nextLayers);
  const maxDrop = Math.max(...deltas.map((d) => -Math.min(0, d.delta)));
  const newBreaches = deltas.filter(
    (d, idx) =>
      d.direction === 'lost' &&
      (nextLayers[idx]?.breached ?? false) &&
      !(prevLayers.find((l) => l.layerId === d.layerId)?.breached ?? false),
  ).length;

  const cascadeSensitivity = SHIELD_MODE_CASCADE_SENSITIVITY[mode];
  const breachSensitivity = SHIELD_PHASE_BREACH_SENSITIVITY[phase];

  const raw = maxDrop * cascadeSensitivity * 0.5 + newBreaches * 0.3 * breachSensitivity;
  return Math.min(1.0, Math.max(0, raw));
}

/**
 * Build a terse one-line shield status string for logging and event tracing.
 * Format: "[tick] L1:XX% L2:XX% L3:XX% L4:XX% | overall:XX% | urgency:HIGH | mode/phase"
 */
export function buildShieldStatusLine(
  snapshot: RunStateSnapshot,
  urgency: ShieldUrgencyLabel,
  mode: ModeCode,
  phase: RunPhase,
): string {
  const layers = snapshot.shield.layers;
  const layerStr = layers
    .map((l) => `${l.layerId}:${(l.integrityRatio * 100).toFixed(0)}%`)
    .join(' ');
  const overall = (computeWeightedShieldIntegrity(layers) * 100).toFixed(1);
  return `[tick=${snapshot.tick}] ${layerStr} | overall:${overall}% | urgency:${urgency} | ${mode}/${phase}`;
}

/**
 * Determine whether the shield state requires an immediate emergency repair directive.
 * Returns true when the weakest layer is below CRITICAL and a repair job is not active.
 */
export function requiresEmergencyRepair(
  snapshot: RunStateSnapshot,
  activeRepairJobs: readonly RepairJob[],
): boolean {
  const weakest = snapshot.shield.weakestLayerRatio;
  if (weakest >= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) return false;

  const weakestId = snapshot.shield.weakestLayerId;
  const hasActiveRepair = activeRepairJobs.some(
    (job) => job.layerId === weakestId || job.layerId === 'ALL',
  );

  return !hasActiveRepair && weakest < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD;
}

/**
 * Compute the ghost-mode threat multiplier — how much more dangerous the run is
 * in ghost mode vs. standard modes due to L3 cascade exposure.
 */
export function computeGhostModeThreatMultiplier(mode: ModeCode): number {
  if (mode !== 'ghost') return 1.0;
  // Ghost: L3 cascade doubles cascade exposure vs standard L4-only
  return SHIELD_MODE_CASCADE_SENSITIVITY['ghost'] / SHIELD_MODE_CASCADE_SENSITIVITY['solo'];
}

/**
 * Compute the sovereignty multiplier — how much more catastrophic breaches are
 * in the SOVEREIGNTY phase vs. FOUNDATION.
 */
export function computeSovereigntyBreachMultiplier(phase: RunPhase): number {
  return SHIELD_PHASE_BREACH_SENSITIVITY[phase] / SHIELD_PHASE_BREACH_SENSITIVITY['FOUNDATION'];
}

/**
 * Build a minimal shield signal for the engine registry / health dashboard.
 * This is not an EngineSignal — it's a plain data record for external consumers.
 */
export function buildShieldRegistrySignal(
  snapshot: RunStateSnapshot,
  health: EngineHealth,
  cascadeCount: number,
  mode: ModeCode,
  phase: RunPhase,
): Readonly<{
  engineId: string;
  healthStatus: string;
  overallIntegrity: number;
  weakestLayerId: string;
  cascadeCount: number;
  breachesThisRun: number;
  ghostMode: boolean;
  sovereigntyPhase: boolean;
  tick: number;
}> {
  return Object.freeze({
    engineId: 'shield',
    healthStatus: health.status,
    overallIntegrity: computeWeightedShieldIntegrity(snapshot.shield.layers),
    weakestLayerId: snapshot.shield.weakestLayerId,
    cascadeCount,
    breachesThisRun: snapshot.shield.breachesThisRun,
    ghostMode: mode === 'ghost',
    sovereigntyPhase: phase === 'SOVEREIGNTY',
    tick: snapshot.tick,
  });
}

/**
 * Compute the overall "shield quality" score (0-1) for run grading.
 * Higher score = better shield management throughout the run.
 * Factors: absorption efficiency, min integrity seen, fortified ratio, cascade avoidance.
 */
export function computeShieldQualityScore(
  analytics: ShieldAnalyticsSummary,
  absorptionEfficiency: number,
): number {
  const absorptionScore = absorptionEfficiency * 0.25;
  const integrityScore = analytics.avgOverallIntegrity * 0.30;
  const fortifiedScore = analytics.fortifiedRatio * 0.20;
  const cascadeAvoidance = Math.max(0, 1.0 - analytics.cascadeRatePerTick * 5) * 0.15;
  const breachAvoidance = Math.max(0, 1.0 - analytics.breachRatePerTick * 3) * 0.10;

  return Math.min(1.0, absorptionScore + integrityScore + fortifiedScore + cascadeAvoidance + breachAvoidance);
}

/**
 * Build a full mode + phase context descriptor string.
 * Used in logging and chat adapter payloads.
 */
export function buildShieldContextDescriptor(mode: ModeCode, phase: RunPhase): string {
  const sensitivity = SHIELD_MODE_CASCADE_SENSITIVITY[mode];
  const regenMult = SHIELD_MODE_REGEN_MULTIPLIER[mode];
  const breachSens = SHIELD_PHASE_BREACH_SENSITIVITY[phase];
  const regenBonus = SHIELD_PHASE_REGEN_BONUS[phase];
  const ghostCascade = mode === 'ghost' ? ' [GHOST: L3+L4 cascade]' : '';
  const sovereigntyFailed = phase === 'SOVEREIGNTY' ? ' [SOVEREIGNTY: L4→FAILED]' : '';
  return `${mode}/${phase} | cascade=${sensitivity}x | regen=${(regenMult * regenBonus).toFixed(2)}x | breach=${breachSens}x${ghostCascade}${sovereigntyFailed}`;
}

/**
 * Validate that a shield state snapshot is internally consistent.
 * Returns an array of violation strings (empty = valid).
 */
export function validateShieldState(snapshot: RunStateSnapshot): readonly string[] {
  const violations: string[] = [];
  const layers = snapshot.shield.layers;

  for (const layer of layers) {
    if (layer.current < 0) violations.push(`${layer.layerId}.current < 0`);
    if (layer.current > layer.max) violations.push(`${layer.layerId}.current > max`);
    if (layer.integrityRatio < 0 || layer.integrityRatio > 1) {
      violations.push(`${layer.layerId}.integrityRatio out of [0,1]`);
    }
    if (layer.breached !== (layer.current <= 0)) {
      violations.push(`${layer.layerId}.breached mismatch with current`);
    }
  }

  if (snapshot.shield.weakestLayerRatio < 0 || snapshot.shield.weakestLayerRatio > 1) {
    violations.push('weakestLayerRatio out of [0,1]');
  }

  if (snapshot.shield.breachesThisRun < 0) violations.push('breachesThisRun < 0');
  if (snapshot.shield.damagedThisRun < 0) violations.push('damagedThisRun < 0');
  if (snapshot.shield.blockedThisRun < 0) violations.push('blockedThisRun < 0');
  if (snapshot.shield.repairQueueDepth < 0) violations.push('repairQueueDepth < 0');

  return Object.freeze(violations);
}

/**
 * Compute the expected ticks before the first layer reaches critical integrity
 * given the current average damage rate and regeneration.
 */
export function computeTicksToCritical(
  snapshot: RunStateSnapshot,
  avgNetDamagePerTick: number,
  mode: ModeCode,
  phase: RunPhase,
): number | null {
  if (avgNetDamagePerTick <= 0) return null;

  const regenMult = SHIELD_MODE_REGEN_MULTIPLIER[mode] * SHIELD_PHASE_REGEN_BONUS[phase];
  let minTicks: number | null = null;

  for (const layer of snapshot.shield.layers) {
    if (layer.breached) continue;
    const criticalHp = layer.max * SHIELD_FORECAST_CRITICAL_THRESHOLD;
    if (layer.current <= criticalHp) continue;

    const regenPerTick = estimateShieldRegenPerTick(layer.layerId, layer.max) * regenMult;
    const netDamage = avgNetDamagePerTick - regenPerTick;
    if (netDamage <= 0) continue;

    const ticks = Math.ceil((layer.current - criticalHp) / netDamage);
    if (minTicks === null || ticks < minTicks) minTicks = ticks;
  }

  return minTicks;
}

/**
 * Build a shield event log entry for audit / proof chain inclusion.
 * The event log entry is deterministic and serialization-safe.
 */
export function buildShieldEventLogEntry(
  tick: number,
  eventType: 'BREACH' | 'CASCADE' | 'REPAIR' | 'REGEN' | 'IDLE',
  layerId: string | null,
  detail: string,
  mode: ModeCode,
  phase: RunPhase,
): Readonly<{
  tick: number;
  eventType: string;
  layerId: string | null;
  detail: string;
  mode: string;
  phase: string;
  timestamp: string;
}> {
  return Object.freeze({
    tick,
    eventType,
    layerId,
    detail,
    mode,
    phase,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Compute the Sovereignty breach penalty score — a 0-1 value representing how
 * catastrophic the current breach state is in the SOVEREIGNTY phase.
 * Returns 0 if not in SOVEREIGNTY.
 */
export function computeSovereigntyBreachPenalty(
  snapshot: RunStateSnapshot,
  cascadeCount: number,
): number {
  if (snapshot.phase !== 'SOVEREIGNTY') return 0;

  const l4Breached = snapshot.shield.layers.find((l) => l.layerId === 'L4')?.breached ?? false;
  const breachFrac = Math.min(1.0, snapshot.shield.breachesThisRun / 5.0);
  const cascadeFrac = Math.min(1.0, cascadeCount / 3.0);

  const raw = (l4Breached ? 0.5 : 0) + breachFrac * 0.3 + cascadeFrac * 0.2;
  return Math.min(1.0, raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — SHIELD_ENGINE_MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Machine-readable manifest for the Shield Engine module.
 * Consumed by registry validators, CI checks, and the admin dashboard.
 */
export const SHIELD_ENGINE_MANIFEST = Object.freeze({
  moduleId: 'shield-engine',
  version: SHIELD_ENGINE_MODULE_VERSION,
  engineId: 'shield',
  stepSlot: 'STEP_06_SHIELD',
  ready: SHIELD_ENGINE_READY,
  mlFeatureCount: SHIELD_ENGINE_ML_FEATURE_COUNT,
  dlFeatureCount: SHIELD_ENGINE_DL_FEATURE_COUNT,
  dlSequenceLength: SHIELD_ENGINE_DL_SEQUENCE_LENGTH,
  historyDepth: SHIELD_HISTORY_DEPTH,
  trendWindow: SHIELD_TREND_WINDOW,
  mlFeatureLabels: SHIELD_ML_FEATURE_LABELS,
  dlFeatureLabels: SHIELD_DL_FEATURE_LABELS,
  layerOrder: SHIELD_LAYER_ORDER,
  cascadeLayers: {
    standard: Object.freeze(['L4']),
    ghost: SHIELD_GHOST_CASCADE_LAYERS,
  },
  modeCascadeSensitivity: SHIELD_MODE_CASCADE_SENSITIVITY,
  modeRegenMultiplier: SHIELD_MODE_REGEN_MULTIPLIER,
  phaseRegenBonus: SHIELD_PHASE_REGEN_BONUS,
  phaseBreachSensitivity: SHIELD_PHASE_BREACH_SENSITIVITY,
  doctrineAttackTypes: [
    'FINANCIAL_SABOTAGE',
    'EXPENSE_INJECTION',
    'DEBT_ATTACK',
    'ASSET_STRIP',
    'REPUTATION_ATTACK',
    'REGULATORY_ATTACK',
    'HATER_INJECTION',
    'OPPORTUNITY_KILL',
  ] as const,
  shieldConstants: SHIELD_CONSTANTS,
  createdAt: '2026-03-25',
  description: 'Authoritative backend shield simulation engine with full ML/DL companion suite, mode-aware cascade doctrine, and phase-aware health resolution.',
  exportedClasses: [
    'ShieldEngine',
    'ShieldMLExtractor',
    'ShieldDLBuilder',
    'ShieldTrendAnalyzer',
    'ShieldResilienceForecaster',
    'ShieldAnnotator',
    'ShieldInspector',
    'ShieldAnalytics',
  ],
  exportedFactories: [
    'createShieldEngineWithAnalytics',
    'extractShieldEngineSnapshot',
    'buildShieldEngineBundle',
    'scoreShieldBreachRisk',
    'getShieldChatChannel',
    'buildShieldNarrativeWeight',
  ],
  exportedHelpers: [
    'mapLayersForIntegrityRatio',
    'computeWeightedShieldIntegrity',
    'normalizeLayerIndex',
    'computeBotAggregateThreat',
    'computeHighestActiveBotThreat',
    'computeShieldStressIndex',
    'computeShieldResilienceScore',
    'computeShieldBreachRisk',
    'classifyShieldUrgency',
    'buildShieldChatHook',
    'computeAttackMagnitudeStats',
    'extractShieldMLFeatures',
    'buildShieldDLRow',
    'buildShieldAnnotation',
    'buildShieldUXHint',
    'buildShieldHistoryEntry',
    'buildShieldModeProfile',
    'buildShieldPhaseProfile',
    'buildLayerForecast',
    'buildShieldForecast',
    'buildShieldTrendSummary',
    'classifyShieldTrend',
    'rankLayersByVulnerability',
    'buildShieldHealthState',
    'getMLFeatureSequence',
    'computeMLFeatureStats',
    'detectMLIntegrityAnomaly',
    'buildMLSummaryVector',
    'computeBreachCorrelation',
    'buildDLInputBatch',
    'getDLFeatureSequence',
    'computeDLRowNorms',
    'computeDLFeatureStats',
    'computeShieldMomentum',
    'scoreRepairPriority',
    'computeShieldCompositeScore',
    'buildShieldChatPayload',
    'computeResilienceMomentum',
    'shouldTriggerCoachIntervention',
    'rankShieldThreatContributors',
    'computeShieldEnduranceIndex',
    'computeShieldAbsorptionEfficiency',
    'buildLayerIntegrityDelta',
    'scoreShieldTransitionSeverity',
    'buildShieldStatusLine',
    'requiresEmergencyRepair',
    'computeGhostModeThreatMultiplier',
    'computeSovereigntyBreachMultiplier',
    'buildShieldRegistrySignal',
    'computeShieldQualityScore',
    'buildShieldContextDescriptor',
    'validateShieldState',
    'computeTicksToCritical',
    'buildShieldEventLogEntry',
    'computeSovereigntyBreachPenalty',
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// § 17 — Extended ShieldAnalytics methods (deep session analytics)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a "shield timeline" — a tick-by-tick summary of the run's shield history
 * showing key events. Used by replay tooling and the post-run analysis dashboard.
 */
export function buildShieldTimeline(
  history: readonly ShieldHistoryEntry[],
): ReadonlyArray<Readonly<{
  tick: number;
  overallIntegrity: number;
  event: 'BREACH' | 'CASCADE' | 'REPAIR' | 'FORTIFIED' | 'TICK';
  detail: string;
}>> {
  const timeline = history.map((entry) => {
    let event: 'BREACH' | 'CASCADE' | 'REPAIR' | 'FORTIFIED' | 'TICK' = 'TICK';
    let detail = `integrity=${(entry.overallIntegrity * 100).toFixed(1)}%`;

    if (entry.breachCountThisTick > 0) {
      event = 'BREACH';
      detail = `${entry.breachCountThisTick} breach(es) | weakest=${entry.weakestLayerId} (${(entry.weakestIntegrity * 100).toFixed(1)}%)`;
    } else if (entry.cascadeCountThisTick > 0) {
      event = 'CASCADE';
      detail = `${entry.cascadeCountThisTick} cascade(s) | integrity=${(entry.overallIntegrity * 100).toFixed(1)}%`;
    } else if (entry.repairCountThisTick > 0) {
      event = 'REPAIR';
      detail = `${entry.repairCountThisTick} repair slice(s) delivered`;
    } else if (entry.fortified) {
      event = 'FORTIFIED';
      detail = `All layers fortified`;
    }

    return Object.freeze({ tick: entry.tick, overallIntegrity: entry.overallIntegrity, event, detail });
  });

  return Object.freeze(timeline);
}

/**
 * Compute the longest streak of consecutive fortified ticks in the history.
 * A high fortified streak indicates strong proactive shield management.
 */
export function computeLongestFortifiedStreak(history: readonly ShieldHistoryEntry[]): number {
  let maxStreak = 0;
  let currentStreak = 0;
  for (const entry of history) {
    if (entry.fortified) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }
  return maxStreak;
}

/**
 * Compute the worst single-tick integrity drop in the history.
 * Returns the magnitude of the drop (positive = worse) and the tick it occurred.
 */
export function computeWorstIntegrityDrop(
  history: readonly ShieldHistoryEntry[],
): Readonly<{ magnitude: number; tick: number }> {
  let maxDrop = 0;
  let atTick = -1;

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]?.overallIntegrity ?? 1;
    const curr = history[i]?.overallIntegrity ?? 1;
    const drop = prev - curr;
    if (drop > maxDrop) {
      maxDrop = drop;
      atTick = history[i]?.tick ?? -1;
    }
  }

  return Object.freeze({ magnitude: maxDrop, tick: atTick });
}

/**
 * Compute the average ticks between breach events.
 * Returns null if fewer than 2 breach events were recorded.
 */
export function computeAvgTicksBetweenBreaches(
  history: readonly ShieldHistoryEntry[],
): number | null {
  const breachTicks = history
    .filter((h) => h.breachCountThisTick > 0)
    .map((h) => h.tick);

  if (breachTicks.length < 2) return null;

  let totalGap = 0;
  for (let i = 1; i < breachTicks.length; i++) {
    totalGap += (breachTicks[i] ?? 0) - (breachTicks[i - 1] ?? 0);
  }
  return totalGap / (breachTicks.length - 1);
}

/**
 * Compute the repair effectiveness ratio — ratio of repair ticks to total breach ticks.
 * > 1.0 means repairs outpace breaches; < 1.0 means breaches are winning.
 */
export function computeRepairEffectivenessRatio(
  history: readonly ShieldHistoryEntry[],
): number {
  const totalBreachTicks = history.filter((h) => h.breachCountThisTick > 0).length;
  const totalRepairTicks = history.filter((h) => h.repairCountThisTick > 0).length;
  if (totalBreachTicks === 0) return totalRepairTicks > 0 ? 2.0 : 1.0;
  return totalRepairTicks / totalBreachTicks;
}

/**
 * Compute the phase-stratified integrity averages.
 * Returns average overall integrity for each phase seen in the history.
 */
export function computePhaseStratifiedIntegrity(
  history: readonly ShieldHistoryEntry[],
): Readonly<Partial<Record<RunPhase, number>>> {
  const byPhase: Partial<Record<RunPhase, number[]>> = {};

  for (const entry of history) {
    const arr = byPhase[entry.phase] ?? [];
    arr.push(entry.overallIntegrity);
    byPhase[entry.phase] = arr;
  }

  const result: Partial<Record<RunPhase, number>> = {};
  for (const [phase, values] of Object.entries(byPhase) as [RunPhase, number[]][]) {
    result[phase] = values.reduce((s, v) => s + v, 0) / values.length;
  }

  return Object.freeze(result);
}

/**
 * Compute the mode-stratified breach rates.
 * Returns breach rate per tick for each mode seen in the history.
 */
export function computeModeStratifiedBreachRate(
  history: readonly ShieldHistoryEntry[],
): Readonly<Partial<Record<ModeCode, number>>> {
  const byMode: Partial<Record<ModeCode, { ticks: number; breaches: number }>> = {};

  for (const entry of history) {
    const bucket = byMode[entry.mode] ?? { ticks: 0, breaches: 0 };
    bucket.ticks++;
    bucket.breaches += entry.breachCountThisTick;
    byMode[entry.mode] = bucket;
  }

  const result: Partial<Record<ModeCode, number>> = {};
  for (const [mode, data] of Object.entries(byMode) as [ModeCode, { ticks: number; breaches: number }][]) {
    result[mode] = data.ticks > 0 ? data.breaches / data.ticks : 0;
  }

  return Object.freeze(result);
}

/**
 * Compute a "shield risk grade" letter (A–F) from a composite score.
 * Grade reflects how well the player managed their shield during the run.
 */
export function computeShieldRiskGrade(qualityScore: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (qualityScore >= 0.85) return 'A';
  if (qualityScore >= 0.70) return 'B';
  if (qualityScore >= 0.50) return 'C';
  if (qualityScore >= 0.30) return 'D';
  return 'F';
}

/**
 * Build a post-run shield report for the sovereignty proof chain.
 * This report is deterministic and serialization-safe.
 */
export function buildShieldRunReport(
  history: readonly ShieldHistoryEntry[],
  analytics: ShieldAnalyticsSummary,
  cascadeCount: number,
  ghostCascadeCount: number,
  absorptionEfficiency: number,
  mode: ModeCode,
  phase: RunPhase,
): Readonly<{
  totalTicks: number;
  totalBreaches: number;
  totalCascades: number;
  ghostCascades: number;
  totalRepairJobs: number;
  avgIntegrity: number;
  minIntegrity: number;
  maxIntegrity: number;
  fortifiedRatio: number;
  criticalRatio: number;
  absorptionEfficiency: number;
  longestFortifiedStreak: number;
  worstDropMagnitude: number;
  worstDropTick: number;
  repairEffectiveness: number;
  qualityScore: number;
  riskGrade: string;
  mostBreachedLayerId: string | null;
  phaseAtEnd: RunPhase;
  modeCode: ModeCode;
}> {
  const longestStreak = computeLongestFortifiedStreak(history);
  const worstDrop = computeWorstIntegrityDrop(history);
  const repairEff = computeRepairEffectivenessRatio(history);
  const qualityScore = computeShieldQualityScore(analytics, absorptionEfficiency);
  const riskGrade = computeShieldRiskGrade(qualityScore);

  return Object.freeze({
    totalTicks: analytics.totalTicksTracked,
    totalBreaches: analytics.totalBreaches,
    totalCascades: cascadeCount,
    ghostCascades: ghostCascadeCount,
    totalRepairJobs: analytics.totalRepairJobs,
    avgIntegrity: analytics.avgOverallIntegrity,
    minIntegrity: analytics.minOverallIntegrity,
    maxIntegrity: analytics.maxOverallIntegrity,
    fortifiedRatio: analytics.fortifiedRatio,
    criticalRatio: analytics.criticalRatio,
    absorptionEfficiency,
    longestFortifiedStreak: longestStreak,
    worstDropMagnitude: worstDrop.magnitude,
    worstDropTick: worstDrop.tick,
    repairEffectiveness: repairEff,
    qualityScore,
    riskGrade,
    mostBreachedLayerId: analytics.mostBreachedLayerId,
    phaseAtEnd: phase,
    modeCode: mode,
  });
}

/**
 * Compute the "shield legacy score" — a narrative-facing 0-100 integer
 * that summarizes shield performance for post-run display.
 * Factors in quality, absorption, streak length, and cascade avoidance.
 */
export function computeShieldLegacyScore(
  qualityScore: number,
  longestFortifiedStreak: number,
  absorptionEfficiency: number,
  totalCascades: number,
  totalTicks: number,
): number {
  const quality = qualityScore * 40;
  const absorption = absorptionEfficiency * 25;
  const streakBonus = Math.min(15, (longestFortifiedStreak / Math.max(1, totalTicks)) * 30);
  const cascadePenalty = Math.min(20, totalCascades * 5);
  const raw = quality + absorption + streakBonus - cascadePenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Build the shield section of the sovereignty proof payload.
 * This is the authoritative shield evidence record for run verification.
 */
export function buildShieldProofSection(
  runReport: ReturnType<typeof buildShieldRunReport>,
  legacyScore: number,
  breachHistory: readonly string[],
  cascadeHistory: readonly string[],
): Readonly<{
  legacyScore: number;
  riskGrade: string;
  qualityScore: number;
  fortifiedRatio: number;
  absorptionEfficiency: number;
  totalBreaches: number;
  totalCascades: number;
  ghostCascades: number;
  breachHistoryDepth: number;
  cascadeHistoryDepth: number;
  minIntegrity: number;
  repairEffectiveness: number;
}> {
  return Object.freeze({
    legacyScore,
    riskGrade: runReport.riskGrade,
    qualityScore: runReport.qualityScore,
    fortifiedRatio: runReport.fortifiedRatio,
    absorptionEfficiency: runReport.absorptionEfficiency,
    totalBreaches: runReport.totalBreaches,
    totalCascades: runReport.totalCascades,
    ghostCascades: runReport.ghostCascades,
    breachHistoryDepth: breachHistory.length,
    cascadeHistoryDepth: cascadeHistory.length,
    minIntegrity: runReport.minIntegrity,
    repairEffectiveness: runReport.repairEffectiveness,
  });
}

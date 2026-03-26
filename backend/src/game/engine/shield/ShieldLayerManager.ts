/*
 * POINT ZERO ONE — BACKEND SHIELD LAYER MANAGER
 * /backend/src/game/engine/shield/ShieldLayerManager.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - layer state updates are pure and deterministic
 * - damage never overflows across shield layers
 * - regen happens after the tick's attacks and skips the same tick a layer breaches
 * - all calculations are replay-safe and snapshot-driven
 * - ML/DL extraction is a first-class concern — every tick produces a labeled vector
 * - mode-aware and phase-aware behavior is baked into regen multipliers,
 *   breach sensitivity, vulnerability scoring, and recovery forecasting
 * - companion classes (MLExtractor, DLBuilder, TrendAnalyzer, ResilienceForecaster,
 *   Annotator, Inspector, Analytics) follow the ShieldEngine companion pattern
 *
 * Surface summary:
 *   § 1  — Module constants and manifest metadata
 *   § 2  — ML feature label array (32-feature canonical set)
 *   § 3  — DL feature label array (40-feature per timestep, sequence 6)
 *   § 4  — Type definitions (ML vector, DL tensor, summaries, bundles)
 *   § 5  — Pure helper functions (extraction, scoring, annotation, UX)
 *   § 6  — ShieldLayerManagerMLExtractor — ML vector builder
 *   § 7  — ShieldLayerManagerDLBuilder — DL tensor sequence builder
 *   § 8  — ShieldLayerManagerTrendAnalyzer — velocity and acceleration over history
 *   § 9  — ShieldLayerManagerResilienceForecaster — recovery timeline estimation
 *   § 10 — ShieldLayerManagerAnnotator — human-readable annotation bundles
 *   § 11 — ShieldLayerManagerInspector — full diagnostic state snapshot
 *   § 12 — ShieldLayerManagerAnalytics — session-level aggregate analytics
 *   § 13 — Factory functions and ensemble builders
 *   § 14 — ShieldLayerManager — enhanced simulation layer manager (production)
 *   § 15 — SHIELD_LAYER_MANAGER_MANIFEST
 */

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
  type BotState,
  type HaterBotId,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type ThreatEnvelope,
  type ThreatUrgencyClass,
  type ShieldLayerId,
} from '../core/GamePrimitives';
import type { RunStateSnapshot, ShieldLayerState } from '../core/RunStateSnapshot';
import {
  buildShieldLayerState,
  getLayerConfig,
  layerOrderIndex,
  SHIELD_CONSTANTS,
  SHIELD_LAYER_CONFIGS,
  SHIELD_LAYER_ORDER,
  type CascadeResolution,
  type DamageResolution,
  type PendingRepairSlice,
  type RepairJob,
  type RepairLayerId,
  type RoutedAttack,
  type ShieldDoctrineAttackType,
  type ShieldLayerConfig,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Module constants and manifest metadata
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_LAYER_MANAGER_MODULE_VERSION = '2026.03.25' as const;
export const SHIELD_LAYER_MANAGER_READY = true as const;

/** Total ML features produced per tick by ShieldLayerManagerMLExtractor. */
export const SHIELD_LAYER_MANAGER_ML_FEATURE_COUNT = 32 as const;

/** Total DL features per time-step. */
export const SHIELD_LAYER_MANAGER_DL_FEATURE_COUNT = 40 as const;

/** DL sequence length (ticks retained in rolling window). */
export const SHIELD_LAYER_MANAGER_DL_SEQUENCE_LENGTH = 6 as const;

/** Rolling history depth for damage/repair/breach buffers. */
export const SHIELD_LAYER_MANAGER_HISTORY_DEPTH = 30 as const;

/** Window size for trend velocity and acceleration computation. */
export const SHIELD_LAYER_MANAGER_TREND_WINDOW = 5 as const;

/** Integrity score at which a layer is considered "low" for forecasting. */
export const SHIELD_LAYER_MANAGER_FORECAST_LOW_THRESHOLD = 0.30 as const;

/** Integrity score at which a layer is considered "critical" for forecasting. */
export const SHIELD_LAYER_MANAGER_FORECAST_CRITICAL_THRESHOLD = 0.10 as const;

/** Maximum ticks to simulate in a recovery forecast. */
export const SHIELD_LAYER_MANAGER_FORECAST_MAX_HORIZON = 20 as const;

/** Minimum integrity ratio to consider a layer "stable" (no UX warning). */
export const SHIELD_LAYER_MANAGER_STABLE_THRESHOLD = 0.50 as const;

/** Damage-per-tick magnitude above which we emit a WARN signal. */
export const SHIELD_LAYER_MANAGER_HIGH_DAMAGE_THRESHOLD = 15 as const;

/** Repair-per-tick magnitude above which we emit an INFO signal. */
export const SHIELD_LAYER_MANAGER_HIGH_REPAIR_THRESHOLD = 10 as const;

/** Number of breach history entries to keep for trend scoring. */
export const SHIELD_LAYER_MANAGER_BREACH_HISTORY_DEPTH = 16 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — ML feature label array (32-feature canonical set)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical 32-feature ML label set for the ShieldLayerManager.
 * Every label maps 1:1 to a field on ShieldLayerManagerMLVector.
 * Order is stable across versions — append only.
 */
export const SHIELD_LAYER_MANAGER_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
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
  // 8-11: Layer vulnerability scores (0-1)
  'l1_vulnerability',
  'l2_vulnerability',
  'l3_vulnerability',
  'l4_vulnerability',
  // 12-15: Layer capacity weights (0-1)
  'l1_capacity_weight',
  'l2_capacity_weight',
  'l3_capacity_weight',
  'l4_capacity_weight',
  // 16-18: Aggregate integrity
  'overall_integrity_weighted',
  'weakest_layer_ratio',
  'fortified_flag',
  // 19-22: Regen capacity per layer (normalized 0-1)
  'regen_capacity_l1',
  'regen_capacity_l2',
  'regen_capacity_l3',
  'regen_capacity_l4',
  // 23-25: Operation counters (normalized)
  'breach_count_normalized',
  'cascade_crack_count_normalized',
  'repair_applied_normalized',
  // 26-29: Mode and phase context
  'mode_normalized',
  'phase_normalized',
  'stakes_multiplier',
  'mode_difficulty',
  // 30-31: Phase flags
  'ghost_mode_flag',
  'sovereignty_phase_flag',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — DL feature label array (40-feature per timestep, sequence 6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical 40-feature DL label set per time-step for ShieldLayerManagerDLBuilder.
 * Each tick in the 6-tick window produces one row of these 40 features.
 * Order is stable across versions — append only.
 */
export const SHIELD_LAYER_MANAGER_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  // 0-3: Integrity ratio per layer
  'dl_l1_integrity_ratio',
  'dl_l2_integrity_ratio',
  'dl_l3_integrity_ratio',
  'dl_l4_integrity_ratio',
  // 4-7: Breached flag per layer
  'dl_l1_breached',
  'dl_l2_breached',
  'dl_l3_breached',
  'dl_l4_breached',
  // 8-11: Vulnerability per layer
  'dl_l1_vulnerability',
  'dl_l2_vulnerability',
  'dl_l3_vulnerability',
  'dl_l4_vulnerability',
  // 12-15: Regen delivered per layer (normalized)
  'dl_regen_l1',
  'dl_regen_l2',
  'dl_regen_l3',
  'dl_regen_l4',
  // 16-19: Damage absorbed per layer (normalized)
  'dl_damage_l1',
  'dl_damage_l2',
  'dl_damage_l3',
  'dl_damage_l4',
  // 20-23: Repair delta per layer (normalized)
  'dl_repair_l1',
  'dl_repair_l2',
  'dl_repair_l3',
  'dl_repair_l4',
  // 24-27: Breach event flag per layer
  'dl_breach_event_l1',
  'dl_breach_event_l2',
  'dl_breach_event_l3',
  'dl_breach_event_l4',
  // 28-31: Cascade crack flag per layer
  'dl_cascade_crack_l1',
  'dl_cascade_crack_l2',
  'dl_cascade_crack_l3',
  'dl_cascade_crack_l4',
  // 32-35: Per-layer integrity ratio delta
  'dl_integrity_delta_l1',
  'dl_integrity_delta_l2',
  'dl_integrity_delta_l3',
  'dl_integrity_delta_l4',
  // 36-39: Aggregate metrics
  'dl_overall_weighted_integrity',
  'dl_weakest_layer_normalized',
  'dl_tick_normalized',
  'dl_event_density',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Type definitions
// ─────────────────────────────────────────────────────────────────────────────

/** 32-feature ML vector extracted from a layer snapshot. */
export interface ShieldLayerManagerMLVector {
  // Layer integrity ratios
  readonly l1IntegrityRatio: number;
  readonly l2IntegrityRatio: number;
  readonly l3IntegrityRatio: number;
  readonly l4IntegrityRatio: number;
  // Layer breach flags
  readonly l1IsBreached: number;
  readonly l2IsBreached: number;
  readonly l3IsBreached: number;
  readonly l4IsBreached: number;
  // Layer vulnerability scores
  readonly l1Vulnerability: number;
  readonly l2Vulnerability: number;
  readonly l3Vulnerability: number;
  readonly l4Vulnerability: number;
  // Layer capacity weights
  readonly l1CapacityWeight: number;
  readonly l2CapacityWeight: number;
  readonly l3CapacityWeight: number;
  readonly l4CapacityWeight: number;
  // Aggregate integrity
  readonly overallIntegrityWeighted: number;
  readonly weakestLayerRatio: number;
  readonly fortifiedFlag: number;
  // Regen capacity per layer
  readonly regenCapacityL1: number;
  readonly regenCapacityL2: number;
  readonly regenCapacityL3: number;
  readonly regenCapacityL4: number;
  // Operation counters
  readonly breachCountNormalized: number;
  readonly cascadeCrackCountNormalized: number;
  readonly repairAppliedNormalized: number;
  // Mode and phase context
  readonly modeNormalized: number;
  readonly phaseNormalized: number;
  readonly stakesMultiplier: number;
  readonly modeDifficulty: number;
  // Phase flags
  readonly ghostModeFlag: number;
  readonly sovereigntyPhaseFlag: number;
}

/** One row of the DL tensor — 40 features for one tick timestep. */
export interface ShieldLayerManagerDLRow {
  readonly tick: number;
  readonly features: readonly number[];
}

/** 6-row DL tensor for sequence modeling. */
export interface ShieldLayerManagerDLTensor {
  readonly rows: readonly ShieldLayerManagerDLRow[];
  readonly sequenceLength: number;
  readonly featureCount: number;
  readonly latestTick: number;
}

/** Per-layer velocity and acceleration of integrity ratio over TREND_WINDOW ticks. */
export interface ShieldLayerManagerLayerTrend {
  readonly layerId: ShieldLayerId;
  readonly velocity: number;
  readonly acceleration: number;
  readonly label: 'RECOVERING' | 'STABLE' | 'DEGRADING' | 'COLLAPSING';
}

/** Trend summary across all four layers. */
export interface ShieldLayerManagerTrendSummary {
  readonly tick: number;
  readonly layers: readonly ShieldLayerManagerLayerTrend[];
  readonly overallVelocity: number;
  readonly overallAcceleration: number;
  readonly dominantTrend: 'RECOVERING' | 'STABLE' | 'DEGRADING' | 'COLLAPSING';
  readonly criticalLayerCount: number;
}

/** Recovery forecast for one layer. */
export interface ShieldLayerManagerLayerForecast {
  readonly layerId: ShieldLayerId;
  readonly currentIntegrityRatio: number;
  readonly ticksToStable: number | null;
  readonly ticksToFull: number | null;
  readonly canRecover: boolean;
  readonly breachRisk: number;
}

/** Full recovery forecast across all layers. */
export interface ShieldLayerManagerResilienceForecast {
  readonly tick: number;
  readonly layers: readonly ShieldLayerManagerLayerForecast[];
  readonly overallBreachRisk: number;
  readonly criticalLayerIds: readonly ShieldLayerId[];
  readonly recommendedAction: string;
}

/** Annotation entry for a single layer breach event. */
export interface ShieldLayerManagerBreachAnnotation {
  readonly tick: number;
  readonly layerId: ShieldLayerId;
  readonly severity: AttackSeverityClass;
  readonly integrityBefore: number;
  readonly integrityAfter: number;
  readonly headline: string;
  readonly detail: string;
  readonly uxHint: string;
}

/** Annotation bundle covering all events in a tick. */
export interface ShieldLayerManagerAnnotationBundle {
  readonly tick: number;
  readonly breaches: readonly ShieldLayerManagerBreachAnnotation[];
  readonly repairEvents: readonly string[];
  readonly cascadeCrackEvents: readonly string[];
  readonly regenEvents: readonly string[];
  readonly overallHeadline: string;
  readonly uxSummary: string;
}

/** UX hint for surface-level display in the chat lane. */
export interface ShieldLayerManagerUXHint {
  readonly layerId: ShieldLayerId | null;
  readonly urgency: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly headline: string;
  readonly subtext: string;
  readonly actionPrompt: string | null;
  readonly chatChannel: 'SHIELD_LOW' | 'SHIELD_MID' | 'SHIELD_HIGH' | 'SHIELD_CRITICAL';
}

/** Single entry in the layer manager history buffer. */
export interface ShieldLayerManagerHistoryEntry {
  readonly tick: number;
  readonly layers: readonly ShieldLayerState[];
  readonly overallIntegrity: number;
  readonly breachedCount: number;
  readonly repairApplied: number;
  readonly damageApplied: number;
  readonly cascadeCracks: number;
}

/** Inspector state — full diagnostic snapshot of the layer manager at a tick. */
export interface ShieldLayerManagerInspectorState {
  readonly tick: number;
  readonly layers: readonly ShieldLayerState[];
  readonly overallIntegrityWeighted: number;
  readonly weakestLayerId: ShieldLayerId;
  readonly weakestIntegrityRatio: number;
  readonly fortified: boolean;
  readonly breachedLayerIds: readonly ShieldLayerId[];
  readonly criticalLayerIds: readonly ShieldLayerId[];
  readonly vulnerabilityMap: Readonly<Record<ShieldLayerId, number>>;
  readonly layerConfigMap: Readonly<Record<ShieldLayerId, ShieldLayerConfig>>;
  readonly historyDepth: number;
  readonly mlVector: ShieldLayerManagerMLVector;
}

/** Session-level analytics aggregated over a run. */
export interface ShieldLayerManagerAnalyticsSummary {
  readonly totalBreaches: number;
  readonly totalRepairApplied: number;
  readonly totalDamageApplied: number;
  readonly totalCascadeCracks: number;
  readonly averageOverallIntegrity: number;
  readonly minOverallIntegrity: number;
  readonly maxOverallIntegrity: number;
  readonly breachCountPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly avgIntegrityPerLayer: Readonly<Record<ShieldLayerId, number>>;
  readonly sustainedLowIntegrityTicks: number;
  readonly criticalEventCount: number;
}

/** Full ensemble object returned by factory functions. */
export interface ShieldLayerManagerEnsemble {
  readonly manager: ShieldLayerManager;
  readonly mlExtractor: ShieldLayerManagerMLExtractor;
  readonly dlBuilder: ShieldLayerManagerDLBuilder;
  readonly trendAnalyzer: ShieldLayerManagerTrendAnalyzer;
  readonly resilienceForecaster: ShieldLayerManagerResilienceForecaster;
  readonly annotator: ShieldLayerManagerAnnotator;
  readonly inspector: ShieldLayerManagerInspector;
  readonly analytics: ShieldLayerManagerAnalytics;
}

/** Parameters for ML vector extraction. */
export interface ShieldLayerManagerMLParams {
  readonly layers: readonly ShieldLayerState[];
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly breachCount: number;
  readonly cascadeCrackCount: number;
  readonly repairApplied: number;
}

/** Parameters for DL row construction. */
export interface ShieldLayerManagerDLRowParams {
  readonly tick: number;
  readonly layers: readonly ShieldLayerState[];
  readonly previousLayers: readonly ShieldLayerState[] | null;
  readonly regenApplied: Readonly<Record<ShieldLayerId, number>>;
  readonly damageApplied: Readonly<Record<ShieldLayerId, number>>;
  readonly repairApplied: Readonly<Record<ShieldLayerId, number>>;
  readonly breachEvents: readonly ShieldLayerId[];
  readonly cascadeCrackEvents: readonly ShieldLayerId[];
}

/** Session report emitted at end of a run. */
export interface ShieldLayerManagerSessionReport {
  readonly runId: string;
  readonly finalTick: number;
  readonly analytics: ShieldLayerManagerAnalyticsSummary;
  readonly finalLayers: readonly ShieldLayerState[];
  readonly finalMLVector: ShieldLayerManagerMLVector;
  readonly trendSummary: ShieldLayerManagerTrendSummary;
  readonly resilienceForecast: ShieldLayerManagerResilienceForecast;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — Pure helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the per-layer vulnerability map for a set of shield layers.
 * Uses GamePrimitives.computeShieldLayerVulnerability for each layer.
 */
export function buildLayerVulnerabilityMap(
  layers: readonly ShieldLayerState[],
): Record<ShieldLayerId, number> {
  const map: Record<string, number> = {};
  for (const layer of layers) {
    map[layer.layerId] = computeShieldLayerVulnerability(
      layer.layerId,
      layer.current,
      layer.max,
    );
  }
  return map as Record<ShieldLayerId, number>;
}

/**
 * Compute a weighted overall integrity ratio across all layers.
 * Uses SHIELD_LAYER_CAPACITY_WEIGHT for each layer's contribution.
 */
export function computeWeightedIntegrity(
  layers: readonly ShieldLayerState[],
): number {
  return computeShieldIntegrityRatio(
    layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max })),
  );
}

/**
 * Compute the normalized regen capacity for a layer (0-1, relative to its max).
 * Uses GamePrimitives.estimateShieldRegenPerTick.
 */
export function computeNormalizedRegenCapacity(
  layer: ShieldLayerState,
): number {
  if (layer.max <= 0) return 0;
  const regenAbsolute = estimateShieldRegenPerTick(layer.layerId, layer.max);
  return Math.min(1, regenAbsolute / layer.max);
}

/**
 * Identify all layers whose integrity ratio is below the CRITICAL threshold.
 */
export function findCriticalLayerIds(
  layers: readonly ShieldLayerState[],
): ShieldLayerId[] {
  return layers
    .filter((l) => l.integrityRatio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD)
    .map((l) => l.layerId);
}

/**
 * Identify all layers whose integrity ratio is below the LOW_WARNING threshold.
 */
export function findLowIntegrityLayerIds(
  layers: readonly ShieldLayerState[],
): ShieldLayerId[] {
  return layers
    .filter(
      (l) =>
        l.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD &&
        l.integrityRatio >= SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD,
    )
    .map((l) => l.layerId);
}

/**
 * Get the absorption-order index for a layer.
 * Uses GamePrimitives.SHIELD_LAYER_ABSORPTION_ORDER to resolve priority.
 */
export function getAbsorptionPriority(layerId: ShieldLayerId): number {
  return SHIELD_LAYER_ABSORPTION_ORDER.indexOf(layerId);
}

/**
 * Score the overall breach risk across all layers (0-1).
 * Combines vulnerability, integrity ratio, and absorption order weight.
 */
export function scoreOverallBreachRisk(
  layers: readonly ShieldLayerState[],
): number {
  if (layers.length === 0) return 0;
  let totalRisk = 0;
  let totalWeight = 0;
  for (const layer of layers) {
    const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
    const vulnerability = computeShieldLayerVulnerability(
      layer.layerId,
      layer.current,
      layer.max,
    );
    const absorptionPriority = getAbsorptionPriority(layer.layerId);
    const priorityBonus = 1 + (3 - absorptionPriority) * 0.1;
    totalRisk += vulnerability * capacityWeight * priorityBonus;
    totalWeight += capacityWeight * priorityBonus;
  }
  return totalWeight > 0 ? Math.min(1, totalRisk / totalWeight) : 0;
}

/**
 * Classify the breach risk into a urgency label.
 */
export function classifyBreachRisk(
  breachRisk: number,
): 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  if (breachRisk >= 0.85) return 'CRITICAL';
  if (breachRisk >= 0.65) return 'HIGH';
  if (breachRisk >= 0.40) return 'MODERATE';
  if (breachRisk >= 0.15) return 'LOW';
  return 'NONE';
}

/**
 * Select the appropriate chat channel based on overall breach risk.
 */
export function getLayerManagerChatChannel(
  breachRisk: number,
): 'SHIELD_LOW' | 'SHIELD_MID' | 'SHIELD_HIGH' | 'SHIELD_CRITICAL' {
  if (breachRisk >= 0.85) return 'SHIELD_CRITICAL';
  if (breachRisk >= 0.55) return 'SHIELD_HIGH';
  if (breachRisk >= 0.25) return 'SHIELD_MID';
  return 'SHIELD_LOW';
}

/**
 * Build a UX headline string for the current layer state.
 * Focuses on the most critical condition found.
 */
export function buildLayerManagerUXHeadline(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  const breached = layers.filter((l) => l.breached);
  const critical = findCriticalLayerIds(layers);
  const isGhost = mode === 'ghost';
  const isSovereignty = phase === 'SOVEREIGNTY';

  if (breached.length >= 3) {
    return isSovereignty
      ? 'SOVEREIGNTY COLLAPSE — three or more shields down'
      : 'Shield system critical — multiple layers breached';
  }
  if (breached.some((l) => l.layerId === 'L4')) {
    return isGhost
      ? 'GHOST NETWORK CORE breached — cascade echo active'
      : 'NETWORK CORE breached — sovereignty cascade imminent';
  }
  if (breached.some((l) => l.layerId === 'L3')) {
    return isGhost
      ? 'INCOME BASE breached — ghost echo chain triggered'
      : 'INCOME BASE breached — opportunity loss accelerating';
  }
  if (critical.length > 0) {
    return `Layer${critical.length > 1 ? 's' : ''} ${critical.join(', ')} critical — under 10% integrity`;
  }
  if (breached.length > 0) {
    return `${breached.map((l) => l.layerId).join(', ')} breached — repair queued`;
  }
  return 'Shield posture stable — all layers holding';
}

/**
 * Build the recommended action string for the resilience forecast.
 * Uses mode-aware language and integrates effective stakes.
 */
export function buildRecommendedAction(
  criticalLayerIds: readonly ShieldLayerId[],
  overallBreachRisk: number,
  mode: ModeCode,
  phase: RunPhase,
): string {
  const stakes = computeEffectiveStakes(phase, mode);
  const isEndgame = isEndgamePhase(phase);

  if (overallBreachRisk >= 0.85) {
    return isEndgame
      ? 'IMMEDIATE: Deploy all available shield cards — sovereignty breach is fatal'
      : 'IMMEDIATE: Use COUNTER or RESCUE cards — cascade breach imminent';
  }
  if (criticalLayerIds.includes('L4')) {
    return 'URGENT: Protect NETWORK CORE — L4 breach triggers sovereignty cascade';
  }
  if (criticalLayerIds.includes('L3') && mode === 'ghost') {
    return 'URGENT: Ghost echo doctrine — L3 breach will chain into L4 cascade';
  }
  if (criticalLayerIds.length > 0) {
    return `DEFEND: Prioritize ${criticalLayerIds[0]} repair — below critical threshold`;
  }
  if (stakes > 1.2) {
    return 'MAINTAIN: High-stakes phase — keep shields above 50% to prevent breach chains';
  }
  return 'HOLD: Shield posture acceptable — monitor and regen passively';
}

/**
 * Score the urgency of repair based on current layer state, active threats,
 * mode, and phase. Uses GamePrimitives scoring primitives.
 */
export function scoreRepairUrgency(
  layers: readonly ShieldLayerState[],
  attacks: readonly AttackEvent[],
  threats: readonly ThreatEnvelope[],
  tick: number,
  mode: ModeCode,
  phase: RunPhase,
): number {
  const breachRisk = scoreOverallBreachRisk(layers);
  const attackUrgency =
    attacks.length > 0
      ? Math.max(...attacks.map((a) => scoreAttackResponseUrgency(a, tick)))
      : 0;
  const threatPressure = computeAggregateThreatPressure(threats, tick);
  const stakes = computeEffectiveStakes(phase, mode);
  return Math.min(
    1,
    breachRisk * 0.40 + attackUrgency * 0.30 + threatPressure * 0.20 + (stakes - 0.6) * 0.10,
  );
}

/**
 * Classify a set of attacks using GamePrimitives.classifyAttackSeverity and
 * return the highest severity class seen.
 */
export function classifyIncomingAttackSeverity(
  attacks: readonly AttackEvent[],
): AttackSeverityClass {
  if (attacks.length === 0) return 'MINOR';
  const classes: AttackSeverityClass[] = ['MINOR', 'MODERATE', 'MAJOR', 'CATASTROPHIC'];
  const severities = attacks.map((a) => classifyAttackSeverity(a));
  return severities.reduce((best, s) =>
    classes.indexOf(s) > classes.indexOf(best) ? s : best,
  );
}

/**
 * Classify the most urgent incoming threat.
 */
export function classifyMostUrgentThreat(
  threats: readonly ThreatEnvelope[],
  tick: number,
): ThreatUrgencyClass {
  if (threats.length === 0) return 'NEGLIGIBLE';
  const classes: ThreatUrgencyClass[] = ['NEGLIGIBLE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const urgencies = threats.map((t) => classifyThreatUrgency(t, tick));
  return urgencies.reduce((best, u) =>
    classes.indexOf(u) > classes.indexOf(best) ? u : best,
  );
}

/**
 * Compute aggregate bot threat contribution to layer pressure.
 * Uses GamePrimitives BOT_THREAT_LEVEL and BOT_STATE_THREAT_MULTIPLIER.
 */
export function computeLayerBotThreatScore(
  botStates: Readonly<Record<HaterBotId, BotState>>,
): number {
  let total = 0;
  for (const [botId, state] of Object.entries(botStates) as [HaterBotId, BotState][]) {
    total += BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[state];
  }
  return Math.min(1, total);
}

/**
 * Compute the mode-adjusted tension floor for shield calculations.
 */
export function computeModeTensionFloor(mode: ModeCode): number {
  return MODE_TENSION_FLOOR[mode];
}

/**
 * Compute the effective regen multiplier for a mode/phase combination.
 * Ghost mode reduces regen; sovereignty phase reduces further.
 */
export function computeRegenMultiplier(mode: ModeCode, phase: RunPhase): number {
  const modeFactors: Record<ModeCode, number> = {
    solo: 1.0,
    pvp: 0.85,
    coop: 1.15,
    ghost: 0.70,
  };
  const phaseFactors: Record<RunPhase, number> = {
    FOUNDATION: 1.0,
    ESCALATION: 0.90,
    SOVEREIGNTY: 0.80,
  };
  return modeFactors[mode] * phaseFactors[phase];
}

/**
 * Compute the breach sensitivity multiplier for a mode/phase combination.
 * Ghost + sovereignty = maximum breach sensitivity.
 */
export function computeBreachSensitivity(mode: ModeCode, phase: RunPhase): number {
  const modeSensitivity: Record<ModeCode, number> = {
    solo: 1.0,
    pvp: 1.3,
    coop: 0.85,
    ghost: 1.6,
  };
  const phaseSensitivity: Record<RunPhase, number> = {
    FOUNDATION: 0.8,
    ESCALATION: 1.0,
    SOVEREIGNTY: 1.25,
  };
  return modeSensitivity[mode] * phaseSensitivity[phase];
}

/**
 * Build the per-layer config map from SHIELD_LAYER_CONFIGS.
 * Used by Inspector and Annotator for config lookups without repeated calls.
 */
export function buildLayerConfigMap(): Record<ShieldLayerId, ShieldLayerConfig> {
  const result: Record<string, ShieldLayerConfig> = {};
  for (const layerId of SHIELD_LAYER_ORDER) {
    result[layerId] = SHIELD_LAYER_CONFIGS[layerId];
  }
  return result as Record<ShieldLayerId, ShieldLayerConfig>;
}

/**
 * Derive the doctrineType from a RoutedAttack's noteTags and target layer.
 * Supports both explicit doctrine and fallback inference.
 */
export function inferDoctrineFromRoutedAttack(
  attack: RoutedAttack,
): ShieldDoctrineAttackType {
  return attack.doctrineType;
}

/**
 * Build a human-readable label for a layer integrity status.
 */
export function buildLayerIntegrityLabel(
  integrityRatio: number,
): string {
  if (integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) return 'FORTIFIED';
  if (integrityRatio >= SHIELD_LAYER_MANAGER_STABLE_THRESHOLD) return 'STABLE';
  if (integrityRatio >= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) return 'LOW';
  if (integrityRatio >= SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) return 'CRITICAL';
  if (integrityRatio > 0) return 'NEAR BREACH';
  return 'BREACHED';
}

/**
 * Compute a narrative weight score for how impactful this layer state is
 * to surface in chat (0-1). Combines breach risk, mode stakes, and threat context.
 */
export function buildLayerManagerNarrativeWeight(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): number {
  const breachRisk = scoreOverallBreachRisk(layers);
  const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase] * MODE_DIFFICULTY_MULTIPLIER[mode];
  const pressureContrib = PRESSURE_TIER_NORMALIZED[pressureTier];
  return Math.min(1, breachRisk * 0.50 + pressureContrib * 0.30 + (stakes - 0.5) * 0.20);
}

/**
 * Compute a pressure risk score for the layer manager context.
 * Delegates to GamePrimitives.computePressureRiskScore.
 */
export function computeLayerPressureRiskScore(
  tier: PressureTier,
  score: number,
): number {
  return computePressureRiskScore(tier, score);
}

/**
 * Build the flat ML feature array from a ShieldLayerManagerMLVector.
 * Order matches SHIELD_LAYER_MANAGER_ML_FEATURE_LABELS.
 */
export function extractMLArray(vector: ShieldLayerManagerMLVector): number[] {
  return [
    vector.l1IntegrityRatio,
    vector.l2IntegrityRatio,
    vector.l3IntegrityRatio,
    vector.l4IntegrityRatio,
    vector.l1IsBreached,
    vector.l2IsBreached,
    vector.l3IsBreached,
    vector.l4IsBreached,
    vector.l1Vulnerability,
    vector.l2Vulnerability,
    vector.l3Vulnerability,
    vector.l4Vulnerability,
    vector.l1CapacityWeight,
    vector.l2CapacityWeight,
    vector.l3CapacityWeight,
    vector.l4CapacityWeight,
    vector.overallIntegrityWeighted,
    vector.weakestLayerRatio,
    vector.fortifiedFlag,
    vector.regenCapacityL1,
    vector.regenCapacityL2,
    vector.regenCapacityL3,
    vector.regenCapacityL4,
    vector.breachCountNormalized,
    vector.cascadeCrackCountNormalized,
    vector.repairAppliedNormalized,
    vector.modeNormalized,
    vector.phaseNormalized,
    vector.stakesMultiplier,
    vector.modeDifficulty,
    vector.ghostModeFlag,
    vector.sovereigntyPhaseFlag,
  ];
}

/**
 * Validate that the ML feature array has the correct length.
 */
export function validateMLArrayLength(arr: readonly number[]): boolean {
  return arr.length === SHIELD_LAYER_MANAGER_ML_FEATURE_COUNT;
}

/**
 * Validate that the DL row has the correct number of features.
 */
export function validateDLRowLength(row: ShieldLayerManagerDLRow): boolean {
  return row.features.length === SHIELD_LAYER_MANAGER_DL_FEATURE_COUNT;
}

/**
 * Describe the layer manager state in a single summary sentence.
 * Used for logs, telemetry, and chat ingress.
 */
export function describeLayerManagerState(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  const weighted = computeWeightedIntegrity(layers);
  const breached = layers.filter((l) => l.breached).length;
  const pct = Math.round(weighted * 100);
  return (
    `Mode=${mode} Phase=${phase}: ` +
    `overall integrity ${pct}%, ` +
    `${breached} layer${breached !== 1 ? 's' : ''} breached`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — ShieldLayerManagerMLExtractor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the canonical 32-feature ML vector from a set of shield layer states,
 * mode, phase, and operation counters.
 *
 * Designed for use by PressureEngine, ShieldEngine, and the chat adapter suite.
 * All features are normalized to [0, 1] or stored as binary flags (0 or 1).
 */
export class ShieldLayerManagerMLExtractor {
  extractVector(params: ShieldLayerManagerMLParams): ShieldLayerManagerMLVector {
    const { layers, mode, phase, breachCount, cascadeCrackCount, repairApplied } = params;

    const getLayer = (id: ShieldLayerId): ShieldLayerState | undefined =>
      layers.find((l) => l.layerId === id);

    const l1 = getLayer('L1');
    const l2 = getLayer('L2');
    const l3 = getLayer('L3');
    const l4 = getLayer('L4');

    const maxBreachCount = 20;
    const maxCrackCount = 10;
    const maxRepair = 200;

    const overall = computeWeightedIntegrity(layers);
    const weakest = [...layers].sort((a, b) => a.integrityRatio - b.integrityRatio)[0];
    const fortified = layers.every(
      (l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
    );

    return {
      l1IntegrityRatio: l1?.integrityRatio ?? 0,
      l2IntegrityRatio: l2?.integrityRatio ?? 0,
      l3IntegrityRatio: l3?.integrityRatio ?? 0,
      l4IntegrityRatio: l4?.integrityRatio ?? 0,

      l1IsBreached: l1?.breached ? 1 : 0,
      l2IsBreached: l2?.breached ? 1 : 0,
      l3IsBreached: l3?.breached ? 1 : 0,
      l4IsBreached: l4?.breached ? 1 : 0,

      l1Vulnerability: l1
        ? computeShieldLayerVulnerability('L1', l1.current, l1.max)
        : 1,
      l2Vulnerability: l2
        ? computeShieldLayerVulnerability('L2', l2.current, l2.max)
        : 1,
      l3Vulnerability: l3
        ? computeShieldLayerVulnerability('L3', l3.current, l3.max)
        : 1,
      l4Vulnerability: l4
        ? computeShieldLayerVulnerability('L4', l4.current, l4.max)
        : 1,

      l1CapacityWeight: SHIELD_LAYER_CAPACITY_WEIGHT['L1'],
      l2CapacityWeight: SHIELD_LAYER_CAPACITY_WEIGHT['L2'],
      l3CapacityWeight: SHIELD_LAYER_CAPACITY_WEIGHT['L3'],
      l4CapacityWeight: SHIELD_LAYER_CAPACITY_WEIGHT['L4'],

      overallIntegrityWeighted: overall,
      weakestLayerRatio: weakest?.integrityRatio ?? 0,
      fortifiedFlag: fortified ? 1 : 0,

      regenCapacityL1: l1 ? computeNormalizedRegenCapacity(l1) : 0,
      regenCapacityL2: l2 ? computeNormalizedRegenCapacity(l2) : 0,
      regenCapacityL3: l3 ? computeNormalizedRegenCapacity(l3) : 0,
      regenCapacityL4: l4 ? computeNormalizedRegenCapacity(l4) : 0,

      breachCountNormalized: Math.min(1, breachCount / maxBreachCount),
      cascadeCrackCountNormalized: Math.min(1, cascadeCrackCount / maxCrackCount),
      repairAppliedNormalized: Math.min(1, repairApplied / maxRepair),

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
    breachCount: number,
    cascadeCrackCount: number,
    repairApplied: number,
  ): ShieldLayerManagerMLVector {
    const s: any = snapshot;
    return this.extractVector({
      layers: s.shieldLayers,
      mode: s.mode,
      phase: s.phase,
      breachCount,
      cascadeCrackCount,
      repairApplied,
    });
  }

  toArray(vector: ShieldLayerManagerMLVector): number[] {
    return extractMLArray(vector);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — ShieldLayerManagerDLBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the canonical 40-feature DL row for one tick and manages a rolling
 * 6-tick tensor window.
 */
export class ShieldLayerManagerDLBuilder {
  private window: ShieldLayerManagerDLRow[] = [];

  buildRow(params: ShieldLayerManagerDLRowParams): ShieldLayerManagerDLRow {
    const {
      tick,
      layers,
      previousLayers,
      regenApplied,
      damageApplied,
      repairApplied,
      breachEvents,
      cascadeCrackEvents,
    } = params;

    const getLayer = (ls: readonly ShieldLayerState[], id: ShieldLayerId) =>
      ls.find((l) => l.layerId === id);
    const prevLayer = (id: ShieldLayerId) =>
      previousLayers ? getLayer(previousLayers, id) : null;

    const maxRegen = 10;
    const maxDamage = 30;
    const maxRepair = 25;
    const maxTick = 200;

    const overall = computeWeightedIntegrity(layers);
    const weakest = [...layers].sort((a, b) => a.integrityRatio - b.integrityRatio)[0];
    const eventCount =
      breachEvents.length + cascadeCrackEvents.length + Object.values(regenApplied).filter((v) => v > 0).length;

    const ids: ShieldLayerId[] = ['L1', 'L2', 'L3', 'L4'];

    const integrityRatios = ids.map((id) => getLayer(layers, id)?.integrityRatio ?? 0);
    const breachedFlags = ids.map((id) => (getLayer(layers, id)?.breached ? 1 : 0));
    const vulnerabilities = ids.map((id) => {
      const l = getLayer(layers, id);
      return l ? computeShieldLayerVulnerability(id, l.current, l.max) : 1;
    });
    const regenNorm = ids.map((id) => Math.min(1, (regenApplied[id] ?? 0) / maxRegen));
    const damageNorm = ids.map((id) => Math.min(1, (damageApplied[id] ?? 0) / maxDamage));
    const repairNorm = ids.map((id) => Math.min(1, (repairApplied[id] ?? 0) / maxRepair));
    const breachFlags = ids.map((id) => (breachEvents.includes(id) ? 1 : 0));
    const crackFlags = ids.map((id) => (cascadeCrackEvents.includes(id) ? 1 : 0));
    const integrityDeltas = ids.map((id) => {
      const curr = getLayer(layers, id)?.integrityRatio ?? 0;
      const prev = prevLayer(id)?.integrityRatio ?? curr;
      return curr - prev;
    });

    const features: number[] = [
      ...integrityRatios,
      ...breachedFlags,
      ...vulnerabilities,
      ...regenNorm,
      ...damageNorm,
      ...repairNorm,
      ...breachFlags,
      ...crackFlags,
      ...integrityDeltas,
      overall,
      weakest?.integrityRatio ?? 0,
      Math.min(1, tick / maxTick),
      Math.min(1, eventCount / 8),
    ];

    return { tick, features: Object.freeze(features) };
  }

  pushRow(row: ShieldLayerManagerDLRow): void {
    this.window.push(row);
    if (this.window.length > SHIELD_LAYER_MANAGER_DL_SEQUENCE_LENGTH) {
      this.window.shift();
    }
  }

  buildAndPush(params: ShieldLayerManagerDLRowParams): ShieldLayerManagerDLRow {
    const row = this.buildRow(params);
    this.pushRow(row);
    return row;
  }

  getTensor(): ShieldLayerManagerDLTensor {
    const rows = [...this.window];
    const latestTick = rows.length > 0 ? rows[rows.length - 1]!.tick : 0;
    return {
      rows: Object.freeze(rows),
      sequenceLength: rows.length,
      featureCount: SHIELD_LAYER_MANAGER_DL_FEATURE_COUNT,
      latestTick,
    };
  }

  reset(): void {
    this.window = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — ShieldLayerManagerTrendAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes per-layer and overall integrity trend velocity and acceleration
 * from the rolling history buffer.
 */
export class ShieldLayerManagerTrendAnalyzer {
  private history: ShieldLayerManagerHistoryEntry[] = [];

  pushEntry(entry: ShieldLayerManagerHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > SHIELD_LAYER_MANAGER_HISTORY_DEPTH) {
      this.history.shift();
    }
  }

  computeLayerTrend(layerId: ShieldLayerId): ShieldLayerManagerLayerTrend {
    const window = this.history.slice(-SHIELD_LAYER_MANAGER_TREND_WINDOW);
    if (window.length < 2) {
      return { layerId, velocity: 0, acceleration: 0, label: 'STABLE' };
    }

    const ratios = window.map(
      (e) => e.layers.find((l) => l.layerId === layerId)?.integrityRatio ?? 0,
    );

    const velocities: number[] = [];
    for (let i = 1; i < ratios.length; i++) {
      velocities.push(ratios[i]! - ratios[i - 1]!);
    }
    const velocity = velocities.length > 0
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length
      : 0;

    const accelerations: number[] = [];
    for (let i = 1; i < velocities.length; i++) {
      accelerations.push(velocities[i]! - velocities[i - 1]!);
    }
    const acceleration = accelerations.length > 0
      ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
      : 0;

    const label = this.classifyTrendLabel(velocity, acceleration);
    return { layerId, velocity, acceleration, label };
  }

  computeSummary(tick: number): ShieldLayerManagerTrendSummary {
    const layerTrends = SHIELD_LAYER_ORDER.map((id) => this.computeLayerTrend(id));

    const overallVelocity =
      layerTrends.reduce((s, t) => s + t.velocity, 0) / layerTrends.length;
    const overallAcceleration =
      layerTrends.reduce((s, t) => s + t.acceleration, 0) / layerTrends.length;

    const labelOrder: ShieldLayerManagerLayerTrend['label'][] = [
      'COLLAPSING',
      'DEGRADING',
      'STABLE',
      'RECOVERING',
    ];
    const dominantTrend = layerTrends.reduce((worst, t) =>
      labelOrder.indexOf(t.label) < labelOrder.indexOf(worst.label) ? t : worst,
    ).label;

    const recentEntry = this.history[this.history.length - 1];
    const criticalLayerCount = recentEntry
      ? findCriticalLayerIds(recentEntry.layers).length
      : 0;

    return {
      tick,
      layers: layerTrends,
      overallVelocity,
      overallAcceleration,
      dominantTrend,
      criticalLayerCount,
    };
  }

  private classifyTrendLabel(
    velocity: number,
    acceleration: number,
  ): ShieldLayerManagerLayerTrend['label'] {
    if (velocity < -0.05 && acceleration < -0.01) return 'COLLAPSING';
    if (velocity < -0.01) return 'DEGRADING';
    if (velocity > 0.02) return 'RECOVERING';
    return 'STABLE';
  }

  reset(): void {
    this.history = [];
  }

  getHistory(): readonly ShieldLayerManagerHistoryEntry[] {
    return [...this.history];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — ShieldLayerManagerResilienceForecaster
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulates forward recovery for each layer to estimate ticks until stable/full.
 * Uses actual config regen rates, mode/phase multipliers, and breach state.
 */
export class ShieldLayerManagerResilienceForecaster {
  forecastLayer(
    layer: ShieldLayerState,
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldLayerManagerLayerForecast {
    const config = getLayerConfig(layer.layerId);
    const regenMultiplier = computeRegenMultiplier(mode, phase);
    const baseRegen = layer.breached ? config.breachedRegenRate : config.passiveRegenRate;
    const effectiveRegen = Math.max(0, baseRegen * regenMultiplier);

    const stableTarget = SHIELD_LAYER_MANAGER_STABLE_THRESHOLD * config.max;
    const fullTarget = config.max;

    let ticksToStable: number | null = null;
    let ticksToFull: number | null = null;
    const canRecover = effectiveRegen > 0;

    if (canRecover) {
      const toStable = stableTarget - layer.current;
      const toFull = fullTarget - layer.current;
      if (toStable <= 0) {
        ticksToStable = 0;
      } else {
        ticksToStable = Math.min(
          SHIELD_LAYER_MANAGER_FORECAST_MAX_HORIZON,
          Math.ceil(toStable / effectiveRegen),
        );
      }
      if (toFull <= 0) {
        ticksToFull = 0;
      } else {
        ticksToFull = Math.min(
          SHIELD_LAYER_MANAGER_FORECAST_MAX_HORIZON,
          Math.ceil(toFull / effectiveRegen),
        );
      }
    }

    const breachRisk = computeShieldLayerVulnerability(
      layer.layerId,
      layer.current,
      layer.max,
    );

    return {
      layerId: layer.layerId,
      currentIntegrityRatio: layer.integrityRatio,
      ticksToStable,
      ticksToFull,
      canRecover,
      breachRisk,
    };
  }

  forecastAll(
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
    tick: number,
  ): ShieldLayerManagerResilienceForecast {
    const layerForecasts = layers.map((l) => this.forecastLayer(l, mode, phase));
    const overallBreachRisk = scoreOverallBreachRisk(layers);
    const criticalLayerIds = findCriticalLayerIds(layers);
    const recommendedAction = buildRecommendedAction(
      criticalLayerIds,
      overallBreachRisk,
      mode,
      phase,
    );

    return {
      tick,
      layers: layerForecasts,
      overallBreachRisk,
      criticalLayerIds,
      recommendedAction,
    };
  }

  forecastFromSnapshot(
    snapshot: RunStateSnapshot,
  ): ShieldLayerManagerResilienceForecast {
    const s: any = snapshot;
    return this.forecastAll(
      s.shieldLayers,
      s.mode,
      s.phase,
      s.tick,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — ShieldLayerManagerAnnotator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces human-readable, UX-focused annotation bundles for layer events.
 * Headlines and subtext are crafted to resonate with the user at the moment
 * of breach, crack, repair, or recovery — conveying stakes, not just data.
 */
export class ShieldLayerManagerAnnotator {
  private readonly labelMap: Record<ShieldLayerId, string> = {
    L1: 'CASH RESERVE',
    L2: 'CREDIT LINE',
    L3: 'INCOME BASE',
    L4: 'NETWORK CORE',
  };

  annotateBreachEvent(
    layerId: ShieldLayerId,
    tick: number,
    integrityBefore: number,
    integrityAfter: number,
    attacks: readonly AttackEvent[],
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldLayerManagerBreachAnnotation {
    const severityClass = classifyIncomingAttackSeverity(attacks);
    const label = this.labelMap[layerId];
    const isEndgame = isEndgamePhase(phase);
    const isGhost = mode === 'ghost';

    const headline = this.buildBreachHeadline(layerId, severityClass, isEndgame, isGhost);
    const detail = this.buildBreachDetail(
      layerId,
      integrityBefore,
      integrityAfter,
      mode,
      phase,
    );
    const uxHint = this.buildBreachUXHint(layerId, isEndgame, isGhost);

    return {
      tick,
      layerId,
      severity: severityClass,
      integrityBefore,
      integrityAfter,
      headline,
      detail,
      uxHint,
    };
  }

  buildAnnotationBundle(
    tick: number,
    layers: readonly ShieldLayerState[],
    breaches: readonly ShieldLayerManagerBreachAnnotation[],
    repairDeltas: Readonly<Record<ShieldLayerId, number>>,
    crackLayers: readonly ShieldLayerId[],
    regenLayers: readonly ShieldLayerId[],
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldLayerManagerAnnotationBundle {
    const repairEvents = (Object.entries(repairDeltas) as [ShieldLayerId, number][])
      .filter(([, v]) => v > 0)
      .map(([id, v]) => `${this.labelMap[id]} repaired +${v.toFixed(0)}HP`);

    const cascadeCrackEvents = crackLayers.map(
      (id) => `${this.labelMap[id]} cascade-cracked (structural integrity reduced)`,
    );

    const regenEvents = regenLayers.map(
      (id) => `${this.labelMap[id]} regenerating passively`,
    );

    const overallHeadline = buildLayerManagerUXHeadline(layers, mode, phase);
    const uxSummary = this.buildTickUXSummary(
      layers,
      breaches.length,
      repairEvents.length,
      mode,
      phase,
    );

    return {
      tick,
      breaches,
      repairEvents,
      cascadeCrackEvents,
      regenEvents,
      overallHeadline,
      uxSummary,
    };
  }

  buildUXHint(
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldLayerManagerUXHint {
    const breachRisk = scoreOverallBreachRisk(layers);
    const urgency = classifyBreachRisk(breachRisk);
    const channel = getLayerManagerChatChannel(breachRisk);
    const headline = buildLayerManagerUXHeadline(layers, mode, phase);
    const critical = findCriticalLayerIds(layers);
    const breached = layers.filter((l) => l.breached);

    const subtext =
      breached.length > 0
        ? `${breached.length} layer${breached.length > 1 ? 's' : ''} breached — regen is your only recovery path`
        : critical.length > 0
          ? `${critical.map((id) => this.labelMap[id]).join(', ')} under critical threshold`
          : 'All layers holding — maintain pressure on offense';

    const actionPrompt = this.buildActionPrompt(breachRisk, critical, breached, mode, phase);
    const weakestId = breached.length > 0
      ? (breached.sort((a, b) => a.integrityRatio - b.integrityRatio)[0]?.layerId ?? null)
      : critical.length > 0
        ? critical[0] ?? null
        : null;

    return {
      layerId: weakestId,
      urgency,
      headline,
      subtext,
      actionPrompt,
      chatChannel: channel,
    };
  }

  private buildBreachHeadline(
    layerId: ShieldLayerId,
    severity: AttackSeverityClass,
    isEndgame: boolean,
    isGhost: boolean,
  ): string {
    const label = this.labelMap[layerId];
    if (layerId === 'L4') {
      return isEndgame
        ? `SOVEREIGNTY FATAL — ${label} breached in final phase`
        : isGhost
          ? `GHOST BREACH — ${label} down, cascade echo activated`
          : `${label} BREACHED — cascade gate open`;
    }
    if (layerId === 'L3' && isGhost) {
      return `GHOST ECHO — ${label} breached, L4 chain vulnerable`;
    }
    const prefix =
      severity === 'CATASTROPHIC'
        ? 'CATASTROPHIC BREACH'
        : severity === 'MAJOR'
          ? 'MAJOR BREACH'
          : 'BREACH';
    return `${prefix} — ${label} compromised`;
  }

  private buildBreachDetail(
    layerId: ShieldLayerId,
    integrityBefore: number,
    integrityAfter: number,
    mode: ModeCode,
    phase: RunPhase,
  ): string {
    const config = getLayerConfig(layerId);
    const beforePct = Math.round(integrityBefore * 100);
    const afterPct = Math.round(integrityAfter * 100);
    const sensitivity = computeBreachSensitivity(mode, phase);
    return (
      `${config.doctrineName}: integrity dropped from ${beforePct}% to ${afterPct}%. ` +
      `Breach sensitivity ×${sensitivity.toFixed(2)} in ${mode}/${phase}. ` +
      config.breachConsequenceText
    );
  }

  private buildBreachUXHint(
    layerId: ShieldLayerId,
    isEndgame: boolean,
    isGhost: boolean,
  ): string {
    if (layerId === 'L4') {
      return isEndgame
        ? 'No recovery path — sovereignty outcome sealed by L4 breach'
        : 'Play RESCUE card immediately or accept cascade chain consequence';
    }
    if (layerId === 'L3') {
      return isGhost
        ? 'Ghost doctrine: L3 breach chains into L4 — act before next tick'
        : 'Income base compromised — high-value opportunities are now blocked';
    }
    if (layerId === 'L2') {
      return 'Credit line breached — debt pressure will spike in upcoming ticks';
    }
    return 'Liquidity buffer breached — short-term cash flow disrupted';
  }

  private buildTickUXSummary(
    layers: readonly ShieldLayerState[],
    breachCount: number,
    repairCount: number,
    mode: ModeCode,
    phase: RunPhase,
  ): string {
    const weighted = computeWeightedIntegrity(layers);
    const pct = Math.round(weighted * 100);
    const stakes = computeEffectiveStakes(phase, mode);
    let summary = `Shield at ${pct}% overall integrity`;
    if (breachCount > 0) summary += `, ${breachCount} breach event${breachCount > 1 ? 's' : ''}`;
    if (repairCount > 0) summary += `, ${repairCount} repair${repairCount > 1 ? 's' : ''} applied`;
    summary += ` (stakes ×${stakes.toFixed(2)})`;
    return summary;
  }

  private buildActionPrompt(
    breachRisk: number,
    critical: readonly ShieldLayerId[],
    breached: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
  ): string | null {
    if (breached.some((l) => l.layerId === 'L4')) {
      return 'Play RESCUE or COUNTER immediately — L4 cascade gate is open';
    }
    if (breachRisk >= 0.75) {
      return 'Deploy defensive card now — breach chain risk is HIGH';
    }
    if (critical.length > 0) {
      const label = this.labelMap[critical[0]!];
      return `Prioritize ${label} repair this tick`;
    }
    if (phase === 'SOVEREIGNTY' && mode === 'ghost') {
      return 'Ghost + Sovereignty: every shield HP matters — protect all layers';
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — ShieldLayerManagerInspector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces a full diagnostic snapshot of the layer manager at a given tick.
 * Used by telemetry, admin tools, and the chat adapter for deep introspection.
 */
export class ShieldLayerManagerInspector {
  private readonly mlExtractor = new ShieldLayerManagerMLExtractor();
  private historyDepth = 0;

  setHistoryDepth(depth: number): void {
    this.historyDepth = depth;
  }

  inspect(
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
    tick: number,
    breachCount: number,
    cascadeCrackCount: number,
    repairApplied: number,
  ): ShieldLayerManagerInspectorState {
    const overallIntegrityWeighted = computeWeightedIntegrity(layers);

    const weakestLayer = [...layers].sort(
      (a, b) => a.integrityRatio - b.integrityRatio,
    )[0];
    const weakestLayerId = weakestLayer?.layerId ?? 'L4';
    const weakestIntegrityRatio = weakestLayer?.integrityRatio ?? 0;

    const fortified = layers.every(
      (l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
    );

    const breachedLayerIds = layers.filter((l) => l.breached).map((l) => l.layerId);
    const criticalLayerIds = findCriticalLayerIds(layers);

    const vulnerabilityMap = buildLayerVulnerabilityMap(layers);
    const layerConfigMap = buildLayerConfigMap();

    const mlVector = this.mlExtractor.extractVector({
      layers,
      mode,
      phase,
      breachCount,
      cascadeCrackCount,
      repairApplied,
    });

    return {
      tick,
      layers,
      overallIntegrityWeighted,
      weakestLayerId,
      weakestIntegrityRatio,
      fortified,
      breachedLayerIds,
      criticalLayerIds,
      vulnerabilityMap,
      layerConfigMap,
      historyDepth: this.historyDepth,
      mlVector,
    };
  }

  inspectFromSnapshot(
    snapshot: RunStateSnapshot,
    breachCount: number,
    cascadeCrackCount: number,
    repairApplied: number,
  ): ShieldLayerManagerInspectorState {
    const s: any = snapshot;
    return this.inspect(
      s.shieldLayers,
      s.mode,
      s.phase,
      s.tick,
      breachCount,
      cascadeCrackCount,
      repairApplied,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — ShieldLayerManagerAnalytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregates session-level analytics for the layer manager.
 * Maintains running counters and averages updated each tick.
 */
export class ShieldLayerManagerAnalytics {
  private totalBreaches = 0;
  private totalRepairApplied = 0;
  private totalDamageApplied = 0;
  private totalCascadeCracks = 0;
  private integrityHistory: number[] = [];
  private layerBreachCounts: Record<ShieldLayerId, number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
  };
  private layerIntegrityAccum: Record<ShieldLayerId, number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
  };
  private tickCount = 0;
  private sustainedLowTicks = 0;
  private criticalEventCount = 0;

  recordTick(
    layers: readonly ShieldLayerState[],
    newBreaches: readonly ShieldLayerId[],
    repairApplied: number,
    damageApplied: number,
    cascadeCracks: number,
  ): void {
    this.tickCount++;
    this.totalRepairApplied += repairApplied;
    this.totalDamageApplied += damageApplied;
    this.totalCascadeCracks += cascadeCracks;

    for (const layerId of newBreaches) {
      this.totalBreaches++;
      this.layerBreachCounts[layerId] = (this.layerBreachCounts[layerId] ?? 0) + 1;
      if (layerId === 'L4') this.criticalEventCount++;
    }

    const overall = computeWeightedIntegrity(layers);
    this.integrityHistory.push(overall);
    if (this.integrityHistory.length > SHIELD_LAYER_MANAGER_HISTORY_DEPTH) {
      this.integrityHistory.shift();
    }

    for (const layer of layers) {
      this.layerIntegrityAccum[layer.layerId] =
        (this.layerIntegrityAccum[layer.layerId] ?? 0) + layer.integrityRatio;
    }

    if (overall < SHIELD_LAYER_MANAGER_FORECAST_LOW_THRESHOLD) {
      this.sustainedLowTicks++;
    }

    if (cascadeCracks > 0) this.criticalEventCount++;
  }

  buildSummary(): ShieldLayerManagerAnalyticsSummary {
    const avgIntegrityPerLayer: Record<ShieldLayerId, number> = {
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
    };

    if (this.tickCount > 0) {
      for (const id of SHIELD_LAYER_ORDER) {
        avgIntegrityPerLayer[id] =
          (this.layerIntegrityAccum[id] ?? 0) / this.tickCount;
      }
    }

    const minOverall =
      this.integrityHistory.length > 0
        ? Math.min(...this.integrityHistory)
        : 1;
    const maxOverall =
      this.integrityHistory.length > 0
        ? Math.max(...this.integrityHistory)
        : 1;
    const avgOverall =
      this.integrityHistory.length > 0
        ? this.integrityHistory.reduce((a, b) => a + b, 0) /
          this.integrityHistory.length
        : 1;

    return {
      totalBreaches: this.totalBreaches,
      totalRepairApplied: this.totalRepairApplied,
      totalDamageApplied: this.totalDamageApplied,
      totalCascadeCracks: this.totalCascadeCracks,
      averageOverallIntegrity: avgOverall,
      minOverallIntegrity: minOverall,
      maxOverallIntegrity: maxOverall,
      breachCountPerLayer: { ...this.layerBreachCounts },
      avgIntegrityPerLayer,
      sustainedLowIntegrityTicks: this.sustainedLowTicks,
      criticalEventCount: this.criticalEventCount,
    };
  }

  reset(): void {
    this.totalBreaches = 0;
    this.totalRepairApplied = 0;
    this.totalDamageApplied = 0;
    this.totalCascadeCracks = 0;
    this.integrityHistory = [];
    this.layerBreachCounts = { L1: 0, L2: 0, L3: 0, L4: 0 };
    this.layerIntegrityAccum = { L1: 0, L2: 0, L3: 0, L4: 0 };
    this.tickCount = 0;
    this.sustainedLowTicks = 0;
    this.criticalEventCount = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — Factory functions and ensemble builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a fully wired ShieldLayerManagerEnsemble with all companion classes
 * instantiated and ready for a new run.
 */
export function createShieldLayerManagerWithAnalytics(): ShieldLayerManagerEnsemble {
  return {
    manager: new ShieldLayerManager(),
    mlExtractor: new ShieldLayerManagerMLExtractor(),
    dlBuilder: new ShieldLayerManagerDLBuilder(),
    trendAnalyzer: new ShieldLayerManagerTrendAnalyzer(),
    resilienceForecaster: new ShieldLayerManagerResilienceForecaster(),
    annotator: new ShieldLayerManagerAnnotator(),
    inspector: new ShieldLayerManagerInspector(),
    analytics: new ShieldLayerManagerAnalytics(),
  };
}

/**
 * Build a one-shot session report for a completed run.
 */
export function buildShieldLayerManagerSessionReport(
  runId: string,
  finalTick: number,
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  analytics: ShieldLayerManagerAnalytics,
  trendAnalyzer: ShieldLayerManagerTrendAnalyzer,
  resilienceForecaster: ShieldLayerManagerResilienceForecaster,
  mlExtractor: ShieldLayerManagerMLExtractor,
  breachCount: number,
  cascadeCrackCount: number,
  repairApplied: number,
): ShieldLayerManagerSessionReport {
  return {
    runId,
    finalTick,
    analytics: analytics.buildSummary(),
    finalLayers: layers,
    finalMLVector: mlExtractor.extractVector({
      layers,
      mode,
      phase,
      breachCount,
      cascadeCrackCount,
      repairApplied,
    }),
    trendSummary: trendAnalyzer.computeSummary(finalTick),
    resilienceForecast: resilienceForecaster.forecastAll(
      layers,
      mode,
      phase,
      finalTick,
    ),
  };
}

/**
 * Compute a threshold report string for the layer manager state.
 * Used by the chat adapter for concise status ingress.
 */
export function buildLayerManagerThresholdReport(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  const weighted = computeWeightedIntegrity(layers);
  const breachRisk = scoreOverallBreachRisk(layers);
  const urgency = classifyBreachRisk(breachRisk);
  const critical = findCriticalLayerIds(layers);
  const low = findLowIntegrityLayerIds(layers);
  const description = describeLayerManagerState(layers, mode, phase);
  return (
    `[SHIELD_LAYER_MANAGER] ${urgency} | weighted=${Math.round(weighted * 100)}% ` +
    `| breach_risk=${Math.round(breachRisk * 100)}% ` +
    `| critical=${critical.join(',') || 'none'} ` +
    `| low=${low.join(',') || 'none'} ` +
    `| ${description}`
  );
}

/**
 * Build a compact ML compat object for cross-subsystem consumption.
 */
export function buildLayerManagerMLCompat(
  vector: ShieldLayerManagerMLVector,
): {
  readonly features: number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
} {
  return {
    features: extractMLArray(vector),
    labels: SHIELD_LAYER_MANAGER_ML_FEATURE_LABELS,
    featureCount: SHIELD_LAYER_MANAGER_ML_FEATURE_COUNT,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — ShieldLayerManager — enhanced simulation layer manager (production)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The authoritative shield layer manager.
 *
 * Manages all layer state transitions in a deterministic, snapshot-driven way:
 * - `regenerate` — applies passive/breached regen after each tick's attacks
 * - `applyRepair` — delivers repair job HP to one or all layers
 * - `applyDamage` — resolves an incoming attack on a target layer with deflection
 * - `applyCascadeCrack` — reduces all non-L4 layers to CASCADE_CRACK_RATIO max
 * - `applyRegenWithMode` — regen with mode/phase multiplier applied
 * - `applyBatchDamage` — processes multiple routed attacks sequentially
 * - `resolveRepairSlices` — applies all pending repair slices for the tick
 * - `computeLayerPostures` — derives posture labels for all layers
 * - `computeSnapshotDiff` — computes per-layer delta between two snapshots
 * - `buildHistoryEntry` — snapshots current state into the history buffer type
 * - `buildBreachReport` — generates a breach summary string for telemetry
 * - `computeModeAdjustedDeflection` — deflection with mode sensitivity overlay
 * - `computeGhostEchoRisk` — probability of L3→L4 ghost echo chain in ghost mode
 * - `computeSovereigntyFatalityRisk` — probability of L4 breach becoming fatal
 * - `computeBreachPressureScore` — combined breach + cascade pressure signal
 * - `buildLayerSummaryMap` — per-layer summary objects for telemetry
 * - `validateLayerConsistency` — runtime invariant check for layer state
 * - `scoreLayerDefenseEfficiency` — ratio of damage blocked vs absorbed
 * - `computeRepairPriority` — returns the layer that should receive repair first
 * - `buildTickEventSummary` — builds a rich tick-level event log entry
 */
export class ShieldLayerManager {
  // ── Core state transitions ──────────────────────────────────────────────

  /**
   * Apply passive or breached regen to all layers.
   * Skips any layer that was breached on this exact tick (doctrine: no same-tick regen).
   */
  public regenerate(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): readonly ShieldLayerState[] {
    return layers.map((layer) => {
      const config = getLayerConfig(layer.layerId);

      const skipForFreshBreach =
        layer.breached && layer.lastDamagedTick === tick;

      if (skipForFreshBreach || layer.current >= layer.max) {
        return buildShieldLayerState(
          layer.layerId,
          layer.current,
          layer.lastDamagedTick,
          layer.lastRecoveredTick,
        );
      }

      const regenRate = layer.breached
        ? config.breachedRegenRate
        : config.passiveRegenRate;

      if (regenRate <= 0) {
        return buildShieldLayerState(
          layer.layerId,
          layer.current,
          layer.lastDamagedTick,
          layer.lastRecoveredTick,
        );
      }

      const nextCurrent = Math.min(layer.max, layer.current + regenRate);

      return buildShieldLayerState(
        layer.layerId,
        nextCurrent,
        layer.lastDamagedTick,
        nextCurrent > layer.current ? tick : layer.lastRecoveredTick,
      );
    });
  }

  /**
   * Apply passive regen with a mode/phase multiplier applied.
   * Delivers more nuanced regen appropriate for the current run context.
   */
  public applyRegenWithMode(
    layers: readonly ShieldLayerState[],
    tick: number,
    mode: ModeCode,
    phase: RunPhase,
  ): readonly ShieldLayerState[] {
    const multiplier = computeRegenMultiplier(mode, phase);
    return layers.map((layer) => {
      const config = getLayerConfig(layer.layerId);
      const skipForFreshBreach = layer.breached && layer.lastDamagedTick === tick;

      if (skipForFreshBreach || layer.current >= layer.max) {
        return buildShieldLayerState(
          layer.layerId,
          layer.current,
          layer.lastDamagedTick,
          layer.lastRecoveredTick,
        );
      }

      const baseRate = layer.breached
        ? config.breachedRegenRate
        : config.passiveRegenRate;
      const regenRate = Math.max(0, baseRate * multiplier);

      if (regenRate <= 0) {
        return buildShieldLayerState(
          layer.layerId,
          layer.current,
          layer.lastDamagedTick,
          layer.lastRecoveredTick,
        );
      }

      const nextCurrent = Math.min(layer.max, layer.current + regenRate);
      return buildShieldLayerState(
        layer.layerId,
        nextCurrent,
        layer.lastDamagedTick,
        nextCurrent > layer.current ? tick : layer.lastRecoveredTick,
      );
    });
  }

  /**
   * Apply repair HP to one or all layers.
   * Returns updated layers and total HP actually applied.
   */
  public applyRepair(
    layers: readonly ShieldLayerState[],
    layerId: RepairLayerId,
    amount: number,
    tick: number,
  ): {
    readonly layers: readonly ShieldLayerState[];
    readonly applied: number;
  } {
    if (amount <= 0) {
      return { layers, applied: 0 };
    }

    let applied = 0;

    const nextLayers = layers.map((layer) => {
      const shouldApply = layerId === 'ALL' || layer.layerId === layerId;
      if (!shouldApply) return layer;

      const nextCurrent = Math.min(layer.max, layer.current + amount);
      const delta = nextCurrent - layer.current;
      applied += delta;

      return buildShieldLayerState(
        layer.layerId,
        nextCurrent,
        layer.lastDamagedTick,
        delta > 0 ? tick : layer.lastRecoveredTick,
      );
    });

    return { layers: nextLayers, applied };
  }

  /**
   * Resolve all pending repair slices for this tick.
   * Each slice targets its specific layer with its slice amount.
   */
  public resolveRepairSlices(
    layers: readonly ShieldLayerState[],
    slices: readonly PendingRepairSlice[],
    tick: number,
  ): {
    readonly layers: readonly ShieldLayerState[];
    readonly totalApplied: number;
    readonly completedJobIds: readonly string[];
  } {
    let current = layers;
    let totalApplied = 0;
    const completedJobIds: string[] = [];

    for (const slice of slices) {
      const result = this.applyRepair(current, slice.layerId, slice.amount, tick);
      current = result.layers;
      totalApplied += result.applied;
      if (slice.completed) {
        completedJobIds.push(slice.jobId);
      }
    }

    return { layers: current, totalApplied, completedJobIds };
  }

  /**
   * Apply damage to a single target layer, computing deflection based on integrity
   * and fortification status.
   */
  public applyDamage(
    layers: readonly ShieldLayerState[],
    targetLayer: ShieldLayerId,
    magnitude: number,
    tick: number,
    options: {
      readonly fortified: boolean;
      readonly bypassDeflection: boolean;
    },
  ): DamageResolution {
    const target = layers.find((layer) => layer.layerId === targetLayer);

    if (target === undefined) {
      throw new Error(`Unknown shield layer: ${targetLayer}`);
    }

    const preHitIntegrity = target.current;
    const deflectionApplied = options.bypassDeflection
      ? 0
      : this.computeDeflection(target.integrityRatio, options.fortified);

    const effectiveDamage = Math.max(
      0,
      Math.round(Math.max(0, magnitude) * (1 - deflectionApplied)),
    );

    const postHitIntegrity = Math.max(0, preHitIntegrity - effectiveDamage);
    const breached = preHitIntegrity > 0 && postHitIntegrity === 0;
    const wasAlreadyBreached = preHitIntegrity === 0;
    const blocked = postHitIntegrity > 0;

    const nextLayers = layers.map((layer) => {
      if (layer.layerId !== targetLayer) return layer;
      return buildShieldLayerState(
        layer.layerId,
        postHitIntegrity,
        effectiveDamage > 0 ? tick : layer.lastDamagedTick,
        layer.lastRecoveredTick,
      );
    });

    return {
      layers: nextLayers,
      actualLayerId: targetLayer,
      fallbackLayerId: null,
      effectiveDamage,
      deflectionApplied,
      preHitIntegrity,
      postHitIntegrity,
      breached,
      wasAlreadyBreached,
      blocked,
    };
  }

  /**
   * Apply mode-adjusted damage — modifies magnitude by the current
   * mode difficulty multiplier before routing to applyDamage.
   */
  public applyModeAdjustedDamage(
    layers: readonly ShieldLayerState[],
    targetLayer: ShieldLayerId,
    magnitude: number,
    tick: number,
    mode: ModeCode,
    phase: RunPhase,
    options: { readonly fortified: boolean; readonly bypassDeflection: boolean },
  ): DamageResolution {
    const sensitivity = computeBreachSensitivity(mode, phase);
    const adjustedMagnitude = magnitude * sensitivity;
    return this.applyDamage(layers, targetLayer, adjustedMagnitude, tick, options);
  }

  /**
   * Process a batch of routed attacks sequentially against the layer state.
   * Returns the final layer state and an array of per-attack resolutions.
   */
  public applyBatchDamage(
    layers: readonly ShieldLayerState[],
    attacks: readonly RoutedAttack[],
    tick: number,
    fortified: boolean,
  ): {
    readonly layers: readonly ShieldLayerState[];
    readonly resolutions: readonly DamageResolution[];
    readonly totalEffectiveDamage: number;
    readonly newBreaches: readonly ShieldLayerId[];
  } {
    let current = layers;
    const resolutions: DamageResolution[] = [];
    let totalEffectiveDamage = 0;
    const newBreaches: ShieldLayerId[] = [];

    for (const attack of attacks) {
      const result = this.applyDamage(
        current,
        attack.targetLayer,
        attack.magnitude,
        tick,
        { fortified, bypassDeflection: attack.bypassDeflection },
      );
      current = result.layers;
      resolutions.push(result);
      totalEffectiveDamage += result.effectiveDamage;
      if (result.breached && !newBreaches.includes(attack.targetLayer)) {
        newBreaches.push(attack.targetLayer);
      }
    }

    return { layers: current, resolutions, totalEffectiveDamage, newBreaches };
  }

  /**
   * Apply cascade crack to all non-L4 layers.
   * Reduces each layer's current HP to at most CASCADE_CRACK_RATIO × max.
   * L4 is exempt — it gates the cascade, not absorbs it.
   */
  public applyCascadeCrack(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): readonly ShieldLayerState[] {
    return layers.map((layer) => {
      if (layer.layerId === 'L4') {
        return buildShieldLayerState(
          layer.layerId,
          layer.current,
          layer.lastDamagedTick,
          layer.lastRecoveredTick,
        );
      }

      const crackTarget = Math.floor(
        layer.max * SHIELD_CONSTANTS.CASCADE_CRACK_RATIO,
      );
      const nextCurrent =
        layer.current > crackTarget ? crackTarget : layer.current;

      return buildShieldLayerState(
        layer.layerId,
        nextCurrent,
        nextCurrent < layer.current ? tick : layer.lastDamagedTick,
        layer.lastRecoveredTick,
      );
    });
  }

  // ── Derived state queries ───────────────────────────────────────────────

  /** Return the layer with the lowest integrity ratio. Ties broken by absorption order. */
  public weakestLayerId(layers: readonly ShieldLayerState[]): ShieldLayerId {
    return [...layers].sort((left, right) => {
      if (left.integrityRatio !== right.integrityRatio) {
        return left.integrityRatio - right.integrityRatio;
      }
      return layerOrderIndex(right.layerId) - layerOrderIndex(left.layerId);
    })[0]?.layerId ?? 'L4';
  }

  /** Return the integrity ratio of the weakest layer. */
  public weakestLayerRatio(layers: readonly ShieldLayerState[]): number {
    const weakestId = this.weakestLayerId(layers);
    return layers.find((l) => l.layerId === weakestId)?.integrityRatio ?? 0;
  }

  /** Return weighted overall integrity ratio across all layers. */
  public overallIntegrityRatio(layers: readonly ShieldLayerState[]): number {
    if (layers.length === 0) return 0;
    return computeWeightedIntegrity(layers);
  }

  /** Return true if all layers are at or above FORTIFIED_THRESHOLD. */
  public isFortified(layers: readonly ShieldLayerState[]): boolean {
    return layers.every(
      (layer) => layer.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
    );
  }

  /** Get a specific layer or throw if not found. */
  public getLayer(
    layers: readonly ShieldLayerState[],
    layerId: ShieldLayerId,
  ): ShieldLayerState {
    const layer = layers.find((candidate) => candidate.layerId === layerId);
    if (layer === undefined) {
      throw new Error(`Unknown shield layer: ${layerId}`);
    }
    return layer;
  }

  /** Create the initial full-health layer array for the start of a run. */
  public createInitialLayers(): readonly ShieldLayerState[] {
    return SHIELD_LAYER_ORDER.map((layerId) =>
      buildShieldLayerState(layerId, getLayerConfig(layerId).max, null, null),
    );
  }

  // ── Advanced analytical methods ─────────────────────────────────────────

  /**
   * Compute the ghost echo risk — probability that an L3 breach chains into L4.
   * Only non-zero in ghost mode; scales with L3 and L4 vulnerability.
   */
  public computeGhostEchoRisk(
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
  ): number {
    if (mode !== 'ghost') return 0;
    const l3 = layers.find((l) => l.layerId === 'L3');
    const l4 = layers.find((l) => l.layerId === 'L4');
    if (!l3 || !l4) return 0;
    const l3Vuln = computeShieldLayerVulnerability('L3', l3.current, l3.max);
    const l4Vuln = computeShieldLayerVulnerability('L4', l4.current, l4.max);
    return Math.min(1, l3Vuln * 0.55 + l4Vuln * 0.45);
  }

  /**
   * Compute the sovereignty fatality risk — probability that an L4 breach
   * constitutes a run-ending sovereignty fatality in the current phase.
   * Only significant in SOVEREIGNTY phase.
   */
  public computeSovereigntyFatalityRisk(
    layers: readonly ShieldLayerState[],
    phase: RunPhase,
    mode: ModeCode,
  ): number {
    if (phase !== 'SOVEREIGNTY') return 0;
    const l4 = layers.find((l) => l.layerId === 'L4');
    if (!l4) return 0;
    const l4Vuln = computeShieldLayerVulnerability('L4', l4.current, l4.max);
    const modeFactor = MODE_DIFFICULTY_MULTIPLIER[mode];
    return Math.min(1, l4Vuln * modeFactor);
  }

  /**
   * Compute the combined breach + cascade pressure score for downstream
   * chat and ML systems. Aggregates breach risk, ghost echo, and sovereignty risk.
   */
  public computeBreachPressureScore(
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
  ): number {
    const basePressure = scoreOverallBreachRisk(layers);
    const ghostEcho = this.computeGhostEchoRisk(layers, mode);
    const sovereigntyFatal = this.computeSovereigntyFatalityRisk(
      layers,
      phase,
      mode,
    );
    return Math.min(
      1,
      basePressure * 0.50 + ghostEcho * 0.25 + sovereigntyFatal * 0.25,
    );
  }

  /**
   * Compute mode-adjusted deflection for a layer, incorporating the mode's
   * breach sensitivity as an inverse modifier.
   */
  public computeModeAdjustedDeflection(
    integrityRatio: number,
    fortified: boolean,
    mode: ModeCode,
    phase: RunPhase,
  ): number {
    const base = this.computeDeflection(integrityRatio, fortified);
    const sensitivity = computeBreachSensitivity(mode, phase);
    // Higher sensitivity = attackers pierce deflection more effectively
    const adjusted = base / sensitivity;
    return Math.max(0, Math.min(SHIELD_CONSTANTS.DEFLECTION_MAX, adjusted));
  }

  /**
   * Determine the highest-priority layer for repair allocation.
   * Uses a scoring model: breached layers first, then by vulnerability × capacity.
   */
  public computeRepairPriority(
    layers: readonly ShieldLayerState[],
    activeJobs: readonly RepairJob[],
  ): ShieldLayerId {
    const jobCountByLayer: Record<ShieldLayerId, number> = {
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
    };
    for (const job of activeJobs) {
      if (job.layerId !== 'ALL') {
        jobCountByLayer[job.layerId as ShieldLayerId] =
          (jobCountByLayer[job.layerId as ShieldLayerId] ?? 0) + 1;
      }
    }

    const scored = layers.map((layer) => {
      const vuln = computeShieldLayerVulnerability(
        layer.layerId,
        layer.current,
        layer.max,
      );
      const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
      const breachBonus = layer.breached ? 2 : 0;
      const jobPenalty =
        (jobCountByLayer[layer.layerId] ?? 0) *
        SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER *
        0.1;
      const score =
        vuln * capacityWeight * 1.5 + breachBonus - jobPenalty;
      return { layerId: layer.layerId, score };
    });

    return scored.sort((a, b) => b.score - a.score)[0]?.layerId ?? 'L1';
  }

  /**
   * Compute posture labels for all layers.
   * Used in annotations and UI state summaries.
   */
  public computeLayerPostures(
    layers: readonly ShieldLayerState[],
  ): Record<ShieldLayerId, string> {
    const postures: Record<string, string> = {};
    for (const layer of layers) {
      postures[layer.layerId] = buildLayerIntegrityLabel(layer.integrityRatio);
    }
    return postures as Record<ShieldLayerId, string>;
  }

  /**
   * Compute the per-layer delta between two layer snapshots.
   * Returns a map of `{ current: delta, integrityRatio: delta }` per layer.
   */
  public computeSnapshotDiff(
    before: readonly ShieldLayerState[],
    after: readonly ShieldLayerState[],
  ): Record<
    ShieldLayerId,
    { readonly currentDelta: number; readonly integrityDelta: number }
  > {
    const diff: Record<string, { currentDelta: number; integrityDelta: number }> = {};
    for (const afterLayer of after) {
      const beforeLayer = before.find((l) => l.layerId === afterLayer.layerId);
      diff[afterLayer.layerId] = {
        currentDelta: afterLayer.current - (beforeLayer?.current ?? afterLayer.current),
        integrityDelta:
          afterLayer.integrityRatio - (beforeLayer?.integrityRatio ?? afterLayer.integrityRatio),
      };
    }
    return diff as Record<
      ShieldLayerId,
      { readonly currentDelta: number; readonly integrityDelta: number }
    >;
  }

  /**
   * Score the defense efficiency for a tick — ratio of damage blocked
   * to total damage that was attempted.
   */
  public scoreLayerDefenseEfficiency(
    resolutions: readonly DamageResolution[],
  ): number {
    if (resolutions.length === 0) return 1;
    let totalAttempted = 0;
    let totalDeflected = 0;
    for (const r of resolutions) {
      const attempted = r.effectiveDamage + r.deflectionApplied * r.preHitIntegrity;
      totalAttempted += attempted;
      totalDeflected += r.deflectionApplied * r.preHitIntegrity;
    }
    return totalAttempted > 0
      ? Math.min(1, totalDeflected / totalAttempted)
      : 1;
  }

  /**
   * Build a per-layer summary map for telemetry and test assertions.
   */
  public buildLayerSummaryMap(
    layers: readonly ShieldLayerState[],
  ): Record<
    ShieldLayerId,
    {
      readonly current: number;
      readonly max: number;
      readonly integrityRatio: number;
      readonly breached: boolean;
      readonly label: string;
      readonly vulnerability: number;
    }
  > {
    const map: Record<string, unknown> = {};
    for (const layer of layers) {
      map[layer.layerId] = {
        current: layer.current,
        max: layer.max,
        integrityRatio: layer.integrityRatio,
        breached: layer.breached,
        label: buildLayerIntegrityLabel(layer.integrityRatio),
        vulnerability: computeShieldLayerVulnerability(
          layer.layerId,
          layer.current,
          layer.max,
        ),
      };
    }
    return map as Record<
      ShieldLayerId,
      {
        current: number;
        max: number;
        integrityRatio: number;
        breached: boolean;
        label: string;
        vulnerability: number;
      }
    >;
  }

  /**
   * Validate layer state consistency. Throws if invariants are violated.
   * - Each layer must have current in [0, max]
   * - Breached flag must match current === 0
   * - integrityRatio must match current / max
   */
  public validateLayerConsistency(layers: readonly ShieldLayerState[]): void {
    for (const layer of layers) {
      if (layer.current < 0 || layer.current > layer.max) {
        throw new Error(
          `Shield layer ${layer.layerId}: current (${layer.current}) out of range [0, ${layer.max}]`,
        );
      }
      const expectedBreached = layer.current <= 0;
      if (layer.breached !== expectedBreached) {
        throw new Error(
          `Shield layer ${layer.layerId}: breached flag mismatch (current=${layer.current}, breached=${layer.breached})`,
        );
      }
      if (layer.max > 0) {
        const expectedRatio = layer.current / layer.max;
        const diff = Math.abs(layer.integrityRatio - expectedRatio);
        if (diff > 0.01) {
          throw new Error(
            `Shield layer ${layer.layerId}: integrityRatio mismatch (expected ≈${expectedRatio.toFixed(3)}, got ${layer.integrityRatio.toFixed(3)})`,
          );
        }
      }
    }
  }

  /**
   * Build a concise breach report string for telemetry and log ingress.
   */
  public buildBreachReport(
    breaches: readonly ShieldLayerId[],
    layers: readonly ShieldLayerState[],
    tick: number,
    mode: ModeCode,
    phase: RunPhase,
  ): string {
    if (breaches.length === 0) return `[tick=${tick}] No breaches`;
    const details = breaches.map((id) => {
      const cfg = getLayerConfig(id);
      return `${id}(${cfg.label})`;
    });
    const overall = Math.round(computeWeightedIntegrity(layers) * 100);
    return (
      `[tick=${tick}] BREACH: ${details.join(', ')} | ` +
      `mode=${mode} phase=${phase} | overall=${overall}%`
    );
  }

  /**
   * Build a tick event summary combining all events from the current tick.
   * Used by telemetry, EngineTickTransaction, and the chat adapter.
   */
  public buildTickEventSummary(params: {
    readonly tick: number;
    readonly layers: readonly ShieldLayerState[];
    readonly newBreaches: readonly ShieldLayerId[];
    readonly repairApplied: number;
    readonly damageApplied: number;
    readonly cascadeCracks: number;
    readonly mode: ModeCode;
    readonly phase: RunPhase;
    readonly attacks: readonly RoutedAttack[];
    readonly cascadeResolution: CascadeResolution | null;
  }): {
    readonly tick: number;
    readonly headline: string;
    readonly detail: string;
    readonly overallIntegrity: number;
    readonly breachRisk: number;
    readonly ghostEchoRisk: number;
    readonly sovereigntyFatalRisk: number;
    readonly mlFeatureCount: number;
  } {
    const {
      tick,
      layers,
      newBreaches,
      repairApplied,
      damageApplied,
      cascadeCracks,
      mode,
      phase,
      attacks,
      cascadeResolution,
    } = params;

    const overallIntegrity = computeWeightedIntegrity(layers);
    const breachRisk = scoreOverallBreachRisk(layers);
    const ghostEchoRisk = this.computeGhostEchoRisk(layers, mode);
    const sovereigntyFatalRisk = this.computeSovereigntyFatalityRisk(
      layers,
      phase,
      mode,
    );

    const headline = buildLayerManagerUXHeadline(layers, mode, phase);

    const cascadeNote =
      cascadeResolution?.triggered
        ? ` | cascade chain ${cascadeResolution.chainId} triggered`
        : '';
    const attackNote =
      attacks.length > 0
        ? ` | ${attacks.length} attack${attacks.length > 1 ? 's' : ''} resolved`
        : '';
    const breachNote =
      newBreaches.length > 0
        ? ` | BREACH: ${newBreaches.join(',')}`
        : '';

    const detail =
      `tick=${tick} mode=${mode} phase=${phase}` +
      ` | integrity=${Math.round(overallIntegrity * 100)}%` +
      ` | damage=${damageApplied} repair=${repairApplied}` +
      ` | cracks=${cascadeCracks}` +
      attackNote +
      breachNote +
      cascadeNote;

    return {
      tick,
      headline,
      detail,
      overallIntegrity,
      breachRisk,
      ghostEchoRisk,
      sovereigntyFatalRisk,
      mlFeatureCount: SHIELD_LAYER_MANAGER_ML_FEATURE_COUNT,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private computeDeflection(
    integrityRatio: number,
    fortified: boolean,
  ): number {
    const base =
      integrityRatio >= 1
        ? SHIELD_CONSTANTS.DEFLECTION_FULL_INTEGRITY
        : integrityRatio >= 0.5
          ? (integrityRatio - 0.5) * 0.20
          : 0;

    const bonus = fortified ? SHIELD_CONSTANTS.FORTIFIED_BONUS_DEFLECT : 0;
    return Math.min(base + bonus, SHIELD_CONSTANTS.DEFLECTION_MAX);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — SHIELD_LAYER_MANAGER_MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_LAYER_MANAGER_MANIFEST = Object.freeze({
  module: 'ShieldLayerManager',
  version: SHIELD_LAYER_MANAGER_MODULE_VERSION,
  mlFeatureCount: SHIELD_LAYER_MANAGER_ML_FEATURE_COUNT,
  dlFeatureCount: SHIELD_LAYER_MANAGER_DL_FEATURE_COUNT,
  dlSequenceLength: SHIELD_LAYER_MANAGER_DL_SEQUENCE_LENGTH,
  historyDepth: SHIELD_LAYER_MANAGER_HISTORY_DEPTH,
  trendWindow: SHIELD_LAYER_MANAGER_TREND_WINDOW,
  forecastMaxHorizon: SHIELD_LAYER_MANAGER_FORECAST_MAX_HORIZON,
  breachHistoryDepth: SHIELD_LAYER_MANAGER_BREACH_HISTORY_DEPTH,
  layerCount: SHIELD_LAYER_ORDER.length,
  layers: SHIELD_LAYER_ORDER,
  companions: [
    'ShieldLayerManagerMLExtractor',
    'ShieldLayerManagerDLBuilder',
    'ShieldLayerManagerTrendAnalyzer',
    'ShieldLayerManagerResilienceForecaster',
    'ShieldLayerManagerAnnotator',
    'ShieldLayerManagerInspector',
    'ShieldLayerManagerAnalytics',
  ],
  factory: 'createShieldLayerManagerWithAnalytics',
  chatAdapterDomain: 'SHIELD_LAYER_MANAGER',
  ready: SHIELD_LAYER_MANAGER_READY,
});

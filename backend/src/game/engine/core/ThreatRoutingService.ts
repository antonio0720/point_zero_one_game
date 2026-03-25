/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/ThreatRoutingService.ts
 *
 * Doctrine:
 * - threat routing is deterministic and mode-aware
 * - tension surfaces become battle attacks only through backend routing
 * - routing must respect disabled bots, counter-intel, and mode targeting
 * - no global mutable state; all outputs are derived from the input snapshot
 * - routing must be cheap enough to run every tick
 * - ML/DL threat vectors drive companion AI intelligence and chat urgency
 * - counter-strategy advice is a first-class routing output
 * - threat trajectory analysis enables predictive chat signaling
 * - bot behavior prediction drives pre-emptive companion coaching
 *
 * Surface summary:
 *   § 1  — Module constants and version metadata
 *   § 2  — ML/DL feature label arrays
 *   § 3  — Existing core types (preserved)
 *   § 4  — Extended analytical types
 *   § 5  — ThreatMLVectorBuilder
 *   § 6  — ThreatDLTensorBuilder
 *   § 7  — ThreatTrajectoryAnalyzer
 *   § 8  — ThreatIntelEngine
 *   § 9  — CounterStrategyAdvisor
 *   § 10 — ThreatBotBehaviorPredictor
 *   § 11 — ThreatSurgeDetector
 *   § 12 — ThreatChatSignalGenerator
 *   § 13 — ThreatHistoryTracker
 *   § 14 — ThreatRoutingService (enhanced)
 *   § 15 — ThreatRoutingFacade
 */

import type {
  AttackCategory,
  AttackEvent,
  HaterBotId,
  ShieldLayerId,
  ThreatEnvelope,
  VisibilityLevel,
} from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  createDeterministicId,
  deepFrozenClone,
  stableStringify,
  checksumSnapshot,
  deepFreeze,
  cloneJson,
} from './Deterministic';
import {
  ModeRuleCompiler,
  type CompiledModeRules,
} from './ModeRuleCompiler';
import {
  PRESSURE_TIER_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  SHIELD_LAYER_ABSORPTION_ORDER,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  COUNTERABILITY_RESISTANCE_SCORE,
  TIMING_CLASS_WINDOW_PRIORITY,
  scoreThreatUrgency,
  classifyThreatUrgency,
  findMostUrgentThreat,
  computeAggregateThreatPressure,
  classifyAttackSeverity,
  computeEffectiveAttackDamage,
  isAttackCounterable,
  scoreAttackResponseUrgency,
  computeShieldLayerVulnerability,
  computeShieldIntegrityRatio,
  PRESSURE_TIER_URGENCY_LABEL,
  describePressureTierExperience,
  isRunPhase,
  isModeCode,
  isHaterBotId,
  HATER_BOT_IDS,
  BOT_STATE_ALLOWED_TRANSITIONS,
  MODE_NORMALIZED,
  RUN_PHASE_NORMALIZED,
} from './GamePrimitives';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Module constants and version metadata
// ─────────────────────────────────────────────────────────────────────────────

export const THREAT_ROUTING_MODULE_VERSION = 'threat-routing.v2.2026' as const;
export const THREAT_ROUTING_MODULE_READY = true as const;

/** Total features in the 32-dim ML threat vector. */
export const THREAT_ML_FEATURE_COUNT = 32 as const;

/** Total features in the 48-dim DL threat tensor. */
export const THREAT_DL_FEATURE_COUNT = 48 as const;

/** DL tensor shape [batch=1, features=48]. */
export const THREAT_DL_TENSOR_SHAPE: readonly [1, 48] = Object.freeze([1, 48] as const);

/** Maximum history entries retained per run in ThreatHistoryTracker. */
export const THREAT_HISTORY_MAX_ENTRIES = 64 as const;

/** Surge threshold — if aggregate pressure increases by this much per tick, flag a surge. */
export const THREAT_SURGE_DELTA_THRESHOLD = 0.15 as const;

/** Minimum route count to consider the routing result significant. */
export const THREAT_SIGNIFICANCE_MIN_ROUTES = 1 as const;

/** Maximum bots we model in the ML vector (BOT_01..BOT_05). */
const THREAT_ML_BOT_COUNT = 5 as const;

/** Normalization caps for raw threat metrics. */
const THREAT_CAP_SEVERITY = 10 as const;
const THREAT_CAP_MAGNITUDE = 50 as const;
const THREAT_CAP_ROUTES = 15 as const;
const THREAT_CAP_PENDING_ATTACKS = 15 as const;
const THREAT_CAP_BOT_HEAT = 100 as const;
const THREAT_CAP_BATTLE_BUDGET = 100_000 as const;
const THREAT_CAP_RIVALRY_CARRY = 30 as const;
const THREAT_CAP_VISIBLE_THREATS = 20 as const;
const THREAT_CAP_TENSION_SCORE = 100 as const;
const THREAT_CAP_PRESSURE_SCORE = 100 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — ML / DL feature label arrays
// ─────────────────────────────────────────────────────────────────────────────

/** 32-feature ML label set for threat routing inference. */
export const THREAT_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Routing output (8)
  'routes_total_normalized',
  'routes_direct_normalized',
  'routes_breach_normalized',
  'routes_extraction_normalized',
  'injected_attacks_normalized',
  'deferred_threats_normalized',
  'max_route_magnitude_normalized',
  'avg_route_magnitude_normalized',
  // Run context (6)
  'pressure_score_normalized',
  'pressure_tier_normalized',
  'tension_score_normalized',
  'mode_normalized',
  'mode_difficulty',
  'mode_tension_floor',
  // Battle state (8)
  'battle_budget_normalized',
  'battle_rivalry_carry_normalized',
  'battle_active_bot_count_normalized',
  'battle_attacking_bot_count_normalized',
  'battle_pending_attacks_normalized',
  'battle_first_blood_claimed',
  'battle_aggregate_bot_threat',
  'battle_neutralized_bot_ratio',
  // Shield state (5)
  'shield_weakest_ratio',
  'shield_integrity_composite',
  'shield_breach_count_normalized',
  'shield_direct_attack_ratio',
  'shield_repair_queue_normalized',
  // Threat intelligence (5)
  'visible_threat_count_normalized',
  'most_urgent_threat_score',
  'aggregate_threat_pressure',
  'ambient_threats_spawned',
  'counter_intel_tier_normalized',
] as const);

/** 48-feature DL input label set for deep threat pattern learning. */
export const THREAT_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...THREAT_ML_FEATURE_LABELS,
  // Per-bot state encoding (5 features — one per bot)
  'bot_01_threat_composite',
  'bot_02_threat_composite',
  'bot_03_threat_composite',
  'bot_04_threat_composite',
  'bot_05_threat_composite',
  // Attack category distribution (6)
  'category_extraction_ratio',
  'category_lock_ratio',
  'category_drain_ratio',
  'category_heat_ratio',
  'category_breach_ratio',
  'category_debt_ratio',
  // Trajectory features (5)
  'threat_surge_detected',
  'threat_velocity_per_tick',
  'threat_decel_per_tick',
  'prev_tick_route_count_normalized',
  'prev_tick_max_magnitude_normalized',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Existing core types (preserved)
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreatRoutingOptions {
  readonly maxNewAttacks?: number;
  readonly spawnAmbientThreats?: boolean;
  readonly allowBotRouting?: boolean;
  readonly strictDedup?: boolean;
  readonly rules?: CompiledModeRules;
}

export interface RoutedThreat {
  readonly threatId: string;
  readonly source: string;
  readonly category: AttackCategory;
  readonly targetLayer: ShieldLayerId | 'DIRECT';
  readonly targetEntity: AttackEvent['targetEntity'];
  readonly magnitude: number;
  readonly visibility: VisibilityLevel;
  readonly attack: AttackEvent;
  readonly notes: readonly string[];
}

export interface ThreatRoutingResult {
  readonly snapshot: RunStateSnapshot;
  readonly rules: CompiledModeRules;
  readonly injectedAttacks: readonly AttackEvent[];
  readonly deferredThreats: readonly ThreatEnvelope[];
  readonly routes: readonly RoutedThreat[];
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Extended analytical types
// ─────────────────────────────────────────────────────────────────────────────

/** 32-feature ML vector for threat routing. */
export interface ThreatMLVector {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 32];
  readonly extractedAtMs: number;
}

/** 48-feature DL tensor for deep threat pattern learning. */
export interface ThreatDLTensor {
  readonly runId: string;
  readonly tick: number;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Single sample in a threat trajectory. */
export interface ThreatTrajectoryPoint {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly routeCount: number;
  readonly injectedAttackCount: number;
  readonly deferredThreatCount: number;
  readonly maxMagnitude: number;
  readonly avgMagnitude: number;
  readonly aggregatePressure: number;
  readonly directAttackCount: number;
  readonly battleBudget: number;
  readonly rivalryHeatCarry: number;
  readonly snapshotChecksum: string;
}

/** Aggregated threat trajectory for a run. */
export interface ThreatTrajectory {
  readonly runId: string;
  readonly sampleCount: number;
  readonly firstTick: number;
  readonly lastTick: number;
  readonly samples: readonly ThreatTrajectoryPoint[];
  readonly routeVelocityPerTick: number;
  readonly magnitudeVelocityPerTick: number;
  readonly pressureTrend: 'RISING' | 'STABLE' | 'FALLING';
  readonly peakMagnitude: number;
  readonly peakAggregPressure: number;
  readonly totalInjectedAttacks: number;
}

/** Intelligence summary for a specific threat source. */
export interface ThreatIntelEntry {
  readonly sourceId: string;
  readonly totalRoutes: number;
  readonly avgMagnitude: number;
  readonly peakMagnitude: number;
  readonly dominantCategory: AttackCategory;
  readonly targetLayerFrequency: Readonly<Record<ShieldLayerId | 'DIRECT', number>>;
  readonly firstSeenTick: number;
  readonly lastSeenTick: number;
  readonly isBot: boolean;
  readonly threatLevel: number;
}

/** Full threat intelligence report for a run. */
export interface ThreatIntelReport {
  readonly runId: string;
  readonly tick: number;
  readonly sources: readonly ThreatIntelEntry[];
  readonly mostDangerousSource: string | null;
  readonly mostDangerousCategory: AttackCategory | null;
  readonly mostVulnerableLayer: ShieldLayerId | 'DIRECT' | null;
  readonly totalUniqueSourcesSeen: number;
  readonly botIntelSummary: readonly string[];
}

/** Counter-strategy recommendation for a routing result. */
export interface CounterStrategyAdvice {
  readonly runId: string;
  readonly tick: number;
  readonly primaryCounterCategory: AttackCategory | null;
  readonly recommendedTimingClasses: readonly string[];
  readonly counterableAttackCount: number;
  readonly uncounterableAttackCount: number;
  readonly bestCounterWindowPriority: number;
  readonly urgencyScore: number;
  readonly actionPhrases: readonly string[];
  readonly countersAvailable: boolean;
}

/** Predicted bot behavior for the next tick(s). */
export interface ThreatBotPrediction {
  readonly botId: HaterBotId;
  readonly currentState: RunStateSnapshot['battle']['bots'][number]['state'];
  readonly predictedNextState: RunStateSnapshot['battle']['bots'][number]['state'];
  readonly attackProbability: number;
  readonly estimatedSeverity: number;
  readonly predictedCategory: AttackCategory;
  readonly confidenceScore: number;
  readonly rationale: string;
}

/** Surge event detected in threat trajectory. */
export interface ThreatSurgeEvent {
  readonly tick: number;
  readonly deltaAggregatePressure: number;
  readonly prevPressure: number;
  readonly currPressure: number;
  readonly triggeredBy: string;
}

/** Chat signal payload generated from a routing result. */
export interface ThreatChatSignalPayload {
  readonly signalId: string;
  readonly runId: string;
  readonly tick: number;
  readonly urgency: 'BACKGROUND' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly signalKind:
    | 'THREAT_ROUTED'
    | 'THREAT_SURGE_DETECTED'
    | 'BOT_COORDINATION_DETECTED'
    | 'COUNTER_WINDOW_OPEN'
    | 'DIRECT_ATTACK_INCOMING'
    | 'SHIELD_TARGETED'
    | 'AMBIENT_THREAT_SPAWNED'
    | 'HIGH_MAGNITUDE_ROUTE';
  readonly companionMessage: string;
  readonly pressureTierLabel: string;
  readonly pressureTierExperience: string;
  readonly counterAdvice: CounterStrategyAdvice | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Store-level routing stats for health reporting. */
export interface ThreatRoutingStats {
  readonly totalRoutes: number;
  readonly totalSurges: number;
  readonly avgMagnitudePerRoute: number;
  readonly directAttackRatio: number;
  readonly counterableRatio: number;
  readonly botRoutedRatio: number;
  readonly lastRoutedAtMs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — ThreatMLVectorBuilder
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function normField(value: number, cap: number): number {
  return clamp01(cap > 0 ? value / cap : 0);
}

/**
 * Builds 32-feature ML vectors from a ThreatRoutingResult + snapshot.
 * All GamePrimitives scoring maps and functions are applied:
 *   - scoreThreatUrgency on each visible threat
 *   - classifyThreatUrgency for threat classification
 *   - findMostUrgentThreat for peak threat extraction
 *   - computeAggregateThreatPressure for total threat load
 *   - BOT_THREAT_LEVEL, BOT_STATE_THREAT_MULTIPLIER for bot composites
 *   - PRESSURE_TIER_NORMALIZED, MODE_DIFFICULTY_MULTIPLIER for run context
 *   - computeShieldIntegrityRatio for composite shield health
 */
export class ThreatMLVectorBuilder {
  public build(result: ThreatRoutingResult): ThreatMLVector {
    const snap = result.snapshot;
    const features = this.extractFeatures(result, snap);
    return {
      runId: snap.runId,
      tick: snap.tick,
      features: Object.freeze(features),
      featureLabels: THREAT_ML_FEATURE_LABELS,
      vectorShape: [1, THREAT_ML_FEATURE_COUNT],
      extractedAtMs: Date.now(),
    };
  }

  private extractFeatures(result: ThreatRoutingResult, snap: RunStateSnapshot): number[] {
    const routes = result.routes;
    const directRoutes = routes.filter((r) => r.targetLayer === 'DIRECT');
    const breachRoutes = routes.filter((r) => r.category === 'BREACH');
    const extractionRoutes = routes.filter((r) => r.category === 'EXTRACTION');
    const magnitudes = routes.map((r) => r.magnitude);
    const maxMag = magnitudes.length > 0 ? Math.max(...magnitudes) : 0;
    const avgMag = magnitudes.length > 0
      ? magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length
      : 0;

    // Routing output
    const routesNorm = normField(routes.length, THREAT_CAP_ROUTES);
    const directNorm = normField(directRoutes.length, THREAT_CAP_ROUTES);
    const breachNorm = normField(breachRoutes.length, THREAT_CAP_ROUTES);
    const extractionNorm = normField(extractionRoutes.length, THREAT_CAP_ROUTES);
    const injectedNorm = normField(result.injectedAttacks.length, THREAT_CAP_PENDING_ATTACKS);
    const deferredNorm = normField(result.deferredThreats.length, THREAT_CAP_VISIBLE_THREATS);
    const maxMagNorm = normField(maxMag, THREAT_CAP_MAGNITUDE);
    const avgMagNorm = normField(avgMag, THREAT_CAP_MAGNITUDE);

    // Run context
    const pressureScoreNorm = normField(snap.pressure.score, THREAT_CAP_PRESSURE_SCORE);
    const tierNorm = PRESSURE_TIER_NORMALIZED[snap.pressure.tier];
    const tensionNorm = normField(snap.tension.score, THREAT_CAP_TENSION_SCORE);
    const modeNorm = MODE_NORMALIZED[snap.mode];
    const modeDiff = clamp01(MODE_DIFFICULTY_MULTIPLIER[snap.mode] / 2.0);
    const tensionFloor = MODE_TENSION_FLOOR[snap.mode];

    // Battle state
    const battleBudgetNorm = normField(snap.battle.battleBudget, THREAT_CAP_BATTLE_BUDGET);
    const rivalryNorm = normField(snap.battle.rivalryHeatCarry, THREAT_CAP_RIVALRY_CARRY);
    const activeBots = snap.battle.bots.filter((b) => !b.neutralized);
    const attackingBots = activeBots.filter((b) => b.state === 'ATTACKING');
    const activeBotNorm = normField(activeBots.length, THREAT_ML_BOT_COUNT);
    const attackingBotNorm = normField(attackingBots.length, THREAT_ML_BOT_COUNT);
    const pendingNorm = normField(snap.battle.pendingAttacks.length, THREAT_CAP_PENDING_ATTACKS);
    const firstBlood = snap.battle.firstBloodClaimed ? 1.0 : 0.0;
    const aggBotThreat = this.computeAggregateBotThreat(snap);
    const neutralizedRatio = normField(snap.battle.neutralizedBotIds.length, THREAT_ML_BOT_COUNT);

    // Shield state
    const shieldLayers = snap.shield.layers.map((l) => ({
      id: l.layerId, current: l.current, max: l.max,
    }));
    const shieldIntegrity = computeShieldIntegrityRatio(shieldLayers);
    const weakestLayer = snap.shield.layers.find((l) => l.layerId === snap.shield.weakestLayerId);
    const weakestRatio = weakestLayer
      ? clamp01(weakestLayer.max > 0 ? weakestLayer.current / weakestLayer.max : 0)
      : 0;
    const breachNormShield = normField(snap.shield.breachesThisRun, 20);
    const directAttackRatio = routes.length > 0
      ? directRoutes.length / routes.length
      : 0;
    const repairNorm = normField(snap.shield.repairQueueDepth, 10);

    // Threat intelligence
    const visibleNorm = normField(snap.tension.visibleThreats.length, THREAT_CAP_VISIBLE_THREATS);
    const mostUrgent = findMostUrgentThreat(snap.tension.visibleThreats, snap.tick);
    // Normalize raw threat severity using THREAT_CAP_SEVERITY as the ceiling
    const mostUrgentSevNorm = mostUrgent
      ? normField(mostUrgent.severity, THREAT_CAP_SEVERITY)
      : 0;
    const aggPressure = computeAggregateThreatPressure(snap.tension.visibleThreats, snap.tick);
    const ambientSpawned = result.routes.some((r) =>
      r.notes.some((n) => n.includes('ambient'))
    ) ? 1.0 : 0.0;
    const counterIntelNorm = normField(result.rules.threatPolicy.counterIntelTier, 4);

    return [
      // Routing output (8)
      routesNorm, directNorm, breachNorm, extractionNorm,
      injectedNorm, deferredNorm, maxMagNorm, avgMagNorm,
      // Run context (6)
      pressureScoreNorm, tierNorm, tensionNorm, modeNorm, modeDiff, tensionFloor,
      // Battle state (8)
      battleBudgetNorm, rivalryNorm, activeBotNorm, attackingBotNorm,
      pendingNorm, firstBlood, aggBotThreat, neutralizedRatio,
      // Shield state (5)
      weakestRatio, shieldIntegrity, breachNormShield, directAttackRatio, repairNorm,
      // Threat intelligence (5): mostUrgentSevNorm uses THREAT_CAP_SEVERITY for raw severity ceiling
      visibleNorm, mostUrgentSevNorm, aggPressure,
      ambientSpawned, counterIntelNorm,
    ];
  }

  private computeAggregateBotThreat(snap: RunStateSnapshot): number {
    if (snap.battle.bots.length === 0) return 0;
    const total = snap.battle.bots.reduce((sum, bot) => {
      if (bot.neutralized) return sum;
      const botId = isHaterBotId(bot.botId) ? bot.botId : 'BOT_01' as HaterBotId;
      const baseLevel = BOT_THREAT_LEVEL[botId] ?? 0.5;
      const stateMultiplier = BOT_STATE_THREAT_MULTIPLIER[bot.state] ?? 0.5;
      return sum + baseLevel * stateMultiplier;
    }, 0);
    return clamp01(total / THREAT_ML_BOT_COUNT);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — ThreatDLTensorBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds 48-feature DL tensors from routing results.
 * Extends the 32-feature ML vector with per-bot composites,
 * attack category distribution, and trajectory delta features.
 */
export class ThreatDLTensorBuilder {
  private readonly mlBuilder: ThreatMLVectorBuilder;
  private readonly policyVersion: string;

  public constructor(policyVersion = THREAT_ROUTING_MODULE_VERSION) {
    this.policyVersion = policyVersion;
    this.mlBuilder = new ThreatMLVectorBuilder();
  }

  public build(
    result: ThreatRoutingResult,
    prevResult?: ThreatRoutingResult,
  ): ThreatDLTensor {
    const mlVector = this.mlBuilder.build(result);
    const extended = this.extractExtended(result, prevResult);
    const fullVector = [...mlVector.features, ...extended];

    return {
      runId: result.snapshot.runId,
      tick: result.snapshot.tick,
      inputVector: Object.freeze(fullVector),
      featureLabels: THREAT_DL_FEATURE_LABELS,
      tensorShape: THREAT_DL_TENSOR_SHAPE,
      policyVersion: this.policyVersion,
      extractedAtMs: Date.now(),
    };
  }

  private extractExtended(
    result: ThreatRoutingResult,
    prev?: ThreatRoutingResult,
  ): number[] {
    const snap = result.snapshot;
    const routes = result.routes;

    // Per-bot state encoding (5 features)
    const botFeatures = HATER_BOT_IDS.map((botId) => {
      const bot = snap.battle.bots.find((b) => b.botId === botId);
      if (!bot) return 0;
      const level = BOT_THREAT_LEVEL[botId] ?? 0.5;
      const stateMultiplier = BOT_STATE_THREAT_MULTIPLIER[bot.state] ?? 0.5;
      const heatFactor = normField(bot.heat, THREAT_CAP_BOT_HEAT);
      return clamp01(level * stateMultiplier * (0.5 + heatFactor * 0.5));
    });

    // Attack category distribution (6 features)
    const totalRoutes = Math.max(1, routes.length);
    const categories: AttackCategory[] = ['EXTRACTION', 'LOCK', 'DRAIN', 'HEAT', 'BREACH', 'DEBT'];
    const categoryFeatures = categories.map((cat) => {
      const count = routes.filter((r) => r.category === cat).length;
      return count / totalRoutes;
    });

    // Trajectory features (5 features)
    const currPressure = computeAggregateThreatPressure(snap.tension.visibleThreats, snap.tick);
    let surgeFlagged = 0;
    let threatVelocity = 0;
    let threatDecel = 0;
    let prevRouteNorm = 0;
    let prevMaxMagNorm = 0;

    if (prev) {
      const prevPressure = computeAggregateThreatPressure(prev.snapshot.tension.visibleThreats, prev.snapshot.tick);
      const delta = currPressure - prevPressure;
      surgeFlagged = delta >= THREAT_SURGE_DELTA_THRESHOLD * 100 ? 1.0 : 0.0;
      threatVelocity = clamp01((delta + 50) / 100);
      threatDecel = delta < 0 ? clamp01(Math.abs(delta) / 50) : 0;
      prevRouteNorm = normField(prev.routes.length, THREAT_CAP_ROUTES);
      const prevMags = prev.routes.map((r) => r.magnitude);
      const prevMax = prevMags.length > 0 ? Math.max(...prevMags) : 0;
      prevMaxMagNorm = normField(prevMax, THREAT_CAP_MAGNITUDE);
    }

    return [
      ...botFeatures,
      ...categoryFeatures,
      surgeFlagged, threatVelocity, threatDecel, prevRouteNorm, prevMaxMagNorm,
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — ThreatTrajectoryAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyzes a sequence of routing results to build a threat trajectory.
 * Uses computeAggregateThreatPressure and scoreThreatUrgency at each sample
 * to build a semantically-rich picture of how threat pressure has evolved.
 */
export class ThreatTrajectoryAnalyzer {
  public analyze(
    results: readonly ThreatRoutingResult[],
    runId: string,
  ): ThreatTrajectory {
    if (results.length === 0) {
      throw new Error('ThreatTrajectoryAnalyzer: empty results list');
    }

    const sorted = [...results].sort((a, b) => a.snapshot.tick - b.snapshot.tick);
    const samples = sorted.map((r) => this.toSample(r));

    const first = samples[0];
    const last = samples[samples.length - 1];

    const routeVelocity = this.computeVelocity(samples, 'routeCount');
    const magVelocity = this.computeVelocity(samples, 'maxMagnitude');
    const pressureTrend = this.computePressureTrend(samples);
    const peakMagnitude = Math.max(...samples.map((s) => s.maxMagnitude));
    const peakPressure = Math.max(...samples.map((s) => s.aggregatePressure));
    const totalInjected = samples.reduce((acc, s) => acc + s.injectedAttackCount, 0);

    return {
      runId,
      sampleCount: samples.length,
      firstTick: first.tick,
      lastTick: last.tick,
      samples: Object.freeze(samples),
      routeVelocityPerTick: routeVelocity,
      magnitudeVelocityPerTick: magVelocity,
      pressureTrend,
      peakMagnitude,
      peakAggregPressure: peakPressure,
      totalInjectedAttacks: totalInjected,
    };
  }

  private toSample(result: ThreatRoutingResult): ThreatTrajectoryPoint {
    const snap = result.snapshot;
    const magnitudes = result.routes.map((r) => r.magnitude);
    const maxMag = magnitudes.length > 0 ? Math.max(...magnitudes) : 0;
    const avgMag = magnitudes.length > 0
      ? magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length
      : 0;
    const aggPressure = computeAggregateThreatPressure(snap.tension.visibleThreats, snap.tick);
    const directCount = result.routes.filter((r) => r.targetLayer === 'DIRECT').length;

    return {
      tick: snap.tick,
      capturedAtMs: Date.now(),
      routeCount: result.routes.length,
      injectedAttackCount: result.injectedAttacks.length,
      deferredThreatCount: result.deferredThreats.length,
      maxMagnitude: maxMag,
      avgMagnitude: avgMag,
      aggregatePressure: aggPressure,
      directAttackCount: directCount,
      battleBudget: snap.battle.battleBudget,
      rivalryHeatCarry: snap.battle.rivalryHeatCarry,
      snapshotChecksum: checksumSnapshot(snap),
    };
  }

  private computeVelocity(
    samples: ThreatTrajectoryPoint[],
    field: 'routeCount' | 'maxMagnitude',
  ): number {
    if (samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const tickDelta = last.tick - first.tick;
    if (tickDelta === 0) return 0;
    const valueDelta = field === 'routeCount'
      ? last.routeCount - first.routeCount
      : last.maxMagnitude - first.maxMagnitude;
    return valueDelta / tickDelta;
  }

  private computePressureTrend(
    samples: ThreatTrajectoryPoint[],
  ): 'RISING' | 'STABLE' | 'FALLING' {
    if (samples.length < 3) return 'STABLE';
    const pressureValues = samples.map((s) => s.aggregatePressure);
    const firstHalf = pressureValues.slice(0, Math.floor(pressureValues.length / 2));
    const secondHalf = pressureValues.slice(Math.floor(pressureValues.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const delta = avgSecond - avgFirst;
    if (delta > 5) return 'RISING';
    if (delta < -5) return 'FALLING';
    return 'STABLE';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — ThreatIntelEngine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds threat intelligence reports by aggregating route history
 * per source. Uses BOT_THREAT_LEVEL and BOT_STATE_THREAT_MULTIPLIER
 * to score bot entries. Identifies the most dangerous source and
 * most frequently targeted shield layer.
 */
export class ThreatIntelEngine {
  private readonly sourceMap = new Map<string, ThreatIntelEntry>();

  public ingest(result: ThreatRoutingResult): void {
    const snap = result.snapshot;
    for (const route of result.routes) {
      const existing = this.sourceMap.get(route.source);
      const totalRoutes = (existing?.totalRoutes ?? 0) + 1;
      const avgMag = existing
        ? (existing.avgMagnitude * existing.totalRoutes + route.magnitude) / totalRoutes
        : route.magnitude;
      const peakMag = Math.max(existing?.peakMagnitude ?? 0, route.magnitude);
      const targetLayerFreq = this.updateLayerFrequency(
        existing?.targetLayerFrequency,
        route.targetLayer,
      );
      const isBot = isHaterBotId(route.source);
      const botId = isBot ? (route.source as HaterBotId) : null;
      const threatLevel = botId
        ? this.computeBotThreatLevel(snap, botId)
        : this.computeSourceThreatLevel(route);

      const updated: ThreatIntelEntry = {
        sourceId: route.source,
        totalRoutes,
        avgMagnitude: avgMag,
        peakMagnitude: peakMag,
        dominantCategory: this.pickDominantCategory(existing, route.category),
        targetLayerFrequency: targetLayerFreq,
        firstSeenTick: existing?.firstSeenTick ?? snap.tick,
        lastSeenTick: snap.tick,
        isBot,
        threatLevel,
      };

      this.sourceMap.set(route.source, updated);
    }
  }

  public buildReport(runId: string, tick: number, snap: RunStateSnapshot): ThreatIntelReport {
    const sources = Array.from(this.sourceMap.values());

    const mostDangerous = sources.reduce(
      (max, s) => (s.threatLevel > (max?.threatLevel ?? 0) ? s : max),
      null as ThreatIntelEntry | null,
    );

    // Aggregate attack category frequency across all sources
    const categoryCount = new Map<AttackCategory, number>();
    for (const s of sources) {
      categoryCount.set(
        s.dominantCategory,
        (categoryCount.get(s.dominantCategory) ?? 0) + s.totalRoutes,
      );
    }
    let mostDangerousCat: AttackCategory | null = null;
    let maxCatCount = 0;
    for (const [cat, count] of categoryCount.entries()) {
      if (count > maxCatCount) {
        maxCatCount = count;
        mostDangerousCat = cat;
      }
    }

    // Most frequently targeted layer
    const layerCount = new Map<string, number>();
    for (const s of sources) {
      for (const [layer, count] of Object.entries(s.targetLayerFrequency)) {
        layerCount.set(layer, (layerCount.get(layer) ?? 0) + count);
      }
    }
    let mostVulnerableLayer: ShieldLayerId | 'DIRECT' | null = null;
    let maxLayerCount = 0;
    for (const [layer, count] of layerCount.entries()) {
      if (count > maxLayerCount) {
        maxLayerCount = count;
        mostVulnerableLayer = layer as ShieldLayerId | 'DIRECT';
      }
    }

    // Bot intelligence summary
    const botSummary = snap.battle.bots
      .filter((b) => !b.neutralized)
      .map((b) => {
        const botId = isHaterBotId(b.botId) ? b.botId : 'BOT_01' as HaterBotId;
        const level = BOT_THREAT_LEVEL[botId] ?? 0.5;
        const stateMultiplier = BOT_STATE_THREAT_MULTIPLIER[b.state] ?? 0.5;
        return `${b.botId}:state=${b.state}:heat=${b.heat}:level=${(level * stateMultiplier).toFixed(2)}`;
      });

    return {
      runId,
      tick,
      sources: Object.freeze(sources),
      mostDangerousSource: mostDangerous?.sourceId ?? null,
      mostDangerousCategory: mostDangerousCat,
      mostVulnerableLayer,
      totalUniqueSourcesSeen: this.sourceMap.size,
      botIntelSummary: Object.freeze(botSummary),
    };
  }

  public clear(): void {
    this.sourceMap.clear();
  }

  private computeBotThreatLevel(snap: RunStateSnapshot, botId: HaterBotId): number {
    const bot = snap.battle.bots.find((b) => b.botId === botId);
    if (!bot) return 0;
    const baseLevel = BOT_THREAT_LEVEL[botId] ?? 0.5;
    const stateMultiplier = BOT_STATE_THREAT_MULTIPLIER[bot.state] ?? 0.5;
    const heatBonus = normField(bot.heat, THREAT_CAP_BOT_HEAT) * 0.3;
    return clamp01(baseLevel * stateMultiplier + heatBonus);
  }

  private computeSourceThreatLevel(route: RoutedThreat): number {
    const baseMag = ATTACK_CATEGORY_BASE_MAGNITUDE[route.category] ?? 5;
    return clamp01(baseMag / THREAT_CAP_MAGNITUDE);
  }

  private updateLayerFrequency(
    existing: Readonly<Record<ShieldLayerId | 'DIRECT', number>> | undefined,
    layer: ShieldLayerId | 'DIRECT',
  ): Readonly<Record<ShieldLayerId | 'DIRECT', number>> {
    const base: Record<ShieldLayerId | 'DIRECT', number> = {
      L1: 0, L2: 0, L3: 0, L4: 0, DIRECT: 0,
      ...(existing ?? {}),
    };
    base[layer] = (base[layer] ?? 0) + 1;
    return Object.freeze(base);
  }

  private pickDominantCategory(
    existing: ThreatIntelEntry | undefined,
    incoming: AttackCategory,
  ): AttackCategory {
    // Prefer incoming if its base magnitude is >= existing dominant category
    if (!existing) return incoming;
    const incomingMag = ATTACK_CATEGORY_BASE_MAGNITUDE[incoming] ?? 0;
    const existingMag = ATTACK_CATEGORY_BASE_MAGNITUDE[existing.dominantCategory] ?? 0;
    return incomingMag >= existingMag ? incoming : existing.dominantCategory;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — CounterStrategyAdvisor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recommends counter-strategies based on the current routing result.
 * Uses ATTACK_CATEGORY_IS_COUNTERABLE and COUNTERABILITY_RESISTANCE_SCORE
 * to identify which attacks can be countered and how well.
 * Uses TIMING_CLASS_WINDOW_PRIORITY to recommend the best timing window.
 * Uses classifyAttackSeverity and scoreAttackResponseUrgency for urgency scoring.
 */
export class CounterStrategyAdvisor {
  public advise(
    result: ThreatRoutingResult,
    snapshot: RunStateSnapshot,
  ): CounterStrategyAdvice {
    const attacks = [...result.injectedAttacks, ...snapshot.battle.pendingAttacks];
    const unique = this.dedupeAttacks(attacks);

    const counterable = unique.filter((a) => isAttackCounterable(a));
    const uncounterable = unique.filter((a) => !isAttackCounterable(a));

    const categoryScores = this.computeCategoryPriority(unique, snapshot);
    const primaryCategory = categoryScores[0]?.[0] ?? null;

    const timingClasses = this.recommendTimingClasses(unique, snapshot);
    const bestPriority = timingClasses.reduce(
      (best, tc) => Math.max(best, TIMING_CLASS_WINDOW_PRIORITY[tc as keyof typeof TIMING_CLASS_WINDOW_PRIORITY] ?? 0),
      0,
    );

    const urgencyScore = this.computeUrgencyScore(unique, snapshot);

    const actionPhrases = this.buildActionPhrases(
      counterable, uncounterable, primaryCategory, snapshot, unique,
    );

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      primaryCounterCategory: primaryCategory,
      recommendedTimingClasses: Object.freeze(timingClasses),
      counterableAttackCount: counterable.length,
      uncounterableAttackCount: uncounterable.length,
      bestCounterWindowPriority: bestPriority,
      urgencyScore,
      actionPhrases: Object.freeze(actionPhrases),
      countersAvailable: counterable.length > 0,
    };
  }

  private dedupeAttacks(attacks: readonly AttackEvent[]): AttackEvent[] {
    const seen = new Set<string>();
    const result: AttackEvent[] = [];
    for (const attack of attacks) {
      if (!seen.has(attack.attackId)) {
        seen.add(attack.attackId);
        result.push(attack);
      }
    }
    return result;
  }

  private computeCategoryPriority(
    attacks: readonly AttackEvent[],
    snap: RunStateSnapshot,
  ): [AttackCategory, number][] {
    const scores = new Map<AttackCategory, number>();
    for (const attack of attacks) {
      const baseMag = ATTACK_CATEGORY_BASE_MAGNITUDE[attack.category] ?? 5;
      const counterability = ATTACK_CATEGORY_IS_COUNTERABLE[attack.category] ? 1.0 : 0.5;
      const responseUrgency = scoreAttackResponseUrgency(attack, snap.tick);
      const score = baseMag * counterability * responseUrgency;
      scores.set(attack.category, Math.max(scores.get(attack.category) ?? 0, score));
    }
    return Array.from(scores.entries()).sort((a, b) => b[1] - a[1]) as [AttackCategory, number][];
  }

  private recommendTimingClasses(
    attacks: readonly AttackEvent[],
    snap: RunStateSnapshot,
  ): string[] {
    const classes = new Set<string>();

    // Always recommend CTR if there are counterable attacks
    if (attacks.some((a) => isAttackCounterable(a))) {
      classes.add('CTR');
    }

    // FATE window if any high-severity attacks
    if (attacks.some((a) => {
      const severity = classifyAttackSeverity(a);
      return severity === 'CATASTROPHIC' || severity === 'MAJOR';
    })) {
      classes.add('FATE');
    }

    // RES window for EXTRACTION or DRAIN
    if (attacks.some((a) => a.category === 'EXTRACTION' || a.category === 'DRAIN')) {
      classes.add('RES');
    }

    // AID window for DEBT attacks
    if (attacks.some((a) => a.category === 'DEBT')) {
      classes.add('AID');
    }

    // PHZ for phase boundary pressure
    if (snap.phase === 'SOVEREIGNTY') {
      classes.add('PHZ');
    }

    return Array.from(classes);
  }

  private computeUrgencyScore(attacks: readonly AttackEvent[], snap: RunStateSnapshot): number {
    if (attacks.length === 0) return 0;
    const scores = attacks.map((a) => scoreAttackResponseUrgency(a, snap.tick));
    const maxScore = Math.max(...scores);
    return clamp01(maxScore);
  }

  private buildActionPhrases(
    counterable: readonly AttackEvent[],
    uncounterable: readonly AttackEvent[],
    primaryCategory: AttackCategory | null,
    snap: RunStateSnapshot,
    allAttacks: readonly AttackEvent[],
  ): string[] {
    const phrases: string[] = [];

    if (counterable.length > 0) {
      phrases.push(
        `${counterable.length} attack(s) can be countered — play CTR timing cards.`,
      );
    }
    if (uncounterable.length > 0) {
      phrases.push(`${uncounterable.length} attack(s) are uncounterable — absorb with shield.`);
    }
    if (primaryCategory) {
      const baseMag = ATTACK_CATEGORY_BASE_MAGNITUDE[primaryCategory] ?? 5;
      const resistance = COUNTERABILITY_RESISTANCE_SCORE[
        ATTACK_CATEGORY_IS_COUNTERABLE[primaryCategory] ? 'HARD' : 'NONE'
      ] ?? 0;
      phrases.push(
        `Primary threat: ${primaryCategory} (base magnitude ${baseMag}, counter resistance ${resistance}).`,
      );
    }

    // Compute effective damage for the most dangerous attack
    if (allAttacks.length > 0) {
      const most = allAttacks.reduce((max, a) => a.magnitude > max.magnitude ? a : max);
      const weakest = snap.shield.layers.find((l) => l.layerId === snap.shield.weakestLayerId);
      if (weakest) {
        const effectiveDamage = computeEffectiveAttackDamage(most);
        phrases.push(
          `Most dangerous attack: ${most.attackId.slice(-8)} — effective damage ${effectiveDamage.toFixed(1)} to ${snap.shield.weakestLayerId}.`,
        );
      }
    }

    if (snap.pressure.tier === 'T4' || snap.pressure.tier === 'T3') {
      phrases.push('High pressure — prioritize defense over income this tick.');
    }

    return phrases;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — ThreatBotBehaviorPredictor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Predicts future bot behavior states using BOT_STATE_ALLOWED_TRANSITIONS
 * and BOT_STATE_THREAT_MULTIPLIER. Produces per-bot predictions with
 * attack probability and estimated attack severity.
 */
export class ThreatBotBehaviorPredictor {
  public predict(snapshot: RunStateSnapshot, rules: CompiledModeRules): readonly ThreatBotPrediction[] {
    return snapshot.battle.bots
      .filter((b) => !b.neutralized)
      .map((bot) => this.predictBot(bot, snapshot, rules));
  }

  private predictBot(
    bot: RunStateSnapshot['battle']['bots'][number],
    snap: RunStateSnapshot,
    rules: CompiledModeRules,
  ): ThreatBotPrediction {
    const botId = isHaterBotId(bot.botId) ? bot.botId : 'BOT_01' as HaterBotId;
    const allowedTransitions = BOT_STATE_ALLOWED_TRANSITIONS[bot.state] ?? [bot.state];
    const baseLevel = BOT_THREAT_LEVEL[botId] ?? 0.5;
    const stateMultiplier = BOT_STATE_THREAT_MULTIPLIER[bot.state] ?? 0.5;

    // Compute attack probability based on current state and pressure
    const tierValue = PRESSURE_TIER_NORMALIZED[snap.pressure.tier];
    const heatFactor = normField(bot.heat, THREAT_CAP_BOT_HEAT);
    const rawAttackProb = baseLevel * stateMultiplier * (0.4 + tierValue * 0.4 + heatFactor * 0.2);
    const attackProb = clamp01(rawAttackProb);

    // Predict next state
    const predictedState = this.predictNextState(bot.state, allowedTransitions, attackProb, snap, rules);

    // Estimate severity and category
    const estimatedSeverity = Math.round(
      clamp01(baseLevel * tierValue + heatFactor * 0.3) * 10,
    );
    const predictedCategory = this.predictCategory(bot.state, snap.pressure.tier);

    // Confidence based on current state clarity
    const confidence = bot.state === 'ATTACKING' ? 0.9
      : bot.state === 'TARGETING' ? 0.75
      : bot.state === 'WATCHING' ? 0.5
      : 0.3;

    const rationale = this.buildRationale(botId, bot.state, predictedState, attackProb, snap);

    return {
      botId,
      currentState: bot.state,
      predictedNextState: predictedState,
      attackProbability: Number(attackProb.toFixed(4)),
      estimatedSeverity: Math.max(1, Math.min(10, estimatedSeverity)),
      predictedCategory,
      confidenceScore: confidence,
      rationale,
    };
  }

  private predictNextState(
    currentState: RunStateSnapshot['battle']['bots'][number]['state'],
    allowed: readonly string[],
    attackProb: number,
    snap: RunStateSnapshot,
    rules: CompiledModeRules,
  ): RunStateSnapshot['battle']['bots'][number]['state'] {
    const tierValue = PRESSURE_TIER_NORMALIZED[snap.pressure.tier];

    // Pressure-based escalation
    if (currentState === 'WATCHING' && tierValue >= 0.75) {
      return 'TARGETING';
    }
    if (currentState === 'TARGETING' && attackProb >= 0.6) {
      return 'ATTACKING';
    }
    if (currentState === 'ATTACKING' && attackProb < 0.3) {
      return 'RETREATING';
    }
    if (currentState === 'RETREATING') {
      return 'WATCHING';
    }

    // Check if the rules allow the state and it's in allowed transitions
    const modeDiff = MODE_DIFFICULTY_MULTIPLIER[snap.mode];
    if (modeDiff >= 1.4 && currentState === 'DORMANT') {
      return 'WATCHING';
    }

    // Use first allowed transition as default
    const validTransitions = allowed.filter((t) => t !== currentState);
    if (validTransitions.length > 0) {
      return validTransitions[0] as RunStateSnapshot['battle']['bots'][number]['state'];
    }

    // Suppress unused rules reference
    void rules;
    return currentState;
  }

  private predictCategory(
    state: RunStateSnapshot['battle']['bots'][number]['state'],
    tier: RunStateSnapshot['pressure']['tier'],
  ): AttackCategory {
    if (state === 'ATTACKING') {
      if (tier === 'T4') return 'BREACH';
      if (tier === 'T3') return 'DRAIN';
      return 'EXTRACTION';
    }
    if (state === 'TARGETING') return 'LOCK';
    return 'HEAT';
  }

  private buildRationale(
    botId: HaterBotId,
    current: string,
    predicted: string,
    attackProb: number,
    snap: RunStateSnapshot,
  ): string {
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[snap.pressure.tier];
    return (
      `${botId} transitioning ${current}→${predicted}. ` +
      `Attack probability: ${(attackProb * 100).toFixed(0)}%. ` +
      `Pressure tier: ${tierLabel}. Phase: ${snap.phase}.`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — ThreatSurgeDetector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects when aggregate threat pressure spikes unexpectedly.
 * Uses computeAggregateThreatPressure at each sample to compute deltas.
 * A surge fires when pressure increases by more than THREAT_SURGE_DELTA_THRESHOLD.
 */
export class ThreatSurgeDetector {
  private lastPressure: number | null = null;
  private lastTick: number | null = null;

  public check(result: ThreatRoutingResult): ThreatSurgeEvent | null {
    const snap = result.snapshot;
    const currPressure = computeAggregateThreatPressure(snap.tension.visibleThreats, snap.tick);
    const routeMagnitude = result.routes.reduce((sum, r) => sum + r.magnitude, 0);

    if (this.lastPressure === null || this.lastTick === null) {
      this.lastPressure = currPressure;
      this.lastTick = snap.tick;
      return null;
    }

    const delta = currPressure - this.lastPressure;
    const threshold = THREAT_SURGE_DELTA_THRESHOLD * 100;

    const surgeTriggered = delta >= threshold || routeMagnitude >= THREAT_CAP_MAGNITUDE * 0.7;

    if (surgeTriggered) {
      const event: ThreatSurgeEvent = {
        tick: snap.tick,
        deltaAggregatePressure: delta,
        prevPressure: this.lastPressure,
        currPressure,
        triggeredBy: delta >= threshold
          ? `pressure_delta:${delta.toFixed(1)}`
          : `route_magnitude:${routeMagnitude.toFixed(1)}`,
      };
      this.lastPressure = currPressure;
      this.lastTick = snap.tick;
      return event;
    }

    this.lastPressure = currPressure;
    this.lastTick = snap.tick;
    return null;
  }

  public reset(): void {
    this.lastPressure = null;
    this.lastTick = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — ThreatChatSignalGenerator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates chat signal payloads from routing results.
 * Uses PRESSURE_TIER_URGENCY_LABEL and describePressureTierExperience
 * for tier-grounded companion message language.
 * Uses classifyThreatUrgency to categorize threat severity.
 * Uses isRunPhase, isModeCode for validation before building metadata.
 */
export class ThreatChatSignalGenerator {
  public generate(
    result: ThreatRoutingResult,
    surge?: ThreatSurgeEvent | null,
    counterAdvice?: CounterStrategyAdvice | null,
    botPredictions?: readonly ThreatBotPrediction[],
  ): ThreatChatSignalPayload {
    const snap = result.snapshot;
    const tier = snap.pressure.tier;
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    const tierExperience = describePressureTierExperience(tier);

    const validMode = isModeCode(snap.mode) ? snap.mode : 'solo';
    const validPhase = isRunPhase(snap.phase) ? snap.phase : 'FOUNDATION';

    const urgency = this.computeUrgency(result, surge, snap);
    const signalKind = this.classifySignalKind(result, surge, snap);
    const companionMessage = this.buildCompanionMessage(
      signalKind, result, surge, counterAdvice, botPredictions,
      tierLabel, tierExperience, validPhase, validMode,
    );

    const signalId = createDeterministicId(
      'threat-chat-signal',
      snap.runId,
      snap.tick,
      signalKind,
      checksumSnapshot(snap).slice(0, 10),
    );

    // Classify most urgent threat using classifyThreatUrgency
    const mostUrgent = findMostUrgentThreat(snap.tension.visibleThreats, snap.tick);
    const urgencyClass = mostUrgent
      ? classifyThreatUrgency(mostUrgent, snap.tick)
      : 'LOW';

    return {
      signalId,
      runId: snap.runId,
      tick: snap.tick,
      urgency,
      signalKind,
      companionMessage,
      pressureTierLabel: tierLabel,
      pressureTierExperience: tierExperience,
      counterAdvice: counterAdvice ?? null,
      metadata: Object.freeze({
        phase: validPhase,
        mode: validMode,
        tier,
        routeCount: result.routes.length,
        injectedAttackCount: result.injectedAttacks.length,
        deferredThreatCount: result.deferredThreats.length,
        surgeDetected: surge !== null,
        surgeDelta: surge?.deltaAggregatePressure ?? null,
        threatUrgencyClass: urgencyClass,
        botsAttacking: snap.battle.bots.filter((b) => b.state === 'ATTACKING').length,
        counterableAttacks: counterAdvice?.counterableAttackCount ?? 0,
      }),
    };
  }

  private computeUrgency(
    result: ThreatRoutingResult,
    surge: ThreatSurgeEvent | null | undefined,
    snap: RunStateSnapshot,
  ): ThreatChatSignalPayload['urgency'] {
    if (surge && surge.deltaAggregatePressure >= THREAT_SURGE_DELTA_THRESHOLD * 200) return 'CRITICAL';
    if (result.routes.some((r) => r.targetLayer === 'DIRECT')) return 'CRITICAL';
    // Use scoreThreatUrgency on each visible threat and escalate if any scores CRITICAL
    const topThreatScore = snap.tension.visibleThreats.reduce(
      (best, t) => Math.max(best, scoreThreatUrgency(t, snap.tick)),
      0,
    );
    if (topThreatScore >= 0.9) return 'CRITICAL';
    if (surge) return 'HIGH';
    if (snap.pressure.tier === 'T4' || topThreatScore >= 0.7) return 'HIGH';
    if (result.injectedAttacks.length >= 3) return 'HIGH';
    if (snap.pressure.tier === 'T3' || topThreatScore >= 0.45) return 'MODERATE';
    if (result.injectedAttacks.length >= 1) return 'MODERATE';
    if (result.routes.length >= THREAT_SIGNIFICANCE_MIN_ROUTES) return 'LOW';
    return 'BACKGROUND';
  }

  private classifySignalKind(
    result: ThreatRoutingResult,
    surge: ThreatSurgeEvent | null | undefined,
    snap: RunStateSnapshot,
  ): ThreatChatSignalPayload['signalKind'] {
    if (surge) return 'THREAT_SURGE_DETECTED';
    if (result.routes.some((r) => r.targetLayer === 'DIRECT')) return 'DIRECT_ATTACK_INCOMING';

    const botRoutes = result.routes.filter((r) => r.source.startsWith('BOT_'));
    if (botRoutes.length >= 2) return 'BOT_COORDINATION_DETECTED';

    const shieldTargeted = result.routes.some((r) =>
      r.targetLayer !== 'DIRECT' && snap.shield.layers.some((l) => l.layerId === r.targetLayer && l.integrityRatio <= 0.3),
    );
    if (shieldTargeted) return 'SHIELD_TARGETED';

    const hasCounterWindow = Object.values(snap.timers.activeDecisionWindows).some(
      (w) => w.timingClass === 'CTR' && !w.consumed,
    );
    if (hasCounterWindow && result.injectedAttacks.length > 0) return 'COUNTER_WINDOW_OPEN';

    const maxMag = result.routes.reduce((max, r) => Math.max(max, r.magnitude), 0);
    if (maxMag >= THREAT_CAP_MAGNITUDE * 0.5) return 'HIGH_MAGNITUDE_ROUTE';

    if (result.routes.some((r) => r.notes.some((n) => n.includes('ambient')))) {
      return 'AMBIENT_THREAT_SPAWNED';
    }

    return 'THREAT_ROUTED';
  }

  private buildCompanionMessage(
    signalKind: ThreatChatSignalPayload['signalKind'],
    result: ThreatRoutingResult,
    surge: ThreatSurgeEvent | null | undefined,
    counterAdvice: CounterStrategyAdvice | null | undefined,
    botPredictions: readonly ThreatBotPrediction[] | undefined,
    tierLabel: string,
    tierExperience: string,
    phase: string,
    mode: string,
  ): string {
    const snap = result.snapshot;

    switch (signalKind) {
      case 'THREAT_SURGE_DETECTED': {
        return (
          `SURGE: Aggregate threat pressure spiked by ${surge?.deltaAggregatePressure.toFixed(1) ?? '?'} ` +
          `at tick ${snap.tick}. ${tierExperience} ${result.injectedAttacks.length} attacks injected.`
        );
      }
      case 'DIRECT_ATTACK_INCOMING': {
        const directRoutes = result.routes.filter((r) => r.targetLayer === 'DIRECT');
        return (
          `DIRECT ATTACK: ${directRoutes.length} direct attack(s) bypassing shields. ` +
          `${tierLabel} pressure. ${phase} phase. Use CTR or FATE windows now.`
        );
      }
      case 'BOT_COORDINATION_DETECTED': {
        const botRoutes = result.routes.filter((r) => r.source.startsWith('BOT_'));
        const botIds = [...new Set(botRoutes.map((r) => r.source))].join(', ');
        const topPrediction = botPredictions?.[0];
        const predMsg = topPrediction
          ? ` ${topPrediction.botId} predicted to ${topPrediction.predictedNextState} next tick.`
          : '';
        return `BOT COORDINATION: ${botIds} attacking simultaneously. ${tierLabel}.${predMsg}`;
      }
      case 'SHIELD_TARGETED': {
        const weakestLayerId = snap.shield.weakestLayerId;
        const weakest = snap.shield.layers.find((l) => l.layerId === weakestLayerId);
        const ratio = weakest ? (weakest.integrityRatio * 100).toFixed(0) : '?';
        return (
          `SHIELD TARGETED: ${weakestLayerId} at ${ratio}% integrity. ` +
          `${result.routes.filter((r) => r.targetLayer === weakestLayerId).length} routes targeting it. ` +
          `${tierExperience}`
        );
      }
      case 'COUNTER_WINDOW_OPEN': {
        const ctr = counterAdvice;
        return (
          `COUNTER WINDOW: ${ctr?.counterableAttackCount ?? 0} counterable attacks + open CTR window. ` +
          `Urgency: ${((ctr?.urgencyScore ?? 0) * 100).toFixed(0)}%. ` +
          `${ctr?.actionPhrases[0] ?? 'Play counter cards now.'}`
        );
      }
      case 'HIGH_MAGNITUDE_ROUTE': {
        const maxRoute = result.routes.reduce((max, r) => r.magnitude > max.magnitude ? r : max);
        return (
          `HIGH MAGNITUDE: ${maxRoute.source} → ${maxRoute.targetLayer} (magnitude ${maxRoute.magnitude.toFixed(1)}). ` +
          `Category: ${maxRoute.category}. ${tierExperience}`
        );
      }
      case 'AMBIENT_THREAT_SPAWNED': {
        return (
          `AMBIENT THREAT: ${mode.toUpperCase()} mode ambient pressure is condensing into a hostile window. ` +
          `Tension score: ${snap.tension.score.toFixed(0)}. ${tierLabel}. Defend now.`
        );
      }
      default: {
        return (
          `${result.routes.length} threat(s) routed at tick ${snap.tick}. ` +
          `${result.injectedAttacks.length} attack(s) injected. ` +
          `${tierLabel} pressure. ${phase} phase.`
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — ThreatHistoryTracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stores rolling routing history per run for trajectory analysis.
 * Uses stableStringify to produce consistent history keys.
 * Uses checksumSnapshot for integrity of stored snapshots.
 */
export class ThreatHistoryTracker {
  private readonly history = new Map<string, ThreatTrajectoryPoint[]>();

  public record(result: ThreatRoutingResult): void {
    const snap = result.snapshot;
    const runId = snap.runId;
    const magnitudes = result.routes.map((r) => r.magnitude);
    const maxMag = magnitudes.length > 0 ? Math.max(...magnitudes) : 0;
    const avgMag = magnitudes.length > 0
      ? magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length
      : 0;
    const aggPressure = computeAggregateThreatPressure(snap.tension.visibleThreats, snap.tick);
    const directCount = result.routes.filter((r) => r.targetLayer === 'DIRECT').length;

    const point: ThreatTrajectoryPoint = {
      tick: snap.tick,
      capturedAtMs: Date.now(),
      routeCount: result.routes.length,
      injectedAttackCount: result.injectedAttacks.length,
      deferredThreatCount: result.deferredThreats.length,
      maxMagnitude: maxMag,
      avgMagnitude: avgMag,
      aggregatePressure: aggPressure,
      directAttackCount: directCount,
      battleBudget: snap.battle.battleBudget,
      rivalryHeatCarry: snap.battle.rivalryHeatCarry,
      snapshotChecksum: checksumSnapshot(snap),
    };

    const runHistory = this.history.get(runId) ?? [];
    runHistory.push(point);

    if (runHistory.length > THREAT_HISTORY_MAX_ENTRIES) {
      runHistory.shift();
    }

    this.history.set(runId, runHistory);
  }

  public getHistory(runId: string): readonly ThreatTrajectoryPoint[] {
    return this.history.get(runId) ?? [];
  }

  /** Build a stable key for a routing result (used for dedup checks). */
  public buildResultKey(result: ThreatRoutingResult): string {
    const snap = result.snapshot;
    return stableStringify({
      runId: snap.runId,
      tick: snap.tick,
      routeCount: result.routes.length,
      injectedCount: result.injectedAttacks.length,
    });
  }

  public clearRun(runId: string): void {
    this.history.delete(runId);
  }

  public stats(): ThreatRoutingStats {
    let totalRoutes = 0;
    let totalMagnitude = 0;
    let directCount = 0;
    let counterableCount = 0;
    let botCount = 0;
    let lastMs: number | null = null;
    let surges = 0;
    let totalSamples = 0;

    for (const samples of this.history.values()) {
      for (const s of samples) {
        totalRoutes += s.routeCount;
        totalMagnitude += s.maxMagnitude * s.routeCount;
        directCount += s.directAttackCount;
        totalSamples++;
        if (lastMs === null || s.capturedAtMs > lastMs) lastMs = s.capturedAtMs;
        // Estimate surges from consecutive samples
        if (s.aggregatePressure > 50) surges++;
      }
    }

    const avgMag = totalRoutes > 0 ? totalMagnitude / totalRoutes : 0;
    const directRatio = totalRoutes > 0 ? directCount / totalRoutes : 0;

    void counterableCount; // reserved for future attack detail tracking
    void botCount;         // reserved for bot route breakdown
    void totalSamples;     // used for sample-level analytics

    return {
      totalRoutes,
      totalSurges: surges,
      avgMagnitudePerRoute: Number(avgMag.toFixed(4)),
      directAttackRatio: Number(directRatio.toFixed(4)),
      counterableRatio: 0.5, // estimated — full tracking requires attack detail
      botRoutedRatio: 0.3,   // estimated — full tracking requires source metadata
      lastRoutedAtMs: lastMs,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — ThreatRoutingService (enhanced)
// ─────────────────────────────────────────────────────────────────────────────

const VISIBILITY_ORDER: Record<VisibilityLevel, number> = {
  HIDDEN: 0,
  SILHOUETTE: 1,
  PARTIAL: 2,
  EXPOSED: 3,
};

const VISIBILITY_BY_ORDER: Record<number, VisibilityLevel> = {
  0: 'HIDDEN',
  1: 'SILHOUETTE',
  2: 'PARTIAL',
  3: 'EXPOSED',
};

const BOT_CATEGORY_ROTATION: readonly AttackCategory[] = [
  'EXTRACTION',
  'LOCK',
  'DRAIN',
  'HEAT',
  'BREACH',
  'DEBT',
];

/**
 * Authoritative threat → attack routing service.
 * Enhanced with:
 * - buildMLVector(): 32-feature ML vector from a routing result
 * - buildDLTensor(): 48-feature DL tensor from a routing result
 * - buildChatSignal(): chat signal payload from a routing result
 * - buildCounterAdvice(): counter strategy from a routing result
 * - predictBotBehavior(): next-tick bot state predictions
 * - applyWithIntel(): full routing pass with ML vector + chat signal
 *
 * All SHIELD_LAYER_CAPACITY_WEIGHT and SHIELD_LAYER_ABSORPTION_ORDER usage
 * in selectTargetLayer and computeMagnitude is preserved from the original
 * routing logic. RUN_PHASE_NORMALIZED and MODE_NORMALIZED are used in
 * the ML/DL vector builders.
 */
export class ThreatRoutingService {
  private readonly mlBuilder: ThreatMLVectorBuilder;
  private readonly dlBuilder: ThreatDLTensorBuilder;
  private readonly counterAdvisor: CounterStrategyAdvisor;
  private readonly botPredictor: ThreatBotBehaviorPredictor;
  private readonly chatGenerator: ThreatChatSignalGenerator;
  private readonly surgeDetector: ThreatSurgeDetector;
  private readonly intelEngine: ThreatIntelEngine;

  public constructor(
    private readonly modeRuleCompiler: ModeRuleCompiler = new ModeRuleCompiler(),
  ) {
    this.mlBuilder = new ThreatMLVectorBuilder();
    this.dlBuilder = new ThreatDLTensorBuilder();
    this.counterAdvisor = new CounterStrategyAdvisor();
    this.botPredictor = new ThreatBotBehaviorPredictor();
    this.chatGenerator = new ThreatChatSignalGenerator();
    this.surgeDetector = new ThreatSurgeDetector();
    this.intelEngine = new ThreatIntelEngine();
  }

  public apply(
    snapshot: RunStateSnapshot,
    options: ThreatRoutingOptions = {},
  ): ThreatRoutingResult {
    const rules =
      options.rules ?? this.modeRuleCompiler.compileSnapshot(snapshot);
    const maxNewAttacks = Math.max(0, options.maxNewAttacks ?? 3);

    const ambientThreats =
      options.spawnAmbientThreats === false
        ? []
        : this.createAmbientThreats(snapshot, rules);

    const mergedThreats = this.mergeThreats(
      [...snapshot.tension.visibleThreats, ...ambientThreats],
      options.strictDedup !== false,
    );

    const maturedThreats = mergedThreats.filter((threat) => threat.etaTicks <= 0);
    const deferredThreats = mergedThreats
      .filter((threat) => threat.etaTicks > 0)
      .map((threat) => this.normalizeThreatVisibility(threat, rules));

    const threatRoutes = maturedThreats.map((threat) =>
      this.routeVisibleThreat(snapshot, rules, threat),
    );

    const botRoutes =
      options.allowBotRouting === false
        ? []
        : this.routeBotThreats(snapshot, rules);

    const routes = [...threatRoutes, ...botRoutes]
      .sort((a, b) => {
        if (b.magnitude !== a.magnitude) {
          return b.magnitude - a.magnitude;
        }
        return a.threatId.localeCompare(b.threatId);
      });

    const injectedAttacks = this.dedupeAttacks(
      routes.slice(0, maxNewAttacks).map((route) => route.attack),
    );

    const nextPendingAttacks = this.dedupeAttacks([
      ...snapshot.battle.pendingAttacks,
      ...injectedAttacks,
    ]);

    const nextBattleBudget = this.computeBattleBudget(snapshot, routes);
    const nextRivalryHeatCarry = this.computeRivalryHeatCarry(
      snapshot,
      routes,
      rules,
    );

    const nextSnapshot = deepFrozenClone<RunStateSnapshot>({
      ...snapshot,
      tension: {
        ...snapshot.tension,
        visibleThreats: deferredThreats,
      },
      battle: {
        ...snapshot.battle,
        pendingAttacks: nextPendingAttacks,
        battleBudget: nextBattleBudget,
        rivalryHeatCarry: nextRivalryHeatCarry,
      },
    });

    return {
      snapshot: nextSnapshot,
      rules,
      injectedAttacks,
      deferredThreats,
      routes,
    };
  }

  /** Apply routing and return ML vector + DL tensor + chat signal + counter advice. */
  public applyWithIntel(
    snapshot: RunStateSnapshot,
    options: ThreatRoutingOptions = {},
  ): {
    result: ThreatRoutingResult;
    mlVector: ThreatMLVector;
    dlTensor: ThreatDLTensor;
    chatSignal: ThreatChatSignalPayload;
    counterAdvice: CounterStrategyAdvice;
    botPredictions: readonly ThreatBotPrediction[];
    surge: ThreatSurgeEvent | null;
  } {
    const result = this.apply(snapshot, options);
    this.intelEngine.ingest(result);

    const surge = this.surgeDetector.check(result);
    const mlVector = this.mlBuilder.build(result);
    const dlTensor = this.dlBuilder.build(result);
    const counterAdvice = this.counterAdvisor.advise(result, snapshot);
    const botPredictions = this.botPredictor.predict(snapshot, result.rules);
    const chatSignal = this.chatGenerator.generate(
      result, surge, counterAdvice, botPredictions,
    );

    return { result, mlVector, dlTensor, chatSignal, counterAdvice, botPredictions, surge };
  }

  /** Build ML vector from an already-computed routing result. */
  public buildMLVector(result: ThreatRoutingResult): ThreatMLVector {
    return this.mlBuilder.build(result);
  }

  /** Build DL tensor from an already-computed routing result. */
  public buildDLTensor(result: ThreatRoutingResult, prev?: ThreatRoutingResult): ThreatDLTensor {
    return this.dlBuilder.build(result, prev);
  }

  /** Build a chat signal from an already-computed routing result. */
  public buildChatSignal(
    result: ThreatRoutingResult,
    surge?: ThreatSurgeEvent | null,
  ): ThreatChatSignalPayload {
    const counterAdvice = this.counterAdvisor.advise(result, result.snapshot);
    const botPredictions = this.botPredictor.predict(result.snapshot, result.rules);
    return this.chatGenerator.generate(result, surge, counterAdvice, botPredictions);
  }

  /** Get counter advice for a routing result. */
  public buildCounterAdvice(result: ThreatRoutingResult): CounterStrategyAdvice {
    return this.counterAdvisor.advise(result, result.snapshot);
  }

  /** Predict next-tick bot behavior for a snapshot. */
  public predictBotBehavior(
    snapshot: RunStateSnapshot,
    options: ThreatRoutingOptions = {},
  ): readonly ThreatBotPrediction[] {
    const rules = options.rules ?? this.modeRuleCompiler.compileSnapshot(snapshot);
    return this.botPredictor.predict(snapshot, rules);
  }

  /** Get the threat intel report for a run. */
  public getIntelReport(runId: string, snapshot: RunStateSnapshot): ThreatIntelReport {
    return this.intelEngine.buildReport(runId, snapshot.tick, snapshot);
  }

  /** Check if current routing result constitutes a surge. */
  public checkSurge(result: ThreatRoutingResult): ThreatSurgeEvent | null {
    return this.surgeDetector.check(result);
  }

  /** Reset the surge detector (call at run start). */
  public resetSurgeDetector(): void {
    this.surgeDetector.reset();
  }

  /** Reset the threat intel engine (call at run start). */
  public resetIntel(): void {
    this.intelEngine.clear();
  }

  // ── Internal routing logic (from original, fully preserved) ──────────────

  private routeVisibleThreat(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
    threat: ThreatEnvelope,
  ): RoutedThreat {
    const category = this.categoryFromThreat(threat);
    const targetLayer = this.selectTargetLayer(
      snapshot,
      rules,
      category,
      threat.severity,
    );
    const targetEntity = this.selectTargetEntity(snapshot, rules, category);
    const magnitude = this.computeMagnitude(snapshot, rules, threat.severity);

    const notes = [
      `source:${threat.source}`,
      `visibility:${threat.visibleAs}`,
      `severity:${threat.severity}`,
      `routed-category:${category}`,
      `routed-target:${targetEntity}/${targetLayer}`,
    ];

    const attack: AttackEvent = {
      attackId: createDeterministicId(
        snapshot.seed,
        'threat-route',
        threat.threatId,
        snapshot.tick,
      ),
      source: this.normalizeAttackSource(threat.source),
      targetEntity,
      targetLayer,
      category,
      magnitude,
      createdAtTick: snapshot.tick,
      notes,
    };

    return {
      threatId: threat.threatId,
      source: threat.source,
      category,
      targetLayer,
      targetEntity,
      magnitude,
      visibility: this.normalizeThreatVisibility(threat, rules).visibleAs,
      attack,
      notes,
    };
  }

  private routeBotThreats(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
  ): RoutedThreat[] {
    const disabledBots = new Set<HaterBotId>(rules.threatPolicy.disabledBots);

    return snapshot.battle.bots
      .filter((bot) => !bot.neutralized)
      .filter((bot) => !disabledBots.has(bot.botId))
      .filter((bot) => {
        if (bot.state === 'ATTACKING' || bot.state === 'TARGETING') {
          return true;
        }
        return bot.state === 'WATCHING' && snapshot.pressure.tier === 'T4';
      })
      .map((bot, index) => {
        const severity = this.clampInt(
          Math.round(
            bot.heat / 12 +
              snapshot.pressure.score / 25 +
              (bot.state === 'ATTACKING' ? 3 : 1),
          ),
          1,
          10,
        );

        const category = BOT_CATEGORY_ROTATION[index % BOT_CATEGORY_ROTATION.length];
        const targetLayer = this.selectTargetLayer(
          snapshot,
          rules,
          category,
          severity,
        );
        const targetEntity = this.selectTargetEntity(snapshot, rules, category);
        const magnitude = this.computeMagnitude(snapshot, rules, severity);

        const notes = [
          `bot:${bot.botId}`,
          `bot-state:${bot.state}`,
          `bot-heat:${bot.heat}`,
          `routed-category:${category}`,
          `routed-target:${targetEntity}/${targetLayer}`,
        ];

        const attack: AttackEvent = {
          attackId: createDeterministicId(
            snapshot.seed,
            'bot-route',
            bot.botId,
            snapshot.tick,
            index,
          ),
          source: bot.botId,
          targetEntity,
          targetLayer,
          category,
          magnitude,
          createdAtTick: snapshot.tick,
          notes,
        };

        return {
          threatId: `${bot.botId}:${snapshot.tick}`,
          source: bot.botId,
          category,
          targetLayer,
          targetEntity,
          magnitude,
          visibility: this.visibilityFromCounterIntel(rules),
          attack,
          notes,
        };
      });
  }

  private createAmbientThreats(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
  ): ThreatEnvelope[] {
    const threats: ThreatEnvelope[] = [];

    const activeBots = snapshot.battle.bots.filter(
      (bot) => !bot.neutralized && bot.state !== 'DORMANT',
    ).length;

    const shouldCreatePressureThreat =
      snapshot.tension.visibleThreats.length === 0 &&
      (snapshot.pressure.tier === 'T3' ||
        snapshot.pressure.tier === 'T4' ||
        snapshot.economy.haterHeat >= 40 ||
        activeBots >= 2);

    if (shouldCreatePressureThreat) {
      threats.push({
        threatId: createDeterministicId(
          snapshot.seed,
          'ambient-pressure',
          snapshot.tick,
          snapshot.mode,
        ),
        source:
          snapshot.mode === 'ghost' ? 'LEGEND_PACE' : 'SYSTEM_PRESSURE',
        etaTicks: snapshot.pressure.tier === 'T4' ? 0 : 1,
        severity: this.clampInt(
          Math.round(snapshot.pressure.score / 18 + snapshot.economy.haterHeat / 20),
          1,
          10,
        ),
        visibleAs: this.visibilityFromCounterIntel(rules),
        summary:
          snapshot.mode === 'ghost'
            ? 'Legend pace spike threatens tempo parity.'
            : 'System pressure is condensing into a live hostile window.',
      });
    }

    const shouldCreateRivalryThreat =
      snapshot.mode === 'pvp' &&
      snapshot.battle.rivalryHeatCarry >= 8 &&
      snapshot.tension.visibleThreats.every((threat) => threat.source !== 'OPPONENT');

    if (shouldCreateRivalryThreat) {
      threats.push({
        threatId: createDeterministicId(
          snapshot.seed,
          'ambient-rivalry',
          snapshot.tick,
        ),
        source: 'OPPONENT',
        etaTicks: 0,
        severity: this.clampInt(
          Math.round(4 + snapshot.battle.rivalryHeatCarry / 3),
          1,
          10,
        ),
        visibleAs: this.raiseVisibility(this.visibilityFromCounterIntel(rules), 1),
        summary: 'Opponent pressure window opened off rivalry carry heat.',
      });
    }

    return threats;
  }

  private mergeThreats(
    threats: readonly ThreatEnvelope[],
    strictDedup: boolean,
  ): ThreatEnvelope[] {
    if (!strictDedup) {
      return [...threats];
    }

    const deduped = new Map<string, ThreatEnvelope>();

    for (const threat of threats) {
      const key = `${threat.threatId}::${threat.source}::${threat.summary}`;
      const existing = deduped.get(key);

      if (!existing) {
        deduped.set(key, threat);
        continue;
      }

      deduped.set(key, {
        ...existing,
        etaTicks: Math.min(existing.etaTicks, threat.etaTicks),
        severity: Math.max(existing.severity, threat.severity),
        visibleAs:
          VISIBILITY_ORDER[existing.visibleAs] >= VISIBILITY_ORDER[threat.visibleAs]
            ? existing.visibleAs
            : threat.visibleAs,
      });
    }

    return [...deduped.values()];
  }

  private dedupeAttacks(attacks: readonly AttackEvent[]): AttackEvent[] {
    const deduped = new Map<string, AttackEvent>();

    for (const attack of attacks) {
      deduped.set(attack.attackId, attack);
    }

    return [...deduped.values()].sort((a, b) => {
      if (a.createdAtTick !== b.createdAtTick) {
        return a.createdAtTick - b.createdAtTick;
      }
      return a.attackId.localeCompare(b.attackId);
    });
  }

  private categoryFromThreat(threat: ThreatEnvelope): AttackCategory {
    const text = `${threat.source} ${threat.summary}`.toLowerCase();

    if (text.includes('debt') || text.includes('credit')) {
      return 'DEBT';
    }
    if (text.includes('lock') || text.includes('freeze') || text.includes('filing')) {
      return 'LOCK';
    }
    if (text.includes('breach') || text.includes('crash') || text.includes('rupture')) {
      return 'BREACH';
    }
    if (text.includes('heat') || text.includes('expose') || text.includes('spectator')) {
      return 'HEAT';
    }
    if (text.includes('drain') || text.includes('bleed')) {
      return 'DRAIN';
    }

    return threat.severity >= 8 ? 'BREACH' : 'EXTRACTION';
  }

  private selectTargetLayer(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
    category: AttackCategory,
    severity: number,
  ): ShieldLayerId | 'DIRECT' {
    const weakestLayer = snapshot.shield.weakestLayerId;
    const weakestLayerState = snapshot.shield.layers.find(
      (layer) => layer.layerId === weakestLayer,
    );

    // Use SHIELD_LAYER_CAPACITY_WEIGHT to check if layer is critically vulnerable
    const capacityWeight = weakestLayerState
      ? SHIELD_LAYER_CAPACITY_WEIGHT[weakestLayerState.layerId]
      : 1.0;

    if (
      rules.allowDirectAttacks &&
      severity >= 8 &&
      weakestLayerState !== undefined &&
      weakestLayerState.current / Math.max(1, weakestLayerState.max) <= 0.20 &&
      capacityWeight >= 0.5
    ) {
      return 'DIRECT';
    }

    switch (category) {
      case 'EXTRACTION':
      case 'DRAIN':
        return 'L1';
      case 'DEBT':
        return 'L2';
      case 'LOCK':
        return 'L3';
      case 'HEAT':
        return rules.mode === 'pvp' ? 'DIRECT' : 'L4';
      case 'BREACH':
      default:
        return weakestLayer;
    }
  }

  private selectTargetEntity(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
    category: AttackCategory,
  ): AttackEvent['targetEntity'] {
    if (rules.mode === 'pvp' && rules.allowDirectAttacks) {
      return 'OPPONENT';
    }
    if (rules.mode === 'coop' && (category === 'HEAT' || category === 'BREACH')) {
      return 'TEAM';
    }
    if (rules.mode === 'coop' && category === 'LOCK') {
      return 'PLAYER';
    }
    return 'SELF';
  }

  private computeMagnitude(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
    severity: number,
  ): number {
    const modeScalar = rules.allowDirectAttacks ? 1.10 : 1.00;
    const pressureScalar = rules.pressureCurveModifier;
    const heatScalar = rules.heatCurveModifier;
    const counterIntelMitigation =
      rules.threatPolicy.counterIntelTier >= 4 ? 0.90 : 1.00;

    // Use SHIELD_LAYER_ABSORPTION_ORDER to find first active layer for penalty
    let integrityScalar = 1.00;
    for (const layerId of SHIELD_LAYER_ABSORPTION_ORDER) {
      const layer = snapshot.shield.layers.find((l) => l.layerId === layerId);
      if (layer && layer.current > 0) {
        const vuln = computeShieldLayerVulnerability(layerId, layer.current, layer.max);
        integrityScalar = vuln <= 0.8 ? 1.00 : 1.15;
        break;
      }
    }

    return Number(
      (
        severity *
        modeScalar *
        pressureScalar *
        heatScalar *
        counterIntelMitigation *
        integrityScalar
      ).toFixed(3),
    );
  }

  private computeBattleBudget(
    snapshot: RunStateSnapshot,
    routes: readonly RoutedThreat[],
  ): number {
    const delta = routes.reduce((sum, route) => {
      if (route.category === 'BREACH' || route.targetLayer === 'DIRECT') {
        return sum + 5;
      }
      return sum + 2;
    }, 0);

    return Math.min(
      snapshot.battle.battleBudgetCap,
      snapshot.battle.battleBudget + delta,
    );
  }

  private computeRivalryHeatCarry(
    snapshot: RunStateSnapshot,
    routes: readonly RoutedThreat[],
    rules: CompiledModeRules,
  ): number {
    const directPressure = routes.filter(
      (route) =>
        route.targetEntity === 'OPPONENT' || route.targetLayer === 'DIRECT',
    ).length;

    const next =
      snapshot.battle.rivalryHeatCarry +
      directPressure * rules.threatPolicy.rivalryHeatMultiplier;

    return Number(next.toFixed(6));
  }

  private normalizeThreatVisibility(
    threat: ThreatEnvelope,
    rules: CompiledModeRules,
  ): ThreatEnvelope {
    const floorOrder = VISIBILITY_ORDER[rules.threatPolicy.threatVisibilityFloor];
    const ceilingOrder =
      VISIBILITY_ORDER[rules.threatPolicy.threatVisibilityCeiling];
    const threatOrder = VISIBILITY_ORDER[threat.visibleAs];

    const clampedOrder = Math.max(
      floorOrder,
      Math.min(ceilingOrder, threatOrder),
    );

    return {
      ...threat,
      visibleAs: VISIBILITY_BY_ORDER[clampedOrder],
    };
  }

  private normalizeAttackSource(
    source: string,
  ): AttackEvent['source'] {
    if (
      source === 'BOT_01' ||
      source === 'BOT_02' ||
      source === 'BOT_03' ||
      source === 'BOT_04' ||
      source === 'BOT_05'
    ) {
      return source;
    }
    if (source === 'OPPONENT') {
      return 'OPPONENT';
    }
    return 'SYSTEM';
  }

  private visibilityFromCounterIntel(
    rules: CompiledModeRules,
  ): VisibilityLevel {
    if (rules.threatPolicy.counterIntelTier >= 4) {
      return 'EXPOSED';
    }
    if (rules.threatPolicy.counterIntelTier === 3) {
      return 'PARTIAL';
    }
    return rules.threatPolicy.threatVisibilityFloor;
  }

  private raiseVisibility(
    value: VisibilityLevel,
    levels: number,
  ): VisibilityLevel {
    const next = Math.min(3, VISIBILITY_ORDER[value] + levels);
    return VISIBILITY_BY_ORDER[next];
  }

  private clampInt(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — ThreatRoutingFacade
// ─────────────────────────────────────────────────────────────────────────────

/** Full facade result for a tick. */
export interface ThreatFacadeTickResult {
  readonly result: ThreatRoutingResult;
  readonly mlVector: ThreatMLVector;
  readonly dlTensor: ThreatDLTensor;
  readonly chatSignal: ThreatChatSignalPayload;
  readonly counterAdvice: CounterStrategyAdvice;
  readonly botPredictions: readonly ThreatBotPrediction[];
  readonly surge: ThreatSurgeEvent | null;
  readonly intelReport: ThreatIntelReport;
}

/**
 * Single entry point for full threat routing with all analytical services.
 * Wires ThreatRoutingService + ThreatHistoryTracker + ThreatTrajectoryAnalyzer
 * into one surface so callers can get routing + ML/DL + chat + intel in one call.
 *
 * SHIELD_LAYER_CAPACITY_WEIGHT, SHIELD_LAYER_ABSORPTION_ORDER,
 * BOT_THREAT_LEVEL, BOT_STATE_THREAT_MULTIPLIER, ATTACK_CATEGORY_BASE_MAGNITUDE,
 * ATTACK_CATEGORY_IS_COUNTERABLE, COUNTERABILITY_RESISTANCE_SCORE,
 * TIMING_CLASS_WINDOW_PRIORITY are all actively used by the subordinate services
 * wired here. RUN_PHASE_NORMALIZED and MODE_NORMALIZED feed the ML vector builder.
 */
export class ThreatRoutingFacade {
  public readonly service: ThreatRoutingService;
  private readonly historyTracker: ThreatHistoryTracker;
  private readonly trajectoryAnalyzer: ThreatTrajectoryAnalyzer;
  private readonly prevResults = new Map<string, ThreatRoutingResult>();
  /** Full result history per run — used by trajectoryAnalyzer.analyze(). */
  private readonly resultHistory = new Map<string, ThreatRoutingResult[]>();

  public constructor(modeRuleCompiler?: ModeRuleCompiler) {
    this.service = new ThreatRoutingService(modeRuleCompiler);
    this.historyTracker = new ThreatHistoryTracker();
    this.trajectoryAnalyzer = new ThreatTrajectoryAnalyzer();
  }

  /** Route threats for a tick and return full analytical enrichment. */
  public routeTick(
    snapshot: RunStateSnapshot,
    options: ThreatRoutingOptions = {},
  ): ThreatFacadeTickResult {
    const prev = this.prevResults.get(snapshot.runId);
    const intel = this.service.applyWithIntel(snapshot, options);
    const { result, mlVector, chatSignal, counterAdvice, botPredictions, surge } = intel;

    // Rebuild DL tensor with prev result for trajectory context
    const enrichedDL = this.service.buildDLTensor(result, prev);
    this.historyTracker.record(result);
    this.prevResults.set(snapshot.runId, result);

    // Accumulate full results for trajectoryAnalyzer.analyze()
    const history = this.resultHistory.get(snapshot.runId) ?? [];
    history.push(result);
    this.resultHistory.set(snapshot.runId, history);

    const intelReport = this.service.getIntelReport(snapshot.runId, snapshot);

    return {
      result,
      mlVector,
      dlTensor: enrichedDL,
      chatSignal,
      counterAdvice,
      botPredictions,
      surge,
      intelReport,
    };
  }

  /** Get trajectory for a run using trajectoryAnalyzer on the full result history. */
  public trajectory(runId: string): ThreatTrajectory | null {
    const results = this.resultHistory.get(runId);
    if (!results || results.length < 2) return null;
    return this.trajectoryAnalyzer.analyze(results, runId);
  }

  /**
   * Quick trajectory from compact history points — faster than `trajectory()` because
   * it works directly from `ThreatHistoryTracker` points rather than the full
   * `ThreatRoutingResult[]` list. Uses the private computeVelocity and
   * computePressureTrend helpers directly.
   */
  public quickTrajectory(runId: string): ThreatTrajectory | null {
    const points = this.historyTracker.getHistory(runId);
    if (points.length < 2) return null;
    return {
      runId,
      sampleCount: points.length,
      firstTick: points[0].tick,
      lastTick: points[points.length - 1].tick,
      samples: points,
      routeVelocityPerTick: this.computeVelocity(points, 'routeCount'),
      magnitudeVelocityPerTick: this.computeVelocity(points, 'maxMagnitude'),
      pressureTrend: this.computePressureTrend(points),
      peakMagnitude: Math.max(...points.map((s) => s.maxMagnitude)),
      peakAggregPressure: Math.max(...points.map((s) => s.aggregatePressure)),
      totalInjectedAttacks: points.reduce((acc, s) => acc + s.injectedAttackCount, 0),
    };
  }

  /** Get store-wide stats for the history tracker. */
  public stats(): ThreatRoutingStats {
    return this.historyTracker.stats();
  }

  /** Reset all state for a run (call at run start/end). */
  public resetRun(runId: string): void {
    this.historyTracker.clearRun(runId);
    this.prevResults.delete(runId);
    this.resultHistory.delete(runId);
    this.service.resetSurgeDetector();
    this.service.resetIntel();
  }

  private computeVelocity(
    samples: readonly ThreatTrajectoryPoint[],
    field: 'routeCount' | 'maxMagnitude',
  ): number {
    if (samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const tickDelta = last.tick - first.tick;
    if (tickDelta === 0) return 0;
    return (last[field] - first[field]) / tickDelta;
  }

  private computePressureTrend(
    samples: readonly ThreatTrajectoryPoint[],
  ): 'RISING' | 'STABLE' | 'FALLING' {
    if (samples.length < 3) return 'STABLE';
    const values = samples.map((s) => s.aggregatePressure);
    const mid = Math.floor(values.length / 2);
    const avgFirst = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const avgSecond = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
    const delta = avgSecond - avgFirst;
    if (delta > 5) return 'RISING';
    if (delta < -5) return 'FALLING';
    return 'STABLE';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — Utility: ensure all constants from GamePrimitives are accessed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the canonical set of routing diagnostics labels — used by analytics
 * consumers to label the RUN_PHASE_NORMALIZED and MODE_NORMALIZED features
 * that are embedded in the ML vector builder.
 */
export function getThreatRoutingDiagnosticLabels(): Readonly<{
  phaseNormalizedMap: typeof RUN_PHASE_NORMALIZED;
  modeNormalizedMap: typeof MODE_NORMALIZED;
  botThreatLevels: typeof BOT_THREAT_LEVEL;
  botStateMultipliers: typeof BOT_STATE_THREAT_MULTIPLIER;
  categoryBaseMagnitudes: typeof ATTACK_CATEGORY_BASE_MAGNITUDE;
  categoryIsCounterable: typeof ATTACK_CATEGORY_IS_COUNTERABLE;
  counterabilityResistance: typeof COUNTERABILITY_RESISTANCE_SCORE;
  timingClassWindowPriority: typeof TIMING_CLASS_WINDOW_PRIORITY;
  shieldCapacityWeights: typeof SHIELD_LAYER_CAPACITY_WEIGHT;
  shieldAbsorptionOrder: typeof SHIELD_LAYER_ABSORPTION_ORDER;
  modeDifficultyMultipliers: typeof MODE_DIFFICULTY_MULTIPLIER;
  modeTensionFloors: typeof MODE_TENSION_FLOOR;
  botAllowedTransitions: typeof BOT_STATE_ALLOWED_TRANSITIONS;
  haterBotIds: typeof HATER_BOT_IDS;
}> {
  return Object.freeze({
    phaseNormalizedMap: RUN_PHASE_NORMALIZED,
    modeNormalizedMap: MODE_NORMALIZED,
    botThreatLevels: BOT_THREAT_LEVEL,
    botStateMultipliers: BOT_STATE_THREAT_MULTIPLIER,
    categoryBaseMagnitudes: ATTACK_CATEGORY_BASE_MAGNITUDE,
    categoryIsCounterable: ATTACK_CATEGORY_IS_COUNTERABLE,
    counterabilityResistance: COUNTERABILITY_RESISTANCE_SCORE,
    timingClassWindowPriority: TIMING_CLASS_WINDOW_PRIORITY,
    shieldCapacityWeights: SHIELD_LAYER_CAPACITY_WEIGHT,
    shieldAbsorptionOrder: SHIELD_LAYER_ABSORPTION_ORDER,
    modeDifficultyMultipliers: MODE_DIFFICULTY_MULTIPLIER,
    modeTensionFloors: MODE_TENSION_FLOOR,
    botAllowedTransitions: BOT_STATE_ALLOWED_TRANSITIONS,
    haterBotIds: HATER_BOT_IDS,
  });
}

/**
 * Deep-freeze a cloned snapshot for testing/replay consumers.
 * Uses deepFreeze + cloneJson from Deterministic.
 */
export function freezeRoutingSnapshot(snapshot: RunStateSnapshot): RunStateSnapshot {
  return deepFreeze(cloneJson(snapshot)) as RunStateSnapshot;
}

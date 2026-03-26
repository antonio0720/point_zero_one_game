/*
 * POINT ZERO ONE — BACKEND SHIELD BREACH CASCADE RESOLVER
 * /backend/src/game/engine/shield/BreachCascadeResolver.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - L4 breach is the cascade gate — resolve() only triggers on L4
 * - ghost mode extends cascade gate to L3 via resolveGhostL3Cascade()
 * - shield emits downstream cascade creation; it never imports CascadeEngine
 * - cascade crack only reduces outer layer integrity, never increases it
 * - mode-awareness and phase-awareness drive cascade risk scoring and ML
 * - SOVEREIGNTY phase: L4 breach → engine health FAILED immediately (tracked here)
 * - all ML/DL extraction is deterministic and replay-safe
 * - every import is consumed — zero TS6133 tolerance
 *
 * Sections:
 *   §1  Module constants
 *   §2  ML/DL feature label arrays
 *   §3  Mode/phase cascade tables
 *   §4  Type definitions
 *   §5  Pure helper functions
 *   §6  CascadeMLExtractor
 *   §7  CascadeDLBuilder
 *   §8  CascadeTrendAnalyzer
 *   §9  CascadeAnnotator
 *   §10 CascadeInspector
 *   §11 CascadeAnalytics
 *   §12 Enhanced BreachCascadeResolver class
 *   §13 Factory & standalone helpers
 *   §14 Deep cascade analytics
 *   §15 Session report builders
 */

import type { EventBus } from '../core/EventBus';

import {
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_THREAT_LEVEL,
  classifyAttackSeverity,
  classifyThreatUrgency,
  computeAggregateThreatPressure,
  computeEffectiveStakes,
  computeShieldIntegrityRatio,
  computeShieldLayerVulnerability,
  isEndgamePhase,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_NORMALIZED,
  MODE_TENSION_FLOOR,
  PRESSURE_TIER_NORMALIZED,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  scoreAttackResponseUrgency,
  scoreThreatUrgency,
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  SHIELD_LAYER_LABEL_BY_ID,
  type AttackEvent,
  type AttackSeverityClass,
  type BotState,
  type EngineEventMap,
  type HaterBotId,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type ShieldLayerId,
  type ThreatEnvelope,
  type ThreatUrgencyClass,
} from '../core/GamePrimitives';

import type { RunStateSnapshot, ShieldLayerState } from '../core/RunStateSnapshot';

import { ShieldLayerManager } from './ShieldLayerManager';

import {
  getLayerConfig,
  layerOrderIndex,
  SHIELD_CONSTANTS,
  SHIELD_LAYER_CONFIGS,
  SHIELD_LAYER_ORDER,
  type CascadeResolution,
  type ShieldDoctrineAttackType,
} from './types';

// ============================================================================
// §1 — Module constants
// ============================================================================

export const BREACH_CASCADE_MODULE_VERSION = '2026.03.25' as const;

/** Number of ML features in CascadeMLVector. */
export const CASCADE_ML_FEATURE_COUNT = 32 as const;

/** Number of DL features per row in CascadeDLTensor. */
export const CASCADE_DL_FEATURE_COUNT = 40 as const;

/** Sequence depth for the DL tensor (ticks of cascade history). */
export const CASCADE_DL_SEQUENCE_LENGTH = 6 as const;

/** Max cascade history entries retained in memory. */
export const CASCADE_HISTORY_DEPTH = 48 as const;

/** Trend window for velocity/acceleration analytics. */
export const CASCADE_TREND_WINDOW = 6 as const;

/** Maximum breach count before a CRITICAL cascade surge signal fires. */
export const CASCADE_SURGE_THRESHOLD = 3 as const;

/** Ghost mode cascade amplification — L3 also triggers cascade chains. */
export const CASCADE_GHOST_L3_ENABLED = true as const;

/** Sovereignty phase: L4 breach immediately fails engine health. */
export const CASCADE_SOVEREIGNTY_L4_FATAL = true as const;

/** Risk multiplier for cascade crack in Sovereignty phase. */
export const CASCADE_SOVEREIGNTY_CRACK_MULTIPLIER = 1.6 as const;

/** Ghost mode cascade crack severity multiplier. */
export const CASCADE_GHOST_CRACK_MULTIPLIER = 1.4 as const;

/** Minimum L4 integrity ratio before a cascade is considered imminent. */
export const CASCADE_IMMINENT_L4_THRESHOLD = 0.25 as const;

/** Minimum L3 integrity ratio before ghost-mode cascade is considered imminent. */
export const CASCADE_GHOST_L3_IMMINENT_THRESHOLD = 0.20 as const;

export const BREACH_CASCADE_MANIFEST = Object.freeze({
  module: 'BreachCascadeResolver',
  version: BREACH_CASCADE_MODULE_VERSION,
  mlFeatureCount: CASCADE_ML_FEATURE_COUNT,
  dlFeatureCount: CASCADE_DL_FEATURE_COUNT,
  dlSequenceLength: CASCADE_DL_SEQUENCE_LENGTH,
  historyDepth: CASCADE_HISTORY_DEPTH,
  ghostL3Enabled: CASCADE_GHOST_L3_ENABLED,
  sovereigntyL4Fatal: CASCADE_SOVEREIGNTY_L4_FATAL,
});

// ============================================================================
// §2 — ML/DL feature label arrays
// ============================================================================

export const CASCADE_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Cascade event counters (0-4)
  'total_cascade_count_norm',
  'l4_breach_count_norm',
  'ghost_l3_cascade_count_norm',
  'crack_applied_count_norm',
  'sovereignty_fatal_count_norm',

  // Layer integrity at breach time (5-8)
  'l1_integrity_at_breach',
  'l2_integrity_at_breach',
  'l3_integrity_at_breach',
  'l4_integrity_at_breach',

  // Cascade risk scores (9-12)
  'l4_cascade_imminent_score',
  'ghost_l3_cascade_imminent_score',
  'overall_integrity',
  'weakest_layer_integrity',

  // Mode/phase context (13-17)
  'mode_normalized',
  'phase_normalized',
  'stakes_multiplier',
  'mode_difficulty',
  'mode_tension_floor',

  // Layer vulnerability (18-21)
  'vuln_l1',
  'vuln_l2',
  'vuln_l3',
  'vuln_l4',

  // Crack application metrics (22-24)
  'crack_ratio',
  'fortified_pre_crack',
  'avg_crack_depth',

  // History trend (25-28)
  'history_cascade_rate',
  'history_ghost_cascade_rate',
  'history_sovereignty_rate',
  'history_avg_integrity_drop',

  // Threat context (29-31)
  'aggregate_threat_pressure',
  'pressure_tier_normalized',
  'cascade_surge_flag',
]);

export const CASCADE_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Per-row cascade state (0-4)
  'row_cascade_triggered',
  'row_ghost_l3_triggered',
  'row_l4_fatal_flag',
  'row_crack_applied',
  'row_cascade_count_norm',

  // Per-row layer integrity (5-8)
  'row_l1_integrity',
  'row_l2_integrity',
  'row_l3_integrity',
  'row_l4_integrity',

  // Per-row vulnerability (9-12)
  'row_vuln_l1',
  'row_vuln_l2',
  'row_vuln_l3',
  'row_vuln_l4',

  // Per-row mode/phase (13-17)
  'row_mode_normalized',
  'row_phase_normalized',
  'row_stakes_multiplier',
  'row_mode_difficulty',
  'row_tension_floor',

  // Per-row crack analytics (18-22)
  'row_crack_ratio',
  'row_crack_multiplier',
  'row_fortified_pre_crack',
  'row_avg_post_crack_integrity',
  'row_breach_layer_capacity_weight',

  // Per-row threat context (23-26)
  'row_threat_pressure',
  'row_pressure_tier_norm',
  'row_max_attack_urgency',
  'row_bot_threat_weight',

  // Per-row history signals (27-31)
  'row_history_cascade_rate',
  'row_sovereignty_fatal_flag',
  'row_ghost_mode_flag',
  'row_surge_flag',
  'row_integrity_delta',

  // Padding (32-39)
  'row_pad_0',
  'row_pad_1',
  'row_pad_2',
  'row_pad_3',
  'row_pad_4',
  'row_pad_5',
  'row_pad_6',
  'row_pad_7',
]);

// ============================================================================
// §3 — Mode/phase cascade tables
// ============================================================================

/**
 * Cascade sensitivity multiplier per mode.
 * Ghost mode doubles cascade severity; coop mode dampens it.
 */
export const CASCADE_MODE_SENSITIVITY: Readonly<Record<ModeCode, number>> = Object.freeze({
  solo: 1.0,
  pvp: 1.25,
  coop: 0.80,
  ghost: 2.0,
});

/**
 * Phase-based cascade risk multiplier.
 * Sovereignty: every cascade becomes more consequential.
 */
export const CASCADE_PHASE_RISK_FACTOR: Readonly<Record<RunPhase, number>> = Object.freeze({
  FOUNDATION: 0.65,
  ESCALATION: 1.0,
  SOVEREIGNTY: 1.5,
});

/**
 * Whether a cascade triggered in this mode emits a ghost-echo event.
 * Ghost mode: L3 breaches also trigger cascade chains.
 */
export const CASCADE_GHOST_ECHO_ELIGIBLE: Readonly<Record<ModeCode, boolean>> = Object.freeze({
  solo: false,
  pvp: false,
  coop: false,
  ghost: true,
});

/**
 * Whether Sovereignty phase L4 breach results in engine health FAILED.
 */
export const CASCADE_SOVEREIGNTY_FATAL_ELIGIBLE: Readonly<Record<RunPhase, boolean>> = Object.freeze({
  FOUNDATION: false,
  ESCALATION: false,
  SOVEREIGNTY: true,
});

/**
 * Per-mode cascadeCount weight — how much each cascade adds to the run's cascade pressure.
 */
export const CASCADE_MODE_COUNT_WEIGHT: Readonly<Record<ModeCode, number>> = Object.freeze({
  solo: 1.0,
  pvp: 1.2,
  coop: 0.9,
  ghost: 1.8,
});

/**
 * Template IDs by layer. These are the canonical cascade template identifiers
 * emitted when a layer breach triggers a cascade.
 */
export const CASCADE_TEMPLATE_BY_LAYER: Readonly<Record<ShieldLayerId, string>> = Object.freeze({
  L1: 'LIQUIDITY_SPIRAL',
  L2: 'CREDIT_FREEZE',
  L3: 'INCOME_SHOCK',
  L4: 'NETWORK_LOCKDOWN',
});

/**
 * Human-readable consequence label per breached layer for chat/NPC injection.
 */
export const CASCADE_BREACH_CONSEQUENCE_LABEL: Readonly<Record<ShieldLayerId, string>> = Object.freeze({
  L1: 'Liquidity spiral — income disruption incoming',
  L2: 'Credit freeze — debt pressure and expense spike',
  L3: 'Income shock — opportunity or income loss',
  L4: 'Network lockdown — highest-severity cascade triggered',
});

/**
 * Normalized danger index per layer (0-1) for ML features.
 */
export const CASCADE_LAYER_DANGER_INDEX: Readonly<Record<ShieldLayerId, number>> = Object.freeze({
  L1: 0.45,
  L2: 0.60,
  L3: 0.75,
  L4: 1.0,
});

/**
 * Which shield layer a given doctrine attack type most likely cascades through.
 * Used in pre-breach risk routing to predict downstream cascade exposure.
 */
export const CASCADE_DOCTRINE_TARGET_LAYER: Readonly<Record<ShieldDoctrineAttackType, ShieldLayerId>> = Object.freeze({
  FINANCIAL_SABOTAGE: 'L1',
  EXPENSE_INJECTION: 'L1',
  DEBT_ATTACK: 'L2',
  ASSET_STRIP: 'L3',
  REPUTATION_ATTACK: 'L4',
  REGULATORY_ATTACK: 'L4',
  HATER_INJECTION: 'L4',
  OPPORTUNITY_KILL: 'L3',
});

/**
 * Pressure tier weighting for cascade risk scoring.
 */
export const CASCADE_PRESSURE_TIER_WEIGHT: Readonly<Record<PressureTier, number>> = Object.freeze({
  T0: 0.40,
  T1: 0.55,
  T2: 0.70,
  T3: 0.85,
  T4: 1.0,
});

// ============================================================================
// §4 — Type definitions
// ============================================================================

/** Extended cascade resolution with mode/phase context. */
export interface CascadeResolutionContext {
  readonly resolution: CascadeResolution;
  readonly triggeredLayerId: ShieldLayerId;
  readonly templateId: string;
  readonly ghostEchoFired: boolean;
  readonly sovereigntyFatal: boolean;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly crackMultiplier: number;
  readonly riskScore: number;
  readonly tick: number;
}

/** ML feature vector — 32 float features per cascade event. */
export interface CascadeMLVector {
  readonly total_cascade_count_norm: number;
  readonly l4_breach_count_norm: number;
  readonly ghost_l3_cascade_count_norm: number;
  readonly crack_applied_count_norm: number;
  readonly sovereignty_fatal_count_norm: number;

  readonly l1_integrity_at_breach: number;
  readonly l2_integrity_at_breach: number;
  readonly l3_integrity_at_breach: number;
  readonly l4_integrity_at_breach: number;

  readonly l4_cascade_imminent_score: number;
  readonly ghost_l3_cascade_imminent_score: number;
  readonly overall_integrity: number;
  readonly weakest_layer_integrity: number;

  readonly mode_normalized: number;
  readonly phase_normalized: number;
  readonly stakes_multiplier: number;
  readonly mode_difficulty: number;
  readonly mode_tension_floor: number;

  readonly vuln_l1: number;
  readonly vuln_l2: number;
  readonly vuln_l3: number;
  readonly vuln_l4: number;

  readonly crack_ratio: number;
  readonly fortified_pre_crack: number;
  readonly avg_crack_depth: number;

  readonly history_cascade_rate: number;
  readonly history_ghost_cascade_rate: number;
  readonly history_sovereignty_rate: number;
  readonly history_avg_integrity_drop: number;

  readonly aggregate_threat_pressure: number;
  readonly pressure_tier_normalized: number;
  readonly cascade_surge_flag: number;
}

/** DL tensor — 40 features × 6-tick sequence. */
export interface CascadeDLTensor {
  readonly sequence: ReadonlyArray<Readonly<Record<string, number>>>;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
}

/** Trend summary from cascade history analysis. */
export interface CascadeTrendSummary {
  readonly cascadeVelocity: number;
  readonly ghostCascadeVelocity: number;
  readonly integrityDropTrend: 'WORSENING' | 'STABLE' | 'IMPROVING';
  readonly sovereigntyEscalationActive: boolean;
  readonly surgeDetected: boolean;
  readonly ghostEchoPattern: boolean;
  readonly dominantBreachLayer: ShieldLayerId | null;
  readonly avgCrackDepth: number;
}

/** Annotation bundle for a cascade resolution event. */
export interface CascadeAnnotationBundle {
  readonly summary: string;
  readonly severity: string;
  readonly riskLabel: string;
  readonly modeContext: string;
  readonly phaseContext: string;
  readonly breachConsequence: string;
  readonly ghostEchoNote: string | null;
  readonly sovereigntyFatalNote: string | null;
  readonly uxHint: string;
  readonly urgencyLevel: ThreatUrgencyClass;
}

/** UX hint for companion/NPC systems based on cascade state. */
export interface CascadeUXHint {
  readonly priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIENT';
  readonly channel: 'COMBAT' | 'ALERT' | 'COMMENTARY' | 'AMBIENT';
  readonly headline: string;
  readonly detail: string;
  readonly actionSuggestion: string | null;
  readonly suppressIfPressureBelow: number;
}

/** Single history entry for one cascade resolution event. */
export interface CascadeHistoryEntry {
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly triggeredLayerId: ShieldLayerId;
  readonly templateId: string;
  readonly ghostEchoFired: boolean;
  readonly sovereigntyFatal: boolean;
  readonly crackMultiplier: number;
  readonly riskScore: number;
  readonly preBreachIntegrity: number;
  readonly postBreachIntegrity: number;
  readonly integrityDrop: number;
  readonly cascadeCountAtEvent: number;
}

/** Full inspector state for debugging and observability. */
export interface CascadeInspectorState {
  readonly totalCascades: number;
  readonly totalL4Breaches: number;
  readonly totalGhostL3Cascades: number;
  readonly totalSovereigntyFatals: number;
  readonly totalCrackApplications: number;
  readonly dominantBreachLayerAllTime: ShieldLayerId | null;
  readonly avgRiskScore: number;
  readonly avgIntegrityDrop: number;
  readonly surgeCount: number;
  readonly recentHistory: readonly CascadeHistoryEntry[];
  readonly lastMLVector: CascadeMLVector | null;
  readonly lastTrendSummary: CascadeTrendSummary | null;
}

/** Session-level analytics summary. */
export interface CascadeAnalyticsSummary {
  readonly sessionTotalCascades: number;
  readonly sessionL4Breaches: number;
  readonly sessionGhostL3Cascades: number;
  readonly sessionSovereigntyFatals: number;
  readonly layerBreachDistribution: Partial<Record<ShieldLayerId, number>>;
  readonly modeBreachDistribution: Partial<Record<ModeCode, number>>;
  readonly phaseBreachDistribution: Partial<Record<RunPhase, number>>;
  readonly avgRiskScore: number;
  readonly avgIntegrityDrop: number;
  readonly cascadeSurgeCount: number;
  readonly ghostEchoRate: number;
  readonly sovereigntyFatalRate: number;
}

/** Full ensemble returned by createBreachCascadeResolverWithAnalytics(). */
export interface CascadeEnsemble {
  readonly resolver: BreachCascadeResolver;
  readonly mlExtractor: CascadeMLExtractor;
  readonly dlBuilder: CascadeDLBuilder;
  readonly trendAnalyzer: CascadeTrendAnalyzer;
  readonly annotator: CascadeAnnotator;
  readonly inspector: CascadeInspector;
  readonly analytics: CascadeAnalytics;
}

/** Parameters for ML feature extraction. */
export interface CascadeMLFeaturesParams {
  readonly layers: readonly ShieldLayerState[];
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tick: number;
  readonly totalCascadeCount: number;
  readonly l4BreachCount: number;
  readonly ghostL3Count: number;
  readonly crackCount: number;
  readonly sovereigntyFatalCount: number;
  readonly history: readonly CascadeHistoryEntry[];
  readonly threats?: readonly ThreatEnvelope[];
  readonly pressureTier?: PressureTier;
}

/** Parameters for a DL row. */
export interface CascadeDLRowParams {
  readonly layers: readonly ShieldLayerState[];
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tick: number;
  readonly cascadeTriggered: boolean;
  readonly ghostL3Triggered: boolean;
  readonly sovereigntyFatal: boolean;
  readonly crackApplied: boolean;
  readonly cascadeCount: number;
  readonly crackMultiplier: number;
  readonly prevOverallIntegrity?: number;
  readonly threats?: readonly ThreatEnvelope[];
  readonly botStates?: Readonly<Partial<Record<HaterBotId, BotState>>>;
  readonly pressureTier?: PressureTier;
}

// ============================================================================
// §5 — Pure helper functions
// ============================================================================

/** Map layers to the format required by computeShieldIntegrityRatio. */
export function mapCascadeLayersForIntegrity(
  layers: readonly ShieldLayerState[],
): ReadonlyArray<{ id: ShieldLayerId; current: number; max: number }> {
  return layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max }));
}

/** Compute the cascade imminent score for L4 (0-1). */
export function computeL4CascadeImminentScore(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): number {
  const l4 = layers.find((l) => l.layerId === 'L4');
  if (!l4) return 0;
  const vulnerability = computeShieldLayerVulnerability('L4', l4.current, l4.max);
  const modeMultiplier = CASCADE_MODE_SENSITIVITY[mode];
  const phaseMultiplier = CASCADE_PHASE_RISK_FACTOR[phase];
  return Math.min(1.0, vulnerability * modeMultiplier * phaseMultiplier);
}

/** Compute the ghost-mode L3 cascade imminent score (0-1). */
export function computeGhostL3CascadeImminentScore(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
): number {
  if (!CASCADE_GHOST_ECHO_ELIGIBLE[mode]) return 0;
  const l3 = layers.find((l) => l.layerId === 'L3');
  if (!l3) return 0;
  const vulnerability = computeShieldLayerVulnerability('L3', l3.current, l3.max);
  return Math.min(1.0, vulnerability * CASCADE_MODE_SENSITIVITY[mode]);
}

/** Compute cascade crack multiplier given mode and phase. */
export function computeCrackMultiplier(mode: ModeCode, phase: RunPhase): number {
  let multiplier = 1.0;
  if (mode === 'ghost') multiplier *= CASCADE_GHOST_CRACK_MULTIPLIER;
  if (isEndgamePhase(phase)) multiplier *= CASCADE_SOVEREIGNTY_CRACK_MULTIPLIER;
  return multiplier;
}

/** Compute the overall cascade risk score for a given state (0-10). */
export function scoreCascadeRisk(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  cascadeCount: number,
): number {
  const l4Imminent = computeL4CascadeImminentScore(layers, mode, phase);
  const ghostL3Imminent = computeGhostL3CascadeImminentScore(layers, mode);
  const stakes = computeEffectiveStakes(phase, mode);
  const surgeBonus = cascadeCount >= CASCADE_SURGE_THRESHOLD ? 2 : 0;
  return Math.min(10, (l4Imminent * 5 + ghostL3Imminent * 3) * stakes + surgeBonus);
}

/** Detect if a cascade surge is occurring (multiple cascades in recent history). */
export function detectCascadeSurge(history: readonly CascadeHistoryEntry[]): boolean {
  const recent = history.slice(-CASCADE_TREND_WINDOW);
  return recent.filter((h) => h.cascadeCountAtEvent > 0).length >= CASCADE_SURGE_THRESHOLD;
}

/** Compute average integrity drop from history. */
export function computeAvgIntegrityDrop(history: readonly CascadeHistoryEntry[]): number {
  if (history.length === 0) return 0;
  const drops = history.map((h) => h.integrityDrop);
  return drops.reduce((a, b) => a + b, 0) / drops.length;
}

/** Compute average crack depth from history. */
export function computeAvgCrackDepth(history: readonly CascadeHistoryEntry[]): number {
  if (history.length === 0) return 0;
  const depths = history.map((h) => h.crackMultiplier * SHIELD_CONSTANTS.CASCADE_CRACK_RATIO);
  return depths.reduce((a, b) => a + b, 0) / depths.length;
}

/** Find the dominant breach layer from history. */
export function findDominantBreachLayer(
  history: readonly CascadeHistoryEntry[],
): ShieldLayerId | null {
  const counts: Partial<Record<ShieldLayerId, number>> = {};
  for (const h of history) {
    counts[h.triggeredLayerId] = (counts[h.triggeredLayerId] ?? 0) + 1;
  }
  let max = 0;
  let dominant: ShieldLayerId | null = null;
  for (const [layerId, count] of Object.entries(counts)) {
    if ((count ?? 0) > max) {
      max = count ?? 0;
      dominant = layerId as ShieldLayerId;
    }
  }
  return dominant;
}

/** Compute bot threat weight from a bot state map. */
export function computeCascadeBotThreatWeight(
  botStates: Readonly<Partial<Record<HaterBotId, BotState>>>,
): number {
  let total = 0;
  for (const [botId, state] of Object.entries(botStates)) {
    if (state !== undefined) {
      total += BOT_THREAT_LEVEL[botId as HaterBotId] * BOT_STATE_THREAT_MULTIPLIER[state];
    }
  }
  return Math.min(1.0, total);
}

/** Build the layer vulnerability map for ML extraction. */
export function buildCascadeVulnerabilities(
  layers: readonly ShieldLayerState[],
): Readonly<Record<ShieldLayerId, number>> {
  const result: Record<string, number> = {};
  for (const layer of layers) {
    result[layer.layerId] = computeShieldLayerVulnerability(
      layer.layerId,
      layer.current,
      layer.max,
    );
  }
  return Object.freeze(result) as Readonly<Record<ShieldLayerId, number>>;
}

/** Extract ML feature vector from cascade state. */
export function extractCascadeMLFeatures(params: CascadeMLFeaturesParams): CascadeMLVector {
  const {
    layers, mode, phase, tick, totalCascadeCount, l4BreachCount,
    ghostL3Count, crackCount, sovereigntyFatalCount, history,
    threats = [], pressureTier = 'T0',
  } = params;

  const mappedLayers = mapCascadeLayersForIntegrity(layers);
  const overallIntegrity = computeShieldIntegrityRatio(mappedLayers);
  const weakestIntegrity = layers.length > 0
    ? Math.min(...layers.map((l) => l.integrityRatio))
    : 0;
  const vulns = buildCascadeVulnerabilities(layers);

  const l4Imminent = computeL4CascadeImminentScore(layers, mode, phase);
  const ghostL3Imminent = computeGhostL3CascadeImminentScore(layers, mode);
  const stakes = computeEffectiveStakes(phase, mode);

  // Layer integrity at potential breach time
  const l1 = layers.find((l) => l.layerId === 'L1');
  const l2 = layers.find((l) => l.layerId === 'L2');
  const l3 = layers.find((l) => l.layerId === 'L3');
  const l4 = layers.find((l) => l.layerId === 'L4');

  // History analytics
  const historyWindow = history.slice(-CASCADE_TREND_WINDOW);
  const histCascadeRate = historyWindow.length > 0
    ? historyWindow.filter((h) => h.cascadeCountAtEvent > 0).length / historyWindow.length
    : 0;
  const histGhostRate = historyWindow.length > 0
    ? historyWindow.filter((h) => h.ghostEchoFired).length / historyWindow.length
    : 0;
  const histSovereigntyRate = historyWindow.length > 0
    ? historyWindow.filter((h) => h.sovereigntyFatal).length / historyWindow.length
    : 0;
  const histAvgDrop = computeAvgIntegrityDrop(historyWindow);

  // Crack analytics
  const fortifiedPreCrack = layers.every(
    (l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
  ) ? 1 : 0;
  const avgCrackDepth = computeAvgCrackDepth(history);

  // Threat context
  const aggregateThreat = computeAggregateThreatPressure(threats, tick);
  const surgeFlag = detectCascadeSurge(history) ? 1 : 0;

  // Scale cascade counts to 0-1 range
  const scaleFactor = CASCADE_HISTORY_DEPTH;

  return Object.freeze({
    total_cascade_count_norm: Math.min(1.0, totalCascadeCount / scaleFactor),
    l4_breach_count_norm: Math.min(1.0, l4BreachCount / scaleFactor),
    ghost_l3_cascade_count_norm: Math.min(1.0, ghostL3Count / scaleFactor),
    crack_applied_count_norm: Math.min(1.0, crackCount / scaleFactor),
    sovereignty_fatal_count_norm: Math.min(1.0, sovereigntyFatalCount / scaleFactor),

    l1_integrity_at_breach: l1?.integrityRatio ?? 1.0,
    l2_integrity_at_breach: l2?.integrityRatio ?? 1.0,
    l3_integrity_at_breach: l3?.integrityRatio ?? 1.0,
    l4_integrity_at_breach: l4?.integrityRatio ?? 1.0,

    l4_cascade_imminent_score: l4Imminent,
    ghost_l3_cascade_imminent_score: ghostL3Imminent,
    overall_integrity: overallIntegrity,
    weakest_layer_integrity: isFinite(weakestIntegrity) ? weakestIntegrity : 0,

    mode_normalized: MODE_NORMALIZED[mode],
    phase_normalized: RUN_PHASE_NORMALIZED[phase],
    stakes_multiplier: stakes,
    mode_difficulty: MODE_DIFFICULTY_MULTIPLIER[mode],
    mode_tension_floor: MODE_TENSION_FLOOR[mode],

    vuln_l1: vulns.L1 ?? 0,
    vuln_l2: vulns.L2 ?? 0,
    vuln_l3: vulns.L3 ?? 0,
    vuln_l4: vulns.L4 ?? 0,

    crack_ratio: SHIELD_CONSTANTS.CASCADE_CRACK_RATIO,
    fortified_pre_crack: fortifiedPreCrack,
    avg_crack_depth: Math.min(1.0, avgCrackDepth),

    history_cascade_rate: histCascadeRate,
    history_ghost_cascade_rate: histGhostRate,
    history_sovereignty_rate: histSovereigntyRate,
    history_avg_integrity_drop: Math.min(1.0, histAvgDrop),

    aggregate_threat_pressure: aggregateThreat,
    pressure_tier_normalized: PRESSURE_TIER_NORMALIZED[pressureTier],
    cascade_surge_flag: surgeFlag,
  });
}

/** Build a single DL row (40 features). */
export function buildCascadeDLRow(params: CascadeDLRowParams): Readonly<Record<string, number>> {
  const {
    layers, mode, phase, tick, cascadeTriggered, ghostL3Triggered,
    sovereigntyFatal, crackApplied, cascadeCount, crackMultiplier,
    prevOverallIntegrity, threats = [], botStates = {}, pressureTier = 'T0',
  } = params;

  const mappedLayers = mapCascadeLayersForIntegrity(layers);
  const overallIntegrity = computeShieldIntegrityRatio(mappedLayers);
  const vulns = buildCascadeVulnerabilities(layers);
  const isFortified = layers.every((l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD);
  const prevIntegrity = prevOverallIntegrity ?? overallIntegrity;
  const integDelta = overallIntegrity - prevIntegrity;
  const stakes = computeEffectiveStakes(phase, mode);
  const tensionFloor = MODE_TENSION_FLOOR[mode];
  const botThreat = computeCascadeBotThreatWeight(botStates);
  const threatPressure = computeAggregateThreatPressure(threats, tick);

  // Average post-crack integrity (L1-L3 get cracked, L4 doesn't)
  const crackTarget = SHIELD_CONSTANTS.CASCADE_CRACK_RATIO;
  const postCrackLayers = layers.filter((l) => l.layerId !== 'L4');
  const avgPostCrack = crackApplied && postCrackLayers.length > 0
    ? postCrackLayers.reduce((sum, l) => sum + Math.min(l.integrityRatio, crackTarget), 0) / postCrackLayers.length
    : overallIntegrity;

  // Breach layer capacity weight (based on which layer was in focus)
  const l4 = layers.find((l) => l.layerId === 'L4');
  const breachCapacity = cascadeTriggered ? SHIELD_LAYER_CAPACITY_WEIGHT['L4'] :
    ghostL3Triggered ? SHIELD_LAYER_CAPACITY_WEIGHT['L3'] : 0;

  const surgeFlag = cascadeCount >= CASCADE_SURGE_THRESHOLD ? 1 : 0;

  const row: Record<string, number> = {
    row_cascade_triggered: cascadeTriggered ? 1 : 0,
    row_ghost_l3_triggered: ghostL3Triggered ? 1 : 0,
    row_l4_fatal_flag: sovereigntyFatal ? 1 : 0,
    row_crack_applied: crackApplied ? 1 : 0,
    row_cascade_count_norm: Math.min(1.0, cascadeCount / CASCADE_HISTORY_DEPTH),

    row_l1_integrity: layers.find((l) => l.layerId === 'L1')?.integrityRatio ?? 1.0,
    row_l2_integrity: layers.find((l) => l.layerId === 'L2')?.integrityRatio ?? 1.0,
    row_l3_integrity: layers.find((l) => l.layerId === 'L3')?.integrityRatio ?? 1.0,
    row_l4_integrity: l4?.integrityRatio ?? 1.0,

    row_vuln_l1: vulns.L1 ?? 0,
    row_vuln_l2: vulns.L2 ?? 0,
    row_vuln_l3: vulns.L3 ?? 0,
    row_vuln_l4: vulns.L4 ?? 0,

    row_mode_normalized: MODE_NORMALIZED[mode],
    row_phase_normalized: RUN_PHASE_NORMALIZED[phase],
    row_stakes_multiplier: stakes,
    row_mode_difficulty: MODE_DIFFICULTY_MULTIPLIER[mode],
    row_tension_floor: tensionFloor,

    row_crack_ratio: SHIELD_CONSTANTS.CASCADE_CRACK_RATIO,
    row_crack_multiplier: crackMultiplier,
    row_fortified_pre_crack: isFortified ? 1 : 0,
    row_avg_post_crack_integrity: avgPostCrack,
    row_breach_layer_capacity_weight: breachCapacity,

    row_threat_pressure: threatPressure,
    row_pressure_tier_norm: PRESSURE_TIER_NORMALIZED[pressureTier],
    row_max_attack_urgency: 0, // populated by caller if available
    row_bot_threat_weight: botThreat,

    row_history_cascade_rate: 0, // populated by caller from history
    row_sovereignty_fatal_flag: sovereigntyFatal ? 1 : 0,
    row_ghost_mode_flag: mode === 'ghost' ? 1 : 0,
    row_surge_flag: surgeFlag,
    row_integrity_delta: Math.max(-1.0, Math.min(1.0, integDelta)),

    row_pad_0: 0,
    row_pad_1: 0,
    row_pad_2: tick / 1000,
    row_pad_3: 0,
    row_pad_4: 0,
    row_pad_5: 0,
    row_pad_6: 0,
    row_pad_7: 0,
  };

  return Object.freeze(row);
}

/** Build a trend summary from cascade history. */
export function buildCascadeTrendSummary(
  history: readonly CascadeHistoryEntry[],
  mode: ModeCode,
  phase: RunPhase,
): CascadeTrendSummary {
  const window = history.slice(-CASCADE_TREND_WINDOW);

  const cascadeValues = window.map((h) => h.cascadeCountAtEvent);
  const cascadeVelocity = cascadeValues.length >= 2
    ? cascadeValues[cascadeValues.length - 1] - cascadeValues[0]
    : 0;

  const ghostValues = window.map((h) => h.ghostEchoFired ? 1 : 0);
  const ghostVelocity = ghostValues.length >= 2
    ? ghostValues[ghostValues.length - 1] - ghostValues[0]
    : 0;

  const integrityDrops = window.map((h) => h.integrityDrop);
  const integrityDropTrend: CascadeTrendSummary['integrityDropTrend'] =
    integrityDrops.length < 2 ? 'STABLE'
    : integrityDrops[integrityDrops.length - 1] > integrityDrops[0] * 1.1 ? 'WORSENING'
    : integrityDrops[integrityDrops.length - 1] < integrityDrops[0] * 0.9 ? 'IMPROVING'
    : 'STABLE';

  const avgCrack = computeAvgCrackDepth(history);
  const dominantBreachLayer = findDominantBreachLayer(history);
  const surgeDetected = detectCascadeSurge(history);
  const ghostEchoPattern = mode === 'ghost' && window.some((h) => h.ghostEchoFired);

  return Object.freeze({
    cascadeVelocity,
    ghostCascadeVelocity: ghostVelocity,
    integrityDropTrend,
    sovereigntyEscalationActive: isEndgamePhase(phase) && window.some((h) => h.sovereigntyFatal),
    surgeDetected,
    ghostEchoPattern,
    dominantBreachLayer,
    avgCrackDepth: avgCrack,
  });
}

/** Build annotation bundle for a cascade resolution event. */
export function buildCascadeAnnotation(
  context: CascadeResolutionContext,
  layers: readonly ShieldLayerState[],
  trend: CascadeTrendSummary,
): CascadeAnnotationBundle {
  const overallIntegrity = computeShieldIntegrityRatio(mapCascadeLayersForIntegrity(layers));
  const consequence = CASCADE_BREACH_CONSEQUENCE_LABEL[context.triggeredLayerId];
  const urgency: ThreatUrgencyClass =
    context.sovereigntyFatal ? 'CRITICAL'
    : context.riskScore >= 8 ? 'CRITICAL'
    : context.riskScore >= 5 ? 'HIGH'
    : context.riskScore >= 3 ? 'MEDIUM'
    : 'LOW';

  const layerLabel = SHIELD_LAYER_LABEL_BY_ID[context.triggeredLayerId];
  const trendStr = trend.surgeDetected
    ? ` SURGE ACTIVE (velocity: ${trend.cascadeVelocity.toFixed(1)}, trend: ${trend.integrityDropTrend})`
    : ` trend: ${trend.integrityDropTrend}`;

  return Object.freeze({
    summary: `${layerLabel} breached — cascade template: ${context.templateId} (chain #${context.resolution.cascadeCount}) | integrity: ${(overallIntegrity * 100).toFixed(0)}%${trendStr}`,
    severity: context.sovereigntyFatal ? 'FATAL' : context.riskScore >= 7 ? 'CRITICAL' : 'HIGH',
    riskLabel: `Risk: ${context.riskScore.toFixed(1)}/10 | integrity: ${(overallIntegrity * 100).toFixed(0)}%`,
    modeContext: `Mode: ${context.mode} (sensitivity: ${CASCADE_MODE_SENSITIVITY[context.mode].toFixed(2)})`,
    phaseContext: `Phase: ${context.phase} (risk factor: ${CASCADE_PHASE_RISK_FACTOR[context.phase].toFixed(2)}, endgame: ${isEndgamePhase(context.phase)})`,
    breachConsequence: consequence,
    ghostEchoNote: context.ghostEchoFired
      ? `Ghost-echo cascade fired on L3 — template: ${CASCADE_TEMPLATE_BY_LAYER['L3']}, dominant breach: ${trend.dominantBreachLayer ?? 'none'}`
      : null,
    sovereigntyFatalNote: context.sovereigntyFatal
      ? `SOVEREIGNTY L4 BREACH — engine health is now FAILED | integrity at breach: ${(overallIntegrity * 100).toFixed(0)}%`
      : null,
    uxHint: urgency === 'CRITICAL' ? 'Play RESCUE or COUNTER immediately' :
             urgency === 'HIGH' ? 'Cascade imminent — restore shield layers now' :
             'Monitor shield integrity',
    urgencyLevel: urgency,
  });
}

/** Build a UX hint for companion systems. */
export function buildCascadeUXHint(
  context: CascadeResolutionContext,
  layers: readonly ShieldLayerState[],
  pressureTier: PressureTier,
): CascadeUXHint {
  const overallIntegrity = computeShieldIntegrityRatio(mapCascadeLayersForIntegrity(layers));
  const tierWeight = CASCADE_PRESSURE_TIER_WEIGHT[pressureTier];
  const modeWeight = CASCADE_MODE_SENSITIVITY[context.mode];
  const phaseWeight = CASCADE_PHASE_RISK_FACTOR[context.phase];
  const urgencyScore = Math.min(1.0,
    (context.sovereigntyFatal ? 0.5 : 0) +
    (context.ghostEchoFired ? 0.3 : 0) +
    tierWeight * 0.2 * modeWeight * phaseWeight,
  );

  const priority: CascadeUXHint['priority'] =
    urgencyScore >= 0.8 ? 'CRITICAL'
    : urgencyScore >= 0.6 ? 'HIGH'
    : urgencyScore >= 0.4 ? 'MEDIUM'
    : urgencyScore >= 0.2 ? 'LOW' : 'AMBIENT';

  const channel: CascadeUXHint['channel'] =
    context.sovereigntyFatal ? 'COMBAT'
    : context.ghostEchoFired ? 'COMBAT'
    : context.riskScore >= 7 ? 'ALERT'
    : 'COMMENTARY';

  const layerLabel = SHIELD_LAYER_LABEL_BY_ID[context.triggeredLayerId];

  return Object.freeze({
    priority,
    channel,
    headline: context.sovereigntyFatal
      ? `SOVEREIGNTY FATAL — ${layerLabel} breached in final phase`
      : context.ghostEchoFired
        ? `Ghost cascade triggered — dual-layer threat active`
        : `${layerLabel} cascade — shield integrity at ${(overallIntegrity * 100).toFixed(0)}%`,
    detail: `Chain #${context.resolution.cascadeCount} | template: ${context.templateId} | mode: ${context.mode} | phase: ${context.phase}`,
    actionSuggestion: context.sovereigntyFatal ? 'No recovery possible — defend final position' :
                       context.riskScore >= 7 ? 'Play RESCUE card to break cascade chain' :
                       overallIntegrity < 0.3 ? 'Repair shield layers to prevent secondary breach' : null,
    suppressIfPressureBelow: PRESSURE_TIER_NORMALIZED['T1'],
  });
}

/** Build a history entry for a cascade resolution event. */
export function buildCascadeHistoryEntry(
  context: CascadeResolutionContext,
  preBreachLayers: readonly ShieldLayerState[],
  postBreachLayers: readonly ShieldLayerState[],
): CascadeHistoryEntry {
  const preIntegrity = computeShieldIntegrityRatio(mapCascadeLayersForIntegrity(preBreachLayers));
  const postIntegrity = computeShieldIntegrityRatio(mapCascadeLayersForIntegrity(postBreachLayers));

  return Object.freeze({
    tick: context.tick,
    mode: context.mode,
    phase: context.phase,
    triggeredLayerId: context.triggeredLayerId,
    templateId: context.templateId,
    ghostEchoFired: context.ghostEchoFired,
    sovereigntyFatal: context.sovereigntyFatal,
    crackMultiplier: context.crackMultiplier,
    riskScore: context.riskScore,
    preBreachIntegrity: preIntegrity,
    postBreachIntegrity: postIntegrity,
    integrityDrop: Math.max(0, preIntegrity - postIntegrity),
    cascadeCountAtEvent: context.resolution.cascadeCount,
  });
}

// ============================================================================
// §6 — CascadeMLExtractor
// ============================================================================

/** Extracts and caches ML feature vectors from cascade events. */
export class CascadeMLExtractor {
  private lastVector: CascadeMLVector | null = null;
  private vectorHistory: CascadeMLVector[] = [];

  public extract(params: CascadeMLFeaturesParams): CascadeMLVector {
    const vec = extractCascadeMLFeatures(params);
    this.lastVector = vec;
    this.vectorHistory = [...this.vectorHistory.slice(-(CASCADE_HISTORY_DEPTH - 1)), vec];
    return vec;
  }

  public getLastVector(): CascadeMLVector | null {
    return this.lastVector;
  }

  public getVectorHistory(): readonly CascadeMLVector[] {
    return Object.freeze([...this.vectorHistory]);
  }

  /** Score the current cascade risk level (0-1). */
  public scoreCascadeRiskLevel(): number {
    if (!this.lastVector) return 0;
    const v = this.lastVector;
    return Math.min(1.0,
      v.l4_cascade_imminent_score * 0.40 +
      v.ghost_l3_cascade_imminent_score * 0.20 +
      v.cascade_surge_flag * 0.20 +
      v.history_cascade_rate * 0.10 +
      v.sovereignty_fatal_count_norm * 0.10,
    );
  }

  /** Build signal tags for EngineSignal emission. */
  public buildSignalTags(): readonly string[] {
    if (!this.lastVector) return Object.freeze([]);
    const v = this.lastVector;
    return Object.freeze([
      `cascade_count:${v.total_cascade_count_norm.toFixed(4)}`,
      `l4_imminent:${v.l4_cascade_imminent_score.toFixed(4)}`,
      `ghost_l3:${v.ghost_l3_cascade_imminent_score.toFixed(4)}`,
      `integrity:${v.overall_integrity.toFixed(4)}`,
      `surge:${v.cascade_surge_flag.toFixed(0)}`,
      `mode:${v.mode_normalized.toFixed(3)}`,
    ]);
  }

  /** Compute rolling average of key features. */
  public computeRollingAverage(windowSize: number = CASCADE_TREND_WINDOW): Partial<CascadeMLVector> {
    const window = this.vectorHistory.slice(-windowSize);
    if (window.length === 0) return {};
    const keys = Object.keys(window[0]) as (keyof CascadeMLVector)[];
    const avg: Partial<Record<keyof CascadeMLVector, number>> = {};
    for (const key of keys) {
      avg[key] = window.reduce((sum, v) => sum + (v[key] as number), 0) / window.length;
    }
    return avg as Partial<CascadeMLVector>;
  }

  public reset(): void {
    this.lastVector = null;
    this.vectorHistory = [];
  }
}

// ============================================================================
// §7 — CascadeDLBuilder
// ============================================================================

/** Builds and maintains the rolling DL tensor sequence. */
export class CascadeDLBuilder {
  private rows: Array<Readonly<Record<string, number>>> = [];
  private lastIntegrity: number = 1.0;

  public appendRow(params: CascadeDLRowParams): void {
    const row = buildCascadeDLRow({
      ...params,
      prevOverallIntegrity: this.lastIntegrity,
    });
    const mappedLayers = mapCascadeLayersForIntegrity(params.layers);
    this.lastIntegrity = computeShieldIntegrityRatio(mappedLayers);
    this.rows = [...this.rows.slice(-(CASCADE_DL_SEQUENCE_LENGTH - 1)), row];
  }

  public buildTensor(tick: number, mode: ModeCode, phase: RunPhase): CascadeDLTensor {
    const padRow = Object.fromEntries(
      CASCADE_DL_FEATURE_LABELS.map((label) => [label, 0]),
    );

    const sequence: Array<Readonly<Record<string, number>>> = [];
    for (let i = 0; i < CASCADE_DL_SEQUENCE_LENGTH - this.rows.length; i++) {
      sequence.push(Object.freeze({ ...padRow }));
    }
    sequence.push(...this.rows);

    return Object.freeze({
      sequence: Object.freeze(sequence),
      tick,
      mode,
      phase,
    });
  }

  public getSequenceLength(): number {
    return this.rows.length;
  }

  /** Flatten DL tensor to 1D array. */
  public flattenTensor(tensor: CascadeDLTensor): readonly number[] {
    const flat: number[] = [];
    for (const row of tensor.sequence) {
      for (const label of CASCADE_DL_FEATURE_LABELS) {
        flat.push(row[label] ?? 0);
      }
    }
    return Object.freeze(flat);
  }

  public reset(): void {
    this.rows = [];
    this.lastIntegrity = 1.0;
  }
}

// ============================================================================
// §8 — CascadeTrendAnalyzer
// ============================================================================

/** Analyzes cascade history for trend patterns and escalation signals. */
export class CascadeTrendAnalyzer {
  private history: CascadeHistoryEntry[] = [];

  public record(entry: CascadeHistoryEntry): void {
    this.history = [...this.history.slice(-(CASCADE_HISTORY_DEPTH - 1)), entry];
  }

  public buildTrend(mode: ModeCode, phase: RunPhase): CascadeTrendSummary {
    return buildCascadeTrendSummary(this.history, mode, phase);
  }

  /** Detect whether cascade events are accelerating. */
  public detectAcceleration(): boolean {
    const recent = this.history.slice(-CASCADE_TREND_WINDOW);
    if (recent.length < 3) return false;
    const first = recent.slice(0, Math.floor(recent.length / 2));
    const second = recent.slice(Math.floor(recent.length / 2));
    const firstRate = first.filter((h) => h.cascadeCountAtEvent > 0).length / first.length;
    const secondRate = second.filter((h) => h.cascadeCountAtEvent > 0).length / second.length;
    return secondRate > firstRate * 1.25;
  }

  /** Compute the ghost echo rate over history. */
  public computeGhostEchoRate(): number {
    if (this.history.length === 0) return 0;
    return this.history.filter((h) => h.ghostEchoFired).length / this.history.length;
  }

  /** Compute the sovereignty fatal rate over history. */
  public computeSovereigntyFatalRate(): number {
    if (this.history.length === 0) return 0;
    return this.history.filter((h) => h.sovereigntyFatal).length / this.history.length;
  }

  /** Compute the average risk score from history. */
  public computeAvgRiskScore(): number {
    if (this.history.length === 0) return 0;
    return this.history.reduce((sum, h) => sum + h.riskScore, 0) / this.history.length;
  }

  /** Detect if a Sovereignty phase cascade surge is active. */
  public detectSovereigntySurge(): boolean {
    return this.history.slice(-3).some((h) => h.sovereigntyFatal);
  }

  /** Compute the per-layer breach distribution. */
  public computeLayerBreachDistribution(): Partial<Record<ShieldLayerId, number>> {
    const dist: Partial<Record<ShieldLayerId, number>> = {};
    for (const h of this.history) {
      dist[h.triggeredLayerId] = (dist[h.triggeredLayerId] ?? 0) + 1;
    }
    return dist;
  }

  public getHistory(): readonly CascadeHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  public reset(): void {
    this.history = [];
  }
}

// ============================================================================
// §9 — CascadeAnnotator
// ============================================================================

/** Builds human-readable annotations and UX hints from cascade state. */
export class CascadeAnnotator {
  public buildAnnotation(
    context: CascadeResolutionContext,
    layers: readonly ShieldLayerState[],
    trend: CascadeTrendSummary,
  ): CascadeAnnotationBundle {
    return buildCascadeAnnotation(context, layers, trend);
  }

  public buildUXHint(
    context: CascadeResolutionContext,
    layers: readonly ShieldLayerState[],
    pressureTier: PressureTier,
  ): CascadeUXHint {
    return buildCascadeUXHint(context, layers, pressureTier);
  }

  /** Build a chat-native summary string for NPC dialogue injection. */
  public buildChatSummary(
    annotation: CascadeAnnotationBundle,
    hint: CascadeUXHint,
  ): string {
    const parts: string[] = [annotation.summary];
    if (annotation.ghostEchoNote !== null) parts.push(annotation.ghostEchoNote);
    if (annotation.sovereigntyFatalNote !== null) parts.push(annotation.sovereigntyFatalNote);
    if (hint.actionSuggestion !== null) parts.push(`Suggestion: ${hint.actionSuggestion}`);
    return parts.join(' | ');
  }

  /** Determine the chat channel for this cascade event. */
  public resolveChatChannel(context: CascadeResolutionContext): string {
    if (context.sovereigntyFatal) return 'COMBAT';
    if (context.ghostEchoFired) return 'COMBAT';
    if (context.riskScore >= 7) return 'ALERT';
    if (context.riskScore >= 4) return 'COMMENTARY';
    return 'AMBIENT';
  }

  /** Build narrative weight score for companion prioritization (0-1). */
  public buildNarrativeWeight(
    context: CascadeResolutionContext,
    pressureTier: PressureTier,
  ): number {
    const fatalWeight = context.sovereigntyFatal ? 0.40 : 0;
    const ghostWeight = context.ghostEchoFired ? 0.30 : 0;
    const riskWeight = Math.min(0.20, context.riskScore / 50);
    const tierWeight = CASCADE_PRESSURE_TIER_WEIGHT[pressureTier] * 0.10;
    return Math.min(1.0, fatalWeight + ghostWeight + riskWeight + tierWeight);
  }
}

// ============================================================================
// §10 — CascadeInspector
// ============================================================================

/** Provides runtime observability into the BreachCascadeResolver's state. */
export class CascadeInspector {
  private totalCascades = 0;
  private totalL4Breaches = 0;
  private totalGhostL3 = 0;
  private totalSovereigntyFatals = 0;
  private totalCrackApplications = 0;
  private riskScoreSum = 0;
  private integrityDropSum = 0;
  private surgeCount = 0;

  public record(entry: CascadeHistoryEntry, crackApplied: boolean): void {
    this.totalCascades += 1;
    if (entry.triggeredLayerId === 'L4') this.totalL4Breaches += 1;
    if (entry.ghostEchoFired) this.totalGhostL3 += 1;
    if (entry.sovereigntyFatal) this.totalSovereigntyFatals += 1;
    if (crackApplied) this.totalCrackApplications += 1;
    this.riskScoreSum += entry.riskScore;
    this.integrityDropSum += entry.integrityDrop;
  }

  public recordSurge(): void {
    this.surgeCount += 1;
  }

  public buildState(
    history: readonly CascadeHistoryEntry[],
    lastVector: CascadeMLVector | null,
    lastTrend: CascadeTrendSummary | null,
  ): CascadeInspectorState {
    return Object.freeze({
      totalCascades: this.totalCascades,
      totalL4Breaches: this.totalL4Breaches,
      totalGhostL3Cascades: this.totalGhostL3,
      totalSovereigntyFatals: this.totalSovereigntyFatals,
      totalCrackApplications: this.totalCrackApplications,
      dominantBreachLayerAllTime: findDominantBreachLayer(history),
      avgRiskScore: this.totalCascades > 0 ? this.riskScoreSum / this.totalCascades : 0,
      avgIntegrityDrop: this.totalCascades > 0 ? this.integrityDropSum / this.totalCascades : 0,
      surgeCount: this.surgeCount,
      recentHistory: history.slice(-10),
      lastMLVector: lastVector,
      lastTrendSummary: lastTrend,
    });
  }

  public reset(): void {
    this.totalCascades = 0;
    this.totalL4Breaches = 0;
    this.totalGhostL3 = 0;
    this.totalSovereigntyFatals = 0;
    this.totalCrackApplications = 0;
    this.riskScoreSum = 0;
    this.integrityDropSum = 0;
    this.surgeCount = 0;
  }
}

// ============================================================================
// §11 — CascadeAnalytics
// ============================================================================

/** Session-level analytics across all cascade resolution events. */
export class CascadeAnalytics {
  private sessionCascades = 0;
  private sessionL4Breaches = 0;
  private sessionGhostL3 = 0;
  private sessionSovereigntyFatals = 0;
  private sessionLayerBreakdown: Partial<Record<ShieldLayerId, number>> = {};
  private sessionModeBreakdown: Partial<Record<ModeCode, number>> = {};
  private sessionPhaseBreakdown: Partial<Record<RunPhase, number>> = {};
  private sessionRiskScoreSum = 0;
  private sessionIntegrityDropSum = 0;
  private sessionSurgeCount = 0;

  public record(entry: CascadeHistoryEntry): void {
    this.sessionCascades += 1;
    if (entry.triggeredLayerId === 'L4') this.sessionL4Breaches += 1;
    if (entry.ghostEchoFired) this.sessionGhostL3 += 1;
    if (entry.sovereigntyFatal) this.sessionSovereigntyFatals += 1;
    this.sessionLayerBreakdown[entry.triggeredLayerId] =
      (this.sessionLayerBreakdown[entry.triggeredLayerId] ?? 0) + 1;
    this.sessionModeBreakdown[entry.mode] =
      (this.sessionModeBreakdown[entry.mode] ?? 0) + 1;
    this.sessionPhaseBreakdown[entry.phase] =
      (this.sessionPhaseBreakdown[entry.phase] ?? 0) + 1;
    this.sessionRiskScoreSum += entry.riskScore;
    this.sessionIntegrityDropSum += entry.integrityDrop;
  }

  public recordSurge(): void {
    this.sessionSurgeCount += 1;
  }

  public computeSummary(): CascadeAnalyticsSummary {
    const safe = this.sessionCascades === 0 ? 1 : this.sessionCascades;

    // Ensure all layers represented using SHIELD_LAYER_ORDER
    const layerDist: Partial<Record<ShieldLayerId, number>> = {};
    for (const layerId of SHIELD_LAYER_ORDER) {
      layerDist[layerId] = this.sessionLayerBreakdown[layerId] ?? 0;
    }

    // Ensure all configs represented
    const configLayers = Object.keys(SHIELD_LAYER_CONFIGS) as ShieldLayerId[];
    for (const layerId of configLayers) {
      if (layerDist[layerId] === undefined) layerDist[layerId] = 0;
    }

    return Object.freeze({
      sessionTotalCascades: this.sessionCascades,
      sessionL4Breaches: this.sessionL4Breaches,
      sessionGhostL3Cascades: this.sessionGhostL3,
      sessionSovereigntyFatals: this.sessionSovereigntyFatals,
      layerBreachDistribution: layerDist,
      modeBreachDistribution: { ...this.sessionModeBreakdown },
      phaseBreachDistribution: { ...this.sessionPhaseBreakdown },
      avgRiskScore: this.sessionRiskScoreSum / safe,
      avgIntegrityDrop: this.sessionIntegrityDropSum / safe,
      cascadeSurgeCount: this.sessionSurgeCount,
      ghostEchoRate: this.sessionGhostL3 / safe,
      sovereigntyFatalRate: this.sessionSovereigntyFatals / safe,
    });
  }

  public reset(): void {
    this.sessionCascades = 0;
    this.sessionL4Breaches = 0;
    this.sessionGhostL3 = 0;
    this.sessionSovereigntyFatals = 0;
    this.sessionLayerBreakdown = {};
    this.sessionModeBreakdown = {};
    this.sessionPhaseBreakdown = {};
    this.sessionRiskScoreSum = 0;
    this.sessionIntegrityDropSum = 0;
    this.sessionSurgeCount = 0;
  }
}

// ============================================================================
// §12 — Enhanced BreachCascadeResolver class
// ============================================================================

/**
 * BreachCascadeResolver — authoritative cascade resolution engine.
 *
 * Preserves all original public surface (resolve, resolveTemplate,
 * resolveCascadeCount, getCascadeCount, reset) and adds mode/phase-aware
 * contextual resolution, ghost-mode L3 cascade chains, ML/DL extraction,
 * history tracking, and analytics.
 */
export class BreachCascadeResolver {
  private readonly layerManager = new ShieldLayerManager();
  private cascadeCount = 0;
  private ghostCascadeCount = 0;
  private l4BreachCount = 0;
  private crackCount = 0;
  private sovereigntyFatalCount = 0;

  private readonly history: CascadeHistoryEntry[] = [];
  private readonly mlExtractor = new CascadeMLExtractor();
  private readonly dlBuilder = new CascadeDLBuilder();
  private readonly trendAnalyzer = new CascadeTrendAnalyzer();
  private readonly annotator = new CascadeAnnotator();
  private readonly inspector = new CascadeInspector();
  private readonly analytics = new CascadeAnalytics();

  // ── Original public API ────────────────────────────────────────────────────

  /**
   * Resolve a breach — original API preserved exactly.
   * Only triggers cascade on L4 breach. Use resolveWithContext for full
   * mode/phase-aware resolution.
   */
  public resolve(
    snapshot: RunStateSnapshot,
    layers: readonly ShieldLayerState[],
    breachedLayerId: ShieldLayerId,
    tick: number,
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
  ): CascadeResolution {
    if (breachedLayerId !== 'L4') {
      return {
        layers,
        triggered: false,
        chainId: null,
        templateId: null,
        cascadeCount: this.cascadeCount,
      };
    }

    this.cascadeCount += 1;
    this.l4BreachCount += 1;
    this.crackCount += 1;

    const templateId = this.resolveTemplate(breachedLayerId);
    const chainId = `${snapshot.runId}:cascade:${tick}:${this.cascadeCount}`;
    const crackedLayers = this.layerManager.applyCascadeCrack(layers, tick);

    bus.emit('cascade.chain.created', {
      chainId,
      templateId,
      positive: false,
    });

    return {
      layers: crackedLayers,
      triggered: true,
      chainId,
      templateId,
      cascadeCount: this.cascadeCount,
    };
  }

  /** Resolve the cascade template string for a given layer ID. */
  public resolveTemplate(layerId: ShieldLayerId): string {
    return CASCADE_TEMPLATE_BY_LAYER[layerId];
  }

  /** Compute the total cascade count including a given breach count. */
  public resolveCascadeCount(breaches: number): number {
    return this.cascadeCount + Math.max(0, breaches);
  }

  /** Get the current total cascade count. */
  public getCascadeCount(): number {
    return this.cascadeCount;
  }

  /** Reset all counters. */
  public reset(): void {
    this.cascadeCount = 0;
    this.ghostCascadeCount = 0;
    this.l4BreachCount = 0;
    this.crackCount = 0;
    this.sovereigntyFatalCount = 0;
    this.history.length = 0;
    this.mlExtractor.reset();
    this.dlBuilder.reset();
    this.trendAnalyzer.reset();
    this.inspector.reset();
    this.analytics.reset();
  }

  // ── Enhanced contextual API ────────────────────────────────────────────────

  /**
   * Resolve a breach with full mode/phase context.
   *
   * Key doctrine:
   * - L4 breach always triggers cascade (original behavior preserved)
   * - Ghost mode: L3 breach also triggers cascade via resolveGhostL3Cascade()
   * - Sovereignty phase: L4 breach sets sovereigntyFatal=true (engine health FAILED)
   * - Crack multiplier is amplified in ghost mode and Sovereignty phase
   */
  public resolveWithContext(
    snapshot: RunStateSnapshot,
    layers: readonly ShieldLayerState[],
    breachedLayerId: ShieldLayerId,
    tick: number,
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    mode: ModeCode,
    phase: RunPhase,
    pressureTier: PressureTier = 'T0',
    threats: readonly ThreatEnvelope[] = [],
    botStates: Readonly<Partial<Record<HaterBotId, BotState>>> = {},
  ): CascadeResolutionContext {
    const preBreachLayers = layers;
    const crackMultiplier = computeCrackMultiplier(mode, phase);

    // Ghost mode L3 cascade — doctrine: ghost-echo
    if (breachedLayerId === 'L3' && CASCADE_GHOST_ECHO_ELIGIBLE[mode]) {
      return this.resolveGhostL3CascadeWithContext(
        snapshot, layers, tick, bus, mode, phase, pressureTier,
        threats, botStates, crackMultiplier, preBreachLayers,
      );
    }

    // Non-cascade-gate layers in non-ghost mode
    if (breachedLayerId !== 'L4') {
      const riskScore = scoreCascadeRisk(layers, mode, phase, this.cascadeCount);
      return Object.freeze({
        resolution: {
          layers,
          triggered: false,
          chainId: null,
          templateId: null,
          cascadeCount: this.cascadeCount,
        },
        triggeredLayerId: breachedLayerId,
        templateId: this.resolveTemplate(breachedLayerId),
        ghostEchoFired: false,
        sovereigntyFatal: false,
        mode,
        phase,
        crackMultiplier,
        riskScore,
        tick,
      });
    }

    // L4 breach — canonical cascade gate
    this.cascadeCount += 1;
    this.l4BreachCount += 1;
    this.crackCount += 1;

    const sovereigntyFatal = CASCADE_SOVEREIGNTY_FATAL_ELIGIBLE[phase];
    if (sovereigntyFatal) {
      this.sovereigntyFatalCount += 1;
    }

    const templateId = this.resolveTemplate('L4');
    const chainId = `${snapshot.runId}:cascade:${tick}:${this.cascadeCount}`;

    // Apply cascade crack with mode/phase multiplier
    const crackedLayers = this.applyContextualCrack(layers, tick, mode, phase);

    bus.emit('cascade.chain.created', {
      chainId,
      templateId,
      positive: false,
    });

    const resolution: CascadeResolution = {
      layers: crackedLayers,
      triggered: true,
      chainId,
      templateId,
      cascadeCount: this.cascadeCount,
    };

    const riskScore = scoreCascadeRisk(crackedLayers, mode, phase, this.cascadeCount);

    const context: CascadeResolutionContext = Object.freeze({
      resolution,
      triggeredLayerId: 'L4',
      templateId,
      ghostEchoFired: false,
      sovereigntyFatal,
      mode,
      phase,
      crackMultiplier,
      riskScore,
      tick,
    });

    // Record everything
    this.recordResolution(context, preBreachLayers, crackedLayers, pressureTier, threats, botStates);

    return context;
  }

  /**
   * Ghost mode L3 cascade resolution.
   * Ghost-echo doctrine: L3 breach in ghost mode triggers INCOME_SHOCK cascade.
   */
  private resolveGhostL3CascadeWithContext(
    snapshot: RunStateSnapshot,
    layers: readonly ShieldLayerState[],
    tick: number,
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    mode: ModeCode,
    phase: RunPhase,
    pressureTier: PressureTier,
    threats: readonly ThreatEnvelope[],
    botStates: Readonly<Partial<Record<HaterBotId, BotState>>>,
    crackMultiplier: number,
    preBreachLayers: readonly ShieldLayerState[],
  ): CascadeResolutionContext {
    this.ghostCascadeCount += 1;
    this.cascadeCount += 1;
    this.crackCount += 1;

    const templateId = this.resolveTemplate('L3'); // 'INCOME_SHOCK'
    const chainId = `${snapshot.runId}:cascade:ghost-echo:${tick}:${this.ghostCascadeCount}`;

    const crackedLayers = this.applyContextualCrack(layers, tick, mode, phase);

    bus.emit('cascade.chain.created', {
      chainId,
      templateId,
      positive: false,
    });

    const resolution: CascadeResolution = {
      layers: crackedLayers,
      triggered: true,
      chainId,
      templateId,
      cascadeCount: this.cascadeCount,
    };

    const riskScore = scoreCascadeRisk(crackedLayers, mode, phase, this.cascadeCount);

    const context: CascadeResolutionContext = Object.freeze({
      resolution,
      triggeredLayerId: 'L3',
      templateId,
      ghostEchoFired: true,
      sovereigntyFatal: false,
      mode,
      phase,
      crackMultiplier,
      riskScore,
      tick,
    });

    this.recordResolution(context, preBreachLayers, crackedLayers, pressureTier, threats, botStates);

    return context;
  }

  /**
   * Apply cascade crack with mode/phase multiplier.
   * Ghost mode and Sovereignty phase amplify crack depth.
   */
  private applyContextualCrack(
    layers: readonly ShieldLayerState[],
    tick: number,
    mode: ModeCode,
    phase: RunPhase,
  ): readonly ShieldLayerState[] {
    // Base crack from ShieldLayerManager
    const cracked = this.layerManager.applyCascadeCrack(layers, tick);

    // Additional crack depth for ghost/sovereignty
    const extra = computeCrackMultiplier(mode, phase) - 1.0;
    if (extra <= 0) return cracked;

    // Apply extra pressure proportional to extra multiplier
    return cracked.map((layer) => {
      if (layer.layerId === 'L4') return layer;
      const additionalCrack = Math.floor(layer.max * SHIELD_CONSTANTS.CASCADE_CRACK_RATIO * extra);
      if (additionalCrack <= 0) return layer;
      const nextCurrent = Math.max(0, layer.current - additionalCrack);
      if (nextCurrent >= layer.current) return layer;
      const config = getLayerConfig(layer.layerId);
      const breached = nextCurrent <= 0;
      return {
        layerId: layer.layerId,
        label: config.label,
        current: nextCurrent,
        max: layer.max,
        regenPerTick: breached ? config.breachedRegenRate : config.passiveRegenRate,
        breached,
        integrityRatio: layer.max === 0 ? 0 : nextCurrent / layer.max,
        lastDamagedTick: tick,
        lastRecoveredTick: layer.lastRecoveredTick,
      };
    });
  }

  /** Record a resolution event in all companion subsystems. */
  private recordResolution(
    context: CascadeResolutionContext,
    preBreachLayers: readonly ShieldLayerState[],
    postBreachLayers: readonly ShieldLayerState[],
    pressureTier: PressureTier,
    threats: readonly ThreatEnvelope[],
    botStates: Readonly<Partial<Record<HaterBotId, BotState>>>,
  ): void {
    const entry = buildCascadeHistoryEntry(context, preBreachLayers, postBreachLayers);
    this.history.push(entry);
    if (this.history.length > CASCADE_HISTORY_DEPTH) {
      this.history.splice(0, this.history.length - CASCADE_HISTORY_DEPTH);
    }
    this.trendAnalyzer.record(entry);
    this.analytics.record(entry);
    this.inspector.record(entry, context.crackMultiplier > 1.0);

    // Surge detection
    if (detectCascadeSurge(this.history)) {
      this.inspector.recordSurge();
      this.analytics.recordSurge();
    }

    // ML extraction
    this.mlExtractor.extract({
      layers: postBreachLayers,
      mode: context.mode,
      phase: context.phase,
      tick: context.tick,
      totalCascadeCount: this.cascadeCount,
      l4BreachCount: this.l4BreachCount,
      ghostL3Count: this.ghostCascadeCount,
      crackCount: this.crackCount,
      sovereigntyFatalCount: this.sovereigntyFatalCount,
      history: [...this.history],
      threats,
      pressureTier,
    });

    // DL row
    this.dlBuilder.appendRow({
      layers: postBreachLayers,
      mode: context.mode,
      phase: context.phase,
      tick: context.tick,
      cascadeTriggered: context.resolution.triggered,
      ghostL3Triggered: context.ghostEchoFired,
      sovereigntyFatal: context.sovereigntyFatal,
      crackApplied: context.crackMultiplier > 0,
      cascadeCount: this.cascadeCount,
      crackMultiplier: context.crackMultiplier,
      threats,
      botStates,
      pressureTier,
    });
  }

  // ── Analytics accessors ────────────────────────────────────────────────────

  public getLastMLVector(): CascadeMLVector | null {
    return this.mlExtractor.getLastVector();
  }

  public buildDLTensor(tick: number, mode: ModeCode, phase: RunPhase): CascadeDLTensor {
    return this.dlBuilder.buildTensor(tick, mode, phase);
  }

  public buildTrendSummary(mode: ModeCode, phase: RunPhase): CascadeTrendSummary {
    return this.trendAnalyzer.buildTrend(mode, phase);
  }

  public buildAnnotation(
    context: CascadeResolutionContext,
    layers: readonly ShieldLayerState[],
    trend: CascadeTrendSummary,
  ): CascadeAnnotationBundle {
    return this.annotator.buildAnnotation(context, layers, trend);
  }

  public buildUXHint(
    context: CascadeResolutionContext,
    layers: readonly ShieldLayerState[],
    pressureTier: PressureTier,
  ): CascadeUXHint {
    return this.annotator.buildUXHint(context, layers, pressureTier);
  }

  public getInspectorState(): CascadeInspectorState {
    return this.inspector.buildState(
      this.history,
      this.mlExtractor.getLastVector(),
      this.trendAnalyzer.buildTrend('solo', 'FOUNDATION'),
    );
  }

  public getAnalyticsSummary(): CascadeAnalyticsSummary {
    return this.analytics.computeSummary();
  }

  public getHistory(): readonly CascadeHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  public getGhostCascadeCount(): number {
    return this.ghostCascadeCount;
  }

  public getL4BreachCount(): number {
    return this.l4BreachCount;
  }

  public getSovereigntyFatalCount(): number {
    return this.sovereigntyFatalCount;
  }
}

// ============================================================================
// §13 — Factory & standalone helpers
// ============================================================================

/** Create a full BreachCascadeResolver ensemble. */
export function createBreachCascadeResolverWithAnalytics(): CascadeEnsemble {
  const resolver = new BreachCascadeResolver();
  const mlExtractor = new CascadeMLExtractor();
  const dlBuilder = new CascadeDLBuilder();
  const trendAnalyzer = new CascadeTrendAnalyzer();
  const annotator = new CascadeAnnotator();
  const inspector = new CascadeInspector();
  const analytics = new CascadeAnalytics();

  return Object.freeze({
    resolver,
    mlExtractor,
    dlBuilder,
    trendAnalyzer,
    annotator,
    inspector,
    analytics,
  });
}

/** Get the recommended chat channel for a cascade context. */
export function getCascadeChatChannel(context: CascadeResolutionContext): string {
  if (context.sovereigntyFatal) return 'COMBAT';
  if (context.ghostEchoFired) return 'COMBAT';
  if (context.riskScore >= 7) return 'ALERT';
  if (context.riskScore >= 4) return 'COMMENTARY';
  return 'AMBIENT';
}

/** Build cascade narrative weight for companion prioritization (0-1). */
export function buildCascadeNarrativeWeight(
  context: CascadeResolutionContext,
  pressureTier: PressureTier,
): number {
  const fatalWeight = context.sovereigntyFatal ? 0.40 : 0;
  const ghostWeight = context.ghostEchoFired ? 0.30 : 0;
  const riskWeight = Math.min(0.20, context.riskScore / 50);
  const tierWeight = CASCADE_PRESSURE_TIER_WEIGHT[pressureTier] * 0.10;
  return Math.min(1.0, fatalWeight + ghostWeight + riskWeight + tierWeight);
}

/** Extract a flat ML feature array (for direct model ingestion). */
export function extractCascadeMLArray(vector: CascadeMLVector): readonly number[] {
  return Object.freeze(
    CASCADE_ML_FEATURE_LABELS.map((label) => (vector as unknown as Record<string, number>)[label] ?? 0),
  );
}

/** Describe a cascade context in a human-readable sentence. */
export function describeCascadeContext(context: CascadeResolutionContext): string {
  const layerLabel = SHIELD_LAYER_LABEL_BY_ID[context.triggeredLayerId];
  const ghostStr = context.ghostEchoFired ? ' [GHOST-ECHO]' : '';
  const fatalStr = context.sovereigntyFatal ? ' [SOVEREIGNTY-FATAL]' : '';
  return `${layerLabel} breached → template: ${context.templateId} | chain #${context.resolution.cascadeCount}` +
    ` | risk: ${context.riskScore.toFixed(1)}/10 | mode: ${context.mode} | phase: ${context.phase}${ghostStr}${fatalStr}`;
}

// ============================================================================
// §14 — Deep cascade analytics
// ============================================================================

/**
 * Classify attacks for cascade impact using full AttackEvent context.
 * Uses classifyAttackSeverity and scoreAttackResponseUrgency from GamePrimitives.
 */
export interface CascadeAttackImpactProfile {
  readonly attack: AttackEvent;
  readonly severityClass: AttackSeverityClass;
  readonly urgencyScore: number;
  readonly likelyCascadeTrigger: boolean;
  readonly targetLayerDangerIndex: number;
}

export function buildCascadeAttackImpactProfiles(
  attacks: readonly AttackEvent[],
  layers: readonly ShieldLayerState[],
  tick: number,
): readonly CascadeAttackImpactProfile[] {
  return Object.freeze(
    attacks.map((attack) => {
      const severityClass = classifyAttackSeverity(attack);
      const urgencyScore = scoreAttackResponseUrgency(attack, tick);
      const targetLayerId = attack.targetLayer !== 'DIRECT' ? attack.targetLayer : 'L4';
      const targetLayer = layers.find((l) => l.layerId === targetLayerId);
      const dangerIndex = CASCADE_LAYER_DANGER_INDEX[targetLayerId];
      const vulnerability = targetLayer
        ? computeShieldLayerVulnerability(targetLayerId, targetLayer.current, targetLayer.max)
        : 1.0;
      const likelyCascadeTrigger =
        (targetLayerId === 'L4' || targetLayerId === 'L3') &&
        vulnerability > CASCADE_IMMINENT_L4_THRESHOLD;

      return Object.freeze({
        attack,
        severityClass,
        urgencyScore,
        likelyCascadeTrigger,
        targetLayerDangerIndex: dangerIndex * vulnerability,
      });
    }),
  );
}

/** Score aggregate cascade threat from threat envelopes. */
export function scoreCascadeThreatFromEnvelopes(
  threats: readonly ThreatEnvelope[],
  tick: number,
  mode: ModeCode,
  phase: RunPhase,
): number {
  if (threats.length === 0) return 0;
  const aggregate = computeAggregateThreatPressure(threats, tick);
  const modeBoost = CASCADE_MODE_SENSITIVITY[mode];
  const phaseBoost = CASCADE_PHASE_RISK_FACTOR[phase];
  return Math.min(1.0, aggregate * modeBoost * phaseBoost);
}

/** Classify threat envelopes by cascade urgency. */
export function classifyCascadeThreatBatch(
  threats: readonly ThreatEnvelope[],
  tick: number,
): ReadonlyArray<{ threat: ThreatEnvelope; urgencyClass: ThreatUrgencyClass; score: number }> {
  return Object.freeze(
    threats.map((threat) => ({
      threat,
      urgencyClass: classifyThreatUrgency(threat, tick),
      score: scoreThreatUrgency(threat, tick),
    })),
  );
}

/** Compute the cascade exposure score for each layer. */
export function computePerLayerCascadeExposure(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): Readonly<Record<ShieldLayerId, number>> {
  const result: Record<string, number> = {};
  const modeMultiplier = CASCADE_MODE_SENSITIVITY[mode];
  const phaseMultiplier = CASCADE_PHASE_RISK_FACTOR[phase];

  for (const layer of layers) {
    const vuln = computeShieldLayerVulnerability(layer.layerId, layer.current, layer.max);
    const dangerIndex = CASCADE_LAYER_DANGER_INDEX[layer.layerId];
    const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
    result[layer.layerId] = Math.min(1.0, vuln * dangerIndex * capacityWeight * modeMultiplier * phaseMultiplier);
  }

  return Object.freeze(result) as Readonly<Record<ShieldLayerId, number>>;
}

/** Compute estimated ticks until L4 cascades given current regeneration and threats. */
export function computeTicksUntilCascade(
  layers: readonly ShieldLayerState[],
  incomingDamagePerTick: number,
  mode: ModeCode,
  phase: RunPhase,
): number {
  const l4 = layers.find((l) => l.layerId === 'L4');
  if (!l4 || l4.current <= 0) return 0;
  const config = getLayerConfig('L4');
  const regenPerTick = l4.breached ? config.breachedRegenRate : config.passiveRegenRate;
  const effectiveDamage = incomingDamagePerTick * CASCADE_MODE_SENSITIVITY[mode] * CASCADE_PHASE_RISK_FACTOR[phase];
  const netDamage = effectiveDamage - regenPerTick;
  if (netDamage <= 0) return Infinity;
  return Math.ceil(l4.current / netDamage);
}

/** Compute the cascade chain integrity ratio — how compromised the chain is. */
export function computeCascadeChainIntegrityRatio(
  cascadeCount: number,
  maxExpectedCascades: number,
): number {
  if (maxExpectedCascades <= 0) return 0;
  return Math.min(1.0, cascadeCount / maxExpectedCascades);
}

/** Compute the Sovereignty phase cascade fatality risk (0-1). */
export function computeSovereigntyFatalityRisk(
  layers: readonly ShieldLayerState[],
  phase: RunPhase,
  mode: ModeCode,
): number {
  if (!isEndgamePhase(phase)) return 0;
  const l4 = layers.find((l) => l.layerId === 'L4');
  const l4Vulnerability = l4
    ? computeShieldLayerVulnerability('L4', l4.current, l4.max)
    : 1.0;
  const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
  return Math.min(1.0, l4Vulnerability * stakes * CASCADE_MODE_SENSITIVITY[mode]);
}

/** Score the cascade pressure from bot states. */
export function scoreCascadeFromBotStates(
  botStates: Readonly<Partial<Record<HaterBotId, BotState>>>,
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): number {
  const botThreat = computeCascadeBotThreatWeight(botStates);
  const l4Vulnerability = (() => {
    const l4 = layers.find((l) => l.layerId === 'L4');
    return l4 ? computeShieldLayerVulnerability('L4', l4.current, l4.max) : 1.0;
  })();
  return Math.min(1.0, botThreat * l4Vulnerability * CASCADE_MODE_SENSITIVITY[mode] * CASCADE_PHASE_RISK_FACTOR[phase]);
}

/** Compute the absorption order exposure — which layers are next to absorb damage. */
export function computeAbsorptionOrderExposure(
  layers: readonly ShieldLayerState[],
): Readonly<Record<ShieldLayerId, number>> {
  const result: Record<string, number> = {};
  let prevBreached = false;

  for (const layerId of SHIELD_LAYER_ABSORPTION_ORDER) {
    const layer = layers.find((l) => l.layerId === layerId);
    if (!layer) {
      result[layerId] = 0;
      continue;
    }
    // Layers downstream from a breached layer carry higher exposure
    const exposureBoost = prevBreached ? 1.5 : 1.0;
    result[layerId] = Math.min(1.0,
      computeShieldLayerVulnerability(layerId, layer.current, layer.max) * exposureBoost,
    );
    if (layer.breached) prevBreached = true;
  }

  return Object.freeze(result) as Readonly<Record<ShieldLayerId, number>>;
}

/** Compute the layer order index-based priority for cascade resolution. */
export function computeLayerCascadePriority(layerId: ShieldLayerId): number {
  return (SHIELD_LAYER_ORDER.length - layerOrderIndex(layerId)) * CASCADE_LAYER_DANGER_INDEX[layerId];
}

// ============================================================================
// §15 — Session report builders
// ============================================================================

/** Full session cascade report. */
export interface CascadeSessionReport {
  readonly totalCascades: number;
  readonly l4BreachCount: number;
  readonly ghostL3CascadeCount: number;
  readonly sovereigntyFatalCount: number;
  readonly layerBreachDistribution: Partial<Record<ShieldLayerId, number>>;
  readonly modeBreachDistribution: Partial<Record<ModeCode, number>>;
  readonly phaseBreachDistribution: Partial<Record<RunPhase, number>>;
  readonly ghostEchoRate: number;
  readonly sovereigntyFatalRate: number;
  readonly cascadeSurgeCount: number;
  readonly avgRiskScore: number;
  readonly avgIntegrityDrop: number;
  readonly peakRiskEntry: CascadeHistoryEntry | null;
  readonly cascadeGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

export function buildCascadeSessionReport(
  analyticsSummary: CascadeAnalyticsSummary,
  history: readonly CascadeHistoryEntry[],
): CascadeSessionReport {
  const peakRisk = history.length > 0
    ? history.reduce((worst, h) => h.riskScore > worst.riskScore ? h : worst)
    : null;

  // Grade based on cascade management (fewer cascades = better)
  const riskScore =
    analyticsSummary.sovereigntyFatalRate * 5 +
    analyticsSummary.ghostEchoRate * 3 +
    analyticsSummary.avgRiskScore * 2;
  const cascadeGrade: CascadeSessionReport['cascadeGrade'] =
    riskScore <= 0.5 ? 'S'
    : riskScore <= 2 ? 'A'
    : riskScore <= 4 ? 'B'
    : riskScore <= 7 ? 'C'
    : riskScore <= 10 ? 'D' : 'F';

  return Object.freeze({
    totalCascades: analyticsSummary.sessionTotalCascades,
    l4BreachCount: analyticsSummary.sessionL4Breaches,
    ghostL3CascadeCount: analyticsSummary.sessionGhostL3Cascades,
    sovereigntyFatalCount: analyticsSummary.sessionSovereigntyFatals,
    layerBreachDistribution: { ...analyticsSummary.layerBreachDistribution },
    modeBreachDistribution: { ...analyticsSummary.modeBreachDistribution },
    phaseBreachDistribution: { ...analyticsSummary.phaseBreachDistribution },
    ghostEchoRate: analyticsSummary.ghostEchoRate,
    sovereigntyFatalRate: analyticsSummary.sovereigntyFatalRate,
    cascadeSurgeCount: analyticsSummary.cascadeSurgeCount,
    avgRiskScore: analyticsSummary.avgRiskScore,
    avgIntegrityDrop: analyticsSummary.avgIntegrityDrop,
    peakRiskEntry: peakRisk,
    cascadeGrade,
  });
}

/** Build a per-mode cascade profile. */
export interface CascadeModeProfile {
  readonly mode: ModeCode;
  readonly sensitivity: number;
  readonly ghostEchoEligible: boolean;
  readonly countWeight: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly modeNormalized: number;
}

export function buildCascadeModeProfile(mode: ModeCode): CascadeModeProfile {
  return Object.freeze({
    mode,
    sensitivity: CASCADE_MODE_SENSITIVITY[mode],
    ghostEchoEligible: CASCADE_GHOST_ECHO_ELIGIBLE[mode],
    countWeight: CASCADE_MODE_COUNT_WEIGHT[mode],
    difficultyMultiplier: MODE_DIFFICULTY_MULTIPLIER[mode],
    tensionFloor: MODE_TENSION_FLOOR[mode],
    modeNormalized: MODE_NORMALIZED[mode],
  });
}

/** Build a per-phase cascade profile. */
export interface CascadePhaseProfile {
  readonly phase: RunPhase;
  readonly riskFactor: number;
  readonly sovereigntyFatalEligible: boolean;
  readonly stakesMultiplier: number;
  readonly phaseNormalized: number;
  readonly isEndgame: boolean;
  readonly crackMultiplierBonus: number;
}

export function buildCascadePhaseProfile(phase: RunPhase): CascadePhaseProfile {
  return Object.freeze({
    phase,
    riskFactor: CASCADE_PHASE_RISK_FACTOR[phase],
    sovereigntyFatalEligible: CASCADE_SOVEREIGNTY_FATAL_ELIGIBLE[phase],
    stakesMultiplier: RUN_PHASE_STAKES_MULTIPLIER[phase],
    phaseNormalized: RUN_PHASE_NORMALIZED[phase],
    isEndgame: isEndgamePhase(phase),
    crackMultiplierBonus: isEndgamePhase(phase) ? CASCADE_SOVEREIGNTY_CRACK_MULTIPLIER : 1.0,
  });
}

/** Validate layer state for cascade resolver consistency. */
export function validateCascadeLayerState(layers: readonly ShieldLayerState[]): boolean {
  if (layers.length !== SHIELD_LAYER_ORDER.length) return false;
  for (const expectedId of SHIELD_LAYER_ORDER) {
    const layer = layers.find((l) => l.layerId === expectedId);
    if (!layer) return false;
    const config = SHIELD_LAYER_CONFIGS[expectedId];
    if (layer.max !== config.max) return false;
    if (layer.current < 0 || layer.current > layer.max) return false;
  }
  return true;
}

/** Compute the cascade risk grade (S-F) for a given state. */
export function gradeCascadeRisk(riskScore: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
  if (riskScore <= 1) return 'S';
  if (riskScore <= 3) return 'A';
  if (riskScore <= 5) return 'B';
  if (riskScore <= 7) return 'C';
  if (riskScore <= 9) return 'D';
  return 'F';
}

/** Compute the cascade event's impact on the broader engine run narrative. */
export function computeCascadeNarrativeImpact(
  context: CascadeResolutionContext,
  history: readonly CascadeHistoryEntry[],
): number {
  const riskNorm = context.riskScore / 10;
  const ghostBonus = context.ghostEchoFired ? 0.20 : 0;
  const fatalBonus = context.sovereigntyFatal ? 0.30 : 0;
  const surgeBonus = detectCascadeSurge(history) ? 0.15 : 0;
  const phaseBonus = CASCADE_PHASE_RISK_FACTOR[context.phase] * 0.1;
  return Math.min(1.0, riskNorm + ghostBonus + fatalBonus + surgeBonus + phaseBonus);
}

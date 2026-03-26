/*
 * POINT ZERO ONE — BACKEND SHIELD ATTACK ROUTER
 * /backend/src/game/engine/shield/AttackRouter.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - routing belongs here and nowhere else
 * - current backend primitives are category-based, so richer frontend doctrine
 *   is reconstructed from category + targetLayer hint + note tags
 * - weakest-layer attacks are computed fresh at resolution time
 * - fallback selection is deterministic and does not mutate state
 * - mode-awareness and phase-awareness drive routing weights, scoring, and ML
 * - ghost mode amplifies HATER_INJECTION threat by 2x; routed to weakest two layers
 * - SOVEREIGNTY phase escalates routing consequence — L4 routes are prioritized
 * - all ML/DL extraction is deterministic and replay-safe
 * - every import is consumed — zero TS6133 tolerance
 *
 * Sections:
 *   §1  Module constants
 *   §2  ML/DL feature label arrays
 *   §3  Mode/phase routing tables
 *   §4  Type definitions
 *   §5  Pure helper functions
 *   §6  AttackRouterMLExtractor
 *   §7  AttackRouterDLBuilder
 *   §8  AttackRouterTrendAnalyzer
 *   §9  AttackRouterAnnotator
 *   §10 AttackRouterInspector
 *   §11 AttackRouterAnalytics
 *   §12 Enhanced AttackRouter class
 *   §13 Factory & standalone helpers
 *   §14 Deep threat analytics
 *   §15 Session report builders
 */

import type {
  AttackCategory,
  AttackEvent,
  BotState,
  HaterBotId,
  ModeCode,
  PressureTier,
  RunPhase,
  ShieldLayerId,
  ThreatEnvelope,
} from '../core/GamePrimitives';

import {
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_THREAT_LEVEL,
  classifyAttackSeverity,
  classifyThreatUrgency,
  computeAggregateThreatPressure,
  computeEffectiveAttackDamage,
  computeEffectiveStakes,
  computeShieldIntegrityRatio,
  computeShieldLayerVulnerability,
  isAttackCounterable,
  isAttackFromBot,
  isEndgamePhase,
  isHaterBotId,
  isShieldTargetedAttack,
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
  type AttackSeverityClass,
  type ThreatUrgencyClass,
} from '../core/GamePrimitives';

import type { ShieldLayerState } from '../core/RunStateSnapshot';

import {
  getLayerConfig,
  layerOrderIndex,
  normalizeShieldNoteTags,
  resolveShieldAlias,
  SHIELD_CONSTANTS,
  SHIELD_LAYER_CONFIGS,
  SHIELD_LAYER_ORDER,
  type RoutedAttack,
  type ShieldDoctrineAttackType,
} from './types';

// ============================================================================
// §1 — Module constants
// ============================================================================

export const ATTACK_ROUTER_MODULE_VERSION = '2026.03.25' as const;

/** Number of ML features in AttackRouterMLVector. */
export const ATTACK_ROUTER_ML_FEATURE_COUNT = 36 as const;

/** Number of DL features per row in AttackRouterDLTensor. */
export const ATTACK_ROUTER_DL_FEATURE_COUNT = 44 as const;

/** Sequence depth for the DL tensor (ticks of routing history). */
export const ATTACK_ROUTER_DL_SEQUENCE_LENGTH = 6 as const;

/** Max routing history entries retained in memory. */
export const ATTACK_ROUTER_HISTORY_DEPTH = 48 as const;

/** Trend window for velocity/acceleration analytics. */
export const ATTACK_ROUTER_TREND_WINDOW = 6 as const;

/** Max attacks per batch before overflow signals fire. */
export const ATTACK_ROUTER_MAX_BATCH_SIZE = 16 as const;

/** Threshold for ghost-mode HATER_INJECTION amplification multiplier. */
export const ATTACK_ROUTER_GHOST_HATER_AMPLIFY = 2.0 as const;

/** L4 route risk multiplier during SOVEREIGNTY phase. */
export const ATTACK_ROUTER_SOVEREIGNTY_L4_RISK = 1.8 as const;

/** Min doctrine match confidence to skip fallback escalation. */
export const ATTACK_ROUTER_DOCTRINE_CONFIDENCE_THRESHOLD = 0.65 as const;

/** Minimum per-layer vulnerability score to consider a layer "exposed". */
export const ATTACK_ROUTER_EXPOSED_VULNERABILITY_THRESHOLD = 0.55 as const;

export const ATTACK_ROUTER_MANIFEST = Object.freeze({
  module: 'AttackRouter',
  version: ATTACK_ROUTER_MODULE_VERSION,
  mlFeatureCount: ATTACK_ROUTER_ML_FEATURE_COUNT,
  dlFeatureCount: ATTACK_ROUTER_DL_FEATURE_COUNT,
  dlSequenceLength: ATTACK_ROUTER_DL_SEQUENCE_LENGTH,
  historyDepth: ATTACK_ROUTER_HISTORY_DEPTH,
});

// ============================================================================
// §2 — ML/DL feature label arrays
// ============================================================================

export const ATTACK_ROUTER_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Batch composition (0-5)
  'batch_size_norm',
  'batch_catastrophic_ratio',
  'batch_major_ratio',
  'batch_bot_source_ratio',
  'batch_counterable_ratio',
  'batch_shield_targeted_ratio',

  // Doctrine distribution (6-13)
  'doctrine_financial_sabotage_ratio',
  'doctrine_expense_injection_ratio',
  'doctrine_debt_attack_ratio',
  'doctrine_asset_strip_ratio',
  'doctrine_reputation_attack_ratio',
  'doctrine_regulatory_attack_ratio',
  'doctrine_hater_injection_ratio',
  'doctrine_opportunity_kill_ratio',

  // Layer targeting distribution (14-17)
  'target_l1_ratio',
  'target_l2_ratio',
  'target_l3_ratio',
  'target_l4_ratio',

  // Layer vulnerability at routing time (18-21)
  'vuln_l1',
  'vuln_l2',
  'vuln_l3',
  'vuln_l4',

  // Overall shield state (22-23)
  'overall_integrity',
  'weakest_layer_integrity',

  // Mode/phase context (24-28)
  'mode_normalized',
  'phase_normalized',
  'stakes_multiplier',
  'mode_difficulty',
  'mode_tension_floor',

  // Routing risk scores (29-32)
  'max_attack_urgency',
  'avg_attack_urgency',
  'aggregate_threat_pressure',
  'l4_route_risk',

  // History trend (33-35)
  'history_breach_rate',
  'history_avg_magnitude',
  'history_doctrine_entropy',
]);

export const ATTACK_ROUTER_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Per-row batch metrics (0-5)
  'row_batch_size_norm',
  'row_catastrophic_ratio',
  'row_major_ratio',
  'row_bot_source_ratio',
  'row_counterable_ratio',
  'row_shield_targeted_ratio',

  // Per-row doctrine (6-13)
  'row_financial_sabotage',
  'row_expense_injection',
  'row_debt_attack',
  'row_asset_strip',
  'row_reputation_attack',
  'row_regulatory_attack',
  'row_hater_injection',
  'row_opportunity_kill',

  // Per-row layer targets (14-17)
  'row_target_l1',
  'row_target_l2',
  'row_target_l3',
  'row_target_l4',

  // Per-row vulnerability (18-21)
  'row_vuln_l1',
  'row_vuln_l2',
  'row_vuln_l3',
  'row_vuln_l4',

  // Per-row mode/phase (22-26)
  'row_mode_normalized',
  'row_phase_normalized',
  'row_stakes_multiplier',
  'row_mode_difficulty',
  'row_tension_floor',

  // Per-row urgency (27-30)
  'row_max_urgency',
  'row_avg_urgency',
  'row_threat_pressure',
  'row_l4_risk',

  // Per-row shield state (31-34)
  'row_overall_integrity',
  'row_weakest_integrity',
  'row_integrity_delta',
  'row_fortified',

  // Per-row history signals (35-39)
  'row_breach_flag',
  'row_bypass_deflection_count',
  'row_ghost_amplified_flag',
  'row_sovereignty_l4_flag',
  'row_doctrine_entropy',

  // Padding (40-43)
  'row_pad_0',
  'row_pad_1',
  'row_pad_2',
  'row_pad_3',
]);

// ============================================================================
// §3 — Mode/phase routing tables
// ============================================================================

/**
 * Priority weight boost per mode for sorting attacks.
 * Higher = attacks in this mode get escalated more aggressively.
 */
export const ATTACK_ROUTER_MODE_PRIORITY_WEIGHT: Readonly<Record<ModeCode, number>> = Object.freeze({
  solo: 1.0,
  pvp: 1.3,
  coop: 0.85,
  ghost: 1.65,
});

/**
 * Phase-based escalation factor for routing risk.
 * Sovereignty = highest risk — L4 routes become critical.
 */
export const ATTACK_ROUTER_PHASE_ESCALATION_FACTOR: Readonly<Record<RunPhase, number>> = Object.freeze({
  FOUNDATION: 0.70,
  ESCALATION: 1.0,
  SOVEREIGNTY: 1.45,
});

/**
 * Whether ghost-mode HATER_INJECTION attacks target the two weakest layers
 * with a full threat amplification (vs canonical single-weakest routing).
 */
export const ATTACK_ROUTER_GHOST_DUAL_TARGET: Readonly<Record<ModeCode, boolean>> = Object.freeze({
  solo: false,
  pvp: false,
  coop: false,
  ghost: true,
});

/**
 * Whether the phase permits override of canonical layer routing by hint.
 * SOVEREIGNTY locks routing to doctrine-canonical paths for determinism.
 */
export const ATTACK_ROUTER_PHASE_HINT_ELIGIBLE: Readonly<Record<RunPhase, boolean>> = Object.freeze({
  FOUNDATION: true,
  ESCALATION: true,
  SOVEREIGNTY: false,
});

/**
 * Per-mode maximum batch size before overflow is flagged.
 */
export const ATTACK_ROUTER_MODE_MAX_BATCH: Readonly<Record<ModeCode, number>> = Object.freeze({
  solo: 8,
  pvp: 12,
  coop: 10,
  ghost: 16,
});

/**
 * Doctrine type normalized 0-1 danger index.
 */
export const ATTACK_DOCTRINE_DANGER_INDEX: Readonly<Record<ShieldDoctrineAttackType, number>> = Object.freeze({
  FINANCIAL_SABOTAGE: 0.7,
  EXPENSE_INJECTION: 0.55,
  DEBT_ATTACK: 0.65,
  ASSET_STRIP: 0.75,
  REPUTATION_ATTACK: 0.60,
  REGULATORY_ATTACK: 0.80,
  HATER_INJECTION: 0.85,
  OPPORTUNITY_KILL: 0.50,
});

/**
 * Whether a doctrine type is considered a cascade gate risk.
 * These doctrines targeting L4 should be elevated.
 */
export const ATTACK_DOCTRINE_IS_CASCADE_RISK: Readonly<Record<ShieldDoctrineAttackType, boolean>> = Object.freeze({
  FINANCIAL_SABOTAGE: false,
  EXPENSE_INJECTION: false,
  DEBT_ATTACK: false,
  ASSET_STRIP: false,
  REPUTATION_ATTACK: true,
  REGULATORY_ATTACK: true,
  HATER_INJECTION: true,
  OPPORTUNITY_KILL: false,
});

/**
 * Pressure tier weight for urgency boost in routing prioritization.
 */
export const ATTACK_ROUTER_PRESSURE_TIER_URGENCY: Readonly<Record<PressureTier, number>> = Object.freeze({
  T0: 0.5,
  T1: 0.65,
  T2: 0.80,
  T3: 0.92,
  T4: 1.0,
});

// ============================================================================
// §4 — Type definitions
// ============================================================================

/** Extended routing decision with mode/phase context and risk scoring. */
export interface AttackRouteDecision {
  readonly routed: RoutedAttack;
  readonly effectiveTarget: ShieldLayerId;
  readonly severityClass: AttackSeverityClass;
  readonly urgencyScore: number;
  readonly doctrineConfidence: number;
  readonly l4CascadeRisk: boolean;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly modeAmplified: boolean;
  readonly sovereigntyEscalated: boolean;
  readonly tick: number;
}

/** Batch result from ordering + routing multiple attacks together. */
export interface AttackRouterBatchResult {
  readonly decisions: readonly AttackRouteDecision[];
  readonly totalDamageEstimate: number;
  readonly maxSeverity: AttackSeverityClass;
  readonly l4CascadeRiskCount: number;
  readonly doctrineBreakdown: Readonly<Record<ShieldDoctrineAttackType, number>>;
  readonly overflowFlagged: boolean;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
}

/** ML feature vector — 36 float features per routing context. */
export interface AttackRouterMLVector {
  // Batch composition
  readonly batch_size_norm: number;
  readonly batch_catastrophic_ratio: number;
  readonly batch_major_ratio: number;
  readonly batch_bot_source_ratio: number;
  readonly batch_counterable_ratio: number;
  readonly batch_shield_targeted_ratio: number;

  // Doctrine distribution
  readonly doctrine_financial_sabotage_ratio: number;
  readonly doctrine_expense_injection_ratio: number;
  readonly doctrine_debt_attack_ratio: number;
  readonly doctrine_asset_strip_ratio: number;
  readonly doctrine_reputation_attack_ratio: number;
  readonly doctrine_regulatory_attack_ratio: number;
  readonly doctrine_hater_injection_ratio: number;
  readonly doctrine_opportunity_kill_ratio: number;

  // Layer targeting distribution
  readonly target_l1_ratio: number;
  readonly target_l2_ratio: number;
  readonly target_l3_ratio: number;
  readonly target_l4_ratio: number;

  // Layer vulnerability
  readonly vuln_l1: number;
  readonly vuln_l2: number;
  readonly vuln_l3: number;
  readonly vuln_l4: number;

  // Shield state
  readonly overall_integrity: number;
  readonly weakest_layer_integrity: number;

  // Mode/phase context
  readonly mode_normalized: number;
  readonly phase_normalized: number;
  readonly stakes_multiplier: number;
  readonly mode_difficulty: number;
  readonly mode_tension_floor: number;

  // Routing risk
  readonly max_attack_urgency: number;
  readonly avg_attack_urgency: number;
  readonly aggregate_threat_pressure: number;
  readonly l4_route_risk: number;

  // History trend
  readonly history_breach_rate: number;
  readonly history_avg_magnitude: number;
  readonly history_doctrine_entropy: number;
}

/** DL tensor — 44 features × 6-tick sequence. */
export interface AttackRouterDLTensor {
  readonly sequence: ReadonlyArray<Readonly<Record<string, number>>>;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
}

/** Trend summary from routing history analysis. */
export interface AttackRouterTrendSummary {
  readonly doctrineVelocity: Partial<Record<ShieldDoctrineAttackType, number>>;
  readonly urgencyVelocity: number;
  readonly l4RiskVelocity: number;
  readonly magnitudeTrend: 'RISING' | 'STABLE' | 'FALLING';
  readonly dominantDoctrine: ShieldDoctrineAttackType | null;
  readonly hasEscalationPattern: boolean;
  readonly ghostAmplificationActive: boolean;
  readonly sovereigntyPressureActive: boolean;
}

/** Annotation bundle for a routing decision batch. */
export interface AttackRouterAnnotationBundle {
  readonly summary: string;
  readonly severityLabel: string;
  readonly riskLabel: string;
  readonly modeContext: string;
  readonly phaseContext: string;
  readonly dominantDoctrineNote: string;
  readonly l4CascadeWarning: string | null;
  readonly uxHint: string;
  readonly urgencyLevel: ThreatUrgencyClass;
}

/** UX hint for companion/NPC systems based on routing state. */
export interface AttackRouterUXHint {
  readonly priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIENT';
  readonly channel: 'COMBAT' | 'ALERT' | 'COMMENTARY' | 'AMBIENT';
  readonly headline: string;
  readonly detail: string;
  readonly actionSuggestion: string | null;
  readonly suppressIfPressureBelow: number;
}

/** Single history entry recording one batch of routing decisions. */
export interface AttackRouterHistoryEntry {
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly batchSize: number;
  readonly l4CascadeRiskCount: number;
  readonly maxSeverity: AttackSeverityClass;
  readonly totalDamageEstimate: number;
  readonly dominantDoctrine: ShieldDoctrineAttackType | null;
  readonly overallIntegrity: number;
  readonly ghostAmplifiedCount: number;
  readonly sovereigntyEscalatedCount: number;
}

/** Full inspector state for debugging and observability. */
export interface AttackRouterInspectorState {
  readonly totalBatchesProcessed: number;
  readonly totalAttacksRouted: number;
  readonly totalL4CascadeRisks: number;
  readonly totalGhostAmplified: number;
  readonly totalSovereigntyEscalated: number;
  readonly dominantDoctrineAllTime: ShieldDoctrineAttackType | null;
  readonly avgBatchSize: number;
  readonly avgUrgencyScore: number;
  readonly recentHistory: readonly AttackRouterHistoryEntry[];
  readonly lastMLVector: AttackRouterMLVector | null;
  readonly lastTrendSummary: AttackRouterTrendSummary | null;
}

/** Analytics summary for session-level reporting. */
export interface AttackRouterAnalyticsSummary {
  readonly sessionTotalAttacks: number;
  readonly sessionTotalBatches: number;
  readonly doctrineDistribution: Partial<Record<ShieldDoctrineAttackType, number>>;
  readonly severityDistribution: Partial<Record<AttackSeverityClass, number>>;
  readonly targetLayerDistribution: Partial<Record<ShieldLayerId, number>>;
  readonly ghostAmplificationRate: number;
  readonly sovereigntyEscalationRate: number;
  readonly l4CascadeRiskRate: number;
  readonly avgUrgencyScore: number;
  readonly avgBatchThreatPressure: number;
}

/** Full ensemble returned by createAttackRouterWithAnalytics(). */
export interface AttackRouterEnsemble {
  readonly router: AttackRouter;
  readonly mlExtractor: AttackRouterMLExtractor;
  readonly dlBuilder: AttackRouterDLBuilder;
  readonly trendAnalyzer: AttackRouterTrendAnalyzer;
  readonly annotator: AttackRouterAnnotator;
  readonly inspector: AttackRouterInspector;
  readonly analytics: AttackRouterAnalytics;
}

/** Parameters for extracting ML features. */
export interface AttackRouterMLFeaturesParams {
  readonly decisions: readonly AttackRouteDecision[];
  readonly layers: readonly ShieldLayerState[];
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tick: number;
  readonly history: readonly AttackRouterHistoryEntry[];
  readonly threats?: readonly ThreatEnvelope[];
}

/** Parameters for building a DL row. */
export interface AttackRouterDLRowParams {
  readonly decisions: readonly AttackRouteDecision[];
  readonly layers: readonly ShieldLayerState[];
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tick: number;
  readonly prevOverallIntegrity?: number;
}

// ============================================================================
// §5 — Pure helper functions
// ============================================================================

/** Compute normalized batch size (0-1). */
export function normalizeBatchSize(
  batchSize: number,
  mode: ModeCode,
): number {
  const maxBatch = ATTACK_ROUTER_MODE_MAX_BATCH[mode];
  return Math.min(1.0, batchSize / maxBatch);
}

/** Compute layer vulnerability for routing analytics. */
export function computeLayerVulnerabilities(
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

/** Map layers to integrity ratio format required by computeShieldIntegrityRatio. */
export function mapLayersForIntegrity(
  layers: readonly ShieldLayerState[],
): ReadonlyArray<{ id: ShieldLayerId; current: number; max: number }> {
  return layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max }));
}

/** Score the overall routing risk for an L4 route given mode and phase. */
export function scoreL4RouteRisk(
  mode: ModeCode,
  phase: RunPhase,
  l4Integrity: number,
): number {
  const modeMultiplier = ATTACK_ROUTER_MODE_PRIORITY_WEIGHT[mode];
  const phaseMultiplier = ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[phase];
  const vulnerabilityFactor = Math.max(0, 1.0 - l4Integrity);
  const sovereigntyBonus = isEndgamePhase(phase) ? ATTACK_ROUTER_SOVEREIGNTY_L4_RISK : 1.0;
  return Math.min(1.0, modeMultiplier * phaseMultiplier * vulnerabilityFactor * sovereigntyBonus * 0.6);
}

/** Compute the doctrine confidence score for a routing decision. */
export function computeDoctrineConfidence(
  attack: AttackEvent,
  noteTags: readonly string[],
  doctrineType: ShieldDoctrineAttackType,
): number {
  // Full confidence if an alias directly resolved
  const aliasResolved = resolveShieldAlias(noteTags) !== null;
  if (aliasResolved) return 1.0;

  // High confidence if category maps canonically
  const categoryDoctrineMap: Readonly<Record<AttackCategory, ShieldDoctrineAttackType>> = {
    EXTRACTION: 'FINANCIAL_SABOTAGE',
    DRAIN: 'EXPENSE_INJECTION',
    DEBT: 'DEBT_ATTACK',
    LOCK: 'ASSET_STRIP',
    BREACH: 'REPUTATION_ATTACK',
    HEAT: 'HATER_INJECTION',
  };

  const canonical = categoryDoctrineMap[attack.category];
  if (canonical === doctrineType) return 0.88;

  // Medium confidence: targetLayer hint provided
  if (attack.targetLayer !== 'DIRECT') return 0.72;

  // Low confidence: fallback logic
  return 0.52;
}

/** Compute entropy of doctrine distribution (0-1). Higher = more varied. */
export function computeDoctrineEntropy(
  doctrineBreakdown: Partial<Record<ShieldDoctrineAttackType, number>>,
): number {
  const entries = Object.values(doctrineBreakdown).filter((v) => v !== undefined && v > 0);
  if (entries.length === 0) return 0;
  const total = entries.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  let entropy = 0;
  for (const count of entries) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(8); // 8 doctrine types
  return Math.min(1.0, entropy / maxEntropy);
}

/** Find dominant doctrine from a breakdown record. */
export function findDominantDoctrine(
  breakdown: Partial<Record<ShieldDoctrineAttackType, number>>,
): ShieldDoctrineAttackType | null {
  let maxCount = 0;
  let dominant: ShieldDoctrineAttackType | null = null;

  for (const [doctrine, count] of Object.entries(breakdown)) {
    if ((count ?? 0) > maxCount) {
      maxCount = count ?? 0;
      dominant = doctrine as ShieldDoctrineAttackType;
    }
  }
  return dominant;
}

/** Build a doctrine breakdown from an array of routing decisions. */
export function buildDoctrineBreakdown(
  decisions: readonly AttackRouteDecision[],
): Partial<Record<ShieldDoctrineAttackType, number>> {
  const breakdown: Partial<Record<ShieldDoctrineAttackType, number>> = {};
  for (const d of decisions) {
    const doc = d.routed.doctrineType;
    breakdown[doc] = (breakdown[doc] ?? 0) + 1;
  }
  return breakdown;
}

/** Build a target layer breakdown from routing decisions. */
export function buildTargetLayerBreakdown(
  decisions: readonly AttackRouteDecision[],
): Partial<Record<ShieldLayerId, number>> {
  const breakdown: Partial<Record<ShieldLayerId, number>> = {};
  for (const d of decisions) {
    const layer = d.routed.targetLayer;
    breakdown[layer] = (breakdown[layer] ?? 0) + 1;
  }
  return breakdown;
}

/** Compute the severity class distribution from routing decisions. */
export function buildSeverityBreakdown(
  decisions: readonly AttackRouteDecision[],
): Partial<Record<AttackSeverityClass, number>> {
  const breakdown: Partial<Record<AttackSeverityClass, number>> = {};
  for (const d of decisions) {
    breakdown[d.severityClass] = (breakdown[d.severityClass] ?? 0) + 1;
  }
  return breakdown;
}

/** Extract ML feature vector from a batch of routing decisions. */
export function extractAttackRouterMLFeatures(
  params: AttackRouterMLFeaturesParams,
): AttackRouterMLVector {
  const { decisions, layers, mode, phase, tick, history, threats = [] } = params;
  const n = decisions.length;
  const safeN = n === 0 ? 1 : n;

  // Batch composition
  const catastrophicCount = decisions.filter((d) => d.severityClass === 'CATASTROPHIC').length;
  const majorCount = decisions.filter((d) => d.severityClass === 'MAJOR').length;
  const botSourceCount = decisions.filter((d) => isHaterBotId(d.routed.source)).length;
  const counterableCount = decisions.filter((d) => ATTACK_CATEGORY_IS_COUNTERABLE[d.routed.category]).length;
  const shieldTargetedCount = decisions.filter((d) => d.routed.requestedLayer !== 'DIRECT').length;

  // Doctrine distribution
  const docBreakdown = buildDoctrineBreakdown(decisions);
  const targetBreakdown = buildTargetLayerBreakdown(decisions);

  // Vulnerabilities
  const vulns = computeLayerVulnerabilities(layers);
  const mappedLayers = mapLayersForIntegrity(layers);
  const overallIntegrity = computeShieldIntegrityRatio(mappedLayers);
  const weakestIntegrity = Math.min(...layers.map((l) => l.integrityRatio));

  // Urgency scores
  const urgencyScores = decisions.map((d) => d.urgencyScore);
  const maxUrgency = urgencyScores.length > 0 ? Math.max(...urgencyScores) : 0;
  const avgUrgency = urgencyScores.length > 0
    ? urgencyScores.reduce((a, b) => a + b, 0) / urgencyScores.length
    : 0;

  // Threat pressure from threat envelopes
  const aggregateThreatPressure = computeAggregateThreatPressure(threats, tick);

  // L4 route risk
  const l4Layer = layers.find((l) => l.layerId === 'L4');
  const l4RouteRisk = scoreL4RouteRisk(mode, phase, l4Layer?.integrityRatio ?? 1.0);

  // History analytics
  const historyBreachRate = history.length > 0
    ? history.filter((h) => h.l4CascadeRiskCount > 0).length / history.length
    : 0;
  const historyAvgMagnitude = history.length > 0
    ? history.reduce((a, b) => a + b.totalDamageEstimate, 0) / history.length / 100
    : 0;
  const historyDoctrineEntropy = computeDoctrineEntropy(
    history.reduce((acc, h) => {
      if (h.dominantDoctrine) acc[h.dominantDoctrine] = (acc[h.dominantDoctrine] ?? 0) + 1;
      return acc;
    }, {} as Partial<Record<ShieldDoctrineAttackType, number>>),
  );

  return Object.freeze({
    batch_size_norm: normalizeBatchSize(n, mode),
    batch_catastrophic_ratio: catastrophicCount / safeN,
    batch_major_ratio: majorCount / safeN,
    batch_bot_source_ratio: botSourceCount / safeN,
    batch_counterable_ratio: counterableCount / safeN,
    batch_shield_targeted_ratio: shieldTargetedCount / safeN,

    doctrine_financial_sabotage_ratio: (docBreakdown.FINANCIAL_SABOTAGE ?? 0) / safeN,
    doctrine_expense_injection_ratio: (docBreakdown.EXPENSE_INJECTION ?? 0) / safeN,
    doctrine_debt_attack_ratio: (docBreakdown.DEBT_ATTACK ?? 0) / safeN,
    doctrine_asset_strip_ratio: (docBreakdown.ASSET_STRIP ?? 0) / safeN,
    doctrine_reputation_attack_ratio: (docBreakdown.REPUTATION_ATTACK ?? 0) / safeN,
    doctrine_regulatory_attack_ratio: (docBreakdown.REGULATORY_ATTACK ?? 0) / safeN,
    doctrine_hater_injection_ratio: (docBreakdown.HATER_INJECTION ?? 0) / safeN,
    doctrine_opportunity_kill_ratio: (docBreakdown.OPPORTUNITY_KILL ?? 0) / safeN,

    target_l1_ratio: (targetBreakdown.L1 ?? 0) / safeN,
    target_l2_ratio: (targetBreakdown.L2 ?? 0) / safeN,
    target_l3_ratio: (targetBreakdown.L3 ?? 0) / safeN,
    target_l4_ratio: (targetBreakdown.L4 ?? 0) / safeN,

    vuln_l1: vulns.L1 ?? 0,
    vuln_l2: vulns.L2 ?? 0,
    vuln_l3: vulns.L3 ?? 0,
    vuln_l4: vulns.L4 ?? 0,

    overall_integrity: overallIntegrity,
    weakest_layer_integrity: isFinite(weakestIntegrity) ? weakestIntegrity : 0,

    mode_normalized: MODE_NORMALIZED[mode],
    phase_normalized: RUN_PHASE_NORMALIZED[phase],
    stakes_multiplier: computeEffectiveStakes(phase, mode),
    mode_difficulty: MODE_DIFFICULTY_MULTIPLIER[mode],
    mode_tension_floor: MODE_TENSION_FLOOR[mode],

    max_attack_urgency: maxUrgency,
    avg_attack_urgency: avgUrgency,
    aggregate_threat_pressure: aggregateThreatPressure,
    l4_route_risk: l4RouteRisk,

    history_breach_rate: historyBreachRate,
    history_avg_magnitude: Math.min(1.0, historyAvgMagnitude),
    history_doctrine_entropy: historyDoctrineEntropy,
  });
}

/** Build a single DL row (44 features). */
export function buildAttackRouterDLRow(params: AttackRouterDLRowParams): Readonly<Record<string, number>> {
  const { decisions, layers, mode, phase, tick, prevOverallIntegrity } = params;
  const n = decisions.length;
  const safeN = n === 0 ? 1 : n;

  const docBreakdown = buildDoctrineBreakdown(decisions);
  const targetBreakdown = buildTargetLayerBreakdown(decisions);
  const vulns = computeLayerVulnerabilities(layers);
  const mappedLayers = mapLayersForIntegrity(layers);
  const overallIntegrity = computeShieldIntegrityRatio(mappedLayers);
  const weakestIntegrity = layers.length > 0 ? Math.min(...layers.map((l) => l.integrityRatio)) : 0;
  const prevIntegrity = prevOverallIntegrity ?? overallIntegrity;
  const integDelta = overallIntegrity - prevIntegrity;

  const urgencyScores = decisions.map((d) => d.urgencyScore);
  const maxUrgency = urgencyScores.length > 0 ? Math.max(...urgencyScores) : 0;
  const avgUrgency = urgencyScores.length > 0
    ? urgencyScores.reduce((a, b) => a + b, 0) / urgencyScores.length
    : 0;

  const ghostCount = decisions.filter((d) => d.modeAmplified).length;
  const sovereigntyCount = decisions.filter((d) => d.sovereigntyEscalated).length;
  const bypassCount = decisions.filter((d) => d.routed.bypassDeflection).length;
  const l4RiskCount = decisions.filter((d) => d.l4CascadeRisk).length;

  const catastrophicCount = decisions.filter((d) => d.severityClass === 'CATASTROPHIC').length;
  const majorCount = decisions.filter((d) => d.severityClass === 'MAJOR').length;
  const botCount = decisions.filter((d) => isHaterBotId(d.routed.source)).length;
  const counterableCount = decisions.filter((d) => ATTACK_CATEGORY_IS_COUNTERABLE[d.routed.category]).length;
  const shieldTargetedCount = decisions.filter((d) => d.routed.requestedLayer !== 'DIRECT').length;
  const docEntropy = computeDoctrineEntropy(docBreakdown);

  const l4Layer = layers.find((l) => l.layerId === 'L4');
  const l4Risk = scoreL4RouteRisk(mode, phase, l4Layer?.integrityRatio ?? 1.0);
  const isFortified = layers.every((l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD);
  const stakes = computeEffectiveStakes(phase, mode);
  const tensionFloor = MODE_TENSION_FLOOR[mode];

  const row: Record<string, number> = {
    row_batch_size_norm: normalizeBatchSize(n, mode),
    row_catastrophic_ratio: catastrophicCount / safeN,
    row_major_ratio: majorCount / safeN,
    row_bot_source_ratio: botCount / safeN,
    row_counterable_ratio: counterableCount / safeN,
    row_shield_targeted_ratio: shieldTargetedCount / safeN,

    row_financial_sabotage: (docBreakdown.FINANCIAL_SABOTAGE ?? 0) / safeN,
    row_expense_injection: (docBreakdown.EXPENSE_INJECTION ?? 0) / safeN,
    row_debt_attack: (docBreakdown.DEBT_ATTACK ?? 0) / safeN,
    row_asset_strip: (docBreakdown.ASSET_STRIP ?? 0) / safeN,
    row_reputation_attack: (docBreakdown.REPUTATION_ATTACK ?? 0) / safeN,
    row_regulatory_attack: (docBreakdown.REGULATORY_ATTACK ?? 0) / safeN,
    row_hater_injection: (docBreakdown.HATER_INJECTION ?? 0) / safeN,
    row_opportunity_kill: (docBreakdown.OPPORTUNITY_KILL ?? 0) / safeN,

    row_target_l1: (targetBreakdown.L1 ?? 0) / safeN,
    row_target_l2: (targetBreakdown.L2 ?? 0) / safeN,
    row_target_l3: (targetBreakdown.L3 ?? 0) / safeN,
    row_target_l4: (targetBreakdown.L4 ?? 0) / safeN,

    row_vuln_l1: vulns.L1 ?? 0,
    row_vuln_l2: vulns.L2 ?? 0,
    row_vuln_l3: vulns.L3 ?? 0,
    row_vuln_l4: vulns.L4 ?? 0,

    row_mode_normalized: MODE_NORMALIZED[mode],
    row_phase_normalized: RUN_PHASE_NORMALIZED[phase],
    row_stakes_multiplier: stakes,
    row_mode_difficulty: MODE_DIFFICULTY_MULTIPLIER[mode],
    row_tension_floor: tensionFloor,

    row_max_urgency: maxUrgency,
    row_avg_urgency: avgUrgency,
    row_threat_pressure: Math.min(1.0, (l4RiskCount / safeN) * l4Risk),
    row_l4_risk: l4Risk,

    row_overall_integrity: overallIntegrity,
    row_weakest_integrity: isFinite(weakestIntegrity) ? weakestIntegrity : 0,
    row_integrity_delta: Math.max(-1.0, Math.min(1.0, integDelta)),
    row_fortified: isFortified ? 1 : 0,

    row_breach_flag: l4RiskCount > 0 ? 1 : 0,
    row_bypass_deflection_count: Math.min(1.0, bypassCount / safeN),
    row_ghost_amplified_flag: ghostCount > 0 ? 1 : 0,
    row_sovereignty_l4_flag: sovereigntyCount > 0 ? 1 : 0,
    row_doctrine_entropy: docEntropy,

    row_pad_0: 0,
    row_pad_1: 0,
    row_pad_2: tick / 1000,
    row_pad_3: 0,
  };

  return Object.freeze(row);
}

/** Build a trend summary from routing history. */
export function buildAttackRouterTrendSummary(
  history: readonly AttackRouterHistoryEntry[],
  currentDecisions: readonly AttackRouteDecision[],
  mode: ModeCode,
  phase: RunPhase,
): AttackRouterTrendSummary {
  const window = history.slice(-ATTACK_ROUTER_TREND_WINDOW);

  // Urgency velocity
  const urgencyValues = window.map((h) => h.totalDamageEstimate / 100);
  const urgencyVelocity = urgencyValues.length >= 2
    ? urgencyValues[urgencyValues.length - 1] - urgencyValues[0]
    : 0;

  // L4 risk velocity
  const l4Values = window.map((h) => h.l4CascadeRiskCount);
  const l4RiskVelocity = l4Values.length >= 2 ? l4Values[l4Values.length - 1] - l4Values[0] : 0;

  // Magnitude trend
  const magnitudes = window.map((h) => h.totalDamageEstimate);
  const magnitudeTrend: AttackRouterTrendSummary['magnitudeTrend'] =
    magnitudes.length < 2 ? 'STABLE'
    : magnitudes[magnitudes.length - 1] > magnitudes[0] * 1.1 ? 'RISING'
    : magnitudes[magnitudes.length - 1] < magnitudes[0] * 0.9 ? 'FALLING'
    : 'STABLE';

  // Doctrine velocity
  const doctrineVelocity: Partial<Record<ShieldDoctrineAttackType, number>> = {};
  const allDoctrineTypes: ShieldDoctrineAttackType[] = [
    'FINANCIAL_SABOTAGE', 'EXPENSE_INJECTION', 'DEBT_ATTACK', 'ASSET_STRIP',
    'REPUTATION_ATTACK', 'REGULATORY_ATTACK', 'HATER_INJECTION', 'OPPORTUNITY_KILL',
  ];
  for (const docType of allDoctrineTypes) {
    const counts = window.map((h) => h.dominantDoctrine === docType ? 1 : 0);
    (doctrineVelocity as Record<string, number>)[docType] = counts.reduce<number>((a, b) => a + b, 0) / Math.max(1, window.length);
  }

  // Dominant doctrine across all current decisions
  const breakdown = buildDoctrineBreakdown(currentDecisions);
  const dominantDoctrine = findDominantDoctrine(breakdown);

  return Object.freeze({
    doctrineVelocity,
    urgencyVelocity,
    l4RiskVelocity,
    magnitudeTrend,
    dominantDoctrine,
    hasEscalationPattern: l4RiskVelocity > 0 && magnitudeTrend === 'RISING',
    ghostAmplificationActive: mode === 'ghost' && currentDecisions.some((d) => d.modeAmplified),
    sovereigntyPressureActive: isEndgamePhase(phase) && currentDecisions.some((d) => d.sovereigntyEscalated),
  });
}

/** Build annotation bundle from a batch of routing decisions. */
export function buildAttackRouterAnnotation(
  decisions: readonly AttackRouteDecision[],
  layers: readonly ShieldLayerState[],
  trend: AttackRouterTrendSummary,
  mode: ModeCode,
  phase: RunPhase,
): AttackRouterAnnotationBundle {
  const n = decisions.length;
  const l4Count = decisions.filter((d) => d.l4CascadeRisk).length;
  const maxSeverityDecision = decisions.reduce((best, d) => {
    const severityOrder: Record<AttackSeverityClass, number> = {
      CATASTROPHIC: 3, MAJOR: 2, MODERATE: 1, MINOR: 0,
    };
    return (severityOrder[d.severityClass] > severityOrder[best.severityClass]) ? d : best;
  }, decisions[0] ?? { severityClass: 'MINOR' as AttackSeverityClass, urgencyScore: 0, routed: { doctrineType: 'FINANCIAL_SABOTAGE' as ShieldDoctrineAttackType } });

  const overallIntegrity = computeShieldIntegrityRatio(mapLayersForIntegrity(layers));
  const urgencyScores = decisions.map((d) => d.urgencyScore);
  const maxUrgency = urgencyScores.length > 0 ? Math.max(...urgencyScores) : 0;
  const urgencyClass: ThreatUrgencyClass =
    maxUrgency >= 0.9 ? 'CRITICAL' : maxUrgency >= 0.7 ? 'HIGH' : maxUrgency >= 0.45 ? 'MEDIUM' : maxUrgency >= 0.2 ? 'LOW' : 'NEGLIGIBLE';

  const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];

  return Object.freeze({
    summary: `${n} attack(s) routed — max severity: ${maxSeverityDecision.severityClass}, L4 cascade risks: ${l4Count}`,
    severityLabel: maxSeverityDecision.severityClass,
    riskLabel: l4Count > 0 ? 'CASCADE_RISK' : overallIntegrity < 0.3 ? 'CRITICAL_INTEGRITY' : 'STABLE',
    modeContext: `Mode: ${mode} (difficulty: ${MODE_DIFFICULTY_MULTIPLIER[mode].toFixed(2)}, ghost-amplified: ${mode === 'ghost'})`,
    phaseContext: `Phase: ${phase} (stakes: ${stakes.toFixed(2)}, endgame: ${isEndgamePhase(phase)})`,
    dominantDoctrineNote: trend.dominantDoctrine !== null
      ? `Dominant: ${trend.dominantDoctrine} — danger: ${ATTACK_DOCTRINE_DANGER_INDEX[trend.dominantDoctrine].toFixed(2)}`
      : 'No dominant doctrine',
    l4CascadeWarning: l4Count > 0
      ? `${l4Count} attack(s) targeting L4 cascade gate — NETWORK_CORE at risk`
      : null,
    uxHint: urgencyClass === 'CRITICAL' ? 'Immediate defensive card required' :
             urgencyClass === 'HIGH' ? 'Shield reinforcement recommended' :
             urgencyClass === 'MEDIUM' ? 'Monitor L4 integrity' : 'Routine attack activity',
    urgencyLevel: urgencyClass,
  });
}

/** Build a UX hint for companion systems. */
export function buildAttackRouterUXHint(
  decisions: readonly AttackRouteDecision[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): AttackRouterUXHint {
  const l4Count = decisions.filter((d) => d.l4CascadeRisk).length;
  const catastrophicCount = decisions.filter((d) => d.severityClass === 'CATASTROPHIC').length;
  const overallIntegrity = computeShieldIntegrityRatio(mapLayersForIntegrity(layers));
  const tierWeight = ATTACK_ROUTER_PRESSURE_TIER_URGENCY[pressureTier];
  const modeWeight = ATTACK_ROUTER_MODE_PRIORITY_WEIGHT[mode];
  const phaseWeight = ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[phase];
  const urgencyComposite = Math.min(1.0, (l4Count > 0 ? 0.4 : 0) + catastrophicCount * 0.3 + tierWeight * 0.3) * modeWeight * phaseWeight;

  const priority: AttackRouterUXHint['priority'] =
    urgencyComposite >= 0.8 ? 'CRITICAL'
    : urgencyComposite >= 0.6 ? 'HIGH'
    : urgencyComposite >= 0.4 ? 'MEDIUM'
    : urgencyComposite >= 0.2 ? 'LOW' : 'AMBIENT';

  const channel: AttackRouterUXHint['channel'] =
    l4Count > 0 ? 'COMBAT'
    : catastrophicCount > 0 ? 'ALERT'
    : urgencyComposite >= 0.5 ? 'COMMENTARY' : 'AMBIENT';

  const label = SHIELD_LAYER_LABEL_BY_ID['L4'];

  return Object.freeze({
    priority,
    channel,
    headline: l4Count > 0
      ? `${label} under attack — cascade imminent`
      : catastrophicCount > 0
        ? `Catastrophic attack detected — shield integrity at ${(overallIntegrity * 100).toFixed(0)}%`
        : `${decisions.length} attack(s) routed — monitoring shield`,
    detail: `Phase: ${phase}, Mode: ${mode}, L4 risks: ${l4Count}, overall integrity: ${(overallIntegrity * 100).toFixed(0)}%`,
    actionSuggestion: l4Count > 0 ? 'Play a COUNTER or RESCUE card to prevent cascade' :
                       overallIntegrity < 0.3 ? 'Repair shield layers immediately' : null,
    suppressIfPressureBelow: PRESSURE_TIER_NORMALIZED['T1'],
  });
}

/** Build a history entry for a completed batch. */
export function buildAttackRouterHistoryEntry(
  decisions: readonly AttackRouteDecision[],
  layers: readonly ShieldLayerState[],
  tick: number,
  mode: ModeCode,
  phase: RunPhase,
): AttackRouterHistoryEntry {
  const docBreakdown = buildDoctrineBreakdown(decisions);
  const totalDamage = decisions.reduce((sum, d) => sum + d.routed.magnitude * ATTACK_CATEGORY_BASE_MAGNITUDE[d.routed.category], 0);

  return Object.freeze({
    tick,
    mode,
    phase,
    batchSize: decisions.length,
    l4CascadeRiskCount: decisions.filter((d) => d.l4CascadeRisk).length,
    maxSeverity: decisions.reduce<AttackSeverityClass>((worst, d) => {
      const order: Record<AttackSeverityClass, number> = { CATASTROPHIC: 3, MAJOR: 2, MODERATE: 1, MINOR: 0 };
      return order[d.severityClass] > order[worst] ? d.severityClass : worst;
    }, 'MINOR'),
    totalDamageEstimate: totalDamage,
    dominantDoctrine: findDominantDoctrine(docBreakdown),
    overallIntegrity: computeShieldIntegrityRatio(mapLayersForIntegrity(layers)),
    ghostAmplifiedCount: decisions.filter((d) => d.modeAmplified).length,
    sovereigntyEscalatedCount: decisions.filter((d) => d.sovereigntyEscalated).length,
  });
}

// ============================================================================
// §6 — AttackRouterMLExtractor
// ============================================================================

/** Extracts and caches ML feature vectors from routing batches. */
export class AttackRouterMLExtractor {
  private lastVector: AttackRouterMLVector | null = null;
  private vectorHistory: AttackRouterMLVector[] = [];

  public extract(params: AttackRouterMLFeaturesParams): AttackRouterMLVector {
    const vec = extractAttackRouterMLFeatures(params);
    this.lastVector = vec;
    this.vectorHistory = [...this.vectorHistory.slice(-ATTACK_ROUTER_HISTORY_DEPTH + 1), vec];
    return vec;
  }

  public getLastVector(): AttackRouterMLVector | null {
    return this.lastVector;
  }

  public getVectorHistory(): readonly AttackRouterMLVector[] {
    return Object.freeze([...this.vectorHistory]);
  }

  /** Compute average ML vector across history window. */
  public computeRollingAverage(windowSize: number = ATTACK_ROUTER_TREND_WINDOW): Partial<AttackRouterMLVector> {
    const window = this.vectorHistory.slice(-windowSize);
    if (window.length === 0) return {};

    const keys = Object.keys(window[0]) as (keyof AttackRouterMLVector)[];
    const avg: Partial<Record<keyof AttackRouterMLVector, number>> = {};
    for (const key of keys) {
      avg[key] = window.reduce((sum, v) => sum + (v[key] as number), 0) / window.length;
    }
    return avg as Partial<AttackRouterMLVector>;
  }

  /** Score the routing threat level from the last ML vector (0-1). */
  public scoreThreatLevel(): number {
    if (!this.lastVector) return 0;
    const v = this.lastVector;
    return Math.min(1.0,
      v.l4_route_risk * 0.35 +
      v.batch_catastrophic_ratio * 0.25 +
      v.aggregate_threat_pressure * 0.20 +
      v.vuln_l4 * 0.15 +
      v.history_breach_rate * 0.05,
    );
  }

  /** Emit a structured ML signal tag array for EngineSignal. */
  public buildSignalTags(): readonly string[] {
    if (!this.lastVector) return Object.freeze([]);
    const v = this.lastVector;
    return Object.freeze([
      `integrity:${v.overall_integrity.toFixed(4)}`,
      `l4_risk:${v.l4_route_risk.toFixed(4)}`,
      `threat:${v.aggregate_threat_pressure.toFixed(4)}`,
      `urgency:${v.max_attack_urgency.toFixed(4)}`,
      `mode:${v.mode_normalized.toFixed(3)}`,
      `phase:${v.phase_normalized.toFixed(3)}`,
    ]);
  }

  public reset(): void {
    this.lastVector = null;
    this.vectorHistory = [];
  }
}

// ============================================================================
// §7 — AttackRouterDLBuilder
// ============================================================================

/** Builds and maintains the rolling DL tensor sequence. */
export class AttackRouterDLBuilder {
  private rows: Array<Readonly<Record<string, number>>> = [];
  private lastIntegrity: number = 1.0;

  public appendRow(params: AttackRouterDLRowParams): void {
    const row = buildAttackRouterDLRow({
      ...params,
      prevOverallIntegrity: this.lastIntegrity,
    });
    const mappedLayers = mapLayersForIntegrity(params.layers);
    this.lastIntegrity = computeShieldIntegrityRatio(mappedLayers);
    this.rows = [...this.rows.slice(-(ATTACK_ROUTER_DL_SEQUENCE_LENGTH - 1)), row];
  }

  public buildTensor(tick: number, mode: ModeCode, phase: RunPhase): AttackRouterDLTensor {
    // Pad with zeros if fewer rows than sequence length
    const padRow = Object.fromEntries(
      ATTACK_ROUTER_DL_FEATURE_LABELS.map((label) => [label, 0]),
    );

    const sequence: Array<Readonly<Record<string, number>>> = [];
    const needed = ATTACK_ROUTER_DL_SEQUENCE_LENGTH;

    for (let i = 0; i < needed - this.rows.length; i++) {
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

  /** Flatten the DL tensor into a 1D float array (for direct model ingestion). */
  public flattenTensor(tensor: AttackRouterDLTensor): readonly number[] {
    const flat: number[] = [];
    for (const row of tensor.sequence) {
      for (const label of ATTACK_ROUTER_DL_FEATURE_LABELS) {
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
// §8 — AttackRouterTrendAnalyzer
// ============================================================================

/** Analyzes routing history for trend patterns and escalation signals. */
export class AttackRouterTrendAnalyzer {
  private history: AttackRouterHistoryEntry[] = [];

  public record(entry: AttackRouterHistoryEntry): void {
    this.history = [...this.history.slice(-(ATTACK_ROUTER_HISTORY_DEPTH - 1)), entry];
  }

  public buildTrend(
    currentDecisions: readonly AttackRouteDecision[],
    mode: ModeCode,
    phase: RunPhase,
  ): AttackRouterTrendSummary {
    return buildAttackRouterTrendSummary(this.history, currentDecisions, mode, phase);
  }

  /** Compute the magnitude velocity (change in avg damage over recent window). */
  public computeMagnitudeVelocity(window: number = ATTACK_ROUTER_TREND_WINDOW): number {
    const slice = this.history.slice(-window);
    if (slice.length < 2) return 0;
    return slice[slice.length - 1].totalDamageEstimate - slice[0].totalDamageEstimate;
  }

  /** Detect if a cascade escalation pattern is emerging. */
  public detectCascadeEscalation(): boolean {
    const recent = this.history.slice(-3);
    return recent.length >= 2 && recent.every((h) => h.l4CascadeRiskCount > 0);
  }

  /** Detect if ghost-mode amplification has been sustained. */
  public detectGhostAmplificationSurge(): boolean {
    const recent = this.history.slice(-3);
    const ghostTicks = recent.filter((h) => h.ghostAmplifiedCount > 0).length;
    return ghostTicks >= 2;
  }

  /** Detect if Sovereignty phase is escalating L4 threats. */
  public detectSovereigntyL4Surge(): boolean {
    return this.history.slice(-3).some((h) => h.sovereigntyEscalatedCount > 0 && h.l4CascadeRiskCount > 0);
  }

  /** Compute the doctrine entropy trend (rising = more varied attacks). */
  public computeDoctrineEntropyTrend(): number {
    const recent = this.history.slice(-ATTACK_ROUTER_TREND_WINDOW);
    if (recent.length === 0) return 0;
    const docCounts: Partial<Record<ShieldDoctrineAttackType, number>> = {};
    for (const h of recent) {
      if (h.dominantDoctrine) {
        docCounts[h.dominantDoctrine] = (docCounts[h.dominantDoctrine] ?? 0) + 1;
      }
    }
    return computeDoctrineEntropy(docCounts);
  }

  /** Compute bot threat level across recent history. */
  public computeBotThreatWeight(
    botStates: Readonly<Record<HaterBotId, BotState>>,
  ): number {
    let total = 0;
    for (const [botId, state] of Object.entries(botStates)) {
      total += BOT_THREAT_LEVEL[botId as HaterBotId] * BOT_STATE_THREAT_MULTIPLIER[state];
    }
    return Math.min(1.0, total);
  }

  public getHistory(): readonly AttackRouterHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  public reset(): void {
    this.history = [];
  }
}

// ============================================================================
// §9 — AttackRouterAnnotator
// ============================================================================

/** Builds human-readable annotations and UX hints from routing state. */
export class AttackRouterAnnotator {
  public buildAnnotation(
    decisions: readonly AttackRouteDecision[],
    layers: readonly ShieldLayerState[],
    trend: AttackRouterTrendSummary,
    mode: ModeCode,
    phase: RunPhase,
  ): AttackRouterAnnotationBundle {
    return buildAttackRouterAnnotation(decisions, layers, trend, mode, phase);
  }

  public buildUXHint(
    decisions: readonly AttackRouteDecision[],
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
    pressureTier: PressureTier,
  ): AttackRouterUXHint {
    return buildAttackRouterUXHint(decisions, layers, mode, phase, pressureTier);
  }

  /** Build a chat-native summary string for NPC dialogue injection. */
  public buildChatSummary(
    annotation: AttackRouterAnnotationBundle,
    hint: AttackRouterUXHint,
  ): string {
    const parts: string[] = [annotation.summary];
    if (annotation.l4CascadeWarning !== null) parts.push(annotation.l4CascadeWarning);
    if (hint.actionSuggestion !== null) parts.push(`Suggestion: ${hint.actionSuggestion}`);
    parts.push(annotation.uxHint);
    return parts.join(' | ');
  }

  /** Determine the chat channel for this routing batch. */
  public resolveChatChannel(
    decisions: readonly AttackRouteDecision[],
    mode: ModeCode,
    phase: RunPhase,
  ): string {
    const l4Count = decisions.filter((d) => d.l4CascadeRisk).length;
    const catastrophicCount = decisions.filter((d) => d.severityClass === 'CATASTROPHIC').length;
    const sovereigntyEscalated = isEndgamePhase(phase) && catastrophicCount > 0;

    if (l4Count > 0 || (mode === 'ghost' && catastrophicCount > 0)) return 'COMBAT';
    if (sovereigntyEscalated || catastrophicCount > 1) return 'ALERT';
    if (MODE_DIFFICULTY_MULTIPLIER[mode] >= 1.4) return 'COMMENTARY';
    return 'AMBIENT';
  }

  /** Build narrative weight score for companion prioritization (0-1). */
  public buildNarrativeWeight(
    decisions: readonly AttackRouteDecision[],
    mode: ModeCode,
    phase: RunPhase,
    pressureTier: PressureTier,
  ): number {
    const l4Weight = decisions.filter((d) => d.l4CascadeRisk).length > 0 ? 0.40 : 0;
    const catastrophicWeight = decisions.filter((d) => d.severityClass === 'CATASTROPHIC').length > 0 ? 0.25 : 0;
    const tierWeight = ATTACK_ROUTER_PRESSURE_TIER_URGENCY[pressureTier] * 0.20;
    const phaseWeight = ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[phase] * 0.10;
    const modeWeight = MODE_DIFFICULTY_MULTIPLIER[mode] * 0.05;
    return Math.min(1.0, l4Weight + catastrophicWeight + tierWeight + phaseWeight + modeWeight);
  }
}

// ============================================================================
// §10 — AttackRouterInspector
// ============================================================================

/** Provides runtime observability into the AttackRouter's internal state. */
export class AttackRouterInspector {
  private totalBatches = 0;
  private totalAttacks = 0;
  private totalL4Risks = 0;
  private totalGhostAmplified = 0;
  private totalSovereigntyEscalated = 0;
  private allTimeDoctrineBreakdown: Partial<Record<ShieldDoctrineAttackType, number>> = {};
  private urgencyScoreSum = 0;

  public record(
    batch: AttackRouterBatchResult,
    decisions: readonly AttackRouteDecision[],
  ): void {
    this.totalBatches += 1;
    this.totalAttacks += decisions.length;
    this.totalL4Risks += batch.l4CascadeRiskCount;
    this.totalGhostAmplified += decisions.filter((d) => d.modeAmplified).length;
    this.totalSovereigntyEscalated += decisions.filter((d) => d.sovereigntyEscalated).length;
    this.urgencyScoreSum += decisions.reduce((s, d) => s + d.urgencyScore, 0);

    for (const [doctrine, count] of Object.entries(batch.doctrineBreakdown)) {
      const doc = doctrine as ShieldDoctrineAttackType;
      this.allTimeDoctrineBreakdown[doc] = (this.allTimeDoctrineBreakdown[doc] ?? 0) + (count ?? 0);
    }
  }

  public buildState(
    history: readonly AttackRouterHistoryEntry[],
    lastVector: AttackRouterMLVector | null,
    lastTrend: AttackRouterTrendSummary | null,
  ): AttackRouterInspectorState {
    return Object.freeze({
      totalBatchesProcessed: this.totalBatches,
      totalAttacksRouted: this.totalAttacks,
      totalL4CascadeRisks: this.totalL4Risks,
      totalGhostAmplified: this.totalGhostAmplified,
      totalSovereigntyEscalated: this.totalSovereigntyEscalated,
      dominantDoctrineAllTime: findDominantDoctrine(this.allTimeDoctrineBreakdown),
      avgBatchSize: this.totalBatches > 0 ? this.totalAttacks / this.totalBatches : 0,
      avgUrgencyScore: this.totalAttacks > 0 ? this.urgencyScoreSum / this.totalAttacks : 0,
      recentHistory: history.slice(-10),
      lastMLVector: lastVector,
      lastTrendSummary: lastTrend,
    });
  }

  public reset(): void {
    this.totalBatches = 0;
    this.totalAttacks = 0;
    this.totalL4Risks = 0;
    this.totalGhostAmplified = 0;
    this.totalSovereigntyEscalated = 0;
    this.allTimeDoctrineBreakdown = {};
    this.urgencyScoreSum = 0;
  }
}

// ============================================================================
// §11 — AttackRouterAnalytics
// ============================================================================

/** Session-level analytics across all routing batches. */
export class AttackRouterAnalytics {
  private sessionAttacks = 0;
  private sessionBatches = 0;
  private sessionDoctrineBreakdown: Partial<Record<ShieldDoctrineAttackType, number>> = {};
  private sessionSeverityBreakdown: Partial<Record<AttackSeverityClass, number>> = {};
  private sessionTargetBreakdown: Partial<Record<ShieldLayerId, number>> = {};
  private sessionGhostAmplified = 0;
  private sessionSovereigntyEscalated = 0;
  private sessionL4Risks = 0;
  private sessionUrgencySum = 0;
  private sessionThreatPressureSum = 0;

  public record(
    decisions: readonly AttackRouteDecision[],
    batch: AttackRouterBatchResult,
    threatPressure: number,
  ): void {
    this.sessionBatches += 1;
    this.sessionAttacks += decisions.length;
    this.sessionL4Risks += batch.l4CascadeRiskCount;
    this.sessionGhostAmplified += decisions.filter((d) => d.modeAmplified).length;
    this.sessionSovereigntyEscalated += decisions.filter((d) => d.sovereigntyEscalated).length;
    this.sessionUrgencySum += decisions.reduce((s, d) => s + d.urgencyScore, 0);
    this.sessionThreatPressureSum += threatPressure;

    for (const [doctrine, count] of Object.entries(batch.doctrineBreakdown)) {
      const doc = doctrine as ShieldDoctrineAttackType;
      this.sessionDoctrineBreakdown[doc] = (this.sessionDoctrineBreakdown[doc] ?? 0) + (count ?? 0);
    }
    for (const d of decisions) {
      const sev = d.severityClass;
      this.sessionSeverityBreakdown[sev] = (this.sessionSeverityBreakdown[sev] ?? 0) + 1;
      const tgt = d.routed.targetLayer;
      this.sessionTargetBreakdown[tgt] = (this.sessionTargetBreakdown[tgt] ?? 0) + 1;
    }
  }

  public computeSummary(): AttackRouterAnalyticsSummary {
    const safeAttacks = this.sessionAttacks === 0 ? 1 : this.sessionAttacks;
    const safeBatches = this.sessionBatches === 0 ? 1 : this.sessionBatches;

    // Use SHIELD_LAYER_ABSORPTION_ORDER to ensure all layers represented
    const layerDist: Partial<Record<ShieldLayerId, number>> = {};
    for (const layerId of SHIELD_LAYER_ABSORPTION_ORDER) {
      layerDist[layerId] = this.sessionTargetBreakdown[layerId] ?? 0;
    }

    // Use SHIELD_LAYER_CONFIGS to confirm layer existence in distribution
    for (const layerId of Object.keys(SHIELD_LAYER_CONFIGS) as ShieldLayerId[]) {
      if (layerDist[layerId] === undefined) layerDist[layerId] = 0;
    }

    return Object.freeze({
      sessionTotalAttacks: this.sessionAttacks,
      sessionTotalBatches: this.sessionBatches,
      doctrineDistribution: { ...this.sessionDoctrineBreakdown },
      severityDistribution: { ...this.sessionSeverityBreakdown },
      targetLayerDistribution: layerDist,
      ghostAmplificationRate: this.sessionGhostAmplified / safeAttacks,
      sovereigntyEscalationRate: this.sessionSovereigntyEscalated / safeAttacks,
      l4CascadeRiskRate: this.sessionL4Risks / safeBatches,
      avgUrgencyScore: this.sessionUrgencySum / safeAttacks,
      avgBatchThreatPressure: this.sessionThreatPressureSum / safeBatches,
    });
  }

  public reset(): void {
    this.sessionAttacks = 0;
    this.sessionBatches = 0;
    this.sessionDoctrineBreakdown = {};
    this.sessionSeverityBreakdown = {};
    this.sessionTargetBreakdown = {};
    this.sessionGhostAmplified = 0;
    this.sessionSovereigntyEscalated = 0;
    this.sessionL4Risks = 0;
    this.sessionUrgencySum = 0;
    this.sessionThreatPressureSum = 0;
  }
}

// ============================================================================
// §12 — Enhanced AttackRouter class
// ============================================================================

/**
 * AttackRouter — authoritative shield attack routing engine.
 *
 * Preserves all original public surface (order, resolve, resolveEffectiveTarget)
 * and adds mode/phase-aware contextual routing, ML/DL extraction, history
 * tracking, and analytics.
 */
export class AttackRouter {
  private readonly history: AttackRouterHistoryEntry[] = [];
  private readonly mlExtractor = new AttackRouterMLExtractor();
  private readonly dlBuilder = new AttackRouterDLBuilder();
  private readonly trendAnalyzer = new AttackRouterTrendAnalyzer();
  private readonly annotator = new AttackRouterAnnotator();
  private readonly inspector = new AttackRouterInspector();
  private readonly analytics = new AttackRouterAnalytics();

  // ── Original public API ────────────────────────────────────────────────────

  /** Order attacks by priority — BREACH first, then by critical semantics, age, magnitude, id. */
  public order(attacks: readonly AttackEvent[]): AttackEvent[] {
    return [...attacks].sort((left, right) => {
      const priorityDelta =
        this.priority(right.category) - this.priority(left.category);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const criticalDelta =
        Number(this.hasCriticalSemantics(right.notes)) -
        Number(this.hasCriticalSemantics(left.notes));

      if (criticalDelta !== 0) {
        return criticalDelta;
      }

      const createdAtDelta = left.createdAtTick - right.createdAtTick;
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      const magnitudeDelta = right.magnitude - left.magnitude;
      if (magnitudeDelta !== 0) {
        return magnitudeDelta;
      }

      return left.attackId.localeCompare(right.attackId);
    });
  }

  /** Resolve routing for a single attack against current layer state. */
  public resolve(
    attack: AttackEvent,
    currentLayers: readonly ShieldLayerState[],
  ): RoutedAttack {
    const noteTags = normalizeShieldNoteTags(attack.notes);
    const doctrineType = this.resolveDoctrineType(attack, noteTags);

    const hintedPrimary =
      attack.targetLayer !== 'DIRECT' ? attack.targetLayer : null;

    const route =
      doctrineType === 'HATER_INJECTION'
        ? this.weakestTwo(currentLayers)
        : this.routeByDoctrineType(doctrineType, hintedPrimary);

    return {
      attackId: attack.attackId,
      source: attack.source,
      category: attack.category,
      doctrineType,
      requestedLayer: attack.targetLayer,
      targetLayer: route.primary,
      fallbackLayer: route.fallback,
      magnitude: Math.max(0, Math.round(attack.magnitude)),
      createdAtTick: attack.createdAtTick,
      noteTags,
      bypassDeflection: this.hasCriticalSemantics(attack.notes),
    };
  }

  /** Resolve the effective target layer considering current breach state. */
  public resolveEffectiveTarget(
    routed: Pick<RoutedAttack, 'targetLayer' | 'fallbackLayer'>,
    currentLayers: readonly ShieldLayerState[],
  ): ShieldLayerId {
    const stateById = new Map(currentLayers.map((layer) => [layer.layerId, layer]));

    const primary = stateById.get(routed.targetLayer);
    if (primary !== undefined && !primary.breached) {
      return routed.targetLayer;
    }

    if (routed.fallbackLayer !== null) {
      const fallback = stateById.get(routed.fallbackLayer);
      if (fallback !== undefined && !fallback.breached) {
        return routed.fallbackLayer;
      }
    }

    for (let index = SHIELD_LAYER_ORDER.length - 1; index >= 0; index -= 1) {
      const candidate = stateById.get(SHIELD_LAYER_ORDER[index]);
      if (candidate !== undefined && !candidate.breached) {
        return candidate.layerId;
      }
    }

    return 'L4';
  }

  // ── Enhanced contextual API ────────────────────────────────────────────────

  /**
   * Route a single attack with full mode/phase context.
   * Returns an AttackRouteDecision with severity, urgency, risk flags.
   */
  public routeWithContext(
    attack: AttackEvent,
    currentLayers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
    tick: number,
  ): AttackRouteDecision {
    const noteTags = normalizeShieldNoteTags(attack.notes);
    let doctrineType = this.resolveDoctrineType(attack, noteTags);

    // Ghost mode: HATER_INJECTION gets amplified — no hint override allowed
    const ghostAmplified = mode === 'ghost' && doctrineType === 'HATER_INJECTION';

    // Sovereignty: ignore layer hints for deterministic routing
    const hintEligible = ATTACK_ROUTER_PHASE_HINT_ELIGIBLE[phase];
    const hintedPrimary =
      hintEligible && attack.targetLayer !== 'DIRECT' ? attack.targetLayer : null;

    const route =
      doctrineType === 'HATER_INJECTION'
        ? this.weakestTwo(currentLayers)
        : this.routeByDoctrineType(doctrineType, hintedPrimary);

    const routed: RoutedAttack = {
      attackId: attack.attackId,
      source: attack.source,
      category: attack.category,
      doctrineType,
      requestedLayer: attack.targetLayer,
      targetLayer: route.primary,
      fallbackLayer: route.fallback,
      magnitude: Math.max(0, Math.round(
        ghostAmplified
          ? attack.magnitude * ATTACK_ROUTER_GHOST_HATER_AMPLIFY
          : attack.magnitude,
      )),
      createdAtTick: attack.createdAtTick,
      noteTags,
      bypassDeflection: this.hasCriticalSemantics(attack.notes),
    };

    const severityClass = classifyAttackSeverity(attack);
    const urgencyScore = scoreAttackResponseUrgency(attack, tick);
    const doctrineConfidence = computeDoctrineConfidence(attack, noteTags, doctrineType);

    // L4 cascade risk: routing to L4 cascade gate layer
    const effectiveTarget = this.resolveEffectiveTarget(routed, currentLayers);
    const l4Layer = currentLayers.find((l) => l.layerId === 'L4');
    const l4CascadeRisk =
      (route.primary === 'L4' || effectiveTarget === 'L4') &&
      (l4Layer?.integrityRatio ?? 1) < ATTACK_ROUTER_EXPOSED_VULNERABILITY_THRESHOLD;

    // Sovereignty escalation: endgame L4 routing is always critical
    const sovereigntyEscalated =
      isEndgamePhase(phase) &&
      (route.primary === 'L4' || effectiveTarget === 'L4') &&
      ATTACK_DOCTRINE_IS_CASCADE_RISK[doctrineType];

    return Object.freeze({
      routed,
      effectiveTarget,
      severityClass,
      urgencyScore,
      doctrineConfidence,
      l4CascadeRisk,
      mode,
      phase,
      modeAmplified: ghostAmplified,
      sovereigntyEscalated,
      tick,
    });
  }

  /**
   * Order and route a batch of attacks with context.
   * Returns a full AttackRouterBatchResult.
   */
  public routeBatchWithContext(
    attacks: readonly AttackEvent[],
    currentLayers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
    tick: number,
    threats: readonly ThreatEnvelope[] = [],
  ): AttackRouterBatchResult {
    const maxBatch = ATTACK_ROUTER_MODE_MAX_BATCH[mode];
    const overflowFlagged = attacks.length > maxBatch;

    const orderedAttacks = this.orderWithContext(attacks, mode, phase);
    const effectiveAttacks = orderedAttacks.slice(0, maxBatch);

    const decisions = effectiveAttacks.map((attack) =>
      this.routeWithContext(attack, currentLayers, mode, phase, tick),
    );

    const docBreakdown = buildDoctrineBreakdown(decisions);
    const totalDamage = decisions.reduce(
      (sum, d) => sum + d.routed.magnitude * ATTACK_CATEGORY_BASE_MAGNITUDE[d.routed.category],
      0,
    );
    const maxSeverity = decisions.reduce<AttackSeverityClass>((worst, d) => {
      const order: Record<AttackSeverityClass, number> = { CATASTROPHIC: 3, MAJOR: 2, MODERATE: 1, MINOR: 0 };
      return order[d.severityClass] > order[worst] ? d.severityClass : worst;
    }, 'MINOR');
    const l4Count = decisions.filter((d) => d.l4CascadeRisk).length;

    const batch: AttackRouterBatchResult = Object.freeze({
      decisions,
      totalDamageEstimate: totalDamage,
      maxSeverity,
      l4CascadeRiskCount: l4Count,
      doctrineBreakdown: docBreakdown as Readonly<Record<ShieldDoctrineAttackType, number>>,
      overflowFlagged,
      tick,
      mode,
      phase,
    });

    // Record in analytics
    const threatPressure = computeAggregateThreatPressure(threats, tick);
    this.analytics.record(decisions, batch, threatPressure);

    // Record history entry
    const historyEntry = buildAttackRouterHistoryEntry(decisions, currentLayers, tick, mode, phase);
    this.history.push(historyEntry);
    if (this.history.length > ATTACK_ROUTER_HISTORY_DEPTH) {
      this.history.splice(0, this.history.length - ATTACK_ROUTER_HISTORY_DEPTH);
    }
    this.trendAnalyzer.record(historyEntry);

    // Extract ML vector
    this.mlExtractor.extract({
      decisions,
      layers: currentLayers,
      mode,
      phase,
      tick,
      history: [...this.history],
      threats,
    });

    // Append DL row
    this.dlBuilder.appendRow({ decisions, layers: currentLayers, mode, phase, tick });

    // Record inspector
    this.inspector.record(batch, decisions);

    return batch;
  }

  /**
   * Order attacks with mode/phase priority weighting.
   * Mode weight and phase escalation factor are applied on top of base priority.
   */
  public orderWithContext(
    attacks: readonly AttackEvent[],
    mode: ModeCode,
    phase: RunPhase,
  ): AttackEvent[] {
    const modeWeight = ATTACK_ROUTER_MODE_PRIORITY_WEIGHT[mode];
    const phaseWeight = ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[phase];

    return [...attacks].sort((left, right) => {
      const leftScore = this.priority(left.category) * modeWeight * phaseWeight +
        (this.hasCriticalSemantics(left.notes) ? 10 : 0);
      const rightScore = this.priority(right.category) * modeWeight * phaseWeight +
        (this.hasCriticalSemantics(right.notes) ? 10 : 0);

      if (rightScore !== leftScore) return rightScore - leftScore;

      const createdAtDelta = left.createdAtTick - right.createdAtTick;
      if (createdAtDelta !== 0) return createdAtDelta;

      const magnitudeDelta = right.magnitude - left.magnitude;
      if (magnitudeDelta !== 0) return magnitudeDelta;

      return left.attackId.localeCompare(right.attackId);
    });
  }

  // ── Analytics accessors ────────────────────────────────────────────────────

  public getLastMLVector(): AttackRouterMLVector | null {
    return this.mlExtractor.getLastVector();
  }

  public buildDLTensor(tick: number, mode: ModeCode, phase: RunPhase): AttackRouterDLTensor {
    return this.dlBuilder.buildTensor(tick, mode, phase);
  }

  public buildTrendSummary(
    currentDecisions: readonly AttackRouteDecision[],
    mode: ModeCode,
    phase: RunPhase,
  ): AttackRouterTrendSummary {
    return this.trendAnalyzer.buildTrend(currentDecisions, mode, phase);
  }

  public buildAnnotation(
    decisions: readonly AttackRouteDecision[],
    layers: readonly ShieldLayerState[],
    trend: AttackRouterTrendSummary,
    mode: ModeCode,
    phase: RunPhase,
  ): AttackRouterAnnotationBundle {
    return this.annotator.buildAnnotation(decisions, layers, trend, mode, phase);
  }

  public buildUXHint(
    decisions: readonly AttackRouteDecision[],
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
    pressureTier: PressureTier,
  ): AttackRouterUXHint {
    return this.annotator.buildUXHint(decisions, layers, mode, phase, pressureTier);
  }

  public getInspectorState(): AttackRouterInspectorState {
    return this.inspector.buildState(
      this.history,
      this.mlExtractor.getLastVector(),
      this.trendAnalyzer.buildTrend([], 'solo', 'FOUNDATION'),
    );
  }

  public getAnalyticsSummary(): AttackRouterAnalyticsSummary {
    return this.analytics.computeSummary();
  }

  public getHistory(): readonly AttackRouterHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  public reset(): void {
    this.history.length = 0;
    this.mlExtractor.reset();
    this.dlBuilder.reset();
    this.trendAnalyzer.reset();
    this.inspector.reset();
    this.analytics.reset();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private resolveDoctrineType(
    attack: AttackEvent,
    noteTags: readonly string[],
  ): ShieldDoctrineAttackType {
    const aliased = resolveShieldAlias(noteTags);
    if (aliased !== null) {
      return aliased;
    }

    switch (attack.category) {
      case 'EXTRACTION':
        return 'FINANCIAL_SABOTAGE';

      case 'DRAIN':
        return noteTags.includes('expense')
          ? 'EXPENSE_INJECTION'
          : 'FINANCIAL_SABOTAGE';

      case 'DEBT':
        return 'DEBT_ATTACK';

      case 'LOCK':
        return noteTags.includes('opportunity')
          ? 'OPPORTUNITY_KILL'
          : 'ASSET_STRIP';

      case 'BREACH':
        return noteTags.includes('regulatory') ||
          noteTags.includes('audit') ||
          noteTags.includes('compliance')
          ? 'REGULATORY_ATTACK'
          : 'REPUTATION_ATTACK';

      case 'HEAT':
        return attack.targetLayer === 'DIRECT'
          ? 'HATER_INJECTION'
          : 'REPUTATION_ATTACK';

      default:
        return 'FINANCIAL_SABOTAGE';
    }
  }

  private routeByDoctrineType(
    doctrineType: ShieldDoctrineAttackType,
    hintedPrimary: ShieldLayerId | null,
  ): { primary: ShieldLayerId; fallback: ShieldLayerId | null } {
    const canonical = this.canonicalRoute(doctrineType);

    if (hintedPrimary === null) {
      return canonical;
    }

    return {
      primary: hintedPrimary,
      fallback:
        hintedPrimary === canonical.primary
          ? canonical.fallback
          : this.defaultFallback(hintedPrimary),
    };
  }

  private canonicalRoute(
    doctrineType: ShieldDoctrineAttackType,
  ): { primary: ShieldLayerId; fallback: ShieldLayerId | null } {
    switch (doctrineType) {
      case 'FINANCIAL_SABOTAGE':
      case 'EXPENSE_INJECTION':
        return { primary: 'L1', fallback: 'L2' };

      case 'DEBT_ATTACK':
        return { primary: 'L2', fallback: 'L3' };

      case 'ASSET_STRIP':
        return { primary: 'L3', fallback: 'L4' };

      case 'REPUTATION_ATTACK':
        return { primary: 'L4', fallback: 'L1' };

      case 'REGULATORY_ATTACK':
        return { primary: 'L4', fallback: 'L3' };

      case 'OPPORTUNITY_KILL':
        return { primary: 'L3', fallback: 'L2' };

      case 'HATER_INJECTION':
        return { primary: 'L4', fallback: 'L3' };

      default:
        return { primary: 'L1', fallback: 'L2' };
    }
  }

  private weakestTwo(
    layers: readonly ShieldLayerState[],
  ): { primary: ShieldLayerId; fallback: ShieldLayerId | null } {
    const sorted = [...layers].sort((left, right) => {
      if (left.integrityRatio !== right.integrityRatio) {
        return left.integrityRatio - right.integrityRatio;
      }

      return layerOrderIndex(right.layerId) - layerOrderIndex(left.layerId);
    });

    return {
      primary: sorted[0]?.layerId ?? 'L4',
      fallback: sorted[1]?.layerId ?? null,
    };
  }

  private defaultFallback(primary: ShieldLayerId): ShieldLayerId | null {
    switch (primary) {
      case 'L1':
        return 'L2';
      case 'L2':
        return 'L3';
      case 'L3':
        return 'L4';
      case 'L4':
        return 'L3';
      default:
        return null;
    }
  }

  private hasCriticalSemantics(notes: readonly string[]): boolean {
    return normalizeShieldNoteTags(notes).some(
      (tag) =>
        tag === 'critical' ||
        tag === 'critical-hit' ||
        tag === 'critical_hit' ||
        tag === 'bypass-deflection' ||
        tag === 'bypass_deflection',
    );
  }

  private priority(category: AttackCategory): number {
    switch (category) {
      case 'BREACH':
        return 6;
      case 'EXTRACTION':
        return 5;
      case 'DEBT':
        return 4;
      case 'LOCK':
        return 3;
      case 'DRAIN':
        return 2;
      case 'HEAT':
        return 1;
      default:
        return 0;
    }
  }
}

// ============================================================================
// §13 — Factory & standalone helpers
// ============================================================================

/** Create a full AttackRouter ensemble with all companion classes wired. */
export function createAttackRouterWithAnalytics(): AttackRouterEnsemble {
  const router = new AttackRouter();
  const mlExtractor = new AttackRouterMLExtractor();
  const dlBuilder = new AttackRouterDLBuilder();
  const trendAnalyzer = new AttackRouterTrendAnalyzer();
  const annotator = new AttackRouterAnnotator();
  const inspector = new AttackRouterInspector();
  const analytics = new AttackRouterAnalytics();

  return Object.freeze({
    router,
    mlExtractor,
    dlBuilder,
    trendAnalyzer,
    annotator,
    inspector,
    analytics,
  });
}

/** Get the recommended chat channel for a routing batch. */
export function getAttackChatChannel(batch: AttackRouterBatchResult): string {
  if (batch.l4CascadeRiskCount > 0) return 'COMBAT';
  if (batch.maxSeverity === 'CATASTROPHIC') return 'ALERT';
  if (batch.maxSeverity === 'MAJOR') return 'COMMENTARY';
  return 'AMBIENT';
}

/** Build the narrative weight for a routing batch (0-1). */
export function buildAttackNarrativeWeight(
  batch: AttackRouterBatchResult,
  pressureTier: PressureTier,
): number {
  const tierWeight = ATTACK_ROUTER_PRESSURE_TIER_URGENCY[pressureTier];
  const phaseWeight = ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[batch.phase];
  const l4Weight = batch.l4CascadeRiskCount > 0 ? 0.4 : 0;
  const severityWeight: Record<AttackSeverityClass, number> = {
    CATASTROPHIC: 0.3,
    MAJOR: 0.2,
    MODERATE: 0.1,
    MINOR: 0.05,
  };
  return Math.min(1.0,
    l4Weight +
    severityWeight[batch.maxSeverity] +
    tierWeight * 0.2 +
    phaseWeight * 0.1,
  );
}

/** Score the aggregate batch risk on a 0-10 scale. */
export function scoreAttackBatchRisk(
  batch: AttackRouterBatchResult,
  layers: readonly ShieldLayerState[],
): number {
  const l4Score = batch.l4CascadeRiskCount > 0 ? 3 : 0;
  const severityScore: Record<AttackSeverityClass, number> = {
    CATASTROPHIC: 3, MAJOR: 2, MODERATE: 1, MINOR: 0.5,
  };
  const integrityScore = (1.0 - computeShieldIntegrityRatio(mapLayersForIntegrity(layers))) * 2;
  const phaseScore = ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[batch.phase] * 1.5;
  return Math.min(10, l4Score + severityScore[batch.maxSeverity] + integrityScore + phaseScore);
}

/** Extract a flat ML feature array (for direct model ingestion). */
export function extractAttackRouterMLArray(vector: AttackRouterMLVector): readonly number[] {
  return Object.freeze(
    ATTACK_ROUTER_ML_FEATURE_LABELS.map((label) => (vector as unknown as Record<string, number>)[label] ?? 0),
  );
}

/** Describe the routing decision in a human-readable sentence. */
export function describeRoutingDecision(decision: AttackRouteDecision): string {
  const layerLabel = SHIELD_LAYER_LABEL_BY_ID[decision.routed.targetLayer];
  const effectiveLabelStr = decision.effectiveTarget !== decision.routed.targetLayer
    ? ` (effective: ${SHIELD_LAYER_LABEL_BY_ID[decision.effectiveTarget]})`
    : '';
  const amplifyStr = decision.modeAmplified ? ' [GHOST-AMPLIFIED]' : '';
  const escalateStr = decision.sovereigntyEscalated ? ' [SOVEREIGNTY-ESCALATED]' : '';
  const cascadeStr = decision.l4CascadeRisk ? ' ⚠ CASCADE RISK' : '';

  return `${decision.routed.doctrineType} → ${layerLabel}${effectiveLabelStr}` +
    ` | severity: ${decision.severityClass} | urgency: ${decision.urgencyScore.toFixed(3)}` +
    `${amplifyStr}${escalateStr}${cascadeStr}`;
}

// ============================================================================
// §14 — Deep threat analytics
// ============================================================================

/** Compute threat exposure score combining vulnerability and doctrine danger. */
export function computeThreateningDoctrineExposure(
  decisions: readonly AttackRouteDecision[],
  layers: readonly ShieldLayerState[],
): number {
  if (decisions.length === 0) return 0;

  let totalExposure = 0;
  for (const d of decisions) {
    const dangerIndex = ATTACK_DOCTRINE_DANGER_INDEX[d.routed.doctrineType];
    const layerVuln = computeShieldLayerVulnerability(
      d.routed.targetLayer,
      layers.find((l) => l.layerId === d.routed.targetLayer)?.current ?? 0,
      SHIELD_LAYER_CONFIGS[d.routed.targetLayer].max,
    );
    totalExposure += dangerIndex * layerVuln;
  }

  return Math.min(1.0, totalExposure / decisions.length);
}

/** Compute a cascade gate exposure score — how close L4 is to triggering. */
export function computeCascadeGateExposure(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): number {
  const l4 = layers.find((l) => l.layerId === 'L4');
  if (!l4) return 0;

  const modeMultiplier = ATTACK_ROUTER_MODE_PRIORITY_WEIGHT[mode];
  const phaseMultiplier = ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[phase];
  const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT['L4'];

  return Math.min(1.0,
    (1.0 - l4.integrityRatio) * modeMultiplier * phaseMultiplier * capacityWeight,
  );
}

/** Score the urgency of an attack batch based on threat envelopes. */
export function scoreEnvelopeThreatBatch(
  threats: readonly ThreatEnvelope[],
  tick: number,
  mode: ModeCode,
): number {
  if (threats.length === 0) return 0;
  const aggregate = computeAggregateThreatPressure(threats, tick);
  const modeBoost = MODE_DIFFICULTY_MULTIPLIER[mode];
  return Math.min(1.0, aggregate * modeBoost);
}

/** Classify a list of threats into urgency classes. */
export function classifyThreatBatch(
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

/** Compute per-layer estimated incoming damage from a routed batch. */
export function computeLayerIncomingDamage(
  decisions: readonly AttackRouteDecision[],
): Readonly<Record<ShieldLayerId, number>> {
  const result: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
  for (const d of decisions) {
    result[d.effectiveTarget] =
      (result[d.effectiveTarget] ?? 0) + d.routed.magnitude * ATTACK_CATEGORY_BASE_MAGNITUDE[d.routed.category];
  }
  return Object.freeze(result) as Readonly<Record<ShieldLayerId, number>>;
}

/** Compute estimated ticks until a layer breaches given incoming damage rate. */
export function computeTicksUntilLayerBreach(
  layer: ShieldLayerState,
  incomingDamagePerTick: number,
  mode: ModeCode,
  phase: RunPhase,
): number {
  if (incomingDamagePerTick <= 0) return Infinity;
  const config = getLayerConfig(layer.layerId);
  const regenPerTick = layer.breached ? config.breachedRegenRate : config.passiveRegenRate;
  const effectiveDamage = incomingDamagePerTick * ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[phase] * ATTACK_ROUTER_MODE_PRIORITY_WEIGHT[mode];
  const netDamage = effectiveDamage - regenPerTick;
  if (netDamage <= 0) return Infinity;
  return Math.ceil(layer.current / netDamage);
}

/** Compute the counterable attack ratio in a batch. */
export function computeCounterableRatio(
  decisions: readonly AttackRouteDecision[],
): number {
  if (decisions.length === 0) return 0;
  const counterable = decisions.filter((d) => ATTACK_CATEGORY_IS_COUNTERABLE[d.routed.category]).length;
  return counterable / decisions.length;
}

/** Compute the bot threat contribution from a batch. */
export function computeBatchBotThreatScore(
  decisions: readonly AttackRouteDecision[],
  botStates: Readonly<Record<HaterBotId, BotState>>,
): number {
  let total = 0;
  for (const d of decisions) {
    if (isHaterBotId(d.routed.source)) {
      const botId = d.routed.source as HaterBotId;
      const state = botStates[botId] ?? 'DORMANT';
      total += BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[state];
    }
  }
  return Math.min(1.0, total / Math.max(1, decisions.length));
}

/** Score the attack category magnitude modifier for prioritization. */
export function scoreCategoryMagnitude(category: AttackCategory): number {
  return ATTACK_CATEGORY_BASE_MAGNITUDE[category];
}

/** Build a per-layer attack pressure map. */
export function buildLayerAttackPressureMap(
  decisions: readonly AttackRouteDecision[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): Readonly<Record<ShieldLayerId, number>> {
  const incomingDamage = computeLayerIncomingDamage(decisions);
  const result: Record<string, number> = {};
  for (const layer of layers) {
    const damage = (incomingDamage as Record<string, number>)[layer.layerId] ?? 0;
    const vuln = computeShieldLayerVulnerability(layer.layerId, layer.current, layer.max);
    result[layer.layerId] = Math.min(1.0, damage * vuln * ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[phase] * MODE_DIFFICULTY_MULTIPLIER[mode] / 100);
  }
  return Object.freeze(result) as Readonly<Record<ShieldLayerId, number>>;
}

/** Compute breach risk score for each layer given current decisions. */
export function computePerLayerBreachRisk(
  decisions: readonly AttackRouteDecision[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): Readonly<Record<ShieldLayerId, number>> {
  const pressureMap = buildLayerAttackPressureMap(decisions, layers, mode, phase);
  const result: Record<string, number> = {};
  for (const layer of layers) {
    const pressure = (pressureMap as Record<string, number>)[layer.layerId] ?? 0;
    const capacity = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
    result[layer.layerId] = Math.min(1.0, pressure + (1.0 - layer.integrityRatio) * capacity * 0.5);
  }
  return Object.freeze(result) as Readonly<Record<ShieldLayerId, number>>;
}

// ============================================================================
// §15 — Session report builders
// ============================================================================

/** Full session routing report. */
export interface AttackRouterSessionReport {
  readonly totalAttacks: number;
  readonly totalBatches: number;
  readonly doctrineDistribution: Partial<Record<ShieldDoctrineAttackType, number>>;
  readonly severityDistribution: Partial<Record<AttackSeverityClass, number>>;
  readonly targetLayerDistribution: Partial<Record<ShieldLayerId, number>>;
  readonly l4CascadeRiskRate: number;
  readonly ghostAmplificationRate: number;
  readonly sovereigntyEscalationRate: number;
  readonly avgUrgencyScore: number;
  readonly avgBatchThreatPressure: number;
  readonly peakRiskBatch: AttackRouterHistoryEntry | null;
  readonly doctrineEntropy: number;
  readonly routingGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

/** Build a full session routing report from analytics and history. */
export function buildAttackRouterSessionReport(
  analytics: AttackRouterAnalyticsSummary,
  history: readonly AttackRouterHistoryEntry[],
): AttackRouterSessionReport {
  const summary = analytics;
  const peakRisk = history.length > 0
    ? history.reduce((worst, h) =>
        h.l4CascadeRiskCount > worst.l4CascadeRiskCount ? h : worst,
      )
    : null;

  const docEntropy = computeDoctrineEntropy(summary.doctrineDistribution);

  // Grade: based on how well attacks were managed (low L4 risk, low sovereignty escalation)
  const riskScore = summary.l4CascadeRiskRate * 5 + summary.sovereigntyEscalationRate * 3 + summary.avgUrgencyScore * 2;
  const routingGrade: AttackRouterSessionReport['routingGrade'] =
    riskScore <= 0.5 ? 'S'
    : riskScore <= 1.5 ? 'A'
    : riskScore <= 3.0 ? 'B'
    : riskScore <= 5.0 ? 'C'
    : riskScore <= 7.0 ? 'D' : 'F';

  return Object.freeze({
    totalAttacks: summary.sessionTotalAttacks,
    totalBatches: summary.sessionTotalBatches,
    doctrineDistribution: { ...summary.doctrineDistribution },
    severityDistribution: { ...summary.severityDistribution },
    targetLayerDistribution: { ...summary.targetLayerDistribution },
    l4CascadeRiskRate: summary.l4CascadeRiskRate,
    ghostAmplificationRate: summary.ghostAmplificationRate,
    sovereigntyEscalationRate: summary.sovereigntyEscalationRate,
    avgUrgencyScore: summary.avgUrgencyScore,
    avgBatchThreatPressure: summary.avgBatchThreatPressure,
    peakRiskBatch: peakRisk,
    doctrineEntropy: docEntropy,
    routingGrade,
  });
}

/** Build a routing profile for a specific mode. */
export interface AttackRouterModeProfile {
  readonly mode: ModeCode;
  readonly priorityWeight: number;
  readonly maxBatchSize: number;
  readonly ghostDualTarget: boolean;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly modeNormalized: number;
}

export function buildAttackRouterModeProfile(mode: ModeCode): AttackRouterModeProfile {
  return Object.freeze({
    mode,
    priorityWeight: ATTACK_ROUTER_MODE_PRIORITY_WEIGHT[mode],
    maxBatchSize: ATTACK_ROUTER_MODE_MAX_BATCH[mode],
    ghostDualTarget: ATTACK_ROUTER_GHOST_DUAL_TARGET[mode],
    difficultyMultiplier: MODE_DIFFICULTY_MULTIPLIER[mode],
    tensionFloor: MODE_TENSION_FLOOR[mode],
    modeNormalized: MODE_NORMALIZED[mode],
  });
}

/** Build a routing profile for a specific phase. */
export interface AttackRouterPhaseProfile {
  readonly phase: RunPhase;
  readonly escalationFactor: number;
  readonly hintEligible: boolean;
  readonly stakesMultiplier: number;
  readonly phaseNormalized: number;
  readonly isEndgame: boolean;
  readonly l4RiskMultiplier: number;
}

export function buildAttackRouterPhaseProfile(phase: RunPhase): AttackRouterPhaseProfile {
  return Object.freeze({
    phase,
    escalationFactor: ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[phase],
    hintEligible: ATTACK_ROUTER_PHASE_HINT_ELIGIBLE[phase],
    stakesMultiplier: RUN_PHASE_STAKES_MULTIPLIER[phase],
    phaseNormalized: RUN_PHASE_NORMALIZED[phase],
    isEndgame: isEndgamePhase(phase),
    l4RiskMultiplier: isEndgamePhase(phase) ? ATTACK_ROUTER_SOVEREIGNTY_L4_RISK : 1.0,
  });
}

/**
 * Pre-routing attack profile — analyses a raw batch of AttackEvent objects
 * using canonical GamePrimitives helpers on the native AttackEvent type.
 */
export interface PreRoutingAttackProfile {
  readonly totalAttacks: number;
  readonly counterableCount: number;
  readonly shieldTargetedCount: number;
  readonly botSourceCount: number;
  readonly totalEffectiveDamage: number;
  readonly counterableRatio: number;
  readonly shieldTargetedRatio: number;
  readonly botSourceRatio: number;
  readonly avgEffectiveDamage: number;
}

export function buildPreRoutingAttackProfile(
  attacks: readonly AttackEvent[],
): PreRoutingAttackProfile {
  const n = attacks.length;
  const counterableCount = attacks.filter((a) => isAttackCounterable(a)).length;
  const shieldTargetedCount = attacks.filter((a) => isShieldTargetedAttack(a)).length;
  const botSourceCount = attacks.filter((a) => isAttackFromBot(a)).length;
  const totalEffectiveDamage = attacks.reduce(
    (sum, a) => sum + computeEffectiveAttackDamage(a),
    0,
  );

  return Object.freeze({
    totalAttacks: n,
    counterableCount,
    shieldTargetedCount,
    botSourceCount,
    totalEffectiveDamage,
    counterableRatio: n > 0 ? counterableCount / n : 0,
    shieldTargetedRatio: n > 0 ? shieldTargetedCount / n : 0,
    botSourceRatio: n > 0 ? botSourceCount / n : 0,
    avgEffectiveDamage: n > 0 ? totalEffectiveDamage / n : 0,
  });
}

/** Compute the threat exposure from a set of raw attacks before routing. */
export function computePreRoutingThreatExposure(
  attacks: readonly AttackEvent[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
): number {
  if (attacks.length === 0) return 0;
  const maxBatch = ATTACK_ROUTER_MODE_MAX_BATCH[mode];
  const effectiveAttacks = attacks.slice(0, maxBatch);
  const urgencies = effectiveAttacks.map((a) => scoreAttackResponseUrgency(a, tick));
  const maxUrgency = Math.max(...urgencies);
  const stakes = computeEffectiveStakes(phase, mode);
  const overallIntegrity = computeShieldIntegrityRatio(mapLayersForIntegrity(layers));
  return Math.min(1.0, maxUrgency * stakes * (1.0 - overallIntegrity));
}

/** Validate that all attack IDs in a batch are unique. */
export function validateAttackBatchUniqueness(attacks: readonly AttackEvent[]): boolean {
  const seen = new Set<string>();
  for (const attack of attacks) {
    if (seen.has(attack.attackId)) return false;
    seen.add(attack.attackId);
  }
  return true;
}

/** Compute the doctrine coherence of a batch — 1 = single doctrine, 0 = fully mixed. */
export function computeBatchDoctrineCoherence(decisions: readonly AttackRouteDecision[]): number {
  if (decisions.length === 0) return 1;
  const breakdown = buildDoctrineBreakdown(decisions);
  const entropy = computeDoctrineEntropy(breakdown);
  return 1.0 - entropy;
}

/** Compute the threat pressure score from bot states alone. */
export function computeBotStateThreatPressure(
  botStates: Readonly<Record<HaterBotId, BotState>>,
): number {
  let total = 0;
  for (const [botId, state] of Object.entries(botStates)) {
    total += BOT_THREAT_LEVEL[botId as HaterBotId] * BOT_STATE_THREAT_MULTIPLIER[state];
  }
  return Math.min(1.0, total);
}

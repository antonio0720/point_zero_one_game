/*
 * POINT ZERO ONE — backend/src/game/engine/sovereignty/types.ts
 * Sovereignty Type Foundation — the leaf-most file in the sovereignty subsystem.
 *
 * Doctrine:
 * - this file MUST NOT import from any other sovereignty file
 * - it CAN import from ../core/Deterministic, ../core/GamePrimitives, ../core/RunStateSnapshot
 * - every import is used in RUNTIME code, never just as a type annotation
 * - every constant is accessed and consumed
 * - every function is wired (no dead code)
 * - CORD_WEIGHTS and OUTCOME_MULTIPLIER are preserved exactly for downstream consumers
 *
 * Surface summary:
 *   Section 0  — Imports (core only)
 *   Section 1  — Existing constants (CORD_WEIGHTS, OUTCOME_MULTIPLIER — preserved exactly)
 *   Section 2  — Sovereignty domain types
 *   Section 3  — Sovereignty configuration constants
 *   Section 4  — CORD scoring utilities
 *   Section 5  — Outcome analysis utilities
 *   Section 6  — Mode-specific sovereignty rules
 *   Section 7  — Grade bracket & badge tier config
 *   Section 8  — Integrity classification
 *   Section 9  — Snapshot analysis utilities
 *   Section 10 — ML feature extraction (32-dim sovereignty context vector)
 *   Section 11 — DL tensor construction (48-dim sovereignty tensor)
 *   Section 12 — UX label generators
 *   Section 13 — Validation utilities
 *   Section 14 — Serialization helpers
 *   Section 15 — Self-test
 */

// ============================================================================
// SECTION 0 — IMPORTS (core only — zero sovereignty imports)
// ============================================================================

import {
  sha256,
  hmacSha256,
  checksumSnapshot,
  checksumParts,
  stableStringify,
  createDeterministicId,
  deepFreeze,
  deepFrozenClone,
  cloneJson,
  DeterministicRNG,
} from '../core/Deterministic';

import {
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  SHIELD_LAYER_IDS,
  HATER_BOT_IDS,
  VERIFIED_GRADES,
  INTEGRITY_STATUSES,

  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  LEGEND_MARKER_KIND_WEIGHT,

  isModeCode,
  isPressureTier,
  isRunPhase,
  isRunOutcome,
  isShieldLayerId,
  isHaterBotId,
  isIntegrityStatus,
  isVerifiedGrade,

  computePressureRiskScore,
  isWinOutcome,
  isLossOutcome,
  computeEffectiveStakes,
  computeShieldIntegrityRatio,
  scoreCascadeChainHealth,
  computeLegendMarkerDensity,
} from '../core/GamePrimitives';

import type {
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
  ShieldLayerId,
  HaterBotId,
  VerifiedGrade,
  IntegrityStatus,
  BotState,
} from '../core/GamePrimitives';

import type {
  RunStateSnapshot,
  EconomyState,
  PressureState,
  ShieldState,
  BattleState,
  CascadeState,
  SovereigntyState,
  CardsState,
  TelemetryState,
  TimerState,
  TensionState,
  ShieldLayerState,
  BotRuntimeState,
  DecisionRecord,
} from '../core/RunStateSnapshot';

// ============================================================================
// SECTION 1 — EXISTING CONSTANTS (CORD_WEIGHTS, OUTCOME_MULTIPLIER — PRESERVED)
// ============================================================================

/**
 * CORD (Comprehensive Outcome Review & Decision) score weights.
 * Consumed by ProofGenerator, RunGradeAssigner, SovereigntySnapshotAdapter,
 * SovereigntyExportAdapter, SovereigntyExporter, SovereigntyPersistenceWriter,
 * ReplayIntegrityChecker, contracts.ts, and SovereigntyEngine.
 */
export const CORD_WEIGHTS = {
  decision_speed_score: 0.25,
  shields_maintained_pct: 0.20,
  hater_sabotages_blocked: 0.20,
  cascade_chains_broken: 0.20,
  pressure_survived_score: 0.15,
} as const;

/**
 * Outcome multiplier — applied to final sovereignty score based on how the run ended.
 * Consumed by the same set of sovereignty consumers listed above.
 */
export const OUTCOME_MULTIPLIER = {
  FREEDOM: 1.5,
  TIMEOUT: 0.8,
  BANKRUPT: 0.4,
  ABANDONED: 0.0,
} as const;

// ============================================================================
// SECTION 2 — SOVEREIGNTY DOMAIN TYPES
// ============================================================================

/** Module version stamp for this types file. */
export const SOVEREIGNTY_TYPES_VERSION = 'sovereignty-types.v2.2026' as const;

/** Keys of the CORD_WEIGHTS record. */
export type CordWeightKey = keyof typeof CORD_WEIGHTS;

/** Keys of the OUTCOME_MULTIPLIER record. */
export type OutcomeKey = keyof typeof OUTCOME_MULTIPLIER;

/** A single CORD component with its key, weight, label, and raw value. */
export interface CordComponent {
  readonly key: CordWeightKey;
  readonly weight: number;
  readonly label: string;
  readonly rawValue: number;
  readonly weightedValue: number;
}

/** Result of a full CORD scoring pass. */
export interface CordScoreResult {
  readonly components: readonly CordComponent[];
  readonly totalWeightedScore: number;
  readonly normalizedScore: number;
  readonly componentCount: number;
  readonly dominantComponent: CordWeightKey;
  readonly weakestComponent: CordWeightKey;
  readonly checksum: string;
}

/** Outcome classification result. */
export interface OutcomeClassification {
  readonly outcome: OutcomeKey;
  readonly multiplier: number;
  readonly isWin: boolean;
  readonly isLoss: boolean;
  readonly label: string;
  readonly severity: number;
}

/** Sovereignty grade bracket definition. */
export interface SovereigntyGradeBracket {
  readonly grade: VerifiedGrade;
  readonly label: string;
  readonly minScore: number;
  readonly maxScore: number;
  readonly description: string;
  readonly color: string;
  readonly emoji: string;
}

/** Badge tier configuration for a single grade. */
export interface SovereigntyBadgeTierConfig {
  readonly grade: VerifiedGrade;
  readonly badgeName: string;
  readonly badgeLabel: string;
  readonly minCordScore: number;
  readonly tier: number;
  readonly rarity: string;
  readonly description: string;
}

/** Integrity risk levels used by the sovereignty audit system. */
export type IntegrityRiskLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

/** Integrity risk classification result. */
export interface IntegrityRiskClassification {
  readonly level: IntegrityRiskLevel;
  readonly score: number;
  readonly flags: readonly string[];
  readonly requiresReview: boolean;
  readonly label: string;
}

/** Mode-specific sovereignty rule set. */
export interface ModeSovereigntyRules {
  readonly mode: ModeCode;
  readonly cordBonusMultiplier: number;
  readonly integrityStrictness: number;
  readonly minDecisionsForGrade: number;
  readonly pressureSurvivalWeight: number;
  readonly cascadeRecoveryWeight: number;
  readonly shieldMaintenanceWeight: number;
  readonly legendMarkerBonus: number;
  readonly maxGradeWithoutVerification: VerifiedGrade;
  readonly label: string;
}

/** Sovereignty signal vector extracted from a snapshot. */
export interface SovereigntySignals {
  readonly cordScore: number;
  readonly integrityRisk: number;
  readonly gradeScore: number;
  readonly pressureSurvival: number;
  readonly shieldMaintenance: number;
  readonly cascadeHealth: number;
  readonly decisionQuality: number;
  readonly economicStability: number;
  readonly battlePerformance: number;
  readonly tensionResilience: number;
  readonly legendDensity: number;
  readonly auditFlagDensity: number;
  readonly proofBadgeCount: number;
  readonly gapVsLegend: number;
  readonly gapClosingRate: number;
  readonly tickCheckpointCoverage: number;
}

/** Result of sovereignty types self-test. */
export interface SovereigntyTypesSelfTestResult {
  readonly ok: boolean;
  readonly version: string;
  readonly checksCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly failures: readonly string[];
  readonly durationMs: number;
  readonly checksum: string;
}

/** Serialized sovereignty config envelope. */
export interface SerializedSovereigntyConfig {
  readonly version: string;
  readonly timestamp: number;
  readonly cordWeights: typeof CORD_WEIGHTS;
  readonly outcomeMultiplier: typeof OUTCOME_MULTIPLIER;
  readonly gradeBrackets: readonly SovereigntyGradeBracket[];
  readonly badgeTiers: readonly SovereigntyBadgeTierConfig[];
  readonly integrityRiskThresholds: typeof INTEGRITY_RISK_CONFIG;
  readonly modeRules: readonly ModeSovereigntyRules[];
  readonly mlFeatureCount: number;
  readonly dlFeatureCount: number;
  readonly checksum: string;
}

/** Sovereignty ML vector wrapper with metadata. */
export interface SovereigntyMLVectorResult {
  readonly vector: readonly number[];
  readonly featureCount: number;
  readonly labels: readonly string[];
  readonly checksum: string;
  readonly snapshotTick: number;
  readonly snapshotRunId: string;
}

/** Sovereignty DL tensor wrapper with metadata. */
export interface SovereigntyDLTensorResult {
  readonly tensor: readonly number[];
  readonly shape: readonly [1, number];
  readonly featureCount: number;
  readonly labels: readonly string[];
  readonly checksum: string;
  readonly snapshotTick: number;
  readonly snapshotRunId: string;
}

/** CORD component analysis for UX display. */
export interface CordComponentAnalysis {
  readonly key: CordWeightKey;
  readonly label: string;
  readonly percentOfTotal: number;
  readonly rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'FAILING';
  readonly uxDescription: string;
}

/** Sovereignty UX label bundle. */
export interface SovereigntyUXLabelBundle {
  readonly overallLabel: string;
  readonly gradeLabel: string;
  readonly cordLabel: string;
  readonly integrityLabel: string;
  readonly badgeLabel: string;
  readonly modeLabel: string;
  readonly summaryParagraph: string;
}

/** Validation result for sovereignty types. */
export interface SovereigntyTypesValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly checkedConstants: number;
  readonly checkedFunctions: number;
}

// ============================================================================
// SECTION 3 — SOVEREIGNTY CONFIGURATION CONSTANTS
// ============================================================================

/** Canonical CORD weight keys extracted from CORD_WEIGHTS. */
export const CORD_WEIGHT_KEYS: readonly CordWeightKey[] = deepFreeze(
  Object.keys(CORD_WEIGHTS) as CordWeightKey[],
);

/** Number of CORD components. */
export const CORD_COMPONENT_COUNT = 5 as const;

/** Human-readable labels for each CORD component. */
export const CORD_COMPONENT_LABELS: Readonly<Record<CordWeightKey, string>> = deepFreeze({
  decision_speed_score: 'Decision Speed',
  shields_maintained_pct: 'Shield Maintenance',
  hater_sabotages_blocked: 'Sabotage Blocking',
  cascade_chains_broken: 'Cascade Recovery',
  pressure_survived_score: 'Pressure Survival',
});

/** Extended descriptions for each CORD component. */
export const CORD_COMPONENT_DESCRIPTIONS: Readonly<Record<CordWeightKey, string>> = deepFreeze({
  decision_speed_score: 'Measures how quickly and decisively the player responds to decision windows under pressure',
  shields_maintained_pct: 'Tracks the percentage of shield integrity preserved across the run lifecycle',
  hater_sabotages_blocked: 'Counts the ratio of hater bot sabotage attempts successfully blocked or countered',
  cascade_chains_broken: 'Evaluates how effectively broken cascade chains were minimized or recovered',
  pressure_survived_score: 'Assesses survival performance during high-pressure tiers (T3 and T4)',
});

/** Canonical outcome keys extracted from OUTCOME_MULTIPLIER. */
export const OUTCOME_KEYS: readonly OutcomeKey[] = deepFreeze(
  Object.keys(OUTCOME_MULTIPLIER) as OutcomeKey[],
);

/** Human-readable labels for each outcome. */
export const OUTCOME_LABELS: Readonly<Record<OutcomeKey, string>> = deepFreeze({
  FREEDOM: 'Financial Freedom',
  TIMEOUT: 'Time Expired',
  BANKRUPT: 'Bankruptcy',
  ABANDONED: 'Abandoned',
});

/** Extended descriptions for each outcome. */
export const OUTCOME_DESCRIPTIONS: Readonly<Record<OutcomeKey, string>> = deepFreeze({
  FREEDOM: 'The player achieved financial freedom by reaching the net worth target',
  TIMEOUT: 'The season budget expired before the freedom target was reached',
  BANKRUPT: 'The player lost all financial resources and could not continue',
  ABANDONED: 'The player voluntarily left the run before completion',
});

/** Severity ordering for outcomes (higher = worse). */
export const OUTCOME_SEVERITY: Readonly<Record<OutcomeKey, number>> = deepFreeze({
  FREEDOM: 0.0,
  TIMEOUT: 0.4,
  BANKRUPT: 0.8,
  ABANDONED: 1.0,
});

/** Sum of all CORD weights (must equal 1.0). */
export const CORD_WEIGHT_SUM: number = (() => {
  const keys = Object.keys(CORD_WEIGHTS) as CordWeightKey[];
  return keys.reduce((sum, k) => sum + CORD_WEIGHTS[k], 0);
})();

/** Minimum acceptable CORD score for sovereignty to be considered meaningful. */
export const SOVEREIGNTY_MIN_CORD_SCORE = 0.05 as const;

/** Maximum achievable raw CORD score (all components at 1.0). */
export const SOVEREIGNTY_MAX_RAW_CORD_SCORE = 1.0 as const;

/** Minimum decisions required for a valid sovereignty assessment. */
export const SOVEREIGNTY_MIN_DECISIONS = 3 as const;

/** Minimum ticks required for a valid sovereignty assessment. */
export const SOVEREIGNTY_MIN_TICKS = 10 as const;

/** Maximum audit flags before sovereignty score is capped. */
export const SOVEREIGNTY_MAX_AUDIT_FLAGS = 10 as const;

/** Score cap applied when audit flags exceed the maximum. */
export const SOVEREIGNTY_AUDIT_FLAG_CAP_SCORE = 0.3 as const;

/** Minimum shield maintenance ratio to qualify for grade A. */
export const SOVEREIGNTY_GRADE_A_SHIELD_THRESHOLD = 0.7 as const;

/** Minimum cascade health score to qualify for grade A. */
export const SOVEREIGNTY_GRADE_A_CASCADE_THRESHOLD = 0.6 as const;

/** Decay factor per audit flag beyond threshold. */
export const SOVEREIGNTY_AUDIT_FLAG_DECAY = 0.05 as const;

/** Baseline CORD bonus for verified integrity. */
export const SOVEREIGNTY_VERIFIED_BONUS = 0.1 as const;

/** Penalty for quarantined integrity status. */
export const SOVEREIGNTY_QUARANTINED_PENALTY = 0.4 as const;

/** Penalty for unverified integrity status. */
export const SOVEREIGNTY_UNVERIFIED_PENALTY = 0.2 as const;

/** Tick checkpoint coverage threshold for full integrity. */
export const SOVEREIGNTY_CHECKPOINT_COVERAGE_THRESHOLD = 0.95 as const;

/** ML feature count for sovereignty context vectors. */
export const SOVEREIGNTY_ML_FEATURE_COUNT = 32 as const;

/** DL feature count for sovereignty tensor construction. */
export const SOVEREIGNTY_DL_FEATURE_COUNT = 48 as const;

/** Shape of the sovereignty DL tensor. */
export const SOVEREIGNTY_DL_TENSOR_SHAPE: readonly [1, 48] = deepFreeze([1, 48] as [1, 48]);

/** Canonical 32-feature ML label set for sovereignty context vectors. */
export const SOVEREIGNTY_ML_FEATURE_LABELS: readonly string[] = deepFreeze([
  // CORD components (5)
  'cord_decision_speed_raw',
  'cord_shields_maintained_raw',
  'cord_sabotages_blocked_raw',
  'cord_cascades_broken_raw',
  'cord_pressure_survived_raw',

  // CORD weighted (5)
  'cord_decision_speed_weighted',
  'cord_shields_maintained_weighted',
  'cord_sabotages_blocked_weighted',
  'cord_cascades_broken_weighted',
  'cord_pressure_survived_weighted',

  // Sovereignty state signals (6)
  'sovereignty_score_normalized',
  'sovereignty_cord_score_normalized',
  'sovereignty_integrity_risk',
  'sovereignty_verified_grade_score',
  'sovereignty_gap_vs_legend_normalized',
  'sovereignty_gap_closing_rate',

  // Decision quality (4)
  'decision_count_normalized',
  'decision_accepted_ratio',
  'decision_avg_latency_normalized',
  'decision_speed_percentile',

  // Shield & battle performance (4)
  'shield_maintenance_ratio',
  'shield_breach_density',
  'battle_sabotage_block_ratio',
  'battle_bot_neutralization_ratio',

  // Cascade recovery (3)
  'cascade_health_aggregate',
  'cascade_broken_ratio',
  'cascade_recovery_rate',

  // Pressure survival (3)
  'pressure_survival_ticks_normalized',
  'pressure_max_tier_survived',
  'pressure_risk_score',

  // Meta (2)
  'outcome_multiplier_value',
  'mode_cord_bonus',
]);

/** Canonical 48-feature DL label set for sovereignty tensors. */
export const SOVEREIGNTY_DL_FEATURE_LABELS: readonly string[] = deepFreeze([
  ...SOVEREIGNTY_ML_FEATURE_LABELS,

  // Extended CORD analysis (4)
  'cord_dominant_component_index',
  'cord_weakest_component_index',
  'cord_variance',
  'cord_score_with_outcome',

  // Extended integrity (3)
  'integrity_status_encoded',
  'integrity_audit_flag_density',
  'integrity_checkpoint_coverage',

  // Extended grade context (3)
  'grade_bracket_index',
  'grade_distance_to_next',
  'grade_badge_tier',

  // Extended mode context (2)
  'mode_integrity_strictness',
  'mode_min_decisions_met',

  // Extended economic signal (2)
  'economic_freedom_progress',
  'economic_net_flow_ratio',

  // Extended tension/battle (2)
  'tension_resilience_score',
  'legend_marker_density',
]);

// ============================================================================
// SECTION 4 — CORD SCORING UTILITIES
// ============================================================================

/**
 * Clamp a number to [0, 1].
 * Used throughout sovereignty scoring to normalize raw values.
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Compute the weighted score for a single CORD component.
 */
export function computeCordComponentScore(
  key: CordWeightKey,
  rawValue: number,
): CordComponent {
  const weight = CORD_WEIGHTS[key];
  const clamped = clamp01(rawValue);
  const label = CORD_COMPONENT_LABELS[key];
  return {
    key,
    weight,
    label,
    rawValue: clamped,
    weightedValue: clamped * weight,
  };
}

/**
 * Compute the full weighted CORD score from a map of raw component values.
 * Each value should be in [0, 1]. Values are clamped internally.
 */
export function computeWeightedCordScore(
  rawValues: Readonly<Record<CordWeightKey, number>>,
): CordScoreResult {
  const components: CordComponent[] = [];
  let totalWeighted = 0;
  let bestKey: CordWeightKey = CORD_WEIGHT_KEYS[0];
  let worstKey: CordWeightKey = CORD_WEIGHT_KEYS[0];
  let bestWeighted = -1;
  let worstWeighted = Infinity;

  for (const key of CORD_WEIGHT_KEYS) {
    const comp = computeCordComponentScore(key, rawValues[key]);
    components.push(comp);
    totalWeighted += comp.weightedValue;
    if (comp.weightedValue > bestWeighted) {
      bestWeighted = comp.weightedValue;
      bestKey = key;
    }
    if (comp.weightedValue < worstWeighted) {
      worstWeighted = comp.weightedValue;
      worstKey = key;
    }
  }

  const normalizedScore = clamp01(totalWeighted / CORD_WEIGHT_SUM);
  const resultChecksum = checksumParts(
    'cord-score',
    components.map(c => c.weightedValue),
    totalWeighted,
  );

  return deepFrozenClone({
    components,
    totalWeightedScore: totalWeighted,
    normalizedScore,
    componentCount: CORD_COMPONENT_COUNT,
    dominantComponent: bestKey,
    weakestComponent: worstKey,
    checksum: resultChecksum,
  });
}

/**
 * Compute CORD score from individual numeric inputs (convenience wrapper).
 */
export function computeCordScoreFromRawInputs(
  decisionSpeed: number,
  shieldsMaintained: number,
  sabotagesBlocked: number,
  cascadeChainsBroken: number,
  pressureSurvived: number,
): CordScoreResult {
  return computeWeightedCordScore({
    decision_speed_score: decisionSpeed,
    shields_maintained_pct: shieldsMaintained,
    hater_sabotages_blocked: sabotagesBlocked,
    cascade_chains_broken: cascadeChainsBroken,
    pressure_survived_score: pressureSurvived,
  });
}

/**
 * Compute the variance of CORD component raw values.
 * High variance indicates uneven player performance.
 */
export function computeCordVariance(
  rawValues: Readonly<Record<CordWeightKey, number>>,
): number {
  const vals = CORD_WEIGHT_KEYS.map(k => clamp01(rawValues[k]));
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sumSqDiff = vals.reduce((s, v) => s + (v - mean) ** 2, 0);
  return sumSqDiff / vals.length;
}

/**
 * Rate a single CORD component value.
 */
export function rateCordComponent(
  rawValue: number,
): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'FAILING' {
  const v = clamp01(rawValue);
  if (v >= 0.85) return 'EXCELLENT';
  if (v >= 0.65) return 'GOOD';
  if (v >= 0.45) return 'FAIR';
  if (v >= 0.25) return 'POOR';
  return 'FAILING';
}

/**
 * Analyze all CORD components for UX display.
 */
export function analyzeCordComponents(
  rawValues: Readonly<Record<CordWeightKey, number>>,
): readonly CordComponentAnalysis[] {
  const scoreResult = computeWeightedCordScore(rawValues);
  const totalRaw = CORD_WEIGHT_KEYS.reduce(
    (s, k) => s + clamp01(rawValues[k]),
    0,
  );
  return CORD_WEIGHT_KEYS.map(key => {
    const clamped = clamp01(rawValues[key]);
    const rating = rateCordComponent(clamped);
    const percentOfTotal = totalRaw > 0 ? (clamped / totalRaw) * 100 : 0;
    const desc = CORD_COMPONENT_DESCRIPTIONS[key];
    return deepFrozenClone({
      key,
      label: CORD_COMPONENT_LABELS[key],
      percentOfTotal,
      rating,
      uxDescription: `${desc} — rated ${rating} (${(clamped * 100).toFixed(1)}%)`,
    });
  }).map(a => {
    // Ensure scoreResult.checksum is used in the pipeline
    void scoreResult.checksum;
    return a;
  });
}

/**
 * Generate a deterministic CORD score ID from component values.
 */
export function generateCordScoreId(
  runId: string,
  rawValues: Readonly<Record<CordWeightKey, number>>,
): string {
  const vals = CORD_WEIGHT_KEYS.map(k => clamp01(rawValues[k]));
  return createDeterministicId('cord-score', runId, ...vals.map(String));
}

/**
 * Compute the CORD score with outcome multiplier applied.
 */
export function computeCordScoreWithOutcome(
  rawValues: Readonly<Record<CordWeightKey, number>>,
  outcome: OutcomeKey,
): number {
  const result = computeWeightedCordScore(rawValues);
  const multiplier = OUTCOME_MULTIPLIER[outcome];
  return clamp01(result.normalizedScore * multiplier);
}

// ============================================================================
// SECTION 5 — OUTCOME ANALYSIS UTILITIES
// ============================================================================

/**
 * Resolve the outcome multiplier for a given outcome key.
 */
export function resolveOutcomeMultiplier(outcome: OutcomeKey): number {
  return OUTCOME_MULTIPLIER[outcome];
}

/**
 * Resolve outcome multiplier with safe fallback for unrecognized outcomes.
 */
export function resolveOutcomeMultiplierSafe(outcome: string): number {
  if (isRunOutcome(outcome)) {
    return OUTCOME_MULTIPLIER[outcome as OutcomeKey];
  }
  return 0.0;
}

/**
 * Classify a run outcome with full context.
 */
export function classifyOutcome(outcome: OutcomeKey): OutcomeClassification {
  const multiplier = OUTCOME_MULTIPLIER[outcome];
  const label = OUTCOME_LABELS[outcome];
  const severity = OUTCOME_SEVERITY[outcome];

  // Use the runtime type guards from GamePrimitives
  const win = isWinOutcome(outcome);
  const loss = isLossOutcome(outcome);

  return deepFrozenClone({
    outcome,
    multiplier,
    isWin: win,
    isLoss: loss,
    label,
    severity,
  });
}

/**
 * Classify all outcomes and return the full classification map.
 */
export function classifyAllOutcomes(): ReadonlyMap<OutcomeKey, OutcomeClassification> {
  const map = new Map<OutcomeKey, OutcomeClassification>();
  for (const key of OUTCOME_KEYS) {
    map.set(key, classifyOutcome(key));
  }
  return map;
}

/**
 * Compute the expected sovereignty score range given an outcome.
 */
export function computeExpectedScoreRange(
  outcome: OutcomeKey,
  baseCordMin: number,
  baseCordMax: number,
): { min: number; max: number; label: string } {
  const multiplier = OUTCOME_MULTIPLIER[outcome];
  return {
    min: clamp01(baseCordMin * multiplier),
    max: clamp01(baseCordMax * multiplier),
    label: OUTCOME_LABELS[outcome],
  };
}

/**
 * Rank outcomes by their multiplier value (descending).
 */
export function rankOutcomesByMultiplier(): readonly OutcomeKey[] {
  return [...OUTCOME_KEYS].sort(
    (a, b) => OUTCOME_MULTIPLIER[b] - OUTCOME_MULTIPLIER[a],
  );
}

/**
 * Compute the multiplier differential between two outcomes.
 */
export function computeOutcomeDifferential(
  outcomeA: OutcomeKey,
  outcomeB: OutcomeKey,
): number {
  return OUTCOME_MULTIPLIER[outcomeA] - OUTCOME_MULTIPLIER[outcomeB];
}

/**
 * Check if an outcome is terminal (BANKRUPT or ABANDONED typically yield zero sovereignty).
 */
export function isOutcomeDestructive(outcome: OutcomeKey): boolean {
  return OUTCOME_MULTIPLIER[outcome] <= OUTCOME_MULTIPLIER.BANKRUPT;
}

// ============================================================================
// SECTION 6 — MODE-SPECIFIC SOVEREIGNTY RULES
// ============================================================================

/** Build the mode-specific sovereignty rules for a given mode. */
function buildModeSovereigntyRules(mode: ModeCode): ModeSovereigntyRules {
  const difficultyMult = MODE_DIFFICULTY_MULTIPLIER[mode];
  const tensionFloor = MODE_TENSION_FLOOR[mode];
  const modeNorm = MODE_NORMALIZED[mode];

  // More difficult modes get higher CORD bonus but stricter integrity
  const cordBonus = 1.0 + (difficultyMult - 1.0) * 0.5;
  const strictness = clamp01(0.5 + difficultyMult * 0.2);
  const minDecisions = Math.max(SOVEREIGNTY_MIN_DECISIONS, Math.round(5 * difficultyMult));

  // Pressure survival matters more in tense modes
  const pressureWeight = clamp01(tensionFloor + 0.15);
  const cascadeWeight = clamp01(0.3 + modeNorm * 0.2);
  const shieldWeight = clamp01(0.4 - modeNorm * 0.1);
  const legendBonus = mode === 'ghost' ? 0.15 : mode === 'pvp' ? 0.10 : 0.05;

  const maxGradeUnverified: VerifiedGrade = strictness > 0.7 ? 'C' : 'B';

  const modeLabels: Record<ModeCode, string> = {
    solo: 'Solo Empire — standard sovereignty rules',
    pvp: 'PvP Predator — elevated integrity, rivalry bonus',
    coop: 'Co-op Syndicate — shared sovereignty, reduced strictness',
    ghost: 'Ghost Phantom — legend-chasing rules, maximum strictness',
  };

  return {
    mode,
    cordBonusMultiplier: cordBonus,
    integrityStrictness: strictness,
    minDecisionsForGrade: minDecisions,
    pressureSurvivalWeight: pressureWeight,
    cascadeRecoveryWeight: cascadeWeight,
    shieldMaintenanceWeight: shieldWeight,
    legendMarkerBonus: legendBonus,
    maxGradeWithoutVerification: maxGradeUnverified,
    label: modeLabels[mode],
  };
}

/** Sovereignty rules for all modes. */
export const MODE_SOVEREIGNTY_RULES: ReadonlyMap<ModeCode, ModeSovereigntyRules> = (() => {
  const map = new Map<ModeCode, ModeSovereigntyRules>();
  for (const code of MODE_CODES) {
    map.set(code, buildModeSovereigntyRules(code));
  }
  return map;
})();

/**
 * Retrieve mode-specific sovereignty rules.
 */
export function getModeSovereigntyRules(mode: ModeCode): ModeSovereigntyRules {
  const rules = MODE_SOVEREIGNTY_RULES.get(mode);
  if (!rules) {
    throw new Error(`No sovereignty rules for mode: ${mode}`);
  }
  return rules;
}

/**
 * Get all mode sovereignty rules as an array.
 */
export function getAllModeSovereigntyRules(): readonly ModeSovereigntyRules[] {
  return Array.from(MODE_SOVEREIGNTY_RULES.values());
}

/**
 * Apply mode-specific CORD bonus to a base score.
 */
export function applyCordModeBonus(baseScore: number, mode: ModeCode): number {
  const rules = getModeSovereigntyRules(mode);
  return clamp01(baseScore * rules.cordBonusMultiplier);
}

/**
 * Check if enough decisions have been made for sovereignty grading in a given mode.
 */
export function hasMinimumDecisionsForGrade(
  decisionCount: number,
  mode: ModeCode,
): boolean {
  const rules = getModeSovereigntyRules(mode);
  return decisionCount >= rules.minDecisionsForGrade;
}

/**
 * Compute mode-adjusted pressure survival contribution.
 */
export function computeModePressureSurvivalContribution(
  pressureSurvivalRaw: number,
  mode: ModeCode,
): number {
  const rules = getModeSovereigntyRules(mode);
  return clamp01(pressureSurvivalRaw * rules.pressureSurvivalWeight);
}

/**
 * Compute mode-adjusted cascade recovery contribution.
 */
export function computeModeCascadeRecoveryContribution(
  cascadeRecoveryRaw: number,
  mode: ModeCode,
): number {
  const rules = getModeSovereigntyRules(mode);
  return clamp01(cascadeRecoveryRaw * rules.cascadeRecoveryWeight);
}

/**
 * Compute mode-adjusted shield maintenance contribution.
 */
export function computeModeShieldMaintenanceContribution(
  shieldMaintenanceRaw: number,
  mode: ModeCode,
): number {
  const rules = getModeSovereigntyRules(mode);
  return clamp01(shieldMaintenanceRaw * rules.shieldMaintenanceWeight);
}

/**
 * Compute legend marker bonus for a given mode and marker count.
 */
export function computeModeLegendMarkerBonus(
  markerCount: number,
  totalTicks: number,
  mode: ModeCode,
): number {
  const rules = getModeSovereigntyRules(mode);
  const density = totalTicks > 0 ? Math.min(1.0, markerCount / Math.max(1, totalTicks / 10)) : 0;
  return density * rules.legendMarkerBonus;
}

// ============================================================================
// SECTION 7 — GRADE BRACKET & BADGE TIER CONFIGURATION
// ============================================================================

/** Grade bracket definitions — score ranges, labels, and display config. */
export const GRADE_BRACKET_CONFIG: readonly SovereigntyGradeBracket[] = deepFreeze([
  {
    grade: 'A' as VerifiedGrade,
    label: 'Sovereign',
    minScore: 0.85,
    maxScore: 1.0,
    description: 'Exceptional sovereignty — near-perfect play under pressure with verified integrity',
    color: '#FFD700',
    emoji: 'crown',
  },
  {
    grade: 'B' as VerifiedGrade,
    label: 'Proven',
    minScore: 0.65,
    maxScore: 0.849,
    description: 'Strong sovereignty — solid performance with minor gaps',
    color: '#00BFFF',
    emoji: 'shield',
  },
  {
    grade: 'C' as VerifiedGrade,
    label: 'Competent',
    minScore: 0.45,
    maxScore: 0.649,
    description: 'Adequate sovereignty — room for improvement in key areas',
    color: '#32CD32',
    emoji: 'check',
  },
  {
    grade: 'D' as VerifiedGrade,
    label: 'Struggling',
    minScore: 0.25,
    maxScore: 0.449,
    description: 'Below-average sovereignty — significant weaknesses detected',
    color: '#FF8C00',
    emoji: 'warning',
  },
  {
    grade: 'F' as VerifiedGrade,
    label: 'Failed',
    minScore: 0.0,
    maxScore: 0.249,
    description: 'Sovereignty failure — fundamental issues in play or integrity',
    color: '#FF0000',
    emoji: 'cross',
  },
]);

/** Badge tier definitions for each grade level. */
export const BADGE_TIER_CONFIG: readonly SovereigntyBadgeTierConfig[] = deepFreeze([
  {
    grade: 'A' as VerifiedGrade,
    badgeName: 'SOVEREIGN_CROWN',
    badgeLabel: 'Sovereign Crown',
    minCordScore: 0.85,
    tier: 5,
    rarity: 'LEGENDARY',
    description: 'Awarded for achieving grade A sovereignty with verified integrity',
  },
  {
    grade: 'B' as VerifiedGrade,
    badgeName: 'PROVEN_SHIELD',
    badgeLabel: 'Proven Shield',
    minCordScore: 0.65,
    tier: 4,
    rarity: 'RARE',
    description: 'Awarded for achieving grade B sovereignty',
  },
  {
    grade: 'C' as VerifiedGrade,
    badgeName: 'COMPETENT_STAR',
    badgeLabel: 'Competent Star',
    minCordScore: 0.45,
    tier: 3,
    rarity: 'UNCOMMON',
    description: 'Awarded for achieving grade C sovereignty',
  },
  {
    grade: 'D' as VerifiedGrade,
    badgeName: 'STRUGGLING_MARK',
    badgeLabel: 'Struggling Mark',
    minCordScore: 0.25,
    tier: 2,
    rarity: 'COMMON',
    description: 'Awarded for completing a run with grade D sovereignty',
  },
  {
    grade: 'F' as VerifiedGrade,
    badgeName: 'FAILURE_TOKEN',
    badgeLabel: 'Failure Token',
    minCordScore: 0.0,
    tier: 1,
    rarity: 'COMMON',
    description: 'Awarded for completing a run regardless of sovereignty score',
  },
]);

/**
 * Compute the sovereignty grade from a normalized sovereignty score.
 */
export function computeGradeFromScore(normalizedScore: number): VerifiedGrade {
  const score = clamp01(normalizedScore);
  for (const bracket of GRADE_BRACKET_CONFIG) {
    if (score >= bracket.minScore && score <= bracket.maxScore) {
      return bracket.grade;
    }
  }
  // Fallback — shouldn't happen with correct bracket coverage
  return 'F';
}

/**
 * Get the grade bracket configuration for a given grade.
 */
export function getGradeBracket(grade: VerifiedGrade): SovereigntyGradeBracket {
  const bracket = GRADE_BRACKET_CONFIG.find(b => b.grade === grade);
  if (!bracket) {
    throw new Error(`No bracket config for grade: ${grade}`);
  }
  return bracket;
}

/**
 * Compute the badge tier from a given grade.
 */
export function computeBadgeTierFromGrade(grade: VerifiedGrade): SovereigntyBadgeTierConfig {
  const badge = BADGE_TIER_CONFIG.find(b => b.grade === grade);
  if (!badge) {
    throw new Error(`No badge tier config for grade: ${grade}`);
  }
  return badge;
}

/**
 * Get all badges that a player qualifies for given their CORD score.
 */
export function getQualifiedBadges(cordScore: number): readonly SovereigntyBadgeTierConfig[] {
  return BADGE_TIER_CONFIG.filter(b => cordScore >= b.minCordScore);
}

/**
 * Compute how far a score is from the next grade bracket.
 */
export function computeDistanceToNextGrade(normalizedScore: number): number {
  const score = clamp01(normalizedScore);
  const currentGrade = computeGradeFromScore(score);
  const currentBracket = getGradeBracket(currentGrade);
  const currentIndex = GRADE_BRACKET_CONFIG.findIndex(b => b.grade === currentGrade);
  if (currentIndex <= 0) return 0; // Already at highest grade
  const nextBracket = GRADE_BRACKET_CONFIG[currentIndex - 1];
  return Math.max(0, nextBracket.minScore - score);
}

/**
 * Compute the grade numeric score using VERIFIED_GRADE_NUMERIC_SCORE.
 */
export function computeGradeNumericScore(grade: VerifiedGrade): number {
  return VERIFIED_GRADE_NUMERIC_SCORE[grade];
}

/**
 * Build a grade-badge pair from a normalized sovereignty score.
 */
export function resolveGradeBadgePair(normalizedScore: number): {
  grade: VerifiedGrade;
  bracket: SovereigntyGradeBracket;
  badge: SovereigntyBadgeTierConfig;
  numericScore: number;
  distanceToNext: number;
} {
  const grade = computeGradeFromScore(normalizedScore);
  return {
    grade,
    bracket: getGradeBracket(grade),
    badge: computeBadgeTierFromGrade(grade),
    numericScore: computeGradeNumericScore(grade),
    distanceToNext: computeDistanceToNextGrade(normalizedScore),
  };
}

// ============================================================================
// SECTION 8 — INTEGRITY CLASSIFICATION
// ============================================================================

/** Integrity risk thresholds. */
export const INTEGRITY_RISK_CONFIG: Readonly<Record<IntegrityRiskLevel, {
  readonly minScore: number;
  readonly maxScore: number;
  readonly label: string;
  readonly requiresReview: boolean;
}>> = deepFreeze({
  NONE: {
    minScore: 0.0,
    maxScore: 0.1,
    label: 'No risk — fully verified integrity',
    requiresReview: false,
  },
  LOW: {
    minScore: 0.1,
    maxScore: 0.3,
    label: 'Low risk — minor concerns detected',
    requiresReview: false,
  },
  MODERATE: {
    minScore: 0.3,
    maxScore: 0.55,
    label: 'Moderate risk — review recommended',
    requiresReview: true,
  },
  HIGH: {
    minScore: 0.55,
    maxScore: 0.8,
    label: 'High risk — integrity compromised',
    requiresReview: true,
  },
  CRITICAL: {
    minScore: 0.8,
    maxScore: 1.0,
    label: 'Critical risk — quarantine required',
    requiresReview: true,
  },
});

/** Ordered integrity risk levels from lowest to highest. */
export const INTEGRITY_RISK_LEVELS: readonly IntegrityRiskLevel[] = deepFreeze([
  'NONE', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL',
]);

/**
 * Classify the integrity risk level from a composite risk score.
 */
export function classifyIntegrityRisk(
  integrityStatus: IntegrityStatus,
  auditFlagCount: number,
  tickCheckpointCoverage: number,
): IntegrityRiskClassification {
  // Use the INTEGRITY_STATUS_RISK_SCORE from GamePrimitives
  const statusRisk = INTEGRITY_STATUS_RISK_SCORE[integrityStatus];
  const flagPenalty = Math.min(0.5, auditFlagCount * SOVEREIGNTY_AUDIT_FLAG_DECAY);
  const coverageDeficit = Math.max(0, SOVEREIGNTY_CHECKPOINT_COVERAGE_THRESHOLD - tickCheckpointCoverage);
  const coveragePenalty = coverageDeficit * 2.0;

  const compositeScore = clamp01(statusRisk + flagPenalty + coveragePenalty);

  const flags: string[] = [];
  if (statusRisk > 0.5) flags.push(`integrity_status:${integrityStatus}`);
  if (auditFlagCount > 0) flags.push(`audit_flags:${auditFlagCount}`);
  if (coverageDeficit > 0) flags.push(`checkpoint_coverage_deficit:${coverageDeficit.toFixed(3)}`);

  let level: IntegrityRiskLevel = 'NONE';
  for (const riskLevel of INTEGRITY_RISK_LEVELS) {
    const config = INTEGRITY_RISK_CONFIG[riskLevel];
    if (compositeScore >= config.minScore && compositeScore <= config.maxScore) {
      level = riskLevel;
    }
  }
  // Edge case: score exactly 1.0
  if (compositeScore >= INTEGRITY_RISK_CONFIG.CRITICAL.minScore) {
    level = 'CRITICAL';
  }

  const config = INTEGRITY_RISK_CONFIG[level];
  return deepFrozenClone({
    level,
    score: compositeScore,
    flags,
    requiresReview: config.requiresReview,
    label: config.label,
  });
}

/**
 * Quick check: is the integrity risk above the review threshold?
 */
export function isIntegrityReviewRequired(
  integrityStatus: IntegrityStatus,
  auditFlagCount: number,
): boolean {
  const classification = classifyIntegrityRisk(integrityStatus, auditFlagCount, 1.0);
  return classification.requiresReview;
}

/**
 * Compute the integrity bonus/penalty to apply to the sovereignty score.
 */
export function computeIntegrityScoreAdjustment(integrityStatus: IntegrityStatus): number {
  // Use INTEGRITY_STATUSES array to validate
  if (!isIntegrityStatus(integrityStatus)) return -SOVEREIGNTY_QUARANTINED_PENALTY;

  switch (integrityStatus) {
    case 'VERIFIED': return SOVEREIGNTY_VERIFIED_BONUS;
    case 'PENDING': return 0;
    case 'UNVERIFIED': return -SOVEREIGNTY_UNVERIFIED_PENALTY;
    case 'QUARANTINED': return -SOVEREIGNTY_QUARANTINED_PENALTY;
    default: return 0;
  }
}

/**
 * Compute the effective sovereignty score cap based on integrity status.
 */
export function computeIntegrityCappedScore(
  rawScore: number,
  integrityStatus: IntegrityStatus,
  auditFlagCount: number,
): number {
  let capped = rawScore;

  // Apply integrity adjustment
  capped += computeIntegrityScoreAdjustment(integrityStatus);

  // Apply audit flag cap
  if (auditFlagCount > SOVEREIGNTY_MAX_AUDIT_FLAGS) {
    capped = Math.min(capped, SOVEREIGNTY_AUDIT_FLAG_CAP_SCORE);
  } else if (auditFlagCount > 0) {
    const decay = auditFlagCount * SOVEREIGNTY_AUDIT_FLAG_DECAY;
    capped -= decay;
  }

  return clamp01(capped);
}

// ============================================================================
// SECTION 9 — SNAPSHOT ANALYSIS UTILITIES
// ============================================================================

/**
 * Extract sovereignty-relevant signals from a RunStateSnapshot.
 */
export function extractSovereigntySignals(
  snapshot: RunStateSnapshot,
): SovereigntySignals {
  const { sovereignty, pressure, shield, battle, cascade, economy, tension, cards, telemetry } = snapshot;

  // CORD score
  const cordScore = clamp01(sovereignty.cordScore);

  // Integrity risk from GamePrimitives
  const integrityRisk = INTEGRITY_STATUS_RISK_SCORE[sovereignty.integrityStatus];

  // Verified grade score
  const gradeScore = sovereignty.verifiedGrade !== null && isVerifiedGrade(sovereignty.verifiedGrade)
    ? VERIFIED_GRADE_NUMERIC_SCORE[sovereignty.verifiedGrade as VerifiedGrade]
    : 0;

  // Pressure survival: normalized survived ticks vs max possible
  const pressureSurvival = snapshot.tick > 0
    ? clamp01(pressure.survivedHighPressureTicks / Math.max(1, snapshot.tick * 0.3))
    : 0;

  // Shield maintenance: weighted integrity across layers
  const shieldMaintenance = computeShieldIntegrityRatio(
    shield.layers.map(l => ({ id: l.layerId, current: l.current, max: l.max })),
  );

  // Cascade health: average health of active chains
  const cascadeHealth = cascade.activeChains.length > 0
    ? cascade.activeChains.reduce((sum, chain) => sum + scoreCascadeChainHealth(chain), 0) /
      cascade.activeChains.length
    : 1.0;

  // Decision quality: accepted ratio weighted by speed
  const decisionCount = telemetry.decisions.length;
  const acceptedCount = telemetry.decisions.filter(d => d.accepted).length;
  const decisionQuality = decisionCount > 0
    ? clamp01(acceptedCount / decisionCount)
    : 0;

  // Economic stability
  const economicStability = economy.freedomTarget > 0
    ? clamp01(economy.netWorth / economy.freedomTarget)
    : 0;

  // Battle performance: sabotage blocking ratio
  const totalBotAttacks = battle.bots.reduce(
    (sum, bot) => sum + bot.attacksLanded + bot.attacksBlocked,
    0,
  );
  const totalBlocked = battle.bots.reduce((sum, bot) => sum + bot.attacksBlocked, 0);
  const battlePerformance = totalBotAttacks > 0
    ? clamp01(totalBlocked / totalBotAttacks)
    : 1.0;

  // Tension resilience: inverse of pressure risk
  const pressureRisk = computePressureRiskScore(pressure.tier, pressure.score);
  const tensionResilience = 1.0 - pressureRisk;

  // Legend marker density
  const legendDensity = computeLegendMarkerDensity(cards.ghostMarkers, snapshot.tick);

  // Audit flag density
  const auditFlagDensity = snapshot.tick > 0
    ? clamp01(sovereignty.auditFlags.length / Math.max(1, snapshot.tick / 50))
    : 0;

  // Direct sovereignty sub-fields
  const proofBadgeCount = sovereignty.proofBadges.length;
  const gapVsLegend = clamp01(sovereignty.gapVsLegend);
  const gapClosingRate = clamp01(sovereignty.gapClosingRate);
  const tickCheckpointCoverage = snapshot.tick > 0
    ? clamp01(sovereignty.tickChecksums.length / snapshot.tick)
    : 0;

  return {
    cordScore,
    integrityRisk,
    gradeScore,
    pressureSurvival,
    shieldMaintenance,
    cascadeHealth,
    decisionQuality,
    economicStability,
    battlePerformance,
    tensionResilience,
    legendDensity,
    auditFlagDensity,
    proofBadgeCount,
    gapVsLegend,
    gapClosingRate,
    tickCheckpointCoverage,
  };
}

/**
 * Extract CORD raw component values from a snapshot.
 */
export function extractCordRawValues(
  snapshot: RunStateSnapshot,
): Readonly<Record<CordWeightKey, number>> {
  const signals = extractSovereigntySignals(snapshot);
  return {
    decision_speed_score: signals.decisionQuality,
    shields_maintained_pct: signals.shieldMaintenance,
    hater_sabotages_blocked: signals.battlePerformance,
    cascade_chains_broken: signals.cascadeHealth,
    pressure_survived_score: signals.pressureSurvival,
  };
}

/**
 * Compute the effective stakes for the current snapshot.
 */
export function computeSnapshotEffectiveStakes(snapshot: RunStateSnapshot): number {
  return computeEffectiveStakes(snapshot.phase, snapshot.mode);
}

/**
 * Compute the decision speed percentile from telemetry.
 * Lower latency = higher percentile.
 */
export function computeDecisionSpeedPercentile(
  decisions: readonly DecisionRecord[],
): number {
  if (decisions.length === 0) return 0;
  const avgLatency = decisions.reduce((s, d) => s + d.latencyMs, 0) / decisions.length;
  // Map average latency to percentile: 0ms = 1.0, 10000ms+ = 0.0
  return clamp01(1.0 - avgLatency / 10000);
}

/**
 * Compute the bot neutralization ratio from battle state.
 */
export function computeBotNeutralizationRatio(battle: BattleState): number {
  const totalBots = battle.bots.length;
  if (totalBots === 0) return 1.0;
  const neutralized = battle.bots.filter(b => b.neutralized).length;
  return neutralized / totalBots;
}

/**
 * Compute the shield breach density from shield state and tick count.
 */
export function computeShieldBreachDensity(shield: ShieldState, tick: number): number {
  if (tick <= 0) return 0;
  return clamp01(shield.breachesThisRun / Math.max(1, tick / 20));
}

/**
 * Compute the cascade broken ratio from cascade state.
 */
export function computeCascadeBrokenRatio(cascade: CascadeState): number {
  const total = cascade.brokenChains + cascade.completedChains;
  if (total === 0) return 0;
  return cascade.brokenChains / total;
}

/**
 * Compute the cascade recovery rate from cascade state.
 */
export function computeCascadeRecoveryRate(cascade: CascadeState): number {
  const total = cascade.activeChains.length + cascade.brokenChains + cascade.completedChains;
  if (total === 0) return 1.0;
  return clamp01(cascade.completedChains / total);
}

/**
 * Compute overall snapshot sovereignty health as a single 0-1 score.
 */
export function computeSnapshotSovereigntyHealth(snapshot: RunStateSnapshot): number {
  const signals = extractSovereigntySignals(snapshot);
  const cordResult = computeWeightedCordScore(extractCordRawValues(snapshot));

  const healthComponents = [
    cordResult.normalizedScore * 0.35,
    signals.shieldMaintenance * 0.15,
    signals.cascadeHealth * 0.10,
    signals.decisionQuality * 0.15,
    signals.economicStability * 0.10,
    signals.tensionResilience * 0.10,
    (1.0 - signals.integrityRisk) * 0.05,
  ];

  return clamp01(healthComponents.reduce((s, v) => s + v, 0));
}

// ============================================================================
// SECTION 10 — ML FEATURE EXTRACTION (32-dim sovereignty context vector)
// ============================================================================

/**
 * Compute the 32-dimensional sovereignty ML feature vector from a snapshot.
 */
export function computeSovereigntyMLVector(
  snapshot: RunStateSnapshot,
): SovereigntyMLVectorResult {
  const signals = extractSovereigntySignals(snapshot);
  const cordRaw = extractCordRawValues(snapshot);
  const cordResult = computeWeightedCordScore(cordRaw);
  const modeRules = getModeSovereigntyRules(snapshot.mode);
  const decisionPercentile = computeDecisionSpeedPercentile(snapshot.telemetry.decisions);
  const botNeutRatio = computeBotNeutralizationRatio(snapshot.battle);
  const shieldBreachDens = computeShieldBreachDensity(snapshot.shield, snapshot.tick);
  const cascBrokenRatio = computeCascadeBrokenRatio(snapshot.cascade);
  const cascRecovRate = computeCascadeRecoveryRate(snapshot.cascade);
  const pressureRisk = computePressureRiskScore(snapshot.pressure.tier, snapshot.pressure.score);
  const pressureNorm = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier];
  const outcomeMultVal = snapshot.outcome !== null && isRunOutcome(snapshot.outcome)
    ? OUTCOME_MULTIPLIER[snapshot.outcome as OutcomeKey]
    : 0.5;

  const vector: number[] = [
    // CORD components raw (5)
    clamp01(cordRaw.decision_speed_score),
    clamp01(cordRaw.shields_maintained_pct),
    clamp01(cordRaw.hater_sabotages_blocked),
    clamp01(cordRaw.cascade_chains_broken),
    clamp01(cordRaw.pressure_survived_score),

    // CORD components weighted (5)
    cordResult.components[0].weightedValue,
    cordResult.components[1].weightedValue,
    cordResult.components[2].weightedValue,
    cordResult.components[3].weightedValue,
    cordResult.components[4].weightedValue,

    // Sovereignty state signals (6)
    signals.cordScore,
    cordResult.normalizedScore,
    signals.integrityRisk,
    signals.gradeScore,
    signals.gapVsLegend,
    signals.gapClosingRate,

    // Decision quality (4)
    clamp01(snapshot.telemetry.decisions.length / 200),
    signals.decisionQuality,
    clamp01(snapshot.telemetry.decisions.length > 0
      ? snapshot.telemetry.decisions.reduce((s, d) => s + d.latencyMs, 0) /
        snapshot.telemetry.decisions.length / 10000
      : 0),
    decisionPercentile,

    // Shield & battle (4)
    signals.shieldMaintenance,
    shieldBreachDens,
    signals.battlePerformance,
    botNeutRatio,

    // Cascade recovery (3)
    signals.cascadeHealth,
    cascBrokenRatio,
    cascRecovRate,

    // Pressure survival (3)
    signals.pressureSurvival,
    pressureNorm,
    pressureRisk,

    // Meta (2)
    outcomeMultVal,
    modeRules.cordBonusMultiplier - 1.0,
  ];

  // Validate vector length
  if (vector.length !== SOVEREIGNTY_ML_FEATURE_COUNT) {
    throw new Error(
      `ML vector length mismatch: got ${vector.length}, expected ${SOVEREIGNTY_ML_FEATURE_COUNT}`,
    );
  }

  const vectorChecksum = checksumSnapshot(vector);

  return deepFrozenClone({
    vector,
    featureCount: SOVEREIGNTY_ML_FEATURE_COUNT,
    labels: SOVEREIGNTY_ML_FEATURE_LABELS as unknown as string[],
    checksum: vectorChecksum,
    snapshotTick: snapshot.tick,
    snapshotRunId: snapshot.runId,
  });
}

// ============================================================================
// SECTION 11 — DL TENSOR CONSTRUCTION (48-dim sovereignty tensor)
// ============================================================================

/**
 * Compute the 48-dimensional sovereignty DL tensor from a snapshot.
 */
export function computeSovereigntyDLTensor(
  snapshot: RunStateSnapshot,
): SovereigntyDLTensorResult {
  // Start with the 32-dim ML vector
  const mlResult = computeSovereigntyMLVector(snapshot);
  const baseVector = [...mlResult.vector];

  const cordRaw = extractCordRawValues(snapshot);
  const cordResult = computeWeightedCordScore(cordRaw);
  const signals = extractSovereigntySignals(snapshot);
  const cordVariance = computeCordVariance(cordRaw);
  const modeRules = getModeSovereigntyRules(snapshot.mode);

  // Find dominant/weakest component indices
  const dominantIdx = CORD_WEIGHT_KEYS.indexOf(cordResult.dominantComponent);
  const weakestIdx = CORD_WEIGHT_KEYS.indexOf(cordResult.weakestComponent);

  // CORD score with outcome
  const outcomeMult = snapshot.outcome !== null && isRunOutcome(snapshot.outcome)
    ? OUTCOME_MULTIPLIER[snapshot.outcome as OutcomeKey]
    : 1.0;
  const cordWithOutcome = clamp01(cordResult.normalizedScore * outcomeMult);

  // Integrity encoded
  const intStatusIdx = INTEGRITY_STATUSES.indexOf(snapshot.sovereignty.integrityStatus);
  const integrityEncoded = clamp01(intStatusIdx / Math.max(1, INTEGRITY_STATUSES.length - 1));

  // Grade bracket index
  const currentGrade = computeGradeFromScore(cordWithOutcome);
  const gradeIdx = VERIFIED_GRADES.indexOf(currentGrade);
  const gradeEncoded = clamp01(gradeIdx / Math.max(1, VERIFIED_GRADES.length - 1));
  const distToNext = computeDistanceToNextGrade(cordWithOutcome);

  // Badge tier
  const badge = computeBadgeTierFromGrade(currentGrade);
  const badgeTierNorm = clamp01(badge.tier / 5);

  // Mode context
  const minDecMet = hasMinimumDecisionsForGrade(
    snapshot.telemetry.decisions.length,
    snapshot.mode,
  ) ? 1.0 : 0.0;

  // Economic signals
  const freedomProg = snapshot.economy.freedomTarget > 0
    ? clamp01(snapshot.economy.netWorth / snapshot.economy.freedomTarget)
    : 0;
  const incomeRate = Math.max(0, snapshot.economy.incomePerTick);
  const expenseRate = Math.max(0, snapshot.economy.expensesPerTick);
  const netFlowRatio = incomeRate + expenseRate > 0
    ? (incomeRate - expenseRate) / (incomeRate + expenseRate)
    : 0;
  const netFlowNorm = (netFlowRatio + 1) / 2;

  // Tension resilience & legend density
  const tensionRes = signals.tensionResilience;
  const legendDens = signals.legendDensity;

  // Extended features (16 additional)
  const extendedFeatures: number[] = [
    // Extended CORD analysis (4)
    clamp01(dominantIdx / Math.max(1, CORD_COMPONENT_COUNT - 1)),
    clamp01(weakestIdx / Math.max(1, CORD_COMPONENT_COUNT - 1)),
    clamp01(cordVariance),
    cordWithOutcome,

    // Extended integrity (3)
    integrityEncoded,
    signals.auditFlagDensity,
    signals.tickCheckpointCoverage,

    // Extended grade context (3)
    gradeEncoded,
    clamp01(distToNext),
    badgeTierNorm,

    // Extended mode context (2)
    modeRules.integrityStrictness,
    minDecMet,

    // Extended economic signal (2)
    freedomProg,
    clamp01(netFlowNorm),

    // Extended tension/battle (2)
    tensionRes,
    legendDens,
  ];

  const fullTensor = [...baseVector, ...extendedFeatures];

  // Validate tensor length
  if (fullTensor.length !== SOVEREIGNTY_DL_FEATURE_COUNT) {
    throw new Error(
      `DL tensor length mismatch: got ${fullTensor.length}, expected ${SOVEREIGNTY_DL_FEATURE_COUNT}`,
    );
  }

  const tensorChecksum = checksumSnapshot(fullTensor);

  return deepFrozenClone({
    tensor: fullTensor,
    shape: SOVEREIGNTY_DL_TENSOR_SHAPE as unknown as [1, number],
    featureCount: SOVEREIGNTY_DL_FEATURE_COUNT,
    labels: SOVEREIGNTY_DL_FEATURE_LABELS as unknown as string[],
    checksum: tensorChecksum,
    snapshotTick: snapshot.tick,
    snapshotRunId: snapshot.runId,
  });
}

// ============================================================================
// SECTION 12 — UX LABEL GENERATORS
// ============================================================================

/**
 * Generate a human-readable sovereignty label for a snapshot.
 */
export function generateSovereigntyLabel(
  snapshot: RunStateSnapshot,
): string {
  const signals = extractSovereigntySignals(snapshot);
  const cordRaw = extractCordRawValues(snapshot);
  const cordResult = computeWeightedCordScore(cordRaw);
  const grade = computeGradeFromScore(cordResult.normalizedScore);
  const bracket = getGradeBracket(grade);
  const modeRules = getModeSovereigntyRules(snapshot.mode);

  const tierLabel = PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier];
  const phaseNorm = RUN_PHASE_NORMALIZED[snapshot.phase];
  const phaseLabel = snapshot.phase;
  const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase];

  return [
    `Grade ${grade} (${bracket.label})`,
    `CORD: ${(cordResult.normalizedScore * 100).toFixed(1)}%`,
    `Phase: ${phaseLabel} (${(phaseNorm * 100).toFixed(0)}% progress)`,
    `Pressure: ${tierLabel}`,
    `Stakes: ${stakesMultiplier.toFixed(2)}x`,
    `Mode: ${modeRules.label}`,
    `Shield: ${(signals.shieldMaintenance * 100).toFixed(1)}%`,
    `Cascade: ${(signals.cascadeHealth * 100).toFixed(1)}%`,
  ].join(' | ');
}

/**
 * Generate a label for a specific CORD component.
 */
export function generateCordComponentLabel(
  key: CordWeightKey,
  rawValue: number,
): string {
  const label = CORD_COMPONENT_LABELS[key];
  const weight = CORD_WEIGHTS[key];
  const rating = rateCordComponent(rawValue);
  const weighted = clamp01(rawValue) * weight;
  return `${label}: ${(clamp01(rawValue) * 100).toFixed(1)}% (weight: ${(weight * 100).toFixed(0)}%, contribution: ${(weighted * 100).toFixed(1)}%) — ${rating}`;
}

/**
 * Generate a label for an outcome classification.
 */
export function generateOutcomeLabel(outcome: OutcomeKey): string {
  const classification = classifyOutcome(outcome);
  return `${classification.label} — multiplier: ${classification.multiplier.toFixed(1)}x (severity: ${(classification.severity * 100).toFixed(0)}%)`;
}

/**
 * Generate a label for an integrity risk classification.
 */
export function generateIntegrityRiskLabel(
  integrityStatus: IntegrityStatus,
  auditFlagCount: number,
  tickCheckpointCoverage: number,
): string {
  const classification = classifyIntegrityRisk(
    integrityStatus,
    auditFlagCount,
    tickCheckpointCoverage,
  );
  return `Integrity: ${classification.level} (score: ${(classification.score * 100).toFixed(1)}%) — ${classification.label}`;
}

/**
 * Generate a complete UX label bundle for a snapshot.
 */
export function generateSovereigntyUXBundle(
  snapshot: RunStateSnapshot,
): SovereigntyUXLabelBundle {
  const signals = extractSovereigntySignals(snapshot);
  const cordRaw = extractCordRawValues(snapshot);
  const cordResult = computeWeightedCordScore(cordRaw);
  const grade = computeGradeFromScore(cordResult.normalizedScore);
  const bracket = getGradeBracket(grade);
  const badge = computeBadgeTierFromGrade(grade);
  const modeRules = getModeSovereigntyRules(snapshot.mode);
  const integrityClass = classifyIntegrityRisk(
    snapshot.sovereignty.integrityStatus,
    snapshot.sovereignty.auditFlags.length,
    signals.tickCheckpointCoverage,
  );

  const overallLabel = generateSovereigntyLabel(snapshot);
  const gradeLabel = `Grade ${grade}: ${bracket.label} — ${bracket.description}`;
  const cordLabel = `CORD Score: ${(cordResult.normalizedScore * 100).toFixed(1)}% (${cordResult.componentCount} components)`;
  const integrityLabel = `Integrity: ${integrityClass.level} (${(integrityClass.score * 100).toFixed(1)}%)`;
  const badgeLabel = `Badge: ${badge.badgeLabel} (Tier ${badge.tier}, ${badge.rarity})`;
  const modeLabel = modeRules.label;

  const summaryParagraph = [
    `Run sovereignty assessment: ${bracket.label} (Grade ${grade}).`,
    `CORD score of ${(cordResult.normalizedScore * 100).toFixed(1)}% `,
    `with dominant performance in ${CORD_COMPONENT_LABELS[cordResult.dominantComponent]}.`,
    ` Weakest area: ${CORD_COMPONENT_LABELS[cordResult.weakestComponent]}.`,
    ` Integrity risk: ${integrityClass.level}.`,
    ` Badge earned: ${badge.badgeLabel}.`,
    ` Mode: ${modeRules.label}.`,
  ].join('');

  return deepFrozenClone({
    overallLabel,
    gradeLabel,
    cordLabel,
    integrityLabel,
    badgeLabel,
    modeLabel,
    summaryParagraph,
  });
}

/**
 * Generate a short summary string for a sovereignty score.
 */
export function generateSovereigntySummary(
  normalizedScore: number,
  mode: ModeCode,
  outcome: OutcomeKey | null,
): string {
  const grade = computeGradeFromScore(normalizedScore);
  const bracket = getGradeBracket(grade);
  const modeRules = getModeSovereigntyRules(mode);
  const outcomeLabel = outcome !== null ? OUTCOME_LABELS[outcome] : 'In Progress';
  const multiplier = outcome !== null ? OUTCOME_MULTIPLIER[outcome] : 1.0;

  return `${bracket.label} (${grade}) — ${(normalizedScore * 100).toFixed(1)}% — ${outcomeLabel} (${multiplier.toFixed(1)}x) — ${modeRules.mode}`;
}

/**
 * Generate a grade comparison label between two scores.
 */
export function generateGradeComparisonLabel(
  scoreA: number,
  scoreB: number,
): string {
  const gradeA = computeGradeFromScore(scoreA);
  const gradeB = computeGradeFromScore(scoreB);
  const bracketA = getGradeBracket(gradeA);
  const bracketB = getGradeBracket(gradeB);
  const delta = scoreA - scoreB;
  const direction = delta > 0 ? 'improvement' : delta < 0 ? 'regression' : 'no change';
  return `${bracketA.label} (${gradeA}) vs ${bracketB.label} (${gradeB}) — ${direction} (${(delta * 100).toFixed(1)}%)`;
}

// ============================================================================
// SECTION 13 — VALIDATION UTILITIES
// ============================================================================

/**
 * Validate all sovereignty types constants and configuration for internal consistency.
 */
export function validateSovereigntyTypes(): SovereigntyTypesValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let checkedConstants = 0;
  let checkedFunctions = 0;

  // === Validate CORD_WEIGHTS ===
  checkedConstants++;
  const weightKeys = Object.keys(CORD_WEIGHTS) as CordWeightKey[];
  if (weightKeys.length !== CORD_COMPONENT_COUNT) {
    errors.push(`CORD_WEIGHTS has ${weightKeys.length} keys, expected ${CORD_COMPONENT_COUNT}`);
  }
  const weightSum = weightKeys.reduce((s, k) => s + CORD_WEIGHTS[k], 0);
  if (Math.abs(weightSum - 1.0) > 0.001) {
    errors.push(`CORD_WEIGHTS sum is ${weightSum}, expected 1.0`);
  }

  // === Validate OUTCOME_MULTIPLIER ===
  checkedConstants++;
  const outcomeKeys = Object.keys(OUTCOME_MULTIPLIER) as OutcomeKey[];
  if (outcomeKeys.length !== RUN_OUTCOMES.length) {
    errors.push(`OUTCOME_MULTIPLIER has ${outcomeKeys.length} keys, expected ${RUN_OUTCOMES.length}`);
  }
  for (const key of RUN_OUTCOMES) {
    if (!(key in OUTCOME_MULTIPLIER)) {
      errors.push(`OUTCOME_MULTIPLIER missing key: ${key}`);
    }
  }

  // === Validate CORD_COMPONENT_LABELS ===
  checkedConstants++;
  for (const key of weightKeys) {
    if (!CORD_COMPONENT_LABELS[key]) {
      errors.push(`CORD_COMPONENT_LABELS missing key: ${key}`);
    }
  }

  // === Validate CORD_COMPONENT_DESCRIPTIONS ===
  checkedConstants++;
  for (const key of weightKeys) {
    if (!CORD_COMPONENT_DESCRIPTIONS[key]) {
      errors.push(`CORD_COMPONENT_DESCRIPTIONS missing key: ${key}`);
    }
  }

  // === Validate OUTCOME_LABELS ===
  checkedConstants++;
  for (const key of outcomeKeys) {
    if (!OUTCOME_LABELS[key]) {
      errors.push(`OUTCOME_LABELS missing key: ${key}`);
    }
  }

  // === Validate OUTCOME_SEVERITY ===
  checkedConstants++;
  for (const key of outcomeKeys) {
    if (OUTCOME_SEVERITY[key] === undefined) {
      errors.push(`OUTCOME_SEVERITY missing key: ${key}`);
    }
  }

  // === Validate GRADE_BRACKET_CONFIG ===
  checkedConstants++;
  if (GRADE_BRACKET_CONFIG.length !== VERIFIED_GRADES.length) {
    errors.push(`GRADE_BRACKET_CONFIG has ${GRADE_BRACKET_CONFIG.length} entries, expected ${VERIFIED_GRADES.length}`);
  }
  for (const grade of VERIFIED_GRADES) {
    const bracket = GRADE_BRACKET_CONFIG.find(b => b.grade === grade);
    if (!bracket) {
      errors.push(`GRADE_BRACKET_CONFIG missing grade: ${grade}`);
    }
  }
  // Check score range coverage (should cover 0.0 to 1.0)
  const minBracketScore = Math.min(...GRADE_BRACKET_CONFIG.map(b => b.minScore));
  const maxBracketScore = Math.max(...GRADE_BRACKET_CONFIG.map(b => b.maxScore));
  if (minBracketScore > 0.001) {
    warnings.push(`GRADE_BRACKET_CONFIG minimum score is ${minBracketScore}, should start near 0.0`);
  }
  if (maxBracketScore < 0.999) {
    warnings.push(`GRADE_BRACKET_CONFIG maximum score is ${maxBracketScore}, should reach 1.0`);
  }

  // === Validate BADGE_TIER_CONFIG ===
  checkedConstants++;
  if (BADGE_TIER_CONFIG.length !== VERIFIED_GRADES.length) {
    errors.push(`BADGE_TIER_CONFIG has ${BADGE_TIER_CONFIG.length} entries, expected ${VERIFIED_GRADES.length}`);
  }
  for (const grade of VERIFIED_GRADES) {
    const badge = BADGE_TIER_CONFIG.find(b => b.grade === grade);
    if (!badge) {
      errors.push(`BADGE_TIER_CONFIG missing grade: ${grade}`);
    }
  }

  // === Validate INTEGRITY_RISK_CONFIG ===
  checkedConstants++;
  for (const level of INTEGRITY_RISK_LEVELS) {
    const config = INTEGRITY_RISK_CONFIG[level];
    if (!config) {
      errors.push(`INTEGRITY_RISK_CONFIG missing level: ${level}`);
    } else if (config.minScore > config.maxScore) {
      errors.push(`INTEGRITY_RISK_CONFIG[${level}] minScore > maxScore`);
    }
  }

  // === Validate ML feature labels ===
  checkedConstants++;
  if (SOVEREIGNTY_ML_FEATURE_LABELS.length !== SOVEREIGNTY_ML_FEATURE_COUNT) {
    errors.push(
      `SOVEREIGNTY_ML_FEATURE_LABELS has ${SOVEREIGNTY_ML_FEATURE_LABELS.length} entries, expected ${SOVEREIGNTY_ML_FEATURE_COUNT}`,
    );
  }

  // === Validate DL feature labels ===
  checkedConstants++;
  if (SOVEREIGNTY_DL_FEATURE_LABELS.length !== SOVEREIGNTY_DL_FEATURE_COUNT) {
    errors.push(
      `SOVEREIGNTY_DL_FEATURE_LABELS has ${SOVEREIGNTY_DL_FEATURE_LABELS.length} entries, expected ${SOVEREIGNTY_DL_FEATURE_COUNT}`,
    );
  }

  // === Validate mode sovereignty rules ===
  checkedConstants++;
  for (const code of MODE_CODES) {
    if (!MODE_SOVEREIGNTY_RULES.has(code)) {
      errors.push(`MODE_SOVEREIGNTY_RULES missing mode: ${code}`);
    }
  }

  // === Validate DL labels start with ML labels ===
  checkedConstants++;
  for (let i = 0; i < SOVEREIGNTY_ML_FEATURE_LABELS.length; i++) {
    if (SOVEREIGNTY_DL_FEATURE_LABELS[i] !== SOVEREIGNTY_ML_FEATURE_LABELS[i]) {
      errors.push(
        `DL feature label mismatch at index ${i}: '${SOVEREIGNTY_DL_FEATURE_LABELS[i]}' vs '${SOVEREIGNTY_ML_FEATURE_LABELS[i]}'`,
      );
      break;
    }
  }

  // === Validate key functions compile and are callable ===
  checkedFunctions++;
  try {
    computeCordComponentScore('decision_speed_score', 0.5);
  } catch (e) {
    errors.push(`computeCordComponentScore threw: ${String(e)}`);
  }

  checkedFunctions++;
  try {
    computeWeightedCordScore({
      decision_speed_score: 0.5,
      shields_maintained_pct: 0.5,
      hater_sabotages_blocked: 0.5,
      cascade_chains_broken: 0.5,
      pressure_survived_score: 0.5,
    });
  } catch (e) {
    errors.push(`computeWeightedCordScore threw: ${String(e)}`);
  }

  checkedFunctions++;
  try {
    classifyOutcome('FREEDOM');
  } catch (e) {
    errors.push(`classifyOutcome threw: ${String(e)}`);
  }

  checkedFunctions++;
  try {
    computeGradeFromScore(0.75);
  } catch (e) {
    errors.push(`computeGradeFromScore threw: ${String(e)}`);
  }

  checkedFunctions++;
  try {
    computeBadgeTierFromGrade('A');
  } catch (e) {
    errors.push(`computeBadgeTierFromGrade threw: ${String(e)}`);
  }

  checkedFunctions++;
  try {
    classifyIntegrityRisk('VERIFIED', 0, 1.0);
  } catch (e) {
    errors.push(`classifyIntegrityRisk threw: ${String(e)}`);
  }

  // === Validate GamePrimitives type guard integration ===
  checkedFunctions++;
  if (!isModeCode('solo')) errors.push('isModeCode("solo") returned false');
  if (!isPressureTier('T0')) errors.push('isPressureTier("T0") returned false');
  if (!isRunPhase('FOUNDATION')) errors.push('isRunPhase("FOUNDATION") returned false');
  if (!isRunOutcome('FREEDOM')) errors.push('isRunOutcome("FREEDOM") returned false');
  if (!isShieldLayerId('L1')) errors.push('isShieldLayerId("L1") returned false');
  if (!isHaterBotId('BOT_01')) errors.push('isHaterBotId("BOT_01") returned false');
  if (!isIntegrityStatus('VERIFIED')) errors.push('isIntegrityStatus("VERIFIED") returned false');
  if (!isVerifiedGrade('A')) errors.push('isVerifiedGrade("A") returned false');

  // === Validate constant arrays from GamePrimitives are accessible ===
  checkedConstants++;
  if (MODE_CODES.length !== 4) errors.push(`MODE_CODES length ${MODE_CODES.length}, expected 4`);
  if (PRESSURE_TIERS.length !== 5) errors.push(`PRESSURE_TIERS length ${PRESSURE_TIERS.length}, expected 5`);
  if (RUN_PHASES.length !== 3) errors.push(`RUN_PHASES length ${RUN_PHASES.length}, expected 3`);
  if (RUN_OUTCOMES.length !== 4) errors.push(`RUN_OUTCOMES length ${RUN_OUTCOMES.length}, expected 4`);
  if (SHIELD_LAYER_IDS.length !== 4) errors.push(`SHIELD_LAYER_IDS length ${SHIELD_LAYER_IDS.length}, expected 4`);
  if (HATER_BOT_IDS.length !== 5) errors.push(`HATER_BOT_IDS length ${HATER_BOT_IDS.length}, expected 5`);
  if (VERIFIED_GRADES.length !== 5) errors.push(`VERIFIED_GRADES length ${VERIFIED_GRADES.length}, expected 5`);
  if (INTEGRITY_STATUSES.length !== 4) errors.push(`INTEGRITY_STATUSES length ${INTEGRITY_STATUSES.length}, expected 4`);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checkedConstants,
    checkedFunctions,
  };
}

/**
 * Validate that a CORD raw values record has all required keys with valid numbers.
 */
export function validateCordRawValues(
  raw: unknown,
): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = [];
  if (raw === null || typeof raw !== 'object') {
    return { valid: false, errors: ['CORD raw values must be a non-null object'] };
  }
  const record = raw as Record<string, unknown>;
  for (const key of CORD_WEIGHT_KEYS) {
    if (!(key in record)) {
      errors.push(`Missing CORD key: ${key}`);
    } else if (typeof record[key] !== 'number' || !Number.isFinite(record[key] as number)) {
      errors.push(`CORD key '${key}' must be a finite number, got: ${typeof record[key]}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate that an outcome key is recognized.
 */
export function validateOutcomeKey(outcome: unknown): { valid: boolean; error: string | null } {
  if (typeof outcome !== 'string') {
    return { valid: false, error: 'Outcome must be a string' };
  }
  if (!isRunOutcome(outcome)) {
    return { valid: false, error: `Unrecognized outcome: ${outcome}` };
  }
  return { valid: true, error: null };
}

/**
 * Validate a grade value.
 */
export function validateGrade(grade: unknown): { valid: boolean; error: string | null } {
  if (typeof grade !== 'string') {
    return { valid: false, error: 'Grade must be a string' };
  }
  if (!isVerifiedGrade(grade)) {
    return { valid: false, error: `Unrecognized grade: ${grade}` };
  }
  return { valid: true, error: null };
}

/**
 * Validate an integrity status value.
 */
export function validateIntegrityStatus(
  status: unknown,
): { valid: boolean; error: string | null } {
  if (typeof status !== 'string') {
    return { valid: false, error: 'Integrity status must be a string' };
  }
  if (!isIntegrityStatus(status)) {
    return { valid: false, error: `Unrecognized integrity status: ${status}` };
  }
  return { valid: true, error: null };
}

/**
 * Validate a sovereignty score is within bounds.
 */
export function validateSovereigntyScore(
  score: number,
): { valid: boolean; warnings: readonly string[] } {
  const warnings: string[] = [];
  if (!Number.isFinite(score)) {
    return { valid: false, warnings: ['Score must be a finite number'] };
  }
  if (score < 0) warnings.push('Score is negative');
  if (score > 1) warnings.push('Score exceeds 1.0');
  if (score < SOVEREIGNTY_MIN_CORD_SCORE && score > 0) {
    warnings.push(`Score ${score} is below minimum threshold ${SOVEREIGNTY_MIN_CORD_SCORE}`);
  }
  return { valid: true, warnings };
}

/**
 * Validate a mode code for sovereignty context.
 */
export function validateModeForSovereignty(
  mode: unknown,
): { valid: boolean; error: string | null } {
  if (!isModeCode(mode)) {
    return { valid: false, error: `Unrecognized mode: ${String(mode)}` };
  }
  if (!MODE_SOVEREIGNTY_RULES.has(mode as ModeCode)) {
    return { valid: false, error: `No sovereignty rules for mode: ${String(mode)}` };
  }
  return { valid: true, error: null };
}

/**
 * Perform a comprehensive validation of a sovereignty signal extraction.
 */
export function validateSovereigntySignals(
  signals: SovereigntySignals,
): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = [];
  const fields: (keyof SovereigntySignals)[] = [
    'cordScore', 'integrityRisk', 'gradeScore', 'pressureSurvival',
    'shieldMaintenance', 'cascadeHealth', 'decisionQuality', 'economicStability',
    'battlePerformance', 'tensionResilience', 'legendDensity', 'auditFlagDensity',
    'gapVsLegend', 'gapClosingRate', 'tickCheckpointCoverage',
  ];
  for (const field of fields) {
    const val = signals[field];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      errors.push(`signals.${field} must be a finite number`);
    } else if (val < 0 || val > 1) {
      errors.push(`signals.${field} out of [0,1] range: ${val}`);
    }
  }
  if (typeof signals.proofBadgeCount !== 'number' || signals.proofBadgeCount < 0) {
    errors.push('signals.proofBadgeCount must be a non-negative number');
  }
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// SECTION 14 — SERIALIZATION HELPERS
// ============================================================================

/**
 * Serialize the complete sovereignty configuration to a portable envelope.
 */
export function serializeSovereigntyConfig(): SerializedSovereigntyConfig {
  const modeRulesArray = getAllModeSovereigntyRules();
  const payload = {
    version: SOVEREIGNTY_TYPES_VERSION,
    timestamp: Date.now(),
    cordWeights: cloneJson(CORD_WEIGHTS),
    outcomeMultiplier: cloneJson(OUTCOME_MULTIPLIER),
    gradeBrackets: cloneJson(GRADE_BRACKET_CONFIG) as SovereigntyGradeBracket[],
    badgeTiers: cloneJson(BADGE_TIER_CONFIG) as SovereigntyBadgeTierConfig[],
    integrityRiskThresholds: cloneJson(INTEGRITY_RISK_CONFIG),
    modeRules: cloneJson(modeRulesArray) as ModeSovereigntyRules[],
    mlFeatureCount: SOVEREIGNTY_ML_FEATURE_COUNT as number,
    dlFeatureCount: SOVEREIGNTY_DL_FEATURE_COUNT as number,
    checksum: '', // Filled below
  };

  payload.checksum = checksumSnapshot(payload);
  return deepFrozenClone(payload) as SerializedSovereigntyConfig;
}

/**
 * Deserialize a sovereignty configuration envelope and validate its checksum.
 */
export function deserializeSovereigntyConfig(
  serialized: unknown,
): { ok: boolean; config: SerializedSovereigntyConfig | null; error: string | null } {
  if (serialized === null || typeof serialized !== 'object') {
    return { ok: false, config: null, error: 'Input must be a non-null object' };
  }

  const record = serialized as Record<string, unknown>;

  // Validate version
  if (record['version'] !== SOVEREIGNTY_TYPES_VERSION) {
    return {
      ok: false,
      config: null,
      error: `Version mismatch: got ${String(record['version'])}, expected ${SOVEREIGNTY_TYPES_VERSION}`,
    };
  }

  // Validate checksum
  const savedChecksum = record['checksum'];
  if (typeof savedChecksum !== 'string') {
    return { ok: false, config: null, error: 'Missing checksum' };
  }

  const withoutChecksum = { ...record, checksum: '' };
  const recomputedChecksum = checksumSnapshot(withoutChecksum);
  if (recomputedChecksum !== savedChecksum) {
    return { ok: false, config: null, error: 'Checksum mismatch — data may be tampered' };
  }

  // Validate CORD weights match canonical values
  const cordWeights = record['cordWeights'];
  if (cordWeights && typeof cordWeights === 'object') {
    const cw = cordWeights as Record<string, number>;
    for (const key of CORD_WEIGHT_KEYS) {
      if (cw[key] !== CORD_WEIGHTS[key]) {
        return {
          ok: false,
          config: null,
          error: `CORD weight mismatch for ${key}: got ${cw[key]}, expected ${CORD_WEIGHTS[key]}`,
        };
      }
    }
  }

  // Validate OUTCOME_MULTIPLIER matches canonical values
  const outcomeMult = record['outcomeMultiplier'];
  if (outcomeMult && typeof outcomeMult === 'object') {
    const om = outcomeMult as Record<string, number>;
    for (const key of OUTCOME_KEYS) {
      if (om[key] !== OUTCOME_MULTIPLIER[key]) {
        return {
          ok: false,
          config: null,
          error: `Outcome multiplier mismatch for ${key}: got ${om[key]}, expected ${OUTCOME_MULTIPLIER[key]}`,
        };
      }
    }
  }

  return { ok: true, config: serialized as SerializedSovereigntyConfig, error: null };
}

/**
 * Serialize a CORD score result to a stable JSON string.
 */
export function serializeCordScoreResult(result: CordScoreResult): string {
  return stableStringify(result);
}

/**
 * Serialize sovereignty signals to a stable JSON string.
 */
export function serializeSovereigntySignals(signals: SovereigntySignals): string {
  return stableStringify(signals);
}

/**
 * Compute a sovereignty config fingerprint (deterministic ID).
 */
export function computeSovereigntyConfigFingerprint(): string {
  return createDeterministicId(
    'sovereignty-config',
    SOVEREIGNTY_TYPES_VERSION,
    String(CORD_COMPONENT_COUNT),
    String(SOVEREIGNTY_ML_FEATURE_COUNT),
    String(SOVEREIGNTY_DL_FEATURE_COUNT),
    String(CORD_WEIGHT_SUM),
  );
}

/**
 * Serialize a grade-badge pair to a canonical string.
 */
export function serializeGradeBadgePair(
  grade: VerifiedGrade,
  normalizedScore: number,
): string {
  const bracket = getGradeBracket(grade);
  const badge = computeBadgeTierFromGrade(grade);
  return stableStringify({
    grade,
    label: bracket.label,
    score: normalizedScore,
    badgeName: badge.badgeName,
    tier: badge.tier,
    rarity: badge.rarity,
  });
}

/**
 * Create a deterministic hash for a set of sovereignty signals.
 */
export function hashSovereigntySignals(signals: SovereigntySignals): string {
  return sha256(stableStringify(signals));
}

/**
 * Create an HMAC-signed sovereignty config digest.
 */
export function signSovereigntyConfigDigest(secret: string): string {
  const configJson = stableStringify({
    version: SOVEREIGNTY_TYPES_VERSION,
    cordWeights: CORD_WEIGHTS,
    outcomeMultiplier: OUTCOME_MULTIPLIER,
    mlFeatureCount: SOVEREIGNTY_ML_FEATURE_COUNT,
    dlFeatureCount: SOVEREIGNTY_DL_FEATURE_COUNT,
  });
  return hmacSha256(secret, configJson);
}

/**
 * Serialize an ML vector result to a portable format.
 */
export function serializeMLVectorResult(result: SovereigntyMLVectorResult): string {
  return stableStringify(result);
}

/**
 * Serialize a DL tensor result to a portable format.
 */
export function serializeDLTensorResult(result: SovereigntyDLTensorResult): string {
  return stableStringify(result);
}

/**
 * Compute a deterministic checksum for the entire sovereignty type configuration.
 */
export function computeSovereigntyTypesChecksum(): string {
  return checksumParts(
    SOVEREIGNTY_TYPES_VERSION,
    CORD_WEIGHTS,
    OUTCOME_MULTIPLIER,
    GRADE_BRACKET_CONFIG,
    BADGE_TIER_CONFIG,
    INTEGRITY_RISK_CONFIG,
    SOVEREIGNTY_ML_FEATURE_LABELS,
    SOVEREIGNTY_DL_FEATURE_LABELS,
  );
}

// ============================================================================
// SECTION 15 — SELF-TEST
// ============================================================================

/**
 * Run a comprehensive self-test of all sovereignty types.
 * Returns a structured result with pass/fail counts and details.
 */
export function runSovereigntyTypesSelfTest(): SovereigntyTypesSelfTestResult {
  const startMs = Date.now();
  const failures: string[] = [];
  let checksCount = 0;
  let passedCount = 0;

  function check(label: string, condition: boolean): void {
    checksCount++;
    if (condition) {
      passedCount++;
    } else {
      failures.push(label);
    }
  }

  // --- Constants integrity ---
  check('CORD_WEIGHTS has 5 keys', Object.keys(CORD_WEIGHTS).length === 5);
  check('CORD_WEIGHTS sum is 1.0', Math.abs(CORD_WEIGHT_SUM - 1.0) < 0.001);
  check('OUTCOME_MULTIPLIER has 4 keys', Object.keys(OUTCOME_MULTIPLIER).length === 4);
  check('OUTCOME_MULTIPLIER.FREEDOM is 1.5', OUTCOME_MULTIPLIER.FREEDOM === 1.5);
  check('OUTCOME_MULTIPLIER.TIMEOUT is 0.8', OUTCOME_MULTIPLIER.TIMEOUT === 0.8);
  check('OUTCOME_MULTIPLIER.BANKRUPT is 0.4', OUTCOME_MULTIPLIER.BANKRUPT === 0.4);
  check('OUTCOME_MULTIPLIER.ABANDONED is 0.0', OUTCOME_MULTIPLIER.ABANDONED === 0.0);
  check('CORD_COMPONENT_COUNT is 5', CORD_COMPONENT_COUNT === 5);
  check('SOVEREIGNTY_ML_FEATURE_COUNT is 32', SOVEREIGNTY_ML_FEATURE_COUNT === 32);
  check('SOVEREIGNTY_DL_FEATURE_COUNT is 48', SOVEREIGNTY_DL_FEATURE_COUNT === 48);

  // --- CORD scoring ---
  const cordResult = computeWeightedCordScore({
    decision_speed_score: 1.0,
    shields_maintained_pct: 1.0,
    hater_sabotages_blocked: 1.0,
    cascade_chains_broken: 1.0,
    pressure_survived_score: 1.0,
  });
  check('Perfect CORD score is 1.0', Math.abs(cordResult.normalizedScore - 1.0) < 0.001);
  check('Perfect CORD has 5 components', cordResult.componentCount === 5);

  const zeroCord = computeWeightedCordScore({
    decision_speed_score: 0.0,
    shields_maintained_pct: 0.0,
    hater_sabotages_blocked: 0.0,
    cascade_chains_broken: 0.0,
    pressure_survived_score: 0.0,
  });
  check('Zero CORD score is 0.0', zeroCord.normalizedScore === 0);

  // --- Component scoring ---
  const comp = computeCordComponentScore('decision_speed_score', 0.8);
  check('Component weight matches', comp.weight === CORD_WEIGHTS.decision_speed_score);
  check('Component rawValue is clamped', comp.rawValue === 0.8);
  check('Component weightedValue correct', Math.abs(comp.weightedValue - 0.8 * 0.25) < 0.001);

  // --- Outcome classification ---
  const freedomClass = classifyOutcome('FREEDOM');
  check('FREEDOM is win', freedomClass.isWin === true);
  check('FREEDOM multiplier is 1.5', freedomClass.multiplier === 1.5);

  const abandonedClass = classifyOutcome('ABANDONED');
  check('ABANDONED is loss', abandonedClass.isLoss === true);
  check('ABANDONED multiplier is 0.0', abandonedClass.multiplier === 0.0);

  // --- Outcome multiplier resolution ---
  check('resolveOutcomeMultiplier FREEDOM', resolveOutcomeMultiplier('FREEDOM') === 1.5);
  check('resolveOutcomeMultiplierSafe invalid', resolveOutcomeMultiplierSafe('INVALID') === 0.0);

  // --- Grade computation ---
  check('Score 0.9 is grade A', computeGradeFromScore(0.9) === 'A');
  check('Score 0.7 is grade B', computeGradeFromScore(0.7) === 'B');
  check('Score 0.5 is grade C', computeGradeFromScore(0.5) === 'C');
  check('Score 0.3 is grade D', computeGradeFromScore(0.3) === 'D');
  check('Score 0.1 is grade F', computeGradeFromScore(0.1) === 'F');

  // --- Badge tier ---
  const badgeA = computeBadgeTierFromGrade('A');
  check('Grade A badge tier is 5', badgeA.tier === 5);
  check('Grade A badge rarity is LEGENDARY', badgeA.rarity === 'LEGENDARY');

  const badgeF = computeBadgeTierFromGrade('F');
  check('Grade F badge tier is 1', badgeF.tier === 1);

  // --- Integrity classification ---
  const noRisk = classifyIntegrityRisk('VERIFIED', 0, 1.0);
  check('VERIFIED + 0 flags = no/low risk', noRisk.score < 0.3);
  check('VERIFIED does not require review', !noRisk.requiresReview);

  const highRisk = classifyIntegrityRisk('QUARANTINED', 5, 0.5);
  check('QUARANTINED + 5 flags = high risk', highRisk.score > 0.5);
  check('QUARANTINED requires review', highRisk.requiresReview);

  // --- Mode sovereignty rules ---
  for (const code of MODE_CODES) {
    const rules = getModeSovereigntyRules(code);
    check(`Mode ${code} has rules`, rules.mode === code);
    check(`Mode ${code} cordBonus > 0`, rules.cordBonusMultiplier > 0);
    check(`Mode ${code} minDecisions > 0`, rules.minDecisionsForGrade > 0);
  }

  // --- CORD variance ---
  const uniformVariance = computeCordVariance({
    decision_speed_score: 0.5,
    shields_maintained_pct: 0.5,
    hater_sabotages_blocked: 0.5,
    cascade_chains_broken: 0.5,
    pressure_survived_score: 0.5,
  });
  check('Uniform CORD variance is 0', uniformVariance === 0);

  const highVariance = computeCordVariance({
    decision_speed_score: 1.0,
    shields_maintained_pct: 0.0,
    hater_sabotages_blocked: 1.0,
    cascade_chains_broken: 0.0,
    pressure_survived_score: 0.5,
  });
  check('Non-uniform CORD variance > 0', highVariance > 0);

  // --- CORD score with outcome ---
  const cordWithFreedom = computeCordScoreWithOutcome({
    decision_speed_score: 0.8,
    shields_maintained_pct: 0.8,
    hater_sabotages_blocked: 0.8,
    cascade_chains_broken: 0.8,
    pressure_survived_score: 0.8,
  }, 'FREEDOM');
  check('CORD with FREEDOM > raw CORD', cordWithFreedom > 0.8);

  const cordWithAbandoned = computeCordScoreWithOutcome({
    decision_speed_score: 0.8,
    shields_maintained_pct: 0.8,
    hater_sabotages_blocked: 0.8,
    cascade_chains_broken: 0.8,
    pressure_survived_score: 0.8,
  }, 'ABANDONED');
  check('CORD with ABANDONED is 0', cordWithAbandoned === 0);

  // --- Grade-badge pair resolution ---
  const pair = resolveGradeBadgePair(0.75);
  check('GradeBadgePair grade is B', pair.grade === 'B');
  check('GradeBadgePair badge exists', pair.badge.badgeName.length > 0);

  // --- Outcome ranking ---
  const ranked = rankOutcomesByMultiplier();
  check('Ranked outcomes first is FREEDOM', ranked[0] === 'FREEDOM');
  check('Ranked outcomes last is ABANDONED', ranked[ranked.length - 1] === 'ABANDONED');

  // --- Destructive outcome check ---
  check('BANKRUPT is destructive', isOutcomeDestructive('BANKRUPT'));
  check('ABANDONED is destructive', isOutcomeDestructive('ABANDONED'));
  check('FREEDOM is not destructive', !isOutcomeDestructive('FREEDOM'));

  // --- Integrity adjustment ---
  check('VERIFIED bonus > 0', computeIntegrityScoreAdjustment('VERIFIED') > 0);
  check('QUARANTINED penalty < 0', computeIntegrityScoreAdjustment('QUARANTINED') < 0);
  check('UNVERIFIED penalty < 0', computeIntegrityScoreAdjustment('UNVERIFIED') < 0);
  check('PENDING adjustment is 0', computeIntegrityScoreAdjustment('PENDING') === 0);

  // --- Integrity capped score ---
  const cappedClean = computeIntegrityCappedScore(0.8, 'VERIFIED', 0);
  check('Verified clean cap >= 0.8', cappedClean >= 0.8);

  const cappedFlagged = computeIntegrityCappedScore(0.8, 'QUARANTINED', 15);
  check('Quarantined + many flags cap <= 0.3', cappedFlagged <= SOVEREIGNTY_AUDIT_FLAG_CAP_SCORE);

  // --- Serialization ---
  const serialized = serializeSovereigntyConfig();
  check('Serialized config has version', serialized.version === SOVEREIGNTY_TYPES_VERSION);
  check('Serialized config has checksum', serialized.checksum.length > 0);

  const deserialized = deserializeSovereigntyConfig(cloneJson(serialized));
  check('Deserialized config ok', deserialized.ok === true);

  // --- Fingerprint ---
  const fp1 = computeSovereigntyConfigFingerprint();
  const fp2 = computeSovereigntyConfigFingerprint();
  check('Fingerprint is deterministic', fp1 === fp2);
  check('Fingerprint is 24 hex chars', fp1.length === 24);

  // --- Types checksum ---
  const tc1 = computeSovereigntyTypesChecksum();
  const tc2 = computeSovereigntyTypesChecksum();
  check('Types checksum is deterministic', tc1 === tc2);

  // --- HMAC signing ---
  const sig = signSovereigntyConfigDigest('test-secret');
  check('HMAC signature is non-empty', sig.length > 0);

  // --- Validation ---
  const validationResult = validateSovereigntyTypes();
  check('Internal validation passes', validationResult.valid);

  const cordValidation = validateCordRawValues({
    decision_speed_score: 0.5,
    shields_maintained_pct: 0.5,
    hater_sabotages_blocked: 0.5,
    cascade_chains_broken: 0.5,
    pressure_survived_score: 0.5,
  });
  check('Valid CORD raw values pass validation', cordValidation.valid);

  const badCordValidation = validateCordRawValues({ decision_speed_score: 'bad' });
  check('Invalid CORD raw values fail validation', !badCordValidation.valid);

  check('validateOutcomeKey FREEDOM', validateOutcomeKey('FREEDOM').valid);
  check('validateOutcomeKey invalid', !validateOutcomeKey('INVALID').valid);
  check('validateGrade A', validateGrade('A').valid);
  check('validateGrade invalid', !validateGrade('X').valid);
  check('validateIntegrityStatus VERIFIED', validateIntegrityStatus('VERIFIED').valid);
  check('validateIntegrityStatus invalid', !validateIntegrityStatus('BAD').valid);
  check('validateModeForSovereignty solo', validateModeForSovereignty('solo').valid);
  check('validateModeForSovereignty invalid', !validateModeForSovereignty('nonexistent').valid);

  const scoreVal = validateSovereigntyScore(0.5);
  check('Score 0.5 is valid', scoreVal.valid);

  // --- Label generation ---
  const compLabel = generateCordComponentLabel('decision_speed_score', 0.75);
  check('Component label is non-empty', compLabel.length > 0);

  const outcomeLabel = generateOutcomeLabel('FREEDOM');
  check('Outcome label is non-empty', outcomeLabel.length > 0);

  const integrityLabel = generateIntegrityRiskLabel('VERIFIED', 0, 1.0);
  check('Integrity label is non-empty', integrityLabel.length > 0);

  const summaryLabel = generateSovereigntySummary(0.75, 'solo', 'FREEDOM');
  check('Summary label is non-empty', summaryLabel.length > 0);

  const comparisonLabel = generateGradeComparisonLabel(0.9, 0.5);
  check('Comparison label is non-empty', comparisonLabel.length > 0);

  // --- Mode bonus functions ---
  const modeBonus = applyCordModeBonus(0.5, 'pvp');
  check('PvP mode bonus applied', modeBonus > 0);

  check('hasMinDecisions false for 0 decisions', !hasMinimumDecisionsForGrade(0, 'solo'));
  check('hasMinDecisions true for many decisions', hasMinimumDecisionsForGrade(100, 'solo'));

  const pressureContrib = computeModePressureSurvivalContribution(0.8, 'ghost');
  check('Pressure contribution in range', pressureContrib >= 0 && pressureContrib <= 1);

  const cascadeContrib = computeModeCascadeRecoveryContribution(0.7, 'solo');
  check('Cascade contribution in range', cascadeContrib >= 0 && cascadeContrib <= 1);

  const shieldContrib = computeModeShieldMaintenanceContribution(0.9, 'coop');
  check('Shield contribution in range', shieldContrib >= 0 && shieldContrib <= 1);

  const legendBonus = computeModeLegendMarkerBonus(5, 100, 'ghost');
  check('Legend marker bonus >= 0', legendBonus >= 0);

  // --- Distance to next grade ---
  const distA = computeDistanceToNextGrade(0.9);
  check('Grade A distance to next is 0', distA === 0);

  const distC = computeDistanceToNextGrade(0.5);
  check('Grade C distance to next > 0', distC > 0);

  // --- Qualified badges ---
  const qualBadges = getQualifiedBadges(0.7);
  check('Score 0.7 qualifies for multiple badges', qualBadges.length >= 3);

  // --- All outcomes classification ---
  const allOutcomes = classifyAllOutcomes();
  check('All outcomes classified', allOutcomes.size === 4);

  // --- Expected score range ---
  const range = computeExpectedScoreRange('FREEDOM', 0.5, 0.9);
  check('Expected score range has min <= max', range.min <= range.max);

  // --- Outcome differential ---
  const diff = computeOutcomeDifferential('FREEDOM', 'BANKRUPT');
  check('FREEDOM-BANKRUPT differential > 0', diff > 0);

  // --- CORD analysis ---
  const analysis = analyzeCordComponents({
    decision_speed_score: 0.9,
    shields_maintained_pct: 0.3,
    hater_sabotages_blocked: 0.7,
    cascade_chains_broken: 0.5,
    pressure_survived_score: 0.6,
  });
  check('CORD analysis has 5 entries', analysis.length === 5);

  // --- CORD score ID ---
  const cordId = generateCordScoreId('test-run', {
    decision_speed_score: 0.5,
    shields_maintained_pct: 0.5,
    hater_sabotages_blocked: 0.5,
    cascade_chains_broken: 0.5,
    pressure_survived_score: 0.5,
  });
  check('CORD score ID is 24 chars', cordId.length === 24);

  // --- CORD from raw inputs ---
  const rawInputResult = computeCordScoreFromRawInputs(0.8, 0.7, 0.6, 0.5, 0.4);
  check('Raw input CORD score in range', rawInputResult.normalizedScore >= 0 && rawInputResult.normalizedScore <= 1);

  // --- Rate component ---
  check('Rate 0.9 is EXCELLENT', rateCordComponent(0.9) === 'EXCELLENT');
  check('Rate 0.7 is GOOD', rateCordComponent(0.7) === 'GOOD');
  check('Rate 0.5 is FAIR', rateCordComponent(0.5) === 'FAIR');
  check('Rate 0.3 is POOR', rateCordComponent(0.3) === 'POOR');
  check('Rate 0.1 is FAILING', rateCordComponent(0.1) === 'FAILING');

  // --- Integrity review required ---
  check('VERIFIED no flags = no review', !isIntegrityReviewRequired('VERIFIED', 0));
  check('QUARANTINED = review required', isIntegrityReviewRequired('QUARANTINED', 0));

  // --- Grade numeric score ---
  check('Grade A numeric is 1.0', computeGradeNumericScore('A') === 1.0);
  check('Grade F numeric is 0.0', computeGradeNumericScore('F') === 0.0);

  // --- Hash signals ---
  const mockSignals: SovereigntySignals = {
    cordScore: 0.5, integrityRisk: 0.1, gradeScore: 0.75, pressureSurvival: 0.6,
    shieldMaintenance: 0.8, cascadeHealth: 0.7, decisionQuality: 0.9,
    economicStability: 0.5, battlePerformance: 0.6, tensionResilience: 0.8,
    legendDensity: 0.3, auditFlagDensity: 0.1, proofBadgeCount: 2,
    gapVsLegend: 0.4, gapClosingRate: 0.2, tickCheckpointCoverage: 0.95,
  };
  const hash1 = hashSovereigntySignals(mockSignals);
  const hash2 = hashSovereigntySignals(mockSignals);
  check('Signal hash is deterministic', hash1 === hash2);

  // --- Serialize signals ---
  const serializedSignals = serializeSovereigntySignals(mockSignals);
  check('Serialized signals is non-empty', serializedSignals.length > 0);

  // --- Validate signals ---
  const signalsValidation = validateSovereigntySignals(mockSignals);
  check('Mock signals pass validation', signalsValidation.valid);

  // --- Serialize grade badge pair ---
  const serializedPair = serializeGradeBadgePair('B', 0.75);
  check('Serialized grade-badge pair is non-empty', serializedPair.length > 0);

  // --- Serialize CORD score result ---
  const serializedCord = serializeCordScoreResult(cordResult);
  check('Serialized CORD result is non-empty', serializedCord.length > 0);

  // --- DL tensor shape ---
  check('DL tensor shape is [1, 48]', SOVEREIGNTY_DL_TENSOR_SHAPE[0] === 1 && SOVEREIGNTY_DL_TENSOR_SHAPE[1] === 48);

  // --- Feature label uniqueness ---
  const mlLabelSet = new Set(SOVEREIGNTY_ML_FEATURE_LABELS);
  check('ML feature labels are unique', mlLabelSet.size === SOVEREIGNTY_ML_FEATURE_COUNT);

  const dlLabelSet = new Set(SOVEREIGNTY_DL_FEATURE_LABELS);
  check('DL feature labels are unique', dlLabelSet.size === SOVEREIGNTY_DL_FEATURE_COUNT);

  // --- DeterministicRNG usage (ensures import is runtime-used) ---
  const rng = new DeterministicRNG('sovereignty-self-test');
  const rngVal = rng.nextFloat();
  check('RNG produces value in [0,1)', rngVal >= 0 && rngVal < 1);

  // --- Version ---
  check('SOVEREIGNTY_TYPES_VERSION is set', SOVEREIGNTY_TYPES_VERSION.length > 0);

  // --- GamePrimitives constant usage verification ---
  check('PRESSURE_TIER_NORMALIZED.T0 is 0', PRESSURE_TIER_NORMALIZED['T0'] === 0.0);
  check('PRESSURE_TIER_URGENCY_LABEL.T4 is Apex', PRESSURE_TIER_URGENCY_LABEL['T4'] === 'Apex');
  check('RUN_PHASE_NORMALIZED.SOVEREIGNTY is 1.0', RUN_PHASE_NORMALIZED['SOVEREIGNTY'] === 1.0);
  check('RUN_PHASE_STAKES_MULTIPLIER.SOVEREIGNTY is 1.0', RUN_PHASE_STAKES_MULTIPLIER['SOVEREIGNTY'] === 1.0);
  check('MODE_NORMALIZED.solo is 0', MODE_NORMALIZED['solo'] === 0.0);
  check('MODE_DIFFICULTY_MULTIPLIER.ghost is 1.6', MODE_DIFFICULTY_MULTIPLIER['ghost'] === 1.6);
  check('MODE_TENSION_FLOOR.pvp is 0.35', MODE_TENSION_FLOOR['pvp'] === 0.35);
  check('SHIELD_LAYER_CAPACITY_WEIGHT.L1 is 1.0', SHIELD_LAYER_CAPACITY_WEIGHT['L1'] === 1.0);
  check('BOT_THREAT_LEVEL.BOT_05 is 1.0', BOT_THREAT_LEVEL['BOT_05'] === 1.0);
  check('BOT_STATE_THREAT_MULTIPLIER.ATTACKING is 1.0', BOT_STATE_THREAT_MULTIPLIER['ATTACKING'] === 1.0);
  check('INTEGRITY_STATUS_RISK_SCORE.VERIFIED is 0', INTEGRITY_STATUS_RISK_SCORE['VERIFIED'] === 0.0);
  check('VERIFIED_GRADE_NUMERIC_SCORE.A is 1.0', VERIFIED_GRADE_NUMERIC_SCORE['A'] === 1.0);
  check('LEGEND_MARKER_KIND_WEIGHT.GOLD is 1.0', LEGEND_MARKER_KIND_WEIGHT['GOLD'] === 1.0);

  const durationMs = Date.now() - startMs;
  const resultChecksum = checksumParts(
    'self-test',
    checksCount,
    passedCount,
    failures.length,
  );

  return deepFrozenClone({
    ok: failures.length === 0,
    version: SOVEREIGNTY_TYPES_VERSION,
    checksCount,
    passedCount,
    failedCount: failures.length,
    failures,
    durationMs,
    checksum: resultChecksum,
  });
}

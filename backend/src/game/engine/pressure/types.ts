/*
 * POINT ZERO ONE — BACKEND PRESSURE TYPES
 * /backend/src/game/engine/pressure/types.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - pressure.score is normalized 0.0 → 1.0
 * - pressure.tier preserves T0 → T4 cadence semantics used across backend engines
 * - pressure.band carries richer semantic meaning for UI, dossier, and ML layers
 * - weights, bounds, caps, and helper functions live here as the single source of truth
 * - collector ML/DL types, feature extraction, trend analysis, annotation, forecasting,
 *   and UX hint helpers all originate here — PressureSignalCollector imports them all
 * - this module is a pure leaf — zero engine-side dependencies beyond
 *   PressureTier (GamePrimitives) and PressureBand (RunStateSnapshot)
 * - no circular imports are possible; all consumers import from this module
 *
 * Sections
 * --------
 *   §1   Core pressure tier/band types and configs
 *   §2   Signal key definitions, contribution, and collection types
 *   §3   Collector weight and limit configuration
 *   §4   Core constants and helper functions (tier/band resolution, score clamping)
 *   §5   Collector module constants and chat hook maps
 *   §6   Collector ML and DL feature label arrays (48 + 64 features)
 *   §7   Collector output types (ML vector, DL tensor, trend, annotation, forecast, UX)
 *   §8   Collector history, watermark, inspector, and health types
 *   §9   Mode-specific and phase-specific pressure profile types
 *   §10  Signal normalization, composite score, and crossing helpers
 *   §11  Urgency classification and chat hook helpers
 *   §12  ML feature extraction helpers
 *   §13  DL row construction helpers
 *   §14  Trend analysis pure helpers
 *   §15  Annotation, UX hint, and history entry construction helpers
 *   §16  Forecast construction helpers
 *   §17  Threat, resilience, and validation helpers
 */

import type { PressureTier } from '../core/GamePrimitives';
import type { PressureBand } from '../core/RunStateSnapshot';

// ─────────────────────────────────────────────────────────────────────────────
// §1  Core pressure tier / band types and configs
// ─────────────────────────────────────────────────────────────────────────────

export type PressureSignalPolarity = 'PRESSURE' | 'RELIEF';

export interface PressureThreshold<TValue extends string> {
  readonly value: TValue;
  readonly minScore: number;
  readonly label: string;
}

export interface PressureTierConfig {
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly minScore: number;
  readonly maxScoreExclusive: number;
  readonly label: string;
  readonly allowsHaterInjection: boolean;
  readonly passiveShieldDrain: boolean;
}

export const PRESSURE_TIER_CONFIGS: Readonly<Record<PressureTier, PressureTierConfig>> = Object.freeze({
  T0: {
    tier: 'T0',
    band: 'CALM',
    minScore: 0.0,
    maxScoreExclusive: 0.12,
    label: 'CALM',
    allowsHaterInjection: false,
    passiveShieldDrain: false,
  },
  T1: {
    tier: 'T1',
    band: 'BUILDING',
    minScore: 0.12,
    maxScoreExclusive: 0.35,
    label: 'BUILDING',
    allowsHaterInjection: false,
    passiveShieldDrain: false,
  },
  T2: {
    tier: 'T2',
    band: 'ELEVATED',
    minScore: 0.35,
    maxScoreExclusive: 0.55,
    label: 'ELEVATED',
    allowsHaterInjection: false,
    passiveShieldDrain: false,
  },
  T3: {
    tier: 'T3',
    band: 'HIGH',
    minScore: 0.55,
    maxScoreExclusive: 0.75,
    label: 'HIGH',
    allowsHaterInjection: false,
    passiveShieldDrain: true,
  },
  T4: {
    tier: 'T4',
    band: 'CRITICAL',
    minScore: 0.75,
    maxScoreExclusive: 1.01,
    label: 'CRITICAL',
    allowsHaterInjection: true,
    passiveShieldDrain: true,
  },
});

export const PRESSURE_THRESHOLDS: readonly PressureThreshold<PressureTier>[] = Object.freeze([
  { value: 'T4', minScore: 0.75, label: 'CRITICAL' },
  { value: 'T3', minScore: 0.55, label: 'HIGH' },
  { value: 'T2', minScore: 0.35, label: 'ELEVATED' },
  { value: 'T1', minScore: 0.12, label: 'BUILDING' },
  { value: 'T0', minScore: 0.0,  label: 'CALM' },
] as const);

export const PRESSURE_BAND_THRESHOLDS: readonly PressureThreshold<PressureBand>[] = Object.freeze([
  { value: 'CRITICAL', minScore: 0.75, label: 'CRITICAL' },
  { value: 'HIGH',     minScore: 0.55, label: 'HIGH' },
  { value: 'ELEVATED', minScore: 0.35, label: 'ELEVATED' },
  { value: 'BUILDING', minScore: 0.12, label: 'BUILDING' },
  { value: 'CALM',     minScore: 0.0,  label: 'CALM' },
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// §2  Signal key definitions, contribution, and collection types
// ─────────────────────────────────────────────────────────────────────────────

export const PRESSURE_POSITIVE_SIGNAL_KEYS = [
  'cash_crisis',
  'net_worth_collapse',
  'cashflow_deficit',
  'shield_damage',
  'shield_breach',
  'attack_queue',
  'cascade_pressure',
  'hater_heat',
  'phase_pressure',
  'time_burn',
  'solo_isolation_tax',
  'bleed_mode_tax',
  'pvp_rivalry_heat',
  'coop_trust_fracture',
  'coop_defection_risk',
  'ghost_community_heat',
  'ghost_gap_pressure',
] as const;

export const PRESSURE_RELIEF_SIGNAL_KEYS = [
  'prosperity_relief',
  'full_security_relief',
  'runway_relief',
  'income_surplus_relief',
  'coop_cohesion_relief',
  'ghost_alignment_relief',
] as const;

export const PRESSURE_SIGNAL_KEYS = [
  ...PRESSURE_POSITIVE_SIGNAL_KEYS,
  ...PRESSURE_RELIEF_SIGNAL_KEYS,
] as const;

export type PressurePositiveSignalKey = typeof PRESSURE_POSITIVE_SIGNAL_KEYS[number];
export type PressureReliefSignalKey   = typeof PRESSURE_RELIEF_SIGNAL_KEYS[number];
export type PressureSignalKey         = typeof PRESSURE_SIGNAL_KEYS[number];

export type PressureSignalMap = Readonly<Record<PressureSignalKey, number>>;

export interface PressureSignalContribution {
  readonly key: PressureSignalKey;
  readonly polarity: PressureSignalPolarity;
  readonly amount: number;
  readonly reason: string;
  readonly modeScoped: boolean;
}

export interface PressureSignalCollection {
  readonly rawPositiveScore: number;
  readonly rawReliefScore: number;
  readonly rawScore: number;
  readonly score: number;
  readonly contributions: readonly PressureSignalContribution[];
  readonly reliefContributions: readonly PressureSignalContribution[];
  readonly dominantPressureKey: PressurePositiveSignalKey | null;
  readonly dominantReliefKey: PressureReliefSignalKey | null;
  readonly pressureBreakdown: PressureSignalMap;
  readonly reliefBreakdown: PressureSignalMap;
  readonly netBreakdown: PressureSignalMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  Collector weight and limit configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface PressureCollectorWeights {
  readonly cash_crisis: number;
  readonly net_worth_collapse: number;
  readonly cashflow_deficit: number;
  readonly shield_damage: number;
  readonly shield_breach: number;
  readonly attack_queue: number;
  readonly cascade_pressure: number;
  readonly hater_heat: number;
  readonly phase_pressure: number;
  readonly time_burn: number;
  readonly solo_isolation_tax: number;
  readonly bleed_mode_tax: number;
  readonly pvp_rivalry_heat: number;
  readonly coop_trust_fracture: number;
  readonly coop_defection_risk: number;
  readonly ghost_community_heat: number;
  readonly ghost_gap_pressure: number;
  readonly prosperity_relief: number;
  readonly full_security_relief: number;
  readonly runway_relief: number;
  readonly income_surplus_relief: number;
  readonly coop_cohesion_relief: number;
  readonly ghost_alignment_relief: number;
}

export const DEFAULT_PRESSURE_COLLECTOR_WEIGHTS: PressureCollectorWeights = Object.freeze({
  cash_crisis: 0.26,
  net_worth_collapse: 0.08,
  cashflow_deficit: 0.16,
  shield_damage: 0.18,
  shield_breach: 0.14,
  attack_queue: 0.12,
  cascade_pressure: 0.12,
  hater_heat: 0.08,
  phase_pressure: 0.06,
  time_burn: 0.05,
  solo_isolation_tax: 0.03,
  bleed_mode_tax: 0.05,
  pvp_rivalry_heat: 0.05,
  coop_trust_fracture: 0.06,
  coop_defection_risk: 0.06,
  ghost_community_heat: 0.06,
  ghost_gap_pressure: 0.04,
  prosperity_relief: 0.12,
  full_security_relief: 0.10,
  runway_relief: 0.08,
  income_surplus_relief: 0.06,
  coop_cohesion_relief: 0.05,
  ghost_alignment_relief: 0.04,
});

export interface PressureCollectorLimits {
  readonly cashDangerThreshold: number;
  readonly cashWarningThreshold: number;
  readonly cashSoftThreshold: number;
  readonly weakShieldThreshold: number;
  readonly criticalShieldThreshold: number;
  readonly haterHeatThreshold: number;
  readonly haterHeatMax: number;
  readonly lastThirdStartRatio: number;
  readonly soloIsolationTickGate: number;
  readonly cashRunwayMonthsForFullRelief: number;
}

export const DEFAULT_PRESSURE_COLLECTOR_LIMITS: PressureCollectorLimits = Object.freeze({
  cashDangerThreshold: 2_000,
  cashWarningThreshold: 5_000,
  cashSoftThreshold: 10_000,
  weakShieldThreshold: 0.40,
  criticalShieldThreshold: 0.15,
  haterHeatThreshold: 50,
  haterHeatMax: 100,
  lastThirdStartRatio: 2 / 3,
  soloIsolationTickGate: 10,
  cashRunwayMonthsForFullRelief: 6,
});

export interface PressureDecayProfile {
  readonly maxDropPerTick: number;
  readonly stickyFloor: number;
  readonly tierRetentionFloor: number;
  readonly reasons: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// §4  Core constants and helper functions
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_MAX_DECAY_PER_TICK = 0.05;
export const PRESSURE_HISTORY_DEPTH     = 20;
export const PRESSURE_TREND_WINDOW      = 3;
export const TOP_PRESSURE_SIGNAL_COUNT  = 3;

export function createZeroPressureSignalMap(): Record<PressureSignalKey, number> {
  const map = {} as Record<PressureSignalKey, number>;
  for (const key of PRESSURE_SIGNAL_KEYS) {
    map[key] = 0;
  }
  return map;
}

export function clampPressureScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(Math.max(0, Math.min(1, value)).toFixed(6));
}

export function normalizeWeight(value: number): number {
  return clampPressureScore(value);
}

export function mergePressureCollectorWeights(
  base: PressureCollectorWeights,
  overrides: Partial<PressureCollectorWeights>,
): PressureCollectorWeights {
  return Object.freeze({ ...base, ...overrides });
}

export function resolvePressureTier(score: number): PressureTier {
  const normalized = clampPressureScore(score);
  for (const entry of PRESSURE_THRESHOLDS) {
    if (normalized >= entry.minScore) return entry.value;
  }
  return 'T0';
}

export function resolvePressureBand(score: number): PressureBand {
  const normalized = clampPressureScore(score);
  for (const entry of PRESSURE_BAND_THRESHOLDS) {
    if (normalized >= entry.minScore) return entry.value;
  }
  return 'CALM';
}

export function getPressureTierMinScore(tier: PressureTier): number {
  return PRESSURE_TIER_CONFIGS[tier].minScore;
}

export function rankPressureTier(tier: PressureTier): number {
  switch (tier) {
    case 'T0': return 0;
    case 'T1': return 1;
    case 'T2': return 2;
    case 'T3': return 3;
    case 'T4': return 4;
    default:   return -1;
  }
}

export function rankPressureBand(band: PressureBand): number {
  switch (band) {
    case 'CALM':     return 0;
    case 'BUILDING': return 1;
    case 'ELEVATED': return 2;
    case 'HIGH':     return 3;
    case 'CRITICAL': return 4;
    default:         return -1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §5  Collector module constants and chat hook maps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ML/DL pipeline dimensions for PressureSignalCollector.
 *
 * The collector produces 48 labeled float features per tick (ML vector) and
 * 64 features per row in a windowed DL sequence tensor (ML features + one-hot
 * context encoding). Both dimensions are stable — adding features must append,
 * never insert, to preserve model compatibility.
 */
export const COLLECTOR_ML_FEATURE_COUNT   = 48 as const;
export const COLLECTOR_DL_FEATURE_COUNT   = 64 as const;
export const COLLECTOR_DL_SEQUENCE_LENGTH = 8  as const;

/**
 * Ring-buffer and trend window sizes for the collector history subsystem.
 * COLLECTOR_HISTORY_DEPTH entries are kept in memory per collector instance.
 */
export const COLLECTOR_HISTORY_DEPTH      = 30 as const;
export const COLLECTOR_TREND_WINDOW       = 5  as const;

/**
 * Plateau and spike detection thresholds.
 * A plateau is COLLECTOR_PLATEAU_TICKS or more consecutive ticks within
 * COLLECTOR_PLATEAU_TOLERANCE of the current score.
 * A spike is a single-tick jump >= COLLECTOR_SPIKE_THRESHOLD.
 */
export const COLLECTOR_PLATEAU_TICKS      = 4    as const;
export const COLLECTOR_SPIKE_THRESHOLD    = 0.15 as const;
export const COLLECTOR_PLATEAU_TOLERANCE  = 0.03 as const;

/**
 * Risk score thresholds used by urgency classification and UX hint generation.
 */
export const COLLECTOR_ESCALATION_RISK_HIGH   = 0.70 as const;
export const COLLECTOR_ESCALATION_RISK_MEDIUM = 0.40 as const;
export const COLLECTOR_RECOVERY_PROB_HIGH     = 0.65 as const;

/**
 * Per-tier root chat hook keys.
 * Companion speech systems map these to localized dialogue lines.
 * The hook is chosen when no dominant signal key is available for the tick.
 */
export const COLLECTOR_CHAT_HOOK_MAP: Readonly<Record<PressureTier, string>> = Object.freeze({
  T0: 'pressure.ambient',
  T1: 'pressure.building',
  T2: 'pressure.elevated',
  T3: 'pressure.high',
  T4: 'pressure.critical',
});

/**
 * Per-signal chat hook keys for the 17 positive pressure signal drivers.
 * Used by annotation and UX helpers to surface dominant-driver dialogue.
 * Provides fine-grained companion speech routing beyond the tier level.
 */
export const COLLECTOR_SIGNAL_CHAT_HOOKS: Readonly<Record<PressurePositiveSignalKey, string>> = Object.freeze({
  cash_crisis:          'signal.cash.crisis',
  net_worth_collapse:   'signal.net_worth.collapse',
  cashflow_deficit:     'signal.cashflow.deficit',
  shield_damage:        'signal.shield.damage',
  shield_breach:        'signal.shield.breach',
  attack_queue:         'signal.attack.queue',
  cascade_pressure:     'signal.cascade.pressure',
  hater_heat:           'signal.hater.heat',
  phase_pressure:       'signal.phase.pressure',
  time_burn:            'signal.time.burn',
  solo_isolation_tax:   'signal.solo.isolation',
  bleed_mode_tax:       'signal.bleed.mode',
  pvp_rivalry_heat:     'signal.pvp.rivalry',
  coop_trust_fracture:  'signal.coop.trust_fracture',
  coop_defection_risk:  'signal.coop.defection_risk',
  ghost_community_heat: 'signal.ghost.community',
  ghost_gap_pressure:   'signal.ghost.gap',
});

/**
 * Urgency threshold bounds per urgency level.
 * Keys map urgency labels to the minimum pressure scores that trigger them.
 */
export const COLLECTOR_URGENCY_THRESHOLDS: Readonly<Record<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIENT', number>> = Object.freeze({
  CRITICAL: PRESSURE_TIER_CONFIGS.T4.minScore,
  HIGH:     PRESSURE_TIER_CONFIGS.T3.minScore,
  MEDIUM:   PRESSURE_TIER_CONFIGS.T2.minScore,
  LOW:      PRESSURE_TIER_CONFIGS.T1.minScore,
  AMBIENT:  PRESSURE_TIER_CONFIGS.T0.minScore,
});

/**
 * Categorization of positive pressure signals by their source domain.
 * Used by analytics and chat adapters to understand which game system
 * is driving pressure — economy, shield integrity, battle, temporal, or mode.
 */
export const COLLECTOR_SIGNAL_CATEGORIES: Readonly<{
  economy:      readonly PressurePositiveSignalKey[];
  shield:       readonly PressurePositiveSignalKey[];
  battle:       readonly PressurePositiveSignalKey[];
  temporal:     readonly PressurePositiveSignalKey[];
  modeSpecific: readonly PressurePositiveSignalKey[];
}> = Object.freeze({
  economy:      Object.freeze(['cash_crisis', 'net_worth_collapse', 'cashflow_deficit', 'hater_heat'] as const),
  shield:       Object.freeze(['shield_damage', 'shield_breach'] as const),
  battle:       Object.freeze(['attack_queue', 'cascade_pressure'] as const),
  temporal:     Object.freeze(['phase_pressure', 'time_burn'] as const),
  modeSpecific: Object.freeze([
    'solo_isolation_tax', 'bleed_mode_tax', 'pvp_rivalry_heat',
    'coop_trust_fracture', 'coop_defection_risk',
    'ghost_community_heat', 'ghost_gap_pressure',
  ] as const),
});

/**
 * Ordered relief priorities — determines which relief pathway the system
 * recommends first when multiple options are simultaneously available.
 */
export const COLLECTOR_RELIEF_PRIORITIES: readonly PressureReliefSignalKey[] = Object.freeze([
  'full_security_relief',
  'runway_relief',
  'income_surplus_relief',
  'prosperity_relief',
  'coop_cohesion_relief',
  'ghost_alignment_relief',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// §6  Collector ML and DL feature label arrays
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordered labels for the 48-dimensional ML feature vector produced by
 * CollectorMLExtractor per tick. Index positions are stable across versions —
 * models trained on these features will break if indices shift.
 *
 * Feature groups:
 *   [0-4]   Score dimensions — raw, normalized, and velocity
 *   [5-9]   Tier tracking — rank, previous rank, delta, consecutive counters
 *   [10-16] Band tracking — rank, previous, delta, one-hot active band
 *   [17-33] Positive signal amplitudes (17 signals, normalized by weight cap)
 *   [34-39] Relief signal amplitudes (6 signals, normalized by weight cap)
 *   [40-43] Composite risk/recovery scores
 *   [44-47] Temporal and mode-scope context
 */
export const COLLECTOR_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // [0-4] Score
  'score',
  'raw_positive_score',
  'raw_relief_score',
  'raw_score',
  'score_velocity_abs',
  // [5-9] Tier
  'tier_rank_norm',
  'prev_tier_rank_norm',
  'tier_delta_abs_norm',
  'consecutive_high_tier_ticks_norm',
  'consecutive_critical_ticks_norm',
  // [10-16] Band
  'band_rank_norm',
  'prev_band_rank_norm',
  'band_delta_abs_norm',
  'is_calm',
  'is_building',
  'is_elevated',
  'is_critical',
  // [17-33] Positive signals (17 — PRESSURE_POSITIVE_SIGNAL_KEYS order)
  'signal_cash_crisis',
  'signal_net_worth_collapse',
  'signal_cashflow_deficit',
  'signal_shield_damage',
  'signal_shield_breach',
  'signal_attack_queue',
  'signal_cascade_pressure',
  'signal_hater_heat',
  'signal_phase_pressure',
  'signal_time_burn',
  'signal_solo_isolation_tax',
  'signal_bleed_mode_tax',
  'signal_pvp_rivalry_heat',
  'signal_coop_trust_fracture',
  'signal_coop_defection_risk',
  'signal_ghost_community_heat',
  'signal_ghost_gap_pressure',
  // [34-39] Relief signals (6 — PRESSURE_RELIEF_SIGNAL_KEYS order)
  'relief_prosperity',
  'relief_full_security',
  'relief_runway',
  'relief_income_surplus',
  'relief_coop_cohesion',
  'relief_ghost_alignment',
  // [40-43] Composite
  'stress_index',
  'relief_balance',
  'escalation_risk',
  'recovery_probability',
  // [44-47] Temporal + mode scope
  'tick_progress_norm',
  'velocity_window_avg_abs',
  'acceleration_window_avg_abs',
  'mode_scope_ratio',
] as const);

/**
 * Ordered labels for the 64-dimensional DL row vector produced by
 * CollectorDLBuilder. The first 48 dimensions are identical to
 * COLLECTOR_ML_FEATURE_LABELS; the remaining 16 add one-hot context.
 *
 * Feature groups:
 *   [0-47]  All 48 ML features
 *   [48-51] One-hot game mode (solo / pvp / coop / ghost)
 *   [52-54] One-hot game phase (FOUNDATION / ESCALATION / SOVEREIGNTY)
 *   [55-59] One-hot pressure tier (T0 through T4)
 *   [60-63] Contextual flags: peak score, peak delta, hater injection, shield drain
 */
export const COLLECTOR_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...COLLECTOR_ML_FEATURE_LABELS,
  // [48-51] One-hot mode
  'mode_solo',
  'mode_pvp',
  'mode_coop',
  'mode_ghost',
  // [52-54] One-hot phase
  'phase_foundation',
  'phase_escalation',
  'phase_sovereignty',
  // [55-59] One-hot tier
  'tier_t0',
  'tier_t1',
  'tier_t2',
  'tier_t3',
  'tier_t4',
  // [60-63] Context flags
  'peak_score_norm',
  'peak_delta_norm',
  'hater_injection_armed',
  'shield_drain_active',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// §7  Collector output types
// ─────────────────────────────────────────────────────────────────────────────

/** Five-level urgency classification produced by CollectorAnnotator. */
export type CollectorUrgencyLabel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIENT';

/** Trend direction label produced by CollectorTrendAnalyzer. */
export type CollectorTrendLabel = 'RISING' | 'FALLING' | 'STABLE' | 'SPIKING' | 'PLATEAUING';

/**
 * 48-feature labeled ML vector from CollectorMLExtractor.
 *
 * All features are normalized to [0, 1]. Labels are stable across model versions.
 * Feed directly into online inference pipelines, chat urgency classifiers, or
 * concatenate with other domain vectors for fused multi-domain models.
 */
export interface CollectorMLVector {
  /** Always COLLECTOR_ML_FEATURE_COUNT (48). */
  readonly featureCount: typeof COLLECTOR_ML_FEATURE_COUNT;
  /** 48 float values in COLLECTOR_ML_FEATURE_LABELS index order. */
  readonly features: readonly number[];
  /** Stable ordered labels matching features index-for-index. */
  readonly labels: typeof COLLECTOR_ML_FEATURE_LABELS;
  /** Tick at which this vector was extracted. */
  readonly tick: number;
  /** Raw pressure score [0-1] at extraction time. */
  readonly score: number;
  /** Resolved pressure tier at extraction time. */
  readonly tier: PressureTier;
  /** Resolved pressure band at extraction time. */
  readonly band: PressureBand;
  /** Derived stress index [0-1]. */
  readonly stressIndex: number;
  /** Derived relief balance [0-1]. */
  readonly reliefBalance: number;
}

/**
 * Windowed DL sequence tensor from CollectorDLBuilder.
 *
 * Shape: sequenceLength × 64. Rows are ordered oldest-first so position 0
 * is the oldest retained tick (up to COLLECTOR_DL_SEQUENCE_LENGTH ticks back).
 * Use as LSTM or Transformer input for sequence-level pressure prediction.
 */
export interface CollectorDLTensor {
  /** Always COLLECTOR_DL_FEATURE_COUNT (64). */
  readonly featureCount: typeof COLLECTOR_DL_FEATURE_COUNT;
  /** Number of rows; may be < COLLECTOR_DL_SEQUENCE_LENGTH early in a run. */
  readonly sequenceLength: number;
  /** Row-major matrix: rows[i][j] = feature j at sequence position i. */
  readonly rows: readonly (readonly number[])[];
  /** Column labels matching COLLECTOR_DL_FEATURE_LABELS. */
  readonly labels: typeof COLLECTOR_DL_FEATURE_LABELS;
  /** Tick index of the most recent row. */
  readonly tick: number;
}

/**
 * Trend summary from CollectorTrendAnalyzer.
 * Derived from a sliding window of CollectorHistoryEntry objects.
 * Velocity and acceleration drive companion reaction timing.
 */
export interface CollectorTrendSummary {
  /** Score change per tick. Positive = rising pressure. */
  readonly velocity: number;
  /** Velocity change per tick. Positive = accelerating worsening. */
  readonly acceleration: number;
  /** True if last tick had a jump >= COLLECTOR_SPIKE_THRESHOLD. */
  readonly isSpike: boolean;
  /** True if pressure has been within COLLECTOR_PLATEAU_TOLERANCE for >= COLLECTOR_PLATEAU_TICKS. */
  readonly isPlateau: boolean;
  /** How many consecutive ticks are part of the current plateau. */
  readonly plateauTicks: number;
  /** True when velocity is decreasing — recovery in progress. */
  readonly decelerating: boolean;
  /** True when velocity is increasing — threat compounding. */
  readonly accelerating: boolean;
  /** Semantic trend label. */
  readonly trendLabel: CollectorTrendLabel;
  /** Number of history entries used to compute this summary. */
  readonly window: number;
}

/**
 * Rich annotation bundle from CollectorAnnotator.
 *
 * Surfaces tier/band context, dominant drivers, composite risk scores,
 * urgency classification, and chat hook keys for companion speech systems.
 * The annotation is the primary input to the backend chat pressure lane.
 */
export interface CollectorAnnotationBundle {
  readonly tick: number;
  readonly score: number;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly tierLabel: string;
  readonly bandLabel: string;
  readonly dominantPressureKey: PressurePositiveSignalKey | null;
  readonly dominantReliefKey: PressureReliefSignalKey | null;
  readonly topPressureContributors: readonly PressureSignalContribution[];
  readonly topReliefContributors: readonly PressureSignalContribution[];
  /** Composite stress concentration index [0-1]. */
  readonly stressIndex: number;
  /** Ratio of relief to pressure [0-1]. Near 1.0 = well-covered. */
  readonly reliefBalance: number;
  /** Estimated probability of tier escalation within 10 ticks [0-1]. */
  readonly escalationRisk: number;
  /** Estimated probability of falling below T1 within 20 ticks [0-1]. */
  readonly recoveryProbability: number;
  readonly urgencyLabel: CollectorUrgencyLabel;
  readonly chatHook: string;
  readonly modeScoped: boolean;
}

/**
 * Recovery and escalation forecast from CollectorForecaster.
 * Derived from current score, velocity, acceleration, and decay profile.
 * Tick projections use a simple linear+quadratic model (v*t + 0.5*a*t^2).
 */
export interface CollectorForecast {
  readonly currentScore: number;
  readonly currentTier: PressureTier;
  /** Tier projected to be active at 10-tick horizon. */
  readonly targetTier: PressureTier;
  /** Ticks until score drops below 0.12 (T0 territory). Null = unknown. */
  readonly ticksToCalm: number | null;
  /** Ticks until score drops below current tier's floor. Null = not falling. */
  readonly ticksToNextTierDown: number | null;
  /** Ticks until score crosses current tier ceiling. Null = not rising. */
  readonly ticksToNextTierUp: number | null;
  readonly recoveryLikelihood: number;
  readonly escalationLikelihood: number;
  readonly forecastedScoreIn5Ticks: number;
  readonly forecastedScoreIn10Ticks: number;
  readonly forecastedScoreIn20Ticks: number;
}

/**
 * UX hint from CollectorAnnotator for companion display and speech prioritization.
 * Drives overlay display, companion reaction scheduling, and speech routing.
 */
export interface CollectorUXHint {
  readonly urgency: CollectorUrgencyLabel;
  readonly chatHook: string;
  readonly shortSummary: string;
  readonly fullSummary: string;
  readonly recommendedAction: string | null;
  readonly escalationWarning: boolean;
  readonly reliefAvailable: boolean;
  readonly dominantDriver: PressurePositiveSignalKey | null;
}

/**
 * Running analytics summary from CollectorAnalytics.
 * Tracks score distribution, stress patterns, and ML/DL emission counts
 * across the lifetime of a collector instance.
 */
export interface CollectorAnalyticsSummary {
  readonly totalCollections: number;
  readonly avgScore: number;
  readonly stdDevScore: number;
  readonly peakScore: number;
  readonly peakTick: number;
  readonly tierEscalations: number;
  readonly tierDeescalations: number;
  readonly highPressureTicks: number;
  readonly criticalPressureTicks: number;
  readonly mlExtractCount: number;
  readonly dlBuildCount: number;
  readonly avgStressIndex: number;
  readonly avgReliefBalance: number;
}

/**
 * Health state of the collector subsystem produced by CollectorInspector.
 * Surfaces config validity, initialization status, and clamp diagnostics.
 */
export interface CollectorHealthState {
  readonly initialized: boolean;
  readonly weightsValid: boolean;
  readonly limitsValid: boolean;
  readonly droppedScores: number;
  readonly lastClampedScore: number | null;
  readonly hasHistory: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// §8  Collector history, watermark, and inspector types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single-tick history entry stored in collector ring buffers.
 * Compact enough for COLLECTOR_HISTORY_DEPTH entries in RAM.
 * Includes derived fields so consumers do not recompute per-entry.
 */
export interface CollectorHistoryEntry {
  readonly tick: number;
  readonly score: number;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly collection: PressureSignalCollection;
  readonly stressIndex: number;
  readonly reliefBalance: number;
  readonly dominantPressureKey: PressurePositiveSignalKey | null;
}

/**
 * Watermark record — tracks the highest observed pressure state.
 * Updated whenever a new peak score is observed during a run.
 */
export interface CollectorWatermark {
  readonly score: number;
  readonly tick: number;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  /** Wall-clock timestamp in ms since epoch. */
  readonly timestamp: number;
}

/**
 * Full diagnostic snapshot of the collector subsystem from CollectorInspector.
 * Used for diagnostics, chat adapter state reports, and per-run analytics.
 */
export interface CollectorInspectorState {
  readonly version: string;
  readonly tick: number;
  readonly totalCollections: number;
  readonly currentScore: number;
  readonly currentTier: PressureTier;
  readonly currentBand: PressureBand;
  readonly peakScore: number;
  readonly peakTick: number;
  readonly totalEscalations: number;
  readonly totalDeescalations: number;
  readonly totalCriticalEnters: number;
  readonly mlExtractCount: number;
  readonly dlBuildCount: number;
  readonly avgScore: number;
  readonly avgReliefBalance: number;
  readonly avgStressIndex: number;
  readonly watermark: CollectorWatermark | null;
  readonly lastTrendSummary: CollectorTrendSummary | null;
  readonly lastForecast: CollectorForecast | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// §9  Mode-specific and phase-specific pressure profile types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mode-level behavioral profile for annotation and analytics.
 *
 * Each game mode has distinct pressure amplification, relief suppression,
 * and mode-scoped signal routing. The chat lane uses these profiles to
 * calibrate companion speech intensity and action recommendation specificity.
 */
export interface CollectorModeProfile {
  readonly mode: 'solo' | 'pvp' | 'coop' | 'ghost';
  /**
   * Multiplier applied when annotating urgency for this mode.
   * > 1.0 = pressure feels more intense in this mode.
   */
  readonly stressMultiplier: number;
  /**
   * Fraction of computed relief balance suppressed in this mode.
   * 0.0 = no suppression; 0.10 = 10% of relief score ignored.
   */
  readonly reliefSuppression: number;
  readonly modeScopedSignals: readonly PressurePositiveSignalKey[];
  readonly dominantPressureKey: PressurePositiveSignalKey;
  readonly chatHookPrefix: string;
  /** Score above which mode-specific risk pathways activate. */
  readonly escalationThreshold: number;
  /** Score below which mode-specific signals automatically deactivate. */
  readonly deescalationThreshold: number;
}

/**
 * Phase-level sensitivity profile for annotation and forecasting.
 *
 * FOUNDATION is forgiving; ESCALATION amplifies; SOVEREIGNTY compounds risk.
 * The phase profile adjusts how aggressively the collector interprets the
 * same raw pressure score in chat-lane routing decisions.
 */
export interface CollectorPhaseProfile {
  readonly phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
  /**
   * Multiplier on escalation risk estimates.
   * 1.0 = baseline; > 1.0 = same score feels more dangerous.
   */
  readonly pressureSensitivity: number;
  /**
   * Additive bonus applied to recovery probability estimates.
   * Positive = easier to recover; negative = harder.
   */
  readonly recoveryBonus: number;
  /** Additive penalty applied to escalation risk estimates. */
  readonly escalationPenalty: number;
  readonly chatHookSuffix: string;
  /** Tier that triggers phase-specific alerts when entered. */
  readonly dangerFloorTier: PressureTier;
}

export const COLLECTOR_MODE_PROFILES: Readonly<Record<'solo' | 'pvp' | 'coop' | 'ghost', CollectorModeProfile>> = Object.freeze({
  solo: Object.freeze({
    mode: 'solo',
    stressMultiplier: 1.10,
    reliefSuppression: 0.05,
    modeScopedSignals: ['solo_isolation_tax', 'bleed_mode_tax'] as const,
    dominantPressureKey: 'solo_isolation_tax',
    chatHookPrefix: 'solo',
    escalationThreshold: 0.40,
    deescalationThreshold: 0.25,
  }),
  pvp: Object.freeze({
    mode: 'pvp',
    stressMultiplier: 1.25,
    reliefSuppression: 0.10,
    modeScopedSignals: ['pvp_rivalry_heat'] as const,
    dominantPressureKey: 'pvp_rivalry_heat',
    chatHookPrefix: 'pvp',
    escalationThreshold: 0.35,
    deescalationThreshold: 0.20,
  }),
  coop: Object.freeze({
    mode: 'coop',
    stressMultiplier: 1.05,
    reliefSuppression: 0.0,
    modeScopedSignals: ['coop_trust_fracture', 'coop_defection_risk'] as const,
    dominantPressureKey: 'coop_trust_fracture',
    chatHookPrefix: 'coop',
    escalationThreshold: 0.45,
    deescalationThreshold: 0.30,
  }),
  ghost: Object.freeze({
    mode: 'ghost',
    stressMultiplier: 1.15,
    reliefSuppression: 0.0,
    modeScopedSignals: ['ghost_community_heat', 'ghost_gap_pressure'] as const,
    dominantPressureKey: 'ghost_gap_pressure',
    chatHookPrefix: 'ghost',
    escalationThreshold: 0.50,
    deescalationThreshold: 0.35,
  }),
});

export const COLLECTOR_PHASE_PROFILES: Readonly<Record<'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY', CollectorPhaseProfile>> = Object.freeze({
  FOUNDATION: Object.freeze({
    phase: 'FOUNDATION',
    pressureSensitivity: 0.90,
    recoveryBonus: 0.15,
    escalationPenalty: 0.0,
    chatHookSuffix: 'foundation',
    dangerFloorTier: 'T3',
  }),
  ESCALATION: Object.freeze({
    phase: 'ESCALATION',
    pressureSensitivity: 1.10,
    recoveryBonus: 0.0,
    escalationPenalty: 0.05,
    chatHookSuffix: 'escalation',
    dangerFloorTier: 'T2',
  }),
  SOVEREIGNTY: Object.freeze({
    phase: 'SOVEREIGNTY',
    pressureSensitivity: 1.30,
    recoveryBonus: -0.10,
    escalationPenalty: 0.10,
    chatHookSuffix: 'sovereignty',
    dangerFloorTier: 'T1',
  }),
});

/**
 * Look up the mode behavioral profile for a given mode identifier.
 * Used by CollectorAnnotator and CollectorAnalytics when mode context is known.
 */
export function buildCollectorModeProfile(
  mode: 'solo' | 'pvp' | 'coop' | 'ghost',
): CollectorModeProfile {
  return COLLECTOR_MODE_PROFILES[mode];
}

/**
 * Look up the phase sensitivity profile for a given phase identifier.
 * Used by CollectorForecaster and CollectorAnnotator for phase-adjusted risk.
 */
export function buildCollectorPhaseProfile(
  phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
): CollectorPhaseProfile {
  return COLLECTOR_PHASE_PROFILES[phase];
}

// ─────────────────────────────────────────────────────────────────────────────
// §10  Signal normalization, composite score, and crossing helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw signal amount by its configured weight cap.
 * Returns a value in [0, 1] where 1.0 = signal is at full weight cap.
 * Returns 0 if weight <= 0 to prevent divide-by-zero.
 */
export function normalizeSignalByWeight(rawAmount: number, weight: number): number {
  if (weight <= 0) return 0;
  return clampPressureScore(rawAmount / weight);
}

/**
 * Convert a normalized pressure score [0-1] to a percentage [0-100].
 * Used in UX hint summaries, companion dialogue, and diagnostic displays.
 */
export function scoreToPercentage(score: number): number {
  return Number((clampPressureScore(score) * 100).toFixed(2));
}

/**
 * Compute the ratio of mode-scoped contributions to total contributions.
 * Returns 0 if there are no contributions.
 * A value near 1.0 means pressure is almost entirely mode-specific,
 * which signals high companion speech sensitivity for the active mode.
 */
export function computeModeScopeRatio(collection: PressureSignalCollection): number {
  const total = collection.contributions.length;
  if (total === 0) return 0;
  const modeCount = collection.contributions.filter(c => c.modeScoped).length;
  return clampPressureScore(modeCount / total);
}

/**
 * Classify a tier transition as escalation, de-escalation, or no change.
 * Used by CollectorInspector to track tier history and fire escalation events.
 */
export function computeTierCrossing(
  from: PressureTier,
  to: PressureTier,
): 'escalation' | 'deescalation' | 'none' {
  const diff = rankPressureTier(to) - rankPressureTier(from);
  if (diff > 0) return 'escalation';
  if (diff < 0) return 'deescalation';
  return 'none';
}

/**
 * Classify a band transition as escalation, de-escalation, or no change.
 * Band crossings can happen within a tier and are tracked independently.
 */
export function computeBandCrossing(
  from: PressureBand,
  to: PressureBand,
): 'escalation' | 'deescalation' | 'none' {
  const diff = rankPressureBand(to) - rankPressureBand(from);
  if (diff > 0) return 'escalation';
  if (diff < 0) return 'deescalation';
  return 'none';
}

/**
 * Compute the stress index: a composite of raw positive score, top-contributor
 * concentration, and mode-scope bonus.
 *
 * The stress index captures the *character* of pressure — concentrated single-driver
 * pressure scores higher than evenly-distributed pressure at the same magnitude,
 * because concentrated pressure is harder to route around.
 *
 * Range: [0, 1]. Values > 0.70 indicate acute stress that should interrupt companion.
 */
export function computeStressIndex(collection: PressureSignalCollection): number {
  const raw = clampPressureScore(collection.rawPositiveScore);
  if (raw === 0) return 0;

  const sorted = [...collection.contributions].sort((a, b) => b.amount - a.amount);
  const top3Sum = sorted.slice(0, TOP_PRESSURE_SIGNAL_COUNT).reduce((s, c) => s + c.amount, 0);
  const dominance = clampPressureScore(top3Sum / raw);

  const modeScopeBonus = collection.contributions.some(c => c.modeScoped) ? 0.05 : 0;

  return clampPressureScore(raw * 0.65 + dominance * 0.30 + modeScopeBonus);
}

/**
 * Compute the relief balance: ratio of active relief to active pressure.
 *
 * 1.0 = relief exactly matches all positive pressure.
 * Values > 0.70 = strong recovery potential.
 * Values < 0.20 = relief is severely insufficient.
 * Returns 1.0 when there is no pressure (denominator = 0).
 */
export function computeReliefBalance(collection: PressureSignalCollection): number {
  const totalPositive = collection.rawPositiveScore;
  const totalRelief   = collection.rawReliefScore;

  if (totalPositive <= 0) return 1.0;
  return clampPressureScore(totalRelief / Math.max(totalPositive, 0.001));
}

/**
 * Return the top-N signal contributions ranked by amount descending.
 * Returns an empty frozen array for n <= 0 or empty input.
 */
export function rankTopContributors(
  contributions: readonly PressureSignalContribution[],
  n: number,
): readonly PressureSignalContribution[] {
  if (contributions.length === 0 || n <= 0) return Object.freeze([]);
  return Object.freeze(
    [...contributions].sort((a, b) => b.amount - a.amount).slice(0, n),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// §11  Urgency classification and chat hook helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the escalation risk estimate given current score, velocity, and tier.
 * Returns [0, 1] where 1.0 = near-certain escalation within ~5 ticks.
 *
 * Factors (weighted sum):
 * - Score proximity to the next tier threshold (20%)
 * - Current tier rank (25% — higher tier = more dangerous baseline)
 * - Positive velocity (25% — actively worsening)
 * - Raw score magnitude (30%)
 */
export function computeEscalationRisk(
  score: number,
  velocity: number,
  tier: PressureTier,
): number {
  const clamped       = clampPressureScore(score);
  const tierRank      = rankPressureTier(tier);
  const scoreFactor   = clamped;
  const tierFactor    = tierRank / 4;
  const velocityFactor = velocity > 0 ? clampPressureScore(velocity * 6) : 0;

  let proximityFactor = 0;
  if (tier !== 'T4') {
    const nextBoundary = PRESSURE_TIER_CONFIGS[tier].maxScoreExclusive;
    const distance     = Math.max(0, nextBoundary - clamped);
    proximityFactor    = clampPressureScore(Math.max(0, 1 - distance * 8));
  }

  return clampPressureScore(
    scoreFactor     * 0.30 +
    tierFactor      * 0.25 +
    velocityFactor  * 0.25 +
    proximityFactor * 0.20,
  );
}

/**
 * Compute the recovery probability estimate given current score and velocity.
 * Returns [0, 1] where 1.0 = very likely to recover to calm within 20 ticks.
 *
 * Factors:
 * - Low score (50%) — more headroom below danger bands
 * - Falling velocity (40%) — active recovery in progress
 * - Base potential (10%) — always nonzero (game is recoverable)
 * - Rising velocity penalty (-30% of velocity factor)
 */
export function computeRecoveryProbability(score: number, velocity: number): number {
  const clamped       = clampPressureScore(score);
  const scoreFactor   = 1 - clamped;
  const fallingBonus  = velocity < 0 ? clampPressureScore(Math.abs(velocity) * 8) : 0;
  const risingPenalty = velocity > 0 ? clampPressureScore(velocity * 5) * 0.30 : 0;

  return clampPressureScore(
    scoreFactor  * 0.50 +
    fallingBonus * 0.40 -
    risingPenalty +
    0.10,
  );
}

/**
 * Classify urgency from tier, current velocity, and consecutive high-tier ticks.
 * Returns a five-level label driving companion speech priority and chat routing.
 *
 * Classification rules (evaluated in priority order):
 *   T4               → CRITICAL (always interrupts)
 *   T3               → HIGH (always high — even while falling)
 *   T2 + rising      → HIGH (actively worsening elevated)
 *   T2               → MEDIUM
 *   T1 + sustained   → MEDIUM (5+ consecutive ticks builds urgency)
 *   T1               → LOW
 *   T0               → AMBIENT (no companion interrupt)
 */
export function classifyUrgency(
  tier: PressureTier,
  velocity: number,
  consecutiveTicks: number,
): CollectorUrgencyLabel {
  if (tier === 'T4') return 'CRITICAL';
  if (tier === 'T3') return 'HIGH';
  if (tier === 'T2' && velocity > 0.02) return 'HIGH';
  if (tier === 'T2') return 'MEDIUM';
  if (tier === 'T1' && consecutiveTicks >= 5) return 'MEDIUM';
  if (tier === 'T1') return 'LOW';
  return 'AMBIENT';
}

/**
 * Build the root chat hook key for a given urgency, tier, and dominant signal.
 *
 * Priority:
 * 1. Signal-specific hook when dominant key is known and urgency is not AMBIENT
 * 2. Tier-level fallback from COLLECTOR_CHAT_HOOK_MAP
 */
export function buildChatHook(
  urgency: CollectorUrgencyLabel,
  tier: PressureTier,
  dominantKey: PressurePositiveSignalKey | null,
): string {
  if (dominantKey && urgency !== 'AMBIENT') {
    return COLLECTOR_SIGNAL_CHAT_HOOKS[dominantKey];
  }
  return COLLECTOR_CHAT_HOOK_MAP[tier];
}

// ─────────────────────────────────────────────────────────────────────────────
// §12  ML feature extraction helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input parameters for extractCollectorMLFeatures.
 * All state-tracking values are passed explicitly so the function remains
 * pure — given the same inputs it always returns the same output.
 */
export interface CollectorMLFeaturesParams {
  readonly collection: PressureSignalCollection;
  readonly tier: PressureTier;
  readonly prevTier: PressureTier;
  readonly band: PressureBand;
  readonly prevBand: PressureBand;
  readonly tick: number;
  readonly consecutiveHighTierTicks: number;
  readonly consecutiveCriticalTicks: number;
  /** Instantaneous velocity from the most recent two ticks. */
  readonly velocity: number;
  /** Mean of the last COLLECTOR_TREND_WINDOW velocity samples. */
  readonly velocityWindowAvg: number;
  /** Mean of the last COLLECTOR_TREND_WINDOW acceleration samples. */
  readonly accelerationWindowAvg: number;
  /** Mode-scoped contribution ratio [0-1] from computeModeScopeRatio. */
  readonly modeScopeRatio: number;
}

/**
 * Extract the 48-feature ML vector from a single-tick pressure signal collection.
 *
 * Feature ordering matches COLLECTOR_ML_FEATURE_LABELS exactly.
 * All values are normalized to [0, 1] and guaranteed finite.
 *
 * This function is pure: no state mutation, no I/O. Callers maintain
 * history, consecutive-tick counters, and velocity averages externally.
 */
export function extractCollectorMLFeatures(
  params: CollectorMLFeaturesParams,
): readonly number[] {
  const {
    collection, tier, prevTier, band, prevBand,
    tick, consecutiveHighTierTicks, consecutiveCriticalTicks,
    velocity, velocityWindowAvg, accelerationWindowAvg, modeScopeRatio,
  } = params;

  const tierRank     = rankPressureTier(tier);
  const prevTierRank = rankPressureTier(prevTier);
  const bandRank     = rankPressureBand(band);
  const prevBandRank = rankPressureBand(prevBand);

  const positiveFeatures = PRESSURE_POSITIVE_SIGNAL_KEYS.map((key) =>
    normalizeSignalByWeight(
      collection.pressureBreakdown[key],
      DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key],
    ),
  );
  const reliefFeatures = PRESSURE_RELIEF_SIGNAL_KEYS.map((key) =>
    normalizeSignalByWeight(
      collection.reliefBreakdown[key],
      DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key],
    ),
  );

  const stressIdx = computeStressIndex(collection);
  const reliefBal = computeReliefBalance(collection);
  const escRisk   = computeEscalationRisk(collection.score, velocity, tier);
  const recovProb = computeRecoveryProbability(collection.score, velocity);

  return Object.freeze([
    // [0-4] Score
    clampPressureScore(collection.score),
    clampPressureScore(collection.rawPositiveScore),
    clampPressureScore(collection.rawReliefScore),
    clampPressureScore(collection.rawScore),
    clampPressureScore(Math.abs(velocity)),
    // [5-9] Tier
    tierRank / 4,
    prevTierRank / 4,
    clampPressureScore(Math.abs(tierRank - prevTierRank) / 4),
    clampPressureScore(consecutiveHighTierTicks / 20),
    clampPressureScore(consecutiveCriticalTicks / 20),
    // [10-16] Band
    bandRank / 4,
    prevBandRank / 4,
    clampPressureScore(Math.abs(bandRank - prevBandRank) / 4),
    band === 'CALM'     ? 1 : 0,
    band === 'BUILDING' ? 1 : 0,
    band === 'ELEVATED' ? 1 : 0,
    band === 'CRITICAL' ? 1 : 0,
    // [17-33] Positive signal features (17)
    ...positiveFeatures,
    // [34-39] Relief signal features (6)
    ...reliefFeatures,
    // [40-43] Composite
    stressIdx,
    reliefBal,
    escRisk,
    recovProb,
    // [44-47] Temporal + mode scope
    clampPressureScore(Math.min(1, tick / 100)),
    clampPressureScore(Math.abs(velocityWindowAvg)),
    clampPressureScore(Math.abs(accelerationWindowAvg)),
    clampPressureScore(modeScopeRatio),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// §13  DL row construction helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input parameters for buildCollectorDLRow.
 * Extends ML params with mode/phase one-hot context and peak/context flags
 * that make up the extra 16 DL-only dimensions beyond the ML feature set.
 */
export interface CollectorDLRowParams extends CollectorMLFeaturesParams {
  readonly mode: 'solo' | 'pvp' | 'coop' | 'ghost';
  readonly phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
  readonly peakScore: number;
  readonly haterInjectionArmed: boolean;
  readonly shieldDrainActive: boolean;
}

/**
 * Build a single 64-feature DL row for one tick of a windowed sequence.
 *
 * The first 48 dimensions are identical to extractCollectorMLFeatures.
 * The final 16 add one-hot encodings of mode, phase, tier, and context flags.
 *
 * Collect COLLECTOR_DL_SEQUENCE_LENGTH rows (oldest-first) into a
 * CollectorDLTensor for LSTM or Transformer model input.
 */
export function buildCollectorDLRow(params: CollectorDLRowParams): readonly number[] {
  const mlFeatures = extractCollectorMLFeatures(params);
  const {
    mode, phase, tier, peakScore, collection,
    haterInjectionArmed, shieldDrainActive,
  } = params;

  return Object.freeze([
    ...mlFeatures,
    mode === 'solo'          ? 1 : 0,   // [48]
    mode === 'pvp'           ? 1 : 0,   // [49]
    mode === 'coop'          ? 1 : 0,   // [50]
    mode === 'ghost'         ? 1 : 0,   // [51]
    phase === 'FOUNDATION'   ? 1 : 0,   // [52]
    phase === 'ESCALATION'   ? 1 : 0,   // [53]
    phase === 'SOVEREIGNTY'  ? 1 : 0,   // [54]
    tier === 'T0' ? 1 : 0,              // [55]
    tier === 'T1' ? 1 : 0,              // [56]
    tier === 'T2' ? 1 : 0,              // [57]
    tier === 'T3' ? 1 : 0,              // [58]
    tier === 'T4' ? 1 : 0,              // [59]
    clampPressureScore(peakScore),                                    // [60]
    clampPressureScore(Math.abs(peakScore - collection.score)),       // [61]
    haterInjectionArmed ? 1 : 0,        // [62]
    shieldDrainActive   ? 1 : 0,        // [63]
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// §14  Trend analysis pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute instantaneous velocity from the most recent two history entries.
 * Velocity > 0 = pressure rising; < 0 = pressure falling.
 * Returns 0 if fewer than 2 entries are available.
 */
export function computeCollectorVelocity(
  history: readonly CollectorHistoryEntry[],
): number {
  if (history.length < 2) return 0;
  const prev = history[history.length - 2]!;
  const curr = history[history.length - 1]!;
  return Number((curr.score - prev.score).toFixed(6));
}

/**
 * Compute the mean velocity over the last `window` ticks.
 * If fewer entries exist, averages what is available.
 * Returns 0 if fewer than 2 entries.
 */
export function computeCollectorVelocityAvg(
  history: readonly CollectorHistoryEntry[],
  window: number,
): number {
  if (history.length < 2) return 0;
  const slice = history.slice(Math.max(0, history.length - window));
  if (slice.length < 2) return 0;
  const velocities: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    velocities.push(slice[i]!.score - slice[i - 1]!.score);
  }
  const sum = velocities.reduce((s, v) => s + v, 0);
  return Number((sum / velocities.length).toFixed(6));
}

/**
 * Compute instantaneous acceleration from the last three ticks.
 * Acceleration > 0 = velocity is increasing (worsening trend).
 * Returns 0 if fewer than 3 ticks in history.
 */
export function computeCollectorAcceleration(
  history: readonly CollectorHistoryEntry[],
): number {
  if (history.length < 3) return 0;
  const n  = history.length;
  const v1 = history[n - 2]!.score - history[n - 3]!.score;
  const v2 = history[n - 1]!.score - history[n - 2]!.score;
  return Number((v2 - v1).toFixed(6));
}

/**
 * Compute the mean acceleration over the last `window` ticks.
 * Returns 0 if fewer than 3 entries.
 */
export function computeCollectorAccelerationAvg(
  history: readonly CollectorHistoryEntry[],
  window: number,
): number {
  if (history.length < 3) return 0;
  const slice = history.slice(Math.max(0, history.length - window));
  if (slice.length < 3) return 0;
  const accels: number[] = [];
  for (let i = 2; i < slice.length; i++) {
    const v1 = slice[i - 1]!.score - slice[i - 2]!.score;
    const v2 = slice[i]!.score     - slice[i - 1]!.score;
    accels.push(v2 - v1);
  }
  const sum = accels.reduce((s, a) => s + a, 0);
  return Number((sum / accels.length).toFixed(6));
}

/**
 * Count consecutive recent ticks where score stayed within `tolerance`
 * of the most recent score. Used to detect sustained high-pressure plateaus.
 * Returns 0 if history is empty.
 */
export function computeCollectorPlateauTicks(
  history: readonly CollectorHistoryEntry[],
  tolerance: number,
): number {
  if (history.length === 0) return 0;
  const current = history[history.length - 1]!.score;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (Math.abs(history[i]!.score - current) <= tolerance) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Detect a pressure spike: a single-tick score jump >= spikeThreshold.
 * Returns false if fewer than 2 history entries are available.
 */
export function detectPressureSpike(
  history: readonly CollectorHistoryEntry[],
  spikeThreshold: number,
): boolean {
  if (history.length < 2) return false;
  const delta = history[history.length - 1]!.score - history[history.length - 2]!.score;
  return delta >= spikeThreshold;
}

/**
 * Detect a sustained plateau: pressure has been elevated and within tolerance
 * for at least minTicks consecutive ticks.
 */
export function detectPressurePlateau(
  history: readonly CollectorHistoryEntry[],
  tolerance: number,
  minTicks: number,
): boolean {
  return computeCollectorPlateauTicks(history, tolerance) >= minTicks;
}

/**
 * Compute the running mean of pressure scores over the provided history.
 * Returns 0 if history is empty.
 */
export function computeRunningAvgScore(
  history: readonly CollectorHistoryEntry[],
): number {
  if (history.length === 0) return 0;
  const sum = history.reduce((s, e) => s + e.score, 0);
  return Number((sum / history.length).toFixed(6));
}

/**
 * Compute the sample standard deviation of pressure scores in history.
 * Returns 0 if fewer than 2 entries are available.
 */
export function computeScoreStdDev(
  history: readonly CollectorHistoryEntry[],
): number {
  if (history.length < 2) return 0;
  const mean     = computeRunningAvgScore(history);
  const variance = history.reduce((s, e) => s + (e.score - mean) ** 2, 0) / (history.length - 1);
  return Number(Math.sqrt(variance).toFixed(6));
}

// ─────────────────────────────────────────────────────────────────────────────
// §15  Annotation, UX hint, and history entry construction helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parameters for buildCollectorAnnotation.
 */
export interface CollectorAnnotationParams {
  readonly collection: PressureSignalCollection;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly tick: number;
  /** Instantaneous velocity from the last two ticks. */
  readonly velocity: number;
  /** Number of consecutive ticks in current tier (for urgency classification). */
  readonly consecutiveTicks: number;
}

/**
 * Build a rich CollectorAnnotationBundle from a single tick's data.
 *
 * Computes: stressIndex, reliefBalance, escalationRisk, recoveryProbability,
 * urgency label, chat hook, top contributors, and tier/band metadata.
 * This is the primary input to the backend chat pressure lane per tick.
 */
export function buildCollectorAnnotation(
  params: CollectorAnnotationParams,
): CollectorAnnotationBundle {
  const { collection, tier, band, tick, velocity, consecutiveTicks } = params;
  const stressIndex    = computeStressIndex(collection);
  const reliefBalance  = computeReliefBalance(collection);
  const escalationRisk = computeEscalationRisk(collection.score, velocity, tier);
  const recoveryProb   = computeRecoveryProbability(collection.score, velocity);
  const urgency        = classifyUrgency(tier, velocity, consecutiveTicks);
  const chatHook       = buildChatHook(urgency, tier, collection.dominantPressureKey);
  const topPressure    = rankTopContributors(collection.contributions, TOP_PRESSURE_SIGNAL_COUNT);
  const topRelief      = rankTopContributors(collection.reliefContributions, TOP_PRESSURE_SIGNAL_COUNT);
  const modeScoped     = collection.contributions.some(c => c.modeScoped);
  const tierConfig     = PRESSURE_TIER_CONFIGS[tier];

  return Object.freeze({
    tick,
    score:                   collection.score,
    tier,
    band,
    tierLabel:               tierConfig.label,
    bandLabel:               band,
    dominantPressureKey:     collection.dominantPressureKey,
    dominantReliefKey:       collection.dominantReliefKey,
    topPressureContributors: Object.freeze([...topPressure]),
    topReliefContributors:   Object.freeze([...topRelief]),
    stressIndex,
    reliefBalance,
    escalationRisk,
    recoveryProbability:     recoveryProb,
    urgencyLabel:            urgency,
    chatHook,
    modeScoped,
  });
}

/**
 * Build a CollectorUXHint for companion speech and overlay display.
 * Requires a pre-computed forecast so the full summary can include projections.
 */
export function buildCollectorUXHint(
  urgency: CollectorUrgencyLabel,
  tier: PressureTier,
  collection: PressureSignalCollection,
  forecast: CollectorForecast,
): CollectorUXHint {
  const dominantKey    = collection.dominantPressureKey;
  const dominantRelief = collection.dominantReliefKey;
  const reliefBalance  = computeReliefBalance(collection);

  return Object.freeze({
    urgency,
    chatHook:           buildChatHook(urgency, tier, dominantKey),
    shortSummary:       buildShortPressureSummary(urgency, tier, dominantKey),
    fullSummary:        buildFullPressureSummary(tier, collection, forecast),
    recommendedAction:  buildRecommendedAction(urgency, dominantKey, dominantRelief, forecast),
    escalationWarning:  forecast.escalationLikelihood >= COLLECTOR_ESCALATION_RISK_HIGH,
    reliefAvailable:    reliefBalance >= 0.30,
    dominantDriver:     dominantKey,
  });
}

/**
 * Build a compact CollectorHistoryEntry for ring-buffer storage.
 * Derives and caches stressIndex and reliefBalance so per-history-scan
 * operations never need to recompute them from the full collection.
 */
export function buildCollectorHistoryEntry(params: {
  readonly collection: PressureSignalCollection;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly tick: number;
}): CollectorHistoryEntry {
  return Object.freeze({
    tick:                params.tick,
    score:               params.collection.score,
    tier:                params.tier,
    band:                params.band,
    collection:          params.collection,
    stressIndex:         computeStressIndex(params.collection),
    reliefBalance:       computeReliefBalance(params.collection),
    dominantPressureKey: params.collection.dominantPressureKey,
  });
}

// ── Private helpers used by buildCollectorUXHint ──────────────────────────────

function buildShortPressureSummary(
  urgency: CollectorUrgencyLabel,
  tier: PressureTier,
  dominantKey: PressurePositiveSignalKey | null,
): string {
  const tierLabel = PRESSURE_TIER_CONFIGS[tier].label;
  if (!dominantKey || urgency === 'AMBIENT') {
    return `Pressure at ${tierLabel} — monitoring`;
  }
  return `${tierLabel} pressure — ${COLLECTOR_SIGNAL_CHAT_HOOKS[dominantKey]} leading`;
}

function buildFullPressureSummary(
  tier: PressureTier,
  collection: PressureSignalCollection,
  forecast: CollectorForecast,
): string {
  const tierLabel  = PRESSURE_TIER_CONFIGS[tier].label;
  const scorePct   = scoreToPercentage(collection.score).toFixed(0);
  const fore10     = scoreToPercentage(forecast.forecastedScoreIn10Ticks).toFixed(0);
  const recov      = scoreToPercentage(forecast.recoveryLikelihood).toFixed(0);
  const esc        = scoreToPercentage(forecast.escalationLikelihood).toFixed(0);
  return (
    `Pressure ${scorePct}% (${tierLabel}). ` +
    `10-tick projection: ${fore10}%. ` +
    `Recovery likelihood: ${recov}%. ` +
    `Escalation risk: ${esc}%.`
  );
}

function buildRecommendedAction(
  urgency: CollectorUrgencyLabel,
  dominantKey: PressurePositiveSignalKey | null,
  dominantReliefKey: PressureReliefSignalKey | null,
  forecast: CollectorForecast,
): string | null {
  if (urgency === 'AMBIENT') return null;
  if (forecast.recoveryLikelihood >= COLLECTOR_RECOVERY_PROB_HIGH) {
    return 'Hold current strategy — recovery in progress';
  }
  if (urgency === 'CRITICAL') {
    return dominantKey
      ? `Resolve ${COLLECTOR_SIGNAL_CHAT_HOOKS[dominantKey]} immediately`
      : 'Immediate pressure relief required';
  }
  if (urgency === 'HIGH') {
    return dominantReliefKey
      ? `Activate ${dominantReliefKey} relief pathway`
      : 'Build relief reserves now';
  }
  if (urgency === 'MEDIUM') {
    return dominantKey
      ? `Monitor ${COLLECTOR_SIGNAL_CHAT_HOOKS[dominantKey]} driver`
      : 'Watch for escalation signals';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// §16  Forecast construction helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parameters for buildCollectorForecast.
 */
export interface CollectorForecastParams {
  readonly currentScore: number;
  readonly currentTier: PressureTier;
  /** Instantaneous velocity from the last two ticks. */
  readonly velocity: number;
  /** Window-averaged acceleration from the last trend window. */
  readonly acceleration: number;
  /**
   * Maximum score drop allowed per tick from the decay controller.
   * Falls back to DEFAULT_MAX_DECAY_PER_TICK when no controller is active.
   */
  readonly maxDecayPerTick: number;
}

/**
 * Build a CollectorForecast from score, tier, velocity, and acceleration.
 *
 * Projection model: score(t) = currentScore + velocity*t + 0.5*acceleration*t²
 *
 * The model is intentionally simple. Its value is in routing chat signals
 * and companion decisions at game speed — not in precise scientific accuracy.
 *
 * Tick-to-calm uses the effective decay rate (max of |velocity| and maxDecayPerTick).
 * Tick-to-tier-crossings use instantaneous velocity only.
 */
export function buildCollectorForecast(params: CollectorForecastParams): CollectorForecast {
  const { currentScore, currentTier, velocity, acceleration, maxDecayPerTick } = params;
  const clamped  = clampPressureScore(currentScore);
  const tierRank = rankPressureTier(currentTier);

  const predict = (ticks: number): number => {
    const projected = clamped + velocity * ticks + 0.5 * acceleration * ticks * ticks;
    return clampPressureScore(projected);
  };

  const score5  = predict(5);
  const score10 = predict(10);
  const score20 = predict(20);

  // Ticks until score drops below T0 max (calm territory)
  const calmTarget = PRESSURE_TIER_CONFIGS['T0'].maxScoreExclusive;
  let ticksToCalm: number | null = null;
  if (clamped < calmTarget) {
    ticksToCalm = 0;
  } else {
    const effectiveDecay = Math.max(
      velocity < 0 ? Math.abs(velocity) : 0,
      maxDecayPerTick,
    );
    if (effectiveDecay > 0) {
      ticksToCalm = Math.ceil((clamped - calmTarget) / effectiveDecay);
    }
  }

  // Ticks until score drops below current tier's minimum (tier-down crossing)
  let ticksToNextTierDown: number | null = null;
  if (tierRank > 0 && velocity < 0) {
    const minScore   = PRESSURE_TIER_CONFIGS[currentTier].minScore;
    const dropNeeded = Math.max(0, clamped - minScore);
    ticksToNextTierDown = dropNeeded > 0 ? Math.ceil(dropNeeded / Math.abs(velocity)) : 0;
  }

  // Ticks until score crosses current tier's ceiling (tier-up crossing)
  let ticksToNextTierUp: number | null = null;
  if (tierRank < 4 && velocity > 0) {
    const maxScore    = PRESSURE_TIER_CONFIGS[currentTier].maxScoreExclusive;
    const raiseNeeded = Math.max(0, maxScore - clamped);
    ticksToNextTierUp = raiseNeeded > 0 ? Math.ceil(raiseNeeded / velocity) : 0;
  }

  return Object.freeze({
    currentScore:             clamped,
    currentTier,
    targetTier:               resolvePressureTier(score10),
    ticksToCalm,
    ticksToNextTierDown,
    ticksToNextTierUp,
    recoveryLikelihood:       computeRecoveryProbability(clamped, velocity),
    escalationLikelihood:     computeEscalationRisk(clamped, velocity, currentTier),
    forecastedScoreIn5Ticks:  score5,
    forecastedScoreIn10Ticks: score10,
    forecastedScoreIn20Ticks: score20,
  });
}

/**
 * Compute a phase-adjusted escalation risk.
 * Applies the phase sensitivity multiplier and additive penalty on top of the
 * base escalation risk. SOVEREIGNTY makes the same score much more dangerous.
 */
export function computePhaseAdjustedEscalationRisk(
  score: number,
  velocity: number,
  tier: PressureTier,
  phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
): number {
  const base    = computeEscalationRisk(score, velocity, tier);
  const profile = COLLECTOR_PHASE_PROFILES[phase];
  return clampPressureScore(base * profile.pressureSensitivity + profile.escalationPenalty);
}

/**
 * Compute a phase-adjusted recovery probability.
 * FOUNDATION adds a recovery bonus; SOVEREIGNTY applies a recovery penalty.
 */
export function computePhaseAdjustedRecoveryProbability(
  score: number,
  velocity: number,
  phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
): number {
  const base    = computeRecoveryProbability(score, velocity);
  const profile = COLLECTOR_PHASE_PROFILES[phase];
  return clampPressureScore(base + profile.recoveryBonus);
}

/**
 * Compute a mode-adjusted stress index.
 * Applies the mode's stressMultiplier and reliefSuppression to the base
 * stress index, surfacing the true felt intensity within a game mode.
 */
export function computeModeAdjustedStressIndex(
  collection: PressureSignalCollection,
  mode: 'solo' | 'pvp' | 'coop' | 'ghost',
): number {
  const base          = computeStressIndex(collection);
  const profile       = COLLECTOR_MODE_PROFILES[mode];
  const relief        = computeReliefBalance(collection);
  const adjustedRelief = relief * (1 - profile.reliefSuppression);
  return clampPressureScore(base * profile.stressMultiplier * (1 - adjustedRelief * 0.20));
}

// ─────────────────────────────────────────────────────────────────────────────
// §17  Threat, resilience, and validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a composite threat score that aggregates pressure score,
 * stress index, and phase-adjusted escalation risk into a single [0-1] metric.
 *
 * Use as a single-number "how dangerous is this tick" indicator for:
 * - Chat adapter priority routing
 * - Companion speech interrupt thresholds
 * - Difficulty tuning feedback loops
 */
export function computeCollectorThreatScore(
  score: number,
  velocity: number,
  tier: PressureTier,
  phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
): number {
  const escRisk      = computePhaseAdjustedEscalationRisk(score, velocity, tier, phase);
  const scoreFactor  = clampPressureScore(score);
  const tierFactor   = rankPressureTier(tier) / 4;

  return clampPressureScore(
    scoreFactor * 0.40 +
    escRisk     * 0.40 +
    tierFactor  * 0.20,
  );
}

/**
 * Compute a composite resilience score: the inverse of the threat score.
 * High resilience = good recovery potential + strong relief coverage.
 *
 * Used by CollectorAnalytics to track recovery arc quality and
 * surface "player is recovering well" companion moments.
 */
export function computeCollectorResilienceScore(
  score: number,
  velocity: number,
  reliefBalance: number,
): number {
  const recovProb     = computeRecoveryProbability(score, velocity);
  const reliefFactor  = clampPressureScore(reliefBalance);
  const scoreFactor   = 1 - clampPressureScore(score);

  return clampPressureScore(
    recovProb    * 0.45 +
    reliefFactor * 0.35 +
    scoreFactor  * 0.20,
  );
}

/**
 * Validate a PressureCollectorWeights config and return a health status.
 *
 * Checks:
 * - All numeric values are finite and in [0, 1]
 * - The sum of positive-signal weights does not exceed 3.0 (sanity cap)
 * - The sum of relief weights does not exceed 1.0
 */
export function validateCollectorWeights(weights: PressureCollectorWeights): {
  readonly valid: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];

  for (const key of PRESSURE_SIGNAL_KEYS) {
    const val = weights[key];
    if (!Number.isFinite(val) || val < 0 || val > 1) {
      errors.push(`Weight "${key}" is out of range [0,1]: ${String(val)}`);
    }
  }

  const posSum = PRESSURE_POSITIVE_SIGNAL_KEYS.reduce((s, k) => s + weights[k], 0);
  if (posSum > 3.0) {
    errors.push(`Sum of positive signal weights (${posSum.toFixed(3)}) exceeds 3.0`);
  }

  const reliefSum = PRESSURE_RELIEF_SIGNAL_KEYS.reduce((s, k) => s + weights[k], 0);
  if (reliefSum > 1.0) {
    errors.push(`Sum of relief signal weights (${reliefSum.toFixed(3)}) exceeds 1.0`);
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

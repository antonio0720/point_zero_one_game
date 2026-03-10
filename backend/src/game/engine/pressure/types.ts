/*
 * POINT ZERO ONE — BACKEND PRESSURE TYPES
 * /backend/src/game/engine/pressure/types.ts
 *
 * Doctrine:
 * - pressure.score is normalized 0.0 → 1.0
 * - pressure.tier preserves T0 → T4 cadence semantics used across backend engines
 * - pressure.band carries richer semantic meaning for UI, dossier, and ML layers
 * - weights, bounds, caps, and helper functions live here as the single source of truth
 */

import type { PressureTier } from '../core/GamePrimitives';
import type { PressureBand } from '../core/RunStateSnapshot';

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
  { value: 'T0', minScore: 0.0, label: 'CALM' },
] as const);

export const PRESSURE_BAND_THRESHOLDS: readonly PressureThreshold<PressureBand>[] = Object.freeze([
  { value: 'CRITICAL', minScore: 0.75, label: 'CRITICAL' },
  { value: 'HIGH', minScore: 0.55, label: 'HIGH' },
  { value: 'ELEVATED', minScore: 0.35, label: 'ELEVATED' },
  { value: 'BUILDING', minScore: 0.12, label: 'BUILDING' },
  { value: 'CALM', minScore: 0.0, label: 'CALM' },
] as const);

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
export type PressureReliefSignalKey = typeof PRESSURE_RELIEF_SIGNAL_KEYS[number];
export type PressureSignalKey = typeof PRESSURE_SIGNAL_KEYS[number];

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

export const DEFAULT_MAX_DECAY_PER_TICK = 0.05;
export const PRESSURE_HISTORY_DEPTH = 20;
export const PRESSURE_TREND_WINDOW = 3;
export const TOP_PRESSURE_SIGNAL_COUNT = 3;

export function createZeroPressureSignalMap(): Record<PressureSignalKey, number> {
  const map = {} as Record<PressureSignalKey, number>;
  for (const key of PRESSURE_SIGNAL_KEYS) {
    map[key] = 0;
  }
  return map;
}

export function clampPressureScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(Math.max(0, Math.min(1, value)).toFixed(6));
}

export function normalizeWeight(value: number): number {
  return clampPressureScore(value);
}

export function mergePressureCollectorWeights(
  base: PressureCollectorWeights,
  overrides: Partial<PressureCollectorWeights>,
): PressureCollectorWeights {
  return Object.freeze({
    ...base,
    ...overrides,
  });
}

export function resolvePressureTier(score: number): PressureTier {
  const normalized = clampPressureScore(score);

  for (const entry of PRESSURE_THRESHOLDS) {
    if (normalized >= entry.minScore) {
      return entry.value;
    }
  }

  return 'T0';
}

export function resolvePressureBand(score: number): PressureBand {
  const normalized = clampPressureScore(score);

  for (const entry of PRESSURE_BAND_THRESHOLDS) {
    if (normalized >= entry.minScore) {
      return entry.value;
    }
  }

  return 'CALM';
}

export function getPressureTierMinScore(tier: PressureTier): number {
  return PRESSURE_TIER_CONFIGS[tier].minScore;
}

export function rankPressureTier(tier: PressureTier): number {
  switch (tier) {
    case 'T0':
      return 0;
    case 'T1':
      return 1;
    case 'T2':
      return 2;
    case 'T3':
      return 3;
    case 'T4':
      return 4;
    default:
      return -1;
  }
}

export function rankPressureBand(band: PressureBand): number {
  switch (band) {
    case 'CALM':
      return 0;
    case 'BUILDING':
      return 1;
    case 'ELEVATED':
      return 2;
    case 'HIGH':
      return 3;
    case 'CRITICAL':
      return 4;
    default:
      return -1;
  }
}
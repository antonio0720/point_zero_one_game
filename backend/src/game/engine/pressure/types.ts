/*
 * POINT ZERO ONE — BACKEND PRESSURE TYPES
 * /backend/src/game/engine/pressure/types.ts
 *
 * Doctrine:
 * - pressure.score is normalized 0.0 → 1.0
 * - pressure.tier preserves legacy T0 → T4 cadence semantics
 * - pressure.band carries richer semantic meaning for UI / dossier / ML layers
 * - thresholds must remain deterministic and backend-owned
 */

import type { PressureTier } from '../core/GamePrimitives';
import type { PressureBand } from '../core/RunStateSnapshot';

export interface PressureThreshold<TValue extends string> {
  readonly value: TValue;
  readonly minScore: number;
}

export type PressureSignalKey =
  | 'cash_crisis'
  | 'net_worth_collapse'
  | 'cashflow_deficit'
  | 'shield_damage'
  | 'shield_breach'
  | 'attack_queue'
  | 'cascade_pressure'
  | 'hater_heat'
  | 'phase_pressure'
  | 'time_burn'
  | 'solo_isolation_tax'
  | 'bleed_mode_tax'
  | 'pvp_rivalry_heat'
  | 'coop_trust_fracture'
  | 'coop_defection_risk'
  | 'ghost_community_heat'
  | 'ghost_gap_pressure';

export interface PressureSignalContribution {
  readonly key: PressureSignalKey;
  readonly amount: number;
  readonly reason: string;
}

export interface PressureSignalCollection {
  readonly rawScore: number;
  readonly score: number;
  readonly contributions: readonly PressureSignalContribution[];
}

export interface PressureDecayProfile {
  readonly maxDropPerTick: number;
  readonly stickyFloor: number;
}

export const PRESSURE_THRESHOLDS: readonly PressureThreshold<PressureTier>[] = [
  { value: 'T4', minScore: 0.75 },
  { value: 'T3', minScore: 0.55 },
  { value: 'T2', minScore: 0.35 },
  { value: 'T1', minScore: 0.12 },
  { value: 'T0', minScore: 0.0 },
] as const;

export const PRESSURE_BAND_THRESHOLDS: readonly PressureThreshold<PressureBand>[] = [
  { value: 'CRITICAL', minScore: 0.75 },
  { value: 'HIGH', minScore: 0.55 },
  { value: 'ELEVATED', minScore: 0.35 },
  { value: 'BUILDING', minScore: 0.12 },
  { value: 'CALM', minScore: 0.0 },
] as const;

export function clampPressureScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(Math.max(0, Math.min(1, value)).toFixed(6));
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
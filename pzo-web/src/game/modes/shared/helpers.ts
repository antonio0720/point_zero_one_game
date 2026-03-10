import type {
  CORDProjection,
  EngineSnapshotLike,
  FrontendModeCode,
  FrontendRunMode,
  GapDirection,
  MetricBar,
  PressureTier,
  PsycheState,
  SoloPhase,
  TrustBand,
} from '../contracts';
import {
  GHOST_DECAY_MILESTONES,
  MODE_TO_CODE,
  PREDATOR_RULES,
  PRESSURE_TICK_MS,
  SOLO_PHASE_WINDOWS,
} from './constants';

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
export const pct = (current: number, max: number): number => (max <= 0 ? 0 : clamp(current / max, 0, 1));
export const round = (value: number, digits = 2): number => Number(value.toFixed(digits));
export const modeCodeFor = (mode: FrontendRunMode): FrontendModeCode => MODE_TO_CODE[mode];
export const safeNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function determineSoloPhase(elapsedMs: number): SoloPhase {
  return SOLO_PHASE_WINDOWS.find(window => elapsedMs >= window.startMs && elapsedMs < window.endMs)?.phase ?? 'SOVEREIGNTY';
}

export function pressureTierFromValue(value: number): PressureTier {
  if (value <= 0.12) return 'T0';
  if (value <= 0.35) return 'T1';
  if (value <= 0.55) return 'T2';
  if (value <= 0.78) return 'T3';
  return 'T4';
}

export function toShieldBars(snapshot: EngineSnapshotLike): MetricBar[] {
  return (['L1', 'L2', 'L3', 'L4'] as const).map((layer, index) => {
    const current = safeNumber(snapshot.shields[layer], 0);
    const max = 100;
    return {
      id: layer,
      label: layer,
      current,
      max,
      pct: pct(current, max),
      colorToken: current < 25 ? 'danger' : current < 55 ? 'warn' : 'success',
      subtitle: ['Liquidity Buffer', 'Credit Line', 'Network Core', 'Asset Base'][index],
    };
  });
}

export function toPrimaryBars(snapshot: EngineSnapshotLike): MetricBar[] {
  return [
    {
      id: 'cash',
      label: 'Cash',
      current: snapshot.cash,
      max: Math.max(snapshot.freedomThreshold, snapshot.netWorth, 1),
      pct: pct(snapshot.cash, Math.max(snapshot.freedomThreshold, snapshot.netWorth, 1)),
      colorToken: snapshot.cash < 5_000 ? 'warn' : 'success',
    },
    {
      id: 'networth',
      label: 'Net Worth',
      current: snapshot.netWorth,
      max: Math.max(snapshot.freedomThreshold, snapshot.netWorth, 1),
      pct: pct(snapshot.netWorth, Math.max(snapshot.freedomThreshold, snapshot.netWorth, 1)),
      colorToken: snapshot.netWorth < 0 ? 'danger' : 'success',
    },
    {
      id: 'pressure',
      label: 'Pressure',
      current: safeNumber(snapshot.pressureValue, 0.5) * 100,
      max: 100,
      pct: clamp(safeNumber(snapshot.pressureValue, 0.5), 0, 1),
      colorToken: snapshot.pressureTier === 'T4' ? 'danger' : snapshot.pressureTier === 'T3' ? 'warn' : 'info',
      subtitle: `${snapshot.pressureTier} · ${PRESSURE_TICK_MS[snapshot.pressureTier]}ms`,
    },
  ];
}

export function classifyPsyche(snapshot: EngineSnapshotLike): PsycheState {
  const opponent = snapshot.opponent;
  if (!opponent) return 'COMPOSED';
  const lowShields = Object.values(opponent.shields).filter(value => value < 40).length;
  const noBudget = safeNumber(opponent.battleBudget, PREDATOR_RULES.battleBudgetCap) < 10;
  const weakCash = opponent.cash < 3_000;
  if (weakCash && lowShields >= 3) return 'DESPERATE';
  if (snapshot.pressureTier === 'T4' && noBudget && opponent.netWorth < snapshot.netWorth) return 'BREAKING';
  if (lowShields >= 2 || safeNumber(opponent.cascadeChainsActive, 0) > 0) return 'CRACKING';
  if (lowShields >= 1 || safeNumber(opponent.decisionSpeedScore, 1) < 0.45) return 'STRESSED';
  return 'COMPOSED';
}

export function classifyTrustBand(score: number): TrustBand {
  if (score >= 90) return 'SOVEREIGN_TRUST';
  if (score >= 75) return 'STRONG';
  if (score >= 55) return 'WORKING';
  if (score >= 30) return 'FRACTURED';
  return 'BROKEN';
}

export function determineGapDirection(value: number): GapDirection {
  if (value > 0.015) return 'UP';
  if (value < -0.015) return 'DOWN';
  return 'FLAT';
}

export function determineLegendDecay(hours: number): { label: string; severity: number; attack: string } {
  let active: (typeof GHOST_DECAY_MILESTONES)[number] = GHOST_DECAY_MILESTONES[0];
  for (const milestone of GHOST_DECAY_MILESTONES) {
    if (hours >= milestone.hours) active = milestone;
  }
  return { label: active.label, severity: active.severity, attack: active.attack };
}

export function inferOutcome(snapshot: EngineSnapshotLike): CORDProjection['outcome'] {
  if (snapshot.netWorth >= snapshot.freedomThreshold) return 'FREEDOM';
  if (snapshot.netWorth < 0) return 'BANKRUPT';
  if (snapshot.elapsedMs >= snapshot.totalRunMs) return 'TIMEOUT';
  return 'TIMEOUT';
}

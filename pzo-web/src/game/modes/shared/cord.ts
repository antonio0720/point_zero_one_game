import type { CORDProjection, EngineSnapshotLike, FrontendRunMode } from '../contracts';
import { clamp, inferOutcome, round } from './helpers';

const OUTCOME_MULTIPLIERS: Record<CORDProjection['outcome'], number> = {
  FREEDOM: 1.5,
  TIMEOUT: 0.8,
  BANKRUPT: 0.4,
  ABANDONED: 0,
};

export interface CORDFlags {
  clutch?: boolean;
  noHoldRun?: boolean;
  sovereignSweep?: boolean;
  coldStart?: boolean;
  exterminator?: boolean;
  bleedRun?: boolean;
  firstBlood?: boolean;
  economicAnnihilation?: boolean;
  perfectCounter?: boolean;
  betrayalSurvivor?: boolean;
  fullSynergy?: boolean;
  cascadeAbsorber?: boolean;
  syndicateChampion?: boolean;
  ghostSlayer?: boolean;
  legendGap?: boolean;
  dynasty?: boolean;
  ironGhost?: boolean;
}

export function projectCORD(mode: FrontendRunMode, snapshot: EngineSnapshotLike, flags: CORDFlags = {}): CORDProjection {
  const outcome = inferOutcome(snapshot);
  const base = {
    decision_speed_score: clamp(snapshot.decisionSpeedScore ?? 0.5, 0, 1) * 0.25,
    shields_maintained_pct: clamp(avgShield(snapshot) / 100, 0, 1) * 0.20,
    hater_sabotages_blocked: clamp((snapshot.blockedSabotages ?? 0) / 10, 0, 1) * 0.20,
    cascade_chains_broken: clamp((snapshot.cascadeChainsBroken ?? 0) / 10, 0, 1) * 0.20,
    pressure_survived_score: clamp(snapshot.pressureSurvivedScore ?? 0.5, 0, 1) * 0.15,
  };

  let projectedCord = Object.values(base).reduce((sum, value) => sum + value, 0) * OUTCOME_MULTIPLIERS[outcome];
  const appliedBonuses: string[] = [];

  const add = (name: string, value: number): void => {
    projectedCord += value;
    appliedBonuses.push(name);
  };

  if (mode === 'solo') {
    if (flags.clutch) add('Clutch', projectedCord * 0.40);
    if (flags.noHoldRun) add('No-Hold Run', projectedCord * 0.25);
    if (flags.sovereignSweep) add('Sovereign Sweep', projectedCord * 0.30);
    if (flags.coldStart) add('Cold Start', projectedCord * 0.45);
    if (flags.exterminator) add('Exterminator', projectedCord * 0.50);
    if (flags.bleedRun) add('Bleed Run', projectedCord * 0.80);
  }

  if (mode === 'asymmetric-pvp') {
    if (flags.firstBlood) add('First Blood', projectedCord * 0.15);
    if (flags.economicAnnihilation) add('Economic Annihilation', projectedCord * 0.40);
    if (flags.perfectCounter) add('Perfect Counter', projectedCord * 0.35);
  }

  if (mode === 'co-op') {
    if (flags.betrayalSurvivor) add('Betrayal Survivor', projectedCord * 0.60);
    if (flags.fullSynergy) add('Full Synergy', projectedCord * 0.45);
    if (flags.cascadeAbsorber) add('Cascade Absorber', projectedCord * 0.35);
    if (flags.syndicateChampion) add('Syndicate Champion', projectedCord * 0.25);
  }

  if (mode === 'ghost') {
    if (flags.ghostSlayer) add('Ghost Slayer', projectedCord * 0.20);
    if (flags.legendGap) add('Legend Gap', projectedCord * 0.75);
    if (flags.dynasty) add('Dynasty', projectedCord * 1.00);
    if (flags.ironGhost) add('Iron Ghost', projectedCord * 0.55);
  }

  const ceiling = mode === 'solo' && flags.bleedRun ? 1.8 : 1.5;
  projectedCord = clamp(projectedCord, 0, ceiling);

  return {
    projectedCord: round(projectedCord, 3),
    projectedGrade: toGrade(projectedCord),
    outcome,
    componentBreakdown: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, round(v, 3)])),
    appliedBonuses,
    ceiling,
  };
}

function avgShield(snapshot: EngineSnapshotLike): number {
  const values = Object.values(snapshot.shields);
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function toGrade(value: number): CORDProjection['projectedGrade'] {
  if (value >= 1.5) return 'S';
  if (value >= 1.2) return 'A';
  if (value >= 0.9) return 'B';
  if (value >= 0.6) return 'C';
  if (value >= 0.3) return 'D';
  return 'F';
}

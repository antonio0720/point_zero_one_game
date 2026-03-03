/**
 * PhantomGhostEngine — src/ml/PhantomGhostEngine.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #4: Phantom Ghost Imitation Learning + Style Clusters
 *
 * Defines Legend styles derived from VERIFIED run clusters.
 * Ghost generator creates a target trajectory for the current player
 * based on their skill signature and selected legend style.
 */

import type { KnowledgeState } from './KnowledgeTracer';

// ─── Legend Style Clusters ────────────────────────────────────────────────────

export type LegendStyleId =
  | 'AGGRESSIVE_TEMPO'
  | 'DISCIPLINE_LOCK'
  | 'INCOME_COMPOUNDING'
  | 'RESILIENCE_FORTRESS'
  | 'RISK_ARBITRAGE';

export interface LegendStyle {
  id:               LegendStyleId;
  label:            string;
  description:      string;
  /** Characteristic behaviors — used to generate ghost trajectory */
  traits: {
    avgWindowResponseMs:  number;
    preferredZones:       string[];
    avgPlaysPerPhase:     number[];    // [foundation, momentum, accel, crisis, collapse]
    cashflowFocusRatio:   number;      // 0=net-worth, 1=cashflow
    riskTolerance:        number;      // 0–1
    biasResistance:       number;      // 0–1
    obligationCoverage:   number;      // target ratio
  };
  /** Minimum CORD score to qualify as this style */
  cordThreshold:    number;
}

export const LEGEND_STYLES: Record<LegendStyleId, LegendStyle> = {
  AGGRESSIVE_TEMPO: {
    id: 'AGGRESSIVE_TEMPO', label: 'Aggressive Tempo',
    description: 'Plays fast, takes calculated risks, maximizes early-phase card volume',
    traits: {
      avgWindowResponseMs: 1_800, preferredZones: ['SCALE', 'FLIP'],
      avgPlaysPerPhase: [8, 12, 14, 10, 6], cashflowFocusRatio: 0.3,
      riskTolerance: 0.8, biasResistance: 0.5, obligationCoverage: 1.3,
    },
    cordThreshold: 800,
  },
  DISCIPLINE_LOCK: {
    id: 'DISCIPLINE_LOCK', label: 'Discipline Lock',
    description: 'Never chases, always covered, zero bias activations under pressure',
    traits: {
      avgWindowResponseMs: 4_200, preferredZones: ['BUILD', 'RESERVE'],
      avgPlaysPerPhase: [6, 8, 9, 7, 5], cashflowFocusRatio: 0.7,
      riskTolerance: 0.25, biasResistance: 0.95, obligationCoverage: 2.1,
    },
    cordThreshold: 850,
  },
  INCOME_COMPOUNDING: {
    id: 'INCOME_COMPOUNDING', label: 'Income Compounding',
    description: 'Systematic cashflow builder. Every card adds to monthly income.',
    traits: {
      avgWindowResponseMs: 3_000, preferredZones: ['BUILD', 'SCALE'],
      avgPlaysPerPhase: [7, 10, 11, 9, 6], cashflowFocusRatio: 0.9,
      riskTolerance: 0.4, biasResistance: 0.75, obligationCoverage: 1.8,
    },
    cordThreshold: 780,
  },
  RESILIENCE_FORTRESS: {
    id: 'RESILIENCE_FORTRESS', label: 'Resilience Fortress',
    description: 'Absorbs everything. Shield-heavy, never distressed, recovered from every FUBAR.',
    traits: {
      avgWindowResponseMs: 3_800, preferredZones: ['RESERVE', 'BUILD'],
      avgPlaysPerPhase: [5, 7, 8, 8, 7], cashflowFocusRatio: 0.5,
      riskTolerance: 0.15, biasResistance: 0.85, obligationCoverage: 2.5,
    },
    cordThreshold: 820,
  },
  RISK_ARBITRAGE: {
    id: 'RISK_ARBITRAGE', label: 'Risk Arbitrage',
    description: 'Hunts asymmetric upside. Enters FLIP and SCALE zones with surgical timing.',
    traits: {
      avgWindowResponseMs: 2_200, preferredZones: ['FLIP', 'SCALE', 'LEARN'],
      avgPlaysPerPhase: [6, 9, 13, 11, 7], cashflowFocusRatio: 0.2,
      riskTolerance: 0.75, biasResistance: 0.6, obligationCoverage: 1.4,
    },
    cordThreshold: 860,
  },
};

// ─── Ghost Trajectory ─────────────────────────────────────────────────────────

export interface GhostCheckpoint {
  tick:       number;
  netWorth:   number;
  cashflow:   number;
  cordScore:  number;
  phase:      string;
}

export interface GhostTrajectory {
  legendStyle:  LegendStyleId;
  legendLabel:  string;
  checkpoints:  GhostCheckpoint[];
  targetCord:   number;
  /** Hash of this trajectory for proof chain */
  trajectoryId: string;
}

function fnv32Hex(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function generateGhostTrajectory(
  style:        LegendStyleId,
  startingCash: number,
  totalTicks:   number,
  seed:         number,
): GhostTrajectory {
  const legend = LEGEND_STYLES[style];
  const rng    = seededRng(seed);

  // Build checkpoints at phase boundaries
  const phaseTicks = [0, 0.2, 0.45, 0.65, 0.85, 1.0].map(p => Math.floor(p * totalTicks));
  const phaseNames = ['FOUNDATION', 'MOMENTUM', 'ACCELERATION', 'CRISIS', 'COLLAPSE'];

  let netWorth = startingCash;
  let cashflow = 0;
  let cord     = 0;

  const checkpoints: GhostCheckpoint[] = [];

  for (let i = 0; i < phaseNames.length; i++) {
    const playsInPhase = legend.traits.avgPlaysPerPhase[i] ?? 8;
    const phaseRisk    = legend.traits.riskTolerance;
    const variance     = (rng() - 0.5) * 0.3;

    const nwGain = playsInPhase * (8_000 + rng() * 12_000) * (1 + phaseRisk * 0.5 + variance);
    const cfGain = playsInPhase * 500 * legend.traits.cashflowFocusRatio * (1 + variance);

    netWorth += nwGain;
    cashflow += cfGain;
    cord     += playsInPhase * 12 * (1 + legend.traits.biasResistance * 0.3);

    checkpoints.push({
      tick:      phaseTicks[i + 1],
      netWorth:  Math.round(netWorth),
      cashflow:  Math.round(cashflow),
      cordScore: Math.round(cord),
      phase:     phaseNames[i],
    });
  }

  const trajectoryId = fnv32Hex(`${style}:${seed}:${totalTicks}`);

  return {
    legendStyle: style,
    legendLabel: legend.label,
    checkpoints,
    targetCord:  Math.round(cord),
    trajectoryId,
  };
}

/** Select best-matched legend style for a player based on their knowledge profile */
export function matchLegendStyle(knowledgeStates: KnowledgeState[]): LegendStyleId {
  const masteryMap = new Map(knowledgeStates.map(s => [s.tag, s.mastery]));

  const cashflowMastery = masteryMap.get('cashflow_management') ?? 0.5;
  const riskMastery     = masteryMap.get('leverage_risk')       ?? 0.5;
  const biasMastery     = masteryMap.get('behavioral_bias')     ?? 0.5;
  const divMastery      = masteryMap.get('diversification')     ?? 0.5;

  if (biasMastery > 0.75 && cashflowMastery > 0.7) return 'DISCIPLINE_LOCK';
  if (cashflowMastery > 0.75 && divMastery > 0.6)  return 'INCOME_COMPOUNDING';
  if (riskMastery < 0.4)                            return 'RESILIENCE_FORTRESS';
  if (riskMastery > 0.7 && biasMastery > 0.6)      return 'RISK_ARBITRAGE';
  return 'AGGRESSIVE_TEMPO';
}

function seededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/legendDecayModel.ts
// Sprint 6 — Legend Decay System
//
// Legends decay over time — older runs become easier to beat.
// Decay makes the leaderboard dynamic: hold the top spot, or be surpassed.
// Decay Exploit cards are stronger against aged legends.
// Dynasty tier legends decay slower (dynasty tax on decay rate).
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

export type LegendTier = 'ROOKIE' | 'CONTENDER' | 'CHAMPION' | 'DYNASTY' | 'IMMORTAL';

export interface LegendRecord {
  legendId: string;
  userId: string;
  displayName: string;
  runId: string;
  finalCordScore: number;
  finalNetWorth: number;
  finalTick: number;
  seed: number;
  createdAtServerTick: number;   // server tick when registered
  currentDecayFactor: number;    // 1.0 fresh → 0.0 fully decayed
  tier: LegendTier;
  timesBeaten: number;
  dynastyDefenseCount: number;   // successful defenses in dynasty
  /** Compressed ghost timeline for replay */
  snapshotCount: number;
}

export interface LegendDecayState {
  records: Record<string, LegendRecord>;
  /** Current server tick for decay calculations */
  serverTick: number;
}

export const INITIAL_DECAY_STATE: LegendDecayState = {
  records: {},
  serverTick: 0,
};

// ─── Register ────────────────────────────────────────────────────────────────

export function registerLegend(
  state: LegendDecayState,
  record: Omit<LegendRecord, 'currentDecayFactor' | 'tier' | 'timesBeaten' | 'dynastyDefenseCount'>,
): LegendDecayState {
  const tier = computeTier(record.finalCordScore, record.dynastyDefenseCount ?? 0);
  const full: LegendRecord = {
    ...record,
    currentDecayFactor: 1.0,
    tier,
    timesBeaten: 0,
    dynastyDefenseCount: 0,
  };
  return {
    ...state,
    records: { ...state.records, [record.legendId]: full },
  };
}

// ─── Tick Decay ───────────────────────────────────────────────────────────────

export function applyLegendDecay(state: LegendDecayState, newServerTick: number): LegendDecayState {
  const tickDelta = newServerTick - state.serverTick;
  if (tickDelta <= 0) return state;

  const updatedRecords: Record<string, LegendRecord> = {};

  for (const [id, legend] of Object.entries(state.records)) {
    const age = newServerTick - legend.createdAtServerTick;
    if (age < PHANTOM_CONFIG.legendDecayMinAgeTicks) {
      updatedRecords[id] = legend;
      continue;
    }

    const decayRate = getDecayRate(legend.tier);
    const newDecay = Math.max(0, legend.currentDecayFactor - decayRate * tickDelta);
    updatedRecords[id] = { ...legend, currentDecayFactor: parseFloat(newDecay.toFixed(4)) };
  }

  return { ...state, records: updatedRecords, serverTick: newServerTick };
}

// ─── Beat a Legend ────────────────────────────────────────────────────────────

export function recordLegendBeaten(
  state: LegendDecayState,
  legendId: string,
  beatByUserId: string,
): LegendDecayState {
  const legend = state.records[legendId];
  if (!legend) return state;

  // Being beaten accelerates decay slightly
  const decayPenalty = legend.tier === 'DYNASTY' || legend.tier === 'IMMORTAL' ? 0.02 : 0.05;
  const newDecay = Math.max(0, legend.currentDecayFactor - decayPenalty);
  const timesBeaten = legend.timesBeaten + 1;

  return {
    ...state,
    records: {
      ...state.records,
      [legendId]: { ...legend, currentDecayFactor: parseFloat(newDecay.toFixed(4)), timesBeaten },
    },
  };
}

// ─── Dynasty Defense ─────────────────────────────────────────────────────────

export function recordDynastyDefense(state: LegendDecayState, legendId: string): LegendDecayState {
  const legend = state.records[legendId];
  if (!legend) return state;

  const dynastyDefenseCount = legend.dynastyDefenseCount + 1;
  const tier = computeTier(legend.finalCordScore, dynastyDefenseCount);

  // Successful defense restores some decay
  const decayRestore = 0.03;
  const newDecay = Math.min(1.0, legend.currentDecayFactor + decayRestore);

  return {
    ...state,
    records: {
      ...state.records,
      [legendId]: { ...legend, dynastyDefenseCount, tier, currentDecayFactor: parseFloat(newDecay.toFixed(4)) },
    },
  };
}

// ─── Decay Exploit Bonus ──────────────────────────────────────────────────────

export function computeDecayExploitBonus(legend: LegendRecord): number {
  // Older legends = higher exploit bonus on decay-exploit cards
  const ageFactor = 1 - legend.currentDecayFactor;
  return parseFloat((ageFactor * 0.30).toFixed(3));  // up to 30% bonus
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function isLegendActive(legend: LegendRecord): boolean {
  return legend.currentDecayFactor > 0.15;
}

export function legendTierLabel(tier: LegendTier): string {
  const labels: Record<LegendTier, string> = {
    ROOKIE: 'Rookie', CONTENDER: 'Contender',
    CHAMPION: 'Champion', DYNASTY: 'Dynasty', IMMORTAL: 'Immortal',
  };
  return labels[tier];
}

// ─── Internal ────────────────────────────────────────────────────────────────

function computeTier(cordScore: number, dynastyDefenses: number): LegendTier {
  if (dynastyDefenses >= 10) return 'IMMORTAL';
  if (dynastyDefenses >= 5)  return 'DYNASTY';
  if (cordScore >= 0.90)     return 'CHAMPION';
  if (cordScore >= 0.80)     return 'CONTENDER';
  return 'ROOKIE';
}

function getDecayRate(tier: LegendTier): number {
  const rates: Record<LegendTier, number> = {
    ROOKIE:     PHANTOM_CONFIG.legendDecayRatePerTick * 2.0,
    CONTENDER:  PHANTOM_CONFIG.legendDecayRatePerTick * 1.5,
    CHAMPION:   PHANTOM_CONFIG.legendDecayRatePerTick * 1.0,
    DYNASTY:    PHANTOM_CONFIG.legendDecayRatePerTick * 0.5,
    IMMORTAL:   PHANTOM_CONFIG.legendDecayRatePerTick * 0.2,
  };
  return rates[tier];
}

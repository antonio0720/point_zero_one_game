// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/legendDecayModel.ts
// Sprint 7 — Legend Decay System (fully rebuilt)
//
// Legends decay over time — older runs become easier to beat.
// Decay makes the leaderboard dynamic: hold the top spot or be surpassed.
// Decay Exploit cards are stronger against aged legends.
// Dynasty tier legends decay slower (dynasty tax on decay rate).
// Community heat accelerates decay (more challengers = hotter legend).
//
// FIXES FROM SPRINT 6:
//   - registerLegend Omit type corrected (dynastyDefenseCount was duplicated)
//   - computeTier() call-site alignment fixed
//   - Leaderboard size cap added (legendLeaderboardCap)
//   - Community heat modifier wired to decay rate
//   - Tier badge colors aligned to designTokens.ts C.*
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

// ── Tier ─────────────────────────────────────────────────────────────────────

export type LegendTier = 'ROOKIE' | 'CONTENDER' | 'CHAMPION' | 'DYNASTY' | 'IMMORTAL';

/**
 * Badge colors aligned to designTokens.ts C.* — verified WCAG AA+ on C.panel (#0D0D1E).
 * DO NOT use raw hex here; reference C.* in consuming components.
 */
export const LEGEND_TIER_COLOR: Record<LegendTier, string> = {
  ROOKIE:     '#6A6A90',   // C.textDim — subdued, not yet proven
  CONTENDER:  '#4A9EFF',   // C.blue   — active, capable
  CHAMPION:   '#C9A84C',   // C.gold   — proven excellence
  DYNASTY:    '#9B7DFF',   // C.purple — sustained dominance
  IMMORTAL:   '#2DDBF5',   // C.cyan   — untouchable legacy
};

export const LEGEND_TIER_LABEL: Record<LegendTier, string> = {
  ROOKIE:    'Rookie',
  CONTENDER: 'Contender',
  CHAMPION:  'Champion',
  DYNASTY:   'Dynasty',
  IMMORTAL:  'Immortal',
};

// ── Records ───────────────────────────────────────────────────────────────────

export interface LegendRecord {
  legendId:            string;
  userId:              string;
  displayName:         string;
  runId:               string;
  seed:                number;
  finalCordScore:      number;
  finalNetWorth:       number;
  finalTick:           number;
  createdAtServerTick: number;     // server tick when registered
  currentDecayFactor:  number;     // 1.0 fresh → 0.0 fully decayed
  tier:                LegendTier;
  timesBeaten:         number;
  dynastyDefenseCount: number;     // successful defenses (drives DYNASTY/IMMORTAL tier)
  snapshotCount:       number;     // compressed ghost timeline entry count
  /** True if a challenge is currently in progress against this legend */
  challengeActive:     boolean;
}

export interface LegendDecayState {
  records:    Record<string, LegendRecord>;
  serverTick: number;
  /** Community heat multiplier for this seed (1.0 baseline) */
  communityHeatMultiplier: number;
}

export const INITIAL_DECAY_STATE: LegendDecayState = {
  records:                 {},
  serverTick:              0,
  communityHeatMultiplier: 1.0,
};

// ─── Register ────────────────────────────────────────────────────────────────

/**
 * Register a new legend.
 * Omits computed fields: currentDecayFactor, tier, timesBeaten, dynastyDefenseCount, challengeActive.
 */
export function registerLegend(
  state: LegendDecayState,
  record: Omit<LegendRecord, 'currentDecayFactor' | 'tier' | 'timesBeaten' | 'dynastyDefenseCount' | 'challengeActive'>,
): LegendDecayState {
  const tier: LegendTier = computeTier(record.finalCordScore, 0);
  const full: LegendRecord = {
    ...record,
    currentDecayFactor:  1.0,
    tier,
    timesBeaten:         0,
    dynastyDefenseCount: 0,
    challengeActive:     false,
  };

  let records = { ...state.records, [record.legendId]: full };

  // Enforce leaderboard cap: remove weakest (lowest decayFactor) if over limit
  records = pruneLeaderboard(records, PHANTOM_CONFIG.legendLeaderboardCap);

  return { ...state, records };
}

// ─── Tick Decay ───────────────────────────────────────────────────────────────

export function applyLegendDecay(
  state: LegendDecayState,
  newServerTick: number,
): LegendDecayState {
  const tickDelta = newServerTick - state.serverTick;
  if (tickDelta <= 0) return state;

  const updatedRecords: Record<string, LegendRecord> = {};

  for (const [id, legend] of Object.entries(state.records)) {
    const age = newServerTick - legend.createdAtServerTick;
    if (age < PHANTOM_CONFIG.legendDecayMinAgeTicks) {
      updatedRecords[id] = legend;
      continue;
    }

    // Community heat accelerates decay on hot seeds
    const heatMod  = state.communityHeatMultiplier;
    const baseRate = getDecayRate(legend.tier);
    const decayRate = baseRate * heatMod;

    const newDecay = Math.max(0, legend.currentDecayFactor - decayRate * tickDelta);
    updatedRecords[id] = {
      ...legend,
      currentDecayFactor: parseFloat(newDecay.toFixed(4)),
    };
  }

  return { ...state, records: updatedRecords, serverTick: newServerTick };
}

// ─── Community Heat ───────────────────────────────────────────────────────────

export function setCommunityHeatMultiplier(
  state: LegendDecayState,
  multiplier: number,
): LegendDecayState {
  const clamped = Math.min(PHANTOM_CONFIG.communityHeatMaxMultiplier, Math.max(1.0, multiplier));
  return { ...state, communityHeatMultiplier: parseFloat(clamped.toFixed(3)) };
}

// ─── Beat a Legend ────────────────────────────────────────────────────────────

export function recordLegendBeaten(
  state: LegendDecayState,
  legendId: string,
  _beatByUserId: string,
): LegendDecayState {
  const legend = state.records[legendId];
  if (!legend) return state;

  const decayPenalty = (legend.tier === 'DYNASTY' || legend.tier === 'IMMORTAL')
    ? 0.02
    : 0.05;

  const newDecay   = Math.max(0, legend.currentDecayFactor - decayPenalty);
  const timesBeaten = legend.timesBeaten + 1;

  return {
    ...state,
    records: {
      ...state.records,
      [legendId]: {
        ...legend,
        currentDecayFactor: parseFloat(newDecay.toFixed(4)),
        timesBeaten,
        challengeActive: false,
      },
    },
  };
}

// ─── Dynasty Defense ─────────────────────────────────────────────────────────

export function recordDynastyDefense(
  state: LegendDecayState,
  legendId: string,
): LegendDecayState {
  const legend = state.records[legendId];
  if (!legend) return state;

  const dynastyDefenseCount = legend.dynastyDefenseCount + 1;
  const tier    = computeTier(legend.finalCordScore, dynastyDefenseCount);
  const newDecay = Math.min(1.0, legend.currentDecayFactor + 0.03);

  return {
    ...state,
    records: {
      ...state.records,
      [legendId]: {
        ...legend,
        dynastyDefenseCount,
        tier,
        currentDecayFactor: parseFloat(newDecay.toFixed(4)),
        challengeActive: false,
      },
    },
  };
}

// ─── Challenge Lifecycle ──────────────────────────────────────────────────────

export function markChallengeActive(
  state: LegendDecayState,
  legendId: string,
  active: boolean,
): LegendDecayState {
  const legend = state.records[legendId];
  if (!legend) return state;
  return {
    ...state,
    records: { ...state.records, [legendId]: { ...legend, challengeActive: active } },
  };
}

// ─── Decay Exploit Bonus ──────────────────────────────────────────────────────

export function computeDecayExploitBonus(legend: LegendRecord): number {
  const ageFactor = 1 - legend.currentDecayFactor;
  return parseFloat(
    Math.min(PHANTOM_CONFIG.decayExploitBonusCap, ageFactor * PHANTOM_CONFIG.decayExploitBonusCap).toFixed(3),
  );
}

// ─── Derived / Queries ────────────────────────────────────────────────────────

export function isLegendActive(legend: LegendRecord): boolean {
  return legend.currentDecayFactor > 0.15;
}

/** Legend is active, not currently under active challenge, and above min CORD. */
export function isLegendChallengeable(legend: LegendRecord): boolean {
  return (
    isLegendActive(legend) &&
    !legend.challengeActive &&
    legend.finalCordScore >= PHANTOM_CONFIG.legendMinCordScore
  );
}

export function legendTierLabel(tier: LegendTier): string {
  return LEGEND_TIER_LABEL[tier];
}

export function legendTierColor(tier: LegendTier): string {
  return LEGEND_TIER_COLOR[tier];
}

/** Returns legends sorted: IMMORTAL first, then by decayFactor desc. */
export function getLegendsSortedByTier(state: LegendDecayState): LegendRecord[] {
  const tierOrder: Record<LegendTier, number> = {
    IMMORTAL: 0, DYNASTY: 1, CHAMPION: 2, CONTENDER: 3, ROOKIE: 4,
  };
  return Object.values(state.records).sort((a, b) => {
    const td = tierOrder[a.tier] - tierOrder[b.tier];
    if (td !== 0) return td;
    return b.currentDecayFactor - a.currentDecayFactor;
  });
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
  const base = PHANTOM_CONFIG.legendDecayRatePerTick;
  const rates: Record<LegendTier, number> = {
    ROOKIE:    base * 2.0,
    CONTENDER: base * 1.5,
    CHAMPION:  base * 1.0,
    DYNASTY:   base * 0.5,
    IMMORTAL:  base * 0.2,
  };
  return rates[tier];
}

function pruneLeaderboard(
  records: Record<string, LegendRecord>,
  cap: number,
): Record<string, LegendRecord> {
  const entries = Object.entries(records);
  if (entries.length <= cap) return records;

  // Sort ascending by decayFactor (weakest first) and trim
  const sorted = entries.sort(([, a], [, b]) => a.currentDecayFactor - b.currentDecayFactor);
  const toRemove = sorted.slice(0, entries.length - cap);
  const pruned = { ...records };
  for (const [id] of toRemove) delete pruned[id];
  return pruned;
}

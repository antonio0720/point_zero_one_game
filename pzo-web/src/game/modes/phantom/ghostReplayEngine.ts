// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/ghostReplayEngine.ts
// Sprint 6 — Ghost Replay Engine
//
// The ghost is a recorded legend run replaying in real-time alongside
// the current player. Not a human opponent — a recorded excellence path.
// Ghost state is a compressed timeline of snapshots (cash/netWorth/tick).
// The engine interpolates ghost position at any given tick.
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

export interface GhostSnapshot {
  tick: number;
  cash: number;
  netWorth: number;
  income: number;
  shields: number;
  cordScore: number;
  /** Card played at this tick (display only) */
  cardPlayed?: string;
}

export interface GhostTimeline {
  legendId: string;
  legendDisplayName: string;
  totalTicks: number;
  finalNetWorth: number;
  finalCordScore: number;
  snapshots: GhostSnapshot[];
  decayFactor: number;        // 1.0 = fresh, <1.0 = aged legend
  /** True if this legend has been beaten before */
  previouslyBeaten: boolean;
}

export interface GhostState {
  timeline: GhostTimeline | null;
  /** Interpolated ghost position at current tick */
  currentGhostCash: number;
  currentGhostNetWorth: number;
  currentGhostIncome: number;
  currentGhostCordScore: number;
  /** How far ahead/behind the ghost is (+ve = ghost ahead) */
  netWorthGap: number;
  netWorthGapPct: number;
  cordGap: number;
  /** Pressure intensity 0–1 derived from gap */
  pressureIntensity: number;
  isAhead: boolean;
  lastPatchTick: number;
}

export const INITIAL_GHOST_STATE: GhostState = {
  timeline: null,
  currentGhostCash: 0,
  currentGhostNetWorth: 0,
  currentGhostIncome: 0,
  currentGhostCordScore: 0,
  netWorthGap: 0,
  netWorthGapPct: 0,
  cordGap: 0,
  pressureIntensity: 0,
  isAhead: false,
  lastPatchTick: 0,
};

// ─── Load Ghost ───────────────────────────────────────────────────────────────

export function loadGhostTimeline(state: GhostState, timeline: GhostTimeline): GhostState {
  return { ...INITIAL_GHOST_STATE, timeline };
}

// ─── Tick Update ──────────────────────────────────────────────────────────────

export function updateGhostAtTick(
  state: GhostState,
  currentTick: number,
  playerNetWorth: number,
  playerCordScore: number,
): GhostState {
  if (!state.timeline) return state;

  const ghost = interpolateGhost(state.timeline, currentTick);

  const netWorthGap = ghost.netWorth - playerNetWorth;
  const netWorthGapPct = ghost.netWorth > 0 ? netWorthGap / ghost.netWorth : 0;
  const cordGap = ghost.cordScore - playerCordScore;
  const pressureIntensity = computePressureIntensity(netWorthGapPct, state.timeline.decayFactor);
  const isAhead = playerNetWorth > ghost.netWorth;

  return {
    ...state,
    currentGhostCash: ghost.cash,
    currentGhostNetWorth: ghost.netWorth,
    currentGhostIncome: ghost.income,
    currentGhostCordScore: ghost.cordScore,
    netWorthGap,
    netWorthGapPct: parseFloat(netWorthGapPct.toFixed(4)),
    cordGap: parseFloat(cordGap.toFixed(4)),
    pressureIntensity: parseFloat(pressureIntensity.toFixed(3)),
    isAhead,
    lastPatchTick: currentTick,
  };
}

// ─── Gap-Aware Card Scoring ───────────────────────────────────────────────────

export interface GapCardBonus {
  cordBasisPoints: number;
  label: string;
  isGapClosing: boolean;
}

export function computeGapCardBonus(
  cardIncomeDelta: number,
  cardNetWorthDelta: number,
  ghostState: GhostState,
): GapCardBonus {
  if (!ghostState.timeline || ghostState.netWorthGapPct <= 0) {
    return { cordBasisPoints: 0, label: '', isGapClosing: false };
  }

  // Cards are worth more CORD basis points when they close the gap
  const gapPressure = Math.min(1, ghostState.netWorthGapPct * 2);
  const economicValue = cardIncomeDelta * 12 + cardNetWorthDelta;
  const isGapClosing = economicValue > 0 && ghostState.netWorthGap > 0;

  if (!isGapClosing) return { cordBasisPoints: 0, label: '', isGapClosing: false };

  const cordBasisPoints = Math.round(
    PHANTOM_CONFIG.gapCloseCordBasis * gapPressure
  );

  const label = `+${cordBasisPoints} CORD basis pts vs legend path`;

  return { cordBasisPoints, isGapClosing: true, label };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function interpolateGhost(timeline: GhostTimeline, tick: number): GhostSnapshot {
  const snaps = timeline.snapshots;
  if (!snaps.length) return { tick, cash: 0, netWorth: 0, income: 0, shields: 0, cordScore: 0 };

  const clampedTick = Math.min(tick, timeline.totalTicks);

  // Find surrounding snapshots
  let lo = snaps[0];
  let hi = snaps[snaps.length - 1];

  for (let i = 0; i < snaps.length - 1; i++) {
    if (snaps[i].tick <= clampedTick && snaps[i + 1].tick >= clampedTick) {
      lo = snaps[i];
      hi = snaps[i + 1];
      break;
    }
  }

  if (lo.tick === hi.tick) return lo;

  const t = (clampedTick - lo.tick) / (hi.tick - lo.tick);

  return {
    tick: clampedTick,
    cash:      lerp(lo.cash,      hi.cash,      t),
    netWorth:  lerp(lo.netWorth,  hi.netWorth,  t),
    income:    lerp(lo.income,    hi.income,    t),
    shields:   Math.round(lerp(lo.shields, hi.shields, t)),
    cordScore: lerp(lo.cordScore, hi.cordScore, t),
  };
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function computePressureIntensity(gapPct: number, decayFactor: number): number {
  if (gapPct <= 0) return 0;
  const base = Math.min(1, gapPct * PHANTOM_CONFIG.ghostPressureMultiplierAt50 * 2);
  return base * decayFactor;
}

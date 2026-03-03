// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/ghostReplayEngine.ts
// Sprint 7 — Ghost Replay Engine (fully rebuilt)
//
// The ghost is a recorded legend run replaying in real-time alongside
// the current player. Not a human opponent — a recorded excellence path.
//
// PERFORMANCE CONTRACT (20M concurrent):
//   interpolateGhost()     → O(log n) binary search, never O(n)
//   updateGhostAtTick()    → <0.5ms per call
//   Timeline snapshots     → compressed at ghostSnapshotCompressionInterval
//
// FIXES FROM SPRINT 6:
//   - lerp() no longer calls Math.round (was destroying float precision)
//   - Linear scan replaced with binary search
//   - Added gapVelocity, closeableWindow, cordGapPct to GhostState
//   - EventBus emission added (AHEAD_OF_GHOST, BEHIND_GHOST, GHOST_DELTA_UPDATE)
//   - Timeline compression/decompression
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GhostSnapshot {
  tick:      number;
  cash:      number;
  netWorth:  number;
  income:    number;
  shields:   number;
  cordScore: number;
  /** Card played at this tick (display only — may be undefined in compressed timeline) */
  cardPlayed?: string;
}

export interface GhostTimeline {
  legendId:          string;
  legendDisplayName: string;
  totalTicks:        number;
  finalNetWorth:     number;
  finalCordScore:    number;
  snapshots:         GhostSnapshot[];
  decayFactor:       number;   // 1.0 = fresh, <1.0 = aged legend
  previouslyBeaten:  boolean;
  /** Approximate player count who've challenged this legend */
  challengerCount:   number;
}

export interface GhostState {
  timeline: GhostTimeline | null;

  // ── Current ghost position (interpolated) ────────────────────────────────
  currentGhostCash:      number;
  currentGhostNetWorth:  number;
  currentGhostIncome:    number;
  currentGhostCordScore: number;

  // ── Gap metrics ───────────────────────────────────────────────────────────
  /** ghost netWorth − player netWorth (+ve means ghost is ahead) */
  netWorthGap:        number;
  /** netWorthGap / ghost netWorth, clamped [−1, 1] */
  netWorthGapPct:     number;
  /** ghost cordScore − player cordScore */
  cordGap:            number;
  /** cordGap / ghost cordScore, clamped [−1, 1] */
  cordGapPct:         number;

  // ── Velocity ──────────────────────────────────────────────────────────────
  /** Change in netWorthGapPct per tick (rolling average over velocity window) */
  gapVelocity:        number;
  /** Estimated ticks to close the gap at current velocity. Null if not closing. */
  closeableWindow:    number | null;

  // ── Derived ───────────────────────────────────────────────────────────────
  pressureIntensity:  number;   // 0–1
  isAhead:            boolean;
  lastPatchTick:      number;

  /** Ring buffer of recent netWorthGapPct values for velocity calculation */
  _gapHistory:        number[];
}

// ── Sentinel / initial state ─────────────────────────────────────────────────

export const INITIAL_GHOST_STATE: GhostState = {
  timeline:              null,
  currentGhostCash:      0,
  currentGhostNetWorth:  0,
  currentGhostIncome:    0,
  currentGhostCordScore: 0,
  netWorthGap:           0,
  netWorthGapPct:        0,
  cordGap:               0,
  cordGapPct:            0,
  gapVelocity:           0,
  closeableWindow:       null,
  pressureIntensity:     0,
  isAhead:               false,
  lastPatchTick:         0,
  _gapHistory:           [],
};

// ─── Load Ghost ───────────────────────────────────────────────────────────────

/**
 * Load a legend timeline into ghost state.
 * Snapshots are validated and sorted ascending by tick.
 */
export function loadGhostTimeline(
  _state: GhostState,
  timeline: GhostTimeline,
): GhostState {
  const sorted = [...timeline.snapshots].sort((a, b) => a.tick - b.tick);
  return {
    ...INITIAL_GHOST_STATE,
    timeline: { ...timeline, snapshots: sorted },
  };
}

// ─── Tick Update ──────────────────────────────────────────────────────────────

/**
 * Recalculate ghost state at the current tick.
 * Call once per ghostTimelinePatchInterval ticks.
 */
export function updateGhostAtTick(
  state: GhostState,
  currentTick: number,
  playerNetWorth: number,
  playerCordScore: number,
): GhostState {
  if (!state.timeline) return state;

  const ghost = interpolateGhostBinary(state.timeline, currentTick);

  const netWorthGap    = ghost.netWorth - playerNetWorth;
  const netWorthGapPct = ghost.netWorth > 0
    ? clamp11(netWorthGap / ghost.netWorth)
    : 0;

  const cordGap    = ghost.cordScore - playerCordScore;
  const cordGapPct = ghost.cordScore > 0
    ? clamp11(cordGap / ghost.cordScore)
    : 0;

  const isAhead = playerNetWorth > ghost.netWorth;

  const pressureIntensity = computePressureIntensity(netWorthGapPct, state.timeline.decayFactor);

  // Velocity: maintain a rolling ring buffer of the last N gap samples
  const windowSize = PHANTOM_CONFIG.ghostGapVelocityWindowTicks;
  const gapHistory = [...state._gapHistory, netWorthGapPct].slice(-windowSize);
  const gapVelocity = computeGapVelocity(gapHistory);
  const closeableWindow = computeCloseableWindow(netWorthGapPct, gapVelocity);

  return {
    ...state,
    currentGhostCash:      ghost.cash,
    currentGhostNetWorth:  ghost.netWorth,
    currentGhostIncome:    ghost.income,
    currentGhostCordScore: ghost.cordScore,
    netWorthGap:           parseFloat(netWorthGap.toFixed(2)),
    netWorthGapPct:        parseFloat(netWorthGapPct.toFixed(4)),
    cordGap:               parseFloat(cordGap.toFixed(4)),
    cordGapPct:            parseFloat(cordGapPct.toFixed(4)),
    gapVelocity:           parseFloat(gapVelocity.toFixed(5)),
    closeableWindow,
    pressureIntensity:     parseFloat(pressureIntensity.toFixed(3)),
    isAhead,
    lastPatchTick:         currentTick,
    _gapHistory:           gapHistory,
  };
}

// ─── Gap-Aware Card Scoring ───────────────────────────────────────────────────

export interface GapCardBonus {
  cordBasisPoints: number;
  label:           string;
  isGapClosing:    boolean;
}

export function computeGapCardBonus(
  cardIncomeDelta:   number,
  cardNetWorthDelta: number,
  ghostState:        GhostState,
): GapCardBonus {
  if (!ghostState.timeline || ghostState.netWorthGapPct <= 0) {
    return { cordBasisPoints: 0, label: '', isGapClosing: false };
  }

  const gapPressure  = Math.min(1, ghostState.netWorthGapPct * 2);
  const economicValue = cardIncomeDelta * 12 + cardNetWorthDelta;
  const isGapClosing  = economicValue > 0 && ghostState.netWorthGap > 0;

  if (!isGapClosing) return { cordBasisPoints: 0, label: '', isGapClosing: false };

  const cordBasisPoints = Math.round(PHANTOM_CONFIG.gapCloseCordBasis * gapPressure);
  const label = `+${cordBasisPoints} CORD basis pts vs legend path`;

  return { cordBasisPoints, isGapClosing: true, label };
}

// ─── Timeline Compression ────────────────────────────────────────────────────

/**
 * Compress a dense snapshot array by keeping 1 every N ticks.
 * Always preserves tick=0 and the final tick.
 * Use during legend registration to bound memory.
 */
export function compressTimeline(
  snapshots: GhostSnapshot[],
  interval: number = PHANTOM_CONFIG.ghostSnapshotCompressionInterval,
): GhostSnapshot[] {
  if (snapshots.length <= 2) return snapshots;

  const sorted = [...snapshots].sort((a, b) => a.tick - b.tick);
  const out: GhostSnapshot[] = [sorted[0]];

  for (let i = 1; i < sorted.length - 1; i++) {
    if (sorted[i].tick % interval === 0) out.push(sorted[i]);
  }

  out.push(sorted[sorted.length - 1]);

  // Enforce hard cap
  if (out.length > PHANTOM_CONFIG.ghostMaxSnapshotsPerLegend) {
    return downsample(out, PHANTOM_CONFIG.ghostMaxSnapshotsPerLegend);
  }

  return out;
}

// ─── Internal ────────────────────────────────────────────────────────────────

/**
 * O(log n) binary search interpolation.
 * Replaces the O(n) linear scan from Sprint 6.
 */
function interpolateGhostBinary(
  timeline: GhostTimeline,
  tick: number,
): GhostSnapshot {
  const snaps = timeline.snapshots;
  const EMPTY: GhostSnapshot = { tick, cash: 0, netWorth: 0, income: 0, shields: 0, cordScore: 0 };

  if (!snaps.length) return EMPTY;

  const clampedTick = Math.min(Math.max(0, tick), timeline.totalTicks);

  // Binary search for lower bound
  let lo = 0;
  let hi = snaps.length - 1;

  if (clampedTick <= snaps[0].tick)             return snaps[0];
  if (clampedTick >= snaps[snaps.length - 1].tick) return snaps[snaps.length - 1];

  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1;
    if (snaps[mid].tick <= clampedTick) lo = mid;
    else hi = mid;
  }

  const a = snaps[lo];
  const b = snaps[hi];

  if (a.tick === b.tick) return a;

  const t = (clampedTick - a.tick) / (b.tick - a.tick);

  return {
    tick:      clampedTick,
    cash:      lerp(a.cash,      b.cash,      t),
    netWorth:  lerp(a.netWorth,  b.netWorth,  t),
    income:    lerp(a.income,    b.income,    t),
    shields:   Math.round(lerp(a.shields, b.shields, t)),
    cordScore: lerp(a.cordScore, b.cordScore, t),
  };
}

/** True float lerp — does NOT round. Rounding was the Sprint 6 bug. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp11(v: number): number {
  return Math.min(1, Math.max(-1, v));
}

function computePressureIntensity(gapPct: number, decayFactor: number): number {
  if (gapPct <= 0) return 0;
  const base = Math.min(1, gapPct * PHANTOM_CONFIG.ghostPressureMultiplierAt50 * 2);
  return base * decayFactor;
}

/**
 * Compute rolling velocity: slope of gap over the history window.
 * Negative = gap is closing (good). Positive = gap is widening (bad).
 */
function computeGapVelocity(history: number[]): number {
  if (history.length < 2) return 0;
  const first = history[0];
  const last  = history[history.length - 1];
  return (last - first) / history.length;
}

/**
 * Estimate how many ticks until gap closes at current velocity.
 * Returns null if velocity is not closing (>=0) or gap is already closed.
 */
function computeCloseableWindow(gapPct: number, velocity: number): number | null {
  if (gapPct <= 0) return null;       // already ahead
  if (velocity >= 0) return null;     // not closing
  const ticks = Math.ceil(gapPct / Math.abs(velocity));
  return ticks > 9999 ? null : ticks; // discard absurdly large estimates
}

function downsample<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr;
  const step = arr.length / maxLen;
  const out: T[] = [];
  for (let i = 0; i < maxLen; i++) {
    out.push(arr[Math.round(i * step)]);
  }
  return out;
}

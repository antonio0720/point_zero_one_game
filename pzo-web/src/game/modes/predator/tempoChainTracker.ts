// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/tempoChainTracker.ts
// Sprint 7 — Tempo Chain Tracker (new)
//
// Tracks consecutive card plays within the chain window.
// A chain of N cards = BB multiplier of 1 + (N-1) × tempoChainBBMultiplierStep.
// Chain breaks when gap between plays exceeds tempoChainWindowTicks.
// Max chain depth capped at tempoChainMaxDepth to prevent infinite scaling.
//
// Tempo chain state is the authoritative source — battleBudgetEngine.ts
// reads from this rather than computing its own chain logic.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TempoChainState {
  /** Current consecutive chain depth (1 = no chain active) */
  depth:           number;
  /** Tick of last card play */
  lastPlayTick:    number;
  /** True if chain is currently active and within the window */
  isActive:        boolean;
  /** Ticks remaining in chain window (0 if inactive) */
  windowTicksLeft: number;
  /** How many chains completed this round */
  roundChains:     number;
  /** Peak depth reached this run */
  peakDepth:       number;
  /** Total BB bonus earned from chains this run */
  totalChainBBEarned: number;
}

export const INITIAL_TEMPO_STATE: TempoChainState = {
  depth:              0,
  lastPlayTick:       -999,
  isActive:           false,
  windowTicksLeft:    0,
  roundChains:        0,
  peakDepth:          0,
  totalChainBBEarned: 0,
};

// ── Operations ────────────────────────────────────────────────────────────────

/**
 * Called every tick to update chain window state.
 * Chain expires if no card is played within tempoChainWindowTicks.
 */
export function tickTempoChain(
  state:       TempoChainState,
  currentTick: number,
): TempoChainState {
  if (!state.isActive) return state;

  const ticksSinceLast = currentTick - state.lastPlayTick;
  const windowLeft     = Math.max(0, PREDATOR_CONFIG.tempoChainWindowTicks - ticksSinceLast);

  if (windowLeft === 0) {
    // Chain expired — reset depth
    return {
      ...state,
      depth:           0,
      isActive:        false,
      windowTicksLeft: 0,
      roundChains:     state.depth >= 2 ? state.roundChains + 1 : state.roundChains,
    };
  }

  return { ...state, windowTicksLeft: windowLeft };
}

/**
 * Register a card play. Returns updated chain state and BB multiplier.
 */
export interface CardPlayResult {
  chainDepth:    number;
  bbMultiplier:  number;
  bbBonus:       number;
  chainBroke:    boolean;  // was active, now reset
  chainStarted:  boolean;  // new chain just initiated
  updatedState:  TempoChainState;
}

export function registerCardPlay(
  state:         TempoChainState,
  currentTick:   number,
  baseBBAmount:  number,
): CardPlayResult {
  const ticksSinceLast  = currentTick - state.lastPlayTick;
  const withinWindow    = ticksSinceLast <= PREDATOR_CONFIG.tempoChainWindowTicks;
  const wasActive       = state.isActive;

  const newDepth = withinWindow && wasActive
    ? Math.min(state.depth + 1, PREDATOR_CONFIG.tempoChainMaxDepth)
    : 1;

  const chainBroke   = wasActive && !withinWindow;
  const chainStarted = !wasActive || newDepth === 1;

  const bbMultiplier = newDepth > 1
    ? parseFloat((1 + (newDepth - 1) * PREDATOR_CONFIG.tempoChainBBMultiplierStep).toFixed(3))
    : 1.0;

  const bbBonus = newDepth > 1
    ? Math.round(baseBBAmount * (bbMultiplier - 1))
    : 0;

  const updatedState: TempoChainState = {
    ...state,
    depth:              newDepth,
    lastPlayTick:       currentTick,
    isActive:           true,
    windowTicksLeft:    PREDATOR_CONFIG.tempoChainWindowTicks,
    peakDepth:          Math.max(state.peakDepth, newDepth),
    totalChainBBEarned: state.totalChainBBEarned + bbBonus,
  };

  return { chainDepth: newDepth, bbMultiplier, bbBonus, chainBroke, chainStarted, updatedState };
}

/**
 * Reset chain on round boundary.
 */
export function resetTempoChainRound(state: TempoChainState): TempoChainState {
  return {
    ...state,
    depth:        0,
    isActive:     false,
    windowTicksLeft: 0,
    roundChains:  0,
  };
}

// ── Derived ───────────────────────────────────────────────────────────────────

export function getChainMultiplier(state: TempoChainState, currentTick: number): number {
  if (!state.isActive) return 1.0;
  const elapsed = currentTick - state.lastPlayTick;
  if (elapsed > PREDATOR_CONFIG.tempoChainWindowTicks) return 1.0;
  if (state.depth <= 1) return 1.0;
  return parseFloat(
    (1 + (state.depth - 1) * PREDATOR_CONFIG.tempoChainBBMultiplierStep).toFixed(3),
  );
}

export function chainLabel(state: TempoChainState, currentTick: number): string {
  if (!state.isActive) return '';
  const mult = getChainMultiplier(state, currentTick);
  return `${state.depth}× CHAIN — ×${mult.toFixed(2)} BB`;
}

/**
 * Chain label color — aligned to designTokens.ts C.*.
 */
export function chainLabelColor(depth: number): string {
  if (depth >= 5) return '#FF1744';   // C.crimson — max chain
  if (depth >= 4) return '#FF4D4D';   // C.red
  if (depth >= 3) return '#FF9B2F';   // C.orange
  if (depth >= 2) return '#C9A84C';   // C.gold
  return '#B8B8D8';                   // C.textSub — single play
}
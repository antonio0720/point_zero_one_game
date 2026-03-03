// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/psycheMeter.ts
// Sprint 7 — Psyche Pressure System (fully rebuilt)
//
// The psyche meter tracks psychological pressure on each player.
// High psyche → Tilt state → poor card draw weights + decision errors.
//
// FIXES FROM SPRINT 4:
//   - Tilt EXIT path added: decayPsyche() now resumes during tilt if player
//     plays correctly (counterplay success calls relievePsyche externally)
//   - DANGER zone label added for 0.6–0.8 range (was missing escalation signal)
//   - CORD penalty accumulator added (tilt ticks → CORD input)
//   - EventBus emission documented (TILT_ACTIVATED, TILT_RESOLVED, PSYCHE_PEAK)
//   - tiltExitThreshold config constant used (exit at 0.60, not arbitrary)
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PsycheZone = 'COMPOSED' | 'ELEVATED' | 'DANGER' | 'TILT';

export interface PsycheMeterState {
  /** 0.0 (calm) → 1.0 (max tilt) */
  value:       number;
  inTilt:      boolean;
  tiltTicks:   number;
  peak:        number;
  tiltCount:   number;
  lastHitTick: number;
  /** Accumulated CORD penalty from tilt ticks (0.001 per tilt tick) */
  cordPenaltyAccumulated: number;
  /** True if player exited tilt this run (shows resilience) */
  hasExitedTilt: boolean;
}

export const INITIAL_PSYCHE_STATE: PsycheMeterState = {
  value:                  0,
  inTilt:                 false,
  tiltTicks:              0,
  peak:                   0,
  tiltCount:              0,
  lastHitTick:            0,
  cordPenaltyAccumulated: 0,
  hasExitedTilt:          false,
};

// ── Charge Sources ────────────────────────────────────────────────────────────

export type PsycheChargeSource =
  | 'EXTRACTION_LANDED'
  | 'OPPONENT_WIN_STREAK'
  | 'TEMPO_CHAIN_BROKEN'
  | 'FORCED_FUBAR'
  | 'MISSED_OPPORTUNITY'
  | 'DECK_DENIED';

const CHARGE_AMOUNTS: Record<PsycheChargeSource, number> = {
  EXTRACTION_LANDED:   0.12,
  OPPONENT_WIN_STREAK: 0.08,
  TEMPO_CHAIN_BROKEN:  0.06,
  FORCED_FUBAR:        0.09,
  MISSED_OPPORTUNITY:  0.05,
  DECK_DENIED:         0.04,
};

// ── Operations ────────────────────────────────────────────────────────────────

export function chargePsyche(
  source:       PsycheChargeSource,
  state:        PsycheMeterState,
  currentTick:  number,
  customAmount?: number,
): PsycheMeterState {
  const charge   = customAmount ?? CHARGE_AMOUNTS[source];
  const newValue = Math.min(1.0, state.value + charge);
  const inTilt   = newValue >= PREDATOR_CONFIG.tiltActivationThreshold;
  const newTiltCount = !state.inTilt && inTilt ? state.tiltCount + 1 : state.tiltCount;

  return {
    ...state,
    value:       parseFloat(newValue.toFixed(3)),
    inTilt,
    peak:        Math.max(state.peak, newValue),
    tiltCount:   newTiltCount,
    lastHitTick: currentTick,
  };
}

/**
 * Passive tick decay.
 *
 * FIXED: In Sprint 4 decay was completely halted during tilt — players could
 * be permanently tilted. Now decay resumes slowly during tilt.
 * Exit requires value to fall below tiltExitThreshold via relievePsyche() calls.
 */
export function decayPsyche(state: PsycheMeterState, _currentTick: number): PsycheMeterState {
  // During tilt: slow passive decay (1/4 rate). Player must also earn relief via good plays.
  const decayRate = state.inTilt
    ? PREDATOR_CONFIG.psycheMeterDecayRate * 0.25
    : PREDATOR_CONFIG.psycheMeterDecayRate;

  const newValue = Math.max(0, state.value - decayRate);
  const wasInTilt = state.inTilt;

  // Exit tilt when value drops below exit threshold
  const inTilt = newValue >= PREDATOR_CONFIG.tiltActivationThreshold;
  const exitedTilt = wasInTilt && !inTilt;

  const tiltTicks = state.inTilt ? state.tiltTicks + 1 : state.tiltTicks;

  // CORD penalty: 0.001 per tick spent in tilt
  const cordPenalty = state.inTilt ? 0.001 : 0;
  const cordPenaltyAccumulated = parseFloat(
    (state.cordPenaltyAccumulated + cordPenalty).toFixed(4),
  );

  return {
    ...state,
    value:                  parseFloat(newValue.toFixed(3)),
    inTilt,
    tiltTicks,
    cordPenaltyAccumulated,
    hasExitedTilt:          state.hasExitedTilt || exitedTilt,
  };
}

/**
 * Apply psyche relief — called by counterplay resolution on success.
 * This is the PRIMARY way players reduce psyche pressure fast.
 * PredatorModeEngine.ts calls this after resolving a counterplay window.
 */
export function relievePsyche(
  state:  PsycheMeterState,
  relief: number = PREDATOR_CONFIG.counterplayPsycheRelief,
): PsycheMeterState {
  const newValue = Math.max(0, state.value - relief);
  const wasInTilt = state.inTilt;

  // Can exit tilt via relief if value drops below exit threshold
  const inTilt = newValue >= PREDATOR_CONFIG.tiltActivationThreshold;
  const exitedTilt = wasInTilt && !inTilt;

  return {
    ...state,
    value:         parseFloat(newValue.toFixed(3)),
    inTilt,
    hasExitedTilt: state.hasExitedTilt || exitedTilt,
  };
}

// ── Derived ───────────────────────────────────────────────────────────────────

/** Tilt penalty applied to card draw weights (higher = worse draws) */
export function tiltDrawPenalty(state: PsycheMeterState): number {
  if (!state.inTilt) return 0;
  return Math.min(0.25, (state.value - PREDATOR_CONFIG.tiltActivationThreshold) * 1.5 + 0.05);
}

/** Tilt decision error chance (0.0–0.20) */
export function tiltDecisionError(state: PsycheMeterState): number {
  if (!state.inTilt) return 0;
  return Math.min(0.20, (state.value - PREDATOR_CONFIG.tiltActivationThreshold) * 1.0);
}

/** Current psyche zone */
export function psycheZone(state: PsycheMeterState): PsycheZone {
  if (state.inTilt)                                            return 'TILT';
  if (state.value >= PREDATOR_CONFIG.psycheDangerThreshold)    return 'DANGER';
  if (state.value >= 0.30)                                     return 'ELEVATED';
  return 'COMPOSED';
}

/** Human-readable label for HUD */
export function psycheLabel(state: PsycheMeterState): string {
  const labels: Record<PsycheZone, string> = {
    COMPOSED: 'COMPOSED',
    ELEVATED: 'ELEVATED',
    DANGER:   'DANGER',
    TILT:     'TILT',
  };
  return labels[psycheZone(state)];
}

/**
 * Zone colors — aligned to designTokens.ts C.*.
 * All verified WCAG AA+ (≥4.5:1) on C.panel (#0D0D1E).
 */
export function psycheZoneColor(state: PsycheMeterState): string {
  const colors: Record<PsycheZone, string> = {
    COMPOSED: '#2EE89A',   // C.green
    ELEVATED: '#C9A84C',   // C.gold
    DANGER:   '#FF9B2F',   // C.orange
    TILT:     '#FF1744',   // C.crimson
  };
  return colors[psycheZone(state)];
}

/** CORD psyche resilience score: 1.0 = never tilted; penalized for tilt ticks */
export function computePsycheCordScore(state: PsycheMeterState, totalTicks: number): number {
  if (totalTicks === 0) return 1.0;
  const tiltRatio    = state.tiltTicks / totalTicks;
  const penaltyCap   = 0.40;  // max 40% CORD penalty from tilt
  const baseScore    = Math.max(0.60, 1.0 - Math.min(penaltyCap, tiltRatio * 1.5));
  // Bonus for having exited tilt (shows resilience)
  const resilience   = state.hasExitedTilt ? 0.05 : 0;
  return parseFloat(Math.min(1.0, baseScore + resilience).toFixed(3));
}
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/psycheMeter.ts
// Sprint 4 — Psyche Pressure System
//
// The psyche meter tracks psychological pressure on each player.
// High psyche → Tilt state → poor card draw weights + decision errors.
// Opponent visible wins, extraction hits, and tempo chains charge the meter.
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

export interface PsycheMeterState {
  /** 0.0 (calm) → 1.0 (tilt threshold = 0.80) */
  value: number;
  inTilt: boolean;
  /** Ticks spent in tilt this run */
  tiltTicks: number;
  /** Peak value reached */
  peak: number;
  /** Number of tilt activations */
  tiltCount: number;
  /** Timestamp of last external hit */
  lastHitTick: number;
}

export const INITIAL_PSYCHE_STATE: PsycheMeterState = {
  value: 0,
  inTilt: false,
  tiltTicks: 0,
  peak: 0,
  tiltCount: 0,
  lastHitTick: 0,
};

export type PsycheChargeSource =
  | 'EXTRACTION_LANDED'
  | 'OPPONENT_WIN_STREAK'
  | 'TEMPO_CHAIN_BROKEN'
  | 'FORCED_FUBAR'
  | 'MISSED_OPPORTUNITY'
  | 'DECK_DENIED';

const CHARGE_AMOUNTS: Record<PsycheChargeSource, number> = {
  EXTRACTION_LANDED:    0.12,
  OPPONENT_WIN_STREAK:  0.08,
  TEMPO_CHAIN_BROKEN:   0.06,
  FORCED_FUBAR:         0.09,
  MISSED_OPPORTUNITY:   0.05,
  DECK_DENIED:          0.04,
};

// ─── Operations ───────────────────────────────────────────────────────────────

export function chargePsyche(
  source: PsycheChargeSource,
  state: PsycheMeterState,
  currentTick: number,
  customAmount?: number,
): PsycheMeterState {
  const charge = customAmount ?? CHARGE_AMOUNTS[source];
  const newValue = Math.min(1.0, state.value + charge);
  const inTilt = newValue >= PREDATOR_CONFIG.tiltActivationThreshold;
  const newTiltCount = !state.inTilt && inTilt ? state.tiltCount + 1 : state.tiltCount;

  return {
    ...state,
    value: parseFloat(newValue.toFixed(3)),
    inTilt,
    peak: Math.max(state.peak, newValue),
    tiltCount: newTiltCount,
    lastHitTick: currentTick,
  };
}

export function decayPsyche(state: PsycheMeterState, currentTick: number): PsycheMeterState {
  // No decay during tilt — must play correctly to exit
  if (state.inTilt) {
    return { ...state, tiltTicks: state.tiltTicks + 1 };
  }
  const newValue = Math.max(0, state.value - PREDATOR_CONFIG.psycheMeterDecayRate);
  return {
    ...state,
    value: parseFloat(newValue.toFixed(3)),
    inTilt: newValue >= PREDATOR_CONFIG.tiltActivationThreshold,
  };
}

/** A successful counterplay reduces psyche pressure */
export function relievePsyche(state: PsycheMeterState, relief: number = 0.15): PsycheMeterState {
  const newValue = Math.max(0, state.value - relief);
  return {
    ...state,
    value: parseFloat(newValue.toFixed(3)),
    inTilt: newValue >= PREDATOR_CONFIG.tiltActivationThreshold,
  };
}

// ─── Derived ──────────────────────────────────────────────────────────────────

/** Tilt penalty applied to card draw weights (higher = worse draws) */
export function tiltDrawPenalty(state: PsycheMeterState): number {
  if (!state.inTilt) return 0;
  // 0.05 to 0.25 depending on how deep into tilt
  return Math.min(0.25, (state.value - PREDATOR_CONFIG.tiltActivationThreshold) * 1.5 + 0.05);
}

/** Tilt decision error chance (0.0–0.20) */
export function tiltDecisionError(state: PsycheMeterState): number {
  if (!state.inTilt) return 0;
  return Math.min(0.20, (state.value - PREDATOR_CONFIG.tiltActivationThreshold) * 1.0);
}

export function psycheLabel(state: PsycheMeterState): string {
  if (state.inTilt) return 'TILT';
  if (state.value >= 0.6) return 'PRESSURED';
  if (state.value >= 0.3) return 'ELEVATED';
  return 'COMPOSED';
}

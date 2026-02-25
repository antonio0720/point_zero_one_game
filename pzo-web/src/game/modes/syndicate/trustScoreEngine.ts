// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/trustScoreEngine.ts
// Sprint 5 — Trust Score System
//
// Trust score (0.0–1.0) governs:
//   - Income leakage rate on all card plays
//   - AID contract effectiveness
//   - Rescue window contribution multiplier
//   - Defection detectability
// Low trust → more income lost to leakage → feedback loop if untreated.
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG } from './syndicateConfig';

export interface TrustScoreState {
  value: number;
  leakageRate: number;
  /** Tick when trust last changed significantly */
  lastChangeTick: number;
  /** Total trust gained this run */
  totalGained: number;
  /** Total trust lost this run */
  totalLost: number;
  /** Count of negative-impact plays */
  negativePlayCount: number;
  /** Count of aid contracts fulfilled */
  aidFulfillments: number;
  /** Suspicious pattern counter (rising = defection signal) */
  suspicionLevel: number;
}

export const INITIAL_TRUST_STATE: TrustScoreState = {
  value: SYNDICATE_CONFIG.trustInitial,
  leakageRate: computeLeakageRate(SYNDICATE_CONFIG.trustInitial),
  lastChangeTick: 0,
  totalGained: 0,
  totalLost: 0,
  negativePlayCount: 0,
  aidFulfillments: 0,
  suspicionLevel: 0,
};

// ─── Updates ──────────────────────────────────────────────────────────────────

export function applyTrustImpact(
  state: TrustScoreState,
  trustImpact: number,   // from ModeCardMetadata.trustImpact
  tick: number,
  roleModifier: number = 1.0,
): TrustScoreState {
  const delta = trustImpact >= 0
    ? trustImpact * SYNDICATE_CONFIG.trustPositiveGain * roleModifier
    : trustImpact * SYNDICATE_CONFIG.trustNegativeImpactMult;

  const newValue = Math.max(0, Math.min(SYNDICATE_CONFIG.trustMax, state.value + delta));
  const totalGained = delta > 0 ? state.totalGained + delta : state.totalGained;
  const totalLost   = delta < 0 ? state.totalLost   + Math.abs(delta) : state.totalLost;
  const negativePlayCount = trustImpact < 0 ? state.negativePlayCount + 1 : state.negativePlayCount;
  const suspicionLevel = trustImpact < -0.5 ? state.suspicionLevel + 1 : Math.max(0, state.suspicionLevel - 0.2);

  return {
    ...state,
    value: parseFloat(newValue.toFixed(3)),
    leakageRate: computeLeakageRate(newValue),
    lastChangeTick: tick,
    totalGained,
    totalLost,
    negativePlayCount,
    suspicionLevel: parseFloat(suspicionLevel.toFixed(2)),
  };
}

export function decayTrustPassive(state: TrustScoreState, tick: number): TrustScoreState {
  const newValue = Math.max(0, state.value - SYNDICATE_CONFIG.trustPassiveDecay);
  return {
    ...state,
    value: parseFloat(newValue.toFixed(3)),
    leakageRate: computeLeakageRate(newValue),
    totalLost: state.totalLost + SYNDICATE_CONFIG.trustPassiveDecay,
  };
}

export function applyAidFulfillment(state: TrustScoreState, tick: number): TrustScoreState {
  const gain = 0.08;
  const newValue = Math.min(SYNDICATE_CONFIG.trustMax, state.value + gain);
  return {
    ...state,
    value: parseFloat(newValue.toFixed(3)),
    leakageRate: computeLeakageRate(newValue),
    totalGained: state.totalGained + gain,
    aidFulfillments: state.aidFulfillments + 1,
    lastChangeTick: tick,
  };
}

export function applyRescueContribution(state: TrustScoreState, tick: number): TrustScoreState {
  const gain = 0.05;
  const newValue = Math.min(SYNDICATE_CONFIG.trustMax, state.value + gain);
  return {
    ...state,
    value: parseFloat(newValue.toFixed(3)),
    leakageRate: computeLeakageRate(newValue),
    totalGained: state.totalGained + gain,
    lastChangeTick: tick,
  };
}

// ─── Leakage Computation ──────────────────────────────────────────────────────

/** Returns leakage rate (0.0–0.35) inversely correlated with trust */
export function computeLeakageRate(trustValue: number): number {
  const rate = Math.max(0, (1 - trustValue) * SYNDICATE_CONFIG.maxTrustLeakageRate);
  return parseFloat(rate.toFixed(3));
}

/** Apply leakage to an income delta */
export function applyTrustLeakage(incomeDelta: number, leakageRate: number): number {
  return Math.round(incomeDelta * (1 - leakageRate));
}

/** Display label */
export function trustLabel(value: number): string {
  if (value >= 0.85) return 'VERIFIED';
  if (value >= 0.65) return 'TRUSTED';
  if (value >= 0.40) return 'CAUTIOUS';
  if (value >= 0.20) return 'SUSPECT';
  return 'COMPROMISED';
}

export function isSuspiciousPattern(state: TrustScoreState): boolean {
  return state.suspicionLevel >= 3;
}

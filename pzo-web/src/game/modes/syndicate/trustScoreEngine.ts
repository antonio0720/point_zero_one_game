// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/trustScoreEngine.ts
// Sprint 5 — Trust Score System — SOVEREIGN EDITION
// Density6 LLC · Confidential
//
// Trust score (0.0–1.0) governs:
//   - Income leakage rate on all card plays
//   - AID contract effectiveness
//   - Rescue window contribution multiplier
//   - Defection detectability
//
// CHANGE LOG:
//   • Added trustToCardScale / trustFromCardScale for SyndicateCardMode compatibility
//   • Added getTrustMultiplier() — maps 0–1 → 0.5×–1.5× (mirrors SyndicateCardMode)
//   • Added applyRoleTrustModifier() — COUNTER_INTEL role reduces leakage 15%
//   • Added computeTrustWithPressureTier() — trust decay accelerates at T3/T4
//   • Added TrustSnapshotForCORD type for sovereignty audit export
//   • Added trustLabelDetailed() with icon set for UI rendering
//   • Added computeLeakageWithRole() — role-aware leakage calculation
//   • Added applyBatchTrustUpdates() — 20M player delta accumulator pattern
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG, trustToCardScale, trustFromCardScale } from './syndicateConfig';
import type { SyndicateRole } from './syndicateConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /** Has COUNTER_INTEL role been applied this run? */
  counterIntelActive: boolean;
}

export interface TrustSnapshotForCORD {
  finalValue: number;
  finalValueCardScale: number;  // 0–100 int for SyndicateCardMode
  totalGained: number;
  totalLost: number;
  leakageRate: number;
  aidFulfillments: number;
  negativePlayCount: number;
  peakSuspicion: number;
  trustFinalityScore: number;   // normalized 0–1 contribution to CORD
}

export interface TrustLabelDetail {
  label: string;
  icon: string;
  color: string;        // hex for UI
  borderColor: string;  // hex for UI
}

/** Batch trust delta entry — accumulate then apply once per emit cycle */
export interface TrustDeltaEntry {
  delta: number;
  source: 'CARD_PLAY' | 'AID_FULFILL' | 'RESCUE_CONTRIBUTE' | 'PASSIVE_DECAY' | 'DEFECTION' | 'REPAYMENT';
  tick: number;
}

// ─── Initial State ────────────────────────────────────────────────────────────

export const INITIAL_TRUST_STATE: TrustScoreState = {
  value:               SYNDICATE_CONFIG.trustInitial,
  leakageRate:         computeLeakageRate(SYNDICATE_CONFIG.trustInitial),
  lastChangeTick:      0,
  totalGained:         0,
  totalLost:           0,
  negativePlayCount:   0,
  aidFulfillments:     0,
  suspicionLevel:      0,
  counterIntelActive:  false,
};

// ─── Core Updates ─────────────────────────────────────────────────────────────

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
  const totalLost   = delta < 0 ? state.totalLost + Math.abs(delta) : state.totalLost;
  const negativePlayCount = trustImpact < 0 ? state.negativePlayCount + 1 : state.negativePlayCount;
  const suspicionLevel    = trustImpact < -0.5
    ? state.suspicionLevel + 1
    : Math.max(0, state.suspicionLevel - 0.2);

  return {
    ...state,
    value:              parseFloat(newValue.toFixed(3)),
    leakageRate:        computeLeakageWithRole(newValue, state.counterIntelActive),
    lastChangeTick:     tick,
    totalGained,
    totalLost,
    negativePlayCount,
    suspicionLevel:     parseFloat(suspicionLevel.toFixed(2)),
  };
}

export function decayTrustPassive(state: TrustScoreState, tick: number): TrustScoreState {
  const newValue = Math.max(0, state.value - SYNDICATE_CONFIG.trustPassiveDecay);
  return {
    ...state,
    value:          parseFloat(newValue.toFixed(3)),
    leakageRate:    computeLeakageWithRole(newValue, state.counterIntelActive),
    totalLost:      state.totalLost + SYNDICATE_CONFIG.trustPassiveDecay,
  };
}

/**
 * Applies accelerated trust decay at T3/T4 pressure tiers.
 * Integrates with PressureEngine tier output.
 * Tier 0–1: normal decay. Tier 2: 1.2×. Tier 3: 1.8×. Tier 4: 2.5×.
 */
export function computeTrustWithPressureTier(
  state: TrustScoreState,
  pressureTier: 0 | 1 | 2 | 3 | 4,
  tick: number,
): TrustScoreState {
  const tierMultiplier: Record<number, number> = { 0: 1.0, 1: 1.0, 2: 1.2, 3: 1.8, 4: 2.5 };
  const mult      = tierMultiplier[pressureTier] ?? 1.0;
  const decay     = SYNDICATE_CONFIG.trustPassiveDecay * mult;
  const newValue  = Math.max(0, state.value - decay);

  return {
    ...state,
    value:          parseFloat(newValue.toFixed(3)),
    leakageRate:    computeLeakageWithRole(newValue, state.counterIntelActive),
    totalLost:      state.totalLost + decay,
  };
}

export function applyAidFulfillment(state: TrustScoreState, tick: number): TrustScoreState {
  const gain     = 0.08;
  const newValue = Math.min(SYNDICATE_CONFIG.trustMax, state.value + gain);
  return {
    ...state,
    value:           parseFloat(newValue.toFixed(3)),
    leakageRate:     computeLeakageWithRole(newValue, state.counterIntelActive),
    totalGained:     state.totalGained + gain,
    aidFulfillments: state.aidFulfillments + 1,
    lastChangeTick:  tick,
  };
}

export function applyRescueContribution(state: TrustScoreState, tick: number): TrustScoreState {
  const gain     = 0.05;
  const newValue = Math.min(SYNDICATE_CONFIG.trustMax, state.value + gain);
  return {
    ...state,
    value:          parseFloat(newValue.toFixed(3)),
    leakageRate:    computeLeakageWithRole(newValue, state.counterIntelActive),
    totalGained:    state.totalGained + gain,
    lastChangeTick: tick,
  };
}

/**
 * Apply COUNTER_INTEL role modifier to leakage.
 * Must be called when role is assigned at run start.
 */
export function applyRoleTrustModifier(
  state: TrustScoreState,
  role: SyndicateRole,
): TrustScoreState {
  const isCounterIntel = role === 'COUNTER_INTEL';
  const newLeakage = computeLeakageWithRole(state.value, isCounterIntel);
  return {
    ...state,
    counterIntelActive: isCounterIntel || state.counterIntelActive,
    leakageRate:        newLeakage,
  };
}

/**
 * Batch apply accumulated trust deltas (20M player scale pattern).
 * Instead of mutating state N times per tick, accumulate and apply once.
 */
export function applyBatchTrustUpdates(
  state: TrustScoreState,
  deltas: TrustDeltaEntry[],
  tick: number,
): TrustScoreState {
  let accumulated = 0;
  let gained      = 0;
  let lost        = 0;
  let negativeCount = 0;

  for (const entry of deltas) {
    accumulated += entry.delta;
    if (entry.delta > 0) gained += entry.delta;
    if (entry.delta < 0) { lost += Math.abs(entry.delta); negativeCount++; }
  }

  const newValue = Math.max(0, Math.min(SYNDICATE_CONFIG.trustMax, state.value + accumulated));
  return {
    ...state,
    value:              parseFloat(newValue.toFixed(3)),
    leakageRate:        computeLeakageWithRole(newValue, state.counterIntelActive),
    lastChangeTick:     tick,
    totalGained:        state.totalGained + gained,
    totalLost:          state.totalLost + lost,
    negativePlayCount:  state.negativePlayCount + negativeCount,
  };
}

// ─── Leakage Computation ──────────────────────────────────────────────────────

/** Returns leakage rate (0.0–0.35) inversely correlated with trust */
export function computeLeakageRate(trustValue: number): number {
  const rate = Math.max(0, (1 - trustValue) * SYNDICATE_CONFIG.maxTrustLeakageRate);
  return parseFloat(rate.toFixed(3));
}

/**
 * Role-aware leakage — COUNTER_INTEL reduces leakage by 15% globally.
 */
export function computeLeakageWithRole(trustValue: number, counterIntelActive: boolean): number {
  let rate = Math.max(0, (1 - trustValue) * SYNDICATE_CONFIG.maxTrustLeakageRate);
  if (counterIntelActive) {
    rate = rate * (1 - SYNDICATE_CONFIG.counterIntelLeakageReduction);
  }
  return parseFloat(rate.toFixed(3));
}

/** Apply leakage to an income delta */
export function applyTrustLeakage(incomeDelta: number, leakageRate: number): number {
  return Math.round(incomeDelta * (1 - leakageRate));
}

// ─── Trust Multiplier (SyndicateCardMode compatible) ─────────────────────────

/**
 * Returns the Trust Score multiplier applied to AID/RESCUE card effectiveness.
 * Trust 0.0–0.5  → 0.5× to 1.0× linear
 * Trust 0.5–1.0  → 1.0× to 1.5× linear
 * Mirrors SyndicateCardMode.getTrustMultiplier() but operates on 0–1 float scale.
 */
export function getTrustMultiplier(trustValue: number): number {
  if (trustValue <= 0.5) return 0.5 + (trustValue / 0.5) * 0.5;
  return 1.0 + ((trustValue - 0.5) / 0.5) * 0.5;
}

// ─── Trust Scale Converters ───────────────────────────────────────────────────

/**
 * Convert engine trust (0.0–1.0 float) to SyndicateCardMode scale (0–100 int).
 * Re-exported from syndicateConfig for convenience.
 */
export { trustToCardScale, trustFromCardScale };

// ─── Labels ───────────────────────────────────────────────────────────────────

/** Simple trust label string */
export function trustLabel(value: number): string {
  if (value >= 0.85) return 'VERIFIED';
  if (value >= 0.65) return 'TRUSTED';
  if (value >= 0.40) return 'CAUTIOUS';
  if (value >= 0.20) return 'SUSPECT';
  return 'COMPROMISED';
}

/** Detailed trust label with icon + UI color tokens */
export function trustLabelDetailed(value: number): TrustLabelDetail {
  if (value >= 0.85) return { label: 'VERIFIED',    icon: '✅', color: '#00D4B8', borderColor: 'rgba(0,212,184,0.35)' };
  if (value >= 0.65) return { label: 'TRUSTED',     icon: '🤝', color: '#22DD88', borderColor: 'rgba(34,221,136,0.30)' };
  if (value >= 0.40) return { label: 'CAUTIOUS',    icon: '⚠️',  color: '#FF8C00', borderColor: 'rgba(255,140,0,0.30)' };
  if (value >= 0.20) return { label: 'SUSPECT',     icon: '👁',  color: '#FF6B35', borderColor: 'rgba(255,107,53,0.35)' };
  return               { label: 'COMPROMISED', icon: '💀', color: '#FF4D4D', borderColor: 'rgba(255,77,77,0.35)' };
}

/** Suspicion pattern detection */
export function isSuspiciousPattern(state: TrustScoreState): boolean {
  return state.suspicionLevel >= 3;
}

/** Returns detection probability based on suspicion level + COUNTER_INTEL role presence */
export function getDetectionProbability(
  suspicionLevel: number,
  detectorHasCounterIntel: boolean,
): number {
  const base = Math.min(1.0, suspicionLevel / 5.0);  // 0 at 0, 1.0 at 5.0
  const bonus = detectorHasCounterIntel ? 0.35 : 0;
  return parseFloat(Math.min(1.0, base + bonus).toFixed(3));
}

// ─── CORD Export ──────────────────────────────────────────────────────────────

/** Build TrustSnapshotForCORD from final TrustScoreState */
export function buildTrustSnapshot(state: TrustScoreState): TrustSnapshotForCORD {
  return {
    finalValue:           state.value,
    finalValueCardScale:  trustToCardScale(state.value),
    totalGained:          state.totalGained,
    totalLost:            state.totalLost,
    leakageRate:          state.leakageRate,
    aidFulfillments:      state.aidFulfillments,
    negativePlayCount:    state.negativePlayCount,
    peakSuspicion:        state.suspicionLevel,
    trustFinalityScore:   parseFloat(state.value.toFixed(3)),
  };
}
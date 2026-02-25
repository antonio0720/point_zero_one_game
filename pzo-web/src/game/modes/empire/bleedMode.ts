// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/bleedMode.ts
// Sprint 3 — Empire Bleed Mode System
//
// Bleed Mode activates when cash < income × bleedModeActivationRatio.
// While bleeding:
//   - Recovery cards with bleedAmplifier get bonus income (+25%)
//   - Comeback Surge XP bonus is unlocked
//   - CORD pressure score tracks pressure resilience
//   - Severity tiers control UI urgency indicators
// ═══════════════════════════════════════════════════════════════════════════

import { EMPIRE_CONFIG } from './empireConfig';

export type BleedSeverity = 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL';

export interface BleedModeState {
  active: boolean;
  severity: BleedSeverity;
  /** Tick when bleed mode last activated */
  activatedAtTick: number;
  /** Consecutive ticks spent in bleed mode */
  bleedDurationTicks: number;
  /** Total cumulative ticks in bleed this run */
  totalBleedTicks: number;
  /** Highest severity reached this run */
  peakSeverity: BleedSeverity;
  /** Count of times bleed mode re-activated */
  reactivationCount: number;
}

export const INITIAL_BLEED_STATE: BleedModeState = {
  active: false,
  severity: 'NONE',
  activatedAtTick: 0,
  bleedDurationTicks: 0,
  totalBleedTicks: 0,
  peakSeverity: 'NONE',
  reactivationCount: 0,
};

/**
 * Evaluate bleed mode given current financial state.
 * Call once per tick or after any cash/income change.
 */
export function evaluateBleedMode(
  cash: number,
  income: number,
  expenses: number,
  currentState: BleedModeState,
  currentTick: number,
): BleedModeState {
  const cashflow = income - expenses;
  const activationThreshold = income * EMPIRE_CONFIG.bleedModeActivationRatio;
  const shouldBeActive = cash < activationThreshold;

  const severity = computeBleedSeverity(cash, income, cashflow);
  const wasActive = currentState.active;

  if (!shouldBeActive) {
    return {
      ...currentState,
      active: false,
      severity: 'NONE',
      bleedDurationTicks: 0,
    };
  }

  const newDuration = wasActive ? currentState.bleedDurationTicks + 1 : 1;
  const reactivationCount = !wasActive && currentState.activatedAtTick > 0
    ? currentState.reactivationCount + 1
    : currentState.reactivationCount;

  const peakSeverity = severityGte(severity, currentState.peakSeverity)
    ? severity
    : currentState.peakSeverity;

  return {
    active: true,
    severity,
    activatedAtTick: wasActive ? currentState.activatedAtTick : currentTick,
    bleedDurationTicks: newDuration,
    totalBleedTicks: currentState.totalBleedTicks + 1,
    peakSeverity,
    reactivationCount,
  };
}

/** Returns true when financial state has recovered enough to exit bleed */
export function hasExitedBleed(cash: number, income: number, expenses: number): boolean {
  const cashflow = income - expenses;
  const surplusCash = cash - (income * EMPIRE_CONFIG.bleedModeActivationRatio);
  return surplusCash >= EMPIRE_CONFIG.bleedModeExitThreshold || cashflow > 0;
}

/** Compute income amplifier bonus during bleed mode */
export function computeBleedAmplifierBonus(incomeDelta: number, hasAmplifier: boolean): number {
  if (!hasAmplifier) return 0;
  return Math.round(incomeDelta * EMPIRE_CONFIG.bleedModeAmplifierBonus);
}

/** Check if comeback surge XP is eligible */
export function isComebackSurgeEligible(cashflow: number, bleedState: BleedModeState): boolean {
  return bleedState.active && cashflow <= EMPIRE_CONFIG.comebackSurgeCashflowThreshold;
}

// ─── Internal ────────────────────────────────────────────────────────────────

function computeBleedSeverity(cash: number, income: number, cashflow: number): BleedSeverity {
  if (cash <= 0)               return 'TERMINAL';
  if (cash < income * 0.5)     return 'CRITICAL';
  if (cashflow < 0)            return 'WATCH';
  return 'WATCH';
}

const SEVERITY_ORDER: Record<BleedSeverity, number> = {
  NONE: 0, WATCH: 1, CRITICAL: 2, TERMINAL: 3,
};

function severityGte(a: BleedSeverity, b: BleedSeverity): boolean {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b];
}

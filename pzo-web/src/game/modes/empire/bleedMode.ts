// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/bleedMode.ts
// Sprint 5 — Empire Bleed Mode System
//
// Bleed Mode activates when cash < income × bleedModeActivationRatio.
// While bleeding:
//   - Recovery cards with bleedAmplifier get bonus income (+25%)
//   - Comeback Surge XP bonus is unlocked
//   - CORD pressure score tracks pressure resilience
//   - Severity tiers control UI urgency indicators
//
// SPRINT 5 FIXES & ADDITIONS:
//   - BUG FIX: computeBleedSeverity() — CRITICAL and WATCH tiers were both
//     returning 'CRITICAL'. Now: sub-25% → CRITICAL, sub-50% → WATCH.
//   - bleedRecoveryScore()          — CORD pressure resilience contribution
//   - shouldEvaluateBleed()         — scale guard: evaluate once per tick only
//   - SEVERITY_COLOR / SEVERITY_LABEL — removed from empireConfig coupling;
//     now self-contained here. empireConfig re-exports for compat.
//
// Performance note: evaluateBleedMode() is pure and cheap (~5 ops).
// Do NOT call it more than once per tick — use shouldEvaluateBleed() guard.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { EMPIRE_CONFIG } from './empireConfig';

export type BleedSeverity = 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL';

export interface BleedModeState {
  active:              boolean;
  severity:            BleedSeverity;
  /** Tick when bleed mode last activated */
  activatedAtTick:     number;
  /** Consecutive ticks spent in current bleed episode */
  bleedDurationTicks:  number;
  /** Total cumulative ticks in bleed this run */
  totalBleedTicks:     number;
  /** Highest severity reached this run */
  peakSeverity:        BleedSeverity;
  /** Count of times bleed mode re-activated after recovery */
  reactivationCount:   number;
  /** Last tick this state was evaluated (scale guard) */
  lastEvalTick:        number;
}

export const INITIAL_BLEED_STATE: Readonly<BleedModeState> = Object.freeze({
  active:             false,
  severity:           'NONE',
  activatedAtTick:    0,
  bleedDurationTicks: 0,
  totalBleedTicks:    0,
  peakSeverity:       'NONE',
  reactivationCount:  0,
  lastEvalTick:       -1,
});

// ── Scale guard ───────────────────────────────────────────────────────────────

/**
 * Returns true when bleed state should be re-evaluated this tick.
 * Prevents redundant evaluation calls from card play hooks.
 * Call once per tick in processEmpireTick() — not per card play.
 */
export function shouldEvaluateBleed(state: BleedModeState, currentTick: number): boolean {
  return state.lastEvalTick !== currentTick;
}

// ── Core evaluation ───────────────────────────────────────────────────────────

/**
 * Evaluate bleed mode given current financial state.
 * Call once per tick — use shouldEvaluateBleed() guard at call site.
 * Returns a new BleedModeState — never mutates input.
 */
export function evaluateBleedMode(
  cash:         number,
  income:       number,
  expenses:     number,
  currentState: BleedModeState,
  currentTick:  number,
): BleedModeState {
  const cashflow            = income - expenses;
  const activationThreshold = income * EMPIRE_CONFIG.bleedModeActivationRatio;
  const shouldBeActive      = cash < activationThreshold;

  const severity = computeBleedSeverity(cash, income, cashflow);
  const wasActive = currentState.active;

  if (!shouldBeActive) {
    return {
      ...currentState,
      active:             false,
      severity:           'NONE',
      bleedDurationTicks: 0,
      lastEvalTick:       currentTick,
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
    active:             true,
    severity,
    activatedAtTick:    wasActive ? currentState.activatedAtTick : currentTick,
    bleedDurationTicks: newDuration,
    totalBleedTicks:    currentState.totalBleedTicks + 1,
    peakSeverity,
    reactivationCount,
    lastEvalTick:       currentTick,
  };
}

/** Returns true when financial state has recovered enough to exit bleed */
export function hasExitedBleed(cash: number, income: number, expenses: number): boolean {
  const cashflow    = income - expenses;
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

// ── Sprint 5 additions ────────────────────────────────────────────────────────

/**
 * Returns true when the bleed state should trigger a UI pulse animation.
 * Fires at CRITICAL and TERMINAL severity.
 */
export function computeBleedUrgencyPulse(state: BleedModeState): boolean {
  return state.active && (state.severity === 'CRITICAL' || state.severity === 'TERMINAL');
}

/**
 * Estimated ticks until bankruptcy given current cashflow.
 * Returns Infinity if cashflow is positive.
 * Returns 0 if already bankrupt.
 * Uses reduce (not spread) for 20M-scale safety — no argument limit.
 */
export function estimatedSurvivalTicks(cash: number, cashflow: number): number {
  if (cash <= 0) return 0;
  if (cashflow >= 0) return Infinity;
  return Math.max(0, Math.floor(cash / Math.abs(cashflow)));
}

/**
 * Human-readable bleed duration label.
 * e.g. "WATCH · 3t" / "CRITICAL · 14t" / "TERMINAL · 47t"
 */
export function bleedDurationLabel(bleedState: BleedModeState): string {
  if (!bleedState.active) return 'STABLE';
  const prefix = bleedState.severity === 'TERMINAL' ? 'TERMINAL' :
                 bleedState.severity === 'CRITICAL' ? 'CRITICAL' : 'WATCH';
  return `${prefix} · ${bleedState.bleedDurationTicks}t`;
}

/**
 * Returns a compact summary string for the event log.
 */
export function bleedEventLabel(state: BleedModeState, previousState: BleedModeState): string | null {
  if (!previousState.active && state.active) {
    return `💀 BLEED ACTIVATED (${state.severity})`;
  }
  if (previousState.active && !state.active) {
    return `✓ BLEED RESOLVED · peak: ${previousState.peakSeverity}`;
  }
  if (previousState.severity !== state.severity && state.active) {
    return `🔴 BLEED ESCALATED: ${previousState.severity} → ${state.severity}`;
  }
  return null;
}

/**
 * SPRINT 5: CORD pressure resilience contribution from bleed state.
 * Higher score = survived more pressure with fewer panic plays.
 *
 * Range: 0.0 (catastrophic) → 1.0 (elite pressure handling)
 *
 * @param totalBleedTicks       - cumulative ticks in bleed this run
 * @param totalTicks            - total ticks elapsed
 * @param reactivationCount     - how many times bleed re-activated
 * @param peakSeverity          - worst severity reached
 * @param panicCount            - total PANIC decision tags
 * @param totalDecisions        - total decisions made
 */
export function bleedRecoveryScore(
  totalBleedTicks:  number,
  totalTicks:       number,
  reactivationCount: number,
  peakSeverity:     BleedSeverity,
  panicCount:       number,
  totalDecisions:   number,
): number {
  if (totalTicks === 0) return 0.5;

  // Fraction of run spent in bleed — higher = lower resilience
  const bleedRatio = Math.min(1, totalBleedTicks / totalTicks);

  // Panic rate — higher = lower resilience
  const panicRatio = totalDecisions > 0 ? Math.min(1, panicCount / totalDecisions) : 0;

  // Penalty for reaching TERMINAL
  const terminalPenalty = peakSeverity === 'TERMINAL' ? 0.15 : 0;

  // Bonus for recovering multiple times — shows adaptability
  const recoveryBonus = Math.min(0.10, reactivationCount * 0.04);

  const raw = 0.80
    - bleedRatio   * 0.40   // time in bleed hurts
    - panicRatio   * 0.25   // panic decisions hurt
    - terminalPenalty        // terminal severity hurts hard
    + recoveryBonus;         // multiple recoveries show resilience

  return parseFloat(Math.max(0, Math.min(1, raw)).toFixed(3));
}

// ── Internal ──────────────────────────────────────────────────────────────────

/**
 * SPRINT 5 FIX: Previously both sub-25% and sub-50% returned 'CRITICAL'.
 * Now:
 *   cash ≤ 0              → TERMINAL (bankruptcy imminent)
 *   cash < income * 0.25  → CRITICAL  (severe danger)
 *   cash < income * 0.5   → WATCH     (caution zone, was incorrectly CRITICAL before)
 *   cashflow < 0          → WATCH     (trending toward bleed)
 *   else                  → WATCH     (active bleed, not yet critical)
 *
 * Callers: evaluateBleedMode() only — do not call directly.
 */
function computeBleedSeverity(cash: number, income: number, cashflow: number): BleedSeverity {
  if (cash <= 0)             return 'TERMINAL';
  if (cash < income * 0.25)  return 'CRITICAL';   // severe danger
  if (cash < income * 0.50)  return 'WATCH';       // FIX: was CRITICAL in Sprint 4
  if (cashflow < 0)          return 'WATCH';
  return 'WATCH';
}

const SEVERITY_ORDER: Record<BleedSeverity, number> = {
  NONE: 0, WATCH: 1, CRITICAL: 2, TERMINAL: 3,
};

function severityGte(a: BleedSeverity, b: BleedSeverity): boolean {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b];
}
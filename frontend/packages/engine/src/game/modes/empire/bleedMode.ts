/**
 * bleedMode.ts — Empire Mode Bleed System
 * Point Zero One · Density6 LLC · Confidential
 *
 * Tracks passive wealth erosion ("bleeding") when expenses > income.
 * The bleed system creates urgency: players must achieve income > expenses
 * before their net worth drains to zero.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BleedSeverity = 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'CRITICAL';

export interface BleedModeState {
  /** Whether the player is currently bleeding (expenses > income) */
  isActive:        boolean;
  /** Current severity level */
  severity:        BleedSeverity;
  /** Net drain per tick in dollars */
  drainPerTick:    number;
  /** Ticks since bleed started (0 if not active) */
  ticksActive:     number;
  /** Estimated ticks until bankruptcy at current drain rate */
  ticksToZero:     number;
  /** Peak severity reached this run */
  peakSeverity:    BleedSeverity;
}

// ─── Severity thresholds ──────────────────────────────────────────────────────

const SEVERITY_THRESHOLDS: Array<{ maxDrain: number; severity: BleedSeverity }> = [
  { maxDrain: 0,     severity: 'NONE' },
  { maxDrain: 200,   severity: 'LIGHT' },
  { maxDrain: 500,   severity: 'MODERATE' },
  { maxDrain: 1200,  severity: 'HEAVY' },
  { maxDrain: Infinity, severity: 'CRITICAL' },
];

// ─── Functions ────────────────────────────────────────────────────────────────

export function computeBleedSeverity(drainPerTick: number): BleedSeverity {
  for (const t of SEVERITY_THRESHOLDS) {
    if (drainPerTick <= t.maxDrain) return t.severity;
  }
  return 'CRITICAL';
}

export function estimatedSurvivalTicks(cash: number, netWorth: number, drainPerTick: number): number {
  if (drainPerTick <= 0) return Infinity;
  const available = Math.max(0, Math.min(cash, netWorth));
  return Math.floor(available / drainPerTick);
}

export function bleedDurationLabel(ticksActive: number): string {
  if (ticksActive < 10) return 'Just started';
  if (ticksActive < 50) return 'Building';
  if (ticksActive < 150) return 'Sustained';
  return 'Critical duration';
}

export function computeBleedUrgencyPulse(severity: BleedSeverity): number {
  switch (severity) {
    case 'NONE':     return 0;
    case 'LIGHT':    return 0.3;
    case 'MODERATE': return 0.6;
    case 'HEAVY':    return 0.85;
    case 'CRITICAL': return 1.0;
  }
}

export function createBleedState(): BleedModeState {
  return {
    isActive: false, severity: 'NONE', drainPerTick: 0,
    ticksActive: 0, ticksToZero: Infinity, peakSeverity: 'NONE',
  };
}

export function updateBleedState(
  state: BleedModeState, income: number, expenses: number,
  cash: number, netWorth: number,
): BleedModeState {
  const drain = Math.max(0, expenses - income);
  const isActive = drain > 0;
  const severity = computeBleedSeverity(drain);
  const ticksActive = isActive ? state.ticksActive + 1 : 0;
  const ticksToZero = estimatedSurvivalTicks(cash, netWorth, drain);
  const peakSeverity = SEVERITY_THRESHOLDS.findIndex(t => t.severity === severity)
    > SEVERITY_THRESHOLDS.findIndex(t => t.severity === state.peakSeverity)
    ? severity : state.peakSeverity;

  return { isActive, severity, drainPerTick: drain, ticksActive, ticksToZero, peakSeverity };
}

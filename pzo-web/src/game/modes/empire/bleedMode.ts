// pzo-web/src/game/modes/empire/bleedMode.ts

/**
 * bleedMode.ts — Empire bleed helpers
 *
 * FILE LOCATION: pzo-web/src/game/modes/empire/bleedMode.ts
 * Density6 LLC · Confidential
 */

export type BleedSeverity = 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL';

export interface BleedModeState {
  active: boolean;
  severity: BleedSeverity;
  peakSeverity: BleedSeverity;
  enteredAtTick: number | null;
  tickNumber: number;
  cash: number;
  cashflow: number;
  survivalTicks: number;
  deficitPerMonth: number;
  comebackEligible: boolean;
}

export interface BleedModeComputationInput {
  cash: number;
  cashflow: number;
  tick: number;
}

const SEVERITY_RANK: Record<BleedSeverity, number> = {
  NONE: 0,
  WATCH: 1,
  CRITICAL: 2,
  TERMINAL: 3,
};

export function maxBleedSeverity(a: BleedSeverity, b: BleedSeverity): BleedSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

export function estimatedSurvivalTicks(cash: number, cashflow: number): number {
  if (!Number.isFinite(cash) || !Number.isFinite(cashflow)) return Infinity;
  if (cashflow >= 0) return Infinity;
  if (cash <= 0) return 0;
  return Math.max(0, Math.ceil(cash / Math.abs(cashflow)));
}

export function resolveBleedSeverity(
  cash: number,
  cashflow: number,
  survivalTicks: number,
): BleedSeverity {
  if (cashflow >= 0 && cash > 0) return 'NONE';
  if (cash <= 0 || survivalTicks <= 3) return 'TERMINAL';
  if (survivalTicks <= 12 || (cashflow < 0 && cash <= Math.abs(cashflow) * 3)) {
    return 'CRITICAL';
  }
  if (cashflow < 0) return 'WATCH';
  return 'NONE';
}

export function computeBleedModeState({
  cash,
  cashflow,
  tick,
}: BleedModeComputationInput): BleedModeState {
  const survivalTicks = estimatedSurvivalTicks(cash, cashflow);
  const severity = resolveBleedSeverity(cash, cashflow, survivalTicks);
  const deficitPerMonth = Math.max(0, -cashflow);

  return {
    active: severity !== 'NONE',
    severity,
    peakSeverity: severity,
    enteredAtTick: severity !== 'NONE' ? tick : null,
    tickNumber: tick,
    cash,
    cashflow,
    survivalTicks,
    deficitPerMonth,
    comebackEligible:
      severity !== 'TERMINAL' &&
      cash > 0 &&
      cashflow > -Math.max(500, Math.abs(cash) * 0.08),
  };
}

export function bleedDurationLabel(state: BleedModeState): string {
  if (!state.active || state.enteredAtTick == null) return 'STABLE';
  const duration = Math.max(0, state.tickNumber - state.enteredAtTick);
  return `t+${duration}`;
}

export function computeBleedUrgencyPulse(state: BleedModeState): boolean {
  return state.severity === 'CRITICAL' || state.severity === 'TERMINAL';
}
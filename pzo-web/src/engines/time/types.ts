// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/time/types.ts
export type TickTierId = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

export const TICK_TIER_IDS: readonly TickTierId[] = ['T0', 'T1', 'T2', 'T3', 'T4'] as const;

export const TICK_DURATION_MS_BY_TIER: Record<TickTierId, number> = {
  T0: 3000,
  T1: 2000,
  T2: 1500,
  T3: 1000,
  T4: 700,
};

export interface TickBudget {
  allocated: number;
  consumed: number;
  remaining: number;
}

export interface TierTransitionRecord {
  tickIndex: number;
  fromTier: TickTierId;
  toTier: TickTierId;
  pressureScore: number;
  previousDurationMs: number;
  newDurationMs: number;
  multiplier: number;
  timestamp: number;
}

export interface TierHistogram {
  T0: number;
  T1: number;
  T2: number;
  T3: number;
  T4: number;
}

export interface DecisionWindowLifecycleMetrics {
  openedTotal: number;
  resolvedTotal: number;
  expiredTotal: number;
  autoResolvedTotal: number;
  holdUsedTotal: number;
  avgOpenToResolveLatencyMs: number;
  maxOpenToResolveLatencyMs: number;
  tierAtOpenCounts: TierHistogram;
  tierAtResolveCounts: TierHistogram;
  tierAtExpiryCounts: TierHistogram;
}

export interface RunTimeoutFlags {
  timeoutImminent: boolean;
  timeoutOccurred: boolean;
  completed: boolean;
  completionReason: 'TIMEOUT' | 'RUN_ENDED' | 'ABANDONED' | 'UNKNOWN' | null;
  runStartedAtMs: number | null;
  runCompletedAtMs: number | null;
}

export interface TelemetryEnvelopeV2 {
  tickTierDwell: TierHistogram;
  tierTransitions: TierTransitionRecord[];
  decisionWindowLifecycleMetrics: DecisionWindowLifecycleMetrics;
  runTimeoutFlags: RunTimeoutFlags;
}

export interface TimeEngineStateSnapshot {
  tickIndex: number;
  tickTier: TickTierId;
  tickDurationMs: number;
  seasonBudget: number;
  ticksRemaining: number;
  timeoutImminent: boolean;
  decisionWindows: number;
}

export type TierAtEnd = TickTierId | 1 | 2 | 3 | 4 | 5 | 'UNKNOWN';

export function createZeroTierHistogram(): TierHistogram {
  return {
    T0: 0,
    T1: 0,
    T2: 0,
    T3: 0,
    T4: 0,
  };
}

export function createEmptyDecisionWindowLifecycleMetrics(): DecisionWindowLifecycleMetrics {
  return {
    openedTotal: 0,
    resolvedTotal: 0,
    expiredTotal: 0,
    autoResolvedTotal: 0,
    holdUsedTotal: 0,
    avgOpenToResolveLatencyMs: 0,
    maxOpenToResolveLatencyMs: 0,
    tierAtOpenCounts: createZeroTierHistogram(),
    tierAtResolveCounts: createZeroTierHistogram(),
    tierAtExpiryCounts: createZeroTierHistogram(),
  };
}

export function createEmptyRunTimeoutFlags(): RunTimeoutFlags {
  return {
    timeoutImminent: false,
    timeoutOccurred: false,
    completed: false,
    completionReason: null,
    runStartedAtMs: null,
    runCompletedAtMs: null,
  };
}

export function createEmptyTelemetryEnvelope(): TelemetryEnvelopeV2 {
  return {
    tickTierDwell: createZeroTierHistogram(),
    tierTransitions: [],
    decisionWindowLifecycleMetrics: createEmptyDecisionWindowLifecycleMetrics(),
    runTimeoutFlags: createEmptyRunTimeoutFlags(),
  };
}

export function isTickTierId(value: unknown): value is TickTierId {
  return typeof value === 'string' && (TICK_TIER_IDS as readonly string[]).includes(value);
}

export function coerceTickTierId(value: unknown, fallback: TickTierId = 'T1'): TickTierId {
  return isTickTierId(value) ? value : fallback;
}

export function toTierAtEnd(value: unknown): TierAtEnd {
  if (isTickTierId(value)) {
    return value;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
    return value as 1 | 2 | 3 | 4 | 5;
  }

  return 'UNKNOWN';
}

export interface TelemetryEnvelopeV2 {
  tickTierDwell?: Record<string, unknown>;
  tierTransitions?: unknown[];
  decisionWindowLifecycleMetrics?: Record<string, unknown>;
  runTimeoutFlags?: Record<string, boolean | string | undefined>;
}

export interface TickBudget {
  allocated: number;
  consumed: number;
  remaining: number;
}

export type TierAtEnd = 1 | 2 | 3 | 4 | 5;

import type {
  DecisionWindowLifecycleMetrics,
  TickBudget,
  TierAtEnd,
  TierHistogram,
  TimeEngineStateSnapshot,
} from '../engines/time/types';

export interface RunTimeSnapshot {
  runId: string;
  capturedAtMs: number;
  ticksElapsed: number;
  tickBudget: TickBudget;
  tierAtEnd: TierAtEnd;
  avgTickDurationMs: number;
  decisionsOpenedTotal: number;
  decisionsExpiredTotal: number;
  decisionsResolvedTotal: number;
  autoResolvedTotal: number;
  holdUsedTotal: number;
  tierTransitionsTotal: number;
  timeoutOccurred: boolean;
  timeoutImminent: boolean;
  tickTierDwell: TierHistogram;
  decisionWindowLifecycleMetrics: DecisionWindowLifecycleMetrics;
  lastKnownState: TimeEngineStateSnapshot;
}
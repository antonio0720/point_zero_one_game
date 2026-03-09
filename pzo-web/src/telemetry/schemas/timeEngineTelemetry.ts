import {
  createEmptyDecisionWindowLifecycleMetrics,
  createEmptyRunTimeoutFlags,
  createZeroTierHistogram,
  type DecisionWindowLifecycleMetrics,
  type RunTimeoutFlags,
  type TelemetryEnvelopeV2,
  type TierHistogram,
  type TierTransitionRecord,
} from '../../engines/time/types';

export type TimeTierDwell = TierHistogram;
export type TierTransition = TierTransitionRecord;

export class TimeEngineTelemetry implements TelemetryEnvelopeV2 {
  public static readonly eventName = 'time_engine_telemetry';

  public readonly tickTierDwell: TimeTierDwell;
  public readonly tierTransitions: TierTransition[];
  public readonly decisionWindowLifecycleMetrics: DecisionWindowLifecycleMetrics;
  public readonly runTimeoutFlags: RunTimeoutFlags;

  public constructor(data?: Partial<TelemetryEnvelopeV2>) {
    this.tickTierDwell = {
      ...createZeroTierHistogram(),
      ...(data?.tickTierDwell ?? {}),
    };

    this.tierTransitions = [...(data?.tierTransitions ?? [])];

    this.decisionWindowLifecycleMetrics = {
      ...createEmptyDecisionWindowLifecycleMetrics(),
      ...(data?.decisionWindowLifecycleMetrics ?? {}),
      tierAtOpenCounts: {
        ...createZeroTierHistogram(),
        ...(data?.decisionWindowLifecycleMetrics?.tierAtOpenCounts ?? {}),
      },
      tierAtResolveCounts: {
        ...createZeroTierHistogram(),
        ...(data?.decisionWindowLifecycleMetrics?.tierAtResolveCounts ?? {}),
      },
      tierAtExpiryCounts: {
        ...createZeroTierHistogram(),
        ...(data?.decisionWindowLifecycleMetrics?.tierAtExpiryCounts ?? {}),
      },
    };

    this.runTimeoutFlags = {
      ...createEmptyRunTimeoutFlags(),
      ...(data?.runTimeoutFlags ?? {}),
    };
  }

  public toJSON(): TelemetryEnvelopeV2 {
    return {
      tickTierDwell: { ...this.tickTierDwell },
      tierTransitions: this.tierTransitions.map((transition) => ({ ...transition })),
      decisionWindowLifecycleMetrics: {
        ...this.decisionWindowLifecycleMetrics,
        tierAtOpenCounts: { ...this.decisionWindowLifecycleMetrics.tierAtOpenCounts },
        tierAtResolveCounts: { ...this.decisionWindowLifecycleMetrics.tierAtResolveCounts },
        tierAtExpiryCounts: { ...this.decisionWindowLifecycleMetrics.tierAtExpiryCounts },
      },
      runTimeoutFlags: { ...this.runTimeoutFlags },
    };
  }
}
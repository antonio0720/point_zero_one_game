// pzo-web/src/telemetry/schemas/timeEngineTelemetry.ts
import { TelemetryEnvelopeV2 } from '../../engines/time/types';

export interface TimeTierDwell extends Record<string, unknown> {
  startTime: string;
  endTime: string;
}

export interface TierTransition extends Record<string, unknown> {
  fromTierId: string;
  toTierId: string;
  transitionTime: string;
}

export interface DecisionWindowLifecycleMetrics extends Record<string, unknown> {
  openTimestamp: string;
  closeTimestamp: string;
  decisionsMade: number;
}

export interface HoldUsage extends Record<string, unknown> {
  holdStartTime?: string;
  releaseTime?: string;
}

export interface RunTimeoutFlags extends Record<string, boolean | string | undefined> {
  timeoutOccurred: boolean;
  runEndedTimestamp?: string;
}

export class TimeEngineTelemetry implements TelemetryEnvelopeV2 {
  private static readonly eventName = 'time_engine_telemetry';

  public tickTierDwell: TimeTierDwell;
  public tierTransitions: TierTransition[];
  public decisionWindowLifecycleMetrics: DecisionWindowLifecycleMetrics;
  public holdUsage?: HoldUsage;
  public runTimeoutFlags: RunTimeoutFlags;

  constructor(data: TelemetryEnvelopeV2) {
    this.tickTierDwell = (data.tickTierDwell as TimeTierDwell)
      ?? { startTime: '', endTime: '' };
    this.tierTransitions = (data.tierTransitions as TierTransition[]) ?? [];
    this.decisionWindowLifecycleMetrics =
      (data.decisionWindowLifecycleMetrics as DecisionWindowLifecycleMetrics)
      ?? { openTimestamp: '', closeTimestamp: '', decisionsMade: 0 };
    this.runTimeoutFlags = (data.runTimeoutFlags as RunTimeoutFlags)
      ?? { timeoutOccurred: false };
  }
}

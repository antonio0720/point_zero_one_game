// pzo-web/src/telemetry/schemas/timeEngineTelemetry.ts
import { TelemetryEnvelopeV2 } from '../types'; // Adjust the path as necessary based on your project structure

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

export interface RunTimeoutFlags extends Record<string, boolean | undefined> {
  timeoutOccurred: boolean;
  runEndedTimestamp?: string;
}

export class TimeEngineTelemetry implements TelemetryEnvelopeV2 {
  private static readonly eventName = 'time_engine_telemetry'; // Ensure stable versioning for the event name.
  
  public tickTierDwell: TimeTierDwell;
  public tierTransitions: TierTransition[];
  public decisionWindowLifecycleMetrics: DecisionWindowLifecycleMetrics;
  public holdUsage?: HoldUsage; // Optional field as it might not be used in all scenarios.
  public runTimeoutFlags: RunTimeoutFlags;
  
  constructor(data: TelemetryEnvelopeV2) {
    this.tickTierDwell = data.tickTierDwell || {};
    this.tierTransitions = data.tierTransitions || [];
    this013, PZO_E1_TIME_P14 — Telemetry & Instrumentation
SPRINT:  S4
TYPE:    schema_design
PRIORITY:P1

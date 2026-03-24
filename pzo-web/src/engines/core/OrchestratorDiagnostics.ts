/**
 * POINT ZERO ONE — ORCHESTRATOR DIAGNOSTICS
 * File: pzo-web/src/engines/core/OrchestratorDiagnostics.ts
 *
 * Purpose:
 * - Provide deterministic, lightweight diagnostics for EngineOrchestrator
 * - Measure tick pacing, drift, step timings, queue flush cost, event volume,
 *   and time-engine instability (tier oscillation, countdown backlog, timeout pressure)
 * - Produce operator-grade snapshots without mutating gameplay state
 */

import type { TickTier } from './types';

export type OrchestratorStepName =
  | 'STEP_01_TIME_ADVANCE'
  | 'STEP_02_PRESSURE_COMPUTE'
  | 'STEP_03_TENSION_UPDATE'
  | 'STEP_04_SHIELD_PASSIVE'
  | 'STEP_05_BATTLE_STATE'
  | 'STEP_06_BATTLE_ATTACKS'
  | 'STEP_07_SHIELD_ATTACK_APPLY'
  | 'STEP_08_CASCADE_EXECUTE'
  | 'STEP_09_CASCADE_RECOVERY'
  | 'STEP_10_PRESSURE_RECOMPUTE'
  | 'STEP_11_TIME_TIER_UPDATE'
  | 'STEP_12_SOVEREIGNTY_SNAPSHOT'
  | 'STEP_13_EVENT_FLUSH';

export interface TickWindowSample {
  tickIndex: number;
  tier: TickTier | null;
  scheduledDurationMs: number;
  actualDurationMs: number;
  driftMs: number;
  stepDurationsMs: Partial<Record<OrchestratorStepName, number>>;
  flushDurationMs: number;
  emittedEventCount: number;
  openDecisionWindowCount: number;
  timestamp: number;
}

export interface OrchestratorDiagnosticThresholds {
  maxAllowedDriftMs: number;
  maxAllowedFlushMs: number;
  maxAllowedSingleStepMs: number;
  maxAllowedOpenDecisionWindows: number;
  tierOscillationWindow: number;
  tierOscillationTripCount: number;
}

export interface OrchestratorAlert {
  code:
    | 'HIGH_TICK_DRIFT'
    | 'SLOW_FLUSH'
    | 'SLOW_STEP'
    | 'WINDOW_BACKLOG'
    | 'TIER_OSCILLATION'
    | 'RUNAWAY_EVENT_VOLUME';
  message: string;
  tickIndex: number;
  metadata?: Record<string, unknown>;
}

export interface OrchestratorDiagnosticsSnapshot {
  generatedAt: number;
  totalTicksObserved: number;
  lastTickIndex: number;
  currentTier: TickTier | null;
  avgScheduledDurationMs: number;
  avgActualDurationMs: number;
  avgDriftMs: number;
  maxDriftMs: number;
  avgFlushDurationMs: number;
  maxFlushDurationMs: number;
  maxSingleStepMs: number;
  totalEventsObserved: number;
  avgEventsPerTick: number;
  maxOpenDecisionWindowCount: number;
  tierTransitionCount: number;
  recentTierSequence: TickTier[];
  alerts: OrchestratorAlert[];
  lastTick: TickWindowSample | null;
}

const DEFAULT_THRESHOLDS: OrchestratorDiagnosticThresholds = {
  maxAllowedDriftMs: 150,
  maxAllowedFlushMs: 32,
  maxAllowedSingleStepMs: 24,
  maxAllowedOpenDecisionWindows: 8,
  tierOscillationWindow: 8,
  tierOscillationTripCount: 4,
};

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export class OrchestratorDiagnostics {
  private readonly history: TickWindowSample[] = [];
  private readonly recentTiers: TickTier[] = [];
  private readonly alerts: OrchestratorAlert[] = [];
  private readonly maxHistory: number;

  private tickStartHrMs: number | null = null;
  private flushStartHrMs: number | null = null;
  private lastScheduledDurationMs = 0;
  private currentTickIndex = 0;
  private currentTier: TickTier | null = null;
  private currentStepDurations: Partial<Record<OrchestratorStepName, number>> = {};
  private currentEventCount = 0;
  private currentOpenWindowCount = 0;
  private tierTransitionCount = 0;
  private lastTickCompletedAtMs: number | null = null;

  public constructor(
    private readonly thresholds: OrchestratorDiagnosticThresholds = DEFAULT_THRESHOLDS,
    historySize = 256,
  ) {
    this.maxHistory = Math.max(32, historySize);
  }

  public onTickScheduled(tickIndex: number, scheduledDurationMs: number, tier: TickTier | null): void {
    this.currentTickIndex = tickIndex;
    this.currentTier = tier;
    this.lastScheduledDurationMs = scheduledDurationMs;
  }

  public onTickStarted(): void {
    this.tickStartHrMs = performance.now();
    this.currentStepDurations = {};
    this.currentEventCount = 0;
  }

  public onStepCompleted(step: OrchestratorStepName, durationMs: number): void {
    this.currentStepDurations[step] = durationMs;

    if (durationMs > this.thresholds.maxAllowedSingleStepMs) {
      this.pushAlert({
        code: 'SLOW_STEP',
        message: `Step ${step} exceeded ${this.thresholds.maxAllowedSingleStepMs}ms`,
        tickIndex: this.currentTickIndex,
        metadata: { step, durationMs },
      });
    }
  }

  public onTierChanged(from: TickTier | null, to: TickTier): void {
    if (from === to) return;

    this.tierTransitionCount += 1;
    this.recentTiers.push(to);

    while (this.recentTiers.length > this.thresholds.tierOscillationWindow) {
      this.recentTiers.shift();
    }

    const changes = this.recentTiers.reduce((count, tier, index, arr) => {
      if (index === 0) return count;
      return count + Number(arr[index - 1] !== tier);
    }, 0);

    if (changes >= this.thresholds.tierOscillationTripCount) {
      this.pushAlert({
        code: 'TIER_OSCILLATION',
        message: 'Tick tier is oscillating too frequently across recent ticks',
        tickIndex: this.currentTickIndex,
        metadata: {
          recentTiers: [...this.recentTiers],
          changes,
        },
      });
    }
  }

  public onEventEmitted(count = 1): void {
    this.currentEventCount += count;
    if (this.currentEventCount > 128) {
      this.pushAlert({
        code: 'RUNAWAY_EVENT_VOLUME',
        message: 'Per-tick event volume exceeded 128 emits',
        tickIndex: this.currentTickIndex,
        metadata: { currentEventCount: this.currentEventCount },
      });
    }
  }

  public onDecisionWindowCountUpdated(openDecisionWindowCount: number): void {
    this.currentOpenWindowCount = openDecisionWindowCount;

    if (openDecisionWindowCount > this.thresholds.maxAllowedOpenDecisionWindows) {
      this.pushAlert({
        code: 'WINDOW_BACKLOG',
        message: 'Open decision window backlog exceeded configured threshold',
        tickIndex: this.currentTickIndex,
        metadata: {
          openDecisionWindowCount,
          threshold: this.thresholds.maxAllowedOpenDecisionWindows,
        },
      });
    }
  }

  public onFlushStarted(): void {
    this.flushStartHrMs = performance.now();
  }

  public onTickCompleted(): TickWindowSample {
    const completedAt = performance.now();
    const startedAt = this.tickStartHrMs ?? completedAt;
    const actualDurationMs = Math.max(0, completedAt - startedAt);
    const driftMs = actualDurationMs - this.lastScheduledDurationMs;
    const flushDurationMs =
      this.flushStartHrMs === null ? 0 : Math.max(0, completedAt - this.flushStartHrMs);

    if (Math.abs(driftMs) > this.thresholds.maxAllowedDriftMs) {
      this.pushAlert({
        code: 'HIGH_TICK_DRIFT',
        message: 'Actual tick wall time drifted too far from scheduled duration',
        tickIndex: this.currentTickIndex,
        metadata: {
          scheduledDurationMs: this.lastScheduledDurationMs,
          actualDurationMs,
          driftMs,
        },
      });
    }

    if (flushDurationMs > this.thresholds.maxAllowedFlushMs) {
      this.pushAlert({
        code: 'SLOW_FLUSH',
        message: 'EventBus flush exceeded configured latency threshold',
        tickIndex: this.currentTickIndex,
        metadata: {
          flushDurationMs,
          threshold: this.thresholds.maxAllowedFlushMs,
        },
      });
    }

    const sample: TickWindowSample = {
      tickIndex: this.currentTickIndex,
      tier: this.currentTier,
      scheduledDurationMs: this.lastScheduledDurationMs,
      actualDurationMs,
      driftMs,
      stepDurationsMs: { ...this.currentStepDurations },
      flushDurationMs,
      emittedEventCount: this.currentEventCount,
      openDecisionWindowCount: this.currentOpenWindowCount,
      timestamp: Date.now(),
    };

    this.history.push(sample);
    while (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.tickStartHrMs = null;
    this.flushStartHrMs = null;
    this.lastTickCompletedAtMs = sample.timestamp;

    return sample;
  }

  public getSnapshot(): OrchestratorDiagnosticsSnapshot {
    const scheduled = this.history.map((sample) => sample.scheduledDurationMs);
    const actual = this.history.map((sample) => sample.actualDurationMs);
    const drift = this.history.map((sample) => sample.driftMs);
    const flush = this.history.map((sample) => sample.flushDurationMs);
    const events = this.history.map((sample) => sample.emittedEventCount);
    const maxSingleStepMs = this.history.reduce((max, sample) => {
      const localMax = Math.max(0, ...Object.values(sample.stepDurationsMs));
      return Math.max(max, localMax);
    }, 0);

    return {
      generatedAt: Date.now(),
      totalTicksObserved: this.history.length,
      lastTickIndex: this.currentTickIndex,
      currentTier: this.currentTier,
      avgScheduledDurationMs: avg(scheduled),
      avgActualDurationMs: avg(actual),
      avgDriftMs: avg(drift),
      maxDriftMs: drift.length ? Math.max(...drift.map((value) => Math.abs(value))) : 0,
      avgFlushDurationMs: avg(flush),
      maxFlushDurationMs: flush.length ? Math.max(...flush) : 0,
      maxSingleStepMs,
      totalEventsObserved: events.reduce((sum, value) => sum + value, 0),
      avgEventsPerTick: avg(events),
      maxOpenDecisionWindowCount: this.history.length
        ? Math.max(...this.history.map((sample) => sample.openDecisionWindowCount))
        : 0,
      tierTransitionCount: this.tierTransitionCount,
      recentTierSequence: [...this.recentTiers],
      alerts: [...this.alerts],
      lastTick: this.history[this.history.length - 1] ?? null,
    };
  }

  public reset(): void {
    this.history.length = 0;
    this.recentTiers.length = 0;
    this.alerts.length = 0;
    this.tickStartHrMs = null;
    this.flushStartHrMs = null;
    this.lastScheduledDurationMs = 0;
    this.currentTickIndex = 0;
    this.currentTier = null;
    this.currentStepDurations = {};
    this.currentEventCount = 0;
    this.currentOpenWindowCount = 0;
    this.tierTransitionCount = 0;
    this.lastTickCompletedAtMs = null;
  }

  public getLastTickCompletedAtMs(): number | null {
    return this.lastTickCompletedAtMs;
  }

  private pushAlert(alert: OrchestratorAlert): void {
    this.alerts.push(alert);
    if (this.alerts.length > 64) {
      this.alerts.shift();
    }
  }
}

export default OrchestratorDiagnostics;

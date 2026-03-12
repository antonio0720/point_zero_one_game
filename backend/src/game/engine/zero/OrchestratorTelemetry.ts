// backend/src/game/engine/zero/OrchestratorTelemetry.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorTelemetry.ts
 *
 * Doctrine:
 * - telemetry is zero-owned aggregation, not engine-owned truth
 * - counts, timings, severities, and terminal summaries are accumulated here
 *   so orchestration can be observed without mutating snapshots
 * - the structure must stay lightweight, replay-safe, and deterministic
 * - no transport concerns live here; export is plain immutable data
 */

import type { EngineHealth, EngineSignal } from '../core/EngineContracts';
import type { EventEnvelope } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickTraceRecord } from '../core/TickTraceRecorder';
import type { TickStep } from '../core/TickSequence';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export interface TelemetryStepTiming {
  readonly step: TickStep;
  readonly count: number;
  readonly totalDurationMs: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly minDurationMs: number | null;
}

export interface TelemetrySeverityBreakdown {
  readonly info: number;
  readonly warn: number;
  readonly error: number;
}

export interface TelemetryTickRecord {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly checksum: string | null;
  readonly durationMs: number;
  readonly emittedEventCount: number;
  readonly warningCount: number;
  readonly signalBreakdown: TelemetrySeverityBreakdown;
  readonly capturedAtMs: number;
}

export interface OrchestratorTelemetrySnapshot {
  readonly totalTicksObserved: number;
  readonly totalSignalsObserved: number;
  readonly totalEventsObserved: number;
  readonly totalTraceRecordsObserved: number;
  readonly lastRunId: string | null;
  readonly lastTick: number | null;
  readonly lastOutcome: RunStateSnapshot['outcome'] | null;
  readonly signalBreakdown: TelemetrySeverityBreakdown;
  readonly recentTicks: readonly TelemetryTickRecord[];
  readonly stepTimings: readonly TelemetryStepTiming[];
  readonly recentWarnings: readonly string[];
  readonly lastEngineHealth: readonly EngineHealth[];
}

const EMPTY_SEVERITY: TelemetrySeverityBreakdown = Object.freeze({
  info: 0,
  warn: 0,
  error: 0,
});

export class OrchestratorTelemetry {
  private totalTicksObserved = 0;

  private totalSignalsObserved = 0;

  private totalEventsObserved = 0;

  private totalTraceRecordsObserved = 0;

  private lastRunId: string | null = null;

  private lastTick: number | null = null;

  private lastOutcome: RunStateSnapshot['outcome'] | null = null;

  private readonly recentTicks: TelemetryTickRecord[] = [];

  private readonly stepTimingMap = new Map<
    TickStep,
    {
      count: number;
      totalDurationMs: number;
      maxDurationMs: number;
      minDurationMs: number | null;
    }
  >();

  private readonly recentWarnings: string[] = [];

  private readonly severity: { info: number; warn: number; error: number } = {
    info: 0,
    warn: 0,
    error: 0,
  };

  private lastEngineHealth: readonly EngineHealth[] = freezeArray([]);

  private readonly maxRecentTicks: number;

  private readonly maxRecentWarnings: number;

  public constructor(options: {
    readonly maxRecentTicks?: number;
    readonly maxRecentWarnings?: number;
  } = {}) {
    this.maxRecentTicks = Math.max(1, options.maxRecentTicks ?? 128);
    this.maxRecentWarnings = Math.max(1, options.maxRecentWarnings ?? 256);
  }

  public recordTick(input: {
    readonly snapshot: RunStateSnapshot;
    readonly tickDurationMs: number;
    readonly signals?: readonly EngineSignal[];
    readonly events?: readonly EventEnvelope<
      keyof RuntimeEventMap,
      RuntimeEventMap[keyof RuntimeEventMap]
    >[];
    readonly capturedAtMs: number;
  }): void {
    this.totalTicksObserved += 1;
    this.lastRunId = input.snapshot.runId;
    this.lastTick = input.snapshot.tick;
    this.lastOutcome = input.snapshot.outcome;

    const signals = input.signals ?? [];
    const events = input.events ?? [];

    this.totalSignalsObserved += signals.length;
    this.totalEventsObserved += events.length;

    const signalBreakdown = this.countSeverities(signals);
    this.severity.info += signalBreakdown.info;
    this.severity.warn += signalBreakdown.warn;
    this.severity.error += signalBreakdown.error;

    for (const warning of input.snapshot.telemetry.warnings) {
      this.pushWarning(warning);
    }

    this.recentTicks.push(
      Object.freeze({
        runId: input.snapshot.runId,
        tick: input.snapshot.tick,
        phase: input.snapshot.phase,
        outcome: input.snapshot.outcome,
        checksum: input.snapshot.telemetry.lastTickChecksum,
        durationMs: input.tickDurationMs,
        emittedEventCount: input.snapshot.telemetry.emittedEventCount,
        warningCount: input.snapshot.telemetry.warnings.length,
        signalBreakdown,
        capturedAtMs: input.capturedAtMs,
      }),
    );

    while (this.recentTicks.length > this.maxRecentTicks) {
      this.recentTicks.shift();
    }
  }

  public recordStepTrace(record: TickTraceRecord): void {
    this.totalTraceRecordsObserved += 1;
    const timing = this.stepTimingMap.get(record.step) ?? {
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      minDurationMs: null,
    };

    timing.count += 1;
    timing.totalDurationMs += record.durationMs;
    timing.maxDurationMs = Math.max(timing.maxDurationMs, record.durationMs);
    timing.minDurationMs =
      timing.minDurationMs === null
        ? record.durationMs
        : Math.min(timing.minDurationMs, record.durationMs);

    this.stepTimingMap.set(record.step, timing);

    if (record.status === 'ERROR' && record.error !== undefined) {
      this.pushWarning(`[${record.step}] ${record.error}`);
    }
  }

  public recordSignal(signal: EngineSignal): void {
    this.totalSignalsObserved += 1;

    if (signal.severity === 'INFO') {
      this.severity.info += 1;
    } else if (signal.severity === 'WARN') {
      this.severity.warn += 1;
      this.pushWarning(`[${signal.engineId}] ${signal.code}: ${signal.message}`);
    } else {
      this.severity.error += 1;
      this.pushWarning(`[${signal.engineId}] ${signal.code}: ${signal.message}`);
    }
  }

  public recordSignals(signals: readonly EngineSignal[]): void {
    for (const signal of signals) {
      this.recordSignal(signal);
    }
  }

  public recordEvents(
    events: readonly EventEnvelope<
      keyof RuntimeEventMap,
      RuntimeEventMap[keyof RuntimeEventMap]
    >[],
  ): void {
    this.totalEventsObserved += events.length;
  }

  public recordEngineHealth(health: readonly EngineHealth[]): void {
    this.lastEngineHealth = freezeArray(health);
  }

  public snapshot(): OrchestratorTelemetrySnapshot {
    return Object.freeze({
      totalTicksObserved: this.totalTicksObserved,
      totalSignalsObserved: this.totalSignalsObserved,
      totalEventsObserved: this.totalEventsObserved,
      totalTraceRecordsObserved: this.totalTraceRecordsObserved,
      lastRunId: this.lastRunId,
      lastTick: this.lastTick,
      lastOutcome: this.lastOutcome,
      signalBreakdown: Object.freeze({
        info: this.severity.info,
        warn: this.severity.warn,
        error: this.severity.error,
      }),
      recentTicks: freezeArray(this.recentTicks),
      stepTimings: this.exportStepTimings(),
      recentWarnings: freezeArray(this.recentWarnings),
      lastEngineHealth: this.lastEngineHealth,
    });
  }

  public clear(): void {
    this.totalTicksObserved = 0;
    this.totalSignalsObserved = 0;
    this.totalEventsObserved = 0;
    this.totalTraceRecordsObserved = 0;
    this.lastRunId = null;
    this.lastTick = null;
    this.lastOutcome = null;
    this.recentTicks.length = 0;
    this.stepTimingMap.clear();
    this.recentWarnings.length = 0;
    this.severity.info = 0;
    this.severity.warn = 0;
    this.severity.error = 0;
    this.lastEngineHealth = freezeArray([]);
  }

  private exportStepTimings(): readonly TelemetryStepTiming[] {
    const timings: TelemetryStepTiming[] = [];

    for (const [step, value] of this.stepTimingMap.entries()) {
      timings.push(
        Object.freeze({
          step,
          count: value.count,
          totalDurationMs: value.totalDurationMs,
          avgDurationMs: value.count > 0 ? value.totalDurationMs / value.count : 0,
          maxDurationMs: value.maxDurationMs,
          minDurationMs: value.minDurationMs,
        }),
      );
    }

    timings.sort((left, right) => left.step.localeCompare(right.step));
    return freezeArray(timings);
  }

  private countSeverities(
    signals: readonly EngineSignal[],
  ): TelemetrySeverityBreakdown {
    let info = 0;
    let warn = 0;
    let error = 0;

    for (const signal of signals) {
      if (signal.severity === 'INFO') {
        info += 1;
      } else if (signal.severity === 'WARN') {
        warn += 1;
      } else {
        error += 1;
      }
    }

    return Object.freeze({ info, warn, error });
  }

  private pushWarning(warning: string): void {
    this.recentWarnings.push(warning);
    while (this.recentWarnings.length > this.maxRecentWarnings) {
      this.recentWarnings.shift();
    }
  }
}
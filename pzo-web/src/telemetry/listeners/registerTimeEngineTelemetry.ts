// pzo-web/src/telemetry/listeners/registerTimeEngineTelemetry.ts

import type { EventBus } from '../../engines/core/EventBus';
import {
  coerceTickTierId,
  createEmptyTelemetryEnvelope,
  type TelemetryEnvelopeV2,
  type TickTierId,
  type TierTransitionRecord,
} from '../../engines/time/types';
import { TimeEngineTelemetry } from '../schemas/timeEngineTelemetry';

export const timeEngineMetrics = new Map<string, TimeEngineTelemetry>();

interface EventEnvelope<TPayload = Record<string, unknown>> {
  eventType: string;
  payload: TPayload;
  tickIndex: number;
  timestamp: number;
  sourceEngine?: string;
}

interface DecisionWindowRecord {
  windowId: string;
  openedAtMs: number;
  tierAtOpen: TickTierId;
}

export interface TimeEngineTelemetryCollector {
  setRunId(runId: string): void;
  getRunId(): string | null;
  snapshot(): TimeEngineTelemetry;
  reset(runId?: string): void;
}

let activeCollector: InternalCollector | null = null;

class InternalCollector implements TimeEngineTelemetryCollector {
  private runId: string | null;
  private envelope: TelemetryEnvelopeV2;
  private readonly openDecisionWindows = new Map<string, DecisionWindowRecord>();
  private currentTier: TickTierId = 'T1';
  private currentTickIndex = 0;
  private totalResolvedLatencyMs = 0;

  public constructor(runId?: string) {
    this.runId = runId ?? null;
    this.envelope = createEmptyTelemetryEnvelope();
  }

  public setRunId(runId: string): void {
    this.runId = runId;
  }

  public getRunId(): string | null {
    return this.runId;
  }

  public noteRunStarted(payload: Record<string, unknown>, timestamp: number): void {
    const maybeRunId = readString(payload.runId);
    if (maybeRunId) {
      this.runId = maybeRunId;
    }

    this.currentTier = coerceTickTierId(payload.tickTier ?? payload.initialTier, this.currentTier);
    this.envelope.runTimeoutFlags.runStartedAtMs ??= timestamp;
    this.envelope.runTimeoutFlags.completed = false;
    this.envelope.runTimeoutFlags.completionReason = null;
  }

  public noteTick(payload: Record<string, unknown>): void {
    const nextTier = coerceTickTierId(payload.tickTier, this.currentTier);
    this.currentTier = nextTier;
    this.currentTickIndex = readNumber(payload.tickIndex, this.currentTickIndex + 1);
    this.envelope.tickTierDwell[nextTier] += 1;
    this.envelope.runTimeoutFlags.timeoutImminent = readBoolean(
      payload.timeoutImminent,
      this.envelope.runTimeoutFlags.timeoutImminent,
    );
  }

  public noteTierTransition(payload: Record<string, unknown>, timestamp: number): void {
    const transition: TierTransitionRecord = {
      tickIndex: readNumber(payload.tickIndex, this.currentTickIndex),
      fromTier: coerceTickTierId(payload.previousTier, this.currentTier),
      toTier: coerceTickTierId(payload.newTier, this.currentTier),
      pressureScore: readNumber(payload.pressureScore, 0),
      previousDurationMs: readNumber(payload.previousDuration, 0),
      newDurationMs: readNumber(payload.newDuration, 0),
      multiplier: readNumber(payload.multiplier, 1),
      timestamp,
    };

    this.currentTier = transition.toTier;
    this.envelope.tierTransitions.push(transition);
  }

  public noteTimeout(timestamp: number): void {
    this.envelope.runTimeoutFlags.timeoutOccurred = true;
    this.envelope.runTimeoutFlags.timeoutImminent = true;
    this.envelope.runTimeoutFlags.completed = true;
    this.envelope.runTimeoutFlags.completionReason = 'TIMEOUT';
    this.envelope.runTimeoutFlags.runCompletedAtMs = timestamp;
  }

  public noteRunCompleted(payload: Record<string, unknown>, timestamp: number): void {
    const maybeRunId = readString(payload.runId);
    if (maybeRunId) {
      this.runId = maybeRunId;
    }

    this.envelope.runTimeoutFlags.completed = true;
    this.envelope.runTimeoutFlags.completionReason = this.envelope.runTimeoutFlags.timeoutOccurred
      ? 'TIMEOUT'
      : readCompletionReason(payload.reason);
    this.envelope.runTimeoutFlags.runCompletedAtMs = timestamp;
  }

  public recordDecisionWindowOpened(payload: Record<string, unknown>, timestamp: number): void {
    const windowId = readWindowId(payload, `window:${this.currentTickIndex}:${timestamp}`);

    this.openDecisionWindows.set(windowId, {
      windowId,
      openedAtMs: timestamp,
      tierAtOpen: this.currentTier,
    });

    this.envelope.decisionWindowLifecycleMetrics.openedTotal += 1;
    this.envelope.decisionWindowLifecycleMetrics.tierAtOpenCounts[this.currentTier] += 1;
  }

  public recordDecisionWindowClosed(payload: Record<string, unknown>, timestamp: number): void {
    const windowId = readWindowId(payload, '');
    const record = windowId ? this.openDecisionWindows.get(windowId) : undefined;

    this.envelope.decisionWindowLifecycleMetrics.resolvedTotal += 1;
    this.envelope.decisionWindowLifecycleMetrics.tierAtResolveCounts[this.currentTier] += 1;

    if (readBoolean(payload.autoResolved, false) || readString(payload.reason) === 'AUTO_RESOLVE') {
      this.envelope.decisionWindowLifecycleMetrics.autoResolvedTotal += 1;
    }

    if (record) {
      const latencyMs = Math.max(0, timestamp - record.openedAtMs);
      this.totalResolvedLatencyMs += latencyMs;

      this.envelope.decisionWindowLifecycleMetrics.avgOpenToResolveLatencyMs =
        this.totalResolvedLatencyMs /
        this.envelope.decisionWindowLifecycleMetrics.resolvedTotal;

      this.envelope.decisionWindowLifecycleMetrics.maxOpenToResolveLatencyMs = Math.max(
        this.envelope.decisionWindowLifecycleMetrics.maxOpenToResolveLatencyMs,
        latencyMs,
      );

      this.openDecisionWindows.delete(record.windowId);
    }
  }

  public recordDecisionWindowExpired(payload: Record<string, unknown>): void {
    const windowId = readWindowId(payload, '');

    this.envelope.decisionWindowLifecycleMetrics.expiredTotal += 1;
    this.envelope.decisionWindowLifecycleMetrics.tierAtExpiryCounts[this.currentTier] += 1;

    if (windowId) {
      this.openDecisionWindows.delete(windowId);
    }
  }

  public recordHoldPlaced(): void {
    this.envelope.decisionWindowLifecycleMetrics.holdUsedTotal += 1;
  }

  public snapshot(): TimeEngineTelemetry {
    return new TimeEngineTelemetry(this.envelope);
  }

  public persist(): void {
    const runId = this.runId ?? `anonymous:${timeEngineMetrics.size + 1}`;
    timeEngineMetrics.set(runId, this.snapshot());
  }

  public reset(runId?: string): void {
    this.runId = runId ?? null;
    this.envelope = createEmptyTelemetryEnvelope();
    this.openDecisionWindows.clear();
    this.currentTier = 'T1';
    this.currentTickIndex = 0;
    this.totalResolvedLatencyMs = 0;
  }
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readWindowId(payload: Record<string, unknown>, fallback: string): string {
  return (
    readString(payload.windowId) ??
    readString(payload.cardWindowId) ??
    readString(payload.cardId) ??
    readString(payload.id) ??
    fallback
  );
}

function readCompletionReason(
  value: unknown,
): 'TIMEOUT' | 'RUN_ENDED' | 'ABANDONED' | 'UNKNOWN' {
  if (value === 'TIMEOUT' || value === 'RUN_ENDED' || value === 'ABANDONED') {
    return value;
  }

  return 'UNKNOWN';
}

export function createTimeEngineTelemetryCollector(initialRunId?: string): TimeEngineTelemetryCollector {
  return new InternalCollector(initialRunId);
}

export function setActiveTimeEngineTelemetryCollector(
  collector: TimeEngineTelemetryCollector | null,
): void {
  activeCollector = collector instanceof InternalCollector ? collector : null;
}

export function trackDecisionWindowSLATrigger(): void {
  activeCollector?.persist();
}

export function registerTimeEngineTelemetry(
  eventBus: EventBus,
  collector: TimeEngineTelemetryCollector = createTimeEngineTelemetryCollector(),
): () => void {
  const internalCollector = collector instanceof InternalCollector
    ? collector
    : new InternalCollector(collector.getRunId() ?? undefined);

  activeCollector = internalCollector;

  const unsubscribers = [
    eventBus.on<Record<string, unknown>>('RUN_STARTED', (event: EventEnvelope) => {
      internalCollector.noteRunStarted(event.payload, event.timestamp);
    }),
    eventBus.on<Record<string, unknown>>('TIME_ENGINE_START', (event: EventEnvelope) => {
      internalCollector.noteRunStarted(event.payload, event.timestamp);
    }),
    eventBus.on<Record<string, unknown>>('TICK_START', (event: EventEnvelope) => {
      internalCollector.noteTick(event.payload);
    }),
    eventBus.on<Record<string, unknown>>('TIME_ENGINE_TICK', (event: EventEnvelope) => {
      internalCollector.noteTick(event.payload);
    }),
    eventBus.on<Record<string, unknown>>('TICK_TIER_CHANGED', (event: EventEnvelope) => {
      internalCollector.noteTierTransition(event.payload, event.timestamp);
    }),
    eventBus.on<Record<string, unknown>>('TIME_TIER_CHANGED', (event: EventEnvelope) => {
      internalCollector.noteTierTransition(event.payload, event.timestamp);
    }),
    eventBus.on<Record<string, unknown>>('CARD_WINDOW_OPENED', (event: EventEnvelope) => {
      internalCollector.recordDecisionWindowOpened(event.payload, event.timestamp);
    }),
    eventBus.on<Record<string, unknown>>('CARD_WINDOW_CLOSED', (event: EventEnvelope) => {
      internalCollector.recordDecisionWindowClosed(event.payload, event.timestamp);
    }),
    eventBus.on<Record<string, unknown>>('CARD_WINDOW_EXPIRED', (event: EventEnvelope) => {
      internalCollector.recordDecisionWindowExpired(event.payload);
    }),
    eventBus.on<Record<string, unknown>>('CARD_HOLD_PLACED', () => {
      internalCollector.recordHoldPlaced();
    }),
    eventBus.on<Record<string, unknown>>('SEASON_TIMEOUT', (event: EventEnvelope) => {
      internalCollector.noteTimeout(event.timestamp);
      internalCollector.persist();
    }),
    eventBus.on<Record<string, unknown>>('TIME_ENGINE_COMPLETE', (event: EventEnvelope) => {
      internalCollector.noteRunCompleted(event.payload, event.timestamp);
      internalCollector.persist();
    }),
    eventBus.on<Record<string, unknown>>('RUN_ENDED', (event: EventEnvelope) => {
      internalCollector.noteRunCompleted(event.payload, event.timestamp);
      internalCollector.persist();
    }),
  ];

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }

    if (activeCollector === internalCollector) {
      activeCollector = null;
    }
  };
}
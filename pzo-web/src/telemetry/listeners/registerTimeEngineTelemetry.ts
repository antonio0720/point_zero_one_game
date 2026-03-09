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

    if (maybeRunId && maybeRunId !== this.runId) {
      this.reset(maybeRunId);
    } else if (maybeRunId) {
      this.runId = maybeRunId;
    }

    this.envelope.runTimeoutFlags.runStartedAtMs = timestamp;
    this.envelope.runTimeoutFlags.runCompletedAtMs = null;
    this.envelope.runTimeoutFlags.timeoutOccurred = false;
    this.envelope.runTimeoutFlags.timeoutImminent = false;
    this.envelope.runTimeoutFlags.completed = false;
    this.envelope.runTimeoutFlags.completionReason = null;
  }

  public noteTick(payload: Record<string, unknown>): void {
    this.currentTickIndex = readNumber(payload.tickIndex, this.currentTickIndex + 1);
    this.envelope.tickTierDwell[this.currentTier] += 1;
  }

  public noteTierTransition(payload: Record<string, unknown>, timestamp: number): void {
    const fromTier = coerceTickTierId(payload.from ?? payload.previousTier ?? payload.fromTier, this.currentTier);
    const toTier = coerceTickTierId(payload.to ?? payload.newTier ?? payload.toTier, this.currentTier);

    const transition: TierTransitionRecord = {
      tickIndex: this.currentTickIndex,
      fromTier,
      toTier,
      pressureScore: readNumber(payload.pressureScore ?? payload.score, 0),
      previousDurationMs: readNumber(payload.previousDuration ?? payload.previousDurationMs, 0),
      newDurationMs: readNumber(payload.newDuration ?? payload.newDurationMs, 0),
      multiplier: readNumber(payload.multiplier, 1),
      timestamp,
    };

    this.currentTier = toTier;
    this.envelope.tierTransitions.push(transition);
  }

  public noteTimeoutImminent(): void {
    this.envelope.runTimeoutFlags.timeoutImminent = true;
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

    const completionReason = readCompletionReasonFromPayload(payload);

    this.envelope.runTimeoutFlags.completed = true;
    this.envelope.runTimeoutFlags.completionReason = completionReason;
    this.envelope.runTimeoutFlags.runCompletedAtMs = timestamp;

    if (completionReason === 'TIMEOUT') {
      this.envelope.runTimeoutFlags.timeoutOccurred = true;
      this.envelope.runTimeoutFlags.timeoutImminent = true;
    }
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

  public recordDecisionWindowResolved(payload: Record<string, unknown>, timestamp: number): void {
    const windowId = readWindowId(payload, '');
    const record = windowId ? this.openDecisionWindows.get(windowId) : undefined;

    this.envelope.decisionWindowLifecycleMetrics.resolvedTotal += 1;
    this.envelope.decisionWindowLifecycleMetrics.tierAtResolveCounts[this.currentTier] += 1;

    const payloadResolvedInMs = readNumber(payload.resolvedInMs, -1);

    if (record) {
      const latencyMs =
        payloadResolvedInMs >= 0
          ? payloadResolvedInMs
          : Math.max(0, timestamp - record.openedAtMs);

      this.totalResolvedLatencyMs += latencyMs;

      this.envelope.decisionWindowLifecycleMetrics.avgOpenToResolveLatencyMs =
        this.totalResolvedLatencyMs /
        this.envelope.decisionWindowLifecycleMetrics.resolvedTotal;

      this.envelope.decisionWindowLifecycleMetrics.maxOpenToResolveLatencyMs = Math.max(
        this.envelope.decisionWindowLifecycleMetrics.maxOpenToResolveLatencyMs,
        latencyMs,
      );

      this.openDecisionWindows.delete(record.windowId);
      return;
    }

    if (payloadResolvedInMs >= 0) {
      this.totalResolvedLatencyMs += payloadResolvedInMs;

      this.envelope.decisionWindowLifecycleMetrics.avgOpenToResolveLatencyMs =
        this.totalResolvedLatencyMs /
        this.envelope.decisionWindowLifecycleMetrics.resolvedTotal;

      this.envelope.decisionWindowLifecycleMetrics.maxOpenToResolveLatencyMs = Math.max(
        this.envelope.decisionWindowLifecycleMetrics.maxOpenToResolveLatencyMs,
        payloadResolvedInMs,
      );
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

  public recordAutoResolved(): void {
    this.envelope.decisionWindowLifecycleMetrics.autoResolvedTotal += 1;
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

function toPayloadRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readWindowId(payload: Record<string, unknown>, fallback: string): string {
  return (
    readString(payload.instanceId) ??
    readString(payload.cardId) ??
    readString(payload.windowId) ??
    readString(payload.cardWindowId) ??
    readString(payload.entryId) ??
    readString(payload.triggerAttackId) ??
    readString(payload.teammateId) ??
    readString(payload.id) ??
    fallback
  );
}

function readCompletionReasonFromPayload(
  payload: Record<string, unknown>,
): 'TIMEOUT' | 'RUN_ENDED' | 'ABANDONED' | 'UNKNOWN' {
  const outcome = readString(payload.outcome);
  const reason = readString(payload.reason);

  if (outcome === 'TIMEOUT' || reason === 'TIMEOUT') {
    return 'TIMEOUT';
  }

  if (outcome === 'ABANDONED' || reason === 'ABANDONED') {
    return 'ABANDONED';
  }

  if (
    outcome === 'FREEDOM' ||
    outcome === 'BANKRUPT' ||
    reason === 'RUN_ENDED' ||
    reason === 'RUN_COMPLETED'
  ) {
    return 'RUN_ENDED';
  }

  return 'UNKNOWN';
}

export function createTimeEngineTelemetryCollector(
  initialRunId?: string,
): TimeEngineTelemetryCollector {
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
  const internalCollector =
    collector instanceof InternalCollector
      ? collector
      : new InternalCollector(collector.getRunId() ?? undefined);

  activeCollector = internalCollector;

  const unsubscribers = [
    eventBus.on('RUN_STARTED', (event) => {
      internalCollector.noteRunStarted(toPayloadRecord(event.payload), event.timestamp);
    }),

    eventBus.on('TICK_START', (event) => {
      internalCollector.noteTick(toPayloadRecord(event.payload));
    }),

    eventBus.on('TICK_TIER_CHANGED', (event) => {
      internalCollector.noteTierTransition(toPayloadRecord(event.payload), event.timestamp);
    }),

    eventBus.on('DECISION_WINDOW_OPENED', (event) => {
      internalCollector.recordDecisionWindowOpened(
        toPayloadRecord(event.payload),
        event.timestamp,
      );
    }),

    eventBus.on('DECISION_WINDOW_RESOLVED', (event) => {
      internalCollector.recordDecisionWindowResolved(
        toPayloadRecord(event.payload),
        event.timestamp,
      );
    }),

    eventBus.on('DECISION_WINDOW_EXPIRED', (event) => {
      internalCollector.recordDecisionWindowExpired(toPayloadRecord(event.payload));
    }),

    eventBus.on('CARD_AUTO_RESOLVED', () => {
      internalCollector.recordAutoResolved();
    }),

    eventBus.on('CARD_HELD', () => {
      internalCollector.recordHoldPlaced();
    }),

    eventBus.on('SEASON_TIMEOUT_IMMINENT', () => {
      internalCollector.noteTimeoutImminent();
    }),

    eventBus.on('RUN_ENDED', (event) => {
      internalCollector.noteRunCompleted(toPayloadRecord(event.payload), event.timestamp);
      internalCollector.persist();
    }),

    eventBus.on('RUN_COMPLETED', () => {
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
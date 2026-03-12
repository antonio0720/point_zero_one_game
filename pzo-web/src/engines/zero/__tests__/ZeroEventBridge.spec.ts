// pzo-web/src/engines/zero/__tests__/ZeroEventBridge.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

type ObservedEvent = {
  eventType: string;
  payload?: unknown;
  tickIndex?: number;
  timestamp?: number;
  sourceEngine?: string;
};

function createEventBusMock() {
  const handlers = new Map<string, Set<(event: ObservedEvent) => void>>();

  return {
    on: vi.fn((eventType: string, handler: (event: ObservedEvent) => void) => {
      if (!handlers.has(eventType)) {
        handlers.set(eventType, new Set());
      }
      handlers.get(eventType)!.add(handler);

      return () => {
        handlers.get(eventType)?.delete(handler);
      };
    }),
    emitTo(eventType: string, event: Omit<ObservedEvent, 'eventType'> = {}) {
      for (const handler of handlers.get(eventType) ?? []) {
        handler({
          eventType,
          payload: event.payload,
          tickIndex: event.tickIndex ?? 0,
          timestamp: event.timestamp ?? Date.now(),
          sourceEngine: event.sourceEngine,
        });
      }
    },
    getHandlerCount(eventType: string) {
      return handlers.get(eventType)?.size ?? 0;
    },
  };
}

vi.mock('../core/EventBus', () => ({
  sharedEventBus: createEventBusMock(),
}));

import { ZeroEventBridge, zeroEventBridge } from '../ZeroEventBridge';

function buildBridge() {
  return new ZeroEventBridge({
    maxHistory: 5,
  });
}

describe('ZeroEventBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a singleton event bridge instance', () => {
    expect(zeroEventBridge).toBeInstanceOf(ZeroEventBridge);
  });

  it('attaches to canonical Engine 0 event channels and observes live traffic', () => {
    const bus = createEventBusMock();
    const bridge = buildBridge();

    bridge.attach({
      eventBus: bus as any,
      scope: 'ALL',
      channels: ['RUN_STARTED', 'TICK_COMPLETE', 'TICK_STEP_ERROR'],
    });

    expect(bus.on).toHaveBeenCalledTimes(3);
    expect(bus.getHandlerCount('RUN_STARTED')).toBe(1);
    expect(bus.getHandlerCount('TICK_COMPLETE')).toBe(1);
    expect(bus.getHandlerCount('TICK_STEP_ERROR')).toBe(1);

    bus.emitTo('RUN_STARTED', {
      payload: { runId: 'run_001' },
      tickIndex: 0,
      timestamp: 10,
    });
    bus.emitTo('TICK_COMPLETE', {
      payload: { tickIndex: 1, outcome: null },
      tickIndex: 1,
      timestamp: 20,
      sourceEngine: 'TIME_ENGINE',
    });
    bus.emitTo('TICK_STEP_ERROR', {
      payload: { step: 4, error: 'shield fault' },
      tickIndex: 1,
      timestamp: 21,
      sourceEngine: 'SHIELD_ENGINE',
    });

    expect(bridge.getObservedHistory()).toEqual([
      expect.objectContaining({
        scope: 'ALL',
        event: expect.objectContaining({
          eventType: 'RUN_STARTED',
          tickIndex: 0,
        }),
      }),
      expect.objectContaining({
        scope: 'ALL',
        event: expect.objectContaining({
          eventType: 'TICK_COMPLETE',
          sourceEngine: 'TIME_ENGINE',
        }),
      }),
      expect.objectContaining({
        scope: 'ALL',
        event: expect.objectContaining({
          eventType: 'TICK_STEP_ERROR',
          sourceEngine: 'SHIELD_ENGINE',
        }),
      }),
    ]);

    expect(bridge.getMetrics()).toEqual({
      totalObserved: 3,
      byEventType: {
        RUN_STARTED: 1,
        TICK_COMPLETE: 1,
        TICK_STEP_ERROR: 1,
      },
      bySourceEngine: {
        UNKNOWN: 1,
        TIME_ENGINE: 1,
        SHIELD_ENGINE: 1,
      },
      lastObservedAt: 21,
    });
  });

  it('supports targeted channel observation without inventing duplicate EventBus layers', () => {
    const bus = createEventBusMock();
    const bridge = buildBridge();

    bridge.attach({
      eventBus: bus as any,
      scope: 'LIFECYCLE',
      channels: ['RUN_STARTED', 'RUN_ENDED'],
    });

    bus.emitTo('RUN_STARTED', {
      payload: { runId: 'run_life_001' },
      tickIndex: 0,
      timestamp: 100,
    });
    bus.emitTo('TICK_COMPLETE', {
      payload: { tickIndex: 1 },
      tickIndex: 1,
      timestamp: 101,
    });
    bus.emitTo('RUN_ENDED', {
      payload: { outcome: 'FREEDOM' },
      tickIndex: 8,
      timestamp: 102,
    });

    expect(bridge.getObservedHistory()).toEqual([
      expect.objectContaining({
        scope: 'LIFECYCLE',
        event: expect.objectContaining({
          eventType: 'RUN_STARTED',
        }),
      }),
      expect.objectContaining({
        scope: 'LIFECYCLE',
        event: expect.objectContaining({
          eventType: 'RUN_ENDED',
        }),
      }),
    ]);

    expect(bridge.getMetrics()).toEqual({
      totalObserved: 2,
      byEventType: {
        RUN_STARTED: 1,
        RUN_ENDED: 1,
      },
      bySourceEngine: {
        UNKNOWN: 2,
      },
      lastObservedAt: 102,
    });
  });

  it('caps observed history at the configured maxHistory while retaining aggregate metrics', () => {
    const bus = createEventBusMock();
    const bridge = new ZeroEventBridge({
      maxHistory: 3,
    });

    bridge.attach({
      eventBus: bus as any,
      scope: 'ALL',
      channels: ['RUN_STARTED'],
    });

    bus.emitTo('RUN_STARTED', { payload: { seq: 1 }, timestamp: 1 });
    bus.emitTo('RUN_STARTED', { payload: { seq: 2 }, timestamp: 2 });
    bus.emitTo('RUN_STARTED', { payload: { seq: 3 }, timestamp: 3 });
    bus.emitTo('RUN_STARTED', { payload: { seq: 4 }, timestamp: 4 });

    expect(bridge.getObservedHistory()).toHaveLength(3);
    expect(
      bridge
        .getObservedHistory()
        .map((entry) => (entry.event.payload as { seq: number }).seq),
    ).toEqual([2, 3, 4]);

    expect(bridge.getMetrics()).toEqual({
      totalObserved: 4,
      byEventType: {
        RUN_STARTED: 4,
      },
      bySourceEngine: {
        UNKNOWN: 4,
      },
      lastObservedAt: 4,
    });
  });

  it('supports limited-history reads for devtools and diagnostics callers', () => {
    const bus = createEventBusMock();
    const bridge = buildBridge();

    bridge.attach({
      eventBus: bus as any,
      scope: 'ALL',
      channels: ['RUN_STARTED', 'RUN_ENDED'],
    });

    bus.emitTo('RUN_STARTED', { payload: { seq: 1 }, timestamp: 1 });
    bus.emitTo('RUN_ENDED', { payload: { seq: 2 }, timestamp: 2 });
    bus.emitTo('RUN_STARTED', { payload: { seq: 3 }, timestamp: 3 });

    expect(bridge.getObservedHistory(2)).toEqual([
      expect.objectContaining({
        event: expect.objectContaining({
          eventType: 'RUN_ENDED',
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          eventType: 'RUN_STARTED',
        }),
      }),
    ]);
  });

  it('clears retained observed history without losing aggregate counters', () => {
    const bus = createEventBusMock();
    const bridge = buildBridge();

    bridge.attach({
      eventBus: bus as any,
      scope: 'ALL',
      channels: ['RUN_STARTED'],
    });

    bus.emitTo('RUN_STARTED', { payload: { runId: 'run_clear_001' }, timestamp: 77 });

    expect(bridge.getObservedHistory()).toHaveLength(1);

    bridge.clearObservedHistory();

    expect(bridge.getObservedHistory()).toEqual([]);
    expect(bridge.getMetrics()).toEqual({
      totalObserved: 1,
      byEventType: {
        RUN_STARTED: 1,
      },
      bySourceEngine: {
        UNKNOWN: 1,
      },
      lastObservedAt: 77,
    });
  });

  it('detaches all live subscriptions and stops observing new traffic', () => {
    const bus = createEventBusMock();
    const bridge = buildBridge();

    bridge.attach({
      eventBus: bus as any,
      scope: 'ALL',
      channels: ['RUN_STARTED', 'RUN_ENDED'],
    });

    expect(bus.getHandlerCount('RUN_STARTED')).toBe(1);
    expect(bus.getHandlerCount('RUN_ENDED')).toBe(1);

    bridge.detach();

    expect(bus.getHandlerCount('RUN_STARTED')).toBe(0);
    expect(bus.getHandlerCount('RUN_ENDED')).toBe(0);

    bus.emitTo('RUN_STARTED', { payload: { ignored: true }, timestamp: 999 });

    expect(bridge.getObservedHistory()).toEqual([]);
    expect(bridge.getMetrics()).toEqual({
      totalObserved: 0,
      byEventType: {},
      bySourceEngine: {},
      lastObservedAt: null,
    });
  });

  it('dispose() behaves as a hard detach for singleton-safe teardown', () => {
    const bus = createEventBusMock();
    const bridge = buildBridge();

    bridge.attach({
      eventBus: bus as any,
      scope: 'ALL',
      channels: ['RUN_STARTED'],
    });

    bridge.dispose();

    expect(bus.getHandlerCount('RUN_STARTED')).toBe(0);
    expect(bridge.getObservedHistory()).toEqual([]);
    expect(bridge.getMetrics()).toEqual({
      totalObserved: 0,
      byEventType: {},
      bySourceEngine: {},
      lastObservedAt: null,
    });
  });
});
/**
 * ============================================================================
 * FILE: pzo-web/src/engines/core/__tests__/EventBus.integration.spec.ts
 * ============================================================================
 *
 * Purpose:
 * - harden the Engine 0 EventBus integration boundary in the current repo shape
 * - verify that core/EventBus preserves zero/EventBus queue / flush semantics
 * - verify that the compatibility bridge surface (registry/register/unregister)
 *   behaves correctly against the inherited zero/EventBus implementation
 *
 * Doctrine:
 * - test real queueing / flush behavior, not mocks of EventBus internals
 * - assert deterministic tick-:contentReference[oaicite:0]{index=0} assert compatibility bridge behavior explicitly, including detach semantics
 *
 * NOTE:
 * - one test below is intentionally strict about unregister() fully detaching
 *   listeners from inherited dispatch. That is the correct contract.
 * - if it fails against the current bridge, fix core/EventBus.ts by storing and
 *   invoking unsubscribe closures returned from zero/EventBus.on().
 * ============================================================================
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import EventBus, { sharedEventBus } from '../EventBus';
import { EngineId, PressureTier } from '../../zero/types';

type TickCompletePayload = {
  tickIndex: number;
  tickDurationMs: number;
  outcome: null;
};

function makeTickCompletePayload(
  tickIndex: number,
  tickDurationMs = 600,
): TickCompletePayload {
  return {
    tickIndex,
    tickDurationMs,
    outcome: null,
  };
}

describe('core/EventBus — integration contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sharedEventBus.reset();
  });

  it('queues inherited zero-bus events and dispatches them only on flush', () => {
    const bus = new EventBus();
    const received: Array<unknown> = [];

    bus.on('TICK_COMPLETE', (event) => {
      received.push(event);
    });

    bus.setTickContext(7);
    bus.emit('TICK_COMPLETE', makeTickCompletePayload(7));

    expect(received).toHaveLength(0);
    expect(bus.getPendingCount()).toBe(1);

    const pending = bus.getPendingSnapshot();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual(
      expect.objectContaining({
        eventType: 'TICK_COMPLETE',
        tickIndex: 7,
        payload: makeTickCompletePayload(7),
      }),
    );

    bus.flush();

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(
      expect.objectContaining({
        eventType: 'TICK_COMPLETE',
        tickIndex: 7,
        payload: makeTickCompletePayload(7),
      }),
    );
    expect(bus.getPendingCount()).toBe(0);
  });

  it('dispatches safety events immediately and does not queue them', () => {
    const bus = new EventBus();
    const received: Array<unknown> = [];

    bus.on('TICK_STEP_ERROR', (event) => {
      received.push(event);
    });

    bus.setTickContext(12);
    bus.emit('TICK_STEP_ERROR', {
      step: 4,
      engineId: EngineId.TIME,
      error: 'step-4 exploded',
    });

    expect(received).toHaveLength(1);
    expect(bus.getPendingCount()).toBe(0);
    expect(received[0]).toEqual(
      expect.objectContaining({
        eventType: 'TICK_STEP_ERROR',
        tickIndex: 12,
        payload: {
          step: 4,
          engineId: EngineId.TIME,
          error: 'step-4 exploded',
        },
      }),
    );
  });

  it('stamps queued envelopes with the current tick context', () => {
    const bus = new EventBus();

    bus.setTickContext(23);
    bus.emit('PRESSURE_SCORE_UPDATED', {
      score: 0.91,
      tier: PressureTier.CRITICAL,
      tickIndex: 23,
    });

    const [pending] = bus.getPendingSnapshot();

    expect(pending).toEqual(
      expect.objectContaining({
        eventType: 'PRESSURE_SCORE_UPDATED',
        tickIndex: 23,
        payload: {
          score: 0.91,
          tier: PressureTier.CRITICAL,
          tickIndex: 23,
        },
      }),
    );
  });

  it('defers events emitted during flush into the next flush pass', () => {
    const bus = new EventBus();
    const pressureEvents: Array<unknown> = [];

    bus.on('TICK_COMPLETE', () => {
      bus.emit('PRESSURE_SCORE_UPDATED', {
        score: 0.73,
        tier: PressureTier.HIGH,
        tickIndex: 3,
      });
    });

    bus.on('PRESSURE_SCORE_UPDATED', (event) => {
      pressureEvents.push(event);
    });

    bus.setTickContext(3);
    bus.emit('TICK_COMPLETE', makeTickCompletePayload(3));

    bus.flush();

    expect(pressureEvents).toHaveLength(0);
    expect(bus.getPendingCount()).toBe(1);
    expect(bus.getPendingSnapshot()[0]).toEqual(
      expect.objectContaining({
        eventType: 'PRESSURE_SCORE_UPDATED',
        tickIndex: 3,
        payload: {
          score: 0.73,
          tier: PressureTier.HIGH,
          tickIndex: 3,
        },
      }),
    );

    bus.flush();

    expect(pressureEvents).toHaveLength(1);
    expect(bus.getPendingCount()).toBe(0);
    expect(pressureEvents[0]).toEqual(
      expect.objectContaining({
        eventType: 'PRESSURE_SCORE_UPDATED',
        tickIndex: 3,
      }),
    );
  });

  it('guards re-entrant flush and does not duplicate delivery', () => {
    const bus = new EventBus();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const delivered: string[] = [];

    bus.on('TICK_COMPLETE', () => {
      delivered.push('outer-dispatch');
      bus.flush();
    });

    bus.setTickContext(1);
    bus.emit('TICK_COMPLETE', makeTickCompletePayload(1));

    bus.flush();

    expect(delivered).toEqual(['outer-dispatch']);
    expect(bus.getPendingCount()).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Re-entrant flush() detected'),
    );
  });

  it('clearQueue drops queued work without removing live subscribers', () => {
    const bus = new EventBus();
    const delivered: Array<unknown> = [];

    bus.on('TICK_COMPLETE', (event) => {
      delivered.push(event);
    });

    bus.setTickContext(4);
    bus.emit('TICK_COMPLETE', makeTickCompletePayload(4));
    expect(bus.getPendingCount()).toBe(1);

    bus.clearQueue();
    expect(bus.getPendingCount()).toBe(0);

    bus.flush();
    expect(delivered).toHaveLength(0);

    bus.emit('TICK_COMPLETE', makeTickCompletePayload(5));
    bus.flush();

    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toEqual(
      expect.objectContaining({
        eventType: 'TICK_COMPLETE',
        tickIndex: 4,
      }),
    );
  });

  it('registerEventChannels records channels exactly once and does not overwrite first registration', () => {
    const bus = new EventBus();

    bus.registerEventChannels([
      {
        name: 'TICK_COMPLETE',
        description: 'first-definition',
        maxListeners: 10,
      },
      {
        name: 'TICK_COMPLETE',
        description: 'should-not-overwrite',
        maxListeners: 999,
      },
      {
        name: 'SHIELD_LAYER_BREACHED',
        description: 'shield-bridge',
      },
    ]);

    expect(bus.isRegistered('TICK_COMPLETE')).toBe(true);
    expect(bus.isRegistered('SHIELD_LAYER_BREACHED')).toBe(true);
    expect(bus.isRegistered('NOT_A_REAL_EVENT')).toBe(false);

    expect(bus.getRegisteredChannels()).toEqual([
      'TICK_COMPLETE',
      'SHIELD_LAYER_BREACHED',
    ]);

    expect(bus.eventRegistry.get('TICK_COMPLETE')).toEqual({
      name: 'TICK_COMPLETE',
      description: 'first-definition',
      maxListeners: 10,
    });
  });

  it('register wires compatibility handlers into inherited emit + flush delivery', () => {
    const bus = new EventBus();
    const received: Array<Record<string, unknown>> = [];

    const handler = vi.fn((payload: Record<string, unknown>) => {
      received.push(payload);
    });

    bus.registerEventChannels([{ name: 'TICK_COMPLETE' }]);
    bus.register('TICK_COMPLETE', handler);

    expect(bus.handlers.get('TICK_COMPLETE')).toHaveLength(1);

    bus.setTickContext(9);
    bus.emit('TICK_COMPLETE', makeTickCompletePayload(9));

    expect(handler).not.toHaveBeenCalled();

    bus.flush();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(
      expect.objectContaining({
        eventType: 'TICK_COMPLETE',
        tickIndex: 9,
        payload: makeTickCompletePayload(9),
      }),
    );
  });

  it('supports multiple compatibility handlers for the same event in registration order', () => {
    const bus = new EventBus();
    const callOrder: string[] = [];

    bus.register('TICK_COMPLETE', () => {
      callOrder.push('first');
    });

    bus.register('TICK_COMPLETE', () => {
      callOrder.push('second');
    });

    expect(bus.handlers.get('TICK_COMPLETE')).toHaveLength(2);

    bus.setTickContext(2);
    bus.emit('TICK_COMPLETE', makeTickCompletePayload(2));
    bus.flush();

    expect(callOrder).toEqual(['first', 'second']);
  });

  it('unregister detaches a compatibility handler from future inherited deliveries', () => {
    const bus = new EventBus();
    const received: Array<Record<string, unknown>> = [];

    const handler = vi.fn((payload: Record<string, unknown>) => {
      received.push(payload);
    });

    bus.register('TICK_COMPLETE', handler);

    bus.setTickContext(11);
    bus.emit('TICK_COMPLETE', makeTickCompletePayload(11));
    bus.flush();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(1);

    bus.unregister('TICK_COMPLETE', handler);

    expect(bus.handlers.get('TICK_COMPLETE')).toEqual([]);

    bus.emit('TICK_COMPLETE', makeTickCompletePayload(12));
    bus.flush();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(1);
  });

  it('reset removes queue state and live inherited subscribers', () => {
    const bus = new EventBus();
    const delivered: Array<unknown> = [];

    bus.on('TICK_COMPLETE', (event) => {
      delivered.push(event);
    });

    bus.setTickContext(14);
    bus.emit('TICK_COMPLETE', makeTickCompletePayload(14));

    expect(bus.getPendingCount()).toBe(1);

    bus.reset();

    expect(bus.getPendingCount()).toBe(0);

    bus.flush();
    expect(delivered).toHaveLength(0);

    bus.emit('TICK_COMPLETE', makeTickCompletePayload(15));
    bus.flush();

    expect(delivered).toHaveLength(0);
  });

  it('sharedEventBus is upgraded to the core compatibility surface', () => {
    sharedEventBus.reset();

    expect(sharedEventBus).toBeInstanceOf(EventBus);
    expect(typeof sharedEventBus.registerEventChannels).toBe('function');
    expect(typeof sharedEventBus.register).toBe('function');
    expect(typeof sharedEventBus.unregister).toBe('function');
    expect(sharedEventBus.eventRegistry).toBeInstanceOf(Map);
    expect(sharedEventBus.handlers).toBeInstanceOf(Map);
  });
});
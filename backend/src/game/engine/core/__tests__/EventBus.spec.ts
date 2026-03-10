//backend/src/game/engine/core/__tests__/EventBus.spec.ts

import { describe, expect, it, vi } from 'vitest';

import { EventBus, type EventEnvelope } from '../EventBus';

interface TestEventMap extends Record<string, unknown> {
  'run.started': { runId: string; seed: string };
  'tick.started': { tick: number };
  'tick.completed': { tick: number; checksum: string };
  'pressure.changed': { from: string; to: string; score: number };
}

describe('EventBus', () => {
  it('registers listeners, emits typed events, and preserves queue/history ordering', () => {
    const bus = new EventBus<TestEventMap>();
    const startedListener = vi.fn();
    const tickListener = vi.fn();

    bus.on('run.started', startedListener);
    bus.on('tick.started', tickListener);

    const runEnvelope = bus.emit(
      'run.started',
      { runId: 'run_001', seed: 'seed_001' },
      { emittedAtTick: 0, tags: ['bootstrap'] },
    );

    const tickEnvelope = bus.emit(
      'tick.started',
      { tick: 1 },
      { emittedAtTick: 1, tags: ['time'] },
    );

    expect(runEnvelope).toEqual<EventEnvelope<'run.started', TestEventMap['run.started']>>({
      sequence: 1,
      event: 'run.started',
      payload: { runId: 'run_001', seed: 'seed_001' },
      emittedAtTick: 0,
      tags: ['bootstrap'],
    });

    expect(tickEnvelope).toEqual<EventEnvelope<'tick.started', TestEventMap['tick.started']>>({
      sequence: 2,
      event: 'tick.started',
      payload: { tick: 1 },
      emittedAtTick: 1,
      tags: ['time'],
    });

    expect(startedListener).toHaveBeenCalledTimes(1);
    expect(startedListener).toHaveBeenCalledWith({
      runId: 'run_001',
      seed: 'seed_001',
    });

    expect(tickListener).toHaveBeenCalledTimes(1);
    expect(tickListener).toHaveBeenCalledWith({ tick: 1 });

    expect(bus.peek('run.started')).toEqual([{ runId: 'run_001', seed: 'seed_001' }]);
    expect(bus.peek('tick.started')).toEqual([{ tick: 1 }]);
    expect(bus.queuedCount()).toBe(2);
    expect(bus.historyCount()).toBe(2);

    expect(bus.getHistory()).toEqual([runEnvelope, tickEnvelope]);
  });

  it('supports once() listeners that unsubscribe after the first matching event', () => {
    const bus = new EventBus<TestEventMap>();
    const listener = vi.fn();

    bus.once('tick.started', listener);

    bus.emit('tick.started', { tick: 1 });
    bus.emit('tick.started', { tick: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ tick: 1 });
  });

  it('supports onAny() listeners that receive the full event envelope', () => {
    const bus = new EventBus<TestEventMap>();
    const onAny = vi.fn();

    bus.onAny(onAny);

    const emitted = bus.emit('tick.completed', {
      tick: 2,
      checksum: 'abc123',
    });

    expect(onAny).toHaveBeenCalledTimes(1);
    expect(onAny).toHaveBeenCalledWith(emitted);
  });

  it('flush() drains only the queue and leaves history intact', () => {
    const bus = new EventBus<TestEventMap>();

    bus.emit('tick.started', { tick: 1 });
    bus.emit('tick.completed', { tick: 1, checksum: 'c1' });

    const drained = bus.flush();

    expect(drained).toHaveLength(2);
    expect(drained.map((entry) => entry.event)).toEqual([
      'tick.started',
      'tick.completed',
    ]);
    expect(bus.queuedCount()).toBe(0);
    expect(bus.historyCount()).toBe(2);
    expect(bus.getHistory()).toHaveLength(2);
  });

  it('returns the last matching event through last()', () => {
    const bus = new EventBus<TestEventMap>();

    expect(bus.last('pressure.changed')).toBeNull();

    bus.emit('pressure.changed', { from: 'T0', to: 'T1', score: 20 });
    bus.emit('pressure.changed', { from: 'T1', to: 'T2', score: 40 });

    expect(bus.last('pressure.changed')).toEqual({
      sequence: 2,
      event: 'pressure.changed',
      payload: { from: 'T1', to: 'T2', score: 40 },
      emittedAtTick: undefined,
      tags: undefined,
    });
  });

  it('supports emitBatch() and preserves incrementing sequence ids', () => {
    const bus = new EventBus<TestEventMap>();

    const emitted = bus.emitBatch([
      {
        event: 'run.started',
        payload: { runId: 'run_001', seed: 'seed_001' },
        options: { emittedAtTick: 0 },
      },
      {
        event: 'tick.started',
        payload: { tick: 1 },
        options: { emittedAtTick: 1, tags: ['time'] },
      },
      {
        event: 'tick.completed',
        payload: { tick: 1, checksum: 'proof_001' },
        options: { emittedAtTick: 1, tags: ['proof'] },
      },
    ]);

    expect(emitted).toEqual([
      {
        sequence: 1,
        event: 'run.started',
        payload: { runId: 'run_001', seed: 'seed_001' },
        emittedAtTick: 0,
        tags: undefined,
      },
      {
        sequence: 2,
        event: 'tick.started',
        payload: { tick: 1 },
        emittedAtTick: 1,
        tags: ['time'],
      },
      {
        sequence: 3,
        event: 'tick.completed',
        payload: { tick: 1, checksum: 'proof_001' },
        emittedAtTick: 1,
        tags: ['proof'],
      },
    ]);
  });

  it('trims queue and history according to configured bounds', () => {
    const bus = new EventBus<TestEventMap>({
      maxQueueSize: 2,
      maxHistorySize: 3,
    });

    bus.emit('tick.started', { tick: 1 });
    bus.emit('tick.started', { tick: 2 });
    bus.emit('tick.started', { tick: 3 });
    bus.emit('tick.started', { tick: 4 });

    expect(bus.peekEntries('tick.started')).toEqual([
      {
        sequence: 3,
        event: 'tick.started',
        payload: { tick: 3 },
        emittedAtTick: undefined,
        tags: undefined,
      },
      {
        sequence: 4,
        event: 'tick.started',
        payload: { tick: 4 },
        emittedAtTick: undefined,
        tags: undefined,
      },
    ]);

    expect(bus.getHistory()).toEqual([
      {
        sequence: 2,
        event: 'tick.started',
        payload: { tick: 2 },
        emittedAtTick: undefined,
        tags: undefined,
      },
      {
        sequence: 3,
        event: 'tick.started',
        payload: { tick: 3 },
        emittedAtTick: undefined,
        tags: undefined,
      },
      {
        sequence: 4,
        event: 'tick.started',
        payload: { tick: 4 },
        emittedAtTick: undefined,
        tags: undefined,
      },
    ]);
  });

  it('getHistory(limit) returns the newest N events only', () => {
    const bus = new EventBus<TestEventMap>();

    bus.emit('tick.started', { tick: 1 });
    bus.emit('tick.started', { tick: 2 });
    bus.emit('tick.started', { tick: 3 });

    expect(bus.getHistory(2)).toEqual([
      {
        sequence: 2,
        event: 'tick.started',
        payload: { tick: 2 },
        emittedAtTick: undefined,
        tags: undefined,
      },
      {
        sequence: 3,
        event: 'tick.started',
        payload: { tick: 3 },
        emittedAtTick: undefined,
        tags: undefined,
      },
    ]);

    expect(bus.getHistory(0)).toEqual([]);
  });

  it('clear() can selectively clear queue/history/listeners', () => {
    const bus = new EventBus<TestEventMap>();
    const specific = vi.fn();
    const any = vi.fn();

    bus.on('tick.started', specific);
    bus.onAny(any);

    bus.emit('tick.started', { tick: 1 });

    bus.clear({
      clearQueue: true,
      clearHistory: false,
      clearListeners: false,
      clearAnyListeners: false,
    });

    expect(bus.queuedCount()).toBe(0);
    expect(bus.historyCount()).toBe(1);

    bus.emit('tick.started', { tick: 2 });

    expect(specific).toHaveBeenCalledTimes(2);
    expect(any).toHaveBeenCalledTimes(2);

    bus.clear({
      clearQueue: true,
      clearHistory: true,
      clearListeners: true,
      clearAnyListeners: true,
    });

    bus.emit('tick.started', { tick: 3 });

    expect(specific).toHaveBeenCalledTimes(2);
    expect(any).toHaveBeenCalledTimes(2);
    expect(bus.historyCount()).toBe(1);
  });

  it('the unsubscribe function returned by on() removes the listener cleanly', () => {
    const bus = new EventBus<TestEventMap>();
    const listener = vi.fn();

    const off = bus.on('tick.completed', listener);

    bus.emit('tick.completed', { tick: 1, checksum: 'first' });
    off();
    bus.emit('tick.completed', { tick: 2, checksum: 'second' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ tick: 1, checksum: 'first' });
  });
});
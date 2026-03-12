// backend/src/game/engine/zero/__tests__/EventFlushCoordinator.spec.ts

import { describe, expect, it, vi } from 'vitest';

import { EventBus } from '../../core/EventBus';
import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { EventFlushCoordinator } from '../EventFlushCoordinator';

function createSnapshot(
  seed: string,
  patch: Partial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base = createInitialRunState({
    runId: `run-${seed}`,
    userId: 'user-event-flush',
    seed,
    mode: 'solo',
  });

  return {
    ...base,
    ...patch,
    economy: patch.economy ? { ...base.economy, ...patch.economy } : base.economy,
    pressure: patch.pressure ? { ...base.pressure, ...patch.pressure } : base.pressure,
    tension: patch.tension ? { ...base.tension, ...patch.tension } : base.tension,
    shield: patch.shield ? { ...base.shield, ...patch.shield } : base.shield,
    battle: patch.battle ? { ...base.battle, ...patch.battle } : base.battle,
    cascade: patch.cascade ? { ...base.cascade, ...patch.cascade } : base.cascade,
    sovereignty: patch.sovereignty
      ? { ...base.sovereignty, ...patch.sovereignty }
      : base.sovereignty,
    cards: patch.cards ? { ...base.cards, ...patch.cards } : base.cards,
    modeState: patch.modeState
      ? { ...base.modeState, ...patch.modeState }
      : base.modeState,
    timers: patch.timers ? { ...base.timers, ...patch.timers } : base.timers,
    telemetry: patch.telemetry
      ? { ...base.telemetry, ...patch.telemetry }
      : base.telemetry,
  } as RunStateSnapshot;
}

describe('EventFlushCoordinator', () => {
  it('drains the queued envelopes in strict sequence order and preserves bus history', () => {
    const bus = new EventBus<any>();
    const snapshot = createSnapshot('event-flush-order', { tick: 8 });

    const envelope1 = bus.emit(
      'run.started',
      { runId: snapshot.runId, mode: snapshot.mode, seed: snapshot.seed },
      { emittedAtTick: 0, tags: ['bootstrap'] },
    );
    const envelope2 = bus.emit(
      'card.played',
      {
        runId: snapshot.runId,
        actorId: snapshot.userId,
        cardId: 'TEST_CARD',
        tick: snapshot.tick,
        mode: snapshot.mode,
      },
      { emittedAtTick: snapshot.tick, tags: ['cards'] },
    );
    const envelope3 = bus.emit(
      'tick.completed',
      {
        runId: snapshot.runId,
        tick: snapshot.tick,
        phase: snapshot.phase,
        checksum: 'checksum-001',
      },
      { emittedAtTick: snapshot.tick, tags: ['seal'] },
    );

    const coordinator = new (EventFlushCoordinator as any)();

    const result = coordinator.flush({
      bus,
      snapshot,
    });

    expect(result.drained).toEqual([envelope1, envelope2, envelope3]);
    expect(result.drained.map((entry: any) => entry.sequence)).toEqual([
      envelope1.sequence,
      envelope2.sequence,
      envelope3.sequence,
    ]);
    expect(result.queueCountBeforeFlush).toBe(3);
    expect(result.queueCountAfterFlush).toBe(0);

    expect(bus.queuedCount()).toBe(0);
    expect(bus.historyCount()).toBe(3);
    expect(bus.getHistory()).toHaveLength(3);
  });

  it('returns an empty drain result when nothing is queued and still reports stable counters', () => {
    const bus = new EventBus<any>();
    const snapshot = createSnapshot('event-flush-empty');

    const coordinator = new (EventFlushCoordinator as any)();

    const result = coordinator.flush({
      bus,
      snapshot,
    });

    expect(result.drained).toEqual([]);
    expect(result.queueCountBeforeFlush).toBe(0);
    expect(result.queueCountAfterFlush).toBe(0);
    expect(result.historyCountAfterFlush).toBe(0);
  });

  it('can project flush telemetry into the returned snapshot without mutating the caller snapshot', () => {
    const bus = new EventBus<any>();
    const base = createSnapshot('event-flush-telemetry');

    bus.emit(
      'tick.completed',
      {
        runId: base.runId,
        tick: base.tick,
        phase: base.phase,
        checksum: 'checksum-telemetry',
      },
      { emittedAtTick: base.tick, tags: ['seal'] },
    );

    const coordinator = new (EventFlushCoordinator as any)({
      snapshotProjector: {
        applyFlushTelemetry: vi.fn(
          ({
            snapshot,
            drained,
          }: {
            snapshot: RunStateSnapshot;
            drained: ReadonlyArray<any>;
          }) =>
            createSnapshot('event-flush-telemetry-next', {
              ...snapshot,
              telemetry: {
                ...snapshot.telemetry,
                emittedEventCount: snapshot.telemetry.emittedEventCount + drained.length,
                forkHints: ['flush-complete'],
              },
            }),
        ),
      },
    });

    const result = coordinator.flush({
      bus,
      snapshot: base,
    });

    expect(result.snapshot.telemetry.emittedEventCount).toBe(
      base.telemetry.emittedEventCount + 1,
    );
    expect(result.snapshot.telemetry.forkHints).toEqual(['flush-complete']);
    expect(base.telemetry.forkHints).toEqual([]);
    expect(result.drained).toHaveLength(1);
  });

  it('fails loudly if flush ordering drifts or the bus is replaced with a non-conforming surface', () => {
    const snapshot = createSnapshot('event-flush-invalid-bus');

    const coordinator = new (EventFlushCoordinator as any)();

    expect(() =>
      coordinator.flush({
        bus: {
          queuedCount: () => 1,
          flush: () => 'not-an-array',
        },
        snapshot,
      }),
    ).toThrow(/flush|EventBus|array|conforming/i);
  });
});
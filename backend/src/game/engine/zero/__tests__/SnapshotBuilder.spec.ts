// backend/src/game/engine/zero/__tests__/SnapshotBuilder.spec.ts

import { describe, expect, it } from 'vitest';

import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { SnapshotBuilder } from '../SnapshotBuilder';

function createSnapshot(
  seed: string,
  patch: Partial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base = createInitialRunState({
    runId: `run-${seed}`,
    userId: 'user-snapshot-builder',
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

describe('SnapshotBuilder', () => {
  it('builds a new deeply frozen snapshot without mutating the base snapshot', () => {
    const builder = new (SnapshotBuilder as any)();
    const base = createSnapshot('builder-base');

    const next = (builder as any).build({
      previous: base,
      nowMs: 25_000,
      patch: {
        tick: 1,
        economy: {
          ...base.economy,
          cash: base.economy.cash + 750,
          netWorth: base.economy.netWorth + 750,
        },
        timers: {
          ...base.timers,
          elapsedMs: base.timers.currentTickDurationMs,
          nextTickAtMs: 29_000,
        },
        telemetry: {
          ...base.telemetry,
          emittedEventCount: 2,
          warnings: ['snapshot-builder-warning'],
        },
      },
    }) as RunStateSnapshot;

    expect(next).not.toBe(base);
    expect(next.tick).toBe(1);
    expect(next.economy.cash).toBe(base.economy.cash + 750);
    expect(next.economy.netWorth).toBe(base.economy.netWorth + 750);
    expect(next.timers.elapsedMs).toBe(base.timers.currentTickDurationMs);
    expect(next.timers.nextTickAtMs).toBe(29_000);
    expect(next.telemetry.emittedEventCount).toBe(2);
    expect(next.telemetry.warnings).toEqual(['snapshot-builder-warning']);

    expect(base.tick).toBe(0);
    expect(base.economy.cash).not.toBe(next.economy.cash);
    expect(base.telemetry.warnings).toEqual([]);

    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.economy)).toBe(true);
    expect(Object.isFrozen(next.timers)).toBe(true);
    expect(Object.isFrozen(next.telemetry.warnings)).toBe(true);
  });

  it('recomputes weakest shield layer when layer integrity changes', () => {
    const builder = new (SnapshotBuilder as any)();
    const base = createSnapshot('builder-shield');

    const patchedLayers = base.shield.layers.map((layer) => {
      if (layer.layerId === 'L3') {
        return {
          ...layer,
          current: 5,
          integrityRatio: 5 / layer.max,
          breached: false,
        };
      }

      if (layer.layerId === 'L1') {
        return {
          ...layer,
          current: 60,
          integrityRatio: 60 / layer.max,
          breached: false,
        };
      }

      return layer;
    });

    const next = (builder as any).build({
      previous: base,
      nowMs: 50_000,
      patch: {
        shield: {
          ...base.shield,
          layers: patchedLayers,
        },
      },
    }) as RunStateSnapshot;

    expect(next.shield.weakestLayerId).toBe('L3');
    expect(next.shield.weakestLayerRatio).toBeCloseTo(5 / 150, 8);
  });

  it('normalizes telemetry + decision-window arrays into immutable copies', () => {
    const builder = new (SnapshotBuilder as any)();
    const base = createSnapshot('builder-telemetry');

    const next = (builder as any).build({
      previous: base,
      nowMs: 15_000,
      patch: {
        timers: {
          ...base.timers,
          frozenWindowIds: ['dw-1', 'dw-2'],
          activeDecisionWindows: {
            dw-1: {
              id: 'dw-1',
              timingClass: ['ACTION'],
              label: 'Decision Window One',
              source: 'MODE',
              mode: 'solo',
              openedAtTick: 0,
              openedAtMs: 0,
              closesAtTick: 1,
              closesAtMs: 4_000,
              exclusive: false,
              frozen: true,
              consumed: false,
              actorId: 'user-snapshot-builder',
              targetActorId: null,
              cardInstanceId: null,
              metadata: {
                tier: 'T1',
              },
            },
            dw-2: {
              id: 'dw-2',
              timingClass: ['ACTION'],
              label: 'Decision Window Two',
              source: 'MODE',
              mode: 'solo',
              openedAtTick: 1,
              openedAtMs: 4_000,
              closesAtTick: 2,
              closesAtMs: 8_000,
              exclusive: false,
              frozen: true,
              consumed: false,
              actorId: 'user-snapshot-builder',
              targetActorId: null,
              cardInstanceId: null,
              metadata: {
                tier: 'T2',
              },
            },
          },
        },
        telemetry: {
          ...base.telemetry,
          decisions: [
            {
              tick: 1,
              actorId: 'user-snapshot-builder',
              cardId: 'CARD_X',
              latencyMs: 500,
              timingClass: ['ACTION'],
              accepted: true,
            },
          ],
          warnings: ['w1', 'w2'],
          forkHints: ['hint-a'],
        },
      },
    }) as RunStateSnapshot;

    expect(next.timers.frozenWindowIds).toEqual(['dw-1', 'dw-2']);
    expect(next.telemetry.decisions).toHaveLength(1);
    expect(next.telemetry.forkHints).toEqual(['hint-a']);
    expect(Object.isFrozen(next.timers.frozenWindowIds)).toBe(true);
    expect(Object.isFrozen(next.telemetry.decisions)).toBe(true);
    expect(Object.isFrozen(next.telemetry.warnings)).toBe(true);
  });

  it('rejects run identity drift during snapshot assembly', () => {
    const builder = new (SnapshotBuilder as any)();
    const base = createSnapshot('builder-identity');

    expect(() =>
      (builder as any).build({
        previous: base,
        nowMs: 10_000,
        patch: {
          runId: 'different-run-id',
        },
      }),
    ).toThrow(/runId|identity/i);
  });
});
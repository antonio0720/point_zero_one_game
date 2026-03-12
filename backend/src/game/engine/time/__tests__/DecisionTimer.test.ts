// backend/src/game/engine/time/__tests__/DecisionTimer.test.ts
import { beforeEach, describe, expect, it } from 'vitest';

import type { RuntimeDecisionWindowSnapshot } from '../../core/RunStateSnapshot';
import { DecisionTimer } from '../DecisionTimer';
import { DEFAULT_HOLD_DURATION_MS } from '../types';

function makeRuntimeDecisionWindowSnapshot(
  windowId: string,
  closesAtMs: number,
  overrides: Partial<RuntimeDecisionWindowSnapshot> = {},
): RuntimeDecisionWindowSnapshot {
  const openedAtMs = Math.max(0, closesAtMs - 1_000);

  return Object.freeze({
    id: windowId,
    timingClass: 'FATE',
    label: `Decision ${windowId}`,
    source: 'unit-test',
    mode: 'solo',
    openedAtTick: 1,
    openedAtMs,
    closesAtTick: null,
    closesAtMs,
    exclusive: false,
    frozen: false,
    consumed: false,
    actorId: null,
    targetActorId: null,
    cardInstanceId: null,
    metadata: Object.freeze({}),
    ...overrides,
  });
}

describe('backend time/DecisionTimer', () => {
  let timer: DecisionTimer;

  beforeEach(() => {
    timer = new DecisionTimer();
  });

  it('hydrates runtime windows from the snapshot surface and reports opened ids', () => {
    const result = timer.syncFromSnapshot(
      {
        window_a: makeRuntimeDecisionWindowSnapshot('window_a', 5_000),
        window_b: makeRuntimeDecisionWindowSnapshot('window_b', 8_000),
      },
      [],
      1_000,
    );

    expect(result).toEqual({
      openedWindowIds: ['window_a', 'window_b'],
      removedWindowIds: [],
    });
    expect(timer.snapshot()).toEqual({
      window_a: 5_000,
      window_b: 8_000,
    });
    expect(timer.activeCount()).toBe(2);
  });

  it('removes local runtime windows that no longer exist in snapshot state', () => {
    timer.open('window_stale', 2_000);
    timer.open('window_live', 4_000);

    const result = timer.syncFromSnapshot(
      {
        window_live: makeRuntimeDecisionWindowSnapshot('window_live', 7_500),
      },
      [],
      1_000,
    );

    expect(result.openedWindowIds).toEqual([]);
    expect(result.removedWindowIds).toEqual(['window_stale']);
    expect(timer.snapshot()).toEqual({
      window_live: 7_500,
    });
  });

  it('hydrates frozen runtime windows from snapshot flags and preserves the bounded hold window', () => {
    const nowMs = 1_000;

    const result = timer.syncFromSnapshot(
      {
        window_frozen: makeRuntimeDecisionWindowSnapshot('window_frozen', 9_000, {
          frozen: true,
        }),
      },
      ['window_frozen'],
      nowMs,
    );

    expect(result).toEqual({
      openedWindowIds: ['window_frozen'],
      removedWindowIds: [],
    });
    expect(timer.snapshot()).toEqual({
      window_frozen: 9_000,
    });
    expect(timer.frozenIds(nowMs)).toEqual(['window_frozen']);
    expect(timer.frozenIds(nowMs + DEFAULT_HOLD_DURATION_MS + 1)).toEqual([]);
  });

  it('freezes a window by extending its deadline and exposing a frozen runtime id', () => {
    timer.open('window_hold', 2_000);

    const accepted = timer.freeze('window_hold', 1_000, 5_000);

    expect(accepted).toBe(true);
    expect(timer.snapshot()).toEqual({
      window_hold: 7_000,
    });
    expect(timer.frozenIds(5_999)).toEqual(['window_hold']);
    expect(timer.frozenIds(6_000)).toEqual([]);
  });

  it('uses the default hold duration when one is not provided', () => {
    timer.open('window_default_hold', 2_500);

    timer.freeze('window_default_hold', 1_000);

    expect(timer.snapshot()).toEqual({
      window_default_hold: 2_500 + DEFAULT_HOLD_DURATION_MS,
    });
  });

  it('does not expire a frozen window before thaw and expires it once the extended deadline is reached', () => {
    timer.open('window_expiry', 2_000);
    timer.freeze('window_expiry', 1_000, 5_000);

    expect(timer.closeExpired(3_000)).toEqual([]);
    expect(timer.activeCount()).toBe(1);

    expect(timer.closeExpired(7_000)).toEqual(['window_expiry']);
    expect(timer.activeCount()).toBe(0);
  });

  it('rejects a second freeze while the current hold is still active', () => {
    timer.open('window_double_hold', 2_000);

    expect(timer.freeze('window_double_hold', 1_000, 5_000)).toBe(true);
    expect(timer.freeze('window_double_hold', 2_000, 5_000)).toBe(false);
  });

  it('resolves, nullifies, and resets runtime windows deterministically', () => {
    timer.open('window_resolve', 4_000);
    timer.open('window_nullify', 6_000);

    expect(timer.resolve('window_resolve')).toBe(true);
    expect(timer.nullify('window_nullify')).toBe(true);
    expect(timer.resolve('missing_window')).toBe(false);
    expect(timer.activeCount()).toBe(0);

    timer.open('window_reset', 9_000);
    timer.reset();

    expect(timer.snapshot()).toEqual({});
    expect(timer.activeCount()).toBe(0);
  });

  it('truncates fractional deadlines in the snapshot projection', () => {
    timer.open('window_fractional', 3_999.8);

    expect(timer.snapshot()).toEqual({
      window_fractional: 3_999,
    });
  });
});
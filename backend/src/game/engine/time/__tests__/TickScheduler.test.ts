// backend/src/game/engine/time/__tests__/TickScheduler.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TickScheduler } from '../TickScheduler';

function makeRequest(overrides: Record<string, unknown> = {}): any {
  return {
    tier: 'T1',
    durationMs: 1_000,
    nowMs: 0,
    ...overrides,
  };
}

describe('backend time/TickScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a chained timeout schedule and fires the registered tick callback', async () => {
    const scheduler = new TickScheduler();
    const onTick = vi.fn();

    scheduler.setOnTick(onTick);
    scheduler.start(makeRequest());

    expect(scheduler.getTickNumber()).toBe(0);
    expect(scheduler.getCurrentTier()).toBe('T1');
    expect(scheduler.getNextFireAtMs()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(999);
    expect(onTick).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(scheduler.getTickNumber()).toBe(1);
  });

  it('pauses without firing and resumes cleanly afterward', async () => {
    const scheduler = new TickScheduler();
    const onTick = vi.fn();

    scheduler.setOnTick(onTick);
    scheduler.start(makeRequest({ durationMs: 1_000 }));

    await vi.advanceTimersByTimeAsync(400);
    scheduler.pause();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(onTick).not.toHaveBeenCalled();

    scheduler.resume();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('rearms the schedule with a new tier and duration', async () => {
    const scheduler = new TickScheduler();
    const onTick = vi.fn();

    scheduler.setOnTick(onTick);
    scheduler.start(makeRequest({ durationMs: 2_000 }));

    await vi.advanceTimersByTimeAsync(500);
    scheduler.rearm(
      makeRequest({
        tier: 'T3',
        durationMs: 300,
        nowMs: 500,
      }),
    );

    expect(scheduler.getCurrentTier()).toBe('T3');

    await vi.advanceTimersByTimeAsync(299);
    expect(onTick).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(scheduler.getTickNumber()).toBe(1);
  });

  it('stops the active schedule and clears the next-fire pointer', async () => {
    const scheduler = new TickScheduler();
    const onTick = vi.fn();

    scheduler.setOnTick(onTick);
    scheduler.start(makeRequest({ durationMs: 1_000 }));
    scheduler.stop();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(onTick).not.toHaveBeenCalled();
    expect(scheduler.getTickNumber()).toBe(0);
    expect(scheduler.getNextFireAtMs()).toBeNull();
  });

  it('force fires immediately without waiting for the timer boundary', async () => {
    const scheduler = new TickScheduler();
    const onTick = vi.fn();

    scheduler.setOnTick(onTick);
    scheduler.start(makeRequest({ durationMs: 60_000 }));

    await scheduler.forceFire();

    expect(onTick).toHaveBeenCalledTimes(1);
    expect(scheduler.getTickNumber()).toBe(1);
  });
});
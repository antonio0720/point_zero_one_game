//backend/src/game/engine/shield/__tests__/ShieldRepairQueue.spec.ts

import { describe, expect, it } from 'vitest';

import { ShieldRepairQueue } from '../ShieldRepairQueue';

describe('ShieldRepairQueue', () => {
  it('enqueues jobs and exposes active job state', () => {
    const queue = new ShieldRepairQueue();

    const job = queue.enqueue({
      tick: 12,
      layerId: 'L1',
      amount: 20,
      durationTicks: 2,
      source: 'CARD',
      tags: ['income-boost'],
    });

    expect(job).not.toBeNull();
    expect(queue.size()).toBe(1);
    expect(queue.activeCount('L1')).toBe(1);
    expect(queue.getActiveJobs()[0]).toEqual(
      expect.objectContaining({
        layerId: 'L1',
        amount: 20,
        durationTicks: 2,
        amountPerTick: 10,
      }),
    );
  });

  it('rejects a fourth active repair job for the same layer', () => {
    const queue = new ShieldRepairQueue();

    for (let index = 0; index < 3; index += 1) {
      expect(
        queue.enqueue({
          tick: 20,
          layerId: 'L2',
          amount: 10,
          durationTicks: 2,
        }),
      ).not.toBeNull();
    }

    expect(
      queue.enqueue({
        tick: 20,
        layerId: 'L2',
        amount: 10,
        durationTicks: 2,
      }),
    ).toBeNull();
  });

  it('rejects an ALL-layer repair when any participating layer is already saturated', () => {
    const queue = new ShieldRepairQueue();

    for (let index = 0; index < 3; index += 1) {
      queue.enqueue({
        tick: 30,
        layerId: 'L1',
        amount: 5,
        durationTicks: 1,
      });
    }

    const rejected = queue.enqueue({
      tick: 30,
      layerId: 'ALL',
      amount: 12,
      durationTicks: 2,
    });

    expect(rejected).toBeNull();
  });

  it('delivers repair slices over time with ceiling distribution and final remainder handling', () => {
    const queue = new ShieldRepairQueue();

    queue.enqueue({
      tick: 40,
      layerId: 'L3',
      amount: 25,
      durationTicks: 2,
    });

    expect(queue.due(39)).toEqual([]);

    const firstTick = queue.due(40);
    expect(firstTick).toEqual([
      expect.objectContaining({
        layerId: 'L3',
        amount: 13,
        completed: false,
        sourceTick: 40,
      }),
    ]);
    expect(queue.size()).toBe(1);

    const secondTick = queue.due(41);
    expect(secondTick).toEqual([
      expect.objectContaining({
        layerId: 'L3',
        amount: 12,
        completed: true,
        sourceTick: 40,
      }),
    ]);
    expect(queue.size()).toBe(0);
  });

  it('counts ALL-layer jobs against every layer they touch', () => {
    const queue = new ShieldRepairQueue();

    queue.enqueue({
      tick: 50,
      layerId: 'ALL',
      amount: 8,
      durationTicks: 1,
    });

    expect(queue.activeCount('L1')).toBe(1);
    expect(queue.activeCount('L2')).toBe(1);
    expect(queue.activeCount('L3')).toBe(1);
    expect(queue.activeCount('L4')).toBe(1);
  });

  it('reset clears all active jobs', () => {
    const queue = new ShieldRepairQueue();

    queue.enqueue({
      tick: 60,
      layerId: 'L4',
      amount: 15,
      durationTicks: 2,
    });
    queue.enqueue({
      tick: 60,
      layerId: 'L1',
      amount: 10,
      durationTicks: 1,
    });

    queue.reset();

    expect(queue.size()).toBe(0);
    expect(queue.getActiveJobs()).toEqual([]);
    expect(queue.activeCount('L4')).toBe(0);
  });
});
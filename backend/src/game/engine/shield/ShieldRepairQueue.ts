/*
 * POINT ZERO ONE — BACKEND SHIELD REPAIR QUEUE
 * /backend/src/game/engine/shield/ShieldRepairQueue.ts
 *
 * Doctrine:
 * - active repair is queued, not instant
 * - repair jobs survive incoming damage
 * - queue limits are enforced per target layer
 * - delivery is deterministic tick by tick
 */

import { randomUUID } from 'node:crypto';

import type { ShieldLayerId } from '../core/GamePrimitives';
import {
  SHIELD_CONSTANTS,
  SHIELD_LAYER_ORDER,
  type PendingRepairSlice,
  type RepairJob,
  type RepairLayerId,
} from './types';

export class ShieldRepairQueue {
  private jobs: RepairJob[] = [];

  public enqueue(input: {
    readonly tick: number;
    readonly layerId: RepairLayerId;
    readonly amount: number;
    readonly durationTicks?: number;
    readonly jobId?: string;
    readonly source?: RepairJob['source'];
    readonly tags?: readonly string[];
  }): RepairJob | null {
    const amount = Math.max(0, Math.round(input.amount));
    const durationTicks = Math.max(1, Math.round(input.durationTicks ?? 1));

    if (amount <= 0) {
      return null;
    }

    const blockedLayers =
      input.layerId === 'ALL'
        ? SHIELD_LAYER_ORDER
        : [input.layerId];

    const wouldOverflow = blockedLayers.some(
      (layerId) =>
        this.activeCount(layerId) >=
        SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER,
    );

    if (wouldOverflow) {
      return null;
    }

    const job: RepairJob = {
      jobId: input.jobId ?? randomUUID(),
      tick: input.tick,
      layerId: input.layerId,
      amount,
      durationTicks,
      amountPerTick: Math.ceil(amount / durationTicks),
      createdAtTick: input.tick,
      source: input.source ?? 'CARD',
      tags: Object.freeze([...(input.tags ?? [])]),
      ticksRemaining: durationTicks,
      delivered: 0,
    };

    this.jobs = [...this.jobs, job];
    return job;
  }

  public due(currentTick: number): readonly PendingRepairSlice[] {
    const slices: PendingRepairSlice[] = [];

    this.jobs = this.jobs
      .map((job) => {
        if (currentTick < job.tick || job.ticksRemaining <= 0) {
          return job;
        }

        const remaining = Math.max(0, job.amount - job.delivered);
        const amount = Math.min(job.amountPerTick, remaining);

        if (amount <= 0) {
          job.ticksRemaining = 0;
          return job;
        }

        job.delivered += amount;
        job.ticksRemaining -= 1;

        slices.push({
          jobId: job.jobId,
          layerId: job.layerId,
          amount,
          completed: job.ticksRemaining <= 0 || job.delivered >= job.amount,
          sourceTick: job.tick,
        });

        return job;
      })
      .filter((job) => job.ticksRemaining > 0 && job.delivered < job.amount);

    return Object.freeze([...slices]);
  }

  public size(): number {
    return this.jobs.length;
  }

  public activeCount(layerId: ShieldLayerId): number {
    return this.jobs.filter((job) => {
      if (job.ticksRemaining <= 0) {
        return false;
      }

      return job.layerId === 'ALL' || job.layerId === layerId;
    }).length;
  }

  public getActiveJobs(): readonly RepairJob[] {
    return Object.freeze(
      this.jobs.map((job) => ({
        ...job,
        tags: Object.freeze([...job.tags]),
      })),
    );
  }

  public reset(): void {
    this.jobs = [];
  }
}
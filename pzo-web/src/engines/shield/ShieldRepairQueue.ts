//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/shield/ShieldRepairQueue.ts

/**
 * FILE: pzo-web/src/engines/shield/ShieldRepairQueue.ts
 * Manages active repair jobs from played cards.
 * Passive regen is delegated to ShieldLayerManager.tickPassiveRegen() — not here.
 *
 * Repair rules:
 * ✦ Jobs execute over 1–2 ticks. ptsPerTick = ceil(repairPts / durationTicks).
 * ✦ Max 3 simultaneous active repair jobs per layer. 4th enqueue returns null.
 * ✦ Jobs are never cancelled by incoming damage — they run to completion.
 * ✦ A job on a breached layer starts delivering the tick after enqueue.
 * ✦ ptsDelivered never exceeds totalRepairPts (last-tick remainder clamp).
 *
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import { v4 as uuidv4 } from 'uuid';
import {
  ShieldLayerId,
  RepairJob,
  RepairCard,
  SHIELD_CONSTANTS,
  SHIELD_LAYER_ORDER,
} from './types';
import { ShieldLayerManager } from './ShieldLayerManager';

export interface RepairTickResult {
  jobsCompleted: RepairJob[];
  ptsDeliveredByLayer: Map<ShieldLayerId, number>;
}

export class ShieldRepairQueue {
  private jobs: Map<ShieldLayerId, RepairJob[]> = new Map();

  constructor(private readonly layerManager: ShieldLayerManager) {
    for (const id of SHIELD_LAYER_ORDER) {
      this.jobs.set(id, []);
    }
  }

  /**
   * Enqueue a repair job from a played card.
   * Returns the RepairJob on success.
   * Returns null if the 3-job-per-layer cap is exceeded (4th is rejected).
   *
   * The caller (EngineOrchestrator) is responsible for emitting SHIELD_REPAIR_QUEUE_FULL
   * when null is returned — the card is NOT consumed on rejection.
   */
  public enqueueRepair(card: RepairCard): RepairJob | null {
    const queue = this.jobs.get(card.targetLayerId)!;

    if (queue.length >= SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS) {
      return null; // Cap exceeded
    }

    // ptsPerTick = ceil(repairPts / durationTicks)
    const ptsPerTick = Math.ceil(card.repairPts / card.durationTicks);

    const job: RepairJob = {
      jobId: uuidv4(),
      targetLayerId: card.targetLayerId,
      totalRepairPts: card.repairPts,
      ptsPerTick,
      durationTicks: card.durationTicks,
      ticksRemaining: card.durationTicks,
      ptsDelivered: 0,
    };

    queue.push(job);
    return job;
  }

  /**
   * Execute one tick of all active repair jobs.
   * Delivers pts to ShieldLayerManager.
   * Removes completed jobs.
   *
   * ✦ ptsThisTick = min(ptsPerTick, totalRepairPts - ptsDelivered)
   *   ensures total delivered never exceeds totalRepairPts.
   */
  public tickRepairJobs(): RepairTickResult {
    const jobsCompleted: RepairJob[] = [];
    const ptsDeliveredByLayer = new Map<ShieldLayerId, number>(
      SHIELD_LAYER_ORDER.map(id => [id, 0]),
    );

    for (const layerId of SHIELD_LAYER_ORDER) {
      const queue = this.jobs.get(layerId)!;
      let totalPtsThisTick = 0;

      for (const job of queue.filter(j => j.ticksRemaining > 0)) {
        // Last-tick remainder clamp — never exceed totalRepairPts
        const ptsNow = Math.min(job.ptsPerTick, job.totalRepairPts - job.ptsDelivered);
        job.ptsDelivered += ptsNow;
        job.ticksRemaining--;
        totalPtsThisTick += ptsNow;

        if (job.ticksRemaining <= 0) {
          jobsCompleted.push(job);
        }
      }

      if (totalPtsThisTick > 0) {
        this.layerManager.applyRepair(layerId, totalPtsThisTick);
        ptsDeliveredByLayer.set(layerId, totalPtsThisTick);
      }

      // Remove completed jobs
      this.jobs.set(layerId, queue.filter(j => j.ticksRemaining > 0));
    }

    return { jobsCompleted, ptsDeliveredByLayer };
  }

  /** Returns a copy of active jobs for a layer (read-only). */
  public getActiveJobsForLayer(id: ShieldLayerId): RepairJob[] {
    return [...(this.jobs.get(id) ?? [])];
  }

  public reset(): void {
    for (const id of SHIELD_LAYER_ORDER) {
      this.jobs.set(id, []);
    }
  }
}
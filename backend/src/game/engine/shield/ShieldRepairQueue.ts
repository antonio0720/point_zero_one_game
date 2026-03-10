/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { RepairJob } from './types';

export class ShieldRepairQueue {
  private queue: RepairJob[] = [];

  public enqueue(job: RepairJob): void {
    this.queue.push(job);
  }

  public due(tick: number): RepairJob[] {
    const due = this.queue.filter((job) => job.tick <= tick);
    this.queue = this.queue.filter((job) => job.tick > tick);
    return due;
  }

  public size(): number {
    return this.queue.length;
  }

  public reset(): void {
    this.queue = [];
  }
}

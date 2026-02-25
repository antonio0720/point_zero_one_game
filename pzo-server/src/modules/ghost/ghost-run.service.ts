// pzo-server/src/modules/ghost/ghost-run.service.ts
// Sprint 6 — Ghost Run Service

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface GhostRunRecord {
  runId: string;
  challengerUserId: string;
  targetLegendId: string;
  seed: number;
  status: 'ACTIVE' | 'COMPLETE' | 'ABANDONED';
  startedAt: number;
  completedAt: number | null;
  finalCordScore: number | null;
  finalNetWorth: number | null;
  beaten: boolean;
}

@Injectable()
export class GhostRunService {
  private runs = new Map<string, GhostRunRecord>();

  async startRun(challengerUserId: string, targetLegendId: string, seed: number): Promise<GhostRunRecord> {
    const runId = uuidv4();
    const record: GhostRunRecord = {
      runId, challengerUserId, targetLegendId, seed,
      status: 'ACTIVE', startedAt: Date.now(),
      completedAt: null, finalCordScore: null, finalNetWorth: null, beaten: false,
    };
    this.runs.set(runId, record);
    return record;
  }

  async completeRun(
    runId: string,
    finalCordScore: number,
    finalNetWorth: number,
    legendNetWorth: number,
  ): Promise<GhostRunRecord | null> {
    const run = this.runs.get(runId);
    if (!run) return null;
    const beaten = finalNetWorth >= legendNetWorth;
    const updated: GhostRunRecord = {
      ...run, status: 'COMPLETE', completedAt: Date.now(),
      finalCordScore, finalNetWorth, beaten,
    };
    this.runs.set(runId, updated);
    return updated;
  }

  async getRun(runId: string): Promise<GhostRunRecord | null> {
    return this.runs.get(runId) ?? null;
  }
}

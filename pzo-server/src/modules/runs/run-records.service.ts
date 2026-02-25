// pzo-server/src/modules/runs/run-records.service.ts
// Sprint 7 — Run Records Service

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { VerifiedRunRecord } from '../../../../shared/contracts/pzo/sovereignty-contracts';

@Injectable()
export class RunRecordsService {
  private records = new Map<string, VerifiedRunRecord>();

  async save(record: Omit<VerifiedRunRecord, 'serverVerified'>): Promise<VerifiedRunRecord> {
    const full: VerifiedRunRecord = { ...record, serverVerified: true };
    this.records.set(record.runId, full);
    return full;
  }

  async getById(runId: string): Promise<VerifiedRunRecord | null> {
    return this.records.get(runId) ?? null;
  }

  async getByUserId(userId: string): Promise<VerifiedRunRecord[]> {
    return Array.from(this.records.values()).filter(r => r.userId === userId);
  }

  async getVerifiedRuns(
    mode?: string, tier?: string, limit: number = 50, offset: number = 0,
  ): Promise<{ runs: VerifiedRunRecord[]; total: number }> {
    let runs = Array.from(this.records.values()).filter(r => r.serverVerified);
    if (mode) runs = runs.filter(r => r.mode === mode);
    if (tier) runs = runs.filter(r => r.cordTier === tier);
    runs.sort((a, b) => b.cordScore - a.cordScore);
    return { runs: runs.slice(offset, offset + limit), total: runs.length };
  }

  async getLegends(): Promise<VerifiedRunRecord[]> {
    return Array.from(this.records.values())
      .filter(r => r.isLegend && r.serverVerified)
      .sort((a, b) => b.cordScore - a.cordScore);
  }
}

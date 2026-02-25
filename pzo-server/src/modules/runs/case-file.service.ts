// pzo-server/src/modules/runs/case-file.service.ts
// Sprint 3 — Case File storage + ML stub

import { Injectable } from '@nestjs/common';
import type { CaseFileSubmission, CaseFileRecord } from '../../../../shared/contracts/pzo/case-file';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CaseFileService {
  private caseFiles = new Map<string, CaseFileRecord>();

  async save(submission: CaseFileSubmission): Promise<CaseFileRecord> {
    const record: CaseFileRecord = {
      ...submission,
      id: uuidv4(),
      createdAt: Date.now(),
      // ML grade stub — Sprint 7 wires real ML scoring
      mlGrade: computeMLGrade(submission),
      mlInsights: generateMLInsights(submission),
    };
    this.caseFiles.set(record.id, record);
    return record;
  }

  async getByRunId(runId: string): Promise<CaseFileRecord | null> {
    for (const record of this.caseFiles.values()) {
      if (record.runId === runId) return record;
    }
    return null;
  }

  async getByUserId(userId: string): Promise<CaseFileRecord[]> {
    return Array.from(this.caseFiles.values()).filter(r => r.userId === userId);
  }
}

// ─── ML Grade Stub ────────────────────────────────────────────────────────────

function computeMLGrade(submission: CaseFileSubmission): string {
  const score = (
    submission.aggregateDecisionQuality * 0.4 +
    submission.pressureResilienceScore  * 0.3 +
    submission.consistencyScore         * 0.3
  );
  if (score >= 0.90) return 'S';
  if (score >= 0.75) return 'A';
  if (score >= 0.60) return 'B';
  if (score >= 0.45) return 'C';
  return 'D';
}

function generateMLInsights(submission: CaseFileSubmission): string[] {
  const insights: string[] = [];

  if (submission.panicDecisionPct > 10) {
    insights.push(`${submission.panicDecisionPct}% panic plays detected — triggers under $${submission.lowestCash.toLocaleString()} cash threshold`);
  }
  if (submission.totalBleedTicks > 60) {
    insights.push(`Extended bleed survivability — ${submission.totalBleedTicks} ticks in distress`);
  }
  if (submission.aggregateDecisionQuality >= 0.8) {
    insights.push('High decision quality maintained under pressure');
  }
  if (submission.taxBurdenRate > 0.04) {
    insights.push(`Isolation tax burden ${Math.round(submission.taxBurdenRate * 100)}% — consider shield-first sequencing`);
  }

  return insights;
}

// Helper — CaseFileSubmission doesn't have panicDecisionPct directly, compute from breakdown
declare module '../../../../shared/contracts/pzo/case-file' {
  interface CaseFileSubmission {
    panicDecisionPct?: number;
  }
}

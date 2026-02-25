// pzo-server/src/modules/explorer/verified-run-explorer.controller.ts
// Sprint 7 — Verified Run Explorer REST Controller

import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { RunRecordsService }        from '../runs/run-records.service';
import { SovereigntyEngineService } from '../sovereignty/sovereignty-engine.service';
import type { VerifiedRunSubmission } from '../../../../shared/contracts/pzo/sovereignty-contracts';

@Controller('verified-runs')
export class VerifiedRunExplorerController {
  constructor(
    private readonly runRecords: RunRecordsService,
    private readonly sovereignty: SovereigntyEngineService,
  ) {}

  // GET /verified-runs?mode=EMPIRE&tier=GOLD&limit=20&offset=0
  @Get()
  async list(
    @Query('mode') mode?: string,
    @Query('tier') tier?: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    return this.runRecords.getVerifiedRuns(mode, tier, Number(limit), Number(offset));
  }

  // GET /verified-runs/:id
  @Get(':id')
  async getOne(@Param('id') runId: string) {
    return this.runRecords.getById(runId);
  }

  // GET /verified-runs/:id/dossier
  @Get(':id/dossier')
  async getDossier(@Param('id') runId: string) {
    const run = await this.runRecords.getById(runId);
    if (!run) return { error: 'Run not found' };
    return {
      run,
      proofCard: {
        runId: run.runId,
        shortHash: run.shortHash,
        displayName: run.displayName,
        mode: run.mode,
        cordScore: run.cordScore,
        cordTier: run.cordTier,
        finalNetWorth: run.finalNetWorth,
        finalTick: run.finalTick,
        verifiedAt: run.verifiedAt,
        isLegend: run.isLegend,
      },
    };
  }

  // POST /verified-runs — submit + verify
  @Post()
  async submit(@Body() submission: VerifiedRunSubmission) {
    const verifyResult = this.sovereignty.verify(
      {
        seed: submission.seed,
        mode: submission.mode,
        finalTick: submission.finalTick,
        finalCash: submission.finalCash,
        finalNetWorth: submission.finalNetWorth,
        finalIncome: submission.finalIncome,
        cordScore: submission.cordScore,
        eventCount: submission.eventCount,
        eventDigest: submission.eventDigest,
      },
      submission.proofHash,
    );

    if (!verifyResult.valid) {
      return { verified: false, reason: verifyResult.reason };
    }

    const isLegend = submission.cordScore >= 0.72;
    const record = await this.runRecords.save({
      ...submission,
      shortHash: submission.proofHash.slice(0, 12),
      verifiedAt: Date.now(),
      isLegend,
    });

    return { verified: true, record };
  }

  // GET /verified-runs/legends
  @Get('legends')
  async getLegends() {
    return this.runRecords.getLegends();
  }
}

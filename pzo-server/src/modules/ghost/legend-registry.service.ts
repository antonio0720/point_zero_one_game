// pzo-server/src/modules/ghost/legend-registry.service.ts
// Sprint 6 — Legend Registry Service

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  INITIAL_DECAY_STATE, registerLegend, applyLegendDecay,
  recordLegendBeaten, recordDynastyDefense, computeDecayExploitBonus,
} from '../../../../pzo-web/src/game/modes/phantom/legendDecayModel';
import type { LegendRecord, LegendDecayState } from '../../../../pzo-web/src/game/modes/phantom/legendDecayModel';

@Injectable()
export class LegendRegistryService {
  private state: LegendDecayState = INITIAL_DECAY_STATE;

  async register(
    userId: string,
    displayName: string,
    runId: string,
    finalCordScore: number,
    finalNetWorth: number,
    finalTick: number,
    seed: number,
    snapshotCount: number,
    serverTick: number,
  ): Promise<LegendRecord> {
    const legendId = uuidv4();
    this.state = registerLegend(this.state, {
      legendId, userId, displayName, runId,
      finalCordScore, finalNetWorth, finalTick, seed,
      createdAtServerTick: serverTick, snapshotCount,
      dynastyDefenseCount: 0,
    });
    return this.state.records[legendId];
  }

  async getLegend(legendId: string): Promise<LegendRecord | null> {
    return this.state.records[legendId] ?? null;
  }

  async getTopLegends(limit: number = 20): Promise<LegendRecord[]> {
    return Object.values(this.state.records)
      .filter(l => l.currentDecayFactor > 0.15)
      .sort((a, b) => b.finalCordScore - a.finalCordScore)
      .slice(0, limit);
  }

  async recordBeaten(legendId: string, beatByUserId: string): Promise<void> {
    this.state = recordLegendBeaten(this.state, legendId, beatByUserId);
  }

  async recordDefense(legendId: string): Promise<void> {
    this.state = recordDynastyDefense(this.state, legendId);
  }

  async tickDecay(serverTick: number): Promise<void> {
    this.state = applyLegendDecay(this.state, serverTick);
  }

  async getDecayExploitBonus(legendId: string): Promise<number> {
    const legend = this.state.records[legendId];
    return legend ? computeDecayExploitBonus(legend) : 0;
  }
}

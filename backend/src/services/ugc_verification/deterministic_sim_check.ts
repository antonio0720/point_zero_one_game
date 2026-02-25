/**
 * Deterministic Simulation Check Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameEngineService } from '../game-engine/game-engine.service';
import { ReplayDocument } from '../replays/schemas/replay.schema';
import { UGCVerificationReport } from './interfaces/ugc-verification-report.interface';

/**
 * UGC Verification Report Model
 */
export interface UGCVerificationReport {
  replayId: string;
  originalReplayHash: string;
  simulatedReplayHash: string;
  differences: string[];
}

@Injectable()
export class DeterministicSimCheckService {
  constructor(
    @InjectModel('Replay') private readonly replayModel: Model<ReplayDocument>,
    private readonly gameEngineService: GameEngineService,
  ) {}

  async check(replayId: string): Promise<UGCVerificationReport | null> {
    const originalReplay = await this.replayModel.findOne({ _id: replayId });
    if (!originalReplay) {
      return null;
    }

    const originalReplayHash = originalReplay.hash;
    const simulatedReplay = await this.gameEngineService.simulate(originalReplay.data);
    const simulatedReplayHash = simulatedReplay.hash;

    if (originalReplayHash === simulatedReplayHash) {
      return null;
    }

    const differences: string[] = [];
    this.compareStates(originalReplay, simulatedReplay, differences);

    return {
      replayId,
      originalReplayHash,
      simulatedReplayHash,
      differences,
    };
  }

  private compareStates(
    originalState: any,
    simulatedState: any,
    differences: string[],
  ): void {
    for (const key in originalState) {
      if (originalState[key] !== simulatedState[key]) {
        differences.push(`${key}: ${JSON.stringify(originalState[key])} != ${JSON.stringify(simulatedState[key])}`);
      }
    }
  }
}

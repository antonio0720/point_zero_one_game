/**
 * Delta Highlights Service for Run2 (You vs You)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * PlayerRun entity representing a player's run in the game.
 */
export class PlayerRun {
  id: number;
  playerId: number;
  runId: number;
  score: number;
  win: boolean;
}

/**
 * Run2DeltaHighlight entity representing the delta highlight for a Run2 (You vs You).
 */
export class Run2DeltaHighlight {
  id: number;
  playerRun1Id: number;
  playerRun2Id: number;
  improvementSignal: boolean;
}

/**
 * Delta Highlights Service
 */
@Injectable()
export class DeltaHighlightsService {
  constructor(
    @InjectRepository(PlayerRun)
    private readonly playerRunRepository: Repository<PlayerRun>,
    @InjectRepository(Run2DeltaHighlight)
    private readonly run2DeltaHighlightRepository: Repository<Run2DeltaHighlight>,
  ) {}

  /**
   * Calculate Run2 delta highlight for a given pair of runs.
   * @param playerRun1Id The ID of the first player's run.
   * @param playerRun2Id The ID of the second player's run.
   */
  async calculateDeltaHighlight(playerRun1Id: number, playerRun2Id: number): Promise<Run2DeltaHighlight> {
    const playerRun1 = await this.playerRunRepository.findOne(playerRun1Id, { relations: ['run'] });
    const playerRun2 = await this.playerRunRepository.findOne(playerRun2Id, { relations: ['run'] });

    // Calculate the delta between the two runs' scores.
    const scoreDelta = playerRun1.score - playerRun2.score;

    // If both runs are losses or both are wins, there is no improvement signal.
    const isLossForBoth = !playerRun1.win && !playerRun2.win;
    const isWinForBoth = playerRun1.win && playerRun2.win;
    const improvementSignal = !isLossForBoth && !isWinForBoth;

    // Check if the delta highlight already exists for this pair of runs.
    const existingDeltaHighlight = await this.run2DeltaHighlightRepository.findOne({
      where: { playerRun1Id, playerRun2Id },
    });

    // If it doesn't exist, create a new one with the calculated improvement signal.
    if (!existingDeltaHighlight) {
      const newDeltaHighlight = new Run2DeltaHighlight();
      newDeltaHighlight.playerRun1Id = playerRun1Id;
      newDeltaHighlight.playerRun2Id = playerRun2Id;
      newDeltaHighlight.improvementSignal = improvementSignal;
      await this.run2DeltaHighlightRepository.save(newDeltaHighlight);
    }

    // Return the existing delta highlight if it already exists, or create a new one and return that.
    return existingDeltaHighlight || newDeltaHighlight;
  }
}

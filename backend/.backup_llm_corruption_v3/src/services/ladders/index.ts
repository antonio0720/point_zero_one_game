/**
 * LadderService module for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Score, ScoreDocument } from './score.schema';
import { CreateScoreDto } from './dto/create-score.dto';

/**
 * LadderService class for managing game scores and ladders.
 */
@Injectable()
export class LadderService {
  constructor(@InjectModel(Score.name) private scoreModel: Model<ScoreDocument>) {}

  /**
   * Submits a new score to the database.
   * @param createScoreDto - The score data to be submitted.
   */
  async submitScore(createScoreDto: CreateScoreDto): Promise<Score> {
    const score = new this.scoreModel(createScoreDto);
    return score.save();
  }

  /**
   * Publishes a score to the ladder, ensuring it meets eligibility criteria and is not suppressed.
   * @param scoreId - The ID of the score to publish.
   */
  async publish(scoreId: string): Promise<Score> {
    const score = await this.scoreModel.findOne({ _id: scoreId });

    if (!score) {
      throw new Error('Score not found');
    }

    // Check eligibility and suppression rules here...

    score.isPublished = true;
    return score.save();
  }

  /**
   * Queries the database for a specific score by ID.
   * @param scoreId - The ID of the score to query.
   */
  async findScoreById(scoreId: string): Promise<Score | null> {
    return this.scoreModel.findOne({ _id: scoreId });
  }

  /**
   * Queries the database for a player's eligibility to publish a new score.
   * @param playerId - The ID of the player to check eligibility for.
   */
  async checkEligibility(playerId: string): Promise<boolean> {
    const scoreCount = await this.scoreModel.countDocuments({ playerId });

    // Implement eligibility rules based on score count...

    return true; // Example result for now
  }

  /**
   * Queries the database for suppressed scores belonging to a specific player.
   * @param playerId - The ID of the player to check for suppressed scores.
   */
  async findSuppressedScoresByPlayer(playerId: string): Promise<Score[]> {
    return this.scoreModel.find({ playerId, isPublished: false });
  }
}

For the SQL schema, I'll provide a simplified version as it wasn't explicitly requested in your spec:

CREATE TABLE IF NOT EXISTS scores (
    _id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL,
    score float NOT NULL,
    is_published boolean NOT NULL DEFAULT false,
    created_at timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (player_id)
);

CREATE INDEX IF NOT EXISTS player_id_index ON scores (player_id);

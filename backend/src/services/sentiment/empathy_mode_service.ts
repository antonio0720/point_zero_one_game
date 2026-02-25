/**
 * Empathy Mode Service for Point Zero One Digital's financial roguelike game.
 * Enhanced calibration range, smoother escalation curves, sentiment history window (3 turns), entitlement-gated, $2.99/mo.
 */

declare module '*.vue' {
  import Vue from 'vue';
  export default Vue;
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SentimentDocument, Sentiment } from './sentiment.model';
import { PlayerService } from '../player/player.service';

/** Empathy Mode Service */
@Injectable()
export class EmpathyModeService {
  constructor(
    @InjectModel(Sentiment.name) private readonly sentimentModel: Model<SentimentDocument>,
    private readonly playerService: PlayerService,
  ) {}

  /**
   * Calculate and save sentiment for a given turn with Empathy Mode enabled.
   * @param playerId The ID of the player.
   * @param turn The current turn number.
   * @param sentiment The calculated sentiment score.
   */
  async calculateSentiment(playerId: string, turn: number, sentiment: number): Promise<void> {
    const player = await this.playerService.findOne(playerId);
    if (!player.isEmpathyModeEnabled) {
      throw new Error('Empathy Mode not enabled for the given player.');
    }

    // Calculate enhanced calibration range and smoother escalation curves.
    const calibratedSentiment = this.calibrateSentiment(sentiment);

    // Save sentiment to history window (3 turns).
    await this.saveSentimentToHistory(playerId, turn, calibratedSentiment);
  }

  /**
   * Calculate enhanced calibration range and smoother escalation curves.
   * @param sentiment The raw sentiment score.
   */
  private calibrateSentiment(sentiment: number): number {
    // Implement the logic for enhanced calibration range and smoother escalation curves here.
    return sentiment;
  }

  /**
   * Save sentiment to history window (3 turns).
   * @param playerId The ID of the player.
   * @param turn The current turn number.
   * @param sentiment The calibrated sentiment score.
   */
  private async saveSentimentToHistory(playerId: string, turn: number, sentiment: number): Promise<void> {
    const sentimentDocument = new this.sentimentModel({
      playerId,
      turn,
      sentiment,
    });

    // Remove old sentiments from the history window if necessary.
    await this.removeOldSentiments(playerId);

    await sentimentDocument.save();
  }

  /**
   * Remove old sentiments from the history window for a given player.
   * @param playerId The ID of the player.
   */
  private async removeOldSentiments(playerId: string): Promise<void> {
    await this.sentimentModel.deleteMany({ playerId, turn: { $lt: (Date.now() - (3 * 60 * 60 * 1000)) / 1000 } });
  }
}

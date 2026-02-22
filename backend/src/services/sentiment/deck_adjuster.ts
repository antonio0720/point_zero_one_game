/**
 * Deck Adjuster Service for Point Zero One Digital's Financial Roguelike Game
 *
 * Consumes SentimentClassified and computes adjustment to next draw weights within allowed range (±20%)
 * The adjustment is ephemeral (per turn, not persistent) and logs the adjustment for balance analytics.
 */

declare module '*.json' {
  const value: any;
  export default value;
}

import { Injectable } from '@nestjs/common';
import { SentimentClassified } from '../sentiments/sentiment-classified.interface';
import { DeckAdjustment } from './deck-adjustment.interface';

@Injectable()
export class DeckAdjusterService {
  private readonly adjustmentRange = 0.2; // Adjustment range is ±20%

  public async adjustDeckWeights(sentimentClassified: SentimentClassified): Promise<DeckAdjustment> {
    const sentimentScore = sentimentClassified.score;
    const adjustedWeight = this.mapSentimentToWeight(sentimentScore);

    // Adjustment is ephemeral, so we don't need to persist it anywhere

    // Log the adjustment for balance analytics
    console.log(`Adjusted deck weight: ${adjustedWeight}`);

    return { sentimentScore, adjustedWeight };
  }

  private mapSentimentToWeight(sentimentScore: number): number {
    const baseWeight = 50; // Base weight for a neutral sentiment
    const sentimentRange = 100; // Range of sentiment scores (0-100)
    const weightRange = 100; // Range of weights (0-100)

    const scaledScore = (sentimentScore - 50) / sentimentRange * weightRange;
    const adjustedWeight = baseWeight + this.adjustmentRange * scaledScore;

    return Math.max(0, Math.min(100, adjustedWeight));
  }
}

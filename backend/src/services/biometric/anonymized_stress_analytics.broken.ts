/**
 * Anonymized stress-response analytics service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CardDocument, CardSchema } from './card.schema';
import { BiometricEventDocument, BiometricEventSchema } from './biometric-event.schema';

/**
 * Anonymized stress analytics service for the game.
 */
@Injectable()
export class AnonymizedStressAnalyticsService {
  constructor(
    @InjectModel('Card') private cardModel: Model<CardDocument>,
    @InjectModel('BiometricEvent') private biometricEventModel: Model<BiometricEventDocument>,
  ) {}

  /**
   * Calculate the average stress delta across the population for a given card ID.
   * @param cardId The ID of the card to analyze.
   */
  async getAverageStressDelta(cardId: string): Promise<number> {
    const card = await this.cardModel.findOne({ _id: cardId });
    if (!card) throw new Error('Card not found');

    const biometricEvents = await this.biometricEventModel.find({ cardId }).exec();
    let totalStressDelta = 0;
    for (const event of biometricEvents) {
      totalStressDelta += event.stressDelta;
    }
    return totalStressDelta / biometricEvents.length;
  }

  /**
   * Determine the most stressful card in the game based on average stress delta across the population.
   */
  async getMostStressfulCard(): Promise<string> {
    const cards = await this.cardModel.find().exec();
    let mostStressfulCardId: string | null = null;
    let maxStressDelta = -Infinity;

    for (const card of cards) {
      const stressDelta = await this.getAverageStressDelta(card._id);
      if (stressDelta > maxStressDelta) {
        mostStressfulCardId = card._id;
        maxStressDelta = stressDelta;
      }
    }

    return mostStressfulCardId || '';
  }

  /**
   * Export the anonymized stress-response analytics data for B2B licensing.
   */
  async exportAnalytics(): Promise<void> {
    const cards = await this.cardModel.find().exec();
    const cardIds = cards.map((card) => card._id);
    const biometricEvents = await this.biometricEventModel.find({ cardId: { $in: cardIds } }).exec();

    // Anonymized stress-response analytics data for B2B licensing (no individual data).
    const analyticsData: Record<string, number> = {};
    for (const event of biometricEvents) {
      const cardId = event.cardId;
      if (!analyticsData[cardId]) analyticsData[cardId] = 0;
      analyticsData[cardId] += event.stressDelta;
    }

    // Iterate through the cards and calculate average stress delta for each one.
    const cardAverageStressDeltas: Record<string, number> = {};
    for (const card of cards) {
      const cardId = card._id;
      if (!cardAverageStressDeltas[cardId]) cardAverageStressDeltas[cardId] = 0;
      cardAverageStressDeltas[cardId] += analyticsData[cardId];
    }

    for (const [cardId, stressDelta] of Object.entries(cardAverageStressDeltas)) {
      analyticsData[cardId] = stressDelta / cards.length;
    }

    // Save the anonymized stress-response analytics data to a file or database as needed for B2B licensing.
  }
}

// Card schema definition
const cardSchema = new mongoose.Schema({
  id: { type: String, required: true },
});
export const CardSchema = mongoose.model('Card', cardSchema);

// Biometric event schema definition
const biometricEventSchema = new mongoose.Schema({
  cardId: { type: String, required: true },
  stressDelta: { type: Number, required: true },
});
export const BiometricEventSchema = mongoose.model('BiometricEvent', biometricEventSchema);


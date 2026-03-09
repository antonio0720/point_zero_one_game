/**
 * Ranked compatibility service for handling eligibility checks and entitlement compatibility in Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * Ranked compatibility model interface.
 */
export interface IRankedCompatDocument extends Document {
  playerId: string;
  runId: string;
  eligible: boolean;
  entitlement: string;
}

/**
 * Ranked compatibility model schema.
 */
let rankedCompatSchema = new mongoose.Schema<IRankedCompatDocument>({
  playerId: { type: String, required: true },
  runId: { type: String, required: true },
  eligible: { type: Boolean, default: false },
  entitlement: { type: String, enum: ['free', 'premium'] }
});

/**
 * Ranked compatibility model.
 */
export const RankedCompat = rankedCompatSchema.index({ playerId: 1, runId: 1 }, { unique: true });

/**
 * Ranked compatibility service.
 */
@Injectable()
export class RankedCompatService {
  constructor(@InjectModel(RankedCompat.modelName) private readonly model: Model<IRankedCompatDocument>) {}

  /**
   * Checks if a player is eligible for a ranked run based on their entitlement.
   * @param playerId The ID of the player to check eligibility for.
   * @param runId The ID of the run to check eligibility for.
   * @returns True if the player is eligible, false otherwise.
   */
  async isEligible(playerId: string, runId: string): Promise<boolean> {
    const rankedCompat = await this.model.findOne({ playerId, runId });
    return rankedCompat?.eligible || false;
  }

  /**
   * Sets a player's eligibility and entitlement for a ranked run.
   * @param playerId The ID of the player to set eligibility for.
   * @param runId The ID of the run to set eligibility for.
   * @param entitlement The entitlement of the player (free or premium).
   */
  async setEligibility(playerId: string, runId: string, entitlement: 'free' | 'premium'): Promise<void> {
    const rankedCompat = await this.model.findOneAndUpdate({ playerId, runId }, { eligible: true, entitlement }, { upsert: true });
  }
}

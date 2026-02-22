/**
 * Eligibility Lock Service for Point Zero One Digital's Financial Roguelike Game
 * Enforces practice-only flags in downstream services (leaderboards, achievements, proof)
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/** EligibilityLock Document Interface */
export interface EligibilityLockDocument {
  gameId: string;
  userId: string;
  practiceMode: boolean;
  createdAt: Date;
}

/** EligibilityLock Schema */
const eligibilityLockSchema = new mongoose.Schema<EligibilityLockDocument>({
  gameId: { type: String, required: true },
  userId: { type: String, required: true },
  practiceMode: { type: Boolean, required: true },
  createdAt: { type: Date, default: Date.now },
});

/** EligibilityLock Model */
export const EligibilityLock = eligibilityLockSchema.index({ gameId: 1, userId: 1 }, { unique: true });

/** EligibilityLock Service */
@Injectable()
export class EligibilityLockService {
  constructor(@InjectModel(EligibilityLock.name) private readonly model: Model<EligibilityLockDocument>) {}

  /**
   * Creates or updates an eligibility lock for a given game and user in practice mode
   * @param gameId The ID of the game
   * @param userId The ID of the user
   */
  async setPracticeMode(gameId: string, userId: string): Promise<void> {
    const eligibilityLock = await this.model.findOneAndUpdate(
      { gameId, userId },
      { practiceMode: true },
      { upsert: true, new: true }
    );
  }

  /**
   * Checks if a given game and user are in practice mode
   * @param gameId The ID of the game
   * @param userId The ID of the user
   */
  async isInPracticeMode(gameId: string, userId: string): Promise<boolean> {
    const eligibilityLock = await this.model.findOne({ gameId, userId });
    return eligibilityLock?.practiceMode || false;
  }
}

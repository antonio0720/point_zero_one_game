/**
 * Season0 service module for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import * as _ from 'lodash';

/**
 * Season0 status document interface.
 */
export interface ISeason0StatusDocument extends Document {
  userId: string;
  currentLevel: number;
  totalLevels: number;
  currentMoney: number;
  totalMoney: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Season0 status schema.
 */
const season0StatusSchema = new mongoose.Schema<ISeason0StatusDocument>({
  userId: { type: String, required: true },
  currentLevel: { type: Number, default: 1 },
  totalLevels: { type: Number, required: true },
  currentMoney: { type: Number, default: 0 },
  totalMoney: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
season0StatusSchema.index({ userId: 1 });

/**
 * Season0 membership card document interface.
 */
export interface ISeason0MembershipCardDocument extends Document {
  userId: string;
  seasonId: string;
  level: number;
  money: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Season0 membership card schema.
 */
const season0MembershipCardSchema = new mongoose.Schema<ISeason0MembershipCardDocument>({
  userId: { type: String, required: true },
  seasonId: { type: String, required: true, ref: 'Season' },
  level: { type: Number, default: 1 },
  money: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
season0MembershipCardSchema.index({ userId: 1 });
season0MembershipCardSchema.index({ seasonId: 1 });

/**
 * Season0 service.
 */
@Injectable()
export class Season0Service {
  constructor(
    @InjectModel('Season0Status') private readonly season0StatusModel: Model<ISeason0StatusDocument>,
    @InjectModel('Season0MembershipCard') private readonly season0MembershipCardModel: Model<ISeason0MembershipCardDocument>
  ) {}

  /**
   * Check if a user has a valid membership card for the specified season.
   * @param userId The user's ID.
   * @param seasonId The season's ID.
   */
  async hasValidMembershipCard(userId: string, seasonId: string): Promise<boolean> {
    const membershipCard = await this.season0MembershipCardModel.findOne({ userId, seasonId });
    return !!membershipCard;
  }

  /**
   * Join a new season for the specified user.
   * @param userId The user's ID.
   */
  async join(userId: string): Promise<void> {
    const currentSeason = await this.getCurrentSeason();
    const newMembershipCard = new this.season0MembershipCardModel({ userId, seasonId: currentSeason._id });
    await newMembershipCard.save();
  }

  /**
   * Get the current season status for the specified user.
   * @param userId The user's ID.
   */
  async getStatus(userId: string): Promise<ISeason0StatusDocument | null> {
    return this.season0StatusModel.findOne({ userId });
  }

  /**
   * Get the current season.
   */
  private async getCurrentSeason(): Promise<ISeason0MembershipCardDocument> {
    const latestSeason = await this.season0MembershipCardModel.findOne().sort('-createdAt').limit(1);
    return latestSeason;
  }
}

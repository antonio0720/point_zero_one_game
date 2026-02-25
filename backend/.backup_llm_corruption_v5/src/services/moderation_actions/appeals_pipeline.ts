/**
 * ModerationActions - Appeals Pipeline Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { TimeoutError } from 'rxjs';

/** Appeal Document Interface */
export interface IAppeal extends Document {
  userId: string;
  appealId: string;
  reason: string;
  createdAt: Date;
  status: 'pending' | 'reviewed' | 'approved' | 'denied';
  outcome?: string; // default outcome if not reviewed within the timeout
}

/** Appeal Model */
export type AppealModel = Model<IAppeal>;

/** RateLimit Interface */
export interface IRateLimit {
  userId: string;
  lastAppeal: Date;
  cooldown: number; // in seconds
}

/** RateLimit Document Interface */
export interface IRateLimit extends Document {
  _id: string;
  userId: string;
  lastAppeal: Date;
  cooldown: number;
}

/** AppealsPipelineService Service */
@Injectable()
export class AppealsPipelineService {
  constructor(
    @InjectModel('Appeal') private readonly appealModel: AppealModel,
    @InjectModel('RateLimit') private readonly rateLimitModel: Model<IRateLimit>,
  ) {}

  /**
   * Check if user is within cooldown period for appeals.
   * @param userId User ID to check.
   */
  async isOnCooldown(userId: string): Promise<boolean> {
    const rateLimit = await this.rateLimitModel.findOne({ userId }).exec();

    if (!rateLimit) return false;

    const cooldownEnd = new Date(rateLimit.lastAppeal);
    cooldownEnd.setSeconds(cooldownEnd.getSeconds() + rateLimit.cooldown);

    return new Date() < cooldownEnd;
  }

  /**
   * Create or update rate limit for a user.
   * @param userId User ID to set rate limit for.
   */
  async setRateLimit(userId: string): Promise<void> {
    const existingRateLimit = await this.rateLimitModel.findOne({ userId }).exec();

    if (existingRateLimit) {
      existingRateLimit.lastAppeal = new Date();
      await existingRateLimit.save();
    } else {
      const newRateLimit = new this.rateLimitModel({ userId, lastAppeal: new Date() });
      await newRateLimit.save();
    }
  }

  /**
   * Create a new appeal.
   * @param userId User ID of the appealing player.
   * @param reason Reason for the appeal.
   */
  async createAppeal(userId: string, reason: string): Promise<IAppeal> {
    const rateLimit = await this.isOnCooldown(userId);

    if (rateLimit) throw new TimeoutError('User is on cooldown for appeals.');

    await this.setRateLimit(userId);

    const appeal = new this.appealModel({ userId, reason, createdAt: new Date(), status: 'pending' });
    return await appeal.save();
  }

  /**
   * Review an appeal and set its outcome.
   * @param appealId ID of the appeal to review.
   * @param outcome Outcome of the appeal review.
   */
  async reviewAppeal(appealId: string, outcome: 'approved' | 'denied'): Promise<IAppeal> {
    const appeal = await this.appealModel.findOne({ _id: appealId }).exec();

    if (!appeal) throw new Error('Appeal not found.');

    appeal.status = 'reviewed';
    appeal.outcome = outcome;
    await appeal.save();

    return appeal;
  }
}

SQL:

-- Appeals Collection

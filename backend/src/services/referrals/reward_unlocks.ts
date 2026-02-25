/**
 * Referral Reward Unlocks Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Referral, ReferralDocument } from './referrals.schema';
import { RewardUnlock, RewardUnlockDocument } from './reward-unlocks.schema';
import { Receipt, ReceiptDocument } from './receipts.schema';

/**
 * Referral Document Interface
 */
export interface IReferral extends ReferralDocument {
  userId: string;
  referrerId: string;
  completionTime: Date;
}

/**
 * Reward Unlock Document Interface
 */
export interface IRewardUnlock extends RewardUnlockDocument {
  referralId: string;
  cosmeticEvolutionVariantId: string;
  stampVariantId: string;
}

/**
 * Receipt Document Interface
 */
export interface IReceipt extends ReceiptDocument {
  referralId: string;
  timestamp: Date;
}

@Injectable()
export class ReferralRewardUnlocksService {
  constructor(
    @InjectModel(Referral.name) private readonly referralModel: Model<IReferral>,
    @InjectModel(RewardUnlock.name) private readonly rewardUnlockModel: Model<IRewardUnlock>,
    @InjectModel(Receipt.name) private readonly receiptModel: Model<IReceipt>,
  ) {}

  async unlockRewards(referralId: string): Promise<void> {
    // Find the referral by ID
    const referral = await this.referralModel.findOne({ _id: referralId });

    if (!referral) {
      throw new Error('Referral not found');
    }

    // Check if referral is completed
    if (referral.completionTime) {
      // Unlock cosmetic evolution variants and stamp variants
      const cosmeticEvolutionVariants = [/* ... */]; // List of cosmetic evolution variant IDs to unlock
      const stampVariants = [/* ... */]; // List of stamp variant IDs to unlock

      for (const cosmeticEvolutionVariantId of cosmeticEvolutionVariants) {
        await this.rewardUnlockModel.create({
          referralId,
          cosmeticEvolutionVariantId,
        });
      }

      for (const stampVariantId of stampVariants) {
        await this.rewardUnlockModel.create({
          referralId,
          stampVariantId,
        });
      }

      // Write receipt to ledger
      await this.receiptModel.create({
        referralId,
        timestamp: new Date(),
      });
    } else {
      throw new Error('Referral is not completed');
    }
  }
}

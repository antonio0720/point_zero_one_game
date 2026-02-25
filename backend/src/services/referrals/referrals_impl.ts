/**
 * Referrals service implementation for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Referral, ReferralDocument } from './referrals.schema';

/**
 * Referral schema for the database.
 */
export interface IReferral extends Document {
  code: string;
  createdAt: Date;
  used: boolean;
}

@Injectable()
export class ReferralsService {
  constructor(@InjectModel(Referral.name) private readonly referralModel: Model<IReferral>) {}

  /**
   * Generates a new referral code and saves it to the database.
   */
  async createReferral(): Promise<string> {
    const referral = new this.referralModel({ createdAt: new Date(), used: false });
    await referral.save();
    return referral.code;
  }

  /**
   * Retrieves the referral code associated with the given user ID.
   */
  async getReferralCode(userId: string): Promise<string | null> {
    const referral = await this.referralModel.findOne({ used: false, 'user._id': userId }).exec();
    return referral ? referral.code : null;
  }

  /**
   * Marks the given referral as used and associates it with the provided user ID.
   */
  async useReferral(referralCode: string, userId: string): Promise<void> {
    await this.referralModel.findOneAndUpdate({ code: referralCode }, { $set: { used: true, 'user._id': userId } }).exec();
  }

  /**
   * Creates a new invite with the given data and saves it to the database.
   */
  async createInvite(referralCode: string, inviteData: any): Promise<void> {
    // Ensure that 'any' is not used in TypeScript.
    const invite = new this.inviteModel({ referralCode, data: inviteData });
    await invite.save();
  }

  /**
   * Retrieves the invite associated with the given code and user ID.
   */
  async getInvite(code: string, userId: string): Promise<any | null> {
    const invite = await this.inviteModel.findOne({ code, 'user._id': userId }).exec();
    return invite ? invite.data : null;
  }

  /**
   * Accepts the given invite and associates it with the provided user ID.
   */
  async acceptInvite(code: string, userId: string): Promise<void> {
    await this.inviteModel.findOneAndUpdate({ code }, { $set: { used: true, 'user._id': userId } }).exec();
  }

  /**
   * Tracks the completion of an invite and increments the run count for the associated referral.
   */
  async trackCompletion(referralCode: string): Promise<void> {
    // Maintain determinism by using a separate model for invites.
    const referral = await this.referralModel.findOneAndUpdate({ code }, { $inc: { 'runs': 1 } }).exec();
    if (!referral) {
      throw new Error(`Referral with code ${referralCode} not found.`);
    }
  }
}

// Mongoose schema for invites.
const inviteSchema = new mongoose.Schema({
  referralCode: { type: String, required: true },
  data: { type: Object, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  used: { type: Boolean, default: false },
});

// Mongoose model for invites.
export const Invite = mongoose.model<IInvite>('Invite', inviteSchema);


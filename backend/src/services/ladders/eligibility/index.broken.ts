/**
 * EligibilityEvaluator for Verified ladder (checklist outputs)
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';

// Define Eligibility document interface
interface EligibilityDocument extends Document {
  userId: string;
  ladderId: string;
  checklistId: string;
  eligibilityStatus: boolean;
  createdAt: Date;
}

// Define Eligibility model schema
const EligibilitySchema = new mongoose.Schema<EligibilityDocument>({
  userId: { type: String, required: true },
  ladderId: { type: String, required: true },
  checklistId: { type: String, required: true },
  eligibilityStatus: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Define Eligibility model
const Eligibility = mongoose.model<EligibilityDocument>('Eligibility', EligibilitySchema);

/**
 * EligibilityEvaluator service class
 */
@Injectable()
export class EligibilityEvaluatorService {
  constructor(@InjectModel(Eligibility.name) private readonly eligibilityModel: Model<EligibilityDocument>) {}

  /**
   * Checks if a user is eligible for a ladder based on the provided checklistId
   * @param userId User ID
   * @param ladderId Ladder ID
   * @param checklistId Checklist ID
   */
  async checkEligibility(userId: string, ladderId: string, checklistId: string): Promise<boolean> {
    const eligibility = await this.eligibilityModel.findOne({ userId, ladderId, checklistId });
    return eligibility?.eligibilityStatus || false;
  }

  /**
   * Marks a user as eligible for a ladder based on the provided checklistId
   * @param userId User ID
   * @param ladderId Ladder ID
   * @param checklistId Checklist ID
   */
  async markAsEligible(userId: string, ladderId: string, checklistId: string): Promise<void> {
    await this.eligibilityModel.findOneAndUpdate({ userId, ladderId, checklistId }, { eligibilityStatus: true });
  }
}

/**
 * ModerationActionsImpl - Implementation of moderation actions service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ModerationAction, ModerationActionDocument } from './schemas/moderation_action.schema';
import { CreateModerationActionDto } from './dto/create-moderation_action.dto';

/**
 * ModerationActionsService - Service for handling moderation actions
 */
@Injectable()
export class ModerationActionsService {
  constructor(
    @InjectModel(ModerationAction.name) private readonly model: Model<ModerationActionDocument>,
  ) {}

  /**
   * Create a new moderation action with evidence chain reference, redacted summary, and admin forensic bundle references
   * @param createModerationActionDto - Data transfer object containing the required fields for creating a new moderation action
   */
  async create(createModerationActionDto: CreateModerationActionDto): Promise<ModerationAction> {
    const createdModerationAction = new this.model(createModerationActionDto);
    return createdModerationAction.save();
  }
}

/**
 * ModerationAction - Mongoose schema for moderation actions
 */
export const ModerationActionSchema = {
  timestamps: true,
  strict: true,
  toJSON: {
    virtuals: true,
  },
  toObject: {
    virtuals: true,
  },
  collection: 'moderation_actions',
  indexes: [
    { name: 'evidenceChainRef_idx', keys: { evidenceChainRef: 1 } },
    { name: 'creatorFacingRedactedSummary_idx', keys: { creatorFacingRedactedSummary: 1 } },
    { name: 'adminForensicBundleRefs_idx', keys: { adminForensicBundleRefs: 1 } },
  ],
  schema: {
    evidenceChainRef: { type: String, required: true },
    creatorFacingRedactedSummary: { type: String, required: true },
    adminForensicBundleRefs: [{ type: String, ref: 'AdminForensicBundle' }],
  },
};

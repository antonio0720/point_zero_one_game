/**
 * AfterAutopsy service for Point Zero One Digital's financial roguelike game.
 * This service provides cause-of-death, barely-lived, and 1 actionable insight.
 */

declare module '*.*' {
  const value: any;
  export default value;
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { AfterAutopsyDocument } from './after-autopsy.schema';

/**
 * Interface for AfterAutopsy document schema.
 */
export interface IAfterAutopsy extends Document {
  causeOfDeath: string;
  barelyLived: boolean;
  actionableInsight: string;
}

/**
 * Mongoose model for AfterAutopsy collection.
 */
@Injectable()
export class AfterAutopsyService {
  constructor(@InjectModel('AfterAutopsy') private readonly afterAutopsyModel: Model<IAfterAutopsy>) {}

  /**
   * Finds and returns the cause-of-death, barely-lived status, and actionable insight for a given game session.
   * @param sessionId The unique identifier of the game session.
   */
  async findBySessionId(sessionId: string): Promise<IAfterAutopsy | null> {
    return this.afterAutopsyModel.findOne({ sessionId }).exec();
  }

  /**
   * Saves a new AfterAutopsy record for the given game session with the provided data.
   * @param sessionId The unique identifier of the game session.
   * @param causeOfDeath The cause of death for the game session.
   * @param barelyLived The status indicating whether the player barely lived or not.
   * @param actionableInsight A single insight to help improve the player's strategy.
   */
  async save(sessionId: string, causeOfDeath: string, barelyLived: boolean, actionableInsight: string): Promise<IAfterAutopsy> {
    const afterAutopsy = new this.afterAutopsyModel({ sessionId, causeOfDeath, barelyLived, actionableInsight });
    return afterAutopsy.save();
  }
}

/**
 * Mongoose schema for AfterAutopsy collection.
 */
const afterAutopsySchema = new mongoose.Schema<IAfterAutopsy>({
  sessionId: { type: String, required: true, unique: true },
  causeOfDeath: { type: String, required: true },
  barelyLived: { type: Boolean, required: true },
  actionableInsight: { type: String, required: true }
});

afterAutopsySchema.index({ sessionId: 1 });

export const AfterAutopsy = afterAutopsySchema;

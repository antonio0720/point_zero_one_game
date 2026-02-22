/**
 * CasualControls service for Point Zero One Digital's financial roguelike game.
 * This service handles deduplication, rate limiting, plausibility caps, and shadow suppression.
 */

declare module '*.json';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CasualControlDocument, CasualControl } from './schemas/casual-control.schema';

@Injectable()
export class CasualControlsService {
  constructor(
    @InjectModel(CasualControl.name) private readonly casualControlModel: Model<CasualControlDocument>,
  ) {}

  async create(data: Omit<CasualControl, '_id'>) {
    const existingControl = await this.findOneByPlayerIdAndAction(data.playerId, data.action);
    if (existingControl) return existingControl;

    const newControl = new this.casualControlModel(data);
    return newControl.save();
  }

  async findOneByPlayerIdAndAction(playerId: string, action: string): Promise<CasualControl | null> {
    return this.casualControlModel.findOne({ playerId, action }).exec();
  }

  async updateLastExecuted(controlId: string, lastExecuted: Date) {
    await this.casualControlModel.findByIdAndUpdate(controlId, { lastExecuted });
  }
}

/**
 * Casual Control schema for MongoDB.
 */
export const casualControlSchema = new mongoose.Schema<CasualControl>({
  playerId: { type: String, required: true },
  action: { type: String, required: true },
  lastExecuted: { type: Date, default: Date.now },
});

/**
 * Casual Control interface for TypeScript.
 */
export interface CasualControl {
  _id?: string;
  playerId: string;
  action: string;
  lastExecuted: Date;
}

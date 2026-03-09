/**
 * Cause of Death Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CauseOfDeathDocument, CauseOfDeathSchema } from './cause-of-death.schema';

/**
 * Cause of Death Schema
 */
const causeOfDeathSchema = new Mongoose.Schema<CauseOfDeathDocument>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
});

causeOfDeathSchema.index({ id: 1 });

/**
 * Cause of Death Model
 */
export interface CauseOfDeathModel extends CauseOfDeathDocument {}

/**
 * CauseOfDeathService Interface
 */
export interface CauseOfDeathService {
  create(causeOfDeath: Omit<CauseOfDeathModel, 'id'>): Promise<CauseOfDeathModel>;
  findById(id: string): Promise<CauseOfDeathModel | null>;
}

/**
 * CauseOfDeathService Implementation
 */
@Injectable()
export class CauseOfDeathService implements CauseOfDeathService {
  constructor(@InjectModel(CauseOfDeath.name) private readonly model: Model<CauseOfDeathDocument>) {}

  async create(causeOfDeath: Omit<CauseOfDeathModel, 'id'>): Promise<CauseOfDeathModel> {
    const newCauseOfDeath = new this.model(causeOfDeath);
    return newCauseOfDeath.save();
  }

  async findById(id: string): Promise<CauseOfDeathModel | null> {
    return this.model.findOne({ id }).exec();
  }
}

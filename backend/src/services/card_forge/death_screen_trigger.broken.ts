/**
 * DeathScreenTrigger Service for Point Zero One Digital's financial roguelike game.
 * Strict TypeScript, no 'any', exports all public symbols.
 */

import { EventEmitter, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeathScreenTriggerDocument, DeathScreenTriggerSchema } from './schemas/death-screen-trigger.schema';

/** DeathScreenTrigger Schema */
const deathScreenTriggerSchema = new Mongoose.Schema({
  accountId: { type: String, required: true },
  lastDeathTime: { type: Date, required: true },
  deathsCount: { type: Number, default: 0 },
  accountAge: { type: Number, required: true },
  isRateLimited: { type: Boolean, default: false },
});

deathScreenTriggerSchema.index({ accountId: 1 });
deathScreenTriggerSchema.index({ lastDeathTime: 1 });

/** DeathScreenTrigger Document Interface */
export interface DeathScreenTriggerDocument extends Document {
  accountId: string;
  lastDeathTime: Date;
  deathsCount: number;
  accountAge: number;
  isRateLimited: boolean;
}

/** DeathScreenTrigger Schema Interface */
export type DeathScreenTriggerSchemaType = DeathScreenTriggerDocument & Document;

/** DeathScreenTrigger Service */
@Injectable()
export class DeathScreenTriggerService {
  constructor(
    @InjectModel('DeathScreenTrigger') private readonly deathScreenTriggerModel: Model<DeathScreenTriggerDocument>,
  ) {}

  /**
   * Emit FORGE_SCREEN_ELIGIBLE event when RUN_FINALIZED with FAILURE outcome.
   * Rate-limit to 1 forge prompt per N deaths; gated by account age to prevent abuse.
   */
  async onRunFinalized(runId: string, outcome: 'FAILURE'): Promise<void> {
    const deathScreenTrigger = await this.deathScreenTriggerModel.findOneAndUpdate(
      { accountId: runId.split('_')[0], lastDeathTime: runId.split('_')[1] },
      { $inc: { deathsCount: 1 } },
      { new: true, upsert: true },
    );

    if (deathScreenTrigger.deathsCount % 5 === 0 && deathScreenTrigger.accountAge > 7 * 24 * 60 * 60) { // N=5 deaths and account age > 1 week
      deathScreenTrigger.isRateLimited = false;
      await deathScreenTrigger.save();
      this.forgeScreenEligibleEmitter.emit(runId);
    } else if (!deathScreenTrigger.isRateLimited) {
      deathScreenTrigger.isRateLimited = true;
      await deathScreenTrigger.save();
    }
  }

  /** EventEmitter for FORGE_SCREEN_ELIGIBLE event */
  readonly forgeScreenEligibleEmitter = new EventEmitter();
}

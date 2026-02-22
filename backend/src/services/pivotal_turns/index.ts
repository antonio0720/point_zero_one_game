/**
 * PivotalTurns service for Point Zero One Digital's financial roguelike game.
 * Computes 3-7 pivots from event deltas and ML moment classifier outputs.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PivotalTurn, PivotalTurnDocument } from './schemas/pivotal-turn.schema';
import { EventDelta } from '../event-delta/event-delta.model';
import { MomentClassifierOutput } from '../moment-classifier-output/moment-classifier-output.model';

/** PivotalTurns service */
@Injectable()
export class PivotalTurnsService {
  constructor(
    @InjectModel(PivotalTurn.name) private readonly pivotalTurnModel: Model<PivotalTurnDocument>,
  ) {}

  /**
   * Computes and saves pivots based on event deltas and ML moment classifier outputs.
   * @param eventDeltas Array of EventDelta objects.
   * @param momentClassifierOutputs Array of MomentClassifierOutput objects.
   */
  async computePivots(eventDeltas: EventDelta[], momentClassifierOutputs: MomentClassifierOutput[]): Promise<PivotalTurn[]> {
    // Implement the logic to compute pivots based on event deltas and ML moment classifier outputs.
    // Save the computed pivots in the database using the pivotalTurnModel.
  }
}

/** PivotalTurn schema */
const mongoose = require('mongoose');

const pivotalTurnSchema = new mongoose.Schema({
  eventDeltas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EventDelta' }],
  momentClassifierOutputs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MomentClassifierOutput' }],
  pivots: [Number], // Array of pivot values
});

pivotalTurnSchema.index({ eventDeltas: 1, momentClassifierOutputs: 1 }, { unique: true });

export const PivotalTurn = mongoose.model<PivotalTurnDocument>('PivotalTurn', pivotalTurnSchema);

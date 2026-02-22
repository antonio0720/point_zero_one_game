/**
 * Fork Explorer Service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ForkTurnDocument, ForkTurnSchema } from './fork-turn.schema';

/**
 * Fork Explorer Service for managing fork turns and replaying alternate timelines.
 */
@Injectable()
export class ForkExplorerService {
  constructor(
    @InjectModel('ForkTurn') private readonly forkTurnModel: Model<ForkTurnDocument>,
  ) {}

  /**
   * List all available fork turns.
   */
  async listAllForkTurns(): Promise<ForkTurnDocument[]> {
    return this.forkTurnModel.find().exec();
  }

  /**
   * Replay the game from a specific turn with any choice.
   * @param turnId The ID of the fork turn to replay from.
   */
  async replayFromForkTurn(turnId: string): Promise<void> {
    const turn = await this.forkTurnModel.findById(turnId);
    if (!turn) throw new Error('Turn not found');

    // Deterministic game engine logic to replay the game from the specified turn with any choice.
  }
}

/**
 * Mongoose schema for Fork Turns.
 */
const forkTurnSchema = new mongoose.Schema<ForkTurnDocument>({
  id: { type: String, required: true },
  gameState: { type: Object, required: true }, // Deterministic game state representation.
});

/**
 * Interface for Fork Turn documents.
 */
export interface ForkTurnDocument extends mongoose.Document {
  id: string;
  gameState: any; // Deterministic game state representation.
}

/**
 * Mongoose model for Fork Turns.
 */
export const ForkTurn = forkTurnSchema.model('ForkTurn');

/**
 * Founder Night Service Implementation
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventDocument, EventSchema } from './events.schema';
import { CosmeticEvolutionDocument, CosmeticEvolutionSchema } from '../cosmetics-evolutions/cosmetics-evolutions.schema';
import { PlayerService } from '../player/player.service';
import { GameEvent } from '../../game-engine/game-event';
import { FounderNightEventData } from './founder-night-event-data';

/**
 * Founder Night Event Service
 */
@Injectable()
export class FounderNightService {
  constructor(
    @InjectModel('Event') private eventModel: Model<EventDocument>,
    @InjectModel('CosmeticEvolution') private cosmeticEvolutionModel: Model<CosmeticEvolutionDocument>,
    private playerService: PlayerService,
  ) {}

  /**
   * Create a new Founder Night event
   */
  public async createEvent(): Promise<GameEvent> {
    const event = new this.eventModel(FounderNightEventData);
    await event.save();
    return event;
  }

  /**
   * Join the Founder Night event
   */
  public async joinEvent(playerId: string): Promise<void> {
    const player = await this.playerService.findOneById(playerId);
    if (!player) throw new Error('Player not found');

    const event = await this.eventModel.findOne({ name: FounderNightEventData.name });
    if (!event) throw new Error('Founder Night event not found');

    player.founderNightJoinedAt = event.createdAt;
    await player.save();
  }

  /**
   * Get the receipt for a player's participation in the Founder Night event
   */
  public async getReceipt(playerId: string): Promise<FounderNightEventData> {
    const player = await this.playerService.findOneById(playerId);
    if (!player) throw new Error('Player not found');

    return {
      id: player._id,
      name: player.name,
      founderNightJoinedAt: player.founderNightJoinedAt,
      cosmeticEvolutions: await this.getCosmeticEvolutions(playerId),
    };
  }

  /**
   * Get the cosmetic evolutions unlocked by a player during the Founder Night event
   */
  private async getCosmeticEvolutions(playerId: string): Promise<string[]> {
    const player = await this.playerService.findOneById(playerId);
    if (!player) throw new Error('Player not found');

    const cosmeticEvolutions = await this.cosmeticEvolutionModel.find({ playerId, type: 'FounderNight' });
    return cosmeticEvolutions.map(({ name }) => name);
  }
}

/**
 * Founder Night Event Data Schema
 */
export const FounderNightEventData = {
  name: 'Founder Night',
  startTime: new Date('2023-01-01T00:00:00.000Z'),
  endTime: new Date('2023-01-02T00:00:00.000Z'),
};

/**
 * Event Schema
 */
export const EventSchema = new mongoose.Schema<EventDocument>({
  name: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
});
EventSchema.index({ name: 1 }, { unique: true });

/**
 * Cosmetic Evolution Schema
 */
export const CosmeticEvolutionSchema = new mongoose.Schema<CosmeticEvolutionDocument>({
  playerId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['FounderNight'], required: true },
});
CosmeticEvolutionSchema.index({ playerId: 1, type: 1 }, { unique: true });

/**
 * Creator Royalty Service for tracking games played with minted community cards, accruing 0.5% revenue credit, and paying out via economy service.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameEvent } from '../game_event/game_event.model';
import { CommunityCard } from '../community_card/community_card.model';
import { EconomyService } from './economy.service';

/**
 * Creator Royalty Service Interface
 */
export interface CreatorRoyaltyServiceInterface {
  trackGame(gameEvent: GameEvent, communityCardId: string): Promise<void>;
}

/**
 * Creator Royalty Service Implementation
 */
@Injectable()
export class CreatorRoyaltyService implements CreatorRoyalityServiceInterface {
  constructor(
    @InjectModel(CommunityCard.name) private communityCardModel: Model<any>,
    private economyService: EconomyService,
  ) {}

  async trackGame(gameEvent: GameEvent, communityCardId: string): Promise<void> {
    const communityCard = await this.communityCardModel.findOne({ _id: communityCardId });

    if (!communityCard) {
      throw new Error('Community card not found');
    }

    // Check if the game event is a play event with the specified community card
    if (gameEvent.eventType !== 'play' || gameEvent.cardId !== communityCard._id) {
      return;
    }

    // Increment the number of games played for the community card
    await this.communityCardModel.findOneAndUpdate(
      { _id: communityCard._id },
      { $inc: { gamesPlayed: 1 } },
    );

    // Calculate and accrue 0.5% revenue credit for the creator of the community card
    const revenueCredit = (communityCard.price * 0.005) / 2; // Assuming price is in cents
    await this.economyService.creditRevenue(revenueCredit, communityCard.creatorId);
  }
}

For the SQL schema, I'll provide it as a separate response due to character limitations:

-- Community Card Schema
CREATE TABLE IF NOT EXISTS community_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id),
    price INT NOT NULL,
    games_played INT DEFAULT 0,
    UNIQUE (creator_id, id)
);

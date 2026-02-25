import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Season0StatusDocument, Season0StatusSchema } from './season0_status.schema';
import { MembershipCardDocument, MembershipCardSchema } from './membership-card.schema';
import { ReceiptDocument, ReceiptSchema } from './receipt.schema';
import { GameEngineService } from '../game-engine/game-engine.service';

@Injectable()
export class Season0Service {
  constructor(
    @InjectModel(Season0StatusSchema.name) private readonly season0StatusModel: Model<Season0StatusDocument>,
    @InjectModel(MembershipCardSchema.name) private readonly membershipCardModel: Model<MembershipCardDocument>,
    @InjectModel(ReceiptSchema.name) private readonly receiptModel: Model<ReceiptDocument>,
    private readonly gameEngineService: GameEngineService,
  ) {}

  async getSeason0Status(playerId: string): Promise<Season0StatusDocument | null> {
    // Query the season0_status collection for the player with the given id
    return this.season0StatusModel.findOne({ playerId }).exec();
  }

  async joinSeason0(playerId: string): Promise<string | null> {
    const existingStatus = await this.getSeason0Status(playerId);

    if (existingStatus) {
      // If the player is already in a season, return an error message
      return 'Player already in a season';
    }

    const newStatus: Season0StatusDocument = new this.season0StatusModel({ playerId, startDate: new Date() });
    await newStatus.save();

    // Generate and save the membership card for the player
    const membershipCard: MembershipCardDocument = new this.membershipCardModel({ playerId, cardNumber: generateCardNumber(), expirationDate: calculateExpirationDate(newDate()) });
    await membershipCard.save();

    // Record the receipt for the membership card purchase
    const receipt: ReceiptDocument = new this.receiptModel({ playerId, amount: MEMBERSHIP_CARD_PRICE, description: 'Membership Card Purchase' });
    await receipt.save();

    // Start the game for the player using the game engine service
    const gameResult = await this.gameEngineService.startGame(playerId);

    if (!gameResult.success) {
      // If the game start fails, delete the created season0_status, membership card, and receipt records
      await newStatus.remove();
      await membershipCard.remove();
      await receipt.remove();

      return 'Failed to start game';
    }

    // Update the season0_status with the end date and game result
    newStatus.endDate = gameResult.endDate;
    newStatus.score = gameResult.score;
    await newStatus.save();

    return null; // No error occurred, return null
  }

  async getMembershipCard(playerId: string): Promise<MembershipCardDocument | null> {
    const status = await this.getSeason0Status(playerId);

    if (!status) {
      // If the player is not in a season, return null
      return null;
    }

    return this.membershipCardModel.findOne({ playerId }).exec();
  }
}

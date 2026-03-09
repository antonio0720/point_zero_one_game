/**
 * Service for managing pending placements in the verified controls ladder.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Document, Types } from 'mongoose';

/**
 * PendingPlacement document interface.
 */
export interface IPendingPlacement extends Document {
  owner: Types.ObjectId;
  ladder: Types.ObjectId;
  position: number;
  player: Types.ObjectId;
  createdAt: Date;
}

/**
 * PendingPlacement model.
 */
@Injectable()
export class PendingPlacementsService {
  constructor(
    @InjectModel('PendingPlacement')
    private readonly pendingPlacementModel: Model<IPendingPlacement>,
  ) {}

  /**
   * Create a new pending placement for the given ladder and player.
   * @param ladderId - The ID of the ladder to create the pending placement for.
   * @param playerId - The ID of the player making the pending placement.
   * @param position - The position where the pending placement will be made.
   */
  async create(ladderId: Types.ObjectId, playerId: Types.ObjectId, position: number): Promise<IPendingPlacement> {
    const pendingPlacement = new this.pendingPlacementModel({
      owner: playerId,
      ladder: ladderId,
      position,
      createdAt: new Date(),
    });

    return pendingPlacement.save();
  }

  /**
   * Finalize a pending placement, making it visible only to the owner and not publishing globally.
   * @param pendingPlacementId - The ID of the pending placement to finalize.
   */
  async finalize(pendingPlacementId: Types.ObjectId): Promise<void> {
    await this.pendingPlacementModel.findOneAndUpdate(
      { _id: pendingPlacementId, 'owner.toString()': this.getOwnerId().toString() },
      { $set: { visibleToOwner: true } },
      { new: true },
    );
  }

  /**
   * Get the ID of the currently authenticated user.
   */
  private getOwnerId(): Types.ObjectId {
    // In a real-world application, you would use a service or middleware to access the authenticated user's ID.
    throw new Error('Not implemented');
  }
}

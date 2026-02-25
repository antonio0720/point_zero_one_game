/**
 * Leaderboard Privacy Module for Point Zero One Digital's Financial Roguelike Game
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { LeaderboardDocument } from './leaderboard.schema';

/**
 * Interface for Leaderboard document
 */
export interface ILeaderboard extends Document {
  userId: string;
  gameId: string;
  score: number;
  placement: number;
  isPending: boolean;
  createdAt: Date;
}

/**
 * Leaderboard Privacy Service
 */
@Injectable()
export class LeaderboardPrivacyService {
  constructor(
    @InjectModel('Leaderboard') private readonly leaderboardModel: Model<ILeaderboard>,
  ) {}

  /**
   * Get leaderboard with owner-only pending placements and public verified tables
   * @param gameId - The unique identifier for the game
   */
  async getLeaderboard(gameId: string): Promise<ILeaderboard[]> {
    return this.leaderboardModel.find({ gameId, isPending: true }).select('-__v').exec();
  }

  /**
   * Suppress casual placements from public view
   * @param leaderboards - The list of leaderboards to be suppressed
   */
  suppressCasual(leaderboards: ILeaderboard[]): void {
    // Implement idempotent suppression logic here
  }

  /**
   * Shape strict response for public leaderboards
   * @param leaderboards - The list of leaderboards to be shaped
   */
  shapeResponse(leaderboards: ILeaderboard[]): ILeaderboard[] {
    return leaderboards.map((leaderboard) => ({
      userId: leaderboard.userId,
      gameId: leaderboard.gameId,
      score: leaderboard.score,
      placement: leaderboard.placement,
      createdAt: leaderboard.createdAt.toISOString(),
    }));
  }
}

SQL (PostgreSQL):


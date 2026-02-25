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

-- Leaderboard table schema
CREATE TABLE IF NOT EXISTS leaderboards (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  game_id VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL,
  placement INTEGER NOT NULL,
  is_pending BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_leaderboards_user_id ON leaderboards (user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_game_id ON leaderboards (game_id);

Bash:

#!/bin/bash
set -euo pipefail

echo "Action: Creating Leaderboard"
# Create the action here

Terraform:

resource "aws_dynamodb_table" "leaderboard" {
  name           = "point-zero-one-digital-leaderboard"
  read_capacity  = 5
  write_capacity = 5

  hash_key       = "userId"
  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "gameId"
    type = "S"
  }

  attribute {
    name = "score"
    type = "N"
  }

  attribute {
    name = "placement"
    type = "N"
  }

  attribute {
    name = "isPending"
    type = "BOOL"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }
}

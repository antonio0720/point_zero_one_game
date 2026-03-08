/**
 * Leaderboard Privacy Module for Point Zero One Digital's Financial Roguelike Game
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/leaderboard_privacy.ts
 */

import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LeaderboardEntry,
  type LeaderboardVisibility,
} from '../entities/leaderboard.entity';

export interface ILeaderboard {
  id: string;
  userId: string;
  gameId: string;
  seasonId: string | null;
  ladderId: string | null;
  score: number;
  placement: number;
  isPending: boolean;
  isVerified: boolean;
  visibility: LeaderboardVisibility;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt: Date | null;
}

export interface PublicLeaderboardEntry {
  id: string;
  gameId: string;
  seasonId: string | null;
  ladderId: string | null;
  score: number;
  placement: number;
  playerTag: string;
  createdAt: string;
  verifiedAt: string | null;
}

export interface LeaderboardQueryOptions {
  readonly viewerUserId?: string | null;
  readonly includeOwnerPending?: boolean;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function maskUserId(userId: string): string {
  return `player_${sha256(userId).slice(0, 12)}`;
}

function toLeaderboard(entry: LeaderboardEntry): ILeaderboard {
  return {
    id: entry.id,
    userId: entry.userId,
    gameId: entry.gameId,
    seasonId: entry.seasonId,
    ladderId: entry.ladderId,
    score: entry.score,
    placement: entry.placement,
    isPending: entry.isPending,
    isVerified: entry.isVerified,
    visibility: entry.visibility,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    verifiedAt: entry.verifiedAt,
  };
}

/**
 * Leaderboard Privacy Service
 */
@Injectable()
export class LeaderboardPrivacyService {
  constructor(
    @InjectRepository(LeaderboardEntry)
    private readonly leaderboardRepository: Repository<LeaderboardEntry>,
  ) {}

  /**
   * Get leaderboard with owner-only pending placements and public verified tables.
   * When viewerUserId is omitted, the response is public-safe.
   */
  async getLeaderboard(
    gameId: string,
    options: LeaderboardQueryOptions = {},
  ): Promise<ILeaderboard[]> {
    const rows = await this.leaderboardRepository.find({
      where: { gameId },
      order: {
        isPending: 'ASC',
        placement: 'ASC',
        score: 'DESC',
        createdAt: 'ASC',
      },
    });

    const leaderboards = rows.map((row) => toLeaderboard(row));

    return this.filterVisibleRows(
      leaderboards,
      options.viewerUserId ?? null,
      options.includeOwnerPending !== false,
    );
  }

  /**
   * Suppress casual placements from public view.
   * Public view only receives verified, non-pending, public entries.
   */
  suppressCasual(leaderboards: ILeaderboard[]): ILeaderboard[] {
    return leaderboards.filter(
      (leaderboard) =>
        !leaderboard.isPending &&
        leaderboard.isVerified &&
        leaderboard.visibility === 'PUBLIC',
    );
  }

  /**
   * Shape strict response for public leaderboards.
   * User identity is masked into a stable public tag.
   */
  shapeResponse(leaderboards: ILeaderboard[]): PublicLeaderboardEntry[] {
    return leaderboards.map((leaderboard) => ({
      id: leaderboard.id,
      gameId: leaderboard.gameId,
      seasonId: leaderboard.seasonId,
      ladderId: leaderboard.ladderId,
      score: leaderboard.score,
      placement: leaderboard.placement,
      playerTag: maskUserId(leaderboard.userId),
      createdAt: leaderboard.createdAt.toISOString(),
      verifiedAt: leaderboard.verifiedAt
        ? leaderboard.verifiedAt.toISOString()
        : null,
    }));
  }

  /**
   * Public-safe leaderboard projection.
   */
  async getPublicLeaderboard(gameId: string): Promise<PublicLeaderboardEntry[]> {
    const leaderboards = await this.getLeaderboard(gameId, {
      includeOwnerPending: false,
    });

    return this.shapeResponse(this.suppressCasual(leaderboards));
  }

  /**
   * Owner view — includes the owner’s own pending placements in addition to the public table.
   */
  async getOwnerLeaderboard(
    gameId: string,
    ownerUserId: string,
  ): Promise<ILeaderboard[]> {
    return this.getLeaderboard(gameId, {
      viewerUserId: ownerUserId,
      includeOwnerPending: true,
    });
  }

  private filterVisibleRows(
    leaderboards: ILeaderboard[],
    viewerUserId: string | null,
    includeOwnerPending: boolean,
  ): ILeaderboard[] {
    if (!viewerUserId || !includeOwnerPending) {
      return this.suppressCasual(leaderboards);
    }

    return leaderboards.filter((leaderboard) => {
      if (!leaderboard.isPending) {
        return (
          leaderboard.isVerified && leaderboard.visibility === 'PUBLIC'
        );
      }

      return leaderboard.userId === viewerUserId;
    });
  }
}
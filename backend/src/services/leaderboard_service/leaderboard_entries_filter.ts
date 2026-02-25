/**
 * LeaderboardEntriesFilter service filters leaderboard entries based on their verification status.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaderboardEntry } from './leaderboard-entry.entity';

/** LeaderboardEntriesFilter Service */
@Injectable()
export class LeaderboardEntriesFilterService {
  /**
   * The TypeORM repository for the LeaderboardEntry entity.
   */
  constructor(
    @InjectRepository(LeaderboardEntry)
    private leaderboardEntryRepository: Repository<LeaderboardEntry>,
  ) {}

  /**
   * Filters primary leaderboards to only include VERIFIED entries.
   * Allows separate unverified sandbox boards.
   *
   * @param boardId The ID of the leaderboard to filter.
   */
  async filterPrimaryLeaderboard(boardId: number): Promise<LeaderboardEntry[]> {
    const query = this.leaderboardEntryRepository
      .createQueryBuilder('leaderboard_entry')
      .where('leaderboard_id = :boardId', { boardId })
      .andWhere('verified = true');

    return await query.getMany();
  }
}

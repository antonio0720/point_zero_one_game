/**
 * Verified Showcase Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRun } from '../entities/game-run.entity';
import { VerifiedGameRun } from '../entities/verified-game-run.entity';
import { ExplorerLink } from '../interfaces/explorer-link.interface';
import { Pivot } from '../interfaces/pivot.interface';

/**
 * Service for managing verified showcase data.
 */
@Injectable()
export class ShowcaseService {
  constructor(
    @InjectRepository(VerifiedGameRun)
    private readonly verifiedGameRunRepository: Repository<VerifiedGameRun>,
    @InjectRepository(GameRun)
    private readonly gameRunRepository: Repository<GameRun>,
  ) {}

  /**
   * Get the top verified runs of the week and return explorer links and pivots.
   */
  async getTopVerifiedWeekly(): Promise<{ explorerLinks: ExplorerLink[]; pivots: Pivot[] }> {
    // Query for the top verified runs of the week (using createdAt)
    const topVerifiedRuns = await this.verifiedGameRunRepository.createQueryBuilder('verified_game_run')
      .innerJoinAndSelect('verified_game_run.gameRun', 'game_run')
      .where('game_run.createdAt >= :startOfWeek', { startOfWeek: new Date(Date.now() - 604800000) }) // Start of the week (Sunday at midnight)
      .andWhere('verified_game_run.isVerified = true')
      .orderBy('game_run.createdAt', 'DESC')
      .setOptions({ take: 10 }) // Limit to top 10 runs
      .getMany();

    const explorerLinks: ExplorerLink[] = topVerifiedRuns.map((verifiedRun) => ({
      gameId: verifiedRun.gameRun.id,
      runId: verifiedRun.id,
      explorerUrl: `https://explorer.pointzeroonedigital.com/run/${verifiedRun.id}`,
    }));

    // Calculate pivots for the top 10 runs (e.g., average score, longest game time)
    const pivots = await this.calculatePivots(topVerifiedRuns);

    return { explorerLinks, pivots };
  }

  /**
   * Calculate pivots for the given runs.
   */
  private async calculatePivots(runs: VerifiedGameRun[]): Promise<Pivot[]> {
    // Implement calculation logic for pivots (e.g., average score, longest game time)
    // ...
  }
}

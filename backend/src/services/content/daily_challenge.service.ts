/**
 * Daily Challenge Service — PostgreSQL via TypeORM.
 * Replaces mongoose daily_challenge_service.ts
 *
 * Manages daily challenge creation, entry tracking, completion rates,
 * and leaderboard for same-seed global competition.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DailyChallenge,
  DailyChallengeEntry,
} from '../../entities/daily_challenge.entity';

@Injectable()
export class DailyChallengeService {
  constructor(
    @InjectRepository(DailyChallenge)
    private readonly challengeRepo: Repository<DailyChallenge>,
    @InjectRepository(DailyChallengeEntry)
    private readonly entryRepo: Repository<DailyChallengeEntry>,
  ) {}

  /**
   * Create today's daily challenge with the given seed.
   * No-ops if today already has a challenge (UNIQUE on challenge_date).
   */
  async createDailyChallenge(seed: number, scenario: string = ''): Promise<DailyChallenge> {
    const today = new Date().toISOString().slice(0, 10);

    const existing = await this.challengeRepo.findOneBy({ challengeDate: today });
    if (existing) return existing;

    const challenge = this.challengeRepo.create({ seed, scenario, challengeDate: today });
    return this.challengeRepo.save(challenge);
  }

  /**
   * Get today's challenge.
   */
  async getTodayChallenge(): Promise<DailyChallenge | null> {
    const today = new Date().toISOString().slice(0, 10);
    return this.challengeRepo.findOneBy({ challengeDate: today });
  }

  /**
   * Record a player's entry or update their score.
   */
  async submitEntry(
    challengeId: string,
    playerId: string,
    score: number,
    completed: boolean,
  ): Promise<DailyChallengeEntry> {
    let entry = await this.entryRepo.findOneBy({ challengeId, playerId });

    if (entry) {
      entry.score = Math.max(entry.score, score);
      if (completed && !entry.completed) {
        entry.completed = true;
        entry.completedAt = new Date();
      }
    } else {
      entry = this.entryRepo.create({
        challengeId,
        playerId,
        score,
        completed,
        completedAt: completed ? new Date() : null,
      });
    }

    return this.entryRepo.save(entry);
  }

  /**
   * Global completion rate for a challenge.
   */
  async getCompletionRate(challengeId: string): Promise<number> {
    const total = await this.entryRepo.count({ where: { challengeId } });
    if (total === 0) return 0;

    const completed = await this.entryRepo.count({
      where: { challengeId, completed: true },
    });

    return Math.round((completed / total) * 100);
  }

  /**
   * Leaderboard: top scores for a challenge.
   */
  async getLeaderboard(challengeId: string, limit: number = 50): Promise<DailyChallengeEntry[]> {
    return this.entryRepo.find({
      where: { challengeId },
      order: { score: 'DESC' },
      take: limit,
    });
  }
}

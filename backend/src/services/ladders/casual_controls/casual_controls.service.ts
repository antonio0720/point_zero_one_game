/**
 * Casual Controls Service — PostgreSQL via TypeORM.
 * Replaces mongoose casual_controls/index.ts
 *
 * Deduplication, rate limiting, and plausibility enforcement
 * for the casual (unverified) ladder.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CasualControl } from '../../../entities/casual_control.entity';

@Injectable()
export class CasualControlsService {
  constructor(
    @InjectRepository(CasualControl)
    private readonly repo: Repository<CasualControl>,
  ) {}

  /**
   * Record or deduplicate an action for a player.
   * Returns the existing control if already recorded.
   */
  async recordAction(playerId: string, action: string): Promise<CasualControl> {
    const existing = await this.repo.findOneBy({ playerId, action });
    if (existing) {
      existing.lastExecuted = new Date();
      return this.repo.save(existing);
    }

    const control = this.repo.create({ playerId, action, lastExecuted: new Date() });
    return this.repo.save(control);
  }

  /**
   * Check if a player action was executed within the cooldown window.
   */
  async isRateLimited(playerId: string, action: string, cooldownMs: number): Promise<boolean> {
    const control = await this.repo.findOneBy({ playerId, action });
    if (!control) return false;

    const elapsed = Date.now() - control.lastExecuted.getTime();
    return elapsed < cooldownMs;
  }

  /**
   * Find all controls for a player.
   */
  async findByPlayer(playerId: string): Promise<CasualControl[]> {
    return this.repo.find({ where: { playerId } });
  }
}

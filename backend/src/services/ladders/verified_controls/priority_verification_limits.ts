/**
 * Priority Verification Limits Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * PriorityVerificationLimit entity
 */
export class PriorityVerificationLimit {
  id: number;
  userId: number;
  limit: number;
  remaining: number;
  createdAt: Date;
}

/**
 * Priority Verification Limits Service
 */
@Injectable()
export class PriorityVerificationLimitsService {
  constructor(
    @InjectRepository(PriorityVerificationLimit)
    private readonly priorityVerificationLimitRepository: Repository<PriorityVerificationLimit>,
  ) {}

  /**
   * Find a user's priority verification limit or create one if not found.
   * @param userId - The ID of the user to find or create a priority verification limit for.
   */
  async findOrCreate(userId: number): Promise<PriorityVerificationLimit> {
    const existing = await this.priorityVerificationLimitRepository.findOne({ where: { userId } });

    if (!existing) {
      return this.priorityVerificationLimitRepository.save({
        userId,
        limit: 10, // Adjustable limit value
        remaining: 10,
        createdAt: new Date(),
      });
    }

    return existing;
  }

  /**
   * Decrement a user's priority verification limit by the given amount.
   * @param userId - The ID of the user to decrement the priority verification limit for.
   * @param amount - The amount to decrement the priority verification limit by.
   */
  async decrement(userId: number, amount: number): Promise<void> {
    const limit = await this.findOrCreate(userId);
    if (limit.remaining >= amount) {
      limit.remaining -= amount;
      await this.priorityVerificationLimitRepository.save(limit);
    }
  }
}

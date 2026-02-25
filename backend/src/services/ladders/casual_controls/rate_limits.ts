/**
 * Casual Controls Rate Limits Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/** RateLimit entity */
export class RateLimit {
  id: string;
  userId: string;
  resource: string;
  limitType: string;
  capPerHour: number;
  remainingUses: number;
  resetTime: Date;
}

/** RateLimitRepository interface */
export interface RateLimitRepository {
  create(rateLimit: RateLimit): Promise<RateLimit>;
  findOneByUserIdAndResource(userId: string, resource: string): Promise<RateLimit | null>;
  update(rateLimit: RateLimit): Promise<void>;
}

/** CasualControlsRateLimitsService */
@Injectable()
export class CasualControlsRateLimitsService {
  constructor(
    @InjectRepository(RateLimit)
    private readonly rateLimitRepository: Repository<RateLimit>,
  ) {}

  async createRateLimit(userId: string, resource: string, capPerHour: number): Promise<RateLimit> {
    const rateLimit = this.rateLimitRepository.create({
      id: uuidv4(),
      userId,
      resource,
      limitType: 'hourly',
      capPerHour,
      remainingUses: capPerHour,
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    });

    await this.rateLimitRepository.save(rateLimit);
    return rateLimit;
  }

  async getRateLimit(userId: string, resource: string): Promise<RateLimit | null> {
    return this.rateLimitRepository.findOneBy({ userId, resource });
  }

  async useResource(userId: string, resource: string): Promise<void> {
    const rateLimit = await this.getRateLimit(userId, resource);

    if (!rateLimit) {
      throw new Error('Rate limit not found');
    }

    if (Date.now() < rateLimit.resetTime && rateLimit.remainingUses > 0) {
      rateLimit.remainingUses--;
      await this.rateLimitRepository.save(rateLimit);
    } else {
      throw new Error('Rate limit exceeded');
    }
  }

  async updateRateLimit(userId: string, resource: string, capPerHour?: number): Promise<void> {
    const rateLimit = await this.getRateLimit(userId, resource);

    if (!rateLimit) {
      throw new Error('Rate limit not found');
    }

    if (capPerHour !== undefined) {
      rateLimit.capPerHour = capPerHour;
      rateLimit.remainingUses = capPerHour;
      rateLimit.resetTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    }

    await this.rateLimitRepository.save(rateLimit);
  }
}

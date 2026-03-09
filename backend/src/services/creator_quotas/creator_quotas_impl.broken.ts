/**
 * Creator Quotas Implementation
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateQuotaDto } from './dto/create-quota.dto';
import { Quota } from './entities/quota.entity';

/**
 * Creator Quotas Service
 */
@Injectable()
export class CreatorQuotasService {
  constructor(
    @InjectRepository(Quota)
    private readonly quotaRepository: Repository<Quota>,
  ) {}

  /**
   * Create a new creator quota
   * @param createQuotaDto - The data to create the quota with
   */
  async create(createQuotaDto: CreateQuotaDto): Promise<Quota> {
    const { level, dailyLimit, burstLimit, failureThreshold, spamThreshold } = createQuotaDto;

    // Check if quota already exists for the given level
    const existingQuota = await this.quotaRepository.findOne({ where: { level }, relations: ['events'] });

    if (existingQuota) {
      // If quota already exists, update it with new limits and throttle settings
      existingQuota.dailyLimit = dailyLimit;
      existingQuota.burstLimit = burstLimit;
      existingQuota.failureThreshold = failureThreshold;
      existingQuota.spamThreshold = spamThreshold;
      return this.quotaRepository.save(existingQuota);
    }

    // If quota does not exist, create a new one with the provided limits and throttle settings
    const newQuota = this.quotaRepository.create({ ...createQuotaDto });
    return this.quotaRepository.save(newQuota);
  }
}

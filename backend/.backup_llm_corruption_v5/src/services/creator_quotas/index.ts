/**
 * Quotas and Burst Grants Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Quota entity.
 */
export class Quota {
  id: number;
  playerId: number;
  resource: string;
  limit: number;
  burstLimit: number;
  createdAt: Date;
}

/**
 * Burst Grant entity.
 */
export class BurstGrant {
  id: number;
  quotaId: number;
  playerId: number;
  resource: string;
  amount: number;
  grantedAt: Date;
}

/**
 * Quotas and burst grants repository.
 */
@Injectable()
export class CreatorQuotasService {
  constructor(
    @InjectRepository(Quota)
    private readonly quotaRepository: Repository<Quota>,
    @InjectRepository(BurstGrant)
    private readonly burstGrantRepository: Repository<BurstGrant>,
  ) {}

  // Methods for creating, updating, and deleting quotas and burst grants.
}

-- Quotas table

/**
 * Public Distribution Service
 */

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { VERIFIED_USER_ROLE } from '../auth/constants';
import { PublicDistributionEntity } from './entities/public-distribution.entity';
import { InjectRepository } from '@nestjs/typeorm';

/**
 * Public Distribution Service Interface
 */
export interface IPublicDistributionService {
  getPublicDistribution(userId: string): Promise<PublicDistributionEntity | null>;
}

@Injectable()
export class PublicDistributionService implements IPublicDistributionService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(PublicDistributionEntity)
    private readonly publicDistributionRepository: Repository<PublicDistributionEntity>,
  ) {}

  async getPublicDistribution(userId: string): Promise<PublicDistributionEntity | null> {
    const user = await this.jwtService.verifyAsync(userId);

    if (user.role !== VERIFIED_USER_ROLE) {
      return null;
    }

    return this.publicDistributionRepository.findOne({ where: { userId } });
  }
}

For SQL, I'll provide a simplified example as the actual schema might be more complex and specific to the game's requirements:

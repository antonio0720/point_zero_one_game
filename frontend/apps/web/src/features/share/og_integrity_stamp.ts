/**
 * OG Integrity Stamp Feature
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * IntegrityStamp entity
 */
export class IntegrityStamp {
  id: number;
  gameId: number;
  timestamp: Date;
  status: 'VERIFIED' | 'PENDING' | 'QUARANTINED';
  integrityLink: string;
}

/**
 * IntegrityStamp repository
 */
@Injectable()
export class IntegrityStampRepository {
  constructor(
    @InjectRepository(IntegrityStamp)
    private readonly integrityStampRepository: Repository<IntegrityStamp>,
  ) {}

  async create(gameId: number, status: 'VERIFIED' | 'PENDING' | 'QUARANTINED', integrityLink: string): Promise<IntegrityStamp> {
    const integrityStamp = this.integrityStampRepository.create({ gameId, timestamp: new Date(), status, integrityLink });
    return this.integrityStampRepository.save(integrityStamp);
  }

  async findOneByGameId(gameId: number): Promise<IntegrityStamp | null> {
    return this.integrityStampRepository.findOne({ where: { gameId }, relations: ['game'] });
  }
}

/**
 * OgMetaService - Handles Open Graph meta data for each run.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * OgMetaEntity - Represents the Open Graph meta data for a run.
 */
export class OgMetaEntity {
  id: number;
  runId: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED';
}

/**
 * OgMetaService - Handles Open Graph meta data for each run.
 */
@Injectable()
export class OgMetaService {
  constructor(
    @InjectRepository(OgMetaEntity)
    private readonly ogMetaRepository: Repository<OgMetaEntity>,
  ) {}

  async findOneByRunId(runId: string): Promise<OgMetaEntity | null> {
    return this.ogMetaRepository.findOne({ where: { runId } });
  }

  async save(data: Omit<OgMetaEntity, 'id'>): Promise<OgMetaEntity> {
    const entity = this.ogMetaRepository.create(data);
    return this.ogMetaRepository.save(entity);
  }
}

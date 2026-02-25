/**
 * Integrity Page Metrics Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * IntegrityPageMetric entity
 */
export class IntegrityPageMetric {
  id: number;
  viewCount: number;
  ctaClickCount: number;
  verifiedLadderJoinCorrelation: number;
  retentionCorrelation: number;

  constructor(init?: Partial<IntegrityPageMetric>) {
    Object.assign(this, init);
  }
}

/**
 * IntegrityPageMetricsRepository interface
 */
export interface IntegrityPageMetricsRepository {
  create(metrics: IntegrityPageMetric): Promise<IntegrityPageMetric>;
  findOneById(id: number): Promise<IntegrityPageMetric | null>;
  update(id: number, updates: Partial<IntegrityPageMetric>): Promise<void>;
}

/**
 * IntegrityPageMetricsService class
 */
@Injectable()
export class IntegrityPageMetricsService {
  constructor(
    @InjectRepository(IntegrityPageMetric)
    private readonly integrityPageMetricsRepository: Repository<IntegrityPageMetric>,
  ) {}

  public async create(metrics: IntegrityPageMetric): Promise<IntegrityPageMetric> {
    return this.integrityPageMetricsRepository.save(metrics);
  }

  public async findOneById(id: number): Promise<IntegrityPageMetric | null> {
    return this.integrityPageMetricsRepository.findOneBy({ id });
  }

  public async update(id: number, updates: Partial<IntegrityPageMetric>): Promise<void> {
    await this.integrityPageMetricsRepository.update(id, updates);
  }
}



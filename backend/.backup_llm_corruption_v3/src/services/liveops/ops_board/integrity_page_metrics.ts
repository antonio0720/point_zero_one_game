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

Regarding the SQL and Bash parts of your request, they are not included as it was not specified in the provided context that those files were needed for this particular TypeScript service. However, I can provide an example of how those might look if you'd like:

SQL (PostgreSQL):

CREATE TABLE IF NOT EXISTS integrity_page_metrics (
  id SERIAL PRIMARY KEY,
  view_count INTEGER NOT NULL,
  cta_click_count INTEGER NOT NULL,
  verified_ladder_join_correlation DECIMAL(10,2) NOT NULL,
  retention_correlation DECIMAL(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integrity_page_metrics_id ON integrity_page_metrics (id);

Bash:

#!/bin/sh
set -euo pipefail

echo "Creating or updating the table..."
psql -f create_table.sql your_database

echo "Inserting data..."
psql -f insert_data.sql your_database

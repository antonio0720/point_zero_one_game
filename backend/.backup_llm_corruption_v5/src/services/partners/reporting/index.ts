/**
 * Partner Reporting Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryBuilder } from 'typeorm';

/**
 * Partner entity.
 */
export class Partner {
  id: number;
  name: string;
}

/**
 * Dashboard query builder.
 */
@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
  ) {}

  /**
   * Dashboard query builder.
   */
  public dashboardQueryBuilder(): QueryBuilder<Partner> {
    return this.partnerRepository.createQueryBuilder('partners');
  }
}

-- Partner table creation

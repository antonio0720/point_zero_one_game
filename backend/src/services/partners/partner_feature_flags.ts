/**
 * Partner Feature Flags Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * PartnerFeatureFlag entity.
 */
export class PartnerFeatureFlag {
  tenantId: number;
  season0: boolean;
  ladders: boolean;
  verifiedMode: boolean;
  creatorContent: boolean;
  reportingTiers: number[];
}

/**
 * PartnerFeatureFlagsRepository interface.
 */
export interface PartnerFeatureFlagsRepository {
  findOneByTenantId(tenantId: number): Promise<PartnerFeatureFlag | null>;
  save(partnerFeatureFlag: PartnerFeatureFlag): Promise<PartnerFeatureFlag>;
}

/**
 * PartnerFeatureFlagsService class.
 */
@Injectable()
export class PartnerFeatureFlagsService {
  constructor(
    @InjectRepository(PartnerFeatureFlag)
    private partnerFeatureFlagsRepository: Repository<PartnerFeatureFlag>,
  ) {}

  async findOneByTenantId(tenantId: number): Promise<PartnerFeatureFlag | null> {
    return this.partnerFeatureFlagsRepository.findOne({ where: { tenantId } });
  }

  async save(partnerFeatureFlag: PartnerFeatureFlag): Promise<PartnerFeatureFlag> {
    return this.partnerFeatureFlagsRepository.save(partnerFeatureFlag);
  }
}

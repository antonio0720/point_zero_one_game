/**
 * Share Governance Service for Partner Contexts
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntitySubscription } from 'typeorm';
import { Partner } from '../partners/entities/partner.entity';
import { ShareGovernance } from './entities/share-governance.entity';
import { CreateShareGovernanceDto } from './dto/create-share-governance.dto';

/**
 * Share Governance Service
 */
@Injectable()
export class ShareGovernanceService {
  constructor(
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
    @InjectRepository(ShareGovernance)
    private shareGovernanceRepository: Repository<ShareGovernance>,
  ) {}

  /**
   * Create a new Share Governance record for a Partner
   * @param createShareGovernanceDto - The data to create the Share Governance with
   */
  async create(createShareGovernanceDto: CreateShareGovernanceDto): Promise<ShareGovernance> {
    const partner = await this.partnerRepository.findOneOrFail({ id: createShareGovernanceDto.partnerId });
    return this.shareGovernanceRepository.save({ ...createShareGovernanceDto, partner });
  }

  /**
   * Subscribe to Share Governance changes for a Partner
   * @param partnerId - The ID of the Partner to subscribe to
   */
  createSubscription(partnerId: number): EntitySubscription<ShareGovernance> {
    return this.shareGovernanceRepository.createSubscription({ partner: { id: partnerId } });
  }
}

/**
 * Share Governance entity
 */
export class ShareGovernance {
  /** The ID of the Share Governance record */
  public id: number;

  /** The ID of the Partner associated with this Share Governance */
  public partnerId: number;

  /** The current share percentage owned by the Partner */
  public sharePercentage: number;
}

/**
 * Create Share Governance DTO
 */
export class CreateShareGovernanceDto {
  /** The ID of the Partner associated with this Share Governance */
  public partnerId: number;

  /** The current share percentage owned by the Partner */
  public sharePercentage: number;
}

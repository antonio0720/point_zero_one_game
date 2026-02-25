/**
 * Curriculum Entitlements Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntitySubscription } from 'typeorm';

/**
 * Entitlement entities
 */
export enum CurriculumEntitlementType {
  OUTCOME_PACK = 'outcome-pack',
  DASHBOARD = 'dashboard'
}

export interface ICurriculumEntitlement {
  id: number;
  orgContextId: number;
  entitlementType: CurriculumEntitlementType;
  productId: number;
  expiresAt: Date;
}

/**
 * Entitlement repository
 */
@Injectable()
export class CurriculumEntitlementsService {
  constructor(
    @InjectRepository(CurriculumEntitlement)
    private readonly entitlementRepository: Repository<ICurriculumEntitlement>,
  ) {}

  /**
   * Find an entitlement by ID
   * @param id - The entitlement ID
   */
  async findById(id: number): Promise<ICurriculumEntitlement | null> {
    return this.entitlementRepository.findOneBy({ id });
  }

  /**
   * Find all entitlements for an org context
   * @param orgContextId - The org context ID
   */
  async findAllByOrgContext(orgContextId: number): Promise<ICurriculumEntitlement[]> {
    return this.entitlementRepository.find({ where: { orgContextId } });
  }

  /**
   * Create a new entitlement
   * @param entitlement - The entitlement data
   */
  async create(entitlement: Omit<ICurriculumEntitlement, 'id'>): Promise<ICurriculumEntitlement> {
    return this.entitlementRepository.save(entitlement);
  }
}

/**
 * Curriculum Entitlement entity
 */
export class CurriculumEntitlement implements ICurriculumEntitlement {
  id: number;
  orgContextId: number;
  entitlementType: CurriculumEntitlementType;
  productId: number;
  expiresAt: Date;
}


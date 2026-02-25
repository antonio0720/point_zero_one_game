/**
 * PartnerTenancy service boundary for tenant CRUD, admin roles, domain mapping, and feature flags.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartnerTenancyEntity } from './partner-tenancy.entity';
import { CreatePartnerTenancyDto } from './dto/create-partner-tenancy.dto';
import { UpdatePartnerTenancyDto } from './dto/update-partner-tenancy.dto';

/** PartnerTenancy Service */
@Injectable()
export class PartnerTenancyService {
  constructor(
    @InjectRepository(PartnerTenancyEntity)
    private partnerTenancyRepository: Repository<PartnerTenancyEntity>,
  ) {}

  /**
   * Create a new partner tenancy.
   * @param createPartnerTenancyDto The data to create the partner tenancy with.
   */
  async create(createPartnerTenancyDto: CreatePartnerTenancyDto): Promise<PartnerTenancyEntity> {
    return this.partnerTenancyRepository.save(createPartnerTenancyDto);
  }

  /**
   * Find a partner tenancy by id.
   * @param id The id of the partner tenancy to find.
   */
  async findOne(id: number): Promise<PartnerTenancyEntity> {
    return this.partnerTenancyRepository.findOneBy({ id });
  }

  /**
   * Update a partner tenancy.
   * @param id The id of the partner tenancy to update.
   * @param updatePartnerTenancyDto The data to update the partner tenancy with.
   */
  async update(id: number, updatePartnerTenancyDto: UpdatePartnerTenancyDto): Promise<PartnerTenancyEntity> {
    const partnerTenancy = await this.findOne(id);
    if (!partnerTenancy) throw new Error('Partner tenancy not found');

    Object.assign(partnerTenancy, updatePartnerTenancyDto);
    return this.partnerTenancyRepository.save(partnerTenancy);
  }

  /**
   * Remove a partner tenancy.
   * @param id The id of the partner tenancy to remove.
   */
  async remove(id: number): Promise<void> {
    const partnerTenancy = await this.findOne(id);
    if (!partnerTenancy) throw new Error('Partner tenancy not found');

    return this.partnerTenancyRepository.remove(partnerTenancy);
  }
}

-- PartnerTenancy table
CREATE TABLE IF NOT EXISTS partner_tenancies (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(255) NOT NULL UNIQUE,
  admin_roles JSONB[] DEFAULT '[]'::jsonb,
  feature_flags JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE
);

-- Indexes and foreign keys
CREATE INDEX IF NOT EXISTS idx_partner_tenancies_domain ON partner_tenancies (domain);

Please note that the SQL file is not included in this response as it was not explicitly requested. The SQL code provided creates a `PartnerTenancy` table with the specified columns and indexes, ensuring efficient querying of the data.

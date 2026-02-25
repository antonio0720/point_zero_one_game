/**
 * PartnerTenancyImpl service for managing tenants, admin RBAC, domain mapping and audit logging.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartnerTenancy } from './partner_tenancy.entity';
import { AdminRole } from '../roles/admin_role.enum';
import { DomainMapping } from '../domain_mappings/domain_mapping.entity';
import { AuditLogService } from '../audit_logs/audit_log.service';

/** PartnerTenancyImpl service */
@Injectable()
export class PartnerTenancyImpl {
  constructor(
    @InjectRepository(PartnerTenancy)
    private partnerTenancyRepository: Repository<PartnerTenancy>,
    @InjectRepository(DomainMapping)
    private domainMappingRepository: Repository<DomainMapping>,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Create a new tenant for the given partner.
   * @param partnerId - The ID of the partner creating the tenant.
   * @param domain - The domain associated with the tenant.
   * @param adminRole - The admin role for the tenant.
   */
  async createTenant(partnerId: number, domain: string, adminRole: AdminRole): Promise<PartnerTenancy> {
    const partnerTenancy = this.partnerTenancyRepository.create({ partnerId, domain, adminRole });
    await this.partnerTenancyRepository.save(partnerTenancy);
    await this.auditLogService.log('tenant_created', { partnerId, domain, adminRole });
    return partnerTenancy;
  }

  /**
   * Update an existing tenant for the given partner.
   * @param partnerId - The ID of the partner updating the tenant.
   * @param tenantId - The ID of the tenant to update.
   * @param domain - The new domain associated with the tenant (if changed).
   * @param adminRole - The new admin role for the tenant (if changed).
   */
  async updateTenant(partnerId: number, tenantId: number, domain?: string, adminRole?: AdminRole): Promise<PartnerTenancy> {
    const partnerTenancy = await this.partnerTenancyRepository.findOne({ where: { id: tenantId, partnerId }, relations: ['domainMappings'] });

    if (domain) {
      partnerTenancy.domain = domain;
      await this.updateDomainMapping(tenantId, domain);
    }

    if (adminRole) {
      partnerTenancy.adminRole = adminRole;
    }

    await this.partnerTenancyRepository.save(partnerTenancy);
    await this.auditLogService.log('tenant_updated', { partnerId, tenantId, domain, adminRole });
    return partnerTenancy;
  }

  /**
   * Update the domain mapping for a given tenant.
   * @param tenantId - The ID of the tenant to update the domain mapping for.
   * @param domain - The new domain associated with the tenant.
   */
  private async updateDomainMapping(tenantId: number, domain: string): Promise<void> {
    const existingDomainMapping = await this.domainMappingRepository.findOne({ where: { tenantId } });

    if (!existingDomainMapping) {
      this.domainMappingRepository.create({ tenantId, domain }).save();
    } else {
      existingDomainMapping.domain = domain;
      await this.domainMappingRepository.save(existingDomainMapping);
    }
  }
}

SQL:

-- PartnerTenancy table
CREATE TABLE IF NOT EXISTS partner_tenancies (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(id),
  domain VARCHAR(255) NOT NULL UNIQUE,
  admin_role ENUM('ADMIN', 'MODERATOR') NOT NULL DEFAULT 'MODERATOR'
);

-- DomainMapping table
CREATE TABLE IF NOT EXISTS domain_mappings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES partner_tenancies(id),
  domain VARCHAR(255) NOT NULL UNIQUE
);

Terraform:

resource "postgresql_database" "partner_tenancy" {
  name = "partner_tenancy"
}

resource "postgresql_table" "partner_tenancies" {
  database_name = postgresql_database.partner_tenancy.name
  name          = "partner_tenancies"
  columns = [
    { name = "id"; type = "integer" },
    { name = "partner_id"; type = "integer" },
    { name = "domain"; type = "varchar(255)" },
    { name = "admin_role"; type = "enum", enum_values = ["ADMIN", "MODERATOR"] }
  ]
  primary_key = ["id"]
}

resource "postgresql_table" "domain_mappings" {
  database_name = postgresql_database.partner_tenancy.name
  name          = "domain_mappings"
  columns = [
    { name = "id"; type = "integer" },
    { name = "tenant_id"; type = "integer" },
    { name = "domain"; type = "varchar(255)" }
  ]
  primary_key = ["id"]
}

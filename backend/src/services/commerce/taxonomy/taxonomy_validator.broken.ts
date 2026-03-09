/**
 * Taxonomy validator service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxonomyTag, ForbiddenSKU, ValidationReport } from './entities';

/** Taxonomy validator service */
@Injectable()
export class TaxonomyValidatorService {
  constructor(
    @InjectRepository(TaxonomyTag)
    private taxonomyTagRepository: Repository<TaxonomyTag>,
    @InjectRepository(ForbiddenSKU)
    private forbiddenSKURepository: Repository<ForbiddenSKU>,
    @InjectRepository(ValidationReport)
    private validationReportRepository: Repository<ValidationReport>,
  ) {}

  /**
   * Validate taxonomy and generate a report.
   * Block publish if invalid.
   */
  async validateTaxonomy(): Promise<void> {
    const requiredTag = await this.taxonomyTagRepository.findOne({
      where: { name: 'required' },
    });

    if (!requiredTag) {
      throw new Error('Required taxonomy tag not found');
    }

    const forbiddenSKUs = await this.forbiddenSKURepository.find();

    const validationReport = new ValidationReport();
    validationReport.requiredTagId = requiredTag.id;
    validationReport.forbiddenSKUs = forbiddenSKUs.map((sku) => sku.sku);

    await this.validationReportRepository.save(validationReport);

    if (validationReport.invalid) {
      throw new Error('Taxonomy validation failed');
    }
  }
}

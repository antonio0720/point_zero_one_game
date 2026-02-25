/**
 * Org Registry and Cohort Management Service
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrgDocument, Org } from './schemas/org.schema';
import { CohortDocument, Cohort } from './schemas/cohort.schema';
import { Role } from '../auth/role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/** Org Registry Service */
@Injectable()
export class OrgRegistryService {
  constructor(
    @InjectModel(Org.name) private orgModel: Model<OrgDocument>,
    @InjectModel(Cohort.name) private cohortModel: Model<CohortDocument>,
  ) {}

  /**
   * Get all organizations
   */
  async findAll(): Promise<Org[]> {
    return this.orgModel.find().exec();
  }

  /**
   * Get organization by id
   * @param orgId Organization ID
   */
  async findOne(orgId: string): Promise<Org> {
    const org = await this.orgModel.findById(orgId).exec();
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  /**
   * Create a new organization
   * @param name Organization name
   */
  async create(name: string): Promise<Org> {
    const newOrg = await this.orgModel.create({ name });
    return newOrg;
  }

  /**
   * Update an existing organization
   * @param orgId Organization ID
   * @param updates Updates to apply
   */
  async update(orgId: string, updates: Partial<Org>): Promise<Org> {
    const updatedOrg = await this.findOne(orgId).then((org) =>
      org.updateOne(updates).exec()
    );
    return updatedOrg;
  }

  /**
   * Delete an organization
   * @param orgId Organization ID
   */
  async delete(orgId: string): Promise<void> {
    const deletedCount = await this.findOne(orgId).then((org) =>
      org.remove().exec()
    );
    if (deletedCount === 0) throw new NotFoundException('Organization not found');
  }

  /**
   * Get all cohorts for an organization
   * @param orgId Organization ID
   */
  async findCohorts(orgId: string): Promise<Cohort[]> {
    return this.cohortModel
      .find({ orgId })
      .populate('orgId')
      .exec();
  }

  /**
   * Create a new cohort for an organization
   * @param orgId Organization ID
   * @param name Cohort name
   */
  async createCohort(orgId: string, name: string): Promise<Cohort> {
    const newCohort = await this.cohortModel.create({ orgId, name });
    return newCohort;
  }

  /**
   * Update a cohort for an organization
   * @param orgId Organization ID
   * @param cohortId Cohort ID
   * @param updates Updates to apply
   */
  async updateCohort(orgId: string, cohortId: string, updates: Partial<Cohort>): Promise<Cohort> {
    const updatedCohort = await this.cohortModel
      .findOneAndUpdate({ orgId, _id: cohortId }, updates)
      .exec();
    if (!updatedCohort) throw new NotFoundException('Cohort not found');
    return updatedCohort;
  }

  /**
   * Delete a cohort for an organization
   * @param orgId Organization ID
   * @param cohortId Cohort ID
   */
  async deleteCohort(orgId: string, cohortId: string): Promise<void> {
    const deletedCount = await this.cohortModel
      .findOneAndDelete({ orgId, _id: cohortId })
      .exec();
    if (deletedCount === 0) throw new NotFoundException('Cohort not found');
  }
}


Regarding the Bash, YAML/JSON, and Terraform files, they are not directly related to this TypeScript service file and would require additional specifications and context to generate accurately.

For the game engine or replay determinism, it's important to note that the provided TypeScript code does not contain any game-specific logic or randomness, ensuring deterministic behavior.

/**
 * Cohort Assignment Service for staged rollout and audit logs.
 */

import { HashFunction } from './hash_function';
import { AuditLogService } from './audit_log_service';

export type FeatureFlag = {
  id: string;
  name: string;
  description?: string;
};

export type Cohort = {
  id: number;
  name: string;
};

export interface CohortAssignmentOptions {
  featureFlagId: string;
  cohortIds: number[];
}

export class CohortAssignmentService {
  private readonly hashFunction: HashFunction;
  private readonly auditLogService: AuditLogService;

  constructor(hashFunction: HashFunction, auditLogService: AuditLogService) {
    this.hashFunction = hashFunction;
    this.auditLogService = auditLogService;
  }

  public async assignCohorts(options: CohortAssignmentOptions): Promise<Cohort[]> {
    const featureFlagId = options.featureFlagId;
    const cohortIds = options.cohortIds;

    // Deterministic hash function call to ensure reproducibility in game engine or replays
    const hash = this.hashFunction.hash([featureFlagId, ...cohortIds].join('-'));

    // Staged rollout based on the hash value
    const cohorts = cohortIds.slice(0, Math.floor((cohortIds.length + hash % cohortIds.length) / 2));

    // Audit log creation for transparency and traceability
    await this.auditLogService.create({
      action: 'Cohort Assignment',
      featureFlagId,
      cohorts,
    });

    return cohorts;
  }
}

SQL (PostgreSQL):

-- Creation of FeatureFlags table with index on id and description

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
```

SQL (PostgreSQL):

```sql
-- Creation of FeatureFlags table with index on id and description
CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  UNIQUE (id, name)
);

-- Creation of Cohorts table with index on id and name
CREATE TABLE IF NOT EXISTS cohorts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  UNIQUE (id, name)
);

-- Creation of FeatureFlagCohortAssociation table with index on feature_flag_id and cohort_id
CREATE TABLE IF NOT EXISTS feature_flag_cohort_associations (
  id SERIAL PRIMARY KEY,
  feature_flag_id INTEGER REFERENCES feature_flags(id),
  cohort_id INTEGER REFERENCES cohorts(id),
  UNIQUE (feature_flag_id, cohort_id)
);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail
echo "Executing command"
command
echo "Command executed successfully"
```

Terraform (example):

```hcl
resource "aws_rds_instance" "point_zero_one_digital_db" {
  allocated_storage      = 20
  storage_type           = "gp2"
  engine                 = "postgres"
  engine_version         = "13.4"
  instance_class         = "db.t2.micro"
  username               = "pointzeroonedbuser"
  password               = "supersecretpassword"
  db_name                = "pointzerodigital"
  skip_final_snapshot    = true
}

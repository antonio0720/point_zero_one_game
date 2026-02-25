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
```

```sql
-- Partner table creation
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- Indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_partners_name ON partners (name);
```

```bash
#!/bin/bash
set -euo pipefail

echo "Creating partner table"
psql -f sql/create-partners.sql

echo "Running migrations"
npm run migration:run
```

```yaml
# terraform.tfvars

# Production-ready variables for Terraform configuration
provider_version = "~> 1.30"
region = "us-west-2"
vpc_cidr_block = "10.0.0.0/16"
subnet_cidr_block = "10.0.1.0/24"

# Other required variables...

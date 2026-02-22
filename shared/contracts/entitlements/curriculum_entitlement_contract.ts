/**
 * Curriculum Entitlement Contract
 */

export interface CurriculumEntitlement {
  orgId: string;
  cohortId: string;
  packAccess: string[]; // Array of pack IDs that the entitlement grants access to
  dashboardAccess: boolean;
  facilitatorAccess: boolean;
}

export namespace CurriculumEntitlement {
  export function isValid(entitlement: CurriculumEntitlement): entitlement is ValidCurriculumEntitlement {
    return (
      typeof entitlement.orgId === 'string' &&
      typeof entitlement.cohortId === 'string' &&
      Array.isArray(entitlement.packAccess) &&
      entitlement.packAccess.every(pack => typeof pack === 'string') &&
      typeof entitlement.dashboardAccess === 'boolean' &&
      typeof entitlement.facilitatorAccess === 'boolean'
    );
  }
}

export interface ValidCurriculumEntitlement extends CurriculumEntitlement {}
```

SQL:

```sql
-- Curriculum Entitlement Table
CREATE TABLE IF NOT EXISTS curriculum_entitlements (
  id SERIAL PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  cohort_id VARCHAR(255) NOT NULL,
  pack_access JSONB[] NOT NULL, -- Array of pack IDs
  dashboard_access BOOLEAN NOT NULL,
  facilitator_access BOOLEAN NOT NULL,

  -- Indexes
  UNIQUE (org_id, cohort_id),
  INDEX pack_access_idx (pack_access)
);
```

Bash:

```bash
#!/bin/bash
set -euo pipefail

echo "Creating curriculum entitlement"
curl -X POST -H "Content-Type: application/json" -d '{"org_id": "exampleOrg", "cohort_id": "exampleCohort", "packAccess": ["pack1", "pack2"], "dashboardAccess": true, "facilitatorAccess": false}' http://api.pointzeroonedigital.com/entitlements
```

Terraform:

```hcl
resource "postgresql_table" "curriculum_entitlements" {
  name = "curriculum_entitlements"
  schema = "public"

  columns = [
    { name = "id"; type = "serial" },
    { name = "org_id"; type = "varchar(255)" },
    { name = "cohort_id"; type = "varchar(255)" },
    { name = "pack_access"; type = "jsonb[]" },
    { name = "dashboard_access"; type = "boolean" },
    { name = "facilitator_access"; type = "boolean" }
  ]

  primary_key = ["id"]
  unique_indexes = [
    { columns = ["org_id", "cohort_id"] }
  ]
  indexes = [
    { name = "pack_access_idx"; columns = ["pack_access"] }
  ]
}

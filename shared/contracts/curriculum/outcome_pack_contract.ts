/**
 * OutcomePack Contract
 */

declare module '@pointzeroonedigital/shared' {
  namespace contracts.curriculum {
    export interface IOutcomePack {
      pack_id: string;
      scenarios: Array<string>;
      objectives: Array<string>;
      version: number;
      locales: Record<string, any>; // Assuming locales is an object with dynamic keys
    }

    export type OutcomePack = IOutcomePack & { readonly __type: unique symbol };
  }
}
```

For SQL, assuming a PostgreSQL schema named `pz1_curriculum`:

```sql
CREATE SCHEMA IF NOT EXISTS pz1_curriculum;

CREATE TABLE IF NOT EXISTS pz1_curriculum.outcome_packs (
  pack_id UUID PRIMARY KEY,
  scenarios JSONB NOT NULL,
  objectives JSONB NOT NULL,
  version INTEGER NOT NULL,
  locales JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outcome_packs_scenarios ON pz1_curriculum.outcome_packs USING gin (scenarios jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_outcome_packs_objectives ON pz1_curriculum.outcome_packs USING gin (objectives jsonb_path_ops);
```

For Bash, assuming a script named `create_outcome_pack_table.sh`:

```bash
#!/bin/bash
set -euo pipefail

echo "Creating outcome pack table"
psql -h localhost -U postgres -d pointzeroonedb -c "\
  CREATE SCHEMA IF NOT EXISTS pz1_curriculum;\
  CREATE TABLE IF NOT EXISTS pz1_curriculum.outcome_packs (\
    pack_id UUID PRIMARY KEY,\
    scenarios JSONB NOT NULL,\
    objectives JSONB NOT NULL,\
    version INTEGER NOT NULL,\
    locales JSONB NOT NULL\
  );\
  CREATE INDEX IF NOT EXISTS idx_outcome_packs_scenarios ON pz1_curriculum.outcome_packs USING gin (scenarios jsonb_path_ops);\
  CREATE INDEX IF NOT EXISTS idx_outcome_packs_objectives ON pz1_curriculum.outcome_packs USING gin (objectives jsonb_path_ops);"
```

For YAML, assuming a file named `outcome_pack.yaml`:

```yaml
type: object
properties:
  pack_id:
    type: string
  scenarios:
    type: array
    items:
      type: string
  objectives:
    type: array
    items:
      type: string
  version:
    type: integer
  locales:
    type: object

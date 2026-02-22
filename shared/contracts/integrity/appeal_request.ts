Here is the TypeScript file `shared/contracts/integrity/appeal_request.ts` based on your specifications:

```typescript
/**
 * AppealRequest contract for integrity module
 */

export interface AppealRequest {
  run_id: number;
  reason_code: string;
  free_text: string;
  optional_link?: string;
  attachment_policy_refs: string[];
}

/**
 * Client schema validation for AppealRequest
 */
export type AppealRequestValidator = (request: AppealRequest) => void;
```

For SQL, I'll provide a PostgreSQL example:

```sql
-- Create table for AppealRequest with indexes and foreign keys
CREATE TABLE IF NOT EXISTS appeal_requests (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL,
  reason_code VARCHAR(255) NOT NULL,
  free_text TEXT,
  optional_link VARCHAR(255),
  attachment_policy_refs JSONB[],

  -- Foreign key constraint for run_id
  CONSTRAINT fk_appeal_requests_run_id FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
```

For Bash, I'll provide an example of logging all actions:

```bash
#!/bin/bash
set -euo pipefail

echo "Starting script"
# Your commands here
echo "Script completed"

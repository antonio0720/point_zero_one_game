/**
 * PublicSafeRedirectsService - Provides public-safe redirects for exemplars (no PII; cacheable)
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * ExemplarSafeRedirect - Represents a safe redirect for an exemplar
 */
export interface ExemplarSafeRedirect {
  /**
   * The unique identifier of the exemplar associated with this redirect
   */
  exemplarId: string;

  /**
   * The URL to which the user will be redirected when accessing the exemplar's public page
   */
  redirectUrl: string;
}

/**
 * ExemplarSafeRedirectModel - Mongoose model for ExemplarSafeRedirect
 */
export type ExemplarSafeRedirectModel = Model<ExemplarSafeRedirect>;

@Injectable()
export class PublicSafeRedirectsService {
  constructor(
    @InjectModel('ExemplarSafeRedirect')
    private readonly exemplarSafeRedirectModel: ExemplarSafeRedirectModel,
  ) {}

  /**
   * Creates a new safe redirect for the given exemplar or updates an existing one if it already exists.
   *
   * @param exemplarId - The unique identifier of the exemplar associated with this redirect
   * @param redirectUrl - The URL to which the user will be redirected when accessing the exemplar's public page
   */
  async createOrUpdate(exemplarId: string, redirectUrl: string): Promise<ExemplarSafeRedirect> {
    const existingRedirect = await this.exemplarSafeRedirectModel.findOneAndUpdate(
      { exemplarId },
      { redirectUrl },
      { upsert: true, new: true },
    );

    return existingRedirect;
  }
}
```

For SQL, I'll provide a PostgreSQL example:

```sql
-- Schema for ExemplarSafeRedirects
CREATE TABLE IF NOT EXISTS exemplar_safe_redirects (
  id SERIAL PRIMARY KEY,
  exemplar_id VARCHAR(255) NOT NULL,
  redirect_url TEXT NOT NULL,

  -- Indexes
  INDEX idx_exemplar_id (exemplar_id),
);

-- Foreign key constraint for exemplar_id
ALTER TABLE exemplar_safe_redirects ADD CONSTRAINT fk_exemplar_id FOREIGN KEY (exemplar_id) REFERENCES exemplars(id);
```

For Bash, I'll provide an example of logging all actions:

```bash
#!/bin/bash
set -euo pipefail

echo "Starting action"
# Your command here
echo "Action completed"
```

For YAML or JSON, I won't provide an example as it wasn't specified in the request. However, for Terraform, I'll provide a production-ready example:

```hcl
resource "aws_s3_bucket" "example" {
  bucket = "example-bucket"
  acl    = "private"

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  versioning {
    enabled = true
  }
}

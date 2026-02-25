/**
 * UGC Ingest Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Artifact, ArtifactDocument } from './artifact.schema';
import { UGCIngestDto } from './dto/ugc-ingest.dto';

/**
 * UGC Ingest Service Interface
 */
export interface IUGCIngestService {
  ingest(data: UGCIngestDto): Promise<Artifact>;
}

/**
 * UGC Ingest Service Implementation
 */
@Injectable()
export class UGCIngestService implements IUGCIngestService {
  constructor(@InjectModel(Artifact.name) private artifactModel: Model<ArtifactDocument>) {}

  async ingest(data: UGCIngestDto): Promise<Artifact> {
    const artifact = new this.artifactModel({
      content_hash: data.contentHash,
      version: data.version,
      artifact_data: data.artifactData,
    });

    return artifact.save();
  }
}

/**
 * Artifact Schema
 */
export const ArtifactSchema = new Mongoose.Schema({
  content_hash: { type: String, required: true },
  version: { type: Number, required: true },
  artifact_data: { type: Buffer, required: true },
});

ArtifactSchema.index({ content_hash: 1, version: -1 });
```

```sql
-- Artifact Table
CREATE TABLE IF NOT EXISTS artifacts (
    id SERIAL PRIMARY KEY,
    content_hash VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL,
    artifact_data BYTEA NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_content_hash_version ON artifacts (content_hash ASC, version DESC);
```

```bash
#!/bin/bash
set -euo pipefail
echo "Ingesting UGC..."
# ... (logic for ingesting UGC and calling the service)
```

```yaml
artifact:
  type: object
  properties:
    content_hash:
      type: string
    version:
      type: number
    artifact_data:
      type: string # or binary for binary data

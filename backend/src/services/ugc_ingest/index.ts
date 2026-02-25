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


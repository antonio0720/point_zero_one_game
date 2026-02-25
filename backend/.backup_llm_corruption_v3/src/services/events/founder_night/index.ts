/**
 * Founder Night Event Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { CreateFounderNightDto } from './dto/create-founder-night.dto';
import { FounderNight, FounderNightDocument } from './schemas/founder-night.schema';

/**
 * Founder Night Document Interface
 */
export interface IFounderNight extends FounderNightDocument {}

@Injectable()
export class FounderNightService {
  constructor(
    @InjectModel(FounderNight.name) private readonly model: Model<IFounderNight>,
  ) {}

  /**
   * Create a new Founder Night event
   * @param createFounderNightData - Data for creating the event
   */
  async createFounderNight(createFounderNightData: CreateFounderNightDto): Promise<IFounderNight> {
    const founderNight = new this.model(createFounderNightData);
    return founderNight.save();
  }
}

/**
 * Founder Night Schema
 */
export const FounderNightSchema = new Mongoose.Schema<IFounderNight>({
  code: { type: String, required: true, unique: true },
  ladderId: { type: String, required: true, ref: 'Ladder' },
  receipts: [{ type: String, ref: 'Receipt' }],
}, { timestamps: true });

FounderNightSchema.index({ code: 1 }, { unique: true });
FounderNightSchema.index({ ladderId: 1 });

-- Founder Night Table
CREATE TABLE IF NOT EXISTS `founder_nights` (
  `id` INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(255) NOT NULL UNIQUE,
  `ladderId` INT(11) UNSIGNED NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`ladderId`) REFERENCES `ladders` (`id`) ON DELETE CASCADE,
);

#!/bin/sh
set -euo pipefail
echo "Creating Founder Night event"
npm run typeorm migration:run -- quiet

resource "aws_s3_bucket" "founder_night_receipts" {
  bucket = "founder-night-receipts"
  acl    = "private"
}

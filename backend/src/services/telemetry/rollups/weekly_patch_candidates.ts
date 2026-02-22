/**
 * Service for generating ranked candidate list for weekly micro-patch (by impact x confidence)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Telemetry entity */
export class Telemetry {
  id: number;
  gameEventId: number;
  impact: number;
  confidence: number;
  createdAt: Date;
}

/** WeeklyPatchCandidatesService */
@Injectable()
export class WeeklyPatchCandidatesService {
  constructor(
    @InjectRepository(Telemetry)
    private telemetryRepository: Repository<Telemetry>,
  ) {}

  /**
   * Generate ranked candidate list for weekly micro-patch (by impact x confidence)
   */
  async generateCandidates(): Promise<Telemetry[]> {
    // Query to fetch all telemetry data and sort by impact * confidence in descending order
    const candidates = await this.telemetryRepository
      .createQueryBuilder('telemetry')
      .orderBy('telemetry.impact * telemetry.confidence', 'DESC')
      .getMany();

    return candidates;
  }
}

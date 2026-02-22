/**
 * Measurement Rollups Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Measurement entity.
 */
export class Measurement {
  id: number;
  gameId: number;
  timestamp: Date;
  value: number;
}

/**
 * Rollup entity.
 */
export class Rollup {
  id: number;
  measurementId: number;
  rollupType: string;
  rollupValue: number;
}

/**
 * Measurement Rollups Service.
 */
@Injectable()
export class MeasurementRollupsService {
  constructor(
    @InjectRepository(Measurement)
    private readonly measurementRepository: Repository<Measurement>,
    @InjectRepository(Rollup)
    private readonly rollupRepository: Repository<Rollup>,
  ) {}

  /**
   * Calculate and save rollups for a given set of measurements.
   *
   * @param measurements - The measurements to calculate rollups for.
   */
  async calculateAndSaveRollups(measurements: Measurement[]): Promise<void> {
    // Calculate rollups and save them to the database.
    // ...
  }

  /**
   * Find rollups of a specific type for a given measurement ID.
   *
   * @param measurementId - The ID of the measurement to find rollups for.
   * @param rollupType - The type of rollups to find.
   */
  async findRollupsByMeasurementAndType(
    measurementId: number,
    rollupType: string,
  ): Promise<Rollup[]> {
    return this.rollupRepository.find({
      where: { measurementId, rollupType },
      relations: ['measurement'],
    });
  }
}

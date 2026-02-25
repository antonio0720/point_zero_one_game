/**
 * SandboxLanesService implementation for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SandboxLane } from './entities/sandbox-lane.entity';
import { Cohort } from '../cohorts/entities/cohort.entity';
import { Receipt } from '../receipts/entities/receipt.entity';

/**
 * SandboxLanesService class for managing sandbox lanes in the game.
 */
@Injectable()
export class SandboxLanesService {
  constructor(
    @InjectRepository(SandboxLane)
    private readonly sandboxLaneRepository: Repository<SandboxLane>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
  ) {}

  /**
   * Publish a transaction to the sandbox lanes for the given cohort.
   * @param cohortId The ID of the cohort to publish to.
   * @param receipt The receipt data to be published.
   */
  async publish(cohortId: number, receipt: Receipt): Promise<void> {
    const cohort = await this.cohortRepository.findOneOrFail({ where: { id: cohortId } });
    const sandboxLanes = cohort.sandboxLanes;

    for (const lane of sandboxLanes) {
      await this.sandboxLaneRepository.save(lane.publish(receipt));
    }
  }
}

/**
 * Sandbox Lane entity representing a lane in the game's financial system.
 */
export class SandboxLane {
  /** The ID of the sandbox lane. */
  id: number;

  /** The receipt data for this sandbox lane. */
  receipt: Receipt;

  /**
   * Publish a transaction to this sandbox lane.
   * @param receipt The receipt data to be published.
   * @returns A new instance of SandboxLane with the updated receipt data.
   */
  publish(receipt: Receipt): SandboxLane {
    this.receipt = receipt;
    return this;
  }
}

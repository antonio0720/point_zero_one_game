/**
 * Placement Pool Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Placement Pool Entity
 */
export class PlacementPoolEntity {
  id: number;
  eligibilityCriteria: string;
  rankingSnapshotId: number;
  slotId: number;
}

/**
 * Placement Pool Repository
 */
@Injectable()
export class PlacementPoolRepository {
  constructor(
    @InjectRepository(PlacementPoolEntity)
    private readonly placementPoolRepository: Repository<PlacementPoolEntity>,
  ) {}

  async findBySlotId(slotId: number): Promise<PlacementPoolEntity[]> {
    return this.placementPoolRepository.find({ where: { slotId } });
  }

  async save(placementPool: PlacementPoolEntity): Promise<void> {
    await this.placementPoolRepository.save(placementPool);
  }
}

/**
 * Placement Pool Service
 */
@Injectable()
export interface RankingSnapshot { id: number; playerId: number; rank: number; }
export interface Slot { id: number; position: number; }

export class PlacementPoolService {
  constructor(
    private readonly placementPoolRepository: PlacementPoolRepository,
  ) {}

  async assignSlots(rankingSnapshots: RankingSnapshot[], slots: Slot[]): Promise<void> {
    for (const snapshot of rankingSnapshots) {
      const slot = slots.find(s => s.position === snapshot.rank);
      if (slot) {
        await this.placementPoolRepository.save({ ...new PlacementPoolEntity(), rankingSnapshotId: snapshot.id, slotId: slot.id } as PlacementPoolEntity);
      }
    }
  }
}



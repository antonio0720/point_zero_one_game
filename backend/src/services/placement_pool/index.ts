/**
 * Placement Pool Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('placement_pool')
export class PlacementPoolEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'eligibility_criteria' }) eligibilityCriteria: string;
  @Column({ name: 'ranking_snapshot_id' }) rankingSnapshotId: number;
  @Column({ name: 'slot_id' }) slotId: number;
}

export interface RankingSnapshot { id: number; playerId: number; rank: number; }
export interface Slot { id: number; position: number; }

@Injectable()
export class PlacementPoolRepository {
  constructor(
    @InjectRepository(PlacementPoolEntity)
    private readonly repo: Repository<PlacementPoolEntity>,
  ) {}

  async findBySlotId(slotId: number): Promise<PlacementPoolEntity[]> {
    return this.repo.find({ where: { slotId } });
  }

  async save(entity: PlacementPoolEntity): Promise<void> {
    await this.repo.save(entity);
  }
}

@Injectable()
export class PlacementPoolService {
  constructor(
    private readonly placementPoolRepository: PlacementPoolRepository,
  ) {}

  async assignSlots(rankingSnapshots: RankingSnapshot[], slots: Slot[]): Promise<void> {
    for (const snapshot of rankingSnapshots) {
      const slot = slots.find(s => s.position === snapshot.rank);
      if (slot) {
        const entity = Object.assign(new PlacementPoolEntity(), {
          rankingSnapshotId: snapshot.id,
          slotId: slot.id,
          eligibilityCriteria: 'default',
        });
        await this.placementPoolRepository.save(entity);
      }
    }
  }
}

/**
 * Curriculum Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntitySubscription } from 'typeorm';

/**
 * Curriculum Entity
 */
@Entity()
export class Curriculum {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  packs: any[]; // Replace 'any[]' with specific types when available

  @Column({ type: 'jsonb' })
  guides: any[]; // Replace 'any[]' with specific types when available

  @Column({ type: 'jsonb' })
  debrief: any; // Replace 'any' with specific type when available

  @Column({ type: 'jsonb' })
  measurement: any; // Replace 'any' with specific type when available

  @Column({ type: 'jsonb', default: {} })
  orgAccess: any; // Replace 'any' with specific type when available
}

/**
 * Curriculum Service
 */
@Injectable()
export class CurriculumService {
  constructor(
    @InjectRepository(Curriculum)
    private readonly curriculumRepository: Repository<Curriculum>,
  ) {}

  /**
   * Get a curriculum by ID
   * @param id - The ID of the curriculum to retrieve
   */
  async getCurriculumById(id: string): Promise<Curriculum | null> {
    return this.curriculumRepository.findOneBy({ id });
  }

  /**
   * Create or update a curriculum
   * @param curriculum - The curriculum data to create or update
   */
  async saveOrUpdateCurriculum(curriculum: Curriculum): Promise<void> {
    await this.curriculumRepository.save(curriculum);
  }

  /**
   * Subscribe to changes in a curriculum
   * @param id - The ID of the curriculum to subscribe to
   */
  async subscribeToCurriculumChanges(id: string): Promise<EntitySubscription> {
    return this.curriculumRepository.createSubscriptionBuilder(id).subscribe();
  }
}

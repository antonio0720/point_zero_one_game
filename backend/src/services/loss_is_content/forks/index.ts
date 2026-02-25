/**
 * Practice Fork Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * PracticeFork entity.
 */
export class PracticeFork {
  id: number;
  parentId: number;
  createdAt: Date;
}

/**
 * Practice Fork Service.
 */
@Injectable()
export class PracticeForkService {
  constructor(
    @InjectRepository(PracticeFork)
    private practiceForkRepository: Repository<PracticeFork>,
  ) {}

  /**
   * Find a practice fork by its ID.
   *
   * @param id - The ID of the practice fork to find.
   */
  async findOne(id: number): Promise<PracticeFork | null> {
    return this.practiceForkRepository.findOneBy({ id });
  }

  /**
   * Create a new practice fork.
   *
   * @param parentId - The ID of the parent practice fork.
   */
  async create(parentId: number): Promise<PracticeFork> {
    const newPracticeFork = this.practiceForkRepository.create({
      parentId,
      createdAt: new Date(),
    });

    return this.practiceForkRepository.save(newPracticeFork);
  }
}



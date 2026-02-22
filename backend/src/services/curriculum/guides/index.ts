/**
 * Guides service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Guide entity representing a guide in the game.
 */
export class Guide {
  id: number;
  name: string;
  description: string;
}

/**
 * Guides service for managing guides in the game.
 */
@Injectable()
export class GuidesService {
  constructor(
    @InjectRepository(Guide)
    private readonly guideRepository: Repository<Guide>,
  ) {}

  /**
   * Finds a guide by its ID.
   * @param id - The ID of the guide to find.
   */
  async findOne(id: number): Promise<Guide | null> {
    return this.guideRepository.findOneBy({ id });
  }

  /**
   * Finds all guides in the game.
   */
  async findAll(): Promise<Guide[]> {
    return this.guideRepository.find();
  }

  /**
   * Creates a new guide in the database.
   * @param guide - The guide to create.
   */
  async create(guide: Guide): Promise<Guide> {
    return this.guideRepository.save(guide);
  }

  /**
   * Updates an existing guide in the database.
   * @param id - The ID of the guide to update.
   * @param guide - The updated guide data.
   */
  async update(id: number, guide: Partial<Guide>): Promise<Guide | null> {
    const existingGuide = await this.findOne(id);
    if (!existingGuide) return null;

    Object.assign(existingGuide, guide);
    return this.guideRepository.save(existingGuide);
  }

  /**
   * Deletes a guide from the database.
   * @param id - The ID of the guide to delete.
   */
  async remove(id: number): Promise<void> {
    await this.guideRepository.delete({ id });
  }
}

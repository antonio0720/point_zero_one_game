/**
 * Episodes service for managing templates, versions, pins, and hashes.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Episode entity */
export class Episode {
  id: number;
  templateId: number;
  version: number;
  pin: string;
  hash: string;
}

/** Episode repository */
@Injectable()
export class EpisodesService {
  constructor(
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,
  ) {}

  /**
   * Find an episode by its ID.
   * @param id - The ID of the episode to find.
   */
  async findOne(id: number): Promise<Episode | null> {
    return this.episodeRepository.findOneBy({ id });
  }

  /**
   * Find all episodes for a given template.
   * @param templateId - The ID of the template to filter by.
   */
  async findByTemplate(templateId: number): Promise<Episode[]> {
    return this.episodeRepository.find({ where: { templateId } });
  }

  /**
   * Create a new episode.
   * @param episodeData - The data for the new episode.
   */
  async create(episodeData: Omit<Episode, 'id'>): Promise<Episode> {
    const episode = this.episodeRepository.create(episodeData);
    return this.episodeRepository.save(episode);
  }
}

-- Episodes table creation

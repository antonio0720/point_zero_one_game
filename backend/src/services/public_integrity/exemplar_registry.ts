/**
 * Exemplar Registry Service for Point Zero One Digital
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exemplar } from './exemplar.entity';
import { Season } from '../season/season.entity';

/**
 * Exemplar Registry Service
 */
@Injectable()
export class ExemplarRegistryService {
  constructor(
    @InjectRepository(Exemplar)
    private exemplarRepository: Repository<Exemplar>,
    @InjectRepository(Season)
    private seasonRepository: Repository<Season>,
  ) {}

  /**
   * Add an exemplar to the registry for a given season
   * @param seasonId - The ID of the season to add the exemplar to
   * @param exemplarId - The ID of the exemplar to add
   */
  async addExemplarToSeason(seasonId: number, exemplarId: number): Promise<void> {
    const season = await this.seasonRepository.findOne(seasonId);
    if (!season) throw new Error('Season not found');

    const exemplar = await this.exemplarRepository.findOne(exemplarId);
    if (!exemplar) throw new Error('Exemplar not found');

    season.exemplars = [...(season.exemplars || []), exemplar];
    await this.seasonRepository.save(season);
  }

  /**
   * Remove an exemplar from the registry for a given season
   * @param seasonId - The ID of the season to remove the exemplar from
   * @param exemplarId - The ID of the exemplar to remove
   */
  async removeExemplarFromSeason(seasonId: number, exemplarId: number): Promise<void> {
    const season = await this.seasonRepository.findOne(seasonId);
    if (!season) throw new Error('Season not found');

    const index = season.exemplars.findIndex((exemplar) => exemplar.id === exemplarId);
    if (index === -1) throw new Error('Exemplar not found in season');

    season.exemplars.splice(index, 1);
    await this.seasonRepository.save(season);
  }
}

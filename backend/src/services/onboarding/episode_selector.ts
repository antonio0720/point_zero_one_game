/**
 * Episode Selector Service
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Episode, EpisodeDocument } from './schemas/episode.schema';

/**
 * Episode Selector Service Interface
 */
export interface IEpisodeSelectorService {
  getEpisodesForStage(stage: number): Promise<Episode[]>;
}

/**
 * Episode Selector Service Implementation
 */
@Injectable()
export class EpisodeSelectorService implements IEpisodeSelectorService {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
  ) {}

  async getEpisodesForStage(stage: number): Promise<Episode[]> {
    const baseQuery = this.episodeModel.find({ stage });

    // Apply remote overrides via feature flags
    this.configService.get('FEATURE_FLAGS').forEach((flag) => {
      if (flag.enabled && flag.episodes) {
        baseQuery.where({ _id: { $in: flag.episodes } });
      }
    });

    return baseQuery.exec();
  }
}


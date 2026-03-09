/**
 * Service for managing episode version pins and content hashes.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';

/**
 * EpisodeVersionPin interface representing the structure of a document in MongoDB.
 */
export interface EpisodeVersionPin extends Document {
  episodeId: string;
  version: number;
  contentHash: string;
}

/**
 * EpisodeVersionPinModel represents the Mongoose schema for EpisodeVersionPin.
 */
@Injectable()
export class EpisodeVersionPinModel extends Model<EpisodeVersionPin> implements EpisodeVersionPin {
  episodeId: string;
  version: number;
  contentHash: string;
}

/**
 * Service for managing episode version pins and content hashes.
 */
@Injectable()
export class VersionPinningService {
  constructor(
    @InjectModel('EpisodeVersionPin') private readonly episodeVersionPinModel: Model<EpisodeVersionPin>,
  ) {}

  /**
   * Creates a new episode version pin with the given parameters.
   * @param episodeId The ID of the episode to pin.
   * @param version The version number to pin.
   * @param contentHash The hash of the content for the pinned version.
   */
  async create(episodeId: string, version: number, contentHash: string): Promise<EpisodeVersionPin> {
    const newPin = new this.episodeVersionPinModel({ episodeId, version, contentHash });
    return newPin.save();
  }

  /**
   * Retrieves the pinned version for a given episode ID.
   * @param episodeId The ID of the episode to retrieve the pin for.
   */
  async findOneByEpisodeId(episodeId: string): Promise<EpisodeVersionPin | null> {
    return this.episodeVersionPinModel.findOne({ episodeId }).exec();
  }
}

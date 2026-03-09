/**
 * PublicSafeRedirectsService - Provides public-safe redirects for exemplars (no PII; cacheable)
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * ExemplarSafeRedirect - Represents a safe redirect for an exemplar
 */
export interface ExemplarSafeRedirect {
  /**
   * The unique identifier of the exemplar associated with this redirect
   */
  exemplarId: string;

  /**
   * The URL to which the user will be redirected when accessing the exemplar's public page
   */
  redirectUrl: string;
}

/**
 * ExemplarSafeRedirectModel - Mongoose model for ExemplarSafeRedirect
 */
export type ExemplarSafeRedirectModel = Model<ExemplarSafeRedirect>;

@Injectable()
export class PublicSafeRedirectsService {
  constructor(
    @InjectModel('ExemplarSafeRedirect')
    private readonly exemplarSafeRedirectModel: ExemplarSafeRedirectModel,
  ) {}

  /**
   * Creates a new safe redirect for the given exemplar or updates an existing one if it already exists.
   *
   * @param exemplarId - The unique identifier of the exemplar associated with this redirect
   * @param redirectUrl - The URL to which the user will be redirected when accessing the exemplar's public page
   */
  async createOrUpdate(exemplarId: string, redirectUrl: string): Promise<ExemplarSafeRedirect> {
    const existingRedirect = await this.exemplarSafeRedirectModel.findOneAndUpdate(
      { exemplarId },
      { redirectUrl },
      { upsert: true, new: true },
    );

    return existingRedirect;
  }
}

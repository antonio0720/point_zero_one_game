/**
 * Feature Flag Rollout Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from typeorm-typedi-extensions;
import { Repository } from 'typeorm';
import { FeatureFlag, FeatureFlagRollout } from './entities';

/**
 * Feature Flag Rollout Service
 */
@Injectable()
export class FeatureFlagRolloutService {
  constructor(
    @InjectRepository(FeatureFlagRollout)
    private readonly featureFlagRolloutRepository: Repository<FeatureFlagRollout>,
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepository: Repository<FeatureFlag>,
  ) {}

  /**
   * Start a new rollout for the given feature flag.
   * @param {number} featureId - The ID of the feature flag to roll out.
   * @param {number[]} percentages - An array of percentage values that represent the rollout progression.
   */
  async startRollout(featureId: number, percentages: number[]): Promise<void> {
    const featureFlag = await this.featureFlagRepository.findOneOrFail({ where: { id: featureId } });
    const rollout = new FeatureFlagRollout();
    rollout.featureFlag = featureFlag;
    rollout.percentage = percentages[0];

    // Save the initial rollout state
    await this.featureFlagRolloutRepository.save(rollout);

    for (let i = 1; i < percentages.length; i++) {
      const currentRollout = await this.featureFlagRolloutRepository.findOneOrFail({ where: { id: rollout.id } });
      currentRollout.percentage = percentages[i];
      await this.featureFlagRolloutRepository.save(currentRollout);
      await new Promise((resolve) => setTimeout(resolve, 60_000 * (i + 1))); // Simulate delay between rollout steps
    }
  }

  /**
   * Revert the feature flag rollout to the previous state.
   * @param {number} rolloutId - The ID of the rollout to revert.
   */
  async revertRollout(rolloutId: number): Promise<void> {
    const currentRollout = await this.featureFlagRolloutRepository.findOneOrFail({ where: { id: rolloutId } });
    const previousRollout = await this.featureFlagRolloutRepository.findOne({
      where: { id: currentRollout.id - 1 },
      relations: ['featureFlag'],
    });

    if (!previousRollout) {
      throw new Error('Cannot revert rollout, no previous state found.');
    }

    // Revert the feature flag rollout to the previous state
    currentRollout.percentage = previousRollout.percentage;
    await this.featureFlagRolloutRepository.save(currentRollout);
  }
}


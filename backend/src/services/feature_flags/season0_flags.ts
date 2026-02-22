/**
 * Season0 flags service
 */

import { FeatureFlag } from './feature_flags.model';

export class Season0FlagsService {
  private readonly flags: Map<string, FeatureFlag> = new Map([
    ['enable_join', new FeatureFlag('enable_join', false)],
    ['enable_referrals', new FeatureFlag('enable_referrals', false)],
    ['enable_proof_stamps', new FeatureFlag('enable_proof_stamps', false)],
    ['enable_membership_card', new FeatureFlag('enable_membership_card', false)],
    ['rollout_percent', new FeatureFlag('rollout_percent', 100)],
  ]);

  /**
   * Get a flag by its name.
   * @param {string} name - The name of the flag to get.
   * @returns {FeatureFlag | null} The requested flag, or null if it doesn't exist.
   */
  public getFlag(name: string): FeatureFlag | null {
    return this.flags.get(name);
  }

  /**
   * Check if a flag is enabled.
   * @param {string} name - The name of the flag to check.
   * @returns {boolean} True if the flag is enabled, false otherwise.
   */
  public isEnabled(name: string): boolean {
    const flag = this.getFlag(name);
    return flag !== null && flag.isEnabled;
  }
}

/**
 * Feature flag model
 */
export class FeatureFlag {
  constructor(private readonly name: string, private readonly isEnabled: boolean) {}

  /**
   * Check if the feature flag is enabled.
   * @returns {boolean} True if the flag is enabled, false otherwise.
   */
  public isEnabled(): boolean {
    return this.isEnabled;
  }
}

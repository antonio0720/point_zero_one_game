// tslint:disable:no-any strict-type-checking no-object-literal-types

import { IRuleModule } from './rule_module';
import { IMonetaryReward } from './monetary_reward';
import { ISeasonSystemConfig } from './season_system_config';

export class M19SeasonSystemRuleModulesRewards {
  private readonly _ml_enabled: boolean;
  private readonly _audit_hash: string;

  constructor(
    mlEnabled: boolean,
    auditHash: string
  ) {
    this._ml_enabled = mlEnabled;
    this._audit_hash = auditHash;
  }

  public get mlEnabled(): boolean {
    return this._ml_enabled;
  }

  public get auditHash(): string {
    return this._audit_hash;
  }

  public getRuleModules(
    seasonSystemConfig: ISeasonSystemConfig
  ): IRuleModule[] {
    const ruleModules = [];

    // Rule Module 1: Season Start Reward
    if (seasonSystemConfig.seasonStartRewardEnabled) {
      const reward = new IMonetaryReward({
        amount: seasonSystemConfig.seasonStartRewardAmount,
        currency: 'USD',
        description: 'Season start reward'
      });
      ruleModules.push(new IRuleModule({
        id: 'M19-1',
        name: 'Season Start Reward',
        description: 'Reward for starting a new season',
        reward
      }));
    }

    // Rule Module 2: Season Progress Reward
    if (seasonSystemConfig.seasonProgressRewardEnabled) {
      const reward = new IMonetaryReward({
        amount: seasonSystemConfig.seasonProgressRewardAmount,
        currency: 'USD',
        description: 'Season progress reward'
      });
      ruleModules.push(new IRuleModule({
        id: 'M19-2',
        name: 'Season Progress Reward',
        description: 'Reward for progressing through the season',
        reward
      }));
    }

    return ruleModules;
  }
}

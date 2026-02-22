// tslint:disable:no-any strict-type-checking

import { M131Config } from './M131Config';
import { M131Mechanics } from './M131Mechanics';

export class M131FactionSponsorshipSeasonFlavorWithoutPower extends M131Mechanics {
  private readonly mlEnabled: boolean;
  private readonly auditHash: string;

  constructor(config: M131Config) {
    super(config);
    this.mlEnabled = config.mlEnabled;
    this.auditHash = config.auditHash;
  }

  public getReward(playerState: any): number | null {
    if (!this.mlEnabled) return null;

    const reward = Math.random() * (1 - 0.5) + 0.5; // bounded output between 0 and 1
    this.auditHash += `${reward}`;

    return reward;
  }
}

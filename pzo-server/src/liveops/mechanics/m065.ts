// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M65Config } from './M65Config';
import { M65State } from './M65State';

export class M65Mechanics {
  private config: M65Config;
  private state: M65State;

  constructor(config: M65Config, state: M65State) {
    this.config = config;
    this.state = state;
  }

  public getReward(): number {
    if (!this.mlEnabled()) return 0.0;

    const reward = this.calculateReward();
    return Math.max(0.0, Math.min(reward, 1.0));
  }

  private calculateReward(): number {
    // implementation of the diminishing returns formula
    // based on the spec: mechanics/M65_diminishing_returns_anti_grind_trophy_curve.md
    const trophyCurve = this.config.trophyCurve;
    const currentTrophy = this.state.currentTrophy;
    const maxTrophy = this.config.maxTrophy;

    if (currentTrophy < 0 || currentTrophy > maxTrophy) {
      throw new Error('Invalid trophy value');
    }

    const trophyProgress = currentTrophy / maxTrophy;
    const reward = Math.pow(trophyCurve, trophyProgress);

    return reward;
  }

  private mlEnabled(): boolean {
    // implementation of the ML model kill-switch
    // for now, assume it's enabled by default
    return true;
  }

  public getAuditHash(): string {
    // implementation of the audit hash calculation
    const configString = JSON.stringify(this.config);
    const stateString = JSON.stringify(this.state);

    const combinedString = `${configString}${stateString}`;
    const hash = crypto.createHash('sha256').update(combinedString).digest('hex');

    return hash;
  }
}

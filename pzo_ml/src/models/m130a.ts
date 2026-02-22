// tslint:disable:no-any strict-type-checking

import { M130aConfig } from './M130aConfig';
import { ContributionPlanner } from './ContributionPlanner';
import { FairWithdrawalAdvisor } from './FairWithdrawalAdvisor';

export class M130a {
  private readonly config: M130aConfig;
  private readonly contributionPlanner: ContributionPlanner;
  private readonly fairWithdrawalAdvisor: FairWithdrawalAdvisor;

  constructor(config: M130aConfig) {
    this.config = config;
    this.contributionPlanner = new ContributionPlanner();
    this.fairWithdrawalAdvisor = new FairWithdrawalAdvisor();
  }

  public async contribute(amount: number): Promise<number> {
    if (!this.mlEnabled()) {
      return amount;
    }
    const contribution = await this.contributionPlanner.contribute(amount);
    return Math.min(Math.max(contribution, 0), 1);
  }

  public async withdraw(amount: number): Promise<number> {
    if (!this.mlEnabled()) {
      return amount;
    }
    const withdrawal = await this.fairWithdrawalAdvisor.withdraw(amount);
    return Math.min(Math.max(withdrawal, 0), 1);
  }

  private mlEnabled(): boolean {
    // ML kill-switch
    return this.config.mlEnabled;
  }

  public getAuditHash(): string {
    return this.contributionPlanner.getAuditHash() + this.fairWithdrawalAdvisor.getAuditHash();
  }
}

export { M130aConfig, ContributionPlanner, FairWithdrawalAdvisor };

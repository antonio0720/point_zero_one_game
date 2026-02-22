// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M29aConfig } from './M29aConfig';
import { M29aModel } from './M29aModel';

export class M29a {
  private readonly config: M29aConfig;
  private readonly model: M29aModel;

  constructor(config: M29aConfig, model: M29aModel) {
    this.config = config;
    this.model = model;
  }

  public async calculatePayoutLikelihood(
    riskPoolBalance: number,
    payoutAmount: number
  ): Promise<number> {
    if (!this.config.mlEnabled) {
      throw new Error('ML is not enabled');
    }
    const boundedNudge = Math.min(Math.max(this.model.boundedNudge(riskPoolBalance, payoutAmount), 0), 1);
    const auditHash = this.model.auditHash(riskPoolBalance, payoutAmount);
    const likelihood = await this.model.calculatePayoutLikelihood(
      riskPoolBalance,
      payoutAmount,
      boundedNudge,
      auditHash
    );
    return likelihood;
  }
}

export class M29aConfig {
  public mlEnabled: boolean;
  public boundedNudgeMin: number;
  public boundedNudgeMax: number;

  constructor(config: { [key: string]: any }) {
    this.mlEnabled = config.ml_enabled === 'true';
    this.boundedNudgeMin = config.bounded_nudge_min || 0;
    this.boundedNudgeMax = config.bounded_nudge_max || 1;
  }
}

export class M29aModel {
  private readonly mlModel: any;

  constructor(mlModel: any) {
    this.mlModel = mlModel;
  }

  public async boundedNudge(
    riskPoolBalance: number,
    payoutAmount: number
  ): Promise<number> {
    return Math.min(Math.max(this.mlModel.bounded_nudge(riskPoolBalance, payoutAmount), 0), 1);
  }

  public async auditHash(
    riskPoolBalance: number,
    payoutAmount: number
  ): Promise<string> {
    return this.mlModel.audit_hash(riskPoolBalance, payoutAmount);
  }

  public async calculatePayoutLikelihood(
    riskPoolBalance: number,
    payoutAmount: number,
    boundedNudge: number,
    auditHash: string
  ): Promise<number> {
    const input = { risk_pool_balance: riskPoolBalance, payout_amount: payoutAmount };
    const output = await this.mlModel.calculate_payout_likelihood(input);
    return output;
  }
}

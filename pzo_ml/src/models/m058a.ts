// tslint:disable:no-any strict-type-checking no-console

import { M058aConfig } from './M058aConfig';
import { M058aModel } from './M058aModel';

export class M058a {
  private config: M058aConfig;
  private model: M058aModel;

  constructor(config: M058aConfig) {
    this.config = config;
    this.model = new M058aModel();
  }

  public async selectStressTest(
    riskRewardBalance: number,
    antiFarmFactor: number
  ): Promise<number> {
    if (!this.config.mlEnabled) {
      throw new Error('ML is not enabled');
    }

    const boundedRiskRewardBalance =
      Math.max(0, Math.min(riskRewardBalance, 1));
    const boundedAntiFarmFactor = Math.max(0, Math.min(antiFarmFactor, 1));

    const inputFeatures = [
      boundedRiskRewardBalance,
      boundedAntiFarmFactor,
      this.config.auditHash,
    ];

    const output = await this.model.predict(inputFeatures);

    if (output < 0 || output > 1) {
      throw new Error('Output is out of bounds');
    }

    return output;
  }
}

export class M058aConfig {
  public mlEnabled: boolean;
  public auditHash: string;

  constructor(config: { [key: string]: any }) {
    this.mlEnabled = config.ml_enabled !== undefined ? config.ml_enabled : false;
    this.auditHash = config.audit_hash || '';
  }
}

export class M058aModel {
  private model: any; // tslint:disable-line:no-any

  constructor() {
    // Load the ML model here
  }

  public async predict(inputFeatures: number[]): Promise<number> {
    // Make a prediction using the loaded ML model
    return this.model.predict(inputFeatures);
  }
}

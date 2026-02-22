// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M083aConfig } from './M083aConfig';
import { RiskParityDialOptimizer } from './RiskParityDialOptimizer';

export class M83a {
  private readonly config: M083aConfig;
  private readonly optimizer: RiskParityDialOptimizer;

  constructor(config: M083aConfig) {
    this.config = config;
    this.optimizer = new RiskParityDialOptimizer();
  }

  public async optimize(
    exposures: number[],
    weights: number[]
  ): Promise<{ optimizedWeights: number[]; auditHash: string }> {
    if (!this.config.mlEnabled) {
      throw new Error('ML is disabled');
    }

    const boundedExposures = this.boundedNudge(exposures);
    const boundedWeights = this.boundedNudge(weights);

    const optimizedWeights = await this.optimizer.optimize(
      boundedExposures,
      boundedWeights
    );

    const auditHash = this.auditHash(optimizedWeights, exposures, weights);

    return { optimizedWeights, auditHash };
  }

  private boundedNudge(values: number[]): number[] {
    if (values.some((value) => value < 0 || value > 1)) {
      throw new Error('Values must be between 0 and 1');
    }
    return values.map((value) => Math.min(Math.max(value, 0), 1));
  }

  private auditHash(
    optimizedWeights: number[],
    exposures: number[],
    weights: number[]
  ): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(optimizedWeights));
    hash.update(JSON.stringify(exposures));
    hash.update(JSON.stringify(weights));
    return hash.digest('hex');
  }
}

export { M083aConfig, RiskParityDialOptimizer };

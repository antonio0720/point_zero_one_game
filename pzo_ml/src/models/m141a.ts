// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { M141aConfig } from './M141aConfig';
import { M141aProxyVotePredictor } from './M141aProxyVotePredictor';
import { FairnessGuard } from './FairnessGuard';

export class M141a {
  private config: M141aConfig;
  private predictor: M141aProxyVotePredictor;
  private fairnessGuard: FairnessGuard;

  constructor(config: M141aConfig) {
    this.config = config;
    this.predictor = new M141aProxyVotePredictor(this.config);
    this.fairnessGuard = new FairnessGuard();
  }

  public async predict(
    inputFeatures: { [key: string]: number },
    auditHash: string,
  ): Promise<{ prediction: number; fairnessScore: number }> {
    if (!this.config.mlEnabled) {
      throw new Error('ML is not enabled');
    }
    const boundedInput = this.boundedNudge(inputFeatures);
    const prediction = await this.predictor.predict(boundedInput, auditHash);
    const fairnessScore = this.fairnessGuard.getFairnessScore(prediction);
    return { prediction: Math.min(Math.max(prediction, 0), 1), fairnessScore };
  }

  private boundedNudge(inputFeatures: { [key: string]: number }): {
    [key: string]: number;
  } {
    const boundedInput = {};
    for (const key in inputFeatures) {
      if (Object.prototype.hasOwnProperty.call(inputFeatures, key)) {
        boundedInput[key] = Math.min(Math.max(inputFeatures[key], -1), 1);
      }
    }
    return boundedInput;
  }

  public getAuditHash(): string {
    return this.config.auditHash;
  }
}

export { M141aConfig };

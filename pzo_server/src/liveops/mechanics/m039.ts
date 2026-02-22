// tslint:disable:no-any strict-type-checking no-console

import { MlModel } from '../ml/model';
import { AuditHash } from '../audit/hash';

export class SeasonTrophyCurrencyEarnedNonP2W {
  private mlEnabled = false;
  private mlModel: MlModel | null = null;

  constructor() {}

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public setMlEnabled(enabled: boolean): void {
    this.mlEnabled = enabled;
  }

  public getAuditHash(): AuditHash {
    const auditHash = new AuditHash();
    // Add any necessary data to the audit hash
    return auditHash;
  }

  public calculateReward(playerId: string, seasonId: number, trophyCount: number): number {
    if (!this.mlEnabled) {
      return Math.floor(Math.random() * (100 - 1 + 1)) + 1; // 1-100
    } else if (this.mlModel !== null) {
      const output = this.mlModel.calculate(playerId, seasonId, trophyCount);
      if (output < 0 || output > 1) {
        throw new Error('ML model output must be between 0 and 1');
      }
      return Math.floor(output * 100); // Scale to 1-100
    } else {
      throw new Error('ML model is not initialized');
    }
  }

  public initMlModel(model: MlModel): void {
    this.mlModel = model;
  }
}

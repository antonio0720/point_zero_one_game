// tslint:disable:no-any strict-type-checking

import { AchievementLedger } from './achievement-ledger';
import { MlModel } from '../ml-model';

export class M36AchievementLedgerProofBasedBadges {
  private achievementLedger: AchievementLedger;
  private mlModel: MlModel;

  constructor(achievementLedger: AchievementLedger, mlModel: MlModel) {
    this.achievementLedger = achievementLedger;
    this.mlModel = mlModel;
  }

  public getAchievementStatus(achievementId: string): number | null {
    if (!this.mlModel.isEnabled()) {
      return null;
    }
    const input = { achievementId };
    const output = this.mlModel.predict(input);
    if (output === undefined) {
      return null;
    }
    if (typeof output !== 'number' || output < 0 || output > 1) {
      throw new Error('Invalid output from ML model');
    }
    return output;
  }

  public getAuditHash(): string {
    const achievementStatuses = Object.values(this.achievementLedger.getAchievementStatuses()).map((status) => status.toString());
    const input = { achievementStatuses };
    const output = this.mlModel.predict(input);
    if (output === undefined) {
      throw new Error('Invalid output from ML model');
    }
    return output;
  }

  public getProofBasedBadges(): string[] {
    const achievementStatuses = Object.values(this.achievementLedger.getAchievementStatuses());
    const badges: string[] = [];
    for (const status of achievementStatuses) {
      if (status !== null && status >= 0.5) {
        badges.push(status.toString());
      }
    }
    return badges;
  }

  public getProofBasedBadgesAuditHash(): string {
    const proofBasedBadges = this.getProofBasedBadges();
    const input = { proofBasedBadges };
    const output = this.mlModel.predict(input);
    if (output === undefined) {
      throw new Error('Invalid output from ML model');
    }
    return output;
  }

  public getAuditHashForProofBasedBadges(): string {
    return this.getProofBasedBadgesAuditHash();
  }
}

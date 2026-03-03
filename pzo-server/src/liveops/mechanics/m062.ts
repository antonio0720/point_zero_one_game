// tslint:disable:no-any strict-type-checking

import { MlModel } from './ml_model';
import { AuditHash } from './audit_hash';

export class TeamAchievementsCoopProofBadgesForSharedContracts {
  private mlEnabled = false;
  private mlModel: MlModel | null = null;

  public getMlModel(): MlModel | null {
    return this.mlModel;
  }

  public setMlModel(mlModel: MlModel): void {
    if (this.mlEnabled) {
      this.mlModel = mlModel;
    }
  }

  public getAuditHash(): AuditHash {
    const auditHash = new AuditHash();
    // Add team achievements coop proof badges for shared contracts logic here
    return auditHash;
  }

  public isMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public setMlEnabled(enabled: boolean): void {
    this.mlEnabled = enabled;
  }
}

export class TeamAchievementsCoopProofBadgesForSharedContractsMechanics {
  private teamAchievementsCoopProofBadgesForSharedContracts: TeamAchievementsCoopProofBadgesForSharedContracts;

  public constructor() {
    this.teamAchievementsCoopProofBadgesForSharedContracts = new TeamAchievementsCoopProofBadgesForSharedContracts();
  }

  public getTeamAchievementsCoopProofBadgesForSharedContracts(): TeamAchievementsCoopProofBadgesForSharedContracts {
    return this.teamAchievementsCoopProofBadgesForSharedContracts;
  }
}

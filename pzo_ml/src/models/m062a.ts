// tslint:disable:no-any strict-type-checking

import { MlModel } from './ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M62a extends MlModel {
  private readonly _auditHash: string;
  private readonly _mlEnabled: boolean;

  constructor(
    auditHash: string,
    mlEnabled: boolean = true
  ) {
    super();
    this._auditHash = auditHash;
    this._mlEnabled = mlEnabled;
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public isMlEnabled(): boolean {
    return this._mlEnabled;
  }

  public estimateTeamContribution(
    teamMembers: number,
    totalContributions: number
  ): BoundedNudge {
    if (!this._mlEnabled) {
      throw new Error('ML model disabled');
    }

    const contribution = (teamMembers / totalContributions) * 100;
    return new BoundedNudge(contribution, 0, 1);
  }
}

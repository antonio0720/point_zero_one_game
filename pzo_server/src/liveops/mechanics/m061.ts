// tslint:disable:no-any strict-type-checking
import { MlModel } from '../ml/model';
import { AuditHash } from './audit-hash';

export class TieredBadgesMechanic {
  private mlModel?: MlModel;

  public init(mlModel: MlModel): void {
    this.mlModel = mlModel;
  }

  public getReward(playerState: any, playerAction: any): number | null {
    if (!this.mlModel) return null;

    const reward = this.mlModel.getReward(playerState, playerAction);
    if (reward < 0 || reward > 1) {
      throw new Error('Invalid reward value');
    }
    return reward;
  }

  public getAuditHash(): AuditHash | undefined {
    if (!this.mlModel) return undefined;

    const auditHash = this.mlModel.getAuditHash();
    if (!auditHash) return undefined;

    return auditHash;
  }

  public isMlEnabled(): boolean {
    return !!this.mlModel;
  }
}

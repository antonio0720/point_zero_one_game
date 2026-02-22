// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { GameEngine } from '../../game_engine';

export class ArbitrationModeDisputeResolutionViaReplayTableVote {
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

  public getAuditHash(): string {
    const auditHash = 'arbitration_mode_dispute_resolution_via_replay_table_vote';
    return auditHash;
  }

  public isMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public setMlEnabled(mlEnabled: boolean): void {
    this.mlEnabled = mlEnabled;
  }

  public getOutput(): number[] {
    if (this.mlModel === null) {
      throw new Error('ML model not initialized');
    }
    const output = this.mlModel.getOutput();
    return output.map((value) => Math.min(Math.max(value, 0), 1));
  }

  public isDeterministic(): boolean {
    return true;
  }
}

// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml/model';
import { RivalSabotageControlledGriefingMechanic } from './rival_sabotage_controlled_griefing_mechanic';

export class M18RivalSabotageControlledGriefingMechanics {
  private mlModel: MlModel;

  constructor(mlModel: MlModel) {
    this.mlModel = mlModel;
  }

  public getMlEnabled(): boolean {
    return this.mlModel.getAuditHash() === 'some_hash';
  }

  public getOutput(playerId: number, rivalPlayerId: number): [number, number] {
    if (this.getMlEnabled()) {
      const output = this.mlModel.predict([playerId, rivalPlayerId]);
      return [output[0], output[1]];
    } else {
      return [0.5, 0.5];
    }
  }

  public getRivalSabotageControlledGriefingMechanic(): RivalSabotageControlledGriefingMechanic {
    return new RivalSabotageControlledGriefingMechanic();
  }
}

// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml/model';
import { GameEngine } from '../../engine';

export class ClutchAssistFriendBailouts {
  private mlModel: MlModel;

  constructor(mlModel: MlModel) {
    this.mlModel = mlModel;
  }

  public isEligibleForClutchAssist(playerId: number, playerState: any): boolean {
    if (!this.mlModel.isEnabled()) return false;

    const bailoutProbability = this.mlModel.predict(playerState);
    if (bailoutProbability < 0 || bailoutProbability > 1) {
      throw new Error('Invalid bailout probability');
    }

    // Check if the player is in a valid state for clutch assist
    // This can include checks such as:
    // - The player has a certain amount of health remaining
    // - The player is within a certain distance of their teammate
    // - The player is not currently driving

    return bailoutProbability > 0.5;
  }

  public getAuditHash(): string {
    const auditData = {
      mlModel: this.mlModel.getAuditHash(),
      playerId: 'playerId',
      playerState: 'playerState',
    };

    return this.mlModel.hash(auditData);
  }
}

export function createClutchAssistFriendBailouts(mlModel: MlModel): ClutchAssistFriendBailouts {
  return new ClutchAssistFriendBailouts(mlModel);
}

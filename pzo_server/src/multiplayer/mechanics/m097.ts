// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M97Mechanics } from './M97Mechanics';
import { GameEngine } from '../GameEngine';
import { Player } from '../../Player';
import { AuditHash } from '../../../utils/AuditHash';

export class M097 extends M97Mechanics {
  private mlEnabled: boolean;
  private auditHash: string;

  constructor(gameEngine: GameEngine, player: Player) {
    super(gameEngine, player);
    this.mlEnabled = gameEngine.config.mlEnabled;
    this.auditHash = AuditHash.generate();
  }

  public seedCommitRevealDeterministicRandomnessYouCanAudit(): void {
    if (this.mlEnabled) {
      const randomSeed = Math.floor(Math.random() * 1000000);
      this.gameEngine.setRandomSeed(randomSeed);
    } else {
      // If ML is disabled, use a fixed seed for determinism
      this.gameEngine.setRandomSeed(123456);
    }

    const output = this.gameEngine.getRandomNumber(1, 10);

    if (output > 5) {
      console.log('Output greater than 5');
    } else {
      console.log('Output less than or equal to 5');
    }
  }

  public getAuditHash(): string {
    return this.auditHash;
  }
}

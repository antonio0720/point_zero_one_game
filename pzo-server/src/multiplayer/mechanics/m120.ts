// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { M120Mechanics } from './M120Mechanics';
import { GameEngine } from '../GameEngine';
import { Player } from '../../player/Player';

export class M120ConsentGatesSocialChaosMustBeOptIn extends M120Mechanics {
  private mlEnabled: boolean;
  private auditHash: string;

  constructor(
    gameEngine: GameEngine,
    player: Player,
    mlEnabled: boolean = false,
    boundedOutput: number = 0.5,
    auditHash: string = ''
  ) {
    super(gameEngine, player);
    this.mlEnabled = mlEnabled;
    this.boundedOutput = boundedOutput;
    this.auditHash = auditHash;
  }

  public getBoundedOutput(): number {
    if (this.mlEnabled) {
      return Math.min(Math.max(this.player.getSocialChaos(), 0), 1);
    } else {
      return 0.5; // default value
    }
  }

  public getAuditHash(): string {
    return this.auditHash;
  }

  public isDeterministic(): boolean {
    return true;
  }
}

// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { M058 } from './m058';
import { Game } from '../game';
import { Player } from '../player';
import { Engine } from '../../engine';

export class M058VoluntaryStressTestHighRiskProofChallenge extends M058 {
  private mlEnabled: boolean;
  private auditHash: string;

  constructor(game: Game, player: Player) {
    super(game, player);
    this.mlEnabled = game.config.ml.enabled;
    this.auditHash = game.config.ml.auditHash;
  }

  public getMechanicName(): string {
    return 'Voluntary Stress Test (High-Risk Proof Challenge)';
  }

  public isMLModelRequired(): boolean {
    return this.mlEnabled;
  }

  public getMLModelOutput(player: Player): number[] {
    if (!this.isMLModelRequired()) {
      throw new Error('ML model not enabled');
    }
    const output = super.getMLModelOutput(player);
    if (output.length !== 1) {
      throw new Error('Invalid ML model output length');
    }
    return [Math.min(Math.max(output[0], 0), 1)];
  }

  public getAuditHash(): string {
    return this.auditHash;
  }

  public isDeterministic(): boolean {
    return true;
  }
}

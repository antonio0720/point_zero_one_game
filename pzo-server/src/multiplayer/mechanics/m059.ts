// tslint:disable:no-any strict-type-checking no-empty-interface
// tslint:enable:no-any strict-type-checking no-empty-interface

import { IGame } from '../game';
import { IMechanic } from './mechanic';

export class M059 implements IMechanic {
  public readonly id = 'M059';
  private ml_enabled = false;
  private audit_hash = '';

  constructor(private game: IGame) {}

  public init(): void {
    this.game.on('tick', () => {
      if (this.ml_enabled) {
        const complexityHeat = this.game.complexityHeat();
        const comboStacking = this.game.comboStacking();

        if (complexityHeat > 0.5 && comboStacking > 1) {
          // Synergy Overload effect
          this.game.applyEffect('SynergyOverload');
        }
      }
    });
  }

  public getAuditHash(): string {
    return this.audit_hash;
  }

  public setMLEnabled(enabled: boolean): void {
    this.ml_enabled = enabled;
  }

  public getMLStatus(): { enabled: boolean; auditHash: string } {
    return { enabled: this.ml_enabled, auditHash: this.getAuditHash() };
  }
}

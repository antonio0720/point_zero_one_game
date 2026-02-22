// tslint:disable:no-any strict-type-checking

import { M144Config } from './M144Config';
import { IGameMechanic } from '../IGameMechanic';
import { GameEngine } from '../../GameEngine';
import { mlEnabled, auditHash } from '../../../utils/ml';

export class M144 implements IGameMechanic {
  public readonly name = 'Spectator Theater (Watch Live Runs With Delay)';
  public readonly description = 'Allow spectators to watch live runs with a delay.';
  public readonly config: M144Config;
  public readonly mlEnabled = mlEnabled;

  constructor(config: M144Config) {
    this.config = config;
  }

  public async init(engine: GameEngine): Promise<void> {
    engine.addHook('onGameStart', () => {
      if (this.config.enabled && !engine.isSpectator()) {
        const delay = this.config.delay;
        setTimeout(() => {
          engine.setGameState('spectator');
        }, delay);
      }
    });
  }

  public async update(engine: GameEngine): Promise<void> {
    // No-op
  }

  public getAuditHash(): string {
    return auditHash(this.name, this.description, this.config);
  }

  public getOutput(): number[] {
    if (this.mlEnabled) {
      const output = [0.5]; // placeholder output for demonstration purposes
      return output;
    } else {
      return [];
    }
  }
}

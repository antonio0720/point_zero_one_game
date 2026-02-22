// tslint:disable:no-any strict-type-checking
// tslint:disable:no-console

import { TickLoop } from './tick-loop';
import { Game } from '../game/game';
import { MlModel } from '../ml/model';

export class AppTickLoop extends TickLoop {
  private game: Game;
  private mlModel: MlModel;

  constructor(game: Game, mlModel: MlModel) {
    super();
    this.game = game;
    this.mlModel = mlModel;
  }

  public async run(): Promise<void> {
    const start = Date.now();

    // Request animation frame clock
    await new Promise(resolve => globalThis.requestAnimationFrame(resolve));

    if (this.game.isRunning()) {
      // Authoritative tick schedule (no pause)
      await this.game.tick();
      await this.mlModel.tick();

      // Preserve determinism
      globalThis.console.log(`Tick time: ${Date.now() - start}ms`);
    }

    // Output bounded outputs 0-1, audit hash
    const output = {
      value: Math.min(Math.max(this.mlModel.getOutput(), 0), 1),
      auditHash: this.game.getAuditHash(),
    };

    globalThis.console.log(output);

    if (this.game.isRunning()) {
      // Request animation frame clock
      await new Promise(resolve => globalThis.requestAnimationFrame(resolve));
      await this.run();
    }
  }

  public async stop(): Promise<void> {
    this.game.stop();
  }

  public isRunning(): boolean {
    return this.game.isRunning();
  }

  public getAuditHash(): string {
    return this.game.getAuditHash();
  }
}

export function createAppTickLoop(game: Game, mlModel: MlModel): AppTickLoop {
  return new AppTickLoop(game, mlModel);
}

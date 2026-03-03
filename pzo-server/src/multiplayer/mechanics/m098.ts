// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from './ml_model';
import { GameEngine } from '../game_engine';

export class M98 {
  private mlEnabled = false;
  private killSwitch = false;

  public auditHash: string | null = null;

  constructor(private gameEngine: GameEngine) {}

  public async onGameTick(): Promise<void> {
    if (!this.mlEnabled || this.killSwitch) return;

    const playerRuns = await this.gameEngine.getPlayerRuns();
    for (const run of playerRuns) {
      if (run.isSuspicious()) {
        // Isolate the suspicious run without killing play
        await this.gameEngine.isolateRun(run);
      }
    }

    this.auditHash = await this.gameEngine.getAuditHash();
  }

  public async onPlayerJoin(): Promise<void> {
    if (!this.mlEnabled || this.killSwitch) return;

    const playerRuns = await this.gameEngine.getPlayerRuns();
    for (const run of playerRuns) {
      if (run.isSuspicious()) {
        // Isolate the suspicious run without killing play
        await this.gameEngine.isolateRun(run);
      }
    }

    this.auditHash = await this.gameEngine.getAuditHash();
  }

  public async onPlayerLeave(): Promise<void> {
    if (!this.mlEnabled || this.killSwitch) return;

    const playerRuns = await this.gameEngine.getPlayerRuns();
    for (const run of playerRuns) {
      if (run.isSuspicious()) {
        // Isolate the suspicious run without killing play
        await this.gameEngine.isolateRun(run);
      }
    }

    this.auditHash = await this.gameEngine.getAuditHash();
  }

  public async onGameReset(): Promise<void> {
    if (!this.mlEnabled || this.killSwitch) return;

    const playerRuns = await this.gameEngine.getPlayerRuns();
    for (const run of playerRuns) {
      if (run.isSuspicious()) {
        // Isolate the suspicious run without killing play
        await this.gameEngine.isolateRun(run);
      }
    }

    this.auditHash = await this.gameEngine.getAuditHash();
  }

  public async onMlModelUpdate(model: MlModel): Promise<void> {
    if (!this.mlEnabled || this.killSwitch) return;

    const playerRuns = await this.gameEngine.getPlayerRuns();
    for (const run of playerRuns) {
      if (run.isSuspicious()) {
        // Isolate the suspicious run without killing play
        await this.gameEngine.isolateRun(run);
      }
    }

    this.auditHash = await this.gameEngine.getAuditHash();
  }
}

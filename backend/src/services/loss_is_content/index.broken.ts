/**
 * LossIsContent Orchestrator
 */

import { DeathPackage } from './death_package';
import { GameEventService } from '../game_event/game_event.service';

export class LossIsContentOrchestrator {
  private readonly gameEventService: GameEventService;

  constructor() {
    this.gameEventService = new GameEventService();
  }

  public async finalizeWipe(): Promise<DeathPackage> {
    const deathPackage = await this.gameEventService.getFinalDeathPackage();

    // Perform any necessary calculations or transformations on the death package here

    return deathPackage;
  }
}

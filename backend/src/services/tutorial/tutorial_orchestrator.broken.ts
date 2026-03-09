/**
 * Tutorial Orchestrator Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TutorialVariant, TutorialVariantDocument } from './tutorial-variant.schema';
import { GameSessionService } from '../game-session/game-session.service';
import { GameEventEmitter } from '../../events/game-event-emitter';

/**
 * Tutorial Orchestrator Service Interface
 */
@Injectable()
export class TutorialOrchestratorService {
  constructor(
    @InjectModel(TutorialVariant.name) private tutorialVariantModel: Model<TutorialVariantDocument>,
    private gameSessionService: GameSessionService,
    private eventEmitter: GameEventEmitter,
  ) {}

  /**
   * Starts the first run mode of the tutorial with a curated seed and guarantees survival for 3 turns.
   * Tracks tutorial completion, emits TUTORIAL_COMPLETED event, unlocks full game on completion, A/B tested variants.
   *
   * @param gameSessionId - The ID of the current game session.
   */
  async startFirstRunMode(gameSessionId: string): Promise<void> {
    // Get A/B tested tutorial variant
    const tutorialVariant = await this.getABTestedTutorialVariant();

    // Start new game session with curated seed and guaranteed survival for 3 turns
    await this.gameSessionService.startNewGameSession(gameSessionId, tutorialVariant.seed, true);

    // Track tutorial completion
    let isTutorialCompleted = false;

    // Check game state every turn until tutorial is completed or max turns reached
    for (let turn = 1; turn <= 3 && !isTutorialCompleted; turn++) {
      await this.gameSessionService.advanceTurn(gameSessionId);
      isTutorialCompleted = await this.isTutorialCompleted(gameSessionId);
    }

    // Emit TUTORIAL_COMPLETED event and unlock full game
    if (isTutorialCompleted) {
      this.eventEmitter.emit('TUTORIAL_COMPLETED', gameSessionId);
      await this.gameSessionService.unlockFullGame(gameSessionId);
    }
  }

  /**
   * Checks if the tutorial is completed based on the current game state.
   *
   * @param gameSessionId - The ID of the current game session.
   */
  private async isTutorialCompleted(gameSessionId: string): Promise<boolean> {
    // Deterministic game engine or replay check for tutorial completion
    const gameState = await this.gameSessionService.getGameState(gameSessionId);
    // ... (Deterministic logic to check if the tutorial is completed)
  }

  /**
   * Retrieves the A/B tested tutorial variant from the database.
   */
  private async getABTestedTutorialVariant(): Promise<TutorialVariantDocument> {
    // ... (Query for A/B tested tutorial variant)
  }
}

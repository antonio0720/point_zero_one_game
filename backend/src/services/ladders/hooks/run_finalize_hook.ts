/**
 * Run finalize hook for ladders service
 */

import { CasualLadder, PendingVerifiedEntry } from '../models';
import { GameEngineService } from '../game-engine';
import { OptedSportMode } from '../constants';

export function runFinalizeHook(gameId: number): Promise<void> {
  // Fetch the game data using GameEngineService
  return GameEngineService.getGameData(gameId)
    .then((gameData) => {
      const game = gameData as GameEngine.Game;

      // Check if the game is over
      if (game.isOver()) {
        // Submit to casual ladder
        CasualLadder.submit(game);

        // If sport mode opted, create verified pending entry
        if (OptedSportMode.includes(game.sportMode)) {
          PendingVerifiedEntry.createVerifiedPendingEntry(game);
        }
      }
    });
}

/**
 * Finalize run and compute outcome
 */
import { GameState, Outcome } from './game_state';
import { EventEmitter } from 'events';
import { verifyRun } from './verification';

export class RunFinalizer {
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  public finalizeRun(gameState: GameScript.GameState): void {
    const outcome = this.computeOutcome(gameState);
    this.emitRunFinalizedEvent(outcome);
    this.enqueueVerification(gameState, outcome);
  }

  private computeOutcome(gameState: GameScript.GameState): Outcome {
    // Implement the logic to compute the game's final outcome based on the provided game state
    // ...
  }

  private emitRunFinalizedEvent(outcome: Outcome): void {
    this.eventEmitter.emit('RUN_FINALIZED', { outcome });
  }

  private enqueueVerification(gameState: GameScript.GameState, outcome: Outcome): void {
    verifyRun.enqueue(gameState, outcome);
  }
}

Please note that this is a simplified example and the actual implementation may vary based on your specific project requirements. Also, I've assumed the existence of `GameScript.GameState` and `Outcome`, which should be defined elsewhere in your codebase.

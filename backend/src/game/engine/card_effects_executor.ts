/**
 * CardEffectsExecutor class for executing card effects on a given RunState.
 */
export class CardEffectsExecutor {
  /**
   * Executes a list of card effects against a given run state, returning the updated run state.
   * @param runState - The current game state.
   * @param cardEffects - An array of card effects to be executed.
   */
  public execute(runState: RunState, cardEffects: CardEffect[]): RunState {
    return cardEffects.reduce((accumulator, current) => {
      return accumulator.applyCardEffect(current);
    }, runState);
  }

  /**
   * Applies a single card effect to the given run state and returns the updated run state.
   * @param cardEffect - The card effect to be applied.
   */
  public applyCardEffect(cardEffect: CardEffect): RunState {
    // Implement pure function for each card effect here.
    throw new Error('Not implemented');
  }
}

/**
 * Represents a card effect in the game.
 */
export interface CardEffect {
  /**
   * The unique identifier of the card effect.
   */
  id: string;

  /**
   * The name of the card effect for display purposes.
   */
  name: string;

  /**
   * The function to execute the card effect against a given run state.
   */
  execute(runState: RunState): RunState;
}

/**
 * Represents the current game state.
 */
export interface RunState {
  // Define properties for each game state variable here.
}

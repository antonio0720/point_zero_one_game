/**
 * Game Contracts - Run Contract
 */

/**
 * Represents the current state of a run.
 */
export type RunState = 'INITIALIZED' | 'RUNNING' | 'COMPLETED';

/**
 * Represents the current turn state within a run.
 */
export type TurnState = 'IDLE' | 'PLAYER_TURN' | 'AI_TURN';

/**
 * Represents the balance of a player in game assets.
 */
export interface PlayerBalance {
  gold: number;
  assets: Record<string, number>;
}

/**
 * Register for tracking all available game assets.
 */
export type AssetRegister = Record<string, PlayerBalance>;

/**
 * Register for tracking debts owed by players to the bank or other players.
 */
export type DebtRegister = Record<string, Record<string, number>>;

/**
 * Represents various status effects that can be applied to a player.
 */
export type StatusEffects = Record<string, number>;

/**
 * Represents the current state of a deck, including cards and their positions.
 */
export interface DeckState {
  cards: string[];
  currentCardIndex: number;
}

/**
 * Represents the possible outcomes of a run.
 */
export type RunOutcome = 'VICTORY' | 'DEFEAT' | 'DRAW';

/**
 * Represents events that occur during the lifecycle of a run.
 */
export type RunLifecycleEvent =
  | 'RUN_INITIALIZED'
  | 'TURN_STARTED'
  | 'PLAYER_ACTION'
  | 'AI_ACTION'
  | 'TURN_ENDED'
  | 'RUN_COMPLETED';

/**
 * Interface for the RunContract class.
 */
export interface RunContract {
  initializeRun(player: string, assets: AssetRegister): void;
  startTurn(): void;
  playerAction(cardId: string): void;
  aiAction(): void;
  endTurn(): RunOutcome | null;
  getCurrentState(): RunState & TurnState & PlayerBalance & AssetRegister & DebtRegister & StatusEffects & DeckState;
}

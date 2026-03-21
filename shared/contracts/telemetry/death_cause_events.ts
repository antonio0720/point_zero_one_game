/**
 * Death Cause Events Contract
 */

export enum DeathCause {
  PlayerError = "player_error",
  GameOver = "game_over",
  ImmediateExit = "immediate_exit",
  RageClick = "rage_click",
  UnfairFeelProxy = "unfair_feel_proxy"
}

export interface DeathCauseEvent {
  id: number;
  gameId: number;
  deathCause: DeathCause;
  turn: number;
  macroContext?: string; // Optional, if applicable
  deltaTurnsLast3?: number[]; // Optional, if applicable
}

export type DeathCauseEventList = DeathCauseEvent[];


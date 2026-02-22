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

/**
 * Database schema for Death Cause Events
 */

/* eslint-disable @typescript-eslint/naming-convention */

CREATE TABLE IF NOT EXISTS death_cause_events (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  death_cause VARCHAR(255) NOT NULL CHECK (death_cause IN ('player_error', 'game_over', 'immediate_exit', 'rage_click', 'unfair_feel_proxy')),
  turn INTEGER NOT NULL,
  macro_context VARCHAR(255),
  delta_turns_last3 JSONB[],
  UNIQUE (game_id, turn)
);
/* eslint-enable @typescript-eslint/naming-convention */

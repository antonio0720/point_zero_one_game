/**
 * Action
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/action.ts
 *
 * Canonical action contract for the PZO engine.
 * All game actions flowing through SignedAction must conform to this shape.
 */

export type ActionType =
  | 'CARD_PLAY'
  | 'CARD_DRAW'
  | 'MECHANIC_TOUCH'
  | 'FATE_RESOLVE'
  | 'COUNTERPLAY_CHOOSE'
  | 'AID_SUBMIT'
  | 'RESCUE_CONTRIBUTE'
  | 'THREAT_MITIGATE'
  | 'RUN_START'
  | 'RUN_END'
  | 'SABOTAGE_APPLY'
  | 'SABOTAGE_COUNTER'
  | 'SEASON_PULSE'
  | 'PVP_ROUND'
  | 'SYSTEM';

export interface Action {
  /** Unique action identifier — should be deterministic (e.g. `${runId}:${tick}:${type}`) */
  id:         string;

  /** Action classification */
  type:       ActionType;

  /** Game tick at which the action occurred */
  tick:       number;

  /** Player or entity originating the action */
  playerId:   string;

  /** ISO 8601 timestamp — use Date.toISOString() */
  timestamp:  string;

  /** Arbitrary typed payload specific to the action */
  payload:    Record<string, string | number | boolean | null>;
}

/** Minimal factory for building actions with defaults */
export function createAction(
  params: Omit<Action, 'timestamp'> & { timestamp?: string },
): Action {
  return {
    ...params,
    timestamp: params.timestamp ?? new Date().toISOString(),
  };
}

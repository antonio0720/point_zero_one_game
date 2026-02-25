/**
 * Player
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_server/src/multiplayer/player.ts
 */

export type PlayerStatus = 'ACTIVE' | 'SUSPENDED' | 'DISCONNECTED' | 'SPECTATING';

export interface Player {
  /** Unique player identifier */
  id:           string;

  /** Display name shown in UI and audit logs */
  username:     string;

  /** Current player status */
  status:       PlayerStatus;

  /** Unix ms timestamp of session start */
  sessionStart: number;

  /** Optional: number of turns this player has been locked (>0 = locked) */
  turnsLocked?: number;
}

/** Factory with safe defaults */
export function createPlayer(params: Pick<Player, 'id' | 'username'> & Partial<Player>): Player {
  return {
    status:       'ACTIVE',
    sessionStart: Date.now(),
    turnsLocked:  0,
    ...params,
  };
}

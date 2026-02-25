/**
 * Player
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/backend/game-engine/src/Player.ts
 */

import { createHash } from 'crypto';

export interface ActiveEffect {
  type:          string;
  turnsRemaining: number;
}

export class Player {
  /** Deterministic SHA-256-derived id from name */
  public readonly id: string;

  public netWorth:      number = 0;
  public income:        number = 0;
  public expenses:      number = 0;
  public activeEffects: ActiveEffect[] = [];

  constructor(public readonly name: string) {
    this.id = createHash('sha256').update(name).digest('hex').slice(0, 16);
  }
}

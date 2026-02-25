/**
 * Ghost Run Mode for Point Zero One Digital's financial roguelike game.
 */

import { GameMode, Player, OpponentDecision, SeedVariant } from './game';
import { Database } from '../database';

/**
 * GhostRunMode represents the ghost run mode in the game.
 */
export class GhostRunMode extends GameMode {
  constructor(private db: Database) {
    super();
  }

  /**
   * Starts a new ghost run match.
   * @param player The player participating in the match.
   * @returns A promise that resolves with the opponent's decisions serialized as a ghost.
   */
  async startMatch(player: Player): Promise<OpponentDecision[]> {
    // Generate seed variant for the match.
    const seedVariant = new SeedVariant();

    // Save player's run data with the generated seed variant.
    await this.db.savePlayerRunData(player, seedVariant);

    // Load opponent's run data with the same seed variant.
    const opponentDecisions = await this.db.loadOpponentRunData(seedVariant);

    return opponentDecisions;
  }
}

For the SQL schema, I will provide a simplified version as it is not included in the request:

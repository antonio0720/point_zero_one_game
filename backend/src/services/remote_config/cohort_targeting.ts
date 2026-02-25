/**
 * Cohort Targeting Service for Point Zero One Digital's financial roguelike game.
 * This service is responsible for determining the cohort (new player, returning, competitive) for rollouts.
 */

declare namespace RemoteConfig {
  interface CohortTargeting {
    newPlayer: boolean;
    returningPlayer: boolean;
    competitivePlayer: boolean;
  }
}

export type PlayerType = 'new' | 'returning' | 'competitive';

/**
 * Determines the player cohort based on specific rules.
 * @param playerId - The unique identifier of the player.
 */
export function determineCohort(playerId: string): RemoteConfig.CohortTargeting {
  // Implementation details omitted for brevity.
}

/**
 * SQL schema for storing player cohort data.
 */
const sqlSchema = `

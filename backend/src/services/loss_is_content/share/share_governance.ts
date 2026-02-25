/**
 * Share Governance Service
 */
export interface DeathShare {
  id: number;
  playerId: number;
  gameId: number;
  shareValue: number;
}

export interface LeaderboardClaim {
  id: number;
  playerId: number;
  gameId: number;
  score: number;
  deathShares?: DeathShare[]; // Optional, as leaderboard claims don't necessarily have associated death shares
}

/**
 * Enforces that death shares are artifacts, not leaderboard claims.
 * Disables competitive surfaces for practice forks.
 */
export class ShareGovernance {
  /**
   * Validates a given LeaderboardClaim to ensure it does not contain DeathShares.
   * @param claim The LeaderboardClaim to validate.
   * @throws Error if the LeaderboardClaim contains DeathShares.
   */
  public validateLeaderboardClaim(claim: LeaderboardClaim): void {
    if (claim.deathShares) {
      throw new Error('LeaderboardClaim should not contain DeathShares.');
    }
  }

  /**
   * Disables competitive surfaces for practice forks.
   */
  public disableCompetitiveSurfacesForPracticeForks(): void {
    // Implementation details omitted for brevity.
  }
}

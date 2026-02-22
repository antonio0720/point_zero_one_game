/**
 * Analytics events for Season 0 of Point Zero One Digital's financial roguelike game.
 */

declare namespace analytics {
    /**
     * Emitted when a player joins Season 0 of the game.
     */
    const SEASON0_JOINED: string;

    /**
     * Emitted when a player is granted an artifact in Season 0.
     * @param artifactId - The unique identifier for the artifact.
     */
    const ARTIFACT_GRANTED: (artifactId: number) => string;

    /**
     * Emitted when a player shares their membership in Season 0 with another player.
     * @param recipientPlayerId - The unique identifier for the recipient player.
     */
    const MEMBERSHIP_SHARED: (recipientPlayerId: number) => string;

    /**
     * Emitted when a proof is stamped in Season 0.
     * @param proofId - The unique identifier for the proof.
     */
    const PROOF_STAMPED: (proofId: number) => string;

    /**
     * Emitted when an invite is sent from one player to another in Season 0.
     * @param recipientPlayerId - The unique identifier for the recipient player.
     */
    const INVITE_SENT: (recipientPlayerId: number) => string;

    /**
     * Emitted when an invite is accepted by a player in Season 0.
     * @param inviterPlayerId - The unique identifier for the inviting player.
     */
    const INVITE_ACCEPTED: (inviterPlayerId: number) => string;

    /**
     * Emitted when a referral is completed by a player in Season 0.
     * @param referredPlayerId - The unique identifier for the referred player.
     */
    const REFERRAL_COMPLETED: (referredPlayerId: number) => string;

    /**
     * Emitted when a streak is updated for a player in Season 0.
     * @param playerId - The unique identifier for the player.
     * @param newStreakLength - The new length of the player's streak.
     */
    const STREAK_UPDATED: (playerId: number, newStreakLength: number) => string;
}

export = analytics;

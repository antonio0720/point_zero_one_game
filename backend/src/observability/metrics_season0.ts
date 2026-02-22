/**
 * Metrics Season 0 - TypeScript Interface for Metric Data
 */

interface TimeToArtifact {
    /** Unix timestamp of artifact creation */
    timestamp: number;
    /** Duration in seconds from game start to artifact creation */
    duration: number;
}

interface JoinConversion {
    /** Unix timestamp of join event */
    join_timestamp: number;
    /** Unix timestamp of conversion event */
    conversion_timestamp: number;
    /** Duration in seconds between join and conversion events */
    duration: number;
}

interface ReferralAcceptanceCompletion {
    /** Unix timestamp of referral acceptance event */
    acceptance_timestamp: number;
    /** Unix timestamp of referral completion event */
    completion_timestamp: number;
    /** Duration in seconds between referral acceptance and completion events */
    duration: number;
}

interface StreakContinuation {
    /** Unix timestamp of previous streak event */
    previous_streak_timestamp: number;
    /** Unix timestamp of current streak event */
    current_streak_timestamp: number;
    /** Duration in seconds between previous and current streak events */
    duration: number;
}

interface ProofStampMintRate {
    /** Unix timestamp of the start of the time period */
    start_timestamp: number;
    /** Unix timestamp of the end of the time period */
    end_timestamp: number;
    /** Number of proof stamps minted during the time period */
    count: number;
}

/**
 * Export all public symbols for type safety and easy consumption
 */
export { TimeToArtifact, JoinConversion, ReferralAcceptanceCompletion, StreakContinuation, ProofStampMintRate };

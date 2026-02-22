/**
 * Verification Health Events Contract
 */

export interface PendingVerifiedLatency {
  /** Unix timestamp of pending event */
  pendingAt: number;

  /** Unix timestamp of verified event */
  verifiedAt: number;

  /** Difference between verified and pending timestamps in milliseconds */
  latency: number;
}

export interface QuarantineRateTrend {
  /** Unix timestamp for the start of the trend period */
  startAt: number;

  /** Unix timestamp for the end of the trend period */
  endAt: number;

  /** Total number of events during the trend period */
  totalEvents: number;

  /** Number of quarantined events during the trend period */
  quarantineCount: number;

  /** Quarantine rate as a decimal (e.g., 0.2 for 20%) */
  rate: number;
}

export interface LadderGatingTrigger {
  /** Unix timestamp of the event triggering the ladder gating */
  triggerAt: number;

  /** The ladder level at which gating is triggered */
  ladderLevel: number;
}

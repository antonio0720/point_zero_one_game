/**
 * Metrics Ladder Tracker for Point Zero One Digital's Financial Roguelike Game
 */

type CasualPlacementLatency = {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Time (in seconds) taken to place a casual player */
  latency: number;
};

type VerifiedPublishLatency = {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Time (in seconds) taken to publish verified data */
  latency: number;
};

type EligibilityConversion = {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Number of eligible players who converted */
  count: number;
};

type SuppressionRate = {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Ratio of suppressed events to total events */
  rate: number;
};

type QuarantineRate = {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Ratio of quarantined players to total players */
  rate: number;
};

type RageQuitProxyEvents = {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Number of rage-quit proxy events */
  count: number;
};

/**
 * Interface for the MetricsLadder class
 */
export interface MetricsLadder {
  trackCasualPlacementLatency(latency: CasualPlacementLatency): void;
  trackVerifiedPublishLatency(latency: VerifiedPublishLatency): void;
  trackEligibilityConversion(count: EligibilityConversion): void;
  trackSuppressionRate(rate: SuppressionRate): void;
  trackQuarantineRate(rate: QuarantineRate): void;
  trackRageQuitProxyEvents(count: RageQuitProxyEvents): void;
}

/**
 * Season 0 — Module Barrel
 * Point Zero One · Density6 LLC · Confidential
 *
 * Re-exports all public Season 0 surface area.
 * Import from here, not from individual files, to keep
 * consumers insulated from internal restructuring.
 */

// ── Core Implementation ───────────────────────────────────────────────────────

export { Season0Impl }              from './season0_impl';
export type {
  Season0Config,
  PlayerRecord,
  JoinResult,
}                                   from './season0_impl';

// ── Artifact Grant ────────────────────────────────────────────────────────────

export { ArtifactGrantService, grantArtifact } from './artifact_grant';
export type {
  ArtifactBundle,
  ArtifactItem,
  ArtifactIssuance,
  ArtifactGrantDb,
  IdentityPayload,
}                                              from './artifact_grant';

// ── Countdown Clock ───────────────────────────────────────────────────────────

export { CountdownClockService }    from './countdown_clock';
export type {
  CountdownResult,
  CountdownClockConfig,
}                                   from './countdown_clock';

// ── Founder Tier ──────────────────────────────────────────────────────────────

export {
  FounderTierLogic,
  assignFounderTier,
  computeTierForMetrics,
  isEligibleForUpgrade,
}                                   from './founder_tier_logic';
export type {
  TierName,
  FounderTier,
  UserRef,
}                                   from './founder_tier_logic';

// ── Season 0 Constants ────────────────────────────────────────────────────────

export const SEASON0_ID      = 'SEASON_0';
export const SEASON0_END_UTC = new Date('2026-12-31T23:59:59.000Z');
export const SEASON0_BUNDLE_ID = 1;

/** Tier promotion thresholds — exported for UI display. */
export const TIER_THRESHOLDS = {
  Bronze: { streak: 1,  referrals: 1, events: 1 },
  Silver: { streak: 5,  referrals: 3, events: 2 },
  Gold:   { streak: 9,  referrals: 5, events: 3 },
} as const;
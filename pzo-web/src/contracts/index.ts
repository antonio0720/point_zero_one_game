/**
 * Contracts barrel — pzo-web/src/contracts/index.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Single import point for all contract types and manifest utilities.
 * SeasonClock.ts imports from '../contracts' — this file resolves that.
 */

export {
  SeasonTimelineManifest,
  defaultManifest,
  SEASON_0_MANIFEST_DATA,
} from './SeasonTimelineManifest';

export type {
  TickTier,
  SeasonPhaseName,
  AutoResolveChoice,
  TickTierConfig,
  DecisionWindowConfig,
  SeasonPhase,
  SeasonTimelineData,
} from './SeasonTimelineManifest';
/**
 * WaitlistService — Waitlist state reads consumed by season0_routes.
 * Backed by the season0_tables migration and Season0Service in src/services/season0/.
 */

import { SeasonMeta, SeasonPhase } from '../types/season.types';

export interface WaitlistStatus {
  isOpen: boolean;
  totalJoined: number;
  capacityRemaining: number;
  foundingEraActive: boolean;
}

// Season 0 constants — update via remote config / env when going live
const SEASON0_CAPACITY = parseInt(process.env.SEASON0_CAPACITY ?? '10000', 10);
const SEASON0_PHASE: SeasonPhase = (process.env.SEASON0_PHASE as SeasonPhase) ?? 'Claim';

// In prod, these reads come from DB (season0_tables migration).
// Using module-level cache that warms from DB on first call.
let cachedStatus: WaitlistStatus | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 10_000; // 10s

async function loadFromDB(): Promise<WaitlistStatus> {
  // TODO: replace with real DB query against season0_waitlist table
  // SELECT COUNT(*) FROM season0_waitlist WHERE status = 'joined'
  const totalJoined = parseInt(process.env.SEASON0_TOTAL_JOINED ?? '0', 10);
  return {
    isOpen: totalJoined < SEASON0_CAPACITY,
    totalJoined,
    capacityRemaining: Math.max(0, SEASON0_CAPACITY - totalJoined),
    foundingEraActive: SEASON0_PHASE === 'Claim' || SEASON0_PHASE === 'Build',
  };
}

export const WaitlistService = {
  async getStatus(): Promise<WaitlistStatus> {
    const now = Date.now();
    if (cachedStatus && now < cacheExpiry) return cachedStatus;
    cachedStatus = await loadFromDB();
    cacheExpiry = now + CACHE_TTL_MS;
    return cachedStatus;
  },

  async getSeasonMeta(): Promise<SeasonMeta> {
    return {
      seasonId: 'season0',
      phase: SEASON0_PHASE,
      referralsEnabled: process.env.FEATURE_REFERRALS !== 'false',
      membershipCardsEnabled: process.env.FEATURE_MEMBERSHIP_CARDS !== 'false',
      proofStampsEnabled: process.env.FEATURE_PROOF_STAMPS !== 'false',
      foundingEraActive: SEASON0_PHASE === 'Claim' || SEASON0_PHASE === 'Build',
      startsAt: process.env.SEASON0_STARTS_AT ?? new Date().toISOString(),
      endsAt: process.env.SEASON0_ENDS_AT ?? null,
    };
  },

  /** Called after a successful join to invalidate the cached count. */
  invalidateCache(): void {
    cachedStatus = null;
    cacheExpiry = 0;
  },
};

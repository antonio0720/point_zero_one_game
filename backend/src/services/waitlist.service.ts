// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/services/waitlist.service.ts

/**
 * WaitlistService — Waitlist state reads consumed by season0_routes.
 * Backed by the season0_tables migration and Season0Service in src/services/season0/.
 *
 * DB: PostgreSQL via TypeORM DataSource
 * Tables: users (current season0 proxy — season0_waitlist table assumed from migration spec)
 *
 * Sovereign implementation — real DB query, 10s TTL cache, zero env-var stubs.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SeasonMeta, SeasonPhase } from '../types/season.types';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface WaitlistStatus {
  isOpen:            boolean;
  totalJoined:       number;
  capacityRemaining: number;
  foundingEraActive: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SEASON0_CAPACITY  = parseInt(process.env.SEASON0_CAPACITY  ?? '10000', 10);
const SEASON0_PHASE     = (process.env.SEASON0_PHASE as SeasonPhase) ?? 'Claim';
const CACHE_TTL_MS      = 10_000; // 10s — keeps DB load low under traffic spikes
const FOUNDING_PHASES: SeasonPhase[] = ['Claim', 'Build'];

// ── Cache (module-level, resets on cold start) ─────────────────────────────────
let cachedStatus: WaitlistStatus | null = null;
let cacheExpiry  = 0;

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectDataSource()
    private readonly db: DataSource,
  ) {}

  // ── getStatus ───────────────────────────────────────────────────────────────
  /**
   * Returns waitlist status with a 10s in-process cache.
   *
   * Primary query (season0_waitlist table, added by season0_tables migration):
   *   SELECT COUNT(*) FROM season0_waitlist WHERE status = 'joined'
   *
   * Fallback: if table doesn't exist yet, counts active non-banned users
   * who joined since SEASON0_STARTS_AT as a proxy.
   */
  async getStatus(): Promise<WaitlistStatus> {
    const now = Date.now();
    if (cachedStatus && now < cacheExpiry) return cachedStatus;

    cachedStatus = await this.loadFromDB();
    cacheExpiry  = now + CACHE_TTL_MS;

    return cachedStatus;
  }

  // ── getSeasonMeta ───────────────────────────────────────────────────────────
  /**
   * Returns static season metadata.
   * Feature flags are read from env; can be promoted to DB-backed remote config.
   */
  async getSeasonMeta(): Promise<SeasonMeta> {
    return {
      seasonId:              'season0',
      phase:                 SEASON0_PHASE,
      referralsEnabled:      process.env.FEATURE_REFERRALS          !== 'false',
      membershipCardsEnabled: process.env.FEATURE_MEMBERSHIP_CARDS  !== 'false',
      proofStampsEnabled:    process.env.FEATURE_PROOF_STAMPS       !== 'false',
      foundingEraActive:     FOUNDING_PHASES.includes(SEASON0_PHASE),
      startsAt:              process.env.SEASON0_STARTS_AT ?? new Date().toISOString(),
      endsAt:                process.env.SEASON0_ENDS_AT   ?? null,
    };
  }

  // ── invalidateCache ─────────────────────────────────────────────────────────
  /**
   * Called after a successful join to force next read to re-query the DB.
   * Must be called from MembershipService.createFoundingMember() after commit.
   */
  invalidateCache(): void {
    cachedStatus = null;
    cacheExpiry  = 0;
    this.logger.debug('Waitlist cache invalidated');
  }

  // ── Private: loadFromDB ─────────────────────────────────────────────────────
  private async loadFromDB(): Promise<WaitlistStatus> {
    // Attempt primary query against season0_waitlist table
    try {
      const rows = await this.db.query<Array<{ total: string }>>(
        `SELECT COUNT(*) AS total
         FROM   season0_waitlist
         WHERE  status = 'joined'`,
      );
      const totalJoined = parseInt(rows[0]?.total ?? '0', 10);
      return this.buildStatus(totalJoined);
    } catch (primaryErr) {
      this.logger.warn(
        `season0_waitlist table not available, falling back to users count: ${(primaryErr as Error).message}`,
      );
    }

    // Fallback: count active users who joined since season start as a proxy
    try {
      const startsAt = process.env.SEASON0_STARTS_AT ?? '2024-01-01T00:00:00Z';
      const rows = await this.db.query<Array<{ total: string }>>(
        `SELECT COUNT(*) AS total
         FROM   users
         WHERE  is_active = true
           AND  is_banned = false
           AND  created_at >= $1`,
        [startsAt],
      );
      const totalJoined = parseInt(rows[0]?.total ?? '0', 10);
      this.logger.debug(`Waitlist fallback count: ${totalJoined}`);
      return this.buildStatus(totalJoined);
    } catch (fallbackErr) {
      this.logger.error(
        `Waitlist DB fallback failed: ${(fallbackErr as Error).message}`,
      );
      // Last resort: return open/empty status so join flow isn't blocked
      return this.buildStatus(0);
    }
  }

  private buildStatus(totalJoined: number): WaitlistStatus {
    return {
      isOpen:            totalJoined < SEASON0_CAPACITY,
      totalJoined,
      capacityRemaining: Math.max(0, SEASON0_CAPACITY - totalJoined),
      foundingEraActive: FOUNDING_PHASES.includes(SEASON0_PHASE),
    };
  }
}

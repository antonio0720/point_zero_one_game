/**
 * Commerce Governance — Offer Policy Engine
 * backend/src/api-gateway/commerce_governance/offer_policy.ts
 *
 * Evaluates whether an offer should be shown to a given player at a given moment.
 * Enforces: impression caps, cooldowns, loss suppression, minimum play time,
 * no-offers-during-run, discount caps, and scheduled windows.
 *
 * At 20M concurrent: this runs on the hot path for every store/offer request.
 * All checks are O(1) with Redis counters. No database queries in the eval path.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import Redis from 'ioredis';
import { OfferPolicy, OfferEvaluation, PolicyRules } from './types';

const redis = new Redis(process.env.PZO_REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true,
});

redis.on('error', () => { /* logged elsewhere */ });

const KEY_PREFIX = 'offer:impressions:';
const LOSS_KEY_PREFIX = 'player:recent_loss:';

/**
 * Evaluate whether an offer should be shown to a player.
 *
 * @param offer - The offer policy to evaluate
 * @param playerId - The player being evaluated
 * @param rules - The active governance policy rules
 * @param context - Runtime context (is player in a run, ticks played, etc.)
 */
export async function evaluateOffer(
  offer: OfferPolicy,
  playerId: string,
  rules: PolicyRules,
  context: {
    isInRun: boolean;
    totalTicksPlayed: number;
    lastRunOutcome: string | null;
  },
): Promise<OfferEvaluation> {
  const result: OfferEvaluation = {
    offerId: offer.offerId,
    eligible: true,
    reason: null,
    suppressedBy: null,
  };

  // ── HARD BLOCK: No offers during a run ──────────────────────────────────
  if (context.isInRun) {
    result.eligible = false;
    result.reason = 'Offers are never shown during an active run.';
    result.suppressedBy = 'STORE_DURING_RUN_BLOCK';
    return result;
  }

  // ── HARD BLOCK: Offer not active ────────────────────────────────────────
  if (offer.status !== 'ACTIVE') {
    result.eligible = false;
    result.reason = `Offer status is '${offer.status}', not ACTIVE.`;
    result.suppressedBy = 'STATUS_BLOCK';
    return result;
  }

  // ── HARD BLOCK: Scheduled window check ──────────────────────────────────
  const now = Date.now();
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now) {
    result.eligible = false;
    result.reason = 'Offer has not started yet.';
    result.suppressedBy = 'SCHEDULE_NOT_STARTED';
    return result;
  }
  if (offer.endsAt && new Date(offer.endsAt).getTime() < now) {
    result.eligible = false;
    result.reason = 'Offer has expired.';
    result.suppressedBy = 'SCHEDULE_EXPIRED';
    return result;
  }

  // ── GOVERNANCE: Minimum ticks played ────────────────────────────────────
  const minTicks = Math.max(offer.minTicksPlayedToShow, rules.globalMinTicksBeforeMonetization);
  if (context.totalTicksPlayed < minTicks) {
    result.eligible = false;
    result.reason = `Player has only played ${context.totalTicksPlayed} ticks (minimum: ${minTicks}).`;
    result.suppressedBy = 'MIN_TICKS_NOT_MET';
    return result;
  }

  // ── GOVERNANCE: Loss suppression ────────────────────────────────────────
  if (offer.suppressAfterLoss || rules.globalSuppressAfterLoss) {
    if (context.lastRunOutcome === 'BANKRUPT' || context.lastRunOutcome === 'ABANDONED') {
      try {
        const lossKey = `${LOSS_KEY_PREFIX}${playerId}`;
        const recentLoss = await redis.get(lossKey);
        if (recentLoss) {
          result.eligible = false;
          result.reason = 'Offers suppressed after a recent loss (anti-predatory).';
          result.suppressedBy = 'POST_LOSS_SUPPRESSION';
          return result;
        }
      } catch {
        // Redis failure — fail open (show the offer)
      }
    }
  }

  // ── GOVERNANCE: Discount cap ────────────────────────────────────────────
  if (offer.discountPct > rules.maxDiscountPct) {
    result.eligible = false;
    result.reason = `Discount ${offer.discountPct}% exceeds policy maximum ${rules.maxDiscountPct}%.`;
    result.suppressedBy = 'DISCOUNT_CAP_EXCEEDED';
    return result;
  }

  // ── RATE LIMIT: Daily impressions ───────────────────────────────────────
  try {
    const dailyKey = `${KEY_PREFIX}daily:${playerId}:${offer.offerId}`;
    const dailyCount = await redis.get(dailyKey);
    const maxDaily = Math.min(offer.maxImpressionsPerUserPerDay, rules.globalMaxImpressionsPerDay);

    if (dailyCount && parseInt(dailyCount, 10) >= maxDaily) {
      result.eligible = false;
      result.reason = `Daily impression limit reached (${maxDaily}).`;
      result.suppressedBy = 'DAILY_IMPRESSION_CAP';
      return result;
    }
  } catch {
    // Redis failure — fail open
  }

  // ── RATE LIMIT: Total impressions ───────────────────────────────────────
  if (offer.maxImpressionsPerUserTotal > 0) {
    try {
      const totalKey = `${KEY_PREFIX}total:${playerId}:${offer.offerId}`;
      const totalCount = await redis.get(totalKey);
      if (totalCount && parseInt(totalCount, 10) >= offer.maxImpressionsPerUserTotal) {
        result.eligible = false;
        result.reason = `Lifetime impression limit reached (${offer.maxImpressionsPerUserTotal}).`;
        result.suppressedBy = 'TOTAL_IMPRESSION_CAP';
        return result;
      }
    } catch {
      // Redis failure — fail open
    }
  }

  // ── RATE LIMIT: Cooldown ────────────────────────────────────────────────
  if (offer.cooldownSeconds > 0) {
    try {
      const cooldownKey = `${KEY_PREFIX}cooldown:${playerId}:${offer.offerId}`;
      const inCooldown = await redis.get(cooldownKey);
      if (inCooldown) {
        result.eligible = false;
        result.reason = `Offer is in cooldown (${offer.cooldownSeconds}s).`;
        result.suppressedBy = 'COOLDOWN_ACTIVE';
        return result;
      }
    } catch {
      // Redis failure — fail open
    }
  }

  return result;
}

/**
 * Record that an offer was shown to a player.
 * Increments impression counters and sets cooldown.
 */
export async function recordImpression(offerId: string, playerId: string, cooldownSeconds: number): Promise<void> {
  const pipeline = redis.pipeline();

  // Daily counter — expires at midnight UTC
  const dailyKey = `${KEY_PREFIX}daily:${playerId}:${offerId}`;
  const secondsUntilMidnight = 86400 - (Math.floor(Date.now() / 1000) % 86400);
  pipeline.incr(dailyKey);
  pipeline.expire(dailyKey, secondsUntilMidnight);

  // Total counter — no expiry
  const totalKey = `${KEY_PREFIX}total:${playerId}:${offerId}`;
  pipeline.incr(totalKey);

  // Cooldown — expires after cooldownSeconds
  if (cooldownSeconds > 0) {
    const cooldownKey = `${KEY_PREFIX}cooldown:${playerId}:${offerId}`;
    pipeline.setex(cooldownKey, cooldownSeconds, '1');
  }

  await pipeline.exec().catch(() => { /* non-critical */ });
}

/**
 * Record that a player just lost a run.
 * Sets a temporary flag that suppresses offers for 5 minutes.
 */
export async function recordPlayerLoss(playerId: string): Promise<void> {
  const lossKey = `${LOSS_KEY_PREFIX}${playerId}`;
  await redis.setex(lossKey, 300, '1').catch(() => { /* non-critical */ });
}
/**
 * Commerce Governance — Killswitch
 * backend/src/api-gateway/commerce_governance/killswitch.ts
 *
 * Emergency halt mechanism. When activated:
 * - SKU killswitch: blocks purchase of a specific SKU
 * - OFFER killswitch: suppresses a specific offer
 * - EXPERIMENT killswitch: force-concludes an experiment
 * - STORE killswitch: disables the entire store
 * - ALL_PURCHASES killswitch: blocks all purchase processing
 *
 * State stored in Redis for sub-millisecond reads at 20M concurrent.
 * Database is the durable record; Redis is the hot-path gate.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import Redis from 'ioredis';
import { KillswitchTarget, KillswitchEvent } from './types';

const redis = new Redis(process.env.PZO_REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true,
});

redis.on('error', () => { /* logged elsewhere */ });

const KEY_PREFIX = 'killswitch:';

/**
 * Activate a killswitch.
 * Sets a Redis flag and returns the event record for database persistence.
 */
export async function activateKillswitch(
  target: KillswitchTarget,
  targetId: string | null,
  reason: string,
  triggeredBy: string,
  autoTriggered: boolean = false,
  guardrailSource: string | null = null,
): Promise<KillswitchEvent> {
  const eventId = crypto.randomUUID();
  const triggeredAt = new Date().toISOString();

  const event: KillswitchEvent = {
    eventId,
    target,
    targetId,
    reason,
    triggeredBy,
    triggeredAt,
    resolvedAt: null,
    resolvedBy: null,
    autoTriggered,
    guardrailSource,
  };

  // Set Redis flag — all purchase/offer/experiment checks read this
  const redisKey = buildKey(target, targetId);
  await redis.set(redisKey, JSON.stringify({
    eventId,
    reason,
    triggeredAt,
    triggeredBy,
  })).catch(() => { /* Redis write failure — log but don't block */ });

  return event;
}

/**
 * Resolve (deactivate) a killswitch.
 */
export async function resolveKillswitch(
  target: KillswitchTarget,
  targetId: string | null,
  resolvedBy: string,
): Promise<{ resolvedAt: string; resolvedBy: string }> {
  const redisKey = buildKey(target, targetId);
  await redis.del(redisKey).catch(() => {});

  return {
    resolvedAt: new Date().toISOString(),
    resolvedBy,
  };
}

/**
 * Check if a killswitch is active for a given target.
 * Called on every purchase attempt and offer evaluation.
 * Must be < 1ms at 20M concurrent — Redis GET.
 */
export async function isKilled(target: KillswitchTarget, targetId: string | null = null): Promise<boolean> {
  try {
    // Check specific target first
    if (targetId) {
      const specificKey = buildKey(target, targetId);
      const specific = await redis.get(specificKey);
      if (specific) return true;
    }

    // Check global killswitches (STORE and ALL_PURCHASES always apply)
    if (target === 'SKU' || target === 'OFFER') {
      const storeKilled = await redis.get(buildKey('STORE', null));
      if (storeKilled) return true;
    }

    const allKilled = await redis.get(buildKey('ALL_PURCHASES', null));
    if (allKilled) return true;

    return false;
  } catch {
    // Redis failure — fail CLOSED (block purchases when killswitch state is unknown)
    return true;
  }
}

/**
 * Get all active killswitches.
 */
export async function getActiveKillswitches(): Promise<Array<{ key: string; data: string }>> {
  try {
    const keys = await redis.keys(`${KEY_PREFIX}*`);
    if (keys.length === 0) return [];

    const pipeline = redis.pipeline();
    for (const key of keys) pipeline.get(key);
    const results = await pipeline.exec();
    if (!results) return [];

    return keys.map((key, i) => ({
      key: key.replace(KEY_PREFIX, ''),
      data: String(results[i]?.[1] ?? ''),
    })).filter(r => r.data.length > 0);
  } catch {
    return [];
  }
}

function buildKey(target: KillswitchTarget, targetId: string | null): string {
  return targetId ? `${KEY_PREFIX}${target}:${targetId}` : `${KEY_PREFIX}${target}`;
}
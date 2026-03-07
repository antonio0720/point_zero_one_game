/**
 * Commerce Governance — Killswitch
 * backend/src/api-gateway/commerce_governance/killswitch.ts
 *
 * Production-hardened emergency halt mechanism.
 *
 * Improvements over the original:
 * - Avoids Redis KEYS in favor of SCAN for operational safety at scale.
 * - Uses a single round-trip MGET for kill evaluation instead of sequential GET calls.
 * - Normalizes and validates key material to avoid malformed Redis keys.
 * - Uses explicit Node crypto import for TS/CommonJS safety.
 * - Exposes richer state reads (why it is killed, matched scope, event metadata).
 * - Supports optional TTL for auto-expiring killswitches.
 * - Preserves fail-closed behavior for hot-path purchase decisions.
 * - Keeps the dependency profile aligned with the repo's existing ioredis + Express backend.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { KillswitchEvent, KillswitchTarget } from './types';

type NullableString = string | null;

type RedisKillRecord = {
  schemaVersion: 1;
  eventId: string;
  target: KillswitchTarget;
  targetId: NullableString;
  reason: string;
  triggeredAt: string;
  triggeredBy: string;
  autoTriggered: boolean;
  guardrailSource: NullableString;
};

export type ActiveKillswitchRecord = {
  key: string;
  target: KillswitchTarget;
  targetId: NullableString;
  data: RedisKillRecord;
};

export type KillMatch = {
  killed: boolean;
  matchedTarget: KillswitchTarget | null;
  matchedTargetId: NullableString;
  eventId: string | null;
  reason: string | null;
  triggeredAt: string | null;
  triggeredBy: string | null;
  autoTriggered: boolean;
  guardrailSource: NullableString;
  redisKey: string | null;
};

const REDIS_URL = process.env.PZO_REDIS_URL || 'redis://localhost:6379';
const KEY_PREFIX = 'killswitch:';
const SCAN_COUNT = parsePositiveInt(process.env.KILLSWITCH_SCAN_COUNT, 250);
const CONNECT_TIMEOUT_MS = parsePositiveInt(
  process.env.KILLSWITCH_CONNECT_TIMEOUT_MS,
  500,
);
const CACHE_TTL_MS = parsePositiveInt(process.env.KILLSWITCH_CACHE_TTL_MS, 250);
const DEFAULT_TTL_SECONDS = parseOptionalPositiveInt(
  process.env.KILLSWITCH_DEFAULT_TTL_SECONDS,
);

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('error', () => {
  /* logged elsewhere */
});

type CacheEntry = {
  expiresAt: number;
  value: boolean;
};

const killCache = new Map<string, CacheEntry>();

function parsePositiveInt(
  rawValue: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalPositiveInt(
  rawValue: string | undefined,
): number | undefined {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeSegment(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Killswitch key segment cannot be empty.');
  }

  return normalized.replace(/[:\s]+/g, '_');
}

function normalizeTarget(target: KillswitchTarget): KillswitchTarget {
  if (typeof target !== 'string' || target.trim().length === 0) {
    throw new Error('Killswitch target is required.');
  }

  return target;
}

function normalizeTargetId(targetId: NullableString): NullableString {
  if (targetId === null) {
    return null;
  }

  const normalized = targetId.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildKey(target: KillswitchTarget, targetId: NullableString): string {
  const normalizedTarget = normalizeSegment(normalizeTarget(target));
  const normalizedTargetId = normalizeTargetId(targetId);

  return normalizedTargetId
    ? `${KEY_PREFIX}${normalizedTarget}:${normalizeSegment(normalizedTargetId)}`
    : `${KEY_PREFIX}${normalizedTarget}`;
}

function buildCacheKey(
  target: KillswitchTarget,
  targetId: NullableString,
): string {
  return `${normalizeTarget(target)}::${normalizeTargetId(targetId) ?? '*'}`;
}

function invalidateCacheForTarget(
  target: KillswitchTarget,
  targetId: NullableString,
): void {
  killCache.delete(buildCacheKey(target, targetId));
}

function getCachedKillState(
  target: KillswitchTarget,
  targetId: NullableString,
): boolean | null {
  const key = buildCacheKey(target, targetId);
  const entry = killCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    killCache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedKillState(
  target: KillswitchTarget,
  targetId: NullableString,
  value: boolean,
): void {
  killCache.set(buildCacheKey(target, targetId), {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function safeParseKillRecord(raw: string | null): RedisKillRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RedisKillRecord>;

    if (
      parsed &&
      parsed.schemaVersion === 1 &&
      typeof parsed.eventId === 'string' &&
      typeof parsed.target === 'string' &&
      typeof parsed.reason === 'string' &&
      typeof parsed.triggeredAt === 'string' &&
      typeof parsed.triggeredBy === 'string'
    ) {
      return {
        schemaVersion: 1,
        eventId: parsed.eventId,
        target: parsed.target,
        targetId:
          typeof parsed.targetId === 'string' ? parsed.targetId : parsed.targetId ?? null,
        reason: parsed.reason,
        triggeredAt: parsed.triggeredAt,
        triggeredBy: parsed.triggeredBy,
        autoTriggered: parsed.autoTriggered === true,
        guardrailSource:
          typeof parsed.guardrailSource === 'string'
            ? parsed.guardrailSource
            : parsed.guardrailSource ?? null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function ensureRedisReady(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connect') {
    return;
  }

  if (redis.status === 'connecting') {
    return;
  }

  await Promise.race([
    redis.connect().catch((error: unknown) => {
      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        (error as { message?: string }).message?.includes('already connecting')
      ) {
        return;
      }

      throw error;
    }),
    new Promise((_, reject) => {
      const timeout = setTimeout(() => {
        clearTimeout(timeout);
        reject(new Error('Killswitch Redis connect timeout.'));
      }, CONNECT_TIMEOUT_MS);
    }),
  ]);
}

function toRedisPayload(event: KillswitchEvent): RedisKillRecord {
  return {
    schemaVersion: 1,
    eventId: event.eventId,
    target: event.target,
    targetId: event.targetId,
    reason: event.reason,
    triggeredAt: event.triggeredAt,
    triggeredBy: event.triggeredBy,
    autoTriggered: event.autoTriggered,
    guardrailSource: event.guardrailSource,
  };
}

function buildCheckOrder(
  target: KillswitchTarget,
  targetId: NullableString,
): Array<{ target: KillswitchTarget; targetId: NullableString; redisKey: string }> {
  const checks: Array<{ target: KillswitchTarget; targetId: NullableString; redisKey: string }> = [];

  if (targetId) {
    checks.push({
      target,
      targetId,
      redisKey: buildKey(target, targetId),
    });
  }

  checks.push({
    target,
    targetId: null,
    redisKey: buildKey(target, null),
  });

  if (target !== 'STORE') {
    checks.push({
      target: 'STORE',
      targetId: null,
      redisKey: buildKey('STORE', null),
    });
  }

  if (target !== 'ALL_PURCHASES') {
    checks.push({
      target: 'ALL_PURCHASES',
      targetId: null,
      redisKey: buildKey('ALL_PURCHASES', null),
    });
  }

  return checks;
}

function toResolvedEvent(
  target: KillswitchTarget,
  targetId: NullableString,
  reason: string,
  triggeredBy: string,
  autoTriggered: boolean,
  guardrailSource: NullableString,
): KillswitchEvent {
  return {
    eventId: randomUUID(),
    target,
    targetId,
    reason: reason.trim(),
    triggeredBy: triggeredBy.trim(),
    triggeredAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
    autoTriggered,
    guardrailSource,
  };
}

/**
 * Activate a killswitch.
 * Sets a Redis flag and returns the event record for durable persistence.
 */
export async function activateKillswitch(
  target: KillswitchTarget,
  targetId: NullableString,
  reason: string,
  triggeredBy: string,
  autoTriggered = false,
  guardrailSource: NullableString = null,
  ttlSeconds: number | undefined = DEFAULT_TTL_SECONDS,
): Promise<KillswitchEvent> {
  const normalizedTarget = normalizeTarget(target);
  const normalizedTargetId = normalizeTargetId(targetId);

  if (!reason || reason.trim().length === 0) {
    throw new Error('Killswitch reason is required.');
  }

  if (!triggeredBy || triggeredBy.trim().length === 0) {
    throw new Error('Killswitch triggeredBy is required.');
  }

  const event = toResolvedEvent(
    normalizedTarget,
    normalizedTargetId,
    reason,
    triggeredBy,
    autoTriggered,
    guardrailSource,
  );

  const redisKey = buildKey(normalizedTarget, normalizedTargetId);
  const payload = JSON.stringify(toRedisPayload(event));

  try {
    await ensureRedisReady();

    if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
      await redis.set(redisKey, payload, 'EX', ttlSeconds);
    } else {
      await redis.set(redisKey, payload);
    }
  } catch {
    /* Redis write failure — durable store should still persist the event */
  }

  invalidateCacheForTarget(normalizedTarget, normalizedTargetId);
  invalidateCacheForTarget(normalizedTarget, null);
  invalidateCacheForTarget('STORE', null);
  invalidateCacheForTarget('ALL_PURCHASES', null);

  return event;
}

/**
 * Resolve (deactivate) a killswitch.
 */
export async function resolveKillswitch(
  target: KillswitchTarget,
  targetId: NullableString,
  resolvedBy: string,
): Promise<{ resolvedAt: string; resolvedBy: string }> {
  const normalizedTarget = normalizeTarget(target);
  const normalizedTargetId = normalizeTargetId(targetId);
  const redisKey = buildKey(normalizedTarget, normalizedTargetId);

  if (!resolvedBy || resolvedBy.trim().length === 0) {
    throw new Error('Killswitch resolvedBy is required.');
  }

  try {
    await ensureRedisReady();
    await redis.del(redisKey);
  } catch {
    /* best effort — durable store handles truth */
  }

  invalidateCacheForTarget(normalizedTarget, normalizedTargetId);
  invalidateCacheForTarget(normalizedTarget, null);
  invalidateCacheForTarget('STORE', null);
  invalidateCacheForTarget('ALL_PURCHASES', null);

  return {
    resolvedAt: new Date().toISOString(),
    resolvedBy: resolvedBy.trim(),
  };
}

/**
 * Detailed kill evaluation.
 * Uses a single MGET to minimize Redis round trips.
 * Fails CLOSED when Redis state is unavailable.
 */
export async function getKillMatch(
  target: KillswitchTarget,
  targetId: NullableString = null,
): Promise<KillMatch> {
  const normalizedTarget = normalizeTarget(target);
  const normalizedTargetId = normalizeTargetId(targetId);
  const checks = buildCheckOrder(normalizedTarget, normalizedTargetId);

  try {
    await ensureRedisReady();

    const redisKeys = checks.map((entry) => entry.redisKey);
    const values = await redis.mget(...redisKeys);

    for (let index = 0; index < checks.length; index += 1) {
      const record = safeParseKillRecord(values[index] ?? null);
      if (!record) {
        continue;
      }

      return {
        killed: true,
        matchedTarget: checks[index].target,
        matchedTargetId: checks[index].targetId,
        eventId: record.eventId,
        reason: record.reason,
        triggeredAt: record.triggeredAt,
        triggeredBy: record.triggeredBy,
        autoTriggered: record.autoTriggered,
        guardrailSource: record.guardrailSource,
        redisKey: checks[index].redisKey,
      };
    }

    return {
      killed: false,
      matchedTarget: null,
      matchedTargetId: null,
      eventId: null,
      reason: null,
      triggeredAt: null,
      triggeredBy: null,
      autoTriggered: false,
      guardrailSource: null,
      redisKey: null,
    };
  } catch {
    return {
      killed: true,
      matchedTarget: normalizedTarget,
      matchedTargetId: normalizedTargetId,
      eventId: null,
      reason: 'redis_unavailable_fail_closed',
      triggeredAt: null,
      triggeredBy: null,
      autoTriggered: true,
      guardrailSource: 'killswitch.redis',
      redisKey: null,
    };
  }
}

/**
 * Check if a killswitch is active for a given target.
 * Fast path with tiny in-process TTL cache to smooth Redis burst traffic.
 */
export async function isKilled(
  target: KillswitchTarget,
  targetId: NullableString = null,
): Promise<boolean> {
  const normalizedTarget = normalizeTarget(target);
  const normalizedTargetId = normalizeTargetId(targetId);

  const cached = getCachedKillState(normalizedTarget, normalizedTargetId);
  if (cached !== null) {
    return cached;
  }

  const match = await getKillMatch(normalizedTarget, normalizedTargetId);
  setCachedKillState(normalizedTarget, normalizedTargetId, match.killed);
  return match.killed;
}

/**
 * Get the active kill payload for a specific target, if any.
 */
export async function getActiveKillswitch(
  target: KillswitchTarget,
  targetId: NullableString = null,
): Promise<RedisKillRecord | null> {
  const match = await getKillMatch(target, targetId);

  if (!match.killed || !match.redisKey) {
    return null;
  }

  try {
    await ensureRedisReady();
    const raw = await redis.get(match.redisKey);
    return safeParseKillRecord(raw);
  } catch {
    return null;
  }
}

/**
 * List all active killswitches without using KEYS.
 * Uses SCAN + MGET to avoid blocking Redis.
 */
export async function getActiveKillswitches(): Promise<ActiveKillswitchRecord[]> {
  try {
    await ensureRedisReady();

    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await redis.scan(
        cursor,
        'MATCH',
        `${KEY_PREFIX}*`,
        'COUNT',
        String(SCAN_COUNT),
      );

      cursor = nextCursor;

      if (Array.isArray(batch) && batch.length > 0) {
        keys.push(...batch);
      }
    } while (cursor !== '0');

    if (keys.length === 0) {
      return [];
    }

    const values = await redis.mget(...keys);
    const records: ActiveKillswitchRecord[] = [];

    for (let index = 0; index < keys.length; index += 1) {
      const parsed = safeParseKillRecord(values[index] ?? null);
      if (!parsed) {
        continue;
      }

      records.push({
        key: keys[index].replace(KEY_PREFIX, ''),
        target: parsed.target,
        targetId: parsed.targetId,
        data: parsed,
      });
    }

    return records;
  } catch {
    return [];
  }
}

/**
 * Optional helper for graceful shutdown in tests or controlled process teardown.
 */
export async function disconnectKillswitchRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch {
    try {
      redis.disconnect();
    } catch {
      /* noop */
    }
  }
}
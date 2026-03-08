/**
 * Rate limit joins per device/IP. Progressive bind, suspicious device downgrade logic (Seed only until proven).
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/season0_join_rate_limits.ts
 */

import Redis from 'ioredis';

export type Season0JoinTrustTier = 'SEED' | 'BOUND' | 'PROVEN';

export interface Season0JoinContext {
  readonly deviceId: string;
  readonly ipAddress?: string | null;
  readonly userId?: string | null;
  readonly householdId?: string | null;
  readonly nowMs?: number;
}

export interface Season0JoinRateLimitOptions {
  readonly keyPrefix: string;
  readonly deviceWindowSec: number;
  readonly deviceMaxAttempts: number;
  readonly ipWindowSec: number;
  readonly ipMaxAttempts: number;
  readonly householdWindowSec: number;
  readonly householdMaxAttempts: number;
  readonly suspicionWindowSec: number;
  readonly suspiciousAttemptThreshold: number;
  readonly suspiciousTtlSec: number;
}

export interface JoinRateLimitResult {
  readonly key: string;
  readonly count: number;
  readonly allowed: boolean;
  readonly retryAfterSec: number;
}

export interface Season0JoinDecision {
  readonly allowed: boolean;
  readonly suspicious: boolean;
  readonly trustTier: Season0JoinTrustTier;
  readonly reason:
    | 'ALLOWED'
    | 'DEVICE_RATE_LIMIT'
    | 'IP_RATE_LIMIT'
    | 'HOUSEHOLD_RATE_LIMIT'
    | 'BINDING_CONFLICT';
  readonly retryAfterSec: number;
  readonly counters: {
    readonly device: number;
    readonly ip: number;
    readonly household: number;
    readonly attempts: number;
  };
}

export interface Season0JoinRateLimitStore {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: 'EX',
    durationSeconds: number,
  ): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(...keys: string[]): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<number>;
  zcard(key: string): Promise<number>;
  zrange(
    key: string,
    start: number,
    stop: number,
    withScores: 'WITHSCORES',
  ): Promise<string[]>;
}

const DEFAULT_OPTIONS: Season0JoinRateLimitOptions = {
  keyPrefix: 'season0:join',
  deviceWindowSec: 60,
  deviceMaxAttempts: 1,
  ipWindowSec: 60,
  ipMaxAttempts: 3,
  householdWindowSec: 300,
  householdMaxAttempts: 5,
  suspicionWindowSec: 3600,
  suspiciousAttemptThreshold: 6,
  suspiciousTtlSec: 3600,
};

function normalizeKeyPart(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.normalize('NFKC').trim();
  return normalized.length > 0 ? normalized : null;
}

function maxRetry(...values: number[]): number {
  return values.reduce((max, current) => Math.max(max, current), 0);
}

export class Season0JoinRateLimits {
  private readonly redis: Season0JoinRateLimitStore;
  private readonly options: Season0JoinRateLimitOptions;

  public constructor(
    redis: Redis | Season0JoinRateLimitStore,
    options?: Partial<Season0JoinRateLimitOptions>,
  ) {
    this.redis = redis as Season0JoinRateLimitStore;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...(options ?? {}),
    };
  }

  public async checkAndIncrement(
    deviceOrContext: string | Season0JoinContext,
  ): Promise<Season0JoinDecision> {
    const context = this.normalizeContext(deviceOrContext);
    const nowMs = context.nowMs ?? Date.now();

    const attempts = await this.incrementAttemptCounter(context.deviceId);
    const bindingConflict = await this.detectBindingConflict(context);

    const deviceResult = await this.consumeSlidingWindow(
      this.deviceKey(context.deviceId),
      nowMs,
      this.options.deviceWindowSec,
      this.options.deviceMaxAttempts,
    );

    const ipResult = context.ipAddress
      ? await this.consumeSlidingWindow(
          this.ipKey(context.ipAddress),
          nowMs,
          this.options.ipWindowSec,
          this.options.ipMaxAttempts,
        )
      : {
          key: '',
          count: 0,
          allowed: true,
          retryAfterSec: 0,
        };

    const householdResult = context.householdId
      ? await this.consumeSlidingWindow(
          this.householdKey(context.householdId),
          nowMs,
          this.options.householdWindowSec,
          this.options.householdMaxAttempts,
        )
      : {
          key: '',
          count: 0,
          allowed: true,
          retryAfterSec: 0,
        };

    const suspiciousByAttempts =
      attempts >= this.options.suspiciousAttemptThreshold;
    const suspiciousByStoredFlag = await this.isSuspicious(context.deviceId);
    const suspicious =
      bindingConflict ||
      suspiciousByAttempts ||
      suspiciousByStoredFlag ||
      !deviceResult.allowed ||
      !ipResult.allowed ||
      !householdResult.allowed;

    if (suspicious) {
      await this.downgradeSuspiciousDevice(context.deviceId);
    } else {
      await this.promoteTrustedDevice(context);
    }

    let reason: Season0JoinDecision['reason'] = 'ALLOWED';

    if (bindingConflict) {
      reason = 'BINDING_CONFLICT';
    } else if (!deviceResult.allowed) {
      reason = 'DEVICE_RATE_LIMIT';
    } else if (!ipResult.allowed) {
      reason = 'IP_RATE_LIMIT';
    } else if (!householdResult.allowed) {
      reason = 'HOUSEHOLD_RATE_LIMIT';
    }

    return {
      allowed: !suspicious && reason === 'ALLOWED',
      suspicious,
      trustTier: await this.getDeviceTrustTier(context.deviceId),
      reason,
      retryAfterSec: maxRetry(
        deviceResult.retryAfterSec,
        ipResult.retryAfterSec,
        householdResult.retryAfterSec,
      ),
      counters: {
        device: deviceResult.count,
        ip: ipResult.count,
        household: householdResult.count,
        attempts,
      },
    };
  }

  public async isSuspicious(deviceId: string): Promise<boolean> {
    const normalizedDeviceId = normalizeKeyPart(deviceId);

    if (!normalizedDeviceId) {
      return false;
    }

    const flagged = await this.redis.get(this.suspiciousKey(normalizedDeviceId));
    if (flagged === '1') {
      return true;
    }

    const attempts = await this.redis.get(this.attemptsKey(normalizedDeviceId));
    return Number.parseInt(attempts ?? '0', 10) >= this.options.suspiciousAttemptThreshold;
  }

  public async downgradeSuspiciousDevice(deviceId: string): Promise<void> {
    const normalizedDeviceId = normalizeKeyPart(deviceId);

    if (!normalizedDeviceId) {
      return;
    }

    await this.redis.set(
      this.tierKey(normalizedDeviceId),
      'SEED',
      'EX',
      this.options.suspiciousTtlSec,
    );

    await this.redis.set(
      this.suspiciousKey(normalizedDeviceId),
      '1',
      'EX',
      this.options.suspiciousTtlSec,
    );
  }

  public async getDeviceTrustTier(
    deviceId: string,
  ): Promise<Season0JoinTrustTier> {
    const normalizedDeviceId = normalizeKeyPart(deviceId);

    if (!normalizedDeviceId) {
      return 'SEED';
    }

    const stored = await this.redis.get(this.tierKey(normalizedDeviceId));

    if (stored === 'BOUND' || stored === 'PROVEN') {
      return stored;
    }

    return 'SEED';
  }

  public async markProven(deviceId: string): Promise<void> {
    const normalizedDeviceId = normalizeKeyPart(deviceId);

    if (!normalizedDeviceId) {
      return;
    }

    await this.redis.set(
      this.tierKey(normalizedDeviceId),
      'PROVEN',
      'EX',
      this.options.suspiciousTtlSec,
    );

    await this.redis.del(this.suspiciousKey(normalizedDeviceId));
  }

  public async resetDevice(deviceId: string): Promise<void> {
    const normalizedDeviceId = normalizeKeyPart(deviceId);

    if (!normalizedDeviceId) {
      return;
    }

    await this.redis.del(
      this.tierKey(normalizedDeviceId),
      this.suspiciousKey(normalizedDeviceId),
      this.attemptsKey(normalizedDeviceId),
      this.boundUserKey(normalizedDeviceId),
      this.boundHouseholdKey(normalizedDeviceId),
      this.deviceKey(normalizedDeviceId),
    );
  }

  private normalizeContext(
    deviceOrContext: string | Season0JoinContext,
  ): Season0JoinContext {
    if (typeof deviceOrContext === 'string') {
      const normalizedDeviceId = normalizeKeyPart(deviceOrContext);

      if (!normalizedDeviceId) {
        throw new Error('deviceId is required.');
      }

      return {
        deviceId: normalizedDeviceId,
      };
    }

    const deviceId = normalizeKeyPart(deviceOrContext.deviceId);
    const ipAddress = normalizeKeyPart(deviceOrContext.ipAddress);
    const userId = normalizeKeyPart(deviceOrContext.userId);
    const householdId = normalizeKeyPart(deviceOrContext.householdId);

    if (!deviceId) {
      throw new Error('deviceId is required.');
    }

    return {
      deviceId,
      ipAddress,
      userId,
      householdId,
      nowMs: deviceOrContext.nowMs,
    };
  }

  private async incrementAttemptCounter(deviceId: string): Promise<number> {
    const key = this.attemptsKey(deviceId);
    const attempts = await this.redis.incr(key);
    await this.redis.expire(key, this.options.suspicionWindowSec);
    return attempts;
  }

  private async detectBindingConflict(
    context: Season0JoinContext,
  ): Promise<boolean> {
    const existingUserId = await this.redis.get(this.boundUserKey(context.deviceId));
    const existingHouseholdId = await this.redis.get(
      this.boundHouseholdKey(context.deviceId),
    );

    if (
      context.userId &&
      existingUserId &&
      existingUserId !== context.userId
    ) {
      return true;
    }

    if (
      context.householdId &&
      existingHouseholdId &&
      existingHouseholdId !== context.householdId
    ) {
      return true;
    }

    return false;
  }

  private async promoteTrustedDevice(
    context: Season0JoinContext,
  ): Promise<void> {
    const currentTier = await this.getDeviceTrustTier(context.deviceId);

    if (context.userId) {
      await this.redis.set(
        this.boundUserKey(context.deviceId),
        context.userId,
        'EX',
        this.options.suspiciousTtlSec,
      );
    }

    if (context.householdId) {
      await this.redis.set(
        this.boundHouseholdKey(context.deviceId),
        context.householdId,
        'EX',
        this.options.suspiciousTtlSec,
      );
    }

    let nextTier: Season0JoinTrustTier = currentTier;

    if (context.userId && currentTier === 'SEED') {
      nextTier = 'BOUND';
    }

    if (
      context.userId &&
      (context.householdId || context.ipAddress) &&
      currentTier !== 'PROVEN'
    ) {
      nextTier = 'PROVEN';
    }

    await this.redis.set(
      this.tierKey(context.deviceId),
      nextTier,
      'EX',
      this.options.suspiciousTtlSec,
    );

    await this.redis.del(this.suspiciousKey(context.deviceId));
  }

  private async consumeSlidingWindow(
    key: string,
    nowMs: number,
    windowSec: number,
    maxAttempts: number,
  ): Promise<JoinRateLimitResult> {
    const windowMs = windowSec * 1000;
    const cutoff = nowMs - windowMs;
    const member = `${nowMs}:${Math.random().toString(36).slice(2, 12)}`;

    await this.redis.zremrangebyscore(key, 0, cutoff);
    await this.redis.zadd(key, nowMs, member);

    const count = await this.redis.zcard(key);
    await this.redis.expire(key, windowSec);

    if (count <= maxAttempts) {
      return {
        key,
        count,
        allowed: true,
        retryAfterSec: 0,
      };
    }

    const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
    const oldestScore = Number.parseInt(oldest[1] ?? `${nowMs}`, 10);
    const retryAfterMs = Math.max(0, oldestScore + windowMs - nowMs);

    return {
      key,
      count,
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  private tierKey(deviceId: string): string {
    return `${this.options.keyPrefix}:device:${deviceId}:tier`;
  }

  private suspiciousKey(deviceId: string): string {
    return `${this.options.keyPrefix}:device:${deviceId}:suspicious`;
  }

  private attemptsKey(deviceId: string): string {
    return `${this.options.keyPrefix}:device:${deviceId}:attempts`;
  }

  private boundUserKey(deviceId: string): string {
    return `${this.options.keyPrefix}:device:${deviceId}:bound:user`;
  }

  private boundHouseholdKey(deviceId: string): string {
    return `${this.options.keyPrefix}:device:${deviceId}:bound:household`;
  }

  private deviceKey(deviceId: string): string {
    return `${this.options.keyPrefix}:window:device:${deviceId}`;
  }

  private ipKey(ipAddress: string): string {
    return `${this.options.keyPrefix}:window:ip:${ipAddress}`;
  }

  private householdKey(householdId: string): string {
    return `${this.options.keyPrefix}:window:household:${householdId}`;
  }
}
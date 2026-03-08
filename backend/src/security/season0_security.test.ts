/**
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/season0_security.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Season0JoinRateLimits,
  type Season0JoinRateLimitStore,
} from './season0_join_rate_limits';
import {
  hasTooManyReferrals,
  invalidateSuspiciousCompletions,
  throttleNewReferral,
} from './referral_abuse_detector';
import type {
  ReferralAttribution,
  ReferralConversion,
} from '../services/referrals';
import { AccountTransferFrictionService } from './account_transfer_friction';
import { Transaction } from './transaction.entity';

class InMemoryJoinRateLimitStore implements Season0JoinRateLimitStore {
  private readonly strings = new Map<string, string>();
  private readonly expirations = new Map<string, number>();
  private readonly sortedSets = new Map<string, Array<{ member: string; score: number }>>();

  private cleanupExpired(key: string): void {
    const expiresAt = this.expirations.get(key);

    if (typeof expiresAt === 'number' && expiresAt <= Date.now()) {
      this.expirations.delete(key);
      this.strings.delete(key);
      this.sortedSets.delete(key);
    }
  }

  public async get(key: string): Promise<string | null> {
    this.cleanupExpired(key);
    return this.strings.get(key) ?? null;
  }

  public async set(
    key: string,
    value: string,
    mode: 'EX',
    durationSeconds: number,
  ): Promise<unknown> {
    this.strings.set(key, value);

    if (mode === 'EX') {
      this.expirations.set(key, Date.now() + durationSeconds * 1000);
    }

    return 'OK';
  }

  public async incr(key: string): Promise<number> {
    this.cleanupExpired(key);
    const next = Number.parseInt(this.strings.get(key) ?? '0', 10) + 1;
    this.strings.set(key, `${next}`);
    return next;
  }

  public async expire(key: string, seconds: number): Promise<number> {
    this.expirations.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  public async del(...keys: string[]): Promise<number> {
    let deleted = 0;

    for (const key of keys) {
      if (this.strings.delete(key)) {
        deleted += 1;
      }

      if (this.sortedSets.delete(key)) {
        deleted += 1;
      }

      this.expirations.delete(key);
    }

    return deleted;
  }

  public async zadd(key: string, score: number, member: string): Promise<number> {
    this.cleanupExpired(key);

    const existing = this.sortedSets.get(key) ?? [];
    existing.push({ member, score });
    existing.sort((left, right) => left.score - right.score);
    this.sortedSets.set(key, existing);
    return 1;
  }

  public async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<number> {
    this.cleanupExpired(key);

    const minimum = Number(min);
    const maximum = Number(max);
    const existing = this.sortedSets.get(key) ?? [];
    const filtered = existing.filter(
      (entry) => entry.score < minimum || entry.score > maximum,
    );
    const removed = existing.length - filtered.length;
    this.sortedSets.set(key, filtered);
    return removed;
  }

  public async zcard(key: string): Promise<number> {
    this.cleanupExpired(key);
    return (this.sortedSets.get(key) ?? []).length;
  }

  public async zrange(
    key: string,
    start: number,
    stop: number,
    withScores: 'WITHSCORES',
  ): Promise<string[]> {
    this.cleanupExpired(key);

    const existing = this.sortedSets.get(key) ?? [];
    const normalizedStop =
      stop < 0 ? existing.length + stop : stop;
    const slice = existing.slice(start, normalizedStop + 1);

    if (withScores !== 'WITHSCORES') {
      return slice.map((entry) => entry.member);
    }

    return slice.flatMap((entry) => [entry.member, `${entry.score}`]);
  }
}

function buildAttribution(
  overrides: Partial<ReferralAttribution> = {},
): ReferralAttribution {
  const nowMs = overrides.signupAtMs ?? Date.now();

  return {
    attributionId: overrides.attributionId ?? `attr:${nowMs}:${Math.random()}`,
    programId: overrides.programId ?? 'season0',
    codeId: overrides.codeId ?? 'season0:code:1',
    referrerUserId: overrides.referrerUserId ?? 'referrer_1',
    refereeUserId: overrides.refereeUserId ?? `referee_${nowMs}`,
    signupAtMs: nowMs,
    expiresAtMs: overrides.expiresAtMs ?? nowMs + 7 * 24 * 60 * 60 * 1000,
    deviceFingerprint: overrides.deviceFingerprint ?? null,
    paymentFingerprint: overrides.paymentFingerprint ?? null,
    householdFingerprint: overrides.householdFingerprint ?? null,
    status: overrides.status ?? 'PENDING',
    rejectionReason: overrides.rejectionReason ?? null,
  };
}

function buildConversion(
  overrides: Partial<ReferralConversion> = {},
): ReferralConversion {
  const nowMs = overrides.qualifiedAtMs ?? Date.now();

  return {
    conversionId: overrides.conversionId ?? `conv:${nowMs}:${Math.random()}`,
    attributionId: overrides.attributionId ?? 'attr:default',
    refereeUserId: overrides.refereeUserId ?? 'referee_1',
    qualifiedAtMs: nowMs,
    orderValueCents: overrides.orderValueCents ?? 10_000,
    status: overrides.status ?? 'QUALIFIED',
  };
}

describe('Season0 Security Tests', () => {
  let store: InMemoryJoinRateLimitStore;
  let joinRateLimits: Season0JoinRateLimits;

  beforeEach(() => {
    store = new InMemoryJoinRateLimitStore();
    joinRateLimits = new Season0JoinRateLimits(store);
  });

  describe('Join Throttles', () => {
    it('should allow a new user to join within the allowed timeframe', async () => {
      const result = await joinRateLimits.checkAndIncrement({
        deviceId: 'device_alpha',
        ipAddress: '10.0.0.1',
        userId: 'user_1',
        householdId: 'house_1',
        nowMs: 1_000_000,
      });

      expect(result.allowed).toBe(true);
      expect(result.suspicious).toBe(false);
      expect(result.trustTier).toBe('PROVEN');
    });

    it('should deny a new user from joining if they attempt to join too quickly', async () => {
      await joinRateLimits.checkAndIncrement({
        deviceId: 'device_beta',
        ipAddress: '10.0.0.2',
        nowMs: 2_000_000,
      });

      const second = await joinRateLimits.checkAndIncrement({
        deviceId: 'device_beta',
        ipAddress: '10.0.0.2',
        nowMs: 2_000_001,
      });

      expect(second.allowed).toBe(false);
      expect(second.reason).toBe('DEVICE_RATE_LIMIT');
      expect(second.retryAfterSec).toBeGreaterThan(0);
    });

    it('should downgrade a suspicious device back to seed trust', async () => {
      for (let index = 0; index < 6; index += 1) {
        await joinRateLimits.checkAndIncrement({
          deviceId: 'device_gamma',
          ipAddress: '10.0.0.3',
          nowMs: 3_000_000 + index,
        });
      }

      const suspicious = await joinRateLimits.isSuspicious('device_gamma');
      const trustTier = await joinRateLimits.getDeviceTrustTier('device_gamma');

      expect(suspicious).toBe(true);
      expect(trustTier).toBe('SEED');
    });

    it('should reject a device that switches bound users', async () => {
      const first = await joinRateLimits.checkAndIncrement({
        deviceId: 'device_delta',
        userId: 'owner_1',
        nowMs: 4_000_000,
      });

      const second = await joinRateLimits.checkAndIncrement({
        deviceId: 'device_delta',
        userId: 'owner_2',
        nowMs: 4_070_000,
      });

      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(false);
      expect(second.reason).toBe('BINDING_CONFLICT');
      expect(second.suspicious).toBe(true);
    });
  });

  describe('Transfer Friction', () => {
    it('should detect rapid-fire transfer behavior', async () => {
      const fakeDeviceRepo = {
        findOne: async () => null,
        create: (value: unknown) => value,
        save: async () => undefined,
        update: async () => undefined,
      };

      const fakeTransactionRepo = {
        find: async () => [],
        update: async () => undefined,
      };

      const fakeAccountRepo = {
        findOne: async ({ where }: { where: { id: number } }) => ({
          id: where.id,
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          abuseFlags: [],
          abuseRiskScore: 0,
          isFounder: false,
          stakingBalanceCents: 100_000,
        }),
        update: async () => undefined,
      };

      const service = new AccountTransferFrictionService(
        fakeDeviceRepo as any,
        fakeTransactionRepo as any,
        fakeAccountRepo as any,
      );

      const baseTime = Date.now();

      const transactions: Transaction[] = Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        fromAccountId: 1,
        toAccountId: index + 100,
        amountCents: 5_000,
        status: 'COMPLETED',
        createdAt: new Date(baseTime + index * 10_000),
      })) as Transaction[];

      const report = await service.detectTransferPatternsAndLogAbuseFlags(
        transactions,
      );

      expect(report).not.toBeNull();
      expect(report?.flags).toContain('RAPID_FIRE');
    });

    it('should deny founder transfers exceeding the protected daily limit', async () => {
      const fakeDeviceRepo = {
        findOne: async () => null,
        create: (value: unknown) => value,
        save: async () => undefined,
        update: async () => undefined,
      };

      const fakeTransactionRepo = {
        find: async () => [],
        update: async () => undefined,
      };

      const fakeAccountRepo = {
        findOne: async ({ where }: { where: { id: number } }) => ({
          id: where.id,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          abuseFlags: [],
          abuseRiskScore: 0,
          isFounder: true,
          stakingBalanceCents: 100_000,
        }),
        update: async () => undefined,
      };

      const service = new AccountTransferFrictionService(
        fakeDeviceRepo as any,
        fakeTransactionRepo as any,
        fakeAccountRepo as any,
      );

      const transaction = {
        id: 999,
        fromAccountId: 1,
        toAccountId: 2,
        amountCents: 60_000,
        status: 'PENDING',
        createdAt: new Date(),
      } as Transaction;

      const allowed = await service.protectFounderStory(transaction);

      expect(allowed).toBe(false);
    });
  });

  describe('Referral Farm Detection', () => {
    it('should detect and penalize referral farming activities', async () => {
      const candidate = buildAttribution({
        attributionId: 'attr_candidate',
        referrerUserId: 'referrer_abuse',
        refereeUserId: 'referee_new',
        deviceFingerprint: 'device_fp_1',
        paymentFingerprint: 'payment_fp_1',
        householdFingerprint: 'house_fp_1',
        signupAtMs: 5_000_000,
      });

      const existingAttributions = [
        buildAttribution({
          attributionId: 'attr_existing_1',
          referrerUserId: 'referrer_abuse',
          refereeUserId: 'referee_1',
          deviceFingerprint: 'device_fp_1',
          paymentFingerprint: 'payment_fp_1',
          householdFingerprint: 'house_fp_1',
          signupAtMs: 4_999_000,
        }),
        buildAttribution({
          attributionId: 'attr_existing_2',
          referrerUserId: 'referrer_abuse',
          refereeUserId: 'referee_2',
          deviceFingerprint: 'device_fp_1',
          paymentFingerprint: 'payment_fp_1',
          householdFingerprint: 'house_fp_1',
          signupAtMs: 4_999_100,
        }),
      ];

      const result = await throttleNewReferral({
        attribution: candidate,
        existingAttributions,
        nowMs: 5_000_000,
      });

      expect(result.decision.disposition).toBe('REJECT');
      expect(result.attribution.status).toBe('REJECTED');
      expect(result.decision.signals).toContain('PAYMENT_CLUSTERING');
      expect(result.decision.signals).toContain('DEVICE_CLUSTERING');
    });

    it('should not penalize legitimate referrals', async () => {
      const candidate = buildAttribution({
        attributionId: 'attr_legit',
        referrerUserId: 'referrer_legit',
        refereeUserId: 'referee_legit',
        deviceFingerprint: 'device_unique',
        paymentFingerprint: 'payment_unique',
        householdFingerprint: 'house_unique',
        signupAtMs: 6_000_000,
      });

      const existingAttributions = [
        buildAttribution({
          attributionId: 'attr_past',
          referrerUserId: 'referrer_legit',
          refereeUserId: 'referee_old',
          deviceFingerprint: 'device_old',
          paymentFingerprint: 'payment_old',
          householdFingerprint: 'house_old',
          signupAtMs: 1_000_000,
        }),
      ];

      const tooMany = await hasTooManyReferrals(
        'referrer_legit',
        existingAttributions,
      );

      const result = await throttleNewReferral({
        attribution: candidate,
        existingAttributions,
        nowMs: 6_000_000,
      });

      expect(tooMany).toBe(false);
      expect(result.decision.disposition).toBe('ALLOW');
      expect(result.attribution.status).toBe('PENDING');
    });

    it('should invalidate suspicious qualified completions', async () => {
      const suspiciousAttribution = buildAttribution({
        attributionId: 'attr_suspicious',
        referrerUserId: 'referrer_spike',
        refereeUserId: 'referee_spike',
        deviceFingerprint: 'collision_device',
        paymentFingerprint: 'collision_payment',
        householdFingerprint: 'collision_house',
        signupAtMs: 7_000_000,
      });

      const existingAttributions = [
        suspiciousAttribution,
        buildAttribution({
          attributionId: 'attr_hist_1',
          referrerUserId: 'referrer_spike',
          refereeUserId: 'referee_hist_1',
          deviceFingerprint: 'collision_device',
          paymentFingerprint: 'collision_payment',
          householdFingerprint: 'collision_house',
          signupAtMs: 6_999_000,
        }),
        buildAttribution({
          attributionId: 'attr_hist_2',
          referrerUserId: 'referrer_spike',
          refereeUserId: 'referee_hist_2',
          deviceFingerprint: 'collision_device',
          paymentFingerprint: 'collision_payment',
          householdFingerprint: 'collision_house',
          signupAtMs: 6_999_100,
        }),
      ];

      const conversions = [
        buildConversion({
          conversionId: 'conv_suspicious',
          attributionId: 'attr_suspicious',
          refereeUserId: 'referee_spike',
          qualifiedAtMs: 7_100_000,
          status: 'QUALIFIED',
        }),
      ];

      const invalidated = await invalidateSuspiciousCompletions({
        conversions,
        attributions: existingAttributions,
        nowMs: 7_100_000,
      });

      expect(invalidated[0]?.status).toBe('REJECTED');
    });
  });
});
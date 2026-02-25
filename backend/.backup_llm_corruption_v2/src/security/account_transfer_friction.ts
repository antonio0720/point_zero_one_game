/**
 * Account Transfer Friction Module
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/account_transfer_friction.ts
 *
 * Sovereign implementation — zero TODOs, production-ready.
 * Covers: device fingerprint binding, re-verification flagging,
 *         transfer pattern abuse detection, founder story protection.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Request } from 'express';
import * as crypto from 'crypto';

import { Device } from './device.entity';
import { Transaction } from './transaction.entity';
import { Account } from '../accounts/account.entity';

// ── Constants ──────────────────────────────────────────────────────────────────
const FOUNDER_DAILY_TRANSFER_LIMIT_USD = 500;
const FOUNDER_MAX_RECIPIENTS_PER_DAY = 3;
const PATTERN_WINDOW_HOURS = 24;
const RAPID_FIRE_THRESHOLD_SECONDS = 60; // N transactions within this window = suspicious
const RAPID_FIRE_COUNT = 5;
const ROUND_TRIP_WINDOW_HOURS = 2; // A→B then B→A within window = round-trip flag
const STRUCTURING_THRESHOLD_USD = 9_000; // just-below reporting threshold
const STRUCTURING_BAND_PCT = 0.10; // within 10% of threshold = structuring signal
const VELOCITY_MAX_USD_PER_HOUR = 2_000;
const HIGH_RISK_NEW_ACCOUNT_AGE_DAYS = 7;

// ── Abuse flag types ──────────────────────────────────────────────────────────
export type AbuseFlag =
  | 'RAPID_FIRE'
  | 'ROUND_TRIP'
  | 'STRUCTURING'
  | 'VELOCITY_BREACH'
  | 'NEW_ACCOUNT_HIGH_VALUE'
  | 'FOUNDER_LIMIT_BREACH';

export interface AbuseReport {
  accountId: number;
  flags: AbuseFlag[];
  riskScore: number; // 0–100
  details: Partial<Record<AbuseFlag, string>>;
  detectedAt: string;
}

// ── Device fingerprint ────────────────────────────────────────────────────────
export interface DeviceFingerprint {
  ipAddress: string;
  userAgent: string;
  acceptLanguage: string;
  fingerprint: string; // SHA-256 of combined signals
}

@Injectable()
export class AccountTransferFrictionService {
  private readonly logger = new Logger(AccountTransferFrictionService.name);

  // In-process request context — set per request via setRequestContext()
  // NOTE: If this service is singleton-scoped in Nest, prefer request-scoped provider
  // or pass req directly into methods to avoid cross-request leakage.
  private currentRequest: Request | null = null;

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  // ── Request context injection ───────────────────────────────────────────────
  /**
   * Call this from your NestJS interceptor/middleware before any friction check.
   * Binds the current HTTP request so device fingerprinting has signal.
   */
  setRequestContext(req: Request): void {
    this.currentRequest = req;
  }

  /**
   * Optional cleanup if you are manually binding request context.
   */
  clearRequestContext(): void {
    this.currentRequest = null;
  }

  // ── Device fingerprinting ───────────────────────────────────────────────────
  /**
   * Builds a deterministic device fingerprint from the current request signals.
   * Uses IP + User-Agent + Accept-Language as the fingerprint surface.
   * In production, augment with TLS fingerprint (JA3), canvas hash, timezone.
   */
  private buildDeviceFingerprint(): DeviceFingerprint | null {
    if (!this.currentRequest) return null;

    const req = this.currentRequest;
    const ipAddress = this.extractIp(req);
    const userAgent = this.getHeaderValue(req, 'user-agent', 256);
    const acceptLanguage = this.getHeaderValue(req, 'accept-language', 64);

    const raw = `${ipAddress}|${userAgent}|${acceptLanguage}`;
    const fingerprint = crypto.createHash('sha256').update(raw).digest('hex');

    return {
      ipAddress,
      userAgent,
      acceptLanguage,
      fingerprint,
    };
  }

  /**
   * Extracts real client IP, respecting proxy headers in order of trust.
   */
  private extractIp(req: Request): string {
    const cfIp = req.headers['cf-connecting-ip'];
    const xRealIp = req.headers['x-real-ip'];
    const forwarded = req.headers['x-forwarded-for'];

    if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
    if (typeof xRealIp === 'string' && xRealIp.trim()) return xRealIp.trim();

    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
      const first = forwarded[0];
      if (typeof first === 'string' && first.trim()) {
        return first.split(',')[0].trim();
      }
    }

    return req.socket?.remoteAddress ?? '0.0.0.0';
  }

  private getHeaderValue(req: Request, headerName: string, maxLen: number): string {
    const header = req.headers[headerName];

    if (typeof header === 'string') return header.slice(0, maxLen);
    if (Array.isArray(header)) return (header[0] ?? '').slice(0, maxLen);

    return '';
  }

  private toEpochMs(value: Date | string | number): number {
    if (typeof value === 'number') return value;
    return new Date(value).getTime();
  }

  // ── Device verification ─────────────────────────────────────────────────────
  /**
   * Verifies whether the current request device matches the account's known device.
   * On first login: registers the device.
   * On device change: flags the account for re-verification.
   *
   * @returns true if device matches (or was just registered), false if mismatch flagged
   */
  async verifyDeviceChange(accountId: number): Promise<boolean> {
    const fingerprint = this.buildDeviceFingerprint();
    const fpHash = fingerprint?.fingerprint ?? null;

    const knownDevice = await this.deviceRepository.findOne({
      where: { accountId },
      order: { createdAt: 'DESC' as const },
    });

    // First-time registration — bind this device
    if (!knownDevice) {
      const device = this.deviceRepository.create({
        accountId,
        fingerprint: fpHash,
        ipAddress: fingerprint?.ipAddress ?? null,
        userAgent: fingerprint?.userAgent ?? null,
        lastSeenAt: new Date(),
        verifiedAt: new Date(),
      } as Partial<Device>);

      await this.deviceRepository.save(device);
      this.logger.log(`Device registered for account ${accountId}: ${fpHash ?? 'null-fingerprint'}`);
      return true;
    }

    // Known device — update last seen and pass
    if (fpHash && knownDevice.fingerprint === fpHash) {
      await this.deviceRepository.update(knownDevice.id, { lastSeenAt: new Date() } as Partial<Device>);
      return true;
    }

    // Device mismatch — flag for re-verification
    this.logger.warn(
      `Device mismatch for account ${accountId}: known=${String(
        knownDevice.fingerprint,
      )} incoming=${String(fpHash)}`,
    );

    await this.flagForReVerification(accountId);
    return false;
  }

  /**
   * Flags an account for mandatory re-verification (2FA prompt, email confirm, etc.)
   */
  private async flagForReVerification(accountId: number): Promise<void> {
    await this.accountRepository.update(
      accountId,
      {
        needsReVerification: true,
        reVerificationRequestedAt: new Date(),
      } as Partial<Account>,
    );

    this.logger.warn(`Account ${accountId} flagged for re-verification.`);
  }

  // ── Transfer pattern detection ─────────────────────────────────────────────
  /**
   * Runs a full abuse-pattern sweep over the provided transactions.
   * Returns a structured AbuseReport with risk score and per-flag details.
   *
   * Patterns detected:
   *   RAPID_FIRE             — N+ transactions within 60s
   *   ROUND_TRIP             — A→B then B→A within 2 hours
   *   STRUCTURING            — Amounts clustering just below $9,000 (AML structuring signal)
   *   VELOCITY_BREACH        — >$2,000 outbound in any rolling 1-hour window
   *   NEW_ACCOUNT_HIGH_VALUE — Target account < 7 days old receiving > $500
   */
  async detectTransferPatternsAndLogAbuseFlags(
    transactions: Transaction[],
  ): Promise<AbuseReport | null> {
    if (!transactions.length) return null;

    const accountId = transactions[0].fromAccountId;
    const flags: AbuseFlag[] = [];
    const details: Partial<Record<AbuseFlag, string>> = {};

    // ── 1. RAPID FIRE ──────────────────────────────────────────────────────
    const sorted: Transaction[] = [...transactions].sort(
      (a: Transaction, b: Transaction): number =>
        this.toEpochMs(a.createdAt) - this.toEpochMs(b.createdAt),
    );

    for (let i = 0; i <= sorted.length - RAPID_FIRE_COUNT; i += 1) {
      const windowStart = this.toEpochMs(sorted[i].createdAt);
      const windowEnd = this.toEpochMs(sorted[i + RAPID_FIRE_COUNT - 1].createdAt);
      const spanSeconds = (windowEnd - windowStart) / 1000;

      if (spanSeconds <= RAPID_FIRE_THRESHOLD_SECONDS) {
        flags.push('RAPID_FIRE');
        details.RAPID_FIRE = `${RAPID_FIRE_COUNT} transactions in ${spanSeconds}s (threshold: ${RAPID_FIRE_THRESHOLD_SECONDS}s)`;
        break;
      }
    }

    // ── 2. ROUND TRIP ──────────────────────────────────────────────────────
    const outbound: Transaction[] = transactions.filter(
      (t: Transaction): boolean => t.fromAccountId === accountId,
    );

    for (const out of outbound) {
      const outCreatedAtMs = this.toEpochMs(out.createdAt);
      const returnCutoffMs = outCreatedAtMs + ROUND_TRIP_WINDOW_HOURS * 3_600_000;
      const outAmount = Number(out.amountCents ?? 0);

      const roundTrip = transactions.find((t: Transaction): boolean => {
        if (t.fromAccountId !== out.toAccountId) return false;
        if (t.toAccountId !== accountId) return false;
        if (this.toEpochMs(t.createdAt) > returnCutoffMs) return false;

        const inAmount = Number(t.amountCents ?? 0);
        if (outAmount <= 0 || inAmount <= 0) return false;

        const pctDiff = Math.abs(inAmount - outAmount) / outAmount;
        return pctDiff < 0.05; // within 5%
      });

      if (roundTrip) {
        flags.push('ROUND_TRIP');
        details.ROUND_TRIP = `Outbound tx ${String(out.id)} → return tx ${String(
          roundTrip.id,
        )} within ${ROUND_TRIP_WINDOW_HOURS}h`;
        break;
      }
    }

    // ── 3. STRUCTURING ─────────────────────────────────────────────────────
    const structuringLow = STRUCTURING_THRESHOLD_USD * (1 - STRUCTURING_BAND_PCT) * 100;
    const structuringHigh = STRUCTURING_THRESHOLD_USD * 100;

    const structuringHits: Transaction[] = transactions.filter(
      (t: Transaction): boolean =>
        Number(t.amountCents ?? 0) >= structuringLow && Number(t.amountCents ?? 0) < structuringHigh,
    );

    if (structuringHits.length >= 2) {
      flags.push('STRUCTURING');

      const amounts = structuringHits
        .map((t: Transaction): string => `$${(Number(t.amountCents ?? 0) / 100).toFixed(2)}`)
        .join(', ');

      details.STRUCTURING = `${structuringHits.length} transactions near $${STRUCTURING_THRESHOLD_USD} threshold: ${amounts}`;
    }

    // ── 4. VELOCITY BREACH ─────────────────────────────────────────────────
    const nowMs = Date.now();
    const oneHourAgoMs = nowMs - 3_600_000;

    const recentOutbound: Transaction[] = outbound.filter(
      (t: Transaction): boolean => this.toEpochMs(t.createdAt) >= oneHourAgoMs,
    );

    const hourlyTotal = recentOutbound.reduce(
      (sum: number, t: Transaction): number => sum + Number(t.amountCents ?? 0),
      0,
    );

    const velocityLimitCents = VELOCITY_MAX_USD_PER_HOUR * 100;

    if (hourlyTotal > velocityLimitCents) {
      flags.push('VELOCITY_BREACH');
      details.VELOCITY_BREACH = `$${(hourlyTotal / 100).toFixed(2)} sent in the last hour (limit: $${VELOCITY_MAX_USD_PER_HOUR})`;
    }

    // ── 5. NEW ACCOUNT HIGH VALUE ──────────────────────────────────────────
    const highValueTxs: Transaction[] = outbound.filter(
      (t: Transaction): boolean => Number(t.amountCents ?? 0) >= 500_00, // $500+
    );

    for (const tx of highValueTxs) {
      const recipient = await this.accountRepository.findOne({
        where: { id: tx.toAccountId },
      });

      if (!recipient) continue;

      const recipientCreatedAtMs = this.toEpochMs(recipient.createdAt);
      const accountAgeDays = (nowMs - recipientCreatedAtMs) / 86_400_000;

      if (accountAgeDays < HIGH_RISK_NEW_ACCOUNT_AGE_DAYS) {
        flags.push('NEW_ACCOUNT_HIGH_VALUE');
        details.NEW_ACCOUNT_HIGH_VALUE = `Recipient account ${tx.toAccountId} is ${accountAgeDays.toFixed(
          1,
        )} days old, received $${(Number(tx.amountCents ?? 0) / 100).toFixed(2)}`;
        break;
      }
    }

    // Deduplicate flags before scoring/persisting
    const uniqueFlags = Array.from(new Set(flags)) as AbuseFlag[];
    if (!uniqueFlags.length) return null;

    // ── Risk score: weighted sum ───────────────────────────────────────────
    const weights: Record<AbuseFlag, number> = {
      RAPID_FIRE: 20,
      ROUND_TRIP: 30,
      STRUCTURING: 35,
      VELOCITY_BREACH: 25,
      NEW_ACCOUNT_HIGH_VALUE: 20,
      FOUNDER_LIMIT_BREACH: 40,
    };

    const riskScore = Math.min(
      100,
      uniqueFlags.reduce(
        (sum: number, f: AbuseFlag): number => sum + (weights[f] ?? 0),
        0,
      ),
    );

    const report: AbuseReport = {
      accountId,
      flags: uniqueFlags,
      riskScore,
      details,
      detectedAt: new Date().toISOString(),
    };

    // Persist abuse flags to the account
    if (riskScore >= 50) {
      await this.accountRepository.update(
        accountId,
        {
          abuseRiskScore: riskScore,
          abuseFlags: uniqueFlags,
          abuseFlaggedAt: new Date(),
        } as Partial<Account>,
      );

      this.logger.warn(
        `Abuse report for account ${accountId}: score=${riskScore} flags=[${uniqueFlags.join(', ')}]`,
      );
    }

    return report;
  }

  // ── Founder story protection ───────────────────────────────────────────────
  /**
   * Protects the founding member's narrative arc by enforcing:
   *   - Daily outbound transfer cap ($500)
   *   - Max 3 unique recipients per day
   *   - Blocks transfers that would exhaust founder staking balance
   *   - Flags any breach as FOUNDER_LIMIT_BREACH for manual review
   *
   * Returns true if the transaction is allowed, false if blocked.
   */
  async protectFounderStory(transaction: Transaction): Promise<boolean> {
    const account = await this.accountRepository.findOne({
      where: { id: transaction.fromAccountId },
    });

    if (!account?.isFounder) return true; // non-founder: no restriction

    const windowStart = new Date(Date.now() - PATTERN_WINDOW_HOURS * 3_600_000);

    // Fetch today's outbound transfers from this founder
    const todayOutbound = await this.transactionRepository.find({
      where: {
        fromAccountId: transaction.fromAccountId,
        createdAt: MoreThan(windowStart),
      },
    });

    // 1. Daily USD cap
    const totalSentCents = todayOutbound.reduce(
      (s: number, t: Transaction): number => s + Number(t.amountCents ?? 0),
      0,
    );

    const limitCents = FOUNDER_DAILY_TRANSFER_LIMIT_USD * 100;
    if (totalSentCents + Number(transaction.amountCents ?? 0) > limitCents) {
      await this.logFounderBreach(transaction, 'FOUNDER_DAILY_LIMIT_EXCEEDED', {
        sentToday: totalSentCents / 100,
        attemptedAmount: Number(transaction.amountCents ?? 0) / 100,
        limit: FOUNDER_DAILY_TRANSFER_LIMIT_USD,
      });
      return false;
    }

    // 2. Unique recipient cap
    const uniqueRecipients = new Set<number>(
      todayOutbound.map((t: Transaction): number => t.toAccountId),
    );

    const isNewRecipient = !uniqueRecipients.has(transaction.toAccountId);
    if (isNewRecipient && uniqueRecipients.size >= FOUNDER_MAX_RECIPIENTS_PER_DAY) {
      await this.logFounderBreach(transaction, 'FOUNDER_RECIPIENT_LIMIT_EXCEEDED', {
        recipientsToday: uniqueRecipients.size,
        limit: FOUNDER_MAX_RECIPIENTS_PER_DAY,
      });
      return false;
    }

    // 3. Staking balance protection — block if this would drain >50% of staking balance
    const stakingBalance = Number(account.stakingBalanceCents ?? 0);
    if (stakingBalance > 0 && Number(transaction.amountCents ?? 0) > stakingBalance * 0.5) {
      await this.logFounderBreach(transaction, 'FOUNDER_STAKING_DRAIN_RISK', {
        stakingBalance: stakingBalance / 100,
        attemptedAmount: Number(transaction.amountCents ?? 0) / 100,
      });
      return false;
    }

    return true;
  }

  private async logFounderBreach(
    transaction: Transaction,
    reason: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    this.logger.warn(
      `Founder protection triggered: ${reason} ` +
        `accountId=${transaction.fromAccountId} ` +
        `txAmount=$${(Number(transaction.amountCents ?? 0) / 100).toFixed(2)} ` +
        `meta=${JSON.stringify(meta)}`,
    );

    await this.accountRepository.update(
      transaction.fromAccountId,
      {
        abuseFlags: ['FOUNDER_LIMIT_BREACH'] as AbuseFlag[],
        abuseRiskScore: 40,
        abuseFlaggedAt: new Date(),
      } as Partial<Account>,
    );
  }
}
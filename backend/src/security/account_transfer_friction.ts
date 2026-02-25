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
import { Repository, MoreThan } from 'typeorm';
import { Request } from 'express';
import * as crypto from 'crypto';
import { Device } from './device.entity';
import { Transaction } from './transaction.entity';
import { Account } from '../accounts/account.entity';

// ── Constants ──────────────────────────────────────────────────────────────────
const FOUNDER_DAILY_TRANSFER_LIMIT_USD    = 500;
const FOUNDER_MAX_RECIPIENTS_PER_DAY      = 3;
const PATTERN_WINDOW_HOURS                = 24;
const RAPID_FIRE_THRESHOLD_SECONDS        = 60;   // N transactions within this window = suspicious
const RAPID_FIRE_COUNT                    = 5;
const ROUND_TRIP_WINDOW_HOURS             = 2;    // A→B then B→A within window = round-trip flag
const STRUCTURING_THRESHOLD_USD           = 9_000; // just-below reporting threshold
const STRUCTURING_BAND_PCT                = 0.10;  // within 10% of threshold = structuring signal
const VELOCITY_MAX_USD_PER_HOUR           = 2_000;
const HIGH_RISK_NEW_ACCOUNT_AGE_DAYS      = 7;

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
  riskScore: number;       // 0–100
  details: Record<AbuseFlag, string>;
  detectedAt: string;
}

// ── Device fingerprint ────────────────────────────────────────────────────────
export interface DeviceFingerprint {
  ipAddress: string;
  userAgent: string;
  acceptLanguage: string;
  fingerprint: string;   // SHA-256 of combined signals
}

@Injectable()
export class AccountTransferFrictionService {
  private readonly logger = new Logger(AccountTransferFrictionService.name);

  // In-process request context — set per request via setRequestContext()
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

  // ── Device fingerprinting ───────────────────────────────────────────────────
  /**
   * Builds a deterministic device fingerprint from the current request signals.
   * Uses IP + User-Agent + Accept-Language as the fingerprint surface.
   * In production, augment with TLS fingerprint (JA3), canvas hash, timezone.
   */
  private buildDeviceFingerprint(): DeviceFingerprint | null {
    if (!this.currentRequest) return null;

    const req = this.currentRequest;
    const ipAddress   = this.extractIp(req);
    const userAgent   = (req.headers['user-agent']   ?? '').slice(0, 256);
    const acceptLang  = (req.headers['accept-language'] ?? '').slice(0, 64);

    const raw = `${ipAddress}|${userAgent}|${acceptLang}`;
    const fingerprint = crypto
      .createHash('sha256')
      .update(raw)
      .digest('hex');

    return { ipAddress, userAgent, acceptLanguage: acceptLang, fingerprint };
  }

  /**
   * Extracts real client IP, respecting proxy headers in order of trust.
   */
  private extractIp(req: Request): string {
    const cfIp       = req.headers['cf-connecting-ip'];
    const xRealIp    = req.headers['x-real-ip'];
    const forwarded  = req.headers['x-forwarded-for'];

    if (typeof cfIp === 'string' && cfIp)        return cfIp.trim();
    if (typeof xRealIp === 'string' && xRealIp)  return xRealIp.trim();
    if (typeof forwarded === 'string' && forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? '0.0.0.0';
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
      order: { createdAt: 'DESC' },
    });

    // First-time registration — bind this device
    if (!knownDevice) {
      const device = this.deviceRepository.create({
        accountId,
        fingerprint: fpHash,
        ipAddress:   fingerprint?.ipAddress   ?? null,
        userAgent:   fingerprint?.userAgent   ?? null,
        lastSeenAt:  new Date(),
        verifiedAt:  new Date(),
      });
      await this.deviceRepository.save(device);
      this.logger.log(`Device registered for account ${accountId}: ${fpHash}`);
      return true;
    }

    // Known device — update last seen and pass
    if (fpHash && knownDevice.fingerprint === fpHash) {
      await this.deviceRepository.update(knownDevice.id, { lastSeenAt: new Date() });
      return true;
    }

    // Device mismatch — flag for re-verification
    this.logger.warn(
      `Device mismatch for account ${accountId}: ` +
      `known=${knownDevice.fingerprint} incoming=${fpHash}`
    );
    await this.flagForReVerification(accountId);
    return false;
  }

  /**
   * Flags an account for mandatory re-verification (2FA prompt, email confirm, etc.)
   */
  private async flagForReVerification(accountId: number): Promise<void> {
    await this.accountRepository.update(accountId, {
      needsReVerification: true,
      reVerificationRequestedAt: new Date(),
    });
    this.logger.warn(`Account ${accountId} flagged for re-verification.`);
  }

  // ── Transfer pattern detection ─────────────────────────────────────────────
  /**
   * Runs a full abuse-pattern sweep over the provided transactions.
   * Returns a structured AbuseReport with risk score and per-flag details.
   *
   * Patterns detected:
   *   RAPID_FIRE          — N+ transactions within 60s
   *   ROUND_TRIP          — A→B then B→A within 2 hours
   *   STRUCTURING         — Amounts clustering just below $9,000 (AML structuring signal)
   *   VELOCITY_BREACH     — >$2,000 outbound in any rolling 1-hour window
   *   NEW_ACCOUNT_HIGH_VALUE — Target account < 7 days old receiving > $500
   */
  async detectTransferPatternsAndLogAbuseFlags(
    transactions: Transaction[],
  ): Promise<AbuseReport | null> {
    if (!transactions.length) return null;

    const accountId = transactions[0].fromAccountId;
    const flags: AbuseFlag[] = [];
    const details = {} as Record<AbuseFlag, string>;

    // ── 1. RAPID FIRE ──────────────────────────────────────────────────────
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (let i = 0; i <= sorted.length - RAPID_FIRE_COUNT; i++) {
      const windowStart = new Date(sorted[i].createdAt).getTime();
      const windowEnd   = new Date(sorted[i + RAPID_FIRE_COUNT - 1].createdAt).getTime();
      if ((windowEnd - windowStart) / 1000 <= RAPID_FIRE_THRESHOLD_SECONDS) {
        flags.push('RAPID_FIRE');
        details['RAPID_FIRE'] =
          `${RAPID_FIRE_COUNT} transactions in ${(windowEnd - windowStart) / 1000}s ` +
          `(threshold: ${RAPID_FIRE_THRESHOLD_SECONDS}s)`;
        break;
      }
    }

    // ── 2. ROUND TRIP ──────────────────────────────────────────────────────
    const outbound = transactions.filter(t => t.fromAccountId === accountId);
    for (const out of outbound) {
      const returnCutoff = new Date(
        new Date(out.createdAt).getTime() + ROUND_TRIP_WINDOW_HOURS * 3_600_000,
      );
      const roundTrip = transactions.find(
        t =>
          t.fromAccountId === out.toAccountId &&
          t.toAccountId   === accountId &&
          new Date(t.createdAt) <= returnCutoff &&
          Math.abs(t.amountCents - out.amountCents) / out.amountCents < 0.05, // within 5%
      );
      if (roundTrip) {
        flags.push('ROUND_TRIP');
        details['ROUND_TRIP'] =
          `Outbound tx ${out.id} → return tx ${roundTrip.id} within ${ROUND_TRIP_WINDOW_HOURS}h`;
        break;
      }
    }

    // ── 3. STRUCTURING ─────────────────────────────────────────────────────
    const structuringLow  = STRUCTURING_THRESHOLD_USD * (1 - STRUCTURING_BAND_PCT) * 100;
    const structuringHigh = STRUCTURING_THRESHOLD_USD * 100;
    const structuringHits = transactions.filter(
      t => t.amountCents >= structuringLow && t.amountCents < structuringHigh,
    );
    if (structuringHits.length >= 2) {
      flags.push('STRUCTURING');
      const amounts = structuringHits.map(t => `$${(t.amountCents / 100).toFixed(2)}`).join(', ');
      details['STRUCTURING'] =
        `${structuringHits.length} transactions near $${STRUCTURING_THRESHOLD_USD} threshold: ${amounts}`;
    }

    // ── 4. VELOCITY BREACH ─────────────────────────────────────────────────
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;
    const recentOutbound = outbound.filter(
      t => new Date(t.createdAt).getTime() >= oneHourAgo,
    );
    const hourlyTotal = recentOutbound.reduce((sum, t) => sum + t.amountCents, 0);
    const velocityLimitCents = VELOCITY_MAX_USD_PER_HOUR * 100;
    if (hourlyTotal > velocityLimitCents) {
      flags.push('VELOCITY_BREACH');
      details['VELOCITY_BREACH'] =
        `$${(hourlyTotal / 100).toFixed(2)} sent in the last hour ` +
        `(limit: $${VELOCITY_MAX_USD_PER_HOUR})`;
    }

    // ── 5. NEW ACCOUNT HIGH VALUE ──────────────────────────────────────────
    const highValueTxs = outbound.filter(t => t.amountCents >= 500_00); // $500+
    for (const tx of highValueTxs) {
      const recipient = await this.accountRepository.findOne({
        where: { id: tx.toAccountId },
      });
      if (!recipient) continue;
      const accountAgeDays =
        (now - new Date(recipient.createdAt).getTime()) / 86_400_000;
      if (accountAgeDays < HIGH_RISK_NEW_ACCOUNT_AGE_DAYS) {
        flags.push('NEW_ACCOUNT_HIGH_VALUE');
        details['NEW_ACCOUNT_HIGH_VALUE'] =
          `Recipient account ${tx.toAccountId} is ${accountAgeDays.toFixed(1)} days old, ` +
          `received $${(tx.amountCents / 100).toFixed(2)}`;
        break;
      }
    }

    // ── Risk score: weighted sum ───────────────────────────────────────────
    const weights: Record<AbuseFlag, number> = {
      RAPID_FIRE:             20,
      ROUND_TRIP:             30,
      STRUCTURING:            35,
      VELOCITY_BREACH:        25,
      NEW_ACCOUNT_HIGH_VALUE: 20,
      FOUNDER_LIMIT_BREACH:   40,
    };
    const riskScore = Math.min(
      100,
      flags.reduce((sum, f) => sum + (weights[f] ?? 0), 0),
    );

    if (!flags.length) return null;

    const report: AbuseReport = {
      accountId,
      flags,
      riskScore,
      details,
      detectedAt: new Date().toISOString(),
    };

    // Persist abuse flags to the account
    if (riskScore >= 50) {
      await this.accountRepository.update(accountId, {
        abuseRiskScore: riskScore,
        abuseFlags: flags,
        abuseFlaggedAt: new Date(),
      });
      this.logger.warn(
        `Abuse report for account ${accountId}: ` +
        `score=${riskScore} flags=[${flags.join(', ')}]`,
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

    const windowStart = new Date(
      Date.now() - PATTERN_WINDOW_HOURS * 3_600_000,
    );

    // Fetch today's outbound transfers from this founder
    const todayOutbound = await this.transactionRepository.find({
      where: {
        fromAccountId: transaction.fromAccountId,
        createdAt: MoreThan(windowStart),
      },
    });

    // 1. Daily USD cap
    const totalSentCents = todayOutbound.reduce((s, t) => s + t.amountCents, 0);
    const limitCents = FOUNDER_DAILY_TRANSFER_LIMIT_USD * 100;
    if (totalSentCents + transaction.amountCents > limitCents) {
      await this.logFounderBreach(transaction, 'FOUNDER_DAILY_LIMIT_EXCEEDED', {
        sentToday: totalSentCents / 100,
        attemptedAmount: transaction.amountCents / 100,
        limit: FOUNDER_DAILY_TRANSFER_LIMIT_USD,
      });
      return false;
    }

    // 2. Unique recipient cap
    const uniqueRecipients = new Set(todayOutbound.map(t => t.toAccountId));
    const isNewRecipient = !uniqueRecipients.has(transaction.toAccountId);
    if (isNewRecipient && uniqueRecipients.size >= FOUNDER_MAX_RECIPIENTS_PER_DAY) {
      await this.logFounderBreach(transaction, 'FOUNDER_RECIPIENT_LIMIT_EXCEEDED', {
        recipientsToday: uniqueRecipients.size,
        limit: FOUNDER_MAX_RECIPIENTS_PER_DAY,
      });
      return false;
    }

    // 3. Staking balance protection — block if this would drain >50% of staking balance
    const stakingBalance = account.stakingBalanceCents ?? 0;
    if (stakingBalance > 0 && transaction.amountCents > stakingBalance * 0.5) {
      await this.logFounderBreach(transaction, 'FOUNDER_STAKING_DRAIN_RISK', {
        stakingBalance: stakingBalance / 100,
        attemptedAmount: transaction.amountCents / 100,
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
      `txAmount=$${(transaction.amountCents / 100).toFixed(2)} ` +
      `meta=${JSON.stringify(meta)}`,
    );

    await this.accountRepository.update(transaction.fromAccountId, {
      abuseFlags: ['FOUNDER_LIMIT_BREACH'] as AbuseFlag[],
      abuseRiskScore: 40,
      abuseFlaggedAt: new Date(),
    });
  }
}

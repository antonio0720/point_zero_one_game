//backend/src/security/account_transfer_friction.ts

/**
 * Account Transfer Friction Module
 * backend/src/security/account_transfer_friction.ts
 *
 * Production-ready account transfer protection:
 * - Device fingerprint binding
 * - Re-verification flagging
 * - Transfer pattern abuse detection
 * - Founder transfer-story protection
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import type { Request } from 'express';
import * as crypto from 'crypto';

import { Device } from './device.entity';
import { Transaction } from './transaction.entity';
import { Account } from '../accounts/account.entity';
import type {
  AbuseFlag,
  AbuseReport,
  AbuseReportDetails,
  DeviceFingerprint,
  FounderBreachReason,
} from './account_transfer_friction.types';

// ── Constants ────────────────────────────────────────────────────────────────

const FOUNDER_DAILY_TRANSFER_LIMIT_USD = 500;
const FOUNDER_MAX_RECIPIENTS_PER_DAY = 3;

const PATTERN_WINDOW_HOURS = 24;

const RAPID_FIRE_THRESHOLD_SECONDS = 60;
const RAPID_FIRE_COUNT = 5;

const ROUND_TRIP_WINDOW_HOURS = 2;

const STRUCTURING_THRESHOLD_USD = 9_000;
const STRUCTURING_BAND_PCT = 0.10;

const VELOCITY_MAX_USD_PER_HOUR = 2_000;
const HIGH_RISK_NEW_ACCOUNT_AGE_DAYS = 7;
const HIGH_VALUE_TRANSFER_CENTS = 500_00;

const ABUSE_FLAG_WEIGHTS: Readonly<Record<AbuseFlag, number>> = {
  RAPID_FIRE: 20,
  ROUND_TRIP: 30,
  STRUCTURING: 35,
  VELOCITY_BREACH: 25,
  NEW_ACCOUNT_HIGH_VALUE: 20,
  FOUNDER_LIMIT_BREACH: 40,
};

@Injectable()
export class AccountTransferFrictionService {
  private readonly logger = new Logger(AccountTransferFrictionService.name);

  /**
   * Request-bound context for device fingerprinting.
   * If you later switch this service to request scope, you can remove this field.
   */
  private currentRequest: Request | null = null;

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  // ── Request context ───────────────────────────────────────────────────────

  setRequestContext(req: Request): void {
    this.currentRequest = req;
  }

  clearRequestContext(): void {
    this.currentRequest = null;
  }

  // ── Device fingerprinting ────────────────────────────────────────────────

  private buildDeviceFingerprint(): DeviceFingerprint | null {
    if (!this.currentRequest) {
      return null;
    }

    const req = this.currentRequest;
    const ipAddress = this.extractIp(req);
    const userAgent = this.getHeaderValue(req, 'user-agent', 256);
    const acceptLanguage = this.getHeaderValue(req, 'accept-language', 64);

    const raw = `${ipAddress}|${userAgent}|${acceptLanguage}`;
    const fingerprint = crypto
      .createHash('sha256')
      .update(raw)
      .digest('hex');

    return {
      ipAddress,
      userAgent,
      acceptLanguage,
      fingerprint,
    };
  }

  private extractIp(req: Request): string {
    const cfIp = req.headers['cf-connecting-ip'];
    const xRealIp = req.headers['x-real-ip'];
    const forwarded = req.headers['x-forwarded-for'];

    if (typeof cfIp === 'string' && cfIp.trim()) {
      return cfIp.trim();
    }

    if (typeof xRealIp === 'string' && xRealIp.trim()) {
      return xRealIp.trim();
    }

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

  private getHeaderValue(
    req: Request,
    headerName: string,
    maxLen: number,
  ): string {
    const header = req.headers[headerName];

    if (typeof header === 'string') {
      return header.slice(0, maxLen);
    }

    if (Array.isArray(header)) {
      return (header[0] ?? '').slice(0, maxLen);
    }

    return '';
  }

  private toEpochMs(value: Date | string | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return new Date(value).getTime();
  }

  private normalizeAmountCents(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private async persistAbuseSignals(
    accountId: number,
    incomingFlags: AbuseFlag[],
    incomingRiskScore: number,
  ): Promise<void> {
    if (!incomingFlags.length) {
      return;
    }

    const account = await this.accountRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      this.logger.warn(
        `persistAbuseSignals: account ${accountId} not found; skipping persistence`,
      );
      return;
    }

    const mergedFlags = Array.from(
      new Set([...(account.abuseFlags ?? []), ...incomingFlags]),
    ) as AbuseFlag[];

    const mergedRiskScore = Math.max(
      Number(account.abuseRiskScore ?? 0),
      incomingRiskScore,
    );

    await this.accountRepository.update(accountId, {
      abuseFlags: mergedFlags,
      abuseRiskScore: mergedRiskScore,
      abuseFlaggedAt: new Date(),
    });
  }

  // ── Device verification ──────────────────────────────────────────────────

  async verifyDeviceChange(accountId: number): Promise<boolean> {
    const fingerprint = this.buildDeviceFingerprint();
    const fpHash = fingerprint?.fingerprint ?? null;

    const knownDevice = await this.deviceRepository.findOne({
      where: { accountId },
      order: { createdAt: 'DESC' },
    });

    if (!knownDevice) {
      const device = this.deviceRepository.create({
        accountId,
        fingerprint: fpHash,
        ipAddress: fingerprint?.ipAddress ?? null,
        userAgent: fingerprint?.userAgent ?? null,
        lastSeenAt: new Date(),
        verifiedAt: fpHash ? new Date() : null,
      });

      await this.deviceRepository.save(device);

      this.logger.log(
        `Device registered for account ${accountId}: ${fpHash ?? 'null-fingerprint'}`,
      );

      return true;
    }

    if (!fpHash) {
      this.logger.warn(
        `No request fingerprint available for account ${accountId}; device-change verification bypassed`,
      );
      return true;
    }

    if (knownDevice.fingerprint === fpHash) {
      await this.deviceRepository.update(knownDevice.id, {
        lastSeenAt: new Date(),
        ipAddress: fingerprint?.ipAddress ?? knownDevice.ipAddress,
        userAgent: fingerprint?.userAgent ?? knownDevice.userAgent,
      });

      return true;
    }

    this.logger.warn(
      `Device mismatch for account ${accountId}: known=${String(
        knownDevice.fingerprint,
      )} incoming=${String(fpHash)}`,
    );

    await this.flagForReVerification(accountId);
    return false;
  }

  private async flagForReVerification(accountId: number): Promise<void> {
    await this.accountRepository.update(accountId, {
      needsReVerification: true,
      reVerificationRequestedAt: new Date(),
    });

    this.logger.warn(`Account ${accountId} flagged for re-verification.`);
  }

  // ── Abuse detection ──────────────────────────────────────────────────────

  async detectTransferPatternsAndLogAbuseFlags(
    transactions: Transaction[],
  ): Promise<AbuseReport | null> {
    if (!transactions.length) {
      return null;
    }

    const accountId = transactions[0].fromAccountId;
    const flags: AbuseFlag[] = [];
    const details: AbuseReportDetails = {};

    // 1. RAPID_FIRE
    const sorted = [...transactions].sort(
      (a, b) => this.toEpochMs(a.createdAt) - this.toEpochMs(b.createdAt),
    );

    for (let i = 0; i <= sorted.length - RAPID_FIRE_COUNT; i += 1) {
      const windowStart = this.toEpochMs(sorted[i].createdAt);
      const windowEnd = this.toEpochMs(
        sorted[i + RAPID_FIRE_COUNT - 1].createdAt,
      );
      const spanSeconds = (windowEnd - windowStart) / 1000;

      if (spanSeconds <= RAPID_FIRE_THRESHOLD_SECONDS) {
        flags.push('RAPID_FIRE');
        details.RAPID_FIRE = `${RAPID_FIRE_COUNT} transactions in ${spanSeconds}s (threshold: ${RAPID_FIRE_THRESHOLD_SECONDS}s)`;
        break;
      }
    }

    // 2. ROUND_TRIP
    const outbound = transactions.filter(
      (t) => t.fromAccountId === accountId,
    );

    for (const out of outbound) {
      const outCreatedAtMs = this.toEpochMs(out.createdAt);
      const returnCutoffMs =
        outCreatedAtMs + ROUND_TRIP_WINDOW_HOURS * 3_600_000;
      const outAmount = this.normalizeAmountCents(out.amountCents);

      const roundTrip = transactions.find((t) => {
        if (t.fromAccountId !== out.toAccountId) return false;
        if (t.toAccountId !== accountId) return false;
        if (this.toEpochMs(t.createdAt) > returnCutoffMs) return false;

        const inAmount = this.normalizeAmountCents(t.amountCents);

        if (outAmount <= 0 || inAmount <= 0) return false;

        const pctDiff = Math.abs(inAmount - outAmount) / outAmount;
        return pctDiff < 0.05;
      });

      if (roundTrip) {
        flags.push('ROUND_TRIP');
        details.ROUND_TRIP = `Outbound tx ${String(
          out.id,
        )} → return tx ${String(roundTrip.id)} within ${ROUND_TRIP_WINDOW_HOURS}h`;
        break;
      }
    }

    // 3. STRUCTURING
    const structuringLow =
      STRUCTURING_THRESHOLD_USD * (1 - STRUCTURING_BAND_PCT) * 100;
    const structuringHigh = STRUCTURING_THRESHOLD_USD * 100;

    const structuringHits = transactions.filter((t) => {
      const amount = this.normalizeAmountCents(t.amountCents);
      return amount >= structuringLow && amount < structuringHigh;
    });

    if (structuringHits.length >= 2) {
      flags.push('STRUCTURING');
      details.STRUCTURING = `${structuringHits.length} transactions near $${STRUCTURING_THRESHOLD_USD} threshold: ${structuringHits
        .map((t) => `$${(this.normalizeAmountCents(t.amountCents) / 100).toFixed(2)}`)
        .join(', ')}`;
    }

    // 4. VELOCITY_BREACH
    const nowMs = Date.now();
    const oneHourAgoMs = nowMs - 3_600_000;

    const recentOutbound = outbound.filter(
      (t) => this.toEpochMs(t.createdAt) >= oneHourAgoMs,
    );

    const hourlyTotal = recentOutbound.reduce(
      (sum, t) => sum + this.normalizeAmountCents(t.amountCents),
      0,
    );

    const velocityLimitCents = VELOCITY_MAX_USD_PER_HOUR * 100;

    if (hourlyTotal > velocityLimitCents) {
      flags.push('VELOCITY_BREACH');
      details.VELOCITY_BREACH = `$${(hourlyTotal / 100).toFixed(
        2,
      )} sent in the last hour (limit: $${VELOCITY_MAX_USD_PER_HOUR})`;
    }

    // 5. NEW_ACCOUNT_HIGH_VALUE
    const highValueTxs = outbound.filter(
      (t) => this.normalizeAmountCents(t.amountCents) >= HIGH_VALUE_TRANSFER_CENTS,
    );

    for (const tx of highValueTxs) {
      const recipient = await this.accountRepository.findOne({
        where: { id: tx.toAccountId },
      });

      if (!recipient) {
        continue;
      }

      const recipientCreatedAtMs = this.toEpochMs(recipient.createdAt);
      const accountAgeDays = (nowMs - recipientCreatedAtMs) / 86_400_000;

      if (accountAgeDays < HIGH_RISK_NEW_ACCOUNT_AGE_DAYS) {
        flags.push('NEW_ACCOUNT_HIGH_VALUE');
        details.NEW_ACCOUNT_HIGH_VALUE = `Recipient account ${tx.toAccountId} is ${accountAgeDays.toFixed(
          1,
        )} days old, received $${(
          this.normalizeAmountCents(tx.amountCents) / 100
        ).toFixed(2)}`;
        break;
      }
    }

    const uniqueFlags = Array.from(new Set(flags)) as AbuseFlag[];

    if (!uniqueFlags.length) {
      return null;
    }

    const riskScore = Math.min(
      100,
      uniqueFlags.reduce(
        (sum, flag) => sum + (ABUSE_FLAG_WEIGHTS[flag] ?? 0),
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

    if (riskScore >= 50) {
      await this.persistAbuseSignals(accountId, uniqueFlags, riskScore);

      this.logger.warn(
        `Abuse report for account ${accountId}: score=${riskScore} flags=[${uniqueFlags.join(
          ', ',
        )}]`,
      );
    }

    return report;
  }

  // ── Founder protection ────────────────────────────────────────────────────

  async protectFounderStory(transaction: Transaction): Promise<boolean> {
    const account = await this.accountRepository.findOne({
      where: { id: transaction.fromAccountId },
    });

    if (!account?.isFounder) {
      return true;
    }

    const windowStart = new Date(Date.now() - PATTERN_WINDOW_HOURS * 3_600_000);

    const todayOutbound = await this.transactionRepository.find({
      where: {
        fromAccountId: transaction.fromAccountId,
        createdAt: MoreThan(windowStart),
      },
    });

    // 1. Daily cap
    const totalSentCents = todayOutbound.reduce(
      (sum, t) => sum + this.normalizeAmountCents(t.amountCents),
      0,
    );

    const attemptedAmountCents = this.normalizeAmountCents(
      transaction.amountCents,
    );

    const limitCents = FOUNDER_DAILY_TRANSFER_LIMIT_USD * 100;

    if (totalSentCents + attemptedAmountCents > limitCents) {
      await this.logFounderBreach(
        transaction,
        'FOUNDER_DAILY_LIMIT_EXCEEDED',
        {
          sentToday: totalSentCents / 100,
          attemptedAmount: attemptedAmountCents / 100,
          limit: FOUNDER_DAILY_TRANSFER_LIMIT_USD,
        },
      );
      return false;
    }

    // 2. Unique recipient cap
    const uniqueRecipients = new Set(
      todayOutbound.map((t) => t.toAccountId),
    );

    const isNewRecipient = !uniqueRecipients.has(transaction.toAccountId);

    if (
      isNewRecipient &&
      uniqueRecipients.size >= FOUNDER_MAX_RECIPIENTS_PER_DAY
    ) {
      await this.logFounderBreach(
        transaction,
        'FOUNDER_RECIPIENT_LIMIT_EXCEEDED',
        {
          recipientsToday: uniqueRecipients.size,
          limit: FOUNDER_MAX_RECIPIENTS_PER_DAY,
        },
      );
      return false;
    }

    // 3. Staking balance drain protection
    const stakingBalance = this.normalizeAmountCents(
      account.stakingBalanceCents,
    );

    if (stakingBalance > 0 && attemptedAmountCents > stakingBalance * 0.5) {
      await this.logFounderBreach(
        transaction,
        'FOUNDER_STAKING_DRAIN_RISK',
        {
          stakingBalance: stakingBalance / 100,
          attemptedAmount: attemptedAmountCents / 100,
        },
      );
      return false;
    }

    return true;
  }

  private async logFounderBreach(
    transaction: Transaction,
    reason: FounderBreachReason,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const amountCents = this.normalizeAmountCents(transaction.amountCents);

    this.logger.warn(
      `Founder protection triggered: ${reason} ` +
        `accountId=${transaction.fromAccountId} ` +
        `txAmount=$${(amountCents / 100).toFixed(2)} ` +
        `meta=${JSON.stringify(meta)}`,
    );

    await this.persistAbuseSignals(
      transaction.fromAccountId,
      ['FOUNDER_LIMIT_BREACH'],
      ABUSE_FLAG_WEIGHTS.FOUNDER_LIMIT_BREACH,
    );
  }
}
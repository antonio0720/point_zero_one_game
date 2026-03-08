/**
 * Account entity for Point Zero One.
 * backend/src/accounts/account.entity.ts
 *
 * Enhancements:
 * - Keeps the existing schema and column names intact
 * - Normalizes bigint handling for Postgres <-> TypeORM consistency
 * - Adds safe domain helpers for abuse tracking and re-verification
 * - Removes unrelated analytics declarations that do not belong in this entity
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

import type { AbuseFlag } from '../security/account_transfer_friction.types';

const bigintNumberTransformer = {
  to(value: number): string {
    if (!Number.isFinite(value)) {
      return '0';
    }

    return Math.max(0, Math.trunc(value)).toString();
  },

  from(value: string | number | null): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    }

    const parsed = Number.parseInt(String(value ?? '0'), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  },
};

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** True if this account is a platform founder — enforces special transfer limits */
  @Column({ type: 'boolean', name: 'is_founder', default: false })
  isFounder: boolean;

  /** Staking balance in cents */
  @Column({
    type: 'bigint',
    name: 'staking_balance_cents',
    default: 0,
    transformer: bigintNumberTransformer,
  })
  stakingBalanceCents: number;

  // ── Re-verification ───────────────────────────────────────────────────────

  @Column({ type: 'boolean', name: 'needs_re_verification', default: false })
  needsReVerification: boolean;

  @Column({
    type: 'timestamptz',
    name: 're_verification_requested_at',
    nullable: true,
  })
  reVerificationRequestedAt: Date | null;

  // ── Abuse tracking ────────────────────────────────────────────────────────

  @Column({ type: 'int', name: 'abuse_risk_score', default: 0 })
  abuseRiskScore: number;

  @Column({ type: 'jsonb', name: 'abuse_flags', default: [] })
  abuseFlags: AbuseFlag[];

  @Column({
    type: 'timestamptz',
    name: 'abuse_flagged_at',
    nullable: true,
  })
  abuseFlaggedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ── Normalization helpers ────────────────────────────────────────────────

  normalizeEmail(): string {
    return String(this.email ?? '').trim().toLowerCase();
  }

  normalizeStakingBalanceCents(): number {
    if (typeof this.stakingBalanceCents === 'number') {
      return Number.isFinite(this.stakingBalanceCents)
        ? Math.max(0, Math.trunc(this.stakingBalanceCents))
        : 0;
    }

    if (typeof this.stakingBalanceCents === 'string') {
      const parsed = Number(this.stakingBalanceCents);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
    }

    return 0;
  }

  stakingBalanceUsd(): number {
    return this.normalizeStakingBalanceCents() / 100;
  }

  normalizeAbuseRiskScore(): number {
    if (typeof this.abuseRiskScore !== 'number' || !Number.isFinite(this.abuseRiskScore)) {
      return 0;
    }

    return Math.max(0, Math.trunc(this.abuseRiskScore));
  }

  normalizeAbuseFlags(): AbuseFlag[] {
    if (!Array.isArray(this.abuseFlags)) {
      return [];
    }

    return [...new Set(this.abuseFlags.filter(Boolean))];
  }

  // ── Abuse state helpers ──────────────────────────────────────────────────

  hasAbuseFlag(flag: AbuseFlag): boolean {
    return this.normalizeAbuseFlags().includes(flag);
  }

  addAbuseFlag(flag: AbuseFlag): void {
    const flags = this.normalizeAbuseFlags();

    if (!flags.includes(flag)) {
      flags.push(flag);
    }

    this.abuseFlags = flags;
    this.abuseFlaggedAt = new Date();
  }

  addAbuseFlags(flags: AbuseFlag[]): void {
    const next = new Set(this.normalizeAbuseFlags());

    for (const flag of flags) {
      if (flag) {
        next.add(flag);
      }
    }

    this.abuseFlags = [...next];

    if (this.abuseFlags.length > 0) {
      this.abuseFlaggedAt = new Date();
    }
  }

  clearAbuseFlags(): void {
    this.abuseFlags = [];
    this.abuseFlaggedAt = null;
  }

  setAbuseRiskScore(score: number): void {
    if (!Number.isFinite(score)) {
      this.abuseRiskScore = 0;
      return;
    }

    this.abuseRiskScore = Math.max(0, Math.trunc(score));

    if (this.abuseRiskScore === 0 && this.normalizeAbuseFlags().length === 0) {
      this.abuseFlaggedAt = null;
    }
  }

  markAbuse(flag: AbuseFlag, score?: number): void {
    this.addAbuseFlag(flag);

    if (typeof score === 'number' && Number.isFinite(score)) {
      this.abuseRiskScore = Math.max(
        this.normalizeAbuseRiskScore(),
        Math.max(0, Math.trunc(score)),
      );
    }

    this.abuseFlaggedAt = new Date();
  }

  isHighRisk(threshold = 50): boolean {
    return this.normalizeAbuseRiskScore() >= Math.max(0, Math.trunc(threshold));
  }

  isFlagged(): boolean {
    return this.normalizeAbuseFlags().length > 0 || this.normalizeAbuseRiskScore() > 0;
  }

  // ── Re-verification helpers ──────────────────────────────────────────────

  requestReVerification(requestedAt: Date = new Date()): void {
    this.needsReVerification = true;
    this.reVerificationRequestedAt = requestedAt;
  }

  clearReVerification(): void {
    this.needsReVerification = false;
    this.reVerificationRequestedAt = null;
  }

  hasPendingReVerification(): boolean {
    return this.needsReVerification === true;
  }

  // ── Founder / balance helpers ────────────────────────────────────────────

  isFounderAccount(): boolean {
    return this.isFounder === true;
  }

  creditStakingBalance(amountCents: number): void {
    const normalizedAmount = Account.normalizeCurrencyCents(amountCents);
    this.stakingBalanceCents = this.normalizeStakingBalanceCents() + normalizedAmount;
  }

  debitStakingBalance(amountCents: number): void {
    const normalizedAmount = Account.normalizeCurrencyCents(amountCents);
    const nextBalance = this.normalizeStakingBalanceCents() - normalizedAmount;

    if (nextBalance < 0) {
      throw new Error('Insufficient staking balance.');
    }

    this.stakingBalanceCents = nextBalance;
  }

  hasSufficientStakingBalance(amountCents: number): boolean {
    return this.normalizeStakingBalanceCents() >= Account.normalizeCurrencyCents(amountCents);
  }

  // ── Static helpers ───────────────────────────────────────────────────────

  static normalizeCurrencyCents(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
    }

    return 0;
  }
}
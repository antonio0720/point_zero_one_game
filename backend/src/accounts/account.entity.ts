///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/accounts/account.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

import { AbuseFlag } from '../security/account_transfer_friction';

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
  @Column({ type: 'bigint', name: 'staking_balance_cents', default: 0 })
  stakingBalanceCents: number;

  // ── Re-verification ───────────────────────────────────────────────────────

  @Column({ type: 'boolean', name: 'needs_re_verification', default: false })
  needsReVerification: boolean;

  @Column({ type: 'timestamptz', name: 're_verification_requested_at', nullable: true })
  reVerificationRequestedAt: Date | null;

  // ── Abuse tracking ────────────────────────────────────────────────────────

  @Column({ type: 'int', name: 'abuse_risk_score', default: 0 })
  abuseRiskScore: number;

  @Column({ type: 'jsonb', name: 'abuse_flags', default: [] })
  abuseFlags: AbuseFlag[];

  @Column({ type: 'timestamptz', name: 'abuse_flagged_at', nullable: true })
  abuseFlaggedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
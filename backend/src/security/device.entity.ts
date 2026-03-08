/**
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/device.entity.ts
 *
 * Device registry for account transfer friction, explorer trust scoring,
 * and future risk-based authentication controls.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DeviceTrustTier {
  UNKNOWN = 'UNKNOWN',
  UNVERIFIED = 'UNVERIFIED',
  TRUSTED = 'TRUSTED',
  VERIFIED = 'VERIFIED',
  HARDENED = 'HARDENED',
}

const DEVICE_TRUST_ORDER: Record<DeviceTrustTier, number> = {
  [DeviceTrustTier.UNKNOWN]: 0,
  [DeviceTrustTier.UNVERIFIED]: 1,
  [DeviceTrustTier.TRUSTED]: 2,
  [DeviceTrustTier.VERIFIED]: 3,
  [DeviceTrustTier.HARDENED]: 4,
};

@Entity('devices')
@Index('idx_devices_account_id', ['accountId'])
@Index('idx_devices_fingerprint', ['fingerprint'])
@Index('idx_devices_account_fingerprint', ['accountId', 'fingerprint'])
@Index('idx_devices_last_seen_at', ['lastSeenAt'])
@Index('idx_devices_trust_tier', ['trustTier'])
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  /** SHA-256 of IP + User-Agent + Accept-Language */
  @Column({ type: 'varchar', length: 64, nullable: true })
  fingerprint: string | null;

  /** First trusted client IP captured for this device record */
  @Column({ type: 'varchar', length: 128, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  /** User-Agent truncated at ingest boundary */
  @Column({ type: 'varchar', length: 512, name: 'user_agent', nullable: true })
  userAgent: string | null;

  /** Accept-Language persisted because the friction service already uses it for fingerprinting */
  @Column({ type: 'varchar', length: 64, name: 'accept_language', nullable: true })
  acceptLanguage: string | null;

  /** Unified trust vocabulary used by explorer lookup hardening */
  @Column({
    type: 'enum',
    enum: DeviceTrustTier,
    name: 'trust_tier',
    default: DeviceTrustTier.UNVERIFIED,
  })
  trustTier: DeviceTrustTier;

  /** Aggregate device trust score from 0–100 */
  @Column({ type: 'int', name: 'trust_score', default: 0 })
  trustScore: number;

  /** Number of successful explicit verification events */
  @Column({ type: 'int', name: 'verification_count', default: 0 })
  verificationCount: number;

  /** Whether this device is currently active for trust decisions */
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', name: 'last_seen_at', nullable: true })
  lastSeenAt: Date | null;

  @Column({ type: 'timestamptz', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  touchSeen(
    input?: {
      ipAddress?: string | null;
      userAgent?: string | null;
      acceptLanguage?: string | null;
      fingerprint?: string | null;
      at?: Date;
    },
  ): void {
    this.lastSeenAt = input?.at ?? new Date();

    if (typeof input?.ipAddress === 'string') {
      this.ipAddress = input.ipAddress.slice(0, 128);
    }

    if (typeof input?.userAgent === 'string') {
      this.userAgent = input.userAgent.slice(0, 512);
    }

    if (typeof input?.acceptLanguage === 'string') {
      this.acceptLanguage = input.acceptLanguage.slice(0, 64);
    }

    if (typeof input?.fingerprint === 'string') {
      this.fingerprint = input.fingerprint.slice(0, 64);
    }

    this.isActive = true;

    if (!this.trustTier || this.trustTier === DeviceTrustTier.UNKNOWN) {
      this.trustTier = DeviceTrustTier.UNVERIFIED;
    }
  }

  markVerified(at: Date = new Date()): void {
    this.verifiedAt = at;
    this.lastSeenAt = at;
    this.isActive = true;
    this.revokedAt = null;
    this.verificationCount = Math.max(0, this.verificationCount ?? 0) + 1;

    if ((this.trustScore ?? 0) < 70) {
      this.trustScore = 70;
    }

    this.upgradeTrust(DeviceTrustTier.VERIFIED);
  }

  markHardened(at: Date = new Date()): void {
    this.verifiedAt = at;
    this.lastSeenAt = at;
    this.isActive = true;
    this.revokedAt = null;
    this.verificationCount = Math.max(0, this.verificationCount ?? 0) + 1;
    this.trustScore = Math.max(90, this.trustScore ?? 0);
    this.upgradeTrust(DeviceTrustTier.HARDENED);
  }

  markTrusted(at: Date = new Date(), trustScoreFloor = 50): void {
    this.lastSeenAt = at;
    this.isActive = true;
    this.revokedAt = null;
    this.trustScore = Math.max(trustScoreFloor, this.trustScore ?? 0);
    this.upgradeTrust(DeviceTrustTier.TRUSTED);
  }

  markUnverified(at: Date = new Date()): void {
    this.lastSeenAt = at;
    this.isActive = true;
    this.revokedAt = null;
    this.trustScore = Math.min(this.trustScore ?? 0, 25);
    this.trustTier = DeviceTrustTier.UNVERIFIED;
  }

  revoke(at: Date = new Date()): void {
    this.isActive = false;
    this.revokedAt = at;
    this.trustScore = 0;
    this.trustTier = DeviceTrustTier.UNVERIFIED;
  }

  upgradeTrust(nextTier: DeviceTrustTier): void {
    const currentOrder = DEVICE_TRUST_ORDER[this.trustTier] ?? 0;
    const nextOrder = DEVICE_TRUST_ORDER[nextTier] ?? 0;

    if (nextOrder >= currentOrder) {
      this.trustTier = nextTier;
    }
  }

  isVerified(): boolean {
    return (
      this.isActive === true &&
      this.verifiedAt instanceof Date &&
      (this.trustTier === DeviceTrustTier.VERIFIED ||
        this.trustTier === DeviceTrustTier.HARDENED)
    );
  }

  isTrusted(): boolean {
    return (
      this.isActive === true &&
      (this.trustTier === DeviceTrustTier.TRUSTED ||
        this.trustTier === DeviceTrustTier.VERIFIED ||
        this.trustTier === DeviceTrustTier.HARDENED)
    );
  }
}
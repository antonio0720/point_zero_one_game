// backend/src/entities/push_token.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Account } from '../accounts/account.entity';
import { Device } from '../security/device.entity';

export enum PushPlatform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
  UNKNOWN = 'unknown',
}

export interface PushTokenMetadata {
  appVersion?: string;
  buildNumber?: string;
  locale?: string;
  environment?: string;
  bundleId?: string;
  installationId?: string;
  [key: string]: unknown;
}

@Entity('push_tokens')
@Index('idx_push_tokens_account_id', ['accountId'])
@Index('idx_push_tokens_device_id', ['deviceId'])
@Index('idx_push_tokens_last_seen_at', ['lastSeenAt'])
@Index('idx_push_tokens_token', ['token'])
export class PushToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ type: 'text' })
  token: string;

  @Column({
    type: 'enum',
    enum: PushPlatform,
    default: PushPlatform.UNKNOWN,
  })
  platform: PushPlatform;

  @Column({
    name: 'device_id',
    nullable: true,
  })
  deviceId: number | null;

  @Column({
    type: 'timestamptz',
    name: 'last_seen_at',
    nullable: true,
  })
  lastSeenAt: Date | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    type: 'jsonb',
    name: 'metadata_json',
    default: () => "'{}'::jsonb",
  })
  metadataJson: PushTokenMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({
    type: 'timestamptz',
    name: 'revoked_at',
    nullable: true,
  })
  revokedAt: Date | null;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @ManyToOne(() => Device, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'device_id' })
  device?: Device | null;

  normalizeToken(): string {
    return String(this.token ?? '').trim();
  }

  normalizeMetadata(): PushTokenMetadata {
    if (
      !this.metadataJson ||
      typeof this.metadataJson !== 'object' ||
      Array.isArray(this.metadataJson)
    ) {
      return {};
    }

    return { ...this.metadataJson };
  }

  setMetadataValue(key: string, value: unknown): void {
    const next = this.normalizeMetadata();
    next[key] = value;
    this.metadataJson = next;
  }

  getMetadataValue<T = unknown>(key: string): T | undefined {
    return this.normalizeMetadata()[key] as T | undefined;
  }

  attachDevice(deviceId: number | null): void {
    this.deviceId =
      typeof deviceId === 'number' && Number.isFinite(deviceId)
        ? Math.max(0, Math.trunc(deviceId))
        : null;
  }

  detachDevice(): void {
    this.deviceId = null;
    this.device = null;
  }

  touchSeen(at: Date = new Date()): void {
    this.lastSeenAt = at;
    this.isActive = true;

    if (this.revokedAt) {
      this.revokedAt = null;
    }
  }

  revoke(at: Date = new Date()): void {
    this.revokedAt = at;
    this.isActive = false;
  }

  reactivate(at: Date = new Date()): void {
    this.isActive = true;
    this.revokedAt = null;
    this.lastSeenAt = at;
  }

  isRevoked(): boolean {
    return this.revokedAt instanceof Date;
  }

  isUsable(): boolean {
    return this.isActive === true && !this.isRevoked() && this.normalizeToken().length > 0;
  }

  belongsToAccount(accountId: number): boolean {
    return this.accountId === accountId;
  }

  matchesToken(candidate: string): boolean {
    return this.normalizeToken() === String(candidate ?? '').trim();
  }

  isPlatform(platform: PushPlatform): boolean {
    return this.platform === platform;
  }
}
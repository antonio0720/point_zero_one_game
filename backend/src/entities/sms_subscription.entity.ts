// backend/src/entities/sms_subscription.entity.ts

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

export enum SmsSubscriptionStatus {
  PENDING = 'pending',
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  STOPPED = 'stopped',
  INVALID = 'invalid',
  SUPPRESSED = 'suppressed',
}

export interface SmsSubscriptionMetadata {
  provider?: string;
  externalSubscriberId?: string;
  locale?: string;
  carrier?: string;
  sourceCampaign?: string;
  tags?: string[];
  [key: string]: unknown;
}

function normalizePhoneE164(value: unknown): string {
  const raw = String(value ?? '').trim();
  const normalized = raw.replace(/[^\d+]/g, '');
  return normalized.slice(0, 32);
}

function normalizeShortText(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeNullableShortText(
  value: unknown,
  maxLength: number,
): string | null {
  const normalized = normalizeShortText(value, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function normalizeMetadata(
  value: unknown,
): SmsSubscriptionMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as SmsSubscriptionMetadata;

  return {
    provider: normalizeNullableShortText(input.provider, 64) ?? undefined,
    externalSubscriberId:
      normalizeNullableShortText(input.externalSubscriberId, 255) ?? undefined,
    locale: normalizeNullableShortText(input.locale, 32) ?? undefined,
    carrier: normalizeNullableShortText(input.carrier, 64) ?? undefined,
    sourceCampaign:
      normalizeNullableShortText(input.sourceCampaign, 128) ?? undefined,
    tags: Array.isArray(input.tags)
      ? [...new Set(input.tags.map((tag) => normalizeShortText(tag, 64)).filter(Boolean))]
      : undefined,
  };
}

@Entity('sms_subscriptions')
@Index('idx_sms_subscriptions_account_id', ['accountId'])
@Index('idx_sms_subscriptions_phone_e164', ['phoneE164'])
@Index('idx_sms_subscriptions_status', ['status'])
@Index('idx_sms_subscriptions_topic_key', ['topicKey'])
@Index(
  'uq_sms_subscriptions_scope',
  ['accountId', 'phoneE164', 'topicKey'],
  { unique: true },
)
export class SmsSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ type: 'varchar', length: 32, name: 'phone_e164' })
  phoneE164: string;

  @Column({ type: 'varchar', length: 8, name: 'country_code', nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 128, name: 'topic_key', default: 'general' })
  topicKey: string;

  @Column({
    type: 'enum',
    enum: SmsSubscriptionStatus,
    default: SmsSubscriptionStatus.PENDING,
  })
  status: SmsSubscriptionStatus;

  @Column({ type: 'boolean', name: 'transactional_enabled', default: true })
  transactionalEnabled: boolean;

  @Column({ type: 'boolean', name: 'marketing_enabled', default: false })
  marketingEnabled: boolean;

  @Column({ type: 'boolean', name: 'double_opt_in_required', default: true })
  doubleOptInRequired: boolean;

  @Column({ type: 'varchar', length: 128, nullable: true })
  source: string | null;

  @Column({
    type: 'varchar',
    length: 128,
    name: 'consent_ip_address',
    nullable: true,
  })
  consentIpAddress: string | null;

  @Column({
    type: 'varchar',
    length: 512,
    name: 'consent_user_agent',
    nullable: true,
  })
  consentUserAgent: string | null;

  @Column({
    type: 'timestamptz',
    name: 'consented_at',
    nullable: true,
  })
  consentedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'confirmed_at',
    nullable: true,
  })
  confirmedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'unsubscribed_at',
    nullable: true,
  })
  unsubscribedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'last_message_at',
    nullable: true,
  })
  lastMessageAt: Date | null;

  @Column({
    type: 'jsonb',
    name: 'metadata_json',
    default: () => "'{}'::jsonb",
  })
  metadataJson: SmsSubscriptionMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  normalizePhoneE164(): string {
    return normalizePhoneE164(this.phoneE164);
  }

  normalizeCountryCode(): string | null {
    const normalized = normalizeNullableShortText(this.countryCode, 8);
    return normalized ? normalized.toUpperCase() : null;
  }

  normalizeTopicKey(): string {
    const normalized = normalizeShortText(this.topicKey, 128);
    return normalized.length > 0 ? normalized : 'general';
  }

  normalizeSource(): string | null {
    return normalizeNullableShortText(this.source, 128);
  }

  normalizeMetadata(): SmsSubscriptionMetadata {
    return normalizeMetadata(this.metadataJson);
  }

  setMetadataValue(key: string, value: unknown): void {
    const next = this.normalizeMetadata() as Record<string, unknown>;
    next[key] = value;
    this.metadataJson = next;
  }

  getMetadataValue<T = unknown>(key: string): T | undefined {
    const metadata = this.normalizeMetadata() as Record<string, unknown>;
    return metadata[key] as T | undefined;
  }

  isPending(): boolean {
    return this.status === SmsSubscriptionStatus.PENDING;
  }

  isSubscribed(): boolean {
    return this.status === SmsSubscriptionStatus.SUBSCRIBED;
  }

  isSuppressed(): boolean {
    return (
      this.status === SmsSubscriptionStatus.SUPPRESSED ||
      this.status === SmsSubscriptionStatus.INVALID ||
      this.status === SmsSubscriptionStatus.STOPPED
    );
  }

  hasConfirmedConsent(): boolean {
    if (this.doubleOptInRequired) {
      return this.confirmedAt instanceof Date;
    }

    return this.consentedAt instanceof Date;
  }

  canSendTransactional(): boolean {
    if (!this.transactionalEnabled) {
      return false;
    }

    if (this.status === SmsSubscriptionStatus.UNSUBSCRIBED) {
      return false;
    }

    return !this.isSuppressed();
  }

  canSendMarketing(): boolean {
    if (!this.marketingEnabled) {
      return false;
    }

    if (this.status !== SmsSubscriptionStatus.SUBSCRIBED) {
      return false;
    }

    return this.hasConfirmedConsent() && !this.isSuppressed();
  }

  markConsented(input?: {
    at?: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
    source?: string | null;
  }): void {
    const at = input?.at ?? new Date();

    this.consentedAt = at;
    this.source = normalizeNullableShortText(input?.source ?? this.source, 128);
    this.consentIpAddress = normalizeNullableShortText(
      input?.ipAddress ?? this.consentIpAddress,
      128,
    );
    this.consentUserAgent = normalizeNullableShortText(
      input?.userAgent ?? this.consentUserAgent,
      512,
    );

    if (!this.doubleOptInRequired) {
      this.confirmedAt = at;
      this.status = SmsSubscriptionStatus.SUBSCRIBED;
      this.unsubscribedAt = null;
    } else if (this.status === SmsSubscriptionStatus.UNSUBSCRIBED) {
      this.status = SmsSubscriptionStatus.PENDING;
      this.unsubscribedAt = null;
    }
  }

  confirm(at: Date = new Date()): void {
    this.confirmedAt = at;
    this.consentedAt = this.consentedAt ?? at;
    this.status = SmsSubscriptionStatus.SUBSCRIBED;
    this.unsubscribedAt = null;
  }

  unsubscribe(at: Date = new Date()): void {
    this.status = SmsSubscriptionStatus.UNSUBSCRIBED;
    this.unsubscribedAt = at;
  }

  stop(at: Date = new Date()): void {
    this.status = SmsSubscriptionStatus.STOPPED;
    this.unsubscribedAt = at;
  }

  resubscribe(at: Date = new Date()): void {
    this.consentedAt = this.consentedAt ?? at;
    this.confirmedAt = this.doubleOptInRequired ? this.confirmedAt : at;
    this.status = this.doubleOptInRequired
      ? SmsSubscriptionStatus.PENDING
      : SmsSubscriptionStatus.SUBSCRIBED;
    this.unsubscribedAt = null;
  }

  markInvalid(at: Date = new Date()): void {
    this.status = SmsSubscriptionStatus.INVALID;
    this.unsubscribedAt = at;
  }

  markSuppressed(at: Date = new Date()): void {
    this.status = SmsSubscriptionStatus.SUPPRESSED;
    this.unsubscribedAt = at;
  }

  touchMessage(at: Date = new Date()): void {
    this.lastMessageAt = at;
  }

  belongsToAccount(accountId: number): boolean {
    return this.accountId === accountId;
  }

  matchesPhone(candidate: string): boolean {
    return this.normalizePhoneE164() === normalizePhoneE164(candidate);
  }
}
// backend/src/entities/email_subscription.entity.ts

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

export enum EmailSubscriptionStatus {
  PENDING = 'pending',
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
  SUPPRESSED = 'suppressed',
}

export interface EmailSubscriptionMetadata {
  provider?: string;
  externalSubscriberId?: string;
  locale?: string;
  sourceCampaign?: string;
  acquisitionSource?: string;
  tags?: string[];
  [key: string]: unknown;
}

function normalizeEmailValue(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().slice(0, 320);
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
): EmailSubscriptionMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as EmailSubscriptionMetadata;

  return {
    provider: normalizeNullableShortText(input.provider, 64) ?? undefined,
    externalSubscriberId:
      normalizeNullableShortText(input.externalSubscriberId, 255) ?? undefined,
    locale: normalizeNullableShortText(input.locale, 32) ?? undefined,
    sourceCampaign:
      normalizeNullableShortText(input.sourceCampaign, 128) ?? undefined,
    acquisitionSource:
      normalizeNullableShortText(input.acquisitionSource, 128) ?? undefined,
    tags: Array.isArray(input.tags)
      ? [...new Set(input.tags.map((tag) => normalizeShortText(tag, 64)).filter(Boolean))]
      : undefined,
  };
}

@Entity('email_subscriptions')
@Index('idx_email_subscriptions_account_id', ['accountId'])
@Index('idx_email_subscriptions_email', ['email'])
@Index('idx_email_subscriptions_status', ['status'])
@Index('idx_email_subscriptions_list_topic', ['listKey', 'topicKey'])
@Index(
  'uq_email_subscriptions_scope',
  ['accountId', 'email', 'listKey', 'topicKey'],
  { unique: true },
)
export class EmailSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'varchar', length: 128, name: 'list_key', default: 'default' })
  listKey: string;

  @Column({ type: 'varchar', length: 128, name: 'topic_key', default: 'general' })
  topicKey: string;

  @Column({
    type: 'enum',
    enum: EmailSubscriptionStatus,
    default: EmailSubscriptionStatus.PENDING,
  })
  status: EmailSubscriptionStatus;

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
    name: 'suppressed_at',
    nullable: true,
  })
  suppressedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'last_sent_at',
    nullable: true,
  })
  lastSentAt: Date | null;

  @Column({
    type: 'jsonb',
    name: 'metadata_json',
    default: () => "'{}'::jsonb",
  })
  metadataJson: EmailSubscriptionMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  normalizeEmail(): string {
    return normalizeEmailValue(this.email);
  }

  normalizeListKey(): string {
    const normalized = normalizeShortText(this.listKey, 128);
    return normalized.length > 0 ? normalized : 'default';
  }

  normalizeTopicKey(): string {
    const normalized = normalizeShortText(this.topicKey, 128);
    return normalized.length > 0 ? normalized : 'general';
  }

  normalizeSource(): string | null {
    return normalizeNullableShortText(this.source, 128);
  }

  normalizeConsentIpAddress(): string | null {
    return normalizeNullableShortText(this.consentIpAddress, 128);
  }

  normalizeConsentUserAgent(): string | null {
    return normalizeNullableShortText(this.consentUserAgent, 512);
  }

  normalizeMetadata(): EmailSubscriptionMetadata {
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
    return this.status === EmailSubscriptionStatus.PENDING;
  }

  isSubscribed(): boolean {
    return this.status === EmailSubscriptionStatus.SUBSCRIBED;
  }

  isSuppressed(): boolean {
    return (
      this.status === EmailSubscriptionStatus.SUPPRESSED ||
      this.status === EmailSubscriptionStatus.BOUNCED ||
      this.status === EmailSubscriptionStatus.COMPLAINED
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

    if (this.status === EmailSubscriptionStatus.UNSUBSCRIBED) {
      return false;
    }

    return !this.isSuppressed();
  }

  canSendMarketing(): boolean {
    if (!this.marketingEnabled) {
      return false;
    }

    if (this.status !== EmailSubscriptionStatus.SUBSCRIBED) {
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
      this.status = EmailSubscriptionStatus.SUBSCRIBED;
      this.unsubscribedAt = null;
      this.suppressedAt = null;
    } else if (this.status === EmailSubscriptionStatus.UNSUBSCRIBED) {
      this.status = EmailSubscriptionStatus.PENDING;
      this.unsubscribedAt = null;
      this.suppressedAt = null;
    }
  }

  confirm(at: Date = new Date()): void {
    this.confirmedAt = at;
    this.consentedAt = this.consentedAt ?? at;
    this.status = EmailSubscriptionStatus.SUBSCRIBED;
    this.unsubscribedAt = null;
    this.suppressedAt = null;
  }

  unsubscribe(at: Date = new Date()): void {
    this.status = EmailSubscriptionStatus.UNSUBSCRIBED;
    this.unsubscribedAt = at;
  }

  resubscribe(at: Date = new Date()): void {
    this.consentedAt = this.consentedAt ?? at;
    this.confirmedAt = this.doubleOptInRequired ? this.confirmedAt : at;
    this.status = this.doubleOptInRequired
      ? EmailSubscriptionStatus.PENDING
      : EmailSubscriptionStatus.SUBSCRIBED;
    this.unsubscribedAt = null;
    this.suppressedAt = null;
  }

  markBounced(at: Date = new Date()): void {
    this.status = EmailSubscriptionStatus.BOUNCED;
    this.suppressedAt = at;
  }

  markComplained(at: Date = new Date()): void {
    this.status = EmailSubscriptionStatus.COMPLAINED;
    this.suppressedAt = at;
  }

  markSuppressed(at: Date = new Date()): void {
    this.status = EmailSubscriptionStatus.SUPPRESSED;
    this.suppressedAt = at;
  }

  touchSent(at: Date = new Date()): void {
    this.lastSentAt = at;
  }

  belongsToAccount(accountId: number): boolean {
    return this.accountId === accountId;
  }

  matchesEmail(candidate: string): boolean {
    return this.normalizeEmail() === normalizeEmailValue(candidate);
  }
}
// backend/src/entities/alert_rule.entity.ts

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
import { NotificationChannel } from './notification_preference.entity';

export enum AlertRuleType {
  ABUSE_RISK = 'abuse_risk',
  DEVICE_TRUST = 'device_trust',
  STAKING_BALANCE = 'staking_balance',
  RE_VERIFICATION = 're_verification',
  NOTIFICATION_FAILURE = 'notification_failure',
  LIVEOPS_FORWARD = 'liveops_forward',
  CUSTOM = 'custom',
}

export enum AlertRuleComparator {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  EQ = 'eq',
  NEQ = 'neq',
  BETWEEN = 'between',
}

export enum AlertRuleDeliveryMode {
  IMMEDIATE = 'immediate',
  DIGEST = 'digest',
}

export interface AlertRuleConditions {
  metricKey?: string;
  comparator?: AlertRuleComparator;
  threshold?: number;
  secondaryThreshold?: number;
  eventTypes?: string[];
  trustTiers?: string[];
  abuseFlags?: string[];
  statusAllowlist?: string[];
  requireVerifiedDevice?: boolean;
  metadataMatch?: Record<string, string | number | boolean>;
}

export interface AlertRuleMetadata {
  digestWindowMinutes?: number;
  escalationLevel?: number;
  tags?: string[];
  runbookLink?: string;
  [key: string]: unknown;
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

function normalizeNumber(
  value: unknown,
  fallback = 0,
  min?: number,
  max?: number,
): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  let normalized = numeric;

  if (typeof min === 'number') {
    normalized = Math.max(min, normalized);
  }

  if (typeof max === 'number') {
    normalized = Math.min(max, normalized);
  }

  return normalized;
}

function normalizeConditions(value: unknown): AlertRuleConditions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as AlertRuleConditions;
  const metadataMatchInput = input.metadataMatch;
  const metadataMatch: Record<string, string | number | boolean> = {};

  if (metadataMatchInput && typeof metadataMatchInput === 'object' && !Array.isArray(metadataMatchInput)) {
    for (const [key, item] of Object.entries(metadataMatchInput)) {
      if (
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean'
      ) {
        metadataMatch[normalizeShortText(key, 128)] = item;
      }
    }
  }

  return {
    metricKey: normalizeNullableShortText(input.metricKey, 128) ?? undefined,
    comparator:
      typeof input.comparator === 'string'
        ? (input.comparator as AlertRuleComparator)
        : undefined,
    threshold:
      typeof input.threshold === 'number' && Number.isFinite(input.threshold)
        ? input.threshold
        : undefined,
    secondaryThreshold:
      typeof input.secondaryThreshold === 'number' &&
      Number.isFinite(input.secondaryThreshold)
        ? input.secondaryThreshold
        : undefined,
    eventTypes: Array.isArray(input.eventTypes)
      ? [...new Set(input.eventTypes.map((item) => normalizeShortText(item, 128)).filter(Boolean))]
      : undefined,
    trustTiers: Array.isArray(input.trustTiers)
      ? [...new Set(input.trustTiers.map((item) => normalizeShortText(item, 64)).filter(Boolean))]
      : undefined,
    abuseFlags: Array.isArray(input.abuseFlags)
      ? [...new Set(input.abuseFlags.map((item) => normalizeShortText(item, 64)).filter(Boolean))]
      : undefined,
    statusAllowlist: Array.isArray(input.statusAllowlist)
      ? [...new Set(input.statusAllowlist.map((item) => normalizeShortText(item, 64)).filter(Boolean))]
      : undefined,
    requireVerifiedDevice:
      typeof input.requireVerifiedDevice === 'boolean'
        ? input.requireVerifiedDevice
        : undefined,
    metadataMatch:
      Object.keys(metadataMatch).length > 0 ? metadataMatch : undefined,
  };
}

function normalizeMetadata(value: unknown): AlertRuleMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as AlertRuleMetadata;

  return {
    digestWindowMinutes:
      typeof input.digestWindowMinutes === 'number' &&
      Number.isFinite(input.digestWindowMinutes)
        ? Math.max(1, Math.trunc(input.digestWindowMinutes))
        : undefined,
    escalationLevel:
      typeof input.escalationLevel === 'number' &&
      Number.isFinite(input.escalationLevel)
        ? Math.max(0, Math.trunc(input.escalationLevel))
        : undefined,
    tags: Array.isArray(input.tags)
      ? [...new Set(input.tags.map((tag) => normalizeShortText(tag, 64)).filter(Boolean))]
      : undefined,
    runbookLink: normalizeNullableShortText(input.runbookLink, 512) ?? undefined,
  };
}

function normalizeChannels(value: unknown): NotificationChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<string>(Object.values(NotificationChannel));

  return [...new Set(
    value
      .filter((item): item is NotificationChannel => typeof item === 'string' && allowed.has(item))
      .map((item) => item as NotificationChannel),
  )];
}

@Entity('alert_rules')
@Index('idx_alert_rules_account_id', ['accountId'])
@Index('idx_alert_rules_enabled', ['enabled'])
@Index('idx_alert_rules_type', ['ruleType'])
@Index('idx_alert_rules_next_eligible_at', ['nextEligibleAt'])
@Index('uq_alert_rules_account_name', ['accountId', 'name'], { unique: true })
export class AlertRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: AlertRuleType,
    name: 'rule_type',
    default: AlertRuleType.CUSTOM,
  })
  ruleType: AlertRuleType;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({
    type: 'enum',
    enum: AlertRuleDeliveryMode,
    name: 'delivery_mode',
    default: AlertRuleDeliveryMode.IMMEDIATE,
  })
  deliveryMode: AlertRuleDeliveryMode;

  @Column({
    type: 'jsonb',
    name: 'channels_json',
    default: () => "'[]'::jsonb",
  })
  channelsJson: NotificationChannel[];

  @Column({
    type: 'jsonb',
    name: 'conditions_json',
    default: () => "'{}'::jsonb",
  })
  conditionsJson: AlertRuleConditions;

  @Column({
    type: 'jsonb',
    name: 'metadata_json',
    default: () => "'{}'::jsonb",
  })
  metadataJson: AlertRuleMetadata;

  @Column({ type: 'smallint', default: 1 })
  severity: number;

  @Column({
    type: 'int',
    name: 'cooldown_minutes',
    default: 15,
  })
  cooldownMinutes: number;

  @Column({
    type: 'int',
    name: 'max_triggers_per_window',
    default: 1,
  })
  maxTriggersPerWindow: number;

  @Column({
    type: 'int',
    name: 'window_minutes',
    default: 60,
  })
  windowMinutes: number;

  @Column({
    type: 'int',
    name: 'trigger_count_window',
    default: 0,
  })
  triggerCountWindow: number;

  @Column({
    type: 'timestamptz',
    name: 'last_triggered_at',
    nullable: true,
  })
  lastTriggeredAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'next_eligible_at',
    nullable: true,
  })
  nextEligibleAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  normalizeName(): string {
    return normalizeShortText(this.name, 128);
  }

  normalizeDescription(): string | null {
    return normalizeNullableShortText(this.description, 4000);
  }

  normalizeSeverity(): number {
    return Math.trunc(normalizeNumber(this.severity, 1, 1, 10));
  }

  normalizeCooldownMinutes(): number {
    return Math.trunc(normalizeNumber(this.cooldownMinutes, 15, 0, 7 * 24 * 60));
  }

  normalizeWindowMinutes(): number {
    return Math.trunc(normalizeNumber(this.windowMinutes, 60, 1, 7 * 24 * 60));
  }

  normalizeMaxTriggersPerWindow(): number {
    return Math.trunc(
      normalizeNumber(this.maxTriggersPerWindow, 1, 1, 100000),
    );
  }

  normalizeTriggerCountWindow(): number {
    return Math.trunc(
      normalizeNumber(this.triggerCountWindow, 0, 0, 100000),
    );
  }

  normalizeChannels(): NotificationChannel[] {
    return normalizeChannels(this.channelsJson);
  }

  normalizeConditions(): AlertRuleConditions {
    return normalizeConditions(this.conditionsJson);
  }

  normalizeMetadata(): AlertRuleMetadata {
    return normalizeMetadata(this.metadataJson);
  }

  usesChannel(channel: NotificationChannel): boolean {
    return this.normalizeChannels().includes(channel);
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  setChannels(channels: NotificationChannel[]): void {
    this.channelsJson = normalizeChannels(channels);
  }

  setConditions(conditions: AlertRuleConditions): void {
    this.conditionsJson = normalizeConditions(conditions);
  }

  setMetadata(metadata: AlertRuleMetadata): void {
    this.metadataJson = normalizeMetadata(metadata);
  }

  getMetadataValue<T = unknown>(key: string): T | undefined {
    const metadata = this.normalizeMetadata() as Record<string, unknown>;
    return metadata[key] as T | undefined;
  }

  setMetadataValue(key: string, value: unknown): void {
    const metadata = this.normalizeMetadata() as Record<string, unknown>;
    metadata[key] = value;
    this.metadataJson = metadata;
  }

  isEligible(at: Date = new Date()): boolean {
    if (!this.enabled) {
      return false;
    }

    if (this.nextEligibleAt instanceof Date && this.nextEligibleAt > at) {
      return false;
    }

    return true;
  }

  canTrigger(at: Date = new Date()): boolean {
    if (!this.isEligible(at)) {
      return false;
    }

    return this.normalizeTriggerCountWindow() < this.normalizeMaxTriggersPerWindow();
  }

  recordTrigger(at: Date = new Date()): void {
    this.lastTriggeredAt = at;
    this.triggerCountWindow = this.normalizeTriggerCountWindow() + 1;

    const cooldownMs = this.normalizeCooldownMinutes() * 60 * 1000;
    this.nextEligibleAt = new Date(at.getTime() + cooldownMs);
  }

  resetWindow(): void {
    this.triggerCountWindow = 0;
    this.nextEligibleAt = null;
  }

  matchesNumericValue(value: number): boolean {
    const conditions = this.normalizeConditions();
    const comparator = conditions.comparator;
    const threshold = conditions.threshold;
    const secondaryThreshold = conditions.secondaryThreshold;

    if (typeof threshold !== 'number' || !Number.isFinite(value)) {
      return false;
    }

    switch (comparator) {
      case AlertRuleComparator.GT:
        return value > threshold;
      case AlertRuleComparator.GTE:
        return value >= threshold;
      case AlertRuleComparator.LT:
        return value < threshold;
      case AlertRuleComparator.LTE:
        return value <= threshold;
      case AlertRuleComparator.EQ:
        return value === threshold;
      case AlertRuleComparator.NEQ:
        return value !== threshold;
      case AlertRuleComparator.BETWEEN:
        return (
          typeof secondaryThreshold === 'number' &&
          value >= Math.min(threshold, secondaryThreshold) &&
          value <= Math.max(threshold, secondaryThreshold)
        );
      default:
        return false;
    }
  }

  belongsToAccount(accountId: number): boolean {
    return this.accountId === accountId;
  }
}
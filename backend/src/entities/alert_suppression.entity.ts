// backend/src/entities/alert_suppression.entity.ts

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
import { AlertRule, AlertRuleType } from './alert_rule.entity';
import { NotificationChannel } from './notification_preference.entity';

export enum AlertSuppressionScope {
  ACCOUNT = 'account',
  RULE = 'rule',
  RULE_TYPE = 'rule_type',
  CHANNEL = 'channel',
  CUSTOM = 'custom',
}

export enum AlertSuppressionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DISABLED = 'disabled',
}

export interface AlertSuppressionConditions {
  metricKeys?: string[];
  eventTypes?: string[];
  entityTypes?: string[];
  severities?: number[];
  metadataMatch?: Record<string, string | number | boolean>;
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

function normalizeChannels(value: unknown): NotificationChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<string>(Object.values(NotificationChannel));

  return [
    ...new Set(
      value.filter(
        (item): item is NotificationChannel =>
          typeof item === 'string' && allowed.has(item),
      ),
    ),
  ];
}

function normalizeConditions(value: unknown): AlertSuppressionConditions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as AlertSuppressionConditions;
  const normalized: AlertSuppressionConditions = {};

  if (Array.isArray(input.metricKeys)) {
    normalized.metricKeys = [
      ...new Set(
        input.metricKeys
          .map((value) => normalizeShortText(value, 128))
          .filter(Boolean),
      ),
    ];
  }

  if (Array.isArray(input.eventTypes)) {
    normalized.eventTypes = [
      ...new Set(
        input.eventTypes
          .map((value) => normalizeShortText(value, 128))
          .filter(Boolean),
      ),
    ];
  }

  if (Array.isArray(input.entityTypes)) {
    normalized.entityTypes = [
      ...new Set(
        input.entityTypes
          .map((value) => normalizeShortText(value, 128))
          .filter(Boolean),
      ),
    ];
  }

  if (Array.isArray(input.severities)) {
    normalized.severities = [
      ...new Set(
        input.severities
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
          .map((value) => Math.max(1, Math.min(10, Math.trunc(value)))),
      ),
    ];
  }

  if (
    input.metadataMatch &&
    typeof input.metadataMatch === 'object' &&
    !Array.isArray(input.metadataMatch)
  ) {
    const next: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(input.metadataMatch)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        next[normalizeShortText(key, 128)] = value;
      }
    }

    if (Object.keys(next).length > 0) {
      normalized.metadataMatch = next;
    }
  }

  return normalized;
}

@Entity('alert_suppressions')
@Index('idx_alert_suppressions_account_id', ['accountId'])
@Index('idx_alert_suppressions_alert_rule_id', ['alertRuleId'])
@Index('idx_alert_suppressions_scope', ['scope'])
@Index('idx_alert_suppressions_status', ['status'])
@Index('idx_alert_suppressions_starts_at', ['startsAt'])
@Index('idx_alert_suppressions_ends_at', ['endsAt'])
@Index(
  'uq_alert_suppressions_account_suppression_key',
  ['accountId', 'suppressionKey'],
  { unique: true },
)
export class AlertSuppression {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ name: 'alert_rule_id', nullable: true })
  alertRuleId: number | null;

  @Column({ type: 'varchar', length: 255, name: 'suppression_key' })
  suppressionKey: string;

  @Column({
    type: 'enum',
    enum: AlertSuppressionScope,
    default: AlertSuppressionScope.CUSTOM,
  })
  scope: AlertSuppressionScope;

  @Column({
    type: 'enum',
    enum: AlertSuppressionStatus,
    default: AlertSuppressionStatus.ACTIVE,
  })
  status: AlertSuppressionStatus;

  @Column({
    type: 'enum',
    enum: AlertRuleType,
    name: 'rule_type',
    nullable: true,
  })
  ruleType: AlertRuleType | null;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

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
  conditionsJson: AlertSuppressionConditions;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'created_by_user_id',
    nullable: true,
  })
  createdByUserId: string | null;

  @Column({
    type: 'timestamptz',
    name: 'starts_at',
    default: () => 'NOW()',
  })
  startsAt: Date;

  @Column({
    type: 'timestamptz',
    name: 'ends_at',
    nullable: true,
  })
  endsAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'last_matched_at',
    nullable: true,
  })
  lastMatchedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @ManyToOne(() => AlertRule, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'alert_rule_id' })
  alertRule?: AlertRule | null;

  normalizeSuppressionKey(): string {
    return normalizeShortText(this.suppressionKey, 255);
  }

  normalizeReason(): string {
    const normalized = normalizeShortText(this.reason, 255);
    return normalized.length > 0 ? normalized : 'Suppressed';
  }

  normalizeNotes(): string | null {
    const value = String(this.notes ?? '').trim();
    return value.length > 0 ? value : null;
  }

  normalizeCreatedByUserId(): string | null {
    return normalizeNullableShortText(this.createdByUserId, 255);
  }

  normalizeChannels(): NotificationChannel[] {
    return normalizeChannels(this.channelsJson);
  }

  normalizeConditions(): AlertSuppressionConditions {
    return normalizeConditions(this.conditionsJson);
  }

  setChannels(channels: NotificationChannel[]): void {
    this.channelsJson = normalizeChannels(channels);
  }

  setConditions(conditions: AlertSuppressionConditions): void {
    this.conditionsJson = normalizeConditions(conditions);
  }

  addChannel(channel: NotificationChannel): void {
    this.channelsJson = normalizeChannels([...this.normalizeChannels(), channel]);
  }

  appliesToChannel(channel: NotificationChannel): boolean {
    const channels = this.normalizeChannels();
    return channels.length === 0 || channels.includes(channel);
  }

  appliesToRule(ruleId: number | null | undefined): boolean {
    if (this.scope !== AlertSuppressionScope.RULE) {
      return true;
    }

    return typeof ruleId === 'number' && this.alertRuleId === ruleId;
  }

  appliesToRuleType(ruleType: AlertRuleType): boolean {
    if (this.scope !== AlertSuppressionScope.RULE_TYPE) {
      return true;
    }

    return this.ruleType === ruleType;
  }

  appliesToSeverity(severity: number): boolean {
    const conditions = this.normalizeConditions();
    if (!Array.isArray(conditions.severities) || conditions.severities.length === 0) {
      return true;
    }

    return conditions.severities.includes(Math.max(1, Math.min(10, Math.trunc(severity))));
  }

  isActive(at: Date = new Date()): boolean {
    if (this.status !== AlertSuppressionStatus.ACTIVE) {
      return false;
    }

    if (!(this.startsAt instanceof Date)) {
      return false;
    }

    if (this.startsAt > at) {
      return false;
    }

    if (this.endsAt instanceof Date && this.endsAt <= at) {
      return false;
    }

    return true;
  }

  matches(input: {
    ruleId?: number | null;
    ruleType?: AlertRuleType | null;
    channel?: NotificationChannel | null;
    severity?: number | null;
    at?: Date;
  }): boolean {
    const at = input.at ?? new Date();

    if (!this.isActive(at)) {
      return false;
    }

    if (
      typeof input.ruleId === 'number' &&
      !this.appliesToRule(input.ruleId)
    ) {
      return false;
    }

    if (
      input.ruleType &&
      !this.appliesToRuleType(input.ruleType)
    ) {
      return false;
    }

    if (
      input.channel &&
      !this.appliesToChannel(input.channel)
    ) {
      return false;
    }

    if (
      typeof input.severity === 'number' &&
      !this.appliesToSeverity(input.severity)
    ) {
      return false;
    }

    return true;
  }

  markMatched(at: Date = new Date()): void {
    this.lastMatchedAt = at;
  }

  expire(at: Date = new Date()): void {
    this.status = AlertSuppressionStatus.EXPIRED;
    this.endsAt = at;
  }

  disable(): void {
    this.status = AlertSuppressionStatus.DISABLED;
  }

  enable(): void {
    this.status = AlertSuppressionStatus.ACTIVE;
    if (!(this.startsAt instanceof Date)) {
      this.startsAt = new Date();
    }
  }

  belongsToAccount(accountId: number): boolean {
    return this.accountId === accountId;
  }
}
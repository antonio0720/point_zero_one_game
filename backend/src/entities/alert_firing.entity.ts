// backend/src/entities/alert_firing.entity.ts

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
import {
  AlertRule,
  AlertRuleDeliveryMode,
  AlertRuleType,
} from './alert_rule.entity';
import { NotificationChannel } from './notification_preference.entity';
import { RunbookLink } from './runbook_link.entity';

export enum AlertFiringStatus {
  PENDING = 'pending',
  FIRED = 'fired',
  DELIVERED = 'delivered',
  SUPPRESSED = 'suppressed',
  FAILED = 'failed',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

export interface AlertFiringContext {
  metricKey?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  sourceEventType?: string;
  triggerWindowMinutes?: number;
  observedValue?: number;
  thresholdValue?: number;
  comparator?: string;
  tags?: string[];
  payload?: Record<string, unknown>;
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

function normalizeInteger(
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

  let normalized = Math.trunc(numeric);

  if (typeof min === 'number') {
    normalized = Math.max(min, normalized);
  }

  if (typeof max === 'number') {
    normalized = Math.min(max, normalized);
  }

  return normalized;
}

function normalizeNumber(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numeric) ? numeric : null;
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

function normalizeContext(value: unknown): AlertFiringContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as AlertFiringContext;
  const normalized: AlertFiringContext = {};

  const metricKey = normalizeNullableShortText(input.metricKey, 128);
  if (metricKey) {
    normalized.metricKey = metricKey;
  }

  const sourceEntityType = normalizeNullableShortText(input.sourceEntityType, 128);
  if (sourceEntityType) {
    normalized.sourceEntityType = sourceEntityType;
  }

  const sourceEntityId = normalizeNullableShortText(input.sourceEntityId, 255);
  if (sourceEntityId) {
    normalized.sourceEntityId = sourceEntityId;
  }

  const sourceEventType = normalizeNullableShortText(input.sourceEventType, 128);
  if (sourceEventType) {
    normalized.sourceEventType = sourceEventType;
  }

  const triggerWindowMinutes =
    typeof input.triggerWindowMinutes === 'number' &&
    Number.isFinite(input.triggerWindowMinutes)
      ? Math.max(0, Math.trunc(input.triggerWindowMinutes))
      : null;
  if (triggerWindowMinutes !== null) {
    normalized.triggerWindowMinutes = triggerWindowMinutes;
  }

  const observedValue = normalizeNumber(input.observedValue);
  if (observedValue !== null) {
    normalized.observedValue = observedValue;
  }

  const thresholdValue = normalizeNumber(input.thresholdValue);
  if (thresholdValue !== null) {
    normalized.thresholdValue = thresholdValue;
  }

  const comparator = normalizeNullableShortText(input.comparator, 32);
  if (comparator) {
    normalized.comparator = comparator;
  }

  if (Array.isArray(input.tags)) {
    normalized.tags = [
      ...new Set(
        input.tags
          .map((tag) => normalizeShortText(tag, 64))
          .filter(Boolean),
      ),
    ];
  }

  if (
    input.payload &&
    typeof input.payload === 'object' &&
    !Array.isArray(input.payload)
  ) {
    normalized.payload = { ...input.payload };
  }

  for (const [key, entry] of Object.entries(input)) {
    if (
      key in normalized ||
      key === 'metricKey' ||
      key === 'sourceEntityType' ||
      key === 'sourceEntityId' ||
      key === 'sourceEventType' ||
      key === 'triggerWindowMinutes' ||
      key === 'observedValue' ||
      key === 'thresholdValue' ||
      key === 'comparator' ||
      key === 'tags' ||
      key === 'payload'
    ) {
      continue;
    }

    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      entry === null
    ) {
      normalized[normalizeShortText(key, 128)] = entry;
    }
  }

  return normalized;
}

@Entity('alert_firings')
@Index('idx_alert_firings_account_id', ['accountId'])
@Index('idx_alert_firings_alert_rule_id', ['alertRuleId'])
@Index('idx_alert_firings_runbook_link_id', ['runbookLinkId'])
@Index('idx_alert_firings_rule_type', ['ruleType'])
@Index('idx_alert_firings_status', ['status'])
@Index('idx_alert_firings_fired_at', ['firedAt'])
@Index('idx_alert_firings_next_lookup', ['accountId', 'status', 'createdAt'])
@Index('uq_alert_firings_account_firing_key', ['accountId', 'firingKey'], {
  unique: true,
})
export class AlertFiring {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ name: 'alert_rule_id', nullable: true })
  alertRuleId: number | null;

  @Column({ name: 'runbook_link_id', nullable: true })
  runbookLinkId: number | null;

  @Column({ type: 'varchar', length: 255, name: 'firing_key' })
  firingKey: string;

  @Column({ type: 'varchar', length: 255, name: 'event_key', nullable: true })
  eventKey: string | null;

  @Column({
    type: 'enum',
    enum: AlertRuleType,
    name: 'rule_type',
    default: AlertRuleType.CUSTOM,
  })
  ruleType: AlertRuleType;

  @Column({
    type: 'enum',
    enum: AlertRuleDeliveryMode,
    name: 'delivery_mode',
    default: AlertRuleDeliveryMode.IMMEDIATE,
  })
  deliveryMode: AlertRuleDeliveryMode;

  @Column({
    type: 'enum',
    enum: AlertFiringStatus,
    default: AlertFiringStatus.PENDING,
  })
  status: AlertFiringStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'smallint', default: 1 })
  severity: number;

  @Column({
    type: 'double precision',
    name: 'trigger_value',
    nullable: true,
  })
  triggerValue: number | null;

  @Column({
    type: 'double precision',
    name: 'threshold_value',
    nullable: true,
  })
  thresholdValue: number | null;

  @Column({
    type: 'jsonb',
    name: 'channels_attempted_json',
    default: () => "'[]'::jsonb",
  })
  channelsAttemptedJson: NotificationChannel[];

  @Column({
    type: 'jsonb',
    name: 'channels_delivered_json',
    default: () => "'[]'::jsonb",
  })
  channelsDeliveredJson: NotificationChannel[];

  @Column({
    type: 'jsonb',
    name: 'context_json',
    default: () => "'{}'::jsonb",
  })
  contextJson: AlertFiringContext;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_reference',
    nullable: true,
  })
  providerReference: string | null;

  @Column({
    type: 'text',
    name: 'error_message',
    nullable: true,
  })
  errorMessage: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'suppression_reason',
    nullable: true,
  })
  suppressionReason: string | null;

  @Column({
    type: 'timestamptz',
    name: 'source_event_at',
    nullable: true,
  })
  sourceEventAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'fired_at',
    nullable: true,
  })
  firedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'delivered_at',
    nullable: true,
  })
  deliveredAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'suppressed_at',
    nullable: true,
  })
  suppressedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'acknowledged_at',
    nullable: true,
  })
  acknowledgedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'resolved_at',
    nullable: true,
  })
  resolvedAt: Date | null;

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

  @ManyToOne(() => RunbookLink, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'runbook_link_id' })
  runbookLink?: RunbookLink | null;

  normalizeFiringKey(): string {
    return normalizeShortText(this.firingKey, 255);
  }

  normalizeEventKey(): string | null {
    return normalizeNullableShortText(this.eventKey, 255);
  }

  normalizeTitle(): string {
    return normalizeShortText(this.title, 255);
  }

  normalizeMessage(): string {
    return String(this.message ?? '').trim();
  }

  normalizeSeverity(): number {
    return normalizeInteger(this.severity, 1, 1, 10);
  }

  normalizeTriggerValue(): number | null {
    return normalizeNumber(this.triggerValue);
  }

  normalizeThresholdValue(): number | null {
    return normalizeNumber(this.thresholdValue);
  }

  normalizeChannelsAttempted(): NotificationChannel[] {
    return normalizeChannels(this.channelsAttemptedJson);
  }

  normalizeChannelsDelivered(): NotificationChannel[] {
    return normalizeChannels(this.channelsDeliveredJson);
  }

  normalizeContext(): AlertFiringContext {
    return normalizeContext(this.contextJson);
  }

  normalizeProviderReference(): string | null {
    return normalizeNullableShortText(this.providerReference, 255);
  }

  normalizeErrorMessage(): string | null {
    const value = String(this.errorMessage ?? '').trim();
    return value.length > 0 ? value : null;
  }

  normalizeSuppressionReason(): string | null {
    return normalizeNullableShortText(this.suppressionReason, 255);
  }

  setChannelsAttempted(channels: NotificationChannel[]): void {
    this.channelsAttemptedJson = normalizeChannels(channels);
  }

  setChannelsDelivered(channels: NotificationChannel[]): void {
    this.channelsDeliveredJson = normalizeChannels(channels);
  }

  addAttemptedChannel(channel: NotificationChannel): void {
    this.channelsAttemptedJson = normalizeChannels([
      ...this.normalizeChannelsAttempted(),
      channel,
    ]);
  }

  addDeliveredChannel(channel: NotificationChannel): void {
    this.channelsDeliveredJson = normalizeChannels([
      ...this.normalizeChannelsDelivered(),
      channel,
    ]);
  }

  setContext(context: AlertFiringContext): void {
    this.contextJson = normalizeContext(context);
  }

  setContextValue(key: string, value: unknown): void {
    const next = this.normalizeContext() as Record<string, unknown>;
    next[normalizeShortText(key, 128)] = value;
    this.contextJson = next;
  }

  getContextValue<T = unknown>(key: string): T | undefined {
    const context = this.normalizeContext() as Record<string, unknown>;
    return context[key] as T | undefined;
  }

  isPending(): boolean {
    return this.status === AlertFiringStatus.PENDING;
  }

  isDelivered(): boolean {
    return this.status === AlertFiringStatus.DELIVERED;
  }

  isSuppressed(): boolean {
    return this.status === AlertFiringStatus.SUPPRESSED;
  }

  isResolved(): boolean {
    return this.status === AlertFiringStatus.RESOLVED;
  }

  isTerminal(): boolean {
    return (
      this.status === AlertFiringStatus.DELIVERED ||
      this.status === AlertFiringStatus.SUPPRESSED ||
      this.status === AlertFiringStatus.FAILED ||
      this.status === AlertFiringStatus.RESOLVED
    );
  }

  canTransitionTo(nextStatus: AlertFiringStatus): boolean {
    switch (this.status) {
      case AlertFiringStatus.PENDING:
        return (
          nextStatus === AlertFiringStatus.FIRED ||
          nextStatus === AlertFiringStatus.SUPPRESSED ||
          nextStatus === AlertFiringStatus.FAILED
        );
      case AlertFiringStatus.FIRED:
        return (
          nextStatus === AlertFiringStatus.DELIVERED ||
          nextStatus === AlertFiringStatus.SUPPRESSED ||
          nextStatus === AlertFiringStatus.FAILED ||
          nextStatus === AlertFiringStatus.ACKNOWLEDGED
        );
      case AlertFiringStatus.DELIVERED:
        return (
          nextStatus === AlertFiringStatus.ACKNOWLEDGED ||
          nextStatus === AlertFiringStatus.RESOLVED
        );
      case AlertFiringStatus.ACKNOWLEDGED:
        return nextStatus === AlertFiringStatus.RESOLVED;
      case AlertFiringStatus.SUPPRESSED:
      case AlertFiringStatus.FAILED:
      case AlertFiringStatus.RESOLVED:
      default:
        return false;
    }
  }

  markFired(input?: {
    at?: Date;
    providerReference?: string | null;
    attemptedChannels?: NotificationChannel[];
  }): void {
    if (
      this.status !== AlertFiringStatus.PENDING &&
      this.status !== AlertFiringStatus.FIRED
    ) {
      throw new Error(`Cannot mark firing as fired from status ${this.status}`);
    }

    this.status = AlertFiringStatus.FIRED;
    this.firedAt = input?.at ?? new Date();
    this.errorMessage = null;
    this.suppressionReason = null;
    this.suppressedAt = null;

    if (Array.isArray(input?.attemptedChannels)) {
      this.setChannelsAttempted(input.attemptedChannels);
    }

    const providerReference = normalizeNullableShortText(
      input?.providerReference,
      255,
    );
    if (providerReference) {
      this.providerReference = providerReference;
    }
  }

  markDelivered(input?: {
    at?: Date;
    deliveredChannels?: NotificationChannel[];
    providerReference?: string | null;
  }): void {
    if (
      this.status !== AlertFiringStatus.FIRED &&
      this.status !== AlertFiringStatus.DELIVERED
    ) {
      throw new Error(
        `Cannot mark firing as delivered from status ${this.status}`,
      );
    }

    this.status = AlertFiringStatus.DELIVERED;
    this.deliveredAt = input?.at ?? new Date();
    this.firedAt = this.firedAt ?? this.deliveredAt;
    this.errorMessage = null;

    if (Array.isArray(input?.deliveredChannels)) {
      this.setChannelsDelivered(input.deliveredChannels);
    }

    const providerReference = normalizeNullableShortText(
      input?.providerReference,
      255,
    );
    if (providerReference) {
      this.providerReference = providerReference;
    }
  }

  markSuppressed(reason: string, at: Date = new Date()): void {
    if (this.isTerminal() && this.status !== AlertFiringStatus.SUPPRESSED) {
      throw new Error(
        `Cannot suppress firing from terminal status ${this.status}`,
      );
    }

    this.status = AlertFiringStatus.SUPPRESSED;
    this.suppressedAt = at;
    this.suppressionReason =
      normalizeNullableShortText(reason, 255) ?? 'Suppressed';
  }

  markFailed(errorMessage: string, at: Date = new Date()): void {
    if (
      this.status !== AlertFiringStatus.PENDING &&
      this.status !== AlertFiringStatus.FIRED
    ) {
      throw new Error(`Cannot mark firing as failed from status ${this.status}`);
    }

    this.status = AlertFiringStatus.FAILED;
    this.errorMessage =
      normalizeNullableShortText(errorMessage, 4000) ?? 'Unknown error';
    this.firedAt = this.firedAt ?? at;
  }

  acknowledge(at: Date = new Date()): void {
    if (
      this.status !== AlertFiringStatus.FIRED &&
      this.status !== AlertFiringStatus.DELIVERED &&
      this.status !== AlertFiringStatus.ACKNOWLEDGED
    ) {
      throw new Error(
        `Cannot acknowledge firing from status ${this.status}`,
      );
    }

    this.status = AlertFiringStatus.ACKNOWLEDGED;
    this.acknowledgedAt = at;
  }

  resolve(at: Date = new Date()): void {
    if (
      this.status !== AlertFiringStatus.ACKNOWLEDGED &&
      this.status !== AlertFiringStatus.DELIVERED &&
      this.status !== AlertFiringStatus.RESOLVED
    ) {
      throw new Error(`Cannot resolve firing from status ${this.status}`);
    }

    this.status = AlertFiringStatus.RESOLVED;
    this.resolvedAt = at;
  }

  belongsToAccount(accountId: number): boolean {
    return this.accountId === accountId;
  }

  matchesRule(ruleId: number | null | undefined): boolean {
    return typeof ruleId === 'number' && this.alertRuleId === ruleId;
  }
}
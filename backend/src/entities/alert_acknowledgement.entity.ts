// backend/src/entities/alert_acknowledgement.entity.ts

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
import { AlertFiring } from './alert_firing.entity';
import { RunbookLink } from './runbook_link.entity';

export enum AlertAcknowledgementStatus {
  ACTIVE = 'active',
  RESCINDED = 'rescinded',
}

export enum AlertAcknowledgementSource {
  DASHBOARD = 'dashboard',
  API = 'api',
  WORKER = 'worker',
  MANUAL = 'manual',
  RUNBOOK = 'runbook',
}

export interface AlertAcknowledgementContext {
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  actorRole?: string;
  channel?: string;
  noteTags?: string[];
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

function normalizeContext(value: unknown): AlertAcknowledgementContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as AlertAcknowledgementContext;
  const normalized: AlertAcknowledgementContext = {};

  const sessionId = normalizeNullableShortText(input.sessionId, 255);
  if (sessionId) {
    normalized.sessionId = sessionId;
  }

  const ipAddress = normalizeNullableShortText(input.ipAddress, 128);
  if (ipAddress) {
    normalized.ipAddress = ipAddress;
  }

  const userAgent = normalizeNullableShortText(input.userAgent, 512);
  if (userAgent) {
    normalized.userAgent = userAgent;
  }

  const actorRole = normalizeNullableShortText(input.actorRole, 128);
  if (actorRole) {
    normalized.actorRole = actorRole;
  }

  const channel = normalizeNullableShortText(input.channel, 64);
  if (channel) {
    normalized.channel = channel;
  }

  if (Array.isArray(input.noteTags)) {
    normalized.noteTags = [
      ...new Set(
        input.noteTags
          .map((tag) => normalizeShortText(tag, 64))
          .filter(Boolean),
      ),
    ];
  }

  for (const [key, entry] of Object.entries(input)) {
    if (
      key === 'sessionId' ||
      key === 'ipAddress' ||
      key === 'userAgent' ||
      key === 'actorRole' ||
      key === 'channel' ||
      key === 'noteTags'
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

@Entity('alert_acknowledgements')
@Index('idx_alert_acknowledgements_account_id', ['accountId'])
@Index('idx_alert_acknowledgements_alert_firing_id', ['alertFiringId'])
@Index('idx_alert_acknowledgements_runbook_link_id', ['runbookLinkId'])
@Index('idx_alert_acknowledgements_acknowledged_by_user_id', ['acknowledgedByUserId'])
@Index('idx_alert_acknowledgements_status', ['status'])
@Index('idx_alert_acknowledgements_acknowledged_at', ['acknowledgedAt'])
@Index(
  'uq_alert_acknowledgements_account_key',
  ['accountId', 'acknowledgementKey'],
  { unique: true },
)
export class AlertAcknowledgement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ name: 'alert_firing_id' })
  alertFiringId: number;

  @Column({ name: 'runbook_link_id', nullable: true })
  runbookLinkId: number | null;

  @Column({ type: 'varchar', length: 255, name: 'acknowledgement_key' })
  acknowledgementKey: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'acknowledged_by_user_id',
  })
  acknowledgedByUserId: string;

  @Column({
    type: 'enum',
    enum: AlertAcknowledgementStatus,
    default: AlertAcknowledgementStatus.ACTIVE,
  })
  status: AlertAcknowledgementStatus;

  @Column({
    type: 'enum',
    enum: AlertAcknowledgementSource,
    default: AlertAcknowledgementSource.DASHBOARD,
  })
  source: AlertAcknowledgementSource;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'jsonb',
    name: 'context_json',
    default: () => "'{}'::jsonb",
  })
  contextJson: AlertAcknowledgementContext;

  @Column({
    type: 'timestamptz',
    name: 'acknowledged_at',
    default: () => 'NOW()',
  })
  acknowledgedAt: Date;

  @Column({
    type: 'timestamptz',
    name: 'rescinded_at',
    nullable: true,
  })
  rescindedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @ManyToOne(() => AlertFiring, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_firing_id' })
  alertFiring?: AlertFiring;

  @ManyToOne(() => RunbookLink, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'runbook_link_id' })
  runbookLink?: RunbookLink | null;

  normalizeAcknowledgementKey(): string {
    return normalizeShortText(this.acknowledgementKey, 255);
  }

  normalizeAcknowledgedByUserId(): string {
    return normalizeShortText(this.acknowledgedByUserId, 255);
  }

  normalizeNote(): string | null {
    const normalized = String(this.note ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  normalizeContext(): AlertAcknowledgementContext {
    return normalizeContext(this.contextJson);
  }

  setContext(context: AlertAcknowledgementContext): void {
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

  isActive(): boolean {
    return this.status === AlertAcknowledgementStatus.ACTIVE;
  }

  isRescinded(): boolean {
    return this.status === AlertAcknowledgementStatus.RESCINDED;
  }

  rescind(at: Date = new Date()): void {
    this.status = AlertAcknowledgementStatus.RESCINDED;
    this.rescindedAt = at;
  }

  restore(at: Date = new Date()): void {
    this.status = AlertAcknowledgementStatus.ACTIVE;
    this.acknowledgedAt = at;
    this.rescindedAt = null;
  }

  belongsToAccount(accountId: number): boolean {
    return this.accountId === accountId;
  }

  belongsToFiring(alertFiringId: number): boolean {
    return this.alertFiringId === alertFiringId;
  }

  wasCreatedBy(userId: string): boolean {
    return this.normalizeAcknowledgedByUserId() === normalizeShortText(userId, 255);
  }
}
// backend/src/entities/notification_log.entity.ts

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

export enum NotificationDeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  SUPPRESSED = 'suppressed',
  READ = 'read',
}

export type NotificationPayload = Record<string, unknown>;

@Entity('notification_log')
@Index('idx_notification_log_account_id', ['accountId'])
@Index('idx_notification_log_notification_type', ['notificationType'])
@Index('idx_notification_log_channel_status', ['channel', 'status'])
@Index('idx_notification_log_created_at', ['createdAt'])
@Index('idx_notification_log_idempotency_key', ['idempotencyKey'])
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ type: 'varchar', length: 255, name: 'notification_type' })
  notificationType: string;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    name: 'channel',
  })
  channel: NotificationChannel;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'template_key',
    nullable: true,
  })
  templateKey: string | null;

  @Column({
    type: 'enum',
    enum: NotificationDeliveryStatus,
    default: NotificationDeliveryStatus.QUEUED,
  })
  status: NotificationDeliveryStatus;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'idempotency_key',
    nullable: true,
  })
  idempotencyKey: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_message_id',
    nullable: true,
  })
  providerMessageId: string | null;

  @Column({
    type: 'text',
    name: 'error_message',
    nullable: true,
  })
  errorMessage: string | null;

  @Column({
    type: 'timestamptz',
    name: 'scheduled_for',
    nullable: true,
  })
  scheduledFor: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'sent_at',
    nullable: true,
  })
  sentAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'delivered_at',
    nullable: true,
  })
  deliveredAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'read_at',
    nullable: true,
  })
  readAt: Date | null;

  @Column({
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  data: NotificationPayload;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  normalizeNotificationType(): string {
    return String(this.notificationType ?? '').trim().slice(0, 255);
  }

  normalizeTemplateKey(): string | null {
    if (typeof this.templateKey !== 'string') {
      return null;
    }

    const normalized = this.templateKey.trim();
    return normalized.length > 0 ? normalized.slice(0, 255) : null;
  }

  normalizeIdempotencyKey(): string | null {
    if (typeof this.idempotencyKey !== 'string') {
      return null;
    }

    const normalized = this.idempotencyKey.trim();
    return normalized.length > 0 ? normalized.slice(0, 255) : null;
  }

  normalizeProviderMessageId(): string | null {
    if (typeof this.providerMessageId !== 'string') {
      return null;
    }

    const normalized = this.providerMessageId.trim();
    return normalized.length > 0 ? normalized.slice(0, 255) : null;
  }

  normalizeData(): NotificationPayload {
    if (!this.data || typeof this.data !== 'object' || Array.isArray(this.data)) {
      return {};
    }

    return { ...this.data };
  }

  getDataValue<T = unknown>(key: string): T | undefined {
    return this.normalizeData()[key] as T | undefined;
  }

  setDataValue(key: string, value: unknown): void {
    const next = this.normalizeData();
    next[key] = value;
    this.data = next;
  }

  isQueued(): boolean {
    return this.status === NotificationDeliveryStatus.QUEUED;
  }

  isSent(): boolean {
    return this.status === NotificationDeliveryStatus.SENT;
  }

  isDelivered(): boolean {
    return this.status === NotificationDeliveryStatus.DELIVERED;
  }

  isFailed(): boolean {
    return this.status === NotificationDeliveryStatus.FAILED;
  }

  isSuppressed(): boolean {
    return this.status === NotificationDeliveryStatus.SUPPRESSED;
  }

  isRead(): boolean {
    return this.status === NotificationDeliveryStatus.READ;
  }

  isTerminal(): boolean {
    return (
      this.status === NotificationDeliveryStatus.FAILED ||
      this.status === NotificationDeliveryStatus.SUPPRESSED ||
      this.status === NotificationDeliveryStatus.READ
    );
  }

  canTransitionTo(nextStatus: NotificationDeliveryStatus): boolean {
    switch (this.status) {
      case NotificationDeliveryStatus.QUEUED:
        return (
          nextStatus === NotificationDeliveryStatus.SENT ||
          nextStatus === NotificationDeliveryStatus.FAILED ||
          nextStatus === NotificationDeliveryStatus.SUPPRESSED
        );

      case NotificationDeliveryStatus.SENT:
        return (
          nextStatus === NotificationDeliveryStatus.DELIVERED ||
          nextStatus === NotificationDeliveryStatus.FAILED ||
          nextStatus === NotificationDeliveryStatus.SUPPRESSED
        );

      case NotificationDeliveryStatus.DELIVERED:
        return (
          nextStatus === NotificationDeliveryStatus.READ ||
          nextStatus === NotificationDeliveryStatus.FAILED
        );

      case NotificationDeliveryStatus.FAILED:
      case NotificationDeliveryStatus.SUPPRESSED:
      case NotificationDeliveryStatus.READ:
      default:
        return false;
    }
  }

  transitionTo(nextStatus: NotificationDeliveryStatus): void {
    if (!this.canTransitionTo(nextStatus)) {
      throw new Error(
        `Invalid notification status transition: ${this.status} -> ${nextStatus}`,
      );
    }

    this.status = nextStatus;
  }

  scheduleFor(date: Date): void {
    this.scheduledFor = date;
    this.status = NotificationDeliveryStatus.QUEUED;
  }

  markSent(at: Date = new Date(), providerMessageId?: string | null): void {
    if (
      this.status !== NotificationDeliveryStatus.QUEUED &&
      this.status !== NotificationDeliveryStatus.SENT
    ) {
      throw new Error(
        `Cannot mark notification as sent from status ${this.status}`,
      );
    }

    this.status = NotificationDeliveryStatus.SENT;
    this.sentAt = at;
    this.errorMessage = null;

    if (typeof providerMessageId === 'string' && providerMessageId.trim()) {
      this.providerMessageId = providerMessageId.trim().slice(0, 255);
    }
  }

  markDelivered(at: Date = new Date()): void {
    if (
      this.status !== NotificationDeliveryStatus.SENT &&
      this.status !== NotificationDeliveryStatus.DELIVERED
    ) {
      throw new Error(
        `Cannot mark notification as delivered from status ${this.status}`,
      );
    }

    this.status = NotificationDeliveryStatus.DELIVERED;
    this.deliveredAt = at;

    if (!this.sentAt) {
      this.sentAt = at;
    }
  }

  markRead(at: Date = new Date()): void {
    if (
      this.status !== NotificationDeliveryStatus.DELIVERED &&
      this.status !== NotificationDeliveryStatus.READ
    ) {
      throw new Error(
        `Cannot mark notification as read from status ${this.status}`,
      );
    }

    this.status = NotificationDeliveryStatus.READ;
    this.readAt = at;

    if (!this.deliveredAt) {
      this.deliveredAt = at;
    }

    if (!this.sentAt) {
      this.sentAt = at;
    }
  }

  markFailed(errorMessage: string, at: Date = new Date()): void {
    if (
      this.status !== NotificationDeliveryStatus.QUEUED &&
      this.status !== NotificationDeliveryStatus.SENT &&
      this.status !== NotificationDeliveryStatus.DELIVERED
    ) {
      throw new Error(
        `Cannot mark notification as failed from status ${this.status}`,
      );
    }

    const prevStatus = this.status;
    this.status = NotificationDeliveryStatus.FAILED;
    this.errorMessage = String(errorMessage ?? '').trim() || 'Unknown failure';

    if (!this.sentAt && prevStatus !== NotificationDeliveryStatus.QUEUED) {
      this.sentAt = at;
    }
  }

  markSuppressed(reason?: string): void {
    if (
      this.status !== NotificationDeliveryStatus.QUEUED &&
      this.status !== NotificationDeliveryStatus.SENT
    ) {
      throw new Error(
        `Cannot suppress notification from status ${this.status}`,
      );
    }

    this.status = NotificationDeliveryStatus.SUPPRESSED;

    if (typeof reason === 'string' && reason.trim().length > 0) {
      this.errorMessage = reason.trim();
    }
  }

  belongsToAccount(accountId: number): boolean {
    return this.accountId === accountId;
  }
}
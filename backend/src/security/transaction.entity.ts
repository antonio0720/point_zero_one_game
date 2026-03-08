/**
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/transaction.entity.ts
 *
 * Transaction entity used by account transfer friction, founder protection,
 * and downstream abuse / ledger workflows.
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

export enum TransactionStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
  REJECTED = 'REJECTED',
  QUARANTINED = 'QUARANTINED',
  CANCELLED = 'CANCELLED',
}

const bigintNumberTransformer = {
  to(value: number): string {
    if (!Number.isFinite(value)) {
      return '0';
    }

    return Math.trunc(value).toString();
  },

  from(value: string | number | null): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    const parsed = Number.parseInt(String(value ?? '0'), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  },
};

@Entity('transactions')
@Index('idx_transactions_from_account_id', ['fromAccountId'])
@Index('idx_transactions_to_account_id', ['toAccountId'])
@Index('idx_transactions_status', ['status'])
@Index('idx_transactions_created_at', ['createdAt'])
@Index('idx_transactions_from_created_at', ['fromAccountId', 'createdAt'])
@Index('idx_transactions_to_created_at', ['toAccountId', 'createdAt'])
@Index('idx_transactions_from_status_created_at', [
  'fromAccountId',
  'status',
  'createdAt',
])
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'from_account_id' })
  fromAccountId: number;

  @Column({ name: 'to_account_id' })
  toAccountId: number;

  /** Stored in cents (e.g. 50000 = $500.00) */
  @Column({
    type: 'bigint',
    name: 'amount_cents',
    default: 0,
    transformer: bigintNumberTransformer,
  })
  amountCents: number;

  @Column({
    type: 'varchar',
    length: 32,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  normalizeAmountCents(): number {
    if (typeof this.amountCents === 'number') {
      return Number.isFinite(this.amountCents) ? Math.trunc(this.amountCents) : 0;
    }

    if (typeof this.amountCents === 'string') {
      const parsed = Number(this.amountCents);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
    }

    return 0;
  }

  amountUsd(): number {
    return this.normalizeAmountCents() / 100;
  }

  isPending(): boolean {
    return this.status === TransactionStatus.PENDING;
  }

  isAuthorized(): boolean {
    return this.status === TransactionStatus.AUTHORIZED;
  }

  isCompleted(): boolean {
    return this.status === TransactionStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === TransactionStatus.FAILED;
  }

  isRejected(): boolean {
    return this.status === TransactionStatus.REJECTED;
  }

  isQuarantined(): boolean {
    return this.status === TransactionStatus.QUARANTINED;
  }

  isTerminal(): boolean {
    return (
      this.status === TransactionStatus.COMPLETED ||
      this.status === TransactionStatus.FAILED ||
      this.status === TransactionStatus.REVERSED ||
      this.status === TransactionStatus.REJECTED ||
      this.status === TransactionStatus.CANCELLED
    );
  }

  isOutboundForAccount(accountId: number): boolean {
    return this.fromAccountId === accountId;
  }

  isInboundForAccount(accountId: number): boolean {
    return this.toAccountId === accountId;
  }

  touchesAccount(accountId: number): boolean {
    return this.fromAccountId === accountId || this.toAccountId === accountId;
  }

  isSelfTransfer(): boolean {
    return this.fromAccountId === this.toAccountId;
  }

  markAuthorized(): void {
    this.status = TransactionStatus.AUTHORIZED;
  }

  markCompleted(): void {
    this.status = TransactionStatus.COMPLETED;
  }

  markFailed(): void {
    this.status = TransactionStatus.FAILED;
  }

  markRejected(): void {
    this.status = TransactionStatus.REJECTED;
  }

  markReversed(): void {
    this.status = TransactionStatus.REVERSED;
  }

  markQuarantined(): void {
    this.status = TransactionStatus.QUARANTINED;
  }

  markCancelled(): void {
    this.status = TransactionStatus.CANCELLED;
  }

  canTransitionTo(nextStatus: TransactionStatus): boolean {
    switch (this.status) {
      case TransactionStatus.PENDING:
        return (
          nextStatus === TransactionStatus.AUTHORIZED ||
          nextStatus === TransactionStatus.COMPLETED ||
          nextStatus === TransactionStatus.FAILED ||
          nextStatus === TransactionStatus.REJECTED ||
          nextStatus === TransactionStatus.QUARANTINED ||
          nextStatus === TransactionStatus.CANCELLED
        );

      case TransactionStatus.AUTHORIZED:
        return (
          nextStatus === TransactionStatus.COMPLETED ||
          nextStatus === TransactionStatus.FAILED ||
          nextStatus === TransactionStatus.REJECTED ||
          nextStatus === TransactionStatus.QUARANTINED ||
          nextStatus === TransactionStatus.CANCELLED
        );

      case TransactionStatus.COMPLETED:
        return nextStatus === TransactionStatus.REVERSED;

      case TransactionStatus.QUARANTINED:
        return (
          nextStatus === TransactionStatus.REJECTED ||
          nextStatus === TransactionStatus.FAILED ||
          nextStatus === TransactionStatus.CANCELLED
        );

      case TransactionStatus.FAILED:
      case TransactionStatus.REVERSED:
      case TransactionStatus.REJECTED:
      case TransactionStatus.CANCELLED:
      default:
        return false;
    }
  }

  transitionTo(nextStatus: TransactionStatus): void {
    if (!this.canTransitionTo(nextStatus)) {
      throw new Error(
        `Invalid transaction status transition: ${this.status} -> ${nextStatus}`,
      );
    }

    this.status = nextStatus;
  }

  static normalizeAmountCents(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.trunc(value) : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
    }

    return 0;
  }
}
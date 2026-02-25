///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/transaction.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'from_account_id' })
  fromAccountId: number;

  @Column({ name: 'to_account_id' })
  toAccountId: number;

  /** Stored in cents (e.g. 50000 = $500.00) */
  @Column({ type: 'bigint', name: 'amount_cents', default: 0 })
  amountCents: number;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
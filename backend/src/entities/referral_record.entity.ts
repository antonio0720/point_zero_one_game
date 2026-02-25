import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('referral_records')
export class ReferralRecord {
  @PrimaryGeneratedColumn()
  id: number;

  /** The player who owns / generated this referral code */
  @Column({ type: 'varchar', length: 16, name: 'owner_id' })
  ownerId: string;

  /** Unique referral code distributed to prospects */
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  /** Whether the code is still redeemable */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** Total successful redemptions — incremented atomically on each join */
  @Column({ type: 'int', name: 'successful_invites', default: 0 })
  successfulInvites: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

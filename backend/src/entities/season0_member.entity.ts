import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('season0_members')
export class Season0Member {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  playerId: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 16, name: 'season0_token', unique: true })
  season0Token: string;

  @Column({ type: 'varchar', length: 16, name: 'founding_pass_id' })
  foundingPassId: string;

  @Column({ type: 'varchar', length: 32, default: 'founding' })
  tier: string;

  @Column({ type: 'boolean', name: 'community_access', default: true })
  communityAccess: boolean;

  @Column({ type: 'timestamptz', name: 'joined_at' })
  joinedAt: Date;

  @Column({ type: 'varchar', length: 16, name: 'referred_by', nullable: true })
  referredBy: string | null;

  /** JSON array of { date, type, detail } objects */
  @Column({ type: 'jsonb', name: 'transaction_history', default: [] })
  transactionHistory: Array<{ date: string; type: string; detail: string }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

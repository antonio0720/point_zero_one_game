///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/device.entity.ts


import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  /** SHA-256 of IP + User-Agent + Accept-Language */
  @Column({ type: 'varchar', length: 64, nullable: true })
  fingerprint: string | null;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 256, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'timestamptz', name: 'last_seen_at', nullable: true })
  lastSeenAt: Date | null;

  @Column({ type: 'timestamptz', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
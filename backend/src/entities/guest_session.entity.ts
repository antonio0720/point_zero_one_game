/**
 * GuestSession entity — PostgreSQL via TypeORM.
 * Replaces mongoose GuestSession model.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('guest_sessions')
@Index('idx_guest_sessions_device', ['deviceUa', 'deviceIp'])
export class GuestSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 512, name: 'device_ua', default: '' })
  deviceUa: string;

  @Column({ type: 'varchar', length: 45, name: 'device_ip', default: '' })
  deviceIp: string;

  @Column({ type: 'jsonb', name: 'run_history', default: () => "'[]'::jsonb" })
  runHistory: unknown[];

  @Column({ type: 'uuid', name: 'upgraded_to_id', nullable: true })
  upgradedToId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

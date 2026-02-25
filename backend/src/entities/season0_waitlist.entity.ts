import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('season0_waitlist_entries')
export class Season0WaitlistEntry {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * '__COUNTER__' is the sentinel row used for atomic position increment.
   * All real members have their actual playerId here.
   */
  @Column({ type: 'varchar', length: 16, name: 'player_id', unique: true })
  playerId: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'timestamptz', name: 'joined_at', nullable: true })
  joinedAt: Date | null;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

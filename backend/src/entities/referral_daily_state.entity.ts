//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/entities/referral_daily_state.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('referral_daily_states')
export class ReferralDailyState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 16, name: 'player_id' })
  playerId: string;

  /** UTC midnight of the day this record covers */
  @Column({ type: 'timestamptz', name: 'day_start' })
  dayStart: Date;

  /** Number of invites sent today */
  @Column({ type: 'int', name: 'daily_count', default: 0 })
  dailyCount: number;

  /** Timestamp of the most recent invite — used for escalating cooldown calc */
  @Column({ type: 'timestamptz', name: 'last_invite_at', nullable: true })
  lastInviteAt: Date | null;

  /** Manual suppression flag — set by suppressPlayer() on abuse detection */
  @Column({ type: 'boolean', default: false })
  suppressed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
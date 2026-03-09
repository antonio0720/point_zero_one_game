/**
 * DailyChallenge + DailyChallengeEntry entities — PostgreSQL via TypeORM.
 * Replaces mongoose DailyChallenge model.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('daily_challenges')
export class DailyChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  seed: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  scenario: string;

  @Column({ type: 'date', name: 'challenge_date', unique: true })
  challengeDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('daily_challenge_entries')
@Index('idx_daily_challenge_entries_player', ['playerId'])
@Index('idx_daily_challenge_entries_completed', ['challengeId', 'completed'])
export class DailyChallengeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'challenge_id' })
  challengeId: string;

  @ManyToOne(() => DailyChallenge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challenge_id' })
  challenge: DailyChallenge;

  @Column({ type: 'varchar', length: 64, name: 'player_id' })
  playerId: string;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

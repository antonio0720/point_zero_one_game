/**
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/entities/leaderboard.entity.ts
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type LeaderboardVisibility = 'PUBLIC' | 'OWNER_ONLY';

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

@Entity('leaderboard_entries')
@Index('idx_leaderboard_entries_game_pending', ['gameId', 'isPending'])
@Index('idx_leaderboard_entries_game_placement', ['gameId', 'placement'])
export class LeaderboardEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, name: 'game_id' })
  gameId: string;

  @Column({ type: 'varchar', length: 64, name: 'season_id', nullable: true })
  seasonId: string | null;

  @Column({ type: 'varchar', length: 64, name: 'ladder_id', nullable: true })
  ladderId: string | null;

  @Column({ type: 'varchar', length: 64, name: 'user_id' })
  userId: string;

  @Column({
    type: 'bigint',
    transformer: bigintNumberTransformer,
  })
  score: number;

  @Column({ type: 'int' })
  placement: number;

  @Column({ type: 'boolean', name: 'is_pending', default: false })
  isPending: boolean;

  @Column({ type: 'boolean', name: 'is_verified', default: true })
  isVerified: boolean;

  @Column({ type: 'varchar', length: 16, default: 'PUBLIC' })
  visibility: LeaderboardVisibility;

  @Column({ type: 'timestamptz', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
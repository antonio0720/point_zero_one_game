import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('season0_membership_states')
export class Season0MembershipState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 16, name: 'player_id', unique: true })
  playerId: string;

  // ── Streak ──────────────────────────────────────────────────────────────────
  @Column({ type: 'int', name: 'streak_current', default: 0 })
  streakCurrent: number;

  @Column({ type: 'int', name: 'streak_longest', default: 0 })
  streakLongest: number;

  // ── Freezes ─────────────────────────────────────────────────────────────────
  @Column({ type: 'int', name: 'freezes_remaining', default: 3 })
  freezesRemaining: number;

  /** ISO date strings of when freezes were used */
  @Column({ type: 'jsonb', name: 'freeze_history', default: [] })
  freezeHistory: string[];

  // ── Acts ────────────────────────────────────────────────────────────────────
  /** Acts completed in order: Claim → Build → Grow → Reign */
  @Column({ type: 'jsonb', name: 'act_completed', default: [] })
  actCompleted: string[];

  @Column({ type: 'varchar', length: 32, name: 'current_act', default: 'Claim' })
  currentAct: string;

  // ── Grace ───────────────────────────────────────────────────────────────────
  @Column({ type: 'boolean', name: 'grace_active', default: false })
  graceActive: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

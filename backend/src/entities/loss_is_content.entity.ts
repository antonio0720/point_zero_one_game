/**
 * Loss Is Content — Postgres entities via TypeORM.
 * Replaces mongoose models for autopsy, cause_of_death, eligibility_lock, training.
 */

import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('autopsy_snippets')
@Index('idx_autopsy_snippets_run', ['runId'])
export class AutopsySnippet {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'run_id' }) runId: string;
  @Column({ type: 'text' }) snippet: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('causes_of_death')
export class CauseOfDeath {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255, unique: true }) name: string;
  @Column({ type: 'text', default: '' }) description: string;
}

@Entity('eligibility_locks')
@Index('idx_eligibility_locks_user', ['userId'])
export class EligibilityLock {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'game_id' }) gameId: string;
  @Column({ type: 'varchar', length: 64, name: 'user_id' }) userId: string;
  @Column({ type: 'boolean', name: 'practice_mode', default: false }) practiceMode: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('training_scenarios')
@Index('idx_training_scenarios_stage', ['stage', 'shortLaunchable'])
export class TrainingScenario {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 64 }) stage: string;
  @Column({ type: 'boolean', name: 'short_launchable', default: true }) shortLaunchable: boolean;
  @Column({ type: 'text', default: '' }) description: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

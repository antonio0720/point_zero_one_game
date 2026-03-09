/**
 * Tier 2 remaining entities — Postgres via TypeORM.
 * Pivotal turns, after-action, autopsy, stamp variants, host sessions, telemetry schemas.
 */

import {
  Column, CreateDateColumn, Entity, Index, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';

// ── Pivotal Turns ────────────────────────────────────────────────────

@Entity('pivotal_turns')
@Index('idx_pivotal_turns_run', ['runId'])
export class PivotalTurn {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'run_id' }) runId: string;
  @Column({ type: 'int', name: 'turn_number' }) turnNumber: number;
  @Column({ type: 'jsonb', name: 'delta_snapshot', default: () => "'{}'::jsonb" }) deltaSnapshot: Record<string, unknown>;
  @Column({ type: 'double precision', name: 'ml_score', default: 0 }) mlScore: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('pivot_rulesets')
export class PivotRuleset {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 128, unique: true }) hash: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) rules: unknown[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── After-Action / Autopsy ───────────────────────────────────────────

@Entity('replay_suggestions')
@Index('idx_replay_suggestions_player', ['playerId'])
export class ReplaySuggestion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'player_id' }) playerId: string;
  @Column({ type: 'varchar', length: 128, name: 'failure_mode' }) failureMode: string;
  @Column({ type: 'uuid', name: 'scenario_id', nullable: true }) scenarioId: string | null;
  @Column({ type: 'double precision', name: 'novelty_score', default: 0 }) noveltyScore: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('after_autopsy_reports')
@Index('idx_after_autopsy_run', ['runId'])
export class AfterAutopsyReport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'run_id' }) runId: string;
  @Column({ type: 'uuid', name: 'cause_of_death_id', nullable: true }) causeOfDeathId: string | null;
  @Column({ type: 'boolean', name: 'barely_lived', default: false }) barelyLived: boolean;
  @Column({ type: 'text', default: '' }) insight: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('counterfactual_sims')
@Index('idx_counterfactual_run', ['runId'])
export class CounterfactualSim {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'run_id' }) runId: string;
  @Column({ type: 'int', name: 'fork_turn' }) forkTurn: number;
  @Column({ type: 'varchar', length: 64, name: 'alternate_outcome', default: '' }) alternateOutcome: string;
  @Column({ type: 'jsonb', name: 'outcome_delta', default: () => "'{}'::jsonb" }) outcomeDelta: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('fork_turns')
@Index('idx_fork_turns_run', ['runId'])
export class ForkTurn {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'run_id' }) runId: string;
  @Column({ type: 'int', name: 'turn_number' }) turnNumber: number;
  @Column({ type: 'varchar', length: 128, name: 'original_choice', default: '' }) originalChoice: string;
  @Column({ type: 'varchar', length: 128, name: 'alternate_choice', default: '' }) alternateChoice: string;
  @Column({ type: 'jsonb', name: 'outcome_delta', default: () => "'{}'::jsonb" }) outcomeDelta: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Stamp Variants ───────────────────────────────────────────────────

@Entity('stamp_variants')
@Index('idx_stamp_variants_stamp', ['stampId'])
export class StampVariant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'stamp_id' }) stampId: string;
  @Column({ type: 'int', name: 'visual_tier', default: 1 }) visualTier: number;
  @Column({ type: 'int', name: 'streak_count', default: 0 }) streakCount: number;
  @Column({ type: 'int', name: 'referral_count', default: 0 }) referralCount: number;
  @Column({ type: 'timestamptz', name: 'evolved_at', default: () => 'NOW()' }) evolvedAt: Date;
}

// ── Host Sessions ────────────────────────────────────────────────────

@Entity('host_sessions')
@Index('idx_host_sessions_host', ['hostId'])
export class HostSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'host_id' }) hostId: string;
  @Column({ type: 'varchar', length: 64, name: 'game_session_id' }) gameSessionId: string;
  @Column({ type: 'jsonb', name: 'moment_captures', default: () => "'[]'::jsonb" }) momentCaptures: unknown[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Telemetry Schemas ────────────────────────────────────────────────

@Entity('telemetry_schemas')
export class TelemetrySchema {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 128 }) name: string;
  @Column({ type: 'int', default: 1 }) version: number;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) definition: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

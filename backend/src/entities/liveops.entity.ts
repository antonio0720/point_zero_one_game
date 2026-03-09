/**
 * Liveops — Postgres entities via TypeORM.
 * Replaces mongoose models across alerting, deal_engine, ops_board,
 * patch_notes, proof_of_week, verification_health, weekly_challenge.
 */

import {
  Column, CreateDateColumn, Entity, Index, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('liveops_alerts')
@Index('idx_liveops_alerts_game', ['gameId', 'severity'])
export class LiveopsAlert {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'game_id' }) gameId: string;
  @Column({ type: 'smallint', default: 1 }) severity: number;
  @Column({ type: 'varchar', length: 64, name: 'alert_type', default: 'health' }) alertType: string;
  @Column({ type: 'text', default: '' }) message: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) data: Record<string, unknown>;
  @Column({ type: 'varchar', length: 512, name: 'runbook_link', nullable: true }) runbookLink: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('notification_sinks')
export class NotificationSink {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'sink_type' }) sinkType: string;
  @Column({ type: 'varchar', length: 512, nullable: true }) url: string | null;
  @Column({ type: 'varchar', length: 512, name: 'api_key', nullable: true }) apiKey: string | null;
  @Column({ type: 'int', name: 'rate_limit', default: 60 }) rateLimit: number;
  @Column({ type: 'timestamptz', name: 'last_sent_at', nullable: true }) lastSentAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('opportunities')
export class Opportunity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'double precision', default: 0 }) score: number;
  @Column({ type: 'boolean', default: false }) published: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('anomalies')
@Index('idx_anomalies_game_type', ['gameId', 'anomalyType'])
export class Anomaly {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'game_id' }) gameId: string;
  @Column({ type: 'varchar', length: 64, name: 'anomaly_type' }) anomalyType: string;
  @Column({ type: 'double precision', default: 0 }) value: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('daily_snapshots')
export class DailySnapshot {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'date', name: 'snapshot_date', unique: true }) snapshotDate: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'jsonb', name: 'drilldown_links', default: () => "'[]'::jsonb" }) drilldownLinks: string[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('patch_notes')
@Index('idx_patch_notes_card', ['cardId'])
export class PatchNote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'card_id' }) cardId: string;
  @Column({ type: 'int', default: 1 }) version: number;
  @Column({ type: 'boolean', default: false }) rollout: boolean;
  @Column({ type: 'text' }) content: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('patch_note_views')
export class PatchNoteView {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'user_id' }) userId: string;
  @Column({ type: 'uuid', name: 'patch_note_id' }) patchNoteId: string;
  @ManyToOne(() => PatchNote, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patch_note_id' }) patchNote: PatchNote;
  @Column({ type: 'timestamptz', name: 'viewed_at', default: () => 'NOW()' }) viewedAt: Date;
}

@Entity('proof_of_week')
@Index('idx_proof_of_week_week', ['weekStart'])
export class ProofOfWeek {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'game_run_id' }) gameRunId: string;
  @Column({ type: 'double precision', name: 'impact_score', default: 0 }) impactScore: number;
  @Column({ type: 'boolean', default: false }) verified: boolean;
  @Column({ type: 'double precision', name: 'share_rate', default: 0 }) shareRate: number;
  @Column({ type: 'date', name: 'week_start' }) weekStart: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('weekly_challenges')
export class WeeklyChallenge {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255 }) scenario: string;
  @Column({ type: 'varchar', length: 255, name: 'constraint_', nullable: true }) constraint_: string | null;
  @Column({ type: 'date', name: 'week_start' }) weekStart: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('weekly_challenge_entries')
@Index('idx_wce_player', ['playerId'])
export class WeeklyChallengeEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'challenge_id' }) challengeId: string;
  @ManyToOne(() => WeeklyChallenge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challenge_id' }) challenge: WeeklyChallenge;
  @Column({ type: 'varchar', length: 64, name: 'player_id' }) playerId: string;
  @Column({ type: 'int', default: 0 }) score: number;
  @Column({ type: 'boolean', default: false }) completed: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

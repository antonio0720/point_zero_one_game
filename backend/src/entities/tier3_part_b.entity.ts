/**
 * Tier 3 Entities — Part B
 * Curriculum, episodes, events, experiments, generational, integrity,
 * moderation, monetization, partners, licensing, referrals, share_engine, UGC, misc
 */
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// ── Curriculum ───────────────────────────────────────────────────────

@Entity('curriculum_orgs')
export class CurriculumOrg {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 128, unique: true }) slug: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('curriculum_cohorts')
export class CurriculumCohort {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'org_id' }) orgId: string;
  @ManyToOne(() => CurriculumOrg, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'org_id' }) org: CurriculumOrg;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('sso_hooks')
export class SsoHook {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'institution_id' }) institutionId: string;
  @Column({ type: 'varchar', length: 64, name: 'sso_provider' }) ssoProvider: string;
  @Column({ type: 'varchar', length: 255, name: 'sso_client_id' }) ssoClientId: string;
  @Column({ type: 'varchar', length: 512, name: 'sso_callback_url' }) ssoCallbackUrl: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Episodes ─────────────────────────────────────────────────────────

@Entity('episode_version_pins')
export class EpisodeVersionPin {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'episode_id' }) episodeId: string;
  @Column({ type: 'int', default: 1 }) version: number;
  @Column({ type: 'varchar', length: 128, name: 'content_hash', default: '' }) contentHash: string;
  @Column({ type: 'timestamptz', name: 'pinned_at', default: () => 'NOW()' }) pinnedAt: Date;
}

// ── Events (Founder Night) ───────────────────────────────────────────

@Entity('founder_night_events')
export class FounderNightEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255, name: 'event_name' }) eventName: string;
  @Column({ type: 'int', default: 0 }) season: number;
  @Column({ type: 'jsonb', name: 'event_data', default: () => "'{}'::jsonb" }) eventData: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Experiments ──────────────────────────────────────────────────────

@Entity('experiments')
export class Experiment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'text', default: '' }) description: string;
  @Column({ type: 'varchar', length: 32, default: 'active' }) status: string;
  @Column({ type: 'timestamptz', name: 'start_date', default: () => 'NOW()' }) startDate: Date;
  @Column({ type: 'timestamptz', name: 'end_date', nullable: true }) endDate: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Generational (Bloodlines) ────────────────────────────────────────

@Entity('bloodlines')
@Index('idx_bloodlines_player', ['playerId'])
export class Bloodline {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'player_id' }) playerId: string;
  @Column({ type: 'int', default: 1 }) generation: number;
  @Column({ type: 'varchar', length: 64, name: 'run_id', nullable: true }) runId: string | null;
  @Column({ type: 'int', default: 0 }) outcome: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Integrity / Moderation ───────────────────────────────────────────

@Entity('transparency_rollups')
export class TransparencyRollup {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'date', name: 'period_start' }) periodStart: string;
  @Column({ type: 'date', name: 'period_end' }) periodEnd: string;
  @Column({ type: 'jsonb', name: 'rollup_data', default: () => "'{}'::jsonb" }) rollupData: Record<string, unknown>;
  @Column({ type: 'jsonb', name: 'redaction_rules', default: () => "'[]'::jsonb" }) redactionRules: unknown[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('appeals')
@Index('idx_appeals_user', ['userId', 'status'])
export class Appeal {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'user_id' }) userId: string;
  @Column({ type: 'text', default: '' }) reason: string;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: string;
  @Column({ type: 'text', nullable: true }) outcome: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('moderation_actions')
export class ModerationAction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'target_id' }) targetId: string;
  @Column({ type: 'varchar', length: 64, name: 'action_type' }) actionType: string;
  @Column({ type: 'text', default: '' }) reason: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('sku_tags')
export class SkuTag {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 128, unique: true }) tag: string;
}

// ── Partners ─────────────────────────────────────────────────────────

@Entity('partner_enrollments')
export class PartnerEnrollment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'partner_id' }) partnerId: string;
  @Column({ type: 'varchar', length: 64, name: 'cohort_id', nullable: true }) cohortId: string | null;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('partner_rollups')
export class PartnerRollup {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'partner_id' }) partnerId: string;
  @Column({ type: 'varchar', length: 32 }) period: string;
  @Column({ type: 'jsonb', name: 'rollup_data', default: () => "'{}'::jsonb" }) rollupData: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Licensing Control Plane ──────────────────────────────────────────

@Entity('lcp_cohorts')
export class LcpCohort {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'jsonb', name: 'schedule_window', default: () => "'{}'::jsonb" }) scheduleWindow: Record<string, unknown>;
  @Column({ type: 'jsonb', name: 'ladder_policy', default: () => "'{}'::jsonb" }) ladderPolicy: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('lcp_export_jobs')
export class LcpExportJob {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 32, name: 'job_type', default: 'pdf' }) jobType: string;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: string;
  @Column({ type: 'varchar', length: 512, name: 'signed_url', nullable: true }) signedUrl: string | null;
  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true }) expiresAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('lcp_packs')
export class LcpPack {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'institution_id' }) institutionId: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'boolean', name: 'is_published', default: false }) isPublished: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Referrals ────────────────────────────────────────────────────────

@Entity('referral_codes')
@Index('idx_referral_codes_owner', ['ownerId'])
export class ReferralCode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, unique: true }) code: string;
  @Column({ type: 'varchar', length: 64, name: 'owner_id' }) ownerId: string;
  @Column({ type: 'boolean', default: false }) used: boolean;
  @Column({ type: 'varchar', length: 64, name: 'used_by', nullable: true }) usedBy: string | null;
  @Column({ type: 'int', name: 'runs_count', default: 0 }) runsCount: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('referral_reward_unlocks')
export class ReferralRewardUnlock {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'referral_id' }) referralId: string;
  @ManyToOne(() => ReferralCode, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'referral_id' }) referral: ReferralCode;
  @Column({ type: 'varchar', length: 64, name: 'cosmetic_variant_id', nullable: true }) cosmeticVariantId: string | null;
  @Column({ type: 'varchar', length: 64, name: 'stamp_variant_id', nullable: true }) stampVariantId: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('referral_receipts')
export class ReferralReceipt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'referral_id' }) referralId: string;
  @ManyToOne(() => ReferralCode, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'referral_id' }) referral: ReferralCode;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Share Engine ─────────────────────────────────────────────────────

@Entity('clip_metadata')
@Index('idx_clip_metadata_run', ['runId'])
@Index('idx_clip_metadata_status', ['status'])
export class ClipMetadata {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'run_id' }) runId: string;
  @Column({ type: 'varchar', length: 64, name: 'moment_type' }) momentType: string;
  @Column({ type: 'int', name: 'turn_start' }) turnStart: number;
  @Column({ type: 'int', name: 'turn_end' }) turnEnd: number;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('share_artifacts')
export class ShareArtifact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'game_session_id' }) gameSessionId: string;
  @Column({ type: 'jsonb', name: 'og_meta', default: () => "'{}'::jsonb" }) ogMeta: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── UGC ──────────────────────────────────────────────────────────────

@Entity('ugc_artifacts')
export class UgcArtifact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'creator_id' }) creatorId: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) data: Record<string, unknown>;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('ugc_submissions')
export class UgcSubmission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'artifact_id' }) artifactId: string;
  @ManyToOne(() => UgcArtifact, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'artifact_id' }) artifact: UgcArtifact;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('ugc_sim_checks')
export class UgcSimCheck {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'replay_id' }) replayId: string;
  @Column({ type: 'varchar', length: 128, name: 'original_replay_hash' }) originalReplayHash: string;
  @Column({ type: 'varchar', length: 128, name: 'simulated_replay_hash' }) simulatedReplayHash: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) differences: string[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Misc ─────────────────────────────────────────────────────────────

@Entity('ranked_compat')
export class RankedCompat {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'player_id' }) playerId: string;
  @Column({ type: 'varchar', length: 64, name: 'run_id' }) runId: string;
  @Column({ type: 'boolean', default: false }) eligible: boolean;
  @Column({ type: 'varchar', length: 64, default: '' }) entitlement: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('policy_scans')
export class PolicyScan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) tags: string[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) assets: string[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('run_visibility')
export class RunVisibility {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'run_id', unique: true }) runId: string;
  @Column({ type: 'varchar', length: 64, name: 'user_id' }) userId: string;
  @Column({ type: 'varchar', length: 32, default: 'public' }) visibility: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('revshare_ledger')
@Index('idx_revshare_ledger_game', ['gameId'])
export class RevshareLedger {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'game_id' }) gameId: string;
  @Column({ type: 'varchar', length: 64, name: 'engagement_id' }) engagementId: string;
  @Column({ type: 'int' }) period: number;
  @Column({ type: 'double precision', default: 0 }) amount: number;
  @Column({ type: 'varchar', length: 128, name: 'receipt_hash', nullable: true }) receiptHash: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('sandbox_lanes')
export class SandboxLane {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'private_id' }) privateId: string;
  @Column({ type: 'varchar', length: 64, name: 'cohort_id', nullable: true }) cohortId: string | null;
  @Column({ type: 'varchar', length: 64, name: 'event_id', nullable: true }) eventId: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('sentiment_state')
@Index('idx_sentiment_player', ['playerId'])
export class SentimentState {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'player_id' }) playerId: string;
  @Column({ type: 'double precision', name: 'sentiment_score', default: 0 }) sentimentScore: number;
  @Column({ type: 'boolean', name: 'empathy_mode', default: false }) empathyMode: boolean;
  @Column({ type: 'jsonb', name: 'history_window', default: () => "'[]'::jsonb" }) historyWindow: unknown[];
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('toxicity_scans')
export class ToxicityScan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'content_id' }) contentId: string;
  @Column({ type: 'varchar', length: 32, name: 'scan_type', default: 'text' }) scanType: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) result: Record<string, unknown>;
  @Column({ type: 'boolean', default: false }) flagged: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

/**
 * Tier 3 Entities — Part A
 * B2B, biometric, card_forge, commerce, companion, creator_profiles
 */
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

// ── B2B ──────────────────────────────────────────────────────────────

@Entity('b2b_tenants')
export class B2BTenant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 512, name: 'sso_idp_url', nullable: true }) ssoIdpUrl: string | null;
  @Column({ type: 'varchar', length: 255, name: 'sso_client_id', nullable: true }) ssoClientId: string | null;
  @Column({ type: 'varchar', length: 512, name: 'sso_client_secret', nullable: true }) ssoClientSecret: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('b2b_seats')
@Index('idx_b2b_seats_tenant', ['tenantId'])
export class B2BSeat {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId: string;
  @ManyToOne(() => B2BTenant, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tenant_id' }) tenant: B2BTenant;
  @Column({ type: 'varchar', length: 255, name: 'user_email', nullable: true }) userEmail: string | null;
  @Column({ type: 'boolean', default: false }) assigned: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('wellness_analytics')
@Index('idx_wellness_org', ['organizationId'])
export class WellnessAnalytics {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'organization_id' }) organizationId: string;
  @Column({ type: 'double precision', name: 'survival_rate', default: 0 }) survivalRate: number;
  @Column({ type: 'varchar', length: 64, name: 'failure_mode', default: 'Financial' }) failureMode: string;
  @Column({ type: 'double precision', name: 'risk_literacy_score', default: 0 }) riskLiteracyScore: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Biometric ────────────────────────────────────────────────────────

@Entity('biometric_events')
@Index('idx_biometric_card', ['cardId'])
export class BiometricEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'card_id' }) cardId: string;
  @Column({ type: 'double precision', name: 'stress_delta', default: 0 }) stressDelta: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Card Forge ───────────────────────────────────────────────────────

@Entity('community_cards')
@Index('idx_community_cards_creator', ['creatorId'])
export class CommunityCard {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'creator_id' }) creatorId: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'int', default: 0 }) price: number;
  @Column({ type: 'int', name: 'games_played', default: 0 }) gamesPlayed: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('death_screen_triggers')
export class DeathScreenTrigger {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'account_id', unique: true }) accountId: string;
  @Column({ type: 'int', name: 'deaths_count', default: 0 }) deathsCount: number;
  @Column({ type: 'int', name: 'account_age_sec', default: 0 }) accountAgeSec: number;
  @Column({ type: 'boolean', name: 'is_rate_limited', default: false }) isRateLimited: boolean;
  @Column({ type: 'timestamptz', name: 'last_death_at', default: () => 'NOW()' }) lastDeathAt: Date;
}

@Entity('gauntlet_votes')
@Index('idx_gauntlet_votes_sub', ['submissionId'])
export class GauntletVote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'submission_id' }) submissionId: string;
  @Column({ type: 'varchar', length: 64, name: 'voter_id' }) voterId: string;
  @Column({ type: 'varchar', length: 32, name: 'vote_type' }) voteType: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Commerce Entitlements ────────────────────────────────────────────

@Entity('entitlement_compat')
@Index('idx_entitlement_compat_tax', ['taxonomyId'])
export class EntitlementCompat {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'taxonomy_id' }) taxonomyId: string;
  @Column({ type: 'varchar', length: 64, name: 'entitlement_id' }) entitlementId: string;
  @Column({ type: 'int', default: 0 }) rank: number;
  @Column({ type: 'jsonb', name: 'compatible_with', default: () => "'[]'::jsonb" }) compatibleWith: string[];
}

// ── Companion ────────────────────────────────────────────────────────

@Entity('card_scans')
export class CardScan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, name: 'card_id', unique: true }) cardId: string;
  @Column({ type: 'text', name: 'consequence_explanation', default: '' }) consequenceExplanation: string;
  @Column({ type: 'text', name: 'real_life_principle', default: '' }) realLifePrinciple: string;
  @Column({ type: 'jsonb', name: 'scenario_variants', default: () => "'[]'::jsonb" }) scenarioVariants: unknown[];
  @Column({ type: 'jsonb', name: 'post_game_metrics_prompt', default: () => "'{}'::jsonb" }) postGameMetricsPrompt: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Creator Profiles ─────────────────────────────────────────────────

@Entity('creator_permissions')
export class CreatorPermission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64 }) level: string;
  @Column({ type: 'varchar', length: 64, name: 'publish_type' }) publishType: string;
  @Column({ type: 'boolean', name: 'can_publish', default: false }) canPublish: boolean;
}

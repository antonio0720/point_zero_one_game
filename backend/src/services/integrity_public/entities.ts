//backend/src/services/integrity_public/entities.ts

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

// ── GameEvent ─────────────────────────────────────────────────────────────────

@Entity('game_events')
export class GameEvent {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'total_assets' })
  totalAssets: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'total_liabilities' })
  totalLiabilities: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'net_worth' })
  netWorth: number;

  @Column({ type: 'timestamptz' })
  timestamp: Date;
}

// ── VerificationSummary ───────────────────────────────────────────────────────

@Entity('verification_summaries')
export class VerificationSummary {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'game_event_id', unique: true })
  gameEventId: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'total_assets' })
  totalAssets: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'total_liabilities' })
  totalLiabilities: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'net_worth' })
  netWorth: number;

  @Column({ type: 'timestamptz' })
  timestamp: Date;
}

// ── TransparencyRollup ────────────────────────────────────────────────────────

@Entity('transparency_rollups')
export class TransparencyRollup {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'verification_summary_id' })
  verificationSummaryId: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'total_assets' })
  totalAssets: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'total_liabilities' })
  totalLiabilities: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'net_worth' })
  netWorth: number;

  /** Delta vs most recent prior rollup — used for public trend endpoint */
  @Column({ type: 'numeric', precision: 20, scale: 4, name: 'net_worth_delta', default: 0 })
  netWorthDelta: number;

  @Column({ type: 'timestamptz' })
  timestamp: Date;
}

// ── Appeal ────────────────────────────────────────────────────────────────────

@Entity('appeals')
export class Appeal {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'transparency_rollup_id' })
  transparencyRollupId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 32, name: 'reason_category' })
  reasonCategory: string;

  @Column({ type: 'varchar', length: 2048, name: 'attachment_url', nullable: true })
  attachmentUrl: string | null;

  @Column({ type: 'uuid', name: 'run_id', nullable: true })
  runId: string | null;

  /** State machine: SUBMITTED → UNDER_REVIEW → RESOLVED */
  @Column({ type: 'varchar', length: 16, default: 'SUBMITTED' })
  status: string;

  /** Immutable SHA-256 receipt chain — one entry per status transition */
  @Column({ type: 'jsonb', name: 'receipt_chain', default: [] })
  receiptChain: string[];

  @Column({ type: 'uuid', name: 'reviewer_id', nullable: true })
  reviewerId: string | null;

  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @Column({ type: 'timestamptz' })
  timestamp: Date;
}
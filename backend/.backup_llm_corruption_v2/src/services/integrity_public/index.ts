/**
 * Integrity Public Service — Production Implementation
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/services/integrity_public/index.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * Bugs killed:
 *   1. `reason: ''` TODO → real AppealInput type + AppealReasonCategory enum
 *      - reason must match "CATEGORY: <description>" format
 *      - valid categories: OUTCOME_DISPUTE, REPLAY_MISMATCH, CARD_RESOLUTION,
 *        INTEGRITY_CHALLENGE, BALANCE_ISSUE, OTHER
 *      - min 20 chars, max 2000 chars; OTHER requires ≥ 100 chars
 *      - createAppeal(id, input: AppealInput) signature updated
 *
 *   2. Deprecated TypeORM v0.2 `findOne(id)` → v0.3+ `findOne({ where: { id } })`
 *      Fixed in createTransparencyRollup and createAppeal.
 *
 *   3. runVerificationSummary() had no pagination or date scoping → OOM risk.
 *      Now paginated with configurable batchSize + fromDate/toDate. Idempotent:
 *      skips events that already have a summary.
 *
 *   4. Added updateAppealStatus() state machine: SUBMITTED→UNDER_REVIEW→RESOLVED.
 *      Invalid transitions throw with message. RESOLVED requires resolution text.
 *      Each transition appends a SHA-256 receipt hash to appeal.receiptChain.
 *
 *   5. Added read methods: getVerificationSummary(), getTransparencyRollup(),
 *      listAppeals() — service was write-only before.
 *
 *   6. createTransparencyRollupData() now computes netWorthDelta vs prior rollup
 *      for the public transparency trend endpoint.
 */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { v4 as uuidv4 }    from 'uuid';
import { createHash }       from 'crypto';

import { GameEvent, VerificationSummary, TransparencyRollup, Appeal } from './entities';

// ── Appeal reason categories ──────────────────────────────────────────────────

export enum AppealReasonCategory {
  OUTCOME_DISPUTE     = 'OUTCOME_DISPUTE',
  REPLAY_MISMATCH     = 'REPLAY_MISMATCH',
  CARD_RESOLUTION     = 'CARD_RESOLUTION',
  INTEGRITY_CHALLENGE = 'INTEGRITY_CHALLENGE',
  BALANCE_ISSUE       = 'BALANCE_ISSUE',
  OTHER               = 'OTHER',
}

export type AppealStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED';

export interface AppealInput {
  /**
   * Must follow the format "CATEGORY: <description>"
   * e.g. "OUTCOME_DISPUTE: The wipe at turn 22 did not match my local state."
   */
  reason:         string;
  /** Must be an https:// URL if provided */
  attachmentUrl?: string;
  /** Optional game run ID that this appeal relates to */
  runId?:         string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REASON_MIN  = 20;
const REASON_MAX  = 2_000;
const OTHER_MIN   = 100;
const HTTPS_RE    = /^https:\/\/.+/;
const VALID_CATS  = new Set<string>(Object.values(AppealReasonCategory));

const VALID_TRANSITIONS: Record<AppealStatus, AppealStatus[]> = {
  SUBMITTED:    ['UNDER_REVIEW'],
  UNDER_REVIEW: ['RESOLVED'],
  RESOLVED:     [],
};

const DEFAULT_PAGE = 100;
const MAX_PAGE     = 500;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class IntegrityPublicService {
  constructor(
    @InjectRepository(GameEvent)
    private readonly gameEventRepository: Repository<GameEvent>,

    @InjectRepository(VerificationSummary)
    private readonly verificationSummaryRepository: Repository<VerificationSummary>,

    @InjectRepository(TransparencyRollup)
    private readonly transparencyRollupRepository: Repository<TransparencyRollup>,

    @InjectRepository(Appeal)
    private readonly appealRepository: Repository<Appeal>,
  ) {}

  // ── Verification Summary ──────────────────────────────────────────────────

  /**
   * Creates verification summaries for game events in the given date window.
   * Paginated to prevent OOM on large tables.
   * Idempotent: events with existing summaries are skipped.
   *
   * @param fromDate   Window start (default: 24h ago)
   * @param toDate     Window end   (default: now)
   * @param batchSize  Events per page (max MAX_PAGE)
   */
  async runVerificationSummary(
    fromDate  = new Date(Date.now() - 86_400_000),
    toDate    = new Date(),
    batchSize = DEFAULT_PAGE,
  ): Promise<{ created: number; skipped: number }> {
    const take = Math.min(batchSize, MAX_PAGE);
    let skip    = 0;
    let created = 0;
    let skipped = 0;

    while (true) {
      const events = await this.gameEventRepository.find({
        where: { timestamp: Between(fromDate, toDate) },
        order: { timestamp: 'ASC' },
        skip,
        take,
      });

      if (!events.length) break;

      // Idempotency: skip events with existing summaries
      const existing = await this.verificationSummaryRepository
        .createQueryBuilder('vs')
        .select('vs.gameEventId')
        .where('vs.gameEventId IN (:...ids)', { ids: events.map(e => e.id) })
        .getRawMany<{ vs_gameEventId: string }>();

      const existingSet = new Set(existing.map(r => r.vs_gameEventId));
      const toCreate    = events.filter(e => !existingSet.has(e.id));

      if (toCreate.length) {
        await this.verificationSummaryRepository.save(
          toCreate.map(e => this.buildVerificationSummary(e))
        );
        created += toCreate.length;
      }

      skipped += events.length - toCreate.length;
      skip    += take;
      if (events.length < take) break;
    }

    return { created, skipped };
  }

  async getVerificationSummary(id: string): Promise<VerificationSummary | null> {
    return this.verificationSummaryRepository.findOne({ where: { id } });
  }

  // ── Transparency Rollup ───────────────────────────────────────────────────

  /**
   * Creates a transparency rollup from a verification summary.
   * Includes netWorthDelta vs most recent prior rollup as a trend signal.
   */
  async createTransparencyRollup(verificationSummaryId: string): Promise<TransparencyRollup> {
    // Fixed: findOne(id) → findOne({ where: { id } })
    const summary = await this.verificationSummaryRepository.findOne({
      where: { id: verificationSummaryId },
    });
    if (!summary) throw new Error(`Verification Summary not found: ${verificationSummaryId}`);

    // Compute net worth delta vs prior rollup (trend indicator for public endpoint)
    const prior = await this.transparencyRollupRepository.findOne({
      where: {},
      order: { timestamp: 'DESC' },
    });
    const netWorthDelta = prior ? summary.netWorth - prior.netWorth : 0;

    const rollup = this.buildTransparencyRollupData(summary, netWorthDelta);
    return this.transparencyRollupRepository.save(rollup);
  }

  async getTransparencyRollup(id: string): Promise<TransparencyRollup | null> {
    return this.transparencyRollupRepository.findOne({ where: { id } });
  }

  // ── Appeals ───────────────────────────────────────────────────────────────

  /**
   * Creates an appeal for a transparency rollup.
   *
   * Validation:
   *   - reason must start with a valid AppealReasonCategory prefix
   *   - reason must be between REASON_MIN and REASON_MAX characters
   *   - OTHER category requires ≥ 100 chars
   *   - attachmentUrl must be https:// if provided
   */
  async createAppeal(
    transparencyRollupId: string,
    input: AppealInput,
  ): Promise<Appeal> {
    // Fixed: findOne(id) → findOne({ where: { id } })
    const rollup = await this.transparencyRollupRepository.findOne({
      where: { id: transparencyRollupId },
    });
    if (!rollup) throw new Error(`Transparency Rollup not found: ${transparencyRollupId}`);

    const err = this.validateAppealInput(input);
    if (err) throw err;

    return this.appealRepository.save(this.buildAppealData(rollup, input));
  }

  /**
   * Advances an appeal through the state machine: SUBMITTED→UNDER_REVIEW→RESOLVED.
   * Invalid transitions throw. RESOLVED requires a non-empty resolution string.
   * Each valid transition appends a receipt hash to appeal.receiptChain.
   */
  async updateAppealStatus(
    appealId:   string,
    newStatus:  AppealStatus,
    reviewerId: string,
    resolution?: string,
  ): Promise<Appeal> {
    const appeal = await this.appealRepository.findOne({ where: { id: appealId } });
    if (!appeal) throw new Error(`Appeal not found: ${appealId}`);

    const current = appeal.status as AppealStatus;
    const allowed = VALID_TRANSITIONS[current];

    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: ${current} → ${newStatus}. ` +
        `Allowed from ${current}: [${allowed.join(', ') || 'none (terminal)'}]`
      );
    }
    if (newStatus === 'RESOLVED' && !resolution?.trim()) {
      throw new Error('resolution text is required when resolving an appeal');
    }

    appeal.status     = newStatus;
    appeal.reviewerId = reviewerId;
    appeal.reviewedAt = new Date();
    if (resolution) appeal.resolution = resolution;

    // Immutable receipt chain — each transition produces a hash fingerprint
    appeal.receiptChain = [
      ...(appeal.receiptChain ?? []),
      createHash('sha256')
        .update(JSON.stringify({ appealId, newStatus, reviewerId, ts: Date.now() }))
        .digest('hex')
        .slice(0, 24),
    ];

    return this.appealRepository.save(appeal);
  }

  /**
   * Lists appeals with optional filtering and pagination.
   */
  async listAppeals(opts: {
    status?:   AppealStatus;
    rollupId?: string;
    page?:     number;
    pageSize?: number;
  } = {}): Promise<{ items: Appeal[]; total: number; page: number }> {
    const take = Math.min(opts.pageSize ?? DEFAULT_PAGE, MAX_PAGE);
    const skip = ((opts.page ?? 1) - 1) * take;

    const where: Record<string, unknown> = {};
    if (opts.status)   where.status               = opts.status;
    if (opts.rollupId) where.transparencyRollupId = opts.rollupId;

    const [items, total] = await this.appealRepository.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip,
      take,
    });

    return { items, total, page: opts.page ?? 1 };
  }

  // ── Builders ──────────────────────────────────────────────────────────────

  private buildVerificationSummary(e: GameEvent): VerificationSummary {
    return {
      id:               uuidv4(),
      gameEventId:      e.id,
      totalAssets:      e.totalAssets,
      totalLiabilities: e.totalLiabilities,
      netWorth:         e.netWorth,
      timestamp:        e.timestamp,
    } as VerificationSummary;
  }

  private buildTransparencyRollupData(
    summary:       VerificationSummary,
    netWorthDelta: number,
  ): TransparencyRollup {
    return {
      id:                    uuidv4(),
      verificationSummaryId: summary.id,
      totalAssets:           summary.totalAssets,
      totalLiabilities:      summary.totalLiabilities,
      netWorth:              summary.netWorth,
      netWorthDelta,
      timestamp:             summary.timestamp,
    } as TransparencyRollup;
  }

  private buildAppealData(rollup: TransparencyRollup, input: AppealInput): Appeal {
    const category = this.extractCategory(input.reason);
    return {
      id:                   uuidv4(),
      transparencyRollupId: rollup.id,
      reason:               input.reason.trim(),
      reasonCategory:       category,
      attachmentUrl:        input.attachmentUrl ?? null,
      runId:                input.runId ?? null,
      status:               'SUBMITTED' as AppealStatus,
      receiptChain:         [],
      reviewerId:           null,
      reviewedAt:           null,
      resolution:           null,
      timestamp:            new Date(),
    } as Appeal;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private validateAppealInput(input: AppealInput): Error | null {
    const r = input.reason?.trim() ?? '';

    if (!r) return new Error('Appeal reason is required');
    if (r.length < REASON_MIN) {
      return new Error(`reason must be at least ${REASON_MIN} characters`);
    }
    if (r.length > REASON_MAX) {
      return new Error(`reason must be at most ${REASON_MAX} characters`);
    }

    const category = this.extractCategory(r);
    if (!VALID_CATS.has(category)) {
      return new Error(
        `reason must start with a valid category. Format: "CATEGORY: <description>". ` +
        `Valid categories: ${[...VALID_CATS].join(', ')}`
      );
    }
    if (category === AppealReasonCategory.OTHER && r.length < OTHER_MIN) {
      return new Error(`OTHER category requires at least ${OTHER_MIN} characters`);
    }
    if (input.attachmentUrl && !HTTPS_RE.test(input.attachmentUrl)) {
      return new Error('attachmentUrl must be an https:// URL');
    }

    return null;
  }

  private extractCategory(reason: string): string {
    const i = reason.indexOf(':');
    return i === -1 ? '' : reason.slice(0, i).trim().toUpperCase();
  }
}
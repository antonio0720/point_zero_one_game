/**
 * ReferralService — Invite link creation, eligibility checks, and credit logic.
 * Wraps src/services/referrals/ (referrals_impl.ts) and anti_spam_throttles.ts.
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/services/referral.service.ts
 *
 * Sovereign implementation — DB-backed, atomic, zero in-process Maps.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, DataSource } from 'typeorm';
import { ReferralRecord }    from '../entities/referral_record.entity';
import { ReferralDailyState } from '../entities/referral_daily_state.entity';
import { Season0Member }     from '../entities/season0_member.entity';

// ── Types ─────────────────────────────────────────────────────────────────────
export type InviteType  = 'direct' | 'referral' | 'public';
export type RewardTier  = 'bronze' | 'silver' | 'gold';

export interface ReferralEligibility {
  canInvite:               boolean;
  reason?:                 'cooldown_active' | 'daily_limit_reached' | 'suppressed';
  cooldownEndsAt?:         string;
  invitesRemainingToday?:  number;
}

export interface ReferralLink {
  code:                string;
  url:                 string;
  inviteType:          InviteType;
  rewardTier:          RewardTier;
  successfulInvites:   number;
  nextCooldownSeconds: number;
  expiresAt:           string | null;
}

export interface ReferralCreditResult {
  referrerId:       string;
  newTier:          RewardTier;
  totalSuccessful:  number;
  rewardUnlocked:   boolean;
  rewardDetail:     string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_DAILY_INVITES        = 10;
const BASE_COOLDOWN_MS         = 5 * 60 * 1000;   // 5 minutes
const COOLDOWN_ESCALATION      = 1.5;             // doubles geometrically
const BASE_URL                 = process.env.APP_BASE_URL ?? 'https://app.pointzeroonedigital.com';

// Tier thresholds: Bronze 1–5, Silver 6–10, Gold 11+
function computeRewardTier(successfulInvites: number): RewardTier {
  if (successfulInvites >= 11) return 'gold';
  if (successfulInvites >= 6)  return 'silver';
  return 'bronze';
}

function buildReferralCode(playerId: string): string {
  return `PZO-${playerId.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

function startOfUTCDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(ReferralRecord)
    private readonly referralRepo: Repository<ReferralRecord>,

    @InjectRepository(ReferralDailyState)
    private readonly dailyStateRepo: Repository<ReferralDailyState>,

    @InjectRepository(Season0Member)
    private readonly memberRepo: Repository<Season0Member>,

    private readonly dataSource: DataSource,
  ) {}

  // ── checkEligibility ────────────────────────────────────────────────────────
  /**
   * Returns whether the player can send an invite right now.
   * Checks: suppression flag, daily limit, escalating cooldown.
   */
  async checkEligibility(playerId: string): Promise<ReferralEligibility> {
    const state = await this.getOrInitDailyState(playerId);
    const now   = Date.now();

    // ── Suppression (manual ban / abuse flag) ────────────────────────────────
    if (state.suppressed) {
      return { canInvite: false, reason: 'suppressed', invitesRemainingToday: 0 };
    }

    // ── Daily limit ─────────────────────────────────────────────────────────
    if (state.dailyCount >= MAX_DAILY_INVITES) {
      const tomorrow = new Date(startOfUTCDay().getTime() + 86_400_000);
      return {
        canInvite:              false,
        reason:                 'daily_limit_reached',
        cooldownEndsAt:         tomorrow.toISOString(),
        invitesRemainingToday:  0,
      };
    }

    // ── Escalating cooldown ──────────────────────────────────────────────────
    if (state.lastInviteAt && state.dailyCount > 0) {
      const cooldownMs = BASE_COOLDOWN_MS * Math.pow(COOLDOWN_ESCALATION, state.dailyCount - 1);
      const elapsed    = now - state.lastInviteAt.getTime();
      if (elapsed < cooldownMs) {
        const cooldownEndsAt = new Date(state.lastInviteAt.getTime() + cooldownMs).toISOString();
        return {
          canInvite:             false,
          reason:                'cooldown_active',
          cooldownEndsAt,
          invitesRemainingToday: MAX_DAILY_INVITES - state.dailyCount,
        };
      }
    }

    return {
      canInvite:             true,
      invitesRemainingToday: MAX_DAILY_INVITES - state.dailyCount,
    };
  }

  // ── getOrCreateReferralLink ─────────────────────────────────────────────────
  /**
   * Idempotent — returns existing code if one exists for this player.
   * Atomically increments daily count and records last invite timestamp.
   */
  async getOrCreateReferralLink(
    playerId: string,
    inviteType: InviteType,
  ): Promise<ReferralLink> {
    return this.dataSource.transaction(async (mgr) => {
      // Get or create the referral record
      let record = await mgr.findOne(ReferralRecord, { where: { ownerId: playerId, active: true } });
      if (!record) {
        record = mgr.create(ReferralRecord, {
          ownerId:          playerId,
          code:             buildReferralCode(playerId),
          active:           true,
          successfulInvites: 0,
          inviteType,
        });
        await mgr.save(ReferralRecord, record);
        this.logger.log(`Referral code created for ${playerId}: ${record.code}`);
      }

      // Increment daily state
      const state = await this.getOrInitDailyState(playerId, mgr);
      await mgr.update(
        ReferralDailyState,
        { playerId, dayStart: startOfUTCDay() },
        {
          dailyCount:   state.dailyCount + 1,
          lastInviteAt: new Date(),
        },
      );

      const nextCooldownMs = BASE_COOLDOWN_MS * Math.pow(COOLDOWN_ESCALATION, state.dailyCount);

      return {
        code:                record.code,
        url:                 `${BASE_URL}/join?ref=${record.code}`,
        inviteType,
        rewardTier:          computeRewardTier(record.successfulInvites),
        successfulInvites:   record.successfulInvites,
        nextCooldownSeconds: Math.ceil(nextCooldownMs / 1000),
        expiresAt:           null, // Season 0 codes don't expire
      };
    });
  }

  // ── creditReferral ──────────────────────────────────────────────────────────
  /**
   * Credits a referral to the code owner when a new player registers.
   * Atomically increments successfulInvites and recomputes reward tier.
   * Fires tier upgrade logic when crossing Bronze→Silver (6) or Silver→Gold (11).
   *
   * @returns ReferralCreditResult with new tier and whether a reward was unlocked
   */
  async creditReferral(
    referralCode: string,
    newPlayerId:  string,
  ): Promise<ReferralCreditResult | null> {
    return this.dataSource.transaction(async (mgr) => {
      const record = await mgr
        .createQueryBuilder(ReferralRecord, 'r')
        .where('r.code = :code AND r.active = true', { code: referralCode })
        .setLock('pessimistic_write')
        .getOne();

      if (!record) {
        this.logger.warn(`Invalid or inactive referral code: ${referralCode}`);
        return null;
      }

      const prevInvites = record.successfulInvites;
      const newInvites  = prevInvites + 1;
      const prevTier    = computeRewardTier(prevInvites);
      const newTier     = computeRewardTier(newInvites);
      const tierChanged = prevTier !== newTier;

      await mgr.update(ReferralRecord, { code: referralCode }, {
        successfulInvites: newInvites,
        lastCreditedAt:    new Date(),
        lastCreditedTo:    newPlayerId,
      });

      // Resolve reward detail on tier upgrade
      let rewardDetail: string | null = null;
      if (tierChanged) {
        rewardDetail = this.buildRewardDetail(newTier, record.ownerId);
        this.logger.log(
          `Tier upgrade: ${record.ownerId} ${prevTier}→${newTier} | ${rewardDetail}`,
        );
        // Extend here: emit event, update inventory, etc.
      }

      this.logger.log(
        `Referral credited: code=${referralCode} referrerId=${record.ownerId} ` +
        `total=${newInvites} tier=${newTier}`,
      );

      return {
        referrerId:      record.ownerId,
        newTier,
        totalSuccessful: newInvites,
        rewardUnlocked:  tierChanged,
        rewardDetail,
      };
    });
  }

  // ── suppressPlayer ──────────────────────────────────────────────────────────
  /**
   * Suppresses a player from sending invites (abuse/spam response).
   */
  async suppressPlayer(playerId: string): Promise<void> {
    await this.dailyStateRepo.update(
      { playerId },
      { suppressed: true },
    );
    this.logger.warn(`Referral suppression applied to player ${playerId}`);
  }

  // ── getStats ────────────────────────────────────────────────────────────────
  async getStats(playerId: string): Promise<{
    totalInvites: number;
    tier: RewardTier;
    code: string | null;
  }> {
    const record = await this.referralRepo.findOne({
      where: { ownerId: playerId, active: true },
    });
    return {
      totalInvites: record?.successfulInvites ?? 0,
      tier:         computeRewardTier(record?.successfulInvites ?? 0),
      code:         record?.code ?? null,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────
  private async getOrInitDailyState(playerId: string, mgr?: any): Promise<ReferralDailyState> {
    const repo   = mgr ? mgr.getRepository(ReferralDailyState) : this.dailyStateRepo;
    const dayKey = startOfUTCDay();

    let state = await repo.findOne({ where: { playerId, dayStart: dayKey } });
    if (!state) {
      state = repo.create({
        playerId,
        dayStart:     dayKey,
        dailyCount:   0,
        lastInviteAt: null,
        suppressed:   false,
      });
      await repo.save(state);
    }
    return state;
  }

  private buildRewardDetail(tier: RewardTier, ownerId: string): string {
    const rewards: Record<RewardTier, string> = {
      bronze: 'Season 0 Bronze Referrer badge + 100 PZO credits',
      silver: 'Season 0 Silver Referrer badge + 300 PZO credits + early access to Act 2',
      gold:   'Season 0 Gold Referrer badge + 1000 PZO credits + Founding Legend IAB seal',
    };
    return `${rewards[tier]} for player ${ownerId}`;
  }
}

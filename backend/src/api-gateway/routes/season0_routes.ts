// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/api-gateway/routes/season0_routes.ts

// ── Extend Express Request with fields set by auth_middleware.ts ──────────────
declare global {
  namespace Express {
    interface Request {
      identityId?: string;
      isAuthenticated?: boolean;
      isGuest?: boolean;
    }
  }
}

import { Router, Request, Response } from 'express';

type RouteHandler = (req: Request, res: Response) => Promise<void> | void;

export interface Season0Routes {
  status: RouteHandler;
  join: RouteHandler;
  'membership-card': RouteHandler;
  referrals: RouteHandler;
  streaks: RouteHandler;
}

import { AuthMiddleware } from '../auth/auth.middleware';
import { RateLimitMiddleware } from '../rate-limit/rate-limit.middleware';
import { WaitlistService } from '../../services/waitlist.service';
import { MembershipService } from '../../services/membership.service';
import { ReferralService } from '../../services/referral.service';
import { StreakService } from '../../services/streak.service';
import { AbuseGuard } from '../../services/abuse-guard.service';
import { EventBus } from '../../events/event-bus';
import { SeasonPhase } from '../../types/season.types';

const router = Router();

/**
 * Mounts the routes for Season 0.
 */
export const season0Routes: Season0Routes = {

  /**
   * GET /status
   *
   * Returns the current game status:
   * - Season phase (Claim / Build / Proof / Seal)
   * - Waitlist open/closed + current position count
   * - Founding era capacity remaining
   * - Season 0 feature flags
   */
  status: async (req: Request, res: Response): Promise<void> => {
    try {
      const [waitlistStatus, seasonMeta] = await Promise.all([
        WaitlistService.getStatus(),
        WaitlistService.getSeasonMeta(),
      ]);

      res.status(200).json({
        ok: true,
        data: {
          season: 'season0',
          phase: seasonMeta.phase as SeasonPhase,         // Claim | Build | Proof | Seal
          waitlist: {
            open: waitlistStatus.isOpen,
            totalJoined: waitlistStatus.totalJoined,
            capacityRemaining: waitlistStatus.capacityRemaining,
            foundingEraActive: waitlistStatus.foundingEraActive,
          },
          features: {
            referralsEnabled: seasonMeta.referralsEnabled,
            membershipCardsEnabled: seasonMeta.membershipCardsEnabled,
            proofStampsEnabled: seasonMeta.proofStampsEnabled,
          },
          serverTime: new Date().toISOString(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'status_unavailable';
      res.status(503).json({ ok: false, error: message });
    }
  },

  /**
   * POST /join
   *
   * Joins a new player to Season 0:
   * - Validates email + IP abuse limits (one position per account, IP-gated)
   * - Creates Season0Token, Identity Artifact Bundle (IAB), Founding Era Pass (FEP)
   * - Assigns waitlist position (non-transferable, non-repurchasable)
   * - Emits SEASON0_JOINED event
   * - Returns full membership snapshot
   */
  join: AuthMiddleware(async (req: Request, res: Response): Promise<void> => {
    const { email, referralCode } = req.body as { email?: string; referralCode?: string };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ ok: false, error: 'valid_email_required' });
      return;
    }

    try {
      // Abuse countermeasure: IP-rate check before any DB write
      const ipCheck = await AbuseGuard.checkJoinEligibility({
        ip: req.ip ?? 'unknown',
        email,
      });

      if (!ipCheck.eligible) {
        res.status(429).json({ ok: false, error: ipCheck.reason });
        return;
      }

      // Idempotency: reject duplicate accounts
      const existing = await MembershipService.findByEmail(email);
      if (existing) {
        res.status(409).json({ ok: false, error: 'account_already_exists' });
        return;
      }

      // Validate waitlist is still open
      const waitlistStatus = await WaitlistService.getStatus();
      if (!waitlistStatus.isOpen || waitlistStatus.capacityRemaining <= 0) {
        res.status(410).json({ ok: false, error: 'waitlist_closed' });
        return;
      }

      // Create membership: Season0Token + IAB + FEP + waitlist position
      const membership = await MembershipService.createFoundingMember({
        email,
        referralCode: referralCode ?? null,
        ip: req.ip ?? 'unknown',
        joinedAt: new Date().toISOString(),
      });

      // Emit SEASON0_JOINED for downstream services (leaderboard, achievements, etc.)
      await EventBus.emit('SEASON0_JOINED', {
        playerId: membership.playerId,
        waitlistPosition: membership.waitlistPosition,
        foundingEraPass: membership.foundingEraPass,
        referralCode: referralCode ?? null,
        timestamp: new Date().toISOString(),
      });

      // Credit referrer if code is valid
      if (referralCode) {
        await ReferralService.creditReferral(referralCode, membership.playerId).catch(() => {
          // Non-fatal: log but don't block join response
        });
      }

      // Invalidate waitlist count cache
      WaitlistService.invalidateCache();

      res.status(201).json({
        ok: true,
        data: {
          playerId: membership.playerId,
          season0Token: membership.season0Token,
          waitlistPosition: membership.waitlistPosition,
          foundingEraPass: membership.foundingEraPass,
          identityArtifactBundle: membership.identityArtifactBundle,
          joinedAt: membership.joinedAt,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'join_failed';
      res.status(500).json({ ok: false, error: message });
    }
  }),

  /**
   * GET /membership-card
   *
   * Returns the full membership card for the authenticated player:
   * - Season0Token + waitlist position + tier
   * - Identity Artifact Bundle (Badge, Emblem, Insignia, Medallion, Seal)
   * - Founding Era Pass + proof-card stamps
   * - Current membership state (streak, freezes, 4-act arc progress)
   */
  'membership-card': AuthMiddleware(async (req: Request, res: Response): Promise<void> => {
    const playerId = req.identityId as string;

    try {
      const [membership, stamps, membershipState] = await Promise.all([
        MembershipService.getFullCard(playerId),
        MembershipService.getProofCardStamps(playerId),
        MembershipService.getMembershipState(playerId),
      ]);

      if (!membership) {
        res.status(404).json({ ok: false, error: 'membership_not_found' });
        return;
      }

      res.status(200).json({
        ok: true,
        data: {
          playerId,
          season0Token: membership.season0Token,
          waitlistPosition: membership.waitlistPosition,
          tier: membership.tier,                          // collectible tier (rarity)
          foundingEraPass: membership.foundingEraPass,
          identityArtifactBundle: {
            badge: membership.iab.badge,                  // role/status
            emblem: membership.iab.emblem,                // guild/alliance
            insignia: membership.iab.insignia,            // personal achievement
            medallion: membership.iab.medallion,          // financial contribution
            seal: membership.iab.seal,                    // special event participation
          },
          proofCardStamps: stamps,                        // PCS — transferable stamps
          membershipState: {
            streak: membershipState.streak,
            freezes: membershipState.freezes,
            progress: membershipState.progress,           // 4-act arc: Claim/Build/Proof/Seal
            graceActive: membershipState.graceActive,
          },
          communityAccess: membership.communityAccess,
          transactionHistory: membership.transactionHistory,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'membership_card_fetch_failed';
      res.status(500).json({ ok: false, error: message });
    }
  }),

  /**
   * POST /referrals
   *
   * Creates or returns the referral link for the authenticated player.
   * Enforces anti-spam rules:
   * - Cooldown between invites (escalating)
   * - Max invites per day/week
   * - Suppression for excessive activity
   * - Completion requirement: player must be past Claim phase
   * Rate-limited at the middleware level (RateLimitMiddleware).
   */
  referrals: AuthMiddleware(RateLimitMiddleware(async (req: Request, res: Response): Promise<void> => {
    const playerId = req.identityId as string;
    const { inviteType } = req.body as { inviteType?: 'direct' | 'referral' | 'public' };

    const resolvedType: 'direct' | 'referral' | 'public' = inviteType ?? 'referral';

    try {
      // Completion requirement: player must have completed at least the Claim phase
      const membershipState = await MembershipService.getMembershipState(playerId);
      const claimComplete = membershipState.progress.actCompleted.includes('Claim');

      if (!claimComplete) {
        res.status(403).json({
          ok: false,
          error: 'referrals_locked_until_claim_phase_complete',
          hint: 'Complete the Claim phase to unlock referral invites.',
        });
        return;
      }

      // Anti-spam: check cooldown + daily limit before generating
      const eligibility = await ReferralService.checkEligibility(playerId);

      if (!eligibility.canInvite) {
        res.status(429).json({
          ok: false,
          error: eligibility.reason,                       // 'cooldown_active' | 'daily_limit_reached' | 'suppressed'
          cooldownEndsAt: eligibility.cooldownEndsAt ?? null,
          invitesRemainingToday: eligibility.invitesRemainingToday ?? 0,
        });
        return;
      }

      // Generate or retrieve existing referral code (idempotent)
      const referral = await ReferralService.getOrCreateReferralLink(playerId, resolvedType);

      res.status(200).json({
        ok: true,
        data: {
          referralCode: referral.code,
          referralUrl: referral.url,
          inviteType: resolvedType,
          tier: referral.rewardTier,                       // bronze | silver | gold
          successfulInvites: referral.successfulInvites,
          invitesRemainingToday: eligibility.invitesRemainingToday,
          nextCooldownSeconds: referral.nextCooldownSeconds,
          expiresAt: referral.expiresAt,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'referral_creation_failed';
      res.status(500).json({ ok: false, error: message });
    }
  })),

  /**
   * GET /streaks
   *
   * Returns streak information for the authenticated player:
   * - Current streak + longest streak
   * - Grace rule status (active freeze or grace window)
   * - All 4 retention loop states: Streak / Event / Collection / Social
   * - Lightweight missions progress
   */
  streaks: AuthMiddleware(async (req: Request, res: Response): Promise<void> => {
    const playerId = req.identityId as string;

    try {
      const [streakData, retentionLoops] = await Promise.all([
        StreakService.getStreakState(playerId),
        StreakService.getRetentionLoops(playerId),
      ]);

      res.status(200).json({
        ok: true,
        data: {
          streak: {
            current: streakData.currentStreak,
            longest: streakData.longestStreak,
            lastActivityAt: streakData.lastActivityAt,
            resetsAt: streakData.resetsAt,                 // deadline to maintain streak
          },
          grace: {
            active: streakData.graceActive,
            freezesRemaining: streakData.freezesRemaining,
            freezeExpiresAt: streakData.freezeExpiresAt ?? null,
            graceWindowEndsAt: streakData.graceWindowEndsAt ?? null,
          },
          retentionLoops: {
            streak: retentionLoops.streak,                 // consecutive activity
            event: retentionLoops.event,                   // limited-time event progress
            collection: retentionLoops.collection,         // items/achievements collected
            social: retentionLoops.social,                 // trades, alliances, referrals
          },
          missions: streakData.activeMissions,             // lightweight missions for quick wins
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'streak_fetch_failed';
      res.status(500).json({ ok: false, error: message });
    }
  }),
};

export default router;

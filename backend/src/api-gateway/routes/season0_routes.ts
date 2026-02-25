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
import { AuthMiddleware } from '../auth/auth.middleware';
import { RateLimitMiddleware } from '../rate-limit/rate-limit.middleware';
import { WaitlistService } from '../../services/waitlist.service';
import { MembershipService } from '../../services/membership.service';
import { ReferralService } from '../../services/referral.service';
import { StreakService } from '../../services/streak.service';
import { AbuseGuard } from '../../services/abuse-guard.service';
import { EventBus } from '../../events/event-bus';
import { SeasonPhase } from '../../types/season.types';

type RouteHandler = (req: Request, res: Response) => Promise<void> | void;

export interface Season0Routes {
  status: RouteHandler;
  join: RouteHandler;
  'membership-card': RouteHandler;
  referrals: RouteHandler;
  streaks: RouteHandler;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Ports (INSTANCE methods used by this route file)
// Fixes TS2339 errors caused by calling NestJS instance methods as static methods.
// ─────────────────────────────────────────────────────────────────────────────

type WaitlistStatusShape = {
  isOpen: boolean;
  totalJoined: number;
  capacityRemaining: number;
  foundingEraActive: boolean;
};

type SeasonMetaShape = {
  phase: SeasonPhase | string;
  referralsEnabled: boolean;
  membershipCardsEnabled: boolean;
  proofStampsEnabled: boolean;
};

type FoundingMembershipShape = {
  playerId: string;
  season0Token: string;
  waitlistPosition: number;
  foundingEraPass: unknown;
  identityArtifactBundle: unknown;
  joinedAt: string;
  tier?: string;
  iab?: {
    badge: unknown;
    emblem: unknown;
    insignia: unknown;
    medallion: unknown;
    seal: unknown;
  };
  communityAccess?: boolean;
  transactionHistory?: unknown[];
};

type MembershipStateShape = {
  streak: unknown;
  freezes: unknown;
  progress: {
    actCompleted: string[];
    currentAct?: string;
  };
  graceActive: boolean;
};

type ReferralEligibilityShape = {
  canInvite: boolean;
  reason?: 'cooldown_active' | 'daily_limit_reached' | 'suppressed' | string;
  cooldownEndsAt?: string;
  invitesRemainingToday?: number;
};

type ReferralLinkShape = {
  code: string;
  url: string;
  rewardTier: 'bronze' | 'silver' | 'gold' | string;
  successfulInvites: number;
  nextCooldownSeconds: number;
  expiresAt: string | null;
};

type StreakStateShape = {
  currentStreak: number;
  longestStreak: number;
  lastActivityAt: string;
  resetsAt: string;
  graceActive: boolean;
  freezesRemaining: number;
  freezeExpiresAt?: string;
  graceWindowEndsAt?: string;
  activeMissions: unknown[];
};

type RetentionLoopsShape = {
  streak: unknown;
  event: unknown;
  collection: unknown;
  social: unknown;
};

interface WaitlistServicePort {
  getStatus(): Promise<WaitlistStatusShape>;
  getSeasonMeta(): Promise<SeasonMetaShape>;
  invalidateCache(): void;
}

interface MembershipServicePort {
  findByEmail(email: string): Promise<FoundingMembershipShape | null>;
  createFoundingMember(input: {
    email: string;
    referralCode: string | null;
    ip: string;
    joinedAt: string;
  }): Promise<FoundingMembershipShape>;
  getFullCard(playerId: string): Promise<FoundingMembershipShape | null>;
  getProofCardStamps(playerId: string): Promise<unknown[]>;
  getMembershipState(playerId: string): Promise<MembershipStateShape>;
}

interface ReferralServicePort {
  creditReferral(referralCode: string, newPlayerId: string): Promise<unknown>;
  checkEligibility(playerId: string): Promise<ReferralEligibilityShape>;
  getOrCreateReferralLink(
    playerId: string,
    inviteType: 'direct' | 'referral' | 'public',
  ): Promise<ReferralLinkShape>;
}

interface StreakServicePort {
  getStreakState(playerId: string): Promise<StreakStateShape>;
  getRetentionLoops(playerId: string): Promise<RetentionLoopsShape>;
}

interface AbuseGuardPort {
  checkJoinEligibility(input: {
    ip: string;
    email: string;
  }): Promise<{ eligible: boolean; reason?: string }>;
}

interface EventBusPort {
  emit(eventName: string, payload: Record<string, unknown>): Promise<void> | void;
}

export interface Season0RouteDeps {
  waitlistService: WaitlistServicePort;
  membershipService: MembershipServicePort;
  referralService: ReferralServicePort;
  streakService: StreakServicePort;
  abuseGuard: AbuseGuardPort;
  eventBus: EventBusPort;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dependency resolution
// Supports:
//   1) Explicit runtime configuration via setSeason0RouteDeps(...)
//   2) Legacy static exports if the imported classes expose static methods
// ─────────────────────────────────────────────────────────────────────────────

let configuredDeps: Partial<Season0RouteDeps> = {};

export function setSeason0RouteDeps(deps: Partial<Season0RouteDeps>): void {
  configuredDeps = { ...configuredDeps, ...deps };
}

function getStaticCompat<T extends object>(
  label: string,
  source: unknown,
  requiredMethods: readonly (keyof T & string)[],
): T | null {
  const candidate = source as Record<string, unknown>;

  const hasAll = requiredMethods.every(
    (methodName) => typeof candidate[methodName] === 'function',
  );

  if (!hasAll) return null;

  return candidate as unknown as T;
}

function getRequiredDep<K extends keyof Season0RouteDeps>(
  key: K,
  fallback?: Season0RouteDeps[K] | null,
): Season0RouteDeps[K] {
  const dep = configuredDeps[key] ?? fallback ?? null;

  if (!dep) {
    throw new Error(
      `season0_routes dependency '${String(
        key,
      )}' is not configured. Call setSeason0RouteDeps(...) during bootstrap.`,
    );
  }

  return dep as Season0RouteDeps[K];
}

function resolveWaitlistService(): WaitlistServicePort {
  const staticCompat = getStaticCompat<WaitlistServicePort>('WaitlistService', WaitlistService, [
    'getStatus',
    'getSeasonMeta',
    'invalidateCache',
  ] as const);

  return getRequiredDep('waitlistService', staticCompat);
}

function resolveMembershipService(): MembershipServicePort {
  const staticCompat = getStaticCompat<MembershipServicePort>(
    'MembershipService',
    MembershipService,
    [
      'findByEmail',
      'createFoundingMember',
      'getFullCard',
      'getProofCardStamps',
      'getMembershipState',
    ] as const,
  );

  return getRequiredDep('membershipService', staticCompat);
}

function resolveReferralService(): ReferralServicePort {
  const staticCompat = getStaticCompat<ReferralServicePort>('ReferralService', ReferralService, [
    'creditReferral',
    'checkEligibility',
    'getOrCreateReferralLink',
  ] as const);

  return getRequiredDep('referralService', staticCompat);
}

function resolveStreakService(): StreakServicePort {
  const staticCompat = getStaticCompat<StreakServicePort>('StreakService', StreakService, [
    'getStreakState',
    'getRetentionLoops',
  ] as const);

  return getRequiredDep('streakService', staticCompat);
}

function resolveAbuseGuard(): AbuseGuardPort {
  const staticCompat = getStaticCompat<AbuseGuardPort>('AbuseGuard', AbuseGuard, [
    'checkJoinEligibility',
  ] as const);

  return getRequiredDep('abuseGuard', staticCompat);
}

function resolveEventBus(): EventBusPort {
  const staticCompat = getStaticCompat<EventBusPort>('EventBus', EventBus, ['emit'] as const);

  return getRequiredDep('eventBus', staticCompat);
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

export const season0Routes: Season0Routes = {
  /**
   * GET /status
   */
  status: async (_req: Request, res: Response): Promise<void> => {
    try {
      const waitlistService = resolveWaitlistService();

      const [waitlistStatus, seasonMeta] = await Promise.all([
        waitlistService.getStatus(),
        waitlistService.getSeasonMeta(),
      ]);

      res.status(200).json({
        ok: true,
        data: {
          season: 'season0',
          phase: seasonMeta.phase as SeasonPhase,
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
   */
  join: AuthMiddleware(async (req: Request, res: Response): Promise<void> => {
    const { email, referralCode } = req.body as { email?: string; referralCode?: string };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ ok: false, error: 'valid_email_required' });
      return;
    }

    try {
      const abuseGuard = resolveAbuseGuard();
      const membershipService = resolveMembershipService();
      const waitlistService = resolveWaitlistService();
      const referralService = resolveReferralService();
      const eventBus = resolveEventBus();

      const ipCheck = await abuseGuard.checkJoinEligibility({
        ip: req.ip ?? 'unknown',
        email,
      });

      if (!ipCheck.eligible) {
        res.status(429).json({ ok: false, error: ipCheck.reason ?? 'join_not_eligible' });
        return;
      }

      const existing = await membershipService.findByEmail(email);
      if (existing) {
        res.status(409).json({ ok: false, error: 'account_already_exists' });
        return;
      }

      const waitlistStatus = await waitlistService.getStatus();
      if (!waitlistStatus.isOpen || waitlistStatus.capacityRemaining <= 0) {
        res.status(410).json({ ok: false, error: 'waitlist_closed' });
        return;
      }

      const membership = await membershipService.createFoundingMember({
        email,
        referralCode: referralCode ?? null,
        ip: req.ip ?? 'unknown',
        joinedAt: new Date().toISOString(),
      });

      await eventBus.emit('SEASON0_JOINED', {
        playerId: membership.playerId,
        waitlistPosition: membership.waitlistPosition,
        foundingEraPass: membership.foundingEraPass,
        referralCode: referralCode ?? null,
        timestamp: new Date().toISOString(),
      });

      if (referralCode) {
        await referralService.creditReferral(referralCode, membership.playerId).catch(() => {
          // non-fatal
        });
      }

      waitlistService.invalidateCache();

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
   */
  'membership-card': AuthMiddleware(async (req: Request, res: Response): Promise<void> => {
    const playerId = req.identityId as string;

    try {
      const membershipService = resolveMembershipService();

      const [membership, stamps, membershipState] = await Promise.all([
        membershipService.getFullCard(playerId),
        membershipService.getProofCardStamps(playerId),
        membershipService.getMembershipState(playerId),
      ]);

      if (!membership) {
        res.status(404).json({ ok: false, error: 'membership_not_found' });
        return;
      }

      const iab = membership.iab ?? (membership.identityArtifactBundle as any);

      res.status(200).json({
        ok: true,
        data: {
          playerId,
          season0Token: membership.season0Token,
          waitlistPosition: membership.waitlistPosition,
          tier: membership.tier,
          foundingEraPass: membership.foundingEraPass,
          identityArtifactBundle: {
            badge: iab?.badge,
            emblem: iab?.emblem,
            insignia: iab?.insignia,
            medallion: iab?.medallion,
            seal: iab?.seal,
          },
          proofCardStamps: stamps,
          membershipState: {
            streak: membershipState.streak,
            freezes: membershipState.freezes,
            progress: membershipState.progress,
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
   */
  referrals: AuthMiddleware(
    RateLimitMiddleware(async (req: Request, res: Response): Promise<void> => {
      const playerId = req.identityId as string;
      const { inviteType } = req.body as { inviteType?: 'direct' | 'referral' | 'public' };
      const resolvedType: 'direct' | 'referral' | 'public' = inviteType ?? 'referral';

      try {
        const membershipService = resolveMembershipService();
        const referralService = resolveReferralService();

        const membershipState = await membershipService.getMembershipState(playerId);
        const claimComplete = Array.isArray(membershipState.progress?.actCompleted)
          ? membershipState.progress.actCompleted.includes('Claim')
          : false;

        if (!claimComplete) {
          res.status(403).json({
            ok: false,
            error: 'referrals_locked_until_claim_phase_complete',
            hint: 'Complete the Claim phase to unlock referral invites.',
          });
          return;
        }

        const eligibility = await referralService.checkEligibility(playerId);

        if (!eligibility.canInvite) {
          res.status(429).json({
            ok: false,
            error: eligibility.reason,
            cooldownEndsAt: eligibility.cooldownEndsAt ?? null,
            invitesRemainingToday: eligibility.invitesRemainingToday ?? 0,
          });
          return;
        }

        const referral = await referralService.getOrCreateReferralLink(playerId, resolvedType);

        res.status(200).json({
          ok: true,
          data: {
            referralCode: referral.code,
            referralUrl: referral.url,
            inviteType: resolvedType,
            tier: referral.rewardTier,
            successfulInvites: referral.successfulInvites,
            invitesRemainingToday: eligibility.invitesRemainingToday ?? 0,
            nextCooldownSeconds: referral.nextCooldownSeconds,
            expiresAt: referral.expiresAt,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'referral_creation_failed';
        res.status(500).json({ ok: false, error: message });
      }
    }),
  ),

  /**
   * GET /streaks
   */
  streaks: AuthMiddleware(async (req: Request, res: Response): Promise<void> => {
    const playerId = req.identityId as string;

    try {
      const streakService = resolveStreakService();

      const [streakData, retentionLoops] = await Promise.all([
        streakService.getStreakState(playerId),
        streakService.getRetentionLoops(playerId),
      ]);

      res.status(200).json({
        ok: true,
        data: {
          streak: {
            current: streakData.currentStreak,
            longest: streakData.longestStreak,
            lastActivityAt: streakData.lastActivityAt,
            resetsAt: streakData.resetsAt,
          },
          grace: {
            active: streakData.graceActive,
            freezesRemaining: streakData.freezesRemaining,
            freezeExpiresAt: streakData.freezeExpiresAt ?? null,
            graceWindowEndsAt: streakData.graceWindowEndsAt ?? null,
          },
          retentionLoops: {
            streak: retentionLoops.streak,
            event: retentionLoops.event,
            collection: retentionLoops.collection,
            social: retentionLoops.social,
          },
          missions: streakData.activeMissions,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'streak_fetch_failed';
      res.status(500).json({ ok: false, error: message });
    }
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Router wiring (default export now actually mounts handlers)
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

router.get('/status', season0Routes.status);
router.post('/join', season0Routes.join);
router.get('/membership-card', season0Routes['membership-card']);
router.post('/referrals', season0Routes.referrals);
router.get('/streaks', season0Routes.streaks);

export default router;
/**
 * ReferralService — Invite link creation, eligibility checks, and credit logic.
 * Wraps src/services/referrals/ (referrals_impl.ts) and anti_spam_throttles.ts.
 */

export type InviteType = 'direct' | 'referral' | 'public';
export type RewardTier = 'bronze' | 'silver' | 'gold';

export interface ReferralEligibility {
  canInvite: boolean;
  reason?: 'cooldown_active' | 'daily_limit_reached' | 'suppressed';
  cooldownEndsAt?: string;
  invitesRemainingToday?: number;
}

export interface ReferralLink {
  code: string;
  url: string;
  inviteType: InviteType;
  rewardTier: RewardTier;
  successfulInvites: number;
  nextCooldownSeconds: number;
  expiresAt: string | null;
}

// Tier thresholds per spec: Bronze 1-5, Silver 6-10, Gold 11+
function computeRewardTier(successfulInvites: number): RewardTier {
  if (successfulInvites >= 11) return 'gold';
  if (successfulInvites >= 6) return 'silver';
  return 'bronze';
}

// Per-player invite state (in-process; replace with DB-backed in prod)
const playerInviteState = new Map<string, {
  dailyCount: number;
  dayStart: number;
  lastInviteAt: number;
  suppressed: boolean;
  successfulInvites: number;
  code: string | null;
}>();

const MAX_DAILY_INVITES = 10;
const BASE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes, escalates
const BASE_URL = process.env.APP_BASE_URL ?? 'https://app.pointzeroonedigital.com';

function getOrInitState(playerId: string) {
  if (!playerInviteState.has(playerId)) {
    playerInviteState.set(playerId, {
      dailyCount: 0,
      dayStart: Date.now(),
      lastInviteAt: 0,
      suppressed: false,
      successfulInvites: 0,
      code: null,
    });
  }
  return playerInviteState.get(playerId)!;
}

export const ReferralService = {
  async checkEligibility(playerId: string): Promise<ReferralEligibility> {
    const state = getOrInitState(playerId);
    const now = Date.now();

    // Reset daily counter at midnight UTC
    const msIntoDay = now % (24 * 60 * 60 * 1000);
    if (now - state.dayStart >= 24 * 60 * 60 * 1000) {
      state.dailyCount = 0;
      state.dayStart = now - msIntoDay;
    }

    if (state.suppressed) {
      return { canInvite: false, reason: 'suppressed', invitesRemainingToday: 0 };
    }

    if (state.dailyCount >= MAX_DAILY_INVITES) {
      const nextDayAt = new Date(state.dayStart + 24 * 60 * 60 * 1000).toISOString();
      return { canInvite: false, reason: 'daily_limit_reached', cooldownEndsAt: nextDayAt, invitesRemainingToday: 0 };
    }

    // Escalating cooldown: cooldown doubles with each invite
    const cooldownMs = BASE_COOLDOWN_MS * Math.pow(1.5, state.dailyCount);
    const elapsed = now - state.lastInviteAt;
    if (state.lastInviteAt > 0 && elapsed < cooldownMs) {
      const cooldownEndsAt = new Date(state.lastInviteAt + cooldownMs).toISOString();
      return { canInvite: false, reason: 'cooldown_active', cooldownEndsAt, invitesRemainingToday: MAX_DAILY_INVITES - state.dailyCount };
    }

    return { canInvite: true, invitesRemainingToday: MAX_DAILY_INVITES - state.dailyCount };
  },

  async getOrCreateReferralLink(playerId: string, inviteType: InviteType): Promise<ReferralLink> {
    const state = getOrInitState(playerId);
    const now = Date.now();

    // Idempotent: reuse existing code
    if (!state.code) {
      state.code = `PZO-${playerId.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    }

    state.dailyCount++;
    state.lastInviteAt = now;

    const nextCooldownMs = BASE_COOLDOWN_MS * Math.pow(1.5, state.dailyCount);

    return {
      code: state.code,
      url: `${BASE_URL}/join?ref=${state.code}`,
      inviteType,
      rewardTier: computeRewardTier(state.successfulInvites),
      successfulInvites: state.successfulInvites,
      nextCooldownSeconds: Math.ceil(nextCooldownMs / 1000),
      expiresAt: null,  // referral codes don't expire in Season 0
    };
  },

  async creditReferral(referralCode: string, newPlayerId: string): Promise<void> {
    // TODO: look up referrer by code, increment successfulInvites, unlock tier reward
    void referralCode;
    void newPlayerId;
  },
};

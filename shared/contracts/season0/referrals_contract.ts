/**
 * Referrals Contract for Season 0
 */

type ReferralCode = string;

interface Invite {
    referrer: string;
    invitee: string;
    createdAt: Date;
}

interface Acceptance {
    inviteId: string;
    acceptor: string;
    acceptedAt: Date;
}

interface Completion {
    acceptanceId: string;
    completedAt: Date;
}

type Limit = {
    maxReferralsPerUser: number;
    maxActiveReferrals: number;
}

type RewardUnlockEvent = {
    rewardId: string;
    unlockedAt: Date;
}

/**
 * Referral limits for a user in Season 0.
 */
const limits: Limit = {
    maxReferralsPerUser: 10,
    maxActiveReferrals: 5,
};

export { ReferralCode, Invite, Acceptance, Completion, limits, RewardUnlockEvent };

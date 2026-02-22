/**
 * StreakService — Streak state reads + retention loop summaries.
 * Wraps src/services/streaks/streaks_impl.ts and grace_rules_registry.ts.
 */

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityAt: string;
  resetsAt: string;
  graceActive: boolean;
  freezesRemaining: number;
  freezeExpiresAt?: string;
  graceWindowEndsAt?: string;
  activeMissions: Mission[];
}

export interface Mission {
  missionId: string;
  title: string;
  description: string;
  rewardBP: number;
  completedAt: string | null;
}

export interface RetentionLoops {
  streak: StreakLoopState;
  event: EventLoopState;
  collection: CollectionLoopState;
  social: SocialLoopState;
}

export interface StreakLoopState {
  active: boolean;
  currentStreak: number;
  nextMilestone: number;
  rewardAt: number;
}

export interface EventLoopState {
  activeEventId: string | null;
  eventName: string | null;
  endsAt: string | null;
  progressPercent: number;
}

export interface CollectionLoopState {
  totalCollected: number;
  totalAvailable: number;
  recentUnlocks: string[];
}

export interface SocialLoopState {
  referralCount: number;
  activeAlliances: number;
  recentTrades: number;
}

export const StreakService = {
  async getStreakState(playerId: string): Promise<StreakState> {
    // TODO: SELECT from streaks WHERE user_id = $1 (src/services/streaks/streaks_impl.ts)
    void playerId;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(23, 59, 59, 999);

    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityAt: now.toISOString(),
      resetsAt: tomorrow.toISOString(),
      graceActive: false,
      freezesRemaining: 3,
      freezeExpiresAt: undefined,
      graceWindowEndsAt: undefined,
      activeMissions: [
        {
          missionId: 'M_FIRST_LOGIN',
          title: 'First Login',
          description: 'Log in for the first time during Season 0.',
          rewardBP: 100,
          completedAt: now.toISOString(),
        },
        {
          missionId: 'M_CLAIM_PHASE',
          title: 'Complete the Claim Phase',
          description: 'Claim your founding member resources.',
          rewardBP: 500,
          completedAt: null,
        },
      ],
    };
  },

  async getRetentionLoops(playerId: string): Promise<RetentionLoops> {
    // TODO: aggregate from multiple tables
    void playerId;

    return {
      streak: {
        active: false,
        currentStreak: 0,
        nextMilestone: 7,
        rewardAt: 7,
      },
      event: {
        activeEventId: null,
        eventName: null,
        endsAt: null,
        progressPercent: 0,
      },
      collection: {
        totalCollected: 0,
        totalAvailable: 50,
        recentUnlocks: [],
      },
      social: {
        referralCount: 0,
        activeAlliances: 0,
        recentTrades: 0,
      },
    };
  },
};

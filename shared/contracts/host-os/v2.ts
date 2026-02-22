/**
 * Shared contracts for Point Zero One Digital v2
 */

/**
 * Interface representing the onboarding funnel for a host in the game.
 */
export interface HostOnboardingFunnel {
  /**
   * The unique identifier for this onboarding funnel.
   */
  id: string;

  /**
   * The current step of the onboarding funnel.
   */
  currentStep: number;

  /**
   * The total number of steps in the onboarding funnel.
   */
  totalSteps: number;
}

/**
 * Interface representing a streak reward for a host in the game.
 */
export interface HostStreakReward {
  /**
   * The unique identifier for this streak reward.
   */
  id: string;

  /**
   * The number of consecutive days the host has played the game to earn this reward.
   */
  streak: number;

  /**
   * The reward given to the host for achieving this streak.
   */
  reward: number;
}

/**
 * Interface representing community matchmaking in the game.
 */
export interface CommunityMatchmaking {
  /**
   * The unique identifier for this matchmaking session.
   */
  id: string;

  /**
   * The host of the matchmaking session.
   */
  hostId: string;

  /**
   * The number of players in the matchmaking session.
   */
  playerCount: number;
}

/**
 * Interface representing a packaging job for clip creation.
 */
export interface ClipPackagingJob {
  /**
   * The unique identifier for this packaging job.
   */
  id: string;

  /**
   * The ID of the clip being packaged.
   */
  clipId: string;

  /**
   * The status of the packaging job.
   */
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Interface representing a weekly highlight reel in the game.
 */
export interface WeeklyHighlightReel {
  /**
   * The unique identifier for this weekly highlight reel.
   */
  id: string;

  /**
   * The week number of the highlight reel.
   */
  weekNumber: number;

  /**
   * An array of clips included in the highlight reel.
   */
  clips: string[];
}

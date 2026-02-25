/**
 * Founder Tier Logic Service for Season 0
 */
export interface FounderTier {
  id: number;
  userId: number;
  tier: string;
  streak: number;
  referrals: number;
  events: string[];
  createdAt: Date;
}

/**
 * Assigns founder tiers based on the given rules.
 * @param userId - The user ID to assign a tier for.
 * @param streak - The current streak of the user.
 * @param referrals - The number of users referred by the user.
 * @param events - The list of events participated by the user.
 * @returns The assigned founder tier.
 */
export function assignFounderTier(userId: number, streak: number, referrals: number, events: string[]): FounderTier {
  // Implement the logic to assign the founder tier based on the rules provided.
}

/**
 * Checks if a user is eligible for an upgrade in their founder tier.
 * @param userId - The user ID to check eligibility for.
 * @returns True if the user is eligible for an upgrade, false otherwise.
 */
export function isEligibleForUpgrade(userId: number): boolean {
  // Implement the logic to check if a user is eligible for an upgrade in their founder tier.
}

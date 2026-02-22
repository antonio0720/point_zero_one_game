/**
 * Season0Membership contract for Point Zero One Digital's financial roguelike game.
 */

type Season0Membership = {
  id: number;
  playerId: string;
  tier: FounderTier;
  artifactBundle?: ArtifactBundle;
  countdownStatus: CountdownStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Defines the different tiers for Season 0 memberships.
 */
type FounderTier = 'Founder' | 'EarlyBird' | 'Standard';

/**
 * Represents a bundle of artifacts that can be associated with a Season0Membership.
 */
type ArtifactBundle = {
  id: number;
  name: string;
  description: string;
}

/**
 * Tracks the status of the countdown for a given Season0Membership.
 */
enum CountdownStatus {
  Active = 'active',
  Inactive = 'inactive'
}

/**
 * Grants receipts for various actions within the game.
 */
type Receipt = {
  id: number;
  playerId: string;
  action: string;
  timestamp: Date;
}

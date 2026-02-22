/**
 * LadderType: CASUAL or VERIFIED
 */
export enum LadderType {
  CASUAL = 'CASUAL',
  VERIFIED = 'VERIFIED'
}

/**
 * RankEntry represents a player's rank in a specific ladder.
 */
export interface RankEntry {
  /** Unique identifier for the rank entry */
  id: number;

  /** Player's unique identifier */
  playerId: number;

  /** The ladder type (CASUAL or VERIFIED) */
  ladderType: LadderType;

  /** Rank position within the ladder */
  rank: number;

  /** Score associated with the rank */
  score: number;
}

/**
 * PendingPlacement represents a player's pending placement in a ladder.
 */
export interface PendingPlacement {
  /** Unique identifier for the pending placement */
  id: number;

  /** Player's unique identifier */
  playerId: number;

  /** The ladder type (CASUAL or VERIFIED) */
  ladderType: LadderType;

  /** Rank position that the player is pending for */
  rank: number;
}

/**
 * EligibilityChecklist defines the requirements a player must meet to participate in a ladder.
 */
export interface EligibilityChecklist {
  /** Unique identifier for the eligibility checklist */
  id: number;

  /** The ladder type (CASUAL or VERIFIED) */
  ladderType: LadderType;

  /** Minimum score required to participate in the ladder */
  minScore: number;
}

/**
 * PublishState represents the current state of a ladder's publication.
 */
export interface PublishState {
  /** Unique identifier for the publish state */
  id: number;

  /** The ladder type (CASUAL or VERIFIED) */
  ladderType: LadderType;

  /** Current season number */
  season: number;

  /** Whether the ladder is currently published */
  isPublished: boolean;
}

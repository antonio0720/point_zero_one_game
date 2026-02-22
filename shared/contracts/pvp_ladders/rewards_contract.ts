/**
 * Rewards Contract for PvP Ladders
 */

export interface RewardUnlockEvent {
  /** Unique identifier for the event */
  id: number;

  /** Unique identifier of the player who unlocked the reward */
  playerId: number;

  /** Unique identifier of the ladder for which the reward was unlocked */
  ladderId: number;

  /** Unique identifier of the reward that was unlocked */
  rewardId: number;
}

export interface CosmeticPayload {
  /** Unique identifier for the cosmetic item */
  id: number;

  /** Name of the cosmetic item */
  name: string;

  /** Description of the cosmetic item */
  description: string;

  /** Image URL of the cosmetic item */
  imageUrl: string;
}

export interface LadderRewards {
  /** Unique identifier for the ladder's rewards */
  id: number;

  /** Unique identifier of the ladder */
  ladderId: number;

  /** Array of reward unlock events for the ladder */
  unlockEvents: RewardUnlockEvent[];

  /** Array of cosmetic-only payloads for the ladder */
  cosmeticPayloads: CosmeticPayload[];
}

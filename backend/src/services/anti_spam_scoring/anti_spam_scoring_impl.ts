/**
 * AntiSpamScoringImpl class for calculating anti-spam scores and managing actions such as throttling, sandbox mode, and manual review.
 */
export class AntiSpamScoringImpl {
  /**
   * Calculate the anti-spam score for a given action.
   * @param action - The action to be scored.
   * @returns The calculated anti-spam score.
   */
  public calculateScore(action: Action): number {
    // Implementation details omitted for brevity.
  }

  /**
   * Throttle the given action based on its score and quotas.
   * @param action - The action to be throttled.
   */
  public throttle(action: Action): void {
    // Implementation details omitted for brevity.
  }

  /**
   * Enable sandbox mode for the given user.
   * @param userId - The ID of the user to enable sandbox mode for.
   */
  public enableSandboxMode(userId: number): void {
    // Implementation details omitted for brevity.
  }

  /**
   * Manually review a repeat offender's actions.
   * @param userId - The ID of the user to manually review.
   */
  public manualReview(userId: number): void {
    // Implementation details omitted for brevity.
  }

  /**
   * Record a receipt for an action.
   * @param actionId - The ID of the action.
   * @param userId - The ID of the user who performed the action.
   */
  public recordReceipt(actionId: number, userId: number): void {
    // Implementation details omitted for brevity.
  }
}

/**
 * Represents an action taken by a user in the game.
 */
export interface Action {
  /**
   * The unique ID of the action.
   */
  id: number;

  /**
   * The timestamp when the action was performed.
   */
  timestamp: Date;

  /**
   * The type of the action (e.g., purchase, withdrawal, etc.).
   */
  type: ActionType;
}

/**
 * Represents the type of an action taken by a user in the game.
 */
export enum ActionType {
  PURCHASE = 'purchase',
  WITHDRAWAL = 'withdrawal',
  LOGIN = 'login',
  REGISTRATION = 'registration'
}

SQL schema for receipts table:

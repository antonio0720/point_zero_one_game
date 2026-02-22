/**
 * PatchNoteCard Contract
 */

export interface PatchNoteCard {
  id: number;
  issueId: number;
  metricDelta: number;
  changeShipped: boolean;
  userFacingWording: string;
  rolloutFlags: RolloutFlags;
}

export interface RolloutFlags {
  /**
   * A flag indicating whether this patch note card is visible to all users.
   */
  global: boolean;

  /**
   * A flag indicating whether this patch note card is visible only to a subset of users based on specific criteria.
   */
  targeted: boolean;
}

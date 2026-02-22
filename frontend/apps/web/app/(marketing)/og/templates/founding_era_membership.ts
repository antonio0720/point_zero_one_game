/**
 * Founder Membership Card OG Image Template
 */

export interface FounderMembershipCardData {
  /** The tier of the membership card (e.g., "Founder", "Early Bird", etc.) */
  tier: string;

  /** A unique identifier for the stamp image associated with this tier */
  stampId: number;

  /** The remaining time in seconds until the membership offer ends */
  countdownSeconds: number;
}

export function generateFounderMembershipCardUrl(data: FounderMembershipCardData): string {
  const { tier, stampId, countdownSeconds } = data;
  return `https://point-zero-one-digital.com/founders/${tier}/${stampId}/${countdownSeconds}`;
}

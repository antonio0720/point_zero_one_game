/**
 * Season type definitions for Point Zero One Digital.
 * SeasonPhase maps to the 4-act arc defined in the Season 0 progression spec.
 */

export type SeasonPhase = 'Claim' | 'Build' | 'Proof' | 'Seal';

export type SeasonId = 'season0' | `season${number}`;

export interface SeasonMeta {
  seasonId: SeasonId;
  phase: SeasonPhase;
  referralsEnabled: boolean;
  membershipCardsEnabled: boolean;
  proofStampsEnabled: boolean;
  foundingEraActive: boolean;
  startsAt: string;
  endsAt: string | null;
}

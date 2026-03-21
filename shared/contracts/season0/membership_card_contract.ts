/**
 * Membership Card View Model
 */
export interface MembershipCard {
  id: number;
  ownerId: number;
  cardTypeId: number;
  expirationDate: Date;
  isActive: boolean;
}

/**
 * Proof Gallery Summary Model
 */
export interface ProofGallerySummary {
  id: number;
  membershipCardId: number;
  proofCount: number;
}

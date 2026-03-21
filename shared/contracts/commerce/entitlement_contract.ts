/**
 * Entitlement Contract Interface
 */
export interface EntitlementContract {
  id: number;
  entitlementId: number;
  productId: number;
  attachmentRuleId: number;
  compatibilityRank: number;
  isActive: boolean;
}

/**
 * Entitlement Rule Interface
 */
export interface EntitlementRule {
  id: number;
  entitlementId: number;
  productIds: number[];
  compatibilityRanks: number[];
}

Here is the TypeScript file `shared/contracts/remote_config/monetization_policy_contract.ts` as per your specifications:

```typescript
/**
 * Monetization Policy Contract
 */

export interface MonetizationPolicy {
  /**
   * Offer context rules for the monetization policy
   */
  offerContextRules?: OfferContextRule[];

  /**
   * Ladder allowlists for the monetization policy
   */
  ladderAllowlists?: LadderAllowlist[];
}

/**
 * Offer context rule for a specific game or platform
 */
export interface OfferContextRule {
  /**
   * Unique identifier for the offer context rule
   */
  id: string;

  /**
   * Game or platform identifier
   */
  gameOrPlatformId: string;
}

/**
 * Ladder allowlist for a specific game or platform and ladder level
 */
export interface LadderAllowlist {
  /**
   * Unique identifier for the ladder allowlist
   */
  id: string;

  /**
   * Game or platform identifier
   */
  gameOrPlatformId: string;

  /**
   * Ladder level identifier
   */
  ladderLevelId: string;
}

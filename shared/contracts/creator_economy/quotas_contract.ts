Here is the TypeScript file `shared/contracts/creator_economy/quotas_contract.ts` as per your specifications:

```typescript
/**
 * Quotas Contract for Creator Economy
 */

type CreatorLevel = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

interface BurstGrants {
  [creatorLevel: CreatorLevel]: number;
}

interface Throttles {
  [creatorLevel: CreatorLevel]: number;
}

interface AntiSpamScoring {
  [creatorId: string]: number;
}

/**
 * Quotas Contract Interface
 */
export interface QuotasContract {
  creatorLevel: CreatorLevel;
  burstGrants: BurstGrants;
  throttles: Throttles;
  antiSpamScoring: AntiSpamScoring;
}

/**
 * Factory function to create a new Quotas Contract instance
 * @param creatorLevel - The level of the creator
 * @param burstGrants - The number of burst grants for each creator level
 * @param throttles - The throttle limit for each creator level
 */
export function createQuotasContract(
  creatorLevel: CreatorLevel,
  burstGrants: BurstGrants,
  throttles: Throttles
): QuotasContract {
  return { creatorLevel, burstGrants, throttles, antiSpamScoring: {} };
}

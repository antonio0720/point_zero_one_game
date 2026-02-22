Here is the TypeScript file `shared/contracts/ladder/ranked_entitlement_compat_contract.ts` based on your specifications:

```typescript
/**
 * Ranked Entitlement Compatibility Contract
 */

type RankedRunCompatibility = {
  runId: string;
  entitlementId: string;
  compatibility: boolean;
  reason?: string;
};

export type PolicyVersion = {
  version: number;
  policies: Array<RankedRunCompatibility>;
};

/**
 * Enforce strict TypeScript types and export all public symbols.
 */
declare global {
  namespace NodeJS {
    interface Global {
      RankedEntitlementCompatContract: {
        RankedRunCompatibility: typeof RankedRunCompatibility;
        PolicyVersion: typeof PolicyVersion;
      };
    }
  }
}

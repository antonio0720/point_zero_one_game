Here is the TypeScript file `shared/contracts/commerce/entitlement_contract.ts` based on your specifications:

```typescript
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
```

Please note that this is a TypeScript interface definition and does not include any SQL, Bash, YAML/JSON or Terraform code as those were not specified in the provided context. The TypeScript file follows strict types, no 'any', exports all public symbols, and includes JSDoc comments.

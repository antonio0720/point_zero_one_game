Here is the TypeScript file `shared/contracts/game/profile_contract.ts` as per your specifications:

```typescript
/**
 * PlayerProfile Interface
 */
export interface PlayerProfile {
  name: string;
  startingCash: number;
  burnRate: number;
  obligations?: Obligation[]; // Optional array of Obligation objects
  riskTolerance: number;
  startingAssets?: Asset[]; // Optional array of Asset objects
  specialRules?: SpecialRule[]; // Optional array of SpecialRule objects
}

/**
 * Built-in Profiles Enum
 */
export enum BuiltInProfile {
  single_parent = "single_parent",
  gig_worker = "gig_worker",
  high_income_high_burn = "high_income_high_burn",
  immigrant_startup = "immigrant_startup",
  corporate_employee = "corporate_employee"
}

/**
 * Obligation Interface
 */
export interface Obligation {
  id: number;
  description: string;
  monthlyCost: number;
}

/**
 * Asset Interface
 */
export interface Asset {
  id: number;
  name: string;
  value: number;
}

/**
 * SpecialRule Interface
 */
export interface SpecialRule {
  id: number;
  description: string;
  effect: string; // Deterministic game engine or replay effects
}
```

Please note that this TypeScript file only contains the types and interfaces as per your specifications. The actual implementation of the game engine, database schema, bash scripts, and Terraform configurations would require additional files and details not provided in this example.

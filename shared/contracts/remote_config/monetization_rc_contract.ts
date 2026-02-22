Here is the TypeScript file `shared/contracts/remote_config/monetization_rc_contract.ts` as per your specifications:

```typescript
/**
 * Remote Config Contract for Monetization
 */

export interface Offer {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
}

export interface Bundle {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  offers: Offer[];
}

export interface Pricing {
  basePrice: number;
  bundleDiscount: number;
}

export interface Copy {
  id: number;
  language: string;
  name: string;
  description: string;
}

export interface MonetizationRemoteConfig {
  offers: Offer[];
  bundles: Bundle[];
  pricing: Pricing;
  copy: { [key: string]: Copy };
}

/**
 * Strict TypeScript configuration for the project.
 */
type Config = MonetizationRemoteConfig;

Here is the TypeScript file `shared/contracts/biometric/biometric_contract.ts` as per your specifications:

```typescript
/**
 * Biometric Contract Interface
 */
export enum StressLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH"
}

export interface BiometricSession {
  id: number;
  user_id: number;
  timestamp: Date;
  stress_score: number;
  stress_level: StressLevel;
  stress_multiplier: number;
  consent_granted: boolean;
}

/**
 * Biometric Consent Interface
 */
export interface BiometricConsent {
  id: number;
  user_id: number;
  timestamp: Date;
  active: boolean;
}

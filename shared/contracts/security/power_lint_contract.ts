Here is the TypeScript file `shared/contracts/security/power_lint_contract.ts` based on your specifications:

```typescript
/**
 * Power-Lint Job Contract Interface
 */
export interface PowerLintJobContract {
  /**
   * Baseline vs Treatment Survival Probability Test Inputs
   */
  baselineData: BaselineData[];
  treatmentData: TreatmentData[];

  /**
   * Thresholding Parameters
   */
  survivalProbabilityThreshold: number;
  significanceLevel: number;

  /**
   * Attestation Receipt
   */
  attestationReceipt: string;
}

/**
 * Baseline Data Interface
 */
export interface BaselineData {
  id: number;
  experimentId: number;
  survivalTime: number;
  isAlive: boolean;
}

/**
 * Treatment Data Interface
 */
export interface TreatmentData {
  id: number;
  experimentId: number;
  survivalTime: number;
  isAlive: boolean;
}

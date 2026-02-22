Here is the TypeScript file `shared/contracts/loss_is_content/counterfactual_fork_contract.ts` as per your specifications:

```typescript
/**
 * Counterfactual Fork Contract
 */

export interface ForkRequest {
  /** Unique identifier for the fork request */
  id: string;

  /** Timestamp when the fork request was created */
  timestamp: number;

  /** The game state snapshot pointer associated with this fork request */
  snapshotPointer: string;

  /** Flag indicating whether this fork request is for practice purposes only */
  practiceOnly: boolean;

  /** Eligibility lock to prevent concurrent fork requests */
  eligibilityLock: string;
}

/**
 * Validates a ForkRequest object
 * @param request The ForkRequest object to validate
 * @returns True if the request is valid, false otherwise
 */
export function isValidForkRequest(request: ForkRequest): boolean {
  // Implement validation logic here
}

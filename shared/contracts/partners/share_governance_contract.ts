Here is the TypeScript file `share_governance_contract.ts` following your specifications:

```typescript
/**
 * Share Governance Contract for partners in Slack/Teams contexts
 */

export interface ProofCard {
  /** Unique identifier for the proof card */
  id: string;
  /** The content of the proof card */
  content: string;
}

export interface ExplorerLink {
  /** Unique identifier for the explorer link */
  id: string;
  /** The URL of the explorer link */
  url: string;
}

/**
 * Partner Governance Contract Interface
 */
export interface PartnerGovernanceContract {
  /** Unique identifier for the governance contract */
  id: string;
  /** Array of proof cards associated with the contract */
  proofCards: ProofCard[];
  /** Array of explorer links associated with the contract */
  explorerLinks: ExplorerLink[];
}

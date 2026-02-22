Here is the TypeScript file `shared/contracts/creator_economy/moderation_contract.ts` based on your specifications:

```typescript
/**
 * Moderation Contract for Creator Economy
 */

type ToxicityScanOutput = {
  id: number;
  creatorId: number;
  contentHash: string;
  toxicityScore: number;
  timestamp: Date;
};

type EvidenceChainRef = {
  id: number;
  moderationContractId: number;
  evidenceItemId: number;
  sequenceNumber: number;
};

type RedactedCreatorSummary = {
  id: number;
  creatorId: number;
  summary: string; // redacted for creator-facing purposes
};

type AdminForensicBundleRef = {
  id: number;
  moderationContractId: number;
  forensicBundleId: number;
};

/**
 * Moderation Contract Interface
 */
export interface IModerationContract {
  id: number;
  creatorId: number;
  toxicityScanOutputs: ToxicityScanOutput[];
  evidenceChainRefs: EvidenceChainRef[];
  redactedCreatorSummaries: RedactedCreatorSummary[];
  adminForensicBundleRefs: AdminForensicBundleRef[];
}

/**
 * Moderation Contract Class
 */
export class ModerationContract implements IModerationContract {
  id: number;
  creatorId: number;
  toxicityScanOutputs: ToxicityScanOutput[];
  evidenceChainRefs: EvidenceChainRef[];
  redactedCreatorSummaries: RedactedCreatorSummary[];
  adminForensicBundleRefs: AdminForensicBundleRef[];
}

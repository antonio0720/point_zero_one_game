Here is the TypeScript file `shared/contracts/share/share_contract.ts`:

```typescript
/**
 * ShareableArtifact types for Point Zero One Digital's financial roguelike game.
 */

/**
 * BalanceSheetCard interface representing a balance sheet card.
 */
export interface BalanceSheetCard {
  id: number;
  name: string;
  description: string;
  asset: Asset;
  liability: Liability;
}

/**
 * CauseOfDeathCard interface representing a cause of death card.
 */
export interface CauseOfDeathCard {
  id: number;
  name: string;
  description: string;
}

/**
 * DealFlipCard interface representing a deal flip card.
 */
export interface DealFlipCard {
  id: number;
  name: string;
  description: string;
  sideA: Side;
  sideB: Side;
}

/**
 * RegretCard interface representing a regret card.
 */
export interface RegretCard {
  id: number;
  name: string;
  description: string;
}

/**
 * ProofCard interface representing a proof card.
 */
export interface ProofCard {
  id: number;
  name: string;
  description: string;
  proofValue: number;
}

/**
 * ClipMoment interface representing a clip moment.
 */
export interface ClipMoment {
  id: number;
  name: string;
  description: string;
  timestamp: Date;
}

/**
 * OG metadata shape for game objects.
 */
export interface OGMetadata {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
}

/**
 * Asset interface representing a financial asset.
 */
export interface Asset {
  id: number;
  name: string;
  value: number;
}

/**
 * Liability interface representing a financial liability.
 */
export interface Liability {
  id: number;
  name: string;
  value: number;
}

/**
 * Side interface for DealFlipCard, representing one side of the deal.
 */
export interface Side {
  asset: Asset;
  liability: Liability;
}

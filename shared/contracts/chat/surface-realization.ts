/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT SURFACE REALIZATION CONTRACTS
 * FILE: shared/contracts/chat/surface-realization.ts
 * ============================================================================
 */

export type SharedChatRealizationTransform =
  | 'SHORTER_COLDER'
  | 'LONGER_CEREMONIAL'
  | 'MORE_DIRECT'
  | 'MORE_MOCKING'
  | 'MORE_INTIMATE'
  | 'MORE_PUBLIC'
  | 'MORE_POST_EVENT'
  | 'MORE_PRE_EVENT'
  | 'PRESSURE_REWRITE'
  | 'CALLBACK_REWRITE'
  | 'PERSONAL_HISTORY_REWRITE';

export type SharedChatRealizationTone =
  | 'ICE'
  | 'COLD'
  | 'CONTROLLED'
  | 'HOT'
  | 'RITUAL';

export interface SharedCanonicalChatLine {
  readonly canonicalLineId: string;
  readonly botId: string;
  readonly category: string;
  readonly text: string;
  readonly tags?: readonly string[];
  readonly motifId?: string;
  readonly rhetoricalForm?: string;
  readonly sceneRoles?: readonly string[];
  readonly botObjective?: string;
  readonly emotionPayload?: string;
  readonly targetPlayerTrait?: string;
}

export interface SharedChatRealizationContext {
  readonly now: number;
  readonly sceneId?: string;
  readonly sceneArchetype?: string;
  readonly sceneRole?: string;
  readonly pressureBand?: string;
  readonly relationshipEscalationTier?: string;
  readonly respect?: number;
  readonly contempt?: number;
  readonly fear?: number;
  readonly fascination?: number;
  readonly callbackText?: string;
  readonly callbackAnchorId?: string;
  readonly playerAlias?: string;
  readonly publicFacing?: boolean;
  readonly transforms?: readonly SharedChatRealizationTransform[];
}

export interface SharedChatRealizationResult {
  readonly canonicalLineId: string;
  readonly surfaceVariantId: string;
  readonly strategy: string;
  readonly realizedText: string;
  readonly transformsApplied: readonly SharedChatRealizationTransform[];
  readonly rhetoricalTemplateIds: readonly string[];
  readonly semanticClusterIds: readonly string[];
  readonly tags: readonly string[];
}

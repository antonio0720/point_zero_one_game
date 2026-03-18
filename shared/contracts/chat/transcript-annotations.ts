/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT TRANSCRIPT ANNOTATION CONTRACTS
 * FILE: shared/contracts/chat/transcript-annotations.ts
 * ============================================================================
 */

export interface SharedChatTranscriptCallbackReference {
  readonly callbackId: string;
  readonly callbackType:
    | 'QUOTE'
    | 'MEMORY'
    | 'HUMILIATION'
    | 'COMEBACK'
    | 'RESCUE'
    | 'DEAL_ROOM'
    | 'WORLD_EVENT'
    | 'SOVEREIGNTY';
  readonly payloadRef: string;
}

export interface SharedChatTranscriptSceneAnnotation {
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly eventIds?: readonly string[];
  readonly semanticClusterIds?: readonly string[];
  readonly rhetoricalTemplateIds?: readonly string[];
  readonly callbackRefs?: readonly SharedChatTranscriptCallbackReference[];
  readonly relatedMemoryAnchorIds?: readonly string[];
  readonly transcriptTags?: readonly string[];
  readonly canonicalLineId?: string;
  readonly surfaceVariantId?: string;
  readonly realizationStrategy?: string;
}

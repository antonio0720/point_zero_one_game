/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT SEMANTIC SIMILARITY CONTRACTS
 * FILE: shared/contracts/chat/semantic-similarity.ts
 * VERSION: 2026.03.17-phase4
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Shared contract surface for semantic repetition control, rhetorical-template
 * detection, hashed-embedding snapshots, and novelty-guard decisions.
 *
 * These contracts are transport-safe. They let frontend advisory ranking,
 * backend authoritative ranking, and realtime server guards exchange semantic
 * context without sharing implementation-only state.
 * ============================================================================
 */

export type ChatSemanticPressureBand =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type ChatSemanticRhetoricalForm =
  | 'THREAT_DECLARATIVE'
  | 'REPRICING_DECLARATIVE'
  | 'SYSTEMIC_INEVITABILITY'
  | 'PROCEDURAL_DELAY'
  | 'PREDICTIVE_PROFILE'
  | 'STRUCTURAL_ASYMMETRY'
  | 'CALLBACK_WOUND'
  | 'RESCUE_STABILIZER'
  | 'WITNESS_JUDGMENT'
  | 'SILENCE_MARKER'
  | 'UNKNOWN';

export interface ChatSemanticSparseVectorEntry {
  readonly dimension: number;
  readonly value: number;
}

export interface ChatSemanticDocumentInput {
  readonly documentId: string;
  readonly canonicalLineId?: string;
  readonly actorId?: string | null;
  readonly botId?: string | null;
  readonly text: string;
  readonly createdAt: number;
  readonly tags?: readonly string[];
  readonly motifIds?: readonly string[];
  readonly sceneRoles?: readonly string[];
  readonly callbackSourceIds?: readonly string[];
  readonly pressureBand?: ChatSemanticPressureBand;
}

export interface ChatSemanticIndexedDocument {
  readonly documentId: string;
  readonly canonicalLineId?: string;
  readonly actorId?: string | null;
  readonly botId?: string | null;
  readonly text: string;
  readonly normalizedText: string;
  readonly tokens: readonly string[];
  readonly weightedTerms: Readonly<Record<string, number>>;
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly rhetoricalFingerprint: string;
  readonly semanticClusterId: string;
  readonly sparseVector: readonly ChatSemanticSparseVectorEntry[];
  readonly vectorNorm: number;
  readonly tags: readonly string[];
  readonly motifIds: readonly string[];
  readonly sceneRoles: readonly string[];
  readonly callbackSourceIds: readonly string[];
  readonly pressureBand?: ChatSemanticPressureBand;
  readonly createdAt: number;
}

export interface ChatSemanticNeighbor {
  readonly documentId: string;
  readonly canonicalLineId?: string;
  readonly similarity01: number;
  readonly semanticClusterId: string;
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly overlapTokens: readonly string[];
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface ChatSemanticIndexSnapshot {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly dimensions: number;
  readonly documents: readonly ChatSemanticIndexedDocument[];
  readonly clusterMembership: Readonly<Record<string, readonly string[]>>;
}

export interface ChatSemanticQuery {
  readonly queryId: string;
  readonly text: string;
  readonly now: number;
  readonly maxResults?: number;
  readonly minSimilarity01?: number;
  readonly excludedDocumentIds?: readonly string[];
  readonly preferredTags?: readonly string[];
  readonly sceneRoles?: readonly string[];
  readonly pressureBand?: ChatSemanticPressureBand;
}

export interface ChatSemanticQueryResult {
  readonly queryId: string;
  readonly computedAt: number;
  readonly queryDocument: ChatSemanticIndexedDocument;
  readonly neighbors: readonly ChatSemanticNeighbor[];
}

export interface ChatSemanticNoveltyGuardConfig {
  readonly maxSimilarityToRecent01: number;
  readonly maxSimilarityToClusterLeader01: number;
  readonly maxRecentClusterReuses: number;
  readonly rhetoricalFatigueThreshold01: number;
  readonly exactTextPenalty01: number;
  readonly rhetoricalPenalty01: number;
  readonly clusterPenalty01: number;
  readonly tokenOverlapPenalty01: number;
}

export interface ChatSemanticNoveltyGuardRequest {
  readonly requestId: string;
  readonly candidate: ChatSemanticDocumentInput;
  readonly now: number;
  readonly recentDocuments: readonly ChatSemanticIndexedDocument[];
  readonly recentClusterIds?: readonly string[];
  readonly recentRhetoricalFingerprints?: readonly string[];
  readonly config?: Partial<ChatSemanticNoveltyGuardConfig>;
}

export interface ChatSemanticNoveltyDecision {
  readonly requestId: string;
  readonly computedAt: number;
  readonly candidateDocument: ChatSemanticIndexedDocument;
  readonly allowed: boolean;
  readonly noveltyScore01: number;
  readonly fatigueScore01: number;
  readonly highestSimilarity01: number;
  readonly repeatedClusterCount: number;
  readonly repeatedRhetoricalCount: number;
  readonly nearestNeighbors: readonly ChatSemanticNeighbor[];
  readonly blockedReasons: readonly string[];
}

export const DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD: ChatSemanticNoveltyGuardConfig = {
  maxSimilarityToRecent01: 0.92,
  maxSimilarityToClusterLeader01: 0.965,
  maxRecentClusterReuses: 3,
  rhetoricalFatigueThreshold01: 0.70,
  exactTextPenalty01: 0.65,
  rhetoricalPenalty01: 0.18,
  clusterPenalty01: 0.22,
  tokenOverlapPenalty01: 0.16,
};

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

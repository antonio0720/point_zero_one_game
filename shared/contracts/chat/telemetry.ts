/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT INTELLIGENCE TELEMETRY CONTRACTS
 * FILE: shared/contracts/chat/telemetry.ts
 * VERSION: 2026.03.17-phase4
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 */

export type ChatIntelligenceTelemetryEventName =
  | 'semantic_index_built'
  | 'semantic_candidate_scored'
  | 'semantic_candidate_blocked'
  | 'novelty_event_recorded'
  | 'novelty_candidate_ranked'
  | 'memory_record_persisted'
  | 'memory_callback_selected'
  | 'relationship_shift_applied'
  | 'scene_archived'
  | 'scene_summary_generated'
  | 'player_model_updated'
  | 'server_guard_screened';

export interface ChatIntelligenceTelemetryEnvelope<TPayload = Record<string, unknown>> {
  readonly telemetryId: string;
  readonly eventName: ChatIntelligenceTelemetryEventName;
  readonly occurredAt: number;
  readonly playerId?: string | null;
  readonly sessionId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly payload: Readonly<TPayload>;
}

export interface ChatSemanticTelemetryPayload {
  readonly queryId?: string;
  readonly candidateId?: string;
  readonly semanticClusterId?: string;
  readonly rhetoricalFingerprint?: string;
  readonly highestSimilarity01?: number;
  readonly noveltyScore01?: number;
  readonly fatigueScore01?: number;
  readonly blockedReasons?: readonly string[];
}

export interface ChatNoveltyTelemetryPayload {
  readonly requestId?: string;
  readonly candidateIds?: readonly string[];
  readonly recommendedCandidateId?: string;
  readonly totalEvents?: number;
  readonly totalUniqueLines?: number;
  readonly dominantMotifs?: readonly string[];
  readonly dominantClusters?: readonly string[];
}

export interface ChatMemoryTelemetryPayload {
  readonly memoryId?: string;
  readonly callbackId?: string;
  readonly eventType?: string;
  readonly unresolved?: boolean;
  readonly timesReused?: number;
  readonly salience01?: number;
}

export interface ChatRelationshipTelemetryPayload {
  readonly counterpartId?: string;
  readonly stance?: string;
  readonly objective?: string;
  readonly intensity01?: number;
  readonly volatility01?: number;
  readonly dominantAxes?: readonly string[];
}

export interface ChatSceneArchiveTelemetryPayload {
  readonly archiveId?: string;
  readonly sceneId?: string;
  readonly archetype?: string;
  readonly momentType?: string;
  readonly beatCount?: number;
  readonly callbackAnchorIds?: readonly string[];
  readonly transcriptAnnotationCount?: number;
}

export interface ChatPlayerModelTelemetryPayload {
  readonly profileId?: string;
  readonly dominantTraits?: readonly string[];
  readonly impulsive01?: number;
  readonly noveltySeeking01?: number;
  readonly procedureAware01?: number;
  readonly bluffHeavy01?: number;
  readonly publicPerformer01?: number;
}

/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT NOVELTY CONTRACTS
 * FILE: shared/contracts/chat/novelty.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Shared novelty and anti-repetition contracts for frontend + backend chat.
 * These types are transport-safe and intentionally persistence-friendly.
 * ============================================================================
 */

export type NoveltyScope = 'SESSION' | 'DAY' | 'WEEK' | 'SEASON' | 'CAREER';

export type NoveltyFacet =
  | 'LINE'
  | 'MOTIF'
  | 'RHETORICAL_FORM'
  | 'SCENE_ROLE'
  | 'PRESSURE_BAND'
  | 'CHANNEL'
  | 'COUNTERPART'
  | 'SEMANTIC_CLUSTER'
  | 'CALLBACK_SOURCE'
  | 'TAG';

export type NoveltyPressureBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NoveltyWindowPolicy {
  readonly scope: NoveltyScope;
  readonly lookbackMs: number;
  readonly exactRepeatPenalty: number;
  readonly motifPenalty: number;
  readonly rhetoricPenalty: number;
  readonly semanticPenalty: number;
  readonly channelPenalty: number;
  readonly callbackPenalty: number;
  readonly decayHalfLifeMs: number;
}

export interface NoveltyFacetCounter {
  readonly key: string;
  readonly facet: NoveltyFacet;
  readonly firstSeenAt: number;
  readonly lastSeenAt: number;
  readonly totalSeen: number;
  readonly sessionSeen: number;
  readonly daySeen: number;
  readonly weekSeen: number;
  readonly seasonSeen: number;
  readonly careerSeen: number;
}

export interface NoveltyCandidateDescriptor {
  readonly candidateId: string;
  readonly lineId?: string;
  readonly botId?: string | null;
  readonly channelId?: string | null;
  readonly roomId?: string | null;
  readonly counterpartId?: string | null;
  readonly motifIds?: readonly string[];
  readonly rhetoricalForms?: readonly string[];
  readonly sceneRoles?: readonly string[];
  readonly semanticClusterIds?: readonly string[];
  readonly callbackSourceIds?: readonly string[];
  readonly pressureBand?: NoveltyPressureBand;
  readonly tags?: readonly string[];
  readonly text?: string;
}

export interface NoveltyCandidateScoreBreakdown {
  readonly candidateId: string;
  readonly noveltyScore01: number;
  readonly penaltyTotal: number;
  readonly exactLinePenalty: number;
  readonly motifPenalty: number;
  readonly rhetoricPenalty: number;
  readonly semanticPenalty: number;
  readonly pressurePenalty: number;
  readonly scenePenalty: number;
  readonly channelPenalty: number;
  readonly counterpartPenalty: number;
  readonly callbackPenalty: number;
  readonly tagPenalty: number;
  readonly freshnessBoost: number;
  readonly unseenFacetBoost: number;
  readonly fatigueRisk: number;
  readonly notes: readonly string[];
}

export interface NoveltyEventRecord {
  readonly eventId: string;
  readonly occurredAt: number;
  readonly playerId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly counterpartId?: string | null;
  readonly lineId?: string | null;
  readonly motifIds: readonly string[];
  readonly rhetoricalForms: readonly string[];
  readonly sceneRoles: readonly string[];
  readonly semanticClusterIds: readonly string[];
  readonly callbackSourceIds: readonly string[];
  readonly pressureBand?: NoveltyPressureBand;
  readonly tags: readonly string[];
  readonly rawText?: string | null;
}

export interface NoveltyFatigueSnapshot {
  readonly channelId: string;
  readonly fatigue01: number;
  readonly lastUpdatedAt: number;
  readonly dominantMotifs: readonly string[];
  readonly dominantRhetoricalForms: readonly string[];
  readonly dominantSemanticClusters: readonly string[];
  readonly recentExactLines: readonly string[];
  readonly recentCounterparts: readonly string[];
}

export interface NoveltyLedgerSnapshot {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly playerId?: string | null;
  readonly seasonId?: string | null;
  readonly counters: readonly NoveltyFacetCounter[];
  readonly recentEvents: readonly NoveltyEventRecord[];
  readonly fatigueByChannel: readonly NoveltyFatigueSnapshot[];
  readonly totalEvents: number;
  readonly totalUniqueLines: number;
  readonly totalUniqueMotifs: number;
  readonly totalUniqueRhetoricalForms: number;
  readonly totalUniqueSemanticClusters: number;
}

export interface NoveltyRankingRequest {
  readonly requestId: string;
  readonly createdAt: number;
  readonly playerId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly candidates: readonly NoveltyCandidateDescriptor[];
}

export interface NoveltyRankingResult {
  readonly requestId: string;
  readonly rankedCandidates: readonly NoveltyCandidateScoreBreakdown[];
  readonly recommendedCandidateId?: string;
  readonly computedAt: number;
}

export const DEFAULT_NOVELTY_WINDOWS: readonly NoveltyWindowPolicy[] = [
  {
    scope: 'SESSION',
    lookbackMs: 6 * 60 * 60 * 1000,
    exactRepeatPenalty: 0.52,
    motifPenalty: 0.22,
    rhetoricPenalty: 0.16,
    semanticPenalty: 0.18,
    channelPenalty: 0.08,
    callbackPenalty: 0.10,
    decayHalfLifeMs: 40 * 60 * 1000,
  },
  {
    scope: 'DAY',
    lookbackMs: 24 * 60 * 60 * 1000,
    exactRepeatPenalty: 0.26,
    motifPenalty: 0.12,
    rhetoricPenalty: 0.10,
    semanticPenalty: 0.12,
    channelPenalty: 0.04,
    callbackPenalty: 0.06,
    decayHalfLifeMs: 6 * 60 * 60 * 1000,
  },
  {
    scope: 'WEEK',
    lookbackMs: 7 * 24 * 60 * 60 * 1000,
    exactRepeatPenalty: 0.14,
    motifPenalty: 0.08,
    rhetoricPenalty: 0.06,
    semanticPenalty: 0.08,
    channelPenalty: 0.03,
    callbackPenalty: 0.05,
    decayHalfLifeMs: 36 * 60 * 60 * 1000,
  },
  {
    scope: 'SEASON',
    lookbackMs: 90 * 24 * 60 * 60 * 1000,
    exactRepeatPenalty: 0.08,
    motifPenalty: 0.04,
    rhetoricPenalty: 0.03,
    semanticPenalty: 0.04,
    channelPenalty: 0.02,
    callbackPenalty: 0.03,
    decayHalfLifeMs: 7 * 24 * 60 * 60 * 1000,
  },
];

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

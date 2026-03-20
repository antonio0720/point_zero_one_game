/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT INTELLIGENCE / DL BARREL
 * FILE: backend/src/game/engine/chat/intelligence/dl/index.ts
 * VERSION: 2026.03.20-retrieval-continuity.v1
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical barrel for retrieval-backed continuity inside the backend
 * intelligence lane.
 *
 * This sits alongside the legacy backend root dl/ lane rather than replacing it.
 * The goal is to:
 * - preserve existing compatibility surfaces,
 * - provide an intelligence-native retrieval continuity authority,
 * - keep imports clean for new backend chat experience / memory / liveops lanes.
 * ============================================================================
 */

export * from './MemoryRankingPolicy';
export * from './MemoryAnchorStore';
export * from './RetrievalContextBuilder';

export const BACKEND_CHAT_INTELLIGENCE_DL_VERSION =
  '2026.03.20-retrieval-continuity.v1' as const;

export const BACKEND_CHAT_INTELLIGENCE_DL_SURFACE = Object.freeze([
  Object.freeze({
    id: 'intelligence.dl.MemoryRankingPolicy',
    relativePath: './MemoryRankingPolicy',
    concern: 'RETRIEVAL_RANKING',
    generated: true,
    ownsTruth: true,
    description: 'Deterministic ranking authority for durable memory anchor retrieval.',
  }),
  Object.freeze({
    id: 'intelligence.dl.MemoryAnchorStore',
    relativePath: './MemoryAnchorStore',
    concern: 'RETRIEVAL_MEMORY',
    generated: true,
    ownsTruth: true,
    description: 'Authoritative durable store for memory anchors, windows, and receipts.',
  }),
  Object.freeze({
    id: 'intelligence.dl.RetrievalContextBuilder',
    relativePath: './RetrievalContextBuilder',
    concern: 'RETRIEVAL_CONTEXT',
    generated: true,
    ownsTruth: true,
    description: 'Deterministic continuity packet builder for downstream chat authoring.',
  }),
]);

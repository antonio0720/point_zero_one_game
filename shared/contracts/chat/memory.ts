/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT MEMORY CONTRACTS
 * FILE: shared/contracts/chat/memory.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Shared episodic memory contracts for frontend + backend chat lanes.
 * ============================================================================
 */

export type EpisodicMemoryEventType =
  | 'HUMILIATION'
  | 'COMEBACK'
  | 'COLLAPSE'
  | 'BREACH'
  | 'RESCUE'
  | 'BLUFF'
  | 'GREED'
  | 'HESITATION'
  | 'OVERCONFIDENCE'
  | 'DISCIPLINE'
  | 'PERFECT_DEFENSE'
  | 'FAILED_GAMBLE'
  | 'SOVEREIGNTY'
  | 'DEAL_ROOM_STANDOFF'
  | 'PUBLIC_WITNESS'
  | 'PRIVATE_CONFESSION';

export type EpisodicMemoryStatus = 'ACTIVE' | 'DORMANT' | 'ARCHIVED' | 'EXPIRED';

export interface EpisodicMemoryTriggerContext {
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly messageId?: string | null;
  readonly sceneId?: string | null;
  readonly momentId?: string | null;
  readonly botId?: string | null;
  readonly counterpartId?: string | null;
  readonly pressureBand?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly tags?: readonly string[];
  readonly summary: string;
  readonly rawText?: string | null;
}

export interface EpisodicMemoryCallbackVariant {
  readonly callbackId: string;
  readonly tone:
    | 'COLD'
    | 'CEREMONIAL'
    | 'MOCKING'
    | 'INTIMATE'
    | 'PUBLIC'
    | 'PRIVATE'
    | 'POST_EVENT'
    | 'PRE_EVENT';
  readonly text: string;
  readonly usageBias: number;
  readonly eligibleSceneRoles: readonly string[];
  readonly eligibleChannels: readonly string[];
}

export interface EpisodicMemoryRecord {
  readonly memoryId: string;
  readonly playerId?: string | null;
  readonly botId?: string | null;
  readonly counterpartId?: string | null;
  readonly eventType: EpisodicMemoryEventType;
  readonly triggerContext: EpisodicMemoryTriggerContext;
  readonly salience01: number;
  readonly emotionalWeight01: number;
  readonly strategicWeight01: number;
  readonly embarrassmentRisk01: number;
  readonly callbackVariants: readonly EpisodicMemoryCallbackVariant[];
  readonly createdAt: number;
  readonly lastReferencedAt?: number;
  readonly lastStrengthenedAt?: number;
  readonly timesReused: number;
  readonly unresolved: boolean;
  readonly expiresAt?: number;
  readonly status: EpisodicMemoryStatus;
}

export interface EpisodicMemorySnapshot {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly playerId?: string | null;
  readonly activeMemories: readonly EpisodicMemoryRecord[];
  readonly archivedMemories: readonly EpisodicMemoryRecord[];
  readonly unresolvedMemoryIds: readonly string[];
  readonly lastCarryoverSummary?: string;
  readonly countsByEventType: Readonly<Record<EpisodicMemoryEventType, number>>;
}

export interface EpisodicMemoryQuery {
  readonly playerId?: string | null;
  readonly botId?: string | null;
  readonly counterpartId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly eventTypes?: readonly EpisodicMemoryEventType[];
  readonly unresolvedOnly?: boolean;
  readonly activeOnly?: boolean;
  readonly minSalience01?: number;
  readonly limit?: number;
}

export interface EpisodicMemoryCallbackRequest {
  readonly requestId: string;
  readonly createdAt: number;
  readonly playerId?: string | null;
  readonly botId?: string | null;
  readonly counterpartId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly sceneRole?: string | null;
  readonly preferredTones?: readonly EpisodicMemoryCallbackVariant['tone'][];
  readonly pressureBand?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly maxResults?: number;
}

export interface EpisodicMemoryCallbackCandidate {
  readonly memoryId: string;
  readonly callbackId: string;
  readonly eventType: EpisodicMemoryEventType;
  readonly salience01: number;
  readonly unresolved: boolean;
  readonly text: string;
  readonly tone: EpisodicMemoryCallbackVariant['tone'];
  readonly score01: number;
  readonly notes: readonly string[];
}

export interface EpisodicMemoryCallbackResponse {
  readonly requestId: string;
  readonly createdAt: number;
  readonly candidates: readonly EpisodicMemoryCallbackCandidate[];
}

export const DEFAULT_CALLBACK_TONES = [
  'COLD',
  'CEREMONIAL',
  'MOCKING',
  'INTIMATE',
  'PUBLIC',
  'PRIVATE',
  'POST_EVENT',
  'PRE_EVENT',
] as const;

export function buildCountsByEventType(
  memories: readonly EpisodicMemoryRecord[],
): Readonly<Record<EpisodicMemoryEventType, number>> {
  const seed: Record<EpisodicMemoryEventType, number> = {
    HUMILIATION: 0,
    COMEBACK: 0,
    COLLAPSE: 0,
    BREACH: 0,
    RESCUE: 0,
    BLUFF: 0,
    GREED: 0,
    HESITATION: 0,
    OVERCONFIDENCE: 0,
    DISCIPLINE: 0,
    PERFECT_DEFENSE: 0,
    FAILED_GAMBLE: 0,
    SOVEREIGNTY: 0,
    DEAL_ROOM_STANDOFF: 0,
    PUBLIC_WITNESS: 0,
    PRIVATE_CONFESSION: 0,
  };

  for (const memory of memories) seed[memory.eventType] += 1;
  return seed;
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

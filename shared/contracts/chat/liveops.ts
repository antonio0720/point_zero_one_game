/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT LIVEOPS + SEASONAL OVERLAY CONTRACTS
 * FILE: shared/contracts/chat/liveops.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Shared seasonal, world-event, and liveops overlay contracts.
 *
 * These contracts define how authored world pressure, event windows, and season
 * identity modify chat planning without replacing authored bot personality.
 * ============================================================================
 */

export type ChatLiveOpsChannelId = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'LOBBY';

export type ChatLiveOpsOverlayKind =
  | 'SEASON'
  | 'WORLD_EVENT'
  | 'LIMITED_INTRUSION'
  | 'RIVAL_SPOTLIGHT'
  | 'HELPER_PUSH'
  | 'PUBLIC_WITNESS_SWELL';

export type ChatLiveOpsIntensityBand = 'QUIET' | 'ACTIVE' | 'SEVERE' | 'WORLD_CLASS';

export interface ChatLiveOpsOverlayRule {
  readonly ruleId: string;
  readonly appliesToBots?: readonly string[];
  readonly appliesToChannels?: readonly ChatLiveOpsChannelId[];
  readonly requiredTags?: readonly string[];
  readonly addedPlanningTags: readonly string[];
  readonly transformBiases: readonly string[];
  readonly pressureDelta: number;
  readonly publicnessDelta: number;
  readonly callbackAggressionDelta: number;
}

export interface ChatLiveOpsOverlayDefinition {
  readonly overlayId: string;
  readonly seasonId?: string | null;
  readonly displayName: string;
  readonly kind: ChatLiveOpsOverlayKind;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly headline: string;
  readonly summaryLines: readonly string[];
  readonly tags: readonly string[];
  readonly channelPriority: Readonly<Record<ChatLiveOpsChannelId, number>>;
  readonly rules: readonly ChatLiveOpsOverlayRule[];
}

export interface ChatLiveOpsOverlayContext {
  readonly now: number;
  readonly overlayId: string;
  readonly displayName: string;
  readonly kind: ChatLiveOpsOverlayKind;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly seasonId?: string | null;
  readonly headline: string;
  readonly tags: readonly string[];
  readonly transformBiases: readonly string[];
  readonly pressureDelta: number;
  readonly publicnessDelta: number;
  readonly callbackAggressionDelta: number;
  readonly notes: readonly string[];
}

export interface ChatLiveOpsOverlaySnapshot {
  readonly updatedAt: number;
  readonly activeSeasonId?: string | null;
  readonly activeOverlays: readonly ChatLiveOpsOverlayDefinition[];
  readonly upcomingOverlays: readonly ChatLiveOpsOverlayDefinition[];
}

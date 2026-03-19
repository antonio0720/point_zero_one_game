
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT RELATIONSHIP RUNTIME STATE
 * FILE: pzo-web/src/engines/chat/memory/RelationshipState.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend-owned relationship graph state for the next-generation chat lane.
 *
 * This file does not replace the current lightweight relationship field inside
 * `ChatEngineState`. It elevates it into a richer graph-backed runtime that can
 * be layered on top of the existing engine immediately while preserving the
 * current store shape, selector expectations, and migration path.
 *
 * This module is responsible for:
 * - graph-backed relationship state creation
 * - deterministic conversion between shared graph state and legacy frontend
 *   `ChatRelationshipState`
 * - message + signal classification into relationship events
 * - counterpart focus / channel ownership / callback anchor bookkeeping
 * - graph merge / hydration / normalization / decay
 * - projection helpers for UI, rescue, drama, and relationship selectors
 *
 * Design laws
 * -----------
 * 1. Pure state logic only. No React, sockets, timers, DOM, or storage.
 * 2. Preserve the current `relationshipsByCounterpartId` map as a first-class
 *    output so existing selectors and UI remain lawful.
 * 3. Read the shared contract lane as truth for graph topology.
 * 4. Keep legacy `types.ts` compatibility so ChatEngine can adopt incrementally.
 * 5. Support visible channels and shadow channels equally.
 *
 * Authority roots
 * ---------------
 * /shared/contracts/chat
 * /pzo-web/src/engines/chat
 * /backend/src/game/engine/chat
 * ============================================================================
 */

import type {
  ChatRelationshipCounterpartKind,
  ChatRelationshipEventDescriptor,
  ChatRelationshipEventType,
  ChatRelationshipPressureBand,
  ChatRelationshipSnapshot,
  ChatRelationshipSummaryView,
  ChatRelationshipCounterpartState,
  ChatRelationshipLegacyProjection,
  ChatRelationshipCallbackHint,
  ChatRelationshipVector as SharedRelationshipVector,
} from '../../../../../shared/contracts/chat/relationship';
import {
  clamp01 as clampShared01,
  emptyRelationshipVector,
} from '../../../../../shared/contracts/chat/relationship';

import type {
  ChatRelationshipAnchor,
  ChatRelationshipCounterpartProjection,
  ChatRelationshipGraphEdge,
  ChatRelationshipGraphView,
  ChatRelationshipLegacyBridge,
  ChatRelationshipMomentImpact,
  ChatRelationshipNodeId,
} from '../../../../../shared/contracts/chat/ChatRelationship';
import {
  addAnchorToEdge,
  buildFocusedEdgeByChannel,
  clamp01,
  createInitialCounterpartState,
  createRelationshipAnchor,
  createRelationshipGraph,
  createRelationshipGraphEdge,
  edgeToLegacyBridge,
  findEdgeByCounterpartId,
  graphToLegacySnapshot,
  inferPressureBandFromVector,
  isEventOpenLoop,
  mergeGraphs,
  momentImpactForEventType,
  projectGraphCounterparts,
  pushEventIntoEdge,
  relationshipGraphCallbackWeight,
  relationshipGraphHeat,
  relationshipGraphLegendWeight,
  sortEdgesByHeat,
  stateToAffinitySignals,
  unresolvedGraphEdgeCount,
} from '../../../../../shared/contracts/chat/ChatRelationship';

import type {
  ChatAffinityEvaluation,
  ChatAffinityLaneId,
  ChatAffinitySignal,
} from '../../../../../shared/contracts/chat/ChatAffinity';
import {
  evaluateAffinity,
  safePreferredLaneForEventType,
  strongestVisibleAffinitySignal,
} from '../../../../../shared/contracts/chat/ChatAffinity';

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_ENGINE_AUTHORITIES,
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
} from '../types';

import type {
  ChatActorKind,
  ChatAffectSnapshot,
  ChatChannelId,
  ChatContinuityState,
  ChatEngineState,
  ChatLearningProfile,
  ChatMessage,
  ChatMessageId,
  ChatMessageKind,
  ChatRelationshipId,
  ChatRelationshipState as LegacyChatRelationshipState,
  ChatSceneId,
  ChatSenderIdentity,
  ChatUpstreamSignal,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  PressureTier,
  Score100,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: File registry / versions
// ============================================================================

export const CHAT_RELATIONSHIP_RUNTIME_FILE_PATH =
  'pzo-web/src/engines/chat/memory/RelationshipState.ts' as const;

export const CHAT_RELATIONSHIP_RUNTIME_VERSION = '1.0.0' as const;

// ============================================================================
// MARK: Runtime types
// ============================================================================

export type RelationshipEventOrigin =
  | 'MESSAGE'
  | 'UPSTREAM_SIGNAL'
  | 'HYDRATION'
  | 'BACKEND_FRAME'
  | 'RECONCILIATION'
  | 'MANUAL'
  | 'DECAY';

export type RelationshipRuntimeMode =
  | 'IDLE'
  | 'LIVE'
  | 'REHYDRATING'
  | 'RECONCILING'
  | 'DRAINING';

export type RelationshipChannelDominance =
  | 'GLOBAL_STAGE'
  | 'PRIVATE_PRESSURE'
  | 'NEGOTIATION_CHAMBER'
  | 'LOBBY_WARMTH'
  | 'SHADOW_INTERNAL';

export interface RelationshipChannelFocusState {
  readonly channelId: ChatChannelId;
  readonly counterpartId?: string;
  readonly edgeId?: string;
  readonly focusedAt?: UnixMs;
  readonly publicWitness01: number;
  readonly privateWitness01: number;
  readonly dominance: RelationshipChannelDominance;
  readonly unresolvedCount: number;
  readonly callbackLoad01: number;
}

export interface RelationshipCounterpartRuntime {
  readonly counterpartId: string;
  readonly edgeId: string;
  readonly playerId?: string;
  readonly kind: ChatRelationshipCounterpartKind;
  readonly lastChannelId?: ChatChannelId;
  readonly projection: ChatRelationshipCounterpartProjection;
  readonly bridge: ChatRelationshipLegacyBridge;
  readonly affinitySignals: readonly ChatAffinitySignal[];
  readonly dominantAffinityLaneId?: ChatAffinityLaneId;
  readonly activeCallbackHint?: ChatRelationshipCallbackHint;
  readonly unresolvedOpenLoops: number;
  readonly visibleWitnessCount: number;
  readonly shadowWitnessCount: number;
  readonly incomingMessageCount: number;
  readonly outgoingMessageCount: number;
  readonly lastEventType?: ChatRelationshipEventType;
  readonly lastEventAt?: UnixMs;
  readonly lastSummary?: string;
  readonly lastMessageId?: ChatMessageId;
  readonly lastSceneId?: ChatSceneId;
  readonly hasLegendPotential: boolean;
  readonly shouldRescueGate: boolean;
  readonly shouldDelayReveal: boolean;
  readonly shouldSurfaceBanner: boolean;
}

export interface RelationshipRuntimeMetrics {
  readonly totalCounterparts: number;
  readonly totalEvents: number;
  readonly totalAnchors: number;
  readonly unresolvedCounterparts: number;
  readonly focusedCounterpartCount: number;
  readonly heat01: number;
  readonly callbackWeight01: number;
  readonly legendWeight01: number;
  readonly topCounterpartId?: string;
  readonly activeObsessionCount: number;
  readonly helperRescueCount: number;
  readonly rivalPressureCount: number;
  readonly lastUpdatedAt?: UnixMs;
}

export interface RelationshipRuntimeState {
  readonly version: string;
  readonly runtimeMode: RelationshipRuntimeMode;
  readonly playerId?: ChatUserId | string;
  readonly activeRoomId?: string;
  readonly graph: ChatRelationshipGraphView;
  readonly counterpartsById: Readonly<Record<string, RelationshipCounterpartRuntime>>;
  readonly legacyByCounterpartId: Readonly<Record<string, LegacyChatRelationshipState>>;
  readonly focusByChannel: Readonly<Record<ChatChannelId, RelationshipChannelFocusState>>;
  readonly snapshotsTail: readonly ChatRelationshipSnapshot[];
  readonly latestSummaryViews: readonly ChatRelationshipSummaryView[];
  readonly latestEventTail: readonly ChatRelationshipEventDescriptor[];
  readonly metrics: RelationshipRuntimeMetrics;
  readonly lastHydratedAt?: UnixMs;
  readonly lastReconciledAt?: UnixMs;
  readonly lastAuthoritativeAt?: UnixMs;
  readonly notes: readonly string[];
}

export interface RelationshipRuntimeHydrationOptions {
  readonly playerId?: ChatUserId | string;
  readonly roomId?: string;
  readonly graph?: ChatRelationshipGraphView;
  readonly legacyRelationshipsByCounterpartId?: Readonly<Record<string, LegacyChatRelationshipState>>;
  readonly learningProfile?: ChatLearningProfile;
  readonly continuity?: ChatContinuityState;
  readonly messages?: readonly ChatMessage[];
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface RelationshipEventBuildContext {
  readonly playerId?: string;
  readonly roomId?: string;
  readonly channelId?: ChatChannelId;
  readonly sceneId?: ChatSceneId;
  readonly messageId?: ChatMessageId;
  readonly body?: string;
  readonly now?: UnixMs;
  readonly sourceSummary?: string;
  readonly publicWitness01?: number;
  readonly intensity01?: number;
  readonly tags?: readonly string[];
}

export interface RelationshipEngineProjection {
  readonly relationshipsByCounterpartId: Readonly<Record<string, LegacyChatRelationshipState>>;
  readonly strongestCounterpartId?: string;
  readonly focusedCounterpartByChannel: Readonly<Record<ChatChannelId, string | undefined>>;
  readonly shouldSurfaceRelationshipBanner: boolean;
  readonly shouldEscalateDrama: boolean;
  readonly shouldRunRescue: boolean;
}

export interface RelationshipMergeOptions {
  readonly preferIncomingFocus?: boolean;
  readonly recordNote?: string;
  readonly markAuthoritative?: boolean;
}

export interface BuildRelationshipRuntimeFromEngineOptions {
  readonly state: ChatEngineState;
  readonly playerId?: string;
  readonly roomId?: string;
  readonly notes?: readonly string[];
}

export interface RelationshipEventApplicationResult {
  readonly state: RelationshipRuntimeState;
  readonly counterpart?: RelationshipCounterpartRuntime;
  readonly affectedChannelIds: readonly ChatChannelId[];
  readonly anchorAdded: boolean;
}

// ============================================================================
// MARK: Configuration
// ============================================================================

export interface RelationshipRuntimeConfig {
  readonly maxSnapshotsTail: number;
  readonly maxEventTail: number;
  readonly maxNotes: number;
  readonly maxFocusAgeMs: number;
  readonly minAnchorSalience01: number;
  readonly helperRescueDebtThreshold01: number;
  readonly obsessionIntensityThreshold01: number;
  readonly legendPotentialThreshold01: number;
  readonly staleDecayIntervalMs: number;
  readonly visibleWitnessWeight: number;
  readonly shadowWitnessWeight: number;
}

export const DEFAULT_RELATIONSHIP_RUNTIME_CONFIG: RelationshipRuntimeConfig = Object.freeze({
  maxSnapshotsTail: 16,
  maxEventTail: 96,
  maxNotes: 64,
  maxFocusAgeMs: 90_000,
  minAnchorSalience01: 0.42,
  helperRescueDebtThreshold01: 0.48,
  obsessionIntensityThreshold01: 0.70,
  legendPotentialThreshold01: 0.68,
  staleDecayIntervalMs: 120_000,
  visibleWitnessWeight: 1,
  shadowWitnessWeight: 0.42,
});

// ============================================================================
// MARK: Primitive helpers
// ============================================================================

export function toUnixMs(value: number): UnixMs {
  return Math.max(0, Math.round(value)) as UnixMs;
}

export function score100(value: number): Score100 {
  return Math.max(0, Math.min(100, Math.round(value))) as Score100;
}

export function score100To01(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return clamp01(Number(value) / 100);
}

export function score01To100(value: number | undefined): Score100 {
  return score100(clamp01(value ?? 0) * 100);
}

export function stableNow(now?: UnixMs): UnixMs {
  return (now ?? toUnixMs(Date.now())) as UnixMs;
}

export function asRelationshipId(counterpartId: string): ChatRelationshipId {
  return (`rel/${counterpartId}`) as ChatRelationshipId;
}

export function defaultRoomId(playerId?: string): string {
  return `relationship-room:${playerId ?? 'anonymous'}`;
}

export function counterpartNodeId(counterpartId: string): ChatRelationshipNodeId {
  return `counterpart:${counterpartId}`;
}

export function playerNodeId(playerId?: string | null): ChatRelationshipNodeId {
  return `player:${playerId ?? 'anonymous'}`;
}

export function stableStringList(values?: readonly string[] | null): readonly string[] {
  if (!values?.length) return [];
  return [...new Set(values.filter(Boolean).map((value) => `${value}`.trim()).filter(Boolean))];
}

export function trimNotes(notes: readonly string[], max: number): readonly string[] {
  if (notes.length <= max) return notes;
  return notes.slice(notes.length - max);
}

export function stableCounterpartId(
  message: Pick<ChatMessage, 'senderId' | 'senderName' | 'sender' | 'kind'>,
): string {
  if (message.sender?.senderId) return message.sender.senderId;
  if (message.senderId) return message.senderId;
  if (message.sender?.senderName) return message.sender.senderName;
  if (message.senderName) return message.senderName;
  return `unknown:${message.kind}`;
}

export function actorKindToCounterpartKind(kind: ChatActorKind): ChatRelationshipCounterpartKind {
  switch (kind) {
    case 'HELPER':
      return 'HELPER';
    case 'HATER':
      return 'RIVAL';
    case 'SYSTEM':
      return 'SYSTEM';
    case 'LIVEOPS':
      return 'SYSTEM';
    case 'CROWD':
      return 'AMBIENT';
    case 'DEAL_AGENT':
      return 'NPC';
    case 'AMBIENT_NPC':
      return 'AMBIENT';
    case 'PLAYER':
    default:
      return 'NPC';
  }
}

export function senderToCounterpartKind(sender?: ChatSenderIdentity): ChatRelationshipCounterpartKind {
  if (!sender) return 'NPC';
  return actorKindToCounterpartKind(sender.actorKind);
}

export function visibleChannelPublicWitness01(channelId: ChatChannelId): number {
  switch (channelId) {
    case 'GLOBAL':
      return 1;
    case 'LOBBY':
      return 0.72;
    case 'SYNDICATE':
      return 0.18;
    case 'DEAL_ROOM':
      return 0.10;
    case 'LIVEOPS_SHADOW':
      return 0.86;
    case 'RIVALRY_SHADOW':
      return 0.34;
    case 'RESCUE_SHADOW':
      return 0.05;
    case 'NPC_SHADOW':
      return 0.12;
    case 'SYSTEM_SHADOW':
    default:
      return 0;
  }
}

export function visibleChannelPrivateWitness01(channelId: ChatChannelId): number {
  switch (channelId) {
    case 'DEAL_ROOM':
      return 0.95;
    case 'SYNDICATE':
      return 0.88;
    case 'RESCUE_SHADOW':
      return 1;
    case 'NPC_SHADOW':
      return 0.82;
    case 'RIVALRY_SHADOW':
      return 0.70;
    case 'SYSTEM_SHADOW':
      return 0.54;
    case 'LOBBY':
      return 0.28;
    case 'GLOBAL':
    case 'LIVEOPS_SHADOW':
    default:
      return 1 - visibleChannelPublicWitness01(channelId);
  }
}

export function channelDominance(channelId: ChatChannelId): RelationshipChannelDominance {
  switch (channelId) {
    case 'GLOBAL':
      return 'GLOBAL_STAGE';
    case 'SYNDICATE':
      return 'PRIVATE_PRESSURE';
    case 'DEAL_ROOM':
      return 'NEGOTIATION_CHAMBER';
    case 'LOBBY':
      return 'LOBBY_WARMTH';
    default:
      return 'SHADOW_INTERNAL';
  }
}

export function messageIntensity01(message: Pick<ChatMessage, 'kind' | 'body' | 'pressureTier' | 'tickTier'>): number {
  let score = 0.18;
  switch (message.kind) {
    case 'BOT_ATTACK':
    case 'HATER_PUNISH':
    case 'LEGEND_MOMENT':
      score += 0.42;
      break;
    case 'BOT_TAUNT':
    case 'HATER_TELEGRAPH':
    case 'HELPER_RESCUE':
    case 'POST_RUN_RITUAL':
      score += 0.24;
      break;
    case 'CROWD_REACTION':
    case 'RELATIONSHIP_CALLBACK':
    case 'QUOTE_CALLBACK':
      score += 0.16;
      break;
    default:
      break;
  }
  if (message.pressureTier === 'CRITICAL') score += 0.22;
  if (message.pressureTier === 'HIGH') score += 0.12;
  if (message.tickTier === 'COLLAPSE_IMMINENT') score += 0.18;
  const caps = /!{2,}|ALL IN|BREACH|CRITICAL|SOVEREIGN/i.test(message.body) ? 0.1 : 0;
  return clamp01(score + caps);
}

export function pressureBandFromMessage(
  message: Pick<ChatMessage, 'pressureTier' | 'tickTier' | 'kind'>,
): ChatRelationshipPressureBand {
  if (message.pressureTier === 'CRITICAL' || message.tickTier === 'COLLAPSE_IMMINENT') return 'CRITICAL';
  if (message.pressureTier === 'HIGH' || message.kind === 'BOT_ATTACK' || message.kind === 'HATER_PUNISH') return 'HIGH';
  if (message.pressureTier === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

export function pressureBandFromSignal(signal: ChatUpstreamSignal): ChatRelationshipPressureBand {
  if ('nextTier' in signal && signal.nextTier === 'CRITICAL') return 'CRITICAL';
  if ('nextTier' in signal && signal.nextTier === 'HIGH') return 'HIGH';
  if (signal.signalType === 'SHIELD_LAYER_BREACHED' || signal.signalType === 'BOT_ATTACK_FIRED') return 'HIGH';
  if (signal.signalType === 'SOVEREIGNTY_APPROACH') return 'MEDIUM';
  return 'LOW';
}

export function inferEventTypeFromMessage(message: ChatMessage): ChatRelationshipEventType {
  if (message.kind === 'HELPER_RESCUE') return 'HELPER_RESCUE_EMITTED';
  if (message.kind === 'BOT_TAUNT' || message.kind === 'HATER_TELEGRAPH') return 'BOT_TAUNT_EMITTED';
  if (message.kind === 'BOT_ATTACK' || message.kind === 'HATER_PUNISH') return 'PLAYER_BREACH';
  if (message.kind === 'QUOTE_CALLBACK' || message.kind === 'RELATIONSHIP_CALLBACK') return 'PUBLIC_WITNESS';
  if (message.kind === 'CROWD_REACTION') {
    return message.channel === 'GLOBAL' || message.channel === 'LOBBY'
      ? 'PUBLIC_WITNESS'
      : 'PRIVATE_WITNESS';
  }
  if (message.kind === 'NEGOTIATION_OFFER' || message.kind === 'NEGOTIATION_COUNTER') return 'NEGOTIATION_WINDOW';
  if (message.kind === 'LEGEND_MOMENT') return 'PLAYER_COMEBACK';
  if (message.kind === 'POST_RUN_RITUAL') return 'RUN_END';
  if (message.kind === 'MARKET_ALERT') return 'MARKET_ALERT';

  const body = message.body.toLowerCase();
  if (message.sender?.actorKind === 'PLAYER') {
    if (/\?/.test(body)) return 'PLAYER_QUESTION';
    if (/\b(hate|stupid|trash|idiot|kill)\b/.test(body)) return 'PLAYER_ANGER';
    if (/\b(troll|cope|lmao|lol)\b/.test(body)) return 'PLAYER_TROLL';
    if (/\b(easy|light work|too easy|i own this|i win)\b/.test(body)) return 'PLAYER_OVERCONFIDENCE';
    if (/\b(bluff|maybe|perhaps|deal)\b/.test(body)) return 'PLAYER_BLUFF';
    if (/\b(steady|calm|wait|hold)\b/.test(body)) return 'PLAYER_CALM';
    if (/\b(discipline|focus|lock in)\b/.test(body)) return 'PLAYER_DISCIPLINE';
    if (/\b(all in|more|mine|take it)\b/.test(body)) return 'PLAYER_GREED';
    return 'PLAYER_MESSAGE';
  }

  if (message.sender?.actorKind === 'HELPER') return 'HELPER_RESCUE_EMITTED';
  if (message.sender?.actorKind === 'HATER') return 'BOT_TAUNT_EMITTED';
  if (message.channel === 'GLOBAL' || message.channel === 'LOBBY') return 'PUBLIC_WITNESS';
  return 'PRIVATE_WITNESS';
}

export function inferEventTypeFromSignal(signal: ChatUpstreamSignal): ChatRelationshipEventType | undefined {
  switch (signal.signalType) {
    case 'RUN_STARTED':
      return 'RUN_START';
    case 'RUN_ENDED':
      return 'RUN_END';
    case 'SHIELD_LAYER_BREACHED':
      return 'PLAYER_BREACH';
    case 'BOT_ATTACK_FIRED':
      return 'BOT_TAUNT_EMITTED';
    case 'SOVEREIGNTY_APPROACH':
      return 'PLAYER_NEAR_SOVEREIGNTY';
    case 'SOVEREIGNTY_ACHIEVED':
      return 'PLAYER_COMEBACK';
    case 'CASCADE_CHAIN_STARTED':
      return 'PLAYER_COLLAPSE';
    case 'CASCADE_CHAIN_BROKEN':
      return 'PLAYER_COMEBACK';
    case 'CARD_PLAYED':
      return 'PLAYER_DISCIPLINE';
    case 'DEAL_PROOF_ISSUED':
      return 'NEGOTIATION_WINDOW';
    case 'PRESSURE_TIER_CHANGED':
      return 'MARKET_ALERT';
    default:
      return undefined;
  }
}

export function summaryFromMessage(message: ChatMessage): string {
  if (message.body.trim()) return message.body.trim().slice(0, 240);
  return `${message.kind}:${message.senderName}`;
}

export function eventDescriptorFromMessage(
  message: ChatMessage,
  context: RelationshipEventBuildContext = {},
): ChatRelationshipEventDescriptor {
  const counterpartId = stableCounterpartId(message);
  const counterpartKind = senderToCounterpartKind(message.sender);
  const channelId = context.channelId ?? message.channel;
  const publicWitness01 = context.publicWitness01 ?? visibleChannelPublicWitness01(channelId);
  const intensity01 = context.intensity01 ?? messageIntensity01(message);

  return {
    eventId: `msg:${message.id}`,
    eventType: inferEventTypeFromMessage(message),
    counterpartId,
    counterpartKind,
    playerId: context.playerId,
    botId: message.sender?.botId ?? null,
    actorRole: message.sender?.senderRole ?? null,
    channelId,
    roomId: context.roomId ?? undefined,
    sourceMessageId: message.id,
    sceneId: context.sceneId ?? message.sceneId,
    pressureBand: pressureBandFromMessage(message),
    publicWitness01,
    intensity01,
    summary: context.sourceSummary ?? summaryFromMessage(message),
    rawText: message.body,
    tags: stableStringList([...(message.tags ?? []), ...(context.tags ?? [])]),
    createdAt: context.now ?? toUnixMs(message.ts),
  };
}

export function eventDescriptorFromSignal(
  signal: ChatUpstreamSignal,
  counterpartId: string,
  counterpartKind: ChatRelationshipCounterpartKind,
  context: RelationshipEventBuildContext = {},
): ChatRelationshipEventDescriptor | undefined {
  const eventType = inferEventTypeFromSignal(signal);
  if (!eventType) return undefined;
  const channelId = context.channelId ?? 'SYSTEM_SHADOW';
  return {
    eventId: `sig:${signal.signalType}:${signal.emittedAt}:${counterpartId}`,
    eventType,
    counterpartId,
    counterpartKind,
    playerId: context.playerId,
    actorRole: 'SYSTEM_NOTICE',
    channelId,
    roomId: context.roomId ?? undefined,
    sourceMessageId: context.messageId,
    sceneId: context.sceneId,
    pressureBand: pressureBandFromSignal(signal),
    publicWitness01: context.publicWitness01 ?? visibleChannelPublicWitness01(channelId),
    intensity01: context.intensity01 ?? clamp01(0.25 + (pressureBandFromSignal(signal) === 'HIGH' ? 0.2 : 0)),
    summary: context.sourceSummary ?? signal.signalType,
    rawText: undefined,
    tags: stableStringList(context.tags),
    createdAt: context.now ?? signal.emittedAt,
  };
}

// ============================================================================
// MARK: Legacy conversion helpers
// ============================================================================

export function sharedVectorFromLegacy(
  legacy: LegacyChatRelationshipState | ChatRelationshipLegacyProjection,
): SharedRelationshipVector {
  return {
    contempt01: score100To01(legacy.vector ? legacy.vector.contempt : legacy.contempt),
    fascination01: score100To01(legacy.vector ? legacy.vector.fascination : legacy.fascination),
    respect01: score100To01(legacy.vector ? legacy.vector.respect : legacy.respect),
    fear01: score100To01(legacy.vector ? legacy.vector.fear : legacy.fear),
    obsession01: score100To01(legacy.vector ? legacy.vector.rivalryIntensity : legacy.rivalryIntensity),
    patience01: score100To01(100 - (legacy.vector ? legacy.vector.rivalryIntensity : legacy.rivalryIntensity)),
    familiarity01: score100To01(legacy.vector ? legacy.vector.familiarity : legacy.familiarity),
    predictiveConfidence01: score100To01(legacy.vector ? legacy.vector.fascination : legacy.fascination),
    traumaDebt01: score100To01(legacy.vector ? legacy.vector.rescueDebt : legacy.rescueDebt),
    unfinishedBusiness01: score100To01(legacy.vector ? legacy.vector.rivalryIntensity : legacy.rivalryIntensity),
  };
}

export function legacyStateFromBridge(bridge: ChatRelationshipLegacyBridge): LegacyChatRelationshipState {
  const legacy = bridge.summaryView.legacy;
  return {
    relationshipId: asRelationshipId(bridge.counterpartId),
    playerId: (bridge.counterpartState.playerId ?? 'player') as ChatUserId,
    counterpartId: bridge.counterpartId,
    counterpartKind:
      bridge.counterpartState.counterpartKind === 'RIVAL'
        ? 'HATER'
        : bridge.counterpartState.counterpartKind === 'HELPER'
          ? 'HELPER'
          : bridge.counterpartState.counterpartKind === 'SYSTEM'
            ? 'SYSTEM'
            : 'AMBIENT_NPC',
    vector: {
      respect: score100(legacy.respect),
      fear: score100(legacy.fear),
      contempt: score100(legacy.contempt),
      fascination: score100(legacy.fascination),
      trust: score100(legacy.trust),
      familiarity: score100(legacy.familiarity),
      rivalryIntensity: score100(legacy.rivalryIntensity),
      rescueDebt: score100(legacy.rescueDebt),
      adviceObedience: score100(legacy.adviceObedience),
    },
    lastMeaningfulShiftAt: toUnixMs(bridge.counterpartState.lastTouchedAt),
    callbacksAvailable: bridge.counterpartState.callbackHints.map(
      (hint, index) => (`quote/${bridge.counterpartId}/${index}`) as ChatRelationshipId as unknown as never,
    ) as unknown as readonly ChatRelationshipId[],
    escalationTier: legacy.escalationTier,
  };
}

export function summaryViewsFromGraph(graph: ChatRelationshipGraphView): readonly ChatRelationshipSummaryView[] {
  return sortEdgesByHeat(graph.edges).map((edge) => edgeToLegacyBridge(edge).summaryView);
}

export function legacyMapFromGraph(
  graph: ChatRelationshipGraphView,
): Readonly<Record<string, LegacyChatRelationshipState>> {
  const next: Record<string, LegacyChatRelationshipState> = {};
  for (const edge of graph.edges) {
    const bridge = edgeToLegacyBridge(edge);
    next[bridge.counterpartId] = legacyStateFromBridge(bridge);
  }
  return next;
}

// ============================================================================
// MARK: Runtime projection helpers
// ============================================================================

export function affinitySignalsForEdge(
  edge: ChatRelationshipGraphEdge,
): readonly ChatAffinitySignal[] {
  return stateToAffinitySignals(edgeToLegacyBridge(edge).counterpartState, {
    pressureBand: inferPressureBandFromVector(edge.vector, edge.intensity01),
    callbackDensity01: edge.callbackLoad01,
    rescueDebt01: edge.rescueDebt01,
    witness01: edge.witnessLoad01,
    legendPotential01: edge.legendPotential01,
  });
}

export function unresolvedOpenLoopCount(edge: ChatRelationshipGraphEdge): number {
  return edge.eventHistoryTail.filter((event) => isEventOpenLoop(event.eventType)).length;
}

export function visibleShadowWitnessCounts(
  edge: ChatRelationshipGraphEdge,
): { visibleWitnessCount: number; shadowWitnessCount: number } {
  let visibleWitnessCount = 0;
  let shadowWitnessCount = 0;
  for (const event of edge.eventHistoryTail) {
    if (!event.channelId) continue;
    const descriptor = CHAT_CHANNEL_DESCRIPTORS[event.channelId as ChatChannelId];
    if (!descriptor) continue;
    if (descriptor.visibleToPlayer) visibleWitnessCount += 1;
    else shadowWitnessCount += 1;
  }
  return { visibleWitnessCount, shadowWitnessCount };
}

export function counterpartRuntimeFromEdge(
  edge: ChatRelationshipGraphEdge,
): RelationshipCounterpartRuntime {
  const bridge = edgeToLegacyBridge(edge);
  const affinitySignals = affinitySignalsForEdge(edge);
  const dominantAffinity = strongestVisibleAffinitySignal(edge.affinityEvaluation);
  const unresolvedOpenLoops = unresolvedOpenLoopCount(edge);
  const counts = visibleShadowWitnessCounts(edge);
  const lastEvent = edge.eventHistoryTail[edge.eventHistoryTail.length - 1];
  const helperRescueGate =
    edge.rescueDebt01 >= DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.helperRescueDebtThreshold01 &&
    edge.bondRole !== 'OPPOSITION_BOND';

  return {
    counterpartId: bridge.counterpartId,
    edgeId: edge.edgeId,
    playerId: bridge.counterpartState.playerId ?? undefined,
    kind: bridge.counterpartState.counterpartKind,
    lastChannelId: bridge.counterpartState.lastChannelId as ChatChannelId | undefined,
    projection: bridge.projection,
    bridge,
    affinitySignals,
    dominantAffinityLaneId: dominantAffinity?.laneId ?? edge.affinityEvaluation.dominantLaneId,
    activeCallbackHint: bridge.counterpartState.callbackHints[0],
    unresolvedOpenLoops,
    visibleWitnessCount: counts.visibleWitnessCount,
    shadowWitnessCount: counts.shadowWitnessCount,
    incomingMessageCount: edge.eventHistoryTail.filter((event) => event.eventType !== 'PLAYER_MESSAGE').length,
    outgoingMessageCount: edge.eventHistoryTail.filter((event) => event.eventType === 'PLAYER_MESSAGE').length,
    lastEventType: lastEvent?.eventType,
    lastEventAt: lastEvent ? toUnixMs(lastEvent.createdAt) : undefined,
    lastSummary: lastEvent?.summary ?? undefined,
    lastMessageId: lastEvent?.sourceMessageId as ChatMessageId | undefined,
    lastSceneId: lastEvent?.sceneId as ChatSceneId | undefined,
    hasLegendPotential: edge.legendPotential01 >= DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.legendPotentialThreshold01,
    shouldRescueGate: helperRescueGate,
    shouldDelayReveal: edge.visibilityMode === 'REVEAL_LATER' || edge.visibilityMode === 'SHADOW_DOMINANT',
    shouldSurfaceBanner: edge.linkState === 'BURNING' || unresolvedOpenLoops > 0 || helperRescueGate,
  };
}

export function focusMapFromGraph(
  graph: ChatRelationshipGraphView,
  now: UnixMs = stableNow(),
): Readonly<Record<ChatChannelId, RelationshipChannelFocusState>> {
  const next = {} as Record<ChatChannelId, RelationshipChannelFocusState>;
  for (const channelId of [...CHAT_VISIBLE_CHANNELS, ...CHAT_SHADOW_CHANNELS] as ChatChannelId[]) {
    const edgeId = graph.focusedEdgeByChannel[channelId];
    const edge = edgeId ? graph.edges.find((item) => item.edgeId === edgeId) : undefined;
    next[channelId] = {
      channelId,
      counterpartId: edge?.counterpartId,
      edgeId,
      focusedAt: edge ? toUnixMs(edge.updatedAt) : undefined,
      publicWitness01: visibleChannelPublicWitness01(channelId),
      privateWitness01: visibleChannelPrivateWitness01(channelId),
      dominance: channelDominance(channelId),
      unresolvedCount: edge ? unresolvedOpenLoopCount(edge) : 0,
      callbackLoad01: edge?.callbackLoad01 ?? 0,
    };
  }
  void now;
  return next;
}

export function metricsFromGraph(
  graph: ChatRelationshipGraphView,
  runtimeCounterparts: Readonly<Record<string, RelationshipCounterpartRuntime>>,
): RelationshipRuntimeMetrics {
  const topEdge = sortEdgesByHeat(graph.edges)[0];
  let activeObsessionCount = 0;
  let helperRescueCount = 0;
  let rivalPressureCount = 0;
  let totalAnchors = 0;

  for (const edge of graph.edges) {
    if (edge.legendPotential01 >= DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.legendPotentialThreshold01) activeObsessionCount += 1;
    if (edge.rescueDebt01 >= DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.helperRescueDebtThreshold01) helperRescueCount += 1;
    if (edge.bondRole === 'OPPOSITION_BOND' || edge.bondRole === 'AUDIENCE_BOND') rivalPressureCount += 1;
    totalAnchors += edge.anchors.length;
  }

  return {
    totalCounterparts: graph.edges.length,
    totalEvents: graph.edges.reduce((sum, edge) => sum + edge.eventHistoryTail.length, 0),
    totalAnchors,
    unresolvedCounterparts: unresolvedGraphEdgeCount(graph),
    focusedCounterpartCount: Object.values(graph.focusedEdgeByChannel).filter(Boolean).length,
    heat01: relationshipGraphHeat(graph),
    callbackWeight01: relationshipGraphCallbackWeight(graph),
    legendWeight01: relationshipGraphLegendWeight(graph),
    topCounterpartId: topEdge?.counterpartId,
    activeObsessionCount,
    helperRescueCount,
    rivalPressureCount,
    lastUpdatedAt: topEdge ? toUnixMs(topEdge.updatedAt) : undefined,
  };
}

// ============================================================================
// MARK: State constructors / clone / normalization
// ============================================================================

export function createEmptyRelationshipRuntimeState(
  options: RelationshipRuntimeHydrationOptions = {},
): RelationshipRuntimeState {
  const now = stableNow(options.now);
  const graph = options.graph ?? createRelationshipGraph({
    playerId: options.playerId ? `${options.playerId}` : undefined,
    roomId: options.roomId ?? defaultRoomId(options.playerId ? `${options.playerId}` : undefined),
    notes: stableStringList(options.notes),
    createdAt: now,
    updatedAt: now,
  });

  const next: RelationshipRuntimeState = {
    version: CHAT_RELATIONSHIP_RUNTIME_VERSION,
    runtimeMode: 'IDLE',
    playerId: options.playerId,
    activeRoomId: options.roomId ?? graph.roomId ?? defaultRoomId(options.playerId ? `${options.playerId}` : undefined),
    graph,
    counterpartsById: {},
    legacyByCounterpartId: options.legacyRelationshipsByCounterpartId ?? {},
    focusByChannel: focusMapFromGraph(graph, now),
    snapshotsTail: [graphToLegacySnapshot(graph)],
    latestSummaryViews: summaryViewsFromGraph(graph),
    latestEventTail: [],
    metrics: metricsFromGraph(graph, {}),
    lastHydratedAt: now,
    lastReconciledAt: undefined,
    lastAuthoritativeAt: undefined,
    notes: trimNotes(
      [
        `authorities:${CHAT_ENGINE_AUTHORITIES.sharedContractsRoot}`,
        `runtime:${CHAT_RELATIONSHIP_RUNTIME_FILE_PATH}`,
        ...(options.notes ?? []),
      ],
      DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxNotes,
    ),
  };
  return normalizeRelationshipRuntimeState(next, now);
}

export function cloneRelationshipRuntimeState(
  state: RelationshipRuntimeState,
): RelationshipRuntimeState {
  return {
    ...state,
    graph: {
      ...state.graph,
      nodes: state.graph.nodes.map((node) => ({ ...node, tags: [...node.tags] })),
      edges: state.graph.edges.map((edge) => ({
        ...edge,
        affinityEvaluation: {
          ...edge.affinityEvaluation,
          scores: edge.affinityEvaluation.scores.map((score) => ({ ...score, notes: [...score.notes] })),
        },
        callbackHints: edge.callbackHints.map((hint) => ({ ...hint })),
        anchors: edge.anchors.map((anchor) => ({ ...anchor, tags: [...anchor.tags] })),
        trajectoryTail: edge.trajectoryTail.map((snapshot) => ({ ...snapshot, dominantAxes: [...snapshot.dominantAxes] })),
        repairWindow: edge.repairWindow ? { ...edge.repairWindow, notes: [...edge.repairWindow.notes] } : edge.repairWindow,
        continuity: { ...edge.continuity, notes: [...edge.continuity.notes] },
        policy: { ...edge.policy, notes: [...edge.policy.notes], dominantAxes: [...edge.policy.dominantAxes] },
        eventHistoryTail: edge.eventHistoryTail.map((event) => ({ ...event, tags: event.tags ? [...event.tags] : undefined })),
        threadSummary: { ...edge.threadSummary, anchorIds: [...edge.threadSummary.anchorIds] },
        legacy: { ...edge.legacy },
        vector: { ...edge.vector },
      })),
      activeEdgeIds: [...state.graph.activeEdgeIds],
      unresolvedEdgeIds: [...state.graph.unresolvedEdgeIds],
      focusedEdgeByChannel: { ...state.graph.focusedEdgeByChannel },
      globalAffinitySummary: { ...state.graph.globalAffinitySummary },
      notes: [...state.graph.notes],
    },
    counterpartsById: Object.fromEntries(
      Object.entries(state.counterpartsById).map(([key, value]) => [
        key,
        {
          ...value,
          projection: { ...value.projection, dominantAxes: [...value.projection.dominantAxes], notes: [...value.projection.notes] },
          bridge: {
            ...value.bridge,
            summaryView: { ...value.bridge.summaryView, dominantAxes: [...value.bridge.summaryView.dominantAxes] },
            counterpartState: {
              ...value.bridge.counterpartState,
              vector: { ...value.bridge.counterpartState.vector },
              callbackHints: value.bridge.counterpartState.callbackHints.map((hint) => ({ ...hint })),
              eventHistoryTail: value.bridge.counterpartState.eventHistoryTail.map((event) => ({ ...event, tags: event.tags ? [...event.tags] : undefined })),
              dominantAxes: [...value.bridge.counterpartState.dominantAxes],
            },
            npcSignal: { ...value.bridge.npcSignal, notes: [...value.bridge.npcSignal.notes] },
            edge: value.bridge.edge,
            projection: { ...value.bridge.projection, dominantAxes: [...value.bridge.projection.dominantAxes], notes: [...value.bridge.projection.notes] },
          },
          affinitySignals: value.affinitySignals.map((signal) => ({ ...signal, notes: [...signal.notes] })),
        },
      ]),
    ),
    legacyByCounterpartId: Object.fromEntries(
      Object.entries(state.legacyByCounterpartId).map(([key, value]) => [
        key,
        {
          ...value,
          vector: { ...value.vector },
          callbacksAvailable: [...value.callbacksAvailable],
        },
      ]),
    ),
    focusByChannel: Object.fromEntries(
      Object.entries(state.focusByChannel).map(([key, value]) => [key, { ...value }]),
    ) as Readonly<Record<ChatChannelId, RelationshipChannelFocusState>>,
    snapshotsTail: state.snapshotsTail.map((snapshot) => ({
      ...snapshot,
      counterparts: snapshot.counterparts.map((counterpart) => ({
        ...counterpart,
        vector: { ...counterpart.vector },
        callbackHints: counterpart.callbackHints.map((hint) => ({ ...hint })),
        eventHistoryTail: counterpart.eventHistoryTail.map((event) => ({ ...event, tags: event.tags ? [...event.tags] : undefined })),
        dominantAxes: [...counterpart.dominantAxes],
      })),
      focusedCounterpartByChannel: { ...snapshot.focusedCounterpartByChannel },
    })),
    latestSummaryViews: state.latestSummaryViews.map((view) => ({ ...view, dominantAxes: [...view.dominantAxes] })),
    latestEventTail: state.latestEventTail.map((event) => ({ ...event, tags: event.tags ? [...event.tags] : undefined })),
    metrics: { ...state.metrics },
    notes: [...state.notes],
  };
}

export function normalizeRelationshipRuntimeState(
  state: RelationshipRuntimeState,
  now: UnixMs = stableNow(),
): RelationshipRuntimeState {
  const graph = createRelationshipGraph({
    graphId: state.graph.graphId,
    playerId: state.graph.playerId,
    roomId: state.graph.roomId,
    edges: state.graph.edges,
    notes: state.graph.notes,
    createdAt: state.graph.createdAt,
    updatedAt: Math.max(state.graph.updatedAt, now),
  });

  const counterpartsById: Record<string, RelationshipCounterpartRuntime> = {};
  for (const edge of graph.edges) {
    counterpartsById[edge.counterpartId ?? edge.targetNodeId] = counterpartRuntimeFromEdge(edge);
  }

  const focusByChannel = focusMapFromGraph(graph, now);
  const snapshotsTail = [
    ...state.snapshotsTail,
    graphToLegacySnapshot(graph),
  ].slice(-DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxSnapshotsTail);

  const latestEvents = sortEdgesByHeat(graph.edges)
    .flatMap((edge) => edge.eventHistoryTail)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxEventTail);

  return {
    ...state,
    graph,
    counterpartsById,
    legacyByCounterpartId: legacyMapFromGraph(graph),
    focusByChannel,
    snapshotsTail,
    latestSummaryViews: summaryViewsFromGraph(graph),
    latestEventTail: latestEvents,
    metrics: metricsFromGraph(graph, counterpartsById),
    lastReconciledAt: now,
    notes: trimNotes(state.notes, DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxNotes),
  };
}

// ============================================================================
// MARK: Graph creation / hydration
// ============================================================================

export function edgeFromLegacyRelationship(
  relationship: LegacyChatRelationshipState,
  playerId?: string,
  roomId?: string,
): ChatRelationshipGraphEdge {
  const channelId = 'GLOBAL';
  return createRelationshipGraphEdge({
    graphId: `graph/${playerId ?? relationship.playerId}/${roomId ?? 'room'}`,
    sourceNodeId: playerNodeId(playerId ?? relationship.playerId),
    targetNodeId: counterpartNodeId(relationship.counterpartId),
    counterpartId: relationship.counterpartId,
    counterpartKind:
      relationship.counterpartKind === 'HELPER'
        ? 'HELPER'
        : relationship.counterpartKind === 'HATER'
          ? 'RIVAL'
          : relationship.counterpartKind === 'SYSTEM'
            ? 'SYSTEM'
            : 'NPC',
    playerId: playerId ?? relationship.playerId,
    roomId,
    channelId,
    vector: sharedVectorFromLegacy(relationship),
    createdAt: relationship.lastMeaningfulShiftAt,
    updatedAt: relationship.lastMeaningfulShiftAt,
    callbackHints: relationship.callbacksAvailable.map((quoteId, index) => ({
      callbackId: `${quoteId}`,
      label: `legacy-${index + 1}`,
      text: `Legacy callback ${index + 1}`,
      weight01: clampShared01(0.45 + index * 0.05),
    })),
    publicWitness01: visibleChannelPublicWitness01(channelId),
    rescueDebt01: score100To01(relationship.vector.rescueDebt),
    callbackLoad01: clamp01((relationship.callbacksAvailable.length || 0) / 6),
    legendPotential01: clamp01(
      (score100To01(relationship.vector.respect) * 0.3) +
      (score100To01(relationship.vector.rivalryIntensity) * 0.2) +
      (score100To01(relationship.vector.fascination) * 0.2),
    ),
    notes: [`legacy:${relationship.escalationTier}`],
  });
}

export function buildRelationshipRuntimeFromEngine(
  options: BuildRelationshipRuntimeFromEngineOptions,
): RelationshipRuntimeState {
  const now = stableNow();
  const initialEdges = Object.values(options.state.relationshipsByCounterpartId).map((relationship) =>
    edgeFromLegacyRelationship(relationship, options.playerId, options.roomId),
  );

  const graph = createRelationshipGraph({
    playerId: options.playerId ?? undefined,
    roomId: options.roomId ?? options.state.memberships[0]?.roomId,
    edges: initialEdges,
    notes: stableStringList([
      'hydrated-from-engine',
      `mount:${options.state.activeMountTarget}`,
      ...(options.notes ?? []),
    ]),
    createdAt: now,
    updatedAt: now,
  });

  let runtime = createEmptyRelationshipRuntimeState({
    playerId: options.playerId ?? undefined,
    roomId: options.roomId ?? options.state.memberships[0]?.roomId,
    graph,
    notes: options.notes,
    now,
  });

  const allMessages = CHAT_VISIBLE_CHANNELS.flatMap((channelId) => options.state.messagesByChannel[channelId]);
  for (const message of allMessages) {
    runtime = applyMessageToRelationshipRuntime(runtime, message, {
      playerId: options.playerId,
      roomId: runtime.activeRoomId,
      channelId: message.channel,
      now: toUnixMs(message.ts),
      tags: message.tags,
    }).state;
  }

  return normalizeRelationshipRuntimeState(
    {
      ...runtime,
      runtimeMode: 'REHYDRATING',
      lastHydratedAt: now,
      notes: trimNotes([...runtime.notes, 'engine-hydration-complete'], DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxNotes),
    },
    now,
  );
}

// ============================================================================
// MARK: Update helpers
// ============================================================================

export function replaceEdgeInGraph(
  graph: ChatRelationshipGraphView,
  edge: ChatRelationshipGraphEdge,
  markNote?: string,
): ChatRelationshipGraphView {
  const nextEdges = [
    ...graph.edges.filter((item) => item.edgeId !== edge.edgeId),
    edge,
  ];
  return createRelationshipGraph({
    graphId: graph.graphId,
    playerId: graph.playerId,
    roomId: graph.roomId,
    edges: nextEdges,
    notes: markNote ? trimNotes([...graph.notes, markNote], DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxNotes) : graph.notes,
    createdAt: graph.createdAt,
    updatedAt: edge.updatedAt,
  });
}

export function ensureEdgeForCounterpart(
  runtime: RelationshipRuntimeState,
  counterpartId: string,
  counterpartKind: ChatRelationshipCounterpartKind,
  patch?: Partial<ChatRelationshipGraphEdge> & {
    channelId?: ChatChannelId;
    updatedAt?: UnixMs;
    createdAt?: UnixMs;
  },
): ChatRelationshipGraphEdge {
  const existing = findEdgeByCounterpartId(runtime.graph, counterpartId);
  if (existing) return existing;

  return createRelationshipGraphEdge({
    graphId: runtime.graph.graphId,
    sourceNodeId: playerNodeId(runtime.playerId ? `${runtime.playerId}` : undefined),
    targetNodeId: counterpartNodeId(counterpartId),
    counterpartId,
    counterpartKind,
    playerId: runtime.playerId ? `${runtime.playerId}` : undefined,
    roomId: runtime.activeRoomId,
    channelId: patch?.channelId ?? 'GLOBAL',
    createdAt: patch?.createdAt,
    updatedAt: patch?.updatedAt,
    vector: patch?.vector,
    eventHistoryTail: patch?.eventHistoryTail,
    callbackHints: patch?.callbackHints,
    anchors: patch?.anchors,
    publicWitness01: patch?.witnessLoad01,
    rescueDebt01: patch?.rescueDebt01,
    negotiationHeat01: patch?.negotiationHeat01,
    legendPotential01: patch?.legendPotential01,
    callbackLoad01: patch?.callbackLoad01,
    priorSceneId: patch?.continuity?.priorSceneId ?? undefined,
    currentSceneId: patch?.continuity?.currentSceneId ?? undefined,
    notes: patch?.notes,
  });
}

export function maybeCreateAnchorForEvent(
  edge: ChatRelationshipGraphEdge,
  event: ChatRelationshipEventDescriptor,
  message?: ChatMessage,
): ChatRelationshipAnchor | undefined {
  const impact: ChatRelationshipMomentImpact = momentImpactForEventType(event.eventType);
  const salience01 = clamp01(
    (event.intensity01 ?? 0) * 0.4 +
    impact.legendDelta * 0.35 +
    impact.callbackDelta * 0.25 +
    (event.publicWitness01 ?? 0) * 0.15,
  );

  if (salience01 < DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.minAnchorSalience01) return undefined;

  let role: ChatRelationshipAnchor['role'] = 'WITNESS';
  if (impact.rescueDebtDelta > 0) role = 'RESCUE_MARK';
  else if (impact.legendDelta > 0.08) role = 'LEGEND_ECHO';
  else if (impact.callbackDelta > 0.05) role = 'CALLBACK_SEED';

  return createRelationshipAnchor(event.summary ?? event.eventType, {
    role,
    salience01,
    createdAt: event.createdAt,
    sourceEventId: event.eventId,
    sourceMessageId: event.sourceMessageId,
    sourceSceneId: event.sceneId,
    sourceMomentId: event.sceneId,
    pressureBand: event.pressureBand,
    visibilityMode: CHAT_CHANNEL_DESCRIPTORS[event.channelId as ChatChannelId]?.visibleToPlayer ? 'VISIBLE' : 'SHADOW_DOMINANT',
    text: message?.body,
    tags: stableStringList([...(event.tags ?? []), role.toLowerCase(), edge.counterpartId ?? edge.targetNodeId]),
  });
}

export function applyEventToRelationshipRuntime(
  runtime: RelationshipRuntimeState,
  event: ChatRelationshipEventDescriptor,
  message?: ChatMessage,
  note?: string,
): RelationshipEventApplicationResult {
  const existing = ensureEdgeForCounterpart(runtime, event.counterpartId, event.counterpartKind, {
    channelId: event.channelId as ChatChannelId | undefined,
    updatedAt: toUnixMs(event.createdAt),
  });

  let nextEdge = pushEventIntoEdge(existing, event);
  let anchorAdded = false;
  const anchor = maybeCreateAnchorForEvent(nextEdge, event, message);
  if (anchor) {
    nextEdge = addAnchorToEdge(nextEdge, anchor);
    anchorAdded = true;
  }

  const nextGraph = replaceEdgeInGraph(runtime.graph, nextEdge, note ?? `event:${event.eventType}`);
  const nextState = normalizeRelationshipRuntimeState(
    {
      ...runtime,
      runtimeMode: 'LIVE',
      graph: nextGraph,
      lastAuthoritativeAt: toUnixMs(event.createdAt),
      notes: trimNotes(
        [...runtime.notes, `${event.counterpartId}:${event.eventType}`],
        DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxNotes,
      ),
    },
    toUnixMs(event.createdAt),
  );

  const counterpart = nextState.counterpartsById[event.counterpartId];
  return {
    state: nextState,
    counterpart,
    affectedChannelIds: stableStringList([event.channelId ?? 'SYSTEM_SHADOW']) as readonly ChatChannelId[],
    anchorAdded,
  };
}

export function applyMessageToRelationshipRuntime(
  runtime: RelationshipRuntimeState,
  message: ChatMessage,
  context: RelationshipEventBuildContext = {},
): RelationshipEventApplicationResult {
  const event = eventDescriptorFromMessage(message, context);
  return applyEventToRelationshipRuntime(runtime, event, message, `message:${message.kind}`);
}

export function applySignalToRelationshipRuntime(
  runtime: RelationshipRuntimeState,
  signal: ChatUpstreamSignal,
  counterpartId: string,
  counterpartKind: ChatRelationshipCounterpartKind,
  context: RelationshipEventBuildContext = {},
): RelationshipEventApplicationResult {
  const event = eventDescriptorFromSignal(signal, counterpartId, counterpartKind, context);
  if (!event) {
    return {
      state: runtime,
      counterpart: runtime.counterpartsById[counterpartId],
      affectedChannelIds: [],
      anchorAdded: false,
    };
  }
  return applyEventToRelationshipRuntime(runtime, event, undefined, `signal:${signal.signalType}`);
}

export function applyLegacyRelationshipToRuntime(
  runtime: RelationshipRuntimeState,
  legacy: LegacyChatRelationshipState,
  note = 'legacy-upsert',
): RelationshipRuntimeState {
  const edge = edgeFromLegacyRelationship(legacy, runtime.playerId ? `${runtime.playerId}` : undefined, runtime.activeRoomId);
  const graph = replaceEdgeInGraph(runtime.graph, edge, note);
  return normalizeRelationshipRuntimeState(
    {
      ...runtime,
      runtimeMode: 'RECONCILING',
      graph,
      lastAuthoritativeAt: legacy.lastMeaningfulShiftAt,
      notes: trimNotes([...runtime.notes, `${note}:${legacy.counterpartId}`], DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxNotes),
    },
    legacy.lastMeaningfulShiftAt,
  );
}

export function mergeRelationshipRuntimeStates(
  base: RelationshipRuntimeState,
  incoming: RelationshipRuntimeState,
  options: RelationshipMergeOptions = {},
): RelationshipRuntimeState {
  const mergedGraph = mergeGraphs(base.graph, incoming.graph);
  let normalized = normalizeRelationshipRuntimeState({
    ...base,
    runtimeMode: options.markAuthoritative ? 'RECONCILING' : 'LIVE',
    graph: mergedGraph,
    lastAuthoritativeAt: options.markAuthoritative ? stableNow() : base.lastAuthoritativeAt,
    notes: trimNotes(
      [
        ...base.notes,
        ...(options.recordNote ? [options.recordNote] : []),
        ...incoming.notes,
      ],
      DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxNotes,
    ),
  });

  if (options.preferIncomingFocus) {
    normalized = {
      ...normalized,
      focusByChannel: {
        ...normalized.focusByChannel,
        ...incoming.focusByChannel,
      },
    };
  }

  return normalizeRelationshipRuntimeState(normalized);
}

export function decayRelationshipRuntime(
  runtime: RelationshipRuntimeState,
  now: UnixMs = stableNow(),
): RelationshipRuntimeState {
  const nextEdges = runtime.graph.edges.map((edge) => {
    const ageMs = Math.max(0, Number(now) - edge.updatedAt);
    if (ageMs < DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.staleDecayIntervalMs) return edge;

    const decayFactor = clamp01(ageMs / (DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.staleDecayIntervalMs * 6));
    const vector = {
      ...edge.vector,
      obsession01: clamp01(edge.vector.obsession01 * (1 - 0.12 * decayFactor)),
      unfinishedBusiness01: clamp01(edge.vector.unfinishedBusiness01 * (1 - 0.08 * decayFactor)),
      traumaDebt01: clamp01(edge.vector.traumaDebt01 * (1 - 0.05 * decayFactor)),
      familiarity01: clamp01(edge.vector.familiarity01 * (1 - 0.02 * decayFactor)),
      patience01: clamp01(edge.vector.patience01 + 0.03 * decayFactor),
    };

    return createRelationshipGraphEdge({
      graphId: runtime.graph.graphId,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      counterpartId: edge.counterpartId ?? edge.targetNodeId,
      counterpartKind: edgeToLegacyBridge(edge).counterpartState.counterpartKind,
      playerId: runtime.playerId ? `${runtime.playerId}` : undefined,
      channelId: (edgeToLegacyBridge(edge).counterpartState.lastChannelId ?? 'GLOBAL'),
      roomId: runtime.activeRoomId,
      vector,
      eventHistoryTail: edge.eventHistoryTail,
      callbackHints: edge.callbackHints,
      anchors: edge.anchors,
      createdAt: edge.createdAt,
      updatedAt: now,
      publicWitness01: edge.witnessLoad01,
      rescueDebt01: edge.rescueDebt01,
      negotiationHeat01: edge.negotiationHeat01,
      legendPotential01: edge.legendPotential01,
      callbackLoad01: edge.callbackLoad01,
      priorModeId: edge.continuity.priorModeId,
      currentModeId: edge.continuity.currentModeId,
      priorSceneId: edge.continuity.priorSceneId,
      currentSceneId: edge.continuity.currentSceneId,
      priorMomentId: edge.continuity.priorMomentId,
      currentMomentId: edge.continuity.currentMomentId,
      notes: trimNotes([...edge.threadSummary.anchorIds, 'decayed'], 16),
    });
  });

  return normalizeRelationshipRuntimeState(
    {
      ...runtime,
      runtimeMode: 'DRAINING',
      graph: createRelationshipGraph({
        graphId: runtime.graph.graphId,
        playerId: runtime.graph.playerId,
        roomId: runtime.graph.roomId,
        edges: nextEdges,
        notes: trimNotes([...runtime.notes, `decay:${now}`], DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxNotes),
        createdAt: runtime.graph.createdAt,
        updatedAt: now,
      }),
    },
    now,
  );
}

// ============================================================================
// MARK: Engine reconciliation / projections
// ============================================================================

export function engineProjectionFromRelationshipRuntime(
  runtime: RelationshipRuntimeState,
): RelationshipEngineProjection {
  const strongest = sortEdgesByHeat(runtime.graph.edges)[0];
  const focusedCounterpartByChannel = Object.fromEntries(
    Object.entries(runtime.focusByChannel).map(([channelId, state]) => [channelId, state.counterpartId]),
  ) as Readonly<Record<ChatChannelId, string | undefined>>;
  return {
    relationshipsByCounterpartId: runtime.legacyByCounterpartId,
    strongestCounterpartId: strongest?.counterpartId,
    focusedCounterpartByChannel,
    shouldSurfaceRelationshipBanner:
      runtime.metrics.heat01 >= 0.42 ||
      runtime.metrics.unresolvedCounterparts > 0 ||
      runtime.metrics.callbackWeight01 >= 0.34,
    shouldEscalateDrama:
      runtime.metrics.legendWeight01 >= 0.36 ||
      runtime.metrics.activeObsessionCount > 0,
    shouldRunRescue:
      Object.values(runtime.counterpartsById).some((value) => value.shouldRescueGate) ||
      runtime.metrics.helperRescueCount > 0,
  };
}

export function reconcileRelationshipRuntimeWithEngine(
  runtime: RelationshipRuntimeState,
  state: ChatEngineState,
  playerId?: string,
): RelationshipRuntimeState {
  let next = runtime;
  for (const legacy of Object.values(state.relationshipsByCounterpartId)) {
    next = applyLegacyRelationshipToRuntime(next, legacy, 'engine-reconcile');
  }
  const allMessages = CHAT_VISIBLE_CHANNELS.flatMap((channelId) => state.messagesByChannel[channelId]);
  for (const message of allMessages.slice(-64)) {
    const counterpartId = stableCounterpartId(message);
    if (next.counterpartsById[counterpartId]?.lastMessageId === message.id) continue;
    next = applyMessageToRelationshipRuntime(next, message, {
      playerId,
      roomId: next.activeRoomId,
      channelId: message.channel,
      now: toUnixMs(message.ts),
      tags: message.tags,
    }).state;
  }
  return normalizeRelationshipRuntimeState(
    {
      ...next,
      runtimeMode: 'RECONCILING',
      lastReconciledAt: stableNow(),
      notes: trimNotes([...next.notes, 'engine-reconciled'], DEFAULT_RELATIONSHIP_RUNTIME_CONFIG.maxNotes),
    },
    stableNow(),
  );
}

export function selectStrongestRelationshipRuntime(
  runtime: RelationshipRuntimeState,
): RelationshipCounterpartRuntime | undefined {
  const strongestId = runtime.metrics.topCounterpartId;
  return strongestId ? runtime.counterpartsById[strongestId] : undefined;
}

export function selectCounterpartRuntime(
  runtime: RelationshipRuntimeState,
  counterpartId: string,
): RelationshipCounterpartRuntime | undefined {
  return runtime.counterpartsById[counterpartId];
}

export function selectFocusedCounterpartForChannel(
  runtime: RelationshipRuntimeState,
  channelId: ChatChannelId,
): RelationshipCounterpartRuntime | undefined {
  const focus = runtime.focusByChannel[channelId];
  if (!focus?.counterpartId) return undefined;
  return runtime.counterpartsById[focus.counterpartId];
}

export function selectRelationshipHeatForChannel(
  runtime: RelationshipRuntimeState,
  channelId: ChatChannelId,
): number {
  const focus = selectFocusedCounterpartForChannel(runtime, channelId);
  if (!focus) return 0;
  return clamp01(
    focus.projection.intensity01 * 0.5 +
    focus.projection.callbackLoad01 * 0.2 +
    focus.projection.witnessLoad01 * 0.3,
  );
}

export function relationshipRuntimeSummary(
  runtime: RelationshipRuntimeState,
): JsonObject {
  return {
    version: runtime.version,
    runtimeMode: runtime.runtimeMode,
    playerId: runtime.playerId ? `${runtime.playerId}` : null,
    roomId: runtime.activeRoomId ?? null,
    graphId: runtime.graph.graphId,
    totalCounterparts: runtime.metrics.totalCounterparts,
    unresolvedCounterparts: runtime.metrics.unresolvedCounterparts,
    heat01: runtime.metrics.heat01,
    callbackWeight01: runtime.metrics.callbackWeight01,
    legendWeight01: runtime.metrics.legendWeight01,
    topCounterpartId: runtime.metrics.topCounterpartId ?? null,
    activeObsessionCount: runtime.metrics.activeObsessionCount,
    helperRescueCount: runtime.metrics.helperRescueCount,
    rivalPressureCount: runtime.metrics.rivalPressureCount,
    lastUpdatedAt: runtime.metrics.lastUpdatedAt ?? null,
    notes: [...runtime.notes],
  };
}

export const CHAT_RELATIONSHIP_RUNTIME_REGISTRY = Object.freeze({
  filePath: CHAT_RELATIONSHIP_RUNTIME_FILE_PATH,
  version: CHAT_RELATIONSHIP_RUNTIME_VERSION,
  config: DEFAULT_RELATIONSHIP_RUNTIME_CONFIG,
  authorityRoots: {
    sharedContractsRoot: CHAT_ENGINE_AUTHORITIES.sharedContractsRoot,
    frontendEngineRoot: CHAT_ENGINE_AUTHORITIES.frontendEngineRoot,
    backendEngineRoot: CHAT_ENGINE_AUTHORITIES.backendEngineRoot,
  },
});

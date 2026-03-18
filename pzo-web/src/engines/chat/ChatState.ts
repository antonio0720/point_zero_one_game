// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/ChatState.ts

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE FRONTEND STATE
 * FILE: pzo-web/src/engines/chat/ChatState.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend state factory + state mutation helpers for the new
 * sovereign chat engine lane.
 *
 * This file is intentionally NOT a reducer-only file. It owns:
 * - default state construction
 * - deterministic normalization
 * - optimistic local staging
 * - authoritative frame application
 * - channel unread and notification logic
 * - presence / typing / silence / reveal queue mutation
 * - relationship and learning profile hydration
 * - cache serialization / hydration
 * - feature snapshot derivation
 *
 * Design law
 * ----------
 * ChatState is a lawful read/write model for the frontend chat runtime.
 * It does not reach into React, sockets, battle classes, or store internals.
 * It transforms state. ChatEngine orchestrates time, transport, observers,
 * and upstream event ingestion.
 *
 * Migration law
 * -------------
 * This file is phase-one canonical state ownership for:
 *   /pzo-web/src/engines/chat/ChatState.ts
 *
 * It mirrors the permanent doctrine while remaining compile-safe before
 * ChatReducer.ts / ChatSelectors.ts / ChatSocketClient.ts / ChatEventBridge.ts
 * exist as separate modules.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  BotId,
  BotState,
} from '../battle/types';

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_ENGINE_CONSTANTS,
  CHAT_MOUNT_PRESETS,
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
} from './types';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatAuthoritativeFrame,
  ChatChannelId,
  ChatChannelMood,
  ChatClientSendMessageRequest,
  ChatComposerState,
  ChatConnectionState,
  ChatContinuityState,
  ChatDeliveryState,
  ChatDropOffSignals,
  ChatEmotionVector,
  ChatEngineState,
  ChatFeatureSnapshot,
  ChatInterventionId,
  ChatLegendMeta,
  ChatLearningProfile,
  ChatLiveOpsState,
  ChatMessage,
  ChatMessageId,
  ChatModerationDecision,
  ChatMountTarget,
  ChatNotificationKind,
  ChatNotificationState,
  ChatPresenceSnapshot,
  ChatReadReceipt,
  ChatRelationshipId,
  ChatRelationshipState,
  ChatReplayMeta,
  ChatRequestId,
  ChatRescueDecision,
  ChatRevealSchedule,
  ChatRoomId,
  ChatRoomMembership,
  ChatSceneId,
  ChatScenePlan,
  ChatSessionId,
  ChatShadowChannel,
  ChatSilenceDecision,
  ChatTelemetryId,
  ChatTypingSnapshot,
  ChatTypingState,
  ChatUpstreamSignal,
  ChatUserId,
  ChatVisibleChannel,
  Nullable,
  PressureTier,
  Score01,
  Score100,
  TickTier,
  UnixMs,
} from './types';

// ============================================================================
// MARK: Internal state-only helpers and payloads
// ============================================================================

export interface ChatStateCachePayload {
  readonly schemaVersion: 1;
  readonly persistedAt: number;
  readonly activeMountTarget: ChatMountTarget;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly messagesByChannel: Readonly<Record<ChatVisibleChannel, readonly ChatMessage[]>>;
  readonly notifications: ChatNotificationState;
  readonly learningProfile?: ChatLearningProfile;
  readonly continuity: ChatContinuityState;
}

export interface ChatStateBootstrapOptions {
  readonly mountTarget?: ChatMountTarget;
  readonly initialVisibleChannel?: ChatVisibleChannel;
  readonly initialRoomId?: ChatRoomId;
  readonly initialSessionId?: ChatSessionId;
  readonly initialLearningProfile?: ChatLearningProfile;
  readonly initialMessages?: Partial<Record<ChatVisibleChannel, readonly ChatMessage[]>>;
}

export interface StageOptimisticMessageOptions {
  readonly requestId: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly body: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly senderRank?: string;
  readonly at: UnixMs;
  readonly tags?: readonly string[];
}

export interface AppendMessageOptions {
  readonly channelId: ChatVisibleChannel;
  readonly message: ChatMessage;
  readonly markUnreadWhenBackgrounded?: boolean;
}

export interface AuthoritativeStatePatch {
  readonly frame: ChatAuthoritativeFrame;
  readonly activeRoomId?: ChatRoomId;
  readonly activeSessionId?: ChatSessionId;
}

export interface FeatureSnapshotInputs {
  readonly now: UnixMs;
  readonly panelOpen: boolean;
  readonly currentMountTarget: ChatMountTarget;
  readonly activeChannel: ChatChannelId;
  readonly composerLength: number;
  readonly silenceWindowMs: number;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly haterHeat?: number;
  readonly dropOffSignals?: Partial<ChatDropOffSignals>;
}

export interface LegacyGameChatContext {
  readonly tick: number;
  readonly cash: number;
  readonly regime: string;
  readonly events: readonly string[];
  readonly netWorth: number;
  readonly income: number;
  readonly expenses: number;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly haterHeat?: number;
}

const CHAT_STATE_CACHE_SCHEMA_VERSION = 1 as const;
const MAX_VISIBLE_WINDOW = CHAT_ENGINE_CONSTANTS.maxVisibleMessagesDefault;
const DEFAULT_COMPOSER_MAX = CHAT_ENGINE_CONSTANTS.maxComposerLength;

// ============================================================================
// MARK: Primitive helpers
// ============================================================================

function nowAsUnixMs(): UnixMs {
  return Date.now() as UnixMs;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toScore100(value: number): Score100 {
  return clamp(Math.round(value), 0, 100) as Score100;
}

function toScore01(value: number): Score01 {
  return clamp(Number(value.toFixed(4)), 0, 1) as Score01;
}

function shallowCopyArray<T>(arr: readonly T[] | undefined): T[] {
  return arr ? [...arr] : [];
}

function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function stableSortMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });
}

function trimMessages(messages: readonly ChatMessage[], limit = MAX_VISIBLE_WINDOW): ChatMessage[] {
  if (messages.length <= limit) return [...messages];
  return messages.slice(messages.length - limit);
}

function buildMessageIdentityKey(message: ChatMessage): string {
  const requestId = message.audit?.requestId ?? '';
  const proofHash = message.proofHash ?? message.proof?.proofHash ?? '';
  const senderId = message.senderId ?? '';
  const kind = message.kind ?? '';
  const ts = message.ts ?? 0;
  const body = message.body ?? '';
  return `${message.id}::${requestId}::${proofHash}::${senderId}::${kind}::${ts}::${body}`;
}

function isBackgroundUnreadEligible(message: ChatMessage): boolean {
  if (message.moderation?.state === 'BLOCKED') return false;
  if (message.moderation?.state === 'REDACTED') return false;
  return message.senderId !== 'player-local' && message.senderId !== 'self';
}

function defaultDropOffSignals(): ChatDropOffSignals {
  return {
    silenceAfterCollapseMs: 0,
    repeatedComposerDeletes: 0,
    panelCollapseCount: 0,
    channelHopCount: 0,
    failedInputCount: 0,
    negativeEmotionScore: toScore100(0),
  };
}

function defaultEmotionVector(): ChatEmotionVector {
  return {
    intimidation: toScore100(0),
    confidence: toScore100(50),
    frustration: toScore100(0),
    curiosity: toScore100(35),
    attachment: toScore100(0),
    embarrassment: toScore100(0),
    relief: toScore100(0),
    dominance: toScore100(0),
    desperation: toScore100(0),
    trust: toScore100(15),
  };
}

function defaultAffect(): ChatAffectSnapshot {
  return {
    vector: defaultEmotionVector(),
    lastUpdatedAt: nowAsUnixMs(),
    dominantEmotion: 'CONFIDENCE',
    confidenceSwingDelta: 0,
  };
}

// ============================================================================
// MARK: Default map factories
// ============================================================================

export function createEmptyMessagesByChannel(): Readonly<
  Record<ChatVisibleChannel, readonly ChatMessage[]>
> {
  return {
    GLOBAL: [],
    SYNDICATE: [],
    DEAL_ROOM: [],
    LOBBY: [],
  };
}

export function createEmptyShadowMessageCountByChannel(): Readonly<
  Record<ChatShadowChannel, number>
> {
  return {
    SYSTEM_SHADOW: 0,
    NPC_SHADOW: 0,
    RIVALRY_SHADOW: 0,
    RESCUE_SHADOW: 0,
    LIVEOPS_SHADOW: 0,
  };
}

export function createDefaultAudienceHeatMap(): Readonly<
  Record<ChatVisibleChannel, ChatAudienceHeat>
> {
  const ts = nowAsUnixMs();
  return {
    GLOBAL: {
      channelId: 'GLOBAL',
      heat: toScore100(12),
      hype: toScore100(8),
      ridicule: toScore100(4),
      scrutiny: toScore100(16),
      volatility: toScore100(12),
      lastUpdatedAt: ts,
    },
    SYNDICATE: {
      channelId: 'SYNDICATE',
      heat: toScore100(6),
      hype: toScore100(4),
      ridicule: toScore100(1),
      scrutiny: toScore100(20),
      volatility: toScore100(6),
      lastUpdatedAt: ts,
    },
    DEAL_ROOM: {
      channelId: 'DEAL_ROOM',
      heat: toScore100(10),
      hype: toScore100(0),
      ridicule: toScore100(0),
      scrutiny: toScore100(30),
      volatility: toScore100(10),
      lastUpdatedAt: ts,
    },
    LOBBY: {
      channelId: 'LOBBY',
      heat: toScore100(14),
      hype: toScore100(10),
      ridicule: toScore100(6),
      scrutiny: toScore100(10),
      volatility: toScore100(8),
      lastUpdatedAt: ts,
    },
  };
}

export function createDefaultChannelMoodMap(): Readonly<
  Record<ChatChannelId, ChatChannelMood>
> {
  const ts = nowAsUnixMs();
  return {
    GLOBAL: { channelId: 'GLOBAL', mood: 'CALM', reason: 'initial', updatedAt: ts },
    SYNDICATE: { channelId: 'SYNDICATE', mood: 'SUSPICIOUS', reason: 'initial', updatedAt: ts },
    DEAL_ROOM: { channelId: 'DEAL_ROOM', mood: 'PREDATORY', reason: 'initial', updatedAt: ts },
    LOBBY: { channelId: 'LOBBY', mood: 'CALM', reason: 'initial', updatedAt: ts },
    SYSTEM_SHADOW: { channelId: 'SYSTEM_SHADOW', mood: 'SUSPICIOUS', reason: 'initial', updatedAt: ts },
    NPC_SHADOW: { channelId: 'NPC_SHADOW', mood: 'SUSPICIOUS', reason: 'initial', updatedAt: ts },
    RIVALRY_SHADOW: { channelId: 'RIVALRY_SHADOW', mood: 'HOSTILE', reason: 'initial', updatedAt: ts },
    RESCUE_SHADOW: { channelId: 'RESCUE_SHADOW', mood: 'MOURNFUL', reason: 'initial', updatedAt: ts },
    LIVEOPS_SHADOW: { channelId: 'LIVEOPS_SHADOW', mood: 'SUSPICIOUS', reason: 'initial', updatedAt: ts },
  };
}

export function createDefaultNotificationState(): ChatNotificationState {
  return {
    unreadByChannel: {
      GLOBAL: 0,
      SYNDICATE: 0,
      DEAL_ROOM: 0,
      LOBBY: 0,
    },
    notificationKinds: [],
    hasAnyUnread: false,
    lastNotifiedAt: undefined,
  };
}

export function createDefaultComposerState(
  activeChannel: ChatVisibleChannel,
): ChatComposerState {
  return {
    activeChannel,
    draftByChannel: {
      GLOBAL: '',
      SYNDICATE: '',
      DEAL_ROOM: '',
      LOBBY: '',
    },
    disabled: false,
    disabledReason: undefined,
    maxLength: DEFAULT_COMPOSER_MAX,
    lastEditedAt: undefined,
  };
}

export function createDefaultConnectionState(
  sessionId?: ChatSessionId,
): ChatConnectionState {
  return {
    status: 'IDLE',
    sessionId,
    latencyMs: undefined,
    retryCount: 0,
    lastError: undefined,
  };
}

export function createDefaultContinuityState(): ChatContinuityState {
  return {
    lastMountTarget: undefined,
    activeSceneId: undefined,
    unresolvedMomentIds: [],
    carryoverSummary: undefined,
    carriedPersonaIds: [],
  };
}

export function createDefaultLiveOpsState(): ChatLiveOpsState {
  return {
    activeWorldEvents: [],
    suppressedHelperChannels: [],
    boostedCrowdChannels: [],
    globalMoodOverride: undefined,
  };
}

// ============================================================================
// MARK: Membership helpers
// ============================================================================

export function createDefaultMemberships(roomId?: ChatRoomId): readonly ChatRoomMembership[] {
  if (!roomId) return [];
  const joinedAt = nowAsUnixMs();
  return CHAT_VISIBLE_CHANNELS.map((channelId) => ({
    roomId,
    channelId,
    joinedAt,
    isAuthoritative: false,
  }));
}

export function upsertMemberships(
  current: readonly ChatRoomMembership[],
  nextRoomId: ChatRoomId,
): readonly ChatRoomMembership[] {
  const existingByChannel = new Map<ChatChannelId, ChatRoomMembership>();
  for (const item of current) existingByChannel.set(item.channelId, item);

  const joinedAt = nowAsUnixMs();
  return CHAT_VISIBLE_CHANNELS.map((channelId) => {
    const existing = existingByChannel.get(channelId);
    return {
      roomId: nextRoomId,
      channelId,
      joinedAt: existing?.joinedAt ?? joinedAt,
      isAuthoritative: existing?.isAuthoritative ?? false,
    };
  });
}

// ============================================================================
// MARK: Core state factory
// ============================================================================

export function createChatEngineState(
  options: ChatStateBootstrapOptions = {},
): ChatEngineState {
  const mountTarget = options.mountTarget ?? 'LOBBY_SCREEN';
  const preset = CHAT_MOUNT_PRESETS[mountTarget];
  const visibleChannel = options.initialVisibleChannel ?? preset.defaultVisibleChannel;
  const roomId = options.initialRoomId;

  let messagesByChannel = createEmptyMessagesByChannel();
  if (options.initialMessages) {
    const next: Record<ChatVisibleChannel, readonly ChatMessage[]> = {
      GLOBAL: normalizeMessageWindow(options.initialMessages.GLOBAL ?? []),
      SYNDICATE: normalizeMessageWindow(options.initialMessages.SYNDICATE ?? []),
      DEAL_ROOM: normalizeMessageWindow(options.initialMessages.DEAL_ROOM ?? []),
      LOBBY: normalizeMessageWindow(options.initialMessages.LOBBY ?? []),
    };
    messagesByChannel = next;
  }

  return {
    version: CHAT_ENGINE_CONSTANTS.version,
    connection: createDefaultConnectionState(options.initialSessionId),
    activeMountTarget: mountTarget,
    activeVisibleChannel: visibleChannel,
    memberships: createDefaultMemberships(roomId),
    messagesByChannel,
    shadowMessageCountByChannel: createEmptyShadowMessageCountByChannel(),
    composer: createDefaultComposerState(visibleChannel),
    notifications: createDefaultNotificationState(),
    presenceByActorId: {},
    typingByActorId: {},
    activeScene: undefined,
    pendingReveals: [],
    currentSilence: undefined,
    audienceHeat: createDefaultAudienceHeatMap(),
    channelMoodByChannel: createDefaultChannelMoodMap(),
    reputation: {
      publicAura: toScore100(0),
      syndicateCredibility: toScore100(0),
      negotiationFear: toScore100(0),
      comebackRespect: toScore100(0),
      humiliationRisk: toScore100(0),
    },
    affect: defaultAffect(),
    liveOps: createDefaultLiveOpsState(),
    relationshipsByCounterpartId: {},
    offerState: undefined,
    learningProfile: options.initialLearningProfile,
    continuity: createDefaultContinuityState(),
    lastAuthoritativeSyncAt: undefined,
  };
}

export function cloneChatEngineState(state: ChatEngineState): ChatEngineState {
  return {
    ...state,
    connection: { ...state.connection },
    memberships: state.memberships.map((item) => ({ ...item })),
    messagesByChannel: {
      GLOBAL: state.messagesByChannel.GLOBAL.map((m) => cloneMessage(m)),
      SYNDICATE: state.messagesByChannel.SYNDICATE.map((m) => cloneMessage(m)),
      DEAL_ROOM: state.messagesByChannel.DEAL_ROOM.map((m) => cloneMessage(m)),
      LOBBY: state.messagesByChannel.LOBBY.map((m) => cloneMessage(m)),
    },
    shadowMessageCountByChannel: { ...state.shadowMessageCountByChannel },
    composer: {
      ...state.composer,
      draftByChannel: { ...state.composer.draftByChannel },
    },
    notifications: {
      ...state.notifications,
      unreadByChannel: { ...state.notifications.unreadByChannel },
      notificationKinds: [...state.notifications.notificationKinds],
    },
    presenceByActorId: clonePresenceMap(state.presenceByActorId),
    typingByActorId: cloneTypingMap(state.typingByActorId),
    activeScene: state.activeScene ? cloneScenePlan(state.activeScene) : undefined,
    pendingReveals: state.pendingReveals.map((item) => ({ ...item })),
    currentSilence: state.currentSilence
      ? {
          ...state.currentSilence,
          breakConditions: [...state.currentSilence.breakConditions],
        }
      : undefined,
    audienceHeat: {
      GLOBAL: { ...state.audienceHeat.GLOBAL },
      SYNDICATE: { ...state.audienceHeat.SYNDICATE },
      DEAL_ROOM: { ...state.audienceHeat.DEAL_ROOM },
      LOBBY: { ...state.audienceHeat.LOBBY },
    },
    channelMoodByChannel: cloneChannelMoodMap(state.channelMoodByChannel),
    reputation: { ...state.reputation },
    affect: {
      ...state.affect,
      vector: { ...state.affect.vector },
    },
    liveOps: {
      ...state.liveOps,
      activeWorldEvents: state.liveOps.activeWorldEvents.map((item) => ({ ...item })),
      suppressedHelperChannels: [...state.liveOps.suppressedHelperChannels],
      boostedCrowdChannels: [...state.liveOps.boostedCrowdChannels],
    },
    relationshipsByCounterpartId: cloneRelationshipMap(state.relationshipsByCounterpartId),
    offerState: state.offerState ? { ...state.offerState } : undefined,
    learningProfile: state.learningProfile ? cloneLearningProfile(state.learningProfile) : undefined,
    continuity: {
      ...state.continuity,
      unresolvedMomentIds: [...state.continuity.unresolvedMomentIds],
      carriedPersonaIds: [...state.continuity.carriedPersonaIds],
    },
  };
}

// ============================================================================
// MARK: Deep clone helpers
// ============================================================================

export function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    sender: message.sender ? { ...message.sender } : undefined,
    moderation: message.moderation ? { ...message.moderation } : undefined,
    proof: message.proof ? { ...message.proof } : undefined,
    replay: message.replay ? { ...message.replay } : undefined,
    legend: message.legend ? { ...message.legend } : undefined,
    audit: message.audit ? { ...message.audit } : undefined,
    meta: message.meta
      ? {
          ...message.meta,
          botSource: message.meta.botSource ? { ...message.meta.botSource } : undefined,
          shieldMeta: message.meta.shieldMeta ? { ...message.meta.shieldMeta } : undefined,
          cascadeMeta: message.meta.cascadeMeta ? { ...message.meta.cascadeMeta } : undefined,
          pressure: message.meta.pressure ? { ...message.meta.pressure } : undefined,
          tick: message.meta.tick ? { ...message.meta.tick } : undefined,
          dealRoom: message.meta.dealRoom ? { ...message.meta.dealRoom } : undefined,
        }
      : undefined,
    botSource: message.botSource ? { ...message.botSource } : undefined,
    shieldMeta: message.shieldMeta ? { ...message.shieldMeta } : undefined,
    cascadeMeta: message.cascadeMeta ? { ...message.cascadeMeta } : undefined,
    readReceipts: message.readReceipts?.map((r) => ({ ...r })),
    relationshipIds: message.relationshipIds ? [...message.relationshipIds] : undefined,
    quoteIds: message.quoteIds ? [...message.quoteIds] : undefined,
    tags: message.tags ? [...message.tags] : undefined,
  };
}

function cloneScenePlan(scene: ChatScenePlan): ChatScenePlan {
  return {
    ...scene,
    beats: scene.beats.map((beat) => ({ ...beat })),
  };
}

function clonePresenceMap(
  map: Readonly<Record<string, ChatPresenceSnapshot>>,
): Readonly<Record<string, ChatPresenceSnapshot>> {
  const next: Record<string, ChatPresenceSnapshot> = {};
  for (const [key, value] of Object.entries(map)) next[key] = { ...value };
  return next;
}

function cloneTypingMap(
  map: Readonly<Record<string, ChatTypingSnapshot>>,
): Readonly<Record<string, ChatTypingSnapshot>> {
  const next: Record<string, ChatTypingSnapshot> = {};
  for (const [key, value] of Object.entries(map)) next[key] = { ...value };
  return next;
}

function cloneChannelMoodMap(
  map: Readonly<Record<ChatChannelId, ChatChannelMood>>,
): Readonly<Record<ChatChannelId, ChatChannelMood>> {
  const next = {} as Record<ChatChannelId, ChatChannelMood>;
  for (const key of Object.keys(map) as ChatChannelId[]) next[key] = { ...map[key] };
  return next;
}

function cloneRelationshipMap(
  map: Readonly<Record<string, ChatRelationshipState>>,
): Readonly<Record<string, ChatRelationshipState>> {
  const next: Record<string, ChatRelationshipState> = {};
  for (const [key, rel] of Object.entries(map)) {
    next[key] = {
      ...rel,
      vector: { ...rel.vector },
      callbacksAvailable: [...rel.callbacksAvailable],
    };
  }
  return next;
}

function cloneLearningProfile(profile: ChatLearningProfile): ChatLearningProfile {
  return {
    ...profile,
    coldStart: { ...profile.coldStart },
    channelAffinity: { ...profile.channelAffinity },
    helperTrustByPersona: { ...profile.helperTrustByPersona },
    haterTargetingByPersona: { ...profile.haterTargetingByPersona },
    emotionBaseline: { ...profile.emotionBaseline },
    lastTopMemoryAnchors: [...profile.lastTopMemoryAnchors],
  };
}

// ============================================================================
// MARK: Message normalization
// ============================================================================

export function normalizeMessageWindow(messages: readonly ChatMessage[]): readonly ChatMessage[] {
  const dedup = new Map<string, ChatMessage>();

  for (const message of messages) {
    const cloned = cloneMessage(message);
    const key = buildMessageIdentityKey(cloned);
    const existing = dedup.get(key);

    if (!existing) {
      dedup.set(key, cloned);
      continue;
    }

    const existingDelivery = existing.deliveryState ?? 'LOCAL_ONLY';
    const nextDelivery = cloned.deliveryState ?? 'LOCAL_ONLY';
    if (deliveryStateRank(nextDelivery) >= deliveryStateRank(existingDelivery)) {
      dedup.set(key, {
        ...existing,
        ...cloned,
        readReceipts: mergeReadReceipts(existing.readReceipts, cloned.readReceipts),
      });
    }
  }

  return trimMessages(stableSortMessages([...dedup.values()]));
}

function deliveryStateRank(state: ChatDeliveryState): number {
  switch (state) {
    case 'LOCAL_ONLY':
      return 0;
    case 'QUEUED':
      return 1;
    case 'SENT':
      return 2;
    case 'ACKNOWLEDGED':
      return 3;
    case 'AUTHORITATIVE':
      return 4;
    case 'FAILED':
      return 5;
    case 'DROPPED':
      return 6;
    default:
      return 0;
  }
}

function mergeReadReceipts(
  left?: readonly ChatReadReceipt[],
  right?: readonly ChatReadReceipt[],
): readonly ChatReadReceipt[] | undefined {
  const all = [...(left ?? []), ...(right ?? [])];
  if (all.length === 0) return undefined;

  const dedup = new Map<string, ChatReadReceipt>();
  for (const item of all) {
    const key = `${item.actorId}::${item.messageId}`;
    const existing = dedup.get(key);
    if (!existing || item.readAt >= existing.readAt) dedup.set(key, { ...item });
  }

  return [...dedup.values()].sort((a, b) => a.readAt - b.readAt);
}

// ============================================================================
// MARK: Composer and channel mutation
// ============================================================================

export function setActiveVisibleChannelInState(
  state: ChatEngineState,
  nextChannel: ChatVisibleChannel,
): ChatEngineState {
  if (state.activeVisibleChannel === nextChannel) return state;

  const unread = {
    ...state.notifications.unreadByChannel,
    [nextChannel]: 0,
  };
  const hasAnyUnread = computeHasAnyUnread(unread);

  return {
    ...cloneChatEngineState(state),
    activeVisibleChannel: nextChannel,
    composer: {
      ...state.composer,
      draftByChannel: { ...state.composer.draftByChannel },
      activeChannel: nextChannel,
    },
    notifications: {
      ...state.notifications,
      unreadByChannel: unread,
      hasAnyUnread,
      notificationKinds: hasAnyUnread
        ? [...state.notifications.notificationKinds]
        : [],
    },
  };
}

export function updateComposerDraftInState(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  draft: string,
  at: UnixMs = nowAsUnixMs(),
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    composer: {
      ...state.composer,
      draftByChannel: {
        ...state.composer.draftByChannel,
        [channelId]: draft.slice(0, state.composer.maxLength),
      },
      lastEditedAt: at,
    },
  };
}

export function setComposerDisabledInState(
  state: ChatEngineState,
  disabled: boolean,
  reason?: string,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    composer: {
      ...state.composer,
      draftByChannel: { ...state.composer.draftByChannel },
      disabled,
      disabledReason: disabled ? reason : undefined,
    },
  };
}

export function markChannelReadInState(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): ChatEngineState {
  if ((state.notifications.unreadByChannel[channelId] ?? 0) === 0) return state;

  const unreadByChannel = {
    ...state.notifications.unreadByChannel,
    [channelId]: 0,
  };
  const hasAnyUnread = computeHasAnyUnread(unreadByChannel);

  return {
    ...cloneChatEngineState(state),
    notifications: {
      ...state.notifications,
      unreadByChannel,
      hasAnyUnread,
      notificationKinds: hasAnyUnread
        ? [...state.notifications.notificationKinds]
        : [],
    },
  };
}

// ============================================================================
// MARK: Message staging and append paths
// ============================================================================

export function stageOptimisticLocalMessage(
  state: ChatEngineState,
  options: StageOptimisticMessageOptions,
): { state: ChatEngineState; message: ChatMessage } {
  const staged: ChatMessage = {
    id: (`local:${options.requestId}:${options.at}`) as ChatMessageId,
    channel: options.channelId,
    kind: 'PLAYER',
    senderId: options.senderId,
    senderName: options.senderName,
    senderRank: options.senderRank,
    body: options.body.trim(),
    ts: options.at,
    immutable: CHAT_CHANNEL_DESCRIPTORS[options.channelId].id === 'DEAL_ROOM',
    audit: {
      requestId: options.requestId,
      insertedAt: options.at,
      roomId: options.roomId,
    },
    deliveryState: 'QUEUED',
    moderation: {
      state: 'PENDING',
      playerVisible: true,
    } as ChatModerationDecision,
    tags: options.tags ? [...options.tags] : undefined,
  };

  let next = pushMessageToState(state, {
    channelId: options.channelId,
    message: staged,
    markUnreadWhenBackgrounded: false,
  });

  next = updateComposerDraftInState(next, options.channelId, '', options.at);
  return { state: next, message: staged };
}

export function pushMessageToState(
  state: ChatEngineState,
  options: AppendMessageOptions,
): ChatEngineState {
  const targetChannel = options.channelId;
  const existing = state.messagesByChannel[targetChannel];
  const merged = normalizeMessageWindow([...existing, options.message]);

  const shouldUnread =
    options.markUnreadWhenBackgrounded !== false &&
    targetChannel !== state.activeVisibleChannel &&
    isBackgroundUnreadEligible(options.message);

  const notifications = shouldUnread
    ? {
        ...state.notifications,
        unreadByChannel: {
          ...state.notifications.unreadByChannel,
          [targetChannel]: (state.notifications.unreadByChannel[targetChannel] ?? 0) + 1,
        },
        hasAnyUnread: true,
        lastNotifiedAt: nowAsUnixMs(),
        notificationKinds: normalizeNotificationKinds([
          ...state.notifications.notificationKinds,
          notificationKindFromMessage(options.message),
        ]),
      }
    : {
        ...state.notifications,
        unreadByChannel: { ...state.notifications.unreadByChannel },
        notificationKinds: [...state.notifications.notificationKinds],
      };

  return {
    ...cloneChatEngineState(state),
    messagesByChannel: {
      ...state.messagesByChannel,
      [targetChannel]: merged,
    },
    notifications,
  };
}

export function replaceMessageByIdInState(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  messageId: ChatMessageId,
  replacement: ChatMessage,
): ChatEngineState {
  const current = state.messagesByChannel[channelId];
  const idx = current.findIndex((message) => message.id === messageId);
  if (idx === -1) return pushMessageToState(state, { channelId, message: replacement });

  const copy = [...current];
  copy[idx] = cloneMessage(replacement);

  return {
    ...cloneChatEngineState(state),
    messagesByChannel: {
      ...state.messagesByChannel,
      [channelId]: normalizeMessageWindow(copy),
    },
  };
}

export function markRequestFailedInState(
  state: ChatEngineState,
  requestId: ChatRequestId,
  reason: string,
): ChatEngineState {
  let messagesByChannel = {
    ...state.messagesByChannel,
  };

  for (const channelId of CHAT_VISIBLE_CHANNELS) {
    const updated = state.messagesByChannel[channelId].map((message): ChatMessage => {
      if (message.audit?.requestId !== requestId) return message;
      return {
        ...message,
        deliveryState: 'FAILED',
        moderation: {
          state: 'ALLOWED',
          playerVisible: true,
          reasonCode: 'EMPTY',
          displayText: reason,
        },
      };
    });

    messagesByChannel = {
      ...messagesByChannel,
      [channelId]: normalizeMessageWindow(updated),
    };
  }

  return {
    ...cloneChatEngineState(state),
    messagesByChannel,
  };
}

// ============================================================================
// MARK: Presence / typing / connection
// ============================================================================

export function upsertPresenceSnapshotsInState(
  state: ChatEngineState,
  snapshots: readonly ChatPresenceSnapshot[],
): ChatEngineState {
  if (snapshots.length === 0) return state;
  const presence = { ...state.presenceByActorId };

  for (const snapshot of snapshots) {
    presence[snapshot.actorId] = { ...snapshot };
  }

  return {
    ...cloneChatEngineState(state),
    presenceByActorId: presence,
  };
}

export function upsertTypingSnapshotsInState(
  state: ChatEngineState,
  snapshots: readonly ChatTypingSnapshot[],
): ChatEngineState {
  if (snapshots.length === 0) return state;
  const typing = { ...state.typingByActorId };

  for (const snapshot of snapshots) {
    typing[snapshot.actorId] = { ...snapshot };
  }

  return {
    ...cloneChatEngineState(state),
    typingByActorId: typing,
  };
}

export function pruneExpiredTypingSnapshotsInState(
  state: ChatEngineState,
  now: UnixMs,
): ChatEngineState {
  const current = state.typingByActorId;
  const nextTyping: Record<string, ChatTypingSnapshot> = {};
  let changed = false;

  for (const [actorId, snapshot] of Object.entries(current)) {
    if (snapshot.expiresAt != null && snapshot.expiresAt <= now) {
      changed = true;
      continue;
    }
    nextTyping[actorId] = snapshot;
  }

  if (!changed) return state;
  return {
    ...cloneChatEngineState(state),
    typingByActorId: nextTyping,
  };
}

export function transitionConnectionState(
  state: ChatEngineState,
  patch: Partial<ChatConnectionState>,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    connection: {
      ...state.connection,
      ...patch,
    },
  };
}

// ============================================================================
// MARK: Scenes, reveals, silence
// ============================================================================

export function setActiveSceneInState(
  state: ChatEngineState,
  scene?: ChatScenePlan,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    activeScene: scene ? cloneScenePlan(scene) : undefined,
    continuity: {
      ...state.continuity,
      unresolvedMomentIds: [...state.continuity.unresolvedMomentIds],
      carriedPersonaIds: [...state.continuity.carriedPersonaIds],
      activeSceneId: scene?.sceneId,
    },
  };
}

export function scheduleRevealInState(
  state: ChatEngineState,
  reveal: ChatRevealSchedule,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    pendingReveals: [...state.pendingReveals, { ...reveal }].sort(
      (a, b) => a.revealAt - b.revealAt,
    ),
  };
}

export function popDueRevealsFromState(
  state: ChatEngineState,
  now: UnixMs,
): {
  state: ChatEngineState;
  due: readonly ChatRevealSchedule[];
} {
  if (state.pendingReveals.length === 0) return { state, due: [] };

  const due: ChatRevealSchedule[] = [];
  const keep: ChatRevealSchedule[] = [];

  for (const item of state.pendingReveals) {
    if (item.revealAt <= now) due.push({ ...item });
    else keep.push({ ...item });
  }

  if (due.length === 0) return { state, due: [] };

  return {
    state: {
      ...cloneChatEngineState(state),
      pendingReveals: keep,
    },
    due,
  };
}

export function beginSilenceInState(
  state: ChatEngineState,
  silence: ChatSilenceDecision,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    currentSilence: {
      ...silence,
      breakConditions: [...silence.breakConditions],
    },
  };
}

export function endSilenceInState(
  state: ChatEngineState,
): ChatEngineState {
  if (!state.currentSilence) return state;
  return {
    ...cloneChatEngineState(state),
    currentSilence: undefined,
  };
}

// ============================================================================
// MARK: Authoritative frame apply
// ============================================================================

export function applyAuthoritativeFrameToState(
  state: ChatEngineState,
  patch: AuthoritativeStatePatch,
): ChatEngineState {
  const { frame, activeRoomId, activeSessionId } = patch;

  let next: ChatEngineState = {
    ...cloneChatEngineState(state),
    memberships: activeRoomId ? upsertMemberships(state.memberships, activeRoomId) : state.memberships.map((item) => ({ ...item })),
    connection: activeSessionId
      ? { ...state.connection, sessionId: activeSessionId }
      : { ...state.connection },
  };

  if (frame.messages?.length) {
    if (isVisibleChannelId(frame.channelId)) {
      const messagesByChannel = {
        ...next.messagesByChannel,
        [frame.channelId]: normalizeMessageWindow([
          ...next.messagesByChannel[frame.channelId],
          ...frame.messages,
        ]),
      };

      const notifications = frame.channelId === next.activeVisibleChannel
        ? (() => {
            const unreadByChannel = {
              ...next.notifications.unreadByChannel,
              [frame.channelId]: 0,
            };
            return {
              ...next.notifications,
              unreadByChannel,
              hasAnyUnread: computeHasAnyUnread(unreadByChannel),
              notificationKinds: [...next.notifications.notificationKinds],
            };
          })()
        : {
            ...next.notifications,
            unreadByChannel: { ...next.notifications.unreadByChannel },
            notificationKinds: [...next.notifications.notificationKinds],
          };

      next = {
        ...next,
        messagesByChannel,
        notifications,
      };
    } else {
      next = {
        ...next,
        shadowMessageCountByChannel: {
          ...next.shadowMessageCountByChannel,
          [frame.channelId]: next.shadowMessageCountByChannel[frame.channelId] + frame.messages.length,
        },
      };
    }
  }

  if (frame.scene) {
    next = {
      ...next,
      activeScene: cloneScenePlan(frame.scene),
    };
  }
  if (frame.reveal) {
    next = {
      ...next,
      pendingReveals: [...next.pendingReveals, { ...frame.reveal }].sort(
        (a, b) => a.revealAt - b.revealAt,
      ),
    };
  }
  if (frame.silence) {
    next = {
      ...next,
      currentSilence: {
        ...frame.silence,
        breakConditions: [...frame.silence.breakConditions],
      },
    };
  }

  if (frame.presence?.length) {
    next = upsertPresenceSnapshotsInState(next, frame.presence);
  }

  if (frame.typing?.length) {
    next = upsertTypingSnapshotsInState(next, frame.typing);
  }

  if (frame.notification) {
    next = {
      ...next,
      notifications: {
        ...frame.notification,
        unreadByChannel: { ...frame.notification.unreadByChannel },
        notificationKinds: [...frame.notification.notificationKinds],
      },
    };
  }

  if (frame.learningProfile) {
    next = {
      ...next,
      learningProfile: cloneLearningProfile(frame.learningProfile),
    };
  }

  return {
    ...next,
    lastAuthoritativeSyncAt: frame.syncedAt,
  };
}

// ============================================================================
// MARK: Relationship, learning, social, liveops mutation
// ============================================================================

export function setLearningProfileInState(
  state: ChatEngineState,
  profile?: ChatLearningProfile,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    learningProfile: profile ? cloneLearningProfile(profile) : undefined,
  };
}

export function upsertRelationshipInState(
  state: ChatEngineState,
  relationship: ChatRelationshipState,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    relationshipsByCounterpartId: {
      ...state.relationshipsByCounterpartId,
      [relationship.counterpartId]: {
        ...relationship,
        vector: { ...relationship.vector },
        callbacksAvailable: [...relationship.callbacksAvailable],
      },
    },
  };
}

export function setAudienceHeatInState(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  patch: Partial<ChatAudienceHeat>,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    audienceHeat: {
      ...state.audienceHeat,
      [channelId]: {
        ...state.audienceHeat[channelId],
        ...patch,
        heat: toScore100(Number(patch.heat ?? state.audienceHeat[channelId].heat)),
        hype: toScore100(Number(patch.hype ?? state.audienceHeat[channelId].hype)),
        ridicule: toScore100(Number(patch.ridicule ?? state.audienceHeat[channelId].ridicule)),
        scrutiny: toScore100(Number(patch.scrutiny ?? state.audienceHeat[channelId].scrutiny)),
        volatility: toScore100(Number(patch.volatility ?? state.audienceHeat[channelId].volatility)),
        lastUpdatedAt: patch.lastUpdatedAt ?? nowAsUnixMs(),
      },
    },
  };
}

export function accumulateAudienceHeatInState(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  delta: Partial<Record<'heat' | 'hype' | 'ridicule' | 'scrutiny' | 'volatility', number>>,
  updatedAt: UnixMs = nowAsUnixMs(),
): ChatEngineState {
  const base = state.audienceHeat[channelId];
  return setAudienceHeatInState(state, channelId, {
    heat: toScore100(base.heat + (delta.heat ?? 0)),
    hype: toScore100(base.hype + (delta.hype ?? 0)),
    ridicule: toScore100(base.ridicule + (delta.ridicule ?? 0)),
    scrutiny: toScore100(base.scrutiny + (delta.scrutiny ?? 0)),
    volatility: toScore100(base.volatility + (delta.volatility ?? 0)),
    lastUpdatedAt: updatedAt,
  });
}

export function setChannelMoodInState(
  state: ChatEngineState,
  channelId: ChatChannelId,
  mood: ChatChannelMood['mood'],
  reason: string,
  updatedAt: UnixMs = nowAsUnixMs(),
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    channelMoodByChannel: {
      ...state.channelMoodByChannel,
      [channelId]: {
        channelId,
        mood,
        reason,
        updatedAt,
      },
    },
  };
}

export function setLiveOpsStateInState(
  state: ChatEngineState,
  liveOps: ChatLiveOpsState,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    liveOps: {
      ...liveOps,
      activeWorldEvents: liveOps.activeWorldEvents.map((item) => ({
        ...item,
        affectedChannels: [...item.affectedChannels],
      })),
      suppressedHelperChannels: [...liveOps.suppressedHelperChannels],
      boostedCrowdChannels: [...liveOps.boostedCrowdChannels],
    },
  };
}

export function setAffectInState(
  state: ChatEngineState,
  affect: ChatAffectSnapshot,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    affect: {
      ...affect,
      vector: { ...affect.vector },
    },
  };
}

// ============================================================================
// MARK: Notification helpers
// ============================================================================

function computeHasAnyUnread(
  unreadByChannel: Readonly<Record<ChatVisibleChannel, number>>,
): boolean {
  return Object.values(unreadByChannel).some((count) => count > 0);
}

function normalizeNotificationKinds(
  kinds: readonly ChatNotificationKind[],
): readonly ChatNotificationKind[] {
  return [...new Set(kinds)];
}

function notificationKindFromMessage(message: ChatMessage): ChatNotificationKind {
  switch (message.kind) {
    case 'HELPER_RESCUE':
    case 'HELPER_PROMPT':
      return 'HELPER_RESCUE';
    case 'BOT_ATTACK':
    case 'BOT_TAUNT':
    case 'HATER_TELEGRAPH':
    case 'HATER_PUNISH':
      return 'HATER_ATTACK';
    case 'NEGOTIATION_OFFER':
    case 'NEGOTIATION_COUNTER':
      return 'NEGOTIATION_URGENCY';
    case 'LEGEND_MOMENT':
      return 'LEGEND_MOMENT';
    case 'WORLD_EVENT':
      return 'WORLD_EVENT';
    default:
      return 'UNREAD';
  }
}

// ============================================================================
// MARK: Feature derivation
// ============================================================================

export function deriveFeatureSnapshotFromState(
  state: ChatEngineState,
  inputs: FeatureSnapshotInputs,
): ChatFeatureSnapshot {
  const channel = inputs.activeChannel;
  const visibleMessageCount = isVisibleChannelId(channel)
    ? state.messagesByChannel[channel].length
    : state.shadowMessageCountByChannel[channel];

  const baseNegativeEmotion = Math.max(
    state.affect.vector.frustration,
    state.affect.vector.intimidation,
    state.affect.vector.desperation,
    state.affect.vector.embarrassment,
  );

  const dropOffSignals: ChatDropOffSignals = {
    ...defaultDropOffSignals(),
    ...(inputs.dropOffSignals ?? {}),
    negativeEmotionScore: toScore100(
      inputs.dropOffSignals?.negativeEmotionScore ?? baseNegativeEmotion,
    ),
  };

  return {
    createdAt: inputs.now,
    mountTarget: inputs.currentMountTarget,
    activeChannel: channel,
    panelOpen: inputs.panelOpen,
    unreadCount: countUnread(state),
    composerLength: inputs.composerLength,
    silenceWindowMs: inputs.silenceWindowMs,
    visibleMessageCount,
    pressureTier: inputs.pressureTier,
    tickTier: inputs.tickTier,
    haterHeat: inputs.haterHeat,
    affect: {
      ...state.affect,
      vector: { ...state.affect.vector },
    },
    dropOffSignals,
  };
}

// ============================================================================
// MARK: Cache serialization / hydration
// ============================================================================

export function serializeChatStateForCache(state: ChatEngineState): ChatStateCachePayload {
  return {
    schemaVersion: CHAT_STATE_CACHE_SCHEMA_VERSION,
    persistedAt: Date.now(),
    activeMountTarget: state.activeMountTarget,
    activeVisibleChannel: state.activeVisibleChannel,
    messagesByChannel: {
      GLOBAL: trimMessages(state.messagesByChannel.GLOBAL),
      SYNDICATE: trimMessages(state.messagesByChannel.SYNDICATE),
      DEAL_ROOM: trimMessages(state.messagesByChannel.DEAL_ROOM),
      LOBBY: trimMessages(state.messagesByChannel.LOBBY),
    },
    notifications: {
      ...state.notifications,
      unreadByChannel: { ...state.notifications.unreadByChannel },
      notificationKinds: [...state.notifications.notificationKinds],
    },
    learningProfile: state.learningProfile
      ? cloneLearningProfile(state.learningProfile)
      : undefined,
    continuity: {
      ...state.continuity,
      unresolvedMomentIds: [...state.continuity.unresolvedMomentIds],
      carriedPersonaIds: [...state.continuity.carriedPersonaIds],
    },
  };
}

export function hydrateChatStateFromCache(
  serialized: string,
  bootstrap: ChatStateBootstrapOptions = {},
): ChatEngineState {
  const base = createChatEngineState(bootstrap);

  try {
    const parsed = JSON.parse(serialized) as Partial<ChatStateCachePayload>;
    if (parsed.schemaVersion !== CHAT_STATE_CACHE_SCHEMA_VERSION) return base;

    const activeVisibleChannel = parsed.activeVisibleChannel ?? base.activeVisibleChannel;
    const unreadByChannel = {
      GLOBAL: parsed.notifications?.unreadByChannel?.GLOBAL ?? 0,
      SYNDICATE: parsed.notifications?.unreadByChannel?.SYNDICATE ?? 0,
      DEAL_ROOM: parsed.notifications?.unreadByChannel?.DEAL_ROOM ?? 0,
      LOBBY: parsed.notifications?.unreadByChannel?.LOBBY ?? 0,
    };

    return {
      ...cloneChatEngineState(base),
      activeMountTarget: parsed.activeMountTarget ?? base.activeMountTarget,
      activeVisibleChannel,
      composer: {
        ...base.composer,
        draftByChannel: { ...base.composer.draftByChannel },
        activeChannel: activeVisibleChannel,
      },
      messagesByChannel: parsed.messagesByChannel
        ? {
            GLOBAL: normalizeMessageWindow(parsed.messagesByChannel.GLOBAL ?? []),
            SYNDICATE: normalizeMessageWindow(parsed.messagesByChannel.SYNDICATE ?? []),
            DEAL_ROOM: normalizeMessageWindow(parsed.messagesByChannel.DEAL_ROOM ?? []),
            LOBBY: normalizeMessageWindow(parsed.messagesByChannel.LOBBY ?? []),
          }
        : base.messagesByChannel,
      notifications: parsed.notifications
        ? {
            ...createDefaultNotificationState(),
            ...parsed.notifications,
            unreadByChannel,
            notificationKinds: [...(parsed.notifications.notificationKinds ?? [])],
            hasAnyUnread: computeHasAnyUnread(unreadByChannel),
          }
        : { ...base.notifications, unreadByChannel: { ...base.notifications.unreadByChannel }, notificationKinds: [...base.notifications.notificationKinds] },
      learningProfile: parsed.learningProfile ? cloneLearningProfile(parsed.learningProfile) : base.learningProfile,
      continuity: parsed.continuity
        ? {
            ...base.continuity,
            ...parsed.continuity,
            unresolvedMomentIds: [...(parsed.continuity.unresolvedMomentIds ?? [])],
            carriedPersonaIds: [...(parsed.continuity.carriedPersonaIds ?? [])],
          }
        : {
            ...base.continuity,
            unresolvedMomentIds: [...base.continuity.unresolvedMomentIds],
            carriedPersonaIds: [...base.continuity.carriedPersonaIds],
          },
    };
  } catch {
    return base;
  }
}

// ============================================================================
// MARK: Maintenance / trimming / counters
// ============================================================================

export function trimChatStateWindow(
  state: ChatEngineState,
  visibleLimit = MAX_VISIBLE_WINDOW,
): ChatEngineState {
  return {
    ...cloneChatEngineState(state),
    messagesByChannel: {
      GLOBAL: trimMessages(state.messagesByChannel.GLOBAL, visibleLimit),
      SYNDICATE: trimMessages(state.messagesByChannel.SYNDICATE, visibleLimit),
      DEAL_ROOM: trimMessages(state.messagesByChannel.DEAL_ROOM, visibleLimit),
      LOBBY: trimMessages(state.messagesByChannel.LOBBY, visibleLimit),
    },
  };
}

export function countUnread(state: ChatEngineState): number {
  return Object.values(state.notifications.unreadByChannel).reduce(
    (acc, value) => acc + value,
    0,
  );
}

export function countVisibleMessages(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): number {
  return state.messagesByChannel[channelId].length;
}

export function getMessagesForVisibleChannel(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): readonly ChatMessage[] {
  return state.messagesByChannel[channelId];
}

export function getActiveVisibleMessages(
  state: ChatEngineState,
): readonly ChatMessage[] {
  return state.messagesByChannel[state.activeVisibleChannel];
}

export function getLatestVisibleMessage(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): Nullable<ChatMessage> {
  const list = state.messagesByChannel[channelId];
  return list.length ? list[list.length - 1] : null;
}

export function buildLegacyGameChatContext(
  input: {
    readonly tick: number;
    readonly cash: number;
    readonly regime: string;
    readonly events: readonly string[];
    readonly netWorth: number;
    readonly income: number;
    readonly expenses: number;
    readonly pressureTier?: PressureTier;
    readonly tickTier?: TickTier;
    readonly haterHeat?: number;
  },
): LegacyGameChatContext {
  return {
    tick: input.tick,
    cash: input.cash,
    regime: input.regime,
    events: [...input.events],
    netWorth: input.netWorth,
    income: input.income,
    expenses: input.expenses,
    pressureTier: input.pressureTier,
    tickTier: input.tickTier,
    haterHeat: input.haterHeat,
  };
}

// ============================================================================
// MARK: Simple state predicates
// ============================================================================

export function isVisibleChannelId(channelId: ChatChannelId): channelId is ChatVisibleChannel {
  return (CHAT_VISIBLE_CHANNELS as readonly string[]).includes(channelId);
}

export function isShadowChannelId(channelId: ChatChannelId): channelId is ChatShadowChannel {
  return (CHAT_SHADOW_CHANNELS as readonly string[]).includes(channelId);
}

export function isDealRoomChannel(channelId: ChatChannelId): channelId is 'DEAL_ROOM' {
  return channelId === 'DEAL_ROOM';
}

export function canSendInVisibleChannel(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): boolean {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];
  if (!descriptor.supportsComposer) return false;
  if (state.composer.disabled) return false;
  return true;
}

// ============================================================================
// MARK: Message build helpers for ChatEngine
// ============================================================================

export function buildLocalSystemMessage(input: {
  readonly id: ChatMessageId;
  readonly channel: ChatVisibleChannel;
  readonly kind: ChatMessage['kind'];
  readonly body: string;
  readonly at: UnixMs;
  readonly emoji?: string;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly proofHash?: string;
  readonly legend?: ChatLegendMeta;
  readonly replay?: ChatReplayMeta;
  readonly moderation?: ChatModerationDecision;
  readonly tags?: readonly string[];
}): ChatMessage {
  return {
    id: input.id,
    channel: input.channel,
    kind: input.kind,
    senderId: 'SYSTEM',
    senderName: 'SYSTEM',
    body: input.body,
    emoji: input.emoji,
    ts: input.at,
    pressureTier: input.pressureTier,
    tickTier: input.tickTier,
    proofHash: input.proofHash,
    legend: input.legend ? { ...input.legend } : undefined,
    replay: input.replay ? { ...input.replay } : undefined,
    deliveryState: 'AUTHORITATIVE',
    moderation: input.moderation
      ? { ...input.moderation }
      : {
          state: 'ALLOWED',
          playerVisible: true,
        },
    tags: input.tags ? [...input.tags] : undefined,
  };
}

export function mergeReadReceiptIntoMessage(
  message: ChatMessage,
  receipt: ChatReadReceipt,
): ChatMessage {
  const receipts = mergeReadReceipts(message.readReceipts, [receipt]) ?? [];
  return {
    ...message,
    readReceipts: receipts,
  };
}

// ============================================================================
// MARK: End
// ============================================================================
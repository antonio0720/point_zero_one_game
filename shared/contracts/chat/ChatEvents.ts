/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT EVENT CONTRACTS
 * FILE: shared/contracts/chat/ChatEvents.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical event grammar for transport, frontend engine coordination, backend
 * authority, replay, proof, rescue, negotiation, liveops, and upstream game
 * signals consumed by the unified chat system.
 *
 * This merged version intentionally takes the strongest parts from both prior
 * drafts:
 *   1. the richer runtime state and authoritative frame semantics,
 *   2. the stronger socket protocol and transport payload catalog,
 *   3. the clearer backend authoritative event map,
 *   4. a single event package that downstream lanes can import safely.
 *
 * Design doctrine
 * ---------------
 * 1. Shared event contracts are wire-safe and runtime-safe.
 * 2. Frontend optimism may stage events; backend authority decides truth.
 * 3. Server transport is a servant and never owns simulation truth.
 * 4. Message mutation never travels as ad hoc unknown objects.
 * 5. Replay, moderation, proof, rescue, legend, negotiation, and liveops all
 *    participate in one event grammar.
 * 6. Upstream signals remain distinct from transport frames and engine events.
 *
 * Canonical authority roots
 * -------------------------
 * - /shared/contracts/chat
 * - /pzo-web/src/engines/chat
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  Brand,
  ChatActorKind,
  ChatChannelId,
  ChatCursorId,
  ChatInterventionId,
  ChatLegendId,
  ChatMemoryAnchorId,
  ChatMessageId,
  ChatMomentId,
  ChatModeScope,
  ChatMountTarget,
  ChatNpcId,
  ChatOfferId,
  ChatPresenceKind,
  ChatProofHash,
  ChatRecipientRole,
  ChatRelationshipId,
  ChatReplayId,
  ChatRequestId,
  ChatRoomId,
  ChatSceneId,
  ChatSessionId,
  ChatShadowChannel,
  ChatTelemetryId,
  ChatTypingKind,
  ChatTypingToken,
  ChatUserId,
  ChatVector3,
  ChatVisibleChannel,
  ChatWorldEventId,
  JsonObject,
  JsonValue,
  Score01,
  Score100,
  TickNumber,
  UnixMs,
  ChatRange,
} from './ChatChannels';
import {
  CHAT_ALL_CHANNELS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_MOUNT_TARGETS,
  CHAT_MODE_SCOPES,
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
  isChatChannelId,
  isChatMountTarget,
  isChatModeScope,
  isChatShadowChannel,
  isChatVisibleChannel,
} from './ChatChannels';

// ============================================================================
// MARK: Branded identifiers specific to eventing and transport
// ============================================================================

export type ChatEnvelopeId = Brand<string, 'ChatEnvelopeId'>;
export type ChatSequenceNumber = Brand<number, 'ChatSequenceNumber'>;
export type ChatCausalEdgeId = Brand<string, 'ChatCausalEdgeId'>;
export type ChatWireCorrelationId = Brand<string, 'ChatWireCorrelationId'>;
export type ChatWireTraceId = Brand<string, 'ChatWireTraceId'>;
export type ChatFeatureVectorId = Brand<string, 'ChatFeatureVectorId'>;
export type ChatDatasetRowId = Brand<string, 'ChatDatasetRowId'>;
export type ChatPolicyRunId = Brand<string, 'ChatPolicyRunId'>;
export type ChatLabelId = Brand<string, 'ChatLabelId'>;
export type ChatNegotiationThreadId = Brand<string, 'ChatNegotiationThreadId'>;

// ============================================================================
// MARK: Cross-engine vocab used by chat orchestration
// ============================================================================

export const CHAT_PRESSURE_TIERS = [
  'CALM',
  'WATCHFUL',
  'PRESSURED',
  'CRITICAL',
  'BREAKPOINT',
] as const;

export type ChatPressureTier = (typeof CHAT_PRESSURE_TIERS)[number];

export const CHAT_TICK_TIERS = ['EARLY', 'MID', 'LATE', 'SUDDEN_DEATH'] as const;
export type ChatTickTier = (typeof CHAT_TICK_TIERS)[number];

export const CHAT_RUN_OUTCOMES = [
  'UNSETTLED',
  'VICTORY',
  'LOSS',
  'BANKRUPTCY',
  'SOVEREIGNTY',
  'TIMEOUT',
] as const;

export type ChatRunOutcome = (typeof CHAT_RUN_OUTCOMES)[number];

export const CHAT_ATTACK_TYPES = [
  'TAUNT',
  'TELEGRAPH',
  'SABOTAGE',
  'LIQUIDITY_STRIKE',
  'PRESSURE_SPIKE',
  'SHIELD_BREAK',
  'CASCADE_PUSH',
  'NEGOTIATION_TRAP',
] as const;

export type ChatAttackType = (typeof CHAT_ATTACK_TYPES)[number];

export const CHAT_CASCADE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ChatCascadeSeverity = (typeof CHAT_CASCADE_SEVERITIES)[number];

export const CHAT_SHIELD_LAYER_IDS = ['L1', 'L2', 'L3', 'L4', 'L5'] as const;
export type ChatShieldLayerId = (typeof CHAT_SHIELD_LAYER_IDS)[number];

export const CHAT_AUTHORITIES = [
  'CLIENT_STAGED',
  'SERVER_ACCEPTED',
  'BACKEND_AUTHORITATIVE',
  'BACKEND_LEDGER',
] as const;

export type ChatAuthority = (typeof CHAT_AUTHORITIES)[number];

// ============================================================================
// MARK: Sender, actor, and identity subcontracts
// ============================================================================

export const CHAT_SENDER_ROLES = [
  'SELF',
  'OTHER_PLAYER',
  'ALLY',
  'RIVAL',
  'HELPER_GUIDE',
  'HATER_BOT',
  'AMBIENT_WATCHER',
  'CROWD_VOICE',
  'DEAL_BROKER',
  'SYSTEM_NOTICE',
  'SYSTEM_PROOF',
  'LIVEOPS_OPERATOR',
] as const;

export type ChatSenderRole = (typeof CHAT_SENDER_ROLES)[number];

export interface ChatSenderIdentity {
  readonly actorKind: ChatActorKind;
  readonly senderRole: ChatSenderRole;
  readonly senderId: string;
  readonly senderName: string;
  readonly senderHandle?: string;
  readonly senderRank?: string;
  readonly isHuman: boolean;
  readonly isNpc: boolean;
  readonly isVerifiedSystemVoice: boolean;
  readonly syndicateId?: string;
  readonly botId?: string;
  readonly npcId?: ChatNpcId;
  readonly avatarUrl?: string;
  readonly accentColorToken?: string;
}

export interface ChatActorLocator {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly sessionId?: ChatSessionId;
  readonly roomId?: ChatRoomId;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
}

// ============================================================================
// MARK: Message kinds, moderation, and notification kinds
// ============================================================================

export const CHAT_MESSAGE_KINDS = [
  'PLAYER',
  'SYSTEM',
  'MARKET_ALERT',
  'ACHIEVEMENT',
  'BOT_TAUNT',
  'BOT_ATTACK',
  'SHIELD_EVENT',
  'CASCADE_ALERT',
  'DEAL_RECAP',
  'NPC_AMBIENT',
  'HELPER_PROMPT',
  'HELPER_RESCUE',
  'HATER_TELEGRAPH',
  'HATER_PUNISH',
  'CROWD_REACTION',
  'RELATIONSHIP_CALLBACK',
  'QUOTE_CALLBACK',
  'NEGOTIATION_OFFER',
  'NEGOTIATION_COUNTER',
  'LEGEND_MOMENT',
  'POST_RUN_RITUAL',
  'WORLD_EVENT',
  'SYSTEM_SHADOW_MARKER',
] as const;

export type ChatMessageKind = (typeof CHAT_MESSAGE_KINDS)[number];
export type MessageKind = ChatMessageKind;

export const CHAT_DELIVERY_STATES = [
  'LOCAL_ONLY',
  'QUEUED',
  'SENT',
  'ACKNOWLEDGED',
  'AUTHORITATIVE',
  'DROPPED',
  'FAILED',
] as const;

export type ChatDeliveryState = (typeof CHAT_DELIVERY_STATES)[number];

export const CHAT_MODERATION_STATES = [
  'PENDING',
  'ALLOWED',
  'BLOCKED',
  'REDACTED',
  'SHADOW_SUPPRESSED',
  'RATE_LIMITED',
] as const;

export type ChatModerationState = (typeof CHAT_MODERATION_STATES)[number];

export type ChatModerationReasonCode =
  | 'TOXICITY'
  | 'SPAM'
  | 'RATE_LIMIT'
  | 'POLICY_BLOCK'
  | 'HIDDEN_SHADOW'
  | 'EMPTY'
  | 'INVALID_CHANNEL'
  | 'INVALID_ROOM'
  | 'INVALID_SESSION';

export const CHAT_NOTIFICATION_KINDS = [
  'UNREAD',
  'MENTION',
  'DIRECT_PRESSURE',
  'NEGOTIATION_URGENCY',
  'HELPER_RESCUE',
  'HATER_ATTACK',
  'LEGEND_MOMENT',
  'WORLD_EVENT',
] as const;

export type ChatNotificationKind = (typeof CHAT_NOTIFICATION_KINDS)[number];

export interface ChatModerationDecision {
  readonly state: ChatModerationState;
  readonly reasonCode?: ChatModerationReasonCode;
  readonly displayText?: string;
  readonly playerVisible: boolean;
}

export interface ChatModerationWire {
  readonly state: ChatModerationState;
  readonly reasonCode?: ChatModerationReasonCode;
  readonly displayText?: string;
  readonly playerVisible: boolean;
}

export interface ChatNotificationState {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly kind: ChatNotificationKind;
  readonly unreadCount: number;
  readonly updatedAt: UnixMs;
  readonly sourceMessageId?: ChatMessageId;
}

// ============================================================================
// MARK: Presence, typing, cursor, and read-receipt state
// ============================================================================

export const CHAT_PRESENCE_STATES = [
  'OFFLINE',
  'ONLINE',
  'ACTIVE',
  'LURKING',
  'WATCHING',
  'READING',
  'THINKING',
] as const;

export type ChatPresenceState = (typeof CHAT_PRESENCE_STATES)[number];

export const CHAT_TYPING_STATES = [
  'NOT_TYPING',
  'STARTED',
  'PAUSED',
  'STOPPED',
  'SIMULATED',
] as const;

export type ChatTypingState = (typeof CHAT_TYPING_STATES)[number];

export interface ChatPresenceSnapshot {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly presence: ChatPresenceState;
  readonly updatedAt: UnixMs;
  readonly isVisibleToPlayer: boolean;
  readonly latencyMs?: number;
}

export interface ChatTypingSnapshot {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly typingState: ChatTypingState;
  readonly startedAt?: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly token?: ChatTypingToken;
  readonly simulatedByPersona?: string;
}

export interface ChatCursorSnapshot {
  readonly cursorId: ChatCursorId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatVisibleChannel;
  readonly roomId: ChatRoomId;
  readonly updatedAt: UnixMs;
  readonly caretIndex?: number;
  readonly selection?: ChatRange;
  readonly composerLength?: number;
  readonly draftPreview?: string;
}

export interface ChatReadReceipt {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly messageId: ChatMessageId;
  readonly readAt: UnixMs;
  readonly delayedByPolicy: boolean;
  readonly delayReason?: 'PRESENCE_THEATER' | 'NEGOTIATION_PRESSURE' | 'NPC_LATENCY';
}

// ============================================================================
// MARK: Proof, replay, legend, and message meta
// ============================================================================

export interface ChatProofMeta {
  readonly proofHash?: ChatProofHash;
  readonly proofSequence?: number;
  readonly proofChainPosition?: number;
  readonly transcriptNonce?: string;
  readonly runId?: string;
  readonly immutable?: boolean;
  readonly authority: 'LOCAL' | 'SERVER' | 'BACKEND_LEDGER';
}

export interface ChatProofWire {
  readonly proofHash?: ChatProofHash;
  readonly proofTier?: 'LOCAL' | 'ENGINE' | 'AUTHORITATIVE' | 'VERIFIED';
  readonly causalParentMessageId?: string;
  readonly sourceEventName?: string;
}

export interface ChatReplayMeta {
  readonly replayId?: ChatReplayId;
  readonly replayAnchorIndex?: number;
  readonly replayEligible: boolean;
  readonly legendEligible: boolean;
  readonly worldEventEligible: boolean;
}

export interface ChatLegendMeta {
  readonly legendId?: ChatLegendId;
  readonly legendClass?:
    | 'COMEBACK'
    | 'COUNTERPLAY'
    | 'MIRACLE_SAVE'
    | 'HUMILIATION'
    | 'SOVEREIGNTY'
    | 'WITNESS_LINE';
  readonly title?: string;
  readonly prestigeScore?: number;
  readonly unlocksReward?: boolean;
}

export interface ChatLegendWire {
  readonly legendId?: ChatLegendId;
  readonly legendClass?:
    | 'SOVEREIGNTY'
    | 'COUNTERPLAY'
    | 'HUMILIATION_REVERSAL'
    | 'RESCUE'
    | 'COMEBACK';
  readonly rewardKeys?: readonly string[];
}

export interface ChatAuditMeta {
  readonly stagedAt?: UnixMs;
  readonly authoritativeAt?: UnixMs;
  readonly requestId?: ChatRequestId;
  readonly moderationAppliedAt?: UnixMs;
  readonly replayIndexedAt?: UnixMs;
  readonly originAuthority: ChatAuthority;
}

export interface ShieldEventMeta {
  readonly layerId?: ChatShieldLayerId;
  readonly integrityAfter?: number;
  readonly shieldDelta?: number;
  readonly shieldLabel?: string;
}

export interface CascadeAlertMeta {
  readonly chainId?: string;
  readonly severity?: ChatCascadeSeverity;
  readonly recovered?: boolean;
}

export interface BotTauntSource {
  readonly botId?: string;
  readonly attackType?: ChatAttackType;
  readonly personaId?: string;
  readonly escalationTier?: number;
}

export interface ChatMessageMeta {
  readonly requestId?: ChatRequestId;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly replyToMessageId?: ChatMessageId;
  readonly relationCallbackTargetId?: ChatMessageId;
  readonly memoryAnchorIds?: readonly ChatMemoryAnchorId[];
  readonly debug?: JsonObject;
}

export interface ChatMessageMetaWire {
  readonly pressureTier?: string;
  readonly tickTier?: string;
  readonly runOutcome?: string;
  readonly botId?: string;
  readonly attackType?: string;
  readonly targetLayerId?: string;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly relationshipIds?: readonly ChatRelationshipId[];
  readonly memoryAnchorIds?: readonly ChatMemoryAnchorId[];
  readonly tags?: readonly string[];
  readonly attributes?: JsonObject;
}

// ============================================================================
// MARK: Memory, relationship, affect, and continuity state
// ============================================================================

export interface ChatRelationshipState {
  readonly relationshipId: ChatRelationshipId;
  readonly counterpartId: string;
  readonly counterpartKind: ChatActorKind;
  readonly respect: Score100;
  readonly fear: Score100;
  readonly contempt: Score100;
  readonly fascination: Score100;
  readonly trust: Score100;
  readonly familiarity: Score100;
  readonly rivalryIntensity: Score100;
  readonly rescueDebt: Score100;
  readonly updatedAt: UnixMs;
}

export interface ChatMemoryAnchor {
  readonly anchorId: ChatMemoryAnchorId;
  readonly createdAt: UnixMs;
  readonly messageId?: ChatMessageId;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly salienceScore: Score100;
  readonly summary: string;
  readonly retrievalTags: readonly string[];
}

export interface ChatOfferState {
  readonly offerId: ChatOfferId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly proposerId: string;
  readonly offereeId?: string;
  readonly valueSummary: string;
  readonly pressureScore: Score100;
  readonly rejected: boolean;
  readonly expired: boolean;
  readonly createdAt: UnixMs;
  readonly expiresAt?: UnixMs;
}

export interface ChatNegotiationState {
  readonly activeOfferId?: ChatOfferId;
  readonly stance: 'PROBING' | 'PUSHING' | 'STALLING' | 'CLOSING' | 'FOLDING';
  readonly lastCounterAt?: UnixMs;
  readonly readPressureActive: boolean;
  readonly inferredOpponentUrgency: Score100;
  readonly inferredOpponentConfidence: Score100;
}

export interface ChatContinuityState {
  readonly carryoverSceneId?: ChatSceneId;
  readonly previousMountTarget?: ChatMountTarget;
  readonly currentMountTarget?: ChatMountTarget;
  readonly lastModeScope?: ChatModeScope;
  readonly unresolvedCounterpartIds: readonly string[];
  readonly continuityVersion: string;
}

export interface ChatAudienceHeat {
  readonly channelId: ChatVisibleChannel;
  readonly heatScore: Score100;
  readonly crowdVelocity: number;
  readonly humiliationPressure: Score100;
  readonly hypePressure: Score100;
  readonly updatedAt: UnixMs;
}

export interface ChatChannelMood {
  readonly channelId: ChatChannelId;
  readonly mood:
    | 'CALM'
    | 'WATCHFUL'
    | 'HOSTILE'
    | 'PREDATORY'
    | 'CEREMONIAL'
    | 'CONSPIRATORIAL';
  readonly updatedAt: UnixMs;
}

export interface ChatReputationState {
  readonly publicReputation: Score100;
  readonly privateTrust: Score100;
  readonly negotiationRespect: Score100;
  readonly rescueNeediness: Score100;
  readonly updatedAt: UnixMs;
}

export interface ChatAffectSnapshot {
  readonly intimidation: Score100;
  readonly confidence: Score100;
  readonly frustration: Score100;
  readonly curiosity: Score100;
  readonly attachment: Score100;
  readonly socialEmbarrassment: Score100;
  readonly relief: Score100;
  readonly dominance: Score100;
  readonly desperation: Score100;
  readonly trust: Score100;
  readonly updatedAt: UnixMs;
}

export interface ChatLearningProfile {
  readonly profileVersion: string;
  readonly playerId?: ChatUserId;
  readonly engagementBaseline: Score100;
  readonly haterSusceptibility: Score100;
  readonly helperReceptivity: Score100;
  readonly channelAffinity: Readonly<Record<ChatVisibleChannel, Score100>>;
  readonly rescueHistoryCount: number;
  readonly updatedAt: UnixMs;
}

export interface ChatFeatureSnapshot {
  readonly featureVectorId?: ChatFeatureVectorId;
  readonly requestId?: ChatRequestId;
  readonly emittedAt: UnixMs;
  readonly pressureTier?: ChatPressureTier;
  readonly tickTier?: ChatTickTier;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
  readonly composerLength?: number;
  readonly recentlyCollapsed?: boolean;
  readonly frustrationScore?: Score100;
  readonly embarrassmentScore?: Score100;
  readonly confidenceScore?: Score100;
  readonly churnRisk?: Score01;
  readonly tags?: readonly string[];
}

export interface ChatRescueDecision {
  readonly interventionId: ChatInterventionId;
  readonly triggerAt: UnixMs;
  readonly style: 'BLUNT' | 'CALM' | 'DIRECTIVE' | 'QUIET';
  readonly reason:
    | 'LONG_SILENCE'
    | 'FAILED_ACTION_CHAIN'
    | 'SENTIMENT_DROP'
    | 'PANEL_FLAPPING'
    | 'CHANNEL_HOPPING';
  readonly suggestedAction?: string;
}

export interface ChatLiveOpsState {
  readonly worldEventId?: ChatWorldEventId;
  readonly title?: string;
  readonly summary?: string;
  readonly active: boolean;
  readonly multiplier?: number;
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: Drama, reveal, silence, and scene contracts
// ============================================================================

export const CHAT_MOMENT_TYPES = [
  'RUN_START',
  'RUN_END',
  'PRESSURE_SPIKE',
  'SHIELD_BREAK',
  'COMEBACK',
  'DEAL_TENSION',
  'HATER_SWARM',
  'HELPER_RESCUE',
  'SOVEREIGNTY_NEAR',
  'SOVEREIGNTY_ACHIEVED',
  'WORLD_EVENT',
  'POST_RUN',
] as const;

export type ChatMomentType = (typeof CHAT_MOMENT_TYPES)[number];

export interface ChatScenePlan {
  readonly sceneId: ChatSceneId;
  readonly momentId: ChatMomentId;
  readonly momentType: ChatMomentType;
  readonly primaryChannel: ChatChannelId;
  readonly openedAt: UnixMs;
  readonly scriptSeed: string;
  readonly stageMood: string;
  readonly actorOrder: readonly string[];
}

export interface ChatRevealSchedule {
  readonly sceneId?: ChatSceneId;
  readonly revealAt: UnixMs;
  readonly revealKey: string;
  readonly channelId: ChatChannelId;
  readonly targetMessageId?: ChatMessageId;
}

export interface ChatSilenceDecision {
  readonly reason:
    | 'TENSION_BUILD'
    | 'POST_COLLAPSE_PAUSE'
    | 'NEGOTIATION_WAIT'
    | 'PRESENCE_THEATER';
  readonly startedAt: UnixMs;
  readonly expectedEndAt?: UnixMs;
  readonly channelId: ChatChannelId;
}

// ============================================================================
// MARK: Canonical message contracts
// ============================================================================

export interface ChatMessage {
  readonly messageId: ChatMessageId;
  readonly clientMessageId?: string;
  readonly requestId?: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly kind: ChatMessageKind;
  readonly sender: ChatSenderIdentity;
  readonly body: string;
  readonly occurredAt: UnixMs;
  readonly stagedAt?: UnixMs;
  readonly deliveryState: ChatDeliveryState;
  readonly moderation?: ChatModerationDecision;
  readonly proof?: ChatProofMeta;
  readonly replay?: ChatReplayMeta;
  readonly legend?: ChatLegendMeta;
  readonly audit?: ChatAuditMeta;
  readonly shield?: ShieldEventMeta;
  readonly cascade?: CascadeAlertMeta;
  readonly tauntSource?: BotTauntSource;
  readonly meta?: ChatMessageMeta;
}

export interface ChatSenderWire {
  readonly actorKind: ChatActorKind;
  readonly senderRole: ChatSenderRole;
  readonly senderId: string;
  readonly senderName: string;
  readonly senderHandle?: string;
  readonly senderRank?: string;
  readonly isHuman: boolean;
  readonly isNpc: boolean;
  readonly isVerifiedSystemVoice: boolean;
  readonly botId?: string;
  readonly npcId?: ChatNpcId;
}

export interface ChatMessageWire {
  readonly messageId: ChatMessageId | string;
  readonly clientMessageId?: string;
  readonly requestId?: ChatRequestId;
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatChannelId;
  readonly kind: ChatMessageKind;
  readonly sender: ChatSenderWire;
  readonly body: string;
  readonly occurredAt: UnixMs;
  readonly deliveryState?: ChatDeliveryState;
  readonly moderation?: ChatModerationWire;
  readonly proof?: ChatProofWire;
  readonly legend?: ChatLegendWire;
  readonly meta?: ChatMessageMetaWire;
}

export interface ChatStateSnapshot {
  readonly roomId: ChatRoomId;
  readonly activeChannel: ChatVisibleChannel;
  readonly transcriptByChannel: Readonly<Record<ChatChannelId, readonly ChatMessage[]>>;
  readonly scene?: ChatScenePlan;
  readonly pendingReveals: readonly ChatRevealSchedule[];
  readonly currentSilence?: ChatSilenceDecision;
  readonly audienceHeat: Readonly<Record<ChatVisibleChannel, ChatAudienceHeat>>;
  readonly channelMoodByChannel: Readonly<Record<ChatChannelId, ChatChannelMood>>;
  readonly reputation: ChatReputationState;
  readonly affect: ChatAffectSnapshot;
  readonly liveOps: ChatLiveOpsState;
  readonly relationshipsByCounterpartId: Readonly<Record<string, ChatRelationshipState>>;
  readonly offerState?: ChatNegotiationState;
  readonly learningProfile?: ChatLearningProfile;
  readonly continuity: ChatContinuityState;
  readonly lastAuthoritativeSyncAt?: UnixMs;
}

// ============================================================================
// MARK: Frontend client requests and authoritative frames
// ============================================================================

export interface ChatClientSendMessageRequest {
  readonly requestId: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly body: string;
  readonly clientSentAt: UnixMs;
  readonly featureSnapshot?: ChatFeatureSnapshot;
}

export interface ChatClientTypingRequest {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly typingState: ChatTypingState;
  readonly token?: ChatTypingToken;
  readonly sentAt: UnixMs;
}

export interface ChatClientPresenceRequest {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly presence: ChatPresenceState;
  readonly sentAt: UnixMs;
}

export interface ChatClientCursorRequest {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly caretIndex?: number;
  readonly selection?: ChatRange;
  readonly composerLength?: number;
  readonly draftPreview?: string;
  readonly sentAt: UnixMs;
}

export interface ChatAuthoritativeFrame {
  readonly requestId?: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messages?: readonly ChatMessage[];
  readonly scene?: ChatScenePlan;
  readonly reveal?: ChatRevealSchedule;
  readonly silence?: ChatSilenceDecision;
  readonly presence?: readonly ChatPresenceSnapshot[];
  readonly typing?: readonly ChatTypingSnapshot[];
  readonly notification?: ChatNotificationState;
  readonly learningProfile?: ChatLearningProfile;
  readonly syncedAt: UnixMs;
}

export interface ChatReplayWindowRequest {
  readonly replayId?: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly range?: ChatRange;
  readonly anchorMessageId?: ChatMessageId;
  readonly includeShadowCompanions: boolean;
}

export interface ChatReplayWindowSnapshot {
  readonly replayId: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messages: readonly ChatMessage[];
  readonly range?: ChatRange;
  readonly generatedAt: UnixMs;
}

export interface ChatReplayExcerptWire {
  readonly replayId: ChatReplayId | string;
  readonly roomId: ChatRoomId | string;
  readonly anchorMessageId?: string;
  readonly messageIds: readonly string[];
  readonly messages: readonly ChatMessageWire[];
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
}

// ============================================================================
// MARK: Frontend engine event names and payload map
// ============================================================================

export const CHAT_ENGINE_EVENT_NAMES = [
  'CHAT_ENGINE_BOOTSTRAPPED',
  'CHAT_ENGINE_CONNECTED',
  'CHAT_ENGINE_DISCONNECTED',
  'CHAT_CHANNEL_CHANGED',
  'CHAT_MESSAGE_STAGED',
  'CHAT_MESSAGE_CONFIRMED',
  'CHAT_MESSAGE_REJECTED',
  'CHAT_MESSAGE_RECEIVED',
  'CHAT_SCENE_STARTED',
  'CHAT_SCENE_COMPLETED',
  'CHAT_REVEAL_SCHEDULED',
  'CHAT_REVEAL_FIRED',
  'CHAT_SILENCE_STARTED',
  'CHAT_SILENCE_ENDED',
  'CHAT_RESCUE_TRIGGERED',
  'CHAT_NEGOTIATION_UPDATED',
  'CHAT_WORLD_EVENT_UPDATED',
  'CHAT_PROFILE_UPDATED',
] as const;

export type ChatEngineEventName = (typeof CHAT_ENGINE_EVENT_NAMES)[number];

export interface ChatEngineEventPayloadMap {
  CHAT_ENGINE_BOOTSTRAPPED: {
    readonly version: string;
    readonly mountTarget: ChatMountTarget;
    readonly at: UnixMs;
  };
  CHAT_ENGINE_CONNECTED: {
    readonly sessionId: ChatSessionId | string;
    readonly at: UnixMs;
  };
  CHAT_ENGINE_DISCONNECTED: {
    readonly reason?: string;
    readonly at: UnixMs;
  };
  CHAT_CHANNEL_CHANGED: {
    readonly from: ChatVisibleChannel;
    readonly to: ChatVisibleChannel;
    readonly at: UnixMs;
  };
  CHAT_MESSAGE_STAGED: {
    readonly message: ChatMessage;
  };
  CHAT_MESSAGE_CONFIRMED: {
    readonly messageId: ChatMessageId | string;
    readonly authoritativeFrame?: ChatAuthoritativeFrame;
  };
  CHAT_MESSAGE_REJECTED: {
    readonly requestId?: ChatRequestId | string;
    readonly reason: string;
  };
  CHAT_MESSAGE_RECEIVED: {
    readonly message: ChatMessage;
  };
  CHAT_SCENE_STARTED: {
    readonly scene: ChatScenePlan;
  };
  CHAT_SCENE_COMPLETED: {
    readonly sceneId: ChatSceneId | string;
    readonly completedAt: UnixMs;
  };
  CHAT_REVEAL_SCHEDULED: {
    readonly reveal: ChatRevealSchedule;
  };
  CHAT_REVEAL_FIRED: {
    readonly reveal: ChatRevealSchedule;
  };
  CHAT_SILENCE_STARTED: {
    readonly silence: ChatSilenceDecision;
  };
  CHAT_SILENCE_ENDED: {
    readonly channelId: ChatChannelId;
    readonly endedAt: UnixMs;
  };
  CHAT_RESCUE_TRIGGERED: {
    readonly interventionId: ChatInterventionId | string;
    readonly channelId: ChatChannelId;
    readonly at: UnixMs;
  };
  CHAT_NEGOTIATION_UPDATED: {
    readonly offerId?: ChatOfferId | string;
    readonly channelId: ChatChannelId;
    readonly at: UnixMs;
  };
  CHAT_WORLD_EVENT_UPDATED: {
    readonly worldEventId: ChatWorldEventId | string;
    readonly at: UnixMs;
  };
  CHAT_PROFILE_UPDATED: {
    readonly playerId?: ChatUserId | string;
    readonly at: UnixMs;
  };
}

export type ChatEngineEventEnvelope<
  TName extends ChatEngineEventName = ChatEngineEventName,
> = {
  readonly eventName: TName;
  readonly payload: ChatEngineEventPayloadMap[TName];
};

// ============================================================================
// MARK: Backend authoritative event names and payload map
// ============================================================================

export const CHAT_AUTHORITATIVE_EVENT_NAMES = [
  'CHAT_SESSION_ADMITTED',
  'CHAT_SESSION_REJECTED',
  'CHAT_ROOM_JOINED',
  'CHAT_ROOM_LEFT',
  'CHAT_CHANNEL_POLICY_EVALUATED',
  'CHAT_MESSAGE_ACCEPTED',
  'CHAT_MESSAGE_SUPPRESSED',
  'CHAT_MESSAGE_REDACTED',
  'CHAT_TRANSCRIPT_APPENDED',
  'CHAT_TRANSCRIPT_SOFT_DELETED',
  'CHAT_PROOF_EDGE_RECORDED',
  'CHAT_REPLAY_INDEXED',
  'CHAT_INFERENCE_COMPLETED',
  'CHAT_FEATURE_SNAPSHOT_WRITTEN',
  'CHAT_PROFILE_PERSISTED',
  'CHAT_INVASION_STATE_CHANGED',
  'CHAT_NEGOTIATION_STATE_CHANGED',
  'CHAT_WORLD_EVENT_STATE_CHANGED',
] as const;

export type ChatAuthoritativeEventName =
  (typeof CHAT_AUTHORITATIVE_EVENT_NAMES)[number];

export interface ChatAuthoritativeEventPayloadMap {
  CHAT_SESSION_ADMITTED: {
    readonly sessionId: ChatSessionId | string;
    readonly roomIds: readonly (ChatRoomId | string)[];
    readonly at: UnixMs;
  };
  CHAT_SESSION_REJECTED: {
    readonly sessionId?: ChatSessionId | string;
    readonly reason: string;
    readonly at: UnixMs;
  };
  CHAT_ROOM_JOINED: {
    readonly sessionId: ChatSessionId | string;
    readonly roomId: ChatRoomId | string;
    readonly at: UnixMs;
  };
  CHAT_ROOM_LEFT: {
    readonly sessionId: ChatSessionId | string;
    readonly roomId: ChatRoomId | string;
    readonly at: UnixMs;
  };
  CHAT_CHANNEL_POLICY_EVALUATED: {
    readonly roomId: ChatRoomId | string;
    readonly channelId: ChatChannelId;
    readonly allowed: boolean;
    readonly reason?: string;
    readonly at: UnixMs;
  };
  CHAT_MESSAGE_ACCEPTED: {
    readonly requestId?: ChatRequestId | string;
    readonly message: ChatMessageWire;
    readonly at: UnixMs;
  };
  CHAT_MESSAGE_SUPPRESSED: {
    readonly requestId?: ChatRequestId | string;
    readonly roomId: ChatRoomId | string;
    readonly channelId: ChatChannelId;
    readonly moderation: ChatModerationWire;
    readonly at: UnixMs;
  };
  CHAT_MESSAGE_REDACTED: {
    readonly messageId: ChatMessageId | string;
    readonly roomId: ChatRoomId | string;
    readonly channelId: ChatChannelId;
    readonly moderation: ChatModerationWire;
    readonly at: UnixMs;
  };
  CHAT_TRANSCRIPT_APPENDED: {
    readonly roomId: ChatRoomId | string;
    readonly channelId: ChatChannelId;
    readonly messageId: ChatMessageId | string;
    readonly at: UnixMs;
  };
  CHAT_TRANSCRIPT_SOFT_DELETED: {
    readonly roomId: ChatRoomId | string;
    readonly channelId: ChatChannelId;
    readonly messageId: ChatMessageId | string;
    readonly at: UnixMs;
  };
  CHAT_PROOF_EDGE_RECORDED: {
    readonly edgeId: ChatCausalEdgeId | string;
    readonly sourceMessageId?: ChatMessageId | string;
    readonly at: UnixMs;
  };
  CHAT_REPLAY_INDEXED: {
    readonly replayId: ChatReplayId | string;
    readonly roomId: ChatRoomId | string;
    readonly at: UnixMs;
  };
  CHAT_INFERENCE_COMPLETED: {
    readonly roomId: ChatRoomId | string;
    readonly at: UnixMs;
  };
  CHAT_FEATURE_SNAPSHOT_WRITTEN: {
    readonly requestId?: ChatRequestId | string;
    readonly roomId: ChatRoomId | string;
    readonly at: UnixMs;
  };
  CHAT_PROFILE_PERSISTED: {
    readonly playerId?: ChatUserId | string;
    readonly at: UnixMs;
  };
  CHAT_INVASION_STATE_CHANGED: {
    readonly roomId: ChatRoomId | string;
    readonly active: boolean;
    readonly at: UnixMs;
  };
  CHAT_NEGOTIATION_STATE_CHANGED: {
    readonly roomId: ChatRoomId | string;
    readonly offerId?: ChatOfferId | string;
    readonly at: UnixMs;
  };
  CHAT_WORLD_EVENT_STATE_CHANGED: {
    readonly worldEventId: ChatWorldEventId | string;
    readonly active: boolean;
    readonly at: UnixMs;
  };
}

export type ChatAuthoritativeEventEnvelope<
  TName extends ChatAuthoritativeEventName = ChatAuthoritativeEventName,
> = {
  readonly eventName: TName;
  readonly payload: ChatAuthoritativeEventPayloadMap[TName];
};

// ============================================================================
// MARK: Server transport protocol and raw socket limits
// ============================================================================

export const CHAT_SOCKET_PROTOCOL_NAME = 'pzo.unified.chat' as const;
export const CHAT_SOCKET_PROTOCOL_VERSION = 1 as const;
export const CHAT_SOCKET_PROTOCOL_REVISION =
  '2026-03-14.transport.chat.v1' as const;

export const CHAT_SOCKET_MAX_RAW_FRAME_BYTES = 256 * 1024;
export const CHAT_SOCKET_MAX_BODY_LENGTH = 8_000;
export const CHAT_SOCKET_MAX_RENDERED_BODY_LENGTH = 16_000;
export const CHAT_SOCKET_MAX_STATUS_TEXT_LENGTH = 240;
export const CHAT_SOCKET_MAX_PREVIEW_TEXT_LENGTH = 320;
export const CHAT_SOCKET_MAX_TAG_COUNT = 32;
export const CHAT_SOCKET_MAX_BADGE_COUNT = 24;
export const CHAT_SOCKET_MAX_CURSOR_TEXT_LENGTH = 320;
export const CHAT_SOCKET_MAX_CHANNELS_PER_REQUEST = 12;
export const CHAT_SOCKET_MAX_TARGET_SESSIONS_PER_REQUEST = 32;
export const CHAT_SOCKET_MAX_ROOM_ID_LENGTH = 128;
export const CHAT_SOCKET_MAX_SESSION_ID_LENGTH = 128;
export const CHAT_SOCKET_MAX_EVENT_NAME_LENGTH = 96;
export const CHAT_SOCKET_MAX_CORRELATION_ID_LENGTH = 128;
export const CHAT_SOCKET_MAX_TRACE_ID_LENGTH = 128;
export const CHAT_SOCKET_MAX_REASON_LENGTH = 240;
export const CHAT_SOCKET_MAX_DIMENSION_TAGS = 24;
export const CHAT_SOCKET_TYPING_TTL_MS = 6_000;
export const CHAT_SOCKET_CURSOR_TTL_MS = 8_000;
export const CHAT_SOCKET_ACK_TIMEOUT_MS = 20_000;
export const CHAT_SOCKET_REPLAY_REQUEST_TIMEOUT_MS = 30_000;
export const CHAT_SOCKET_HEARTBEAT_GRACE_MS = 15_000;

// ============================================================================
// MARK: Socket transport event names
// ============================================================================

export const CHAT_SOCKET_INBOUND_EVENTS = [
  'chat:hello',
  'chat:resume',
  'chat:heartbeat',
  'chat:room:join',
  'chat:room:leave',
  'chat:message:send',
  'chat:presence:set',
  'chat:typing:set',
  'chat:cursor:update',
  'chat:cursor:clear',
  'chat:replay:request',
  'chat:replay:cancel',
  'chat:metrics:subscribe',
  'chat:metrics:unsubscribe',
  'chat:ack',
] as const;

export type ChatSocketInboundEventName =
  (typeof CHAT_SOCKET_INBOUND_EVENTS)[number];

export const CHAT_FANOUT_EVENTS = [
  'chat:message',
  'chat:message:redacted',
  'chat:presence',
  'chat:typing',
  'chat:cursor',
  'chat:replay:chunk',
  'chat:replay:complete',
  'chat:replay:error',
  'chat:control',
  'chat:metrics',
  'chat:helper',
  'chat:hater',
  'chat:invasion',
  'chat:system',
  'chat:delivery:ack',
] as const;

export type ChatFanoutEventName = (typeof CHAT_FANOUT_EVENTS)[number];

export const CHAT_SOCKET_OUTBOUND_EVENTS = [
  ...CHAT_FANOUT_EVENTS,
  'chat:error',
  'chat:ack:server',
  'chat:hello:accepted',
  'chat:resume:accepted',
  'chat:heartbeat:accepted',
  'chat:contract:warning',
] as const;

export type ChatSocketOutboundEventName =
  (typeof CHAT_SOCKET_OUTBOUND_EVENTS)[number];

export type ChatSocketEventName =
  | ChatSocketInboundEventName
  | ChatSocketOutboundEventName;

export type ChatSocketDirection = 'CLIENT_TO_SERVER' | 'SERVER_TO_CLIENT';

export type ChatSocketCapability =
  | 'HELLO'
  | 'RESUME'
  | 'HEARTBEAT'
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'MESSAGE_SEND'
  | 'PRESENCE_SET'
  | 'TYPING_SET'
  | 'CURSOR_UPDATE'
  | 'CURSOR_CLEAR'
  | 'REPLAY_REQUEST'
  | 'REPLAY_CANCEL'
  | 'METRICS_SUBSCRIBE'
  | 'METRICS_UNSUBSCRIBE'
  | 'ACK'
  | 'MESSAGE_FANOUT'
  | 'PRESENCE_FANOUT'
  | 'TYPING_FANOUT'
  | 'CURSOR_FANOUT'
  | 'REPLAY_FANOUT'
  | 'CONTROL_FANOUT'
  | 'METRICS_FANOUT'
  | 'HELPER_FANOUT'
  | 'HATER_FANOUT'
  | 'INVASION_FANOUT'
  | 'SYSTEM_FANOUT'
  | 'DELIVERY_ACK'
  | 'ERROR'
  | 'WARNING_FANOUT';

export type ChatSocketDeliveryClass = 'CONTROL' | 'TRANSIENT' | 'PERSISTED' | 'REPLAY';

export type ChatSocketReplayHydrationMode =
  | 'JOIN'
  | 'AROUND_MESSAGE'
  | 'LATEST'
  | 'SCENE'
  | 'MOMENT';

export type ChatSocketReplayAnchorKind =
  | 'MESSAGE_ID'
  | 'SCENE_ID'
  | 'MOMENT_ID'
  | 'TIMESTAMP'
  | 'CHANNEL_BOUNDARY';

export type ChatSocketErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_ROOM'
  | 'INVALID_CHANNEL'
  | 'INVALID_FRAME'
  | 'FRAME_TOO_LARGE'
  | 'MESSAGE_TOO_LONG'
  | 'RATE_LIMITED'
  | 'REPLAY_NOT_ALLOWED'
  | 'CHANNEL_REQUIRED'
  | 'ROOM_REQUIRED'
  | 'INTERNAL_ERROR';

export type ChatSocketWarningCode =
  | 'CHANNELS_DEDUPED'
  | 'UNKNOWN_DIMENSION_DROPPED'
  | 'BADGE_LIMIT_APPLIED'
  | 'TAG_LIMIT_APPLIED';

// ============================================================================
// MARK: Socket envelope primitives
// ============================================================================

export interface ChatSocketEnvelopeMeta {
  readonly protocol: typeof CHAT_SOCKET_PROTOCOL_NAME;
  readonly protocolVersion: typeof CHAT_SOCKET_PROTOCOL_VERSION;
  readonly protocolRevision: typeof CHAT_SOCKET_PROTOCOL_REVISION;
  readonly direction: ChatSocketDirection;
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly roomId?: ChatRoomId | string;
  readonly channelId?: ChatChannelId;
  readonly sessionId?: ChatSessionId | string;
  readonly sentAt: UnixMs;
}

export interface ChatSocketEnvelopeBase<
  TEvent extends ChatSocketEventName,
  TPayload,
> {
  readonly event: TEvent;
  readonly meta: ChatSocketEnvelopeMeta;
  readonly payload: TPayload;
}

export interface ChatSocketRawFrame {
  readonly event: string;
  readonly meta?: Partial<ChatSocketEnvelopeMeta>;
  readonly payload?: JsonValue;
}

// ============================================================================
// MARK: Inbound transport payloads
// ============================================================================

export interface ChatHelloPayload {
  readonly sessionId?: ChatSessionId | string;
  readonly userId?: ChatUserId | string;
  readonly requestedChannels?: readonly ChatChannelId[];
  readonly capabilities?: readonly ChatSocketCapability[];
  readonly recipientRole?: ChatRecipientRole;
}

export interface ChatResumePayload {
  readonly sessionId: ChatSessionId | string;
  readonly roomIds?: readonly (ChatRoomId | string)[];
}

export interface ChatHeartbeatPayload {
  readonly heartbeatAt: UnixMs;
}

export interface ChatRoomJoinPayload {
  readonly roomId: ChatRoomId | string;
  readonly preferredVisibleChannel?: ChatVisibleChannel;
  readonly mountTarget?: ChatMountTarget;
  readonly hydrateMode?: ChatSocketReplayHydrationMode;
  readonly replayAnchorKind?: ChatSocketReplayAnchorKind;
  readonly replayAnchorValue?: string;
}

export interface ChatRoomLeavePayload {
  readonly roomId: ChatRoomId | string;
  readonly reason?: string;
}

export interface ChatMessageSendPayload {
  readonly requestId: ChatRequestId | string;
  readonly clientMessageId?: string;
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatVisibleChannel;
  readonly kind?: ChatMessageKind;
  readonly body: string;
  readonly senderHandle?: string;
  readonly replyToMessageId?: ChatMessageId | string;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly mountTarget?: ChatMountTarget;
  readonly tags?: readonly string[];
  readonly meta?: JsonObject;
}

export interface ChatPresenceSetPayload {
  readonly roomId: ChatRoomId | string;
  readonly channelId?: ChatChannelId;
  readonly presence: ChatPresenceKind;
  readonly statusText?: string;
}

export interface ChatTypingSetPayload {
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatVisibleChannel;
  readonly typing: Exclude<ChatTypingKind, 'SIMULATED'>;
  readonly token?: ChatTypingToken;
}

export interface ChatCursorUpdatePayload {
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatVisibleChannel;
  readonly previewText: string;
  readonly cursorStart: number;
  readonly cursorEnd: number;
}

export interface ChatCursorClearPayload {
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatVisibleChannel;
}

export interface ChatReplayRequestPayload {
  readonly requestId: ChatRequestId | string;
  readonly roomId: ChatRoomId | string;
  readonly channelIds?: readonly ChatChannelId[];
  readonly hydrationMode: ChatSocketReplayHydrationMode;
  readonly anchorKind?: ChatSocketReplayAnchorKind;
  readonly anchorValue?: string;
  readonly beforeCount?: number;
  readonly afterCount?: number;
}

export interface ChatReplayCancelPayload {
  readonly requestId: ChatRequestId | string;
}

export interface ChatMetricsSubscribePayload {
  readonly roomId: ChatRoomId | string;
  readonly channelIds?: readonly ChatChannelId[];
}

export interface ChatMetricsUnsubscribePayload {
  readonly roomId: ChatRoomId | string;
  readonly channelIds?: readonly ChatChannelId[];
}

export interface ChatAckPayload {
  readonly ackEvent: ChatSocketOutboundEventName;
  readonly correlationId: string;
  readonly roomId?: ChatRoomId | string;
  readonly channelId?: ChatChannelId;
}

// ============================================================================
// MARK: Outbound transport payloads
// ============================================================================

export interface ChatHelloAcceptedPayload {
  readonly sessionId: ChatSessionId | string;
  readonly acceptedAt: UnixMs;
  readonly recipientRole: ChatRecipientRole;
}

export interface ChatResumeAcceptedPayload {
  readonly sessionId: ChatSessionId | string;
  readonly resumedAt: UnixMs;
  readonly resumedRooms: readonly (ChatRoomId | string)[];
}

export interface ChatHeartbeatAcceptedPayload {
  readonly acceptedAt: UnixMs;
}

export interface ChatAckServerPayload {
  readonly ackedEvent: ChatSocketInboundEventName | ChatSocketOutboundEventName;
  readonly correlationId: string;
  readonly acceptedAt: UnixMs;
}

export interface ChatErrorPayload {
  readonly code: ChatSocketErrorCode;
  readonly reason: string;
  readonly correlationId?: string;
  readonly roomId?: ChatRoomId | string;
  readonly channelId?: ChatChannelId;
}

export interface ChatContractWarningPayload {
  readonly code: ChatSocketWarningCode;
  readonly reason: string;
  readonly correlationId?: string;
}

export interface ChatMessageFanoutPayload {
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatChannelId;
  readonly message: ChatMessageWire;
}

export interface ChatPresenceWire {
  readonly roomId: ChatRoomId | string;
  readonly channelId?: ChatChannelId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly presence: ChatPresenceKind;
  readonly updatedAt: UnixMs;
  readonly statusText?: string;
}

export interface ChatTypingWire {
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatChannelId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly typing: ChatTypingKind;
  readonly token?: ChatTypingToken;
  readonly startedAt?: UnixMs;
  readonly expiresAt?: UnixMs;
}

export interface ChatCursorWire {
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatChannelId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly previewText?: string;
  readonly cursorStart?: number;
  readonly cursorEnd?: number;
  readonly updatedAt: UnixMs;
}

export interface ChatPresenceFanoutPayload {
  readonly roomId: ChatRoomId | string;
  readonly channelId?: ChatChannelId;
  readonly presence: ChatPresenceWire;
}

export interface ChatTypingFanoutPayload {
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatChannelId;
  readonly typing: ChatTypingWire;
}

export interface ChatCursorFanoutPayload {
  readonly roomId: ChatRoomId | string;
  readonly channelId: ChatChannelId;
  readonly cursor: ChatCursorWire;
}

export interface ChatReplayFanoutPayload {
  readonly requestId: ChatRequestId | string;
  readonly excerpt: ChatReplayExcerptWire;
}

export interface ChatControlFanoutPayload {
  readonly roomId?: ChatRoomId | string;
  readonly channelId?: ChatChannelId;
  readonly controlKind:
    | 'INVADED'
    | 'SCENE_STARTED'
    | 'SCENE_COMPLETED'
    | 'SILENCE_STARTED'
    | 'SILENCE_ENDED'
    | 'RESCUE_TRIGGERED'
    | 'WORLD_EVENT_UPDATED'
    | 'NEGOTIATION_UPDATED';
  readonly sceneId?: ChatSceneId;
  readonly worldEventId?: ChatWorldEventId;
  readonly interventionId?: ChatInterventionId;
  readonly payload?: JsonObject;
}

export interface ChatMetricsFanoutPayload {
  readonly roomId: ChatRoomId | string;
  readonly channelId?: ChatChannelId;
  readonly payload: JsonObject;
}

// ============================================================================
// MARK: Socket frame aliases and unions
// ============================================================================

export type ChatHelloFrame = ChatSocketEnvelopeBase<'chat:hello', ChatHelloPayload>;
export type ChatResumeFrame = ChatSocketEnvelopeBase<'chat:resume', ChatResumePayload>;
export type ChatHeartbeatFrame = ChatSocketEnvelopeBase<'chat:heartbeat', ChatHeartbeatPayload>;
export type ChatRoomJoinFrame = ChatSocketEnvelopeBase<'chat:room:join', ChatRoomJoinPayload>;
export type ChatRoomLeaveFrame = ChatSocketEnvelopeBase<'chat:room:leave', ChatRoomLeavePayload>;
export type ChatMessageSendFrame = ChatSocketEnvelopeBase<'chat:message:send', ChatMessageSendPayload>;
export type ChatPresenceSetFrame = ChatSocketEnvelopeBase<'chat:presence:set', ChatPresenceSetPayload>;
export type ChatTypingSetFrame = ChatSocketEnvelopeBase<'chat:typing:set', ChatTypingSetPayload>;
export type ChatCursorUpdateFrame = ChatSocketEnvelopeBase<'chat:cursor:update', ChatCursorUpdatePayload>;
export type ChatCursorClearFrame = ChatSocketEnvelopeBase<'chat:cursor:clear', ChatCursorClearPayload>;
export type ChatReplayRequestFrame = ChatSocketEnvelopeBase<'chat:replay:request', ChatReplayRequestPayload>;
export type ChatReplayCancelFrame = ChatSocketEnvelopeBase<'chat:replay:cancel', ChatReplayCancelPayload>;
export type ChatMetricsSubscribeFrame = ChatSocketEnvelopeBase<'chat:metrics:subscribe', ChatMetricsSubscribePayload>;
export type ChatMetricsUnsubscribeFrame = ChatSocketEnvelopeBase<'chat:metrics:unsubscribe', ChatMetricsUnsubscribePayload>;
export type ChatAckFrame = ChatSocketEnvelopeBase<'chat:ack', ChatAckPayload>;

export type ChatSocketInboundFrame =
  | ChatHelloFrame
  | ChatResumeFrame
  | ChatHeartbeatFrame
  | ChatRoomJoinFrame
  | ChatRoomLeaveFrame
  | ChatMessageSendFrame
  | ChatPresenceSetFrame
  | ChatTypingSetFrame
  | ChatCursorUpdateFrame
  | ChatCursorClearFrame
  | ChatReplayRequestFrame
  | ChatReplayCancelFrame
  | ChatMetricsSubscribeFrame
  | ChatMetricsUnsubscribeFrame
  | ChatAckFrame;

export type ChatMessageFrame = ChatSocketEnvelopeBase<'chat:message', ChatMessageFanoutPayload>;
export type ChatMessageRedactedFrame = ChatSocketEnvelopeBase<'chat:message:redacted', ChatMessageFanoutPayload>;
export type ChatPresenceFrame = ChatSocketEnvelopeBase<'chat:presence', ChatPresenceFanoutPayload>;
export type ChatTypingFrame = ChatSocketEnvelopeBase<'chat:typing', ChatTypingFanoutPayload>;
export type ChatCursorFrame = ChatSocketEnvelopeBase<'chat:cursor', ChatCursorFanoutPayload>;
export type ChatReplayChunkFrame = ChatSocketEnvelopeBase<'chat:replay:chunk', ChatReplayFanoutPayload>;
export type ChatReplayCompleteFrame = ChatSocketEnvelopeBase<'chat:replay:complete', ChatReplayFanoutPayload>;
export type ChatReplayErrorFrame = ChatSocketEnvelopeBase<'chat:replay:error', ChatErrorPayload>;
export type ChatControlFrame = ChatSocketEnvelopeBase<'chat:control', ChatControlFanoutPayload>;
export type ChatMetricsFrame = ChatSocketEnvelopeBase<'chat:metrics', ChatMetricsFanoutPayload>;
export type ChatHelperFrame = ChatSocketEnvelopeBase<'chat:helper', ChatControlFanoutPayload>;
export type ChatHaterFrame = ChatSocketEnvelopeBase<'chat:hater', ChatControlFanoutPayload>;
export type ChatInvasionFrame = ChatSocketEnvelopeBase<'chat:invasion', ChatControlFanoutPayload>;
export type ChatSystemFrame = ChatSocketEnvelopeBase<'chat:system', ChatControlFanoutPayload>;
export type ChatDeliveryAckFrame = ChatSocketEnvelopeBase<'chat:delivery:ack', ChatAckServerPayload>;
export type ChatErrorFrame = ChatSocketEnvelopeBase<'chat:error', ChatErrorPayload>;
export type ChatAckServerFrame = ChatSocketEnvelopeBase<'chat:ack:server', ChatAckServerPayload>;
export type ChatHelloAcceptedFrame = ChatSocketEnvelopeBase<'chat:hello:accepted', ChatHelloAcceptedPayload>;
export type ChatResumeAcceptedFrame = ChatSocketEnvelopeBase<'chat:resume:accepted', ChatResumeAcceptedPayload>;
export type ChatHeartbeatAcceptedFrame = ChatSocketEnvelopeBase<'chat:heartbeat:accepted', ChatHeartbeatAcceptedPayload>;
export type ChatContractWarningFrame = ChatSocketEnvelopeBase<'chat:contract:warning', ChatContractWarningPayload>;

export type ChatSocketOutboundFrame =
  | ChatMessageFrame
  | ChatMessageRedactedFrame
  | ChatPresenceFrame
  | ChatTypingFrame
  | ChatCursorFrame
  | ChatReplayChunkFrame
  | ChatReplayCompleteFrame
  | ChatReplayErrorFrame
  | ChatControlFrame
  | ChatMetricsFrame
  | ChatHelperFrame
  | ChatHaterFrame
  | ChatInvasionFrame
  | ChatSystemFrame
  | ChatDeliveryAckFrame
  | ChatErrorFrame
  | ChatAckServerFrame
  | ChatHelloAcceptedFrame
  | ChatResumeAcceptedFrame
  | ChatHeartbeatAcceptedFrame
  | ChatContractWarningFrame;

// ============================================================================
// MARK: Socket event descriptor catalog
// ============================================================================

export interface ChatSocketEventDescriptor {
  readonly event: ChatSocketEventName;
  readonly direction: ChatSocketDirection;
  readonly capability: ChatSocketCapability;
  readonly deliveryClass: ChatSocketDeliveryClass;
  readonly requiresRoom: boolean;
  readonly requiresChannel: boolean;
  readonly requiresAck: boolean;
  readonly maxPayloadBytes: number;
  readonly notes: readonly string[];
}

function defineSocketEvent(
  descriptor: ChatSocketEventDescriptor,
): ChatSocketEventDescriptor {
  return Object.freeze(descriptor);
}

export const CHAT_SOCKET_EVENT_CATALOG: Readonly<
  Record<ChatSocketEventName, ChatSocketEventDescriptor>
> = Object.freeze({
  'chat:hello': defineSocketEvent({ event: 'chat:hello', direction: 'CLIENT_TO_SERVER', capability: 'HELLO', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 8 * 1024, notes: ['Session handshake'] }),
  'chat:resume': defineSocketEvent({ event: 'chat:resume', direction: 'CLIENT_TO_SERVER', capability: 'RESUME', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Session resume'] }),
  'chat:heartbeat': defineSocketEvent({ event: 'chat:heartbeat', direction: 'CLIENT_TO_SERVER', capability: 'HEARTBEAT', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 4 * 1024, notes: ['Keepalive'] }),
  'chat:room:join': defineSocketEvent({ event: 'chat:room:join', direction: 'CLIENT_TO_SERVER', capability: 'ROOM_JOIN', deliveryClass: 'CONTROL', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Join room and optionally hydrate replay'] }),
  'chat:room:leave': defineSocketEvent({ event: 'chat:room:leave', direction: 'CLIENT_TO_SERVER', capability: 'ROOM_LEAVE', deliveryClass: 'CONTROL', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 8 * 1024, notes: ['Leave room'] }),
  'chat:message:send': defineSocketEvent({ event: 'chat:message:send', direction: 'CLIENT_TO_SERVER', capability: 'MESSAGE_SEND', deliveryClass: 'PERSISTED', requiresRoom: true, requiresChannel: true, requiresAck: true, maxPayloadBytes: 32 * 1024, notes: ['Client message intent'] }),
  'chat:presence:set': defineSocketEvent({ event: 'chat:presence:set', direction: 'CLIENT_TO_SERVER', capability: 'PRESENCE_SET', deliveryClass: 'TRANSIENT', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 8 * 1024, notes: ['Presence mutation'] }),
  'chat:typing:set': defineSocketEvent({ event: 'chat:typing:set', direction: 'CLIENT_TO_SERVER', capability: 'TYPING_SET', deliveryClass: 'TRANSIENT', requiresRoom: true, requiresChannel: true, requiresAck: false, maxPayloadBytes: 8 * 1024, notes: ['Typing state mutation'] }),
  'chat:cursor:update': defineSocketEvent({ event: 'chat:cursor:update', direction: 'CLIENT_TO_SERVER', capability: 'CURSOR_UPDATE', deliveryClass: 'TRANSIENT', requiresRoom: true, requiresChannel: true, requiresAck: false, maxPayloadBytes: 8 * 1024, notes: ['Draft preview and cursor position'] }),
  'chat:cursor:clear': defineSocketEvent({ event: 'chat:cursor:clear', direction: 'CLIENT_TO_SERVER', capability: 'CURSOR_CLEAR', deliveryClass: 'TRANSIENT', requiresRoom: true, requiresChannel: true, requiresAck: false, maxPayloadBytes: 4 * 1024, notes: ['Clear preview'] }),
  'chat:replay:request': defineSocketEvent({ event: 'chat:replay:request', direction: 'CLIENT_TO_SERVER', capability: 'REPLAY_REQUEST', deliveryClass: 'REPLAY', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Replay hydrate request'] }),
  'chat:replay:cancel': defineSocketEvent({ event: 'chat:replay:cancel', direction: 'CLIENT_TO_SERVER', capability: 'REPLAY_CANCEL', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 4 * 1024, notes: ['Replay cancel'] }),
  'chat:metrics:subscribe': defineSocketEvent({ event: 'chat:metrics:subscribe', direction: 'CLIENT_TO_SERVER', capability: 'METRICS_SUBSCRIBE', deliveryClass: 'CONTROL', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 8 * 1024, notes: ['Metrics stream opt-in'] }),
  'chat:metrics:unsubscribe': defineSocketEvent({ event: 'chat:metrics:unsubscribe', direction: 'CLIENT_TO_SERVER', capability: 'METRICS_UNSUBSCRIBE', deliveryClass: 'CONTROL', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 8 * 1024, notes: ['Metrics stream opt-out'] }),
  'chat:ack': defineSocketEvent({ event: 'chat:ack', direction: 'CLIENT_TO_SERVER', capability: 'ACK', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 8 * 1024, notes: ['Client acknowledgement of outbound frame'] }),

  'chat:message': defineSocketEvent({ event: 'chat:message', direction: 'SERVER_TO_CLIENT', capability: 'MESSAGE_FANOUT', deliveryClass: 'PERSISTED', requiresRoom: true, requiresChannel: true, requiresAck: false, maxPayloadBytes: 64 * 1024, notes: ['Authoritative visible message fanout'] }),
  'chat:message:redacted': defineSocketEvent({ event: 'chat:message:redacted', direction: 'SERVER_TO_CLIENT', capability: 'MESSAGE_FANOUT', deliveryClass: 'PERSISTED', requiresRoom: true, requiresChannel: true, requiresAck: false, maxPayloadBytes: 64 * 1024, notes: ['Authoritative redaction fanout'] }),
  'chat:presence': defineSocketEvent({ event: 'chat:presence', direction: 'SERVER_TO_CLIENT', capability: 'PRESENCE_FANOUT', deliveryClass: 'TRANSIENT', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Presence fanout'] }),
  'chat:typing': defineSocketEvent({ event: 'chat:typing', direction: 'SERVER_TO_CLIENT', capability: 'TYPING_FANOUT', deliveryClass: 'TRANSIENT', requiresRoom: true, requiresChannel: true, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Typing fanout'] }),
  'chat:cursor': defineSocketEvent({ event: 'chat:cursor', direction: 'SERVER_TO_CLIENT', capability: 'CURSOR_FANOUT', deliveryClass: 'TRANSIENT', requiresRoom: true, requiresChannel: true, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Cursor preview fanout'] }),
  'chat:replay:chunk': defineSocketEvent({ event: 'chat:replay:chunk', direction: 'SERVER_TO_CLIENT', capability: 'REPLAY_FANOUT', deliveryClass: 'REPLAY', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 128 * 1024, notes: ['Replay excerpt chunk'] }),
  'chat:replay:complete': defineSocketEvent({ event: 'chat:replay:complete', direction: 'SERVER_TO_CLIENT', capability: 'REPLAY_FANOUT', deliveryClass: 'REPLAY', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 24 * 1024, notes: ['Replay excerpt terminal frame'] }),
  'chat:replay:error': defineSocketEvent({ event: 'chat:replay:error', direction: 'SERVER_TO_CLIENT', capability: 'CONTROL_FANOUT', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Replay request failure'] }),
  'chat:control': defineSocketEvent({ event: 'chat:control', direction: 'SERVER_TO_CLIENT', capability: 'CONTROL_FANOUT', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 24 * 1024, notes: ['Scene, silence, rescue, world-event, or negotiation control'] }),
  'chat:metrics': defineSocketEvent({ event: 'chat:metrics', direction: 'SERVER_TO_CLIENT', capability: 'METRICS_FANOUT', deliveryClass: 'TRANSIENT', requiresRoom: true, requiresChannel: false, requiresAck: false, maxPayloadBytes: 24 * 1024, notes: ['Chat metrics stream'] }),
  'chat:helper': defineSocketEvent({ event: 'chat:helper', direction: 'SERVER_TO_CLIENT', capability: 'HELPER_FANOUT', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 24 * 1024, notes: ['Helper-specific control fanout'] }),
  'chat:hater': defineSocketEvent({ event: 'chat:hater', direction: 'SERVER_TO_CLIENT', capability: 'HATER_FANOUT', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 24 * 1024, notes: ['Hater-specific control fanout'] }),
  'chat:invasion': defineSocketEvent({ event: 'chat:invasion', direction: 'SERVER_TO_CLIENT', capability: 'INVASION_FANOUT', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 24 * 1024, notes: ['Invasion state fanout'] }),
  'chat:system': defineSocketEvent({ event: 'chat:system', direction: 'SERVER_TO_CLIENT', capability: 'SYSTEM_FANOUT', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 24 * 1024, notes: ['System-only notification fanout'] }),
  'chat:delivery:ack': defineSocketEvent({ event: 'chat:delivery:ack', direction: 'SERVER_TO_CLIENT', capability: 'DELIVERY_ACK', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 12 * 1024, notes: ['Delivery acknowledgement for client intent'] }),
  'chat:error': defineSocketEvent({ event: 'chat:error', direction: 'SERVER_TO_CLIENT', capability: 'ERROR', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Protocol or validation error'] }),
  'chat:ack:server': defineSocketEvent({ event: 'chat:ack:server', direction: 'SERVER_TO_CLIENT', capability: 'ACK', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 12 * 1024, notes: ['Server ack of client ack or state edge'] }),
  'chat:hello:accepted': defineSocketEvent({ event: 'chat:hello:accepted', direction: 'SERVER_TO_CLIENT', capability: 'HELLO', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 12 * 1024, notes: ['Handshake accepted'] }),
  'chat:resume:accepted': defineSocketEvent({ event: 'chat:resume:accepted', direction: 'SERVER_TO_CLIENT', capability: 'RESUME', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Resume accepted'] }),
  'chat:heartbeat:accepted': defineSocketEvent({ event: 'chat:heartbeat:accepted', direction: 'SERVER_TO_CLIENT', capability: 'HEARTBEAT', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 8 * 1024, notes: ['Heartbeat accepted'] }),
  'chat:contract:warning': defineSocketEvent({ event: 'chat:contract:warning', direction: 'SERVER_TO_CLIENT', capability: 'WARNING_FANOUT', deliveryClass: 'CONTROL', requiresRoom: false, requiresChannel: false, requiresAck: false, maxPayloadBytes: 16 * 1024, notes: ['Normalization warning'] }),
});

// ============================================================================
// MARK: Upstream seven-engine and neighboring system signals
// ============================================================================

export const CHAT_UPSTREAM_SIGNAL_TYPES = [
  'RUN_STARTED',
  'RUN_ENDED',
  'PRESSURE_TIER_CHANGED',
  'TICK_TIER_CHANGED',
  'SHIELD_LAYER_BREACHED',
  'SHIELD_FORTIFIED',
  'BOT_ATTACK_FIRED',
  'BOT_STATE_CHANGED',
  'CASCADE_CHAIN_STARTED',
  'CASCADE_CHAIN_BROKEN',
  'CASCADE_POSITIVE_ACTIVATED',
  'SOVEREIGNTY_APPROACH',
  'SOVEREIGNTY_ACHIEVED',
  'CARD_PLAYED',
  'DEAL_PROOF_ISSUED',
] as const;

export type ChatUpstreamSignalType = (typeof CHAT_UPSTREAM_SIGNAL_TYPES)[number];

export interface ChatUpstreamSignalBase {
  readonly signalType: ChatUpstreamSignalType;
  readonly emittedAt: UnixMs;
  readonly tickNumber?: TickNumber;
  readonly roomId?: ChatRoomId | string;
  readonly runId?: string;
}

export interface ChatRunStartedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'RUN_STARTED';
  readonly modeKey?: string;
}

export interface ChatRunEndedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'RUN_ENDED';
  readonly outcome?: string;
  readonly proofHash?: ChatProofHash;
}

export interface ChatPressureTierChangedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'PRESSURE_TIER_CHANGED';
  readonly nextTier: string;
  readonly score?: number;
}

export interface ChatTickTierChangedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'TICK_TIER_CHANGED';
  readonly nextTier: string;
}

export interface ChatShieldLayerBreachedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'SHIELD_LAYER_BREACHED';
  readonly layerId: string;
  readonly integrityAfter?: number;
}

export interface ChatShieldFortifiedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'SHIELD_FORTIFIED';
  readonly layerId?: string;
}

export interface ChatBotAttackFiredSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'BOT_ATTACK_FIRED';
  readonly botId: string;
  readonly attackType: string;
  readonly targetLayerId?: string;
}

export interface ChatBotStateChangedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'BOT_STATE_CHANGED';
  readonly botId: string;
  readonly from?: string;
  readonly to?: string;
}

export interface ChatCascadeSignal extends ChatUpstreamSignalBase {
  readonly signalType:
    | 'CASCADE_CHAIN_STARTED'
    | 'CASCADE_CHAIN_BROKEN'
    | 'CASCADE_POSITIVE_ACTIVATED';
  readonly chainId?: string;
  readonly severity?: string;
}

export interface ChatSovereigntySignal extends ChatUpstreamSignalBase {
  readonly signalType: 'SOVEREIGNTY_APPROACH' | 'SOVEREIGNTY_ACHIEVED';
  readonly proofHash?: ChatProofHash;
}

export interface ChatCardPlayedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'CARD_PLAYED';
  readonly cardId?: string;
  readonly cardName?: string;
  readonly cardType?: string;
}

export interface ChatDealProofIssuedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'DEAL_PROOF_ISSUED';
  readonly proofHash: ChatProofHash;
  readonly offerId?: ChatOfferId;
}

export type ChatUpstreamSignal =
  | ChatRunStartedSignal
  | ChatRunEndedSignal
  | ChatPressureTierChangedSignal
  | ChatTickTierChangedSignal
  | ChatShieldLayerBreachedSignal
  | ChatShieldFortifiedSignal
  | ChatBotAttackFiredSignal
  | ChatBotStateChangedSignal
  | ChatCascadeSignal
  | ChatSovereigntySignal
  | ChatCardPlayedSignal
  | ChatDealProofIssuedSignal;

// ============================================================================
// MARK: Legacy transport event names and payload maps
// ============================================================================

export const CHAT_TRANSPORT_INBOUND_EVENT_NAMES = [
  'CHAT_CONNECT',
  'CHAT_DISCONNECT',
  'CHAT_JOIN_ROOM',
  'CHAT_LEAVE_ROOM',
  'CHAT_SEND_MESSAGE',
  'CHAT_SET_PRESENCE',
  'CHAT_SET_TYPING',
  'CHAT_SET_CURSOR',
  'CHAT_MARK_READ',
  'CHAT_REQUEST_REPLAY',
  'CHAT_REQUEST_SYNC',
  'CHAT_SUBMIT_CLIENT_FEATURES',
] as const;

export type ChatTransportInboundEventName =
  (typeof CHAT_TRANSPORT_INBOUND_EVENT_NAMES)[number];

export const CHAT_TRANSPORT_OUTBOUND_EVENT_NAMES = [
  'CHAT_CONNECTED',
  'CHAT_DISCONNECTED',
  'CHAT_ROOM_JOINED',
  'CHAT_ROOM_LEFT',
  'CHAT_MESSAGE_ACK',
  'CHAT_MESSAGE_PUBLISHED',
  'CHAT_MESSAGE_REJECTED',
  'CHAT_PRESENCE_UPDATED',
  'CHAT_TYPING_UPDATED',
  'CHAT_CURSOR_UPDATED',
  'CHAT_READ_MARKED',
  'CHAT_REPLAY_SNAPSHOT',
  'CHAT_SYNC_FRAME',
  'CHAT_WORLD_EVENT_FRAME',
  'CHAT_ERROR',
] as const;

export type ChatTransportOutboundEventName =
  (typeof CHAT_TRANSPORT_OUTBOUND_EVENT_NAMES)[number];

export interface ChatTransportInboundPayloadMap {
  CHAT_CONNECT: {
    readonly sessionId?: ChatSessionId;
    readonly playerId?: ChatUserId;
    readonly mountTarget?: ChatMountTarget;
    readonly modeScope?: ChatModeScope;
  };
  CHAT_DISCONNECT: {
    readonly reason?: string;
  };
  CHAT_JOIN_ROOM: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
  };
  CHAT_LEAVE_ROOM: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
  };
  CHAT_SEND_MESSAGE: ChatClientSendMessageRequest;
  CHAT_SET_PRESENCE: ChatClientPresenceRequest;
  CHAT_SET_TYPING: ChatClientTypingRequest;
  CHAT_SET_CURSOR: ChatClientCursorRequest;
  CHAT_MARK_READ: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
    readonly messageId: ChatMessageId;
    readonly readAt: UnixMs;
  };
  CHAT_REQUEST_REPLAY: ChatReplayWindowRequest;
  CHAT_REQUEST_SYNC: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
    readonly includePresence?: boolean;
    readonly includeTyping?: boolean;
  };
  CHAT_SUBMIT_CLIENT_FEATURES: {
    readonly featureSnapshot: ChatFeatureSnapshot;
  };
}

export interface ChatTransportOutboundPayloadMap {
  CHAT_CONNECTED: {
    readonly sessionId: ChatSessionId;
    readonly connectedAt: UnixMs;
  };
  CHAT_DISCONNECTED: {
    readonly disconnectedAt: UnixMs;
    readonly reason?: string;
  };
  CHAT_ROOM_JOINED: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
    readonly joinedAt: UnixMs;
  };
  CHAT_ROOM_LEFT: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
    readonly leftAt: UnixMs;
  };
  CHAT_MESSAGE_ACK: {
    readonly requestId?: ChatRequestId;
    readonly messageId?: ChatMessageId;
    readonly at: UnixMs;
  };
  CHAT_MESSAGE_PUBLISHED: ChatAuthoritativeFrame;
  CHAT_MESSAGE_REJECTED: {
    readonly requestId?: ChatRequestId;
    readonly reason: string;
    readonly moderation?: ChatModerationDecision;
    readonly at: UnixMs;
  };
  CHAT_PRESENCE_UPDATED: {
    readonly roomId: ChatRoomId;
    readonly channelId?: ChatChannelId;
    readonly presence: readonly ChatPresenceSnapshot[];
  };
  CHAT_TYPING_UPDATED: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
    readonly typing: readonly ChatTypingSnapshot[];
  };
  CHAT_CURSOR_UPDATED: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
    readonly cursor: readonly ChatCursorSnapshot[];
  };
  CHAT_READ_MARKED: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
    readonly messageId: ChatMessageId;
    readonly readAt: UnixMs;
  };
  CHAT_REPLAY_SNAPSHOT: ChatReplayWindowSnapshot;
  CHAT_SYNC_FRAME: ChatAuthoritativeFrame;
  CHAT_WORLD_EVENT_FRAME: {
    readonly liveOps: ChatLiveOpsState;
    readonly at: UnixMs;
  };
  CHAT_ERROR: {
    readonly reason: string;
    readonly at: UnixMs;
  };
}

export type ChatTransportEnvelope = {
  readonly eventName:
    | ChatTransportInboundEventName
    | ChatTransportOutboundEventName;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
};

// ============================================================================
// MARK: Telemetry vocabulary
// ============================================================================

export const CHAT_TELEMETRY_EVENTS = [
  'chat_opened',
  'chat_closed',
  'message_sent',
  'message_rejected',
  'message_received',
  'presence_updated',
  'typing_updated',
  'cursor_updated',
  'replay_requested',
  'replay_hydrated',
  'helper_triggered',
  'hater_triggered',
  'invasion_started',
  'invasion_ended',
  'legend_emitted',
  'world_event_seen',
] as const;

export type ChatTelemetryEventName = (typeof CHAT_TELEMETRY_EVENTS)[number];

export interface ChatTelemetryEvent {
  readonly telemetryId: ChatTelemetryId;
  readonly eventName: ChatTelemetryEventName;
  readonly occurredAt: UnixMs;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly messageId?: ChatMessageId;
  readonly payload?: JsonObject;
}

// ============================================================================
// MARK: Routing and helper functions
// ============================================================================

export function eventNameToRoutingBucket(
  eventName:
    | ChatTransportInboundEventName
    | ChatTransportOutboundEventName
    | ChatEngineEventName,
):
  | 'CONNECTION'
  | 'ROOM'
  | 'MESSAGE'
  | 'PRESENCE'
  | 'CURSOR'
  | 'REPLAY'
  | 'SYNC'
  | 'WORLD_EVENT'
  | 'PROFILE'
  | 'ERROR' {
  if (
    eventName === 'CHAT_CONNECT' ||
    eventName === 'CHAT_CONNECTED' ||
    eventName === 'CHAT_DISCONNECT' ||
    eventName === 'CHAT_DISCONNECTED' ||
    eventName === 'CHAT_ENGINE_CONNECTED' ||
    eventName === 'CHAT_ENGINE_DISCONNECTED'
  ) {
    return 'CONNECTION';
  }

  if (
    eventName === 'CHAT_JOIN_ROOM' ||
    eventName === 'CHAT_LEAVE_ROOM' ||
    eventName === 'CHAT_ROOM_JOINED' ||
    eventName === 'CHAT_ROOM_LEFT'
  ) {
    return 'ROOM';
  }

  if (
    eventName === 'CHAT_SEND_MESSAGE' ||
    eventName === 'CHAT_MESSAGE_ACK' ||
    eventName === 'CHAT_MESSAGE_PUBLISHED' ||
    eventName === 'CHAT_MESSAGE_REJECTED' ||
    eventName === 'CHAT_MESSAGE_STAGED' ||
    eventName === 'CHAT_MESSAGE_CONFIRMED' ||
    eventName === 'CHAT_MESSAGE_RECEIVED'
  ) {
    return 'MESSAGE';
  }

  if (
    eventName === 'CHAT_SET_PRESENCE' ||
    eventName === 'CHAT_SET_TYPING' ||
    eventName === 'CHAT_PRESENCE_UPDATED' ||
    eventName === 'CHAT_TYPING_UPDATED'
  ) {
    return 'PRESENCE';
  }

  if (eventName === 'CHAT_SET_CURSOR' || eventName === 'CHAT_CURSOR_UPDATED') {
    return 'CURSOR';
  }

  if (eventName === 'CHAT_REQUEST_REPLAY' || eventName === 'CHAT_REPLAY_SNAPSHOT') {
    return 'REPLAY';
  }

  if (eventName === 'CHAT_REQUEST_SYNC' || eventName === 'CHAT_SYNC_FRAME') {
    return 'SYNC';
  }

  if (eventName === 'CHAT_WORLD_EVENT_FRAME' || eventName === 'CHAT_WORLD_EVENT_UPDATED') {
    return 'WORLD_EVENT';
  }

  if (eventName === 'CHAT_PROFILE_UPDATED') {
    return 'PROFILE';
  }

  return 'ERROR';
}

export function envelopeTouchesVisibleSurface(
  envelope: ChatTransportEnvelope,
): boolean {
  if (!envelope.channelId) {
    return false;
  }
  return isChatVisibleChannel(envelope.channelId);
}

export function envelopeTouchesShadowSurface(
  envelope: ChatTransportEnvelope,
): boolean {
  if (!envelope.channelId) {
    return false;
  }
  return isChatShadowChannel(envelope.channelId);
}

export function authoritativeFrameHasMessages(frame: ChatAuthoritativeFrame): boolean {
  return Array.isArray(frame.messages) && frame.messages.length > 0;
}

export function authoritativeFrameHasPresence(frame: ChatAuthoritativeFrame): boolean {
  return Array.isArray(frame.presence) && frame.presence.length > 0;
}

export function authoritativeFrameHasTyping(frame: ChatAuthoritativeFrame): boolean {
  return Array.isArray(frame.typing) && frame.typing.length > 0;
}

export function isChatSocketInboundEventName(
  value: string,
): value is ChatSocketInboundEventName {
  return (CHAT_SOCKET_INBOUND_EVENTS as readonly string[]).includes(value);
}

export function isChatSocketOutboundEventName(
  value: string,
): value is ChatSocketOutboundEventName {
  return (CHAT_SOCKET_OUTBOUND_EVENTS as readonly string[]).includes(value);
}

export function isChatEngineEventName(value: string): value is ChatEngineEventName {
  return (CHAT_ENGINE_EVENT_NAMES as readonly string[]).includes(value);
}

export function isChatAuthoritativeEventName(
  value: string,
): value is ChatAuthoritativeEventName {
  return (CHAT_AUTHORITATIVE_EVENT_NAMES as readonly string[]).includes(value);
}

export function isChatUpstreamSignalType(value: string): value is ChatUpstreamSignalType {
  return (CHAT_UPSTREAM_SIGNAL_TYPES as readonly string[]).includes(value);
}

export function ensureValidVisibleChannel(channelId: string): ChatVisibleChannel | null {
  return isChatVisibleChannel(channelId) ? channelId : null;
}

export function ensureValidChannel(channelId: string): ChatChannelId | null {
  return isChatChannelId(channelId) ? channelId : null;
}

export function ensureValidMountTarget(value: string): ChatMountTarget | null {
  return isChatMountTarget(value) ? value : null;
}

export function ensureValidModeScope(value: string): ChatModeScope | null {
  return isChatModeScope(value) ? value : null;
}

// ============================================================================
// MARK: Stable readonly contract packages
// ============================================================================

export const CHAT_EVENT_CONSTANTS = Object.freeze({
  version: CHAT_CONTRACT_VERSION,
  apiVersion: '1.1.0',
  protocolName: CHAT_SOCKET_PROTOCOL_NAME,
  protocolVersion: CHAT_SOCKET_PROTOCOL_VERSION,
  protocolRevision: CHAT_SOCKET_PROTOCOL_REVISION,
  maxComposerLength: CHAT_SOCKET_MAX_BODY_LENGTH,
  localDedupWindowMs: 100,
  sceneSoftTimeoutMs: 12_000,
  revealPollIntervalMs: 150,
  typingDefaultTimeoutMs: 2_500,
  presenceStaleAfterMs: 25_000,
  rescueSilenceThresholdMs: 10_000,
  coldStartProfileVersion: '1',
  authorities: CHAT_CONTRACT_AUTHORITIES,
} as const);

export const CHAT_EVENT_CONTRACT = Object.freeze({
  version: CHAT_EVENT_CONSTANTS.version,
  apiVersion: CHAT_EVENT_CONSTANTS.apiVersion,
  protocolName: CHAT_EVENT_CONSTANTS.protocolName,
  protocolVersion: CHAT_EVENT_CONSTANTS.protocolVersion,
  protocolRevision: CHAT_EVENT_CONSTANTS.protocolRevision,
  authorities: CHAT_EVENT_CONSTANTS.authorities,
  visibleChannels: CHAT_VISIBLE_CHANNELS,
  shadowChannels: CHAT_SHADOW_CHANNELS,
  allChannels: CHAT_ALL_CHANNELS,
  mountTargets: CHAT_MOUNT_TARGETS,
  modeScopes: CHAT_MODE_SCOPES,
  messageKinds: CHAT_MESSAGE_KINDS,
  deliveryStates: CHAT_DELIVERY_STATES,
  moderationStates: CHAT_MODERATION_STATES,
  presenceStates: CHAT_PRESENCE_STATES,
  typingStates: CHAT_TYPING_STATES,
  notificationKinds: CHAT_NOTIFICATION_KINDS,
  telemetryEvents: CHAT_TELEMETRY_EVENTS,
  engineEventNames: CHAT_ENGINE_EVENT_NAMES,
  authoritativeEventNames: CHAT_AUTHORITATIVE_EVENT_NAMES,
  transportInboundEventNames: CHAT_TRANSPORT_INBOUND_EVENT_NAMES,
  transportOutboundEventNames: CHAT_TRANSPORT_OUTBOUND_EVENT_NAMES,
  socketInboundEvents: CHAT_SOCKET_INBOUND_EVENTS,
  socketOutboundEvents: CHAT_SOCKET_OUTBOUND_EVENTS,
  upstreamSignalTypes: CHAT_UPSTREAM_SIGNAL_TYPES,
  socketEventCatalog: CHAT_SOCKET_EVENT_CATALOG,
} as const);

export default CHAT_EVENT_CONTRACT;

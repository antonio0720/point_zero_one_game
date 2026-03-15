/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT EVENT CONTRACTS
 * FILE: shared/contracts/chat/ChatEvents.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared event vocabulary for the unified chat system. This file owns
 * transport envelopes, engine event names, message kinds, moderation states,
 * presence and typing contracts, authoritative frames, replay contracts,
 * telemetry events, upstream signals from the seven-engine stack, and transport
 * routing helpers used by:
 *
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Shared event contracts must be runtime-safe and import-safe.
 * 2. Frontend optimism may stage events, but backend authority decides truth.
 * 3. Server transport is a servant; it fans out authoritative decisions.
 * 4. Event names must preserve the donor vocabulary already present in the
 *    frontend engine lane while expanding it into the shared contracts root.
 * 5. Every event should answer one question clearly: who emitted it, what
 *    surface it belongs to, whether it is authoritative, and what causality it
 *    carries.
 *
 * Repo-aligned doctrine
 * ---------------------
 * The current frontend donor contract already defines the live message kinds,
 * telemetry events, upstream signal types, core ChatMessage contract, engine
 * event names, and authoritative frame semantics that the unified system is
 * supposed to converge around. This file folds that material into the shared
 * lane instead of leaving the frontend as the contract authority. citeturn388142view0
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelId,
  type ChatModeScope,
  type ChatMountTarget,
  type ChatRoomId,
  type ChatShadowChannel,
  type ChatVisibleChannel,
  type JsonObject,
  type JsonValue,
  type Nullable,
  type Optional,
  type Score01,
  type Score100,
  type TickNumber,
  type UnixMs,
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
// MARK: Branded identifiers
// ============================================================================

export type ChatSessionId = Brand<string, 'ChatSessionId'>;
export type ChatUserId = Brand<string, 'ChatUserId'>;
export type ChatNpcId = Brand<string, 'ChatNpcId'>;
export type ChatMessageId = Brand<string, 'ChatMessageId'>;
export type ChatSceneId = Brand<string, 'ChatSceneId'>;
export type ChatMomentId = Brand<string, 'ChatMomentId'>;
export type ChatLegendId = Brand<string, 'ChatLegendId'>;
export type ChatProofHash = Brand<string, 'ChatProofHash'>;
export type ChatQuoteId = Brand<string, 'ChatQuoteId'>;
export type ChatMemoryAnchorId = Brand<string, 'ChatMemoryAnchorId'>;
export type ChatTelemetryId = Brand<string, 'ChatTelemetryId'>;
export type ChatRequestId = Brand<string, 'ChatRequestId'>;
export type ChatReplayId = Brand<string, 'ChatReplayId'>;
export type ChatWorldEventId = Brand<string, 'ChatWorldEventId'>;
export type ChatRelationshipId = Brand<string, 'ChatRelationshipId'>;
export type ChatOfferId = Brand<string, 'ChatOfferId'>;
export type ChatInterventionId = Brand<string, 'ChatInterventionId'>;
export type ChatTypingToken = Brand<string, 'ChatTypingToken'>;
export type ChatEnvelopeId = Brand<string, 'ChatEnvelopeId'>;
export type ChatCursorId = Brand<string, 'ChatCursorId'>;
export type ChatSequenceNumber = Brand<number, 'ChatSequenceNumber'>;
export type ChatCausalEdgeId = Brand<string, 'ChatCausalEdgeId'>;

export interface ChatVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ChatRange {
  readonly start: number;
  readonly end: number;
}

// ============================================================================
// MARK: Generic vocab from adjacent engines
// ============================================================================

export const CHAT_PRESSURE_TIERS = [
  'CALM',
  'WATCHFUL',
  'PRESSURED',
  'CRITICAL',
  'BREAKPOINT',
] as const;

export type ChatPressureTier = (typeof CHAT_PRESSURE_TIERS)[number];

export const CHAT_TICK_TIERS = [
  'EARLY',
  'MID',
  'LATE',
  'SUDDEN_DEATH',
] as const;

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

export const CHAT_CASCADE_SEVERITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type ChatCascadeSeverity = (typeof CHAT_CASCADE_SEVERITIES)[number];

export const CHAT_SHIELD_LAYER_IDS = [
  'L1',
  'L2',
  'L3',
  'L4',
  'L5',
] as const;

export type ChatShieldLayerId = (typeof CHAT_SHIELD_LAYER_IDS)[number];

// ============================================================================
// MARK: Actor, sender, and authority identities
// ============================================================================

export const CHAT_ACTOR_KINDS = [
  'PLAYER',
  'NPC',
  'HELPER',
  'HATER',
  'SYSTEM',
  'SERVER',
  'BACKEND',
  'LIVEOPS',
] as const;

export type ChatActorKind = (typeof CHAT_ACTOR_KINDS)[number];

export const CHAT_SENDER_ROLES = [
  'PLAYER',
  'ALLY',
  'RIVAL',
  'HELPER',
  'NARRATOR',
  'MARKET',
  'SYSTEM',
  'MODERATOR',
] as const;

export type ChatSenderRole = (typeof CHAT_SENDER_ROLES)[number];

export const CHAT_AUTHORITIES = [
  'CLIENT_STAGED',
  'SERVER_ACCEPTED',
  'BACKEND_AUTHORITATIVE',
  'BACKEND_LEDGER',
] as const;

export type ChatAuthority = (typeof CHAT_AUTHORITIES)[number];

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
// MARK: Message kinds, delivery, moderation, and notification kinds
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

export type ChatNotificationKind =
  (typeof CHAT_NOTIFICATION_KINDS)[number];

export interface ChatModerationDecision {
  readonly state: ChatModerationState;
  readonly reasonCode?:
    | 'TOXICITY'
    | 'SPAM'
    | 'RATE_LIMIT'
    | 'POLICY_BLOCK'
    | 'HIDDEN_SHADOW'
    | 'EMPTY';
  readonly displayText?: string;
  readonly playerVisible: boolean;
}

// ============================================================================
// MARK: Presence, typing, cursor, and read receipt contracts
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
  readonly delayReason?:
    | 'PRESENCE_THEATER'
    | 'NEGOTIATION_PRESSURE'
    | 'NPC_LATENCY';
}

// ============================================================================
// MARK: Proof, replay, legend, audit, and message meta
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

// ============================================================================
// MARK: Memory, relationship, offer, and continuity contracts
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

// ============================================================================
// MARK: Drama, reveal, silence, rescue, and audience heat contracts
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
  readonly untilAt: UnixMs;
  readonly channelId: ChatChannelId;
}

export interface ChatRescueDecision {
  readonly interventionId: ChatInterventionId;
  readonly helperPersonaId: string;
  readonly channelId: ChatChannelId;
  readonly interventionKind:
    | 'SOFT_PROMPT'
    | 'DIRECTIVE'
    | 'RECOVERY_ROUTE'
    | 'LOWER_PRESSURE_MODE';
  readonly createdAt: UnixMs;
  readonly urgency: Score100;
}

export interface ChatAudienceHeat {
  readonly channelId: ChatVisibleChannel;
  readonly heatScore: Score100;
  readonly swarmMomentum: Score100;
  readonly witnessDensity: Score100;
  readonly ridiculeBias: Score100;
  readonly hypeBias: Score100;
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
  readonly changedAt: UnixMs;
}

export interface ChatReputationState {
  readonly publicReputation: Score100;
  readonly syndicateReputation: Score100;
  readonly negotiationReputation: Score100;
  readonly intimidationAura: Score100;
  readonly trustAura: Score100;
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: LiveOps, emotion, telemetry, and learning contracts
// ============================================================================

export interface ChatWorldEventDescriptor {
  readonly worldEventId: ChatWorldEventId;
  readonly code: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly startsAt: UnixMs;
  readonly endsAt?: UnixMs;
  readonly affectedChannels: readonly ChatChannelId[];
  readonly overlayStyle: 'BANNER' | 'STRIP' | 'FULL_WIDTH' | 'SILENT';
  readonly intensity: Score100;
  readonly copySeed: string;
}

export interface ChatLiveOpsState {
  readonly activeWorldEvents: readonly ChatWorldEventDescriptor[];
  readonly suppressedHelperChannels: readonly ChatChannelId[];
  readonly boostedCrowdChannels: readonly ChatChannelId[];
  readonly globalMoodOverride?: ChatChannelMood['mood'];
}

export interface ChatEmotionVector {
  readonly intimidation: Score100;
  readonly confidence: Score100;
  readonly frustration: Score100;
  readonly curiosity: Score100;
  readonly attachment: Score100;
  readonly embarrassment: Score100;
  readonly relief: Score100;
  readonly dominance: Score100;
  readonly desperation: Score100;
  readonly trust: Score100;
}

export interface ChatAffectSnapshot {
  readonly vector: ChatEmotionVector;
  readonly lastUpdatedAt: UnixMs;
  readonly dominantEmotion:
    | 'INTIMIDATION'
    | 'CONFIDENCE'
    | 'FRUSTRATION'
    | 'CURIOSITY'
    | 'ATTACHMENT'
    | 'EMBARRASSMENT'
    | 'RELIEF'
    | 'DOMINANCE'
    | 'DESPERATION'
    | 'TRUST';
  readonly confidenceSwingDelta: number;
}

export const CHAT_TELEMETRY_EVENTS = [
  'chat_opened',
  'chat_closed',
  'channel_changed',
  'message_composed',
  'message_sent',
  'message_failed',
  'message_received',
  'presence_seen',
  'typing_seen',
  'scene_started',
  'scene_completed',
  'rescue_prompted',
  'negotiation_offer_seen',
  'legend_moment_seen',
  'world_event_seen',
] as const;

export type ChatTelemetryEventName =
  (typeof CHAT_TELEMETRY_EVENTS)[number];

export interface ChatTelemetryEnvelope {
  readonly telemetryId: ChatTelemetryId;
  readonly eventName: ChatTelemetryEventName;
  readonly occurredAt: UnixMs;
  readonly sessionId?: ChatSessionId;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly payload: JsonObject;
}

export interface ChatDropOffSignals {
  readonly longSilenceAfterCollapse: boolean;
  readonly repeatedFailedInputs: boolean;
  readonly negativeSignalSpike: boolean;
  readonly rapidPanelOpenClose: boolean;
  readonly aggressiveChannelHopping: boolean;
}

export interface ChatFeatureSnapshot {
  readonly createdAt: UnixMs;
  readonly mountTarget: ChatMountTarget;
  readonly activeChannel: ChatChannelId;
  readonly panelOpen: boolean;
  readonly unreadCount: number;
  readonly composerLength: number;
  readonly silenceWindowMs: number;
  readonly visibleMessageCount: number;
  readonly pressureTier?: ChatPressureTier;
  readonly tickTier?: ChatTickTier;
  readonly haterHeat?: number;
  readonly affect: ChatAffectSnapshot;
  readonly dropOffSignals: ChatDropOffSignals;
}

export interface ChatColdStartProfile {
  readonly version: string;
  readonly createdAt: UnixMs;
  readonly playerId?: ChatUserId;
  readonly helperFrequencyBias: Score01;
  readonly haterAggressionBias: Score01;
  readonly negotiationRiskBias: Score01;
  readonly crowdHeatTolerance: Score01;
  readonly prefersLowerPressureOpenings: boolean;
}

export interface ChatLearningProfile {
  readonly profileId: string;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly playerId?: ChatUserId;
  readonly coldStart: ChatColdStartProfile;
  readonly channelAffinity: Readonly<Record<ChatVisibleChannel, Score100>>;
  readonly helperTrustByPersona: Readonly<Record<string, Score100>>;
  readonly haterTargetingByPersona: Readonly<Record<string, Score100>>;
  readonly emotionBaseline: ChatEmotionVector;
  readonly lastTopMemoryAnchors: readonly ChatMemoryAnchorId[];
}

export interface ChatResponseCandidate {
  readonly candidateId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly text: string;
  readonly rankingFeatures: JsonObject;
  readonly score?: number;
}

export interface ChatResponseRankingRequest {
  readonly requestId: ChatRequestId;
  readonly createdAt: UnixMs;
  readonly sceneId?: ChatSceneId;
  readonly channelId: ChatChannelId;
  readonly featureSnapshot: ChatFeatureSnapshot;
  readonly candidateCount: number;
  readonly candidates: readonly ChatResponseCandidate[];
  readonly retrievedAnchors: readonly ChatMemoryAnchor[];
}

export interface ChatInferenceSnapshot {
  readonly requestId: ChatRequestId;
  readonly completedAt: UnixMs;
  readonly selectedCandidateId?: string;
  readonly rankingLatencyMs?: number;
  readonly helperShouldIntervene: boolean;
  readonly haterShouldEscalate: boolean;
  readonly recommendChannelShift?: ChatVisibleChannel;
  readonly retrievalAnchorIds: readonly ChatMemoryAnchorId[];
}

// ============================================================================
// MARK: Upstream engine signals
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

export type ChatUpstreamSignalType =
  (typeof CHAT_UPSTREAM_SIGNAL_TYPES)[number];

export interface ChatUpstreamSignalBase {
  readonly signalType: ChatUpstreamSignalType;
  readonly emittedAt: UnixMs;
  readonly tickNumber?: TickNumber;
}

export interface ChatPressureTierChangedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'PRESSURE_TIER_CHANGED';
  readonly nextTier: ChatPressureTier;
  readonly score?: number;
}

export interface ChatTickTierChangedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'TICK_TIER_CHANGED';
  readonly nextTier: ChatTickTier;
}

export interface ChatShieldBreachedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'SHIELD_LAYER_BREACHED';
  readonly layerId: ChatShieldLayerId;
  readonly integrityAfter: number;
}

export interface ChatBotAttackSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'BOT_ATTACK_FIRED';
  readonly botId: string;
  readonly attackType: ChatAttackType;
  readonly targetLayerId?: ChatShieldLayerId;
}

export interface ChatCascadeSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'CASCADE_CHAIN_STARTED' | 'CASCADE_CHAIN_BROKEN';
  readonly chainId: string;
  readonly severity?: ChatCascadeSeverity;
}

export type ChatUpstreamSignal =
  | ChatPressureTierChangedSignal
  | ChatTickTierChangedSignal
  | ChatShieldBreachedSignal
  | ChatBotAttackSignal
  | ChatCascadeSignal
  | ChatUpstreamSignalBase;

// ============================================================================
// MARK: Legacy compatibility surfaces
// ============================================================================

export interface GameChatContext {
  readonly tick: number;
  readonly cash: number;
  readonly regime: string;
  readonly events: readonly string[];
  readonly netWorth: number;
  readonly income: number;
  readonly expenses: number;
  readonly pressureTier?: ChatPressureTier;
  readonly tickTier?: ChatTickTier;
  readonly haterHeat?: number;
}

export type SabotageCardType =
  | 'EMERGENCY_EXPENSE'
  | 'INCOME_SEIZURE'
  | 'DEBT_SPIRAL'
  | 'INSPECTION_NOTICE'
  | 'MARKET_CORRECTION'
  | 'TAX_AUDIT'
  | 'LAYOFF_EVENT'
  | 'RENT_HIKE'
  | 'CREDIT_DOWNGRADE'
  | 'SYSTEM_GLITCH';

export interface SabotageEvent {
  readonly haterId: string;
  readonly cardType: SabotageCardType;
  readonly intensity: number;
  readonly haterName: string;
  readonly botId?: string;
  readonly attackType?: ChatAttackType;
  readonly targetLayer?: ChatShieldLayerId;
}

export interface LegacyChatPanelCompat {
  readonly maxMessages: number;
  readonly visibleChannel: ChatVisibleChannel;
  readonly showBotBadges: boolean;
  readonly showProofHashes: boolean;
  readonly showPressureBadges: boolean;
  readonly showTickBadges: boolean;
}

// ============================================================================
// MARK: Core message contract
// ============================================================================

export interface ChatMessage {
  readonly id: ChatMessageId;
  readonly channel: ChatVisibleChannel;
  readonly kind: ChatMessageKind;
  readonly senderId: string;
  readonly senderName: string;
  readonly senderRank?: string;
  readonly body: string;
  readonly emoji?: string;
  readonly ts: number;
  readonly immutable?: boolean;
  readonly proofHash?: string;

  readonly sender?: ChatSenderIdentity;
  readonly deliveryState?: ChatDeliveryState;
  readonly moderation?: ChatModerationDecision;
  readonly proof?: ChatProofMeta;
  readonly replay?: ChatReplayMeta;
  readonly legend?: ChatLegendMeta;
  readonly audit?: ChatAuditMeta;
  readonly meta?: ChatMessageMeta;

  readonly botSource?: BotTauntSource;
  readonly shieldMeta?: ShieldEventMeta;
  readonly cascadeMeta?: CascadeAlertMeta;
  readonly pressureTier?: ChatPressureTier;
  readonly tickTier?: ChatTickTier;
  readonly runOutcome?: ChatRunOutcome;

  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly relationshipIds?: readonly ChatRelationshipId[];
  readonly quoteIds?: readonly ChatQuoteId[];
  readonly readReceipts?: readonly ChatReadReceipt[];
  readonly tags?: readonly string[];
}

// ============================================================================
// MARK: Composer, notification, connection, room, and engine state contracts
// ============================================================================

export interface ChatComposerState {
  readonly activeChannel: ChatVisibleChannel;
  readonly draftByChannel: Readonly<Record<ChatVisibleChannel, string>>;
  readonly disabled: boolean;
  readonly disabledReason?: string;
  readonly maxLength: number;
  readonly lastEditedAt?: UnixMs;
}

export interface ChatNotificationState {
  readonly unreadByChannel: Readonly<Record<ChatVisibleChannel, number>>;
  readonly notificationKinds: readonly ChatNotificationKind[];
  readonly hasAnyUnread: boolean;
  readonly lastNotifiedAt?: UnixMs;
}

export interface ChatRoomMembership {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly joinedAt: UnixMs;
  readonly isAuthoritative: boolean;
}

export interface ChatConnectionState {
  readonly status:
    | 'IDLE'
    | 'CONNECTING'
    | 'CONNECTED'
    | 'RECONNECTING'
    | 'ERROR';
  readonly sessionId?: ChatSessionId;
  readonly latencyMs?: number;
  readonly retryCount: number;
  readonly lastError?: string;
}

export interface ChatEngineState {
  readonly version: string;
  readonly connection: ChatConnectionState;
  readonly activeMountTarget: ChatMountTarget;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly memberships: readonly ChatRoomMembership[];
  readonly messagesByChannel: Readonly<
    Record<ChatVisibleChannel, readonly ChatMessage[]>
  >;
  readonly shadowMessageCountByChannel: Readonly<
    Record<ChatShadowChannel, number>
  >;
  readonly composer: ChatComposerState;
  readonly notifications: ChatNotificationState;
  readonly presenceByActorId: Readonly<Record<string, ChatPresenceSnapshot>>;
  readonly typingByActorId: Readonly<Record<string, ChatTypingSnapshot>>;
  readonly activeScene?: ChatScenePlan;
  readonly pendingReveals: readonly ChatRevealSchedule[];
  readonly currentSilence?: ChatSilenceDecision;
  readonly audienceHeat: Readonly<Record<ChatVisibleChannel, ChatAudienceHeat>>;
  readonly channelMoodByChannel: Readonly<Record<ChatChannelId, ChatChannelMood>>;
  readonly reputation: ChatReputationState;
  readonly affect: ChatAffectSnapshot;
  readonly liveOps: ChatLiveOpsState;
  readonly relationshipsByCounterpartId: Readonly<
    Record<string, ChatRelationshipState>
  >;
  readonly offerState?: ChatNegotiationState;
  readonly learningProfile?: ChatLearningProfile;
  readonly continuity: ChatContinuityState;
  readonly lastAuthoritativeSyncAt?: UnixMs;
}

// ============================================================================
// MARK: Transport client requests and authoritative frames
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

export type ChatEngineEventName =
  (typeof CHAT_ENGINE_EVENT_NAMES)[number];

export interface ChatEngineEventPayloadMap {
  CHAT_ENGINE_BOOTSTRAPPED: {
    readonly version: string;
    readonly mountTarget: ChatMountTarget;
    readonly at: UnixMs;
  };
  CHAT_ENGINE_CONNECTED: {
    readonly sessionId: ChatSessionId;
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
    readonly messageId: ChatMessageId;
    readonly authoritativeFrame?: ChatAuthoritativeFrame;
  };
  CHAT_MESSAGE_REJECTED: {
    readonly requestId?: ChatRequestId;
    readonly reason: string;
  };
  CHAT_MESSAGE_RECEIVED: {
    readonly message: ChatMessage;
  };
  CHAT_SCENE_STARTED: {
    readonly scene: ChatScenePlan;
  };
  CHAT_SCENE_COMPLETED: {
    readonly sceneId: ChatSceneId;
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
    readonly endedAt: UnixMs;
  };
  CHAT_RESCUE_TRIGGERED: {
    readonly rescue: ChatRescueDecision;
  };
  CHAT_NEGOTIATION_UPDATED: {
    readonly negotiation: ChatNegotiationState;
  };
  CHAT_WORLD_EVENT_UPDATED: {
    readonly liveOps: ChatLiveOpsState;
  };
  CHAT_PROFILE_UPDATED: {
    readonly profile: ChatLearningProfile;
  };
}

export interface ChatEngineEvent<
  TName extends ChatEngineEventName = ChatEngineEventName,
> {
  readonly name: TName;
  readonly payload: ChatEngineEventPayloadMap[TName];
  readonly emittedAt: UnixMs;
}

// ============================================================================
// MARK: Server transport event names and payload maps
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
    readonly membership: ChatRoomMembership;
  };
  CHAT_ROOM_LEFT: {
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
    readonly leftAt: UnixMs;
  };
  CHAT_MESSAGE_ACK: {
    readonly requestId: ChatRequestId;
    readonly messageId?: ChatMessageId;
    readonly deliveryState: ChatDeliveryState;
    readonly authoritativeFrame?: ChatAuthoritativeFrame;
  };
  CHAT_MESSAGE_PUBLISHED: {
    readonly message: ChatMessage;
    readonly frame?: ChatAuthoritativeFrame;
  };
  CHAT_MESSAGE_REJECTED: {
    readonly requestId?: ChatRequestId;
    readonly reason: string;
  };
  CHAT_PRESENCE_UPDATED: {
    readonly presence: readonly ChatPresenceSnapshot[];
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
  };
  CHAT_TYPING_UPDATED: {
    readonly typing: readonly ChatTypingSnapshot[];
    readonly roomId: ChatRoomId;
    readonly channelId: ChatChannelId;
  };
  CHAT_CURSOR_UPDATED: {
    readonly cursor: ChatCursorSnapshot;
  };
  CHAT_READ_MARKED: {
    readonly receipt: ChatReadReceipt;
  };
  CHAT_REPLAY_SNAPSHOT: ChatReplayWindowSnapshot;
  CHAT_SYNC_FRAME: ChatAuthoritativeFrame;
  CHAT_WORLD_EVENT_FRAME: {
    readonly liveOps: ChatLiveOpsState;
    readonly emittedAt: UnixMs;
  };
  CHAT_ERROR: {
    readonly code: string;
    readonly message: string;
    readonly requestId?: ChatRequestId;
    readonly retryable: boolean;
  };
}

// ============================================================================
// MARK: Canonical transport envelopes
// ============================================================================

export interface ChatTransportEnvelopeBase {
  readonly envelopeId: ChatEnvelopeId;
  readonly emittedAt: UnixMs;
  readonly requestId?: ChatRequestId;
  readonly sessionId?: ChatSessionId;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly actor?: ChatActorLocator;
  readonly sequenceNumber?: ChatSequenceNumber;
  readonly causalParentEnvelopeId?: ChatEnvelopeId;
  readonly authority: ChatAuthority;
  readonly featureSnapshot?: ChatFeatureSnapshot;
}

export interface ChatTransportInboundEnvelope<
  TName extends ChatTransportInboundEventName = ChatTransportInboundEventName,
> extends ChatTransportEnvelopeBase {
  readonly direction: 'INBOUND';
  readonly eventName: TName;
  readonly payload: ChatTransportInboundPayloadMap[TName];
}

export interface ChatTransportOutboundEnvelope<
  TName extends ChatTransportOutboundEventName = ChatTransportOutboundEventName,
> extends ChatTransportEnvelopeBase {
  readonly direction: 'OUTBOUND';
  readonly eventName: TName;
  readonly payload: ChatTransportOutboundPayloadMap[TName];
}

export type ChatTransportEnvelope =
  | ChatTransportInboundEnvelope
  | ChatTransportOutboundEnvelope;

// ============================================================================
// MARK: Bridge API contracts
// ============================================================================

export interface ChatEventBridgeApi {
  emit<TName extends ChatEngineEventName>(
    event: ChatEngineEvent<TName>,
  ): void;
  receiveAuthoritativeFrame(frame: ChatAuthoritativeFrame): void;
  mapUpstreamSignal(signal: ChatUpstreamSignal): readonly ChatEngineEvent[];
}

export interface ChatSocketBridgeApi {
  send<TName extends ChatTransportInboundEventName>(
    envelope: ChatTransportInboundEnvelope<TName>,
  ): void;
  receive<TName extends ChatTransportOutboundEventName>(
    envelope: ChatTransportOutboundEnvelope<TName>,
  ): void;
}

export interface ChatReplayBridgeApi {
  requestReplay(request: ChatReplayWindowRequest): void;
  ingestReplay(snapshot: ChatReplayWindowSnapshot): void;
}

// ============================================================================
// MARK: Runtime helpers and guards
// ============================================================================

const INBOUND_EVENT_SET = new Set<string>(CHAT_TRANSPORT_INBOUND_EVENT_NAMES);
const OUTBOUND_EVENT_SET = new Set<string>(CHAT_TRANSPORT_OUTBOUND_EVENT_NAMES);
const ENGINE_EVENT_SET = new Set<string>(CHAT_ENGINE_EVENT_NAMES);
const MESSAGE_KIND_SET = new Set<string>(CHAT_MESSAGE_KINDS);
const TELEMETRY_EVENT_SET = new Set<string>(CHAT_TELEMETRY_EVENTS);
const UPSTREAM_SIGNAL_SET = new Set<string>(CHAT_UPSTREAM_SIGNAL_TYPES);

export function isChatTransportInboundEventName(
  value: string,
): value is ChatTransportInboundEventName {
  return INBOUND_EVENT_SET.has(value);
}

export function isChatTransportOutboundEventName(
  value: string,
): value is ChatTransportOutboundEventName {
  return OUTBOUND_EVENT_SET.has(value);
}

export function isChatEngineEventName(
  value: string,
): value is ChatEngineEventName {
  return ENGINE_EVENT_SET.has(value);
}

export function isChatMessageKind(value: string): value is ChatMessageKind {
  return MESSAGE_KIND_SET.has(value);
}

export function isChatTelemetryEventName(
  value: string,
): value is ChatTelemetryEventName {
  return TELEMETRY_EVENT_SET.has(value);
}

export function isChatUpstreamSignalType(
  value: string,
): value is ChatUpstreamSignalType {
  return UPSTREAM_SIGNAL_SET.has(value);
}

export function isInboundEnvelope(
  envelope: ChatTransportEnvelope,
): envelope is ChatTransportInboundEnvelope {
  return envelope.direction === 'INBOUND';
}

export function isOutboundEnvelope(
  envelope: ChatTransportEnvelope,
): envelope is ChatTransportOutboundEnvelope {
  return envelope.direction === 'OUTBOUND';
}

export function createInboundEnvelope<
  TName extends ChatTransportInboundEventName,
>(
  args: Omit<ChatTransportInboundEnvelope<TName>, 'direction'>,
): ChatTransportInboundEnvelope<TName> {
  return {
    ...args,
    direction: 'INBOUND',
  };
}

export function createOutboundEnvelope<
  TName extends ChatTransportOutboundEventName,
>(
  args: Omit<ChatTransportOutboundEnvelope<TName>, 'direction'>,
): ChatTransportOutboundEnvelope<TName> {
  return {
    ...args,
    direction: 'OUTBOUND',
  };
}

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
    eventName === 'CHAT_MESSAGE_RECEIVED' ||
    eventName === 'CHAT_MESSAGE_REJECTED'
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

export function authoritativeFrameHasMessages(
  frame: ChatAuthoritativeFrame,
): boolean {
  return Array.isArray(frame.messages) && frame.messages.length > 0;
}

export function authoritativeFrameHasPresence(
  frame: ChatAuthoritativeFrame,
): boolean {
  return Array.isArray(frame.presence) && frame.presence.length > 0;
}

export function authoritativeFrameHasTyping(
  frame: ChatAuthoritativeFrame,
): boolean {
  return Array.isArray(frame.typing) && frame.typing.length > 0;
}

// ============================================================================
// MARK: Default constants and stable readonly package
// ============================================================================

export const CHAT_EVENT_CONSTANTS = Object.freeze({
  version: CHAT_CONTRACT_VERSION,
  apiVersion: '1.0.0-alpha',
  maxComposerLength: 600,
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
  transportInboundEventNames: CHAT_TRANSPORT_INBOUND_EVENT_NAMES,
  transportOutboundEventNames: CHAT_TRANSPORT_OUTBOUND_EVENT_NAMES,
  upstreamSignalTypes: CHAT_UPSTREAM_SIGNAL_TYPES,
} as const);

export default CHAT_EVENT_CONTRACT;

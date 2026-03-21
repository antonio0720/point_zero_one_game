
/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT MESSAGE CONTRACTS
 * FILE: shared/contracts/chat/ChatMessage.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared message contract surface for the unified chat system.
 *
 * This file becomes the message authority shared by:
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /pzo-web/src/components/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Message contracts must preserve the visible/shadow split already active
 *    in the live frontend donor lane.
 * 2. Message contracts must be safe to import from frontend, backend, and
 *    transport without pulling runtime engine code.
 * 3. The backend will own transcript truth, but the shared lane must fully
 *    describe the canonical message shape consumed by every runtime.
 * 4. Message metadata must be strong enough to support proof chains, replay,
 *    presence theater, relationship memory, negotiation pressure, liveops,
 *    rescue logic, and ML/DL learning without inventing one-off side channels.
 * 5. Client optimism may stage message drafts, but delivery, moderation, and
 *    authority transitions must remain explicit in the contract.
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelDescriptor,
  type ChatChannelFamily,
  type ChatChannelId,
  type ChatModeScope,
  type ChatMountPreset,
  type ChatMountTarget,
  type ChatRoomId,
  type JsonObject,
  type JsonValue,
  type Nullable,
  type Optional,
  type Score01,
  type Score100,
  type UnixMs,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_MOUNT_PRESETS,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatCausalEdgeId,
  type ChatInterventionId,
  type ChatLegendId,
  type ChatMemoryAnchorId,
  type ChatMessageId,
  type ChatNpcId,
  type ChatOfferId,
  type ChatProofHash,
  type ChatQuoteId,
  type ChatReplayId,
  type ChatRange,
  type ChatRequestId,
  type ChatSequenceNumber,
  type ChatSessionId,
  type ChatTelemetryId,
  type ChatUserId,
  type ChatWorldEventId,
} from './ChatChannels';

import {
  type ChatAuthority,
  type ChatDeliveryState,
  type ChatMessageKind,
  type ChatModerationDecision,
  type ChatModerationState,
  type ChatNotificationKind,
  type ChatSenderIdentity,
  CHAT_AUTHORITIES,
  CHAT_DELIVERY_STATES,
  CHAT_MESSAGE_KINDS,
  CHAT_MODERATION_STATES,
  CHAT_NOTIFICATION_KINDS,
} from './ChatEvents';

// ============================================================================
// MARK: Branded identifiers local to message contracts
// ============================================================================

export type ChatThreadId = Brand<string, 'ChatThreadId'>;
export type ChatAttachmentId = Brand<string, 'ChatAttachmentId'>;
export type ChatEmbedId = Brand<string, 'ChatEmbedId'>;
export type ChatReactionId = Brand<string, 'ChatReactionId'>;
export type ChatReceiptId = Brand<string, 'ChatReceiptId'>;
export type ChatDraftId = Brand<string, 'ChatDraftId'>;
export type ChatExcerptId = Brand<string, 'ChatExcerptId'>;
export type ChatTemplateId = Brand<string, 'ChatTemplateId'>;
export type ChatRenderToken = Brand<string, 'ChatRenderToken'>;
export type ChatMessageVersion = Brand<number, 'ChatMessageVersion'>;

// ============================================================================
// MARK: Core vocabularies
// ============================================================================

export const CHAT_MESSAGE_VISIBILITY_CLASSES = [
  'PUBLIC',
  'ROOM_ONLY',
  'SYNDICATE_ONLY',
  'NEGOTIATION_ONLY',
  'LOBBY_ONLY',
  'SHADOW_ONLY',
  'AUTHOR_ONLY',
  'SYSTEM_ONLY',
] as const;

export type ChatMessageVisibilityClass =
  (typeof CHAT_MESSAGE_VISIBILITY_CLASSES)[number];

export const CHAT_MESSAGE_BODY_FORMATS = [
  'PLAIN_TEXT',
  'RICH_TEXT',
  'SYSTEM_TEMPLATE',
  'QUOTE',
  'COMMAND',
  'EMBED',
  'RITUAL',
  'NEGOTIATION',
] as const;

export type ChatMessageBodyFormat =
  (typeof CHAT_MESSAGE_BODY_FORMATS)[number];

export const CHAT_MESSAGE_PROOF_STATES = [
  'NONE',
  'PENDING',
  'ATTACHED',
  'CHAINED',
  'REDACTED',
] as const;

export type ChatMessageProofState =
  (typeof CHAT_MESSAGE_PROOF_STATES)[number];

export const CHAT_MESSAGE_ACK_POLICIES = [
  'NONE',
  'SERVER_ACCEPT',
  'BACKEND_AUTHORITATIVE',
  'READ_RECEIPT',
] as const;

export type ChatMessageAckPolicy =
  (typeof CHAT_MESSAGE_ACK_POLICIES)[number];

export const CHAT_MESSAGE_THREAD_SEMANTICS = [
  'LINEAR',
  'REPLY',
  'SCENE',
  'RITUAL',
  'NEGOTIATION',
  'WORLD_EVENT',
] as const;

export type ChatMessageThreadSemantic =
  (typeof CHAT_MESSAGE_THREAD_SEMANTICS)[number];

export const CHAT_MESSAGE_TONE_BANDS = [
  'NEUTRAL',
  'HOSTILE',
  'PREDATORY',
  'HELPFUL',
  'CEREMONIAL',
  'ALERTING',
  'MOURNFUL',
  'TRIUMPHANT',
] as const;

export type ChatMessageToneBand =
  (typeof CHAT_MESSAGE_TONE_BANDS)[number];

export const CHAT_MESSAGE_RENDER_DENSITIES = [
  'COMPACT',
  'STANDARD',
  'EXPANDED',
  'CINEMATIC',
] as const;

export type ChatMessageRenderDensity =
  (typeof CHAT_MESSAGE_RENDER_DENSITIES)[number];

export const CHAT_MESSAGE_ORIGIN_SURFACES = [
  'COMPOSER',
  'NPC_DIRECTOR',
  'HATER_ORCHESTRATOR',
  'HELPER_ORCHESTRATOR',
  'INVASION_DIRECTOR',
  'EVENT_BRIDGE',
  'TELEMETRY_REPLAY',
  'LIVEOPS_DIRECTOR',
  'POST_RUN_NARRATIVE',
  'NEGOTIATION_ENGINE',
] as const;

export type ChatMessageOriginSurface =
  (typeof CHAT_MESSAGE_ORIGIN_SURFACES)[number];

export const CHAT_ATTACHMENT_KINDS = [
  'PROOF_CARD',
  'THREAT_CARD',
  'MOMENT_FLASH',
  'REPLAY_LINK',
  'NEGOTIATION_OFFER',
  'LEGEND_TOKEN',
  'WORLD_EVENT_CARD',
  'SYSTEM_PANEL',
  'QUOTE_SNAPSHOT',
  'EMBED_FRAME',
] as const;

export type ChatAttachmentKind = (typeof CHAT_ATTACHMENT_KINDS)[number];

export const CHAT_EMBED_KINDS = [
  'PRESSURE',
  'SHIELD',
  'CASCADE',
  'NEGOTIATION',
  'AUDIENCE_HEAT',
  'RELATIONSHIP',
  'WORLD_EVENT',
  'LEGEND',
  'RESCUE',
  'COMBAT_TELEGRAPH',
] as const;

export type ChatEmbedKind = (typeof CHAT_EMBED_KINDS)[number];

export const CHAT_REACTION_KINDS = [
  'ACK',
  'CHEER',
  'FEAR',
  'TAUNT',
  'WARN',
  'QUOTE',
  'ECHO',
  'READ',
] as const;

export type ChatReactionKind = (typeof CHAT_REACTION_KINDS)[number];

export const CHAT_MENTION_KINDS = [
  'PLAYER',
  'NPC',
  'CHANNEL',
  'ROLE',
  'SYSTEM',
] as const;

export type ChatMentionKind = (typeof CHAT_MENTION_KINDS)[number];

export const CHAT_CAUSAL_RELATION_KINDS = [
  'REPLY_TO',
  'QUOTES',
  'TRIGGERED_BY',
  'SUPPRESSES',
  'RESCUES',
  'TELEGRAPHS',
  'ESCALATES',
  'CONCLUDES',
] as const;

export type ChatCausalRelationKind =
  (typeof CHAT_CAUSAL_RELATION_KINDS)[number];

export const CHAT_RECEIPT_STATES = [
  'UNSEEN',
  'DELIVERED',
  'SEEN',
  'READ',
  'ACKNOWLEDGED',
] as const;

export type ChatReceiptState = (typeof CHAT_RECEIPT_STATES)[number];

export const CHAT_PAYLOAD_CLASSES = [
  'PLAIN',
  'SYSTEM',
  'ALERT',
  'NEGOTIATION',
  'HELPER',
  'HATER',
  'AMBIENT',
  'LEGEND',
  'WORLD_EVENT',
  'POST_RUN',
] as const;

export type ChatPayloadClass = (typeof CHAT_PAYLOAD_CLASSES)[number];

// ============================================================================
// MARK: Body segments and rich body shape
// ============================================================================

export interface ChatTextSegment {
  readonly segmentType: 'TEXT';
  readonly text: string;
}

export interface ChatMentionSegment {
  readonly segmentType: 'MENTION';
  readonly mentionKind: ChatMentionKind;
  readonly entityId: string;
  readonly displayText: string;
}

export interface ChatEmojiSegment {
  readonly segmentType: 'EMOJI';
  readonly shortcode: string;
  readonly fallbackText: string;
}

export interface ChatVariableSegment {
  readonly segmentType: 'VARIABLE';
  readonly variableKey: string;
  readonly fallbackText: string;
}

export interface ChatLineBreakSegment {
  readonly segmentType: 'LINE_BREAK';
}

export interface ChatRedactionSegment {
  readonly segmentType: 'REDACTION';
  readonly reason:
    | 'MODERATION'
    | 'SHADOW_ONLY'
    | 'PLAYER_PRIVACY'
    | 'SYSTEM_REWRITE';
  readonly visibleText: string;
}

export type ChatMessageBodySegment =
  | ChatTextSegment
  | ChatMentionSegment
  | ChatEmojiSegment
  | ChatVariableSegment
  | ChatLineBreakSegment
  | ChatRedactionSegment;

export interface ChatMessageBody {
  readonly format: ChatMessageBodyFormat;
  readonly plainText: string;
  readonly normalizedText: string;
  readonly excerpt: string;
  readonly segments: readonly ChatMessageBodySegment[];
  readonly locale?: string;
  readonly containsSensitiveValues: boolean;
  readonly containsCommands: boolean;
  readonly containsLinks: boolean;
  readonly estimatedReadMs: number;
  readonly tokenCountHint?: number;
}

// ============================================================================
// MARK: Attachments, embeds, and excerpt surfaces
// ============================================================================

export interface ChatAttachmentBase {
  readonly attachmentId: ChatAttachmentId;
  readonly attachmentKind: ChatAttachmentKind;
  readonly title: string;
  readonly subtitle?: string;
  readonly summary?: string;
  readonly accentTone?: ChatMessageToneBand;
  readonly renderDensity?: ChatMessageRenderDensity;
  readonly playerVisible: boolean;
}

export interface ChatProofCardAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'PROOF_CARD';
  readonly proofHash: ChatProofHash;
  readonly proofLabel: string;
  readonly proofTier?: string;
}

export interface ChatThreatCardAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'THREAT_CARD';
  readonly threatLevel01: Score01;
  readonly pressureBand?: string;
  readonly attackClass?: string;
}

export interface ChatMomentFlashAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'MOMENT_FLASH';
  readonly flashLabel: string;
  readonly flashMomentAt: UnixMs;
  readonly momentId?: string;
}

export interface ChatReplayLinkAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'REPLAY_LINK';
  readonly replayId: ChatReplayId;
  readonly replayTimestampMs?: number;
  readonly replayAnchorLabel?: string;
}

export interface ChatNegotiationOfferAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'NEGOTIATION_OFFER';
  readonly offerId: ChatOfferId;
  readonly offerSummary: string;
  readonly urgency01?: Score01;
}

export interface ChatLegendTokenAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'LEGEND_TOKEN';
  readonly legendId: ChatLegendId;
  readonly rewardLabel?: string;
}

export interface ChatWorldEventCardAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'WORLD_EVENT_CARD';
  readonly worldEventId: ChatWorldEventId;
  readonly stageLabel?: string;
}

export interface ChatSystemPanelAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'SYSTEM_PANEL';
  readonly panelKey: string;
  readonly panelRoute?: string;
}

export interface ChatQuoteSnapshotAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'QUOTE_SNAPSHOT';
  readonly quoteId: ChatQuoteId;
  readonly quotedExcerpt: string;
}

export interface ChatEmbedFrameAttachment extends ChatAttachmentBase {
  readonly attachmentKind: 'EMBED_FRAME';
  readonly embedId: ChatEmbedId;
  readonly embedKind: ChatEmbedKind;
}

export type ChatAttachment =
  | ChatProofCardAttachment
  | ChatThreatCardAttachment
  | ChatMomentFlashAttachment
  | ChatReplayLinkAttachment
  | ChatNegotiationOfferAttachment
  | ChatLegendTokenAttachment
  | ChatWorldEventCardAttachment
  | ChatSystemPanelAttachment
  | ChatQuoteSnapshotAttachment
  | ChatEmbedFrameAttachment;

export interface ChatEmbedBase {
  readonly embedId: ChatEmbedId;
  readonly embedKind: ChatEmbedKind;
  readonly title: string;
  readonly playerVisible: boolean;
}

export interface ChatPressureEmbed extends ChatEmbedBase {
  readonly embedKind: 'PRESSURE';
  readonly pressureTier: string;
  readonly score01: Score01;
}

export interface ChatShieldEmbed extends ChatEmbedBase {
  readonly embedKind: 'SHIELD';
  readonly activeLayerId?: string;
  readonly integrity01: Score01;
}

export interface ChatCascadeEmbed extends ChatEmbedBase {
  readonly embedKind: 'CASCADE';
  readonly severity: string;
  readonly spreadCount?: number;
}

export interface ChatNegotiationEmbed extends ChatEmbedBase {
  readonly embedKind: 'NEGOTIATION';
  readonly offerId?: ChatOfferId;
  readonly leverage01?: Score01;
  readonly bluffRisk01?: Score01;
}

export interface ChatAudienceHeatEmbed extends ChatEmbedBase {
  readonly embedKind: 'AUDIENCE_HEAT';
  readonly crowdHeat01: Score01;
  readonly crowdVelocity01?: Score01;
}

export interface ChatRelationshipEmbed extends ChatEmbedBase {
  readonly embedKind: 'RELATIONSHIP';
  readonly relationshipId: string;
  readonly trust01?: Score01;
  readonly rivalry01?: Score01;
}

export interface ChatWorldEventEmbed extends ChatEmbedBase {
  readonly embedKind: 'WORLD_EVENT';
  readonly worldEventId: ChatWorldEventId;
  readonly stage: string;
}

export interface ChatLegendEmbed extends ChatEmbedBase {
  readonly embedKind: 'LEGEND';
  readonly legendId: ChatLegendId;
  readonly rewardLabel?: string;
}

export interface ChatRescueEmbed extends ChatEmbedBase {
  readonly embedKind: 'RESCUE';
  readonly interventionId: ChatInterventionId;
  readonly recoveryChance01?: Score01;
}

export interface ChatCombatTelegraphEmbed extends ChatEmbedBase {
  readonly embedKind: 'COMBAT_TELEGRAPH';
  readonly attackClass?: string;
  readonly counterWindowMs?: number;
}

export type ChatEmbed =
  | ChatPressureEmbed
  | ChatShieldEmbed
  | ChatCascadeEmbed
  | ChatNegotiationEmbed
  | ChatAudienceHeatEmbed
  | ChatRelationshipEmbed
  | ChatWorldEventEmbed
  | ChatLegendEmbed
  | ChatRescueEmbed
  | ChatCombatTelegraphEmbed;

// ============================================================================
// MARK: Quotes, replies, threading, and causality
// ============================================================================

export interface ChatQuoteReference {
  readonly quoteId: ChatQuoteId;
  readonly quotedMessageId: ChatMessageId;
  readonly quotedSenderName: string;
  readonly quotedExcerpt: string;
  readonly quotedAt?: UnixMs;
}

export interface ChatReplyReference {
  readonly replyToMessageId: ChatMessageId;
  readonly replyToSenderId?: string;
  readonly replyToKind?: ChatMessageKind;
}

export interface ChatThreadReference {
  readonly threadId: ChatThreadId;
  readonly semantic: ChatMessageThreadSemantic;
  readonly rootMessageId?: ChatMessageId;
  readonly parentMessageId?: ChatMessageId;
  readonly sceneId?: string;
  readonly sceneTurnIndex?: number;
}

export interface ChatCausalEdge {
  readonly edgeId: ChatCausalEdgeId;
  readonly relation: ChatCausalRelationKind;
  readonly fromMessageId: ChatMessageId;
  readonly toMessageId?: ChatMessageId;
  readonly toEventId?: string;
  readonly playerVisible: boolean;
}

// ============================================================================
// MARK: Authority, sequencing, moderation, delivery, and proof
// ============================================================================

export interface ChatMessageAuthorityStamp {
  readonly currentAuthority: ChatAuthority;
  readonly acceptedBy?: 'CLIENT' | 'SERVER' | 'BACKEND';
  readonly authoritativeAt?: UnixMs;
  readonly authoritativeBySessionId?: ChatSessionId;
  readonly requestId?: ChatRequestId;
}

export interface ChatMessageSequenceStamp {
  readonly roomId: ChatRoomId;
  readonly sequenceNumber: ChatSequenceNumber;
  readonly localOrderHint?: number;
  readonly causalOrderHint?: number;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly version: ChatMessageVersion;
}

export interface ChatMessageModerationEnvelope {
  readonly decision: ChatModerationDecision;
  readonly moderatedAt?: UnixMs;
  readonly moderatedByAuthority?: ChatAuthority;
  readonly visibleTextOverride?: string;
  readonly redactionMask?: string;
}

export interface ChatMessageDeliveryEnvelope {
  readonly state: ChatDeliveryState;
  readonly ackPolicy: ChatMessageAckPolicy;
  readonly stagedLocallyAt?: UnixMs;
  readonly sentAt?: UnixMs;
  readonly acknowledgedAt?: UnixMs;
  readonly failedAt?: UnixMs;
  readonly failureReasonCode?:
    | 'TRANSPORT'
    | 'AUTH'
    | 'RATE_LIMIT'
    | 'POLICY'
    | 'VALIDATION'
    | 'UNKNOWN';
  readonly transportAttempts: number;
}

export interface ChatMessageProofEnvelope {
  readonly proofState: ChatMessageProofState;
  readonly proofHash?: ChatProofHash;
  readonly parentProofHash?: ChatProofHash;
  readonly replayId?: ChatReplayId;
  readonly replayOffsetMs?: number;
  readonly anchorIds?: readonly ChatMemoryAnchorId[];
  readonly causalEdges?: readonly ChatCausalEdge[];
}

export interface ChatMessageReadReceipt {
  readonly receiptId: ChatReceiptId;
  readonly messageId: ChatMessageId;
  readonly readerId: string;
  readonly readerKind: ChatActorKind;
  readonly state: ChatReceiptState;
  readonly updatedAt: UnixMs;
  readonly visibleToSender: boolean;
}

export interface ChatMessageReaction {
  readonly reactionId: ChatReactionId;
  readonly messageId: ChatMessageId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly reactionKind: ChatReactionKind;
  readonly createdAt: UnixMs;
}

export interface ChatMessageAuditEntry {
  readonly at: UnixMs;
  readonly authority: ChatAuthority;
  readonly action:
    | 'CREATED'
    | 'STAGED'
    | 'SENT'
    | 'ACKNOWLEDGED'
    | 'AUTHORIZED'
    | 'MODERATED'
    | 'REDACTED'
    | 'FAILED';
  readonly note?: string;
}

// ============================================================================
// MARK: Specialized metadata blocks
// ============================================================================

export interface ChatMessageNpcMetadata {
  readonly npcId?: ChatNpcId;
  readonly personaKey?: string;
  readonly voiceprintKey?: string;
  readonly delayProfileKey?: string;
  readonly relationshipAnchorId?: string;
  readonly simulatedTypingTheater?: boolean;
}

export interface ChatMessageNegotiationMetadata {
  readonly offerId?: ChatOfferId;
  readonly leverage01?: Score01;
  readonly bluffRisk01?: Score01;
  readonly urgency01?: Score01;
  readonly predictedCounterStyle?: 'STALL' | 'PRESS' | 'BLUFF' | 'WALK';
}

export interface ChatMessageLegendMetadata {
  readonly legendId?: ChatLegendId;
  readonly isLegendCandidate: boolean;
  readonly rewardLabels?: readonly string[];
}

export interface ChatMessageRescueMetadata {
  readonly interventionId?: ChatInterventionId;
  readonly rescueTone?: 'BLUNT' | 'CALM' | 'DIRECTIVE' | 'QUIET';
  readonly churnRisk01?: Score01;
}

export interface ChatMessageWorldEventMetadata {
  readonly worldEventId?: ChatWorldEventId;
  readonly stageLabel?: string;
  readonly globallyVisible?: boolean;
}

export interface ChatMessageCombatMetadata {
  readonly attackClass?: string;
  readonly telegraphWindowMs?: number;
  readonly counterable: boolean;
  readonly attackIntensity01?: Score01;
}

export interface ChatMessageRelationshipMetadata {
  readonly trustDelta?: number;
  readonly rivalryDelta?: number;
  readonly familiarityDelta?: number;
  readonly callbackMemoryAnchorId?: ChatMemoryAnchorId;
}

export interface ChatMessageAudienceHeatSnapshot {
  readonly crowdHeat01?: Score01;
  readonly crowdVelocity01?: Score01;
  readonly embarrassment01?: Score01;
  readonly dominance01?: Score01;
}

export interface ChatMessagePersistenceHints {
  readonly channelFamily: ChatChannelFamily;
  readonly roomScoped: boolean;
  readonly accountScoped: boolean;
  readonly replayEligible: boolean;
  readonly trainingEligible: boolean;
}

// ============================================================================
// MARK: Payloads by message kind
// ============================================================================

export interface ChatPayloadBase {
  readonly payloadClass: ChatPayloadClass;
  readonly summary: string;
}

export interface PlayerMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'PLAIN';
  readonly kind: 'PLAYER';
  readonly playerId?: ChatUserId;
}

export interface SystemMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'SYSTEM';
  readonly kind: 'SYSTEM';
  readonly systemKey: string;
}

export interface MarketAlertMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'ALERT';
  readonly kind: 'MARKET_ALERT';
  readonly marketLabel?: string;
  readonly pressureShift?: string;
}

export interface AchievementMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'ALERT';
  readonly kind: 'ACHIEVEMENT';
  readonly achievementKey?: string;
}

export interface BotTauntMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'HATER';
  readonly kind: 'BOT_TAUNT';
  readonly tauntClass?: string;
}

export interface BotAttackMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'HATER';
  readonly kind: 'BOT_ATTACK';
  readonly attackClass?: string;
}

export interface ShieldEventMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'ALERT';
  readonly kind: 'SHIELD_EVENT';
  readonly shieldLabel?: string;
  readonly integrity01?: Score01;
}

export interface CascadeAlertMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'ALERT';
  readonly kind: 'CASCADE_ALERT';
  readonly severity?: string;
}

export interface DealRecapMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'NEGOTIATION';
  readonly kind: 'DEAL_RECAP';
  readonly dealLabel?: string;
}

export interface NpcAmbientMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'AMBIENT';
  readonly kind: 'NPC_AMBIENT';
  readonly atmosphereKey?: string;
}

export interface HelperPromptMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'HELPER';
  readonly kind: 'HELPER_PROMPT';
  readonly helperKey?: string;
}

export interface HelperRescueMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'HELPER';
  readonly kind: 'HELPER_RESCUE';
  readonly interventionId?: ChatInterventionId;
}

export interface HaterTelegraphMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'HATER';
  readonly kind: 'HATER_TELEGRAPH';
  readonly telegraphClass?: string;
}

export interface HaterPunishMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'HATER';
  readonly kind: 'HATER_PUNISH';
  readonly punishClass?: string;
}

export interface CrowdReactionMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'ALERT';
  readonly kind: 'CROWD_REACTION';
  readonly crowdMood?: string;
}

export interface RelationshipCallbackMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'HELPER';
  readonly kind: 'RELATIONSHIP_CALLBACK';
  readonly relationshipKey?: string;
}

export interface QuoteCallbackMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'HELPER';
  readonly kind: 'QUOTE_CALLBACK';
  readonly quoteId?: ChatQuoteId;
}

export interface NegotiationOfferMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'NEGOTIATION';
  readonly kind: 'NEGOTIATION_OFFER';
  readonly offerId?: ChatOfferId;
}

export interface NegotiationCounterMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'NEGOTIATION';
  readonly kind: 'NEGOTIATION_COUNTER';
  readonly offerId?: ChatOfferId;
}

export interface LegendMomentMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'LEGEND';
  readonly kind: 'LEGEND_MOMENT';
  readonly legendId?: ChatLegendId;
}

export interface PostRunRitualMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'POST_RUN';
  readonly kind: 'POST_RUN_RITUAL';
  readonly ritualStyle?: string;
}

export interface WorldEventMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'WORLD_EVENT';
  readonly kind: 'WORLD_EVENT';
  readonly worldEventId?: ChatWorldEventId;
}

export interface SystemShadowMarkerMessagePayload extends ChatPayloadBase {
  readonly payloadClass: 'SYSTEM';
  readonly kind: 'SYSTEM_SHADOW_MARKER';
  readonly markerKey?: string;
}

export type ChatMessagePayload =
  | PlayerMessagePayload
  | SystemMessagePayload
  | MarketAlertMessagePayload
  | AchievementMessagePayload
  | BotTauntMessagePayload
  | BotAttackMessagePayload
  | ShieldEventMessagePayload
  | CascadeAlertMessagePayload
  | DealRecapMessagePayload
  | NpcAmbientMessagePayload
  | HelperPromptMessagePayload
  | HelperRescueMessagePayload
  | HaterTelegraphMessagePayload
  | HaterPunishMessagePayload
  | CrowdReactionMessagePayload
  | RelationshipCallbackMessagePayload
  | QuoteCallbackMessagePayload
  | NegotiationOfferMessagePayload
  | NegotiationCounterMessagePayload
  | LegendMomentMessagePayload
  | PostRunRitualMessagePayload
  | WorldEventMessagePayload
  | SystemShadowMarkerMessagePayload;

// ============================================================================
// MARK: Canonical message contract
// ============================================================================

export interface ChatMessageVisibilityPolicy {
  readonly visibilityClass: ChatMessageVisibilityClass;
  readonly playerVisible: boolean;
  readonly visibleChannels: readonly ChatChannelId[];
  readonly hiddenChannels?: readonly ChatChannelId[];
  readonly authorOnly: boolean;
  readonly readReceiptsEnabled: boolean;
  readonly reactionsEnabled: boolean;
  readonly notificationsEnabled: boolean;
}

export interface ChatMessageOrigin {
  readonly originSurface: ChatMessageOriginSurface;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
  readonly channelDescriptor?: ChatChannelDescriptor;
  readonly mountPreset?: ChatMountPreset;
}

export interface ChatCanonicalMessage {
  readonly messageId: ChatMessageId;
  readonly kind: ChatMessageKind;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly sender: ChatSenderIdentity;
  readonly body: ChatMessageBody;
  readonly payload: ChatMessagePayload;
  readonly origin: ChatMessageOrigin;
  readonly authorityStamp: ChatMessageAuthorityStamp;
  readonly sequenceStamp: ChatMessageSequenceStamp;
  readonly visibilityPolicy: ChatMessageVisibilityPolicy;
  readonly moderation: ChatMessageModerationEnvelope;
  readonly delivery: ChatMessageDeliveryEnvelope;
  readonly proof: ChatMessageProofEnvelope;
  readonly thread?: ChatThreadReference;
  readonly quote?: ChatQuoteReference;
  readonly reply?: ChatReplyReference;
  readonly npc?: ChatMessageNpcMetadata;
  readonly negotiation?: ChatMessageNegotiationMetadata;
  readonly legend?: ChatMessageLegendMetadata;
  readonly rescue?: ChatMessageRescueMetadata;
  readonly worldEvent?: ChatMessageWorldEventMetadata;
  readonly combat?: ChatMessageCombatMetadata;
  readonly relationship?: ChatMessageRelationshipMetadata;
  readonly audienceHeat?: ChatMessageAudienceHeatSnapshot;
  readonly attachments: readonly ChatAttachment[];
  readonly embeds: readonly ChatEmbed[];
  readonly receipts: readonly ChatMessageReadReceipt[];
  readonly reactions: readonly ChatMessageReaction[];
  readonly notifications: readonly ChatNotificationKind[];
  readonly persistence: ChatMessagePersistenceHints;
  readonly auditTrail: readonly ChatMessageAuditEntry[];
  readonly renderHint: ChatMessageRenderDensity;
  readonly toneBand: ChatMessageToneBand;
  readonly tags?: readonly string[];
  readonly customData?: JsonObject;
}

// ============================================================================
// MARK: Draft and transport shapes
// ============================================================================

export interface ChatMessageDraft {
  readonly draftId: ChatDraftId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly authorSessionId?: ChatSessionId;
  readonly authorUserId?: ChatUserId;
  readonly body: ChatMessageBody;
  readonly requestedKind?: ChatMessageKind;
  readonly replyToMessageId?: ChatMessageId;
  readonly quoteMessageId?: ChatMessageId;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly clientRenderToken?: ChatRenderToken;
}

export interface ChatTransportMessageEnvelope {
  readonly envelopeType: 'CHAT_MESSAGE';
  readonly schemaVersion: typeof CHAT_CONTRACT_VERSION;
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly message: ChatCanonicalMessage;
}

// ============================================================================
// MARK: Constructors
// ============================================================================

export function createTextBody(text: string): ChatMessageBody {
  const plainText = normalizeChatMessageText(text);
  return {
    format: 'PLAIN_TEXT',
    plainText,
    normalizedText: plainText,
    excerpt: createChatExcerpt(plainText),
    segments: plainText.length
      ? [{ segmentType: 'TEXT', text: plainText }]
      : [],
    containsSensitiveValues: false,
    containsCommands: plainText.startsWith('/'),
    containsLinks: /https?:\/\//i.test(plainText),
    estimatedReadMs: estimateChatReadMs(plainText),
  };
}

export function createDefaultVisibilityPolicy(
  channelId: ChatChannelId,
  kind: ChatMessageKind,
): ChatMessageVisibilityPolicy {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];
  const isShadowFamily = descriptor.family === 'SHADOW';
  const visibleChannels: ChatChannelId[] = isShadowFamily ? [] : [channelId];
  return {
    visibilityClass: deriveVisibilityClass(channelId),
    playerVisible: !isShadowFamily && kind !== 'SYSTEM_SHADOW_MARKER',
    visibleChannels,
    hiddenChannels: isShadowFamily ? [channelId] : undefined,
    authorOnly: false,
    readReceiptsEnabled: descriptor.supportsReadReceipts,
    reactionsEnabled: descriptor.visibleToPlayer,
    notificationsEnabled: descriptor.visibleToPlayer,
  };
}

export function createMessageAuthorityStamp(
  authority: ChatAuthority,
  requestId?: ChatRequestId,
  authoritativeAt?: UnixMs,
): ChatMessageAuthorityStamp {
  return {
    currentAuthority: authority,
    acceptedBy:
      authority === 'CLIENT_STAGED'
        ? 'CLIENT'
        : authority === 'SERVER_ACCEPTED'
          ? 'SERVER'
          : 'BACKEND',
    authoritativeAt,
    requestId,
  };
}

export function createMessageDeliveryEnvelope(
  state: ChatDeliveryState,
): ChatMessageDeliveryEnvelope {
  return {
    state,
    ackPolicy:
      state === 'AUTHORITATIVE'
        ? 'BACKEND_AUTHORITATIVE'
        : state === 'ACKNOWLEDGED'
          ? 'SERVER_ACCEPT'
          : 'NONE',
    transportAttempts: state === 'FAILED' ? 1 : 0,
  };
}

export function createCanonicalMessage(args: {
  messageId: ChatMessageId;
  roomId: ChatRoomId;
  channelId: ChatChannelId;
  sender: ChatSenderIdentity;
  body: ChatMessageBody;
  kind: ChatMessageKind;
  payload: ChatMessagePayload;
  sequenceNumber: ChatSequenceNumber;
  createdAt: UnixMs;
  updatedAt?: UnixMs;
  authority?: ChatAuthority;
  deliveryState?: ChatDeliveryState;
  mountTarget?: ChatMountTarget;
  modeScope?: ChatModeScope;
}): ChatCanonicalMessage {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[args.channelId];
  const authority = args.authority ?? 'BACKEND_AUTHORITATIVE';
  const deliveryState = args.deliveryState ?? 'AUTHORITATIVE';
  const createdAt = args.createdAt;
  const updatedAt = args.updatedAt ?? args.createdAt;

  return {
    messageId: args.messageId,
    kind: args.kind,
    roomId: args.roomId,
    channelId: args.channelId,
    sender: args.sender,
    body: args.body,
    payload: args.payload,
    origin: {
      originSurface: inferOriginSurfaceFromKind(args.kind),
      mountTarget: args.mountTarget,
      modeScope: args.modeScope,
      channelDescriptor: descriptor,
      mountPreset: args.mountTarget
        ? CHAT_MOUNT_PRESETS[args.mountTarget]
        : undefined,
    },
    authorityStamp: createMessageAuthorityStamp(
      authority,
      undefined,
      authority === 'BACKEND_AUTHORITATIVE' ? updatedAt : undefined,
    ),
    sequenceStamp: {
      roomId: args.roomId,
      sequenceNumber: args.sequenceNumber,
      createdAt,
      updatedAt,
      version: 1 as ChatMessageVersion,
    },
    visibilityPolicy: createDefaultVisibilityPolicy(
      args.channelId,
      args.kind,
    ),
    moderation: {
      decision: {
        state: 'ALLOWED',
        playerVisible: true,
      },
    },
    delivery: createMessageDeliveryEnvelope(deliveryState),
    proof: {
      proofState: 'NONE',
    },
    attachments: [],
    embeds: [],
    receipts: [],
    reactions: [],
    notifications: deriveNotificationsForKind(args.kind),
    persistence: {
      channelFamily: descriptor.family,
      roomScoped: descriptor.persistenceClass === 'RUN_SCOPED',
      accountScoped: descriptor.persistenceClass === 'ACCOUNT_SCOPED',
      replayEligible: descriptor.supportsReplay,
      trainingEligible: true,
    },
    auditTrail: [
      {
        at: createdAt,
        authority,
        action:
          authority === 'CLIENT_STAGED'
            ? 'STAGED'
            : authority === 'SERVER_ACCEPTED'
              ? 'SENT'
              : 'AUTHORIZED',
      },
    ],
    renderHint: deriveRenderDensityForKind(args.kind),
    toneBand: deriveToneBandForKind(args.kind),
  };
}

// ============================================================================
// MARK: Normalization and derivation helpers
// ============================================================================

export function normalizeChatMessageText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function createChatExcerpt(
  text: string,
  maxLength: number = 140,
): string {
  const normalized = normalizeChatMessageText(text);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function estimateChatReadMs(text: string): number {
  const words = normalizeChatMessageText(text).split(/\s+/).filter(Boolean)
    .length;
  return Math.max(900, words * 240);
}

export function deriveVisibilityClass(
  channelId: ChatChannelId,
): ChatMessageVisibilityClass {
  switch (channelId) {
    case 'GLOBAL':
      return 'PUBLIC';
    case 'SYNDICATE':
      return 'SYNDICATE_ONLY';
    case 'DEAL_ROOM':
      return 'NEGOTIATION_ONLY';
    case 'LOBBY':
      return 'LOBBY_ONLY';
    default:
      return 'SHADOW_ONLY';
  }
}

export function inferOriginSurfaceFromKind(
  kind: ChatMessageKind,
): ChatMessageOriginSurface {
  switch (kind) {
    case 'PLAYER':
      return 'COMPOSER';
    case 'HELPER_PROMPT':
    case 'HELPER_RESCUE':
    case 'RELATIONSHIP_CALLBACK':
    case 'QUOTE_CALLBACK':
      return 'HELPER_ORCHESTRATOR';
    case 'BOT_TAUNT':
    case 'BOT_ATTACK':
    case 'HATER_TELEGRAPH':
    case 'HATER_PUNISH':
      return 'HATER_ORCHESTRATOR';
    case 'WORLD_EVENT':
      return 'LIVEOPS_DIRECTOR';
    case 'POST_RUN_RITUAL':
      return 'POST_RUN_NARRATIVE';
    case 'NEGOTIATION_OFFER':
    case 'NEGOTIATION_COUNTER':
    case 'DEAL_RECAP':
      return 'NEGOTIATION_ENGINE';
    default:
      return 'EVENT_BRIDGE';
  }
}

export function deriveRenderDensityForKind(
  kind: ChatMessageKind,
): ChatMessageRenderDensity {
  switch (kind) {
    case 'LEGEND_MOMENT':
    case 'WORLD_EVENT':
    case 'POST_RUN_RITUAL':
      return 'CINEMATIC';
    case 'NEGOTIATION_OFFER':
    case 'NEGOTIATION_COUNTER':
    case 'HELPER_RESCUE':
      return 'EXPANDED';
    case 'SYSTEM':
    case 'MARKET_ALERT':
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
      return 'STANDARD';
    default:
      return 'COMPACT';
  }
}

export function deriveToneBandForKind(
  kind: ChatMessageKind,
): ChatMessageToneBand {
  switch (kind) {
    case 'BOT_TAUNT':
    case 'BOT_ATTACK':
    case 'HATER_TELEGRAPH':
    case 'HATER_PUNISH':
      return 'HOSTILE';
    case 'NEGOTIATION_OFFER':
    case 'NEGOTIATION_COUNTER':
      return 'PREDATORY';
    case 'HELPER_PROMPT':
    case 'HELPER_RESCUE':
    case 'RELATIONSHIP_CALLBACK':
      return 'HELPFUL';
    case 'LEGEND_MOMENT':
      return 'TRIUMPHANT';
    case 'POST_RUN_RITUAL':
      return 'MOURNFUL';
    case 'WORLD_EVENT':
    case 'MARKET_ALERT':
    case 'CASCADE_ALERT':
    case 'SHIELD_EVENT':
      return 'ALERTING';
    default:
      return 'NEUTRAL';
  }
}

export function deriveNotificationsForKind(
  kind: ChatMessageKind,
): ChatNotificationKind[] {
  switch (kind) {
    case 'HELPER_RESCUE':
      return ['HELPER_RESCUE'];
    case 'BOT_ATTACK':
    case 'HATER_PUNISH':
      return ['HATER_ATTACK', 'DIRECT_PRESSURE'];
    case 'NEGOTIATION_OFFER':
    case 'NEGOTIATION_COUNTER':
      return ['NEGOTIATION_URGENCY'];
    case 'LEGEND_MOMENT':
      return ['LEGEND_MOMENT'];
    case 'WORLD_EVENT':
      return ['WORLD_EVENT'];
    default:
      return ['UNREAD'];
  }
}

// ============================================================================
// MARK: Type guards
// ============================================================================

export function isChatMessageVisibilityClass(
  value: string,
): value is ChatMessageVisibilityClass {
  return (CHAT_MESSAGE_VISIBILITY_CLASSES as readonly string[]).includes(value);
}

export function isChatMessageBodyFormat(
  value: string,
): value is ChatMessageBodyFormat {
  return (CHAT_MESSAGE_BODY_FORMATS as readonly string[]).includes(value);
}

export function isChatMessageProofState(
  value: string,
): value is ChatMessageProofState {
  return (CHAT_MESSAGE_PROOF_STATES as readonly string[]).includes(value);
}

export function isChatAttachmentKind(
  value: string,
): value is ChatAttachmentKind {
  return (CHAT_ATTACHMENT_KINDS as readonly string[]).includes(value);
}

export function isChatEmbedKind(value: string): value is ChatEmbedKind {
  return (CHAT_EMBED_KINDS as readonly string[]).includes(value);
}

export function isChatReactionKind(
  value: string,
): value is ChatReactionKind {
  return (CHAT_REACTION_KINDS as readonly string[]).includes(value);
}

export function isChatCanonicalMessage(
  value: unknown,
): value is ChatCanonicalMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ChatCanonicalMessage>;
  return (
    typeof candidate.messageId === 'string' &&
    typeof candidate.roomId === 'string' &&
    typeof candidate.channelId === 'string' &&
    !!candidate.sender &&
    !!candidate.body &&
    !!candidate.sequenceStamp &&
    typeof candidate.kind === 'string'
  );
}

// ============================================================================
// MARK: Validation
// ============================================================================

export interface ChatMessageValidationIssue {
  readonly code:
    | 'MISSING_ID'
    | 'MISSING_ROOM'
    | 'MISSING_CHANNEL'
    | 'INVALID_KIND'
    | 'INVALID_BODY'
    | 'INVALID_SENDER'
    | 'INVALID_DELIVERY'
    | 'INVALID_MODERATION'
    | 'INVALID_VISIBILITY'
    | 'SHADOW_VISIBILITY_MISMATCH'
    | 'PUBLIC_NOTIFICATION_MISMATCH';
  readonly field: string;
  readonly detail: string;
}

export interface ChatMessageValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ChatMessageValidationIssue[];
}

export function validateChatCanonicalMessage(
  message: ChatCanonicalMessage,
): ChatMessageValidationResult {
  const issues: ChatMessageValidationIssue[] = [];

  if (!message.messageId) {
    issues.push({
      code: 'MISSING_ID',
      field: 'messageId',
      detail: 'Message id is required.',
    });
  }

  if (!message.roomId) {
    issues.push({
      code: 'MISSING_ROOM',
      field: 'roomId',
      detail: 'Room id is required.',
    });
  }

  if (!message.channelId) {
    issues.push({
      code: 'MISSING_CHANNEL',
      field: 'channelId',
      detail: 'Channel id is required.',
    });
  }

  if (!(CHAT_MESSAGE_KINDS as readonly string[]).includes(message.kind)) {
    issues.push({
      code: 'INVALID_KIND',
      field: 'kind',
      detail: `Unknown kind: ${String(message.kind)}`,
    });
  }

  if (!message.body || !message.body.normalizedText) {
    issues.push({
      code: 'INVALID_BODY',
      field: 'body',
      detail: 'Body and normalized text are required.',
    });
  }

  if (!message.sender || !message.sender.senderId || !message.sender.senderName) {
    issues.push({
      code: 'INVALID_SENDER',
      field: 'sender',
      detail: 'Sender identity is incomplete.',
    });
  }

  if (!(CHAT_DELIVERY_STATES as readonly string[]).includes(message.delivery.state)) {
    issues.push({
      code: 'INVALID_DELIVERY',
      field: 'delivery.state',
      detail: `Invalid delivery state: ${String(message.delivery.state)}`,
    });
  }

  if (
    !(CHAT_MODERATION_STATES as readonly string[]).includes(
      message.moderation.decision.state,
    )
  ) {
    issues.push({
      code: 'INVALID_MODERATION',
      field: 'moderation.decision.state',
      detail: `Invalid moderation state: ${String(message.moderation.decision.state)}`,
    });
  }

  if (!isChatMessageVisibilityClass(message.visibilityPolicy.visibilityClass)) {
    issues.push({
      code: 'INVALID_VISIBILITY',
      field: 'visibilityPolicy.visibilityClass',
      detail: 'Visibility class is invalid.',
    });
  }

  const descriptor = CHAT_CHANNEL_DESCRIPTORS[message.channelId];
  const isShadowChannel = descriptor.family === 'SHADOW';
  if (isShadowChannel && message.visibilityPolicy.playerVisible) {
    issues.push({
      code: 'SHADOW_VISIBILITY_MISMATCH',
      field: 'visibilityPolicy.playerVisible',
      detail: 'Shadow channel messages must not be player visible by default.',
    });
  }

  if (
    descriptor.visibleToPlayer &&
    message.visibilityPolicy.notificationsEnabled &&
    !message.notifications.length
  ) {
    issues.push({
      code: 'PUBLIC_NOTIFICATION_MISMATCH',
      field: 'notifications',
      detail: 'Visible player messages should carry at least one notification kind.',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function assertValidChatCanonicalMessage(
  message: ChatCanonicalMessage,
): void {
  const result = validateChatCanonicalMessage(message);
  if (!result.valid) {
    const reason = result.issues
      .map((issue) => `${issue.field}: ${issue.detail}`)
      .join(' | ');
    throw new Error(`Invalid ChatCanonicalMessage: ${reason}`);
  }
}

// ============================================================================
// MARK: Fanout and render policy helpers
// ============================================================================

export function canViewerSeeMessage(args: {
  message: ChatCanonicalMessage;
  viewerActorId?: string;
  viewerChannelId?: ChatChannelId;
  includeShadow?: boolean;
}): boolean {
  const { message, viewerActorId, viewerChannelId, includeShadow = false } =
    args;

  if (
    message.visibilityPolicy.visibilityClass === 'AUTHOR_ONLY' &&
    viewerActorId !== message.sender.senderId
  ) {
    return false;
  }

  if (
    message.visibilityPolicy.visibilityClass === 'SHADOW_ONLY' &&
    !includeShadow
  ) {
    return false;
  }

  if (
    viewerChannelId &&
    message.visibilityPolicy.visibleChannels.length > 0 &&
    !message.visibilityPolicy.visibleChannels.includes(viewerChannelId)
  ) {
    return false;
  }

  return message.visibilityPolicy.playerVisible || includeShadow;
}

export function shouldFanoutMessageToChannel(
  message: ChatCanonicalMessage,
  channelId: ChatChannelId,
): boolean {
  if (message.visibilityPolicy.visibleChannels.includes(channelId)) {
    return true;
  }

  if (
    message.visibilityPolicy.hiddenChannels &&
    message.visibilityPolicy.hiddenChannels.includes(channelId)
  ) {
    return true;
  }

  return false;
}

export function isAuthoritativeMessage(
  message: ChatCanonicalMessage,
): boolean {
  return message.authorityStamp.currentAuthority === 'BACKEND_AUTHORITATIVE';
}

export function isShadowOnlyMessage(
  message: ChatCanonicalMessage,
): boolean {
  return message.visibilityPolicy.visibilityClass === 'SHADOW_ONLY';
}

export function cloneMessageWithModeration(
  message: ChatCanonicalMessage,
  decision: ChatModerationDecision,
): ChatCanonicalMessage {
  return {
    ...message,
    moderation: {
      ...message.moderation,
      decision,
      moderatedAt: message.sequenceStamp.updatedAt,
      moderatedByAuthority: message.authorityStamp.currentAuthority,
      visibleTextOverride: decision.displayText,
    },
  };
}

export function appendAuditEntry(
  message: ChatCanonicalMessage,
  entry: ChatMessageAuditEntry,
): ChatCanonicalMessage {
  return {
    ...message,
    auditTrail: [...message.auditTrail, entry],
  };
}

// ============================================================================
// MARK: Transport envelope validation
// ============================================================================

export function createTransportEnvelope(
  message: ChatCanonicalMessage,
): ChatTransportMessageEnvelope {
  return {
    envelopeType: 'CHAT_MESSAGE',
    schemaVersion: CHAT_CONTRACT_VERSION,
    authorities: CHAT_CONTRACT_AUTHORITIES,
    message,
  };
}

export function isChatTransportMessageEnvelope(
  value: unknown,
): value is ChatTransportMessageEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ChatTransportMessageEnvelope>;
  return (
    candidate.envelopeType === 'CHAT_MESSAGE' &&
    typeof candidate.schemaVersion === 'string' &&
    !!candidate.message &&
    isChatCanonicalMessage(candidate.message)
  );
}

// ============================================================================
// MARK: Export collections
// ============================================================================

export const CHAT_MESSAGE_EXPORTS = Object.freeze({
  versions: {
    contractVersion: CHAT_CONTRACT_VERSION,
    authorities: CHAT_CONTRACT_AUTHORITIES,
  },
  vocabularies: {
    messageKinds: CHAT_MESSAGE_KINDS,
    visibilityClasses: CHAT_MESSAGE_VISIBILITY_CLASSES,
    bodyFormats: CHAT_MESSAGE_BODY_FORMATS,
    proofStates: CHAT_MESSAGE_PROOF_STATES,
    ackPolicies: CHAT_MESSAGE_ACK_POLICIES,
    threadSemantics: CHAT_MESSAGE_THREAD_SEMANTICS,
    toneBands: CHAT_MESSAGE_TONE_BANDS,
    renderDensities: CHAT_MESSAGE_RENDER_DENSITIES,
    originSurfaces: CHAT_MESSAGE_ORIGIN_SURFACES,
    attachmentKinds: CHAT_ATTACHMENT_KINDS,
    embedKinds: CHAT_EMBED_KINDS,
    reactionKinds: CHAT_REACTION_KINDS,
    mentionKinds: CHAT_MENTION_KINDS,
    causalRelations: CHAT_CAUSAL_RELATION_KINDS,
    receiptStates: CHAT_RECEIPT_STATES,
    payloadClasses: CHAT_PAYLOAD_CLASSES,
    authorities: CHAT_AUTHORITIES,
    deliveryStates: CHAT_DELIVERY_STATES,
    moderationStates: CHAT_MODERATION_STATES,
    notificationKinds: CHAT_NOTIFICATION_KINDS,
  },
});

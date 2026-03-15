/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT CHANNEL CONTRACTS
 * FILE: shared/contracts/chat/ChatChannels.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical channel, mount, scope, role, and runtime placement law for the
 * unified chat system.
 *
 * This merged version intentionally takes the strongest parts from both prior
 * drafts:
 *   1. the richer room/audit/presence-theater semantics,
 *   2. the cleaner runtime-facing exports used by ChatEvents.ts,
 *   3. explicit mount presets for the cross-screen pzo-web runtime,
 *   4. deterministic helper utilities for frontend, backend, and transport.
 *
 * Design doctrine
 * ---------------
 * 1. Shared contracts own identifiers and law, never runtime side effects.
 * 2. Visible and shadow channels are both first-class, never debug leftovers.
 * 3. Channel capability is explicit. No implicit behavior by string name.
 * 4. Mount targets choose presentation defaults, not final backend authority.
 * 5. Role and scope permissions must converge across frontend, backend, and
 *    transport before any transcript mutation occurs.
 * 6. Legacy aliases are normalized here so donor lanes can be frozen without
 *    breaking migration shims.
 *
 * Canonical authority roots
 * -------------------------
 * - /shared/contracts/chat
 * - /pzo-web/src/engines/chat
 * - /pzo-web/src/components/chat
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

// ============================================================================
// MARK: Generic utility types
// ============================================================================

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type UnixMs = Brand<number, 'UnixMs'>;
export type TickNumber = Brand<number, 'TickNumber'>;
export type Percentage = Brand<number, 'Percentage'>;
export type Score01 = Brand<number, 'Score01'>;
export type Score100 = Brand<number, 'Score100'>;

export type ChatMessageId = Brand<string, 'ChatMessageId'>;
export type ChatRoomId = Brand<string, 'ChatRoomId'>;
export type ChatSessionId = Brand<string, 'ChatSessionId'>;
export type ChatUserId = Brand<string, 'ChatUserId'>;
export type ChatNpcId = Brand<string, 'ChatNpcId'>;
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
export type ChatCursorId = Brand<string, 'ChatCursorId'>;
export type ChatEnvelopeId = Brand<string, 'ChatEnvelopeId'>;
export type ChatSequenceNumber = Brand<number, 'ChatSequenceNumber'>;
export type ChatCausalEdgeId = Brand<string, 'ChatCausalEdgeId'>;
export type ChatTopicName = Brand<string, 'ChatTopicName'>;
export type ChatNamespace = Brand<string, 'ChatNamespace'>;
export type ChatModeScopeId = Brand<string, 'ChatModeScopeId'>;
export type ChatMountKey = Brand<string, 'ChatMountKey'>;
export type ChatRouteKey = Brand<string, 'ChatRouteKey'>;
export type ChatPolicyTag = Brand<string, 'ChatPolicyTag'>;

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type JsonArray = readonly JsonValue[];

export interface ChatRange {
  readonly start: number;
  readonly end: number;
}

export interface ChatVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type ChatDensity = 'COMPACT' | 'STANDARD' | 'EXPANDED';
export type ChatUiTreatment = 'PRIMARY' | 'SECONDARY' | 'SHADOW' | 'CEREMONIAL';

// ============================================================================
// MARK: Versions and canonical authority roots
// ============================================================================

export const CHAT_CONTRACT_VERSION = '2026.03.15' as const;
export const CHAT_CHANNELS_PUBLIC_API_VERSION = '1.1.0' as const;
export const CHAT_CONTRACT_REVISION = 'shared.chat.channels.v2.merged' as const;

export const CHAT_CONTRACT_AUTHORITIES = Object.freeze({
  sharedContractsRoot: '/shared/contracts/chat',
  sharedLearningRoot: '/shared/contracts/chat/learning',
  frontendEngineRoot: '/pzo-web/src/engines/chat',
  frontendUiRoot: '/pzo-web/src/components/chat',
  backendEngineRoot: '/backend/src/game/engine/chat',
  serverTransportRoot: '/pzo-server/src/chat',
  frontendLearningRoot: '/pzo-web/src/engines/chat/intelligence',
  backendLearningRoot: '/backend/src/game/engine/chat/intelligence',
  donorFrontendRoot: '/frontend/apps/web/components/chat',
  legacyClientRoot: '/pzo_client/src/components/chat',
  frontendStoreRoot: '/pzo-web/src/store',
  frontendContextRoot: '/pzo-web/src/context',
  frontendGameRoot: '/pzo-web/src/game',
} as const);

export type ChatAuthorityKey = keyof typeof CHAT_CONTRACT_AUTHORITIES;

// ============================================================================
// MARK: Channel identifiers and families
// ============================================================================

export const CHAT_VISIBLE_CHANNELS = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const;

export const CHAT_SHADOW_CHANNELS = [
  'SYSTEM_SHADOW',
  'NPC_SHADOW',
  'RIVALRY_SHADOW',
  'RESCUE_SHADOW',
  'LIVEOPS_SHADOW',
] as const;

export const CHAT_ALL_CHANNELS = [
  ...CHAT_VISIBLE_CHANNELS,
  ...CHAT_SHADOW_CHANNELS,
] as const;

export type ChatVisibleChannel = (typeof CHAT_VISIBLE_CHANNELS)[number];
export type ChatShadowChannel = (typeof CHAT_SHADOW_CHANNELS)[number];
export type ChatChannelId = (typeof CHAT_ALL_CHANNELS)[number];

/**
 * Compatibility alias for older pzo-web lanes that still type ChatChannel as a
 * visible-only tab vocabulary.
 */
export type ChatChannel = ChatVisibleChannel;

export const CHAT_LEGACY_CHANNEL_ALIASES = Object.freeze({
  DM: 'SYNDICATE',
  SPECTATOR: 'GLOBAL',
  DEALS: 'DEAL_ROOM',
  WAR_ROOM: 'SYNDICATE',
} as const);

export type ChatLegacyChannelAlias = keyof typeof CHAT_LEGACY_CHANNEL_ALIASES;

export const CHAT_CHANNEL_FAMILIES = [
  'PUBLIC',
  'PRIVATE',
  'NEGOTIATION',
  'PRE_RUN',
  'SHADOW',
] as const;

export type ChatChannelFamily = (typeof CHAT_CHANNEL_FAMILIES)[number];

export const CHAT_PERSISTENCE_CLASSES = [
  'TRANSIENT',
  'RUN_SCOPED',
  'ACCOUNT_SCOPED',
] as const;

export type ChatPersistenceClass = (typeof CHAT_PERSISTENCE_CLASSES)[number];

export const CHAT_CHANNEL_TRANSCRIPT_CLASSES = [
  'CANONICAL_TRANSCRIPT',
  'AUXILIARY_TRANSCRIPT',
  'SHADOW_LEDGER',
] as const;

export type ChatChannelTranscriptClass =
  (typeof CHAT_CHANNEL_TRANSCRIPT_CLASSES)[number];

export const CHAT_CHANNEL_REPLAY_CLASSES = [
  'FULL_REPLAY',
  'SUMMARY_REPLAY',
  'HIDDEN_REPLAY',
] as const;

export type ChatChannelReplayClass = (typeof CHAT_CHANNEL_REPLAY_CLASSES)[number];

export const CHAT_MODERATION_PROFILES = [
  'PUBLIC_STRICT',
  'TRUST_GATED',
  'NEGOTIATION_STRICT',
  'PRE_RUN_STANDARD',
  'SYSTEM_INTERNAL',
] as const;

export type ChatChannelModerationProfile =
  (typeof CHAT_MODERATION_PROFILES)[number];

export const CHAT_AUDIT_VISIBILITY_CLASSES = [
  'PLAYER_VISIBLE',
  'BACKEND_VISIBLE',
  'SERVER_VISIBLE',
  'DEBUG_VISIBLE',
] as const;

export type ChatAuditVisibilityClass =
  (typeof CHAT_AUDIT_VISIBILITY_CLASSES)[number];

export const CHAT_FANOUT_CLASSES = [
  'ROOM_BROADCAST',
  'CHANNEL_BROADCAST',
  'SESSION_DIRECT',
  'SERVER_INTERNAL',
  'BACKEND_INTERNAL',
  'REPLAY_ONLY',
] as const;

export type ChatFanoutClass = (typeof CHAT_FANOUT_CLASSES)[number];

export const CHAT_CHANNEL_FANOUT_SCOPES = [
  'ROOM_BROADCAST',
  'ROLE_SCOPED',
  'SESSION_TARGETED',
  'SYSTEM_INTERNAL',
] as const;

export type ChatChannelFanoutScope =
  (typeof CHAT_CHANNEL_FANOUT_SCOPES)[number];

export const CHAT_DELIVERY_PRIORITIES = [
  'IMMEDIATE',
  'HIGH',
  'NORMAL',
  'LOW',
  'DEFERRED',
] as const;

export type ChatDeliveryPriority = (typeof CHAT_DELIVERY_PRIORITIES)[number];

export const CHAT_STAGE_MOODS = [
  'CALM',
  'TENSE',
  'HOSTILE',
  'PREDATORY',
  'CEREMONIAL',
  'WATCHFUL',
  'CONSPIRATORIAL',
] as const;

export type ChatStageMood = (typeof CHAT_STAGE_MOODS)[number];

export const CHAT_AUDIENCE_PROFILES = [
  'PUBLIC_ARENA',
  'TRUST_CIRCLE',
  'PREDATORY_TABLE',
  'PRE_RUN_STAGING',
  'INTERNAL_MEMORY',
] as const;

export type ChatChannelAudienceProfile =
  (typeof CHAT_AUDIENCE_PROFILES)[number];

export const CHAT_COMPOSER_CLASSES = ['FULL', 'LIMITED', 'DISABLED'] as const;
export type ChatComposerClass = (typeof CHAT_COMPOSER_CLASSES)[number];

export const CHAT_PRESENCE_THEATER_PROFILES = [
  'NONE',
  'FAST_VISIBLE',
  'CROWD_VISIBLE',
  'NEGOTIATION_DELAYED',
  'NPC_LATENT',
  'PREDATOR_LURK',
  'HELPER_WAIT',
  'SHADOW_ONLY',
] as const;

export type ChatPresenceTheaterProfile =
  (typeof CHAT_PRESENCE_THEATER_PROFILES)[number];

export const CHAT_READ_RECEIPT_POLICIES = [
  'NONE',
  'IMMEDIATE',
  'PRESSURE_DELAYED',
  'NPC_THEATER_DELAYED',
  'HELPER_DELAYED',
  'SERVER_ONLY',
] as const;

export type ChatReadReceiptPolicy =
  (typeof CHAT_READ_RECEIPT_POLICIES)[number];

export const CHAT_ROOM_PURPOSES = [
  'PUBLIC_STAGE',
  'PRIVATE_COORDINATION',
  'NEGOTIATION_CHAMBER',
  'PRE_RUN_SOCIAL',
  'SYSTEM_LEDGER',
  'NPC_CONTROL',
  'RIVALRY_MEMORY',
  'RESCUE_PIPELINE',
  'LIVEOPS_CONTROL',
] as const;

export type ChatRoomPurpose = (typeof CHAT_ROOM_PURPOSES)[number];

export const CHAT_ROOM_SCOPES = [
  'MATCH',
  'RUN',
  'ACCOUNT',
  'LOBBY',
  'SEASON',
  'SERVER',
  'EPHEMERAL',
] as const;

export type ChatRoomScope = (typeof CHAT_ROOM_SCOPES)[number];

export const CHAT_ROOM_KEY_STRATEGIES = [
  'FIXED_GLOBAL',
  'PLAYER_SCOPED',
  'RUN_SCOPED',
  'MATCH_SCOPED',
  'SYNDICATE_SCOPED',
  'SEASON_SCOPED',
  'SERVER_INTERNAL',
] as const;

export type ChatRoomKeyStrategy = (typeof CHAT_ROOM_KEY_STRATEGIES)[number];

// ============================================================================
// MARK: Rich channel descriptors
// ============================================================================

export interface ChatChannelDescriptor {
  readonly id: ChatChannelId;
  readonly family: ChatChannelFamily;
  readonly displayName: string;
  readonly shortLabel: string;
  readonly audienceProfile: ChatChannelAudienceProfile;
  readonly visibleToPlayer: boolean;
  readonly visibleInTabs: boolean;
  readonly writableByPlayer: boolean;
  readonly composerClass: ChatComposerClass;
  readonly supportsComposer: boolean;
  readonly supportsPresence: boolean;
  readonly supportsTyping: boolean;
  readonly supportsCursor: boolean;
  readonly supportsReadReceipts: boolean;
  readonly supportsReplay: boolean;
  readonly supportsCrowdHeat: boolean;
  readonly supportsRelationshipState: boolean;
  readonly supportsNpcInjection: boolean;
  readonly supportsNegotiationLogic: boolean;
  readonly supportsRescueLogic: boolean;
  readonly supportsWorldEvents: boolean;
  readonly supportsLegendMoments: boolean;
  readonly supportsShadowWrites: boolean;
  readonly supportsProofHashExposure: boolean;
  readonly transcriptClass: ChatChannelTranscriptClass;
  readonly replayClass: ChatChannelReplayClass;
  readonly moderationProfile: ChatChannelModerationProfile;
  readonly auditVisibility: ChatAuditVisibilityClass;
  readonly fanoutClass: ChatFanoutClass;
  readonly fanoutScope: ChatChannelFanoutScope;
  readonly deliveryPriority: ChatDeliveryPriority;
  readonly persistenceClass: ChatPersistenceClass;
  readonly defaultStageMood: ChatStageMood;
  readonly roomPurpose: ChatRoomPurpose;
  readonly roomScope: ChatRoomScope;
  readonly roomKeyStrategy: ChatRoomKeyStrategy;
  readonly presenceTheaterProfile: ChatPresenceTheaterProfile;
  readonly readReceiptPolicy: ChatReadReceiptPolicy;
  readonly retentionDays: number;
  readonly maxBodyLength: number;
  readonly maxTagCount: number;
  readonly policyTags: readonly ChatPolicyTag[];
  readonly defaultShadowCompanions: readonly ChatShadowChannel[];
}

export const CHAT_POLICY_TAGS = Object.freeze({
  crowdHeat: 'crowd-heat' as ChatPolicyTag,
  negotiation: 'negotiation' as ChatPolicyTag,
  rescue: 'rescue' as ChatPolicyTag,
  worldEvent: 'world-event' as ChatPolicyTag,
  relationship: 'relationship' as ChatPolicyTag,
  proofVisible: 'proof-visible' as ChatPolicyTag,
  shadowCompanion: 'shadow-companion' as ChatPolicyTag,
  presenceTheater: 'presence-theater' as ChatPolicyTag,
  replay: 'replay' as ChatPolicyTag,
  trustSensitive: 'trust-sensitive' as ChatPolicyTag,
  theatrical: 'theatrical' as ChatPolicyTag,
  liveops: 'liveops' as ChatPolicyTag,
  privateStrategy: 'private-strategy' as ChatPolicyTag,
  predatoryQuiet: 'predatory-quiet' as ChatPolicyTag,
  ambient: 'ambient' as ChatPolicyTag,
} as const);

export const CHAT_CHANNEL_DESCRIPTORS: Readonly<
  Record<ChatChannelId, ChatChannelDescriptor>
> = Object.freeze({
  GLOBAL: {
    id: 'GLOBAL',
    family: 'PUBLIC',
    displayName: 'Global',
    shortLabel: 'Global',
    audienceProfile: 'PUBLIC_ARENA',
    visibleToPlayer: true,
    visibleInTabs: true,
    writableByPlayer: true,
    composerClass: 'FULL',
    supportsComposer: true,
    supportsPresence: true,
    supportsTyping: true,
    supportsCursor: true,
    supportsReadReceipts: true,
    supportsReplay: true,
    supportsCrowdHeat: true,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: true,
    supportsWorldEvents: true,
    supportsLegendMoments: true,
    supportsShadowWrites: true,
    supportsProofHashExposure: true,
    transcriptClass: 'CANONICAL_TRANSCRIPT',
    replayClass: 'FULL_REPLAY',
    moderationProfile: 'PUBLIC_STRICT',
    auditVisibility: 'PLAYER_VISIBLE',
    fanoutClass: 'CHANNEL_BROADCAST',
    fanoutScope: 'ROOM_BROADCAST',
    deliveryPriority: 'HIGH',
    persistenceClass: 'RUN_SCOPED',
    defaultStageMood: 'HOSTILE',
    roomPurpose: 'PUBLIC_STAGE',
    roomScope: 'RUN',
    roomKeyStrategy: 'RUN_SCOPED',
    presenceTheaterProfile: 'CROWD_VISIBLE',
    readReceiptPolicy: 'IMMEDIATE',
    retentionDays: 30,
    maxBodyLength: 8_000,
    maxTagCount: 32,
    policyTags: [
      CHAT_POLICY_TAGS.crowdHeat,
      CHAT_POLICY_TAGS.relationship,
      CHAT_POLICY_TAGS.worldEvent,
      CHAT_POLICY_TAGS.theatrical,
      CHAT_POLICY_TAGS.proofVisible,
      CHAT_POLICY_TAGS.shadowCompanion,
      CHAT_POLICY_TAGS.replay,
    ],
    defaultShadowCompanions: [
      'SYSTEM_SHADOW',
      'RIVALRY_SHADOW',
      'LIVEOPS_SHADOW',
    ],
  },
  SYNDICATE: {
    id: 'SYNDICATE',
    family: 'PRIVATE',
    displayName: 'Syndicate',
    shortLabel: 'Syndicate',
    audienceProfile: 'TRUST_CIRCLE',
    visibleToPlayer: true,
    visibleInTabs: true,
    writableByPlayer: true,
    composerClass: 'FULL',
    supportsComposer: true,
    supportsPresence: true,
    supportsTyping: true,
    supportsCursor: true,
    supportsReadReceipts: true,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: true,
    supportsWorldEvents: false,
    supportsLegendMoments: true,
    supportsShadowWrites: true,
    supportsProofHashExposure: true,
    transcriptClass: 'CANONICAL_TRANSCRIPT',
    replayClass: 'FULL_REPLAY',
    moderationProfile: 'TRUST_GATED',
    auditVisibility: 'PLAYER_VISIBLE',
    fanoutClass: 'ROOM_BROADCAST',
    fanoutScope: 'ROLE_SCOPED',
    deliveryPriority: 'HIGH',
    persistenceClass: 'ACCOUNT_SCOPED',
    defaultStageMood: 'CONSPIRATORIAL',
    roomPurpose: 'PRIVATE_COORDINATION',
    roomScope: 'ACCOUNT',
    roomKeyStrategy: 'SYNDICATE_SCOPED',
    presenceTheaterProfile: 'FAST_VISIBLE',
    readReceiptPolicy: 'IMMEDIATE',
    retentionDays: 90,
    maxBodyLength: 8_000,
    maxTagCount: 32,
    policyTags: [
      CHAT_POLICY_TAGS.relationship,
      CHAT_POLICY_TAGS.trustSensitive,
      CHAT_POLICY_TAGS.privateStrategy,
      CHAT_POLICY_TAGS.replay,
      CHAT_POLICY_TAGS.proofVisible,
      CHAT_POLICY_TAGS.shadowCompanion,
    ],
    defaultShadowCompanions: [
      'SYSTEM_SHADOW',
      'RESCUE_SHADOW',
      'RIVALRY_SHADOW',
    ],
  },
  DEAL_ROOM: {
    id: 'DEAL_ROOM',
    family: 'NEGOTIATION',
    displayName: 'Deal Room',
    shortLabel: 'Deals',
    audienceProfile: 'PREDATORY_TABLE',
    visibleToPlayer: true,
    visibleInTabs: true,
    writableByPlayer: true,
    composerClass: 'FULL',
    supportsComposer: true,
    supportsPresence: true,
    supportsTyping: true,
    supportsCursor: true,
    supportsReadReceipts: true,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: true,
    supportsRescueLogic: true,
    supportsWorldEvents: false,
    supportsLegendMoments: true,
    supportsShadowWrites: true,
    supportsProofHashExposure: true,
    transcriptClass: 'CANONICAL_TRANSCRIPT',
    replayClass: 'FULL_REPLAY',
    moderationProfile: 'NEGOTIATION_STRICT',
    auditVisibility: 'PLAYER_VISIBLE',
    fanoutClass: 'ROOM_BROADCAST',
    fanoutScope: 'ROLE_SCOPED',
    deliveryPriority: 'HIGH',
    persistenceClass: 'RUN_SCOPED',
    defaultStageMood: 'PREDATORY',
    roomPurpose: 'NEGOTIATION_CHAMBER',
    roomScope: 'RUN',
    roomKeyStrategy: 'RUN_SCOPED',
    presenceTheaterProfile: 'NEGOTIATION_DELAYED',
    readReceiptPolicy: 'PRESSURE_DELAYED',
    retentionDays: 30,
    maxBodyLength: 8_000,
    maxTagCount: 32,
    policyTags: [
      CHAT_POLICY_TAGS.negotiation,
      CHAT_POLICY_TAGS.relationship,
      CHAT_POLICY_TAGS.rescue,
      CHAT_POLICY_TAGS.shadowCompanion,
      CHAT_POLICY_TAGS.replay,
    ],
    defaultShadowCompanions: [
      'SYSTEM_SHADOW',
      'NPC_SHADOW',
      'RESCUE_SHADOW',
    ],
  },
  LOBBY: {
    id: 'LOBBY',
    family: 'PRE_RUN',
    displayName: 'Lobby',
    shortLabel: 'Lobby',
    audienceProfile: 'PRE_RUN_STAGING',
    visibleToPlayer: true,
    visibleInTabs: true,
    writableByPlayer: true,
    composerClass: 'FULL',
    supportsComposer: true,
    supportsPresence: true,
    supportsTyping: true,
    supportsCursor: true,
    supportsReadReceipts: true,
    supportsReplay: true,
    supportsCrowdHeat: true,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: false,
    supportsWorldEvents: true,
    supportsLegendMoments: false,
    supportsShadowWrites: true,
    supportsProofHashExposure: true,
    transcriptClass: 'CANONICAL_TRANSCRIPT',
    replayClass: 'SUMMARY_REPLAY',
    moderationProfile: 'PRE_RUN_STANDARD',
    auditVisibility: 'PLAYER_VISIBLE',
    fanoutClass: 'ROOM_BROADCAST',
    fanoutScope: 'ROOM_BROADCAST',
    deliveryPriority: 'NORMAL',
    persistenceClass: 'RUN_SCOPED',
    defaultStageMood: 'CALM',
    roomPurpose: 'PRE_RUN_SOCIAL',
    roomScope: 'LOBBY',
    roomKeyStrategy: 'MATCH_SCOPED',
    presenceTheaterProfile: 'CROWD_VISIBLE',
    readReceiptPolicy: 'IMMEDIATE',
    retentionDays: 14,
    maxBodyLength: 8_000,
    maxTagCount: 32,
    policyTags: [
      CHAT_POLICY_TAGS.ambient,
      CHAT_POLICY_TAGS.crowdHeat,
      CHAT_POLICY_TAGS.worldEvent,
      CHAT_POLICY_TAGS.shadowCompanion,
      CHAT_POLICY_TAGS.replay,
    ],
    defaultShadowCompanions: [
      'SYSTEM_SHADOW',
      'NPC_SHADOW',
      'LIVEOPS_SHADOW',
    ],
  },
  SYSTEM_SHADOW: {
    id: 'SYSTEM_SHADOW',
    family: 'SHADOW',
    displayName: 'System Shadow',
    shortLabel: 'Sys Shadow',
    audienceProfile: 'INTERNAL_MEMORY',
    visibleToPlayer: false,
    visibleInTabs: false,
    writableByPlayer: false,
    composerClass: 'DISABLED',
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsCursor: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: false,
    supportsNegotiationLogic: false,
    supportsRescueLogic: true,
    supportsWorldEvents: true,
    supportsLegendMoments: false,
    supportsShadowWrites: true,
    supportsProofHashExposure: false,
    transcriptClass: 'SHADOW_LEDGER',
    replayClass: 'HIDDEN_REPLAY',
    moderationProfile: 'SYSTEM_INTERNAL',
    auditVisibility: 'BACKEND_VISIBLE',
    fanoutClass: 'BACKEND_INTERNAL',
    fanoutScope: 'SYSTEM_INTERNAL',
    deliveryPriority: 'HIGH',
    persistenceClass: 'RUN_SCOPED',
    defaultStageMood: 'WATCHFUL',
    roomPurpose: 'SYSTEM_LEDGER',
    roomScope: 'RUN',
    roomKeyStrategy: 'SERVER_INTERNAL',
    presenceTheaterProfile: 'SHADOW_ONLY',
    readReceiptPolicy: 'SERVER_ONLY',
    retentionDays: 30,
    maxBodyLength: 16_000,
    maxTagCount: 64,
    policyTags: [
      CHAT_POLICY_TAGS.rescue,
      CHAT_POLICY_TAGS.presenceTheater,
      CHAT_POLICY_TAGS.shadowCompanion,
      CHAT_POLICY_TAGS.replay,
    ],
    defaultShadowCompanions: [],
  },
  NPC_SHADOW: {
    id: 'NPC_SHADOW',
    family: 'SHADOW',
    displayName: 'NPC Shadow',
    shortLabel: 'NPC Shadow',
    audienceProfile: 'INTERNAL_MEMORY',
    visibleToPlayer: false,
    visibleInTabs: false,
    writableByPlayer: false,
    composerClass: 'DISABLED',
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsCursor: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: false,
    supportsWorldEvents: false,
    supportsLegendMoments: false,
    supportsShadowWrites: true,
    supportsProofHashExposure: false,
    transcriptClass: 'SHADOW_LEDGER',
    replayClass: 'HIDDEN_REPLAY',
    moderationProfile: 'SYSTEM_INTERNAL',
    auditVisibility: 'BACKEND_VISIBLE',
    fanoutClass: 'BACKEND_INTERNAL',
    fanoutScope: 'SYSTEM_INTERNAL',
    deliveryPriority: 'LOW',
    persistenceClass: 'RUN_SCOPED',
    defaultStageMood: 'WATCHFUL',
    roomPurpose: 'NPC_CONTROL',
    roomScope: 'RUN',
    roomKeyStrategy: 'SERVER_INTERNAL',
    presenceTheaterProfile: 'NPC_LATENT',
    readReceiptPolicy: 'SERVER_ONLY',
    retentionDays: 30,
    maxBodyLength: 16_000,
    maxTagCount: 64,
    policyTags: [
      CHAT_POLICY_TAGS.relationship,
      CHAT_POLICY_TAGS.presenceTheater,
      CHAT_POLICY_TAGS.shadowCompanion,
    ],
    defaultShadowCompanions: [],
  },
  RIVALRY_SHADOW: {
    id: 'RIVALRY_SHADOW',
    family: 'SHADOW',
    displayName: 'Rivalry Shadow',
    shortLabel: 'Rivalry Shadow',
    audienceProfile: 'INTERNAL_MEMORY',
    visibleToPlayer: false,
    visibleInTabs: false,
    writableByPlayer: false,
    composerClass: 'DISABLED',
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsCursor: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: true,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: false,
    supportsWorldEvents: false,
    supportsLegendMoments: false,
    supportsShadowWrites: true,
    supportsProofHashExposure: false,
    transcriptClass: 'SHADOW_LEDGER',
    replayClass: 'HIDDEN_REPLAY',
    moderationProfile: 'SYSTEM_INTERNAL',
    auditVisibility: 'BACKEND_VISIBLE',
    fanoutClass: 'BACKEND_INTERNAL',
    fanoutScope: 'SYSTEM_INTERNAL',
    deliveryPriority: 'HIGH',
    persistenceClass: 'ACCOUNT_SCOPED',
    defaultStageMood: 'HOSTILE',
    roomPurpose: 'RIVALRY_MEMORY',
    roomScope: 'ACCOUNT',
    roomKeyStrategy: 'PLAYER_SCOPED',
    presenceTheaterProfile: 'PREDATOR_LURK',
    readReceiptPolicy: 'SERVER_ONLY',
    retentionDays: 180,
    maxBodyLength: 16_000,
    maxTagCount: 64,
    policyTags: [
      CHAT_POLICY_TAGS.crowdHeat,
      CHAT_POLICY_TAGS.relationship,
      CHAT_POLICY_TAGS.presenceTheater,
      CHAT_POLICY_TAGS.shadowCompanion,
    ],
    defaultShadowCompanions: [],
  },
  RESCUE_SHADOW: {
    id: 'RESCUE_SHADOW',
    family: 'SHADOW',
    displayName: 'Rescue Shadow',
    shortLabel: 'Rescue Shadow',
    audienceProfile: 'INTERNAL_MEMORY',
    visibleToPlayer: false,
    visibleInTabs: false,
    writableByPlayer: false,
    composerClass: 'DISABLED',
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsCursor: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: true,
    supportsWorldEvents: false,
    supportsLegendMoments: false,
    supportsShadowWrites: true,
    supportsProofHashExposure: false,
    transcriptClass: 'SHADOW_LEDGER',
    replayClass: 'HIDDEN_REPLAY',
    moderationProfile: 'SYSTEM_INTERNAL',
    auditVisibility: 'BACKEND_VISIBLE',
    fanoutClass: 'BACKEND_INTERNAL',
    fanoutScope: 'SYSTEM_INTERNAL',
    deliveryPriority: 'HIGH',
    persistenceClass: 'RUN_SCOPED',
    defaultStageMood: 'WATCHFUL',
    roomPurpose: 'RESCUE_PIPELINE',
    roomScope: 'RUN',
    roomKeyStrategy: 'SERVER_INTERNAL',
    presenceTheaterProfile: 'HELPER_WAIT',
    readReceiptPolicy: 'SERVER_ONLY',
    retentionDays: 30,
    maxBodyLength: 16_000,
    maxTagCount: 64,
    policyTags: [
      CHAT_POLICY_TAGS.rescue,
      CHAT_POLICY_TAGS.presenceTheater,
      CHAT_POLICY_TAGS.shadowCompanion,
    ],
    defaultShadowCompanions: [],
  },
  LIVEOPS_SHADOW: {
    id: 'LIVEOPS_SHADOW',
    family: 'SHADOW',
    displayName: 'LiveOps Shadow',
    shortLabel: 'LiveOps Shadow',
    audienceProfile: 'INTERNAL_MEMORY',
    visibleToPlayer: false,
    visibleInTabs: false,
    writableByPlayer: false,
    composerClass: 'DISABLED',
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsCursor: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: true,
    supportsRelationshipState: false,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: false,
    supportsWorldEvents: true,
    supportsLegendMoments: false,
    supportsShadowWrites: true,
    supportsProofHashExposure: false,
    transcriptClass: 'SHADOW_LEDGER',
    replayClass: 'HIDDEN_REPLAY',
    moderationProfile: 'SYSTEM_INTERNAL',
    auditVisibility: 'SERVER_VISIBLE',
    fanoutClass: 'SERVER_INTERNAL',
    fanoutScope: 'SYSTEM_INTERNAL',
    deliveryPriority: 'DEFERRED',
    persistenceClass: 'RUN_SCOPED',
    defaultStageMood: 'WATCHFUL',
    roomPurpose: 'LIVEOPS_CONTROL',
    roomScope: 'SEASON',
    roomKeyStrategy: 'SEASON_SCOPED',
    presenceTheaterProfile: 'SHADOW_ONLY',
    readReceiptPolicy: 'SERVER_ONLY',
    retentionDays: 30,
    maxBodyLength: 16_000,
    maxTagCount: 64,
    policyTags: [
      CHAT_POLICY_TAGS.liveops,
      CHAT_POLICY_TAGS.crowdHeat,
      CHAT_POLICY_TAGS.shadowCompanion,
    ],
    defaultShadowCompanions: [],
  },
});

// ============================================================================
// MARK: Recipient roles, actor kinds, presence, and typing kinds
// ============================================================================

export const CHAT_RECIPIENT_ROLES = [
  'PLAYER',
  'SPECTATOR',
  'MODERATOR',
  'HELPER',
  'HATER',
  'NPC',
  'SYSTEM',
] as const;

export type ChatRecipientRole = (typeof CHAT_RECIPIENT_ROLES)[number];

export const CHAT_ACTOR_KINDS = [
  'PLAYER',
  'SYSTEM',
  'HATER',
  'HELPER',
  'AMBIENT_NPC',
  'CROWD',
  'DEAL_AGENT',
  'LIVEOPS',
] as const;

export type ChatActorKind = (typeof CHAT_ACTOR_KINDS)[number];

export const CHAT_PRESENCE_KINDS = [
  'ONLINE',
  'AWAY',
  'HIDDEN',
  'DISCONNECTED',
  'RECONNECTING',
  'SPECTATING',
  'HELPER_PRESENT',
  'HATER_PRESENT',
  'NPC_PRESENT',
] as const;

export type ChatPresenceKind = (typeof CHAT_PRESENCE_KINDS)[number];

export const CHAT_TYPING_KINDS = [
  'NOT_TYPING',
  'STARTED',
  'PAUSED',
  'STOPPED',
  'SIMULATED',
] as const;

export type ChatTypingKind = (typeof CHAT_TYPING_KINDS)[number];

// ============================================================================
// MARK: Mode scopes and mount surfaces
// ============================================================================

export const CHAT_MODE_SCOPES = [
  'LOBBY',
  'RUN',
  'BATTLE',
  'EMPIRE',
  'CLUB',
  'LEAGUE',
  'SYNDICATE',
  'PREDATOR',
  'PHANTOM',
  'POST_RUN',
] as const;

export type ChatModeScope = (typeof CHAT_MODE_SCOPES)[number];

export interface ChatModeScopeDescriptor {
  readonly id: ChatModeScope;
  readonly modeScopeId: ChatModeScopeId;
  readonly displayName: string;
  readonly defaultMountTarget: ChatMountTarget;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly stageMood: ChatStageMood;
  readonly enablesNegotiation: boolean;
  readonly enablesCrowdHeat: boolean;
  readonly enablesRescue: boolean;
  readonly enablesLegendMoments: boolean;
  readonly enablesWorldEvents: boolean;
  readonly policyTags: readonly ChatPolicyTag[];
}

export const CHAT_MOUNT_TARGETS = [
  'BATTLE_HUD',
  'CLUB_UI',
  'EMPIRE_GAME_SCREEN',
  'GAME_BOARD',
  'LEAGUE_UI',
  'LOBBY_SCREEN',
  'PHANTOM_GAME_SCREEN',
  'PREDATOR_GAME_SCREEN',
  'SYNDICATE_GAME_SCREEN',
  'POST_RUN_SUMMARY',
] as const;

export type ChatMountTarget = (typeof CHAT_MOUNT_TARGETS)[number];

export interface ChatMountPreset {
  readonly mountTarget: ChatMountTarget;
  readonly mountKey: ChatMountKey;
  readonly modeScope: ChatModeScope;
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly allowCollapse: boolean;
  readonly defaultCollapsed: boolean;
  readonly showPresenceStrip: boolean;
  readonly showThreatMeter: boolean;
  readonly showTranscriptDrawer: boolean;
  readonly showReplayJump: boolean;
  readonly showLegendTreatment: boolean;
  readonly showWorldEventBanner: boolean;
  readonly maxVisibleMessages: number;
  readonly composerPlaceholder: string;
  readonly density: ChatDensity;
  readonly uiTreatment: ChatUiTreatment;
  readonly stageMood: ChatStageMood;
}

export const CHAT_MODE_SCOPE_DESCRIPTORS: Readonly<
  Record<ChatModeScope, ChatModeScopeDescriptor>
> = Object.freeze({
  LOBBY: {
    id: 'LOBBY',
    modeScopeId: 'lobby' as ChatModeScopeId,
    displayName: 'Lobby',
    defaultMountTarget: 'LOBBY_SCREEN',
    allowedVisibleChannels: ['GLOBAL', 'LOBBY'],
    stageMood: 'CALM',
    enablesNegotiation: false,
    enablesCrowdHeat: true,
    enablesRescue: false,
    enablesLegendMoments: false,
    enablesWorldEvents: true,
    policyTags: [CHAT_POLICY_TAGS.ambient, CHAT_POLICY_TAGS.crowdHeat],
  },
  RUN: {
    id: 'RUN',
    modeScopeId: 'run' as ChatModeScopeId,
    displayName: 'Run',
    defaultMountTarget: 'BATTLE_HUD',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    stageMood: 'TENSE',
    enablesNegotiation: true,
    enablesCrowdHeat: true,
    enablesRescue: true,
    enablesLegendMoments: true,
    enablesWorldEvents: true,
    policyTags: [CHAT_POLICY_TAGS.crowdHeat, CHAT_POLICY_TAGS.rescue],
  },
  BATTLE: {
    id: 'BATTLE',
    modeScopeId: 'battle' as ChatModeScopeId,
    displayName: 'Battle',
    defaultMountTarget: 'BATTLE_HUD',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    stageMood: 'HOSTILE',
    enablesNegotiation: true,
    enablesCrowdHeat: true,
    enablesRescue: true,
    enablesLegendMoments: true,
    enablesWorldEvents: true,
    policyTags: [CHAT_POLICY_TAGS.crowdHeat, CHAT_POLICY_TAGS.negotiation],
  },
  EMPIRE: {
    id: 'EMPIRE',
    modeScopeId: 'empire' as ChatModeScopeId,
    displayName: 'Empire',
    defaultMountTarget: 'EMPIRE_GAME_SCREEN',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    stageMood: 'WATCHFUL',
    enablesNegotiation: false,
    enablesCrowdHeat: true,
    enablesRescue: true,
    enablesLegendMoments: true,
    enablesWorldEvents: true,
    policyTags: [CHAT_POLICY_TAGS.crowdHeat, CHAT_POLICY_TAGS.worldEvent],
  },
  CLUB: {
    id: 'CLUB',
    modeScopeId: 'club' as ChatModeScopeId,
    displayName: 'Club',
    defaultMountTarget: 'CLUB_UI',
    allowedVisibleChannels: ['GLOBAL', 'LOBBY'],
    stageMood: 'CALM',
    enablesNegotiation: false,
    enablesCrowdHeat: true,
    enablesRescue: false,
    enablesLegendMoments: false,
    enablesWorldEvents: true,
    policyTags: [CHAT_POLICY_TAGS.ambient, CHAT_POLICY_TAGS.worldEvent],
  },
  LEAGUE: {
    id: 'LEAGUE',
    modeScopeId: 'league' as ChatModeScopeId,
    displayName: 'League',
    defaultMountTarget: 'LEAGUE_UI',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    stageMood: 'CEREMONIAL',
    enablesNegotiation: false,
    enablesCrowdHeat: true,
    enablesRescue: true,
    enablesLegendMoments: true,
    enablesWorldEvents: true,
    policyTags: [CHAT_POLICY_TAGS.crowdHeat, CHAT_POLICY_TAGS.relationship],
  },
  SYNDICATE: {
    id: 'SYNDICATE',
    modeScopeId: 'syndicate' as ChatModeScopeId,
    displayName: 'Syndicate',
    defaultMountTarget: 'SYNDICATE_GAME_SCREEN',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    stageMood: 'CONSPIRATORIAL',
    enablesNegotiation: true,
    enablesCrowdHeat: false,
    enablesRescue: true,
    enablesLegendMoments: true,
    enablesWorldEvents: false,
    policyTags: [CHAT_POLICY_TAGS.privateStrategy, CHAT_POLICY_TAGS.relationship],
  },
  PREDATOR: {
    id: 'PREDATOR',
    modeScopeId: 'predator' as ChatModeScopeId,
    displayName: 'Predator',
    defaultMountTarget: 'PREDATOR_GAME_SCREEN',
    allowedVisibleChannels: ['GLOBAL', 'DEAL_ROOM'],
    stageMood: 'PREDATORY',
    enablesNegotiation: true,
    enablesCrowdHeat: true,
    enablesRescue: true,
    enablesLegendMoments: true,
    enablesWorldEvents: true,
    policyTags: [CHAT_POLICY_TAGS.negotiation, CHAT_POLICY_TAGS.presenceTheater],
  },
  PHANTOM: {
    id: 'PHANTOM',
    modeScopeId: 'phantom' as ChatModeScopeId,
    displayName: 'Phantom',
    defaultMountTarget: 'PHANTOM_GAME_SCREEN',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    stageMood: 'WATCHFUL',
    enablesNegotiation: false,
    enablesCrowdHeat: true,
    enablesRescue: true,
    enablesLegendMoments: true,
    enablesWorldEvents: true,
    policyTags: [CHAT_POLICY_TAGS.presenceTheater, CHAT_POLICY_TAGS.relationship],
  },
  POST_RUN: {
    id: 'POST_RUN',
    modeScopeId: 'post-run' as ChatModeScopeId,
    displayName: 'Post Run',
    defaultMountTarget: 'POST_RUN_SUMMARY',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    stageMood: 'CEREMONIAL',
    enablesNegotiation: false,
    enablesCrowdHeat: true,
    enablesRescue: false,
    enablesLegendMoments: true,
    enablesWorldEvents: false,
    policyTags: [CHAT_POLICY_TAGS.relationship, CHAT_POLICY_TAGS.replay],
  },
});

export const CHAT_MOUNT_PRESETS: Readonly<Record<ChatMountTarget, ChatMountPreset>> =
  Object.freeze({
    BATTLE_HUD: {
      mountTarget: 'BATTLE_HUD',
      mountKey: 'battle-hud' as ChatMountKey,
      modeScope: 'RUN',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
      allowCollapse: true,
      defaultCollapsed: false,
      showPresenceStrip: true,
      showThreatMeter: true,
      showTranscriptDrawer: true,
      showReplayJump: true,
      showLegendTreatment: true,
      showWorldEventBanner: true,
      maxVisibleMessages: 18,
      composerPlaceholder: 'Broadcast, coordinate, or bait a rival…',
      density: 'COMPACT',
      uiTreatment: 'PRIMARY',
      stageMood: 'HOSTILE',
    },
    CLUB_UI: {
      mountTarget: 'CLUB_UI',
      mountKey: 'club-ui' as ChatMountKey,
      modeScope: 'CLUB',
      defaultVisibleChannel: 'LOBBY',
      allowedVisibleChannels: ['GLOBAL', 'LOBBY'],
      allowCollapse: true,
      defaultCollapsed: true,
      showPresenceStrip: true,
      showThreatMeter: false,
      showTranscriptDrawer: true,
      showReplayJump: false,
      showLegendTreatment: false,
      showWorldEventBanner: true,
      maxVisibleMessages: 16,
      composerPlaceholder: 'Warm up the room…',
      density: 'STANDARD',
      uiTreatment: 'SECONDARY',
      stageMood: 'CALM',
    },
    EMPIRE_GAME_SCREEN: {
      mountTarget: 'EMPIRE_GAME_SCREEN',
      mountKey: 'empire-game-screen' as ChatMountKey,
      modeScope: 'EMPIRE',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      allowCollapse: true,
      defaultCollapsed: false,
      showPresenceStrip: true,
      showThreatMeter: true,
      showTranscriptDrawer: true,
      showReplayJump: true,
      showLegendTreatment: true,
      showWorldEventBanner: true,
      maxVisibleMessages: 20,
      composerPlaceholder: 'Signal intent across the board…',
      density: 'STANDARD',
      uiTreatment: 'PRIMARY',
      stageMood: 'WATCHFUL',
    },
    GAME_BOARD: {
      mountTarget: 'GAME_BOARD',
      mountKey: 'game-board' as ChatMountKey,
      modeScope: 'RUN',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
      allowCollapse: true,
      defaultCollapsed: false,
      showPresenceStrip: true,
      showThreatMeter: true,
      showTranscriptDrawer: true,
      showReplayJump: true,
      showLegendTreatment: true,
      showWorldEventBanner: true,
      maxVisibleMessages: 18,
      composerPlaceholder: 'The board is watching…',
      density: 'COMPACT',
      uiTreatment: 'PRIMARY',
      stageMood: 'TENSE',
    },
    LEAGUE_UI: {
      mountTarget: 'LEAGUE_UI',
      mountKey: 'league-ui' as ChatMountKey,
      modeScope: 'LEAGUE',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      allowCollapse: true,
      defaultCollapsed: false,
      showPresenceStrip: true,
      showThreatMeter: false,
      showTranscriptDrawer: true,
      showReplayJump: true,
      showLegendTreatment: true,
      showWorldEventBanner: true,
      maxVisibleMessages: 20,
      composerPlaceholder: 'Address the league…',
      density: 'STANDARD',
      uiTreatment: 'CEREMONIAL',
      stageMood: 'CEREMONIAL',
    },
    LOBBY_SCREEN: {
      mountTarget: 'LOBBY_SCREEN',
      mountKey: 'lobby-screen' as ChatMountKey,
      modeScope: 'LOBBY',
      defaultVisibleChannel: 'LOBBY',
      allowedVisibleChannels: ['GLOBAL', 'LOBBY'],
      allowCollapse: true,
      defaultCollapsed: false,
      showPresenceStrip: true,
      showThreatMeter: false,
      showTranscriptDrawer: true,
      showReplayJump: false,
      showLegendTreatment: false,
      showWorldEventBanner: true,
      maxVisibleMessages: 14,
      composerPlaceholder: 'Queue up, signal readiness, or test the room…',
      density: 'STANDARD',
      uiTreatment: 'SECONDARY',
      stageMood: 'CALM',
    },
    PHANTOM_GAME_SCREEN: {
      mountTarget: 'PHANTOM_GAME_SCREEN',
      mountKey: 'phantom-game-screen' as ChatMountKey,
      modeScope: 'PHANTOM',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      allowCollapse: true,
      defaultCollapsed: false,
      showPresenceStrip: true,
      showThreatMeter: true,
      showTranscriptDrawer: true,
      showReplayJump: true,
      showLegendTreatment: true,
      showWorldEventBanner: true,
      maxVisibleMessages: 18,
      composerPlaceholder: 'Move softly. The echoes keep score…',
      density: 'COMPACT',
      uiTreatment: 'PRIMARY',
      stageMood: 'WATCHFUL',
    },
    PREDATOR_GAME_SCREEN: {
      mountTarget: 'PREDATOR_GAME_SCREEN',
      mountKey: 'predator-game-screen' as ChatMountKey,
      modeScope: 'PREDATOR',
      defaultVisibleChannel: 'DEAL_ROOM',
      allowedVisibleChannels: ['GLOBAL', 'DEAL_ROOM'],
      allowCollapse: true,
      defaultCollapsed: false,
      showPresenceStrip: true,
      showThreatMeter: true,
      showTranscriptDrawer: true,
      showReplayJump: true,
      showLegendTreatment: true,
      showWorldEventBanner: true,
      maxVisibleMessages: 18,
      composerPlaceholder: 'Apply pressure or bait a counter…',
      density: 'COMPACT',
      uiTreatment: 'PRIMARY',
      stageMood: 'PREDATORY',
    },
    SYNDICATE_GAME_SCREEN: {
      mountTarget: 'SYNDICATE_GAME_SCREEN',
      mountKey: 'syndicate-game-screen' as ChatMountKey,
      modeScope: 'SYNDICATE',
      defaultVisibleChannel: 'SYNDICATE',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
      allowCollapse: true,
      defaultCollapsed: false,
      showPresenceStrip: true,
      showThreatMeter: true,
      showTranscriptDrawer: true,
      showReplayJump: true,
      showLegendTreatment: true,
      showWorldEventBanner: false,
      maxVisibleMessages: 18,
      composerPlaceholder: 'Coordinate privately. Every word costs…',
      density: 'STANDARD',
      uiTreatment: 'PRIMARY',
      stageMood: 'CONSPIRATORIAL',
    },
    POST_RUN_SUMMARY: {
      mountTarget: 'POST_RUN_SUMMARY',
      mountKey: 'post-run-summary' as ChatMountKey,
      modeScope: 'POST_RUN',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      allowCollapse: false,
      defaultCollapsed: false,
      showPresenceStrip: false,
      showThreatMeter: false,
      showTranscriptDrawer: true,
      showReplayJump: true,
      showLegendTreatment: true,
      showWorldEventBanner: false,
      maxVisibleMessages: 24,
      composerPlaceholder: 'Debrief the turning point…',
      density: 'EXPANDED',
      uiTreatment: 'CEREMONIAL',
      stageMood: 'CEREMONIAL',
    },
  });

// ============================================================================
// MARK: Room descriptors and namespaces
// ============================================================================

export interface ChatRoomDescriptor {
  readonly id: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly purpose: ChatRoomPurpose;
  readonly scope: ChatRoomScope;
  readonly keyStrategy: ChatRoomKeyStrategy;
  readonly topicName: ChatTopicName;
  readonly namespace: ChatNamespace;
  readonly replayEnabled: boolean;
  readonly proofLedgerEnabled: boolean;
  readonly shadowCompanionIds: readonly ChatShadowChannel[];
}

export const CHAT_NAMESPACES = Object.freeze({
  public: 'chat.public' as ChatNamespace,
  private: 'chat.private' as ChatNamespace,
  negotiation: 'chat.negotiation' as ChatNamespace,
  lobby: 'chat.lobby' as ChatNamespace,
  shadow: 'chat.shadow' as ChatNamespace,
  replay: 'chat.replay' as ChatNamespace,
  telemetry: 'chat.telemetry' as ChatNamespace,
} as const);

export const CHAT_TOPIC_ROUTES = Object.freeze({
  GLOBAL: 'room.global' as ChatTopicName,
  SYNDICATE: 'room.syndicate' as ChatTopicName,
  DEAL_ROOM: 'room.deal' as ChatTopicName,
  LOBBY: 'room.lobby' as ChatTopicName,
  SYSTEM_SHADOW: 'shadow.system' as ChatTopicName,
  NPC_SHADOW: 'shadow.npc' as ChatTopicName,
  RIVALRY_SHADOW: 'shadow.rivalry' as ChatTopicName,
  RESCUE_SHADOW: 'shadow.rescue' as ChatTopicName,
  LIVEOPS_SHADOW: 'shadow.liveops' as ChatTopicName,
} as const);

// ============================================================================
// MARK: Channel relationship and permission matrices
// ============================================================================

export type ChatRolePermission = 'NONE' | 'READ' | 'WRITE' | 'MODERATE' | 'SYSTEM';

export type ChatRolePermissionMatrix = Readonly<
  Record<ChatRecipientRole, Readonly<Record<ChatChannelId, ChatRolePermission>>>
>;

const PLAYER_VISIBLE_PERMISSION_ROW: Readonly<Record<ChatChannelId, ChatRolePermission>> = {
  GLOBAL: 'WRITE',
  SYNDICATE: 'WRITE',
  DEAL_ROOM: 'WRITE',
  LOBBY: 'WRITE',
  SYSTEM_SHADOW: 'NONE',
  NPC_SHADOW: 'NONE',
  RIVALRY_SHADOW: 'NONE',
  RESCUE_SHADOW: 'NONE',
  LIVEOPS_SHADOW: 'NONE',
};

const SPECTATOR_PERMISSION_ROW: Readonly<Record<ChatChannelId, ChatRolePermission>> = {
  GLOBAL: 'READ',
  SYNDICATE: 'NONE',
  DEAL_ROOM: 'NONE',
  LOBBY: 'READ',
  SYSTEM_SHADOW: 'NONE',
  NPC_SHADOW: 'NONE',
  RIVALRY_SHADOW: 'NONE',
  RESCUE_SHADOW: 'NONE',
  LIVEOPS_SHADOW: 'NONE',
};

const MODERATOR_PERMISSION_ROW: Readonly<Record<ChatChannelId, ChatRolePermission>> = {
  GLOBAL: 'MODERATE',
  SYNDICATE: 'MODERATE',
  DEAL_ROOM: 'MODERATE',
  LOBBY: 'MODERATE',
  SYSTEM_SHADOW: 'SYSTEM',
  NPC_SHADOW: 'SYSTEM',
  RIVALRY_SHADOW: 'SYSTEM',
  RESCUE_SHADOW: 'SYSTEM',
  LIVEOPS_SHADOW: 'SYSTEM',
};

const HELPER_PERMISSION_ROW: Readonly<Record<ChatChannelId, ChatRolePermission>> = {
  GLOBAL: 'WRITE',
  SYNDICATE: 'WRITE',
  DEAL_ROOM: 'READ',
  LOBBY: 'WRITE',
  SYSTEM_SHADOW: 'READ',
  NPC_SHADOW: 'READ',
  RIVALRY_SHADOW: 'READ',
  RESCUE_SHADOW: 'SYSTEM',
  LIVEOPS_SHADOW: 'NONE',
};

const HATER_PERMISSION_ROW: Readonly<Record<ChatChannelId, ChatRolePermission>> = {
  GLOBAL: 'WRITE',
  SYNDICATE: 'NONE',
  DEAL_ROOM: 'WRITE',
  LOBBY: 'WRITE',
  SYSTEM_SHADOW: 'READ',
  NPC_SHADOW: 'READ',
  RIVALRY_SHADOW: 'SYSTEM',
  RESCUE_SHADOW: 'NONE',
  LIVEOPS_SHADOW: 'NONE',
};

const NPC_PERMISSION_ROW: Readonly<Record<ChatChannelId, ChatRolePermission>> = {
  GLOBAL: 'WRITE',
  SYNDICATE: 'READ',
  DEAL_ROOM: 'READ',
  LOBBY: 'WRITE',
  SYSTEM_SHADOW: 'READ',
  NPC_SHADOW: 'SYSTEM',
  RIVALRY_SHADOW: 'READ',
  RESCUE_SHADOW: 'READ',
  LIVEOPS_SHADOW: 'READ',
};

const SYSTEM_PERMISSION_ROW: Readonly<Record<ChatChannelId, ChatRolePermission>> = {
  GLOBAL: 'SYSTEM',
  SYNDICATE: 'SYSTEM',
  DEAL_ROOM: 'SYSTEM',
  LOBBY: 'SYSTEM',
  SYSTEM_SHADOW: 'SYSTEM',
  NPC_SHADOW: 'SYSTEM',
  RIVALRY_SHADOW: 'SYSTEM',
  RESCUE_SHADOW: 'SYSTEM',
  LIVEOPS_SHADOW: 'SYSTEM',
};

export const CHAT_ROLE_PERMISSION_MATRIX: ChatRolePermissionMatrix = Object.freeze({
  PLAYER: PLAYER_VISIBLE_PERMISSION_ROW,
  SPECTATOR: SPECTATOR_PERMISSION_ROW,
  MODERATOR: MODERATOR_PERMISSION_ROW,
  HELPER: HELPER_PERMISSION_ROW,
  HATER: HATER_PERMISSION_ROW,
  NPC: NPC_PERMISSION_ROW,
  SYSTEM: SYSTEM_PERMISSION_ROW,
});

export const CHAT_SHADOW_COMPANION_MATRIX: Readonly<
  Record<ChatVisibleChannel, readonly ChatShadowChannel[]>
> = Object.freeze({
  GLOBAL: ['SYSTEM_SHADOW', 'RIVALRY_SHADOW', 'LIVEOPS_SHADOW'],
  SYNDICATE: ['SYSTEM_SHADOW', 'RESCUE_SHADOW', 'RIVALRY_SHADOW'],
  DEAL_ROOM: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'RESCUE_SHADOW'],
  LOBBY: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'LIVEOPS_SHADOW'],
});

// ============================================================================
// MARK: Runtime-safe readers and predicates
// ============================================================================

const VISIBLE_CHANNEL_SET = new Set<string>(CHAT_VISIBLE_CHANNELS);
const SHADOW_CHANNEL_SET = new Set<string>(CHAT_SHADOW_CHANNELS);
const ALL_CHANNEL_SET = new Set<string>(CHAT_ALL_CHANNELS);
const RECIPIENT_ROLE_SET = new Set<string>(CHAT_RECIPIENT_ROLES);
const ACTOR_KIND_SET = new Set<string>(CHAT_ACTOR_KINDS);
const PRESENCE_KIND_SET = new Set<string>(CHAT_PRESENCE_KINDS);
const TYPING_KIND_SET = new Set<string>(CHAT_TYPING_KINDS);
const MODE_SCOPE_SET = new Set<string>(CHAT_MODE_SCOPES);
const MOUNT_TARGET_SET = new Set<string>(CHAT_MOUNT_TARGETS);
const LEGACY_ALIAS_SET = new Set<string>(Object.keys(CHAT_LEGACY_CHANNEL_ALIASES));

export function isChatVisibleChannel(value: string): value is ChatVisibleChannel {
  return VISIBLE_CHANNEL_SET.has(value);
}

export function isChatShadowChannel(value: string): value is ChatShadowChannel {
  return SHADOW_CHANNEL_SET.has(value);
}

export function isChatChannelId(value: string): value is ChatChannelId {
  return ALL_CHANNEL_SET.has(value);
}

export function isChatRecipientRole(value: string): value is ChatRecipientRole {
  return RECIPIENT_ROLE_SET.has(value);
}

export function isChatActorKind(value: string): value is ChatActorKind {
  return ACTOR_KIND_SET.has(value);
}

export function isChatPresenceKind(value: string): value is ChatPresenceKind {
  return PRESENCE_KIND_SET.has(value);
}

export function isChatTypingKind(value: string): value is ChatTypingKind {
  return TYPING_KIND_SET.has(value);
}

export function isChatModeScope(value: string): value is ChatModeScope {
  return MODE_SCOPE_SET.has(value);
}

export function isChatMountTarget(value: string): value is ChatMountTarget {
  return MOUNT_TARGET_SET.has(value);
}

export function isChatLegacyChannelAlias(value: string): value is ChatLegacyChannelAlias {
  return LEGACY_ALIAS_SET.has(value);
}

export function normalizeLegacyChatChannel(
  value: ChatChannelId | ChatLegacyChannelAlias | string,
): ChatChannelId | null {
  if (isChatChannelId(value)) {
    return value;
  }
  if (isChatLegacyChannelAlias(value)) {
    return CHAT_LEGACY_CHANNEL_ALIASES[value];
  }
  return null;
}

export function getChatChannelDescriptor(channelId: ChatChannelId): ChatChannelDescriptor {
  return CHAT_CHANNEL_DESCRIPTORS[channelId];
}

export function getChatModeScopeDescriptor(modeScope: ChatModeScope): ChatModeScopeDescriptor {
  return CHAT_MODE_SCOPE_DESCRIPTORS[modeScope];
}

export function getChatMountPreset(mountTarget: ChatMountTarget): ChatMountPreset {
  return CHAT_MOUNT_PRESETS[mountTarget];
}

export function getAllowedVisibleChannelsForMount(
  mountTarget: ChatMountTarget,
): readonly ChatVisibleChannel[] {
  return CHAT_MOUNT_PRESETS[mountTarget].allowedVisibleChannels;
}

export function getDefaultVisibleChannelForMount(
  mountTarget: ChatMountTarget,
): ChatVisibleChannel {
  return CHAT_MOUNT_PRESETS[mountTarget].defaultVisibleChannel;
}

export function getShadowCompanionsForVisibleChannel(
  channelId: ChatVisibleChannel,
): readonly ChatShadowChannel[] {
  return CHAT_SHADOW_COMPANION_MATRIX[channelId];
}

export function getChannelRolePermission(
  role: ChatRecipientRole,
  channelId: ChatChannelId,
): ChatRolePermission {
  return CHAT_ROLE_PERMISSION_MATRIX[role][channelId];
}

export function channelSupportsComposer(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsComposer;
}

export function channelSupportsPresence(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsPresence;
}

export function channelSupportsTyping(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsTyping;
}

export function channelSupportsCursor(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsCursor;
}

export function channelSupportsReplay(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsReplay;
}

export function channelSupportsCrowdHeat(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsCrowdHeat;
}

export function channelSupportsRelationshipState(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsRelationshipState;
}

export function channelSupportsNegotiation(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsNegotiationLogic;
}

export function channelSupportsRescue(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsRescueLogic;
}

export function channelSupportsWorldEvents(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsWorldEvents;
}

export function channelSupportsLegendMoments(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsLegendMoments;
}

export function channelSupportsShadowWrites(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsShadowWrites;
}

export function channelIsVisibleSurface(channelId: ChatChannelId): channelId is ChatVisibleChannel {
  return isChatVisibleChannel(channelId);
}

export function channelIsShadowSurface(channelId: ChatChannelId): channelId is ChatShadowChannel {
  return isChatShadowChannel(channelId);
}

export function mountAllowsVisibleChannel(
  mountTarget: ChatMountTarget,
  channelId: ChatVisibleChannel,
): boolean {
  return CHAT_MOUNT_PRESETS[mountTarget].allowedVisibleChannels.includes(channelId);
}

export function modeScopeAllowsVisibleChannel(
  modeScope: ChatModeScope,
  channelId: ChatVisibleChannel,
): boolean {
  return CHAT_MODE_SCOPE_DESCRIPTORS[modeScope].allowedVisibleChannels.includes(channelId);
}

export function roleCanReadChannel(
  role: ChatRecipientRole,
  channelId: ChatChannelId,
): boolean {
  const permission = getChannelRolePermission(role, channelId);
  return permission !== 'NONE';
}

export function roleCanWriteChannel(
  role: ChatRecipientRole,
  channelId: ChatChannelId,
): boolean {
  const permission = getChannelRolePermission(role, channelId);
  return permission === 'WRITE' || permission === 'MODERATE' || permission === 'SYSTEM';
}

export function roleCanModerateChannel(
  role: ChatRecipientRole,
  channelId: ChatChannelId,
): boolean {
  const permission = getChannelRolePermission(role, channelId);
  return permission === 'MODERATE' || permission === 'SYSTEM';
}

export function roleCanSeeShadowChannels(role: ChatRecipientRole): boolean {
  return role === 'MODERATOR' || role === 'SYSTEM';
}

export function getMountTargetForModeScope(modeScope: ChatModeScope): ChatMountTarget {
  return CHAT_MODE_SCOPE_DESCRIPTORS[modeScope].defaultMountTarget;
}

export function getModeScopeForMountTarget(mountTarget: ChatMountTarget): ChatModeScope {
  return CHAT_MOUNT_PRESETS[mountTarget].modeScope;
}

export function visibleChannelToPrimaryShadow(
  channelId: ChatVisibleChannel,
): ChatShadowChannel {
  return CHAT_SHADOW_COMPANION_MATRIX[channelId][0];
}

// ============================================================================
// MARK: Stable readonly contract package
// ============================================================================

export const CHAT_CHANNEL_CONSTANTS = Object.freeze({
  version: CHAT_CONTRACT_VERSION,
  apiVersion: CHAT_CHANNELS_PUBLIC_API_VERSION,
  revision: CHAT_CONTRACT_REVISION,
  maxVisibleComposerLength: 8_000,
  maxShadowComposerLength: 16_000,
  authorities: CHAT_CONTRACT_AUTHORITIES,
} as const);

export const CHAT_CHANNEL_CONTRACT = Object.freeze({
  version: CHAT_CHANNEL_CONSTANTS.version,
  apiVersion: CHAT_CHANNEL_CONSTANTS.apiVersion,
  revision: CHAT_CHANNEL_CONSTANTS.revision,
  authorities: CHAT_CHANNEL_CONSTANTS.authorities,
  visibleChannels: CHAT_VISIBLE_CHANNELS,
  shadowChannels: CHAT_SHADOW_CHANNELS,
  allChannels: CHAT_ALL_CHANNELS,
  recipientRoles: CHAT_RECIPIENT_ROLES,
  actorKinds: CHAT_ACTOR_KINDS,
  presenceKinds: CHAT_PRESENCE_KINDS,
  typingKinds: CHAT_TYPING_KINDS,
  modeScopes: CHAT_MODE_SCOPES,
  mountTargets: CHAT_MOUNT_TARGETS,
  policyTags: CHAT_POLICY_TAGS,
  descriptors: CHAT_CHANNEL_DESCRIPTORS,
  mountPresets: CHAT_MOUNT_PRESETS,
  modeScopeDescriptors: CHAT_MODE_SCOPE_DESCRIPTORS,
  rolePermissionMatrix: CHAT_ROLE_PERMISSION_MATRIX,
  shadowCompanionMatrix: CHAT_SHADOW_COMPANION_MATRIX,
  topicRoutes: CHAT_TOPIC_ROUTES,
  namespaces: CHAT_NAMESPACES,
} as const);

export default CHAT_CHANNEL_CONTRACT;

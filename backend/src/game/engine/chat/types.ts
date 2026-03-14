
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ENGINE TYPES
 * FILE: backend/src/game/engine/chat/types.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical type surface for the authoritative backend chat lane.
 *
 * This file is intentionally wide because the backend chat engine is not a
 * socket echo and not a UI helper. It is an authoritative simulation lane that:
 *
 * 1. admits and tracks chat sessions,
 * 2. normalizes all upstream chat-worthy signals into one event vocabulary,
 * 3. applies rate, moderation, and channel policy before mutation,
 * 4. mutates authoritative room, transcript, presence, and NPC state,
 * 5. records proof edges, replay artifacts, telemetry, and learning triggers,
 * 6. emits authoritative outputs for fanout and downstream persistence.
 *
 * Design doctrine
 * ---------------
 * - Backend chat owns truth, not presentation.
 * - Transport is a servant, not a brain.
 * - Other engines remain sovereign over their own domains.
 * - Chat consumes battle/run/multiplayer/economy truth through normalized
 *   adapters and snapshots rather than duplicating those systems.
 * - Online inference may recommend; policy and orchestration still decide.
 * - Every message that enters transcript truth must be reconstructible.
 *
 * Migration doctrine
 * ------------------
 * Long-term canonical shared contracts belong under:
 *   /shared/contracts/chat
 *   /shared/contracts/chat/learning
 *
 * Until those are fully landed, backend chat needs a complete, compilable
 * contract surface that can stand on its own without forcing premature import
 * coupling into files that are still being extracted.
 * ============================================================================
 */

// ============================================================================
// MARK: Primitive brands and utility aliases
// ============================================================================

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type UnixMs = Brand<number, 'UnixMs'>;
export type SequenceNumber = Brand<number, 'SequenceNumber'>;
export type Percentage = Brand<number, 'Percentage'>;
export type Score01 = Brand<number, 'Score01'>;
export type Score100 = Brand<number, 'Score100'>;

export type ChatRoomId = Brand<string, 'ChatRoomId'>;
export type ChatSessionId = Brand<string, 'ChatSessionId'>;
export type ChatUserId = Brand<string, 'ChatUserId'>;
export type ChatMessageId = Brand<string, 'ChatMessageId'>;
export type ChatEventId = Brand<string, 'ChatEventId'>;
export type ChatTelemetryId = Brand<string, 'ChatTelemetryId'>;
export type ChatReplayId = Brand<string, 'ChatReplayId'>;
export type ChatProofEdgeId = Brand<string, 'ChatProofEdgeId'>;
export type ChatSceneId = Brand<string, 'ChatSceneId'>;
export type ChatMomentId = Brand<string, 'ChatMomentId'>;
export type ChatLegendId = Brand<string, 'ChatLegendId'>;
export type ChatMemoryAnchorId = Brand<string, 'ChatMemoryAnchorId'>;
export type ChatInvasionId = Brand<string, 'ChatInvasionId'>;
export type ChatRequestId = Brand<string, 'ChatRequestId'>;
export type ChatTypingToken = Brand<string, 'ChatTypingToken'>;
export type ChatOfferId = Brand<string, 'ChatOfferId'>;
export type ChatRelationshipId = Brand<string, 'ChatRelationshipId'>;
export type ChatProofHash = Brand<string, 'ChatProofHash'>;
export type ChatPersonaId = Brand<string, 'ChatPersonaId'>;
export type ChatInferenceId = Brand<string, 'ChatInferenceId'>;
export type ChatDriftId = Brand<string, 'ChatDriftId'>;

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

export interface ChatVector2 {
  readonly x: number;
  readonly y: number;
}

export interface ChatVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer U)[]
      ? ReadonlyArray<DeepReadonly<U>>
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

// ============================================================================
// MARK: Authority metadata
// ============================================================================

export const BACKEND_CHAT_ENGINE_VERSION = '2026.03.14' as const;
export const BACKEND_CHAT_ENGINE_PUBLIC_API_VERSION = '1.0.0-alpha' as const;

export const CHAT_AUTHORITY_ROOTS = Object.freeze({
  sharedContractsRoot: '/shared/contracts/chat',
  sharedLearningRoot: '/shared/contracts/chat/learning',
  frontendEngineRoot: '/pzo-web/src/engines/chat',
  frontendUiRoot: '/pzo-web/src/components/chat',
  backendEngineRoot: '/backend/src/game/engine/chat',
  backendLearningRoot: '/backend/src/game/engine/chat/intelligence',
  serverTransportRoot: '/pzo-server/src/chat',
} as const);

export type ChatAuthorityRootKey = keyof typeof CHAT_AUTHORITY_ROOTS;

// ============================================================================
// MARK: Channel, room, source, and scope constants
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

export const CHAT_ROOM_KINDS = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
  'PRIVATE',
  'SYSTEM',
] as const;

export type ChatRoomKind = (typeof CHAT_ROOM_KINDS)[number];

export const CHAT_SOURCE_TYPES = [
  'PLAYER',
  'NPC_HATER',
  'NPC_HELPER',
  'NPC_AMBIENT',
  'SYSTEM',
  'SERVER',
  'MODERATION',
  'LIVEOPS',
] as const;

export type ChatSourceType = (typeof CHAT_SOURCE_TYPES)[number];

export const CHAT_EVENT_KINDS = [
  'ENGINE_BOOT',
  'ENGINE_SHUTDOWN',
  'SESSION_JOIN_REQUEST',
  'SESSION_JOIN_ACCEPTED',
  'SESSION_JOIN_REJECTED',
  'SESSION_LEAVE',
  'PRESENCE_UPDATED',
  'TYPING_UPDATED',
  'PLAYER_MESSAGE_SUBMIT',
  'PLAYER_MESSAGE_ACCEPTED',
  'PLAYER_MESSAGE_REJECTED',
  'PLAYER_MESSAGE_REDACTED',
  'COMMAND_EXECUTED',
  'COMMAND_REJECTED',
  'BATTLE_SIGNAL',
  'RUN_SIGNAL',
  'MULTIPLAYER_SIGNAL',
  'ECONOMY_SIGNAL',
  'LIVEOPS_SIGNAL',
  'NPC_MESSAGE_EMITTED',
  'HELPER_INTERVENTION',
  'HATER_ESCALATION',
  'INVASION_OPENED',
  'INVASION_CLOSED',
  'SYSTEM_MESSAGE_EMITTED',
  'MAINTENANCE_TICK',
  'REPLAY_FLUSHED',
  'LEARNING_UPDATED',
] as const;

export type ChatEventKind = (typeof CHAT_EVENT_KINDS)[number];

export const CHAT_CONNECTION_STATES = [
  'DETACHED',
  'ATTACHED',
  'RECONNECTING',
  'DISCONNECTED',
  'SUSPENDED',
] as const;

export type ChatConnectionState = (typeof CHAT_CONNECTION_STATES)[number];

export const CHAT_PRESENCE_STATES = [
  'ONLINE',
  'AWAY',
  'HIDDEN',
  'SPECTATING',
  'DISCONNECTED',
  'RECONNECTING',
] as const;

export type ChatPresenceMode = (typeof CHAT_PRESENCE_STATES)[number];

export const CHAT_TYPING_STATES = [
  'IDLE',
  'TYPING',
  'PAUSED',
] as const;

export type ChatTypingMode = (typeof CHAT_TYPING_STATES)[number];

export const CHAT_MODERATION_OUTCOMES = [
  'ALLOW',
  'MASK',
  'REWRITE',
  'SHADOW_ONLY',
  'REJECT',
  'THROTTLE',
  'QUARANTINE',
] as const;

export type ChatModerationOutcome = (typeof CHAT_MODERATION_OUTCOMES)[number];

export const CHAT_RATE_OUTCOMES = [
  'ALLOW',
  'DEFER',
  'THROTTLE',
  'LOCK',
] as const;

export type ChatRateOutcome = (typeof CHAT_RATE_OUTCOMES)[number];

export const CHAT_SESSION_ROLES = [
  'PLAYER',
  'SPECTATOR',
  'SYSTEM',
  'MODERATOR',
  'NPC',
] as const;

export type ChatSessionRole = (typeof CHAT_SESSION_ROLES)[number];

export const CHAT_NPC_ROLES = [
  'HATER',
  'HELPER',
  'AMBIENT',
  'NARRATOR',
] as const;

export type ChatNpcRole = (typeof CHAT_NPC_ROLES)[number];

export const CHAT_INFERENCE_SOURCES = [
  'NONE',
  'HEURISTIC',
  'ML',
  'DL',
  'COMPOSITE',
] as const;

export type ChatInferenceSource = (typeof CHAT_INFERENCE_SOURCES)[number];

export const CHAT_ROOM_STAGE_MOODS = [
  'CALM',
  'TENSE',
  'HOSTILE',
  'PREDATORY',
  'CEREMONIAL',
  'MOURNFUL',
  'ECSTATIC',
] as const;

export type ChatRoomStageMood = (typeof CHAT_ROOM_STAGE_MOODS)[number];

export const CHAT_SIGNAL_TYPES = [
  'BATTLE',
  'RUN',
  'MULTIPLAYER',
  'ECONOMY',
  'LIVEOPS',
] as const;

export type ChatSignalType = (typeof CHAT_SIGNAL_TYPES)[number];

// ============================================================================
// MARK: Backend policy descriptors and channel descriptors
// ============================================================================

export interface ChatChannelDescriptor {
  readonly id: ChatChannelId;
  readonly roomKind: ChatRoomKind;
  readonly visibleToPlayer: boolean;
  readonly supportsComposer: boolean;
  readonly supportsPresence: boolean;
  readonly supportsTyping: boolean;
  readonly supportsReadReceipts: boolean;
  readonly supportsReplay: boolean;
  readonly supportsCrowdHeat: boolean;
  readonly supportsNpcInjection: boolean;
  readonly supportsNegotiation: boolean;
  readonly supportsRescue: boolean;
  readonly supportsShadowWrites: boolean;
  readonly persistenceClass: 'TRANSIENT' | 'RUN_SCOPED' | 'ACCOUNT_SCOPED';
}

export const CHAT_CHANNEL_DESCRIPTORS: Readonly<Record<ChatChannelId, ChatChannelDescriptor>> =
  Object.freeze({
    GLOBAL: {
      id: 'GLOBAL',
      roomKind: 'GLOBAL',
      visibleToPlayer: true,
      supportsComposer: true,
      supportsPresence: true,
      supportsTyping: true,
      supportsReadReceipts: true,
      supportsReplay: true,
      supportsCrowdHeat: true,
      supportsNpcInjection: true,
      supportsNegotiation: false,
      supportsRescue: true,
      supportsShadowWrites: true,
      persistenceClass: 'RUN_SCOPED',
    },
    SYNDICATE: {
      id: 'SYNDICATE',
      roomKind: 'SYNDICATE',
      visibleToPlayer: true,
      supportsComposer: true,
      supportsPresence: true,
      supportsTyping: true,
      supportsReadReceipts: true,
      supportsReplay: true,
      supportsCrowdHeat: false,
      supportsNpcInjection: true,
      supportsNegotiation: false,
      supportsRescue: true,
      supportsShadowWrites: true,
      persistenceClass: 'ACCOUNT_SCOPED',
    },
    DEAL_ROOM: {
      id: 'DEAL_ROOM',
      roomKind: 'DEAL_ROOM',
      visibleToPlayer: true,
      supportsComposer: true,
      supportsPresence: true,
      supportsTyping: true,
      supportsReadReceipts: true,
      supportsReplay: true,
      supportsCrowdHeat: false,
      supportsNpcInjection: true,
      supportsNegotiation: true,
      supportsRescue: true,
      supportsShadowWrites: true,
      persistenceClass: 'RUN_SCOPED',
    },
    LOBBY: {
      id: 'LOBBY',
      roomKind: 'LOBBY',
      visibleToPlayer: true,
      supportsComposer: true,
      supportsPresence: true,
      supportsTyping: true,
      supportsReadReceipts: true,
      supportsReplay: true,
      supportsCrowdHeat: true,
      supportsNpcInjection: true,
      supportsNegotiation: false,
      supportsRescue: false,
      supportsShadowWrites: true,
      persistenceClass: 'RUN_SCOPED',
    },
    SYSTEM_SHADOW: {
      id: 'SYSTEM_SHADOW',
      roomKind: 'SYSTEM',
      visibleToPlayer: false,
      supportsComposer: false,
      supportsPresence: false,
      supportsTyping: false,
      supportsReadReceipts: false,
      supportsReplay: true,
      supportsCrowdHeat: false,
      supportsNpcInjection: false,
      supportsNegotiation: false,
      supportsRescue: true,
      supportsShadowWrites: true,
      persistenceClass: 'RUN_SCOPED',
    },
    NPC_SHADOW: {
      id: 'NPC_SHADOW',
      roomKind: 'SYSTEM',
      visibleToPlayer: false,
      supportsComposer: false,
      supportsPresence: false,
      supportsTyping: false,
      supportsReadReceipts: false,
      supportsReplay: true,
      supportsCrowdHeat: false,
      supportsNpcInjection: true,
      supportsNegotiation: false,
      supportsRescue: false,
      supportsShadowWrites: true,
      persistenceClass: 'RUN_SCOPED',
    },
    RIVALRY_SHADOW: {
      id: 'RIVALRY_SHADOW',
      roomKind: 'SYSTEM',
      visibleToPlayer: false,
      supportsComposer: false,
      supportsPresence: false,
      supportsTyping: false,
      supportsReadReceipts: false,
      supportsReplay: true,
      supportsCrowdHeat: true,
      supportsNpcInjection: true,
      supportsNegotiation: false,
      supportsRescue: false,
      supportsShadowWrites: true,
      persistenceClass: 'ACCOUNT_SCOPED',
    },
    RESCUE_SHADOW: {
      id: 'RESCUE_SHADOW',
      roomKind: 'SYSTEM',
      visibleToPlayer: false,
      supportsComposer: false,
      supportsPresence: false,
      supportsTyping: false,
      supportsReadReceipts: false,
      supportsReplay: true,
      supportsCrowdHeat: false,
      supportsNpcInjection: true,
      supportsNegotiation: false,
      supportsRescue: true,
      supportsShadowWrites: true,
      persistenceClass: 'RUN_SCOPED',
    },
    LIVEOPS_SHADOW: {
      id: 'LIVEOPS_SHADOW',
      roomKind: 'SYSTEM',
      visibleToPlayer: false,
      supportsComposer: false,
      supportsPresence: false,
      supportsTyping: false,
      supportsReadReceipts: false,
      supportsReplay: true,
      supportsCrowdHeat: true,
      supportsNpcInjection: true,
      supportsNegotiation: false,
      supportsRescue: false,
      supportsShadowWrites: true,
      persistenceClass: 'RUN_SCOPED',
    },
  });

export interface ChatMountPolicy {
  readonly mountTarget:
    | 'BATTLE_HUD'
    | 'CLUB_UI'
    | 'EMPIRE_GAME_SCREEN'
    | 'GAME_BOARD'
    | 'LEAGUE_UI'
    | 'LOBBY_SCREEN'
    | 'PHANTOM_GAME_SCREEN'
    | 'PREDATOR_GAME_SCREEN'
    | 'SYNDICATE_GAME_SCREEN'
    | 'POST_RUN_SUMMARY';
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly allowCollapse: boolean;
  readonly defaultCollapsed: boolean;
  readonly stageMood: ChatRoomStageMood;
  readonly defaultComposerPlaceholder: string;
}

export const CHAT_MOUNT_POLICIES: Readonly<Record<ChatMountPolicy['mountTarget'], ChatMountPolicy>> =
  Object.freeze({
    BATTLE_HUD: {
      mountTarget: 'BATTLE_HUD',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
      allowCollapse: true,
      defaultCollapsed: false,
      stageMood: 'HOSTILE',
      defaultComposerPlaceholder: 'Signal the room or answer the attack…',
    },
    CLUB_UI: {
      mountTarget: 'CLUB_UI',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      allowCollapse: true,
      defaultCollapsed: true,
      stageMood: 'CALM',
      defaultComposerPlaceholder: 'Join the room…',
    },
    EMPIRE_GAME_SCREEN: {
      mountTarget: 'EMPIRE_GAME_SCREEN',
      defaultVisibleChannel: 'SYNDICATE',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
      allowCollapse: true,
      defaultCollapsed: false,
      stageMood: 'TENSE',
      defaultComposerPlaceholder: 'Coordinate your position…',
    },
    GAME_BOARD: {
      mountTarget: 'GAME_BOARD',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      allowCollapse: true,
      defaultCollapsed: false,
      stageMood: 'TENSE',
      defaultComposerPlaceholder: 'Speak into the run…',
    },
    LEAGUE_UI: {
      mountTarget: 'LEAGUE_UI',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      allowCollapse: true,
      defaultCollapsed: true,
      stageMood: 'CEREMONIAL',
      defaultComposerPlaceholder: 'Drop a line to the league…',
    },
    LOBBY_SCREEN: {
      mountTarget: 'LOBBY_SCREEN',
      defaultVisibleChannel: 'LOBBY',
      allowedVisibleChannels: ['LOBBY', 'GLOBAL'],
      allowCollapse: true,
      defaultCollapsed: false,
      stageMood: 'CALM',
      defaultComposerPlaceholder: 'Warm up the room…',
    },
    PHANTOM_GAME_SCREEN: {
      mountTarget: 'PHANTOM_GAME_SCREEN',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
      allowCollapse: true,
      defaultCollapsed: false,
      stageMood: 'HOSTILE',
      defaultComposerPlaceholder: 'Ghost the room or strike…',
    },
    PREDATOR_GAME_SCREEN: {
      mountTarget: 'PREDATOR_GAME_SCREEN',
      defaultVisibleChannel: 'DEAL_ROOM',
      allowedVisibleChannels: ['GLOBAL', 'DEAL_ROOM'],
      allowCollapse: true,
      defaultCollapsed: false,
      stageMood: 'PREDATORY',
      defaultComposerPlaceholder: 'Make the room blink first…',
    },
    SYNDICATE_GAME_SCREEN: {
      mountTarget: 'SYNDICATE_GAME_SCREEN',
      defaultVisibleChannel: 'SYNDICATE',
      allowedVisibleChannels: ['SYNDICATE', 'GLOBAL', 'DEAL_ROOM'],
      allowCollapse: true,
      defaultCollapsed: false,
      stageMood: 'CEREMONIAL',
      defaultComposerPlaceholder: 'Move with the syndicate…',
    },
    POST_RUN_SUMMARY: {
      mountTarget: 'POST_RUN_SUMMARY',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      allowCollapse: false,
      defaultCollapsed: false,
      stageMood: 'MOURNFUL',
      defaultComposerPlaceholder: 'The run is over. The room is still watching.',
    },
  });

// ============================================================================
// MARK: Runtime constants and policy defaults
// ============================================================================

export interface ChatRatePolicyConfig {
  readonly perSecondBurstLimit: number;
  readonly perMinuteLimit: number;
  readonly typingHeartbeatWindowMs: number;
  readonly identicalMessageWindowMs: number;
  readonly identicalMessageMaxCount: number;
  readonly npcMinimumGapMs: number;
  readonly helperMinimumGapMs: number;
  readonly haterMinimumGapMs: number;
  readonly invasionLockMs: number;
}

export interface ChatModerationPolicyConfig {
  readonly maxCharactersPerMessage: number;
  readonly maxLinesPerMessage: number;
  readonly maskBannedLexemes: readonly string[];
  readonly rejectBannedLexemes: readonly string[];
  readonly maxConsecutiveEmojiRuns: number;
  readonly maxSuspiciousUrlCount: number;
  readonly allowSlashCommands: boolean;
  readonly rewriteAllCapsThreshold: number;
  readonly shadowModeOnHighRisk: boolean;
}

export interface ChatReplayPolicyConfig {
  readonly enabled: boolean;
  readonly maxMessagesPerRoom: number;
  readonly maxReplayArtifactsPerRoom: number;
  readonly replayTimeWindowMs: number;
}

export interface ChatLearningPolicyConfig {
  readonly enabled: boolean;
  readonly updateOnEveryAcceptedMessage: boolean;
  readonly coldStartEnabled: boolean;
  readonly emitInferenceSnapshots: boolean;
  readonly acceptClientHints: boolean;
  readonly persistProfiles: boolean;
}

export interface ChatProofPolicyConfig {
  readonly enabled: boolean;
  readonly hashAlgorithm: 'FNV1A32';
  readonly linkModerationEdges: boolean;
  readonly linkReplayEdges: boolean;
  readonly linkLearningEdges: boolean;
}

export interface ChatInvasionPolicyConfig {
  readonly enabled: boolean;
  readonly maxActivePerRoom: number;
  readonly minimumGapMs: number;
  readonly defaultDurationMs: number;
  readonly allowShadowPriming: boolean;
}

export interface ChatRuntimeConfig {
  readonly version: typeof BACKEND_CHAT_ENGINE_VERSION;
  readonly allowVisibleChannels: readonly ChatVisibleChannel[];
  readonly allowShadowChannels: readonly ChatShadowChannel[];
  readonly ratePolicy: ChatRatePolicyConfig;
  readonly moderationPolicy: ChatModerationPolicyConfig;
  readonly replayPolicy: ChatReplayPolicyConfig;
  readonly learningPolicy: ChatLearningPolicyConfig;
  readonly proofPolicy: ChatProofPolicyConfig;
  readonly invasionPolicy: ChatInvasionPolicyConfig;
}

export const CHAT_RUNTIME_DEFAULTS: Readonly<ChatRuntimeConfig> = Object.freeze({
  version: BACKEND_CHAT_ENGINE_VERSION,
  allowVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as readonly ChatVisibleChannel[],
  allowShadowChannels: [
    'SYSTEM_SHADOW',
    'NPC_SHADOW',
    'RIVALRY_SHADOW',
    'RESCUE_SHADOW',
    'LIVEOPS_SHADOW',
  ] as readonly ChatShadowChannel[],
  ratePolicy: {
    perSecondBurstLimit: 4,
    perMinuteLimit: 25,
    typingHeartbeatWindowMs: 6_000,
    identicalMessageWindowMs: 30_000,
    identicalMessageMaxCount: 2,
    npcMinimumGapMs: 1_800,
    helperMinimumGapMs: 5_500,
    haterMinimumGapMs: 7_500,
    invasionLockMs: 12_000,
  },
  moderationPolicy: {
    maxCharactersPerMessage: 480,
    maxLinesPerMessage: 8,
    maskBannedLexemes: ['idiot', 'loser', 'trash'],
    rejectBannedLexemes: ['kill yourself', 'dox', 'credit card number'],
    maxConsecutiveEmojiRuns: 8,
    maxSuspiciousUrlCount: 2,
    allowSlashCommands: true,
    rewriteAllCapsThreshold: 0.72,
    shadowModeOnHighRisk: true,
  },
  replayPolicy: {
    enabled: true,
    maxMessagesPerRoom: 4_000,
    maxReplayArtifactsPerRoom: 2_000,
    replayTimeWindowMs: 1000 * 60 * 60 * 24,
  },
  learningPolicy: {
    enabled: true,
    updateOnEveryAcceptedMessage: true,
    coldStartEnabled: true,
    emitInferenceSnapshots: true,
    acceptClientHints: false,
    persistProfiles: true,
  },
  proofPolicy: {
    enabled: true,
    hashAlgorithm: 'FNV1A32' as const,
    linkModerationEdges: true,
    linkReplayEdges: true,
    linkLearningEdges: true,
  },
  invasionPolicy: {
    enabled: true,
    maxActivePerRoom: 1,
    minimumGapMs: 45_000,
    defaultDurationMs: 22_000,
    allowShadowPriming: true,
  },
});

// ============================================================================
// MARK: Upstream gameplay signal shapes
// ============================================================================

export type PressureTier =
  | 'NONE'
  | 'BUILDING'
  | 'ELEVATED'
  | 'HIGH'
  | 'CRITICAL';

export type TickTier =
  | 'SETUP'
  | 'WINDOW'
  | 'COMMIT'
  | 'RESOLUTION'
  | 'SEAL';

export type RunOutcome =
  | 'UNRESOLVED'
  | 'SURVIVED'
  | 'FAILED'
  | 'BANKRUPT'
  | 'SOVEREIGN'
  | 'WITHDRAWN';

export type AttackType =
  | 'TAUNT'
  | 'LIQUIDATION'
  | 'SABOTAGE'
  | 'COMPLIANCE'
  | 'CROWD_SWARM'
  | 'SHADOW_LEAK';

export type BotId =
  | 'BOT_01'
  | 'BOT_02'
  | 'BOT_03'
  | 'BOT_04'
  | 'BOT_05'
  | string;

export interface ChatBattleSnapshot {
  readonly tickNumber: number;
  readonly pressureTier: PressureTier;
  readonly activeAttackType: Nullable<AttackType>;
  readonly activeBotId: Nullable<BotId>;
  readonly hostileMomentum: Score100;
  readonly rescueWindowOpen: boolean;
  readonly shieldIntegrity01: Score01;
  readonly lastAttackAt: Nullable<UnixMs>;
}

export interface ChatRunSnapshot {
  readonly runId: string;
  readonly runPhase: string;
  readonly tickTier: TickTier;
  readonly outcome: RunOutcome;
  readonly bankruptcyWarning: boolean;
  readonly nearSovereignty: boolean;
  readonly elapsedMs: number;
}

export interface ChatMultiplayerSnapshot {
  readonly roomMemberCount: number;
  readonly partySize: number;
  readonly spectatingCount: number;
  readonly factionName: Nullable<string>;
  readonly rankingPressure: Score100;
}

export interface ChatEconomySnapshot {
  readonly activeDealCount: number;
  readonly liquidityStress01: Score01;
  readonly overpayRisk01: Score01;
  readonly bluffRisk01: Score01;
}

export interface ChatLiveOpsSnapshot {
  readonly worldEventName: Nullable<string>;
  readonly heatMultiplier01: Score01;
  readonly helperBlackout: boolean;
  readonly haterRaidActive: boolean;
}

export interface ChatSignalEnvelope {
  readonly type: ChatSignalType;
  readonly emittedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly battle?: ChatBattleSnapshot;
  readonly run?: ChatRunSnapshot;
  readonly multiplayer?: ChatMultiplayerSnapshot;
  readonly economy?: ChatEconomySnapshot;
  readonly liveops?: ChatLiveOpsSnapshot;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Message content, transcript, proof, and replay
// ============================================================================

export type ChatMessageBodyPart =
  | { readonly type: 'TEXT'; readonly text: string }
  | { readonly type: 'SYSTEM_TAG'; readonly tag: string; readonly value?: string }
  | { readonly type: 'QUOTE'; readonly messageId: ChatMessageId; readonly text: string }
  | { readonly type: 'OFFER'; readonly offerId: ChatOfferId; readonly summary: string }
  | { readonly type: 'EMOTE'; readonly name: string };

export interface ChatMessageAttribution {
  readonly sourceType: ChatSourceType;
  readonly authorSessionId: Nullable<ChatSessionId>;
  readonly authorUserId: Nullable<ChatUserId>;
  readonly actorId: string;
  readonly displayName: string;
  readonly npcRole: Nullable<ChatNpcRole>;
  readonly botId: Nullable<BotId>;
}

export interface ChatMessagePolicyMetadata {
  readonly moderationOutcome: ChatModerationOutcome;
  readonly moderationReasons: readonly string[];
  readonly rateOutcome: ChatRateOutcome;
  readonly commandName: Nullable<string>;
  readonly shadowOnly: boolean;
  readonly wasRewritten: boolean;
  readonly wasMasked: boolean;
}

export interface ChatMessageReplayMetadata {
  readonly replayId: Nullable<ChatReplayId>;
  readonly replayAnchorKey: Nullable<string>;
  readonly sceneId: Nullable<ChatSceneId>;
  readonly momentId: Nullable<ChatMomentId>;
  readonly legendId: Nullable<ChatLegendId>;
}

export interface ChatMessageLearningMetadata {
  readonly learningTriggered: boolean;
  readonly affectAfterMessage: Nullable<ChatAffectSnapshot>;
  readonly inferenceSource: ChatInferenceSource;
  readonly inferenceId: Nullable<ChatInferenceId>;
}

export interface ChatMessageProofMetadata {
  readonly proofHash: Nullable<ChatProofHash>;
  readonly causalParentMessageIds: readonly ChatMessageId[];
  readonly causalParentEventIds: readonly ChatEventId[];
}

export interface ChatMessage {
  readonly id: ChatMessageId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly sequenceNumber: SequenceNumber;
  readonly createdAt: UnixMs;
  readonly editedAt: Nullable<UnixMs>;
  readonly deletedAt: Nullable<UnixMs>;
  readonly redactedAt: Nullable<UnixMs>;
  readonly bodyParts: readonly ChatMessageBodyPart[];
  readonly plainText: string;
  readonly attribution: ChatMessageAttribution;
  readonly policy: ChatMessagePolicyMetadata;
  readonly replay: ChatMessageReplayMetadata;
  readonly learning: ChatMessageLearningMetadata;
  readonly proof: ChatMessageProofMetadata;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatTranscriptEntry {
  readonly message: ChatMessage;
  readonly appendedAt: UnixMs;
  readonly visibility:
    | 'VISIBLE'
    | 'SHADOW'
    | 'REDACTED'
    | 'DELETED';
}

export interface ChatTranscriptLedger {
  readonly byRoom: Readonly<Record<ChatRoomId, readonly ChatTranscriptEntry[]>>;
  readonly byMessageId: Readonly<Record<ChatMessageId, ChatTranscriptEntry>>;
  readonly lastSequenceByRoom: Readonly<Record<ChatRoomId, SequenceNumber>>;
}

export interface ChatProofEdge {
  readonly id: ChatProofEdgeId;
  readonly roomId: ChatRoomId;
  readonly createdAt: UnixMs;
  readonly fromMessageId: Nullable<ChatMessageId>;
  readonly fromEventId: Nullable<ChatEventId>;
  readonly toMessageId: Nullable<ChatMessageId>;
  readonly toReplayId: Nullable<ChatReplayId>;
  readonly toTelemetryId: Nullable<ChatTelemetryId>;
  readonly toInferenceId: Nullable<ChatInferenceId>;
  readonly edgeType:
    | 'MESSAGE_TO_MESSAGE'
    | 'EVENT_TO_MESSAGE'
    | 'MESSAGE_TO_REPLAY'
    | 'MESSAGE_TO_TELEMETRY'
    | 'MESSAGE_TO_INFERENCE'
    | 'MODERATION_DECISION';
  readonly hash: ChatProofHash;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatProofChain {
  readonly byRoom: Readonly<Record<ChatRoomId, readonly ChatProofEdge[]>>;
  readonly byEdgeId: Readonly<Record<ChatProofEdgeId, ChatProofEdge>>;
}

export interface ChatReplayArtifact {
  readonly id: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly createdAt: UnixMs;
  readonly eventId: ChatEventId;
  readonly range: ChatRange;
  readonly anchorKey: string;
  readonly label: string;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatReplayIndex {
  readonly byRoom: Readonly<Record<ChatRoomId, readonly ChatReplayArtifact[]>>;
  readonly byReplayId: Readonly<Record<ChatReplayId, ChatReplayArtifact>>;
}

// ============================================================================
// MARK: Presence, typing, rooms, sessions
// ============================================================================

export interface ChatSessionIdentity {
  readonly sessionId: ChatSessionId;
  readonly userId: ChatUserId;
  readonly displayName: string;
  readonly role: ChatSessionRole;
  readonly entitlementTier: Nullable<string>;
  readonly factionId: Nullable<string>;
}

export interface ChatSessionState {
  readonly identity: ChatSessionIdentity;
  readonly roomIds: readonly ChatRoomId[];
  readonly connectionState: ChatConnectionState;
  readonly joinedAt: UnixMs;
  readonly lastSeenAt: UnixMs;
  readonly mutedUntil: Nullable<UnixMs>;
  readonly shadowMuted: boolean;
  readonly invisible: boolean;
  readonly transportMetadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatPresenceSnapshot {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly mode: ChatPresenceMode;
  readonly visibleToRoom: boolean;
  readonly updatedAt: UnixMs;
  readonly spectating: boolean;
  readonly actorLabel: string;
}

export interface ChatPresenceState {
  readonly byRoom: Readonly<Record<ChatRoomId, Readonly<Record<ChatSessionId, ChatPresenceSnapshot>>>>;
  readonly bySession: Readonly<Record<ChatSessionId, readonly ChatPresenceSnapshot[]>>;
}

export interface ChatTypingSnapshot {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly sessionId: ChatSessionId;
  readonly token: ChatTypingToken;
  readonly mode: ChatTypingMode;
  readonly startedAt: UnixMs;
  readonly expiresAt: UnixMs;
}

export interface ChatTypingState {
  readonly byRoom: Readonly<Record<ChatRoomId, readonly ChatTypingSnapshot[]>>;
  readonly bySession: Readonly<Record<ChatSessionId, readonly ChatTypingSnapshot[]>>;
}

export interface ChatRoomState {
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomKind;
  readonly title: string;
  readonly createdAt: UnixMs;
  readonly lastActivityAt: UnixMs;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly stageMood: ChatRoomStageMood;
  readonly collapsed: boolean;
  readonly unreadByChannel: Readonly<Record<ChatVisibleChannel, number>>;
  readonly activeSceneId: Nullable<ChatSceneId>;
  readonly activeMomentId: Nullable<ChatMomentId>;
  readonly activeLegendId: Nullable<ChatLegendId>;
}

// ============================================================================
// MARK: Relationship, affect, audience heat, rescue, and invasion
// ============================================================================

export interface ChatRelationshipState {
  readonly id: ChatRelationshipId;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly actorId: string;
  readonly trust01: Score01;
  readonly fear01: Score01;
  readonly contempt01: Score01;
  readonly fascination01: Score01;
  readonly rivalry01: Score01;
  readonly rescueDebt01: Score01;
  readonly updatedAt: UnixMs;
}

export interface ChatAffectSnapshot {
  readonly confidence01: Score01;
  readonly frustration01: Score01;
  readonly intimidation01: Score01;
  readonly attachment01: Score01;
  readonly curiosity01: Score01;
  readonly embarrassment01: Score01;
  readonly relief01: Score01;
}

export interface ChatAudienceHeat {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly heat01: Score01;
  readonly swarmDirection: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  readonly updatedAt: UnixMs;
}

export interface ChatRescueDecision {
  readonly triggered: boolean;
  readonly urgency:
    | 'NONE'
    | 'SOFT'
    | 'MEDIUM'
    | 'HARD'
    | 'CRITICAL';
  readonly reason: string;
  readonly helperPersonaId: Nullable<ChatPersonaId>;
  readonly shouldOpenRecoveryWindow: boolean;
}

export interface ChatSilenceDecision {
  readonly active: boolean;
  readonly startedAt: UnixMs;
  readonly endsAt: UnixMs;
  readonly reason: string;
}

export interface ChatInvasionState {
  readonly invasionId: ChatInvasionId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly status: 'PRIMING' | 'ACTIVE' | 'RESOLVED';
  readonly kind:
    | 'HATER_RAID'
    | 'RUMOR_BURST'
    | 'HELPER_BLACKOUT'
    | 'LIQUIDATOR_SWEEP'
    | 'SYSTEM_SHOCK';
  readonly openedAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly primedInShadow: boolean;
}

// ============================================================================
// MARK: Learning, ML/DL, memory, telemetry
// ============================================================================

export interface ChatLearningProfile {
  readonly userId: ChatUserId;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly coldStart: boolean;
  readonly engagementBaseline01: Score01;
  readonly helperReceptivity01: Score01;
  readonly haterSusceptibility01: Score01;
  readonly negotiationAggression01: Score01;
  readonly channelAffinity: Readonly<Record<ChatVisibleChannel, Score01>>;
  readonly rescueHistoryCount: number;
  readonly churnRisk01: Score01;
  readonly salienceAnchorIds: readonly ChatMemoryAnchorId[];
  readonly affect: ChatAffectSnapshot;
}

export interface ChatFeatureSnapshot {
  readonly generatedAt: UnixMs;
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly messageCountWindow: number;
  readonly inboundNpcCountWindow: number;
  readonly outboundPlayerCountWindow: number;
  readonly ignoredHelperCountWindow: number;
  readonly pressureTier: PressureTier;
  readonly hostileMomentum01: Score01;
  readonly roomHeat01: Score01;
  readonly affect: ChatAffectSnapshot;
  readonly churnRisk01: Score01;
}

export interface ChatInferenceSnapshot {
  readonly inferenceId: ChatInferenceId;
  readonly source: ChatInferenceSource;
  readonly generatedAt: UnixMs;
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly engagement01: Score01;
  readonly helperTiming01: Score01;
  readonly haterTargeting01: Score01;
  readonly channelAffinity: Readonly<Record<ChatVisibleChannel, Score01>>;
  readonly toxicityRisk01: Score01;
  readonly churnRisk01: Score01;
  readonly interventionPolicy:
    | 'NONE'
    | 'LIGHT_HELPER'
    | 'HARD_HELPER'
    | 'AMBIENT'
    | 'HATER_ESCALATE'
    | 'DEFER';
}

export interface ChatTelemetryEnvelope {
  readonly telemetryId: ChatTelemetryId;
  readonly eventName:
    | 'chat_opened'
    | 'chat_closed'
    | 'message_sent'
    | 'message_suppressed'
    | 'message_rejected'
    | 'helper_fired'
    | 'hater_escalated'
    | 'invasion_opened'
    | 'invasion_closed'
    | 'channel_switched'
    | 'dropoff_warning'
    | 'presence_updated'
    | 'typing_updated'
    | 'learning_updated';
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly createdAt: UnixMs;
  readonly payload: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: NPC personas, response candidates, scenes
// ============================================================================

export interface ChatPersonaVoiceprint {
  readonly punctuationStyle: 'HARD' | 'SOFT' | 'FORMAL' | 'ERRATIC';
  readonly avgSentenceLength: number;
  readonly delayFloorMs: number;
  readonly delayCeilingMs: number;
  readonly opener: Nullable<string>;
  readonly closer: Nullable<string>;
  readonly lexicon: readonly string[];
}

export interface ChatPersonaDescriptor {
  readonly personaId: ChatPersonaId;
  readonly actorId: string;
  readonly role: ChatNpcRole;
  readonly displayName: string;
  readonly botId: Nullable<BotId>;
  readonly voiceprint: ChatPersonaVoiceprint;
  readonly preferredChannels: readonly ChatChannelId[];
  readonly tags: readonly string[];
}

export interface ChatResponseCandidate {
  readonly personaId: ChatPersonaId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly priority: number;
  readonly text: string;
  readonly tags: readonly string[];
  readonly delayMs: number;
  readonly moderationBypassAllowed: boolean;
  readonly causeEventId: Nullable<ChatEventId>;
}

export interface ChatScenePlan {
  readonly sceneId: ChatSceneId;
  readonly roomId: ChatRoomId;
  readonly label: string;
  readonly openedAt: UnixMs;
  readonly messages: readonly ChatResponseCandidate[];
  readonly silence: Nullable<ChatSilenceDecision>;
  readonly legendCandidate: boolean;
}

// ============================================================================
// MARK: Policy results and command execution
// ============================================================================

export interface ChatRateDecision {
  readonly outcome: ChatRateOutcome;
  readonly retryAfterMs: number;
  readonly reasons: readonly string[];
}

export interface ChatModerationDecision {
  readonly outcome: ChatModerationOutcome;
  readonly reasons: readonly string[];
  readonly rewrittenText: Nullable<string>;
  readonly maskedLexemes: readonly string[];
  readonly shadowOnly: boolean;
}

export interface ChatChannelDecision {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
  readonly effectiveChannelId: ChatChannelId;
}

export interface ChatCommandExecution {
  readonly accepted: boolean;
  readonly commandName: Nullable<string>;
  readonly reasons: readonly string[];
  readonly generatedSystemMessages: readonly string[];
  readonly shadowWrites: readonly string[];
}

export interface ChatPolicyBundle {
  readonly rate: ChatRateDecision;
  readonly moderation: ChatModerationDecision;
  readonly channel: ChatChannelDecision;
  readonly command: ChatCommandExecution;
}

// ============================================================================
// MARK: Input event vocabulary
// ============================================================================

export interface ChatJoinRequest {
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomKind;
  readonly title: string;
  readonly session: ChatSessionIdentity;
  readonly mountTarget: Optional<ChatMountPolicy['mountTarget']>;
  readonly requestedVisibleChannel: Optional<ChatVisibleChannel>;
  readonly transportMetadata?: Readonly<Record<string, JsonValue>>;
}

export interface ChatLeaveRequest {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly reason: string;
}

export interface ChatPresenceUpdateRequest {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly mode: ChatPresenceMode;
  readonly spectating: boolean;
  readonly visibleToRoom: boolean;
}

export interface ChatTypingUpdateRequest {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly channelId: ChatVisibleChannel;
  readonly mode: ChatTypingMode;
}

export interface ChatPlayerMessageSubmitRequest {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly channelId: ChatVisibleChannel;
  readonly requestId: ChatRequestId;
  readonly text: string;
  readonly clientHints?: Readonly<Record<string, JsonValue>>;
}

export type ChatInputEnvelope =
  | {
      readonly kind: 'SESSION_JOIN_REQUEST';
      readonly emittedAt: UnixMs;
      readonly payload: ChatJoinRequest;
    }
  | {
      readonly kind: 'SESSION_LEAVE';
      readonly emittedAt: UnixMs;
      readonly payload: ChatLeaveRequest;
    }
  | {
      readonly kind: 'PRESENCE_UPDATED';
      readonly emittedAt: UnixMs;
      readonly payload: ChatPresenceUpdateRequest;
    }
  | {
      readonly kind: 'TYPING_UPDATED';
      readonly emittedAt: UnixMs;
      readonly payload: ChatTypingUpdateRequest;
    }
  | {
      readonly kind: 'PLAYER_MESSAGE_SUBMIT';
      readonly emittedAt: UnixMs;
      readonly payload: ChatPlayerMessageSubmitRequest;
    }
  | {
      readonly kind: 'BATTLE_SIGNAL';
      readonly emittedAt: UnixMs;
      readonly payload: ChatSignalEnvelope;
    }
  | {
      readonly kind: 'RUN_SIGNAL';
      readonly emittedAt: UnixMs;
      readonly payload: ChatSignalEnvelope;
    }
  | {
      readonly kind: 'MULTIPLAYER_SIGNAL';
      readonly emittedAt: UnixMs;
      readonly payload: ChatSignalEnvelope;
    }
  | {
      readonly kind: 'ECONOMY_SIGNAL';
      readonly emittedAt: UnixMs;
      readonly payload: ChatSignalEnvelope;
    }
  | {
      readonly kind: 'LIVEOPS_SIGNAL';
      readonly emittedAt: UnixMs;
      readonly payload: ChatSignalEnvelope;
    }
  | {
      readonly kind: 'MAINTENANCE_TICK';
      readonly emittedAt: UnixMs;
      readonly payload: {
        readonly reason: string;
      };
    };

// ============================================================================
// MARK: Normalized event vocabulary
// ============================================================================

export interface ChatNormalizedEvent<TPayload = JsonValue> {
  readonly eventId: ChatEventId;
  readonly kind: ChatEventKind;
  readonly emittedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly payload: TPayload;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export type ChatNormalizedInput =
  | ChatNormalizedEvent<ChatJoinRequest>
  | ChatNormalizedEvent<ChatLeaveRequest>
  | ChatNormalizedEvent<ChatPresenceUpdateRequest>
  | ChatNormalizedEvent<ChatTypingUpdateRequest>
  | ChatNormalizedEvent<ChatPlayerMessageSubmitRequest>
  | ChatNormalizedEvent<ChatSignalEnvelope>
  | ChatNormalizedEvent<{ readonly reason: string }>;

// ============================================================================
// MARK: Full authoritative state
// ============================================================================

export interface ChatPendingReveal {
  readonly revealAt: UnixMs;
  readonly roomId: ChatRoomId;
  readonly message: ChatMessage;
}

export interface ChatPendingRequestState {
  readonly requestId: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly messageId: ChatMessageId;
  readonly createdAt: UnixMs;
}

export interface ChatRoomSessionIndex {
  readonly byRoom: Readonly<Record<ChatRoomId, readonly ChatSessionId[]>>;
  readonly bySession: Readonly<Record<ChatSessionId, readonly ChatRoomId[]>>;
}

export interface ChatState {
  readonly version: typeof BACKEND_CHAT_ENGINE_VERSION;
  readonly bootedAt: UnixMs;
  readonly runtime: ChatRuntimeConfig;
  readonly rooms: Readonly<Record<ChatRoomId, ChatRoomState>>;
  readonly sessions: Readonly<Record<ChatSessionId, ChatSessionState>>;
  readonly roomSessions: ChatRoomSessionIndex;
  readonly presence: ChatPresenceState;
  readonly typing: ChatTypingState;
  readonly transcript: ChatTranscriptLedger;
  readonly proofChain: ChatProofChain;
  readonly replay: ChatReplayIndex;
  readonly relationships: Readonly<Record<ChatRelationshipId, ChatRelationshipState>>;
  readonly learningProfiles: Readonly<Record<ChatUserId, ChatLearningProfile>>;
  readonly inferenceSnapshots: Readonly<Record<ChatInferenceId, ChatInferenceSnapshot>>;
  readonly audienceHeatByRoom: Readonly<Record<ChatRoomId, ChatAudienceHeat>>;
  readonly activeInvasions: Readonly<Record<ChatInvasionId, ChatInvasionState>>;
  readonly silencesByRoom: Readonly<Record<ChatRoomId, ChatSilenceDecision>>;
  readonly pendingReveals: readonly ChatPendingReveal[];
  readonly pendingRequests: Readonly<Record<ChatRequestId, ChatPendingRequestState>>;
  readonly telemetryQueue: readonly ChatTelemetryEnvelope[];
  readonly lastEventByRoom: Readonly<Record<ChatRoomId, ChatEventId>>;
  readonly lastEventAtByRoom: Readonly<Record<ChatRoomId, UnixMs>>;
}

// ============================================================================
// MARK: Diffs, emissions, and transaction outputs
// ============================================================================

export interface ChatStateDelta {
  readonly acceptedEventId: ChatEventId;
  readonly touchedRoomIds: readonly ChatRoomId[];
  readonly touchedSessionIds: readonly ChatSessionId[];
  readonly appendedMessages: readonly ChatMessage[];
  readonly redactedMessageIds: readonly ChatMessageId[];
  readonly replayArtifacts: readonly ChatReplayArtifact[];
  readonly proofEdges: readonly ChatProofEdge[];
  readonly telemetry: readonly ChatTelemetryEnvelope[];
  readonly learningProfilesTouched: readonly ChatUserId[];
  readonly inferenceSnapshots: readonly ChatInferenceSnapshot[];
}

export interface ChatFanoutPacket {
  readonly roomId: ChatRoomId;
  readonly visibleMessages: readonly ChatMessage[];
  readonly shadowMessages: readonly ChatMessage[];
  readonly presence: readonly ChatPresenceSnapshot[];
  readonly typing: readonly ChatTypingSnapshot[];
  readonly roomState: ChatRoomState;
  readonly telemetryIds: readonly ChatTelemetryId[];
}

export interface ChatEngineTransaction {
  readonly accepted: boolean;
  readonly rejected: boolean;
  readonly event: ChatNormalizedInput;
  readonly rejectionReasons: readonly string[];
  readonly policy: Nullable<ChatPolicyBundle>;
  readonly delta: Nullable<ChatStateDelta>;
  readonly fanout: readonly ChatFanoutPacket[];
  readonly state: ChatState;
}

// ============================================================================
// MARK: Backend engine ports
// ============================================================================

export interface ChatClockPort {
  now(): number;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(token: unknown): void;
}

export interface ChatIdFactoryPort {
  eventId(prefix?: string): ChatEventId;
  messageId(prefix?: string): ChatMessageId;
  replayId(prefix?: string): ChatReplayId;
  telemetryId(prefix?: string): ChatTelemetryId;
  proofEdgeId(prefix?: string): ChatProofEdgeId;
  inferenceId(prefix?: string): ChatInferenceId;
  invasionId(prefix?: string): ChatInvasionId;
  relationshipId(prefix?: string): ChatRelationshipId;
}

export interface ChatHashPort {
  hash(input: string): ChatProofHash;
}

export interface ChatLoggerPort {
  debug(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, context?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatPersistencePort {
  saveState?(state: ChatState): void | Promise<void>;
  saveTelemetry?(batch: readonly ChatTelemetryEnvelope[]): void | Promise<void>;
  saveReplay?(artifacts: readonly ChatReplayArtifact[]): void | Promise<void>;
  saveLearningProfiles?(profiles: readonly ChatLearningProfile[]): void | Promise<void>;
}

export interface ChatFanoutPort {
  publish(packet: ChatFanoutPacket): void | Promise<void>;
}

export interface ChatTelemetryPort {
  emit(batch: readonly ChatTelemetryEnvelope[]): void | Promise<void>;
}

export interface ChatReplayPort {
  publish(artifacts: readonly ChatReplayArtifact[]): void | Promise<void>;
}

export interface ChatLearningPort {
  publishProfiles?(profiles: readonly ChatLearningProfile[]): void | Promise<void>;
  publishInference?(snapshots: readonly ChatInferenceSnapshot[]): void | Promise<void>;
}

export interface ChatRandomPort {
  next(): number;
}

export interface ChatEnginePorts {
  readonly clock?: ChatClockPort;
  readonly ids?: ChatIdFactoryPort;
  readonly hash?: ChatHashPort;
  readonly logger?: ChatLoggerPort;
  readonly persistence?: ChatPersistencePort;
  readonly fanout?: ChatFanoutPort;
  readonly telemetry?: ChatTelemetryPort;
  readonly replay?: ChatReplayPort;
  readonly learning?: ChatLearningPort;
  readonly random?: ChatRandomPort;
}

export interface ChatEngineOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly ports?: ChatEnginePorts;
  readonly now?: number;
}

// ============================================================================
// MARK: Public backend chat engine API
// ============================================================================

export interface ChatEngineObserver {
  (state: DeepReadonly<ChatState>, tx: DeepReadonly<ChatEngineTransaction>): void;
}

export interface ChatEventObserver {
  (tx: DeepReadonly<ChatEngineTransaction>): void;
}

export interface ChatEnginePublicApi {
  getState(): DeepReadonly<ChatState>;
  subscribeState(observer: ChatEngineObserver): () => void;
  subscribeEvents(observer: ChatEventObserver): () => void;
  ingest(input: ChatInputEnvelope): Promise<ChatEngineTransaction>;
  tick(reason: string): Promise<ChatEngineTransaction>;
  shutdown(): Promise<void>;
}

// ============================================================================
// MARK: Compile-safe helper predicates
// ============================================================================

export function isVisibleChannelId(value: string): value is ChatVisibleChannel {
  return (CHAT_VISIBLE_CHANNELS as readonly string[]).includes(value);
}

export function isShadowChannelId(value: string): value is ChatShadowChannel {
  return (CHAT_SHADOW_CHANNELS as readonly string[]).includes(value);
}

export function isAnyChannelId(value: string): value is ChatChannelId {
  return (CHAT_ALL_CHANNELS as readonly string[]).includes(value);
}

export function isRoomKind(value: string): value is ChatRoomKind {
  return (CHAT_ROOM_KINDS as readonly string[]).includes(value);
}

export function clamp01(value: number): Score01 {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return clamped as Score01;
}

export function clamp100(value: number): Score100 {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return clamped as Score100;
}

export function asUnixMs(value: number): UnixMs {
  return Math.max(0, Math.floor(value)) as UnixMs;
}

export function asSequenceNumber(value: number): SequenceNumber {
  return Math.max(0, Math.floor(value)) as SequenceNumber;
}

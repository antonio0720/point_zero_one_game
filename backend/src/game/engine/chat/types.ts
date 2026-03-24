
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ENGINE TYPES
 * FILE: backend/src/game/engine/chat/types.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
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

export const CHAT_CHANNEL_MOODS = [
  'CALM',
  'WATCHFUL',
  'HEATED',
  'HOSTILE',
  'PANIC',
  'PREDATORY',
  'CEREMONIAL',
] as const;

/** Real-time crowd mood signal consumed by social planners (SwarmReactionPlanner, etc.). */
export type ChatChannelMood = (typeof CHAT_CHANNEL_MOODS)[number];

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

// ============================================================================
// MARK: Branded type cast helpers
// ============================================================================

export function asChatRoomId(value: string): ChatRoomId {
  return value as ChatRoomId;
}

export function asChatSessionId(value: string): ChatSessionId {
  return value as ChatSessionId;
}

export function asChatUserId(value: string): ChatUserId {
  return value as ChatUserId;
}

export function asChatMessageId(value: string): ChatMessageId {
  return value as ChatMessageId;
}

export function asChatEventId(value: string): ChatEventId {
  return value as ChatEventId;
}

export function asChatInvasionId(value: string): ChatInvasionId {
  return value as ChatInvasionId;
}

export function asChatPersonaId(value: string): ChatPersonaId {
  return value as ChatPersonaId;
}

export function asChatSceneId(value: string): ChatSceneId {
  return value as ChatSceneId;
}

export function asChatProofHash(value: string): ChatProofHash {
  return value as ChatProofHash;
}

export function asChatRelationshipId(value: string): ChatRelationshipId {
  return value as ChatRelationshipId;
}

export function asChatRequestId(value: string): ChatRequestId {
  return value as ChatRequestId;
}

export function asChatReplayId(value: string): ChatReplayId {
  return value as ChatReplayId;
}

export function asChatTelemetryId(value: string): ChatTelemetryId {
  return value as ChatTelemetryId;
}

export function asChatInferenceId(value: string): ChatInferenceId {
  return value as ChatInferenceId;
}

export function asChatMomentId(value: string): ChatMomentId {
  return value as ChatMomentId;
}

export function asChatLegendId(value: string): ChatLegendId {
  return value as ChatLegendId;
}

export function asChatMemoryAnchorId(value: string): ChatMemoryAnchorId {
  return value as ChatMemoryAnchorId;
}

export function asChatProofEdgeId(value: string): ChatProofEdgeId {
  return value as ChatProofEdgeId;
}

export function asChatTypingToken(value: string): ChatTypingToken {
  return value as ChatTypingToken;
}

// ============================================================================
// MARK: Type guard helpers
// ============================================================================

export function isChatRoomId(value: string): value is ChatRoomId {
  return typeof value === 'string' && value.length > 0;
}

export function isChatSessionId(value: string): value is ChatSessionId {
  return typeof value === 'string' && value.length > 0;
}

export function isChatUserId(value: string): value is ChatUserId {
  return typeof value === 'string' && value.length > 0;
}

export function isChatMessageId(value: string): value is ChatMessageId {
  return typeof value === 'string' && value.length > 0;
}

export function isChatEventKind(value: string): value is ChatEventKind {
  return (CHAT_EVENT_KINDS as readonly string[]).includes(value);
}

export function isChatConnectionState(value: string): value is ChatConnectionState {
  return (CHAT_CONNECTION_STATES as readonly string[]).includes(value);
}

export function isChatPresenceMode(value: string): value is ChatPresenceMode {
  return (CHAT_PRESENCE_STATES as readonly string[]).includes(value);
}

export function isChatTypingMode(value: string): value is ChatTypingMode {
  return (CHAT_TYPING_STATES as readonly string[]).includes(value);
}

export function isChatModerationOutcome(value: string): value is ChatModerationOutcome {
  return (CHAT_MODERATION_OUTCOMES as readonly string[]).includes(value);
}

export function isChatSourceType(value: string): value is ChatSourceType {
  return (CHAT_SOURCE_TYPES as readonly string[]).includes(value);
}

// ============================================================================
// MARK: Null/undefined helpers
// ============================================================================

export function isNullable<T>(value: T | null | undefined): value is null | undefined {
  return value == null;
}

export function unwrapNullable<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}

export function assertDefined<T>(value: T | null | undefined, label?: string): T {
  if (value == null) throw new Error(`Expected defined value${label ? ` for ${label}` : ''}`);
  return value;
}

// ============================================================================
// MARK: JSON helpers
// ============================================================================

export function isJsonPrimitive(value: JsonValue): value is JsonPrimitive {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

export function jsonValueToString(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

// ============================================================================
// MARK: ChatState field accessors
// ============================================================================

export function chatStateRoomIds(state: ChatState): readonly ChatRoomId[] {
  return Object.freeze(Object.keys(state.rooms) as ChatRoomId[]);
}

export function chatStateSessionIds(state: ChatState): readonly ChatSessionId[] {
  return Object.freeze(Object.keys(state.sessions) as ChatSessionId[]);
}

export function chatStateActiveInvasionIds(state: ChatState): readonly ChatInvasionId[] {
  return Object.freeze(Object.keys(state.activeInvasions) as ChatInvasionId[]);
}

export function chatStateHasRoom(state: ChatState, roomId: ChatRoomId): boolean {
  return Object.prototype.hasOwnProperty.call(state.rooms, roomId);
}

export function chatStateHasSession(state: ChatState, sessionId: ChatSessionId): boolean {
  return Object.prototype.hasOwnProperty.call(state.sessions, sessionId);
}

export function chatStateRoomCount(state: ChatState): number {
  return Object.keys(state.rooms).length;
}

export function chatStateSessionCount(state: ChatState): number {
  return Object.keys(state.sessions).length;
}

export function chatStateActiveInvasionCount(state: ChatState): number {
  return Object.keys(state.activeInvasions).length;
}

export function chatStateGetRoom(state: ChatState, roomId: ChatRoomId): ChatRoomState | null {
  return state.rooms[roomId] ?? null;
}

export function chatStateGetSession(state: ChatState, sessionId: ChatSessionId): ChatSessionState | null {
  return state.sessions[sessionId] ?? null;
}

export function chatStateGetAudienceHeat(state: ChatState, roomId: ChatRoomId): ChatAudienceHeat | null {
  return state.audienceHeatByRoom[roomId] ?? null;
}

export function chatStateGetSilence(state: ChatState, roomId: ChatRoomId): ChatSilenceDecision | null {
  return state.silencesByRoom[roomId] ?? null;
}

export function chatStateGetLastEventId(state: ChatState, roomId: ChatRoomId): ChatEventId | null {
  return state.lastEventByRoom[roomId] ?? null;
}

export function chatStateGetLastEventAt(state: ChatState, roomId: ChatRoomId): UnixMs | null {
  return state.lastEventAtByRoom[roomId] ?? null;
}

export function chatStateGetInvasion(state: ChatState, invasionId: ChatInvasionId): ChatInvasionState | null {
  return state.activeInvasions[invasionId] ?? null;
}

export function chatStateGetLearningProfile(state: ChatState, userId: ChatUserId): ChatLearningProfile | null {
  return state.learningProfiles[userId] ?? null;
}

export function chatStateGetRelationship(state: ChatState, relId: ChatRelationshipId): ChatRelationshipState | null {
  return state.relationships[relId] ?? null;
}

export function chatStateGetPresence(state: ChatState, roomId: ChatRoomId, sessionId: ChatSessionId): ChatPresenceSnapshot | null {
  return state.presence.byRoom[roomId]?.[sessionId] ?? null;
}

export function chatStateGetTyping(state: ChatState, roomId: ChatRoomId): readonly ChatTypingSnapshot[] {
  return state.typing.byRoom[roomId] ?? [];
}

export function chatStateGetProofEdges(state: ChatState, roomId: ChatRoomId): readonly ChatProofEdge[] {
  return state.proofChain.byRoom[roomId] ?? [];
}

export function chatStateGetReplayArtifacts(state: ChatState, roomId: ChatRoomId): readonly ChatReplayArtifact[] {
  return state.replay.byRoom[roomId] ?? [];
}

export function chatStateGetSessionsForRoom(state: ChatState, roomId: ChatRoomId): readonly ChatSessionId[] {
  return state.roomSessions.byRoom[roomId] ?? [];
}

export function chatStateGetRoomsForSession(state: ChatState, sessionId: ChatSessionId): readonly ChatRoomId[] {
  return state.roomSessions.bySession[sessionId] ?? [];
}

// ============================================================================
// MARK: Score comparison helpers
// ============================================================================

export function scoreAbove(score: Score01, threshold: number): boolean {
  return (score as unknown as number) >= threshold;
}

export function scoreBelow(score: Score01, threshold: number): boolean {
  return (score as unknown as number) <= threshold;
}

export function scoreToPercent(score: Score01): number {
  return Math.round((score as unknown as number) * 100);
}

// ============================================================================
// MARK: UnixMs helpers
// ============================================================================

export function unixMsToDate(ms: UnixMs): Date {
  return new Date(ms as unknown as number);
}

export function unixMsAge(ms: UnixMs, now: UnixMs): number {
  return (now as unknown as number) - (ms as unknown as number);
}

export function unixMsIsExpired(ms: UnixMs, now: UnixMs): boolean {
  return (ms as unknown as number) <= (now as unknown as number);
}

export function unixMsIsInFuture(ms: UnixMs, now: UnixMs): boolean {
  return (ms as unknown as number) > (now as unknown as number);
}

export function unixMsAdd(ms: UnixMs, deltaMs: number): UnixMs {
  return asUnixMs((ms as unknown as number) + deltaMs);
}

export function unixMsSub(ms: UnixMs, deltaMs: number): UnixMs {
  return asUnixMs(Math.max(0, (ms as unknown as number) - deltaMs));
}

// ============================================================================
// MARK: Presence and connection state helpers
// ============================================================================

export function presenceModeIsActive(mode: ChatPresenceMode): boolean {
  return mode === 'ONLINE' || mode === 'SPECTATING';
}

export function presenceModeIsOffline(mode: ChatPresenceMode): boolean {
  return mode === 'DISCONNECTED' || mode === 'RECONNECTING';
}

export function connectionStateIsLive(state: ChatConnectionState): boolean {
  return state === 'ATTACHED';
}

export function connectionStateIsDetached(state: ChatConnectionState): boolean {
  return state === 'DETACHED' || state === 'DISCONNECTED';
}

// ============================================================================
// MARK: Channel helpers
// ============================================================================

export function channelIsVisible(channelId: ChatChannelId): boolean {
  return isVisibleChannelId(channelId);
}

export function channelIsShadow(channelId: ChatChannelId): boolean {
  return isShadowChannelId(channelId);
}

export function visibleChannelIndex(channel: ChatVisibleChannel): number {
  return CHAT_VISIBLE_CHANNELS.indexOf(channel);
}

// ============================================================================
// MARK: Room kind helpers
// ============================================================================

export function roomKindIsGlobal(kind: ChatRoomKind): boolean {
  return kind === 'GLOBAL';
}

export function roomKindIsPrivate(kind: ChatRoomKind): boolean {
  return kind === 'PRIVATE';
}

export function roomKindIsSystem(kind: ChatRoomKind): boolean {
  return kind === 'SYSTEM';
}

// ============================================================================
// MARK: Invasion kind helpers
// ============================================================================

export function invasionKindIsHaterRaid(kind: ChatInvasionState['kind']): boolean {
  return kind === 'HATER_RAID';
}

export function invasionKindIsHelperBlackout(kind: ChatInvasionState['kind']): boolean {
  return kind === 'HELPER_BLACKOUT';
}

export function invasionKindIsSystemShock(kind: ChatInvasionState['kind']): boolean {
  return kind === 'SYSTEM_SHOCK';
}

export function invasionStatusIsActive(status: ChatInvasionState['status']): boolean {
  return status === 'ACTIVE';
}

export function invasionStatusIsResolved(status: ChatInvasionState['status']): boolean {
  return status === 'RESOLVED';
}

// ============================================================================
// MARK: Moderation outcome helpers
// ============================================================================

export function moderationOutcomeAllows(outcome: ChatModerationOutcome): boolean {
  return outcome === 'ALLOW' || outcome === 'MASK' || outcome === 'REWRITE' || outcome === 'SHADOW_ONLY';
}

export function moderationOutcomeBlocks(outcome: ChatModerationOutcome): boolean {
  return outcome === 'REJECT' || outcome === 'QUARANTINE' || outcome === 'THROTTLE';
}

// ============================================================================
// MARK: Rate outcome helpers
// ============================================================================

export function rateOutcomeAllows(outcome: ChatRateOutcome): boolean {
  return outcome === 'ALLOW';
}

export function rateOutcomeBlocks(outcome: ChatRateOutcome): boolean {
  return outcome === 'LOCK' || outcome === 'THROTTLE';
}

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_TYPES_MODULE_ID = 'chat_types' as const;
export const CHAT_TYPES_MODULE_VERSION = BACKEND_CHAT_ENGINE_VERSION;

export const CHAT_TYPES_MODULE_DESCRIPTOR = Object.freeze({
  moduleId: CHAT_TYPES_MODULE_ID,
  version: CHAT_TYPES_MODULE_VERSION,
  visibleChannelCount: CHAT_VISIBLE_CHANNELS.length,
  shadowChannelCount: CHAT_SHADOW_CHANNELS.length,
  allChannelCount: CHAT_ALL_CHANNELS.length,
  roomKindCount: CHAT_ROOM_KINDS.length,
  sourceTypeCount: CHAT_SOURCE_TYPES.length,
  eventKindCount: CHAT_EVENT_KINDS.length,
  connectionStateCount: CHAT_CONNECTION_STATES.length,
  presenceModeCount: CHAT_PRESENCE_STATES.length,
  typingModeCount: CHAT_TYPING_STATES.length,
  moderationOutcomeCount: CHAT_MODERATION_OUTCOMES.length,
});

// ============================================================================
// MARK: Additional branded cast helpers
// ============================================================================

export function asChatOfferId(value: string): ChatOfferId {
  return value as ChatOfferId;
}

export function asChatDriftId(value: string): ChatDriftId {
  return value as ChatDriftId;
}

// ============================================================================
// MARK: Additional type predicate helpers
// ============================================================================

export function isChatSessionRole(value: string): value is ChatSessionRole {
  return (CHAT_SESSION_ROLES as readonly string[]).includes(value);
}

export function isChatNpcRole(value: string): value is ChatNpcRole {
  return (CHAT_NPC_ROLES as readonly string[]).includes(value);
}

export function isChatInferenceSource(value: string): value is ChatInferenceSource {
  return (CHAT_INFERENCE_SOURCES as readonly string[]).includes(value);
}

export function isChatRoomStageMood(value: string): value is ChatRoomStageMood {
  return (CHAT_ROOM_STAGE_MOODS as readonly string[]).includes(value);
}

export function isChatChannelMood(value: string): value is ChatChannelMood {
  return (CHAT_CHANNEL_MOODS as readonly string[]).includes(value);
}

export function isChatSignalType(value: string): value is ChatSignalType {
  return (CHAT_SIGNAL_TYPES as readonly string[]).includes(value);
}

export function isChatRateOutcome(value: string): value is ChatRateOutcome {
  return (CHAT_RATE_OUTCOMES as readonly string[]).includes(value);
}

export function isChatPressureTier(value: string): value is PressureTier {
  const tiers: readonly string[] = ['NONE', 'BUILDING', 'ELEVATED', 'HIGH', 'CRITICAL'];
  return tiers.includes(value);
}

export function isChatTickTier(value: string): value is TickTier {
  const tiers: readonly string[] = ['SETUP', 'WINDOW', 'COMMIT', 'RESOLUTION', 'SEAL'];
  return tiers.includes(value);
}

export function isChatAuthorityRootKey(value: string): value is ChatAuthorityRootKey {
  return Object.prototype.hasOwnProperty.call(CHAT_AUTHORITY_ROOTS, value);
}

// ============================================================================
// MARK: Authority root accessors
// ============================================================================

/** Returns the filesystem root for the given chat authority domain. */
export function getAuthorityRoot(key: ChatAuthorityRootKey): string {
  return CHAT_AUTHORITY_ROOTS[key];
}

/** Joins a sub-path onto the backend engine root. */
export function resolveBackendEnginePath(subPath: string): string {
  return `${CHAT_AUTHORITY_ROOTS.backendEngineRoot}/${subPath}`;
}

/** Joins a sub-path onto the backend learning root. */
export function resolveBackendLearningPath(subPath: string): string {
  return `${CHAT_AUTHORITY_ROOTS.backendLearningRoot}/${subPath}`;
}

/** Joins a sub-path onto the shared contracts root. */
export function resolveSharedContractPath(subPath: string): string {
  return `${CHAT_AUTHORITY_ROOTS.sharedContractsRoot}/${subPath}`;
}

/** Joins a sub-path onto the shared learning contracts root. */
export function resolveSharedLearningPath(subPath: string): string {
  return `${CHAT_AUTHORITY_ROOTS.sharedLearningRoot}/${subPath}`;
}

/** Joins a sub-path onto the frontend engine root. */
export function resolveFrontendEnginePath(subPath: string): string {
  return `${CHAT_AUTHORITY_ROOTS.frontendEngineRoot}/${subPath}`;
}

/** Joins a sub-path onto the frontend UI root. */
export function resolveFrontendUiPath(subPath: string): string {
  return `${CHAT_AUTHORITY_ROOTS.frontendUiRoot}/${subPath}`;
}

/** Joins a sub-path onto the server transport root. */
export function resolveServerTransportPath(subPath: string): string {
  return `${CHAT_AUTHORITY_ROOTS.serverTransportRoot}/${subPath}`;
}

/** Returns all defined authority root keys. */
export function listAuthorityRootKeys(): readonly ChatAuthorityRootKey[] {
  return Object.freeze(Object.keys(CHAT_AUTHORITY_ROOTS) as ChatAuthorityRootKey[]);
}

// ============================================================================
// MARK: Channel descriptor accessors
// ============================================================================

/** Returns the full descriptor for the given channel. */
export function getChannelDescriptor(channelId: ChatChannelId): ChatChannelDescriptor {
  return CHAT_CHANNEL_DESCRIPTORS[channelId];
}

/** Returns true if the channel supports a composer (players can type). */
export function channelSupportsComposer(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsComposer;
}

/** Returns true if the channel tracks per-session presence. */
export function channelSupportsPresence(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsPresence;
}

/** Returns true if the channel emits typing indicators. */
export function channelSupportsTyping(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsTyping;
}

/** Returns true if the channel tracks read receipts. */
export function channelSupportsReadReceipts(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsReadReceipts;
}

/** Returns true if the channel produces replay artifacts. */
export function channelSupportsReplay(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsReplay;
}

/** Returns true if the channel contributes to crowd heat scoring. */
export function channelSupportsCrowdHeat(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsCrowdHeat;
}

/** Returns true if the channel accepts NPC injections. */
export function channelSupportsNpcInjection(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsNpcInjection;
}

/** Returns true if the channel is a deal / negotiation channel. */
export function channelSupportsNegotiation(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsNegotiation;
}

/** Returns true if the channel can host helper rescue sequences. */
export function channelSupportsRescue(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsRescue;
}

/** Returns true if the channel allows shadow-lane writes. */
export function channelSupportsShadowWrites(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsShadowWrites;
}

/** Returns true if the channel is visible to the player. */
export function channelIsVisibleToPlayer(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].visibleToPlayer;
}

/** Returns the persistence class for a given channel. */
export function channelPersistenceClass(
  channelId: ChatChannelId,
): ChatChannelDescriptor['persistenceClass'] {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].persistenceClass;
}

/** Returns true if the channel's persistence is transient (cleared after run). */
export function channelIsTransient(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].persistenceClass === 'TRANSIENT';
}

/** Returns true if the channel's messages are scoped to a single run. */
export function channelIsRunScoped(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].persistenceClass === 'RUN_SCOPED';
}

/** Returns true if the channel's messages persist across runs (account-scoped). */
export function channelIsAccountScoped(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].persistenceClass === 'ACCOUNT_SCOPED';
}

/** Returns all visible channels whose descriptors match the given predicate. */
export function filterVisibleChannelsByDescriptor(
  predicate: (descriptor: ChatChannelDescriptor) => boolean,
): readonly ChatVisibleChannel[] {
  return CHAT_VISIBLE_CHANNELS.filter((ch) => predicate(CHAT_CHANNEL_DESCRIPTORS[ch]));
}

/** Returns all shadow channels whose descriptors match the given predicate. */
export function filterShadowChannelsByDescriptor(
  predicate: (descriptor: ChatChannelDescriptor) => boolean,
): readonly ChatShadowChannel[] {
  return CHAT_SHADOW_CHANNELS.filter((ch) => predicate(CHAT_CHANNEL_DESCRIPTORS[ch]));
}

/** Returns all channels (visible + shadow) that support NPC injection. */
export function listNpcInjectionChannels(): readonly ChatChannelId[] {
  return CHAT_ALL_CHANNELS.filter((ch) => CHAT_CHANNEL_DESCRIPTORS[ch].supportsNpcInjection);
}

/** Returns all channels that support crowd heat signals. */
export function listCrowdHeatChannels(): readonly ChatChannelId[] {
  return CHAT_ALL_CHANNELS.filter((ch) => CHAT_CHANNEL_DESCRIPTORS[ch].supportsCrowdHeat);
}

/** Returns all channels that support rescue sequences. */
export function listRescueChannels(): readonly ChatChannelId[] {
  return CHAT_ALL_CHANNELS.filter((ch) => CHAT_CHANNEL_DESCRIPTORS[ch].supportsRescue);
}

/** Returns all channels that support shadow writes. */
export function listShadowWriteChannels(): readonly ChatChannelId[] {
  return CHAT_ALL_CHANNELS.filter((ch) => CHAT_CHANNEL_DESCRIPTORS[ch].supportsShadowWrites);
}

// ============================================================================
// MARK: Mount policy accessors
// ============================================================================

export type ChatMountTarget = ChatMountPolicy['mountTarget'];

/** Returns all valid mount targets. */
export const CHAT_MOUNT_TARGETS: readonly ChatMountTarget[] = Object.freeze([
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
] as const);

/** Returns true if the value is a valid mount target. */
export function isChatMountTarget(value: string): value is ChatMountTarget {
  return (CHAT_MOUNT_TARGETS as readonly string[]).includes(value);
}

/** Returns the full mount policy for the given target. */
export function getMountPolicy(target: ChatMountTarget): ChatMountPolicy {
  return CHAT_MOUNT_POLICIES[target];
}

/** Returns the default visible channel for the given mount target. */
export function mountTargetDefaultChannel(target: ChatMountTarget): ChatVisibleChannel {
  return CHAT_MOUNT_POLICIES[target].defaultVisibleChannel;
}

/** Returns the allowed visible channels for the given mount target. */
export function mountTargetAllowedChannels(target: ChatMountTarget): readonly ChatVisibleChannel[] {
  return CHAT_MOUNT_POLICIES[target].allowedVisibleChannels;
}

/** Returns true if the chat panel can be collapsed at this mount target. */
export function mountTargetAllowsCollapse(target: ChatMountTarget): boolean {
  return CHAT_MOUNT_POLICIES[target].allowCollapse;
}

/** Returns true if the chat panel should start collapsed at this mount target. */
export function mountTargetDefaultsCollapsed(target: ChatMountTarget): boolean {
  return CHAT_MOUNT_POLICIES[target].defaultCollapsed;
}

/** Returns the stage mood associated with the given mount target. */
export function mountTargetStageMood(target: ChatMountTarget): ChatRoomStageMood {
  return CHAT_MOUNT_POLICIES[target].stageMood;
}

/** Returns the composer placeholder text for the given mount target. */
export function mountTargetComposerPlaceholder(target: ChatMountTarget): string {
  return CHAT_MOUNT_POLICIES[target].defaultComposerPlaceholder;
}

/** Returns true if the given channel is allowed at the given mount target. */
export function mountTargetAllowsChannel(
  target: ChatMountTarget,
  channelId: ChatVisibleChannel,
): boolean {
  return CHAT_MOUNT_POLICIES[target].allowedVisibleChannels.includes(channelId);
}

/** Returns all mount targets that expose the given visible channel by default. */
export function listMountTargetsWithDefaultChannel(
  channelId: ChatVisibleChannel,
): readonly ChatMountTarget[] {
  return CHAT_MOUNT_TARGETS.filter(
    (t) => CHAT_MOUNT_POLICIES[t].defaultVisibleChannel === channelId,
  );
}

/** Returns all mount targets whose default stage mood matches the given value. */
export function listMountTargetsByStageMood(mood: ChatRoomStageMood): readonly ChatMountTarget[] {
  return CHAT_MOUNT_TARGETS.filter((t) => CHAT_MOUNT_POLICIES[t].stageMood === mood);
}

/** Returns all mount targets that start collapsed. */
export function listCollapsedByDefaultMountTargets(): readonly ChatMountTarget[] {
  return CHAT_MOUNT_TARGETS.filter((t) => CHAT_MOUNT_POLICIES[t].defaultCollapsed);
}

// ============================================================================
// MARK: Runtime config helpers
// ============================================================================

/**
 * Creates a fully populated runtime config by merging a partial override
 * onto the authoritative defaults. Safe to call at engine boot time.
 */
export function mergeRuntimeConfig(
  partial: Partial<ChatRuntimeConfig>,
): Readonly<ChatRuntimeConfig> {
  return Object.freeze({
    ...CHAT_RUNTIME_DEFAULTS,
    ...partial,
    ratePolicy: Object.freeze({
      ...CHAT_RUNTIME_DEFAULTS.ratePolicy,
      ...(partial.ratePolicy ?? {}),
    }),
    moderationPolicy: Object.freeze({
      ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
      ...(partial.moderationPolicy ?? {}),
    }),
    replayPolicy: Object.freeze({
      ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
      ...(partial.replayPolicy ?? {}),
    }),
    learningPolicy: Object.freeze({
      ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
      ...(partial.learningPolicy ?? {}),
    }),
    proofPolicy: Object.freeze({
      ...CHAT_RUNTIME_DEFAULTS.proofPolicy,
      ...(partial.proofPolicy ?? {}),
    }),
    invasionPolicy: Object.freeze({
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      ...(partial.invasionPolicy ?? {}),
    }),
  });
}

/** Returns a pristine copy of the authoritative runtime defaults. */
export function createDefaultRuntimeConfig(): Readonly<ChatRuntimeConfig> {
  return CHAT_RUNTIME_DEFAULTS;
}

/** Returns true if the runtime config permits visible-channel chat. */
export function runtimeAllowsVisibleChat(config: ChatRuntimeConfig): boolean {
  return config.allowVisibleChannels.length > 0;
}

/** Returns true if the runtime config permits shadow-lane writes. */
export function runtimeAllowsShadowChat(config: ChatRuntimeConfig): boolean {
  return config.allowShadowChannels.length > 0;
}

/** Returns true if the given visible channel is enabled in this runtime config. */
export function runtimeAllowsChannel(
  config: ChatRuntimeConfig,
  channelId: ChatVisibleChannel,
): boolean {
  return config.allowVisibleChannels.includes(channelId);
}

/** Returns true if the given shadow channel is enabled in this runtime config. */
export function runtimeAllowsShadowChannel(
  config: ChatRuntimeConfig,
  channelId: ChatShadowChannel,
): boolean {
  return config.allowShadowChannels.includes(channelId);
}

/** Returns true if learning is enabled in the runtime config. */
export function runtimeLearningEnabled(config: ChatRuntimeConfig): boolean {
  return config.learningPolicy.enabled;
}

/** Returns true if replay is enabled in the runtime config. */
export function runtimeReplayEnabled(config: ChatRuntimeConfig): boolean {
  return config.replayPolicy.enabled;
}

/** Returns true if proof-chain recording is enabled in the runtime config. */
export function runtimeProofEnabled(config: ChatRuntimeConfig): boolean {
  return config.proofPolicy.enabled;
}

/** Returns true if invasion mechanics are enabled in the runtime config. */
export function runtimeInvasionsEnabled(config: ChatRuntimeConfig): boolean {
  return config.invasionPolicy.enabled;
}

/** Returns the maximum characters allowed per player message. */
export function runtimeMaxMessageLength(config: ChatRuntimeConfig): number {
  return config.moderationPolicy.maxCharactersPerMessage;
}

/** Returns the per-second burst ceiling for player messages. */
export function runtimeBurstLimit(config: ChatRuntimeConfig): number {
  return config.ratePolicy.perSecondBurstLimit;
}

// ============================================================================
// MARK: Relationship state helpers
// ============================================================================

/** Returns true if the relationship indicates baseline trust (trust01 >= 0.5). */
export function relationshipHasTrust(rel: ChatRelationshipState): boolean {
  return (rel.trust01 as unknown as number) >= 0.5;
}

/** Returns true if the relationship is dominated by fear (fear01 >= 0.6). */
export function relationshipIsFearDominated(rel: ChatRelationshipState): boolean {
  return (rel.fear01 as unknown as number) >= 0.6;
}

/** Returns true if contempt is dangerously high (contempt01 >= 0.7). */
export function relationshipIsContemptDominated(rel: ChatRelationshipState): boolean {
  return (rel.contempt01 as unknown as number) >= 0.7;
}

/** Returns true if the user is fascinated by this NPC actor (fascination01 >= 0.6). */
export function relationshipIsFascinationActive(rel: ChatRelationshipState): boolean {
  return (rel.fascination01 as unknown as number) >= 0.6;
}

/** Returns true if rivalry is active (rivalry01 >= 0.5). */
export function relationshipIsRivalryActive(rel: ChatRelationshipState): boolean {
  return (rel.rivalry01 as unknown as number) >= 0.5;
}

/** Returns true if the helper has accumulated rescue debt (rescueDebt01 >= 0.3). */
export function relationshipHasRescueDebt(rel: ChatRelationshipState): boolean {
  return (rel.rescueDebt01 as unknown as number) >= 0.3;
}

/**
 * Returns a rough dominant affect label for this relationship, useful for
 * logging, diagnostics, and UX annotation in replay / debrief views.
 */
export function relationshipDominantAffect(
  rel: ChatRelationshipState,
): 'TRUST' | 'FEAR' | 'CONTEMPT' | 'FASCINATION' | 'RIVALRY' | 'RESCUE_DEBT' | 'NEUTRAL' {
  const scores: Array<[string, number]> = [
    ['TRUST', rel.trust01 as unknown as number],
    ['FEAR', rel.fear01 as unknown as number],
    ['CONTEMPT', rel.contempt01 as unknown as number],
    ['FASCINATION', rel.fascination01 as unknown as number],
    ['RIVALRY', rel.rivalry01 as unknown as number],
    ['RESCUE_DEBT', rel.rescueDebt01 as unknown as number],
  ];
  let bestLabel = 'NEUTRAL';
  let bestScore = 0.35; // minimum threshold to claim a dominant affect
  for (const [label, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }
  return bestLabel as ReturnType<typeof relationshipDominantAffect>;
}

/**
 * Returns a 0–100 relationship intensity score derived from all affect axes.
 * Used in UI intensity rings and NPC pacing decisions.
 */
export function relationshipIntensity(rel: ChatRelationshipState): Score100 {
  const raw =
    (rel.trust01 as unknown as number) * 0.15 +
    (rel.fear01 as unknown as number) * 0.25 +
    (rel.contempt01 as unknown as number) * 0.25 +
    (rel.fascination01 as unknown as number) * 0.15 +
    (rel.rivalry01 as unknown as number) * 0.1 +
    (rel.rescueDebt01 as unknown as number) * 0.1;
  return clamp100(Math.round(raw * 100));
}

/**
 * Produces a compact digest string of this relationship's current affect axes.
 * Format: "T:0.72|F:0.10|C:0.20|Fa:0.55|Ri:0.30|RD:0.05"
 * Suitable for telemetry tags and debrief overlays.
 */
export function relationshipAffectDigest(rel: ChatRelationshipState): string {
  const fmt = (n: Score01) => ((n as unknown as number) * 100).toFixed(0).padStart(3, ' ');
  return (
    `T:${fmt(rel.trust01)}` +
    `|F:${fmt(rel.fear01)}` +
    `|C:${fmt(rel.contempt01)}` +
    `|Fa:${fmt(rel.fascination01)}` +
    `|Ri:${fmt(rel.rivalry01)}` +
    `|RD:${fmt(rel.rescueDebt01)}`
  );
}

/**
 * Returns true if the relationship is fresh enough to drive NPC decisions
 * (updated within the last `windowMs` milliseconds).
 */
export function relationshipIsFresh(
  rel: ChatRelationshipState,
  now: UnixMs,
  windowMs: number,
): boolean {
  return unixMsAge(rel.updatedAt, now) <= windowMs;
}

/** Returns true if the relationship has never been updated (default zero state). */
export function relationshipIsDefault(rel: ChatRelationshipState): boolean {
  return (
    (rel.trust01 as unknown as number) === 0 &&
    (rel.fear01 as unknown as number) === 0 &&
    (rel.contempt01 as unknown as number) === 0 &&
    (rel.fascination01 as unknown as number) === 0 &&
    (rel.rivalry01 as unknown as number) === 0 &&
    (rel.rescueDebt01 as unknown as number) === 0
  );
}

// ============================================================================
// MARK: Learning profile helpers
// ============================================================================

/** Returns true if this user is in the cold-start phase (no meaningful history). */
export function learningProfileIsColdStart(profile: ChatLearningProfile): boolean {
  return profile.coldStart;
}

/** Returns true if this user has high churn risk (churnRisk01 >= 0.65). */
export function learningProfileIsHighChurnRisk(profile: ChatLearningProfile): boolean {
  return (profile.churnRisk01 as unknown as number) >= 0.65;
}

/** Returns true if this user is highly receptive to helper interventions. */
export function learningProfileIsHelperReceptive(profile: ChatLearningProfile): boolean {
  return (profile.helperReceptivity01 as unknown as number) >= 0.6;
}

/** Returns true if this user is highly susceptible to hater pressure. */
export function learningProfileIsHaterSusceptible(profile: ChatLearningProfile): boolean {
  return (profile.haterSusceptibility01 as unknown as number) >= 0.6;
}

/** Returns true if this user plays aggressively in negotiations. */
export function learningProfileIsAggressiveNegotiator(profile: ChatLearningProfile): boolean {
  return (profile.negotiationAggression01 as unknown as number) >= 0.7;
}

/** Returns true if this user has been rescued before (rescueHistoryCount >= 1). */
export function learningProfileHasRescueHistory(profile: ChatLearningProfile): boolean {
  return profile.rescueHistoryCount >= 1;
}

/** Returns this user's strongest channel affinity. */
export function learningProfileStrongestChannelAffinity(
  profile: ChatLearningProfile,
): ChatVisibleChannel {
  let best: ChatVisibleChannel = 'GLOBAL';
  let bestScore = -1;
  for (const ch of CHAT_VISIBLE_CHANNELS) {
    const score = profile.channelAffinity[ch] as unknown as number;
    if (score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return best;
}

/** Returns the user's affinity score for the given channel, as a percentage 0–100. */
export function learningProfileChannelAffinityPct(
  profile: ChatLearningProfile,
  channelId: ChatVisibleChannel,
): number {
  return Math.round((profile.channelAffinity[channelId] as unknown as number) * 100);
}

/** Returns the overall engagement baseline as a percentage 0–100. */
export function learningProfileEngagementPct(profile: ChatLearningProfile): number {
  return Math.round((profile.engagementBaseline01 as unknown as number) * 100);
}

/**
 * Returns a compact affect digest from the user's learning profile's affect snapshot.
 * Useful for attaching to telemetry entries and debrief summaries.
 */
export function learningProfileAffectDigest(profile: ChatLearningProfile): string {
  const a = profile.affect;
  const fmt = (n: Score01) => ((n as unknown as number) * 100).toFixed(0).padStart(3, ' ');
  return (
    `conf:${fmt(a.confidence01)}` +
    `|frust:${fmt(a.frustration01)}` +
    `|intim:${fmt(a.intimidation01)}` +
    `|attach:${fmt(a.attachment01)}` +
    `|cur:${fmt(a.curiosity01)}` +
    `|emb:${fmt(a.embarrassment01)}` +
    `|relief:${fmt(a.relief01)}`
  );
}

/**
 * Returns a combined "distress score" derived from the affect snapshot in the
 * learning profile. High distress signals the helper should escalate urgency.
 * Range: 0.0 – 1.0.
 */
export function learningProfileDistressScore(profile: ChatLearningProfile): Score01 {
  const a = profile.affect;
  const raw =
    (a.frustration01 as unknown as number) * 0.35 +
    (a.intimidation01 as unknown as number) * 0.30 +
    (a.embarrassment01 as unknown as number) * 0.20 +
    (1.0 - (a.confidence01 as unknown as number)) * 0.15;
  return clamp01(raw);
}

/**
 * Returns a combined "engagement pull" score. High values indicate the user is
 * leaned in and should be rewarded with higher-stakes NPC interactions.
 * Range: 0.0 – 1.0.
 */
export function learningProfileEngagementPull(profile: ChatLearningProfile): Score01 {
  const a = profile.affect;
  const raw =
    (profile.engagementBaseline01 as unknown as number) * 0.40 +
    (a.curiosity01 as unknown as number) * 0.25 +
    (a.attachment01 as unknown as number) * 0.20 +
    (a.relief01 as unknown as number) * 0.15;
  return clamp01(raw);
}

/**
 * Classifies the user into a concise experience archetype based on their
 * learning profile. Used in debrief overlays and NPC persona selection.
 */
export function learningProfileArchetype(
  profile: ChatLearningProfile,
): 'COLD_START' | 'THREATENED' | 'INVESTED' | 'HOSTILE_NEGOTIATOR' | 'RECOVERING' | 'ANCHORED' {
  if (profile.coldStart) return 'COLD_START';
  if ((profile.churnRisk01 as unknown as number) >= 0.65) return 'THREATENED';
  if (profile.rescueHistoryCount >= 3 && (profile.helperReceptivity01 as unknown as number) >= 0.5)
    return 'RECOVERING';
  if ((profile.negotiationAggression01 as unknown as number) >= 0.7) return 'HOSTILE_NEGOTIATOR';
  if (
    (profile.engagementBaseline01 as unknown as number) >= 0.65 &&
    profile.salienceAnchorIds.length >= 2
  )
    return 'ANCHORED';
  return 'INVESTED';
}

// ============================================================================
// MARK: Inference snapshot helpers
// ============================================================================

/** Returns true if the inference snapshot recommends a helper intervention. */
export function inferenceRecommendsHelper(snapshot: ChatInferenceSnapshot): boolean {
  return (
    snapshot.interventionPolicy === 'LIGHT_HELPER' ||
    snapshot.interventionPolicy === 'HARD_HELPER'
  );
}

/** Returns true if the inference snapshot recommends a hard (immediate) helper intervention. */
export function inferenceRecommendsHardHelper(snapshot: ChatInferenceSnapshot): boolean {
  return snapshot.interventionPolicy === 'HARD_HELPER';
}

/** Returns true if the inference snapshot recommends a hater escalation. */
export function inferenceRecommendsHaterEscalation(snapshot: ChatInferenceSnapshot): boolean {
  return snapshot.interventionPolicy === 'HATER_ESCALATE';
}

/** Returns true if the inference snapshot says to defer all NPC action. */
export function inferenceRecommendsDefer(snapshot: ChatInferenceSnapshot): boolean {
  return snapshot.interventionPolicy === 'DEFER';
}

/** Returns true if hater targeting is above the danger threshold (>= 0.6). */
export function inferenceHaterTargetingIsDangerous(snapshot: ChatInferenceSnapshot): boolean {
  return (snapshot.haterTargeting01 as unknown as number) >= 0.6;
}

/** Returns true if churn risk is critically elevated (>= 0.7). */
export function inferenceChurnRiskIsCritical(snapshot: ChatInferenceSnapshot): boolean {
  return (snapshot.churnRisk01 as unknown as number) >= 0.7;
}

/** Returns true if toxicity risk is critically elevated (>= 0.7). */
export function inferenceToxicityRiskIsCritical(snapshot: ChatInferenceSnapshot): boolean {
  return (snapshot.toxicityRisk01 as unknown as number) >= 0.7;
}

/** Returns true if the snapshot's engagement score is high (>= 0.65). */
export function inferenceEngagementIsHigh(snapshot: ChatInferenceSnapshot): boolean {
  return (snapshot.engagement01 as unknown as number) >= 0.65;
}

/** Returns true if the helper timing score makes now a good window (>= 0.55). */
export function inferenceHelperTimingIsGood(snapshot: ChatInferenceSnapshot): boolean {
  return (snapshot.helperTiming01 as unknown as number) >= 0.55;
}

/**
 * Returns the strongest channel affinity from this inference snapshot.
 * Used to route NPC responses to the channel the user is most engaged with.
 */
export function inferenceStrongestChannelAffinity(
  snapshot: ChatInferenceSnapshot,
): ChatVisibleChannel {
  let best: ChatVisibleChannel = 'GLOBAL';
  let bestScore = -1;
  for (const ch of CHAT_VISIBLE_CHANNELS) {
    const score = snapshot.channelAffinity[ch] as unknown as number;
    if (score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return best;
}

/**
 * Returns a compact diagnostic digest of this inference snapshot's key scores.
 * Format: "eng:72|ht:85|hater:40|tox:15|churn:30"
 */
export function inferenceScoreDigest(snapshot: ChatInferenceSnapshot): string {
  const pct = (s: Score01) => Math.round((s as unknown as number) * 100);
  return (
    `eng:${pct(snapshot.engagement01)}` +
    `|ht:${pct(snapshot.helperTiming01)}` +
    `|hater:${pct(snapshot.haterTargeting01)}` +
    `|tox:${pct(snapshot.toxicityRisk01)}` +
    `|churn:${pct(snapshot.churnRisk01)}`
  );
}

/**
 * Returns true if this snapshot is fresh enough to drive decisions.
 * Staleness window defaults to 30 seconds.
 */
export function inferenceSnapshotIsFresh(
  snapshot: ChatInferenceSnapshot,
  now: UnixMs,
  windowMs = 30_000,
): boolean {
  return unixMsAge(snapshot.generatedAt, now) <= windowMs;
}

// ============================================================================
// MARK: Audience heat helpers
// ============================================================================

/** Returns true if the audience heat is critically elevated (heat01 >= 0.75). */
export function audienceHeatIsCritical(heat: ChatAudienceHeat): boolean {
  return (heat.heat01 as unknown as number) >= 0.75;
}

/** Returns true if the crowd is swinging positive. */
export function audienceHeatIsPositive(heat: ChatAudienceHeat): boolean {
  return heat.swarmDirection === 'POSITIVE';
}

/** Returns true if the crowd is swinging negative. */
export function audienceHeatIsNegative(heat: ChatAudienceHeat): boolean {
  return heat.swarmDirection === 'NEGATIVE';
}

/** Returns the heat score as a percentage 0–100. */
export function audienceHeatPct(heat: ChatAudienceHeat): number {
  return Math.round((heat.heat01 as unknown as number) * 100);
}

/**
 * Returns a label string for the audience heat level.
 * Used in debug overlays, event annotations, and debrief summaries.
 */
export function audienceHeatLabel(heat: ChatAudienceHeat): string {
  const pct = audienceHeatPct(heat);
  if (pct >= 90) return 'VOLCANIC';
  if (pct >= 75) return 'CRITICAL';
  if (pct >= 55) return 'ELEVATED';
  if (pct >= 35) return 'WARM';
  if (pct >= 15) return 'COOL';
  return 'COLD';
}

// ============================================================================
// MARK: Silence decision helpers
// ============================================================================

/** Returns true if the silence window is currently active (not yet expired). */
export function silenceIsActive(silence: ChatSilenceDecision, now: UnixMs): boolean {
  return silence.active && unixMsIsInFuture(silence.endsAt, now);
}

/** Returns the remaining silence duration in milliseconds, or 0 if expired. */
export function silenceRemainingMs(silence: ChatSilenceDecision, now: UnixMs): number {
  if (!silence.active) return 0;
  return Math.max(0, (silence.endsAt as unknown as number) - (now as unknown as number));
}

/** Returns the total duration of this silence window in milliseconds. */
export function silenceTotalDurationMs(silence: ChatSilenceDecision): number {
  return (silence.endsAt as unknown as number) - (silence.startedAt as unknown as number);
}

/** Returns how far (0.0–1.0) into the silence window we currently are. */
export function silenceProgress01(silence: ChatSilenceDecision, now: UnixMs): Score01 {
  const total = silenceTotalDurationMs(silence);
  if (total <= 0) return clamp01(1);
  const elapsed = unixMsAge(silence.startedAt, now);
  return clamp01(elapsed / total);
}

// ============================================================================
// MARK: Invasion state helpers
// ============================================================================

/** Returns true if the invasion is in the shadow-priming phase. */
export function invasionIsPriming(invasion: ChatInvasionState): boolean {
  return invasion.status === 'PRIMING';
}

/** Returns true if the invasion is fully active. */
export function invasionIsActive(invasion: ChatInvasionState): boolean {
  return invasion.status === 'ACTIVE';
}

/** Returns true if the invasion has been resolved. */
export function invasionIsResolved(invasion: ChatInvasionState): boolean {
  return invasion.status === 'RESOLVED';
}

/** Returns true if the invasion closes before the given timestamp. */
export function invasionClosesBy(invasion: ChatInvasionState, deadline: UnixMs): boolean {
  return (invasion.closesAt as unknown as number) <= (deadline as unknown as number);
}

/** Returns the remaining duration of the invasion in milliseconds, or 0 if closed. */
export function invasionRemainingMs(invasion: ChatInvasionState, now: UnixMs): number {
  return Math.max(0, (invasion.closesAt as unknown as number) - (now as unknown as number));
}

/** Returns a classification label string for the invasion kind. */
export function invasionKindLabel(invasion: ChatInvasionState): string {
  const labels: Record<ChatInvasionState['kind'], string> = {
    HATER_RAID: 'Hater Raid',
    RUMOR_BURST: 'Rumor Burst',
    HELPER_BLACKOUT: 'Helper Blackout',
    LIQUIDATOR_SWEEP: 'Liquidator Sweep',
    SYSTEM_SHOCK: 'System Shock',
  };
  return labels[invasion.kind] ?? invasion.kind;
}

// ============================================================================
// MARK: Battle snapshot helpers
// ============================================================================

/** Returns true if there is an active attack on the player. */
export function battleHasActiveAttack(battle: ChatBattleSnapshot): boolean {
  return battle.activeAttackType != null;
}

/** Returns true if the rescue window is open and a helper can intervene. */
export function battleRescueWindowIsOpen(battle: ChatBattleSnapshot): boolean {
  return battle.rescueWindowOpen;
}

/** Returns true if the shield integrity is critically low (shieldIntegrity01 <= 0.25). */
export function battleShieldIsCritical(battle: ChatBattleSnapshot): boolean {
  return (battle.shieldIntegrity01 as unknown as number) <= 0.25;
}

/** Returns true if momentum is dangerously high (>= 75). */
export function battleMomentumIsDangerous(battle: ChatBattleSnapshot): boolean {
  return (battle.hostileMomentum as unknown as number) >= 75;
}

/** Returns the pressure tier label for UX display. */
export function battlePressureTierLabel(tier: PressureTier): string {
  const labels: Record<PressureTier, string> = {
    NONE: 'Stable',
    BUILDING: 'Building',
    ELEVATED: 'Elevated',
    HIGH: 'High Pressure',
    CRITICAL: 'Critical',
  };
  return labels[tier];
}

// ============================================================================
// MARK: ChatState cross-entity diagnostics
// ============================================================================

/**
 * Returns a count of currently active invasions across all rooms.
 */
export function chatStateTotalActiveInvasions(state: ChatState): number {
  return Object.values(state.activeInvasions).filter((inv) => inv.status === 'ACTIVE').length;
}

/**
 * Returns a count of currently silenced rooms.
 */
export function chatStateSilencedRoomCount(state: ChatState): number {
  return Object.values(state.silencesByRoom).filter((s) => s.active).length;
}

/**
 * Returns all room IDs that currently have an active silence.
 */
export function chatStateSilencedRoomIds(state: ChatState): readonly ChatRoomId[] {
  return Object.entries(state.silencesByRoom)
    .filter(([, s]) => s.active)
    .map(([id]) => id as ChatRoomId);
}

/**
 * Returns all room IDs that have at least one pending reveal.
 */
export function chatStatePendingRevealRoomIds(state: ChatState): readonly ChatRoomId[] {
  const ids = new Set<ChatRoomId>();
  for (const reveal of state.pendingReveals) ids.add(reveal.roomId);
  return Object.freeze([...ids]);
}

/**
 * Returns the number of pending reveals for a given room.
 */
export function chatStatePendingRevealCountForRoom(
  state: ChatState,
  roomId: ChatRoomId,
): number {
  return state.pendingReveals.filter((r) => r.roomId === roomId).length;
}

/**
 * Returns all pending reveals for a given room, sorted by revealAt ascending.
 */
export function chatStateGetPendingRevealsForRoom(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatPendingReveal[] {
  return state.pendingReveals
    .filter((r) => r.roomId === roomId)
    .sort((a, b) => (a.revealAt as unknown as number) - (b.revealAt as unknown as number));
}

/**
 * Returns the count of pending requests.
 */
export function chatStatePendingRequestCount(state: ChatState): number {
  return Object.keys(state.pendingRequests).length;
}

/**
 * Returns the count of telemetry envelopes waiting in the queue.
 */
export function chatStateTelemetryQueueLength(state: ChatState): number {
  return state.telemetryQueue.length;
}

/**
 * Returns the total number of relationships tracked across all rooms.
 */
export function chatStateTotalRelationshipCount(state: ChatState): number {
  return Object.keys(state.relationships).length;
}

/**
 * Returns the total number of learning profiles tracked.
 */
export function chatStateTotalLearningProfileCount(state: ChatState): number {
  return Object.keys(state.learningProfiles).length;
}

/**
 * Returns the total number of inference snapshots tracked.
 */
export function chatStateTotalInferenceSnapshotCount(state: ChatState): number {
  return Object.keys(state.inferenceSnapshots).length;
}

/**
 * Returns true if the state has been fully booted (rooms, sessions, runtime all populated).
 */
export function chatStateIsBootComplete(state: ChatState): boolean {
  return state.bootedAt > (0 as UnixMs) && state.version === BACKEND_CHAT_ENGINE_VERSION;
}

/**
 * Returns the uptime of this chat engine state in milliseconds.
 */
export function chatStateUptimeMs(state: ChatState, now: UnixMs): number {
  return unixMsAge(state.bootedAt, now);
}

/**
 * Returns a concise health summary for this state, useful in diagnostics endpoints
 * and operator dashboards.
 */
export function chatStateHealthSummary(
  state: ChatState,
  now: UnixMs,
): Readonly<{
  uptimeMs: number;
  roomCount: number;
  sessionCount: number;
  activeInvasionCount: number;
  silencedRoomCount: number;
  pendingRevealCount: number;
  pendingRequestCount: number;
  telemetryQueueLength: number;
  relationshipCount: number;
  learningProfileCount: number;
  inferenceSnapshotCount: number;
}> {
  return Object.freeze({
    uptimeMs: chatStateUptimeMs(state, now),
    roomCount: chatStateRoomCount(state),
    sessionCount: chatStateSessionCount(state),
    activeInvasionCount: chatStateTotalActiveInvasions(state),
    silencedRoomCount: chatStateSilencedRoomCount(state),
    pendingRevealCount: state.pendingReveals.length,
    pendingRequestCount: chatStatePendingRequestCount(state),
    telemetryQueueLength: chatStateTelemetryQueueLength(state),
    relationshipCount: chatStateTotalRelationshipCount(state),
    learningProfileCount: chatStateTotalLearningProfileCount(state),
    inferenceSnapshotCount: chatStateTotalInferenceSnapshotCount(state),
  });
}

// ============================================================================
// MARK: Persona descriptor helpers
// ============================================================================

/** Returns true if this persona is a hater NPC. */
export function personaIsHater(persona: ChatPersonaDescriptor): boolean {
  return persona.role === 'HATER';
}

/** Returns true if this persona is a helper NPC. */
export function personaIsHelper(persona: ChatPersonaDescriptor): boolean {
  return persona.role === 'HELPER';
}

/** Returns true if this persona is ambient (background NPC). */
export function personaIsAmbient(persona: ChatPersonaDescriptor): boolean {
  return persona.role === 'AMBIENT';
}

/** Returns true if this persona is a narrator NPC. */
export function personaIsNarrator(persona: ChatPersonaDescriptor): boolean {
  return persona.role === 'NARRATOR';
}

/** Returns true if the given channel is in this persona's preferred channels list. */
export function personaPrefersChannel(
  persona: ChatPersonaDescriptor,
  channelId: ChatChannelId,
): boolean {
  return persona.preferredChannels.includes(channelId);
}

/** Returns true if the persona has the given tag. */
export function personaHasTag(persona: ChatPersonaDescriptor, tag: string): boolean {
  return persona.tags.includes(tag);
}

/**
 * Returns the expected response delay for this persona, sampled from its voiceprint range.
 * Caller provides a 0–1 random value; the function maps it to [delayFloorMs, delayCeilingMs].
 */
export function personaSampleResponseDelayMs(
  persona: ChatPersonaDescriptor,
  rand01: number,
): number {
  const floor = persona.voiceprint.delayFloorMs;
  const ceiling = persona.voiceprint.delayCeilingMs;
  return Math.round(floor + (ceiling - floor) * Math.max(0, Math.min(1, rand01)));
}

// ============================================================================
// MARK: Response candidate helpers
// ============================================================================

/** Returns true if the candidate is high priority (priority >= 80). */
export function candidateIsHighPriority(candidate: ChatResponseCandidate): boolean {
  return candidate.priority >= 80;
}

/** Returns true if this candidate is long (text >= 120 characters). */
export function candidateIsLong(candidate: ChatResponseCandidate): boolean {
  return candidate.text.length >= 120;
}

/** Returns true if this candidate is short (text < 40 characters). */
export function candidateIsShort(candidate: ChatResponseCandidate): boolean {
  return candidate.text.length < 40;
}

/** Returns true if this candidate bypasses moderation. */
export function candidateBypassesModeration(candidate: ChatResponseCandidate): boolean {
  return candidate.moderationBypassAllowed;
}

/** Returns the total estimated delivery time for this candidate in ms (delayMs + text render). */
export function candidateTotalDeliveryMs(candidate: ChatResponseCandidate): number {
  // Approximate 20 ms per character for "typewriter" animations on fast paths.
  return candidate.delayMs + candidate.text.length * 20;
}

// ============================================================================
// MARK: Score comparison extended helpers
// ============================================================================

/**
 * Computes the absolute delta between two Score01 values.
 * Useful for detecting if a relationship axis has shifted enough to matter.
 */
export function scoreDelta(a: Score01, b: Score01): Score01 {
  return clamp01(Math.abs((a as unknown as number) - (b as unknown as number)));
}

/**
 * Linearly interpolates between two Score01 values.
 * `t` must be in [0, 1]; 0 returns `a`, 1 returns `b`.
 */
export function scoreLerp(a: Score01, b: Score01, t: number): Score01 {
  const clamped = Math.max(0, Math.min(1, t));
  const result = (a as unknown as number) * (1 - clamped) + (b as unknown as number) * clamped;
  return clamp01(result);
}

/**
 * Returns the weighted average of multiple Score01 values with corresponding weights.
 * Weights are normalized internally (they do not need to sum to 1).
 */
export function scoreWeightedAverage(pairs: ReadonlyArray<[Score01, number]>): Score01 {
  let numerator = 0;
  let denominator = 0;
  for (const [score, weight] of pairs) {
    const w = Math.max(0, weight);
    numerator += (score as unknown as number) * w;
    denominator += w;
  }
  if (denominator === 0) return clamp01(0);
  return clamp01(numerator / denominator);
}

/**
 * Computes an exponential decay of a Score01 value.
 * `halfLifeMs` is the time in ms for the score to halve.
 * Used for time-decaying relationship scores and heat values.
 */
export function scoreDecay(
  score: Score01,
  elapsedMs: number,
  halfLifeMs: number,
): Score01 {
  if (halfLifeMs <= 0) return clamp01(0);
  const decayFactor = Math.pow(0.5, elapsedMs / halfLifeMs);
  return clamp01((score as unknown as number) * decayFactor);
}

// ============================================================================
// MARK: ChatEngineTransaction helpers
// ============================================================================

/** Returns true if the transaction was accepted (event processed successfully). */
export function transactionWasAccepted(tx: ChatEngineTransaction): boolean {
  return tx.accepted;
}

/** Returns true if the transaction was rejected by policy. */
export function transactionWasRejected(tx: ChatEngineTransaction): boolean {
  return tx.rejected;
}

/** Returns the first rejection reason, or null if not rejected. */
export function transactionFirstRejectionReason(tx: ChatEngineTransaction): string | null {
  return tx.rejectionReasons[0] ?? null;
}

/** Returns the count of messages appended in this transaction. */
export function transactionAppendedMessageCount(tx: ChatEngineTransaction): number {
  return tx.delta?.appendedMessages.length ?? 0;
}

/** Returns the count of fanout packets emitted in this transaction. */
export function transactionFanoutPacketCount(tx: ChatEngineTransaction): number {
  return tx.fanout.length;
}

/** Returns true if the transaction includes telemetry in the delta. */
export function transactionHasTelemetry(tx: ChatEngineTransaction): boolean {
  return (tx.delta?.telemetry.length ?? 0) > 0;
}

/** Returns all room IDs touched in this transaction. */
export function transactionTouchedRoomIds(tx: ChatEngineTransaction): readonly ChatRoomId[] {
  return tx.delta?.touchedRoomIds ?? [];
}

// ============================================================================
// MARK: ChatStateDelta helpers
// ============================================================================

/** Returns true if the delta touched any rooms. */
export function deltaHasTouchedRooms(delta: ChatStateDelta): boolean {
  return delta.touchedRoomIds.length > 0;
}

/** Returns true if the delta includes at least one appended message. */
export function deltaHasMessages(delta: ChatStateDelta): boolean {
  return delta.appendedMessages.length > 0;
}

/** Returns true if the delta includes replay artifacts. */
export function deltaHasReplayArtifacts(delta: ChatStateDelta): boolean {
  return delta.replayArtifacts.length > 0;
}

/** Returns true if the delta includes learning profile updates. */
export function deltaHasLearningUpdates(delta: ChatStateDelta): boolean {
  return delta.learningProfilesTouched.length > 0;
}

/** Returns true if the delta includes new inference snapshots. */
export function deltaHasInferenceSnapshots(delta: ChatStateDelta): boolean {
  return delta.inferenceSnapshots.length > 0;
}

// ============================================================================
// MARK: Module authority object
// ============================================================================

/**
 * CHAT_TYPES_MODULE_AUTHORITY
 * ─────────────────────────────────────────────────────────────────────────────
 * Frozen registry of all exported symbols from this module. Used by
 * phase4_index.ts and other barrel exports to verify coverage, perform
 * diagnostic health checks, and power operator dashboards.
 *
 * Every exported function, constant, and utility belongs here.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const CHAT_TYPES_MODULE_AUTHORITY = Object.freeze({
  // Identity
  moduleId: CHAT_TYPES_MODULE_ID,
  version: CHAT_TYPES_MODULE_VERSION,
  publicApiVersion: BACKEND_CHAT_ENGINE_PUBLIC_API_VERSION,
  descriptor: CHAT_TYPES_MODULE_DESCRIPTOR,
  authorityRoots: CHAT_AUTHORITY_ROOTS,

  // Constants
  CHAT_VISIBLE_CHANNELS,
  CHAT_SHADOW_CHANNELS,
  CHAT_ALL_CHANNELS,
  CHAT_ROOM_KINDS,
  CHAT_SOURCE_TYPES,
  CHAT_EVENT_KINDS,
  CHAT_CONNECTION_STATES,
  CHAT_PRESENCE_STATES,
  CHAT_TYPING_STATES,
  CHAT_MODERATION_OUTCOMES,
  CHAT_RATE_OUTCOMES,
  CHAT_SESSION_ROLES,
  CHAT_NPC_ROLES,
  CHAT_INFERENCE_SOURCES,
  CHAT_ROOM_STAGE_MOODS,
  CHAT_CHANNEL_MOODS,
  CHAT_SIGNAL_TYPES,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_MOUNT_POLICIES,
  CHAT_MOUNT_TARGETS,
  CHAT_RUNTIME_DEFAULTS,

  // Channel predicates
  isVisibleChannelId,
  isShadowChannelId,
  isAnyChannelId,
  isRoomKind,
  isChatSessionRole,
  isChatNpcRole,
  isChatInferenceSource,
  isChatRoomStageMood,
  isChatChannelMood,
  isChatSignalType,
  isChatRateOutcome,
  isChatPressureTier,
  isChatTickTier,
  isChatEventKind,
  isChatConnectionState,
  isChatPresenceMode,
  isChatTypingMode,
  isChatModerationOutcome,
  isChatSourceType,
  isChatMountTarget,
  isChatAuthorityRootKey,
  isChatRoomId,
  isChatSessionId,
  isChatUserId,
  isChatMessageId,

  // Branded casts
  asChatRoomId,
  asChatSessionId,
  asChatUserId,
  asChatMessageId,
  asChatEventId,
  asChatInvasionId,
  asChatPersonaId,
  asChatSceneId,
  asChatProofHash,
  asChatRelationshipId,
  asChatRequestId,
  asChatReplayId,
  asChatTelemetryId,
  asChatInferenceId,
  asChatMomentId,
  asChatLegendId,
  asChatMemoryAnchorId,
  asChatProofEdgeId,
  asChatTypingToken,
  asChatOfferId,
  asChatDriftId,

  // Numeric helpers
  clamp01,
  clamp100,
  asUnixMs,
  asSequenceNumber,
  scoreAbove,
  scoreBelow,
  scoreToPercent,
  scoreDelta,
  scoreLerp,
  scoreWeightedAverage,
  scoreDecay,

  // UnixMs helpers
  unixMsToDate,
  unixMsAge,
  unixMsIsExpired,
  unixMsIsInFuture,
  unixMsAdd,
  unixMsSub,

  // Null helpers
  isNullable,
  unwrapNullable,
  assertDefined,

  // JSON helpers
  isJsonPrimitive,
  isJsonObject,
  isJsonArray,
  jsonValueToString,

  // Presence / connection
  presenceModeIsActive,
  presenceModeIsOffline,
  connectionStateIsLive,
  connectionStateIsDetached,

  // Channel helpers
  channelIsVisible,
  channelIsShadow,
  visibleChannelIndex,
  channelSupportsComposer,
  channelSupportsPresence,
  channelSupportsTyping,
  channelSupportsReadReceipts,
  channelSupportsReplay,
  channelSupportsCrowdHeat,
  channelSupportsNpcInjection,
  channelSupportsNegotiation,
  channelSupportsRescue,
  channelSupportsShadowWrites,
  channelIsVisibleToPlayer,
  channelPersistenceClass,
  channelIsTransient,
  channelIsRunScoped,
  channelIsAccountScoped,
  filterVisibleChannelsByDescriptor,
  filterShadowChannelsByDescriptor,
  listNpcInjectionChannels,
  listCrowdHeatChannels,
  listRescueChannels,
  listShadowWriteChannels,
  getChannelDescriptor,

  // Room kind helpers
  roomKindIsGlobal,
  roomKindIsPrivate,
  roomKindIsSystem,

  // Mount policy helpers
  getMountPolicy,
  mountTargetDefaultChannel,
  mountTargetAllowedChannels,
  mountTargetAllowsCollapse,
  mountTargetDefaultsCollapsed,
  mountTargetStageMood,
  mountTargetComposerPlaceholder,
  mountTargetAllowsChannel,
  listMountTargetsWithDefaultChannel,
  listMountTargetsByStageMood,
  listCollapsedByDefaultMountTargets,

  // Runtime config helpers
  mergeRuntimeConfig,
  createDefaultRuntimeConfig,
  runtimeAllowsVisibleChat,
  runtimeAllowsShadowChat,
  runtimeAllowsChannel,
  runtimeAllowsShadowChannel,
  runtimeLearningEnabled,
  runtimeReplayEnabled,
  runtimeProofEnabled,
  runtimeInvasionsEnabled,
  runtimeMaxMessageLength,
  runtimeBurstLimit,

  // Authority root helpers
  getAuthorityRoot,
  resolveBackendEnginePath,
  resolveBackendLearningPath,
  resolveSharedContractPath,
  resolveSharedLearningPath,
  resolveFrontendEnginePath,
  resolveFrontendUiPath,
  resolveServerTransportPath,
  listAuthorityRootKeys,

  // Relationship helpers
  relationshipHasTrust,
  relationshipIsFearDominated,
  relationshipIsContemptDominated,
  relationshipIsFascinationActive,
  relationshipIsRivalryActive,
  relationshipHasRescueDebt,
  relationshipDominantAffect,
  relationshipIntensity,
  relationshipAffectDigest,
  relationshipIsFresh,
  relationshipIsDefault,

  // Learning profile helpers
  learningProfileIsColdStart,
  learningProfileIsHighChurnRisk,
  learningProfileIsHelperReceptive,
  learningProfileIsHaterSusceptible,
  learningProfileIsAggressiveNegotiator,
  learningProfileHasRescueHistory,
  learningProfileStrongestChannelAffinity,
  learningProfileChannelAffinityPct,
  learningProfileEngagementPct,
  learningProfileAffectDigest,
  learningProfileDistressScore,
  learningProfileEngagementPull,
  learningProfileArchetype,

  // Inference helpers
  inferenceRecommendsHelper,
  inferenceRecommendsHardHelper,
  inferenceRecommendsHaterEscalation,
  inferenceRecommendsDefer,
  inferenceHaterTargetingIsDangerous,
  inferenceChurnRiskIsCritical,
  inferenceToxicityRiskIsCritical,
  inferenceEngagementIsHigh,
  inferenceHelperTimingIsGood,
  inferenceStrongestChannelAffinity,
  inferenceScoreDigest,
  inferenceSnapshotIsFresh,

  // Audience heat helpers
  audienceHeatIsCritical,
  audienceHeatIsPositive,
  audienceHeatIsNegative,
  audienceHeatPct,
  audienceHeatLabel,

  // Silence helpers
  silenceIsActive,
  silenceRemainingMs,
  silenceTotalDurationMs,
  silenceProgress01,

  // Invasion helpers
  invasionKindIsHaterRaid,
  invasionKindIsHelperBlackout,
  invasionKindIsSystemShock,
  invasionStatusIsActive,
  invasionStatusIsResolved,
  invasionIsPriming,
  invasionIsActive,
  invasionIsResolved,
  invasionClosesBy,
  invasionRemainingMs,
  invasionKindLabel,

  // Battle helpers
  battleHasActiveAttack,
  battleRescueWindowIsOpen,
  battleShieldIsCritical,
  battleMomentumIsDangerous,
  battlePressureTierLabel,

  // Moderation helpers
  moderationOutcomeAllows,
  moderationOutcomeBlocks,
  rateOutcomeAllows,
  rateOutcomeBlocks,

  // Persona helpers
  personaIsHater,
  personaIsHelper,
  personaIsAmbient,
  personaIsNarrator,
  personaPrefersChannel,
  personaHasTag,
  personaSampleResponseDelayMs,

  // Response candidate helpers
  candidateIsHighPriority,
  candidateIsLong,
  candidateIsShort,
  candidateBypassesModeration,
  candidateTotalDeliveryMs,

  // ChatState accessors
  chatStateRoomIds,
  chatStateSessionIds,
  chatStateActiveInvasionIds,
  chatStateHasRoom,
  chatStateHasSession,
  chatStateRoomCount,
  chatStateSessionCount,
  chatStateActiveInvasionCount,
  chatStateGetRoom,
  chatStateGetSession,
  chatStateGetAudienceHeat,
  chatStateGetSilence,
  chatStateGetLastEventId,
  chatStateGetLastEventAt,
  chatStateGetInvasion,
  chatStateGetLearningProfile,
  chatStateGetRelationship,
  chatStateGetPresence,
  chatStateGetTyping,
  chatStateGetProofEdges,
  chatStateGetReplayArtifacts,
  chatStateGetSessionsForRoom,
  chatStateGetRoomsForSession,

  // ChatState diagnostics
  chatStateTotalActiveInvasions,
  chatStateSilencedRoomCount,
  chatStateSilencedRoomIds,
  chatStatePendingRevealRoomIds,
  chatStatePendingRevealCountForRoom,
  chatStateGetPendingRevealsForRoom,
  chatStatePendingRequestCount,
  chatStateTelemetryQueueLength,
  chatStateTotalRelationshipCount,
  chatStateTotalLearningProfileCount,
  chatStateTotalInferenceSnapshotCount,
  chatStateIsBootComplete,
  chatStateUptimeMs,
  chatStateHealthSummary,

  // Transaction helpers
  transactionWasAccepted,
  transactionWasRejected,
  transactionFirstRejectionReason,
  transactionAppendedMessageCount,
  transactionFanoutPacketCount,
  transactionHasTelemetry,
  transactionTouchedRoomIds,

  // Delta helpers
  deltaHasTouchedRooms,
  deltaHasMessages,
  deltaHasReplayArtifacts,
  deltaHasLearningUpdates,
  deltaHasInferenceSnapshots,
} as const);


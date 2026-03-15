/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT CHANNEL CONTRACTS
 * FILE: shared/contracts/chat/ChatChannels.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for chat channels, room scopes, mounts,
 * presence theater permissions, and transport policy hints.
 *
 * This file is intentionally dense because it becomes the long-term authority
 * for every lane that touches chat:
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /pzo-web/src/components/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Shared contracts must not import runtime engine implementations.
 * 2. Channel vocabulary must preserve the current repo’s visible/shadow split.
 * 3. Mount surfaces must preserve the actual game surfaces already being used.
 * 4. Transport helpers must stay servant-side, never owning simulation truth.
 * 5. Shadow channels must remain first-class, not “debug-only” leftovers.
 * 6. The file must be safe for frontend, backend, and server transport import.
 *
 * Repo-aligned doctrine
 * ---------------------
 * The live frontend donor contract already establishes the core vocabulary:
 * GLOBAL, SYNDICATE, DEAL_ROOM, LOBBY, plus SYSTEM_SHADOW, NPC_SHADOW,
 * RIVALRY_SHADOW, RESCUE_SHADOW, and LIVEOPS_SHADOW, along with the mount
 * surfaces used across BattleHUD, ClubUI, EmpireGameScreen, GameBoard,
 * LeagueUI, LobbyScreen, PhantomGameScreen, PredatorGameScreen, and
 * SyndicateGameScreen. This file folds that forward into the shared lane so the
 * frontend stops acting as the long-term authority. citeturn388142view0turn592088view0
 * ============================================================================
 */

// ============================================================================
// MARK: Foundational utility types
// ============================================================================

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type UnixMs = Brand<number, 'UnixMs'>;
export type TickNumber = Brand<number, 'TickNumber'>;
export type Percentage = Brand<number, 'Percentage'>;
export type Score01 = Brand<number, 'Score01'>;
export type Score100 = Brand<number, 'Score100'>;
export type ChatRoomId = Brand<string, 'ChatRoomId'>;
export type ChatTopicName = Brand<string, 'ChatTopicName'>;
export type ChatNamespace = Brand<string, 'ChatNamespace'>;
export type ChatModeScopeId = Brand<string, 'ChatModeScopeId'>;
export type ChatMountKey = Brand<string, 'ChatMountKey'>;
export type ChatRouteKey = Brand<string, 'ChatRouteKey'>;
export type ChatPolicyTag = Brand<string, 'ChatPolicyTag'>;

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export type JsonPrimitive = string | number | boolean | null;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type JsonArray = readonly JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// ============================================================================
// MARK: Public authority roots
// ============================================================================

export const CHAT_CONTRACT_AUTHORITIES = Object.freeze({
  sharedContractsRoot: '/shared/contracts/chat',
  sharedLearningRoot: '/shared/contracts/chat/learning',
  frontendEngineRoot: '/pzo-web/src/engines/chat',
  frontendUiRoot: '/pzo-web/src/components/chat',
  backendEngineRoot: '/backend/src/game/engine/chat',
  serverTransportRoot: '/pzo-server/src/chat',
  frontendLearningRoot: '/pzo-web/src/engines/chat/intelligence',
  backendLearningRoot: '/backend/src/game/engine/chat/intelligence',
} as const);

export type ChatAuthorityKey = keyof typeof CHAT_CONTRACT_AUTHORITIES;

export const CHAT_CONTRACT_VERSION = '2026.03.15' as const;
export const CHAT_CHANNELS_PUBLIC_API_VERSION = '1.0.0-alpha' as const;

// ============================================================================
// MARK: Channel identifiers
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
 * Migration compatibility alias.
 * Existing frontend chat components historically imported `ChatChannel` to mean
 * “visible tabs only.” Preserve that until the thin UI lane fully migrates.
 */
export type ChatChannel = ChatVisibleChannel;

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

export type ChatPersistenceClass =
  (typeof CHAT_PERSISTENCE_CLASSES)[number];

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

export const CHAT_DELIVERY_PRIORITIES = [
  'IMMEDIATE',
  'HIGH',
  'NORMAL',
  'LOW',
  'DEFERRED',
] as const;

export type ChatDeliveryPriority =
  (typeof CHAT_DELIVERY_PRIORITIES)[number];

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

export type ChatRoomKeyStrategy =
  (typeof CHAT_ROOM_KEY_STRATEGIES)[number];

// ============================================================================
// MARK: Channel capability descriptors
// ============================================================================

export interface ChatChannelDescriptor {
  readonly id: ChatChannelId;
  readonly family: ChatChannelFamily;
  readonly displayName: string;
  readonly shortLabel: string;
  readonly visibleToPlayer: boolean;
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
  readonly persistenceClass: ChatPersistenceClass;
  readonly auditVisibility: ChatAuditVisibilityClass;
  readonly fanoutClass: ChatFanoutClass;
  readonly deliveryPriority: ChatDeliveryPriority;
  readonly defaultStageMood: ChatStageMood;
  readonly roomPurpose: ChatRoomPurpose;
  readonly roomScope: ChatRoomScope;
  readonly roomKeyStrategy: ChatRoomKeyStrategy;
  readonly presenceTheaterProfile: ChatPresenceTheaterProfile;
  readonly readReceiptPolicy: ChatReadReceiptPolicy;
  readonly policyTags: readonly string[];
  readonly defaultShadowCompanions: readonly ChatShadowChannel[];
}

export const CHAT_CHANNEL_DESCRIPTORS: Readonly<
  Record<ChatChannelId, ChatChannelDescriptor>
> = Object.freeze({
  GLOBAL: {
    id: 'GLOBAL',
    family: 'PUBLIC',
    displayName: 'Global',
    shortLabel: 'Global',
    visibleToPlayer: true,
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
    persistenceClass: 'RUN_SCOPED',
    auditVisibility: 'PLAYER_VISIBLE',
    fanoutClass: 'CHANNEL_BROADCAST',
    deliveryPriority: 'HIGH',
    defaultStageMood: 'HOSTILE',
    roomPurpose: 'PUBLIC_STAGE',
    roomScope: 'RUN',
    roomKeyStrategy: 'RUN_SCOPED',
    presenceTheaterProfile: 'CROWD_VISIBLE',
    readReceiptPolicy: 'IMMEDIATE',
    policyTags: [
      'crowd-heat',
      'witness-channel',
      'theatrical-default',
      'legend-eligible',
      'world-event-visible',
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
    visibleToPlayer: true,
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
    persistenceClass: 'ACCOUNT_SCOPED',
    auditVisibility: 'PLAYER_VISIBLE',
    fanoutClass: 'ROOM_BROADCAST',
    deliveryPriority: 'HIGH',
    defaultStageMood: 'CONSPIRATORIAL',
    roomPurpose: 'PRIVATE_COORDINATION',
    roomScope: 'ACCOUNT',
    roomKeyStrategy: 'SYNDICATE_SCOPED',
    presenceTheaterProfile: 'FAST_VISIBLE',
    readReceiptPolicy: 'IMMEDIATE',
    policyTags: [
      'coordination',
      'trust-sensitive',
      'relationship-forward',
      'private-strategy',
      'helper-friendly',
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
    visibleToPlayer: true,
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
    persistenceClass: 'RUN_SCOPED',
    auditVisibility: 'PLAYER_VISIBLE',
    fanoutClass: 'ROOM_BROADCAST',
    deliveryPriority: 'HIGH',
    defaultStageMood: 'PREDATORY',
    roomPurpose: 'NEGOTIATION_CHAMBER',
    roomScope: 'RUN',
    roomKeyStrategy: 'RUN_SCOPED',
    presenceTheaterProfile: 'NEGOTIATION_DELAYED',
    readReceiptPolicy: 'PRESSURE_DELAYED',
    policyTags: [
      'offer-pressure',
      'read-delay',
      'counterplay-window',
      'bluff-sensitive',
      'predatory-quiet',
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
    visibleToPlayer: true,
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
    persistenceClass: 'RUN_SCOPED',
    auditVisibility: 'PLAYER_VISIBLE',
    fanoutClass: 'ROOM_BROADCAST',
    deliveryPriority: 'NORMAL',
    defaultStageMood: 'CALM',
    roomPurpose: 'PRE_RUN_SOCIAL',
    roomScope: 'LOBBY',
    roomKeyStrategy: 'MATCH_SCOPED',
    presenceTheaterProfile: 'CROWD_VISIBLE',
    readReceiptPolicy: 'IMMEDIATE',
    policyTags: [
      'social-staging',
      'pre-run',
      'ambient-friendly',
      'crowd-visible',
      'world-event-visible',
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
    visibleToPlayer: false,
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
    persistenceClass: 'RUN_SCOPED',
    auditVisibility: 'BACKEND_VISIBLE',
    fanoutClass: 'BACKEND_INTERNAL',
    deliveryPriority: 'HIGH',
    defaultStageMood: 'WATCHFUL',
    roomPurpose: 'SYSTEM_LEDGER',
    roomScope: 'RUN',
    roomKeyStrategy: 'SERVER_INTERNAL',
    presenceTheaterProfile: 'SHADOW_ONLY',
    readReceiptPolicy: 'SERVER_ONLY',
    policyTags: [
      'policy',
      'moderation',
      'proof-chain',
      'ledger-authority',
      'system-causality',
    ],
    defaultShadowCompanions: [],
  },
  NPC_SHADOW: {
    id: 'NPC_SHADOW',
    family: 'SHADOW',
    displayName: 'NPC Shadow',
    shortLabel: 'NPC Shadow',
    visibleToPlayer: false,
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
    persistenceClass: 'RUN_SCOPED',
    auditVisibility: 'BACKEND_VISIBLE',
    fanoutClass: 'BACKEND_INTERNAL',
    deliveryPriority: 'NORMAL',
    defaultStageMood: 'WATCHFUL',
    roomPurpose: 'NPC_CONTROL',
    roomScope: 'RUN',
    roomKeyStrategy: 'SERVER_INTERNAL',
    presenceTheaterProfile: 'NPC_LATENT',
    readReceiptPolicy: 'SERVER_ONLY',
    policyTags: [
      'npc-planning',
      'scene-staging',
      'delay-theater',
      'response-ranking',
      'suppression-aware',
    ],
    defaultShadowCompanions: [],
  },
  RIVALRY_SHADOW: {
    id: 'RIVALRY_SHADOW',
    family: 'SHADOW',
    displayName: 'Rivalry Shadow',
    shortLabel: 'Rival Shadow',
    visibleToPlayer: false,
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
    supportsLegendMoments: true,
    supportsShadowWrites: true,
    supportsProofHashExposure: false,
    persistenceClass: 'ACCOUNT_SCOPED',
    auditVisibility: 'BACKEND_VISIBLE',
    fanoutClass: 'BACKEND_INTERNAL',
    deliveryPriority: 'LOW',
    defaultStageMood: 'HOSTILE',
    roomPurpose: 'RIVALRY_MEMORY',
    roomScope: 'ACCOUNT',
    roomKeyStrategy: 'PLAYER_SCOPED',
    presenceTheaterProfile: 'PREDATOR_LURK',
    readReceiptPolicy: 'SERVER_ONLY',
    policyTags: [
      'memory-anchor',
      'callback-source',
      'obsession-risk',
      'crowd-leakable',
      'legend-backstory',
    ],
    defaultShadowCompanions: [],
  },
  RESCUE_SHADOW: {
    id: 'RESCUE_SHADOW',
    family: 'SHADOW',
    displayName: 'Rescue Shadow',
    shortLabel: 'Rescue Shadow',
    visibleToPlayer: false,
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
    persistenceClass: 'RUN_SCOPED',
    auditVisibility: 'BACKEND_VISIBLE',
    fanoutClass: 'BACKEND_INTERNAL',
    deliveryPriority: 'HIGH',
    defaultStageMood: 'WATCHFUL',
    roomPurpose: 'RESCUE_PIPELINE',
    roomScope: 'RUN',
    roomKeyStrategy: 'SERVER_INTERNAL',
    presenceTheaterProfile: 'HELPER_WAIT',
    readReceiptPolicy: 'SERVER_ONLY',
    policyTags: [
      'drop-off-detection',
      'helper-timing',
      'frustration-recovery',
      'quiet-rescue',
      'suppressed-to-player',
    ],
    defaultShadowCompanions: [],
  },
  LIVEOPS_SHADOW: {
    id: 'LIVEOPS_SHADOW',
    family: 'SHADOW',
    displayName: 'LiveOps Shadow',
    shortLabel: 'LiveOps Shadow',
    visibleToPlayer: false,
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
    persistenceClass: 'RUN_SCOPED',
    auditVisibility: 'SERVER_VISIBLE',
    fanoutClass: 'SERVER_INTERNAL',
    deliveryPriority: 'DEFERRED',
    defaultStageMood: 'WATCHFUL',
    roomPurpose: 'LIVEOPS_CONTROL',
    roomScope: 'SEASON',
    roomKeyStrategy: 'SEASON_SCOPED',
    presenceTheaterProfile: 'SHADOW_ONLY',
    readReceiptPolicy: 'SERVER_ONLY',
    policyTags: [
      'world-events',
      'seasonal-control',
      'heat-boost',
      'faction-surge',
      'silent-overrides',
    ],
    defaultShadowCompanions: [],
  },
});

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
  readonly policyTags: readonly string[];
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
  readonly density: 'COMPACT' | 'STANDARD' | 'EXPANDED';
  readonly stageMood: ChatStageMood;
}

export const CHAT_MOUNT_PRESETS: Readonly<
  Record<ChatMountTarget, ChatMountPreset>
> = Object.freeze({
  BATTLE_HUD: {
    mountTarget: 'BATTLE_HUD',
    mountKey: 'battle-hud' as ChatMountKey,
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
    maxVisibleMessages: 60,
    composerPlaceholder: 'Signal the room or answer the attack…',
    density: 'STANDARD',
    stageMood: 'HOSTILE',
  },
  CLUB_UI: {
    mountTarget: 'CLUB_UI',
    mountKey: 'club-ui' as ChatMountKey,
    defaultVisibleChannel: 'GLOBAL',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    allowCollapse: true,
    defaultCollapsed: true,
    showPresenceStrip: true,
    showThreatMeter: false,
    showTranscriptDrawer: true,
    showReplayJump: false,
    showLegendTreatment: false,
    showWorldEventBanner: true,
    maxVisibleMessages: 40,
    composerPlaceholder: 'Join the room…',
    density: 'COMPACT',
    stageMood: 'CALM',
  },
  EMPIRE_GAME_SCREEN: {
    mountTarget: 'EMPIRE_GAME_SCREEN',
    mountKey: 'empire-game-screen' as ChatMountKey,
    defaultVisibleChannel: 'SYNDICATE',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: true,
    showTranscriptDrawer: true,
    showReplayJump: true,
    showLegendTreatment: true,
    showWorldEventBanner: true,
    maxVisibleMessages: 70,
    composerPlaceholder: 'Coordinate your position…',
    density: 'STANDARD',
    stageMood: 'TENSE',
  },
  GAME_BOARD: {
    mountTarget: 'GAME_BOARD',
    mountKey: 'game-board' as ChatMountKey,
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
    maxVisibleMessages: 80,
    composerPlaceholder: 'Play the room as hard as the board…',
    density: 'STANDARD',
    stageMood: 'HOSTILE',
  },
  LEAGUE_UI: {
    mountTarget: 'LEAGUE_UI',
    mountKey: 'league-ui' as ChatMountKey,
    defaultVisibleChannel: 'GLOBAL',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    allowCollapse: true,
    defaultCollapsed: true,
    showPresenceStrip: true,
    showThreatMeter: false,
    showTranscriptDrawer: true,
    showReplayJump: false,
    showLegendTreatment: true,
    showWorldEventBanner: true,
    maxVisibleMessages: 50,
    composerPlaceholder: 'Say it to the league…',
    density: 'COMPACT',
    stageMood: 'WATCHFUL',
  },
  LOBBY_SCREEN: {
    mountTarget: 'LOBBY_SCREEN',
    mountKey: 'lobby-screen' as ChatMountKey,
    defaultVisibleChannel: 'LOBBY',
    allowedVisibleChannels: ['LOBBY', 'GLOBAL'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: false,
    showTranscriptDrawer: true,
    showReplayJump: false,
    showLegendTreatment: false,
    showWorldEventBanner: true,
    maxVisibleMessages: 45,
    composerPlaceholder: 'Warm up the room…',
    density: 'COMPACT',
    stageMood: 'CALM',
  },
  PHANTOM_GAME_SCREEN: {
    mountTarget: 'PHANTOM_GAME_SCREEN',
    mountKey: 'phantom-game-screen' as ChatMountKey,
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
    maxVisibleMessages: 65,
    composerPlaceholder: 'Move quiet. Speak sharper…',
    density: 'STANDARD',
    stageMood: 'WATCHFUL',
  },
  PREDATOR_GAME_SCREEN: {
    mountTarget: 'PREDATOR_GAME_SCREEN',
    mountKey: 'predator-game-screen' as ChatMountKey,
    defaultVisibleChannel: 'GLOBAL',
    allowedVisibleChannels: ['GLOBAL', 'DEAL_ROOM'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: true,
    showTranscriptDrawer: true,
    showReplayJump: true,
    showLegendTreatment: true,
    showWorldEventBanner: true,
    maxVisibleMessages: 65,
    composerPlaceholder: 'Pressure them before they pressure you…',
    density: 'STANDARD',
    stageMood: 'PREDATORY',
  },
  SYNDICATE_GAME_SCREEN: {
    mountTarget: 'SYNDICATE_GAME_SCREEN',
    mountKey: 'syndicate-game-screen' as ChatMountKey,
    defaultVisibleChannel: 'SYNDICATE',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: true,
    showTranscriptDrawer: true,
    showReplayJump: true,
    showLegendTreatment: true,
    showWorldEventBanner: true,
    maxVisibleMessages: 70,
    composerPlaceholder: 'Coordinate, threaten, or close the deal…',
    density: 'STANDARD',
    stageMood: 'CONSPIRATORIAL',
  },
  POST_RUN_SUMMARY: {
    mountTarget: 'POST_RUN_SUMMARY',
    mountKey: 'post-run-summary' as ChatMountKey,
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
    maxVisibleMessages: 100,
    composerPlaceholder: 'The run is over. The room still remembers…',
    density: 'EXPANDED',
    stageMood: 'CEREMONIAL',
  },
});

export const CHAT_MODE_SCOPE_DESCRIPTORS: Readonly<
  Record<ChatModeScope, ChatModeScopeDescriptor>
> = Object.freeze({
  LOBBY: {
    id: 'LOBBY',
    modeScopeId: 'lobby' as ChatModeScopeId,
    displayName: 'Lobby',
    defaultMountTarget: 'LOBBY_SCREEN',
    allowedVisibleChannels: ['LOBBY', 'GLOBAL'],
    stageMood: 'CALM',
    enablesNegotiation: false,
    enablesCrowdHeat: true,
    enablesRescue: false,
    enablesLegendMoments: false,
    enablesWorldEvents: true,
    policyTags: ['pre-run', 'ambient', 'warmup'],
  },
  RUN: {
    id: 'RUN',
    modeScopeId: 'run' as ChatModeScopeId,
    displayName: 'Run',
    defaultMountTarget: 'GAME_BOARD',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    stageMood: 'HOSTILE',
    enablesNegotiation: true,
    enablesCrowdHeat: true,
    enablesRescue: true,
    enablesLegendMoments: true,
    enablesWorldEvents: true,
    policyTags: ['core-loop', 'social-pressure', 'replay-critical'],
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
    policyTags: ['combat', 'telegraphs', 'counterplay'],
  },
  EMPIRE: {
    id: 'EMPIRE',
    modeScopeId: 'empire' as ChatModeScopeId,
    displayName: 'Empire',
    defaultMountTarget: 'EMPIRE_GAME_SCREEN',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    stageMood: 'TENSE',
    enablesNegotiation: true,
    enablesCrowdHeat: true,
    enablesRescue: true,
    enablesLegendMoments: true,
    enablesWorldEvents: true,
    policyTags: ['empire', 'macro-pressure', 'coordination'],
  },
  CLUB: {
    id: 'CLUB',
    modeScopeId: 'club' as ChatModeScopeId,
    displayName: 'Club',
    defaultMountTarget: 'CLUB_UI',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    stageMood: 'CALM',
    enablesNegotiation: false,
    enablesCrowdHeat: true,
    enablesRescue: false,
    enablesLegendMoments: false,
    enablesWorldEvents: true,
    policyTags: ['social-hub', 'ambient'],
  },
  LEAGUE: {
    id: 'LEAGUE',
    modeScopeId: 'league' as ChatModeScopeId,
    displayName: 'League',
    defaultMountTarget: 'LEAGUE_UI',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    stageMood: 'WATCHFUL',
    enablesNegotiation: false,
    enablesCrowdHeat: true,
    enablesRescue: false,
    enablesLegendMoments: true,
    enablesWorldEvents: true,
    policyTags: ['league', 'public-rank', 'spectators'],
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
    policyTags: ['private-strategy', 'trust-network'],
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
    policyTags: ['aggressive', 'lurk-theater', 'deal-pressure'],
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
    policyTags: ['stealth', 'presence-theater', 'delayed-reveal'],
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
    policyTags: ['ritual', 'debrief', 'memory-anchor'],
  },
});

// ============================================================================
// MARK: Room descriptors and topic routes
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

export const CHAT_ROUTE_KEYS = Object.freeze({
  globalRoom: 'global-room' as ChatRouteKey,
  syndicateRoom: 'syndicate-room' as ChatRouteKey,
  dealRoom: 'deal-room' as ChatRouteKey,
  lobbyRoom: 'lobby-room' as ChatRouteKey,
  systemShadow: 'system-shadow' as ChatRouteKey,
  npcShadow: 'npc-shadow' as ChatRouteKey,
  rivalryShadow: 'rivalry-shadow' as ChatRouteKey,
  rescueShadow: 'rescue-shadow' as ChatRouteKey,
  liveopsShadow: 'liveops-shadow' as ChatRouteKey,
} as const);

export function buildChatTopicName(
  channelId: ChatChannelId,
  scope: ChatRoomScope,
  scopeKey: string,
): ChatTopicName {
  return `${channelId.toLowerCase()}.${scope.toLowerCase()}.${scopeKey}` as ChatTopicName;
}

export function buildDefaultRoomId(
  channelId: ChatChannelId,
  scope: ChatRoomScope,
  scopeKey: string,
): ChatRoomId {
  return `room:${channelId}:${scope}:${scopeKey}` as ChatRoomId;
}

export function buildChannelRoomDescriptor(
  channelId: ChatChannelId,
  scopeKey: string,
): ChatRoomDescriptor {
  const descriptor = getChatChannelDescriptor(channelId);
  return {
    id: buildDefaultRoomId(channelId, descriptor.roomScope, scopeKey),
    channelId,
    purpose: descriptor.roomPurpose,
    scope: descriptor.roomScope,
    keyStrategy: descriptor.roomKeyStrategy,
    topicName: buildChatTopicName(channelId, descriptor.roomScope, scopeKey),
    namespace: descriptor.family === 'PUBLIC'
      ? CHAT_NAMESPACES.public
      : descriptor.family === 'PRIVATE'
        ? CHAT_NAMESPACES.private
        : descriptor.family === 'NEGOTIATION'
          ? CHAT_NAMESPACES.negotiation
          : descriptor.family === 'PRE_RUN'
            ? CHAT_NAMESPACES.lobby
            : CHAT_NAMESPACES.shadow,
    replayEnabled: descriptor.supportsReplay,
    proofLedgerEnabled: descriptor.supportsReplay,
    shadowCompanionIds: descriptor.defaultShadowCompanions,
  };
}

// ============================================================================
// MARK: Channel policy hint matrices
// ============================================================================

export const CHAT_SHADOW_COMPANION_MATRIX: Readonly<
  Record<ChatVisibleChannel, readonly ChatShadowChannel[]>
> = Object.freeze({
  GLOBAL: ['SYSTEM_SHADOW', 'RIVALRY_SHADOW', 'LIVEOPS_SHADOW'],
  SYNDICATE: ['SYSTEM_SHADOW', 'RESCUE_SHADOW', 'RIVALRY_SHADOW'],
  DEAL_ROOM: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'RESCUE_SHADOW'],
  LOBBY: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'LIVEOPS_SHADOW'],
});

export const CHAT_HELPER_FALLBACK_CHANNELS: Readonly<
  Record<ChatVisibleChannel, readonly ChatVisibleChannel[]>
> = Object.freeze({
  GLOBAL: ['SYNDICATE', 'LOBBY'],
  SYNDICATE: ['GLOBAL'],
  DEAL_ROOM: ['SYNDICATE', 'GLOBAL'],
  LOBBY: ['GLOBAL'],
});

export const CHAT_ESCALATION_ORDER: readonly ChatVisibleChannel[] = Object.freeze([
  'LOBBY',
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
]);

export const CHAT_DEESCALATION_ORDER: readonly ChatVisibleChannel[] = Object.freeze([
  'DEAL_ROOM',
  'SYNDICATE',
  'GLOBAL',
  'LOBBY',
]);

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
} as const);

// ============================================================================
// MARK: Runtime-safe readers and predicates
// ============================================================================

const VISIBLE_CHANNEL_SET = new Set<string>(CHAT_VISIBLE_CHANNELS);
const SHADOW_CHANNEL_SET = new Set<string>(CHAT_SHADOW_CHANNELS);
const ALL_CHANNEL_SET = new Set<string>(CHAT_ALL_CHANNELS);
const MOUNT_TARGET_SET = new Set<string>(CHAT_MOUNT_TARGETS);
const MODE_SCOPE_SET = new Set<string>(CHAT_MODE_SCOPES);

export function isChatVisibleChannel(value: string): value is ChatVisibleChannel {
  return VISIBLE_CHANNEL_SET.has(value);
}

export function isChatShadowChannel(value: string): value is ChatShadowChannel {
  return SHADOW_CHANNEL_SET.has(value);
}

export function isChatChannelId(value: string): value is ChatChannelId {
  return ALL_CHANNEL_SET.has(value);
}

export function isChatMountTarget(value: string): value is ChatMountTarget {
  return MOUNT_TARGET_SET.has(value);
}

export function isChatModeScope(value: string): value is ChatModeScope {
  return MODE_SCOPE_SET.has(value);
}

export function getChatChannelDescriptor(
  channelId: ChatChannelId,
): ChatChannelDescriptor {
  return CHAT_CHANNEL_DESCRIPTORS[channelId];
}

export function getChatMountPreset(
  mountTarget: ChatMountTarget,
): ChatMountPreset {
  return CHAT_MOUNT_PRESETS[mountTarget];
}

export function getChatModeScopeDescriptor(
  modeScope: ChatModeScope,
): ChatModeScopeDescriptor {
  return CHAT_MODE_SCOPE_DESCRIPTORS[modeScope];
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

export function channelSupportsNegotiation(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsNegotiationLogic;
}

export function channelSupportsRescue(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsRescueLogic;
}

export function channelSupportsWorldEvents(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsWorldEvents;
}

export function channelSupportsLegendMoments(
  channelId: ChatChannelId,
): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsLegendMoments;
}

export function channelSupportsShadowWrites(
  channelId: ChatChannelId,
): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsShadowWrites;
}

export function channelExposesProofHashes(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsProofHashExposure;
}

export function resolveMountTargetForModeScope(
  modeScope: ChatModeScope,
): ChatMountTarget {
  return CHAT_MODE_SCOPE_DESCRIPTORS[modeScope].defaultMountTarget;
}

export function resolveStageMoodForChannel(
  channelId: ChatChannelId,
): ChatStageMood {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].defaultStageMood;
}

export function resolveStageMoodForMount(
  mountTarget: ChatMountTarget,
): ChatStageMood {
  return CHAT_MOUNT_PRESETS[mountTarget].stageMood;
}

export function resolvePrimaryNamespaceForChannel(
  channelId: ChatChannelId,
): ChatNamespace {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];
  switch (descriptor.family) {
    case 'PUBLIC':
      return CHAT_NAMESPACES.public;
    case 'PRIVATE':
      return CHAT_NAMESPACES.private;
    case 'NEGOTIATION':
      return CHAT_NAMESPACES.negotiation;
    case 'PRE_RUN':
      return CHAT_NAMESPACES.lobby;
    case 'SHADOW':
      return CHAT_NAMESPACES.shadow;
    default: {
      const exhaustiveCheck: never = descriptor.family;
      return exhaustiveCheck;
    }
  }
}

export function modeScopeAllowsChannel(
  modeScope: ChatModeScope,
  channelId: ChatVisibleChannel,
): boolean {
  return CHAT_MODE_SCOPE_DESCRIPTORS[modeScope].allowedVisibleChannels.includes(
    channelId,
  );
}

export function mountAllowsChannel(
  mountTarget: ChatMountTarget,
  channelId: ChatVisibleChannel,
): boolean {
  return CHAT_MOUNT_PRESETS[mountTarget].allowedVisibleChannels.includes(
    channelId,
  );
}

export function resolveCompanionShadowsForMount(
  mountTarget: ChatMountTarget,
): readonly ChatShadowChannel[] {
  const preset = CHAT_MOUNT_PRESETS[mountTarget];
  const merged = new Set<ChatShadowChannel>();
  for (const visible of preset.allowedVisibleChannels) {
    for (const shadow of CHAT_SHADOW_COMPANION_MATRIX[visible]) {
      merged.add(shadow);
    }
  }
  return Array.from(merged);
}

export function resolveEscalatedVisibleChannel(
  current: ChatVisibleChannel,
): ChatVisibleChannel {
  const index = CHAT_ESCALATION_ORDER.indexOf(current);
  if (index === -1 || index === CHAT_ESCALATION_ORDER.length - 1) {
    return current;
  }
  return CHAT_ESCALATION_ORDER[index + 1];
}

export function resolveDeEscalatedVisibleChannel(
  current: ChatVisibleChannel,
): ChatVisibleChannel {
  const index = CHAT_DEESCALATION_ORDER.indexOf(current);
  if (index === -1 || index === CHAT_DEESCALATION_ORDER.length - 1) {
    return current;
  }
  return CHAT_DEESCALATION_ORDER[index + 1];
}

// ============================================================================
// MARK: Stable exported readonly package
// ============================================================================

export const CHAT_CHANNEL_CONTRACT = Object.freeze({
  version: CHAT_CONTRACT_VERSION,
  apiVersion: CHAT_CHANNELS_PUBLIC_API_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  visibleChannels: CHAT_VISIBLE_CHANNELS,
  shadowChannels: CHAT_SHADOW_CHANNELS,
  allChannels: CHAT_ALL_CHANNELS,
  channelDescriptors: CHAT_CHANNEL_DESCRIPTORS,
  mountTargets: CHAT_MOUNT_TARGETS,
  mountPresets: CHAT_MOUNT_PRESETS,
  modeScopes: CHAT_MODE_SCOPES,
  modeScopeDescriptors: CHAT_MODE_SCOPE_DESCRIPTORS,
  roomScopes: CHAT_ROOM_SCOPES,
  roomPurposes: CHAT_ROOM_PURPOSES,
  roomKeyStrategies: CHAT_ROOM_KEY_STRATEGIES,
  routeKeys: CHAT_ROUTE_KEYS,
  namespaces: CHAT_NAMESPACES,
  helperFallbackChannels: CHAT_HELPER_FALLBACK_CHANNELS,
  shadowCompanionMatrix: CHAT_SHADOW_COMPANION_MATRIX,
  escalationOrder: CHAT_ESCALATION_ORDER,
  deEscalationOrder: CHAT_DEESCALATION_ORDER,
} as const);

export default CHAT_CHANNEL_CONTRACT;

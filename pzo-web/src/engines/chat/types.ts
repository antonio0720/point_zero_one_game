/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE FRONTEND TYPES
 * FILE: pzo-web/src/engines/chat/types.ts
 * ============================================================================
 *
 * Purpose
 * ---
 * Frontend canonical contract surface for the new chat engine lane.
 *
 * This file intentionally does four jobs at once:
 * 1. becomes the immediate source of truth for the new frontend chat engine,
 * 2. preserves migration compatibility with the existing chat panel/hook lane,
 * 3. mirrors the long-term contract shape that will later move into
 *    /shared/contracts/chat and /shared/contracts/chat/learning,
 * 4. gives every future chat module a stable import surface now, before the
 *    rest of the canonical tree is implemented.
 *
 * Design laws
 * ---
 * - Types first. Runtime modules must depend on this file; this file must not
 *   depend on runtime chat modules.
 * - Read simulation truth; do not invent it.
 * - Preserve compatibility with current engine surfaces:
 *   battle, pressure, zero, shield, and cascade.
 * - Support visible channels AND shadow channels.
 * - Support dramaturgy, memory, relationship continuity, rescue logic,
 *   negotiation logic, presence theater, telemetry, and ML/DL learning.
 * - Keep UI-only presentational concerns out of the deep contracts where
 *   possible, but expose enough metadata for render shells to stay thin.
 *
 * Migration note
 * ---
 * The long-term authority for wire-level contracts belongs in:
 * /shared/contracts/chat
 * /shared/contracts/chat/learning
 *
 * Until those files exist, this frontend lane needs a complete, compilable,
 * locally-owned contract surface. This file is that bridge.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  AttackType,
  BotId,
  BotState,
  EntitlementTier,
  InjectionType,
} from '../battle/types';
import type { CascadeSeverity } from '../cascade/types';
import type { PressureTier } from '../pressure/types';
export type { PressureTier } from '../pressure/types';
import type { ShieldLayerId } from '../shield/types';
import type { RunOutcome } from '../zero/types';

// ── TickTier: declared locally so all consumers import from this file ─────────
export type TickTier =
  | 'OPENING'
  | 'STABLE'
  | 'BUILDING'
  | 'COMPRESSED'
  | 'CRISIS'
  | 'COLLAPSE_IMMINENT';

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
export type { RunOutcome } from '../zero/types';

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

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export type DeepReadonlyRecord<TKey extends string, TValue> = Readonly<
  Record<TKey, Readonly<TValue>>
>;

export type ChatRecord<TKey extends string, TValue> = Record<TKey, TValue>;

export interface ChatRange {
  readonly start: number;
  readonly end: number;
}

export interface ChatVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// ============================================================================
// MARK: Versions, ownership, and public authority
// ============================================================================

export const CHAT_ENGINE_VERSION = '2026.03.13' as const;
export const CHAT_ENGINE_PUBLIC_API_VERSION = '1.0.0-alpha' as const;

export const CHAT_ENGINE_AUTHORITIES = Object.freeze({
  sharedContractsRoot: '/shared/contracts/chat',
  sharedLearningRoot: '/shared/contracts/chat/learning',
  frontendEngineRoot: '/pzo-web/src/engines/chat',
  frontendUiRoot: '/pzo-web/src/components/chat',
  backendEngineRoot: '/backend/src/game/engine/chat',
  serverTransportRoot: '/pzo-server/src/chat',
  frontendLearningRoot: '/pzo-web/src/engines/chat/intelligence',
  backendLearningRoot: '/backend/src/game/engine/chat/intelligence',
} as const);

export type ChatAuthorityKey = keyof typeof CHAT_ENGINE_AUTHORITIES;

// ============================================================================
// MARK: Channels, rooms, mounts, and mode scopes
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
 * Existing pzo-web chat components have imported ChatChannel as the visible set.
 */
export type ChatChannel = ChatVisibleChannel;

export type ChatChannelFamily =
  | 'PUBLIC'
  | 'PRIVATE'
  | 'NEGOTIATION'
  | 'PRE_RUN'
  | 'SHADOW';

export interface ChatChannelDescriptor {
  readonly id: ChatChannelId;
  readonly family: ChatChannelFamily;
  readonly visibleToPlayer: boolean;
  readonly supportsComposer: boolean;
  readonly supportsPresence: boolean;
  readonly supportsTyping: boolean;
  readonly supportsReadReceipts: boolean;
  readonly supportsReplay: boolean;
  readonly supportsCrowdHeat: boolean;
  readonly supportsRelationshipState: boolean;
  readonly supportsNpcInjection: boolean;
  readonly supportsNegotiationLogic: boolean;
  readonly supportsRescueLogic: boolean;
  readonly supportsShadowWrites: boolean;
  readonly persistenceClass: 'TRANSIENT' | 'RUN_SCOPED' | 'ACCOUNT_SCOPED';
}

export const CHAT_CHANNEL_DESCRIPTORS: Readonly<
  Record<ChatChannelId, ChatChannelDescriptor>
> = Object.freeze({
  GLOBAL: {
    id: 'GLOBAL',
    family: 'PUBLIC',
    visibleToPlayer: true,
    supportsComposer: true,
    supportsPresence: true,
    supportsTyping: true,
    supportsReadReceipts: true,
    supportsReplay: true,
    supportsCrowdHeat: true,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: true,
    supportsShadowWrites: true,
    persistenceClass: 'RUN_SCOPED',
  },
  SYNDICATE: {
    id: 'SYNDICATE',
    family: 'PRIVATE',
    visibleToPlayer: true,
    supportsComposer: true,
    supportsPresence: true,
    supportsTyping: true,
    supportsReadReceipts: true,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: true,
    supportsShadowWrites: true,
    persistenceClass: 'ACCOUNT_SCOPED',
  },
  DEAL_ROOM: {
    id: 'DEAL_ROOM',
    family: 'NEGOTIATION',
    visibleToPlayer: true,
    supportsComposer: true,
    supportsPresence: true,
    supportsTyping: true,
    supportsReadReceipts: true,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: true,
    supportsRescueLogic: true,
    supportsShadowWrites: true,
    persistenceClass: 'RUN_SCOPED',
  },
  LOBBY: {
    id: 'LOBBY',
    family: 'PRE_RUN',
    visibleToPlayer: true,
    supportsComposer: true,
    supportsPresence: true,
    supportsTyping: true,
    supportsReadReceipts: true,
    supportsReplay: true,
    supportsCrowdHeat: true,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: false,
    supportsShadowWrites: true,
    persistenceClass: 'RUN_SCOPED',
  },
  SYSTEM_SHADOW: {
    id: 'SYSTEM_SHADOW',
    family: 'SHADOW',
    visibleToPlayer: false,
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: false,
    supportsNegotiationLogic: false,
    supportsRescueLogic: true,
    supportsShadowWrites: true,
    persistenceClass: 'RUN_SCOPED',
  },
  NPC_SHADOW: {
    id: 'NPC_SHADOW',
    family: 'SHADOW',
    visibleToPlayer: false,
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: false,
    supportsShadowWrites: true,
    persistenceClass: 'RUN_SCOPED',
  },
  RIVALRY_SHADOW: {
    id: 'RIVALRY_SHADOW',
    family: 'SHADOW',
    visibleToPlayer: false,
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: true,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: false,
    supportsShadowWrites: true,
    persistenceClass: 'ACCOUNT_SCOPED',
  },
  RESCUE_SHADOW: {
    id: 'RESCUE_SHADOW',
    family: 'SHADOW',
    visibleToPlayer: false,
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: false,
    supportsRelationshipState: true,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: true,
    supportsShadowWrites: true,
    persistenceClass: 'RUN_SCOPED',
  },
  LIVEOPS_SHADOW: {
    id: 'LIVEOPS_SHADOW',
    family: 'SHADOW',
    visibleToPlayer: false,
    supportsComposer: false,
    supportsPresence: false,
    supportsTyping: false,
    supportsReadReceipts: false,
    supportsReplay: true,
    supportsCrowdHeat: true,
    supportsRelationshipState: false,
    supportsNpcInjection: true,
    supportsNegotiationLogic: false,
    supportsRescueLogic: false,
    supportsShadowWrites: true,
    persistenceClass: 'RUN_SCOPED',
  },
});

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
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly allowCollapse: boolean;
  readonly defaultCollapsed: boolean;
  readonly showPresenceStrip: boolean;
  readonly showThreatMeter: boolean;
  readonly showTranscriptDrawer: boolean;
  readonly maxVisibleMessages: number;
  readonly composerPlaceholder: string;
  readonly density: 'COMPACT' | 'STANDARD' | 'EXPANDED';
  readonly stageMood: 'CALM' | 'TENSE' | 'HOSTILE' | 'PREDATORY' | 'CEREMONIAL';
}

export const CHAT_MOUNT_PRESETS: Readonly<
  Record<ChatMountTarget, ChatMountPreset>
> = Object.freeze({
  BATTLE_HUD: {
    mountTarget: 'BATTLE_HUD',
    defaultVisibleChannel: 'GLOBAL',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: true,
    showTranscriptDrawer: true,
    maxVisibleMessages: 60,
    composerPlaceholder: 'Signal the room or answer the attack…',
    density: 'STANDARD',
    stageMood: 'HOSTILE',
  },
  CLUB_UI: {
    mountTarget: 'CLUB_UI',
    defaultVisibleChannel: 'GLOBAL',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    allowCollapse: true,
    defaultCollapsed: true,
    showPresenceStrip: true,
    showThreatMeter: false,
    showTranscriptDrawer: true,
    maxVisibleMessages: 40,
    composerPlaceholder: 'Join the room…',
    density: 'COMPACT',
    stageMood: 'CALM',
  },
  EMPIRE_GAME_SCREEN: {
    mountTarget: 'EMPIRE_GAME_SCREEN',
    defaultVisibleChannel: 'SYNDICATE',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: true,
    showTranscriptDrawer: true,
    maxVisibleMessages: 70,
    composerPlaceholder: 'Coordinate your position…',
    density: 'STANDARD',
    stageMood: 'TENSE',
  },
  GAME_BOARD: {
    mountTarget: 'GAME_BOARD',
    defaultVisibleChannel: 'GLOBAL',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: true,
    showTranscriptDrawer: true,
    maxVisibleMessages: 55,
    composerPlaceholder: 'Speak into the run…',
    density: 'STANDARD',
    stageMood: 'TENSE',
  },
  LEAGUE_UI: {
    mountTarget: 'LEAGUE_UI',
    defaultVisibleChannel: 'GLOBAL',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    allowCollapse: true,
    defaultCollapsed: true,
    showPresenceStrip: true,
    showThreatMeter: false,
    showTranscriptDrawer: true,
    maxVisibleMessages: 45,
    composerPlaceholder: 'Drop a line to the league…',
    density: 'COMPACT',
    stageMood: 'CEREMONIAL',
  },
  LOBBY_SCREEN: {
    mountTarget: 'LOBBY_SCREEN',
    defaultVisibleChannel: 'LOBBY',
    allowedVisibleChannels: ['LOBBY', 'GLOBAL'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: false,
    showTranscriptDrawer: true,
    maxVisibleMessages: 50,
    composerPlaceholder: 'Warm up the room…',
    density: 'STANDARD',
    stageMood: 'CALM',
  },
  PHANTOM_GAME_SCREEN: {
    mountTarget: 'PHANTOM_GAME_SCREEN',
    defaultVisibleChannel: 'GLOBAL',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: true,
    showTranscriptDrawer: true,
    maxVisibleMessages: 65,
    composerPlaceholder: 'Ghost the room or strike…',
    density: 'STANDARD',
    stageMood: 'HOSTILE',
  },
  PREDATOR_GAME_SCREEN: {
    mountTarget: 'PREDATOR_GAME_SCREEN',
    defaultVisibleChannel: 'DEAL_ROOM',
    allowedVisibleChannels: ['GLOBAL', 'DEAL_ROOM'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: true,
    showTranscriptDrawer: true,
    maxVisibleMessages: 70,
    composerPlaceholder: 'Make the room blink first…',
    density: 'STANDARD',
    stageMood: 'PREDATORY',
  },
  SYNDICATE_GAME_SCREEN: {
    mountTarget: 'SYNDICATE_GAME_SCREEN',
    defaultVisibleChannel: 'SYNDICATE',
    allowedVisibleChannels: ['SYNDICATE', 'GLOBAL', 'DEAL_ROOM'],
    allowCollapse: true,
    defaultCollapsed: false,
    showPresenceStrip: true,
    showThreatMeter: true,
    showTranscriptDrawer: true,
    maxVisibleMessages: 75,
    composerPlaceholder: 'Move with the syndicate…',
    density: 'EXPANDED',
    stageMood: 'CEREMONIAL',
  },
  POST_RUN_SUMMARY: {
    mountTarget: 'POST_RUN_SUMMARY',
    defaultVisibleChannel: 'GLOBAL',
    allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
    allowCollapse: false,
    defaultCollapsed: false,
    showPresenceStrip: false,
    showThreatMeter: false,
    showTranscriptDrawer: true,
    maxVisibleMessages: 100,
    composerPlaceholder: 'The run is over. The witnesses remain.',
    density: 'EXPANDED',
    stageMood: 'CEREMONIAL',
  },
});

// ============================================================================
// MARK: Actor identities, sender classes, and persona ownership
// ============================================================================

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

export const CHAT_SENDER_ROLES = [
  'SELF',
  'OTHER_PLAYER',
  'SYSTEM_NOTICE',
  'SYSTEM_PROOF',
  'HATER_BOT',
  'HELPER_GUIDE',
  'AMBIENT_WATCHER',
  'CROWD_VOICE',
  'DEAL_BROKER',
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
  readonly botId?: BotId;
  readonly npcId?: ChatNpcId;
  readonly avatarUrl?: string;
  readonly accentColorToken?: string;
}

// ============================================================================
// MARK: Message kinds, lifecycle states, moderation, and delivery
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

/**
 * Migration compatibility alias.
 * The legacy panel/hook refer to MessageKind.
 */
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

export type ChatNotificationKind = (typeof CHAT_NOTIFICATION_KINDS)[number];

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
// MARK: Presence, typing, reads, and theater
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
// MARK: Proof, replay, legend, and audit surfaces
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
  readonly requestId?: ChatRequestId;
  readonly telemetryId?: ChatTelemetryId;
  readonly authoritativeSequence?: number;
  readonly sessionId?: ChatSessionId;
  readonly roomId?: ChatRoomId;
  readonly insertedAt: UnixMs;
}

// ============================================================================
// MARK: Rich simulation metadata attached to messages
// ============================================================================

export interface BotTauntSource {
  readonly botId: BotId;
  readonly botName: string;
  readonly botState: BotState;
  readonly attackType: AttackType;
  readonly injectionType?: InjectionType;
  readonly targetLayer?: ShieldLayerId;
  readonly dialogue: string;
  readonly isRetreat: boolean;
}

export interface ShieldEventMeta {
  readonly layerId: ShieldLayerId;
  readonly integrity: number;
  readonly maxIntegrity: number;
  readonly isBreached: boolean;
  readonly attackId?: string;
}

export interface CascadeAlertMeta {
  readonly chainId: string;
  readonly severity: CascadeSeverity;
  readonly direction: 'NEGATIVE' | 'POSITIVE';
}

export interface PressureMeta {
  readonly pressureTier?: PressureTier;
  readonly pressureScore?: number;
  readonly haterHeat?: number;
  readonly passiveShieldDrain?: boolean;
}

export interface TickMeta {
  readonly tickTier?: TickTier;
  readonly tickNumber?: TickNumber;
  readonly runOutcome?: RunOutcome;
  readonly runPhase?: 'PRE_RUN' | 'RUNNING' | 'ENDING' | 'POST_RUN';
}

export interface DealRoomMeta {
  readonly offerId?: ChatOfferId;
  readonly isBinding?: boolean;
  readonly riskScore?: number;
  readonly bluffRisk?: Score01;
  readonly urgencyScore?: Score01;
}

export interface ChatInjectionMeta {
  readonly injectionType: InjectionType;
  readonly sourceBotId?: BotId;
  readonly sourceAttackType?: AttackType;
  readonly targetLayerId?: ShieldLayerId;
  readonly entitlementTier?: EntitlementTier;
  readonly severityScore?: Score100;
  readonly injectedAt?: UnixMs;
}

export interface ChatMessageMeta {
  readonly botSource?: BotTauntSource;
  readonly shieldMeta?: ShieldEventMeta;
  readonly cascadeMeta?: CascadeAlertMeta;
  readonly pressure?: PressureMeta;
  readonly tick?: TickMeta;
  readonly dealRoom?: DealRoomMeta;
  readonly injection?: ChatInjectionMeta;
}

// ============================================================================
// MARK: Scenes, moments, dramaturgy, silence, and reveal orchestration
// ============================================================================

export const CHAT_MOMENT_TYPES = [
  'RUN_START',
  'RUN_END',
  'PRESSURE_SURGE',
  'SHIELD_BREACH',
  'CASCADE_TRIGGER',
  'CASCADE_BREAK',
  'BOT_ATTACK',
  'BOT_RETREAT',
  'HELPER_RESCUE',
  'DEAL_ROOM_STANDOFF',
  'SOVEREIGN_APPROACH',
  'SOVEREIGN_ACHIEVED',
  'LEGEND_MOMENT',
  'WORLD_EVENT',
] as const;

export type ChatMomentType = (typeof CHAT_MOMENT_TYPES)[number];

export const CHAT_SCENE_BEAT_TYPES = [
  'SYSTEM_NOTICE',
  'HATER_ENTRY',
  'CROWD_SWARM',
  'HELPER_INTERVENTION',
  'PLAYER_REPLY_WINDOW',
  'SILENCE',
  'REVEAL',
  'POST_BEAT_ECHO',
] as const;

export type ChatSceneBeatType = (typeof CHAT_SCENE_BEAT_TYPES)[number];

export interface ChatSceneBeat {
  readonly beatType: ChatSceneBeatType;
  readonly actorId?: string;
  readonly delayMs: number;
  readonly requiredChannel: ChatChannelId;
  readonly skippable: boolean;
  readonly canInterrupt: boolean;
  readonly payloadHint?: string;
}

export interface ChatScenePlan {
  readonly sceneId: ChatSceneId;
  readonly momentId: ChatMomentId;
  readonly momentType: ChatMomentType;
  readonly primaryChannel: ChatChannelId;
  readonly beats: readonly ChatSceneBeat[];
  readonly startedAt: UnixMs;
  readonly expectedDurationMs: number;
  readonly allowPlayerComposerDuringScene: boolean;
  readonly cancellableByAuthoritativeEvent: boolean;
}

export const CHAT_INTERRUPT_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
  'ABSOLUTE',
] as const;

export type ChatInterruptPriority = (typeof CHAT_INTERRUPT_PRIORITIES)[number];

export interface ChatInterruptionRule {
  readonly interrupterActorKind: ChatActorKind;
  readonly priority: ChatInterruptPriority;
  readonly canBreakSilence: boolean;
  readonly canPreemptCrowd: boolean;
  readonly canPreemptHelper: boolean;
  readonly canPreemptDealRoom: boolean;
}

export interface ChatSilenceDecision {
  readonly enforced: boolean;
  readonly durationMs: number;
  readonly reason:
    | 'DREAD'
    | 'RESCUE_WAIT'
    | 'NEGOTIATION_PRESSURE'
    | 'SCENE_COMPOSITION'
    | 'READ_THEATER'
    | 'NONE';
  readonly breakConditions: readonly string[];
}

export interface ChatRevealSchedule {
  readonly revealAt: UnixMs;
  readonly revealChannel: ChatChannelId;
  readonly revealReason:
    | 'DELAYED_HATER'
    | 'DELAYED_HELPER'
    | 'QUOTE_CALLBACK'
    | 'WORLD_EVENT'
    | 'SCENE_STAGING';
  readonly payloadRef: string;
}

// ============================================================================
// MARK: Relationships, trust, memory, quotes, and continuity
// ============================================================================

export interface ChatRelationshipVector {
  readonly respect: Score100;
  readonly fear: Score100;
  readonly contempt: Score100;
  readonly fascination: Score100;
  readonly trust: Score100;
  readonly familiarity: Score100;
  readonly rivalryIntensity: Score100;
  readonly rescueDebt: Score100;
  readonly adviceObedience: Score100;
}

export interface ChatRelationshipState {
  readonly relationshipId: ChatRelationshipId;
  readonly playerId: ChatUserId;
  readonly counterpartId: string;
  readonly counterpartKind: ChatActorKind;
  readonly vector: ChatRelationshipVector;
  readonly lastMeaningfulShiftAt: UnixMs;
  readonly callbacksAvailable: readonly ChatQuoteId[];
  readonly escalationTier: 'NONE' | 'MILD' | 'ACTIVE' | 'OBSESSIVE';
}

export interface ChatQuoteMemory {
  readonly quoteId: ChatQuoteId;
  readonly sourceMessageId: ChatMessageId;
  readonly speakerId: string;
  readonly quoteText: string;
  readonly salience: Score100;
  readonly usableInCallback: boolean;
  readonly createdAt: UnixMs;
}

export interface ChatMemoryAnchor {
  readonly anchorId: ChatMemoryAnchorId;
  readonly anchorType:
    | 'QUOTE'
    | 'BREACH'
    | 'RESCUE'
    | 'COMEBACK'
    | 'DEAL_ROOM'
    | 'SOVEREIGNTY'
    | 'HUMILIATION';
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messageIds: readonly ChatMessageId[];
  readonly salience: Score100;
  readonly createdAt: UnixMs;
  readonly embeddingKey?: string;
}

export interface ChatContinuityState {
  readonly lastMountTarget?: ChatMountTarget;
  readonly activeSceneId?: ChatSceneId;
  readonly unresolvedMomentIds: readonly ChatMomentId[];
  readonly carryoverSummary?: string;
  readonly carriedPersonaIds: readonly string[];
}

// ============================================================================
// MARK: Persona, voiceprint, cadence, and NPC presentation
// ============================================================================

export const CHAT_PERSONA_TEMPERATURES = [
  'ICE',
  'COLD',
  'CONTROLLED',
  'WARM',
  'VOLCANIC',
] as const;

export type ChatPersonaTemperature = (typeof CHAT_PERSONA_TEMPERATURES)[number];

export interface ChatPersonaVoiceprint {
  readonly personaId: string;
  readonly punctuationStyle: 'SPARSE' | 'SHARP' | 'ELLIPTICAL' | 'FORMAL';
  readonly averageSentenceLength: 'SHORT' | 'MEDIUM' | 'LONG';
  readonly emotionalTemperature: ChatPersonaTemperature;
  readonly delayProfileMs: readonly [number, number];
  readonly interruptionStyle: 'PATIENT' | 'CUTTING' | 'AMBUSH';
  readonly signatureOpeners: readonly string[];
  readonly signatureClosers: readonly string[];
  readonly lexiconTags: readonly string[];
  readonly prefersLowercase?: boolean;
  readonly prefersSparseEmoji?: boolean;
}

export interface ChatNpcDescriptor {
  readonly npcId: ChatNpcId;
  readonly actorKind: Exclude<ChatActorKind, 'PLAYER' | 'SYSTEM'>;
  readonly displayName: string;
  readonly personaId: string;
  readonly botId?: BotId;
  readonly helperArchetype?: string;
  readonly haterArchetype?: string;
  readonly crowdArchetype?: string;
  readonly cadenceFloorMs: number;
  readonly cadenceCeilMs: number;
  readonly enabledChannels: readonly ChatChannelId[];
  readonly coldStartBoost?: Score01;
}

// ============================================================================
// MARK: Social heat, audience state, reputation, and channel mood
// ============================================================================

export interface ChatAudienceHeat {
  readonly channelId: ChatVisibleChannel;
  readonly heat: Score100;
  readonly hype: Score100;
  readonly ridicule: Score100;
  readonly scrutiny: Score100;
  readonly volatility: Score100;
  readonly lastUpdatedAt: UnixMs;
}

export interface ChatReputationState {
  readonly publicAura: Score100;
  readonly syndicateCredibility: Score100;
  readonly negotiationFear: Score100;
  readonly comebackRespect: Score100;
  readonly humiliationRisk: Score100;
}

export interface ChatChannelMood {
  readonly channelId: ChatChannelId;
  readonly mood:
    | 'CALM'
    | 'SUSPICIOUS'
    | 'HOSTILE'
    | 'ECSTATIC'
    | 'PREDATORY'
    | 'MOURNFUL';
  readonly reason: string;
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: Rescue, frustration interception, and recovery policy
// ============================================================================

export const CHAT_RESCUE_INTENTS = [
  'COACH',
  'CALM',
  'WARN',
  'SIMPLIFY',
  'OFFER_EXIT',
  'PROTECT_DIGNITY',
] as const;

export type ChatRescueIntent = (typeof CHAT_RESCUE_INTENTS)[number];

export interface ChatDropOffSignals {
  readonly silenceAfterCollapseMs: number;
  readonly repeatedComposerDeletes: number;
  readonly panelCollapseCount: number;
  readonly channelHopCount: number;
  readonly failedInputCount: number;
  readonly negativeEmotionScore: Score100;
}

export interface ChatRescueDecision {
  readonly interventionId: ChatInterventionId;
  readonly intent: ChatRescueIntent;
  readonly urgency: Score100;
  readonly helperPersonaId?: string;
  readonly deliverInChannel: ChatVisibleChannel;
  readonly respectSilenceFirst: boolean;
  readonly triggerAt: UnixMs;
}

// ============================================================================
// MARK: Deal room negotiation, offers, and counterplay
// ============================================================================

export interface ChatOfferSnapshot {
  readonly offerId: ChatOfferId;
  readonly channelId: Extract<ChatVisibleChannel, 'DEAL_ROOM'>;
  readonly offeredByActorId: string;
  readonly headline: string;
  readonly amountText?: string;
  readonly urgencyScore: Score100;
  readonly bluffScore: Score100;
  readonly overpayRisk: Score100;
  readonly accepted: boolean;
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

export interface ChatCounterplayWindow {
  readonly opensAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly reason: 'OFFER_BAIT' | 'HATER_TELEGRAPH' | 'DEAL_ROOM_TRAP';
  readonly playerFacingHint?: string;
}

// ============================================================================
// MARK: LiveOps, world events, seasonal overlays
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

// ============================================================================
// MARK: Emotion, affect, attachment, and confidence swing
// ============================================================================

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

// ============================================================================
// MARK: Telemetry, features, cold start, ranking, and retrieval-backed continuity
// ============================================================================

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

export type ChatTelemetryEventName = (typeof CHAT_TELEMETRY_EVENTS)[number];

export interface ChatTelemetryEnvelope {
  readonly telemetryId: ChatTelemetryId;
  readonly eventName: ChatTelemetryEventName;
  readonly occurredAt: UnixMs;
  readonly sessionId?: ChatSessionId;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly payload: JsonObject;
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
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
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
// MARK: Upstream signals from the seven-engine stack and nearby systems
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
}

export interface ChatPressureTierChangedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'PRESSURE_TIER_CHANGED';
  readonly nextTier: PressureTier;
  readonly score?: number;
}

export interface ChatTickTierChangedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'TICK_TIER_CHANGED';
  readonly nextTier: TickTier;
}

export interface ChatShieldBreachedSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'SHIELD_LAYER_BREACHED';
  readonly layerId: ShieldLayerId;
  readonly integrityAfter: number;
}

export interface ChatBotAttackSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'BOT_ATTACK_FIRED';
  readonly botId: BotId;
  readonly attackType: AttackType;
  readonly targetLayerId?: ShieldLayerId;
}

export interface ChatCascadeSignal extends ChatUpstreamSignalBase {
  readonly signalType: 'CASCADE_CHAIN_STARTED' | 'CASCADE_CHAIN_BROKEN';
  readonly chainId: string;
  readonly severity?: CascadeSeverity;
}

export type ChatUpstreamSignal =
  | ChatPressureTierChangedSignal
  | ChatTickTierChangedSignal
  | ChatShieldBreachedSignal
  | ChatBotAttackSignal
  | ChatCascadeSignal
  | ChatUpstreamSignalBase;

// ============================================================================
// MARK: Legacy compatibility surfaces from existing chat lane
// ============================================================================

export interface GameChatContext {
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
  readonly botId?: BotId;
  readonly attackType?: AttackType;
  readonly injectionType?: InjectionType;
  readonly targetLayer?: ShieldLayerId;
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
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly runOutcome?: RunOutcome;

  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly relationshipIds?: readonly ChatRelationshipId[];
  readonly quoteIds?: readonly ChatQuoteId[];
  readonly readReceipts?: readonly ChatReadReceipt[];
  readonly tags?: readonly string[];
}

// ============================================================================
// MARK: Composer, notifications, room state, and engine-facing view state
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
  readonly status: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';
  readonly sessionId?: ChatSessionId;
  readonly latencyMs?: number;
  readonly retryCount: number;
  readonly lastError?: string;
}

// ============================================================================
// MARK: Engine state snapshot
// ============================================================================

export interface ChatEngineState {
  readonly version: string;
  readonly connection: ChatConnectionState;
  readonly activeMountTarget: ChatMountTarget;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly memberships: readonly ChatRoomMembership[];
  readonly messagesByChannel: Readonly<Record<ChatVisibleChannel, readonly ChatMessage[]>>;
  readonly shadowMessageCountByChannel: Readonly<Record<ChatShadowChannel, number>>;
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
  readonly relationshipsByCounterpartId: Readonly<Record<string, ChatRelationshipState>>;
  readonly offerState?: ChatNegotiationState;
  readonly learningProfile?: ChatLearningProfile;
  readonly continuity: ChatContinuityState;
  readonly lastAuthoritativeSyncAt?: UnixMs;
}

// ============================================================================
// MARK: Selectors and reader contracts for adapters
// ============================================================================

export interface ChatBattleSnapshotReader {
  readonly haterHeat?: number;
  readonly activeBotsCount?: number;
  readonly topThreatBotId?: BotId;
  readonly entitlementTier?: EntitlementTier;
}

export interface ChatRunSnapshotReader {
  readonly tickNumber: number;
  readonly netWorth: number;
  readonly monthlyIncome: number;
  readonly monthlyExpenses: number;
  readonly runOutcome?: RunOutcome;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
}

export interface ChatMechanicsBridgeReader {
  readonly modeKey?: string;
  readonly pendingDecisionWindows?: number;
  readonly activeThreatCards?: number;
  readonly freedomThreshold?: number;
}

export interface ChatModeReader {
  readonly mountTarget: ChatMountTarget;
  readonly allowDealRoom: boolean;
  readonly allowSyndicate: boolean;
  readonly allowLobby: boolean;
}

// ============================================================================
// MARK: Client requests, authoritative frames, and transport envelopes
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
// MARK: Runtime config, thresholds, and sane default constants
// ============================================================================

export const CHAT_ENGINE_CONSTANTS = Object.freeze({
  version: CHAT_ENGINE_VERSION,
  maxVisibleMessagesDefault: 500,
  maxComposerLength: 600,
  localDedupWindowMs: 100,
  sceneSoftTimeoutMs: 12_000,
  revealPollIntervalMs: 150,
  typingDefaultTimeoutMs: 2_500,
  presenceStaleAfterMs: 25_000,
  rescueSilenceThresholdMs: 10_000,
  coldStartProfileVersion: '1',
  legendPrestigeFloor: 70,
  audienceHeatMax: 100,
  relationshipAxisMax: 100,
  emotionAxisMax: 100,
} as const);

// ============================================================================
// MARK: Lightweight helper guards and compatibility utilities
// ============================================================================

export const isVisibleChatChannel = (
  value: string,
): value is ChatVisibleChannel => (CHAT_VISIBLE_CHANNELS as readonly string[]).includes(value);

export const isShadowChatChannel = (
  value: string,
): value is ChatShadowChannel => (CHAT_SHADOW_CHANNELS as readonly string[]).includes(value);

export const isAnyChatChannel = (value: string): value is ChatChannelId =>
  (CHAT_ALL_CHANNELS as readonly string[]).includes(value);

export const isLegacyMessageKind = (value: string): value is MessageKind =>
  (CHAT_MESSAGE_KINDS as readonly string[]).includes(value);

export const isNegotiationChannel = (
  channelId: ChatChannelId,
): channelId is Extract<ChatChannelId, 'DEAL_ROOM'> => channelId === 'DEAL_ROOM';

export const isReplayEligibleMessage = (message: ChatMessage): boolean =>
  Boolean(message.replay?.replayEligible ?? true);

export const isLegendCandidateMessage = (message: ChatMessage): boolean =>
  Boolean(message.legend?.legendClass || message.replay?.legendEligible);

export const supportsComposerForChannel = (channelId: ChatChannelId): boolean =>
  CHAT_CHANNEL_DESCRIPTORS[channelId].supportsComposer;

export const channelFamilyOf = (channelId: ChatChannelId): ChatChannelFamily =>
  CHAT_CHANNEL_DESCRIPTORS[channelId].family;

// ============================================================================
// MARK: Public export groups for ergonomics
// ============================================================================

export interface ChatTypesNamespace {
  readonly version: typeof CHAT_ENGINE_VERSION;
  readonly publicApiVersion: typeof CHAT_ENGINE_PUBLIC_API_VERSION;
  readonly visibleChannels: typeof CHAT_VISIBLE_CHANNELS;
  readonly shadowChannels: typeof CHAT_SHADOW_CHANNELS;
  readonly messageKinds: typeof CHAT_MESSAGE_KINDS;
  readonly eventNames: typeof CHAT_ENGINE_EVENT_NAMES;
  readonly constants: typeof CHAT_ENGINE_CONSTANTS;
}

export const CHAT_TYPES_NAMESPACE: ChatTypesNamespace = Object.freeze({
  version: CHAT_ENGINE_VERSION,
  publicApiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
  visibleChannels: CHAT_VISIBLE_CHANNELS,
  shadowChannels: CHAT_SHADOW_CHANNELS,
  messageKinds: CHAT_MESSAGE_KINDS,
  eventNames: CHAT_ENGINE_EVENT_NAMES,
  constants: CHAT_ENGINE_CONSTANTS,
});

// ============================================================================
// MARK: Future module contracts referenced by the rest of the canonical tree
// ============================================================================

export interface ChatEnginePublicApi {
  readonly state: ChatEngineState;
  mount(nextTarget: ChatMountTarget): void;
  setVisibleChannel(nextChannel: ChatVisibleChannel): void;
  stageMessage(request: ChatClientSendMessageRequest): Promise<void>;
  applyAuthoritativeFrame(frame: ChatAuthoritativeFrame): void;
  ingestUpstreamSignal(signal: ChatUpstreamSignal): void;
  destroy(): void;
}

export interface ChatSocketClientApi {
  connect(): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  sendMessage(request: ChatClientSendMessageRequest): Promise<void>;
  sendTyping(request: ChatClientTypingRequest): Promise<void>;
}

export interface ChatEventBridgeApi {
  start(): void;
  stop(): void;
  ingest(signal: ChatUpstreamSignal): void;
}

export interface ChatPresenceControllerApi {
  setLocalPresence(channelId: ChatVisibleChannel, presence: ChatPresenceState): void;
  applyRemotePresence(snapshots: readonly ChatPresenceSnapshot[]): void;
}

export interface ChatTypingControllerApi {
  setLocalTyping(channelId: ChatVisibleChannel, typingState: ChatTypingState): void;
  applyRemoteTyping(snapshots: readonly ChatTypingSnapshot[]): void;
}

export interface ChatNotificationControllerApi {
  applyNotificationState(nextState: ChatNotificationState): void;
  clearChannelUnread(channel: ChatVisibleChannel): void;
}

export interface ChatTranscriptBufferApi {
  append(channel: ChatVisibleChannel, message: ChatMessage): void;
  appendMany(channel: ChatVisibleChannel, messages: readonly ChatMessage[]): void;
  reset(channel?: ChatVisibleChannel): void;
  snapshot(channel: ChatVisibleChannel): readonly ChatMessage[];
}

export interface ChatInvasionDirectorApi {
  shouldOpenInvasion(moment: ChatMomentType, state: ChatEngineState): boolean;
}

export interface ChatNpcDirectorApi {
  planScene(moment: ChatMomentType, state: ChatEngineState): Nullable<ChatScenePlan>;
}

// ============================================================================
// MARK: End of contract surface
// ============================================================================

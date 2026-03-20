/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT PRESENCE STYLE CONTRACTS
 * FILE: shared/contracts/chat/ChatPresenceStyle.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for ambient lurk, read, typing, timing,
 * hesitation, suppressed presence, delayed reveals, and pressure-oriented
 * presence theater used by:
 *
 * - /shared/contracts/chat
 * - /pzo-web/src/engines/chat
 * - /pzo-web/src/components/chat
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Presence is not cosmetic. It is a first-class psychological timing layer.
 * 2. NPCs, rivals, helpers, system agents, and deal-room entities may appear to
 *    type, read, lurk, hesitate, disappear, or suppress a response as part of
 *    authored pressure and narrative control.
 * 3. The frontend may stage light optimism for theater, but authority owns the
 *    final reveal, suppression, queue priority, expiry, and channel exposure.
 * 4. Presence contracts must support both visible channels and shadow channels
 *    without leaking implementation-specific scheduler logic into the shared
 *    lane.
 * 5. Read behavior, response latency, and typing interruptions are part of
 *    social combat, rescue timing, negotiation, prestige, and memory callback
 *    systems.
 * 6. This file must stay broad enough to bridge existing donor vocabulary in the
 *    current chat engine while becoming the long-term authority for dedicated
 *    presence theater lanes.
 *
 * Notes
 * -----
 * - This file intentionally models timing ranges, style preferences, reveal
 *   contracts, and runtime snapshots without encoding engine-specific timers.
 * - Shadow presence is explicit so invisible intent can accumulate before an
 *   on-screen message is revealed.
 * - The contract allows future channels, actor classes, and reveal modes while
 *   preserving strong canonical unions for the current runtime.
 * ============================================================================
 */

/**
 * Visible player-facing channels that already exist in the current chat lane.
 * The string extension keeps the contract forward-compatible with future modes.
 */
export type ChatPresenceVisibleChannel =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'DIRECT'
  | 'SPECTATOR'
  | (string & {});

/**
 * Hidden channels that carry invisible pressure, suppression, queue metadata,
 * reveal scheduling, and future callback anchors.
 */
export type ChatPresenceShadowChannel =
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW'
  | (string & {});

/**
 * Any addressable channel for presence theater.
 */
export type ChatPresenceAddressableChannel =
  | ChatPresenceVisibleChannel
  | ChatPresenceShadowChannel;

/**
 * Stable actor classes that can project presence state into the chat layer.
 */
export type ChatPresenceActorKind =
  | 'PLAYER'
  | 'RIVAL'
  | 'HELPER'
  | 'SYSTEM'
  | 'DEAL_AGENT'
  | 'SPECTATOR_NPC'
  | 'FACTION_AGENT'
  | 'LIVEOPS_AGENT'
  | 'BOSS'
  | 'MODERATOR'
  | 'UNKNOWN';

/**
 * Broad authored intent behind a presence cue.
 */
export type ChatPresenceIntent =
  | 'PRESSURE'
  | 'THREAT'
  | 'RESCUE'
  | 'NEGOTIATION'
  | 'STALL'
  | 'LURK'
  | 'SURVEILLANCE'
  | 'SPECTACLE'
  | 'BAIT'
  | 'COUNTERPLAY'
  | 'REASSURANCE'
  | 'DECEPTION'
  | 'WITNESS'
  | 'CEREMONY'
  | 'UNKNOWN';

/**
 * High-level presence posture before any concrete message is emitted.
 */
export type ChatPresencePosture =
  | 'ABSENT'
  | 'IDLE'
  | 'WATCHING'
  | 'READING'
  | 'TYPING'
  | 'HESITATING'
  | 'LURKING'
  | 'SUPPRESSED'
  | 'QUEUED'
  | 'REVEAL_PENDING'
  | 'DELIVERED'
  | 'EXPIRED';

/**
 * Typing behavior styles that shape how presence feels before a message lands.
 */
export type ChatPresenceTypingBehavior =
  | 'NONE'
  | 'INSTANT'
  | 'SHORT_BURST'
  | 'STEADY'
  | 'STUTTER'
  | 'LONG_FORM'
  | 'FEINT'
  | 'BAIT_PAUSE'
  | 'AGGRESSIVE_STOP_START'
  | 'RESCUE_GENTLE'
  | 'NEGOTIATION_MEASURED'
  | 'LIVEOPS_BROADCAST';

/**
 * Read behavior styles used to create pressure after a message is seen.
 */
export type ChatPresenceReadBehavior =
  | 'NEVER_MARK_READ'
  | 'IMMEDIATE'
  | 'DELAYED'
  | 'STRATEGIC_DELAY'
  | 'AFTER_PRESSURE_SPIKE'
  | 'AFTER_COUNTERPLAY_WINDOW'
  | 'AFTER_HELPER_INTERVENTION'
  | 'AFTER_OFFER_REVIEW'
  | 'SHADOW_ONLY';

/**
 * Lurk styles determine how long an entity remains felt before speaking.
 */
export type ChatPresenceLurkBehavior =
  | 'NONE'
  | 'EDGE_PEEK'
  | 'SHORT_LURK'
  | 'HEAVY_LURK'
  | 'PREDATORY_LURK'
  | 'RESCUE_WATCH'
  | 'CROWD_SWELL'
  | 'FACTION_GATHER'
  | 'LIVEOPS_SHADOW';

/**
 * Emotional intensity band for presence timing and style.
 */
export type ChatPresenceIntensityBand =
  | 'MUTED'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'SEVERE'
  | 'OVERWHELMING';

/**
 * Relative latency characterization without hardcoding a specific scheduler.
 */
export type ChatPresenceLatencyBand =
  | 'IMMEDIATE'
  | 'FAST'
  | 'MEASURED'
  | 'SLOW'
  | 'DELIBERATE'
  | 'CINEMATIC'
  | 'UNKNOWN';

/**
 * Channel pressure profile for presence behavior.
 */
export type ChatPresencePressureMode =
  | 'NEUTRAL'
  | 'SOCIAL'
  | 'PREDATORY'
  | 'RESCUE'
  | 'CROWD'
  | 'RIVALRY'
  | 'DEAL_ROOM'
  | 'LIVEOPS'
  | 'POST_RUN';

/**
 * Why an otherwise valid presence cue may be suppressed or deferred.
 */
export type ChatPresenceSuppressionReason =
  | 'NONE'
  | 'RATE_LIMIT'
  | 'LOW_SALIENCE'
  | 'SCENE_CONFLICT'
  | 'HIGHER_PRIORITY_ACTOR'
  | 'RESCUE_PROTECTED_WINDOW'
  | 'SHADOW_ONLY'
  | 'SILENCE_SELECTED'
  | 'CHANNEL_HIDDEN'
  | 'PLAYER_MUTED'
  | 'COOLDOWN'
  | 'RUN_ENDED'
  | 'STALE_EVENT'
  | 'MODERATION_FILTER'
  | 'UNKNOWN';

/**
 * Reveal mechanism to expose hidden or queued presence state.
 */
export type ChatPresenceRevealMode =
  | 'NONE'
  | 'AUTO'
  | 'EVENT_TRIGGERED'
  | 'PRESSURE_TRIGGERED'
  | 'COUNTERPLAY_TRIGGERED'
  | 'NEGOTIATION_TRIGGERED'
  | 'HELPER_TRIGGERED'
  | 'POST_RUN_TRIGGERED'
  | 'MANUAL'
  | 'LIVEOPS_TRIGGERED';

/**
 * Why a presence cue exists right now.
 */
export type ChatPresenceTrigger =
  | 'RUN_START'
  | 'RUN_END'
  | 'PRESSURE_CHANGE'
  | 'SHIELD_BREAK'
  | 'BOT_ATTACK'
  | 'TIME_WARNING'
  | 'BANKRUPTCY_WARNING'
  | 'SOVEREIGNTY_PUSH'
  | 'COMEBACK'
  | 'COLLAPSE'
  | 'NEGOTIATION_OFFER'
  | 'NEGOTIATION_STALL'
  | 'RESCUE_RISK'
  | 'FACTION_EVENT'
  | 'WORLD_EVENT'
  | 'LEGEND_MOMENT'
  | 'PLAYER_MESSAGE'
  | 'CHANNEL_SWITCH'
  | 'READ_RECEIPT'
  | 'TYPING_TIMEOUT'
  | 'MANUAL';

/**
 * Generic identifiers.
 */
export type ChatPresenceStyleId = string;
export type ChatPresenceCueId = string;
export type ChatPresenceProfileId = string;
export type ChatPresenceActorId = string;
export type ChatPresenceSceneId = string;
export type ChatPresenceMessageId = string;
export type ChatPresenceReplayMomentId = string;

/**
 * Millisecond range used across presence timing.
 */
export interface ChatPresenceLatencyWindow {
  readonly minMs: number;
  readonly maxMs: number;
  readonly jitterMs?: number;
}

/**
 * Distribution hints for schedulers and simulators.
 */
export interface ChatPresenceTimingDistribution {
  readonly bias?: 'EARLY' | 'CENTER' | 'LATE' | 'SPIKE' | 'WAVE';
  readonly latencyBand?: ChatPresenceLatencyBand;
  readonly preferredWindow: ChatPresenceLatencyWindow;
  readonly fallbackWindow?: ChatPresenceLatencyWindow;
}

/**
 * Typing phase controls.
 */
export interface ChatPresenceTypingPhase {
  readonly behavior: ChatPresenceTypingBehavior;
  readonly activeWindow: ChatPresenceLatencyWindow;
  readonly burstCount?: number;
  readonly interruptionChance?: number;
  readonly cancelChance?: number;
  readonly canFeint?: boolean;
  readonly canRestart?: boolean;
}

/**
 * Read timing contract.
 */
export interface ChatPresenceReadPolicy {
  readonly behavior: ChatPresenceReadBehavior;
  readonly markReadWindow?: ChatPresenceLatencyWindow;
  readonly holdUnreadWindow?: ChatPresenceLatencyWindow;
  readonly pressureEscalationOnUnread?: boolean;
  readonly maySuppressReadReceipt?: boolean;
}

/**
 * Lurk timing contract.
 */
export interface ChatPresenceLurkPolicy {
  readonly behavior: ChatPresenceLurkBehavior;
  readonly lurkWindow?: ChatPresenceLatencyWindow;
  readonly visibleHintChance?: number;
  readonly shadowAnchorOnly?: boolean;
  readonly mayEscalateToTyping?: boolean;
}

/**
 * Interruption behavior for actors that cut into other presence lines.
 */
export interface ChatPresenceInterruptionProfile {
  readonly mayInterrupt: boolean;
  readonly basePriority: number;
  readonly escalationPriority?: number;
  readonly cooldownMs?: number;
  readonly preferredTriggers?: readonly ChatPresenceTrigger[];
  readonly blockedByPostures?: readonly ChatPresencePosture[];
}

/**
 * How an actor prefers to appear in each channel family.
 */
export interface ChatPresenceChannelProfile {
  readonly channel: ChatPresenceAddressableChannel;
  readonly pressureMode: ChatPresencePressureMode;
  readonly typing?: ChatPresenceTypingPhase;
  readonly read?: ChatPresenceReadPolicy;
  readonly lurk?: ChatPresenceLurkPolicy;
  readonly revealMode?: ChatPresenceRevealMode;
  readonly allowVisibleTyping?: boolean;
  readonly allowVisibleReading?: boolean;
  readonly allowShadowAnchors?: boolean;
  readonly maxConcurrentCues?: number;
}

/**
 * Main authored presence style for an NPC, helper, rival, faction, or system
 * voice.
 */
export interface ChatPresenceStyle {
  readonly id: ChatPresenceStyleId;
  readonly actorId: ChatPresenceActorId;
  readonly actorKind: ChatPresenceActorKind;
  readonly label: string;
  readonly description?: string;
  readonly postureBias: ChatPresencePosture;
  readonly intentBias: ChatPresenceIntent;
  readonly intensityBand: ChatPresenceIntensityBand;
  readonly defaultLatencyBand: ChatPresenceLatencyBand;
  readonly interruption: ChatPresenceInterruptionProfile;
  readonly visibleChannels: readonly ChatPresenceChannelProfile[];
  readonly shadowChannels?: readonly ChatPresenceChannelProfile[];
  readonly firstResponseWindow?: ChatPresenceLatencyWindow;
  readonly followUpWindow?: ChatPresenceLatencyWindow;
  readonly silencePreference?: number;
  readonly unreadPressurePreference?: number;
  readonly delayedRevealPreference?: number;
  readonly instantStrikePreference?: number;
  readonly rescueDeferencePreference?: number;
  readonly negotiationPatiencePreference?: number;
  readonly crowdTheaterPreference?: number;
  readonly supportsReadReceipts?: boolean;
  readonly supportsTypingTheater?: boolean;
  readonly supportsLurkTheater?: boolean;
  readonly supportsShadowPresence?: boolean;
  readonly tags?: readonly string[];
}

/**
 * Mutable pressure signals that allow the authority lane to select a style or
 * adapt a style snapshot.
 */
export interface ChatPresenceSignalInput {
  readonly actorId: ChatPresenceActorId;
  readonly actorKind: ChatPresenceActorKind;
  readonly trigger: ChatPresenceTrigger;
  readonly intent?: ChatPresenceIntent;
  readonly channel: ChatPresenceAddressableChannel;
  readonly runId?: string;
  readonly playerId?: string;
  readonly sceneId?: ChatPresenceSceneId;
  readonly messageId?: ChatPresenceMessageId;
  readonly pressureScore?: number;
  readonly tensionScore?: number;
  readonly urgencyScore?: number;
  readonly embarrassmentScore?: number;
  readonly rescueRiskScore?: number;
  readonly rivalryScore?: number;
  readonly crowdHeatScore?: number;
  readonly negotiationRiskScore?: number;
  readonly worldEventWeight?: number;
  readonly helperProtectionWindowActive?: boolean;
  readonly legendCandidate?: boolean;
  readonly counterplayWindowOpen?: boolean;
  readonly sourceEventType?: string;
  readonly sourceEventId?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Presence cue created by an authority lane before visible chat text is emitted.
 */
export interface ChatPresenceCue {
  readonly id: ChatPresenceCueId;
  readonly actorId: ChatPresenceActorId;
  readonly actorKind: ChatPresenceActorKind;
  readonly styleId?: ChatPresenceStyleId;
  readonly channel: ChatPresenceAddressableChannel;
  readonly trigger: ChatPresenceTrigger;
  readonly intent: ChatPresenceIntent;
  readonly posture: ChatPresencePosture;
  readonly pressureMode?: ChatPresencePressureMode;
  readonly intensityBand?: ChatPresenceIntensityBand;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly visibleAt?: string;
  readonly revealAt?: string;
  readonly readAt?: string;
  readonly deliveredAt?: string;
  readonly suppressionReason?: ChatPresenceSuppressionReason;
  readonly revealMode?: ChatPresenceRevealMode;
  readonly priority?: number;
  readonly shadowOnly?: boolean;
  readonly queueRank?: number;
  readonly relatedMessageId?: ChatPresenceMessageId;
  readonly relatedSceneId?: ChatPresenceSceneId;
  readonly relatedReplayMomentId?: ChatPresenceReplayMomentId;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Shadow marker stored for later reveal or memory callback.
 */
export interface ChatPresenceShadowMarker {
  readonly cueId: ChatPresenceCueId;
  readonly channel: ChatPresenceShadowChannel;
  readonly actorId: ChatPresenceActorId;
  readonly intent: ChatPresenceIntent;
  readonly trigger: ChatPresenceTrigger;
  readonly createdAt: string;
  readonly revealMode: ChatPresenceRevealMode;
  readonly anchorWeight?: number;
  readonly latentHostilityDelta?: number;
  readonly rescueProtectionDelta?: number;
  readonly crowdHeatDelta?: number;
  readonly callbackAnchorKey?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Runtime snapshot of a single actor's presence state.
 */
export interface ChatPresenceStateSnapshot {
  readonly actorId: ChatPresenceActorId;
  readonly actorKind: ChatPresenceActorKind;
  readonly activeChannel: ChatPresenceAddressableChannel;
  readonly posture: ChatPresencePosture;
  readonly styleId?: ChatPresenceStyleId;
  readonly currentCueId?: ChatPresenceCueId;
  readonly visibleTyping: boolean;
  readonly visibleReading: boolean;
  readonly unreadVisibleCount?: number;
  readonly queuedCueCount?: number;
  readonly shadowCueCount?: number;
  readonly suppressionReason?: ChatPresenceSuppressionReason;
  readonly lastReadAt?: string;
  readonly lastTypedAt?: string;
  readonly lastVisibleAt?: string;
  readonly lastRevealAt?: string;
  readonly updatedAt: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Roster entry for UI synchronization.
 */
export interface ChatPresenceRosterEntry {
  readonly actorId: ChatPresenceActorId;
  readonly actorKind: ChatPresenceActorKind;
  readonly displayName: string;
  readonly channel: ChatPresenceAddressableChannel;
  readonly posture: ChatPresencePosture;
  readonly visibleTyping: boolean;
  readonly visibleReading: boolean;
  readonly hasShadowActivity?: boolean;
  readonly intensityBand?: ChatPresenceIntensityBand;
  readonly updatedAt: string;
  readonly expiresAt?: string;
}

/**
 * Envelope emitted across transports to synchronize presence state.
 */
export interface ChatPresenceEnvelope {
  readonly type:
    | 'chat.presence.snapshot'
    | 'chat.presence.cue.created'
    | 'chat.presence.cue.updated'
    | 'chat.presence.cue.revealed'
    | 'chat.presence.cue.expired'
    | 'chat.presence.read'
    | 'chat.presence.typing'
    | 'chat.presence.shadow.anchor'
    | 'chat.presence.roster';
  readonly channel: ChatPresenceAddressableChannel;
  readonly actorId: ChatPresenceActorId;
  readonly actorKind: ChatPresenceActorKind;
  readonly cueId?: ChatPresenceCueId;
  readonly occurredAt: string;
  readonly state?: ChatPresenceStateSnapshot;
  readonly cue?: ChatPresenceCue;
  readonly roster?: readonly ChatPresenceRosterEntry[];
  readonly shadow?: ChatPresenceShadowMarker;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Command surface for presence authority lanes.
 */
export interface ChatPresenceCommand {
  readonly action:
    | 'QUEUE_CUE'
    | 'REVEAL_CUE'
    | 'SUPPRESS_CUE'
    | 'EXPIRE_CUE'
    | 'MARK_READ'
    | 'CLEAR_READ'
    | 'START_TYPING'
    | 'STOP_TYPING'
    | 'SET_POSTURE'
    | 'SYNC_ROSTER'
    | 'ANCHOR_SHADOW'
    | 'CLEAR_CHANNEL';
  readonly actorId?: ChatPresenceActorId;
  readonly channel?: ChatPresenceAddressableChannel;
  readonly cue?: ChatPresenceCue;
  readonly cueId?: ChatPresenceCueId;
  readonly posture?: ChatPresencePosture;
  readonly revealMode?: ChatPresenceRevealMode;
  readonly suppressionReason?: ChatPresenceSuppressionReason;
  readonly roster?: readonly ChatPresenceRosterEntry[];
  readonly shadow?: ChatPresenceShadowMarker;
  readonly issuedAt: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Analytics-friendly event shape for presence theater.
 */
export interface ChatPresenceTelemetryEvent {
  readonly eventName:
    | 'presence_queued'
    | 'presence_revealed'
    | 'presence_suppressed'
    | 'presence_expired'
    | 'typing_started'
    | 'typing_stopped'
    | 'read_marked'
    | 'shadow_anchor_created'
    | 'roster_synced';
  readonly actorId: ChatPresenceActorId;
  readonly actorKind: ChatPresenceActorKind;
  readonly channel: ChatPresenceAddressableChannel;
  readonly cueId?: ChatPresenceCueId;
  readonly trigger?: ChatPresenceTrigger;
  readonly intent?: ChatPresenceIntent;
  readonly posture?: ChatPresencePosture;
  readonly occurredAt: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Utilities for building stable defaults across engines.
 */
export const CHAT_PRESENCE_VISIBLE_CHANNELS: readonly ChatPresenceVisibleChannel[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'DIRECT',
  'SPECTATOR',
] as const;

export const CHAT_PRESENCE_SHADOW_CHANNELS: readonly ChatPresenceShadowChannel[] = [
  'SYSTEM_SHADOW',
  'NPC_SHADOW',
  'RIVALRY_SHADOW',
  'RESCUE_SHADOW',
  'LIVEOPS_SHADOW',
] as const;

export const CHAT_PRESENCE_DEFAULT_TYPING_WINDOW: Readonly<ChatPresenceLatencyWindow> = {
  minMs: 450,
  maxMs: 1800,
  jitterMs: 140,
};

export const CHAT_PRESENCE_DEFAULT_READ_WINDOW: Readonly<ChatPresenceLatencyWindow> = {
  minMs: 250,
  maxMs: 2200,
  jitterMs: 110,
};

export const CHAT_PRESENCE_DEFAULT_LURK_WINDOW: Readonly<ChatPresenceLatencyWindow> = {
  minMs: 900,
  maxMs: 4200,
  jitterMs: 220,
};

/**
 * Type guards.
 */
export function isChatPresenceShadowChannel(
  channel: ChatPresenceAddressableChannel,
): channel is ChatPresenceShadowChannel {
  return (CHAT_PRESENCE_SHADOW_CHANNELS as readonly string[]).includes(channel);
}

export function isChatPresenceVisibleChannel(
  channel: ChatPresenceAddressableChannel,
): channel is ChatPresenceVisibleChannel {
  return (CHAT_PRESENCE_VISIBLE_CHANNELS as readonly string[]).includes(channel);
}

/**
 * Lightweight constructor helpers so callers can normalize partial data before
 * sending it to reducers, stores, sockets, or authoritative planners.
 */
export function createChatPresenceCue(
  input: Omit<ChatPresenceCue, 'priority'> & { priority?: number },
): ChatPresenceCue {
  return {
    priority: input.priority ?? 0,
    ...input,
  };
}

export function createChatPresenceStateSnapshot(
  input: ChatPresenceStateSnapshot,
): ChatPresenceStateSnapshot {
  return {
    ...input,
  };
}

export function createChatPresenceStyle(
  input: ChatPresenceStyle,
): ChatPresenceStyle {
  return {
    supportsReadReceipts: input.supportsReadReceipts ?? true,
    supportsTypingTheater: input.supportsTypingTheater ?? true,
    supportsLurkTheater: input.supportsLurkTheater ?? true,
    supportsShadowPresence: input.supportsShadowPresence ?? true,
    ...input,
  };
}

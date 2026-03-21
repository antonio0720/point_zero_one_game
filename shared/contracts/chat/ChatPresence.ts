
/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT PRESENCE CONTRACTS
 * FILE: shared/contracts/chat/ChatPresence.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared presence contract surface for the unified chat system.
 *
 * This file owns the transport-safe contracts for:
 *   - room and channel occupancy
 *   - actor live state
 *   - typing theater
 *   - read receipts and read delays
 *   - cursor presence
 *   - presence roster diffs
 *   - subscription and suppression policy hints
 *   - presence continuity across mounts and mode scopes
 *
 * Design laws
 * -----------
 * 1. Presence is not a cosmetic afterthought. It is a first-class simulation
 *    signal tied to room truth, crowd heat, rescue timing, and hater staging.
 * 2. Transport may fan out presence, but backend authority must be representable
 *    in the contract.
 * 3. Shadow presence must remain first-class because the system explicitly uses
 *    invisible channels and deferred reveal mechanics.
 * 4. Presence contracts must support both human actors and simulated NPC timing
 *    without making the client the authority.
 * 5. Read receipts, typing states, and cursor hints must be explicit so the UI
 *    can remain thin while the backend retains enforcement power.
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
  type Optional,
  type Score01,
  type UnixMs,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_MOUNT_PRESETS,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatCursorId,
  type ChatMessageId,
  type ChatNpcId,
  type ChatRange,
  type ChatRequestId,
  type ChatSessionId,
  type ChatTypingToken,
  type ChatUserId,
  CHAT_ACTOR_KINDS,
} from './ChatChannels';

import {
  type ChatAuthority,
  type ChatCursorSnapshot,
  type ChatPresenceSnapshot,
  type ChatPresenceState,
  type ChatSenderIdentity,
  type ChatTypingSnapshot,
  type ChatTypingState,
  CHAT_AUTHORITIES,
  CHAT_PRESENCE_STATES,
  CHAT_TYPING_STATES,
} from './ChatEvents';

// ============================================================================
// MARK: Branded identifiers local to presence contracts
// ============================================================================

export type ChatPresenceId = Brand<string, 'ChatPresenceId'>;
export type ChatRosterId = Brand<string, 'ChatRosterId'>;
export type ChatPresenceFrameId = Brand<string, 'ChatPresenceFrameId'>;
export type ChatRosterVersion = Brand<number, 'ChatRosterVersion'>;
export type ChatReadReceiptId = Brand<string, 'ChatReadReceiptId'>;
export type ChatCursorPresenceId = Brand<string, 'ChatCursorPresenceId'>;
export type ChatPresenceSubscriptionId = Brand<string, 'ChatPresenceSubscriptionId'>;
export type ChatPresenceStyleId = Brand<string, 'ChatPresenceStyleId'>;
export type ChatReadPolicyId = Brand<string, 'ChatReadPolicyId'>;

// ============================================================================
// MARK: Presence vocabularies
// ============================================================================

export const CHAT_PRESENCE_VISIBILITY_CLASSES = [
  'VISIBLE',
  'SHADOW',
  'AUTHOR_ONLY',
  'SYSTEM_ONLY',
] as const;

export type ChatPresenceVisibilityClass =
  (typeof CHAT_PRESENCE_VISIBILITY_CLASSES)[number];

export const CHAT_PRESENCE_STYLE_KINDS = [
  'HUMAN',
  'NPC_DIRECT',
  'NPC_LURK',
  'NPC_AMBIENT',
  'HATER_STALK',
  'HELPER_WATCH',
  'SYSTEM_BANNER',
  'LIVEOPS_PULSE',
] as const;

export type ChatPresenceStyleKind =
  (typeof CHAT_PRESENCE_STYLE_KINDS)[number];

export const CHAT_TYPING_THEATER_KINDS = [
  'NONE',
  'INSTANT',
  'HESITANT',
  'BURSTY',
  'WEAPONIZED_DELAY',
  'HELPER_SOFT',
  'AMBIENT_DRIFT',
] as const;

export type ChatTypingTheaterKind =
  (typeof CHAT_TYPING_THEATER_KINDS)[number];

export const CHAT_READ_DELAY_POLICY_KINDS = [
  'INSTANT',
  'SHORT_DELAY',
  'THINKING_DELAY',
  'NEGOTIATION_PRESSURE',
  'HATER_STARE',
  'HELPER_SOFTEN',
  'NEVER',
] as const;

export type ChatReadDelayPolicyKind =
  (typeof CHAT_READ_DELAY_POLICY_KINDS)[number];

export const CHAT_RECEIPT_VISIBILITY_MODES = [
  'PUBLIC',
  'SENDER_ONLY',
  'HELPER_ONLY',
  'SYSTEM_ONLY',
  'OFF',
] as const;

export type ChatReceiptVisibilityMode =
  (typeof CHAT_RECEIPT_VISIBILITY_MODES)[number];

export const CHAT_CURSOR_INTENTS = [
  'IDLE',
  'COMPOSING',
  'REVISING',
  'COMMANDING',
  'NEGOTIATING',
  'HESITATING',
] as const;

export type ChatCursorIntent = (typeof CHAT_CURSOR_INTENTS)[number];

export const CHAT_OCCUPANCY_BANDS = [
  'EMPTY',
  'SOLO',
  'SMALL',
  'MEDIUM',
  'LARGE',
  'SWARM',
] as const;

export type ChatOccupancyBand = (typeof CHAT_OCCUPANCY_BANDS)[number];

export const CHAT_ROOM_AURAS = [
  'CALM',
  'WATCHFUL',
  'TENSE',
  'HOSTILE',
  'PREDATORY',
  'CEREMONIAL',
] as const;

export type ChatRoomAura = (typeof CHAT_ROOM_AURAS)[number];

export const CHAT_PRESENCE_ROLES = [
  'PLAYER',
  'PARTICIPANT',
  'SPECTATOR',
  'NPC',
  'HELPER',
  'HATER',
  'SYSTEM',
  'LIVEOPS',
] as const;

export type ChatPresenceRole = (typeof CHAT_PRESENCE_ROLES)[number];

export const CHAT_SUPPRESSION_REASONS = [
  'NONE',
  'POLICY',
  'SHADOW_ONLY',
  'RATE_LIMIT',
  'ROOM_LOCK',
  'OFFLINE',
  'INVISIBLE',
] as const;

export type ChatPresenceSuppressionReason =
  (typeof CHAT_SUPPRESSION_REASONS)[number];

// ============================================================================
// MARK: Style, read, typing, and cursor profiles
// ============================================================================

export interface ChatPresenceAuthorityStamp {
  readonly authority: ChatAuthority;
  readonly requestId?: ChatRequestId;
  readonly authoritativeAt?: UnixMs;
}

export interface ChatPresenceStyleProfile {
  readonly styleId: ChatPresenceStyleId;
  readonly styleKind: ChatPresenceStyleKind;
  readonly typingTheater: ChatTypingTheaterKind;
  readonly readDelayPolicy: ChatReadDelayPolicyKind;
  readonly presenceVisibilityClass: ChatPresenceVisibilityClass;
  readonly typicalLatencyMs: number;
  readonly typingBurstMinMs: number;
  readonly typingBurstMaxMs: number;
  readonly pauseMinMs: number;
  readonly pauseMaxMs: number;
  readonly simulated: boolean;
  readonly notes?: string;
}

export interface ChatReadReceiptPolicy {
  readonly policyId: ChatReadPolicyId;
  readonly visibilityMode: ChatReceiptVisibilityMode;
  readonly allowReadReceipts: boolean;
  readonly allowSeenReceipts: boolean;
  readonly minDelayMs: number;
  readonly maxDelayMs: number;
  readonly playerVisible: boolean;
}

export interface ChatTypingBurstSegment {
  readonly segmentIndex: number;
  readonly typingMs: number;
  readonly pauseAfterMs: number;
  readonly previewLengthHint?: number;
}

export interface ChatTypingTheaterPlan {
  readonly kind: ChatTypingTheaterKind;
  readonly token?: ChatTypingToken;
  readonly startedAt?: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly segments: readonly ChatTypingBurstSegment[];
  readonly simulatedByStyleId?: ChatPresenceStyleId;
  readonly playerVisible: boolean;
}

export interface ChatCursorIntentSnapshot {
  readonly cursorId: ChatCursorId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly intent: ChatCursorIntent;
  readonly composerLength?: number;
  readonly caretIndex?: number;
  readonly selection?: ChatRange;
  readonly draftPreview?: string;
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: Presence identities and roster entries
// ============================================================================

export interface ChatPresenceIdentity {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly userId?: ChatUserId;
  readonly sessionId?: ChatSessionId;
  readonly npcId?: ChatNpcId;
  readonly role: ChatPresenceRole;
  readonly senderIdentity?: ChatSenderIdentity;
}

export interface ChatPresenceRuntimeContext {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly modeScope?: ChatModeScope;
  readonly mountTarget?: ChatMountTarget;
  readonly channelDescriptor: ChatChannelDescriptor;
  readonly mountPreset?: ChatMountPreset;
}

export interface ChatPresenceEntry {
  readonly presenceId: ChatPresenceId;
  readonly identity: ChatPresenceIdentity;
  readonly runtime: ChatPresenceRuntimeContext;
  readonly authorityStamp: ChatPresenceAuthorityStamp;
  readonly presenceState: ChatPresenceState;
  readonly lastActiveAt: UnixMs;
  readonly lastVisibleAt?: UnixMs;
  readonly visibilityClass: ChatPresenceVisibilityClass;
  readonly styleProfile: ChatPresenceStyleProfile;
  readonly readPolicy: ChatReadReceiptPolicy;
  readonly typingPlan?: ChatTypingTheaterPlan;
  readonly cursor?: ChatCursorIntentSnapshot;
  readonly suppressionReason: ChatPresenceSuppressionReason;
  readonly latencyMs?: number;
  readonly unreadCount?: number;
  readonly playerVisible: boolean;
  readonly customData?: JsonObject;
}

export interface ChatPresenceRoster {
  readonly rosterId: ChatRosterId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly version: ChatRosterVersion;
  readonly generatedAt: UnixMs;
  readonly entries: readonly ChatPresenceEntry[];
}

// ============================================================================
// MARK: Occupancy and room/channel aggregates
// ============================================================================

export interface ChatOccupancySnapshot {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly occupancyBand: ChatOccupancyBand;
  readonly participantCount: number;
  readonly visibleCount: number;
  readonly helperCount: number;
  readonly haterCount: number;
  readonly npcCount: number;
  readonly spectatorCount: number;
  readonly aura: ChatRoomAura;
  readonly crowdHeat01?: Score01;
  readonly updatedAt: UnixMs;
}

export interface ChatChannelPresenceStateAggregate {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly channelFamily: ChatChannelFamily;
  readonly roster: ChatPresenceRoster;
  readonly occupancy: ChatOccupancySnapshot;
  readonly typingActors: readonly ChatPresenceEntry[];
  readonly readingActors: readonly ChatPresenceEntry[];
  readonly lurkingActors: readonly ChatPresenceEntry[];
}

export interface ChatRoomPresenceStateAggregate {
  readonly roomId: ChatRoomId;
  readonly generatedAt: UnixMs;
  readonly channels: readonly ChatChannelPresenceStateAggregate[];
  readonly totalVisibleActors: number;
  readonly totalParticipants: number;
  readonly dominantAura: ChatRoomAura;
}

// ============================================================================
// MARK: Read receipts, visibility, and read delay
// ============================================================================

export interface ChatReadReceiptRecord {
  readonly receiptId: ChatReadReceiptId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messageId: ChatMessageId;
  readonly readerId: string;
  readonly readerKind: ChatActorKind;
  readonly visibleToSender: boolean;
  readonly seenAt?: UnixMs;
  readonly readAt?: UnixMs;
  readonly delayedByPolicy: ChatReadDelayPolicyKind;
}

export interface ChatVisibilityGate {
  readonly visibilityClass: ChatPresenceVisibilityClass;
  readonly playerVisible: boolean;
  readonly renderTyping: boolean;
  readonly renderReading: boolean;
  readonly renderCursor: boolean;
  readonly allowReadReceipts: boolean;
}

// ============================================================================
// MARK: Subscription, transport, and diff contracts
// ============================================================================

export interface ChatPresenceSubscription {
  readonly subscriptionId: ChatPresenceSubscriptionId;
  readonly roomId: ChatRoomId;
  readonly channelIds: readonly ChatChannelId[];
  readonly mountTarget?: ChatMountTarget;
  readonly includeShadow: boolean;
  readonly includeTyping: boolean;
  readonly includeCursors: boolean;
  readonly includeReadReceipts: boolean;
  readonly includeOccupancy: boolean;
}

export interface ChatPresenceDiff {
  readonly frameId: ChatPresenceFrameId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly rosterVersion: ChatRosterVersion;
  readonly generatedAt: UnixMs;
  readonly added: readonly ChatPresenceEntry[];
  readonly updated: readonly ChatPresenceEntry[];
  readonly removedActorIds: readonly string[];
  readonly occupancy?: ChatOccupancySnapshot;
}

export interface ChatPresenceTransportEnvelope {
  readonly envelopeType: 'CHAT_PRESENCE';
  readonly schemaVersion: typeof CHAT_CONTRACT_VERSION;
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly frameId: ChatPresenceFrameId;
  readonly roomState: ChatRoomPresenceStateAggregate;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

export const DEFAULT_HUMAN_PRESENCE_STYLE: ChatPresenceStyleProfile = Object.freeze({
  styleId: 'presence-style-human' as ChatPresenceStyleId,
  styleKind: 'HUMAN',
  typingTheater: 'INSTANT',
  readDelayPolicy: 'SHORT_DELAY',
  presenceVisibilityClass: 'VISIBLE',
  typicalLatencyMs: 80,
  typingBurstMinMs: 400,
  typingBurstMaxMs: 2000,
  pauseMinMs: 150,
  pauseMaxMs: 900,
  simulated: false,
});

export const DEFAULT_NPC_LURK_STYLE: ChatPresenceStyleProfile = Object.freeze({
  styleId: 'presence-style-npc-lurk' as ChatPresenceStyleId,
  styleKind: 'NPC_LURK',
  typingTheater: 'WEAPONIZED_DELAY',
  readDelayPolicy: 'HATER_STARE',
  presenceVisibilityClass: 'VISIBLE',
  typicalLatencyMs: 240,
  typingBurstMinMs: 1000,
  typingBurstMaxMs: 3500,
  pauseMinMs: 800,
  pauseMaxMs: 2200,
  simulated: true,
});

export const DEFAULT_HELPER_SOFT_STYLE: ChatPresenceStyleProfile = Object.freeze({
  styleId: 'presence-style-helper-soft' as ChatPresenceStyleId,
  styleKind: 'HELPER_WATCH',
  typingTheater: 'HELPER_SOFT',
  readDelayPolicy: 'HELPER_SOFTEN',
  presenceVisibilityClass: 'VISIBLE',
  typicalLatencyMs: 160,
  typingBurstMinMs: 600,
  typingBurstMaxMs: 2400,
  pauseMinMs: 250,
  pauseMaxMs: 1200,
  simulated: true,
});

export const DEFAULT_SHADOW_STYLE: ChatPresenceStyleProfile = Object.freeze({
  styleId: 'presence-style-shadow' as ChatPresenceStyleId,
  styleKind: 'SYSTEM_BANNER',
  typingTheater: 'NONE',
  readDelayPolicy: 'NEVER',
  presenceVisibilityClass: 'SHADOW',
  typicalLatencyMs: 0,
  typingBurstMinMs: 0,
  typingBurstMaxMs: 0,
  pauseMinMs: 0,
  pauseMaxMs: 0,
  simulated: true,
});

export const DEFAULT_PUBLIC_READ_POLICY: ChatReadReceiptPolicy = Object.freeze({
  policyId: 'read-policy-public' as ChatReadPolicyId,
  visibilityMode: 'PUBLIC',
  allowReadReceipts: true,
  allowSeenReceipts: true,
  minDelayMs: 250,
  maxDelayMs: 1800,
  playerVisible: true,
});

export const DEFAULT_NEGOTIATION_READ_POLICY: ChatReadReceiptPolicy = Object.freeze({
  policyId: 'read-policy-negotiation' as ChatReadPolicyId,
  visibilityMode: 'SENDER_ONLY',
  allowReadReceipts: true,
  allowSeenReceipts: true,
  minDelayMs: 900,
  maxDelayMs: 5000,
  playerVisible: true,
});

export const DEFAULT_SHADOW_READ_POLICY: ChatReadReceiptPolicy = Object.freeze({
  policyId: 'read-policy-shadow' as ChatReadPolicyId,
  visibilityMode: 'OFF',
  allowReadReceipts: false,
  allowSeenReceipts: false,
  minDelayMs: 0,
  maxDelayMs: 0,
  playerVisible: false,
});

// ============================================================================
// MARK: Constructors
// ============================================================================

export function deriveOccupancyBand(count: number): ChatOccupancyBand {
  if (count <= 0) {
    return 'EMPTY';
  }
  if (count === 1) {
    return 'SOLO';
  }
  if (count <= 4) {
    return 'SMALL';
  }
  if (count <= 8) {
    return 'MEDIUM';
  }
  if (count <= 16) {
    return 'LARGE';
  }
  return 'SWARM';
}

export function deriveAuraFromChannelFamily(
  family: ChatChannelFamily,
): ChatRoomAura {
  switch (family) {
    case 'NEGOTIATION':
      return 'PREDATORY';
    case 'PRIVATE':
      return 'WATCHFUL';
    case 'PRE_RUN':
      return 'CALM';
    case 'SHADOW':
      return 'TENSE';
    default:
      return 'HOSTILE';
  }
}

export function createPresenceRuntimeContext(args: {
  roomId: ChatRoomId;
  channelId: ChatChannelId;
  modeScope?: ChatModeScope;
  mountTarget?: ChatMountTarget;
}): ChatPresenceRuntimeContext {
  return {
    roomId: args.roomId,
    channelId: args.channelId,
    modeScope: args.modeScope,
    mountTarget: args.mountTarget,
    channelDescriptor: CHAT_CHANNEL_DESCRIPTORS[args.channelId],
    mountPreset: args.mountTarget
      ? CHAT_MOUNT_PRESETS[args.mountTarget]
      : undefined,
  };
}

export function deriveDefaultPresenceStyle(
  actorKind: ChatActorKind,
  channelId: ChatChannelId,
): ChatPresenceStyleProfile {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];
  if (descriptor.family === 'SHADOW') {
    return DEFAULT_SHADOW_STYLE;
  }
  switch (actorKind) {
    case 'HELPER':
      return DEFAULT_HELPER_SOFT_STYLE;
    case 'NPC':
    case 'HATER':
      return DEFAULT_NPC_LURK_STYLE;
    default:
      return DEFAULT_HUMAN_PRESENCE_STYLE;
  }
}

export function deriveDefaultReadPolicy(
  channelId: ChatChannelId,
): ChatReadReceiptPolicy {
  switch (channelId) {
    case 'DEAL_ROOM':
      return DEFAULT_NEGOTIATION_READ_POLICY;
    case 'SYSTEM_SHADOW':
    case 'NPC_SHADOW':
    case 'RIVALRY_SHADOW':
    case 'RESCUE_SHADOW':
    case 'LIVEOPS_SHADOW':
      return DEFAULT_SHADOW_READ_POLICY;
    default:
      return DEFAULT_PUBLIC_READ_POLICY;
  }
}

export function createPresenceEntry(args: {
  presenceId: ChatPresenceId;
  actorId: string;
  actorKind: ChatActorKind;
  roomId: ChatRoomId;
  channelId: ChatChannelId;
  role: ChatPresenceRole;
  state: ChatPresenceState;
  updatedAt: UnixMs;
  modeScope?: ChatModeScope;
  mountTarget?: ChatMountTarget;
  senderIdentity?: ChatSenderIdentity;
  sessionId?: ChatSessionId;
  userId?: ChatUserId;
  npcId?: ChatNpcId;
  authority?: ChatAuthority;
}): ChatPresenceEntry {
  const runtime = createPresenceRuntimeContext({
    roomId: args.roomId,
    channelId: args.channelId,
    modeScope: args.modeScope,
    mountTarget: args.mountTarget,
  });
  const styleProfile = deriveDefaultPresenceStyle(args.actorKind, args.channelId);
  const readPolicy = deriveDefaultReadPolicy(args.channelId);
  const playerVisible =
    styleProfile.presenceVisibilityClass === 'VISIBLE' &&
    runtime.channelDescriptor.visibleToPlayer;

  return {
    presenceId: args.presenceId,
    identity: {
      actorId: args.actorId,
      actorKind: args.actorKind,
      userId: args.userId,
      sessionId: args.sessionId,
      npcId: args.npcId,
      role: args.role,
      senderIdentity: args.senderIdentity,
    },
    runtime,
    authorityStamp: {
      authority: args.authority ?? 'BACKEND_AUTHORITATIVE',
      authoritativeAt: args.updatedAt,
    },
    presenceState: args.state,
    lastActiveAt: args.updatedAt,
    visibilityClass: styleProfile.presenceVisibilityClass,
    styleProfile,
    readPolicy,
    suppressionReason: 'NONE',
    playerVisible,
  };
}

export function createPresenceRoster(args: {
  rosterId: ChatRosterId;
  roomId: ChatRoomId;
  channelId: ChatChannelId;
  entries: readonly ChatPresenceEntry[];
  generatedAt: UnixMs;
  version?: ChatRosterVersion;
}): ChatPresenceRoster {
  return {
    rosterId: args.rosterId,
    roomId: args.roomId,
    channelId: args.channelId,
    version: args.version ?? 1 as ChatRosterVersion,
    generatedAt: args.generatedAt,
    entries: sortPresenceEntries(args.entries),
  };
}

export function createOccupancySnapshot(args: {
  roomId: ChatRoomId;
  channelId: ChatChannelId;
  entries: readonly ChatPresenceEntry[];
  updatedAt: UnixMs;
  crowdHeat01?: Score01;
}): ChatOccupancySnapshot {
  const visibleCount = args.entries.filter((entry) => entry.playerVisible).length;
  const helperCount = args.entries.filter((entry) => entry.identity.role === 'HELPER').length;
  const haterCount = args.entries.filter((entry) => entry.identity.role === 'HATER').length;
  const npcCount = args.entries.filter((entry) => entry.identity.role === 'NPC').length;
  const spectatorCount = args.entries.filter((entry) => entry.identity.role === 'SPECTATOR').length;
  const participantCount = args.entries.length;
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[args.channelId];
  return {
    roomId: args.roomId,
    channelId: args.channelId,
    occupancyBand: deriveOccupancyBand(participantCount),
    participantCount,
    visibleCount,
    helperCount,
    haterCount,
    npcCount,
    spectatorCount,
    aura: deriveAuraFromChannelFamily(descriptor.family),
    crowdHeat01: args.crowdHeat01,
    updatedAt: args.updatedAt,
  };
}

// ============================================================================
// MARK: Sorting, filtering, and render helpers
// ============================================================================

export function getPresencePriority(entry: ChatPresenceEntry): number {
  switch (entry.identity.role) {
    case 'HELPER':
      return 90;
    case 'HATER':
      return 80;
    case 'PLAYER':
      return 70;
    case 'NPC':
      return 60;
    case 'LIVEOPS':
      return 50;
    case 'SYSTEM':
      return 40;
    default:
      return 10;
  }
}

export function sortPresenceEntries(
  entries: readonly ChatPresenceEntry[],
): ChatPresenceEntry[] {
  return [...entries].sort((left, right) => {
    const priorityDelta = getPresencePriority(right) - getPresencePriority(left);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return Number(right.lastActiveAt) - Number(left.lastActiveAt);
  });
}

export function filterVisiblePresenceEntries(
  entries: readonly ChatPresenceEntry[],
  includeShadow: boolean = false,
): ChatPresenceEntry[] {
  return entries.filter((entry) => {
    if (entry.visibilityClass === 'SHADOW' && !includeShadow) {
      return false;
    }
    return entry.playerVisible || includeShadow;
  });
}

export function deriveTypingActors(
  entries: readonly ChatPresenceEntry[],
): ChatPresenceEntry[] {
  return entries.filter((entry) => !!entry.typingPlan && entry.playerVisible);
}

export function deriveReadingActors(
  entries: readonly ChatPresenceEntry[],
): ChatPresenceEntry[] {
  return entries.filter((entry) => entry.presenceState === 'READING');
}

export function deriveLurkingActors(
  entries: readonly ChatPresenceEntry[],
): ChatPresenceEntry[] {
  return entries.filter((entry) => entry.presenceState === 'LURKING');
}

export function buildChannelPresenceAggregate(args: {
  roster: ChatPresenceRoster;
  crowdHeat01?: Score01;
  updatedAt: UnixMs;
}): ChatChannelPresenceStateAggregate {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[args.roster.channelId];
  return {
    roomId: args.roster.roomId,
    channelId: args.roster.channelId,
    channelFamily: descriptor.family,
    roster: args.roster,
    occupancy: createOccupancySnapshot({
      roomId: args.roster.roomId,
      channelId: args.roster.channelId,
      entries: args.roster.entries,
      updatedAt: args.updatedAt,
      crowdHeat01: args.crowdHeat01,
    }),
    typingActors: deriveTypingActors(args.roster.entries),
    readingActors: deriveReadingActors(args.roster.entries),
    lurkingActors: deriveLurkingActors(args.roster.entries),
  };
}

export function buildRoomPresenceAggregate(args: {
  roomId: ChatRoomId;
  channels: readonly ChatChannelPresenceStateAggregate[];
  generatedAt: UnixMs;
}): ChatRoomPresenceStateAggregate {
  const totalVisibleActors = args.channels.reduce(
    (sum, channel) => sum + channel.occupancy.visibleCount,
    0,
  );
  const totalParticipants = args.channels.reduce(
    (sum, channel) => sum + channel.occupancy.participantCount,
    0,
  );

  const dominantAura = args.channels
    .map((channel) => channel.occupancy.aura)
    .sort()[0] ?? 'CALM';

  return {
    roomId: args.roomId,
    generatedAt: args.generatedAt,
    channels: [...args.channels],
    totalVisibleActors,
    totalParticipants,
    dominantAura,
  };
}

// ============================================================================
// MARK: Diffing and merge helpers
// ============================================================================

export function buildPresenceDiff(args: {
  frameId: ChatPresenceFrameId;
  previous?: ChatPresenceRoster;
  next: ChatPresenceRoster;
  generatedAt: UnixMs;
}): ChatPresenceDiff {
  const previousByActor = new Map(
    (args.previous?.entries ?? []).map((entry) => [entry.identity.actorId, entry]),
  );
  const nextByActor = new Map(
    args.next.entries.map((entry) => [entry.identity.actorId, entry]),
  );

  const added: ChatPresenceEntry[] = [];
  const updated: ChatPresenceEntry[] = [];
  const removedActorIds: string[] = [];

  for (const nextEntry of args.next.entries) {
    const prior = previousByActor.get(nextEntry.identity.actorId);
    if (!prior) {
      added.push(nextEntry);
      continue;
    }
    if (
      prior.presenceState !== nextEntry.presenceState ||
      prior.lastActiveAt !== nextEntry.lastActiveAt ||
      prior.suppressionReason !== nextEntry.suppressionReason
    ) {
      updated.push(nextEntry);
    }
  }

  for (const prior of args.previous?.entries ?? []) {
    if (!nextByActor.has(prior.identity.actorId)) {
      removedActorIds.push(prior.identity.actorId);
    }
  }

  return {
    frameId: args.frameId,
    roomId: args.next.roomId,
    channelId: args.next.channelId,
    rosterVersion: args.next.version,
    generatedAt: args.generatedAt,
    added,
    updated,
    removedActorIds,
    occupancy: createOccupancySnapshot({
      roomId: args.next.roomId,
      channelId: args.next.channelId,
      entries: args.next.entries,
      updatedAt: args.generatedAt,
    }),
  };
}

export function mergePresenceEntry(
  current: ChatPresenceEntry,
  patch: Partial<ChatPresenceEntry>,
): ChatPresenceEntry {
  return {
    ...current,
    ...patch,
    identity: patch.identity ? { ...current.identity, ...patch.identity } : current.identity,
    runtime: patch.runtime ? { ...current.runtime, ...patch.runtime } : current.runtime,
    authorityStamp: patch.authorityStamp
      ? { ...current.authorityStamp, ...patch.authorityStamp }
      : current.authorityStamp,
    styleProfile: patch.styleProfile
      ? { ...current.styleProfile, ...patch.styleProfile }
      : current.styleProfile,
    readPolicy: patch.readPolicy
      ? { ...current.readPolicy, ...patch.readPolicy }
      : current.readPolicy,
    cursor: patch.cursor ? { ...current.cursor, ...patch.cursor } : current.cursor,
  };
}

// ============================================================================
// MARK: Policy helpers
// ============================================================================

export function canRenderTyping(entry: ChatPresenceEntry): boolean {
  return (
    entry.playerVisible &&
    entry.visibilityClass === 'VISIBLE' &&
    entry.runtime.channelDescriptor.supportsTyping &&
    !!entry.typingPlan
  );
}

export function canRenderCursor(entry: ChatPresenceEntry): boolean {
  return (
    entry.playerVisible &&
    entry.visibilityClass === 'VISIBLE' &&
    entry.runtime.channelDescriptor.supportsComposer &&
    !!entry.cursor
  );
}

export function canEmitReadReceipt(entry: ChatPresenceEntry): boolean {
  return (
    entry.playerVisible &&
    entry.readPolicy.allowReadReceipts &&
    entry.runtime.channelDescriptor.supportsReadReceipts
  );
}

export function shouldSuppressPresence(entry: ChatPresenceEntry): boolean {
  return entry.suppressionReason !== 'NONE';
}

export function createVisibilityGate(
  entry: ChatPresenceEntry,
): ChatVisibilityGate {
  return {
    visibilityClass: entry.visibilityClass,
    playerVisible: entry.playerVisible,
    renderTyping: canRenderTyping(entry),
    renderReading:
      entry.playerVisible && entry.presenceState === 'READING',
    renderCursor: canRenderCursor(entry),
    allowReadReceipts: canEmitReadReceipt(entry),
  };
}

export function deriveTypingSnapshotFromEntry(
  entry: ChatPresenceEntry,
): Optional<ChatTypingSnapshot> {
  if (!entry.typingPlan) {
    return undefined;
  }
  return {
    actorId: entry.identity.actorId,
    actorKind: entry.identity.actorKind,
    channelId: entry.runtime.channelId,
    typingState:
      entry.typingPlan.kind === 'NONE' ? 'NOT_TYPING' : 'SIMULATED',
    startedAt: entry.typingPlan.startedAt,
    expiresAt: entry.typingPlan.expiresAt,
    token: entry.typingPlan.token,
    simulatedByPersona: entry.styleProfile.styleId,
  };
}

export function derivePresenceSnapshotFromEntry(
  entry: ChatPresenceEntry,
): ChatPresenceSnapshot {
  return {
    actorId: entry.identity.actorId,
    actorKind: entry.identity.actorKind,
    channelId: entry.runtime.channelId,
    presence: entry.presenceState,
    updatedAt: entry.lastActiveAt,
    isVisibleToPlayer: entry.playerVisible,
    latencyMs: entry.latencyMs,
  };
}

export function deriveCursorSnapshotFromEntry(
  entry: ChatPresenceEntry,
): Optional<ChatCursorSnapshot> {
  if (!entry.cursor || !entry.runtime.channelDescriptor.supportsComposer) {
    return undefined;
  }
  return {
    cursorId: entry.cursor.cursorId,
    actorId: entry.identity.actorId,
    actorKind: entry.identity.actorKind,
    channelId: entry.runtime.channelId as Extract<ChatChannelId, 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'LOBBY'>,
    roomId: entry.runtime.roomId,
    updatedAt: entry.cursor.updatedAt,
    caretIndex: entry.cursor.caretIndex,
    selection: entry.cursor.selection,
    composerLength: entry.cursor.composerLength,
    draftPreview: entry.cursor.draftPreview,
  };
}

// ============================================================================
// MARK: Validation
// ============================================================================

export interface ChatPresenceValidationIssue {
  readonly code:
    | 'MISSING_ID'
    | 'MISSING_RUNTIME'
    | 'INVALID_STATE'
    | 'INVALID_VISIBILITY'
    | 'INVALID_STYLE'
    | 'INVALID_READ_POLICY'
    | 'SHADOW_PLAYER_VISIBLE'
    | 'CURSOR_WITHOUT_COMPOSER'
    | 'TYPING_WITHOUT_CHANNEL_SUPPORT';
  readonly field: string;
  readonly detail: string;
}

export interface ChatPresenceValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ChatPresenceValidationIssue[];
}

export function validatePresenceEntry(
  entry: ChatPresenceEntry,
): ChatPresenceValidationResult {
  const issues: ChatPresenceValidationIssue[] = [];

  if (!entry.presenceId) {
    issues.push({
      code: 'MISSING_ID',
      field: 'presenceId',
      detail: 'Presence id is required.',
    });
  }

  if (!entry.runtime || !entry.runtime.roomId || !entry.runtime.channelId) {
    issues.push({
      code: 'MISSING_RUNTIME',
      field: 'runtime',
      detail: 'Room and channel runtime context are required.',
    });
  }

  if (!(CHAT_PRESENCE_STATES as readonly string[]).includes(entry.presenceState)) {
    issues.push({
      code: 'INVALID_STATE',
      field: 'presenceState',
      detail: `Invalid presence state: ${String(entry.presenceState)}`,
    });
  }

  if (
    !(CHAT_PRESENCE_VISIBILITY_CLASSES as readonly string[]).includes(
      entry.visibilityClass,
    )
  ) {
    issues.push({
      code: 'INVALID_VISIBILITY',
      field: 'visibilityClass',
      detail: 'Presence visibility class is invalid.',
    });
  }

  if (
    !(CHAT_PRESENCE_STYLE_KINDS as readonly string[]).includes(
      entry.styleProfile.styleKind,
    )
  ) {
    issues.push({
      code: 'INVALID_STYLE',
      field: 'styleProfile.styleKind',
      detail: 'Presence style kind is invalid.',
    });
  }

  if (
    !(CHAT_READ_DELAY_POLICY_KINDS as readonly string[]).includes(
      entry.readPolicy.minDelayMs >= 0 ? entry.styleProfile.readDelayPolicy : 'NEVER',
    )
  ) {
    issues.push({
      code: 'INVALID_READ_POLICY',
      field: 'readPolicy',
      detail: 'Read policy is invalid.',
    });
  }

  if (entry.visibilityClass === 'SHADOW' && entry.playerVisible) {
    issues.push({
      code: 'SHADOW_PLAYER_VISIBLE',
      field: 'playerVisible',
      detail: 'Shadow presence must not be player visible.',
    });
  }

  if (entry.cursor && !entry.runtime.channelDescriptor.supportsComposer) {
    issues.push({
      code: 'CURSOR_WITHOUT_COMPOSER',
      field: 'cursor',
      detail: 'Cursor cannot render in a channel without a composer.',
    });
  }

  if (entry.typingPlan && !entry.runtime.channelDescriptor.supportsTyping) {
    issues.push({
      code: 'TYPING_WITHOUT_CHANNEL_SUPPORT',
      field: 'typingPlan',
      detail: 'Typing plan cannot render in a channel without typing support.',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function assertValidPresenceEntry(entry: ChatPresenceEntry): void {
  const result = validatePresenceEntry(entry);
  if (!result.valid) {
    const reason = result.issues
      .map((issue) => `${issue.field}: ${issue.detail}`)
      .join(' | ');
    throw new Error(`Invalid ChatPresenceEntry: ${reason}`);
  }
}

// ============================================================================
// MARK: Type guards
// ============================================================================

export function isChatPresenceVisibilityClass(
  value: string,
): value is ChatPresenceVisibilityClass {
  return (CHAT_PRESENCE_VISIBILITY_CLASSES as readonly string[]).includes(value);
}

export function isChatPresenceStyleKind(
  value: string,
): value is ChatPresenceStyleKind {
  return (CHAT_PRESENCE_STYLE_KINDS as readonly string[]).includes(value);
}

export function isChatTypingTheaterKind(
  value: string,
): value is ChatTypingTheaterKind {
  return (CHAT_TYPING_THEATER_KINDS as readonly string[]).includes(value);
}

export function isChatReadDelayPolicyKind(
  value: string,
): value is ChatReadDelayPolicyKind {
  return (CHAT_READ_DELAY_POLICY_KINDS as readonly string[]).includes(value);
}

export function isChatCursorIntent(
  value: string,
): value is ChatCursorIntent {
  return (CHAT_CURSOR_INTENTS as readonly string[]).includes(value);
}

export function isChatPresenceEntry(
  value: unknown,
): value is ChatPresenceEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ChatPresenceEntry>;
  return (
    typeof candidate.presenceId === 'string' &&
    !!candidate.identity &&
    !!candidate.runtime &&
    typeof candidate.presenceState === 'string'
  );
}

export function isChatPresenceTransportEnvelope(
  value: unknown,
): value is ChatPresenceTransportEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ChatPresenceTransportEnvelope>;
  return (
    candidate.envelopeType === 'CHAT_PRESENCE' &&
    typeof candidate.schemaVersion === 'string' &&
    !!candidate.roomState
  );
}

// ============================================================================
// MARK: Transport helpers
// ============================================================================

export function createPresenceTransportEnvelope(
  roomState: ChatRoomPresenceStateAggregate,
  frameId: ChatPresenceFrameId,
): ChatPresenceTransportEnvelope {
  return {
    envelopeType: 'CHAT_PRESENCE',
    schemaVersion: CHAT_CONTRACT_VERSION,
    authorities: CHAT_CONTRACT_AUTHORITIES,
    frameId,
    roomState,
  };
}

// ============================================================================
// MARK: Collections
// ============================================================================

export const CHAT_PRESENCE_EXPORTS = Object.freeze({
  versions: {
    contractVersion: CHAT_CONTRACT_VERSION,
    authorities: CHAT_CONTRACT_AUTHORITIES,
  },
  vocabularies: {
    actorKinds: CHAT_ACTOR_KINDS,
    authorities: CHAT_AUTHORITIES,
    presenceStates: CHAT_PRESENCE_STATES,
    typingStates: CHAT_TYPING_STATES,
    visibilityClasses: CHAT_PRESENCE_VISIBILITY_CLASSES,
    styleKinds: CHAT_PRESENCE_STYLE_KINDS,
    typingTheaterKinds: CHAT_TYPING_THEATER_KINDS,
    readDelayPolicyKinds: CHAT_READ_DELAY_POLICY_KINDS,
    receiptVisibilityModes: CHAT_RECEIPT_VISIBILITY_MODES,
    cursorIntents: CHAT_CURSOR_INTENTS,
    occupancyBands: CHAT_OCCUPANCY_BANDS,
    roomAuras: CHAT_ROOM_AURAS,
    roles: CHAT_PRESENCE_ROLES,
    suppressionReasons: CHAT_SUPPRESSION_REASONS,
  },
});

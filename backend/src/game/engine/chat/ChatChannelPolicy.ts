/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CHANNEL POLICY
 * FILE: backend/src/game/engine/chat/ChatChannelPolicy.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend law for visible-channel eligibility, shadow-channel routing,
 * mount-aware channel posture, compose permissions, switch permissions,
 * negotiation exposure, rescue routing, replay visibility, and system/NPC lane
 * selection.
 *
 * Backend-truth question
 * ----------------------
 * This module answers:
 *
 *   "In this room, for this actor, at this moment in the simulation, which
 *    channel may be written to, switched to, mirrored to, replayed from, or
 *    suppressed from visible truth?"
 *
 * This matters because your backend lane is not a websocket echo. It is the
 * authoritative simulation core. Channel decisions therefore cannot live in the
 * transport tier or in the UI shell.
 *
 * Design law
 * ----------
 * - frontend may suggest a requested visible channel;
 * - backend channel policy decides whether that request is valid;
 * - moderation may later shadow a message;
 * - reducer mutates accepted channel truth;
 * - orchestration may still place NPC/system messages into other allowed lanes;
 * - proof, replay, learning, and fanout must all read the same final channel law.
 *
 * This file is intentionally large and richly factored because your locked tree
 * makes channel policy one of the core ownership points of backend chat truth.
 * ============================================================================
 */

import {
  CHAT_ALL_CHANNELS,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_MOUNT_POLICIES,
  CHAT_RUNTIME_DEFAULTS,
  type ChatAudienceHeat,
  type ChatChannelDecision,
  type ChatChannelDescriptor,
  type ChatChannelId,
  type ChatInputEnvelope,
  type ChatInvasionState,
  type ChatMountPolicy,
  type ChatNpcRole,
  type ChatPresenceSnapshot,
  type ChatRateDecision,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomStageMood,
  type ChatRoomState,
  type ChatRuntimeConfig,
  type ChatSessionId,
  type ChatSessionState,
  type ChatSignalEnvelope,
  type ChatSourceType,
  type ChatState,
  type ChatTypingSnapshot,
  type ChatUserId,
  type ChatVisibleChannel,
  type JsonValue,
  type UnixMs,
} from './types';

// ============================================================================
// MARK: Ports, options, context, and request envelopes
// ============================================================================

export interface ChatChannelPolicyLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatChannelPolicyOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly logger?: ChatChannelPolicyLoggerPort;
}

export interface ChatChannelPolicyContext {
  readonly runtime: ChatRuntimeConfig;
  readonly logger: ChatChannelPolicyLoggerPort;
}

export interface ChatJoinChannelRequest {
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomKind;
  readonly title: string;
  readonly mountTarget?: ChatMountPolicy['mountTarget'];
  readonly requestedVisibleChannel?: ChatVisibleChannel;
  readonly session: ChatSessionState;
  readonly state: ChatState;
  readonly now: UnixMs;
}

export interface ChatComposeChannelRequest {
  readonly room: ChatRoomState;
  readonly session: ChatSessionState;
  readonly state: ChatState;
  readonly requestedChannelId: ChatVisibleChannel;
  readonly now: UnixMs;
  readonly sourceType: ChatSourceType;
  readonly textPreview?: string;
}

export interface ChatSwitchChannelRequest {
  readonly room: ChatRoomState;
  readonly session: ChatSessionState;
  readonly state: ChatState;
  readonly requestedChannelId: ChatVisibleChannel;
  readonly now: UnixMs;
}

export interface ChatNpcEmitChannelRequest {
  readonly room: ChatRoomState;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly role: ChatNpcRole;
  readonly preferredChannelId?: ChatChannelId;
  readonly tags?: readonly string[];
}

export interface ChatSystemEmitChannelRequest {
  readonly room: ChatRoomState;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly signal?: ChatSignalEnvelope | null;
  readonly tags?: readonly string[];
}

export interface ChatReplayChannelRequest {
  readonly room: ChatRoomState;
  readonly state: ChatState;
  readonly replayId?: ChatReplayId | null;
  readonly actorSessionId?: ChatSessionId | null;
  readonly requestedChannelId?: ChatChannelId | null;
}

export interface ChatShadowMirrorDecision {
  readonly enabled: boolean;
  readonly shadowChannelId: ChatChannelId | null;
  readonly reasons: readonly string[];
}

export interface ChatJoinChannelDecision {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly effectiveVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly mountPolicy: ChatMountPolicy | null;
  readonly roomStageMood: ChatRoomStageMood;
}

export interface ChatSwitchChannelDecision {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly previousVisibleChannel: ChatVisibleChannel;
  readonly effectiveVisibleChannel: ChatVisibleChannel;
}

export interface ChatReplayVisibilityDecision {
  readonly visible: boolean;
  readonly reasons: readonly string[];
  readonly effectiveChannelId: ChatChannelId;
}

export interface ChatChannelDiagnostic {
  readonly roomId: ChatRoomId;
  readonly requestedChannelId: ChatChannelId | null;
  readonly effectiveChannelId: ChatChannelId;
  readonly sourceType: ChatSourceType;
  readonly roomKind: ChatRoomKind;
  readonly stageMood: ChatRoomStageMood;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly visibleOccupantCount: number;
  readonly typingOccupantCount: number;
  readonly activeInvasion: boolean;
  readonly audienceHeat01: number;
  readonly hiddenByMount: boolean;
  readonly negotiationSensitive: boolean;
  readonly rescueSensitive: boolean;
  readonly reasons: readonly string[];
}

export interface ChatChannelAuditRecord {
  readonly roomId: ChatRoomId;
  readonly createdAt: UnixMs;
  readonly diagnostic: ChatChannelDiagnostic;
}

const NOOP_LOGGER: ChatChannelPolicyLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
};

// ============================================================================
// MARK: Context creation
// ============================================================================

export function createChatChannelPolicyContext(
  options: ChatChannelPolicyOptions = {},
): ChatChannelPolicyContext {
  return {
    runtime: mergeChannelRuntime(options.runtime),
    logger: options.logger ?? NOOP_LOGGER,
  };
}

export function mergeChannelRuntime(runtime?: Partial<ChatRuntimeConfig>): ChatRuntimeConfig {
  if (!runtime) {
    return CHAT_RUNTIME_DEFAULTS;
  }

  return {
    ...CHAT_RUNTIME_DEFAULTS,
    ...runtime,
    allowVisibleChannels: runtime.allowVisibleChannels ?? CHAT_RUNTIME_DEFAULTS.allowVisibleChannels,
    allowShadowChannels: runtime.allowShadowChannels ?? CHAT_RUNTIME_DEFAULTS.allowShadowChannels,
    ratePolicy: {
      ...CHAT_RUNTIME_DEFAULTS.ratePolicy,
      ...(runtime.ratePolicy ?? {}),
    },
    moderationPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
      ...(runtime.moderationPolicy ?? {}),
    },
    replayPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
      ...(runtime.replayPolicy ?? {}),
    },
    learningPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
      ...(runtime.learningPolicy ?? {}),
    },
    proofPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.proofPolicy,
      ...(runtime.proofPolicy ?? {}),
    },
    invasionPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      ...(runtime.invasionPolicy ?? {}),
    },
  };
}

// ============================================================================
// MARK: Join-time channel law
// ============================================================================

export function evaluateJoinChannelPolicy(
  context: ChatChannelPolicyContext,
  args: ChatJoinChannelRequest,
): ChatJoinChannelDecision {
  const reasons: string[] = [];
  const mountPolicy = args.mountTarget ? CHAT_MOUNT_POLICIES[args.mountTarget] : null;
  const allowedVisibleChannels = computeAllowedVisibleChannels(context, args.roomKind, mountPolicy, args.state);

  let effectiveVisibleChannel = resolveInitialVisibleChannel(
    args.requestedVisibleChannel,
    allowedVisibleChannels,
    mountPolicy,
    args.roomKind,
  );

  if (!allowedVisibleChannels.includes(effectiveVisibleChannel)) {
    effectiveVisibleChannel = allowedVisibleChannels[0] ?? fallbackVisibleChannelForRoomKind(args.roomKind);
    reasons.push('Requested visible channel was replaced by the first allowed channel.');
  }

  if (!isSessionJoinVisible(args.session)) {
    reasons.push('Session is not eligible for visible room admission.');
    return {
      accepted: false,
      reasons,
      effectiveVisibleChannel,
      allowedVisibleChannels,
      mountPolicy,
      roomStageMood: mountPolicy?.stageMood ?? defaultStageMoodForRoomKind(args.roomKind),
    };
  }

  reasons.push('Join channel plan accepted by backend channel policy.');
  return {
    accepted: true,
    reasons,
    effectiveVisibleChannel,
    allowedVisibleChannels,
    mountPolicy,
    roomStageMood: mountPolicy?.stageMood ?? defaultStageMoodForRoomKind(args.roomKind),
  };
}

export function computeAllowedVisibleChannels(
  context: ChatChannelPolicyContext,
  roomKind: ChatRoomKind,
  mountPolicy: ChatMountPolicy | null,
  state: ChatState,
): readonly ChatVisibleChannel[] {
  const runtimeAllowed = new Set(context.runtime.allowVisibleChannels);
  const mountAllowed = mountPolicy?.allowedVisibleChannels ?? defaultVisibleChannelsForRoomKind(roomKind);
  const roomKindAllowed = defaultVisibleChannelsForRoomKind(roomKind);

  const result = mountAllowed.filter((channelId) => {
    return runtimeAllowed.has(channelId) && roomKindAllowed.includes(channelId);
  });

  const liveOpsFilter = applyLiveOpsVisibleFilter(result, state, roomKind);
  return Object.freeze(liveOpsFilter.length > 0 ? liveOpsFilter : roomKindAllowed.filter((channelId) => runtimeAllowed.has(channelId)));
}

export function resolveInitialVisibleChannel(
  requestedVisibleChannel: ChatVisibleChannel | undefined,
  allowedVisibleChannels: readonly ChatVisibleChannel[],
  mountPolicy: ChatMountPolicy | null,
  roomKind: ChatRoomKind,
): ChatVisibleChannel {
  if (requestedVisibleChannel && allowedVisibleChannels.includes(requestedVisibleChannel)) {
    return requestedVisibleChannel;
  }

  if (mountPolicy && allowedVisibleChannels.includes(mountPolicy.defaultVisibleChannel)) {
    return mountPolicy.defaultVisibleChannel;
  }

  return allowedVisibleChannels[0] ?? fallbackVisibleChannelForRoomKind(roomKind);
}

// ============================================================================
// MARK: Compose-time channel law
// ============================================================================

export function evaluateComposeChannelPolicy(
  context: ChatChannelPolicyContext,
  args: ChatComposeChannelRequest,
): ChatChannelDecision {
  const reasons: string[] = [];
  const roomDescriptor = CHAT_CHANNEL_DESCRIPTORS[args.requestedChannelId];
  let effectiveChannelId: ChatChannelId = args.requestedChannelId;

  if (!args.room.allowedVisibleChannels.includes(args.requestedChannelId)) {
    reasons.push('Requested channel is not enabled for this room.');
    return {
      allowed: false,
      reasons,
      effectiveChannelId: args.room.activeVisibleChannel,
    };
  }

  if (!roomDescriptor.supportsComposer) {
    reasons.push('Requested channel does not support player composition.');
    return {
      allowed: false,
      reasons,
      effectiveChannelId: args.room.activeVisibleChannel,
    };
  }

  if (!isSessionVisibleWriter(args.session)) {
    reasons.push('Session is not allowed to compose into visible room truth.');
    return {
      allowed: false,
      reasons,
      effectiveChannelId: selectPlayerShadowChannel(args.requestedChannelId),
    };
  }

  if (args.room.roomKind === 'DEAL_ROOM' && looksNegotiationSensitive(args.textPreview ?? '')) {
    reasons.push('Negotiation-sensitive compose request accepted in deal room posture.');
  }

  if (args.room.stageMood === 'MOURNFUL' && args.requestedChannelId === 'DEAL_ROOM') {
    reasons.push('Deal room is locked during mournful post-run posture.');
    return {
      allowed: false,
      reasons,
      effectiveChannelId: args.room.activeVisibleChannel,
    };
  }

  if (args.room.stageMood === 'CEREMONIAL' && args.requestedChannelId === 'DEAL_ROOM') {
    effectiveChannelId = 'SYNDICATE';
    reasons.push('Deal room deflected to syndicate during ceremonial posture.');
  }

  if (findActiveInvasionForRoom(args.state, args.room.roomId) && args.requestedChannelId === 'DEAL_ROOM') {
    effectiveChannelId = args.room.activeVisibleChannel === 'DEAL_ROOM' ? 'GLOBAL' : args.room.activeVisibleChannel;
    reasons.push('Deal room suppressed while active invasion is open.');
  }

  if (!CHAT_CHANNEL_DESCRIPTORS[effectiveChannelId].visibleToPlayer) {
    reasons.push('Effective channel resolved into non-visible lane, compose denied.');
    return {
      allowed: false,
      reasons,
      effectiveChannelId,
    };
  }

  reasons.push('Compose request accepted by backend channel policy.');
  return {
    allowed: true,
    reasons,
    effectiveChannelId,
  };
}

// ============================================================================
// MARK: Switch-time channel law
// ============================================================================

export function evaluateSwitchChannelPolicy(
  context: ChatChannelPolicyContext,
  args: ChatSwitchChannelRequest,
): ChatSwitchChannelDecision {
  const reasons: string[] = [];
  let effectiveVisibleChannel = args.requestedChannelId;

  if (!args.room.allowedVisibleChannels.includes(args.requestedChannelId)) {
    reasons.push('Requested channel is not configured for this room.');
    return {
      accepted: false,
      reasons,
      previousVisibleChannel: args.room.activeVisibleChannel,
      effectiveVisibleChannel: args.room.activeVisibleChannel,
    };
  }

  if (!isSessionJoinVisible(args.session)) {
    reasons.push('Session is not visible in room, so channel switch is denied.');
    return {
      accepted: false,
      reasons,
      previousVisibleChannel: args.room.activeVisibleChannel,
      effectiveVisibleChannel: args.room.activeVisibleChannel,
    };
  }

  if (args.room.stageMood === 'PREDATORY' && args.requestedChannelId === 'GLOBAL' && args.room.roomKind === 'DEAL_ROOM') {
    effectiveVisibleChannel = 'DEAL_ROOM';
    reasons.push('Predatory deal-room posture holds focus in negotiation lane.');
  }

  if (args.room.stageMood === 'MOURNFUL' && args.requestedChannelId === 'DEAL_ROOM') {
    reasons.push('Deal room is closed in mournful posture.');
    return {
      accepted: false,
      reasons,
      previousVisibleChannel: args.room.activeVisibleChannel,
      effectiveVisibleChannel: args.room.activeVisibleChannel,
    };
  }

  if (findActiveInvasionForRoom(args.state, args.room.roomId) && args.requestedChannelId === 'LOBBY') {
    reasons.push('Lobby channel is not available during active invasion.');
    return {
      accepted: false,
      reasons,
      previousVisibleChannel: args.room.activeVisibleChannel,
      effectiveVisibleChannel: args.room.activeVisibleChannel,
    };
  }

  if (effectiveVisibleChannel === args.room.activeVisibleChannel) {
    reasons.push('Requested channel already active.');
  } else {
    reasons.push('Channel switch accepted by backend channel policy.');
  }

  return {
    accepted: true,
    reasons,
    previousVisibleChannel: args.room.activeVisibleChannel,
    effectiveVisibleChannel,
  };
}

// ============================================================================
// MARK: NPC and system lane selection
// ============================================================================

export function evaluateNpcEmitChannelPolicy(
  _context: ChatChannelPolicyContext,
  args: ChatNpcEmitChannelRequest,
): ChatChannelDecision {
  const reasons: string[] = [];
  let effectiveChannelId: ChatChannelId = resolveNpcPreferredChannel(args);

  if (!channelIsAllowedForRoom(args.room, effectiveChannelId)) {
    effectiveChannelId = fallbackNpcChannel(args.room, args.role);
    reasons.push('NPC preferred channel was not allowed for this room and was replaced.');
  }

  if (args.role === 'HELPER' && args.room.stageMood === 'HOSTILE' && args.room.allowedVisibleChannels.includes('SYNDICATE')) {
    effectiveChannelId = 'SYNDICATE';
    reasons.push('Helper rerouted into syndicate for lower public heat during hostile posture.');
  }

  if (args.role === 'HATER' && findActiveInvasionForRoom(args.state, args.room.roomId)) {
    effectiveChannelId = args.room.activeVisibleChannel === 'DEAL_ROOM' ? 'GLOBAL' : args.room.activeVisibleChannel;
    reasons.push('Hater aligned to active invasion visible lane.');
  }

  if (args.tags?.includes('shadow-first') && CHAT_CHANNEL_DESCRIPTORS[effectiveChannelId].supportsShadowWrites) {
    effectiveChannelId = selectNpcShadowChannel(effectiveChannelId, args.role);
    reasons.push('NPC response primed through shadow channel by tag.');
  }

  return {
    allowed: true,
    reasons: reasons.length > 0 ? reasons : ['NPC channel accepted by backend policy.'],
    effectiveChannelId,
  };
}

export function evaluateSystemEmitChannelPolicy(
  _context: ChatChannelPolicyContext,
  args: ChatSystemEmitChannelRequest,
): ChatChannelDecision {
  const reasons: string[] = [];
  let effectiveChannelId: ChatChannelId = selectSystemChannelFromSignal(args.room, args.signal);

  if (!channelIsAllowedForRoom(args.room, effectiveChannelId)) {
    effectiveChannelId = args.room.activeVisibleChannel;
    reasons.push('System signal channel replaced by room-active visible lane.');
  }

  if (args.signal?.type === 'LIVEOPS' && args.room.roomKind === 'GLOBAL') {
    effectiveChannelId = 'GLOBAL';
    reasons.push('LiveOps system signal anchored to global theatrical lane.');
  }

  if (args.tags?.includes('shadow') && CHAT_CHANNEL_DESCRIPTORS[effectiveChannelId].supportsShadowWrites) {
    effectiveChannelId = selectSystemShadowChannel(effectiveChannelId);
    reasons.push('System event mirrored into shadow channel by explicit tag.');
  }

  return {
    allowed: true,
    reasons: reasons.length > 0 ? reasons : ['System channel accepted by backend policy.'],
    effectiveChannelId,
  };
}

// ============================================================================
// MARK: Shadow mirror and replay visibility law
// ============================================================================

export function evaluateShadowMirrorPolicy(
  room: ChatRoomState,
  effectiveChannelId: ChatChannelId,
  sourceType: ChatSourceType,
  state: ChatState,
): ChatShadowMirrorDecision {
  const reasons: string[] = [];
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[effectiveChannelId];

  if (!descriptor.supportsShadowWrites) {
    return {
      enabled: false,
      shadowChannelId: null,
      reasons: ['Effective channel does not support shadow writes.'],
    };
  }

  if (sourceType === 'SYSTEM') {
    return {
      enabled: true,
      shadowChannelId: selectSystemShadowChannel(effectiveChannelId),
      reasons: ['System messages are eligible for shadow mirror.'],
    };
  }

  if (sourceType === 'NPC_HATER' || sourceType === 'NPC_HELPER' || sourceType === 'NPC_AMBIENT') {
    return {
      enabled: true,
      shadowChannelId: selectNpcShadowChannel(effectiveChannelId, sourceType === 'NPC_HATER' ? 'HATER' : sourceType === 'NPC_HELPER' ? 'HELPER' : 'AMBIENT'),
      reasons: ['NPC messages are eligible for shadow mirror.'],
    };
  }

  if (findActiveInvasionForRoom(state, room.roomId)) {
    return {
      enabled: true,
      shadowChannelId: selectPlayerShadowChannel(room.activeVisibleChannel),
      reasons: ['Active invasion enables player-side shadow mirroring.'],
    };
  }

  return {
    enabled: false,
    shadowChannelId: null,
    reasons: ['No shadow mirror required for current visible player lane.'],
  };
}

export function evaluateReplayVisibilityPolicy(
  _context: ChatChannelPolicyContext,
  args: ChatReplayChannelRequest,
): ChatReplayVisibilityDecision {
  const reasons: string[] = [];
  const effectiveChannelId = resolveReplayChannel(args.room, args.state, args.replayId, args.requestedChannelId);
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[effectiveChannelId];

  if (!descriptor.supportsReplay) {
    reasons.push('Resolved replay channel does not support replay visibility.');
    return {
      visible: false,
      reasons,
      effectiveChannelId,
    };
  }

  if (!descriptor.visibleToPlayer) {
    reasons.push('Replay exists in a shadow lane and is not directly visible to players.');
    return {
      visible: false,
      reasons,
      effectiveChannelId,
    };
  }

  reasons.push('Replay visibility accepted by backend channel policy.');
  return {
    visible: true,
    reasons,
    effectiveChannelId,
  };
}

// ============================================================================
// MARK: Diagnostics and audits
// ============================================================================

export function buildChannelDiagnostic(
  room: ChatRoomState,
  state: ChatState,
  requestedChannelId: ChatChannelId | null,
  effectiveChannelId: ChatChannelId,
  sourceType: ChatSourceType,
  reasons: readonly string[],
): ChatChannelDiagnostic {
  const visibleOccupants = selectVisibleOccupants(state, room.roomId).length;
  const typingOccupants = selectTypingOccupants(state, room.roomId).length;
  const invasion = findActiveInvasionForRoom(state, room.roomId) !== null;
  const audienceHeat = state.audienceHeatByRoom[room.roomId]?.heat01;

  return {
    roomId: room.roomId,
    requestedChannelId,
    effectiveChannelId,
    sourceType,
    roomKind: room.roomKind,
    stageMood: room.stageMood,
    allowedVisibleChannels: room.allowedVisibleChannels,
    visibleOccupantCount: visibleOccupants,
    typingOccupantCount: typingOccupants,
    activeInvasion: invasion,
    audienceHeat01: typeof audienceHeat === 'number' ? audienceHeat : 0,
    hiddenByMount: !room.allowedVisibleChannels.includes(room.activeVisibleChannel),
    negotiationSensitive: room.roomKind === 'DEAL_ROOM',
    rescueSensitive: room.stageMood === 'HOSTILE' || room.stageMood === 'MOURNFUL',
    reasons,
  };
}

export function createChannelAuditRecord(
  room: ChatRoomState,
  state: ChatState,
  now: UnixMs,
  requestedChannelId: ChatChannelId | null,
  effectiveChannelId: ChatChannelId,
  sourceType: ChatSourceType,
  reasons: readonly string[],
): ChatChannelAuditRecord {
  return {
    roomId: room.roomId,
    createdAt: now,
    diagnostic: buildChannelDiagnostic(room, state, requestedChannelId, effectiveChannelId, sourceType, reasons),
  };
}

export function auditRoomChannelPolicy(
  room: ChatRoomState,
  state: ChatState,
  now: UnixMs,
): readonly ChatChannelAuditRecord[] {
  const records: ChatChannelAuditRecord[] = [];

  for (const channelId of room.allowedVisibleChannels) {
    records.push(
      createChannelAuditRecord(
        room,
        state,
        now,
        channelId,
        channelId,
        'PLAYER',
        ['Visible room channel present in allowed set.'],
      ),
    );
  }

  const invasion = findActiveInvasionForRoom(state, room.roomId);
  if (invasion) {
    records.push(
      createChannelAuditRecord(
        room,
        state,
        now,
        invasion.channelId,
        invasion.channelId,
        'SYSTEM',
        ['Active invasion channel anchored in room state.'],
      ),
    );
  }

  return Object.freeze(records);
}

export function auditAllRoomsChannelPolicy(
  state: ChatState,
  now: UnixMs,
): readonly ChatChannelAuditRecord[] {
  const records: ChatChannelAuditRecord[] = [];
  for (const roomId of Object.keys(state.rooms) as ChatRoomId[]) {
    records.push(...auditRoomChannelPolicy(state.rooms[roomId], state, now));
  }
  return Object.freeze(records);
}

// ============================================================================
// MARK: Room-kind, mount, and descriptor helpers
// ============================================================================

export function defaultVisibleChannelsForRoomKind(roomKind: ChatRoomKind): readonly ChatVisibleChannel[] {
  switch (roomKind) {
    case 'GLOBAL':
      return ['GLOBAL', 'SYNDICATE'];
    case 'SYNDICATE':
      return ['SYNDICATE', 'GLOBAL', 'DEAL_ROOM'];
    case 'DEAL_ROOM':
      return ['DEAL_ROOM', 'GLOBAL', 'SYNDICATE'];
    case 'LOBBY':
      return ['LOBBY', 'GLOBAL'];
    case 'PRIVATE':
      return ['SYNDICATE'];
    case 'SYSTEM':
      return ['GLOBAL'];
    default:
      return ['GLOBAL'];
  }
}

export function fallbackVisibleChannelForRoomKind(roomKind: ChatRoomKind): ChatVisibleChannel {
  return defaultVisibleChannelsForRoomKind(roomKind)[0] ?? 'GLOBAL';
}

export function defaultStageMoodForRoomKind(roomKind: ChatRoomKind): ChatRoomStageMood {
  switch (roomKind) {
    case 'GLOBAL':
      return 'TENSE';
    case 'SYNDICATE':
      return 'CEREMONIAL';
    case 'DEAL_ROOM':
      return 'PREDATORY';
    case 'LOBBY':
      return 'CALM';
    case 'PRIVATE':
      return 'CALM';
    case 'SYSTEM':
      return 'MOURNFUL';
    default:
      return 'TENSE';
  }
}

export function channelIsAllowedForRoom(room: ChatRoomState, channelId: ChatChannelId): boolean {
  if (isVisibleChannel(channelId)) {
    return room.allowedVisibleChannels.includes(channelId);
  }
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsShadowWrites;
}

export function roomSupportsChannel(room: ChatRoomState, channelId: ChatChannelId): boolean {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];
  if (descriptor.roomKind === 'SYSTEM') {
    return true;
  }
  if (isVisibleChannel(channelId)) {
    return room.allowedVisibleChannels.includes(channelId);
  }
  return descriptor.roomKind === room.roomKind || descriptor.supportsShadowWrites;
}

export function selectPlayerShadowChannel(channelId: ChatVisibleChannel): ChatChannelId {
  switch (channelId) {
    case 'GLOBAL':
      return 'RIVALRY_SHADOW';
    case 'SYNDICATE':
      return 'NPC_SHADOW';
    case 'DEAL_ROOM':
      return 'RESCUE_SHADOW';
    case 'LOBBY':
      return 'SYSTEM_SHADOW';
    default:
      return 'SYSTEM_SHADOW';
  }
}

export function selectNpcShadowChannel(channelId: ChatChannelId, role: ChatNpcRole): ChatChannelId {
  switch (role) {
    case 'HATER':
      return channelId === 'DEAL_ROOM' ? 'RIVALRY_SHADOW' : 'NPC_SHADOW';
    case 'HELPER':
      return 'RESCUE_SHADOW';
    case 'AMBIENT':
      return 'NPC_SHADOW';
    default:
      return 'NPC_SHADOW';
  }
}

export function selectSystemShadowChannel(channelId: ChatChannelId): ChatChannelId {
  if (channelId === 'GLOBAL') {
    return 'LIVEOPS_SHADOW';
  }
  if (channelId === 'DEAL_ROOM') {
    return 'SYSTEM_SHADOW';
  }
  return 'SYSTEM_SHADOW';
}

export function resolveNpcPreferredChannel(args: ChatNpcEmitChannelRequest): ChatChannelId {
  if (args.preferredChannelId) {
    return args.preferredChannelId;
  }

  switch (args.role) {
    case 'HATER':
      return args.room.roomKind === 'DEAL_ROOM' ? 'DEAL_ROOM' : 'GLOBAL';
    case 'HELPER':
      return args.room.allowedVisibleChannels.includes('SYNDICATE') ? 'SYNDICATE' : args.room.activeVisibleChannel;
    case 'AMBIENT':
      return args.room.activeVisibleChannel;
    default:
      return args.room.activeVisibleChannel;
  }
}

export function fallbackNpcChannel(room: ChatRoomState, role: ChatNpcRole): ChatChannelId {
  switch (role) {
    case 'HATER':
      return room.allowedVisibleChannels.includes('GLOBAL') ? 'GLOBAL' : room.activeVisibleChannel;
    case 'HELPER':
      return room.allowedVisibleChannels.includes('SYNDICATE') ? 'SYNDICATE' : room.activeVisibleChannel;
    case 'AMBIENT':
      return room.activeVisibleChannel;
    default:
      return room.activeVisibleChannel;
  }
}

export function selectSystemChannelFromSignal(
  room: ChatRoomState,
  signal?: ChatSignalEnvelope | null,
): ChatChannelId {
  if (!signal) {
    return room.activeVisibleChannel;
  }

  switch (signal.type) {
    case 'LIVEOPS':
      return room.roomKind === 'GLOBAL' ? 'GLOBAL' : 'LIVEOPS_SHADOW';
    case 'BATTLE':
      return room.allowedVisibleChannels.includes('GLOBAL') ? 'GLOBAL' : room.activeVisibleChannel;
    case 'ECONOMY':
      return room.allowedVisibleChannels.includes('DEAL_ROOM') ? 'DEAL_ROOM' : room.activeVisibleChannel;
    case 'RUN':
      return room.allowedVisibleChannels.includes('SYNDICATE') ? 'SYNDICATE' : room.activeVisibleChannel;
    case 'MULTIPLAYER':
      return room.allowedVisibleChannels.includes('LOBBY') ? 'LOBBY' : room.activeVisibleChannel;
    default:
      return room.activeVisibleChannel;
  }
}

export function resolveReplayChannel(
  room: ChatRoomState,
  state: ChatState,
  replayId?: ChatReplayId | null,
  requestedChannelId?: ChatChannelId | null,
): ChatChannelId {
  if (requestedChannelId && CHAT_ALL_CHANNELS.includes(requestedChannelId)) {
    return requestedChannelId;
  }

  if (replayId) {
    const replay = state.replay.byReplayId[replayId];
    if (replay) {
      return replayChannelId(replay) ?? room.activeVisibleChannel;
    }
  }

  return room.activeVisibleChannel;
}

// ============================================================================
// MARK: LiveOps, invasion, and mood filters
// ============================================================================

function applyLiveOpsVisibleFilter(
  channels: readonly ChatVisibleChannel[],
  state: ChatState,
  roomKind: ChatRoomKind,
): ChatVisibleChannel[] {
  const helperBlackout = state.telemetryQueue.some((entry) => entry.payload.helperBlackout === true);
  const whisperOnly = state.telemetryQueue.some((entry) => entry.payload.whisperOnly === true);

  let result = [...channels];

  if (helperBlackout && roomKind === 'SYNDICATE') {
    result = result.filter((channelId) => channelId !== 'SYNDICATE' || channelId === 'SYNDICATE');
  }

  if (whisperOnly) {
    result = result.filter((channelId) => channelId !== 'GLOBAL');
  }

  return result;
}

export function roomHasActiveInvasion(state: ChatState, roomId: ChatRoomId): boolean {
  return findActiveInvasionForRoom(state, roomId) !== null;
}

export function roomAudienceHeat(state: ChatState, roomId: ChatRoomId): ChatAudienceHeat | null {
  return state.audienceHeatByRoom[roomId] ?? null;
}

export function roomTypingOccupancy(state: ChatState, roomId: ChatRoomId): number {
  return selectTypingOccupants(state, roomId).length;
}

export function roomVisibleOccupancy(state: ChatState, roomId: ChatRoomId): number {
  return selectVisibleOccupants(state, roomId).length;
}

// ============================================================================
// MARK: Session and occupancy helpers
// ============================================================================

export function isSessionJoinVisible(session: ChatSessionState): boolean {
  return !session.shadowMuted && !session.invisible && session.connectionState !== 'SUSPENDED';
}

export function isSessionVisibleWriter(session: ChatSessionState): boolean {
  return !isSessionTemporarilyMuted(session) && !session.shadowMuted && !session.invisible && session.connectionState === 'ATTACHED';
}

export function sessionOwnsRoom(session: ChatSessionState, roomId: ChatRoomId): boolean {
  return session.roomIds.includes(roomId);
}

export function selectVisibleOccupants(state: ChatState, roomId: ChatRoomId): readonly ChatPresenceSnapshot[] {
  return Object.values(state.presence.byRoom[roomId] ?? {}).filter((snapshot) => snapshot.visibleToRoom);
}

export function selectTypingOccupants(state: ChatState, roomId: ChatRoomId): readonly ChatTypingSnapshot[] {
  return state.typing.byRoom[roomId] ?? [];
}

export function selectRoomSessions(state: ChatState, roomId: ChatRoomId): readonly ChatSessionState[] {
  const sessions = state.roomSessions.byRoom[roomId] ?? [];
  return sessions.map((sessionId) => state.sessions[sessionId]).filter(Boolean);
}

// ============================================================================
// MARK: Sensitivity and heuristic helpers
// ============================================================================

export function looksNegotiationSensitive(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes('max bid') ||
    normalized.includes('minimum price') ||
    normalized.includes('reserve') ||
    normalized.includes('walk-away');
}

export function isVisibleChannel(channelId: ChatChannelId): channelId is ChatVisibleChannel {
  return channelId === 'GLOBAL' || channelId === 'SYNDICATE' || channelId === 'DEAL_ROOM' || channelId === 'LOBBY';
}

export function roomSupportsNegotiation(room: ChatRoomState): boolean {
  return room.allowedVisibleChannels.includes('DEAL_ROOM');
}

export function roomSupportsRescue(room: ChatRoomState): boolean {
  return room.allowedVisibleChannels.some((channelId) => CHAT_CHANNEL_DESCRIPTORS[channelId].supportsRescue);
}

export function roomSupportsCrowdHeat(room: ChatRoomState): boolean {
  return room.allowedVisibleChannels.some((channelId) => CHAT_CHANNEL_DESCRIPTORS[channelId].supportsCrowdHeat);
}

export function visibleChannelSupportsTyping(channelId: ChatVisibleChannel): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsTyping;
}

export function visibleChannelSupportsPresence(channelId: ChatVisibleChannel): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsPresence;
}

export function visibleChannelSupportsReplay(channelId: ChatVisibleChannel): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsReplay;
}

export function visibleChannelSupportsComposer(channelId: ChatVisibleChannel): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsComposer;
}

export function visibleChannelSupportsReadReceipts(channelId: ChatVisibleChannel): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsReadReceipts;
}

// ============================================================================
// MARK: Human-readable explainers
// ============================================================================

export function explainJoinChannelDecision(decision: ChatJoinChannelDecision): string {
  return `${decision.accepted ? 'Accepted' : 'Rejected'} join; visible=${decision.effectiveVisibleChannel}; reasons=${decision.reasons.join(' | ')}`;
}

export function explainChannelDecision(decision: ChatChannelDecision): string {
  return `${decision.allowed ? 'Allowed' : 'Denied'} -> ${decision.effectiveChannelId}; reasons=${decision.reasons.join(' | ')}`;
}

export function explainSwitchChannelDecision(decision: ChatSwitchChannelDecision): string {
  return `${decision.accepted ? 'Accepted' : 'Rejected'} switch ${decision.previousVisibleChannel} -> ${decision.effectiveVisibleChannel}; reasons=${decision.reasons.join(' | ')}`;
}

export function explainReplayVisibilityDecision(decision: ChatReplayVisibilityDecision): string {
  return `${decision.visible ? 'Visible' : 'Hidden'} replay on ${decision.effectiveChannelId}; reasons=${decision.reasons.join(' | ')}`;
}

export function explainShadowMirrorDecision(decision: ChatShadowMirrorDecision): string {
  return `${decision.enabled ? 'Mirror' : 'No mirror'}${decision.shadowChannelId ? ` -> ${decision.shadowChannelId}` : ''}; reasons=${decision.reasons.join(' | ')}`;
}

// ============================================================================
// MARK: Summary helpers and metrics
// ============================================================================

export function countRoomsWithDealRoom(state: ChatState): number {
  return Object.values(state.rooms).filter((room) => room.allowedVisibleChannels.includes('DEAL_ROOM')).length;
}

export function countRoomsWithGlobal(state: ChatState): number {
  return Object.values(state.rooms).filter((room) => room.allowedVisibleChannels.includes('GLOBAL')).length;
}

export function countRoomsWithLobby(state: ChatState): number {
  return Object.values(state.rooms).filter((room) => room.allowedVisibleChannels.includes('LOBBY')).length;
}

export function countPredatoryRooms(state: ChatState): number {
  return Object.values(state.rooms).filter((room) => room.stageMood === 'PREDATORY').length;
}

export function countMournfulRooms(state: ChatState): number {
  return Object.values(state.rooms).filter((room) => room.stageMood === 'MOURNFUL').length;
}

export function countRoomsUnderInvasion(state: ChatState): number {
  return Object.keys(state.activeInvasions).length;
}

export function countVisibleReplayEligibleRooms(state: ChatState): number {
  return Object.values(state.rooms).filter((room) => room.allowedVisibleChannels.some((channelId) => visibleChannelSupportsReplay(channelId))).length;
}

// ============================================================================
// MARK: Bulk route planners for future extraction
// ============================================================================

export interface ChatRoomRoutingPlan {
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomKind;
  readonly visibleFocus: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly stageMood: ChatRoomStageMood;
  readonly prefersShadowPriming: boolean;
  readonly reasons: readonly string[];
}

export function buildRoomRoutingPlan(room: ChatRoomState, state: ChatState): ChatRoomRoutingPlan {
  const invasion = roomHasActiveInvasion(state, room.roomId);
  const prefersShadowPriming = invasion || room.stageMood === 'HOSTILE' || room.stageMood === 'PREDATORY';
  const reasons: string[] = [];

  if (invasion) {
    reasons.push('Active invasion increases preference for shadow priming.');
  }
  if (room.stageMood === 'PREDATORY') {
    reasons.push('Predatory rooms preserve negotiation asymmetry.');
  }
  if (room.stageMood === 'MOURNFUL') {
    reasons.push('Mournful rooms narrow visible lane variance.');
  }
  if (reasons.length === 0) {
    reasons.push('Room uses default routing posture.');
  }

  return {
    roomId: room.roomId,
    roomKind: room.roomKind,
    visibleFocus: room.activeVisibleChannel,
    allowedVisibleChannels: room.allowedVisibleChannels,
    stageMood: room.stageMood,
    prefersShadowPriming,
    reasons,
  };
}

export function buildAllRoomRoutingPlans(state: ChatState): readonly ChatRoomRoutingPlan[] {
  return Object.values(state.rooms).map((room) => buildRoomRoutingPlan(room, state));
}

// ============================================================================
// MARK: Replay / transcript-related helpers
// ============================================================================

export function replayArtifactIsVisibleToPlayer(
  room: ChatRoomState,
  artifact: ChatReplayArtifact,
): boolean {
  const channelId = replayChannelId(artifact) ?? room.activeVisibleChannel;
  return CHAT_CHANNEL_DESCRIPTORS[channelId].visibleToPlayer && roomSupportsChannel(room, channelId);
}

export function replayArtifactRequiresShadowUnlock(
  artifact: ChatReplayArtifact,
): boolean {
  const channelId = replayChannelId(artifact) ?? 'SYSTEM_SHADOW';
  return !CHAT_CHANNEL_DESCRIPTORS[channelId].visibleToPlayer;
}

export function resolveReplayFocusChannel(
  room: ChatRoomState,
  artifacts: readonly ChatReplayArtifact[],
): ChatChannelId {
  const firstVisible = artifacts.find((artifact) => {
    const channelId = replayChannelId(artifact) ?? room.activeVisibleChannel;
    return CHAT_CHANNEL_DESCRIPTORS[channelId].visibleToPlayer;
  });
  return (firstVisible ? replayChannelId(firstVisible) : null) ?? room.activeVisibleChannel;
}

// ============================================================================
// MARK: Transport / signal helpers for future server wrapping
// ============================================================================

export function inferJoinPlanFromEnvelope(
  context: ChatChannelPolicyContext,
  envelope: Extract<ChatInputEnvelope, { kind: 'SESSION_JOIN_REQUEST' }>,
  state: ChatState,
  session: ChatSessionState,
  now: UnixMs,
): ChatJoinChannelDecision {
  return evaluateJoinChannelPolicy(context, {
    roomId: envelope.payload.roomId,
    roomKind: envelope.payload.roomKind,
    title: envelope.payload.title,
    mountTarget: envelope.payload.mountTarget,
    requestedVisibleChannel: envelope.payload.requestedVisibleChannel,
    session,
    state,
    now,
  });
}

export function signalSuggestsGlobalTheater(signal?: ChatSignalEnvelope | null): boolean {
  return signal?.type === 'LIVEOPS' || signal?.type === 'BATTLE';
}

export function signalSuggestsNegotiation(signal?: ChatSignalEnvelope | null): boolean {
  return signal?.type === 'ECONOMY';
}

export function signalSuggestsLobby(signal?: ChatSignalEnvelope | null): boolean {
  return signal?.type === 'MULTIPLAYER';
}

// ============================================================================
// MARK: Safety rails around descriptor integrity
// ============================================================================

export function assertVisibleChannelDescriptor(channelId: ChatVisibleChannel): ChatChannelDescriptor {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];
  if (!descriptor.visibleToPlayer) {
    throw new Error(`Visible channel descriptor invariant failed for ${channelId}.`);
  }
  return descriptor;
}

export function assertShadowChannelDescriptor(channelId: ChatChannelId): ChatChannelDescriptor {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];
  if (descriptor.visibleToPlayer) {
    throw new Error(`Shadow channel descriptor invariant failed for ${channelId}.`);
  }
  return descriptor;
}

// ============================================================================
// MARK: End-state summarizers for external diagnostics
// ============================================================================

export function summarizeRoomChannelState(room: ChatRoomState): Readonly<Record<string, JsonValue>> {
  return {
    roomId: room.roomId,
    roomKind: room.roomKind,
    activeVisibleChannel: room.activeVisibleChannel,
    allowedVisibleChannels: [...room.allowedVisibleChannels],
    stageMood: room.stageMood,
    collapsed: room.collapsed,
  };
}

export function summarizeChannelDescriptor(channelId: ChatChannelId): Readonly<Record<string, JsonValue>> {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];
  return {
    id: descriptor.id,
    roomKind: descriptor.roomKind,
    visibleToPlayer: descriptor.visibleToPlayer,
    supportsComposer: descriptor.supportsComposer,
    supportsPresence: descriptor.supportsPresence,
    supportsTyping: descriptor.supportsTyping,
    supportsReadReceipts: descriptor.supportsReadReceipts,
    supportsReplay: descriptor.supportsReplay,
    supportsCrowdHeat: descriptor.supportsCrowdHeat,
    supportsNpcInjection: descriptor.supportsNpcInjection,
    supportsNegotiation: descriptor.supportsNegotiation,
    supportsRescue: descriptor.supportsRescue,
    supportsShadowWrites: descriptor.supportsShadowWrites,
    persistenceClass: descriptor.persistenceClass,
  };
}


function findActiveInvasionForRoom(state: ChatState, roomId: ChatRoomId): ChatInvasionState | null {
  for (const invasion of Object.values(state.activeInvasions)) {
    if (invasion.roomId === roomId) {
      return invasion;
    }
  }
  return null;
}

function isSessionTemporarilyMuted(session: ChatSessionState): boolean {
  return typeof session.mutedUntil === 'number' && Number(session.mutedUntil) > 0;
}

function replayChannelId(artifact: ChatReplayArtifact): ChatChannelId | null {
  const raw = artifact.metadata['channelId'];
  if (typeof raw === 'string' && (CHAT_ALL_CHANNELS as readonly string[]).includes(raw)) {
    return raw as ChatChannelId;
  }
  return null;
}

// ============================================================================
// MARK: Channel descriptor helpers (using actual ChatChannelDescriptor shape)
// ============================================================================

export function isChannelVisibleToPlayer(channelId: ChatChannelId): boolean {
  return (CHAT_CHANNEL_DESCRIPTORS[channelId]?.visibleToPlayer) ?? false;
}

export function isChannelShadowChannel(channelId: ChatChannelId): boolean {
  // Shadow channels are those not visible to player
  return !(CHAT_CHANNEL_DESCRIPTORS[channelId]?.visibleToPlayer ?? true);
}

export function doesChannelSupportComposer(channelId: ChatChannelId): boolean {
  return (CHAT_CHANNEL_DESCRIPTORS[channelId]?.supportsComposer) ?? false;
}

export function doesChannelSupportReplay(channelId: ChatChannelId): boolean {
  return (CHAT_CHANNEL_DESCRIPTORS[channelId]?.supportsReplay) ?? false;
}

export function doesChannelSupportNpcInjection(channelId: ChatChannelId): boolean {
  return (CHAT_CHANNEL_DESCRIPTORS[channelId]?.supportsNpcInjection) ?? false;
}

export function doesChannelSupportShadowWrites(channelId: ChatChannelId): boolean {
  return (CHAT_CHANNEL_DESCRIPTORS[channelId]?.supportsShadowWrites) ?? false;
}

export function doesChannelSupportNegotiation(channelId: ChatChannelId): boolean {
  return (CHAT_CHANNEL_DESCRIPTORS[channelId]?.supportsNegotiation) ?? false;
}

export function doesChannelSupportRescue(channelId: ChatChannelId): boolean {
  return (CHAT_CHANNEL_DESCRIPTORS[channelId]?.supportsRescue) ?? false;
}

// ============================================================================
// MARK: Channel policy watch bus
// ============================================================================

export type ChannelPolicyWatchEventKind =
  | 'CHANNEL_DECISION_MADE'
  | 'SWITCH_BLOCKED'
  | 'COMPOSE_BLOCKED'
  | 'MUTE_APPLIED'
  | 'SHADOW_ROUTED'
  | 'REPLAY_BLOCKED';

export interface ChannelPolicyWatchEvent {
  readonly kind: ChannelPolicyWatchEventKind;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly channelId: ChatChannelId | null;
  readonly reason: string;
  readonly occurredAt: UnixMs;
}

export class ChannelPolicyWatchBus {
  private readonly handlers: Array<(evt: ChannelPolicyWatchEvent) => void> = [];

  subscribe(handler: (evt: ChannelPolicyWatchEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  emit(evt: ChannelPolicyWatchEvent): void {
    for (const h of this.handlers) {
      try { h(evt); } catch { /* noop */ }
    }
  }

  emitDecision(roomId: ChatRoomId, sessionId: ChatSessionId, channelId: ChatChannelId, reason: string): void {
    this.emit({ kind: 'CHANNEL_DECISION_MADE', roomId, sessionId, channelId, reason, occurredAt: Date.now() as unknown as UnixMs });
  }

  emitShadowRoute(roomId: ChatRoomId, sessionId: ChatSessionId, reason: string): void {
    this.emit({ kind: 'SHADOW_ROUTED', roomId, sessionId, channelId: 'SHADOW' as ChatChannelId, reason, occurredAt: Date.now() as unknown as UnixMs });
  }

  emitComposeBlock(roomId: ChatRoomId, sessionId: ChatSessionId, reason: string): void {
    this.emit({ kind: 'COMPOSE_BLOCKED', roomId, sessionId, channelId: null, reason, occurredAt: Date.now() as unknown as UnixMs });
  }
}

// ============================================================================
// MARK: Channel policy analytics
// ============================================================================

export interface ChannelPolicyDecisionRecord {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly decidedAt: UnixMs;
  readonly wasShadow: boolean;
  readonly wasBlocked: boolean;
}

export interface ChannelPolicyAnalytics {
  readonly totalDecisions: number;
  readonly shadowRoutedCount: number;
  readonly blockedCount: number;
  readonly shadowRoutedRatio: number;
  readonly blockedRatio: number;
  readonly channelDistribution: Record<string, number>;
  readonly generatedAt: UnixMs;
}

export function buildChannelPolicyAnalytics(
  records: readonly ChannelPolicyDecisionRecord[],
): ChannelPolicyAnalytics {
  const channelDist: Record<string, number> = {};
  let shadowCount = 0, blockedCount = 0;

  for (const rec of records) {
    channelDist[rec.channelId] = (channelDist[rec.channelId] ?? 0) + 1;
    if (rec.wasShadow) shadowCount++;
    if (rec.wasBlocked) blockedCount++;
  }

  const total = records.length;
  return Object.freeze({
    totalDecisions: total,
    shadowRoutedCount: shadowCount,
    blockedCount,
    shadowRoutedRatio: total > 0 ? shadowCount / total : 0,
    blockedRatio: total > 0 ? blockedCount / total : 0,
    channelDistribution: channelDist,
    generatedAt: Date.now() as unknown as UnixMs,
  });
}

// ============================================================================
// MARK: Channel descriptor lookup (correct ChatChannelDescriptor shape)
// ============================================================================

export function getChannelDescriptor(channelId: ChatChannelId): ChatChannelDescriptor | null {
  return CHAT_CHANNEL_DESCRIPTORS[channelId] ?? null;
}

export function getChannelPersistenceClass(channelId: ChatChannelId): string {
  return CHAT_CHANNEL_DESCRIPTORS[channelId]?.persistenceClass ?? 'TRANSIENT';
}

export function isChannelVisibleToPlayerById(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId]?.visibleToPlayer ?? false;
}

export function doesChannelSupportCompose(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId]?.supportsComposer ?? false;
}

export function doesChannelSupportReplayById(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId]?.supportsReplay ?? false;
}

export function isShadowChannelById(channelId: ChatChannelId): boolean {
  // Shadow channels are those not visible to player and supporting shadow writes
  const desc = CHAT_CHANNEL_DESCRIPTORS[channelId];
  return desc ? (!desc.visibleToPlayer && desc.supportsShadowWrites) : false;
}

// ============================================================================
// MARK: Channel mount policy resolver (correct ChatMountPolicy shape)
// ============================================================================

export interface MountPolicyResolution {
  readonly mountTarget: ChatMountPolicy['mountTarget'];
  readonly policy: ChatMountPolicy;
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly stageMood: ChatRoomStageMood;
}

export function resolveMountPolicy(
  mountTarget: ChatMountPolicy['mountTarget'],
): MountPolicyResolution {
  const policy = CHAT_MOUNT_POLICIES[mountTarget];
  return Object.freeze({
    mountTarget,
    policy,
    defaultVisibleChannel: policy.defaultVisibleChannel,
    allowedVisibleChannels: policy.allowedVisibleChannels,
    stageMood: policy.stageMood,
  });
}

export function findMountPoliciesForChannel(channelId: ChatVisibleChannel): readonly MountPolicyResolution[] {
  const results: MountPolicyResolution[] = [];
  for (const [target, policy] of Object.entries(CHAT_MOUNT_POLICIES) as [ChatMountPolicy['mountTarget'], ChatMountPolicy][]) {
    if ((policy.allowedVisibleChannels as readonly string[]).includes(channelId)) {
      results.push(Object.freeze({
        mountTarget: target,
        policy,
        defaultVisibleChannel: policy.defaultVisibleChannel,
        allowedVisibleChannels: policy.allowedVisibleChannels,
        stageMood: policy.stageMood,
      }));
    }
  }
  return Object.freeze(results);
}

// ============================================================================
// MARK: Channel compose permission matrix (correct types)
// ============================================================================

export interface ComposePermissionMatrix {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly permittedChannels: readonly ChatChannelId[];
  readonly blockedChannels: readonly ChatChannelId[];
  readonly shadowOnly: boolean;
  readonly fullyBlocked: boolean;
  readonly generatedAt: UnixMs;
}

export function buildComposePermissionMatrix(
  session: ChatSessionState,
  room: ChatRoomState,
): ComposePermissionMatrix {
  const allChannels = Object.keys(CHAT_CHANNEL_DESCRIPTORS) as ChatChannelId[];
  const muted = isSessionTemporarilyMuted(session) || session.shadowMuted;

  const permitted: ChatChannelId[] = [];
  const blocked: ChatChannelId[] = [];

  for (const ch of allChannels) {
    const desc = CHAT_CHANNEL_DESCRIPTORS[ch];
    if (!desc) continue;
    // Non-composer channels are always blocked for compose
    if (!desc.supportsComposer) { blocked.push(ch); continue; }
    // If muted, only channels that support shadow writes are permitted
    if (muted && !desc.supportsShadowWrites) { blocked.push(ch); continue; }
    // Check if visible channel is in room's allowed list
    const visibleCh = ch as unknown as ChatVisibleChannel;
    if (desc.visibleToPlayer && !(room.allowedVisibleChannels as readonly string[]).includes(visibleCh)) {
      blocked.push(ch);
      continue;
    }
    permitted.push(ch);
  }

  const shadowOnly = muted && permitted.every((ch) => !CHAT_CHANNEL_DESCRIPTORS[ch]?.visibleToPlayer);
  const fullyBlocked = permitted.length === 0;

  return Object.freeze({
    sessionId: session.identity.sessionId,
    roomId: room.roomId,
    permittedChannels: Object.freeze(permitted),
    blockedChannels: Object.freeze(blocked),
    shadowOnly,
    fullyBlocked,
    generatedAt: Date.now() as unknown as UnixMs,
  });
}

// ============================================================================
// MARK: Channel rate decision context (correct ChatRateDecision shape)
// ============================================================================

export interface ChannelRateDecisionContext {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly rateDecision: ChatRateDecision;
  readonly isRateLimited: boolean;
  readonly retryAfterMs: number;
  readonly reason: string;
}

export function buildChannelRateDecisionContext(
  sessionId: ChatSessionId,
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  rateDecision: ChatRateDecision,
): ChannelRateDecisionContext {
  const isRateLimited = rateDecision.outcome !== 'ALLOW';
  const reason = isRateLimited ? (rateDecision.reasons[0] ?? 'rate_limited') : 'allowed';
  return Object.freeze({ sessionId, roomId, channelId, rateDecision, isRateLimited, retryAfterMs: rateDecision.retryAfterMs, reason });
}

// ============================================================================
// MARK: NPC channel visibility (correct ChatNpcRole: HATER|HELPER|AMBIENT|NARRATOR)
// ============================================================================

export interface NpcChannelVisibility {
  readonly npcRole: ChatNpcRole;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly canComposeShadow: boolean;
  readonly canReadShadow: boolean;
}

export function buildNpcChannelVisibility(npcRole: ChatNpcRole): NpcChannelVisibility {
  const base: NpcChannelVisibility = {
    npcRole,
    allowedVisibleChannels: Object.freeze(['GLOBAL'] as ChatVisibleChannel[]),
    canComposeShadow: false,
    canReadShadow: false,
  };

  switch (npcRole) {
    case 'HATER': return Object.freeze({ ...base, canComposeShadow: true, allowedVisibleChannels: Object.freeze(['GLOBAL', 'SYNDICATE'] as ChatVisibleChannel[]) });
    case 'HELPER': return Object.freeze({ ...base, canComposeShadow: true, canReadShadow: true, allowedVisibleChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM'] as ChatVisibleChannel[]) });
    case 'AMBIENT': return Object.freeze({ ...base, allowedVisibleChannels: Object.freeze(['GLOBAL', 'LOBBY'] as ChatVisibleChannel[]) });
    case 'NARRATOR': return Object.freeze({ ...base, canReadShadow: true });
    default: return Object.freeze(base);
  }
}

// ============================================================================
// MARK: Channel typing eligibility (correct ChatTypingSnapshot shape)
// ============================================================================

export interface TypingEligibility {
  readonly sessionId: ChatSessionId;
  readonly isEligible: boolean;
  readonly channelId: ChatVisibleChannel | null;
  readonly reason: string;
}

export function checkTypingEligibility(
  session: ChatSessionState,
  typingSnapshot: ChatTypingSnapshot | null,
): TypingEligibility {
  const sessionId = session.identity.sessionId;

  if (session.shadowMuted) {
    return Object.freeze({ sessionId, isEligible: false, channelId: null, reason: 'shadow_muted' });
  }
  if (isSessionTemporarilyMuted(session)) {
    return Object.freeze({ sessionId, isEligible: false, channelId: null, reason: 'temporarily_muted' });
  }
  if (session.connectionState === 'DISCONNECTED') {
    return Object.freeze({ sessionId, isEligible: false, channelId: null, reason: 'disconnected' });
  }

  const channelId = typingSnapshot?.channelId ?? null;
  return Object.freeze({ sessionId, isEligible: true, channelId, reason: 'eligible' });
}

// ============================================================================
// MARK: Channel signal routing (correct ChatSignalEnvelope / ChatInvasionState)
// ============================================================================

export interface SignalRoutingResult {
  readonly signalType: string;
  readonly targetChannelId: ChatChannelId;
  readonly shouldShadow: boolean;
  readonly reason: string;
}

export function routeSignalToChannel(
  signal: ChatSignalEnvelope,
  invasionState: ChatInvasionState | null,
): SignalRoutingResult {
  const signalType = signal.type;
  let targetChannel: ChatChannelId = 'GLOBAL' as ChatChannelId;
  let shouldShadow = false;
  let reason = 'default_global_routing';

  if (invasionState?.status === 'ACTIVE') {
    targetChannel = invasionState.channelId;
    reason = 'invasion_active';
  } else if (signal.liveops) {
    targetChannel = 'LIVEOPS_SHADOW' as ChatChannelId;
    shouldShadow = true;
    reason = 'liveops_signal_shadow';
  } else if (signal.battle) {
    reason = 'battle_signal_global';
  }

  return Object.freeze({ signalType, targetChannelId: targetChannel, shouldShadow, reason });
}

// ============================================================================
// MARK: Channel audience heat routing (correct ChatAudienceHeat: heat01, channelId)
// ============================================================================

export interface AudienceHeatChannelRoute {
  readonly heat01: number;
  readonly channelId: ChatVisibleChannel;
  readonly boostApplied: boolean;
  readonly suppressApplied: boolean;
  readonly swarmDirection: ChatAudienceHeat['swarmDirection'];
  readonly reason: string;
}

export function routeAudienceHeatToChannel(heat: ChatAudienceHeat): AudienceHeatChannelRoute {
  const heat01 = heat.heat01 as unknown as number;
  const channelId = heat.channelId;
  let boost = false, suppress = false;
  let reason = 'standard';

  if (heat01 >= 0.9) { boost = true; reason = 'extreme_heat_boost'; }
  else if (heat01 <= 0.1) { suppress = true; reason = 'low_heat_suppress'; }

  return Object.freeze({ heat01, channelId, boostApplied: boost, suppressApplied: suppress, swarmDirection: heat.swarmDirection, reason });
}

// ============================================================================
// MARK: Channel input envelope enrichment (correct ChatInputEnvelope union type)
// ============================================================================

export interface EnrichedInputEnvelope {
  readonly original: ChatInputEnvelope;
  readonly resolvedChannelId: ChatChannelId | null;
  readonly isPlayerMessage: boolean;
  readonly enrichedAt: UnixMs;
}

export function enrichInputEnvelope(envelope: ChatInputEnvelope): EnrichedInputEnvelope {
  let resolvedChannelId: ChatChannelId | null = null;
  let isPlayerMessage = false;

  if (envelope.kind === 'PLAYER_MESSAGE_SUBMIT') {
    const payload = (envelope as { kind: string; emittedAt: UnixMs; payload: { channelId: ChatChannelId } }).payload;
    resolvedChannelId = payload.channelId ?? null;
    isPlayerMessage = true;
  } else if (envelope.kind === 'TYPING_UPDATED') {
    const payload = (envelope as { kind: string; emittedAt: UnixMs; payload: { channelId: ChatChannelId } }).payload;
    resolvedChannelId = payload.channelId ?? null;
  }

  return Object.freeze({ original: envelope, resolvedChannelId, isPlayerMessage, enrichedAt: Date.now() as unknown as UnixMs });
}

// ============================================================================
// MARK: Channel policy module descriptor
// ============================================================================

export const CHAT_CHANNEL_POLICY_MODULE_NAME = 'ChatChannelPolicy' as const;
export const CHAT_CHANNEL_POLICY_MODULE_VERSION = '3.1.0' as const;

export const CHAT_CHANNEL_POLICY_LAWS = Object.freeze([
  'Channel decisions are backend authority — transport and UI cannot override.',
  'Shadow-muted sessions are always shadow-routed; no exceptions.',
  'System channels are compose-blocked for all non-system roles.',
  'Invasion-active rooms always route primary compose to the invasion channel.',
  'Typing eligibility is independently gated from compose eligibility.',
  'Mount policy is resolved once per room-join; changes require re-evaluation.',
  'NPC and Bot visibility rules are role-specific and non-configurable at runtime.',
]);

export const CHAT_CHANNEL_POLICY_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_CHANNEL_POLICY_MODULE_NAME,
  version: CHAT_CHANNEL_POLICY_MODULE_VERSION,
  laws: CHAT_CHANNEL_POLICY_LAWS,
  channelDescriptorKeys: Object.keys(CHAT_CHANNEL_DESCRIPTORS),
  mountPolicyKeys: Object.keys(CHAT_MOUNT_POLICIES),
});

// ============================================================================
// MARK: Channel room stage mood resolver
// ============================================================================

export interface RoomStageMoodPolicy {
  readonly stageMood: ChatRoomStageMood;
  readonly defaultComposerPlaceholder: string;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly composerEnabled: boolean;
}

export function buildRoomStageMoodPolicy(room: ChatRoomState): RoomStageMoodPolicy {
  const mood = room.stageMood;
  const channels = room.allowedVisibleChannels;

  const composerEnabled = channels.length > 0;
  let placeholder = 'Type a message…';

  switch (mood) {
    case 'HOSTILE': placeholder = 'Push back or go silent…'; break;
    case 'TENSE': placeholder = 'Choose your words carefully…'; break;
    case 'CALM': placeholder = 'Type a message…'; break;
    case 'PREDATORY': placeholder = 'Move carefully…'; break;
    case 'CEREMONIAL': placeholder = 'Speak with intent…'; break;
    case 'MOURNFUL': placeholder = 'Say what needs to be said…'; break;
    case 'ECSTATIC': placeholder = 'Let them know you\'re here…'; break;
    default: break;
  }

  return Object.freeze({ stageMood: mood, defaultComposerPlaceholder: placeholder, allowedVisibleChannels: channels, composerEnabled });
}

// ============================================================================
// MARK: Channel room read receipt policy
// ============================================================================

export interface ReadReceiptPolicy {
  readonly channelId: ChatChannelId;
  readonly supportsReadReceipts: boolean;
  readonly supportsPresence: boolean;
  readonly supportsTyping: boolean;
}

export function getReadReceiptPolicy(channelId: ChatChannelId): ReadReceiptPolicy {
  const desc = CHAT_CHANNEL_DESCRIPTORS[channelId];
  return Object.freeze({
    channelId,
    supportsReadReceipts: desc?.supportsReadReceipts ?? false,
    supportsPresence: desc?.supportsPresence ?? false,
    supportsTyping: desc?.supportsTyping ?? false,
  });
}

export function buildReadReceiptPolicies(): ReadonlyMap<ChatChannelId, ReadReceiptPolicy> {
  const map = new Map<ChatChannelId, ReadReceiptPolicy>();
  for (const [channelId, desc] of Object.entries(CHAT_CHANNEL_DESCRIPTORS) as [ChatChannelId, ChatChannelDescriptor][]) {
    map.set(channelId, Object.freeze({
      channelId,
      supportsReadReceipts: desc.supportsReadReceipts,
      supportsPresence: desc.supportsPresence,
      supportsTyping: desc.supportsTyping,
    }));
  }
  return map;
}

// ============================================================================
// MARK: Channel crowd heat eligibility
// ============================================================================

export interface CrowdHeatEligibility {
  readonly channelId: ChatChannelId;
  readonly isEligible: boolean;
  readonly reason: string;
}

export function checkCrowdHeatEligibility(channelId: ChatChannelId): CrowdHeatEligibility {
  const desc = CHAT_CHANNEL_DESCRIPTORS[channelId];
  if (!desc) return Object.freeze({ channelId, isEligible: false, reason: 'unknown_channel' });
  if (!desc.supportsCrowdHeat) return Object.freeze({ channelId, isEligible: false, reason: 'crowd_heat_not_supported' });
  return Object.freeze({ channelId, isEligible: true, reason: 'eligible' });
}

export function getChannelsEligibleForCrowdHeat(): readonly ChatChannelId[] {
  return Object.freeze(
    (Object.entries(CHAT_CHANNEL_DESCRIPTORS) as [ChatChannelId, ChatChannelDescriptor][])
      .filter(([, desc]) => desc.supportsCrowdHeat)
      .map(([id]) => id),
  );
}

// ============================================================================
// MARK: Channel NPC injection matrix
// ============================================================================

export interface NpcInjectionMatrix {
  readonly channelId: ChatChannelId;
  readonly supportsNpcInjection: boolean;
  readonly supportsRescue: boolean;
  readonly supportsNegotiation: boolean;
}

export function buildNpcInjectionMatrix(): ReadonlyMap<ChatChannelId, NpcInjectionMatrix> {
  const map = new Map<ChatChannelId, NpcInjectionMatrix>();
  for (const [ch, desc] of Object.entries(CHAT_CHANNEL_DESCRIPTORS) as [ChatChannelId, ChatChannelDescriptor][]) {
    map.set(ch, Object.freeze({
      channelId: ch,
      supportsNpcInjection: desc.supportsNpcInjection,
      supportsRescue: desc.supportsRescue,
      supportsNegotiation: desc.supportsNegotiation,
    }));
  }
  return map;
}

export function getChannelsForNpcInjection(): readonly ChatChannelId[] {
  return Object.freeze(
    (Object.entries(CHAT_CHANNEL_DESCRIPTORS) as [ChatChannelId, ChatChannelDescriptor][])
      .filter(([, desc]) => desc.supportsNpcInjection)
      .map(([id]) => id),
  );
}

// ============================================================================
// MARK: Channel source type routing
// ============================================================================

export interface SourceTypeChannelRoute {
  readonly sourceType: ChatSourceType;
  readonly defaultChannelId: ChatChannelId;
  readonly shadowChannelId: ChatChannelId | null;
  readonly reason: string;
}

const _sourceTypeRouteMap: Record<string, SourceTypeChannelRoute> = {
  PLAYER: Object.freeze({ sourceType: 'PLAYER' as ChatSourceType, defaultChannelId: 'GLOBAL' as ChatChannelId, shadowChannelId: null, reason: 'player_to_global' }),
  NPC_HATER: Object.freeze({ sourceType: 'NPC_HATER' as ChatSourceType, defaultChannelId: 'GLOBAL' as ChatChannelId, shadowChannelId: 'NPC_SHADOW' as ChatChannelId, reason: 'npc_hater_global' }),
  NPC_HELPER: Object.freeze({ sourceType: 'NPC_HELPER' as ChatSourceType, defaultChannelId: 'GLOBAL' as ChatChannelId, shadowChannelId: 'NPC_SHADOW' as ChatChannelId, reason: 'npc_helper_global' }),
  NPC_AMBIENT: Object.freeze({ sourceType: 'NPC_AMBIENT' as ChatSourceType, defaultChannelId: 'GLOBAL' as ChatChannelId, shadowChannelId: 'NPC_SHADOW' as ChatChannelId, reason: 'npc_ambient_global' }),
  SYSTEM: Object.freeze({ sourceType: 'SYSTEM' as ChatSourceType, defaultChannelId: 'SYSTEM_SHADOW' as ChatChannelId, shadowChannelId: 'SYSTEM_SHADOW' as ChatChannelId, reason: 'system_to_shadow' }),
  SERVER: Object.freeze({ sourceType: 'SERVER' as ChatSourceType, defaultChannelId: 'SYSTEM_SHADOW' as ChatChannelId, shadowChannelId: 'SYSTEM_SHADOW' as ChatChannelId, reason: 'server_to_shadow' }),
  MODERATION: Object.freeze({ sourceType: 'MODERATION' as ChatSourceType, defaultChannelId: 'SYSTEM_SHADOW' as ChatChannelId, shadowChannelId: 'SYSTEM_SHADOW' as ChatChannelId, reason: 'moderation_shadow' }),
  LIVEOPS: Object.freeze({ sourceType: 'LIVEOPS' as ChatSourceType, defaultChannelId: 'LIVEOPS_SHADOW' as ChatChannelId, shadowChannelId: 'LIVEOPS_SHADOW' as ChatChannelId, reason: 'liveops_shadow' }),
};

export function getChannelRouteForSourceType(sourceType: ChatSourceType): SourceTypeChannelRoute | null {
  return (_sourceTypeRouteMap[sourceType as string] ?? null) as SourceTypeChannelRoute | null;
}

// ============================================================================
// MARK: Channel persistence class report
// ============================================================================

export interface ChannelPersistenceReport {
  readonly transientChannels: readonly ChatChannelId[];
  readonly runScopedChannels: readonly ChatChannelId[];
  readonly accountScopedChannels: readonly ChatChannelId[];
  readonly generatedAt: UnixMs;
}

export function buildChannelPersistenceReport(): ChannelPersistenceReport {
  const transient: ChatChannelId[] = [];
  const runScoped: ChatChannelId[] = [];
  const accountScoped: ChatChannelId[] = [];

  for (const [ch, desc] of Object.entries(CHAT_CHANNEL_DESCRIPTORS) as [ChatChannelId, ChatChannelDescriptor][]) {
    if (desc.persistenceClass === 'TRANSIENT') transient.push(ch);
    else if (desc.persistenceClass === 'RUN_SCOPED') runScoped.push(ch);
    else if (desc.persistenceClass === 'ACCOUNT_SCOPED') accountScoped.push(ch);
  }

  return Object.freeze({
    transientChannels: Object.freeze(transient),
    runScopedChannels: Object.freeze(runScoped),
    accountScopedChannels: Object.freeze(accountScoped),
    generatedAt: Date.now() as unknown as UnixMs,
  });
}

// ============================================================================
// MARK: Channel room switch request validator
// ============================================================================

export interface ChannelSwitchRequest {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly fromChannel: ChatVisibleChannel;
  readonly toChannel: ChatVisibleChannel;
  readonly requestedAt: UnixMs;
}

export interface ChannelSwitchValidation {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
  readonly effectiveChannel: ChatVisibleChannel;
}

export function validateChannelSwitchRequest(
  request: ChannelSwitchRequest,
  session: ChatSessionState,
  room: ChatRoomState,
): ChannelSwitchValidation {
  const reasons: string[] = [];

  if (session.shadowMuted) {
    return Object.freeze({ allowed: false, reasons: Object.freeze(['shadow_muted']), effectiveChannel: request.fromChannel });
  }

  if (!(room.allowedVisibleChannels as readonly string[]).includes(request.toChannel)) {
    reasons.push(`channel_${request.toChannel}_not_allowed_in_room`);
  }

  if (isSessionTemporarilyMuted(session) && !doesChannelSupportShadowWrites(request.toChannel as unknown as ChatChannelId)) {
    reasons.push('muted_cannot_switch_to_non_shadow');
  }

  const allowed = reasons.length === 0;
  return Object.freeze({
    allowed,
    reasons: Object.freeze(reasons),
    effectiveChannel: allowed ? request.toChannel : request.fromChannel,
  });
}

// ============================================================================
// MARK: Channel unread count reporter
// ============================================================================

export interface ChannelUnreadReport {
  readonly roomId: ChatRoomId;
  readonly unreadByChannel: Readonly<Record<ChatVisibleChannel, number>>;
  readonly totalUnread: number;
  readonly hasUnread: boolean;
  readonly mostUnreadChannel: ChatVisibleChannel | null;
  readonly generatedAt: UnixMs;
}

export function buildChannelUnreadReport(room: ChatRoomState): ChannelUnreadReport {
  const unread = room.unreadByChannel;
  let total = 0;
  let mostUnread: ChatVisibleChannel | null = null;
  let maxCount = 0;

  for (const [ch, count] of Object.entries(unread) as [ChatVisibleChannel, number][]) {
    total += count;
    if (count > maxCount) { maxCount = count; mostUnread = ch; }
  }

  return Object.freeze({
    roomId: room.roomId,
    unreadByChannel: unread,
    totalUnread: total,
    hasUnread: total > 0,
    mostUnreadChannel: mostUnread,
    generatedAt: Date.now() as unknown as UnixMs,
  });
}

// ============================================================================
// MARK: Channel active scene context
// ============================================================================

export interface ChannelActiveSceneContext {
  readonly roomId: ChatRoomId;
  readonly activeSceneId: string | null;
  readonly activeMomentId: string | null;
  readonly activeChannel: ChatVisibleChannel;
  readonly sceneLocked: boolean;
}

export function buildChannelActiveSceneContext(room: ChatRoomState): ChannelActiveSceneContext {
  return Object.freeze({
    roomId: room.roomId,
    activeSceneId: room.activeSceneId,
    activeMomentId: room.activeMomentId,
    activeChannel: room.activeVisibleChannel,
    sceneLocked: room.activeSceneId !== null,
  });
}

// ============================================================================
// MARK: Channel policy replay window validator
// ============================================================================

export interface ReplayWindowChannelValidation {
  readonly channelId: ChatChannelId;
  readonly supportsReplay: boolean;
  readonly persistenceClass: string;
  readonly isReplayEligible: boolean;
  readonly reason: string;
}

export function validateChannelForReplay(channelId: ChatChannelId): ReplayWindowChannelValidation {
  const desc = CHAT_CHANNEL_DESCRIPTORS[channelId];
  if (!desc) {
    return Object.freeze({ channelId, supportsReplay: false, persistenceClass: 'UNKNOWN', isReplayEligible: false, reason: 'unknown_channel' });
  }
  const isEligible = desc.supportsReplay && desc.persistenceClass !== 'TRANSIENT';
  return Object.freeze({
    channelId,
    supportsReplay: desc.supportsReplay,
    persistenceClass: desc.persistenceClass,
    isReplayEligible: isEligible,
    reason: isEligible ? 'eligible_for_replay' : !desc.supportsReplay ? 'replay_not_supported' : 'transient_channel_not_persisted',
  });
}

export function getAllReplayEligibleChannels(): readonly ChatChannelId[] {
  return Object.freeze(
    (Object.entries(CHAT_CHANNEL_DESCRIPTORS) as [ChatChannelId, ChatChannelDescriptor][])
      .filter(([, desc]) => desc.supportsReplay && desc.persistenceClass !== 'TRANSIENT')
      .map(([id]) => id),
  );
}

// ============================================================================
// MARK: Session user identity accessor (uses ChatUserId)
// ============================================================================

export function resolveSessionUserId(session: ChatSessionState): ChatUserId {
  return session.identity.userId;
}

// ============================================================================
// MARK: Module authority object
// ============================================================================

export const ChatChannelPolicyModule = Object.freeze({
  version: CHAT_CHANNEL_POLICY_MODULE_VERSION,
  moduleName: CHAT_CHANNEL_POLICY_MODULE_NAME,
  laws: CHAT_CHANNEL_POLICY_LAWS,
  descriptor: CHAT_CHANNEL_POLICY_MODULE_DESCRIPTOR,
  // Context
  createContext: createChatChannelPolicyContext,
  mergeRuntime: mergeChannelRuntime,
  // Core policy evaluators
  evaluateJoinChannelPolicy,
  computeAllowedVisibleChannels,
  resolveInitialVisibleChannel,
  evaluateComposeChannelPolicy,
  evaluateSwitchChannelPolicy,
  evaluateNpcEmitChannelPolicy,
  evaluateSystemEmitChannelPolicy,
  evaluateShadowMirrorPolicy,
  evaluateReplayVisibilityPolicy,
  // Diagnostics / audit
  buildChannelDiagnostic,
  createChannelAuditRecord,
  auditRoomChannelPolicy,
  auditAllRoomsChannelPolicy,
  // Room-kind helpers
  defaultVisibleChannelsForRoomKind,
  fallbackVisibleChannelForRoomKind,
  defaultStageMoodForRoomKind,
  channelIsAllowedForRoom,
  roomSupportsChannel,
  // Shadow channel selectors
  selectPlayerShadowChannel,
  selectNpcShadowChannel,
  selectSystemShadowChannel,
  // NPC / system channel resolvers
  resolveNpcPreferredChannel,
  fallbackNpcChannel,
  selectSystemChannelFromSignal,
  resolveReplayChannel,
  // Room state helpers
  roomHasActiveInvasion,
  roomAudienceHeat,
  roomTypingOccupancy,
  roomVisibleOccupancy,
  // Session helpers
  isSessionJoinVisible,
  isSessionVisibleWriter,
  sessionOwnsRoom,
  resolveSessionUserId,
  // Occupancy selectors
  selectVisibleOccupants,
  selectTypingOccupants,
  selectRoomSessions,
  // Sensitivity heuristics
  looksNegotiationSensitive,
  isVisibleChannel,
  roomSupportsNegotiation,
  roomSupportsRescue,
  roomSupportsCrowdHeat,
  // Visible channel capability testers
  visibleChannelSupportsTyping,
  visibleChannelSupportsPresence,
  visibleChannelSupportsReplay,
  visibleChannelSupportsComposer,
  visibleChannelSupportsReadReceipts,
  // Explainers
  explainJoinChannelDecision,
  explainChannelDecision,
  explainSwitchChannelDecision,
  explainReplayVisibilityDecision,
  explainShadowMirrorDecision,
  // Metrics
  countRoomsWithDealRoom,
  countRoomsWithGlobal,
  countRoomsWithLobby,
  countPredatoryRooms,
  countMournfulRooms,
  countRoomsUnderInvasion,
  countVisibleReplayEligibleRooms,
  // Routing plans
  buildRoomRoutingPlan,
  buildAllRoomRoutingPlans,
  // Replay artifact helpers
  replayArtifactIsVisibleToPlayer,
  replayArtifactRequiresShadowUnlock,
  resolveReplayFocusChannel,
  // Signal helpers
  inferJoinPlanFromEnvelope,
  signalSuggestsGlobalTheater,
  signalSuggestsNegotiation,
  signalSuggestsLobby,
  // Descriptor assertions / lookups
  assertVisibleChannelDescriptor,
  assertShadowChannelDescriptor,
  summarizeRoomChannelState,
  summarizeChannelDescriptor,
  getChannelDescriptor,
  getChannelPersistenceClass,
  // Channel capability testers (by ID)
  isChannelVisibleToPlayer,
  isChannelShadowChannel,
  isChannelVisibleToPlayerById,
  isShadowChannelById,
  doesChannelSupportComposer,
  doesChannelSupportReplay,
  doesChannelSupportNpcInjection,
  doesChannelSupportShadowWrites,
  doesChannelSupportNegotiation,
  doesChannelSupportRescue,
  doesChannelSupportCompose,
  doesChannelSupportReplayById,
  // Watch bus
  ChannelPolicyWatchBus,
  buildChannelPolicyAnalytics,
  // Mount policy
  resolveMountPolicy,
  findMountPoliciesForChannel,
  // Permission / rate / NPC matrices
  buildComposePermissionMatrix,
  buildChannelRateDecisionContext,
  buildNpcChannelVisibility,
  // Typing / signal / heat routing
  checkTypingEligibility,
  routeSignalToChannel,
  routeAudienceHeatToChannel,
  enrichInputEnvelope,
  getChannelRouteForSourceType,
  // Stage mood / read receipts / crowd heat / NPC injection
  buildRoomStageMoodPolicy,
  getReadReceiptPolicy,
  buildReadReceiptPolicies,
  checkCrowdHeatEligibility,
  getChannelsEligibleForCrowdHeat,
  buildNpcInjectionMatrix,
  getChannelsForNpcInjection,
  // Persistence / switch / unread / scene / replay window
  buildChannelPersistenceReport,
  validateChannelSwitchRequest,
  buildChannelUnreadReport,
  buildChannelActiveSceneContext,
  validateChannelForReplay,
  getAllReplayEligibleChannels,
});

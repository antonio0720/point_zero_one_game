/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CHANNEL POLICY
 * FILE: backend/src/game/engine/chat/ChatChannelPolicy.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
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

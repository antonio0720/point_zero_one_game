
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT RATE POLICY
 * FILE: backend/src/game/engine/chat/ChatRatePolicy.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend emission law for chat cadence, burst control, duplicate
 * suppression, mute locks, invasion locks, typing heartbeats, and NPC pacing.
 *
 * Why this file exists
 * --------------------
 * ChatRatePolicy.ts is not a cosmetic throttle helper. In the backend
 * simulation tree it owns the question:
 *
 *   "May this actor emit into authoritative transcript truth now?"
 *
 * That answer must happen before reducer mutation, because the frontend is
 * allowed to feel instantaneous, but the backend decides what becomes real.
 *
 * Design law
 * ----------
 * - Transport may forward attempts. It does not decide cadence truth.
 * - Frontend may pre-warn. It does not decide cadence truth.
 * - Message factory may stamp rate metadata. It does not decide cadence truth.
 * - Reducer may apply accepted outcomes. It does not decide cadence truth.
 * - ChatRatePolicy.ts is where emission law is evaluated.
 *
 * Architectural fit
 * -----------------
 * This module is authored for the backend chat lane described in the full
 * simulation tree:
 * - session admission is already backend-owned,
 * - transcript truth is already backend-owned,
 * - invasions and NPC orchestration are backend-owned,
 * - therefore cadence and lock rules must also be backend-owned.
 * ============================================================================
 */

import {
  asUnixMs,
  type BotId,
  type ChatConnectionState,
  type ChatInvasionState,
  type ChatMessage,
  type ChatNpcRole,
  type ChatPlayerMessageSubmitRequest,
  type ChatPresenceSnapshot,
  type ChatRateDecision,
  type ChatRateOutcome,
  type ChatRoomId,
  type ChatRoomState,
  type ChatRuntimeConfig,
  type ChatSessionId,
  type ChatSessionState,
  type ChatSignalEnvelope,
  type ChatState,
  type ChatTypingMode,
  type ChatVisibleChannel,
  type JsonValue,
  type UnixMs,
} from './types';
import {
  getActiveRoomInvasions,
  isRoomSilenced,
  isSessionInRoom,
  selectLatestMessage,
  selectRoom,
  selectRoomPresence,
  selectRoomTranscript,
  selectRoomTyping,
  selectSession,
} from './ChatState';

// ============================================================================
// MARK: Ports, options, and context
// ============================================================================

export interface ChatRatePolicyClockPort {
  now(): number;
}

export interface ChatRatePolicyLoggerPort {
  debug(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, context?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatRatePolicyPorts {
  readonly clock: ChatRatePolicyClockPort;
  readonly logger: ChatRatePolicyLoggerPort;
}

export interface ChatRatePolicyOptions {
  readonly runtime: ChatRuntimeConfig;
  readonly ports?: Partial<ChatRatePolicyPorts>;
}

export interface ChatRatePolicyContext {
  readonly runtime: ChatRuntimeConfig;
  readonly ports: ChatRatePolicyPorts;
}

const DEFAULT_CLOCK: ChatRatePolicyClockPort = {
  now: () => Date.now(),
};

const DEFAULT_LOGGER: ChatRatePolicyLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
};

const DEFAULT_PORTS: ChatRatePolicyPorts = {
  clock: DEFAULT_CLOCK,
  logger: DEFAULT_LOGGER,
};

// ============================================================================
// MARK: Request and report shapes
// ============================================================================

export interface ChatPlayerRateRequest {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly request: ChatPlayerMessageSubmitRequest;
  readonly now?: UnixMs;
}

export interface ChatNpcRateRequest {
  readonly roomId: ChatRoomId;
  readonly actorId: string;
  readonly personaId?: string | null;
  readonly botId?: BotId | null;
  readonly role: ChatNpcRole;
  readonly channelId: string;
  readonly text: string;
  readonly causeEvent?: ChatSignalEnvelope | null;
  readonly now?: UnixMs;
  readonly allowBypassOnCriticalRescue?: boolean;
}

export interface ChatSystemRateRequest {
  readonly roomId: ChatRoomId;
  readonly actorId: string;
  readonly channelId: string;
  readonly text: string;
  readonly now?: UnixMs;
  readonly reason: string;
}

export interface ChatTypingRateRequest {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly channelId: ChatVisibleChannel;
  readonly mode: ChatTypingMode;
  readonly now?: UnixMs;
}

export interface ChatInvasionRateRequest {
  readonly roomId: ChatRoomId;
  readonly invasionKind: ChatInvasionState['kind'];
  readonly channelId: string;
  readonly now?: UnixMs;
  readonly shadowPriming?: boolean;
}

export interface ChatRateWindowStats {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId | null;
  readonly actorId: string | null;
  readonly messagesInLastSecond: number;
  readonly messagesInLastMinute: number;
  readonly identicalMessagesInWindow: number;
  readonly latestActorMessageAt: UnixMs | null;
  readonly latestRoomMessageAt: UnixMs | null;
  readonly activeInvasionCount: number;
  readonly roomSilenced: boolean;
}

export interface ChatRateDiagnostic {
  readonly accepted: boolean;
  readonly outcome: ChatRateOutcome;
  readonly retryAfterMs: number;
  readonly reasons: readonly string[];
  readonly stats: ChatRateWindowStats;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatTypingDecision {
  readonly accepted: boolean;
  readonly retryAfterMs: number;
  readonly reasons: readonly string[];
  readonly expiresAt: UnixMs;
}

export interface ChatCadenceSnapshot {
  readonly roomId: ChatRoomId;
  readonly roomLastMessageAt: UnixMs | null;
  readonly helperLastMessageAt: UnixMs | null;
  readonly haterLastMessageAt: UnixMs | null;
  readonly ambientLastMessageAt: UnixMs | null;
  readonly playerLastMessageBySession: Readonly<Record<ChatSessionId, UnixMs | null>>;
}

export interface ChatActorCadenceStats {
  readonly roomId: ChatRoomId;
  readonly actorId: string;
  readonly npcRole: ChatNpcRole | null;
  readonly totalMessages: number;
  readonly messagesInLastSecond: number;
  readonly messagesInLastTenSeconds: number;
  readonly messagesInLastMinute: number;
  readonly lastMessageAt: UnixMs | null;
  readonly meanGapMs: number;
  readonly shortestGapMs: number | null;
  readonly longestGapMs: number | null;
}

export interface ChatRateAuditRecord {
  readonly roomId: ChatRoomId;
  readonly actorId: string;
  readonly outcome: ChatRateOutcome;
  readonly createdAt: UnixMs;
  readonly reasons: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Context creation
// ============================================================================

export function createChatRatePolicyContext(
  options: ChatRatePolicyOptions,
): ChatRatePolicyContext {
  return {
    runtime: options.runtime,
    ports: {
      clock: options.ports?.clock ?? DEFAULT_PORTS.clock,
      logger: options.ports?.logger ?? DEFAULT_PORTS.logger,
    },
  };
}

// ============================================================================
// MARK: Public evaluation entry points
// ============================================================================

export function evaluatePlayerRate(
  context: ChatRatePolicyContext,
  state: ChatState,
  args: ChatPlayerRateRequest,
): ChatRateDecision {
  const now = args.now ?? asUnixMs(context.ports.clock.now());
  const room = selectRoom(state, args.roomId);
  const session = selectSession(state, args.sessionId);

  if (!room) {
    return rejectRate('LOCK', 5_000, ['Room does not exist.']);
  }

  if (!session) {
    return rejectRate('LOCK', 5_000, ['Session does not exist.']);
  }

  if (!isSessionInRoom(state, args.roomId, args.sessionId)) {
    return rejectRate('LOCK', 5_000, ['Session is not attached to room.']);
  }

  const connectionGate = evaluateConnectionGate(session.connectionState);
  if (connectionGate) {
    return connectionGate;
  }

  if (session.shadowMuted) {
    return rejectRate('LOCK', 15_000, ['Session is shadow muted.']);
  }

  if (session.mutedUntil && Number(session.mutedUntil) > Number(now)) {
    return rejectRate('LOCK', Number(session.mutedUntil) - Number(now), ['Session is muted.']);
  }

  if (isRoomSilenced(state, args.roomId, now)) {
    return rejectRate('DEFER', 1_500, ['Room is under timed silence.']);
  }

  const channelGate = evaluateVisibleChannelMembership(room, args.request.channelId);
  if (channelGate) {
    return channelGate;
  }

  const burstGate = evaluatePlayerBurstWindows(context, state, room, session, args.request.text, now);
  if (burstGate.outcome !== 'ALLOW') {
    return burstGate;
  }

  const invasionGate = evaluatePlayerInvasionGate(context, state, room, session, now);
  if (invasionGate.outcome !== 'ALLOW') {
    return invasionGate;
  }

  const repetitionGate = evaluatePlayerRepetitionGate(context, state, room, session, args.request.text, now);
  if (repetitionGate.outcome !== 'ALLOW') {
    return repetitionGate;
  }

  const floodGate = evaluateRoomFloodGate(context, state, room, now);
  if (floodGate.outcome !== 'ALLOW') {
    return floodGate;
  }

  return {
    outcome: 'ALLOW',
    retryAfterMs: 0,
    reasons: [],
  };
}

export function evaluateNpcRate(
  context: ChatRatePolicyContext,
  state: ChatState,
  args: ChatNpcRateRequest,
): ChatRateDecision {
  const now = args.now ?? asUnixMs(context.ports.clock.now());
  const room = selectRoom(state, args.roomId);

  if (!room) {
    return rejectRate('LOCK', 5_000, ['Room does not exist.']);
  }

  if (isRoomSilenced(state, args.roomId, now)) {
    if (args.role === 'HELPER' && args.allowBypassOnCriticalRescue) {
      context.ports.logger.debug('chat.rate.helper_bypass_room_silence', {
        roomId: args.roomId,
        actorId: args.actorId,
      });
    } else {
      return rejectRate('DEFER', 1_500, ['Room is under timed silence.']);
    }
  }

  const activeInvasions = getActiveRoomInvasions(state, args.roomId);
  const invasionGate = evaluateNpcInvasionGate(context, activeInvasions, args, now);
  if (invasionGate.outcome !== 'ALLOW') {
    return invasionGate;
  }

  const minimumGapMs = minimumGapForNpcRole(context.runtime, args.role);
  const cadenceGate = evaluateNpcCadenceGate(state, args.roomId, args.actorId, args.role, minimumGapMs, now);
  if (cadenceGate.outcome !== 'ALLOW') {
    return cadenceGate;
  }

  const textRepeatGate = evaluateNpcRepeatGate(state, args.roomId, args.actorId, args.text, minimumGapMs, now);
  if (textRepeatGate.outcome !== 'ALLOW') {
    return textRepeatGate;
  }

  const crowdGate = evaluateNpcCrowdingGate(state, args.roomId, args.role, now);
  if (crowdGate.outcome !== 'ALLOW') {
    return crowdGate;
  }

  if (args.role === 'HATER') {
    const hostileGate = evaluateHaterHostileSpacing(context, state, args.roomId, now);
    if (hostileGate.outcome !== 'ALLOW') {
      return hostileGate;
    }
  }

  if (args.role === 'HELPER') {
    const helperGate = evaluateHelperSpacing(context, state, args.roomId, now);
    if (helperGate.outcome !== 'ALLOW') {
      return helperGate;
    }
  }

  return {
    outcome: 'ALLOW',
    retryAfterMs: 0,
    reasons: [],
  };
}

export function evaluateSystemRate(
  context: ChatRatePolicyContext,
  state: ChatState,
  args: ChatSystemRateRequest,
): ChatRateDecision {
  const now = args.now ?? asUnixMs(context.ports.clock.now());
  const room = selectRoom(state, args.roomId);

  if (!room) {
    return rejectRate('LOCK', 5_000, ['Room does not exist.']);
  }

  const latest = selectLatestMessage(state, args.roomId);
  if (!latest) {
    return allowRate();
  }

  const gap = Number(now) - Number(latest.createdAt);
  if (gap < 200 && args.reason !== 'command_feedback') {
    return rejectRate('DEFER', 200 - gap, ['System emission is too close to latest room message.']);
  }

  return allowRate();
}

export function evaluateTypingRate(
  context: ChatRatePolicyContext,
  state: ChatState,
  args: ChatTypingRateRequest,
): ChatTypingDecision {
  const now = args.now ?? asUnixMs(context.ports.clock.now());
  const room = selectRoom(state, args.roomId);
  const session = selectSession(state, args.sessionId);

  if (!room) {
    return {
      accepted: false,
      retryAfterMs: 5_000,
      reasons: ['Room does not exist.'],
      expiresAt: now,
    };
  }

  if (!session) {
    return {
      accepted: false,
      retryAfterMs: 5_000,
      reasons: ['Session does not exist.'],
      expiresAt: now,
    };
  }

  if (!room.allowedVisibleChannels.includes(args.channelId)) {
    return {
      accepted: false,
      retryAfterMs: 5_000,
      reasons: ['Channel is not allowed for room.'],
      expiresAt: now,
    };
  }

  const currentTyping = selectRoomTyping(state, args.roomId).find((item) => {
    return item.sessionId === args.sessionId && item.channelId === args.channelId;
  });

  if (currentTyping && Number(currentTyping.expiresAt) - Number(now) > context.runtime.ratePolicy.typingHeartbeatWindowMs / 2) {
    return {
      accepted: false,
      retryAfterMs: Math.max(0, Number(currentTyping.expiresAt) - Number(now) - Math.floor(context.runtime.ratePolicy.typingHeartbeatWindowMs / 2)),
      reasons: ['Typing heartbeat already active.'],
      expiresAt: currentTyping.expiresAt,
    };
  }

  return {
    accepted: true,
    retryAfterMs: 0,
    reasons: [],
    expiresAt: asUnixMs(Number(now) + context.runtime.ratePolicy.typingHeartbeatWindowMs),
  };
}

export function evaluateInvasionRate(
  context: ChatRatePolicyContext,
  state: ChatState,
  args: ChatInvasionRateRequest,
): ChatRateDecision {
  const now = args.now ?? asUnixMs(context.ports.clock.now());
  const room = selectRoom(state, args.roomId);

  if (!room) {
    return rejectRate('LOCK', 10_000, ['Room does not exist.']);
  }

  if (!context.runtime.invasionPolicy.enabled) {
    return rejectRate('LOCK', 60_000, ['Invasions are disabled in runtime configuration.']);
  }

  const active = getActiveRoomInvasions(state, args.roomId);
  if (active.length >= context.runtime.invasionPolicy.maxActivePerRoom) {
    const closesAt = active
      .map((item) => Number(item.closesAt))
      .sort((a, b) => a - b)[0] ?? Number(now) + context.runtime.invasionPolicy.defaultDurationMs;
    return rejectRate('DEFER', Math.max(0, closesAt - Number(now)), ['Room already has maximum active invasions.']);
  }

  const latestRelevant = active
    .map((item) => item.openedAt)
    .sort((a, b) => Number(b) - Number(a))[0] ?? null;

  if (latestRelevant && Number(now) - Number(latestRelevant) < context.runtime.invasionPolicy.minimumGapMs) {
    return rejectRate(
      'DEFER',
      context.runtime.invasionPolicy.minimumGapMs - (Number(now) - Number(latestRelevant)),
      ['Invasion minimum gap has not elapsed.'],
    );
  }

  if (args.shadowPriming && !context.runtime.invasionPolicy.allowShadowPriming) {
    return rejectRate('LOCK', context.runtime.invasionPolicy.minimumGapMs, ['Shadow priming is disabled.']);
  }

  return allowRate();
}

// ============================================================================
// MARK: Cadence and diagnostic selection
// ============================================================================

export function buildCadenceSnapshot(
  state: ChatState,
  roomId: ChatRoomId,
): ChatCadenceSnapshot {
  const transcript = selectRoomTranscript(state, roomId);

  let roomLastMessageAt: UnixMs | null = null;
  let helperLastMessageAt: UnixMs | null = null;
  let haterLastMessageAt: UnixMs | null = null;
  let ambientLastMessageAt: UnixMs | null = null;
  const playerLastMessageBySession: Record<string, UnixMs | null> = {};

  for (const entry of transcript) {
    const message = entry.message;
    roomLastMessageAt = message.createdAt;

    if (message.attribution.sourceType === 'PLAYER' && message.attribution.authorSessionId) {
      playerLastMessageBySession[message.attribution.authorSessionId] = message.createdAt;
    }

    if (message.attribution.npcRole === 'HELPER') {
      helperLastMessageAt = message.createdAt;
    } else if (message.attribution.npcRole === 'HATER') {
      haterLastMessageAt = message.createdAt;
    } else if (message.attribution.npcRole === 'AMBIENT') {
      ambientLastMessageAt = message.createdAt;
    }
  }

  return {
    roomId,
    roomLastMessageAt,
    helperLastMessageAt,
    haterLastMessageAt,
    ambientLastMessageAt,
    playerLastMessageBySession: playerLastMessageBySession as ChatCadenceSnapshot['playerLastMessageBySession'],
  };
}

export function buildActorCadenceStats(
  state: ChatState,
  roomId: ChatRoomId,
  actorId: string,
): ChatActorCadenceStats {
  const transcript = selectRoomTranscript(state, roomId)
    .map((entry) => entry.message)
    .filter((message) => message.attribution.actorId === actorId);

  let lastMessageAt: UnixMs | null = null;
  const gaps: number[] = [];
  let previous: ChatMessage | null = null;

  for (const message of transcript) {
    lastMessageAt = message.createdAt;
    if (previous) {
      gaps.push(Number(message.createdAt) - Number(previous.createdAt));
    }
    previous = message;
  }

  const now = Date.now();
  const lastSecond = transcript.filter((message) => now - Number(message.createdAt) <= 1_000).length;
  const lastTenSeconds = transcript.filter((message) => now - Number(message.createdAt) <= 10_000).length;
  const lastMinute = transcript.filter((message) => now - Number(message.createdAt) <= 60_000).length;

  return {
    roomId,
    actorId,
    npcRole: transcript[0]?.attribution.npcRole ?? null,
    totalMessages: transcript.length,
    messagesInLastSecond: lastSecond,
    messagesInLastTenSeconds: lastTenSeconds,
    messagesInLastMinute: lastMinute,
    lastMessageAt,
    meanGapMs: gaps.length > 0 ? Math.floor(gaps.reduce((sum, value) => sum + value, 0) / gaps.length) : 0,
    shortestGapMs: gaps.length > 0 ? Math.min(...gaps) : null,
    longestGapMs: gaps.length > 0 ? Math.max(...gaps) : null,
  };
}

export function buildPlayerRateDiagnostic(
  context: ChatRatePolicyContext,
  state: ChatState,
  args: ChatPlayerRateRequest,
): ChatRateDiagnostic {
  const now = args.now ?? asUnixMs(context.ports.clock.now());
  const decision = evaluatePlayerRate(context, state, args);
  const room = selectRoom(state, args.roomId);
  const session = selectSession(state, args.sessionId);
  const stats = buildWindowStatsForSession(
    state,
    args.roomId,
    session?.identity.sessionId ?? null,
    session ? `user:${session.identity.userId}` : null,
    args.request.text,
    now,
  );

  return {
    accepted: decision.outcome === 'ALLOW',
    outcome: decision.outcome,
    retryAfterMs: decision.retryAfterMs,
    reasons: decision.reasons,
    stats,
    metadata: {
      roomExists: Boolean(room),
      sessionExists: Boolean(session),
      channelId: args.request.channelId,
      requestedLength: args.request.text.length,
    },
  };
}

export function buildNpcRateDiagnostic(
  context: ChatRatePolicyContext,
  state: ChatState,
  args: ChatNpcRateRequest,
): ChatRateDiagnostic {
  const now = args.now ?? asUnixMs(context.ports.clock.now());
  const decision = evaluateNpcRate(context, state, args);
  const stats = buildWindowStatsForActor(state, args.roomId, args.actorId, args.text, now);

  return {
    accepted: decision.outcome === 'ALLOW',
    outcome: decision.outcome,
    retryAfterMs: decision.retryAfterMs,
    reasons: decision.reasons,
    stats,
    metadata: {
      role: args.role,
      personaId: args.personaId ?? null,
      botId: args.botId ?? null,
      channelId: args.channelId,
      textLength: args.text.length,
    },
  };
}

// ============================================================================
// MARK: Session and room gates
// ============================================================================

export function evaluateConnectionGate(
  state: ChatConnectionState,
): ChatRateDecision | null {
  switch (state) {
    case 'ATTACHED':
      return null;
    case 'RECONNECTING':
      return rejectRate('DEFER', 1_000, ['Session is reconnecting.']);
    case 'DETACHED':
      return rejectRate('LOCK', 5_000, ['Session is detached.']);
    case 'DISCONNECTED':
      return rejectRate('LOCK', 10_000, ['Session is disconnected.']);
    case 'SUSPENDED':
      return rejectRate('LOCK', 30_000, ['Session is suspended.']);
    default:
      return rejectRate('LOCK', 10_000, ['Unknown connection state.']);
  }
}

export function evaluateVisibleChannelMembership(
  room: ChatRoomState,
  channelId: ChatVisibleChannel,
): ChatRateDecision | null {
  if (!room.allowedVisibleChannels.includes(channelId)) {
    return rejectRate('LOCK', 10_000, ['Visible channel is not allowed for room.']);
  }
  return null;
}

// ============================================================================
// MARK: Player rate gates
// ============================================================================

export function evaluatePlayerBurstWindows(
  context: ChatRatePolicyContext,
  state: ChatState,
  room: ChatRoomState,
  session: ChatSessionState,
  submittedText: string,
  now: UnixMs,
): ChatRateDecision {
  const transcript = selectRoomTranscript(state, room.roomId);
  const authored = transcript.filter((entry) => {
    return entry.message.attribution.authorSessionId === session.identity.sessionId;
  });

  const lastSecond = authored.filter((entry) => {
    return Number(now) - Number(entry.message.createdAt) <= 1_000;
  });

  const lastMinute = authored.filter((entry) => {
    return Number(now) - Number(entry.message.createdAt) <= 60_000;
  });

  if (lastSecond.length >= context.runtime.ratePolicy.perSecondBurstLimit) {
    const retryAfterMs = computeBurstRetryAfter(lastSecond, now, 1_000);
    return rejectRate('THROTTLE', retryAfterMs, ['Per-second burst limit exceeded.']);
  }

  if (lastMinute.length >= context.runtime.ratePolicy.perMinuteLimit) {
    const retryAfterMs = computeBurstRetryAfter(lastMinute, now, 60_000);
    return rejectRate('THROTTLE', retryAfterMs, ['Per-minute message limit exceeded.']);
  }

  const latest = authored[authored.length - 1]?.message ?? null;
  if (latest && normalizeText(latest.plainText) === normalizeText(submittedText) && Number(now) - Number(latest.createdAt) <= 500) {
    return rejectRate('DEFER', 500 - (Number(now) - Number(latest.createdAt)), ['Immediate duplicate submit detected.']);
  }

  return allowRate();
}

export function evaluatePlayerRepetitionGate(
  context: ChatRatePolicyContext,
  state: ChatState,
  room: ChatRoomState,
  session: ChatSessionState,
  submittedText: string,
  now: UnixMs,
): ChatRateDecision {
  const transcript = selectRoomTranscript(state, room.roomId);
  const normalized = normalizeText(submittedText);
  const repeated = transcript.filter((entry) => {
    return (
      entry.message.attribution.authorSessionId === session.identity.sessionId &&
      normalizeText(entry.message.plainText) === normalized &&
      Number(now) - Number(entry.message.createdAt) <= context.runtime.ratePolicy.identicalMessageWindowMs
    );
  });

  if (repeated.length >= context.runtime.ratePolicy.identicalMessageMaxCount) {
    const retryAfterMs = computeBurstRetryAfter(repeated, now, context.runtime.ratePolicy.identicalMessageWindowMs);
    return rejectRate('DEFER', retryAfterMs, ['Identical message repetition threshold exceeded.']);
  }

  return allowRate();
}

export function evaluatePlayerInvasionGate(
  context: ChatRatePolicyContext,
  state: ChatState,
  room: ChatRoomState,
  session: ChatSessionState,
  now: UnixMs,
): ChatRateDecision {
  const invasions = getActiveRoomInvasions(state, room.roomId);
  if (invasions.length === 0) {
    return allowRate();
  }

  const latestOpenedAt = invasions
    .map((item) => Number(item.openedAt))
    .sort((a, b) => b - a)[0] ?? 0;

  const elapsed = Number(now) - latestOpenedAt;
  if (elapsed < context.runtime.ratePolicy.invasionLockMs) {
    const visiblePresence = selectRoomPresence(state, room.roomId).find((presence) => {
      return presence.sessionId === session.identity.sessionId && presence.visibleToRoom;
    });

    if (!visiblePresence) {
      return rejectRate('DEFER', context.runtime.ratePolicy.invasionLockMs - elapsed, ['Player is not yet visibly seated in invasion-active room.']);
    }

    if (session.identity.role === 'SPECTATOR') {
      return rejectRate('DEFER', context.runtime.ratePolicy.invasionLockMs - elapsed, ['Spectators are temporarily suppressed during invasion lock.']);
    }
  }

  return allowRate();
}

export function evaluateRoomFloodGate(
  context: ChatRatePolicyContext,
  state: ChatState,
  room: ChatRoomState,
  now: UnixMs,
): ChatRateDecision {
  const transcript = selectRoomTranscript(state, room.roomId);
  const roomLastSecond = transcript.filter((entry) => {
    return Number(now) - Number(entry.message.createdAt) <= 1_000;
  });

  if (roomLastSecond.length >= context.runtime.ratePolicy.perSecondBurstLimit * 2) {
    return rejectRate('DEFER', 600, ['Room flood suppression engaged.']);
  }

  return allowRate();
}

// ============================================================================
// MARK: NPC rate gates
// ============================================================================

export function evaluateNpcInvasionGate(
  context: ChatRatePolicyContext,
  invasions: readonly ChatInvasionState[],
  args: ChatNpcRateRequest,
  now: UnixMs,
): ChatRateDecision {
  if (invasions.length === 0) {
    return allowRate();
  }

  const hasHelperBlackout = invasions.some((item) => item.kind === 'HELPER_BLACKOUT' && item.status !== 'RESOLVED');
  if (args.role === 'HELPER' && hasHelperBlackout) {
    return rejectRate('LOCK', 10_000, ['Helper blackout is active.']);
  }

  const hasRaid = invasions.some((item) => item.kind === 'HATER_RAID' && item.status !== 'RESOLVED');
  if (args.role === 'AMBIENT' && hasRaid) {
    return rejectRate('DEFER', 2_000, ['Ambient chatter is suppressed during hater raid.']);
  }

  const activePriming = invasions.find((item) => item.status === 'PRIMING');
  if (activePriming && args.role !== 'HATER') {
    return rejectRate('DEFER', Math.max(500, Number(activePriming.closesAt) - Number(now)), ['Non-hater emissions are deferred during invasion priming.']);
  }

  return allowRate();
}

export function evaluateNpcCadenceGate(
  state: ChatState,
  roomId: ChatRoomId,
  actorId: string,
  role: ChatNpcRole,
  minimumGapMs: number,
  now: UnixMs,
): ChatRateDecision {
  const transcript = selectRoomTranscript(state, roomId);
  const authored = transcript
    .map((entry) => entry.message)
    .filter((message) => message.attribution.actorId === actorId);

  const latest = authored[authored.length - 1] ?? null;
  if (!latest) {
    return allowRate();
  }

  const elapsed = Number(now) - Number(latest.createdAt);
  if (elapsed < minimumGapMs) {
    return rejectRate('DEFER', minimumGapMs - elapsed, [`${role} minimum cadence gap has not elapsed.`]);
  }

  return allowRate();
}

export function evaluateNpcRepeatGate(
  state: ChatState,
  roomId: ChatRoomId,
  actorId: string,
  text: string,
  minimumGapMs: number,
  now: UnixMs,
): ChatRateDecision {
  const transcript = selectRoomTranscript(state, roomId)
    .map((entry) => entry.message)
    .filter((message) => message.attribution.actorId === actorId);

  const normalized = normalizeText(text);
  const repeated = transcript.filter((message) => {
    return normalizeText(message.plainText) === normalized && Number(now) - Number(message.createdAt) <= minimumGapMs * 2;
  });

  if (repeated.length > 0) {
    const latest = repeated[repeated.length - 1]!;
    const elapsed = Number(now) - Number(latest.createdAt);
    const retry = Math.max(250, minimumGapMs * 2 - elapsed);
    return rejectRate('DEFER', retry, ['NPC repeated same line too recently.']);
  }

  return allowRate();
}

export function evaluateNpcCrowdingGate(
  state: ChatState,
  roomId: ChatRoomId,
  role: ChatNpcRole,
  now: UnixMs,
): ChatRateDecision {
  const transcript = selectRoomTranscript(state, roomId).map((entry) => entry.message);
  const recentNpc = transcript.filter((message) => {
    return message.attribution.npcRole !== null && Number(now) - Number(message.createdAt) <= 1_500;
  });

  const recentSameRole = recentNpc.filter((message) => message.attribution.npcRole === role);

  if (recentNpc.length >= 3) {
    return rejectRate('DEFER', 600, ['NPC crowding suppression engaged.']);
  }

  if (recentSameRole.length >= 2) {
    return rejectRate('DEFER', 900, ['Same-role NPC crowding suppression engaged.']);
  }

  return allowRate();
}

export function evaluateHaterHostileSpacing(
  context: ChatRatePolicyContext,
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
): ChatRateDecision {
  const transcript = selectRoomTranscript(state, roomId).map((entry) => entry.message);
  const recentHaters = transcript.filter((message) => {
    return message.attribution.npcRole === 'HATER' && Number(now) - Number(message.createdAt) <= context.runtime.ratePolicy.haterMinimumGapMs;
  });

  if (recentHaters.length > 0) {
    const latest = recentHaters[recentHaters.length - 1]!;
    const elapsed = Number(now) - Number(latest.createdAt);
    return rejectRate('DEFER', Math.max(200, context.runtime.ratePolicy.haterMinimumGapMs - elapsed), ['Hater minimum gap has not elapsed.']);
  }

  return allowRate();
}

export function evaluateHelperSpacing(
  context: ChatRatePolicyContext,
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
): ChatRateDecision {
  const transcript = selectRoomTranscript(state, roomId).map((entry) => entry.message);
  const recentHelpers = transcript.filter((message) => {
    return message.attribution.npcRole === 'HELPER' && Number(now) - Number(message.createdAt) <= context.runtime.ratePolicy.helperMinimumGapMs;
  });

  if (recentHelpers.length > 0) {
    const latest = recentHelpers[recentHelpers.length - 1]!;
    const elapsed = Number(now) - Number(latest.createdAt);
    return rejectRate('DEFER', Math.max(200, context.runtime.ratePolicy.helperMinimumGapMs - elapsed), ['Helper minimum gap has not elapsed.']);
  }

  return allowRate();
}

// ============================================================================
// MARK: Selection, windows, and statistics
// ============================================================================

export function buildWindowStatsForSession(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId | null,
  actorId: string | null,
  submittedText: string,
  now: UnixMs,
): ChatRateWindowStats {
  const transcript = selectRoomTranscript(state, roomId);
  const authored = transcript.filter((entry) => {
    return sessionId ? entry.message.attribution.authorSessionId === sessionId : false;
  });

  const actorMessages = transcript.filter((entry) => {
    return actorId ? entry.message.attribution.actorId === actorId : false;
  });

  const messagesInLastSecond = authored.filter((entry) => Number(now) - Number(entry.message.createdAt) <= 1_000).length;
  const messagesInLastMinute = authored.filter((entry) => Number(now) - Number(entry.message.createdAt) <= 60_000).length;
  const identicalMessagesInWindow = authored.filter((entry) => {
    return normalizeText(entry.message.plainText) === normalizeText(submittedText) &&
      Number(now) - Number(entry.message.createdAt) <= state.runtime.ratePolicy.identicalMessageWindowMs;
  }).length;

  const latestActorMessageAt = actorMessages.length > 0 ? actorMessages[actorMessages.length - 1]!.message.createdAt : null;
  const latestRoomMessageAt = transcript.length > 0 ? transcript[transcript.length - 1]!.message.createdAt : null;
  const activeInvasionCount = getActiveRoomInvasions(state, roomId).length;

  return {
    roomId,
    sessionId,
    actorId,
    messagesInLastSecond,
    messagesInLastMinute,
    identicalMessagesInWindow,
    latestActorMessageAt,
    latestRoomMessageAt,
    activeInvasionCount,
    roomSilenced: isRoomSilenced(state, roomId, now),
  };
}

export function buildWindowStatsForActor(
  state: ChatState,
  roomId: ChatRoomId,
  actorId: string,
  submittedText: string,
  now: UnixMs,
): ChatRateWindowStats {
  const transcript = selectRoomTranscript(state, roomId);
  const actorEntries = transcript.filter((entry) => entry.message.attribution.actorId === actorId);

  return {
    roomId,
    sessionId: actorEntries[0]?.message.attribution.authorSessionId ?? null,
    actorId,
    messagesInLastSecond: actorEntries.filter((entry) => Number(now) - Number(entry.message.createdAt) <= 1_000).length,
    messagesInLastMinute: actorEntries.filter((entry) => Number(now) - Number(entry.message.createdAt) <= 60_000).length,
    identicalMessagesInWindow: actorEntries.filter((entry) => {
      return normalizeText(entry.message.plainText) === normalizeText(submittedText) &&
        Number(now) - Number(entry.message.createdAt) <= state.runtime.ratePolicy.identicalMessageWindowMs;
    }).length,
    latestActorMessageAt: actorEntries.length > 0 ? actorEntries[actorEntries.length - 1]!.message.createdAt : null,
    latestRoomMessageAt: transcript.length > 0 ? transcript[transcript.length - 1]!.message.createdAt : null,
    activeInvasionCount: getActiveRoomInvasions(state, roomId).length,
    roomSilenced: isRoomSilenced(state, roomId, now),
  };
}

export function selectRecentMessagesForSession(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
  windowMs: number,
  now: UnixMs,
): readonly ChatMessage[] {
  return selectRoomTranscript(state, roomId)
    .map((entry) => entry.message)
    .filter((message) => {
      return (
        message.attribution.authorSessionId === sessionId &&
        Number(now) - Number(message.createdAt) <= windowMs
      );
    });
}

export function selectRecentMessagesForActor(
  state: ChatState,
  roomId: ChatRoomId,
  actorId: string,
  windowMs: number,
  now: UnixMs,
): readonly ChatMessage[] {
  return selectRoomTranscript(state, roomId)
    .map((entry) => entry.message)
    .filter((message) => {
      return (
        message.attribution.actorId === actorId &&
        Number(now) - Number(message.createdAt) <= windowMs
      );
    });
}

export function selectRecentNpcMessagesByRole(
  state: ChatState,
  roomId: ChatRoomId,
  role: ChatNpcRole,
  windowMs: number,
  now: UnixMs,
): readonly ChatMessage[] {
  return selectRoomTranscript(state, roomId)
    .map((entry) => entry.message)
    .filter((message) => {
      return (
        message.attribution.npcRole === role &&
        Number(now) - Number(message.createdAt) <= windowMs
      );
    });
}

export function selectActiveVisibleOccupants(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatPresenceSnapshot[] {
  return selectRoomPresence(state, roomId).filter((presence) => presence.visibleToRoom);
}

// ============================================================================
// MARK: Policy helpers and explanation
// ============================================================================

export function minimumGapForNpcRole(
  runtime: ChatRuntimeConfig,
  role: ChatNpcRole,
): number {
  switch (role) {
    case 'HELPER':
      return runtime.ratePolicy.helperMinimumGapMs;
    case 'HATER':
      return runtime.ratePolicy.haterMinimumGapMs;
    case 'AMBIENT':
      return runtime.ratePolicy.npcMinimumGapMs;
    default:
      return runtime.ratePolicy.npcMinimumGapMs;
  }
}

export function explainPlayerRateDecision(
  context: ChatRatePolicyContext,
  state: ChatState,
  args: ChatPlayerRateRequest,
): string {
  const diagnostic = buildPlayerRateDiagnostic(context, state, args);
  if (diagnostic.accepted) {
    return 'ALLOW: player emission cleared backend cadence law.';
  }

  return `${diagnostic.outcome}: ${diagnostic.reasons.join(' ')}`;
}

export function explainNpcRateDecision(
  context: ChatRatePolicyContext,
  state: ChatState,
  args: ChatNpcRateRequest,
): string {
  const diagnostic = buildNpcRateDiagnostic(context, state, args);
  if (diagnostic.accepted) {
    return 'ALLOW: npc emission cleared backend cadence law.';
  }

  return `${diagnostic.outcome}: ${diagnostic.reasons.join(' ')}`;
}

export function createRateAuditRecord(
  roomId: ChatRoomId,
  actorId: string,
  decision: ChatRateDecision,
  createdAt: UnixMs,
  metadata: Readonly<Record<string, JsonValue>> = {},
): ChatRateAuditRecord {
  return {
    roomId,
    actorId,
    outcome: decision.outcome,
    createdAt,
    reasons: decision.reasons,
    metadata,
  };
}

// ============================================================================
// MARK: Rule packs for future extraction
// ============================================================================

export interface ChatRateRule {
  readonly name: string;
  applies(args: {
    readonly context: ChatRatePolicyContext;
    readonly state: ChatState;
    readonly room: ChatRoomState;
    readonly now: UnixMs;
  }): boolean;
  evaluate(args: {
    readonly context: ChatRatePolicyContext;
    readonly state: ChatState;
    readonly room: ChatRoomState;
    readonly now: UnixMs;
  }): ChatRateDecision;
}

export function createRoomFloodRule(): ChatRateRule {
  return {
    name: 'room_flood',
    applies: () => true,
    evaluate: ({ context, state, room, now }) => evaluateRoomFloodGate(context, state, room, now),
  };
}

export function createHelperSpacingRule(): ChatRateRule {
  return {
    name: 'helper_spacing',
    applies: () => true,
    evaluate: ({ context, state, room, now }) => evaluateHelperSpacing(context, state, room.roomId, now),
  };
}

export function createHaterSpacingRule(): ChatRateRule {
  return {
    name: 'hater_spacing',
    applies: () => true,
    evaluate: ({ context, state, room, now }) => evaluateHaterHostileSpacing(context, state, room.roomId, now),
  };
}

export function runRateRules(
  rules: readonly ChatRateRule[],
  args: {
    readonly context: ChatRatePolicyContext;
    readonly state: ChatState;
    readonly room: ChatRoomState;
    readonly now: UnixMs;
  },
): ChatRateDecision {
  for (const rule of rules) {
    if (!rule.applies(args)) {
      continue;
    }
    const decision = rule.evaluate(args);
    if (decision.outcome !== 'ALLOW') {
      return {
        outcome: decision.outcome,
        retryAfterMs: decision.retryAfterMs,
        reasons: [`${rule.name}: ${decision.reasons.join(' ')}`.trim()],
      };
    }
  }

  return allowRate();
}

// ============================================================================
// MARK: Bulk diagnostics
// ============================================================================

export function auditRoomCadence(
  context: ChatRatePolicyContext,
  state: ChatState,
  roomId: ChatRoomId,
): {
  readonly cadence: ChatCadenceSnapshot;
  readonly visibleOccupantCount: number;
  readonly activeTypingCount: number;
  readonly activeInvasionCount: number;
  readonly helperRecentCount: number;
  readonly haterRecentCount: number;
  readonly ambientRecentCount: number;
} {
  const now = asUnixMs(context.ports.clock.now());
  return {
    cadence: buildCadenceSnapshot(state, roomId),
    visibleOccupantCount: selectActiveVisibleOccupants(state, roomId).length,
    activeTypingCount: selectRoomTyping(state, roomId).length,
    activeInvasionCount: getActiveRoomInvasions(state, roomId).length,
    helperRecentCount: selectRecentNpcMessagesByRole(state, roomId, 'HELPER', context.runtime.ratePolicy.helperMinimumGapMs, now).length,
    haterRecentCount: selectRecentNpcMessagesByRole(state, roomId, 'HATER', context.runtime.ratePolicy.haterMinimumGapMs, now).length,
    ambientRecentCount: selectRecentNpcMessagesByRole(state, roomId, 'AMBIENT', context.runtime.ratePolicy.npcMinimumGapMs, now).length,
  };
}

export function auditAllRoomsCadence(
  context: ChatRatePolicyContext,
  state: ChatState,
): Readonly<Record<ChatRoomId, ReturnType<typeof auditRoomCadence>>> {
  const result: Record<string, ReturnType<typeof auditRoomCadence>> = {};
  for (const roomId of Object.keys(state.rooms)) {
    result[roomId] = auditRoomCadence(context, state, roomId as ChatRoomId);
  }
  return result as Readonly<Record<ChatRoomId, ReturnType<typeof auditRoomCadence>>>;
}

// ============================================================================
// MARK: Internal utility
// ============================================================================

function allowRate(): ChatRateDecision {
  return {
    outcome: 'ALLOW',
    retryAfterMs: 0,
    reasons: [],
  };
}

function rejectRate(
  outcome: Exclude<ChatRateOutcome, 'ALLOW'>,
  retryAfterMs: number,
  reasons: readonly string[],
): ChatRateDecision {
  return {
    outcome,
    retryAfterMs: Math.max(0, Math.floor(retryAfterMs)),
    reasons: [...reasons],
  };
}

function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function computeBurstRetryAfter(
  entries: readonly { readonly message: ChatMessage }[] | readonly ChatMessage[],
  now: UnixMs,
  windowMs: number,
): number {
  if (entries.length === 0) {
    return windowMs;
  }

  const firstCreatedAt =
    'message' in entries[0]
      ? Number((entries[0] as { readonly message: ChatMessage }).message.createdAt)
      : Number((entries[0] as ChatMessage).createdAt);

  const elapsed = Number(now) - firstCreatedAt;
  return Math.max(100, windowMs - elapsed);
}

// ============================================================================
// MARK: Session predicates
// ============================================================================

export interface ChatTemporalSessionArgs {
  readonly session: ChatSessionState;
  readonly now: UnixMs;
}

export function isSessionMuted(args: ChatTemporalSessionArgs): boolean {
  const { session, now } = args;
  return Boolean(session.mutedUntil && Number(session.mutedUntil) > Number(now));
}

export function isSessionShadowMuted(args: ChatTemporalSessionArgs): boolean {
  const { session, now } = args;
  return session.shadowMuted;
}

export function isSessionInvisible(args: ChatTemporalSessionArgs): boolean {
  const { session, now } = args;
  return session.invisible;
}

export function isSessionAttached(args: ChatTemporalSessionArgs): boolean {
  const { session, now } = args;
  return session.connectionState === 'ATTACHED';
}

export function isSessionReconnecting(args: ChatTemporalSessionArgs): boolean {
  const { session, now } = args;
  return session.connectionState === 'RECONNECTING';
}

export function isSessionDetached(args: ChatTemporalSessionArgs): boolean {
  const { session, now } = args;
  return session.connectionState === 'DETACHED';
}

export function isSessionDisconnected(args: ChatTemporalSessionArgs): boolean {
  const { session, now } = args;
  return session.connectionState === 'DISCONNECTED';
}

export function isSessionSuspended(args: ChatTemporalSessionArgs): boolean {
  const { session, now } = args;
  return session.connectionState === 'SUSPENDED';
}

// ============================================================================
// MARK: Occupancy and visibility predicates
// ============================================================================

export function roomHasVisibleOccupants(state: ChatState, roomId: ChatRoomId): boolean {
  return selectActiveVisibleOccupants(state, roomId).length > 0;
}

export function roomHasTypingActivity(state: ChatState, roomId: ChatRoomId): boolean {
  return selectRoomTyping(state, roomId).length > 0;
}

export function roomHasActiveInvasion(state: ChatState, roomId: ChatRoomId): boolean {
  return getActiveRoomInvasions(state, roomId).length > 0;
}

export function roomHasRecentPlayerSpeech(
  state: ChatState,
  roomId: ChatRoomId,
  windowMs: number,
  now: UnixMs,
): boolean {
  return selectRoomTranscript(state, roomId).some((entry) => {
    return (
      entry.message.attribution.sourceType === 'PLAYER' &&
      Number(now) - Number(entry.message.createdAt) <= windowMs
    );
  });
}

export function roomHasRecentNpcSpeech(
  state: ChatState,
  roomId: ChatRoomId,
  windowMs: number,
  now: UnixMs,
): boolean {
  return selectRoomTranscript(state, roomId).some((entry) => {
    return (
      entry.message.attribution.npcRole !== null &&
      Number(now) - Number(entry.message.createdAt) <= windowMs
    );
  });
}

// ============================================================================
// MARK: Window explainers
// ============================================================================

export function explainRecentHelperWindow(
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
  runtime: ChatRuntimeConfig,
): string {
  const windowMs = minimumGapForNpcRole(runtime, 'HELPER' as ChatNpcRole);
  const recent = selectRecentNpcMessagesByRole(state, roomId, 'HELPER' as ChatNpcRole, windowMs, now);
  if (recent.length === 0) {
    return 'HELPER window clear.';
  }

  const latest = recent[recent.length - 1]!;
  return `HELPER window occupied by ${latest.attribution.displayName} until approximately ${Math.max(0, windowMs - (Number(now) - Number(latest.createdAt)))}ms.`;
}

export function explainRecentHaterWindow(
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
  runtime: ChatRuntimeConfig,
): string {
  const windowMs = minimumGapForNpcRole(runtime, 'HATER' as ChatNpcRole);
  const recent = selectRecentNpcMessagesByRole(state, roomId, 'HATER' as ChatNpcRole, windowMs, now);
  if (recent.length === 0) {
    return 'HATER window clear.';
  }

  const latest = recent[recent.length - 1]!;
  return `HATER window occupied by ${latest.attribution.displayName} until approximately ${Math.max(0, windowMs - (Number(now) - Number(latest.createdAt)))}ms.`;
}

export function explainRecentAmbientWindow(
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
  runtime: ChatRuntimeConfig,
): string {
  const windowMs = minimumGapForNpcRole(runtime, 'AMBIENT' as ChatNpcRole);
  const recent = selectRecentNpcMessagesByRole(state, roomId, 'AMBIENT' as ChatNpcRole, windowMs, now);
  if (recent.length === 0) {
    return 'AMBIENT window clear.';
  }

  const latest = recent[recent.length - 1]!;
  return `AMBIENT window occupied by ${latest.attribution.displayName} until approximately ${Math.max(0, windowMs - (Number(now) - Number(latest.createdAt)))}ms.`;
}

// ============================================================================
// MARK: Channel-scoped audits
// ============================================================================

export function countMessagesByChannelInWindow(
  state: ChatState,
  roomId: ChatRoomId,
  channelId: string,
  windowMs: number,
  now: UnixMs,
): number {
  return selectRoomTranscript(state, roomId).filter((entry) => {
    return (
      entry.message.channelId === channelId &&
      Number(now) - Number(entry.message.createdAt) <= windowMs
    );
  }).length;
}

export function countMessagesBySourceTypeInWindow(
  state: ChatState,
  roomId: ChatRoomId,
  sourceType: ChatMessage['attribution']['sourceType'],
  windowMs: number,
  now: UnixMs,
): number {
  return selectRoomTranscript(state, roomId).filter((entry) => {
    return (
      entry.message.attribution.sourceType === sourceType &&
      Number(now) - Number(entry.message.createdAt) <= windowMs
    );
  }).length;
}

export function countMessagesByNpcRoleInWindow(
  state: ChatState,
  roomId: ChatRoomId,
  role: ChatNpcRole,
  windowMs: number,
  now: UnixMs,
): number {
  return selectRoomTranscript(state, roomId).filter((entry) => {
    return (
      entry.message.attribution.npcRole === role &&
      Number(now) - Number(entry.message.createdAt) <= windowMs
    );
  }).length;
}

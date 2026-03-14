
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SESSION STATE
 * FILE: backend/src/game/engine/chat/ChatSessionState.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend owner for session admission truth, room membership truth,
 * connection lifecycle, invisibility / shadow mute posture, transport metadata
 * reconciliation, and authoritative session projections consumed by the rest of
 * the backend chat lane.
 *
 * Backend-truth question
 * ----------------------
 *
 *   "Which chat sessions are real, attached, visible, muted, reconnecting, or
 *    expired right now, and how should that truth be mutated before presence,
 *    policy, or orchestration consume it?"
 *
 * Design doctrine
 * ---------------
 * - transport may propose attachment, but does not decide session truth;
 * - frontend may mirror session state, but does not decide session truth;
 * - reducer may apply accepted session mutations, but does not define
 *   lifecycle semantics by itself;
 * - presence is downstream of session truth, not a substitute for it;
 * - room membership indexes are part of authority, not view helpers;
 * - reconnect windows, mute posture, invisibility, and shadow posture belong
 *   to backend state and must remain replayable and auditable.
 *
 * This file therefore owns:
 * - session builders,
 * - session admission helpers,
 * - transport metadata normalization,
 * - room membership summaries,
 * - state wrappers around authoritative session mutation,
 * - visibility projections,
 * - maintenance sweeps for stale sessions,
 * - explainable diffs, diagnostics, and search helpers.
 *
 * It does not own:
 * - socket connection primitives,
 * - transcript mutation,
 * - moderation,
 * - rate decisions,
 * - NPC selection,
 * - invasion choreography,
 * - replay persistence.
 * ============================================================================
 */

import {
  asUnixMs,
  type ChatConnectionState,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomState,
  type ChatSessionId,
  type ChatSessionIdentity,
  type ChatSessionRole,
  type ChatSessionState as ChatSessionModel,
  type ChatState,
  type JsonValue,
  type Nullable,
  type UnixMs,
} from './types';
import {
  attachSessionToRoom,
  createChatSessionState,
  detachSessionFromRoom,
  removeSession,
  setSessionConnectionState,
  setSessionInvisible,
  setSessionMutedUntil,
  setSessionShadowMuted,
  upsertSession,
} from './ChatState';

// ============================================================================
// MARK: Logger, options, context
// ============================================================================

export interface ChatSessionStateLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatSessionStateOptions {
  readonly logger?: ChatSessionStateLoggerPort;
  readonly reconnectGraceMs?: number;
  readonly disconnectCullMs?: number;
  readonly detachedCullMs?: number;
  readonly transportMetadataKeyLimit?: number;
  readonly transportMetadataStringLimit?: number;
  readonly allowEmptyDisplayNameFallback?: boolean;
  readonly maintainRoomMembershipOnReconnect?: boolean;
  readonly invisibleSessionsRemainAttached?: boolean;
}

export interface ChatSessionStateContext {
  readonly logger: ChatSessionStateLoggerPort;
  readonly reconnectGraceMs: number;
  readonly disconnectCullMs: number;
  readonly detachedCullMs: number;
  readonly transportMetadataKeyLimit: number;
  readonly transportMetadataStringLimit: number;
  readonly allowEmptyDisplayNameFallback: boolean;
  readonly maintainRoomMembershipOnReconnect: boolean;
  readonly invisibleSessionsRemainAttached: boolean;
}

// ============================================================================
// MARK: Admission, diff, projection, and maintenance shapes
// ============================================================================

export interface ChatSessionAdmissionRequest {
  readonly identity: ChatSessionIdentity;
  readonly roomId: Nullable<ChatRoomId>;
  readonly roomKind: Nullable<ChatRoomKind>;
  readonly now: UnixMs;
  readonly transportMetadata?: Readonly<Record<string, JsonValue>>;
}

export interface ChatSessionAdmissionDecision {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly normalizedIdentity: ChatSessionIdentity;
  readonly normalizedTransportMetadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatSessionDiff {
  readonly sessionId: ChatSessionId;
  readonly before: Nullable<ChatSessionModel>;
  readonly after: Nullable<ChatSessionModel>;
  readonly changed: boolean;
  readonly changedFields: readonly string[];
}

export interface ChatRoomMembershipSummary {
  readonly roomId: ChatRoomId;
  readonly roomKind: Nullable<ChatRoomKind>;
  readonly totalSessions: number;
  readonly attachedSessions: number;
  readonly reconnectingSessions: number;
  readonly detachedSessions: number;
  readonly disconnectedSessions: number;
  readonly visibleSessions: number;
  readonly invisibleSessions: number;
  readonly shadowMutedSessions: number;
  readonly mutedSessions: number;
  readonly players: number;
  readonly moderators: number;
  readonly systems: number;
  readonly actorLabels: readonly string[];
  readonly visibleActorLabels: readonly string[];
  readonly hiddenActorLabels: readonly string[];
}

export interface ChatSessionMaintenanceRecord {
  readonly sessionId: ChatSessionId;
  readonly action:
    | 'PRESERVED'
    | 'STATE_CHANGED'
    | 'MUTE_EXPIRED'
    | 'CULLED_DISCONNECTED'
    | 'CULLED_DETACHED'
    | 'DOWNGRADED_TO_RECONNECTING';
  readonly before: Nullable<ChatSessionModel>;
  readonly after: Nullable<ChatSessionModel>;
  readonly reason: string;
}

export interface ChatSessionMaintenanceReport {
  readonly records: readonly ChatSessionMaintenanceRecord[];
  readonly touchedSessionIds: readonly ChatSessionId[];
  readonly removedSessionIds: readonly ChatSessionId[];
  readonly changedSessionIds: readonly ChatSessionId[];
}

export interface ChatSessionSearchCriteria {
  readonly roomId?: ChatRoomId;
  readonly userId?: string;
  readonly role?: ChatSessionRole;
  readonly includeInvisible?: boolean;
  readonly includeShadowMuted?: boolean;
  readonly connectionStates?: readonly ChatConnectionState[];
}

export interface ChatSessionVisibilityProjection {
  readonly session: ChatSessionModel;
  readonly visibleToRoom: boolean;
  readonly visibleToModeration: boolean;
  readonly visibleActorLabel: Nullable<string>;
  readonly hiddenReason: Nullable<string>;
}

export interface ChatSessionTransportMergeArgs {
  readonly previous: Readonly<Record<string, JsonValue>>;
  readonly next?: Readonly<Record<string, JsonValue>>;
  readonly context: ChatSessionStateContext;
}

export interface CreateAuthoritativeSessionArgs {
  readonly identity: ChatSessionIdentity;
  readonly now: UnixMs;
  readonly transportMetadata?: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Authority façade
// ============================================================================

export class ChatSessionAuthority {
  private readonly context: ChatSessionStateContext;

  constructor(options: ChatSessionStateOptions = {}) {
    this.context = createSessionContext(options);
  }

  contextValue(): ChatSessionStateContext {
    return this.context;
  }

  admit(request: ChatSessionAdmissionRequest): ChatSessionAdmissionDecision {
    return admitSessionRequest(request, this.context);
  }

  create(args: CreateAuthoritativeSessionArgs): ChatSessionModel {
    return createAuthoritativeChatSessionState({
      identity: args.identity,
      now: args.now,
      transportMetadata: args.transportMetadata,
      context: this.context,
    });
  }

  upsert(state: ChatState, session: ChatSessionModel): ChatState {
    return upsertAuthoritativeSession(state, session);
  }

  remove(state: ChatState, sessionId: ChatSessionId): ChatState {
    return removeAuthoritativeSession(state, sessionId);
  }

  attachRoom(state: ChatState, roomId: ChatRoomId, sessionId: ChatSessionId): ChatState {
    return attachAuthoritativeSessionToRoom(state, roomId, sessionId);
  }

  detachRoom(state: ChatState, roomId: ChatRoomId, sessionId: ChatSessionId): ChatState {
    return detachAuthoritativeSessionFromRoom(state, roomId, sessionId);
  }

  noteSeen(state: ChatState, sessionId: ChatSessionId, now: UnixMs): ChatState {
    return touchSessionLastSeen(state, sessionId, now);
  }

  setConnection(state: ChatState, sessionId: ChatSessionId, connectionState: ChatConnectionState, now: UnixMs): ChatState {
    return setAuthoritativeSessionConnectionState(state, sessionId, connectionState, now);
  }

  setMutedUntil(state: ChatState, sessionId: ChatSessionId, mutedUntil: Nullable<UnixMs>): ChatState {
    return setAuthoritativeSessionMutedUntil(state, sessionId, mutedUntil);
  }

  setShadowMuted(state: ChatState, sessionId: ChatSessionId, shadowMuted: boolean): ChatState {
    return setAuthoritativeSessionShadowMuted(state, sessionId, shadowMuted);
  }

  setInvisible(state: ChatState, sessionId: ChatSessionId, invisible: boolean): ChatState {
    return setAuthoritativeSessionInvisible(state, sessionId, invisible);
  }

  mergeTransportMetadata(
    session: ChatSessionModel,
    nextMetadata: Readonly<Record<string, JsonValue>> | undefined,
  ): ChatSessionModel {
    return mergeSessionTransportMetadata(session, nextMetadata, this.context);
  }

  visibleForRoom(
    state: ChatState,
    roomId: ChatRoomId,
    includeInvisible = false,
  ): readonly ChatSessionVisibilityProjection[] {
    return projectVisibleSessionsForRoom(state, roomId, includeInvisible);
  }

  summarizeRoom(state: ChatState, roomId: ChatRoomId): ChatRoomMembershipSummary {
    return summarizeRoomMembership(state, roomId);
  }

  search(state: ChatState, criteria: ChatSessionSearchCriteria): readonly ChatSessionModel[] {
    return searchSessions(state, criteria);
  }

  maintenance(state: ChatState, now: UnixMs): { state: ChatState; report: ChatSessionMaintenanceReport } {
    return sweepSessionMaintenance(state, now, this.context);
  }
}

export function createSessionAuthority(options: ChatSessionStateOptions = {}): ChatSessionAuthority {
  return new ChatSessionAuthority(options);
}

// ============================================================================
// MARK: Context and logger
// ============================================================================

export function createSessionContext(options: ChatSessionStateOptions = {}): ChatSessionStateContext {
  return Object.freeze({
    logger: options.logger ?? createDefaultSessionLogger(),
    reconnectGraceMs: Math.max(1_000, options.reconnectGraceMs ?? 20_000),
    disconnectCullMs: Math.max(10_000, options.disconnectCullMs ?? 90_000),
    detachedCullMs: Math.max(10_000, options.detachedCullMs ?? 60_000),
    transportMetadataKeyLimit: Math.max(4, options.transportMetadataKeyLimit ?? 24),
    transportMetadataStringLimit: Math.max(16, options.transportMetadataStringLimit ?? 320),
    allowEmptyDisplayNameFallback: options.allowEmptyDisplayNameFallback ?? true,
    maintainRoomMembershipOnReconnect: options.maintainRoomMembershipOnReconnect ?? true,
    invisibleSessionsRemainAttached: options.invisibleSessionsRemainAttached ?? true,
  });
}

export function createDefaultSessionLogger(): ChatSessionStateLoggerPort {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

// ============================================================================
// MARK: Admission and normalization
// ============================================================================

export function admitSessionRequest(
  request: ChatSessionAdmissionRequest,
  context: ChatSessionStateContext,
): ChatSessionAdmissionDecision {
  const reasons: string[] = [];
  const normalizedIdentity = normalizeSessionIdentity(request.identity, context);
  const normalizedTransportMetadata = normalizeTransportMetadata(request.transportMetadata, context);

  if (!normalizedIdentity.sessionId) {
    reasons.push('session id is required');
  }

  if (!normalizedIdentity.userId) {
    reasons.push('user id is required');
  }

  if (!normalizedIdentity.displayName.trim()) {
    reasons.push('display name cannot be blank after normalization');
  }

  if (request.roomKind === 'SYSTEM' && normalizedIdentity.role === 'PLAYER') {
    reasons.push('player sessions cannot directly admit into SYSTEM rooms');
  }

  if (request.roomKind === 'PRIVATE' && normalizedIdentity.role === 'SYSTEM') {
    reasons.push('system sessions cannot directly admit into PRIVATE rooms');
  }

  if (normalizedTransportMetadata['__overflow_trimmed'] === true) {
    context.logger.warn('transport metadata exceeded limit and was trimmed', {
      sessionId: stringifySessionId(normalizedIdentity.sessionId),
      userId: stringifyUserId(normalizedIdentity.userId),
    });
  }

  return {
    accepted: reasons.length === 0,
    reasons: Object.freeze(reasons),
    normalizedIdentity,
    normalizedTransportMetadata,
  };
}

export function normalizeSessionIdentity(
  identity: ChatSessionIdentity,
  context: ChatSessionStateContext,
): ChatSessionIdentity {
  const displayName = normalizeDisplayName(identity.displayName, context);
  const entitlementTier = normalizeNullableString(identity.entitlementTier);
  const factionId = normalizeNullableString(identity.factionId);

  return {
    sessionId: identity.sessionId,
    userId: identity.userId,
    displayName,
    role: normalizeSessionRole(identity.role),
    entitlementTier,
    factionId,
  };
}

export function normalizeSessionRole(role: ChatSessionRole): ChatSessionRole {
  switch (role) {
    case 'PLAYER':
    case 'MODERATOR':
    case 'SYSTEM':
      return role;
    default:
      return 'PLAYER';
  }
}

export function normalizeDisplayName(
  input: string,
  context: ChatSessionStateContext,
): string {
  const trimmed = input.replace(/\s+/g, ' ').trim();
  if (trimmed.length > 0) {
    return trimmed.slice(0, 64);
  }
  return context.allowEmptyDisplayNameFallback ? 'Unknown Operator' : '';
}

export function normalizeNullableString(value: Nullable<string>): Nullable<string> {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 128) : null;
}

export function normalizeTransportMetadata(
  metadata: Readonly<Record<string, JsonValue>> | undefined,
  context: ChatSessionStateContext,
): Readonly<Record<string, JsonValue>> {
  if (!metadata) {
    return Object.freeze({});
  }

  const next: Record<string, JsonValue> = {};
  const entries = Object.entries(metadata).slice(0, context.transportMetadataKeyLimit);
  const overflowed = Object.keys(metadata).length > entries.length;

  for (const [key, value] of entries) {
    const normalizedKey = key.trim().slice(0, 64);
    if (!normalizedKey) {
      continue;
    }
    next[normalizedKey] = normalizeTransportJsonValue(value, context.transportMetadataStringLimit, 0);
  }

  if (overflowed) {
    next['__overflow_trimmed'] = true;
  }

  return Object.freeze(next);
}

function normalizeTransportJsonValue(value: JsonValue, stringLimit: number, depth: number): JsonValue {
  if (depth > 3) {
    return '[depth-trimmed]';
  }

  if (value == null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return value.slice(0, stringLimit);
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 16).map((item) => normalizeTransportJsonValue(item, stringLimit, depth + 1))) as JsonValue;
  }

  const next: Record<string, JsonValue> = {};
  for (const [key, inner] of Object.entries(value).slice(0, 16)) {
    next[key.slice(0, 64)] = normalizeTransportJsonValue(inner, stringLimit, depth + 1);
  }
  return Object.freeze(next);
}

// ============================================================================
// MARK: Session creation and transport metadata merge
// ============================================================================

export function createAuthoritativeChatSessionState(args: {
  readonly identity: ChatSessionIdentity;
  readonly now: UnixMs;
  readonly transportMetadata?: Readonly<Record<string, JsonValue>>;
  readonly context: ChatSessionStateContext;
}): ChatSessionModel {
  return createChatSessionState({
    identity: normalizeSessionIdentity(args.identity, args.context),
    now: args.now,
    transportMetadata: normalizeTransportMetadata(args.transportMetadata, args.context),
  });
}

export function mergeSessionTransportMetadata(
  session: ChatSessionModel,
  nextMetadata: Readonly<Record<string, JsonValue>> | undefined,
  context: ChatSessionStateContext,
): ChatSessionModel {
  const merged = mergeTransportMetadata({
    previous: session.transportMetadata,
    next: nextMetadata,
    context,
  });

  if (shallowJsonRecordEqual(merged, session.transportMetadata)) {
    return session;
  }

  return {
    ...session,
    transportMetadata: merged,
  };
}

export function mergeTransportMetadata(args: ChatSessionTransportMergeArgs): Readonly<Record<string, JsonValue>> {
  const previous = normalizeTransportMetadata(args.previous, args.context);
  const incoming = normalizeTransportMetadata(args.next, args.context);

  const next: Record<string, JsonValue> = {
    ...previous,
    ...incoming,
  };

  return Object.freeze(next);
}

// ============================================================================
// MARK: Selectors, search, and projection
// ============================================================================

export function getSession(state: ChatState, sessionId: ChatSessionId): Nullable<ChatSessionModel> {
  return state.sessions[sessionId] ?? null;
}

export function hasSession(state: ChatState, sessionId: ChatSessionId): boolean {
  return Boolean(state.sessions[sessionId]);
}

export function isSessionAttachedToRoom(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): boolean {
  return (state.roomSessions.byRoom[roomId] ?? []).includes(sessionId);
}

export function getRoomSessionIds(state: ChatState, roomId: ChatRoomId): readonly ChatSessionId[] {
  return state.roomSessions.byRoom[roomId] ?? [];
}

export function getSessionRoomIds(state: ChatState, sessionId: ChatSessionId): readonly ChatRoomId[] {
  return state.roomSessions.bySession[sessionId] ?? [];
}

export function getSessionsForRoom(state: ChatState, roomId: ChatRoomId): readonly ChatSessionModel[] {
  return getRoomSessionIds(state, roomId)
    .map((sessionId) => state.sessions[sessionId])
    .filter((value): value is ChatSessionModel => Boolean(value));
}

export function getVisibleSessionsForRoom(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatSessionModel[] {
  return getSessionsForRoom(state, roomId).filter((session) => !session.invisible);
}

export function getAttachedSessions(state: ChatState): readonly ChatSessionModel[] {
  return Object.values(state.sessions).filter((session) => session.connectionState === 'ATTACHED');
}

export function getReconnectingSessions(state: ChatState): readonly ChatSessionModel[] {
  return Object.values(state.sessions).filter((session) => session.connectionState === 'RECONNECTING');
}

export function getDisconnectedSessions(state: ChatState): readonly ChatSessionModel[] {
  return Object.values(state.sessions).filter((session) => session.connectionState === 'DISCONNECTED');
}

export function searchSessions(
  state: ChatState,
  criteria: ChatSessionSearchCriteria,
): readonly ChatSessionModel[] {
  const allowedStates = criteria.connectionStates ? new Set(criteria.connectionStates) : null;

  return Object.values(state.sessions).filter((session) => {
    if (criteria.roomId && !isSessionAttachedToRoom(state, criteria.roomId, session.identity.sessionId)) {
      return false;
    }
    if (criteria.userId && session.identity.userId !== (criteria.userId as typeof session.identity.userId)) {
      return false;
    }
    if (criteria.role && session.identity.role !== criteria.role) {
      return false;
    }
    if (!criteria.includeInvisible && session.invisible) {
      return false;
    }
    if (!criteria.includeShadowMuted && session.shadowMuted) {
      return false;
    }
    if (allowedStates && !allowedStates.has(session.connectionState)) {
      return false;
    }
    return true;
  });
}

export function projectVisibleSessionsForRoom(
  state: ChatState,
  roomId: ChatRoomId,
  includeInvisible = false,
): readonly ChatSessionVisibilityProjection[] {
  const sessions = getSessionsForRoom(state, roomId);
  return Object.freeze(
    sessions
      .filter((session) => includeInvisible || !session.invisible)
      .map((session) => projectSessionVisibility(session)),
  );
}

export function projectSessionVisibility(session: ChatSessionModel): ChatSessionVisibilityProjection {
  const visibleToRoom = !session.invisible && !session.shadowMuted && session.connectionState !== 'DETACHED';
  const hiddenReason =
    session.invisible
      ? 'session is marked invisible'
      : session.shadowMuted
        ? 'session is shadow muted'
        : session.connectionState === 'DETACHED'
          ? 'session is detached'
          : null;

  return {
    session,
    visibleToRoom,
    visibleToModeration: true,
    visibleActorLabel: visibleToRoom ? session.identity.displayName : null,
    hiddenReason,
  };
}

// ============================================================================
// MARK: Room membership summaries and diffs
// ============================================================================

export function summarizeRoomMembership(state: ChatState, roomId: ChatRoomId): ChatRoomMembershipSummary {
  const room = state.rooms[roomId] ?? null;
  const sessions = getSessionsForRoom(state, roomId);

  const actorLabels = sessions.map((session) => session.identity.displayName);
  const visibleActorLabels = sessions.filter((session) => !session.invisible).map((session) => session.identity.displayName);
  const hiddenActorLabels = sessions.filter((session) => session.invisible).map((session) => session.identity.displayName);

  return {
    roomId,
    roomKind: room?.roomKind ?? null,
    totalSessions: sessions.length,
    attachedSessions: sessions.filter((session) => session.connectionState === 'ATTACHED').length,
    reconnectingSessions: sessions.filter((session) => session.connectionState === 'RECONNECTING').length,
    detachedSessions: sessions.filter((session) => session.connectionState === 'DETACHED').length,
    disconnectedSessions: sessions.filter((session) => session.connectionState === 'DISCONNECTED').length,
    visibleSessions: sessions.filter((session) => !session.invisible).length,
    invisibleSessions: sessions.filter((session) => session.invisible).length,
    shadowMutedSessions: sessions.filter((session) => session.shadowMuted).length,
    mutedSessions: sessions.filter((session) => isSessionMuted(session, state.bootedAt)).length,
    players: sessions.filter((session) => session.identity.role === 'PLAYER').length,
    moderators: sessions.filter((session) => session.identity.role === 'MODERATOR').length,
    systems: sessions.filter((session) => session.identity.role === 'SYSTEM').length,
    actorLabels: Object.freeze(actorLabels),
    visibleActorLabels: Object.freeze(visibleActorLabels),
    hiddenActorLabels: Object.freeze(hiddenActorLabels),
  };
}

export function diffSession(
  before: Nullable<ChatSessionModel>,
  after: Nullable<ChatSessionModel>,
): ChatSessionDiff {
  if (!before && !after) {
    return {
      sessionId: 'missing:missing' as ChatSessionId,
      before,
      after,
      changed: false,
      changedFields: Object.freeze([]),
    };
  }

  const sessionId = (after ?? before)!.identity.sessionId;
  const changedFields: string[] = [];

  if (!before || !after) {
    changedFields.push(before ? 'removed' : 'created');
  } else {
    if (before.connectionState !== after.connectionState) changedFields.push('connectionState');
    if (Number(before.lastSeenAt) !== Number(after.lastSeenAt)) changedFields.push('lastSeenAt');
    if (Number(before.joinedAt) !== Number(after.joinedAt)) changedFields.push('joinedAt');
    if (nullableUnixMsDifferent(before.mutedUntil, after.mutedUntil)) changedFields.push('mutedUntil');
    if (before.shadowMuted !== after.shadowMuted) changedFields.push('shadowMuted');
    if (before.invisible !== after.invisible) changedFields.push('invisible');
    if (!arrayShallowEqual(before.roomIds, after.roomIds)) changedFields.push('roomIds');
    if (!shallowJsonRecordEqual(before.transportMetadata, after.transportMetadata)) changedFields.push('transportMetadata');
    if (before.identity.displayName !== after.identity.displayName) changedFields.push('displayName');
    if (before.identity.role !== after.identity.role) changedFields.push('role');
    if (before.identity.entitlementTier !== after.identity.entitlementTier) changedFields.push('entitlementTier');
    if (before.identity.factionId !== after.identity.factionId) changedFields.push('factionId');
  }

  return {
    sessionId,
    before,
    after,
    changed: changedFields.length > 0,
    changedFields: Object.freeze(changedFields),
  };
}

// ============================================================================
// MARK: State wrappers around authoritative mutation
// ============================================================================

export function upsertAuthoritativeSession(
  state: ChatState,
  session: ChatSessionModel,
): ChatState {
  return upsertSession(state, session);
}

export function removeAuthoritativeSession(
  state: ChatState,
  sessionId: ChatSessionId,
): ChatState {
  return removeSession(state, sessionId);
}

export function attachAuthoritativeSessionToRoom(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): ChatState {
  return attachSessionToRoom(state, roomId, sessionId);
}

export function detachAuthoritativeSessionFromRoom(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): ChatState {
  return detachSessionFromRoom(state, roomId, sessionId);
}

export function setAuthoritativeSessionConnectionState(
  state: ChatState,
  sessionId: ChatSessionId,
  connectionState: ChatConnectionState,
  now: UnixMs,
): ChatState {
  return setSessionConnectionState(state, sessionId, connectionState, now);
}

export function setAuthoritativeSessionMutedUntil(
  state: ChatState,
  sessionId: ChatSessionId,
  mutedUntil: Nullable<UnixMs>,
): ChatState {
  return setSessionMutedUntil(state, sessionId, mutedUntil);
}

export function setAuthoritativeSessionShadowMuted(
  state: ChatState,
  sessionId: ChatSessionId,
  shadowMuted: boolean,
): ChatState {
  return setSessionShadowMuted(state, sessionId, shadowMuted);
}

export function setAuthoritativeSessionInvisible(
  state: ChatState,
  sessionId: ChatSessionId,
  invisible: boolean,
): ChatState {
  return setSessionInvisible(state, sessionId, invisible);
}

export function touchSessionLastSeen(
  state: ChatState,
  sessionId: ChatSessionId,
  now: UnixMs,
): ChatState {
  const session = state.sessions[sessionId];
  if (!session) {
    return state;
  }
  if (Number(session.lastSeenAt) === Number(now)) {
    return state;
  }

  const next: ChatSessionModel = {
    ...session,
    lastSeenAt: now,
  };

  return upsertSession(state, next);
}

export function refreshSessionIdentity(
  state: ChatState,
  identity: ChatSessionIdentity,
): ChatState {
  const current = state.sessions[identity.sessionId];
  if (!current) {
    return state;
  }

  const next: ChatSessionModel = {
    ...current,
    identity,
  };

  return upsertSession(state, next);
}

export function mergeSessionTransportMetadataIntoState(
  state: ChatState,
  sessionId: ChatSessionId,
  metadata: Readonly<Record<string, JsonValue>> | undefined,
  context: ChatSessionStateContext,
): ChatState {
  const current = state.sessions[sessionId];
  if (!current) {
    return state;
  }

  const merged = mergeSessionTransportMetadata(current, metadata, context);
  if (merged === current) {
    return state;
  }

  return upsertSession(state, merged);
}

export function setSessionRoomsExactly(
  state: ChatState,
  sessionId: ChatSessionId,
  desiredRoomIds: readonly ChatRoomId[],
): ChatState {
  let next = state;
  const currentRooms = new Set(getSessionRoomIds(state, sessionId));
  const desired = uniqueChatRoomIds(desiredRoomIds);

  for (const roomId of desired) {
    if (!currentRooms.has(roomId)) {
      next = attachAuthoritativeSessionToRoom(next, roomId, sessionId);
    }
  }

  for (const roomId of currentRooms) {
    if (!desired.includes(roomId)) {
      next = detachAuthoritativeSessionFromRoom(next, roomId, sessionId);
    }
  }

  return next;
}

// ============================================================================
// MARK: Reconciliation and maintenance
// ============================================================================

export function reconcileSessionFromTransport(
  state: ChatState,
  request: ChatSessionAdmissionRequest,
  context: ChatSessionStateContext,
): { state: ChatState; decision: ChatSessionAdmissionDecision; diff: ChatSessionDiff } {
  const decision = admitSessionRequest(request, context);
  const before = state.sessions[request.identity.sessionId] ?? null;

  if (!decision.accepted) {
    return {
      state,
      decision,
      diff: diffSession(before, before),
    };
  }

  const current = before;
  const normalizedIdentity = decision.normalizedIdentity;
  const normalizedMetadata = decision.normalizedTransportMetadata;
  const now = request.now;

  const nextSession: ChatSessionModel =
    current
      ? {
          ...current,
          identity: normalizedIdentity,
          transportMetadata: mergeTransportMetadata({
            previous: current.transportMetadata,
            next: normalizedMetadata,
            context,
          }),
          lastSeenAt: now,
          connectionState:
            current.connectionState === 'DISCONNECTED' || current.connectionState === 'DETACHED'
              ? 'ATTACHED'
              : current.connectionState,
        }
      : createAuthoritativeChatSessionState({
          identity: normalizedIdentity,
          now,
          transportMetadata: normalizedMetadata,
          context,
        });

  let nextState = upsertAuthoritativeSession(state, nextSession);

  if (request.roomId) {
    nextState = attachAuthoritativeSessionToRoom(nextState, request.roomId, normalizedIdentity.sessionId);
  }

  return {
    state: nextState,
    decision,
    diff: diffSession(before, nextState.sessions[normalizedIdentity.sessionId] ?? null),
  };
}

export function sweepSessionMaintenance(
  state: ChatState,
  now: UnixMs,
  context: ChatSessionStateContext,
): { state: ChatState; report: ChatSessionMaintenanceReport } {
  let nextState = state;
  const records: ChatSessionMaintenanceRecord[] = [];
  const removedSessionIds: ChatSessionId[] = [];
  const changedSessionIds = new Set<ChatSessionId>();

  for (const session of Object.values(state.sessions)) {
    const before = nextState.sessions[session.identity.sessionId] ?? null;
    let afterState = nextState;
    let action: ChatSessionMaintenanceRecord['action'] = 'PRESERVED';
    let reason = 'session remains valid';

    if (session.mutedUntil && Number(session.mutedUntil) <= Number(now)) {
      afterState = setAuthoritativeSessionMutedUntil(afterState, session.identity.sessionId, null);
      action = 'MUTE_EXPIRED';
      reason = 'mute window elapsed';
    }

    const current = afterState.sessions[session.identity.sessionId];
    if (!current) {
      continue;
    }

    const ageSinceSeen = Number(now) - Number(current.lastSeenAt);

    if (current.connectionState === 'ATTACHED' && ageSinceSeen >= context.reconnectGraceMs) {
      afterState = setAuthoritativeSessionConnectionState(afterState, current.identity.sessionId, 'RECONNECTING', now);
      action = 'DOWNGRADED_TO_RECONNECTING';
      reason = 'session exceeded attached heartbeat grace';
    }

    const postReconnect = afterState.sessions[session.identity.sessionId];
    if (!postReconnect) {
      continue;
    }

    const postAgeSinceSeen = Number(now) - Number(postReconnect.lastSeenAt);

    if (
      (postReconnect.connectionState === 'RECONNECTING' || postReconnect.connectionState === 'DISCONNECTED') &&
      postAgeSinceSeen >= context.disconnectCullMs
    ) {
      afterState = removeAuthoritativeSession(afterState, postReconnect.identity.sessionId);
      action = 'CULLED_DISCONNECTED';
      reason = 'disconnected / reconnecting session exceeded cull window';
      removedSessionIds.push(postReconnect.identity.sessionId);
    } else if (postReconnect.connectionState === 'DETACHED' && postAgeSinceSeen >= context.detachedCullMs) {
      afterState = removeAuthoritativeSession(afterState, postReconnect.identity.sessionId);
      action = 'CULLED_DETACHED';
      reason = 'detached session exceeded cull window';
      removedSessionIds.push(postReconnect.identity.sessionId);
    }

    const after = afterState.sessions[session.identity.sessionId] ?? null;
    const diff = diffSession(before, after);

    if (diff.changed && action === 'PRESERVED') {
      action = 'STATE_CHANGED';
      reason = diff.changedFields.join(', ') || 'state changed';
    }

    if (diff.changed) {
      changedSessionIds.add(session.identity.sessionId);
    }

    records.push({
      sessionId: session.identity.sessionId,
      action,
      before,
      after,
      reason,
    });

    nextState = afterState;
  }

  return {
    state: nextState,
    report: {
      records: Object.freeze(records),
      touchedSessionIds: Object.freeze(uniqueChatSessionIds(records.map((item) => item.sessionId))),
      removedSessionIds: Object.freeze(uniqueChatSessionIds(removedSessionIds)),
      changedSessionIds: Object.freeze([...changedSessionIds]),
    },
  };
}

// ============================================================================
// MARK: Higher-order reconciliation helpers
// ============================================================================

export function reattachReconnectingSession(
  state: ChatState,
  sessionId: ChatSessionId,
  now: UnixMs,
  context: ChatSessionStateContext,
): ChatState {
  const current = state.sessions[sessionId];
  if (!current) {
    return state;
  }

  let next = state;
  next = setAuthoritativeSessionConnectionState(next, sessionId, 'ATTACHED', now);
  next = touchSessionLastSeen(next, sessionId, now);

  if (!context.maintainRoomMembershipOnReconnect) {
    next = setSessionRoomsExactly(next, sessionId, []);
  }

  return next;
}

export function detachSessionEverywhere(
  state: ChatState,
  sessionId: ChatSessionId,
  now: UnixMs,
): ChatState {
  let next = state;
  for (const roomId of getSessionRoomIds(state, sessionId)) {
    next = detachAuthoritativeSessionFromRoom(next, roomId, sessionId);
  }
  next = setAuthoritativeSessionConnectionState(next, sessionId, 'DETACHED', now);
  next = touchSessionLastSeen(next, sessionId, now);
  return next;
}

export function disconnectSessionEverywhere(
  state: ChatState,
  sessionId: ChatSessionId,
  now: UnixMs,
): ChatState {
  let next = state;
  next = setAuthoritativeSessionConnectionState(next, sessionId, 'DISCONNECTED', now);
  next = touchSessionLastSeen(next, sessionId, now);
  return next;
}

export function suspendSession(
  state: ChatState,
  sessionId: ChatSessionId,
  now: UnixMs,
): ChatState {
  let next = state;
  next = setAuthoritativeSessionConnectionState(next, sessionId, 'SUSPENDED', now);
  next = touchSessionLastSeen(next, sessionId, now);
  return next;
}

// ============================================================================
// MARK: Muting, visibility, and posture helpers
// ============================================================================

export function isSessionMuted(session: ChatSessionModel, now: UnixMs): boolean {
  return session.mutedUntil != null && Number(session.mutedUntil) > Number(now);
}

export function isSessionVisibleToRoom(session: ChatSessionModel): boolean {
  return !session.invisible && !session.shadowMuted && session.connectionState !== 'DETACHED';
}

export function shouldSessionRemainInRoomIndexes(
  session: ChatSessionModel,
  context: ChatSessionStateContext,
): boolean {
  if (session.connectionState === 'DETACHED') {
    return false;
  }
  if (session.invisible && !context.invisibleSessionsRemainAttached) {
    return false;
  }
  return true;
}

export function createSessionVisibilityReport(
  state: ChatState,
  roomId: ChatRoomId,
): Readonly<Record<string, JsonValue>> {
  const projections = projectVisibleSessionsForRoom(state, roomId, true);
  return Object.freeze({
    roomId: stringifyRoomId(roomId),
    visibleCount: projections.filter((item) => item.visibleToRoom).length,
    hiddenCount: projections.filter((item) => !item.visibleToRoom).length,
    visibleActors: projections
      .filter((item) => item.visibleActorLabel)
      .map((item) => item.visibleActorLabel!) as readonly string[],
    hiddenReasons: projections
      .filter((item) => item.hiddenReason)
      .map((item) => item.hiddenReason!) as readonly string[],
  });
}

// ============================================================================
// MARK: Room and state consistency helpers
// ============================================================================

export function findDanglingSessionRoomMemberships(state: ChatState): readonly {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly reason: string;
}[] {
  const findings: {
    sessionId: ChatSessionId;
    roomId: ChatRoomId;
    reason: string;
  }[] = [];

  for (const [roomId, sessionIds] of Object.entries(state.roomSessions.byRoom) as [ChatRoomId, readonly ChatSessionId[]][]) {
    for (const sessionId of sessionIds) {
      if (!state.sessions[sessionId]) {
        findings.push({
          sessionId,
          roomId,
          reason: 'room references missing session',
        });
        continue;
      }

      const backRef = state.roomSessions.bySession[sessionId] ?? [];
      if (!backRef.includes(roomId)) {
        findings.push({
          sessionId,
          roomId,
          reason: 'room/session index is not bidirectionally aligned',
        });
      }
    }
  }

  return Object.freeze(findings);
}

export function findDanglingSessionReferences(state: ChatState): readonly {
  readonly sessionId: ChatSessionId;
  readonly reason: string;
}[] {
  const findings: {
    sessionId: ChatSessionId;
    reason: string;
  }[] = [];

  for (const [sessionId, roomIds] of Object.entries(state.roomSessions.bySession) as [ChatSessionId, readonly ChatRoomId[]][]) {
    if (!state.sessions[sessionId]) {
      findings.push({
        sessionId,
        reason: 'bySession index references missing session',
      });
      continue;
    }

    for (const roomId of roomIds) {
      if (!state.rooms[roomId]) {
        findings.push({
          sessionId,
          reason: `session references missing room ${String(roomId)}`,
        });
      }
    }
  }

  return Object.freeze(findings);
}

export function reconcileSessionIndexes(state: ChatState): ChatState {
  let next = state;

  for (const finding of findDanglingSessionRoomMemberships(state)) {
    if (!next.sessions[finding.sessionId]) {
      continue;
    }
    next = attachAuthoritativeSessionToRoom(next, finding.roomId, finding.sessionId);
  }

  for (const finding of findDanglingSessionReferences(state)) {
    if (!next.sessions[finding.sessionId]) {
      next = removeAuthoritativeSession(next, finding.sessionId);
    }
  }

  return next;
}

// ============================================================================
// MARK: Diagnostics and formatting
// ============================================================================

export function summarizeSession(session: ChatSessionModel): string {
  return [
    stringifySessionId(session.identity.sessionId),
    session.identity.displayName,
    session.identity.role,
    session.connectionState,
    session.invisible ? 'invisible' : 'visible',
    session.shadowMuted ? 'shadow-muted' : 'audible',
    session.roomIds.length > 0 ? `rooms=${session.roomIds.length}` : 'rooms=0',
  ].join(' | ');
}

export function summarizeSessionsForRoom(state: ChatState, roomId: ChatRoomId): string {
  const summary = summarizeRoomMembership(state, roomId);
  return [
    `room=${String(roomId)}`,
    `kind=${summary.roomKind ?? 'unknown'}`,
    `total=${summary.totalSessions}`,
    `visible=${summary.visibleSessions}`,
    `hidden=${summary.invisibleSessions}`,
    `players=${summary.players}`,
    `systems=${summary.systems}`,
    `mods=${summary.moderators}`,
  ].join(' ');
}

export function sessionDiffToJson(diff: ChatSessionDiff): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    sessionId: stringifySessionId(diff.sessionId),
    changed: diff.changed,
    changedFields: diff.changedFields,
    beforeConnectionState: diff.before?.connectionState ?? null,
    afterConnectionState: diff.after?.connectionState ?? null,
    beforeInvisible: diff.before?.invisible ?? null,
    afterInvisible: diff.after?.invisible ?? null,
    beforeShadowMuted: diff.before?.shadowMuted ?? null,
    afterShadowMuted: diff.after?.shadowMuted ?? null,
  });
}

export function roomMembershipSummaryToJson(
  summary: ChatRoomMembershipSummary,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    roomId: stringifyRoomId(summary.roomId),
    roomKind: summary.roomKind,
    totalSessions: summary.totalSessions,
    attachedSessions: summary.attachedSessions,
    reconnectingSessions: summary.reconnectingSessions,
    detachedSessions: summary.detachedSessions,
    disconnectedSessions: summary.disconnectedSessions,
    visibleSessions: summary.visibleSessions,
    invisibleSessions: summary.invisibleSessions,
    shadowMutedSessions: summary.shadowMutedSessions,
    mutedSessions: summary.mutedSessions,
    players: summary.players,
    moderators: summary.moderators,
    systems: summary.systems,
    actorLabels: summary.actorLabels,
    visibleActorLabels: summary.visibleActorLabels,
    hiddenActorLabels: summary.hiddenActorLabels,
  });
}

export function maintenanceReportToJson(
  report: ChatSessionMaintenanceReport,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    touchedSessionIds: report.touchedSessionIds.map((id) => stringifySessionId(id)),
    removedSessionIds: report.removedSessionIds.map((id) => stringifySessionId(id)),
    changedSessionIds: report.changedSessionIds.map((id) => stringifySessionId(id)),
    records: report.records.map((record) =>
      Object.freeze({
        sessionId: stringifySessionId(record.sessionId),
        action: record.action,
        reason: record.reason,
        beforeState: record.before?.connectionState ?? null,
        afterState: record.after?.connectionState ?? null,
      }),
    ),
  });
}

// ============================================================================
// MARK: Test-oriented builders and convenience helpers
// ============================================================================

export function createSyntheticPlayerIdentity(
  sessionId: ChatSessionId,
  userId: string,
  displayName: string,
): ChatSessionIdentity {
  return {
    sessionId,
    userId: userId as typeof sessionId extends never ? never : any,
    displayName,
    role: 'PLAYER',
    entitlementTier: null,
    factionId: null,
  };
}

export function createSyntheticSystemIdentity(
  sessionId: ChatSessionId,
  userId: string,
  displayName: string,
): ChatSessionIdentity {
  return {
    sessionId,
    userId: userId as typeof sessionId extends never ? never : any,
    displayName,
    role: 'SYSTEM',
    entitlementTier: 'SYSTEM',
    factionId: null,
  };
}

export function createSyntheticModeratorIdentity(
  sessionId: ChatSessionId,
  userId: string,
  displayName: string,
): ChatSessionIdentity {
  return {
    sessionId,
    userId: userId as typeof sessionId extends never ? never : any,
    displayName,
    role: 'MODERATOR',
    entitlementTier: 'STAFF',
    factionId: null,
  };
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function arrayShallowEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function shallowJsonRecordEqual(
  left: Readonly<Record<string, JsonValue>>,
  right: Readonly<Record<string, JsonValue>>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const key of leftKeys) {
    if (!(key in right)) {
      return false;
    }
    if (!jsonValueEqual(left[key], right[key])) {
      return false;
    }
  }
  return true;
}

function jsonValueEqual(left: JsonValue, right: JsonValue): boolean {
  if (left === right) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (left == null || right == null) {
    return left === right;
  }

  if (typeof left === 'string' || typeof left === 'number' || typeof left === 'boolean') {
    return left === right;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return arrayShallowEqual(left, right);
  }

  if (!Array.isArray(left) && !Array.isArray(right)) {
    return shallowJsonRecordEqual(left as Readonly<Record<string, JsonValue>>, right as Readonly<Record<string, JsonValue>>);
  }

  return false;
}

function nullableUnixMsDifferent(left: Nullable<UnixMs>, right: Nullable<UnixMs>): boolean {
  if (left == null || right == null) {
    return left !== right;
  }
  return Number(left) !== Number(right);
}

function uniqueChatRoomIds(values: readonly ChatRoomId[]): readonly ChatRoomId[] {
  return Object.freeze([...new Set(values)]);
}

function uniqueChatSessionIds(values: readonly ChatSessionId[]): readonly ChatSessionId[] {
  return Object.freeze([...new Set(values)]);
}

function stringifyRoomId(roomId: ChatRoomId): string {
  return String(roomId);
}

function stringifySessionId(sessionId: ChatSessionId): string {
  return String(sessionId);
}

function stringifyUserId(userId: unknown): string {
  return String(userId);
}

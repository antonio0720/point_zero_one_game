/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT PRESENCE STATE
 * FILE: backend/src/game/engine/chat/ChatPresenceState.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend owner for presence truth helpers, presence projections,
 * occupancy summaries, reconciliation, and maintenance around the authoritative
 * ChatPresenceState graph.
 *
 * Backend-truth question
 * ----------------------
 *
 *   "Who is actually present in a room right now, in what mode, with what
 *    visibility, and how should that truth be reconciled against sessions,
 *    rooms, and transport updates before downstream rendering or orchestration
 *    occurs?"
 *
 * Design doctrine
 * ---------------
 * - socket transport may forward presence intent, but does not decide truth;
 * - frontend may mirror presence, but does not decide truth;
 * - reducer applies accepted presence mutations, but does not define presence
 *   semantics;
 * - this module owns presence truth helpers, reconciliation law, and summary
 *   projections that downstream engine files can consume deterministically.
 *
 * Why this file is deep
 * ---------------------
 * The backend simulation tree you locked makes presence more than a green dot.
 * Presence drives:
 * - room occupancy truth,
 * - visible audience heat eligibility,
 * - spectating posture,
 * - helper / hater visibility lanes,
 * - typing authority,
 * - reconnect windows,
 * - shadow-muted invisibility,
 * - chat room occupancy summaries for replay and telemetry,
 * - orchestration gates for NPC timing and swarm behavior.
 *
 * This file therefore owns:
 * - pure presence state builders,
 * - snapshot creation,
 * - room/session indexes,
 * - visibility filtering,
 * - occupancy summaries,
 * - session reconciliation,
 * - maintenance sweeps,
 * - hidden / spectating / reconnect posture logic,
 * - batch upsert and batch removal helpers,
 * - explainable diffs for tests and telemetry.
 * ============================================================================
 */

import {
  asUnixMs,
  type ChatPresenceMode,
  type ChatPresenceSnapshot,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomState,
  type ChatSessionId,
  type ChatSessionIdentity,
  type ChatSessionRole,
  type ChatSessionState,
  type ChatState,
  type JsonValue,
  type Nullable,
  type UnixMs,
} from './types';

// ============================================================================
// MARK: Ports, options, and report shapes
// ============================================================================

export interface ChatPresenceStateLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatPresenceStateOptions {
  readonly logger?: ChatPresenceStateLoggerPort;
  readonly reconnectGraceMs?: number;
  readonly disconnectCullMs?: number;
  readonly hiddenSessionsStillCountTowardOccupancy?: boolean;
  readonly systemSessionsCountTowardOccupancy?: boolean;
}

export interface ChatPresenceStateContext {
  readonly logger: ChatPresenceStateLoggerPort;
  readonly reconnectGraceMs: number;
  readonly disconnectCullMs: number;
  readonly hiddenSessionsStillCountTowardOccupancy: boolean;
  readonly systemSessionsCountTowardOccupancy: boolean;
}

export interface ChatPresenceRoomCounts {
  readonly totalSnapshots: number;
  readonly visibleSnapshots: number;
  readonly hiddenSnapshots: number;
  readonly onlineCount: number;
  readonly awayCount: number;
  readonly spectatingCount: number;
  readonly reconnectingCount: number;
  readonly disconnectedCount: number;
  readonly players: number;
  readonly spectators: number;
  readonly systems: number;
  readonly moderators: number;
  readonly npcs: number;
}

export interface ChatPresenceOccupancySummary {
  readonly roomId: ChatRoomId;
  readonly roomKind: Nullable<ChatRoomKind>;
  readonly counts: ChatPresenceRoomCounts;
  readonly actorLabelsVisible: readonly string[];
  readonly actorLabelsAll: readonly string[];
  readonly hasAudience: boolean;
  readonly hasSpectators: boolean;
  readonly hasNpcPresence: boolean;
  readonly hasModerationPresence: boolean;
  readonly hasOnlyHiddenPresence: boolean;
  readonly lastUpdatedAt: UnixMs;
}

export interface ChatPresenceDiff {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly before: Nullable<ChatPresenceSnapshot>;
  readonly after: Nullable<ChatPresenceSnapshot>;
  readonly changed: boolean;
}

export interface ChatPresenceMaintenanceReport {
  readonly removed: readonly ChatPresenceDiff[];
  readonly downgraded: readonly ChatPresenceDiff[];
  readonly preserved: readonly ChatPresenceDiff[];
}

export interface CreatePresenceSnapshotArgs {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly mode: ChatPresenceMode;
  readonly visibleToRoom: boolean;
  readonly spectating: boolean;
  readonly actorLabel: string;
  readonly now: UnixMs;
}

export interface PresenceProjectionArgs {
  readonly roomId: ChatRoomId;
  readonly state: ChatState;
  readonly includeHidden?: boolean;
}

// ============================================================================
// MARK: Local type aliases for clarity
// ============================================================================

export type AuthoritativePresenceState = ChatState['presence'];

// ============================================================================
// MARK: Context and façade
// ============================================================================

export class ChatPresenceAuthority {
  private readonly context: ChatPresenceStateContext;

  constructor(options: ChatPresenceStateOptions = {}) {
    this.context = createPresenceContext(options);
  }

  contextValue(): ChatPresenceStateContext {
    return this.context;
  }

  createSnapshot(args: CreatePresenceSnapshotArgs): ChatPresenceSnapshot {
    return createPresenceSnapshot(args);
  }

  upsert(
    presence: AuthoritativePresenceState,
    snapshot: ChatPresenceSnapshot,
  ): AuthoritativePresenceState {
    return upsertPresenceSnapshot(presence, snapshot);
  }

  remove(
    presence: AuthoritativePresenceState,
    roomId: ChatRoomId,
    sessionId: ChatSessionId,
  ): AuthoritativePresenceState {
    return removePresenceSnapshot(presence, roomId, sessionId);
  }

  summarizeRoom(
    args: PresenceProjectionArgs,
  ): ChatPresenceOccupancySummary {
    return summarizePresenceRoom(args.state, args.roomId, this.context, args.includeHidden ?? false);
  }

  maintenance(
    state: ChatState,
    now: UnixMs,
  ): ChatPresenceMaintenanceReport {
    return sweepPresenceMaintenance(state, now, this.context);
  }
}

export function createPresenceAuthority(options: ChatPresenceStateOptions = {}): ChatPresenceAuthority {
  return new ChatPresenceAuthority(options);
}

export function createPresenceContext(options: ChatPresenceStateOptions = {}): ChatPresenceStateContext {
  return {
    logger: options.logger ?? createDefaultPresenceLogger(),
    reconnectGraceMs: Math.max(1_000, options.reconnectGraceMs ?? 20_000),
    disconnectCullMs: Math.max(2_000, options.disconnectCullMs ?? 45_000),
    hiddenSessionsStillCountTowardOccupancy: options.hiddenSessionsStillCountTowardOccupancy ?? false,
    systemSessionsCountTowardOccupancy: options.systemSessionsCountTowardOccupancy ?? false,
  };
}

// ============================================================================
// MARK: Empty builders and core creation helpers
// ============================================================================

export function createEmptyPresenceState(): AuthoritativePresenceState {
  return Object.freeze({
    byRoom: Object.freeze({}) as AuthoritativePresenceState['byRoom'],
    bySession: Object.freeze({}) as AuthoritativePresenceState['bySession'],
  });
}

export function createPresenceSnapshot(args: CreatePresenceSnapshotArgs): ChatPresenceSnapshot {
  return Object.freeze({
    roomId: args.roomId,
    sessionId: args.sessionId,
    mode: args.mode,
    visibleToRoom: args.visibleToRoom,
    updatedAt: args.now,
    spectating: args.spectating,
    actorLabel: sanitizeActorLabel(args.actorLabel),
  });
}

export function createPresenceSnapshotFromSession(
  roomId: ChatRoomId,
  session: ChatSessionState,
  now: UnixMs,
  override?: Partial<Pick<ChatPresenceSnapshot, 'visibleToRoom' | 'spectating' | 'mode'>>,
): ChatPresenceSnapshot {
  return createPresenceSnapshot({
    roomId,
    sessionId: session.identity.sessionId,
    mode: override?.mode ?? inferPresenceModeFromSession(session),
    visibleToRoom: override?.visibleToRoom ?? !session.invisible,
    spectating: override?.spectating ?? session.identity.role === 'SPECTATOR',
    actorLabel: session.identity.displayName,
    now,
  });
}

export function createPresenceDiff(
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
  before: Nullable<ChatPresenceSnapshot>,
  after: Nullable<ChatPresenceSnapshot>,
): ChatPresenceDiff {
  return Object.freeze({
    roomId,
    sessionId,
    before,
    after,
    changed: !isSamePresenceSnapshot(before, after),
  });
}

// ============================================================================
// MARK: Pure upsert / remove / merge helpers
// ============================================================================

export function upsertPresenceSnapshot(
  presence: AuthoritativePresenceState,
  snapshot: ChatPresenceSnapshot,
): AuthoritativePresenceState {
  const roomMap = {
    ...(presence.byRoom[snapshot.roomId] ?? {}),
    [snapshot.sessionId]: snapshot,
  };

  const sessionList = uniquePresenceList([
    ...(presence.bySession[snapshot.sessionId] ?? []).filter((value) => value.roomId !== snapshot.roomId),
    snapshot,
  ]);

  return Object.freeze({
    byRoom: Object.freeze({
      ...presence.byRoom,
      [snapshot.roomId]: Object.freeze(roomMap),
    }),
    bySession: Object.freeze({
      ...presence.bySession,
      [snapshot.sessionId]: Object.freeze(sessionList),
    }),
  });
}

export function upsertPresenceSnapshots(
  presence: AuthoritativePresenceState,
  snapshots: readonly ChatPresenceSnapshot[],
): AuthoritativePresenceState {
  let next = presence;
  for (const snapshot of snapshots) {
    next = upsertPresenceSnapshot(next, snapshot);
  }
  return next;
}

export function removePresenceSnapshot(
  presence: AuthoritativePresenceState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): AuthoritativePresenceState {
  const currentRoom = { ...(presence.byRoom[roomId] ?? {}) };
  delete currentRoom[sessionId];

  const nextSessionList = (presence.bySession[sessionId] ?? []).filter((item) => item.roomId !== roomId);

  return Object.freeze({
    byRoom: Object.freeze({
      ...presence.byRoom,
      [roomId]: Object.freeze(currentRoom),
    }),
    bySession: Object.freeze({
      ...presence.bySession,
      [sessionId]: Object.freeze(nextSessionList),
    }),
  });
}

export function removePresenceSnapshotsForRoom(
  presence: AuthoritativePresenceState,
  roomId: ChatRoomId,
): AuthoritativePresenceState {
  let next = presence;
  for (const sessionId of Object.keys(presence.byRoom[roomId] ?? {}) as ChatSessionId[]) {
    next = removePresenceSnapshot(next, roomId, sessionId);
  }
  return next;
}

export function removePresenceSnapshotsForSession(
  presence: AuthoritativePresenceState,
  sessionId: ChatSessionId,
): AuthoritativePresenceState {
  let next = presence;
  for (const snapshot of presence.bySession[sessionId] ?? []) {
    next = removePresenceSnapshot(next, snapshot.roomId, sessionId);
  }
  return next;
}

export function mergePresenceStates(
  left: AuthoritativePresenceState,
  right: AuthoritativePresenceState,
): AuthoritativePresenceState {
  let next = left;
  for (const snapshots of Object.values(right.bySession)) {
    next = upsertPresenceSnapshots(next, snapshots);
  }
  return next;
}

// ============================================================================
// MARK: Query helpers
// ============================================================================

export function getPresenceForRoom(
  presence: AuthoritativePresenceState,
  roomId: ChatRoomId,
): readonly ChatPresenceSnapshot[] {
  return Object.freeze(Object.values(presence.byRoom[roomId] ?? {}));
}

export function getPresenceForSession(
  presence: AuthoritativePresenceState,
  sessionId: ChatSessionId,
): readonly ChatPresenceSnapshot[] {
  return Object.freeze([...(presence.bySession[sessionId] ?? [])]);
}

export function getVisiblePresenceForRoom(
  state: ChatState,
  roomId: ChatRoomId,
  context: ChatPresenceStateContext = createPresenceContext(),
): readonly ChatPresenceSnapshot[] {
  return Object.freeze(getPresenceForRoom(state.presence, roomId).filter((snapshot) => {
    const session = state.sessions[snapshot.sessionId];
    if (!session) {
      return false;
    }
    if (!snapshot.visibleToRoom) {
      return false;
    }
    if (session.invisible) {
      return false;
    }
    if (snapshot.mode === 'DISCONNECTED') {
      return false;
    }
    if (session.identity.role === 'SYSTEM' && !context.systemSessionsCountTowardOccupancy) {
      return false;
    }
    return true;
  }));
}

export function getHiddenPresenceForRoom(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatPresenceSnapshot[] {
  return Object.freeze(getPresenceForRoom(state.presence, roomId).filter((snapshot) => {
    const session = state.sessions[snapshot.sessionId];
    if (!session) {
      return false;
    }
    return session.invisible || !snapshot.visibleToRoom || snapshot.mode === 'HIDDEN';
  }));
}

export function getSpectatingPresenceForRoom(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatPresenceSnapshot[] {
  return Object.freeze(getPresenceForRoom(state.presence, roomId).filter((snapshot) => snapshot.spectating));
}

export function getReconnectPresenceForRoom(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatPresenceSnapshot[] {
  return Object.freeze(getPresenceForRoom(state.presence, roomId).filter((snapshot) => snapshot.mode === 'RECONNECTING'));
}

export function getDisconnectedPresenceForRoom(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatPresenceSnapshot[] {
  return Object.freeze(getPresenceForRoom(state.presence, roomId).filter((snapshot) => snapshot.mode === 'DISCONNECTED'));
}

export function hasPresenceForRoom(
  presence: AuthoritativePresenceState,
  roomId: ChatRoomId,
): boolean {
  return getPresenceForRoom(presence, roomId).length > 0;
}

export function hasPresenceForSession(
  presence: AuthoritativePresenceState,
  sessionId: ChatSessionId,
): boolean {
  return getPresenceForSession(presence, sessionId).length > 0;
}

// ============================================================================
// MARK: Session and identity helpers
// ============================================================================

export function inferPresenceModeFromSession(session: ChatSessionState): ChatPresenceMode {
  switch (session.connectionState) {
    case 'ATTACHED':
      return session.identity.role === 'SPECTATOR' ? 'SPECTATING' : 'ONLINE';
    case 'RECONNECTING':
      return 'RECONNECTING';
    case 'DISCONNECTED':
    case 'DETACHED':
    case 'SUSPENDED':
      return 'DISCONNECTED';
    default:
      return 'ONLINE';
  }
}

export function shouldPresenceBeVisible(session: ChatSessionState, snapshot: Nullable<ChatPresenceSnapshot>): boolean {
  if (session.invisible) {
    return false;
  }
  if (!snapshot) {
    return !session.shadowMuted;
  }
  if (!snapshot.visibleToRoom) {
    return false;
  }
  if (snapshot.mode === 'HIDDEN') {
    return false;
  }
  return true;
}

export function isPresenceSessionSpectator(session: ChatSessionState, snapshot: Nullable<ChatPresenceSnapshot>): boolean {
  return session.identity.role === 'SPECTATOR' || snapshot?.spectating === true || snapshot?.mode === 'SPECTATING';
}

export function isPresenceSessionNpc(session: ChatSessionState): boolean {
  return session.identity.role === 'NPC';
}

export function isPresenceSessionModerator(session: ChatSessionState): boolean {
  return session.identity.role === 'MODERATOR';
}

export function isPresenceSessionSystem(session: ChatSessionState): boolean {
  return session.identity.role === 'SYSTEM';
}

export function isPresenceSessionPlayer(session: ChatSessionState): boolean {
  return session.identity.role === 'PLAYER';
}

export function isPresenceSessionAway(snapshot: ChatPresenceSnapshot): boolean {
  return snapshot.mode === 'AWAY';
}

export function isPresenceSessionOnline(snapshot: ChatPresenceSnapshot): boolean {
  return snapshot.mode === 'ONLINE';
}

export function isPresenceSessionReconnecting(snapshot: ChatPresenceSnapshot): boolean {
  return snapshot.mode === 'RECONNECTING';
}

export function isPresenceSessionDisconnected(snapshot: ChatPresenceSnapshot): boolean {
  return snapshot.mode === 'DISCONNECTED';
}

export function isPresenceSessionHidden(snapshot: ChatPresenceSnapshot, session: Nullable<ChatSessionState>): boolean {
  return snapshot.mode === 'HIDDEN' || !snapshot.visibleToRoom || Boolean(session?.invisible);
}

// ============================================================================
// MARK: Occupancy summaries
// ============================================================================

export function summarizePresenceRoom(
  state: ChatState,
  roomId: ChatRoomId,
  context: ChatPresenceStateContext = createPresenceContext(),
  includeHidden = false,
): ChatPresenceOccupancySummary {
  const room = state.rooms[roomId] ?? null;
  const snapshots = getPresenceForRoom(state.presence, roomId);
  const filtered = includeHidden
    ? snapshots
    : snapshots.filter((snapshot) => shouldPresenceBeVisible(state.sessions[snapshot.sessionId] ?? nullSessionState(snapshot.sessionId), snapshot));

  const counts = computeRoomCounts(filtered, state, context);
  const visibleLabels = filtered.map((snapshot) => snapshot.actorLabel);
  const allLabels = snapshots.map((snapshot) => snapshot.actorLabel);

  return Object.freeze({
    roomId,
    roomKind: room?.roomKind ?? null,
    counts,
    actorLabelsVisible: Object.freeze(uniqueStrings(visibleLabels)),
    actorLabelsAll: Object.freeze(uniqueStrings(allLabels)),
    hasAudience: counts.players + counts.spectators + counts.npcs > 0,
    hasSpectators: counts.spectators > 0,
    hasNpcPresence: counts.npcs > 0,
    hasModerationPresence: counts.moderators > 0,
    hasOnlyHiddenPresence: counts.visibleSnapshots === 0 && counts.totalSnapshots > 0,
    lastUpdatedAt: mostRecentPresenceUpdate(snapshots),
  });
}

export function summarizeAllPresenceRooms(
  state: ChatState,
  context: ChatPresenceStateContext = createPresenceContext(),
  includeHidden = false,
): readonly ChatPresenceOccupancySummary[] {
  const roomIds = uniqueRoomIdsFromPresence(state.presence);
  return Object.freeze(roomIds.map((roomId) => summarizePresenceRoom(state, roomId, context, includeHidden)));
}

export function computeRoomCounts(
  snapshots: readonly ChatPresenceSnapshot[],
  state: ChatState,
  context: ChatPresenceStateContext,
): ChatPresenceRoomCounts {
  let onlineCount = 0;
  let awayCount = 0;
  let spectatingCount = 0;
  let reconnectingCount = 0;
  let disconnectedCount = 0;
  let visibleSnapshots = 0;
  let hiddenSnapshots = 0;
  let players = 0;
  let spectators = 0;
  let systems = 0;
  let moderators = 0;
  let npcs = 0;

  for (const snapshot of snapshots) {
    const session = state.sessions[snapshot.sessionId];
    const visible = shouldPresenceBeVisible(session ?? nullSessionState(snapshot.sessionId), snapshot);

    if (visible) {
      visibleSnapshots += 1;
    } else {
      hiddenSnapshots += 1;
    }

    switch (snapshot.mode) {
      case 'ONLINE':
        onlineCount += 1;
        break;
      case 'AWAY':
        awayCount += 1;
        break;
      case 'SPECTATING':
        spectatingCount += 1;
        break;
      case 'RECONNECTING':
        reconnectingCount += 1;
        break;
      case 'DISCONNECTED':
        disconnectedCount += 1;
        break;
      case 'HIDDEN':
        hiddenSnapshots += 0;
        break;
      default:
        break;
    }

    switch (session?.identity.role) {
      case 'PLAYER':
        players += 1;
        break;
      case 'SPECTATOR':
        spectators += 1;
        break;
      case 'SYSTEM':
        if (context.systemSessionsCountTowardOccupancy) {
          systems += 1;
        }
        break;
      case 'MODERATOR':
        moderators += 1;
        break;
      case 'NPC':
        npcs += 1;
        break;
      default:
        break;
    }
  }

  return Object.freeze({
    totalSnapshots: snapshots.length,
    visibleSnapshots,
    hiddenSnapshots,
    onlineCount,
    awayCount,
    spectatingCount,
    reconnectingCount,
    disconnectedCount,
    players,
    spectators,
    systems,
    moderators,
    npcs,
  });
}

export function mostRecentPresenceUpdate(snapshots: readonly ChatPresenceSnapshot[]): UnixMs {
  let latest = asUnixMs(0);
  for (const snapshot of snapshots) {
    if (Number(snapshot.updatedAt) > Number(latest)) {
      latest = snapshot.updatedAt;
    }
  }
  return latest;
}

// ============================================================================
// MARK: Reconciliation helpers
// ============================================================================

export function reconcilePresenceForSession(
  state: ChatState,
  sessionId: ChatSessionId,
  now: UnixMs,
): ChatState {
  const session = state.sessions[sessionId];
  if (!session) {
    return state;
  }

  let nextPresence = state.presence;
  const roomIds = session.roomIds;
  const existingRoomIds = new Set((state.presence.bySession[sessionId] ?? []).map((snapshot) => snapshot.roomId));

  for (const roomId of roomIds) {
    const nextSnapshot = createPresenceSnapshotFromSession(roomId, session, now);
    nextPresence = upsertPresenceSnapshot(nextPresence, nextSnapshot);
    existingRoomIds.delete(roomId);
  }

  for (const roomId of existingRoomIds) {
    nextPresence = removePresenceSnapshot(nextPresence, roomId, sessionId);
  }

  if (nextPresence === state.presence) {
    return state;
  }

  return {
    ...state,
    presence: nextPresence,
  };
}

export function reconcilePresenceForAllSessions(
  state: ChatState,
  now: UnixMs,
): ChatState {
  let next = state;
  for (const sessionId of Object.keys(state.sessions) as ChatSessionId[]) {
    next = reconcilePresenceForSession(next, sessionId, now);
  }
  return next;
}

export function reconcilePresenceAgainstRoomExistence(state: ChatState): ChatState {
  let nextPresence = state.presence;
  for (const roomId of Object.keys(state.presence.byRoom) as ChatRoomId[]) {
    if (!state.rooms[roomId]) {
      nextPresence = removePresenceSnapshotsForRoom(nextPresence, roomId);
    }
  }
  if (nextPresence === state.presence) {
    return state;
  }
  return {
    ...state,
    presence: nextPresence,
  };
}

export function reconcilePresenceAgainstSessionExistence(state: ChatState): ChatState {
  let nextPresence = state.presence;
  for (const sessionId of Object.keys(state.presence.bySession) as ChatSessionId[]) {
    if (!state.sessions[sessionId]) {
      nextPresence = removePresenceSnapshotsForSession(nextPresence, sessionId);
    }
  }
  if (nextPresence === state.presence) {
    return state;
  }
  return {
    ...state,
    presence: nextPresence,
  };
}

// ============================================================================
// MARK: Maintenance sweeps
// ============================================================================

export function sweepPresenceMaintenance(
  state: ChatState,
  now: UnixMs,
  context: ChatPresenceStateContext = createPresenceContext(),
): ChatPresenceMaintenanceReport {
  const removed: ChatPresenceDiff[] = [];
  const downgraded: ChatPresenceDiff[] = [];
  const preserved: ChatPresenceDiff[] = [];

  for (const [sessionId, snapshots] of (Object.entries(state.presence.bySession) as unknown as readonly [ChatSessionId, readonly ChatPresenceSnapshot[]][])) {
    const session = state.sessions[sessionId] ?? null;

    for (const snapshot of snapshots) {
      if (!session) {
        removed.push(createPresenceDiff(snapshot.roomId, sessionId, snapshot, null));
        continue;
      }

      const staleMs = Number(now) - Number(snapshot.updatedAt);

      if (session.connectionState === 'DETACHED' || session.connectionState === 'DISCONNECTED') {
        if (staleMs > context.disconnectCullMs) {
          removed.push(createPresenceDiff(snapshot.roomId, sessionId, snapshot, null));
          continue;
        }
        const downgradedSnapshot = { ...snapshot, mode: 'DISCONNECTED' as const, updatedAt: now };
        downgraded.push(createPresenceDiff(snapshot.roomId, sessionId, snapshot, downgradedSnapshot));
        continue;
      }

      if (session.connectionState === 'RECONNECTING' && staleMs > context.reconnectGraceMs) {
        const downgradedSnapshot = { ...snapshot, mode: 'RECONNECTING' as const, updatedAt: now };
        downgraded.push(createPresenceDiff(snapshot.roomId, sessionId, snapshot, downgradedSnapshot));
        continue;
      }

      preserved.push(createPresenceDiff(snapshot.roomId, sessionId, snapshot, snapshot));
    }
  }

  return Object.freeze({
    removed: Object.freeze(removed),
    downgraded: Object.freeze(downgraded),
    preserved: Object.freeze(preserved),
  });
}

export function applyPresenceMaintenance(
  state: ChatState,
  now: UnixMs,
  context: ChatPresenceStateContext = createPresenceContext(),
): ChatState {
  const report = sweepPresenceMaintenance(state, now, context);
  let nextPresence = state.presence;

  for (const diff of report.removed) {
    nextPresence = removePresenceSnapshot(nextPresence, diff.roomId, diff.sessionId);
  }
  for (const diff of report.downgraded) {
    if (diff.after) {
      nextPresence = upsertPresenceSnapshot(nextPresence, diff.after);
    }
  }

  if (nextPresence === state.presence) {
    return state;
  }

  return {
    ...state,
    presence: nextPresence,
  };
}

// ============================================================================
// MARK: State-level wrappers
// ============================================================================

export function upsertPresenceInState(state: ChatState, snapshot: ChatPresenceSnapshot): ChatState {
  return {
    ...state,
    presence: upsertPresenceSnapshot(state.presence, snapshot),
  };
}

export function removePresenceFromState(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): ChatState {
  return {
    ...state,
    presence: removePresenceSnapshot(state.presence, roomId, sessionId),
  };
}

export function removePresenceForSessionFromState(state: ChatState, sessionId: ChatSessionId): ChatState {
  return {
    ...state,
    presence: removePresenceSnapshotsForSession(state.presence, sessionId),
  };
}

export function removePresenceForRoomFromState(state: ChatState, roomId: ChatRoomId): ChatState {
  return {
    ...state,
    presence: removePresenceSnapshotsForRoom(state.presence, roomId),
  };
}

export function projectVisiblePresenceLabels(
  state: ChatState,
  roomId: ChatRoomId,
  context: ChatPresenceStateContext = createPresenceContext(),
): readonly string[] {
  return Object.freeze(getVisiblePresenceForRoom(state, roomId, context).map((snapshot) => snapshot.actorLabel));
}

export function projectAllPresenceLabels(
  state: ChatState,
  roomId: ChatRoomId,
): readonly string[] {
  return Object.freeze(getPresenceForRoom(state.presence, roomId).map((snapshot) => snapshot.actorLabel));
}

// ============================================================================
// MARK: Utility comparators and list helpers
// ============================================================================

export function isSamePresenceSnapshot(
  left: Nullable<ChatPresenceSnapshot>,
  right: Nullable<ChatPresenceSnapshot>,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.roomId === right.roomId
    && left.sessionId === right.sessionId
    && left.mode === right.mode
    && left.visibleToRoom === right.visibleToRoom
    && left.spectating === right.spectating
    && left.actorLabel === right.actorLabel
    && Number(left.updatedAt) === Number(right.updatedAt);
}

export function uniquePresenceList(snapshots: readonly ChatPresenceSnapshot[]): readonly ChatPresenceSnapshot[] {
  const map = new Map<string, ChatPresenceSnapshot>();
  for (const snapshot of snapshots) {
    map.set(`${String(snapshot.roomId)}:${String(snapshot.sessionId)}`, snapshot);
  }
  return Object.freeze([...map.values()]);
}

export function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

export function uniqueRoomIdsFromPresence(presence: AuthoritativePresenceState): readonly ChatRoomId[] {
  return Object.freeze(Object.keys(presence.byRoom) as ChatRoomId[]);
}

export function sanitizeActorLabel(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'UNKNOWN ACTOR';
}

// ============================================================================
// MARK: Null-object helpers
// ============================================================================

export function nullSessionIdentity(sessionId: ChatSessionId): ChatSessionIdentity {
  return Object.freeze({
    sessionId,
    userId: `user:${String(sessionId)}` as ChatState['sessions'][ChatSessionId]['identity']['userId'],
    displayName: 'UNKNOWN ACTOR',
    role: 'PLAYER',
    entitlementTier: null,
    factionId: null,
  });
}

export function nullSessionState(sessionId: ChatSessionId): ChatSessionState {
  return Object.freeze({
    identity: nullSessionIdentity(sessionId),
    roomIds: Object.freeze([]),
    connectionState: 'DISCONNECTED',
    joinedAt: asUnixMs(0),
    lastSeenAt: asUnixMs(0),
    mutedUntil: null,
    shadowMuted: false,
    invisible: false,
    transportMetadata: Object.freeze({}),
  });
}

// ============================================================================
// MARK: Default logger
// ============================================================================

export function createDefaultPresenceLogger(): ChatPresenceStateLoggerPort {
  return {
    debug: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

// ============================================================================
// MARK: Presence watch bus
// ============================================================================

export type PresenceWatchEventKind =
  | 'SNAPSHOT_UPSERTED'
  | 'SNAPSHOT_REMOVED'
  | 'SESSION_RECONCILED'
  | 'ROOM_RECONCILED'
  | 'MAINTENANCE_SWEPT'
  | 'MODE_CHANGED'
  | 'VISIBILITY_CHANGED';

export interface PresenceWatchEvent {
  readonly kind: PresenceWatchEventKind;
  readonly roomId: ChatRoomId | null;
  readonly sessionId: ChatSessionId | null;
  readonly detail: string;
  readonly occurredAt: UnixMs;
}

export class PresenceWatchBus {
  private readonly handlers: Array<(evt: PresenceWatchEvent) => void> = [];

  subscribe(handler: (evt: PresenceWatchEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  emit(evt: PresenceWatchEvent): void {
    for (const h of this.handlers) {
      try { h(evt); } catch { /* noop */ }
    }
  }

  emitUpsert(roomId: ChatRoomId, sessionId: ChatSessionId): void {
    this.emit({ kind: 'SNAPSHOT_UPSERTED', roomId, sessionId, detail: `upserted ${sessionId} in ${roomId}`, occurredAt: asUnixMs(Date.now()) });
  }

  emitRemove(roomId: ChatRoomId, sessionId: ChatSessionId): void {
    this.emit({ kind: 'SNAPSHOT_REMOVED', roomId, sessionId, detail: `removed ${sessionId} from ${roomId}`, occurredAt: asUnixMs(Date.now()) });
  }

  emitModeChange(sessionId: ChatSessionId, oldMode: ChatPresenceMode, newMode: ChatPresenceMode): void {
    this.emit({ kind: 'MODE_CHANGED', roomId: null, sessionId, detail: `${oldMode}->${newMode}`, occurredAt: asUnixMs(Date.now()) });
  }
}

// ============================================================================
// MARK: Presence fingerprint
// ============================================================================

export interface PresenceFingerprint {
  readonly roomId: ChatRoomId;
  readonly hash: string;
  readonly snapshotCount: number;
  readonly computedAt: UnixMs;
}

export function computePresenceFingerprint(
  roomId: ChatRoomId,
  snapshots: readonly ChatPresenceSnapshot[],
): PresenceFingerprint {
  const sorted = [...snapshots].sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  const parts = sorted.map((s) => `${s.sessionId}:${s.mode}:${s.visible}`);
  let h = 5381;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
    }
  }
  return Object.freeze({
    roomId,
    hash: h.toString(16).padStart(8, '0'),
    snapshotCount: snapshots.length,
    computedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Presence velocity (join/leave rate)
// ============================================================================

export interface PresenceVelocityEntry {
  readonly roomId: ChatRoomId;
  readonly joinsInWindow: number;
  readonly leavesInWindow: number;
  readonly netChange: number;
  readonly windowMs: number;
  readonly generatedAt: UnixMs;
}

export function computePresenceVelocity(
  roomId: ChatRoomId,
  addedTimestamps: readonly UnixMs[],
  removedTimestamps: readonly UnixMs[],
  windowMs: number = 60_000,
  nowMs: number = Date.now(),
): PresenceVelocityEntry {
  const cutoff = asUnixMs(nowMs - windowMs);
  const joins = addedTimestamps.filter((t) => t >= cutoff).length;
  const leaves = removedTimestamps.filter((t) => t >= cutoff).length;
  return Object.freeze({
    roomId,
    joinsInWindow: joins,
    leavesInWindow: leaves,
    netChange: joins - leaves,
    windowMs,
    generatedAt: asUnixMs(nowMs),
  });
}

// ============================================================================
// MARK: Presence cohort report
// ============================================================================

export interface PresenceCohortReport {
  readonly totalRooms: number;
  readonly totalSessions: number;
  readonly modeDistribution: Record<ChatPresenceMode, number>;
  readonly roleDistribution: Record<ChatSessionRole, number>;
  readonly avgOccupancyPerRoom: number;
  readonly mostPopulousRoomId: ChatRoomId | null;
  readonly generatedAt: UnixMs;
}

export function buildPresenceCohortReport(
  state: AuthoritativePresenceState,
  sessions: ReadonlyMap<ChatSessionId, ChatSessionState>,
): PresenceCohortReport {
  const modeDist: Record<string, number> = {};
  const roleDist: Record<string, number> = {};
  const occupancyByRoom: Map<string, number> = new Map();

  for (const [_sessionId, snapshot] of state.snapshots) {
    modeDist[snapshot.mode] = (modeDist[snapshot.mode] ?? 0) + 1;
    occupancyByRoom.set(snapshot.roomId, (occupancyByRoom.get(snapshot.roomId) ?? 0) + 1);

    const session = sessions.get(snapshot.sessionId as ChatSessionId);
    if (session) {
      const role = session.identity.role;
      roleDist[role] = (roleDist[role] ?? 0) + 1;
    }
  }

  let mostPopulous: ChatRoomId | null = null;
  let maxOcc = 0;
  for (const [rid, cnt] of occupancyByRoom) {
    if (cnt > maxOcc) { maxOcc = cnt; mostPopulous = rid as ChatRoomId; }
  }

  const totalSessions = state.snapshots.size;
  const totalRooms = occupancyByRoom.size;

  return Object.freeze({
    totalRooms,
    totalSessions,
    modeDistribution: modeDist as Record<ChatPresenceMode, number>,
    roleDistribution: roleDist as Record<ChatSessionRole, number>,
    avgOccupancyPerRoom: totalRooms > 0 ? totalSessions / totalRooms : 0,
    mostPopulousRoomId: mostPopulous,
    generatedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Presence stale detection
// ============================================================================

export interface StalePresenceEntry {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly lastSeenAt: UnixMs;
  readonly staleAgeMs: number;
  readonly staleBand: 'FRESH' | 'AGING' | 'STALE' | 'DEAD';
}

export interface StalePresenceReport {
  readonly entries: readonly StalePresenceEntry[];
  readonly staleCount: number;
  readonly deadCount: number;
  readonly generatedAt: UnixMs;
}

export function detectStalePresence(
  snapshots: readonly ChatPresenceSnapshot[],
  sessions: ReadonlyMap<ChatSessionId, ChatSessionState>,
  nowMs: number = Date.now(),
  staleThresholdMs: number = 5 * 60_000,
  deadThresholdMs: number = 30 * 60_000,
): StalePresenceReport {
  const entries: StalePresenceEntry[] = [];
  for (const snap of snapshots) {
    const session = sessions.get(snap.sessionId as ChatSessionId);
    const lastSeen = session?.lastSeenAt ?? asUnixMs(0);
    const age = nowMs - lastSeen;
    const band: StalePresenceEntry['staleBand'] =
      age >= deadThresholdMs ? 'DEAD'
      : age >= staleThresholdMs ? 'STALE'
      : age >= staleThresholdMs / 2 ? 'AGING'
      : 'FRESH';
    entries.push(Object.freeze({ sessionId: snap.sessionId as ChatSessionId, roomId: snap.roomId as ChatRoomId, lastSeenAt: lastSeen, staleAgeMs: age, staleBand: band }));
  }
  const staleCount = entries.filter((e) => e.staleBand === 'STALE').length;
  const deadCount = entries.filter((e) => e.staleBand === 'DEAD').length;
  return Object.freeze({ entries: Object.freeze(entries), staleCount, deadCount, generatedAt: asUnixMs(nowMs) });
}

// ============================================================================
// MARK: Presence heat map
// ============================================================================

export interface PresenceHeatEntry {
  readonly roomId: ChatRoomId;
  readonly visibleCount: number;
  readonly hiddenCount: number;
  readonly spectatorCount: number;
  readonly totalCount: number;
  readonly heatScore: number;
}

export interface PresenceHeatMap {
  readonly entries: readonly PresenceHeatEntry[];
  readonly hottestRoomId: ChatRoomId | null;
  readonly generatedAt: UnixMs;
}

export function buildPresenceHeatMap(state: AuthoritativePresenceState): PresenceHeatMap {
  const byRoom = new Map<string, { visible: number; hidden: number; spectator: number }>();

  for (const [_sid, snap] of state.snapshots) {
    const r = byRoom.get(snap.roomId) ?? { visible: 0, hidden: 0, spectator: 0 };
    if (snap.mode === 'SPECTATING') r.spectator++;
    else if (snap.visible) r.visible++;
    else r.hidden++;
    byRoom.set(snap.roomId, r);
  }

  const entries: PresenceHeatEntry[] = [];
  let hottest: ChatRoomId | null = null;
  let maxHeat = 0;

  for (const [roomId, counts] of byRoom) {
    const total = counts.visible + counts.hidden + counts.spectator;
    const heatScore = counts.visible * 1.0 + counts.spectator * 0.4 + counts.hidden * 0.1;
    entries.push(Object.freeze({ roomId: roomId as ChatRoomId, visibleCount: counts.visible, hiddenCount: counts.hidden, spectatorCount: counts.spectator, totalCount: total, heatScore }));
    if (heatScore > maxHeat) { maxHeat = heatScore; hottest = roomId as ChatRoomId; }
  }

  entries.sort((a, b) => b.heatScore - a.heatScore);
  return Object.freeze({ entries: Object.freeze(entries), hottestRoomId: hottest, generatedAt: asUnixMs(Date.now()) });
}

// ============================================================================
// MARK: Presence audience eligibility
// ============================================================================

export interface AudienceEligibilityResult {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly isEligible: boolean;
  readonly reasons: readonly string[];
}

export function checkAudienceHeatEligibility(
  snapshot: ChatPresenceSnapshot,
  session: ChatSessionState,
): AudienceEligibilityResult {
  const reasons: string[] = [];
  let eligible = true;

  if (!snapshot.visible) { eligible = false; reasons.push('not visible'); }
  if (snapshot.mode === 'SPECTATING') { eligible = false; reasons.push('spectating'); }
  if (session.shadowMuted) { eligible = false; reasons.push('shadow muted'); }
  if (session.mutedUntil !== null && session.mutedUntil > asUnixMs(Date.now())) {
    eligible = false; reasons.push('temporarily muted');
  }
  if (session.connectionState === 'DISCONNECTED') { eligible = false; reasons.push('disconnected'); }
  if (session.identity.role === 'SYSTEM') { eligible = false; reasons.push('system role'); }

  return Object.freeze({ sessionId: snapshot.sessionId as ChatSessionId, roomId: snapshot.roomId as ChatRoomId, isEligible: eligible, reasons: Object.freeze(reasons) });
}

// ============================================================================
// MARK: Presence batch eligibility check
// ============================================================================

export interface BatchAudienceEligibilityResult {
  readonly eligible: readonly AudienceEligibilityResult[];
  readonly ineligible: readonly AudienceEligibilityResult[];
  readonly eligibleCount: number;
  readonly ineligibleCount: number;
  readonly roomId: ChatRoomId;
}

export function checkBatchAudienceHeatEligibility(
  roomId: ChatRoomId,
  snapshots: readonly ChatPresenceSnapshot[],
  sessions: ReadonlyMap<ChatSessionId, ChatSessionState>,
): BatchAudienceEligibilityResult {
  const eligible: AudienceEligibilityResult[] = [];
  const ineligible: AudienceEligibilityResult[] = [];

  for (const snap of snapshots) {
    if (snap.roomId !== roomId) continue;
    const session = sessions.get(snap.sessionId as ChatSessionId);
    if (!session) {
      ineligible.push(Object.freeze({ sessionId: snap.sessionId as ChatSessionId, roomId, isEligible: false, reasons: Object.freeze(['no session found']) }));
      continue;
    }
    const result = checkAudienceHeatEligibility(snap, session);
    if (result.isEligible) eligible.push(result);
    else ineligible.push(result);
  }

  return Object.freeze({ eligible: Object.freeze(eligible), ineligible: Object.freeze(ineligible), eligibleCount: eligible.length, ineligibleCount: ineligible.length, roomId });
}

// ============================================================================
// MARK: Presence snapshot diff builder
// ============================================================================

export interface PresenceSnapshotDiff {
  readonly added: readonly ChatPresenceSnapshot[];
  readonly removed: readonly string[];
  readonly modeChanged: readonly { readonly sessionId: string; readonly oldMode: ChatPresenceMode; readonly newMode: ChatPresenceMode }[];
  readonly visibilityChanged: readonly { readonly sessionId: string; readonly nowVisible: boolean }[];
}

export function buildPresenceSnapshotDiff(
  before: ReadonlyMap<string, ChatPresenceSnapshot>,
  after: ReadonlyMap<string, ChatPresenceSnapshot>,
): PresenceSnapshotDiff {
  const added: ChatPresenceSnapshot[] = [];
  const removed: string[] = [];
  const modeChanged: { sessionId: string; oldMode: ChatPresenceMode; newMode: ChatPresenceMode }[] = [];
  const visibilityChanged: { sessionId: string; nowVisible: boolean }[] = [];

  for (const [sid, snap] of after) {
    if (!before.has(sid)) {
      added.push(snap);
    } else {
      const prev = before.get(sid)!;
      if (prev.mode !== snap.mode) modeChanged.push({ sessionId: sid, oldMode: prev.mode, newMode: snap.mode });
      if (prev.visible !== snap.visible) visibilityChanged.push({ sessionId: sid, nowVisible: snap.visible });
    }
  }

  for (const sid of before.keys()) {
    if (!after.has(sid)) removed.push(sid);
  }

  return Object.freeze({
    added: Object.freeze(added),
    removed: Object.freeze(removed),
    modeChanged: Object.freeze(modeChanged),
    visibilityChanged: Object.freeze(visibilityChanged),
  });
}

// ============================================================================
// MARK: Presence mode transition rules
// ============================================================================

export interface PresenceModeTransitionRule {
  readonly from: ChatPresenceMode;
  readonly to: ChatPresenceMode;
  readonly allowed: boolean;
  readonly reason: string;
}

export const PRESENCE_MODE_TRANSITION_RULES: readonly PresenceModeTransitionRule[] = Object.freeze([
  { from: 'ONLINE', to: 'AWAY', allowed: true, reason: 'Normal idle transition' },
  { from: 'ONLINE', to: 'RECONNECTING', allowed: true, reason: 'Transport lost' },
  { from: 'ONLINE', to: 'DISCONNECTED', allowed: true, reason: 'Session closed' },
  { from: 'ONLINE', to: 'SPECTATING', allowed: true, reason: 'Player switches to observe' },
  { from: 'AWAY', to: 'ONLINE', allowed: true, reason: 'Activity resumed' },
  { from: 'AWAY', to: 'DISCONNECTED', allowed: true, reason: 'Session expired during idle' },
  { from: 'RECONNECTING', to: 'ONLINE', allowed: true, reason: 'Transport restored' },
  { from: 'RECONNECTING', to: 'DISCONNECTED', allowed: true, reason: 'Reconnect timeout' },
  { from: 'SPECTATING', to: 'ONLINE', allowed: true, reason: 'Player re-engages' },
  { from: 'SPECTATING', to: 'DISCONNECTED', allowed: true, reason: 'Session closed while spectating' },
  { from: 'DISCONNECTED', to: 'RECONNECTING', allowed: true, reason: 'Reconnect attempt' },
  { from: 'DISCONNECTED', to: 'ONLINE', allowed: false, reason: 'Must go through RECONNECTING first' },
]);

export function isPresenceModeTransitionAllowed(
  from: ChatPresenceMode,
  to: ChatPresenceMode,
): boolean {
  if (from === to) return true;
  const rule = PRESENCE_MODE_TRANSITION_RULES.find((r) => r.from === from && r.to === to);
  return rule?.allowed ?? false;
}

export function getPresenceModeTransitionReason(
  from: ChatPresenceMode,
  to: ChatPresenceMode,
): string {
  if (from === to) return 'No change';
  const rule = PRESENCE_MODE_TRANSITION_RULES.find((r) => r.from === from && r.to === to);
  return rule?.reason ?? 'Unknown transition';
}

// ============================================================================
// MARK: Presence occupancy forecaster
// ============================================================================

export interface OccupancyForecastEntry {
  readonly roomId: ChatRoomId;
  readonly currentCount: number;
  readonly forecastedCount: number;
  readonly forecastWindowMs: number;
  readonly confidence: number;
  readonly trend: 'GROWING' | 'SHRINKING' | 'STABLE';
}

export function forecastOccupancy(
  roomId: ChatRoomId,
  currentCount: number,
  historicalCounts: readonly { readonly count: number; readonly recordedAt: UnixMs }[],
  forecastWindowMs: number = 5 * 60_000,
): OccupancyForecastEntry {
  if (historicalCounts.length < 2) {
    return Object.freeze({ roomId, currentCount, forecastedCount: currentCount, forecastWindowMs, confidence: 0.1, trend: 'STABLE' });
  }

  const sorted = [...historicalCounts].sort((a, b) => a.recordedAt - b.recordedAt);
  const last = sorted[sorted.length - 1];
  const first = sorted[0];
  const timeDiffMs = last.recordedAt - first.recordedAt;
  const countDiff = last.count - first.count;
  const ratePerMs = timeDiffMs > 0 ? countDiff / timeDiffMs : 0;

  const forecasted = Math.max(0, Math.round(currentCount + ratePerMs * forecastWindowMs));
  const confidence = Math.min(0.9, historicalCounts.length / 20);
  const trend: OccupancyForecastEntry['trend'] = ratePerMs > 0.001 ? 'GROWING' : ratePerMs < -0.001 ? 'SHRINKING' : 'STABLE';

  return Object.freeze({ roomId, currentCount, forecastedCount: forecasted, forecastWindowMs, confidence, trend });
}

// ============================================================================
// MARK: Presence role gate
// ============================================================================

export interface PresenceRoleGateResult {
  readonly allowed: boolean;
  readonly role: ChatSessionRole;
  readonly requiredRoles: readonly ChatSessionRole[];
  readonly reason: string;
}

export function checkPresenceRoleGate(
  session: ChatSessionState,
  requiredRoles: readonly ChatSessionRole[],
): PresenceRoleGateResult {
  const role = session.identity.role;
  const allowed = requiredRoles.includes(role);
  return Object.freeze({
    allowed,
    role,
    requiredRoles,
    reason: allowed ? `Role ${role} is permitted` : `Role ${role} not in allowed set`,
  });
}

// ============================================================================
// MARK: Presence module constants
// ============================================================================

export const CHAT_PRESENCE_MODULE_NAME = 'ChatPresenceState' as const;
export const CHAT_PRESENCE_MODULE_VERSION = '3.1.0' as const;

export const CHAT_PRESENCE_LAWS = Object.freeze([
  'Presence truth is owned by the backend; frontend mirrors are read-only.',
  'All mode transitions must be validated against PRESENCE_MODE_TRANSITION_RULES.',
  'Invisible sessions are never eligible for audience heat calculations.',
  'Shadow-muted sessions are never projected to other participants.',
  'Stale presence entries older than dead threshold must be swept before session recycling.',
  'Occupancy counts must reflect snapshot.visible === true entries only for heat purposes.',
  'Presence diffs must be computed atomically — no partial diff emission.',
]);

export const CHAT_PRESENCE_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_PRESENCE_MODULE_NAME,
  version: CHAT_PRESENCE_MODULE_VERSION,
  laws: CHAT_PRESENCE_LAWS,
  supportedModes: ['ONLINE', 'AWAY', 'RECONNECTING', 'DISCONNECTED', 'SPECTATING'] as const,
  supportedRoles: ['PLAYER', 'NPC', 'MODERATOR', 'SPECTATOR', 'SYSTEM'] as const,
  staleThresholdMs: 5 * 60_000,
  deadThresholdMs: 30 * 60_000,
});

// ============================================================================
// MARK: Presence reconnect backoff policy
// ============================================================================

export interface ReconnectBackoffPolicy {
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly multiplier: number;
  readonly jitterFraction: number;
}

export const DEFAULT_RECONNECT_BACKOFF_POLICY: ReconnectBackoffPolicy = Object.freeze({
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  multiplier: 2,
  jitterFraction: 0.2,
});

export function computeReconnectDelay(
  attemptNumber: number,
  policy: ReconnectBackoffPolicy = DEFAULT_RECONNECT_BACKOFF_POLICY,
  rng: () => number = Math.random,
): number {
  const base = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * Math.pow(policy.multiplier, attemptNumber),
  );
  const jitter = base * policy.jitterFraction * (rng() * 2 - 1);
  return Math.max(policy.baseDelayMs, base + jitter);
}

// ============================================================================
// MARK: Presence session timeline
// ============================================================================

export interface PresenceSessionTimelineEntry {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly mode: ChatPresenceMode;
  readonly occurredAt: UnixMs;
  readonly eventKind: 'JOINED' | 'LEFT' | 'MODE_CHANGED' | 'VISIBILITY_CHANGED';
}

export interface PresenceSessionTimeline {
  readonly sessionId: ChatSessionId;
  readonly entries: readonly PresenceSessionTimelineEntry[];
  readonly firstJoinAt: UnixMs | null;
  readonly lastEventAt: UnixMs | null;
  readonly totalModeChanges: number;
}

export function buildPresenceSessionTimeline(
  sessionId: ChatSessionId,
  events: readonly PresenceWatchEvent[],
): PresenceSessionTimeline {
  const sessionEvents = events.filter((e) => e.sessionId === sessionId);
  const entries: PresenceSessionTimelineEntry[] = [];

  for (const ev of sessionEvents) {
    let kind: PresenceSessionTimelineEntry['eventKind'];
    switch (ev.kind) {
      case 'SNAPSHOT_UPSERTED': kind = 'JOINED'; break;
      case 'SNAPSHOT_REMOVED': kind = 'LEFT'; break;
      case 'MODE_CHANGED': kind = 'MODE_CHANGED'; break;
      case 'VISIBILITY_CHANGED': kind = 'VISIBILITY_CHANGED'; break;
      default: continue;
    }
    entries.push(Object.freeze({
      sessionId,
      roomId: ev.roomId ?? '' as ChatRoomId,
      mode: 'ONLINE' as ChatPresenceMode,
      occurredAt: ev.occurredAt,
      eventKind: kind,
    }));
  }

  const firstJoin = entries.find((e) => e.eventKind === 'JOINED')?.occurredAt ?? null;
  const lastEvent = entries.length > 0 ? entries[entries.length - 1].occurredAt : null;
  const modeChanges = entries.filter((e) => e.eventKind === 'MODE_CHANGED').length;

  return Object.freeze({
    sessionId,
    entries: Object.freeze(entries),
    firstJoinAt: firstJoin,
    lastEventAt: lastEvent,
    totalModeChanges: modeChanges,
  });
}

// ============================================================================
// MARK: Presence room capacity policy
// ============================================================================

export interface RoomCapacityPolicy {
  readonly roomKind: ChatRoomKind;
  readonly maxOccupants: number;
  readonly softCap: number;
  readonly allowSpectators: boolean;
  readonly spectatorCap: number;
}

export const DEFAULT_ROOM_CAPACITY_POLICIES: ReadonlyMap<ChatRoomKind, RoomCapacityPolicy> = new Map([
  ['MAIN', Object.freeze({ roomKind: 'MAIN' as ChatRoomKind, maxOccupants: 500, softCap: 400, allowSpectators: true, spectatorCap: 200 })],
  ['BATTLE', Object.freeze({ roomKind: 'BATTLE' as ChatRoomKind, maxOccupants: 50, softCap: 40, allowSpectators: true, spectatorCap: 500 })],
  ['LOBBY', Object.freeze({ roomKind: 'LOBBY' as ChatRoomKind, maxOccupants: 100, softCap: 80, allowSpectators: false, spectatorCap: 0 })],
  ['DM', Object.freeze({ roomKind: 'DM' as ChatRoomKind, maxOccupants: 2, softCap: 2, allowSpectators: false, spectatorCap: 0 })],
  ['ADMIN', Object.freeze({ roomKind: 'ADMIN' as ChatRoomKind, maxOccupants: 20, softCap: 15, allowSpectators: false, spectatorCap: 0 })],
]) as ReadonlyMap<ChatRoomKind, RoomCapacityPolicy>;

export function checkRoomCapacity(
  roomKind: ChatRoomKind,
  currentOccupants: number,
  currentSpectators: number,
  joiningAsSpectator: boolean = false,
  policies: ReadonlyMap<ChatRoomKind, RoomCapacityPolicy> = DEFAULT_ROOM_CAPACITY_POLICIES,
): { readonly allowed: boolean; readonly reason: string; readonly nearCapacity: boolean } {
  const policy = policies.get(roomKind);
  if (!policy) return Object.freeze({ allowed: true, reason: 'No policy for room kind', nearCapacity: false });

  if (joiningAsSpectator) {
    if (!policy.allowSpectators) return Object.freeze({ allowed: false, reason: 'Spectators not allowed', nearCapacity: false });
    if (currentSpectators >= policy.spectatorCap) return Object.freeze({ allowed: false, reason: 'Spectator cap reached', nearCapacity: true });
    return Object.freeze({ allowed: true, reason: 'Spectator slot available', nearCapacity: currentSpectators >= policy.spectatorCap * 0.9 });
  }

  if (currentOccupants >= policy.maxOccupants) return Object.freeze({ allowed: false, reason: 'Room at capacity', nearCapacity: true });
  return Object.freeze({ allowed: true, reason: 'Slot available', nearCapacity: currentOccupants >= policy.softCap });
}

// ============================================================================
// MARK: Presence room snapshot aggregator
// ============================================================================

export interface RoomSnapshotAggregate {
  readonly roomId: ChatRoomId;
  readonly onlineCount: number;
  readonly awayCount: number;
  readonly reconnectingCount: number;
  readonly spectatingCount: number;
  readonly disconnectedCount: number;
  readonly visibleCount: number;
  readonly hiddenCount: number;
  readonly totalCount: number;
  readonly playerCount: number;
  readonly npcCount: number;
  readonly moderatorCount: number;
}

export function aggregateRoomSnapshots(
  roomId: ChatRoomId,
  snapshots: readonly ChatPresenceSnapshot[],
  sessions: ReadonlyMap<ChatSessionId, ChatSessionState>,
): RoomSnapshotAggregate {
  let online = 0, away = 0, reconnecting = 0, spectating = 0, disconnected = 0;
  let visible = 0, hidden = 0;
  let players = 0, npcs = 0, mods = 0;

  for (const snap of snapshots) {
    if (snap.roomId !== roomId) continue;
    switch (snap.mode) {
      case 'ONLINE': online++; break;
      case 'AWAY': away++; break;
      case 'RECONNECTING': reconnecting++; break;
      case 'SPECTATING': spectating++; break;
      case 'DISCONNECTED': disconnected++; break;
    }
    if (snap.visible) visible++; else hidden++;

    const session = sessions.get(snap.sessionId as ChatSessionId);
    if (session) {
      if (session.identity.role === 'PLAYER') players++;
      else if (session.identity.role === 'NPC') npcs++;
      else if (session.identity.role === 'MODERATOR') mods++;
    }
  }

  const total = online + away + reconnecting + spectating + disconnected;
  return Object.freeze({ roomId, onlineCount: online, awayCount: away, reconnectingCount: reconnecting, spectatingCount: spectating, disconnectedCount: disconnected, visibleCount: visible, hiddenCount: hidden, totalCount: total, playerCount: players, npcCount: npcs, moderatorCount: mods });
}

// ============================================================================
// MARK: Presence eviction policy
// ============================================================================

export interface PresenceEvictionPolicy {
  readonly maxOccupantsBeforeEviction: number;
  readonly evictionOrder: readonly ('DISCONNECTED' | 'AWAY' | 'SPECTATING')[];
  readonly protectedRoles: readonly ChatSessionRole[];
}

export const DEFAULT_PRESENCE_EVICTION_POLICY: PresenceEvictionPolicy = Object.freeze({
  maxOccupantsBeforeEviction: 450,
  evictionOrder: Object.freeze(['DISCONNECTED', 'AWAY', 'SPECTATING'] as const),
  protectedRoles: Object.freeze(['MODERATOR', 'SYSTEM'] as const) as unknown as readonly ChatSessionRole[],
});

export interface EvictionCandidate {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly mode: ChatPresenceMode;
  readonly priority: number;
}

export function selectEvictionCandidates(
  snapshots: readonly ChatPresenceSnapshot[],
  sessions: ReadonlyMap<ChatSessionId, ChatSessionState>,
  policy: PresenceEvictionPolicy = DEFAULT_PRESENCE_EVICTION_POLICY,
  limit: number = 10,
): readonly EvictionCandidate[] {
  const candidates: EvictionCandidate[] = [];

  for (const snap of snapshots) {
    const session = sessions.get(snap.sessionId as ChatSessionId);
    if (session && (policy.protectedRoles as readonly string[]).includes(session.identity.role)) continue;

    const modeIdx = (policy.evictionOrder as readonly string[]).indexOf(snap.mode);
    if (modeIdx === -1) continue;

    candidates.push(Object.freeze({
      sessionId: snap.sessionId as ChatSessionId,
      roomId: snap.roomId as ChatRoomId,
      mode: snap.mode,
      priority: policy.evictionOrder.length - modeIdx,
    }));
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return Object.freeze(candidates.slice(0, limit));
}

// ============================================================================
// MARK: Presence state integrity validator
// ============================================================================

export interface PresenceIntegrityCheckResult {
  readonly passed: boolean;
  readonly issueCount: number;
  readonly issues: readonly string[];
  readonly checkedAt: UnixMs;
}

export function validatePresenceStateIntegrity(
  state: AuthoritativePresenceState,
  sessions: ReadonlyMap<ChatSessionId, ChatSessionState>,
  rooms: ReadonlyMap<ChatRoomId, ChatRoomState>,
): PresenceIntegrityCheckResult {
  const issues: string[] = [];

  for (const [key, snap] of state.snapshots) {
    // Session existence check
    if (!sessions.has(snap.sessionId as ChatSessionId)) {
      issues.push(`Orphaned presence: session ${snap.sessionId} has no session record (key=${key})`);
    }
    // Room existence check
    if (!rooms.has(snap.roomId as ChatRoomId)) {
      issues.push(`Orphaned presence: room ${snap.roomId} does not exist (session=${snap.sessionId})`);
    }
    // Mode sanity
    const VALID_MODES: ChatPresenceMode[] = ['ONLINE', 'AWAY', 'RECONNECTING', 'DISCONNECTED', 'SPECTATING'];
    if (!VALID_MODES.includes(snap.mode)) {
      issues.push(`Invalid mode '${snap.mode}' for session ${snap.sessionId}`);
    }
  }

  return Object.freeze({ passed: issues.length === 0, issueCount: issues.length, issues: Object.freeze(issues), checkedAt: asUnixMs(Date.now()) });
}

// ============================================================================
// MARK: Presence epoch tracker
// ============================================================================

export interface PresenceEpoch {
  readonly roomId: ChatRoomId;
  readonly epochStartMs: UnixMs;
  readonly epochEndMs: UnixMs;
  readonly peakOccupancy: number;
  readonly minOccupancy: number;
  readonly avgOccupancy: number;
  readonly totalJoins: number;
  readonly totalLeaves: number;
}

export function buildPresenceEpoch(
  roomId: ChatRoomId,
  occupancySamples: readonly { readonly count: number; readonly recordedAt: UnixMs }[],
  joinTimestamps: readonly UnixMs[],
  leaveTimestamps: readonly UnixMs[],
): PresenceEpoch {
  const epochStartMs = occupancySamples.length > 0 ? occupancySamples[0].recordedAt : asUnixMs(Date.now());
  const epochEndMs = occupancySamples.length > 0 ? occupancySamples[occupancySamples.length - 1].recordedAt : asUnixMs(Date.now());

  let peak = 0, min = Infinity, sum = 0;
  for (const s of occupancySamples) {
    if (s.count > peak) peak = s.count;
    if (s.count < min) min = s.count;
    sum += s.count;
  }
  const avg = occupancySamples.length > 0 ? sum / occupancySamples.length : 0;

  return Object.freeze({
    roomId,
    epochStartMs,
    epochEndMs,
    peakOccupancy: peak,
    minOccupancy: min === Infinity ? 0 : min,
    avgOccupancy: avg,
    totalJoins: joinTimestamps.filter((t) => t >= epochStartMs && t <= epochEndMs).length,
    totalLeaves: leaveTimestamps.filter((t) => t >= epochStartMs && t <= epochEndMs).length,
  });
}

// ============================================================================
// MARK: Presence pulse (periodic heartbeat tracking)
// ============================================================================

export interface PresencePulseRecord {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly pulseAt: UnixMs;
  readonly latencyMs: number | null;
}

export interface PresencePulseStore {
  record(entry: PresencePulseRecord): void;
  getLatest(sessionId: ChatSessionId): PresencePulseRecord | null;
  getAll(sessionId: ChatSessionId): readonly PresencePulseRecord[];
  getMissedCount(sessionId: ChatSessionId, windowMs: number, expectedIntervalMs: number, nowMs?: number): number;
  clear(sessionId: ChatSessionId): void;
}

export function createPresencePulseStore(): PresencePulseStore {
  const store = new Map<string, PresencePulseRecord[]>();

  return {
    record(entry: PresencePulseRecord): void {
      const list = store.get(entry.sessionId) ?? [];
      list.push(entry);
      if (list.length > 200) list.splice(0, list.length - 200);
      store.set(entry.sessionId, list);
    },
    getLatest(sessionId: ChatSessionId): PresencePulseRecord | null {
      const list = store.get(sessionId);
      if (!list || list.length === 0) return null;
      return list[list.length - 1];
    },
    getAll(sessionId: ChatSessionId): readonly PresencePulseRecord[] {
      return Object.freeze(store.get(sessionId) ?? []);
    },
    getMissedCount(sessionId: ChatSessionId, windowMs: number, expectedIntervalMs: number, nowMs: number = Date.now()): number {
      const list = store.get(sessionId) ?? [];
      const cutoff = asUnixMs(nowMs - windowMs);
      const inWindow = list.filter((p) => p.pulseAt >= cutoff);
      const expectedCount = Math.floor(windowMs / expectedIntervalMs);
      return Math.max(0, expectedCount - inWindow.length);
    },
    clear(sessionId: ChatSessionId): void {
      store.delete(sessionId);
    },
  };
}

// ============================================================================
// MARK: Presence extended authority (with watch bus + pulse)
// ============================================================================

export class ChatPresenceAuthorityExtended extends ChatPresenceAuthority {
  private readonly watchBus = new PresenceWatchBus();
  private readonly pulseStore = createPresencePulseStore();

  getWatchBus(): PresenceWatchBus { return this.watchBus; }
  getPulseStore(): PresencePulseStore { return this.pulseStore; }

  recordPulse(sessionId: ChatSessionId, roomId: ChatRoomId, latencyMs: number | null = null): void {
    this.pulseStore.record({ sessionId, roomId, pulseAt: asUnixMs(Date.now()), latencyMs });
  }

  getMissedPulses(sessionId: ChatSessionId, windowMs: number = 60_000, intervalMs: number = 5_000): number {
    return this.pulseStore.getMissedCount(sessionId, windowMs, intervalMs);
  }

  isSessionConsideredLost(sessionId: ChatSessionId, windowMs: number = 60_000, intervalMs: number = 5_000, threshold: number = 5): boolean {
    return this.getMissedPulses(sessionId, windowMs, intervalMs) >= threshold;
  }
}

// ============================================================================
// MARK: Presence snapshot annotation store
// ============================================================================

export interface PresenceAnnotation {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly tag: string;
  readonly value: string;
  readonly addedAt: UnixMs;
}

export class PresenceAnnotationStore {
  private readonly store = new Map<string, PresenceAnnotation[]>();

  private key(sessionId: ChatSessionId, roomId: ChatRoomId): string {
    return `${sessionId}::${roomId}`;
  }

  add(annotation: PresenceAnnotation): void {
    const k = this.key(annotation.sessionId, annotation.roomId);
    const list = this.store.get(k) ?? [];
    list.push(annotation);
    this.store.set(k, list);
  }

  get(sessionId: ChatSessionId, roomId: ChatRoomId): readonly PresenceAnnotation[] {
    return Object.freeze(this.store.get(this.key(sessionId, roomId)) ?? []);
  }

  getByTag(sessionId: ChatSessionId, roomId: ChatRoomId, tag: string): readonly PresenceAnnotation[] {
    return this.get(sessionId, roomId).filter((a) => a.tag === tag);
  }

  remove(sessionId: ChatSessionId, roomId: ChatRoomId, tag: string): void {
    const k = this.key(sessionId, roomId);
    const list = this.store.get(k) ?? [];
    this.store.set(k, list.filter((a) => a.tag !== tag));
  }

  clear(sessionId: ChatSessionId, roomId: ChatRoomId): void {
    this.store.delete(this.key(sessionId, roomId));
  }

  clearSession(sessionId: ChatSessionId): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(`${sessionId}::`)) this.store.delete(k);
    }
  }
}

// ============================================================================
// MARK: Presence snapshot projection (external view)
// ============================================================================

export interface ExternalPresenceView {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly mode: ChatPresenceMode;
  readonly visible: boolean;
  readonly role: ChatSessionRole | null;
  readonly displayName: string | null;
  readonly projectedAt: UnixMs;
}

export function projectExternalPresenceView(
  snapshot: ChatPresenceSnapshot,
  session: ChatSessionState | null,
): ExternalPresenceView {
  return Object.freeze({
    sessionId: snapshot.sessionId as ChatSessionId,
    roomId: snapshot.roomId as ChatRoomId,
    mode: snapshot.mode,
    visible: snapshot.visible,
    role: session?.identity.role ?? null,
    displayName: session?.identity.displayName ?? null,
    projectedAt: asUnixMs(Date.now()),
  });
}

export function projectExternalPresenceViewBatch(
  snapshots: readonly ChatPresenceSnapshot[],
  sessions: ReadonlyMap<ChatSessionId, ChatSessionState>,
): readonly ExternalPresenceView[] {
  return Object.freeze(
    snapshots.map((snap) => projectExternalPresenceView(snap, sessions.get(snap.sessionId as ChatSessionId) ?? null)),
  );
}

// ============================================================================
// MARK: Presence visibility override store
// ============================================================================

export interface PresenceVisibilityOverride {
  readonly sessionId: ChatSessionId;
  readonly forcedVisible: boolean | null;
  readonly reason: string;
  readonly expiresAt: UnixMs | null;
  readonly setAt: UnixMs;
}

export class PresenceVisibilityOverrideStore {
  private readonly overrides = new Map<string, PresenceVisibilityOverride>();

  set(override: PresenceVisibilityOverride): void {
    this.overrides.set(override.sessionId, override);
  }

  get(sessionId: ChatSessionId): PresenceVisibilityOverride | null {
    return this.overrides.get(sessionId) ?? null;
  }

  isActive(sessionId: ChatSessionId, nowMs: number = Date.now()): boolean {
    const override = this.overrides.get(sessionId);
    if (!override) return false;
    if (override.expiresAt !== null && override.expiresAt < asUnixMs(nowMs)) {
      this.overrides.delete(sessionId);
      return false;
    }
    return true;
  }

  resolve(sessionId: ChatSessionId, defaultVisible: boolean, nowMs: number = Date.now()): boolean {
    if (!this.isActive(sessionId, nowMs)) return defaultVisible;
    return this.overrides.get(sessionId)?.forcedVisible ?? defaultVisible;
  }

  remove(sessionId: ChatSessionId): void {
    this.overrides.delete(sessionId);
  }

  purgeExpired(nowMs: number = Date.now()): number {
    let count = 0;
    for (const [sid, override] of this.overrides) {
      if (override.expiresAt !== null && override.expiresAt < asUnixMs(nowMs)) {
        this.overrides.delete(sid);
        count++;
      }
    }
    return count;
  }

  getAll(): readonly PresenceVisibilityOverride[] {
    return Object.freeze(Array.from(this.overrides.values()));
  }
}

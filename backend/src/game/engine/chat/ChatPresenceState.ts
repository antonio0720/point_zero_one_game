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

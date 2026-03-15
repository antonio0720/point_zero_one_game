/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE CHAT ROOM REGISTRY
 * FILE: pzo-server/src/chat/ChatRoomRegistry.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file is the server-side room and session registry that sits between:
 *
 * - socket transport intent,
 * - authoritative backend chat truth,
 * - legacy websocket / multiplayer donor files,
 * - fanout delivery,
 * - reconnect and replay continuity,
 * - presence / typing / cursor theater.
 *
 * Architectural law
 * -----------------
 * The registry is not the final source of transcript truth.
 * The authoritative backend chat engine still owns transcript mutation,
 * moderation, orchestration, replay semantics, and learning state.
 *
 * The registry owns:
 *
 * - socket/session attachment truth,
 * - room membership truth,
 * - room routing and socket.io room naming,
 * - coarse transport presence truth,
 * - reconnect windows,
 * - fanout target resolution,
 * - transport-visible occupancy snapshots,
 * - channel- and room-level delivery filtering,
 * - shadow mute / visibility transport controls,
 * - server-side audit snapshots for room topology.
 *
 * The registry does NOT own:
 *
 * - message moderation,
 * - transcript mutation,
 * - helper/hater selection,
 * - invasion authoring,
 * - policy learning or training labels,
 * - backend replay truth.
 *
 * Why this exists
 * ---------------
 * The current donor server lane still has fragmented room and socket logic in:
 *
 * - pzo-server/src/ws/socket-server.ts
 * - pzo-server/src/ws/room-manager.ts
 * - pzo-server/src/ws/action-validator.ts
 * - pzo-server/src/multiplayer/contracts.ts
 * - pzo-server/src/multiplayer/player.ts
 * - pzo-server/src/haters/HaterEngine.ts
 *
 * Those files are useful donors, but they are too thin and too fragmented to
 * serve as a production-grade chat transport substrate for an authoritative
 * backend chat simulation. This registry becomes the durable transport spine.
 * ============================================================================
 */

import { createHash, randomUUID } from 'node:crypto';
import type { Player, PlayerStatus } from '../multiplayer/player';

// ============================================================================
// MARK: Primitive aliases
// ============================================================================

export type ChatTransportRoomKind =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'LOBBY'
  | 'DIRECT'
  | 'SYSTEM'
  | 'RUN'
  | 'BATTLE'
  | 'SPECTATOR';

export type ChatTransportPresenceMode =
  | 'ONLINE'
  | 'AWAY'
  | 'HIDDEN'
  | 'SPECTATING'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'NPC_PRESENT'
  | 'HELPER_PRESENT'
  | 'HATER_PRESENT';

export type ChatTransportTypingMode =
  | 'IDLE'
  | 'COMPOSING'
  | 'PAUSED'
  | 'QUEUED'
  | 'SUPPRESSED';

export type ChatTransportVisibility =
  | 'VISIBLE'
  | 'SHADOW_HIDDEN'
  | 'TRANSPORT_MUTED'
  | 'READ_ONLY';

export type ChatTransportMembershipRole =
  | 'OWNER'
  | 'HOST'
  | 'MEMBER'
  | 'SPECTATOR'
  | 'NPC'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM';

export type ChatTransportAuthLevel =
  | 'ANON'
  | 'AUTHENTICATED'
  | 'ELEVATED'
  | 'SYSTEM'
  | 'INTERNAL';

export type ChatTransportStageMood =
  | 'CALM'
  | 'BUILDING'
  | 'TENSE'
  | 'HOSTILE'
  | 'PREDATORY'
  | 'MOURNFUL'
  | 'TRIUMPHANT';

export type ChatMountTarget =
  | 'BATTLE_HUD'
  | 'CLUB_UI'
  | 'EMPIRE_SCREEN'
  | 'GAME_BOARD'
  | 'LEAGUE_UI'
  | 'LOBBY_SCREEN'
  | 'PHANTOM_SCREEN'
  | 'PREDATOR_SCREEN'
  | 'SYNDICATE_SCREEN'
  | 'SYSTEM_OVERLAY'
  | 'UNKNOWN';

export type ChatSessionId = string;
export type ChatRoomId = string;
export type ChatSocketId = string;
export type ChatUserId = string;
export type ChatChannelId = string;
export type ChatCursorToken = string;
export type ChatNamespaceName = string;
export type ChatRunId = string;
export type ChatModeId = string;
export type ChatPartyId = string;
export type UnixMs = number;

// ============================================================================
// MARK: Configuration
// ============================================================================

export interface ChatRoomRegistryConfig {
  readonly reconnectWindowMs: number;
  readonly staleRoomTtlMs: number;
  readonly presenceExpiryMs: number;
  readonly typingExpiryMs: number;
  readonly maxSocketsPerSession: number;
  readonly maxRoomsPerSession: number;
  readonly maxSessionsPerUser: number;
  readonly maxOccupancyPerRoom: number;
  readonly preserveEmptyRoomsForMs: number;
  readonly auditHashAlgorithm: 'sha256';
  readonly defaultNamespace: ChatNamespaceName;
  readonly shadowRoomPrefix: string;
  readonly visibleRoomPrefix: string;
  readonly directRoomPrefix: string;
  readonly systemRoomPrefix: string;
  readonly runRoomPrefix: string;
  readonly battleRoomPrefix: string;
  readonly lobbyRoomPrefix: string;
  readonly syndicateRoomPrefix: string;
  readonly dealRoomPrefix: string;
  readonly globalRoomPrefix: string;
  readonly spectatorRoomPrefix: string;
}

export const DEFAULT_CHAT_ROOM_REGISTRY_CONFIG: Readonly<ChatRoomRegistryConfig> = Object.freeze({
  reconnectWindowMs: 45_000,
  staleRoomTtlMs: 15 * 60_000,
  presenceExpiryMs: 90_000,
  typingExpiryMs: 12_000,
  maxSocketsPerSession: 4,
  maxRoomsPerSession: 24,
  maxSessionsPerUser: 8,
  maxOccupancyPerRoom: 10_000,
  preserveEmptyRoomsForMs: 10 * 60_000,
  auditHashAlgorithm: 'sha256',
  defaultNamespace: '/chat',
  shadowRoomPrefix: 'chat-shadow',
  visibleRoomPrefix: 'chat-room',
  directRoomPrefix: 'chat-direct',
  systemRoomPrefix: 'chat-system',
  runRoomPrefix: 'chat-run',
  battleRoomPrefix: 'chat-battle',
  lobbyRoomPrefix: 'chat-lobby',
  syndicateRoomPrefix: 'chat-syndicate',
  dealRoomPrefix: 'chat-deal',
  globalRoomPrefix: 'chat-global',
  spectatorRoomPrefix: 'chat-spectator',
});

// ============================================================================
// MARK: External-facing seeds and snapshots
// ============================================================================

export interface ChatRoomSeed {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly kind: ChatTransportRoomKind;
  readonly namespace?: ChatNamespaceName;
  readonly mountTarget?: ChatMountTarget;
  readonly modeId?: ChatModeId | null;
  readonly runId?: ChatRunId | null;
  readonly partyId?: ChatPartyId | null;
  readonly label?: string | null;
  readonly topic?: string | null;
  readonly description?: string | null;
  readonly stageMood?: ChatTransportStageMood;
  readonly isShadow?: boolean;
  readonly isPrivate?: boolean;
  readonly isReadOnly?: boolean;
  readonly allowSpectators?: boolean;
  readonly allowPresenceBroadcast?: boolean;
  readonly allowTypingBroadcast?: boolean;
  readonly allowCursorBroadcast?: boolean;
  readonly allowDirectFanout?: boolean;
  readonly maxOccupancy?: number | null;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatTransportIdentity {
  readonly userId: ChatUserId;
  readonly username: string;
  readonly authLevel: ChatTransportAuthLevel;
  readonly status?: PlayerStatus;
  readonly avatarUrl?: string | null;
  readonly partyId?: ChatPartyId | null;
  readonly modeId?: ChatModeId | null;
  readonly runId?: ChatRunId | null;
  readonly traits?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatTransportSessionSeed {
  readonly sessionId?: ChatSessionId;
  readonly socketId: ChatSocketId;
  readonly namespace?: ChatNamespaceName;
  readonly identity: ChatTransportIdentity;
  readonly connectedAt?: UnixMs;
  readonly reconnectOf?: ChatSessionId | null;
  readonly serverNodeId?: string | null;
  readonly mountTarget?: ChatMountTarget | null;
  readonly clientVersion?: string | null;
  readonly transportFeatures?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatPresenceUpdate {
  readonly sessionId: ChatSessionId;
  readonly roomId?: ChatRoomId | null;
  readonly presenceMode: ChatTransportPresenceMode;
  readonly visibility?: ChatTransportVisibility;
  readonly note?: string | null;
  readonly observedAt?: UnixMs;
  readonly broadcast?: boolean;
}

export interface ChatTypingUpdate {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly typingMode: ChatTransportTypingMode;
  readonly observedAt?: UnixMs;
  readonly cursorToken?: ChatCursorToken | null;
}

export interface ChatCursorUpdate {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly cursorToken: ChatCursorToken;
  readonly observedAt?: UnixMs;
}

export interface ChatJoinRequest {
  readonly sessionId: ChatSessionId;
  readonly room: ChatRoomSeed;
  readonly role?: ChatTransportMembershipRole;
  readonly visibility?: ChatTransportVisibility;
  readonly joinedAt?: UnixMs;
  readonly explicitSocketRoomName?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatLeaveRequest {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly leftAt?: UnixMs;
  readonly reason?: string | null;
}

export interface ChatFanoutFilter {
  readonly includeSessionIds?: readonly ChatSessionId[];
  readonly excludeSessionIds?: readonly ChatSessionId[];
  readonly includeRoles?: readonly ChatTransportMembershipRole[];
  readonly excludeRoles?: readonly ChatTransportMembershipRole[];
  readonly includePresenceModes?: readonly ChatTransportPresenceMode[];
  readonly excludePresenceModes?: readonly ChatTransportPresenceMode[];
  readonly includeVisibility?: readonly ChatTransportVisibility[];
  readonly excludeVisibility?: readonly ChatTransportVisibility[];
  readonly onlyReadable?: boolean;
  readonly onlyWritable?: boolean;
  readonly includeShadowMembers?: boolean;
  readonly allowDirectFanoutOnly?: boolean;
}

export interface ChatFanoutTarget {
  readonly socketIds: readonly ChatSocketId[];
  readonly sessionIds: readonly ChatSessionId[];
  readonly socketRoomNames: readonly string[];
  readonly audienceSize: number;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
}

export interface ChatOccupancySnapshot {
  readonly roomId: ChatRoomId;
  readonly sessionCount: number;
  readonly uniqueUserCount: number;
  readonly memberCountVisible: number;
  readonly memberCountHidden: number;
  readonly memberCountShadow: number;
  readonly helperCount: number;
  readonly haterCount: number;
  readonly npcCount: number;
  readonly spectatorCount: number;
  readonly writableCount: number;
  readonly readOnlyCount: number;
}

export interface ChatCursorSnapshot {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly cursorToken: ChatCursorToken;
  readonly observedAt: UnixMs;
}

export interface ChatTypingSnapshot {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly typingMode: ChatTransportTypingMode;
  readonly observedAt: UnixMs;
  readonly expiresAt: UnixMs;
}

export interface ChatPresenceSnapshot {
  readonly sessionId: ChatSessionId;
  readonly roomId?: ChatRoomId | null;
  readonly presenceMode: ChatTransportPresenceMode;
  readonly visibility: ChatTransportVisibility;
  readonly observedAt: UnixMs;
  readonly expiresAt: UnixMs;
  readonly note?: string | null;
}

export interface ChatRoomSnapshot {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly kind: ChatTransportRoomKind;
  readonly namespace: ChatNamespaceName;
  readonly mountTarget: ChatMountTarget;
  readonly modeId: ChatModeId | null;
  readonly runId: ChatRunId | null;
  readonly partyId: ChatPartyId | null;
  readonly socketRoomName: string;
  readonly label: string | null;
  readonly topic: string | null;
  readonly description: string | null;
  readonly stageMood: ChatTransportStageMood;
  readonly isShadow: boolean;
  readonly isPrivate: boolean;
  readonly isReadOnly: boolean;
  readonly allowSpectators: boolean;
  readonly allowPresenceBroadcast: boolean;
  readonly allowTypingBroadcast: boolean;
  readonly allowCursorBroadcast: boolean;
  readonly allowDirectFanout: boolean;
  readonly maxOccupancy: number;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly lastOccupiedAt: UnixMs;
  readonly occupancy: ChatOccupancySnapshot;
  readonly memberSessionIds: readonly ChatSessionId[];
}

export interface ChatTransportSessionSnapshot {
  readonly sessionId: ChatSessionId;
  readonly socketIds: readonly ChatSocketId[];
  readonly namespace: ChatNamespaceName;
  readonly identity: ChatTransportIdentity;
  readonly connectedAt: UnixMs;
  readonly lastSeenAt: UnixMs;
  readonly reconnectDeadlineAt: UnixMs;
  readonly reconnectOf: ChatSessionId | null;
  readonly serverNodeId: string | null;
  readonly mountTarget: ChatMountTarget | null;
  readonly clientVersion: string | null;
  readonly transportFeatures: readonly string[];
  readonly status: 'ACTIVE' | 'RECONNECTING' | 'DISCONNECTED';
  readonly roomIds: readonly ChatRoomId[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatRegistryMetricsSnapshot {
  readonly roomCount: number;
  readonly sessionCount: number;
  readonly socketCount: number;
  readonly userCount: number;
  readonly membershipCount: number;
  readonly visibleMembershipCount: number;
  readonly hiddenMembershipCount: number;
  readonly shadowMembershipCount: number;
  readonly typingCount: number;
  readonly cursorCount: number;
  readonly activeRoomCount: number;
  readonly privateRoomCount: number;
  readonly shadowRoomCount: number;
  readonly directRoomCount: number;
  readonly maxRoomOccupancyObserved: number;
  readonly lastMutationAt: UnixMs;
}

export interface ChatRegistryAuditSnapshot {
  readonly generatedAt: UnixMs;
  readonly metrics: ChatRegistryMetricsSnapshot;
  readonly rooms: readonly ChatRoomSnapshot[];
  readonly sessions: readonly ChatTransportSessionSnapshot[];
  readonly hash: string;
}

export interface ChatRoomSelectionQuery {
  readonly namespace?: ChatNamespaceName;
  readonly kind?: ChatTransportRoomKind;
  readonly mountTarget?: ChatMountTarget;
  readonly modeId?: ChatModeId | null;
  readonly runId?: ChatRunId | null;
  readonly partyId?: ChatPartyId | null;
  readonly includeShadow?: boolean;
  readonly includePrivate?: boolean;
  readonly includeEmpty?: boolean;
  readonly tag?: string;
}

// ============================================================================
// MARK: Internal records
// ============================================================================

interface MutableChatRoomRecord {
  roomId: ChatRoomId;
  channelId: ChatChannelId;
  kind: ChatTransportRoomKind;
  namespace: ChatNamespaceName;
  mountTarget: ChatMountTarget;
  modeId: ChatModeId | null;
  runId: ChatRunId | null;
  partyId: ChatPartyId | null;
  socketRoomName: string;
  label: string | null;
  topic: string | null;
  description: string | null;
  stageMood: ChatTransportStageMood;
  isShadow: boolean;
  isPrivate: boolean;
  isReadOnly: boolean;
  allowSpectators: boolean;
  allowPresenceBroadcast: boolean;
  allowTypingBroadcast: boolean;
  allowCursorBroadcast: boolean;
  allowDirectFanout: boolean;
  maxOccupancy: number;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  lastOccupiedAt: UnixMs;
  membershipIds: Set<ChatSessionId>;
}

interface MutableChatSessionRecord {
  sessionId: ChatSessionId;
  socketIds: Set<ChatSocketId>;
  namespace: ChatNamespaceName;
  identity: ChatTransportIdentity;
  connectedAt: UnixMs;
  lastSeenAt: UnixMs;
  reconnectDeadlineAt: UnixMs;
  reconnectOf: ChatSessionId | null;
  serverNodeId: string | null;
  mountTarget: ChatMountTarget | null;
  clientVersion: string | null;
  transportFeatures: string[];
  status: 'ACTIVE' | 'RECONNECTING' | 'DISCONNECTED';
  roomIds: Set<ChatRoomId>;
  metadata: Record<string, unknown>;
}

interface MutableMembershipRecord {
  sessionId: ChatSessionId;
  roomId: ChatRoomId;
  role: ChatTransportMembershipRole;
  visibility: ChatTransportVisibility;
  joinedAt: UnixMs;
  updatedAt: UnixMs;
  writable: boolean;
  readable: boolean;
  metadata: Record<string, unknown>;
}

interface MutablePresenceRecord {
  sessionId: ChatSessionId;
  roomId: ChatRoomId | null;
  presenceMode: ChatTransportPresenceMode;
  visibility: ChatTransportVisibility;
  observedAt: UnixMs;
  expiresAt: UnixMs;
  note: string | null;
}

interface MutableTypingRecord {
  sessionId: ChatSessionId;
  roomId: ChatRoomId;
  typingMode: ChatTransportTypingMode;
  observedAt: UnixMs;
  expiresAt: UnixMs;
  cursorToken: ChatCursorToken | null;
}

interface MutableCursorRecord {
  sessionId: ChatSessionId;
  roomId: ChatRoomId;
  cursorToken: ChatCursorToken;
  observedAt: UnixMs;
}

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function nowMs(): UnixMs {
  return Date.now();
}

function dedupe<T>(values: Iterable<T>): T[] {
  return Array.from(new Set(values));
}

function normalizeNamespace(value: string | undefined, fallback: string): ChatNamespaceName {
  const raw = (value ?? fallback).trim();
  if (!raw) {
    return fallback;
  }

  if (raw.startsWith('/')) {
    return raw;
  }

  return `/${raw}`;
}

function normalizeRoomId(value: string): ChatRoomId {
  return value.trim();
}

function normalizeChannelId(value: string | undefined, seedRoomId: string): ChatChannelId {
  return (value?.trim() || `channel:${seedRoomId}`) as ChatChannelId;
}

function normalizeMountTarget(value: ChatMountTarget | undefined): ChatMountTarget {
  return value ?? 'UNKNOWN';
}

function normalizeStageMood(value: ChatTransportStageMood | undefined): ChatTransportStageMood {
  return value ?? 'CALM';
}

function normalizeVisibility(value: ChatTransportVisibility | undefined): ChatTransportVisibility {
  return value ?? 'VISIBLE';
}

function normalizeMembershipRole(value: ChatTransportMembershipRole | undefined): ChatTransportMembershipRole {
  return value ?? 'MEMBER';
}

function buildSocketRoomName(seed: ChatRoomSeed, config: ChatRoomRegistryConfig): string {
  const roomId = normalizeRoomId(seed.roomId);
  const namespace = normalizeNamespace(seed.namespace, config.defaultNamespace).replaceAll('/', ':');
  const kind = seed.kind;

  switch (kind) {
    case 'GLOBAL':
      return `${config.globalRoomPrefix}:${namespace}:${roomId}`;
    case 'SYNDICATE':
      return `${config.syndicateRoomPrefix}:${namespace}:${roomId}`;
    case 'DEAL_ROOM':
      return `${config.dealRoomPrefix}:${namespace}:${roomId}`;
    case 'LOBBY':
      return `${config.lobbyRoomPrefix}:${namespace}:${roomId}`;
    case 'DIRECT':
      return `${config.directRoomPrefix}:${namespace}:${roomId}`;
    case 'SYSTEM':
      return `${config.systemRoomPrefix}:${namespace}:${roomId}`;
    case 'RUN':
      return `${config.runRoomPrefix}:${namespace}:${roomId}`;
    case 'BATTLE':
      return `${config.battleRoomPrefix}:${namespace}:${roomId}`;
    case 'SPECTATOR':
      return `${config.spectatorRoomPrefix}:${namespace}:${roomId}`;
    default:
      return `${config.visibleRoomPrefix}:${namespace}:${roomId}`;
  }
}

function clampInteger(value: number, floor: number, ceiling: number): number {
  return Math.max(floor, Math.min(ceiling, Math.trunc(value)));
}

function toReadonlyRecord(source: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...source });
}

function toReadonlyArray<T>(source: Iterable<T>): readonly T[] {
  return Object.freeze(Array.from(source));
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort();
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      output[key] = sortKeys(source[key]);
    }
    return output;
  }

  return value;
}

function hashAudit(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function ensureWritableByVisibility(visibility: ChatTransportVisibility, explicitReadOnly: boolean): boolean {
  if (explicitReadOnly) {
    return false;
  }

  return visibility !== 'READ_ONLY' && visibility !== 'TRANSPORT_MUTED';
}

function ensureReadableByVisibility(visibility: ChatTransportVisibility): boolean {
  return visibility !== 'SHADOW_HIDDEN';
}

function defaultPlayerFromIdentity(identity: ChatTransportIdentity): Player {
  return {
    id: identity.userId,
    username: identity.username,
    status: identity.status ?? 'ACTIVE',
    sessionStart: Date.now(),
    turnsLocked: 0,
  };
}

// ============================================================================
// MARK: ChatRoomRegistry
// ============================================================================

export class ChatRoomRegistry {
  private readonly config: ChatRoomRegistryConfig;

  private readonly rooms = new Map<ChatRoomId, MutableChatRoomRecord>();
  private readonly sessions = new Map<ChatSessionId, MutableChatSessionRecord>();
  private readonly memberships = new Map<string, MutableMembershipRecord>();
  private readonly presence = new Map<ChatSessionId, MutablePresenceRecord>();
  private readonly typing = new Map<string, MutableTypingRecord>();
  private readonly cursors = new Map<string, MutableCursorRecord>();

  private readonly socketToSession = new Map<ChatSocketId, ChatSessionId>();
  private readonly userToSessions = new Map<ChatUserId, Set<ChatSessionId>>();
  private readonly roomIndexByNamespace = new Map<ChatNamespaceName, Set<ChatRoomId>>();
  private readonly roomIndexByRun = new Map<ChatRunId, Set<ChatRoomId>>();
  private readonly roomIndexByMode = new Map<ChatModeId, Set<ChatRoomId>>();
  private readonly roomIndexByParty = new Map<ChatPartyId, Set<ChatRoomId>>();
  private readonly roomIndexByKind = new Map<ChatTransportRoomKind, Set<ChatRoomId>>();
  private readonly roomIndexByTag = new Map<string, Set<ChatRoomId>>();

  private maxRoomOccupancyObserved = 0;
  private lastMutationAt = nowMs();

  public constructor(config?: Partial<ChatRoomRegistryConfig>) {
    this.config = { ...DEFAULT_CHAT_ROOM_REGISTRY_CONFIG, ...(config ?? {}) };
  }

  // ==========================================================================
  // MARK: Session lifecycle
  // ==========================================================================

  public registerSession(seed: ChatTransportSessionSeed): ChatTransportSessionSnapshot {
    const timestamp = seed.connectedAt ?? nowMs();
    const sessionId = seed.sessionId?.trim() || (`session:${randomUUID()}` as ChatSessionId);
    const namespace = normalizeNamespace(seed.namespace, this.config.defaultNamespace);

    const existing = this.sessions.get(sessionId);
    const nextIdentity = {
      ...seed.identity,
      status: seed.identity.status ?? 'ACTIVE',
      metadata: { ...(seed.identity.metadata ?? {}) },
      traits: dedupe(seed.identity.traits ?? []),
    } satisfies ChatTransportIdentity;

    if (existing) {
      existing.socketIds.add(seed.socketId);
      existing.namespace = namespace;
      existing.identity = nextIdentity;
      existing.lastSeenAt = timestamp;
      existing.reconnectDeadlineAt = timestamp + this.config.reconnectWindowMs;
      existing.reconnectOf = seed.reconnectOf ?? existing.reconnectOf;
      existing.serverNodeId = seed.serverNodeId ?? existing.serverNodeId;
      existing.mountTarget = seed.mountTarget ?? existing.mountTarget;
      existing.clientVersion = seed.clientVersion ?? existing.clientVersion;
      existing.status = 'ACTIVE';
      existing.transportFeatures = dedupe([
        ...existing.transportFeatures,
        ...(seed.transportFeatures ?? []),
      ]);
      existing.metadata = {
        ...existing.metadata,
        ...(seed.metadata ?? {}),
      };

      this.socketToSession.set(seed.socketId, sessionId);
      this.linkUserSession(nextIdentity.userId, sessionId);
      this.touch();
      return this.getSessionSnapshot(sessionId)!;
    }

    const created: MutableChatSessionRecord = {
      sessionId,
      socketIds: new Set([seed.socketId]),
      namespace,
      identity: nextIdentity,
      connectedAt: timestamp,
      lastSeenAt: timestamp,
      reconnectDeadlineAt: timestamp + this.config.reconnectWindowMs,
      reconnectOf: seed.reconnectOf ?? null,
      serverNodeId: seed.serverNodeId ?? null,
      mountTarget: seed.mountTarget ?? null,
      clientVersion: seed.clientVersion ?? null,
      transportFeatures: dedupe(seed.transportFeatures ?? []),
      status: 'ACTIVE',
      roomIds: new Set(),
      metadata: { ...(seed.metadata ?? {}) },
    };

    this.assertSessionQuota(nextIdentity.userId);
    this.sessions.set(sessionId, created);
    this.socketToSession.set(seed.socketId, sessionId);
    this.linkUserSession(nextIdentity.userId, sessionId);
    this.touch();
    return this.getSessionSnapshot(sessionId)!;
  }

  public attachSocket(sessionId: ChatSessionId, socketId: ChatSocketId): ChatTransportSessionSnapshot {
    const session = this.requireSession(sessionId);
    this.assertSocketQuota(session);
    session.socketIds.add(socketId);
    session.lastSeenAt = nowMs();
    session.reconnectDeadlineAt = session.lastSeenAt + this.config.reconnectWindowMs;
    session.status = 'ACTIVE';
    this.socketToSession.set(socketId, sessionId);
    this.touch();
    return this.toSessionSnapshot(session);
  }

  public detachSocket(socketId: ChatSocketId): ChatTransportSessionSnapshot | null {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      this.socketToSession.delete(socketId);
      return null;
    }

    session.socketIds.delete(socketId);
    this.socketToSession.delete(socketId);
    session.lastSeenAt = nowMs();
    session.reconnectDeadlineAt = session.lastSeenAt + this.config.reconnectWindowMs;

    if (session.socketIds.size === 0) {
      session.status = 'RECONNECTING';
    }

    this.touch();
    return this.toSessionSnapshot(session);
  }

  public markDisconnected(sessionId: ChatSessionId): ChatTransportSessionSnapshot {
    const session = this.requireSession(sessionId);
    session.status = 'DISCONNECTED';
    session.lastSeenAt = nowMs();
    session.reconnectDeadlineAt = session.lastSeenAt;
    for (const socketId of session.socketIds) {
      this.socketToSession.delete(socketId);
    }
    session.socketIds.clear();
    this.expireTypingForSession(sessionId);
    this.presence.set(sessionId, {
      sessionId,
      roomId: this.presence.get(sessionId)?.roomId ?? null,
      presenceMode: 'DISCONNECTED',
      visibility: this.presence.get(sessionId)?.visibility ?? 'VISIBLE',
      observedAt: session.lastSeenAt,
      expiresAt: session.lastSeenAt + this.config.presenceExpiryMs,
      note: 'socket-disconnected',
    });
    this.touch();
    return this.toSessionSnapshot(session);
  }

  public resolveSessionBySocket(socketId: ChatSocketId): ChatTransportSessionSnapshot | null {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) {
      return null;
    }

    return this.getSessionSnapshot(sessionId);
  }

  public getSessionSnapshot(sessionId: ChatSessionId): ChatTransportSessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    return session ? this.toSessionSnapshot(session) : null;
  }

  public listSessionsForUser(userId: ChatUserId): readonly ChatTransportSessionSnapshot[] {
    const ids = this.userToSessions.get(userId);
    if (!ids) {
      return Object.freeze([]);
    }

    return Object.freeze(
      Array.from(ids)
        .map((sessionId) => this.getSessionSnapshot(sessionId))
        .filter((value): value is ChatTransportSessionSnapshot => Boolean(value)),
    );
  }

  // ==========================================================================
  // MARK: Room lifecycle
  // ==========================================================================

  public ensureRoom(seed: ChatRoomSeed): ChatRoomSnapshot {
    const roomId = normalizeRoomId(seed.roomId);
    const existing = this.rooms.get(roomId);
    if (existing) {
      return this.patchRoom(seed);
    }

    const namespace = normalizeNamespace(seed.namespace, this.config.defaultNamespace);
    const createdAt = nowMs();
    const room: MutableChatRoomRecord = {
      roomId,
      channelId: normalizeChannelId(seed.channelId, roomId),
      kind: seed.kind,
      namespace,
      mountTarget: normalizeMountTarget(seed.mountTarget),
      modeId: seed.modeId ?? null,
      runId: seed.runId ?? null,
      partyId: seed.partyId ?? null,
      socketRoomName: buildSocketRoomName(seed, this.config),
      label: seed.label ?? null,
      topic: seed.topic ?? null,
      description: seed.description ?? null,
      stageMood: normalizeStageMood(seed.stageMood),
      isShadow: Boolean(seed.isShadow),
      isPrivate: Boolean(seed.isPrivate),
      isReadOnly: Boolean(seed.isReadOnly),
      allowSpectators: seed.allowSpectators ?? true,
      allowPresenceBroadcast: seed.allowPresenceBroadcast ?? true,
      allowTypingBroadcast: seed.allowTypingBroadcast ?? true,
      allowCursorBroadcast: seed.allowCursorBroadcast ?? true,
      allowDirectFanout: seed.allowDirectFanout ?? true,
      maxOccupancy: clampInteger(
        seed.maxOccupancy ?? this.config.maxOccupancyPerRoom,
        1,
        this.config.maxOccupancyPerRoom,
      ),
      tags: dedupe(seed.tags ?? []),
      metadata: { ...(seed.metadata ?? {}) },
      createdAt,
      updatedAt: createdAt,
      lastOccupiedAt: createdAt,
      membershipIds: new Set(),
    };

    this.rooms.set(roomId, room);
    this.indexRoom(room);
    this.touch();
    return this.toRoomSnapshot(room);
  }

  public patchRoom(seed: ChatRoomSeed): ChatRoomSnapshot {
    const room = this.requireRoom(seed.roomId);
    this.deindexRoom(room);

    room.channelId = normalizeChannelId(seed.channelId ?? room.channelId, room.roomId);
    room.kind = seed.kind ?? room.kind;
    room.namespace = normalizeNamespace(seed.namespace, room.namespace);
    room.mountTarget = normalizeMountTarget(seed.mountTarget ?? room.mountTarget);
    room.modeId = seed.modeId === undefined ? room.modeId : seed.modeId;
    room.runId = seed.runId === undefined ? room.runId : seed.runId;
    room.partyId = seed.partyId === undefined ? room.partyId : seed.partyId;
    room.socketRoomName = seed.roomId === room.roomId && !seed.namespace && !seed.kind
      ? room.socketRoomName
      : buildSocketRoomName({
          ...seed,
          roomId: room.roomId,
          channelId: room.channelId,
          kind: seed.kind ?? room.kind,
          namespace: seed.namespace ?? room.namespace,
        }, this.config);
    room.label = seed.label === undefined ? room.label : seed.label;
    room.topic = seed.topic === undefined ? room.topic : seed.topic;
    room.description = seed.description === undefined ? room.description : seed.description;
    room.stageMood = seed.stageMood ?? room.stageMood;
    room.isShadow = seed.isShadow === undefined ? room.isShadow : seed.isShadow;
    room.isPrivate = seed.isPrivate === undefined ? room.isPrivate : seed.isPrivate;
    room.isReadOnly = seed.isReadOnly === undefined ? room.isReadOnly : seed.isReadOnly;
    room.allowSpectators = seed.allowSpectators === undefined ? room.allowSpectators : seed.allowSpectators;
    room.allowPresenceBroadcast = seed.allowPresenceBroadcast === undefined
      ? room.allowPresenceBroadcast
      : seed.allowPresenceBroadcast;
    room.allowTypingBroadcast = seed.allowTypingBroadcast === undefined
      ? room.allowTypingBroadcast
      : seed.allowTypingBroadcast;
    room.allowCursorBroadcast = seed.allowCursorBroadcast === undefined
      ? room.allowCursorBroadcast
      : seed.allowCursorBroadcast;
    room.allowDirectFanout = seed.allowDirectFanout === undefined
      ? room.allowDirectFanout
      : seed.allowDirectFanout;
    room.maxOccupancy = clampInteger(
      seed.maxOccupancy ?? room.maxOccupancy,
      1,
      this.config.maxOccupancyPerRoom,
    );
    room.tags = dedupe(seed.tags ?? room.tags);
    room.metadata = {
      ...room.metadata,
      ...(seed.metadata ?? {}),
    };
    room.updatedAt = nowMs();

    this.indexRoom(room);
    this.touch();
    return this.toRoomSnapshot(room);
  }

  public removeRoom(roomId: ChatRoomId): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const members = Array.from(room.membershipIds);
    for (const sessionId of members) {
      this.leaveRoom({
        sessionId,
        roomId,
        leftAt: nowMs(),
        reason: 'room-removed',
      });
    }

    this.deindexRoom(room);
    this.rooms.delete(roomId);
    this.touch();
    return true;
  }

  public getRoomSnapshot(roomId: ChatRoomId): ChatRoomSnapshot | null {
    const room = this.rooms.get(roomId);
    return room ? this.toRoomSnapshot(room) : null;
  }

  public listRooms(query?: ChatRoomSelectionQuery): readonly ChatRoomSnapshot[] {
    const includeShadow = query?.includeShadow ?? false;
    const includePrivate = query?.includePrivate ?? true;
    const includeEmpty = query?.includeEmpty ?? true;

    let sourceIds: Iterable<ChatRoomId> = this.rooms.keys();

    if (query?.namespace) {
      sourceIds = this.roomIndexByNamespace.get(query.namespace) ?? [];
    }

    const output: ChatRoomSnapshot[] = [];
    for (const roomId of sourceIds) {
      const room = this.rooms.get(roomId);
      if (!room) {
        continue;
      }

      if (query?.kind && room.kind !== query.kind) {
        continue;
      }

      if (query?.mountTarget && room.mountTarget !== query.mountTarget) {
        continue;
      }

      if (query?.modeId !== undefined && room.modeId !== query.modeId) {
        continue;
      }

      if (query?.runId !== undefined && room.runId !== query.runId) {
        continue;
      }

      if (query?.partyId !== undefined && room.partyId !== query.partyId) {
        continue;
      }

      if (query?.tag && !room.tags.includes(query.tag)) {
        continue;
      }

      if (!includeShadow && room.isShadow) {
        continue;
      }

      if (!includePrivate && room.isPrivate) {
        continue;
      }

      if (!includeEmpty && room.membershipIds.size === 0) {
        continue;
      }

      output.push(this.toRoomSnapshot(room));
    }

    return Object.freeze(output.sort((a, b) => a.createdAt - b.createdAt));
  }

  // ==========================================================================
  // MARK: Membership
  // ==========================================================================

  public joinRoom(request: ChatJoinRequest): ChatRoomSnapshot {
    const session = this.requireSession(request.sessionId);
    const roomSnapshot = this.ensureRoom(request.room);
    const room = this.requireRoom(roomSnapshot.roomId);

    this.assertRoomQuota(session);
    this.assertRoomOccupancy(room);

    const membershipKey = this.toMembershipKey(request.sessionId, room.roomId);
    const joinedAt = request.joinedAt ?? nowMs();
    const visibility = normalizeVisibility(request.visibility);
    const role = normalizeMembershipRole(request.role);
    const writable = ensureWritableByVisibility(visibility, room.isReadOnly);
    const readable = ensureReadableByVisibility(visibility);

    const existing = this.memberships.get(membershipKey);
    if (existing) {
      existing.role = role;
      existing.visibility = visibility;
      existing.updatedAt = joinedAt;
      existing.writable = writable;
      existing.readable = readable;
      existing.metadata = {
        ...existing.metadata,
        ...(request.metadata ?? {}),
      };
      session.lastSeenAt = joinedAt;
      room.lastOccupiedAt = joinedAt;
      this.touch();
      return this.toRoomSnapshot(room);
    }

    const created: MutableMembershipRecord = {
      sessionId: request.sessionId,
      roomId: room.roomId,
      role,
      visibility,
      joinedAt,
      updatedAt: joinedAt,
      writable,
      readable,
      metadata: { ...(request.metadata ?? {}) },
    };

    this.memberships.set(membershipKey, created);
    session.roomIds.add(room.roomId);
    room.membershipIds.add(request.sessionId);
    room.updatedAt = joinedAt;
    room.lastOccupiedAt = joinedAt;

    this.touch();
    return this.toRoomSnapshot(room);
  }

  public leaveRoom(request: ChatLeaveRequest): ChatRoomSnapshot | null {
    const membershipKey = this.toMembershipKey(request.sessionId, request.roomId);
    const membership = this.memberships.get(membershipKey);
    if (!membership) {
      return this.getRoomSnapshot(request.roomId);
    }

    this.memberships.delete(membershipKey);

    const room = this.rooms.get(request.roomId);
    if (room) {
      room.membershipIds.delete(request.sessionId);
      room.updatedAt = request.leftAt ?? nowMs();
      if (room.membershipIds.size === 0) {
        room.lastOccupiedAt = room.updatedAt;
      }
    }

    const session = this.sessions.get(request.sessionId);
    if (session) {
      session.roomIds.delete(request.roomId);
      session.lastSeenAt = request.leftAt ?? nowMs();
    }

    const typingKey = this.toRoomSessionKey(request.roomId, request.sessionId);
    this.typing.delete(typingKey);
    this.cursors.delete(typingKey);

    this.touch();

    if (!room) {
      return null;
    }

    if (room.membershipIds.size === 0) {
      this.pruneRoomIfExpired(room.roomId, request.leftAt ?? nowMs());
    }

    return this.toRoomSnapshot(room);
  }

  public setMembershipVisibility(
    sessionId: ChatSessionId,
    roomId: ChatRoomId,
    visibility: ChatTransportVisibility,
  ): ChatRoomSnapshot {
    const membership = this.requireMembership(sessionId, roomId);
    const room = this.requireRoom(roomId);
    membership.visibility = visibility;
    membership.readable = ensureReadableByVisibility(visibility);
    membership.writable = ensureWritableByVisibility(visibility, room.isReadOnly);
    membership.updatedAt = nowMs();
    this.touch();
    return this.toRoomSnapshot(room);
  }

  public setMembershipRole(
    sessionId: ChatSessionId,
    roomId: ChatRoomId,
    role: ChatTransportMembershipRole,
  ): ChatRoomSnapshot {
    const membership = this.requireMembership(sessionId, roomId);
    const room = this.requireRoom(roomId);
    membership.role = role;
    membership.updatedAt = nowMs();
    this.touch();
    return this.toRoomSnapshot(room);
  }

  public listRoomsForSession(sessionId: ChatSessionId): readonly ChatRoomSnapshot[] {
    const session = this.requireSession(sessionId);
    return Object.freeze(
      Array.from(session.roomIds)
        .map((roomId) => this.getRoomSnapshot(roomId))
        .filter((value): value is ChatRoomSnapshot => Boolean(value)),
    );
  }

  public listMembersForRoom(roomId: ChatRoomId): readonly ChatTransportSessionSnapshot[] {
    const room = this.requireRoom(roomId);
    return Object.freeze(
      Array.from(room.membershipIds)
        .map((sessionId) => this.getSessionSnapshot(sessionId))
        .filter((value): value is ChatTransportSessionSnapshot => Boolean(value)),
    );
  }

  // ==========================================================================
  // MARK: Presence / typing / cursor
  // ==========================================================================

  public setPresence(update: ChatPresenceUpdate): ChatPresenceSnapshot {
    this.requireSession(update.sessionId);

    if (update.roomId) {
      this.requireRoom(update.roomId);
    }

    const observedAt = update.observedAt ?? nowMs();
    const record: MutablePresenceRecord = {
      sessionId: update.sessionId,
      roomId: update.roomId ?? null,
      presenceMode: update.presenceMode,
      visibility: update.visibility ?? 'VISIBLE',
      observedAt,
      expiresAt: observedAt + this.config.presenceExpiryMs,
      note: update.note ?? null,
    };

    this.presence.set(update.sessionId, record);
    this.touch();
    return this.toPresenceSnapshot(record);
  }

  public getPresence(sessionId: ChatSessionId): ChatPresenceSnapshot | null {
    const record = this.presence.get(sessionId);
    if (!record) {
      return null;
    }

    if (record.expiresAt < nowMs()) {
      this.presence.delete(sessionId);
      return null;
    }

    return this.toPresenceSnapshot(record);
  }

  public setTyping(update: ChatTypingUpdate): ChatTypingSnapshot {
    this.requireMembership(update.sessionId, update.roomId);
    const observedAt = update.observedAt ?? nowMs();
    const key = this.toRoomSessionKey(update.roomId, update.sessionId);
    const record: MutableTypingRecord = {
      sessionId: update.sessionId,
      roomId: update.roomId,
      typingMode: update.typingMode,
      observedAt,
      expiresAt: observedAt + this.config.typingExpiryMs,
      cursorToken: update.cursorToken ?? null,
    };

    this.typing.set(key, record);
    this.touch();
    return this.toTypingSnapshot(record);
  }

  public clearTyping(sessionId: ChatSessionId, roomId: ChatRoomId): void {
    this.typing.delete(this.toRoomSessionKey(roomId, sessionId));
    this.touch();
  }

  public listTypingForRoom(roomId: ChatRoomId): readonly ChatTypingSnapshot[] {
    const timestamp = nowMs();
    const output: ChatTypingSnapshot[] = [];

    for (const record of this.typing.values()) {
      if (record.roomId !== roomId) {
        continue;
      }

      if (record.expiresAt < timestamp) {
        this.typing.delete(this.toRoomSessionKey(record.roomId, record.sessionId));
        continue;
      }

      output.push(this.toTypingSnapshot(record));
    }

    return Object.freeze(output.sort((a, b) => a.observedAt - b.observedAt));
  }

  public setCursor(update: ChatCursorUpdate): ChatCursorSnapshot {
    this.requireMembership(update.sessionId, update.roomId);
    const key = this.toRoomSessionKey(update.roomId, update.sessionId);
    const record: MutableCursorRecord = {
      sessionId: update.sessionId,
      roomId: update.roomId,
      cursorToken: update.cursorToken,
      observedAt: update.observedAt ?? nowMs(),
    };

    this.cursors.set(key, record);
    this.touch();
    return this.toCursorSnapshot(record);
  }

  public clearCursor(sessionId: ChatSessionId, roomId: ChatRoomId): void {
    this.cursors.delete(this.toRoomSessionKey(roomId, sessionId));
    this.touch();
  }

  public listCursorsForRoom(roomId: ChatRoomId): readonly ChatCursorSnapshot[] {
    const output: ChatCursorSnapshot[] = [];
    for (const record of this.cursors.values()) {
      if (record.roomId === roomId) {
        output.push(this.toCursorSnapshot(record));
      }
    }

    return Object.freeze(output.sort((a, b) => a.observedAt - b.observedAt));
  }

  // ==========================================================================
  // MARK: Fanout resolution
  // ==========================================================================

  public resolveFanoutTarget(roomId: ChatRoomId, filter?: ChatFanoutFilter): ChatFanoutTarget {
    const room = this.requireRoom(roomId);
    const socketIds = new Set<ChatSocketId>();
    const sessionIds: ChatSessionId[] = [];

    for (const sessionId of room.membershipIds) {
      const membership = this.memberships.get(this.toMembershipKey(sessionId, room.roomId));
      const session = this.sessions.get(sessionId);

      if (!membership || !session) {
        continue;
      }

      if (!this.matchesFanoutFilter(membership, session, filter)) {
        continue;
      }

      sessionIds.push(sessionId);
      for (const socketId of session.socketIds) {
        socketIds.add(socketId);
      }
    }

    return Object.freeze({
      socketIds: Object.freeze(Array.from(socketIds)),
      sessionIds: Object.freeze(sessionIds),
      socketRoomNames: Object.freeze([room.socketRoomName]),
      audienceSize: sessionIds.length,
      roomId: room.roomId,
      channelId: room.channelId,
    });
  }

  public resolveDirectFanoutForSession(sessionId: ChatSessionId): ChatFanoutTarget {
    const session = this.requireSession(sessionId);
    return Object.freeze({
      socketIds: Object.freeze(Array.from(session.socketIds)),
      sessionIds: Object.freeze([session.sessionId]),
      socketRoomNames: Object.freeze([]),
      audienceSize: session.socketIds.size,
      roomId: `session:${session.sessionId}`,
      channelId: `channel:session:${session.sessionId}`,
    });
  }

  public resolveSocketRoomNamesForSession(sessionId: ChatSessionId): readonly string[] {
    const session = this.requireSession(sessionId);
    const names = new Set<string>();
    for (const roomId of session.roomIds) {
      const room = this.rooms.get(roomId);
      if (room) {
        names.add(room.socketRoomName);
      }
    }
    return Object.freeze(Array.from(names));
  }

  // ==========================================================================
  // MARK: Sweeps and pruning
  // ==========================================================================

  public sweepExpiredState(at: UnixMs = nowMs()): void {
    for (const [sessionId, record] of this.presence.entries()) {
      if (record.expiresAt < at) {
        this.presence.delete(sessionId);
      }
    }

    for (const [key, record] of this.typing.entries()) {
      if (record.expiresAt < at) {
        this.typing.delete(key);
      }
    }

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'RECONNECTING' && session.reconnectDeadlineAt < at) {
        this.destroySession(sessionId, 'reconnect-expired');
      }
    }

    for (const [roomId, room] of this.rooms.entries()) {
      if (room.membershipIds.size === 0) {
        const ageSinceLastOccupied = at - room.lastOccupiedAt;
        if (ageSinceLastOccupied >= this.config.preserveEmptyRoomsForMs) {
          this.removeRoom(roomId);
        }
      }
    }

    this.touch(false);
  }

  public destroySession(sessionId: ChatSessionId, reason: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    for (const socketId of session.socketIds) {
      this.socketToSession.delete(socketId);
    }

    for (const roomId of Array.from(session.roomIds)) {
      this.leaveRoom({
        sessionId,
        roomId,
        leftAt: nowMs(),
        reason,
      });
    }

    this.presence.delete(sessionId);
    this.expireTypingForSession(sessionId);

    const userSessions = this.userToSessions.get(session.identity.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userToSessions.delete(session.identity.userId);
      }
    }

    this.sessions.delete(sessionId);
    this.touch();
    return true;
  }

  // ==========================================================================
  // MARK: Snapshots / audit
  // ==========================================================================

  public getMetricsSnapshot(): ChatRegistryMetricsSnapshot {
    let visibleMembershipCount = 0;
    let hiddenMembershipCount = 0;
    let shadowMembershipCount = 0;
    let activeRoomCount = 0;
    let privateRoomCount = 0;
    let shadowRoomCount = 0;
    let directRoomCount = 0;

    for (const membership of this.memberships.values()) {
      switch (membership.visibility) {
        case 'VISIBLE':
          visibleMembershipCount += 1;
          break;
        case 'SHADOW_HIDDEN':
          shadowMembershipCount += 1;
          break;
        default:
          hiddenMembershipCount += 1;
          break;
      }
    }

    for (const room of this.rooms.values()) {
      if (room.membershipIds.size > 0) {
        activeRoomCount += 1;
      }
      if (room.isPrivate) {
        privateRoomCount += 1;
      }
      if (room.isShadow) {
        shadowRoomCount += 1;
      }
      if (room.kind === 'DIRECT') {
        directRoomCount += 1;
      }
    }

    return Object.freeze({
      roomCount: this.rooms.size,
      sessionCount: this.sessions.size,
      socketCount: this.socketToSession.size,
      userCount: this.userToSessions.size,
      membershipCount: this.memberships.size,
      visibleMembershipCount,
      hiddenMembershipCount,
      shadowMembershipCount,
      typingCount: this.typing.size,
      cursorCount: this.cursors.size,
      activeRoomCount,
      privateRoomCount,
      shadowRoomCount,
      directRoomCount,
      maxRoomOccupancyObserved: this.maxRoomOccupancyObserved,
      lastMutationAt: this.lastMutationAt,
    });
  }

  public buildAuditSnapshot(): ChatRegistryAuditSnapshot {
    const rooms = this.listRooms({
      includeShadow: true,
      includePrivate: true,
      includeEmpty: true,
    });

    const sessions = Object.freeze(
      Array.from(this.sessions.keys())
        .map((sessionId) => this.getSessionSnapshot(sessionId))
        .filter((value): value is ChatTransportSessionSnapshot => Boolean(value)),
    );

    const metrics = this.getMetricsSnapshot();
    const base = {
      generatedAt: nowMs(),
      metrics,
      rooms,
      sessions,
    };

    return Object.freeze({
      ...base,
      hash: hashAudit(base),
    });
  }

  // ==========================================================================
  // MARK: Public convenience helpers
  // ==========================================================================

  public hasRoom(roomId: ChatRoomId): boolean {
    return this.rooms.has(roomId);
  }

  public hasSession(sessionId: ChatSessionId): boolean {
    return this.sessions.has(sessionId);
  }

  public hasMembership(sessionId: ChatSessionId, roomId: ChatRoomId): boolean {
    return this.memberships.has(this.toMembershipKey(sessionId, roomId));
  }

  public sessionPlayer(sessionId: ChatSessionId): Player {
    const session = this.requireSession(sessionId);
    return defaultPlayerFromIdentity(session.identity);
  }

  public roomSocketName(roomId: ChatRoomId): string {
    return this.requireRoom(roomId).socketRoomName;
  }

  public roomOccupancy(roomId: ChatRoomId): ChatOccupancySnapshot {
    return this.computeOccupancy(this.requireRoom(roomId));
  }

  public sessionIdentity(sessionId: ChatSessionId): ChatTransportIdentity {
    return this.requireSession(sessionId).identity;
  }

  public currentConfig(): Readonly<ChatRoomRegistryConfig> {
    return Object.freeze({ ...this.config });
  }

  // ==========================================================================
  // MARK: Private internals
  // ==========================================================================

  private requireRoom(roomId: ChatRoomId): MutableChatRoomRecord {
    const normalized = normalizeRoomId(roomId);
    const room = this.rooms.get(normalized);
    if (!room) {
      throw new Error(`ChatRoomRegistry: room "${normalized}" does not exist`);
    }
    return room;
  }

  private requireSession(sessionId: ChatSessionId): MutableChatSessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`ChatRoomRegistry: session "${sessionId}" does not exist`);
    }
    return session;
  }

  private requireMembership(sessionId: ChatSessionId, roomId: ChatRoomId): MutableMembershipRecord {
    const membership = this.memberships.get(this.toMembershipKey(sessionId, roomId));
    if (!membership) {
      throw new Error(`ChatRoomRegistry: membership "${sessionId}" -> "${roomId}" does not exist`);
    }
    return membership;
  }

  private toMembershipKey(sessionId: ChatSessionId, roomId: ChatRoomId): string {
    return `${sessionId}::${roomId}`;
  }

  private toRoomSessionKey(roomId: ChatRoomId, sessionId: ChatSessionId): string {
    return `${roomId}::${sessionId}`;
  }

  private linkUserSession(userId: ChatUserId, sessionId: ChatSessionId): void {
    let set = this.userToSessions.get(userId);
    if (!set) {
      set = new Set();
      this.userToSessions.set(userId, set);
    }
    set.add(sessionId);
  }

  private assertSessionQuota(userId: ChatUserId): void {
    const sessions = this.userToSessions.get(userId);
    if (sessions && sessions.size >= this.config.maxSessionsPerUser) {
      throw new Error(`ChatRoomRegistry: max sessions exceeded for user "${userId}"`);
    }
  }

  private assertSocketQuota(session: MutableChatSessionRecord): void {
    if (session.socketIds.size >= this.config.maxSocketsPerSession) {
      throw new Error(`ChatRoomRegistry: max sockets exceeded for session "${session.sessionId}"`);
    }
  }

  private assertRoomQuota(session: MutableChatSessionRecord): void {
    if (session.roomIds.size >= this.config.maxRoomsPerSession) {
      throw new Error(`ChatRoomRegistry: max joined rooms exceeded for session "${session.sessionId}"`);
    }
  }

  private assertRoomOccupancy(room: MutableChatRoomRecord): void {
    if (room.membershipIds.size >= room.maxOccupancy) {
      throw new Error(`ChatRoomRegistry: room "${room.roomId}" is full`);
    }
  }

  private indexRoom(room: MutableChatRoomRecord): void {
    this.indexSet(this.roomIndexByNamespace, room.namespace, room.roomId);
    this.indexSet(this.roomIndexByKind, room.kind, room.roomId);

    if (room.runId) {
      this.indexSet(this.roomIndexByRun, room.runId, room.roomId);
    }

    if (room.modeId) {
      this.indexSet(this.roomIndexByMode, room.modeId, room.roomId);
    }

    if (room.partyId) {
      this.indexSet(this.roomIndexByParty, room.partyId, room.roomId);
    }

    for (const tag of room.tags) {
      this.indexSet(this.roomIndexByTag, tag, room.roomId);
    }
  }

  private deindexRoom(room: MutableChatRoomRecord): void {
    this.deindexSet(this.roomIndexByNamespace, room.namespace, room.roomId);
    this.deindexSet(this.roomIndexByKind, room.kind, room.roomId);

    if (room.runId) {
      this.deindexSet(this.roomIndexByRun, room.runId, room.roomId);
    }

    if (room.modeId) {
      this.deindexSet(this.roomIndexByMode, room.modeId, room.roomId);
    }

    if (room.partyId) {
      this.deindexSet(this.roomIndexByParty, room.partyId, room.roomId);
    }

    for (const tag of room.tags) {
      this.deindexSet(this.roomIndexByTag, tag, room.roomId);
    }
  }

  private indexSet<K>(map: Map<K, Set<ChatRoomId>>, key: K, roomId: ChatRoomId): void {
    let set = map.get(key);
    if (!set) {
      set = new Set<ChatRoomId>();
      map.set(key, set);
    }
    set.add(roomId);
  }

  private deindexSet<K>(map: Map<K, Set<ChatRoomId>>, key: K, roomId: ChatRoomId): void {
    const set = map.get(key);
    if (!set) {
      return;
    }

    set.delete(roomId);
    if (set.size === 0) {
      map.delete(key);
    }
  }

  private pruneRoomIfExpired(roomId: ChatRoomId, at: UnixMs): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    if (room.membershipIds.size > 0) {
      return;
    }

    if (at - room.lastOccupiedAt >= this.config.preserveEmptyRoomsForMs) {
      this.removeRoom(roomId);
    }
  }

  private expireTypingForSession(sessionId: ChatSessionId): void {
    for (const [key, record] of this.typing.entries()) {
      if (record.sessionId === sessionId) {
        this.typing.delete(key);
      }
    }

    for (const [key, record] of this.cursors.entries()) {
      if (record.sessionId === sessionId) {
        this.cursors.delete(key);
      }
    }
  }

  private matchesFanoutFilter(
    membership: MutableMembershipRecord,
    session: MutableChatSessionRecord,
    filter?: ChatFanoutFilter,
  ): boolean {
    if (!filter) {
      return membership.readable;
    }

    if (filter.includeSessionIds && !filter.includeSessionIds.includes(session.sessionId)) {
      return false;
    }

    if (filter.excludeSessionIds && filter.excludeSessionIds.includes(session.sessionId)) {
      return false;
    }

    if (filter.includeRoles && !filter.includeRoles.includes(membership.role)) {
      return false;
    }

    if (filter.excludeRoles && filter.excludeRoles.includes(membership.role)) {
      return false;
    }

    const presence = this.getPresence(session.sessionId);

    if (filter.includePresenceModes && (!presence || !filter.includePresenceModes.includes(presence.presenceMode))) {
      return false;
    }

    if (filter.excludePresenceModes && presence && filter.excludePresenceModes.includes(presence.presenceMode)) {
      return false;
    }

    if (filter.includeVisibility && !filter.includeVisibility.includes(membership.visibility)) {
      return false;
    }

    if (filter.excludeVisibility && filter.excludeVisibility.includes(membership.visibility)) {
      return false;
    }

    if (!filter.includeShadowMembers && membership.visibility === 'SHADOW_HIDDEN') {
      return false;
    }

    if (filter.onlyReadable && !membership.readable) {
      return false;
    }

    if (filter.onlyWritable && !membership.writable) {
      return false;
    }

    if (filter.allowDirectFanoutOnly) {
      const room = this.rooms.get(membership.roomId);
      if (!room?.allowDirectFanout) {
        return false;
      }
    }

    return true;
  }

  private computeOccupancy(room: MutableChatRoomRecord): ChatOccupancySnapshot {
    let uniqueUserCount = 0;
    let memberCountVisible = 0;
    let memberCountHidden = 0;
    let memberCountShadow = 0;
    let helperCount = 0;
    let haterCount = 0;
    let npcCount = 0;
    let spectatorCount = 0;
    let writableCount = 0;
    let readOnlyCount = 0;

    const userIds = new Set<ChatUserId>();

    for (const sessionId of room.membershipIds) {
      const membership = this.memberships.get(this.toMembershipKey(sessionId, room.roomId));
      const session = this.sessions.get(sessionId);

      if (!membership || !session) {
        continue;
      }

      userIds.add(session.identity.userId);

      switch (membership.visibility) {
        case 'VISIBLE':
          memberCountVisible += 1;
          break;
        case 'SHADOW_HIDDEN':
          memberCountShadow += 1;
          break;
        default:
          memberCountHidden += 1;
          break;
      }

      switch (membership.role) {
        case 'HELPER':
          helperCount += 1;
          break;
        case 'HATER':
          haterCount += 1;
          break;
        case 'NPC':
          npcCount += 1;
          break;
        case 'SPECTATOR':
          spectatorCount += 1;
          break;
        default:
          break;
      }

      if (membership.writable) {
        writableCount += 1;
      } else {
        readOnlyCount += 1;
      }
    }

    uniqueUserCount = userIds.size;
    this.maxRoomOccupancyObserved = Math.max(this.maxRoomOccupancyObserved, room.membershipIds.size);

    return Object.freeze({
      roomId: room.roomId,
      sessionCount: room.membershipIds.size,
      uniqueUserCount,
      memberCountVisible,
      memberCountHidden,
      memberCountShadow,
      helperCount,
      haterCount,
      npcCount,
      spectatorCount,
      writableCount,
      readOnlyCount,
    });
  }

  private toRoomSnapshot(room: MutableChatRoomRecord): ChatRoomSnapshot {
    return Object.freeze({
      roomId: room.roomId,
      channelId: room.channelId,
      kind: room.kind,
      namespace: room.namespace,
      mountTarget: room.mountTarget,
      modeId: room.modeId,
      runId: room.runId,
      partyId: room.partyId,
      socketRoomName: room.socketRoomName,
      label: room.label,
      topic: room.topic,
      description: room.description,
      stageMood: room.stageMood,
      isShadow: room.isShadow,
      isPrivate: room.isPrivate,
      isReadOnly: room.isReadOnly,
      allowSpectators: room.allowSpectators,
      allowPresenceBroadcast: room.allowPresenceBroadcast,
      allowTypingBroadcast: room.allowTypingBroadcast,
      allowCursorBroadcast: room.allowCursorBroadcast,
      allowDirectFanout: room.allowDirectFanout,
      maxOccupancy: room.maxOccupancy,
      tags: Object.freeze([...room.tags]),
      metadata: toReadonlyRecord(room.metadata),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      lastOccupiedAt: room.lastOccupiedAt,
      occupancy: this.computeOccupancy(room),
      memberSessionIds: Object.freeze(Array.from(room.membershipIds)),
    });
  }

  private toSessionSnapshot(session: MutableChatSessionRecord): ChatTransportSessionSnapshot {
    return Object.freeze({
      sessionId: session.sessionId,
      socketIds: Object.freeze(Array.from(session.socketIds)),
      namespace: session.namespace,
      identity: Object.freeze({
        ...session.identity,
        traits: Object.freeze([...(session.identity.traits ?? [])]),
        metadata: toReadonlyRecord({ ...(session.identity.metadata ?? {}) }),
      }),
      connectedAt: session.connectedAt,
      lastSeenAt: session.lastSeenAt,
      reconnectDeadlineAt: session.reconnectDeadlineAt,
      reconnectOf: session.reconnectOf,
      serverNodeId: session.serverNodeId,
      mountTarget: session.mountTarget,
      clientVersion: session.clientVersion,
      transportFeatures: Object.freeze([...session.transportFeatures]),
      status: session.status,
      roomIds: Object.freeze(Array.from(session.roomIds)),
      metadata: toReadonlyRecord(session.metadata),
    });
  }

  private toPresenceSnapshot(record: MutablePresenceRecord): ChatPresenceSnapshot {
    return Object.freeze({
      sessionId: record.sessionId,
      roomId: record.roomId,
      presenceMode: record.presenceMode,
      visibility: record.visibility,
      observedAt: record.observedAt,
      expiresAt: record.expiresAt,
      note: record.note,
    });
  }

  private toTypingSnapshot(record: MutableTypingRecord): ChatTypingSnapshot {
    return Object.freeze({
      sessionId: record.sessionId,
      roomId: record.roomId,
      typingMode: record.typingMode,
      observedAt: record.observedAt,
      expiresAt: record.expiresAt,
    });
  }

  private toCursorSnapshot(record: MutableCursorRecord): ChatCursorSnapshot {
    return Object.freeze({
      sessionId: record.sessionId,
      roomId: record.roomId,
      cursorToken: record.cursorToken,
      observedAt: record.observedAt,
    });
  }

  private touch(updateMutationClock = true): void {
    if (updateMutationClock) {
      this.lastMutationAt = nowMs();
    }
  }
}

// ============================================================================
// MARK: Convenience factory
// ============================================================================

export function createChatRoomRegistry(
  config?: Partial<ChatRoomRegistryConfig>,
): ChatRoomRegistry {
  return new ChatRoomRegistry(config);
}

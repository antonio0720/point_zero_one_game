/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE CHAT SESSION REGISTRY
 * FILE: pzo-server/src/chat/ChatSessionRegistry.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file extracts transport-session authority out of the gateway layer.
 *
 * It does NOT replace ChatRoomRegistry.
 *
 * ChatRoomRegistry remains the canonical transport registry for:
 * - rooms,
 * - session room membership,
 * - presence snapshots,
 * - typing snapshots,
 * - cursor snapshots,
 * - socket fanout targets.
 *
 * This file wraps that registry with deeper session doctrine:
 * - admission,
 * - reattachment,
 * - reconnect tickets,
 * - suspension,
 * - mute / quarantine overlays,
 * - transport-state audit,
 * - per-user session quotas,
 * - socket claim tracking,
 * - session-scoped notes and restrictions,
 * - durable transport session metadata.
 *
 * Doctrine
 * --------
 * - Transport session authority is still servant to backend truth.
 * - This file may control who has a live transport session.
 * - It may not become transcript truth or room truth.
 * - It may annotate session authority state that the gateway and backend can
 *   consult before they accept room joins, presence updates, or message submits.
 * - ChatRoomRegistry remains the low-level live session/room map.
 * - ChatGateway becomes thinner by delegating session admission and reconnect
 *   logic here.
 * ============================================================================
 */

import { createHash, randomUUID } from 'node:crypto';

import type {
  ChatGatewayAuthContext,
} from './ChatConnectionAuth';
import {
  ChatRoomRegistry,
  DEFAULT_CHAT_ROOM_REGISTRY_CONFIG,
  type ChatMountTarget,
  type ChatPresenceUpdate,
  type ChatRoomId,
  type ChatRoomRegistryConfig,
  type ChatSessionId,
  type ChatSocketId,
  type ChatTransportAuthLevel,
  type ChatTransportIdentity,
  type ChatTransportSessionSeed,
  type ChatTransportSessionSnapshot,
  type ChatUserId,
} from './ChatRoomRegistry';

// ============================================================================
// MARK: Public authority types
// ============================================================================

export type ChatSessionAuthorityState =
  | 'ADMITTED'
  | 'READ_ONLY'
  | 'MUTED'
  | 'QUARANTINED'
  | 'SUSPENDED'
  | 'TERMINATED';

export type ChatSessionRestriction =
  | 'READ_ONLY'
  | 'BLOCK_ROOM_JOIN'
  | 'BLOCK_MESSAGE_SUBMIT'
  | 'BLOCK_CURSOR'
  | 'BLOCK_TYPING'
  | 'BLOCK_DIRECT_FANOUT'
  | 'BLOCK_PRIVATE_ROOMS'
  | 'BLOCK_SHADOW_ROOMS'
  | 'FORCE_VISIBLE'
  | 'FORCE_LOBBY_ONLY';

export type ChatSessionTerminationReason =
  | 'MANUAL'
  | 'AUTH_REJECTED'
  | 'BAN'
  | 'DUPLICATE_SOCKET'
  | 'RECONNECT_EXPIRED'
  | 'RATE_ABUSE'
  | 'NODE_SHUTDOWN'
  | 'TRANSPORT_ERROR'
  | 'UNKNOWN';

export interface ChatReconnectTicket {
  readonly ticketId: string;
  readonly sessionId: ChatSessionId;
  readonly userId: ChatUserId;
  readonly fingerprint: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly consumedAt: number | null;
  readonly socketIdHint: ChatSocketId | null;
  readonly namespace: string;
  readonly mountTarget: ChatMountTarget | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatSessionAuthorityNote {
  readonly noteId: string;
  readonly code: string;
  readonly message: string;
  readonly createdAt: number;
  readonly expiresAt: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatSessionAuthoritySnapshot {
  readonly sessionId: ChatSessionId;
  readonly userId: ChatUserId;
  readonly username: string;
  readonly authLevel: ChatTransportAuthLevel;
  readonly authorityState: ChatSessionAuthorityState;
  readonly restrictions: readonly ChatSessionRestriction[];
  readonly admittedAt: number;
  readonly updatedAt: number;
  readonly mutedUntil: number | null;
  readonly suspendedUntil: number | null;
  readonly quarantinedUntil: number | null;
  readonly terminatedAt: number | null;
  readonly terminationReason: ChatSessionTerminationReason | null;
  readonly fingerprint: string;
  readonly ipHash: string;
  readonly userAgentHash: string;
  readonly nodeId: string;
  readonly namespace: string;
  readonly mountTarget: ChatMountTarget | null;
  readonly clientVersion: string | null;
  readonly transportFeatures: readonly string[];
  readonly roomIds: readonly ChatRoomId[];
  readonly socketIds: readonly ChatSocketId[];
  readonly resumeTicketIds: readonly string[];
  readonly noteCount: number;
  readonly transportSession: ChatTransportSessionSnapshot;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatSessionAuthorityAuditSnapshot {
  readonly generatedAt: number;
  readonly nodeId: string;
  readonly sessionCount: number;
  readonly activeCount: number;
  readonly readOnlyCount: number;
  readonly mutedCount: number;
  readonly quarantinedCount: number;
  readonly suspendedCount: number;
  readonly terminatedCount: number;
  readonly reconnectTicketCount: number;
  readonly hash: string;
  readonly sessions: readonly ChatSessionAuthoritySnapshot[];
}

export interface ChatSessionAdmissionRequest {
  readonly socketId: ChatSocketId;
  readonly namespace: string;
  readonly auth: ChatGatewayAuthContext;
  readonly mountTarget?: ChatMountTarget | null;
  readonly clientVersion?: string | null;
  readonly transportFeatures?: readonly string[];
  readonly serverNodeId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatSessionAdmissionResult {
  readonly session: ChatTransportSessionSnapshot;
  readonly authority: ChatSessionAuthoritySnapshot;
  readonly reconnectTicket: ChatReconnectTicket | null;
  readonly reusedExistingSession: boolean;
}

export interface ChatSessionResumeRequest {
  readonly socketId: ChatSocketId;
  readonly namespace: string;
  readonly auth: ChatGatewayAuthContext;
  readonly ticketId?: string | null;
  readonly sessionIdHint?: ChatSessionId | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatSessionDisconnectRequest {
  readonly sessionId: ChatSessionId;
  readonly socketId?: ChatSocketId | null;
  readonly reason?: string | null;
}

export interface ChatSessionRestrictionChange {
  readonly add?: readonly ChatSessionRestriction[];
  readonly remove?: readonly ChatSessionRestriction[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatSessionRegistryPort {
  admit(request: ChatSessionAdmissionRequest): Promise<ChatSessionAdmissionResult>;
  resume(request: ChatSessionResumeRequest): Promise<ChatSessionAdmissionResult | null>;
  attachSocket(sessionId: ChatSessionId, socketId: ChatSocketId): ChatSessionAuthoritySnapshot;
  detachSocket(socketId: ChatSocketId): ChatSessionAuthoritySnapshot | null;
  markDisconnected(request: ChatSessionDisconnectRequest): ChatSessionAuthoritySnapshot | null;
  terminate(
    sessionId: ChatSessionId,
    reason: ChatSessionTerminationReason,
    metadata?: Readonly<Record<string, unknown>>,
  ): ChatSessionAuthoritySnapshot | null;
  getAuthoritySnapshot(sessionId: ChatSessionId): ChatSessionAuthoritySnapshot | null;
}

// ============================================================================
// MARK: Internal records
// ============================================================================

interface MutableChatSessionAuthorityRecord {
  sessionId: ChatSessionId;
  userId: ChatUserId;
  username: string;
  authLevel: ChatTransportAuthLevel;
  authorityState: ChatSessionAuthorityState;
  restrictions: Set<ChatSessionRestriction>;
  admittedAt: number;
  updatedAt: number;
  mutedUntil: number | null;
  suspendedUntil: number | null;
  quarantinedUntil: number | null;
  terminatedAt: number | null;
  terminationReason: ChatSessionTerminationReason | null;
  fingerprint: string;
  ipHash: string;
  userAgentHash: string;
  nodeId: string;
  namespace: string;
  mountTarget: ChatMountTarget | null;
  clientVersion: string | null;
  transportFeatures: string[];
  resumeTicketIds: Set<string>;
  noteIds: Set<string>;
  metadata: Record<string, unknown>;
}

interface MutableReconnectTicketRecord {
  ticketId: string;
  sessionId: ChatSessionId;
  userId: ChatUserId;
  fingerprint: string;
  issuedAt: number;
  expiresAt: number;
  consumedAt: number | null;
  socketIdHint: ChatSocketId | null;
  namespace: string;
  mountTarget: ChatMountTarget | null;
  metadata: Record<string, unknown>;
}

interface MutableAuthorityNoteRecord {
  noteId: string;
  sessionId: ChatSessionId;
  code: string;
  message: string;
  createdAt: number;
  expiresAt: number | null;
  metadata: Record<string, unknown>;
}

interface MutableSocketClaimRecord {
  socketId: ChatSocketId;
  sessionId: ChatSessionId;
  claimedAt: number;
  updatedAt: number;
}

// ============================================================================
// MARK: Config
// ============================================================================

export interface ChatSessionRegistryConfig {
  readonly nodeId: string;
  readonly maxSessionsPerUser: number;
  readonly maxSocketsPerSession: number;
  readonly reconnectTicketTtlMs: number;
  readonly noteDefaultTtlMs: number;
  readonly muteDefaultTtlMs: number;
  readonly quarantineDefaultTtlMs: number;
  readonly suspendDefaultTtlMs: number;
  readonly enforceSingleActiveSessionForAnonymous: boolean;
  readonly issueReconnectTicketsOnAdmission: boolean;
  readonly issueReconnectTicketsOnDisconnect: boolean;
  readonly sweepExpiredEveryMs: number;
  readonly allowResumeAcrossSockets: boolean;
  readonly allowResumeAcrossNamespaces: boolean;
  readonly registryConfig: Partial<ChatRoomRegistryConfig>;
}

export const DEFAULT_CHAT_SESSION_REGISTRY_CONFIG: Readonly<ChatSessionRegistryConfig> = Object.freeze({
  nodeId: `chat-session:${randomUUID()}`,
  maxSessionsPerUser: 6,
  maxSocketsPerSession: DEFAULT_CHAT_ROOM_REGISTRY_CONFIG.maxSocketsPerSession,
  reconnectTicketTtlMs: 5 * 60_000,
  noteDefaultTtlMs: 30 * 60_000,
  muteDefaultTtlMs: 10 * 60_000,
  quarantineDefaultTtlMs: 10 * 60_000,
  suspendDefaultTtlMs: 30 * 60_000,
  enforceSingleActiveSessionForAnonymous: true,
  issueReconnectTicketsOnAdmission: true,
  issueReconnectTicketsOnDisconnect: true,
  sweepExpiredEveryMs: 15_000,
  allowResumeAcrossSockets: true,
  allowResumeAcrossNamespaces: false,
  registryConfig: {},
});

// ============================================================================
// MARK: Helpers
// ============================================================================

function nowMs(): number {
  return Date.now();
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(sortValue(value))).digest('hex');
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, next]) => [key, sortValue(next)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function dedupe<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function normalizeRestrictionSet(
  input?: readonly ChatSessionRestriction[],
): Set<ChatSessionRestriction> {
  return new Set(input ?? []);
}

function mergeMetadata(
  left?: Readonly<Record<string, unknown>>,
  right?: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    ...(left ?? {}),
    ...(right ?? {}),
  };
}

function uniqueArray<T>(values: Iterable<T>): readonly T[] {
  return Object.freeze(Array.from(new Set(values)));
}

function normalizeTerminationReason(
  reason: ChatSessionTerminationReason | null | undefined,
): ChatSessionTerminationReason | null {
  return reason ?? null;
}

// ============================================================================
// MARK: Main implementation
// ============================================================================

export interface ChatSessionRegistryOptions {
  readonly config?: Partial<ChatSessionRegistryConfig>;
  readonly registry?: ChatRoomRegistry;
}

export class ChatSessionRegistry implements ChatSessionRegistryPort {
  private readonly config: ChatSessionRegistryConfig;
  private readonly registry: ChatRoomRegistry;
  private readonly authorities = new Map<ChatSessionId, MutableChatSessionAuthorityRecord>();
  private readonly reconnectTickets = new Map<string, MutableReconnectTicketRecord>();
  private readonly notes = new Map<string, MutableAuthorityNoteRecord>();
  private readonly socketClaims = new Map<ChatSocketId, MutableSocketClaimRecord>();
  private readonly userToSessions = new Map<ChatUserId, Set<ChatSessionId>>();
  private readonly sessionToTickets = new Map<ChatSessionId, Set<string>>();
  private readonly sweepHandle: ReturnType<typeof setInterval> | null;

  public constructor(options?: ChatSessionRegistryOptions) {
    this.config = {
      ...DEFAULT_CHAT_SESSION_REGISTRY_CONFIG,
      ...(options?.config ?? {}),
      registryConfig: {
        ...DEFAULT_CHAT_SESSION_REGISTRY_CONFIG.registryConfig,
        ...(options?.config?.registryConfig ?? {}),
      },
    };

    this.registry =
      options?.registry ??
      new ChatRoomRegistry({
        ...this.config.registryConfig,
        maxSocketsPerSession: this.config.maxSocketsPerSession,
      });

    this.sweepHandle = setInterval(() => {
      try {
        this.sweepExpiredState();
      } catch {
        // transport sweeps must never crash the node
      }
    }, this.config.sweepExpiredEveryMs);
  }

  // ==========================================================================
  // MARK: Admission
  // ==========================================================================

  public async admit(
    request: ChatSessionAdmissionRequest,
  ): Promise<ChatSessionAdmissionResult> {
    this.sweepExpiredState();

    const existing = this.resolveReusableSessionForAdmission(request);
    if (existing) {
      const attached = this.registry.attachSocket(existing.sessionId, request.socketId);
      this.claimSocket(request.socketId, existing.sessionId);
      this.patchAuthorityFromTransport(existing.sessionId, attached, request);
      const authority = this.getAuthoritySnapshot(existing.sessionId)!;
      const reconnectTicket = this.config.issueReconnectTicketsOnAdmission
        ? this.issueReconnectTicket(existing.sessionId, request.socketId, authority.fingerprint, {
            source: 'admission-reuse',
          })
        : null;

      return {
        session: attached,
        authority,
        reconnectTicket,
        reusedExistingSession: true,
      };
    }

    this.assertAdmissionQuota(request.auth.userId, request.auth.authLevel);

    const seed = this.buildTransportSeed(request);
    const session = this.registry.registerSession(seed);
    this.claimSocket(request.socketId, session.sessionId);
    this.linkUserSession(session.identity.userId, session.sessionId);
    this.ensureAuthorityRecord(session, request);

    const authority = this.getAuthoritySnapshot(session.sessionId)!;
    const reconnectTicket = this.config.issueReconnectTicketsOnAdmission
      ? this.issueReconnectTicket(
          session.sessionId,
          request.socketId,
          authority.fingerprint,
          { source: 'admission' },
        )
      : null;

    return {
      session,
      authority,
      reconnectTicket,
      reusedExistingSession: false,
    };
  }

  public async resume(
    request: ChatSessionResumeRequest,
  ): Promise<ChatSessionAdmissionResult | null> {
    this.sweepExpiredState();

    const resolvedSessionId =
      this.consumeReconnectTicketIfPresent(request) ??
      request.sessionIdHint ??
      request.auth.sessionIdHint ??
      null;

    if (!resolvedSessionId) {
      return null;
    }

    const authority = this.authorities.get(resolvedSessionId);
    if (!authority) {
      return null;
    }

    if (
      authority.authorityState === 'TERMINATED' ||
      authority.authorityState === 'SUSPENDED'
    ) {
      return null;
    }

    if (authority.userId !== request.auth.userId) {
      return null;
    }

    if (
      !this.config.allowResumeAcrossNamespaces &&
      authority.namespace !== request.namespace
    ) {
      return null;
    }

    if (!this.config.allowResumeAcrossSockets && authority.transportFeatures.length > 0) {
      return null;
    }

    const attached = this.registry.attachSocket(resolvedSessionId, request.socketId);
    this.claimSocket(request.socketId, resolvedSessionId);
    this.patchAuthorityFromTransport(resolvedSessionId, attached, {
      socketId: request.socketId,
      namespace: request.namespace,
      auth: request.auth,
      metadata: request.metadata,
    });

    const snapshot = this.getAuthoritySnapshot(resolvedSessionId)!;
    const reconnectTicket = this.issueReconnectTicket(
      resolvedSessionId,
      request.socketId,
      snapshot.fingerprint,
      { source: 'resume' },
    );

    return {
      session: attached,
      authority: snapshot,
      reconnectTicket,
      reusedExistingSession: true,
    };
  }

  // ==========================================================================
  // MARK: Socket lifecycle
  // ==========================================================================

  public attachSocket(
    sessionId: ChatSessionId,
    socketId: ChatSocketId,
  ): ChatSessionAuthoritySnapshot {
    const session = this.registry.attachSocket(sessionId, socketId);
    this.claimSocket(socketId, sessionId);
    this.patchAuthorityFromTransport(sessionId, session, null);
    return this.getAuthoritySnapshot(sessionId)!;
  }

  public detachSocket(socketId: ChatSocketId): ChatSessionAuthoritySnapshot | null {
    const transport = this.registry.detachSocket(socketId);
    const claim = this.socketClaims.get(socketId);
    this.socketClaims.delete(socketId);

    if (!claim || !transport) {
      return claim ? this.getAuthoritySnapshot(claim.sessionId) : null;
    }

    const authority = this.authorities.get(claim.sessionId);
    if (!authority) {
      return null;
    }

    authority.updatedAt = nowMs();

    if (this.config.issueReconnectTicketsOnDisconnect) {
      this.issueReconnectTicket(claim.sessionId, socketId, authority.fingerprint, {
        source: 'detach',
      });
    }

    return this.getAuthoritySnapshot(claim.sessionId);
  }

  public markDisconnected(
    request: ChatSessionDisconnectRequest,
  ): ChatSessionAuthoritySnapshot | null {
    const authority = this.authorities.get(request.sessionId);
    if (!authority) {
      return null;
    }

    if (request.socketId) {
      this.socketClaims.delete(request.socketId);
    }

    const transport = this.registry.markDisconnected(request.sessionId);
    authority.updatedAt = nowMs();

    if (authority.authorityState === 'ADMITTED') {
      authority.authorityState = authority.restrictions.has('READ_ONLY')
        ? 'READ_ONLY'
        : 'ADMITTED';
    }

    if (this.config.issueReconnectTicketsOnDisconnect) {
      this.issueReconnectTicket(
        request.sessionId,
        request.socketId ?? null,
        authority.fingerprint,
        { source: 'disconnect', reason: request.reason ?? null },
      );
    }

    return transport ? this.getAuthoritySnapshot(request.sessionId) : null;
  }

  // ==========================================================================
  // MARK: Authority state changes
  // ==========================================================================

  public mute(
    sessionId: ChatSessionId,
    untilMs?: number | null,
    metadata?: Readonly<Record<string, unknown>>,
  ): ChatSessionAuthoritySnapshot | null {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return null;
    }

    authority.mutedUntil = untilMs ?? (nowMs() + this.config.muteDefaultTtlMs);
    authority.authorityState = 'MUTED';
    authority.restrictions.add('BLOCK_MESSAGE_SUBMIT');
    authority.updatedAt = nowMs();
    authority.metadata = mergeMetadata(authority.metadata, metadata);
    this.addNote(sessionId, 'MUTE', 'Session muted', metadata, authority.mutedUntil);
    return this.getAuthoritySnapshot(sessionId);
  }

  public unmute(sessionId: ChatSessionId): ChatSessionAuthoritySnapshot | null {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return null;
    }

    authority.mutedUntil = null;
    authority.restrictions.delete('BLOCK_MESSAGE_SUBMIT');
    authority.updatedAt = nowMs();
    this.recomputeAuthorityState(authority);
    return this.getAuthoritySnapshot(sessionId);
  }

  public quarantine(
    sessionId: ChatSessionId,
    untilMs?: number | null,
    metadata?: Readonly<Record<string, unknown>>,
  ): ChatSessionAuthoritySnapshot | null {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return null;
    }

    authority.quarantinedUntil = untilMs ?? (nowMs() + this.config.quarantineDefaultTtlMs);
    authority.authorityState = 'QUARANTINED';
    authority.restrictions.add('BLOCK_PRIVATE_ROOMS');
    authority.restrictions.add('BLOCK_SHADOW_ROOMS');
    authority.restrictions.add('FORCE_VISIBLE');
    authority.updatedAt = nowMs();
    authority.metadata = mergeMetadata(authority.metadata, metadata);
    this.addNote(
      sessionId,
      'QUARANTINE',
      'Session quarantined by transport authority',
      metadata,
      authority.quarantinedUntil,
    );
    return this.getAuthoritySnapshot(sessionId);
  }

  public unquarantine(sessionId: ChatSessionId): ChatSessionAuthoritySnapshot | null {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return null;
    }

    authority.quarantinedUntil = null;
    authority.restrictions.delete('BLOCK_PRIVATE_ROOMS');
    authority.restrictions.delete('BLOCK_SHADOW_ROOMS');
    authority.restrictions.delete('FORCE_VISIBLE');
    authority.updatedAt = nowMs();
    this.recomputeAuthorityState(authority);
    return this.getAuthoritySnapshot(sessionId);
  }

  public suspend(
    sessionId: ChatSessionId,
    untilMs?: number | null,
    metadata?: Readonly<Record<string, unknown>>,
  ): ChatSessionAuthoritySnapshot | null {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return null;
    }

    authority.suspendedUntil = untilMs ?? (nowMs() + this.config.suspendDefaultTtlMs);
    authority.authorityState = 'SUSPENDED';
    authority.restrictions.add('BLOCK_MESSAGE_SUBMIT');
    authority.restrictions.add('BLOCK_ROOM_JOIN');
    authority.restrictions.add('BLOCK_CURSOR');
    authority.restrictions.add('BLOCK_TYPING');
    authority.updatedAt = nowMs();
    authority.metadata = mergeMetadata(authority.metadata, metadata);
    this.addNote(
      sessionId,
      'SUSPEND',
      'Session suspended by transport authority',
      metadata,
      authority.suspendedUntil,
    );
    return this.getAuthoritySnapshot(sessionId);
  }

  public unsuspend(sessionId: ChatSessionId): ChatSessionAuthoritySnapshot | null {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return null;
    }

    authority.suspendedUntil = null;
    authority.restrictions.delete('BLOCK_MESSAGE_SUBMIT');
    authority.restrictions.delete('BLOCK_ROOM_JOIN');
    authority.restrictions.delete('BLOCK_CURSOR');
    authority.restrictions.delete('BLOCK_TYPING');
    authority.updatedAt = nowMs();
    this.recomputeAuthorityState(authority);
    return this.getAuthoritySnapshot(sessionId);
  }

  public changeRestrictions(
    sessionId: ChatSessionId,
    change: ChatSessionRestrictionChange,
  ): ChatSessionAuthoritySnapshot | null {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return null;
    }

    for (const restriction of change.add ?? []) {
      authority.restrictions.add(restriction);
    }

    for (const restriction of change.remove ?? []) {
      authority.restrictions.delete(restriction);
    }

    authority.updatedAt = nowMs();
    authority.metadata = mergeMetadata(authority.metadata, change.metadata);
    this.recomputeAuthorityState(authority);
    return this.getAuthoritySnapshot(sessionId);
  }

  public terminate(
    sessionId: ChatSessionId,
    reason: ChatSessionTerminationReason,
    metadata?: Readonly<Record<string, unknown>>,
  ): ChatSessionAuthoritySnapshot | null {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return null;
    }

    authority.authorityState = 'TERMINATED';
    authority.terminatedAt = nowMs();
    authority.terminationReason = normalizeTerminationReason(reason);
    authority.updatedAt = authority.terminatedAt;
    authority.metadata = mergeMetadata(authority.metadata, metadata);
    authority.restrictions.add('BLOCK_MESSAGE_SUBMIT');
    authority.restrictions.add('BLOCK_ROOM_JOIN');
    authority.restrictions.add('BLOCK_CURSOR');
    authority.restrictions.add('BLOCK_TYPING');
    this.registry.markDisconnected(sessionId);
    this.addNote(
      sessionId,
      'TERMINATE',
      `Session terminated (${reason})`,
      metadata,
      null,
    );
    return this.getAuthoritySnapshot(sessionId);
  }

  // ==========================================================================
  // MARK: Tickets, notes, and snapshots
  // ==========================================================================

  public issueReconnectTicket(
    sessionId: ChatSessionId,
    socketIdHint: ChatSocketId | null,
    fingerprint: string,
    metadata?: Readonly<Record<string, unknown>>,
  ): ChatReconnectTicket | null {
    const authority = this.authorities.get(sessionId);
    if (!authority || authority.authorityState === 'TERMINATED') {
      return null;
    }

    const ticketId = `ticket:${randomUUID()}`;
    const issuedAt = nowMs();
    const record: MutableReconnectTicketRecord = {
      ticketId,
      sessionId,
      userId: authority.userId,
      fingerprint,
      issuedAt,
      expiresAt: issuedAt + this.config.reconnectTicketTtlMs,
      consumedAt: null,
      socketIdHint,
      namespace: authority.namespace,
      mountTarget: authority.mountTarget,
      metadata: { ...(metadata ?? {}) },
    };

    this.reconnectTickets.set(ticketId, record);
    authority.resumeTicketIds.add(ticketId);

    let bucket = this.sessionToTickets.get(sessionId);
    if (!bucket) {
      bucket = new Set<string>();
      this.sessionToTickets.set(sessionId, bucket);
    }
    bucket.add(ticketId);

    authority.updatedAt = issuedAt;
    return this.toReconnectTicket(record);
  }

  public consumeReconnectTicket(
    ticketId: string,
    authUserId: ChatUserId,
    fingerprint?: string | null,
  ): ChatReconnectTicket | null {
    this.sweepExpiredState();
    const record = this.reconnectTickets.get(ticketId);
    if (!record) {
      return null;
    }

    if (record.expiresAt <= nowMs() || record.consumedAt != null) {
      return null;
    }

    if (record.userId !== authUserId) {
      return null;
    }

    if (fingerprint && record.fingerprint !== fingerprint) {
      return null;
    }

    record.consumedAt = nowMs();
    return this.toReconnectTicket(record);
  }

  public addNote(
    sessionId: ChatSessionId,
    code: string,
    message: string,
    metadata?: Readonly<Record<string, unknown>>,
    expiresAt?: number | null,
  ): ChatSessionAuthorityNote | null {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return null;
    }

    const noteId = `note:${randomUUID()}`;
    const record: MutableAuthorityNoteRecord = {
      noteId,
      sessionId,
      code,
      message,
      createdAt: nowMs(),
      expiresAt: expiresAt ?? (nowMs() + this.config.noteDefaultTtlMs),
      metadata: { ...(metadata ?? {}) },
    };

    this.notes.set(noteId, record);
    authority.noteIds.add(noteId);
    authority.updatedAt = nowMs();

    return this.toNote(record);
  }

  public getAuthoritySnapshot(
    sessionId: ChatSessionId,
  ): ChatSessionAuthoritySnapshot | null {
    this.sweepExpiredState();
    const authority = this.authorities.get(sessionId);
    const transport = this.registry.getSessionSnapshot(sessionId);
    if (!authority || !transport) {
      return null;
    }
    return this.toAuthoritySnapshot(authority, transport);
  }

  public listAuthoritySnapshotsForUser(
    userId: ChatUserId,
  ): readonly ChatSessionAuthoritySnapshot[] {
    this.sweepExpiredState();
    const ids = this.userToSessions.get(userId);
    if (!ids) {
      return Object.freeze([]);
    }

    return Object.freeze(
      Array.from(ids)
        .map((sessionId) => this.getAuthoritySnapshot(sessionId))
        .filter((value): value is ChatSessionAuthoritySnapshot => Boolean(value)),
    );
  }

  public exportAuditSnapshot(): ChatSessionAuthorityAuditSnapshot {
    this.sweepExpiredState();

    const sessions = Array.from(this.authorities.keys())
      .map((sessionId) => this.getAuthoritySnapshot(sessionId))
      .filter((value): value is ChatSessionAuthoritySnapshot => Boolean(value))
      .sort((left, right) => left.sessionId.localeCompare(right.sessionId));

    const activeCount = sessions.filter((item) => item.authorityState === 'ADMITTED').length;
    const readOnlyCount = sessions.filter((item) => item.authorityState === 'READ_ONLY').length;
    const mutedCount = sessions.filter((item) => item.authorityState === 'MUTED').length;
    const quarantinedCount = sessions.filter((item) => item.authorityState === 'QUARANTINED').length;
    const suspendedCount = sessions.filter((item) => item.authorityState === 'SUSPENDED').length;
    const terminatedCount = sessions.filter((item) => item.authorityState === 'TERMINATED').length;

    const snapshot: ChatSessionAuthorityAuditSnapshot = {
      generatedAt: nowMs(),
      nodeId: this.config.nodeId,
      sessionCount: sessions.length,
      activeCount,
      readOnlyCount,
      mutedCount,
      quarantinedCount,
      suspendedCount,
      terminatedCount,
      reconnectTicketCount: this.reconnectTickets.size,
      hash: stableHash({
        nodeId: this.config.nodeId,
        sessions,
      }),
      sessions: Object.freeze(sessions),
    };

    return Object.freeze(snapshot);
  }

  // ==========================================================================
  // MARK: Internal admission helpers
  // ==========================================================================

  private resolveReusableSessionForAdmission(
    request: ChatSessionAdmissionRequest,
  ): ChatSessionAuthoritySnapshot | null {
    const sessionIdHint = request.auth.sessionIdHint ?? null;
    if (!sessionIdHint) {
      return null;
    }

    const authority = this.getAuthoritySnapshot(sessionIdHint);
    if (!authority) {
      return null;
    }

    if (authority.userId !== request.auth.userId) {
      return null;
    }

    if (authority.authorityState === 'TERMINATED' || authority.authorityState === 'SUSPENDED') {
      return null;
    }

    if (
      !this.config.allowResumeAcrossNamespaces &&
      authority.namespace !== request.namespace
    ) {
      return null;
    }

    return authority;
  }

  private buildTransportSeed(
    request: ChatSessionAdmissionRequest,
  ): ChatTransportSessionSeed {
    return {
      sessionId: request.auth.sessionIdHint ?? undefined,
      socketId: request.socketId,
      namespace: request.namespace,
      identity: this.buildTransportIdentity(request),
      reconnectOf: request.auth.sessionIdHint ?? null,
      serverNodeId: request.serverNodeId ?? this.config.nodeId,
      mountTarget: request.mountTarget ?? request.auth.mountTarget ?? null,
      clientVersion: request.clientVersion ?? request.auth.clientVersion ?? null,
      transportFeatures: request.transportFeatures ?? request.auth.transportFeatures ?? [],
      metadata: mergeMetadata(request.auth.metadata, request.metadata),
    };
  }

  private buildTransportIdentity(
    request: ChatSessionAdmissionRequest,
  ): ChatTransportIdentity {
    return {
      userId: request.auth.userId,
      username: request.auth.username,
      authLevel: request.auth.authLevel,
      status: 'ACTIVE',
      partyId: request.auth.partyId ?? null,
      modeId: request.auth.modeId ?? null,
      runId: request.auth.runId ?? null,
      traits: request.auth.traits ?? [],
      metadata: mergeMetadata(request.auth.metadata, {
        auditId: request.auth.auditId,
        risks: request.auth.risks ?? [],
        verdict: request.auth.verdict,
        restrictions: request.auth.restrictions ?? [],
      }),
    };
  }

  private assertAdmissionQuota(
    userId: ChatUserId,
    authLevel: ChatTransportAuthLevel,
  ): void {
    const active = this.listAuthoritySnapshotsForUser(userId).filter(
      (item) => item.authorityState !== 'TERMINATED',
    );

    if (
      authLevel === 'ANON' &&
      this.config.enforceSingleActiveSessionForAnonymous &&
      active.length >= 1
    ) {
      throw new Error(`Anonymous user ${userId} already has an active transport session`);
    }

    if (active.length >= this.config.maxSessionsPerUser) {
      throw new Error(
        `User ${userId} exceeded max transport sessions (${this.config.maxSessionsPerUser})`,
      );
    }
  }

  private ensureAuthorityRecord(
    session: ChatTransportSessionSnapshot,
    request: ChatSessionAdmissionRequest,
  ): void {
    const authorityState =
      request.auth.restrictions?.includes('READ_ONLY')
        ? 'READ_ONLY'
        : request.auth.verdict === 'QUARANTINE'
        ? 'QUARANTINED'
        : 'ADMITTED';

    const restrictions = normalizeRestrictionSet(
      mapAuthRestrictionsToSessionRestrictions(request.auth.restrictions ?? []),
    );

    if (request.auth.verdict === 'QUARANTINE') {
      restrictions.add('BLOCK_PRIVATE_ROOMS');
      restrictions.add('BLOCK_SHADOW_ROOMS');
      restrictions.add('FORCE_VISIBLE');
    }

    const now = nowMs();
    const record: MutableChatSessionAuthorityRecord = {
      sessionId: session.sessionId,
      userId: session.identity.userId,
      username: session.identity.username,
      authLevel: session.identity.authLevel,
      authorityState,
      restrictions,
      admittedAt: now,
      updatedAt: now,
      mutedUntil: null,
      suspendedUntil: null,
      quarantinedUntil:
        request.auth.verdict === 'QUARANTINE'
          ? now + this.config.quarantineDefaultTtlMs
          : null,
      terminatedAt: null,
      terminationReason: null,
      fingerprint: request.auth.fingerprint ?? stableHash(session.identity.userId),
      ipHash: request.auth.ipHash ?? stableHash(session.identity.userId),
      userAgentHash: request.auth.userAgentHash ?? stableHash(session.identity.username),
      nodeId: request.serverNodeId ?? this.config.nodeId,
      namespace: request.namespace,
      mountTarget: request.mountTarget ?? request.auth.mountTarget ?? null,
      clientVersion: request.clientVersion ?? request.auth.clientVersion ?? null,
      transportFeatures: dedupe([
        ...(request.transportFeatures ?? []),
        ...(request.auth.transportFeatures ?? []),
      ]),
      resumeTicketIds: new Set<string>(),
      noteIds: new Set<string>(),
      metadata: mergeMetadata(request.auth.metadata, request.metadata),
    };

    this.authorities.set(session.sessionId, record);

    if (!this.userToSessions.has(record.userId)) {
      this.userToSessions.set(record.userId, new Set<ChatSessionId>());
    }
    this.userToSessions.get(record.userId)!.add(session.sessionId);

    if (record.authorityState === 'QUARANTINED') {
      this.addNote(
        session.sessionId,
        'AUTH_QUARANTINE',
        'Session admitted in quarantined transport mode',
        { risks: request.auth.risks ?? [], reasons: request.auth.reasons ?? [] },
        record.quarantinedUntil,
      );
    }
  }

  private claimSocket(
    socketId: ChatSocketId,
    sessionId: ChatSessionId,
  ): void {
    const now = nowMs();
    const existing = this.socketClaims.get(socketId);
    if (existing) {
      existing.sessionId = sessionId;
      existing.updatedAt = now;
      return;
    }

    this.socketClaims.set(socketId, {
      socketId,
      sessionId,
      claimedAt: now,
      updatedAt: now,
    });
  }

  private patchAuthorityFromTransport(
    sessionId: ChatSessionId,
    transport: ChatTransportSessionSnapshot,
    request:
      | Pick<ChatSessionAdmissionRequest, 'namespace' | 'auth' | 'metadata' | 'socketId'>
      | null,
  ): void {
    const authority = this.authorities.get(sessionId);
    if (!authority) {
      return;
    }

    authority.username = transport.identity.username;
    authority.authLevel = transport.identity.authLevel;
    authority.namespace = transport.namespace;
    authority.mountTarget =
      request?.auth.mountTarget ??
      authority.mountTarget ??
      transport.mountTarget ??
      null;
    authority.clientVersion =
      request?.auth.clientVersion ??
      authority.clientVersion ??
      transport.clientVersion ??
      null;
    authority.transportFeatures = dedupe([
      ...authority.transportFeatures,
      ...(transport.transportFeatures ?? []),
      ...(request?.auth.transportFeatures ?? []),
    ]);
    authority.updatedAt = nowMs();
    authority.metadata = mergeMetadata(authority.metadata, request?.metadata);
    this.recomputeAuthorityState(authority);
  }

  private linkUserSession(userId: ChatUserId, sessionId: ChatSessionId): void {
    let bucket = this.userToSessions.get(userId);
    if (!bucket) {
      bucket = new Set<ChatSessionId>();
      this.userToSessions.set(userId, bucket);
    }
    bucket.add(sessionId);
  }

  private consumeReconnectTicketIfPresent(
    request: ChatSessionResumeRequest,
  ): ChatSessionId | null {
    const ticketId = request.ticketId ?? request.auth.resumeTokenId ?? null;
    if (!ticketId) {
      return null;
    }

    const ticket = this.consumeReconnectTicket(
      ticketId,
      request.auth.userId,
      request.auth.fingerprint ?? null,
    );

    return ticket?.sessionId ?? null;
  }

  private recomputeAuthorityState(
    authority: MutableChatSessionAuthorityRecord,
  ): void {
    if (authority.terminatedAt != null) {
      authority.authorityState = 'TERMINATED';
      return;
    }

    if (authority.suspendedUntil && authority.suspendedUntil > nowMs()) {
      authority.authorityState = 'SUSPENDED';
      return;
    }

    if (authority.quarantinedUntil && authority.quarantinedUntil > nowMs()) {
      authority.authorityState = 'QUARANTINED';
      return;
    }

    if (authority.mutedUntil && authority.mutedUntil > nowMs()) {
      authority.authorityState = 'MUTED';
      return;
    }

    if (authority.restrictions.has('READ_ONLY')) {
      authority.authorityState = 'READ_ONLY';
      return;
    }

    authority.authorityState = 'ADMITTED';
  }

  // ==========================================================================
  // MARK: Sweep and cleanup
  // ==========================================================================

  public sweepExpiredState(): void {
    const now = nowMs();

    for (const [ticketId, ticket] of this.reconnectTickets.entries()) {
      if (ticket.expiresAt <= now || ticket.consumedAt != null) {
        this.reconnectTickets.delete(ticketId);
        this.sessionToTickets.get(ticket.sessionId)?.delete(ticketId);
        this.authorities.get(ticket.sessionId)?.resumeTicketIds.delete(ticketId);
      }
    }

    for (const [noteId, note] of this.notes.entries()) {
      if (note.expiresAt != null && note.expiresAt <= now) {
        this.notes.delete(noteId);
        this.authorities.get(note.sessionId)?.noteIds.delete(noteId);
      }
    }

    for (const authority of this.authorities.values()) {
      if (authority.mutedUntil != null && authority.mutedUntil <= now) {
        authority.mutedUntil = null;
        authority.restrictions.delete('BLOCK_MESSAGE_SUBMIT');
      }

      if (authority.quarantinedUntil != null && authority.quarantinedUntil <= now) {
        authority.quarantinedUntil = null;
        authority.restrictions.delete('BLOCK_PRIVATE_ROOMS');
        authority.restrictions.delete('BLOCK_SHADOW_ROOMS');
        authority.restrictions.delete('FORCE_VISIBLE');
      }

      if (authority.suspendedUntil != null && authority.suspendedUntil <= now) {
        authority.suspendedUntil = null;
        authority.restrictions.delete('BLOCK_MESSAGE_SUBMIT');
        authority.restrictions.delete('BLOCK_ROOM_JOIN');
        authority.restrictions.delete('BLOCK_CURSOR');
        authority.restrictions.delete('BLOCK_TYPING');
      }

      this.recomputeAuthorityState(authority);
    }
  }

  public destroy(): void {
    if (this.sweepHandle) {
      clearInterval(this.sweepHandle);
    }
  }

  // ==========================================================================
  // MARK: Serialization
  // ==========================================================================

  private toReconnectTicket(
    record: MutableReconnectTicketRecord,
  ): ChatReconnectTicket {
    return Object.freeze({
      ticketId: record.ticketId,
      sessionId: record.sessionId,
      userId: record.userId,
      fingerprint: record.fingerprint,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      consumedAt: record.consumedAt,
      socketIdHint: record.socketIdHint,
      namespace: record.namespace,
      mountTarget: record.mountTarget,
      metadata: Object.freeze({ ...record.metadata }),
    });
  }

  private toNote(record: MutableAuthorityNoteRecord): ChatSessionAuthorityNote {
    return Object.freeze({
      noteId: record.noteId,
      code: record.code,
      message: record.message,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      metadata: Object.freeze({ ...record.metadata }),
    });
  }

  private toAuthoritySnapshot(
    authority: MutableChatSessionAuthorityRecord,
    transport: ChatTransportSessionSnapshot,
  ): ChatSessionAuthoritySnapshot {
    return Object.freeze({
      sessionId: authority.sessionId,
      userId: authority.userId,
      username: authority.username,
      authLevel: authority.authLevel,
      authorityState: authority.authorityState,
      restrictions: uniqueArray(authority.restrictions),
      admittedAt: authority.admittedAt,
      updatedAt: authority.updatedAt,
      mutedUntil: authority.mutedUntil,
      suspendedUntil: authority.suspendedUntil,
      quarantinedUntil: authority.quarantinedUntil,
      terminatedAt: authority.terminatedAt,
      terminationReason: authority.terminationReason,
      fingerprint: authority.fingerprint,
      ipHash: authority.ipHash,
      userAgentHash: authority.userAgentHash,
      nodeId: authority.nodeId,
      namespace: authority.namespace,
      mountTarget: authority.mountTarget,
      clientVersion: authority.clientVersion,
      transportFeatures: uniqueArray(authority.transportFeatures),
      roomIds: uniqueArray(transport.roomIds),
      socketIds: uniqueArray(transport.socketIds),
      resumeTicketIds: uniqueArray(authority.resumeTicketIds),
      noteCount: authority.noteIds.size,
      transportSession: transport,
      metadata: Object.freeze({ ...authority.metadata }),
    });
  }
}

// ============================================================================
// MARK: Mapping helpers
// ============================================================================

function mapAuthRestrictionsToSessionRestrictions(
  input: readonly string[],
): readonly ChatSessionRestriction[] {
  const output = new Set<ChatSessionRestriction>();

  for (const restriction of input) {
    switch (restriction) {
      case 'READ_ONLY':
        output.add('READ_ONLY');
        output.add('BLOCK_MESSAGE_SUBMIT');
        break;
      case 'NO_DIRECT_FANOUT':
        output.add('BLOCK_DIRECT_FANOUT');
        break;
      case 'NO_PRIVATE_ENTRY':
        output.add('BLOCK_PRIVATE_ROOMS');
        break;
      case 'NO_SHADOW_ENTRY':
        output.add('BLOCK_SHADOW_ROOMS');
        break;
      case 'LIMIT_TYPING':
        output.add('BLOCK_TYPING');
        break;
      case 'LIMIT_CURSOR':
        output.add('BLOCK_CURSOR');
        break;
      case 'FORCE_VISIBLE':
        output.add('FORCE_VISIBLE');
        break;
      default:
        break;
    }
  }

  return Object.freeze(Array.from(output));
}

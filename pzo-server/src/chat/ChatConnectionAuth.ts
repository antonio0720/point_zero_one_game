/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE CHAT CONNECTION AUTH
 * FILE: pzo-server/src/chat/ChatConnectionAuth.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file hardens connection admission for the unified chat transport lane.
 *
 * It exists because the donor websocket lane is intentionally thin and because
 * the dedicated ChatGateway must not keep a toy handshake model embedded inside
 * transport listeners forever. This file extracts and deepens those rules.
 *
 * Doctrine
 * --------
 * - Transport is servant, not brain.
 * - Connection auth may decide who can attach and with what transport trust,
 *   but it does not become transcript truth or moderation truth.
 * - Backend chat still owns message truth, room truth, NPC truth, replay truth,
 *   and learning truth.
 * - This file is allowed to:
 *   * parse and normalize the socket handshake,
 *   * evaluate hints such as roomId / sessionId / modeId / runId / partyId,
 *   * verify bearer or resume credentials through pluggable ports,
 *   * apply rate, replay, and ban checks at handshake time,
 *   * generate a durable transport-auth context,
 *   * emit audit-grade admission results.
 * - This file is NOT allowed to:
 *   * mutate transcript history,
 *   * mutate backend engine state directly,
 *   * invent gameplay truth,
 *   * bypass backend policy by marking messages valid.
 *
 * Donor lanes
 * -----------
 * This file supersedes the simplistic assumptions visible in:
 * - pzo-server/src/ws/action-validator.ts
 * - pzo-server/src/ws/socket-server.ts
 * - pzo-server/src/multiplayer/contracts.ts
 * - pzo-server/src/multiplayer/player.ts
 *
 * It preserves those lanes as adapters and audit donors instead of pretending
 * they already constitute a production-ready transport-auth system.
 * ============================================================================
 */

import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Socket } from 'socket.io';

import { ActionValidator } from '../ws/action-validator';
import type {
  ChatMountTarget,
  ChatRoomId,
  ChatSessionId,
  ChatSocketId,
  ChatTransportAuthLevel,
  ChatUserId,
} from './ChatRoomRegistry';

// ============================================================================
// MARK: Public context and compatibility types
// ============================================================================

export type ChatConnectionVerdict =
  | 'ALLOW'
  | 'ALLOW_WITH_RESTRICTIONS'
  | 'CHALLENGE'
  | 'QUARANTINE'
  | 'DENY';

export type ChatConnectionCredentialKind =
  | 'ANON'
  | 'SESSION_HINT'
  | 'RESUME_TOKEN'
  | 'BEARER'
  | 'API_KEY'
  | 'SIGNED_PROOF'
  | 'LEGACY';

export type ChatConnectionRestrictionCode =
  | 'READ_ONLY'
  | 'NO_DIRECT_FANOUT'
  | 'NO_SHADOW_ENTRY'
  | 'NO_PRIVATE_ENTRY'
  | 'NO_DEALROOM_ENTRY'
  | 'LIMIT_TYPING'
  | 'LIMIT_CURSOR'
  | 'LIMIT_ROOM_CREATION'
  | 'LIMIT_RECONNECT'
  | 'AUDIT_ONLY'
  | 'FORCE_VISIBLE';

export type ChatConnectionRiskCode =
  | 'NONE'
  | 'ANON_WITH_PRIVATE_HINT'
  | 'INVALID_SESSION_HINT'
  | 'INVALID_ROOM_HINT'
  | 'INVALID_NAMESPACE'
  | 'TOKEN_REJECTED'
  | 'RESUME_REPLAY'
  | 'BANNED_FINGERPRINT'
  | 'BANNED_USER'
  | 'ABUSIVE_IP'
  | 'MALFORMED_METADATA'
  | 'LEGACY_ACTION_REJECTED'
  | 'SUSPICIOUS_TRAITS'
  | 'MOUNT_TARGET_MISMATCH'
  | 'PARTY_CONTEXT_MISMATCH'
  | 'RUN_CONTEXT_MISMATCH'
  | 'USER_AGENT_REJECTED'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export interface ChatConnectionVerifiedClaim {
  readonly claim: string;
  readonly value: string | number | boolean | null;
  readonly source: ChatConnectionCredentialKind;
  readonly confidence: number;
}

export interface ChatConnectionAuditRecord {
  readonly auditId: string;
  readonly decidedAt: number;
  readonly socketId: ChatSocketId;
  readonly namespace: string;
  readonly userId: ChatUserId;
  readonly username: string;
  readonly verdict: ChatConnectionVerdict;
  readonly authLevel: ChatTransportAuthLevel;
  readonly credentialKinds: readonly ChatConnectionCredentialKind[];
  readonly reasons: readonly string[];
  readonly risks: readonly ChatConnectionRiskCode[];
  readonly restrictions: readonly ChatConnectionRestrictionCode[];
  readonly fingerprint: string;
  readonly ipHash: string;
  readonly userAgentHash: string;
  readonly mountTarget: ChatMountTarget | null;
  readonly roomIdHint: ChatRoomId | null;
  readonly sessionIdHint: ChatSessionId | null;
  readonly modeId: string | null;
  readonly runId: string | null;
  readonly partyId: string | null;
  readonly metadataHash: string;
}

export interface ChatConnectionAuthContext {
  readonly auditId: string;
  readonly userId: ChatUserId;
  readonly username: string;
  readonly authLevel: ChatTransportAuthLevel;
  readonly verdict: ChatConnectionVerdict;
  readonly namespace: string;
  readonly mountTarget?: ChatMountTarget | null;
  readonly roomIdHint?: ChatRoomId | null;
  readonly sessionIdHint?: ChatSessionId | null;
  readonly resumeTokenId?: string | null;
  readonly modeId?: string | null;
  readonly runId?: string | null;
  readonly partyId?: string | null;
  readonly traits?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly restrictions?: readonly ChatConnectionRestrictionCode[];
  readonly risks?: readonly ChatConnectionRiskCode[];
  readonly reasons?: readonly string[];
  readonly credentialKinds?: readonly ChatConnectionCredentialKind[];
  readonly fingerprint?: string;
  readonly ipHash?: string;
  readonly userAgentHash?: string;
  readonly verifiedClaims?: readonly ChatConnectionVerifiedClaim[];
  readonly clientVersion?: string | null;
  readonly transportFeatures?: readonly string[];
  readonly allowAnonymousFallback?: boolean;
}

export interface ChatGatewayAuthPort {
  authenticate(socket: Socket): Promise<ChatConnectionAuthContext>;
}

// Compatibility alias so ChatGateway can migrate imports with minimal churn.
export type ChatGatewayAuthContext = ChatConnectionAuthContext;

// ============================================================================
// MARK: Handshake request models
// ============================================================================

export interface ChatConnectionHandshakeRequest {
  readonly socketId: ChatSocketId;
  readonly namespace: string;
  readonly remoteAddress: string | null;
  readonly userAgent: string | null;
  readonly referer: string | null;
  readonly origin: string | null;
  readonly auth: Readonly<Record<string, unknown>>;
  readonly query: Readonly<Record<string, unknown>>;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface ChatConnectionCredential {
  readonly kind: ChatConnectionCredentialKind;
  readonly raw: string;
  readonly presentedAs: string;
}

export interface ChatConnectionIdentityCandidate {
  readonly userId: ChatUserId;
  readonly username: string;
  readonly authLevel: ChatTransportAuthLevel;
  readonly traits: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly verifiedClaims: readonly ChatConnectionVerifiedClaim[];
  readonly credentialKinds: readonly ChatConnectionCredentialKind[];
}

export interface ChatConnectionResolvedHints {
  readonly roomIdHint: ChatRoomId | null;
  readonly sessionIdHint: ChatSessionId | null;
  readonly mountTarget: ChatMountTarget | null;
  readonly modeId: string | null;
  readonly runId: string | null;
  readonly partyId: string | null;
  readonly clientVersion: string | null;
  readonly transportFeatures: readonly string[];
  readonly traits: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatConnectionEvaluation {
  readonly auditId: string;
  readonly decidedAt: number;
  readonly request: ChatConnectionHandshakeRequest;
  readonly fingerprint: string;
  readonly ipHash: string;
  readonly userAgentHash: string;
  readonly identity: ChatConnectionIdentityCandidate;
  readonly hints: ChatConnectionResolvedHints;
  readonly verdict: ChatConnectionVerdict;
  readonly risks: readonly ChatConnectionRiskCode[];
  readonly reasons: readonly string[];
  readonly restrictions: readonly ChatConnectionRestrictionCode[];
  readonly allowAnonymousFallback: boolean;
}

// ============================================================================
// MARK: Ports
// ============================================================================

export interface ChatConnectionAuditPort {
  publish(record: ChatConnectionAuditRecord): Promise<void>;
}

export interface ChatConnectionBanPort {
  isFingerprintBanned(fingerprint: string): Promise<boolean>;
  isUserBanned(userId: ChatUserId): Promise<boolean>;
  isIpHashBanned(ipHash: string): Promise<boolean>;
}

export interface ChatConnectionReplayPort {
  hasSeenNonce(nonce: string): Promise<boolean>;
  rememberNonce(nonce: string, ttlMs: number): Promise<void>;
}

export interface ChatConnectionTokenVerificationResult {
  readonly ok: boolean;
  readonly kind: ChatConnectionCredentialKind;
  readonly userId?: ChatUserId;
  readonly username?: string;
  readonly authLevel?: ChatTransportAuthLevel;
  readonly traits?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly claims?: readonly ChatConnectionVerifiedClaim[];
  readonly restrictions?: readonly ChatConnectionRestrictionCode[];
  readonly reason?: string | null;
  readonly resumeTokenId?: string | null;
}

export interface ChatConnectionTokenVerifierPort {
  verify(
    credential: ChatConnectionCredential,
    request: ChatConnectionHandshakeRequest,
  ): Promise<ChatConnectionTokenVerificationResult | null>;
}

export interface ChatConnectionTrustPolicyPort {
  beforeDecision?(evaluation: ChatConnectionEvaluation): Promise<Partial<ChatConnectionEvaluation> | null>;
}

export interface ChatConnectionLogger {
  debug(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

// ============================================================================
// MARK: Config
// ============================================================================

export interface ChatConnectionAuthConfig {
  readonly allowAnonymous: boolean;
  readonly allowSessionHintsForAnonymous: boolean;
  readonly allowRoomHintsForAnonymous: boolean;
  readonly allowResumeTokens: boolean;
  readonly allowApiKeys: boolean;
  readonly allowSignedProofs: boolean;
  readonly anonymousUserPrefix: string;
  readonly trustedNamespacePrefixes: readonly string[];
  readonly trustedOriginPrefixes: readonly string[];
  readonly blockedUserAgentSubstrings: readonly string[];
  readonly blockedTraitPrefixes: readonly string[];
  readonly maxTraits: number;
  readonly maxMetadataKeys: number;
  readonly maxStringValueLength: number;
  readonly nonceTtlMs: number;
  readonly actionReplayTtlMs: number;
  readonly riskThresholdForQuarantine: number;
  readonly secretPepper: string;
  readonly nodeId: string;
  readonly enableLegacyActionAudit: boolean;
  readonly enforceNamespaceAllowlist: boolean;
  readonly requireUsernameForVerifiedUsers: boolean;
  readonly defaultMountTarget: ChatMountTarget | null;
  readonly restrictedMountTargetsForAnonymous: readonly ChatMountTarget[];
  readonly readOnlyMountTargetsForAnonymous: readonly ChatMountTarget[];
}

export const DEFAULT_CHAT_CONNECTION_AUTH_CONFIG: Readonly<ChatConnectionAuthConfig> = Object.freeze({
  allowAnonymous: false,
  allowSessionHintsForAnonymous: false,
  allowRoomHintsForAnonymous: false,
  allowResumeTokens: true,
  allowApiKeys: false,
  allowSignedProofs: true,
  anonymousUserPrefix: 'anon:',
  trustedNamespacePrefixes: ['/', '/chat', '/game', '/pzo'],
  trustedOriginPrefixes: ['http://localhost', 'https://localhost'],
  blockedUserAgentSubstrings: ['sqlmap', 'curl/', 'python-requests', 'masscan', 'nikto'],
  blockedTraitPrefixes: ['admin:', 'root:', 'godmode:', 'ops:'],
  maxTraits: 24,
  maxMetadataKeys: 48,
  maxStringValueLength: 512,
  nonceTtlMs: 60_000,
  actionReplayTtlMs: 90_000,
  riskThresholdForQuarantine: 5,
  secretPepper: 'pzo-chat-transport-pepper',
  nodeId: `chat-auth:${randomUUID()}`,
  enableLegacyActionAudit: true,
  enforceNamespaceAllowlist: true,
  requireUsernameForVerifiedUsers: true,
  defaultMountTarget: 'UNKNOWN',
  restrictedMountTargetsForAnonymous: ['DEAL_ROOM', 'SYNDICATE', 'BATTLE_HUD'],
  readOnlyMountTargetsForAnonymous: ['LOBBY', 'UNKNOWN'],
});

// ============================================================================
// MARK: Defaults
// ============================================================================

const NOOP_AUDIT: ChatConnectionAuditPort = {
  publish: async () => undefined,
};

const NOOP_BAN: ChatConnectionBanPort = {
  isFingerprintBanned: async () => false,
  isUserBanned: async () => false,
  isIpHashBanned: async () => false,
};

const IN_MEMORY_REPLAY: ChatConnectionReplayPort = new (class implements ChatConnectionReplayPort {
  private readonly seen = new Map<string, number>();

  public async hasSeenNonce(nonce: string): Promise<boolean> {
    this.sweep();
    return this.seen.has(nonce);
  }

  public async rememberNonce(nonce: string, ttlMs: number): Promise<void> {
    this.sweep();
    this.seen.set(nonce, nowMs() + ttlMs);
  }

  private sweep(): void {
    const now = nowMs();
    for (const [key, expiry] of this.seen.entries()) {
      if (expiry <= now) {
        this.seen.delete(key);
      }
    }
  }
})();

const NOOP_LOGGER: ChatConnectionLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

class CompositeTokenVerifier implements ChatConnectionTokenVerifierPort {
  private readonly verifiers: readonly ChatConnectionTokenVerifierPort[];

  public constructor(verifiers: readonly ChatConnectionTokenVerifierPort[]) {
    this.verifiers = verifiers;
  }

  public async verify(
    credential: ChatConnectionCredential,
    request: ChatConnectionHandshakeRequest,
  ): Promise<ChatConnectionTokenVerificationResult | null> {
    for (const verifier of this.verifiers) {
      const result = await verifier.verify(credential, request);
      if (result) {
        return result;
      }
    }
    return null;
  }
}

export class SignedProofVerifier implements ChatConnectionTokenVerifierPort {
  private readonly secret: string;

  public constructor(secret: string) {
    this.secret = secret;
  }

  public async verify(
    credential: ChatConnectionCredential,
    _request: ChatConnectionHandshakeRequest,
  ): Promise<ChatConnectionTokenVerificationResult | null> {
    if (credential.kind !== 'SIGNED_PROOF') {
      return null;
    }

    const [payload, signature] = credential.raw.split('.', 2);
    if (!payload || !signature) {
      return {
        ok: false,
        kind: 'SIGNED_PROOF',
        reason: 'Malformed signed proof',
      };
    }

    const expected = createHmac('sha256', this.secret).update(payload).digest('hex');
    if (!safeHexCompare(expected, signature)) {
      return {
        ok: false,
        kind: 'SIGNED_PROOF',
        reason: 'Signed proof mismatch',
      };
    }

    const decoded = decodeBase64Json(payload);
    if (!decoded || typeof decoded !== 'object') {
      return {
        ok: false,
        kind: 'SIGNED_PROOF',
        reason: 'Signed proof payload invalid',
      };
    }

    const userId = asNonEmptyString((decoded as Record<string, unknown>).userId);
    const username = asNonEmptyString((decoded as Record<string, unknown>).username) ?? userId;
    if (!userId || !username) {
      return {
        ok: false,
        kind: 'SIGNED_PROOF',
        reason: 'Signed proof missing identity',
      };
    }

    return {
      ok: true,
      kind: 'SIGNED_PROOF',
      userId: userId as ChatUserId,
      username,
      authLevel: 'SIGNED',
      traits: toStringArray((decoded as Record<string, unknown>).traits),
      metadata: asPlainRecord((decoded as Record<string, unknown>).metadata),
      claims: [
        { claim: 'proof.userId', value: userId, source: 'SIGNED_PROOF', confidence: 0.99 },
        { claim: 'proof.username', value: username, source: 'SIGNED_PROOF', confidence: 0.99 },
      ],
    };
  }
}

class LegacyAnonymousFallbackVerifier implements ChatConnectionTokenVerifierPort {
  private readonly anonymousUserPrefix: string;

  public constructor(anonymousUserPrefix: string) {
    this.anonymousUserPrefix = anonymousUserPrefix;
  }

  public async verify(
    credential: ChatConnectionCredential,
    request: ChatConnectionHandshakeRequest,
  ): Promise<ChatConnectionTokenVerificationResult | null> {
    if (credential.kind !== 'ANON') {
      return null;
    }

    const fallbackUserId = `${this.anonymousUserPrefix}${request.socketId}` as ChatUserId;
    return {
      ok: true,
      kind: 'ANON',
      userId: fallbackUserId,
      username: fallbackUserId,
      authLevel: 'ANON',
      claims: [
        { claim: 'anon.socketId', value: request.socketId, source: 'ANON', confidence: 1.0 },
      ],
    };
  }
}

// ============================================================================
// MARK: Helpers
// ============================================================================

function nowMs(): number {
  return Date.now();
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNullableString(value: unknown): string | null {
  const parsed = asNonEmptyString(value);
  return parsed ?? null;
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function hashString(label: string, value: string | null, secret: string): string {
  const basis = `${label}:${value ?? 'null'}`;
  return createHash('sha256').update(`${secret}:${basis}`).digest('hex');
}

function safeHexCompare(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    if (leftBuffer.length === 0 || rightBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function decodeBase64Json(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function stableMetadataHash(metadata: Readonly<Record<string, unknown>>, secret: string): string {
  const json = JSON.stringify(sortRecord(metadata));
  return createHash('sha256').update(`${secret}:${json}`).digest('hex');
}

function sortRecord(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const entries = Object.entries(input)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return [key, sortRecord(value as Record<string, unknown>)] as const;
      }
      if (Array.isArray(value)) {
        return [key, value.slice()] as const;
      }
      return [key, value] as const;
    });

  return Object.freeze(Object.fromEntries(entries));
}

function normalizeNamespace(namespace: string): string {
  const trimmed = namespace.trim();
  if (!trimmed) {
    return '/';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeRoomId(value: string | null): ChatRoomId | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed as ChatRoomId;
}

function normalizeSessionId(value: string | null): ChatSessionId | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed as ChatSessionId;
}

function normalizeMountTarget(value: string | null): ChatMountTarget | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!normalized) {
    return null;
  }
  return normalized as ChatMountTarget;
}

function clampArray<T>(input: readonly T[], max: number): readonly T[] {
  return Object.freeze(input.slice(0, Math.max(0, max)));
}

function sanitizeStringValue(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function sanitizeMetadata(
  metadata: Readonly<Record<string, unknown>>,
  config: ChatConnectionAuthConfig,
): Readonly<Record<string, unknown>> {
  const keys = Object.keys(metadata).sort().slice(0, config.maxMetadataKeys);
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const value = metadata[key];
    if (value == null) {
      output[key] = null;
      continue;
    }
    if (typeof value === 'string') {
      output[key] = sanitizeStringValue(value, config.maxStringValueLength);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      output[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      output[key] = value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => sanitizeStringValue(entry as string, config.maxStringValueLength))
        .slice(0, 32);
      continue;
    }
    if (typeof value === 'object') {
      output[key] = sortRecord(asPlainRecord(value));
      continue;
    }
  }
  return Object.freeze(output);
}

function deriveFingerprint(
  request: ChatConnectionHandshakeRequest,
  config: ChatConnectionAuthConfig,
): { fingerprint: string; ipHash: string; userAgentHash: string } {
  const ip = request.remoteAddress ?? 'unknown-ip';
  const ua = request.userAgent ?? 'unknown-ua';
  const namespace = request.namespace;
  const origin = request.origin ?? 'unknown-origin';

  const ipHash = hashString('ip', ip, config.secretPepper);
  const userAgentHash = hashString('ua', ua, config.secretPepper);
  const fingerprint = createHash('sha256')
    .update([config.secretPepper, ipHash, userAgentHash, namespace, origin].join('|'))
    .digest('hex');

  return { fingerprint, ipHash, userAgentHash };
}

function extractRemoteAddress(socket: Socket): string | null {
  const candidates = [
    socket.handshake.address,
    asNonEmptyString(socket.handshake.headers['x-forwarded-for']),
    asNonEmptyString(socket.handshake.headers['cf-connecting-ip']),
    asNonEmptyString(socket.handshake.headers['x-real-ip']),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const first = candidate.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return null;
}

function extractCredentialCandidates(
  request: ChatConnectionHandshakeRequest,
  config: ChatConnectionAuthConfig,
): readonly ChatConnectionCredential[] {
  const auth = request.auth;
  const headers = request.headers;
  const candidates: ChatConnectionCredential[] = [];

  const bearer =
    asNonEmptyString(auth.token) ??
    asNonEmptyString(auth.accessToken) ??
    asNonEmptyString(auth.bearerToken) ??
    parseBearerHeader(headers.authorization);

  if (bearer) {
    candidates.push({
      kind: 'BEARER',
      raw: bearer,
      presentedAs: 'bearer',
    });
  }

  const apiKey =
    config.allowApiKeys
      ? asNonEmptyString(auth.apiKey) ?? asNonEmptyString(headers['x-api-key'])
      : null;
  if (apiKey) {
    candidates.push({
      kind: 'API_KEY',
      raw: apiKey,
      presentedAs: 'apiKey',
    });
  }

  const resumeToken =
    config.allowResumeTokens
      ? asNonEmptyString(auth.resumeToken) ?? asNonEmptyString(auth.resume)
      : null;
  if (resumeToken) {
    candidates.push({
      kind: 'RESUME_TOKEN',
      raw: resumeToken,
      presentedAs: 'resumeToken',
    });
  }

  const signedProof =
    config.allowSignedProofs
      ? asNonEmptyString(auth.signedProof) ?? asNonEmptyString(auth.proof)
      : null;
  if (signedProof) {
    candidates.push({
      kind: 'SIGNED_PROOF',
      raw: signedProof,
      presentedAs: 'signedProof',
    });
  }

  const sessionHint = asNonEmptyString(auth.sessionId);
  if (sessionHint) {
    candidates.push({
      kind: 'SESSION_HINT',
      raw: sessionHint,
      presentedAs: 'sessionIdHint',
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      kind: 'ANON',
      raw: `anon:${request.socketId}`,
      presentedAs: 'fallback',
    });
  }

  return Object.freeze(candidates);
}

function parseBearerHeader(header: string | string[] | undefined): string | null {
  if (Array.isArray(header)) {
    for (const item of header) {
      const parsed = parseBearerHeader(item);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }

  if (typeof header !== 'string') {
    return null;
  }

  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return trimmed.slice('bearer '.length).trim() || null;
}

function resolveHints(
  request: ChatConnectionHandshakeRequest,
  config: ChatConnectionAuthConfig,
): ChatConnectionResolvedHints {
  const auth = request.auth;
  const query = request.query;

  const roomIdHint = normalizeRoomId(asNonEmptyString(auth.roomId) ?? asNonEmptyString(query.roomId));
  const sessionIdHint = normalizeSessionId(asNonEmptyString(auth.sessionId) ?? asNonEmptyString(query.sessionId));
  const mountTarget =
    normalizeMountTarget(asNonEmptyString(auth.mountTarget) ?? asNonEmptyString(query.mountTarget)) ??
    config.defaultMountTarget;
  const modeId = asNullableString(auth.modeId) ?? asNullableString(query.modeId);
  const runId = asNullableString(auth.runId) ?? asNullableString(query.runId);
  const partyId = asNullableString(auth.partyId) ?? asNullableString(query.partyId);
  const clientVersion = asNullableString(auth.clientVersion) ?? asNullableString(query.clientVersion);

  const transportFeatures = clampArray(
    dedupeStrings([
      ...toStringArray(auth.transportFeatures),
      ...toStringArray(query.transportFeatures),
    ]),
    64,
  );

  const traits = clampArray(
    dedupeStrings([
      ...toStringArray(auth.traits),
      ...toStringArray(query.traits),
    ]),
    config.maxTraits,
  );

  const metadata = sanitizeMetadata(
    {
      ...asPlainRecord(query.metadata),
      ...asPlainRecord(auth.metadata),
    },
    config,
  );

  return {
    roomIdHint,
    sessionIdHint,
    mountTarget,
    modeId,
    runId,
    partyId,
    clientVersion,
    transportFeatures,
    traits,
    metadata,
  };
}

function dedupeStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function riskWeight(risk: ChatConnectionRiskCode): number {
  switch (risk) {
    case 'NONE':
      return 0;
    case 'INVALID_SESSION_HINT':
    case 'INVALID_ROOM_HINT':
    case 'MALFORMED_METADATA':
    case 'LEGACY_ACTION_REJECTED':
      return 1;
    case 'ANON_WITH_PRIVATE_HINT':
    case 'MOUNT_TARGET_MISMATCH':
    case 'PARTY_CONTEXT_MISMATCH':
    case 'RUN_CONTEXT_MISMATCH':
    case 'USER_AGENT_REJECTED':
      return 2;
    case 'TOKEN_REJECTED':
    case 'RESUME_REPLAY':
    case 'ABUSIVE_IP':
    case 'RATE_LIMITED':
      return 3;
    case 'BANNED_FINGERPRINT':
    case 'BANNED_USER':
      return 5;
    default:
      return 1;
  }
}

function buildAuditRecord(
  evaluation: ChatConnectionEvaluation,
  authLevel: ChatTransportAuthLevel,
): ChatConnectionAuditRecord {
  return {
    auditId: evaluation.auditId,
    decidedAt: evaluation.decidedAt,
    socketId: evaluation.request.socketId,
    namespace: evaluation.request.namespace,
    userId: evaluation.identity.userId,
    username: evaluation.identity.username,
    verdict: evaluation.verdict,
    authLevel,
    credentialKinds: evaluation.identity.credentialKinds,
    reasons: evaluation.reasons,
    risks: evaluation.risks,
    restrictions: evaluation.restrictions,
    fingerprint: evaluation.fingerprint,
    ipHash: evaluation.ipHash,
    userAgentHash: evaluation.userAgentHash,
    mountTarget: evaluation.hints.mountTarget,
    roomIdHint: evaluation.hints.roomIdHint,
    sessionIdHint: evaluation.hints.sessionIdHint,
    modeId: evaluation.hints.modeId,
    runId: evaluation.hints.runId,
    partyId: evaluation.hints.partyId,
    metadataHash: stableMetadataHash(evaluation.hints.metadata, evaluation.auditId),
  };
}

// ============================================================================
// MARK: Main implementation
// ============================================================================

export interface ChatConnectionAuthOptions {
  readonly config?: Partial<ChatConnectionAuthConfig>;
  readonly tokenVerifier?: ChatConnectionTokenVerifierPort;
  readonly tokenVerifiers?: readonly ChatConnectionTokenVerifierPort[];
  readonly audit?: ChatConnectionAuditPort;
  readonly bans?: ChatConnectionBanPort;
  readonly replay?: ChatConnectionReplayPort;
  readonly logger?: ChatConnectionLogger;
  readonly trustPolicy?: ChatConnectionTrustPolicyPort | null;
}

export class ChatConnectionAuth implements ChatGatewayAuthPort {
  private readonly config: ChatConnectionAuthConfig;
  private readonly tokenVerifier: ChatConnectionTokenVerifierPort;
  private readonly audit: ChatConnectionAuditPort;
  private readonly bans: ChatConnectionBanPort;
  private readonly replay: ChatConnectionReplayPort;
  private readonly logger: ChatConnectionLogger;
  private readonly trustPolicy: ChatConnectionTrustPolicyPort | null;
  private readonly legacyValidator: ActionValidator;

  public constructor(options?: ChatConnectionAuthOptions) {
    this.config = {
      ...DEFAULT_CHAT_CONNECTION_AUTH_CONFIG,
      ...(options?.config ?? {}),
    };

    const verifiers: ChatConnectionTokenVerifierPort[] = [];

    if (options?.tokenVerifier) {
      verifiers.push(options.tokenVerifier);
    }

    if (options?.tokenVerifiers?.length) {
      verifiers.push(...options.tokenVerifiers);
    }

    verifiers.push(new SignedProofVerifier(this.config.secretPepper));
    verifiers.push(new LegacyAnonymousFallbackVerifier(this.config.anonymousUserPrefix));

    this.tokenVerifier = new CompositeTokenVerifier(verifiers);
    this.audit = options?.audit ?? NOOP_AUDIT;
    this.bans = options?.bans ?? NOOP_BAN;
    this.replay = options?.replay ?? IN_MEMORY_REPLAY;
    this.logger = options?.logger ?? NOOP_LOGGER;
    this.trustPolicy = options?.trustPolicy ?? null;
    this.legacyValidator = new ActionValidator(false, '');
  }

  public async authenticate(socket: Socket): Promise<ChatConnectionAuthContext> {
    const request = this.buildRequest(socket);
    const evaluation = await this.evaluateRequest(request);

    const finalEvaluation = await this.applyTrustPolicy(evaluation);
    const finalAuthLevel = this.resolveFinalAuthLevel(finalEvaluation);

    await this.audit.publish(buildAuditRecord(finalEvaluation, finalAuthLevel));

    if (finalEvaluation.verdict === 'DENY') {
      this.logger.warn('Chat connection denied', {
        auditId: finalEvaluation.auditId,
        socketId: request.socketId,
        userId: finalEvaluation.identity.userId,
        risks: finalEvaluation.risks,
        reasons: finalEvaluation.reasons,
      });
      throw new Error(finalEvaluation.reasons[0] ?? 'Chat connection denied');
    }

    if (finalEvaluation.verdict === 'QUARANTINE') {
      this.logger.warn('Chat connection quarantined', {
        auditId: finalEvaluation.auditId,
        socketId: request.socketId,
        userId: finalEvaluation.identity.userId,
      });
    }

    const context: ChatConnectionAuthContext = {
      auditId: finalEvaluation.auditId,
      userId: finalEvaluation.identity.userId,
      username: finalEvaluation.identity.username,
      authLevel: finalAuthLevel,
      verdict: finalEvaluation.verdict,
      namespace: request.namespace,
      mountTarget: finalEvaluation.hints.mountTarget,
      roomIdHint: finalEvaluation.hints.roomIdHint,
      sessionIdHint: finalEvaluation.hints.sessionIdHint,
      modeId: finalEvaluation.hints.modeId,
      runId: finalEvaluation.hints.runId,
      partyId: finalEvaluation.hints.partyId,
      traits: dedupeStrings([
        ...finalEvaluation.identity.traits,
        ...finalEvaluation.hints.traits,
      ]),
      metadata: Object.freeze({
        ...finalEvaluation.identity.metadata,
        ...finalEvaluation.hints.metadata,
      }),
      restrictions: finalEvaluation.restrictions,
      risks: finalEvaluation.risks,
      reasons: finalEvaluation.reasons,
      credentialKinds: finalEvaluation.identity.credentialKinds,
      fingerprint: finalEvaluation.fingerprint,
      ipHash: finalEvaluation.ipHash,
      userAgentHash: finalEvaluation.userAgentHash,
      verifiedClaims: finalEvaluation.identity.verifiedClaims,
      clientVersion: finalEvaluation.hints.clientVersion,
      transportFeatures: finalEvaluation.hints.transportFeatures,
      allowAnonymousFallback: finalEvaluation.allowAnonymousFallback,
    };

    this.logger.info('Chat connection admitted', {
      auditId: context.auditId,
      userId: context.userId,
      authLevel: context.authLevel,
      verdict: context.verdict,
      restrictions: context.restrictions,
    });

    return Object.freeze(context);
  }

  private buildRequest(socket: Socket): ChatConnectionHandshakeRequest {
    return Object.freeze({
      socketId: socket.id as ChatSocketId,
      namespace: normalizeNamespace(socket.nsp?.name ?? '/'),
      remoteAddress: extractRemoteAddress(socket),
      userAgent: asNonEmptyString(socket.handshake.headers['user-agent']),
      referer: asNonEmptyString(socket.handshake.headers.referer),
      origin: asNonEmptyString(socket.handshake.headers.origin),
      auth: Object.freeze(asPlainRecord(socket.handshake.auth)),
      query: Object.freeze(asPlainRecord(socket.handshake.query)),
      headers: Object.freeze({ ...(socket.handshake.headers ?? {}) }),
    });
  }

  private async evaluateRequest(
    request: ChatConnectionHandshakeRequest,
  ): Promise<ChatConnectionEvaluation> {
    const auditId = `chat-auth:${randomUUID()}`;
    const decidedAt = nowMs();
    const { fingerprint, ipHash, userAgentHash } = deriveFingerprint(request, this.config);
    const hints = resolveHints(request, this.config);

    const reasons: string[] = [];
    const risks = new Set<ChatConnectionRiskCode>();
    const restrictions = new Set<ChatConnectionRestrictionCode>();

    if (this.config.enforceNamespaceAllowlist) {
      const matched = this.config.trustedNamespacePrefixes.some((prefix) =>
        request.namespace.startsWith(normalizeNamespace(prefix)),
      );
      if (!matched) {
        risks.add('INVALID_NAMESPACE');
        reasons.push(`Namespace ${request.namespace} is not in the trusted allowlist`);
      }
    }

    const ua = (request.userAgent ?? '').toLowerCase();
    for (const blocked of this.config.blockedUserAgentSubstrings) {
      if (ua.includes(blocked.toLowerCase())) {
        risks.add('USER_AGENT_REJECTED');
        reasons.push(`Blocked user agent signature matched ${blocked}`);
        break;
      }
    }

    const credentials = extractCredentialCandidates(request, this.config);
    const identity = await this.resolveIdentity(request, credentials, hints, reasons, risks, restrictions);

    await this.enforceBanChecks(identity.userId, fingerprint, ipHash, reasons, risks);
    await this.enforceReplayChecks(request, credentials, reasons, risks);

    this.evaluateHints(identity, hints, reasons, risks, restrictions);
    this.auditLegacyActionIfPresented(request, reasons, risks);

    const totalRisk = Array.from(risks).reduce((sum, risk) => sum + riskWeight(risk), 0);

    let verdict: ChatConnectionVerdict = 'ALLOW';
    if (risks.has('BANNED_FINGERPRINT') || risks.has('BANNED_USER')) {
      verdict = 'DENY';
    } else if (totalRisk >= this.config.riskThresholdForQuarantine) {
      verdict = 'QUARANTINE';
    } else if (restrictions.size > 0 || risks.size > 0) {
      verdict = 'ALLOW_WITH_RESTRICTIONS';
    }

    return Object.freeze({
      auditId,
      decidedAt,
      request,
      fingerprint,
      ipHash,
      userAgentHash,
      identity,
      hints,
      verdict,
      risks: Object.freeze(Array.from(risks)),
      reasons: Object.freeze(reasons.length ? reasons : ['Connection admitted']),
      restrictions: Object.freeze(Array.from(restrictions)),
      allowAnonymousFallback: identity.authLevel === 'ANON' && this.config.allowAnonymous,
    });
  }

  private async resolveIdentity(
    request: ChatConnectionHandshakeRequest,
    credentials: readonly ChatConnectionCredential[],
    hints: ChatConnectionResolvedHints,
    reasons: string[],
    risks: Set<ChatConnectionRiskCode>,
    restrictions: Set<ChatConnectionRestrictionCode>,
  ): Promise<ChatConnectionIdentityCandidate> {
    let chosen: ChatConnectionTokenVerificationResult | null = null;
    for (const credential of credentials) {
      const result = await this.tokenVerifier.verify(credential, request);
      if (!result) {
        continue;
      }
      if (result.ok) {
        chosen = result;
        break;
      }
      reasons.push(result.reason ?? `${credential.kind} rejected`);
      risks.add('TOKEN_REJECTED');
    }

    if (!chosen || !chosen.ok || !chosen.userId) {
      if (!this.config.allowAnonymous) {
        reasons.push('Anonymous transport connections are disabled');
        return Object.freeze({
          userId: `${this.config.anonymousUserPrefix}${request.socketId}` as ChatUserId,
          username: `${this.config.anonymousUserPrefix}${request.socketId}`,
          authLevel: 'ANON',
          traits: [],
          metadata: {},
          verifiedClaims: [],
          credentialKinds: Object.freeze(credentials.map((item) => item.kind)),
        });
      }

      const fallbackUserId = `${this.config.anonymousUserPrefix}${request.socketId}` as ChatUserId;
      return Object.freeze({
        userId: fallbackUserId,
        username: fallbackUserId,
        authLevel: 'ANON',
        traits: clampArray(hints.traits, this.config.maxTraits),
        metadata: hints.metadata,
        verifiedClaims: [],
        credentialKinds: Object.freeze(credentials.map((item) => item.kind)),
      });
    }

    const username =
      sanitizeStringValue(
        chosen.username ?? (this.config.requireUsernameForVerifiedUsers ? chosen.userId : chosen.userId),
        this.config.maxStringValueLength,
      ) || chosen.userId;

    const traits = clampArray(
      dedupeStrings([
        ...sanitizeTraits(hints.traits, this.config, risks, reasons),
        ...sanitizeTraits(chosen.traits ?? [], this.config, risks, reasons),
      ]),
      this.config.maxTraits,
    );

    if (chosen.authLevel === 'ANON' && hints.roomIdHint && !this.config.allowRoomHintsForAnonymous) {
      risks.add('ANON_WITH_PRIVATE_HINT');
      restrictions.add('NO_PRIVATE_ENTRY');
      reasons.push('Anonymous connection presented a room hint while anonymous room hints are disabled');
    }

    return Object.freeze({
      userId: chosen.userId,
      username,
      authLevel: chosen.authLevel ?? 'AUTHENTICATED',
      traits,
      metadata: sanitizeMetadata({ ...(chosen.metadata ?? {}), ...hints.metadata }, this.config),
      verifiedClaims: Object.freeze(chosen.claims ?? []),
      credentialKinds: Object.freeze(
        dedupeStrings([
          ...(chosen.kind ? [chosen.kind] : []),
          ...credentials.map((item) => item.kind),
        ]) as ChatConnectionCredentialKind[],
      ),
    });
  }

  private async enforceBanChecks(
    userId: ChatUserId,
    fingerprint: string,
    ipHash: string,
    reasons: string[],
    risks: Set<ChatConnectionRiskCode>,
  ): Promise<void> {
    if (await this.bans.isFingerprintBanned(fingerprint)) {
      risks.add('BANNED_FINGERPRINT');
      reasons.push('Fingerprint banned');
    }

    if (await this.bans.isUserBanned(userId)) {
      risks.add('BANNED_USER');
      reasons.push(`User ${userId} banned`);
    }

    if (await this.bans.isIpHashBanned(ipHash)) {
      risks.add('ABUSIVE_IP');
      reasons.push('Source IP has transport restrictions');
    }
  }

  private async enforceReplayChecks(
    request: ChatConnectionHandshakeRequest,
    credentials: readonly ChatConnectionCredential[],
    reasons: string[],
    risks: Set<ChatConnectionRiskCode>,
  ): Promise<void> {
    const nonce =
      asNonEmptyString(request.auth.nonce) ??
      asNonEmptyString(request.query.nonce) ??
      credentials.find((item) => item.kind === 'RESUME_TOKEN')?.raw ??
      null;

    if (!nonce) {
      return;
    }

    if (await this.replay.hasSeenNonce(nonce)) {
      risks.add('RESUME_REPLAY');
      reasons.push('Replay nonce already observed');
      return;
    }

    await this.replay.rememberNonce(nonce, this.config.nonceTtlMs);
  }

  private evaluateHints(
    identity: ChatConnectionIdentityCandidate,
    hints: ChatConnectionResolvedHints,
    reasons: string[],
    risks: Set<ChatConnectionRiskCode>,
    restrictions: Set<ChatConnectionRestrictionCode>,
  ): void {
    if (hints.sessionIdHint && identity.authLevel === 'ANON' && !this.config.allowSessionHintsForAnonymous) {
      risks.add('INVALID_SESSION_HINT');
      reasons.push('Anonymous session reattachment is disabled');
      restrictions.add('LIMIT_RECONNECT');
    }

    if (hints.roomIdHint && identity.authLevel === 'ANON' && !this.config.allowRoomHintsForAnonymous) {
      risks.add('ANON_WITH_PRIVATE_HINT');
      reasons.push('Anonymous room rejoin hint rejected');
      restrictions.add('NO_PRIVATE_ENTRY');
    }

    if (
      hints.mountTarget &&
      identity.authLevel === 'ANON' &&
      this.config.restrictedMountTargetsForAnonymous.includes(hints.mountTarget)
    ) {
      risks.add('MOUNT_TARGET_MISMATCH');
      restrictions.add('NO_PRIVATE_ENTRY');
      restrictions.add('NO_DEALROOM_ENTRY');
      reasons.push(`Anonymous connection cannot mount ${hints.mountTarget}`);
    }

    if (
      hints.mountTarget &&
      identity.authLevel === 'ANON' &&
      this.config.readOnlyMountTargetsForAnonymous.includes(hints.mountTarget)
    ) {
      restrictions.add('READ_ONLY');
      restrictions.add('FORCE_VISIBLE');
      reasons.push(`Anonymous connection admitted in read-only mode for ${hints.mountTarget}`);
    }

    if (hints.metadata && Object.keys(hints.metadata).length >= this.config.maxMetadataKeys) {
      risks.add('MALFORMED_METADATA');
      reasons.push('Metadata truncated at maximum configured key count');
    }
  }

  private auditLegacyActionIfPresented(
    request: ChatConnectionHandshakeRequest,
    reasons: string[],
    risks: Set<ChatConnectionRiskCode>,
  ): void {
    if (!this.config.enableLegacyActionAudit) {
      return;
    }

    const action = asPlainRecord(request.auth.action);
    const type = asNonEmptyString(action.type);
    if (!type) {
      return;
    }

    const validation = this.legacyValidator.validate({
      type,
      card: typeof action.card === 'number' ? action.card : undefined,
      targetSymbol: asNullableString(action.targetSymbol) ?? undefined,
    });

    if (!validation.valid) {
      risks.add('LEGACY_ACTION_REJECTED');
      reasons.push(validation.reason ?? 'Legacy action validator rejected handshake action');
    }
  }

  private async applyTrustPolicy(
    evaluation: ChatConnectionEvaluation,
  ): Promise<ChatConnectionEvaluation> {
    if (!this.trustPolicy?.beforeDecision) {
      return evaluation;
    }

    const patch = await this.trustPolicy.beforeDecision(evaluation);
    if (!patch) {
      return evaluation;
    }

    return Object.freeze({
      ...evaluation,
      ...patch,
      reasons: Object.freeze([
        ...evaluation.reasons,
        ...((patch.reasons as readonly string[] | undefined) ?? []),
      ]),
      risks: Object.freeze(
        dedupeStrings([
          ...evaluation.risks,
          ...((patch.risks as readonly string[] | undefined) ?? []),
        ]) as ChatConnectionRiskCode[],
      ),
      restrictions: Object.freeze(
        dedupeStrings([
          ...evaluation.restrictions,
          ...((patch.restrictions as readonly string[] | undefined) ?? []),
        ]) as ChatConnectionRestrictionCode[],
      ),
    });
  }

  private resolveFinalAuthLevel(
    evaluation: ChatConnectionEvaluation,
  ): ChatTransportAuthLevel {
    if (evaluation.verdict === 'QUARANTINE') {
      return 'SUSPICIOUS';
    }

    if (evaluation.verdict === 'ALLOW_WITH_RESTRICTIONS' && evaluation.identity.authLevel === 'SIGNED') {
      return 'SIGNED';
    }

    if (evaluation.identity.authLevel === 'ANON' && !evaluation.allowAnonymousFallback) {
      return 'ANON';
    }

    return evaluation.identity.authLevel;
  }
}

// ============================================================================
// MARK: Additional helpers
// ============================================================================

function sanitizeTraits(
  traits: readonly string[],
  config: ChatConnectionAuthConfig,
  risks: Set<ChatConnectionRiskCode>,
  reasons: string[],
): string[] {
  const output: string[] = [];
  for (const trait of traits) {
    const normalized = trait.trim().slice(0, config.maxStringValueLength);
    if (!normalized) {
      continue;
    }

    if (config.blockedTraitPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      risks.add('SUSPICIOUS_TRAITS');
      reasons.push(`Blocked trait prefix encountered: ${normalized}`);
      continue;
    }

    output.push(normalized);
  }
  return output;
}

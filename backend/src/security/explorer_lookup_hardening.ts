// backend/src/security/explorer_lookup_hardening.ts

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { DeviceTrustTier } from './device.entity';

export type ExplorerLookupKind =
  | 'run'
  | 'proof'
  | 'user'
  | 'season'
  | 'leaderboard'
  | 'badge'
  | 'legend';

export interface ExplorerLookupRequest {
  readonly kind: ExplorerLookupKind;
  readonly rawKey: string;
  readonly page?: number;
  readonly limit?: number;
  readonly seasonId?: string | null;
  readonly search?: string | null;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly deviceId?: string | null;
  readonly trustTier?: DeviceTrustTier | null;
  readonly nonce?: string | null;
  readonly nowMs?: number;
  readonly receiptTtlMs?: number | null;
}

export interface ExplorerRiskFlags {
  readonly controlChars: boolean;
  readonly traversal: boolean;
  readonly sqlMeta: boolean;
  readonly homoglyphRisk: boolean;
  readonly overlong: boolean;
  readonly malformedPage: boolean;
  readonly malformedLimit: boolean;
  readonly emptyKey: boolean;
  readonly illegalCharset: boolean;
  readonly suspiciousEncoding: boolean;
  readonly numericOnly: boolean;
  readonly repeatedSeparators: boolean;
}

export interface ExplorerLookupNormalization {
  readonly version: 2;
  readonly kind: ExplorerLookupKind;
  readonly normalizedKey: string;
  readonly page: number;
  readonly limit: number;
  readonly seasonId: string | null;
  readonly search: string | null;
  readonly fingerprint: string;
  readonly lookupHash: string;
  readonly trustTier: DeviceTrustTier;
  readonly riskScore: number;
  readonly riskFlags: ExplorerRiskFlags;
  readonly canonicalRequestHash: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number | null;
  readonly nonce: string | null;
}

export interface ExplorerLookupReceipt {
  readonly normalization: ExplorerLookupNormalization;
  readonly signature: string;
}

export interface ExplorerLookupVerification {
  readonly valid: boolean;
  readonly reason:
    | null
    | 'INVALID_SIGNATURE'
    | 'INVALID_NORMALIZED_KEY'
    | 'EXPIRED_RECEIPT'
    | 'INVALID_FINGERPRINT';
}

export interface ExplorerEnumerationSurface {
  readonly status: 404 | 410;
  readonly publicCode: 'EXPLORER_NOT_FOUND' | 'EXPLORER_GONE';
  readonly opaqueRequestId: string;
  readonly retryAfterSeconds: number;
  readonly body: {
    readonly message: string;
    readonly safeHints: readonly string[];
  };
}

export interface ExplorerRateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
  readonly remaining: number;
  readonly resetAtMs: number;
}

export class ExplorerLookupSecurityError extends Error {
  public readonly code:
    | 'EMPTY_KEY'
    | 'ILLEGAL_CHARSET'
    | 'RISK_THRESHOLD_EXCEEDED'
    | 'INVALID_SIGNATURE';

  public constructor(
    code:
      | 'EMPTY_KEY'
      | 'ILLEGAL_CHARSET'
      | 'RISK_THRESHOLD_EXCEEDED'
      | 'INVALID_SIGNATURE',
    message: string,
  ) {
    super(message);
    this.name = 'ExplorerLookupSecurityError';
    this.code = code;
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_KEY_LENGTH = 128;
const MAX_SEARCH_LENGTH = 128;
const DEFAULT_RECEIPT_TTL_MS = 5 * 60 * 1000;
const MAX_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;

const HOMOGLYPH_CHARS =
  /[\u00A0\u2000-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/u;
const TRAVERSAL_PATTERN = /(?:\.\.\/|\/\.\.|\\\.\.|%2e%2e|%2f|%5c)/iu;
const SQL_META_PATTERN =
  /(?:--|;|\/\*|\*\/|\bunion\b|\bselect\b|\bdrop\b|\binsert\b|\bupdate\b|\bdelete\b)/iu;
const SUSPICIOUS_ENCODING_PATTERN = /%(?:2f|5c|00|0a|0d|2e)/iu;
const REPEATED_SEPARATORS_PATTERN = /[-_:]{3,}/u;

const KIND_PATTERNS: Record<ExplorerLookupKind, RegExp> = {
  run: /^[a-z0-9][a-z0-9:_-]{2,127}$/u,
  proof: /^[a-z0-9][a-z0-9:_-]{2,127}$/u,
  user: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
  season: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
  leaderboard: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
  badge: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
  legend: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
};

const DEFAULT_SAFE_HINTS = Object.freeze([
  'Verify receipt hash.',
  'Retry with authorized scope.',
]);

const TRUST_TIER_RISK_ADJUSTMENT: Record<DeviceTrustTier, number> = {
  [DeviceTrustTier.UNKNOWN]: 0,
  [DeviceTrustTier.UNVERIFIED]: 8,
  [DeviceTrustTier.TRUSTED]: -5,
  [DeviceTrustTier.VERIFIED]: -10,
  [DeviceTrustTier.HARDENED]: -15,
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hmacSha256(secret: string, input: string): string {
  return createHmac('sha256', secret).update(input).digest('hex');
}

function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/gu, ' ');
}

function normalizeTrustTier(
  trustTier: DeviceTrustTier | string | null | undefined,
): DeviceTrustTier {
  switch (trustTier) {
    case DeviceTrustTier.UNKNOWN:
    case DeviceTrustTier.UNVERIFIED:
    case DeviceTrustTier.TRUSTED:
    case DeviceTrustTier.VERIFIED:
    case DeviceTrustTier.HARDENED:
      return trustTier;
    default:
      return DeviceTrustTier.UNKNOWN;
  }
}

function normalizeLookupToken(input: string): string {
  return normalizeWhitespace(input)
    .normalize('NFKC')
    .toLowerCase()
    .replace(CONTROL_CHARS, '')
    .replace(/%[0-9a-f]{2}/giu, '')
    .replace(/[|]/gu, ':')
    .replace(/[ ]/gu, '-')
    .replace(/[^a-z0-9:_-]/gu, '')
    .replace(/^[-_:]+|[-_:]+$/gu, '')
    .replace(/[-_:]{2,}/gu, (segment) => segment[0] ?? '-')
    .slice(0, MAX_KEY_LENGTH);
}

function normalizeSearch(input: string | null | undefined): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const normalized = normalizeWhitespace(input)
    .normalize('NFKC')
    .replace(CONTROL_CHARS, '')
    .slice(0, MAX_SEARCH_LENGTH);

  return normalized.length > 0 ? normalized : null;
}

function normalizeBoundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): { value: number; malformed: boolean } {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return { value: fallback, malformed: true };
  }

  const normalized = Math.floor(parsed);

  if (normalized < min || normalized > max) {
    return {
      value: Math.min(Math.max(normalized, min), max),
      malformed: true,
    };
  }

  return { value: normalized, malformed: false };
}

function normalizeReceiptTtlMs(ttlMs: unknown): number | null {
  if (ttlMs === null) {
    return null;
  }

  if (ttlMs === undefined) {
    return DEFAULT_RECEIPT_TTL_MS;
  }

  const normalized =
    typeof ttlMs === 'number'
      ? Math.floor(ttlMs)
      : typeof ttlMs === 'string' && ttlMs.trim() !== ''
        ? Number.parseInt(ttlMs, 10)
        : Number.NaN;

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return DEFAULT_RECEIPT_TTL_MS;
  }

  return Math.min(normalized, MAX_RECEIPT_TTL_MS);
}

function buildFingerprint(input: ExplorerLookupRequest): string {
  return sha256(
    stableStringify({
      clientIp: input.clientIp ?? '',
      userAgent: input.userAgent ?? '',
      deviceId: input.deviceId ?? '',
      trustTier: normalizeTrustTier(input.trustTier),
    }),
  );
}

function buildRiskFlags(
  request: ExplorerLookupRequest,
  normalizedKey: string,
  pageMalformed: boolean,
  limitMalformed: boolean,
): ExplorerRiskFlags {
  const rawKey = request.rawKey ?? '';

  return {
    controlChars: CONTROL_CHARS.test(rawKey),
    traversal: TRAVERSAL_PATTERN.test(rawKey),
    sqlMeta: SQL_META_PATTERN.test(rawKey),
    homoglyphRisk: HOMOGLYPH_CHARS.test(rawKey),
    overlong: rawKey.length > MAX_KEY_LENGTH,
    malformedPage: pageMalformed,
    malformedLimit: limitMalformed,
    emptyKey: normalizedKey.length === 0,
    illegalCharset: !KIND_PATTERNS[request.kind].test(normalizedKey),
    suspiciousEncoding: SUSPICIOUS_ENCODING_PATTERN.test(rawKey),
    numericOnly: /^\d+$/u.test(normalizedKey),
    repeatedSeparators: REPEATED_SEPARATORS_PATTERN.test(rawKey),
  };
}

function scoreRisk(
  flags: ExplorerRiskFlags,
  trustTier: DeviceTrustTier,
): number {
  let score = 0;

  if (flags.controlChars) score += 50;
  if (flags.traversal) score += 45;
  if (flags.sqlMeta) score += 40;
  if (flags.homoglyphRisk) score += 20;
  if (flags.overlong) score += 15;
  if (flags.malformedPage) score += 5;
  if (flags.malformedLimit) score += 5;
  if (flags.emptyKey) score += 60;
  if (flags.illegalCharset) score += 60;
  if (flags.suspiciousEncoding) score += 25;
  if (flags.numericOnly) score += 10;
  if (flags.repeatedSeparators) score += 8;

  score += TRUST_TIER_RISK_ADJUSTMENT[trustTier] ?? 0;

  return Math.max(score, 0);
}

function compareHex(lhs: string, rhs: string): boolean {
  if (!/^[a-f0-9]+$/iu.test(lhs) || !/^[a-f0-9]+$/iu.test(rhs)) {
    return false;
  }

  const left = Buffer.from(lhs, 'hex');
  const right = Buffer.from(rhs, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function hardenExplorerLookup(
  request: ExplorerLookupRequest,
  secret: string,
): ExplorerLookupReceipt {
  const { value: page, malformed: malformedPage } = normalizeBoundedInt(
    request.page,
    DEFAULT_PAGE,
    1,
    10_000,
  );

  const { value: limit, malformed: malformedLimit } = normalizeBoundedInt(
    request.limit,
    DEFAULT_LIMIT,
    1,
    MAX_LIMIT,
  );

  const trustTier = normalizeTrustTier(request.trustTier);
  const normalizedKey = normalizeLookupToken(request.rawKey);
  const riskFlags = buildRiskFlags(
    request,
    normalizedKey,
    malformedPage,
    malformedLimit,
  );
  const riskScore = scoreRisk(riskFlags, trustTier);

  if (riskFlags.emptyKey) {
    throw new ExplorerLookupSecurityError(
      'EMPTY_KEY',
      'Explorer lookup key is empty.',
    );
  }

  if (riskFlags.illegalCharset) {
    throw new ExplorerLookupSecurityError(
      'ILLEGAL_CHARSET',
      'Explorer lookup key contains illegal characters.',
    );
  }

  if (riskScore >= 60) {
    throw new ExplorerLookupSecurityError(
      'RISK_THRESHOLD_EXCEEDED',
      'Explorer lookup request exceeded the permitted risk threshold.',
    );
  }

  const issuedAtMs = request.nowMs ?? Date.now();
  const receiptTtlMs = normalizeReceiptTtlMs(request.receiptTtlMs);
  const seasonId =
    typeof request.seasonId === 'string' && request.seasonId.trim() !== ''
      ? normalizeLookupToken(request.seasonId)
      : null;
  const search = normalizeSearch(request.search);
  const nonce =
    typeof request.nonce === 'string' && request.nonce.trim() !== ''
      ? normalizeWhitespace(request.nonce).slice(0, 64)
      : null;
  const fingerprint = buildFingerprint(request);

  const canonicalRequestHash = sha256(
    stableStringify({
      kind: request.kind,
      normalizedKey,
      page,
      limit,
      seasonId,
      search,
      fingerprint,
      trustTier,
      nonce,
    }),
  );

  const normalization: ExplorerLookupNormalization = {
    version: 2,
    kind: request.kind,
    normalizedKey,
    page,
    limit,
    seasonId,
    search,
    fingerprint,
    lookupHash: sha256(`${request.kind}:${normalizedKey}`),
    trustTier,
    riskScore,
    riskFlags,
    canonicalRequestHash,
    issuedAtMs,
    expiresAtMs: receiptTtlMs === null ? null : issuedAtMs + receiptTtlMs,
    nonce,
  };

  const signature = hmacSha256(secret, stableStringify(normalization));
  return { normalization, signature };
}

export function verifyExplorerLookupReceipt(
  receipt: ExplorerLookupReceipt,
  secret: string,
  nowMs: number = Date.now(),
): ExplorerLookupVerification {
  const expected = hmacSha256(secret, stableStringify(receipt.normalization));

  if (!compareHex(receipt.signature, expected)) {
    return {
      valid: false,
      reason: 'INVALID_SIGNATURE',
    };
  }

  const pattern = KIND_PATTERNS[receipt.normalization.kind];
  if (!pattern.test(receipt.normalization.normalizedKey)) {
    return {
      valid: false,
      reason: 'INVALID_NORMALIZED_KEY',
    };
  }

  if (!/^[a-f0-9]{64}$/iu.test(receipt.normalization.fingerprint)) {
    return {
      valid: false,
      reason: 'INVALID_FINGERPRINT',
    };
  }

  if (
    typeof receipt.normalization.expiresAtMs === 'number' &&
    nowMs > receipt.normalization.expiresAtMs
  ) {
    return {
      valid: false,
      reason: 'EXPIRED_RECEIPT',
    };
  }

  return {
    valid: true,
    reason: null,
  };
}

export function buildExplorerLookupCacheKey(
  receipt: ExplorerLookupReceipt,
): string {
  const n = receipt.normalization;

  return [
    'explorer',
    `v${n.version}`,
    n.kind,
    n.normalizedKey,
    `p${n.page}`,
    `l${n.limit}`,
    n.seasonId ?? 'season:none',
    n.search ? sha256(n.search).slice(0, 16) : 'search:none',
    `tier:${n.trustTier.toLowerCase()}`,
  ].join(':');
}

export function redactExplorerLookupReceipt(
  receipt: ExplorerLookupReceipt,
): ExplorerLookupReceipt {
  return {
    normalization: {
      ...receipt.normalization,
      fingerprint: `${receipt.normalization.fingerprint.slice(0, 8)}…`,
      canonicalRequestHash: `${receipt.normalization.canonicalRequestHash.slice(0, 16)}…`,
    },
    signature: `${receipt.signature.slice(0, 16)}…`,
  };
}

export function buildExplorerEnumerationSurface(
  subjectId = 'default',
  options?: {
    readonly gone?: boolean;
    readonly nowMs?: number;
    readonly retryAfterSeconds?: number;
    readonly safeHints?: readonly string[];
    readonly salt?: string | null;
  },
): ExplorerEnumerationSurface {
  const gone = options?.gone === true;
  const nowMs = options?.nowMs ?? Date.now();
  const retryAfterSeconds = Math.max(0, options?.retryAfterSeconds ?? 0);
  const safeHints = options?.safeHints ?? DEFAULT_SAFE_HINTS;
  const salt =
    typeof options?.salt === 'string' && options.salt.length > 0
      ? options.salt
      : randomBytes(8).toString('hex');

  return {
    status: gone ? 410 : 404,
    publicCode: gone ? 'EXPLORER_GONE' : 'EXPLORER_NOT_FOUND',
    opaqueRequestId: `req_${sha256(`${subjectId}:${nowMs}:${salt}`).slice(0, 16)}`,
    retryAfterSeconds,
    body: {
      message: gone
        ? 'Explorer entry is no longer available.'
        : 'Explorer entry was not found.',
      safeHints,
    },
  };
}

export function sanitizeExplorerErrorCopy(error: Error | unknown): Error {
  const originalMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Request could not be completed';

  const redactedMessage = originalMessage
    .replace(
      /\b(?:postgres(?:ql)?|mysql|mongodb|redis):\/\/[^\s]+/giu,
      '[redacted-connection-string]',
    )
    .replace(/\bpassword\s*=\s*[^\s;]+/giu, 'password=[redacted]')
    .replace(/\btoken\s*=\s*[^\s;]+/giu, 'token=[redacted]')
    .replace(/\bsecret\s*=\s*[^\s;]+/giu, 'secret=[redacted]')
    .replace(/\bapi[_-]?key\s*=\s*[^\s;]+/giu, 'api_key=[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gu, 'Bearer [redacted]')
    .replace(
      /Sensitive information exposed/giu,
      'Request could not be completed',
    );

  const sanitized = new Error(redactedMessage);
  sanitized.name = error instanceof Error ? error.name : 'Error';
  return sanitized;
}

export function consumeExplorerProbe(
  state: Map<string, number[]>,
  key: string,
  maxRequests: number,
  windowMs: number,
  nowMs: number = Date.now(),
): ExplorerRateLimitDecision {
  const safeMaxRequests = Math.max(1, Math.floor(maxRequests));
  const safeWindowMs = Math.max(1, Math.floor(windowMs));

  const history = (state.get(key) ?? []).filter(
    (timestamp) => nowMs - timestamp < safeWindowMs,
  );

  if (history.length >= safeMaxRequests) {
    const resetAtMs = history[0] + safeWindowMs;
    const retryAfterMs = Math.max(0, resetAtMs - nowMs);

    state.set(key, history);

    return {
      allowed: false,
      retryAfterMs,
      remaining: 0,
      resetAtMs,
    };
  }

  history.push(nowMs);
  state.set(key, history);

  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, safeMaxRequests - history.length),
    resetAtMs: history[0] + safeWindowMs,
  };
}
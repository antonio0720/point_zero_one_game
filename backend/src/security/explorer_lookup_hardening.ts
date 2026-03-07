// backend/src/security/explorer_lookup_hardening.ts

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type ExplorerLookupKind =
  | 'run'
  | 'proof'
  | 'user'
  | 'season'
  | 'leaderboard'
  | 'badge'
  | 'legend';

export type DeviceTrustTier =
  | 'UNKNOWN'
  | 'UNVERIFIED'
  | 'TRUSTED'
  | 'VERIFIED'
  | 'HARDENED';

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
}

export interface ExplorerLookupNormalization {
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
  readonly issuedAtMs: number;
  readonly nonce: string | null;
}

export interface ExplorerLookupReceipt {
  readonly normalization: ExplorerLookupNormalization;
  readonly signature: string;
}

export interface ExplorerLookupVerification {
  readonly valid: boolean;
  readonly reason: string | null;
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
const HOMOGLYPH_CHARS = /[\u00A0\u2000-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/u;
const TRAVERSAL_PATTERN = /(?:\.\.\/|\/\.\.|\\\.\.|%2e%2e|%2f|%5c)/iu;
const SQL_META_PATTERN = /(?:--|;|\/\*|\*\/|\bunion\b|\bselect\b|\bdrop\b|\binsert\b|\bupdate\b|\bdelete\b)/iu;

const KIND_PATTERNS: Record<ExplorerLookupKind, RegExp> = {
  run: /^[a-z0-9][a-z0-9:_-]{2,127}$/u,
  proof: /^[a-z0-9][a-z0-9:_-]{2,127}$/u,
  user: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
  season: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
  leaderboard: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
  badge: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
  legend: /^[a-z0-9][a-z0-9:_-]{1,127}$/u,
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

function normalizeLookupToken(input: string): string {
  return normalizeWhitespace(input)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[%]/gu, '')
    .replace(/[|]/gu, ':')
    .replace(/[ ]/gu, '-')
    .replace(/[^a-z0-9:_-]/gu, '')
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
    return { value: Math.min(Math.max(normalized, min), max), malformed: true };
  }

  return { value: normalized, malformed: false };
}

function buildFingerprint(input: ExplorerLookupRequest): string {
  return sha256(
    stableStringify({
      clientIp: input.clientIp ?? '',
      userAgent: input.userAgent ?? '',
      deviceId: input.deviceId ?? '',
      trustTier: input.trustTier ?? 'UNKNOWN',
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
  };
}

function scoreRisk(flags: ExplorerRiskFlags, trustTier: DeviceTrustTier): number {
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

  switch (trustTier) {
    case 'UNVERIFIED':
      score += 8;
      break;
    case 'TRUSTED':
      score -= 5;
      break;
    case 'VERIFIED':
      score -= 10;
      break;
    case 'HARDENED':
      score -= 15;
      break;
    default:
      score += 0;
      break;
  }

  return Math.max(score, 0);
}

function compareHex(lhs: string, rhs: string): boolean {
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

  const trustTier = request.trustTier ?? 'UNKNOWN';
  const normalizedKey = normalizeLookupToken(request.rawKey);
  const riskFlags = buildRiskFlags(
    request,
    normalizedKey,
    malformedPage,
    malformedLimit,
  );
  const riskScore = scoreRisk(riskFlags, trustTier);

  if (riskFlags.emptyKey) {
    throw new ExplorerLookupSecurityError('EMPTY_KEY', 'Explorer lookup key is empty.');
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

  const normalization: ExplorerLookupNormalization = {
    kind: request.kind,
    normalizedKey,
    page,
    limit,
    seasonId:
      typeof request.seasonId === 'string' && request.seasonId.trim() !== ''
        ? normalizeLookupToken(request.seasonId)
        : null,
    search: normalizeSearch(request.search),
    fingerprint: buildFingerprint(request),
    lookupHash: sha256(`${request.kind}:${normalizedKey}`),
    trustTier,
    riskScore,
    riskFlags,
    issuedAtMs: request.nowMs ?? Date.now(),
    nonce:
      typeof request.nonce === 'string' && request.nonce.trim() !== ''
        ? normalizeWhitespace(request.nonce).slice(0, 64)
        : null,
  };

  const signature = hmacSha256(secret, stableStringify(normalization));
  return { normalization, signature };
}

export function verifyExplorerLookupReceipt(
  receipt: ExplorerLookupReceipt,
  secret: string,
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
    n.kind,
    n.normalizedKey,
    `p${n.page}`,
    `l${n.limit}`,
    n.seasonId ?? 'season:none',
    n.search ? sha256(n.search).slice(0, 16) : 'search:none',
  ].join(':');
}

export function redactExplorerLookupReceipt(
  receipt: ExplorerLookupReceipt,
): ExplorerLookupReceipt {
  return {
    normalization: {
      ...receipt.normalization,
      fingerprint: `${receipt.normalization.fingerprint.slice(0, 8)}…`,
    },
    signature: `${receipt.signature.slice(0, 16)}…`,
  };
}
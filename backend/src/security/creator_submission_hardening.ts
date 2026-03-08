/**
 * Creator Submission Hardening Module
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/creator_submission_hardening.ts
 *
 * Harden creator submission access patterns:
 * - Prevent sequential-id and casual enumeration
 * - Issue opaque signed submission lookup identifiers
 * - Enforce strict JWT auth with creator-aware ownership checks
 * - Return safe, non-leaky error responses
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Submission } from '../models/submission';

type CreatorAuthScope =
  | 'creator:read'
  | 'creator:write'
  | 'creator:admin'
  | 'submission:read'
  | 'submission:write'
  | 'submission:admin';

interface CreatorJwtClaims {
  sub: string;
  scope?: string | string[];
  scopes?: string[];
  role?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  jti?: string;
}

interface CreatorSecurityContext {
  creatorId: string;
  scopes: string[];
  role: string | null;
  tokenId: string | null;
  issuedAt: number | null;
  expiresAt: number | null;
}

interface CreatorSecurityRequest extends Request {
  creatorSecurity?: CreatorSecurityContext;
}

const LOOKUP_HEADER = 'x-submission-lookup-id';
const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';
const DEFAULT_SIGNING_SECRET =
  process.env.PZO_CREATOR_SUBMISSION_SIGNING_SECRET ??
  process.env.JWT_SECRET ??
  'pzo-local-dev-creator-submission-secret';

const SAFE_NOT_FOUND_BODY = {
  code: 'SUBMISSION_NOT_FOUND',
  message: 'Submission was not found.',
};

const SAFE_UNAUTHORIZED_BODY = {
  code: 'AUTH_REQUIRED',
  message: 'Authentication is required.',
};

const SAFE_FORBIDDEN_BODY = {
  code: 'ACCESS_DENIED',
  message: 'Access is denied.',
};

const SAFE_INTERNAL_BODY = {
  code: 'CREATOR_SUBMISSION_ERROR',
  message: 'Unable to process the request.',
};

const NO_STORE_CACHE_VALUE =
  'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getHeaderValue(
  req: Request,
  headerName: string,
): string | null {
  const raw = req.headers[headerName.toLowerCase()];
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) {
    return raw[0].trim();
  }
  return null;
}

function getRequestId(req: Request): string {
  const existingRequestId =
    getHeaderValue(req, REQUEST_ID_HEADER) ??
    getHeaderValue(req, CORRELATION_ID_HEADER);

  if (existingRequestId) {
    return existingRequestId;
  }

  return `req_${crypto.randomBytes(12).toString('hex')}`;
}

function applySecurityHeaders(res: Response): void {
  res.setHeader('Cache-Control', NO_STORE_CACHE_VALUE);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Vary', 'Authorization, Cookie, X-Submission-Lookup-Id');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function hashForLogs(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeClaims(decoded: string | jwt.JwtPayload): CreatorJwtClaims | null {
  if (typeof decoded === 'string') {
    return null;
  }

  if (!isRecord(decoded)) {
    return null;
  }

  return {
    sub: readString(decoded.sub) ?? '',
    scope:
      typeof decoded.scope === 'string' || Array.isArray(decoded.scope)
        ? decoded.scope
        : undefined,
    scopes: Array.isArray(decoded.scopes)
      ? decoded.scopes.filter((v): v is string => typeof v === 'string')
      : undefined,
    role: readString(decoded.role) ?? undefined,
    iat: typeof decoded.iat === 'number' ? decoded.iat : undefined,
    exp: typeof decoded.exp === 'number' ? decoded.exp : undefined,
    iss: readString(decoded.iss) ?? undefined,
    aud: readString(decoded.aud) ?? undefined,
    jti: readString(decoded.jti) ?? undefined,
  };
}

function normalizeScopes(claims: CreatorJwtClaims): string[] {
  const scopes = new Set<string>();

  if (typeof claims.scope === 'string') {
    for (const token of claims.scope.split(/\s+/g)) {
      if (token.trim()) {
        scopes.add(token.trim());
      }
    }
  }

  if (Array.isArray(claims.scope)) {
    for (const token of claims.scope) {
      if (typeof token === 'string' && token.trim()) {
        scopes.add(token.trim());
      }
    }
  }

  if (Array.isArray(claims.scopes)) {
    for (const token of claims.scopes) {
      if (typeof token === 'string' && token.trim()) {
        scopes.add(token.trim());
      }
    }
  }

  return Array.from(scopes);
}

function hasReadAccess(scopes: string[], role: string | null): boolean {
  return (
    role === 'admin' ||
    scopes.includes('creator:admin') ||
    scopes.includes('submission:admin') ||
    scopes.includes('creator:read') ||
    scopes.includes('submission:read') ||
    scopes.includes('creator:write') ||
    scopes.includes('submission:write')
  );
}

function extractBearerToken(req: Request): string | null {
  const authorization = getHeaderValue(req, 'authorization');
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (!scheme || !token) {
    return null;
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim() || null;
}

function getLookupCandidate(req: Request): string | null {
  const paramId =
    readString((req.params as Record<string, unknown> | undefined)?.submissionId) ??
    readString((req.params as Record<string, unknown> | undefined)?.id);

  if (paramId) {
    return paramId;
  }

  const querySubmissionId = isRecord(req.query)
    ? readString(req.query.submissionId)
    : null;
  if (querySubmissionId) {
    return querySubmissionId;
  }

  const queryId = isRecord(req.query) ? readString(req.query.id) : null;
  if (queryId) {
    return queryId;
  }

  return getHeaderValue(req, LOOKUP_HEADER);
}

function looksLikeOpaqueLookupId(value: string): boolean {
  if (!value) {
    return false;
  }

  if (/^sub_[a-f0-9]{32,128}$/i.test(value)) {
    return true;
  }

  if (/^submission_[a-f0-9]{16,128}$/i.test(value)) {
    return true;
  }

  if (/^[a-f0-9]{48,256}$/i.test(value)) {
    return true;
  }

  return false;
}

function looksLikeEnumerationProbe(value: string): boolean {
  if (!value.trim()) {
    return true;
  }

  if (/^\d{1,12}$/.test(value)) {
    return true;
  }

  if (/^[a-z]+-\d+$/i.test(value)) {
    return true;
  }

  if (/^[a-z_]*\d{1,8}$/i.test(value) && !looksLikeOpaqueLookupId(value)) {
    return true;
  }

  return false;
}

function shapeSafeSubmissionPayload(
  submission: Submission,
  viewerCreatorId: string | null,
  viewerRole: string | null,
): Record<string, unknown> {
  const isOwner = viewerCreatorId ? submission.isOwnedBy(viewerCreatorId) : false;
  const isAdmin = viewerRole === 'admin';

  if (isOwner || isAdmin) {
    return submission.toOwnerJSON();
  }

  return submission.toPublicJSON();
}

function writeNotFound(
  req: Request,
  res: Response,
  lookupToken?: string | null,
): void {
  const requestId = getRequestId(req);
  applySecurityHeaders(res);

  if (lookupToken) {
    res.setHeader('X-Submission-Lookup-Hash', hashForLogs(lookupToken));
  }

  res.setHeader('X-Request-Id', requestId);
  res.status(404).json({
    ...SAFE_NOT_FOUND_BODY,
    requestId,
  });
}

function writeUnauthorized(req: Request, res: Response): void {
  const requestId = getRequestId(req);
  applySecurityHeaders(res);
  res.setHeader('X-Request-Id', requestId);
  res.status(401).json({
    ...SAFE_UNAUTHORIZED_BODY,
    requestId,
  });
}

function writeForbidden(req: Request, res: Response): void {
  const requestId = getRequestId(req);
  applySecurityHeaders(res);
  res.setHeader('X-Request-Id', requestId);
  res.status(403).json({
    ...SAFE_FORBIDDEN_BODY,
    requestId,
  });
}

function coerceSubmissionFromLocals(res: Response): Submission | null {
  const candidate = (res.locals as Record<string, unknown>).submission;
  const normalized = Submission.fromUnknown(candidate);

  if (!normalized) {
    return null;
  }

  (res.locals as Record<string, unknown>).submission = normalized;
  return normalized;
}

function verifySignedLookupId(
  submission: Submission,
  candidate: string,
  secret: string,
): boolean {
  if (!candidate) {
    return false;
  }

  const canonical = `${submission.id}:${submission.creatorId}:${submission.version}:${submission.createdAt}`;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(canonical)
    .digest('hex');

  const signedValue = `sub_${digest}`;
  return safeCompare(candidate, signedValue);
}

/**
 * Prevent enumeration of submissions
 */
export const preventEnumeration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    applySecurityHeaders(res);

    const lookupCandidate = getLookupCandidate(req);
    if (lookupCandidate && looksLikeEnumerationProbe(lookupCandidate)) {
      return writeNotFound(req, res, lookupCandidate);
    }

    const submission = coerceSubmissionFromLocals(res);
    if (!submission) {
      return next();
    }

    const signedLookupId =
      submission.signedLookupId ??
      signedSubmissionId(submission, DEFAULT_SIGNING_SECRET);

    submission.signedLookupId = signedLookupId;

    (res.locals as Record<string, unknown>).submission = submission;
    (res.locals as Record<string, unknown>).submissionLookupId = signedLookupId;
    (res.locals as Record<string, unknown>).submissionPublic =
      submission.toPublicJSON();

    if (lookupCandidate && looksLikeOpaqueLookupId(lookupCandidate)) {
      const isValidSignedLookup = verifySignedLookupId(
        submission,
        lookupCandidate,
        DEFAULT_SIGNING_SECRET,
      );

      if (!isValidSignedLookup && lookupCandidate !== submission.id) {
        return writeNotFound(req, res, lookupCandidate);
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Signed submission IDs
 */
export const signedSubmissionId = (
  submission?: Submission | string,
  secret: string = DEFAULT_SIGNING_SECRET,
) => {
  if (!submission) {
    return `sub_${crypto.randomBytes(32).toString('hex')}`;
  }

  const normalized =
    submission instanceof Submission
      ? submission
      : Submission.create({
          id: String(submission),
          creatorId: 'unknown',
          title: 'opaque-submission',
          kind: 'ugc',
          status: 'draft',
          visibility: 'private',
          version: 1,
          metadata: {},
        });

  const canonical = `${normalized.id}:${normalized.creatorId}:${normalized.version}:${normalized.createdAt}`;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(canonical)
    .digest('hex');

  return `sub_${digest}`;
};

/**
 * Strict auth middleware
 */
export const strictAuth = (secret: string) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      applySecurityHeaders(res);

      const token = extractBearerToken(req);
      if (!token) {
        return writeUnauthorized(req, res);
      }

      const verified = jwt.verify(token, secret, {
        algorithms: ['HS256', 'HS384', 'HS512'],
      });

      const claims = normalizeClaims(verified);
      if (!claims || !claims.sub) {
        return writeUnauthorized(req, res);
      }

      const scopes = normalizeScopes(claims);
      const role = claims.role ?? null;

      if (!hasReadAccess(scopes, role)) {
        return writeForbidden(req, res);
      }

      const creatorContext: CreatorSecurityContext = {
        creatorId: claims.sub,
        scopes,
        role,
        tokenId: claims.jti ?? null,
        issuedAt: typeof claims.iat === 'number' ? claims.iat : null,
        expiresAt: typeof claims.exp === 'number' ? claims.exp : null,
      };

      (req as CreatorSecurityRequest).creatorSecurity = creatorContext;
      (res.locals as Record<string, unknown>).creatorSecurity = creatorContext;

      const submission = coerceSubmissionFromLocals(res);
      if (!submission) {
        return next();
      }

      submission.signedLookupId =
        submission.signedLookupId ??
        signedSubmissionId(submission, DEFAULT_SIGNING_SECRET);

      const isOwner = submission.isOwnedBy(creatorContext.creatorId);
      const isAdmin =
        creatorContext.role === 'admin' ||
        creatorContext.scopes.includes('creator:admin') ||
        creatorContext.scopes.includes('submission:admin');
      const isPublic = submission.isPubliclyReadable();

      if (!isOwner && !isAdmin && !isPublic) {
        return writeNotFound(req, res, submission.id);
      }

      (res.locals as Record<string, unknown>).submission =
        submission;
      (res.locals as Record<string, unknown>).submissionSafe =
        shapeSafeSubmissionPayload(
          submission,
          creatorContext.creatorId,
          creatorContext.role,
        );

      return next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return writeUnauthorized(req, res);
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return writeUnauthorized(req, res);
      }

      return next(error);
    }
  };
};

/**
 * Safe error handling middleware
 */
export const safeErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  void next;

  const requestId = getRequestId(req);
  applySecurityHeaders(res);
  res.setHeader('X-Request-Id', requestId);

  const submission = coerceSubmissionFromLocals(res);
  if (submission) {
    submission.signedLookupId =
      submission.signedLookupId ??
      signedSubmissionId(submission, DEFAULT_SIGNING_SECRET);

    (res.locals as Record<string, unknown>).submissionSafe =
      submission.toPublicJSON();
  }

  const knownStatus = (err as Error & { status?: number; statusCode?: number })
    .status ?? (err as Error & { status?: number; statusCode?: number }).statusCode;

  if (knownStatus === 404) {
    return res.status(404).json({
      ...SAFE_NOT_FOUND_BODY,
      requestId,
    });
  }

  if (knownStatus === 401) {
    return res.status(401).json({
      ...SAFE_UNAUTHORIZED_BODY,
      requestId,
    });
  }

  if (knownStatus === 403) {
    return res.status(403).json({
      ...SAFE_FORBIDDEN_BODY,
      requestId,
    });
  }

  const message =
    process.env.NODE_ENV === 'development'
      ? err.message || SAFE_INTERNAL_BODY.message
      : SAFE_INTERNAL_BODY.message;

  return res.status(500).json({
    code: SAFE_INTERNAL_BODY.code,
    message,
    requestId,
  });
};
// backend/host-os/auth/admin.ts

import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';

const ADMIN_API_KEY_HEADERS = [
  'x-admin-api-key',
  'x-host-os-admin-api-key',
] as const;

const ADMIN_BEARER_REALM = 'pzo-host-os-admin';

function normalizeSecret(value: string | undefined | null): string {
  return (value ?? '').trim();
}

function getConfiguredAdminApiKeys(): string[] {
  const keys = [
    normalizeSecret(process.env.HOST_OS_ADMIN_API_KEY),
    normalizeSecret(process.env.HOST_OS_ADMIN_API_KEY_PREVIOUS),
  ].filter((value): value is string => value.length > 0);

  return Array.from(new Set(keys));
}

function extractBearerToken(rawAuthorization: string | undefined): string {
  const authorization = normalizeSecret(rawAuthorization);
  if (!authorization) {
    return '';
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return normalizeSecret(match?.[1]);
}

function extractPresentedApiKey(req: Request): string {
  for (const headerName of ADMIN_API_KEY_HEADERS) {
    const headerValue = normalizeSecret(req.get(headerName));
    if (headerValue) {
      return headerValue;
    }
  }

  const bearerToken = extractBearerToken(req.get('authorization'));
  if (bearerToken) {
    return bearerToken;
  }

  return '';
}

function digestSecret(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function secureEquals(left: string, right: string): boolean {
  const leftDigest = digestSecret(left);
  const rightDigest = digestSecret(right);
  return timingSafeEqual(leftDigest, rightDigest);
}

export function isAdminRequestAuthorized(req: Request): boolean {
  const configuredKeys = getConfiguredAdminApiKeys();
  const provided = extractPresentedApiKey(req);

  if (configuredKeys.length === 0 || !provided) {
    return false;
  }

  return configuredKeys.some((expected) => secureEquals(provided, expected));
}

export const requireAdminApiKey: RequestHandler = (req, res, next) => {
  const configuredKeys = getConfiguredAdminApiKeys();

  res.setHeader('Cache-Control', 'no-store');

  if (configuredKeys.length === 0) {
    return res.status(503).json({
      ok: false,
      error: 'HOST_OS_ADMIN_API_KEY is not configured.',
    });
  }

  if (!isAdminRequestAuthorized(req)) {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer realm="${ADMIN_BEARER_REALM}"`,
    );

    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
    });
  }

  return next();
};
//backend/host-os/auth/admin.ts

import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';

function getExpectedAdminApiKey(): string {
  return (process.env.HOST_OS_ADMIN_API_KEY ?? '').trim();
}

function getPresentedAdminApiKey(req: Request): string {
  const headerApiKey = req.get('x-admin-api-key');
  if (headerApiKey && headerApiKey.trim().length > 0) {
    return headerApiKey.trim();
  }

  const authorization = req.get('authorization');
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return '';
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAdminRequestAuthorized(req: Request): boolean {
  const expected = getExpectedAdminApiKey();
  const presented = getPresentedAdminApiKey(req);

  if (!expected || !presented) {
    return false;
  }

  return secureEquals(presented, expected);
}

export const requireAdminApiKey: RequestHandler = (req, res, next) => {
  const expected = getExpectedAdminApiKey();

  if (!expected) {
    return res.status(503).json({
      ok: false,
      error: 'Admin API key is not configured.',
    });
  }

  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
    });
  }

  return next();
};
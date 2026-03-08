//backend/host-os/auth/admin.ts

import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';

function getConfiguredAdminApiKey(): string {
  return (process.env.HOST_OS_ADMIN_API_KEY ?? '').trim();
}

function extractPresentedApiKey(req: Request): string {
  const directKey = req.get('x-admin-api-key');
  if (directKey && directKey.trim().length > 0) {
    return directKey.trim();
  }

  const authHeader = req.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
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
  const expected = getConfiguredAdminApiKey();
  const provided = extractPresentedApiKey(req);

  if (!expected || !provided) {
    return false;
  }

  return secureEquals(provided, expected);
}

export const requireAdminApiKey: RequestHandler = (req, res, next) => {
  const expected = getConfiguredAdminApiKey();

  if (!expected) {
    return res.status(503).json({
      ok: false,
      error: 'HOST_OS_ADMIN_API_KEY is not configured.',
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
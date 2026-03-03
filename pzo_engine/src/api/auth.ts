// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — API MIDDLEWARE — AUTH
// pzo_engine/src/api/middleware/auth.ts
//
// Bearer token authentication for all non-public endpoints.
//
// PUBLIC routes (no auth required):
//   GET /health
//   GET /leaderboard
//   GET /runs/:id            (proof is public by design)
//   GET /runs/:id/replay     (replay verification is public by design)
//   GET /catalog
//
// PROTECTED routes (bearer token required):
//   POST /runs               (only the engine submits runs)
//   GET  /runs/user/:userId  (user-scoped data)
//
// ENV:
//   PZO_API_KEY — required for protected routes.
//                 If unset, protected routes return 503 (misconfigured).
//
// Density6 LLC · Point Zero One · API Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';

const API_KEY = process.env['PZO_API_KEY'];

/**
 * requireApiKey — protects write endpoints.
 *
 * Expects:  Authorization: Bearer <token>
 * Rejects:  401 if missing, 403 if wrong, 503 if key not configured.
 */
export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!API_KEY) {
    res.status(503).json({
      ok:    false,
      error: 'Server API key not configured. Set PZO_API_KEY.',
      code:  'SERVICE_UNAVAILABLE',
      ts:    Date.now(),
    });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({
      ok:    false,
      error: 'Missing Authorization header.',
      code:  'UNAUTHORIZED',
      ts:    Date.now(),
    });
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({
      ok:    false,
      error: 'Authorization header must use Bearer scheme.',
      code:  'UNAUTHORIZED',
      ts:    Date.now(),
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(token, API_KEY)) {
    res.status(403).json({
      ok:    false,
      error: 'Invalid API key.',
      code:  'FORBIDDEN',
      ts:    Date.now(),
    });
    return;
  }

  next();
}

/**
 * Constant-time string comparison.
 * Prevents timing-based key enumeration attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const { createHash, timingSafeEqual: cryptoTimingSafeEqual } = require('node:crypto') as typeof import('node:crypto');
  // Pad to same length using SHA-256 to prevent length leakage
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return cryptoTimingSafeEqual(ha, hb);
}
/**
 * RateLimitMiddleware — Higher-order function for per-player route-level rate limiting.
 * Applied on top of AuthMiddleware for endpoints that need additional throttling
 * beyond the identity-tier limits in the global authMiddleware.
 *
 * Usage: RateLimitMiddleware(handler)
 * Config: 10 requests per player per 60 seconds (adjustable via env).
 */

import { Request, Response, NextFunction } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next?: NextFunction) => Promise<void> | void;

// In-process sliding-window counter (swap for Redis-backed in prod via env flag)
const hitMap = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
const MAX_HITS = parseInt(process.env.RATE_LIMIT_MAX_HITS ?? '10', 10);

export function RateLimitMiddleware(handler: AsyncRouteHandler): AsyncRouteHandler {
  return async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
    const key = req.identityId ?? req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hitMap.get(key);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
      hitMap.set(key, { count: 1, windowStart: now });
    } else {
      entry.count++;
      if (entry.count > MAX_HITS) {
        const retryAfterMs = WINDOW_MS - (now - entry.windowStart);
        res.status(429).json({
          ok: false,
          error: 'rate_limit_exceeded',
          retryAfterMs,
        });
        return;
      }
    }

    return handler(req, res, next);
  };
}

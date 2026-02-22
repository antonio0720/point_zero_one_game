/**
 * AuthMiddleware — Higher-order function that wraps route handlers.
 * Reads the identity set by the upstream authMiddleware (src/middleware/auth_middleware.ts)
 * and rejects the request if the user is not authenticated.
 *
 * Usage: AuthMiddleware(async (req, res) => { ... })
 * Inside handler: req.identityId — the verified player ID.
 */

import { Request, Response, NextFunction } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next?: NextFunction) => Promise<void> | void;

export function AuthMiddleware(handler: AsyncRouteHandler): AsyncRouteHandler {
  return async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
    // req.isAuthenticated and req.identityId are attached by the upstream
    // authMiddleware in src/middleware/auth_middleware.ts
    if (!req.isAuthenticated || !req.identityId) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
    return handler(req, res, next);
  };
}

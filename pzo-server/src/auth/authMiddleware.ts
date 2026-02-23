/**
 * pzo-server/src/auth/authMiddleware.ts
 * JWT Bearer token verification. Attaches userId to request.
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthService } from './authService';

export function authMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required.' });
    }

    const token = header.slice(7);
    try {
      const payload = authService.verifyAccessToken(token);
      (req as Request & { userId: string; username: string }).userId   = payload.sub;
      (req as Request & { userId: string; username: string }).username = payload.username;
      return next();
    } catch {
      return res.status(401).json({ error: 'Token expired or invalid. Please refresh.' });
    }
  };
}

/** Socket.io auth middleware — call from io.use() */
export function socketAuthMiddleware(authService: AuthService) {
  return (socket: Record<string, unknown>, next: (err?: Error) => void) => {
    const token = (socket.handshake as Record<string, Record<string, string>>)?.auth?.token;
    if (!token) {
      return next(new Error('Auth token required.'));
    }
    try {
      const payload = authService.verifyAccessToken(token);
      (socket as Record<string, unknown>).userId      = payload.sub;
      (socket as Record<string, unknown>).username    = payload.username;
      (socket as Record<string, unknown>).displayName = payload.displayName;
      return next();
    } catch {
      return next(new Error('Invalid or expired token.'));
    }
  };
}

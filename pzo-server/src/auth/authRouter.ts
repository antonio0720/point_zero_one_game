/**
 * pzo-server/src/auth/authRouter.ts
 * Routes: POST /auth/register | /auth/login | /auth/refresh | /auth/logout | GET /auth/me
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from './authService';
import { authMiddleware } from './authMiddleware';
import type { Pool } from 'pg';

export function createAuthRouter(db: Pool): Router {
  const router  = Router();
  const service = new AuthService(db);

  // ── Rate limiters ──────────────────────────────────────────────────────────

  const loginLimiter = rateLimit({
    windowMs:   15 * 60 * 1000,  // 15 min
    max:        10,
    message:    { error: 'Too many login attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders:   false,
  });

  const registerLimiter = rateLimit({
    windowMs:   60 * 60 * 1000,  // 1 hour
    max:        5,
    message:    { error: 'Too many registrations from this IP.' },
    standardHeaders: true,
    legacyHeaders:   false,
  });

  // ── POST /auth/register ────────────────────────────────────────────────────

  router.post('/register', registerLimiter, async (req: Request, res: Response) => {
    try {
      const { username, email, password, displayName } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'username, email, and password are required.' });
      }

      const result = await service.register(username, email, password, displayName);

      // Set refresh token as HttpOnly cookie
      res.cookie('pzo_refresh', result.refreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge:   7 * 24 * 60 * 60 * 1000,
        path:     '/auth',
      });

      return res.status(201).json({
        accessToken: result.accessToken,
        user:        result.user,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      return res.status(400).json({ error: msg });
    }
  });

  // ── POST /auth/login ───────────────────────────────────────────────────────

  router.post('/login', loginLimiter, async (req: Request, res: Response) => {
    try {
      const { usernameOrEmail, password } = req.body;
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ error: 'Credentials required.' });
      }

      const ip = req.ip;
      const ua = req.headers['user-agent'];
      const result = await service.login(usernameOrEmail, password, ip, ua);

      res.cookie('pzo_refresh', result.refreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge:   7 * 24 * 60 * 60 * 1000,
        path:     '/auth',
      });

      return res.json({
        accessToken: result.accessToken,
        user:        result.user,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      return res.status(401).json({ error: msg });
    }
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.pzo_refresh;
      if (!token) return res.status(401).json({ error: 'No refresh token.' });

      const { accessToken } = await service.refresh(token);
      return res.json({ accessToken });
    } catch {
      res.clearCookie('pzo_refresh', { path: '/auth' });
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────

  router.post('/logout', async (req: Request, res: Response) => {
    const token = req.cookies?.pzo_refresh;
    if (token) await service.logout(token).catch(() => {});
    res.clearCookie('pzo_refresh', { path: '/auth' });
    return res.json({ ok: true });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  router.get('/me', authMiddleware(service), async (req: Request, res: Response) => {
    try {
      const profile = await service.getProfile((req as Request & { userId: string }).userId);
      return res.json({ user: profile });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Not found.';
      return res.status(404).json({ error: msg });
    }
  });

  // ── POST /auth/run-result ──────────────────────────────────────────────────

  router.post('/run-result', authMiddleware(service), async (req: Request, res: Response) => {
    try {
      const userId = (req as Request & { userId: string }).userId;
      const { seed, ticksSurvived, finalCash, finalNetWorth, finalIncome, finalExpenses, outcome, proofHash, haterSabotages } = req.body;

      await service.recordRunResult(
        userId, seed, ticksSurvived, finalCash, finalNetWorth,
        finalIncome, finalExpenses, outcome, proofHash, haterSabotages ?? 0
      );

      return res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save run.';
      return res.status(500).json({ error: msg });
    }
  });

  return router;
}

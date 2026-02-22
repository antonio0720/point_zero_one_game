/**
 * ============================================================================
 * FILE: pzo_server/src/services/chat/ChatMiddleware.ts
 * Point Zero One — Chat Middleware Stack
 * 
 * Middleware chain for all chat HTTP + WebSocket routes:
 *   1. authenticatePlayer  — JWT validation, session check
 *   2. chatRateLimit       — per-player per-channel sliding window
 *   3. checkBan            — mute / quarantine / account ban check
 *   4. requireRank         — rank gate for officer channels
 *   5. validateChannelAccess — membership check (is player in this alliance/room?)
 * 
 * Deploy to: pzo_server/src/services/chat/ChatMiddleware.ts
 * ============================================================================
 */

import type { Request, Response, NextFunction } from 'express';
import type { WebSocket } from 'ws';
import { Redis } from 'ioredis';
import { Pool }  from 'pg';
import jwt from 'jsonwebtoken';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  player: {
    id:          string;
    displayName: string;
    allianceId:  string | null;
    rank:        string | null;
    title:       string | null;
    serverId:    string;
  };
}

interface JWTPayload {
  sub:        string;   // playerId
  name:       string;
  allianceId: string | null;
  rank:       string | null;
  title:      string | null;
  serverId:   string;
  iat:        number;
  exp:        number;
}

// ─── RATE LIMIT CONFIG ────────────────────────────────────────────────────────

const RATE_LIMITS: Record<string, { maxTokens: number; refillMs: number }> = {
  GLOBAL:           { maxTokens: 1,  refillMs: 3_000  },
  SERVER:           { maxTokens: 1,  refillMs: 3_000  },
  ALLIANCE:         { maxTokens: 3,  refillMs: 1_000  },
  ALLIANCE_OFFICER: { maxTokens: 5,  refillMs: 500    },
  ROOM:             { maxTokens: 5,  refillMs: 500    },
  DM:               { maxTokens: 10, refillMs: 500    },
};

// ─── FACTORY ─────────────────────────────────────────────────────────────────

export function createChatMiddleware(redis: Redis, pg: Pool) {

  // ── 1. AUTHENTICATE PLAYER ──────────────────────────────────────────────────

  async function authenticatePlayer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ ok: false, error: 'MISSING_TOKEN' });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

      // Check session is still valid (not force-logged-out)
      const sessionValid = await redis.get(`session:${payload.sub}`);
      if (!sessionValid) {
        res.status(401).json({ ok: false, error: 'SESSION_EXPIRED' });
        return;
      }

      (req as AuthenticatedRequest).player = {
        id:          payload.sub,
        displayName: payload.name,
        allianceId:  payload.allianceId,
        rank:        payload.rank,
        title:       payload.title,
        serverId:    payload.serverId,
      };

      next();
    } catch {
      res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
    }
  }

  // ── 2. AUTHENTICATE WEBSOCKET ────────────────────────────────────────────────

  async function authenticateWS(
    token: string
  ): Promise<JWTPayload | null> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      const sessionValid = await redis.get(`session:${payload.sub}`);
      if (!sessionValid) return null;
      return payload;
    } catch {
      return null;
    }
  }

  // ── 3. RATE LIMIT ────────────────────────────────────────────────────────────

  function chatRateLimit(channelType: string) {
    return async function (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      const player = (req as AuthenticatedRequest).player;
      const config = RATE_LIMITS[channelType] ?? RATE_LIMITS['ALLIANCE'];
      const key    = `rl:chat:${player.id}:${channelType}`;

      // Sliding window using Redis INCR + TTL
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, config.refillMs);
      }

      if (count > config.maxTokens) {
        const ttl = await redis.pttl(key);
        res.status(429).json({
          ok:      false,
          error:   'RATE_LIMITED',
          retryMs: ttl,
        });
        return;
      }

      next();
    };
  }

  // ── 4. CHECK BAN ─────────────────────────────────────────────────────────────

  async function checkBan(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const player = (req as AuthenticatedRequest).player;

    // Check Redis first (fast path)
    const chatMuted  = await redis.get(`ban:chat:${player.id}`);
    const accountBan = await redis.get(`ban:account:${player.id}`);

    if (accountBan) {
      res.status(403).json({ ok: false, error: 'ACCOUNT_BANNED' });
      return;
    }

    if (chatMuted) {
      const ttl = await redis.ttl(`ban:chat:${player.id}`);
      res.status(403).json({
        ok:        false,
        error:     'CHAT_MUTED',
        expiresIn: ttl,
      });
      return;
    }

    // Slow path: check DB for permanent bans not cached in Redis
    const activeBan = await pg.query(
      `SELECT ban_type, expires_at FROM ban_log
       WHERE player_id = $1
         AND lifted_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [player.id]
    );

    if (activeBan.rows.length) {
      const ban = activeBan.rows[0];
      // Re-cache
      if (ban.ban_type === 'CHAT_MUTE') {
        const expiresIn = ban.expires_at
          ? Math.floor((new Date(ban.expires_at).getTime() - Date.now()) / 1000)
          : 0;
        if (expiresIn > 0) await redis.set(`ban:chat:${player.id}`, '1', 'EX', expiresIn);
      }
      res.status(403).json({ ok: false, error: ban.ban_type });
      return;
    }

    next();
  }

  // ── 5. REQUIRE RANK ──────────────────────────────────────────────────────────

  function requireRank(minRank: number) {
    return function (
      req: Request,
      res: Response,
      next: NextFunction
    ): void {
      const player = (req as AuthenticatedRequest).player;
      const rankNum = player.rank ? parseInt(player.rank.replace('R', '')) : 0;
      if (rankNum < minRank) {
        res.status(403).json({ ok: false, error: 'INSUFFICIENT_RANK', required: `R${minRank}` });
        return;
      }
      next();
    };
  }

  // ── 6. VALIDATE CHANNEL ACCESS ───────────────────────────────────────────────

  function validateChannelAccess(channelType: string) {
    return async function (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      const player    = (req as AuthenticatedRequest).player;
      const channelId = req.params.channelId ?? req.body?.channelId;

      switch (channelType) {

        case 'ALLIANCE':
        case 'ALLIANCE_OFFICER': {
          // Channel ID format: "alliance_{allianceId}" or "officer_{allianceId}"
          const allianceId = channelId.replace(/^(alliance_|officer_)/, '');
          if (!player.allianceId || player.allianceId !== allianceId) {
            res.status(403).json({ ok: false, error: 'NOT_IN_ALLIANCE' });
            return;
          }
          break;
        }

        case 'ROOM': {
          // Check membership in chat_room_members
          const member = await pg.query(
            `SELECT 1 FROM chat_room_members WHERE user_id = $1 AND room_id = $2`,
            [player.id, channelId]
          );
          if (!member.rows.length) {
            res.status(403).json({ ok: false, error: 'NOT_IN_ROOM' });
            return;
          }
          break;
        }

        case 'DM': {
          // Channel ID format: "dm_{sorted_ids}"
          if (!channelId.includes(player.id)) {
            res.status(403).json({ ok: false, error: 'NOT_IN_DM' });
            return;
          }
          break;
        }

        case 'GLOBAL':
        case 'SERVER':
          // Open channels — no membership check needed
          break;

        default:
          res.status(400).json({ ok: false, error: 'UNKNOWN_CHANNEL_TYPE' });
          return;
      }

      next();
    };
  }

  // ── 7. BODY VALIDATOR ────────────────────────────────────────────────────────

  function validateMessageBody(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const { type, body } = req.body;

    if (!type || !body) {
      res.status(400).json({ ok: false, error: 'MISSING_FIELDS', required: ['type', 'body'] });
      return;
    }

    const VALID_TYPES = ['TEXT', 'STICKER', 'DEAL_INVITE', 'PROOF_SHARE'];
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ ok: false, error: 'INVALID_MESSAGE_TYPE' });
      return;
    }

    if (type === 'TEXT' && typeof body === 'string' && body.length > 500) {
      res.status(400).json({ ok: false, error: 'MESSAGE_TOO_LONG', max: 500 });
      return;
    }

    next();
  }

  // ── 8. WS RATE LIMIT (in-memory for WS connections) ──────────────────────────

  const wsMessageTimestamps = new Map<string, number[]>();

  function wsRateLimit(playerId: string, channelType: string): boolean {
    const config = RATE_LIMITS[channelType] ?? RATE_LIMITS['ALLIANCE'];
    const now    = Date.now();
    const key    = `${playerId}:${channelType}`;
    const times  = wsMessageTimestamps.get(key) ?? [];

    // Clean old timestamps outside window
    const recent = times.filter(t => now - t < config.refillMs);

    if (recent.length >= config.maxTokens) return false;

    recent.push(now);
    wsMessageTimestamps.set(key, recent);

    // Cleanup stale entries every 5 minutes
    return true;
  }

  return {
    authenticatePlayer,
    authenticateWS,
    chatRateLimit,
    checkBan,
    requireRank,
    validateChannelAccess,
    validateMessageBody,
    wsRateLimit,
  };
}

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────

export function chatErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[ChatMiddleware] Unhandled error:', err);
  res.status(500).json({
    ok:      false,
    error:   'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
  });
}

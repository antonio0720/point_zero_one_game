/**
 * ============================================================================
 * FILE: pzo_server/src/services/chat/ChatRouter.ts
 * Point Zero One — Chat HTTP + WebSocket Router
 * 
 * REST:
 *   POST   /chat/:channelId/messages           → send message
 *   DELETE /chat/messages/:messageId/unsend    → unsend (15s window)
 *   GET    /chat/:channelId/history            → paginated history
 *   POST   /chat/:channelId/pin/:messageId     → pin message (R3+)
 *   POST   /chat/messages/:messageId/react     → add/toggle reaction
 *   POST   /chat/rooms                         → create room
 *   POST   /chat/rooms/:roomId/join            → join room
 *   DELETE /chat/rooms/:roomId/leave           → leave room
 *   POST   /chat/dm/:targetId                  → get or create DM channel
 *   POST   /chat/blocks/:targetId              → block player
 *   DELETE /chat/blocks/:targetId              → unblock player
 *   GET    /chat/blocks                        → list blocks
 *   POST   /chat/reports                       → report player
 *   PATCH  /chat/:channelId/slow-mode          → set slow mode (R3+)
 *   PATCH  /chat/:channelId/lock               → lock/unlock (R3+)
 * 
 * WebSocket:
 *   ws://  /chat/ws?token=JWT                  → real-time fan-out
 * 
 * Deploy to: pzo_server/src/services/chat/ChatRouter.ts
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { Redis }         from 'ioredis';
import { Pool }          from 'pg';
import { ChatService }   from './ChatService';
import {
  createChatMiddleware,
  chatErrorHandler,
  AuthenticatedRequest,
} from './ChatMiddleware';
import { apiOk, apiError } from '../../../shared/contracts/multiplayer';

// ─── SETUP ────────────────────────────────────────────────────────────────────

export function createChatRouter(
  redis:   Redis,
  pg:      Pool,
  chat:    ChatService,
  wss:     WebSocketServer,
): Router {
  const router = Router();
  const mw     = createChatMiddleware(redis, pg);

  // All chat routes require authentication
  router.use(mw.authenticatePlayer);
  router.use(mw.checkBan);

  // ─── SEND MESSAGE ───────────────────────────────────────────────────────────

  router.post('/:channelId/messages',
    mw.validateMessageBody,
    mw.chatRateLimit('AUTO'), // channelType resolved inside handler
    mw.validateChannelAccess('AUTO'),
    async (req: Request, res: Response) => {
      const player    = (req as AuthenticatedRequest).player;
      const channelId = req.params.channelId;
      const { type, body, replyToId } = req.body;

      const channelType = resolveChannelType(channelId, player.allianceId);

      // Officer channel rank gate
      if (channelType === 'ALLIANCE_OFFICER') {
        const rankNum = player.rank ? parseInt(player.rank.replace('R', '')) : 0;
        if (rankNum < 3) {
          res.status(403).json(apiError('INSUFFICIENT_RANK', 'Officer channel requires R3+'));
          return;
        }
      }

      const result = await chat.send(
        player.id,
        channelType,
        channelId,
        type,
        body,
        {
          replyToId:   replyToId ?? undefined,
          senderRank:  player.rank  ?? undefined,
          senderTitle: player.title ?? undefined,
        }
      );

      if ('error' in result) {
        res.status(400).json(apiError(result.error, result.error));
        return;
      }

      res.json(apiOk(result));
    }
  );

  // ─── UNSEND MESSAGE ─────────────────────────────────────────────────────────

  router.delete('/messages/:messageId/unsend',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      const result = await chat.unsend(player.id, req.params.messageId);

      if (!result.success) {
        const status = result.reason === 'NOT_SENDER' ? 403 :
                       result.reason === 'WINDOW_EXPIRED' ? 410 : 404;
        res.status(status).json(apiError(result.reason ?? 'UNSEND_FAILED', result.reason ?? ''));
        return;
      }

      res.json(apiOk({ messageId: result.messageId }));
    }
  );

  // ─── HISTORY ────────────────────────────────────────────────────────────────

  router.get('/:channelId/history',
    async (req: Request, res: Response) => {
      const player    = (req as AuthenticatedRequest).player;
      const channelId = req.params.channelId;
      const before    = req.query.before ? new Date(req.query.before as string) : undefined;
      const limit     = Math.min(parseInt(req.query.limit as string ?? '50'), 100);

      const messages = await chat.getHistory(player.id, channelId, before, limit);
      res.json(apiOk({ messages, hasMore: messages.length === limit }));
    }
  );

  // ─── PIN MESSAGE ────────────────────────────────────────────────────────────

  router.post('/:channelId/pin/:messageId',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      try {
        await chat.pin(player.id, req.params.messageId, req.params.channelId);
        res.json(apiOk({ pinned: true }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'UNKNOWN';
        res.status(403).json(apiError(msg, msg));
      }
    }
  );

  // ─── REACT ──────────────────────────────────────────────────────────────────

  router.post('/messages/:messageId/react',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      const { emoji } = req.body;
      if (!emoji) {
        res.status(400).json(apiError('MISSING_EMOJI', 'emoji required'));
        return;
      }
      await chat.react(player.id, req.params.messageId, emoji);
      res.json(apiOk({ ok: true }));
    }
  );

  // ─── MODERATE (R3+) ─────────────────────────────────────────────────────────

  router.delete('/messages/:messageId',
    mw.requireRank(3),
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      await chat.modDelete(player.id, req.params.messageId);
      res.json(apiOk({ deleted: true }));
    }
  );

  // ─── SLOW MODE (R3+) ────────────────────────────────────────────────────────

  router.patch('/:channelId/slow-mode',
    mw.requireRank(3),
    async (req: Request, res: Response) => {
      const seconds = parseInt(req.body.seconds ?? '0');
      const VALID_MODES = [0, 5, 15, 30, 60];
      if (!VALID_MODES.includes(seconds)) {
        res.status(400).json(apiError('INVALID_SLOW_MODE', `Must be one of: ${VALID_MODES.join(',')}`));
        return;
      }
      await chat.slowMode(req.params.channelId, seconds);
      res.json(apiOk({ slowModeSeconds: seconds }));
    }
  );

  // ─── LOCK CHANNEL (R3+) ─────────────────────────────────────────────────────

  router.patch('/:channelId/lock',
    mw.requireRank(3),
    async (req: Request, res: Response) => {
      const locked = req.body.locked === true;
      await chat.lockChannel(req.params.channelId, locked);
      res.json(apiOk({ locked }));
    }
  );

  // ─── ROOMS ──────────────────────────────────────────────────────────────────

  router.post('/rooms',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      const { name, type, maxMembers } = req.body;
      if (!name) {
        res.status(400).json(apiError('MISSING_NAME', 'Room name required'));
        return;
      }
      const roomId = await chat.createRoom(
        player.id,
        name,
        type ?? 'CUSTOM',
        Math.min(maxMembers ?? 10, 50)
      );
      res.status(201).json(apiOk({ roomId }));
    }
  );

  router.post('/rooms/:roomId/join',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      try {
        await chat.joinRoom(player.id, req.params.roomId, req.body.inviteToken);
        res.json(apiOk({ joined: true }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'JOIN_FAILED';
        const status = msg === 'ROOM_NOT_FOUND' ? 404 :
                       msg === 'ROOM_FULL' ? 409 :
                       msg === 'INVITE_REQUIRED' ? 403 : 400;
        res.status(status).json(apiError(msg, msg));
      }
    }
  );

  router.delete('/rooms/:roomId/leave',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      await chat.leaveRoom(player.id, req.params.roomId);
      res.json(apiOk({ left: true }));
    }
  );

  // ─── DM ─────────────────────────────────────────────────────────────────────

  router.post('/dm/:targetId',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;

      const blocked = await chat.isBlocked(player.id, req.params.targetId);
      if (blocked) {
        res.status(403).json(apiError('BLOCKED', 'Cannot DM a blocked user'));
        return;
      }

      const channelId = await chat.getOrCreateDmChannel(player.id, req.params.targetId);
      const history   = await chat.getHistory(player.id, channelId, undefined, 50);
      res.json(apiOk({ channelId, messages: history }));
    }
  );

  // ─── BLOCK ──────────────────────────────────────────────────────────────────

  router.post('/blocks/:targetId',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      if (player.id === req.params.targetId) {
        res.status(400).json(apiError('CANNOT_BLOCK_SELF', 'Nice try.'));
        return;
      }
      await chat.block(player.id, req.params.targetId, req.body.reason);
      res.json(apiOk({ blocked: true }));
    }
  );

  router.delete('/blocks/:targetId',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      await chat.unblock(player.id, req.params.targetId);
      res.json(apiOk({ unblocked: true }));
    }
  );

  router.get('/blocks',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      const blocks = await chat.getBlockList(player.id);
      res.json(apiOk({ blocks }));
    }
  );

  // ─── REPORT ─────────────────────────────────────────────────────────────────

  router.post('/reports',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      const { reportedId, channelId, messageId, category, description } = req.body;

      const VALID_CATEGORIES = ['SPAM','HARASSMENT','CHEATING','EXPLOITATION','HATE_SPEECH','OTHER'];
      if (!reportedId || !VALID_CATEGORIES.includes(category)) {
        res.status(400).json(apiError('INVALID_REPORT', 'Missing reportedId or invalid category'));
        return;
      }

      await pg.query(
        `INSERT INTO player_reports (id, reporter_id, reported_id, channel_id, message_id, category, description, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',NOW())`,
        [genId(), player.id, reportedId, channelId ?? null, messageId ?? null, category, (description ?? '').slice(0, 500)]
      );

      res.status(201).json(apiOk({ reported: true }));
    }
  );

  // ─── WEBSOCKET HUB ──────────────────────────────────────────────────────────

  setupWebSocketHub(wss, redis, mw, chat);

  // Error handler
  router.use(chatErrorHandler);

  return router;
}

// ─── WEBSOCKET HUB ────────────────────────────────────────────────────────────

interface WSClient {
  ws:          WebSocket;
  playerId:    string;
  displayName: string;
  rank:        string | null;
  title:       string | null;
  allianceId:  string | null;
  serverId:    string;
  subscribed:  Set<string>;   // channelIds currently subscribed
}

function setupWebSocketHub(
  wss:   WebSocketServer,
  redis: Redis,
  mw:    ReturnType<typeof createChatMiddleware>,
  chat:  ChatService,
): void {
  const clients = new Map<string, WSClient>();   // playerId → WSClient

  // Subscribe to Redis pub/sub — fan out to subscribed WS clients
  const sub = redis.duplicate();
  sub.psubscribe('chat:*');
  sub.on('pmessage', (_pattern, channel, message) => {
    // channel = "chat:{channelId}"
    const channelId = channel.replace('chat:', '');
    const event     = safeJson(message);
    if (!event) return;

    // Fan out to all clients subscribed to this channel
    for (const client of clients.values()) {
      if (client.subscribed.has(channelId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(event));
      }
    }
  });

  // Heartbeat to detect stale connections
  const heartbeat = setInterval(() => {
    for (const [playerId, client] of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) {
        clients.delete(playerId);
        redis.del(`presence:${playerId}`).catch(() => {});
      } else {
        client.ws.ping();
      }
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', async (ws: WebSocket, req) => {
    // Extract token from query string: ws://host/chat/ws?token=JWT
    const url   = new URL(req.url ?? '/', `http://localhost`);
    const token = url.searchParams.get('token');
    if (!token) { ws.close(4001, 'MISSING_TOKEN'); return; }

    const payload = await mw.authenticateWS(token);
    if (!payload) { ws.close(4001, 'INVALID_TOKEN'); return; }

    // Reject banned players at WS level
    const banned = await redis.get(`ban:account:${payload.sub}`);
    if (banned) { ws.close(4003, 'ACCOUNT_BANNED'); return; }

    const client: WSClient = {
      ws,
      playerId:    payload.sub,
      displayName: payload.name,
      rank:        payload.rank,
      title:       payload.title,
      allianceId:  payload.allianceId,
      serverId:    payload.serverId,
      subscribed:  new Set(),
    };

    clients.set(payload.sub, client);

    // Auto-subscribe to default channels
    const defaultChannels = buildDefaultChannels(payload);
    for (const ch of defaultChannels) {
      client.subscribed.add(ch);
    }

    // Update presence
    await redis.set(`presence:${payload.sub}`, 'ONLINE', 'EX', 90);

    ws.send(JSON.stringify({
      type: 'CONNECTED',
      data: { playerId: payload.sub, subscribedChannels: [...client.subscribed] },
    }));

    ws.on('message', async (rawData) => {
      const event = safeJson(rawData.toString());
      if (!event) return;

      switch (event.type) {

        case 'SUBSCRIBE': {
          const channelId = event.data?.channelId;
          if (!channelId) break;
          // Validate access before adding subscription
          const canAccess = await checkChannelAccessWS(channelId, client, redis, pg_);
          if (!canAccess) {
            ws.send(JSON.stringify({ type: 'ERROR', data: { code: 'ACCESS_DENIED', channelId } }));
            break;
          }
          client.subscribed.add(channelId);
          break;
        }

        case 'UNSUBSCRIBE': {
          const channelId = event.data?.channelId;
          if (channelId) client.subscribed.delete(channelId);
          break;
        }

        case 'PING':
          // Refresh presence
          await redis.set(`presence:${payload.sub}`, 'ONLINE', 'EX', 90);
          ws.send(JSON.stringify({ type: 'PONG', data: { timestamp: Date.now() } }));
          break;

        case 'TYPING': {
          // Broadcast typing indicator to channel (no persistence)
          const channelId = event.data?.channelId;
          if (!channelId) break;
          // Rate limit: 1 typing event per 3s per player per channel
          const rlKey = `rl:typing:${payload.sub}:${channelId}`;
          const rlHit = await redis.set(rlKey, '1', 'EX', 3, 'NX');
          if (!rlHit) break;
          await redis.publish(channelId, JSON.stringify({
            type: 'TYPING',
            data: { senderId: payload.sub, senderName: payload.name, channelId },
          }));
          break;
        }
      }
    });

    ws.on('close', async () => {
      clients.delete(payload.sub);
      // Mark as AWAY (not immediately offline — they may reconnect)
      await redis.set(`presence:${payload.sub}`, 'AWAY', 'EX', 300);
    });

    ws.on('pong', async () => {
      await redis.set(`presence:${payload.sub}`, 'ONLINE', 'EX', 90);
    });
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Placeholder for pg pool reference (inject via closure in production)
let pg_: Pool;

export function injectPg(pool: Pool): void {
  pg_ = pool;
}

function resolveChannelType(channelId: string, _allianceId: string | null): import('../../../shared/contracts/multiplayer').ChannelType {
  if (channelId === 'global')            return 'GLOBAL';
  if (channelId.startsWith('server_'))   return 'SERVER';
  if (channelId.startsWith('alliance_')) return 'ALLIANCE';
  if (channelId.startsWith('officer_'))  return 'ALLIANCE_OFFICER';
  if (channelId.startsWith('dm_'))       return 'DM';
  return 'ROOM';
}

function buildDefaultChannels(payload: { sub: string; allianceId: string | null; serverId: string }): string[] {
  const channels = ['global', `server_${payload.serverId}`];
  if (payload.allianceId) {
    channels.push(`alliance_${payload.allianceId}`);
  }
  return channels;
}

async function checkChannelAccessWS(
  channelId: string,
  client:    WSClient,
  redis:     Redis,
  pg:        Pool,
): Promise<boolean> {
  if (channelId === 'global' || channelId.startsWith('server_')) return true;

  if (channelId.startsWith('alliance_') || channelId.startsWith('officer_')) {
    const allianceId = channelId.replace(/^(alliance_|officer_)/, '');
    return client.allianceId === allianceId;
  }

  if (channelId.startsWith('dm_')) {
    return channelId.includes(client.playerId);
  }

  // Room: check membership
  const row = await pg.query(
    `SELECT 1 FROM chat_room_members WHERE user_id = $1 AND room_id = $2`,
    [client.playerId, channelId]
  );
  return row.rows.length > 0;
}

function safeJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); }
  catch { return null; }
}

function genId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

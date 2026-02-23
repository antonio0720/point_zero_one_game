/**
 * pzo-server/src/server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Production Express + Socket.io server
 * - Auth: JWT register/login/refresh
 * - WebSocket: authenticated rooms, chat broadcast, hater engine
 * - Hater Engine: listens to chat + player state, fires sabotage events
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ENV REQUIRED:
 *   DATABASE_URL   — postgres connection string
 *   JWT_SECRET     — random 64-char string (use: openssl rand -hex 64)
 *   PORT           — default 3001
 *   CLIENT_ORIGIN  — e.g. http://localhost:5173 (dev) or https://yourdomain.com (prod)
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { Pool } from 'pg';
import dotenv from 'dotenv';

import { createAuthRouter } from './auth/authRouter';
import { AuthService } from './auth/authService';
import { socketAuthMiddleware } from './auth/authMiddleware';
import { HaterEngine } from './haters/HaterEngine';
import type { PlayerSignal, HaterAction, SabotageCardType } from './haters/HaterEngine';

dotenv.config();

const PORT          = parseInt(process.env.PORT ?? '3001');
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

// ─── Database ─────────────────────────────────────────────────────────────────

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

db.on('error', (err) => console.error('[DB] Unexpected error:', err));

// ─── Express ──────────────────────────────────────────────────────────────────

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
app.use(cors({
  origin:      CLIENT_ORIGIN,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(cookieParser());
app.use(express.json({ limit: '128kb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────

const authService = new AuthService(db);
app.use('/auth', createAuthRouter(db));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Leaderboard (public)
app.get('/leaderboard', async (_req, res) => {
  try {
    const result = await db.query(
      'SELECT id, display_name, avatar_emoji, best_net_worth, total_freedom_runs, best_streak, rank FROM leaderboard LIMIT 100'
    );
    res.json({ entries: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
});

// ─── Hater Engine ─────────────────────────────────────────────────────────────

const haterEngine = new HaterEngine();

// ─── HTTP + Socket.io ─────────────────────────────────────────────────────────

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin:      CLIENT_ORIGIN,
    credentials: true,
    methods:     ['GET', 'POST'],
  },
  pingTimeout:  60_000,
  pingInterval: 25_000,
});

// Auth gate — all socket connections require valid JWT
io.use(socketAuthMiddleware(authService) as Parameters<typeof io.use>[0]);

// ─── Socket events ────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const userId      = (socket as typeof socket & { userId: string }).userId;
  const username    = (socket as typeof socket & { username: string }).username;
  const displayName = (socket as typeof socket & { displayName: string }).displayName;

  console.log(`[WS] Connected: ${username} (${userId})`);

  socket.join('global');

  // ── Player joins run ────────────────────────────────────────────────────

  socket.on('run:start', (data: { seed: number }) => {
    socket.join(`run:${userId}`);
    console.log(`[WS] ${username} started run seed=${data.seed}`);
  });

  // ── Player state sync (sent every ~10 ticks) ────────────────────────────

  socket.on('player:state', (signal: Omit<PlayerSignal, 'userId' | 'username'>) => {
    haterEngine.updatePlayerState({ ...signal, userId, username });
  });

  // ── Game events (forwarded from frontend tick engine) ───────────────────

  socket.on('game:event', (data: { event: string }) => {
    haterEngine.onGameEvent(data.event, userId);
  });

  // ── Chat: send message ──────────────────────────────────────────────────

  socket.on('chat:send', (data: { channel: string; body: string }) => {
    if (!data.body?.trim() || data.body.length > 280) return;

    const msg = {
      id:          `${userId}-${Date.now()}`,
      channel:     data.channel,
      kind:        'PLAYER' as const,
      senderId:    userId,
      senderName:  displayName || username,
      body:        data.body.trim(),
      ts:          Date.now(),
    };

    // Broadcast to channel
    io.to(data.channel === 'GLOBAL' ? 'global' : `room:${data.channel}`).emit('chat:message', msg);

    // Feed to hater engine (only global chat)
    if (data.channel === 'GLOBAL') {
      haterEngine.onChatMessage(data.body, username);
    }
  });

  // ── Run complete ────────────────────────────────────────────────────────

  socket.on('run:complete', async (data: {
    seed: number;
    ticksSurvived: number;
    finalCash: number;
    finalNetWorth: number;
    finalIncome: number;
    finalExpenses: number;
    outcome: 'FREEDOM' | 'BANKRUPT' | 'TIMEOUT' | 'ABANDONED';
    proofHash: string;
  }) => {
    const sabotages = haterEngine.getSabotageCount(userId);
    try {
      await authService.recordRunResult(
        userId,
        data.seed,
        data.ticksSurvived,
        data.finalCash,
        data.finalNetWorth,
        data.finalIncome,
        data.finalExpenses,
        data.outcome,
        data.proofHash,
        sabotages,
      );
    } catch (err) {
      console.error('[WS] Failed to save run:', err);
    }

    haterEngine.removePlayer(userId);
    socket.leave(`run:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Disconnected: ${username}`);
    haterEngine.removePlayer(userId);
  });
});

// ─── Hater Engine → Socket broadcast ─────────────────────────────────────────

haterEngine.on('taunt', (action: HaterAction) => {
  if (action.type !== 'TAUNT') return;

  const profile = haterEngine.getHaterProfile(action.haterId);

  // Broadcast taunt to global chat as a system message
  const msg = {
    id:          `hater-${action.haterId}-${Date.now()}`,
    channel:     'GLOBAL',
    kind:        'RIVAL_TAUNT' as const,
    senderId:    action.haterId,
    senderName:  profile?.displayName ?? action.haterId,
    senderRank:  profile?.rank ?? 'System Entity',
    body:        action.message,
    emoji:       profile?.avatar ?? '👁️',
    ts:          Date.now(),
  };

  io.to('global').emit('chat:message', msg);
});

haterEngine.on('sabotage', (action: HaterAction) => {
  if (action.type !== 'SABOTAGE') return;

  // Send sabotage card injection to the specific player
  io.to(`run:${action.targetUserId}`).emit('hater:sabotage', {
    haterId:   action.haterId,
    cardType:  action.cardType as SabotageCardType,
    intensity: action.intensity,
    haterName: haterEngine.getHaterProfile(action.haterId)?.displayName,
  });

  console.log(`[HATER] ${action.haterId} sabotaged ${action.targetUserId} with ${action.cardType} (x${action.intensity.toFixed(1)})`);
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  try {
    await db.query('SELECT 1'); // DB connectivity check
    console.log('[DB] Connected.');
  } catch (err) {
    console.error('[DB] Connection failed:', err);
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    console.log(`[SERVER] PZO running on port ${PORT}`);
    console.log(`[SERVER] Client origin: ${CLIENT_ORIGIN}`);
    console.log(`[SERVER] Haters online: ${haterEngine.getAllProfiles().map(h => h.id).join(', ')}`);
  });
}

start();

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — API SERVER
// pzo_engine/src/api/server.ts
//
// Production Express server. Transport layer between pzo_engine and pzo-web.
//
// WHAT THIS IS:
//   · HTTP boundary for the engine persistence layer (RunStore)
//   · Public read API for leaderboards, run lookups, proof artifacts
//   · Protected write API for completed run submission
//   · Replay verification endpoint (tamper detection)
//   · Card catalog query endpoint
//
// WHAT THIS IS NOT:
//   · A demo or tutorial server (that lives at pzo_engine/src/demo/)
//   · A game simulation server (the engine runs client-side in pzo-web)
//   · An auth server (delegated to bearer token middleware)
//
// ROUTES:
//   Public (no auth):
//     GET  /health                  → Service health + RunStore metrics
//     GET  /leaderboard             → Ranked run leaderboard
//     GET  /catalog                 → Card catalog stats
//     GET  /catalog/:cardId         → Single card definition
//     GET  /runs/:id                → Fetch run by ID
//     GET  /runs/:id/replay         → Replay integrity verification
//     GET  /runs/:id/proof          → Proof artifact retrieval
//
//   Protected (Bearer token — PZO_API_KEY):
//     POST /runs                    → Submit a completed run
//     GET  /runs/user/:userId       → All runs for a user
//
// ENV:
//   PORT              — HTTP port (default: 3001)
//   PZO_API_KEY       — Bearer token for protected routes
//   PZO_SERVER_URL    — Upstream pzo-server URL for HTTP persistence
//   PZO_SERVER_API_KEY — Upstream auth key
//   PZO_ML_PROOF_HASH — 'true' to enable ML proof hashes
//   PZO_AUDIT_HASH    — 'true' to enable HMAC audit hashes
//   PZO_AUDIT_HMAC_KEY — HMAC key when audit enabled
//   PZO_ENGINE_VERSION — Injected by build system
//
// STARTUP SEQUENCE:
//   1. Bind Express middleware stack
//   2. Mount routes
//   3. Start HTTP server
//   4. Hydrate RunStore from upstream pzo-server (non-blocking)
//
// Density6 LLC · Point Zero One · API Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import { getRunStore }    from '../persistence/run-store';
import { runsRouter }     from './routes/runs';
import { replayRouter }   from './routes/replay';
import { catalogRouter }  from './routes/catalog';
import { healthRouter }   from './routes/health';

// =============================================================================
// SECTION 1 — APP SETUP
// =============================================================================

const app  = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env['PZO_CORS_ORIGINS'] ?? 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods:     ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── BODY PARSING ──────────────────────────────────────────────────────────────
// 10MB limit — RunAccumulatorStats with 300+ tick snapshots can be large
app.use(express.json({ limit: '10mb' }));

// ── REQUEST LOGGING ───────────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction): void => {
  const ts   = new Date().toISOString();
  const line = `[${ts}] ${req.method} ${req.path}`;
  if (req.path !== '/health') {
    // Skip health check noise in logs
    console.info(line);
  }
  next();
});

// =============================================================================
// SECTION 2 — ROUTE MOUNTING
// =============================================================================

// Health — first, before all other middleware
app.use('/health', healthRouter);

// Card catalog — static, read-only
app.use('/catalog', catalogRouter);

// Leaderboard — mounted on runsRouter at /leaderboard sub-path
// (runsRouter handles /leaderboard via internal GET /leaderboard route)
app.get('/leaderboard', (req, res, next) => {
  req.url = '/leaderboard';
  runsRouter(req, res, next);
});

// Runs — both public (GET) and protected (POST)
app.use('/runs', runsRouter);

// Replay and proof sub-routes — must come after /runs
// These are nested under /runs/:id/replay and /runs/:id/proof
app.use('/runs/:id', replayRouter);

// =============================================================================
// SECTION 3 — 404 FALLBACK
// =============================================================================

app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    ok:    false,
    error: 'Route not found.',
    code:  'NOT_FOUND',
    ts:    Date.now(),
  });
});

// =============================================================================
// SECTION 4 — GLOBAL ERROR HANDLER
// =============================================================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  // CORS errors from the cors() middleware
  if (err.message.startsWith('Origin') && err.message.includes('CORS')) {
    res.status(403).json({
      ok:    false,
      error: err.message,
      code:  'FORBIDDEN',
      ts:    Date.now(),
    });
    return;
  }

  // JSON parse errors
  if ((err as NodeJS.ErrnoException).type === 'entity.parse.failed') {
    res.status(400).json({
      ok:    false,
      error: 'Invalid JSON in request body.',
      code:  'BAD_REQUEST',
      ts:    Date.now(),
    });
    return;
  }

  // Request body too large
  if ((err as NodeJS.ErrnoException).type === 'entity.too.large') {
    res.status(413).json({
      ok:    false,
      error: 'Request body too large. Maximum is 10MB.',
      code:  'BAD_REQUEST',
      ts:    Date.now(),
    });
    return;
  }

  // Unhandled error — log and return 500
  console.error('[server] Unhandled error:', err);
  res.status(500).json({
    ok:    false,
    error: 'Internal server error.',
    code:  'INTERNAL_ERROR',
    ts:    Date.now(),
  });
});

// =============================================================================
// SECTION 5 — STARTUP
// =============================================================================

async function start(): Promise<void> {
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.info(`
╔══════════════════════════════════════════════════════╗
║         POINT ZERO ONE · API SERVER                  ║
╠══════════════════════════════════════════════════════╣
║  Port:       ${String(PORT).padEnd(38)}║
║  Mode:       ${(process.env['NODE_ENV'] ?? 'development').padEnd(38)}║
║  ML Proof:   ${(process.env['PZO_ML_PROOF_HASH'] === 'true' ? 'ENABLED' : 'DISABLED').padEnd(38)}║
║  Audit Hash: ${(process.env['PZO_AUDIT_HASH'] === 'true' ? 'ENABLED' : 'DISABLED').padEnd(38)}║
║  Server URL: ${(process.env['PZO_SERVER_URL'] ?? 'in-memory only').padEnd(38)}║
╚══════════════════════════════════════════════════════╝`);
      resolve();
    });
  });
}

async function main(): Promise<void> {
  await start();

  // Non-blocking: hydrate leaderboard cache from upstream server
  const store = getRunStore();
  store.hydrateFromServer(200).catch((err) => {
    console.warn('[server] Hydration from upstream server failed:', err);
  });
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});

export { app };
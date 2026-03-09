// ═════════════:contentReference[oaicite:1]{index=1}══════════════════════════════════════
// POINT ZERO ONE — BACKEND ENTRY POINT
// backend/src/index.ts
//
// Sovereign Express server wiring every working route, middleware, game engine,
// event bus, database pool, and graceful shutdown handler.
//
// Architecture:
//   Express 4 + pg Pool (PgBouncer-ready) + BullMQ (Redis) + EventBus
//   No NestJS runtime — pure Express for control and transparency.
//
// Middleware chain (order matters):
//   1. correlationId    — attach X-Correlation-ID to every request
//   2. corsMiddleware   — CORS headers
//   3. securityHeaders  — HSTS, X-Frame-Options, etc.
//   4. requestLogger    — structured request logging
//   5. metricsCollector — latency + status code counters
//   6. express.json()   — body parsing (16kb limit for game payloads)
//   7. inputSanitizer   — DSL injection protection
//   8. authMiddleware   — JWT verification + device trust + rate limiting
//   9. [route handlers] — all mounted route groups
//  10. globalErrorHandler — catch-all error boundary (must be last)
//
// Density6 LLC · Point Zero One · Sovereign Infrastructure
// ═══════════════════════════════════════════════════════════════════════════════

import express, { type NextFunction, type Request, type Response } from 'express';
import http from 'node:http';

// ── Database ────────────────────────────────────────────────────────────────
import pool from './api-gateway/db/pool';

// ── Observability middleware ────────────────────────────────────────────────
import {
  correlationId,
  metricsCollector,
  requestLogger,
} from './api-gateway/middleware/observability';

// ── Security middleware ────────────────────────────────────────────────────
import {
  corsMiddleware,
  securityHeaders,
} from './api-gateway/middleware/security';

// ── Error handling ─────────────────────────────────────────────────────────
import { globalErrorHandler } from './api-gateway/middleware/errors';

// ── Auth middleware (JWT + device trust + rate limiting) ───────────────────
import { authMiddleware } from './middleware/auth_middleware';

// ── Input sanitizer (DSL injection protection) ─────────────────────────────
import { inputSanitizer } from './middleware/input_sanitizer';

// ── Event bus ──────────────────────────────────────────────────────────────
import EventBus from './events/event-bus';

// ── Game engine (deterministic run boundary) ───────────────────────────────
import {
  createRun,
  finalizeRun,
  getRunEvents,
  replayRun,
  submitTurnDecision,
} from './game/engine/index';

// ── Routes ─────────────────────────────────────────────────────────────────
import { healthRouter } from './api-gateway/routes/health.routes';
import commerceGovernanceRouter from './api-gateway/routes/commerce_governance_routes';
import createCreatorEconomyRoutes from './api-gateway/routes/creator_economy_routes';
import { curriculumRouter } from './api-gateway/routes/curriculum/index';
import institutionsRouter from './api-gateway/routes/institutions_routes';
import integrityRouter from './api-gateway/routes/integrity_routes';
import season0Router from './api-gateway/routes/season0_routes';

// ── Queue health (BullMQ) ──────────────────────────────────────────────────
import { getQueueHealth } from './queues/curriculum/index';

// ═══════════════════════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// ── Trust proxy (for X-Forwarded-For behind reverse proxy / PgBouncer) ────
app.set('trust proxy', 1);

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE CHAIN — ORDER MATTERS
// ═══════════════════════════════════════════════════════════════════════════════

// 1. Observability — must be first to capture full request lifecycle
app.use(correlationId);

// 2–3. Security headers + CORS
app.use(corsMiddleware);
app.use(securityHeaders);

// 4–5. Logging + metrics
app.use(requestLogger);
app.use(metricsCollector);

// 6. Body parsing — 16kb limit for game payloads, 1mb for admin/curriculum
app.use('/api/v1/curriculum', express.json({ limit: '1mb' }));
app.use('/api/v1/governance', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '16kb' }));

// 7. Input sanitizer — DSL injection protection for card forge / chat
app.use(inputSanitizer as express.RequestHandler);

// 8. Auth — JWT verification, device trust, rate limiting
//    Health routes are mounted BEFORE auth so they remain unauthenticated
app.use(healthRouter);

// Install auth on all subsequent routes
authMiddleware(app);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MOUNTING — GAME CORE
// ═══════════════════════════════════════════════════════════════════════════════

const gameRouter = express.Router();

// POST /api/v1/game/runs — create a new run
gameRouter.post(
  '/runs',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { seed, ledger } = req.body as {
        seed?: unknown;
        ledger?: unknown;
      };

      if (seed === undefined) {
        return res.status(400).json({ error: 'seed is required' });
      }

      // Validate and coerce seed to a number (Seed)
      let parsedSeed: number;
      if (typeof seed === 'number') {
        parsedSeed = seed;
      } else if (typeof seed === 'string' && /^\d+$/.test(seed)) {
        parsedSeed = Number(seed);
      } else {
        return res
          .status(400)
          .json({ error: 'seed must be a number or numeric string' });
      }

      // Validate ledger if present
      let parsedLedger: unknown = undefined;
      if (ledger !== undefined) {
        if (typeof ledger !== 'object' || ledger === null) {
          return res.status(400).json({ error: 'ledger must be an object' });
        }
        parsedLedger = ledger;
      }

      const runId = await createRun({
        seed: parsedSeed,
        ledger: parsedLedger as Partial<any>,
      });
      return res.status(201).json({ runId });
    } catch (err) {
      return next(err);
    }
  },
);

// POST /api/v1/game/runs/:runId/turns — submit a turn decision
gameRouter.post(
  '/runs/:runId/turns',
  async (
    req: Request<{ runId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { runId } = req.params;
      await submitTurnDecision(runId, req.body);
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  },
);

// POST /api/v1/game/runs/:runId/finalize — finalize a run
gameRouter.post(
  '/runs/:runId/finalize',
  async (
    req: Request<{ runId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { runId } = req.params;
      const result = await finalizeRun(runId);
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/v1/game/runs/:runId/replay — replay a run
gameRouter.get(
  '/runs/:runId/replay',
  async (
    req: Request<{ runId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { runId } = req.params;
      const result = await replayRun(runId);
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/v1/game/runs/:runId/events — get run events
gameRouter.get(
  '/runs/:runId/events',
  async (
    req: Request<{ runId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { runId } = req.params;
      const events = await getRunEvents(runId);
      return res.json({ events });
    } catch (err) {
      return next(err);
    }
  },
);

app.use('/api/v1/game', gameRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MOUNTING — SEASON 0 / FOUNDING ERA
// ═══════════════════════════════════════════════════════════════════════════════

app.use('/api/v1/season0', season0Router);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MOUNTING — INTEGRITY & VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

app.use('/api/v1/integrity', integrityRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MOUNTING — INSTITUTIONS (B2B)
// ═══════════════════════════════════════════════════════════════════════════════

app.use('/api/v1/institutions', institutionsRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MOUNTING — CURRICULUM (B2B LICENSING CONTROL PLANE)
// ═══════════════════════════════════════════════════════════════════════════════

app.use('/api/v1/curriculum', curriculumRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MOUNTING — MONETIZATION GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════════════

app.use('/api/v1/governance', commerceGovernanceRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MOUNTING — CREATOR ECONOMY
// ═══════════════════════════════════════════════════════════════════════════════

app.use('/api/v1/creators', createCreatorEconomyRoutes({} as never));

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MOUNTING — DATABASE-DIRECT QUERY ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

const dbRouter = express.Router();

// GET /api/v1/db/modes — list canonical game modes from contract table
dbRouter.get(
  '/modes',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `
        SELECT
          code,
          display_alias,
          display_name,
          tagline,
          icon,
          min_players,
          max_players
        FROM game.contract_game_modes
        WHERE is_active = true
        ORDER BY code
        `,
      );

      return res.json({ modes: result.rows });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/v1/db/timing-classes — list canonical timing classes
dbRouter.get(
  '/timing-classes',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `
        SELECT
          code,
          description,
          mode_scope,
          window_default_ms
        FROM game.contract_timing_classes
        ORDER BY code
        `,
      );

      return res.json({ timingClasses: result.rows });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/v1/db/bots — list canonical bot profiles
dbRouter.get(
  '/bots',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `
        SELECT
          code,
          display_name,
          personality,
          attack_vector
        FROM game.contract_bot_profiles
        ORDER BY code
        `,
      );

      return res.json({ bots: result.rows });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/v1/db/schema-census — table counts per schema
dbRouter.get(
  '/schema-census',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(`
        SELECT schemaname AS schema, COUNT(*)::int AS tables
        FROM pg_tables
        WHERE schemaname IN ('public', 'game', 'economy', 'social', 'analytics', 'b2b')
        GROUP BY schemaname
        ORDER BY schemaname
      `);

      return res.json({ schemas: result.rows });
    } catch (err) {
      return next(err);
    }
  },
);

app.use('/api/v1/db', dbRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/system/queues — BullMQ queue health
app.get(
  '/api/v1/system/queues',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const health = await getQueueHealth();
      return res.json({ queues: health });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/v1/system/info — server identity
app.get('/api/v1/system/info', (_req: Request, res: Response) => {
  res.json({
    service: 'pzo-backend',
    version: process.env.npm_package_version ?? '0.1.0',
    node_env: NODE_ENV,
    port: PORT,
    database: 'connected',
    uptime: process.uptime(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FUTURE ROUTE PLACEHOLDERS
// ═══════════════════════════════════════════════════════════════════════════════
// These routes exist as .broken files in the codebase and should be restored
// as each subsystem is production-hardened:
//
//   /api/v1/appeals            — appeals_routes.broken.ts
//   /api/v1/ladders            — ladder_routes.broken.ts
//   /api/v1/liveops            — liveops_routes.broken.ts
//   /api/v1/loss               — loss_is_content_routes.broken.ts
//   /api/v1/monetization       — monetization_routes.broken.ts
//   /api/v1/monetization/admin — monetization_admin_routes.broken.ts
//   /api/v1/onboarding         — onboarding_routes.broken.ts
//   /api/v1/partners           — partner_routes.broken.ts
//   /api/v1/proof-stamps       — proof_stamp_routes.broken.ts
//   /api/v1/public-integrity   — public_integrity_routes.broken.ts
//   /api/v1/explorer           — run_explorer_routes.broken.ts
//   /api/v1/telemetry          — telemetry_routes.broken.ts

// ═══════════════════════════════════════════════════════════════════════════════
// 404 CATCH-ALL
// ═══════════════════════════════════════════════════════════════════════════════

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `${req.method} ${req.path} does not exist`,
    hint: 'GET /health/live for health check, GET /api/v1/system/info for server identity',
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER — MUST BE LAST
// ═══════════════════════════════════════════════════════════════════════════════

app.use(globalErrorHandler);

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER START + GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════════

const server = http.createServer(app);

async function startServer(): Promise<void> {
  // Verify database connection before accepting traffic
  try {
    const dbResult = await pool.query(
      'SELECT current_database() AS db, current_user AS usr',
    );
    const { db, usr } = dbResult.rows[0] as { db: string; usr: string };
    console.log(`[pzo-backend] database connected: ${db} as ${usr}`);
  } catch (err) {
    console.error('[pzo-backend] FATAL: cannot connect to database', err);
    process.exit(1);
  }

  // Verify schema exists
  try {
    const schemaResult = await pool.query(`
      SELECT COUNT(*)::int AS table_count
      FROM pg_tables
      WHERE schemaname IN ('public', 'game', 'economy', 'social', 'analytics', 'b2b')
    `);

    const tableCount = Number(
      (schemaResult.rows[0] as { table_count: number | string }).table_count,
    );

    console.log(
      `[pzo-backend] schema verified: ${tableCount} tables across 6 schemas`,
    );

    if (tableCount < 80) {
      console.warn(
        `[pzo-backend] WARNING: expected 97+ tables, found ${tableCount}. Run migrations.`,
      );
    }
  } catch (err) {
    console.warn(
      '[pzo-backend] schema verification skipped:',
      (err as Error).message,
    );
  }

  server.listen(PORT, () => {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  POINT ZERO ONE — SOVEREIGN BACKEND');
    console.log(`  Density6 LLC · ${NODE_ENV} · port ${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('  Routes mounted:');
    console.log('    GET  /health/live                   — liveness probe');
    console.log('    GET  /health/ready                  — readiness probe (DB check)');
    console.log('    GET  /health/metrics                — observability metrics');
    console.log('');
    console.log('    POST /api/v1/game/runs              — create a run');
    console.log('    POST /api/v1/game/runs/:id/turns    — submit turn decision');
    console.log('    POST /api/v1/game/runs/:id/finalize — finalize run');
    console.log('    GET  /api/v1/game/runs/:id/replay   — replay run');
    console.log('    GET  /api/v1/game/runs/:id/events   — get run events');
    console.log('');
    console.log('    *    /api/v1/season0/*              — Season 0 / Founding Era');
    console.log('    *    /api/v1/integrity/*            — Integrity & verification');
    console.log('    *    /api/v1/institutions/*         — B2B institutions');
    console.log('    *    /api/v1/curriculum/*           — Curriculum control plane');
    console.log('    *    /api/v1/governance/*           — Monetization governance');
    console.log('    *    /api/v1/creators/*             — Creator economy');
    console.log('');
    console.log('    GET  /api/v1/db/modes               — canonical game modes');
    console.log('    GET  /api/v1/db/timing-classes      — canonical timing classes');
    console.log('    GET  /api/v1/db/bots                — canonical bot profiles');
    console.log('    GET  /api/v1/db/schema-census       — table counts per schema');
    console.log('');
    console.log('    GET  /api/v1/system/queues          — BullMQ queue health');
    console.log('    GET  /api/v1/system/info            — server identity');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  });
}

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[pzo-backend] ${signal} received — starting graceful shutdown...`);

  // 1. Stop accepting new connections
  await new Promise<void>((resolve) => {
    server.close(() => {
      console.log('[pzo-backend] HTTP server closed');
      resolve();
    });
  });

  // 2. Drain database pool
  try {
    await pool.end();
    console.log('[pzo-backend] database pool drained');
  } catch (err) {
    console.error('[pzo-backend] error draining database pool:', err);
  }

  // 3. Clear event bus listeners and detach external publisher
  try {
    const removedListenerCount = EventBus.listenerCount();
    EventBus.setPublisher(null);
    EventBus.clear();
    console.log(
      `[pzo-backend] event bus cleared (${removedListenerCount} listener(s) removed)`,
    );
  } catch (err) {
    console.error('[pzo-backend] error clearing event bus:', err);
  }

  console.log('[pzo-backend] shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

// Unhandled rejection / exception safety nets
process.on('unhandledRejection', (reason, promise) => {
  console.error(
    '[pzo-backend] unhandled rejection at:',
    promise,
    'reason:',
    reason,
  );
});

process.on('uncaughtException', (error) => {
  console.error('[pzo-backend] uncaught exception:', error);
  void gracefulShutdown('uncaughtException');
});

// ── Start ──────────────────────────────────────────────────────────────────
startServer().catch((err) => {
  console.error('[pzo-backend] FATAL: failed to start server', err);
  process.exit(1);
});

export default app;
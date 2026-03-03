// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — API ROUTES — HEALTH
// pzo_engine/src/api/routes/health.ts
//
// Routes:
//   GET /health   → Service health (public, unauthenticated)
//
// Used by:
//   · Uptime monitors (Render, Railway, etc.)
//   · pzo-web frontend to detect server connectivity
//   · ORBIT automation agents polling infrastructure status
//
// Density6 LLC · Point Zero One · API Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { getRunStore }                from '../persistence/run-store';
import type { HealthResponse }        from './types';

export const healthRouter = Router();

const SERVER_START = Date.now();

// Package version read once at startup
function getVersion(): string {
  try {
    const pkg = require('../../../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const VERSION        = getVersion();
const ENGINE_VERSION = process.env['PZO_ENGINE_VERSION'] ?? 'unknown';

// =============================================================================
// GET /health
// =============================================================================

healthRouter.get(
  '/',
  (req: Request, res: Response): void => {
    const store  = getRunStore();
    const health = store.getHealth();

    const degraded =
      !health.serverConnected && !!process.env['PZO_SERVER_URL'] ||
      health.retryQueueDepth > 10;

    const status: HealthResponse['status'] = degraded ? 'degraded' : 'ok';

    const response: HealthResponse = {
      status,
      uptime:            Math.floor((Date.now() - SERVER_START) / 1000),
      totalRunsSaved:    health.totalRunsSaved,
      totalRunsFailed:   health.totalRunsFailed,
      retryQueueDepth:   health.retryQueueDepth,
      serverConnected:   health.serverConnected,
      lastSaveAt:        health.lastSaveAt,
      lastFailureAt:     health.lastFailureAt,
      lastFailureReason: health.lastFailureReason,
      mlEnabled:         health.mlEnabled,
      auditEnabled:      health.auditEnabled,
      version:           VERSION,
      engineVersion:     ENGINE_VERSION,
    };

    const statusCode = status === 'ok' ? 200 : 207;
    res.status(statusCode).json({ ok: true, data: response, ts: Date.now() });
  }
);
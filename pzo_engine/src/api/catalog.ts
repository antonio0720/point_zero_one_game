// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — API ROUTES — CATALOG
// pzo_engine/src/api/routes/catalog.ts
//
// Routes:
//   GET /catalog           → Card catalog stats (public)
//   GET /catalog/:cardId   → Single card definition (public)
//
// The catalog is read-only and public — it's educational content.
// It is used by the pzo-web frontend to render card descriptions,
// by the demo system to explain cards during tutorial mode,
// and by the engine to verify card IDs on run submission.
//
// Density6 LLC · Point Zero One · API Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import type { CatalogStatsResponse }  from './types';

export const catalogRouter = Router();

// =============================================================================
// LAZY CATALOG LOADER
// Defers the catalog import until first request so the server starts fast.
// =============================================================================

let catalogLoaded = false;

function ensureCatalogLoaded(): void {
  if (catalogLoaded) return;
  try {
    // Side-effect import — initializes the singleton CatalogLoader on first call
    require('../../cards/loader');
    catalogLoaded = true;
  } catch (err) {
    console.error('[CatalogRoute] Failed to load card catalog:', err);
  }
}

function getCatalogApi(): ReturnType<typeof import('../cards/loader')['getCatalogStats']> extends (...args: unknown[]) => infer R ? () => R : never {
  // Dynamic require after lazy-load
  const loader = require('../../cards/loader') as typeof import('../cards/loader');
  return loader.getCatalogStats as never;
}

function getCardDefinitionFn(): typeof import('../cards/loader')['getCardDefinition'] {
  const loader = require('../../cards/loader') as typeof import('../cards/loader');
  return loader.getCardDefinition;
}

// =============================================================================
// GET /catalog — Catalog stats snapshot
// =============================================================================

catalogRouter.get(
  '/',
  (req: Request, res: Response): void => {
    ensureCatalogLoaded();

    try {
      const getStats = getCatalogApi();
      const stats    = (getStats as () => Record<string, unknown>)();

      const response: CatalogStatsResponse = {
        totalCards:  (stats['totalCards'] as number) ?? 0,
        byDeck:      (stats['byDeck'] as Record<string, number>) ?? {},
        version:     (stats['version'] as string) ?? '2.0.0',
        generatedAt: (stats['generatedAt'] as string) ?? new Date().toISOString(),
      };

      res.json({ ok: true, data: response, ts: Date.now() });
    } catch (err) {
      res.status(503).json({
        ok:    false,
        error: 'Card catalog not available.',
        code:  'SERVICE_UNAVAILABLE',
        ts:    Date.now(),
      });
    }
  }
);

// =============================================================================
// GET /catalog/:cardId — Single card definition
// =============================================================================

catalogRouter.get(
  '/:cardId',
  (req: Request, res: Response): void => {
    ensureCatalogLoaded();

    const cardId = req.params['cardId'];

    if (!cardId) {
      res.status(400).json({ ok: false, error: 'cardId is required.', code: 'BAD_REQUEST', ts: Date.now() });
      return;
    }

    try {
      const getCard = getCardDefinitionFn();
      const card    = getCard(cardId);

      if (!card) {
        res.status(404).json({
          ok:    false,
          error: `Card ${cardId} not found in catalog.`,
          code:  'NOT_FOUND',
          ts:    Date.now(),
        });
        return;
      }

      res.json({ ok: true, data: card, ts: Date.now() });
    } catch (err) {
      res.status(503).json({
        ok:    false,
        error: 'Card catalog not available.',
        code:  'SERVICE_UNAVAILABLE',
        ts:    Date.now(),
      });
    }
  }
);
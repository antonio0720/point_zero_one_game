// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARDS LAYER BARREL EXPORT
// pzo_engine/src/cards/index.ts
//
// Single import entry point for all card data in pzo_engine.
//
// IMPORT PATTERN:
//   import { getCardDefinition, getDrawableCards } from '../cards';
//   import { adaptCard } from '../cards';
//   import type { CardDefinition } from '../cards';
//
// Density6 LLC · Point Zero One · pzo_engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

// ── Data access API ──────────────────────────────────────────────────────────
export {
  getCardDefinition,
  getDrawableCards,
  getCardsByDeck,
  getAllCards,
  getCatalogStats,
  reloadCatalog,
} from './loader';

// ── Adapter (JSON → engine format) ──────────────────────────────────────────
export { adaptCard, adaptCards } from './catalog-adapter';

// ── Raw catalog types (for tools + scripts) ──────────────────────────────────
export type {
  CatalogCard,
  CatalogDeckType,
  CatalogEconomics,
  CatalogEffect,
  CatalogBuff,
  CatalogAsset,
  CatalogIpa,
  PzoCatalog,
  PzoDecks,
  PzoIds,
} from './catalog-types';
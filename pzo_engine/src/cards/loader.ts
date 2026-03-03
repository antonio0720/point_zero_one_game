// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD LOADER (REWRITTEN)
// pzo_engine/src/cards/loader.ts
//
// Previous version was a broken stub referencing non-existent files:
//   ✗ import { Card } from '../cards/card'          — file never existed
//   ✗ import { CatalogDeck } from './catalog-deck'  — file never existed
//   ✗ import { TemplateLookup } ...                 — file never existed
//   ✗ import { SeedableShuffle } ...                — file never existed
//   ✗ if (!mlEnabled)                               — undefined variable
//
// This rewrite is the correct thin re-export layer.
// All logic lives in catalog-loader.ts.
// This file is kept as the canonical import point for external consumers.
//
// USAGE:
//   import { getCardDefinition, getDrawableCards } from './loader';
//
// Density6 LLC · Point Zero One · pzo_engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

export {
  getCardDefinition,
  getDrawableCards,
  getCardsByDeck,
  getAllCards,
  getCatalogStats,
  reloadCatalog,
} from './catalog-loader';

export { adaptCard, adaptCards }       from './catalog-adapter';
export type { CatalogCard, PzoCatalog } from './catalog-types';
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CATALOG LOADER
// pzo_engine/src/cards/catalog-loader.ts
//
// Loads pzo_catalog.json into memory and exposes typed query functions.
// This is the file loader.ts re-exports from. It was missing — now it exists.
//
// Density6 LLC · Point Zero One · pzo_engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PzoCatalog, CatalogCard, CatalogDeckType } from './catalog-types';

// ── Resolve catalog path (works for both ESM and CJS) ────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const CATALOG_PATH = join(__dirname, 'pzo_catalog.json');

// ── Singleton catalog state ───────────────────────────────────────────────────

let _catalog: PzoCatalog | null = null;

function loadCatalog(): PzoCatalog {
  if (_catalog) return _catalog;
  try {
    const raw = readFileSync(CATALOG_PATH, 'utf-8');
    _catalog = JSON.parse(raw) as PzoCatalog;
    console.log(`[CatalogLoader] Loaded ${_catalog.totalCards} cards (v${_catalog.version})`);
    return _catalog;
  } catch (err) {
    throw new Error(`[CatalogLoader] Failed to load pzo_catalog.json: ${(err as Error).message}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a single card by ID. Returns undefined if not found.
 */
export function getCardDefinition(id: string): CatalogCard | undefined {
  const catalog = loadCatalog();
  return catalog.cards.find(c => c.id === id);
}

/**
 * Get all cards that can be drawn (all cards in catalog).
 * Optionally filter by deck type.
 */
export function getDrawableCards(deck?: CatalogDeckType): CatalogCard[] {
  const catalog = loadCatalog();
  if (deck) return catalog.cards.filter(c => c.deck === deck);
  return catalog.cards;
}

/**
 * Get all cards belonging to a specific deck, keyed by ID.
 */
export function getCardsByDeck(deck: CatalogDeckType): CatalogCard[] {
  const catalog = loadCatalog();
  return catalog.cards.filter(c => c.deck === deck);
}

/**
 * Get the full card array.
 */
export function getAllCards(): CatalogCard[] {
  const catalog = loadCatalog();
  return catalog.cards;
}

/**
 * Get catalog metadata without loading all cards.
 */
export function getCatalogStats(): {
  version: string;
  generatedAt: string;
  totalCards: number;
  deckCounts: Record<CatalogDeckType, number>;
} {
  const catalog = loadCatalog();
  return {
    version:     catalog.version,
    generatedAt: catalog.generatedAt,
    totalCards:  catalog.totalCards,
    deckCounts:  catalog.deckCounts,
  };
}

/**
 * Force reload catalog from disk (useful for hot-reload in dev).
 */
export function reloadCatalog(): PzoCatalog {
  _catalog = null;
  return loadCatalog();
}

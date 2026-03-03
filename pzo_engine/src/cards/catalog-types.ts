// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD CATALOG TYPES
// pzo_engine/src/cards/catalog-types.ts
//
// TypeScript interfaces that describe the shape of pzo_catalog.json exactly.
// These are the RAW JSON types — not the engine CardDefinition types.
// CatalogAdapter converts these into CardDefinition (engines/cards/types.ts).
//
// RULES:
//   ✦ Zero imports. Mirrors JSON exactly.
//   ✦ Never modify these to match the engine — that's CatalogAdapter's job.
//   ✦ If pzo_catalog.json schema changes, update here FIRST.
//
// Density6 LLC · Point Zero One · pzo_engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

// ── Top-level catalog structure ───────────────────────────────────────────────

export interface PzoCatalog {
  version:     string;
  generatedAt: string;
  totalCards:  number;
  deckCounts:  Record<CatalogDeckType, number>;
  cards:       CatalogCard[];
}

// ── Deck types as they appear in JSON ─────────────────────────────────────────

export type CatalogDeckType =
  | 'OPPORTUNITY'
  | 'IPA'
  | 'FUBAR'
  | 'PRIVILEGED'
  | 'SO'
  | 'MISSED_OPPORTUNITY';

// ── Card shape in JSON ────────────────────────────────────────────────────────

export interface CatalogCard {
  id:         string;           // e.g. 'pzo_opportunity_222cc488c4'
  deck:       CatalogDeckType;
  subtype:    string;           // e.g. 'BIG_DEAL', 'DOODAD', 'LOAN_DENIAL'
  title:      string;
  text:       string;           // full educational/flavor text
  economics?: CatalogEconomics; // OPPORTUNITY + IPA only
  effects:    CatalogEffect[];
  tags:       string[];
}

// ── Card economics (OPPORTUNITY / IPA) ───────────────────────────────────────

export interface CatalogEconomics {
  assetKind?:       string;  // 'REAL_ESTATE', 'BUSINESS', 'PAPER_ASSET'
  cost?:            number;  // purchase price
  debtLabel?:       string;  // 'MORTGAGE', 'LOAN', etc.
  debt?:            number;
  downPayment?:     number;
  cashflowMonthly?: number;
  roiPct?:          number;
  exitMin?:         number;
  exitMax?:         number;
  setupCost?:       number;  // IPA cards
}

// ── Effect operations (raw from JSON) ─────────────────────────────────────────

export type CatalogEffectOp =
  | 'CASH_ADD'
  | 'BUFF_ADD'
  | 'PROMPT_BUY_OR_PASS'
  | 'PROMPT_BUY_OR_PASS_IPA'
  | 'ON_BUY_ADD_ASSET'
  | 'ON_BUY_ADD_IPA'
  | 'PROMPT_FORCED_SALE'
  | 'TURNS_SKIP'
  | 'DRAW_OPPORTUNITY_PICK_BEST'
  | 'NEXT_OPPORTUNITY_OPEN_TO_TABLE';

export interface CatalogEffect {
  op:      CatalogEffectOp;
  amount?: number;            // CASH_ADD
  count?:  number;            // DRAW_OPPORTUNITY_PICK_BEST, TURNS_SKIP
  buff?:   CatalogBuff;       // BUFF_ADD
  asset?:  CatalogAsset;      // ON_BUY_ADD_ASSET
  ipa?:    CatalogIpa;        // ON_BUY_ADD_IPA
}

export interface CatalogBuff {
  type:      CatalogBuffType;
  uses?:     number;
  amount?:   number;          // DOWNPAY_CREDIT: dollar amount
  cancels?:  string[];        // SHIELD: ['FUBAR', 'SO']
}

export type CatalogBuffType =
  | 'SHIELD'
  | 'DOWNPAY_CREDIT'
  | 'LEVERAGE_BLOCK'
  | 'RATE_DISCOUNT';

export interface CatalogAsset {
  name:             string;
  kind:             string;
  cost:             number;
  debt:             number;
  cashflowMonthly:  number;
}

export interface CatalogIpa {
  name:             string;
  cost:             number;
  cashflowMonthly:  number;
}

// ── IDs file ──────────────────────────────────────────────────────────────────

export interface PzoIds {
  version:    string;
  ids:        string[];
  idsByDeck:  Record<CatalogDeckType, string[]>;
}

// ── Decks file ────────────────────────────────────────────────────────────────

export interface PzoDecks {
  version:    string;
  generatedAt:string;
  decks:      Record<CatalogDeckType, string[]>;
}
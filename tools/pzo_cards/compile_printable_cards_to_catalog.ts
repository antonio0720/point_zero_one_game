/**
 * T00426 — compile_printable_cards_to_catalog.ts
 * Compiles Point_Zero_One_Printable_Cards_Enhanced.md
 *   → pzo_engine/src/cards/catalog.json   (full card objects)
 *   → pzo_engine/src/cards/decks.json     (cards grouped by deck type)
 *   → pzo_engine/src/cards/ids.json       (stable deterministic IDs)
 *
 * Rules: deterministic IDs, no dupes, strict JSON parse of Econ blocks
 *
 * Deploy to: tools/pzo_cards/compile_printable_cards_to_catalog.ts
 * Run:  ts-node tools/pzo_cards/compile_printable_cards_to_catalog.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardType =
  | 'OPPORTUNITY'
  | 'IPA'
  | 'FUBAR'
  | 'MISSED_OPPORTUNITY'
  | 'PRIVILEGED'
  | 'SO';

export interface EconBlock {
  assetKind?: 'REAL_ESTATE' | 'BUSINESS';
  cost?: number;
  debtLabel?: 'MORTGAGE' | 'LIABILITY';
  debt?: number;
  downPayment?: number;
  cashflowMonthly?: number;
  roiPct?: number;
  exitMin?: number;
  exitMax?: number;
  setupCost?: number;
  cashImpact?: number;
  turnsLost?: number;
  value?: number;
  [key: string]: unknown;
}

export interface CardEntry {
  id: string;            // e.g. pzo_opportunity_222cc488c4
  type: CardType;
  subtype: string | null;
  name: string;
  description: string;
  econ: EconBlock | null;
  rawEconStr: string | null;
  sourceLineHint: number;
}

export interface CatalogOutput {
  version: string;
  generatedAt: string;
  totalCards: number;
  cards: CardEntry[];
}

export interface DecksOutput {
  version: string;
  generatedAt: string;
  decks: Record<CardType, string[]>; // type → [card ids]
}

export interface IdsOutput {
  version: string;
  generatedAt: string;
  ids: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VERSION = '1.0.0';

const CARD_TYPE_PATTERNS: Array<{ pattern: RegExp; type: CardType }> = [
  { pattern: /\*OPPORTUNITY\b/i,        type: 'OPPORTUNITY' },
  { pattern: /\*IPA\b/i,               type: 'IPA' },
  { pattern: /\*FUBAR\b/i,             type: 'FUBAR' },
  { pattern: /\*MISSED_OPPORTUNITY\b/i, type: 'MISSED_OPPORTUNITY' },
  { pattern: /\*PRIVILEGED\b/i,         type: 'PRIVILEGED' },
  { pattern: /\bSO\b.*card\b/i,         type: 'SO' },
];

const ID_PATTERN = /ID:\s*(pzo_[\w]+)/i;
const ECON_PATTERN = /Econ:\s*(\{[\s\S]*?\})/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deterministicId(type: CardType, name: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${type.toLowerCase()}:${name.toLowerCase().trim()}`)
    .digest('hex')
    .slice(0, 10);
  return `pzo_${type.toLowerCase()}_${hash}`;
}

function parseEcon(raw: string): EconBlock | null {
  try {
    // Strip escaped quotes and normalize
    const cleaned = raw
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\/\/.*$/gm, '') // strip inline comments
      .replace(/,\s*\}/g, '}');  // trailing commas
    return JSON.parse(cleaned) as EconBlock;
  } catch {
    // Try extracting just the JSON portion
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(
        match[0].replace(/\\"/g, '"').replace(/\/\/.*$/gm, '').replace(/,\s*\}/g, '}'),
      ) as EconBlock;
    } catch {
      return null;
    }
  }
}

function detectCardType(block: string): CardType | null {
  for (const { pattern, type } of CARD_TYPE_PATTERNS) {
    if (pattern.test(block)) return type;
  }
  return null;
}

function extractName(block: string): string | null {
  // Bold title pattern: **Card Name**
  const bold = block.match(/\*\*([^*]+)\*\*/);
  if (bold) return bold[1].trim();
  // Markdown heading
  const heading = block.match(/^#+\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return null;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseMarkdownFile(content: string): CardEntry[] {
  const cards: CardEntry[] = [];
  const seenIds = new Set<string>();
  const lines = content.split('\n');

  // Split into "table cells" — cards appear in Markdown table rows delimited by | ... |
  // Each cell may span multiple lines; we split on +===+ and +---+ separators
  const rawBlocks: string[] = [];

  // Strategy: split on "| ID: pzo_..." boundaries to isolate card blocks
  let currentBlock = '';
  let lineIdx = 0;

  for (const line of lines) {
    lineIdx++;
    const idMatch = line.match(ID_PATTERN);

    if (idMatch) {
      // Finalize current block, attach the ID line
      currentBlock += '\n' + line;
      rawBlocks.push(currentBlock.trim());
      currentBlock = '';
    } else {
      currentBlock += '\n' + line;
    }
  }

  // Also push any trailing block
  if (currentBlock.trim()) rawBlocks.push(currentBlock.trim());

  // Process each block
  for (const block of rawBlocks) {
    const idMatch = block.match(ID_PATTERN);
    const parsedId = idMatch ? idMatch[1].trim() : null;

    const cardType = detectCardType(block);
    if (!cardType || !parsedId) continue;

    const name = extractName(block);
    if (!name) continue;

    // Stable deterministic ID — use declared ID if it matches pattern, else re-derive
    const stableId = parsedId.startsWith('pzo_') ? parsedId : deterministicId(cardType, name);

    // Deduplicate
    if (seenIds.has(stableId)) continue;
    seenIds.add(stableId);

    // Econ block
    const econRaw = block.match(ECON_PATTERN);
    const rawEconStr = econRaw ? econRaw[1] : null;
    const econ = rawEconStr ? parseEcon(rawEconStr) : null;

    // Description: text between type marker and Econ block
    const descMatch = block.match(/\*[A-Z_/ ]+\*\n+([\s\S]+?)(?:Econ:|ID:|$)/);
    const description = descMatch
      ? descMatch[1].replace(/[|\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
      : '';

    // Subtype (e.g. BIG_DEAL from "OPPORTUNITY / BIG_DEAL")
    const subtypeMatch = block.match(/[A-Z_]+\s*\/\s*([A-Z_]+)/);
    const subtype = subtypeMatch ? subtypeMatch[1] : null;

    cards.push({
      id: stableId,
      type: cardType,
      subtype,
      name,
      description,
      econ,
      rawEconStr,
      sourceLineHint: 0,
    });
  }

  return cards;
}

// ─── Catalog Builder ──────────────────────────────────────────────────────────

function buildCatalog(cards: CardEntry[]): CatalogOutput {
  return {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    totalCards: cards.length,
    cards,
  };
}

function buildDecks(cards: CardEntry[]): DecksOutput {
  const decks: Record<CardType, string[]> = {
    OPPORTUNITY: [],
    IPA: [],
    FUBAR: [],
    MISSED_OPPORTUNITY: [],
    PRIVILEGED: [],
    SO: [],
  };

  for (const card of cards) {
    decks[card.type].push(card.id);
  }

  return {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    decks,
  };
}

function buildIds(cards: CardEntry[]): IdsOutput {
  return {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    ids: cards.map(c => c.id),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const INPUT_FILE = path.resolve(
    __dirname,
    '../../logic_docs/Point_Zero_One_Printable_Cards_Enhanced.md',
  );
  const OUTPUT_DIR = path.resolve(__dirname, '../../pzo_engine/src/cards');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`[ERROR] Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const content = fs.readFileSync(INPUT_FILE, 'utf-8');
  const cards = parseMarkdownFile(content);

  if (cards.length === 0) {
    console.error('[ERROR] No cards parsed — check input file format');
    process.exit(1);
  }

  const catalog = buildCatalog(cards);
  const decks = buildDecks(cards);
  const ids = buildIds(cards);

  const catalogPath = path.join(OUTPUT_DIR, 'catalog.json');
  const decksPath = path.join(OUTPUT_DIR, 'decks.json');
  const idsPath = path.join(OUTPUT_DIR, 'ids.json');

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  fs.writeFileSync(decksPath, JSON.stringify(decks, null, 2));
  fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2));

  console.log(`[OK] Parsed ${cards.length} cards`);
  console.log(`     OPPORTUNITY: ${decks.decks.OPPORTUNITY.length}`);
  console.log(`     IPA: ${decks.decks.IPA.length}`);
  console.log(`     FUBAR: ${decks.decks.FUBAR.length}`);
  console.log(`     MISSED_OPPORTUNITY: ${decks.decks.MISSED_OPPORTUNITY.length}`);
  console.log(`     PRIVILEGED: ${decks.decks.PRIVILEGED.length}`);
  console.log(`     SO: ${decks.decks.SO.length}`);
  console.log(`[OK] Written: ${catalogPath}`);
  console.log(`[OK] Written: ${decksPath}`);
  console.log(`[OK] Written: ${idsPath}`);
}

main();

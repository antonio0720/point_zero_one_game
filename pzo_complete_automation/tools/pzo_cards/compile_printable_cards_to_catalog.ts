/**
 * Compile Point_Zero_One_Printable_Cards_Enhanced.md → catalog.json + decks.json + ids.json
 * PZO_T00426 | Phase: PZO_P01_ENGINE_UPGRADE
 * File: tools/pzo_cards/compile_printable_cards_to_catalog.ts
 * Deterministic IDs, no dupes
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────────
export interface PZOCard {
  id: string;             // deterministic: sha256(name+type) first 8 hex chars
  name: string;
  type: CardType;
  cost: number;
  leverage: number;
  description: string;
  deckId: string;
  mechanicIds: string[];
  tags: string[];
  printIndex: number;     // original order in .md file
}

export type CardType = 'asset' | 'action' | 'event' | 'mechanic' | 'persona' | 'market';

export interface CardCatalog {
  version: string;
  compiledAt: string;
  totalCards: number;
  cards: PZOCard[];
}

export interface DeckManifest {
  version: string;
  decks: Array<{
    deckId: string;
    name: string;
    cardIds: string[];
    cardCount: number;
  }>;
}

export interface CardIdMap {
  version: string;
  nameToId: Record<string, string>;
  idToName: Record<string, string>;
}

// ── Parser ───────────────────────────────────────────────────────────────────
export function parseCardsMarkdown(mdContent: string): PZOCard[] {
  const cards: PZOCard[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  // Split on card blocks: each card starts with ## or ### heading
  const cardBlocks = mdContent.split(/\n(?=#{2,3}\s)/);

  let printIndex = 0;
  for (const block of cardBlocks) {
    const card = parseCardBlock(block.trim(), printIndex);
    if (!card) continue;

    // Deduplicate by name
    if (seenNames.has(card.name.toLowerCase())) continue;
    seenNames.add(card.name.toLowerCase());

    // Ensure deterministic unique ID
    let id = card.id;
    let collision = 0;
    while (seenIds.has(id)) {
      id = deterministicId(card.name + card.type + collision.toString());
      collision++;
    }
    card.id = id;
    seenIds.add(id);

    cards.push(card);
    printIndex++;
  }

  return cards;
}

function parseCardBlock(block: string, printIndex: number): PZOCard | null {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const headingLine = lines.find(l => /^#{2,3}\s/.test(l));
  if (!headingLine) return null;

  const name = headingLine.replace(/^#{2,3}\s+/, '').trim();
  if (!name) return null;

  const get = (key: string): string => {
    const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase() + ':'));
    return line ? line.split(':').slice(1).join(':').trim() : '';
  };

  const typeRaw = get('type').toLowerCase() as CardType;
  const validTypes: CardType[] = ['asset', 'action', 'event', 'mechanic', 'persona', 'market'];
  const type: CardType = validTypes.includes(typeRaw) ? typeRaw : 'action';

  const cost = parseInt(get('cost') || '0', 10) || 0;
  const leverage = parseFloat(get('leverage') || '0') || 0;

  const descLine = lines.find(l =>
    !l.startsWith('#') &&
    !l.toLowerCase().startsWith('type:') &&
    !l.toLowerCase().startsWith('cost:') &&
    !l.toLowerCase().startsWith('leverage:') &&
    !l.toLowerCase().startsWith('deck:') &&
    !l.toLowerCase().startsWith('mechanics:') &&
    !l.toLowerCase().startsWith('tags:') &&
    l.length > 10
  ) ?? '';

  const deckId = get('deck') || 'deck_general';
  const mechanicIds = get('mechanics').split(',').map(s => s.trim()).filter(Boolean);
  const tags = get('tags').split(',').map(s => s.trim()).filter(Boolean);

  return {
    id: deterministicId(name + type),
    name,
    type,
    cost,
    leverage,
    description: descLine,
    deckId,
    mechanicIds,
    tags,
    printIndex,
  };
}

function deterministicId(input: string): string {
  return createHash('sha256').update(input.toLowerCase()).digest('hex').slice(0, 8);
}

// ── Builders ─────────────────────────────────────────────────────────────────
export function buildCatalog(cards: PZOCard[]): CardCatalog {
  return {
    version: '1.0.0',
    compiledAt: new Date().toISOString(),
    totalCards: cards.length,
    cards,
  };
}

export function buildDecks(cards: PZOCard[]): DeckManifest {
  const deckMap = new Map<string, string[]>();
  for (const card of cards) {
    const existing = deckMap.get(card.deckId) ?? [];
    existing.push(card.id);
    deckMap.set(card.deckId, existing);
  }
  const DECK_NAMES: Record<string, string> = {
    deck_general: 'General',
    deck_asset: 'Asset Cards',
    deck_action: 'Action Cards',
    deck_event: 'Event Cards',
    deck_mechanic: 'Mechanic Cards',
    deck_persona: 'Persona Cards',
    deck_market: 'Market Cards',
  };
  return {
    version: '1.0.0',
    decks: Array.from(deckMap.entries()).map(([deckId, cardIds]) => ({
      deckId,
      name: DECK_NAMES[deckId] ?? deckId,
      cardIds,
      cardCount: cardIds.length,
    })),
  };
}

export function buildIdMap(cards: PZOCard[]): CardIdMap {
  const nameToId: Record<string, string> = {};
  const idToName: Record<string, string> = {};
  for (const card of cards) {
    nameToId[card.name] = card.id;
    idToName[card.id] = card.name;
  }
  return { version: '1.0.0', nameToId, idToName };
}

// ── CLI Entry ─────────────────────────────────────────────────────────────────
export function compile(mdPath: string, outDir: string): void {
  const mdContent = fs.readFileSync(mdPath, 'utf-8');
  const cards = parseCardsMarkdown(mdContent);

  fs.mkdirSync(outDir, { recursive: true });

  const catalog = buildCatalog(cards);
  const decks = buildDecks(cards);
  const idMap = buildIdMap(cards);

  fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2));
  fs.writeFileSync(path.join(outDir, 'decks.json'), JSON.stringify(decks, null, 2));
  fs.writeFileSync(path.join(outDir, 'ids.json'), JSON.stringify(idMap, null, 2));

  console.log(`✅ Compiled ${cards.length} cards → catalog.json, decks.json, ids.json`);
}

// Run if called directly
if (require.main === module) {
  const [,, mdPath, outDir] = process.argv;
  if (!mdPath || !outDir) {
    console.error('Usage: ts-node compile_printable_cards_to_catalog.ts <cards.md> <out-dir>');
    process.exit(1);
  }
  compile(mdPath, outDir);
}

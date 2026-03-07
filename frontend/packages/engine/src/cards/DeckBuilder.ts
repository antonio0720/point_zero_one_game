// pzo-web/src/engines/cards/DeckBuilder.ts
// POINT ZERO ONE — DECK BUILDER v2 (Phase 3 Complete)
// 14 deck types (6 base + 8 mode-exclusive) · Density6 LLC · Confidential
//
// DECK TYPE REGISTRY (14 total):
//   Base (6):       OPPORTUNITY · IPA · FUBAR · PRIVILEGED · SO · PHASE_BOUNDARY
//   Predator (3):   SABOTAGE · COUNTER · BLUFF
//   Syndicate (4):  AID · RESCUE · TRUST · DEFECTION
//   Phantom (4):    GHOST · DISCIPLINE · GAP_EXPLOIT · DYNASTY
//
// NOTE: GAP_EXPLOIT and DYNASTY must be added to ModeDeckType in types.ts.
// CARD_LEGALITY_MATRIX[CHASE_A_LEGEND] must include both new deck types.

import {
  GameMode, CardRarity, CARD_LEGALITY_MATRIX, LEGENDARY_DROP_WEIGHT,
  type CardDefinition,
} from './types';
import { getDrawableCards } from './CardRegistry';

// ── SEEDED PRNG — Mulberry32 ──────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedToUint32(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return hash >>> 0;
}

// ── DECK ENTRY ────────────────────────────────────────────────────────────────

export interface DeckEntry {
  readonly cardId:   string;
  readonly position: number;
  readonly def:      CardDefinition;
}

export interface DeckBuildResult {
  readonly seed:           string;
  readonly gameMode:       GameMode;
  readonly totalCards:     number;
  readonly legendaryCount: number;
  readonly drawStack:      DeckEntry[];
  readonly deckTypeBreakdown: Record<string, number>;
}

// ── MODE DECK TYPE MATRIX ─────────────────────────────────────────────────────
// Explicit 14-deck-type mapping per mode.
// Keys must match the DeckType union in types.ts exactly.
// GAP_EXPLOIT and DYNASTY extend CARD_LEGALITY_MATRIX if not already present.

const MODE_DECK_TYPES: Record<GameMode, string[]> = {
  [GameMode.GO_ALONE]: [
    'OPPORTUNITY', 'IPA', 'PRIVILEGED', 'SO', 'PHASE_BOUNDARY',
    // FUBAR excluded from draw stack — engine-injected only
  ],
  [GameMode.HEAD_TO_HEAD]: [
    'OPPORTUNITY', 'IPA', 'PRIVILEGED', 'SO',
    'SABOTAGE', 'COUNTER', 'BLUFF',
  ],
  [GameMode.TEAM_UP]: [
    'OPPORTUNITY', 'IPA', 'PRIVILEGED', 'SO',
    'AID', 'RESCUE', 'TRUST', 'DEFECTION',
  ],
  [GameMode.CHASE_A_LEGEND]: [
    'OPPORTUNITY', 'IPA', 'PRIVILEGED', 'SO',
    'GHOST', 'DISCIPLINE', 'GAP_EXPLOIT', 'DYNASTY',
  ],
};

// ── DECK BUILDER ──────────────────────────────────────────────────────────────

export class DeckBuilder {
  private readonly prng: () => number;
  private readonly seedStr: string;

  constructor(seed: string) {
    this.seedStr = seed;
    this.prng    = mulberry32(seedToUint32(seed));
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  /**
   * Build the complete ordered draw stack for the given game mode.
   *
   * Algorithm:
   *   1. Resolve legal deck types for mode from MODE_DECK_TYPES.
   *   2. Collect drawable cards (drop_weight > 0) — separate legendaries.
   *   3. Build weighted pool: each card appears drop_weight × deckMultiplier times.
   *   4. Legendary pool: 1 copy per cycle at LEGENDARY_DROP_WEIGHT weight.
   *   5. Fisher-Yates shuffle weighted pool with seeded PRNG.
   *   6. Splice legendaries into shuffled stack at seeded positions (min 30 from top).
   *   7. Return DeckBuildResult with full positional DeckEntry array.
   *
   * @param mode            - Game mode for this run.
   * @param deckMultiplier  - Pool cycles. Default 3 (long run never exhausts deck).
   */
  public buildDeck(mode: GameMode, deckMultiplier: number = 3): DeckBuildResult {
    const legalDeckTypes = MODE_DECK_TYPES[mode] ?? [];

    const drawableCards:  CardDefinition[] = [];
    const legendaryCards: CardDefinition[] = [];
    const deckTypeBreakdown: Record<string, number> = {};

    // ── Step 1-2: Collect drawable cards ─────────────────────────────────────
    for (const deckType of legalDeckTypes) {
      const cards = getDrawableCards(deckType as any);
      deckTypeBreakdown[deckType] = 0;

      for (const card of cards) {
        if (card.rarity === CardRarity.LEGENDARY) {
          legendaryCards.push(card);
        } else {
          drawableCards.push(card);
        }
        deckTypeBreakdown[deckType]++;
      }
    }

    // ── Step 3: Weighted pool ─────────────────────────────────────────────────
    const weightedPool: CardDefinition[] = [];
    for (let cycle = 0; cycle < deckMultiplier; cycle++) {
      for (const card of drawableCards) {
        for (let w = 0; w < card.drop_weight; w++) {
          weightedPool.push(card);
        }
      }
    }

    // ── Step 4: Legendary pool ────────────────────────────────────────────────
    const legendaryPool: CardDefinition[] = [];
    for (let cycle = 0; cycle < deckMultiplier; cycle++) {
      for (const leg of legendaryCards) {
        for (let w = 0; w < LEGENDARY_DROP_WEIGHT; w++) {
          legendaryPool.push(leg);
        }
      }
    }

    // ── Step 5: Shuffle weighted pool ────────────────────────────────────────
    this.shuffleInPlace(weightedPool);

    // ── Step 6: Splice legendaries at seeded positions ────────────────────────
    const finalStack = [...weightedPool];
    for (const leg of legendaryPool) {
      const minInsert = Math.min(30, Math.floor(finalStack.length * 0.1));
      const insertAt  = minInsert + Math.floor(this.prng() * (finalStack.length - minInsert));
      finalStack.splice(insertAt, 0, leg);
    }

    // ── Step 7: Build DeckEntry array ────────────────────────────────────────
    const drawStack: DeckEntry[] = finalStack.map((def, position) => ({
      cardId: def.cardId,
      position,
      def,
    }));

    return {
      seed:             this.seedStr,
      gameMode:         mode,
      totalCards:       drawStack.length,
      legendaryCount:   legendaryPool.length,
      drawStack,
      deckTypeBreakdown,
    };
  }

  /**
   * Preview deck composition without building a full shuffled stack.
   * Returns counts per deck type and rarity — used by telemetry and tests.
   */
  public previewComposition(mode: GameMode, deckMultiplier: number = 3): {
    deckTypes: string[];
    cardsByType: Record<string, number>;
    cardsByRarity: Record<string, number>;
    estimatedTotalCards: number;
  } {
    const legalDeckTypes = MODE_DECK_TYPES[mode] ?? [];
    const cardsByType:   Record<string, number> = {};
    const cardsByRarity: Record<string, number> = {};
    let estimatedTotalCards = 0;

    for (const deckType of legalDeckTypes) {
      const cards = getDrawableCards(deckType as any);
      let typeWeight = 0;
      for (const card of cards) {
        const weightedCount = card.rarity === CardRarity.LEGENDARY
          ? LEGENDARY_DROP_WEIGHT * deckMultiplier
          : card.drop_weight * deckMultiplier;
        typeWeight += weightedCount;
        const rarityKey = card.rarity as string;
        cardsByRarity[rarityKey] = (cardsByRarity[rarityKey] ?? 0) + weightedCount;
      }
      cardsByType[deckType] = typeWeight;
      estimatedTotalCards  += typeWeight;
    }

    return { deckTypes: legalDeckTypes, cardsByType, cardsByRarity, estimatedTotalCards };
  }

  // ── PRIVATE ───────────────────────────────────────────────────────────────

  private shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.prng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ── DRAW CURSOR ───────────────────────────────────────────────────────────────

export class DrawCursor {
  private cursor: number = 0;
  private readonly stack: readonly DeckEntry[];
  private readonly mode: GameMode;

  constructor(result: DeckBuildResult) {
    this.stack = result.drawStack;
    this.mode  = result.gameMode;
  }

  /** Draw the next card. Returns null if deck is exhausted. */
  public draw(): DeckEntry | null {
    if (this.cursor >= this.stack.length) return null;
    return this.stack[this.cursor++];
  }

  /** How many cards remain. */
  public get remaining(): number {
    return this.stack.length - this.cursor;
  }

  /** Whether deck is exhausted. */
  public get isEmpty(): boolean {
    return this.cursor >= this.stack.length;
  }

  /** Current cursor position (for telemetry). */
  public get position(): number {
    return this.cursor;
  }

  /** Peek at next N cards without advancing cursor. */
  public peek(count: number = 3): DeckEntry[] {
    return this.stack.slice(this.cursor, this.cursor + count) as DeckEntry[];
  }

  /** Game mode this cursor was built for. */
  public get gameMode(): GameMode {
    return this.mode;
  }

  /**
   * Search ahead for the next card of a given cardId.
   * Returns position offset from cursor (0 = next draw), or -1 if not found.
   * Used by HandManager to check if a specific card is coming.
   */
  public findAhead(cardId: string): number {
    for (let i = this.cursor; i < this.stack.length; i++) {
      if (this.stack[i].cardId === cardId) return i - this.cursor;
    }
    return -1;
  }
}

// ── DECK BUILDER FACTORY ──────────────────────────────────────────────────────

/**
 * Convenience factory — build a DeckBuildResult and DrawCursor in one call.
 * This is the standard entry point for CardEngine.
 */
export function buildRunDeck(
  seed:           string,
  mode:           GameMode,
  deckMultiplier: number = 3,
): { result: DeckBuildResult; cursor: DrawCursor } {
  const builder = new DeckBuilder(seed);
  const result  = builder.buildDeck(mode, deckMultiplier);
  const cursor  = new DrawCursor(result);
  return { result, cursor };
}
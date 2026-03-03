//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/DeckBuilder.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — DECK BUILDER
// pzo-web/src/engines/cards/DeckBuilder.ts
//
// Constructs the seeded draw stack for each game mode at run start.
// All randomness is derived from the run seed — same seed = same deck every time.
// This is the deterministic contract that makes Phantom mode (CHASE_A_LEGEND)
// possible: both player and Legend drew from the same card order.
//
// RULES:
//   ✦ No Math.random() anywhere in this file. All shuffles use seeded PRNG.
//   ✦ Legality matrix from types.ts is the only source of mode filtering.
//   ✦ Forced/injected cards (drop_weight=0) are NEVER placed in the draw stack.
//   ✦ DeckBuilder is instantiated once per run. Call buildDeck() once.
//   ✦ Engine-injected cards (FUBAR, FORCED) arrive via ForcedCardQueue, not here.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  GameMode,
  CardRarity,
  CARD_LEGALITY_MATRIX,
  LEGENDARY_DROP_WEIGHT,
  type CardDefinition,
} from './types';
import { getDrawableCards } from './CardRegistry';

// ── SEEDED PRNG — Mulberry32 ───────────────────────────────────────────────────
// Fast, deterministic, high-quality 32-bit PRNG from a uint32 seed.
// Same seed always produces the same shuffle sequence.

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a string seed to a uint32 via djb2 hash.
 * Deterministic: same string → same uint32 always.
 */
function seedToUint32(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return hash >>> 0; // force unsigned 32-bit
}

// ── DECK ENTRY ─────────────────────────────────────────────────────────────────

/** A single entry in the draw stack — definition reference + position index. */
export interface DeckEntry {
  readonly cardId:   string;
  readonly position: number;   // 0-indexed position in the original shuffled stack
  readonly def:      CardDefinition;
}

// ── DECK BUILD RESULT ──────────────────────────────────────────────────────────

export interface DeckBuildResult {
  readonly seed:          string;
  readonly gameMode:      GameMode;
  readonly totalCards:    number;
  readonly legendaryCount: number;
  readonly drawStack:     DeckEntry[];  // index 0 = top of deck (next draw)
}

// ── DECK BUILDER ──────────────────────────────────────────────────────────────

export class DeckBuilder {
  private readonly prng: () => number;

  constructor(seed: string) {
    this.prng = mulberry32(seedToUint32(seed));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build the complete ordered draw stack for the given game mode.
   *
   * Steps:
   *   1. Read legal deck types from CARD_LEGALITY_MATRIX[mode].
   *   2. Collect all drawable cards (drop_weight > 0) for those deck types.
   *   3. Build weighted pool — each card appears drop_weight times.
   *   4. Append Legendary cards (1 copy each) to separate legendary pool.
   *   5. Shuffle weighted pool with seeded PRNG (Fisher-Yates).
   *   6. Splice Legendary cards into shuffled stack at seeded positions.
   *   7. Return as DeckBuildResult with positional DeckEntry array.
   *
   * @param mode - The game mode for this run.
   * @param deckMultiplier - How many cycles of the base pool to include.
   *                         Default 3 — ensures a long run never exhausts the deck.
   */
  public buildDeck(mode: GameMode, deckMultiplier: number = 3): DeckBuildResult {
    const legalDeckTypes = CARD_LEGALITY_MATRIX[mode];

    // ── Step 1–2: Collect drawable cards for legal deck types ─────────────────
    const drawableCards: CardDefinition[] = [];
    const legendaryCards: CardDefinition[] = [];

    for (const deckType of legalDeckTypes) {
      const cards = getDrawableCards(deckType);
      for (const card of cards) {
        if (card.rarity === CardRarity.LEGENDARY) {
          legendaryCards.push(card);
        } else {
          drawableCards.push(card);
        }
      }
    }

    // ── Step 3: Build weighted pool ───────────────────────────────────────────
    const weightedPool: CardDefinition[] = [];
    for (let cycle = 0; cycle < deckMultiplier; cycle++) {
      for (const card of drawableCards) {
        // Each card appears drop_weight times per cycle
        for (let w = 0; w < card.drop_weight; w++) {
          weightedPool.push(card);
        }
      }
    }

    // ── Step 4: Legendary pool — 1 copy per cycle, at LEGENDARY_DROP_WEIGHT weight ─
    const legendaryPool: CardDefinition[] = [];
    for (let cycle = 0; cycle < deckMultiplier; cycle++) {
      for (const leg of legendaryCards) {
        for (let w = 0; w < LEGENDARY_DROP_WEIGHT; w++) {
          legendaryPool.push(leg);
        }
      }
    }

    // ── Step 5: Fisher-Yates shuffle of weighted pool ─────────────────────────
    this.shuffleInPlace(weightedPool);

    // ── Step 6: Splice Legendaries into seeded positions ─────────────────────
    // Legendaries are spaced across the deck — never clumped at the start.
    const finalStack = [...weightedPool];
    for (const leg of legendaryPool) {
      // Insert at a seeded position that is at least 30 cards from the start
      // to prevent a Legendary appearing as the first draw.
      const minInsert = Math.min(30, Math.floor(finalStack.length * 0.1));
      const insertAt = minInsert + Math.floor(this.prng() * (finalStack.length - minInsert));
      finalStack.splice(insertAt, 0, leg);
    }

    // ── Step 7: Build DeckEntry array ─────────────────────────────────────────
    const drawStack: DeckEntry[] = finalStack.map((def, position) => ({
      cardId: def.cardId,
      position,
      def,
    }));

    return {
      seed:          '', // seed is stored in CardEngine — not re-exposed here
      gameMode:      mode,
      totalCards:    drawStack.length,
      legendaryCount: legendaryPool.length,
      drawStack,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fisher-Yates in-place shuffle using the seeded PRNG.
   * Modifies the array in place. Returns the same reference.
   */
  private shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.prng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ── DRAW CURSOR ────────────────────────────────────────────────────────────────

/**
 * Stateful cursor over a built DeckBuildResult.
 * HandManager holds one of these — the deck is built once, cursor advances per draw.
 * Never shuffles or mutates the underlying stack.
 */
export class DrawCursor {
  private cursor: number = 0;
  private readonly stack: readonly DeckEntry[];

  constructor(result: DeckBuildResult) {
    this.stack = result.drawStack;
  }

  /** Draw the next card. Returns null if deck is exhausted. */
  public draw(): DeckEntry | null {
    if (this.cursor >= this.stack.length) return null;
    return this.stack[this.cursor++];
  }

  /** How many cards remain in the deck. */
  public get remaining(): number {
    return this.stack.length - this.cursor;
  }

  /** Whether the deck is exhausted. */
  public get isEmpty(): boolean {
    return this.cursor >= this.stack.length;
  }

  /** Current cursor position (for telemetry). */
  public get position(): number {
    return this.cursor;
  }

  /** Peek at the next N cards without advancing the cursor. */
  public peek(count: number = 3): DeckEntry[] {
    return this.stack.slice(this.cursor, this.cursor + count) as DeckEntry[];
  }
}
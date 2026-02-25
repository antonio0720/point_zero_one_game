/**
 * test-utilities
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/backend/game-engine/__tests__/test-utilities.ts
 *
 * Provides: GameState type + createTestGame / applyCard / advanceTurn / serializeState
 * Used by all core-rules-* test suites.
 */

import { Player, ActiveEffect } from '../src/Player';
import { Card }                 from '../src/Card';

// ── Seeded PRNG (mulberry32) ───────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Deck with reshuffle support ───────────────────────────────────────────────

export class Deck {
  private draw:    Card[] = [];
  private discards: Card[] = [];
  private rng:     () => number;

  constructor(cards: Card[], seed: number) {
    this.rng  = mulberry32(seed);
    this.draw = this._shuffle([...cards]);
  }

  drawCard(): Card | null {
    if (this.draw.length === 0) {
      if (this.discards.length === 0) return null;
      // Reshuffle discards back into draw
      this.draw     = this._shuffle([...this.discards]);
      this.discards = [];
    }
    return this.draw.pop() ?? null;
  }

  discard(card: Card): void {
    this.discards.push(card);
  }

  private _shuffle(cards: Card[]): Card[] {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
}

// ── GameState ─────────────────────────────────────────────────────────────────

export interface GameState {
  seed:         number;
  turn:         number;
  players:      Player[];
  deck:         Deck;
  outcome:      string | null;
  isOver:       boolean;
  proofHash:    string | undefined;
  /** Internal: cards staged for application on next tick */
  _pendingCards: Map<string, Card>;
}

// ── createTestGame ────────────────────────────────────────────────────────────

/**
 * Creates a fresh GameState for the given players and seed.
 * Builds a deterministic default deck of 52 mixed cards seeded by the given seed.
 */
export function createTestGame(players: Player[], seed: number): GameState {
  // Reset player state for clean test isolation
  for (const p of players) {
    p.netWorth      = 0;
    p.income        = 0;
    p.expenses      = 0;
    p.activeEffects = [];
  }

  const defaultCards = buildDefaultDeck();
  const deck         = new Deck(defaultCards, seed);

  return {
    seed,
    turn:          1,
    players:       [...players],
    deck,
    outcome:       null,
    isOver:        false,
    proofHash:     undefined,
    _pendingCards: new Map(),
  };
}

function buildDefaultDeck(): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < 20; i++) {
    cards.push(new Card(`DEFAULT_INCOME_${i}`, {
      type: 'OPPORTUNITY', incomeEffect: 200 + i * 10, expenseEffect: 0, specialEffect: null, weight: 1,
    }));
  }
  for (let i = 0; i < 16; i++) {
    cards.push(new Card(`DEFAULT_FUBAR_${i}`, {
      type: 'FUBAR', incomeEffect: 0, expenseEffect: 100 + i * 20, specialEffect: null, weight: 1,
    }));
  }
  for (let i = 0; i < 16; i++) {
    cards.push(new Card(`DEFAULT_PRIV_${i}`, {
      type: 'PRIVILEGED', incomeEffect: 300 + i * 15, expenseEffect: 0, specialEffect: null, weight: 1,
    }));
  }
  return cards;
}

// ── applyCard ─────────────────────────────────────────────────────────────────

/**
 * Stages a card to be applied to the given player on the next engine.tick().
 * Multiple calls overwrite — last card wins per player per turn.
 */
export function applyCard(game: GameState, playerId: string, card: Card): void {
  game._pendingCards.set(playerId, card);
}

// ── advanceTurn ───────────────────────────────────────────────────────────────

/**
 * Convenience wrapper — exposed for tests that prefer explicit turn advancement
 * over calling engine.tick() directly.
 * NOTE: Does NOT apply Engine logic — use engine.tick(game) for full simulation.
 */
export function advanceTurn(game: GameState): void {
  game.turn += 1;
}

// ── serializeState ────────────────────────────────────────────────────────────

/**
 * Returns a stable JSON-comparable snapshot of a GameState.
 * Used for determinism assertions: serializeState(gameA) === serializeState(gameB).
 */
export function serializeState(game: GameState): string {
  return JSON.stringify({
    seed:    game.seed,
    turn:    game.turn,
    outcome: game.outcome,
    isOver:  game.isOver,
    players: game.players.map(p => ({
      id:            p.id,
      name:          p.name,
      netWorth:      p.netWorth,
      income:        p.income,
      expenses:      p.expenses,
      activeEffects: [...p.activeEffects].sort((a, b) => a.type.localeCompare(b.type)),
    })),
  });
}

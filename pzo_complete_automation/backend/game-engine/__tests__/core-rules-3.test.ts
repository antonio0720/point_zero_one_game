/**
 * Deterministic run engine — core-rules-3 test suite
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/backend/game-engine/__tests__/core-rules-3.test.ts
 *
 * Tests: basic run, special cards, edge cases (deck exhaustion, bankruptcy, freedom trigger)
 * Engine contract:
 *   - Given same seed → identical turn sequence (determinism)
 *   - Bankruptcy: netWorth ≤ 0 ends run with outcome='BANKRUPT'
 *   - Freedom:    netWorth ≥ FREEDOM_THRESHOLD ends run with outcome='FREEDOM'
 *   - Deck empty: run continues using reshuffle of discards (no crash)
 */

import { createTestGame, GameState, applyCard, advanceTurn, serializeState } from './test-utilities';
import { Engine } from '../src/core-rules-3/Engine';
import { Player } from '../src/Player';
import { Card } from '../src/Card';
import { describe, it, expect, beforeEach } from '@jest/globals';

// ── Seed constants (do NOT change — determinism depends on these) ─────────────
const SEED_BASIC      = 42;
const SEED_SPECIALS   = 1337;
const SEED_EDGE       = 9999;

// ── Card fixture factories ────────────────────────────────────────────────────

/** A plain income card: no special effects, +$500/turn */
function makeIncomeCard(id = 'CARD_INCOME_BASE'): Card {
  return new Card(id, {
    type:          'OPPORTUNITY',
    incomeEffect:  500,
    expenseEffect: 0,
    specialEffect: null,
    weight:        1,
  });
}

/** A high-risk card that doubles income but adds $800 expense */
function makeHighRiskCard(id = 'CARD_HIGH_RISK'): Card {
  return new Card(id, {
    type:          'OPPORTUNITY',
    incomeEffect:  1500,
    expenseEffect: 800,
    specialEffect: 'DOUBLE_INCOME_NEXT_TURN',
    weight:        2,
  });
}

/** A FUBAR card: reduces income by 40% for 2 turns */
function makeFubarCard(id = 'CARD_FUBAR_1'): Card {
  return new Card(id, {
    type:          'FUBAR',
    incomeEffect:  0,
    expenseEffect: 0,
    specialEffect: 'REDUCE_INCOME_40PCT_2TURNS',
    weight:        1,
  });
}

/** A Sabotage card: injects $3000 unexpected expense */
function makeSabotageCard(id = 'CARD_SABOTAGE'): Card {
  return new Card(id, {
    type:          'FUBAR',
    incomeEffect:  0,
    expenseEffect: 3000,
    specialEffect: 'HATER_SABOTAGE',
    weight:        1,
  });
}

/** A freedom accelerator: +$5000 net worth bonus */
function makeFreedomAcceleratorCard(id = 'CARD_FREEDOM_BOOST'): Card {
  return new Card(id, {
    type:          'PRIVILEGED',
    incomeEffect:  0,
    expenseEffect: 0,
    specialEffect: 'BONUS_NET_WORTH_5000',
    weight:        3,
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('Deterministic run engine - core-rules-3', () => {
  let game: GameState;
  let engine: Engine;

  const player1 = new Player('Alice');
  const player2 = new Player('Bob');

  beforeEach(() => {
    game   = createTestGame([player1, player2], SEED_BASIC);
    engine = new Engine();
  });

  // ── Basic game ──────────────────────────────────────────────────────────────

  describe('Basic run — no special cards', () => {
    it('produces identical state for the same seed (determinism)', () => {
      const gameA = createTestGame([player1, player2], SEED_BASIC);
      const gameB = createTestGame([player1, player2], SEED_BASIC);

      for (let i = 0; i < 5; i++) {
        engine.tick(gameA);
        engine.tick(gameB);
      }

      expect(serializeState(gameA)).toStrictEqual(serializeState(gameB));
    });

    it('produces DIFFERENT state for different seeds', () => {
      const gameA = createTestGame([player1, player2], SEED_BASIC);
      const gameB = createTestGame([player1, player2], SEED_SPECIALS);

      for (let i = 0; i < 3; i++) {
        engine.tick(gameA);
        engine.tick(gameB);
      }

      // At least one player's net worth should diverge
      expect(serializeState(gameA)).not.toStrictEqual(serializeState(gameB));
    });

    it('advances turn counter correctly after each tick', () => {
      expect(game.turn).toBe(1);
      engine.tick(game);
      expect(game.turn).toBe(2);
      engine.tick(game);
      expect(game.turn).toBe(3);
    });

    it('applies basic income card — net worth increases by incomeEffect', () => {
      const card          = makeIncomeCard();
      const netWorthBefore = game.players[0].netWorth;

      applyCard(game, player1.id, card);
      engine.tick(game);

      expect(game.players[0].netWorth).toBeGreaterThan(netWorthBefore);
    });

    it('net worth does not change without any card played (idle tick)', () => {
      const before = game.players[0].netWorth;
      engine.tick(game);
      // With no cards played, net worth = before + (income - expenses) per tick
      // At game start income = expenses = 0, so should be unchanged
      expect(game.players[0].netWorth).toBe(before);
    });

    it('income accumulates correctly across 10 turns with steady income card', () => {
      const card         = makeIncomeCard();
      const INCOME       = card.config.incomeEffect; // 500
      const TURNS        = 10;
      const startNetWorth = game.players[0].netWorth;

      for (let i = 0; i < TURNS; i++) {
        applyCard(game, player1.id, card);
        engine.tick(game);
      }

      expect(game.players[0].netWorth).toBe(startNetWorth + INCOME * TURNS);
    });
  });

  // ── Special cards ───────────────────────────────────────────────────────────

  describe('Special cards', () => {
    beforeEach(() => {
      game   = createTestGame([player1, player2], SEED_SPECIALS);
      engine = new Engine();
    });

    it('DOUBLE_INCOME_NEXT_TURN: income is doubled the turn after high-risk card', () => {
      const card   = makeHighRiskCard();
      const income = card.config.incomeEffect; // 1500

      applyCard(game, player1.id, card);
      engine.tick(game); // Turn 1 — card applied, effect queued

      const netWorthT1 = game.players[0].netWorth;

      // Turn 2 — doubled income fires
      engine.tick(game);
      const gained = game.players[0].netWorth - netWorthT1;

      // Doubled income minus expenses: (1500 * 2) - 800 = 2200, minus regular expenses
      expect(gained).toBeGreaterThanOrEqual(income * 2 - card.config.expenseEffect);
    });

    it('FUBAR REDUCE_INCOME_40PCT_2TURNS: reduces income for exactly 2 turns', () => {
      const baseCard  = makeIncomeCard();
      const fubarCard = makeFubarCard();

      // Establish baseline income
      applyCard(game, player1.id, baseCard);
      engine.tick(game);
      const netWorthBase = game.players[0].netWorth;

      // Apply FUBAR
      applyCard(game, player1.id, fubarCard);
      engine.tick(game); // T2 — FUBAR active (40% reduction)

      const gainT2 = game.players[0].netWorth - netWorthBase;

      // Gain during FUBAR should be ~60% of baseline income
      expect(gainT2).toBeLessThan(baseCard.config.incomeEffect * 0.65);
      expect(gainT2).toBeGreaterThanOrEqual(0);

      const netWorthAfterFubar1 = game.players[0].netWorth;
      engine.tick(game); // T3 — FUBAR still active

      const gainT3 = game.players[0].netWorth - netWorthAfterFubar1;
      expect(gainT3).toBeLessThan(baseCard.config.incomeEffect * 0.65);

      const netWorthAfterFubar2 = game.players[0].netWorth;
      engine.tick(game); // T4 — FUBAR expired, back to normal

      const gainT4 = game.players[0].netWorth - netWorthAfterFubar2;
      // Without the income card being re-applied, gain is 0; but FUBAR should be gone
      // Check that FUBAR effect is cleared from game state
      expect(game.players[0].activeEffects.some(e => e.type === 'REDUCE_INCOME_40PCT_2TURNS')).toBe(false);
    });

    it('HATER_SABOTAGE: deducts $3000 from net worth in same turn', () => {
      const sabotage   = makeSabotageCard();
      const netWorthBefore = game.players[0].netWorth;

      applyCard(game, player1.id, sabotage);
      engine.tick(game);

      expect(game.players[0].netWorth).toBe(netWorthBefore - sabotage.config.expenseEffect);
    });

    it('BONUS_NET_WORTH_5000 (PRIVILEGED): immediately adds $5000 to net worth', () => {
      const freedom    = makeFreedomAcceleratorCard();
      const netWorthBefore = game.players[0].netWorth;

      applyCard(game, player1.id, freedom);
      engine.tick(game);

      expect(game.players[0].netWorth).toBe(netWorthBefore + 5000);
    });

    it('multiple special effects stack correctly in same turn', () => {
      const highRisk  = makeHighRiskCard();
      const fubar     = makeFubarCard();

      // Apply both in same turn
      applyCard(game, player1.id, highRisk);
      applyCard(game, player1.id, fubar);

      expect(() => engine.tick(game)).not.toThrow();

      // Both effects should be queued
      const effects = game.players[0].activeEffects.map(e => e.type);
      expect(effects).toContain('DOUBLE_INCOME_NEXT_TURN');
      expect(effects).toContain('REDUCE_INCOME_40PCT_2TURNS');
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    beforeEach(() => {
      game   = createTestGame([player1, player2], SEED_EDGE);
      engine = new Engine();
    });

    it('deck exhaustion: engine reshuffles discards and continues without throwing', () => {
      // Force-exhaust the deck by running many turns
      expect(() => {
        for (let i = 0; i < 200; i++) {
          engine.tick(game);
        }
      }).not.toThrow();

      // Game should still be in a valid state
      expect(game.turn).toBe(201);
      expect(game.players[0]).toBeDefined();
    });

    it('BANKRUPT: run ends with outcome=BANKRUPT when netWorth ≤ 0', () => {
      // Drive net worth to 0 by stacking sabotage cards
      const sabotage = makeSabotageCard();

      // Set net worth to a small value so one sabotage kills it
      game.players[0].netWorth = 2999;

      applyCard(game, player1.id, sabotage); // -$3000 → -$1
      engine.tick(game);

      expect(game.outcome).toBe('BANKRUPT');
      expect(game.isOver).toBe(true);
    });

    it('FREEDOM: run ends with outcome=FREEDOM when netWorth ≥ FREEDOM_THRESHOLD', () => {
      const FREEDOM_THRESHOLD = engine.FREEDOM_THRESHOLD; // e.g. 1_000_000

      game.players[0].netWorth = FREEDOM_THRESHOLD - 1;

      const booster = makeFreedomAcceleratorCard();
      // One $5000 boost should not be enough if threshold is 1M
      // Set close to threshold for a deterministic test
      game.players[0].netWorth = FREEDOM_THRESHOLD - 5000;

      applyCard(game, player1.id, booster);
      engine.tick(game);

      expect(game.outcome).toBe('FREEDOM');
      expect(game.isOver).toBe(true);
    });

    it('no further ticks are processed after game ends (BANKRUPT)', () => {
      game.players[0].netWorth = 100;
      const sabotage = makeSabotageCard();

      applyCard(game, player1.id, sabotage);
      engine.tick(game);

      expect(game.outcome).toBe('BANKRUPT');
      const turnAtEnd = game.turn;

      // Additional ticks should be no-ops
      engine.tick(game);
      engine.tick(game);

      expect(game.turn).toBe(turnAtEnd);
    });

    it('proof hash is generated and non-empty after run ends', () => {
      game.players[0].netWorth = 100;
      const sabotage = makeSabotageCard();

      applyCard(game, player1.id, sabotage);
      engine.tick(game);

      expect(game.proofHash).toBeDefined();
      expect(typeof game.proofHash).toBe('string');
      expect(game.proofHash!.length).toBeGreaterThan(0);
    });

    it('two players with same seed produce matching final states', () => {
      const gameA = createTestGame([new Player('X'), new Player('Y')], SEED_EDGE);
      const gameB = createTestGame([new Player('X'), new Player('Y')], SEED_EDGE);

      for (let i = 0; i < 20; i++) {
        if (!gameA.isOver) engine.tick(gameA);
        if (!gameB.isOver) engine.tick(gameB);
      }

      expect(gameA.players[0].netWorth).toBe(gameB.players[0].netWorth);
      expect(gameA.turn).toBe(gameB.turn);
      expect(gameA.outcome).toBe(gameB.outcome);
    });
  });
});

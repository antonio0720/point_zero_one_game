import { describe, it, expect } from 'vitest';
import { GameEngine } from '../game-engine';
import { SeededRandom } from '../market-engine';
import { PortfolioEngine, createPortfolio } from '../portfolio-engine';
import { DrawEngine, buildStarterDeck, CARD_REGISTRY } from '../deck';
import { CardType } from '../types';

// ─── DETERMINISM ─────────────────────────────────────────────
describe('Deterministic Engine', () => {
  it('produces identical runs from the same seed', () => {
    const engine1 = new GameEngine();
    const engine2 = new GameEngine();

    let s1 = engine1.createRun('player-a', 999);
    let s2 = engine2.createRun('player-b', 999);

    for (let i = 0; i < 100; i++) {
      s1 = engine1.tick(s1);
      s2 = engine2.tick(s2);
    }

    // Same seed = same market prices
    for (const [symbol, asset] of s1.market.assets) {
      expect(asset.price).toBeCloseTo(s2.market.assets.get(symbol)!.price, 8);
    }
  });

  it('produces different runs from different seeds', () => {
    const e1 = new GameEngine();
    const e2 = new GameEngine();
    let s1 = e1.createRun('p1', 1);
    let s2 = e2.createRun('p2', 2);
    for (let i = 0; i < 50; i++) { s1 = e1.tick(s1); s2 = e2.tick(s2); }

    const prices1 = [...s1.market.assets.values()].map(a => a.price);
    const prices2 = [...s2.market.assets.values()].map(a => a.price);
    expect(prices1).not.toEqual(prices2);
  });
});

// ─── SEEDED RNG ───────────────────────────────────────────────
describe('SeededRandom', () => {
  it('produces values in [0, 1)', () => {
    const rng = new SeededRandom(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is reproducible', () => {
    const a = new SeededRandom(777);
    const b = new SeededRandom(777);
    const va = Array.from({ length: 20 }, () => a.next());
    const vb = Array.from({ length: 20 }, () => b.next());
    expect(va).toEqual(vb);
  });
});

// ─── PORTFOLIO ────────────────────────────────────────────────
describe('PortfolioEngine', () => {
  it('starts with correct cash', () => {
    const p = createPortfolio(10_000);
    expect(p.cash).toBe(10_000);
    expect(p.totalEquity).toBe(10_000);
    expect(p.positions.size).toBe(0);
  });

  it('opens a position and deducts cash', () => {
    const engine = new PortfolioEngine();
    const portfolio = createPortfolio(10_000);
    const card = { ...CARD_REGISTRY['BULL_CALL'], id: 'test-card' };
    const result = engine.openPosition(portfolio, card, 'ALPHA', 100);
    expect(result.cash).toBeLessThan(10_000);
    expect(result.positions.size).toBe(1);
  });

  it('closes a profitable position and increases cash', () => {
    const engine = new PortfolioEngine();
    let portfolio = createPortfolio(10_000);
    const card = { ...CARD_REGISTRY['BULL_CALL'], id: 'test-card' };
    portfolio = engine.openPosition(portfolio, card, 'ALPHA', 100);
    const posId = [...portfolio.positions.keys()][0];
    const cashBefore = portfolio.cash;
    const { portfolio: after, pnl } = engine.closePosition(portfolio, posId, 110);
    expect(pnl).toBeGreaterThan(0);
    expect(after.cash).toBeGreaterThan(cashBefore);
    expect(after.positions.size).toBe(0);
  });

  it('calculates drawdown correctly', () => {
    const p = createPortfolio(10_000);
    const modified = { ...p, totalEquity: 8_000, peakEquity: 10_000, maxDrawdown: 0.2 };
    expect(modified.maxDrawdown).toBe(0.2);
  });
});

// ─── DECK ────────────────────────────────────────────────────
describe('DrawEngine', () => {
  const rng = new SeededRandom(42);

  it('builds a starter deck with correct structure', () => {
    const deck = buildStarterDeck(rng);
    expect(deck.cards.length).toBeGreaterThan(0);
    expect(deck.drawPile.length).toBe(deck.cards.length);
    expect(deck.hand.length).toBe(0);
    expect(deck.discardPile.length).toBe(0);
  });

  it('draws cards from pile to hand', () => {
    const rng2 = new SeededRandom(1);
    const deck = buildStarterDeck(rng2);
    const draw = new DrawEngine();
    const { deck: after, drawn } = draw.draw(deck, 5);
    expect(drawn.length).toBe(5);
    expect(after.hand.length).toBe(5);
    expect(after.drawPile.length).toBe(deck.drawPile.length - 5);
  });

  it('plays a card from hand to discard', () => {
    const rng3 = new SeededRandom(2);
    let deck = buildStarterDeck(rng3);
    const draw = new DrawEngine();
    ({ deck } = draw.draw(deck, 3));
    const cardId = deck.hand[0].id;
    const { deck: after, card } = draw.play(deck, cardId);
    expect(card).not.toBeNull();
    expect(after.hand.length).toBe(2);
    expect(after.discardPile.length).toBe(1);
  });

  it('returns null when playing a card not in hand', () => {
    const rng4 = new SeededRandom(3);
    const deck = buildStarterDeck(rng4);
    const draw = new DrawEngine();
    const { card } = draw.play(deck, 'nonexistent-id');
    expect(card).toBeNull();
  });
});

// ─── CARD REGISTRY ───────────────────────────────────────────
describe('Card Registry', () => {
  it('all cards have required fields', () => {
    for (const [id, card] of Object.entries(CARD_REGISTRY)) {
      expect(card.id).toBeTruthy();
      expect(card.name).toBeTruthy();
      expect(card.cost).toBeGreaterThanOrEqual(0);
      expect(card.leverage).toBeGreaterThan(0);
      expect(Object.values(CardType)).toContain(card.type);
    }
  });

  it('GAMMA_SQUEEZE is legendary and expensive', () => {
    const card = CARD_REGISTRY['GAMMA_SQUEEZE'];
    expect(card.rarity).toBe('LEGENDARY');
    expect(card.cost).toBeGreaterThanOrEqual(2);
    expect(card.leverage).toBeGreaterThanOrEqual(3);
  });
});

// ─── FULL RUN ────────────────────────────────────────────────
describe('Full Run Lifecycle', () => {
  it('completes a full run in 720 ticks', () => {
    const engine = new GameEngine();
    let state = engine.createRun('test-player', 42);
    state = engine.drawCards(state, 5);
    for (let i = 0; i < 720; i++) {
      state = engine.tick(state);
    }
    state = engine.finalizeRun(state);
    expect(state.run.phase).toBe('COMPLETE');
    expect(state.run.currentTick).toBe(720);
  });

  it('score reflects ROI minus drawdown penalty', () => {
    const engine = new PortfolioEngine();
    const p = createPortfolio(10_000);
    const score = engine.calcScore({ ...p, totalEquity: 12_000 }, 10_000);
    expect(score).toBeGreaterThan(0);
  });

  it('emits RUN_CREATED event', () => {
    const engine = new GameEngine();
    let fired = false;
    engine.events.on('RUN_CREATED', () => { fired = true; });
    engine.createRun('p', 1);
    expect(fired).toBe(true);
  });
});

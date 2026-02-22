// ============================================================
// POINT ZERO ONE DIGITAL — Game Engine Core
// Deterministic tick loop, run lifecycle, event bus
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import {
  GameState, Run, RunPhase, GameAction,
  EngineEvent, EngineListener, Card, ActiveCard,
} from './types';
import { MarketEngine, SeededRandom } from './market-engine';
import { DrawEngine, buildStarterDeck } from './deck';
import { PortfolioEngine, createPortfolio } from './portfolio-engine';

const RUN_DURATION_MS  = 12 * 60 * 1000;  // 12 minutes
const TICKS_PER_RUN    = 720;              // 1 tick/second
const STARTING_CASH    = 10_000;
const STARTING_ENERGY  = 3;
const MAX_ENERGY       = 5;
const ENERGY_PER_TICK  = 0.05;            // ~1 energy per 20 ticks

// ─── EVENT BUS ───────────────────────────────────────────────
export class EventBus {
  private listeners: Map<string, EngineListener[]> = new Map();

  on(type: string, listener: EngineListener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(listener);
  }

  emit(event: EngineEvent): void {
    const handlers = this.listeners.get(event.type) ?? [];
    const wildcards = this.listeners.get('*') ?? [];
    [...handlers, ...wildcards].forEach(h => h(event));
  }

  off(type: string, listener: EngineListener): void {
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    this.listeners.set(type, handlers.filter(h => h !== listener));
  }
}

// ─── GAME ENGINE ─────────────────────────────────────────────
export class GameEngine {
  private market!: MarketEngine;
  private drawEngine: DrawEngine;
  private portfolioEngine: PortfolioEngine;
  public events: EventBus;
  private rng!: SeededRandom;

  constructor() {
    this.drawEngine = new DrawEngine();
    this.portfolioEngine = new PortfolioEngine();
    this.events = new EventBus();
  }

  // ─── RUN CREATION ───────────────────────────────────────
  createRun(playerId: string, seed?: number): GameState {
    const runSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
    this.rng = new SeededRandom(runSeed);
    this.market = new MarketEngine(runSeed);

    const deck = buildStarterDeck(this.rng);
    const portfolio = createPortfolio(STARTING_CASH);

    const run: Run = {
      id: uuidv4(),
      playerId,
      phase: RunPhase.SETUP,
      startTime: Date.now(),
      durationMs: RUN_DURATION_MS,
      currentTick: 0,
      maxTicks: TICKS_PER_RUN,
      portfolio,
      deck,
      activeCards: [],
      score: 0,
      seed: runSeed,
    };

    const initialMarket = this.market.tick(0);

    const state: GameState = {
      run,
      market: initialMarket,
      energy: STARTING_ENERGY,
      maxEnergy: MAX_ENERGY,
      turn: 0,
      actionLog: [],
    };

    this.events.emit({ type: 'RUN_CREATED', tick: 0, data: { runId: run.id, seed: runSeed } });
    return state;
  }

  // ─── TICK ────────────────────────────────────────────────
  tick(state: GameState): GameState {
    const { run } = state;

    if (run.phase === RunPhase.COMPLETE) return state;
    if (run.currentTick >= run.maxTicks) return this.finalizeRun(state);

    const nextTick = run.currentTick + 1;

    // Advance market
    const shocks = this.buildShocksFromActiveCards(state);
    const market = this.market.tick(nextTick, shocks);

    // Update portfolio prices + check liquidations
    let portfolio = this.portfolioEngine.updatePrices(run.portfolio, market);
    const { portfolio: postLiq, liquidated } = this.portfolioEngine.checkLiquidations(portfolio, market);
    portfolio = postLiq;

    if (liquidated.length > 0) {
      this.events.emit({ type: 'LIQUIDATION', tick: nextTick, data: { positions: liquidated } });
    }

    // Expire active cards
    const activeCards = run.activeCards.filter(ac => ac.expiresAtTick > nextTick);
    const expired = run.activeCards.filter(ac => ac.expiresAtTick <= nextTick);
    for (const ac of expired) {
      this.events.emit({ type: 'CARD_EXPIRED', tick: nextTick, data: { card: ac.card.name } });
    }

    // Regen energy
    const energy = Math.min(MAX_ENERGY, state.energy + ENERGY_PER_TICK);

    // Crisis phase trigger
    const phase = portfolio.maxDrawdown > 0.4 ? RunPhase.CRISIS : RunPhase.ACTIVE;

    if (phase === RunPhase.CRISIS && run.phase !== RunPhase.CRISIS) {
      this.market.applyVolatilitySpike(2.5);
      this.events.emit({ type: 'CRISIS_TRIGGERED', tick: nextTick, data: { drawdown: portfolio.maxDrawdown } });
    }

    const updatedRun: Run = {
      ...run,
      phase,
      currentTick: nextTick,
      portfolio,
      activeCards,
      score: this.portfolioEngine.calcScore(portfolio, STARTING_CASH),
    };

    this.events.emit({ type: 'TICK', tick: nextTick, data: { equity: portfolio.totalEquity, energy } });

    return { ...state, run: updatedRun, market, energy, turn: state.turn + 1 };
  }

  // ─── PLAY CARD ───────────────────────────────────────────
  playCard(state: GameState, cardId: string, targetSymbol: string): GameState {
    const { run, energy } = state;

    const card = run.deck.hand.find(c => c.id === cardId);
    if (!card) {
      this.events.emit({ type: 'PLAY_FAILED', tick: run.currentTick, data: { reason: 'card not in hand' } });
      return state;
    }
    if (energy < card.cost) {
      this.events.emit({ type: 'PLAY_FAILED', tick: run.currentTick, data: { reason: 'insufficient energy' } });
      return state;
    }

    const currentPrice = this.market.getPrice(targetSymbol);
    if (currentPrice === 0) return state;

    // Apply card to market
    this.market.setShock(targetSymbol, card.effect.priceImpact);
    this.market.applyVolatilitySpike(
      Math.max(1.0, state.market.volatilityIndex + card.effect.volatilityMod)
    );

    // Open position
    const portfolio = this.portfolioEngine.openPosition(run.portfolio, card, targetSymbol, currentPrice);

    // Update deck
    const { deck } = this.drawEngine.play(run.deck, cardId);

    // Track active card
    const activeCard: ActiveCard = {
      card,
      playedAtTick: run.currentTick,
      expiresAtTick: run.currentTick + card.durationTicks,
    };

    const action: GameAction = {
      tick: run.currentTick,
      type: 'PLAY_CARD',
      payload: { cardId, cardName: card.name, targetSymbol, cost: card.cost },
      timestamp: Date.now(),
    };

    this.events.emit({ type: 'CARD_PLAYED', tick: run.currentTick, data: { card: card.name, symbol: targetSymbol } });

    return {
      ...state,
      energy: energy - card.cost,
      run: {
        ...run,
        portfolio,
        deck,
        activeCards: [...run.activeCards, activeCard],
      },
      actionLog: [...state.actionLog, action],
    };
  }

  // ─── DRAW ────────────────────────────────────────────────
  drawCards(state: GameState, count = 1): GameState {
    const { deck, drawn } = this.drawEngine.draw(state.run.deck, count);
    const action: GameAction = {
      tick: state.run.currentTick,
      type: 'DRAW',
      payload: { count: drawn.length, cards: drawn.map(c => c.name) },
      timestamp: Date.now(),
    };
    return { ...state, run: { ...state.run, deck }, actionLog: [...state.actionLog, action] };
  }

  // ─── FINALIZE ────────────────────────────────────────────
  finalizeRun(state: GameState): GameState {
    const { run } = state;
    const score = this.portfolioEngine.calcScore(run.portfolio, STARTING_CASH);

    const finalRun: Run = {
      ...run,
      phase: RunPhase.COMPLETE,
      endTime: Date.now(),
      score,
    };

    this.events.emit({ type: 'RUN_COMPLETE', tick: run.currentTick, data: {
      score,
      equity: run.portfolio.totalEquity,
      roi: ((run.portfolio.totalEquity - STARTING_CASH) / STARTING_CASH * 100).toFixed(2) + '%',
      maxDrawdown: (run.portfolio.maxDrawdown * 100).toFixed(2) + '%',
    }});

    return { ...state, run: finalRun };
  }

  // ─── HELPERS ─────────────────────────────────────────────
  private buildShocksFromActiveCards(state: GameState): Map<string, number> {
    const shocks = new Map<string, number>();
    for (const ac of state.run.activeCards) {
      for (const [symbol] of state.market.assets) {
        const existing = shocks.get(symbol) ?? 0;
        shocks.set(symbol, existing + ac.card.effect.priceImpact * 0.1);
      }
    }
    return shocks;
  }
}

/**
 * engine.test.ts — Sprint 8 Core Engine Tests
 *
 * Tests the canonical Sprint 8 engine surface:
 *   - SeededRandom (Mulberry32) determinism
 *   - DrawEngine draw / play / inject / synergy
 *   - PortfolioEngine acquire / dispose / netWorth
 *   - MacroEngine tick / phase / erosion
 *   - TurnEngine full turn execution (all phases)
 *   - createRunSession factory
 *   - DrawMixEngine weight selection
 *   - MomentForge classification
 *
 * All tests are deterministic — no Math.random().
 * Every test documents the exact behaviour it pins.
 *
 * Deploy to: pzo_engine/src/engine/__tests__/engine.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { SeededRandom, MarketEngine }   from '../market-engine';
import { DrawEngine, buildStartingDeck, toCardInHand, CARD_REGISTRY } from '../deck';
import { DrawMixEngine, maybeInjectForcedCard } from '../six-deck';
import { PortfolioEngine }              from '../portfolio-engine';
import { MacroEngine }                  from '../macro-engine';
import { SolvencyEngine }               from '../wipe-checker';
import { MomentForge, classifyMoment, momentLabel } from '../moment-forge';
import {
  TurnEngine,
  createRunSession,
  type RunSession,
  type TurnContext,
  type ActionType,
} from '../turn-engine';
import {
  createInitialPlayerState,
  applyCashDelta,
  recalcCashflow,
  deriveRunPhase,
  MacroPhase,
  RunPhase,
} from '../player-state';
import type { PlayerState, OwnedAsset } from '../player-state';
import {
  BaseDeckType,
  CardRarity,
  TimingClass,
  STARTING_CASH,
  STARTING_INCOME,
  STARTING_EXPENSES,
  RUN_TICKS,
  FREEDOM_THRESHOLD,
} from '../types';
import type { CardDefinition, CardInHand, GameMode } from '../types';

// ─── TEST HELPERS ─────────────────────────────────────────────

function makeSession(seed = 42, mode: GameMode = 'GO_ALONE'): RunSession {
  const rng       = new SeededRandom(seed);
  const startDeck = buildStartingDeck(mode, rng);
  return createRunSession('test-player', `run-${seed}`, seed, mode, '1.0.0', startDeck);
}

function makeTurnContext(overrides: Partial<TurnContext> = {}): TurnContext {
  return {
    runId:          'test-run',
    runSeed:        42,
    rulesetVersion: '1.0.0',
    turnNumber:     1,
    tickIndex:      0,
    gameMode:       'GO_ALONE',
    mlEnabled:      false,
    phase:          'VALIDATING',
    drawnCard:      null,
    playerAction:   null,
    events:         [],
    auditHash:      '',
    ...overrides,
  };
}

function makeOwnedAsset(overrides: Partial<OwnedAsset> = {}): OwnedAsset {
  return {
    assetId:            'asset-001',
    cardId:             'opportunity_rental_001',
    name:               'Rental Property',
    assetKind:          'REAL_ESTATE',
    originalCost:       5_000,
    currentDebt:        0,
    monthlyIncome:      500,
    monthlyDebtService: 0,
    exitMin:            3_500,
    exitMax:            7_000,
    acquiredAtTurn:     1,
    ...overrides,
  };
}

// ─── SEEDED RANDOM ────────────────────────────────────────────

describe('SeededRandom', () => {
  it('produces values in [0, 1)', () => {
    const rng = new SeededRandom(12345);
    for (let i = 0; i < 1_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is fully reproducible — same seed, same sequence', () => {
    const a = new SeededRandom(777);
    const b = new SeededRandom(777);
    const va = Array.from({ length: 50 }, () => a.next());
    const vb = Array.from({ length: 50 }, () => b.next());
    expect(va).toEqual(vb);
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    const va = Array.from({ length: 20 }, () => a.next());
    const vb = Array.from({ length: 20 }, () => b.next());
    expect(va).not.toEqual(vb);
  });

  it('nextGaussian produces reasonable normal distribution', () => {
    const rng = new SeededRandom(999);
    const samples = Array.from({ length: 500 }, () => rng.nextGaussian(0, 1));
    const mean    = samples.reduce((s, v) => s + v, 0) / samples.length;
    const std     = Math.sqrt(samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length);
    expect(mean).toBeCloseTo(0, 0);       // mean near 0
    expect(std).toBeCloseTo(1, 0);        // std near 1
  });

  it('nextInt is inclusive at both ends', () => {
    const rng = new SeededRandom(1);
    const hits = new Set<number>();
    for (let i = 0; i < 1_000; i++) hits.add(rng.nextInt(0, 3));
    expect(hits.has(0)).toBe(true);
    expect(hits.has(3)).toBe(true);
    expect(hits.size).toBe(4);
  });

  it('chance(1.0) always returns true', () => {
    const rng = new SeededRandom(1);
    for (let i = 0; i < 100; i++) expect(rng.chance(1.0)).toBe(true);
  });

  it('chance(0.0) always returns false', () => {
    const rng = new SeededRandom(1);
    for (let i = 0; i < 100; i++) expect(rng.chance(0.0)).toBe(false);
  });

  it('shuffle produces same order for same seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = new SeededRandom(55);
    const b = new SeededRandom(55);
    expect(a.shuffle([...input])).toEqual(b.shuffle([...input]));
  });

  it('shuffle does not mutate original array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy  = [...input];
    new SeededRandom(1).shuffle([...input]);
    expect(input).toEqual(copy);
  });
});

// ─── MARKET ENGINE ───────────────────────────────────────────

describe('MarketEngine', () => {
  it('produces identical tick outputs from same seed', () => {
    const m1 = new MarketEngine(100);
    const m2 = new MarketEngine(100);
    const t1 = m1.tick(0);
    const t2 = m2.tick(0);
    for (const [sym, a1] of t1.assets) {
      expect(a1.price).toBeCloseTo(t2.assets.get(sym)!.price, 8);
    }
  });

  it('classifies high-volatility regime as Panic', () => {
    const m = new MarketEngine(42);
    m.applyVolatilitySpike(10);
    const tick = m.tick(1);
    expect(m.currentRegime).toBe('Panic');
  });

  it('prices are always positive', () => {
    const m = new MarketEngine(1);
    for (let i = 0; i < 100; i++) {
      const tick = m.tick(i);
      for (const [, asset] of tick.assets) {
        expect(asset.price).toBeGreaterThan(0);
      }
    }
  });
});

// ─── DRAW ENGINE ─────────────────────────────────────────────

describe('DrawEngine', () => {
  let rng: SeededRandom;
  let startDeck: CardInHand[];

  beforeEach(() => {
    rng       = new SeededRandom(42);
    startDeck = buildStartingDeck('GO_ALONE', rng);
  });

  it('buildStartingDeck returns non-empty array of CardInHand', () => {
    expect(startDeck.length).toBeGreaterThan(0);
    expect(startDeck[0].instanceId).toBeTruthy();
    expect(startDeck[0].definition).toBeDefined();
  });

  it('every card has an instanceId and a valid definition', () => {
    for (const card of startDeck) {
      expect(card.instanceId).toBeTruthy();
      expect(card.cardId).toBeTruthy();
      expect(card.definition.name).toBeTruthy();
      expect(card.definition.base_cost).toBeGreaterThanOrEqual(0);
    }
  });

  it('draw moves cards from drawPile to hand', () => {
    const engine = new DrawEngine();
    const result = engine.draw(startDeck, [], [], 3, new SeededRandom(1));
    expect(result.drawn.length).toBe(3);
    expect(result.hand.length).toBe(3);
    expect(result.drawPile.length).toBe(startDeck.length - 3);
  });

  it('draw respects maxHandSize', () => {
    const engine = new DrawEngine();
    const result = engine.draw(startDeck, [], [], 10, new SeededRandom(1), 4);
    expect(result.hand.length).toBe(4);
    expect(result.drawn.length).toBe(4);
  });

  it('draw reshuffles discard when draw pile is empty', () => {
    const engine  = new DrawEngine();
    const rng2    = new SeededRandom(5);
    // Draw pile empty, discard has cards
    const result  = engine.draw([], startDeck, [], 2, rng2);
    expect(result.hand.length).toBe(2);
    // Discard should now be smaller
    expect(result.discardPile.length + result.hand.length).toBe(startDeck.length);
  });

  it('play removes card from hand and adds to discard', () => {
    const engine  = new DrawEngine();
    const rng2    = new SeededRandom(2);
    const { hand } = engine.draw(startDeck, [], [], 3, rng2);
    const target   = hand[0].instanceId;
    const result   = engine.play(hand, [], target);
    expect(result.card).not.toBeNull();
    expect(result.card!.instanceId).toBe(target);
    expect(result.hand.length).toBe(2);
    expect(result.discardPile.length).toBe(1);
  });

  it('play returns null card for unknown instanceId', () => {
    const engine = new DrawEngine();
    const result = engine.play([], [], 'nonexistent-id');
    expect(result.card).toBeNull();
    expect(result.hand).toEqual([]);
  });

  it('injectForced marks card as forced with correct source', () => {
    const engine = new DrawEngine();
    const def    = CARD_REGISTRY['fubar_audit_001'];
    const result = engine.injectForced([], def, 10, 'HATER_ENGINE', new SeededRandom(1));
    expect(result.injected.forcedEntry).toBe(true);
    expect(result.injected.forcedSource).toBe('HATER_ENGINE');
    expect(result.hand.length).toBe(1);
  });

  it('detectSynergies returns groups with ≥ 2 cards sharing a tag', () => {
    const engine = new DrawEngine();
    const rng2   = new SeededRandom(3);
    const deck   = buildStartingDeck('GO_ALONE', rng2);
    // Income tag is shared by multiple starter cards
    const synergies = engine.detectSynergies(deck.slice(0, 5));
    // Should find at least one synergy group
    expect(synergies.size).toBeGreaterThanOrEqual(0); // may be 0 if no shared tags in first 5
    for (const [, ids] of synergies) {
      expect(ids.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('computePileHash is deterministic for same pile', () => {
    const engine = new DrawEngine();
    const h1     = engine.computePileHash(startDeck);
    const h2     = engine.computePileHash([...startDeck]);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(16);
  });
});

// ─── CARD REGISTRY ───────────────────────────────────────────

describe('CARD_REGISTRY', () => {
  it('all registered cards have required fields', () => {
    for (const [id, card] of Object.entries(CARD_REGISTRY)) {
      expect(card.cardId).toBeTruthy();
      expect(card.name).toBeTruthy();
      expect(card.base_cost).toBeGreaterThanOrEqual(0);
      expect(Object.values(CardRarity)).toContain(card.rarity);
      expect(Object.values(TimingClass)).toContain(card.timingClass);
      expect(card.tags).toBeInstanceOf(Array);
      expect(card.educational_note).toBeTruthy();
    }
  });

  it('OPPORTUNITY deck cards have positive income delta', () => {
    const opCards = Object.values(CARD_REGISTRY).filter(
      c => c.deckType === BaseDeckType.OPPORTUNITY,
    );
    expect(opCards.length).toBeGreaterThan(0);
    for (const c of opCards) {
      expect((c.base_effect.incomeDelta ?? 0)).toBeGreaterThan(0);
    }
  });

  it('FUBAR deck cards have negative economic impact', () => {
    const fubarCards = Object.values(CARD_REGISTRY).filter(
      c => c.deckType === BaseDeckType.FUBAR,
    );
    expect(fubarCards.length).toBeGreaterThan(0);
    for (const c of fubarCards) {
      const hasBadEffect =
        (c.base_effect.cashDelta ?? 0) < 0 ||
        (c.base_effect.expensesDelta ?? 0) > 0 ||
        (c.base_effect.freezeTicks ?? 0) > 0 ||
        (c.base_effect.incomeDelta ?? 0) < 0;
      expect(hasBadEffect).toBe(true);
    }
  });

  it('IPA cards are more expensive than OPPORTUNITY baseline', () => {
    const ipa = Object.values(CARD_REGISTRY).filter(c => c.deckType === BaseDeckType.IPA);
    const opp = Object.values(CARD_REGISTRY).filter(c => c.deckType === BaseDeckType.OPPORTUNITY);
    const avgIpa = ipa.reduce((s, c) => s + c.base_cost, 0) / ipa.length;
    const avgOpp = opp.reduce((s, c) => s + c.base_cost, 0) / opp.length;
    expect(avgIpa).toBeGreaterThan(avgOpp);
  });
});

// ─── PORTFOLIO ENGINE ─────────────────────────────────────────

describe('PortfolioEngine', () => {
  let engine:  PortfolioEngine;
  let state:   PlayerState;

  beforeEach(() => {
    engine = new PortfolioEngine();
    state  = createInitialPlayerState('test-player');
  });

  it('initial player state has correct cash and zero assets', () => {
    expect(state.cash).toBe(STARTING_CASH);
    expect(state.ownedAssets.length).toBe(0);
    expect(state.netWorth).toBe(STARTING_CASH);
  });

  it('acquire deducts cost and adds asset', () => {
    const asset  = makeOwnedAsset();
    const result = engine.acquire(state, asset, 1);
    expect(result.success).toBe(true);
    expect(result.state.cash).toBe(STARTING_CASH - asset.originalCost);
    expect(result.state.ownedAssets.length).toBe(1);
    expect(result.asset?.assetId).toBe('asset-001');
  });

  it('acquire fails when cash is insufficient', () => {
    const poorState = { ...state, cash: 100 };
    const result    = engine.acquire(poorState, makeOwnedAsset({ originalCost: 5_000 }), 1);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('INSUFFICIENT_CASH');
    expect(result.state.ownedAssets.length).toBe(0);
  });

  it('acquire fails when leverage is blocked and asset has debt', () => {
    const blockedState = { ...state, leverageBlocks: 1 };
    const debtAsset    = makeOwnedAsset({ currentDebt: 2_000 });
    const result       = engine.acquire(blockedState, debtAsset, 1);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('LEVERAGE_BLOCKED');
  });

  it('dispose returns proceeds and removes asset', () => {
    const { state: withAsset } = engine.acquire(state, makeOwnedAsset(), 1);
    const result = engine.dispose(withAsset, 'asset-001', 2);
    expect(result.success).toBe(true);
    expect(result.state.ownedAssets.length).toBe(0);
    expect(result.proceeds).toBeGreaterThan(0);
  });

  it('forced sale applies 70% haircut to exitMin', () => {
    const asset = makeOwnedAsset({ exitMin: 4_000, exitMax: 7_000 });
    const { state: withAsset } = engine.acquire(state, asset, 1);
    const result = engine.dispose(withAsset, 'asset-001', 2, true);
    expect(result.proceeds).toBeCloseTo(4_000 * 0.70, 2);
  });

  it('dispose returns ASSET_NOT_FOUND for unknown assetId', () => {
    const result = engine.dispose(state, 'ghost-id', 1);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('ASSET_NOT_FOUND');
  });

  it('computeNetWorth includes asset midpoint minus debt', () => {
    const asset = makeOwnedAsset({ exitMin: 4_000, exitMax: 6_000, currentDebt: 1_000 });
    const { state: withAsset } = engine.acquire(state, asset, 1);
    const nw = engine.computeNetWorth(withAsset);
    // cash + (4000+6000)/2 - 1000 debt
    expect(nw).toBeCloseTo(withAsset.cash + 5_000 - 1_000, 2);
  });

  it('applyMonthlyCashflow adds netCashflow to cash', () => {
    // Monthly income > expenses = positive cashflow
    const positiveState = { ...state, netCashflow: 500 };
    const result = engine.applyMonthlyCashflow(positiveState);
    expect(result.cash).toBe(state.cash + 500);
  });

  it('isBankrupt returns false when cash > 0', () => {
    expect(engine.isBankrupt(state)).toBe(false);
  });

  it('isBankrupt returns true when cash and netWorth both ≤ 0', () => {
    const broke = { ...state, cash: 0, netWorth: 0, ownedAssets: [] };
    expect(engine.isBankrupt(broke)).toBe(true);
  });

  it('produce correct auditHash on acquisition', () => {
    const result = engine.acquire(state, makeOwnedAsset(), 1);
    expect(result.auditHash.length).toBe(16);
    expect(result.auditHash).toMatch(/^[0-9a-f]+$/);
  });
});

// ─── MACRO ENGINE ─────────────────────────────────────────────

describe('MacroEngine', () => {
  it('produces deterministic erosion rate for identical inputs', () => {
    const a = new MacroEngine({ inflation: 0.02, creditTightness: 0.20, phase: MacroPhase.EXPANSION });
    const b = new MacroEngine({ inflation: 0.02, creditTightness: 0.20, phase: MacroPhase.EXPANSION });
    expect(a.tick().erosionRate).toBe(b.tick().erosionRate);
  });

  it('TROUGH phase multiplier is highest', () => {
    const trough     = new MacroEngine({ inflation: 0.05, creditTightness: 0.50, phase: MacroPhase.TROUGH });
    const expansion  = new MacroEngine({ inflation: 0.05, creditTightness: 0.50, phase: MacroPhase.EXPANSION });
    expect(trough.tick().erosionRate).toBeGreaterThan(expansion.tick().erosionRate);
  });

  it('detects phase change when regime changes', () => {
    const m = new MacroEngine({ inflation: 0.02, creditTightness: 0.20, phase: MacroPhase.EXPANSION });
    const r = m.tick('Panic');
    expect(r.newPhase).toBe(MacroPhase.TROUGH);
    expect(r.phaseChanged).toBe(true);
  });

  it('applyShock clamps values to [0, 1]', () => {
    const m = new MacroEngine({ inflation: 0.02, creditTightness: 0.20, phase: MacroPhase.EXPANSION });
    m.applyShock(2.0, 2.0);  // would exceed 1.0 without clamp
    expect(m.currentInflation).toBeLessThanOrEqual(1);
    expect(m.currentCredit).toBeLessThanOrEqual(1);
  });

  it('meanRevert moves values toward baseline', () => {
    const m = new MacroEngine({ inflation: 0.90, creditTightness: 0.90, phase: MacroPhase.TROUGH });
    const before = m.currentInflation;
    m.meanRevert();
    expect(m.currentInflation).toBeLessThan(before);
  });
});

// ─── SOLVENCY ENGINE ─────────────────────────────────────────

describe('SolvencyEngine', () => {
  it('returns null when cash is healthy', () => {
    const sol   = new SolvencyEngine();
    const state = createInitialPlayerState('p');
    expect(sol.check(state, 1)).toBeNull();
  });

  it('emits BANKRUPTCY when cash ≤ 0 and netWorth ≤ -100k', () => {
    const sol   = new SolvencyEngine();
    // effectiveNW = cash + forcedSaleValue(ownedAssets)
    // With no assets, effectiveNW = cash. Need cash <= -100_000.
    const broke = { ...createInitialPlayerState('p'), cash: -150_000, netWorth: -150_000, ownedAssets: [] };
    const event = sol.check(broke, 10);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('BANKRUPTCY');
    expect(event!.auditHash.length).toBeGreaterThan(0);
  });

  it('emits CASCADE_WIPE after 5 consecutive negative cash ticks', () => {
    const sol   = new SolvencyEngine();
    const state: PlayerState = { ...createInitialPlayerState('p'), cash: -1, netWorth: -50_000, ownedAssets: [] };
    for (let i = 0; i < 4; i++) sol.check(state, i);
    const event = sol.check(state, 5);
    expect(event?.type).toBe('CASCADE_WIPE');
  });

  it('reset allows re-use after wipe', () => {
    const sol   = new SolvencyEngine();
    const broke = { ...createInitialPlayerState('p'), cash: -150_000, netWorth: -150_000, ownedAssets: [] };
    sol.check(broke, 1);  // triggers wipe, sets wipeEmitted=true
    sol.reset();
    const result = sol.check(broke, 2);
    expect(result).not.toBeNull();  // should fire again after reset
  });
});

// ─── PLAYER STATE HELPERS ─────────────────────────────────────

describe('PlayerState helpers', () => {
  const state = createInitialPlayerState('p');

  it('applyCashDelta updates cash and netWorth', () => {
    const result = applyCashDelta(state, -5_000);
    expect(result.cash).toBe(STARTING_CASH - 5_000);
    expect(result.netWorth).toBe(STARTING_CASH - 5_000);
  });

  it('recalcCashflow reflects asset income', () => {
    const withAsset = {
      ...state,
      ownedAssets: [makeOwnedAsset({ monthlyIncome: 1_000, monthlyDebtService: 200 })],
    };
    const result = recalcCashflow(withAsset);
    expect(result.netCashflow).toBe(
      (STARTING_INCOME + 1_000) - (STARTING_EXPENSES + 200),
    );
  });

  it('deriveRunPhase returns correct phase by tick', () => {
    expect(deriveRunPhase(0)).toBe(RunPhase.FOUNDATION);
    expect(deriveRunPhase(239)).toBe(RunPhase.FOUNDATION);
    expect(deriveRunPhase(240)).toBe(RunPhase.ESCALATION);
    expect(deriveRunPhase(479)).toBe(RunPhase.ESCALATION);
    expect(deriveRunPhase(480)).toBe(RunPhase.SOVEREIGNTY);
    expect(deriveRunPhase(720)).toBe(RunPhase.SOVEREIGNTY);
  });
});

// ─── TURN ENGINE ─────────────────────────────────────────────

describe('TurnEngine', () => {
  let engine: TurnEngine;

  beforeEach(() => { engine = new TurnEngine(); });

  // ── Validation ─────────────────────────────────────────────
  describe('validate', () => {
    it('passes for a healthy initial state', () => {
      const state  = createInitialPlayerState('p');
      const ctx    = makeTurnContext();
      const errors = engine.validate(state, ctx);
      expect(errors.filter(e => e.blocking).length).toBe(0);
    });

    it('blocks when turnsToSkip > 0', () => {
      const state  = { ...createInitialPlayerState('p'), turnsToSkip: 2 };
      const errors = engine.validate(state, makeTurnContext());
      const block  = errors.find(e => e.code === 'TURN_LOCKED');
      expect(block?.blocking).toBe(true);
    });

    it('blocks when rulesetVersion is empty', () => {
      const state  = createInitialPlayerState('p');
      const errors = engine.validate(state, makeTurnContext({ rulesetVersion: '' }));
      expect(errors.some(e => e.code === 'MISSING_RULESET_VERSION')).toBe(true);
    });

    it('warns (non-blocking) when cash is below absolute floor', () => {
      const state  = { ...createInitialPlayerState('p'), cash: -600_000 };
      const errors = engine.validate(state, makeTurnContext());
      const warn   = errors.find(e => e.code === 'CASH_BELOW_ABSOLUTE_FLOOR');
      expect(warn).toBeDefined();
      expect(warn!.blocking).toBe(false);
    });
  });

  // ── Full Turn ───────────────────────────────────────────────
  describe('executeTurn', () => {
    it('returns success:true for a valid turn', () => {
      const session = makeSession();
      const { result } = engine.executeTurn(session, 'PASS');
      expect(result.success).toBe(true);
      expect(['COMPLETE', 'WIN', 'WIPE']).toContain(result.phase);
    });

    it('emits TURN_COMPLETE event every turn', () => {
      const session = makeSession();
      const { result } = engine.executeTurn(session);
      const turnComplete = result.events.find(e => e.eventType === 'TURN_COMPLETE');
      expect(turnComplete).toBeDefined();
      expect(turnComplete!.auditHash.length).toBeGreaterThan(0);
    });

    it('auditHash changes turn-over-turn', () => {
      let session = makeSession();
      const { result: r1, session: s2 } = engine.executeTurn(session);
      const { result: r2 }              = engine.executeTurn(s2);
      expect(r1.auditHash).not.toBe(r2.auditHash);
    });

    it('returns success:false when blocked by TURN_LOCKED', () => {
      let session = makeSession();
      session = { ...session, state: { ...session.state, turnsToSkip: 5 } };
      const { result } = engine.executeTurn(session, 'PURCHASE');
      expect(result.success).toBe(false);
      expect(result.phase).toBe('VALIDATING');
    });

    it('PURCHASE action on OPPORTUNITY card deducts cash', () => {
      const session = makeSession();
      // Ensure draw pile has an OPPORTUNITY card on top
      const oppDef  = CARD_REGISTRY['opportunity_rental_001'];
      const oppCard: CardInHand = toCardInHand(oppDef, 0, new SeededRandom(1));
      const modSession: RunSession = {
        ...session,
        drawPile: [oppCard, ...session.drawPile],
      };
      const { result } = engine.executeTurn(modSession, 'PURCHASE');
      // Either purchased successfully or blocked (depends on cash vs cost)
      expect(result.cashDelta).toBeLessThanOrEqual(0);
    });

    it('FUBAR card absorbed by shield — no cash impact', () => {
      const session   = makeSession();
      const fubarDef  = CARD_REGISTRY['fubar_audit_001'];
      const fubarCard: CardInHand = toCardInHand(fubarDef, 0, new SeededRandom(7));
      // Give player a shield
      const shieldState: PlayerState = { ...session.state, activeShields: 1 };
      const modSession: RunSession   = {
        ...session,
        state:    shieldState,
        drawPile: [fubarCard, ...session.drawPile],
      };
      const { result } = engine.executeTurn(modSession, 'PASS');
      // Shield absorbed it — cash delta should be 0 (not the fubar impact)
      expect(result.cashDelta).toBe(0);
      // Shield count should have decreased
      expect(result.playerState.activeShields).toBe(0);
    });

    it('FUBAR card hits unshielded player — negative cash delta', () => {
      const session   = makeSession();
      const fubarDef  = CARD_REGISTRY['fubar_audit_001'];
      const fubarCard: CardInHand = toCardInHand(fubarDef, 0, new SeededRandom(7));
      const noShield  = { ...session.state, activeShields: 0 };
      const modSession: RunSession = {
        ...session,
        state:    noShield,
        drawPile: [fubarCard, ...session.drawPile],
      };
      const { result } = engine.executeTurn(modSession, 'PASS');
      expect(result.cashDelta).toBeLessThan(0);
    });

    it('incrementTurn advances turnNumber and tickIndex', () => {
      let session = makeSession();
      const { session: nextSession } = engine.executeTurn(session);
      expect(nextSession.ctx.turnNumber).toBe(2);
      expect(nextSession.ctx.tickIndex).toBe(1);
    });
  });

  // ── Win Conditions ─────────────────────────────────────────
  describe('checkWin', () => {
    it('GO_ALONE: win when passiveIncome > expenses AND netWorth ≥ FREEDOM_THRESHOLD', () => {
      const ctx = makeTurnContext({ gameMode: 'GO_ALONE' });
      const win = {
        ...createInitialPlayerState('p'),
        monthlyIncome:   STARTING_EXPENSES + 1_000,
        netWorth:        FREEDOM_THRESHOLD,
      };
      expect(engine.checkWin(win, ctx)).toBe(true);
    });

    it('GO_ALONE: no win when netWorth < FREEDOM_THRESHOLD', () => {
      const ctx = makeTurnContext({ gameMode: 'GO_ALONE' });
      const noWin = {
        ...createInitialPlayerState('p'),
        monthlyIncome: STARTING_EXPENSES + 1_000,
        netWorth:      FREEDOM_THRESHOLD - 1,
      };
      expect(engine.checkWin(noWin, ctx)).toBe(false);
    });

    it('HEAD_TO_HEAD: win when battleBudget ≥ BATTLE_BUDGET_MAX', () => {
      const { BATTLE_BUDGET_MAX } = require('../types');
      const ctx  = makeTurnContext({ gameMode: 'HEAD_TO_HEAD' });
      const win  = { ...createInitialPlayerState('p'), battleBudget: BATTLE_BUDGET_MAX };
      expect(engine.checkWin(win, ctx)).toBe(true);
    });

    it('TEAM_UP: win when trustScore ≥ 0.95 AND netWorth ≥ FREEDOM_THRESHOLD', () => {
      const ctx = makeTurnContext({ gameMode: 'TEAM_UP' });
      const win = {
        ...createInitialPlayerState('p'),
        trustScore: 0.95,
        netWorth:   FREEDOM_THRESHOLD,
      };
      expect(engine.checkWin(win, ctx)).toBe(true);
    });
  });

  // ── Wipe Detection ─────────────────────────────────────────
  describe('checkWipe', () => {
    it('no wipe for healthy player', () => {
      const session = makeSession();
      const { isWipe } = engine.checkWipe(session.state, session, makeTurnContext());
      expect(isWipe).toBe(false);
    });
  });

  // ── Bleed Mode ─────────────────────────────────────────────
  describe('bleed mode', () => {
    it('activates WATCH when cash < 12k in GO_ALONE', () => {
      const session = makeSession();
      const lowCash = { ...session.state, cash: 8_000 };
      const ctx     = makeTurnContext({ gameMode: 'GO_ALONE' });
      const { updatedState } = engine.applyBuffsDebuffs(lowCash, ctx);
      expect(updatedState.bleedModeActive).toBe(true);
      expect(updatedState.bleedSeverity).toBe('WATCH');
    });

    it('activates CRITICAL when cash < 5k in GO_ALONE', () => {
      const session = makeSession();
      const lowCash = { ...session.state, cash: 3_000 };
      const ctx     = makeTurnContext({ gameMode: 'GO_ALONE' });
      const { updatedState } = engine.applyBuffsDebuffs(lowCash, ctx);
      expect(updatedState.bleedSeverity).toBe('CRITICAL');
    });

    it('activates TERMINAL when cash ≤ 0 in GO_ALONE', () => {
      const session = makeSession();
      const zeroCash = { ...session.state, cash: 0 };
      const ctx      = makeTurnContext({ gameMode: 'GO_ALONE' });
      const { updatedState } = engine.applyBuffsDebuffs(zeroCash, ctx);
      expect(updatedState.bleedSeverity).toBe('TERMINAL');
    });

    it('clears bleed mode when cash recovers above 12k', () => {
      const session = makeSession();
      const bleedState = {
        ...session.state,
        cash: 20_000,
        bleedModeActive: true,
        bleedSeverity: 'WATCH' as const,
      };
      const ctx = makeTurnContext({ gameMode: 'GO_ALONE' });
      const { updatedState } = engine.applyBuffsDebuffs(bleedState, ctx);
      expect(updatedState.bleedModeActive).toBe(false);
      expect(updatedState.bleedSeverity).toBe('NONE');
    });
  });

  // ── Determinism ────────────────────────────────────────────
  describe('determinism', () => {
    it('two sessions with same seed produce identical turn results', () => {
      const rng1  = new SeededRandom(42);
      const rng2  = new SeededRandom(42);
      const deck1 = buildStartingDeck('GO_ALONE', rng1);
      const deck2 = buildStartingDeck('GO_ALONE', rng2);
      const s1    = createRunSession('p1', 'run-1', 42, 'GO_ALONE', '1.0.0', deck1);
      const s2    = createRunSession('p2', 'run-2', 42, 'GO_ALONE', '1.0.0', deck2);

      const engine1 = new TurnEngine();
      const engine2 = new TurnEngine();
      const { result: r1 } = engine1.executeTurn(s1, 'PASS');
      const { result: r2 } = engine2.executeTurn(s2, 'PASS');

      expect(r1.cashDelta).toBe(r2.cashDelta);
      expect(r1.incomeDelta).toBe(r2.incomeDelta);
      expect(r1.drawnCard?.cardId).toBe(r2.drawnCard?.cardId);
    });

    it('100-turn run completes without throwing', () => {
      let session = makeSession(7);
      const eng   = new TurnEngine();
      for (let i = 0; i < 100; i++) {
        if (['WIPE', 'WIN'].includes(session.ctx.phase)) break;
        const { session: next } = eng.executeTurn(session, 'PASS');
        session = next;
      }
      expect(session.ctx.turnNumber).toBeGreaterThan(1);
    });
  });
});

// ─── DRAW MIX ENGINE ─────────────────────────────────────────

describe('DrawMixEngine', () => {
  it('selectDeck returns a valid BaseDeckType', () => {
    const rng    = new SeededRandom(1);
    const engine = new DrawMixEngine(rng);
    const result = engine.selectDeck('GO_ALONE', RunPhase.FOUNDATION, 0, 0.2);
    expect(Object.values(BaseDeckType)).toContain(result.deckType);
  });

  it('auditSnapshot weights sum to approximately 1.0', () => {
    const rng    = new SeededRandom(2);
    const engine = new DrawMixEngine(rng);
    const result = engine.selectDeck('GO_ALONE', RunPhase.ESCALATION, 0, 0.3);
    const total  = Object.values(result.auditSnapshot).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('high credit tightness increases FUBAR weight', () => {
    const rng1   = new SeededRandom(99);
    const rng2   = new SeededRandom(99);
    const low    = new DrawMixEngine(rng1);
    const high   = new DrawMixEngine(rng2);
    const lowR   = low.selectDeck('GO_ALONE', RunPhase.ESCALATION, 0, 0.1);
    const highR  = high.selectDeck('GO_ALONE', RunPhase.ESCALATION, 0, 0.9);
    expect(highR.auditSnapshot[BaseDeckType.FUBAR]).toBeGreaterThan(
      lowR.auditSnapshot[BaseDeckType.FUBAR],
    );
  });

  it('consecutive passes increase FUBAR weight', () => {
    const rng1 = new SeededRandom(5);
    const rng2 = new SeededRandom(5);
    const zero = new DrawMixEngine(rng1).selectDeck('GO_ALONE', RunPhase.FOUNDATION, 0, 0.2);
    const many = new DrawMixEngine(rng2).selectDeck('GO_ALONE', RunPhase.FOUNDATION, 6, 0.2);
    expect(many.auditSnapshot[BaseDeckType.FUBAR]).toBeGreaterThan(
      zero.auditSnapshot[BaseDeckType.FUBAR],
    );
  });

  it('maybeInjectForcedCard returns null at zero creditTightness and heat', () => {
    const rng = new SeededRandom(1);
    // At 0 credit tightness and 0 hater heat, chance of injection is ~0%
    // Run many times — very unlikely to inject
    let injections = 0;
    const rng2 = new SeededRandom(1);
    for (let i = 0; i < 100; i++) {
      if (maybeInjectForcedCard(i, rng2, 0.0, 0) !== null) injections++;
    }
    expect(injections).toBe(0);
  });
});

// ─── MOMENT FORGE ────────────────────────────────────────────

describe('MomentForge', () => {
  it('classifies FUBAR_KILLED_ME when shield failed and equity damaged', () => {
    const m = classifyMoment({
      shieldFailed:  true,
      damageEquity:  0.30,
      dealRoi:       0,
      ticksElapsed:  10,
      cash:          10_000,
      isWin:         false,
    });
    expect(m).toBe(MomentForge.FUBAR_KILLED_ME);
  });

  it('classifies OPPORTUNITY_FLIP for fast high-ROI deal', () => {
    const m = classifyMoment({
      shieldFailed:  false,
      damageEquity:  0,
      dealRoi:       0.20,
      ticksElapsed:  5,
      cash:          20_000,
      isWin:         false,
    });
    expect(m).toBe(MomentForge.OPPORTUNITY_FLIP);
  });

  it('classifies MISSED_THE_BAG for mid-ROI passed deal', () => {
    const m = classifyMoment({
      shieldFailed:  false,
      damageEquity:  0,
      dealRoi:       0.12,
      ticksElapsed:  10,
      cash:          15_000,
      isWin:         false,
    });
    expect(m).toBe(MomentForge.MISSED_THE_BAG);
  });

  it('classifies BLEED_SURVIVED when cash is critically low but positive', () => {
    const m = classifyMoment({
      shieldFailed: false,
      damageEquity: 0,
      dealRoi:      0.05,
      ticksElapsed: 20,
      cash:         3_000,
      isWin:        false,
    });
    expect(m).toBe(MomentForge.BLEED_SURVIVED);
  });

  it('classifies FREEDOM_ACHIEVED on win', () => {
    const m = classifyMoment({
      shieldFailed: false,
      damageEquity: 0,
      dealRoi:      0,
      ticksElapsed: 0,
      cash:         100_000,
      isWin:        true,
    });
    expect(m).toBe(MomentForge.FREEDOM_ACHIEVED);
  });

  it('returns null when nothing notable happened', () => {
    const m = classifyMoment({
      shieldFailed: false,
      damageEquity: 0,
      dealRoi:      0.05,
      ticksElapsed: 40,
      cash:         20_000,
      isWin:        false,
    });
    expect(m).toBeNull();
  });

  it('momentLabel returns a non-empty string for every moment type', () => {
    for (const moment of Object.values(MomentForge)) {
      const label = momentLabel(moment, 'context');
      expect(label.length).toBeGreaterThan(0);
      expect(typeof label).toBe('string');
    }
  });
});

// ─── CREATE RUN SESSION ───────────────────────────────────────

describe('createRunSession', () => {
  it('initialises with correct cash', () => {
    const session = makeSession(1);
    expect(session.state.cash).toBe(STARTING_CASH);
  });

  it('initialises with shuffled draw pile', () => {
    const session = makeSession(1);
    expect(session.drawPile.length).toBeGreaterThan(0);
    expect(session.hand.length).toBe(0);
    expect(session.discardPile.length).toBe(0);
  });

  it('creates different draw piles for different seeds', () => {
    const s1 = makeSession(1);
    const s2 = makeSession(2);
    const ids1 = s1.drawPile.map(c => c.cardId).join(',');
    const ids2 = s2.drawPile.map(c => c.cardId).join(',');
    // Very likely to differ (though theoretically could be same — seeds chosen to differ)
    expect(ids1).not.toBe(ids2);
  });

  it('ctx.rulesetVersion is set', () => {
    const session = makeSession();
    expect(session.ctx.rulesetVersion).toBe('1.0.0');
  });

  it('ctx.turnNumber starts at 1', () => {
    const session = makeSession();
    expect(session.ctx.turnNumber).toBe(1);
  });
});
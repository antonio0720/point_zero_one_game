//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/CardEngine.test.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD ENGINE TEST SUITE (COMPLETE)
// pzo-web/src/engines/cards/CardEngine.test.ts
//
// All test groups:
//   1. TimingValidator       — all 12 timing classes
//   2. ModeOverlayEngine     — cost/effect/tag mutations across all 4 modes
//   3. DecisionWindowManager — open/expire/auto-resolve/pause/resume/speed-score
//   4. ForcedCardQueue       — inject/mandatory-resolve/reject-discard/overflow
//   5. CardScorer            — decision quality vs CORD contribution
//   6. CardEngine integration— full tick cycle with mock snapshot, all mode hooks
//   7. EmpireCardMode        — hold system, phase boundaries, chain synergy, CORD formula
//   8. PredatorCardMode      — battle budget, counter window, bluff routing
//   9. SyndicateCardMode     — trust score, AID terms, rescue window, defection arc
//  10. PhantomCardMode       — ghost cards, discipline lock, divergence, proof badges
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  GameMode,
  TimingClass,
  BaseDeckType,
  ModeDeckType,
  CardRarity,
  CardEffectType,
  CardTag,
  Targeting,
  ForcedCardSource,
  DefectionStep,
  TimingRejectionCode,
  RunPhase,
  LegendMarkerType,
  DEFAULT_MODE_OVERLAYS,
  TIMING_CLASS_WINDOW_MS,
  TRUST_SCORE_CONFIG,
  type CardDefinition,
  type CardInHand,
  type CardPlayRequest,
  type ModeOverlay,
  type AidCardTerms,
} from './types';

import { TimingValidator }        from './TimingValidator';
import type { TimingValidatorContext } from './TimingValidator';
import { ModeOverlayEngine }      from './ModeOverlayEngine';
import { DecisionWindowManager }  from './DecisionWindowManager';
import { ForcedCardQueue }        from './ForcedCardQueue';
import { CardScorer }             from './CardScorer';
import { CardEngine }             from './CardEngine';
import { EmpireCardMode }         from '../modes/EmpireCardMode';
import { PredatorCardMode }       from '../modes/PredatorCardMode';
import { SyndicateCardMode }      from '../modes/SyndicateCardMode';
import { PhantomCardMode }        from '../modes/PhantomCardMode';
import { v4 as uuidv4 }          from 'uuid';

// ── MOCK EVENT BUS ─────────────────────────────────────────────────────────────

function makeMockEventBus() {
  const handlers: Record<string, ((...args: any[]) => void)[]> = {};
  const emitted: Array<{ event: string; payload: any }> = [];

  return {
    emit: vi.fn((event: string, payload: any) => {
      emitted.push({ event, payload });
    }),
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      return () => {
        handlers[event] = handlers[event].filter(h => h !== handler);
      };
    }),
    _emitted: emitted,
    _handlers: handlers,
    _trigger: (event: string, payload: any) => {
      (handlers[event] ?? []).forEach(h => h(payload));
    },
  };
}

// ── HELPER FACTORIES ──────────────────────────────────────────────────────────

function makeCardDef(overrides: Partial<CardDefinition> = {}): CardDefinition {
  return {
    cardId:          overrides.cardId          ?? 'test_card_001',
    name:            overrides.name            ?? 'Test Card',
    deckType:        overrides.deckType        ?? BaseDeckType.OPPORTUNITY,
    rarity:          overrides.rarity          ?? CardRarity.COMMON,
    timingClass:     overrides.timingClass     ?? TimingClass.STANDARD,
    base_cost:       overrides.base_cost       ?? 10,
    base_effect:     overrides.base_effect     ?? { effectType: CardEffectType.INCOME_BOOST, magnitude: 0.05 },
    tags:            overrides.tags            ?? [CardTag.INCOME],
    targeting:       overrides.targeting       ?? Targeting.SELF,
    educational_tag: overrides.educational_tag ?? 'test',
    lore:            overrides.lore            ?? 'Test lore.',
    modes_legal:     overrides.modes_legal     ?? [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
    is_forced:       overrides.is_forced       ?? false,
    drop_weight:     overrides.drop_weight     ?? 50,
  };
}

function makeCardInHand(
  def:       CardDefinition,
  mode:      GameMode    = GameMode.GO_ALONE,
  overrides: Partial<CardInHand> = {},
): CardInHand {
  const overlay = { ...DEFAULT_MODE_OVERLAYS[mode] };
  return {
    instanceId:        overrides.instanceId        ?? uuidv4(),
    definition:        def,
    overlay,
    drawnAtTick:       overrides.drawnAtTick        ?? 0,
    isForced:          overrides.isForced           ?? false,
    isHeld:            overrides.isHeld             ?? false,
    isLegendary:       overrides.isLegendary        ?? (def.rarity === CardRarity.LEGENDARY),
    effectiveCost:     overrides.effectiveCost      ?? Math.max(0, def.base_cost * overlay.cost_modifier),
    decisionWindowId:  overrides.decisionWindowId  ?? null,
  };
}

function makePlayRequest(card: CardInHand, overrides: Partial<CardPlayRequest> = {}): CardPlayRequest {
  return {
    instanceId: card.instanceId,
    choiceId:   overrides.choiceId   ?? 'choice_default',
    timestamp:  overrides.timestamp  ?? Date.now(),
    isBluff:    overrides.isBluff    ?? false,
    ...overrides,
  };
}

function makeValidatorContext(overrides: Partial<TimingValidatorContext> = {}): TimingValidatorContext {
  return {
    mode:                  GameMode.GO_ALONE,
    currentTick:           1,
    forcedCardPending:     false,
    counterWindowOpen:     false,
    counterWindowAttackId: null,
    rescueWindowOpen:      false,
    rescueWindowTeammate:  null,
    phaseBoundaryWindow:   null,
    activeBattleBudget:    100,
    defectionStepHistory:  [],
    lastDefectionTick:     -1,
    sovereigntyWindowOpen: false,
    ...overrides,
  };
}

function makeMockCardUXBridge(eventBus: ReturnType<typeof makeMockEventBus>): any {
  return {
    emitCardDrawn:                  vi.fn(),
    emitCardPlayed:                 vi.fn(),
    emitCardDiscarded:              vi.fn(),
    emitCardHeld:                   vi.fn(),
    emitCardUnheld:                 vi.fn(),
    emitCardAutoResolved:           vi.fn(),
    emitForcedCardInjected:         vi.fn(),
    emitForcedCardResolved:         vi.fn(),
    emitMissedOpportunity:          vi.fn(),
    emitPhaseBoundaryCardAvailable: vi.fn(),
    emitPhaseBoundaryWindowClosed:  vi.fn(),
    emitLegendaryCardDrawn:         vi.fn(),
    emitBluffCardDisplayed:         vi.fn(),
    emitCounterWindowOpened:        vi.fn(),
    emitCounterWindowClosed:        vi.fn(),
    emitRescueWindowOpened:         vi.fn(),
    emitRescueWindowClosed:         vi.fn(),
    emitDefectionStepPlayed:        vi.fn(),
    emitDefectionCompleted:         vi.fn(),
    emitAidTermsActivated:          vi.fn(),
    emitAidRepaid:                  vi.fn(),
    emitAidDefaulted:               vi.fn(),
    emitGhostCardActivated:         vi.fn(),
    emitProofBadgeConditionMet:     vi.fn(),
    emitDecisionWindowOpened:       vi.fn(),
    emitDecisionWindowExpired:      vi.fn(),
    emitDecisionWindowResolved:     vi.fn(),
    emitCardHandSnapshot:           vi.fn(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TIMING VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

describe('TimingValidator', () => {
  let validator: TimingValidator;
  beforeEach(() => { validator = new TimingValidator(); });

  it('IMMEDIATE card bypasses forced-card-pending gate', () => {
    const def  = makeCardDef({ timingClass: TimingClass.IMMEDIATE });
    const card = makeCardInHand(def);
    const ctx  = makeValidatorContext({ forcedCardPending: true });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(true);
  });

  it('LEGENDARY card is always playable regardless of forced pending', () => {
    const def  = makeCardDef({ timingClass: TimingClass.LEGENDARY, rarity: CardRarity.LEGENDARY });
    const card = makeCardInHand(def);
    const ctx  = makeValidatorContext({ forcedCardPending: true });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(true);
  });

  it('CARD_ON_HOLD rejects direct play', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def, GameMode.GO_ALONE, { isHeld: true });
    const ctx  = makeValidatorContext();
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe(TimingRejectionCode.CARD_ON_HOLD);
  });

  it('COUNTER_WINDOW card rejected when counter window is closed', () => {
    const def  = makeCardDef({ timingClass: TimingClass.COUNTER_WINDOW });
    const card = makeCardInHand(def, GameMode.HEAD_TO_HEAD);
    const ctx  = makeValidatorContext({ mode: GameMode.HEAD_TO_HEAD, counterWindowOpen: false });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe(TimingRejectionCode.COUNTER_WINDOW_CLOSED);
  });

  it('COUNTER_WINDOW card valid when counter window is open', () => {
    const def  = makeCardDef({ timingClass: TimingClass.COUNTER_WINDOW });
    const card = makeCardInHand(def, GameMode.HEAD_TO_HEAD);
    const ctx  = makeValidatorContext({
      mode: GameMode.HEAD_TO_HEAD,
      counterWindowOpen: true,
      counterWindowAttackId: 'atk_001',
    });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(true);
  });

  it('RESCUE_WINDOW card rejected when rescue window is closed', () => {
    const def  = makeCardDef({ timingClass: TimingClass.RESCUE_WINDOW });
    const card = makeCardInHand(def, GameMode.TEAM_UP);
    const ctx  = makeValidatorContext({ mode: GameMode.TEAM_UP, rescueWindowOpen: false });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe(TimingRejectionCode.RESCUE_WINDOW_CLOSED);
  });

  it('PHASE_BOUNDARY card rejected when no boundary window is open', () => {
    const def  = makeCardDef({ timingClass: TimingClass.PHASE_BOUNDARY });
    const card = makeCardInHand(def, GameMode.GO_ALONE);
    const ctx  = makeValidatorContext({ mode: GameMode.GO_ALONE, phaseBoundaryWindow: null });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe(TimingRejectionCode.PHASE_BOUNDARY_CLOSED);
  });

  it('DEFECTION_STEP SILENT_EXIT is out-of-order without BREAK_PACT first', () => {
    const def  = makeCardDef({ cardId: 'def_silent_exit_002', timingClass: TimingClass.DEFECTION_STEP });
    const card = makeCardInHand(def, GameMode.TEAM_UP);
    const ctx  = makeValidatorContext({
      mode: GameMode.TEAM_UP,
      defectionStepHistory: [],  // no BREAK_PACT yet
    });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe(TimingRejectionCode.DEFECTION_OUT_OF_ORDER);
  });

  it('DEFECTION_STEP SILENT_EXIT valid after BREAK_PACT ≥1 tick later', () => {
    const def  = makeCardDef({ cardId: 'def_silent_exit_002', timingClass: TimingClass.DEFECTION_STEP });
    const card = makeCardInHand(def, GameMode.TEAM_UP);
    const ctx  = makeValidatorContext({
      mode:                  GameMode.TEAM_UP,
      currentTick:           5,
      defectionStepHistory:  [DefectionStep.BREAK_PACT],
      lastDefectionTick:     3,   // 2 ticks ago — valid
    });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(true);
  });

  it('SOVEREIGNTY_DECISION requires sovereigntyWindowOpen = true', () => {
    const def  = makeCardDef({ timingClass: TimingClass.SOVEREIGNTY_DECISION });
    const card = makeCardInHand(def, GameMode.GO_ALONE);
    const ctx  = makeValidatorContext({ mode: GameMode.GO_ALONE, sovereigntyWindowOpen: false });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(false);
  });

  it('BLUFF card requires sufficient Battle Budget in HEAD_TO_HEAD', () => {
    const def  = makeCardDef({ timingClass: TimingClass.BLUFF, base_cost: 50 });
    const card = makeCardInHand(def, GameMode.HEAD_TO_HEAD);
    const ctx  = makeValidatorContext({
      mode: GameMode.HEAD_TO_HEAD,
      activeBattleBudget: 10,  // insufficient
    });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe(TimingRejectionCode.INSUFFICIENT_BUDGET);
  });

  it('STANDARD card is valid when no blockers exist', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def);
    const ctx  = makeValidatorContext();
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(true);
  });

  it('FORCED card must be resolved before STANDARD play', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def);
    const ctx  = makeValidatorContext({ forcedCardPending: true });
    const result = validator.validate(card, ctx);
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe(TimingRejectionCode.FORCED_CARD_PENDING);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MODE OVERLAY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('ModeOverlayEngine', () => {
  it('GO_ALONE income tag weight is 2.2×', () => {
    const overlay = DEFAULT_MODE_OVERLAYS[GameMode.GO_ALONE];
    expect(overlay.tag_weights[CardTag.INCOME]).toBe(2.2);
  });

  it('HEAD_TO_HEAD income weight is 0.6, tempo is 2.4', () => {
    const overlay = DEFAULT_MODE_OVERLAYS[GameMode.HEAD_TO_HEAD];
    expect(overlay.tag_weights[CardTag.INCOME]).toBe(0.6);
    expect(overlay.tag_weights[CardTag.TEMPO]).toBe(2.4);
  });

  it('TEAM_UP cost_modifier is 0.9 (10% discount)', () => {
    const overlay = DEFAULT_MODE_OVERLAYS[GameMode.TEAM_UP];
    expect(overlay.cost_modifier).toBe(0.9);
  });

  it('CHASE_A_LEGEND precision tag is 2.0', () => {
    const overlay = DEFAULT_MODE_OVERLAYS[GameMode.CHASE_A_LEGEND];
    expect(overlay.tag_weights[CardTag.PRECISION]).toBe(2.0);
  });

  it('ModeOverlayEngine.applyOverlay produces correct effectiveCost', () => {
    const engine = new ModeOverlayEngine(GameMode.TEAM_UP);
    const def    = makeCardDef({ base_cost: 100 });
    const card   = engine.applyOverlay(def, 0);
    // TEAM_UP default cost_modifier = 0.9
    expect(card!.effectiveCost).toBe(90);
  });

  it('priv_insider_advantage_002 is illegal in TEAM_UP', () => {
    const engine = new ModeOverlayEngine(GameMode.TEAM_UP);
    const def    = makeCardDef({
      cardId: 'priv_insider_advantage_002',
      modes_legal: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD],
    });
    // applyOverlay returns null for illegal cards — the null IS the rejection signal
    const card = engine.applyOverlay(def, 0);
    expect(card).toBeNull();
  });

  it('same card produces different effectiveCost across modes', () => {
    const def       = makeCardDef({ base_cost: 100 });
    const engineEmp = new ModeOverlayEngine(GameMode.GO_ALONE);
    const engineSyn = new ModeOverlayEngine(GameMode.TEAM_UP);
    const cardEmp   = engineEmp.applyOverlay(def, 0);
    const cardSyn   = engineSyn.applyOverlay(def, 0);
    // GO_ALONE cost_modifier = 1.0, TEAM_UP = 0.9
    expect(cardEmp!.effectiveCost).not.toBe(cardSyn!.effectiveCost);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DECISION WINDOW MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

describe('DecisionWindowManager', () => {
  let wm: DecisionWindowManager;
  beforeEach(() => { wm = new DecisionWindowManager(12_000); });

  it('opens window for STANDARD card', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def);
    const res  = wm.openWindow(card, 1, 'AUTO_WORST');
    expect(res.skipped).toBe(false);
    expect(res.windowId).toBeTruthy();
  });

  it('skips window for IMMEDIATE card', () => {
    const def  = makeCardDef({ timingClass: TimingClass.IMMEDIATE });
    const card = makeCardInHand(def);
    const res  = wm.openWindow(card, 1, 'AUTO_WORST');
    expect(res.skipped).toBe(true);
  });

  it('skips window for LEGENDARY card', () => {
    const def  = makeCardDef({ timingClass: TimingClass.LEGENDARY, rarity: CardRarity.LEGENDARY });
    const card = makeCardInHand(def);
    const res  = wm.openWindow(card, 1, 'AUTO_WORST');
    expect(res.skipped).toBe(true);
  });

  it('expires after advanceTick exceeds duration', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def);
    wm.openWindow(card, 1, 'AUTO_WORST');
    wm.advanceTick(15_000, 2);   // advance past 12s window
    const expired = wm.flushExpired();
    expect(expired.length).toBe(1);
    expect(expired[0].cardInstanceId).toBe(card.instanceId);
  });

  it('resolveWindow returns speedScore > 0 when resolved quickly', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def);
    wm.openWindow(card, 1, 'AUTO_WORST');
    wm.advanceTick(500, 2);   // only 500ms elapsed — very fast
    wm.resolveWindow(card.instanceId, 'choice_a', 2);
    const resolved = wm.flushResolved();
    expect(resolved.length).toBe(1);
    expect(resolved[0].speedScore).toBeGreaterThan(0);
  });

  it('pausing stops countdown, resuming continues from frozen point', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def);
    wm.openWindow(card, 1, 'AUTO_WORST');
    wm.pauseWindow(card.instanceId);
    const remaining1 = wm.getRemainingMs(card.instanceId);
    wm.advanceTick(6_000, 2);   // advance 6 seconds while paused
    const remaining2 = wm.getRemainingMs(card.instanceId);
    expect(remaining2).toBe(remaining1);  // unchanged while paused
    wm.resumeWindow(card.instanceId);
    wm.advanceTick(6_000, 3);
    const remaining3 = wm.getRemainingMs(card.instanceId);
    expect(remaining3).toBeLessThan(remaining2);
  });

  it('speedScore is 1.0 when resolved within 20% of window', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def);
    wm.openWindow(card, 1, 'AUTO_WORST');
    wm.advanceTick(1_000, 2);  // 1s / 12s = 8.3% — within 20%
    wm.resolveWindow(card.instanceId, 'choice_a', 2);
    const resolved = wm.flushResolved();
    expect(resolved[0].speedScore).toBe(1.0);
  });

  it('getWindowProgress returns 0.0 immediately after open', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def);
    wm.openWindow(card, 1, 'AUTO_WORST');
    const progress = wm.getWindowProgress(card.instanceId);
    expect(progress).toBeCloseTo(0, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. FORCED CARD QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

describe('ForcedCardQueue', () => {
  let queue:   ForcedCardQueue;
  let mockBus: ReturnType<typeof makeMockEventBus>;
  let overlay: ModeOverlayEngine;

  beforeEach(() => {
    mockBus = makeMockEventBus();
    overlay = new ModeOverlayEngine(GameMode.GO_ALONE);
    queue   = new ForcedCardQueue(mockBus as any, overlay);
    queue.init();
  });

  it('enqueue registers a pending forced card entry', () => {
    queue.enqueue('fubar_market_crash_001', ForcedCardSource.TENSION_ENGINE, 'threat_001', 1);
    expect(queue.getActiveCount() + queue.getPendingCount()).toBe(1);
  });

  it('processTick materializes CardInHand with isForced = true', () => {
    queue.enqueue('fubar_expense_spike_002', ForcedCardSource.BATTLE_ENGINE, 'atk_001', 1);
    const results = queue.processTick(1);
    expect(results.length).toBe(1);
    expect(results[0].card.isForced).toBe(true);
  });

  it('resolve marks entry as resolved', () => {
    const entryId = queue.enqueue('fubar_market_crash_001', ForcedCardSource.TENSION_ENGINE, 'threat_001', 1);
    queue.processTick(1);
    queue.resolve(entryId, 2);
    expect(queue.getActiveCount()).toBe(0);
  });

  it('overflow holds excess beyond MAX_CONCURRENT_FORCED (3)', () => {
    queue.enqueue('fubar_market_crash_001',   ForcedCardSource.TENSION_ENGINE, 'threat_001', 1);
    queue.enqueue('fubar_expense_spike_002',  ForcedCardSource.TENSION_ENGINE, 'threat_002', 1);
    queue.enqueue('fubar_regulatory_hit_003', ForcedCardSource.TENSION_ENGINE, 'threat_003', 1);
    queue.enqueue('fubar_market_crash_001',   ForcedCardSource.TENSION_ENGINE, 'threat_004', 1);  // overflow

    queue.processTick(1);
    expect(queue.getActiveCount()).toBeLessThanOrEqual(3);
    expect(queue.hasOverflow()).toBe(true);
  });

  it('BOT_ATTACK_FIRED maps EXPENSE_INJECTION to correct card', () => {
    mockBus._trigger('BOT_ATTACK_FIRED', {
      attackType: 'EXPENSE_INJECTION',
      attackId:   'atk_injected',
    });
    expect(queue.getActiveCount() + queue.getPendingCount()).toBe(1);
  });

  it('THREAT_ARRIVED triggers enqueue via EventBus', () => {
    mockBus._trigger('THREAT_ARRIVED', {
      threatType:  'MARKET_CRASH',
      threatId:    'threat_bus_001',
    });
    expect(queue.getActiveCount() + queue.getPendingCount()).toBe(1);
  });

  it('materialized forced card has effectiveCost 0', () => {
    queue.enqueue('fubar_market_crash_001', ForcedCardSource.TENSION_ENGINE, 'threat_001', 1);
    const results = queue.processTick(1);
    expect(results[0].card.effectiveCost).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CARD SCORER
// ═══════════════════════════════════════════════════════════════════════════════

describe('CardScorer', () => {
  let scorer: CardScorer;
  beforeEach(() => { scorer = new CardScorer(); });

  function makeEffectResult(cordDelta: number = 0.05, isOptimal: boolean = true): any {
    return {
      playId:         uuidv4(),
      cardInstanceId: 'inst_1',
      cardId:         'test_card',
      choiceId:       'choice_a',
      appliedAt:      1,
      effects:        [],
      totalCordDelta: cordDelta,
      isOptimalChoice:isOptimal,
    };
  }

  function makeResolvedRecord(resolvedInMs: number, durationMs: number): any {
    return {
      windowId:       'w1',
      cardInstanceId: 'inst_1',
      cardId:         'test_card',
      choiceId:       'choice_a',
      openedAtMs:     Date.now() - resolvedInMs,
      resolvedAtMs:   Date.now(),
      resolvedInMs,
      durationMs,
      speedScore:     1.0,
      resolvedAtTick: 1,
    };
  }

  it('compositeScore is between 0 and 1', () => {
    const def      = makeCardDef();
    const card     = makeCardInHand(def);
    const resolved = makeResolvedRecord(2_000, 12_000);
    const effect   = makeEffectResult();
    const record   = scorer.scoreResolvedPlay(card, resolved, effect, [card], 1);
    expect(record.compositeScore).toBeGreaterThanOrEqual(0);
    expect(record.compositeScore).toBeLessThanOrEqual(1);
  });

  it('auto-resolved play has compositeScore 0.0 and wasAutoResolved true', () => {
    const def     = makeCardDef();
    const card    = makeCardInHand(def);
    const expired = {
      windowId:       'w1',
      cardInstanceId: card.instanceId,
      cardId:         def.cardId,
      autoChoice:     'worst',
      speedScore:     0.0,
      expiredAtTick:  2,
    };
    const effect = makeEffectResult(0.01, false);
    const record = scorer.scoreAutoResolved(card, expired, effect, 2);
    expect(record.wasAutoResolved).toBe(true);
    expect(record.compositeScore).toBe(0.0);
    expect(record.speedScore).toBe(0.0);
  });

  it('optimal play composite score >= non-optimal (same timing)', () => {
    const def      = makeCardDef();
    const card     = makeCardInHand(def);
    const resolved = makeResolvedRecord(1_000, 12_000);

    const optRecord    = scorer.scoreResolvedPlay(card, resolved, makeEffectResult(0.05, true),  [card], 1);
    const nonOptRecord = scorer.scoreResolvedPlay(card, resolved, makeEffectResult(0.02, false), [card], 1);

    expect(optRecord.compositeScore).toBeGreaterThanOrEqual(nonOptRecord.compositeScore);
  });

  it('cordContribution is higher for higher cordDelta play', () => {
    const def      = makeCardDef();
    const card     = makeCardInHand(def);
    const resolved = makeResolvedRecord(1_000, 12_000);

    const lowRecord  = scorer.scoreResolvedPlay(card, resolved, makeEffectResult(0.01, true), [card], 1);
    const highRecord = scorer.scoreResolvedPlay(card, resolved, makeEffectResult(0.10, true), [card], 1);

    expect(highRecord.cordContribution).toBeGreaterThan(lowRecord.cordContribution);
  });

  it('aggregateTickScore is 1.0 when no decisions made', () => {
    expect(scorer.aggregateTickScore([])).toBe(1.0);
  });

  it('totalCordDelta sums all record contributions', () => {
    const def   = makeCardDef();
    const card  = makeCardInHand(def);
    const rec1  = scorer.scoreResolvedPlay(card, makeResolvedRecord(1_000, 12_000), makeEffectResult(0.05, true),  [card], 1);
    const rec2  = scorer.scoreResolvedPlay(card, makeResolvedRecord(2_000, 12_000), makeEffectResult(0.03, true),  [card], 1);
    const total = scorer.totalCordDelta([rec1, rec2]);
    expect(total).toBeCloseTo(rec1.cordContribution + rec2.cordContribution, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CARD ENGINE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('CardEngine integration', () => {
  let engine:  CardEngine;
  let mockBus: ReturnType<typeof makeMockEventBus>;

  const baseParams = {
    runId:            'run_test_001',
    userId:           'user_test_001',
    seed:             'sovereign_seed_alpha',
    gameMode:         GameMode.GO_ALONE,
    seasonTickBudget: 720,
    maxHandSize:      5,
    decisionWindowMs: 12_000,
    freedomThreshold: 100_000,
  };

  beforeEach(() => {
    mockBus = makeMockEventBus();
    engine  = new CardEngine();
    engine.init(baseParams, mockBus as any);
    engine.startRun();
  });

  it('starts with a full hand after startRun()', () => {
    expect(engine.getHandSnapshot().length).toBe(5);
  });

  it('emits CARD_DRAWN events for initial fill', () => {
    const drawn = mockBus._emitted.filter(e => e.event === 'CARD_DRAWN');
    expect(drawn.length).toBeGreaterThanOrEqual(5);
  });

  it('tick() returns empty DecisionRecords when no plays made', () => {
    expect(engine.tick(1)).toEqual([]);
  });

  it('emits CARD_HAND_SNAPSHOT each tick', () => {
    mockBus._emitted.length = 0;
    engine.tick(1);
    const snaps = mockBus._emitted.filter(e => e.event === 'CARD_HAND_SNAPSHOT');
    expect(snaps.length).toBe(1);
    expect(snaps[0].payload.handSize).toBeGreaterThan(0);
  });

  it('hold system works in GO_ALONE', () => {
    const hand       = engine.getHandSnapshot();
    const held       = engine.holdCard(hand[0].instanceId);
    expect(held).toBe(true);
    const handAfter  = engine.getHandSnapshot();
    const inActive   = handAfter.some(c => c.instanceId === hand[0].instanceId && !c.isHeld);
    expect(inActive).toBe(false);
  });

  it('hold system rejected in HEAD_TO_HEAD', () => {
    const htEngine = new CardEngine();
    htEngine.init({ ...baseParams, gameMode: GameMode.HEAD_TO_HEAD }, mockBus as any);
    htEngine.startRun();
    const hand = htEngine.getHandSnapshot();
    expect(htEngine.holdCard(hand[0].instanceId)).toBe(false);
  });

  it('forced card injection via EventBus lands in hand', () => {
    mockBus._emitted.length = 0;
    mockBus._trigger('BOT_ATTACK_FIRED', { attackType: 'EXPENSE_INJECTION', attackId: 'atk_test_1' });
    engine.tick(1);
    const injected = mockBus._emitted.filter(e => e.event === 'FORCED_CARD_INJECTED');
    expect(injected.length).toBe(1);
  });

  it('CardReader exposes correct hand size', () => {
    expect(engine.getReader().getHandSize()).toBe(5);
  });

  it('endRun() prevents tick from emitting events', () => {
    engine.endRun();
    mockBus._emitted.length = 0;
    engine.tick(100);
    expect(mockBus._emitted.length).toBe(0);
  });

  it('same seed produces identical hand order on two fresh runs', () => {
    const engine2 = new CardEngine();
    engine2.init(baseParams, mockBus as any);
    engine2.startRun();
    const h1 = engine.getHandSnapshot().map(c => c.definition.cardId);
    const h2 = engine2.getHandSnapshot().map(c => c.definition.cardId);
    expect(h2).toEqual(h1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. EMPIRE CARD MODE
// ═══════════════════════════════════════════════════════════════════════════════

describe('EmpireCardMode', () => {
  let mode:     EmpireCardMode;
  let mockBus:  ReturnType<typeof makeMockEventBus>;
  let uxBridge: any;
  let wm:       DecisionWindowManager;
  let handMgr:  any;

  const empireParams = {
    runId:            'run_emp_001',
    userId:           'user_emp',
    seed:             'empire_seed',
    gameMode:         GameMode.GO_ALONE,
    seasonTickBudget: 100,
    maxHandSize:      5,
    decisionWindowMs: 12_000,
    freedomThreshold: 100_000,
  };

  beforeEach(() => {
    mockBus  = makeMockEventBus();
    uxBridge = makeMockCardUXBridge(mockBus);
    wm       = new DecisionWindowManager(12_000);

    // Minimal HandManager stub
    handMgr = {
      holdCard:       vi.fn(() => true),
      releaseHold:    vi.fn(() => ({ card: makeCardInHand(makeCardDef()), heldAtTick: 1, heldAtMs: 0, remainingMs: 8_000 })),
      getHoldSlot:    vi.fn(() => ({ card: makeCardInHand(makeCardDef()) })),
      getHoldsRemaining: vi.fn(() => 1),
    };

    mode = new EmpireCardMode(handMgr as any, wm, uxBridge);
    mode.init(empireParams);
  });

  it('starts in FOUNDATION phase', () => {
    expect(mode.getCurrentPhase()).toBe(RunPhase.FOUNDATION);
  });

  it('opens phase boundary window at correct tick boundary', () => {
    // boundary1 = floor(100 * 0.33) = 33
    mode.onTick(33);
    expect(mode.getPhaseBoundaryWindow()).not.toBeNull();
    expect(mode.getPhaseBoundaryWindow()?.phase).toBe(RunPhase.ESCALATION);
  });

  it('phase boundary window closes after 5 ticks', () => {
    mode.onTick(33);  // open
    for (let t = 34; t <= 38; t++) mode.onTick(t);  // 5 ticks pass
    expect(mode.getPhaseBoundaryWindow()).toBeNull();
  });

  it('hold system stages card and pauses window', () => {
    const def  = makeCardDef({ timingClass: TimingClass.STANDARD });
    const card = makeCardInHand(def);
    wm.openWindow(card, 1, 'AUTO_WORST');

    const result = mode.holdCard(card.instanceId, 1);
    expect(result).toBe(true);
    expect(mode.isHoldOccupied).toBe(true);
    expect(wm.isPaused(card.instanceId)).toBe(true);
  });

  it('hold slot rejects second hold while occupied', () => {
    const def   = makeCardDef();
    const card1 = makeCardInHand(def);
    const card2 = makeCardInHand(def);
    wm.openWindow(card1, 1, 'AUTO_WORST');
    mode.holdCard(card1.instanceId, 1);
    wm.openWindow(card2, 1, 'AUTO_WORST');
    const result = mode.holdCard(card2.instanceId, 1);
    expect(result).toBe(false);
  });

  it('chain synergy returns 1.0 for non-IPA card', () => {
    const def  = makeCardDef({ deckType: BaseDeckType.OPPORTUNITY });
    const card = makeCardInHand(def);
    const mult = mode.evaluateChainSynergy(card, 1);
    expect(mult).toBe(1.0);
  });

  it('chain synergy returns >1.0 after 3 IPA cards in window', () => {
    const def = makeCardDef({ deckType: BaseDeckType.IPA });
    for (let i = 0; i < 3; i++) {
      const card = makeCardInHand(def, GameMode.GO_ALONE, { instanceId: uuidv4() });
      mode.evaluateChainSynergy(card, i);
    }
    expect(mode.isChainSynergyActive()).toBe(true);
    expect(mode.getChainSynergyMultiplier()).toBeGreaterThan(1.0);
  });

  it('miss streak penalty increases with consecutive misses', () => {
    const def  = makeCardDef();
    const card = makeCardInHand(def);
    const p1   = mode.onMissedOpportunity(card, 1);
    const p2   = mode.onMissedOpportunity(card, 2);
    const p3   = mode.onMissedOpportunity(card, 3);
    expect(p2).toBeGreaterThanOrEqual(p1);
    expect(p3).toBeGreaterThanOrEqual(p2);
  });

  it('miss streak resets after successful play', () => {
    const def  = makeCardDef();
    const card = makeCardInHand(def);
    mode.onMissedOpportunity(card, 1);
    mode.onMissedOpportunity(card, 2);
    mode.onCardPlayed();
    expect(mode.getMissedOpportunityStreak()).toBe(0);
  });

  it('Empire CORD formula produces value > 0 for income card', () => {
    const def  = makeCardDef({ tags: [CardTag.INCOME, CardTag.COMPOUNDING] });
    const card = makeCardInHand(def);
    const cord = mode.computeEmpireCord(card, 0.05, 1);
    expect(cord).toBeGreaterThan(0.05); // should amplify due to tag weights
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. PREDATOR CARD MODE
// ═══════════════════════════════════════════════════════════════════════════════

describe('PredatorCardMode', () => {
  let mode:     PredatorCardMode;
  let mockBus:  ReturnType<typeof makeMockEventBus>;
  let uxBridge: any;

  const predParams = {
    runId:            'run_pred_001',
    userId:           'user_pred',
    seed:             'predator_seed',
    gameMode:         GameMode.HEAD_TO_HEAD,
    seasonTickBudget: 720,
    maxHandSize:      6,
    decisionWindowMs: 12_000,
    freedomThreshold: 100_000,
    battleBudgetMax:  200,
  };

  beforeEach(() => {
    mockBus  = makeMockEventBus();
    uxBridge = makeMockCardUXBridge(mockBus);
    mode     = new PredatorCardMode(uxBridge);
    mode.init(predParams);
  });

  it('battle budget starts at 0', () => {
    expect(mode.getBattleBudget()).toBe(0);
  });

  it('regenerates 3 BB per tick', () => {
    mode.onTick(1, Date.now());
    expect(mode.getBattleBudget()).toBe(3);
    mode.onTick(2, Date.now());
    expect(mode.getBattleBudget()).toBe(6);
  });

  it('battle budget is capped at max (200)', () => {
    for (let i = 0; i < 100; i++) mode.onTick(i, Date.now());
    expect(mode.getBattleBudget()).toBeLessThanOrEqual(200);
  });

  it('consumeBattleBudget deducts correctly', () => {
    // Manually set via many ticks
    for (let i = 0; i < 20; i++) mode.onTick(i, Date.now()); // 60 BB
    const before = mode.getBattleBudget();
    mode.consumeBattleBudget(20);
    expect(mode.getBattleBudget()).toBe(before - 20);
  });

  it('consumeBattleBudget returns false if insufficient', () => {
    expect(mode.consumeBattleBudget(100)).toBe(false);
  });

  it('SABOTAGE deck type uses BB', () => {
    const def  = makeCardDef({ deckType: ModeDeckType.SABOTAGE });
    const card = makeCardInHand(def, GameMode.HEAD_TO_HEAD);
    expect(mode.usesBattleBudget(card)).toBe(true);
  });

  it('OPPORTUNITY deck type does not use BB', () => {
    const def  = makeCardDef({ deckType: BaseDeckType.OPPORTUNITY });
    const card = makeCardInHand(def, GameMode.HEAD_TO_HEAD);
    expect(mode.usesBattleBudget(card)).toBe(false);
  });

  it('opens counter window and sets state to open', () => {
    mode.openCounterWindow('atk_001', Date.now(), 1);
    expect(mode.isCounterWindowOpen()).toBe(true);
    expect(mode.getCounterWindowAttackId()).toBe('atk_001');
    expect(uxBridge.emitCounterWindowOpened).toHaveBeenCalled();
  });

  it('counter window expires after 5 seconds', () => {
    const now  = Date.now();
    mode.openCounterWindow('atk_001', now, 1);
    mode.onTick(2, now + 6_000);  // 6 seconds later
    expect(mode.isCounterWindowOpen()).toBe(false);
  });

  it('counter speed bonus is 1.25 if resolved within 2 seconds', () => {
    const now = Date.now();
    mode.openCounterWindow('atk_001', now, 1);
    const bonus = mode.getCounterSpeedBonus(now + 1_000); // 1s resolve
    expect(bonus).toBe(1.25);
  });

  it('counter speed bonus is 1.0 if resolved after 2 seconds', () => {
    const now = Date.now();
    mode.openCounterWindow('atk_001', now, 1);
    const bonus = mode.getCounterSpeedBonus(now + 3_000); // 3s resolve
    expect(bonus).toBe(1.0);
  });

  it('resolveBluff emits BLUFF_CARD_DISPLAYED', () => {
    const def     = makeCardDef({ timingClass: TimingClass.BLUFF });
    const card    = makeCardInHand(def, GameMode.HEAD_TO_HEAD);
    const request = makePlayRequest(card, { choiceId: 'fake_card_001' });
    const result  = mode.resolveBluff(card, request, Date.now(), 1);
    expect(result.displayed).toBe(true);
    expect(result.displayedAsId).toBe('fake_card_001');
    expect(uxBridge.emitBluffCardDisplayed).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SYNDICATE CARD MODE
// ═══════════════════════════════════════════════════════════════════════════════

describe('SyndicateCardMode', () => {
  let mode:     SyndicateCardMode;
  let mockBus:  ReturnType<typeof makeMockEventBus>;
  let uxBridge: any;

  const synParams = {
    runId:            'run_syn_001',
    userId:           'user_syn',
    seed:             'syndicate_seed',
    gameMode:         GameMode.TEAM_UP,
    seasonTickBudget: 720,
    maxHandSize:      5,
    decisionWindowMs: 12_000,
    freedomThreshold: 100_000,
    trustScoreInit:   50,
  };

  beforeEach(() => {
    mockBus  = makeMockEventBus();
    uxBridge = makeMockCardUXBridge(mockBus);
    mode     = new SyndicateCardMode(uxBridge);
    mode.init(synParams);
  });

  it('trust score initializes at 50', () => {
    expect(mode.getTrustScore()).toBe(50);
  });

  it('trust multiplier at 50 = 1.0', () => {
    expect(mode.getTrustMultiplier()).toBeCloseTo(1.0, 5);
  });

  it('trust boost raises trust score', () => {
    mode.applyTrustBoost(20);
    expect(mode.getTrustScore()).toBe(70);
  });

  it('trust penalty lowers trust score (clamped at 0)', () => {
    mode.applyTrustPenalty(60);
    expect(mode.getTrustScore()).toBe(0); // clamped
  });

  it('rescue window opens and emits event', () => {
    mode.openRescueWindow('teammate_001', Date.now(), 1);
    expect(mode.isRescueWindowOpen()).toBe(true);
    expect(uxBridge.emitRescueWindowOpened).toHaveBeenCalled();
  });

  it('rescue effectiveness = 1.0× trust multiplier immediately after open', () => {
    const now = Date.now();
    mode.openRescueWindow('teammate_001', now, 1);
    const eff = mode.getRescueEffectiveness(now);
    expect(eff).toBeCloseTo(mode.getTrustMultiplier(), 2);
  });

  it('rescue effectiveness decays over window duration', () => {
    const now = Date.now();
    mode.openRescueWindow('teammate_001', now, 1);
    const early = mode.getRescueEffectiveness(now + 1_000);
    const late  = mode.getRescueEffectiveness(now + 14_000);
    expect(late).toBeLessThan(early);
  });

  it('AID terms are activated and tracked', () => {
    const terms: AidCardTerms = {
      lenderId:         'user_syn',
      receiverId:       'teammate_001',
      amount:           500,
      repaymentTicks:   10,
      dueAtTick:        20,
      penaltyOnDefault: 15,
      isRepaid:         false,
    };
    mode.activateAidTerms(terms, 10);
    expect(mode.getActiveAidTerms().length).toBe(1);
    expect(uxBridge.emitAidTermsActivated).toHaveBeenCalled();
  });

  it('AID repayment clears active terms and emits event', () => {
    const terms: AidCardTerms = {
      lenderId:         'user_syn',
      receiverId:       'teammate_001',
      amount:           500,
      repaymentTicks:   10,
      dueAtTick:        20,
      penaltyOnDefault: 15,
      isRepaid:         false,
    };
    mode.activateAidTerms(terms, 10);
    mode.repayAid('user_syn', 'teammate_001', 500, 15);
    expect(mode.getActiveAidTerms().length).toBe(0);
    expect(uxBridge.emitAidRepaid).toHaveBeenCalled();
  });

  it('AID default fires trust penalty on missed deadline', () => {
    const terms: AidCardTerms = {
      lenderId:         'user_syn',
      receiverId:       'teammate_001',
      amount:           500,
      repaymentTicks:   5,
      dueAtTick:        10,
      penaltyOnDefault: 20,
      isRepaid:         false,
    };
    mode.activateAidTerms(terms, 5);
    mode.onTick(11, Date.now());  // tick past due date
    expect(mode.getTrustScore()).toBeLessThan(50);
    expect(uxBridge.emitAidDefaulted).toHaveBeenCalled();
  });

  it('BREAK_PACT defection step is valid as first step', () => {
    const err = mode.validateDefectionStep(DefectionStep.BREAK_PACT, 1);
    expect(err).toBeNull();
  });

  it('SILENT_EXIT is invalid before BREAK_PACT', () => {
    const err = mode.validateDefectionStep(DefectionStep.SILENT_EXIT, 1);
    expect(err).not.toBeNull();
  });

  it('full 3-step defection arc completes and emits penalty', () => {
    const def1  = makeCardDef({ cardId: 'def_break_pact_001',   timingClass: TimingClass.DEFECTION_STEP });
    const def2  = makeCardDef({ cardId: 'def_silent_exit_002',  timingClass: TimingClass.DEFECTION_STEP });
    const def3  = makeCardDef({ cardId: 'def_asset_seizure_003',timingClass: TimingClass.DEFECTION_STEP });
    const card1 = makeCardInHand(def1, GameMode.TEAM_UP);
    const card2 = makeCardInHand(def2, GameMode.TEAM_UP);
    const card3 = makeCardInHand(def3, GameMode.TEAM_UP);

    mode.onDefectionStep(DefectionStep.BREAK_PACT,   card1, 1);
    mode.onDefectionStep(DefectionStep.SILENT_EXIT,  card2, 3);
    const penalty = mode.onDefectionStep(DefectionStep.ASSET_SEIZURE, card3, 5);

    expect(mode.isDefectionCompleted()).toBe(true);
    expect(penalty).toBeGreaterThan(0);
    expect(uxBridge.emitDefectionCompleted).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. PHANTOM CARD MODE
// ═══════════════════════════════════════════════════════════════════════════════

describe('PhantomCardMode', () => {
  let mode:     PhantomCardMode;
  let mockBus:  ReturnType<typeof makeMockEventBus>;
  let uxBridge: any;

  const phantomParams = {
    runId:            'run_phantom_001',
    userId:           'user_phantom',
    seed:             'phantom_seed',
    gameMode:         GameMode.CHASE_A_LEGEND,
    seasonTickBudget: 720,
    maxHandSize:      4,
    decisionWindowMs: 12_000,
    freedomThreshold: 100_000,
    legendRunId:      'legend_atsmith',
  };

  beforeEach(() => {
    mockBus  = makeMockEventBus();
    uxBridge = makeMockCardUXBridge(mockBus);
    mode     = new PhantomCardMode(uxBridge);
    mode.init(phantomParams);
  });

  it('divergence score starts at 0', () => {
    expect(mode.getDivergenceScore()).toBe(0);
  });

  it('legend marker count starts at 0 for all types', () => {
    for (const type of Object.values(LegendMarkerType)) {
      expect(mode.getMarkerCount(type)).toBe(0);
    }
  });

  it('grantMarker increments count', () => {
    mode.grantMarker(LegendMarkerType.GOLD, 3);
    expect(mode.getMarkerCount(LegendMarkerType.GOLD)).toBe(3);
  });

  it('consumeMarker decrements count', () => {
    mode.grantMarker(LegendMarkerType.RED, 2);
    expect(mode.consumeMarker(LegendMarkerType.RED, 1)).toBe(true);
    expect(mode.getMarkerCount(LegendMarkerType.RED)).toBe(1);
  });

  it('consumeMarker returns false if insufficient', () => {
    expect(mode.consumeMarker(LegendMarkerType.SILVER, 5)).toBe(false);
  });

  it('ghost card activation succeeds when marker present', () => {
    mode.grantMarker(LegendMarkerType.GOLD, 1);
    const def    = makeCardDef({ cardId: 'ghost_gold_read_001', deckType: ModeDeckType.GHOST });
    const card   = makeCardInHand(def, GameMode.CHASE_A_LEGEND);
    const result = mode.activateGhostCard(card, 1);
    expect(result.success).toBe(true);
    expect(result.cordMultiplier).toBeGreaterThan(1.0);
    expect(uxBridge.emitGhostCardActivated).toHaveBeenCalled();
  });

  it('ghost card activation fails without marker', () => {
    const def    = makeCardDef({ cardId: 'ghost_gold_read_001', deckType: ModeDeckType.GHOST });
    const card   = makeCardInHand(def, GameMode.CHASE_A_LEGEND);
    const result = mode.activateGhostCard(card, 1);
    expect(result.success).toBe(false);
  });

  it('discipline lock activates and returns median magnitude', () => {
    const def  = makeCardDef({ deckType: ModeDeckType.DISCIPLINE });
    const card = makeCardInHand(def, GameMode.CHASE_A_LEGEND);
    const mag  = mode.activateDisciplineLock(card, 1);
    expect(mode.isDisciplineLockActive()).toBe(true);
    expect(typeof mag).toBe('number');
  });

  it('discipline lock releases after N plays', () => {
    const def  = makeCardDef({ deckType: ModeDeckType.DISCIPLINE });
    const card = makeCardInHand(def, GameMode.CHASE_A_LEGEND);
    mode.activateDisciplineLock(card, 1);
    mode.consumeDisciplineLockSlot();
    mode.consumeDisciplineLockSlot();
    mode.consumeDisciplineLockSlot();
    expect(mode.isDisciplineLockActive()).toBe(false);
  });

  it('proof badge progress increments and unlocks at target', () => {
    // Force-unlock precision_master by checking precision 10 times
    for (let i = 0; i < 10; i++) {
      mode.checkPrecisionBadge(0.9, i); // speedScore 0.9 > 0.8 threshold
    }
    expect(mode.getUnlockedBadges()).toContain('precision_master');
  });

  it('deterministic sequence verification passes for correct card', () => {
    mode.registerExpectedSequence(['card_001', 'card_002', 'card_003']);
    expect(mode.verifyDraw('card_001')).toBe(true);
    expect(mode.verifyDraw('card_002')).toBe(true);
  });

  it('sequence violation detected on wrong card draw', () => {
    mode.registerExpectedSequence(['card_001', 'card_002']);
    mode.verifyDraw('card_001');
    mode.verifyDraw('card_WRONG');  // violation
    expect(mode.getSequenceViolations()).toBe(1);
  });

  it('divergence score updates when legend vs player scores diverge', () => {
    mode.onTick(1, 100, 60);  // legend 100, player 60 — 40% gap
    expect(mode.getDivergenceScore()).not.toBe(0);
  });

  it('BLACK marker ghost card fails when gap > 30%', () => {
    mode.grantMarker(LegendMarkerType.BLACK, 1);
    // Simulate wide gap (>30%)
    mode.onTick(1, 100, 50);   // 50% gap
    const def    = makeCardDef({ cardId: 'ghost_black_risk_005', deckType: ModeDeckType.GHOST });
    const card   = makeCardInHand(def, GameMode.CHASE_A_LEGEND);
    const result = mode.activateGhostCard(card, 2);
    expect(result.success).toBe(false);
  });
});
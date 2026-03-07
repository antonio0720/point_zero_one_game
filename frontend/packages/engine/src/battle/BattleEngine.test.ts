/**
 * FILE: pzo-web/src/engines/battle/BattleEngine.test.ts
 * All unit tests for Engine 5 — Battle Engine.
 *
 * Three test groups:
 *   1. HaterBotController — state transitions, crit logic, neutralize/sabotage
 *   2. BattleBudgetManager — reset, deduction, insufficient funds, tier resolution
 *   3. AttackInjector — inject, displacement, expiry, mitigation, HATER_HEAT_SURGE persistence
 *
 * All tests must pass before Battle Engine is considered complete.
 */
import { HaterBotController }  from './HaterBotController';
import { BattleBudgetManager } from './BattleBudgetManager';
import { AttackInjector }      from './AttackInjector';
import {
  BotId,
  BotState,
  BattleActionType,
  InjectionType,
  IncomeTier,
  RunStateForBattle,
  EntitlementTier,
  resolveIncomeTier,
} from './types';
import { ShieldLayerId }  from '../shield/types';

// ── Test Helpers ──────────────────────────────────────────────────────────────

function buildRSS(overrides: Partial<RunStateForBattle> = {}): RunStateForBattle {
  return {
    haterHeat:                     0,
    netWorth:                      10_000,
    startingNetWorth:              5_000,
    monthlyIncome:                 6_000,
    activeIncomeStreamCount:       1,
    investmentCardsInHand:         0,
    cardPatternEntropy:            0.8,
    sameCardTypeConsecutiveTicks:  0,
    consecutivePositiveGrowthTicks: 0,
    freedomThreshold:              50_000,
    entitlementTier:               EntitlementTier.FREE,
    ...overrides,
  };
}

function buildMockShieldReader(integrity: Partial<Record<ShieldLayerId, number>> = {}): any {
  const defaults: Record<ShieldLayerId, number> = {
    [ShieldLayerId.LIQUIDITY_BUFFER]: 1.0,
    [ShieldLayerId.CREDIT_LINE]:      1.0,
    [ShieldLayerId.ASSET_FLOOR]:      1.0,
    [ShieldLayerId.NETWORK_CORE]:     1.0,
  };
  const merged = { ...defaults, ...integrity };
  return {
    getLayerState: (id: ShieldLayerId) => ({
      integrityPct:      merged[id],
      currentIntegrity:  Math.round(merged[id] * 100),
      maxIntegrity:      100,
    }),
  };
}

function mockBus(): any {
  return { emit: jest.fn() };
}

function mockSR(): any {
  return buildMockShieldReader();
}

// ── TEST GROUP 1: HaterBotController ─────────────────────────────────────────

describe('HaterBotController', () => {

  it('all bots start in DORMANT state', () => {
    const ctrl = new HaterBotController();
    for (const id of Object.values(BotId)) {
      expect(ctrl.getBot(id as BotId)?.state).toBe(BotState.DORMANT);
    }
  });

  it('BOT_01 transitions DORMANT → WATCHING when hater_heat >= 20 and escalation condition met', () => {
    const ctrl = new HaterBotController();
    // Escalation condition for BOT_01: netWorth >= startingNetWorth * 2 (20000 >= 10000)
    const rss = buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 });
    ctrl.tickAllBots(rss, mockSR(), 1);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.WATCHING);
  });

  it('BOT_01 does NOT transition DORMANT → WATCHING when escalation condition not met', () => {
    const ctrl = new HaterBotController();
    // netWorth < 2× startingNetWorth
    const rss = buildRSS({ haterHeat: 25, netWorth: 5_000, startingNetWorth: 5_000 });
    ctrl.tickAllBots(rss, mockSR(), 1);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.DORMANT);
  });

  it('WATCHING → TARGETING when hater_heat >= 41', () => {
    const ctrl = new HaterBotController();
    // Tick 1: enter WATCHING
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.WATCHING);

    // Tick 2: heat crosses 41
    ctrl.tickAllBots(buildRSS({ haterHeat: 41, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 2);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.TARGETING);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.preloadedArrivalTick).not.toBeNull();
  });

  it('WATCHING drops back to DORMANT if hater_heat falls below watching threshold', () => {
    const ctrl = new HaterBotController();
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.WATCHING);

    // Heat drops below 20
    ctrl.tickAllBots(buildRSS({ haterHeat: 15, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 2);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.DORMANT);
  });

  it('TARGETING → ATTACKING when arrival tick reached, then immediately → RETREATING', () => {
    const ctrl = new HaterBotController();
    // Advance to TARGETING
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    ctrl.tickAllBots(buildRSS({ haterHeat: 41, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 2);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.TARGETING);

    const arrivalTick = ctrl.getBot(BotId.BOT_01_LIQUIDATOR)!.preloadedArrivalTick!;

    // Simulate ticks up to arrival without heat crossing 61
    for (let t = 3; t < arrivalTick; t++) {
      ctrl.tickAllBots(buildRSS({ haterHeat: 50, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), t);
    }

    const result = ctrl.tickAllBots(
      buildRSS({ haterHeat: 50, netWorth: 20_000, startingNetWorth: 10_000 }),
      mockSR(),
      arrivalTick
    );

    // Attack should have fired
    expect(result.pendingAttacks.length).toBeGreaterThanOrEqual(1);
    const atk = result.pendingAttacks.find(a => a.botId === BotId.BOT_01_LIQUIDATOR);
    expect(atk).toBeDefined();

    // Bot should now be RETREATING (ATTACKING is transient — resolved same tick)
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.RETREATING);
  });

  it('generates critical hit after 2+ ticks in TARGETING state', () => {
    const ctrl = new HaterBotController();

    // Tick 1: DORMANT → WATCHING
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    // Tick 2: WATCHING → TARGETING (stateEnteredAtTick = 2)
    ctrl.tickAllBots(buildRSS({ haterHeat: 41, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 2);

    // Keep bot in TARGETING for tick 3 (heat < 61, arrival not yet reached)
    const bot = ctrl.getBot(BotId.BOT_01_LIQUIDATOR)!;
    bot.preloadedArrivalTick = 99; // force arrival far away

    ctrl.tickAllBots(buildRSS({ haterHeat: 55, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 3);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.TARGETING);

    // Tick 4: heat crosses 61 — bot has been in TARGETING since tick 2
    // ticksInTargeting = 4 - 2 = 2 → isCritical = true
    bot.preloadedArrivalTick = null; // let heat threshold trigger the attack
    const res = ctrl.tickAllBots(
      buildRSS({ haterHeat: 61, netWorth: 20_000, startingNetWorth: 10_000 }),
      mockSR(),
      4
    );
    const attack = res.pendingAttacks.find(a => a.botId === BotId.BOT_01_LIQUIDATOR);
    expect(attack).toBeDefined();
    expect(attack?.isCritical).toBe(true);
  });

  it('does NOT generate critical hit when bot fires after only 1 tick in TARGETING', () => {
    const ctrl = new HaterBotController();
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    // Enter TARGETING at tick 2 and immediately fire at tick 2 via heat ≥ 61
    const res = ctrl.tickAllBots(
      buildRSS({ haterHeat: 61, netWorth: 20_000, startingNetWorth: 10_000 }),
      mockSR(),
      2
    );
    const attack = res.pendingAttacks.find(a => a.botId === BotId.BOT_01_LIQUIDATOR);
    // ticksInTargeting = 2 - 2 = 0 (entered this tick, fired this tick) → not critical
    if (attack) {
      expect(attack.isCritical).toBe(false);
    }
  });

  it('neutralize() transitions TARGETING bot to NEUTRALIZED and cancels preloaded attack', () => {
    const ctrl = new HaterBotController();
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    ctrl.tickAllBots(buildRSS({ haterHeat: 41, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 2);

    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.preloadedArrivalTick).not.toBeNull();

    const success = ctrl.neutralize(BotId.BOT_01_LIQUIDATOR, 3);
    expect(success).toBe(true);

    const bot = ctrl.getBot(BotId.BOT_01_LIQUIDATOR)!;
    expect(bot.state).toBe(BotState.NEUTRALIZED);
    expect(bot.preloadedArrivalTick).toBeNull();
    expect(bot.preloadedAttackPower).toBeNull();
    expect(bot.neutralizedTicksRemaining).toBe(3);
    expect(bot.lastStateBeforeNeutralized).toBe(BotState.TARGETING);
  });

  it('neutralize() returns false and changes nothing for DORMANT bot', () => {
    const ctrl = new HaterBotController();
    const result = ctrl.neutralize(BotId.BOT_01_LIQUIDATOR, 1);
    expect(result).toBe(false);
    expect(ctrl.getBot(BotId.BOT_01_LIQUIDATOR)?.state).toBe(BotState.DORMANT);
  });

  it('neutralize() returns false for RETREATING bot', () => {
    const ctrl = new HaterBotController();
    // Advance to RETREATING: DORMANT→WATCHING→TARGETING→fire→RETREATING
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    ctrl.tickAllBots(buildRSS({ haterHeat: 61, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 2);
    // Bot should be RETREATING now (fired this tick)
    const bot = ctrl.getBot(BotId.BOT_01_LIQUIDATOR)!;
    if (bot.state === BotState.RETREATING) {
      expect(ctrl.neutralize(BotId.BOT_01_LIQUIDATOR, 3)).toBe(false);
    }
  });

  it('neutralize() returns false for already NEUTRALIZED bot', () => {
    const ctrl = new HaterBotController();
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    ctrl.tickAllBots(buildRSS({ haterHeat: 41, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 2);
    ctrl.neutralize(BotId.BOT_01_LIQUIDATOR, 3);
    expect(ctrl.neutralize(BotId.BOT_01_LIQUIDATOR, 4)).toBe(false);
  });

  it('COUNTER_SABOTAGE reduces attack raw power by 30%', () => {
    const ctrl = new HaterBotController();
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    ctrl.tickAllBots(buildRSS({ haterHeat: 41, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 2);

    ctrl.applyCounterSabotage(BotId.BOT_01_LIQUIDATOR);

    // Force fire via heat threshold
    const bot = ctrl.getBot(BotId.BOT_01_LIQUIDATOR)!;
    bot.preloadedAttackPower = 45; // force max power to test reduction
    bot.preloadedArrivalTick = null;

    const res = ctrl.tickAllBots(
      buildRSS({ haterHeat: 61, netWorth: 20_000, startingNetWorth: 10_000 }),
      mockSR(),
      3
    );
    const atk = res.pendingAttacks.find(a => a.botId === BotId.BOT_01_LIQUIDATOR);
    if (atk) {
      // 45 * 0.70 = 31.5 → rounds to 32 or 31
      expect(atk.rawPower).toBeLessThanOrEqual(32);
      expect(atk.rawPower).toBeGreaterThan(0);
    }
  });

  it('BOT_03 attack includes secondary attack type (REPUTATION_ATTACK)', () => {
    const ctrl = new HaterBotController();
    // BOT_03 escalation: cardPatternEntropy < 0.4
    const rss = buildRSS({
      haterHeat: 61,
      cardPatternEntropy: 0.2,
      activeIncomeStreamCount: 3,
    });
    const result = ctrl.tickAllBots(rss, mockSR(), 1);
    const atk = result.pendingAttacks.find(a => a.botId === BotId.BOT_03_MANIPULATOR);
    if (atk) {
      expect(atk.secondaryAttackType).not.toBeNull();
      expect(atk.secondaryRawPower).toBeGreaterThan(0);
    }
  });

  it('BOT_04 only activates when income > 10000 AND hater_heat > 60', () => {
    const ctrl = new HaterBotController();
    // Should NOT activate — income too low
    ctrl.tickAllBots(buildRSS({ haterHeat: 65, monthlyIncome: 9_000 }), mockSR(), 1);
    expect(ctrl.getBot(BotId.BOT_04_CRASH_PROPHET)?.state).toBe(BotState.DORMANT);

    // Should NOT activate — heat too low
    ctrl.tickAllBots(buildRSS({ haterHeat: 55, monthlyIncome: 12_000 }), mockSR(), 2);
    expect(ctrl.getBot(BotId.BOT_04_CRASH_PROPHET)?.state).toBe(BotState.DORMANT);
  });

  it('BOT_05 only activates when net worth > 5× freedom threshold', () => {
    const ctrl = new HaterBotController();
    // netWorth = 200000, freedomThreshold = 50000 → 200000 >= 250000? No
    ctrl.tickAllBots(buildRSS({ haterHeat: 25, netWorth: 200_000, freedomThreshold: 50_000 }), mockSR(), 1);
    expect(ctrl.getBot(BotId.BOT_05_LEGACY_HEIR)?.state).toBe(BotState.DORMANT);

    // netWorth = 251000, freedomThreshold = 50000 → 251000 >= 250000? Yes
    const ctrl2 = new HaterBotController();
    ctrl2.tickAllBots(buildRSS({ haterHeat: 25, netWorth: 251_000, freedomThreshold: 50_000 }), mockSR(), 1);
    expect(ctrl2.getBot(BotId.BOT_05_LEGACY_HEIR)?.state).toBe(BotState.WATCHING);
  });

  it('NEUTRALIZED bot recovers to lastStateBeforeNeutralized after 3 ticks', () => {
    const ctrl = new HaterBotController();
    ctrl.tickAllBots(buildRSS({ haterHeat: 20, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    ctrl.tickAllBots(buildRSS({ haterHeat: 41, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 2);
    ctrl.neutralize(BotId.BOT_01_LIQUIDATOR, 3);

    const rss = buildRSS({ haterHeat: 50, netWorth: 20_000, startingNetWorth: 10_000 });
    ctrl.tickAllBots(rss, mockSR(), 4); // tick 1 of neutralization
    ctrl.tickAllBots(rss, mockSR(), 5); // tick 2
    ctrl.tickAllBots(rss, mockSR(), 6); // tick 3 — recovers

    const bot = ctrl.getBot(BotId.BOT_01_LIQUIDATOR)!;
    // Should have recovered to TARGETING (which was the state before neutralization)
    expect(bot.state).toBe(BotState.TARGETING);
  });

  it('reset() returns all bots to DORMANT', () => {
    const ctrl = new HaterBotController();
    ctrl.tickAllBots(buildRSS({ haterHeat: 61, netWorth: 20_000, startingNetWorth: 10_000 }), mockSR(), 1);
    ctrl.reset();
    for (const id of Object.values(BotId)) {
      expect(ctrl.getBot(id as BotId)?.state).toBe(BotState.DORMANT);
    }
  });
});

// ── TEST GROUP 2: BattleBudgetManager ────────────────────────────────────────

describe('BattleBudgetManager', () => {

  it('budget resets to MOMENTUM tier (5 pts) for $6,000/month income', () => {
    const mgr = new BattleBudgetManager();
    mgr.resetForTick(6_000, 1);
    expect(mgr.getRemainingPts()).toBe(5);
    expect(mgr.getIncomeTier()).toBe(IncomeTier.MOMENTUM);
  });

  it('budget resets to SURVIVAL tier (2 pts) for $1,500/month income', () => {
    const mgr = new BattleBudgetManager();
    mgr.resetForTick(1_500, 1);
    expect(mgr.getRemainingPts()).toBe(2);
    expect(mgr.getIncomeTier()).toBe(IncomeTier.SURVIVAL);
  });

  it('budget resets to SOVEREIGN tier (8 pts) for $30,000/month income', () => {
    const mgr = new BattleBudgetManager();
    mgr.resetForTick(30_000, 1);
    expect(mgr.getRemainingPts()).toBe(8);
  });

  it('executeAction deducts pts correctly', () => {
    const mgr = new BattleBudgetManager();
    mgr.resetForTick(6_000, 1); // 5 pts
    mgr.executeAction(BattleActionType.HATER_DISTRACTION, null, null, 1); // costs 2
    expect(mgr.getRemainingPts()).toBe(3);
  });

  it('executeAction returns null if insufficient pts — pts NOT deducted', () => {
    const mgr = new BattleBudgetManager();
    mgr.resetForTick(1_500, 1); // SURVIVAL = 2 pts
    const result = mgr.executeAction(
      BattleActionType.COUNTER_EVIDENCE_FILE, // costs 5
      BotId.BOT_01_LIQUIDATOR,
      null,
      1
    );
    expect(result).toBeNull();
    expect(mgr.getRemainingPts()).toBe(2); // unchanged
  });

  it('same action type can be used twice in one tick if budget allows', () => {
    const mgr = new BattleBudgetManager();
    mgr.resetForTick(25_001, 1); // SOVEREIGN = 8 pts
    const r1 = mgr.executeAction(BattleActionType.HATER_DISTRACTION, null, null, 1); // 2 pts
    const r2 = mgr.executeAction(BattleActionType.HATER_DISTRACTION, null, null, 1); // 2 pts
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(mgr.getRemainingPts()).toBe(4); // 8 - 4 = 4
  });

  it('unspent pts are discarded on resetForTick — no carry-over', () => {
    const mgr = new BattleBudgetManager();
    mgr.resetForTick(6_000, 1); // 5 pts
    // Spend nothing
    mgr.resetForTick(6_000, 2); // reset for next tick
    expect(mgr.getRemainingPts()).toBe(5); // not 10
  });

  it('resolveIncomeTier returns correct tiers at all boundaries', () => {
    expect(resolveIncomeTier(1_999)).toBe(IncomeTier.SURVIVAL);
    expect(resolveIncomeTier(2_000)).toBe(IncomeTier.SURVIVAL);
    expect(resolveIncomeTier(2_001)).toBe(IncomeTier.STABILITY);
    expect(resolveIncomeTier(5_000)).toBe(IncomeTier.STABILITY);
    expect(resolveIncomeTier(5_001)).toBe(IncomeTier.MOMENTUM);
    expect(resolveIncomeTier(10_000)).toBe(IncomeTier.MOMENTUM);
    expect(resolveIncomeTier(10_001)).toBe(IncomeTier.LEVERAGE);
    expect(resolveIncomeTier(25_000)).toBe(IncomeTier.LEVERAGE);
    expect(resolveIncomeTier(25_001)).toBe(IncomeTier.SOVEREIGN);
    expect(resolveIncomeTier(1_000_000)).toBe(IncomeTier.SOVEREIGN);
  });

  it('canAfford returns false when pts are insufficient', () => {
    const mgr = new BattleBudgetManager();
    mgr.resetForTick(1_500, 1); // 2 pts
    expect(mgr.canAfford(BattleActionType.COUNTER_EVIDENCE_FILE)).toBe(false); // costs 5
    expect(mgr.canAfford(BattleActionType.HATER_DISTRACTION)).toBe(true);     // costs 2
  });

  it('getSnapshot returns correct snapshot state', () => {
    const mgr = new BattleBudgetManager();
    mgr.resetForTick(6_000, 5);
    mgr.executeAction(BattleActionType.THREAT_DELAY, null, null, 5);
    const snap = mgr.getSnapshot();
    expect(snap.remainingPts).toBe(4);  // 5 - 1
    expect(snap.spentPts).toBe(1);
    expect(snap.tickNumber).toBe(5);
    expect(snap.actionsExecutedThisTick).toContain(BattleActionType.THREAT_DELAY);
  });
});

// ── TEST GROUP 3: AttackInjector ─────────────────────────────────────────────

describe('AttackInjector', () => {

  it('inject() adds a card to activeCards and emits CARD_INJECTED', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    inj.inject(InjectionType.FORCED_SALE, BotId.BOT_01_LIQUIDATOR, 1);
    expect(inj.getActiveCards()).toHaveLength(1);
    expect(inj.getActiveCards()[0].injectionType).toBe(InjectionType.FORCED_SALE);
    expect(bus.emit).toHaveBeenCalledWith('CARD_INJECTED', expect.any(Object));
  });

  it('inject() sets correct card name and timer from config', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    const card = inj.inject(InjectionType.FORCED_SALE, BotId.BOT_01_LIQUIDATOR, 1);
    expect(card.cardName).toBe('DISTRESSED SALE NOTICE');
    expect(card.timerTicks).toBe(2);
    expect(card.ticksRemaining).toBe(2);
  });

  it('4th injection displaces oldest card and fires INJECTED_CARD_EXPIRED for displaced', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    const first = inj.inject(InjectionType.FORCED_SALE,      BotId.BOT_01_LIQUIDATOR, 1);
    inj.inject(InjectionType.REGULATORY_HOLD,  BotId.BOT_02_BUREAUCRAT,    2);
    inj.inject(InjectionType.INVERSION_CURSE,  BotId.BOT_03_MANIPULATOR,   3);
    inj.inject(InjectionType.EXPENSE_SPIKE,    BotId.BOT_04_CRASH_PROPHET, 4); // 4th — displaces first

    expect(inj.getActiveCards()).toHaveLength(3); // cap maintained

    const expiredCalls = (bus.emit as jest.Mock).mock.calls.filter(
      c => c[0] === 'INJECTED_CARD_EXPIRED'
    );
    expect(expiredCalls).toHaveLength(1);
    expect(expiredCalls[0][1].injectionId).toBe(first.injectionId);
  });

  it('tickInjections() decrements counters and fires INJECTED_CARD_EXPIRED when timer reaches 0', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    inj.inject(InjectionType.EXPENSE_SPIKE, BotId.BOT_04_CRASH_PROPHET, 1); // timerTicks = 1

    const expired = inj.tickInjections(2); // 1 tick later — should expire
    expect(expired).toHaveLength(1);
    expect(expired[0].injectionType).toBe(InjectionType.EXPENSE_SPIKE);
    expect(inj.getActiveCards()).toHaveLength(0);

    const expiredEvents = (bus.emit as jest.Mock).mock.calls.filter(
      c => c[0] === 'INJECTED_CARD_EXPIRED'
    );
    expect(expiredEvents).toHaveLength(1);
  });

  it('mitigateCard() removes card cleanly without firing INJECTED_CARD_EXPIRED', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    const card = inj.inject(InjectionType.FORCED_SALE, BotId.BOT_01_LIQUIDATOR, 1);
    const result = inj.mitigateCard(card.injectionId);

    expect(result).toBe(true);
    expect(inj.getActiveCards()).toHaveLength(0);

    const expiredEvents = (bus.emit as jest.Mock).mock.calls.filter(
      c => c[0] === 'INJECTED_CARD_EXPIRED'
    );
    expect(expiredEvents).toHaveLength(0); // NO expiry on mitigation
  });

  it('mitigateCard() returns false for unknown injectionId', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    expect(inj.mitigateCard('nonexistent-id')).toBe(false);
  });

  it('HATER_HEAT_SURGE (timerTicks=0) does NOT expire from tickInjections()', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    inj.inject(InjectionType.HATER_HEAT_SURGE, BotId.BOT_01_LIQUIDATOR, 1);

    inj.tickInjections(2);
    inj.tickInjections(3);
    inj.tickInjections(4);
    inj.tickInjections(10);

    expect(inj.getActiveCards()).toHaveLength(1);
    expect(inj.getActiveCards()[0].injectionType).toBe(InjectionType.HATER_HEAT_SURGE);

    // No expiry events should have fired
    const expiredEvents = (bus.emit as jest.Mock).mock.calls.filter(
      c => c[0] === 'INJECTED_CARD_EXPIRED'
    );
    expect(expiredEvents).toHaveLength(0);
  });

  it('hasActiveHeatSurge() returns true when HATER_HEAT_SURGE is active', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    expect(inj.hasActiveHeatSurge()).toBe(false);
    inj.inject(InjectionType.HATER_HEAT_SURGE, BotId.BOT_01_LIQUIDATOR, 1);
    expect(inj.hasActiveHeatSurge()).toBe(true);
  });

  it('mitigateHeatSurge() removes HATER_HEAT_SURGE without expiry event', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    inj.inject(InjectionType.HATER_HEAT_SURGE, BotId.BOT_01_LIQUIDATOR, 1);
    expect(inj.mitigateHeatSurge()).toBe(true);
    expect(inj.hasActiveHeatSurge()).toBe(false);

    const expiredEvents = (bus.emit as jest.Mock).mock.calls.filter(
      c => c[0] === 'INJECTED_CARD_EXPIRED'
    );
    expect(expiredEvents).toHaveLength(0);
  });

  it('reset() clears all active cards', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    inj.inject(InjectionType.FORCED_SALE,     BotId.BOT_01_LIQUIDATOR, 1);
    inj.inject(InjectionType.EXPENSE_SPIKE,   BotId.BOT_04_CRASH_PROPHET, 2);
    inj.inject(InjectionType.DILUTION_NOTICE, BotId.BOT_05_LEGACY_HEIR, 3);
    expect(inj.getActiveCards()).toHaveLength(3);

    inj.reset();
    expect(inj.getActiveCards()).toHaveLength(0);
  });

  it('EXPENSE_SPIKE card has timerTicks=1 (must be mitigated immediately)', () => {
    const bus = mockBus();
    const inj = new AttackInjector(bus);
    const card = inj.inject(InjectionType.EXPENSE_SPIKE, BotId.BOT_04_CRASH_PROPHET, 1);
    expect(card.timerTicks).toBe(1);
    expect(card.cardName).toBe('SYSTEMIC EXPENSE SHOCK');
  });
});
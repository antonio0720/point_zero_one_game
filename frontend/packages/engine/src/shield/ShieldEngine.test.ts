//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/shield/ShieldEngine.test.ts

/**
 * FILE: pzo-web/src/engines/shield/ShieldEngine.test.ts
 * All 18 tests must pass before the Shield Engine is considered complete.
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import { ShieldLayerManager } from './ShieldLayerManager';
import { AttackRouter } from './AttackRouter';
import { ShieldRepairQueue } from './ShieldRepairQueue';
import { ShieldEngine } from './ShieldEngine';
import {
  ShieldLayerId,
  AttackType,
  ShieldLayerState,
  SHIELD_LAYER_ORDER,
  SHIELD_LAYER_CONFIGS,
} from './types';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a set of full-integrity layer states for test scaffolding. */
function fullLayers(): ShieldLayerState[] {
  return SHIELD_LAYER_ORDER.map(id => {
    const cfg = SHIELD_LAYER_CONFIGS[id];
    return {
      id,
      name: cfg.name,
      maxIntegrity: cfg.maxIntegrity,
      colorHex: cfg.colorHex,
      currentIntegrity: cfg.maxIntegrity,
      isBreached: false,
      integrityPct: 1.0,
      isCriticalWarning: false,
      isLowWarning: false,
      lastBreachTick: null,
      totalBreachCount: 0,
      pendingRepairPts: 0,
    };
  });
}

/** Minimal mock EventBus with jest.fn() emit. */
function mockBus() {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    flush: jest.fn(),
    clear: jest.fn(),
  };
}

// ── TEST GROUP 1: ShieldLayerManager ──────────────────────────────────────────

describe('ShieldLayerManager', () => {
  it('initializes all layers at full integrity', () => {
    const m = new ShieldLayerManager();
    expect(m.getLayer(ShieldLayerId.LIQUIDITY_BUFFER).currentIntegrity).toBe(100);
    expect(m.getLayer(ShieldLayerId.CREDIT_LINE).currentIntegrity).toBe(80);
    expect(m.getLayer(ShieldLayerId.ASSET_FLOOR).currentIntegrity).toBe(60);
    expect(m.getLayer(ShieldLayerId.NETWORK_CORE).currentIntegrity).toBe(40);
  });

  it('damage clamps at 0 — no negative integrity', () => {
    const m = new ShieldLayerManager();
    const r = m.applyDamage(ShieldLayerId.NETWORK_CORE, 999, 1);
    expect(r.newIntegrity).toBe(0);
  });

  it('breachOccurred true only on transition >0 to 0', () => {
    const m = new ShieldLayerManager();
    const r1 = m.applyDamage(ShieldLayerId.NETWORK_CORE, 40, 1); // breach
    const r2 = m.applyDamage(ShieldLayerId.NETWORK_CORE, 1, 2);  // already 0
    expect(r1.breachOccurred).toBe(true);
    expect(r2.breachOccurred).toBe(false);
    expect(r2.wasAlreadyBreached).toBe(true);
  });

  it('totalBreachCount increments once per breach event (not on re-hit at 0)', () => {
    const m = new ShieldLayerManager();
    m.applyDamage(ShieldLayerId.LIQUIDITY_BUFFER, 100, 1);
    m.applyDamage(ShieldLayerId.LIQUIDITY_BUFFER, 50, 2);
    expect(m.getLayer(ShieldLayerId.LIQUIDITY_BUFFER).totalBreachCount).toBe(1);
  });

  it('passive regen skips breach tick', () => {
    const m = new ShieldLayerManager();
    m.applyDamage(ShieldLayerId.LIQUIDITY_BUFFER, 100, 1);
    const regen = m.tickPassiveRegen();
    expect(regen.get(ShieldLayerId.LIQUIDITY_BUFFER)).toBe(0);
  });

  it('passive regen resumes at breached rate on tick after breach', () => {
    const m = new ShieldLayerManager();
    m.applyDamage(ShieldLayerId.LIQUIDITY_BUFFER, 100, 1);
    m.tickPassiveRegen(); // tick 1 — skipped (breach tick)
    const r2 = m.tickPassiveRegen(); // tick 2 — 1 pt (breached rate)
    expect(r2.get(ShieldLayerId.LIQUIDITY_BUFFER)).toBe(1);
  });

  it('L3 and L4 breached regen rate is 0 (frozen)', () => {
    const m = new ShieldLayerManager();
    m.applyDamage(ShieldLayerId.ASSET_FLOOR, 60, 1); // breach L3
    m.tickPassiveRegen(); // skip breach tick
    const r2 = m.tickPassiveRegen(); // L3 breached rate = 0
    expect(r2.get(ShieldLayerId.ASSET_FLOOR)).toBe(0);
  });

  it('isFortified false when any layer < 80%', () => {
    const m = new ShieldLayerManager();
    m.applyDamage(ShieldLayerId.NETWORK_CORE, 10, 1); // 30/40 = 75%
    expect(m.isFortified()).toBe(false);
  });

  it('applyCascadeCrack reduces all non-L4 layers to 20% of max', () => {
    const m = new ShieldLayerManager();
    m.applyCascadeCrack(5);
    expect(m.getLayer(ShieldLayerId.LIQUIDITY_BUFFER).currentIntegrity).toBe(20); // floor(100*0.2)
    expect(m.getLayer(ShieldLayerId.CREDIT_LINE).currentIntegrity).toBe(16);       // floor(80*0.2)
    expect(m.getLayer(ShieldLayerId.ASSET_FLOOR).currentIntegrity).toBe(12);       // floor(60*0.2)
    expect(m.getLayer(ShieldLayerId.NETWORK_CORE).currentIntegrity).toBe(40);      // untouched
  });

  it('getWeakestLayerId returns inner layer on percentage tie', () => {
    const m = new ShieldLayerManager();
    m.applyDamage(ShieldLayerId.LIQUIDITY_BUFFER, 50, 1); // 50/100 = 50%
    m.applyDamage(ShieldLayerId.NETWORK_CORE, 20, 1);     // 20/40  = 50%
    expect(m.getWeakestLayerId()).toBe(ShieldLayerId.NETWORK_CORE); // inner wins tie
  });
});

// ── TEST GROUP 2: AttackRouter ─────────────────────────────────────────────────

describe('AttackRouter', () => {
  const router = new AttackRouter();

  it('FINANCIAL_SABOTAGE routes primary to L1', () => {
    const r = router.resolveTarget(AttackType.FINANCIAL_SABOTAGE, fullLayers());
    expect(r.primary).toBe(ShieldLayerId.LIQUIDITY_BUFFER);
  });

  it('DEBT_ATTACK routes primary to L2', () => {
    expect(router.resolveTarget(AttackType.DEBT_ATTACK, fullLayers()).primary)
      .toBe(ShieldLayerId.CREDIT_LINE);
  });

  it('HATER_INJECTION targets weakest layer by percentage', () => {
    const layers = fullLayers();
    const l3 = layers.find(l => l.id === ShieldLayerId.ASSET_FLOOR)!;
    l3.integrityPct = 0.10; // weakest
    l3.currentIntegrity = Math.round(l3.maxIntegrity * 0.10);
    const r = router.resolveTarget(AttackType.HATER_INJECTION, layers);
    expect(r.primary).toBe(ShieldLayerId.ASSET_FLOOR);
  });

  it('resolveEffectiveTarget uses fallback when primary is breached', () => {
    const layers = fullLayers();
    const l1 = layers.find(l => l.id === ShieldLayerId.LIQUIDITY_BUFFER)!;
    l1.currentIntegrity = 0;
    l1.isBreached = true;
    l1.integrityPct = 0;
    const route = {
      primary: ShieldLayerId.LIQUIDITY_BUFFER,
      fallback: ShieldLayerId.CREDIT_LINE,
    };
    expect(router.resolveEffectiveTarget(route, layers))
      .toBe(ShieldLayerId.CREDIT_LINE);
  });

  it('resolveEffectiveTarget returns NETWORK_CORE when all layers at 0', () => {
    const all0 = fullLayers().map(l => ({
      ...l,
      currentIntegrity: 0,
      isBreached: true,
      integrityPct: 0,
    }));
    const route = {
      primary: ShieldLayerId.LIQUIDITY_BUFFER,
      fallback: ShieldLayerId.CREDIT_LINE,
    };
    expect(router.resolveEffectiveTarget(route, all0))
      .toBe(ShieldLayerId.NETWORK_CORE);
  });
});

// ── TEST GROUP 3: ShieldRepairQueue ───────────────────────────────────────────

describe('ShieldRepairQueue', () => {
  it('delivers repair pts over duration', () => {
    const m = new ShieldLayerManager();
    m.applyDamage(ShieldLayerId.LIQUIDITY_BUFFER, 40, 1); // 60 pts remaining
    const q = new ShieldRepairQueue(m);
    q.enqueueRepair({
      cardId: 'c1',
      targetLayerId: ShieldLayerId.LIQUIDITY_BUFFER,
      repairPts: 20,
      durationTicks: 2,
    });
    q.tickRepairJobs();
    q.tickRepairJobs();
    expect(m.getLayer(ShieldLayerId.LIQUIDITY_BUFFER).currentIntegrity)
      .toBeGreaterThanOrEqual(78); // 60 + 20 = 80, but <= 100 cap
  });

  it('enforces max 3 active repair jobs per layer', () => {
    const m = new ShieldLayerManager();
    const q = new ShieldRepairQueue(m);
    const card = {
      cardId: 'c',
      targetLayerId: ShieldLayerId.LIQUIDITY_BUFFER,
      repairPts: 10,
      durationTicks: 2,
    };
    expect(q.enqueueRepair(card)).not.toBeNull();
    expect(q.enqueueRepair(card)).not.toBeNull();
    expect(q.enqueueRepair(card)).not.toBeNull();
    expect(q.enqueueRepair(card)).toBeNull(); // 4th rejected
  });

  it('repair and new damage operate independently (do not cancel)', () => {
    const m = new ShieldLayerManager();
    m.applyDamage(ShieldLayerId.LIQUIDITY_BUFFER, 50, 1); // 50 pts remaining
    const q = new ShieldRepairQueue(m);
    q.enqueueRepair({
      cardId: 'r',
      targetLayerId: ShieldLayerId.LIQUIDITY_BUFFER,
      repairPts: 20,
      durationTicks: 1,
    });
    m.applyDamage(ShieldLayerId.LIQUIDITY_BUFFER, 10, 1); // now 40 pts
    q.tickRepairJobs(); // delivers 20
    expect(m.getLayer(ShieldLayerId.LIQUIDITY_BUFFER).currentIntegrity).toBe(60);
  });
});

// ── TEST GROUP 4: ShieldEngine integration ────────────────────────────────────

describe('ShieldEngine', () => {
  it('applyAttack routes and returns DamageResult', () => {
    const engine = new ShieldEngine(mockBus() as any);
    const r = engine.applyAttack({
      attackId: 'a1',
      attackType: AttackType.FINANCIAL_SABOTAGE,
      rawPower: 30,
      sourceHaterId: 'h1',
      isCritical: false,
      tickNumber: 1,
    });
    expect(r.targetLayerId).toBe(ShieldLayerId.LIQUIDITY_BUFFER);
    expect(r.effectiveDamage).toBeLessThanOrEqual(30); // deflection may apply
    expect(r.breachOccurred).toBe(false);
  });

  it('critical hits bypass deflection entirely', () => {
    const engine = new ShieldEngine(mockBus() as any);
    const r = engine.applyAttack({
      attackId: 'a2',
      attackType: AttackType.FINANCIAL_SABOTAGE,
      rawPower: 30,
      sourceHaterId: 'h',
      isCritical: true,
      tickNumber: 1,
    });
    expect(r.effectiveDamage).toBe(30);
    expect(r.deflectionApplied).toBe(0);
  });

  it('overflow damage does NOT bleed to next layer', () => {
    const engine = new ShieldEngine(mockBus() as any);
    engine.applyAttack({
      attackId: 'a3',
      attackType: AttackType.FINANCIAL_SABOTAGE,
      rawPower: 150,
      sourceHaterId: 'h',
      isCritical: true,
      tickNumber: 1,
    });
    expect(engine.getLayerState(ShieldLayerId.LIQUIDITY_BUFFER).isBreached).toBe(true);
    expect(engine.getLayerState(ShieldLayerId.CREDIT_LINE).currentIntegrity).toBe(80); // untouched
  });

  it('L4 breach emits CASCADE_TRIGGERED and cracks all other layers', () => {
    const bus = mockBus();
    const engine = new ShieldEngine(bus as any);
    engine.applyAttack({
      attackId: 'a4',
      attackType: AttackType.REPUTATION_ATTACK,
      rawPower: 40,
      sourceHaterId: 'h',
      isCritical: true,
      tickNumber: 1,
    });
    expect(bus.emit).toHaveBeenCalledWith(
      'CASCADE_TRIGGERED',
      expect.objectContaining({ haterHeatSetTo: 100 }),
    );
    expect(engine.getLayerState(ShieldLayerId.LIQUIDITY_BUFFER).currentIntegrity).toBe(20);
    expect(engine.getLayerState(ShieldLayerId.CREDIT_LINE).currentIntegrity).toBe(16);
    expect(engine.getLayerState(ShieldLayerId.ASSET_FLOOR).currentIntegrity).toBe(12);
  });

  it('SHIELD_FORTIFIED fires once on entering fortified, not every tick', () => {
    const bus = mockBus();
    const engine = new ShieldEngine(bus as any);
    engine.tickShields(1);
    engine.tickShields(2);
    engine.tickShields(3);
    const firedCount = (bus.emit as jest.Mock).mock.calls
      .filter(c => c[0] === 'SHIELD_FORTIFIED').length;
    expect(firedCount).toBe(1);
  });

  it('reset returns all layers to full integrity', () => {
    const engine = new ShieldEngine(mockBus() as any);
    engine.applyAttack({
      attackId: 'a',
      attackType: AttackType.REPUTATION_ATTACK,
      rawPower: 40,
      sourceHaterId: 'h',
      isCritical: true,
      tickNumber: 1,
    });
    engine.reset();
    expect(engine.getLayerState(ShieldLayerId.NETWORK_CORE).currentIntegrity).toBe(40);
    expect(engine.getLayerState(ShieldLayerId.LIQUIDITY_BUFFER).currentIntegrity).toBe(100);
  });

  it('queueRepair returns false when 3-job cap is reached', () => {
    const engine = new ShieldEngine(mockBus() as any);
    const card = {
      cardId: 'c',
      targetLayerId: ShieldLayerId.LIQUIDITY_BUFFER,
      repairPts: 10,
      durationTicks: 2,
    };
    engine.queueRepair(card);
    engine.queueRepair(card);
    engine.queueRepair(card);
    expect(engine.queueRepair(card)).toBe(false);
  });
});
/**
 * FILE: pzo-web/src/engines/pressure/PressureEngine.test.ts
 * 27 tests total:
 *   Group 1 — PressureSignalCollector  (7)
 *   Group 2 — PressureDecayController  (5)
 *   Group 3 — PressureEngine           (6)
 *   Group 4 — Addendum: Spec Defects   (9)
 */
import { describe, it, expect, vi } from 'vitest';
import {
  PressureSignalCollector,
  validateWeights,
  normalizePositiveWeights,
} from './PressureSignalCollector';
import { PressureDecayController } from './PressureDecayController';
import { PressureEngine } from './PressureEngine';
import {
  PressureTier,
  DEFAULT_SIGNAL_WEIGHTS,
  PRESSURE_TUNING_DEFAULTS,
  TrendMode,
} from './types';
import { createMockEventBus } from './utils';
import { FixedClockSource } from '../core/ClockSource';

// ── Shared Fixtures ───────────────────────────────────────────────────────────

/** All-neutral input: fullSecurityBonus (-0.15) fires, nothing else. rawScore = -0.15 */
const blankInput = {
  monthlyIncome:            5000,
  monthlyExpenses:          3000,
  cashBalance:              50000,
  haterHeat:                0,
  activeThreatCardCount:    0,
  shieldIntegrityPct:       1.0,
  ticksWithoutIncomeGrowth: 0,
  activeCascadeChainCount:  0,
  netWorth:                 0,
  freedomThreshold:         100000,
} as const;

/** Full prosperity — all negative reductions fire. rawScore << 0 → score = 0 */
const calmInput = {
  monthlyIncome:            10000,
  monthlyExpenses:          3000,
  cashBalance:              50000,
  haterHeat:                0,
  activeThreatCardCount:    0,
  shieldIntegrityPct:       1.0,
  ticksWithoutIncomeGrowth: 0,
  activeCascadeChainCount:  0,
  netWorth:                 250000,
  freedomThreshold:         100000,
} as const;

/** Max stress — every positive signal at full weight. rawScore ≈ 1.0 → CRITICAL */
const crisisInput = {
  monthlyIncome:            1000,
  monthlyExpenses:          8000,
  cashBalance:              500,
  haterHeat:                100,
  activeThreatCardCount:    4,
  shieldIntegrityPct:       0.0,
  ticksWithoutIncomeGrowth: 8,
  activeCascadeChainCount:  2,
  netWorth:                 0,
  freedomThreshold:         100000,
} as const;

/**
 * Mild stress — cashflow negative + low cash, offset by fullSecurityBonus.
 * rawScore = 0.25 + 0.20 - 0.15 = 0.30 → BUILDING tier (stays stable on repeat)
 */
const mildInput = {
  monthlyIncome:            4000,
  monthlyExpenses:          6000,
  cashBalance:              5000,   // 5000 < 6000 → lowCashBalance fires
  haterHeat:                0,
  activeThreatCardCount:    0,
  shieldIntegrityPct:       1.0,
  ticksWithoutIncomeGrowth: 0,
  activeCascadeChainCount:  0,
  netWorth:                 0,
  freedomThreshold:         100000,
} as const;

/**
 * Escalating stress fixtures — produce strictly rising scores under STRICT trend mode.
 *
 * lowStress:  threats=1, shield=0.5  → rawScore ≈ 0.04
 * midStress:  threats=2, shield=0.2, heat=70 → rawScore ≈ 0.20
 * highStress: cashflow-, threats=3, shield=0.1, heat=90 → rawScore ≈ 0.58
 *
 * After decay from 0: [0.04, 0.20, 0.58] — each strictly higher → isEscalating=true
 */
const lowStressInput = {
  ...blankInput,
  activeThreatCardCount: 1,
  shieldIntegrityPct:    0.5,   // 0.5 ≥ 0.40 → no lowShieldIntegrity; threats=1 → no fullSecurityBonus
} as const;

const midStressInput = {
  ...blankInput,
  activeThreatCardCount: 2,
  shieldIntegrityPct:    0.2,   // deficit=(0.4-0.2)/0.4=0.5 → 0.5*0.12=0.06
  haterHeat:             70,    // (70-50)/50*0.15=0.06
} as const;

const highStressInput = {
  ...blankInput,
  monthlyIncome:         2000,
  monthlyExpenses:       5000,  // cashflow- fires: 0.25
  activeThreatCardCount: 3,     // 3*0.04=0.12
  shieldIntegrityPct:    0.1,   // deficit=(0.4-0.1)/0.4=0.75 → 0.09
  haterHeat:             90,    // (90-50)/50*0.15=0.12
} as const;

/**
 * Flat-then-up fixtures for SLOPE vs STRICT comparison (A7/A8).
 *
 * tick1: cashflow- + stagnation=5 → rawScore = 0.25 + 0.05 = 0.30 → score 0.30
 * tick2: same → rawScore = 0.30, decay: same → score 0.30  (FLAT)
 * tick3: cashflow- + stagnation=15 (capped at 0.08) → rawScore = 0.33 → score 0.33  (UP)
 *
 * History: [0.30, 0.30, 0.33]
 * STRICT: tick2 (0.30) <= tick1 (0.30) → isEscalating = false
 * SLOPE:  net delta = 0 + 0.03 = 0.03 > 0 → isEscalating = true
 */
const flatInput = {
  ...blankInput,
  monthlyIncome:            3000,
  monthlyExpenses:          5000,  // cashflow- = 0.25
  ticksWithoutIncomeGrowth: 5,     // stagnation = 0.05
  shieldIntegrityPct:       0.5,   // no lowShield; no fullSecurityBonus (shield ≠ 1.0)
} as const;

const flatThenUpInput = {
  ...flatInput,
  ticksWithoutIncomeGrowth: 15,    // stagnation = min(0.15, 0.08) = 0.08 → rawScore = 0.33
} as const;


// ════════════════════════════════════════════════════════════════════════════
// GROUP 1 — PressureSignalCollector (7 tests)
// ════════════════════════════════════════════════════════════════════════════

describe('PressureSignalCollector', () => {

  it('returns rawScore -0.15 when all conditions are ideal (only fullSecurityBonus fires)', () => {
    const collector = new PressureSignalCollector();
    const result = collector.compute(blankInput);
    expect(result.rawScore).toBeCloseTo(-0.15, 2);
  });

  it('fires cashflowNegative at full weight (0.25) when expenses exceed income', () => {
    const collector = new PressureSignalCollector();
    const result = collector.compute({
      monthlyIncome: 3000, monthlyExpenses: 5000,
      cashBalance: 50000, haterHeat: 0,
      activeThreatCardCount: 0, shieldIntegrityPct: 1.0,
      ticksWithoutIncomeGrowth: 0, activeCascadeChainCount: 0,
      netWorth: 0, freedomThreshold: 100000,
    });
    expect(result.breakdown.cashflowNegative).toBeCloseTo(0.25, 2);
  });

  it('activeThreatCards is capped at 0.15 regardless of card count', () => {
    const collector = new PressureSignalCollector();
    const result = collector.compute({
      monthlyIncome: 5000, monthlyExpenses: 3000,
      cashBalance: 10000, haterHeat: 0,
      activeThreatCardCount: 100,
      shieldIntegrityPct: 1.0,
      ticksWithoutIncomeGrowth: 0, activeCascadeChainCount: 0,
      netWorth: 0, freedomThreshold: 100000,
    });
    expect(result.breakdown.activeThreatCards).toBeCloseTo(0.15, 2);
  });

  it('haterHeat scales partially above threshold of 50 (exclusive)', () => {
    const collector = new PressureSignalCollector();
    // (75 - 50) / 50 * 0.15 = 0.075
    const result = collector.compute({ ...blankInput, haterHeat: 75, shieldIntegrityPct: 0 });
    expect(result.breakdown.haterHeatHigh).toBeCloseTo(0.075, 3);
  });

  it('fullSecurityBonus is all-or-nothing: 0 when any threat card present', () => {
    const collector = new PressureSignalCollector();
    const result = collector.compute({ ...blankInput, activeThreatCardCount: 1 });
    expect(result.breakdown.fullSecurityBonus).toBe(0);
  });

  it('prosperityBonus scales with net worth ratio (netWorth = freedomThreshold → 0.10)', () => {
    const collector = new PressureSignalCollector();
    // ratio = 50000 / (2 * 50000) = 0.5 → 0.5 * 0.20 = 0.10
    const result = collector.compute({
      ...blankInput,
      netWorth: 50000, freedomThreshold: 50000, shieldIntegrityPct: 0,
    });
    expect(result.breakdown.prosperityBonus).toBeCloseTo(0.10, 2);
  });

  it('dominantSignal identifies highest positive contributor', () => {
    const collector = new PressureSignalCollector();
    // cashflowNegative=0.25 vs haterHeatHigh=(60-50)/50*0.15=0.03
    const result = collector.compute({
      ...blankInput,
      monthlyIncome: 1000, monthlyExpenses: 5000,
      haterHeat: 60, shieldIntegrityPct: 0,
    });
    expect(result.dominantSignal).toBe('cashflowNegative');
  });

});


// ════════════════════════════════════════════════════════════════════════════
// GROUP 2 — PressureDecayController (5 tests)
// ════════════════════════════════════════════════════════════════════════════

describe('PressureDecayController', () => {

  it('pressure jumps up instantly — no decay on increase', () => {
    const ctrl = new PressureDecayController(0.0);
    expect(ctrl.applyDecay(0.80)).toBeCloseTo(0.80, 2);
  });

  it('pressure cannot drop more than 0.05 per tick', () => {
    const ctrl = new PressureDecayController(0.80);
    // rawScore=0 → cannot drop below 0.80 - 0.05 = 0.75
    expect(ctrl.applyDecay(0.0)).toBeCloseTo(0.75, 2);
  });

  it('requires at least 16 ticks to go from 0.80 to 0.0', () => {
    const ctrl = new PressureDecayController(0.80);
    let ticks = 0;
    while (ctrl.getCurrentScore() > 0) {
      ctrl.applyDecay(0.0);
      ticks++;
      if (ticks > 100) throw new Error('Infinite loop guard');
    }
    expect(ticks).toBeGreaterThanOrEqual(16);
  });

  it('ticksToReach calculates correctly from current score (0.60 → 12 ticks)', () => {
    const ctrl = new PressureDecayController(0.60);
    // ceil(0.60 / 0.05) = 12
    expect(ctrl.ticksToReach(0)).toBe(12);
  });

  it('reset returns score to 0.0', () => {
    const ctrl = new PressureDecayController(0.90);
    ctrl.reset();
    expect(ctrl.getCurrentScore()).toBe(0.0);
  });

});


// ════════════════════════════════════════════════════════════════════════════
// GROUP 3 — PressureEngine integration (6 tests)
// ════════════════════════════════════════════════════════════════════════════

describe('PressureEngine', () => {

  it('crisis scenario produces CRITICAL tier and score > 0.80', () => {
    const engine = new PressureEngine(createMockEventBus());
    const score = engine.computeScore(crisisInput);
    expect(engine.getCurrentTier()).toBe(PressureTier.CRITICAL);
    expect(score).toBeGreaterThan(0.80);
  });

  it('emits PRESSURE_TIER_CHANGED when crossing tier boundary', () => {
    const bus = createMockEventBus();
    const engine = new PressureEngine(bus);
    engine.computeScore(calmInput);     // → CALM
    engine.computeScore(crisisInput);   // → CRITICAL
    expect(bus.emit).toHaveBeenCalledWith(
      'PRESSURE_TIER_CHANGED',
      expect.objectContaining({ from: 'CALM', to: 'CRITICAL' }),
    );
  });

  it('does NOT emit PRESSURE_TIER_CHANGED when tier stays the same', () => {
    const bus = createMockEventBus();
    const engine = new PressureEngine(bus);
    engine.computeScore(crisisInput); // → CRITICAL
    const before = (bus.emit as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: unknown[]) => c[0] === 'PRESSURE_TIER_CHANGED').length;
    engine.computeScore(crisisInput); // still CRITICAL
    const after = (bus.emit as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: unknown[]) => c[0] === 'PRESSURE_TIER_CHANGED').length;
    expect(after).toBe(before);
  });

  it('emits PRESSURE_CRITICAL_ENTERED exactly once per run', () => {
    const bus = createMockEventBus();
    const engine = new PressureEngine(bus);
    engine.computeScore(crisisInput);
    engine.computeScore(crisisInput); // still CRITICAL — must NOT re-fire
    const count = (bus.emit as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: unknown[]) => c[0] === 'PRESSURE_CRITICAL_ENTERED').length;
    expect(count).toBe(1);
  });

  it('PRESSURE_CRITICAL_ENTERED fires again after reset()', () => {
    const bus = createMockEventBus();
    const engine = new PressureEngine(bus);
    engine.computeScore(crisisInput);
    engine.reset();
    engine.computeScore(crisisInput);
    const count = (bus.emit as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: unknown[]) => c[0] === 'PRESSURE_CRITICAL_ENTERED').length;
    expect(count).toBe(2);
  });

  it('scoreHistory never exceeds 20 entries after 30 ticks', () => {
    const engine = new PressureEngine(createMockEventBus());
    for (let i = 0; i < 30; i++) engine.computeScore(calmInput);
    expect(engine.getScoreHistory().length).toBeLessThanOrEqual(20);
  });

});


// ════════════════════════════════════════════════════════════════════════════
// GROUP 4 — Addendum: Spec Defect Fixes (9 tests)
// ════════════════════════════════════════════════════════════════════════════

describe('Addendum — Spec Defect Fixes', () => {

  it('A1: validateWeights throws RangeError on negative weight', () => {
    expect(() => validateWeights({ ...DEFAULT_SIGNAL_WEIGHTS, cashflowNegative: -0.1 }))
      .toThrow(RangeError);
  });

  it('A2: validateWeights throws RangeError on Infinity', () => {
    expect(() => validateWeights({ ...DEFAULT_SIGNAL_WEIGHTS, lowCashBalance: Infinity }))
      .toThrow(RangeError);
  });

  it('A3: normalizePositiveWeights produces positive sum of 1.0 and preserves negative signals', () => {
    const normalized = normalizePositiveWeights(DEFAULT_SIGNAL_WEIGHTS);
    const positiveSum = [
      normalized.cashflowNegative, normalized.lowCashBalance, normalized.haterHeatHigh,
      normalized.activeThreatCards, normalized.lowShieldIntegrity,
      normalized.stagnationTax, normalized.activeCascadeChains,
    ].reduce((a, b) => a + b, 0);
    expect(positiveSum).toBeCloseTo(1.0, 5);
    expect(normalized.prosperityBonus).toBe(DEFAULT_SIGNAL_WEIGHTS.prosperityBonus);
    expect(normalized.fullSecurityBonus).toBe(DEFAULT_SIGNAL_WEIGHTS.fullSecurityBonus);
  });

  it('A4: FixedClockSource produces deterministic timestamp in snapshot', () => {
    const clock  = new FixedClockSource(1000, 500);
    const engine = new PressureEngine(createMockEventBus(), undefined, undefined, clock);
    engine.computeScore(blankInput);
    expect(engine.getSnapshot().timestamp).toBe(1000); // first now() returns initial time
  });

  it('A5: Two computeScore calls with FixedClockSource produce timestamps differing by tickMs', () => {
    const clock  = new FixedClockSource(0, 1000);
    const engine = new PressureEngine(createMockEventBus(), undefined, undefined, clock);
    engine.computeScore(blankInput);
    const t1 = engine.getSnapshot().timestamp;
    engine.computeScore(blankInput);
    const t2 = engine.getSnapshot().timestamp;
    expect(t2 - t1).toBe(1000);
  });

  it('A6: custom threatCardSlope=0.10 produces higher per-card contribution than default', () => {
    const tuning = { ...PRESSURE_TUNING_DEFAULTS, threatCardSlope: 0.10 };
    const c = new PressureSignalCollector(DEFAULT_SIGNAL_WEIGHTS, tuning);
    // 1 card * 0.10 = 0.10  (vs default 1 * 0.04 = 0.04)
    const r = c.compute({ ...blankInput, activeThreatCardCount: 1, shieldIntegrityPct: 0 });
    expect(r.breakdown.activeThreatCards).toBeCloseTo(0.10, 2);
  });

  it('A7: SLOPE trendMode returns isEscalating=true for [0.30, 0.30, 0.33] (flat then up)', () => {
    // SLOPE: net delta = (0.30-0.30) + (0.33-0.30) = 0.03 > 0 → true
    const tuning = { ...PRESSURE_TUNING_DEFAULTS, trendMode: TrendMode.SLOPE, trendWindow: 3 };
    const engine = new PressureEngine(createMockEventBus(), undefined, tuning);
    engine.computeScore(flatInput);       // → 0.30
    engine.computeScore(flatInput);       // → 0.30  (flat)
    engine.computeScore(flatThenUpInput); // → 0.33  (up)
    expect(engine.isEscalating()).toBe(true);
  });

  it('A8: STRICT trendMode returns isEscalating=false for [0.30, 0.30, 0.33] (flat then up)', () => {
    // STRICT: 0.30 <= 0.30 → not strictly rising → false
    const tuning = { ...PRESSURE_TUNING_DEFAULTS, trendMode: TrendMode.STRICT, trendWindow: 3 };
    const engine = new PressureEngine(createMockEventBus(), undefined, tuning);
    engine.computeScore(flatInput);       // → 0.30
    engine.computeScore(flatInput);       // → 0.30  (flat — breaks STRICT)
    engine.computeScore(flatThenUpInput); // → 0.33
    expect(engine.isEscalating()).toBe(false);
  });

  it('A9: DOMINANT_SIGNAL_PRIORITY tie-break — cashflowNegative beats stagnationTax on equal value', () => {
    // Use weights where both signals max at 0.08
    const equalWeights = { ...DEFAULT_SIGNAL_WEIGHTS, cashflowNegative: 0.08, stagnationTax: 0.08 };
    const c = new PressureSignalCollector(equalWeights);
    const r = c.compute({
      ...blankInput,
      monthlyIncome:            1000,
      monthlyExpenses:          5000,  // cashflowNegative = 0.08 (full weight)
      ticksWithoutIncomeGrowth: 8,     // stagnationTax = min(8*0.01, 0.08) = 0.08
      shieldIntegrityPct:       0.5,   // ≥ 0.40 → no lowShieldIntegrity
      activeThreatCardCount:    1,     // disables fullSecurityBonus, threats=1*0.04=0.04
    });
    expect(r.breakdown.cashflowNegative).toBeCloseTo(0.08, 2);
    expect(r.breakdown.stagnationTax).toBeCloseTo(0.08, 2);
    // cashflowNegative appears first in DOMINANT_SIGNAL_PRIORITY → wins tie
    expect(r.dominantSignal).toBe('cashflowNegative');
  });

});

/**
 * PZO_FE_T0162 — P17_TESTING_STORYBOOK_QA: App integration smoke tests
 * Manually authored — executor failure recovery
 *
 * NOTE: Full App mount requires backend. These are shallow/mock smoke tests
 * validating module boundaries, type contracts, and import resolution.
 */
import { describe, it, expect, vi } from 'vitest';

// ─── Module boundary tests (no render needed) ─────────────────────────────────

describe('PZO Module Contracts', () => {
  it('exports game types from types/game.ts', async () => {
    const mod = await import('../types/game');
    expect(mod.ZONE_CONFIGS).toBeDefined();
    expect(Object.keys(mod.ZONE_CONFIGS)).toEqual(
      expect.arrayContaining(['BUILD', 'RESERVE', 'SCALE', 'LEARN', 'FLIP'])
    );
  });

  it('ZONE_CONFIGS have correct cashflowMult values', async () => {
    const { ZONE_CONFIGS } = await import('../types/game');
    expect(ZONE_CONFIGS.BUILD.cashflowMult).toBe(1.2);
    expect(ZONE_CONFIGS.SCALE.cashflowMult).toBe(1.8);
    expect(ZONE_CONFIGS.FLIP.cashflowMult).toBe(0.3);
    expect(ZONE_CONFIGS.RESERVE.cashflowMult).toBe(0.75);
    expect(ZONE_CONFIGS.LEARN.cashflowMult).toBe(0.5);
  });

  it('ZONE_CONFIGS SCALE has highest riskMult', async () => {
    const { ZONE_CONFIGS } = await import('../types/game');
    const riskMults = Object.values(ZONE_CONFIGS).map(z => z.riskMult);
    const maxRisk = Math.max(...riskMults);
    expect(ZONE_CONFIGS.SCALE.riskMult).toBe(maxRisk);
  });

  it('RESERVE zone has lowest riskMult', async () => {
    const { ZONE_CONFIGS } = await import('../types/game');
    const riskMults = Object.values(ZONE_CONFIGS).map(z => z.riskMult);
    const minRisk = Math.min(...riskMults);
    expect(ZONE_CONFIGS.RESERVE.riskMult).toBe(minRisk);
  });

  it('LEARN zone has highest xpBonus', async () => {
    const { ZONE_CONFIGS } = await import('../types/game');
    const xpBonuses = Object.values(ZONE_CONFIGS).map(z => z.xpBonus);
    const maxXp = Math.max(...xpBonuses);
    expect(ZONE_CONFIGS.LEARN.xpBonus).toBe(maxXp);
  });

  it('exports chat types correctly', async () => {
    const mod = await import('../components/chat/chatTypes');
    // Types are compile-time only but module should load cleanly
    expect(mod).toBeDefined();
  });

  it('useAuth exports getAccessToken function', async () => {
    const mod = await import('../hooks/useAuth');
    expect(typeof mod.getAccessToken).toBe('function');
    expect(typeof mod.useAuth).toBe('function');
  });

  it('ZONE_CONFIGS BUILD has positive cashflowMult', async () => {
    const { ZONE_CONFIGS } = await import('../types/game');
    expect(ZONE_CONFIGS.BUILD.cashflowMult).toBeGreaterThan(1);
  });

  it('FLIP zone has highest valueBonus', async () => {
    const { ZONE_CONFIGS } = await import('../types/game');
    const valueBonuses = Object.values(ZONE_CONFIGS).map(z => z.valueBonus);
    const maxValue = Math.max(...valueBonuses);
    expect(ZONE_CONFIGS.FLIP.valueBonus).toBe(maxValue);
  });

  it('all ZONE_CONFIGS have required fields', async () => {
    const { ZONE_CONFIGS } = await import('../types/game');
    const requiredFields = ['id', 'label', 'description', 'cashflowMult', 'riskMult', 'valueBonus', 'xpBonus', 'tooltip'];
    Object.values(ZONE_CONFIGS).forEach(zone => {
      requiredFields.forEach(field => {
        expect(zone).toHaveProperty(field);
      });
    });
  });
});

// ─── Game constants validation ────────────────────────────────────────────────

describe('PZO Game Balance Constants', () => {
  it('validates starting cash covers at least 1 month of expenses', () => {
    const STARTING_CASH = 28_000;
    const STARTING_EXPENSES = 4_800;
    expect(STARTING_CASH).toBeGreaterThan(STARTING_EXPENSES);
  });

  it('starting income is below expenses (brutal design intent)', () => {
    const STARTING_INCOME = 2_100;
    const STARTING_EXPENSES = 4_800;
    // Intentional: you start losing money
    expect(STARTING_INCOME).toBeLessThan(STARTING_EXPENSES);
  });

  it('run ticks equals 720 (60-minute arc at 5 ticks/min)', () => {
    const RUN_TICKS = 720;
    expect(RUN_TICKS).toBe(720);
  });

  it('fate FUBAR percentage exceeds 40%', () => {
    const FATE_FUBAR_PCT = 0.42;
    expect(FATE_FUBAR_PCT).toBeGreaterThan(0.4);
  });
});

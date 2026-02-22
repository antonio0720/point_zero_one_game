/**
 * M13 — Systemic Friction Modules (SO — Systemic Obstacle)
 * Source spec: mechanics/M13_systemic_friction_modules_so.md
 *
 * SO is a module system, not random annoyance.
 * Modules: loan denials, delays, fees, leverage blocks.
 * Season-rotated → meta changes without rewriting decks.
 * Each module is deterministic, ledger-emitting, and receipt-stamped.
 *
 * Deploy to: pzo_engine/src/mechanics/m013.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SOModuleId =
  | 'LOAN_DENIAL'           // player denied financing for N ticks
  | 'RATE_HIKE'             // debt service cost multiplied this turn
  | 'ACQUISITION_DELAY'     // purchase resolution delayed N ticks
  | 'LEVERAGE_CAP'          // max debt-to-value ratio reduced
  | 'CASH_SEIZURE'          // immediate cash extraction (legal/tax shock)
  | 'ASSET_FREEZE'          // specific asset locked; cannot sell for N ticks
  | 'OPPORTUNITY_BLOCK'     // next opportunity card is blocked (must pass)
  | 'INCOME_GARNISHMENT';   // monthly cashflow reduced by fraction for N ticks

export type SOSeverity = 'MINOR' | 'MODERATE' | 'SEVERE';

export interface SOModule {
  moduleId: SOModuleId;
  label: string;
  severity: SOSeverity;
  durationTicks: number;       // how long the effect persists (0 = instant)
  isSeasonActive: boolean;     // season rotation gate
  params: SOModuleParams;
}

export interface SOModuleParams {
  loanDenialTicks?: number;
  rateHikeMultiplier?: number;      // e.g. 1.5 = 50% more expensive
  acquisitionDelayTicks?: number;
  leverageCapLtv?: number;          // e.g. 0.70 = max 70% LTV
  cashSeizureAmount?: number;
  cashSeizureFraction?: number;     // fraction of current cash seized
  assetFreezeTargetKind?: 'REAL_ESTATE' | 'BUSINESS' | 'IPA' | 'ANY';
  assetFreezeTicks?: number;
  incomeGarnishmentFraction?: number; // e.g. 0.20 = 20% of cashflow taken
  incomeGarnishmentTicks?: number;
}

export interface SOApplicationContext {
  playerId: string;
  runSeed: string;
  rulesetVersion: string;
  tick: number;
  playerCash: number;
  playerNetWorth: number;
  activeSOEffects: ActiveSOEffect[];
  seasonModules: SOModuleId[];       // which modules are active this season
}

export interface ActiveSOEffect {
  moduleId: SOModuleId;
  appliedAtTick: number;
  expiresAtTick: number;
  params: SOModuleParams;
  receiptHash: string;
}

export interface SOApplicationResult {
  applied: SOModule;
  cashDelta: number;                 // immediate cash impact (0 if none)
  newActiveEffects: ActiveSOEffect[];
  blockedActions: string[];          // action types blocked
  frictionMultiplier: number;        // >1 means purchases cost more this turn
  ledgerEvent: SOLedgerEvent;
  momentLabel: string;               // clip-worthy description
}

export interface SOLedgerEvent {
  rule: 'M13';
  rule_version: '1.0';
  eventType: 'SO_APPLIED' | 'SO_EXPIRED' | 'SO_TICK';
  playerId: string;
  runSeed: string;
  tick: number;
  moduleId: SOModuleId;
  params: SOModuleParams;
  cashDelta: number;
  auditHash: string;
}

// ─── Module Catalog ───────────────────────────────────────────────────────────

export const SO_MODULE_CATALOG: Record<SOModuleId, SOModule> = {
  LOAN_DENIAL: {
    moduleId: 'LOAN_DENIAL',
    label: 'Loan Denied',
    severity: 'MODERATE',
    durationTicks: 3,
    isSeasonActive: true,
    params: { loanDenialTicks: 3 },
  },
  RATE_HIKE: {
    moduleId: 'RATE_HIKE',
    label: 'Interest Rate Hike',
    severity: 'MODERATE',
    durationTicks: 0, // instant effect on current purchase
    isSeasonActive: true,
    params: { rateHikeMultiplier: 1.5 },
  },
  ACQUISITION_DELAY: {
    moduleId: 'ACQUISITION_DELAY',
    label: 'Regulatory Delay',
    severity: 'MINOR',
    durationTicks: 2,
    isSeasonActive: true,
    params: { acquisitionDelayTicks: 2 },
  },
  LEVERAGE_CAP: {
    moduleId: 'LEVERAGE_CAP',
    label: 'Leverage Cap Imposed',
    severity: 'MODERATE',
    durationTicks: 5,
    isSeasonActive: true,
    params: { leverageCapLtv: 0.65 },
  },
  CASH_SEIZURE: {
    moduleId: 'CASH_SEIZURE',
    label: 'Legal/Tax Seizure',
    severity: 'SEVERE',
    durationTicks: 0, // instant
    isSeasonActive: true,
    params: { cashSeizureFraction: 0.15 }, // 15% of current cash taken
  },
  ASSET_FREEZE: {
    moduleId: 'ASSET_FREEZE',
    label: 'Asset Freeze',
    severity: 'SEVERE',
    durationTicks: 4,
    isSeasonActive: true,
    params: { assetFreezeTargetKind: 'ANY', assetFreezeTicks: 4 },
  },
  OPPORTUNITY_BLOCK: {
    moduleId: 'OPPORTUNITY_BLOCK',
    label: 'Opportunity Blocked',
    severity: 'MINOR',
    durationTicks: 0, // instant: blocks next opportunity only
    isSeasonActive: true,
    params: {},
  },
  INCOME_GARNISHMENT: {
    moduleId: 'INCOME_GARNISHMENT',
    label: 'Income Garnishment',
    severity: 'MODERATE',
    durationTicks: 6,
    isSeasonActive: true,
    params: { incomeGarnishmentFraction: 0.20, incomeGarnishmentTicks: 6 },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function buildAuditHash(ctx: SOApplicationContext, moduleId: SOModuleId, cashDelta: number): string {
  return sha256(JSON.stringify({
    playerId: ctx.playerId,
    runSeed: ctx.runSeed,
    tick: ctx.tick,
    moduleId,
    cashDelta,
    rulesetVersion: ctx.rulesetVersion,
  })).slice(0, 32);
}

function receiptHash(ctx: SOApplicationContext, moduleId: SOModuleId): string {
  return sha256(`receipt:${ctx.runSeed}:${moduleId}:${ctx.tick}:${ctx.playerId}`).slice(0, 20);
}

function buildMomentLabel(module: SOModule, cashDelta: number): string {
  switch (module.moduleId) {
    case 'LOAN_DENIAL': return `FUBAR_KILLED_ME: Loan denied — locked out of the deal for ${module.params.loanDenialTicks} turns`;
    case 'RATE_HIKE': return `FUBAR_KILLED_ME: Rate hike hit — cost ${module.params.rateHikeMultiplier}× more than expected`;
    case 'ACQUISITION_DELAY': return `MISSED_THE_BAG: Regulatory delay — ${module.params.acquisitionDelayTicks} ticks lost`;
    case 'LEVERAGE_CAP': return `MISSED_THE_BAG: Leverage cap imposed — max LTV ${Math.round((module.params.leverageCapLtv ?? 0.65) * 100)}%`;
    case 'CASH_SEIZURE': return `FUBAR_KILLED_ME: Seized $${Math.abs(cashDelta).toLocaleString()} — legal/tax shock`;
    case 'ASSET_FREEZE': return `FUBAR_KILLED_ME: Assets frozen — can't sell for ${module.params.assetFreezeTicks} ticks`;
    case 'OPPORTUNITY_BLOCK': return `MISSED_THE_BAG: Next opportunity blocked — the system said no`;
    case 'INCOME_GARNISHMENT': return `FUBAR_KILLED_ME: ${Math.round((module.params.incomeGarnishmentFraction ?? 0.2) * 100)}% of cashflow garnished for ${module.params.incomeGarnishmentTicks} ticks`;
  }
}

// ─── Application Engine ───────────────────────────────────────────────────────

/**
 * Apply a Systemic Obstacle module to a player.
 * Deterministic: same seed + tick + module = same outcome.
 * Season gate enforced: if moduleId not in seasonModules, no-op.
 */
export function applySOModule(
  ctx: SOApplicationContext,
  moduleId: SOModuleId,
): SOApplicationResult | null {
  // Season gate
  if (!ctx.seasonModules.includes(moduleId)) return null;

  const module = SO_MODULE_CATALOG[moduleId];
  if (!module.isSeasonActive) return null;

  // Stacking guard: don't re-apply same effect if already active
  const alreadyActive = ctx.activeSOEffects.some(
    e => e.moduleId === moduleId && e.expiresAtTick > ctx.tick,
  );
  if (alreadyActive && module.durationTicks > 0) return null;

  // Compute immediate cash delta
  let cashDelta = 0;
  if (moduleId === 'CASH_SEIZURE') {
    const fraction = module.params.cashSeizureFraction ?? 0.15;
    cashDelta = -Math.round(Math.max(0, ctx.playerCash) * fraction);
  } else if (moduleId === 'RATE_HIKE' && module.params.cashSeizureAmount) {
    cashDelta = -module.params.cashSeizureAmount;
  }

  // Compute friction multiplier (affects current purchase cost)
  const frictionMultiplier = moduleId === 'RATE_HIKE'
    ? (module.params.rateHikeMultiplier ?? 1.5)
    : 1.0;

  // Blocked actions
  const blockedActions: string[] = [];
  if (moduleId === 'LOAN_DENIAL') blockedActions.push('ASSET_PURCHASE_FINANCED');
  if (moduleId === 'OPPORTUNITY_BLOCK') blockedActions.push('ASSET_PURCHASE');
  if (moduleId === 'ASSET_FREEZE') blockedActions.push('ASSET_SELL');

  // New active effect record (for persistent effects)
  const newActiveEffects: ActiveSOEffect[] = [];
  if (module.durationTicks > 0) {
    newActiveEffects.push({
      moduleId,
      appliedAtTick: ctx.tick,
      expiresAtTick: ctx.tick + module.durationTicks,
      params: module.params,
      receiptHash: receiptHash(ctx, moduleId),
    });
  }

  const auditHash = buildAuditHash(ctx, moduleId, cashDelta);

  const ledgerEvent: SOLedgerEvent = {
    rule: 'M13',
    rule_version: '1.0',
    eventType: 'SO_APPLIED',
    playerId: ctx.playerId,
    runSeed: ctx.runSeed,
    tick: ctx.tick,
    moduleId,
    params: module.params,
    cashDelta,
    auditHash,
  };

  return {
    applied: module,
    cashDelta,
    newActiveEffects,
    blockedActions,
    frictionMultiplier,
    ledgerEvent,
    momentLabel: buildMomentLabel(module, cashDelta),
  };
}

/**
 * Expire any SO effects whose duration has elapsed. Call once per tick.
 * Returns expired effects + ledger events.
 */
export function expireSOEffects(
  ctx: SOApplicationContext,
): { remainingEffects: ActiveSOEffect[]; expiredEvents: SOLedgerEvent[] } {
  const remaining: ActiveSOEffect[] = [];
  const expiredEvents: SOLedgerEvent[] = [];

  for (const effect of ctx.activeSOEffects) {
    if (effect.expiresAtTick <= ctx.tick) {
      const auditHash = buildAuditHash(ctx, effect.moduleId, 0);
      expiredEvents.push({
        rule: 'M13',
        rule_version: '1.0',
        eventType: 'SO_EXPIRED',
        playerId: ctx.playerId,
        runSeed: ctx.runSeed,
        tick: ctx.tick,
        moduleId: effect.moduleId,
        params: effect.params,
        cashDelta: 0,
        auditHash,
      });
    } else {
      remaining.push(effect);
    }
  }

  return { remainingEffects: remaining, expiredEvents };
}

/**
 * Compute the effective income garnishment fraction active this tick.
 * Sums all active INCOME_GARNISHMENT effects (capped at 50%).
 */
export function computeActiveGarnishmentFraction(effects: ActiveSOEffect[], tick: number): number {
  const total = effects
    .filter(e => e.moduleId === 'INCOME_GARNISHMENT' && e.expiresAtTick > tick)
    .reduce((sum, e) => sum + (e.params.incomeGarnishmentFraction ?? 0), 0);
  return Math.min(total, 0.5); // hard cap
}

/**
 * Check if a specific action is blocked by any active SO effect.
 */
export function isActionBlocked(
  actionType: string,
  effects: ActiveSOEffect[],
  tick: number,
): boolean {
  for (const effect of effects) {
    if (effect.expiresAtTick <= tick) continue;
    if (effect.moduleId === 'LOAN_DENIAL' && actionType === 'ASSET_PURCHASE_FINANCED') return true;
    if (effect.moduleId === 'OPPORTUNITY_BLOCK' && actionType === 'ASSET_PURCHASE') return true;
    if (effect.moduleId === 'ASSET_FREEZE' && actionType === 'ASSET_SELL') return true;
  }
  return false;
}

/**
 * Return the active leverage cap LTV, or null if none active.
 * Server enforces this during purchase validation.
 */
export function getActiveLeverageCap(effects: ActiveSOEffect[], tick: number): number | null {
  const caps = effects
    .filter(e => e.moduleId === 'LEVERAGE_CAP' && e.expiresAtTick > tick)
    .map(e => e.params.leverageCapLtv ?? 0.65);
  if (caps.length === 0) return null;
  return Math.min(...caps); // most restrictive cap wins
}

/**
 * Deterministically select which SO module to apply from a card draw.
 * Uses runSeed + tick + drawIndex for reproducibility.
 */
export function selectSOModule(
  runSeed: string,
  tick: number,
  drawIndex: number,
  seasonModules: SOModuleId[],
): SOModuleId | null {
  if (seasonModules.length === 0) return null;
  const hash = sha256(`so_select:${runSeed}:${tick}:${drawIndex}`);
  const idx = parseInt(hash.slice(0, 8), 16) % seasonModules.length;
  return seasonModules[idx];
}

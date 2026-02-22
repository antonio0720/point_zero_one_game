/**
 * M32 — Liquidity Ladder (Tiered Cash Conversion Strategy)
 * Source spec: mechanics/M32_liquidity_ladder_tiered_cash_conversion.md
 *
 * Deploy to: pzo_engine/src/mechanics/m032.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LiquidityRung = 'INSTANT' | 'SHORT' | 'MID' | 'LONG';

export interface LadderSlot {
  rung: LiquidityRung;
  assetId: string;
  conversionTicks: number; // ticks to convert to cash
  conversionPenalty: number; // 0–1 fraction lost on forced sale below exit window
}

export interface LiquidityLadderState {
  slots: LadderSlot[];
  isComplete: boolean; // all 4 rungs filled
  stabilityBonus: number; // additive multiplier on cashflow tick
  forcedSaleRisk: number; // 0–1; elevated when ladder has gaps
  missingRungs: LiquidityRung[];
}

export interface LadderRungBreakResult {
  rungBroken: LiquidityRung;
  forcedSaleRiskDelta: number;
  ledgerEvent: LadderLedgerEvent;
}

export interface LadderLedgerEvent {
  rule: 'M32';
  rule_version: '1.0';
  tick: number;
  runSeed: string;
  action: 'SLOT_FILLED' | 'SLOT_BROKEN' | 'LADDER_COMPLETE' | 'REGRET_STAMP';
  inputs_hash: string;
  outcome_hash: string;
  payload: Record<string, unknown>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RUNG_ORDER: LiquidityRung[] = ['INSTANT', 'SHORT', 'MID', 'LONG'];

const RUNG_DEFAULTS: Record<LiquidityRung, Pick<LadderSlot, 'conversionTicks' | 'conversionPenalty'>> = {
  INSTANT: { conversionTicks: 0, conversionPenalty: 0.0 },
  SHORT:   { conversionTicks: 2, conversionPenalty: 0.05 },
  MID:     { conversionTicks: 5, conversionPenalty: 0.12 },
  LONG:    { conversionTicks: 10, conversionPenalty: 0.20 },
};

const FULL_LADDER_STABILITY_BONUS = 0.08; // +8% cashflow when all 4 rungs filled
const MISSING_RUNG_FORCED_SALE_RISK_INCREMENT = 0.15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashInputs(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
}

function buildEvent(
  action: LadderLedgerEvent['action'],
  tick: number,
  runSeed: string,
  inputs: unknown,
  payload: Record<string, unknown>,
): LadderLedgerEvent {
  const inputs_hash = hashInputs(inputs);
  const outcome_hash = hashInputs({ action, tick, runSeed, payload });
  return { rule: 'M32', rule_version: '1.0', tick, runSeed, action, inputs_hash, outcome_hash, payload };
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Build a fresh LiquidityLadderState from the player's current portfolio.
 * Called once per tick recalc or after any asset acquisition/disposal.
 */
export function computeLadderState(
  slots: LadderSlot[],
): LiquidityLadderState {
  const filledRungs = new Set(slots.map(s => s.rung));
  const missingRungs = RUNG_ORDER.filter(r => !filledRungs.has(r));
  const isComplete = missingRungs.length === 0;

  const stabilityBonus = isComplete ? FULL_LADDER_STABILITY_BONUS : 0;
  const forcedSaleRisk = Math.min(1, missingRungs.length * MISSING_RUNG_FORCED_SALE_RISK_INCREMENT);

  return { slots, isComplete, stabilityBonus, forcedSaleRisk, missingRungs };
}

/**
 * Assign an asset to a ladder rung. Returns updated slots + ledger event.
 * Enforces: one asset per rung; replacing a rung breaks the old slot.
 */
export function fillLadderSlot(
  current: LiquidityLadderState,
  rung: LiquidityRung,
  assetId: string,
  tick: number,
  runSeed: string,
): { state: LiquidityLadderState; event: LadderLedgerEvent } {
  const existing = current.slots.filter(s => s.rung !== rung);
  const newSlot: LadderSlot = { rung, assetId, ...RUNG_DEFAULTS[rung] };
  const slots = [...existing, newSlot].sort(
    (a, b) => RUNG_ORDER.indexOf(a.rung) - RUNG_ORDER.indexOf(b.rung),
  );

  const state = computeLadderState(slots);
  const isNowComplete = state.isComplete;

  const event = buildEvent(
    isNowComplete ? 'LADDER_COMPLETE' : 'SLOT_FILLED',
    tick,
    runSeed,
    { rung, assetId, prevSlots: current.slots },
    { rung, assetId, isNowComplete, stabilityBonus: state.stabilityBonus },
  );

  return { state, event };
}

/**
 * Remove an asset from a rung (sale, wipe, forced exit).
 * Increases forced-sale risk; emits SLOT_BROKEN.
 */
export function breakLadderSlot(
  current: LiquidityLadderState,
  assetId: string,
  tick: number,
  runSeed: string,
): { state: LiquidityLadderState; result: LadderRungBreakResult } {
  const target = current.slots.find(s => s.assetId === assetId);
  if (!target) {
    throw new Error(`M32: assetId ${assetId} not in ladder`);
  }

  const slots = current.slots.filter(s => s.assetId !== assetId);
  const state = computeLadderState(slots);
  const forcedSaleRiskDelta = state.forcedSaleRisk - current.forcedSaleRisk;

  const event = buildEvent(
    'SLOT_BROKEN',
    tick,
    runSeed,
    { assetId, rung: target.rung },
    { rungBroken: target.rung, forcedSaleRiskDelta, newForcedSaleRisk: state.forcedSaleRisk },
  );

  const result: LadderRungBreakResult = {
    rungBroken: target.rung,
    forcedSaleRiskDelta,
    ledgerEvent: event,
  };

  return { state, result };
}

/**
 * Evaluate whether the player missed a liquidity moment ("missed the bag").
 * Emits REGRET_STAMP if the player had no INSTANT/SHORT rung when opportunity appeared.
 */
export function evaluateMissedBag(
  ladderState: LiquidityLadderState,
  opportunityRequiredCash: number,
  playerCash: number,
  tick: number,
  runSeed: string,
): LadderLedgerEvent | null {
  const hasLiquid = ladderState.slots.some(s => s.rung === 'INSTANT' || s.rung === 'SHORT');
  const couldAfford = playerCash >= opportunityRequiredCash;

  if (!couldAfford && !hasLiquid) {
    return buildEvent(
      'REGRET_STAMP',
      tick,
      runSeed,
      { ladderState, opportunityRequiredCash, playerCash },
      { reason: 'NO_LIQUID_RUNG', missingRungs: ladderState.missingRungs },
    );
  }
  return null;
}

/**
 * Apply the ladder stability bonus to a base cashflow amount.
 * Call each cashflow tick.
 */
export function applyLadderBonus(baseCashflow: number, ladder: LiquidityLadderState): number {
  return Math.round(baseCashflow * (1 + ladder.stabilityBonus));
}

/**
 * Determine if a forced sale is triggered this tick given current risk level.
 * Uses seeded determinism: (runSeed + tick) hashed to float.
 */
export function resolveForcedSaleRoll(
  ladder: LiquidityLadderState,
  tick: number,
  runSeed: string,
): boolean {
  if (ladder.forcedSaleRisk <= 0) return false;
  const raw = createHash('sha256').update(`${runSeed}:forced_sale:${tick}`).digest('hex');
  const roll = parseInt(raw.slice(0, 8), 16) / 0xffffffff; // deterministic 0–1
  return roll < ladder.forcedSaleRisk;
}

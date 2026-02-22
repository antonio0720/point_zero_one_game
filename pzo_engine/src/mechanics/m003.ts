/**
 * M03 — Solvency Wipe Conditions
 * Source spec: mechanics/M03_solvency_wipe_conditions.md
 *
 * Defines "death" precisely:
 *   1. Cash < 0 AND forced-sale chain cannot clear debt service
 *   2. Net worth below recovery threshold
 *   3. Macro-decay drove cash to zero at end-of-rotation
 *
 * On wipe: snapshots the clip-worthy cause for M22 MomentForge + M50 ProofCards.
 *
 * Deploy to: pzo_engine/src/mechanics/m003.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WipeCause =
  | 'CASH_NEGATIVE_UNRECOVERABLE'   // cash < 0 and liquidation value < gap
  | 'NET_WORTH_BELOW_FLOOR'         // net worth < -$100k
  | 'MACRO_DECAY_ZEROED_CASH'       // clock-decay drained cash to ≤ 0 at rotation end
  | 'DEBT_SERVICE_CANNOT_BE_MET'    // monthly obligations exceed all recoverable cash
  | 'FORCED_SALE_SHORTFALL';        // forced liquidation proceeds < debt owed

export interface AssetSnapshot {
  assetId: string;
  assetKind: 'REAL_ESTATE' | 'BUSINESS' | 'IPA';
  currentValue: number;
  debtAmount: number;
  exitMin: number;    // minimum liquidation value
  exitMax: number;    // maximum liquidation value
  monthlyDebtService: number;
  monthlyIncome: number;
}

export interface PlayerSolvencyState {
  playerId: string;
  cash: number;
  passiveIncomeMonthly: number;
  monthlyExpenses: number;         // debt service + living expenses
  netWorth: number;                // totalAssets + cash - totalLiabilities
  assets: AssetSnapshot[];
  activeShields: number;
  turnsLocked: number;
  runSeed: string;
  tick: number;
  rulesetVersion: string;
}

export interface WipeResult {
  isWipe: boolean;
  causes: WipeCause[];
  primaryCause: WipeCause | null;
  netWorthAtWipe: number;
  cashAtWipe: number;
  recoveryGap: number;           // how much cash was irrecoverable
  clipMomentLabel: string;       // FUBAR_KILLED_ME moment string for MomentForge
  auditHash: string;
  ledgerEvent: WipeLedgerEvent;
}

export interface WipeLedgerEvent {
  rule: 'M03';
  rule_version: '1.0';
  eventType: 'SOLVENCY_WIPE' | 'SOLVENCY_WARNING' | 'SOLVENCY_CLEAR';
  playerId: string;
  runSeed: string;
  tick: number;
  causes: WipeCause[];
  snapshot: {
    cash: number;
    netWorth: number;
    recoveryGap: number;
    assetCount: number;
  };
  auditHash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Net worth below this = wipe regardless of cash. */
export const NET_WORTH_WIPE_FLOOR = -100_000;

/** Cash below this = immediate wipe (no recovery possible). */
export const ABSOLUTE_CASH_FLOOR = -500_000;

/** Warning threshold: net worth below this triggers UI warning but not wipe. */
export const NET_WORTH_WARNING_THRESHOLD = -25_000;

/** Forced-sale proceeds are at exitMin, which we assume 70% of cost if not provided. */
export const FORCED_SALE_RECOVERY_RATE = 0.70;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function buildAuditHash(state: PlayerSolvencyState, causes: WipeCause[]): string {
  return sha256(JSON.stringify({
    playerId: state.playerId,
    runSeed: state.runSeed,
    tick: state.tick,
    cash: state.cash,
    netWorth: state.netWorth,
    causes,
    rulesetVersion: state.rulesetVersion,
  })).slice(0, 32);
}

function clipMomentLabel(primary: WipeCause, cash: number, netWorth: number): string {
  switch (primary) {
    case 'CASH_NEGATIVE_UNRECOVERABLE':
      return `FUBAR_KILLED_ME: Ran out of cash (${formatMoney(cash)}) — couldn't cover the gap`;
    case 'NET_WORTH_BELOW_FLOOR':
      return `FUBAR_KILLED_ME: Net worth collapsed to ${formatMoney(netWorth)}`;
    case 'MACRO_DECAY_ZEROED_CASH':
      return `FUBAR_KILLED_ME: Clock decay drained my last dollar`;
    case 'DEBT_SERVICE_CANNOT_BE_MET':
      return `FUBAR_KILLED_ME: Monthly obligations exceeded everything I had`;
    case 'FORCED_SALE_SHORTFALL':
      return `FUBAR_KILLED_ME: Forced sale proceeds couldn't cover the debt`;
  }
}

function formatMoney(n: number): string {
  if (n < 0) return `-$${Math.abs(n).toLocaleString()}`;
  return `$${n.toLocaleString()}`;
}

// ─── Liquidation Value Calculator ────────────────────────────────────────────

/**
 * Estimate total net proceeds from liquidating all assets at exitMin
 * (worst-case forced-sale scenario).
 */
export function computeMaxLiquidationProceeds(assets: AssetSnapshot[]): number {
  return assets.reduce((sum, a) => {
    const exitValue = a.exitMin > 0 ? a.exitMin : a.currentValue * FORCED_SALE_RECOVERY_RATE;
    const netProceeds = Math.max(0, exitValue - a.debtAmount);
    return sum + netProceeds;
  }, 0);
}

/**
 * Compute total monthly debt service obligation across all assets.
 */
export function computeMonthlyDebtService(assets: AssetSnapshot[]): number {
  return assets.reduce((sum, a) => sum + a.monthlyDebtService, 0);
}

// ─── Wipe Evaluators ─────────────────────────────────────────────────────────

function checkCashNegativeUnrecoverable(state: PlayerSolvencyState): boolean {
  if (state.cash >= 0) return false;
  const maxRecovery = computeMaxLiquidationProceeds(state.assets);
  return maxRecovery < Math.abs(state.cash);
}

function checkNetWorthBelowFloor(state: PlayerSolvencyState): boolean {
  return state.netWorth < NET_WORTH_WIPE_FLOOR;
}

function checkAbsoluteCashFloor(state: PlayerSolvencyState): boolean {
  return state.cash < ABSOLUTE_CASH_FLOOR;
}

function checkDebtServiceCannotBeMet(state: PlayerSolvencyState): boolean {
  // Monthly obligations can't be met even if all assets liquidated
  const totalMonthlyObligations = state.monthlyExpenses;
  const monthlyIncome = state.passiveIncomeMonthly;
  const cashflow = monthlyIncome - totalMonthlyObligations;

  if (cashflow >= 0) return false; // net positive; fine

  const maxRecovery = computeMaxLiquidationProceeds(state.assets);
  // How many months can the recovery gap cover the shortfall?
  const monthsCovered = maxRecovery / Math.abs(cashflow);
  // If less than 1 month covered and cash is already negative → wipe
  return monthsCovered < 1 && state.cash < 0;
}

function checkForcedSaleShortfall(
  state: PlayerSolvencyState,
  forcedSaleDebtDue: number,
): boolean {
  if (forcedSaleDebtDue <= 0) return false;
  const maxRecovery = computeMaxLiquidationProceeds(state.assets) + Math.max(0, state.cash);
  return maxRecovery < forcedSaleDebtDue;
}

// ─── Recovery Gap ─────────────────────────────────────────────────────────────

export function computeRecoveryGap(state: PlayerSolvencyState): number {
  if (state.cash >= 0) return 0;
  const maxRecovery = computeMaxLiquidationProceeds(state.assets);
  return Math.max(0, Math.abs(state.cash) - maxRecovery);
}

// ─── Main Evaluation ─────────────────────────────────────────────────────────

/**
 * Full solvency wipe check. Call at end of each turn and after any
 * cash-affecting event (FUBAR, macro-decay, forced sale).
 *
 * @param forcedSaleDebtDue - if a forced sale just occurred, pass amount owed
 */
export function evaluateSolvencyWipe(
  state: PlayerSolvencyState,
  forcedSaleDebtDue = 0,
): WipeResult {
  const causes: WipeCause[] = [];

  if (checkAbsoluteCashFloor(state)) causes.push('CASH_NEGATIVE_UNRECOVERABLE');
  if (checkNetWorthBelowFloor(state)) causes.push('NET_WORTH_BELOW_FLOOR');
  if (checkCashNegativeUnrecoverable(state)) {
    if (!causes.includes('CASH_NEGATIVE_UNRECOVERABLE')) causes.push('CASH_NEGATIVE_UNRECOVERABLE');
  }
  if (checkDebtServiceCannotBeMet(state)) causes.push('DEBT_SERVICE_CANNOT_BE_MET');
  if (checkForcedSaleShortfall(state, forcedSaleDebtDue)) causes.push('FORCED_SALE_SHORTFALL');

  const isWipe = causes.length > 0;
  const primaryCause = causes[0] ?? null;
  const recoveryGap = computeRecoveryGap(state);
  const auditHash = buildAuditHash(state, causes);

  const ledgerEvent: WipeLedgerEvent = {
    rule: 'M03',
    rule_version: '1.0',
    eventType: isWipe ? 'SOLVENCY_WIPE' : 'SOLVENCY_CLEAR',
    playerId: state.playerId,
    runSeed: state.runSeed,
    tick: state.tick,
    causes,
    snapshot: {
      cash: state.cash,
      netWorth: state.netWorth,
      recoveryGap,
      assetCount: state.assets.length,
    },
    auditHash,
  };

  return {
    isWipe,
    causes,
    primaryCause,
    netWorthAtWipe: state.netWorth,
    cashAtWipe: state.cash,
    recoveryGap,
    clipMomentLabel: primaryCause
      ? clipMomentLabel(primaryCause, state.cash, state.netWorth)
      : '',
    auditHash,
    ledgerEvent,
  };
}

/**
 * Warning check — not a wipe, but UI should signal danger.
 * Returns warning ledger event if below warning threshold.
 */
export function evaluateSolvencyWarning(state: PlayerSolvencyState): WipeLedgerEvent | null {
  if (state.netWorth >= NET_WORTH_WARNING_THRESHOLD && state.cash >= 0) return null;

  const auditHash = buildAuditHash(state, []);
  return {
    rule: 'M03',
    rule_version: '1.0',
    eventType: 'SOLVENCY_WARNING',
    playerId: state.playerId,
    runSeed: state.runSeed,
    tick: state.tick,
    causes: [],
    snapshot: {
      cash: state.cash,
      netWorth: state.netWorth,
      recoveryGap: computeRecoveryGap(state),
      assetCount: state.assets.length,
    },
    auditHash,
  };
}

/**
 * Apply a macro-decay drain to cash and re-evaluate.
 * Used by M02 clock integration.
 */
export function applyMacroDecayAndEvaluate(
  state: PlayerSolvencyState,
  decayAmount: number,
): { updatedCash: number; wipeResult: WipeResult } {
  const updatedCash = state.cash - decayAmount;
  const updatedState: PlayerSolvencyState = {
    ...state,
    cash: updatedCash,
    netWorth: state.netWorth - decayAmount,
  };
  const wipeResult = evaluateSolvencyWipe(updatedState);
  // tag primary cause as macro-decay if cash went non-positive
  if (wipeResult.isWipe && updatedCash <= 0 && !wipeResult.causes.includes('MACRO_DECAY_ZEROED_CASH')) {
    wipeResult.causes.unshift('MACRO_DECAY_ZEROED_CASH');
    wipeResult.primaryCause = 'MACRO_DECAY_ZEROED_CASH';
  }
  return { updatedCash, wipeResult };
}

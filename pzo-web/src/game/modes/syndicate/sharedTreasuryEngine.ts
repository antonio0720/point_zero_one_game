// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/sharedTreasuryEngine.ts
// Sprint 5 — Shared Treasury System — SOVEREIGN EDITION
// Density6 LLC · Confidential
//
// Shared treasury = collective fund accessible by all alliance members.
// Bible: all income flows into treasury; all expenses draw from it.
// Deposits/withdrawals tracked per player. Fee on withdrawals (2%).
// Used by rescue windows and aid contracts.
//
// CHANGE LOG:
//   • Added poolIncomeToTreasury() — bible: income flows directly into treasury
//   • Added TREASURY_FREEDOM_THRESHOLD = solo × 1.8
//   • Added isCriticalTreasury() — $3K triggers shield regen halving
//   • Added autoFundRescue() — automatic disbursement on rescue window open
//   • Added splitAtRunEnd() — end-of-run treasury split by share ratio
//   • Added computeDefectorWithdrawal() — 40% seizure (bible-accurate fix)
//   • Added treasuryToCORD() — treasury performance → CORD weight
//   • Ledger compressed to 50 entries (SYNDICATE_CONFIG.ledgerMaxEntries)
//   • Added TREASURY_HARD_CAP enforcement
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG } from './syndicateConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TreasuryLedgerEntry {
  id: string;
  playerId: string;
  type:
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'RESCUE_DISBURSEMENT'
    | 'AID_TRANSFER'
    | 'FEE'
    | 'DEFECTION_SEIZURE'
    | 'INCOME_POOL'
    | 'EXPENSE_DRAW'
    | 'SPLIT_DISTRIBUTION';
  amount: number;
  tick: number;
  note: string;
}

export interface SharedTreasuryState {
  balance: number;
  contributions: Record<string, number>;   // playerId → total deposited
  withdrawals:   Record<string, number>;   // playerId → total withdrawn
  ledger: TreasuryLedgerEntry[];
  totalFeesCollected: number;
  /** Is treasury in CRITICAL state? (balance < 3000 with 2+ players not at FREEDOM) */
  isCritical: boolean;
  /** Total income pooled across all members this run */
  totalIncomePooled: number;
  /** Total expenses drawn across all members this run */
  totalExpensesDrawn: number;
}

export const INITIAL_TREASURY_STATE: SharedTreasuryState = {
  balance:          0,
  contributions:    {},
  withdrawals:      {},
  ledger:           [],
  totalFeesCollected: 0,
  isCritical:       false,
  totalIncomePooled: 0,
  totalExpensesDrawn: 0,
};

// ─── Income Pooling (bible: all income flows into shared treasury) ─────────────

/**
 * Pool per-tick income from a player into the shared treasury.
 * This replaces individual cash accumulation in full TEAM UP implementation.
 */
export function poolIncomeToTreasury(
  state: SharedTreasuryState,
  playerId: string,
  incomeAmount: number,
  tick: number,
): SharedTreasuryState {
  const newBalance = Math.min(
    SYNDICATE_CONFIG.treasuryHardCap,
    state.balance + incomeAmount,
  );

  const entry: TreasuryLedgerEntry = {
    id:       `tl-${tick}-${playerId}-income`,
    playerId, type: 'INCOME_POOL', amount: incomeAmount, tick,
    note:     `Income pool from player`,
  };

  return {
    ...state,
    balance:           newBalance,
    totalIncomePooled: state.totalIncomePooled + incomeAmount,
    contributions: {
      ...state.contributions,
      [playerId]: (state.contributions[playerId] ?? 0) + incomeAmount,
    },
    ledger: [...state.ledger, entry].slice(-SYNDICATE_CONFIG.ledgerMaxEntries),
  };
}

/**
 * Draw expenses from shared treasury.
 * Returns a result indicating if treasury is now critical.
 */
export function drawExpensesFromTreasury(
  state: SharedTreasuryState,
  playerId: string,
  expenseAmount: number,
  tick: number,
  activePlayers: number,
): SharedTreasuryState {
  const newBalance = Math.max(0, state.balance - expenseAmount);
  const entry: TreasuryLedgerEntry = {
    id:       `tl-${tick}-${playerId}-expense`,
    playerId, type: 'EXPENSE_DRAW', amount: expenseAmount, tick,
    note:     `Expense draw`,
  };
  const critical = newBalance < SYNDICATE_CONFIG.criticalTreasuryThreshold && activePlayers >= 2;

  return {
    ...state,
    balance:            newBalance,
    totalExpensesDrawn: state.totalExpensesDrawn + expenseAmount,
    isCritical:         critical,
    ledger:             [...state.ledger, entry].slice(-SYNDICATE_CONFIG.ledgerMaxEntries),
  };
}

/** Check if treasury should trigger CRITICAL state */
export function isCriticalTreasury(state: SharedTreasuryState, activePlayers: number): boolean {
  return state.balance < SYNDICATE_CONFIG.criticalTreasuryThreshold && activePlayers >= 2;
}

/** Compute team FREEDOM threshold (solo threshold × 1.8) */
export function computeFreedomThreshold(soloFreedomThreshold: number): number {
  return Math.round(soloFreedomThreshold * SYNDICATE_CONFIG.freedomThresholdMultiplier);
}

// ─── Standard Deposit / Withdrawal ───────────────────────────────────────────

export function depositToTreasury(
  state: SharedTreasuryState,
  playerId: string,
  amount: number,
  tick: number,
  note: string = 'Player deposit',
): SharedTreasuryState {
  const newBalance = Math.min(SYNDICATE_CONFIG.treasuryHardCap, state.balance + amount);

  const entry: TreasuryLedgerEntry = {
    id: `tl-${tick}-${playerId}-dep`,
    playerId, type: 'DEPOSIT', amount, tick, note,
  };

  return {
    ...state,
    balance: newBalance,
    contributions: {
      ...state.contributions,
      [playerId]: (state.contributions[playerId] ?? 0) + amount,
    },
    ledger: [...state.ledger, entry].slice(-SYNDICATE_CONFIG.ledgerMaxEntries),
  };
}

export interface WithdrawalResult {
  success: boolean;
  reason?: string;
  amountReceived: number;
  feePaid: number;
  updatedState: SharedTreasuryState;
}

export function withdrawFromTreasury(
  state: SharedTreasuryState,
  playerId: string,
  requestedAmount: number,
  tick: number,
  note: string = 'Player withdrawal',
): WithdrawalResult {
  if (requestedAmount > state.balance) {
    return { success: false, reason: 'INSUFFICIENT_BALANCE', amountReceived: 0, feePaid: 0, updatedState: state };
  }

  const fee            = Math.round(requestedAmount * SYNDICATE_CONFIG.treasuryFeeRate);
  const amountReceived = requestedAmount - fee;

  const entries: TreasuryLedgerEntry[] = [
    { id: `tl-${tick}-${playerId}-wdraw`, playerId, type: 'WITHDRAWAL', amount: requestedAmount, tick, note },
    { id: `tl-${tick}-${playerId}-fee`,   playerId, type: 'FEE',        amount: fee,             tick, note: 'Treasury fee' },
  ];

  const updatedState: SharedTreasuryState = {
    ...state,
    balance:             state.balance - requestedAmount,
    withdrawals:         { ...state.withdrawals, [playerId]: (state.withdrawals[playerId] ?? 0) + requestedAmount },
    totalFeesCollected:  state.totalFeesCollected + fee,
    ledger:              [...state.ledger, ...entries].slice(-SYNDICATE_CONFIG.ledgerMaxEntries),
  };

  return { success: true, amountReceived, feePaid: fee, updatedState };
}

// ─── Rescue Disbursement ──────────────────────────────────────────────────────

export function autoFundRescue(
  state: SharedTreasuryState,
  recipientId: string,
  amount: number,
  tick: number,
): { disbursed: number; updatedState: SharedTreasuryState } {
  const disbursed = Math.min(amount, state.balance);
  if (disbursed === 0) return { disbursed: 0, updatedState: state };

  const entry: TreasuryLedgerEntry = {
    id:       `tl-${tick}-autorescue-${recipientId}`,
    playerId: recipientId, type: 'RESCUE_DISBURSEMENT', amount: disbursed, tick,
    note:     `Auto rescue disbursement`,
  };

  return {
    disbursed,
    updatedState: {
      ...state,
      balance: state.balance - disbursed,
      ledger:  [...state.ledger, entry].slice(-SYNDICATE_CONFIG.ledgerMaxEntries),
    },
  };
}

export function disburseTreasuryRescue(
  state: SharedTreasuryState,
  recipientId: string,
  amount: number,
  tick: number,
): { disbursed: number; updatedState: SharedTreasuryState } {
  return autoFundRescue(state, recipientId, amount, tick);
}

// ─── End-of-Run Treasury Split ────────────────────────────────────────────────

export interface TreasurySplitResult {
  distributions: Record<string, number>;  // playerId → amount received
  remainder: number;
  updatedState: SharedTreasuryState;
}

/**
 * Split remaining treasury at run end by contribution share ratio.
 * Distributes remaining balance proportionally.
 */
export function splitAtRunEnd(
  state: SharedTreasuryState,
  playerIds: string[],
  tick: number,
): TreasurySplitResult {
  if (playerIds.length === 0 || state.balance === 0) {
    return { distributions: {}, remainder: state.balance, updatedState: state };
  }

  const distributions: Record<string, number> = {};
  let totalDistributed = 0;
  const entries: TreasuryLedgerEntry[] = [];

  for (const playerId of playerIds) {
    const ratio  = playerShareRatio(state, playerId);
    const amount = Math.floor(state.balance * ratio);
    distributions[playerId] = amount;
    totalDistributed += amount;

    entries.push({
      id:       `tl-${tick}-split-${playerId}`,
      playerId, type: 'SPLIT_DISTRIBUTION', amount, tick,
      note:     `End-of-run split (${Math.round(ratio * 100)}%)`,
    });
  }

  const remainder = state.balance - totalDistributed;

  return {
    distributions,
    remainder,
    updatedState: {
      ...state,
      balance: remainder,
      ledger:  [...state.ledger, ...entries].slice(-SYNDICATE_CONFIG.ledgerMaxEntries),
    },
  };
}

// ─── Defection Seizure (FIXED: 40% per bible) ─────────────────────────────────

/**
 * Compute what the defector takes — 40% of treasury at moment of defection (bible).
 */
export function computeDefectorWithdrawal(treasuryBalance: number): number {
  return Math.round(treasuryBalance * SYNDICATE_CONFIG.defectionTreasurySeizurePct);
}

export function seizeDefectorShare(
  state: SharedTreasuryState,
  defectorId: string,
  tick: number,
): { seizureAmount: number; updatedState: SharedTreasuryState } {
  const seizureAmount = computeDefectorWithdrawal(state.balance);

  const entry: TreasuryLedgerEntry = {
    id:       `tl-${tick}-seizure-${defectorId}`,
    playerId: defectorId, type: 'DEFECTION_SEIZURE', amount: seizureAmount, tick,
    note:     `Defector took 40% of treasury`,
  };

  const contributions = { ...state.contributions };
  delete contributions[defectorId];

  return {
    seizureAmount,
    updatedState: {
      ...state,
      balance:      Math.max(0, state.balance - seizureAmount),
      contributions,
      ledger:       [...state.ledger, entry].slice(-SYNDICATE_CONFIG.ledgerMaxEntries),
    },
  };
}

// ─── CORD Contribution ────────────────────────────────────────────────────────

/**
 * Convert treasury performance to a CORD weight component.
 * Higher balance at run end relative to starting → better score.
 * Returns 0–1 normalized score.
 */
export function treasuryToCORD(
  finalBalance: number,
  peakBalance: number,
  freedomThreshold: number,
): number {
  if (freedomThreshold === 0) return 0;
  const performancePct = finalBalance / Math.max(1, freedomThreshold);
  return parseFloat(Math.min(1.0, performancePct).toFixed(3));
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function playerShareRatio(state: SharedTreasuryState, playerId: string): number {
  const totalContrib = Object.values(state.contributions).reduce((s, v) => s + v, 0);
  if (totalContrib === 0) return 0;
  return parseFloat(((state.contributions[playerId] ?? 0) / totalContrib).toFixed(3));
}

export function getTopContributor(state: SharedTreasuryState): string | null {
  const entries = Object.entries(state.contributions);
  if (!entries.length) return null;
  return entries.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
}
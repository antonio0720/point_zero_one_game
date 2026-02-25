// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/sharedTreasuryEngine.ts
// Sprint 5 — Shared Treasury System
//
// Shared treasury = collective fund accessible by all alliance members.
// Deposits/withdrawals tracked per player.
// Fee applied on withdrawals (2%).
// Used by rescue windows and aid contracts.
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG } from './syndicateConfig';

export interface TreasuryLedgerEntry {
  id: string;
  playerId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'RESCUE_DISBURSEMENT' | 'AID_TRANSFER' | 'FEE' | 'DEFECTION_SEIZURE';
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
}

export const INITIAL_TREASURY_STATE: SharedTreasuryState = {
  balance: 0,
  contributions: {},
  withdrawals: {},
  ledger: [],
  totalFeesCollected: 0,
};

// ─── Deposit ──────────────────────────────────────────────────────────────────

export function depositToTreasury(
  state: SharedTreasuryState,
  playerId: string,
  amount: number,
  tick: number,
  note: string = 'Player deposit',
): SharedTreasuryState {
  const entry: TreasuryLedgerEntry = {
    id: `tl-${tick}-${playerId}-dep`,
    playerId, type: 'DEPOSIT', amount, tick, note,
  };

  return {
    ...state,
    balance: state.balance + amount,
    contributions: {
      ...state.contributions,
      [playerId]: (state.contributions[playerId] ?? 0) + amount,
    },
    ledger: [...state.ledger, entry].slice(-100),
  };
}

// ─── Withdrawal ───────────────────────────────────────────────────────────────

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

  const fee = Math.round(requestedAmount * SYNDICATE_CONFIG.treasuryFeeRate);
  const amountReceived = requestedAmount - fee;

  const entries: TreasuryLedgerEntry[] = [
    { id: `tl-${tick}-${playerId}-wdraw`, playerId, type: 'WITHDRAWAL', amount: requestedAmount, tick, note },
    { id: `tl-${tick}-${playerId}-fee`,   playerId, type: 'FEE',        amount: fee,             tick, note: 'Treasury fee' },
  ];

  const updatedState: SharedTreasuryState = {
    ...state,
    balance: state.balance - requestedAmount,
    withdrawals: { ...state.withdrawals, [playerId]: (state.withdrawals[playerId] ?? 0) + requestedAmount },
    totalFeesCollected: state.totalFeesCollected + fee,
    ledger: [...state.ledger, ...entries].slice(-100),
  };

  return { success: true, amountReceived, feePaid: fee, updatedState };
}

// ─── Rescue Disbursement ──────────────────────────────────────────────────────

export function disburseTreasuryRescue(
  state: SharedTreasuryState,
  recipientId: string,
  amount: number,
  tick: number,
): { disbursed: number; updatedState: SharedTreasuryState } {
  const disbursed = Math.min(amount, state.balance);
  const entry: TreasuryLedgerEntry = {
    id: `tl-${tick}-rescue-${recipientId}`,
    playerId: recipientId, type: 'RESCUE_DISBURSEMENT', amount: disbursed, tick,
    note: `Emergency rescue disbursement`,
  };

  return {
    disbursed,
    updatedState: {
      ...state,
      balance: state.balance - disbursed,
      ledger: [...state.ledger, entry].slice(-100),
    },
  };
}

// ─── Defection Seizure ────────────────────────────────────────────────────────

export function seizeDefectorShare(
  state: SharedTreasuryState,
  defectorId: string,
  seizureAmount: number,
  tick: number,
): SharedTreasuryState {
  // Remove defector's contributions from state, redistribute to treasury
  const entry: TreasuryLedgerEntry = {
    id: `tl-${tick}-seizure-${defectorId}`,
    playerId: defectorId, type: 'DEFECTION_SEIZURE', amount: seizureAmount, tick,
    note: `Asset seizure — defection detected`,
  };

  const contributions = { ...state.contributions };
  delete contributions[defectorId];

  return {
    ...state,
    balance: state.balance + seizureAmount,
    contributions,
    ledger: [...state.ledger, entry].slice(-100),
  };
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function playerShareRatio(state: SharedTreasuryState, playerId: string): number {
  const totalContrib = Object.values(state.contributions).reduce((s, v) => s + v, 0);
  if (totalContrib === 0) return 0;
  return parseFloat(((state.contributions[playerId] ?? 0) / totalContrib).toFixed(3));
}

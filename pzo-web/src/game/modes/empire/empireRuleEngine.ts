// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/empireRuleEngine.ts
// Sprint 3 — Empire (GO ALONE) Rule Orchestrator
//
// Single interface for all Empire-specific game logic.
// Called by empireCardAdapter and EmpireGameScreen.
// Owns: isolation tax accumulator, bleed state, pressure journal.
// ═══════════════════════════════════════════════════════════════════════════

import { EMPIRE_CONFIG } from './empireConfig';
import { computeIsolationTax, isolationTaxApplies } from './isolationTax';
import {
  evaluateBleedMode, hasExitedBleed, computeBleedAmplifierBonus,
  isComebackSurgeEligible, INITIAL_BLEED_STATE,
} from './bleedMode';
import type { BleedModeState } from './bleedMode';
import {
  tagDecision, appendJournalEntry, appendSnapshot, INITIAL_JOURNAL,
} from './pressureJournalEngine';
import type { PressureJournal, DecisionTag } from './pressureJournalEngine';
import { buildCaseFile } from './caseFileMapper';
import type { CaseFileSummary } from './caseFileMapper';

// ─── Empire Runtime State ─────────────────────────────────────────────────────

export interface EmpireRuntimeState {
  bleed: BleedModeState;
  journal: PressureJournal;
  totalIsolationTaxPaid: number;
  totalSpend: number;
  lastSnapshotTick: number;
}

export const INITIAL_EMPIRE_STATE: EmpireRuntimeState = {
  bleed: INITIAL_BLEED_STATE,
  journal: INITIAL_JOURNAL,
  totalIsolationTaxPaid: 0,
  totalSpend: 0,
  lastSnapshotTick: 0,
};

// ─── Card Play Resolution ─────────────────────────────────────────────────────

export interface EmpireCardInput {
  cardId: string;
  cardTitle: string;
  cardType: string;
  grossSpend: number;
  baseCashDelta: number;
  baseIncomeDelta: number;
  baseNetWorthDelta: number;
  taxModifier: number;
  bleedAmplifier: boolean;
  decisionLatencyMs: number;
  tick: number;
  cash: number;
  income: number;
  expenses: number;
  netWorth: number;
  shields: number;
  freezeTicks: number;
  regime: string;
}

export interface EmpireCardResult {
  cashDelta: number;
  incomeDelta: number;
  netWorthDelta: number;
  xpGained: number;
  decisionTag: DecisionTag;
  isolationTaxAmount: number;
  bleedBonusIncome: number;
  comebackSurgeActive: boolean;
  updatedState: EmpireRuntimeState;
}

export function processEmpireCardPlay(
  input: EmpireCardInput,
  state: EmpireRuntimeState,
): EmpireCardResult {
  const {
    cardId, cardTitle, cardType, grossSpend,
    baseCashDelta, baseIncomeDelta, baseNetWorthDelta,
    taxModifier, bleedAmplifier, decisionLatencyMs,
    tick, cash, income, expenses, netWorth, shields, freezeTicks, regime,
  } = input;

  // 1. Isolation tax
  let isolationTaxAmount = 0;
  let effectiveCashDelta = baseCashDelta;
  if (isolationTaxApplies(cardType) && grossSpend > 0) {
    const taxResult = computeIsolationTax(grossSpend, shields, taxModifier);
    isolationTaxAmount = taxResult.taxAmount;
    effectiveCashDelta = baseCashDelta - isolationTaxAmount;
  }

  // 2. Bleed mode amplifier
  const cashflow = income - expenses;
  const bleedBonusIncome = computeBleedAmplifierBonus(baseIncomeDelta, state.bleed.active && bleedAmplifier);
  const effectiveIncomeDelta = baseIncomeDelta + bleedBonusIncome;

  // 3. Decision tag
  const decisionTag = tagDecision({
    spend: grossSpend,
    cash,
    cashflow,
    freezeTicks,
    bleedState: state.bleed,
    decisionLatencyMs,
    tick,
  });

  // 4. Comeback surge XP
  const comebackSurgeActive = isComebackSurgeEligible(cashflow, state.bleed);
  const xpGained = 5 + (comebackSurgeActive ? EMPIRE_CONFIG.comebackSurgeXpBonus : 0);

  // 5. Update journal
  const updatedJournal = appendJournalEntry(state.journal, {
    tick, cardId, cardTitle, cardType, decisionTag, decisionLatencyMs,
    cashAtPlay: cash, incomeAtPlay: income, cashflowAtPlay: cashflow,
    netWorthAtPlay: netWorth, shields, bleedActive: state.bleed.active,
    bleedSeverity: state.bleed.severity,
    cashDelta: effectiveCashDelta, incomeDelta: effectiveIncomeDelta,
    netWorthDelta: baseNetWorthDelta, xpGained, regime,
  });

  const updatedState: EmpireRuntimeState = {
    ...state,
    journal: updatedJournal,
    totalIsolationTaxPaid: state.totalIsolationTaxPaid + isolationTaxAmount,
    totalSpend: state.totalSpend + grossSpend,
  };

  return {
    cashDelta: effectiveCashDelta,
    incomeDelta: effectiveIncomeDelta,
    netWorthDelta: baseNetWorthDelta,
    xpGained,
    decisionTag,
    isolationTaxAmount,
    bleedBonusIncome,
    comebackSurgeActive,
    updatedState,
  };
}

// ─── Tick Update ──────────────────────────────────────────────────────────────

export interface EmpireTickInput {
  tick: number;
  cash: number;
  income: number;
  expenses: number;
  netWorth: number;
  shields: number;
  regime: string;
}

export function processEmpireTick(
  input: EmpireTickInput,
  state: EmpireRuntimeState,
): EmpireRuntimeState {
  const { tick, cash, income, expenses, netWorth, shields, regime } = input;

  // Update bleed state
  const updatedBleed = evaluateBleedMode(cash, income, expenses, state.bleed, tick);

  // Snapshot at interval
  const shouldSnapshot = tick - state.lastSnapshotTick >= EMPIRE_CONFIG.pressureJournalSnapshotInterval;
  let updatedJournal = state.journal;
  if (shouldSnapshot) {
    updatedJournal = appendSnapshot(state.journal, {
      tick, cash, income, expenses, cashflow: income - expenses,
      netWorth, shields, bleedActive: updatedBleed.active,
      bleedSeverity: updatedBleed.severity, regime,
    });
  }

  return {
    ...state,
    bleed: updatedBleed,
    journal: updatedJournal,
    lastSnapshotTick: shouldSnapshot ? tick : state.lastSnapshotTick,
  };
}

// ─── Run Complete ─────────────────────────────────────────────────────────────

export function buildEmpireCaseFile(
  runId: string,
  seed: number,
  finalTick: number,
  outcome: string,
  finalCash: number,
  finalNetWorth: number,
  finalIncome: number,
  finalExpenses: number,
  equityHistory: number[],
  state: EmpireRuntimeState,
): CaseFileSummary {
  return buildCaseFile({
    runId, seed, finalTick, outcome,
    finalCash, finalNetWorth, finalIncome, finalExpenses,
    journal: state.journal,
    finalBleedState: state.bleed,
    totalIsolationTaxPaid: state.totalIsolationTaxPaid,
    totalSpend: state.totalSpend,
    equityHistory,
  });
}

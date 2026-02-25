// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/pressureJournalEngine.ts
// Sprint 3 — Pressure Journal System
//
// Every card play in Empire mode is tagged with decision metadata.
// The journal powers the post-run Case File autopsy and CORD scoring.
// Tags: FAST | LATE | OPTIMAL | RISKY
// ═══════════════════════════════════════════════════════════════════════════

import { EMPIRE_CONFIG } from './empireConfig';
import type { BleedModeState } from './bleedMode';

export type DecisionTag = 'FAST' | 'LATE' | 'OPTIMAL' | 'RISKY' | 'PANIC' | 'CALCULATED';

export interface PressureSnapshot {
  tick: number;
  cash: number;
  income: number;
  expenses: number;
  cashflow: number;
  netWorth: number;
  shields: number;
  bleedActive: boolean;
  bleedSeverity: string;
  regime: string;
}

export interface JournalEntry {
  id: string;
  tick: number;
  cardId: string;
  cardTitle: string;
  cardType: string;
  decisionTag: DecisionTag;
  decisionLatencyMs: number;
  cashAtPlay: number;
  incomeAtPlay: number;
  cashflowAtPlay: number;
  netWorthAtPlay: number;
  shields: number;
  bleedActive: boolean;
  bleedSeverity: string;
  cashDelta: number;
  incomeDelta: number;
  netWorthDelta: number;
  xpGained: number;
  regime: string;
  /** Computed quality score 0–1 for CORD */
  qualityScore: number;
}

export interface PressureJournal {
  entries: JournalEntry[];
  snapshots: PressureSnapshot[];
  totalEntries: number;
  optimalCount: number;
  riskyCount: number;
  panicCount: number;
  calculatedCount: number;
  lateCount: number;
  fastCount: number;
  /** Weighted decision quality score 0–1 */
  aggregateQuality: number;
}

export const INITIAL_JOURNAL: PressureJournal = {
  entries: [],
  snapshots: [],
  totalEntries: 0,
  optimalCount: 0,
  riskyCount: 0,
  panicCount: 0,
  calculatedCount: 0,
  lateCount: 0,
  fastCount: 0,
  aggregateQuality: 0,
};

// ─── Decision Tagging ─────────────────────────────────────────────────────────

export interface TagDecisionInput {
  spend: number;
  cash: number;
  cashflow: number;
  freezeTicks: number;
  bleedState: BleedModeState;
  decisionLatencyMs: number;
  tick: number;
}

export function tagDecision(input: TagDecisionInput): DecisionTag {
  const { spend, cash, cashflow, freezeTicks, bleedState, decisionLatencyMs } = input;

  // PANIC — spend > 80% of cash while in terminal bleed
  if (bleedState.severity === 'TERMINAL' && spend > cash * 0.8) return 'PANIC';

  // RISKY — spend > 70% of available cash
  if (spend > cash * 0.7) return 'RISKY';

  // LATE — played while frozen
  if (freezeTicks > 0) return 'LATE';

  // CALCULATED — positive cashflow, spend < 30% cash, fast decision
  if (cashflow > 0 && spend < cash * 0.3 && decisionLatencyMs < 8_000) return 'CALCULATED';

  // OPTIMAL — positive cashflow, controlled spend
  if (cashflow > 0 && spend < cash * 0.3) return 'OPTIMAL';

  // FAST — quick decision
  if (decisionLatencyMs < 3_000) return 'FAST';

  return 'FAST';
}

// ─── Journal Operations ───────────────────────────────────────────────────────

export function appendJournalEntry(
  journal: PressureJournal,
  entry: Omit<JournalEntry, 'id' | 'qualityScore'>,
): PressureJournal {
  const qualityScore = computeQualityScore(entry.decisionTag, entry.cashflowAtPlay, entry.shields);
  const fullEntry: JournalEntry = {
    ...entry,
    id: `je-${entry.tick}-${entry.cardId}`,
    qualityScore,
  };

  const entries = [...journal.entries, fullEntry].slice(-EMPIRE_CONFIG.caseFileMaxEntries);

  const counts = {
    optimalCount:     journal.optimalCount     + (entry.decisionTag === 'OPTIMAL'     ? 1 : 0),
    riskyCount:       journal.riskyCount       + (entry.decisionTag === 'RISKY'       ? 1 : 0),
    panicCount:       journal.panicCount       + (entry.decisionTag === 'PANIC'       ? 1 : 0),
    calculatedCount:  journal.calculatedCount  + (entry.decisionTag === 'CALCULATED'  ? 1 : 0),
    lateCount:        journal.lateCount        + (entry.decisionTag === 'LATE'        ? 1 : 0),
    fastCount:        journal.fastCount        + (entry.decisionTag === 'FAST'        ? 1 : 0),
  };

  const totalEntries = journal.totalEntries + 1;
  const aggregateQuality = entries.reduce((sum, e) => sum + e.qualityScore, 0) / entries.length;

  return { ...journal, ...counts, entries, totalEntries, aggregateQuality };
}

export function appendSnapshot(
  journal: PressureJournal,
  snapshot: PressureSnapshot,
): PressureJournal {
  const snapshots = [...journal.snapshots, snapshot].slice(-120);
  return { ...journal, snapshots };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function computeQualityScore(tag: DecisionTag, cashflow: number, shields: number): number {
  const tagScore: Record<DecisionTag, number> = {
    CALCULATED: 1.0,
    OPTIMAL:    0.85,
    FAST:       0.6,
    LATE:       0.4,
    RISKY:      0.25,
    PANIC:      0.0,
  };
  let score = tagScore[tag];
  if (cashflow > 0)   score = Math.min(1, score + 0.05);
  if (shields > 0)    score = Math.min(1, score + 0.03);
  return parseFloat(score.toFixed(3));
}

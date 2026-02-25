// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/caseFileMapper.ts
// Sprint 3 — Case File Autopsy Generator
//
// Converts a completed PressureJournal into a structured CaseFile payload
// for backend storage + ML scoring.
// CaseFile = post-run financial autopsy with decision grades, turning points,
// bleed arcs, and CORD contribution breakdown.
// ═══════════════════════════════════════════════════════════════════════════

import type { PressureJournal, JournalEntry, DecisionTag } from './pressureJournalEngine';
import type { BleedModeState } from './bleedMode';

// ─── CaseFile Shape ───────────────────────────────────────────────────────────

export interface CaseFileTurningPoint {
  tick: number;
  type: 'BLEED_ENTRY' | 'BLEED_EXIT' | 'COMEBACK_SURGE' | 'CRITICAL_PLAY' | 'PANIC_PLAY' | 'PEAK_NET_WORTH';
  description: string;
  cashAtMoment: number;
  netWorthAtMoment: number;
}

export interface CaseFileDecisionBreakdown {
  tag: DecisionTag;
  count: number;
  percentage: number;
  avgQuality: number;
}

export interface CaseFileSummary {
  runId: string;
  mode: 'EMPIRE';
  seed: number;
  finalTick: number;
  outcome: string;

  /** Core financials */
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  finalExpenses: number;
  peakNetWorth: number;
  lowestCash: number;

  /** Decision quality */
  totalDecisions: number;
  decisionBreakdown: CaseFileDecisionBreakdown[];
  aggregateDecisionQuality: number;  // 0–1

  /** Bleed arc */
  bleedArcs: BleedArc[];
  totalBleedTicks: number;
  bleedModeReactivations: number;
  peakBleedSeverity: string;

  /** Isolation tax burden */
  totalIsolationTaxPaid: number;
  taxBurdenRate: number;   // total tax / total spend

  /** Turning points (up to 10) */
  turningPoints: CaseFileTurningPoint[];

  /** CORD contributions from this mode */
  pressureResilienceScore: number;  // 0–1 from bleed survivability
  decisionQualityScore: number;     // 0–1 from journal aggregate
  consistencyScore: number;         // 0–1 from variance in quality scores
}

export interface BleedArc {
  startTick: number;
  endTick: number;
  durationTicks: number;
  peakSeverity: string;
  recoveredFrom: boolean;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export interface CaseFileInput {
  runId: string;
  seed: number;
  finalTick: number;
  outcome: string;
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  finalExpenses: number;
  journal: PressureJournal;
  finalBleedState: BleedModeState;
  totalIsolationTaxPaid: number;
  totalSpend: number;
  equityHistory: number[];
}

export function buildCaseFile(input: CaseFileInput): CaseFileSummary {
  const {
    runId, seed, finalTick, outcome,
    finalCash, finalNetWorth, finalIncome, finalExpenses,
    journal, finalBleedState, totalIsolationTaxPaid, totalSpend, equityHistory,
  } = input;

  const peakNetWorth = equityHistory.length ? Math.max(...equityHistory) : finalNetWorth;
  const lowestCash   = journal.snapshots.length
    ? Math.min(...journal.snapshots.map(s => s.cash))
    : finalCash;

  const decisionBreakdown = buildDecisionBreakdown(journal);
  const turningPoints     = buildTurningPoints(journal, equityHistory, finalBleedState);
  const bleedArcs         = buildBleedArcs(journal);

  const pressureResilienceScore = computePressureResilience(finalBleedState, journal);
  const consistencyScore = computeConsistencyScore(journal.entries);

  return {
    runId,
    mode: 'EMPIRE',
    seed,
    finalTick,
    outcome,
    finalCash,
    finalNetWorth,
    finalIncome,
    finalExpenses,
    peakNetWorth,
    lowestCash,
    totalDecisions: journal.totalEntries,
    decisionBreakdown,
    aggregateDecisionQuality: journal.aggregateQuality,
    bleedArcs,
    totalBleedTicks: finalBleedState.totalBleedTicks,
    bleedModeReactivations: finalBleedState.reactivationCount,
    peakBleedSeverity: finalBleedState.peakSeverity,
    totalIsolationTaxPaid,
    taxBurdenRate: totalSpend > 0 ? totalIsolationTaxPaid / totalSpend : 0,
    turningPoints: turningPoints.slice(0, 10),
    pressureResilienceScore,
    decisionQualityScore: journal.aggregateQuality,
    consistencyScore,
  };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function buildDecisionBreakdown(journal: PressureJournal): CaseFileDecisionBreakdown[] {
  const tags: DecisionTag[] = ['CALCULATED', 'OPTIMAL', 'FAST', 'LATE', 'RISKY', 'PANIC'];
  const countMap: Record<DecisionTag, number> = {
    CALCULATED: journal.calculatedCount,
    OPTIMAL: journal.optimalCount,
    FAST: journal.fastCount,
    LATE: journal.lateCount,
    RISKY: journal.riskyCount,
    PANIC: journal.panicCount,
  };

  return tags.map(tag => {
    const count = countMap[tag];
    const pct = journal.totalEntries > 0 ? count / journal.totalEntries : 0;
    const entriesForTag = journal.entries.filter(e => e.decisionTag === tag);
    const avgQuality = entriesForTag.length
      ? entriesForTag.reduce((s, e) => s + e.qualityScore, 0) / entriesForTag.length
      : 0;
    return { tag, count, percentage: parseFloat((pct * 100).toFixed(1)), avgQuality };
  }).filter(d => d.count > 0);
}

function buildTurningPoints(
  journal: PressureJournal,
  equityHistory: number[],
  bleedState: BleedModeState,
): CaseFileTurningPoint[] {
  const points: CaseFileTurningPoint[] = [];

  // Panic plays
  for (const entry of journal.entries) {
    if (entry.decisionTag === 'PANIC') {
      points.push({
        tick: entry.tick,
        type: 'PANIC_PLAY',
        description: `Panic play: ${entry.cardTitle} (spent ${Math.round(entry.cashAtPlay * 0.8)} of ${entry.cashAtPlay} cash)`,
        cashAtMoment: entry.cashAtPlay,
        netWorthAtMoment: entry.netWorthAtPlay,
      });
    }
    if (entry.decisionTag === 'CALCULATED' && entry.cashDelta < 0 && entry.incomeDelta > 500) {
      points.push({
        tick: entry.tick,
        type: 'COMEBACK_SURGE',
        description: `Comeback surge: ${entry.cardTitle} +$${entry.incomeDelta}/mo while bleeding`,
        cashAtMoment: entry.cashAtPlay,
        netWorthAtMoment: entry.netWorthAtPlay,
      });
    }
  }

  // Peak net worth
  if (equityHistory.length > 0) {
    const peak = Math.max(...equityHistory);
    const peakIdx = equityHistory.indexOf(peak);
    const snap = journal.snapshots[Math.min(peakIdx, journal.snapshots.length - 1)];
    if (snap) {
      points.push({
        tick: snap.tick,
        type: 'PEAK_NET_WORTH',
        description: `Peak net worth $${peak.toLocaleString()} reached`,
        cashAtMoment: snap.cash,
        netWorthAtMoment: peak,
      });
    }
  }

  return points.sort((a, b) => a.tick - b.tick);
}

function buildBleedArcs(journal: PressureJournal): BleedArc[] {
  const arcs: BleedArc[] = [];
  let inBleed = false;
  let startTick = 0;
  let peakSeverity = 'NONE';

  for (const snap of journal.snapshots) {
    if (snap.bleedActive && !inBleed) {
      inBleed = true;
      startTick = snap.tick;
      peakSeverity = snap.bleedSeverity;
    } else if (snap.bleedActive && inBleed) {
      const sev = snap.bleedSeverity;
      if (['TERMINAL', 'CRITICAL', 'WATCH'].indexOf(sev) > ['TERMINAL', 'CRITICAL', 'WATCH'].indexOf(peakSeverity)) {
        peakSeverity = sev;
      }
    } else if (!snap.bleedActive && inBleed) {
      arcs.push({ startTick, endTick: snap.tick, durationTicks: snap.tick - startTick, peakSeverity, recoveredFrom: true });
      inBleed = false;
    }
  }
  // Open arc at run end
  if (inBleed && journal.snapshots.length) {
    const lastSnap = journal.snapshots[journal.snapshots.length - 1];
    arcs.push({ startTick, endTick: lastSnap.tick, durationTicks: lastSnap.tick - startTick, peakSeverity, recoveredFrom: false });
  }
  return arcs;
}

function computePressureResilience(bleedState: BleedModeState, journal: PressureJournal): number {
  if (journal.totalEntries === 0) return 0.5;
  // Higher score = survived more pressure
  const bleedTickRatio = Math.min(bleedState.totalBleedTicks / Math.max(journal.totalEntries * 2, 1), 1);
  const panicRatio = journal.totalEntries > 0 ? journal.panicCount / journal.totalEntries : 0;
  const recoveryBonus = bleedState.reactivationCount > 0 ? 0.1 : 0;
  return parseFloat(Math.max(0, Math.min(1, 0.5 + bleedTickRatio * 0.3 - panicRatio * 0.5 + recoveryBonus)).toFixed(3));
}

function computeConsistencyScore(entries: JournalEntry[]): number {
  if (entries.length < 2) return 0.5;
  const scores = entries.map(e => e.qualityScore);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  // Low std dev = high consistency
  return parseFloat(Math.max(0, Math.min(1, 1 - stdDev * 2)).toFixed(3));
}

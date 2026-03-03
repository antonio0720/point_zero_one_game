// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/caseFileMapper.ts
// Sprint 5 — Case File Autopsy Generator
//
// Converts a completed PressureJournal into a structured CaseFile payload
// for backend storage + ML scoring.
// CaseFile = post-run financial autopsy with decision grades, turning points,
// bleed arcs, and CORD contribution breakdown.
//
// SPRINT 5 FIXES & ADDITIONS:
//   - BUG FIX: computePressureResilience() was adding bleedTickRatio
//     (more bleed = higher score — inverted logic). Now correctly subtracts.
//   - BUG FIX: buildTurningPoints() now generates BLEED_ENTRY / BLEED_EXIT
//     from bleed arcs (these types existed in the enum but were never produced).
//   - CaseFileSummary: added modeSpecificScore, cordFinalScore, botAttacksSurvived,
//     botAttacksPerWave, wavesSurvived, taxBurdenPerPhase.
//   - Math.max(...spread) replaced with reduce() for 20M-scale array safety.
//   - MODE_CORD_WEIGHTS.EMPIRE now consumed in buildCaseFile().
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import type { PressureJournal, JournalEntry, DecisionTag } from './pressureJournalEngine';
import type { BleedModeState } from './bleedMode';
import { MODE_CORD_WEIGHTS } from '../shared/modeHelpers';

// ─── CaseFile Shape ───────────────────────────────────────────────────────────

export interface CaseFileTurningPoint {
  tick:             number;
  type:             'BLEED_ENTRY' | 'BLEED_EXIT' | 'COMEBACK_SURGE' | 'CRITICAL_PLAY' | 'PANIC_PLAY' | 'PEAK_NET_WORTH';
  description:      string;
  cashAtMoment:     number;
  netWorthAtMoment: number;
}

export interface CaseFileDecisionBreakdown {
  tag:         DecisionTag;
  count:       number;
  percentage:  number;
  avgQuality:  number;
}

export interface CaseFileSummary {
  runId:   string;
  mode:    'EMPIRE';
  seed:    number;
  finalTick: number;
  outcome: string;

  /** Core financials */
  finalCash:    number;
  finalNetWorth: number;
  finalIncome:   number;
  finalExpenses: number;
  peakNetWorth:  number;
  lowestCash:    number;

  /** Decision quality */
  totalDecisions:            number;
  decisionBreakdown:         CaseFileDecisionBreakdown[];
  aggregateDecisionQuality:  number;  // 0–1

  /** Bleed arc */
  bleedArcs:               BleedArc[];
  totalBleedTicks:         number;
  bleedModeReactivations:  number;
  peakBleedSeverity:       string;

  /** Isolation tax burden */
  totalIsolationTaxPaid: number;
  taxBurdenRate:         number;
  taxBurdenPerPhase:     Record<string, number>;  // phase → total tax paid

  /** Turning points (up to 10) */
  turningPoints: CaseFileTurningPoint[];

  /** Bot battle stats */
  botAttacksSurvived:  number;
  botAttacksPerWave:   Record<number, number>;   // wave → attack count survived
  wavesSurvived:       number;

  /** CORD contributions from this mode */
  pressureResilienceScore: number;  // 0–1
  decisionQualityScore:    number;  // 0–1
  consistencyScore:        number;  // 0–1
  modeSpecificScore:       number;  // 0–1 isolation tax + bot survival
  cordFinalScore:          number;  // 0–1 weighted composite
}

export interface BleedArc {
  startTick:     number;
  endTick:       number;
  durationTicks: number;
  peakSeverity:  string;
  recoveredFrom: boolean;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CaseFileInput {
  runId:              string;
  seed:               number;
  finalTick:          number;
  outcome:            string;
  finalCash:          number;
  finalNetWorth:      number;
  finalIncome:        number;
  finalExpenses:      number;
  journal:            PressureJournal;
  finalBleedState:    BleedModeState;
  totalIsolationTaxPaid: number;
  totalSpend:         number;
  equityHistory:      number[];
  /** Optional: per-phase isolation tax breakdown */
  taxByPhase?:        Record<string, number>;
  /** Optional: bot attack records per wave */
  botAttacksPerWave?: Record<number, number>;
  /** Total bot attacks the player survived */
  botAttacksSurvived?: number;
  /** Highest wave number reached */
  highestWave?:       number;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildCaseFile(input: CaseFileInput): CaseFileSummary {
  const {
    runId, seed, finalTick, outcome,
    finalCash, finalNetWorth, finalIncome, finalExpenses,
    journal, finalBleedState, totalIsolationTaxPaid, totalSpend, equityHistory,
    taxByPhase = {},
    botAttacksPerWave = {},
    botAttacksSurvived = 0,
    highestWave = 1,
  } = input;

  // Sprint 5: use reduce() instead of Math.max(...spread) — safe for large arrays
  const peakNetWorth = equityHistory.length
    ? equityHistory.reduce((m, v) => v > m ? v : m, -Infinity)
    : finalNetWorth;
  const lowestCash = journal.snapshots.length
    ? journal.snapshots.reduce((m, s) => s.cash < m ? s.cash : m, Infinity)
    : finalCash;

  const decisionBreakdown = buildDecisionBreakdown(journal);
  const bleedArcs         = buildBleedArcs(journal);
  const turningPoints     = buildTurningPoints(journal, equityHistory, bleedArcs, finalBleedState);

  // Sprint 5 FIX: pressure resilience formula corrected (was additive, now subtractive)
  const pressureResilienceScore = computePressureResilience(finalBleedState, journal, finalTick);
  const consistencyScore        = computeConsistencyScore(journal.entries);
  const decisionQualityScore    = journal.aggregateQuality;

  // Sprint 5: mode-specific score = isolation tax discipline + bot survival
  const modeSpecificScore = computeModeSpecificScore(
    totalIsolationTaxPaid, totalSpend, botAttacksSurvived, highestWave,
  );

  // Sprint 5: CORD composite using MODE_CORD_WEIGHTS.EMPIRE
  const weights = MODE_CORD_WEIGHTS.EMPIRE;
  const cordFinalScore = parseFloat((
    decisionQualityScore   * weights.decisionQuality    +
    pressureResilienceScore * weights.pressureResilience +
    consistencyScore        * weights.consistency
    // modeSpecific weight = 0.00 for EMPIRE (included in pressureResilience)
  ).toFixed(3));

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
    totalDecisions:           journal.totalEntries,
    decisionBreakdown,
    aggregateDecisionQuality: journal.aggregateQuality,
    bleedArcs,
    totalBleedTicks:          finalBleedState.totalBleedTicks,
    bleedModeReactivations:   finalBleedState.reactivationCount,
    peakBleedSeverity:        finalBleedState.peakSeverity,
    totalIsolationTaxPaid,
    taxBurdenRate:  totalSpend > 0 ? totalIsolationTaxPaid / totalSpend : 0,
    taxBurdenPerPhase: taxByPhase,
    turningPoints:  turningPoints.slice(0, 10),
    botAttacksSurvived,
    botAttacksPerWave,
    wavesSurvived: highestWave,
    pressureResilienceScore,
    decisionQualityScore,
    consistencyScore,
    modeSpecificScore,
    cordFinalScore,
  };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function buildDecisionBreakdown(journal: PressureJournal): CaseFileDecisionBreakdown[] {
  const tags: DecisionTag[] = ['CALCULATED', 'OPTIMAL', 'FAST', 'LATE', 'RISKY', 'PANIC'];
  const countMap: Record<DecisionTag, number> = {
    CALCULATED: journal.calculatedCount,
    OPTIMAL:    journal.optimalCount,
    FAST:       journal.fastCount,
    LATE:       journal.lateCount,
    RISKY:      journal.riskyCount,
    PANIC:      journal.panicCount,
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
  journal:      PressureJournal,
  equityHistory: number[],
  bleedArcs:    BleedArc[],
  bleedState:   BleedModeState,
): CaseFileTurningPoint[] {
  const points: CaseFileTurningPoint[] = [];

  // SPRINT 5 FIX: Generate BLEED_ENTRY and BLEED_EXIT from bleed arcs
  // These types existed in the interface but were never produced before.
  for (const arc of bleedArcs) {
    const entrySnap = journal.snapshots.find(s => s.tick >= arc.startTick) ?? null;
    points.push({
      tick:             arc.startTick,
      type:             'BLEED_ENTRY',
      description:      `Bleed entered at tick ${arc.startTick} — severity: ${arc.peakSeverity}`,
      cashAtMoment:     entrySnap?.cash ?? 0,
      netWorthAtMoment: entrySnap?.netWorth ?? 0,
    });

    if (arc.recoveredFrom) {
      const exitSnap = journal.snapshots.find(s => s.tick >= arc.endTick) ?? null;
      points.push({
        tick:             arc.endTick,
        type:             'BLEED_EXIT',
        description:      `Recovered from bleed after ${arc.durationTicks} ticks`,
        cashAtMoment:     exitSnap?.cash ?? 0,
        netWorthAtMoment: exitSnap?.netWorth ?? 0,
      });
    }
  }

  // Panic plays
  for (const entry of journal.entries) {
    if (entry.decisionTag === 'PANIC') {
      points.push({
        tick:             entry.tick,
        type:             'PANIC_PLAY',
        description:      `Panic play: ${entry.cardTitle}`,
        cashAtMoment:     entry.cashAtPlay,
        netWorthAtMoment: entry.netWorthAtPlay,
      });
    }
    if (entry.decisionTag === 'CALCULATED' && entry.incomeDelta > 500 && entry.bleedActive) {
      points.push({
        tick:             entry.tick,
        type:             'COMEBACK_SURGE',
        description:      `Comeback surge: ${entry.cardTitle} +$${entry.incomeDelta}/mo`,
        cashAtMoment:     entry.cashAtPlay,
        netWorthAtMoment: entry.netWorthAtPlay,
      });
    }
  }

  // Peak net worth — Sprint 5: use reduce() not spread
  if (equityHistory.length > 0) {
    const peak    = equityHistory.reduce((m, v) => v > m ? v : m, -Infinity);
    const peakIdx = equityHistory.indexOf(peak);
    const snap    = journal.snapshots[Math.min(peakIdx, journal.snapshots.length - 1)];
    if (snap) {
      points.push({
        tick:             snap.tick,
        type:             'PEAK_NET_WORTH',
        description:      `Peak net worth $${peak.toLocaleString()} reached`,
        cashAtMoment:     snap.cash,
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

  const SEV_ORDER: Record<string, number> = { NONE: 0, WATCH: 1, CRITICAL: 2, TERMINAL: 3 };

  for (const snap of journal.snapshots) {
    if (snap.bleedActive && !inBleed) {
      inBleed      = true;
      startTick    = snap.tick;
      peakSeverity = snap.bleedSeverity;
    } else if (snap.bleedActive && inBleed) {
      if ((SEV_ORDER[snap.bleedSeverity] ?? 0) > (SEV_ORDER[peakSeverity] ?? 0)) {
        peakSeverity = snap.bleedSeverity;
      }
    } else if (!snap.bleedActive && inBleed) {
      arcs.push({
        startTick, endTick: snap.tick,
        durationTicks: snap.tick - startTick,
        peakSeverity,  recoveredFrom: true,
      });
      inBleed = false;
    }
  }

  // Open arc at run end
  if (inBleed && journal.snapshots.length > 0) {
    const lastSnap = journal.snapshots[journal.snapshots.length - 1];
    arcs.push({
      startTick, endTick: lastSnap.tick,
      durationTicks: lastSnap.tick - startTick,
      peakSeverity,  recoveredFrom: false,
    });
  }

  return arcs;
}

/**
 * SPRINT 5 FIX: Formula corrected — was adding bleedRatio (higher bleed = higher score).
 * Now correctly subtracts bleed burden from base score.
 *
 * Range: 0.0 (catastrophic) → 1.0 (elite pressure handling)
 */
function computePressureResilience(
  bleedState: BleedModeState,
  journal:    PressureJournal,
  totalTicks: number,
): number {
  if (journal.totalEntries === 0) return 0.5;

  const bleedRatio  = totalTicks > 0 ? Math.min(1, bleedState.totalBleedTicks / totalTicks) : 0;
  const panicRatio  = journal.totalEntries > 0 ? journal.panicCount / journal.totalEntries : 0;
  const terminalHit = bleedState.peakSeverity === 'TERMINAL' ? 0.15 : 0;
  const recoveryBonus = Math.min(0.10, bleedState.reactivationCount * 0.04);

  const raw = 0.80
    - bleedRatio  * 0.40   // FIX: was + 0.30 (inverted). Now correctly penalizes time in bleed.
    - panicRatio  * 0.25
    - terminalHit
    + recoveryBonus;

  return parseFloat(Math.max(0, Math.min(1, raw)).toFixed(3));
}

function computeConsistencyScore(entries: JournalEntry[]): number {
  if (entries.length < 2) return 0.5;
  const scores = entries.map(e => e.qualityScore);
  const mean   = scores.reduce((s, v) => s + v, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  return parseFloat(Math.max(0, Math.min(1, 1 - stdDev * 2)).toFixed(3));
}

/**
 * SPRINT 5: Mode-specific CORD contribution for Empire.
 * Isolation tax discipline: lower burden rate = higher score.
 * Bot survival: more attacks survived per wave = higher score.
 */
function computeModeSpecificScore(
  totalIsolationTaxPaid: number,
  totalSpend:            number,
  botAttacksSurvived:    number,
  wavesSurvived:         number,
): number {
  // Tax discipline: 0% burden → 1.0, >5% burden → 0.0
  const taxRate     = totalSpend > 0 ? totalIsolationTaxPaid / totalSpend : 0;
  const taxScore    = Math.max(0, 1 - taxRate / 0.05);

  // Bot survival: full 5 waves with attacks → 1.0
  const waveScore   = Math.min(1, wavesSurvived / 5);
  const attackScore = Math.min(1, botAttacksSurvived / 20); // 20+ attacks = max score

  const raw = taxScore * 0.40 + waveScore * 0.35 + attackScore * 0.25;
  return parseFloat(Math.max(0, Math.min(1, raw)).toFixed(3));
}
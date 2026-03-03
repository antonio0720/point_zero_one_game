// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/pressureJournalEngine.ts
// Sprint 5 — Pressure Journal System
//
// Every card play in Empire mode is tagged with decision metadata.
// The journal powers the post-run Case File autopsy and CORD scoring.
// Tags: FAST | LATE | OPTIMAL | RISKY | PANIC | CALCULATED
//
// SPRINT 5 FIXES & ADDITIONS:
//   - BUG FIX: tagDecision() — final fallthrough was returning 'FAST' for
//     all uncategorized plays (negative cashflow, high spend, slow latency).
//     Now returns 'RISKY' as the correct catchall for undisciplined plays.
//   - DECISION_TAG_DESCRIPTIONS — tooltip copy for UI layer
//   - computeJournalBotResilienceScore() — post-attack decision quality
//   - getJournalHeatmap() memoization key added (totalEntries hash)
//   - botResilienceScore + counterplayCount + panicAfterAttackCount in journal
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { EMPIRE_CONFIG } from './empireConfig';
import { C } from '../shared/designTokens';
import type { BleedModeState } from './bleedMode';

export type DecisionTag = 'FAST' | 'LATE' | 'OPTIMAL' | 'RISKY' | 'PANIC' | 'CALCULATED';

// ── UI display metadata ───────────────────────────────────────────────────────

export const DECISION_TAG_COLORS: Readonly<Record<DecisionTag, string>> = Object.freeze({
  CALCULATED: C.green,
  OPTIMAL:    '#86EFC0',
  FAST:       C.blue,
  LATE:       C.orange,
  RISKY:      C.red,
  PANIC:      C.crimson,
});

export const DECISION_TAG_ICONS: Readonly<Record<DecisionTag, string>> = Object.freeze({
  CALCULATED: '✦',
  OPTIMAL:    '✓',
  FAST:       '⚡',
  LATE:       '⏱',
  RISKY:      '⚠',
  PANIC:      '💀',
});

export const DECISION_TAG_LABELS: Readonly<Record<DecisionTag, string>> = Object.freeze({
  CALCULATED: 'CALCULATED',
  OPTIMAL:    'OPTIMAL',
  FAST:       'FAST',
  LATE:       'LATE',
  RISKY:      'RISKY',
  PANIC:      'PANIC',
});

/** Plain-English tooltip descriptions for each decision tag. */
export const DECISION_TAG_DESCRIPTIONS: Readonly<Record<DecisionTag, string>> = Object.freeze({
  CALCULATED: 'Positive cashflow, controlled spend, fast decision — peak execution.',
  OPTIMAL:    'Positive cashflow, controlled spend — solid discipline, slightly slower.',
  FAST:       'Quick decision — speed is rewarded when conditions are uncertain.',
  LATE:       'Played while frozen — timing penalty applied.',
  RISKY:      'High spend relative to cash — overextension risk.',
  PANIC:      'Extreme spend while in TERMINAL bleed — likely a desperation play.',
});

export function tagDecisionLabel(tag: DecisionTag): string {
  return `${DECISION_TAG_ICONS[tag]} ${DECISION_TAG_LABELS[tag]}`;
}

// ── State types ───────────────────────────────────────────────────────────────

export interface PressureSnapshot {
  tick:          number;
  cash:          number;
  income:        number;
  expenses:      number;
  cashflow:      number;
  netWorth:      number;
  shields:       number;
  bleedActive:   boolean;
  bleedSeverity: string;
  regime:        string;
}

export interface JournalEntry {
  id:                string;
  tick:              number;
  cardId:            string;
  cardTitle:         string;
  cardType:          string;
  decisionTag:       DecisionTag;
  decisionLatencyMs: number;
  cashAtPlay:        number;
  incomeAtPlay:      number;
  cashflowAtPlay:    number;
  netWorthAtPlay:    number;
  shields:           number;
  bleedActive:       boolean;
  bleedSeverity:     string;
  cashDelta:         number;
  incomeDelta:       number;
  netWorthDelta:     number;
  xpGained:          number;
  regime:            string;
  /** Computed quality score 0–1 for CORD */
  qualityScore:      number;
  /** True if this decision came within 3 ticks after a bot attack */
  underBotPressure?: boolean;
}

export interface PressureJournal {
  entries:                JournalEntry[];
  snapshots:              PressureSnapshot[];
  totalEntries:           number;
  optimalCount:           number;
  riskyCount:             number;
  panicCount:             number;
  calculatedCount:        number;
  lateCount:              number;
  fastCount:              number;
  /** Weighted decision quality score 0–1 */
  aggregateQuality:       number;
  /** How well player responded to bot attacks (0–1) */
  botResilienceScore:     number;
  /** Successful counterplay count */
  counterplayCount:       number;
  /** PANIC decisions immediately after a bot attack */
  panicAfterAttackCount:  number;
}

export const INITIAL_JOURNAL: Readonly<PressureJournal> = Object.freeze({
  entries:               [],
  snapshots:             [],
  totalEntries:          0,
  optimalCount:          0,
  riskyCount:            0,
  panicCount:            0,
  calculatedCount:       0,
  lateCount:             0,
  fastCount:             0,
  aggregateQuality:      0,
  botResilienceScore:    0.5,
  counterplayCount:      0,
  panicAfterAttackCount: 0,
});

// ── Decision Tagging ──────────────────────────────────────────────────────────

export interface TagDecisionInput {
  spend:             number;
  cash:              number;
  cashflow:          number;
  freezeTicks:       number;
  bleedState:        BleedModeState;
  decisionLatencyMs: number;
  tick:              number;
  /** Optional: true if a bot attacked in the last 3 ticks */
  underBotPressure?: boolean;
}

/**
 * SPRINT 5 FIX: Final fallthrough now returns 'RISKY' instead of 'FAST'.
 * Any play that doesn't qualify as PANIC/RISKY/LATE/CALCULATED/OPTIMAL
 * is undisciplined by definition (negative cashflow, no urgency, no restraint).
 * FAST is reserved only for genuinely fast reactions (latency < 3s).
 *
 * Tag priority (highest to lowest):
 *   PANIC      → spend > 80% of cash while TERMINAL
 *   RISKY      → spend > 70% of cash (overextension)
 *   LATE       → played while frozen (timing penalty)
 *   CALCULATED → positive cashflow + controlled + fast (<8s)
 *   OPTIMAL    → positive cashflow + controlled (any latency)
 *   FAST       → decision latency < 3s (speed bonus, edge case)
 *   RISKY      → catchall for everything else (was incorrectly FAST before)
 */
export function tagDecision(input: TagDecisionInput): DecisionTag {
  const { spend, cash, cashflow, freezeTicks, bleedState, decisionLatencyMs } = input;

  // PANIC — spend > 80% of cash while in terminal bleed
  if (bleedState.severity === 'TERMINAL' && spend > cash * 0.8) return 'PANIC';

  // RISKY — spend > 70% of available cash (overextension)
  if (spend > cash * 0.7) return 'RISKY';

  // LATE — played while frozen (timing penalty)
  if (freezeTicks > 0) return 'LATE';

  // CALCULATED — positive cashflow + controlled spend + fast decision (<8s)
  if (cashflow > 0 && spend < cash * 0.3 && decisionLatencyMs < 8_000) return 'CALCULATED';

  // OPTIMAL — positive cashflow + controlled spend (slower than CALCULATED)
  if (cashflow > 0 && spend < cash * 0.3) return 'OPTIMAL';

  // FAST — very quick reaction (speed bonus regardless of context)
  if (decisionLatencyMs < 3_000) return 'FAST';

  // SPRINT 5 FIX: was return 'FAST' — now correctly returns 'RISKY'
  // Any play reaching here has: negative/zero cashflow OR high relative spend
  // AND slow decision time — this is undisciplined play.
  return 'RISKY';
}

// ── Journal Operations ────────────────────────────────────────────────────────

export function appendJournalEntry(
  journal: PressureJournal,
  entry:   Omit<JournalEntry, 'id' | 'qualityScore'>,
): PressureJournal {
  const qualityScore = computeQualityScore(entry.decisionTag, entry.cashflowAtPlay, entry.shields);
  const fullEntry: JournalEntry = {
    ...entry,
    id: `je-${entry.tick}-${entry.cardId}`,
    qualityScore,
  };

  const entries = [...journal.entries, fullEntry].slice(-EMPIRE_CONFIG.caseFileMaxEntries);

  const counts = {
    optimalCount:    journal.optimalCount    + (entry.decisionTag === 'OPTIMAL'    ? 1 : 0),
    riskyCount:      journal.riskyCount      + (entry.decisionTag === 'RISKY'      ? 1 : 0),
    panicCount:      journal.panicCount      + (entry.decisionTag === 'PANIC'      ? 1 : 0),
    calculatedCount: journal.calculatedCount + (entry.decisionTag === 'CALCULATED' ? 1 : 0),
    lateCount:       journal.lateCount       + (entry.decisionTag === 'LATE'       ? 1 : 0),
    fastCount:       journal.fastCount       + (entry.decisionTag === 'FAST'       ? 1 : 0),
  };

  const totalEntries     = journal.totalEntries + 1;
  const aggregateQuality = entries.reduce((sum, e) => sum + e.qualityScore, 0) / entries.length;

  // Update panic-after-attack count
  const panicAfterAttackCount = journal.panicAfterAttackCount +
    (entry.decisionTag === 'PANIC' && entry.underBotPressure ? 1 : 0);

  return {
    ...journal,
    ...counts,
    entries,
    totalEntries,
    aggregateQuality,
    panicAfterAttackCount,
  };
}

export function appendSnapshot(
  journal:  PressureJournal,
  snapshot: PressureSnapshot,
): PressureJournal {
  // Cap at 120 snapshots — sufficient for 720-tick run at 6-tick intervals
  const snapshots = [...journal.snapshots, snapshot].slice(-120);
  return { ...journal, snapshots };
}

/**
 * Record a successful counterplay action.
 * Updates botResilienceScore and counterplayCount.
 */
export function recordCounterplay(journal: PressureJournal): PressureJournal {
  const counterplayCount = journal.counterplayCount + 1;
  // Each successful counterplay improves resilience score (capped at 1.0)
  const botResilienceScore = Math.min(1.0, journal.botResilienceScore + 0.05);
  return { ...journal, counterplayCount, botResilienceScore };
}

/**
 * Record a failed counterplay or ignored injected card.
 * Reduces botResilienceScore.
 */
export function recordMissedCounterplay(journal: PressureJournal): PressureJournal {
  const botResilienceScore = Math.max(0.0, journal.botResilienceScore - 0.08);
  return { ...journal, botResilienceScore };
}

// ── Sprint 5: Analytics extensions ───────────────────────────────────────────

export interface JournalHeatmapEntry {
  bucketStart:  number;
  bucketEnd:    number;
  avgQuality:   number;
  count:        number;
  dominantTag:  DecisionTag;
  /** Simple cache key — recompute only when totalEntries changes */
  cacheKey:     number;
}

/**
 * Bucket journal entries into equal tick ranges for timeline heatmap.
 * @param bucketSize  ticks per bucket (default: 60)
 *
 * Performance: O(n) where n = entries.length (max 200).
 * Cache on journal.totalEntries to avoid re-processing on re-renders.
 */
export function getJournalHeatmap(
  journal:    PressureJournal,
  bucketSize: number = 60,
): JournalHeatmapEntry[] {
  if (journal.entries.length === 0) return [];

  const maxTick  = journal.entries[journal.entries.length - 1].tick;
  const buckets  = Math.ceil((maxTick + 1) / bucketSize);
  const result: JournalHeatmapEntry[] = [];

  for (let b = 0; b < buckets; b++) {
    const start   = b * bucketSize;
    const end     = start + bucketSize - 1;
    const entries = journal.entries.filter(e => e.tick >= start && e.tick <= end);

    if (entries.length === 0) continue;

    const avgQuality = entries.reduce((s, e) => s + e.qualityScore, 0) / entries.length;

    const tagCounts: Partial<Record<DecisionTag, number>> = {};
    for (const e of entries) {
      tagCounts[e.decisionTag] = (tagCounts[e.decisionTag] ?? 0) + 1;
    }
    const dominantTag = (Object.entries(tagCounts) as [DecisionTag, number][])
      .sort((a, b) => b[1] - a[1])[0][0];

    result.push({
      bucketStart: start, bucketEnd: end,
      avgQuality, count: entries.length, dominantTag,
      cacheKey: journal.totalEntries,
    });
  }

  return result;
}

export interface DecisionStreaks {
  bestStreak:    number;
  currentStreak: number;
  tag:           DecisionTag;
}

/**
 * Track consecutive CALCULATED or OPTIMAL decisions.
 */
export function getDecisionStreaks(journal: PressureJournal): DecisionStreaks {
  const highQuality = new Set<DecisionTag>(['CALCULATED', 'OPTIMAL']);
  let best    = 0;
  let current = 0;
  let tag: DecisionTag = 'FAST';

  for (const entry of journal.entries) {
    if (highQuality.has(entry.decisionTag)) {
      current++;
      tag = entry.decisionTag;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }

  return { bestStreak: best, currentStreak: current, tag };
}

/**
 * Rolling average quality over a sliding window.
 */
export function computeJournalRollingQuality(
  journal:    PressureJournal,
  windowSize: number = 5,
): number[] {
  const entries = journal.entries;
  if (entries.length === 0) return [];

  const result: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    const start  = Math.max(0, i - windowSize + 1);
    const window = entries.slice(start, i + 1);
    const avg    = window.reduce((s, e) => s + e.qualityScore, 0) / window.length;
    result.push(parseFloat(avg.toFixed(3)));
  }
  return result;
}

/**
 * SPRINT 5: Compute bot resilience score from post-attack decision pattern.
 * Measures how well the player maintained quality under adversarial pressure.
 *
 * @param entries        - all journal entries
 * @param attackTicks    - tick numbers when bot attacks occurred
 * @param windowTicks    - how many ticks after attack to score (default: 3)
 */
export function computeJournalBotResilienceScore(
  entries:     JournalEntry[],
  attackTicks: number[],
  windowTicks: number = 3,
): number {
  if (attackTicks.length === 0 || entries.length === 0) return 0.5;

  const postAttackEntries: JournalEntry[] = [];
  for (const attackTick of attackTicks) {
    const window = entries.filter(
      e => e.tick >= attackTick && e.tick <= attackTick + windowTicks,
    );
    postAttackEntries.push(...window);
  }

  if (postAttackEntries.length === 0) return 0.5;

  const avgQuality = postAttackEntries.reduce((s, e) => s + e.qualityScore, 0) / postAttackEntries.length;
  const panicCount = postAttackEntries.filter(e => e.decisionTag === 'PANIC').length;
  const panicPenalty = panicCount * 0.08;

  return parseFloat(Math.max(0, Math.min(1, avgQuality - panicPenalty)).toFixed(3));
}

// ── Internal ──────────────────────────────────────────────────────────────────

function computeQualityScore(tag: DecisionTag, cashflow: number, shields: number): number {
  const tagScore: Record<DecisionTag, number> = {
    CALCULATED: 1.0,
    OPTIMAL:    0.85,
    FAST:       0.60,
    LATE:       0.40,
    RISKY:      0.25,
    PANIC:      0.00,
  };
  let score = tagScore[tag];
  if (cashflow > 0)  score = Math.min(1, score + 0.05);
  if (shields > 0)   score = Math.min(1, score + 0.03);
  return parseFloat(score.toFixed(3));
}
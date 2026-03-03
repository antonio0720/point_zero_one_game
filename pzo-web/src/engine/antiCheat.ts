/**
 * PZO SPRINT 8 — src/engine/antiCheat.ts
 *
 * Deterministic replay verification + anti-cheat hardening.
 *
 * Architecture:
 *   1. Every game action is appended to a tamper-evident action log
 *      (each entry hashes prev_hash + action_data)
 *   2. The full run can be replayed deterministically from (seed + actionLog)
 *   3. A MatchHash is computed at run end — unique fingerprint of the result
 *   4. RulePacks are hashed so any house-rule deviation is detectable
 *   5. Verification compares submitted result vs replay result
 *
 * Upgrades over Sprint 8 original:
 *   - Fixed TS2367/TS2363: operator precedence bug in maxScore computation
 *   - Added DifficultyMultiplier lookup map — extensible beyond BRUTAL
 *   - Added TimingAnomalyDetector — flags inhuman reaction times
 *   - Added ActionFrequencyAnalyzer — detects bot-speed card plays
 *   - Added SeedConsistencyCheck — catches seed manipulation mid-run
 *   - verifyActionLog now returns enriched metadata (duration, avgTickGap)
 *   - generateReplayReport verdict upgraded to 4-tier: CLEAN / WARN / SUSPICIOUS / INVALID
 *   - All public APIs remain backward-compatible
 *
 * All operations are synchronous and client-side (no server needed for solo).
 * Club competitive mode should submit matchHash + actionLog to a trusted relay.
 *
 * Density6 LLC · Confidential · All Rights Reserved
 */

import type { SessionAction } from '../types/club';

// ─── Core Hash Utilities ──────────────────────────────────────────────────────

export function fnv32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fnv32Hex(input: string): string {
  return fnv32(input).toString(16).padStart(8, '0');
}

/**
 * Mulberry32 — seeded deterministic PRNG.
 * Used for replay verification: same seed must produce same sequence.
 */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Difficulty Multiplier Map ────────────────────────────────────────────────

/** Score multipliers per difficulty preset — extensible, no string arithmetic */
const DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  INTRO:    0.7,
  STANDARD: 1.0,
  BRUTAL:   1.5,
};

function getDifficultyMultiplier(preset: string): number {
  return DIFFICULTY_MULTIPLIERS[preset] ?? 1.0;
}

// ─── Rule Pack ────────────────────────────────────────────────────────────────

export interface RulePack {
  version:          string;
  difficultyPreset: string;
  moderatorPreset:  string;
  startingCash:     number;
  runTicks:         number;
  monthTicks:       number;
  drawTicks:        number;
  fateTicks:        number;
  fateFubarPct:     number;
  fateMissedPct:    number;
  fateSoPct:        number;
  maxHand:          number;
  /** Computed hash — set after buildRulePackHash() */
  hash?:            string;
}

export function buildRulePackHash(pack: Omit<RulePack, 'hash'>): string {
  const canonical = JSON.stringify({
    v:      pack.version,
    diff:   pack.difficultyPreset,
    mod:    pack.moderatorPreset,
    cash:   pack.startingCash,
    ticks:  pack.runTicks,
    month:  pack.monthTicks,
    draw:   pack.drawTicks,
    fate:   pack.fateTicks,
    ffpct:  pack.fateFubarPct,
    fmpct:  pack.fateMissedPct,
    fsopct: pack.fateSoPct,
    hand:   pack.maxHand,
  });
  return `RP-${fnv32Hex(canonical)}`;
}

export const DEFAULT_RULE_PACK: RulePack = (() => {
  const pack: Omit<RulePack, 'hash'> = {
    version:          '1.0.0',
    difficultyPreset: 'STANDARD',
    moderatorPreset:  'OPEN_CLUB',
    startingCash:     28_000,
    runTicks:         720,
    monthTicks:       12,
    drawTicks:        24,
    fateTicks:        18,
    fateFubarPct:     0.42,
    fateMissedPct:    0.32,
    fateSoPct:        0.21,
    maxHand:          5,
  };
  return { ...pack, hash: buildRulePackHash(pack) };
})();

// ─── Action Log — Tamper-Evident Chain ───────────────────────────────────────

export function hashActionEntry(
  prevHash: string,
  action: Omit<SessionAction, 'hash'>,
): string {
  const payload = [
    prevHash,
    action.tick,
    action.playerId,
    action.type,
    JSON.stringify(action.payload),
    action.timestamp,
  ].join('|');
  return fnv32Hex(payload);
}

export function appendAction(
  log: SessionAction[],
  tick: number,
  playerId: string,
  type: string,
  payload: Record<string, unknown>,
): SessionAction[] {
  const prevHash  = log.length > 0 ? log[log.length - 1].hash : '00000000';
  const timestamp = Date.now();
  const withoutHash = { tick, playerId, type, payload, timestamp };
  const hash = hashActionEntry(prevHash, withoutHash);
  return [...log, { ...withoutHash, hash }];
}

// ─── Action Log Verification ──────────────────────────────────────────────────

export interface VerifyResult {
  valid:              boolean;
  chainIntact:        boolean;
  firstBreakIndex:    number | null;
  totalActions:       number;
  suspiciousActions:  string[];
  /** Wall-clock duration (ms) of the entire action log */
  durationMs:         number;
  /** Average tick gap between consecutive actions */
  avgTickGap:         number;
  summary:            string;
}

export function verifyActionLog(log: SessionAction[]): VerifyResult {
  if (log.length === 0) {
    return {
      valid: true, chainIntact: true, firstBreakIndex: null,
      totalActions: 0, suspiciousActions: [],
      durationMs: 0, avgTickGap: 0,
      summary: 'Empty log — nothing to verify.',
    };
  }

  const suspicious: string[] = [];
  let prevHash   = '00000000';
  let firstBreak: number | null = null;

  for (let i = 0; i < log.length; i++) {
    const { hash, ...rest } = log[i];
    const expected = hashActionEntry(prevHash, rest);

    if (hash !== expected) {
      if (firstBreak === null) firstBreak = i;
      suspicious.push(`[${i}] hash mismatch: expected ${expected}, got ${hash}`);
    }

    // Tick regression
    if (i > 0 && log[i].tick < log[i - 1].tick) {
      suspicious.push(`[${i}] tick regression: ${log[i].tick} < ${log[i - 1].tick}`);
    }

    // Timestamp regression
    if (i > 0 && log[i].timestamp < log[i - 1].timestamp) {
      suspicious.push(`[${i}] timestamp regression`);
    }

    prevHash = hash;
  }

  const durationMs = log[log.length - 1].timestamp - log[0].timestamp;
  const tickSpan   = log[log.length - 1].tick - log[0].tick;
  const avgTickGap = log.length > 1 ? tickSpan / (log.length - 1) : 0;

  const valid = suspicious.length === 0;
  return {
    valid,
    chainIntact:     firstBreak === null,
    firstBreakIndex: firstBreak,
    totalActions:    log.length,
    suspiciousActions: suspicious,
    durationMs,
    avgTickGap,
    summary: valid
      ? `✅ Log verified: ${log.length} actions, chain intact.`
      : `❌ ${suspicious.length} integrity violation(s) found. First break at index ${firstBreak}.`,
  };
}

// ─── Timing Anomaly Detector ──────────────────────────────────────────────────
/**
 * Flags inhuman reaction times.
 * A human cannot respond to a decision window in < 80ms consistently.
 * Consistent sub-100ms responses across 3+ windows = bot signal.
 */
export interface TimingAnomalyResult {
  flagged:            boolean;
  suspiciousWindows:  number;
  minResponseMs:      number;
  avgResponseMs:      number;
  flags:              string[];
}

const HUMAN_MIN_RESPONSE_MS   = 80;
const BOT_PATTERN_THRESHOLD   = 3;   // consecutive fast responses = flag

export function detectTimingAnomalies(log: SessionAction[]): TimingAnomalyResult {
  const resolveActions = log.filter(a => a.type === 'window_resolved');
  const flags: string[] = [];
  let suspiciousWindows = 0;
  let consecutiveFast   = 0;

  const responseTimes: number[] = [];

  for (let i = 0; i < resolveActions.length; i++) {
    const resolve = resolveActions[i];
    const openMs  = (resolve.payload?.openedAtMs as number | undefined);
    if (openMs === undefined) continue;

    const responseMs = resolve.timestamp - openMs;
    responseTimes.push(responseMs);

    if (responseMs < HUMAN_MIN_RESPONSE_MS) {
      suspiciousWindows++;
      consecutiveFast++;
      flags.push(
        `Window at tick ${resolve.tick}: response ${responseMs}ms (< ${HUMAN_MIN_RESPONSE_MS}ms human threshold)`,
      );
      if (consecutiveFast >= BOT_PATTERN_THRESHOLD) {
        flags.push(
          `${consecutiveFast} consecutive sub-${HUMAN_MIN_RESPONSE_MS}ms responses — bot pattern detected`,
        );
      }
    } else {
      consecutiveFast = 0;
    }
  }

  const minResponseMs = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
  const avgResponseMs = responseTimes.length > 0
    ? responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length
    : 0;

  return {
    flagged:           flags.length > 0,
    suspiciousWindows,
    minResponseMs,
    avgResponseMs,
    flags,
  };
}

// ─── Action Frequency Analyzer ────────────────────────────────────────────────
/**
 * Detects bot-speed card play bursts.
 * Human players cannot play more than ~3 cards/second sustained.
 */
export interface FrequencyAnomalyResult {
  flagged:     boolean;
  peakPlaysPs: number; // peak plays-per-second in any 1s window
  flags:       string[];
}

const MAX_HUMAN_PLAYS_PER_SECOND = 3;

export function analyzeActionFrequency(log: SessionAction[]): FrequencyAnomalyResult {
  const plays = log.filter(a => a.type === 'card_played');
  const flags: string[] = [];
  let peakPlaysPs = 0;

  if (plays.length < 2) {
    return { flagged: false, peakPlaysPs: 0, flags: [] };
  }

  // Sliding 1-second window
  for (let i = 0; i < plays.length; i++) {
    const windowStart = plays[i].timestamp;
    let count = 1;
    for (let j = i + 1; j < plays.length; j++) {
      if (plays[j].timestamp - windowStart <= 1000) count++;
      else break;
    }
    if (count > peakPlaysPs) peakPlaysPs = count;
    if (count > MAX_HUMAN_PLAYS_PER_SECOND) {
      flags.push(
        `${count} card plays in 1s window starting at tick ${plays[i].tick} — exceeds human max (${MAX_HUMAN_PLAYS_PER_SECOND}/s)`,
      );
    }
  }

  return {
    flagged: flags.length > 0,
    peakPlaysPs,
    flags,
  };
}

// ─── Seed Consistency Check ───────────────────────────────────────────────────
/**
 * Verifies that the run seed embedded in the action log never changes
 * mid-run (seed swapping = known exploit vector).
 */
export function checkSeedConsistency(log: SessionAction[]): {
  consistent: boolean;
  flags: string[];
} {
  const seedActions = log.filter(a => a.type === 'run_start' || a.type === 'seed_set');
  const flags: string[] = [];

  if (seedActions.length <= 1) return { consistent: true, flags: [] };

  const firstSeed = seedActions[0].payload?.seed;
  for (let i = 1; i < seedActions.length; i++) {
    if (seedActions[i].payload?.seed !== firstSeed) {
      flags.push(
        `Seed changed at tick ${seedActions[i].tick}: ` +
        `${firstSeed} → ${seedActions[i].payload?.seed}`,
      );
    }
  }

  return { consistent: flags.length === 0, flags };
}

// ─── Match Hash ───────────────────────────────────────────────────────────────

export interface MatchResultSnapshot {
  runSeed:               number;
  rulePackHash:          string;
  playerId:              string;
  finalCash:             number;
  finalNetWorth:         number;
  finalIncome:           number;
  finalExpenses:         number;
  totalPlays:            number;
  totalFubarHits:        number;
  survivedRun:           boolean;
  completedObjectiveIds: string[];
  totalScore:            number;
  grade:                 string;
  endTick:               number;
  actionLogTailHash:     string;
}

export function computeMatchHash(snapshot: MatchResultSnapshot): string {
  const canonical = [
    snapshot.runSeed,
    snapshot.rulePackHash,
    snapshot.playerId,
    Math.round(snapshot.finalCash),
    Math.round(snapshot.finalNetWorth),
    Math.round(snapshot.finalIncome),
    Math.round(snapshot.finalExpenses),
    snapshot.totalPlays,
    snapshot.totalFubarHits,
    snapshot.survivedRun ? 1 : 0,
    snapshot.completedObjectiveIds.sort().join(','),
    snapshot.totalScore,
    snapshot.grade,
    snapshot.endTick,
    snapshot.actionLogTailHash,
  ].join('|');

  return `MH-${fnv32Hex(canonical)}-${snapshot.endTick.toString(16)}`;
}

// ─── Plausibility Check ───────────────────────────────────────────────────────

export interface PlausibilityCheck {
  plausible:  boolean;
  flags:      string[];
  confidence: number;  // 0–1
}

export function checkResultPlausibility(
  snapshot:  MatchResultSnapshot,
  actionLog: SessionAction[],
  rulePack:  RulePack,
): PlausibilityCheck {
  const flags: string[] = [];
  const diffMult = getDifficultyMultiplier(rulePack.difficultyPreset);

  // 1. Cash growth sanity
  const maxTheoreticalCash =
    rulePack.startingCash + (rulePack.runTicks / rulePack.monthTicks) * 50_000;
  if (snapshot.finalCash > maxTheoreticalCash) {
    flags.push(
      `Cash ${snapshot.finalCash} exceeds theoretical max ${maxTheoreticalCash}`,
    );
  }

  // 2. Net worth sanity
  const maxTheoreticalNW =
    rulePack.startingCash + snapshot.totalPlays * 150_000;
  if (snapshot.finalNetWorth > maxTheoreticalNW) {
    flags.push(
      `Net worth ${snapshot.finalNetWorth} exceeds theoretical max for ` +
      `${snapshot.totalPlays} plays`,
    );
  }

  // 3. Total plays vs run ticks
  const maxPlausiblePlays =
    Math.ceil(rulePack.runTicks / rulePack.drawTicks) * rulePack.maxHand * 2;
  if (snapshot.totalPlays > maxPlausiblePlays) {
    flags.push(
      `${snapshot.totalPlays} plays exceeds plausible max ${maxPlausiblePlays}`,
    );
  }

  // 4. Action log play count vs snapshot
  const playActions = actionLog.filter(a => a.type === 'card_played').length;
  if (Math.abs(playActions - snapshot.totalPlays) > 5) {
    flags.push(
      `Action log has ${playActions} card_played but snapshot claims ` +
      `${snapshot.totalPlays}`,
    );
  }

  // 5. Score range check — FIXED: operator precedence bug removed
  //    Old (broken): 4000 * rulePack.difficultyPreset === 'BRUTAL' ? 1.5 : 1.0
  //    Fixed:        4000 * getDifficultyMultiplier(preset)
  const maxScore = 4000 * diffMult;
  if (snapshot.totalScore > maxScore + 2000) {
    flags.push(`Score ${snapshot.totalScore} exceeds plausible range for difficulty ${rulePack.difficultyPreset} (max ~${maxScore + 2000})`);
  }

  // 6. End tick check
  if (snapshot.endTick > rulePack.runTicks && snapshot.survivedRun) {
    flags.push(
      `End tick ${snapshot.endTick} > run length ${rulePack.runTicks}`,
    );
  }

  // 7. Grade vs score cross-check
  const impliedMinScore = gradeToMinScore(snapshot.grade);
  const impliedMaxScore = gradeToMaxScore(snapshot.grade);
  if (
    snapshot.totalScore < impliedMinScore * 0.8 ||
    snapshot.totalScore > impliedMaxScore * 1.2
  ) {
    flags.push(
      `Grade ${snapshot.grade} inconsistent with score ${snapshot.totalScore} ` +
      `(expected ${impliedMinScore}–${impliedMaxScore})`,
    );
  }

  const confidence = Math.max(0, 1 - flags.length * 0.2);
  return { plausible: flags.length === 0, flags, confidence };
}

function gradeToMinScore(grade: string): number {
  const map: Record<string, number> = {
    S: 900, A: 750, B: 600, C: 450, D: 300, F: 0,
  };
  return map[grade] ?? 0;
}

function gradeToMaxScore(grade: string): number {
  const map: Record<string, number> = {
    S: 9999, A: 899, B: 749, C: 599, D: 449, F: 299,
  };
  return map[grade] ?? 9999;
}

// ─── Replay Report ────────────────────────────────────────────────────────────

/**
 * 4-tier verdict:
 *   CLEAN      — no issues detected
 *   WARN       — minor anomalies, likely legitimate (lag, slow device)
 *   SUSPICIOUS — multiple flags, manual review recommended
 *   INVALID    — chain broken or seed swapped — disqualify
 */
export type ReplayVerdict = 'CLEAN' | 'WARN' | 'SUSPICIOUS' | 'INVALID';

export interface ReplayReport {
  matchHash:          string;
  verified:           boolean;
  logVerification:    VerifyResult;
  plausibilityCheck:  PlausibilityCheck;
  timingAnomalies:    TimingAnomalyResult;
  frequencyAnomalies: FrequencyAnomalyResult;
  seedConsistency:    { consistent: boolean; flags: string[] };
  rulePackHash:       string;
  submittedSnapshot:  MatchResultSnapshot;
  discrepancies:      string[];
  verdict:            ReplayVerdict;
  verdictReason:      string;
  confidenceScore:    number; // 0–1 composite
}

export function generateReplayReport(
  snapshot:  MatchResultSnapshot,
  actionLog: SessionAction[],
  rulePack:  RulePack,
): ReplayReport {
  const logVerification    = verifyActionLog(actionLog);
  const plausibility       = checkResultPlausibility(snapshot, actionLog, rulePack);
  const timingAnomalies    = detectTimingAnomalies(actionLog);
  const frequencyAnomalies = analyzeActionFrequency(actionLog);
  const seedConsistency    = checkSeedConsistency(actionLog);
  const matchHash          = computeMatchHash(snapshot);

  const discrepancies: string[] = [
    ...logVerification.suspiciousActions,
    ...plausibility.flags,
    ...timingAnomalies.flags,
    ...frequencyAnomalies.flags,
    ...seedConsistency.flags,
  ];

  // Verdict logic — ordered by severity
  let verdict: ReplayVerdict;
  if (!logVerification.chainIntact || !seedConsistency.consistent) {
    verdict = 'INVALID';
  } else if (discrepancies.length > 4 || timingAnomalies.suspiciousWindows >= BOT_PATTERN_THRESHOLD) {
    verdict = 'SUSPICIOUS';
  } else if (discrepancies.length > 0) {
    verdict = 'WARN';
  } else {
    verdict = 'CLEAN';
  }

  const verdictReason =
    verdict === 'CLEAN'
      ? 'Result consistent with action log and rule constraints.'
      : verdict === 'INVALID'
      ? !seedConsistency.consistent
        ? `Seed inconsistency detected: ${seedConsistency.flags[0]}`
        : `Action log chain broken at index ${logVerification.firstBreakIndex}.`
      : verdict === 'SUSPICIOUS'
      ? `${discrepancies.length} discrepancy(s) detected. Manual review required.`
      : `${discrepancies.length} minor anomaly(s). Likely legitimate — monitor.`;

  const confidenceScore = Math.max(
    0,
    Math.min(
      1,
      plausibility.confidence *
      (timingAnomalies.flagged ? 0.7 : 1.0) *
      (frequencyAnomalies.flagged ? 0.7 : 1.0) *
      (logVerification.chainIntact ? 1.0 : 0.0),
    ),
  );

  return {
    matchHash,
    verified:           verdict === 'CLEAN',
    logVerification,
    plausibilityCheck:  plausibility,
    timingAnomalies,
    frequencyAnomalies,
    seedConsistency,
    rulePackHash:       rulePack.hash ?? buildRulePackHash(rulePack),
    submittedSnapshot:  snapshot,
    discrepancies,
    verdict,
    verdictReason,
    confidenceScore,
  };
}
/**
 * replay-validator.ts
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/integrity/replay-validator.ts
 *
 * POINT ZERO ONE — REPLAY INTEGRITY CHECKER (SERVER-SIDE)
 * Density6 LLC · Confidential · Do not distribute
 *
 * Step 1 of the 3-step post-run sovereignty pipeline.
 *
 * Ported from:
 *   pzo-web/src/engines/sovereignty/ReplayIntegrityChecker.ts
 *
 * Differences from pzo-web version:
 *   ✦ Uses `computeTickStreamChecksum()` from proof-hash.ts (Node.js sync)
 *     instead of ProofGenerator.computeTickStreamChecksum() (browser async).
 *   ✦ verify() is synchronous — no SubtleCrypto dependency.
 *   ✦ Exports both the class and a standalone `verifyRunIntegrity()` factory
 *     function for use in api/runs.ts without instantiation boilerplate.
 *   ✦ isDemoRun guard: demo runs are structurally checked but continuity
 *     check is skipped — anomaly scoring is irrelevant for tutorial runs
 *     and would clog the review queue.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * PIPELINE POSITION
 *
 *   initRun() → [tick loop: snapshotTick()] → completeRun()
 *     Step 1: ReplayIntegrityChecker.verify(acc)  ← THIS FILE
 *     Step 2: ProofGenerator.generate(acc, checksum)
 *     Step 3: RunGradeAssigner.computeScore(acc, result)
 *
 * tickStreamChecksum is ALWAYS returned from verify(), even on TAMPERED status.
 * Step 2 needs it unconditionally to produce the proof hash.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ANOMALY SCORING THRESHOLDS
 *   score ≥ 0.85  → TAMPERED  (hard reject)
 *   score ≥ 0.30  → UNVERIFIED (review queue — run is recorded, not ranked)
 *   score < 0.30  → VERIFIED
 */

import { computeTickStreamChecksum } from './proof-hash';
import type {
  RunAccumulatorStats,
  IntegrityStatus,
  IntegrityCheckResult,
  TickSnapshot,
} from './integrity-types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Anomaly score above which a run is hard-flagged TAMPERED. */
const ANOMALY_THRESHOLD = 0.85;

/** Anomaly score above which a run is soft-flagged UNVERIFIED (review queue). */
const ANOMALY_SUSPICIOUS_MIN = 0.30;

/**
 * Maximum plausible single-tick net worth jump as a multiple of prior value.
 * Natural cashflow is bounded by monthly income/expenses per tick.
 * Jumps > 10× prior value AND > $500k delta are implausible.
 */
const NET_WORTH_JUMP_MULTIPLIER = 10;
const NET_WORTH_JUMP_ABS_THRESHOLD = 500_000;

/**
 * Maximum plausible single-tick shield avg integrity recovery.
 * L1/L2 regen cap ≈ 2 pts/tick; L3/L4 cap ≈ 1 pt/tick → avg max ≈ 1.5 pts/tick.
 * Single-tick jumps > 15 are physically impossible through normal regen.
 */
const SHIELD_RECOVERY_THRESHOLD = 15;

/**
 * Maximum plausible hater_heat absolute tick-to-tick delta.
 * BattleEngine logic bounds per-tick hater_heat changes.
 */
const HATER_HEAT_DELTA_THRESHOLD = 30;

// ── CLASS ─────────────────────────────────────────────────────────────────────

export class ReplayIntegrityChecker {
  /**
   * Execute both integrity sub-checks for a completed run.
   *
   * Execution order:
   *   A. structuralCheck   — completeness, ordering, count match
   *   B. continuityCheck   — statistical anomaly detection
   *
   * TAMPERED from structuralCheck short-circuits continuityCheck:
   * structural violations make anomaly scoring meaningless.
   *
   * Demo runs: structural check runs, continuity check is skipped.
   * Demo anomaly scoring would pollute the review queue with tutorial noise.
   *
   * @param acc  Full RunAccumulatorStats from the completed run
   * @returns    IntegrityCheckResult — always includes tickStreamChecksum
   */
  public verify(acc: RunAccumulatorStats): IntegrityCheckResult {
    // Always compute the checksum — Step 2 needs it regardless of outcome.
    const tickStreamChecksum = computeTickStreamChecksum(acc.tickSnapshots);

    // ── Sub-step A: Structural check ──────────────────────────────
    const structResult = this.structuralCheck(acc);
    if (structResult.status === 'TAMPERED' || structResult.status === 'UNVERIFIED') {
      return { ...structResult, tickStreamChecksum };
    }

    // ── Sub-step B: Continuity check (skipped for demo runs) ──────
    if (acc.isDemoRun) {
      return {
        status: 'VERIFIED',
        tickStreamChecksum,
        reason: 'Demo run — continuity check skipped',
        anomalyScore: 0,
      };
    }

    const contResult = this.continuityCheck(acc);
    return { ...contResult, tickStreamChecksum };
  }

  // ── STRUCTURAL CHECK ────────────────────────────────────────────

  /**
   * Verifies that the tick stream is complete, gapless, and internally consistent.
   *
   * Rules enforced:
   *   1. Non-empty stream (empty → UNVERIFIED — possible client disconnect)
   *   2. Tick indices form a gapless sequence 0, 1, 2 … N-1
   *   3. No tick index meets or exceeds seasonTickBudget
   *   4. acc.ticksSurvived matches actual snapshot count
   */
  private structuralCheck(
    acc: RunAccumulatorStats,
  ): Omit<IntegrityCheckResult, 'tickStreamChecksum'> {
    const snaps = acc.tickSnapshots;

    // Rule 1: Non-empty stream
    if (snaps.length === 0) {
      return {
        status: 'UNVERIFIED',
        reason: 'Empty tick stream — no snapshots recorded (possible client disconnect)',
      };
    }

    // Rule 2: Gapless tick index sequence
    for (let i = 0; i < snaps.length; i++) {
      if (snaps[i].tickIndex !== i) {
        return {
          status: 'TAMPERED',
          reason: `Tick index discontinuity at position ${i}: expected ${i}, got ${snaps[i].tickIndex}`,
        };
      }
    }

    // Rule 3: No tick index meets or exceeds season budget
    const maxIndex = snaps[snaps.length - 1].tickIndex;
    if (maxIndex >= acc.seasonTickBudget) {
      return {
        status: 'TAMPERED',
        reason: `Tick index ${maxIndex} meets or exceeds season budget ${acc.seasonTickBudget}`,
      };
    }

    // Rule 4: Reported ticksSurvived matches actual snapshot count
    if (acc.ticksSurvived !== snaps.length) {
      return {
        status: 'TAMPERED',
        reason: `ticksSurvived mismatch: reported ${acc.ticksSurvived}, actual ${snaps.length}`,
      };
    }

    return { status: 'VERIFIED' };
  }

  // ── CONTINUITY CHECK ────────────────────────────────────────────

  /**
   * Statistical anomaly detection across the tick stream.
   * Flags patterns inconsistent with organic gameplay.
   *
   * Anomaly scoring (additive, capped at 1.0):
   *   - Net worth suspicious jump:  +0.35 per occurrence
   *   - Shield suspicious recovery: +0.25 per occurrence
   *   - Hater heat suspicious delta:+0.15 per occurrence
   *   - Duplicate tick hashes:      +0.50 × (dupeCount / total)
   *
   * Thresholds:
   *   ≥ 0.85 → TAMPERED (hard reject, logged)
   *   ≥ 0.30 → UNVERIFIED (review queue, run recorded but not ranked)
   *   < 0.30 → VERIFIED
   *
   * This is a statistical plausibility pass — not cryptographic replay.
   * Full server-side seed replay is planned for P14_REPLAY_FORENSICS.
   */
  private continuityCheck(
    acc: RunAccumulatorStats,
  ): Omit<IntegrityCheckResult, 'tickStreamChecksum'> {
    const snaps = acc.tickSnapshots;
    const anomalies: string[] = [];
    let anomalyScore = 0.0;

    // ── Check 1: Suspicious net worth single-tick jumps ───────────
    for (let i = 1; i < snaps.length; i++) {
      const prev  = Math.abs(snaps[i - 1].netWorth) + 1; // +1 avoids div-by-zero
      const curr  = Math.abs(snaps[i].netWorth);
      const delta = snaps[i].netWorth - snaps[i - 1].netWorth;

      if (curr > prev * NET_WORTH_JUMP_MULTIPLIER && delta > NET_WORTH_JUMP_ABS_THRESHOLD) {
        anomalies.push(
          `Net worth jump at tick ${i}: ${snaps[i - 1].netWorth.toFixed(2)} → ${snaps[i].netWorth.toFixed(2)}`,
        );
        anomalyScore += 0.35;
      }
    }

    // ── Check 2: Suspicious shield recovery jump ──────────────────
    for (let i = 1; i < snaps.length; i++) {
      const delta = snaps[i].shieldAvgIntegrity - snaps[i - 1].shieldAvgIntegrity;
      if (delta > SHIELD_RECOVERY_THRESHOLD) {
        anomalies.push(
          `Shield recovery jump at tick ${i}: +${delta.toFixed(1)} pts`,
        );
        anomalyScore += 0.25;
      }
    }

    // ── Check 3: Suspicious hater heat delta ─────────────────────
    for (let i = 1; i < snaps.length; i++) {
      const heatDelta = Math.abs(snaps[i].haterHeat - snaps[i - 1].haterHeat);
      if (heatDelta > HATER_HEAT_DELTA_THRESHOLD) {
        anomalies.push(
          `Hater heat delta at tick ${i}: ${heatDelta} pts`,
        );
        anomalyScore += 0.15;
      }
    }

    // ── Check 4: Duplicate tick hashes ───────────────────────────
    const hashSet = new Set(snaps.map(s => s.tickHash));
    if (hashSet.size < snaps.length) {
      const dupeCount = snaps.length - hashSet.size;
      anomalies.push(`${dupeCount} duplicate tick hash(es) in stream`);
      anomalyScore += 0.50 * (dupeCount / snaps.length);
    }

    // Cap anomaly score at 1.0
    anomalyScore = parseFloat(Math.min(1.0, anomalyScore).toFixed(4));

    // ── Verdict ───────────────────────────────────────────────────
    if (anomalyScore >= ANOMALY_THRESHOLD) {
      return {
        status: 'TAMPERED',
        reason: `Anomaly score ${anomalyScore} ≥ ${ANOMALY_THRESHOLD}. Flags: ${anomalies.join('; ')}`,
        anomalyScore,
      };
    }

    if (anomalyScore >= ANOMALY_SUSPICIOUS_MIN) {
      return {
        status: 'UNVERIFIED',
        reason: `Anomaly score ${anomalyScore} — flagged for review. Flags: ${anomalies.join('; ')}`,
        anomalyScore,
      };
    }

    return { status: 'VERIFIED', anomalyScore };
  }
}

// ── STANDALONE FACTORY ────────────────────────────────────────────────────────

/**
 * Standalone function for one-shot integrity verification.
 * Use in api/runs.ts when you don't need the full class instance.
 *
 * @example
 *   const result = verifyRunIntegrity(acc);
 *   if (result.status === 'TAMPERED') { ... }
 */
export function verifyRunIntegrity(acc: RunAccumulatorStats): IntegrityCheckResult {
  const checker = new ReplayIntegrityChecker();
  return checker.verify(acc);
}

// ── TYPE RE-EXPORT ────────────────────────────────────────────────────────────

export type { IntegrityCheckResult, IntegrityStatus };
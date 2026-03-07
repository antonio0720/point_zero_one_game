//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/ReplayIntegrityChecker.ts

// ═══════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SOVEREIGNTY ENGINE — REPLAY INTEGRITY CHECKER
// Density6 LLC · Confidential · Do not distribute
//
// Responsibilities:
//   · Step 1 of the 3-step sovereignty pipeline: INTEGRITY CHECK
//   · Structural check — continuous tick index sequence, budget ceiling,
//     ticksSurvived count match
//   · Continuity/anomaly check — statistical plausibility of net worth
//     jumps, shield recovery, hater heat deltas, duplicate hashes
//   · Always returns tickStreamChecksum regardless of TAMPERED status
//     (checksum is needed for proof_hash generation in Step 2)
//
// Import rules: may import from types.ts and ProofGenerator.ts ONLY.
// ═══════════════════════════════════════════════════════════════════

import type { RunAccumulatorStats, IntegrityStatus } from './types';
import { ProofGenerator } from './ProofGenerator';

export interface IntegrityCheckResult {
  status:             IntegrityStatus;
  tickStreamChecksum: string;          // Always populated — never omitted
  reason?:            string;          // Human-readable failure description
  anomalyScore?:      number;          // 0.0–1.0, higher = more suspicious
}

export class ReplayIntegrityChecker {
  private proofGen: ProofGenerator;

  /**
   * Anomaly score threshold above which a run is flagged TAMPERED.
   * 0.85 requires strong statistical evidence before a hard flag.
   * Scores between 0.30 and 0.85 produce UNVERIFIED (manual review queue).
   */
  private static readonly ANOMALY_THRESHOLD = 0.85;

  /**
   * Moderate anomaly lower bound — below this, the run is VERIFIED.
   */
  private static readonly ANOMALY_SUSPICIOUS_MIN = 0.30;

  constructor() {
    this.proofGen = new ProofGenerator();
  }

  // ── PUBLIC: VERIFY ───────────────────────────────────────────────
  /**
   * Execute both sub-steps of the integrity check.
   *
   * Execution order:
   *   A. structuralCheck  — verifies completeness and ordering
   *   B. continuityCheck  — statistical anomaly detection
   *
   * tickStreamChecksum is ALWAYS computed and returned, even when TAMPERED.
   * Step 2 (ProofGenerator.generate()) needs the checksum unconditionally.
   *
   * TAMPERED result from structuralCheck short-circuits continuityCheck
   * because structural violations make anomaly scoring meaningless.
   */
  public async verify(acc: RunAccumulatorStats): Promise<IntegrityCheckResult> {
    // Always compute the checksum first — needed downstream regardless of outcome.
    const tickStreamChecksum = await this.proofGen.computeTickStreamChecksum(acc);

    // ── Sub-step A: Structural check ─────────────────────────────
    const structResult = this.structuralCheck(acc);
    if (structResult.status === 'TAMPERED') {
      return { ...structResult, tickStreamChecksum };
    }
    if (structResult.status === 'UNVERIFIED') {
      // Empty stream — skip continuity (nothing to analyze).
      return { ...structResult, tickStreamChecksum };
    }

    // ── Sub-step B: Continuity / anomaly check ───────────────────
    const contResult = this.continuityCheck(acc);
    return { ...contResult, tickStreamChecksum };
  }

  // ── PRIVATE: STRUCTURAL CHECK ─────────────────────────────────────
  /**
   * Verifies that the tick stream is complete and correctly ordered.
   *
   * Rules enforced:
   *   1. Non-empty stream (empty → UNVERIFIED, not TAMPERED)
   *   2. Tick indices form a gapless sequence 0, 1, 2 … N-1
   *   3. No tick index meets or exceeds seasonTickBudget
   *   4. accumulator.ticksSurvived matches actual snapshot count
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
        reason: `ticksSurvived mismatch: reported ${acc.ticksSurvived}, actual snapshot count ${snaps.length}`,
      };
    }

    return { status: 'VERIFIED' };
  }

  // ── PRIVATE: CONTINUITY CHECK ────────────────────────────────────
  /**
   * Statistical anomaly detection across the tick stream.
   * Flags patterns inconsistent with organic gameplay.
   *
   * Checks performed:
   *   1. Net worth single-tick jumps > 10× previous value AND > $500k delta
   *   2. Shield integrity single-tick jump > 15 points (regen is bounded at ~2–3 pts/tick)
   *   3. Hater heat single-tick absolute delta > 30 (BattleEngine logic is bounded)
   *   4. Duplicate tick hashes within the stream
   *
   * Anomaly scoring:
   *   · Each check contributes a weighted additive score (details inline).
   *   · Final score is capped at 1.0.
   *   · score ≥ ANOMALY_THRESHOLD (0.85)       → TAMPERED
   *   · ANOMALY_SUSPICIOUS_MIN (0.30) ≤ score < 0.85 → UNVERIFIED (review queue)
   *   · score < ANOMALY_SUSPICIOUS_MIN          → VERIFIED
   *
   * Full server-side seed replay (P14_REPLAY_FORENSICS) is a future capability.
   * This is a statistical plausibility pass, not cryptographic proof of authenticity.
   */
  private continuityCheck(
    acc: RunAccumulatorStats,
  ): Omit<IntegrityCheckResult, 'tickStreamChecksum'> {
    const snaps = acc.tickSnapshots;
    const anomalies: string[] = [];
    let anomalyScore = 0.0;

    // ── Check 1: Suspicious net worth single-tick jumps ───────────
    // Natural cashflow is bounded by monthly income / expenses per tick.
    // A jump > 10× previous value AND > $500k absolute delta is implausible.
    for (let i = 1; i < snaps.length; i++) {
      const prev = Math.abs(snaps[i - 1].netWorth) + 1; // +1 avoids div-by-zero
      const curr = Math.abs(snaps[i].netWorth);
      const delta = snaps[i].netWorth - snaps[i - 1].netWorth;
      if (curr > prev * 10 && delta > 500_000) {
        anomalies.push(
          `Suspicious net worth jump at tick ${i}: ${snaps[i - 1].netWorth} → ${snaps[i].netWorth}`,
        );
        anomalyScore += 0.35;
      }
    }

    // ── Check 2: Suspicious shield recovery jump ─────────────────
    // L1/L2 regen cap ≈ 2 pts/tick; L3/L4 cap ≈ 1 pt/tick → avg max ≈ 1.5 pts/tick.
    // A single-tick average jump > 15 points is impossible through normal regen.
    for (let i = 1; i < snaps.length; i++) {
      const delta = snaps[i].shieldAvgIntegrity - snaps[i - 1].shieldAvgIntegrity;
      if (delta > 15) {
        anomalies.push(
          `Suspicious shield recovery jump at tick ${i}: +${delta.toFixed(1)} points`,
        );
        anomalyScore += 0.25;
      }
    }

    // ── Check 3: Suspicious hater heat delta ─────────────────────
    // BattleEngine logic bounds per-tick hater_heat changes.
    // An absolute tick-to-tick delta > 30 is outside natural gameplay.
    for (let i = 1; i < snaps.length; i++) {
      const heatDelta = Math.abs(snaps[i].haterHeat - snaps[i - 1].haterHeat);
      if (heatDelta > 30) {
        anomalies.push(
          `Suspicious hater_heat delta at tick ${i}: ${heatDelta} points`,
        );
        anomalyScore += 0.15;
      }
    }

    // ── Check 4: Duplicate tick hashes ───────────────────────────
    // Identical hashes in distinct tick positions indicate stream manipulation.
    // Weight scales with the proportion of duplicates in the stream.
    const hashSet = new Set(snaps.map(s => s.tickHash));
    if (hashSet.size < snaps.length) {
      const dupeCount = snaps.length - hashSet.size;
      anomalies.push(`${dupeCount} duplicate tick hash(es) detected in stream`);
      anomalyScore += 0.50 * (dupeCount / snaps.length);
    }

    // Cap at 1.0
    anomalyScore = Math.min(1.0, anomalyScore);

    // ── Verdict ───────────────────────────────────────────────────
    if (anomalyScore >= ReplayIntegrityChecker.ANOMALY_THRESHOLD) {
      return {
        status: 'TAMPERED',
        reason: `Anomaly score ${anomalyScore.toFixed(3)} exceeds threshold ${ReplayIntegrityChecker.ANOMALY_THRESHOLD}. Checks: ${anomalies.join('; ')}`,
        anomalyScore,
      };
    }

    if (anomalyScore >= ReplayIntegrityChecker.ANOMALY_SUSPICIOUS_MIN) {
      // Suspicious but not confirmed — flag for manual review, do not hard-reject.
      return {
        status: 'UNVERIFIED',
        reason: `Moderate anomaly score ${anomalyScore.toFixed(3)} — flagged for review. Checks: ${anomalies.join('; ')}`,
        anomalyScore,
      };
    }

    return { status: 'VERIFIED', anomalyScore };
  }
}
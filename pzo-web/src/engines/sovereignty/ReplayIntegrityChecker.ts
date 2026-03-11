// ReplayIntegrityChecker.ts

import { ProofGenerator } from './ProofGenerator';
import type { IntegrityStatus, RunAccumulatorStats } from './types';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — SOVEREIGNTY ENGINE — REPLAY INTEGRITY CHECKER
 * /pzo-web/src/engines/sovereignty/ReplayIntegrityChecker.ts
 *
 * Step 1 of the sovereignty pipeline.
 *
 * Responsibilities:
 *   · compute tick_stream_checksum for all runs
 *   · structural validation of the recorded tick stream
 *   · continuity / anomaly scoring across the recorded stream
 *   · never block proof generation from receiving a checksum
 *
 * Import rule: may import from types.ts and ProofGenerator.ts ONLY.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export interface IntegrityCheckResult {
  status: IntegrityStatus;
  tickStreamChecksum: string;
  reason?: string;
  anomalyScore?: number;
}

export class ReplayIntegrityChecker {
  private static readonly ANOMALY_THRESHOLD = 0.85;
  private static readonly SUSPICIOUS_THRESHOLD = 0.30;
  private static readonly CRC32_HEX = /^[a-f0-9]{8}$/;
  private static readonly SHA256_HEX = /^[a-f0-9]{64}$/;

  private readonly proofGen: ProofGenerator;

  constructor() {
    this.proofGen = new ProofGenerator();
  }

  public async verify(acc: RunAccumulatorStats): Promise<IntegrityCheckResult> {
    const tickStreamChecksum = await this.proofGen.computeTickStreamChecksum(acc);

    const structural = this.structuralCheck(acc);
    if (structural.status !== 'VERIFIED') {
      return { ...structural, tickStreamChecksum };
    }

    const continuity = this.continuityCheck(acc);
    return { ...continuity, tickStreamChecksum };
  }

  private structuralCheck(acc: RunAccumulatorStats): Omit<IntegrityCheckResult, 'tickStreamChecksum'> {
    if (!Number.isInteger(acc.seasonTickBudget) || acc.seasonTickBudget <= 0) {
      return {
        status: 'UNVERIFIED',
        reason: `Invalid seasonTickBudget ${String(acc.seasonTickBudget)} — integrity check could not be completed`,
      };
    }

    if (!Number.isInteger(acc.ticksSurvived) || acc.ticksSurvived < 0) {
      return {
        status: 'UNVERIFIED',
        reason: `Invalid ticksSurvived ${String(acc.ticksSurvived)} — integrity check could not be completed`,
      };
    }

    const snaps = acc.tickSnapshots;
    if (snaps.length === 0) {
      return {
        status: 'UNVERIFIED',
        reason: 'Empty tick stream — no snapshots recorded',
      };
    }

    const seenTickIndices = new Set<number>();

    for (let i = 0; i < snaps.length; i += 1) {
      const snap = snaps[i];

      if (!Number.isInteger(snap.tickIndex) || snap.tickIndex < 0) {
        return {
          status: 'TAMPERED',
          reason: `Invalid tickIndex at position ${i}: ${String(snap.tickIndex)}`,
        };
      }

      if (snap.tickIndex !== i) {
        return {
          status: 'TAMPERED',
          reason: `Tick index discontinuity at position ${i}: expected ${i}, got ${snap.tickIndex}`,
        };
      }

      if (seenTickIndices.has(snap.tickIndex)) {
        return {
          status: 'TAMPERED',
          reason: `Duplicate tick index detected: ${snap.tickIndex}`,
        };
      }
      seenTickIndices.add(snap.tickIndex);

      if (snap.tickIndex >= acc.seasonTickBudget) {
        return {
          status: 'TAMPERED',
          reason: `Tick index ${snap.tickIndex} meets or exceeds season budget ${acc.seasonTickBudget}`,
        };
      }

      if (!this.isFiniteSnapshotValue(snap.pressureScore)) {
        return {
          status: 'TAMPERED',
          reason: `Invalid pressureScore at tick ${snap.tickIndex}`,
        };
      }

      if (!this.isFiniteSnapshotValue(snap.shieldAvgIntegrity)) {
        return {
          status: 'TAMPERED',
          reason: `Invalid shieldAvgIntegrity at tick ${snap.tickIndex}`,
        };
      }

      if (snap.shieldAvgIntegrity < 0 || snap.shieldAvgIntegrity > 100) {
        return {
          status: 'TAMPERED',
          reason: `shieldAvgIntegrity out of bounds at tick ${snap.tickIndex}: ${snap.shieldAvgIntegrity}`,
        };
      }

      if (!this.isFiniteSnapshotValue(snap.netWorth)) {
        return {
          status: 'TAMPERED',
          reason: `Invalid netWorth at tick ${snap.tickIndex}`,
        };
      }

      if (!Number.isFinite(snap.haterHeat)) {
        return {
          status: 'TAMPERED',
          reason: `Invalid haterHeat at tick ${snap.tickIndex}`,
        };
      }

      if (!Number.isFinite(snap.cascadeChainsActive) || snap.cascadeChainsActive < 0) {
        return {
          status: 'TAMPERED',
          reason: `Invalid cascadeChainsActive at tick ${snap.tickIndex}`,
        };
      }

      if (!Array.isArray(snap.decisionsThisTick)) {
        return {
          status: 'TAMPERED',
          reason: `decisionsThisTick must be an array at tick ${snap.tickIndex}`,
        };
      }

      if (!this.isValidTickHash(snap.tickHash)) {
        return {
          status: 'TAMPERED',
          reason: `Invalid tickHash format at tick ${snap.tickIndex}: ${snap.tickHash}`,
        };
      }
    }

    if (acc.ticksSurvived !== snaps.length) {
      return {
        status: 'TAMPERED',
        reason: `ticksSurvived mismatch: reported ${acc.ticksSurvived}, actual snapshot count ${snaps.length}`,
      };
    }

    return { status: 'VERIFIED' };
  }

  private continuityCheck(acc: RunAccumulatorStats): Omit<IntegrityCheckResult, 'tickStreamChecksum'> {
    const snaps = acc.tickSnapshots;
    const anomalies: string[] = [];
    let anomalyScore = 0;

    for (let i = 1; i < snaps.length; i += 1) {
      const previous = snaps[i - 1];
      const current = snaps[i];

      const previousMagnitude = Math.abs(previous.netWorth) + 1;
      const currentMagnitude = Math.abs(current.netWorth);
      const netWorthDelta = current.netWorth - previous.netWorth;
      if (currentMagnitude > previousMagnitude * 10 && netWorthDelta > 500_000) {
        anomalies.push(
          `Suspicious net worth jump at tick ${current.tickIndex}: ${previous.netWorth} → ${current.netWorth}`,
        );
        anomalyScore += 0.35;
      }

      const shieldDelta = current.shieldAvgIntegrity - previous.shieldAvgIntegrity;
      if (shieldDelta > 15) {
        anomalies.push(
          `Suspicious shield recovery jump at tick ${current.tickIndex}: +${shieldDelta.toFixed(1)}`,
        );
        anomalyScore += 0.25;
      }

      const heatDelta = Math.abs(current.haterHeat - previous.haterHeat);
      if (heatDelta > 30) {
        anomalies.push(
          `Suspicious hater_heat delta at tick ${current.tickIndex}: ${heatDelta}`,
        );
        anomalyScore += 0.15;
      }

      const cascadeJump = current.cascadeChainsActive - previous.cascadeChainsActive;
      if (cascadeJump > 10) {
        anomalies.push(
          `Suspicious cascade chain activation jump at tick ${current.tickIndex}: +${cascadeJump}`,
        );
        anomalyScore += 0.10;
      }
    }

    const uniqueHashes = new Set(snaps.map(snap => snap.tickHash.toLowerCase()));
    if (uniqueHashes.size < snaps.length) {
      const duplicateCount = snaps.length - uniqueHashes.size;
      anomalies.push(`${duplicateCount} duplicate tick hash(es) detected`);
      anomalyScore += 0.50 * (duplicateCount / snaps.length);
    }

    let impossibleDecisionCount = 0;
    for (const snap of snaps) {
      for (const decision of snap.decisionsThisTick) {
        if (!decision || typeof decision !== 'object') {
          impossibleDecisionCount += 1;
          continue;
        }

        const decisionWindowMs = (decision as { decisionWindowMs?: unknown }).decisionWindowMs;
        const resolvedInMs = (decision as { resolvedInMs?: unknown }).resolvedInMs;
        const wasAutoResolved = (decision as { wasAutoResolved?: unknown }).wasAutoResolved;

        const invalidWindow = typeof decisionWindowMs !== 'number' || !Number.isFinite(decisionWindowMs) || decisionWindowMs <= 0;
        const invalidResolve = typeof resolvedInMs !== 'number' || !Number.isFinite(resolvedInMs) || resolvedInMs < 0;
        const autoResolvedImpossible = wasAutoResolved === true && resolvedInMs !== 0;
        const overWindowImpossible = typeof decisionWindowMs === 'number' && typeof resolvedInMs === 'number' && resolvedInMs > decisionWindowMs * 2;

        if (invalidWindow || invalidResolve || autoResolvedImpossible || overWindowImpossible) {
          impossibleDecisionCount += 1;
        }
      }
    }

    if (impossibleDecisionCount > 0) {
      anomalies.push(`${impossibleDecisionCount} decision record(s) contain impossible timing values`);
      anomalyScore += Math.min(0.20, impossibleDecisionCount * 0.02);
    }

    anomalyScore = Math.min(1, anomalyScore);

    if (anomalyScore >= ReplayIntegrityChecker.ANOMALY_THRESHOLD) {
      return {
        status: 'TAMPERED',
        reason: `Anomaly score ${anomalyScore.toFixed(3)} exceeds threshold. Checks: ${anomalies.join('; ')}`,
        anomalyScore,
      };
    }

    if (anomalyScore >= ReplayIntegrityChecker.SUSPICIOUS_THRESHOLD) {
      return {
        status: 'UNVERIFIED',
        reason: `Moderate anomaly score ${anomalyScore.toFixed(3)} — flagged for review${anomalies.length > 0 ? ` (${anomalies.join('; ')})` : ''}`,
        anomalyScore,
      };
    }

    return {
      status: 'VERIFIED',
      anomalyScore,
    };
  }

  private isFiniteSnapshotValue(value: number): boolean {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private isValidTickHash(value: string): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const normalized = value.trim().toLowerCase();
    return ReplayIntegrityChecker.CRC32_HEX.test(normalized)
      || ReplayIntegrityChecker.SHA256_HEX.test(normalized);
  }
}
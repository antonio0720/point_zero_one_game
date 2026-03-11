/*
 * POINT ZERO ONE — BACKEND SOVEREIGNTY — REPLAY INTEGRITY CHECKER
 * /backend/src/game/engine/sovereignty/ReplayIntegrityChecker.ts
 *
 * Doctrine:
 * - backend validates integrity from the final backend snapshot surface
 * - structural failures quarantine the run immediately
 * - missing or incomplete evidence downgrades to UNVERIFIED, not silent success
 * - ghost mode has hard requirements when legend markers are enabled
 * - proof hash mismatches are treated as integrity quarantine events
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { ProofGenerator } from './ProofGenerator';

const CRC32_HEX_RE = /^[a-f0-9]{8}$/i;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

export interface ReplayIntegrityResult {
  ok: boolean;
  reason: string | null;
  integrityStatus: 'VERIFIED' | 'QUARANTINED' | 'UNVERIFIED';
  tickStreamChecksum: string;
  anomalyScore: number;
  expectedProofHash: string | null;
}

export class ReplayIntegrityChecker {
  private readonly proofGenerator: ProofGenerator;

  constructor() {
    this.proofGenerator = new ProofGenerator();
  }

  public verify(snapshot: RunStateSnapshot): ReplayIntegrityResult {
    const tickStreamChecksum = this.safeTickStreamChecksum(snapshot);
    const failures: string[] = [];
    let anomalyScore = 0;

    const checksums = Array.isArray(snapshot.sovereignty.tickChecksums)
      ? [...snapshot.sovereignty.tickChecksums]
      : [];

    if (checksums.length === 0) {
      return {
        ok: false,
        reason: 'missing tick checksums',
        integrityStatus: 'UNVERIFIED',
        tickStreamChecksum,
        anomalyScore: 1,
        expectedProofHash: null,
      };
    }

    const normalizedChecksums = checksums.map((checksum, index) => {
      const normalized = typeof checksum === 'string' ? checksum.trim().toLowerCase() : '';

      if (!CRC32_HEX_RE.test(normalized) && !SHA256_HEX_RE.test(normalized)) {
        failures.push(`invalid tick checksum format at index ${index}`);
      }

      return normalized;
    });

    if (normalizedChecksums.some((value) => value.length === 0)) {
      failures.push('empty tick checksum detected');
      anomalyScore += 0.2;
    }

    if (new Set(normalizedChecksums).size !== normalizedChecksums.length) {
      failures.push('duplicate checksum chain');
      anomalyScore += 0.5;
    }

    if (
      snapshot.telemetry.lastTickChecksum &&
      normalizedChecksums.length > 0 &&
      snapshot.telemetry.lastTickChecksum.trim().toLowerCase() !==
        normalizedChecksums[normalizedChecksums.length - 1]
    ) {
      failures.push('telemetry.lastTickChecksum does not match final sovereignty checksum');
      anomalyScore += 0.25;
    }

    const inferredTickCount = this.resolveTickCount(snapshot);
    if (normalizedChecksums.length > inferredTickCount + 1) {
      failures.push(
        `checksum stream longer than plausible tick count (${normalizedChecksums.length} vs ${inferredTickCount})`,
      );
      anomalyScore += 0.2;
    }

    if (snapshot.mode === 'ghost') {
      if (
        snapshot.modeState.legendMarkersEnabled &&
        snapshot.cards.ghostMarkers.length === 0
      ) {
        failures.push('ghost mode missing legend markers');
        anomalyScore += 0.35;
      }

      if (
        snapshot.modeState.legendMarkersEnabled &&
        snapshot.cards.ghostMarkers.length > 0 &&
        snapshot.modeState.ghostBaselineRunId === null
      ) {
        failures.push('ghost mode has legend markers but no ghostBaselineRunId');
        anomalyScore += 0.15;
      }
    }

    if (!this.isFiniteNumber(snapshot.economy.netWorth)) {
      failures.push('net worth is non-finite');
      anomalyScore += 0.5;
    }

    if (!this.isFiniteNumber(snapshot.pressure.score)) {
      failures.push('pressure score is non-finite');
      anomalyScore += 0.35;
    }

    if (!Array.isArray(snapshot.shield.layers) || snapshot.shield.layers.length === 0) {
      failures.push('shield layer surface is missing');
      anomalyScore += 0.35;
    }

    for (const layer of snapshot.shield.layers) {
      if (layer.max <= 0) {
        failures.push(`shield layer ${layer.layerId} has non-positive max integrity`);
        anomalyScore += 0.2;
      }
      if (layer.current < 0 || layer.current > layer.max) {
        failures.push(`shield layer ${layer.layerId} current integrity is out of range`);
        anomalyScore += 0.2;
      }
    }

    if (snapshot.economy.haterHeat < 0 || snapshot.economy.haterHeat > 100) {
      failures.push('hater heat is outside 0–100');
      anomalyScore += 0.2;
    }

    if (snapshot.sovereignty.proofHash) {
      const proofHash = snapshot.sovereignty.proofHash.trim().toLowerCase();

      if (!SHA256_HEX_RE.test(proofHash)) {
        failures.push('stored proofHash is not valid SHA-256 hex');
        anomalyScore += 0.4;
      } else {
        const expectedProofHash = this.proofGenerator.generate(snapshot);
        if (proofHash !== expectedProofHash) {
          failures.push('stored proofHash does not match canonical backend proofHash');
          anomalyScore += 0.6;
        }
      }
    }

    if (
      snapshot.sovereignty.integrityStatus === 'QUARANTINED' &&
      snapshot.sovereignty.auditFlags.length === 0 &&
      failures.length === 0
    ) {
      failures.push('integrity is already QUARANTINED with no explicit audit flag trail');
      anomalyScore += 0.15;
    }

    anomalyScore = this.clamp(anomalyScore, 0, 1);

    if (failures.length > 0) {
      return {
        ok: false,
        reason: failures.join('; '),
        integrityStatus: 'QUARANTINED',
        tickStreamChecksum,
        anomalyScore,
        expectedProofHash: this.safeExpectedProofHash(snapshot),
      };
    }

    return {
      ok: true,
      reason: null,
      integrityStatus: 'VERIFIED',
      tickStreamChecksum,
      anomalyScore,
      expectedProofHash: snapshot.sovereignty.proofHash
        ? this.safeExpectedProofHash(snapshot)
        : null,
    };
  }

  private safeTickStreamChecksum(snapshot: RunStateSnapshot): string {
    try {
      return this.proofGenerator.computeTickStreamChecksum(snapshot);
    } catch {
      return '';
    }
  }

  private safeExpectedProofHash(snapshot: RunStateSnapshot): string | null {
    try {
      return this.proofGenerator.generate(snapshot);
    } catch {
      return null;
    }
  }

  private resolveTickCount(snapshot: RunStateSnapshot): number {
    const fromTick = Number.isFinite(snapshot.tick) ? Math.max(0, Math.trunc(snapshot.tick)) : 0;
    const fromChecksums = Array.isArray(snapshot.sovereignty.tickChecksums)
      ? snapshot.sovereignty.tickChecksums.length
      : 0;

    return Math.max(fromTick, fromChecksums);
  }

  private isFiniteNumber(value: number): boolean {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
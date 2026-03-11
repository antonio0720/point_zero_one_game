/*
 * POINT ZERO ONE — BACKEND SOVEREIGNTY — PROOF GENERATOR
 * /backend/src/game/engine/sovereignty/ProofGenerator.ts
 *
 * Doctrine:
 * - backend is the authoritative proof surface
 * - proof inputs must be canonical, deterministic, and audit-friendly
 * - tick stream checksum is derived from the ordered recorded tick checksums
 * - proof hash is stable across retries for identical completed runs
 * - negative net worth remains part of the hash input by design
 */

import { sha256 } from '../core/Deterministic';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

const CRC32_HEX_RE = /^[a-f0-9]{8}$/i;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

export interface BackendProofHashInput {
  seed: string;
  tickStreamChecksum: string;
  outcome: 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
  finalNetWorth: number;
  userId: string;
}

export class ProofGenerator {
  private static readonly EMPTY_TICK_STREAM_CHECKSUM = sha256('');

  /**
   * Canonical proof hash for the backend snapshot.
   *
   * Exact format:
   *   seed | tick_stream_checksum | outcome | final_net_worth.toFixed(2) | user_id
   */
  public generate(snapshot: RunStateSnapshot): string {
    return this.generateFromInput(this.buildProofInput(snapshot));
  }

  public generateFromInput(input: BackendProofHashInput): string {
    const payload = [
      this.requireOpaqueString(input.seed, 'seed'),
      this.normalizeSha256(input.tickStreamChecksum, 'tickStreamChecksum'),
      this.normalizeOutcome(input.outcome),
      this.normalizeFiniteNumber(input.finalNetWorth, 'finalNetWorth').toFixed(2),
      this.requireOpaqueString(input.userId, 'userId'),
    ].join('|');

    return sha256(payload);
  }

  public buildProofInput(snapshot: RunStateSnapshot): BackendProofHashInput {
    return {
      seed: this.requireOpaqueString(snapshot.seed, 'snapshot.seed'),
      tickStreamChecksum: this.computeTickStreamChecksum(snapshot),
      outcome: this.normalizeOutcome(snapshot.outcome ?? 'ABANDONED'),
      finalNetWorth: this.normalizeFiniteNumber(
        snapshot.economy.netWorth,
        'snapshot.economy.netWorth',
      ),
      userId: this.requireOpaqueString(snapshot.userId, 'snapshot.userId'),
    };
  }

  /**
   * SHA-256 of the ordered tick checksum stream.
   * Empty streams intentionally map to SHA-256('').
   */
  public computeTickStreamChecksum(snapshot: RunStateSnapshot): string {
    const checksums = this.normalizeTickChecksums(snapshot.sovereignty.tickChecksums);

    if (checksums.length === 0) {
      return ProofGenerator.EMPTY_TICK_STREAM_CHECKSUM;
    }

    return sha256(checksums.join('|'));
  }

  public verifyExistingProofHash(snapshot: RunStateSnapshot): boolean {
    if (!snapshot.sovereignty.proofHash) {
      return false;
    }

    const expected = this.generate(snapshot);
    return snapshot.sovereignty.proofHash.toLowerCase() === expected;
  }

  private normalizeTickChecksums(checksums: readonly string[]): string[] {
    if (!Array.isArray(checksums)) {
      throw new Error('[ProofGenerator] sovereignty.tickChecksums must be an array');
    }

    return checksums.map((checksum, index) =>
      this.normalizeTickChecksum(checksum, `sovereignty.tickChecksums[${index}]`),
    );
  }

  private normalizeTickChecksum(value: string, field: string): string {
    const normalized = this.requireOpaqueString(value, field).trim().toLowerCase();

    if (!CRC32_HEX_RE.test(normalized) && !SHA256_HEX_RE.test(normalized)) {
      throw new Error(
        `[ProofGenerator] ${field} must be either 8-char CRC32 hex or 64-char SHA-256 hex`,
      );
    }

    return normalized;
  }

  private normalizeSha256(value: string, field: string): string {
    const normalized = this.requireOpaqueString(value, field).trim().toLowerCase();

    if (!SHA256_HEX_RE.test(normalized)) {
      throw new Error(`[ProofGenerator] ${field} must be a 64-char SHA-256 hex string`);
    }

    return normalized;
  }

  private normalizeOutcome(
    value: RunStateSnapshot['outcome'] | BackendProofHashInput['outcome'],
  ): BackendProofHashInput['outcome'] {
    switch (value) {
      case 'FREEDOM':
      case 'TIMEOUT':
      case 'BANKRUPT':
      case 'ABANDONED':
        return value;
      default:
        return 'ABANDONED';
    }
  }

  private requireOpaqueString(value: string, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`[ProofGenerator] ${field} must be a non-empty string`);
    }

    return value;
  }

  private normalizeFiniteNumber(value: number, field: string): number {
    if (!Number.isFinite(value)) {
      throw new Error(`[ProofGenerator] ${field} must be finite`);
    }

    return Object.is(value, -0) ? 0 : value;
  }
}
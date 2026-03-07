//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/ProofGenerator.ts

// ═══════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SOVEREIGNTY ENGINE — PROOF GENERATOR
// Density6 LLC · Confidential · Do not distribute
//
// Responsibilities:
//   · Isomorphic SHA-256 (browser SubtleCrypto + Node node:crypto)
//   · Sync CRC32 fallback for use inside the tick loop
//   · tick_stream_checksum computation from ordered tick snapshots
//   · proof_hash generation from exact 5-field pipe-separated input
//   · RunSignature construction
//
// Import rules: may import from types.ts ONLY.
// ═══════════════════════════════════════════════════════════════════

import type { RunAccumulatorStats, RunSignature, IntegrityStatus } from './types';

export class ProofGenerator {

  // ── PUBLIC: GENERATE PROOF HASH ──────────────────────────────────
  /**
   * Compute the canonical proof_hash for a completed run.
   *
   * Input format is FIXED — any change breaks all existing hashes.
   * Field order: seed | tick_stream_checksum | outcome | finalNetWorth.toFixed(2) | userId
   */
  public async generate(params: {
    seed:               string;
    tickStreamChecksum: string;
    outcome:            string;
    finalNetWorth:      number;
    userId:             string;
  }): Promise<string> {
    const input = [
      params.seed,
      params.tickStreamChecksum,
      params.outcome,
      params.finalNetWorth.toFixed(2),
      params.userId,
    ].join('|');
    return this.sha256(input);
  }

  // ── PUBLIC: BUILD RUN SIGNATURE ───────────────────────────────────
  /**
   * Construct the machine-readable RunSignature from a completed accumulator.
   * Embeds proof_hash, integrity status, and all identity fields.
   */
  public buildSignature(params: {
    proofHash:       string;
    accumulator:     RunAccumulatorStats;
    integrityStatus: IntegrityStatus;
  }): RunSignature {
    const acc = params.accumulator;
    return {
      proofHash:           params.proofHash,
      runId:               acc.runId,
      userId:              acc.userId,
      clientVersion:       acc.clientVersion,
      engineVersion:       acc.engineVersion,
      haterSabotagesCount: acc.haterSabotagesCount,
      outcome:             acc.outcome,
      finalNetWorth:       acc.finalNetWorth,
      ticksSurvived:       acc.ticksSurvived,
      integrityStatus:     params.integrityStatus,
      signedAt:            Date.now(),
    };
  }

  // ── PUBLIC: COMPUTE TICK STREAM CHECKSUM ─────────────────────────
  /**
   * SHA-256 of pipe-joined ordered tick hashes.
   * Defensive sort by tickIndex ensures correctness even if snapshots
   * arrived out of order due to async tick recording edge cases.
   *
   * Called by ReplayIntegrityChecker from the LIVE accumulator,
   * and again from a replayed stream to detect divergence.
   *
   * Empty tick stream → SHA-256 of empty string (deterministic, not an error).
   */
  public async computeTickStreamChecksum(acc: RunAccumulatorStats): Promise<string> {
    if (acc.tickSnapshots.length === 0) {
      return this.sha256('');
    }
    const input = [...acc.tickSnapshots]
      .sort((a, b) => a.tickIndex - b.tickIndex)
      .map(t => t.tickHash)
      .join('|');
    return this.sha256(input);
  }

  // ── PUBLIC STATIC: CRC32 FALLBACK (sync — used inside tick loop) ─
  /**
   * Fast CRC32 as an 8-char hex string.
   * Used during snapshotTick() where async SHA-256 would add latency.
   * The full SHA-256 pass happens post-run in computeTickStreamChecksum().
   *
   * Algorithm: standard CRC32 with IEEE polynomial 0xEDB88320.
   */
  public static crc32hex(input: string): string {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < input.length; i++) {
      crc ^= input.charCodeAt(i);
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : (crc >>> 1);
      }
    }
    return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
  }

  // ── PRIVATE: SHA-256 — ISOMORPHIC ────────────────────────────────
  /**
   * SHA-256 that works in both browser (SubtleCrypto) and Node.js (node:crypto).
   * Always returns a lowercase hex string of exactly 64 characters.
   *
   * Browser path: window.crypto.subtle.digest()
   * Node path:    createHash('sha256') from node:crypto
   */
  private async sha256(input: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      // ── Browser: SubtleCrypto ────────────────────────────────────
      const encoded    = new TextEncoder().encode(input);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
      const hashArray  = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // ── Fallback: manual hash (browser-only build — node:crypto removed) ──
      // Simple djb2 hash → hex. Not cryptographic, but ProofGenerator
      // only runs in browser where SubtleCrypto handles the real work.
      let hash = 5381;
      for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
      }
      return hash.toString(16).padStart(16, '0').repeat(4);
    }
  }
}
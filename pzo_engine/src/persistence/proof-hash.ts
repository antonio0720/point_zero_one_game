// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/proof-hash.ts
//
// Proof hash generation for completed run records.
//
// UPDATED FROM SPRINT 0:
//   ✦ rulesetVersion included in canonical hash input (field 6)
//   ✦ mode included in canonical hash input (field 7)
//   ✦ isDemoRun flag: demo runs get deterministic hash with 'DEMO:' prefix
//     so they are permanently distinguishable and excluded from live proofs
//
// TWO MODES (controlled by ProofHashConfig.useML):
//
//   DETERMINISTIC (default):
//     SHA-256 of pipe-separated canonical fields.
//     Field order: seed | tickStreamChecksum | outcome | finalNetWorth.toFixed(2) |
//                  userId | rulesetVersion | mode
//     (Must match ProofGenerator.generate() in SovereigntyEngine exactly)
//
//   ML-ASSISTED:
//     Deterministic SHA-256 base + ML anomaly score suffix as hex-encoded float.
//     Format: <sha256>:<anomalyHex>
//     SHA-256 portion is always independently verifiable.
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import type { RunAccumulatorStats } from './types';

// =============================================================================
// CONFIG
// =============================================================================

export interface ProofHashConfig {
  useML:       boolean;
  mlEndpoint?: string;
  mlApiKey?:   string;
}

export function resolveProofHashConfig(): ProofHashConfig {
  return {
    useML:      process.env['PZO_ML_PROOF_HASH'] === 'true',
    mlEndpoint: process.env['PZO_ML_ENDPOINT'],
    mlApiKey:   process.env['PZO_ML_API_KEY'],
  };
}

// =============================================================================
// PROOF HASH CLASS
// =============================================================================

export class ProofHash {
  private hash:         string | null = null;
  private anomalyScore: number | null = null;
  private readonly config: ProofHashConfig;

  constructor(config?: Partial<ProofHashConfig>) {
    this.config = { ...resolveProofHashConfig(), ...config };
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  public async generateProofHash(acc: RunAccumulatorStats): Promise<void> {
    // Demo runs get a fixed-format deterministic hash — never ML-augmented
    if (acc.isDemoRun) {
      this.generateDemoProofHash(acc);
      return;
    }

    const tickStreamChecksum = this.computeTickStreamChecksum(acc);
    const base = this.computeBase(acc, tickStreamChecksum);

    if (this.config.useML && this.config.mlEndpoint) {
      this.hash = await this.generateMLHash(acc, base, tickStreamChecksum);
    } else {
      this.hash = base;
      this.anomalyScore = null;
    }
  }

  /**
   * Synchronous deterministic hash.
   * Used when ML is disabled, as ML fallback, or in tests.
   */
  public generateDeterministicProofHash(
    acc: RunAccumulatorStats,
    tickStreamChecksum?: string,
  ): void {
    const checksum = tickStreamChecksum ?? this.computeTickStreamChecksum(acc);
    this.hash = this.computeBase(acc, checksum);
    this.anomalyScore = null;
  }

  /**
   * Demo run proof hash.
   * Prefixed 'DEMO:' — permanently excluded from live leaderboard proof validation.
   * Still deterministic and verifiable for tutorial replay purposes.
   */
  private generateDemoProofHash(acc: RunAccumulatorStats): void {
    const checksum = this.computeTickStreamChecksum(acc);
    const base     = this.computeBase(acc, checksum);
    this.hash         = `DEMO:${base}`;
    this.anomalyScore = null;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  public getHash(): string {
    if (!this.hash) {
      throw new Error('[ProofHash] Hash not generated. Call generateProofHash() first.');
    }
    return this.hash;
  }

  public getAnomalyScore(): number | null { return this.anomalyScore; }
  public isMLAugmented(): boolean        { return this.anomalyScore !== null; }
  public isDemoHash(): boolean           { return (this.hash ?? '').startsWith('DEMO:'); }

  /**
   * Extract base SHA-256 (64 hex chars), stripping ML suffix or DEMO: prefix.
   */
  public getBaseHash(): string {
    const h = this.getHash();
    if (h.startsWith('DEMO:')) return h.slice(5).split(':')[0]!;
    return h.includes(':') ? h.split(':')[0]! : h;
  }

  // ── Private: canonical base ───────────────────────────────────────────────

  /**
   * 7-field canonical input for SHA-256.
   * Field order is FIXED — changing it invalidates all existing hashes.
   * Must stay in sync with ProofGenerator.generate() in SovereigntyEngine.
   *
   * Fields: seed | tickStreamChecksum | outcome | finalNetWorth | userId |
   *         rulesetVersion | mode
   */
  private computeBase(acc: RunAccumulatorStats, tickStreamChecksum: string): string {
    const input = [
      acc.seed,
      tickStreamChecksum,
      acc.outcome,
      acc.finalNetWorth.toFixed(2),
      acc.userId,
      acc.rulesetVersion,
      acc.mode,
    ].join('|');

    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  /**
   * SHA-256 of all tick hashes ordered by tickIndex, joined by '|'.
   * Empty runs (ABANDONED immediately) → hash of empty string.
   */
  private computeTickStreamChecksum(acc: RunAccumulatorStats): string {
    if (acc.tickSnapshots.length === 0) {
      return createHash('sha256').update('', 'utf8').digest('hex');
    }

    const ordered     = [...acc.tickSnapshots].sort((a, b) => a.tickIndex - b.tickIndex);
    const streamInput = ordered.map(t => t.tickHash).join('|');
    return createHash('sha256').update(streamInput, 'utf8').digest('hex');
  }

  // ── Private: ML-augmented hash ────────────────────────────────────────────

  private async generateMLHash(
    acc: RunAccumulatorStats,
    baseHash: string,
    tickStreamChecksum: string,
  ): Promise<string> {
    try {
      const response = await fetch(this.config.mlEndpoint!, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.config.mlApiKey ?? ''}`,
        },
        body: JSON.stringify({
          runId:              acc.runId,
          userId:             acc.userId,
          mode:               acc.mode,
          outcome:            acc.outcome,
          ticksSurvived:      acc.ticksSurvived,
          finalNetWorth:      acc.finalNetWorth,
          rulesetVersion:     acc.rulesetVersion,
          haterBlockRate:     acc.totalHaterAttempts > 0
            ? acc.haterSabotagesBlocked / acc.totalHaterAttempts
            : 1.0,
          cascadeBreakRate:   acc.totalCascadeChains > 0
            ? acc.cascadeChainsBreak / acc.totalCascadeChains
            : 1.0,
          tickStreamChecksum,
          recentTicks: acc.tickSnapshots.slice(-5).map(t => ({
            tickIndex:     t.tickIndex,
            pressureScore: t.pressureScore,
            netWorth:      t.netWorth,
            haterHeat:     t.haterHeat,
            tensionScore:  t.tensionScore,
          })),
        }),
        signal: AbortSignal.timeout(3_000),
      });

      if (!response.ok) throw new Error(`ML endpoint ${response.status}`);

      const data  = await response.json() as { anomalyScore?: number };
      const score = typeof data.anomalyScore === 'number'
        ? Math.max(0, Math.min(1, data.anomalyScore))
        : 0;

      this.anomalyScore = score;

      const buf = Buffer.allocUnsafe(4);
      buf.writeFloatBE(score, 0);
      return `${baseHash}:${buf.toString('hex').toUpperCase()}`;

    } catch (err) {
      console.warn('[ProofHash] ML endpoint failed, falling back to deterministic:', err);
      this.anomalyScore = null;
      return baseHash;
    }
  }

  // ── Static: verify ────────────────────────────────────────────────────────

  /**
   * Verify a stored hash against recomputed hash from the accumulator.
   * Always compares the deterministic base — ML suffix and DEMO prefix are stripped.
   */
  public static verify(storedHash: string, acc: RunAccumulatorStats): boolean {
    const verifier = new ProofHash({ useML: false });
    verifier.generateDeterministicProofHash(acc);

    // Normalize stored: strip DEMO: prefix, then strip ML suffix
    const storedNorm  = storedHash.startsWith('DEMO:')
      ? storedHash.slice(5).split(':')[0]!
      : (storedHash.includes(':') ? storedHash.split(':')[0]! : storedHash);

    const recomputed = verifier.getBaseHash();

    if (storedNorm.length !== recomputed.length) return false;
    const storedBuf     = Buffer.from(storedNorm, 'hex');
    const recomputedBuf = Buffer.from(recomputed, 'hex');
    return storedBuf.equals(recomputedBuf);
  }
}
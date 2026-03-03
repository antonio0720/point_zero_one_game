// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/audit-hash.ts
//
// HMAC-SHA-256 audit hash for the run record.
//
// PURPOSE:
//   Proof hash = game integrity (was tick stream replayed correctly?)
//   Audit hash = storage integrity (was the record tampered with post-proof?)
//   They are complementary layers. Neither replaces the other.
//
// UPDATED FROM SPRINT 0:
//   ✦ mode included in canonical pipe string (position 10)
//   ✦ rulesetVersion included (position 11)
//   ✦ cordFinalScore included (position 12) — 'NULL' when CORD not computed
//   ✦ isDemoRun flag included (position 13)
//
// WHAT GETS HASHED:
//   proofHash | runId | userId | outcome | finalNetWorth | grade | score |
//   completedAt | ticksSurvived | integrityStatus | mode | rulesetVersion |
//   cordFinalScore | isDemoRun
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  RunAccumulatorStats,
  RunGrade,
  RunOutcome,
  IntegrityStatus,
  GameMode,
} from './types';

// =============================================================================
// CONFIG
// =============================================================================

export interface AuditHashConfig {
  enabled:  boolean;
  hmacKey:  string | undefined;
}

export function resolveAuditHashConfig(): AuditHashConfig {
  return {
    enabled: process.env['PZO_AUDIT_HASH'] === 'true',
    hmacKey: process.env['PZO_AUDIT_HMAC_KEY'],
  };
}

// =============================================================================
// AUDIT HASH INPUT
// =============================================================================

export interface AuditHashInput {
  proofHash:       string;
  runId:           string;
  userId:          string;
  outcome:         RunOutcome;
  finalNetWorth:   number;
  grade:           RunGrade;
  score:           number;
  completedAt:     number;
  ticksSurvived:   number;
  integrityStatus: IntegrityStatus;
  mode:            GameMode;
  rulesetVersion:  string;
  cordFinalScore:  number | null;
  isDemoRun:       boolean;
}

// =============================================================================
// AUDIT HASH CLASS
// =============================================================================

export class AuditHash {
  private hash:    string | null = null;
  private skipped: boolean       = false;
  private readonly config: AuditHashConfig;

  constructor(config?: Partial<AuditHashConfig>) {
    this.config = { ...resolveAuditHashConfig(), ...config };
  }

  public generateAuditHash(input: AuditHashInput): void {
    if (!this.config.enabled) {
      this.skipped = true;
      return;
    }

    if (!this.config.hmacKey) {
      console.warn(
        '[AuditHash] PZO_AUDIT_HASH=true but PZO_AUDIT_HMAC_KEY is not set. ' +
        'Audit hash generation skipped.'
      );
      this.skipped = true;
      return;
    }

    const canonicalInput = this.buildCanonicalInput(input);
    this.hash    = createHmac('sha256', this.config.hmacKey)
      .update(canonicalInput, 'utf8')
      .digest('hex');
    this.skipped = false;
  }

  public getHash(): string | null { return this.hash; }
  public isSkipped(): boolean     { return this.skipped; }

  public toStorableString(): string {
    return this.hash ?? 'SKIPPED';
  }

  public static verify(
    storedHash: string,
    input: AuditHashInput,
    hmacKey: string,
  ): boolean {
    if (storedHash === 'SKIPPED') return false;

    const auditor = new AuditHash({ enabled: true, hmacKey });
    auditor.generateAuditHash(input);

    const recomputed = auditor.getHash();
    if (!recomputed) return false;

    try {
      const storedBuf     = Buffer.from(storedHash, 'hex');
      const recomputedBuf = Buffer.from(recomputed,  'hex');
      if (storedBuf.length !== recomputedBuf.length) return false;
      return timingSafeEqual(storedBuf, recomputedBuf);
    } catch {
      return false;
    }
  }

  /**
   * 14-field canonical pipe-separated HMAC input.
   * Field order is FIXED — changing it invalidates all existing audit hashes.
   */
  private buildCanonicalInput(input: AuditHashInput): string {
    return [
      input.proofHash,
      input.runId,
      input.userId,
      input.outcome,
      input.finalNetWorth.toFixed(2),
      input.grade,
      input.score.toFixed(6),
      String(input.completedAt),
      String(input.ticksSurvived),
      input.integrityStatus,
      input.mode,
      input.rulesetVersion,
      input.cordFinalScore !== null ? input.cordFinalScore.toFixed(6) : 'NULL',
      input.isDemoRun ? '1' : '0',
    ].join('|');
  }
}

// =============================================================================
// FACTORY HELPER
// =============================================================================

export function buildAuditHashInput(params: {
  proofHash:       string;
  acc:             RunAccumulatorStats;
  grade:           RunGrade;
  score:           number;
  integrityStatus: IntegrityStatus;
}): AuditHashInput {
  return {
    proofHash:       params.proofHash,
    runId:           params.acc.runId,
    userId:          params.acc.userId,
    outcome:         params.acc.outcome,
    finalNetWorth:   params.acc.finalNetWorth,
    grade:           params.grade,
    score:           params.score,
    completedAt:     params.acc.completedAt,
    ticksSurvived:   params.acc.ticksSurvived,
    integrityStatus: params.integrityStatus,
    mode:            params.acc.mode,
    rulesetVersion:  params.acc.rulesetVersion,
    cordFinalScore:  params.acc.cordScore?.finalCORD ?? null,
    isDemoRun:       params.acc.isDemoRun,
  };
}
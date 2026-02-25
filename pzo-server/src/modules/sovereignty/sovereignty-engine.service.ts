// pzo-server/src/modules/sovereignty/sovereignty-engine.service.ts
// Sprint 7 — Sovereignty Engine — verifies proof hashes + signs verified runs

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface VerifyResult {
  valid: boolean;
  serverHash: string;
  reason?: string;
}

export interface ProofInput {
  seed: number;
  mode: string;
  finalTick: number;
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  cordScore: number;
  eventCount: number;
  eventDigest: string;
}

@Injectable()
export class SovereigntyEngineService {
  /**
   * Server-side SHA-256 verification of a proof hash.
   * Uses Node crypto — matches browser SubtleCrypto output.
   */
  verify(input: ProofInput, clientHash: string): VerifyResult {
    const payload = this.buildPayload(input);
    const serverHash = createHash('sha256').update(payload).digest('hex');

    if (serverHash === clientHash) {
      return { valid: true, serverHash };
    }

    return {
      valid: false,
      serverHash,
      reason: 'Hash mismatch — run data may have been tampered with',
    };
  }

  /**
   * Generate a server-side signed hash (used when backend generates the run).
   */
  sign(input: ProofInput): string {
    const payload = this.buildPayload(input);
    return createHash('sha256').update(payload).digest('hex');
  }

  private buildPayload(input: ProofInput): string {
    return [
      input.seed,
      input.mode,
      input.finalTick,
      input.finalCash,
      input.finalNetWorth,
      input.finalIncome,
      parseFloat(input.cordScore.toFixed(4)),
      input.eventCount,
      input.eventDigest,
    ].join('|');
  }
}

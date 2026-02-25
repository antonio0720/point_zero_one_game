// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/sovereignty/proofHash.ts
// Sprint 7 — Proof Hash System
//
// Every completed run produces a deterministic proof hash.
// Hash = SHA-256 of: seed + mode + finalTick + cordScore + eventLog digest
// Frontend generates a preview hash. Backend verifies and signs it.
// Tamper-evident: changing any input invalidates the hash.
// ═══════════════════════════════════════════════════════════════════════════

export interface ProofHashInput {
  seed: number;
  mode: string;
  finalTick: number;
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  cordScore: number;
  eventCount: number;
  /** Sorted, joined event IDs for determinism */
  eventDigest: string;
}

export interface ProofHashResult {
  hash: string;
  shortHash: string;   // first 12 chars for display
  inputDigest: string;
  generatedAt: number;
}

/**
 * Browser-compatible SHA-256 via SubtleCrypto.
 * Returns hex string.
 */
export async function computeProofHash(input: ProofHashInput): Promise<ProofHashResult> {
  const payload = buildPayloadString(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    hash,
    shortHash: hash.slice(0, 12),
    inputDigest: payload,
    generatedAt: Date.now(),
  };
}

/**
 * Sync version using a simple djb2-style hash — for preview display only.
 * Backend always verifies with crypto.subtle SHA-256.
 */
export function computeProofHashSync(input: ProofHashInput): string {
  const payload = buildPayloadString(input);
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) + payload.charCodeAt(i);
    hash = hash & hash; // 32-bit int
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function buildPayloadString(input: ProofHashInput): string {
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

// ─────────────────────────────────────────────────────────────────────────────
// game/sovereignty/runIntegrity.ts
// Sprint 7 — Run Integrity System
// ─────────────────────────────────────────────────────────────────────────────

export interface RunIntegrityCheck {
  runId: string;
  proofHash: string;
  isValid: boolean;
  validatedAt: number;
  failureReason?: string;
}

export interface VerifiedRunRecord {
  runId: string;
  userId: string;
  displayName: string;
  mode: string;
  seed: number;
  finalTick: number;
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  cordScore: number;
  cordTier: string;
  proofHash: string;
  shortHash: string;
  verifiedAt: number;
  isLegend: boolean;
  eventCount: number;
}

export function buildEventDigest(eventIds: string[]): string {
  return [...eventIds].sort().join(',');
}

export function buildVerifiedRunRecord(
  runId: string,
  userId: string,
  displayName: string,
  mode: string,
  input: ProofHashInput,
  cordTier: string,
  proofHash: string,
  isLegend: boolean,
): VerifiedRunRecord {
  return {
    runId,
    userId,
    displayName,
    mode,
    seed: input.seed,
    finalTick: input.finalTick,
    finalCash: input.finalCash,
    finalNetWorth: input.finalNetWorth,
    finalIncome: input.finalIncome,
    cordScore: input.cordScore,
    cordTier,
    proofHash,
    shortHash: proofHash.slice(0, 12),
    verifiedAt: Date.now(),
    isLegend,
    eventCount: input.eventCount,
  };
}

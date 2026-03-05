export declare const PROOF_HASH_VERSION: "PZO-v3";
export type ProofHashVersion = typeof PROOF_HASH_VERSION;
export interface ProofHashInput {
    seed: number;
    mode: string;
    finalTick: number;
    finalCash: number;
    finalNetWorth: number;
    finalIncome: number;
    cordScore: number;
    eventCount: number;
    /**
     * Ordered event ID sequence — temporal order preserved.
     * Use buildEventDigest() to produce this string from your event array.
     * DO NOT sort — order is part of the integrity signal.
     */
    eventDigest: string;
}
export interface ProofHashResult {
    hash: string;
    shortHash: string;
    inputDigest: string;
    hashVersion: ProofHashVersion;
    /**
     * Set to 0 when computing deterministically for comparison.
     * Set to Date.now() for live display in UI.
     */
    generatedAt: number;
}
export declare class ProofVerificationError extends Error {
    readonly code: 'HASH_MISMATCH' | 'INVALID_INPUT' | 'CRYPTO_UNAVAILABLE' | 'VERSION_MISMATCH';
    constructor(code: ProofVerificationError['code'], message: string);
}
/**
 * Compute the canonical proof hash for a completed run.
 * Uses SubtleCrypto SHA-256 when available; falls back to pure-JS SHA-256
 * for React Native, Capacitor, offline PWA, and test environments.
 *
 * NEVER call this during the tick loop. Call ONCE at run completion.
 */
export declare function computeProofHash(input: ProofHashInput, options?: {
    deterministic?: boolean;
}): Promise<ProofHashResult>;
/**
 * Verify an existing proof hash against recomputed inputs.
 * Returns true if valid, throws ProofVerificationError if not.
 *
 * Used by:
 *   - Leaderboard integrity check
 *   - Phantom legend badge verification
 *   - Replay integrity (step 2 of sovereignty pipeline)
 */
export declare function verifyProofHash(input: ProofHashInput, existingHash: string, existingVersion?: string): Promise<boolean>;
/**
 * NON-CRYPTOGRAPHIC sync preview hash — for display only.
 *
 * ⚠️  DO NOT use for any verification or integrity check.
 * ⚠️  This is djb2 — trivially reversible. Not a security primitive.
 * ⚠️  Exists only for: optimistic UI badge, copy-to-clipboard preview.
 *
 * Backend always verifies with SHA-256 via computeProofHash / verifyProofHash.
 */
export declare function computeProofHashSync(input: ProofHashInput): string;
/**
 * Build a tamper-evident digest from an ORDERED event ID sequence.
 *
 * FIXED: Previous implementation sorted events (destroying temporal order).
 * Temporal sequence is meaningful for replay integrity — an attacker who
 * reorders events would get the same sorted digest with the old approach.
 *
 * Now uses FNV-1a chain over the ordered sequence:
 *   digest = FNV-1a(eventIds[0]) XOR-chain FNV-1a(eventIds[0..1]) XOR-chain ...
 * This is order-sensitive and fast (O(n) sync, no sorting).
 *
 * For short event lists (< 200 events), the ordered join is also appended
 * as a human-readable component for debugging.
 */
export declare function buildEventDigest(eventIds: string[]): string;
/**
 * Lightweight deterministic run identifier.
 * NOT cryptographic. NOT a proof hash.
 *
 * Used for:
 *   - Optimistic UI updates before SHA-256 completes
 *   - Client-side deduplication before submitting to server
 *   - Quick equality check on run objects
 *
 * Changes whenever any of: seed, mode, finalTick, cash, netWorth change.
 */
export declare function computeRunFingerprint(seed: number, mode: string, finalTick: number, finalCash: number, finalNetWorth: number): string;
export type RunGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type BadgeTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON';
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
/**
 * Grade → BadgeTier mapping.
 * FIXED: FREEDOM outcome + Grade A unlocks PLATINUM (was unreachable).
 */
export declare function gradeToBadgeTier(grade: RunGrade, outcome?: RunOutcome): BadgeTier;
export declare function gradeColor(grade: RunGrade): string;
export declare function outcomeLabel(outcome: RunOutcome): string;
export declare function outcomeColor(outcome: RunOutcome): string;
/**
 * Structured display object for UI components.
 * Eliminates inline field reconstruction in ResultScreen, ProofCardV2, etc.
 *
 * Fonts: Use Barlow Condensed for grade/tier labels, DM Mono for hash/score.
 * Colors: All values WCAG AA+ on #0D0D1E (C.panel).
 */
export interface ProofDisplayCard {
    runId: string;
    shortHash: string;
    hashVersion: ProofHashVersion;
    grade: RunGrade;
    gradeColor: string;
    gradeLabel: string;
    badgeTier: BadgeTier;
    cordScore: number;
    cordScorePct: string;
    cordTier: string;
    cordTierColor: string;
    outcome: RunOutcome;
    outcomeLabel: string;
    outcomeColor: string;
    mode: string;
    finalNetWorth: number;
    ticksSurvived: number;
    earnedAt: number;
    badgeSvg: string;
}
export declare const GRADE_LABELS: Record<RunGrade, string>;
/**
 * Build a ProofDisplayCard from a VerifiedRunRecord.
 * Import VerifiedRunRecord from runIntegrity.ts.
 */
export declare function buildProofDisplayCard(params: {
    runId: string;
    shortHash: string;
    hashVersion?: string;
    grade: RunGrade;
    cordScore: number;
    cordTier: string;
    outcome: RunOutcome;
    mode: string;
    finalNetWorth: number;
    ticksSurvived: number;
    verifiedAt: number;
}): ProofDisplayCard;
export interface LegendEligibilityResult {
    eligible: boolean;
    reason?: string;
}
/**
 * Determine if a completed run is eligible to be registered as a Phantom legend.
 *
 * Requirements:
 *   1. Run must have beaten the existing legend (beaten = true)
 *   2. cordScore must meet minimum threshold (0.55 = SILVER tier)
 *   3. integrityStatus must be VERIFIED (not TAMPERED or UNVERIFIED)
 *   4. outcome must not be ABANDONED
 */
export declare function isLegendEligible(params: {
    beaten: boolean;
    cordScore: number;
    integrityStatus: string;
    outcome: RunOutcome;
    cordThreshold?: number;
}): LegendEligibilityResult;
export declare function buildBadgeSvg(tier: BadgeTier, size?: number): string;
//# sourceMappingURL=proofHash.d.ts.map
/**
 * The final outcome of a completed run.
 * Drives the outcome_multiplier in sovereignty_score.
 * Also exported by events.ts — canonical definition is here.
 */
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
/**
 * Letter grade derived from sovereignty_score brackets.
 * A = sovereign excellence. F = failure. Permanent on run record.
 * Use ExtendedGrade when Bleed Mode is possible (adds 'S').
 */
export type RunGrade = 'A' | 'B' | 'C' | 'D' | 'F';
/**
 * Extended grade — includes S-grade only achievable in Bleed Mode.
 * S-grade requires sovereignty_score 1.50–1.80 (CORD ceiling lifted to 1.80).
 * Badge: SOVEREIGN_PRIME — distinct from standard PLATINUM badge.
 */
export type ExtendedGrade = RunGrade | 'S';
/**
 * Visual tier of the proof badge on the exported sovereignty artifact.
 * Derived from RunGrade + RunOutcome combination.
 *
 * PLATINUM  — Grade A + FREEDOM outcome (or S-grade any outcome)
 * GOLD      — Grade A (non-FREEDOM), or Grade B + FREEDOM
 * SILVER    — Grade B (non-FREEDOM), or Grade C + FREEDOM
 * BRONZE    — Grade C or D (any outcome)
 * IRON      — Grade F
 */
export type BadgeTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON';
/**
 * Result of the ReplayIntegrityChecker pipeline step.
 * VERIFIED    — tick stream matches seed replay (100% match)
 * TAMPERED    — stream does not match — hash divergence detected
 * UNVERIFIED  — check could not be executed (missing data, timeout)
 */
export type IntegrityStatus = 'VERIFIED' | 'TAMPERED' | 'UNVERIFIED';
/**
 * Format of the exported proof artifact.
 */
export type ArtifactFormat = 'PDF' | 'PNG';
/**
 * Leaderboard ranking tier, derived from normalized CORD score (0.0–1.0).
 * Distinct from RunGrade — CordTier is about competitive rank, not effort grade.
 *
 * SOVEREIGN  — Top 0.1% of all runs. Requires score ≥ 0.93.
 * PLATINUM   — Top 1%. Score ≥ 0.82.
 * GOLD       — Top 5%. Score ≥ 0.68.
 * SILVER     — Top 20%. Score ≥ 0.48.
 * BRONZE     — Top 50%. Score ≥ 0.28.
 * UNRANKED   — Below 0.28 normalized score.
 */
export type CordTier = 'SOVEREIGN' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'UNRANKED';
export declare const CORD_TIER_THRESHOLDS: Record<CordTier, number>;
/** Color per CORD tier (WCAG AA+ on #0D0D1E). */
export declare const CORD_TIER_COLORS: Record<CordTier, string>;
/**
 * Immutable weights used in sovereignty_score formula.
 * All weights sum to 1.0. Do not alter at runtime.
 *
 * Raw score = each component * its weight, summed.
 * Final score = raw * OUTCOME_MULTIPLIERS[outcome].
 * Max possible = 1.0 * 1.5 (FREEDOM) = 1.50 standard / 1.80 Bleed Mode.
 */
export declare const SOVEREIGNTY_WEIGHTS: {
    readonly TICKS_SURVIVED: 0.2;
    readonly SHIELDS_MAINTAINED: 0.25;
    readonly HATER_BLOCKS: 0.2;
    readonly DECISION_SPEED: 0.15;
    readonly CASCADE_BREAKS: 0.2;
};
/**
 * Outcome multipliers — final scalar applied to raw sovereignty score.
 * FREEDOM is the only outcome that allows score > 1.0.
 */
export declare const OUTCOME_MULTIPLIERS: Record<RunOutcome, number>;
/**
 * Standard grade brackets (all modes except Bleed Mode).
 * sovereignty_score ranges map to letter grades.
 * Note: Max standard score = 1.0 * 1.5 = 1.50 (perfect FREEDOM run).
 */
export declare const GRADE_THRESHOLDS: Record<RunGrade, {
    min: number;
    max: number;
}>;
/**
 * Bleed Mode grade brackets — S-grade unlocked (sovereignty_score 1.50–1.80).
 * Only accessible in GO_ALONE mode with all handicaps active.
 * S-grade grants SOVEREIGN_PRIME badge — not available anywhere else.
 */
export declare const BLEED_MODE_GRADE_THRESHOLDS: Record<ExtendedGrade, {
    min: number;
    max: number;
}>;
/** Grade label strings for UI display. */
export declare const GRADE_LABELS: Record<ExtendedGrade, string>;
/** Grade colors (WCAG AA+ on #0D0D1E). */
export declare const GRADE_COLORS: Record<ExtendedGrade, string>;
/**
 * Maps grade + outcome → badge tier.
 * Called by gradeToBadgeTier() in proofHash.ts.
 */
export declare const GRADE_TO_BADGE_TIER: Partial<Record<ExtendedGrade, Record<RunOutcome, BadgeTier>>>;
/**
 * The full sovereignty score record produced by SovereigntyEngine.
 * This is the canonical output of the post-run pipeline.
 *
 * Sprint 8: Rebuilt to align with engine sovereignty pipeline.
 * - Added sovereigntyScore, runGrade, badgeTier
 * - Added proofHash, integrityStatus, verifiedAt
 * - Added isBleedRun
 * - Replaced arbitrary 0–100 component scores with 0.0–1.0 normalized inputs
 */
export interface CordScore {
    /** (ticks_survived / season_tick_budget) */
    ticksSurvivedRatio: number;
    /** Time-average shield integrity across all 4 layers */
    shieldsMaintenanceAvg: number;
    /** (sabotages_blocked / total_attempts) */
    haterBlockRate: number;
    /** Normalized average decision speed score */
    decisionSpeedScore: number;
    /** (cascade_chains_broken / total_chains_triggered) */
    cascadeBreakRate: number;
    /** 0.0–0.50 additive bonus from mode-specific performance */
    modeBonus: number;
    /** e.g. "Trust Score 87/100: +0.12" */
    modeBonusLabel: string;
    /** Raw weighted sum: Σ(component * weight) */
    rawScore: number;
    /** rawScore * OUTCOME_MULTIPLIERS[outcome] */
    sovereigntyScore: number;
    /** Normalized 0.0–1.0 for CORD tier ranking */
    normalizedScore: number;
    /** SOVEREIGN | PLATINUM | GOLD | SILVER | BRONZE | UNRANKED */
    tier: CordTier;
    /** A | B | C | D | F (+ S for Bleed Mode) */
    runGrade: ExtendedGrade;
    /** Proof badge visual tier */
    badgeTier: BadgeTier;
    /** SHA-256 of seed + tick stream checksum + outcome + final net worth + userId */
    proofHash: string;
    /** VERIFIED | TAMPERED | UNVERIFIED */
    integrityStatus: IntegrityStatus;
    /** Unix ms when backend verified; null = pending or unverified */
    verifiedAt: number | null;
    /** True if this run was a GO_ALONE Bleed Mode run */
    isBleedRun: boolean;
}
/**
 * Mode-specific inputs fed into modeBonus calculation.
 * SovereigntyEngine reads the relevant fields per mode.
 *
 * Sprint 8: Added legendId, aidContractsFulfilled, bleedRunsCompleted,
 * cascadeChainsIntercepted, tempoChainBuilds, psycheTiltCount.
 */
export interface CordModeContext {
    mode: string;
    /** Number of isolation tax hits paid this run */
    isolationTaxesPaid?: number;
    /** Number of times Bleed Mode survival bonus was awarded */
    bleedSurvivals?: number;
    /** Number of completed Bleed Mode runs (lifetime) */
    bleedRunsCompleted?: number;
    /** True if player accepted a handicap for CORD bonus */
    handicapAccepted?: boolean;
    /** Extractions successfully executed */
    extractionsWon?: number;
    /** Counterplays successfully executed */
    counterplaysExecuted?: number;
    /** Battle Budget efficiency: BB_generated / BB_spent */
    battleBudgetEfficiency?: number;
    /** Number of cascade chains intercepted with counter cards */
    cascadeChainsIntercepted?: number;
    /** Number of tempo chains built (consecutive extractions with no counters) */
    tempoChainBuilds?: number;
    /** Number of times player entered psyche Tilt state */
    psycheTiltCount?: number;
    /** Final trust score (0.0–1.0) at run completion */
    trustScoreFinal?: number;
    /** True if player never triggered defection sequence */
    defectionAvoided?: boolean;
    /** Number of AID contracts fulfilled (fully repaid, no breach) */
    aidContractsFulfilled?: number;
    /** Number of CASCADE chains absorbed for the team */
    cascadeAbsorptions?: number;
    /** True if FULL_SYNERGY achieved (all 4 roles active at FREEDOM) */
    fullSynergyAchieved?: boolean;
    /** Run ID of the legend being chased */
    legendId?: string;
    /** Positive = beat legend; negative = behind legend at run end */
    finalCordGap?: number;
    /** Number of legend decay exploit cards activated */
    legendDecayExploited?: number;
    /** Legend tier at time of run (affects difficulty multiplier) */
    legendTier?: string;
    /** True if player beat a DYNASTY or IMMORTAL tier legend */
    dynastyLegendBeaten?: boolean;
}
/**
 * Record of a single forced-card decision made by the player.
 * Used in DECISION_SPEED sovereignty weight calculation.
 * Produced by DecisionWindowManager and consumed by SovereigntyEngine.
 */
export interface DecisionRecord {
    /** Which card required the decision */
    cardId: string;
    /** Total decision window available in ms */
    decisionWindowMs: number;
    /** How fast player resolved it (0 = auto-resolved) */
    resolvedInMs: number;
    /** True = player did not respond in time; auto-resolved to worst option */
    wasAutoResolved: boolean;
    /** True = player chose the mechanically best option */
    wasOptimalChoice: boolean;
    /** 0.0–1.0: fast + correct = 1.0, auto-resolved = 0.0 */
    speedScore: number;
}
/**
 * State snapshot at the end of each tick.
 * Stored in-memory during run, flushed to tick_stream_log on completion.
 * tick_hash is CRC32 (sync, tick loop) of:
 *   (tickIndex | pressureScore | shieldAvg | netWorth | haterHeat)
 *
 * Used by ReplayIntegrityChecker to verify run integrity.
 */
export interface TickSnapshot {
    /** 0-based tick number */
    tickIndex: number;
    /** 0.0–1.0 from PressureEngine */
    pressureScore: number;
    /** Time-average of all 4 shield layer integrity values */
    shieldIntegrityAvg: number;
    /** Player's net worth at end of this tick */
    netWorth: number;
    /** Hater heat level (0–100) */
    haterHeat: number;
    /** CRC32 hash of the 5 fields above — sync, O(1) */
    tickHash: number;
    /** Whether a forced-card decision was auto-resolved this tick */
    hadAutoResolve: boolean;
    /** Whether a cascade chain started this tick */
    hadCascadeStart: boolean;
}
/**
 * The post-pipeline database record for a completed, verified run.
 * Written by SovereigntyEngine after all pipeline steps complete.
 * Read by leaderboard, proof explorer, and social share systems.
 *
 * Designed for 20M concurrent run throughput:
 *   - All fields are primitive (no nested objects in hot path)
 *   - Indexed fields marked with // INDEX
 */
export interface VerifiedRunRecord {
    runId: string;
    userId: string;
    mode: string;
    seed: string;
    outcome: RunOutcome;
    finalNetWorth: number;
    freedomThreshold: number;
    sovereigntyScore: number;
    normalizedCordScore: number;
    runGrade: string;
    cordTier: CordTier;
    badgeTier: BadgeTier;
    isBleedRun: boolean;
    proofHash: string;
    integrityStatus: IntegrityStatus;
    verifiedAt: number;
    startedAt: number;
    completedAt: number;
    ticksPlayed: number;
    shareText: string;
    artifactUrl: string | null;
}
/**
 * Universal leaderboard entry — used across all 4 modes.
 * Built from VerifiedRunRecord by buildLeaderboardEntry() in runIntegrity.ts.
 */
export interface LeaderboardEntry {
    rank: number;
    runId: string;
    userId: string;
    displayName: string;
    mode: string;
    cordScore: string;
    cordTier: CordTier;
    grade: string;
    outcome: RunOutcome;
    netWorth: string;
    isBleedRun: boolean;
    badgeSvg: string;
    proofHash: string;
    verifiedAt: number;
}
//# sourceMappingURL=cord.d.ts.map
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/cord.ts
// Sprint 8 — Full Rebuild
//
// CHANGES FROM SPRINT 0:
//   ✦ CordTier FIXED: was SOVEREIGN|APEX|ELITE|BUILDER|INITIATE
//     (those were invented — no engine used them).
//     Now: SOVEREIGN|PLATINUM|GOLD|SILVER|BRONZE|UNRANKED — aligned with
//     engines/sovereignty/types.ts and cordCalculator.ts
//   ✦ ADD RunGrade type — 'A'|'B'|'C'|'D'|'F' — SEPARATE from CordTier
//     (was conflated in Sprint 0)
//   ✦ ADD ExtendedGrade — RunGrade | 'S' (Bleed Mode only, score 1.50–1.80)
//   ✦ ADD BadgeTier — proof artifact visual tier (PLATINUM|GOLD|SILVER|BRONZE|IRON)
//   ✦ ADD IntegrityStatus, ArtifactFormat
//   ✦ ADD SOVEREIGNTY_WEIGHTS — immutable scoring formula weights
//   ✦ ADD OUTCOME_MULTIPLIERS — FREEDOM:1.5, TIMEOUT:0.8, etc.
//   ✦ ADD GRADE_THRESHOLDS + BLEED_MODE_GRADE_THRESHOLDS
//   ✦ ADD DecisionRecord, TickSnapshot — sovereignty pipeline inputs
//   ✦ ADD VerifiedRunRecord — post-pipeline DB record
//   ✦ ADD LeaderboardEntry — universal across all modes
//   ✦ REBUILD CordScore — aligned to engine weight structure
//   ✦ REBUILD CordModeContext — added 6 missing mode fields
//
// RULES:
//   ✦ Zero imports — this file imports nothing.
//   ✦ Zero runtime logic — pure TypeScript declarations only.
//
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════

// ── Run Outcome ───────────────────────────────────────────────────────────────
/**
 * The final outcome of a completed run.
 * Drives the outcome_multiplier in sovereignty_score.
 * Also exported by events.ts — canonical definition is here.
 */
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

// ── Grade Types ───────────────────────────────────────────────────────────────
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

// ── Badge and Artifact Types ──────────────────────────────────────────────────
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

// ── CORD Tier ─────────────────────────────────────────────────────────────────
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
export type CordTier =
  | 'SOVEREIGN'
  | 'PLATINUM'
  | 'GOLD'
  | 'SILVER'
  | 'BRONZE'
  | 'UNRANKED';

export const CORD_TIER_THRESHOLDS: Record<CordTier, number> = {
  SOVEREIGN: 0.93,
  PLATINUM:  0.82,
  GOLD:      0.68,
  SILVER:    0.48,
  BRONZE:    0.28,
  UNRANKED:  0.00,
} as const;

/** Color per CORD tier (WCAG AA+ on #0D0D1E). */
export const CORD_TIER_COLORS: Record<CordTier, string> = {
  SOVEREIGN: '#9B7DFF',  // purple  — 7.1:1
  PLATINUM:  '#2DDBF5',  // cyan    — 8.4:1
  GOLD:      '#C9A84C',  // gold    — 5.6:1
  SILVER:    '#B8B8D8',  // silver  — 7.9:1
  BRONZE:    '#FF9B2F',  // orange  — 6.2:1
  UNRANKED:  '#6A6A90',  // dim     — 4.6:1
} as const;

// ── Sovereignty Score Weights ─────────────────────────────────────────────────
/**
 * Immutable weights used in sovereignty_score formula.
 * All weights sum to 1.0. Do not alter at runtime.
 *
 * Raw score = each component * its weight, summed.
 * Final score = raw * OUTCOME_MULTIPLIERS[outcome].
 * Max possible = 1.0 * 1.5 (FREEDOM) = 1.50 standard / 1.80 Bleed Mode.
 */
export const SOVEREIGNTY_WEIGHTS = {
  TICKS_SURVIVED:     0.20,  // (ticks_survived / season_tick_budget) * 0.20
  SHIELDS_MAINTAINED: 0.25,  // time-average shield integrity pct * 0.25
  HATER_BLOCKS:       0.20,  // (sabotages_blocked / total_attempts) * 0.20
  DECISION_SPEED:     0.15,  // normalized avg decision speed score * 0.15
  CASCADE_BREAKS:     0.20,  // (chains_broken / total_chains) * 0.20
} as const;

/**
 * Outcome multipliers — final scalar applied to raw sovereignty score.
 * FREEDOM is the only outcome that allows score > 1.0.
 */
export const OUTCOME_MULTIPLIERS: Record<RunOutcome, number> = {
  FREEDOM:   1.5,   // Sovereignty achieved. All gains amplified.
  TIMEOUT:   0.8,   // Time expired. Partial credit.
  BANKRUPT:  0.4,   // Financial destruction. Heavy penalty.
  ABANDONED: 0.0,   // Abandoned runs earn nothing. No exceptions.
} as const;

// ── Grade Thresholds ──────────────────────────────────────────────────────────
/**
 * Standard grade brackets (all modes except Bleed Mode).
 * sovereignty_score ranges map to letter grades.
 * Note: Max standard score = 1.0 * 1.5 = 1.50 (perfect FREEDOM run).
 */
export const GRADE_THRESHOLDS: Record<RunGrade, { min: number; max: number }> = {
  A: { min: 1.10, max: 1.50 },   // Sovereign excellence
  B: { min: 0.80, max: 1.09 },   // Strong performance
  C: { min: 0.55, max: 0.79 },   // Acceptable
  D: { min: 0.30, max: 0.54 },   // Below standard
  F: { min: 0.00, max: 0.29 },   // Failed or abandoned
} as const;

/**
 * Bleed Mode grade brackets — S-grade unlocked (sovereignty_score 1.50–1.80).
 * Only accessible in GO_ALONE mode with all handicaps active.
 * S-grade grants SOVEREIGN_PRIME badge — not available anywhere else.
 */
export const BLEED_MODE_GRADE_THRESHOLDS: Record<ExtendedGrade, { min: number; max: number }> = {
  S: { min: 1.50, max: 1.80 },   // SOVEREIGN PRIME — Bleed Mode only
  A: { min: 1.10, max: 1.49 },
  B: { min: 0.80, max: 1.09 },
  C: { min: 0.55, max: 0.79 },
  D: { min: 0.30, max: 0.54 },
  F: { min: 0.00, max: 0.29 },
} as const;

/** Grade label strings for UI display. */
export const GRADE_LABELS: Record<ExtendedGrade, string> = {
  S: 'SOVEREIGN PRIME',
  A: 'SOVEREIGN ARCHITECT',
  B: 'TACTICAL BUILDER',
  C: 'DISCIPLINED CLIMBER',
  D: 'DEVELOPING OPERATOR',
  F: 'LIQUIDATED',
} as const;

/** Grade colors (WCAG AA+ on #0D0D1E). */
export const GRADE_COLORS: Record<ExtendedGrade, string> = {
  S: '#2DDBF5',  // cyan  — Bleed Mode exclusive
  A: '#C9A84C',  // gold
  B: '#9B7DFF',  // purple
  C: '#2EE89A',  // green
  D: '#FF9B2F',  // orange
  F: '#FF4D4D',  // red
} as const;

// ── Badge Tier Assignment ─────────────────────────────────────────────────────
/**
 * Maps grade + outcome → badge tier.
 * Called by gradeToBadgeTier() in proofHash.ts.
 */
export const GRADE_TO_BADGE_TIER: Partial<Record<ExtendedGrade, Record<RunOutcome, BadgeTier>>> = {
  S: { FREEDOM: 'PLATINUM', TIMEOUT: 'PLATINUM', BANKRUPT: 'GOLD', ABANDONED: 'SILVER' },
  A: { FREEDOM: 'PLATINUM', TIMEOUT: 'GOLD',     BANKRUPT: 'SILVER', ABANDONED: 'BRONZE' },
  B: { FREEDOM: 'GOLD',     TIMEOUT: 'SILVER',   BANKRUPT: 'BRONZE', ABANDONED: 'IRON'  },
  C: { FREEDOM: 'SILVER',   TIMEOUT: 'BRONZE',   BANKRUPT: 'IRON',   ABANDONED: 'IRON'  },
  D: { FREEDOM: 'BRONZE',   TIMEOUT: 'IRON',     BANKRUPT: 'IRON',   ABANDONED: 'IRON'  },
  F: { FREEDOM: 'IRON',     TIMEOUT: 'IRON',     BANKRUPT: 'IRON',   ABANDONED: 'IRON'  },
} as const;

// ── CORD Score ────────────────────────────────────────────────────────────────
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
  // ── Sovereignty pipeline inputs (normalized 0.0–1.0) ──────────────────
  /** (ticks_survived / season_tick_budget) */
  ticksSurvivedRatio:    number;
  /** Time-average shield integrity across all 4 layers */
  shieldsMaintenanceAvg: number;
  /** (sabotages_blocked / total_attempts) */
  haterBlockRate:        number;
  /** Normalized average decision speed score */
  decisionSpeedScore:    number;
  /** (cascade_chains_broken / total_chains_triggered) */
  cascadeBreakRate:      number;

  // ── Mode bonus ─────────────────────────────────────────────────────────
  /** 0.0–0.50 additive bonus from mode-specific performance */
  modeBonus:            number;
  /** e.g. "Trust Score 87/100: +0.12" */
  modeBonusLabel:       string;

  // ── Computed totals ────────────────────────────────────────────────────
  /** Raw weighted sum: Σ(component * weight) */
  rawScore:             number;
  /** rawScore * OUTCOME_MULTIPLIERS[outcome] */
  sovereigntyScore:     number;
  /** Normalized 0.0–1.0 for CORD tier ranking */
  normalizedScore:      number;

  // ── Classification ─────────────────────────────────────────────────────
  /** SOVEREIGN | PLATINUM | GOLD | SILVER | BRONZE | UNRANKED */
  tier:                 CordTier;
  /** A | B | C | D | F (+ S for Bleed Mode) */
  runGrade:             ExtendedGrade;
  /** Proof badge visual tier */
  badgeTier:            BadgeTier;

  // ── Integrity ──────────────────────────────────────────────────────────
  /** SHA-256 of seed + tick stream checksum + outcome + final net worth + userId */
  proofHash:            string;
  /** VERIFIED | TAMPERED | UNVERIFIED */
  integrityStatus:      IntegrityStatus;
  /** Unix ms when backend verified; null = pending or unverified */
  verifiedAt:           number | null;

  // ── Meta ───────────────────────────────────────────────────────────────
  /** True if this run was a GO_ALONE Bleed Mode run */
  isBleedRun:           boolean;
}

// ── Per-Mode CORD Context ─────────────────────────────────────────────────────
/**
 * Mode-specific inputs fed into modeBonus calculation.
 * SovereigntyEngine reads the relevant fields per mode.
 *
 * Sprint 8: Added legendId, aidContractsFulfilled, bleedRunsCompleted,
 * cascadeChainsIntercepted, tempoChainBuilds, psycheTiltCount.
 */
export interface CordModeContext {
  mode: string; // GameMode string — no import to avoid circular deps

  // ── EMPIRE (GO_ALONE) ─────────────────────────────────────────────────
  /** Number of isolation tax hits paid this run */
  isolationTaxesPaid?:       number;
  /** Number of times Bleed Mode survival bonus was awarded */
  bleedSurvivals?:           number;
  /** Number of completed Bleed Mode runs (lifetime) */
  bleedRunsCompleted?:       number;
  /** True if player accepted a handicap for CORD bonus */
  handicapAccepted?:         boolean;

  // ── PREDATOR (HEAD_TO_HEAD) ────────────────────────────────────────────
  /** Extractions successfully executed */
  extractionsWon?:           number;
  /** Counterplays successfully executed */
  counterplaysExecuted?:     number;
  /** Battle Budget efficiency: BB_generated / BB_spent */
  battleBudgetEfficiency?:   number;
  /** Number of cascade chains intercepted with counter cards */
  cascadeChainsIntercepted?: number;
  /** Number of tempo chains built (consecutive extractions with no counters) */
  tempoChainBuilds?:         number;
  /** Number of times player entered psyche Tilt state */
  psycheTiltCount?:          number;

  // ── SYNDICATE (TEAM_UP) ────────────────────────────────────────────────
  /** Final trust score (0.0–1.0) at run completion */
  trustScoreFinal?:          number;
  /** True if player never triggered defection sequence */
  defectionAvoided?:         boolean;
  /** Number of AID contracts fulfilled (fully repaid, no breach) */
  aidContractsFulfilled?:    number;
  /** Number of CASCADE chains absorbed for the team */
  cascadeAbsorptions?:       number;
  /** True if FULL_SYNERGY achieved (all 4 roles active at FREEDOM) */
  fullSynergyAchieved?:      boolean;

  // ── PHANTOM (CHASE_A_LEGEND) ───────────────────────────────────────────
  /** Run ID of the legend being chased */
  legendId?:                 string;
  /** Positive = beat legend; negative = behind legend at run end */
  finalCordGap?:             number;
  /** Number of legend decay exploit cards activated */
  legendDecayExploited?:     number;
  /** Legend tier at time of run (affects difficulty multiplier) */
  legendTier?:               string; // LegendTier string
  /** True if player beat a DYNASTY or IMMORTAL tier legend */
  dynastyLegendBeaten?:      boolean;
}

// ── Decision Record ───────────────────────────────────────────────────────────
/**
 * Record of a single forced-card decision made by the player.
 * Used in DECISION_SPEED sovereignty weight calculation.
 * Produced by DecisionWindowManager and consumed by SovereigntyEngine.
 */
export interface DecisionRecord {
  /** Which card required the decision */
  cardId:            string;
  /** Total decision window available in ms */
  decisionWindowMs:  number;
  /** How fast player resolved it (0 = auto-resolved) */
  resolvedInMs:      number;
  /** True = player did not respond in time; auto-resolved to worst option */
  wasAutoResolved:   boolean;
  /** True = player chose the mechanically best option */
  wasOptimalChoice:  boolean;
  /** 0.0–1.0: fast + correct = 1.0, auto-resolved = 0.0 */
  speedScore:        number;
}

// ── Tick Snapshot ─────────────────────────────────────────────────────────────
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
  tickIndex:           number;
  /** 0.0–1.0 from PressureEngine */
  pressureScore:       number;
  /** Time-average of all 4 shield layer integrity values */
  shieldIntegrityAvg:  number;
  /** Player's net worth at end of this tick */
  netWorth:            number;
  /** Hater heat level (0–100) */
  haterHeat:           number;
  /** CRC32 hash of the 5 fields above — sync, O(1) */
  tickHash:            number;
  /** Whether a forced-card decision was auto-resolved this tick */
  hadAutoResolve:      boolean;
  /** Whether a cascade chain started this tick */
  hadCascadeStart:     boolean;
}

// ── Verified Run Record ───────────────────────────────────────────────────────
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
  // Identity
  runId:              string;   // UUID — INDEX
  userId:             string;   // INDEX
  mode:               string;   // GameMode string — INDEX
  seed:               string;   // Deterministic seed for replay

  // Outcome
  outcome:            RunOutcome;
  finalNetWorth:      number;
  freedomThreshold:   number;

  // Score
  sovereigntyScore:   number;   // 0.0–1.80 (Bleed Mode max)
  normalizedCordScore:number;   // 0.0–1.0 for ranking — INDEX
  runGrade:           string;   // ExtendedGrade string — INDEX
  cordTier:           CordTier; // INDEX

  // Badge
  badgeTier:          BadgeTier;
  isBleedRun:         boolean;

  // Integrity
  proofHash:          string;   // SHA-256 — INDEX (unique)
  integrityStatus:    IntegrityStatus;
  verifiedAt:         number;   // Unix ms

  // Timestamps
  startedAt:          number;   // Unix ms
  completedAt:        number;   // Unix ms
  ticksPlayed:        number;

  // Social
  shareText:          string;   // Pre-built share string
  artifactUrl:        string | null; // Signed URL to proof artifact PDF/PNG
}

// ── Leaderboard Entry ─────────────────────────────────────────────────────────
/**
 * Universal leaderboard entry — used across all 4 modes.
 * Built from VerifiedRunRecord by buildLeaderboardEntry() in runIntegrity.ts.
 */
export interface LeaderboardEntry {
  rank:               number;
  runId:              string;
  userId:             string;
  displayName:        string;
  mode:               string;   // GameMode alias e.g. 'EMPIRE'
  cordScore:          string;   // Formatted e.g. "94.2"
  cordTier:           CordTier;
  grade:              string;   // ExtendedGrade e.g. 'A'
  outcome:            RunOutcome;
  netWorth:           string;   // Formatted e.g. "$127,400"
  isBleedRun:         boolean;
  badgeSvg:           string;   // Inline SVG — pre-built for list rendering
  proofHash:          string;   // Truncated 8 chars for display
  verifiedAt:         number;
}

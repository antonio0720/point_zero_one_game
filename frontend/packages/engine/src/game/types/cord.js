"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRADE_TO_BADGE_TIER = exports.GRADE_COLORS = exports.GRADE_LABELS = exports.BLEED_MODE_GRADE_THRESHOLDS = exports.GRADE_THRESHOLDS = exports.OUTCOME_MULTIPLIERS = exports.SOVEREIGNTY_WEIGHTS = exports.CORD_TIER_COLORS = exports.CORD_TIER_THRESHOLDS = void 0;
exports.CORD_TIER_THRESHOLDS = {
    SOVEREIGN: 0.93,
    PLATINUM: 0.82,
    GOLD: 0.68,
    SILVER: 0.48,
    BRONZE: 0.28,
    UNRANKED: 0.00,
};
/** Color per CORD tier (WCAG AA+ on #0D0D1E). */
exports.CORD_TIER_COLORS = {
    SOVEREIGN: '#9B7DFF', // purple  — 7.1:1
    PLATINUM: '#2DDBF5', // cyan    — 8.4:1
    GOLD: '#C9A84C', // gold    — 5.6:1
    SILVER: '#B8B8D8', // silver  — 7.9:1
    BRONZE: '#FF9B2F', // orange  — 6.2:1
    UNRANKED: '#6A6A90', // dim     — 4.6:1
};
// ── Sovereignty Score Weights ─────────────────────────────────────────────────
/**
 * Immutable weights used in sovereignty_score formula.
 * All weights sum to 1.0. Do not alter at runtime.
 *
 * Raw score = each component * its weight, summed.
 * Final score = raw * OUTCOME_MULTIPLIERS[outcome].
 * Max possible = 1.0 * 1.5 (FREEDOM) = 1.50 standard / 1.80 Bleed Mode.
 */
exports.SOVEREIGNTY_WEIGHTS = {
    TICKS_SURVIVED: 0.20, // (ticks_survived / season_tick_budget) * 0.20
    SHIELDS_MAINTAINED: 0.25, // time-average shield integrity pct * 0.25
    HATER_BLOCKS: 0.20, // (sabotages_blocked / total_attempts) * 0.20
    DECISION_SPEED: 0.15, // normalized avg decision speed score * 0.15
    CASCADE_BREAKS: 0.20, // (chains_broken / total_chains) * 0.20
};
/**
 * Outcome multipliers — final scalar applied to raw sovereignty score.
 * FREEDOM is the only outcome that allows score > 1.0.
 */
exports.OUTCOME_MULTIPLIERS = {
    FREEDOM: 1.5, // Sovereignty achieved. All gains amplified.
    TIMEOUT: 0.8, // Time expired. Partial credit.
    BANKRUPT: 0.4, // Financial destruction. Heavy penalty.
    ABANDONED: 0.0, // Abandoned runs earn nothing. No exceptions.
};
// ── Grade Thresholds ──────────────────────────────────────────────────────────
/**
 * Standard grade brackets (all modes except Bleed Mode).
 * sovereignty_score ranges map to letter grades.
 * Note: Max standard score = 1.0 * 1.5 = 1.50 (perfect FREEDOM run).
 */
exports.GRADE_THRESHOLDS = {
    A: { min: 1.10, max: 1.50 }, // Sovereign excellence
    B: { min: 0.80, max: 1.09 }, // Strong performance
    C: { min: 0.55, max: 0.79 }, // Acceptable
    D: { min: 0.30, max: 0.54 }, // Below standard
    F: { min: 0.00, max: 0.29 }, // Failed or abandoned
};
/**
 * Bleed Mode grade brackets — S-grade unlocked (sovereignty_score 1.50–1.80).
 * Only accessible in GO_ALONE mode with all handicaps active.
 * S-grade grants SOVEREIGN_PRIME badge — not available anywhere else.
 */
exports.BLEED_MODE_GRADE_THRESHOLDS = {
    S: { min: 1.50, max: 1.80 }, // SOVEREIGN PRIME — Bleed Mode only
    A: { min: 1.10, max: 1.49 },
    B: { min: 0.80, max: 1.09 },
    C: { min: 0.55, max: 0.79 },
    D: { min: 0.30, max: 0.54 },
    F: { min: 0.00, max: 0.29 },
};
/** Grade label strings for UI display. */
exports.GRADE_LABELS = {
    S: 'SOVEREIGN PRIME',
    A: 'SOVEREIGN ARCHITECT',
    B: 'TACTICAL BUILDER',
    C: 'DISCIPLINED CLIMBER',
    D: 'DEVELOPING OPERATOR',
    F: 'LIQUIDATED',
};
/** Grade colors (WCAG AA+ on #0D0D1E). */
exports.GRADE_COLORS = {
    S: '#2DDBF5', // cyan  — Bleed Mode exclusive
    A: '#C9A84C', // gold
    B: '#9B7DFF', // purple
    C: '#2EE89A', // green
    D: '#FF9B2F', // orange
    F: '#FF4D4D', // red
};
// ── Badge Tier Assignment ─────────────────────────────────────────────────────
/**
 * Maps grade + outcome → badge tier.
 * Called by gradeToBadgeTier() in proofHash.ts.
 */
exports.GRADE_TO_BADGE_TIER = {
    S: { FREEDOM: 'PLATINUM', TIMEOUT: 'PLATINUM', BANKRUPT: 'GOLD', ABANDONED: 'SILVER' },
    A: { FREEDOM: 'PLATINUM', TIMEOUT: 'GOLD', BANKRUPT: 'SILVER', ABANDONED: 'BRONZE' },
    B: { FREEDOM: 'GOLD', TIMEOUT: 'SILVER', BANKRUPT: 'BRONZE', ABANDONED: 'IRON' },
    C: { FREEDOM: 'SILVER', TIMEOUT: 'BRONZE', BANKRUPT: 'IRON', ABANDONED: 'IRON' },
    D: { FREEDOM: 'BRONZE', TIMEOUT: 'IRON', BANKRUPT: 'IRON', ABANDONED: 'IRON' },
    F: { FREEDOM: 'IRON', TIMEOUT: 'IRON', BANKRUPT: 'IRON', ABANDONED: 'IRON' },
};
//# sourceMappingURL=cord.js.map
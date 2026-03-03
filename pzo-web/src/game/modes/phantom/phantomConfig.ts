// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/phantomConfig.ts
// Sprint 7 — Phantom (CHASE A LEGEND) complete configuration
//
// Single source of truth for all Phantom mode tuning constants.
// Any value that appears in multiple files belongs here.
// Performance targets: 20M concurrent, <2ms per tick on engine side.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

export interface PhantomConfig {
  // ── Ghost Replay ──────────────────────────────────────────────────────────
  /** How often ghost state is recalculated (ticks). Lower = smoother, higher = cheaper. */
  ghostTimelinePatchInterval: number;
  /** Max snapshots stored per legend timeline. Beyond this, snapshots are downsampled. */
  ghostMaxSnapshotsPerLegend: number;
  /** Store 1 snapshot per N ticks during recording (compression ratio). */
  ghostSnapshotCompressionInterval: number;
  /** Ticks in the velocity window for gap-closing rate estimation. */
  ghostGapVelocityWindowTicks: number;

  // ── Legend Decay ─────────────────────────────────────────────────────────
  /** Base decay rate per tick (older runs lose challenge pressure). */
  legendDecayRatePerTick: number;
  /** Minimum legend age (ticks) before decay applies. */
  legendDecayMinAgeTicks: number;
  /** Max legends kept on the leaderboard per seed. Trim lowest-decay when exceeded. */
  legendLeaderboardCap: number;
  /** CORD score minimum to register as a legend at all. */
  legendMinCordScore: number;

  // ── Gap Indicator ─────────────────────────────────────────────────────────
  /** Gap threshold (fraction) above which Nerve cards activate. */
  nerveCardActivationGap: number;
  /** Min consecutive ticks in a zone before zone label updates (prevents flapping). */
  gapZoneMinStreakTicks: number;
  /** CORD basis points recovered per gap-closing card played. */
  gapCloseCordBasis: number;

  // ── Dynasty Stack ─────────────────────────────────────────────────────────
  /** Max challengers queued in the dynasty stack per legend. */
  dynastyStackMaxDepth: number;
  /** Ticks before a queued challenge expires if not started. */
  dynastyChallengeTimeoutTicks: number;

  // ── Community Heat ────────────────────────────────────────────────────────
  /** Players-on-seed count below which heat is 1.0 (no boost). */
  communityHeatColdThreshold: number;
  /** Players-on-seed count at which heat reaches maximum. */
  communityHeatHotThreshold: number;
  /** Maximum community heat multiplier applied to CORD scoring. */
  communityHeatMaxMultiplier: number;
  /** How many ticks between community heat recalculation from server. */
  communityHeatRefreshIntervalTicks: number;

  // ── Proof Badge ───────────────────────────────────────────────────────────
  /** Net worth margin (fraction) above legend required for GOLD proof badge. */
  proofBadgeGoldMargin: number;
  /** Net worth margin for SILVER proof badge. */
  proofBadgeSilverMargin: number;
  /** Minimum CORD score for a run to generate a proof badge at all. */
  proofBadgeMinCordScore: number;

  // ── Card System ───────────────────────────────────────────────────────────
  /** Prediction card reveal window (ticks ahead ghost position shown). */
  predictionRevealWindowTicks: number;
  /** Ghost pressure intensity multiplier when gap is exactly 50%. */
  ghostPressureMultiplierAt50: number;
  /** Decay exploit card bonus cap (fraction). e.g. 0.30 = 30% max bonus. */
  decayExploitBonusCap: number;
}

export const PHANTOM_CONFIG: PhantomConfig = {
  // Ghost Replay
  ghostTimelinePatchInterval:       6,
  ghostMaxSnapshotsPerLegend:    2000,
  ghostSnapshotCompressionInterval: 3,
  ghostGapVelocityWindowTicks:     12,

  // Legend Decay
  legendDecayRatePerTick:       0.0003,
  legendDecayMinAgeTicks:       5_000,
  legendLeaderboardCap:           500,
  legendMinCordScore:            0.72,

  // Gap Indicator
  nerveCardActivationGap:        0.25,
  gapZoneMinStreakTicks:            3,
  gapCloseCordBasis:               12,

  // Dynasty Stack
  dynastyStackMaxDepth:             5,
  dynastyChallengeTimeoutTicks:  2880,  // ~2 game-days

  // Community Heat
  communityHeatColdThreshold:     100,
  communityHeatHotThreshold:   50_000,
  communityHeatMaxMultiplier:     2.0,
  communityHeatRefreshIntervalTicks: 30,

  // Proof Badge
  proofBadgeGoldMargin:          0.20,
  proofBadgeSilverMargin:        0.05,
  proofBadgeMinCordScore:        0.70,

  // Card System
  predictionRevealWindowTicks:     18,
  ghostPressureMultiplierAt50:    1.4,
  decayExploitBonusCap:          0.30,
};

// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/phantomConfig.ts
// Sprint 6 — Phantom (CHASE A LEGEND) mode configuration
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

export interface PhantomConfig {
  /** Ticks between ghost timeline patches broadcast */
  ghostTimelinePatchInterval: number;
  /** CORD basis points recovered per gap-closing card */
  gapCloseCordBasis: number;
  /** Legend decay rate per tick (older runs lose challenge pressure) */
  legendDecayRatePerTick: number;
  /** Minimum legend age (ticks) before decay applies */
  legendDecayMinAgeTicks: number;
  /** Gap threshold below which Nerve cards activate */
  nerveCardActivationGap: number;
  /** Dynasty challenge stack max depth */
  dynastyStackMaxDepth: number;
  /** Minimum CORD score to register as a legend */
  legendMinCordScore: number;
  /** Prediction card reveal window (ticks ahead) */
  predictionRevealWindowTicks: number;
  /** Ghost pressure intensity multiplier at 50% gap */
  ghostPressureMultiplierAt50: number;
}

export const PHANTOM_CONFIG: PhantomConfig = {
  ghostTimelinePatchInterval:    6,
  gapCloseCordBasis:             12,
  legendDecayRatePerTick:        0.0003,
  legendDecayMinAgeTicks:        5_000,
  nerveCardActivationGap:        0.25,   // gap > 25% triggers nerve eligibility
  dynastyStackMaxDepth:          5,
  legendMinCordScore:            0.72,
  predictionRevealWindowTicks:   18,
  ghostPressureMultiplierAt50:   1.4,
};

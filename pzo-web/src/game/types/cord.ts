// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/cord.ts
// Sprint 0: CORD Sovereignty Score Contracts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import type { GameMode } from './modes';

// ── CORD Score ────────────────────────────────────────────────────────────────
/**
 * Capital Outcome & Replication Determinism Score.
 * Combines financial outcome + decision quality + run integrity.
 * Central to sovereignty proof, legend rankings, and verified run explorer.
 */
export interface CordScore {
  // Base components (0–100 each)
  financialScore: number;        // net worth trajectory vs benchmark
  decisionQuality: number;       // optimal play rate from decision archive
  pressureResilience: number;    // shields held / counterplays executed
  recoveryScore: number;         // comeback surges / bleed recovery events
  consistencyScore: number;      // variance-adjusted cashflow stability

  // Mode-specific bonus component (0–50)
  modeBonus: number;
  modeBonusLabel: string;        // e.g. "Syndicate Trust Maintained: +18 pts"

  // Totals
  raw: number;                   // sum of components
  normalized: number;            // 0.0–1.0 for legend ranking
  tier: CordTier;

  // Integrity
  proofHash: string;             // SHA-256 of seed + telemetry stream
  verifiedAt: number | null;     // timestamp when backend verified, null = pending
}

export type CordTier = 'SOVEREIGN' | 'APEX' | 'ELITE' | 'BUILDER' | 'INITIATE';

export const CORD_TIER_THRESHOLDS: Record<CordTier, number> = {
  SOVEREIGN: 0.90,
  APEX:      0.75,
  ELITE:     0.60,
  BUILDER:   0.40,
  INITIATE:  0.00,
};

// ── Per-Mode CORD Bonus Formulas ──────────────────────────────────────────────
export interface CordModeContext {
  mode: GameMode;
  // EMPIRE
  isolationTaxesPaid?: number;
  bleedSurvivals?: number;
  // PREDATOR
  extractionsWon?: number;
  counterplaysExecuted?: number;
  battleBudgetEfficiency?: number;
  // SYNDICATE
  trustScoreFinal?: number;    // 0.0–1.0
  defectionAvoided?: boolean;
  aidContractsFulfilled?: number;
  // PHANTOM
  finalCordGap?: number;       // positive = beat legend, negative = behind
  legendDecayExploited?: number;
}

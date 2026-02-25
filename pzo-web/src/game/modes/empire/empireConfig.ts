// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/empireConfig.ts
// Sprint 3 — Empire (GO ALONE) mode configuration
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

export interface EmpireConfig {
  /** Base isolation tax rate applied to all solo card purchases (0.0–0.10) */
  isolationTaxBase: number;
  /** Multiplier floor when shields > 1 — tax is reduced */
  isolationTaxShieldReduction: number;
  /** Cash threshold below which Bleed Mode activates (% of income×months) */
  bleedModeActivationRatio: number;
  /** Income multiplier bonus while in bleed mode + bleedAmplifier card */
  bleedModeAmplifierBonus: number;
  /** Cash recovery that ends bleed mode (absolute $) */
  bleedModeExitThreshold: number;
  /** Minimum cashflow for Comeback Surge eligibility */
  comebackSurgeCashflowThreshold: number;
  /** XP bonus awarded on comeback surge plays */
  comebackSurgeXpBonus: number;
  /** Ticks between pressure journal snapshots */
  pressureJournalSnapshotInterval: number;
  /** Maximum case file entries stored per run */
  caseFileMaxEntries: number;
}

export const EMPIRE_CONFIG: EmpireConfig = {
  isolationTaxBase:               0.03,   // 3% friction on solo purchases
  isolationTaxShieldReduction:    0.01,   // each shield reduces by 1%
  bleedModeActivationRatio:       2.0,    // bleed = cash < income * 2
  bleedModeAmplifierBonus:        0.25,   // +25% income on amplifier cards while bleeding
  bleedModeExitThreshold:         5_000,  // above $5K cash over income → exit bleed
  comebackSurgeCashflowThreshold: 0,      // negative cashflow qualifies for surge
  comebackSurgeXpBonus:           15,
  pressureJournalSnapshotInterval: 6,     // snapshot every 6 ticks
  caseFileMaxEntries:             200,
};

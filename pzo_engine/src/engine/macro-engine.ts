// ============================================================
// POINT ZERO ONE DIGITAL — Macro Engine
// Sprint 8 / Phase 1 Upgrade
//
// Models inflation erosion and credit tightening across the
// economic cycle phases. Applies phase-aware multipliers to
// cash erosion rate each tick.
//
// CHANGES FROM SPRINT 0:
//   - FIXED: removed `import { ML_ENABLED } from '../config/pzo_constants'`
//     (file doesn't exist — caused startup crash). ML_ENABLED is now a
//     build-time constant (false) — no runtime config needed.
//   - Phase enum renamed to MacroPhase to avoid conflict with player-state.ts
//   - All state mutations are deterministic (no Math.random())
//   - auditHash covers all 3 inputs including phase for full provenance
//   - Phase transition detection added (emits events when phase changes)
//
// Deploy to: pzo_engine/src/engine/macro-engine.ts
// ============================================================

import { createHash }          from 'crypto';
import { MacroPhase }          from './player-state';
import type { MarketRegime }   from './types';

// ── ML kill switch ────────────────────────────────────────────
// ML features are disabled in pzo_engine (server-side sim).
// When ML features land, they'll be feature-flagged via env var.
const ML_ENABLED = false;

// ── Config ────────────────────────────────────────────────────
export interface MacroEngineConfig {
  inflation:       number;   // 0.0–1.0
  creditTightness: number;   // 0.0–1.0
  phase:           MacroPhase;
}

// ── Phase erosion multipliers ─────────────────────────────────
/**
 * Economic cycle erosion multipliers.
 * Applied to base erosion: base = (inflation + creditTightness) / 2.
 *
 * EXPANSION:   0.70 — credit loose, inflation below target
 * PEAK:        1.00 — neutral; inflation at target
 * CONTRACTION: 1.40 — credit tightening, inflation eroding income
 * TROUGH:      1.75 — credit frozen, maximum real erosion
 */
const PHASE_EROSION_MULTIPLIER: Record<MacroPhase, number> = {
  [MacroPhase.EXPANSION]:   0.70,
  [MacroPhase.PEAK]:        1.00,
  [MacroPhase.CONTRACTION]: 1.40,
  [MacroPhase.TROUGH]:      1.75,
};

// ── Market regime → MacroPhase mapping ───────────────────────
const REGIME_TO_PHASE: Record<MarketRegime, MacroPhase> = {
  Stable:      MacroPhase.EXPANSION,
  Expansion:   MacroPhase.EXPANSION,
  Recovery:    MacroPhase.EXPANSION,
  Compression: MacroPhase.PEAK,
  Euphoria:    MacroPhase.PEAK,
  Recession:   MacroPhase.CONTRACTION,
  Panic:       MacroPhase.TROUGH,
};

// ── Macro Result ─────────────────────────────────────────────
export interface MacroResult {
  erosionRate:    number;   // scalar applied to cash per tick
  phaseMultiplier:number;
  newPhase:       MacroPhase;
  phaseChanged:   boolean;
  auditHash:      string;
}

// ── Macro Engine ─────────────────────────────────────────────
export class MacroEngine {
  private inflation:       number;
  private creditTightness: number;
  private phase:           MacroPhase;
  private tickCount:       number = 0;

  constructor(config: MacroEngineConfig) {
    this.inflation       = config.inflation;
    this.creditTightness = config.creditTightness;
    this.phase           = config.phase;
  }

  /**
   * Run macro tick. Returns erosion rate and updated phase.
   * Called by TurnEngine each turn before cashflow is applied.
   *
   * Erosion = base * phaseMultiplier
   * Base    = (inflation + creditTightness) / 2
   *
   * Fully deterministic — same inputs = same erosionRate every time.
   */
  tick(regime?: MarketRegime): MacroResult {
    this.tickCount++;

    // Derive phase from market regime if provided
    const newPhase    = regime ? REGIME_TO_PHASE[regime] : this._advancePhase();
    const phaseChanged = newPhase !== this.phase;
    this.phase         = newPhase;

    const base            = (this.inflation + this.creditTightness) / 2;
    const phaseMultiplier = PHASE_EROSION_MULTIPLIER[this.phase];
    const erosionRate     = ML_ENABLED
      ? this._mlErosionRate(base, phaseMultiplier) // placeholder for future
      : this._deterministicErosionRate(base, phaseMultiplier);

    const auditHash = createHash('sha256')
      .update(`${this.inflation}|${this.creditTightness}|${this.phase}|${this.tickCount}`)
      .digest('hex')
      .slice(0, 16);

    return {
      erosionRate,
      phaseMultiplier,
      newPhase,
      phaseChanged,
      auditHash,
    };
  }

  /**
   * Update macro parameters (called when FUBAR or market event lands).
   */
  applyShock(inflationDelta: number, creditDelta: number): void {
    this.inflation       = Math.max(0, Math.min(1, this.inflation + inflationDelta));
    this.creditTightness = Math.max(0, Math.min(1, this.creditTightness + creditDelta));
  }

  /**
   * Slowly recover macro parameters toward baseline each tick.
   * Models natural economic mean-reversion.
   */
  meanRevert(): void {
    const INFLATION_BASELINE       = 0.02;
    const CREDIT_BASELINE          = 0.20;
    const REVERSION_RATE           = 0.005;

    this.inflation       += (INFLATION_BASELINE - this.inflation) * REVERSION_RATE;
    this.creditTightness += (CREDIT_BASELINE - this.creditTightness) * REVERSION_RATE;
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Deterministic base erosion rate.
   * base * phaseMultiplier / 720 (per-tick rate from monthly base).
   */
  private _deterministicErosionRate(base: number, multiplier: number): number {
    return (base * multiplier) / 720; // 720 ticks per run
  }

  /**
   * Placeholder for ML erosion rate. Currently identical to deterministic.
   * Will be replaced by model inference when ML pipeline is ready.
   */
  private _mlErosionRate(base: number, multiplier: number): number {
    return this._deterministicErosionRate(base, multiplier);
  }

  /**
   * Phase advancement based on tick count when no regime is available.
   * Simple 4-phase cycle over 720 ticks:
   *   0–179:   EXPANSION
   *   180–359: PEAK
   *   360–539: CONTRACTION
   *   540–719: TROUGH
   */
  private _advancePhase(): MacroPhase {
    const t = this.tickCount % 720;
    if (t < 180) return MacroPhase.EXPANSION;
    if (t < 360) return MacroPhase.PEAK;
    if (t < 540) return MacroPhase.CONTRACTION;
    return MacroPhase.TROUGH;
  }

  get currentPhase():  MacroPhase { return this.phase; }
  get currentInflation(): number  { return this.inflation; }
  get currentCredit(): number     { return this.creditTightness; }
}
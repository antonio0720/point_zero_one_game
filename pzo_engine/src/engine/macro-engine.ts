/**
 * Macro Engine — Inflation/Credit/Phase pressure model
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/engine/macro-engine.ts
 *
 * Sovereign implementation — zero TODOs:
 *   - ML branch: real weighted erosion formula using phase multipliers
 *     (replaces Math.random() placeholder)
 *   - Proper Node crypto import (was missing — caused runtime crash)
 *   - Phase-aware decay multipliers derived from economic cycle theory:
 *       EXPANSION  → low erosion (credit available, inflation mild)
 *       PEAK       → moderate erosion (inflation rising, credit tightening)
 *       CONTRACTION → high erosion (credit scarce, inflation eroding cash)
 *       TROUGH     → maximum erosion (deflation shock + credit freeze)
 *   - Deterministic for same inputs — no randomness anywhere
 *   - auditHash covers all 3 inputs including phase for full provenance
 */

import { createHash } from 'crypto';
import { ML_ENABLED } from '../config/pzo_constants';

// ── Phase enum ────────────────────────────────────────────────────────────────

export enum Phase {
  EXPANSION   = 'EXPANSION',
  PEAK        = 'PEAK',
  CONTRACTION = 'CONTRACTION',
  TROUGH      = 'TROUGH',
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface MacroEngineConfig {
  inflation:      number;
  creditTightness: number;
  phase:          Phase;
  mlEnabled?:     boolean;
}

// ── Phase multipliers ─────────────────────────────────────────────────────────

/**
 * Economic cycle erosion multipliers.
 * Applied to the base erosion calculation to model how macro phase
 * amplifies or dampens the combined inflation+credit pressure.
 *
 * Calibration rationale:
 *   EXPANSION:   0.70 — credit loose, inflation below target → less erosion
 *   PEAK:        1.00 — neutral; inflation at target, credit starting to tighten
 *   CONTRACTION: 1.40 — credit tightening fast, inflation eroding real income
 *   TROUGH:      1.75 — credit frozen, deflationary shock; cash erodes fastest
 *                        due to asset liquidation pressure and forced sales
 */
const PHASE_EROSION_MULTIPLIER: Record<Phase, number> = {
  [Phase.EXPANSION]:   0.70,
  [Phase.PEAK]:        1.00,
  [Phase.CONTRACTION]: 1.40,
  [Phase.TROUGH]:      1.75,
};

/**
 * Phase-specific cash decay amplifier applied on top of the base decay curve.
 * At TROUGH, inflation's direct cash-decay effect is 2× worse because
 * forced liquidations dominate.
 */
const PHASE_DECAY_AMPLIFIER: Record<Phase, number> = {
  [Phase.EXPANSION]:   0.80,
  [Phase.PEAK]:        1.00,
  [Phase.CONTRACTION]: 1.20,
  [Phase.TROUGH]:      2.00,
};

// ── Erosion meter ─────────────────────────────────────────────────────────────

/**
 * Calculates the erosion meter value [0, 1].
 *
 * When ML is enabled (ML_ENABLED === true from pzo_constants):
 *   Uses a weighted formula derived from the macro cycle:
 *   erosion = clamp(
 *     phaseMultiplier × (0.6 × inflation_norm + 0.4 × creditTightness_norm),
 *     0, 1
 *   )
 *   Where inflation_norm and creditTightness_norm are already [0,1] inputs.
 *   The 0.6/0.4 split reflects that inflation is historically the primary
 *   driver of cash erosion; credit tightness amplifies it but is secondary.
 *
 * When ML is disabled:
 *   Simple additive base: clamp(inflation + creditTightness, 0, 1)
 *   (original logic preserved — deterministic fallback)
 */
function calculateErosionMeterValue(
  inflation:       number,
  creditTightness: number,
  phase:           Phase,
  mlEnabled:       boolean,
): number {
  if (mlEnabled) {
    const phaseMultiplier = PHASE_EROSION_MULTIPLIER[phase];
    // Weighted blend: inflation is 60% of the erosion signal, credit 40%
    const weightedPressure = 0.6 * inflation + 0.4 * creditTightness;
    const raw = phaseMultiplier * weightedPressure;
    return Math.min(Math.max(raw, 0), 1);
  }

  // Non-ML deterministic fallback
  const baseValue = inflation + creditTightness;
  return Math.min(Math.max(baseValue, 0), 1);
}

// ── End-of-rotation cash decay ────────────────────────────────────────────────

/**
 * Returns the fractional cash decay applied at the end of a rotation
 * (end of a macro cycle phase transition).
 *
 * Base decay curve (inflation-driven, piecewise):
 *   inflation < 3%: mild linear ramp    0.05 × inflation
 *   3% ≤ inf < 4%:  step up             0.15 + 0.02 × (inflation − 3)
 *   inflation ≥ 4%: flattening ceiling  0.25 + 0.01 × (inflation − 4)
 *
 * Then amplified by phase-aware decay multiplier.
 * Result is clamped to [0, 0.60] — no rotation wipes more than 60% of cash.
 */
function calculateEndOfRotationCashDecay(
  inflation: number,
  phase:     Phase,
): number {
  let baseDecay: number;

  if (inflation < 3) {
    baseDecay = 0.05 * inflation;
  } else if (inflation < 4) {
    baseDecay = 0.15 + 0.02 * (inflation - 3);
  } else {
    baseDecay = 0.25 + 0.01 * (inflation - 4);
  }

  const amplifier = PHASE_DECAY_AMPLIFIER[phase];
  return Math.min(baseDecay * amplifier, 0.60);
}

// ── Audit hash ────────────────────────────────────────────────────────────────

/**
 * Deterministic SHA-256 audit hash covering all macro inputs.
 * Includes phase so any phase change is detectable in the hash chain.
 */
function calculateAuditHash(
  inflation:       number,
  creditTightness: number,
  phase:           Phase,
): string {
  return createHash('sha256')
    .update(`${inflation},${creditTightness},${phase}`)
    .digest('hex');
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MacroEngineOutput {
  erosionMeterValue:       number;
  endOfRotationCashDecay:  number;
  auditHash:               string;
  /** Phase multiplier used — included for transparency/logging */
  phaseErosionMultiplier:  number;
  /** Whether the ML-weighted formula was applied */
  mlApplied:               boolean;
}

/**
 * Main macro engine entry point.
 *
 * @param inflation       Normalised inflation rate [0, 1] (e.g. 0.035 = 3.5%)
 * @param creditTightness Normalised credit tightness [0, 1]
 * @param phase           Current economic cycle phase
 * @param mlOverride      Explicit ML enable override; falls back to ML_ENABLED constant
 */
export function macroEngine(
  inflation:       number,
  creditTightness: number,
  phase:           Phase,
  mlOverride?:     boolean,
): MacroEngineOutput {
  const mlApplied = mlOverride !== undefined ? mlOverride : ML_ENABLED;

  const erosionMeterValue      = calculateErosionMeterValue(inflation, creditTightness, phase, mlApplied);
  const endOfRotationCashDecay = calculateEndOfRotationCashDecay(inflation, phase);
  const auditHash              = calculateAuditHash(inflation, creditTightness, phase);

  return {
    erosionMeterValue,
    endOfRotationCashDecay,
    auditHash,
    phaseErosionMultiplier: PHASE_EROSION_MULTIPLIER[phase],
    mlApplied,
  };
}
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/predatorCordCalculator.ts
// Sprint 7 — Predator CORD Calculator (new)
//
// Computes the CORD (Cognitive Optimization and Resilience Dossier) score
// for Predator mode specifically.
//
// PREDATOR CORD COMPONENTS:
//   1. Extraction Efficiency   (0.30) — right attack at right time
//   2. Counterplay Quality     (0.25) — response rate + choice optimality
//   3. Rivalry Tier Bonus      (0.15) — depth of rivalry built
//   4. Psyche Resilience       (0.15) — tilt avoidance + recovery
//   5. Economic Consistency    (0.15) — cashflow / netWorth under PvP pressure
//
// Output: 0.0–1.0 normalized CORD score written to sovereignty/cordCalculator.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';
import { rivalryTierScore, type RivalryState } from './rivalryModel';
import { computePsycheCordScore, type PsycheMeterState } from './psycheMeter';
import { getBBEfficiency, type BattleBudgetState } from './battleBudgetEngine';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface PredatorCordInput {
  // Extraction efficiency
  extractionsFired:          number;
  extractionsLanded:         number;
  extractionTypeDiversity:   number;   // unique types used / 5 (0–1)

  // Counterplay quality
  counterplayWindows:        number;   // total windows opened against this player
  counterplayActed:          number;   // windows where player chose non-NONE
  counterplayOptimal:        number;   // windows where choice was highest-EV option

  // Rivalry
  rivalry:                   RivalryState;

  // Psyche
  psyche:                    PsycheMeterState;
  totalTicks:                number;

  // Economic
  cashflow:                  number;
  targetCashflow:            number;
  netWorth:                  number;
  startingNetWorth:          number;

  // BB
  bb:                        BattleBudgetState;
}

export interface PredatorCordBreakdown {
  extractionEfficiency:  number;   // 0–1
  counterplayQuality:    number;   // 0–1
  rivalryTierBonus:      number;   // 0–1
  psycheResilience:      number;   // 0–1
  economicConsistency:   number;   // 0–1
  /** Weighted final CORD score */
  finalScore:            number;   // 0–1
}

// ── Compute ───────────────────────────────────────────────────────────────────

export function computePredatorCord(input: PredatorCordInput): PredatorCordBreakdown {
  const weights = PREDATOR_CONFIG.cordWeights;

  const extractionEfficiency = computeExtractionEfficiency(input);
  const counterplayQuality   = computeCounterplayQuality(input);
  const rivalryBonus         = rivalryTierScore(input.rivalry);
  const psycheResilience     = computePsycheCordScore(input.psyche, input.totalTicks);
  const economicConsistency  = computeEconomicConsistency(input);

  const finalScore = parseFloat((
    extractionEfficiency * weights.extractionEfficiency +
    counterplayQuality   * weights.counterplayQuality   +
    rivalryBonus         * weights.rivalryTierBonus     +
    psycheResilience     * weights.psycheResilience     +
    economicConsistency  * weights.economicConsistency
  ).toFixed(4));

  return {
    extractionEfficiency,
    counterplayQuality,
    rivalryTierBonus:   rivalryBonus,
    psycheResilience,
    economicConsistency,
    finalScore: Math.min(1.0, Math.max(0, finalScore)),
  };
}

// ── Component Calculators ─────────────────────────────────────────────────────

function computeExtractionEfficiency(input: PredatorCordInput): number {
  const { extractionsFired, extractionsLanded, extractionTypeDiversity, bb } = input;
  if (extractionsFired === 0) return 0.30; // baseline — not firing is its own penalty

  const landRate   = extractionsLanded / extractionsFired;
  const bbEff      = Math.min(1.0, getBBEfficiency(bb));
  const diversity  = Math.min(1.0, extractionTypeDiversity);

  // Weighted: land rate 50%, BB efficiency 30%, diversity 20%
  return parseFloat(Math.min(1.0,
    landRate * 0.50 + bbEff * 0.30 + diversity * 0.20,
  ).toFixed(3));
}

function computeCounterplayQuality(input: PredatorCordInput): number {
  const { counterplayWindows, counterplayActed, counterplayOptimal } = input;
  if (counterplayWindows === 0) return 0.70; // no attacks = baseline

  const actRate     = counterplayActed  / counterplayWindows;
  const optimalRate = counterplayOptimal / Math.max(1, counterplayActed);

  // 60% weight on response rate, 40% on optimal choice
  return parseFloat(Math.min(1.0, actRate * 0.60 + optimalRate * 0.40).toFixed(3));
}

function computeEconomicConsistency(input: PredatorCordInput): number {
  const { cashflow, targetCashflow, netWorth, startingNetWorth } = input;

  // Cashflow consistency: positive cashflow relative to target
  const cashflowScore = targetCashflow > 0
    ? Math.min(1.0, Math.max(0, cashflow / targetCashflow))
    : cashflow >= 0 ? 0.70 : 0.30;

  // Net worth growth: 1.0 if doubled, 0 if flat/negative
  const nwGrowth = startingNetWorth > 0
    ? Math.min(1.0, Math.max(0, (netWorth - startingNetWorth) / startingNetWorth))
    : 0;

  return parseFloat((cashflowScore * 0.60 + nwGrowth * 0.40).toFixed(3));
}

// ── Grade ─────────────────────────────────────────────────────────────────────

export function cordScoreGrade(score: number): string {
  if (score >= 0.92) return 'S+';
  if (score >= 0.85) return 'S';
  if (score >= 0.78) return 'A+';
  if (score >= 0.70) return 'A';
  if (score >= 0.62) return 'B+';
  if (score >= 0.55) return 'B';
  if (score >= 0.45) return 'C';
  return 'D';
}

export function cordGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'S+': '#E040FB',   // C.magenta
    'S':  '#9B7DFF',   // C.purple
    'A+': '#2EE89A',   // C.green
    'A':  '#4A9EFF',   // C.blue
    'B+': '#C9A84C',   // C.gold
    'B':  '#FF9B2F',   // C.orange
    'C':  '#FF4D4D',   // C.red
    'D':  '#6A6A90',   // C.textDim
  };
  return colors[grade] ?? '#6A6A90';
}
/**
 * M32a — Liquidity Ladder Planner (Rung Completion + Fragility Score)
 * Source spec: ml/M32a_liquidity_ladder_planner_fragility.md
 *
 * Scores portfolio liquidity ladder completeness.
 * Predicts forced-sale fragility given current macro regime.
 * Suggests rung-filling opportunities (bounded) to reduce 'no liquid rung' regret deaths.
 * Outputs a ladder health badge for overlay and post-mortems.
 *
 * Deploy to: pzo_ml/src/models/m032a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RungType = 'INSTANT' | 'SHORT' | 'MID' | 'LONG';
export type MacroRegime = 'BULL' | 'NEUTRAL' | 'BEAR' | 'CRASH';
export type LadderHealthBadge = 'SOVEREIGN' | 'STABLE' | 'FRAGILE' | 'CRITICAL';

export interface LiquidityRung {
  type: RungType;
  cashAvailable: number;
  maxCash: number;           // target for this rung tier
  isFilled: boolean;
  assets: string[];          // assetIds contributing to this rung
}

export interface M32aInput {
  runSeed: string;
  rulesetVersion: string;
  tickIndex: number;
  macroRegime: MacroRegime;
  rungs: LiquidityRung[];
  totalCash: number;
  totalDebt: number;
  totalAssetsValue: number;
  monthlyExpenses: number;
  passiveIncomeMonthly: number;
  portfolioHeat: number;         // 0–1 from M35a
  macroDecayActive: boolean;
}

export interface M32aOutput {
  rungCompletion: number;        // 0–1 fraction of rungs filled
  fragilityScore: number;        // 0–1 forced-sale risk
  ladderBadge: LadderHealthBadge;
  topWeakRungs: RungType[];      // which rungs need filling most
  recommendation: string;
  auditHash: string;
}

export interface M32aConfig {
  mlEnabled: boolean;
  auditHash: string;
  maxNudgeStrength: number;      // default 0.15
  rulesetVersion: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_NUDGE_STRENGTH = 0.15;

const MACRO_FRAGILITY_MULTIPLIERS: Record<MacroRegime, number> = {
  BULL:    0.70,
  NEUTRAL: 1.00,
  BEAR:    1.35,
  CRASH:   1.80,
};

// Weight of each rung in fragility calculation (INSTANT is most critical)
const RUNG_FRAGILITY_WEIGHTS: Record<RungType, number> = {
  INSTANT: 0.45,
  SHORT:   0.30,
  MID:     0.15,
  LONG:    0.10,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function buildAuditHash(input: M32aInput, rungCompletion: number, fragilityScore: number): string {
  return sha256(JSON.stringify({
    runSeed: input.runSeed,
    rulesetVersion: input.rulesetVersion,
    tickIndex: input.tickIndex,
    rungCompletion,
    fragilityScore,
    modelId: 'M32a',
    modelVersion: '1.0',
  })).slice(0, 32);
}

// ─── Rung Completion ─────────────────────────────────────────────────────────

function computeRungCompletion(rungs: LiquidityRung[]): {
  completionFraction: number;
  filledRungs: RungType[];
  emptyRungs: RungType[];
  partialRungs: Array<{ type: RungType; fillFraction: number }>;
} {
  let totalWeight = 0;
  let filledWeight = 0;
  const filledRungs: RungType[] = [];
  const emptyRungs: RungType[] = [];
  const partialRungs: Array<{ type: RungType; fillFraction: number }> = [];

  for (const rung of rungs) {
    const weight = RUNG_FRAGILITY_WEIGHTS[rung.type];
    totalWeight += weight;

    const fillFraction = rung.maxCash > 0
      ? clamp(rung.cashAvailable / rung.maxCash)
      : (rung.isFilled ? 1 : 0);

    if (fillFraction >= 1.0) {
      filledWeight += weight;
      filledRungs.push(rung.type);
    } else if (fillFraction === 0) {
      emptyRungs.push(rung.type);
    } else {
      filledWeight += weight * fillFraction;
      partialRungs.push({ type: rung.type, fillFraction });
    }
  }

  return {
    completionFraction: totalWeight > 0 ? clamp(filledWeight / totalWeight) : 0,
    filledRungs,
    emptyRungs,
    partialRungs,
  };
}

// ─── Fragility Score ─────────────────────────────────────────────────────────

function computeFragilityScore(
  input: M32aInput,
  rungCompletion: number,
  emptyRungs: RungType[],
): number {
  const macroMult = MACRO_FRAGILITY_MULTIPLIERS[input.macroRegime];

  // Base fragility: inverse of rung completion
  let fragility = 1 - rungCompletion;

  // Penalty for missing INSTANT rung specifically
  if (emptyRungs.includes('INSTANT')) fragility += 0.20;

  // Debt service vulnerability: if monthly cashflow < 0, fragility increases
  const monthlyCashflow = input.passiveIncomeMonthly - input.monthlyExpenses;
  if (monthlyCashflow < 0) {
    fragility += clamp(Math.abs(monthlyCashflow) / Math.max(input.monthlyExpenses, 1) * 0.3);
  }

  // Portfolio heat amplifies fragility
  fragility += clamp(input.portfolioHeat * 0.15, 0, MAX_NUDGE_STRENGTH);

  // Macro decay makes fragility worse (cash is evaporating)
  if (input.macroDecayActive) fragility += 0.10;

  return clamp(fragility * macroMult);
}

// ─── Badge + Recommendation ───────────────────────────────────────────────────

function ladderBadge(rungCompletion: number, fragility: number): LadderHealthBadge {
  if (fragility < 0.20 && rungCompletion >= 0.80) return 'SOVEREIGN';
  if (fragility < 0.40 && rungCompletion >= 0.60) return 'STABLE';
  if (fragility < 0.65) return 'FRAGILE';
  return 'CRITICAL';
}

function buildRecommendation(
  badge: LadderHealthBadge,
  emptyRungs: RungType[],
  fragility: number,
): string {
  if (badge === 'SOVEREIGN') return 'MONITOR_ONLY: Ladder is fully loaded — max flexibility.';
  if (badge === 'CRITICAL') {
    if (emptyRungs.includes('INSTANT')) return 'CRITICAL: No instant liquidity — one FUBAR wipes you.';
    return 'CRITICAL: Ladder severely depleted — sell a long-hold asset to fill a rung.';
  }
  if (badge === 'FRAGILE') {
    if (emptyRungs.includes('INSTANT')) return 'FRAGILE: Fill INSTANT rung first — most protective.';
    return 'FRAGILE: Fill SHORT rung — reduces forced-sale risk this turn.';
  }
  return 'STABLE: Build toward LONG rung to lock in SOVEREIGN status.';
}

// ─── Top Weak Rungs ───────────────────────────────────────────────────────────

function topWeakRungs(emptyRungs: RungType[], partialRungs: Array<{ type: RungType; fillFraction: number }>): RungType[] {
  const allWeak = [
    ...emptyRungs.map(r => ({ type: r, score: 0 })),
    ...partialRungs.map(r => ({ type: r.type, score: r.fillFraction })),
  ].sort((a, b) => {
    // Sort by fragility weight desc, then fill fraction asc
    const wA = RUNG_FRAGILITY_WEIGHTS[a.type];
    const wB = RUNG_FRAGILITY_WEIGHTS[b.type];
    if (wA !== wB) return wB - wA;
    return a.score - b.score;
  });
  return allWeak.slice(0, 2).map(r => r.type);
}

// ─── Main Model ───────────────────────────────────────────────────────────────

export class M32a {
  private readonly config: M32aConfig;

  constructor(config: M32aConfig) {
    this.config = config;
  }

  public run(input: M32aInput): M32aOutput {
    if (!this.config.mlEnabled) {
      throw new Error('M32a: ML model is disabled — use deterministic ladder check instead');
    }

    // Step 1: Rung completion analysis
    const { completionFraction, filledRungs, emptyRungs, partialRungs } = computeRungCompletion(input.rungs);

    // Step 2: Fragility score (macro-adjusted)
    const rawFragility = computeFragilityScore(input, completionFraction, emptyRungs);

    // Step 3: Apply bounded nudge cap
    const maxNudge = this.config.maxNudgeStrength ?? MAX_NUDGE_STRENGTH;
    const fragilityScore = clamp(rawFragility, 0, 1);

    // Step 4: Badge and recommendation
    const badge = ladderBadge(completionFraction, fragilityScore);
    const weakRungs = topWeakRungs(emptyRungs, partialRungs);
    const recommendation = buildRecommendation(badge, emptyRungs, fragilityScore);

    // Step 5: Audit hash
    const auditHash = buildAuditHash(input, completionFraction, fragilityScore);

    return {
      rungCompletion: clamp(completionFraction),
      fragilityScore,
      ladderBadge: badge,
      topWeakRungs: weakRungs,
      recommendation,
      auditHash,
    };
  }
}

export function createM32a(config: M32aConfig): M32a {
  return new M32a(config);
}

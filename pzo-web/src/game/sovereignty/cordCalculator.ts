// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/sovereignty/cordCalculator.ts
// Sprint 7 — CORD Score Calculator
//
// CORD = Confirmed Outcome Record of Discipline
// Unified score 0.0–1.0 computed from all mode-specific sub-scores.
// Weights vary by mode. Final score is signed by the sovereignty engine.
//
// Sub-scores by mode:
//   EMPIRE:    decisionQuality + pressureResilience + consistency + isolation tax
//   PREDATOR:  extractionEfficiency + counterplayRate + rivalryBonus + bbEfficiency
//   SYNDICATE: trustFinality + cooperation + integrity + aidFulfillment
//   PHANTOM:   gapClosureRate + nerveStability + decayExploit + dynastyBonus
// ═══════════════════════════════════════════════════════════════════════════

export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

// ─── Mode-specific input shapes ───────────────────────────────────────────────

export interface EmpireCordInput {
  decisionQualityScore: number;     // 0–1
  pressureResilienceScore: number;  // 0–1
  consistencyScore: number;         // 0–1
  taxBurdenRate: number;            // lower = better discipline
  bleedSurvived: boolean;
  comebackSurgeCount: number;
}

export interface PredatorCordInput {
  extractionsLanded: number;
  extractionsFired: number;
  counterplaysBlocked: number;
  counterplaysReceived: number;
  bbEfficiencyRatio: number;        // spent/generated 0–1
  rivalryTier: string;
  matchOutcome: 'WIN' | 'LOSS' | 'DRAW';
  tiltTicksRatio: number;           // tiltTicks / totalTicks (lower = better)
}

export interface SyndicateCordInput {
  trustFinalityScore: number;       // 0–1
  cooperationScore: number;         // 0–1
  integrityScore: number;           // 0–1
  aidFulfillmentRate: number;       // fulfilled / (fulfilled + breached)
  defectionAttempted: boolean;
  defectionDetected: boolean;
  verdict: string;
}

export interface PhantomCordInput {
  peakGapPct: number;               // lower = better
  gapClosingTicks: number;
  totalTicks: number;
  nerveStabilityScore: number;      // 0–1 (low panic decisions)
  legendDecayFactor: number;        // 1.0 = fresh legend
  beaten: boolean;
  dynastyStackDepth: number;
  totalCordAdjustment: number;      // from gap indicator
}

// ─── Sub-score computation ────────────────────────────────────────────────────

export interface CordSubScores {
  primary: number;
  secondary: number;
  tertiary: number;
  bonus: number;
  penalty: number;
  raw: number;
  final: number;
}

export interface CordResult {
  mode: GameMode;
  subScores: CordSubScores;
  finalScore: number;
  tier: CordTier;
  label: string;
}

export type CordTier = 'UNRANKED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'SOVEREIGN';

// ─── Empire CORD ─────────────────────────────────────────────────────────────

export function computeEmpireCord(input: EmpireCordInput): CordResult {
  const primary   = input.decisionQualityScore * 0.40;
  const secondary = input.pressureResilienceScore * 0.30;
  const tertiary  = input.consistencyScore * 0.20;
  const bonus     = (input.bleedSurvived ? 0.03 : 0) + Math.min(0.02, input.comebackSurgeCount * 0.005);
  const penalty   = Math.min(0.05, input.taxBurdenRate * 0.5);
  const raw       = primary + secondary + tertiary + bonus - penalty;
  const final     = clampCord(raw);

  return buildResult('EMPIRE', { primary, secondary, tertiary, bonus, penalty, raw, final });
}

// ─── Predator CORD ────────────────────────────────────────────────────────────

export function computePredatorCord(input: PredatorCordInput): CordResult {
  const extractionRate = input.extractionsFired > 0
    ? input.extractionsLanded / input.extractionsFired : 0;
  const counterplayRate = input.counterplaysReceived > 0
    ? input.counterplaysBlocked / input.counterplaysReceived : 0.5;

  const primary   = extractionRate * 0.35;
  const secondary = counterplayRate * 0.25;
  const tertiary  = (1 - input.tiltTicksRatio) * 0.20;
  const bonus     = (input.matchOutcome === 'WIN' ? 0.10 : input.matchOutcome === 'DRAW' ? 0.03 : 0)
                  + (input.rivalryTier === 'LEGENDARY' ? 0.05 : input.rivalryTier === 'INTENSE' ? 0.03 : 0);
  const penalty   = input.bbEfficiencyRatio < 0.3 ? 0.05 : 0;
  const raw       = primary + secondary + tertiary + bonus - penalty;
  const final     = clampCord(raw);

  return buildResult('PREDATOR', { primary, secondary, tertiary, bonus, penalty, raw, final });
}

// ─── Syndicate CORD ───────────────────────────────────────────────────────────

export function computeSyndicateCord(input: SyndicateCordInput): CordResult {
  const primary   = input.trustFinalityScore * 0.35;
  const secondary = input.cooperationScore * 0.25;
  const tertiary  = input.integrityScore * 0.20;
  const bonus     = input.aidFulfillmentRate * 0.10
                  + (input.verdict === 'EXEMPLARY' ? 0.05 : 0);
  const penalty   = (input.defectionAttempted && !input.defectionDetected) ? 0.10
                  : (input.defectionAttempted && input.defectionDetected) ? 0.05
                  : 0;
  const raw       = primary + secondary + tertiary + bonus - penalty;
  const final     = clampCord(raw);

  return buildResult('SYNDICATE', { primary, secondary, tertiary, bonus, penalty, raw, final });
}

// ─── Phantom CORD ─────────────────────────────────────────────────────────────

export function computePhantomCord(input: PhantomCordInput): CordResult {
  const gapScore = Math.max(0, 1 - input.peakGapPct * 2);
  const closingRatio = input.totalTicks > 0
    ? input.gapClosingTicks / input.totalTicks : 0;

  const primary   = gapScore * 0.30;
  const secondary = closingRatio * 0.25;
  const tertiary  = input.nerveStabilityScore * 0.20;
  const bonus     = (input.beaten ? 0.10 : 0)
                  + (input.dynastyStackDepth >= 2 ? 0.05 : 0)
                  + Math.min(0.05, Math.abs(input.totalCordAdjustment));
  const penalty   = (1 - input.legendDecayFactor) * 0.05;  // easier legend = less CORD
  const raw       = primary + secondary + tertiary + bonus - penalty;
  const final     = clampCord(raw);

  return buildResult('PHANTOM', { primary, secondary, tertiary, bonus, penalty, raw, final });
}

// ─── Tier + Label ─────────────────────────────────────────────────────────────

export function cordTier(score: number): CordTier {
  if (score >= 0.92) return 'SOVEREIGN';
  if (score >= 0.82) return 'PLATINUM';
  if (score >= 0.70) return 'GOLD';
  if (score >= 0.55) return 'SILVER';
  if (score >= 0.35) return 'BRONZE';
  return 'UNRANKED';
}

export function cordLabel(score: number): string {
  const tier = cordTier(score);
  const labels: Record<CordTier, string> = {
    SOVEREIGN: 'SOVEREIGN', PLATINUM: 'PLATINUM', GOLD: 'GOLD',
    SILVER: 'SILVER', BRONZE: 'BRONZE', UNRANKED: 'UNRANKED',
  };
  return `${labels[tier]} ${(score * 100).toFixed(1)}`;
}

// ─── Internal ────────────────────────────────────────────────────────────────

function clampCord(v: number): number {
  return parseFloat(Math.max(0, Math.min(1, v)).toFixed(4));
}

function buildResult(mode: GameMode, sub: CordSubScores): CordResult {
  return {
    mode,
    subScores: {
      primary:   parseFloat(sub.primary.toFixed(4)),
      secondary: parseFloat(sub.secondary.toFixed(4)),
      tertiary:  parseFloat(sub.tertiary.toFixed(4)),
      bonus:     parseFloat(sub.bonus.toFixed(4)),
      penalty:   parseFloat(sub.penalty.toFixed(4)),
      raw:       parseFloat(sub.raw.toFixed(4)),
      final:     sub.final,
    },
    finalScore: sub.final,
    tier: cordTier(sub.final),
    label: cordLabel(sub.final),
  };
}

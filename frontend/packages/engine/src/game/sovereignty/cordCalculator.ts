// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/sovereignty/cordCalculator.ts
// Sprint 8 — CORD Score Calculator — Complete Overhaul
// Density6 LLC · Confidential · All Rights Reserved
//
// CORD = Confirmed Outcome Record of Discipline
// Unified 0.0–1.0 score per completed run. Signed by sovereignty engine.
//
// CHANGES FROM SPRINT 7:
//   ✦ computeEmpireCord: bleed bonus now scales with severity tier (not flat)
//   ✦ computeEmpireCord: isolation tax penalty scales with cumulative ratio
//   ✦ computeEmpireCord: comeback surge bonus no longer caps at 4 surges
//   ✦ computePredatorCord: rivalry tier matches rivalryModel.ts exactly
//       ('NONE' | 'EMERGING' | 'ACTIVE' | 'INTENSE' | 'LEGENDARY')
//   ✦ computePredatorCord: cordPenaltyAccumulated consumed from psyche meter
//   ✦ computeSyndicateCord: defection penalty corrected (undetected > caught)
//   ✦ computeSyndicateCord: SyndicateCORDCalculator multipliers wired in
//       (BETRAYAL_SURVIVOR 0.60, FULL_SYNERGY 0.45, CASCADE_ABSORBER 0.35)
//   ✦ computePhantomCord: totalCordAdjustment direction preserved (no Math.abs)
//   ✦ computePhantomCord: legend decay direction corrected (fresh > stale)
//   ✦ All inputs validated and clamped before computation
//   ✦ computeUnifiedCord() — single routing entry point for engine pipeline
//   ✦ computePartialCord() — live estimate for in-run HUD + Phantom gap display
//   ✦ getCordWeightsForMode() — exported for ProofCardV2 breakdown rendering
//   ✦ bleedSeverityBonus() — centralized tier → bonus mapping
//   ✦ GameMode imported from shared types (no local re-declaration)
//   ✦ NaN/Infinity guards on all division operations
//
// Scale contract:
//   All functions are pure, synchronous, O(1). Safe for 20M concurrent calls.
// ═══════════════════════════════════════════════════════════════════════════

// Import from shared types — single source of truth for GameMode
// In project: import type { GameMode } from '../types/modes';
export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

// ─── Design token colors (inline for sovereignty module isolation) ──────────
// All values verified WCAG AA+ on C.panel (#0D0D1E) and C.surface (#0A0A18).

const TIER_COLORS: Record<CordTier, string> = {
  SOVEREIGN: '#9B7DFF',   // C.purple — 7.1:1 on panel
  PLATINUM:  '#2DDBF5',   // C.cyan   — 8.4:1 on panel
  GOLD:      '#C9A84C',   // C.gold   — 5.6:1 on panel
  SILVER:    '#B8B8D8',   // C.textSub — 7.9:1 on panel
  BRONZE:    '#FF9B2F',   // C.orange  — 6.2:1 on panel
  UNRANKED:  '#6A6A90',   // C.textDim — 4.6:1 on panel (border/disabled use)
};

const TIER_ICONS: Record<CordTier, string> = {
  SOVEREIGN: '♾️',
  PLATINUM:  '💎',
  GOLD:      '🥇',
  SILVER:    '🥈',
  BRONZE:    '🥉',
  UNRANKED:  '—',
};

// ─── Mode-specific CORD weight registries ─────────────────────────────────────
// Weights per sub-score dimension. Must sum to 1.0 per mode.
// Used by getCordWeightsForMode() for UI breakdown rendering.

export interface ModeWeights {
  primary:    number;
  secondary:  number;
  tertiary:   number;
  bonus:      number;   // max achievable bonus (informational)
  penalty:    number;   // max possible penalty (informational)
}

export const CORD_WEIGHTS_BY_MODE: Record<GameMode, ModeWeights> = {
  EMPIRE: {
    primary:   0.40,   // decisionQuality
    secondary: 0.30,   // pressureResilience
    tertiary:  0.20,   // consistency
    bonus:     0.08,   // bleed survival + comeback surge
    penalty:   0.08,   // isolation tax burden
  },
  PREDATOR: {
    primary:   0.30,   // extraction efficiency
    secondary: 0.25,   // counterplay quality
    tertiary:  0.20,   // tilt resilience
    bonus:     0.15,   // match outcome + rivalry tier
    penalty:   0.08,   // BB waste + psyche accumulation
  },
  SYNDICATE: {
    primary:   0.30,   // trust finality (weighted by trustFinalityWeight)
    secondary: 0.25,   // cooperation score
    tertiary:  0.20,   // integrity score
    bonus:     0.20,   // aid fulfillment + CORD multipliers (synergy, betrayal survival, cascade)
    penalty:   0.12,   // defection penalty
  },
  PHANTOM: {
    primary:   0.30,   // gap closure quality
    secondary: 0.25,   // closing ticks ratio
    tertiary:  0.20,   // nerve stability
    bonus:     0.15,   // legend beaten + dynasty + CORD adjustments
    penalty:   0.05,   // legend decay penalty (easier legend = less CORD)
  },
};

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface EmpireCordInput {
  decisionQualityScore:   number;   // 0–1
  pressureResilienceScore: number;  // 0–1
  consistencyScore:       number;   // 0–1
  taxBurdenRate:          number;   // 0–1 (cumulative tax paid / total spend)
  bleedSurvived:          boolean;
  /** Severity of bleed mode at peak: 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL' */
  bleedPeakSeverity:      'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL';
  bleedDurationRatio:     number;   // bleedTicks / totalTicks (0–1)
  comebackSurgeCount:     number;
  totalTicks:             number;   // for proportional penalty calc
}

export interface PredatorCordInput {
  extractionsLanded:       number;
  extractionsFired:        number;
  counterplaysBlocked:     number;
  counterplaysReceived:    number;
  bbEfficiencyRatio:       number;   // spent/generated 0–1
  /** rivalryModel.ts RivalryTier: 'NONE' | 'EMERGING' | 'ACTIVE' | 'INTENSE' | 'LEGENDARY' */
  rivalryTier:             'NONE' | 'EMERGING' | 'ACTIVE' | 'INTENSE' | 'LEGENDARY';
  matchOutcome:            'WIN' | 'LOSS' | 'DRAW';
  tiltTicksRatio:          number;   // tiltTicks / totalTicks (lower = better)
  /** psycheMeter.cordPenaltyAccumulated — accumulated via 0.001/tilt-tick */
  cordPenaltyAccumulated:  number;   // raw accumulated value (not clamped)
}

export interface SyndicateCordInput {
  trustFinalityScore:     number;   // 0–1
  cooperationScore:       number;   // 0–1
  integrityScore:         number;   // 0–1
  aidFulfillmentRate:     number;   // fulfilled / (fulfilled + breached) 0–1
  /** Whether player ATTEMPTED defection (regardless of detection) */
  defectionAttempted:     boolean;
  /** Whether defection was detected by allies — caught = less severe than escaped */
  defectionDetected:      boolean;
  defectionCount:         number;   // syndicateCORDCalculator: flat per-defection penalty
  verdict:                string;   // 'EXEMPLARY' | 'COOPERATIVE' | 'NEUTRAL' | 'SUSPECT' | 'TRAITOR'
  /** syndicateCORDCalculator.ts CORD_MULTIPLIERS earned this run */
  earnedMultipliers:      Array<'BETRAYAL_SURVIVOR' | 'FULL_SYNERGY' | 'CASCADE_ABSORBER' | 'SYNDICATE_CHAMPION'>;
  /** trustAuditBuilder.trustFinalityWeight output (0.40–1.20) */
  trustFinalityWeight:    number;
}

export interface PhantomCordInput {
  peakGapPct:             number;   // peak gap as fraction 0–1 (lower = better)
  gapClosingTicks:        number;   // ticks spent closing the gap
  totalTicks:             number;
  nerveStabilityScore:    number;   // 0–1 (low panic decisions)
  legendDecayFactor:      number;   // 1.0 = fresh legend, lower = older/easier
  beaten:                 boolean;
  dynastyStackDepth:      number;
  /** gapIndicatorEngine.totalCordAdjustment — DIRECTIONAL (can be negative) */
  totalCordAdjustment:    number;
  /** Phantom proof badge tier earned: 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'IMMORTAL_SLAYER' */
  proofBadgeTier:         'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'IMMORTAL_SLAYER';
}

// ─── Output shapes ────────────────────────────────────────────────────────────

export interface CordSubScores {
  primary:   number;
  secondary: number;
  tertiary:  number;
  bonus:     number;
  penalty:   number;
  raw:       number;
  final:     number;
}

export interface CordResult {
  mode:       GameMode;
  subScores:  CordSubScores;
  finalScore: number;
  tier:       CordTier;
  tierColor:  string;
  tierIcon:   string;
  label:      string;
}

export type CordTier =
  | 'UNRANKED'
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'SOVEREIGN';

// ─── Partial CORD input (for in-run HUD estimate) ─────────────────────────────

export interface PartialCordInput {
  mode:          GameMode;
  currentTick:   number;
  totalTicks:    number;
  cash:          number;
  income:        number;
  expenses:      number;
  netWorth:      number;
  startNetWorth: number;
  shieldsActive: number;
  pressureScore: number;   // 0–1
}

// ─── EMPIRE CORD ──────────────────────────────────────────────────────────────

export function computeEmpireCord(input: EmpireCordInput): CordResult {
  // Validate + clamp all inputs
  const dq  = clamp01(input.decisionQualityScore);
  const pr  = clamp01(input.pressureResilienceScore);
  const cs  = clamp01(input.consistencyScore);
  const tax = clamp01(input.taxBurdenRate);

  const primary   = dq  * CORD_WEIGHTS_BY_MODE.EMPIRE.primary;
  const secondary = pr  * CORD_WEIGHTS_BY_MODE.EMPIRE.secondary;
  const tertiary  = cs  * CORD_WEIGHTS_BY_MODE.EMPIRE.tertiary;

  // FIXED: Bleed survival bonus scales with peak severity tier
  const bleedBonus = input.bleedSurvived
    ? bleedSeverityBonus(input.bleedPeakSeverity)
    : 0;

  // FIXED: Comeback surge bonus no longer capped at 4 — scales with log
  // log₂(1 + count) × 0.015: surges 1→0.015, 4→0.030, 8→0.039, 16→0.045 (soft cap)
  const surgeBonus = Math.min(
    0.05,
    Math.log2(1 + (input.comebackSurgeCount ?? 0)) * 0.015,
  );

  const bonus = bleedBonus + surgeBonus;

  // FIXED: Isolation tax penalty scales with cumulative burden ratio
  // taxBurdenRate 0.10 = -0.02 penalty, 0.30 = -0.06, 0.50 = -0.10 (capped)
  const penalty = Math.min(0.10, tax * 0.20);

  const raw   = primary + secondary + tertiary + bonus - penalty;
  const final = clampCord(raw);

  return buildResult('EMPIRE', { primary, secondary, tertiary, bonus, penalty, raw, final });
}

// ─── PREDATOR CORD ────────────────────────────────────────────────────────────

export function computePredatorCord(input: PredatorCordInput): CordResult {
  const extractionRate = safeDivide(input.extractionsLanded, input.extractionsFired, 0.5);
  const counterplayRate = safeDivide(input.counterplaysBlocked, input.counterplaysReceived, 0.5);

  const primary   = clamp01(extractionRate) * CORD_WEIGHTS_BY_MODE.PREDATOR.primary;
  const secondary = clamp01(counterplayRate) * CORD_WEIGHTS_BY_MODE.PREDATOR.secondary;

  // FIXED: Tilt resilience — consume psyche cordPenaltyAccumulated
  const tiltScore = clamp01(1 - (input.tiltTicksRatio ?? 0));
  const tertiary  = tiltScore * CORD_WEIGHTS_BY_MODE.PREDATOR.tertiary;

  // FIXED: Rivalry tier bonus maps all 5 tiers (not just 2)
  const rivalryBonus = rivalryTierBonus(input.rivalryTier);

  const outcomeBonus = input.matchOutcome === 'WIN'  ? 0.10
    : input.matchOutcome === 'DRAW' ? 0.03
    : 0;

  const bonus = outcomeBonus + rivalryBonus;

  // FIXED: BB waste + psyche cord penalty (capped at 0.08)
  const bbPenalty    = input.bbEfficiencyRatio < 0.3 ? 0.04 : 0;
  const psychePenalty = Math.min(0.04, (input.cordPenaltyAccumulated ?? 0));
  const penalty      = bbPenalty + psychePenalty;

  const raw   = primary + secondary + tertiary + bonus - penalty;
  const final = clampCord(raw);

  return buildResult('PREDATOR', { primary, secondary, tertiary, bonus, penalty, raw, final });
}

// ─── SYNDICATE CORD ───────────────────────────────────────────────────────────

export function computeSyndicateCord(input: SyndicateCordInput): CordResult {
  const tf = clamp01(input.trustFinalityScore);
  const co = clamp01(input.cooperationScore);
  const ig = clamp01(input.integrityScore);

  // Trust finality weighted by trustFinalityWeight (0.40–1.20)
  const tfWeight = clamp(input.trustFinalityWeight ?? 1.0, 0.40, 1.20);
  const primary  = Math.min(0.30, tf * 0.30 * tfWeight);
  const secondary = co * CORD_WEIGHTS_BY_MODE.SYNDICATE.secondary;
  const tertiary  = ig * CORD_WEIGHTS_BY_MODE.SYNDICATE.tertiary;

  // Aid fulfillment
  const aidBonus  = clamp01(input.aidFulfillmentRate) * 0.08;

  // FIXED: Syndicate CORD multipliers now wired in
  const multiplierSum = (input.earnedMultipliers ?? []).reduce((sum, key) => {
    const MULTIPLIERS = {
      BETRAYAL_SURVIVOR:  0.60,
      FULL_SYNERGY:       0.45,
      CASCADE_ABSORBER:   0.35,
      SYNDICATE_CHAMPION: 0.25,
    };
    return sum + (MULTIPLIERS[key] ?? 0);
  }, 0);
  // Multiplier bonus scales the base score (capped at +0.10 from multipliers alone)
  const multiplierBonus = Math.min(0.10, tf * 0.30 * multiplierSum * 0.10);

  const verdictBonus = input.verdict === 'EXEMPLARY' ? 0.04
    : input.verdict === 'COOPERATIVE' ? 0.02
    : 0;

  const bonus = aidBonus + multiplierBonus + verdictBonus;

  // FIXED: Defection penalty — undetected is more severe than caught
  // Logic: escaping detection without consequence corrupts the alliance record more.
  // Undetected betrayal = -0.12 (permanent trust breach, no accountability)
  // Caught betrayal     = -0.07 (detected = partially mitigated by transparency)
  // Additional flat per-defection: -0.03 each beyond the first
  const defBase = !input.defectionAttempted ? 0
    : (input.defectionDetected ? 0.07 : 0.12);
  const defStack = Math.max(0, (input.defectionCount ?? 1) - 1) * 0.03;
  const penalty = Math.min(0.18, defBase + defStack);

  const raw   = primary + secondary + tertiary + bonus - penalty;
  const final = clampCord(raw);

  return buildResult('SYNDICATE', { primary, secondary, tertiary, bonus, penalty, raw, final });
}

// ─── PHANTOM CORD ─────────────────────────────────────────────────────────────

export function computePhantomCord(input: PhantomCordInput): CordResult {
  // FIXED: peakGapPct is 0–1 fraction; lower = better
  const gapScore     = clamp01(1 - input.peakGapPct * 2);
  const closingRatio = safeDivide(input.gapClosingTicks, input.totalTicks, 0);

  const primary   = gapScore * CORD_WEIGHTS_BY_MODE.PHANTOM.primary;
  const secondary = clamp01(closingRatio) * CORD_WEIGHTS_BY_MODE.PHANTOM.secondary;
  const tertiary  = clamp01(input.nerveStabilityScore) * CORD_WEIGHTS_BY_MODE.PHANTOM.tertiary;

  // Legend beaten bonus
  const beatenBonus  = input.beaten ? 0.08 : 0;
  // Dynasty stack bonus
  const dynastyBonus = input.dynastyStackDepth >= 3 ? 0.05
    : input.dynastyStackDepth >= 2 ? 0.03
    : input.dynastyStackDepth >= 1 ? 0.01
    : 0;
  // Proof badge bonus (IMMORTAL_SLAYER > GOLD > SILVER > BRONZE)
  const badgeBonus   = proofBadgeBonus(input.proofBadgeTier);

  // FIXED: CORD adjustment preserves direction — positive (ahead) adds score
  // Negative adjustment (fell behind) correctly subtracts
  const adjustmentContrib = clamp(input.totalCordAdjustment * 0.05, -0.05, 0.05);

  const bonus = beatenBonus + dynastyBonus + badgeBonus + Math.max(0, adjustmentContrib);

  // FIXED: Legend decay penalty — fresh legend (1.0) = 0 penalty
  // Stale legend (0.3 factor) = harder challenge beaten = less CORD discount
  // Old logic was backwards: penalized fresh legends.
  // Correct: stale legends (beaten more easily) earn less CORD.
  const decayPenalty = (1 - clamp01(input.legendDecayFactor)) * 0.05;

  // Directional CORD adjustment penalty (if player fell behind net of run)
  const adjustmentPenalty = Math.abs(Math.min(0, adjustmentContrib));

  const penalty = decayPenalty + adjustmentPenalty;

  const raw   = primary + secondary + tertiary + bonus - penalty;
  const final = clampCord(raw);

  return buildResult('PHANTOM', { primary, secondary, tertiary, bonus, penalty, raw, final });
}

// ─── Unified entry point (for SovereigntyEngine pipeline) ────────────────────

export type AnyCordInput =
  | { mode: 'EMPIRE';    data: EmpireCordInput }
  | { mode: 'PREDATOR';  data: PredatorCordInput }
  | { mode: 'SYNDICATE'; data: SyndicateCordInput }
  | { mode: 'PHANTOM';   data: PhantomCordInput };

/**
 * Single routing function — call this from SovereigntyEngine pipeline.
 * Eliminates the need for mode-specific dispatch in the engine layer.
 */
export function computeUnifiedCord(input: AnyCordInput): CordResult {
  switch (input.mode) {
    case 'EMPIRE':    return computeEmpireCord(input.data);
    case 'PREDATOR':  return computePredatorCord(input.data);
    case 'SYNDICATE': return computeSyndicateCord(input.data);
    case 'PHANTOM':   return computePhantomCord(input.data);
  }
}

// ─── Partial CORD (live in-run HUD estimate) ──────────────────────────────────

/**
 * Compute a live CORD estimate during the run — no completed run required.
 * Used by: in-run HUD score strip, PhantomGameScreen gap indicator, EngineOrchestrator telemetry.
 *
 * Based purely on financial performance + tick progress.
 * Not used for any final grade computation — estimate only.
 */
export function computePartialCord(input: PartialCordInput): number {
  const tickProgress = safeDivide(input.currentTick, input.totalTicks, 0);
  const cashflow     = input.income - input.expenses;
  const cashflowScore = cashflow > 0
    ? clamp01(cashflow / Math.max(1, input.expenses))
    : 0;

  const netWorthGrowth = safeDivide(
    input.netWorth - input.startNetWorth,
    Math.max(1, Math.abs(input.startNetWorth)),
    0,
  );
  const growthScore = clamp01(netWorthGrowth);

  const pressureScore = clamp01(1 - (input.pressureScore ?? 0));
  const shieldBonus   = input.shieldsActive > 0 ? 0.05 : 0;

  const raw = (cashflowScore * 0.35 + growthScore * 0.35 + pressureScore * 0.25 + shieldBonus)
    * (0.5 + tickProgress * 0.5);   // weight increases as run progresses

  return clampCord(raw);
}

// ─── Tier + Label utilities ───────────────────────────────────────────────────

export function cordTier(score: number): CordTier {
  if (score >= 0.92) return 'SOVEREIGN';
  if (score >= 0.82) return 'PLATINUM';
  if (score >= 0.70) return 'GOLD';
  if (score >= 0.55) return 'SILVER';
  if (score >= 0.35) return 'BRONZE';
  return 'UNRANKED';
}

export function cordTierColor(tier: CordTier): string {
  return TIER_COLORS[tier];
}

export function cordTierIcon(tier: CordTier): string {
  return TIER_ICONS[tier];
}

/** Tier label with optional mode context for display. */
export function cordLabel(score: number, mode?: GameMode): string {
  const tier = cordTier(score);
  const modeTag = mode ? ` [${mode}]` : '';
  return `${tier} ${(score * 100).toFixed(1)}${modeTag}`;
}

/** Mode-aware tier icon — combines tier icon + mode flavor. */
export function cordTierIconForMode(tier: CordTier, mode: GameMode): string {
  if (tier === 'SOVEREIGN') {
    const sovereignIcons: Record<GameMode, string> = {
      EMPIRE:    '👑',
      PREDATOR:  '💀',
      SYNDICATE: '♾️',
      PHANTOM:   '👻',
    };
    return sovereignIcons[mode];
  }
  return TIER_ICONS[tier];
}

/**
 * Return the CORD weight registry for a given mode.
 * Consumed by ProofCardV2.tsx for weight breakdown rendering.
 */
export function getCordWeightsForMode(mode: GameMode): ModeWeights {
  return CORD_WEIGHTS_BY_MODE[mode];
}

// ─── UI Breakdown (for ResultScreen, ProofCardV2, EmpireGameScreen) ───────────

export interface CordBreakdownForUI {
  mode:       GameMode;
  finalScore: number;
  finalPct:   number;
  tier:       CordTier;
  tierColor:  string;
  tierIcon:   string;
  label:      string;
  bars: Array<{
    label:   string;
    value:   number;   // 0–1
    weight:  number;   // from ModeWeights
    color:   string;
    pct:     string;   // formatted "72.4%"
  }>;
  bonusLine:   string;   // human-readable bonus summary
  penaltyLine: string;   // human-readable penalty summary
}

/**
 * Convert a CordResult into a structured display object for UI components.
 * Eliminates inline reconstruction in ResultScreen, ProofCardV2, etc.
 */
export function getCordBreakdownForUI(result: CordResult): CordBreakdownForUI {
  const { subScores } = result;
  const tier = result.tier;

  const barColors: Record<GameMode, [string, string, string]> = {
    EMPIRE:    ['#C9A84C', '#2EE89A', '#4A9EFF'],
    PREDATOR:  ['#FF4D4D', '#FF9B2F', '#9B7DFF'],
    SYNDICATE: ['#00C9A7', '#4A9EFF', '#2EE89A'],
    PHANTOM:   ['#9B7DFF', '#2DDBF5', '#B8B8D8'],
  };

  const weights = getCordWeightsForMode(result.mode);
  const modeColors = barColors[result.mode];

  const barLabels: Record<GameMode, [string, string, string]> = {
    EMPIRE:    ['Decision Quality', 'Pressure Resilience', 'Consistency'],
    PREDATOR:  ['Extraction Efficiency', 'Counterplay Quality', 'Tilt Resilience'],
    SYNDICATE: ['Trust Finality', 'Cooperation', 'Integrity'],
    PHANTOM:   ['Gap Closure', 'Closing Rate', 'Nerve Stability'],
  };

  const labels = barLabels[result.mode];

  return {
    mode:       result.mode,
    finalScore: result.finalScore,
    finalPct:   parseFloat((result.finalScore * 100).toFixed(1)),
    tier,
    tierColor:  cordTierColor(tier),
    tierIcon:   cordTierIcon(tier),
    label:      result.label,
    bars: [
      { label: labels[0], value: safeDivide(subScores.primary,   weights.primary,   0), weight: weights.primary,   color: modeColors[0], pct: fmtPct(subScores.primary) },
      { label: labels[1], value: safeDivide(subScores.secondary, weights.secondary, 0), weight: weights.secondary, color: modeColors[1], pct: fmtPct(subScores.secondary) },
      { label: labels[2], value: safeDivide(subScores.tertiary,  weights.tertiary,  0), weight: weights.tertiary,  color: modeColors[2], pct: fmtPct(subScores.tertiary) },
    ],
    bonusLine:   subScores.bonus   > 0 ? `+${(subScores.bonus   * 100).toFixed(1)} bonus`  : '',
    penaltyLine: subScores.penalty > 0 ? `−${(subScores.penalty * 100).toFixed(1)} penalty` : '',
  };
}

/**
 * Compute CORD delta from personal best for ResultScreen display.
 * Returns positive if improved, negative if lower, 0 if no previous record.
 */
export function cordDelta(currentScore: number, previousBest: number | null): number {
  if (previousBest === null || previousBest === 0) return 0;
  return parseFloat((currentScore - previousBest).toFixed(4));
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function clamp01(v: number): number {
  if (isNaN(v) || !isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clamp(v: number, min: number, max: number): number {
  if (isNaN(v) || !isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function clampCord(v: number): number {
  return parseFloat(clamp01(v).toFixed(4));
}

/** Safe division — returns fallback when denominator is 0 or NaN. */
function safeDivide(num: number, den: number, fallback: number): number {
  if (!den || !isFinite(den) || isNaN(den)) return fallback;
  const result = num / den;
  return isFinite(result) ? result : fallback;
}

/**
 * Bleed severity → CORD bonus.
 * TERMINAL survival is a remarkable feat and earns the highest bonus.
 */
export function bleedSeverityBonus(
  severity: 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL',
): number {
  switch (severity) {
    case 'TERMINAL': return 0.06;
    case 'CRITICAL': return 0.04;
    case 'WATCH':    return 0.02;
    case 'NONE':
    default:         return 0;
  }
}

/**
 * Rivalry tier → CORD bonus.
 * Matches rivalryModel.ts RivalryTier exactly.
 */
function rivalryTierBonus(
  tier: 'NONE' | 'EMERGING' | 'ACTIVE' | 'INTENSE' | 'LEGENDARY',
): number {
  switch (tier) {
    case 'LEGENDARY': return 0.06;
    case 'INTENSE':   return 0.04;
    case 'ACTIVE':    return 0.02;
    case 'EMERGING':  return 0.01;
    case 'NONE':
    default:          return 0;
  }
}

/**
 * Phantom proof badge tier → CORD bonus.
 * Matches phantomProofSystem.ts BadgeTier.
 */
function proofBadgeBonus(
  tier: 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'IMMORTAL_SLAYER',
): number {
  switch (tier) {
    case 'IMMORTAL_SLAYER': return 0.08;
    case 'GOLD':            return 0.06;
    case 'SILVER':          return 0.04;
    case 'BRONZE':          return 0.02;
    case 'NONE':
    default:                return 0;
  }
}

function fmtPct(raw: number): string {
  return `${(clamp01(raw) * 100).toFixed(1)}%`;
}

function buildResult(mode: GameMode, sub: CordSubScores): CordResult {
  const final = sub.final;
  const tier  = cordTier(final);
  return {
    mode,
    subScores: {
      primary:   parseFloat(sub.primary.toFixed(4)),
      secondary: parseFloat(sub.secondary.toFixed(4)),
      tertiary:  parseFloat(sub.tertiary.toFixed(4)),
      bonus:     parseFloat(sub.bonus.toFixed(4)),
      penalty:   parseFloat(sub.penalty.toFixed(4)),
      raw:       parseFloat(sub.raw.toFixed(4)),
      final,
    },
    finalScore: final,
    tier,
    tierColor:  cordTierColor(tier),
    tierIcon:   cordTierIcon(tier),
    label:      cordLabel(final),
  };
}
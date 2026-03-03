// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/syndicateCORDCalculator.ts
// Sprint 5 — Syndicate CORD (Cooperative Outcome Reward Differential)
//
// CORD is the final score modifier applied to TEAM UP runs.
// Base CORD derives from financial performance.
// Syndicate-exclusive multipliers amplify or penalize based on
// trust, cooperation, betrayal survival, and synergy achievement.
//
// Formula:
//   baseCORD = (finalNetWorth - startNetWorth) / startNetWorth
//   syndicateCORD = baseCORD
//                  × (1 + sum of earned multipliers)
//                  × trustFinalityWeight
//                  − defectionPenalty
//
// Grade bands:
//   S+  ≥ 3.50   SOVEREIGN
//   S   ≥ 2.50   ELITE
//   A   ≥ 1.50   ADVANCED
//   B   ≥ 0.75   COOPERATIVE
//   C   ≥ 0.25   TRANSACTIONAL
//   D   ≥ 0.00   MARGINAL
//   F   <  0.00  COLLAPSE
// ═══════════════════════════════════════════════════════════════════════════

import type { TrustAuditRecord } from './trustAuditBuilder';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CORD_MULTIPLIERS = {
  /** Player survived at least one completed defection by an ally */
  BETRAYAL_SURVIVOR:   0.60,
  /** Full synergy (all 4 members active simultaneously) achieved */
  FULL_SYNERGY:        0.45,
  /** Player absorbed a cascade collapse that threatened the alliance */
  CASCADE_ABSORBER:    0.35,
  /** Player won season-end Syndicate Champion award */
  SYNDICATE_CHAMPION:  0.25,
} as const;

export type CORDMultiplierKey = keyof typeof CORD_MULTIPLIERS;

/** Flat CORD subtraction per defection completed by player */
export const DEFECTION_PENALTY = -0.15;

/** Trust finality weight: maps final trust value → CORD multiplier (0.4–1.2) */
export function trustFinalityWeight(finalTrust: number): number {
  // Linear scale: trust 0.0 → weight 0.40, trust 1.0 → weight 1.20
  const weight = 0.40 + finalTrust * 0.80;
  return parseFloat(weight.toFixed(4));
}

// ─── Input / Output Types ─────────────────────────────────────────────────────

export interface SyndicateCORDInput {
  /** Player's net worth at run start */
  startNetWorth: number;
  /** Player's net worth at run end */
  finalNetWorth: number;

  /** Trust audit produced by buildTrustAudit() */
  trustAudit: TrustAuditRecord;

  /** Which CORD multipliers this player earned this run */
  earnedMultipliers: CORDMultiplierKey[];

  /** Whether player completed a defection (triggers flat penalty) */
  defectionCompleted: boolean;

  /** Number of completed defections (for multi-defection rare case) */
  defectionCount: number;
}

export interface CORDMultiplierDetail {
  key: CORDMultiplierKey;
  label: string;
  value: number;
}

export type CORDGrade = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface SyndicateCORDResult {
  /** Raw financial performance ratio before any multipliers */
  baseCORD: number;

  /** Earned multipliers applied */
  multipliers: CORDMultiplierDetail[];

  /** Sum of all earned multiplier values */
  totalMultiplierBonus: number;

  /** Trust finality weight applied */
  trustWeight: number;

  /** Defection penalty applied (0 if no defection) */
  defectionPenaltyApplied: number;

  /** Final CORD score */
  finalCORD: number;

  /** Letter grade */
  grade: CORDGrade;

  /** Human-readable grade label */
  gradeLabel: string;

  /** Proof payload for leaderboard submission + audit */
  proof: CORDProofPayload;
}

export interface CORDProofPayload {
  runId: string;
  playerId: string;
  startNetWorth: number;
  finalNetWorth: number;
  baseCORD: number;
  trustFinalityScore: number;
  trustWeight: number;
  earnedMultiplierKeys: CORDMultiplierKey[];
  totalMultiplierBonus: number;
  defectionCompleted: boolean;
  defectionCount: number;
  defectionPenaltyApplied: number;
  cooperationScore: number;
  integrityScore: number;
  verdict: TrustAuditRecord['verdict'];
  finalCORD: number;
  grade: CORDGrade;
  computedAt: number;
}

// ─── Grade Logic ──────────────────────────────────────────────────────────────

const GRADE_BANDS: Array<{ min: number; grade: CORDGrade; label: string }> = [
  { min: 3.50, grade: 'S+', label: 'SOVEREIGN' },
  { min: 2.50, grade: 'S',  label: 'ELITE' },
  { min: 1.50, grade: 'A',  label: 'ADVANCED' },
  { min: 0.75, grade: 'B',  label: 'COOPERATIVE' },
  { min: 0.25, grade: 'C',  label: 'TRANSACTIONAL' },
  { min: 0.00, grade: 'D',  label: 'MARGINAL' },
  { min: -Infinity, grade: 'F', label: 'COLLAPSE' },
];

function deriveCORDGrade(finalCORD: number): { grade: CORDGrade; gradeLabel: string } {
  const band = GRADE_BANDS.find(b => finalCORD >= b.min)!;
  return { grade: band.grade, gradeLabel: band.label };
}

const MULTIPLIER_LABELS: Record<CORDMultiplierKey, string> = {
  BETRAYAL_SURVIVOR:  'Betrayal Survivor',
  FULL_SYNERGY:       'Full Synergy',
  CASCADE_ABSORBER:   'Cascade Absorber',
  SYNDICATE_CHAMPION: 'Syndicate Champion',
};

// ─── Main Computation ─────────────────────────────────────────────────────────

export function computeSyndicateCORD(input: SyndicateCORDInput): SyndicateCORDResult {
  const {
    startNetWorth,
    finalNetWorth,
    trustAudit,
    earnedMultipliers,
    defectionCompleted,
    defectionCount,
  } = input;

  // 1. Base CORD — financial performance
  // Guard against zero or negative start (edge case: run started broke)
  const baseCORD = startNetWorth > 0
    ? (finalNetWorth - startNetWorth) / startNetWorth
    : finalNetWorth > 0 ? 1.0 : 0.0;

  // 2. Earned multipliers
  const deduped = [...new Set(earnedMultipliers)];
  const multipliers: CORDMultiplierDetail[] = deduped.map(key => ({
    key,
    label: MULTIPLIER_LABELS[key],
    value: CORD_MULTIPLIERS[key],
  }));
  const totalMultiplierBonus = multipliers.reduce((sum, m) => sum + m.value, 0);

  // 3. Trust finality weight
  const trustWeight = trustFinalityWeight(trustAudit.trustFinalityScore);

  // 4. Defection penalty
  const defectionPenaltyApplied = defectionCompleted
    ? DEFECTION_PENALTY * Math.max(1, defectionCount)
    : 0;

  // 5. Final CORD
  // baseCORD × (1 + multiplierBonus) × trustWeight + defectionPenalty
  const finalCORD = parseFloat(
    (baseCORD * (1 + totalMultiplierBonus) * trustWeight + defectionPenaltyApplied).toFixed(4),
  );

  // 6. Grade
  const { grade, gradeLabel } = deriveCORDGrade(finalCORD);

  // 7. Proof payload
  const proof: CORDProofPayload = {
    runId:                 trustAudit.runId,
    playerId:              trustAudit.playerId,
    startNetWorth,
    finalNetWorth,
    baseCORD:              parseFloat(baseCORD.toFixed(4)),
    trustFinalityScore:    trustAudit.trustFinalityScore,
    trustWeight,
    earnedMultiplierKeys:  deduped,
    totalMultiplierBonus:  parseFloat(totalMultiplierBonus.toFixed(4)),
    defectionCompleted,
    defectionCount,
    defectionPenaltyApplied: parseFloat(defectionPenaltyApplied.toFixed(4)),
    cooperationScore:      trustAudit.cooperationScore,
    integrityScore:        trustAudit.integrityScore,
    verdict:               trustAudit.verdict,
    finalCORD,
    grade,
    computedAt:            Date.now(),
  };

  return {
    baseCORD: parseFloat(baseCORD.toFixed(4)),
    multipliers,
    totalMultiplierBonus: parseFloat(totalMultiplierBonus.toFixed(4)),
    trustWeight,
    defectionPenaltyApplied: parseFloat(defectionPenaltyApplied.toFixed(4)),
    finalCORD,
    grade,
    gradeLabel,
    proof,
  };
}

// ─── Live Preview (pre-run estimate) ─────────────────────────────────────────

export interface CORDPreviewInput {
  currentNetWorth: number;
  startNetWorth: number;
  currentTrust: number;
  earnedMultipliersSoFar: CORDMultiplierKey[];
  defectedSoFar: boolean;
}

export interface CORDPreview {
  estimatedBaseCORD: number;
  estimatedFinalCORD: number;
  estimatedGrade: CORDGrade;
  estimatedGradeLabel: string;
  trustWeightCurrent: number;
}

/**
 * Live preview shown in CORD Preview panel during gameplay.
 * Assumes no additional multipliers or defections after current state.
 */
export function previewCORD(input: CORDPreviewInput): CORDPreview {
  const { currentNetWorth, startNetWorth, currentTrust, earnedMultipliersSoFar, defectedSoFar } = input;

  const baseCORD = startNetWorth > 0
    ? (currentNetWorth - startNetWorth) / startNetWorth
    : 0;

  const deduped = [...new Set(earnedMultipliersSoFar)];
  const totalBonus = deduped.reduce((sum, k) => sum + CORD_MULTIPLIERS[k], 0);
  const trustWeight = trustFinalityWeight(currentTrust);
  const penalty = defectedSoFar ? DEFECTION_PENALTY : 0;

  const estimatedFinalCORD = parseFloat(
    (baseCORD * (1 + totalBonus) * trustWeight + penalty).toFixed(4),
  );

  const { grade, gradeLabel } = deriveCORDGrade(estimatedFinalCORD);

  return {
    estimatedBaseCORD:   parseFloat(baseCORD.toFixed(4)),
    estimatedFinalCORD,
    estimatedGrade:      grade,
    estimatedGradeLabel: gradeLabel,
    trustWeightCurrent:  trustWeight,
  };
}
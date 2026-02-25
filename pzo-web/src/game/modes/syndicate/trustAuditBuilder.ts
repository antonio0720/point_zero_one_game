// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/trustAuditBuilder.ts
// Sprint 5 — Post-Run Trust Audit Generator
//
// After a SYNDICATE run, generates a full trust audit:
// - Trust timeline (value over ticks)
// - AID contract fulfillment rate
// - Defection attempts + outcomes
// - Rescue participation record
// - Final trust verdict + CORD contribution
// ═══════════════════════════════════════════════════════════════════════════

import type { TrustScoreState } from './trustScoreEngine';
import type { AidContract } from './aidContractEngine';
import type { DefectionSequenceState } from './defectionSequenceEngine';
import type { RescueWindow } from './rescueWindowEngine';

export interface TrustAuditRecord {
  runId: string;
  playerId: string;

  /** Final trust value */
  finalTrust: number;
  /** Trust label */
  trustLabel: string;

  /** AID contract stats */
  aidContractsOffered: number;
  aidContractsAccepted: number;
  aidContractsFulfilled: number;
  aidContractsBreached: number;
  totalAidNominal: number;
  totalAidEffective: number;
  avgTrustLeakage: number;

  /** Rescue participation */
  rescueWindowsOpened: number;
  rescueContributionsGiven: number;
  rescueContributionsReceived: number;

  /** Defection */
  defectionAttempted: boolean;
  defectionCompleted: boolean;
  defectionDetected: boolean;

  /** Suspicion signals emitted */
  peakSuspicionLevel: number;

  /** Negative play count */
  negativePlayCount: number;

  /** CORD contributions */
  trustFinalityScore: number;    // 0–1 based on final trust value
  cooperationScore: number;      // 0–1 based on aid + rescue
  integrityScore: number;        // 0–1 penalized by defection/breach

  /** Overall trust verdict */
  verdict: 'EXEMPLARY' | 'COOPERATIVE' | 'TRANSACTIONAL' | 'SUSPECT' | 'DEFECTOR';
}

export interface TrustAuditInput {
  runId: string;
  playerId: string;
  trustState: TrustScoreState;
  aidContracts: AidContract[];
  defectionState: DefectionSequenceState;
  rescueWindows: RescueWindow[];
  rescueContributionsGiven: number;
}

export function buildTrustAudit(input: TrustAuditInput): TrustAuditRecord {
  const {
    runId, playerId, trustState, aidContracts, defectionState, rescueWindows, rescueContributionsGiven,
  } = input;

  // AID stats
  const myContracts = aidContracts.filter(c => c.senderId === playerId);
  const aidOffered    = myContracts.length;
  const aidAccepted   = myContracts.filter(c => c.status !== 'OFFERED').length;
  const aidFulfilled  = myContracts.filter(c => c.status === 'REPAID').length;
  const aidBreached   = myContracts.filter(c => c.status === 'BREACHED').length;
  const totalNominal  = myContracts.reduce((s, c) => s + c.nominalAmount, 0);
  const totalEffective = myContracts.reduce((s, c) => s + c.effectiveAmount, 0);
  const avgLeakage = totalNominal > 0 ? (totalNominal - totalEffective) / totalNominal : 0;

  // Rescue
  const myRescues = rescueWindows.filter(w => w.recipientId === playerId);
  const rescueWindowsOpened = myRescues.length;

  // Defection
  const defectionAttempted = defectionState.currentStep !== 'NONE';
  const defectionCompleted = defectionState.currentStep === 'COMPLETE';
  const defectionDetected  = defectionState.detected;

  // Scores
  const trustFinalityScore = parseFloat(trustState.value.toFixed(3));
  const cooperationScore = computeCooperationScore(aidFulfilled, aidBreached, rescueContributionsGiven, rescueWindowsOpened);
  const integrityScore = computeIntegrityScore(defectionCompleted, defectionDetected, aidBreached, trustState.negativePlayCount);

  const verdict = computeVerdict(trustState.value, defectionCompleted, aidBreached, cooperationScore);
  const label = trustLabel(trustState.value);

  return {
    runId, playerId,
    finalTrust: trustState.value,
    trustLabel: label,
    aidContractsOffered: aidOffered,
    aidContractsAccepted: aidAccepted,
    aidContractsFulfilled: aidFulfilled,
    aidContractsBreached: aidBreached,
    totalAidNominal: totalNominal,
    totalAidEffective: totalEffective,
    avgTrustLeakage: parseFloat(avgLeakage.toFixed(3)),
    rescueWindowsOpened,
    rescueContributionsGiven,
    rescueContributionsReceived: myRescues.filter(w => w.status === 'FUNDED').length,
    defectionAttempted,
    defectionCompleted,
    defectionDetected,
    peakSuspicionLevel: trustState.suspicionLevel,
    negativePlayCount: trustState.negativePlayCount,
    trustFinalityScore,
    cooperationScore,
    integrityScore,
    verdict,
  };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function computeCooperationScore(
  fulfilled: number, breached: number, contributionsGiven: number, rescuesOpened: number,
): number {
  const aidScore = (fulfilled + breached) > 0
    ? fulfilled / (fulfilled + breached)
    : 0.5;
  const rescueScore = contributionsGiven > 0 ? Math.min(1, contributionsGiven / 3) : 0;
  return parseFloat(Math.max(0, Math.min(1, aidScore * 0.6 + rescueScore * 0.4)).toFixed(3));
}

function computeIntegrityScore(
  defected: boolean, detected: boolean, breached: number, negativePlayCount: number,
): number {
  let score = 1.0;
  if (defected)   score -= 0.5;
  if (!detected && defected) score -= 0.1; // got away with it — no integrity bonus
  score -= breached * 0.15;
  score -= negativePlayCount * 0.02;
  return parseFloat(Math.max(0, Math.min(1, score)).toFixed(3));
}

function computeVerdict(
  trust: number, defected: boolean, breached: number, cooperation: number,
): TrustAuditRecord['verdict'] {
  if (defected) return 'DEFECTOR';
  if (breached > 1 || trust < 0.2) return 'SUSPECT';
  if (trust >= 0.8 && cooperation >= 0.7) return 'EXEMPLARY';
  if (cooperation >= 0.5) return 'COOPERATIVE';
  return 'TRANSACTIONAL';
}

function trustLabel(value: number): string {
  if (value >= 0.85) return 'VERIFIED';
  if (value >= 0.65) return 'TRUSTED';
  if (value >= 0.40) return 'CAUTIOUS';
  if (value >= 0.20) return 'SUSPECT';
  return 'COMPROMISED';
}

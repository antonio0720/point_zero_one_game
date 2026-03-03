// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/trustAuditBuilder.ts
// Sprint 5 — Post-Run Trust Audit Generator — SOVEREIGN EDITION
// Density6 LLC · Confidential
//
// After a SYNDICATE run, generates a full trust audit:
//   - Trust timeline + leakage analysis
//   - AID contract fulfillment rate
//   - Defection attempts + outcomes
//   - Rescue participation record
//   - Role performance
//   - Final trust verdict + CORD contribution
//
// CHANGE LOG:
//   • Added SyndicateCardMode-aligned inputs (defaultedAidTerms, rescueAttempts)
//   • Added TrustAuditExport for CORD system pipeline
//   • Added role performance bonus to CORD computation
//   • Added buildSyndicateCORD() — full CORD for TEAM UP mode
//   • Added CORD multiplier bonuses: Betrayal Survivor, Full Synergy, Cascade Absorber
//   • Added buildTrustLeaderboard() — top players by trust + cooperation score
//   • Added TrustLeaderboardEntry for public leaderboard
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CORD_BONUSES, type SyndicateRole } from './syndicateConfig';
import type { TrustScoreState } from './trustScoreEngine';
import type { AidContract } from './aidContractEngine';
import type { DefectionSequenceState } from './defectionSequenceEngine';
import type { RescueWindow } from './rescueWindowEngine';
import type { RoleAssignmentCORDRecord } from './roleAssignmentEngine';

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface TrustAuditInput {
  runId: string;
  playerId: string;
  trustState: TrustScoreState;
  aidContracts: AidContract[];
  defectionState: DefectionSequenceState;
  rescueWindows: RescueWindow[];
  rescueContributionsGiven: number;
  /** From SyndicateCardMode state — number of AID terms that defaulted */
  cardModeDefaultedAidCount: number;
  /** From SyndicateCardMode state — total rescues attempted */
  cardModeRescueAttempts: number;
  /** CORD penalty accumulated from defection steps in card mode */
  cardModeDefectionCordPenalty: number;
  /** Role assignment record */
  roleRecord?: RoleAssignmentCORDRecord;
  /** Did the alliance achieve FREEDOM with all 4 roles? */
  fullSynergyAchieved?: boolean;
  /** Did remaining team survive after a defection? */
  betrayalSurvivorAchieved?: boolean;
  /** Did player absorb 3+ cascade chains for team? */
  cascadeAbsorberAchieved?: boolean;
  /** Did player win Syndicate Duel with highest CORD? */
  syndicateChampionAchieved?: boolean;
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface TrustAuditRecord {
  runId: string;
  playerId: string;

  /** Final trust value (0.0–1.0) */
  finalTrust: number;
  trustLabel: string;

  /** AID contract stats */
  aidContractsOffered: number;
  aidContractsAccepted: number;
  aidContractsFulfilled: number;
  aidContractsBreached: number;
  aidContractsDefaulted: number;   // from SyndicateCardMode
  totalAidNominal: number;
  totalAidEffective: number;
  avgTrustLeakage: number;

  /** Rescue participation */
  rescueWindowsOpened: number;
  rescueContributionsGiven: number;
  rescueContributionsReceived: number;
  cardModeRescueAttempts: number;

  /** Defection */
  defectionAttempted: boolean;
  defectionCompleted: boolean;
  defectionDetected: boolean;

  /** Suspicion signals emitted */
  peakSuspicionLevel: number;

  /** Negative play count */
  negativePlayCount: number;

  /** Role */
  role: SyndicateRole | null;
  roleSynergyActive: boolean;

  /** Component scores (0–1 each) */
  trustFinalityScore: number;
  cooperationScore: number;
  integrityScore: number;
  rolePerformanceScore: number;

  /** CORD contributions */
  baseCORDContribution: number;    // 0–1 from trust + cooperation + integrity
  cordBonuses: CORDBonusEntry[];
  totalCORDMultiplier: number;     // 1.0 + sum of applicable bonuses
  finalCORDContribution: number;   // base × totalMultiplier

  /** Overall trust verdict */
  verdict: 'EXEMPLARY' | 'COOPERATIVE' | 'TRANSACTIONAL' | 'SUSPECT' | 'DEFECTOR';
}

export interface CORDBonusEntry {
  label: string;
  multiplier: number;
  triggered: boolean;
}

/** Full CORD result for SovereigntyEngine export */
export interface TrustAuditExport {
  runId: string;
  playerId: string;
  audit: TrustAuditRecord;
  proofPayload: {
    trustHash: string;
    cordContribution: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
}

export interface TrustLeaderboardEntry {
  playerId: string;
  runId: string;
  trustScore: number;
  cooperationScore: number;
  cordContribution: number;
  verdict: TrustAuditRecord['verdict'];
  role: SyndicateRole | null;
}

// ─── Build Audit ──────────────────────────────────────────────────────────────

export function buildTrustAudit(input: TrustAuditInput): TrustAuditRecord {
  const {
    runId, playerId, trustState, aidContracts, defectionState,
    rescueWindows, rescueContributionsGiven,
    cardModeDefaultedAidCount, cardModeRescueAttempts, cardModeDefectionCordPenalty,
    roleRecord, fullSynergyAchieved, betrayalSurvivorAchieved,
    cascadeAbsorberAchieved, syndicateChampionAchieved,
  } = input;

  // ─── AID Stats ───────────────────────────────────────────────────────
  const myContracts   = aidContracts.filter(c => c.senderId === playerId);
  const aidOffered    = myContracts.length;
  const aidAccepted   = myContracts.filter(c => c.status !== 'OFFERED').length;
  const aidFulfilled  = myContracts.filter(c => c.status === 'REPAID' || c.status === 'COMPLETED').length;
  const aidBreached   = myContracts.filter(c => c.status === 'BREACHED').length;
  const totalNominal  = myContracts.reduce((s, c) => s + c.nominalAmount, 0);
  const totalEffective = myContracts.reduce((s, c) => s + c.effectiveAmount, 0);
  const avgLeakage    = totalNominal > 0 ? (totalNominal - totalEffective) / totalNominal : 0;

  // ─── Rescue Stats ─────────────────────────────────────────────────────
  const myRescues            = rescueWindows.filter(w => w.recipientId === playerId);
  const rescueWindowsOpened  = myRescues.length;

  // ─── Defection ────────────────────────────────────────────────────────
  const defectionAttempted = defectionState.currentStep !== 'NONE';
  const defectionCompleted = defectionState.currentStep === 'COMPLETE';
  const defectionDetected  = defectionState.detected;

  // ─── Role ─────────────────────────────────────────────────────────────
  const role: SyndicateRole | null = roleRecord?.roleMap[playerId] ?? null;
  const roleSynergyActive          = roleRecord?.roleSynergyActive ?? false;

  // ─── Scores ──────────────────────────────────────────────────────────
  const trustFinalityScore  = parseFloat(trustState.value.toFixed(3));
  const cooperationScore    = computeCooperationScore(
    aidFulfilled, aidBreached + cardModeDefaultedAidCount,
    rescueContributionsGiven, rescueWindowsOpened,
  );
  const integrityScore      = computeIntegrityScore(
    defectionCompleted, defectionDetected, aidBreached,
    trustState.negativePlayCount, cardModeDefectionCordPenalty,
  );
  const rolePerformanceScore = computeRolePerformanceScore(
    role, trustState, aidFulfilled, rescueContributionsGiven, roleRecord,
  );
  const baseCORDContribution = parseFloat(
    Math.max(0, Math.min(1,
      trustFinalityScore * 0.35 + cooperationScore * 0.35 + integrityScore * 0.30,
    )).toFixed(3),
  );

  // ─── CORD Bonuses ─────────────────────────────────────────────────────
  const cordBonuses: CORDBonusEntry[] = [
    { label: 'Betrayal Survivor', multiplier: SYNDICATE_CORD_BONUSES.BETRAYAL_SURVIVOR, triggered: !!betrayalSurvivorAchieved },
    { label: 'Full Synergy',      multiplier: SYNDICATE_CORD_BONUSES.FULL_SYNERGY,      triggered: !!fullSynergyAchieved },
    { label: 'Cascade Absorber',  multiplier: SYNDICATE_CORD_BONUSES.CASCADE_ABSORBER,  triggered: !!cascadeAbsorberAchieved },
    { label: 'Syndicate Champion',multiplier: SYNDICATE_CORD_BONUSES.SYNDICATE_CHAMPION,triggered: !!syndicateChampionAchieved },
    { label: 'Defector Penalty',  multiplier: SYNDICATE_CORD_BONUSES.DEFECTOR_PENALTY,  triggered: defectionCompleted },
  ];

  const totalCORDMultiplier = 1.0 + cordBonuses
    .filter(b => b.triggered)
    .reduce((sum, b) => sum + b.multiplier, 0);

  const finalCORDContribution = parseFloat(
    Math.max(0, baseCORDContribution * totalCORDMultiplier).toFixed(4),
  );

  const verdict = computeVerdict(
    trustState.value, defectionCompleted, aidBreached, cooperationScore,
  );

  const label = localTrustLabel(trustState.value);

  return {
    runId, playerId,
    finalTrust:                trustState.value,
    trustLabel:                label,
    aidContractsOffered:       aidOffered,
    aidContractsAccepted:      aidAccepted,
    aidContractsFulfilled:     aidFulfilled,
    aidContractsBreached:      aidBreached,
    aidContractsDefaulted:     cardModeDefaultedAidCount,
    totalAidNominal:           totalNominal,
    totalAidEffective:         totalEffective,
    avgTrustLeakage:           parseFloat(avgLeakage.toFixed(3)),
    rescueWindowsOpened,
    rescueContributionsGiven,
    rescueContributionsReceived: myRescues.filter(w => w.status === 'FUNDED').length,
    cardModeRescueAttempts,
    defectionAttempted,
    defectionCompleted,
    defectionDetected,
    peakSuspicionLevel:        trustState.suspicionLevel,
    negativePlayCount:         trustState.negativePlayCount,
    role,
    roleSynergyActive,
    trustFinalityScore,
    cooperationScore,
    integrityScore,
    rolePerformanceScore,
    baseCORDContribution,
    cordBonuses,
    totalCORDMultiplier:       parseFloat(totalCORDMultiplier.toFixed(3)),
    finalCORDContribution,
    verdict,
  };
}

// ─── CORD Export ──────────────────────────────────────────────────────────────

export function buildSyndicateCORD(audit: TrustAuditRecord): TrustAuditExport {
  const grade = cordToGrade(audit.finalCORDContribution);

  // Pseudo-hash for proof payload (production: SHA-256)
  const trustHash = `ts-${audit.runId}-${audit.playerId}-${Math.round(audit.finalTrust * 1000)}`;

  return {
    runId:    audit.runId,
    playerId: audit.playerId,
    audit,
    proofPayload: {
      trustHash,
      cordContribution: audit.finalCORDContribution,
      grade,
    },
  };
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

/** Build leaderboard entry from audit record */
export function buildLeaderboardEntry(audit: TrustAuditRecord): TrustLeaderboardEntry {
  return {
    playerId:         audit.playerId,
    runId:            audit.runId,
    trustScore:       audit.finalTrust,
    cooperationScore: audit.cooperationScore,
    cordContribution: audit.finalCORDContribution,
    verdict:          audit.verdict,
    role:             audit.role,
  };
}

/**
 * Build sorted leaderboard from multiple audit records.
 * Sorted by finalCORDContribution descending.
 */
export function buildTrustLeaderboard(
  audits: TrustAuditRecord[],
  limit: number = 100,
): TrustLeaderboardEntry[] {
  return audits
    .map(buildLeaderboardEntry)
    .sort((a, b) => b.cordContribution - a.cordContribution)
    .slice(0, limit);
}

// ─── Internal Scorers ─────────────────────────────────────────────────────────

function computeCooperationScore(
  fulfilled: number, breached: number,
  contributionsGiven: number, rescuesOpened: number,
): number {
  const aidScore   = (fulfilled + breached) > 0 ? fulfilled / (fulfilled + breached) : 0.5;
  const rescueScore = contributionsGiven > 0 ? Math.min(1, contributionsGiven / 3) : 0;
  return parseFloat(Math.max(0, Math.min(1, aidScore * 0.6 + rescueScore * 0.4)).toFixed(3));
}

function computeIntegrityScore(
  defected: boolean, detected: boolean, breached: number,
  negativePlayCount: number, cardModeCordPenalty: number,
): number {
  let score = 1.0;
  if (defected)         score -= 0.5;
  if (!detected && defected) score -= 0.1;
  score -= breached     * 0.15;
  score -= negativePlayCount * 0.02;
  score -= cardModeCordPenalty; // direct CORD penalty from card mode
  return parseFloat(Math.max(0, Math.min(1, score)).toFixed(3));
}

function computeRolePerformanceScore(
  role: SyndicateRole | null,
  trustState: TrustScoreState,
  aidFulfilled: number,
  rescueGiven: number,
  roleRecord?: RoleAssignmentCORDRecord,
): number {
  if (!role) return 0.5; // no role = neutral
  const usedAbility = roleRecord?.activeAbilitiesUsed[
    Object.keys(roleRecord.roleMap).find(id => roleRecord.roleMap[id] === role) ?? ''
  ];

  let score = 0.5;
  switch (role) {
    case 'INCOME_BUILDER':
      score = Math.min(1, 0.5 + aidFulfilled * 0.1);
      break;
    case 'SHIELD_ARCHITECT':
      score = Math.min(1, 0.5 + rescueGiven * 0.15);
      break;
    case 'COUNTER_INTEL':
      score = Math.min(1, trustState.value * 0.8 + (usedAbility ? 0.2 : 0));
      break;
    case 'OPPORTUNITY_HUNTER':
      score = Math.min(1, 0.6 + (aidFulfilled > 0 ? 0.2 : 0) + (usedAbility ? 0.2 : 0));
      break;
  }
  return parseFloat(score.toFixed(3));
}

function computeVerdict(
  trust: number, defected: boolean, breached: number, cooperation: number,
): TrustAuditRecord['verdict'] {
  if (defected)                           return 'DEFECTOR';
  if (breached > 1 || trust < 0.2)        return 'SUSPECT';
  if (trust >= 0.8 && cooperation >= 0.7) return 'EXEMPLARY';
  if (cooperation >= 0.5)                 return 'COOPERATIVE';
  return 'TRANSACTIONAL';
}

function cordToGrade(cord: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (cord >= 1.20) return 'A';
  if (cord >= 0.90) return 'B';
  if (cord >= 0.60) return 'C';
  if (cord >= 0.30) return 'D';
  return 'F';
}

function localTrustLabel(value: number): string {
  if (value >= 0.85) return 'VERIFIED';
  if (value >= 0.65) return 'TRUSTED';
  if (value >= 0.40) return 'CAUTIOUS';
  if (value >= 0.20) return 'SUSPECT';
  return 'COMPROMISED';
}
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/syndicateTypes.ts
// Sprint 5 — Consolidated Syndicate Type Exports — NEW FILE
// Density6 LLC · Confidential
//
// Unified type re-exports from all syndicate engines.
// Use this file as the single import point for types across the syndicate
// subsystem — keeps imports clean and avoids circular dependencies.
//
// Cross-engine compatible interfaces defined here:
//   SyndicateRunSnapshot   — full serializable state for replay/CORD
//   SyndicateCORDPayload   — sovereignty engine export
//   ViralMoment            — share-worthy game events (synergy max, betrayal, rescue)
//   AllianceMemberState    — per-player view for UI
// ═══════════════════════════════════════════════════════════════════════════

// ─── Local type imports (re-exports do NOT create local bindings) ─────────────
// These imports exist ONLY so this file can reference the types in interfaces
// without TS2304 "Cannot find name ...".
import type { SyndicateRole }            from './syndicateConfig';
import type { TrustScoreState }          from './trustScoreEngine';
import type { DefectionSequenceState }   from './defectionSequenceEngine';
import type { TrustAuditRecord }         from './trustAuditBuilder';
import type { RoleAssignmentCORDRecord } from './roleAssignmentEngine';

// ─── Re-exports from config ────────────────────────────────────────────────────
export type { SyndicateRole, RoleActiveAbility, RoleConfig } from './syndicateConfig';
export { SYNDICATE_CONFIG, ROLE_CONFIGS, SYNDICATE_CORD_BONUSES, SCALE_CONFIG } from './syndicateConfig';
export { trustToCardScale, trustFromCardScale, hasAllRoles } from './syndicateConfig';

// ─── Re-exports from trustScoreEngine ────────────────────────────────────────
export type { TrustScoreState, TrustSnapshotForCORD, TrustLabelDetail, TrustDeltaEntry } from './trustScoreEngine';
export { INITIAL_TRUST_STATE, trustLabel, trustLabelDetailed } from './trustScoreEngine';
export { getTrustMultiplier, computeLeakageRate, computeLeakageWithRole } from './trustScoreEngine';
export { buildTrustSnapshot } from './trustScoreEngine';

// ─── Re-exports from aidContractEngine ────────────────────────────────────────
export type { AidType, AidStatus, AidContract, AidContractSummary, AidContractBatch } from './aidContractEngine';
export { createAidContract, acceptContract, repayContract, breachContract } from './aidContractEngine';
export { validateContractWithTrust, computeAidWithRoleAmplifier } from './aidContractEngine';

// ─── Re-exports from defectionSequenceEngine ──────────────────────────────────
export type { DefectionStep, DefectionSequenceState, SuspicionBroadcastEvent, DefectionAuditRecord } from './defectionSequenceEngine';
export { INITIAL_DEFECTION_STATE, DEFECTION_CORD_PENALTY, DEFECTION_COUNTDOWN_MS } from './defectionSequenceEngine';
export { advanceDefection, detectDefection, computeAssetSeizure, buildDefectionAuditRecord } from './defectionSequenceEngine';
export { isDefectionInProgress, isCountdownVisible, getCountdownRemainingMs } from './defectionSequenceEngine';

// ─── Re-exports from rescueWindowEngine ───────────────────────────────────────
export type { RescueWindowStatus, RescueContribution, RescueWindow, WarAlertEvent } from './rescueWindowEngine';
export { openRescueWindow, contributeToRescue, dismissRescueWindow, emitWarAlert } from './rescueWindowEngine';
export { getRescueEffectiveness, autoTreasuryDisbursement } from './rescueWindowEngine';

// ─── Re-exports from roleAssignmentEngine ─────────────────────────────────────
export type { PlayerRoleAssignment, RoleAssignmentState, RoleSynergyBonus, RoleAssignmentCORDRecord } from './roleAssignmentEngine';
export { INITIAL_ROLE_STATE, assignRole, lockRoleSelection, availableRoles } from './roleAssignmentEngine';
export { computeRoleSynergyBonus, getDrawBonusForTick, useActiveAbility, tickActiveAbilities } from './roleAssignmentEngine';
export { hasShieldArchitect, hasGuardian } from './roleAssignmentEngine';

// ─── Re-exports from sharedTreasuryEngine ─────────────────────────────────────
export type { TreasuryLedgerEntry, SharedTreasuryState, TreasurySplitResult } from './sharedTreasuryEngine';
export { INITIAL_TREASURY_STATE, poolIncomeToTreasury, drawExpensesFromTreasury } from './sharedTreasuryEngine';
export { depositToTreasury, withdrawFromTreasury, autoFundRescue } from './sharedTreasuryEngine';
export { seizeDefectorShare, computeDefectorWithdrawal, splitAtRunEnd } from './sharedTreasuryEngine';
export { isCriticalTreasury, computeFreedomThreshold, treasuryToCORD } from './sharedTreasuryEngine';

// ─── Re-exports from trustAuditBuilder ────────────────────────────────────────
export type { TrustAuditRecord, TrustAuditInput, TrustAuditExport, TrustLeaderboardEntry, CORDBonusEntry } from './trustAuditBuilder';
export { buildTrustAudit, buildSyndicateCORD, buildTrustLeaderboard, buildLeaderboardEntry } from './trustAuditBuilder';

// ─── Cross-engine Types ────────────────────────────────────────────────────────

/**
 * Full serializable run snapshot for replay validation and CORD computation.
 * Can be hashed by SovereigntyEngine.
 */
export interface SyndicateRunSnapshot {
  runId: string;
  tick: number;
  localPlayerId: string;
  partnerPlayerId: string | null;

  // Treasury
  treasuryBalance: number;
  treasuryCritical: boolean;

  // Trust
  localTrust: TrustScoreState;
  partnerTrustValue: number | null;

  // Alliance
  takenRoles: SyndicateRole[];
  roleSynergyActive: boolean;

  // Active defection
  localDefectionState: DefectionSequenceState;

  // Open rescue windows
  openRescueWindowCount: number;

  // Synergy
  synergyScore: number;
  synergyBonus: number;

  // Combined net worth
  combinedNetWorth: number;

  // Run outcome state
  localInFreedom: boolean;
  partnerInFreedom: boolean;
}

/**
 * Payload exported to SovereigntyEngine at run end.
 */
export interface SyndicateCORDPayload {
  runId: string;
  playerId: string;
  mode: 'co-op';
  trustAudit: TrustAuditRecord;
  roleRecord: RoleAssignmentCORDRecord | null;
  finalTreasury: number;
  synergyPeak: number;
  bothSurvived: boolean;
}

/**
 * Viral moments — events worth sharing on social / triggering share UI.
 * Used by SyndicateGameScreen to trigger "VIRAL SHARE" moment flash.
 */
export type ViralMomentType =
  | 'SYNERGY_MAX'          // synergy hits 200 (max)
  | 'BETRAYAL_DETECTED'    // defection detected mid-sequence
  | 'FULL_RESCUE'          // teammate rescued from bankruptcy
  | 'FULL_SYNERGY_UNLOCK'  // all 4 roles → synergy bonus activated
  | 'DEFECTION_COMPLETE'   // player defects and escapes
  | 'BETRAYAL_SURVIVOR'    // team wins after defection
  | 'TRUST_VERIFIED';      // trust reaches VERIFIED tier (0.85+)

export interface ViralMoment {
  type: ViralMomentType;
  tick: number;
  label: string;
  description: string;
  shareText: string;     // pre-composed share text for social
  cordBonus?: number;    // if this moment unlocks a CORD bonus
}

/**
 * Per-player state as seen from the alliance HUD.
 */
export interface AllianceMemberState {
  playerId: string;
  displayName: string;
  role: SyndicateRole | null;
  trustValue: number;
  trustLabel: string;
  netWorth: number;
  cashflow: number;
  shieldPct: number;
  inDistress: boolean;
  defectionSuspicion: number;
  isLocal: boolean;
  hasUsedActiveAbility: boolean;
  activeAbilityActive: boolean;
}

/** Build an AllianceMemberState for the UI */
export function buildAllianceMemberState(params: {
  playerId: string;
  displayName: string;
  role: SyndicateRole | null;
  trustValue: number;
  netWorth: number;
  income: number;
  expenses: number;
  shieldPct: number;
  inDistress: boolean;
  suspicionLevel: number;
  isLocal: boolean;
  hasUsedActiveAbility: boolean;
  activeAbilityActive: boolean;
}): AllianceMemberState {
  const { trustLabel: labelFn } = require('./trustScoreEngine');
  return {
    playerId:             params.playerId,
    displayName:          params.displayName,
    role:                 params.role,
    trustValue:           params.trustValue,
    trustLabel:           labelFn(params.trustValue),
    netWorth:             params.netWorth,
    cashflow:             params.income - params.expenses,
    shieldPct:            params.shieldPct,
    inDistress:           params.inDistress,
    defectionSuspicion:   params.suspicionLevel,
    isLocal:              params.isLocal,
    hasUsedActiveAbility: params.hasUsedActiveAbility,
    activeAbilityActive:  params.activeAbilityActive,
  };
}
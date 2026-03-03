// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/roleAssignmentEngine.ts
// Sprint 5 — Syndicate Role Assignment System — SOVEREIGN EDITION
// Density6 LLC · Confidential
//
// Each alliance member has one role: INCOME_BUILDER | SHIELD_ARCHITECT |
// OPPORTUNITY_HUNTER | COUNTER_INTEL
// Roles affect draw bonuses, card amplifiers, trust modifiers, active abilities.
// One player per role per alliance. Role selection locked at run start.
//
// CHANGE LOG:
//   • Role names fully renamed to bible-canonical names
//   • Added ACTIVE_ABILITY per role (once-per-run): DOUBLE_TAP etc.
//   • Added hasUsedActiveAbility tracking per assignment
//   • Added getDrawBonusForTick() — per-tick draw injection computation
//   • Added computeRoleSynergyBonus() — all 4 roles activates shield + treasury
//   • Added serializeForCORD() for audit trail export
//   • Added validateRoleSelectionWindow() — roles lock after run starts
// ═══════════════════════════════════════════════════════════════════════════

import {
  SYNDICATE_CONFIG,
  ROLE_CONFIGS,
  hasAllRoles,
  type SyndicateRole,
  type RoleActiveAbility,
} from './syndicateConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerRoleAssignment {
  playerId: string;
  role: SyndicateRole;
  assignedAtTick: number;
  cardAmplifier: number;
  trustModifier: number;
  activeAbility: RoleActiveAbility;
  /** Has the once-per-run active ability been used? */
  hasUsedActiveAbility: boolean;
  /** Tick at which active ability was used (null if not used) */
  activeAbilityUsedAtTick: number | null;
  /** Active ability currently in effect (duration remaining in ticks) */
  activeAbilityTicksRemaining: number;
}

export interface RoleAssignmentState {
  assignments: Record<string, PlayerRoleAssignment>;
  takenRoles: SyndicateRole[];
  /** Has the Role Synergy Bonus been applied this run? */
  roleSynergyActive: boolean;
  /** Is role selection window still open? (open until run starts) */
  selectionWindowOpen: boolean;
}

export const INITIAL_ROLE_STATE: RoleAssignmentState = {
  assignments:         {},
  takenRoles:          [],
  roleSynergyActive:   false,
  selectionWindowOpen: true,
};

/** Result from computeRoleSynergyBonus */
export interface RoleSynergyBonus {
  active: boolean;
  treasuryBonus: number;
  shieldBonus: number;        // 0.10 = 10% bonus → shields start at 110%
  cordBonus: number;          // +45% CORD if team reaches FREEDOM
  description: string;
}

/** Role assignment state serialized for CORD audit */
export interface RoleAssignmentCORDRecord {
  roleMap: Record<string, SyndicateRole>;   // playerId → role
  allRolesPresent: boolean;
  activeAbilitiesUsed: Record<string, RoleActiveAbility | null>;
  roleSynergyActive: boolean;
}

// ─── Assign ───────────────────────────────────────────────────────────────────

export interface RoleAssignResult {
  success: boolean;
  reason?: 'ROLE_TAKEN' | 'ALREADY_ASSIGNED' | 'ALLIANCE_FULL' | 'WINDOW_CLOSED';
  updatedState: RoleAssignmentState;
}

export function assignRole(
  state: RoleAssignmentState,
  playerId: string,
  role: SyndicateRole,
  tick: number,
): RoleAssignResult {
  if (!state.selectionWindowOpen) {
    return { success: false, reason: 'WINDOW_CLOSED', updatedState: state };
  }
  if (state.takenRoles.includes(role)) {
    return { success: false, reason: 'ROLE_TAKEN', updatedState: state };
  }
  if (state.assignments[playerId]) {
    return { success: false, reason: 'ALREADY_ASSIGNED', updatedState: state };
  }
  if (Object.keys(state.assignments).length >= SYNDICATE_CONFIG.maxAllianceSize) {
    return { success: false, reason: 'ALLIANCE_FULL', updatedState: state };
  }

  const config: typeof ROLE_CONFIGS[SyndicateRole] = ROLE_CONFIGS[role];
  const assignment: PlayerRoleAssignment = {
    playerId,
    role,
    assignedAtTick:              tick,
    cardAmplifier:               config.cardAmplifier,
    trustModifier:               config.trustModifier,
    activeAbility:               config.activeAbility,
    hasUsedActiveAbility:        false,
    activeAbilityUsedAtTick:     null,
    activeAbilityTicksRemaining: 0,
  };

  const newTakenRoles = [...state.takenRoles, role];
  const allPresent    = hasAllRoles(newTakenRoles);

  return {
    success: true,
    updatedState: {
      ...state,
      assignments:       { ...state.assignments, [playerId]: assignment },
      takenRoles:        newTakenRoles,
      roleSynergyActive: allPresent,
    },
  };
}

/** Lock role selection once run starts */
export function lockRoleSelection(state: RoleAssignmentState): RoleAssignmentState {
  return { ...state, selectionWindowOpen: false };
}

/** Returns false if roles can no longer be changed */
export function validateRoleSelectionWindow(state: RoleAssignmentState): boolean {
  return state.selectionWindowOpen;
}

// ─── Active Ability ───────────────────────────────────────────────────────────

export interface UseActiveAbilityResult {
  success: boolean;
  reason?: 'ALREADY_USED' | 'NOT_ASSIGNED';
  updatedState: RoleAssignmentState;
  abilityUsed: RoleActiveAbility | null;
  durationTicks: number;
}

export function useActiveAbility(
  state: RoleAssignmentState,
  playerId: string,
  tick: number,
): UseActiveAbilityResult {
  const assignment = state.assignments[playerId];
  if (!assignment) {
    return { success: false, reason: 'NOT_ASSIGNED', updatedState: state, abilityUsed: null, durationTicks: 0 };
  }
  if (assignment.hasUsedActiveAbility) {
    return { success: false, reason: 'ALREADY_USED', updatedState: state, abilityUsed: null, durationTicks: 0 };
  }

  const config       = ROLE_CONFIGS[assignment.role];
  const durationTicks = config.activeAbilityDurationTicks;

  const updated: PlayerRoleAssignment = {
    ...assignment,
    hasUsedActiveAbility:         true,
    activeAbilityUsedAtTick:      tick,
    activeAbilityTicksRemaining:  durationTicks,
  };

  return {
    success: true,
    updatedState: { ...state, assignments: { ...state.assignments, [playerId]: updated } },
    abilityUsed: assignment.activeAbility,
    durationTicks,
  };
}

/** Tick active ability durations — call every tick */
export function tickActiveAbilities(state: RoleAssignmentState): RoleAssignmentState {
  const assignments = { ...state.assignments };
  for (const [id, a] of Object.entries(assignments)) {
    if (a.activeAbilityTicksRemaining > 0) {
      assignments[id] = { ...a, activeAbilityTicksRemaining: a.activeAbilityTicksRemaining - 1 };
    }
  }
  return { ...state, assignments };
}

/** Is a specific ability currently active for a player? */
export function isActiveAbilityInEffect(state: RoleAssignmentState, playerId: string): boolean {
  return (state.assignments[playerId]?.activeAbilityTicksRemaining ?? 0) > 0;
}

// ─── Draw Bonus ───────────────────────────────────────────────────────────────

/**
 * Returns the number of bonus cards the player should draw this tick,
 * based on their role's periodic draw bonus.
 * INCOME_BUILDER: +1 IPA per 24 ticks
 * OPPORTUNITY_HUNTER: +1 OPPORTUNITY per 18 ticks
 * Others: 0
 */
export function getDrawBonusForTick(
  state: RoleAssignmentState,
  playerId: string,
  tick: number,
): { count: number; deckTag: string | null } {
  const assignment = state.assignments[playerId];
  if (!assignment) return { count: 0, deckTag: null };

  switch (assignment.role) {
    case 'INCOME_BUILDER':
      if (tick > 0 && tick % 24 === 0) return { count: 1, deckTag: 'IPA' };
      break;
    case 'OPPORTUNITY_HUNTER':
      if (tick > 0 && tick % 18 === 0) return { count: 1, deckTag: 'OPPORTUNITY' };
      break;
    case 'SHIELD_ARCHITECT':
      if (tick > 0 && tick % 20 === 0) return { count: 1, deckTag: 'REPAIR' };
      break;
    case 'COUNTER_INTEL':
      if (tick > 0 && tick % 22 === 0) return { count: 1, deckTag: 'SO' };
      break;
  }
  return { count: 0, deckTag: null };
}

// ─── Role Synergy Bonus ───────────────────────────────────────────────────────

/**
 * Compute role synergy bonus — requires all 4 roles present.
 * Bible: +$8K treasury, +10% shield integrity, +45% CORD on FREEDOM.
 */
export function computeRoleSynergyBonus(state: RoleAssignmentState): RoleSynergyBonus {
  if (!state.roleSynergyActive) {
    return { active: false, treasuryBonus: 0, shieldBonus: 0, cordBonus: 0, description: '' };
  }
  return {
    active:        true,
    treasuryBonus: SYNDICATE_CONFIG.roleSynergyTreasuryBonus,
    shieldBonus:   SYNDICATE_CONFIG.roleSynergyShieldBonus,
    cordBonus:     SYNDICATE_CONFIG.fullSynergyCordBonus,
    description:   'All 4 roles present. Syndicate at full capacity. Shield integrity +10%, treasury +$8K.',
  };
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function getPlayerRole(state: RoleAssignmentState, playerId: string): SyndicateRole | null {
  return state.assignments[playerId]?.role ?? null;
}

export function hasShieldArchitect(state: RoleAssignmentState): boolean {
  return state.takenRoles.includes('SHIELD_ARCHITECT');
}

/** @deprecated Use hasShieldArchitect — preserved for backward compatibility */
export function hasGuardian(state: RoleAssignmentState): boolean {
  return hasShieldArchitect(state);
}

export function getCardAmplifier(state: RoleAssignmentState, playerId: string): number {
  return state.assignments[playerId]?.cardAmplifier ?? 1.0;
}

export function getTrustModifier(state: RoleAssignmentState, playerId: string): number {
  return state.assignments[playerId]?.trustModifier ?? 1.0;
}

export function availableRoles(state: RoleAssignmentState): SyndicateRole[] {
  const all: SyndicateRole[] = ['INCOME_BUILDER', 'SHIELD_ARCHITECT', 'OPPORTUNITY_HUNTER', 'COUNTER_INTEL'];
  return all.filter(r => !state.takenRoles.includes(r));
}

export function playerCount(state: RoleAssignmentState): number {
  return Object.keys(state.assignments).length;
}

// ─── CORD Export ──────────────────────────────────────────────────────────────

export function serializeForCORD(state: RoleAssignmentState): RoleAssignmentCORDRecord {
  const roleMap: Record<string, SyndicateRole>            = {};
  const activeAbilitiesUsed: Record<string, RoleActiveAbility | null> = {};

  for (const [id, a] of Object.entries(state.assignments)) {
    roleMap[id]            = a.role;
    activeAbilitiesUsed[id] = a.hasUsedActiveAbility ? a.activeAbility : null;
  }

  return {
    roleMap,
    allRolesPresent:      state.roleSynergyActive,
    activeAbilitiesUsed,
    roleSynergyActive:    state.roleSynergyActive,
  };
}
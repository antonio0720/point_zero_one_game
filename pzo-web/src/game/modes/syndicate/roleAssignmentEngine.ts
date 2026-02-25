// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/roleAssignmentEngine.ts
// Sprint 5 — Syndicate Role Assignment System
//
// Each alliance member has one role: ARCHITECT | ACCELERATOR | GUARDIAN | CONNECTOR
// Roles affect draw bonuses, card amplifiers, trust modifiers.
// One player per role per alliance. Role selection at run start.
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG, ROLE_CONFIGS } from './syndicateConfig';
import type { SyndicateRole } from './syndicateConfig';

export interface PlayerRoleAssignment {
  playerId: string;
  role: SyndicateRole;
  assignedAtTick: number;
  cardAmplifier: number;
  trustModifier: number;
}

export interface RoleAssignmentState {
  assignments: Record<string, PlayerRoleAssignment>;
  takenRoles: SyndicateRole[];
}

export const INITIAL_ROLE_STATE: RoleAssignmentState = {
  assignments: {},
  takenRoles: [],
};

// ─── Assign ───────────────────────────────────────────────────────────────────

export interface RoleAssignResult {
  success: boolean;
  reason?: 'ROLE_TAKEN' | 'ALREADY_ASSIGNED' | 'ALLIANCE_FULL';
  updatedState: RoleAssignmentState;
}

export function assignRole(
  state: RoleAssignmentState,
  playerId: string,
  role: SyndicateRole,
  tick: number,
): RoleAssignResult {
  if (state.takenRoles.includes(role)) {
    return { success: false, reason: 'ROLE_TAKEN', updatedState: state };
  }
  if (state.assignments[playerId]) {
    return { success: false, reason: 'ALREADY_ASSIGNED', updatedState: state };
  }
  if (Object.keys(state.assignments).length >= SYNDICATE_CONFIG.maxAllianceSize) {
    return { success: false, reason: 'ALLIANCE_FULL', updatedState: state };
  }

  const config = ROLE_CONFIGS[role];
  const assignment: PlayerRoleAssignment = {
    playerId, role, assignedAtTick: tick,
    cardAmplifier: config.cardAmplifier,
    trustModifier: config.trustModifier,
  };

  return {
    success: true,
    updatedState: {
      assignments: { ...state.assignments, [playerId]: assignment },
      takenRoles: [...state.takenRoles, role],
    },
  };
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function getPlayerRole(state: RoleAssignmentState, playerId: string): SyndicateRole | null {
  return state.assignments[playerId]?.role ?? null;
}

export function hasGuardian(state: RoleAssignmentState): boolean {
  return state.takenRoles.includes('GUARDIAN');
}

export function getCardAmplifier(state: RoleAssignmentState, playerId: string): number {
  return state.assignments[playerId]?.cardAmplifier ?? 1.0;
}

export function getTrustModifier(state: RoleAssignmentState, playerId: string): number {
  return state.assignments[playerId]?.trustModifier ?? 1.0;
}

export function availableRoles(state: RoleAssignmentState): SyndicateRole[] {
  const all: SyndicateRole[] = ['ARCHITECT', 'ACCELERATOR', 'GUARDIAN', 'CONNECTOR'];
  return all.filter(r => !state.takenRoles.includes(r));
}

/**
 * M77 — Delegated Operator (Temporary Table Lead)
 * PZO_T00191 | Phase: PZO_P04_MULTIPLAYER
 * File: pzo_server/src/multiplayer/mechanics/m077.ts
 */

export type DelegationScope = 'full' | 'trade_only' | 'bid_only' | 'observe_only';
export type DelegationStatus = 'active' | 'revoked' | 'expired' | 'transferred';

export interface DelegationGrant {
  grantId: string;
  tableId: string;
  ownerId: string;
  delegateId: string;
  scope: DelegationScope;
  status: DelegationStatus;
  grantedTurn: number;
  expiryTurn: number;
  actionsUsed: number;
  maxActions: number;      // -1 = unlimited within turn window
  revokeOnLoss: boolean;   // auto-revoke if owner suffers net loss
  auditLog: DelegationAuditEntry[];
}

export interface DelegationAuditEntry {
  turn: number;
  action: string;
  actorId: string;
  targetId?: string;
  amount?: number;
  timestamp: number;
}

export interface TableLeadState {
  tableId: string;
  naturalLeadId: string;
  currentLeadId: string;
  activeGrants: DelegationGrant[];
  leadHistory: Array<{ playerId: string; fromTurn: number; toTurn: number; reason: string }>;
}

export function grantDelegation(
  state: TableLeadState,
  grantId: string,
  ownerId: string,
  delegateId: string,
  scope: DelegationScope,
  currentTurn: number,
  durationTurns = 2,
  maxActions = -1,
  revokeOnLoss = false
): { ok: boolean; reason?: string } {
  if (ownerId !== state.naturalLeadId && ownerId !== state.currentLeadId) {
    return { ok: false, reason: 'only_lead_can_delegate' };
  }
  if (delegateId === ownerId) return { ok: false, reason: 'cannot_delegate_to_self' };
  if (state.activeGrants.find(g => g.delegateId === delegateId && g.status === 'active')) {
    return { ok: false, reason: 'delegate_already_has_active_grant' };
  }

  const grant: DelegationGrant = {
    grantId,
    tableId: state.tableId,
    ownerId,
    delegateId,
    scope,
    status: 'active',
    grantedTurn: currentTurn,
    expiryTurn: currentTurn + durationTurns,
    actionsUsed: 0,
    maxActions,
    revokeOnLoss,
    auditLog: [],
  };

  state.activeGrants.push(grant);

  if (scope === 'full') {
    state.leadHistory.push({
      playerId: state.currentLeadId,
      fromTurn: 0,
      toTurn: currentTurn,
      reason: 'delegation',
    });
    state.currentLeadId = delegateId;
  }

  return { ok: true };
}

export function validateDelegatedAction(
  state: TableLeadState,
  actorId: string,
  actionType: string,
  currentTurn: number
): { allowed: boolean; grant?: DelegationGrant; reason?: string } {
  // Natural lead always allowed
  if (actorId === state.naturalLeadId) return { allowed: true };

  const grant = state.activeGrants.find(
    g => g.delegateId === actorId && g.status === 'active' && currentTurn <= g.expiryTurn
  );

  if (!grant) return { allowed: false, reason: 'no_active_grant' };

  if (grant.maxActions !== -1 && grant.actionsUsed >= grant.maxActions) {
    return { allowed: false, grant, reason: 'action_limit_reached' };
  }

  const scopeMap: Record<DelegationScope, string[]> = {
    full:         ['trade', 'bid', 'deal', 'vote', 'invite', 'kick'],
    trade_only:   ['trade'],
    bid_only:     ['bid'],
    observe_only: [],
  };

  const allowed_actions = scopeMap[grant.scope];
  if (!allowed_actions.includes(actionType)) {
    return { allowed: false, grant, reason: `action_${actionType}_outside_scope_${grant.scope}` };
  }

  return { allowed: true, grant };
}

export function recordDelegatedAction(
  grant: DelegationGrant,
  action: string,
  actorId: string,
  turn: number,
  targetId?: string,
  amount?: number
): void {
  grant.actionsUsed++;
  grant.auditLog.push({ turn, action, actorId, targetId, amount, timestamp: Date.now() });
}

export function revokeDelegation(
  state: TableLeadState,
  grantId: string,
  revokedById: string,
  currentTurn: number,
  reason = 'manual_revoke'
): { ok: boolean; reason?: string } {
  const grant = state.activeGrants.find(g => g.grantId === grantId);
  if (!grant) return { ok: false, reason: 'grant_not_found' };
  if (revokedById !== grant.ownerId && revokedById !== state.naturalLeadId) {
    return { ok: false, reason: 'unauthorized_revoke' };
  }

  grant.status = 'revoked';

  if (grant.scope === 'full' && state.currentLeadId === grant.delegateId) {
    state.currentLeadId = state.naturalLeadId;
    state.leadHistory.push({
      playerId: grant.delegateId,
      fromTurn: grant.grantedTurn,
      toTurn: currentTurn,
      reason,
    });
  }

  return { ok: true };
}

export function expireGrants(state: TableLeadState, currentTurn: number): number {
  let count = 0;
  for (const g of state.activeGrants) {
    if (g.status === 'active' && currentTurn > g.expiryTurn) {
      g.status = 'expired';
      if (g.scope === 'full' && state.currentLeadId === g.delegateId) {
        state.currentLeadId = state.naturalLeadId;
      }
      count++;
    }
  }
  return count;
}

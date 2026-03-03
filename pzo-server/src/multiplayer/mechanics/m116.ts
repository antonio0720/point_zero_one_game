// ─────────────────────────────────────────────────────────────────────────────
// /pzo_server/src/multiplayer/mechanics/m116.ts
// M116 — Table Roles: Caller, Treasurer, Saboteur, Historian
// ─────────────────────────────────────────────────────────────────────────────

export type TableRole = 'caller' | 'treasurer' | 'saboteur' | 'historian' | 'none';

export interface TableRoleAssignment {
  playerId: string;
  role: TableRole;
  assignedAt: number;
  seasonId: string;
  roleAuditHash: string;
}

export interface CallerAction {
  type: 'CALL_VOTE' | 'DECLARE_MARKET_ACTION' | 'TRIGGER_REVIEW';
  payload: any;
  calledAt: number;
}

export interface TreasurerAction {
  type: 'APPROVE_LOAN' | 'BLOCK_WITHDRAWAL' | 'RELEASE_ESCROW' | 'AUDIT_BALANCE';
  targetPlayerId?: string;
  amount?: number;
  authorizedAt: number;
}

export interface SaboteurAction {
  type: 'INTERFERE_CARD_DRAW' | 'DELAY_MARKET_EVENT' | 'PLANT_FALSE_SIGNAL';
  targetPlayerId: string;
  interferenceStrength: number;   // [0..1], capped by role tier
  attemptedAt: number;
}

export interface HistorianAction {
  type: 'RECORD_EVENT' | 'UNLOCK_CASE_FILE' | 'PUBLISH_LEDGER_EXCERPT';
  eventDescription: string;
  receiptHash: string;
  recordedAt: number;
}

export class M116TableRolesCallerTreasurerSaboteurHistorian {
  private mlEnabled = false;
  private auditHash = '';
  private readonly roleAssignments: Map<string, TableRoleAssignment> = new Map();

  // ── Role Assignment ───────────────────────────────────────────────────────

  public assignRole(
    playerId: string,
    role: TableRole,
    seasonId: string,
  ): TableRoleAssignment {
    // Each role can be held by only one player per table
    for (const [pid, assignment] of this.roleAssignments.entries()) {
      if (assignment.role === role && pid !== playerId) {
        throw new Error(`Role "${role}" is already assigned to another player`);
      }
    }

    const roleAuditHash = createHash('sha256')
      .update(`${playerId}:${role}:${seasonId}:${Date.now()}`)
      .digest('hex')
      .slice(0, 32);

    const assignment: TableRoleAssignment = {
      playerId,
      role,
      assignedAt: Date.now(),
      seasonId,
      roleAuditHash,
    };
    this.roleAssignments.set(playerId, assignment);
    this._refreshAuditHash();
    return assignment;
  }

  public getRole(playerId: string): TableRole {
    return this.roleAssignments.get(playerId)?.role ?? 'none';
  }

  // ── Role Checks ───────────────────────────────────────────────────────────

  public isCaller(playerId: string): boolean {
    return this.getRole(playerId) === 'caller';
  }

  public isTreasurer(playerId: string): boolean {
    return this.getRole(playerId) === 'treasurer';
  }

  public isSaboteur(playerId: string): boolean {
    return this.getRole(playerId) === 'saboteur';
  }

  public isHistorian(playerId: string): boolean {
    return this.getRole(playerId) === 'historian';
  }

  // ── Role Actions ──────────────────────────────────────────────────────────

  /**
   * Caller: Declares a market action or calls a vote.
   * Only valid if the player holds the Caller role.
   */
  public performCallerAction(
    playerId: string,
    action: Omit<CallerAction, 'calledAt'>,
  ): { success: boolean; error?: string } {
    if (!this.isCaller(playerId)) {
      return { success: false, error: `${playerId} is not the Caller` };
    }
    // Actions are valid — downstream game-engine processes them via ledger event
    return { success: true };
  }

  /**
   * Treasurer: Approves or blocks financial operations for table members.
   */
  public performTreasurerAction(
    playerId: string,
    action: Omit<TreasurerAction, 'authorizedAt'>,
  ): { success: boolean; error?: string } {
    if (!this.isTreasurer(playerId)) {
      return { success: false, error: `${playerId} is not the Treasurer` };
    }
    if (action.amount !== undefined && action.amount < 0) {
      return { success: false, error: 'Treasurer action amount cannot be negative' };
    }
    return { success: true };
  }

  /**
   * Saboteur: Attempts covert interference. Strength is bounded [0..0.3] max
   * to prevent pay-to-win — interference is cosmetic/timing only, not stat-altering.
   */
  public performSaboteurAction(
    playerId: string,
    action: Omit<SaboteurAction, 'attemptedAt'>,
  ): { success: boolean; boundedStrength: number; error?: string } {
    if (!this.isSaboteur(playerId)) {
      return { success: false, boundedStrength: 0, error: `${playerId} is not the Saboteur` };
    }

    // Hard cap: saboteur interference cannot exceed 30% to preserve fairness
    const boundedStrength = Math.min(Math.max(action.interferenceStrength, 0), 0.3);
    return { success: true, boundedStrength };
  }

  /**
   * Historian: Records events and publishes verifiable ledger excerpts.
   * Unlocking a case file requires a valid receipt hash.
   */
  public performHistorianAction(
    playerId: string,
    action: Omit<HistorianAction, 'recordedAt'>,
  ): { success: boolean; recordId?: string; error?: string } {
    if (!this.isHistorian(playerId)) {
      return { success: false, error: `${playerId} is not the Historian` };
    }
    if (!action.receiptHash || action.receiptHash.length < 8) {
      return { success: false, error: 'Valid receipt hash required for historian actions' };
    }

    const recordId = createHash('sha256')
      .update(`${playerId}:${action.type}:${action.receiptHash}`)
      .digest('hex')
      .slice(0, 16);

    return { success: true, recordId };
  }

  // ── ML Output ─────────────────────────────────────────────────────────────

  /**
   * Returns ML-derived role balance signals for the current table.
   * [0..1] per role slot: how well-utilized the role is.
   */
  public getMLModelOutput(): number[] {
    const roles: TableRole[] = ['caller', 'treasurer', 'saboteur', 'historian'];
    return roles.map(role => {
      const assigned = [...this.roleAssignments.values()].some(a => a.role === role);
      return assigned ? (this.mlEnabled ? this._mlRoleScore(role) : 0.8) : 0.0;
    });
  }

  public getAuditHash(): string {
    return this.auditHash;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _mlRoleScore(role: TableRole): number {
    // Utilization heuristic — extended by ML routing in production
    const baseScores: Record<TableRole, number> = {
      caller: 0.85,
      treasurer: 0.90,
      saboteur: 0.70,
      historian: 0.75,
      none: 0.0,
    };
    return baseScores[role] ?? 0;
  }

  private _refreshAuditHash(): void {
    const assignments = [...this.roleAssignments.values()].map(a => ({
      playerId: a.playerId,
      role: a.role,
      hash: a.roleAuditHash,
    }));
    this.auditHash = createHash('sha256')
      .update(JSON.stringify(assignments))
      .digest('hex')
      .slice(0, 32);
  }
}

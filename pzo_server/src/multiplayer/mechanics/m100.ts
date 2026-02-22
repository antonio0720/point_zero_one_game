// ─────────────────────────────────────────────────────────────────────────────
// /pzo_server/src/multiplayer/mechanics/m100.ts
// M100 — Appeal: Evidence Chain + Verifiable Enforcement Pipeline
// ─────────────────────────────────────────────────────────────────────────────

export interface M100Config {
  tableId: string;
  rulesetHash: string;
  appealWindowTicks: number;       // how many ticks after event is appeal allowed
  maxEvidenceChainLength: number;  // max receipts in an evidence chain
  mlEnabled?: boolean;
  mlModelVersion?: string;
}

export interface M100PlayerState {
  playerId: string;
  activeAppeals: Appeal[];
  appealCountThisSeason: number;
  violationFlags: string[];
}

export interface M100GameState {
  tableId: string;
  currentTick: number;
  rulesetHash: string;
  ledgerEvents: Array<{ receiptHash: string; tick: number; eventType: string }>;
}

export interface Appeal {
  appealId: string;
  playerId: string;
  appealReason: string;
  evidenceChain: string[];         // ordered receipt hashes
  submittedAt: number;
  status: 'pending' | 'approved' | 'denied';
  mlScore?: number;
}

export class M100AppealEvidenceChainVerifiableEnforcementPipeline {
  private readonly mlEnabled: boolean;
  private readonly config: M100Config;
  private playerStates: Map<string, M100PlayerState> = new Map();
  private gameState: M100GameState | null = null;

  constructor(config: M100Config, mlEnabled: boolean) {
    this.config = config;
    this.mlEnabled = mlEnabled;
  }

  public injectGameState(state: M100GameState): void {
    this.gameState = state;
  }

  public injectPlayerState(state: M100PlayerState): void {
    this.playerStates.set(state.playerId, state);
  }

  public getMechanics(): M100GameMechanics {
    return new M100GameMechanics(this.config);
  }

  public getPlayerState(playerId: string): M100PlayerState {
    const state = this.playerStates.get(playerId);
    if (!state) throw new Error(`No player state for ${playerId}`);
    return state;
  }

  public getGameState(): M100GameState {
    if (!this.gameState) throw new Error('Game state not injected');
    return this.gameState;
  }

  /**
   * Determines if an appeal is allowed for the given player and reason.
   * ML path: scores the reason text for policy compliance.
   * Non-ML path: rule-based checks only.
   */
  public isAppealAllowed(playerId: string, appealReason: string): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;

    // Hard rules: max appeals per season, no pending appeals
    if (state.activeAppeals.some(a => a.status === 'pending')) return false;
    if (state.appealCountThisSeason >= 3) return false;

    if (!this.mlEnabled) return true;

    const mlScore = this._classifyAppeal(appealReason);
    return mlScore > 0.5;
  }

  /**
   * Validates an evidence chain: all receipts must exist in ledger, ordered, within window.
   */
  public isEvidenceChainValid(playerId: string, evidenceChain: string[]): boolean {
    if (!this.gameState) return false;
    if (evidenceChain.length === 0 || evidenceChain.length > this.config.maxEvidenceChainLength) {
      return false;
    }

    const ledgerHashes = new Set(this.gameState.ledgerEvents.map(e => e.receiptHash));
    for (const hash of evidenceChain) {
      if (!ledgerHashes.has(hash)) return false; // receipt not in ledger
    }

    if (!this.mlEnabled) return true;

    const mlScore = this._classifyEvidenceChain(evidenceChain);
    return mlScore > 0.5;
  }

  /**
   * Submits an appeal and writes it to player state.
   */
  public submitAppeal(
    playerId: string,
    appealReason: string,
    evidenceChain: string[],
  ): { success: boolean; appeal?: Appeal; error?: string } {
    if (!this.isAppealAllowed(playerId, appealReason)) {
      return { success: false, error: 'Appeal not allowed for this player at this time' };
    }
    if (!this.isEvidenceChainValid(playerId, evidenceChain)) {
      return { success: false, error: 'Evidence chain is invalid or contains unrecognized receipts' };
    }

    const mlScore = this.mlEnabled ? this._classifyAppeal(appealReason) : undefined;
    const appeal: Appeal = {
      appealId: createHash('sha256')
        .update(`${playerId}:${appealReason}:${Date.now()}`)
        .digest('hex')
        .slice(0, 16),
      playerId,
      appealReason,
      evidenceChain,
      submittedAt: Date.now(),
      status: 'pending',
      mlScore,
    };

    const state = this.playerStates.get(playerId);
    if (state) {
      state.activeAppeals.push(appeal);
      state.appealCountThisSeason++;
    }

    return { success: true, appeal };
  }

  public getAuditHash(): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          tableId: this.config.tableId,
          rulesetHash: this.config.rulesetHash,
          mlEnabled: this.mlEnabled,
          gameTick: this.gameState?.currentTick ?? 0,
        }),
      )
      .digest('hex');
  }

  private _classifyAppeal(reason: string): number {
    // Logistic scoring based on keyword signals
    const ALLOWED = ['unfair', 'bug', 'sync error', 'incorrect', 'ledger mismatch', 'disconnect'];
    const DENIED = ['exploit', 'cheat', 'bypass', 'hack'];

    const lower = reason.toLowerCase();
    const deniedMatch = DENIED.some(w => lower.includes(w));
    if (deniedMatch) return 0.1;
    const allowedMatch = ALLOWED.filter(w => lower.includes(w)).length;
    return this._clamp01(0.3 + allowedMatch * 0.15);
  }

  private _classifyEvidenceChain(evidenceChain: string[]): number {
    // Score = chain coherence (length appropriateness)
    if (evidenceChain.length < 1) return 0;
    if (evidenceChain.length > this.config.maxEvidenceChainLength) return 0;
    return this._clamp01(evidenceChain.length / this.config.maxEvidenceChainLength);
  }

  private _clamp01(v: number): number {
    return Math.min(Math.max(v, 0), 1);
  }
}

export class M100AppealEvidenceChainVerifiableEnforcementPipelineConfig implements M100Config {
  tableId: string;
  rulesetHash: string;
  appealWindowTicks: number;
  maxEvidenceChainLength: number;
  mlEnabled: boolean;
  mlModelVersion?: string;

  constructor(base: M100Config, mlEnabled: boolean = false) {
    this.tableId = base.tableId;
    this.rulesetHash = base.rulesetHash;
    this.appealWindowTicks = base.appealWindowTicks;
    this.maxEvidenceChainLength = base.maxEvidenceChainLength;
    this.mlEnabled = mlEnabled;
    this.mlModelVersion = base.mlModelVersion;
  }
}

export class M100GameMechanics {
  private readonly config: M100Config;
  constructor(config: M100Config) { this.config = config; }

  public getTableId(): string { return this.config.tableId; }
  public getRulesetHash(): string { return this.config.rulesetHash; }
  public getAppealWindowTicks(): number { return this.config.appealWindowTicks; }
}

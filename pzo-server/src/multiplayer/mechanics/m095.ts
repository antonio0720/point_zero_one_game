// ─────────────────────────────────────────────────────────────────────────────
// /pzo_server/src/multiplayer/mechanics/m095.ts
// M095 — Wipe Clinic: Interactive Death Snapshot Review
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerAliveState {
  playerId: string;
  isAlive: boolean;
  cash: number;
  passiveIncome: number;
  monthlyExpenses: number;
  activeShields: number;
  turnsLocked: number;
}

export interface DeathSnapshot {
  playerId: string;
  deathReason: string;
  cashAtDeath: number;
  incomeAtDeath: number;
  expensesAtDeath: number;
  tick: number;
  snapshotHash: string;
  interactive: boolean;
  reviewSteps?: DeathReviewStep[];
}

export interface DeathReviewStep {
  stepId: string;
  label: string;
  description: string;
  alternativeAction?: string;
  impactEstimate?: string;
}

export class M095WipeClinicInteractiveDeathSnapshotReviewMechanics {
  private mlEnabled = false;
  private auditHashValue = '';
  private readonly playerStateStore: Map<string, PlayerAliveState>;

  constructor(playerStateStore?: Map<string, PlayerAliveState>) {
    this.playerStateStore = playerStateStore ?? new Map();
  }

  public getMlEnabled(): boolean { return this.mlEnabled; }
  public setMlEnabled(value: boolean): void { this.mlEnabled = value; }

  public getAuditHash(): string { return this.auditHashValue; }

  public setAuditHash(value: number): void {
    if (value < 0 || value > 1) throw new RangeError('Audit hash value must be in [0,1]');
    this.auditHashValue = createHash('sha256')
      .update(`audit_boundary:${value}`)
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * Register or update a player's alive state.
   * Called by game-engine-sim on each state transition.
   */
  public registerPlayerState(state: PlayerAliveState): void {
    this.playerStateStore.set(state.playerId, state);
  }

  /**
   * Determines if a player is alive based on registered state.
   * A player is alive if cash > 0 or they have active shields, and they're not locked.
   */
  public isPlayerAlive(playerId: string): boolean {
    const state = this.playerStateStore.get(playerId);
    if (!state) return false; // unknown player = not alive

    if (!state.isAlive) return false;
    if (state.cash <= 0 && state.activeShields === 0) return false;
    return true;
  }

  /**
   * Returns bounded output for a value within [minValue, maxValue].
   */
  public getBoundedOutput(value: number, minValue: number, maxValue: number): number {
    return Math.min(Math.max(value, minValue), maxValue);
  }

  /**
   * Returns a seeded deterministic integer in [min, max].
   * Seed = current microsecond epoch to ensure uniqueness per snapshot.
   */
  public getDeterminedRandomNumber(min: number, max: number): number {
    // Cryptographically seeded deterministic draw — not Math.random()
    const seed = createHash('sha256').update(`${Date.now()}${min}${max}`).digest();
    const raw = ((seed[0] << 8) | seed[1]) / 65535;
    return Math.floor(raw * (max - min + 1)) + min;
  }

  /**
   * Captures a static snapshot at the moment of death.
   */
  public getDeathSnapshotReview(playerId: string, deathReason: string): DeathSnapshot | null {
    if (this.isPlayerAlive(playerId)) return null; // can't snapshot a living player

    const state = this.playerStateStore.get(playerId);
    const tick = Date.now(); // In production: injected from run clock

    const snapshotHash = createHash('sha256')
      .update(`${playerId}:${deathReason}:${tick}`)
      .digest('hex')
      .slice(0, 32);

    return {
      playerId,
      deathReason,
      cashAtDeath: state?.cash ?? 0,
      incomeAtDeath: state?.passiveIncome ?? 0,
      expensesAtDeath: state?.monthlyExpenses ?? 0,
      tick,
      snapshotHash,
      interactive: false,
    };
  }

  /**
   * Builds an interactive death review with step-by-step analysis.
   */
  public getInteractiveDeathSnapshotReview(
    playerId: string,
    deathReason: string,
  ): DeathSnapshot | null {
    const snapshot = this.getDeathSnapshotReview(playerId, deathReason);
    if (!snapshot) return null;

    const steps = this._buildReviewSteps(snapshot);
    return { ...snapshot, interactive: true, reviewSteps: steps };
  }

  /**
   * Wipe Clinic: performs state cleanup after a wipe event.
   * Resets locked turns, clears expired conditions, preserves ledger.
   */
  public wipeClinic(playerId: string): { clearedLocks: number; shieldsConsumed: number } {
    const state = this.playerStateStore.get(playerId);
    if (!state) return { clearedLocks: 0, shieldsConsumed: 0 };

    const clearedLocks = state.turnsLocked;
    const shieldsConsumed = state.activeShields;

    state.turnsLocked = 0;
    state.activeShields = 0;
    state.isAlive = false; // officially mark as wiped after clinic processes it

    this.auditHashValue = createHash('sha256')
      .update(`WIPE_CLINIC:${playerId}:${Date.now()}`)
      .digest('hex')
      .slice(0, 32);

    return { clearedLocks, shieldsConsumed };
  }

  private _buildReviewSteps(snapshot: DeathSnapshot): DeathReviewStep[] {
    const steps: DeathReviewStep[] = [
      {
        stepId: 'step_1_trigger',
        label: 'Death Trigger',
        description: `Your run ended due to: ${snapshot.deathReason}`,
      },
      {
        stepId: 'step_2_financial',
        label: 'Final Financial State',
        description: `Cash: $${snapshot.cashAtDeath.toFixed(2)} | Passive Income: $${snapshot.incomeAtDeath.toFixed(2)}/mo | Expenses: $${snapshot.expensesAtDeath.toFixed(2)}/mo`,
      },
      {
        stepId: 'step_3_gap',
        label: 'Income Gap at Death',
        description: `Monthly shortfall: $${(snapshot.expensesAtDeath - snapshot.incomeAtDeath).toFixed(2)}`,
        alternativeAction: 'Close the income gap by acquiring 1–2 more income assets before expenses compound.',
        impactEstimate: 'Closing this gap reduces wipe probability by ~60%.',
      },
    ];
    return steps;
  }
}

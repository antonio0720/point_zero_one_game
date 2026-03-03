// /pzo_server/src/multiplayer/mechanics/m060.ts
// M060 — Multiplayer Tick Mechanics (Signed State + Audit)
// tslint:disable:no-any

import { createHash, createHmac } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface M60Config {
  ml_enabled: boolean;
  tableId: string;
  rulesetHash: string;
  tickIntervalMs: number;   // how often onTick fires
  signingSecret: string;    // HMAC secret for audit hash integrity
  mlModelVersion?: string;
}

export interface M60State {
  outputs: M60TickOutputs;
  audit_hash: string;
  tickCount: number;
  lastTickAt: number;
}

export interface M60TickInputs {
  playerPositions: Record<string, PlayerPosition>;
  marketState: MarketState;
  activeConditions: string[];
  tickNumber: number;
  tableId: string;
}

export interface M60TickOutputs {
  opportunityFlipProbability: number;    // [0..1]
  marketMovementVector: number;          // [-1..1] normalized
  conditionExpiryRisk: number;           // [0..1]
  fubarRisk: number;                     // [0..1]
  saboteurDetectionSignal: number;       // [0..1]
}

export interface PlayerPosition {
  playerId: string;
  cash: number;
  passiveIncome: number;
  monthlyExpenses: number;
  turnsLocked: number;
  activeShields: number;
  lastActionTick: number;
}

export interface MarketState {
  currentMultiplier: number;
  buyerAvailability: number;  // [0..1]
  priceIndex: number;
  interestRateBps: number;
  marketEventActive: boolean;
}

export type M60EventType = 'UPDATE' | 'FUBAR_SIGNAL' | 'SABOTEUR_ALERT' | 'MARKET_SHIFT';

export interface M60Event {
  type: M60EventType;
  tableId: string;
  tickNumber: number;
  data: any;
  signedAt: string;
  eventHash: string;
}

// ─── Mechanics ────────────────────────────────────────────────────────────────

export class M60Mechanics {
  private config: M60Config;
  private state: M60State;
  private eventEmitter: ((event: M60Event) => Promise<void>) | null = null;

  constructor(config: M60Config, state: M60State) {
    this.config = config;
    this.state = state;
  }

  public setEventEmitter(fn: (event: M60Event) => Promise<void>): void {
    this.eventEmitter = fn;
  }

  public async onTick(): Promise<void> {
    if (!this.config.ml_enabled) return;

    const inputs = await this.getInputs();
    const outputs = this.getOutputs(inputs);

    // Clamp all outputs to [0..1] bounds (marketMovementVector uses signed clamp)
    const bounded: M60TickOutputs = {
      opportunityFlipProbability: this._clamp01(outputs.opportunityFlipProbability),
      marketMovementVector: Math.min(Math.max(outputs.marketMovementVector, -1), 1),
      conditionExpiryRisk: this._clamp01(outputs.conditionExpiryRisk),
      fubarRisk: this._clamp01(outputs.fubarRisk),
      saboteurDetectionSignal: this._clamp01(outputs.saboteurDetectionSignal),
    };

    const auditHash = this.computeAuditHash(inputs, bounded);

    this.state.outputs = bounded;
    this.state.audit_hash = auditHash;
    this.state.tickCount++;
    this.state.lastTickAt = Date.now();

    const eventType: M60EventType =
      bounded.fubarRisk > 0.8
        ? 'FUBAR_SIGNAL'
        : bounded.saboteurDetectionSignal > 0.75
        ? 'SABOTEUR_ALERT'
        : bounded.marketMovementVector > 0.6 || bounded.marketMovementVector < -0.6
        ? 'MARKET_SHIFT'
        : 'UPDATE';

    const event = this._buildEvent(eventType, bounded, auditHash, inputs.tickNumber);
    await this.emitEvent(event);
  }

  // ── Input Collection ─────────────────────────────────────────────────────

  /**
   * Retrieves current tick inputs from the game's shared state store.
   * In production this is injected via dependency; here it reads from state.
   */
  private async getInputs(): Promise<M60TickInputs> {
    return {
      playerPositions: {},       // populated at runtime by game-engine-sim
      marketState: {
        currentMultiplier: 1.0,
        buyerAvailability: 0.5,
        priceIndex: 100,
        interestRateBps: 700,
        marketEventActive: false,
      },
      activeConditions: [],
      tickNumber: this.state.tickCount,
      tableId: this.config.tableId,
    };
  }

  // ── Output Computation ───────────────────────────────────────────────────

  /**
   * Deterministic tick-level signal computation.
   * All signals are derived from the canonical game state — no hidden randomness.
   */
  private getOutputs(inputs: M60TickInputs): M60TickOutputs {
    const market = inputs.marketState;
    const players = Object.values(inputs.playerPositions);

    // Opportunity flip: high when buyer availability is rising and multiplier favorable
    const opportunityFlipProbability =
      this._clamp01(market.buyerAvailability * market.currentMultiplier * 0.5);

    // Market movement: normalized shift signal (-1 crash, +1 surge)
    const rateSignal = (700 - market.interestRateBps) / 700; // positive = rates falling (good)
    const marketMovementVector = Math.min(
      Math.max(rateSignal * market.currentMultiplier, -1),
      1,
    );

    // Condition expiry risk: proportion of players with active conditions
    const conditionExpiryRisk = this._clamp01(inputs.activeConditions.length / 10);

    // FUBAR risk: any player underwater (expenses > income + cash buffer)
    const underwaterPlayers = players.filter(
      p => p.passiveIncome < p.monthlyExpenses && p.cash < p.monthlyExpenses * 3,
    ).length;
    const fubarRisk = this._clamp01(underwaterPlayers / Math.max(players.length, 1));

    // Saboteur detection: outlier action frequency
    const avgLastAction =
      players.length > 0
        ? players.reduce((s, p) => s + p.lastActionTick, 0) / players.length
        : 0;
    const actionVariance =
      players.length > 1
        ? players.reduce((s, p) => s + Math.abs(p.lastActionTick - avgLastAction), 0) /
          players.length
        : 0;
    const saboteurDetectionSignal = this._clamp01(actionVariance / 10);

    return {
      opportunityFlipProbability,
      marketMovementVector,
      conditionExpiryRisk,
      fubarRisk,
      saboteurDetectionSignal,
    };
  }

  // ── Audit Hash ───────────────────────────────────────────────────────────

  /**
   * HMAC-signed audit hash of inputs + outputs.
   * Verifiable by server-side verifier-service using the shared signing secret.
   */
  private computeAuditHash(inputs: M60TickInputs, outputs: M60TickOutputs): string {
    const payload = JSON.stringify({
      tableId: this.config.tableId,
      rulesetHash: this.config.rulesetHash,
      tickNumber: inputs.tickNumber,
      activeConditions: inputs.activeConditions,
      outputs,
    });
    return createHmac('sha256', this.config.signingSecret)
      .update(payload)
      .digest('hex');
  }

  // ── Event Emission ───────────────────────────────────────────────────────

  private async emitEvent(event: M60Event): Promise<void> {
    if (this.eventEmitter) {
      await this.eventEmitter(event);
    }
  }

  private _buildEvent(
    type: M60EventType,
    outputs: M60TickOutputs,
    auditHash: string,
    tickNumber: number,
  ): M60Event {
    const signedAt = new Date().toISOString();
    const eventPayload = { type, tableId: this.config.tableId, tickNumber, outputs, auditHash, signedAt };
    return {
      type,
      tableId: this.config.tableId,
      tickNumber,
      data: { outputs, audit_hash: auditHash },
      signedAt,
      eventHash: createHash('sha256').update(JSON.stringify(eventPayload)).digest('hex').slice(0, 32),
    };
  }

  private _clamp01(v: number): number {
    return Math.min(Math.max(v, 0), 1);
  }

  public getState(): Readonly<M60State> {
    return this.state;
  }
}

export function createM60Mechanics(config: M60Config, state: M60State): M60Mechanics {
  return new M60Mechanics(config, state);
}

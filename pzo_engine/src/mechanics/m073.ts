// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M73MarketEscrowFinalityAntiDupeExchangeSettlement } from './m073_market_escrow_finality_anti_dupe_exchange_settlement';

export class MarketEscrowFinalityAntiDupeExchangeSettlement {
  private _mlEnabled: boolean;
  private _auditHash: string;

  constructor(
    mlEnabled: boolean,
    auditHash: string
  ) {
    this._mlEnabled = mlEnabled;
    this._auditHash = auditHash;
  }

  get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  set mlEnabled(value: boolean) {
    this._mlEnabled = value;
  }

  get auditHash(): string {
    return this._auditHash;
  }

  set auditHash(value: string) {
    this._auditHash = value;
  }
}

export class M73MarketEscrowFinalityAntiDupeExchangeSettlement extends MarketEscrowFinalityAntiDupeExchangeSettlement {
  private _finalityThreshold: number;

  constructor(
    mlEnabled: boolean,
    auditHash: string,
    finalityThreshold: number
  ) {
    super(mlEnabled, auditHash);
    this._finalityThreshold = finalityThreshold;
  }

  get finalityThreshold(): number {
    return this._finalityThreshold;
  }

  set finalityThreshold(value: number) {
    if (value < 0 || value > 1) {
      throw new Error('Finality threshold must be between 0 and 1');
    }
    this._finalityThreshold = value;
  }

  public settleExchange(
    exchangeId: string,
    amount: number
  ): { settled: boolean, reason?: string } {
    if (!this.mlEnabled) {
      return { settled: true };
    }

    const output = Math.min(1, Math.max(0, this._finalityThreshold * amount));
    const auditHash = this._auditHash + exchangeId;

    // Simulate ML model
    const mlOutput = this._mlEnabled ? 0.5 : 0;
    if (Math.random() < mlOutput) {
      return { settled: true };
    }

    if (output > amount) {
      return { settled: false, reason: 'Insufficient funds' };
    } else if (output < amount) {
      return { settled: false, reason: 'Exchange failed due to finality threshold' };
    } else {
      return { settled: true };
    }
  }
}

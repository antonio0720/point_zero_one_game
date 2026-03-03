// tslint:disable:no-any strict-type-checking no-console

import { M54Mechanics } from './M54Mechanics';
import { GameContext } from '../GameContext';
import { Player } from '../../Player';
import { Contract } from '../../Contract';
import { Window } from '../../Window';

export class M054RestructureWindowMidRunContractRenegotiation extends M54Mechanics {
  private mlEnabled: boolean;
  private auditHash: string;

  constructor(
    gameContext: GameContext,
    player: Player,
    contract: Contract,
    window: Window
  ) {
    super(gameContext, player, contract, window);
    this.mlEnabled = false; // default to off
    this.auditHash = '';
  }

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public setMlEnabled(value: boolean): void {
    this.mlEnabled = value;
  }

  public getAuditHash(): string {
    return this.auditHash;
  }

  public setAuditHash(value: string): void {
    this.auditHash = value;
  }

  public calculateOutput(
    player: Player,
    contract: Contract,
    window: Window
  ): number[] {
    if (!this.mlEnabled) {
      throw new Error('ML is not enabled');
    }
    const output = super.calculateOutput(player, contract, window);
    return this.boundedOutput(output);
  }

  private boundedOutput(output: number[]): number[] {
    for (let i = 0; i < output.length; i++) {
      if (output[i] > 1) {
        output[i] = 1;
      } else if (output[i] < 0) {
        output[i] = 0;
      }
    }
    return output;
  }

  public getDeterministicHash(): string {
    const hash = super.getDeterministicHash();
    this.auditHash += hash;
    return hash;
  }
}

// tslint:disable:no-any strict-type-checking
// tslint:disable:no-console

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M01a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudge: BoundedNudge;

  constructor(
    seed: number,
    boundedNudge: BoundedNudge,
    auditHash: string
  ) {
    super(seed);
    this._boundedNudge = boundedNudge;
    this._auditHash = auditHash;
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  public getOutput(): number[] {
    if (!this.mlEnabled) {
      throw new Error('ML model is disabled');
    }
    const output = super.getOutput();
    if (output.length === 0 || output[0] < 0 || output[0] > 1) {
      throw new Error('Invalid ML output');
    }
    return output;
  }

  public setSeed(seed: number): void {
    super.setSeed(seed);
  }

  private get mlEnabled(): boolean {
    // Replace with actual logic to determine if ML model is enabled
    return true;
  }
}

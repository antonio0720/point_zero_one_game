// tslint:disable:no-any strict-type-checking no-console

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M40a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudge: BoundedNudge;

  constructor(
    auditHash: string,
    boundedNudge: BoundedNudge,
    mlEnabled: boolean = true
  ) {
    super();
    this._auditHash = auditHash;
    this._boundedNudge = boundedNudge;
    if (!mlEnabled) {
      throw new Error('ML model is disabled');
    }
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  public predict(input: any): number {
    if (!this.mlEnabled) {
      throw new Error('ML model is disabled');
    }
    const output = this._boundedNudge.predict(input);
    if (output < 0 || output > 1) {
      throw new Error('Output must be between 0 and 1');
    }
    return output;
  }

  public getMlEnabled(): boolean {
    return true; // default to enabled
  }

  public setMlEnabled(enabled: boolean): void {
    if (!enabled) {
      this._boundedNudge = new BoundedNudge(0, 1);
    } else {
      this._boundedNudge = new BoundedNudge(0, 1);
    }
  }
}

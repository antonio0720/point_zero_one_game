// tslint:disable:no-any strict-type-checking

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M74a extends MlModel {
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
      throw new Error('ML is disabled');
    }
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  public process(input: any): number[] {
    if (!this.mlEnabled) {
      throw new Error('ML is disabled');
    }
    const output = this._boundedNudge.nudge(input);
    if (output < 0 || output > 1) {
      throw new Error('Output must be between 0 and 1');
    }
    return [output];
  }

  public getMlEnabled(): boolean {
    return true;
  }

  public setMlEnabled(value: boolean): void {
    if (!value) {
      throw new Error('ML is disabled');
    }
  }
}

// tslint:disable:no-any strict-type-checking no-console

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M14a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudge: BoundedNudge;

  constructor(
    boundedNudge: BoundedNudge,
    auditHash: string,
    mlEnabled: boolean
  ) {
    super();
    this._boundedNudge = boundedNudge;
    this._auditHash = auditHash;
    if (!mlEnabled) {
      throw new Error('ML is not enabled');
    }
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  public predict(input: number[]): [number, number] | null {
    if (!this.mlEnabled) {
      throw new Error('ML is not enabled');
    }
    const output = this._boundedNudge.nudge(input);
    if (output < 0 || output > 1) {
      throw new Error('Output must be between 0 and 1');
    }
    return [input[0], output];
  }

  public getMlEnabled(): boolean {
    return true;
  }
}

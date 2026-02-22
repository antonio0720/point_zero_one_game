// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from './ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M84a extends MlModel {
  private readonly _bridgeSafety: number;
  private readonly _degeneracyWatch: number;

  constructor(
    bridgeSafety: number,
    degeneracyWatch: number,
    auditHash: string,
    mlEnabled: boolean
  ) {
    super(auditHash, mlEnabled);
    this._bridgeSafety = bridgeSafety;
    this._degeneracyWatch = degeneracyWatch;
  }

  public getBridgeSafety(): number {
    return this._bridgeSafety;
  }

  public getDegeneracyWatch(): number {
    return this._degeneracyWatch;
  }

  public predict(
    catalystPairing: { [key: string]: number },
    boundedNudge: BoundedNudge
  ): number {
    if (!this.mlEnabled) {
      throw new Error('ML model is disabled');
    }
    const input = Object.values(catalystPairing).map((value) => value * boundedNudge.get());
    const output = this._model.predict(input);
    return Math.min(Math.max(output, 0), 1);
  }

  public getAuditHash(): string {
    return this.auditHash;
  }
}

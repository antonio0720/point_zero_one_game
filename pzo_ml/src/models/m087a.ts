// tslint:disable:no-any strict-type-checking

import { MlModel } from './ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M87a extends MlModel {
  private readonly _scarcityFactor: number;
  private readonly _antiFarmControlFactor: number;

  constructor(
    scarcityFactor: number,
    antiFarmControlFactor: number,
    auditHash: string,
    mlEnabled: boolean
  ) {
    super(auditHash, mlEnabled);
    this._scarcityFactor = scarcityFactor;
    this._antiFarmControlFactor = antiFarmControlFactor;
  }

  public getScarcity(): BoundedNudge {
    return new BoundedNudge(this._scarcityFactor * (this.mlEnabled ? 1 : 0));
  }

  public getAntiFarmControl(): BoundedNudge {
    return new BoundedNudge(
      this._antiFarmControlFactor * (this.mlEnabled ? 1 : 0)
    );
  }
}

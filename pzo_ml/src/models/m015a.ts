// tslint:disable:no-any strict-type-checking no-console

import { MlModel } from './MlModel';
import { BoundedNudge } from './BoundedNudge';

export class M15a extends MlModel {
  private readonly _boundedNudge: BoundedNudge;

  constructor() {
    super();
    this._boundedNudge = new BoundedNudge(0, 1);
  }

  public get boundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  public get auditHash(): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(this));
    return hash.digest('hex');
  }

  public get mlEnabled(): boolean {
    // implement kill-switch logic here
    return true; // default to enabled
  }

  public predict(input: any): number[] {
    if (!this.mlEnabled) {
      throw new Error('ML model is disabled');
    }
    const output = this._boundedNudge.nudge(super.predict(input));
    return output;
  }
}

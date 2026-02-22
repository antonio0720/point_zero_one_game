// tslint:disable:no-any strict-type-checking

import { MlModel } from './ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M63a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudge: BoundedNudge;

  constructor(
    auditHash: string,
    boundedNudge: BoundedNudge,
    mlEnabled: boolean
  ) {
    super();
    this._auditHash = auditHash;
    this._boundedNudge = boundedNudge;
    this.mlEnabled = mlEnabled;
  }

  get auditHash(): string {
    return this._auditHash;
  }

  get boundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  set mlEnabled(value: boolean) {
    if (value !== true && value !== false) {
      throw new Error('Invalid value for mlEnabled');
    }
    this._mlEnabled = value;
  }

  protected _predict(input: any): number {
    if (!this.mlEnabled) {
      return 0.5; // default to 50% chance of success
    }

    const boundedNudgeValue = this._boundedNudge.predict(input);
    if (boundedNudgeValue < 0 || boundedNudgeValue > 1) {
      throw new Error('Bounded nudge output out of range');
    }
    return boundedNudgeValue;
  }
}

// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M73a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudges: BoundedNudge[];
  private readonly _killSwitch: boolean;

  constructor(
    auditHash: string,
    boundedNudges: BoundedNudge[],
    killSwitch: boolean
  ) {
    super();
    this._auditHash = auditHash;
    this._boundedNudges = boundedNudges;
    this._killSwitch = killSwitch;
  }

  get auditHash(): string {
    return this._auditHash;
  }

  get boundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  get killSwitch(): boolean {
    return this._killSwitch;
  }

  predict(input: any): number {
    if (this.killSwitch) {
      throw new Error('ML model is disabled');
    }
    const output = this.boundedNudges.reduce((acc, nudge) => acc + nudge.nudge(input), 0);
    return Math.max(0, Math.min(output, 1));
  }

  get mlEnabled(): boolean {
    return !this.killSwitch;
  }
}

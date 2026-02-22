// tslint:disable:no-any strict-type-checking no-console

import { M13aFrictionModuleTuner } from './M13a_friction_module_tuner';
import { BoundedNudge } from '../bounded_nudge';

export class M13a extends M13aFrictionModuleTuner {
  private readonly _mlEnabled: boolean;

  constructor(
    frictionModuleId: string,
    boundedNudges: BoundedNudge[],
    auditHash: string
  ) {
    super(frictionModuleId, boundedNudges);
    this._mlEnabled = true;
  }

  get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  set mlEnabled(value: boolean) {
    this._mlEnabled = value;
  }

  protected _getOutput(
    input: number,
    frictionModuleId: string
  ): [number, string] {
    if (!this.mlEnabled) {
      throw new Error('ML is disabled');
    }
    const output = super._getOutput(input, frictionModuleId);
    return [
      Math.max(0, Math.min(output[0], 1)),
      output[1]
    ];
  }

  protected _auditHash(): string {
    return this.auditHash;
  }

  get auditHash(): string {
    const boundedNudges = this.boundedNudges.map((nudge) => nudge.toString());
    const frictionModuleId = this.frictionModuleId;
    const mlEnabled = this.mlEnabled;
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(boundedNudges));
    hash.update(frictionModuleId);
    hash.update(mlEnabled.toString());
    return hash.digest('hex');
  }

  get boundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  set boundedNudges(value: BoundedNudge[]) {
    this._boundedNudges = value;
  }
}

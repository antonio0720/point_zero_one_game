// tslint:disable:no-any strict-type-checking no-console

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M133a extends MlModel {
  private readonly _beatPlanner: any;
  private readonly _frictionMixer: any;

  constructor(
    beatPlanner: any,
    frictionMixer: any,
    mlEnabled: boolean = true
  ) {
    super();
    this._beatPlanner = beatPlanner;
    this._frictionMixer = frictionMixer;
    this.mlEnabled = mlEnabled;
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

  private _mlEnabled: boolean;

  get boundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  set boundedNudge(value: BoundedNudge) {
    if (!(value instanceof BoundedNudge)) {
      throw new Error('Invalid value for boundedNudge');
    }
    this._boundedNudge = value;
  }

  private _boundedNudge: BoundedNudge;

  get auditHash(): string {
    return this._auditHash;
  }

  set auditHash(value: string) {
    if (typeof value !== 'string') {
      throw new Error('Invalid value for auditHash');
    }
    this._auditHash = value;
  }

  private _auditHash: string;

  public getOutput(): number[] {
    if (!this.mlEnabled) {
      return [0, 1];
    }

    const beatPlannerOutput = this._beatPlanner.getOutput();
    const frictionMixerOutput = this._frictionMixer.getOutput();

    // Ensure outputs are within the bounded range
    const output = [
      Math.min(Math.max(beatPlannerOutput[0], 0), 1),
      Math.min(Math.max(frictionMixerOutput[0], 0), 1)
    ];

    return output;
  }
}

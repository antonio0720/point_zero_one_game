// tslint:disable:no-any strict-type-checking no-console

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M18a extends MlModel {
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
    if (mlEnabled) {
      // Load model weights and setup ML pipeline
      console.log('Loading M18a model...');
    } else {
      console.log('M18a model disabled.');
    }
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  public predict(input: number[]): [number[], string] | null {
    if (!this.mlEnabled) {
      console.log('M18a model disabled. Prediction failed.');
      return null;
    }
    // Run prediction through ML pipeline
    const output = this._boundedNudge.nudge(input);
    return [output, this._auditHash];
  }

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  private set mlEnabled(value: boolean) {
    this._mlEnabled = value;
  }
}

export { M18a };

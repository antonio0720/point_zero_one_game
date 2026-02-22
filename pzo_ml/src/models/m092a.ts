// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from './ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M92a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudges: BoundedNudge[];
  private readonly _mlEnabled: boolean;

  constructor(
    auditHash: string,
    boundedNudges: BoundedNudge[],
    mlEnabled: boolean
  ) {
    super();
    this._auditHash = auditHash;
    this._boundedNudges = boundedNudges;
    this._mlEnabled = mlEnabled;
  }

  get auditHash(): string {
    return this._auditHash;
  }

  get boundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  public predict(
    bestReplays: number[],
    overlayAlignment: number[]
  ): { [key: string]: number } {
    if (!this.mlEnabled) {
      throw new Error('ML model is disabled');
    }

    const predictions = {};

    for (let i = 0; i < bestReplays.length; i++) {
      const boundedNudge = this._boundedNudges[i];
      const output = Math.max(
        0,
        Math.min(1, boundedNudge.predict(bestReplays[i], overlayAlignment[i]))
      );
      predictions[`nudge_${i}`] = output;
    }

    return predictions;
  }
}

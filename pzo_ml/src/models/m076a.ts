// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { MlEnabled } from '../ml/ml_enabled';
import { BoundedNudge } from './bounded_nudge';

export class M76a {
  private readonly _auditHash: string;
  private readonly _boundedNudges: BoundedNudge[];
  private readonly _deadlockDetection: boolean;
  private readonly _manipulationDetection: boolean;
  private readonly _mlEnabled: MlEnabled;

  constructor(
    auditHash: string,
    boundedNudges: BoundedNudge[],
    deadlockDetection: boolean,
    manipulationDetection: boolean,
    mlEnabled: MlEnabled
  ) {
    this._auditHash = auditHash;
    this._boundedNudges = boundedNudges;
    this._deadlockDetection = deadlockDetection;
    this._manipulationDetection = manipulationDetection;
    this._mlEnabled = mlEnabled;
  }

  get auditHash(): string {
    return this._auditHash;
  }

  get boundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  get deadlockDetection(): boolean {
    return this._deadlockDetection;
  }

  get manipulationDetection(): boolean {
    return this._manipulationDetection;
  }

  get mlEnabled(): MlEnabled {
    return this._mlEnabled;
  }
}

export function createM76a(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  deadlockDetection: boolean,
  manipulationDetection: boolean,
  mlEnabled: MlEnabled
): M76a {
  return new M76a(auditHash, boundedNudges, deadlockDetection, manipulationDetection, mlEnabled);
}

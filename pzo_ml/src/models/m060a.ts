// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M60a extends MlModel {
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
}

export function createM60a(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  mlEnabled: boolean
): M60a {
  if (!mlEnabled) {
    throw new Error('ML is disabled');
  }

  const model = new M60a(auditHash, boundedNudges, mlEnabled);

  return model;
}

export function getM60a(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  mlEnabled: boolean
): M60a {
  if (!mlEnabled) {
    throw new Error('ML is disabled');
  }

  const model = createM60a(auditHash, boundedNudges, mlEnabled);

  return model;
}

// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M06a extends MlModel {
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

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  public isMlEnabled(): boolean {
    return this._mlEnabled;
  }
}

export function createM06a(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  mlEnabled: boolean
): M06a {
  if (!mlEnabled) {
    throw new Error('ML model is disabled');
  }

  const model = new M06a(auditHash, boundedNudges, mlEnabled);

  return model;
}

export function getM06a(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  mlEnabled: boolean
): M06a {
  if (!mlEnabled) {
    throw new Error('ML model is disabled');
  }

  const model = createM06a(auditHash, boundedNudges, mlEnabled);

  return model;
}

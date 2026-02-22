// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M67a extends MlModel {
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

export function createM67a(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  mlEnabled: boolean
): M67a {
  if (!mlEnabled) {
    throw new Error('ML is not enabled');
  }

  const model = new M67a(auditHash, boundedNudges, mlEnabled);

  return model;
}

export function getM67a(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  mlEnabled: boolean
): M67a {
  if (!mlEnabled) {
    throw new Error('ML is not enabled');
  }

  const model = createM67a(auditHash, boundedNudges, mlEnabled);

  return model;
}

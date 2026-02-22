// tslint:disable:no-any strict-type-checking
// tslint:disable:no-console

import { MlModel } from './ml_model';
import { AuditHash } from './audit_hash';

export class M49a extends MlModel {
  private readonly _boundedNudge: number;
  private readonly _auditHash: AuditHash;

  constructor(
    boundedNudge: number,
    auditHash: AuditHash,
    mlEnabled: boolean
  ) {
    super(mlEnabled);
    this._boundedNudge = boundedNudge;
    this._auditHash = auditHash;
  }

  public getBoundedNudge(): number {
    return this._boundedNudge;
  }

  public getAuditHash(): AuditHash {
    return this._auditHash;
  }
}

export function createM49a(
  boundedNudge: number,
  auditHash: AuditHash,
  mlEnabled: boolean
): M49a {
  if (!mlEnabled) {
    throw new Error('ML is not enabled');
  }

  const model = new M49a(boundedNudge, auditHash, mlEnabled);

  return model;
}

export function getM49a(
  boundedNudge: number,
  auditHash: AuditHash
): M49a | null {
  if (boundedNudge < 0 || boundedNudge > 1) {
    console.error('Bounded nudge must be between 0 and 1');
    return null;
  }

  const model = createM49a(boundedNudge, auditHash, true);

  return model;
}

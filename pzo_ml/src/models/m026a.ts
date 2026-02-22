// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M26a extends MlModel {
  private readonly _auditHash: string;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly mlEnabled: boolean = true,
    public readonly boundedNudges: BoundedNudge[] = [],
    public readonly auditHash: string
  ) {
    super(id, name, description);
    this._auditHash = auditHash;
  }

  get auditHash(): string {
    return this._auditHash;
  }

  setAuditHash(auditHash: string): void {
    this._auditHash = auditHash;
  }
}

export function createM26a(
  id: string,
  name: string,
  description: string,
  mlEnabled: boolean = true,
  boundedNudges: BoundedNudge[] = [],
  auditHash: string
): M26a {
  return new M26a(id, name, description, mlEnabled, boundedNudges, auditHash);
}

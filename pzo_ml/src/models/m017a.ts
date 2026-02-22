// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { BoundedNudge } from '../bounded_nudge';
import { AuditHash } from '../audit_hash';

export class M17a {
  private readonly _mlEnabled: boolean;
  private readonly _nudges: BoundedNudge[];
  private readonly _auditHash: AuditHash;

  constructor(
    mlEnabled: boolean,
    nudges: BoundedNudge[],
    auditHash: AuditHash
  ) {
    this._mlEnabled = mlEnabled;
    this._nudges = nudges;
    this._auditHash = auditHash;
  }

  public getMlEnabled(): boolean {
    return this._mlEnabled;
  }

  public getNudges(): BoundedNudge[] {
    return this._nudges;
  }

  public getAuditHash(): AuditHash {
    return this._auditHash;
  }
}

export function createM17a(
  mlEnabled: boolean,
  nudges: BoundedNudge[],
  auditHash: AuditHash
): M17a {
  if (!mlEnabled) {
    throw new Error('ML is not enabled');
  }

  const boundedNudges = nudges.map((nudge) => {
    if (nudge.value < 0 || nudge.value > 1) {
      throw new Error('Nudge value must be between 0 and 1');
    }
    return nudge;
  });

  return new M17a(mlEnabled, boundedNudges, auditHash);
}

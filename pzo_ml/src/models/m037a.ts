// tslint:disable:no-any strict-type-checking no-object-literal-types

import { BoundedNudge } from './bounded_nudge';
import { AuditHash } from '../audit_hash';

export class M37a {
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

  public predict(): number {
    if (!this._mlEnabled) return 0;

    const streakCollapseProbability =
      this._nudges.reduce((acc, nudge) => acc + nudge.value, 0);

    // Ensure output is bounded between 0 and 1
    const boundedOutput = Math.max(0, Math.min(streakCollapseProbability, 1));

    return boundedOutput;
  }

  public getAuditHash(): AuditHash {
    return this._auditHash;
  }
}

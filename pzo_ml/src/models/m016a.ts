// tslint:disable:no-any strict-type-checking

import { BoundedNudge } from './bounded_nudge';
import { AuditHash } from '../audit_hash';

export class M16a {
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
    if (!this._mlEnabled) {
      return 0.5; // default to 50% chance when ML is disabled
    }

    const votes: number[] = [];
    for (const nudge of this._nudges) {
      votes.push(nudge.getVote());
    }
    const consensusVote = Math.max(...votes);
    const contrarianVote = Math.min(...votes);

    if (consensusVote > contrarianVote) {
      return 1.0; // predict majority vote
    } else {
      return 0.0; // predict minority vote
    }
  }

  public getAuditHash(): AuditHash {
    return this._auditHash;
  }
}

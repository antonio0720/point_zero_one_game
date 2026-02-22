// tslint:disable:no-any strict-type-checking
import { BoundedNudge } from './bounded_nudge';
import { AuditHash } from './audit_hash';

export class M46a {
  private readonly _mlEnabled: boolean;
  private readonly _boundedNudge: BoundedNudge;

  constructor(mlEnabled: boolean, boundedNudge: BoundedNudge) {
    this._mlEnabled = mlEnabled;
    this._boundedNudge = boundedNudge;
  }

  public detectAnomaly(eventStream: any[]): number | null {
    if (!this._mlEnabled) return null;

    const auditHash = new AuditHash();
    const hash = auditHash.hash(eventStream);

    const anomalyScore = this._boundedNudge.nudge(hash);
    return Math.min(Math.max(anomalyScore, 0), 1);
  }
}

export function createM46a(mlEnabled: boolean): M46a {
  const boundedNudge = new BoundedNudge();
  return new M46a(mlEnabled, boundedNudge);
}

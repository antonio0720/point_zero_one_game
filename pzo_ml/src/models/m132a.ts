// tslint:disable:no-any strict-type-checking
import { BoundedNudge } from '../models/bounded_nudge';
import { AuditHash } from '../models/audit_hash';

export class M132a {
  private readonly mlEnabled: boolean;
  private readonly boundedNudges: BoundedNudge[];
  private readonly auditHash: AuditHash;

  constructor(
    mlEnabled: boolean,
    boundedNudges: BoundedNudge[],
    auditHash: AuditHash
  ) {
    this.mlEnabled = mlEnabled;
    this.boundedNudges = boundedNudges;
    this.auditHash = auditHash;
  }

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public getBoundedNudges(): BoundedNudge[] {
    return this.boundedNudges;
  }

  public getAuditHash(): AuditHash {
    return this.auditHash;
  }
}

export function createM132a(
  mlEnabled: boolean,
  boundedNudges: BoundedNudge[],
  auditHash: AuditHash
): M132a {
  if (!mlEnabled) {
    throw new Error('ML is not enabled');
  }

  const output = boundedNudges.map((nudge) => nudge.getOutput());
  const boundedOutput = Math.min(Math.max(...output), 1);

  return new M132a(mlEnabled, boundedNudges, auditHash);
}

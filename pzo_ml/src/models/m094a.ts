// tslint:disable:no-any strict-type-checking
import { BoundedNudge } from '../bounded_nudge';
import { AuditHash } from '../audit_hash';

export class M94a {
  private readonly _ml_enabled: boolean;
  private readonly _bounded_nudge: BoundedNudge;
  private readonly _audit_hash: AuditHash;

  constructor(mlEnabled: boolean, boundedNudge: BoundedNudge, auditHash: AuditHash) {
    this._ml_enabled = mlEnabled;
    this._bounded_nudge = boundedNudge;
    this._audit_hash = auditHash;
  }

  public getMlEnabled(): boolean {
    return this._ml_enabled;
  }

  public getBoundedNudge(): BoundedNudge {
    return this._bounded_nudge;
  }

  public getAuditHash(): AuditHash {
    return this._audit_hash;
  }
}

export function createM94a(mlEnabled: boolean, boundedNudge: BoundedNudge, auditHash: AuditHash): M94a {
  if (!mlEnabled) {
    throw new Error('ML is disabled');
  }

  const model = new M94a(mlEnabled, boundedNudge, auditHash);

  return model;
}

export function getMlModel(): M94a | null {
  try {
    const mlEnabled = true; // Replace with actual ML enabled flag
    const boundedNudge: BoundedNudge = { min: 0, max: 1 }; // Replace with actual bounded nudge values
    const auditHash: AuditHash = 'audit_hash_value'; // Replace with actual audit hash value

    return createM94a(mlEnabled, boundedNudge, auditHash);
  } catch (error) {
    console.error('Error creating ML model:', error);
    return null;
  }
}

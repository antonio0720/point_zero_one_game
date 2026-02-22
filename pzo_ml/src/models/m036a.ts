// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from './ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M36a extends MlModel {
  public readonly ml_enabled = false;

  private readonly _audit_hash: string;
  private readonly _bounded_nudge: BoundedNudge;

  constructor(audit_hash: string, bounded_nudge: BoundedNudge) {
    super();
    this._audit_hash = audit_hash;
    this._bounded_nudge = bounded_nudge;
  }

  public verifyAchievementProof(achievement_proof: any): boolean {
    if (!this.ml_enabled) {
      return false;
    }
    const proofHash = this.calculateProofHash(achievement_proof);
    return proofHash === this._audit_hash;
  }

  private calculateProofHash(achievement_proof: any): string {
    // implementation of the hash function
    return 'hash';
  }

  public getAuditHash(): string {
    return this._audit_hash;
  }
}

// tslint:disable:no-any strict-type-checking

import { BoundedNudge } from '../bounded_nudge';
import { AuditHash } from '../audit_hash';

export class M95a {
  private readonly _ml_enabled: boolean;
  private readonly _bounded_nudge: BoundedNudge;

  constructor(mlEnabled: boolean, boundedNudge: BoundedNudge) {
    this._ml_enabled = mlEnabled;
    this._bounded_nudge = boundedNudge;
  }

  public get mlEnabled(): boolean {
    return this._ml_enabled;
  }

  public get auditHash(): AuditHash {
    const hash = new AuditHash();
    hash.add('ml_enabled', this.mlEnabled);
    hash.add('bounded_nudge', this._bounded_nudge.toString());
    return hash;
  }

  public wipeClinicCausalExplainerMinimalCounterfactualSet(
    patientData: any,
    treatmentPlan: any
  ): number {
    if (!this.mlEnabled) {
      throw new Error('ML is not enabled');
    }

    const counterfactuals = this._bounded_nudge.getCounterfactuals(patientData, treatmentPlan);
    return Math.min(Math.max(counterfactuals.reduce((a, b) => a + b, 0), 0), 1);
  }
}

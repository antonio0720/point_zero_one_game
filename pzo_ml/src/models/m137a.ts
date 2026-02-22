// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M137a extends MlModel {
  public readonly ml_enabled = false;

  private _audit_hash: string;
  private _hotfix_triage_router: BoundedNudge;
  private _quarantine_router: BoundedNudge;

  constructor() {
    super();
    this._audit_hash = 'M137a';
    this._hotfix_triage_router = new BoundedNudge(0, 1);
    this._quarantine_router = new BoundedNudge(0, 1);
  }

  public get audit_hash(): string {
    return this._audit_hash;
  }

  public get hotfix_triage_router(): BoundedNudge {
    return this._hotfix_triage_router;
  }

  public get quarantine_router(): BoundedNudge {
    return this._quarantine_router;
  }
}

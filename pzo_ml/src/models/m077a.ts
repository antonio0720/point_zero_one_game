// tslint:disable:no-any strict-type-checking

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M77a extends MlModel {
  private readonly _scopeCompliance: BoundedNudge;
  private readonly _abuseGuard: BoundedNudge;

  constructor() {
    super();
    this._scopeCompliance = new BoundedNudge(0, 1);
    this._abuseGuard = new BoundedNudge(0, 1);
  }

  public get scopeCompliance(): BoundedNudge {
    return this._scopeCompliance;
  }

  public get abuseGuard(): BoundedNudge {
    return this._abuseGuard;
  }

  public get auditHash(): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(this.scopeCompliance.value));
    hash.update(JSON.stringify(this.abuseGuard.value));
    return hash.digest('hex');
  }

  public isMlEnabled(): boolean {
    // implement ml_enabled kill-switch logic here
    return true;
  }
}

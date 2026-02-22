// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M39a extends MlModel {
  private readonly _nudge: BoundedNudge;

  constructor() {
    super();
    this._nudge = new BoundedNudge(0, 1);
  }

  public async run(
    state: any,
    action: any,
    reward: number,
    next_state: any
  ): Promise<{ nudge: number; audit_hash: string }> {
    if (!this.ml_enabled) {
      return { nudge: 0, audit_hash: 'ml_disabled' };
    }

    const output = this._nudge.run(state, action);
    const auditHash = await this.auditHash(state, next_state);

    return { nudge: output, audit_hash: auditHash };
  }

  private async auditHash(
    state: any,
    next_state: any
  ): Promise<string> {
    // implement your custom audit hash logic here
    return 'audit_hash';
  }
}

export function getM39a(): M39a {
  return new M39a();
}

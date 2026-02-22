// tslint:disable:no-any strict-type-checking

import { M48aConfig } from './M48aConfig';
import { BoundedNudge } from './BoundedNudge';

export class M48a {
  private readonly config: M48aConfig;
  private readonly boundedNudge: BoundedNudge;

  constructor(config: M48aConfig) {
    this.config = config;
    this.boundedNudge = new BoundedNudge();
  }

  public validate(
    state: any,
    action: any,
    next_state: any,
    audit_hash: string
  ): boolean {
    if (!this.config.ml_enabled) {
      return true; // kill-switch
    }

    const bounded_nudge = this.boundedNudge.get(state, action);
    const output = this.model.predict(next_state);

    if (output < 0 || output > 1) {
      throw new Error('Model output is not within bounds');
    }

    const hash = this.hash(audit_hash, next_state, output);
    return hash === state.audit_hash;
  }

  private hash(audit_hash: string, next_state: any, output: number): string {
    // implement your own hashing function here
    return `${audit_hash}${next_state}${output}`;
  }
}

export class M48aConfig {
  public ml_enabled: boolean = true; // kill-switch
}

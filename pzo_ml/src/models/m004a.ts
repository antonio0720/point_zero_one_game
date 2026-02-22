// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M04aConfig } from './m004a_config';
import { M04aState } from './m004a_state';

export class M04aDeckReactorRlPolicy {
  private config: M04aConfig;
  private state: M04aState;

  constructor(config: M04aConfig, state: M04aState) {
    this.config = config;
    this.state = state;
  }

  public act(): number[] {
    if (!this.mlEnabled()) {
      return [0.5];
    }

    const action = this.getAction();
    const boundedAction = Math.min(Math.max(action, 0), 1);
    const auditHash = this.getAuditHash();

    return [boundedAction, auditHash];
  }

  private getAction(): number {
    // implementation of the dynamic draw mixing policy
    // ...
  }

  private getAuditHash(): string {
    // implementation of the audit hash calculation
    // ...
  }

  private mlEnabled(): boolean {
    // implementation of the ML enabled check
    // ...
  }
}

export function createM04aDeckReactorRlPolicy(config: M04aConfig, state: M04aState): M04aDeckReactorRlPolicy {
  return new M04aDeckReactorRlPolicy(config, state);
}

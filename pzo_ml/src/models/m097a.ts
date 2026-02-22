// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M97aConfig } from './m097a_config';
import { BoundedNudge } from '../bounded_nudge';
import { AuditHash } from '../audit_hash';

export class M97a {
  private config: M97aConfig;
  private boundedNudge: BoundedNudge;
  private auditHash: AuditHash;

  constructor(config: M97aConfig) {
    this.config = config;
    this.boundedNudge = new BoundedNudge();
    this.auditHash = new AuditHash();
  }

  public verifySeedCommit(seedCommit: string): boolean {
    if (!this.mlEnabled()) return false;

    const hash = this.auditHash.hash(seedCommit);
    const bias = this.config.bias;
    const rngIntegrity = this.boundedNudge.nudge(hash, bias);

    return rngIntegrity >= 0 && rngIntegrity <= 1;
  }

  public verifySeedReveal(seedReveal: string): boolean {
    if (!this.mlEnabled()) return false;

    const hash = this.auditHash.hash(seedReveal);
    const bias = this.config.bias;
    const rngIntegrity = this.boundedNudge.nudge(hash, bias);

    return rngIntegrity >= 0 && rngIntegrity <= 1;
  }

  private mlEnabled(): boolean {
    // implement your ML model enable/disable logic here
    return true; // default to enabled for now
  }
}

export { M97aConfig };

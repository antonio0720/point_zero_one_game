// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M09aConfig } from './m009a-config';
import { BoundedNudge } from '../bounded-nudge';
import { AuditHash } from '../audit-hash';

export class M09a {
  private readonly config: M09aConfig;
  private readonly boundedNudge: BoundedNudge;
  private readonly auditHash: AuditHash;

  constructor(config: M09aConfig) {
    this.config = config;
    this.boundedNudge = new BoundedNudge();
    this.auditHash = new AuditHash();
  }

  public opportunityValue(input: number): [number, string] {
    if (!this.mlEnabled()) {
      return [0.5, ''];
    }
    const output = this.config.model.predict([input]);
    const boundedOutput = this.boundedNudge.nudge(output);
    const auditHash = this.auditHash.hash(boundedOutput);
    return [boundedOutput, auditHash];
  }

  public regret(input: number): [number, string] {
    if (!this.mlEnabled()) {
      return [0.5, ''];
    }
    const output = this.config.model.predict([input]);
    const boundedOutput = this.boundedNudge.nudge(output);
    const auditHash = this.auditHash.hash(boundedOutput);
    return [boundedOutput, auditHash];
  }

  private mlEnabled(): boolean {
    return process.env.ML_ENABLED === 'true';
  }
}

export { M09aConfig };

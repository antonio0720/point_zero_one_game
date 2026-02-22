// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M30aConfig } from './m030a_config';
import { BoundedNudge } from '../bounded_nudge';
import { AuditHash } from '../../audit_hash';

export class M30a {
  private readonly config: M30aConfig;
  private readonly boundedNudge: BoundedNudge;
  private readonly auditHash: AuditHash;

  constructor(config: M30aConfig, boundedNudge: BoundedNudge, auditHash: AuditHash) {
    this.config = config;
    this.boundedNudge = boundedNudge;
    this.auditHash = auditHash;
  }

  public predict(
    takeoverRouting: number,
    unwindRouting: number
  ): { takeoverProbability: number; unwindProbability: number } {
    if (!this.mlEnabled()) {
      return { takeoverProbability: 0, unwindProbability: 1 };
    }

    const takeoverProbability = this.boundedNudge(takeoverRouting);
    const unwindProbability = this.boundedNudge(unwindRouting);

    const auditHashValue = this.auditHash({
      takeoverProbability,
      unwindProbability,
    });

    return { takeoverProbability, unwindProbability };
  }

  private mlEnabled(): boolean {
    // implement your logic here to determine if ML is enabled
    return true;
  }
}

export function createM30a(
  config: M30aConfig,
  boundedNudge: BoundedNudge,
  auditHash: AuditHash
): M30a {
  return new M30a(config, boundedNudge, auditHash);
}

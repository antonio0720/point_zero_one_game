// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M100aConfig } from './M100aConfig';
import { BoundedNudge } from './BoundedNudge';
import { AuditHash } from './AuditHash';

export class M100a {
  private config: M100aConfig;
  private boundedNudge: BoundedNudge;
  private auditHash: AuditHash;

  constructor(config: M100aConfig) {
    this.config = config;
    this.boundedNudge = new BoundedNudge(this.config);
    this.auditHash = new AuditHash();
  }

  public checkEvidenceChain(evidenceChain: any[]): boolean {
    if (!this.config.mlEnabled) {
      return false;
    }
    const boundedScores = evidenceChain.map((evidence, index) => {
      const score = this.boundedNudge.getScore(evidence);
      return { score, index };
    });
    const sortedBoundedScores = boundedScores.sort((a, b) => a.score - b.score);
    const auditHashValue = this.auditHash.getAuditHash(sortedBoundedScores);
    if (auditHashValue !== evidenceChain[0].auditHash) {
      return false;
    }
    return true;
  }

  public getAuditHash(): string {
    return this.auditHash.getAuditHash();
  }
}

export { M100aConfig, BoundedNudge, AuditHash };

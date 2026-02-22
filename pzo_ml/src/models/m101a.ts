// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { M101aMutatorDraft } from './M101aMutatorDraft';
import { BoundedNudge } from '../utils/BoundedNudge';
import { AuditHash } from '../utils/AuditHash';

export class M101a extends M101aMutatorDraft {
  private mlEnabled: boolean;
  private boundedNudges: BoundedNudge[];
  private auditHash: AuditHash;

  constructor() {
    super();
    this.mlEnabled = false; // default to off
    this.boundedNudges = [];
    this.auditHash = new AuditHash();
  }

  public setMlEnabled(enabled: boolean): void {
    this.mlEnabled = enabled;
  }

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public addBoundedNudge(nudge: BoundedNudge): void {
    if (this.boundedNudges.length < 10) { // max 10 nudges
      this.boundedNudges.push(nudge);
    }
  }

  public getBoundedNudges(): BoundedNudge[] {
    return this.boundedNudges;
  }

  public setAuditHash(hash: AuditHash): void {
    this.auditHash = hash;
  }

  public getAuditHash(): AuditHash {
    return this.auditHash;
  }
}

export { M101a };

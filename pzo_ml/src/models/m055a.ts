// pzo_ml/src/models/m055a.ts

import { BoundedNudge } from '../types';
import { AuditHash } from '../utils/audit-hash';

export class M55a {
  private readonly _mlEnabled: boolean;
  private readonly _boundedNudges: BoundedNudge[];
  private readonly _auditHash: string;

  constructor(
    mlEnabled: boolean,
    boundedNudges: BoundedNudge[],
    auditHash: string
  ) {
    this._mlEnabled = mlEnabled;
    this._boundedNudges = boundedNudges;
    this._auditHash = auditHash;
  }

  public get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  public get boundedNudges(): BoundedNudge[] {
    return this._boundedNudges.map((nudge) => ({
      ...nudge,
      output: Math.min(Math.max(nudge.output, 0), 1),
    }));
  }

  public get auditHash(): string {
    return AuditHash(this._auditHash);
  }
}

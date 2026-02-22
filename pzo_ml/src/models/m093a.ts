// pzo_ml/src/models/m093a.ts

import { BoundedNudge } from '../types';
import { AuditHash } from '../utils/audit-hash';

export class M93a {
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

  get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  get boundedNudges(): BoundedNudge[] {
    return this._boundedNudges.map((nudge) => ({
      ...nudge,
      value: Math.min(Math.max(nudge.value, 0), 1),
    }));
  }

  get auditHash(): string {
    return AuditHash(this._auditHash);
  }
}

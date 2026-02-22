// pzo_ml/src/models/m082a.ts

import { BoundedNudge } from '../types';
import { AuditHash } from '../audit-hash';

export class M82a {
  private readonly _mlEnabled: boolean;
  private readonly _boundedNudges: BoundedNudge[];
  private readonly _auditHash: AuditHash;

  constructor(
    mlEnabled: boolean,
    boundedNudges: BoundedNudge[],
    auditHash: AuditHash
  ) {
    this._mlEnabled = mlEnabled;
    this._boundedNudges = boundedNudges;
    this._auditHash = auditHash;
  }

  public get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  public get boundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  public get auditHash(): AuditHash {
    return this._auditHash;
  }
}

export function createM82a(
  mlEnabled: boolean,
  boundedNudges: BoundedNudge[],
  auditHash: AuditHash
): M82a {
  if (!mlEnabled) {
    throw new Error('ML is not enabled');
  }

  const model = new M82a(mlEnabled, boundedNudges, auditHash);

  // Ensure outputs are within bounds (0-1)
  for (const nudge of model.boundedNudges) {
    if (nudge.value < 0 || nudge.value > 1) {
      throw new Error('Bounded nudges must be between 0 and 1');
    }
  }

  return model;
}

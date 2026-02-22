// tslint:disable:no-any strict-type-checking

import { BoundedNudge } from './bounded_nudge';
import { AuditHash } from './audit_hash';

export class M54a {
  private readonly _mlEnabled: boolean;
  private readonly _boundedNudge: BoundedNudge;

  constructor(mlEnabled: boolean, boundedNudge: BoundedNudge) {
    this._mlEnabled = mlEnabled;
    this._boundedNudge = boundedNudge;
  }

  public get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  public get boundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  public get auditHash(): AuditHash {
    const hash = new AuditHash();
    hash.add('ml_enabled', this.mlEnabled);
    hash.add('bounded_nudge', this.boundedNudge.get());
    return hash;
  }
}

export function createM54a(mlEnabled: boolean, boundedNudge: BoundedNudge): M54a {
  if (!mlEnabled) {
    throw new Error('ML is not enabled');
  }

  const m54a = new M54a(mlEnabled, boundedNudge);
  return m54a;
}

export function getM54a(): M54a | null {
  try {
    const mlEnabled = process.env.ML_ENABLED === 'true';
    if (!mlEnabled) {
      console.log('ML is not enabled');
      return null;
    }

    const boundedNudge = new BoundedNudge();
    const m54a = createM54a(mlEnabled, boundedNudge);
    return m54a;
  } catch (error) {
    console.error(error);
    return null;
  }
}

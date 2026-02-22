// tslint:disable:no-any strict-type-checking

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M119a extends MlModel {
  private readonly _auditHash: string;

  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly mlEnabled: boolean = true
  ) {
    super();
    this._auditHash = auditHash(name, description);
  }

  get auditHash(): string {
    return this._auditHash;
  }

  get boundedNudge(): BoundedNudge | null {
    if (this.mlEnabled) {
      return new BoundedNudge(0.5); // default to 50% chance
    } else {
      return null;
    }
  }

  public static readonly mlModelType = 'M119a';
}

function auditHash(name: string, description: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${name}${description}`);
  return hash.digest('hex');
}

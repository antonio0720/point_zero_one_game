// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M66a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudges: BoundedNudge[];
  private readonly _killSwitch: boolean;

  constructor(
    auditHash: string,
    boundedNudges: BoundedNudge[],
    killSwitch: boolean
  ) {
    super();
    this._auditHash = auditHash;
    this._boundedNudges = boundedNudges;
    this._killSwitch = killSwitch;
  }

  get auditHash(): string {
    return this._auditHash;
  }

  get boundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  get killSwitch(): boolean {
    return this._killSwitch;
  }
}

export function createM66a(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  killSwitch: boolean
): M66a {
  return new M66a(auditHash, boundedNudges, killSwitch);
}

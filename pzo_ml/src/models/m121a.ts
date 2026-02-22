// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M121a extends MlModel {
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

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  public isKillSwitchEnabled(): boolean {
    return this._killSwitch;
  }

  public predict(input: number[]): number[] {
    if (this.isKillSwitchEnabled()) {
      throw new Error('ML model kill-switch enabled');
    }
    const output = this._boundedNudges.map((nudge) => nudge.predict(input));
    return output.map((value) => Math.min(Math.max(value, 0), 1));
  }

  public getOutputSize(): number {
    return this._boundedNudges.length;
  }
}

// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M07a extends MlModel {
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

  public async score(
    affordability: number,
    defaultRisk: number
  ): Promise<number> {
    if (this.isKillSwitchEnabled()) {
      throw new Error('ML model kill-switch enabled');
    }
    const boundedAffordability = Math.min(Math.max(affordability, 0), 1);
    const boundedDefaultRisk = Math.min(Math.max(defaultRisk, 0), 1);
    return this._boundedNudges.reduce((acc, nudge) => {
      acc += nudge.score(boundedAffordability, boundedDefaultRisk);
      return acc;
    }, 0);
  }
}

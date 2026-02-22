// tslint:disable:no-any strict-type-checking
import { MlModel } from './ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M52a extends MlModel {
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

  public predict(
    input: any,
    deterministic: boolean
  ): { output: number; auditHash: string } {
    if (this.isKillSwitchEnabled()) {
      throw new Error('ML model kill-switch enabled');
    }
    const output = Math.min(Math.max(input, 0), 1);
    return {
      output,
      auditHash: this.getAuditHash(),
    };
  }

  public getOutput(): number {
    if (this.isKillSwitchEnabled()) {
      throw new Error('ML model kill-switch enabled');
    }
    const output = Math.min(Math.max(this._boundedNudges[0].getInput(), 0), 1);
    return output;
  }
}

// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M68a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudges: BoundedNudge[];
  private readonly _killSwitch: boolean;

  constructor(
    boundedNudges: BoundedNudge[],
    auditHash: string,
    killSwitch: boolean
  ) {
    super();
    this._boundedNudges = boundedNudges;
    this._auditHash = auditHash;
    this._killSwitch = killSwitch;
  }

  get boundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  get auditHash(): string {
    return this._auditHash;
  }

  get killSwitch(): boolean {
    return this._killSwitch;
  }

  public generateScenario(
    playerHealth: number,
    playerLevel: number
  ): { [key: string]: number } {
    if (this.killSwitch) {
      throw new Error('ML model disabled');
    }
    const scenario = {};
    for (const nudge of this.boundedNudges) {
      const output = Math.random();
      if (output < 0.5) {
        scenario[nudge.key] = nudge.min;
      } else {
        scenario[nudge.key] = nudge.max;
      }
    }
    return scenario;
  }

  public getAuditHash(): string {
    return this.auditHash;
  }
}

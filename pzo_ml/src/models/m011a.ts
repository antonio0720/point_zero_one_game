// tslint:disable:no-any strict-type-checking no-object-literal-types
import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M11a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudge: BoundedNudge;

  constructor(
    auditHash: string,
    boundedNudge: BoundedNudge,
    mlEnabled: boolean = true
  ) {
    super();
    this._auditHash = auditHash;
    this._boundedNudge = boundedNudge;
    if (!mlEnabled) {
      throw new Error('M11a model is disabled');
    }
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudge(): BoundedNudge {
    return this._boundedNudge;
  }

  public predict(input: number[]): [number, number] | null {
    if (!this.mlEnabled) {
      throw new Error('M11a model is disabled');
    }
    const output = this._boundedNudge.nudge(this._model.predict(input));
    return [output, this.getAuditHash()];
  }

  public get mlEnabled(): boolean {
    return true;
  }

  private _model: any; // tslint:disable-line:no-any
}

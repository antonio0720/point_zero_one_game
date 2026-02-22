// tslint:disable:no-any strict-type-checking
import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M78a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudges: BoundedNudge[];

  constructor(
    auditHash: string,
    boundedNudges: BoundedNudge[],
    mlEnabled: boolean = true
  ) {
    super();
    this._auditHash = auditHash;
    this._boundedNudges = boundedNudges;
    if (!mlEnabled) {
      throw new Error('Ml model is disabled');
    }
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  public predict(input: any): number {
    if (!this.mlEnabled) {
      throw new Error('Ml model is disabled');
    }
    // implement the prediction logic here
    const likelihood = Math.min(Math.max(0, input), 1);
    return likelihood;
  }

  get mlEnabled(): boolean {
    return true; // default to enabled
  }

  set mlEnabled(value: boolean) {
    if (!value) {
      throw new Error('Ml model is disabled');
    }
  }
}
